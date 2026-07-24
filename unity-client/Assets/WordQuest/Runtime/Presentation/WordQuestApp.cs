using System;
using System.Collections.Generic;
using System.Linq;
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
using WordQuest.Infrastructure.Input;
using WordQuest.Infrastructure.Storage;
using WordQuest.Presentation.Screens;

namespace WordQuest.Presentation
{
    public sealed class WordQuestApp : MonoBehaviour
    {
        private CancellationTokenSource lifetime;
        private CancellationTokenSource sessionLifetime;
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
        private GameInput shellInput;
        private AchievementToast achievementToast;
        private TutorialController activeTutorial;
        private TutorialOverlay tutorialOverlay;
        private int lastComboCue;
        private AiTutorScreen npcTutorScreen;
        private VisualElement npcChatOverlay;
        private bool npcChatOpen;
        private bool tutorCountsNpc;
        private PronunciationScreen pronunciationScreen;

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

        private void Update()
        {
            if (router?.Current == ScreenId.Game &&
                (shellInput?.PausePressed ?? false))
                TogglePause();
            if (router?.Current == ScreenId.Game &&
                activeTutorial?.Step == TutorialStep.Move &&
                shellInput.Move.sqrMagnitude > 0.01f)
                activeTutorial.MovementObserved();
        }

        private void OnDestroy()
        {
            gameFlow?.Dispose();
            aiTutorScreen?.Dispose();
            npcTutorScreen?.Dispose();
            pronunciationScreen?.Dispose();
            audio?.Dispose();
            loginScreen?.Dispose();
            EndSession();
            lifetime?.Cancel();
            lifetime?.Dispose();
        }

        private void ComposeServices()
        {
            StateMachine = new AppStateMachine();
            Context = new WordQuestContext();
            shellInput = new GameInput();

            preferences = new PlayerPrefsStore();
            Context.Settings.WordbookId = preferences.GetString(
                "wordquest:wordbook",
                "cet4");
            Context.Settings.Difficulty = preferences.GetString(
                "wordquest:difficulty",
                "normal");
            var tokenStore = new TokenStore(preferences);
            pendingSync = new PendingSyncQueue(preferences);
            var origin = preferences.GetString(
                "wordquest:api-origin",
                "http://localhost:4000");
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

        private CancellationToken SessionToken =>
            sessionLifetime?.Token ?? lifetime.Token;

        private void BeginSession()
        {
            EndSession();
            sessionLifetime = CancellationTokenSource
                .CreateLinkedTokenSource(lifetime.Token);
        }

        private void EndSession()
        {
            sessionLifetime?.Cancel();
            sessionLifetime?.Dispose();
            sessionLifetime = null;
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
            achievementToast = new AchievementToast(
                router.Root.Q<VisualElement>("achievement-toast"));
        }

        private async System.Threading.Tasks.Task RestoreSessionAsync()
        {
            var result = await Auth.GetCurrentUserAsync(lifetime.Token);
            if (result.IsSuccess)
            {
                Context.SignIn(MapUser(result.Data));
                BeginSession();
                StateMachine.TryTransition(AppState.Home);
                ShowHome();
                return;
            }

            ShowAuthentication();
        }

        private void ShowAuthentication()
        {
            EndSession();
            CleanupGameplay();
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
                    BeginSession();
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
                Learning,
                SessionToken);
            _ = audio.PlayMusicAsync(MusicId.Menu, SessionToken);
            var userId = Context.User?.Id;
            var token = SessionToken;
            _ = FlushPendingSettlementsAsync(userId, token);
        }

        public void Navigate(ScreenId screen)
        {
            audio?.Play(SoundId.Click);
            if (screen != ScreenId.Pronunciation)
            {
                pronunciationScreen?.Dispose();
                pronunciationScreen = null;
            }
            if (screen != ScreenId.Game && screen != ScreenId.Result)
                CleanupGameplay();

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

        private async void ShowLevelSelect()
        {
            var view = router.Show(ScreenId.LevelSelect);
            var statusTask = Game.GetLevelsStatusAsync(
                Context.Settings.WordbookId,
                SessionToken);
            var wordbooksTask = Vocabulary.GetWordbooksAsync(SessionToken);
            await System.Threading.Tasks.Task.WhenAll(
                statusTask,
                wordbooksTask);
            var status = statusTask.Result;
            var wordbooks = wordbooksTask.Result;
            _ = new LevelSelectScreen(
                view,
                content,
                level => StartLevel(
                    new LevelSelection(
                        level,
                        Difficulty.Parse(Context.Settings.Difficulty),
                        Context.Settings.WordbookId)),
                SetDifficulty,
                status.IsSuccess ? status.Data : null,
                wordbooks.IsSuccess ? wordbooks.Data : null,
                Context.Settings.WordbookId,
                Context.Settings.Difficulty,
                wordbookId =>
                {
                    SelectWordbook(wordbookId);
                    ShowLevelSelect();
                });
        }

        private async void StartLevel(LevelSelection selection)
        {
            activeSelection = selection;
            CleanupGameplay();

            var worldObject = new GameObject("WordQuest World");
            world = worldObject.AddComponent<WorldController>();
            var characterIndex = int.TryParse(
                Context.User?.CharacterId,
                out var parsedCharacter)
                ? parsedCharacter
                : 0;
            world.PlayerTint = CharacterCatalog.Get(characterIndex).Tint;
            var view = router.Show(ScreenId.Game);
            var hud = new HudScreen(
                view.Q<VisualElement>("hud"),
                TogglePause,
                () => OpenManualGameTutor(selection));
            var quiz = new QuizOverlay(
                view.Q<VisualElement>("quiz-overlay"));
            var pause = new PauseOverlay(
                view.Q<VisualElement>("pause-overlay"),
                TogglePause,
                audio.ToggleMute,
                () => Navigate(ScreenId.Home),
                () => Navigate(ScreenId.Login));
            npcTutorScreen?.Dispose();
            npcTutorScreen = null;
            npcChatOverlay = view.Q<VisualElement>("npc-chat-overlay");
            npcChatOverlay.style.display = DisplayStyle.None;
            npcChatOverlay.Q<Button>("npc-chat-close-button").clicked +=
                CloseNpcChat;
            tutorialOverlay?.Dispose();
            tutorialOverlay = null;
            activeTutorial = null;
            var tutorialRoot =
                view.Q<VisualElement>("tutorial-banner");
            if (selection.Level.IsTutorial)
            {
                var tutorial = new TutorialController(preferences);
                if (tutorial.ShouldRun)
                {
                    activeTutorial = tutorial;
                    tutorialOverlay = new TutorialOverlay(
                        tutorialRoot,
                        tutorial);
                }
                else
                {
                    tutorialRoot.style.display = DisplayStyle.None;
                }
            }
            else
            {
                tutorialRoot.style.display = DisplayStyle.None;
            }

            gameFlow = new GameFlowController(
                Vocabulary,
                Learning,
                Game,
                pendingSync,
                world,
                Context.User?.Id);
            world.MonsterDefeated += () => audio.Play(SoundId.Coin);
            lastComboCue = 0;
            gameFlow.SessionChanged += snapshot =>
            {
                hud.Render(snapshot);
                if (snapshot.Combo >= 5 &&
                    snapshot.Combo % 5 == 0 &&
                    snapshot.Combo != lastComboCue)
                {
                    lastComboCue = snapshot.Combo;
                    audio.Play(SoundId.Combo);
                }
            };
            gameFlow.QuestionReady += question =>
            {
                if (activeTutorial != null)
                {
                    activeTutorial.MovementObserved();
                    activeTutorial.InteractionObserved();
                }
                quiz.Show(
                    question,
                    gameFlow.Snapshot?.TimerMs ?? 30000);
            };
            gameFlow.PauseChanged += pause.SetVisible;
            gameFlow.AnswerEvaluated += correct =>
                audio.Play(correct ? SoundId.Correct : SoundId.Wrong);
            gameFlow.BossAppeared += () => audio.Play(SoundId.BossAppear);
            gameFlow.BossDefeated += () => audio.Play(SoundId.BossDefeat);
            gameFlow.NpcRequested += word =>
                OpenNpcChat(word, selection);
            gameFlow.WrongAnswerTutorRequested +=
                (word, context) =>
                    OpenWrongAnswerTutor(
                        word,
                        context,
                        selection);
            gameFlow.CorrectAnswerFeedbackRequested += word =>
                quiz.ShowCorrectFeedback(
                    word,
                    () => gameFlow?.ResumeAfterTutor());
            gameFlow.Finished += ShowResult;
            quiz.Submitted += answer =>
            {
                activeTutorial?.AnswerObserved();
                _ = gameFlow.SubmitAnswerAsync(answer, SessionToken);
            };

            try
            {
                await audio.PlayMusicAsync(MusicId.Game, SessionToken);
                await gameFlow.StartLevelAsync(selection, SessionToken);
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
            audio.Play(SoundId.LevelComplete);
            _ = audio.PlayMusicAsync(MusicId.Result, SessionToken);
            if (LevelSettlementPolicy.ShouldSyncAchievements(
                    result.LevelCompleted,
                    result.ProgressSaved))
            {
                var userId = Context.User?.Id;
                var token = SessionToken;
                _ = SyncAndConfirmAchievementsAsync(
                    result.SettlementId,
                    AchievementRunEvidence.From(
                        result,
                        activeSelection?.WordbookId),
                    userId,
                    token);
            }
            _ = new ResultScreen(
                view,
                result,
                () => StartLevel(activeSelection),
                () => Navigate(ScreenId.Home),
                () => Navigate(ScreenId.Reports));
        }

        private async System.Threading.Tasks.Task
            FlushPendingSettlementsAsync(
                string userId,
                CancellationToken token)
        {
            try
            {
                var work = await new PendingSettlementSync(
                        pendingSync,
                        Game,
                        userId)
                    .FlushAsync(token);
                foreach (var item in work)
                {
                    await SyncAndConfirmAchievementsAsync(
                        item.SubmissionId,
                        item.Evidence,
                        userId,
                        token);
                }
            }
            catch (OperationCanceledException)
            {
                // A logout cancels work before another account can use it.
            }
        }

        private async System.Threading.Tasks.Task
            SyncAndConfirmAchievementsAsync(
                string submissionId,
                AchievementRunEvidence result,
                string userId,
                CancellationToken token)
        {
            if (!await SyncAchievementsAsync(result, userId, token))
                return;
            pendingSync.Remove(userId, submissionId);
        }

        private async System.Threading.Tasks.Task<bool>
            SyncAchievementsAsync(
                AchievementRunEvidence result,
                string userId,
                CancellationToken token)
        {
            if (result == null ||
                string.IsNullOrWhiteSpace(userId) ||
                token.IsCancellationRequested ||
                !string.Equals(
                    Context.User?.Id,
                    userId,
                    StringComparison.Ordinal))
            {
                return false;
            }

            var progressTask = Game.GetProgressAsync(token);
            var statsTask = Learning.GetStatsAsync(
                result.WordbookId,
                token);
            var achievementsTask =
                Game.GetAchievementsAsync(token);
            await System.Threading.Tasks.Task.WhenAll(
                progressTask,
                statsTask,
                achievementsTask);
            if (token.IsCancellationRequested ||
                !string.Equals(
                    Context.User?.Id,
                    userId,
                    StringComparison.Ordinal))
            {
                return false;
            }
            if (!progressTask.Result.IsSuccess ||
                progressTask.Result.Data == null ||
                !statsTask.Result.IsSuccess ||
                statsTask.Result.Data == null ||
                !achievementsTask.Result.IsSuccess ||
                achievementsTask.Result.Data == null)
            {
                return false;
            }

            var progress = progressTask.Result.Data;
            var stats = statsTask.Result.Data;
            var existing = new HashSet<string>(
                achievementsTask.Result.Data
                .Select(item => item.id));
            var estimatedCompleted = Math.Max(
                (progress.currentChapter - 1) * 30 +
                Math.Max(0, progress.currentLevel - 1),
                (result.Chapter - 1) * 30 + result.Level);
            var completedChapters = Math.Max(
                (progress.unlockedChapters?.Length ?? 1) - 1,
                result.Level >= 30 ? result.Chapter : 0);
            var unlocked = AchievementPolicy.FindUnlocked(
                new AchievementContext
                {
                    LevelsCompleted = estimatedCompleted,
                    PerfectClears =
                        result.WrongCount == 0 &&
                        result.CorrectCount > 0
                            ? 1
                            : 0,
                    MaximumCombo = result.MaximumCombo,
                    WordsLearned = stats.wordsLearned,
                    ChaptersCompleted = completedChapters,
                    FastestCorrectMs = result.FastestCorrectMs,
                    LoginStreak = Context.User?.LoginStreak ?? 0,
                    NpcChats = int.TryParse(
                        preferences.GetString(
                            "wordquest:npc-chats",
                            "0"),
                        out var npcChats)
                            ? npcChats
                            : 0
                },
                existing);

            foreach (var achievement in unlocked)
            {
                var saved = await Game.SaveAchievementAsync(
                    new AchievementRequest
                    {
                        id = achievement.Id,
                        name = achievement.Name,
                        description = achievement.Description
                    },
                    token);
                if (!saved.IsSuccess)
                    return false;
                if (string.Equals(
                        Context.User?.Id,
                        userId,
                        StringComparison.Ordinal))
                {
                    achievementToast.Show(achievement);
                }
            }
            return true;
        }

        private void CleanupGameplay()
        {
            gameFlow?.Dispose();
            gameFlow = null;
            tutorialOverlay?.Dispose();
            tutorialOverlay = null;
            activeTutorial = null;
            npcTutorScreen?.Dispose();
            npcTutorScreen = null;
            npcChatOverlay = null;
            npcChatOpen = false;
            tutorCountsNpc = false;
            if (world != null)
            {
                Destroy(world.gameObject);
                world = null;
            }
        }

        private void OpenNpcChat(
            WordDto word,
            LevelSelection selection)
        {
            OpenGameTutor(
                word,
                selection,
                "npc",
                string.Empty,
                word?.meaning ?? string.Empty,
                string.Empty,
                true);
        }

        private void OpenManualGameTutor(LevelSelection selection)
        {
            var word = gameFlow?.TryPauseForManualTutor();
            if (word == null)
                return;
            OpenGameTutor(
                word,
                selection,
                "manual",
                string.Empty,
                word.meaning,
                string.Empty,
                false);
        }

        private void OpenWrongAnswerTutor(
            WordDto word,
            WrongAnswerTutorContext context,
            LevelSelection selection)
        {
            OpenGameTutor(
                word,
                selection,
                "wrong_answer",
                context?.PlayerAnswer ?? string.Empty,
                context?.CorrectAnswer ?? string.Empty,
                context?.FuzzyFeedback ?? string.Empty,
                false,
                context);
        }

        private void OpenGameTutor(
            WordDto word,
            LevelSelection selection,
            string triggerType,
            string playerAnswer,
            string correctAnswer,
            string feedback,
            bool countsNpc,
            WrongAnswerTutorContext answerContext = null)
        {
            if (npcChatOverlay == null)
            {
                if (countsNpc)
                    gameFlow?.ResumeAfterNpc();
                else
                    gameFlow?.ResumeAfterTutor();
                return;
            }

            activeTutorial?.MovementObserved();
            activeTutorial?.InteractionObserved();
            npcTutorScreen?.Dispose();
            npcChatOverlay.Q<ScrollView>("tutor-messages").Clear();
            npcChatOverlay.style.display = DisplayStyle.Flex;
            npcChatOpen = true;
            tutorCountsNpc = countsNpc;
            npcTutorScreen = new AiTutorScreen(
                npcChatOverlay,
                new AiTutorController(Chat),
                new ChatContext
                {
                    CurrentWord = word?.word ?? string.Empty,
                    CorrectAnswer = correctAnswer ?? string.Empty,
                    PlayerAnswer = playerAnswer ?? string.Empty,
                    FuzzyFeedback = feedback ?? string.Empty,
                    AnswerQuality =
                        answerContext?.AnswerQuality ?? string.Empty,
                    EditDistance = answerContext?.EditDistance ?? 0,
                    Similarity = answerContext?.Similarity ?? 0f,
                    CorrectStreak = answerContext?.CorrectStreak ?? 0,
                    WrongStreak = answerContext?.WrongStreak ?? 0,
                    PlayerLevel = Context.User?.Level ?? 1,
                    ChapterName = $"第 {selection.Level.Chapter} 章",
                    TriggerType = triggerType
                },
                SessionToken);
            if (!countsNpc)
            {
                npcChatOverlay.Q<TextField>("tutor-input").value =
                    $"我刚才把“{word?.word}”答成了“{playerAnswer}”，请用适合我的方式讲解并给一个记忆技巧。";
            }
        }

        private void CloseNpcChat()
        {
            if (!npcChatOpen)
                return;

            npcChatOpen = false;
            npcTutorScreen?.Dispose();
            npcTutorScreen = null;
            if (npcChatOverlay != null)
                npcChatOverlay.style.display = DisplayStyle.None;
            if (tutorCountsNpc)
            {
                var total = int.TryParse(
                    preferences.GetString("wordquest:npc-chats", "0"),
                    out var current)
                        ? current + 1
                        : 1;
                preferences.SetString(
                    "wordquest:npc-chats",
                    total.ToString());
                preferences.Save();
                gameFlow?.ResumeAfterNpc();
            }
            else
            {
                gameFlow?.ResumeAfterTutor();
            }
            tutorCountsNpc = false;
        }

        private void ShowCharacter()
        {
            var view = router.Show(ScreenId.Character);
            _ = new CharacterScreen(
                view,
                Game,
                SessionToken,
                index =>
                {
                    if (Context.User != null)
                        Context.User.CharacterId = index.ToString();
                    view.Q<Label>("character-status-label").text =
                        "角色外观已保存";
                },
                int.TryParse(
                    Context.User?.CharacterId,
                    out var currentCharacter)
                    ? currentCharacter
                    : 0);
        }

        private void ShowEndless()
        {
            var view = router.Show(ScreenId.Endless);
            _ = new EndlessScreen(
                view,
                new EndlessModeController(Game, preferences),
                Vocabulary,
                content,
                Context.Settings.WordbookId,
                SessionToken);
        }

        private void ShowReview()
        {
            var view = router.Show(ScreenId.Review);
            _ = new ReviewScreen(
                view,
                new ReviewModeController(
                    Learning,
                    Context.Settings.WordbookId),
                SessionToken);
        }

        private void ShowDailyChallenge()
        {
            var view = router.Show(ScreenId.DailyChallenge);
            _ = new DailyChallengeScreen(
                view,
                new DailyChallengeController(
                    DailyChallenge,
                    Context.Settings.WordbookId),
                SessionToken);
        }

        private void ShowReports()
        {
            var view = router.Show(ScreenId.Reports);
            _ = new ReportScreen(
                view,
                new ReportController(Learning),
                Context.Settings.WordbookId,
                SessionToken);
        }

        private void ShowVocabulary()
        {
            var view = router.Show(ScreenId.Vocabulary);
            _ = new VocabularyScreen(
                view,
                Vocabulary,
                Context,
                SessionToken,
                () => Navigate(ScreenId.Pronunciation),
                SelectWordbook);
        }

        private void ShowPronunciation()
        {
            var view = router.Show(ScreenId.Pronunciation);
            pronunciationScreen?.Dispose();
            pronunciationScreen = new PronunciationScreen(
                view,
                Pronunciation,
                SpeechRecognitionAdapter.Create(),
                Context.Settings.WordbookId,
                SessionToken);
        }

        private void ShowProfile()
        {
            var view = router.Show(ScreenId.Profile);
            _ = new ProfileScreen(
                view,
                Auth,
                Game,
                SessionToken,
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
                SessionToken);
        }

        private void ShowSocial()
        {
            var view = router.Show(ScreenId.Social);
            _ = new SocialScreen(
                view,
                socialController,
                Context.Settings.WordbookId,
                SessionToken,
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
                SessionToken);
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
                    PlayerLevel = Context.User?.Level ?? 1,
                    TriggerType = "manual"
                },
                SessionToken);
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

        private void SetDifficulty(string difficulty)
        {
            Context.Settings.Difficulty = string.IsNullOrWhiteSpace(difficulty)
                ? "normal"
                : difficulty;
            preferences.SetString(
                "wordquest:difficulty",
                Context.Settings.Difficulty);
            preferences.Save();
            Context.NotifySettingsChanged();
        }

        private void SelectWordbook(string wordbookId)
        {
            Context.Settings.WordbookId = string.IsNullOrWhiteSpace(wordbookId)
                ? "cet4"
                : wordbookId;
            preferences.SetString(
                "wordquest:wordbook",
                Context.Settings.WordbookId);
            preferences.Save();
            Context.NotifySettingsChanged();
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
                Level = Math.Max(1, dto.level),
                TotalScore = dto.totalScore,
                CharacterId = dto.characterSpriteIndex.ToString(),
                LoginStreak = dto.loginStreak
            };
        }
    }
}
