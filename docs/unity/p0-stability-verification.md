# Unity client P0 stability verification

Date: 2026-07-26  
Unity: 6000.5.3f1 (`c2eb47b3a2a9`)

## Outcome

The first P0 optimization pass closes the launch and authentication failures
found during the blind review:

- root-relative API routes now resolve against the configured API base URL;
- startup always renders a loading view instead of an empty application shell;
- session restoration and login transport failures recover to visible UI;
- offline authentication errors use learner-friendly Chinese copy;
- password fields are forced into masked mode at runtime;
- keyboard focus receives a persistent high-contrast gold border;
- malformed Unity 6 `TagManager.asset` empty layers no longer emit a parser
  failure.

## Automated evidence

- `bash unity-client/Tools/validate-project.sh`: pass.
- `bash unity-client/Tools/run-unity-tests.sh all`: EditMode 115/115 and
  PlayMode 5/5 pass.
- `bash unity-client/Tools/build-players.sh`: pass.
- Windows Player is PE32+ x86-64.
- macOS Player and speech bridge are Universal x86_64/arm64.
- macOS bundle signature, audio-input entitlement, privacy plist, ICU data, and
  deterministic headless bootstrap pass artifact validation.

## Visible-window evidence

The rebuilt macOS Player was launched as a real desktop window with the backend
offline. The following checks passed:

- the application transitions from the Unity splash to a populated login view;
- password input displays mask glyphs rather than the entered secret;
- focused text fields show a gold border with at least 3 resolved pixels in the
  PlayMode reference panel;
- submitting a valid-shaped test credential returns
  `暂时无法连接学习服务，请稍后重试`;
- login and registration actions return to enabled state after the failed
  request.

Independent review additionally verified that public login/register 401
responses do not trigger protected-session navigation, so server validation
messages remain attached to the visible form. Cancelled startup restoration now
abandons navigation during teardown.

## Remaining verification boundary

This pass does not claim end-to-end authentication parity. Online sign-in,
stored-session restoration against a running backend, and visible Windows
layout/input checks remain pending. All other feature rows retain their current
`implemented-unverified` status until their listed staging or device evidence
is collected.
