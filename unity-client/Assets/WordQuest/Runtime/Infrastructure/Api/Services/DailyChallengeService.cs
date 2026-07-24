using System;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine.Networking;
using WordQuest.Infrastructure.Api.Dto;

namespace WordQuest.Infrastructure.Api.Services
{
    public sealed class DailyChallengeService : IDailyChallengeService
    {
        private readonly ApiClient client;

        public DailyChallengeService(ApiClient client)
        {
            this.client = client ?? throw new ArgumentNullException(nameof(client));
        }

        public Task<ApiResult<DailyChallengeDto>> GetTodayAsync(
            string wordbookId,
            CancellationToken token) =>
            client.GetAsync<DailyChallengeDto>(
                ApiRoutes.WithQuery(
                    ApiRoutes.DailyChallengeToday,
                    "wordbookId",
                    wordbookId),
                token);

        public Task<ApiResult<DailyChallengeDto>> SubmitAsync(
            string id,
            DailyChallengeSubmitRequest request,
            CancellationToken token) =>
            client.SendJsonAsync<DailyChallengeDto>(
                UnityWebRequest.kHttpVerbPOST,
                ApiRoutes.DailyChallengeSubmit(id),
                request,
                token);

        public Task<ApiResult<DailyLeaderboardEntryDto[]>> GetLeaderboardAsync(
            string wordbookId,
            string date,
            CancellationToken token) =>
            client.GetAsync<DailyLeaderboardEntryDto[]>(
                ApiRoutes.AddQuery(
                    ApiRoutes.DailyChallengeLeaderboard,
                    ("wordbookId", wordbookId),
                    ("date", date)),
                token);
    }
}
