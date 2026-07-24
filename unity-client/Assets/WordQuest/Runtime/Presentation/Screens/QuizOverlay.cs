using System;
using System.Diagnostics;
using UnityEngine.UIElements;
using WordQuest.Domain.Quiz;
using WordQuest.Gameplay;
using WordQuest.Infrastructure.Api.Dto;

namespace WordQuest.Presentation.Screens
{
    public sealed class QuizOverlay
    {
        private readonly VisualElement root;
        private readonly Stopwatch timer = new Stopwatch();
        private QuizQuestion question;
        private int timeLimitMs;
        private IVisualElementScheduledItem timerSchedule;
        private bool submitted;

        public QuizOverlay(VisualElement root)
        {
            this.root = root ?? throw new ArgumentNullException(nameof(root));
            root.style.display = DisplayStyle.None;
        }

        public event Action<QuizAnswer> Submitted;

        public void Show(QuizQuestion next, int limitMs = 30000)
        {
            question = next ?? throw new ArgumentNullException(nameof(next));
            timeLimitMs = Math.Max(1000, limitMs);
            submitted = false;
            root.style.display = DisplayStyle.Flex;
            root.Q<Label>("question-type-label").text = LabelFor(next.Type);
            root.Q<Label>("question-prompt").text = next.Prompt;
            root.Q<ProgressBar>("quiz-timer").style.display =
                DisplayStyle.Flex;
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
            timerSchedule?.Pause();
            UpdateTimer();
            timerSchedule = root.schedule.Execute(UpdateTimer).Every(100);
        }

        public void Hide()
        {
            StopTimer();
            root.style.display = DisplayStyle.None;
        }

        public void ShowCorrectFeedback(
            WordDto word,
            Action continueAction)
        {
            StopTimer();
            root.style.display = DisplayStyle.Flex;
            root.Q<Label>("question-type-label").text = "回答正确";
            root.Q<Label>("question-prompt").text =
                $"{word?.word} · {word?.meaning}";
            root.Q<ProgressBar>("quiz-timer").style.display =
                DisplayStyle.None;
            root.Q<TextField>("answer-field").style.display =
                DisplayStyle.None;
            root.Q<Button>("submit-answer-button").style.display =
                DisplayStyle.None;
            var options = root.Q<VisualElement>("option-list");
            options.Clear();
            if (!string.IsNullOrWhiteSpace(word?.example))
                options.Add(new Label($"例句：{word.example}"));
            if (!string.IsNullOrWhiteSpace(word?.exampleTranslation))
                options.Add(new Label(word.exampleTranslation));
            var next = new Button(() =>
            {
                Hide();
                continueAction?.Invoke();
            })
            {
                text = "继续冒险"
            };
            next.AddToClassList("primary-button");
            options.Add(next);
            next.Focus();
        }

        private void SubmitText()
        {
            Submit(root.Q<TextField>("answer-field").value);
        }

        private void Submit(string value)
        {
            if (submitted)
                return;
            submitted = true;
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

        private void UpdateTimer()
        {
            if (submitted)
                return;
            var remaining = Math.Max(
                0d,
                1d - timer.ElapsedMilliseconds / (double)timeLimitMs);
            var progress = root.Q<ProgressBar>("quiz-timer");
            progress.value = (float)(remaining * 100d);
            progress.title =
                $"剩余 {Math.Ceiling(remaining * timeLimitMs / 1000d)} 秒";
            if (remaining <= 0d)
                Submit(string.Empty);
        }

        private void StopTimer()
        {
            timer.Stop();
            timerSchedule?.Pause();
            timerSchedule = null;
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
