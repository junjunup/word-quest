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
        public Color PlayerTint { get; set; } = Color.white;
        private int remainingMonsters;
        private bool bossDefeated = true;
        private bool simulationEnabled = true;
        private float protectedUntil;
        private EncounterController[] encounters = Array.Empty<EncounterController>();
        private PlayerController player;

        public event Action PlayerMoved;
        private Vector3 observedPosition;
        public bool IsProtected => Time.unscaledTime < protectedUntil;

        private void Update()
        {
            if (player == null || !simulationEnabled)
                return;
            if (Vector3.Distance(observedPosition, player.transform.position) > 0.05f)
            { observedPosition = player.transform.position; PlayerMoved?.Invoke(); }
            EncounterController nearest = null;
            var nearestDistance = float.MaxValue;
            foreach (var candidate in encounters)
            {
                if (candidate == null) continue;
                candidate.ObservePlayer(player.transform.position);
                if (IsProtected || candidate.Kind != EncounterKind.Monster ||
                    !candidate.IsAvailable) continue;
                var distance = Vector2.Distance(player.transform.position, candidate.transform.position);
                if (distance > 1.5f || !HasLineOfSight(candidate)) continue;
                if (distance < nearestDistance ||
                    (Mathf.Approximately(distance, nearestDistance) &&
                     string.CompareOrdinal(candidate.Id, nearest?.Id) < 0))
                {
                    nearest = candidate;
                    nearestDistance = distance;
                }
            }
            if (nearest != null)
                HandleEncounter(new Encounter(nearest.Id, nearest.Kind, nearest.gameObject));
        }

        private bool HasLineOfSight(EncounterController candidate)
        {
            foreach (var hit in Physics2D.LinecastAll(player.transform.position, candidate.transform.position))
            {
                if (hit.collider == null || hit.collider.isTrigger ||
                    hit.collider.GetComponent<PlayerController>() != null) continue;
                return false;
            }
            return true;
        }

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
            player = generatedWorld.GetComponentInChildren<PlayerController>();
            observedPosition = player.transform.position;
            encounters = generatedWorld.GetComponentsInChildren<EncounterController>();
            simulationEnabled = true;
            protectedUntil = 0;
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
            simulationEnabled = enabled;
            if (generatedWorld == null)
                return;

            foreach (var player in generatedWorld.GetComponentsInChildren<
                         PlayerController>())
                player.MovementEnabled = enabled;
            foreach (var encounter in generatedWorld.GetComponentsInChildren<
                         EncounterController>())
            {
                if (encounter.Kind != EncounterKind.Boss)
                    encounter.SetSimulationEnabled(enabled);
            }
            foreach (var boss in generatedWorld.GetComponentsInChildren<
                         BossController>())
                boss.SetSimulationEnabled(enabled);
            foreach (var animation in generatedWorld.GetComponentsInChildren<SpriteAnimationController>())
                animation.enabled = enabled;
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
                HandleEncounter(new Encounter(
                    "boss",
                    EncounterKind.Boss,
                    bossObject));
            controller.PlayerDamaged += () =>
            {
                if (simulationEnabled && !IsProtected) BossPlayerDamaged?.Invoke();
            };
            controller.Defeated += () => bossDefeated = true;
            return controller;
        }

        public void ResolveEncounter(Encounter encounter, bool correct)
        {
            if (encounter?.Source == null ||
                encounter.Kind == EncounterKind.Boss)
                return;

            if (!correct)
            {
                CooldownEncounter(encounter, 1.5f);
                return;
            }
            if (!encounter.Source.activeSelf) return;
            protectedUntil = Time.unscaledTime + 1.5f;
            var controller =
                encounter.Source.GetComponent<EncounterController>();
            controller?.SetActive(false);
            encounter.Source.SetActive(false);
            if (correct && encounter.Kind == EncounterKind.Monster)
            {
                remainingMonsters = Math.Max(0, remainingMonsters - 1);
                MonsterDefeated?.Invoke();
            }
        }

        public void CooldownEncounter(Encounter encounter, float seconds)
        {
            if (encounter?.Source == null)
                return;
            var controller =
                encounter.Source.GetComponent<EncounterController>();
            if (controller == null)
                return;
            controller.Suppress(seconds);
            protectedUntil = Time.unscaledTime + Mathf.Max(0, seconds);
        }

        private void HandleEncounter(Encounter encounter)
        {
            if (!simulationEnabled || IsProtected) return;
            SetSimulationEnabled(false);
            Encountered?.Invoke(encounter);
        }

    }
}
