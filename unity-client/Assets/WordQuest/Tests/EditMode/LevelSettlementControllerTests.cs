using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using NUnit.Framework;
using WordQuest.Application;
using WordQuest.Domain.Game;
using WordQuest.Domain.Quiz;
using WordQuest.Infrastructure.Api;
using WordQuest.Infrastructure.Api.Dto;
using WordQuest.Infrastructure.Storage;

namespace WordQuest.Tests
{
    public sealed class LevelSettlementControllerTests
    {
        [Test]
        public async Task Failed_run_never_calls_or_queues_progress()
        {
            var calls = 0;
            var queue = new PendingSyncQueue(new MemoryStore());
            var controller = CreateController(
                queue,
                request =>
                {
                    calls++;
                    return ApiResult<ProgressDto>.Success(
                        200,
                        new ProgressDto());
                });
            var result = NewResult();

            await controller.SettleAsync(
                result,
                false,
                "cet4",
                "user-1",
                CancellationToken.None);

            Assert.That(calls, Is.Zero);
            Assert.That(result.LevelCompleted, Is.False);
            Assert.That(result.ProgressSaved, Is.False);
            Assert.That(result.ProgressPending, Is.False);
            Assert.That(queue.ReadAll("user-1"), Is.Empty);
        }

        [Test]
        public async Task Successful_save_queues_confirmed_achievement_work()
        {
            SaveProgressRequest captured = null;
            var queue = new PendingSyncQueue(new MemoryStore());
            var controller = CreateController(
                queue,
                request =>
                {
                    captured = request;
                    return ApiResult<ProgressDto>.Success(
                        200,
                        new ProgressDto());
                });
            var result = NewResult();

            await controller.SettleAsync(
                result,
                true,
                "cet4",
                "user-1",
                CancellationToken.None);

            Assert.That(captured.sessionId, Is.EqualTo(result.SessionId));
            Assert.That(result.ProgressSaved, Is.True);
            Assert.That(result.ProgressPending, Is.False);
            var queued = queue.ReadAll("user-1");
            Assert.That(queued, Has.Count.EqualTo(1));
            Assert.That(queued[0].id, Is.EqualTo("settlement-fixed"));
            Assert.That(queued[0].progressSaved, Is.True);
            Assert.That(
                queued[0].achievementEvidence.SessionId,
                Is.EqualTo(result.SessionId));
        }

        [Test]
        public async Task Transient_failure_queues_exact_retry_evidence()
        {
            var queue = new PendingSyncQueue(new MemoryStore());
            var controller = CreateController(
                queue,
                _ => ApiResult<ProgressDto>.Failure(503, "offline"));
            var result = NewResult();

            await controller.SettleAsync(
                result,
                true,
                "cet4",
                "user-1",
                CancellationToken.None);

            Assert.That(result.ProgressSaved, Is.False);
            Assert.That(result.ProgressPending, Is.True);
            Assert.That(result.SettlementId, Is.EqualTo("settlement-fixed"));
            var queued = queue.ReadAll("user-1");
            Assert.That(queued, Has.Count.EqualTo(1));
            Assert.That(queued[0].progressSaved, Is.False);
            StringAssert.Contains(result.SessionId, queued[0].jsonBody);
            Assert.That(
                queued[0].achievementEvidence.SessionId,
                Is.EqualTo(result.SessionId));
        }

        [Test]
        public async Task Permanent_failure_is_not_queued()
        {
            var queue = new PendingSyncQueue(new MemoryStore());
            var controller = CreateController(
                queue,
                _ => ApiResult<ProgressDto>.Failure(400, "invalid"));
            var result = NewResult();

            await controller.SettleAsync(
                result,
                true,
                "cet4",
                "user-1",
                CancellationToken.None);

            Assert.That(result.LevelCompleted, Is.True);
            Assert.That(result.ProgressSaved, Is.False);
            Assert.That(result.ProgressPending, Is.False);
            Assert.That(result.SettlementId, Is.Empty);
            Assert.That(queue.ReadAll("user-1"), Is.Empty);
        }

        [Test]
        public async Task Cancelled_save_is_not_misclassified_as_retryable()
        {
            var queue = new PendingSyncQueue(new MemoryStore());
            var controller = CreateController(
                queue,
                _ => ApiResult<ProgressDto>.Failure(
                    0,
                    "cancelled",
                    cancelled: true));
            var result = NewResult();

            await controller.SettleAsync(
                result,
                true,
                "cet4",
                "user-1",
                CancellationToken.None);

            Assert.That(result.LevelCompleted, Is.True);
            Assert.That(result.ProgressSaved, Is.False);
            Assert.That(result.ProgressPending, Is.False);
            Assert.That(queue.ReadAll("user-1"), Is.Empty);
        }

        private static LevelSettlementController CreateController(
            PendingSyncQueue queue,
            System.Func<SaveProgressRequest, ApiResult<ProgressDto>>
                response)
        {
            return new LevelSettlementController(
                (request, _) => Task.FromResult(response(request)),
                queue,
                () => "settlement-fixed",
                () => 123456789L);
        }

        private static LevelResult NewResult()
        {
            var session = new GameSession(
                1,
                2,
                new[]
                {
                    new Word(
                        "word-1",
                        "hello",
                        "你好",
                        string.Empty,
                        string.Empty,
                        1)
                },
                Difficulty.For(DifficultyKind.Normal),
                1000);
            session.SubmitAnswer(true, 900, 100);
            return session.Finish(2000);
        }

        private sealed class MemoryStore : IKeyValueStore
        {
            private readonly Dictionary<string, string> values =
                new Dictionary<string, string>();

            public bool HasKey(string key) => values.ContainsKey(key);

            public string GetString(string key, string fallback = "")
            {
                return values.TryGetValue(key, out var value)
                    ? value
                    : fallback;
            }

            public void SetString(string key, string value)
            {
                values[key] = value;
            }

            public void DeleteKey(string key)
            {
                values.Remove(key);
            }

            public void Save() { }
        }
    }
}
