using System;
using System.Globalization;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine.Networking;
using WordQuest.Infrastructure.Api.Dto;

namespace WordQuest.Infrastructure.Api.Services
{
    public sealed class PronunciationService : IPronunciationService
    {
        private readonly ApiClient client;

        public PronunciationService(ApiClient client)
        {
            this.client = client ?? throw new ArgumentNullException(nameof(client));
        }

        public Task<ApiResult<PronunciationResultDto>> ScoreAsync(
            PronunciationRequest request,
            CancellationToken token) =>
            client.SendJsonAsync<PronunciationResultDto>(
                UnityWebRequest.kHttpVerbPOST,
                ApiRoutes.PronunciationScore,
                request,
                token);

        public Task<ApiResult<PronunciationResultDto[]>> GetHistoryAsync(
            string word,
            int limit,
            CancellationToken token) =>
            client.GetAsync<PronunciationResultDto[]>(
                ApiRoutes.AddQuery(
                    ApiRoutes.PronunciationHistory,
                    ("word", word),
                    ("limit", limit.ToString(CultureInfo.InvariantCulture))),
                token);
    }
}
