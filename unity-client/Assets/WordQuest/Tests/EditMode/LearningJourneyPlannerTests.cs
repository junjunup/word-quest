using NUnit.Framework;
using WordQuest.Application;
using WordQuest.Content;
using WordQuest.Infrastructure.Api.Dto;

namespace WordQuest.Tests
{
    public sealed class LearningJourneyPlannerTests
    {
        [Test]
        public void Plan_recommends_first_unlocked_incomplete_level()
        {
            var catalog = CreateCatalog();
            var status = new LevelsStatusDto
            {
                chapters = new[]
                {
                    new ChapterStatusDto
                    {
                        id = 1,
                        unlocked = true,
                        levels = new[]
                        {
                            Level(1, true, true),
                            Level(2, true, false)
                        }
                    },
                    new ChapterStatusDto
                    {
                        id = 2,
                        unlocked = false,
                        levels = new[]
                        {
                            Level(1, false, false),
                            Level(2, false, false)
                        }
                    }
                }
            };

            var plan = LearningJourneyPlanner.Create(catalog, status);

            Assert.That(plan.RecommendedLevel.Chapter, Is.EqualTo(1));
            Assert.That(plan.RecommendedLevel.Id, Is.EqualTo(2));
            Assert.That(plan.CompletedLevels, Is.EqualTo(1));
            Assert.That(plan.TotalLevels, Is.EqualTo(4));
            Assert.That(plan.HasReliableProgress, Is.True);
        }

        [Test]
        public void Plan_without_status_falls_back_without_fabricating_progress()
        {
            var plan = LearningJourneyPlanner.Create(
                CreateCatalog(),
                null);

            Assert.That(plan.RecommendedLevel.Chapter, Is.EqualTo(1));
            Assert.That(plan.RecommendedLevel.Id, Is.EqualTo(1));
            Assert.That(plan.CompletedLevels, Is.EqualTo(0));
            Assert.That(plan.TotalLevels, Is.EqualTo(4));
            Assert.That(plan.HasReliableProgress, Is.False);
        }

        [Test]
        public void Plan_with_all_unlocked_levels_complete_recommends_last_one()
        {
            var catalog = CreateCatalog();
            var status = new LevelsStatusDto
            {
                chapters = new[]
                {
                    new ChapterStatusDto
                    {
                        id = 1,
                        unlocked = true,
                        levels = new[]
                        {
                            Level(1, true, true),
                            Level(2, true, true)
                        }
                    },
                    new ChapterStatusDto
                    {
                        id = 2,
                        unlocked = false,
                        levels = new[]
                        {
                            Level(1, false, false),
                            Level(2, false, false)
                        }
                    }
                }
            };

            var plan = LearningJourneyPlanner.Create(catalog, status);

            Assert.That(plan.RecommendedLevel.Chapter, Is.EqualTo(1));
            Assert.That(plan.RecommendedLevel.Id, Is.EqualTo(2));
            Assert.That(plan.CompletedLevels, Is.EqualTo(2));
        }

        [Test]
        public void Next_level_crosses_chapter_boundary_and_stops_at_catalog_end()
        {
            var catalog = CreateCatalog();

            var crossChapter = LearningJourneyPlanner.NextLevel(
                catalog,
                catalog.GetLevel(1, 2));
            var afterFinal = LearningJourneyPlanner.NextLevel(
                catalog,
                catalog.GetLevel(2, 2));

            Assert.That(crossChapter.Chapter, Is.EqualTo(2));
            Assert.That(crossChapter.Id, Is.EqualTo(1));
            Assert.That(afterFinal, Is.Null);
        }

        private static LevelStatusDto Level(
            int id,
            bool unlocked,
            bool completed)
        {
            return new LevelStatusDto
            {
                id = id,
                unlocked = unlocked,
                completed = completed,
                stars = completed ? 2 : 0
            };
        }

        private static ContentCatalog CreateCatalog()
        {
            return ContentCatalog.LoadFromJson(
                "{\"chapters\":[" +
                "{\"id\":1,\"name\":\"森林启程\",\"theme\":\"forest\"," +
                "\"description\":\"d\",\"color\":\"#335544\",\"levels\":[" +
                "{\"id\":1,\"name\":\"问候\",\"wordsCount\":8,\"category\":\"k12\"}," +
                "{\"id\":2,\"name\":\"家庭\",\"wordsCount\":10,\"category\":\"k12\"}]}," +
                "{\"id\":2,\"name\":\"校园探索\",\"theme\":\"school\"," +
                "\"description\":\"d\",\"color\":\"#446655\",\"levels\":[" +
                "{\"id\":1,\"name\":\"课堂\",\"wordsCount\":12,\"category\":\"k12\"}," +
                "{\"id\":2,\"name\":\"朋友\",\"wordsCount\":12,\"category\":\"k12\"}]}" +
                "]}");
        }
    }
}
