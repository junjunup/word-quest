using System.Threading;
using System.Threading.Tasks;
using WordQuest.Infrastructure.Api.Dto;
namespace WordQuest.Infrastructure.Api.Services
{
    public interface IDailyLearningService
    {
        Task<ApiResult<DailyLearningSessionDto>> AcknowledgeAsync(string id, string wordId, CancellationToken token);
        Task<ApiResult<DailyLearningSessionDto>> CurrentAsync(string wordbookId, CancellationToken token);
        Task<ApiResult<DailyLearningSessionDto>> CreateAsync(string wordbookId, CancellationToken token);
        Task<ApiResult<DailyLearningSessionDto>> ReadAsync(string id, CancellationToken token);
        Task<ApiResult<DailyLearningSessionDto>> EndAsync(string id, CancellationToken token);
        Task<ApiResult<LearningEvidenceDto>> EvidenceAsync(string wordbookId, CancellationToken token);
    }
    public sealed class DailyLearningService : IDailyLearningService
    {
        private readonly ApiClient client;
        private const string Sessions = "/api/learning/daily-sessions";
        public DailyLearningService(ApiClient client) { this.client = client; }
        public Task<ApiResult<DailyLearningSessionDto>> AcknowledgeAsync(string id, string wordId, CancellationToken token) =>
            client.SendJsonAsync<DailyLearningSessionDto>("POST", Sessions + "/" + System.Uri.EscapeDataString(id) + "/feedback", new DailyFeedbackRequest { wordId = wordId }, token);
        public Task<ApiResult<DailyLearningSessionDto>> CurrentAsync(string wordbookId, CancellationToken token) =>
            client.GetAsync<DailyLearningSessionDto>(ApiRoutes.WithQuery(Sessions, "wordbookId", wordbookId), token);
        public Task<ApiResult<DailyLearningSessionDto>> CreateAsync(string wordbookId, CancellationToken token) =>
            client.SendJsonAsync<DailyLearningSessionDto>("POST", Sessions, new DailyLearningRequest { wordbookId = wordbookId }, token);
        public Task<ApiResult<DailyLearningSessionDto>> ReadAsync(string id, CancellationToken token) =>
            client.GetAsync<DailyLearningSessionDto>(Sessions + "/" + System.Uri.EscapeDataString(id), token);
        public Task<ApiResult<DailyLearningSessionDto>> EndAsync(string id, CancellationToken token) =>
            client.SendJsonAsync<DailyLearningSessionDto>("POST", Sessions + "/" + System.Uri.EscapeDataString(id) + "/end", null, token);
        public Task<ApiResult<LearningEvidenceDto>> EvidenceAsync(string wordbookId, CancellationToken token) =>
            client.GetAsync<LearningEvidenceDto>(ApiRoutes.WithQuery("/api/learning/evidence", "wordbookId", wordbookId), token);
    }
}
