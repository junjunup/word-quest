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
        private readonly Button recordButton;
        private bool recording;

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

            recordButton = view.Q<Button>("record-pronunciation-button");
            recordButton.SetEnabled(capture.IsAvailable);
            if (!capture.IsAvailable)
                Status(capture.UnavailableReason);
            recordButton.clicked += ToggleRecording;
            view.Q<Button>("score-pronunciation-button").clicked += Score;
            view.Q<Button>("pronunciation-history-button").clicked += History;
        }

        private void ToggleRecording()
        {
            if (!recording && capture.Start())
            {
                recording = true;
                recordButton.text = "停止录音";
                Status(
                    "录音已开始。当前桌面版不内置语音转写，请把系统识别结果填入下方后评分。");
                return;
            }

            if (!recording)
                return;

            var clip = capture.Stop();
            recording = false;
            recordButton.text = "开始录音";
            Status(
                clip == null
                    ? "没有捕获到有效音频，请检查麦克风权限后重试。"
                    : $"已录制 {clip.length:0.0} 秒。请填入系统转写文本后提交评分。");
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
                ? $"评分 {result.Data.score} · {result.Data.grade}\n{string.Join("；", result.Data.details?.feedback ?? Array.Empty<string>())}"
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
