using System;
using System.Collections.Generic;
using UnityEngine;
using WordQuest.Content;
using WordQuest.Domain.Game;

namespace WordQuest.Gameplay.Boss
{
    public sealed class TurretBossController : BossController
    {
        [SerializeField] private float fireInterval = 3f;
        private readonly Queue<GameObject> pool = new Queue<GameObject>();
        private float elapsed;

        public override void Configure(
            BossDefinition definition,
            GameSession session)
        {
            base.Configure(definition, session);
            fireInterval =
                Difficulty.Parse(session.Snapshot.DifficultyId).Kind ==
                DifficultyKind.Hard
                    ? 2f
                    : 3f;
        }

        private void Update()
        {
            if (!SimulationEnabled || State == null)
                return;

            elapsed += Time.deltaTime;
            if (elapsed < fireInterval)
                return;
            elapsed = 0f;
            Fire();
        }

        private void Fire()
        {
            var projectile = pool.Count > 0
                ? pool.Dequeue()
                : GameObject.CreatePrimitive(PrimitiveType.Quad);
            projectile.name = "Boss Projectile";
            projectile.transform.SetParent(transform.parent, true);
            projectile.transform.position = transform.position;
            projectile.transform.localScale = Vector3.one * 0.25f;
            var collider = projectile.GetComponent<CircleCollider2D>() ??
                           projectile.AddComponent<CircleCollider2D>();
            collider.isTrigger = true;
            projectile.SetActive(true);
            var behavior = projectile.GetComponent<BossProjectile>() ??
                           projectile.AddComponent<BossProjectile>();
            var player = FindAnyObjectByType<PlayerController>();
            var direction = player == null
                ? Vector3.left
                : (player.transform.position - transform.position).normalized;
            behavior.Launch(
                this,
                direction * 4f,
                () =>
                {
                    projectile.SetActive(false);
                    pool.Enqueue(projectile);
                });
        }
    }

    internal sealed class BossProjectile : MonoBehaviour
    {
        private BossController owner;
        private Vector3 velocity;
        private float remaining;
        private Action finished;
        private bool active;

        public void Launch(
            BossController nextOwner,
            Vector3 nextVelocity,
            Action onFinished)
        {
            owner = nextOwner;
            velocity = nextVelocity;
            remaining = 3f;
            finished = onFinished;
            active = true;
        }

        private void Update()
        {
            if (!active || owner == null || !owner.IsSimulationActive)
                return;

            transform.position += velocity * Time.deltaTime;
            remaining -= Time.deltaTime;
            if (remaining <= 0f)
                Finish();
        }

        private void OnTriggerEnter2D(Collider2D other)
        {
            if (!active || owner == null || !owner.IsSimulationActive ||
                other.GetComponent<PlayerController>() == null)
                return;

            owner?.NotifyProjectileHit();
            Finish();
        }

        private void Finish()
        {
            if (!active)
                return;
            active = false;
            finished?.Invoke();
        }
    }
}
