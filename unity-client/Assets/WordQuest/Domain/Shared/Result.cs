using System;

namespace WordQuest.Domain.Shared
{
    public readonly struct Result
    {
        private Result(bool success, string errorCode, string message)
        {
            IsSuccess = success;
            ErrorCode = errorCode ?? string.Empty;
            Message = message ?? string.Empty;
        }

        public bool IsSuccess { get; }
        public string ErrorCode { get; }
        public string Message { get; }

        public static Result Success()
        {
            return new Result(true, string.Empty, string.Empty);
        }

        public static Result Failure(string errorCode, string message)
        {
            return new Result(false, errorCode, message);
        }
    }

    public readonly struct Result<T>
    {
        private Result(bool success, T value, string errorCode, string message)
        {
            IsSuccess = success;
            Value = value;
            ErrorCode = errorCode ?? string.Empty;
            Message = message ?? string.Empty;
        }

        public bool IsSuccess { get; }
        public T Value { get; }
        public string ErrorCode { get; }
        public string Message { get; }

        public static Result<T> Success(T value)
        {
            return new Result<T>(true, value, string.Empty, string.Empty);
        }

        public static Result<T> Failure(string errorCode, string message)
        {
            return new Result<T>(false, default, errorCode, message);
        }

        public T OrThrow()
        {
            if (!IsSuccess)
                throw new InvalidOperationException($"{ErrorCode}: {Message}");

            return Value;
        }
    }
}
