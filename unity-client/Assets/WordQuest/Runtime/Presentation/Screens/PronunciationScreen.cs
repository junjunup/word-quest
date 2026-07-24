using System;
using System.Threading;
using UnityEngine.UIElements;
using WordQuest.Infrastructure.Api.Dto;
using WordQuest.Infrastructure.Api.Services;
using WordQuest.Infrastructure.Audio;

namespace WordQuest.Presentation.Screens
{
    public sealed class PronunciationScreen
    {
        private readonly VisualElement view;
        private readonly IPronunciationService service;
        private readonly ISpeechCaptureAdapter capture;
        private readonly string wordbookId;
        private readonly CancellationToken token;

        public PronunciationScreen(
            VisualElement view,
            IPronunciationService service,
            ISpeechCaptureAdapter capture,
            string wordbookId,
            CancellationToken token)
        {
            this.view = view ?? throw new ArgumentNullException(nameof(view));
            this.service = service ??
                           throw new ArgumentNullException(nameof(service));
            this.capture = capture ??
                           throw new ArgumentNullException(nameof(capture));
            this.wordbookId = wordbookId;
            this.token = token;

            var record = view.Q<Button>("record-pronunciation-button");
            record.SetEnabled(capture.IsAvailable);
            if (!capture.IsAvailable)
                Status(capture.UnavailableReason);
            record.clicked += ToggleRecording;
            view.Q<Button>("score-pronunciation-button").clicked += Score;
            view.Q<Button>("pronunciation-history-button").clicked += History;
        }

        private void ToggleRecording()
        {
            if (capture.Start())
            {
                Status(
                    "录音已开始。当前桌面版不内置语音转写，请把系统识别结果填入下方后评分。");
            }
        }

        private async void Score()
        {
            var word = view.Q<TextField>("pronunciation-word-field").value?.Trim();
            var transcript =
                view.Q<TextField>("pronunciation-transcript-field").value?.Trim();
            var result = await service.ScoreAsync(
                new PronunciationRequest
                {
                    word = word,
                    transcript = transcript,
                    expectedPhonetic =
                        view.Q<TextField>("pronunciation-phonetic-field").value,
                    wordbookId = wordbookId,
                    confidence = 1f
                },
                token);
            Status(result.IsSuccess
                ? $"评分 {result.Data.score} · {result.Data.grade}\n{result.Data.details?.feedback}"
                : result.Message);
        }

        private async void History()
        {
            var word = view.Q<TextField>("pronunciation-word-field").value;
            var result = await service.GetHistoryAsync(word, 20, token);
            var list = view.Q<ScrollView>("pronunciation-history-list");
            list.Clear();
            foreach (var item in result.Data ??
                                 Array.Empty<PronunciationResultDto>())
            {
                var row = new Label(
                    $"{item.word} · {item.score} 分 · {item.grade} · {item.createdAt}");
                row.AddToClassList("list-card");
                list.Add(row);
            }
        }

        private void Status(string message)
        {
            view.Q<Label>("pronunciation-status-label").text = message;
        }
    }
}
