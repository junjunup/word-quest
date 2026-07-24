using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;
using WordQuest.Domain.Game;
using WordQuest.Infrastructure.Api;
using WordQuest.Infrastructure.Api.Dto;
using WordQuest.Infrastructure.Api.Services;
using WordQuest.Infrastructure.Storage;

namespace WordQuest.Application
{
    public sealed class PendingAchievementWork
    {
        public string SubmissionId { get; set; }
        public AchievementRunEvidence Evidence { get; set; }
    }

    public sealed class PendingSettlementSync
    {
        private const int MaximumAttempts = 5;
        private readonly PendingSyncQueue queue;
        private readonly IGameService game;
        private readonly string userId;

        public PendingSettlementSync(
            PendingSyncQueue queue,
            IGameService game,
            string userId)
        {
            this.queue = queue ?? throw new ArgumentNullException(nameof(queue));
            this.game = game ?? throw new ArgumentNullException(nameof(game));
            this.userId = string.IsNullOrWhiteSpace(userId)
                ? throw new ArgumentException(
                    "A signed-in user is required for settlement sync.",
                    nameof(userId))
                : userId.Trim();
        }

        public async Task<IReadOnlyList<PendingAchievementWork>> FlushAsync(
            CancellationToken token)
        {
            var remaining = new List<PendingSubmission>();
            var confirmedAchievements =
                new List<PendingAchievementWork>();
            var items = new List<PendingSubmission>(
                queue.ReadAll(userId));
            for (var index = 0; index < items.Count; index++)
            {
                if (token.IsCancellationRequested)
                {
                    PreserveUnprocessed(items, index, userId, remaining);
                    break;
                }
                var item = items[index];
                if (!string.Equals(
                        item.userId,
                        userId,
                        StringComparison.Ordinal))
                {
                    continue;
                }
                if (item.route != ApiRoutes.SaveProgress)
                {
                    remaining.Add(item);
                    continue;
                }
                if (item.progressSaved)
                {
                    AddAchievementWork(
                        item,
                        remaining,
                        confirmedAchievements);
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
                {
                    item.progressSaved = true;
                    AddAchievementWork(
                        item,
                        remaining,
                        confirmedAchievements);
                }
                else if (ShouldRetry(result) &&
                         item.attempts + 1 < MaximumAttempts)
                {
                    item.attempts++;
                    remaining.Add(item);
                }
                else if (result.IsCancelled)
                {
                    remaining.Add(item);
                }
            }

            queue.Replace(userId, remaining);
            return confirmedAchievements.AsReadOnly();
        }

        private static void PreserveUnprocessed(
            IReadOnlyList<PendingSubmission> items,
            int startIndex,
            string userId,
            ICollection<PendingSubmission> remaining)
        {
            for (var index = startIndex; index < items.Count; index++)
            {
                var item = items[index];
                if (item != null &&
                    string.Equals(
                        item.userId,
                        userId,
                        StringComparison.Ordinal))
                {
                    remaining.Add(item);
                }
            }
        }

        private static void AddAchievementWork(
            PendingSubmission item,
            ICollection<PendingSubmission> remaining,
            ICollection<PendingAchievementWork> work)
        {
            if (item.achievementEvidence == null)
                return;
            remaining.Add(item);
            work.Add(new PendingAchievementWork
            {
                SubmissionId = item.id,
                Evidence = item.achievementEvidence
            });
        }

        public static bool ShouldRetry<T>(ApiResult<T> result)
        {
            if (result == null || result.IsSuccess || result.IsCancelled)
                return false;
            return result.IsTimedOut ||
                   result.StatusCode == 0 ||
                   result.StatusCode == 408 ||
                   result.StatusCode == 425 ||
                   result.StatusCode == 429 ||
                   result.StatusCode >= 500;
        }
    }
}
