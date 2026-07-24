using System.Collections.Generic;
using UnityEngine;

namespace WordQuest.Gameplay.Boss
{
    public sealed class TurretBossController : BossController
    {
        [SerializeField] private float fireInterval = 3f;
        private readonly Queue<GameObject> pool = new Queue<GameObject>();
        private float elapsed;

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
            projectile.transform.position = transform.position;
            projectile.transform.localScale = Vector3.one * 0.25f;
            projectile.SetActive(true);
            var lifetime = projectile.GetComponent<ProjectileLifetime>() ??
                           projectile.AddComponent<ProjectileLifetime>();
            lifetime.Launch(Vector3.left * 4f, () =>
            {
                projectile.SetActive(false);
                pool.Enqueue(projectile);
            });
        }
    }

    internal sealed class ProjectileLifetime : MonoBehaviour
    {
        private Vector3 velocity;
        private float remaining;
        private System.Action finished;

        public void Launch(Vector3 nextVelocity, System.Action onFinished)
        {
            velocity = nextVelocity;
            remaining = 3f;
            finished = onFinished;
        }

        private void Update()
        {
            transform.position += velocity * Time.deltaTime;
            remaining -= Time.deltaTime;
            if (remaining <= 0f)
                finished?.Invoke();
        }
    }
}
