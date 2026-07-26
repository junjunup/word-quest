using System.Reflection;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.UIElements;
using WordQuest.Domain.Game;
using WordQuest.Domain.Quiz;
using WordQuest.Presentation.Screens;

namespace WordQuest.Tests
{
    public sealed class ResultScreenTests
    {
        [TestCase(false)]
        [TestCase(true)]
        public void Accepted_completion_uses_next_level_as_primary_action(
            bool pending)
        {
            var result = CreateResult();
            result.RecordSettlement(
                true,
                !pending,
                pending,
                pending ? "pending-run" : "saved-run");
            var nextCalls = 0;
            var replayCalls = 0;
            var view = CreateView();

            _ = new ResultScreen(
                view,
                result,
                () => replayCalls++,
                null,
                null,
                next: () => nextCalls++);

            Submit(view.Q<Button>("result-primary-button"));

            Assert.That(nextCalls, Is.EqualTo(1));
            Assert.That(replayCalls, Is.Zero);
            Assert.That(
                view.Q<Button>("result-primary-button").text,
                Does.Contain("下一关"));
            Assert.That(
                view.Q<Label>("result-learning-summary").text,
                Does.Contain("答对 1"));
            Assert.That(
                view.Q<Label>("result-learning-summary").text,
                Does.Contain("错题 1"));
        }

        [Test]
        public void Failed_run_uses_replay_as_primary_action()
        {
            var result = CreateResult();
            result.RecordSettlement(false, false, false, string.Empty);
            var replayCalls = 0;
            var nextCalls = 0;
            var view = CreateView();

            _ = new ResultScreen(
                view,
                result,
                () => replayCalls++,
                null,
                null,
                next: () => nextCalls++);

            Submit(view.Q<Button>("result-primary-button"));

            Assert.That(replayCalls, Is.EqualTo(1));
            Assert.That(nextCalls, Is.Zero);
            Assert.That(
                view.Q<Button>("result-primary-button").text,
                Does.Contain("再试一次"));
        }

        [Test]
        public void Rejected_progress_uses_replay_as_primary_action()
        {
            var result = CreateResult();
            result.RecordSettlement(true, false, false, string.Empty);
            var replayCalls = 0;
            var nextCalls = 0;
            var view = CreateView();

            _ = new ResultScreen(
                view,
                result,
                () => replayCalls++,
                null,
                null,
                next: () => nextCalls++);

            Submit(view.Q<Button>("result-primary-button"));

            Assert.That(replayCalls, Is.EqualTo(1));
            Assert.That(nextCalls, Is.Zero);
        }

        [Test]
        public void Final_level_completion_returns_to_level_map()
        {
            var result = CreateResult();
            result.RecordSettlement(true, true, false, "final-run");
            var mapCalls = 0;
            var replayCalls = 0;
            var view = CreateView();

            _ = new ResultScreen(
                view,
                result,
                () => replayCalls++,
                null,
                null,
                levelMap: () => mapCalls++);

            Submit(view.Q<Button>("result-primary-button"));

            Assert.That(mapCalls, Is.EqualTo(1));
            Assert.That(replayCalls, Is.Zero);
            Assert.That(
                view.Q<Button>("result-primary-button").text,
                Does.Contain("关卡地图"));
        }

        private static LevelResult CreateResult()
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
                        1),
                    new Word(
                        "word-2",
                        "school",
                        "学校",
                        string.Empty,
                        string.Empty,
                        1)
                },
                Difficulty.For(DifficultyKind.Normal),
                1000);
            session.SubmitAnswer(true, 900, 100);
            session.SubmitAnswer(false, 1200, 0);
            return session.Finish(4000);
        }

        private static VisualElement CreateView()
        {
            var asset =
                Resources.Load<VisualTreeAsset>("UI/Screens/Result");
            Assert.That(asset, Is.Not.Null);
            return asset.CloneTree();
        }

        private static void Submit(Button button)
        {
            var invoke = typeof(Clickable).GetMethod(
                "Invoke",
                BindingFlags.Instance | BindingFlags.NonPublic);
            Assert.That(invoke, Is.Not.Null);
            invoke.Invoke(button.clickable, new object[] { null });
        }
    }
}
