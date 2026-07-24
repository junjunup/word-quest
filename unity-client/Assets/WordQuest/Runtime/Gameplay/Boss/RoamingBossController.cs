using UnityEngine;

namespace WordQuest.Gameplay.Boss
{
    public sealed class RoamingBossController : BossController
    {
        [SerializeField] private float patrolRadius = 3f;
        private Vector3 origin;
        private float direction = 1f;

        private void Awake()
        {
            origin = transform.position;
        }

        private void Update()
        {
            if (!SimulationEnabled || State == null)
                return;

            transform.position += Vector3.right *
                                  (direction * State.Definition.Speed *
                                   0.03f * Time.deltaTime);
            if (Mathf.Abs(transform.position.x - origin.x) >= patrolRadius)
                direction *= -1f;
        }
    }
}
