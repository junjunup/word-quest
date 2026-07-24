using System;
using System.Collections.Generic;
using System.Threading;
using UnityEngine.UIElements;
using WordQuest.Application.Social;
using WordQuest.Infrastructure.Api.Dto;

namespace WordQuest.Presentation.Screens
{
    public sealed class ChallengeScreen
    {
        private readonly VisualElement view;
        private readonly SocialController controller;
        private readonly string challengeId;
        private readonly CancellationToken token;
        private readonly List<(string id, TextField field)> answers =
            new List<(string id, TextField field)>();

        public ChallengeScreen(
            VisualElement view,
            SocialController controller,
            string challengeId,
            CancellationToken token)
        {
            this.view = view ?? throw new ArgumentNullException(nameof(view));
            this.controller = controller ??
                              throw new ArgumentNullException(nameof(controller));
            this.challengeId = challengeId;
            this.token = token;
            view.Q<Button>("submit-challenge-button").clicked += Submit;
            Load();
        }

        private async void Load()
        {
            var result = await controller.GetChallengeAsync(challengeId, token);
            var list = view.Q<ScrollView>("challenge-word-list");
            list.Clear();
            answers.Clear();
            if (!result.IsSuccess)
            {
                Status(result.Message);
                return;
            }

            foreach (var word in result.Data.words ??
                                 Array.Empty<ChallengeWordDto>())
            {
                var field = new TextField(
                    $"{word.meaning}  {word.phonetic}");
                field.AddToClassList("list-card");
                list.Add(field);
                answers.Add((word.wordId, field));
            }

            var alreadySubmitted = result.Data.mySubmission != null;
            view.Q<Button>("submit-challenge-button").SetEnabled(
                SocialProjection.CanSubmit(
                    result.Data,
                    alreadySubmitted,
                    DateTimeOffset.UtcNow));
            Status(
                alreadySubmitted
                    ? $"已提交 {result.Data.mySubmission.score} 分，等待对手"
                    : result.Data.status);
        }

        private async void Submit()
        {
            var button = view.Q<Button>("submit-challenge-button");
            button.SetEnabled(false);
            var payload = new List<ChallengeAnswerDto>();
            foreach (var answer in answers)
            {
                payload.Add(new ChallengeAnswerDto
                {
                    wordId = answer.id,
                    answer = answer.field.value
                });
            }
            var result = await controller.SubmitChallengeAsync(
                challengeId,
                payload,
                token);
            Status(result.IsSuccess ? "PK 答案已提交" : result.Message);
            if (!result.IsSuccess && result.StatusCode == 0)
                button.SetEnabled(true);
        }

        private void Status(string text)
        {
            view.Q<Label>("challenge-status-label").text = text;
        }
    }
}
