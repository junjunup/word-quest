using System;
using System.Threading;
using UnityEngine.UIElements;
using WordQuest.Application.Ai;

namespace WordQuest.Presentation.Screens
{
    public sealed class AiTutorScreen : IDisposable
    {
        private readonly VisualElement view;
        private readonly AiTutorController controller;
        private readonly ChatContext context;
        private readonly CancellationToken lifetime;
        private CancellationTokenSource request;
        private string lastMessage;

        public AiTutorScreen(
            VisualElement view,
            AiTutorController controller,
            ChatContext context,
            CancellationToken lifetime)
        {
            this.view = view ?? throw new ArgumentNullException(nameof(view));
            this.controller = controller ??
                              throw new ArgumentNullException(nameof(controller));
            this.context = context ?? new ChatContext();
            this.lifetime = lifetime;
            view.Q<Button>("tutor-send-button").clicked += Send;
            view.Q<Button>("tutor-cancel-button").clicked += Cancel;
            view.Q<Button>("tutor-retry-button").clicked += Retry;
            RenderContext();
        }

        public void Dispose()
        {
            request?.Cancel();
            request?.Dispose();
        }

        private void Send()
        {
            var input = view.Q<TextField>("tutor-input");
            var value = input.value?.Trim();
            if (string.IsNullOrEmpty(value))
                return;
            lastMessage = value;
            input.value = string.Empty;
            AddMessage("你", value, "user-message");
            SendCurrent();
        }

        private async void SendCurrent()
        {
            request?.Cancel();
            request?.Dispose();
            request = CancellationTokenSource.CreateLinkedTokenSource(lifetime);
            var send = view.Q<Button>("tutor-send-button");
            var cancel = view.Q<Button>("tutor-cancel-button");
            var retry = view.Q<Button>("tutor-retry-button");
            send.SetEnabled(false);
            cancel.style.display = DisplayStyle.Flex;
            retry.style.display = DisplayStyle.None;

            var response = AddMessage("AI 学习导师", "正在思考…", "assistant-message");
            try
            {
                await controller.SendAsync(
                    lastMessage,
                    context,
                    text => response.text = text,
                    request.Token);
            }
            catch (OperationCanceledException)
            {
                response.text = "回答已取消。";
            }
            finally
            {
                send.SetEnabled(true);
                cancel.style.display = DisplayStyle.None;
                retry.style.display = DisplayStyle.Flex;
            }
        }

        private void Cancel()
        {
            request?.Cancel();
        }

        private void Retry()
        {
            if (!string.IsNullOrEmpty(lastMessage))
                SendCurrent();
        }

        private Label AddMessage(string author, string text, string styleClass)
        {
            var card = new VisualElement();
            card.AddToClassList("chat-message");
            card.AddToClassList(styleClass);
            card.Add(new Label(author) { name = "chat-author" });
            var body = new Label(text);
            body.AddToClassList("chat-body");
            card.Add(body);
            view.Q<ScrollView>("tutor-messages").Add(card);
            return body;
        }

        private void RenderContext()
        {
            view.Q<Label>("tutor-context-chip").text =
                string.IsNullOrWhiteSpace(context.CurrentWord)
                    ? "上下文：自由提问"
                    : $"上下文：{context.CurrentWord} · {context.ChapterName}";
        }
    }
}
