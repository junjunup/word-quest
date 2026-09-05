# Unity Blind Review Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让毕业设计评委在首次启动后的 5–10 分钟内，通过登录、首页、游戏引导、答题反馈和结算理解并验证 Word Quest 的完整学习闭环。

**Architecture:** 保留现有 UI Toolkit、C# 分层、API 契约与 Sprout Lands 素材；界面结构由 UXML/USS 调整，行为由现有 Presentation 和 Gameplay 控制器扩展，纯规则尽量抽成可在 EditMode 验证的函数。每项改动先补失败测试，再做最小实现，并在独立提交后保持项目可构建。

**Tech Stack:** Unity 6000.5.3f1、C#、UI Toolkit（UXML/USS）、Unity Test Framework（NUnit/EditMode/PlayMode）、Bash 验证脚本、Git。

## Global Constraints

- 所有新增桌面客户端代码必须位于 `unity-client/`；不修改 `client/`、`server/` 或 `llm-service/`。
- `Assets/WordQuest/Domain` 不得引用 `UnityEngine`；应用状态放在 `Runtime/Application`，持久化放在 `Runtime/Infrastructure`，UI 放在 `Runtime/Presentation`，世界交互放在 `Runtime/Gameplay`。
- 只复用仓库现有 Sprout Lands 图像、字体和音频；不生成替代素材、不引入付费素材或新外部服务。
- 不改变 API 路径、请求字段、计分公式、关卡数量、怪物数量、碰撞规则或学习算法。
- 本地体验账号按钮仅在 API 主机为 `localhost`、`127.0.0.1` 或 `::1` 时显示，只填入 `test` / `123456`，不自动提交。
- 1280×720 为盲审主验收尺寸；960×540 验证最小可读布局；1440×900 验证扩展布局。
- 正确、错误和警告状态必须同时使用文字与样式，不得只依赖颜色；核心操作必须可键盘聚焦。
- `WordDto` 当前没有词性字段；不得从释义猜测词性。反馈仅显示真实存在的音标、释义、例句、翻译、服务器掌握度与变化量。
- Unity 生成的 `Library/`、`Temp/`、`Obj/`、`Logs/`、`Builds/`、`TestResults/`、IDE 工程文件和本地用户设置不得提交。
- 最终只推送 `codex/unity-blind-review-optimization`，不创建 PR、不合并 `main`、不发布安装包。

---

## File Map

- `unity-client/Assets/WordQuest/Runtime/Presentation/WindowReadabilityPolicy.cs`：新增纯尺寸规则与桌面窗口恢复入口。
- `unity-client/Assets/WordQuest/Runtime/Presentation/WordQuestApp.cs`：接入窗口规则、API origin、引导重播、统一答题反馈与结算复习入口。
- `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/LoginScreen.cs`：登录/注册模式与本地体验账号填充。
- `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/HomeScreen.cs`：主任务、推荐原因与回退文案。
- `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/HudScreen.cs`：任务进度与状态分组文本。
- `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/TutorialOverlay.cs`：三步引导的步骤与进度呈现。
- `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/PauseOverlay.cs`：重播操作说明与危险操作层级。
- `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/QuizOverlay.cs`：键盘 1–4、计时警示、输入冻结与统一反馈卡。
- `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/ResultScreen.cs`：游戏指标、学习指标、掌握度、同步状态与薄弱词入口。
- `unity-client/Assets/WordQuest/Runtime/Gameplay/TutorialController.cs`：安全读取引导偏好与当前会话重播。
- `unity-client/Assets/WordQuest/Runtime/Gameplay/GameFlowController.cs`：真实答题证据、反馈后继续与结算聚合。
- `unity-client/Assets/WordQuest/Runtime/Gameplay/WorldGenerator.cs`：用现有 sprite 增加不参与碰撞的场景层次。
- `unity-client/Assets/WordQuest/Domain/Game/GameSession.cs`：记录经服务器确认的掌握度汇总，不改变计分与关卡完成规则。
- `unity-client/Assets/WordQuest/Resources/UI/Screens/Login.uxml`：登录品牌区、模式区与本地体验入口。
- `unity-client/Assets/WordQuest/Resources/UI/Screens/Home.uxml`：单一主任务和三类能力分组。
- `unity-client/Assets/WordQuest/Resources/UI/Screens/Game.uxml`：HUD 分组、教程步骤、答题反馈与暂停菜单。
- `unity-client/Assets/WordQuest/Resources/UI/Screens/Result.uxml`：结算证据卡与薄弱词入口。
- `unity-client/Assets/WordQuest/Resources/UI/Styles/App.uss`：复用现有 token，增加响应式、焦点和反馈状态。
- `unity-client/ProjectSettings/ProjectSettings.asset`：默认窗口改为 1280×720。
- `unity-client/Assets/WordQuest/Tests/EditMode/*Tests.cs`：新增和扩展行为测试。
- `unity-client/Assets/WordQuest/Tests/PlayMode/BlindReviewSmokeTests.cs`：三档尺寸与关键路径 UI 冒烟。
- `unity-client/Tools/validate-project.sh`：加入盲审关键控件静态门禁。
- `docs/unity/feature-parity.md`：记录真实自动化与人工验证结果。
- `docs/unity/blind-review-optimization-verification.md`：新增本轮命令、结果、截图与未覆盖范围。

---

### Task 1: Desktop Window Readability Baseline

**Files:**
- Create: `unity-client/Assets/WordQuest/Runtime/Presentation/WindowReadabilityPolicy.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Presentation/WindowReadabilityPolicy.cs.meta`
- Create: `unity-client/Assets/WordQuest/Tests/EditMode/WindowReadabilityPolicyTests.cs`
- Create: `unity-client/Assets/WordQuest/Tests/EditMode/WindowReadabilityPolicyTests.cs.meta`
- Modify: `unity-client/Assets/WordQuest/Runtime/Presentation/WordQuestApp.cs:65-82`
- Modify: `unity-client/ProjectSettings/ProjectSettings.asset:44-47`

**Interfaces:**
- Produces: `WindowReadabilityPolicy.TargetWidth = 1280`, `TargetHeight = 720`, `MinimumWidth = 960`, `MinimumHeight = 540`.
- Produces: `WindowReadabilityPolicy.NeedsRecovery(int width, int height) -> bool` and `WindowReadabilityPolicy.ApplyAtStartup()`.
- Consumes: Unity `Screen.width`, `Screen.height`, `Screen.fullScreenMode`, `Screen.SetResolution`.

- [ ] **Step 1: Write the failing EditMode tests**

```csharp
[TestCase(959, 540, true)]
[TestCase(960, 539, true)]
[TestCase(960, 540, false)]
[TestCase(1440, 900, false)]
public void Recovery_is_required_only_below_the_readable_floor(
    int width, int height, bool expected)
{
    Assert.That(
        WindowReadabilityPolicy.NeedsRecovery(width, height),
        Is.EqualTo(expected));
}

[Test]
public void Recovery_target_is_the_blind_review_baseline()
{
    Assert.That(WindowReadabilityPolicy.TargetWidth, Is.EqualTo(1280));
    Assert.That(WindowReadabilityPolicy.TargetHeight, Is.EqualTo(720));
}
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `bash unity-client/Tools/run-unity-tests.sh EditMode`

Expected: FAIL because `WindowReadabilityPolicy` does not exist.

- [ ] **Step 3: Implement the pure rule and startup adapter**

```csharp
public static class WindowReadabilityPolicy
{
    public const int TargetWidth = 1280;
    public const int TargetHeight = 720;
    public const int MinimumWidth = 960;
    public const int MinimumHeight = 540;

    public static bool NeedsRecovery(int width, int height) =>
        width < MinimumWidth || height < MinimumHeight;

    public static void ApplyAtStartup()
    {
        if (Application.isEditor || Screen.fullScreen ||
            !NeedsRecovery(Screen.width, Screen.height))
            return;
        Screen.SetResolution(
            TargetWidth,
            TargetHeight,
            FullScreenMode.Windowed);
    }
}
```

Call `WindowReadabilityPolicy.ApplyAtStartup()` at the start of `WordQuestApp.Awake()`. Change both standalone and web defaults from `1440×900` to `1280×720` without changing resizable-window or fullscreen-switch settings.

- [ ] **Step 4: Run EditMode and static validation**

Run: `bash unity-client/Tools/run-unity-tests.sh EditMode`

Expected: PASS with zero failures.

Run: `bash unity-client/Tools/validate-project.sh`

Expected: `Unity project validation PASS`.

- [ ] **Step 5: Commit the window baseline**

```bash
git add unity-client/Assets/WordQuest/Runtime/Presentation/WindowReadabilityPolicy.cs unity-client/Assets/WordQuest/Runtime/Presentation/WindowReadabilityPolicy.cs.meta unity-client/Assets/WordQuest/Tests/EditMode/WindowReadabilityPolicyTests.cs unity-client/Assets/WordQuest/Tests/EditMode/WindowReadabilityPolicyTests.cs.meta unity-client/Assets/WordQuest/Runtime/Presentation/WordQuestApp.cs unity-client/ProjectSettings/ProjectSettings.asset
git commit -m "feat: enforce Unity blind review window baseline"
```

### Task 2: Login and Registration States

**Files:**
- Modify: `unity-client/Assets/WordQuest/Resources/UI/Screens/Login.uxml`
- Modify: `unity-client/Assets/WordQuest/Resources/UI/Styles/App.uss`
- Modify: `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/LoginScreen.cs`
- Modify: `unity-client/Assets/WordQuest/Runtime/Presentation/WordQuestApp.cs:119-145,242-255`
- Modify: `unity-client/Assets/WordQuest/Tests/EditMode/LoginScreenTests.cs`

**Interfaces:**
- Produces: `LoginScreen.AuthMode` with `SignIn` and `Register` states.
- Produces: `LoginScreen.IsLoopbackOrigin(string origin) -> bool`.
- Consumes: API origin passed by `WordQuestApp`; login and registration still use `IAuthService` unchanged.
- UI contract: `auth-mode-toggle-button`, `nickname-field`, `local-demo-button`, `login-button`, `register-button`, `status-label`.

- [ ] **Step 1: Add failing mode and loopback tests**

```csharp
[Test]
public void Sign_in_mode_hides_registration_only_fields()
{
    var view = CreateView();
    using var screen = CreateScreen(
        view, new ThrowingAuthService(), "http://localhost:4000");
    Assert.That(view.Q<TextField>("nickname-field").resolvedStyle.display,
        Is.EqualTo(DisplayStyle.None));
    Assert.That(view.Q<Button>("register-button").resolvedStyle.display,
        Is.EqualTo(DisplayStyle.None));
}

[TestCase("http://localhost:4000", true)]
[TestCase("http://127.0.0.1:4000", true)]
[TestCase("http://[::1]:4000", true)]
[TestCase("https://api.wordquest.example", false)]
public void Demo_account_is_limited_to_loopback_origins(
    string origin, bool visible)
{
    var view = CreateView();
    using var screen = CreateScreen(view, new ThrowingAuthService(), origin);
    Assert.That(
        view.Q<Button>("local-demo-button").resolvedStyle.display ==
        DisplayStyle.Flex,
        Is.EqualTo(visible));
}

[Test]
public void Demo_action_fills_but_does_not_submit_credentials()
{
    var auth = new FailedAuthService();
    var view = CreateView();
    using var screen = CreateScreen(view, auth, "http://localhost:4000");
    Submit(view.Q<Button>("local-demo-button"));
    Assert.That(view.Q<TextField>("username-field").value, Is.EqualTo("test"));
    Assert.That(view.Q<TextField>("password-field").value, Is.EqualTo("123456"));
    Assert.That(auth.LoginCalls, Is.Zero);
}
```

Update the existing test helpers so the constructor input and call count are explicit:

```csharp
private static LoginScreen CreateScreen(
    VisualElement view,
    IAuthService auth,
    string origin = "https://api.wordquest.example")
{
    return new LoginScreen(
        view,
        auth,
        new WordQuestContext(),
        _ => new UserProfile(),
        null,
        origin);
}

public int LoginCalls { get; private set; }

public Task<ApiResult<AuthDataDto>> LoginAsync(
    string username,
    string password,
    CancellationToken cancellationToken)
{
    LoginCalls++;
    return Task.FromResult(
        ApiResult<AuthDataDto>.Failure(0, "offline"));
}
```

The existing `RegisterAsync`, `GetCurrentUserAsync`, `UpdateReminderAsync` and `SignOut` methods remain byte-for-byte unchanged.

- [ ] **Step 2: Run EditMode and confirm RED**

Run: `bash unity-client/Tools/run-unity-tests.sh EditMode`

Expected: FAIL because the new controls, origin parameter and state behavior do not exist.

- [ ] **Step 3: Implement explicit auth states and local demo fill**

Use a mode renderer that changes visibility and copy without clearing entered username/password:

```csharp
private void RenderMode(AuthMode mode)
{
    currentMode = mode;
    nickname.style.display = mode == AuthMode.Register
        ? DisplayStyle.Flex : DisplayStyle.None;
    registerButton.style.display = mode == AuthMode.Register
        ? DisplayStyle.Flex : DisplayStyle.None;
    loginButton.style.display = mode == AuthMode.SignIn
        ? DisplayStyle.Flex : DisplayStyle.None;
    modeToggle.text = mode == AuthMode.SignIn
        ? "没有账号？创建学习账号" : "已有账号？返回登录";
}

public static bool IsLoopbackOrigin(string origin)
{
    return Uri.TryCreate(origin, UriKind.Absolute, out var uri) &&
        (uri.IsLoopback || string.Equals(
            uri.Host, "localhost", StringComparison.OrdinalIgnoreCase));
}
```

In `WordQuestApp.ComposeServices`, retain `origin` in a field and pass it to `LoginScreen`. In UXML, add the value statement “通过探索、答题和间隔复习掌握英语词汇” and keep all status text directly below the form.

- [ ] **Step 4: Verify login behavior**

Run: `bash unity-client/Tools/run-unity-tests.sh EditMode`

Expected: PASS with zero failures, including existing password masking and recovery tests.

Run: `bash unity-client/Tools/validate-project.sh`

Expected: `Unity project validation PASS`.

- [ ] **Step 5: Commit the authentication experience**

```bash
git add unity-client/Assets/WordQuest/Resources/UI/Screens/Login.uxml unity-client/Assets/WordQuest/Resources/UI/Styles/App.uss unity-client/Assets/WordQuest/Runtime/Presentation/Screens/LoginScreen.cs unity-client/Assets/WordQuest/Runtime/Presentation/WordQuestApp.cs unity-client/Assets/WordQuest/Tests/EditMode/LoginScreenTests.cs
git commit -m "feat: clarify Unity authentication entry"
```

### Task 3: Single-Task Home Information Hierarchy

**Files:**
- Modify: `unity-client/Assets/WordQuest/Resources/UI/Screens/Home.uxml`
- Modify: `unity-client/Assets/WordQuest/Resources/UI/Styles/App.uss`
- Modify: `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/HomeScreen.cs`
- Modify: `unity-client/Assets/WordQuest/Tests/EditMode/HomeScreenTests.cs`

**Interfaces:**
- Produces: `recommended-reason-label` and primary copy `开始今日冒险`.
- Preserves: every existing `.feature-button` and `ScreenId` destination.
- Consumes: existing `LearningJourneyPlan`, daily statistics and reward service; no new service calls.

- [ ] **Step 1: Add failing hierarchy tests**

```csharp
[Test]
public void Recommended_level_is_presented_as_the_only_primary_task()
{
    var view = CreateView();
    _ = new HomeScreen(view, SignedInContext(), null,
        journey: LearningJourneyPlanner.Create(CreateCatalog(), CompleteStatus()));
    Assert.That(view.Q<Button>("continue-learning-button").text,
        Is.EqualTo("开始今日冒险"));
    Assert.That(view.Q<Label>("recommended-reason-label").text,
        Does.Contain("推荐"));
    Assert.That(view.Query<Button>(className: "primary-button").ToList(),
        Has.Count.EqualTo(1));
}

[Test]
public void Learning_proof_entries_are_visible_without_removing_other_tools()
{
    var view = CreateView();
    Assert.That(FindFeature(view, ScreenId.Review), Is.Not.Null);
    Assert.That(FindFeature(view, ScreenId.Reports), Is.Not.Null);
    Assert.That(FindFeature(view, ScreenId.AiTutor), Is.Not.Null);
    Assert.That(FindFeature(view, ScreenId.Profile), Is.Not.Null);
}
```

- [ ] **Step 2: Run EditMode and confirm RED**

Run: `bash unity-client/Tools/run-unity-tests.sh EditMode`

Expected: FAIL because the reason label and final primary copy are absent.

- [ ] **Step 3: Recompose Home with existing data**

Keep the recommended level and daily progress in the first panel. Place Review, Reports and AiTutor in a `learning-proof-grid`; place LevelSelect, DailyChallenge, Endless, Vocabulary, Social and Profile inside a visible `Foldout` named `more-features-foldout`. Render the recommendation as:

```csharp
reason.text = updatedJourney.HasReliableProgress
    ? "根据当前关卡进度推荐，从这里继续最顺畅"
    : "推荐从安全起点开始，进度恢复后会自动更新";
button.text = "开始今日冒险";
```

When no recommendation exists, keep the existing honest fallback to Level Select and set the primary copy to `打开关卡地图`.

- [ ] **Step 4: Verify Home behavior and routing**

Run: `bash unity-client/Tools/run-unity-tests.sh EditMode`

Expected: PASS with zero failures, including all existing destination reachability checks.

Run: `bash unity-client/Tools/validate-project.sh`

Expected: `Unity project validation PASS`.

- [ ] **Step 5: Commit the Home hierarchy**

```bash
git add unity-client/Assets/WordQuest/Resources/UI/Screens/Home.uxml unity-client/Assets/WordQuest/Resources/UI/Styles/App.uss unity-client/Assets/WordQuest/Runtime/Presentation/Screens/HomeScreen.cs unity-client/Assets/WordQuest/Tests/EditMode/HomeScreenTests.cs
git commit -m "feat: focus Unity home on the daily adventure"
```

### Task 4: First-Run Tutorial, HUD Groups, and Pause Replay

**Files:**
- Modify: `unity-client/Assets/WordQuest/Runtime/Gameplay/TutorialController.cs`
- Create: `unity-client/Assets/WordQuest/Tests/EditMode/TutorialControllerTests.cs`
- Create: `unity-client/Assets/WordQuest/Tests/EditMode/TutorialControllerTests.cs.meta`
- Modify: `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/TutorialOverlay.cs`
- Modify: `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/PauseOverlay.cs`
- Modify: `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/HudScreen.cs`
- Modify: `unity-client/Assets/WordQuest/Runtime/Presentation/WordQuestApp.cs:520-625`
- Modify: `unity-client/Assets/WordQuest/Resources/UI/Screens/Game.uxml`
- Modify: `unity-client/Assets/WordQuest/Resources/UI/Styles/App.uss`

**Interfaces:**
- Produces: `TutorialController.RestartForCurrentSession()`; it resets `Step` to `Move` and raises `StepChanged`, but does not delete the persisted completion flag.
- Produces: `PauseOverlay(..., Action replayTutorial, ...)` callback from `tutorial-replay-button`.
- Preserves: movement/interaction/answer observation and `wordquest:skipIntro` backward compatibility.

- [ ] **Step 1: Add failing tutorial state tests**

```csharp
[Test]
public void Missing_or_invalid_preference_runs_the_tutorial()
{
    Assert.That(new TutorialController(new MemoryStore()).ShouldRun, Is.True);
    var invalid = new MemoryStore();
    invalid.SetString("wordquest:skipIntro", "damaged");
    Assert.That(new TutorialController(invalid).ShouldRun, Is.True);
}

[Test]
public void Replay_restarts_only_the_current_session()
{
    var store = new MemoryStore();
    store.SetString("wordquest:skipIntro", "true");
    var controller = new TutorialController(store);
    controller.RestartForCurrentSession();
    Assert.That(controller.Step, Is.EqualTo(TutorialStep.Move));
    Assert.That(store.GetString("wordquest:skipIntro"), Is.EqualTo("true"));
}

[Test]
public void Completing_all_three_steps_persists_completion()
{
    var store = new MemoryStore();
    var controller = new TutorialController(store);
    controller.MovementObserved();
    controller.InteractionObserved();
    controller.AnswerObserved();
    Assert.That(controller.Step, Is.EqualTo(TutorialStep.Complete));
    Assert.That(store.GetString("wordquest:skipIntro"), Is.EqualTo("true"));
}
```

Add this exact in-memory store to `TutorialControllerTests`:

```csharp
private sealed class MemoryStore : IKeyValueStore
{
    private readonly Dictionary<string, string> values = new();
    public bool HasKey(string key) => values.ContainsKey(key);
    public string GetString(string key, string fallback = "") =>
        values.TryGetValue(key, out var value) ? value : fallback;
    public void SetString(string key, string value) =>
        values[key] = value ?? string.Empty;
    public void DeleteKey(string key) => values.Remove(key);
    public void Save() { }
}
```

- [ ] **Step 2: Run EditMode and confirm RED**

Run: `bash unity-client/Tools/run-unity-tests.sh EditMode`

Expected: FAIL because invalid data is currently treated as skipped incorrectly or replay is missing.

- [ ] **Step 3: Implement tutorial replay and grouped Game UI**

Always create `TutorialController` when a level starts. Only show the overlay automatically when `ShouldRun` is true, but retain the controller so Pause can call `RestartForCurrentSession()`. Do not restrict first-run guidance to `LevelDefinition.IsTutorial`.

In `Game.uxml`, group the HUD into `hud-vitals`, `hud-objective`, and `hud-actions`; make the progress title render as `任务进度 {answered}/{total}`. Add `tutorial-step-label` with `步骤 1/3`, and add `tutorial-replay-button` between mute and home. Style logout as a danger/ghost action while keeping Resume as the only primary button.

- [ ] **Step 4: Verify tutorial, HUD and pause behavior**

Run: `bash unity-client/Tools/run-unity-tests.sh EditMode`

Expected: PASS with zero failures.

Run: `bash unity-client/Tools/validate-project.sh`

Expected: `Unity project validation PASS`.

- [ ] **Step 5: Commit the first-run guidance**

```bash
git add unity-client/Assets/WordQuest/Runtime/Gameplay/TutorialController.cs unity-client/Assets/WordQuest/Tests/EditMode/TutorialControllerTests.cs unity-client/Assets/WordQuest/Tests/EditMode/TutorialControllerTests.cs.meta unity-client/Assets/WordQuest/Runtime/Presentation/Screens/TutorialOverlay.cs unity-client/Assets/WordQuest/Runtime/Presentation/Screens/PauseOverlay.cs unity-client/Assets/WordQuest/Runtime/Presentation/Screens/HudScreen.cs unity-client/Assets/WordQuest/Runtime/Presentation/WordQuestApp.cs unity-client/Assets/WordQuest/Resources/UI/Screens/Game.uxml unity-client/Assets/WordQuest/Resources/UI/Styles/App.uss
git commit -m "feat: guide first-time Unity gameplay"
```

### Task 5: Quiz Keyboard, Timer, and Submission Guard

**Files:**
- Modify: `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/QuizOverlay.cs`
- Create: `unity-client/Assets/WordQuest/Tests/EditMode/QuizOverlayTests.cs`
- Create: `unity-client/Assets/WordQuest/Tests/EditMode/QuizOverlayTests.cs.meta`
- Modify: `unity-client/Assets/WordQuest/Resources/UI/Screens/Game.uxml`
- Modify: `unity-client/Assets/WordQuest/Resources/UI/Styles/App.uss`

**Interfaces:**
- Produces: `QuizOverlay : IDisposable`; disposal unregisters the root key callback and pauses the timer schedule.
- Produces: `QuizOverlay.OptionIndexFor(KeyCode keyCode) -> int`, returning `0..3` for number-row/keypad 1–4 and `-1` otherwise.
- Produces: numbered answer buttons named `quiz-option-1` through `quiz-option-4`.
- Produces: `timer-warning` class at 10 seconds or less and `quiz-submitted` class after the first submission.
- Preserves: `Submitted` emits exactly one `QuizAnswer` for mouse, keyboard or timeout.

- [ ] **Step 1: Add failing interaction tests**

```csharp
[Test]
public void Choice_buttons_have_keyboard_numbers_and_stable_names()
{
    var root = CreateQuizRoot();
    using var overlay = new QuizOverlay(root);
    overlay.Show(CreateChoiceQuestion(), 30000);
    Assert.That(root.Q<Button>("quiz-option-1").text, Does.StartWith("1  "));
    Assert.That(root.Q<Button>("quiz-option-4").text, Does.StartWith("4  "));
}

[Test]
public void Number_keys_map_to_the_expected_option_indices()
{
    Assert.That(QuizOverlay.OptionIndexFor(KeyCode.Alpha1), Is.EqualTo(0));
    Assert.That(QuizOverlay.OptionIndexFor(KeyCode.Keypad2), Is.EqualTo(1));
    Assert.That(QuizOverlay.OptionIndexFor(KeyCode.Alpha4), Is.EqualTo(3));
    Assert.That(QuizOverlay.OptionIndexFor(KeyCode.Escape), Is.EqualTo(-1));
}

[Test]
public void Warning_state_uses_text_and_style_together()
{
    Assert.That(QuizOverlay.IsWarningTime(10000), Is.True);
    Assert.That(QuizOverlay.IsWarningTime(10001), Is.False);
}
```

Define the test fixtures in the same file:

```csharp
private static VisualElement CreateQuizRoot()
{
    var asset = Resources.Load<VisualTreeAsset>("UI/Screens/Game");
    Assert.That(asset, Is.Not.Null);
    return asset.CloneTree().Q<VisualElement>("quiz-overlay");
}

private static QuizQuestion CreateChoiceQuestion()
{
    return new QuizQuestion(
        "school-id",
        QuestionType.ChoiceEnglishToChinese,
        "school",
        "学校",
        new[] {
            new QuizOption("1", "校园"),
            new QuizOption("2", "学校"),
            new QuizOption("3", "学生"),
            new QuizOption("4", "学习")
        });
}
```

- [ ] **Step 2: Run EditMode and confirm RED**

Run: `bash unity-client/Tools/run-unity-tests.sh EditMode`

Expected: FAIL because numbered controls, key handling and warning policy are absent.

- [ ] **Step 3: Implement keyboard selection and visible states**

Register one `KeyDownEvent` callback in the constructor. Map `Alpha1`/`Keypad1` through `Alpha4`/`Keypad4` to zero-based option indices. On submit, set `submitted = true`, add `quiz-submitted`, disable every option and the text submit button before raising the event. During timer updates, display both `剩余 N 秒` and the warning class when `N <= 10`.

Use explicit classes for `:hover`, `:focus`, `.quiz-selected`, `.quiz-correct`, `.quiz-wrong`, `.timer-warning`; each correct/wrong state also carries visible text in Task 6.

- [ ] **Step 4: Verify quiz regression behavior**

Run: `bash unity-client/Tools/run-unity-tests.sh EditMode`

Expected: PASS with zero failures, including one-event submission guard.

Run: `bash unity-client/Tools/validate-project.sh`

Expected: `Unity project validation PASS`.

- [ ] **Step 5: Commit quiz interaction improvements**

```bash
git add unity-client/Assets/WordQuest/Runtime/Presentation/Screens/QuizOverlay.cs unity-client/Assets/WordQuest/Tests/EditMode/QuizOverlayTests.cs unity-client/Assets/WordQuest/Tests/EditMode/QuizOverlayTests.cs.meta unity-client/Assets/WordQuest/Resources/UI/Screens/Game.uxml unity-client/Assets/WordQuest/Resources/UI/Styles/App.uss
git commit -m "feat: strengthen Unity quiz interaction states"
```

### Task 6: Truthful Answer Feedback and Learning Result Evidence

**Files:**
- Modify: `unity-client/Assets/WordQuest/Runtime/Gameplay/GameFlowController.cs`
- Modify: `unity-client/Assets/WordQuest/Domain/Game/GameSession.cs`
- Modify: `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/QuizOverlay.cs`
- Modify: `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/ResultScreen.cs`
- Modify: `unity-client/Assets/WordQuest/Runtime/Presentation/WordQuestApp.cs:580-690,894-988`
- Modify: `unity-client/Assets/WordQuest/Resources/UI/Screens/Game.uxml`
- Modify: `unity-client/Assets/WordQuest/Resources/UI/Screens/Result.uxml`
- Modify: `unity-client/Assets/WordQuest/Resources/UI/Styles/App.uss`
- Modify: `unity-client/Assets/WordQuest/Tests/EditMode/GameSessionTests.cs`
- Modify: `unity-client/Assets/WordQuest/Tests/EditMode/ResultScreenTests.cs`
- Modify: `unity-client/Assets/WordQuest/Tests/EditMode/QuizOverlayTests.cs`

**Interfaces:**
- Produces: immutable `AnswerFeedbackContext` with `Word`, `PlayerAnswer`, `CorrectAnswer`, `Correct`, `ServerVerified`, nullable `MasteryScore`, nullable `MasteryDelta`, and `FuzzyFeedback`.
- Constructor: `AnswerFeedbackContext(WordDto word, string playerAnswer, string correctAnswer, bool correct, bool serverVerified, float? masteryScore, float? masteryDelta, string fuzzyFeedback)`.
- Produces: `GameFlowController.AnswerFeedbackRequested` and `ContinueAfterFeedbackAsync(CancellationToken)`.
- Produces: `LevelResult.RecordLearningEvidence(int verifiedAnswers, float masteryDelta, int weakWordCount)` and read-only result properties.
- Produces: `QuizOverlay.ShowFeedback(AnswerFeedbackContext feedback, Action continueAction, Action tutorAction = null)`.
- Produces: `ResultScreen(..., Action reviewWeakWords = null)`; `result-review-button` is visible only when `WeakWordCount > 0`.
- Preserves: server answer verification remains authoritative; local fallback is labeled as local and does not claim saved mastery.

- [ ] **Step 1: Add failing domain and presentation tests**

```csharp
[Test]
public void Learning_evidence_is_separate_from_game_score()
{
    var result = CreateResult();
    result.RecordLearningEvidence(2, 7.5f, 1);
    Assert.That(result.VerifiedAnswerCount, Is.EqualTo(2));
    Assert.That(result.MasteryDelta, Is.EqualTo(7.5f));
    Assert.That(result.WeakWordCount, Is.EqualTo(1));
    Assert.That(result.Score, Is.GreaterThanOrEqualTo(0));
}

[Test]
public void Result_exposes_review_only_when_weak_words_exist()
{
    var result = CreateResult();
    result.RecordLearningEvidence(2, 4f, 1);
    var reviewCalls = 0;
    var view = CreateView();
    _ = new ResultScreen(view, result, null, null, null,
        reviewWeakWords: () => reviewCalls++);
    Assert.That(view.Q<Button>("result-review-button").resolvedStyle.display,
        Is.EqualTo(DisplayStyle.Flex));
    Submit(view.Q<Button>("result-review-button"));
    Assert.That(reviewCalls, Is.EqualTo(1));
}

[Test]
public void Unverified_feedback_never_claims_mastery_was_saved()
{
    var root = CreateQuizRoot();
    using var overlay = new QuizOverlay(root);
    overlay.ShowFeedback(
        new AnswerFeedbackContext(
            null, "你好", "你好", true, false,
            null, null, string.Empty),
        null);
    Assert.That(root.Q<Label>("feedback-mastery-label").text,
        Does.Contain("以服务器同步结果为准"));
}
```

- [ ] **Step 2: Run EditMode and confirm RED**

Run: `bash unity-client/Tools/run-unity-tests.sh EditMode`

Expected: FAIL because the feedback evidence model and result fields do not exist.

- [ ] **Step 3: Map only verified learning evidence**

Build the context from `QuizRecordResultDto` only when `record.IsSuccess`, `record.Data != null`, and `record.Data.serverVerified` are true:

```csharp
var feedback = new AnswerFeedbackContext(
    word,
    answer.Value,
    correctAnswer,
    correct,
    hasServerRecord && record.Data.serverVerified,
    hasServerRecord ? record.Data.mastery?.masteryScore : null,
    hasServerRecord ? record.Data.masteryDelta : null,
    hasServerRecord ? record.Data.fuzzyFeedback : string.Empty);
```

Accumulate verified count and mastery delta in `GameFlowController`; use `session.Snapshot.WrongCount` as the honest weak-word count. Before raising `Finished`, call `result.RecordLearningEvidence(...)`. Do not alter `ScoringPolicy`, life loss, encounter resolution or settlement rules.

- [ ] **Step 4: Show feedback before continuation or final settlement**

After every evaluated answer, freeze input and raise `AnswerFeedbackRequested`. Store whether the next action is resume or finish. `ContinueAfterFeedbackAsync` performs the stored action exactly once. For wrong answers, expose `问 AI 学习导师` as a secondary action; closing the tutor returns through the same continuation method.

Correct feedback displays word, phonetic when present, meaning, example, translation and verified mastery delta. Wrong feedback displays `你的答案`, `正确答案`, factual server feedback and `将进入薄弱词复习范围`; when server verification is unavailable, display `本次按本地答案继续，掌握度以服务器同步结果为准`.

- [ ] **Step 5: Recompose the result evidence card**

Render separate labels:

```csharp
gameMetrics.text =
    $"游戏表现 · {result.Score} 分 · 最大连击 {result.MaximumCombo}";
learningMetrics.text =
    $"学习质量 · 正确率 {result.CorrectRate}% · 薄弱词 {result.WeakWordCount} 个";
mastery.text = result.VerifiedAnswerCount > 0
    ? $"已验证掌握度变化 {result.MasteryDelta:+0.##;-0.##;0}"
    : "掌握度以服务器同步结果为准";
```

Keep the existing saved/pending/rejected settlement wording. Show `复习本关薄弱词` only for a non-zero weak-word count; route it to the existing Review screen, whose server session prioritizes recent mistakes. Do not claim that a new review session has already been created.

- [ ] **Step 6: Verify answer and result contracts**

Run: `bash unity-client/Tools/run-unity-tests.sh EditMode`

Expected: PASS with zero failures, including existing next-level, final-level, rejected-progress and pending-sync tests.

Run: `bash unity-client/Tools/validate-project.sh`

Expected: `Unity project validation PASS`.

- [ ] **Step 7: Commit the learning evidence loop**

```bash
git add unity-client/Assets/WordQuest/Runtime/Gameplay/GameFlowController.cs unity-client/Assets/WordQuest/Domain/Game/GameSession.cs unity-client/Assets/WordQuest/Runtime/Presentation/Screens/QuizOverlay.cs unity-client/Assets/WordQuest/Runtime/Presentation/Screens/ResultScreen.cs unity-client/Assets/WordQuest/Runtime/Presentation/WordQuestApp.cs unity-client/Assets/WordQuest/Resources/UI/Screens/Game.uxml unity-client/Assets/WordQuest/Resources/UI/Screens/Result.uxml unity-client/Assets/WordQuest/Resources/UI/Styles/App.uss unity-client/Assets/WordQuest/Tests/EditMode/GameSessionTests.cs unity-client/Assets/WordQuest/Tests/EditMode/ResultScreenTests.cs unity-client/Assets/WordQuest/Tests/EditMode/QuizOverlayTests.cs
git commit -m "feat: expose verified learning evidence in Unity"
```

### Task 7: Existing-Asset World Density Without Rule Changes

**Files:**
- Modify: `unity-client/Assets/WordQuest/Runtime/Gameplay/WorldGenerator.cs`
- Modify: `unity-client/Assets/WordQuest/Tests/PlayMode/WorldSmokeTests.cs`

**Interfaces:**
- Produces: a child `Environment Details` group containing only existing Sprout Lands sprites and no collider, rigidbody or encounter component.
- Preserves: player start, NPC start, monster count, boss count, encounter radii and deterministic generation for a fixed seed.

- [ ] **Step 1: Add failing world-composition tests**

```csharp
[UnityTest]
public IEnumerator Environment_details_add_depth_without_gameplay_components()
{
    var world = WorldGenerator.Generate(CreateLevel(),
        ChapterTheme.ForChapter(1), 42);
    var details = world.transform.Find("Environment Details");
    Assert.That(details, Is.Not.Null);
    Assert.That(details.childCount, Is.GreaterThanOrEqualTo(18));
    Assert.That(details.GetComponentsInChildren<Collider2D>(), Is.Empty);
    Assert.That(details.GetComponentsInChildren<EncounterController>(), Is.Empty);
    Object.Destroy(world);
    yield return null;
}

[UnityTest]
public IEnumerator Visual_density_does_not_change_monster_population()
{
    var world = WorldGenerator.Generate(CreateLevel(),
        ChapterTheme.ForChapter(1), 42, null,
        Difficulty.For(DifficultyKind.Normal));
    Assert.That(CountMonsters(world), Is.EqualTo(5));
    Object.Destroy(world);
    yield return null;
}
```

Define the shared level fixture in `WorldSmokeTests`:

```csharp
private static LevelDefinition CreateLevel()
{
    return new LevelDefinition(
        1,
        1,
        "Blind Review",
        5,
        "test",
        string.Empty,
        null,
        false);
}
```

- [ ] **Step 2: Run PlayMode and confirm RED**

Run: `bash unity-client/Tools/run-unity-tests.sh PlayMode`

Expected: FAIL because `Environment Details` does not exist.

- [ ] **Step 3: Add decorative detail using the existing sprite sheet**

Create a separate deterministic decoration random stream from `seed ^ 0x51A7` so visual density changes do not consume the encounter-placement stream. Use `DecorationPath` frames and negative sorting orders. Place 18–30 small details by chapter, keeping 2.5 world units clear around the player and 2 units around the guide NPC. Do not add colliders, rigidbodies, encounters or gameplay tags.

- [ ] **Step 4: Verify world invariants**

Run: `bash unity-client/Tools/run-unity-tests.sh PlayMode`

Expected: PASS with zero failures, including same-seed positions and difficulty population.

Run: `bash unity-client/Tools/validate-project.sh`

Expected: `Unity project validation PASS`.

- [ ] **Step 5: Commit the world composition**

```bash
git add unity-client/Assets/WordQuest/Runtime/Gameplay/WorldGenerator.cs unity-client/Assets/WordQuest/Tests/PlayMode/WorldSmokeTests.cs
git commit -m "feat: enrich Unity world composition"
```

### Task 8: Responsive Critical-Path Gates and Project Documentation

**Files:**
- Create: `unity-client/Assets/WordQuest/Tests/PlayMode/BlindReviewSmokeTests.cs`
- Create: `unity-client/Assets/WordQuest/Tests/PlayMode/BlindReviewSmokeTests.cs.meta`
- Modify: `unity-client/Assets/WordQuest/Tests/PlayMode/BootstrapSmokeTests.cs`
- Modify: `unity-client/Tools/validate-project.sh`
- Modify: `docs/unity/feature-parity.md`
- Create: `docs/unity/blind-review-optimization-verification.md`

**Interfaces:**
- Produces: reusable PlayMode assertion `AssertControlVisibleInside(VisualElement root, string name)`.
- Static contract adds exact control names for demo login, primary task, tutorial replay, numbered answer, feedback consequence and result review.
- Consumes: UI resources through `ScreenRouter`; no network required for layout tests.

- [ ] **Step 1: Add failing three-size PlayMode tests**

```csharp
[UnityTest]
public IEnumerator Critical_actions_remain_visible_at_supported_sizes()
{
    var uiObject = new GameObject("Blind Review Layout UI");
    var document = uiObject.AddComponent<UIDocument>();
    document.panelSettings = Resources.Load<PanelSettings>(
        "UI/WordQuestPanelSettings");
    var router = new ScreenRouter(document.rootVisualElement);
    foreach (var size in new[] {
        new Vector2Int(960, 540),
        new Vector2Int(1280, 720),
        new Vector2Int(1440, 900) })
    {
        Screen.SetResolution(size.x, size.y, false);
        yield return null;
        foreach (var item in new[] {
            (ScreenId.Login, "login-button"),
            (ScreenId.Home, "continue-learning-button"),
            (ScreenId.Game, "pause-button"),
            (ScreenId.Result, "result-primary-button") })
        {
            var view = router.Show(item.Item1);
            yield return null;
            var control = view.Q<VisualElement>(item.Item2);
            Assert.That(control, Is.Not.Null);
            Assert.That(control.resolvedStyle.width, Is.GreaterThan(0f));
            Assert.That(control.resolvedStyle.height, Is.GreaterThan(0f));
        }
    }
    Object.Destroy(uiObject);
}

[UnityTest]
public IEnumerator Quiz_and_pause_primary_controls_are_keyboard_focusable()
{
    var uiObject = new GameObject("Blind Review Focus UI");
    var document = uiObject.AddComponent<UIDocument>();
    document.panelSettings = Resources.Load<PanelSettings>(
        "UI/WordQuestPanelSettings");
    var router = new ScreenRouter(document.rootVisualElement);
    var game = router.Show(ScreenId.Game);
    Assert.That(game.Q<Button>("submit-answer-button").focusable, Is.True);
    Assert.That(game.Q<Button>("resume-button").focusable, Is.True);
    yield return null;
    Object.Destroy(uiObject);
}
```

- [ ] **Step 2: Run PlayMode and confirm RED**

Run: `bash unity-client/Tools/run-unity-tests.sh PlayMode`

Expected: FAIL until responsive styles and all named controls are present.

- [ ] **Step 3: Add static critical-control gates**

Extend `required_p1_controls` in `validate-project.sh` with:

```bash
"Login.uxml|name=\"auth-mode-toggle-button\""
"Login.uxml|name=\"local-demo-button\""
"Home.uxml|name=\"recommended-reason-label\""
"Game.uxml|name=\"tutorial-replay-button\""
"Game.uxml|name=\"feedback-mastery-label\""
"Result.uxml|name=\"result-review-button\""
```

Update `feature-parity.md` only with commands and outcomes actually observed. Create `blind-review-optimization-verification.md` with branch/commit, Unity version, the exact test/build commands, exit results, manual path, screenshot paths, and explicit Windows-visible-pass limitation if Windows hardware is unavailable.

- [ ] **Step 4: Run the complete automated test gate**

Run: `bash unity-client/Tools/validate-project.sh`

Expected: `Unity project validation PASS`.

Run: `bash unity-client/Tools/run-unity-tests.sh all`

Expected: EditMode and PlayMode XML reports contain zero failures.

- [ ] **Step 5: Commit the responsive gates and documentation shell**

```bash
git add unity-client/Assets/WordQuest/Tests/PlayMode/BlindReviewSmokeTests.cs unity-client/Assets/WordQuest/Tests/PlayMode/BlindReviewSmokeTests.cs.meta unity-client/Assets/WordQuest/Tests/PlayMode/BootstrapSmokeTests.cs unity-client/Tools/validate-project.sh docs/unity/feature-parity.md docs/unity/blind-review-optimization-verification.md
git commit -m "test: gate Unity blind review critical path"
```

### Task 9: Dual-Platform Build, Visual Blind Review, and Branch Push

**Files:**
- Modify: `docs/unity/blind-review-optimization-verification.md`
- Modify: `docs/unity/feature-parity.md`
- Create: `docs/unity/screenshots/blind-review-optimized-2026-09-05/01-login.jpg`
- Create: `docs/unity/screenshots/blind-review-optimized-2026-09-05/02-home.jpg`
- Create: `docs/unity/screenshots/blind-review-optimized-2026-09-05/03-gameplay.jpg`
- Create: `docs/unity/screenshots/blind-review-optimized-2026-09-05/04-quiz.jpg`
- Create: `docs/unity/screenshots/blind-review-optimized-2026-09-05/05-answer-feedback.jpg`
- Create: `docs/unity/screenshots/blind-review-optimized-2026-09-05/06-result.jpg`
- Create: `docs/unity/screenshots/blind-review-optimized-2026-09-05/07-pause.jpg`

**Interfaces:**
- Produces: verified Windows x86_64 and macOS Universal build artifacts under ignored `unity-client/Builds/`.
- Produces: same-path before/after evidence at 1280×720.
- Produces: remote branch `origin/codex/unity-blind-review-optimization` only.
- Rollback: keep `feat/unity-client-migration@74d7dac`; delete or stop using the new branch without affecting server data.

- [ ] **Step 1: Run fresh static, test, build and artifact verification**

Run in order:

```bash
bash unity-client/Tools/validate-project.sh
bash unity-client/Tools/run-unity-tests.sh all
bash unity-client/Tools/build-players.sh
bash unity-client/Tools/validate-build-artifacts.sh
```

Expected: all four commands exit 0; static validation prints `Unity project validation PASS`; Unity EditMode and PlayMode XML contain zero failures; artifact validation prints `Unity build artifact validation PASS`.

- [ ] **Step 2: Open the newly built macOS Player at 1280×720**

Use `unity-client/Builds/macOS/WordQuest.app`, the local API at `http://localhost:4000`, and the local test account. Confirm the window is the new build by recording the HEAD commit in the verification document before launch.

- [ ] **Step 3: Run the 5–10 minute blind-review path**

Perform: local-demo fill without auto-submit → login → identify and launch `开始今日冒险` → complete/skip the three-step tutorial → answer once with keyboard and once with mouse → inspect correct and wrong learning evidence → pause, replay guidance, resume → finish a level → inspect result metrics and weak-word action.

At 960×540, verify login and Home scroll without clipping their primary actions. At 1440×900, verify no stretched cards or unusable empty regions. Record any unverified platform-specific behavior rather than marking it passed.

- [ ] **Step 4: Capture and compare visual evidence**

Capture the seven named JPEG files at 1280×720. Compare each optimized screenshot side by side with `docs/unity/screenshots/blind-review-2026-09-04/` using the same screen/state; check cropping, padding, margins, font sizes/weights, borders, radii, focus states and state text. Fix any visible regression through the task that owns it, rerun its focused tests, then repeat the full automated gate.

- [ ] **Step 5: Finalize evidence and commit it**

Write the exact test totals, build result, smoke path result, screenshot paths and remaining limitation into both verification documents. Then run:

```bash
git diff --check
git status --short
git add docs/unity/feature-parity.md docs/unity/blind-review-optimization-verification.md docs/unity/screenshots/blind-review-optimized-2026-09-05
git commit -m "docs: verify Unity blind review optimization"
```

Expected: the commit contains only verification documents and seven JPEG screenshots; generated build/test folders remain untracked or ignored.

- [ ] **Step 6: Verify branch state before the external write**

Run:

```bash
git status --short --branch
git log --oneline --decorate feat/unity-client-migration..HEAD
git diff --check feat/unity-client-migration...HEAD
git ls-files unity-client/Library unity-client/Temp unity-client/Obj unity-client/Logs unity-client/Builds unity-client/TestResults
```

Expected: worktree is clean; the log contains only focused optimization commits; diff check is empty; generated-content query is empty.

- [ ] **Step 7: Push only the reviewed feature branch**

```bash
git push -u origin codex/unity-blind-review-optimization
```

Expected: the remote tracking branch is created. Stop after verifying `git status --short --branch` reports the local branch tracking `origin/codex/unity-blind-review-optimization`; do not create a PR, merge, or publish installers.
