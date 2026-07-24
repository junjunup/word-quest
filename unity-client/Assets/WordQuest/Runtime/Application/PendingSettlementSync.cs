using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;
using WordQuest.Infrastructure.Api;
using WordQuest.Infrastructure.Api.Dto;
using WordQuest.Infrastructure.Api.Services;
using WordQuest.Infrastructure.Storage;

namespace WordQuest.Application
{
    public sealed class PendingSettlementSync
    {
        private readonly PendingSyncQueue queue;
        private readonly IGameService game;

        public PendingSettlementSync(
            PendingSyncQueue queue,
            IGameService game)
        {
            this.queue = queue ?? throw new ArgumentNullException(nameof(queue));
            this.game = game ?? throw new ArgumentNullException(nameof(game));
        }

        public async Task<int> FlushAsync(CancellationToken token)
        {
            var remaining = new List<PendingSubmission>();
            var confirmed = 0;
            foreach (var item in queue.ReadAll())
            {
                token.ThrowIfCancellationRequested();
                if (item.route != ApiRoutes.SaveProgress)
                {
                    remaining.Add(item);
                    continue;
                }

                SaveProgressRequest request;
                try
                {
                    request = JsonUtility.FromJson<SaveProgressRequest>(
                        item.jsonBody);
                }
                catch (ArgumentException)
                {
                    continue;
                }

                var result = await game.SaveProgressAsync(request, token);
                if (result.IsSuccess)
                    confirmed++;
                else
                {
                    item.attempts++;
                    remaining.Add(item);
                }
            }

            queue.Replace(remaining);
            return confirmed;
        }
    }
}
