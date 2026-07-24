# Word Quest repository guidance

## Unity migration boundary

- Put all new desktop-client code under `unity-client/`.
- Treat `client/` as the behavior and visual-parity oracle. Do not edit it during
  the migration unless a task explicitly changes the legacy client.
- Reuse the existing `server/` and `llm-service/` contracts. Any server contract
  change must remain backward compatible with the web client.
- Never commit Unity-generated `Library/`, `Temp/`, `Obj/`, `Logs/`, `Builds/`,
  `TestResults/`, IDE project files, or local user settings.

## Architecture

- Keep `Assets/WordQuest/Domain` engine-independent. It may not reference
  `UnityEngine`.
- Put use cases and state transitions in `Runtime/Application`.
- Put HTTP, SSE, local persistence, and platform adapters in
  `Runtime/Infrastructure`.
- Use UI Toolkit for menus, forms, HUDs, dialogs, reports, and social screens.
- Put real-time world interaction in `Runtime/Gameplay`.
- Keep mutable game-session state authoritative in the domain session; views
  render snapshots and dispatch actions.

## Implementation and verification

- Add or update tests before implementation for domain rules and bug fixes.
- Run `bash unity-client/Tools/validate-project.sh` after Unity-side changes.
- When Unity 6000.5.3f1 is available, run
  `bash unity-client/Tools/run-unity-tests.sh`.
- Do not describe Unity compilation, Unity tests, or desktop Player builds as
  passing unless those exact commands ran successfully with Unity 6000.5.3f1.
- Use `docs/unity/feature-parity.md` to record all legacy feature mappings and
  their static, EditMode, PlayMode, and manual verification status.
- Never log access tokens, refresh tokens, passwords, raw microphone data, or
  complete AI tutor conversation payloads.
