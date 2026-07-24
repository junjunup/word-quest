using System.Collections;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;
using WordQuest.Content;
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
            Object.Destroy(first);
            yield return null;

            var second = WorldGenerator.Generate(level, theme, 42);
            var secondPosition = second.transform.Find("Monster 1").position;

            Assert.That(secondPosition, Is.EqualTo(firstPosition));
            Object.Destroy(second);
        }
    }
}
