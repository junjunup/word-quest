using System;
using System.Threading;
using UnityEngine;
using UnityEngine.UIElements;
using WordQuest.Application;
using WordQuest.Infrastructure.Api;
using WordQuest.Infrastructure.Api.Dto;
using WordQuest.Infrastructure.Api.Services;
using WordQuest.Infrastructure.Storage;
using WordQuest.Presentation.Screens;

namespace WordQuest.Presentation
{
    public sealed class WordQuestApp : MonoBehaviour
    {
        private CancellationTokenSource lifetime;
        private LoginScreen loginScreen;
        private ScreenRouter router;

        public WordQuestContext Context { get; private set; }
        public AppStateMachine StateMachine { get; private set; }
        public IAuthService Auth { get; private set; }
        public IGameService Game { get; private set; }
        public IVocabularyService Vocabulary { get; private set; }
        public ILearningService Learning { get; private set; }
        public IDailyChallengeService DailyChallenge { get; private set; }
        public ISocialService Social { get; private set; }
        public IPronunciationService Pronunciation { get; private set; }
        public IChatService Chat { get; private set; }

        [RuntimeInitializeOnLoadMethod(
            RuntimeInitializeLoadType.BeforeSceneLoad)]
        private static void Install()
        {
            if (FindAnyObjectByType<WordQuestApp>() != null)
                return;

            new GameObject("WordQuest App").AddComponent<WordQuestApp>();
        }

        private void Awake()
        {
            var apps = FindObjectsByType<WordQuestApp>(
                FindObjectsSortMode.None);
            if (apps.Length > 1)
            {
                Destroy(gameObject);
                return;
            }

            DontDestroyOnLoad(gameObject);
            lifetime = new CancellationTokenSource();
            ComposeServices();
            BuildUi();
            _ = RestoreSessionAsync();
        }

        private void OnDestroy()
        {
            loginScreen?.Dispose();
            lifetime?.Cancel();
            lifetime?.Dispose();
        }

        private void ComposeServices()
        {
            StateMachine = new AppStateMachine();
            Context = new WordQuestContext();

            var preferences = new PlayerPrefsStore();
            var tokenStore = new TokenStore(preferences);
            var origin = preferences.GetString(
                "wordquest:api-origin",
                "http://localhost:3000");
            var client = new ApiClient(
                origin,
                tokenStore,
                () => ShowAuthentication());

            Auth = new AuthService(client, tokenStore);
            Game = new GameService(client);
            Vocabulary = new VocabularyService(client);
            Learning = new LearningService(client);
            DailyChallenge = new DailyChallengeService(client);
            Social = new SocialService(client);
            Pronunciation = new PronunciationService(client);
            Chat = new ChatService(client);
        }

        private void BuildUi()
        {
            var uiObject = new GameObject("WordQuest UI");
            uiObject.SetActive(false);
            uiObject.transform.SetParent(transform, false);
            var document = uiObject.AddComponent<UIDocument>();
            var settings = ScriptableObject.CreateInstance<PanelSettings>();
            settings.name = "WordQuest Runtime Panel";
            settings.scaleMode = PanelScaleMode.ScaleWithScreenSize;
            settings.referenceResolution = new Vector2Int(1440, 900);
            settings.screenMatchMode = PanelScreenMatchMode.MatchWidthOrHeight;
            settings.match = 0.5f;
            document.panelSettings = settings;
            uiObject.SetActive(true);

            router = new ScreenRouter(document.rootVisualElement);
            router.ScreenRequested += Navigate;
        }

        private async System.Threading.Tasks.Task RestoreSessionAsync()
        {
            var result = await Auth.GetCurrentUserAsync(lifetime.Token);
            if (result.IsSuccess)
            {
                Context.SignIn(MapUser(result.Data));
                StateMachine.TryTransition(AppState.Home);
                ShowHome();
                return;
            }

            ShowAuthentication();
        }

        private void ShowAuthentication()
        {
            Context.SignOut();
            StateMachine.TryTransition(AppState.Authentication);
            loginScreen?.Dispose();
            var view = router.Show(ScreenId.Login);
            loginScreen = new LoginScreen(
                view,
                Auth,
                Context,
                MapUser,
                () =>
                {
                    StateMachine.TryTransition(AppState.Home);
                    ShowHome();
                });
        }

        private void ShowHome()
        {
            loginScreen?.Dispose();
            loginScreen = null;
            var view = router.Show(ScreenId.Home);
            _ = new HomeScreen(view, Context, Navigate);
        }

        public void Navigate(ScreenId screen)
        {
            if (screen == ScreenId.Login)
            {
                Auth.SignOut();
                ShowAuthentication();
                return;
            }

            var state = MapState(screen);
            if (!StateMachine.TryTransition(state))
            {
                if (StateMachine.Current != AppState.Home)
                    StateMachine.TryTransition(AppState.Home);
                if (state != AppState.Home)
                    StateMachine.TryTransition(state);
            }

            if (screen == ScreenId.Home)
                ShowHome();
            else
                router.Show(screen);
        }

        private static AppState MapState(ScreenId screen)
        {
            switch (screen)
            {
                case ScreenId.Login: return AppState.Authentication;
                case ScreenId.Home: return AppState.Home;
                case ScreenId.Game:
                case ScreenId.LevelSelect: return AppState.Game;
                case ScreenId.Result: return AppState.Result;
                case ScreenId.Review: return AppState.Review;
                case ScreenId.Endless: return AppState.Endless;
                case ScreenId.DailyChallenge: return AppState.DailyChallenge;
                case ScreenId.Reports:
                case ScreenId.Leaderboard: return AppState.Reports;
                case ScreenId.Vocabulary:
                case ScreenId.Pronunciation: return AppState.Vocabulary;
                case ScreenId.Social:
                case ScreenId.Challenge: return AppState.Social;
                case ScreenId.Profile:
                case ScreenId.Character: return AppState.Profile;
                case ScreenId.AiTutor: return AppState.AiTutor;
                default: return AppState.Home;
            }
        }

        private static UserProfile MapUser(UserDto dto)
        {
            dto = dto ?? new UserDto();
            return new UserProfile
            {
                Id = string.IsNullOrEmpty(dto.id) ? dto._id : dto.id,
                Username = string.IsNullOrEmpty(dto.nickname)
                    ? dto.username
                    : dto.nickname,
                TotalScore = dto.totalScore,
                CharacterId = dto.characterSpriteIndex.ToString(),
                LoginStreak = dto.loginStreak
            };
        }
    }
}
