using NUnit.Framework;
using WordQuest.Domain.Game;

namespace WordQuest.Tests
{
    public sealed class ScoringPolicyTests
    {
        [TestCase(true, 2500, 0, 1, false, 1d, 150)]
        [TestCase(true, 4000, 2, 1, false, 1d, 150)]
        [TestCase(true, 12000, 9, 2, false, 1d, 250)]
        [TestCase(true, 2500, 0, 1, true, 1d, 100)]
        [TestCase(false, 1000, 10, 5, false, 1d, 0)]
        public void Calculate_matches_web_scoring(
            bool correct,
            int responseMs,
            int combo,
            int difficulty,
            bool hintUsed,
            double scoreRatio,
            int expected)
        {
            Assert.That(
                ScoringPolicy.Calculate(
                    correct,
                    responseMs,
                    combo,
                    difficulty,
                    hintUsed,
                    scoreRatio),
                Is.EqualTo(expected));
        }

        [TestCase(DifficultyKind.Easy, 100, 80)]
        [TestCase(DifficultyKind.Normal, 100, 100)]
        [TestCase(DifficultyKind.Hard, 100, 150)]
        public void Selected_difficulty_multiplier_matches_web_client(
            DifficultyKind difficulty,
            int score,
            int expected)
        {
            Assert.That(
                ScoringPolicy.ApplyDifficulty(
                    score,
                    Difficulty.For(difficulty)),
                Is.EqualTo(expected));
        }
    }
}
