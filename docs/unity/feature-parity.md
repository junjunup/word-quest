# Unity feature parity

`implemented-unverified` means the Unity implementation and automated evidence
exist, but the feature still needs the manual device, staging, or end-to-end pass
listed in its row. `verified` means every listed automated and manual check has
passed.

## 2026-09-10 P0/P1 learning closure

The Unity client and matching Express API now implement attempt identity,
account-scoped retry, separate correction evidence, delayed-recall reporting,
and a fixed daily queue with durable feedback acknowledgement. See
`docs/unity/2026-09-10-p0-p1-closure.md` for current commands, results, API
contracts, compatibility and remaining manual device checks. Earlier rows below
retain their original manual evidence; those passes do not certify the new UI.

## 2026-09-10 automatic encounter update

Unity 6000.5.3f1: EditMode 161/161 and PlayMode 18/18 passed. Ordinary
encounters now select a nearby visible monster, pause the world, preserve first
answer outcomes during a single correction, and require cooldown plus departure
before retrying a cancelled target. macOS was rebuilt; full visible-window QA
for this update remains pending. See `docs/unity/2026-09-10-auto-encounter.md`.

## Earlier verification run

- Unity `6000.5.3f1` (changeset `c2eb47b3a2a9`) imported and compiled the project.
- EditMode: 154/154 passed, including K12 learner-stage normalization,
  conservative wordbook compatibility, persistent stage selection, shared
  learning-journey planning, task-first Home actions, explicit level states,
  unreliable-status fallback, stale Level Select response rejection, result
  next actions, API routing, session cancellation, and authentication recovery.
- PlayMode: 7/7 passed, including Bootstrap, 1280×720 learning-loop controls,
  visible keyboard focus, transparent game shell, world, and audio-listener
  smoke checks.
- Windows Player: PE32+ x86-64 artifact validated.
- macOS Player: Universal x86_64/arm64 app and speech bridge validated; privacy plist, audio-input entitlement, nested signatures, ICU data, and deterministic UI bootstrap passed.
- macOS visible-window pass: local online sign-in/session restore, Home
  recommendation, 1280×720 Home and level map, visible 2D world, ten correct
  encounters, saved completion, two-star result, and next-level primary action
  passed. Screenshots and detailed evidence are in
  `docs/unity/p1-learning-loop-verification.md`.
- K12 stage-path implementation, conservative content-fit policy, tests, and
  build evidence are recorded in
  `docs/unity/p2-k12-stage-path-verification.md`.
- Reproduce with `unity-client/Tools/run-unity-tests.sh`, `unity-client/Tools/build-players.sh`, and `unity-client/Tools/validate-build-artifacts.sh`.

| Legacy feature | Legacy source | Unity implementation | Automated evidence | Manual evidence | Status |
|---|---|---|---|---|---|
| Ordinary encounter, pause and correction | Automatic encounter product requirement | `unity-client/Assets/WordQuest/Runtime/Gameplay/WorldController.cs`, `unity-client/Assets/WordQuest/Runtime/Gameplay/GameFlowController.cs` | `unity-client/Assets/WordQuest/Tests/PlayMode/EncounterRegressionTests.cs`, `unity-client/Assets/WordQuest/Tests/PlayMode/GameFlowEncounterTests.cs`, `unity-client/Assets/WordQuest/Tests/EditMode/QuizEvidenceRegressionTests.cs` | Visible-window keyboard/gamepad, Chinese input and full-level walkthrough pending | implemented-unverified |
| Authentication and stored session | `client/src/views/HomeView.vue`, `client/src/stores/user.js` | `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/LoginScreen.cs` | `unity-client/Assets/WordQuest/Tests/EditMode/LoginScreenTests.cs`, `unity-client/Assets/WordQuest/Tests/PlayMode/BootstrapSmokeTests.cs` | macOS password masking, focus, offline recovery, online sign-in, and session restore passed; Windows UI pass pending | implemented-unverified |
| App navigation and protected features | `client/src/router/index.js` | `unity-client/Assets/WordQuest/Runtime/Application/AppStateMachine.cs` | `unity-client/Assets/WordQuest/Tests/EditMode/AppStateMachineTests.cs` | Unity 6000.5.3f1 desktop pass pending | implemented-unverified |
| Desktop UI shell and responsive scaling | `client/src/App.vue`, `client/src/styles/global.scss` | `unity-client/Assets/WordQuest/Runtime/Presentation/ScreenRouter.cs` | `unity-client/Assets/WordQuest/Tests/EditMode/ScreenRouterTests.cs`, `unity-client/Assets/WordQuest/Tests/PlayMode/BootstrapSmokeTests.cs`, `unity-client/Tools/validate-project.sh` | macOS non-empty startup shell plus 1440×900 and 1280×720 Home passes; Windows layout pass pending | implemented-unverified |
| Home dashboard | `client/src/views/DashboardView.vue` | `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/HomeScreen.cs`, `unity-client/Assets/WordQuest/Runtime/Application/LearningJourneyPlanner.cs` | `unity-client/Assets/WordQuest/Tests/EditMode/HomeScreenTests.cs`, `unity-client/Assets/WordQuest/Tests/EditMode/LearningJourneyPlannerTests.cs`, `unity-client/Tools/validate-project.sh` | macOS local API recommendation, direct level start, progress summary, daily goal, and all feature entries passed; Windows pass pending | implemented-unverified |
| K12 learner stages and content-fit disclosure | No equivalent stage model | `unity-client/Assets/WordQuest/Runtime/Application/LearnerStageCatalog.cs`, `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/HomeScreen.cs`, `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/LevelSelectScreen.cs` | `unity-client/Assets/WordQuest/Tests/EditMode/LearnerStageCatalogTests.cs`, `unity-client/Assets/WordQuest/Tests/EditMode/HomeScreenTests.cs`, `unity-client/Assets/WordQuest/Tests/EditMode/LevelSelectScreenTests.cs`, `unity-client/Assets/WordQuest/Tests/EditMode/WordQuestAppTests.cs`, `unity-client/Assets/WordQuest/Tests/PlayMode/BootstrapSmokeTests.cs` | macOS/Windows visible grade-stage switching and relaunch persistence pass pending; existing CET/custom wordbooks are deliberately disclosed as extension content | implemented-unverified |
| Chapter/level selection and locks | `client/src/components/LevelSelect.vue` | `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/LevelSelectScreen.cs` | `unity-client/Assets/WordQuest/Tests/EditMode/ContentCatalogTests.cs`, `unity-client/Assets/WordQuest/Tests/EditMode/LevelSelectScreenTests.cs` | macOS 1280×720 recommendation, completed/locked wording, keyboard-focusable controls, and scroll layout passed; shared staging account pass pending | implemented-unverified |
| Six chapters and 180 CET-4 levels | `client/src/game/data/levels.json` | `unity-client/Assets/WordQuest/Runtime/Content/ContentCatalog.cs` | `unity-client/Assets/WordQuest/Tests/EditMode/ContentCatalogTests.cs` | Content sampling pending | implemented-unverified |
| Explorable 2D world | `client/src/game/scenes/WorldScene.js` | `unity-client/Assets/WordQuest/Runtime/Gameplay/WorldGenerator.cs`, `unity-client/Assets/WordQuest/Runtime/Presentation/ScreenRouter.cs` | `unity-client/Assets/WordQuest/Tests/PlayMode/WorldSmokeTests.cs`, `unity-client/Assets/WordQuest/Tests/PlayMode/BootstrapSmokeTests.cs` | macOS 1280×720 rendered world, camera follow, movement, collision, NPC, and ten monster encounters passed; Windows pass pending | implemented-unverified |
| Keyboard/gamepad input | `client/src/game/scenes/WorldScene.js` | `unity-client/Assets/WordQuest/Runtime/Infrastructure/Input/GameInput.cs` | `unity-client/Tools/validate-project.sh` | macOS WASD movement and Escape control passed; Windows keyboard and physical gamepad pass pending | implemented-unverified |
| Monster encounters and retest loop | `client/src/game/scenes/WorldScene.js` | `unity-client/Assets/WordQuest/Runtime/Gameplay/GameFlowController.cs` | `unity-client/Assets/WordQuest/Tests/EditMode/GameSessionTests.cs` | macOS ten-encounter successful run passed; wrong-answer revival pass pending | implemented-unverified |
| English-Chinese choice | `client/src/components/QuizModal.vue` | `unity-client/Assets/WordQuest/Runtime/Application/Quiz/QuizFactory.cs` | `unity-client/Assets/WordQuest/Tests/EditMode/QuizFactoryTests.cs` | macOS rendered prompt, four answers, submission, and correct feedback passed; Windows UI pass pending | implemented-unverified |
| Chinese-English choice | `client/src/components/QuizModal.vue` | `unity-client/Assets/WordQuest/Runtime/Application/Quiz/QuizFactory.cs` | `unity-client/Assets/WordQuest/Tests/EditMode/QuizFactoryTests.cs` | macOS rendered prompt, four answers, submission, and correct feedback passed; Windows UI pass pending | implemented-unverified |
| Hint/full spelling and translation | `client/src/components/QuizModal.vue` | `unity-client/Assets/WordQuest/Runtime/Application/Quiz/QuizFactory.cs` | `unity-client/Assets/WordQuest/Tests/EditMode/QuizFactoryTests.cs` | Unity UI answer pass pending | implemented-unverified |
| Adaptive death-spiral protection | `client/src/views/GameView.vue` | `unity-client/Assets/WordQuest/Runtime/Application/Quiz/QuizFactory.cs` | `unity-client/Assets/WordQuest/Tests/EditMode/QuizFactoryTests.cs` | Three-error flow pending | implemented-unverified |
| Score, combo, lives, grace life | `client/src/game/systems/LevelManager.js`, `client/src/utils/helpers.js` | `unity-client/Assets/WordQuest/Domain/Game/GameSession.cs` | `unity-client/Assets/WordQuest/Tests/EditMode/GameSessionTests.cs` | Full level pass pending | implemented-unverified |
| Difficulty presets and multipliers | `client/src/game/config/gameConstants.js` | `unity-client/Assets/WordQuest/Domain/Game/Difficulty.cs` | `unity-client/Assets/WordQuest/Tests/EditMode/ScoringPolicyTests.cs` | Three-difficulty pass pending | implemented-unverified |
| HUD and progress | `client/src/views/GameView.vue` | `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/HudScreen.cs` | `unity-client/Tools/validate-project.sh` | macOS 1280×720 score, combo, lives, and 0/10 through 10/10 progress readability passed; Windows pass pending | implemented-unverified |
| Pause/resume/mute/home/logout | `client/src/views/GameView.vue` | `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/PauseOverlay.cs`, `unity-client/Assets/WordQuest/Runtime/Presentation/ScreenRouter.cs` | `unity-client/Assets/WordQuest/Tests/PlayMode/BootstrapSmokeTests.cs` | Escape/HUD/navigation pass pending | implemented-unverified |
| Level result and 0-3 stars | `client/src/game/scenes/ResultScene.js` | `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/ResultScreen.cs` | `unity-client/Assets/WordQuest/Tests/EditMode/GameSessionTests.cs`, `unity-client/Assets/WordQuest/Tests/EditMode/ResultScreenTests.cs`, `unity-client/Assets/WordQuest/Tests/EditMode/WordQuestAppTests.cs` | macOS saved two-star completion, 10-correct learning summary, achievement toast, and next-level primary action passed; failed run and Windows passes pending | implemented-unverified |
| Offline settlement retry | `client/src/views/GameView.vue` | `unity-client/Assets/WordQuest/Runtime/Application/LevelSettlementController.cs`, `unity-client/Assets/WordQuest/Runtime/Application/PendingSettlementSync.cs` | `unity-client/Assets/WordQuest/Tests/EditMode/LevelSettlementControllerTests.cs`, `unity-client/Assets/WordQuest/Tests/EditMode/PendingSyncQueueTests.cs` | Per-account two-phase progress/achievement replay pass pending | implemented-unverified |
| Roaming Boss | `client/src/game/entities/RoamingBoss.js` | `unity-client/Assets/WordQuest/Runtime/Gameplay/Boss/RoamingBossController.cs` | `unity-client/Assets/WordQuest/Tests/EditMode/BossAndAchievementTests.cs` | Boss level pass pending | implemented-unverified |
| Turret Boss | `client/src/game/entities/TurretBoss.js` | `unity-client/Assets/WordQuest/Runtime/Gameplay/Boss/TurretBossController.cs` | `unity-client/Assets/WordQuest/Tests/EditMode/BossAndAchievementTests.cs` | Projectile/pause pass pending | implemented-unverified |
| Charging Boss | `client/src/game/entities/ChargingBoss.js` | `unity-client/Assets/WordQuest/Runtime/Gameplay/Boss/ChargingBossController.cs` | `unity-client/Assets/WordQuest/Tests/EditMode/BossAndAchievementTests.cs` | Telegraph/contact pass pending | implemented-unverified |
| First-level tutorial | `client/src/components/GameIntro.vue` | `unity-client/Assets/WordQuest/Runtime/Gameplay/TutorialController.cs` | `unity-client/Assets/WordQuest/Tests/EditMode/GameSessionTests.cs` | New-profile pass pending | implemented-unverified |
| Eight selectable characters | `client/src/game/data/characters.js` | `unity-client/Assets/WordQuest/Runtime/Content/CharacterCatalog.cs` | `unity-client/Assets/WordQuest/Tests/EditMode/BossAndAchievementTests.cs` | Save/relaunch pass pending | implemented-unverified |
| Music and eight sound effects | `client/src/game/systems/AudioManager.js` | `unity-client/Assets/WordQuest/Runtime/Infrastructure/Audio/AudioService.cs` | `unity-client/Tools/validate-project.sh` | Audio device pass pending | implemented-unverified |
| Sixteen achievements | `client/src/game/systems/ScoreSystem.js` | `unity-client/Assets/WordQuest/Domain/Game/AchievementPolicy.cs`, `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/ProfileScreen.cs` | `unity-client/Assets/WordQuest/Tests/EditMode/BossAndAchievementTests.cs` | List/lock state/toast pass pending | implemented-unverified |
| Daily login reward | `client/src/views/DashboardView.vue` | `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/HomeScreen.cs` | `unity-client/Tools/validate-api-contracts.sh` | Once-per-day staging pass pending | implemented-unverified |
| Endless mode | `client/src/components/EndlessMode.vue` | `unity-client/Assets/WordQuest/Runtime/Application/Modes/EndlessModeController.cs` | `unity-client/Assets/WordQuest/Tests/EditMode/LearningModeTests.cs` | Full run/submission pass pending | implemented-unverified |
| Mastery review sessions | `client/src/components/ReviewMode.vue` | `unity-client/Assets/WordQuest/Runtime/Application/Modes/ReviewModeController.cs` | `unity-client/Assets/WordQuest/Tests/EditMode/LearningModeTests.cs` | Create/submit staging pass pending | implemented-unverified |
| Daily challenge and ranking | `client/src/components/DailyChallengeCard.vue` | `unity-client/Assets/WordQuest/Runtime/Application/Modes/DailyChallengeController.cs` | `unity-client/Tools/validate-api-contracts.sh` | Duplicate/leaderboard pass pending | implemented-unverified |
| Learning overview and daily trends | `client/src/components/LearningReport.vue` | `unity-client/Assets/WordQuest/Runtime/Application/Reports/ReportController.cs` | `unity-client/Assets/WordQuest/Tests/EditMode/ReportProjectionTests.cs` | Data-rich account pass pending | implemented-unverified |
| Chapter/error/mistake/heatmap reports | `client/src/components/LearningReport.vue` | `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/ReportScreen.cs` | `unity-client/Assets/WordQuest/Tests/EditMode/ReportProjectionTests.cs` | Chart/heatmap pass pending | implemented-unverified |
| UTF-8 CSV report export | `client/src/utils/reportExport.js` | `unity-client/Assets/WordQuest/Runtime/Application/Reports/ReportExporter.cs` | `unity-client/Assets/WordQuest/Tests/EditMode/ReportProjectionTests.cs` | Windows/macOS file-open pass pending | implemented-unverified |
| Wordbook selection and statistics | `client/src/components/VocabularyImportPanel.vue` | `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/VocabularyScreen.cs` | `unity-client/Tools/validate-api-contracts.sh` | CET-4/CET-6 switch pass pending | implemented-unverified |
| Source manifest and JSON import | `client/src/components/VocabularyImportPanel.vue` | `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/VocabularyScreen.cs` | `unity-client/Assets/WordQuest/Tests/EditMode/ApiContractTests.cs` | Array/wrapper dry-run/confirm pass pending | implemented-unverified |
| Pronunciation score and history | `client/src/utils/speech.js` | `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/PronunciationScreen.cs`, `unity-client/Assets/WordQuest/Runtime/Infrastructure/Audio/SpeechCaptureAdapter.cs`, `unity-client/Assets/WordQuest/Native/macOS/WordQuestSpeech.mm` | `unity-client/Assets/WordQuest/Tests/EditMode/SpeechRecognitionAdapterTests.cs`, `unity-client/Tools/validate-api-contracts.sh` | Windows Dictation/macOS Speech/permission pass pending | implemented-unverified |
| Profile and reminder settings | `client/src/views/ProfileView.vue` | `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/ProfileScreen.cs` | `unity-client/Tools/validate-api-contracts.sh` | Save/relaunch pass pending | implemented-unverified |
| Total/experience leaderboard | `client/src/components/ScoreBoard.vue` | `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/LeaderboardScreen.cs` | `unity-client/Assets/WordQuest/Tests/EditMode/SocialProjectionTests.cs` | Current-player highlight pass pending | implemented-unverified |
| User search and friendship lifecycle | `client/src/views/SocialView.vue` | `unity-client/Assets/WordQuest/Runtime/Application/Social/SocialController.cs` | `unity-client/Assets/WordQuest/Tests/EditMode/SocialProjectionTests.cs` | Two-account staging pass pending | implemented-unverified |
| Asynchronous friend PK | `client/src/views/SocialView.vue` | `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/ChallengeScreen.cs` | `unity-client/Assets/WordQuest/Tests/EditMode/SocialProjectionTests.cs` | Two-account completion pass pending | implemented-unverified |
| AI tutor contextual request | `client/src/components/ChatPanel.vue` | `unity-client/Assets/WordQuest/Runtime/Application/Ai/AiTutorController.cs` | `unity-client/Assets/WordQuest/Tests/EditMode/AiTutorControllerTests.cs` | Context response pass pending | implemented-unverified |
| AI tutor SSE, cancel, retry, fallback | `client/src/components/ChatPanel.vue` | `unity-client/Assets/WordQuest/Runtime/Infrastructure/Api/SseDownloadHandler.cs` | `unity-client/Assets/WordQuest/Tests/EditMode/AiTutorControllerTests.cs` | Streaming/fallback staging pass pending | implemented-unverified |
| AI learning-scope disclosure | `client/src/components/ChatPanel.vue` | `unity-client/Assets/WordQuest/Resources/UI/Screens/AiTutor.uxml` | `unity-client/Tools/validate-project.sh` | Copy review pending | implemented-unverified |
| Windows x86_64 and macOS Universal builds | Browser-only legacy | `unity-client/Assets/WordQuest/Editor/BuildCommand.cs` | `unity-client/Tools/build-players.sh` | `unity-client/Tools/validate-build-artifacts.sh` passed the complete Windows x86-64 Player layout, signed macOS Universal artifacts with audio entitlement, and real macOS UI bootstrap | verified |
