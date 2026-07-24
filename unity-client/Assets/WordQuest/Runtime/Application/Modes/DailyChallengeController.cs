using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using WordQuest.Infrastructure.Api;
using WordQuest.Infrastructure.Api.Dto;
using WordQuest.Infrastructure.Api.Services;

namespace WordQuest.Application.Modes
{
    public sealed class DailyChallengeController
    {
        private readonly IDailyChallengeService service;
        private readonly string wordbookId;
        private bool submitting;

        public DailyChallengeController(
            IDailyChallengeService service,
            string wordbookId)
        {
            this.service = service ??
                           throw new ArgumentNullException(nameof(service));
            this.wordbookId = string.IsNullOrWhiteSpace(wordbookId)
                ? "cet4"
                : wordbookId;
        }

        public Task<ApiResult<DailyChallengeDto>> LoadTodayAsync(
            CancellationToken token)
        {
            return service.GetTodayAsync(wordbookId, token);
        }

        public async Task<ApiResult<DailyChallengeDto>> SubmitAsync(
            string id,
            IReadOnlyList<ChallengeAnswerDto> answers,
            int durationMs,
            CancellationToken token)
        {
            if (submitting)
            {
                return ApiResult<DailyChallengeDto>.Failure(
                    409,
                    "每日挑战正在提交");
            }

            submitting = true;
            try
            {
                return await service.SubmitAsync(
                    id,
                    new DailyChallengeSubmitRequest
                    {
                        answers = answers == null
                            ? Array.Empty<ChallengeAnswerDto>()
                            : new List<ChallengeAnswerDto>(answers).ToArray(),
                        durationMs = Math.Max(0, durationMs)
                    },
                    token);
            }
            finally
            {
                submitting = false;
            }
        }

        public Task<ApiResult<DailyLeaderboardEntryDto[]>> GetLeaderboardAsync(
            string date,
            CancellationToken token)
        {
            return service.GetLeaderboardAsync(wordbookId, date, token);
        }
    }
}
