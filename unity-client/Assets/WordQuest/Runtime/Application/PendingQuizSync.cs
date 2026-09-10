using System.Threading;
using System.Threading.Tasks;
using WordQuest.Infrastructure.Api.Services;
using WordQuest.Infrastructure.Storage;
namespace WordQuest.Application
{
    public static class PendingQuizSync
    {
        public static async Task FlushAsync(PendingSyncQueue queue, ILearningService service, string userId, CancellationToken token)
        {
            foreach (var request in queue.ReadQuizzes(userId))
            {
                if (token.IsCancellationRequested) return;
                var result = await service.SubmitQuizRecordAsync(request, token);
                if (result.IsSuccess || (result.StatusCode >= 400 && result.StatusCode < 500 &&
                    result.StatusCode != 401 && result.StatusCode != 408 && result.StatusCode != 429))
                    queue.RemoveQuiz(userId, request.attemptId);
                else return;
            }
        }
    }
}
