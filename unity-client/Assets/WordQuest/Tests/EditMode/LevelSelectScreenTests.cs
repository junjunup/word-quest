using NUnit.Framework;
using UnityEngine;
using UnityEngine.UIElements;
using WordQuest.Application;
using WordQuest.Content;
using WordQuest.Infrastructure.Api.Dto;
using WordQuest.Presentation.Screens;

namespace WordQuest.Tests
{
    public sealed class LevelSelectScreenTests
    {
        [Test]
        public void Reliable_progress_explains_recommended_completed_and_locked_levels()
        {
            var catalog = CreateCatalog();
            var status = Status();
            var plan = LearningJourneyPlanner.Create(catalog, status);
            var view = CreateView();

            _ = new LevelSelectScreen(
                view,
                catalog,
                null,
                status: status,
                journey: plan);

            Assert.That(
                view.Q<Label>("level-progress-label").text,
                Does.Contain("1 / 3"));

            var completed = view.Q<Button>("level-1-1");
            Assert.That(completed.text, Does.Contain("已完成"));
            Assert.That(completed.text, Does.Contain("★★☆"));

            var recommended = view.Q<Button>("level-1-2");
            Assert.That(recommended.text, Does.Contain("推荐"));
            Assert.That(recommended.enabledSelf, Is.True);
            Assert.That(
                recommended.ClassListContains("recommended-level"),
                Is.True);

            var locked = view.Q<Button>("level-1-3");
            Assert.That(locked.text, Does.Contain("完成前一关后解锁"));
            Assert.That(locked.enabledSelf, Is.False);
        }

        [Test]
        public void Missing_status_discloses_unavailable_progress()
        {
            var catalog = CreateCatalog();
            var view = CreateView();

            _ = new LevelSelectScreen(
                view,
                catalog,
                null,
                journey: LearningJourneyPlanner.Create(catalog, null));

            Assert.That(
                view.Q<Label>("level-progress-label").text,
                Does.Contain("暂不可用"));
        }

        private static VisualElement CreateView()
        {
            var asset =
                Resources.Load<VisualTreeAsset>("UI/Screens/LevelSelect");
            Assert.That(asset, Is.Not.Null);
            return asset.CloneTree();
        }

        private static LevelsStatusDto Status()
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
                                completed = true,
                                stars = 2
                            },
                            new LevelStatusDto
                            {
                                id = 2,
                                unlocked = true,
                                completed = false,
                                stars = 0
                            },
                            new LevelStatusDto
                            {
                                id = 3,
                                unlocked = false,
                                completed = false,
                                stars = 0
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
                "{\"id\":2,\"name\":\"家庭\",\"wordsCount\":10,\"category\":\"k12\"}," +
                "{\"id\":3,\"name\":\"校园\",\"wordsCount\":12,\"category\":\"k12\"}]}]}");
        }
    }
}
