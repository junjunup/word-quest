# Unity desktop client development

The desktop client lives in `unity-client/` and targets Unity `6000.5.3f1`.
The first release targets Windows x86_64 and macOS Universal. The existing
Vue/Phaser client remains the behavior oracle while the Unity build is being
verified.

## Open the project

1. Install Unity Hub and Unity Editor `6000.5.3f1`.
2. Add the repository's `unity-client` directory as a project.
3. Let Unity import the committed Sprout Lands and audio resources.
   The first import creates Unity `.meta` files for assets copied from the
   legacy web client; commit those generated metadata files after the first
   editor validation so subsequent machines retain stable GUIDs.
4. Open `Assets/WordQuest/Scenes/Bootstrap.unity`.
5. Start the existing Express/MongoDB/FastAPI stack.
6. In PlayerPrefs, the API origin defaults to `http://localhost:4000`. Change
   `wordquest:api-origin` only when the API is hosted elsewhere.

The app is installed before scene load, constructs a runtime UI Toolkit panel,
and validates a stored token against `/api/auth/me`. The `Resources/UI`
templates are the runtime screen source.

## Architecture

- `Domain`: engine-independent score, session, quiz, and achievement rules.
- `Runtime/Application`: navigation, modes, report/social projections, AI
  orchestration, and pending settlement synchronization.
- `Runtime/Infrastructure`: REST/SSE, PlayerPrefs adapters, input, audio, and
  Windows/macOS system speech-recognition adapters.
- `Runtime/Gameplay`: deterministic world generation, encounters, game flow,
  tutorial, and three Boss behaviors.
- `Runtime/Presentation`: UI Toolkit composition and screen controllers.

Do not put mutable score/life/combo state in a screen. `GameSession` is
authoritative. Do not add fields or asynchronous semantics to an API DTO until
the matching Express route has been inspected.

## Verification

Run editor-independent checks:

```bash
bash unity-client/Tools/validate-project.sh
bash unity-client/Tools/check-api-contracts.sh
```

Run Unity tests:

```bash
UNITY_EDITOR_BIN="/path/to/Unity" bash unity-client/Tools/run-unity-tests.sh
```

Generated `Library`, `Temp`, `Obj`, `Logs`, `TestResults`, and `Builds`
directories must remain untracked.

## Desktop speech recognition

- Windows uses Unity's `DictationRecognizer`; Windows speech privacy must
  allow dictation.
- macOS builds compile the committed Objective-C++ bridge against Apple's
  Speech and AVFoundation frameworks. The build processor adds microphone and
  speech-recognition usage descriptions to `Info.plist`.
- Recognition populates transcript and confidence automatically before the
  existing `/api/pronunciation/score` request. Manual transcript entry remains
  available only as an explicit fallback.
- The macOS editor cannot load the Player dylib; validate that path in a built
  `.app`, then codesign/notarize the final bundle after all native files exist.
