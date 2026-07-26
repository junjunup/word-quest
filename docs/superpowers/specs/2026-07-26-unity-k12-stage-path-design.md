# Unity K12 Stage-Aware Learning Path Design

Date: 2026-07-26  
Branch: `feat/unity-client-migration`

## Outcome

The Unity client will gain a persistent K12 learner-stage setting with three
honest, curriculum-neutral choices:

- `primary`: 小学 · 1–6 年级
- `junior`: 初中 · 7–9 年级
- `senior`: 高中 · 10–12 年级

Home and Level Select will explain the active stage and whether the selected
wordbook is suitable for that stage or is only extension content. Existing
CET-4, CET-6, and postgraduate wordbooks remain usable and are never
misrepresented as K12-aligned content.

This phase builds the client foundation for future validated K12 wordbooks. It
does not claim alignment with a national, provincial, school, or publisher
curriculum.

## Approaches Considered

### 1. Client compatibility layer with optional server metadata — selected

Add a small immutable stage catalog in Unity. Extend `WordbookDto` with
optional stage and grade metadata, and infer compatibility from a conventional
`k12-<stage>` wordbook id only when metadata is absent. Existing wordbooks are
classified as extension content.

This is backward compatible, testable without server changes, and prepares the
client for later authoritative content metadata.

### 2. Server-authoritative curriculum model

Add curriculum, stage, grade, locale, and standard mappings to the database and
all wordbook APIs before touching Unity. This is the long-term source of truth,
but it is too broad for the next client optimization and depends on reviewed
curriculum content that the repository does not contain.

### 3. Ship hard-coded K12 starter wordbooks

Bundle new primary, junior, and senior JSON wordbooks immediately. This would
create visible content quickly, but unreviewed word lists and grade mappings
would falsely imply curriculum validity. It is rejected for this phase.

## Architecture

### Learner stage catalog

Create `LearnerStageCatalog` in the application layer. It owns:

- the three immutable stage definitions;
- normalization of saved or incoming stage ids;
- display names and grade ranges;
- deterministic wordbook compatibility classification.

The catalog has no Unity UI or network dependency.

### Optional wordbook metadata

Extend `WordbookDto` with optional fields:

- `stageId`
- `gradeMin`
- `gradeMax`
- `curriculum`

Old API responses deserialize with empty/default values. A wordbook is
stage-compatible when its explicit `stageId` matches the learner stage. If
metadata is absent, ids beginning with `k12-primary`, `k12-junior`, or
`k12-senior` are accepted as a compatibility convention. Everything else is
extension content.

### Persistent learner profile

Add `LearnerStageId` to `UserSettings`, defaulting to `junior`. Load it from
`wordquest:learner-stage`, normalize it through the catalog, and persist every
change through the existing key-value store.

The stage is a local learning preference, not identity or authorization data.
It therefore survives relaunch but can be changed without an account mutation.

### Home

Add a compact stage label to the primary task card:

`初中 · 7–9 年级学习路径 · 词书匹配请在关卡地图确认`

The message uses only the saved stage, so it is available before network
responses arrive. Home must not infer compatibility from an id because it does
not hold the API's authoritative wordbook metadata. Compatibility is disclosed
on Level Select after the full `WordbookDto` is available. The existing
direct-start, recommendation, progress, rewards, and feature navigation
behavior does not change.

### Level Select

Add a `学段` dropdown beside wordbook and difficulty. Selecting a stage:

1. normalizes and persists the stage;
2. rebuilds Level Select using the same session-scoped async guard;
3. preserves the current wordbook and difficulty.

Wordbook choices keep the server name and add either `适合当前学段` or
`拓展内容`. A separate status label explains that extension content is usable
but not K12 curriculum alignment.

No wordbook is hidden or disabled. This preserves migrated functionality and
lets educators import a validated custom wordbook before server metadata is
expanded.

## Error and Boundary Behavior

- Unknown, blank, or legacy stage ids normalize to `junior`.
- Missing wordbook metadata never produces a K12 compatibility claim.
- Null or empty wordbook lists keep the existing selected-wordbook fallback.
- A stale Level Select request cannot apply after navigation.
- Changing stage during a failed network refresh still renders a usable
  offline Level Select with an honest extension-content label.
- Existing saved CET selections remain selected.

## Testing

EditMode tests will verify:

- stage catalog definitions and normalization;
- explicit metadata and id-convention compatibility;
- CET wordbooks classified as extension content;
- default and persisted settings wiring;
- Home stage copy;
- Level Select dropdown, compatibility labels, and change callback;
- existing learning-loop and fallback behavior remains intact.

PlayMode will verify that the new stage control and content-fit explanation are
present and visible at 1280×720.

Final verification remains:

```bash
bash unity-client/Tools/validate-project.sh
bash unity-client/Tools/run-unity-tests.sh all
bash unity-client/Tools/build-players.sh
bash unity-client/Tools/validate-build-artifacts.sh
```

## Deferred Work

- reviewed K12 wordbook data and source licensing;
- curriculum-standard and locale mappings;
- teacher or guardian assignment rules;
- server-authoritative learner profiles;
- content filtering after compatible K12 packs exist;
- explainable review-queue parity and grade-aware adaptive difficulty.
