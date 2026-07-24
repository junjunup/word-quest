# Unity build and release

## Local release candidate

Use Unity `6000.5.3f1`; other editor versions are rejected.

```bash
export UNITY_EDITOR_BIN="/Applications/Unity/Hub/Editor/6000.5.3f1/Unity.app/Contents/MacOS/Unity"
bash unity-client/Tools/run-unity-tests.sh
bash unity-client/Tools/build-players.sh
```

Outputs:

- `unity-client/Builds/Windows/WordQuest.exe`
- `unity-client/Builds/macOS/WordQuest.app`
- `unity-client/TestResults/EditMode.xml`
- `unity-client/TestResults/PlayMode.xml`

The macOS artifact must be codesigned/notarized and the Windows artifact must be
signed in the distribution environment; signing credentials are intentionally
not stored in this repository.

## Release gate

1. Static project and API contract validators pass.
2. EditMode and PlayMode suites pass in `6000.5.3f1`.
3. Both Players build without compiler or strict build errors.
4. Manual parity rows in `feature-parity.md` are changed from
   `implemented-unverified` to `verified` only after desktop validation.
5. Login, one normal level, a Boss level, settlement retry, review, daily
   challenge, report export, social PK, pronunciation, and AI SSE are smoke
   tested against a staging server.

The current CI intentionally runs Unity-independent validation only. Add a
licensed Unity runner after the repository has Unity license secrets; do not
make the existing web/server CI depend on those secrets.
