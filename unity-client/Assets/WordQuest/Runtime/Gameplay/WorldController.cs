using System;
using System.Collections;
using UnityEngine;
using WordQuest.Content;
using WordQuest.Domain.Game;
using WordQuest.Gameplay.Boss;

namespace WordQuest.Gameplay
{
    public sealed class WorldController : MonoBehaviour
    {
        private GameObject generatedWorld;
        public Color PlayerTint { get; set; } = Color.white;
        private int remainingMonsters;
        private bool bossDefeated = true;

        public event Action<Encounter> Encountered;
        public event Action BossPlayerDamaged;
        public event Action MonsterDefeated;
        public int RemainingMonsters => remainingMonsters;
        public bool ObjectivesComplete =>
            remainingMonsters <= 0 && bossDefeated;

        public void Build(
            LevelDefinition level,
            int seed,
            Difficulty difficulty)
        {
            if (generatedWorld != null)
                Destroy(generatedWorld);

            generatedWorld = WorldGenerator.Generate(
                level,
                ChapterTheme.ForChapter(level.Chapter),
                seed,
                PlayerTint,
                difficulty);
            generatedWorld.transform.SetParent(transform, false);
            remainingMonsters = 0;
            foreach (var encounter in generatedWorld.GetComponentsInChildren<
                         EncounterController>())
            {
                encounter.Encountered += HandleEncounter;
                if (encounter.Kind == EncounterKind.Monster)
                    remainingMonsters++;
            }
            bossDefeated = level.Boss == null || level.IsTutorial;
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
            {
                if (encounter.Kind != EncounterKind.Boss)
                    encounter.SetActive(enabled);
            }
            foreach (var boss in generatedWorld.GetComponentsInChildren<
                         BossController>())
                boss.SetSimulationEnabled(enabled);
        }

        public BossController ConfigureBoss(
            LevelDefinition level,
            GameSession session)
        {
            if (generatedWorld == null ||
                level?.Boss == null ||
                level.IsTutorial)
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

            controller.Configure(
                BossState.AdjustForDifficulty(
                    level.Boss,
                    Difficulty.Parse(session.Snapshot.DifficultyId)),
                session);
            var legacyEncounter =
                bossObject.GetComponent<EncounterController>();
            legacyEncounter?.SetActive(false);
            controller.QuizRequested += _ =>
                Encountered?.Invoke(new Encounter(
                    "boss",
                    EncounterKind.Boss,
                    bossObject));
            controller.PlayerDamaged += () => BossPlayerDamaged?.Invoke();
            controller.Defeated += () => bossDefeated = true;
            return controller;
        }

        public void ResolveEncounter(Encounter encounter, bool correct)
        {
            if (encounter?.Source == null ||
                encounter.Kind == EncounterKind.Boss)
                return;

            var controller =
                encounter.Source.GetComponent<EncounterController>();
            controller?.SetActive(false);
            encounter.Source.SetActive(false);
            if (correct && encounter.Kind == EncounterKind.Monster)
            {
                remainingMonsters = Math.Max(0, remainingMonsters - 1);
                MonsterDefeated?.Invoke();
            }
            if (!correct)
                StartCoroutine(ReactivateEncounter(encounter.Source, 2f));
        }

        public void CooldownEncounter(Encounter encounter, float seconds)
        {
            if (encounter?.Source == null)
                return;
            var controller =
                encounter.Source.GetComponent<EncounterController>();
            if (controller == null)
                return;
            controller.SetActive(false);
            StartCoroutine(ReactivateController(controller, seconds));
        }

        private void HandleEncounter(Encounter encounter)
        {
            Encountered?.Invoke(encounter);
        }

        private static IEnumerator ReactivateEncounter(
            GameObject source,
            float delaySeconds)
        {
            yield return new WaitForSecondsRealtime(delaySeconds);
            if (source == null)
                yield break;

            source.SetActive(true);
            source.GetComponent<EncounterController>()?.SetActive(true);
        }

        private static IEnumerator ReactivateController(
            EncounterController controller,
            float delaySeconds)
        {
            yield return new WaitForSecondsRealtime(delaySeconds);
            if (controller != null)
                controller.SetActive(true);
        }
    }
}
