using System;

namespace WordQuest.Domain.Game
{
    public static class ScoringPolicy
    {
        public static int Calculate(
            bool correct,
            int responseMs,
            int combo,
            int difficulty,
            bool hintUsed,
            double scoreRatio)
        {
            if (!correct)
                return 0;

            var safeDifficulty = Math.Max(1, Math.Min(difficulty, 10));
            var safeCombo = Math.Max(0, combo);
            var safeTime = Math.Max(0, responseMs);
            var ratio = Math.Max(0d, Math.Min(scoreRatio, 1d));
            var baseScore = 100 * safeDifficulty;

            if (hintUsed)
                baseScore = (int)Math.Floor(baseScore * 0.5d);

            var comboBonus = Math.Min(safeCombo * 10, 50);
            var timeBonus = safeTime < 3000
                ? 50
                : safeTime < 5000
                    ? 30
                    : safeTime < 10000
                        ? 15
                        : 0;

            return (int)Math.Round(
                (baseScore + comboBonus + timeBonus) * ratio,
                MidpointRounding.AwayFromZero);
        }

        public static int ApplyDifficulty(int score, Difficulty difficulty)
        {
            if (difficulty == null)
                throw new ArgumentNullException(nameof(difficulty));

            return (int)Math.Round(
                Math.Max(0, score) * difficulty.ScoreMultiplier,
                MidpointRounding.AwayFromZero);
        }
    }
}
