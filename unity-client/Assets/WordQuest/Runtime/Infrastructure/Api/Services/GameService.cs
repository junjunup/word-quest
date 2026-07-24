using System;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine.Networking;
using WordQuest.Infrastructure.Api.Dto;

namespace WordQuest.Infrastructure.Api.Services
{
    public sealed class GameService : IGameService
    {
        private readonly ApiClient client;

        public GameService(ApiClient client)
        {
            this.client = client ?? throw new ArgumentNullException(nameof(client));
        }

        public Task<ApiResult<ProgressDto>> GetProgressAsync(
            CancellationToken token) =>
            client.GetAsync<ProgressDto>(ApiRoutes.Progress, token);

        public Task<ApiResult<ProgressDto>> SaveProgressAsync(
            SaveProgressRequest request,
            CancellationToken token) =>
            client.SendJsonAsync<ProgressDto>(
                UnityWebRequest.kHttpVerbPOST,
                ApiRoutes.SaveProgress,
                request,
                token);

        public Task<ApiResult<LeaderboardEntryDto[]>> GetLeaderboardAsync(
            string type,
            CancellationToken token) =>
            client.GetAsync<LeaderboardEntryDto[]>(
                ApiRoutes.WithQuery(ApiRoutes.Leaderboard, "type", type),
                token);

        public Task<ApiResult<AchievementDto[]>> GetAchievementsAsync(
            CancellationToken token) =>
            client.GetAsync<AchievementDto[]>(ApiRoutes.Achievements, token);

        public Task<ApiResult<AchievementDto[]>> SaveAchievementAsync(
            AchievementRequest request,
            CancellationToken token) =>
            client.SendJsonAsync<AchievementDto[]>(
                UnityWebRequest.kHttpVerbPOST,
                ApiRoutes.Achievements,
                request,
                token);

        public Task<ApiResult<DailyRewardDto>> ClaimDailyRewardAsync(
            CancellationToken token) =>
            client.SendJsonAsync<DailyRewardDto>(
                UnityWebRequest.kHttpVerbPOST,
                ApiRoutes.DailyReward,
                new object(),
                token);

        public Task<ApiResult<UserDto>> UpdateCharacterAsync(
            int characterIndex,
            CancellationToken token) =>
            client.SendJsonAsync<UserDto>(
                UnityWebRequest.kHttpVerbPUT,
                ApiRoutes.Character,
                new CharacterRequest { characterSpriteIndex = characterIndex },
                token);

        public Task<ApiResult<LevelsStatusDto>> GetLevelsStatusAsync(
            string wordbookId,
            CancellationToken token) =>
            client.GetAsync<LevelsStatusDto>(
                ApiRoutes.WithQuery(
                    ApiRoutes.LevelsStatus,
                    "wordbookId",
                    wordbookId),
                token);

        public Task<ApiResult<EndlessScoreDto>> SubmitEndlessScoreAsync(
            int score,
            int maximumStreak,
            CancellationToken token) =>
            client.SendJsonAsync<EndlessScoreDto>(
                UnityWebRequest.kHttpVerbPOST,
                ApiRoutes.EndlessScore,
                new EndlessScoreRequest
                {
                    score = score,
                    maxStreak = maximumStreak
                },
                token);

        public Task<ApiResult<EndlessScoreDto>> GetEndlessBestAsync(
            CancellationToken token) =>
            client.GetAsync<EndlessScoreDto>(ApiRoutes.EndlessScore, token);
    }
}
