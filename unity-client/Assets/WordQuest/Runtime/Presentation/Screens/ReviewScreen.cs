using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Threading;
using UnityEngine.UIElements;
using WordQuest.Application.Modes;
using WordQuest.Application.Quiz;
using WordQuest.Domain.Quiz;
using WordQuest.Infrastructure.Api.Dto;

namespace WordQuest.Presentation.Screens
{
    public sealed class ReviewScreen
    {
        private const int TimeLimitMs = 30000;
        private readonly VisualElement view;
        private readonly ReviewModeController controller;
        private readonly CancellationToken token;
        private readonly List<WordDto> words = new List<WordDto>();
        private readonly List<ReviewAnswerDto> answers =
            new List<ReviewAnswerDto>();
        private readonly Stopwatch timer = new Stopwatch();
        private string sessionId;
        private int currentIndex;
        private int correctCount;
        private bool answering;
        private bool submitting;

        public ReviewScreen(
            VisualElement view,
            ReviewModeController controller,
            CancellationToken token)
        {
            this.view = view ?? throw new ArgumentNullException(nameof(view));
            this.controller = controller ??
                              throw new ArgumentNullException(nameof(controller));
            this.token = token;
            view.Q<Button>("start-review-button").clicked += Load;
        }

        private async void Load()
        {
            var button = view.Q<Button>("start-review-button");
            var host = view.Q<VisualElement>("review-question-host");
            button.SetEnabled(false);
            host.Clear();
            host.Add(new Label("正在根据掌握度创建复习队列…"));
            Status(string.Empty);

            var result = await controller.CreateAsync(20, token);
            if (!result.IsSuccess)
            {
                host.Clear();
                host.Add(new Label(result.Message));
                button.SetEnabled(true);
                return;
            }

            sessionId = result.Data.sessionId;
            words.Clear();
            words.AddRange(result.Data.words ?? Array.Empty<WordDto>());
            answers.Clear();
            currentIndex = 0;
            correctCount = 0;
            submitting = false;

            if (words.Count == 0)
            {
                host.Clear();
                host.Add(new Label("今天没有到期的复习词，继续保持！"));
                Status("复习计划已完成");
                button.text = "重新检查";
                button.SetEnabled(true);
                return;
            }

            button.style.display = DisplayStyle.None;
            RenderQuestion();
        }

        private void RenderQuestion()
        {
            answering = true;
            var word = words[currentIndex];
            var question = QuizFactory.Create(
                word,
                QuestionType.ChoiceEnglishToChinese,
                words);
            var host = view.Q<VisualElement>("review-question-host");
            host.Clear();
            host.Add(new Label(
                $"第 {currentIndex + 1}/{words.Count} 题 · {word.word} {word.phonetic}")
            {
                name = "review-question-title"
            });
            host.Q<Label>("review-question-title")
                .AddToClassList("question-title");

            if (question.Options.Count == 0)
            {
                host.Q<Label>("review-question-title").text = $"第 {currentIndex + 1}/{words.Count} 题 · 写出 {word.word} 的中文释义";
                var input = new TextField("中文释义") { name = "review-answer-field" };
                host.Add(input);
                host.Add(new Button(() => Answer(input.value)) { text = "提交释义" });
                input.Focus();
            }
            foreach (var option in question.Options)
            {
                var captured = option.Text;
                var choice = new Button(() => Answer(captured))
                {
                    text = captured
                };
                choice.AddToClassList("quiz-option");
                host.Add(choice);
            }

            Status($"已答 {answers.Count} 题 · 正确 {correctCount} 题");
            timer.Restart();
        }

        private void Answer(string value)
        {
            if (!answering || submitting)
                return;

            answering = false;
            timer.Stop();
            var word = words[currentIndex];
            var answer = ModeAnswerPolicy.CreateReviewAnswer(
                word,
                value,
                (int)timer.ElapsedMilliseconds,
                TimeLimitMs);
            answers.Add(answer);
            if (answer.isCorrect)
                correctCount++;

            var host = view.Q<VisualElement>("review-question-host");
            host.Clear();
            var feedback = new Label(
                answer.isCorrect
                    ? $"回答正确 · {word.example}"
                    : $"回答错误 · 正确释义：{word.meaning}");
            feedback.AddToClassList(
                answer.isCorrect
                    ? "mode-feedback-correct"
                    : "mode-feedback-wrong");
            host.Add(feedback);

            var last = currentIndex >= words.Count - 1;
            var next = new Button(last ? (Action)Submit : Next)
            {
                text = last ? "完成并提交复习" : "继续下一词"
            };
            next.AddToClassList("primary-button");
            host.Add(next);
            Status($"已答 {answers.Count}/{words.Count} · 正确 {correctCount}");
        }

        private void Next()
        {
            if (currentIndex >= words.Count - 1)
                return;
            currentIndex++;
            RenderQuestion();
        }

        private async void Submit()
        {
            if (submitting || string.IsNullOrWhiteSpace(sessionId))
                return;

            submitting = true;
            var host = view.Q<VisualElement>("review-question-host");
            host.Clear();
            host.Add(new Label("正在提交复习结果并更新掌握度…"));
            var result = await controller.SubmitAsync(
                sessionId,
                answers,
                token);
            host.Clear();

            if (result.IsSuccess)
            {
                var accuracy = answers.Count == 0
                    ? 0
                    : (int)Math.Round(correctCount * 100d / answers.Count);
                host.Add(new Label(
                    $"复习完成\n正确率 {accuracy}% · 更新掌握度 {result.Data.masteryUpdated} 个词"));
                Status("结果已同步，复习计划已刷新。");
                return;
            }

            host.Add(new Label(result.Message));
            if (result.StatusCode == 0)
            {
                submitting = false;
                var retry = new Button(Submit) { text = "重新提交" };
                retry.AddToClassList("primary-button");
                host.Add(retry);
            }
            Status("复习结果尚未同步");
        }

        private void Status(string text)
        {
            view.Q<Label>("review-status-label").text = text;
        }
    }
}
