# Unity K12 Stage-Aware Learning Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an honest, persistent primary/junior/senior learner-stage preference and explain whether the selected Unity wordbook is K12-compatible or extension content.

**Architecture:** A pure application-layer `LearnerStageCatalog` owns stage definitions, normalization, and wordbook compatibility. `WordQuestContext` stores the normalized local preference; Home renders an immediate path summary, while Level Select edits it and annotates API wordbooks without hiding any migrated content.

**Tech Stack:** Unity 6000.5.3f1, C#/.NET Standard 2.1, UI Toolkit UXML/USS, NUnit EditMode and PlayMode tests, existing `IKeyValueStore`.

## Global Constraints

- Support Windows x86-64 and macOS Universal x86_64/arm64.
- Preserve every existing Home destination, wordbook, difficulty, and direct-start action.
- Never describe CET-4, CET-6, postgraduate, or metadata-free custom wordbooks as K12 curriculum-aligned.
- Unknown or blank learner-stage ids normalize to `junior`.
- Do not add external Unity packages or server requirements.
- Keep stale Level Select response rejection and offline fallback behavior.

---

### Task 1: Pure learner-stage catalog and optional wordbook metadata

**Files:**
- Create: `unity-client/Assets/WordQuest/Runtime/Application/LearnerStageCatalog.cs`
- Create: `unity-client/Assets/WordQuest/Runtime/Application/LearnerStageCatalog.cs.meta`
- Create: `unity-client/Assets/WordQuest/Tests/EditMode/LearnerStageCatalogTests.cs`
- Create: `unity-client/Assets/WordQuest/Tests/EditMode/LearnerStageCatalogTests.cs.meta`
- Modify: `unity-client/Assets/WordQuest/Runtime/Application/WordQuestContext.cs`
- Modify: `unity-client/Assets/WordQuest/Runtime/Infrastructure/Api/Dto/VocabularyDtos.cs`

**Interfaces:**
- Produces: `LearnerStageDefinition`, `WordbookCompatibility`, and `LearnerStageCatalog`.
- Produces: `LearnerStageCatalog.Resolve(string)`, `Normalize(string)`, `Evaluate(string, WordbookDto)`, and `DescribePath(string, string)`.
- Produces: optional `WordbookDto.stageId`, `gradeMin`, `gradeMax`, and `curriculum`.
- Produces: `UserSettings.LearnerStageId`, default `"junior"`.

- [ ] **Step 1: Write catalog and default-setting tests**

Create tests that assert:

```csharp
[TestCase(null, "junior")]
[TestCase("", "junior")]
[TestCase("UNKNOWN", "junior")]
[TestCase(" PRIMARY ", "primary")]
public void Normalize_returns_a_supported_stage(
    string input,
    string expected)
{
    Assert.That(LearnerStageCatalog.Normalize(input), Is.EqualTo(expected));
}

[Test]
public void Catalog_exposes_the_three_K12_stage_ranges()
{
    Assert.That(LearnerStageCatalog.All, Has.Count.EqualTo(3));
    Assert.That(LearnerStageCatalog.Resolve("primary").GradeRange, Is.EqualTo("1–6 年级"));
    Assert.That(LearnerStageCatalog.Resolve("junior").GradeRange, Is.EqualTo("7–9 年级"));
    Assert.That(LearnerStageCatalog.Resolve("senior").GradeRange, Is.EqualTo("10–12 年级"));
}

[Test]
public void Explicit_or_conventional_K12_wordbook_matches_the_stage()
{
    Assert.That(
        LearnerStageCatalog.Evaluate(
            "junior",
            new WordbookDto { wordbookId = "custom", stageId = "junior" })
            .IsCompatible,
        Is.True);
    Assert.That(
        LearnerStageCatalog.Evaluate(
            "senior",
            new WordbookDto { wordbookId = "k12-senior-core" })
            .IsCompatible,
        Is.True);
}

[Test]
public void Existing_exam_wordbooks_are_extension_content()
{
    var fit = LearnerStageCatalog.Evaluate(
        "junior",
        new WordbookDto { wordbookId = "cet4", name = "CET-4" });

    Assert.That(fit.IsCompatible, Is.False);
    Assert.That(fit.Label, Is.EqualTo("拓展内容"));
    Assert.That(new WordQuestContext().Settings.LearnerStageId, Is.EqualTo("junior"));
}
```

- [ ] **Step 2: Run EditMode and verify RED**

Run:

```bash
bash unity-client/Tools/run-unity-tests.sh EditMode
```

Expected: compilation or test failure because `LearnerStageCatalog` and the
new DTO/settings fields do not exist.

- [ ] **Step 3: Implement the minimal catalog**

Implement immutable definitions for `primary`, `junior`, and `senior`.
`Evaluate` must prefer explicit `WordbookDto.stageId`; only when it is blank
may it recognize `k12-<stage>` as an id prefix. Return:

```csharp
public sealed class WordbookCompatibility
{
    public WordbookCompatibility(bool isCompatible, string label) { ... }
    public bool IsCompatible { get; }
    public string Label { get; }
}
```

`DescribePath("junior", "cet4")` must return:

```text
初中 · 7–9 年级学习路径 · 当前为拓展词书
```

Add the four optional DTO fields and the `LearnerStageId` setting.

- [ ] **Step 4: Run EditMode and verify GREEN**

Run the same EditMode command and confirm every test passes.

- [ ] **Step 5: Commit**

```bash
git add unity-client/Assets/WordQuest/Runtime/Application/LearnerStageCatalog.cs \
  unity-client/Assets/WordQuest/Runtime/Application/LearnerStageCatalog.cs.meta \
  unity-client/Assets/WordQuest/Runtime/Application/WordQuestContext.cs \
  unity-client/Assets/WordQuest/Runtime/Infrastructure/Api/Dto/VocabularyDtos.cs \
  unity-client/Assets/WordQuest/Tests/EditMode/LearnerStageCatalogTests.cs \
  unity-client/Assets/WordQuest/Tests/EditMode/LearnerStageCatalogTests.cs.meta
git commit -m "feat: model Unity K12 learner stages"
```

### Task 2: Home path disclosure

**Files:**
- Modify: `unity-client/Assets/WordQuest/Resources/UI/Screens/Home.uxml`
- Modify: `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/HomeScreen.cs`
- Modify: `unity-client/Assets/WordQuest/Tests/EditMode/HomeScreenTests.cs`

**Interfaces:**
- Consumes: `LearnerStageCatalog.DescribePath(string stageId, string wordbookId)`.
- Produces: `Label learning-stage-label` in the Home primary-task card.

- [ ] **Step 1: Write a failing Home rendering test**

```csharp
[Test]
public void Home_discloses_stage_and_extension_content()
{
    var context = SignedInContext();
    context.Settings.LearnerStageId = "primary";
    context.Settings.WordbookId = "cet4";
    var view = CreateView();

    _ = new HomeScreen(
        view,
        context,
        null,
        journey: LearningJourneyPlanner.Create(CreateCatalog(), null));

    Assert.That(
        view.Q<Label>("learning-stage-label").text,
        Is.EqualTo("小学 · 1–6 年级学习路径 · 当前为拓展词书"));
}
```

- [ ] **Step 2: Run EditMode and verify RED**

Expected: null-reference failure because `learning-stage-label` is absent.

- [ ] **Step 3: Add and render the Home label**

Place `learning-stage-label` below the `今日主任务` eyebrow and render it from
the context before `RenderJourney`. Give it the existing `helper-text` class so
it remains compact at 1280×720.

- [ ] **Step 4: Run EditMode and verify GREEN**

- [ ] **Step 5: Commit**

```bash
git add unity-client/Assets/WordQuest/Resources/UI/Screens/Home.uxml \
  unity-client/Assets/WordQuest/Runtime/Presentation/Screens/HomeScreen.cs \
  unity-client/Assets/WordQuest/Tests/EditMode/HomeScreenTests.cs
git commit -m "feat: disclose Unity learner stage on Home"
```

### Task 3: Stage-aware Level Select

**Files:**
- Modify: `unity-client/Assets/WordQuest/Resources/UI/Screens/LevelSelect.uxml`
- Modify: `unity-client/Assets/WordQuest/Resources/UI/Styles/App.uss`
- Modify: `unity-client/Assets/WordQuest/Runtime/Presentation/Screens/LevelSelectScreen.cs`
- Modify: `unity-client/Assets/WordQuest/Tests/EditMode/LevelSelectScreenTests.cs`

**Interfaces:**
- Extends the `LevelSelectScreen` constructor with trailing optional arguments:
  `string currentStageId = "junior"` and
  `Action<string> stageChanged = null`.
- Produces: `DropdownField learner-stage-field`.
- Produces: `Label content-fit-label`.

- [ ] **Step 1: Write failing stage-control tests**

Construct a Level Select view with a CET wordbook and assert:

```csharp
string selectedStage = null;
_ = new LevelSelectScreen(
    view,
    catalog,
    null,
    wordbooks: new[]
    {
        new WordbookDto
        {
            wordbookId = "cet4",
            name = "CET-4",
            total = 4500
        }
    },
    currentWordbookId: "cet4",
    journey: LearningJourneyPlanner.Create(catalog, null),
    currentStageId: "primary",
    stageChanged: value => selectedStage = value);

Assert.That(view.Q<DropdownField>("learner-stage-field").value, Is.EqualTo("小学"));
Assert.That(view.Q<Label>("content-fit-label").text, Does.Contain("拓展内容"));
Assert.That(view.Q<DropdownField>("wordbook-field").choices[0], Does.Contain("拓展内容"));
```

Use `ChangeEvent<string>.GetPooled("小学", "高中")` and
`stage.SendEvent(change)` to verify the callback emits `"senior"`.

Add a second test where `stageId = "primary"` and verify both the selected
wordbook choice and status label contain `适合当前学段`.

- [ ] **Step 2: Run EditMode and verify RED**

Expected: constructor or missing-control failures.

- [ ] **Step 3: Implement stage controls and annotations**

Add the stage dropdown before wordbook. Its choices are `小学`, `初中`, and
`高中`. Resolve display values through `LearnerStageCatalog`, not string
conditionals in the screen.

Annotate each wordbook choice as:

```text
<server name> · <word count> 词 · 适合当前学段
<server name> · <word count> 词 · 拓展内容
```

The fit label for extension content must say:

```text
当前词书属于拓展内容，可继续学习，但不代表 K12 课程标准匹配。
```

Allow `.filter-row` to wrap and reduce child minimum width to 190 px so three
dropdowns fit without clipping.

- [ ] **Step 4: Run EditMode and verify GREEN**

- [ ] **Step 5: Commit**

```bash
git add unity-client/Assets/WordQuest/Resources/UI/Screens/LevelSelect.uxml \
  unity-client/Assets/WordQuest/Resources/UI/Styles/App.uss \
  unity-client/Assets/WordQuest/Runtime/Presentation/Screens/LevelSelectScreen.cs \
  unity-client/Assets/WordQuest/Tests/EditMode/LevelSelectScreenTests.cs
git commit -m "feat: add stage-aware Unity level selection"
```

### Task 4: Persistence and app wiring

**Files:**
- Modify: `unity-client/Assets/WordQuest/Runtime/Presentation/WordQuestApp.cs`
- Modify: `unity-client/Assets/WordQuest/Tests/EditMode/WordQuestAppTests.cs`

**Interfaces:**
- Consumes: `LearnerStageCatalog.Normalize(string)`.
- Produces: private `SelectLearnerStage(string stageId)`.
- Persists: `wordquest:learner-stage`.

- [ ] **Step 1: Write failing structural persistence tests**

Reflect `SelectLearnerStage` and assert it exists. Add a pure private static
helper `NormalizeLearnerStage(string)` and assert through reflection:

```csharp
Assert.That(normalize.Invoke(null, new object[] { "senior" }), Is.EqualTo("senior"));
Assert.That(normalize.Invoke(null, new object[] { "legacy" }), Is.EqualTo("junior"));
```

Keep the test behavior-focused: the production change that makes it fail is
removing normalization from app persistence.

- [ ] **Step 2: Run EditMode and verify RED**

- [ ] **Step 3: Wire load, render, and save**

In `ComposeServices`, read `wordquest:learner-stage`, normalize it, and assign
`Context.Settings.LearnerStageId`.

Pass stage id and callback into `RenderLevelSelect`. The callback must:

1. call `SelectLearnerStage`;
2. discard the old view by starting `_ = ShowLevelSelect()`.

`SelectLearnerStage` writes the normalized id, saves preferences, and calls
`Context.NotifySettingsChanged()`.

- [ ] **Step 4: Run EditMode and verify GREEN**

- [ ] **Step 5: Commit**

```bash
git add unity-client/Assets/WordQuest/Runtime/Presentation/WordQuestApp.cs \
  unity-client/Assets/WordQuest/Tests/EditMode/WordQuestAppTests.cs
git commit -m "feat: persist Unity K12 learner stage"
```

### Task 5: Runtime contract and final evidence

**Files:**
- Modify: `unity-client/Assets/WordQuest/Tests/PlayMode/BootstrapSmokeTests.cs`
- Modify: `unity-client/Tools/validate-project.sh`
- Modify: `docs/unity/feature-parity.md`
- Create: `docs/unity/p2-k12-stage-path-verification.md`

**Interfaces:**
- Consumes all earlier stage controls and persistence.
- Produces automated runtime and artifact evidence.

- [ ] **Step 1: Add the PlayMode contract**

Extend `Learning_loop_primary_controls_are_rendered_and_focusable` with
`(ScreenId.LevelSelect, "learner-stage-field")`. After displaying Level Select,
also assert `content-fit-label` has non-zero width and height at 1280×720.

- [ ] **Step 2: Run PlayMode and verify RED if the control is removed**

Temporarily verify the new assertion fails against a view without the stage
field, then restore the UXML implementation and rerun PlayMode green.

- [ ] **Step 3: Extend static validation**

Add required P2 files and controls:

```text
Assets/WordQuest/Runtime/Application/LearnerStageCatalog.cs
Assets/WordQuest/Tests/EditMode/LearnerStageCatalogTests.cs
Home.uxml|name="learning-stage-label"
LevelSelect.uxml|name="learner-stage-field"
LevelSelect.uxml|name="content-fit-label"
```

- [ ] **Step 4: Run complete verification**

Run each command separately and confirm exit code 0:

```bash
bash unity-client/Tools/validate-project.sh
bash unity-client/Tools/run-unity-tests.sh all
bash unity-client/Tools/build-players.sh
bash unity-client/Tools/validate-build-artifacts.sh
```

Restore only known Unity-generated `.meta` and `ProjectSettings.asset`
formatting churn after inspecting it.

- [ ] **Step 5: Write verification evidence**

Record exact EditMode/PlayMode counts, static validation, Windows PE32+
x86-64, macOS Universal architectures, smoke-test result, compatibility copy,
and the explicit “not curriculum alignment” limitation.

- [ ] **Step 6: Commit**

```bash
git add unity-client/Assets/WordQuest/Tests/PlayMode/BootstrapSmokeTests.cs \
  unity-client/Tools/validate-project.sh \
  docs/unity/feature-parity.md \
  docs/unity/p2-k12-stage-path-verification.md
git commit -m "test: verify Unity K12 stage-aware paths"
```

- [ ] **Step 7: Request independent review**

Ask a reviewer to inspect the full P2 diff for:

- false curriculum or grade-alignment claims;
- loss of existing wordbook/difficulty/navigation behavior;
- stale async view updates;
- dropdown identity/name mapping errors;
- 1280×720 clipping or keyboard accessibility regressions.

Address every Critical or Important finding with a fresh RED/GREEN test cycle,
then repeat complete verification.

## Post-review adjustment

The independent review found that Home cannot safely infer compatibility from
`wordbookId` alone because explicit API `stageId` metadata has higher
authority. The final implementation therefore uses `DescribePath(string)` and
shows a neutral Home prompt to confirm wordbook fit on Level Select. Only Level
Select, which has the full `WordbookDto`, emits compatible/extension labels.
