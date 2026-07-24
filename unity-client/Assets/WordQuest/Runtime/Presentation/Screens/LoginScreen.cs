using System;
using System.Threading;
using System.Threading.Tasks;
using UnityEngine.UIElements;
using WordQuest.Application;
using WordQuest.Infrastructure.Api.Dto;
using WordQuest.Infrastructure.Api.Services;

namespace WordQuest.Presentation.Screens
{
    public sealed class LoginScreen : IDisposable
    {
        private readonly VisualElement view;
        private readonly IAuthService auth;
        private readonly WordQuestContext context;
        private readonly Func<UserDto, UserProfile> mapUser;
        private readonly Action signedIn;
        private readonly CancellationTokenSource lifetime =
            new CancellationTokenSource();

        public LoginScreen(
            VisualElement view,
            IAuthService auth,
            WordQuestContext context,
            Func<UserDto, UserProfile> mapUser,
            Action signedIn)
        {
            this.view = view ?? throw new ArgumentNullException(nameof(view));
            this.auth = auth ?? throw new ArgumentNullException(nameof(auth));
            this.context = context ??
                           throw new ArgumentNullException(nameof(context));
            this.mapUser = mapUser ??
                           throw new ArgumentNullException(nameof(mapUser));
            this.signedIn = signedIn;

            view.Q<Button>("login-button").clicked += OnLogin;
            view.Q<Button>("register-button").clicked += OnRegister;
        }

        public void Dispose()
        {
            lifetime.Cancel();
            lifetime.Dispose();
        }

        private async void OnLogin()
        {
            await AuthenticateAsync(false);
        }

        private async void OnRegister()
        {
            await AuthenticateAsync(true);
        }

        private async Task AuthenticateAsync(bool register)
        {
            var username = view.Q<TextField>("username-field").value?.Trim();
            var password = view.Q<TextField>("password-field").value;
            var nickname = view.Q<TextField>("nickname-field")?.value?.Trim();
            var status = view.Q<Label>("status-label");
            var login = view.Q<Button>("login-button");
            var registerButton = view.Q<Button>("register-button");

            if (string.IsNullOrWhiteSpace(username) ||
                string.IsNullOrWhiteSpace(password))
            {
                status.text = "请输入用户名和密码";
                return;
            }

            login.SetEnabled(false);
            registerButton.SetEnabled(false);
            status.text = register ? "正在创建账号…" : "正在登录…";

            try
            {
                var result = register
                    ? await auth.RegisterAsync(
                        username,
                        password,
                        string.IsNullOrWhiteSpace(nickname) ? username : nickname,
                        lifetime.Token)
                    : await auth.LoginAsync(
                        username,
                        password,
                        lifetime.Token);

                if (!result.IsSuccess)
                {
                    status.text = result.Message;
                    return;
                }

                context.SignIn(mapUser(result.Data.user));
                signedIn?.Invoke();
            }
            catch (OperationCanceledException)
            {
                status.text = "操作已取消";
            }
            finally
            {
                login.SetEnabled(true);
                registerButton.SetEnabled(true);
            }
        }
    }
}
