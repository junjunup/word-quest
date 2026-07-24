using System;
using System.Threading;
using UnityEngine.UIElements;
using WordQuest.Application.Modes;

namespace WordQuest.Presentation.Screens
{
    public sealed class EndlessScreen
    {
        private readonly VisualElement view;
        private readonly EndlessModeController controller;
        private readonly CancellationToken token;

        public EndlessScreen(
            VisualElement view,
            EndlessModeController controller,
            CancellationToken token)
        {
            this.view = view ?? throw new ArgumentNullException(nameof(view));
            this.controller = controller ??
                              throw new ArgumentNullException(nameof(controller));
            this.token = token;
            view.Q<Button>("endless-correct-button").clicked += () =>
                Render(controller.NextRound(true));
            view.Q<Button>("endless-wrong-button").clicked += () =>
                Render(controller.NextRound(false));
            view.Q<Button>("endless-finish-button").clicked += Finish;
            Render(controller.NextRound(false));
        }

        private void Render(EndlessRound round)
        {
            view.Q<Label>("endless-round-label").text =
                $"第 {round.Number} 题 · 难度 {round.Difficulty}";
            view.Q<Label>("endless-status-label").text =
                $"生命 {round.Lives} · 连胜 {round.Streak} · 分数 {round.Score} · {round.TimeLimitMs / 1000} 秒";
        }

        private async void Finish()
        {
            var button = view.Q<Button>("endless-finish-button");
            button.SetEnabled(false);
            var result = await controller.FinishAsync(token);
            view.Q<Label>("endless-status-label").text = result.IsSuccess
                ? $"最佳分数 {result.Data.bestScore}，最佳连胜 {result.Data.bestStreak}"
                : result.Message;
        }
    }
}
