using System;
using System.Threading;
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
            var result = await controller.LoadTodayAsync(token);
            var list = view.Q<ScrollView>("daily-question-list");
            list.Clear();
            if (!result.IsSuccess)
            {
                list.Add(new Label(result.Message));
                return;
            }

            view.Q<Label>("daily-status-label").text = result.Data.completed
                ? $"今日已完成 · {result.Data.attempt?.score ?? 0} 分"
                : $"{result.Data.questionCount} 题等待挑战";
            foreach (var question in result.Data.questions ??
                                     Array.Empty<DailyQuestionDto>())
            {
                var card = new Label(
                    $"{question.word}  {question.phonetic}\n{question.example}");
                card.AddToClassList("list-card");
                list.Add(card);
            }
        }
    }
}
