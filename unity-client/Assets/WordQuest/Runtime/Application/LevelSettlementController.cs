using System;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.Networking;
using WordQuest.Domain.Game;
using WordQuest.Infrastructure.Api;
using WordQuest.Infrastructure.Api.Dto;
using WordQuest.Infrastructure.Storage;

namespace WordQuest.Application
{
    public sealed class LevelSettlementController
    {
        private readonly Func<
            SaveProgressRequest,
            CancellationToken,
            Task<ApiResult<ProgressDto>>> saveProgress;
        private readonly PendingSyncQueue pending;
        private readonly Func<string> createSettlementId;
        private readonly Func<long> currentUnixTimeMs;

        public LevelSettlementController(
            Func<
                SaveProgressRequest,
                CancellationToken,
                Task<ApiResult<ProgressDto>>> saveProgress,
            PendingSyncQueue pending,
            Func<string> createSettlementId = null,
            Func<long> currentUnixTimeMs = null)
        {
            this.saveProgress = saveProgress ??
                throw new ArgumentNullException(nameof(saveProgress));
            this.pending = pending ??
                throw new ArgumentNullException(nameof(pending));
            this.createSettlementId = createSettlementId ??
                (() => Guid.NewGuid().ToString("N"));
            this.currentUnixTimeMs = currentUnixTimeMs ??
                (() => DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
        }

        public async Task SettleAsync(
            LevelResult result,
            bool completed,
            string wordbookId,
            string userId,
            CancellationToken token)
        {
            if (result == null)
                throw new ArgumentNullException(nameof(result));
            if (string.IsNullOrWhiteSpace(userId))
            {
                throw new ArgumentException(
                    "A signed-in user is required for level settlement.",
                    nameof(userId));
            }

            if (!completed)
            {
                result.RecordSettlement(
                    false,
                    false,
                    false,
                    string.Empty);
                return;
            }

            userId = userId.Trim();
            wordbookId = string.IsNullOrWhiteSpace(wordbookId)
                ? "cet4"
                : wordbookId.Trim();
            var request = new SaveProgressRequest
            {
                chapter = result.Chapter,
                level = result.Level,
                stars = result.Stars,
                score = result.Score,
                sessionId = result.SessionId,
                wordbookId = wordbookId
            };
            var saved = await saveProgress(request, token);
            var progressSaved = saved != null && saved.IsSuccess;
            var progressPending = PendingSettlementSync.ShouldRetry(saved);
            var settlementId =
                progressSaved || progressPending
                    ? createSettlementId()
                    : string.Empty;
            result.RecordSettlement(
                true,
                progressSaved,
                progressPending,
                settlementId);

            if (!result.ProgressSaved && !result.ProgressPending)
                return;

            pending.Enqueue(
                userId,
                new PendingSubmission
                {
                    id = result.SettlementId,
                    userId = userId,
                    route = ApiRoutes.SaveProgress,
                    method = UnityWebRequest.kHttpVerbPOST,
                    jsonBody = JsonUtility.ToJson(request),
                    createdAtUnixMs = currentUnixTimeMs(),
                    progressSaved = result.ProgressSaved,
                    achievementEvidence =
                        AchievementRunEvidence.From(
                            result,
                            wordbookId)
                });
        }
    }
}
