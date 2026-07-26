# Unity P1 learning-loop verification

Date: 2026-07-26  
Unity: `6000.5.3f1` (`c2eb47b3a2a9`)  
Branch: `feat/unity-client-migration`

## Outcome

The first learning loop is now one coherent path:

1. Home derives and explains one recommended task.
2. The primary action starts that level directly.
3. Level Select exposes completed, locked, and recommended states.
4. The game renders its real 2D world above the camera instead of hiding it
   behind the UI shell.
5. Result uses settlement truth to choose next level, retry, or level map.

All legacy feature destinations remain reachable from Home or the persistent
navigation.

## Automated evidence

The following commands passed from the repository root:

```bash
bash unity-client/Tools/validate-project.sh
bash unity-client/Tools/run-unity-tests.sh all
bash unity-client/Tools/build-players.sh
bash unity-client/Tools/validate-build-artifacts.sh
```

Results:

- Static project and C# structure validation: passed.
- EditMode: 134/134 passed.
- PlayMode: 7/7 passed.
- Windows: `unity-client/Builds/Windows/WordQuest.exe` is PE32+ x86-64.
- macOS: `unity-client/Builds/macOS/WordQuest.app` contains an x86_64/arm64
  Universal executable.
- macOS deterministic Player smoke test and artifact validation: passed.

The PlayMode suite checks the three primary learning-loop controls at a
1280×720 render surface and prevents the app shell from becoming opaque over
the gameplay camera again.

## Visible macOS run

A local seeded API account was used without production or staging data. The
Player surface was resized to 1280×720 and the following path passed:

- stored-session Home restoration;
- recommendation for chapter 1, level 1;
- direct level start;
- visible character, terrain, decoration, NPC, and monsters;
- WASD movement and collision-triggered questions;
- ten correct English-Chinese and Chinese-English choices;
- saved two-star completion with 10 correct, 0 wrong;
- achievement toast and `进入下一关` as the primary result action;
- no clipping on Home, Level Select, gameplay HUD, quiz, or Result.

The captured JPEG files are half-resolution logical macOS screenshots because
the Retina Player surface is rendered at 2× backing resolution:

- `docs/unity/screenshots/p1-home-1280x720.jpg`
- `docs/unity/screenshots/p1-level-select-1280x720.jpg`
- `docs/unity/screenshots/p1-game-world-1280x720.jpg`
- `docs/unity/screenshots/p1-result-1280x720.jpg`
- `docs/unity/screenshots/p1-home-1440x900.jpg`

During the visible pass, the music was muted at the user's request. The current
audio service intentionally couples music and sound-effect mute; separate
sliders remain a later UX improvement.

## Defect found by visible verification

The first rebuilt Player exposed a blank gameplay world even though world and
camera smoke tests passed. Root-cause tracing showed that `.app-root` painted
an opaque forest background over the camera while the Game view itself was
transparent.

The router now adds a game-only class and the app shell becomes transparent
only on `ScreenId.Game`. A new PlayMode test failed with alpha 1 before the
fix and passes with alpha 0 after it.

## Remaining K12 product gaps

This phase improves the interaction model, not curriculum validity. Before
calling the product K12-ready, it still needs:

- age/grade bands and curriculum-standard mapping;
- replacement or segmentation of the current CET vocabulary content;
- educator and guardian workflows, assignments, and progress controls;
- child privacy, consent, retention, and classroom deployment review;
- reading-level, localization, accessibility, and assistive-technology audits;
- Windows visible UI/gamepad testing and a shared staging-account pass;
- wrong-answer revival, failed-result, offline-result, and final-level manual
  paths.
