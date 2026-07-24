using System.Collections.Generic;
using NUnit.Framework;
using WordQuest.Application.Modes;
using WordQuest.Domain.Quiz;
using WordQuest.Infrastructure.Api.Dto;

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

        [TestCase("  APPLE ", "apple", true)]
        [TestCase("苹果", "苹果", true)]
        [TestCase("", "apple", false)]
        [TestCase("pear", "apple", false)]
        public void Answers_are_compared_consistently(
            string answer,
            string expected,
            bool expectedResult)
        {
            Assert.That(
                ModeAnswerPolicy.IsCorrect(answer, expected),
                Is.EqualTo(expectedResult));
        }

        [Test]
        public void Daily_challenge_requires_one_answer_per_question()
        {
            var questions = new[]
            {
                new DailyQuestionDto { wordId = "a" },
                new DailyQuestionDto { wordId = "b" }
            };
            var answers = new Dictionary<string, string>
            {
                ["a"] = "甲",
                ["b"] = " "
            };

            Assert.That(
                ModeAnswerPolicy.CanSubmitDaily(questions, answers),
                Is.False);

            answers["b"] = "乙";
            Assert.That(
                ModeAnswerPolicy.CanSubmitDaily(questions, answers),
                Is.True);
        }

        [Test]
        public void Review_answer_preserves_server_contract_fields()
        {
            var word = new WordDto
            {
                _id = "word-1",
                word = "journey",
                meaning = "旅行"
            };

            var answer = ModeAnswerPolicy.CreateReviewAnswer(
                word,
                " 旅行 ",
                1250,
                30000);

            Assert.That(answer.wordId, Is.EqualTo("word-1"));
            Assert.That(answer.playerAnswer, Is.EqualTo("旅行"));
            Assert.That(answer.answer, Is.EqualTo("旅行"));
            Assert.That(answer.isCorrect, Is.True);
            Assert.That(answer.responseTime, Is.EqualTo(1250));
            Assert.That(answer.timeLimit, Is.EqualTo(30000));
        }
    }
}
