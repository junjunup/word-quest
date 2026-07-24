using System;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.Networking;
using WordQuest.Infrastructure.Storage;

namespace WordQuest.Infrastructure.Api
{
    public sealed class ApiClient
    {
        private readonly string baseUrl;
        private readonly ITokenStore tokenStore;
        private readonly Action unauthorized;
        private readonly int timeoutSeconds;

        public ApiClient(
            string baseUrl,
            ITokenStore tokenStore,
            Action unauthorized,
            int timeoutSeconds = 15)
        {
            this.baseUrl = (baseUrl ?? string.Empty).TrimEnd('/');
            this.tokenStore = tokenStore ??
                              throw new ArgumentNullException(nameof(tokenStore));
            this.unauthorized = unauthorized;
            this.timeoutSeconds = Math.Max(1, timeoutSeconds);
        }

        public Task<ApiResult<T>> GetAsync<T>(
            string route,
            CancellationToken cancellationToken)
        {
            return SendAsync<T>(
                UnityWebRequest.kHttpVerbGET,
                route,
                null,
                cancellationToken,
                true);
        }

        public Task<ApiResult<T>> SendJsonAsync<T>(
            string method,
            string route,
            object body,
            CancellationToken cancellationToken)
        {
            var json = body == null ? "{}" : JsonUtility.ToJson(body);
            return SendAsync<T>(
                method,
                route,
                json,
                cancellationToken,
                false);
        }

        public async Task<ApiResult<string>> GetRawAsync(
            string route,
            CancellationToken cancellationToken)
        {
            for (var attempt = 0; attempt < 2; attempt++)
            {
                using (var request = CreateRequest(
                           UnityWebRequest.kHttpVerbGET,
                           route))
                {
                    try
                    {
                        await request.SendAsync(cancellationToken);
                    }
                    catch (OperationCanceledException)
                    {
                        return ApiResult<string>.Failure(
                            request.responseCode,
                            "请求已取消",
                            true);
                    }

                    if (request.responseCode == 401)
                    {
                        tokenStore.Clear();
                        unauthorized?.Invoke();
                    }

                    if (request.result == UnityWebRequest.Result.Success &&
                        request.responseCode >= 200 &&
                        request.responseCode < 300)
                    {
                        return ApiResult<string>.Success(
                            request.responseCode,
                            request.downloadHandler?.text ?? string.Empty);
                    }

                    var transient =
                        request.result == UnityWebRequest.Result.ConnectionError ||
                        request.responseCode == 502 ||
                        request.responseCode == 503 ||
                        request.responseCode == 504;
                    if (!transient || attempt == 1)
                    {
                        return ApiResult<string>.Failure(
                            request.responseCode,
                            request.error ?? "网络请求失败");
                    }
                }
            }

            return ApiResult<string>.Failure(0, "网络请求失败");
        }

        public UnityWebRequest CreateRequest(
            string method,
            string route,
            string json = null,
            DownloadHandler downloadHandler = null)
        {
            var request = new UnityWebRequest(BuildUrl(route), method)
            {
                downloadHandler = downloadHandler ?? new DownloadHandlerBuffer(),
                timeout = timeoutSeconds
            };

            if (json != null)
            {
                request.uploadHandler = new UploadHandlerRaw(
                    Encoding.UTF8.GetBytes(json));
                request.SetRequestHeader("Content-Type", "application/json");
            }

            var token = tokenStore.Load();
            if (!string.IsNullOrWhiteSpace(token))
                request.SetRequestHeader("Authorization", $"Bearer {token}");

            return request;
        }

        private async Task<ApiResult<T>> SendAsync<T>(
            string method,
            string route,
            string json,
            CancellationToken cancellationToken,
            bool retryGet)
        {
            var attempts = retryGet ? 2 : 1;
            ApiResult<T> last = null;

            for (var attempt = 0; attempt < attempts; attempt++)
            {
                using (var request = CreateRequest(method, route, json))
                {
                    try
                    {
                        await request.SendAsync(cancellationToken);
                    }
                    catch (OperationCanceledException)
                    {
                        return ApiResult<T>.Failure(
                            request.responseCode,
                            "请求已取消",
                            true,
                            false);
                    }

                    last = Parse<T>(request);
                    if (last.IsUnauthorized)
                    {
                        tokenStore.Clear();
                        unauthorized?.Invoke();
                    }

                    var transient =
                        request.result == UnityWebRequest.Result.ConnectionError ||
                        request.responseCode == 502 ||
                        request.responseCode == 503 ||
                        request.responseCode == 504;
                    if (!transient || attempt + 1 >= attempts)
                        return last;
                }
            }

            return last ?? ApiResult<T>.Failure(0, "请求失败");
        }

        private static ApiResult<T> Parse<T>(UnityWebRequest request)
        {
            var status = request.responseCode;
            var json = request.downloadHandler?.text ?? string.Empty;

            if (request.result == UnityWebRequest.Result.Success &&
                status >= 200 &&
                status < 300)
            {
                try
                {
                    var envelope = JsonUtility.FromJson<ApiEnvelope<T>>(json);
                    if (envelope != null && envelope.success)
                        return ApiResult<T>.Success(status, envelope.data);
                    return ApiResult<T>.Failure(
                        status,
                        envelope?.message ?? "响应格式无效");
                }
                catch (ArgumentException)
                {
                    return ApiResult<T>.Failure(status, "响应解析失败");
                }
            }

            var message = request.error ?? "网络请求失败";
            try
            {
                var error = JsonUtility.FromJson<ApiErrorEnvelope>(json);
                if (!string.IsNullOrWhiteSpace(error?.message))
                    message = error.message;
            }
            catch (ArgumentException)
            {
                // Preserve the transport error without exposing the raw body.
            }

            var timedOut = request.result == UnityWebRequest.Result.ConnectionError &&
                           string.Equals(
                               request.error,
                               "Request timeout",
                               StringComparison.OrdinalIgnoreCase);
            return ApiResult<T>.Failure(status, message, false, timedOut);
        }

        private string BuildUrl(string route)
        {
            if (Uri.TryCreate(route, UriKind.Absolute, out _))
                throw new ArgumentException(
                    "API routes must be relative to the configured origin.",
                    nameof(route));

            return baseUrl + "/" + (route ?? string.Empty).TrimStart('/');
        }
    }
}
