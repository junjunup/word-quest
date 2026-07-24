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
        private float timer = 1.5f;

        private void Update()
        {
            if (!SimulationEnabled || State == null)
                return;

            timer -= Time.deltaTime;
            if (timer > 0f)
            {
                if (chargeState == ChargeState.Charging)
                {
                    transform.position += Vector3.left *
                                          (State.Definition.Speed * 0.02f *
                                           Time.deltaTime);
                }
                return;
            }

            switch (chargeState)
            {
                case ChargeState.Resting:
                    chargeState = ChargeState.Telegraphing;
                    timer = 0.8f;
                    break;
                case ChargeState.Telegraphing:
                    chargeState = ChargeState.Charging;
                    timer = 0.6f;
                    break;
                case ChargeState.Charging:
                    chargeState = ChargeState.Recovering;
                    timer = 1f;
                    break;
                default:
                    chargeState = ChargeState.Resting;
                    timer = 1.5f;
                    break;
            }
        }
    }
}
