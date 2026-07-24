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

        public event Action<Encounter> Encountered;

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
            if (!active || other.GetComponent<PlayerController>() == null)
                return;

            Encountered?.Invoke(new Encounter(encounterId, kind, gameObject));
        }
    }
}
