using System;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.Networking;
using WordQuest.Infrastructure.Api.Dto;

namespace WordQuest.Infrastructure.Api.Services
{
    public sealed class ChatService : IChatService
    {
        private readonly ApiClient client;

        public ChatService(ApiClient client)
        {
            this.client = client ?? throw new ArgumentNullException(nameof(client));
        }

        public async Task StreamAsync(
            ChatRequest requestDto,
            Action<string> onDelta,
            CancellationToken token)
        {
            if (requestDto == null)
                throw new ArgumentNullException(nameof(requestDto));
            if (onDelta == null)
                throw new ArgumentNullException(nameof(onDelta));

            var delivered = false;
            string streamError = null;
            var handler = new SseDownloadHandler(payload =>
            {
                var delta = ParseDelta(payload, out var error);
                if (!string.IsNullOrEmpty(error))
                {
                    streamError = error;
                    return;
                }

                if (string.IsNullOrEmpty(delta))
                    return;

                delivered = true;
                onDelta(delta);
            });

            using (var stream = client.CreateRequest(
                       UnityWebRequest.kHttpVerbPOST,
                       ApiRoutes.ChatStream,
                       JsonUtility.ToJson(requestDto),
                       handler))
            {
                try
                {
                    await stream.SendAsync(token);
                }
                catch (OperationCanceledException)
                {
                    throw;
                }

                if (stream.result == UnityWebRequest.Result.Success &&
                    stream.responseCode >= 200 &&
                    stream.responseCode < 300 &&
                    string.IsNullOrEmpty(streamError))
                {
                    return;
                }
            }

            if (delivered)
                throw new InvalidOperationException(
                    streamError ?? "AI 助手流式响应中断");

            var fallback = await client.SendJsonAsync<ChatResponseDto>(
                UnityWebRequest.kHttpVerbPOST,
                ApiRoutes.ChatMessage,
                requestDto,
                token);
            if (!fallback.IsSuccess)
                throw new InvalidOperationException(fallback.Message);

            var text = fallback.Data?.content;
            if (string.IsNullOrEmpty(text))
                text = fallback.Data?.result;
            if (string.IsNullOrEmpty(text))
                text = fallback.Data?.message;
            if (!string.IsNullOrEmpty(text))
                onDelta(text);
        }

        private static string ParseDelta(string payload, out string error)
        {
            error = null;
            if (string.IsNullOrWhiteSpace(payload))
                return string.Empty;

            try
            {
                var parsed = JsonUtility.FromJson<ChatDeltaDto>(payload);
                if (!string.IsNullOrEmpty(parsed?.error))
                {
                    error = parsed.error;
                    return string.Empty;
                }

                if (!string.IsNullOrEmpty(parsed?.content))
                    return parsed.content;
                if (!string.IsNullOrEmpty(parsed?.result))
                    return parsed.result;
            }
            catch (ArgumentException)
            {
                return payload;
            }

            return payload.StartsWith("{", StringComparison.Ordinal)
                ? string.Empty
                : payload;
        }
    }
}
