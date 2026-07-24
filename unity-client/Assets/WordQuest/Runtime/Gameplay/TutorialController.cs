using System;
using WordQuest.Infrastructure.Storage;

namespace WordQuest.Gameplay
{
    public enum TutorialStep
    {
        Move,
        Interact,
        Answer,
        Complete
    }

    public sealed class TutorialController
    {
        private const string SkipKey = "wordquest:skipIntro";
        private readonly IKeyValueStore store;

        public TutorialController(IKeyValueStore store)
        {
            this.store = store ?? throw new ArgumentNullException(nameof(store));
        }

        public TutorialStep Step { get; private set; } = TutorialStep.Move;
        public bool ShouldRun =>
            !string.Equals(
                store.GetString(SkipKey, "false"),
                "true",
                StringComparison.OrdinalIgnoreCase);

        public event Action<TutorialStep> StepChanged;

        public void MovementObserved()
        {
            Advance(TutorialStep.Move, TutorialStep.Interact);
        }

        public void InteractionObserved()
        {
            Advance(TutorialStep.Interact, TutorialStep.Answer);
        }

        public void AnswerObserved()
        {
            Advance(TutorialStep.Answer, TutorialStep.Complete);
            if (Step == TutorialStep.Complete)
            {
                store.SetString(SkipKey, "true");
                store.Save();
            }
        }

        public void Skip()
        {
            Step = TutorialStep.Complete;
            store.SetString(SkipKey, "true");
            store.Save();
            StepChanged?.Invoke(Step);
        }

        private void Advance(TutorialStep expected, TutorialStep next)
        {
            if (Step != expected)
                return;
            Step = next;
            StepChanged?.Invoke(Step);
        }
    }
}
