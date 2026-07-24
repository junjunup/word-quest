using System;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine.Networking;
using WordQuest.Infrastructure.Api.Dto;
using WordQuest.Infrastructure.Storage;

namespace WordQuest.Infrastructure.Api.Services
{
    public sealed class AuthService : IAuthService
    {
        private readonly ApiClient client;
        private readonly ITokenStore tokens;

        public AuthService(ApiClient client, ITokenStore tokens)
        {
            this.client = client ?? throw new ArgumentNullException(nameof(client));
            this.tokens = tokens ?? throw new ArgumentNullException(nameof(tokens));
        }

        public async Task<ApiResult<AuthDataDto>> LoginAsync(
            string username,
            string password,
            CancellationToken cancellationToken)
        {
            var result = await client.SendJsonAsync<AuthDataDto>(
                UnityWebRequest.kHttpVerbPOST,
                ApiRoutes.Login,
                new LoginRequest { username = username, password = password },
                cancellationToken);
            PersistToken(result);
            return result;
        }

        public async Task<ApiResult<AuthDataDto>> RegisterAsync(
            string username,
            string password,
            string nickname,
            CancellationToken cancellationToken)
        {
            var result = await client.SendJsonAsync<AuthDataDto>(
                UnityWebRequest.kHttpVerbPOST,
                ApiRoutes.Register,
                new RegisterRequest
                {
                    username = username,
                    password = password,
                    nickname = nickname
                },
                cancellationToken);
            PersistToken(result);
            return result;
        }

        public Task<ApiResult<UserDto>> GetCurrentUserAsync(
            CancellationToken cancellationToken)
        {
            return client.GetAsync<UserDto>(
                ApiRoutes.CurrentUser,
                cancellationToken);
        }

        public Task<ApiResult<ReminderSettingsDto>> UpdateReminderAsync(
            bool enabled,
            string time,
            CancellationToken cancellationToken)
        {
            return client.SendJsonAsync<ReminderSettingsDto>(
                UnityWebRequest.kHttpVerbPUT,
                ApiRoutes.ReminderSettings,
                new ReminderSettingsRequest { enabled = enabled, time = time },
                cancellationToken);
        }

        public void SignOut()
        {
            tokens.Clear();
        }

        private void PersistToken(ApiResult<AuthDataDto> result)
        {
            if (result.IsSuccess &&
                !string.IsNullOrWhiteSpace(result.Data?.token))
            {
                tokens.Save(result.Data.token);
            }
        }
    }
}
