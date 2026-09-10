using System;
using UnityEngine;

namespace WordQuest.Gameplay
{
    public enum EncounterKind
    {
        Monster,
        Npc,
        Boss
    }

    public sealed class Encounter
    {
        public Encounter(
            string id,
            EncounterKind kind,
            GameObject source)
        {
            Id = id;
            Kind = kind;
            Source = source;
        }

        public string Id { get; }
        public EncounterKind Kind { get; }
        public GameObject Source { get; }
    }

    [RequireComponent(typeof(Collider2D))]
    public sealed class EncounterController : MonoBehaviour
    {
        [SerializeField] private string encounterId;
        [SerializeField] private EncounterKind kind;
        private bool active = true;
        private bool simulationEnabled = true;
        private bool mustLeave;
        private float cooldownUntil;

        public event Action<Encounter> Encountered;
        public EncounterKind Kind => kind;
        public string Id => encounterId;
        public bool IsAvailable => active && simulationEnabled &&
            !mustLeave && Time.unscaledTime >= cooldownUntil && gameObject.activeInHierarchy;

        public void SetSimulationEnabled(bool value) { simulationEnabled = value; }

        public void Suppress(float seconds)
        {
            cooldownUntil = Time.unscaledTime + Mathf.Max(0, seconds);
            mustLeave = true;
        }

        public void ObservePlayer(Vector2 position)
        {
            if (Vector2.Distance(position, transform.position) > 2f)
                mustLeave = false;
        }

        public void Configure(string id, EncounterKind encounterKind)
        {
            encounterId = id;
            kind = encounterKind;
            GetComponent<Collider2D>().isTrigger = true;
        }

        public void SetActive(bool value)
        {
            active = value;
        }

        private void OnTriggerEnter2D(Collider2D other)
        {
            // Ordinary monsters are selected centrally by distance and visibility.
            if (kind == EncounterKind.Monster || !IsAvailable ||
                other.GetComponent<PlayerController>() == null)
                return;

            Encountered?.Invoke(new Encounter(encounterId, kind, gameObject));
        }
    }
}
