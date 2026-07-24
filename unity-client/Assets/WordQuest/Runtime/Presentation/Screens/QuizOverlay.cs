using System;
using System.Diagnostics;
using UnityEngine.UIElements;
using WordQuest.Domain.Quiz;
using WordQuest.Gameplay;

namespace WordQuest.Presentation.Screens
{
    public sealed class QuizOverlay
    {
        private readonly VisualElement root;
        private readonly Stopwatch timer = new Stopwatch();
        private QuizQuestion question;

        public QuizOverlay(VisualElement root)
        {
            this.root = root ?? throw new ArgumentNullException(nameof(root));
            root.style.display = DisplayStyle.None;
        }

        public event Action<QuizAnswer> Submitted;

        public void Show(QuizQuestion next)
        {
            question = next ?? throw new ArgumentNullException(nameof(next));
            root.style.display = DisplayStyle.Flex;
            root.Q<Label>("question-type-label").text = LabelFor(next.Type);
            root.Q<Label>("question-prompt").text = next.Prompt;
            var options = root.Q<VisualElement>("option-list");
            var input = root.Q<TextField>("answer-field");
            var submit = root.Q<Button>("submit-answer-button");
            options.Clear();

            if (next.Options.Count > 0)
            {
                input.style.display = DisplayStyle.None;
                submit.style.display = DisplayStyle.None;
                foreach (var option in next.Options)
                {
                    var captured = option;
                    var button = new Button(() => Submit(captured.Text))
                    {
                        text = option.Text
                    };
                    button.AddToClassList("quiz-option");
                    options.Add(button);
                }
            }
            else
            {
                input.value = string.Empty;
                input.style.display = DisplayStyle.Flex;
                submit.style.display = DisplayStyle.Flex;
                submit.clicked -= SubmitText;
                submit.clicked += SubmitText;
                input.Focus();
            }

            timer.Restart();
        }

        public void Hide()
        {
            timer.Stop();
            root.style.display = DisplayStyle.None;
        }

        private void SubmitText()
        {
            Submit(root.Q<TextField>("answer-field").value);
        }

        private void Submit(string value)
        {
            timer.Stop();
            var normalized = value?.Trim() ?? string.Empty;
            var correct = string.Equals(
                normalized,
                question.CorrectAnswer?.Trim(),
                StringComparison.OrdinalIgnoreCase);
            Submitted?.Invoke(new QuizAnswer
            {
                Value = normalized,
                Correct = correct,
                ResponseMs = (int)timer.ElapsedMilliseconds,
                Type = question.Type,
                ScoreRatio = correct ? 1d : 0d
            });
            Hide();
        }

        private static string LabelFor(QuestionType type)
        {
            switch (type)
            {
                case QuestionType.ChoiceChineseToEnglish: return "中译英选择";
                case QuestionType.SpellHint: return "提示拼写";
                case QuestionType.SpellFull: return "完整拼写";
                case QuestionType.Translate: return "例句翻译";
                case QuestionType.Pronunciation: return "发音练习";
                default: return "英译中选择";
            }
        }
    }
}
