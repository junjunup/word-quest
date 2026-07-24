using System;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine.Networking;
using WordQuest.Infrastructure.Api.Dto;

namespace WordQuest.Infrastructure.Api.Services
{
    public sealed class VocabularyService : IVocabularyService
    {
        private readonly ApiClient client;

        public VocabularyService(ApiClient client)
        {
            this.client = client ?? throw new ArgumentNullException(nameof(client));
        }

        public Task<ApiResult<WordDto[]>> GetLevelWordsAsync(
            int chapter,
            int level,
            string wordbookId,
            CancellationToken token) =>
            client.GetAsync<WordDto[]>(
                ApiRoutes.WithQuery(
                    ApiRoutes.Level(chapter, level),
                    "wordbookId",
                    wordbookId),
                token);

        public Task<ApiResult<WordDto[]>> GetChapterWordsAsync(
            int chapter,
            string wordbookId,
            CancellationToken token) =>
            client.GetAsync<WordDto[]>(
                ApiRoutes.WithQuery(
                    ApiRoutes.Chapter(chapter),
                    "wordbookId",
                    wordbookId),
                token);

        public Task<ApiResult<QuizDto>> GetQuizAsync(
            string wordId,
            string questionType,
            CancellationToken token) =>
            client.GetAsync<QuizDto>(
                ApiRoutes.WithQuery(
                    ApiRoutes.Quiz(wordId),
                    "questionType",
                    questionType),
                token);

        public Task<ApiResult<WordDto[]>> SearchAsync(
            string query,
            CancellationToken token) =>
            client.GetAsync<WordDto[]>(
                ApiRoutes.WithQuery(ApiRoutes.VocabularySearch, "q", query),
                token);

        public Task<ApiResult<WordbookDto[]>> GetWordbooksAsync(
            CancellationToken token) =>
            client.GetAsync<WordbookDto[]>(ApiRoutes.Wordbooks, token);

        public Task<ApiResult<VocabularyStatsDto>> GetStatsAsync(
            string wordbookId,
            CancellationToken token) =>
            client.GetAsync<VocabularyStatsDto>(
                ApiRoutes.WithQuery(
                    ApiRoutes.VocabularyStats,
                    "wordbookId",
                    wordbookId),
                token);

        public Task<ApiResult<VocabularyImportDto>> ImportAsync(
            VocabularyImportRequest request,
            CancellationToken token) =>
            client.SendJsonAsync<VocabularyImportDto>(
                UnityWebRequest.kHttpVerbPOST,
                ApiRoutes.VocabularyImport,
                request,
                token);
    }
}
