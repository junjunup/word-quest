using System;
using System.Diagnostics;
using System.Threading.Tasks;
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
        public event Action Skipped;

        public void Show(QuizQuestion next, int limitMs = 30000)
        {
            question = next ?? throw new ArgumentNullException(nameof(next));
            timeLimitMs = limitMs <= 0 ? 0 : Math.Max(1000, limitMs);
            submitted = false;
            root.style.display = DisplayStyle.Flex;
            root.Q<Label>("question-type-label").text = LabelFor(next.Type);
            root.Q<Label>("question-prompt").text = next.Prompt;
            root.Q<ProgressBar>("quiz-timer").style.display =
                timeLimitMs > 0 ? DisplayStyle.Flex : DisplayStyle.None;
            var options = root.Q<VisualElement>("option-list");
            var input = root.Q<TextField>("answer-field");
            var submit = root.Q<Button>("submit-answer-button");
            var skip = root.Q<Button>("skip-encounter-button");
            if (skip != null)
            {
                skip.style.display = limitMs <= 0 ? DisplayStyle.Flex : DisplayStyle.None;
                skip.clicked -= Skip;
                skip.clicked += Skip;
            }
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

        public void SetFocus(bool focused)
        {
            if (!focused) timer.Stop();
            else if (!submitted && root.style.display == DisplayStyle.Flex)
            {
                timer.Start();
                if (question?.Options.Count == 0) root.Q<TextField>("answer-field").Focus();
            }
        }

        public void ShowLoading(Action cancel, string message = "正在准备题目…")
        {
            Feedback(message, "战场已暂停");
            root.Q<VisualElement>("option-list").Add(new Button(() => { Hide(); cancel(); }) { text = "取消并返回" });
        }

        public void Hide()
        {
            StopTimer();
            root.style.display = DisplayStyle.None;
        }

        private void Skip() { Hide(); Skipped?.Invoke(); }

        public void ShowSaveFailure(string message, Action retry, Action leave, string leaveLabel = "稍后复习")
        {
            Feedback(message, "本题尚未计入成绩");
            var options = root.Q<VisualElement>("option-list");
            options.Add(new Button(() => { Hide(); retry(); }) { text = "重试保存" });
            options.Add(new Button(() => { Hide(); leave(); }) { text = leaveLabel });
        }

        public void ShowWrongFeedback(WordDto word, Func<string, Task<bool>> complete, Action leave)
        {
            Feedback("先看讲解，再巩固一次", $"{word?.word} · {word?.meaning}");
            var options = root.Q<VisualElement>("option-list");
            if (!string.IsNullOrWhiteSpace(word?.example)) options.Add(new Label(word.example));
            if (!string.IsNullOrWhiteSpace(word?.exampleTranslation)) options.Add(new Label(word.exampleTranslation));
            options.Add(new Label("首答已记为待巩固。纠正不增加首答正确数或游戏分。"));
            var correction = new TextField("再拼写一次") { name = "correction-answer" };
            options.Add(correction);
            var submit = new Button { name = "correction-submit", text = "完成纠正" };
            var attempted = false;
            var saving = false;
            submit.clicked += async () =>
            {
                if (attempted) return;
                attempted = true;
                saving = true;
                submit.SetEnabled(false);
                correction.SetEnabled(false);
                try
                {
                    if (await complete(correction.value?.Trim() ?? string.Empty)) Hide();
                    else options.Add(new Label($"再记一次：{word?.word}。可以选择稍后复习。"));
                }
                catch (Exception)
                {
                    attempted = false;
                    submit.SetEnabled(true);
                    submit.text = "重试保存纠正";
                    options.Add(new Label("纠正暂未保存，重试会保留同一次答案。"));
                }
                finally { saving = false; }
            };
            options.Add(submit);
            options.Add(new Button(() => { if (!saving) { Hide(); leave(); } }) { name = "correction-later", text = "稍后复习" });
            correction.Focus();
        }

        private void Feedback(string heading, string prompt)
        {
            StopTimer();
            root.style.display = DisplayStyle.Flex;
            root.Q<Label>("question-type-label").text = heading;
            root.Q<Label>("question-prompt").text = prompt;
            root.Q<ProgressBar>("quiz-timer").style.display = DisplayStyle.None;
            root.Q<TextField>("answer-field").style.display = DisplayStyle.None;
            root.Q<Button>("submit-answer-button").style.display = DisplayStyle.None;
            var skip = root.Q<Button>("skip-encounter-button");
            if (skip != null) skip.style.display = DisplayStyle.None;
            root.Q<VisualElement>("option-list").Clear();
        }

        public void ShowCorrectFeedback(
            WordDto word,
            Action continueAction)
        {
            StopTimer();
            var skip = root.Q<Button>("skip-encounter-button");
            if (skip != null) skip.style.display = DisplayStyle.None;
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
            var answer = new QuizAnswer
            {
                Value = normalized,
                Correct = correct,
                ResponseMs = (int)timer.ElapsedMilliseconds,
                Type = question.Type,
                HintUsed = question.Type == QuestionType.SpellHint,
                ScoreRatio = correct ? 1d : 0d
            };
            Hide();
            Submitted?.Invoke(answer);
        }

        private void UpdateTimer()
        {
            if (submitted || timeLimitMs <= 0)
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
