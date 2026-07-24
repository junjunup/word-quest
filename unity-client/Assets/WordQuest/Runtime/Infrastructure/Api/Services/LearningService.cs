using System;
using System.Globalization;
using System.Threading;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using UnityEngine.Networking;
using WordQuest.Infrastructure.Api.Dto;

namespace WordQuest.Infrastructure.Api.Services
{
    public sealed class LearningService : ILearningService
    {
        private readonly ApiClient client;

        public LearningService(ApiClient client)
        {
            this.client = client ?? throw new ArgumentNullException(nameof(client));
        }

        public Task<ApiResult<QuizRecordResultDto>> SubmitQuizRecordAsync(
            QuizRecordRequest request,
            CancellationToken token) =>
            client.SendJsonAsync<QuizRecordResultDto>(
                UnityWebRequest.kHttpVerbPOST,
                ApiRoutes.QuizRecord,
                request,
                token);

        public Task<ApiResult<WordDto[]>> GetTodayReviewAsync(
            int limit,
            string wordbookId,
            CancellationToken token) =>
            client.GetAsync<WordDto[]>(
                ApiRoutes.AddQuery(
                    ApiRoutes.ReviewToday,
                    ("limit", Math.Max(1, limit).ToString(CultureInfo.InvariantCulture)),
                    ("wordbookId", wordbookId)),
                token);

        public Task<ApiResult<MasterySummaryDto>> GetMasterySummaryAsync(
            string wordbookId,
            CancellationToken token) =>
            client.GetAsync<MasterySummaryDto>(
                ApiRoutes.WithQuery(
                    ApiRoutes.MasterySummary,
                    "wordbookId",
                    wordbookId),
                token);

        public Task<ApiResult<MasteryWordDto[]>> GetMasteryWordsAsync(
            string wordbookId,
            string mode,
            int limit,
            CancellationToken token) =>
            client.GetAsync<MasteryWordDto[]>(
                ApiRoutes.AddQuery(
                    ApiRoutes.MasteryWords,
                    ("wordbookId", wordbookId),
                    ("mode", mode),
                    ("limit", Math.Max(1, limit).ToString(CultureInfo.InvariantCulture))),
                token);

        public Task<ApiResult<ReviewSessionDto>> CreateReviewSessionAsync(
            ReviewSessionRequest request,
            CancellationToken token) =>
            client.SendJsonAsync<ReviewSessionDto>(
                UnityWebRequest.kHttpVerbPOST,
                ApiRoutes.ReviewSessions,
                request,
                token);

        public Task<ApiResult<ReviewSessionDto>> SubmitReviewSessionAsync(
            string sessionId,
            ReviewSubmissionRequest request,
            CancellationToken token) =>
            client.SendJsonAsync<ReviewSessionDto>(
                UnityWebRequest.kHttpVerbPOST,
                ApiRoutes.ReviewSession(sessionId),
                request,
                token);

        public Task<ApiResult<LearningStatsDto>> GetStatsAsync(
            string wordbookId,
            CancellationToken token) =>
            client.GetAsync<LearningStatsDto>(
                ApiRoutes.WithQuery(
                    ApiRoutes.LearningStats,
                    "wordbookId",
                    wordbookId),
                token);

        public Task<ApiResult<ErrorTypeStatsDto>> GetErrorTypesAsync(
            string wordbookId,
            int days,
            CancellationToken token) =>
            client.GetAsync<ErrorTypeStatsDto>(
                ApiRoutes.AddQuery(
                    ApiRoutes.ErrorTypes,
                    ("wordbookId", wordbookId),
                    ("days", days.ToString(CultureInfo.InvariantCulture))),
                token);

        public Task<ApiResult<DailyStatDto[]>> GetDailyStatsAsync(
            int days,
            CancellationToken token) =>
            client.GetAsync<DailyStatDto[]>(
                ApiRoutes.WithQuery(
                    ApiRoutes.DailyStats,
                    "days",
                    days.ToString(CultureInfo.InvariantCulture)),
                token);

        public Task<ApiResult<ChapterStatDto[]>> GetChapterStatsAsync(
            CancellationToken token) =>
            client.GetAsync<ChapterStatDto[]>(ApiRoutes.ChapterStats, token);

        public Task<ApiResult<MistakeDto[]>> GetTopMistakesAsync(
            int limit,
            CancellationToken token) =>
            client.GetAsync<MistakeDto[]>(
                ApiRoutes.WithQuery(
                    ApiRoutes.TopMistakes,
                    "limit",
                    limit.ToString(CultureInfo.InvariantCulture)),
                token);

        public async Task<ApiResult<HeatmapEntryDto[]>> GetHeatmapAsync(
            int year,
            CancellationToken token)
        {
            var raw = await client.GetRawAsync(
                ApiRoutes.WithQuery(
                    ApiRoutes.Heatmap,
                    "year",
                    year.ToString(CultureInfo.InvariantCulture)),
                token);
            if (!raw.IsSuccess)
            {
                return ApiResult<HeatmapEntryDto[]>.Failure(
                    raw.StatusCode,
                    raw.Message,
                    raw.IsCancelled,
                    raw.IsTimedOut);
            }

            var entries = new List<HeatmapEntryDto>();
            foreach (Match match in Regex.Matches(
                         raw.Data,
                         "\\[\\s*\"(?<date>\\d{4}-\\d{2}-\\d{2})\"\\s*,\\s*(?<count>\\d+)\\s*\\]"))
            {
                entries.Add(new HeatmapEntryDto
                {
                    date = match.Groups["date"].Value,
                    count = int.Parse(
                        match.Groups["count"].Value,
                        CultureInfo.InvariantCulture)
                });
            }

            return ApiResult<HeatmapEntryDto[]>.Success(
                raw.StatusCode,
                entries.ToArray());
        }
    }
}
