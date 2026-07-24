using UnityEngine;

namespace WordQuest.Gameplay.Boss
{
    public sealed class ChargingBossController : BossController
    {
        private enum ChargeState
        {
            Resting,
            Telegraphing,
            Charging,
            Recovering
        }

        private ChargeState chargeState;
        private float timer = 3f;
        private Vector3 chargeVelocity;
        private SpriteRenderer spriteRenderer;

        private void Awake()
        {
            spriteRenderer = GetComponent<SpriteRenderer>();
        }

        private void Update()
        {
            if (!SimulationEnabled || State == null)
                return;

            timer -= Time.deltaTime;
            if (timer > 0f)
            {
                if (chargeState == ChargeState.Charging)
                {
                    transform.position += chargeVelocity * Time.deltaTime;
                    var position = transform.position;
                    position.x = Mathf.Clamp(position.x, -13f, 13f);
                    position.y = Mathf.Clamp(position.y, -8f, 8f);
                    transform.position = position;
                }
                else if (chargeState == ChargeState.Telegraphing &&
                         spriteRenderer != null)
                {
                    var alpha = Mathf.PingPong(
                        Time.unscaledTime * 8f,
                        0.7f) + 0.3f;
                    var color = spriteRenderer.color;
                    color.a = alpha;
                    spriteRenderer.color = color;
                }
                return;
            }

            switch (chargeState)
            {
                case ChargeState.Resting:
                    chargeState = ChargeState.Telegraphing;
                    timer = 1f;
                    LockChargeDirection();
                    break;
                case ChargeState.Telegraphing:
                    chargeState = ChargeState.Charging;
                    timer = 1.5f;
                    SetAlpha(1f);
                    break;
                case ChargeState.Charging:
                    chargeState = ChargeState.Recovering;
                    timer = 1f;
                    chargeVelocity = Vector3.zero;
                    break;
                default:
                    chargeState = ChargeState.Resting;
                    timer = 3f;
                    SetAlpha(1f);
                    break;
            }
        }

        private void LockChargeDirection()
        {
            var player = FindAnyObjectByType<PlayerController>();
            var direction = player == null
                ? Vector3.left
                : player.transform.position - transform.position;
            if (direction.sqrMagnitude < 0.01f)
                direction = Vector3.left;
            direction.Normalize();
            chargeVelocity =
                direction * Mathf.Max(4f, State.Definition.Speed * 0.2f);
        }

        private void SetAlpha(float alpha)
        {
            if (spriteRenderer == null)
                return;
            var color = spriteRenderer.color;
            color.a = alpha;
            spriteRenderer.color = color;
        }

        protected override void OnTriggerEnter2D(Collider2D other)
        {
            if (other.GetComponent<PlayerController>() == null)
                return;
            if (chargeState == ChargeState.Charging)
                DamagePlayer();
            else
                RequestQuiz();
        }
    }
}
