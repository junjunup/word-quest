using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;
using WordQuest.Application;
using WordQuest.Application.Quiz;
using WordQuest.Content;
using WordQuest.Domain.Game;
using WordQuest.Domain.Quiz;
using WordQuest.Infrastructure.Api.Dto;
using WordQuest.Infrastructure.Api.Services;
using WordQuest.Infrastructure.Storage;
using WordQuest.Gameplay.Boss;

namespace WordQuest.Gameplay
{
    public sealed class LevelSelection
    {
        public LevelSelection(
            LevelDefinition level,
            Difficulty difficulty,
            string wordbookId = "cet4")
        {
            Level = level ?? throw new ArgumentNullException(nameof(level));
            Difficulty = difficulty ??
                         throw new ArgumentNullException(nameof(difficulty));
            WordbookId = string.IsNullOrWhiteSpace(wordbookId)
                ? "cet4"
                : wordbookId;
        }

        public LevelDefinition Level { get; }
        public Difficulty Difficulty { get; }
        public string WordbookId { get; }
    }

    public sealed class QuizAnswer
    {
        public string Value { get; set; }
        public bool Correct { get; set; }
        public int ResponseMs { get; set; }
        public bool HintUsed { get; set; }
        public double ScoreRatio { get; set; } = 1d;
        public QuestionType Type { get; set; }
    }

    public sealed class WrongAnswerTutorContext
    {
        public string PlayerAnswer { get; set; } = string.Empty;
        public string CorrectAnswer { get; set; } = string.Empty;
        public string AnswerQuality { get; set; } = "wrong";
        public int EditDistance { get; set; }
        public float Similarity { get; set; }
        public string FuzzyFeedback { get; set; } = string.Empty;
        public int CorrectStreak { get; set; }
        public int WrongStreak { get; set; }
    }

    public sealed class GameFlowController : IDisposable
    {
        private readonly IVocabularyService vocabulary;
        private readonly ILearningService learning;
        private readonly LevelSettlementController settlement;
        private readonly WorldController world;
        private readonly string userId;
        private readonly PendingSyncQueue pending;
        private readonly IDailyLearningService dailyService;
        private DailyLearningSessionDto dailySession;
        private QuizQuestion activeQuestion;
        private QuestionType recommendedType;
        private bool questionDowngraded;
        private string activeEncounterId;
        private int questionGeneration;
        private CancellationTokenSource questionLoad;
        private QuizRecordRequest pendingRequest;
        private QuizRecordRequest firstRequest;
        private QuizRecordRequest correctionRequest;
        private QuizAnswer pendingAnswer;
        private bool firstSaved;
        private bool feedbackSaving;
        private bool feedbackPending;
        private bool pendingDefeated;
        private readonly CancellationTokenSource flowLifetime = new CancellationTokenSource();
        private readonly AdaptiveQuizPolicy adaptive = new AdaptiveQuizPolicy();
        private readonly List<WordDto> words = new List<WordDto>();
        private LevelSelection selection;
        private GameSession session;
        private bool paused;
        private bool disposed;
        private bool awaitingAnswer;
        private bool submitting;
        private bool ordinaryCorrect;
        private WordDto feedbackWord;
        private Word questionWord;
        private readonly Dictionary<string, Word> encounterWords = new Dictionary<string, Word>();
        private bool quizOpen;
        private BossController boss;
        private bool bossQuestion;
        private bool continueBossBattle;
        private int deferredBossWrongAnswers;
        private Encounter activeEncounter;
        private CancellationToken activeToken;
        private bool finishing;
        private QuestionType? suggestedQuestionType;

        public GameFlowController(
            IVocabularyService vocabulary,
            ILearningService learning,
            IGameService game,
            PendingSyncQueue pending,
            WorldController world,
            string userId,
            IDailyLearningService dailyService = null)
        {
            this.vocabulary = vocabulary ??
                              throw new ArgumentNullException(nameof(vocabulary));
            this.learning = learning ??
                            throw new ArgumentNullException(nameof(learning));
            if (game == null)
                throw new ArgumentNullException(nameof(game));
            if (pending == null)
                throw new ArgumentNullException(nameof(pending));
            this.pending = pending;
            this.dailyService = dailyService;
            settlement = new LevelSettlementController(
                game.SaveProgressAsync,
                pending);
            this.world = world ?? throw new ArgumentNullException(nameof(world));
            this.userId = string.IsNullOrWhiteSpace(userId)
                ? throw new ArgumentException(
                    "A signed-in user is required for game progress.",
                    nameof(userId))
                : userId.Trim();
            world.Encountered += OnEncountered;
            world.BossPlayerDamaged += OnBossPlayerDamaged;
        }

        public event Action<string> AnswerSaveFailed;
        public event Action<bool> QuestionLoading;
        public event Action<DailyLearningSessionDto> DailyFinished;
        public bool IsDailyLearning => dailySession != null;
        public bool IsOrdinaryEncounter => !bossQuestion && activeEncounter?.Kind == EncounterKind.Monster;
        public event Action<GameSessionSnapshot> SessionChanged;
        public event Action<QuizQuestion> QuestionReady;
        public event Action<LevelResult> Finished;
        public event Action<bool> PauseChanged;
        public event Action<bool> AnswerEvaluated;
        public event Action BossAppeared;
        public event Action BossDefeated;
        public event Action<WordDto> NpcRequested;
        public event Action<WordDto, WrongAnswerTutorContext>
            WrongAnswerTutorRequested;
        public event Action<WordDto> CorrectAnswerFeedbackRequested;

        public GameSessionSnapshot Snapshot => session?.Snapshot;

        public async Task StartLevelAsync(
            LevelSelection levelSelection,
            CancellationToken token,
            DailyLearningSessionDto daily = null)
        {
            dailySession = daily;
            if ((daily?.pendingFeedback?.Length ?? 0) > 0)
                throw new InvalidOperationException("请先确认上次学习的反馈。");
            selection = levelSelection ??
                        throw new ArgumentNullException(nameof(levelSelection));
            activeToken = token;
            finishing = false;
            paused = false;
            quizOpen = false;
            bossQuestion = false;
            continueBossBattle = false;
            deferredBossWrongAnswers = 0;
            activeEncounter = null;
            suggestedQuestionType = null;
            var response = daily == null
                ? await vocabulary.GetLevelWordsAsync(selection.Level.Chapter, selection.Level.Id, selection.WordbookId, token)
                : WordQuest.Infrastructure.Api.ApiResult<WordDto[]>.Success(200, DailyLearningPlan.Remaining(daily));
            if (disposed || token.IsCancellationRequested) return;
            if (!response.IsSuccess)
                throw new InvalidOperationException(response.Message);

            encounterWords.Clear();
            questionWord = null;
            words.Clear();
            words.AddRange(response.Data ?? Array.Empty<WordDto>());
            if (words.Count == 0)
            {
                throw new InvalidOperationException(
                    "当前关卡没有可用词汇，请检查词库导入状态。");
            }
            var baseMonsterCount = Math.Min(words.Count, 10);
            var objectiveCount =
                selection.Difficulty.MonsterCount(baseMonsterCount);
            if (selection.Level.Boss != null &&
                !selection.Level.IsTutorial)
            {
                objectiveCount += BossState.AdjustForDifficulty(
                    selection.Level.Boss,
                    selection.Difficulty).BaseHitPoints;
            }
            var domainWords = words
                .Take(Math.Max(1, Math.Min(words.Count, objectiveCount)))
                .Select(ToDomainWord)
                .ToArray();
            session = new GameSession(
                selection.Level.Chapter,
                selection.Level.Id,
                domainWords,
                selection.Difficulty,
                DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
            if (selection.Level.IsTutorial)
                session.EnableTutorialMode();

            world.Build(
                selection.Level,
                selection.Level.Chapter * 10000 + selection.Level.Id,
                selection.Difficulty);
            if (dailySession != null)
            {
                var targets = world.GetComponentsInChildren<EncounterController>()
                    .Where(x => x.Kind == EncounterKind.Monster).OrderBy(x => x.Id).ToArray();
                for (var index = 0; index < targets.Length; index++)
                    encounterWords[targets[index].Id] = domainWords[index];
            }
            boss = world.ConfigureBoss(selection.Level, session);
            if (boss != null)
            {
                boss.Defeated += () => BossDefeated?.Invoke();
                BossAppeared?.Invoke();
            }
            world.SetSimulationEnabled(true);
            SessionChanged?.Invoke(session.Snapshot);
        }

        public async Task SubmitAnswerAsync(QuizAnswer answer, CancellationToken token)
        {
            if (disposed || finishing || submitting || !awaitingAnswer) return;
            submitting = true;
            awaitingAnswer = false;
            try { await SubmitAnswerCoreAsync(answer, token); }
            catch (Exception)
            {
                if (!disposed && !token.IsCancellationRequested)
                {
                    awaitingAnswer = true;
                    AnswerSaveFailed?.Invoke("答案暂未保存，请重试或稍后复习。");
                }
            }
            finally { submitting = false; }
        }

        private async Task SubmitAnswerCoreAsync(
            QuizAnswer answer,
            CancellationToken token)
        {
            if (answer == null)
                throw new ArgumentNullException(nameof(answer));
            if (session?.CurrentWord == null)
                return;

            var answeredBoss = bossQuestion;
            var domainWord = questionWord ?? session.CurrentWord;
            var word = words.FirstOrDefault(item =>
                (string.IsNullOrEmpty(item._id) ? item.wordId : item._id) ==
                domainWord.Id);
            var effectiveDifficulty =
                adaptive.EffectiveDifficulty(domainWord.Difficulty);
            var localScore = ScoringPolicy.Calculate(
                answer.Correct,
                answer.ResponseMs,
                session.Snapshot.Combo,
                effectiveDifficulty,
                answer.HintUsed,
                answer.ScoreRatio);

            if (pendingRequest == null)
            {
                pendingRequest = LearningAttempt.Create(word, activeQuestion, activeEncounterId,
                    session.Snapshot.SessionId, selection.WordbookId, session.Snapshot.Chapter,
                    session.Snapshot.Level, answer.Value, answer.ResponseMs);
                pendingRequest.recommendedType = LearningAttempt.ApiType(recommendedType);
                pendingRequest.wasDowngraded = questionDowngraded;
                pendingRequest.difficulty = effectiveDifficulty;
                pendingRequest.combo = session.Snapshot.Combo;
                pendingRequest.isCorrect = answer.Correct;
                pendingRequest.sourceMode = dailySession != null ? "daily" : answeredBoss ? "boss" : "mainline";
                pendingRequest.timeLimit = answeredBoss ? session.Snapshot.TimerMs : 0;
                pendingRequest.dailySessionId = dailySession?.sessionId;
                pendingAnswer = answer;
            }
            pending.RememberQuiz(userId, pendingRequest);
            var record = await learning.SubmitQuizRecordAsync(pendingRequest, token);
            if (record.IsSuccess && record.Data != null && record.Data.serverVerified)
            {
                pending.RemoveQuiz(userId, pendingRequest.attemptId);
                firstRequest = pendingRequest;
                pendingRequest = null;
                firstSaved = true;
            }
            if (disposed || token.IsCancellationRequested) return;
            if (!record.IsSuccess || record.Data == null || !record.Data.serverVerified)
            {
                awaitingAnswer = true;
                AnswerSaveFailed?.Invoke("答案暂未保存，请重试或稍后复习。");
                return;
            }
            var hasServerRecord =
                record.IsSuccess && record.Data != null;
            var correct = hasServerRecord
                ? record.Data.serverIsCorrect
                : answer.Correct;
            var score = ScoringPolicy.ApplyDifficulty(
                hasServerRecord
                    ? record.Data.serverScore
                    : localScore,
                selection.Difficulty);
            if (hasServerRecord &&
                record.Data.adaptiveDifficulty != null)
            {
                suggestedQuestionType =
                    QuizRotation.ParseServerSuggestion(
                        record.Data.adaptiveDifficulty.questionType,
                        QuizRotation.ForAnsweredCount(
                            session.Snapshot.AnsweredCount + 1));
            }
            AnswerEvaluated?.Invoke(correct);
            adaptive.Record(correct);
            if (answeredBoss)
            {
                boss?.SubmitQuizResult(correct);
                bossQuestion = false;
                if (!correct)
                    deferredBossWrongAnswers++;
            }
            if (answeredBoss)
            {
                world.ResolveEncounter(activeEncounter, correct);
                activeEncounter = null;
            }
            else
            {
                ordinaryCorrect = correct;
                feedbackWord = word;
            }

            var outcome = session.SubmitAnswer(
                correct,
                answer.ResponseMs,
                score,
                false);
            if (answeredBoss && adaptive.ConsecutiveErrors >= 3)
                session.TryGrantGraceLife();

            var status = outcome.Status;
            continueBossBattle =
                answeredBoss &&
                boss != null &&
                boss.CurrentHitPoints > 0;
            if (answeredBoss && !continueBossBattle)
            {
                status = session.ApplyLifeLosses(
                    deferredBossWrongAnswers);
                deferredBossWrongAnswers = 0;
            }

            SessionChanged?.Invoke(session.Snapshot);
            if (status == SessionStatus.GameOver ||
                world.ObjectivesComplete)
            {
                continueBossBattle = false;
                await FinishAsync(
                    token,
                    LevelSettlementPolicy.ShouldPersistProgress(
                        status,
                        world.ObjectivesComplete));
                return;
            }

            if (!correct && WrongAnswerTutorRequested != null)
            {
                quizOpen = true;
                WrongAnswerTutorRequested.Invoke(
                    word,
                    BuildWrongAnswerContext(
                        answer,
                        word,
                        hasServerRecord ? record.Data : null));
                return;
            }

            if (correct && CorrectAnswerFeedbackRequested != null)
            {
                quizOpen = true;
                CorrectAnswerFeedbackRequested.Invoke(word);
                return;
            }

            ResumeAfterTutor();
        }

        public void PauseForFocusLoss()
        {
            if (disposed || paused || quizOpen) return;
            TogglePause();
        }

        public void TogglePause()
        {
            if (disposed || quizOpen || submitting) return;
            paused = !paused;
            world.SetSimulationEnabled(!paused && !quizOpen);
            PauseChanged?.Invoke(paused);
        }

        public void ResumeAfterNpc()
        {
            var npcEncounter = activeEncounter;
            activeEncounter = null;
            quizOpen = false;
            continueBossBattle = false;
            world.SetSimulationEnabled(!paused);
            if (npcEncounter?.Kind == EncounterKind.Npc)
                world.CooldownEncounter(npcEncounter, 2f);
        }

        public void ResumeAfterTutor()
        {
            if (disposed || finishing) return;
            if (activeEncounter?.Kind == EncounterKind.Monster)
            {
                _ = CompleteOrdinaryEncounterAsync(ordinaryCorrect);
                return;
            }
            activeEncounter = null;
            quizOpen = false;
            if (continueBossBattle)
            {
                continueBossBattle = false;
                PresentQuestion(true);
                return;
            }
            world.SetSimulationEnabled(!paused);
        }

        public void RetryCurrentQuestion()
        {
            if (disposed || submitting || feedbackSaving) return;
            if (feedbackPending) { _ = CompleteOrdinaryEncounterAsync(pendingDefeated); return; }
            if (dailySession != null && world.ObjectivesComplete) { _ = FinishAsync(activeToken, true); return; }
            if (!quizOpen) return;
            if (pendingRequest != null)
            {
                awaitingAnswer = true;
                _ = SubmitAnswerAsync(pendingAnswer, activeToken);
            }
            else PresentQuestion(bossQuestion);
        }

        public void SkipEncounter()
        {
            if (disposed || submitting || feedbackSaving || activeEncounter?.Kind != EncounterKind.Monster) return;
            ordinaryCorrect = false;
            _ = CompleteOrdinaryEncounterAsync(false);
        }

        public async Task<bool> CompleteCorrectionAsync(string answer, int responseMs = 0)
        {
            if (disposed || submitting || ordinaryCorrect || feedbackWord == null || firstRequest == null ||
                activeEncounter?.Kind != EncounterKind.Monster) return false;
            submitting = true;
            try
            {
                if (correctionRequest == null) correctionRequest = LearningAttempt.Correction(firstRequest, answer, responseMs);
                pending.RememberQuiz(userId, correctionRequest);
                var response = await learning.SubmitQuizRecordAsync(correctionRequest, activeToken);
                if (!response.IsSuccess || response.Data == null || !response.Data.serverVerified) throw new InvalidOperationException("纠正暂未保存，请重试");
                pending.RemoveQuiz(userId, correctionRequest.attemptId);
                if (disposed) return false;
                var correct = response.Data.serverIsCorrect;
                if (correct) await CompleteOrdinaryEncounterAsync(true);
                return correct;
            }
            finally { submitting = false; }
        }

        public void LeaveFeedback() { if (!submitting) _ = CompleteOrdinaryEncounterAsync(false); }

        private async Task CompleteOrdinaryEncounterAsync(bool defeated)
        {
            var encounter = activeEncounter;
            if (encounter == null || feedbackSaving) return;
            if (dailySession != null && firstSaved)
            {
                feedbackPending = true;
                pendingDefeated = defeated;
                feedbackSaving = true;
                try
                {
                    var wordId = firstRequest.wordId;
                    var response = await dailyService.AcknowledgeAsync(dailySession.sessionId, wordId, activeToken);
                    if (disposed || activeToken.IsCancellationRequested) return;
                    if (!response.IsSuccess || response.Data == null)
                    {
                        if (submitting) throw new InvalidOperationException("反馈进度暂未保存，请重试。");
                        AnswerSaveFailed?.Invoke("首答已保存，反馈进度暂未同步。可重试保存或返回主页后继续。");
                        return;
                    }
                    dailySession.completedWordIds = response.Data.completedWordIds;
                    dailySession.pendingFeedback = response.Data.pendingFeedback;
                    feedbackPending = false;
                    SessionChanged?.Invoke(session.Snapshot);
                }
                finally { feedbackSaving = false; }
            }
            activeEncounter = null;
            questionGeneration++;
            questionLoad?.Cancel();
            feedbackWord = null;
            awaitingAnswer = false;
            world.ResolveEncounter(encounter, defeated || (dailySession != null && firstSaved));
            quizOpen = false;
            if (world.ObjectivesComplete)
            {
                await FinishAsync(activeToken, true);
                return;
            }
            world.SetSimulationEnabled(!paused);
        }

        public WordDto TryPauseForManualTutor()
        {
            if (disposed || finishing || paused || quizOpen || session?.CurrentWord == null)
                return null;
            var word = words.FirstOrDefault(item =>
                (string.IsNullOrEmpty(item._id) ? item.wordId : item._id) ==
                session.CurrentWord.Id);
            if (word == null)
                return null;
            quizOpen = true;
            world.SetSimulationEnabled(false);
            return word;
        }

        public void Dispose()
        {
            if (disposed) return;
            disposed = true;
            questionGeneration++;
            questionLoad?.Cancel();
            flowLifetime.Cancel();
            awaitingAnswer = false;
            world.SetSimulationEnabled(false);
            world.Encountered -= OnEncountered;
            world.BossPlayerDamaged -= OnBossPlayerDamaged;
        }

        private void OnEncountered(Encounter encounter)
        {
            if (disposed || finishing || paused || quizOpen || session?.CurrentWord == null)
                return;

            quizOpen = true;
            activeEncounter = encounter;
            activeEncounterId = Guid.NewGuid().ToString("N");
            firstSaved = false;
            feedbackPending = false;
            pendingRequest = null;
            firstRequest = null;
            correctionRequest = null;
            world.SetSimulationEnabled(false);
            var dto = words.First(item =>
                (string.IsNullOrEmpty(item._id) ? item.wordId : item._id) ==
                session.CurrentWord.Id);
            if (encounter.Kind == EncounterKind.Npc)
            {
                NpcRequested?.Invoke(dto);
                return;
            }

            PresentQuestion(encounter.Kind == EncounterKind.Boss);
        }

        private async void PresentQuestion(bool isBoss)
        {
            if (disposed || session?.CurrentWord == null) return;
            var generation = ++questionGeneration;
            questionLoad?.Cancel();
            questionLoad?.Dispose();
            questionLoad = CancellationTokenSource.CreateLinkedTokenSource(activeToken, flowLifetime.Token);
            if (isBoss) activeEncounterId = Guid.NewGuid().ToString("N");
            pendingRequest = null;
            firstRequest = null;
            correctionRequest = null;
            firstSaved = false;
            quizOpen = true;
            bossQuestion = isBoss;
            world.SetSimulationEnabled(false);
            var selectedWord = session.CurrentWord;
            if (!isBoss && activeEncounter?.Kind == EncounterKind.Monster)
            {
                if (!encounterWords.TryGetValue(activeEncounter.Id, out selectedWord))
                {
                    selectedWord = session.CurrentWord;
                    encounterWords[activeEncounter.Id] = selectedWord;
                }
            }
            questionWord = selectedWord;
            var dto = words.First(item =>
                (string.IsNullOrEmpty(item._id) ? item.wordId : item._id) ==
                selectedWord.Id);
            var requested = suggestedQuestionType ??
                            QuizRotation.ForAnsweredCount(
                                session.Snapshot.AnsweredCount);
            recommendedType = requested;
            var presented = adaptive.Select(requested);
            QuestionLoading?.Invoke(!isBoss);
            QuizQuestion question;
            try
            {
                using (var linked = CancellationTokenSource.CreateLinkedTokenSource(questionLoad.Token))
                {
                    var remote = await vocabulary.GetQuizAsync(selectedWord.Id, LearningAttempt.ApiType(presented), linked.Token);
                    if (disposed || activeToken.IsCancellationRequested || generation != questionGeneration) return;
                    question = remote.IsSuccess && remote.Data != null
                        ? QuizFactory.FromServer(dto, presented, remote.Data)
                        : QuizFactory.Create(dto, presented, words);
                    questionDowngraded = !remote.IsSuccess || question.Type != requested;
                }
            }
            catch (OperationCanceledException) { return; }
            catch (Exception)
            {
                if (disposed || activeToken.IsCancellationRequested || generation != questionGeneration) return;
                question = QuizFactory.Create(dto, presented, words);
                questionDowngraded = true;
            }
            activeQuestion = question;
            if (isBoss && boss != null)
            {
                question = new QuizQuestion(
                    question.WordId,
                    question.Type,
                    $"Boss HP {boss.CurrentHitPoints}/{boss.MaximumHitPoints} · {question.Prompt}",
                    question.CorrectAnswer,
                    question.Options);
            }
            awaitingAnswer = true;
            QuestionReady?.Invoke(question);
        }

        private async Task FinishAsync(
            CancellationToken token,
            bool completed)
        {
            if (finishing)
                return;
            finishing = true;
            world.SetSimulationEnabled(false);
            if (dailySession != null)
            {
                var response = await dailyService.ReadAsync(dailySession.sessionId, token);
                if (disposed) return;
                if (response.IsSuccess && response.Data != null) DailyFinished?.Invoke(response.Data);
                else { finishing = false; AnswerSaveFailed?.Invoke("本轮答案已提交，完成状态暂未取回。返回主页可恢复。"); }
                return;
            }
            var result = session.Finish(
                DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
            await settlement.SettleAsync(
                result,
                completed,
                selection.WordbookId,
                userId,
                token);
            if (!disposed && !token.IsCancellationRequested) Finished?.Invoke(result);
        }

        private async void OnBossPlayerDamaged()
        {
            if (finishing || paused || quizOpen || session == null)
                return;

            var status = session.LoseLife();
            SessionChanged?.Invoke(session.Snapshot);
            if (status == SessionStatus.GameOver)
                await FinishAsync(activeToken, false);
        }

        private static Word ToDomainWord(WordDto value)
        {
            return new Word(
                string.IsNullOrEmpty(value._id) ? value.wordId : value._id,
                value.word,
                value.meaning,
                value.phonetic,
                value.example,
                value.difficulty);
        }

        private WrongAnswerTutorContext BuildWrongAnswerContext(
            QuizAnswer answer,
            WordDto word,
            QuizRecordResultDto result)
        {
            var stats = result?.adaptiveDifficulty?.stats;
            return new WrongAnswerTutorContext
            {
                PlayerAnswer = answer.Value ?? string.Empty,
                CorrectAnswer =
                    answer.Type == QuestionType.ChoiceEnglishToChinese
                        ? word?.meaning ?? string.Empty
                        : word?.word ?? string.Empty,
                AnswerQuality = string.IsNullOrWhiteSpace(
                    result?.answerQuality)
                        ? "wrong"
                        : result.answerQuality,
                EditDistance = result?.editDistance ?? 0,
                Similarity = result?.similarity ?? 0f,
                FuzzyFeedback = string.IsNullOrWhiteSpace(
                    result?.fuzzyFeedback)
                        ? "这道题需要再巩固一次。"
                        : result.fuzzyFeedback,
                CorrectStreak = stats?.consecutiveCorrect ?? 0,
                WrongStreak = stats?.consecutiveWrong ??
                              adaptive.ConsecutiveErrors
            };
        }

        private static string ToApiQuestionType(QuestionType type)
        {
            switch (type)
            {
                case QuestionType.ChoiceChineseToEnglish:
                    return "choice_cn2en";
                case QuestionType.SpellHint:
                    return "spell_hint";
                case QuestionType.SpellFull:
                    return "spell_full";
                case QuestionType.Translate:
                    return "translate";
                case QuestionType.Pronunciation:
                    return "pronunciation";
                default:
                    return "choice_en2cn";
            }
        }
    }
}
