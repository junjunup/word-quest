using System;
using System.Reflection;
using System.Threading;
using System.Threading.Tasks;
using NUnit.Framework;
using UnityEngine.UIElements;
using WordQuest.Application;
using WordQuest.Infrastructure.Api;
using WordQuest.Infrastructure.Api.Dto;
using WordQuest.Infrastructure.Api.Services;
using WordQuest.Presentation.Screens;

namespace WordQuest.Tests
{
    public sealed class LoginScreenTests
    {
        [Test]
        public void Constructor_forces_password_field_masking()
        {
            var view = CreateView();
            var password = view.Q<TextField>("password-field");
            password.isPasswordField = false;

            using (var screen = CreateScreen(view, new ThrowingAuthService()))
            {
                Assert.That(password.isPasswordField, Is.True);
            }
        }

        [Test]
        public async Task Unexpected_login_error_restores_recoverable_ui()
        {
            var view = CreateView();
            view.Q<TextField>("username-field").value = "learner";
            view.Q<TextField>("password-field").value = "not-a-real-secret";

            using (var screen = CreateScreen(view, new ThrowingAuthService()))
            {
                var method = typeof(LoginScreen).GetMethod(
                    "AuthenticateAsync",
                    BindingFlags.Instance | BindingFlags.NonPublic);
                Assert.That(method, Is.Not.Null);

                var task = (Task)method.Invoke(screen, new object[] { false });
                try
                {
                    await task;
                }
                catch (Exception exception)
                {
                    Assert.Fail(
                        "Login errors must become visible UI state, but " +
                        $"{exception.GetType().Name} escaped.");
                }

                Assert.That(
                    view.Q<Label>("status-label").text,
                    Does.Contain("暂时无法连接"));
                Assert.That(
                    view.Q<Button>("login-button").enabledSelf,
                    Is.True);
                Assert.That(
                    view.Q<Button>("register-button").enabledSelf,
                    Is.True);
            }
        }

        [Test]
        public async Task Transport_failure_uses_a_learner_friendly_message()
        {
            var view = CreateView();
            view.Q<TextField>("username-field").value = "learner";
            view.Q<TextField>("password-field").value = "not-a-real-secret";

            using (var screen = CreateScreen(view, new FailedAuthService()))
            {
                var method = typeof(LoginScreen).GetMethod(
                    "AuthenticateAsync",
                    BindingFlags.Instance | BindingFlags.NonPublic);
                Assert.That(method, Is.Not.Null);

                await (Task)method.Invoke(screen, new object[] { false });

                Assert.That(
                    view.Q<Label>("status-label").text,
                    Is.EqualTo("暂时无法连接学习服务，请稍后重试"));
                Assert.That(
                    view.Q<Button>("login-button").enabledSelf,
                    Is.True);
                Assert.That(
                    view.Q<Button>("register-button").enabledSelf,
                    Is.True);
            }
        }

        private static LoginScreen CreateScreen(
            VisualElement view,
            IAuthService auth)
        {
            return new LoginScreen(
                view,
                auth,
                new WordQuestContext(),
                _ => new UserProfile(),
                null);
        }

        private static VisualElement CreateView()
        {
            var view = new VisualElement();
            view.Add(new TextField { name = "username-field" });
            view.Add(new TextField { name = "password-field" });
            view.Add(new TextField { name = "nickname-field" });
            view.Add(new Button { name = "login-button" });
            view.Add(new Button { name = "register-button" });
            view.Add(new Label { name = "status-label" });
            return view;
        }

        private sealed class ThrowingAuthService : IAuthService
        {
            public Task<ApiResult<AuthDataDto>> LoginAsync(
                string username,
                string password,
                CancellationToken cancellationToken)
            {
                return Task.FromException<ApiResult<AuthDataDto>>(
                    new InvalidOperationException("simulated transport fault"));
            }

            public Task<ApiResult<AuthDataDto>> RegisterAsync(
                string username,
                string password,
                string nickname,
                CancellationToken cancellationToken)
            {
                return Task.FromException<ApiResult<AuthDataDto>>(
                    new InvalidOperationException("simulated transport fault"));
            }

            public Task<ApiResult<UserDto>> GetCurrentUserAsync(
                CancellationToken cancellationToken)
            {
                return Task.FromResult(
                    ApiResult<UserDto>.Failure(0, "offline"));
            }

            public Task<ApiResult<ReminderSettingsDto>> UpdateReminderAsync(
                bool enabled,
                string time,
                CancellationToken cancellationToken)
            {
                return Task.FromResult(
                    ApiResult<ReminderSettingsDto>.Failure(0, "offline"));
            }

            public void SignOut()
            {
            }
        }

        private sealed class FailedAuthService : IAuthService
        {
            public Task<ApiResult<AuthDataDto>> LoginAsync(
                string username,
                string password,
                CancellationToken cancellationToken)
            {
                return Task.FromResult(
                    ApiResult<AuthDataDto>.Failure(
                        0,
                        "Cannot connect to destination host"));
            }

            public Task<ApiResult<AuthDataDto>> RegisterAsync(
                string username,
                string password,
                string nickname,
                CancellationToken cancellationToken)
            {
                return LoginAsync(username, password, cancellationToken);
            }

            public Task<ApiResult<UserDto>> GetCurrentUserAsync(
                CancellationToken cancellationToken)
            {
                return Task.FromResult(
                    ApiResult<UserDto>.Failure(0, "offline"));
            }

            public Task<ApiResult<ReminderSettingsDto>> UpdateReminderAsync(
                bool enabled,
                string time,
                CancellationToken cancellationToken)
            {
                return Task.FromResult(
                    ApiResult<ReminderSettingsDto>.Failure(0, "offline"));
            }

            public void SignOut()
            {
            }
        }
    }
}
