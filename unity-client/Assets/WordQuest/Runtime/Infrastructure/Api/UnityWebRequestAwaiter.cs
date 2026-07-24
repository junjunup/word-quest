using System;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine.Networking;

namespace WordQuest.Infrastructure.Api
{
    public static class UnityWebRequestAwaiter
    {
        public static Task<UnityWebRequest> SendAsync(
            this UnityWebRequest request,
            CancellationToken cancellationToken)
        {
            var completion = new TaskCompletionSource<UnityWebRequest>();
            var operation = request.SendWebRequest();
            CancellationTokenRegistration registration = default;

            operation.completed += _ =>
            {
                registration.Dispose();
                completion.TrySetResult(request);
            };

            if (cancellationToken.CanBeCanceled)
            {
                registration = cancellationToken.Register(() =>
                {
                    request.Abort();
                    completion.TrySetCanceled(cancellationToken);
                });
            }

            return completion.Task;
        }
    }
}
