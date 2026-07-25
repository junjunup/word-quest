using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using NUnit.Framework;
using WordQuest.Application.Ai;
using WordQuest.Infrastructure.Api.Dto;
using WordQuest.Infrastructure.Api.Services;

namespace WordQuest.Tests
{
    public sealed class AiTutorControllerTests
    {
        [Test]
        public async Task Ordered_deltas_are_concatenated()
        {
            var service = new FakeChatService("学", "习", "加油");
            var controller = new AiTutorController(service);
            var updates = new List<string>();

            await controller.SendAsync(
                "怎么记？",
                new ChatContext(),
                updates.Add,
                CancellationToken.None);

            Assert.That(updates[^1], Is.EqualTo("学习加油"));
        }

        [Test]
        public void Cancellation_is_preserved()
        {
            var service = new CancellingChatService();
            var controller = new AiTutorController(service);

            Assert.CatchAsync<OperationCanceledException>(() =>
                controller.SendAsync(
                    "问题",
                    new ChatContext(),
                    _ => { },
                    new CancellationToken(true)));
        }

        private sealed class FakeChatService : IChatService
        {
            private readonly string[] deltas;

            public FakeChatService(params string[] deltas)
            {
                this.deltas = deltas;
            }

            public Task StreamAsync(
                ChatRequest request,
                Action<string> onDelta,
                CancellationToken token)
            {
                foreach (var delta in deltas)
                    onDelta(delta);
                return Task.CompletedTask;
            }
        }

        private sealed class CancellingChatService : IChatService
        {
            public Task StreamAsync(
                ChatRequest request,
                Action<string> onDelta,
                CancellationToken token)
            {
                token.ThrowIfCancellationRequested();
                return Task.CompletedTask;
            }
        }
    }
}
