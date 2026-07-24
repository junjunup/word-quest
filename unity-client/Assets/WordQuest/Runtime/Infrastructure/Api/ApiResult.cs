using System;

namespace WordQuest.Infrastructure.Api
{
    [Serializable]
    public sealed class ApiEnvelope<T>
    {
        public bool success;
        public T data;
        public string message;
    }

    [Serializable]
    internal sealed class ApiErrorEnvelope
    {
        public bool success;
        public string message;
    }

    public sealed class ApiResult<T>
    {
        private ApiResult(
            bool success,
            long statusCode,
            T data,
            string message,
            bool cancelled,
            bool timedOut)
        {
            IsSuccess = success;
            StatusCode = statusCode;
            Data = data;
            Message = message ?? string.Empty;
            IsCancelled = cancelled;
            IsTimedOut = timedOut;
        }

        public bool IsSuccess { get; }
        public long StatusCode { get; }
        public T Data { get; }
        public string Message { get; }
        public bool IsCancelled { get; }
        public bool IsTimedOut { get; }
        public bool IsUnauthorized => StatusCode == 401;

        public static ApiResult<T> Success(long statusCode, T data)
        {
            return new ApiResult<T>(
                true,
                statusCode,
                data,
                string.Empty,
                false,
                false);
        }

        public static ApiResult<T> Failure(
            long statusCode,
            string message,
            bool cancelled = false,
            bool timedOut = false)
        {
            return new ApiResult<T>(
                false,
                statusCode,
                default,
                message,
                cancelled,
                timedOut);
        }
    }
}
