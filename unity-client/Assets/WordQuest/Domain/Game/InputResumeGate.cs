namespace WordQuest.Domain.Game
{
    public sealed class InputResumeGate
    {
        private bool waiting;
        public void RequireNeutral() { waiting = true; }
        public bool Accept(bool hasInput)
        {
            if (!waiting) return true;
            if (!hasInput) waiting = false;
            return false;
        }
    }
}
