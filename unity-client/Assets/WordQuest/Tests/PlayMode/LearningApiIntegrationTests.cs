using System;
using System.Collections;
using System.IO;
using System.Linq;
using WordQuest.Content;
using WordQuest.Domain.Game;
using WordQuest.Gameplay;
using System.Threading;
using System.Threading.Tasks;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;
using WordQuest.Application;
using WordQuest.Domain.Quiz;
using WordQuest.Infrastructure.Api;
using WordQuest.Infrastructure.Api.Dto;
using WordQuest.Infrastructure.Api.Services;
using WordQuest.Infrastructure.Storage;

namespace WordQuest.Tests
{
    public sealed class LearningApiIntegrationTests
    {
        [Serializable] private sealed class Fixture { public string origin; public string token; public string otherToken; }

        [UnityTest]
        public IEnumerator Real_http_daily_learning_survives_duplicate_save_restart_and_finishes_once()
        {
            var path = Environment.GetEnvironmentVariable("WORDQUEST_TEST_API_FIXTURE");
            if (string.IsNullOrEmpty(path)) Assert.Ignore("Run with Tools/test-learning-integration.sh to start isolated HTTP + MongoDB.");
            var fixture = JsonUtility.FromJson<Fixture>(File.ReadAllText(path));
            var run = Exercise(fixture);
            yield return new WaitUntil(() => run.IsCompleted);
            if (run.IsFaulted) throw run.Exception.GetBaseException();
            Assert.That(run.IsCanceled, Is.False);
        }

        [UnityTest]
        public IEnumerator Daily_world_advances_only_after_feedback_is_persisted()
        {
            var path = Environment.GetEnvironmentVariable("WORDQUEST_TEST_API_FIXTURE");
            if (string.IsNullOrEmpty(path)) Assert.Ignore("Requires isolated API fixture.");
            var fixture = JsonUtility.FromJson<Fixture>(File.ReadAllText(path));
            var run = ExerciseWorld(fixture);
            yield return new WaitUntil(() => run.IsCompleted);
            if (run.IsFaulted) throw run.Exception.GetBaseException();
        }

        private static async Task ExerciseWorld(Fixture fixture)
        {
            var host = new GameObject("Daily integration world");
            GameFlowController flow = null;
            using (var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(30)))
            {
                try
                {
                    var token = timeout.Token;
                    var store = new EncounterMemoryStore();
                    var auth = new TokenStore(store); auth.Save(fixture.otherToken);
                    var api = new ApiClient(fixture.origin, auth, () => { });
                    var daily = new DailyLearningService(api);
                    var session = (await daily.CreateAsync("cet4", token)).Data;
                    var world = host.AddComponent<WorldController>();
                    flow = new GameFlowController(new VocabularyService(api), new LearningService(api), new FakeGameService(),
                        new PendingSyncQueue(store), world, "world-user", daily);
                    var question = new TaskCompletionSource<QuizQuestion>();
                    flow.QuestionReady += value => question.TrySetResult(value);
                    flow.WrongAnswerTutorRequested += (_, __) => { };
                    await flow.StartLevelAsync(new LevelSelection(new LevelDefinition(1, 1, "Daily", 10, "daily", "", null, false),
                        Difficulty.For(DifficultyKind.Normal)), token, session);
                    var player = host.GetComponentInChildren<PlayerController>();
                    player.transform.position = Vector3.zero;
                    var monsters = host.GetComponentsInChildren<EncounterController>().Where(x => x.Kind == EncounterKind.Monster).ToArray();
                    foreach (var monster in host.GetComponentsInChildren<EncounterController>()) monster.transform.position = new Vector3(10, 7, 0);
                    monsters[0].transform.position = new Vector3(1.4f, 0, 0);
                    while (!question.Task.IsCompleted) await Task.Delay(10, token);
                    await flow.SubmitAnswerAsync(new QuizAnswer { Value = "incorrect", Correct = false, Type = question.Task.Result.Type, ResponseMs = 1000 }, token);
                    Assert.That(world.RemainingMonsters, Is.EqualTo(10));
                    Assert.That((await daily.ReadAsync(session.sessionId, token)).Data.completedWordIds, Is.Empty);
                    flow.LeaveFeedback();
                    while (world.RemainingMonsters == 10) await Task.Delay(10, token);
                    Assert.That(world.RemainingMonsters, Is.EqualTo(9));
                    Assert.That((await daily.ReadAsync(session.sessionId, token)).Data.completedWordIds.Length, Is.EqualTo(1));
                    Assert.That(flow.Snapshot.CorrectCount, Is.Zero);
                    Assert.That(flow.Snapshot.Score, Is.Zero);
                }
                finally { flow?.Dispose(); UnityEngine.Object.DestroyImmediate(host); }
            }
        }

        private static async Task Exercise(Fixture fixture)
        {
            using (var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(60)))
            {
                var token = timeout.Token;
                var memory = new EncounterMemoryStore();
                var auth = new TokenStore(memory); auth.Save(fixture.token);
                var api = new ApiClient(fixture.origin, auth, () => { });
                var daily = new DailyLearningService(api);
                var learning = new LearningService(api);
                var created = await daily.CreateAsync("cet4", token);
                Assert.That(created.IsSuccess, Is.True, created.Message);
                Assert.That(created.Data.items.Length, Is.EqualTo(10));
                var session = created.Data;
                var word = session.items[0];
                var quiz = await new VocabularyService(api).GetQuizAsync(word._id, "choice_en2cn", token);
                Assert.That(quiz.IsSuccess, Is.True, quiz.Message);
                Assert.That(quiz.Data.distractors.Length, Is.EqualTo(3));
                var first = Attempt(word, session.sessionId, "incorrect");
                var pending = new PendingSyncQueue(memory);
                pending.RememberQuiz("fixture-user", first);
                var saved = await learning.SubmitQuizRecordAsync(first, token);
                Assert.That(saved.IsSuccess, Is.True, saved.Message);
                Assert.That(saved.Data.serverIsCorrect, Is.False);
                // Simulate a lost response: recreate the queue then replay the persisted identity.
                var restoredQueue = new PendingSyncQueue(memory);
                await PendingQuizSync.FlushAsync(restoredQueue, learning, "fixture-user", token);
                Assert.That(restoredQueue.ReadQuizzes("fixture-user"), Is.Empty);
                var corrected = await learning.SubmitQuizRecordAsync(LearningAttempt.Correction(first, word.word, 1200), token);
                Assert.That(corrected.IsSuccess, Is.True, corrected.Message);
                Assert.That(corrected.Data.serverScore, Is.Zero);
                Assert.That(corrected.Data.masteryDelta, Is.Zero);
                var interrupted = await new DailyLearningService(api).CreateAsync("cet4", token);
                Assert.That(interrupted.Data.completedWordIds, Is.Empty);
                Assert.That(interrupted.Data.pendingFeedback.Length, Is.EqualTo(1));
                Assert.That((await daily.AcknowledgeAsync(session.sessionId, word._id, token)).IsSuccess, Is.True);
                Assert.That((await daily.AcknowledgeAsync(session.sessionId, word._id, token)).Data.completedWordIds.Length, Is.EqualTo(1));
                var restored = await new DailyLearningService(api).CreateAsync("cet4", token);
                Assert.That(restored.Data.sessionId, Is.EqualTo(session.sessionId));
                Assert.That(DailyLearningPlan.Remaining(restored.Data).Length, Is.EqualTo(9));
                auth.Save(fixture.otherToken);
                Assert.That((await daily.ReadAsync(session.sessionId, token)).StatusCode, Is.EqualTo(404));
                auth.Clear();
                Assert.That((await daily.ReadAsync(session.sessionId, token)).StatusCode, Is.EqualTo(401));
                auth.Save(fixture.token);
                foreach (var item in DailyLearningPlan.Remaining(restored.Data))
                {
                    var result = await learning.SubmitQuizRecordAsync(Attempt(item, session.sessionId, item.word), token);
                    Assert.That(result.IsSuccess, Is.True, result.Message);
                    Assert.That((await daily.AcknowledgeAsync(session.sessionId, item._id, token)).IsSuccess, Is.True);
                }
                var completed = await daily.ReadAsync(session.sessionId, token);
                Assert.That(completed.Data.status, Is.EqualTo("completed"));
                Assert.That(completed.Data.completedWordIds.Length, Is.EqualTo(10));
                Assert.That(completed.Data.independentCorrect, Is.EqualTo(9));
                var summary = await daily.EvidenceAsync("cet4", token);
                Assert.That(summary.Data.recall.total, Is.EqualTo(10));
                Assert.That(summary.Data.correction.total, Is.EqualTo(1));
                Assert.That(summary.Data.delayedPassed, Is.Zero);
                Assert.That((await daily.CreateAsync("cet4", token)).Data.sessionId, Is.EqualTo(session.sessionId));
            }
        }

        private static QuizRecordRequest Attempt(WordDto word, string daily, string answer)
        {
            var question = new QuizQuestion(word._id, QuestionType.SpellFull, word.meaning, word.word, Array.Empty<QuizOption>());
            var request = LearningAttempt.Create(word, question, Guid.NewGuid().ToString("N"), "integration", "cet4", 1, 1, answer, 1000);
            request.dailySessionId = daily;
            request.sourceMode = "daily";
            return request;
        }
    }
}
