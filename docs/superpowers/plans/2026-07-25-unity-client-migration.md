# Word Quest Unity Client Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Unity 6000.5.3f1 Windows/macOS client that preserves every current Word Quest client feature while reusing the existing Express, MongoDB, and FastAPI services.

**Architecture:** Add a parallel `unity-client/` with pure C# domain rules, application use cases, Unity-backed infrastructure, UI Toolkit presentation, and SpriteRenderer-based gameplay. Keep `client/` operational as the parity oracle until all migration checks pass.

**Tech Stack:** Unity 6000.5.3f1, C#, UI Toolkit (UXML/USS), Unity Input System 1.17.0, UnityWebRequest, NUnit/Unity Test Framework, SpriteRenderer/2D physics.

## Global Constraints

- Target Unity Editor is exactly `6000.5.3f1`.
- First-release platforms are Windows x86_64 and macOS Universal.
- Preserve the current CET-4 behavior and server API before any K12 content conversion.
- Migrate every existing client capability; milestones may stage delivery but must not delete scope.
- Keep the existing `client/` directory unchanged as the migration oracle.
- Domain code must not reference `UnityEngine`.
- Use UI Toolkit for all menus, HUD, dialogs, reports, and social screens.
- Do not log JWT values or silently retry non-idempotent requests.
- Do not claim Unity compilation, Unity tests, or Player builds passed unless they were run with Unity 6000.5.3f1.

---

## Planned File Map

### Project and repository

- `unity-client/Packages/manifest.json`: Unity package dependencies.
- `unity-client/ProjectSettings/ProjectVersion.txt`: editor pin.
- `unity-client/ProjectSettings/EditorBuildSettings.asset`: bootstrap scene registration.
- `unity-client/Assets/WordQuest/Scenes/Bootstrap.unity`: single startup scene.
- `.gitignore`: Unity-generated directory exclusions.
- `.agents/skills/*`: project-specific workflows and validators.

### Domain

- `unity-client/Assets/WordQuest/Domain/Game/Difficulty.cs`: difficulty value object and presets.
- `unity-client/Assets/WordQuest/Domain/Game/ScoringPolicy.cs`: score calculation parity.
- `unity-client/Assets/WordQuest/Domain/Game/GameSession.cs`: authoritative level state.
- `unity-client/Assets/WordQuest/Domain/Game/AchievementPolicy.cs`: achievement rules.
- `unity-client/Assets/WordQuest/Domain/Quiz/QuizModels.cs`: words, questions, options, answer outcomes.
- `unity-client/Assets/WordQuest/Domain/Shared/Result.cs`: success/failure result.

### Application and infrastructure

- `unity-client/Assets/WordQuest/Runtime/Application/AppStateMachine.cs`: legal navigation states.
- `unity-client/Assets/WordQuest/Runtime/Application/WordQuestContext.cs`: authenticated user and settings.
- `unity-client/Assets/WordQuest/Runtime/Infrastructure/Api/*`: request client, endpoints, DTOs, SSE.
- `unity-client/Assets/WordQuest/Runtime/Infrastructure/Storage/*`: token, settings, pending-sync queue.
- `unity-client/Assets/WordQuest/Runtime/Content/*`: levels, characters, chapter themes, resources.

### Presentation and gameplay

- `unity-client/Assets/WordQuest/Runtime/Presentation/WordQuestApp.cs`: composition root.
- `unity-client/Assets/WordQuest/Runtime/Presentation/ScreenRouter.cs`: UI Toolkit screen navigation.
- `unity-client/Assets/WordQuest/UI/*.uxml`: screen structure.
- `unity-client/Assets/WordQuest/UI/Styles/*.uss`: shared and screen styling.
- `unity-client/Assets/WordQuest/Runtime/Gameplay/*`: world, player, encounters, bosses, audio, flow.

### Tests and validation

- `unity-client/Assets/WordQuest/Tests/EditMode/*`: pure rules and API fixture tests.
- `unity-client/Assets/WordQuest/Tests/PlayMode/*`: bootstrap and interaction smoke tests.
- `unity-client/Tools/validate-project.sh`: editor-independent structure and parity checks.
- `unity-client/Tools/run-unity-tests.sh`: batchmode EditMode/PlayMode runner.
- `unity-client/Tools/build-players.sh`: Windows/macOS batch builds.

---

### Task 1: Create the Unity project boundary and repository Skills

**Files:**
- Create: `unity-client/Packages/manifest.json`
- Create: `unity-client/ProjectSettings/ProjectVersion.txt`
- Create: `unity-client/Assets/WordQuest/Scenes/Bootstrap.unity`
- Create: `unity-client/Assets/WordQuest/Domain/WordQuest.Domain.asmdef`
- Create: `unity-client/Assets/WordQuest/Runtime/WordQuest.Runtime.asmdef`
- Create: `unity-client/Tools/validate-project.sh`
- Create: `.agents/skills/unity-client-workflow/SKILL.md`
- Create: `.agents/skills/unity-api-contract/SKILL.md`
- Create: `.agents/skills/unity-feature-parity/SKILL.md`
- Create: `.agents/skills/unity-validation/SKILL.md`
- Modify: `.gitignore`

**Interfaces:**
- Produces: Unity project root at `unity-client/`.
- Produces: validation command `bash unity-client/Tools/validate-project.sh`.
- Produces: assembly names `WordQuest.Domain` and `WordQuest.Runtime`.

- [ ] **Step 1: Write the failing project validator**

```bash
#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd "$(dirname "$0")/.." && pwd)"
test "$(sed -n 's/^m_EditorVersion: //p' "$project_root/ProjectSettings/ProjectVersion.txt")" = "6000.5.3f1"
test -f "$project_root/Packages/manifest.json"
test -f "$project_root/Assets/WordQuest/Scenes/Bootstrap.unity"
test -f "$project_root/Assets/WordQuest/Domain/WordQuest.Domain.asmdef"
test -f "$project_root/Assets/WordQuest/Runtime/WordQuest.Runtime.asmdef"
if find "$project_root" -type d \( -name Library -o -name Temp -o -name Logs -o -name Obj \) | grep -q .; then
  echo "Generated Unity directory found in repository" >&2
  exit 1
fi
```

- [ ] **Step 2: Run the validator to verify it fails**

Run: `bash unity-client/Tools/validate-project.sh`  
Expected: FAIL because `ProjectVersion.txt` and project files do not exist.

- [ ] **Step 3: Create the minimal Unity project and assembly definitions**

`ProjectVersion.txt`:

```text
m_EditorVersion: 6000.5.3f1
```

`manifest.json`:

```json
{
  "dependencies": {
    "com.unity.inputsystem": "1.17.0",
    "com.unity.modules.audio": "1.0.0",
    "com.unity.modules.jsonserialize": "1.0.0",
    "com.unity.modules.physics2d": "1.0.0",
    "com.unity.modules.ui": "1.0.0",
    "com.unity.modules.uielements": "1.0.0",
    "com.unity.modules.unitywebrequest": "1.0.0",
    "com.unity.modules.unitywebrequestaudio": "1.0.0"
  }
}
```

`WordQuest.Domain.asmdef`:

```json
{
  "name": "WordQuest.Domain",
  "rootNamespace": "WordQuest.Domain",
  "autoReferenced": true,
  "overrideReferences": false,
  "noEngineReferences": true
}
```

`WordQuest.Runtime.asmdef`:

```json
{
  "name": "WordQuest.Runtime",
  "rootNamespace": "WordQuest",
  "references": ["WordQuest.Domain", "Unity.InputSystem"],
  "autoReferenced": true
}
```

- [ ] **Step 4: Add repository Skills with executable validation routes**

Each `SKILL.md` must state its trigger, exact files in scope, forbidden generated directories, and exact validation command. `unity-api-contract` must compare route literals under `server/src/routes` with constants under `Runtime/Infrastructure/Api/ApiRoutes.cs`. `unity-feature-parity` must read `docs/unity/feature-parity.md`.

- [ ] **Step 5: Run the validator and inspect the project boundary**

Run: `bash unity-client/Tools/validate-project.sh`  
Expected: PASS with exit code 0.

- [ ] **Step 6: Commit**

```bash
git add .gitignore .agents unity-client
git commit -m "chore: scaffold Unity client and project workflows"
```

### Task 2: Implement pure domain rules with score and session parity

**Files:**
- Create: `unity-client/Assets/WordQuest/Domain/Shared/Result.cs`
- Create: `unity-client/Assets/WordQuest/Domain/Game/Difficulty.cs`
- Create: `unity-client/Assets/WordQuest/Domain/Game/ScoringPolicy.cs`
- Create: `unity-client/Assets/WordQuest/Domain/Game/GameSession.cs`
- Create: `unity-client/Assets/WordQuest/Domain/Game/AchievementPolicy.cs`
- Create: `unity-client/Assets/WordQuest/Domain/Quiz/QuizModels.cs`
- Create: `unity-client/Assets/WordQuest/Tests/EditMode/WordQuest.EditModeTests.asmdef`
- Create: `unity-client/Assets/WordQuest/Tests/EditMode/GameSessionTests.cs`
- Create: `unity-client/Assets/WordQuest/Tests/EditMode/ScoringPolicyTests.cs`

**Interfaces:**
- Produces: `int ScoringPolicy.Calculate(bool correct, int responseMs, int combo, int difficulty, bool hintUsed, double scoreRatio)`.
- Produces: `AnswerOutcome GameSession.SubmitAnswer(bool correct, int responseMs, int earnedScore)`.
- Produces: `LevelResult GameSession.Finish(long endedAtUnixMs)`.
- Produces: `IReadOnlyList<Achievement> AchievementPolicy.FindUnlocked(AchievementContext context, ISet<string> unlocked)`.

- [ ] **Step 1: Write failing score parity tests**

```csharp
[TestCase(true, 2500, 0, 1, false, 1d, 150)]
[TestCase(true, 4000, 2, 1, false, 1d, 150)]
[TestCase(true, 12000, 9, 2, false, 1d, 250)]
[TestCase(true, 2500, 0, 1, true, 1d, 100)]
[TestCase(false, 1000, 10, 5, false, 1d, 0)]
public void Calculate_matches_web_scoring(
    bool correct, int time, int combo, int difficulty, bool hint, double ratio, int expected)
{
    Assert.That(ScoringPolicy.Calculate(correct, time, combo, difficulty, hint, ratio), Is.EqualTo(expected));
}
```

- [ ] **Step 2: Run EditMode tests to verify failure**

Run:

```bash
UNITY_EDITOR_BIN="/Applications/Unity/Hub/Editor/6000.5.3f1/Unity.app/Contents/MacOS/Unity"
"$UNITY_EDITOR_BIN" -batchmode -nographics -projectPath unity-client -runTests -testPlatform EditMode -testResults unity-client/TestResults/editmode.xml -quit
```

Expected: FAIL because `ScoringPolicy` does not exist. If the editor is unavailable, record the test as `NOT RUN: Unity 6000.5.3f1 unavailable` and continue with static validation only.

- [ ] **Step 3: Implement exact score constants and difficulty presets**

```csharp
public static int Calculate(bool correct, int responseMs, int combo, int difficulty, bool hintUsed, double scoreRatio)
{
    if (!correct) return 0;
    var safeDifficulty = Math.Clamp(difficulty, 1, 10);
    var safeCombo = Math.Max(0, combo);
    var safeTime = Math.Max(0, responseMs);
    var ratio = Math.Clamp(scoreRatio, 0d, 1d);
    var baseScore = 100 * safeDifficulty;
    if (hintUsed) baseScore = (int)Math.Floor(baseScore * 0.5d);
    var comboBonus = Math.Min(safeCombo * 10, 50);
    var timeBonus = safeTime < 3000 ? 50 : safeTime < 5000 ? 30 : safeTime < 10000 ? 15 : 0;
    return (int)Math.Round((baseScore + comboBonus + timeBonus) * ratio, MidpointRounding.AwayFromZero);
}
```

- [ ] **Step 4: Add GameSession tests for lives, combo, grace life, and stars**

Test easy/normal/hard lives, incorrect answer combo reset, game-over at zero lives, one grace-life grant, tutorial 99 lives, and 0–3 star outcomes matching `LevelManager.js`.

- [ ] **Step 5: Implement GameSession as the single authoritative state**

Do not duplicate mutable score or life state in presentation classes. Expose immutable snapshots through `GameSessionSnapshot Snapshot`.

- [ ] **Step 6: Run EditMode tests and static no-engine check**

Run the Unity EditMode command.  
Run: `! rg -n "using UnityEngine|UnityEngine\\." unity-client/Assets/WordQuest/Domain`  
Expected: tests PASS when Unity is available; static check exits 0.

- [ ] **Step 7: Commit**

```bash
git add unity-client/Assets/WordQuest/Domain unity-client/Assets/WordQuest/Tests/EditMode
git commit -m "feat: add testable game domain rules"
```

### Task 3: Add application state, settings, and recoverable local persistence

**Files:**
- Create: `unity-client/Assets/WordQuest/Runtime/Application/AppStateMachine.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Application/WordQuestContext.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Infrastructure/Storage/IKeyValueStore.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Infrastructure/Storage/PlayerPrefsStore.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Infrastructure/Storage/TokenStore.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Infrastructure/Storage/PendingSyncQueue.cs`
- Create: `unity-client/Assets/WordQuest/Tests/EditMode/AppStateMachineTests.cs`

**Interfaces:**
- Produces: `bool AppStateMachine.TryTransition(AppState next)`.
- Produces: `string ITokenStore.Load()`, `void Save(string token)`, `void Clear()`.
- Produces: `void PendingSyncQueue.Enqueue(PendingSubmission item)` and `IReadOnlyList<PendingSubmission> ReadAll()`.

- [ ] **Step 1: Write failing legal-transition tests**

```csharp
[Test]
public void Game_requires_authenticated_home()
{
    var machine = new AppStateMachine();
    Assert.That(machine.TryTransition(AppState.Game), Is.False);
    Assert.That(machine.TryTransition(AppState.Authentication), Is.True);
    Assert.That(machine.TryTransition(AppState.Home), Is.True);
    Assert.That(machine.TryTransition(AppState.Game), Is.True);
}
```

- [ ] **Step 2: Run EditMode tests to verify failure**

Expected: FAIL because `AppStateMachine` does not exist.

- [ ] **Step 3: Implement explicit transition table**

Allowed transitions:

```text
Boot -> Authentication | Home
Authentication -> Home
Home -> Game | Review | Endless | DailyChallenge | Reports | Social | Profile | AiTutor | Authentication
Any feature state -> Home | Authentication
Game -> Result
Result -> Home | Game | Reports | Authentication
```

- [ ] **Step 4: Implement storage adapters and pending settlement queue**

Use namespaced keys beginning `wordquest:`. Pending submissions serialize a wrapper object containing a list, because `JsonUtility` cannot serialize a top-level array.

- [ ] **Step 5: Run tests and validator**

Run EditMode tests and `bash unity-client/Tools/validate-project.sh`.  
Expected: PASS when Unity is available; validator always PASS.

- [ ] **Step 6: Commit**

```bash
git add unity-client/Assets/WordQuest/Runtime/Application unity-client/Assets/WordQuest/Runtime/Infrastructure/Storage unity-client/Assets/WordQuest/Tests/EditMode
git commit -m "feat: add application state and resilient persistence"
```

### Task 4: Implement REST contracts, authentication, and SSE transport

**Files:**
- Create: `unity-client/Assets/WordQuest/Runtime/Infrastructure/Api/ApiRoutes.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Infrastructure/Api/ApiResult.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Infrastructure/Api/ApiClient.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Infrastructure/Api/UnityWebRequestAwaiter.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Infrastructure/Api/SseDownloadHandler.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Infrastructure/Api/Dto/AuthDtos.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Infrastructure/Api/Dto/GameDtos.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Infrastructure/Api/Dto/LearningDtos.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Infrastructure/Api/Dto/SocialDtos.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Infrastructure/Api/Dto/ChatDtos.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Infrastructure/Api/Services/*.cs`
- Create: `unity-client/Assets/WordQuest/Tests/EditMode/ApiContractTests.cs`
- Create: `unity-client/Tools/check-api-contracts.sh`

**Interfaces:**
- Produces: `Task<ApiResult<T>> ApiClient.GetAsync<T>(string route, CancellationToken token)`.
- Produces: `Task<ApiResult<T>> ApiClient.SendJsonAsync<T>(string method, string route, object body, CancellationToken token)`.
- Produces: `Task IChatService.StreamAsync(ChatRequest request, Action<string> onDelta, CancellationToken token)`.
- Produces service interfaces `IAuthService`, `IGameService`, `IVocabularyService`, `ILearningService`, `IDailyChallengeService`, `ISocialService`, `IPronunciationService`, `IChatService`.

- [ ] **Step 1: Write route coverage test**

The test reads `ApiRoutes` constants and asserts coverage of these required prefixes:

```csharp
new[] { "/auth/", "/game/", "/vocab/", "/learning/", "/daily-challenge/", "/social/", "/pronunciation/", "/chat/" }
```

- [ ] **Step 2: Run the route test to verify failure**

Expected: FAIL because `ApiRoutes` does not exist.

- [ ] **Step 3: Implement response and error mapping**

`ApiResult<T>` must expose `IsSuccess`, `StatusCode`, `Data`, `Message`, and `IsUnauthorized`. GET retries exactly once on connection error or 502/503/504. Mutation requests never retry automatically.

- [ ] **Step 4: Implement JWT injection and 401 callback**

Set `Authorization: Bearer <token>` only when the token is non-empty. Invoke a central unauthorized callback that clears the token and requests `AppState.Authentication`.

- [ ] **Step 5: Implement SSE parsing with non-stream fallback**

`SseDownloadHandler.ReceiveData` buffers UTF-8 chunks, splits complete blank-line-delimited SSE events, extracts `data:` lines, and ignores `[DONE]`. `ChatService` falls back to `/chat/message` when streaming fails before delivering a delta.

- [ ] **Step 6: Run contract script and tests**

Run: `bash unity-client/Tools/check-api-contracts.sh`  
Run EditMode tests.  
Expected: all route groups present and DTO fixture tests PASS.

- [ ] **Step 7: Commit**

```bash
git add unity-client/Assets/WordQuest/Runtime/Infrastructure/Api unity-client/Assets/WordQuest/Tests/EditMode/ApiContractTests.cs unity-client/Tools/check-api-contracts.sh
git commit -m "feat: add Unity API contracts and resilient transports"
```

### Task 5: Build the UI Toolkit shell, authentication, and home navigation

**Files:**
- Create: `unity-client/Assets/WordQuest/Runtime/Presentation/WordQuestApp.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Presentation/ScreenRouter.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/LoginScreen.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/HomeScreen.cs`
- Create: `unity-client/Assets/WordQuest/UI/AppShell.uxml`
- Create: `unity-client/Assets/WordQuest/UI/Screens/Login.uxml`
- Create: `unity-client/Assets/WordQuest/UI/Screens/Home.uxml`
- Create: `unity-client/Assets/WordQuest/UI/Styles/Tokens.uss`
- Create: `unity-client/Assets/WordQuest/UI/Styles/App.uss`
- Create: `unity-client/Assets/WordQuest/Tests/PlayMode/WordQuest.PlayModeTests.asmdef`
- Create: `unity-client/Assets/WordQuest/Tests/PlayMode/BootstrapSmokeTests.cs`

**Interfaces:**
- Produces: `void ScreenRouter.Show(ScreenId screen)`.
- Consumes: `IAuthService`, `AppStateMachine`, `WordQuestContext`.
- Produces named UI elements `username-field`, `password-field`, `login-button`, `register-button`, `status-label`, and feature buttons with `data-screen`.

- [ ] **Step 1: Write failing bootstrap smoke test**

```csharp
[UnityTest]
public IEnumerator Boot_creates_single_app_and_login_screen()
{
    yield return SceneManager.LoadSceneAsync("Bootstrap");
    Assert.That(Object.FindObjectsByType<WordQuestApp>(FindObjectsSortMode.None), Has.Length.EqualTo(1));
    Assert.That(GameObject.Find("WordQuest UI"), Is.Not.Null);
}
```

- [ ] **Step 2: Run PlayMode tests to verify failure**

Expected: FAIL because `WordQuestApp` is absent.

- [ ] **Step 3: Implement composition root and screen router**

`WordQuestApp` creates services in dependency order, installs a `UIDocument`, and routes to Home only when a stored token exists and `/auth/me` succeeds.

- [ ] **Step 4: Implement desktop-first visual system**

Use token variables for forest green, parchment, gold, error red, 8px spacing, 12px/18px radii, readable 16px body text, visible keyboard focus, and minimum 44px controls. Avoid emoji as the only meaning-bearing label.

- [ ] **Step 5: Run PlayMode smoke test and inspect UXML names**

Run PlayMode tests.  
Run: `rg -n 'name="(username-field|password-field|login-button|register-button|status-label)"' unity-client/Assets/WordQuest/UI/Screens/Login.uxml`  
Expected: test PASS when Unity is available and all five names found.

- [ ] **Step 6: Commit**

```bash
git add unity-client/Assets/WordQuest/Runtime/Presentation unity-client/Assets/WordQuest/UI unity-client/Assets/WordQuest/Tests/PlayMode
git commit -m "feat: add Unity app shell and authentication flow"
```

### Task 6: Import content and implement the explorable 2D world

**Files:**
- Create: `unity-client/Assets/WordQuest/Runtime/Content/ContentCatalog.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Content/LevelDefinition.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Content/ChapterTheme.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Gameplay/WorldController.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Gameplay/PlayerController.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Gameplay/EncounterController.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Gameplay/WorldGenerator.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Infrastructure/Input/GameInput.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/LevelSelectScreen.cs`
- Create: `unity-client/Assets/WordQuest/UI/Screens/LevelSelect.uxml`
- Create: `unity-client/Assets/WordQuest/Editor/PixelArtImportProcessor.cs`
- Copy: `client/src/game/data/levels.json` to `unity-client/Assets/WordQuest/Resources/Data/levels.json`
- Copy: authorized art/audio under `client/public/assets/` to `unity-client/Assets/WordQuest/Resources/`
- Create: `unity-client/Assets/WordQuest/Tests/EditMode/ContentCatalogTests.cs`
- Create: `unity-client/Assets/WordQuest/Tests/PlayMode/WorldSmokeTests.cs`

**Interfaces:**
- Produces: `LevelDefinition ContentCatalog.GetLevel(int chapter, int level)`.
- Produces: `GameObject WorldGenerator.Generate(LevelDefinition level, ChapterTheme theme, int seed)`.
- Produces: `event Action<Encounter> EncounterController.Encountered`.

- [ ] **Step 1: Write failing content tests**

Assert six chapters, thirty normal levels, valid non-negative monster counts, and a chapter theme for every chapter.

- [ ] **Step 2: Run tests to verify failure**

Expected: FAIL because `ContentCatalog` does not exist.

- [ ] **Step 3: Implement resilient content conversion**

Read the copied JSON once, convert to immutable definitions, and reject duplicate `(chapter, level)` keys. Keep gameplay fields separate from presentation fields.

- [ ] **Step 4: Implement deterministic world generation**

Given the same chapter, level, and seed, generated player, NPC, monster, and Boss spawn positions must be identical. Maintain a minimum distance from player spawn and exclude UI-only state from the world.

- [ ] **Step 5: Implement Input System actions**

Expose `Vector2 Move`, `bool InteractPressed`, `bool PausePressed`, and `bool CancelPressed`. Player movement occurs in `FixedUpdate`; UI focus disables movement.

- [ ] **Step 6: Run tests and asset validator**

Run EditMode/PlayMode tests when Unity is available.  
Run: `bash unity-client/Tools/validate-project.sh`  
Expected: deterministic tests PASS and assets exist.

- [ ] **Step 7: Commit**

```bash
git add unity-client/Assets/WordQuest/Runtime/Content unity-client/Assets/WordQuest/Runtime/Gameplay unity-client/Assets/WordQuest/Runtime/Infrastructure/Input unity-client/Assets/WordQuest/Editor unity-client/Assets/WordQuest/Resources unity-client/Assets/WordQuest/Tests
git commit -m "feat: add Unity content catalog and explorable world"
```

### Task 7: Migrate quiz flow, adaptive behavior, HUD, and settlement

**Files:**
- Create: `unity-client/Assets/WordQuest/Runtime/Gameplay/GameFlowController.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Application/Quiz/QuizFactory.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/QuizOverlay.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/HudScreen.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/PauseOverlay.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/ResultScreen.cs`
- Create: `unity-client/Assets/WordQuest/UI/Screens/Quiz.uxml`
- Create: `unity-client/Assets/WordQuest/UI/Screens/Hud.uxml`
- Create: `unity-client/Assets/WordQuest/UI/Screens/Pause.uxml`
- Create: `unity-client/Assets/WordQuest/UI/Screens/Result.uxml`
- Create: `unity-client/Assets/WordQuest/Tests/EditMode/QuizFactoryTests.cs`
- Create: `unity-client/Assets/WordQuest/Tests/PlayMode/QuizFlowTests.cs`

**Interfaces:**
- Produces: `QuizQuestion QuizFactory.Create(WordDto word, QuestionType type, IReadOnlyList<WordDto> pool)`.
- Produces: `Task GameFlowController.StartLevelAsync(LevelSelection selection, CancellationToken token)`.
- Produces: `Task GameFlowController.SubmitAnswerAsync(QuizAnswer answer, CancellationToken token)`.

- [ ] **Step 1: Write failing question tests**

Cover `choice_en2cn`, `choice_cn2en`, `spell_hint`, `spell_full`, and `translate`. Choice questions must contain four unique non-empty options and exactly one correct option.

- [ ] **Step 2: Run tests to verify failure**

Expected: FAIL because `QuizFactory` does not exist.

- [ ] **Step 3: Implement death-spiral protection and adaptive type selection**

At two consecutive errors downgrade to `choice_en2cn`. At three consecutive errors force difficulty 1 and grant one grace life once when the player has one life.

- [ ] **Step 4: Implement authoritative pause/answer/resume sequence**

On encounter: disable world input and physics interactions, show quiz, submit the answer record, update the `GameSession`, then either resume world, revive the monster after two seconds, or show result. Event subscriptions are disposed when leaving the game.

- [ ] **Step 5: Implement explicit pause controls**

Escape and the HUD pause button open the same overlay. Pause freezes gameplay simulation but leaves UI input active. The overlay supports resume, mute/unmute, return to menu, and logout.

- [ ] **Step 6: Implement settlement retry queue**

Successful level completion calls `/game/progress`; failed submissions are added to `PendingSyncQueue`. Home entry retries queued records one by one and removes only confirmed records.

- [ ] **Step 7: Run tests**

Run EditMode and PlayMode tests.  
Expected: question tests and encounter-pause-resume smoke test PASS when Unity is available.

- [ ] **Step 8: Commit**

```bash
git add unity-client/Assets/WordQuest/Runtime/Application/Quiz unity-client/Assets/WordQuest/Runtime/Gameplay/GameFlowController.cs unity-client/Assets/WordQuest/Runtime/Presentation/Screens unity-client/Assets/WordQuest/UI/Screens unity-client/Assets/WordQuest/Tests
git commit -m "feat: migrate quiz gameplay and level settlement"
```

### Task 8: Add Bosses, tutorial, characters, audio, and achievements

**Files:**
- Create: `unity-client/Assets/WordQuest/Runtime/Gameplay/Boss/BossController.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Gameplay/Boss/RoamingBossController.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Gameplay/Boss/TurretBossController.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Gameplay/Boss/ChargingBossController.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Gameplay/TutorialController.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Content/CharacterCatalog.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Infrastructure/Audio/AudioService.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/CharacterScreen.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Presentation/AchievementToast.cs`
- Create: `unity-client/Assets/WordQuest/UI/Screens/Character.uxml`
- Create: `unity-client/Assets/WordQuest/Tests/EditMode/BossAndAchievementTests.cs`

**Interfaces:**
- Produces: `BossController.Configure(BossDefinition definition, GameSession session)`.
- Produces: `event Action<BossEncounter> BossController.QuizRequested`.
- Produces: `Task AudioService.PlayMusicAsync(MusicId id, CancellationToken token)`.

- [ ] **Step 1: Write failing Boss and achievement tests**

Assert boss type selection by level, Boss quiz hit-point decrement, 500 defeat bonus, and all 16 existing achievement IDs.

- [ ] **Step 2: Run tests to verify failure**

Expected: FAIL because Boss and achievement implementations are absent.

- [ ] **Step 3: Implement three bounded Boss behaviors**

Roaming patrols between generated points, Turret emits pooled projectiles, Charging telegraphs before a dash. All stop while a quiz or pause menu is open. Invulnerability prevents repeated contact damage.

- [ ] **Step 4: Implement tutorial and character selection**

Tutorial uses 99 lives and 60 seconds, teaches movement/interact/answer, and persists `wordquest:skipIntro`. Character selection supports indices 0–7 and updates `/game/character`.

- [ ] **Step 5: Implement audio and achievements**

Map existing BGM/SFX keys, persist mute/volume, stop duplicate music, and display achievements returned by `AchievementPolicy` after the server confirms save.

- [ ] **Step 6: Implement daily reward on Home**

Load reward eligibility with the authenticated profile context, call `/game/daily-reward` once per user action, disable the button in flight, and update displayed experience and streak from the confirmed response.

- [ ] **Step 7: Run tests and commit**

Run EditMode tests and the validator.  
Commit:

```bash
git add unity-client/Assets/WordQuest
git commit -m "feat: migrate bosses tutorial characters and achievements"
```

### Task 9: Migrate endless mode, review sessions, and daily challenges

**Files:**
- Create: `unity-client/Assets/WordQuest/Runtime/Application/Modes/EndlessModeController.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Application/Modes/ReviewModeController.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Application/Modes/DailyChallengeController.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/EndlessScreen.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/ReviewScreen.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/DailyChallengeScreen.cs`
- Create: `unity-client/Assets/WordQuest/UI/Screens/Endless.uxml`
- Create: `unity-client/Assets/WordQuest/UI/Screens/Review.uxml`
- Create: `unity-client/Assets/WordQuest/UI/Screens/DailyChallenge.uxml`
- Create: `unity-client/Assets/WordQuest/Tests/EditMode/LearningModeTests.cs`

**Interfaces:**
- Produces: `EndlessRound EndlessModeController.NextRound(bool previousCorrect)`.
- Produces: `Task<ReviewSession> ReviewModeController.CreateAsync(int limit, CancellationToken token)`.
- Produces: `Task<DailyChallenge> DailyChallengeController.LoadTodayAsync(CancellationToken token)`.

- [ ] **Step 1: Write failing endless threshold tests**

Assert difficulty levels at streaks 0, 5, 10, 20, and 30; time limits 30000, 26000, 22000, 18000, and 14000; choice mode through level 2 and spelling above level 2.

- [ ] **Step 2: Run tests to verify failure**

Expected: FAIL because mode controllers do not exist.

- [ ] **Step 3: Implement endless mode and score submission**

Use three initial lives, persist local best score, submit `/game/endless-score`, and show server best.

- [ ] **Step 4: Implement review session lifecycle**

Load `/learning/review/today`, create `/learning/review/sessions`, collect answer payloads, submit exactly once, and present updated mastery.

- [ ] **Step 5: Implement daily challenge**

Load today, render question progress, prevent duplicate local submission while a request is active, submit, and show daily leaderboard.

- [ ] **Step 6: Run tests and commit**

Run EditMode tests.  
Commit:

```bash
git add unity-client/Assets/WordQuest
git commit -m "feat: migrate endless review and daily challenge modes"
```

### Task 10: Migrate reports, vocabulary management, and pronunciation

**Files:**
- Create: `unity-client/Assets/WordQuest/Runtime/Application/Reports/ReportController.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/ReportScreen.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Presentation/Controls/BarChartElement.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Presentation/Controls/HeatmapElement.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Application/Reports/ReportExporter.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/VocabularyScreen.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/PronunciationScreen.cs`
- Create: `unity-client/Assets/WordQuest/UI/Screens/Reports.uxml`
- Create: `unity-client/Assets/WordQuest/UI/Screens/Vocabulary.uxml`
- Create: `unity-client/Assets/WordQuest/UI/Screens/Pronunciation.uxml`
- Create: `unity-client/Assets/WordQuest/Tests/EditMode/ReportProjectionTests.cs`

**Interfaces:**
- Produces: `Task<LearningReportViewModel> ReportController.LoadAsync(string wordbookId, CancellationToken token)`.
- Produces: `void BarChartElement.SetData(IReadOnlyList<ChartPoint> points)`.
- Produces: `void HeatmapElement.SetData(IReadOnlyList<HeatmapDay> days)`.

- [ ] **Step 1: Write failing report projection tests**

Use fixtures for empty data, thirty daily points, chapter rates, top mistakes, error types, and heatmap days. Assert stable labels and zero-safe percentages.

- [ ] **Step 2: Run tests to verify failure**

Expected: FAIL because report projections do not exist.

- [ ] **Step 3: Implement report aggregation and custom UI Toolkit drawing**

Load report endpoints concurrently, tolerate one failed optional panel, and draw bars/heatmap through `generateVisualContent` without a chart dependency.

- [ ] **Step 4: Implement report export**

Export the currently displayed report to UTF-8 CSV under `Application.persistentDataPath/Exports`, escape commas/quotes/newlines according to RFC 4180, and reveal the output path in the UI.

- [ ] **Step 5: Implement wordbook and vocabulary workflows**

List/select wordbooks, show counts/source manifest, support JSON vocabulary import dry run then confirmed import, and refresh stats after success.

- [ ] **Step 6: Implement pronunciation entry**

Record or select an audio payload only through a platform adapter, submit scoring payload, show score/feedback, and list history. If microphone capture is unavailable, disable the record button with an explicit message rather than failing.

- [ ] **Step 7: Run tests and commit**

Run EditMode tests.  
Commit:

```bash
git add unity-client/Assets/WordQuest
git commit -m "feat: migrate reports vocabulary and pronunciation"
```

### Task 11: Migrate profile, leaderboards, friends, and asynchronous PK

**Files:**
- Create: `unity-client/Assets/WordQuest/Runtime/Application/Social/SocialController.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/ProfileScreen.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/LeaderboardScreen.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/SocialScreen.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/ChallengeScreen.cs`
- Create: `unity-client/Assets/WordQuest/UI/Screens/Profile.uxml`
- Create: `unity-client/Assets/WordQuest/UI/Screens/Leaderboard.uxml`
- Create: `unity-client/Assets/WordQuest/UI/Screens/Social.uxml`
- Create: `unity-client/Assets/WordQuest/UI/Screens/Challenge.uxml`
- Create: `unity-client/Assets/WordQuest/Tests/EditMode/SocialProjectionTests.cs`

**Interfaces:**
- Produces: `Task<SocialViewModel> SocialController.RefreshAsync(CancellationToken token)`.
- Produces: `Task<ApiResult<FriendshipDto>> SocialController.SendFriendRequestAsync(string userId, CancellationToken token)`.
- Produces: `Task<ApiResult<ChallengeDto>> SocialController.SubmitChallengeAsync(string id, IReadOnlyList<ChallengeAnswerDto> answers, CancellationToken token)`.

- [ ] **Step 1: Write failing social projection tests**

Cover incoming, outgoing, accepted, expired challenge, already-submitted challenge, empty leaderboard, and current-user highlighting.

- [ ] **Step 2: Run tests to verify failure**

Expected: FAIL because social projections do not exist.

- [ ] **Step 3: Implement profile and leaderboard**

Show nickname, experience, selected character, reminders, achievements, total/experience leaderboard, and endless best. Save reminder time only in `HH:mm`.

- [ ] **Step 4: Implement friends and asynchronous PK**

Support user search, request, accept/reject, delete, challenge creation, challenge list/detail, answer collection, submission, and result rendering. Disable mutation controls while each mutation is in flight.

- [ ] **Step 5: Run tests and commit**

Run EditMode tests.  
Commit:

```bash
git add unity-client/Assets/WordQuest
git commit -m "feat: migrate profile rankings and social challenges"
```

### Task 12: Complete the AI tutor UX and safety-aware fallback

**Files:**
- Create: `unity-client/Assets/WordQuest/Runtime/Application/Ai/AiTutorController.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/AiTutorScreen.cs`
- Create: `unity-client/Assets/WordQuest/UI/Screens/AiTutor.uxml`
- Create: `unity-client/Assets/WordQuest/Tests/EditMode/AiTutorControllerTests.cs`
- Create: `unity-client/Assets/WordQuest/Tests/PlayMode/AiTutorSmokeTests.cs`

**Interfaces:**
- Produces: `Task SendAsync(string message, ChatContext context, Action<string> onTextChanged, CancellationToken token)`.
- Consumes: `IChatService.StreamAsync` and `IChatService.SendAsync`.

- [ ] **Step 1: Write failing streaming/fallback tests**

Use fake services to verify ordered delta concatenation, cancellation, stream failure before first delta falling back to non-stream, stream failure after a delta showing a recoverable partial-response message, and safety errors remaining user-readable.

- [ ] **Step 2: Run tests to verify failure**

Expected: FAIL because `AiTutorController` does not exist.

- [ ] **Step 3: Implement contextual AI requests**

Include current word, correct answer, player answer, chapter, player level, correct/wrong streak, answer quality, edit distance, similarity, fuzzy feedback, word knowledge, and trigger type.

- [ ] **Step 4: Implement tutor screen behavior**

Render user/assistant messages, typing state, incremental text, cancel button, retry button, context chip, and a visible statement that the AI is limited to learning assistance.

- [ ] **Step 5: Run tests and commit**

Run EditMode and PlayMode tests.  
Commit:

```bash
git add unity-client/Assets/WordQuest
git commit -m "feat: complete AI tutor streaming experience"
```

### Task 13: Close parity, automate builds, and document operation

**Files:**
- Create: `docs/unity/feature-parity.md`
- Create: `docs/unity/development.md`
- Create: `docs/unity/build-and-release.md`
- Create: `unity-client/Assets/WordQuest/Editor/BuildCommand.cs`
- Create: `unity-client/Assets/WordQuest/Editor/ProjectValidator.cs`
- Create: `unity-client/Tools/run-unity-tests.sh`
- Create: `unity-client/Tools/build-players.sh`
- Modify: `.github/workflows/ci.yml`
- Modify: `README.md`

**Interfaces:**
- Produces: Unity methods `WordQuest.Editor.BuildCommand.BuildWindows` and `BuildMacOS`.
- Produces: validation method `WordQuest.Editor.ProjectValidator.ValidateOrThrow`.
- Produces: documented parity table mapping every legacy feature to Unity files and tests.

- [ ] **Step 1: Write the parity matrix with evidence columns**

Required columns:

```text
Legacy feature | Legacy source | Unity implementation | Automated evidence | Manual evidence | Status
```

Populate every feature from the design specification. A status can only be `implemented-unverified`, `verified`, or `blocked`; no empty cells.

- [ ] **Step 2: Extend editor-independent validator**

Fail if a required parity row is absent, a Unity source path in the matrix does not exist, a UXML file referenced by code is absent, a generated Unity directory is tracked, or `ProjectVersion.txt` is not `6000.5.3f1`.

- [ ] **Step 3: Add batch test and build scripts**

`run-unity-tests.sh` runs EditMode then PlayMode and writes XML under `unity-client/TestResults/`. `build-players.sh` runs both build methods and writes to `unity-client/Builds/Windows/` and `unity-client/Builds/macOS/`.

- [ ] **Step 4: Add CI jobs without breaking current Web CI**

Keep existing server/client/docker jobs. Add a `unity-static` job that always runs the editor-independent validator. Add a Unity batch job only when repository Unity licensing secrets are configured; otherwise document the local command and leave the current CI green.

- [ ] **Step 5: Run all available verification**

Run:

```bash
bash unity-client/Tools/validate-project.sh
bash unity-client/Tools/check-api-contracts.sh
git diff --check
git status --short
```

When Unity 6000.5.3f1 is installed, additionally run:

```bash
bash unity-client/Tools/run-unity-tests.sh
bash unity-client/Tools/build-players.sh
```

Expected: available static checks PASS. Unity-dependent results must be reported truthfully as PASS, FAIL, or NOT RUN.

- [ ] **Step 6: Commit**

```bash
git add README.md .github/workflows/ci.yml docs/unity unity-client
git commit -m "docs: finish Unity migration validation and release workflow"
```

## Final Verification Checklist

- [ ] Every design-spec feature appears in `docs/unity/feature-parity.md`.
- [ ] Every parity row points to an existing Unity file.
- [ ] Domain code has no UnityEngine reference.
- [ ] Static project and API contract validators pass.
- [ ] Existing Web and server files remain present.
- [ ] Git diff contains no generated Unity directories or secrets.
- [ ] Unity compilation/test/build status is reported from actual command evidence only.
- [ ] Windows/macOS launch, API base URL, server startup, and build steps are documented.
