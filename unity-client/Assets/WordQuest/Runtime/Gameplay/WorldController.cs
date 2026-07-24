using System;
using UnityEngine;
using WordQuest.Content;
using WordQuest.Domain.Game;
using WordQuest.Gameplay.Boss;

namespace WordQuest.Gameplay
{
    public sealed class WorldController : MonoBehaviour
    {
        private GameObject generatedWorld;

        public event Action<Encounter> Encountered;

        public void Build(LevelDefinition level, int seed)
        {
            if (generatedWorld != null)
                Destroy(generatedWorld);

            generatedWorld = WorldGenerator.Generate(
                level,
                ChapterTheme.ForChapter(level.Chapter),
                seed);
            generatedWorld.transform.SetParent(transform, false);
            foreach (var encounter in generatedWorld.GetComponentsInChildren<
                         EncounterController>())
            {
                encounter.Encountered += HandleEncounter;
            }
        }

        public void SetSimulationEnabled(bool enabled)
        {
            if (generatedWorld == null)
                return;

            foreach (var player in generatedWorld.GetComponentsInChildren<
                         PlayerController>())
                player.MovementEnabled = enabled;
            foreach (var encounter in generatedWorld.GetComponentsInChildren<
                         EncounterController>())
                encounter.SetActive(enabled);
            foreach (var boss in generatedWorld.GetComponentsInChildren<
                         BossController>())
                boss.SetSimulationEnabled(enabled);
        }

        public BossController ConfigureBoss(
            LevelDefinition level,
            GameSession session)
        {
            if (generatedWorld == null || level?.Boss == null)
                return null;

            var bossObject = generatedWorld.transform.Find("Boss")?.gameObject;
            if (bossObject == null)
                return null;

            BossController controller;
            switch (BossState.ParseKind(level.BossType))
            {
                case BossKind.Turret:
                    controller = bossObject.AddComponent<TurretBossController>();
                    break;
                case BossKind.Charging:
                    controller =
                        bossObject.AddComponent<ChargingBossController>();
                    break;
                default:
                    controller =
                        bossObject.AddComponent<RoamingBossController>();
                    break;
            }

            controller.Configure(level.Boss, session);
            return controller;
        }

        private void HandleEncounter(Encounter encounter)
        {
            Encountered?.Invoke(encounter);
        }
    }
}
