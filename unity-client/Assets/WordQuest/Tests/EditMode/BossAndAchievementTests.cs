using System.Linq;
using NUnit.Framework;
using WordQuest.Content;
using WordQuest.Domain.Game;
using WordQuest.Domain.Quiz;
using WordQuest.Gameplay.Boss;

namespace WordQuest.Tests
{
    public sealed class BossAndAchievementTests
    {
        [TestCase("roaming", BossKind.Roaming)]
        [TestCase("turret", BossKind.Turret)]
        [TestCase("charging", BossKind.Charging)]
        public void Boss_kind_matches_legacy_level_type(
            string value,
            BossKind expected)
        {
            Assert.That(BossState.ParseKind(value), Is.EqualTo(expected));
        }

        [Test]
        public void Correct_boss_answers_decrement_hp_and_grant_500_bonus()
        {
            var session = new GameSession(
                1,
                1,
                new[] { new Word("1", "a", "甲", "", "", 1) },
                Difficulty.For(DifficultyKind.Normal),
                1000);
            var state = new BossState(
                new BossDefinition("Boss", 2, 1),
                session);

            Assert.That(state.ApplyQuizResult(true), Is.False);
            Assert.That(state.ApplyQuizResult(true), Is.True);
            Assert.That(session.Snapshot.Score, Is.EqualTo(500));
            Assert.That(session.Snapshot.BossDefeated, Is.True);
        }

        [Test]
        public void Achievement_catalog_preserves_all_sixteen_ids()
        {
            var ids = AchievementPolicy.All.Select(item => item.Id).ToArray();

            Assert.That(ids, Has.Length.EqualTo(16));
            Assert.That(ids, Does.Contain("first_clear"));
            Assert.That(ids, Does.Contain("npc_friend"));
        }
    }
}
