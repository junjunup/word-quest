using System;
using System.Threading;
using UnityEngine;
using UnityEngine.UIElements;
using WordQuest.Application;
using WordQuest.Application.Modes;
using WordQuest.Application.Reports;
using WordQuest.Application.Social;
using WordQuest.Application.Ai;
using WordQuest.Content;
using WordQuest.Domain.Game;
using WordQuest.Gameplay;
using WordQuest.Infrastructure.Api;
using WordQuest.Infrastructure.Api.Dto;
using WordQuest.Infrastructure.Api.Services;
using WordQuest.Infrastructure.Audio;
using WordQuest.Infrastructure.Storage;
using WordQuest.Presentation.Screens;

namespace WordQuest.Presentation
{
    public sealed class WordQuestApp : MonoBehaviour
    {
        private CancellationTokenSource lifetime;
        private LoginScreen loginScreen;
        private ScreenRouter router;
        private ContentCatalog content;
        private PendingSyncQueue pendingSync;
        private GameFlowController gameFlow;
        private WorldController world;
        private LevelSelection activeSelection;
        private AudioService audio;
        private IKeyValueStore preferences;
        private SocialController socialController;
        private string activeChallengeId;
        private AiTutorScreen aiTutorScreen;

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
            gameFlow?.Dispose();
            aiTutorScreen?.Dispose();
            audio?.Dispose();
            loginScreen?.Dispose();
            lifetime?.Cancel();
            lifetime?.Dispose();
        }

        private void ComposeServices()
        {
            StateMachine = new AppStateMachine();
            Context = new WordQuestContext();

            preferences = new PlayerPrefsStore();
            var tokenStore = new TokenStore(preferences);
            pendingSync = new PendingSyncQueue(preferences);
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
            content = ContentCatalog.LoadDefault();
            audio = new AudioService(preferences);
            socialController = new SocialController(Social);
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
            _ = new HomeScreen(
                view,
                Context,
                Navigate,
                Game,
                lifetime.Token);
            _ = audio.PlayMusicAsync(MusicId.Menu, lifetime.Token);
            _ = new PendingSettlementSync(pendingSync, Game)
                .FlushAsync(lifetime.Token);
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
            else if (screen == ScreenId.LevelSelect)
                ShowLevelSelect();
            else if (screen == ScreenId.Character)
                ShowCharacter();
            else if (screen == ScreenId.Endless)
                ShowEndless();
            else if (screen == ScreenId.Review)
                ShowReview();
            else if (screen == ScreenId.DailyChallenge)
                ShowDailyChallenge();
            else if (screen == ScreenId.Reports)
                ShowReports();
            else if (screen == ScreenId.Vocabulary)
                ShowVocabulary();
            else if (screen == ScreenId.Pronunciation)
                ShowPronunciation();
            else if (screen == ScreenId.Profile)
                ShowProfile();
            else if (screen == ScreenId.Leaderboard)
                ShowLeaderboard();
            else if (screen == ScreenId.Social)
                ShowSocial();
            else if (screen == ScreenId.Challenge)
                ShowChallenge();
            else if (screen == ScreenId.AiTutor)
                ShowAiTutor();
            else
                router.Show(screen);
        }

        private void ShowLevelSelect()
        {
            var view = router.Show(ScreenId.LevelSelect);
            _ = new LevelSelectScreen(
                view,
                content,
                level => StartLevel(
                    new LevelSelection(
                        level,
                        Difficulty.Parse(Context.Settings.Difficulty))));
        }

        private async void StartLevel(LevelSelection selection)
        {
            activeSelection = selection;
            gameFlow?.Dispose();
            if (world != null)
                Destroy(world.gameObject);

            var worldObject = new GameObject("WordQuest World");
            world = worldObject.AddComponent<WorldController>();
            var view = router.Show(ScreenId.Game);
            var hud = new HudScreen(view.Q<VisualElement>("hud"), TogglePause);
            var quiz = new QuizOverlay(
                view.Q<VisualElement>("quiz-overlay"));
            var pause = new PauseOverlay(
                view.Q<VisualElement>("pause-overlay"),
                TogglePause,
                audio.ToggleMute,
                () => Navigate(ScreenId.Home),
                () => Navigate(ScreenId.Login));

            gameFlow = new GameFlowController(
                Vocabulary,
                Learning,
                Game,
                pendingSync,
                world);
            gameFlow.SessionChanged += hud.Render;
            gameFlow.QuestionReady += quiz.Show;
            gameFlow.PauseChanged += pause.SetVisible;
            gameFlow.Finished += ShowResult;
            quiz.Submitted += answer =>
                _ = gameFlow.SubmitAnswerAsync(answer, lifetime.Token);

            try
            {
                await audio.PlayMusicAsync(MusicId.Game, lifetime.Token);
                await gameFlow.StartLevelAsync(selection, lifetime.Token);
            }
            catch (Exception exception)
            {
                Debug.LogWarning(
                    $"Unable to start level: {exception.Message}");
                Navigate(ScreenId.LevelSelect);
            }
        }

        private void TogglePause()
        {
            gameFlow?.TogglePause();
        }

        private void ShowResult(LevelResult result)
        {
            if (world != null)
                world.gameObject.SetActive(false);
            var view = router.Show(ScreenId.Result);
            _ = audio.PlayMusicAsync(MusicId.Result, lifetime.Token);
            _ = new ResultScreen(
                view,
                result,
                () => StartLevel(activeSelection),
                () => Navigate(ScreenId.Home),
                () => Navigate(ScreenId.Reports));
        }

        private void ShowCharacter()
        {
            var view = router.Show(ScreenId.Character);
            _ = new CharacterScreen(
                view,
                Game,
                lifetime.Token,
                index =>
                {
                    if (Context.User != null)
                        Context.User.CharacterId = index.ToString();
                });
        }

        private void ShowEndless()
        {
            var view = router.Show(ScreenId.Endless);
            _ = new EndlessScreen(
                view,
                new EndlessModeController(Game, preferences),
                lifetime.Token);
        }

        private void ShowReview()
        {
            var view = router.Show(ScreenId.Review);
            _ = new ReviewScreen(
                view,
                new ReviewModeController(
                    Learning,
                    Context.Settings.WordbookId),
                lifetime.Token);
        }

        private void ShowDailyChallenge()
        {
            var view = router.Show(ScreenId.DailyChallenge);
            _ = new DailyChallengeScreen(
                view,
                new DailyChallengeController(
                    DailyChallenge,
                    Context.Settings.WordbookId),
                lifetime.Token);
        }

        private void ShowReports()
        {
            var view = router.Show(ScreenId.Reports);
            _ = new ReportScreen(
                view,
                new ReportController(Learning),
                Context.Settings.WordbookId,
                lifetime.Token);
        }

        private void ShowVocabulary()
        {
            var view = router.Show(ScreenId.Vocabulary);
            _ = new VocabularyScreen(
                view,
                Vocabulary,
                Context,
                lifetime.Token,
                () => Navigate(ScreenId.Pronunciation));
        }

        private void ShowPronunciation()
        {
            var view = router.Show(ScreenId.Pronunciation);
            _ = new PronunciationScreen(
                view,
                Pronunciation,
                new MicrophoneCaptureAdapter(),
                Context.Settings.WordbookId,
                lifetime.Token);
        }

        private void ShowProfile()
        {
            var view = router.Show(ScreenId.Profile);
            _ = new ProfileScreen(
                view,
                Auth,
                Game,
                lifetime.Token,
                () => Navigate(ScreenId.Character),
                () => Navigate(ScreenId.Leaderboard));
        }

        private void ShowLeaderboard()
        {
            var view = router.Show(ScreenId.Leaderboard);
            _ = new LeaderboardScreen(
                view,
                Game,
                Context.User?.Id,
                lifetime.Token);
        }

        private void ShowSocial()
        {
            var view = router.Show(ScreenId.Social);
            _ = new SocialScreen(
                view,
                socialController,
                Context.Settings.WordbookId,
                lifetime.Token,
                id =>
                {
                    activeChallengeId = id;
                    Navigate(ScreenId.Challenge);
                });
        }

        private void ShowChallenge()
        {
            if (string.IsNullOrWhiteSpace(activeChallengeId))
            {
                Navigate(ScreenId.Social);
                return;
            }

            var view = router.Show(ScreenId.Challenge);
            _ = new ChallengeScreen(
                view,
                socialController,
                activeChallengeId,
                lifetime.Token);
        }

        private void ShowAiTutor()
        {
            aiTutorScreen?.Dispose();
            var view = router.Show(ScreenId.AiTutor);
            aiTutorScreen = new AiTutorScreen(
                view,
                new AiTutorController(Chat),
                new ChatContext
                {
                    PlayerLevel = Context.User == null ? 1 : 1,
                    TriggerType = "manual"
                },
                lifetime.Token);
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
