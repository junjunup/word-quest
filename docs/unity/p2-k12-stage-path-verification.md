# Unity P2 K12 stage-path verification

Date: 2026-07-26  
Unity: `6000.5.3f1` (`c2eb47b3a2a9`)  
Branch: `feat/unity-client-migration`

## Outcome

The desktop client now has an explicit K12 learner-stage layer:

1. Learners can select 小学、初中、 or 高中 on Level Select.
2. The selected stage is persisted locally and restored on relaunch.
3. Home discloses the current grade-range learning path.
4. Wordbooks are marked `适合当前学段` only when explicit metadata or a
   conservative K12 identifier convention supports that claim.
5. Existing CET and metadata-free custom wordbooks remain available as
   `拓展内容`; the UI explicitly says they do not establish K12
   curriculum-standard alignment.

This is a product-information and navigation layer. It does not claim that the
existing CET-4/CET-6/postgraduate vocabulary data is K12 curriculum content.

## Automated evidence

The following commands passed from the repository root:

```bash
bash unity-client/Tools/validate-project.sh
bash unity-client/Tools/run-unity-tests.sh all
bash unity-client/Tools/build-players.sh
```

Results:

- Static project, C# structure, K12 source, and UI-control validation: passed.
- EditMode: 154/154 passed.
- PlayMode: 7/7 passed.
- The 1280×720 PlayMode pass verifies that the stage dropdown and content-fit
  disclosure have non-zero rendered dimensions.
- Windows: `unity-client/Builds/Windows/WordQuest.exe` is PE32+ x86-64.
- macOS: `unity-client/Builds/macOS/WordQuest.app` contains an x86_64/arm64
  Universal executable.
- macOS deterministic Player smoke test, signing, privacy keys, audio-input
  entitlement, and artifact validation: passed.

## Independent review

The review found one Important inconsistency: Home originally inferred
wordbook fit from the id while Level Select correctly gave explicit API
`stageId` metadata priority. A conflicting id/metadata pair could therefore
produce opposite labels.

Home now makes no compatibility claim without full wordbook metadata and
directs learners to Level Select for confirmation. The fix was developed with
a failing regression test and the 154/154 EditMode suite passed afterward. No
other Critical or Important findings were reported.

## Remaining K12 work

- Author or import real grade-banded wordbooks with provenance and curriculum
  metadata.
- Add educator and guardian assignment, review, and progress-control flows.
- Build review scheduling that explains why each word is due.
- Complete child privacy, consent, retention, classroom-deployment, reading
  level, localization, and assistive-technology reviews.
- Run visible stage-switch and relaunch-persistence passes on both macOS and
  Windows.
