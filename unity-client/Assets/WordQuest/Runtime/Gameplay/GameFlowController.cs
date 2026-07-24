using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.Networking;
using WordQuest.Application.Quiz;
using WordQuest.Content;
using WordQuest.Domain.Game;
using WordQuest.Domain.Quiz;
using WordQuest.Infrastructure.Api;
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
        private readonly IGameService game;
        private readonly PendingSyncQueue pending;
        private readonly WorldController world;
        private readonly string userId;
        private readonly AdaptiveQuizPolicy adaptive = new AdaptiveQuizPolicy();
        private readonly List<WordDto> words = new List<WordDto>();
        private LevelSelection selection;
        private GameSession session;
        private bool paused;
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
            string userId)
        {
            this.vocabulary = vocabulary ??
                              throw new ArgumentNullException(nameof(vocabulary));
            this.learning = learning ??
                            throw new ArgumentNullException(nameof(learning));
            this.game = game ?? throw new ArgumentNullException(nameof(game));
            this.pending = pending ??
                           throw new ArgumentNullException(nameof(pending));
            this.world = world ?? throw new ArgumentNullException(nameof(world));
            this.userId = string.IsNullOrWhiteSpace(userId)
                ? throw new ArgumentException(
                    "A signed-in user is required for game progress.",
                    nameof(userId))
                : userId.Trim();
            world.Encountered += OnEncountered;
            world.BossPlayerDamaged += OnBossPlayerDamaged;
        }

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
            CancellationToken token)
        {
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
            var response = await vocabulary.GetLevelWordsAsync(
                selection.Level.Chapter,
                selection.Level.Id,
                selection.WordbookId,
                token);
            if (!response.IsSuccess)
                throw new InvalidOperationException(response.Message);

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
            boss = world.ConfigureBoss(selection.Level, session);
            if (boss != null)
            {
                boss.Defeated += () => BossDefeated?.Invoke();
                BossAppeared?.Invoke();
            }
            world.SetSimulationEnabled(true);
            SessionChanged?.Invoke(session.Snapshot);
        }

        public async Task SubmitAnswerAsync(
            QuizAnswer answer,
            CancellationToken token)
        {
            if (answer == null)
                throw new ArgumentNullException(nameof(answer));
            if (session?.CurrentWord == null)
                return;

            var answeredBoss = bossQuestion;
            var domainWord = session.CurrentWord;
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

            var record = await learning.SubmitQuizRecordAsync(
                new QuizRecordRequest
                {
                    wordId = domainWord.Id,
                    word = domainWord.Text,
                    wordbookId = word?.wordbookId ?? selection.WordbookId,
                    questionType = ToApiQuestionType(answer.Type),
                    sourceMode = answeredBoss ? "boss" : "mainline",
                    isCorrect = answer.Correct,
                    responseTime = answer.ResponseMs,
                    timeLimit = session.Snapshot.TimerMs,
                    difficulty = effectiveDifficulty,
                    hintUsed = answer.HintUsed,
                    sessionId = session.Snapshot.SessionId,
                    chapter = session.Snapshot.Chapter,
                    level = session.Snapshot.Level,
                    playerAnswer = answer.Value,
                    correctAnswer =
                        answer.Type == QuestionType.ChoiceEnglishToChinese
                            ? domainWord.Meaning
                            : domainWord.Text,
                    combo = session.Snapshot.Combo,
                    scoreRatio = (float)answer.ScoreRatio
                },
                token);

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
            world.ResolveEncounter(activeEncounter, correct);
            activeEncounter = null;

            var outcome = session.SubmitAnswer(
                correct,
                answer.ResponseMs,
                score,
                !answeredBoss);
            if (adaptive.ConsecutiveErrors >= 3)
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

        public void TogglePause()
        {
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

        public WordDto TryPauseForManualTutor()
        {
            if (paused || quizOpen || session?.CurrentWord == null)
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
            world.Encountered -= OnEncountered;
            world.BossPlayerDamaged -= OnBossPlayerDamaged;
        }

        private void OnEncountered(Encounter encounter)
        {
            if (paused || quizOpen || session?.CurrentWord == null)
                return;

            quizOpen = true;
            activeEncounter = encounter;
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

        private void PresentQuestion(bool isBoss)
        {
            if (session?.CurrentWord == null)
                return;

            quizOpen = true;
            bossQuestion = isBoss;
            world.SetSimulationEnabled(false);
            var dto = words.First(item =>
                (string.IsNullOrEmpty(item._id) ? item.wordId : item._id) ==
                session.CurrentWord.Id);
            var requested = suggestedQuestionType ??
                            QuizRotation.ForAnsweredCount(
                                session.Snapshot.AnsweredCount);
            var question =
                QuizFactory.Create(dto, adaptive.Select(requested), words);
            if (isBoss && boss != null)
            {
                question = new QuizQuestion(
                    question.WordId,
                    question.Type,
                    $"Boss HP {boss.CurrentHitPoints}/{boss.MaximumHitPoints} · {question.Prompt}",
                    question.CorrectAnswer,
                    question.Options);
            }
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
            var result = session.Finish(
                DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
            result.LevelCompleted = completed;
            if (!completed)
            {
                Finished?.Invoke(result);
                return;
            }
            var request = new SaveProgressRequest
            {
                chapter = result.Chapter,
                level = result.Level,
                stars = result.Stars,
                score = result.Score,
                sessionId = result.SessionId,
                wordbookId = selection.WordbookId
            };
            var saved = await game.SaveProgressAsync(request, token);
            result.ProgressSaved = saved.IsSuccess;
            result.ProgressPending =
                PendingSettlementSync.ShouldRetry(saved);
            if (result.ProgressSaved || result.ProgressPending)
            {
                result.SettlementId = Guid.NewGuid().ToString("N");
                pending.Enqueue(
                    userId,
                    new PendingSubmission
                    {
                        id = result.SettlementId,
                        userId = userId,
                        route = ApiRoutes.SaveProgress,
                        method = UnityWebRequest.kHttpVerbPOST,
                        jsonBody = JsonUtility.ToJson(request),
                        createdAtUnixMs =
                            DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                        progressSaved = result.ProgressSaved,
                        achievementEvidence =
                            AchievementRunEvidence.From(
                                result,
                                selection.WordbookId)
                    });
            }

            Finished?.Invoke(result);
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
