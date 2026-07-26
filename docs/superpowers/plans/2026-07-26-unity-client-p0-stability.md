# Unity Client P0 Stability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the Unity client's startup and authentication blockers so every launch has a visible state and authentication failures are recoverable.

**Architecture:** Keep the existing API services, ScreenRouter, and UI Toolkit screens. Harden the API URL boundary, add a deterministic Loading screen, convert authentication exceptions into visible UI state, and enforce password/focus behavior at runtime.

**Tech Stack:** Unity 6000.5.3f1, C#, UI Toolkit/UXML/USS, NUnit EditMode and PlayMode tests.

## Global Constraints

- Put all desktop-client changes under `unity-client/`, except migration documentation under `docs/`.
- Do not change the legacy `client/`, server contracts, or `llm-service/`.
- Keep `Assets/WordQuest/Domain` independent of UnityEngine.
- Add or update tests before every bug fix.
- Run `bash unity-client/Tools/validate-project.sh` and `bash unity-client/Tools/run-unity-tests.sh`.
- Never log access tokens, passwords, or complete AI tutor payloads.

---

### Task 1: Accept Root-Relative API Routes

**Files:**
- Modify: `unity-client/Assets/WordQuest/Tests/EditMode/ApiContractTests.cs`
- Modify: `unity-client/Assets/WordQuest/Runtime/Infrastructure/Api/ApiClient.cs`

**Interfaces:**
- Consumes: `ApiClient.CreateRequest(string method, string route, ...)`
- Produces: request URLs rooted at the configured origin for both `api/...` and `/api/...`

- [ ] **Step 1: Write the failing URL behavior tests**

Add tests that create a real `ApiClient` with an in-memory `ITokenStore`, call `CreateRequest`, and assert:

```csharp
Assert.That(request.url, Is.EqualTo("http://localhost:4000/api/auth/login"));
Assert.Throws<ArgumentException>(() =>
    client.CreateRequest("GET", "https://attacker.example/api/auth/me"));
```

- [ ] **Step 2: Run EditMode and verify RED**

Run:

```bash
bash unity-client/Tools/run-unity-tests.sh EditMode
```

Expected: root-relative route test fails with `ArgumentException`.

- [ ] **Step 3: Implement the minimal URL boundary fix**

Update `BuildUrl` so it rejects blank routes and HTTP(S) absolute URLs, then joins `baseUrl` with `route.TrimStart('/')`.

- [ ] **Step 4: Run EditMode and verify GREEN**

Run the EditMode suite again. Expected: all EditMode tests pass.

### Task 2: Make Authentication Failures Recoverable

**Files:**
- Create: `unity-client/Assets/WordQuest/Tests/EditMode/LoginScreenTests.cs`
- Create: `unity-client/Assets/WordQuest/Tests/EditMode/LoginScreenTests.cs.meta`
- Modify: `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/LoginScreen.cs`

**Interfaces:**
- Consumes: `IAuthService`, `VisualElement`
- Produces: `SubmitLoginAsync()` and `SubmitRegistrationAsync()` actions with visible failure state

- [ ] **Step 1: Write failing LoginScreen tests**

Build a real VisualElement tree with username, password, nickname, status, and two buttons. Use an `IAuthService` fake whose login task throws `InvalidOperationException`.

Assert that:

```csharp
Assert.That(password.isPasswordField, Is.True);
await screen.SubmitLoginAsync();
Assert.That(status.text, Does.Contain("暂时无法连接"));
Assert.That(login.enabledSelf, Is.True);
Assert.That(register.enabledSelf, Is.True);
```

- [ ] **Step 2: Run EditMode and verify RED**

Expected: the new public submit action is missing and an unconfigured password field is not forced into password mode.

- [ ] **Step 3: Implement minimal LoginScreen behavior**

Force `password.isPasswordField = true` in the constructor. Add `SubmitLoginAsync` and `SubmitRegistrationAsync`, keep button events as thin async delegates, catch unexpected exceptions, log only exception metadata, and set the recoverable Chinese status message.

- [ ] **Step 4: Run EditMode and verify GREEN**

Expected: all EditMode tests pass.

### Task 3: Eliminate the Blank Startup Shell

**Files:**
- Create: `unity-client/Assets/WordQuest/Resources/UI/Screens/Loading.uxml`
- Create: `unity-client/Assets/WordQuest/Resources/UI/Screens/Loading.uxml.meta`
- Modify: `unity-client/Assets/WordQuest/Runtime/Presentation/ScreenRouter.cs`
- Modify: `unity-client/Assets/WordQuest/Runtime/Presentation/WordQuestApp.cs`
- Modify: `unity-client/Assets/WordQuest/Tests/PlayMode/BootstrapSmokeTests.cs`
- Modify: `unity-client/Tools/validate-project.sh`

**Interfaces:**
- Consumes: `ScreenRouter.Show(ScreenId.Loading)`
- Produces: a non-empty main content state before session restoration completes

- [ ] **Step 1: Write the failing Bootstrap assertion**

After loading Bootstrap and yielding one frame, query `screen-content` and assert that it has one child named `loading-screen` or `login-screen`.

- [ ] **Step 2: Run PlayMode and verify RED**

Expected: content is empty while `RestoreSessionAsync` is unresolved.

- [ ] **Step 3: Add Loading and resilient session restoration**

Add `ScreenId.Loading`, create a compact parchment loading panel, show it immediately after UI construction, and catch session restoration exceptions. On a failed result or exception, show Login with a visible connection message; ignore destruction-related cancellation.

- [ ] **Step 4: Extend static validation**

Add `Loading` to the required UXML screen list in `validate-project.sh`.

- [ ] **Step 5: Run PlayMode and verify GREEN**

Expected: Bootstrap has one visible content state and no empty shell.

### Task 4: Strengthen Keyboard Focus

**Files:**
- Modify: `unity-client/Assets/WordQuest/Resources/UI/Styles/App.uss`
- Modify: `unity-client/Assets/WordQuest/Tests/PlayMode/BootstrapSmokeTests.cs`

**Interfaces:**
- Consumes: UI Toolkit `:focus` pseudo-state
- Produces: a visible gold focus border for TextInput and Button controls

- [ ] **Step 1: Add a failing resolved-style focus test**

Load the login screen in PlayMode, focus the username input, yield a frame, and assert that its focused border is at least 3 logical pixels and uses the gold design token.

- [ ] **Step 2: Run PlayMode and verify RED**

Expected: the default focused border does not satisfy the explicit focus style.

- [ ] **Step 3: Add focus selectors**

Use the existing `--gold` token for `TextField > TextInput:focus` and `Button:focus`, with a 3-pixel border. Do not introduce new colors or layout values.

- [ ] **Step 4: Run PlayMode and verify GREEN**

Expected: focus assertions and the existing PlayMode suite pass.

### Task 5: Full Verification and Evidence

**Files:**
- Modify: `docs/unity/feature-parity.md`

**Interfaces:**
- Consumes: completed P0 behavior
- Produces: fresh automated and manual verification evidence

- [ ] **Step 1: Run static validation**

```bash
bash unity-client/Tools/validate-project.sh
```

- [ ] **Step 2: Run all Unity tests**

```bash
bash unity-client/Tools/run-unity-tests.sh all
```

- [ ] **Step 3: Rebuild desktop players**

```bash
bash unity-client/Tools/build-players.sh
```

- [ ] **Step 4: Validate build artifacts**

```bash
bash unity-client/Tools/validate-build-artifacts.sh
```

- [ ] **Step 5: Manually verify the macOS Player**

Launch the rebuilt app and verify cold-start loading, login rendering, password masking, offline error recovery, and keyboard focus. Save screenshots outside the repository.

- [ ] **Step 6: Update feature parity evidence**

Record only checks that actually passed. Do not mark unrelated gameplay or K12 rows verified.
