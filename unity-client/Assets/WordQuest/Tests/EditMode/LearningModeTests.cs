using NUnit.Framework;
using WordQuest.Application.Modes;
using WordQuest.Domain.Quiz;

namespace WordQuest.Tests
{
    public sealed class LearningModeTests
    {
        [TestCase(0, 1, 30000, QuestionType.ChoiceEnglishToChinese)]
        [TestCase(5, 2, 26000, QuestionType.ChoiceEnglishToChinese)]
        [TestCase(10, 3, 22000, QuestionType.SpellFull)]
        [TestCase(20, 4, 18000, QuestionType.SpellFull)]
        [TestCase(30, 5, 14000, QuestionType.SpellFull)]
        public void Endless_thresholds_match_legacy_mode(
            int streak,
            int expectedDifficulty,
            int expectedTimeMs,
            QuestionType expectedType)
        {
            var round = EndlessModeController.RoundForStreak(streak);

            Assert.That(round.Difficulty, Is.EqualTo(expectedDifficulty));
            Assert.That(round.TimeLimitMs, Is.EqualTo(expectedTimeMs));
            Assert.That(round.QuestionType, Is.EqualTo(expectedType));
        }
    }
}
