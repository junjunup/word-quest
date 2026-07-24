using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Threading;
using UnityEngine.UIElements;
using WordQuest.Application.Modes;
using WordQuest.Application.Quiz;
using WordQuest.Content;
using WordQuest.Domain.Quiz;
using WordQuest.Infrastructure.Api.Dto;
using WordQuest.Infrastructure.Api.Services;

namespace WordQuest.Presentation.Screens
{
    public sealed class EndlessScreen
    {
        private readonly VisualElement view;
        private readonly EndlessModeController controller;
        private readonly IVocabularyService vocabulary;
        private readonly ContentCatalog content;
        private readonly string wordbookId;
        private readonly CancellationToken token;
        private readonly List<WordDto> words = new List<WordDto>();
        private readonly Stopwatch questionTimer = new Stopwatch();
        private IVisualElementScheduledItem timerSchedule;
        private EndlessRound round;
        private WordDto currentWord;
        private bool answered;
        private bool finishing;

        public EndlessScreen(
            VisualElement view,
            EndlessModeController controller,
            IVocabularyService vocabulary,
            ContentCatalog content,
            string wordbookId,
            CancellationToken token)
        {
            this.view = view ?? throw new ArgumentNullException(nameof(view));
            this.controller = controller ??
                              throw new ArgumentNullException(nameof(controller));
            this.vocabulary = vocabulary ??
                              throw new ArgumentNullException(nameof(vocabulary));
            this.content = content ??
                           throw new ArgumentNullException(nameof(content));
            this.wordbookId = string.IsNullOrWhiteSpace(wordbookId)
                ? "cet4"
                : wordbookId;
            this.token = token;

            view.Q<Button>("endless-finish-button").clicked += Finish;
            view.RegisterCallback<DetachFromPanelEvent>(_ => StopTimer());
            Load();
        }

        private async void Load()
        {
            var status = view.Q<Label>("endless-status-label");
            var failures = 0;
            var seen = new HashSet<string>();
            words.Clear();

            foreach (var chapter in content.Chapters)
            {
                if (token.IsCancellationRequested)
                    return;

                status.text =
                    $"正在加载第 {chapter.Id}/{content.Chapters.Count} 章词汇…";
                var result = await vocabulary.GetChapterWordsAsync(
                    chapter.Id,
                    wordbookId,
                    token);
                if (!result.IsSuccess)
                {
                    failures++;
                    continue;
                }

                foreach (var word in result.Data ?? Array.Empty<WordDto>())
                {
                    var id = string.IsNullOrWhiteSpace(word._id)
                        ? word.wordId
                        : word._id;
                    if (!string.IsNullOrWhiteSpace(id) && seen.Add(id))
                        words.Add(word);
                }
            }

            if (words.Count == 0)
            {
                status.text = failures == content.Chapters.Count
                    ? "词库加载失败，请确认后端已启动且登录仍然有效。"
                    : "当前词书没有可用于无尽模式的词汇。";
                view.Q<Button>("endless-finish-button").SetEnabled(false);
                return;
            }

            status.text = $"已加载 {words.Count} 个词汇";
            round = controller.NextRound(false);
            RenderQuestion();
        }

        private void RenderQuestion()
        {
            answered = false;
            currentWord = words[(round.Number * 37 - 1) % words.Count];
            var question = QuizFactory.Create(
                currentWord,
                round.QuestionType,
                words);
            var host = view.Q<VisualElement>("endless-question-host");
            host.Clear();
            host.Add(new Label(question.Prompt)
            {
                name = "endless-question-prompt"
            });
            host.Q<Label>("endless-question-prompt")
                .AddToClassList("question-title");

            if (!string.IsNullOrWhiteSpace(currentWord.phonetic))
                host.Add(new Label(currentWord.phonetic));

            if (question.Options.Count > 0)
            {
                foreach (var option in question.Options)
                {
                    var captured = option.Text;
                    var button = new Button(() => Answer(captured))
                    {
                        text = captured
                    };
                    button.AddToClassList("quiz-option");
                    host.Add(button);
                }
            }
            else
            {
                var field = new TextField("你的答案")
                {
                    name = "endless-answer-field"
                };
                host.Add(field);
                var submit = new Button(() => Answer(field.value))
                {
                    text = "确认"
                };
                submit.AddToClassList("primary-button");
                host.Add(submit);
                field.Focus();
            }

            RenderRound();
            view.Q<Label>("endless-feedback-label").text = string.Empty;
            StartTimer();
        }

        private void Answer(string value)
        {
            if (answered || finishing)
                return;

            answered = true;
            StopTimer();
            var expected =
                round.QuestionType == QuestionType.ChoiceEnglishToChinese
                    ? currentWord.meaning
                    : currentWord.word;
            var correct = ModeAnswerPolicy.IsCorrect(value, expected);
            round = controller.NextRound(correct);
            RenderRound();

            var feedback = view.Q<Label>("endless-feedback-label");
            feedback.text = correct
                ? $"回答正确！{currentWord.example}"
                : $"正确答案：{expected}";
            feedback.RemoveFromClassList("mode-feedback-correct");
            feedback.RemoveFromClassList("mode-feedback-wrong");
            feedback.AddToClassList(
                correct ? "mode-feedback-correct" : "mode-feedback-wrong");

            if (round.Lives <= 0)
            {
                Finish();
                return;
            }

            var host = view.Q<VisualElement>("endless-question-host");
            host.Clear();
            var next = new Button(RenderQuestion)
            {
                text = "继续下一题"
            };
            next.AddToClassList("primary-button");
            host.Add(next);
        }

        private void RenderRound()
        {
            view.Q<Label>("endless-round-label").text =
                $"第 {round.Number} 题 · 难度 {round.Difficulty}";
            view.Q<Label>("endless-status-label").text =
                $"生命 {round.Lives} · 连胜 {round.Streak} · 分数 {round.Score} · {round.TimeLimitMs / 1000} 秒";
        }

        private void StartTimer()
        {
            StopTimer();
            questionTimer.Restart();
            UpdateTimer();
            timerSchedule = view.schedule.Execute(UpdateTimer).Every(100);
        }

        private void UpdateTimer()
        {
            if (round == null || answered)
                return;

            var remaining = Math.Max(
                0d,
                1d - questionTimer.ElapsedMilliseconds /
                (double)round.TimeLimitMs);
            var timer = view.Q<ProgressBar>("endless-timer");
            timer.value = (float)(remaining * 100d);
            timer.title = $"剩余 {Math.Ceiling(remaining * round.TimeLimitMs / 1000d)} 秒";
            if (remaining <= 0d)
                Answer(string.Empty);
        }

        private void StopTimer()
        {
            questionTimer.Stop();
            timerSchedule?.Pause();
            timerSchedule = null;
        }

        private async void Finish()
        {
            if (finishing || round == null)
                return;

            finishing = true;
            StopTimer();
            var button = view.Q<Button>("endless-finish-button");
            button.SetEnabled(false);
            var host = view.Q<VisualElement>("endless-question-host");
            host.Clear();
            host.Add(new Label("正在保存无尽模式成绩…"));

            var result = await controller.FinishAsync(token);
            host.Clear();
            if (result.IsSuccess)
            {
                host.Add(new Label(
                    $"挑战结束 · {round.Score} 分\n历史最佳 {result.Data.bestScore} 分，最佳连胜 {result.Data.bestStreak}"));
                view.Q<Label>("endless-status-label").text =
                    result.Data.isNewRecord ? "新纪录！" : "成绩已同步";
                return;
            }

            host.Add(new Label($"本局 {round.Score} 分 · {result.Message}"));
            view.Q<Label>("endless-status-label").text =
                "本地最佳已保存，可点击按钮重新同步。";
            finishing = false;
            button.text = "重新同步成绩";
            button.SetEnabled(true);
        }
    }
}
