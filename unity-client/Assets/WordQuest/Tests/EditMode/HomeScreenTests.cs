using System.Reflection;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.UIElements;
using WordQuest.Application;
using WordQuest.Content;
using WordQuest.Infrastructure.Api.Dto;
using WordQuest.Presentation;
using WordQuest.Presentation.Screens;

namespace WordQuest.Tests
{
    public sealed class HomeScreenTests
    {
        [Test]
        public void Daily_action_stays_primary_after_asynchronous_journey_refresh()
        {
            var view = CreateView();
            var daily = 0;
            var screen = new HomeScreen(view, SignedInContext(), _ => { }, startDaily: () => daily++);
            screen.RenderJourney(LearningJourneyPlanner.Create(CreateCatalog(), CompleteStatus()));
            Submit(view.Q<Button>("continue-learning-button"));
            Assert.That(daily, Is.EqualTo(1));
            Assert.That(view.Q<Button>("continue-learning-button").text, Does.Contain("今日学习"));
        }

        [Test]
        public void Continue_action_starts_the_recommended_level()
        {
            var catalog = CreateCatalog();
            var plan = LearningJourneyPlanner.Create(
                catalog,
                CompleteStatus());
            LevelDefinition selected = null;
            var view = CreateView();

            _ = new HomeScreen(
                view,
                SignedInContext(),
                null,
                journey: plan,
                startLevel: level => selected = level);

            Submit(view.Q<Button>("continue-learning-button"));

            Assert.That(selected, Is.SameAs(catalog.GetLevel(1, 2)));
        }

        [Test]
        public void Existing_feature_destinations_remain_reachable()
        {
            var lastDestination = ScreenId.Loading;
            var view = CreateView();

            _ = new HomeScreen(
                view,
                SignedInContext(),
                screen => lastDestination = screen,
                journey: LearningJourneyPlanner.Create(
                    CreateCatalog(),
                    null));

            Submit(FindFeature(view, ScreenId.Review));
            Assert.That(lastDestination, Is.EqualTo(ScreenId.Review));

            Submit(FindFeature(view, ScreenId.AiTutor));
            Assert.That(lastDestination, Is.EqualTo(ScreenId.AiTutor));

            Submit(FindFeature(view, ScreenId.Profile));
            Assert.That(lastDestination, Is.EqualTo(ScreenId.Profile));
        }

        [Test]
        public void Missing_progress_is_disclosed_instead_of_fabricated()
        {
            var view = CreateView();

            _ = new HomeScreen(
                view,
                SignedInContext(),
                null,
                journey: LearningJourneyPlanner.Create(
                    CreateCatalog(),
                    null));

            Assert.That(
                view.Q<Label>("journey-progress-label").text,
                Does.Contain("暂不可用"));
            Assert.That(
                view.Q<Button>("continue-learning-button").enabledSelf,
                Is.True);
        }

        [Test]
        public void Home_does_not_infer_fit_without_wordbook_metadata()
        {
            var context = SignedInContext();
            context.Settings.LearnerStageId = "primary";
            context.Settings.WordbookId = "k12-primary-core";
            var view = CreateView();

            _ = new HomeScreen(
                view,
                context,
                null,
                journey: LearningJourneyPlanner.Create(
                    CreateCatalog(),
                    null));

            Assert.That(
                view.Q<Label>("learning-stage-label").text,
                Is.EqualTo(
                    "小学 · 1–6 年级学习路径 · 词书匹配请在关卡地图确认"));
        }

        private static Button FindFeature(
            VisualElement view,
            ScreenId screen)
        {
            foreach (var button in view.Query<Button>(
                         className: "feature-button").ToList())
            {
                if (button.viewDataKey == screen.ToString())
                    return button;
            }

            Assert.Fail($"Feature button {screen} was removed.");
            return null;
        }

        private static void Submit(Button button)
        {
            var invoke = typeof(Clickable).GetMethod(
                "Invoke",
                BindingFlags.Instance | BindingFlags.NonPublic);
            Assert.That(invoke, Is.Not.Null);
            invoke.Invoke(button.clickable, new object[] { null });
        }

        private static VisualElement CreateView()
        {
            var asset = Resources.Load<VisualTreeAsset>("UI/Screens/Home");
            Assert.That(asset, Is.Not.Null);
            return asset.CloneTree();
        }

        private static WordQuestContext SignedInContext()
        {
            var context = new WordQuestContext();
            context.SignIn(new UserProfile { Username = "小词星" });
            return context;
        }

        private static LevelsStatusDto CompleteStatus()
        {
            return new LevelsStatusDto
            {
                chapters = new[]
                {
                    new ChapterStatusDto
                    {
                        id = 1,
                        unlocked = true,
                        levels = new[]
                        {
                            new LevelStatusDto
                            {
                                id = 1,
                                unlocked = true,
                                completed = true
                            },
                            new LevelStatusDto
                            {
                                id = 2,
                                unlocked = true,
                                completed = false
                            }
                        }
                    }
                }
            };
        }

        private static ContentCatalog CreateCatalog()
        {
            return ContentCatalog.LoadFromJson(
                "{\"chapters\":[{\"id\":1,\"name\":\"启程\"," +
                "\"theme\":\"forest\",\"description\":\"d\"," +
                "\"color\":\"#335544\",\"levels\":[" +
                "{\"id\":1,\"name\":\"问候\",\"wordsCount\":8,\"category\":\"k12\"}," +
                "{\"id\":2,\"name\":\"家庭\",\"wordsCount\":10,\"category\":\"k12\"}]}]}");
        }
    }
}
