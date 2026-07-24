using System.Collections.Generic;
using NUnit.Framework;
using WordQuest.Application;
using WordQuest.Domain.Game;
using WordQuest.Infrastructure.Api;
using WordQuest.Infrastructure.Storage;

namespace WordQuest.Tests
{
    public sealed class PendingSyncQueueTests
    {
        [Test]
        public void Pending_settlements_are_isolated_by_user()
        {
            var queue = new PendingSyncQueue(new MemoryStore());
            queue.Enqueue(
                "user-a",
                new PendingSubmission
                {
                    id = "a",
                    route = "/a",
                    achievementEvidence = new AchievementRunEvidence
                    {
                        MaximumCombo = 10,
                        FastestCorrectMs = 2200,
                        WordbookId = "cet4"
                    }
                });
            queue.Enqueue(
                "user-b",
                new PendingSubmission { id = "b", route = "/b" });

            Assert.That(queue.ReadAll("user-a"), Has.Count.EqualTo(1));
            Assert.That(queue.ReadAll("user-a")[0].id, Is.EqualTo("a"));
            Assert.That(
                queue.ReadAll("user-a")[0]
                    .achievementEvidence.MaximumCombo,
                Is.EqualTo(10));
            Assert.That(
                queue.ReadAll("user-a")[0]
                    .achievementEvidence.WordbookId,
                Is.EqualTo("cet4"));
            Assert.That(queue.ReadAll("user-b"), Has.Count.EqualTo(1));
            Assert.That(queue.ReadAll("user-b")[0].id, Is.EqualTo("b"));

            queue.Remove("user-a", "a");

            Assert.That(queue.ReadAll("user-a"), Is.Empty);
            Assert.That(queue.ReadAll("user-b"), Has.Count.EqualTo(1));
        }

        [TestCase(0, true)]
        [TestCase(408, true)]
        [TestCase(429, true)]
        [TestCase(503, true)]
        [TestCase(400, false)]
        [TestCase(401, false)]
        [TestCase(403, false)]
        public void Settlement_retry_policy_rejects_permanent_failures(
            long statusCode,
            bool expected)
        {
            var result = ApiResult<object>.Failure(
                statusCode,
                "failure");

            Assert.That(
                PendingSettlementSync.ShouldRetry(result),
                Is.EqualTo(expected));
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
