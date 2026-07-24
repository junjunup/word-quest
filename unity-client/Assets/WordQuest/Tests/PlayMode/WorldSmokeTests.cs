using System.Collections;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;
using WordQuest.Content;
using WordQuest.Domain.Game;
using WordQuest.Gameplay;

namespace WordQuest.Tests
{
    public sealed class WorldSmokeTests
    {
        [UnityTest]
        public IEnumerator Same_seed_produces_same_spawn_positions()
        {
            var level = new LevelDefinition(
                1,
                1,
                "Test",
                5,
                "test",
                "roaming",
                new BossDefinition("Boss", 3, 2),
                false);
            var theme = ChapterTheme.ForChapter(1);

            var first = WorldGenerator.Generate(level, theme, 42);
            var firstPosition = first.transform.Find("Monster 1").position;
            var firstDecorations = first.transform.Find("Decorations");
            Assert.That(firstDecorations, Is.Not.Null);
            Assert.That(firstDecorations.childCount, Is.GreaterThan(0));
            Object.Destroy(first);
            yield return null;

            var second = WorldGenerator.Generate(level, theme, 42);
            var secondPosition = second.transform.Find("Monster 1").position;

            Assert.That(secondPosition, Is.EqualTo(firstPosition));
            Object.Destroy(second);
        }

        [UnityTest]
        public IEnumerator Monster_population_tracks_selected_difficulty()
        {
            var level = new LevelDefinition(
                1,
                2,
                "Difficulty",
                25,
                "test",
                string.Empty,
                null,
                false);
            var theme = ChapterTheme.ForChapter(1);
            var easy = WorldGenerator.Generate(
                level,
                theme,
                1,
                null,
                Difficulty.For(DifficultyKind.Easy));
            var easyCount = CountMonsters(easy);
            Object.Destroy(easy);
            yield return null;

            var hard = WorldGenerator.Generate(
                level,
                theme,
                1,
                null,
                Difficulty.For(DifficultyKind.Hard));
            var hardCount = CountMonsters(hard);

            Assert.That(easyCount, Is.EqualTo(8));
            Assert.That(hardCount, Is.EqualTo(13));
            Object.Destroy(hard);
        }

        private static int CountMonsters(GameObject root)
        {
            var count = 0;
            foreach (var encounter in root.GetComponentsInChildren<
                         EncounterController>())
            {
                if (encounter.Kind == EncounterKind.Monster)
                    count++;
            }
            return count;
        }
    }
}
