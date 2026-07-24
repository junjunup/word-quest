using System;
using System.Threading;
using UnityEngine.UIElements;
using WordQuest.Application.Modes;
using WordQuest.Infrastructure.Api.Dto;

namespace WordQuest.Presentation.Screens
{
    public sealed class ReviewScreen
    {
        private readonly VisualElement view;
        private readonly ReviewModeController controller;
        private readonly CancellationToken token;

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
            button.SetEnabled(false);
            var result = await controller.CreateAsync(20, token);
            var list = view.Q<ScrollView>("review-word-list");
            list.Clear();
            if (!result.IsSuccess)
            {
                list.Add(new Label(result.Message));
                button.SetEnabled(true);
                return;
            }

            foreach (var word in result.Data.words ??
                                 Array.Empty<WordDto>())
            {
                var row = new Label(
                    $"{word.word}  {word.phonetic}\n{word.meaning}");
                row.AddToClassList("list-card");
                list.Add(row);
            }
            view.Q<Label>("review-status-label").text =
                $"已创建复习会话：{result.Data.words?.Length ?? 0} 个词";
        }
    }
}
