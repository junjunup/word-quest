using System;
using System.Threading;
using System.Threading.Tasks;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;
using WordQuest.Content;
using WordQuest.Application;
using WordQuest.Domain.Game;
using WordQuest.Gameplay;
using WordQuest.Infrastructure.Api;
using WordQuest.Infrastructure.Api.Dto;
using WordQuest.Infrastructure.Api.Services;
using WordQuest.Infrastructure.Storage;

namespace WordQuest.Tests
{
    internal sealed class FakeVocabularyService : IVocabularyService
    {
        public WordDto[] Words = { new WordDto { _id = "1", word = "river", meaning = "河流" }, new WordDto { _id = "2", word = "garden", meaning = "花园" } };
        public Task<ApiResult<WordDto[]>> GetLevelWordsAsync(int chapter, int level, string wordbookId, CancellationToken token) => Task.FromResult(ApiResult<WordDto[]>.Success(200, Words));
        public Task<ApiResult<WordDto[]>> GetChapterWordsAsync(int chapter, string wordbookId, CancellationToken token) => Task.FromResult(ApiResult<WordDto[]>.Failure(503, "Test service not configured"));
        public Func<CancellationToken, Task<ApiResult<QuizDto>>> Quiz;
        public Task<ApiResult<QuizDto>> GetQuizAsync(string wordId, string questionType, CancellationToken token) => Quiz != null ? Quiz(token) : Task.FromResult(ApiResult<QuizDto>.Failure(503, "Test service not configured"));
        public Task<ApiResult<WordDto[]>> SearchAsync(string query, CancellationToken token) => Task.FromResult(ApiResult<WordDto[]>.Failure(503, "Test service not configured"));
        public Task<ApiResult<WordbookDto[]>> GetWordbooksAsync(CancellationToken token) => Task.FromResult(ApiResult<WordbookDto[]>.Failure(503, "Test service not configured"));
        public Task<ApiResult<VocabularyStatsDto>> GetStatsAsync(string wordbookId, CancellationToken token) => Task.FromResult(ApiResult<VocabularyStatsDto>.Failure(503, "Test service not configured"));
        public Task<ApiResult<VocabularyImportDto>> ImportAsync(VocabularyImportRequest request, CancellationToken token) => Task.FromResult(ApiResult<VocabularyImportDto>.Failure(503, "Test service not configured"));
        public Task<ApiResult<VocabularySourceManifestDto>> GetSourceManifestAsync(CancellationToken token) => Task.FromResult(ApiResult<VocabularySourceManifestDto>.Failure(503, "Test service not configured"));
    }
    internal sealed class FakeLearningService : ILearningService
    {
        public Func<QuizRecordRequest, Task<ApiResult<QuizRecordResultDto>>> Submit = request => Task.FromResult(ApiResult<QuizRecordResultDto>.Success(200, new QuizRecordResultDto { serverVerified = true, serverIsCorrect = request.attemptPhase == "correction" ? request.playerAnswer == "river" : request.isCorrect, serverScore = request.isCorrect ? 100 : 0 }));
        public Task<ApiResult<QuizRecordResultDto>> SubmitQuizRecordAsync(QuizRecordRequest request, CancellationToken token) => Submit(request);
        public Task<ApiResult<WordDto[]>> GetTodayReviewAsync(int limit, string wordbookId, CancellationToken token) => Task.FromResult(ApiResult<WordDto[]>.Failure(503, "Test service not configured"));
        public Task<ApiResult<MasterySummaryDto>> GetMasterySummaryAsync(string wordbookId, CancellationToken token) => Task.FromResult(ApiResult<MasterySummaryDto>.Failure(503, "Test service not configured"));
        public Task<ApiResult<MasteryWordDto[]>> GetMasteryWordsAsync(string wordbookId, string mode, int limit, CancellationToken token) => Task.FromResult(ApiResult<MasteryWordDto[]>.Failure(503, "Test service not configured"));
        public Task<ApiResult<ReviewSessionDto>> CreateReviewSessionAsync(ReviewSessionRequest request, CancellationToken token) => Task.FromResult(ApiResult<ReviewSessionDto>.Failure(503, "Test service not configured"));
        public Task<ApiResult<ReviewSessionDto>> SubmitReviewSessionAsync(string sessionId, ReviewSubmissionRequest request, CancellationToken token) => Task.FromResult(ApiResult<ReviewSessionDto>.Failure(503, "Test service not configured"));
        public Task<ApiResult<LearningStatsDto>> GetStatsAsync(string wordbookId, CancellationToken token) => Task.FromResult(ApiResult<LearningStatsDto>.Failure(503, "Test service not configured"));
        public Task<ApiResult<ErrorTypeStatsDto>> GetErrorTypesAsync(string wordbookId, int days, CancellationToken token) => Task.FromResult(ApiResult<ErrorTypeStatsDto>.Failure(503, "Test service not configured"));
        public Task<ApiResult<DailyStatDto[]>> GetDailyStatsAsync(int days, CancellationToken token) => Task.FromResult(ApiResult<DailyStatDto[]>.Failure(503, "Test service not configured"));
        public Task<ApiResult<ChapterStatDto[]>> GetChapterStatsAsync(CancellationToken token) => Task.FromResult(ApiResult<ChapterStatDto[]>.Failure(503, "Test service not configured"));
        public Task<ApiResult<MistakeDto[]>> GetTopMistakesAsync(int limit, CancellationToken token) => Task.FromResult(ApiResult<MistakeDto[]>.Failure(503, "Test service not configured"));
        public Task<ApiResult<HeatmapEntryDto[]>> GetHeatmapAsync(int year, CancellationToken token) => Task.FromResult(ApiResult<HeatmapEntryDto[]>.Failure(503, "Test service not configured"));
    }
    internal sealed class FakeGameService : IGameService
    {
        public Task<ApiResult<ProgressDto>> GetProgressAsync(CancellationToken token) => Task.FromResult(ApiResult<ProgressDto>.Failure(503, "Test service not configured"));
        public Task<ApiResult<ProgressDto>> SaveProgressAsync(SaveProgressRequest request, CancellationToken token) => Task.FromResult(ApiResult<ProgressDto>.Failure(503, "Test service not configured"));
        public Task<ApiResult<LeaderboardEntryDto[]>> GetLeaderboardAsync(string type, CancellationToken token) => Task.FromResult(ApiResult<LeaderboardEntryDto[]>.Failure(503, "Test service not configured"));
        public Task<ApiResult<AchievementDto[]>> GetAchievementsAsync(CancellationToken token) => Task.FromResult(ApiResult<AchievementDto[]>.Failure(503, "Test service not configured"));
        public Task<ApiResult<AchievementDto[]>> SaveAchievementAsync(AchievementRequest request, CancellationToken token) => Task.FromResult(ApiResult<AchievementDto[]>.Failure(503, "Test service not configured"));
        public Task<ApiResult<DailyRewardDto>> ClaimDailyRewardAsync(CancellationToken token) => Task.FromResult(ApiResult<DailyRewardDto>.Failure(503, "Test service not configured"));
        public Task<ApiResult<UserDto>> UpdateCharacterAsync(int characterIndex, CancellationToken token) => Task.FromResult(ApiResult<UserDto>.Failure(503, "Test service not configured"));
        public Task<ApiResult<LevelsStatusDto>> GetLevelsStatusAsync(string wordbookId, CancellationToken token) => Task.FromResult(ApiResult<LevelsStatusDto>.Failure(503, "Test service not configured"));
        public Task<ApiResult<EndlessScoreDto>> SubmitEndlessScoreAsync(int score, int maximumStreak, CancellationToken token) => Task.FromResult(ApiResult<EndlessScoreDto>.Failure(503, "Test service not configured"));
        public Task<ApiResult<EndlessScoreDto>> GetEndlessBestAsync(CancellationToken token) => Task.FromResult(ApiResult<EndlessScoreDto>.Failure(503, "Test service not configured"));
    }
    internal sealed class EncounterMemoryStore : IKeyValueStore
    {
        private readonly Dictionary<string, string> values = new Dictionary<string, string>();
        public string GetString(string key, string fallback = "") => values.TryGetValue(key, out var value) ? value : fallback;
        public void SetString(string key, string value) { values[key] = value; }
        public void DeleteKey(string key) { values.Remove(key); }
        public void Save() { }
        public bool HasKey(string key) => values.ContainsKey(key);
    }

    public sealed class GameFlowEncounterTests
    {
        private GameObject host;
        private WorldController world;
        private GameFlowController flow;
        private FakeLearningService learning;
        private EncounterController monster;

        private IEnumerator Begin(FakeVocabularyService vocabulary = null)
        {
            host = new GameObject("Flow regression");
            world = host.AddComponent<WorldController>();
            learning = new FakeLearningService();
            flow = new GameFlowController(vocabulary ?? new FakeVocabularyService(), learning,
                new FakeGameService(), new PendingSyncQueue(new EncounterMemoryStore()), world, "test-user");
            var start = flow.StartLevelAsync(new LevelSelection(
                new LevelDefinition(1, 2, "Test", 1, "test", string.Empty, null, false),
                Difficulty.For(DifficultyKind.Normal)), CancellationToken.None);
            yield return new WaitUntil(() => start.IsCompleted);
            Assert.That(start.IsFaulted, Is.False);
            var player = host.GetComponentInChildren<PlayerController>();
            player.transform.position = Vector3.zero;
            var targets = host.GetComponentsInChildren<EncounterController>();
            foreach (var target in targets) target.transform.position = new Vector3(10, 7, 0);
            monster = targets.First(target => target.Kind == EncounterKind.Monster);
            monster.transform.position = new Vector3(1.4f, 0, 0);
            yield return null;
            yield return null;
        }

        [TearDown]
        public void Cleanup() { flow?.Dispose(); UnityEngine.Object.DestroyImmediate(host); }

        [UnityTest]
        public IEnumerator Ordinary_wrong_answer_preserves_lives_and_waits_for_feedback()
        {
            yield return Begin();
            var lives = flow.Snapshot.Lives;
            var feedback = 0;
            flow.WrongAnswerTutorRequested += (_, __) => feedback++;
            var submit = flow.SubmitAnswerAsync(new QuizAnswer { Value = "wrong", Correct = false }, CancellationToken.None);
            yield return new WaitUntil(() => submit.IsCompleted);
            Assert.That(submit.IsFaulted, Is.False);
            Assert.That(feedback, Is.EqualTo(1));
            Assert.That(flow.Snapshot.Lives, Is.EqualTo(lives));
            Assert.That(flow.Snapshot.WrongCount, Is.EqualTo(1));
            Assert.That(monster.gameObject.activeSelf, Is.True);
            Assert.That(host.GetComponentInChildren<PlayerController>().MovementEnabled, Is.False);
        }

        [UnityTest]
        public IEnumerator Last_monster_waits_for_feedback_before_settlement()
        {
            yield return Begin();
            var count = world.RemainingMonsters;
            flow.CorrectAnswerFeedbackRequested += _ => { };
            var submit = flow.SubmitAnswerAsync(new QuizAnswer { Value = "river", Correct = true }, CancellationToken.None);
            yield return new WaitUntil(() => submit.IsCompleted);
            Assert.That(world.RemainingMonsters, Is.EqualTo(count));
            flow.ResumeAfterTutor();
            Assert.That(world.RemainingMonsters, Is.EqualTo(count - 1));
            var score = flow.Snapshot.Score;
            flow.ResumeAfterTutor();
            Assert.That(flow.Snapshot.Score, Is.EqualTo(score));
        }

        [UnityTest]
        public IEnumerator Failed_save_never_awards_score_or_advances_word()
        {
            yield return Begin();
            learning.Submit = _ => Task.FromResult(ApiResult<QuizRecordResultDto>.Failure(503, "offline"));
            var submit = flow.SubmitAnswerAsync(new QuizAnswer { Value = "river", Correct = true }, CancellationToken.None);
            yield return new WaitUntil(() => submit.IsCompleted);
            Assert.That(flow.Snapshot.CorrectCount, Is.Zero);
            Assert.That(flow.Snapshot.Score, Is.Zero);
            Assert.That(monster.gameObject.activeSelf, Is.True);
        }

        [UnityTest]
        public IEnumerator Correction_clears_monster_without_rewriting_first_answer_or_reward()
        {
            yield return Begin();
            flow.WrongAnswerTutorRequested += (_, __) => { };
            var count = world.RemainingMonsters;
            var submit = flow.SubmitAnswerAsync(new QuizAnswer { Value = "wrong", Correct = false }, CancellationToken.None);
            yield return new WaitUntil(() => submit.IsCompleted);
            var correction = flow.CompleteCorrectionAsync("river");
            yield return new WaitUntil(() => correction.IsCompleted);
            Assert.That(world.RemainingMonsters, Is.EqualTo(count - 1));
            Assert.That(flow.Snapshot.CorrectCount, Is.Zero);
            Assert.That(flow.Snapshot.WrongCount, Is.EqualTo(1));
            Assert.That(flow.Snapshot.Score, Is.Zero);
            var duplicate = flow.CompleteCorrectionAsync("river");
            yield return new WaitUntil(() => duplicate.IsCompleted);
            Assert.That(world.RemainingMonsters, Is.EqualTo(count - 1));
        }

        [UnityTest]
        public IEnumerator Returning_to_wrong_monster_retries_its_original_word()
        {
            yield return Begin();
            flow.WrongAnswerTutorRequested += (_, __) => { };
            var submit = flow.SubmitAnswerAsync(new QuizAnswer { Value = "wrong", Correct = false }, CancellationToken.None);
            yield return new WaitUntil(() => submit.IsCompleted);
            flow.LeaveFeedback();
            var player = host.GetComponentInChildren<PlayerController>();
            player.transform.position = new Vector3(-4, 0, 0);
            yield return new WaitForSecondsRealtime(1.6f);
            string requestedWord = null;
            flow.QuestionReady += question => requestedWord = question.WordId;
            player.transform.position = Vector3.zero;
            yield return null;
            yield return null;
            Assert.That(requestedWord, Is.EqualTo("1"));
        }

        [UnityTest]
        public IEnumerator Retry_reuses_payload_identity_and_counts_first_answer_only_once()
        {
            yield return Begin();
            var requests = new List<QuizRecordRequest>();
            learning.Submit = request =>
            {
                requests.Add(request);
                return Task.FromResult(requests.Count == 1
                    ? ApiResult<QuizRecordResultDto>.Failure(503, "offline")
                    : ApiResult<QuizRecordResultDto>.Success(200, new QuizRecordResultDto { serverVerified = true, serverIsCorrect = true, serverScore = 100 }));
            };
            flow.CorrectAnswerFeedbackRequested += _ => { };
            var submit = flow.SubmitAnswerAsync(new QuizAnswer { Value = "river", Correct = true, ResponseMs = 1234 }, CancellationToken.None);
            yield return new WaitUntil(() => submit.IsCompleted);
            flow.RetryCurrentQuestion();
            yield return new WaitUntil(() => requests.Count == 2);
            Assert.That(requests[1].attemptId, Is.EqualTo(requests[0].attemptId));
            Assert.That(requests[1].responseTime, Is.EqualTo(1234));
            Assert.That(flow.Snapshot.CorrectCount, Is.EqualTo(1));
            Assert.That(flow.Snapshot.Score, Is.EqualTo(100));
        }

        [UnityTest]
        public IEnumerator Cancelling_question_load_cancels_transport_and_ignores_late_response()
        {
            var completion = new TaskCompletionSource<ApiResult<QuizDto>>();
            var requestedToken = CancellationToken.None;
            yield return Begin(new FakeVocabularyService { Quiz = token => { requestedToken = token; return completion.Task; } });
            var questions = 0;
            flow.QuestionReady += _ => questions++;
            flow.SkipEncounter();
            Assert.That(requestedToken.IsCancellationRequested, Is.True);
            completion.SetResult(ApiResult<QuizDto>.Failure(503, "late"));
            yield return null;
            Assert.That(questions, Is.Zero);
            Assert.That(host.GetComponentInChildren<PlayerController>().MovementEnabled, Is.True);
        }

        [UnityTest]
        public IEnumerator Background_pause_keeps_world_stopped_until_explicit_resume()
        {
            yield return Begin();
            flow.SkipEncounter();
            flow.PauseForFocusLoss();
            Assert.That(host.GetComponentInChildren<PlayerController>().MovementEnabled, Is.False);
            flow.TogglePause();
            Assert.That(host.GetComponentInChildren<PlayerController>().MovementEnabled, Is.True);
        }

        [UnityTest]
        public IEnumerator Disposed_flow_ignores_delayed_answer_without_rewards()
        {
            yield return Begin();
            var pending = new TaskCompletionSource<ApiResult<QuizRecordResultDto>>();
            learning.Submit = _ => pending.Task;
            var submit = flow.SubmitAnswerAsync(new QuizAnswer { Value = "river", Correct = true }, CancellationToken.None);
            flow.Dispose();
            pending.SetResult(ApiResult<QuizRecordResultDto>.Success(200,
                new QuizRecordResultDto { serverVerified = true, serverIsCorrect = true, serverScore = 100 }));
            yield return new WaitUntil(() => submit.IsCompleted);
            Assert.That(flow.Snapshot.Score, Is.Zero);
            Assert.That(flow.Snapshot.CorrectCount, Is.Zero);
            Assert.That(monster.gameObject.activeSelf, Is.True);
        }
    }
}
