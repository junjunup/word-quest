using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using WordQuest.Infrastructure.Api;
using WordQuest.Infrastructure.Api.Dto;
using WordQuest.Infrastructure.Api.Services;

namespace WordQuest.Application.Modes
{
    public sealed class ReviewModeController
    {
        private readonly ILearningService learning;
        private readonly string wordbookId;
        private bool submitted;

        public ReviewModeController(
            ILearningService learning,
            string wordbookId)
        {
            this.learning = learning ??
                            throw new ArgumentNullException(nameof(learning));
            this.wordbookId = string.IsNullOrWhiteSpace(wordbookId)
                ? "cet4"
                : wordbookId;
        }

        public async Task<ApiResult<ReviewSessionDto>> CreateAsync(
            int limit,
            CancellationToken token)
        {
            submitted = false;
            return await learning.CreateReviewSessionAsync(
                new ReviewSessionRequest
                {
                    wordbookId = wordbookId,
                    limit = Math.Max(1, Math.Min(limit, 100))
                },
                token);
        }

        public async Task<ApiResult<ReviewSessionDto>> SubmitAsync(
            string sessionId,
            IReadOnlyList<ReviewAnswerDto> answers,
            CancellationToken token)
        {
            if (submitted)
            {
                return ApiResult<ReviewSessionDto>.Failure(
                    409,
                    "复习会话已经提交");
            }

            submitted = true;
            var result = await learning.SubmitReviewSessionAsync(
                sessionId,
                new ReviewSubmissionRequest
                {
                    answers = answers == null
                        ? Array.Empty<ReviewAnswerDto>()
                        : new List<ReviewAnswerDto>(answers).ToArray()
                },
                token);
            if (!result.IsSuccess && result.StatusCode == 0)
                submitted = false;
            return result;
        }
    }
}
