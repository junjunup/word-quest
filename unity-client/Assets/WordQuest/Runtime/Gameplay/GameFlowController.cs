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
        public LevelSelection(LevelDefinition level, Difficulty difficulty)
        {
            Level = level ?? throw new ArgumentNullException(nameof(level));
            Difficulty = difficulty ??
                         throw new ArgumentNullException(nameof(difficulty));
        }

        public LevelDefinition Level { get; }
        public Difficulty Difficulty { get; }
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

    public sealed class GameFlowController : IDisposable
    {
        private readonly IVocabularyService vocabulary;
        private readonly ILearningService learning;
        private readonly IGameService game;
        private readonly PendingSyncQueue pending;
        private readonly WorldController world;
        private readonly AdaptiveQuizPolicy adaptive = new AdaptiveQuizPolicy();
        private readonly List<WordDto> words = new List<WordDto>();
        private LevelSelection selection;
        private GameSession session;
        private bool paused;
        private bool quizOpen;
        private BossController boss;
        private bool bossQuestion;

        public GameFlowController(
            IVocabularyService vocabulary,
            ILearningService learning,
            IGameService game,
            PendingSyncQueue pending,
            WorldController world)
        {
            this.vocabulary = vocabulary ??
                              throw new ArgumentNullException(nameof(vocabulary));
            this.learning = learning ??
                            throw new ArgumentNullException(nameof(learning));
            this.game = game ?? throw new ArgumentNullException(nameof(game));
            this.pending = pending ??
                           throw new ArgumentNullException(nameof(pending));
            this.world = world ?? throw new ArgumentNullException(nameof(world));
            world.Encountered += OnEncountered;
        }

        public event Action<GameSessionSnapshot> SessionChanged;
        public event Action<QuizQuestion> QuestionReady;
        public event Action<LevelResult> Finished;
        public event Action<bool> PauseChanged;

        public GameSessionSnapshot Snapshot => session?.Snapshot;

        public async Task StartLevelAsync(
            LevelSelection levelSelection,
            CancellationToken token)
        {
            selection = levelSelection ??
                        throw new ArgumentNullException(nameof(levelSelection));
            var response = await vocabulary.GetLevelWordsAsync(
                selection.Level.Chapter,
                selection.Level.Id,
                "cet4",
                token);
            if (!response.IsSuccess)
                throw new InvalidOperationException(response.Message);

            words.Clear();
            words.AddRange(response.Data ?? Array.Empty<WordDto>());
            var domainWords = words.Select(ToDomainWord).ToArray();
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
                selection.Level.Chapter * 10000 + selection.Level.Id);
            boss = world.ConfigureBoss(selection.Level, session);
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
                    wordbookId = word?.wordbookId ?? "cet4",
                    questionType = ToApiQuestionType(answer.Type),
                    sourceMode = "mainline",
                    isCorrect = answer.Correct,
                    responseTime = answer.ResponseMs,
                    timeLimit = session.Snapshot.TimerMs,
                    difficulty = effectiveDifficulty,
                    hintUsed = answer.HintUsed,
                    sessionId = session.Snapshot.SessionId,
                    chapter = session.Snapshot.Chapter,
                    level = session.Snapshot.Level,
                    playerAnswer = answer.Value,
                    correctAnswer = domainWord.Text,
                    combo = session.Snapshot.Combo,
                    scoreRatio = (float)answer.ScoreRatio
                },
                token);

            var correct = record.IsSuccess
                ? record.Data.serverIsCorrect
                : answer.Correct;
            var score = record.IsSuccess
                ? record.Data.serverScore
                : localScore;
            adaptive.Record(correct);
            if (bossQuestion)
            {
                boss?.SubmitQuizResult(correct);
                bossQuestion = false;
            }

            var outcome = session.SubmitAnswer(correct, answer.ResponseMs, score);
            if (adaptive.ConsecutiveErrors >= 3)
                session.TryGrantGraceLife();

            quizOpen = false;
            SessionChanged?.Invoke(outcome.Snapshot);
            if (outcome.Status == SessionStatus.GameOver ||
                outcome.Snapshot.AnsweredCount >= outcome.Snapshot.WordCount)
            {
                await FinishAsync(token);
                return;
            }

            world.SetSimulationEnabled(!paused);
        }

        public void TogglePause()
        {
            paused = !paused;
            world.SetSimulationEnabled(!paused && !quizOpen);
            PauseChanged?.Invoke(paused);
        }

        public void Dispose()
        {
            world.Encountered -= OnEncountered;
        }

        private void OnEncountered(Encounter encounter)
        {
            if (paused || quizOpen || session?.CurrentWord == null)
                return;

            quizOpen = true;
            bossQuestion = encounter.Kind == EncounterKind.Boss;
            world.SetSimulationEnabled(false);
            var dto = words.First(item =>
                (string.IsNullOrEmpty(item._id) ? item.wordId : item._id) ==
                session.CurrentWord.Id);
            var requested = session.Snapshot.Combo >= 5
                ? QuestionType.SpellFull
                : QuestionType.ChoiceEnglishToChinese;
            QuestionReady?.Invoke(
                QuizFactory.Create(dto, adaptive.Select(requested), words));
        }

        private async Task FinishAsync(CancellationToken token)
        {
            world.SetSimulationEnabled(false);
            var result = session.Finish(
                DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
            var request = new SaveProgressRequest
            {
                chapter = result.Chapter,
                level = result.Level,
                stars = result.Stars,
                score = result.Score,
                sessionId = result.SessionId,
                wordbookId = "cet4"
            };
            var saved = await game.SaveProgressAsync(request, token);
            if (!saved.IsSuccess)
            {
                pending.Enqueue(new PendingSubmission
                {
                    id = Guid.NewGuid().ToString("N"),
                    route = ApiRoutes.SaveProgress,
                    method = UnityWebRequest.kHttpVerbPOST,
                    jsonBody = JsonUtility.ToJson(request),
                    createdAtUnixMs =
                        DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
                });
            }

            Finished?.Invoke(result);
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
