using System;
using UnityEngine;
using WordQuest.Content;
using WordQuest.Domain.Game;

namespace WordQuest.Gameplay.Boss
{
    public enum BossKind
    {
        Roaming,
        Turret,
        Charging
    }

    public sealed class BossEncounter
    {
        public BossEncounter(BossController controller, int hitPoints)
        {
            Controller = controller;
            HitPoints = hitPoints;
        }

        public BossController Controller { get; }
        public int HitPoints { get; }
    }

    public sealed class BossState
    {
        private readonly GameSession session;

        public BossState(BossDefinition definition, GameSession session)
        {
            Definition = definition ??
                         throw new ArgumentNullException(nameof(definition));
            this.session = session ??
                           throw new ArgumentNullException(nameof(session));
            HitPoints = definition.BaseHitPoints;
        }

        public BossDefinition Definition { get; }
        public int HitPoints { get; private set; }
        public bool Defeated => HitPoints <= 0;

        public bool ApplyQuizResult(bool correct)
        {
            if (Defeated || !correct)
                return Defeated;

            HitPoints = Math.Max(0, HitPoints - 1);
            if (!Defeated)
                return false;

            session.MarkBossDefeated();
            session.AddBonusScore(
                ScoringPolicy.ApplyDifficulty(
                    500,
                    Difficulty.Parse(session.Snapshot.DifficultyId)));
            return true;
        }

        public static BossKind ParseKind(string value)
        {
            if (string.Equals(
                    value,
                    "turret",
                    StringComparison.OrdinalIgnoreCase))
                return BossKind.Turret;
            if (string.Equals(
                    value,
                    "charging",
                    StringComparison.OrdinalIgnoreCase))
                return BossKind.Charging;
            return BossKind.Roaming;
        }

        public static BossDefinition AdjustForDifficulty(
            BossDefinition definition,
            Difficulty difficulty)
        {
            if (definition == null)
                throw new ArgumentNullException(nameof(definition));
            difficulty = difficulty ??
                         Difficulty.For(DifficultyKind.Normal);
            var hitPoints = definition.BaseHitPoints;
            if (difficulty.Kind == DifficultyKind.Easy)
                hitPoints = Math.Max(2, hitPoints - 1);
            else if (difficulty.Kind == DifficultyKind.Hard)
                hitPoints += 2;
            return new BossDefinition(
                definition.Name,
                hitPoints,
                definition.Speed);
        }
    }

    [RequireComponent(typeof(Collider2D))]
    public class BossController : MonoBehaviour
    {
        protected BossState State { get; private set; }
        protected bool SimulationEnabled { get; private set; } = true;
        private float invulnerableUntil;

        public event Action<BossEncounter> QuizRequested;
        public event Action Defeated;
        public event Action PlayerDamaged;
        public int CurrentHitPoints => State?.HitPoints ?? 0;
        public int MaximumHitPoints =>
            State?.Definition.BaseHitPoints ?? 0;
        internal bool IsSimulationActive => SimulationEnabled;

        public virtual void Configure(
            BossDefinition definition,
            GameSession session)
        {
            State = new BossState(definition, session);
            GetComponent<Collider2D>().isTrigger = true;
        }

        public void SetSimulationEnabled(bool enabled)
        {
            SimulationEnabled = enabled;
        }

        public void SubmitQuizResult(bool correct)
        {
            if (State == null)
                return;
            if (State.ApplyQuizResult(correct))
            {
                Defeated?.Invoke();
                gameObject.SetActive(false);
            }
        }

        protected void RequestQuiz()
        {
            if (SimulationEnabled && State != null && !State.Defeated)
                QuizRequested?.Invoke(new BossEncounter(this, State.HitPoints));
        }

        protected void DamagePlayer()
        {
            if (!SimulationEnabled || Time.unscaledTime < invulnerableUntil)
                return;
            invulnerableUntil = Time.unscaledTime + 1.25f;
            PlayerDamaged?.Invoke();
        }

        internal void NotifyProjectileHit()
        {
            DamagePlayer();
        }

        protected virtual void OnTriggerEnter2D(Collider2D other)
        {
            if (other.GetComponent<PlayerController>() != null)
                RequestQuiz();
        }
    }
}
