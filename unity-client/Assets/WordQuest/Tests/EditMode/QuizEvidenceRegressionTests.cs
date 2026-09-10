using System;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.UIElements;
using WordQuest.Application.Quiz;
using WordQuest.Domain.Quiz;
using WordQuest.Infrastructure.Api.Dto;
using WordQuest.Presentation.Screens;

namespace WordQuest.Tests
{
    public sealed class QuizEvidenceRegressionTests
    {
        [Test]
        public void Insufficient_pool_uses_spelling_instead_of_invented_options()
        {
            var word = new WordDto { _id = "1", word = "river", meaning = "河流" };
            var question = QuizFactory.Create(word,
                QuestionType.ChoiceEnglishToChinese, new[] { word });
            Assert.That(question.Type, Is.EqualTo(QuestionType.SpellFull));
            Assert.That(question.Options, Is.Empty);
            Assert.That(question.Prompt, Does.Not.Contain(word.word));
        }

        [Test]
        public void Real_server_object_distractors_build_four_options()
        {
            var response = JsonUtility.FromJson<QuizDto>("{\"question\":{\"_id\":\"1\",\"word\":\"river\",\"meaning\":\"河流\"},\"distractors\":[{\"word\":\"garden\",\"meaning\":\"花园\"},{\"word\":\"bridge\",\"meaning\":\"桥梁\"},{\"word\":\"apple\",\"meaning\":\"苹果\"}]}");
            var question = QuizFactory.FromServer(response.question, QuestionType.ChoiceEnglishToChinese, response);
            Assert.That(question.Type, Is.EqualTo(QuestionType.ChoiceEnglishToChinese));
            Assert.That(question.Options.Count, Is.EqualTo(4));
        }

        [Test]
        public void Untimed_quiz_hides_failure_countdown()
        {
            var root = Resources.Load<VisualTreeAsset>("UI/Screens/Game").CloneTree();
            var view = root.Q<VisualElement>("quiz-overlay");
            var quiz = new QuizOverlay(view);
            quiz.Show(new QuizQuestion("1", QuestionType.SpellFull, "河流",
                "river", Array.Empty<QuizOption>()), 0);
            Assert.That(view.Q<ProgressBar>("quiz-timer").style.display.value,
                Is.EqualTo(DisplayStyle.None));
            quiz.Hide();
        }
    }
}
