using System.Collections;
using System.Linq;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;
using WordQuest.Content;
using WordQuest.Domain.Game;
using WordQuest.Gameplay;

namespace WordQuest.Tests
{
    public sealed class EncounterRegressionTests
    {
        private GameObject host;
        private WorldController world;
        private PlayerController player;
        private EncounterController monster;

        [SetUp]
        public void CreateWorld()
        {
            host = new GameObject("Encounter regression");
            world = host.AddComponent<WorldController>();
            world.Build(new LevelDefinition(1, 1, "Test", 5, "test",
                string.Empty, null, true), 42, Difficulty.For(DifficultyKind.Normal));
            player = host.GetComponentInChildren<PlayerController>();
            player.transform.position = Vector3.zero;
            var targets = host.GetComponentsInChildren<EncounterController>();
            foreach (var target in targets)
                target.transform.position = new Vector3(10, 7, 0);
            monster = targets.First(target => target.Kind == EncounterKind.Monster);
        }

        [TearDown]
        public void Cleanup() { Object.DestroyImmediate(host); }

        [UnityTest]
        public IEnumerator Approach_selects_nearest_monster_without_contact_or_key()
        {
            monster.transform.position = new Vector3(1.4f, 0, 0);
            Encounter chosen = null;
            world.Encountered += value => chosen = value;
            yield return null;
            yield return null;
            Assert.That(chosen, Is.Not.Null);
            Assert.That(chosen.Source, Is.EqualTo(monster.gameObject));
            Assert.That(player.MovementEnabled, Is.False);
        }

        [UnityTest]
        public IEnumerator Wall_blocks_automatic_encounter()
        {
            monster.transform.position = new Vector3(1.4f, 0, 0);
            var wall = new GameObject("Wall");
            wall.transform.SetParent(host.transform);
            wall.transform.position = new Vector3(0.7f, 0, 0);
            wall.AddComponent<BoxCollider2D>().size = new Vector2(0.1f, 2);
            var count = 0;
            world.Encountered += _ => count++;
            Physics2D.SyncTransforms();
            yield return null;
            yield return null;
            Assert.That(count, Is.Zero);
        }

        [UnityTest]
        public IEnumerator Resume_does_not_rearm_cancelled_target_until_player_leaves()
        {
            monster.transform.position = Vector3.zero;
            world.CooldownEncounter(new Encounter("test", EncounterKind.Monster,
                monster.gameObject), 0.05f);
            world.SetSimulationEnabled(false);
            world.SetSimulationEnabled(true);
            var count = 0;
            world.Encountered += _ => count++;
            yield return new WaitForSecondsRealtime(0.15f);
            Assert.That(count, Is.Zero, "Resume must preserve target suppression");
            player.transform.position = new Vector3(-3, 0, 0);
            yield return null;
            yield return null;
            player.transform.position = new Vector3(-1.4f, 0, 0);
            yield return null;
            yield return null;
            Assert.That(count, Is.EqualTo(1));
        }

        [UnityTest]
        public IEnumerator Paused_boss_projectile_does_not_hit_or_disappear()
        {
            var bossObject = new GameObject("Boss test");
            bossObject.transform.SetParent(host.transform);
            bossObject.AddComponent<CircleCollider2D>().isTrigger = true;
            var boss = bossObject.AddComponent<WordQuest.Gameplay.Boss.BossController>();
            boss.SetSimulationEnabled(false);
            bossObject.transform.position = new Vector3(8, 0, 0);
            var bullet = new GameObject("Bullet test");
            bullet.transform.SetParent(host.transform);
            bullet.AddComponent<CircleCollider2D>().isTrigger = true;
            var type = typeof(WorldController).Assembly.GetType("WordQuest.Gameplay.Boss.BossProjectile");
            var behavior = bullet.AddComponent(type);
            var finished = 0;
            type.GetMethod("Launch").Invoke(behavior, new object[]
            {
                boss, Vector3.right, new System.Action(() => finished++)
            });
            yield return new WaitForFixedUpdate();
            yield return new WaitForFixedUpdate();
            Assert.That(finished, Is.Zero);
            Assert.That(bullet.transform.position, Is.EqualTo(Vector3.zero));
        }

        [Test]
        public void Pausing_immediately_clears_player_velocity()
        {
            var body = player.GetComponent<Rigidbody2D>();
            body.linearVelocity = Vector2.right * 4;
            world.SetSimulationEnabled(false);
            Assert.That(body.linearVelocity, Is.EqualTo(Vector2.zero));
        }
    }
}
