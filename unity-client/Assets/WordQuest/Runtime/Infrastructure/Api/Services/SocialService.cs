using System;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine.Networking;
using WordQuest.Infrastructure.Api.Dto;

namespace WordQuest.Infrastructure.Api.Services
{
    public sealed class SocialService : ISocialService
    {
        private readonly ApiClient client;

        public SocialService(ApiClient client)
        {
            this.client = client ?? throw new ArgumentNullException(nameof(client));
        }

        public Task<ApiResult<PublicUserDto[]>> SearchUsersAsync(
            string query,
            CancellationToken token) =>
            client.GetAsync<PublicUserDto[]>(
                ApiRoutes.WithQuery(ApiRoutes.UserSearch, "q", query),
                token);

        public Task<ApiResult<FriendshipDto[]>> GetFriendsAsync(
            CancellationToken token) =>
            client.GetAsync<FriendshipDto[]>(ApiRoutes.Friends, token);

        public Task<ApiResult<FriendshipDto>> SendFriendRequestAsync(
            FriendRequestDto request,
            CancellationToken token) =>
            client.SendJsonAsync<FriendshipDto>(
                UnityWebRequest.kHttpVerbPOST,
                ApiRoutes.FriendRequest,
                request,
                token);

        public Task<ApiResult<FriendshipDto>> RespondAsync(
            string friendshipId,
            bool accept,
            CancellationToken token) =>
            client.SendJsonAsync<FriendshipDto>(
                UnityWebRequest.kHttpVerbPOST,
                ApiRoutes.FriendshipResponse(friendshipId),
                new FriendResponseDto { accept = accept },
                token);

        public Task<ApiResult<FriendshipDto>> DeleteAsync(
            string friendshipId,
            CancellationToken token) =>
            client.SendJsonAsync<FriendshipDto>(
                UnityWebRequest.kHttpVerbDELETE,
                ApiRoutes.Friendship(friendshipId),
                null,
                token);

        public Task<ApiResult<ChallengeDto>> CreateChallengeAsync(
            CreateChallengeRequest request,
            CancellationToken token) =>
            client.SendJsonAsync<ChallengeDto>(
                UnityWebRequest.kHttpVerbPOST,
                ApiRoutes.Challenges,
                request,
                token);

        public Task<ApiResult<ChallengeDto[]>> GetChallengesAsync(
            CancellationToken token) =>
            client.GetAsync<ChallengeDto[]>(ApiRoutes.Challenges, token);

        public Task<ApiResult<ChallengeDto>> GetChallengeAsync(
            string id,
            CancellationToken token) =>
            client.GetAsync<ChallengeDto>(ApiRoutes.Challenge(id), token);

        public Task<ApiResult<ChallengeDto>> SubmitChallengeAsync(
            string id,
            ChallengeSubmissionRequest request,
            CancellationToken token) =>
            client.SendJsonAsync<ChallengeDto>(
                UnityWebRequest.kHttpVerbPOST,
                ApiRoutes.ChallengeSubmit(id),
                request,
                token);
    }
}
