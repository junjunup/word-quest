using System.Reflection;
using NUnit.Framework;
using UnityEngine.UIElements;
using WordQuest.Content;
using WordQuest.Domain.Game;
using WordQuest.Domain.Quiz;
using WordQuest.Infrastructure.Api;
using WordQuest.Infrastructure.Api.Dto;
using WordQuest.Presentation;

namespace WordQuest.Tests
{
    public sealed class WordQuestAppTests
    {
        [TestCase(true, false, true)]
        [TestCase(false, true, true)]
        [TestCase(false, false, false)]
        public void Session_restore_abandons_cancelled_results(
            bool resultCancelled,
            bool lifetimeCancelled,
            bool expected)
        {
            var method = typeof(WordQuestApp).GetMethod(
                "ShouldAbandonSessionRestore",
                BindingFlags.Static | BindingFlags.NonPublic);
            Assert.That(method, Is.Not.Null);
            var result = ApiResult<UserDto>.Failure(
                0,
                "cancelled",
                resultCancelled);

            Assert.That(
                method.Invoke(
                    null,
                    new object[] { result, lifetimeCancelled }),
                Is.EqualTo(expected));
        }

        [Test]
        public void Home_refresh_applies_only_to_the_current_active_home_view()
        {
            var method = typeof(WordQuestApp).GetMethod(
                "ShouldApplyHomeJourney",
                BindingFlags.Static | BindingFlags.NonPublic);
            Assert.That(method, Is.Not.Null);
            var requested = new VisualElement();
            var other = new VisualElement();

            Assert.That(
                method.Invoke(
                    null,
                    new object[]
                    {
                        requested,
                        requested,
                        ScreenId.Home,
                        false
                    }),
                Is.True);
            Assert.That(
                method.Invoke(
                    null,
                    new object[]
                    {
                        requested,
                        other,
                        ScreenId.Home,
                        false
                    }),
                Is.False);
            Assert.That(
                method.Invoke(
                    null,
                    new object[]
                    {
                        requested,
                        requested,
                        ScreenId.Home,
                        true
                    }),
                Is.False);
            Assert.That(
                method.Invoke(
                    null,
                    new object[]
                    {
                        requested,
                        requested,
                        ScreenId.LevelSelect,
                        false
                    }),
                Is.False);
        }

        [TestCase(true, false, true)]
        [TestCase(false, true, true)]
        [TestCase(false, false, false)]
        public void Result_next_level_requires_accepted_progress(
            bool saved,
            bool pending,
            bool expectedNext)
        {
            var method = typeof(WordQuestApp).GetMethod(
                "NextLevelAfterResult",
                BindingFlags.Static | BindingFlags.NonPublic);
            Assert.That(method, Is.Not.Null);
            var catalog = ContentCatalog.LoadFromJson(
                "{\"chapters\":[{\"id\":1,\"name\":\"A\"," +
                "\"theme\":\"T\",\"description\":\"D\"," +
                "\"color\":\"#335544\",\"levels\":[" +
                "{\"id\":1,\"name\":\"L1\",\"wordsCount\":2,\"category\":\"k12\"}," +
                "{\"id\":2,\"name\":\"L2\",\"wordsCount\":2,\"category\":\"k12\"}]}]}");
            var result = CreateResult();
            result.RecordSettlement(
                true,
                saved,
                pending,
                saved || pending ? "accepted-run" : string.Empty);

            var next = (LevelDefinition)method.Invoke(
                null,
                new object[]
                {
                    catalog,
                    catalog.GetLevel(1, 1),
                    result
                });

            Assert.That(next != null, Is.EqualTo(expectedNext));
            if (next != null)
                Assert.That(next.Id, Is.EqualTo(2));
        }

        private static LevelResult CreateResult()
        {
            var session = new GameSession(
                1,
                1,
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
            session.SubmitAnswer(true, 500, 100);
            return session.Finish(2000);
        }
    }
}
