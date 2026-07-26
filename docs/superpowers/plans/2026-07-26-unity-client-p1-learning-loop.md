# Unity Client P1 Learning Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the post-login Unity experience into a clear K12-friendly learning loop from a recommended task through the next level.

**Architecture:** Add a pure `LearningJourneyPlanner` that derives progress, a recommended level, and the next catalog level from existing content and level-status data. Feed that shared projection into the existing UI Toolkit Home, LevelSelect, and Result screens without changing server contracts.

**Tech Stack:** Unity 6000.5.3f1, C#, UI Toolkit/UXML/USS, NUnit EditMode and PlayMode tests.

## Global Constraints

- Keep all client changes under `unity-client/`, except design, plan, and evidence documents under `docs/`.
- Do not change the legacy `client/`, server API contracts, or `llm-service/`.
- Preserve access to every migrated feature.
- Keep `Assets/WordQuest/Domain` independent of UnityEngine.
- Add each behavior test first, run it and observe the expected failure before production changes.
- Use existing forest, parchment, and gold tokens; do not add gradients or an unrelated visual language.
- Do not claim K12 content alignment in this phase; this phase improves the K12 interaction model.
- Run static validation, EditMode, PlayMode, build both desktop targets, and verify artifacts before completion.

---

### Task 1: Derive One Shared Learning Journey

**Files:**
- Create: `unity-client/Assets/WordQuest/Runtime/Application/LearningJourneyPlanner.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Application/LearningJourneyPlanner.cs.meta`
- Create: `unity-client/Assets/WordQuest/Tests/EditMode/LearningJourneyPlannerTests.cs`
- Create: `unity-client/Assets/WordQuest/Tests/EditMode/LearningJourneyPlannerTests.cs.meta`

**Interfaces:**
- Produces: `LearningJourneyPlan` with `RecommendedLevel`, `CompletedLevels`, `TotalLevels`, and `HasReliableProgress`
- Produces: `LearningJourneyPlanner.NextLevel(ContentCatalog, LevelDefinition)`

- [ ] **Step 1: Write failing recommendation tests**

Use a two-chapter catalog fixture and literal `LevelsStatusDto` data. Assert that the planner:

- selects the first unlocked incomplete level,
- falls back to the first catalog level when status is absent,
- chooses the last unlocked level when every unlocked level is complete,
- counts only explicitly completed levels,
- moves from the final level of one chapter to the first level of the next chapter,
- returns `null` after the last catalog level.

- [ ] **Step 2: Run EditMode and verify RED**

```bash
bash unity-client/Tools/run-unity-tests.sh EditMode
```

Expected: compilation fails because `LearningJourneyPlanner` does not exist.

- [ ] **Step 3: Implement the minimal pure planner**

Use catalog order as the single ordering source. Treat missing chapters, levels, and unmatched DTO entries as unreliable data and preserve the safe first-level fallback.

- [ ] **Step 4: Run EditMode and verify GREEN**

Expected: all EditMode tests pass.

### Task 2: Make the Home Screen Task-First

**Files:**
- Create: `unity-client/Assets/WordQuest/Tests/EditMode/HomeScreenTests.cs`
- Create: `unity-client/Assets/WordQuest/Tests/EditMode/HomeScreenTests.cs.meta`
- Modify: `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/HomeScreen.cs`
- Modify: `unity-client/Assets/WordQuest/Resources/UI/Screens/Home.uxml`
- Modify: `unity-client/Assets/WordQuest/Resources/UI/Styles/App.uss`

**Interfaces:**
- Consumes: `LearningJourneyPlan`, `Action<LevelDefinition>`
- Produces: one primary direct-start action plus all existing feature destinations

- [ ] **Step 1: Write failing Home behavior tests**

Instantiate the real `Home.uxml`, pass a journey whose recommendation is chapter 1 level 2, click `continue-learning-button`, and assert the selected level is 1-2. Click representative feature buttons and assert their existing `ScreenId` destinations still fire.

Also assert that missing reliable status renders an honest progress-unavailable state instead of a fabricated completed count.

- [ ] **Step 2: Run EditMode and verify RED**

Expected: the new named controls and journey-aware constructor behavior do not exist.

- [ ] **Step 3: Implement task-first Home behavior**

Render the recommendation into named labels and bind the primary button to the current plan. Separate two key learning actions from compact tool actions while retaining every `view-data-key`.

- [ ] **Step 4: Run EditMode and verify GREEN**

Expected: all EditMode tests pass.

### Task 3: Explain Progress and Recommendation on Level Select

**Files:**
- Create: `unity-client/Assets/WordQuest/Tests/EditMode/LevelSelectScreenTests.cs`
- Create: `unity-client/Assets/WordQuest/Tests/EditMode/LevelSelectScreenTests.cs.meta`
- Modify: `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/LevelSelectScreen.cs`
- Modify: `unity-client/Assets/WordQuest/Resources/UI/Screens/LevelSelect.uxml`
- Modify: `unity-client/Assets/WordQuest/Resources/UI/Styles/App.uss`

**Interfaces:**
- Consumes: `LearningJourneyPlan`
- Produces: readable completion summary and explicit recommended/completed/locked button states

- [ ] **Step 1: Write failing level-state tests**

Load a compact catalog and real LevelSelect view. Assert:

- the summary shows a literal completed/total count when progress is reliable,
- the recommended button is enabled and contains `推荐`,
- a completed button contains `已完成` and its star count,
- a locked button is disabled and contains `完成前一关后解锁`,
- an absent status produces `学习进度暂不可用`.

- [ ] **Step 2: Run EditMode and verify RED**

Expected: summary controls and explicit state labels are absent.

- [ ] **Step 3: Implement accessible level state rendering**

Give each level button a deterministic `level-{chapter}-{level}` name, append short state lines, add the `recommended-level` class, and keep lock behavior controlled by DTO state.

- [ ] **Step 4: Run EditMode and verify GREEN**

Expected: all EditMode tests pass.

### Task 4: Make Results Lead to the Correct Next Step

**Files:**
- Create: `unity-client/Assets/WordQuest/Tests/EditMode/ResultScreenTests.cs`
- Create: `unity-client/Assets/WordQuest/Tests/EditMode/ResultScreenTests.cs.meta`
- Modify: `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/ResultScreen.cs`
- Modify: `unity-client/Assets/WordQuest/Resources/UI/Screens/Result.uxml`
- Modify: `unity-client/Assets/WordQuest/Resources/UI/Styles/App.uss`

**Interfaces:**
- Consumes: `LevelResult`, optional next-level action, level-map action
- Produces: a primary next, retry, or level-map action based on settlement truth

- [ ] **Step 1: Write failing result-action tests**

Build real `LevelResult` values through `GameSession` and `RecordSettlement`. Assert:

- completed and saved with a next level invokes the next action,
- completed and pending with a next level also invokes the next action,
- failed runs invoke replay as the primary action,
- permanently rejected progress invokes replay as the primary action,
- completed final level invokes level-map as the primary action.

Assert the result card exposes correct and wrong counts as visible learning feedback.

- [ ] **Step 2: Run EditMode and verify RED**

Expected: the single primary action and learning-feedback controls do not exist.

- [ ] **Step 3: Implement result action projection**

Use a named `result-primary-button`; keep replay as a secondary action only when next-level progression is valid; retain report and home actions.

- [ ] **Step 4: Run EditMode and verify GREEN**

Expected: all EditMode tests pass.

### Task 5: Wire the Shared Journey Through the App

**Files:**
- Modify: `unity-client/Assets/WordQuest/Runtime/Presentation/WordQuestApp.cs`
- Modify: `unity-client/Assets/WordQuest/Tests/EditMode/WordQuestAppTests.cs`

**Interfaces:**
- Consumes: existing `IGameService.GetLevelsStatusAsync`
- Produces: asynchronously refreshed Home recommendation, shared LevelSelect plan, and catalog-aware Result next action

- [ ] **Step 1: Write failing app-boundary tests**

Extract and test only deterministic boundary helpers needed for wiring: safe current-screen update eligibility and result progression eligibility. Cover stale Home responses and permanent settlement rejection.

- [ ] **Step 2: Run EditMode and verify RED**

Expected: the new helpers are absent.

- [ ] **Step 3: Implement app wiring**

Show Home immediately with the fallback plan, then request level status and update only if the same Home view is still current and the session is active. Build the LevelSelect plan from its existing status result. On Result, compute the catalog next level and pass next/level-map actions without bypassing settlement truth.

- [ ] **Step 4: Run EditMode and verify GREEN**

Expected: all EditMode tests pass.

### Task 6: Responsive, Static, and Desktop Verification

**Files:**
- Modify: `unity-client/Assets/WordQuest/Tests/PlayMode/BootstrapSmokeTests.cs`
- Modify: `unity-client/Tools/validate-project.sh`
- Modify: `docs/unity/feature-parity.md`
- Create: `docs/unity/p1-learning-loop-verification.md`

**Interfaces:**
- Consumes: completed P1 screens and behavior
- Produces: fresh automated, build, and visible-window evidence

- [ ] **Step 1: Add failing PlayMode UI smoke assertions**

Show Home, LevelSelect, and Result views through real UI Toolkit assets. At 1280×720 assert the named primary controls exist, are focusable, and have non-zero resolved dimensions after a frame.

- [ ] **Step 2: Run PlayMode and verify RED**

Expected: assertions fail before the named P1 controls exist or are wired.

- [ ] **Step 3: Extend static validation**

Require the P1 named controls and the new planner/test sources without checking exact human copy.

- [ ] **Step 4: Run complete verification**

```bash
bash unity-client/Tools/validate-project.sh
bash unity-client/Tools/run-unity-tests.sh all
bash unity-client/Tools/build-players.sh
bash unity-client/Tools/validate-build-artifacts.sh
```

- [ ] **Step 5: Verify the visible macOS UI**

Launch the rebuilt macOS Player against a usable local account or a deterministic local UI harness. Capture Home, LevelSelect, and Result at 1280×720. Verify keyboard traversal, primary-action hierarchy, no clipping, and explicit lock/recommendation text.

- [ ] **Step 6: Record only passed evidence**

Update the Home, level-select, and result parity rows. Add a P1 report containing commands, counts, artifact paths, screenshots, and remaining K12 content gaps.
