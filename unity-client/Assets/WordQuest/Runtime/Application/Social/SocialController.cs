using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using WordQuest.Infrastructure.Api;
using WordQuest.Infrastructure.Api.Dto;
using WordQuest.Infrastructure.Api.Services;

namespace WordQuest.Application.Social
{
    public enum SocialBucket
    {
        Incoming,
        Outgoing,
        Accepted,
        Other
    }

    public sealed class SocialViewModel
    {
        public IReadOnlyList<FriendshipDto> Incoming { get; set; } =
            Array.Empty<FriendshipDto>();
        public IReadOnlyList<FriendshipDto> Outgoing { get; set; } =
            Array.Empty<FriendshipDto>();
        public IReadOnlyList<FriendshipDto> Friends { get; set; } =
            Array.Empty<FriendshipDto>();
        public IReadOnlyList<ChallengeDto> Challenges { get; set; } =
            Array.Empty<ChallengeDto>();
        public IReadOnlyList<string> Warnings { get; set; } =
            Array.Empty<string>();
    }

    public static class SocialProjection
    {
        public static SocialBucket Bucket(FriendshipDto friendship)
        {
            if (friendship?.status == "accepted" ||
                friendship?.direction == "accepted")
                return SocialBucket.Accepted;
            if (friendship?.direction == "incoming")
                return SocialBucket.Incoming;
            if (friendship?.direction == "outgoing")
                return SocialBucket.Outgoing;
            return SocialBucket.Other;
        }

        public static bool CanSubmit(
            ChallengeDto challenge,
            bool alreadySubmitted,
            DateTimeOffset now)
        {
            if (challenge == null || alreadySubmitted ||
                challenge.status == "completed" ||
                challenge.status == "cancelled")
                return false;
            return !DateTimeOffset.TryParse(
                       challenge.expiresAt,
                       out var expires) ||
                   expires > now;
        }

        public static bool IsCurrentUser(string currentId, string rowId)
        {
            return !string.IsNullOrWhiteSpace(currentId) &&
                   string.Equals(currentId, rowId, StringComparison.Ordinal);
        }

        public static int NormalizeQuestionCount(int value)
        {
            return Math.Max(3, Math.Min(value, 20));
        }
    }

    public sealed class SocialController
    {
        private readonly ISocialService social;

        public SocialController(ISocialService social)
        {
            this.social = social ??
                          throw new ArgumentNullException(nameof(social));
        }

        public async Task<SocialViewModel> RefreshAsync(
            CancellationToken token)
        {
            var friendsTask = social.GetFriendsAsync(token);
            var challengesTask = social.GetChallengesAsync(token);
            await Task.WhenAll(friendsTask, challengesTask);
            var friends = await friendsTask;
            var challenges = await challengesTask;
            var rows = friends.Data ?? Array.Empty<FriendshipDto>();
            var warnings = new List<string>();
            if (!friends.IsSuccess)
                warnings.Add(friends.Message);
            if (!challenges.IsSuccess)
                warnings.Add(challenges.Message);

            return new SocialViewModel
            {
                Incoming = rows.Where(item =>
                    SocialProjection.Bucket(item) == SocialBucket.Incoming).ToArray(),
                Outgoing = rows.Where(item =>
                    SocialProjection.Bucket(item) == SocialBucket.Outgoing).ToArray(),
                Friends = rows.Where(item =>
                    SocialProjection.Bucket(item) == SocialBucket.Accepted).ToArray(),
                Challenges = challenges.Data ?? Array.Empty<ChallengeDto>(),
                Warnings = warnings.AsReadOnly()
            };
        }

        public Task<ApiResult<PublicUserDto[]>> SearchUsersAsync(
            string query,
            CancellationToken token) =>
            social.SearchUsersAsync(query, token);

        public Task<ApiResult<FriendshipDto>> SendFriendRequestAsync(
            string userId,
            CancellationToken token) =>
            social.SendFriendRequestAsync(
                new FriendRequestDto { userId = userId },
                token);

        public Task<ApiResult<FriendshipDto>> RespondAsync(
            string id,
            bool accept,
            CancellationToken token) =>
            social.RespondAsync(id, accept, token);

        public Task<ApiResult<FriendshipDto>> DeleteAsync(
            string id,
            CancellationToken token) =>
            social.DeleteAsync(id, token);

        public Task<ApiResult<ChallengeDto>> CreateChallengeAsync(
            string opponentId,
            string wordbookId,
            int questionCount,
            CancellationToken token) =>
            social.CreateChallengeAsync(
                new CreateChallengeRequest
                {
                    opponentId = opponentId,
                    wordbookId = wordbookId,
                    questionCount =
                        SocialProjection.NormalizeQuestionCount(questionCount)
                },
                token);

        public Task<ApiResult<ChallengeDto>> GetChallengeAsync(
            string id,
            CancellationToken token) =>
            social.GetChallengeAsync(id, token);

        public Task<ApiResult<ChallengeDto>> SubmitChallengeAsync(
            string id,
            IReadOnlyList<ChallengeAnswerDto> answers,
            CancellationToken token) =>
            social.SubmitChallengeAsync(
                id,
                new ChallengeSubmissionRequest
                {
                    answers = answers == null
                        ? Array.Empty<ChallengeAnswerDto>()
                        : new List<ChallengeAnswerDto>(answers).ToArray()
                },
                token);
    }
}
