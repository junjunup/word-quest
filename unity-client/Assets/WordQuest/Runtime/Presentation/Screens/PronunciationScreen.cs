using System;
using System.Threading;
using UnityEngine.UIElements;
using WordQuest.Infrastructure.Api.Dto;
using WordQuest.Infrastructure.Api.Services;
using WordQuest.Infrastructure.Audio;

namespace WordQuest.Presentation.Screens
{
    public sealed class PronunciationScreen : IDisposable
    {
        private readonly VisualElement view;
        private readonly IPronunciationService service;
        private readonly ISpeechRecognitionAdapter recognition;
        private readonly string wordbookId;
        private readonly CancellationToken token;
        private readonly Button recordButton;
        private readonly IVisualElementScheduledItem recognitionPoll;
        private bool recording;
        private float recognitionConfidence;
        private string recognizedTranscript = string.Empty;

        public PronunciationScreen(
            VisualElement view,
            IPronunciationService service,
            ISpeechRecognitionAdapter recognition,
            string wordbookId,
            CancellationToken token)
        {
            this.view = view ?? throw new ArgumentNullException(nameof(view));
            this.service = service ??
                           throw new ArgumentNullException(nameof(service));
            this.recognition = recognition ??
                               throw new ArgumentNullException(
                                   nameof(recognition));
            this.wordbookId = wordbookId;
            this.token = token;

            recordButton = view.Q<Button>("record-pronunciation-button");
            recordButton.SetEnabled(recognition.IsAvailable);
            if (!recognition.IsAvailable)
                Status(recognition.UnavailableReason);
            recordButton.clicked += ToggleRecording;
            view.Q<Button>("score-pronunciation-button").clicked += Score;
            view.Q<Button>("pronunciation-history-button").clicked += History;
            view.Q<TextField>("pronunciation-transcript-field")
                .RegisterValueChangedCallback(OnTranscriptChanged);
            recognitionPoll = recognition.IsAvailable
                ? view.schedule.Execute(PollRecognition).Every(100)
                : null;
        }

        public void Dispose()
        {
            recognitionPoll?.Pause();
            recognition.Dispose();
        }

        private void ToggleRecording()
        {
            if (!recording && recognition.Start())
            {
                recording = true;
                recordButton.text = "停止并评分";
                Status("正在录音并识别英文发音…");
                return;
            }

            if (!recording)
            {
                Status(recognition.UnavailableReason);
                return;
            }

            recognition.Stop();
            Status("正在整理识别结果…");
        }

        private async void Score()
        {
            var word = view.Q<TextField>(
                "pronunciation-word-field").value?.Trim();
            var transcript = view.Q<TextField>(
                "pronunciation-transcript-field").value?.Trim();
            if (string.IsNullOrWhiteSpace(word) ||
                string.IsNullOrWhiteSpace(transcript))
            {
                Status("请填写目标单词，并录音识别或输入识别文本。");
                return;
            }

            var result = await service.ScoreAsync(
                new PronunciationRequest
                {
                    word = word,
                    transcript = transcript,
                    expectedPhonetic =
                        view.Q<TextField>(
                            "pronunciation-phonetic-field").value,
                    wordbookId = wordbookId,
                    confidence = string.Equals(
                        transcript,
                        recognizedTranscript,
                        StringComparison.Ordinal)
                            ? recognitionConfidence
                            : 0f
                },
                token);
            Status(result.IsSuccess && result.Data != null
                ? $"评分 {result.Data.score} · {result.Data.grade}\n{string.Join("；", result.Data.details?.feedback ?? Array.Empty<string>())}"
                : string.IsNullOrWhiteSpace(result.Message)
                    ? "评分服务未返回有效结果。"
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

        private void PollRecognition()
        {
            if (!recognition.TryGetResult(out var result, out var error))
                return;

            recording = false;
            recordButton.text = "开始录音";
            if (result == null)
            {
                Status(
                    $"语音识别失败：{error} 可在识别文本框中手动输入后评分。");
                return;
            }

            recognizedTranscript = result.Transcript;
            recognitionConfidence = result.Confidence;
            view.Q<TextField>(
                "pronunciation-transcript-field").SetValueWithoutNotify(
                result.Transcript);
            Status(
                $"识别为“{result.Transcript}”，正在提交发音评分…");
            Score();
        }

        private void OnTranscriptChanged(ChangeEvent<string> change)
        {
            if (!string.Equals(
                    change.newValue?.Trim(),
                    recognizedTranscript,
                    StringComparison.Ordinal))
            {
                recognitionConfidence = 0f;
            }
        }

        private void Status(string message)
        {
            view.Q<Label>("pronunciation-status-label").text = message;
        }
    }
}
