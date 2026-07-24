using System.Collections.Generic;
using System.Linq;
using NUnit.Framework;
using WordQuest.Application.Quiz;
using WordQuest.Domain.Quiz;
using WordQuest.Infrastructure.Api.Dto;

namespace WordQuest.Tests
{
    public sealed class QuizFactoryTests
    {
        [TestCase(QuestionType.ChoiceEnglishToChinese)]
        [TestCase(QuestionType.ChoiceChineseToEnglish)]
        public void Choice_questions_have_four_unique_non_empty_options(
            QuestionType type)
        {
            var pool = Pool();
            var question = QuizFactory.Create(pool[0], type, pool);

            Assert.That(question.Options, Has.Count.EqualTo(4));
            Assert.That(
                question.Options.Select(option => option.Text).Distinct(),
                Has.Count.EqualTo(4));
            Assert.That(
                question.Options.All(option =>
                    !string.IsNullOrWhiteSpace(option.Text)),
                Is.True);
            Assert.That(
                question.Options.Count(option =>
                    option.Text == question.CorrectAnswer),
                Is.EqualTo(1));
        }

        [TestCase(QuestionType.SpellHint)]
        [TestCase(QuestionType.SpellFull)]
        [TestCase(QuestionType.Translate)]
        public void Text_questions_keep_the_server_word_as_answer(
            QuestionType type)
        {
            var pool = Pool();

            var question = QuizFactory.Create(pool[0], type, pool);

            Assert.That(question.CorrectAnswer, Is.EqualTo(pool[0].word));
            Assert.That(question.Options, Is.Empty);
        }

        [TestCase(0, QuestionType.ChoiceEnglishToChinese)]
        [TestCase(1, QuestionType.ChoiceChineseToEnglish)]
        [TestCase(2, QuestionType.SpellHint)]
        [TestCase(3, QuestionType.SpellFull)]
        [TestCase(4, QuestionType.Translate)]
        public void Mainline_rotation_exercises_all_legacy_question_types(
            int answered,
            QuestionType expected)
        {
            Assert.That(
                QuizRotation.ForAnsweredCount(answered),
                Is.EqualTo(expected));
        }

        private static List<WordDto> Pool()
        {
            return new List<WordDto>
            {
                new WordDto { _id = "1", word = "apple", meaning = "苹果" },
                new WordDto { _id = "2", word = "river", meaning = "河流" },
                new WordDto { _id = "3", word = "bright", meaning = "明亮的" },
                new WordDto { _id = "4", word = "future", meaning = "未来" },
                new WordDto { _id = "5", word = "learn", meaning = "学习" }
            };
        }
    }
}
