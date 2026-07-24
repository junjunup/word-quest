using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine.UIElements;
using WordQuest.Application.Modes;
using WordQuest.Infrastructure.Api.Dto;

namespace WordQuest.Presentation.Screens
{
    public sealed class DailyChallengeScreen
    {
        private readonly VisualElement view;
        private readonly DailyChallengeController controller;
        private readonly CancellationToken token;
        private readonly Dictionary<string, string> answers =
            new Dictionary<string, string>();
        private readonly Stopwatch timer = new Stopwatch();
        private DailyChallengeDto challenge;
        private DailyQuestionDto[] questions = Array.Empty<DailyQuestionDto>();
        private int currentIndex;
        private bool submitting;

        public DailyChallengeScreen(
            VisualElement view,
            DailyChallengeController controller,
            CancellationToken token)
        {
            this.view = view ?? throw new ArgumentNullException(nameof(view));
            this.controller = controller ??
                              throw new ArgumentNullException(nameof(controller));
            this.token = token;
            view.Q<Button>("load-daily-button").clicked += Load;
            Load();
        }

        private async void Load()
        {
            var button = view.Q<Button>("load-daily-button");
            var host = view.Q<VisualElement>("daily-question-host");
            button.SetEnabled(false);
            host.Clear();
            host.Add(new Label("正在加载今日固定题组与排行榜…"));

            var challengeTask = controller.LoadTodayAsync(token);
            var leaderboardTask = controller.GetLeaderboardAsync(
                DateTime.UtcNow.ToString("yyyy-MM-dd"),
                token);
            await Task.WhenAll(challengeTask, leaderboardTask);
            var challengeResult = challengeTask.Result;
            var leaderboardResult = leaderboardTask.Result;
            RenderLeaderboard(
                leaderboardResult.IsSuccess
                    ? leaderboardResult.Data
                    : Array.Empty<DailyLeaderboardEntryDto>());

            if (!challengeResult.IsSuccess)
            {
                host.Clear();
                host.Add(new Label(challengeResult.Message));
                Status("每日挑战加载失败");
                button.SetEnabled(true);
                return;
            }

            challenge = challengeResult.Data;
            questions = challenge.questions ?? Array.Empty<DailyQuestionDto>();
            answers.Clear();
            currentIndex = 0;
            submitting = false;
            button.text = "重新加载今日挑战";
            button.SetEnabled(true);

            if (challenge.completed)
            {
                RenderCompleted(challenge);
                return;
            }

            if (questions.Length == 0)
            {
                host.Clear();
                host.Add(new Label("今日题组尚未生成，请稍后刷新。"));
                Status("暂无题目");
                return;
            }

            timer.Restart();
            RenderQuestion();
        }

        private void RenderQuestion()
        {
            var question = questions[currentIndex];
            var host = view.Q<VisualElement>("daily-question-host");
            host.Clear();
            host.Add(new Label(
                $"第 {currentIndex + 1}/{questions.Length} 题 · {question.word} {question.phonetic}")
            {
                name = "daily-question-title"
            });
            host.Q<Label>("daily-question-title")
                .AddToClassList("question-title");
            if (!string.IsNullOrWhiteSpace(question.example))
                host.Add(new Label(question.example));

            answers.TryGetValue(question.wordId, out var selected);
            foreach (var option in question.options ?? Array.Empty<string>())
            {
                var captured = option;
                var choice = new Button(() =>
                {
                    answers[question.wordId] = captured;
                    RenderQuestion();
                })
                {
                    text = captured
                };
                choice.AddToClassList("quiz-option");
                if (string.Equals(selected, captured, StringComparison.Ordinal))
                    choice.AddToClassList("mode-selected");
                host.Add(choice);
            }

            var actions = new VisualElement();
            actions.AddToClassList("action-row");
            var previous = new Button(() =>
            {
                currentIndex = Math.Max(0, currentIndex - 1);
                RenderQuestion();
            })
            {
                text = "上一题"
            };
            previous.SetEnabled(currentIndex > 0);
            actions.Add(previous);

            if (currentIndex < questions.Length - 1)
            {
                var next = new Button(() =>
                {
                    currentIndex++;
                    RenderQuestion();
                })
                {
                    text = "下一题"
                };
                next.AddToClassList("primary-button");
                next.SetEnabled(!string.IsNullOrWhiteSpace(selected));
                actions.Add(next);
            }
            else
            {
                var submit = new Button(Submit)
                {
                    text = "提交今日挑战"
                };
                submit.AddToClassList("primary-button");
                submit.SetEnabled(
                    ModeAnswerPolicy.CanSubmitDaily(questions, answers));
                actions.Add(submit);
            }
            host.Add(actions);

            Status(
                $"已作答 {answers.Count}/{questions.Length} · 用时 {timer.ElapsedMilliseconds / 1000} 秒");
        }

        private async void Submit()
        {
            if (submitting ||
                challenge == null ||
                !ModeAnswerPolicy.CanSubmitDaily(questions, answers))
                return;

            submitting = true;
            timer.Stop();
            var host = view.Q<VisualElement>("daily-question-host");
            host.Clear();
            host.Add(new Label("正在校验答案并计算排名…"));
            var result = await controller.SubmitAsync(
                challenge.id,
                ModeAnswerPolicy.CreateDailyAnswers(questions, answers),
                (int)Math.Min(timer.ElapsedMilliseconds, int.MaxValue),
                token);

            if (result.IsSuccess)
            {
                challenge = result.Data;
                RenderCompleted(challenge);
                var leaderboard = await controller.GetLeaderboardAsync(
                    challenge.date,
                    token);
                if (leaderboard.IsSuccess)
                    RenderLeaderboard(leaderboard.Data);
                return;
            }

            host.Clear();
            host.Add(new Label(result.Message));
            if (result.StatusCode == 0)
            {
                submitting = false;
                var retry = new Button(Submit) { text = "重新提交" };
                retry.AddToClassList("primary-button");
                host.Add(retry);
            }
            Status("挑战结果尚未同步");
        }

        private void RenderCompleted(DailyChallengeDto value)
        {
            var host = view.Q<VisualElement>("daily-question-host");
            host.Clear();
            var attempt = value.attempt ?? new DailyAttemptDto();
            host.Add(new Label(
                $"今日挑战完成 · {attempt.score} 分\n正确 {attempt.correctCount}/{attempt.questionCount} · 连续 {attempt.streak} 天 · 获得 {attempt.rewardExp} 经验"));
            if (!string.IsNullOrWhiteSpace(attempt.rewardTitle))
                host.Add(new Label($"解锁称号：{attempt.rewardTitle}"));
            Status(
                $"用时 {attempt.durationMs / 1000} 秒 · 更新掌握度 {value.masteryUpdated} 个词");
        }

        private void RenderLeaderboard(
            IReadOnlyList<DailyLeaderboardEntryDto> rows)
        {
            var list = view.Q<ScrollView>("daily-leaderboard-list");
            list.Clear();
            if (rows == null || rows.Count == 0)
            {
                list.Add(new Label("今天还没有玩家上榜"));
                return;
            }

            foreach (var row in rows)
            {
                var nickname = row.user == null
                    ? "冒险者"
                    : string.IsNullOrWhiteSpace(row.user.nickname)
                        ? row.user.username
                        : row.user.nickname;
                var item = new Label(
                    $"#{row.rank}  {nickname} · {row.score} 分 · {row.durationMs / 1000} 秒");
                item.AddToClassList("list-card");
                list.Add(item);
            }
        }

        private void Status(string text)
        {
            view.Q<Label>("daily-status-label").text = text;
        }
    }
}
