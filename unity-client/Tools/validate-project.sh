#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "$0")/.." && pwd)"
repo_root="$(cd "$project_root/.." && pwd)"

fail() {
  echo "ERROR: $1" >&2
  exit 1
}

version_file="$project_root/ProjectSettings/ProjectVersion.txt"
manifest_file="$project_root/Packages/manifest.json"
scene_file="$project_root/Assets/WordQuest/Scenes/Bootstrap.unity"
panel_settings_file="$project_root/Assets/WordQuest/Resources/UI/WordQuestPanelSettings.asset"
tag_manager_file="$project_root/ProjectSettings/TagManager.asset"
domain_asmdef="$project_root/Assets/WordQuest/Domain/WordQuest.Domain.asmdef"
runtime_asmdef="$project_root/Assets/WordQuest/Runtime/WordQuest.Runtime.asmdef"
parity_file="$repo_root/docs/unity/feature-parity.md"

test -f "$version_file" || fail "Missing ProjectSettings/ProjectVersion.txt"
editor_version="$(sed -n 's/^m_EditorVersion: //p' "$version_file")"
test "$editor_version" = "6000.5.3f1" || fail "Expected Unity 6000.5.3f1, found ${editor_version:-unset}"

test -f "$manifest_file" || fail "Missing Packages/manifest.json"
test -f "$scene_file" || fail "Missing Bootstrap.unity"
test -f "$panel_settings_file" || fail "Missing WordQuestPanelSettings.asset"
rg -F 'm_ICUDataAsset: {fileID: 20204' "$panel_settings_file" >/dev/null ||
  fail "WordQuestPanelSettings.asset is missing Unity ICU data"
test -f "$domain_asmdef" || fail "Missing WordQuest.Domain.asmdef"
test -f "$runtime_asmdef" || fail "Missing WordQuest.Runtime.asmdef"
test -f "$parity_file" || fail "Missing docs/unity/feature-parity.md"
if rg -n '^  - *$' "$tag_manager_file" >/dev/null; then
  fail "TagManager has empty layer entries Unity 6 cannot parse"
fi

tracked_generated="$(
  git -C "$repo_root" ls-files 'unity-client/Library/**' 'unity-client/Temp/**' \
    'unity-client/Logs/**' 'unity-client/Obj/**' 'unity-client/Builds/**' \
    'unity-client/TestResults/**'
)"
test -z "$tracked_generated" || fail "Generated Unity content is tracked"

if rg -n 'using UnityEngine|UnityEngine\.' "$project_root/Assets/WordQuest/Domain" >/dev/null 2>&1; then
  fail "Domain assembly references UnityEngine"
fi

screens=(
  Loading
  Login
  Home
  LevelSelect
  Game
  Result
  Endless
  Review
  DailyChallenge
  Reports
  Vocabulary
  Pronunciation
  Profile
  Leaderboard
  Social
  Challenge
  Character
  AiTutor
)

for screen in "${screens[@]}"; do
  screen_file="$project_root/Assets/WordQuest/Resources/UI/Screens/$screen.uxml"
  test -f "$screen_file" ||
    fail "Missing runtime UI screen: $screen.uxml"
  python3 -c 'import sys, xml.etree.ElementTree as ET; ET.parse(sys.argv[1])' \
    "$screen_file" ||
    fail "Invalid UXML: $screen.uxml"
done

if rg -n '模拟答对|模拟答错' \
  "$project_root/Assets/WordQuest/Resources/UI/Screens" >/dev/null; then
  fail "Placeholder mode controls remain in runtime screens"
fi

required_features=(
  "Authentication and stored session"
  "Explorable 2D world"
  "Score, combo, lives, grace life"
  "Roaming Boss"
  "Turret Boss"
  "Charging Boss"
  "Endless mode"
  "Mastery review sessions"
  "Daily challenge and ranking"
  "Chapter/error/mistake/heatmap reports"
  "Pronunciation score and history"
  "Asynchronous friend PK"
  "AI tutor SSE, cancel, retry, fallback"
  "Windows x86_64 and macOS Universal builds"
)

for feature in "${required_features[@]}"; do
  rg -F "| $feature |" "$parity_file" >/dev/null ||
    fail "Missing parity row: $feature"
done

invalid_status="$(
  awk -F '|' '
    /^\|/ && $2 !~ /^[- ]+$/ && $2 !~ /Legacy feature/ {
      status=$7
      gsub(/^ +| +$/, "", status)
      if (status != "implemented-unverified" &&
          status != "verified" &&
          status != "blocked") print status
    }
  ' "$parity_file"
)"
test -z "$invalid_status" ||
  fail "Invalid or empty parity status: $invalid_status"

while IFS= read -r referenced_path; do
  test -e "$repo_root/$referenced_path" ||
    fail "Parity evidence path does not exist: $referenced_path"
done < <(
  rg -o '`unity-client/[^`]+`' "$parity_file" |
    sed 's/^`//; s/`$//' |
    sort -u
)

node "$project_root/Tools/validate-csharp-structure.mjs" \
  "$project_root/Assets/WordQuest"

for editor_source in \
  "$project_root/Assets/WordQuest/Editor/BuildCommand.cs" \
  "$project_root/Assets/WordQuest/Editor/ProjectValidator.cs"; do
  rg -F "using UnityEditor.Build;" "$editor_source" >/dev/null ||
    fail "BuildFailedException namespace missing: $editor_source"
done
rg -F "using UnityEngine.UIElements;" \
  "$project_root/Assets/WordQuest/Editor/ProjectValidator.cs" >/dev/null ||
  fail "ProjectValidator must import VisualTreeAsset's namespace"

rg -F "if (!completed)" \
  "$project_root/Assets/WordQuest/Runtime/Application/LevelSettlementController.cs" \
  >/dev/null ||
  fail "Failed levels must not be saved as completed"
rg -F "WORDQUEST_BOOTSTRAP_READY" \
  "$project_root/Assets/WordQuest/Runtime/Presentation/WordQuestApp.cs" \
  >/dev/null ||
  fail "Player smoke test is missing the deterministic bootstrap marker"
rg -F "com.apple.security.device.audio-input" \
  "$project_root/Assets/WordQuest/Editor/macOS.entitlements" \
  >/dev/null ||
  fail "macOS audio-input entitlement is missing"
rg -F "ReadAll(userId)" \
  "$project_root/Assets/WordQuest/Runtime/Application/PendingSettlementSync.cs" \
  >/dev/null ||
  fail "Pending settlements must be scoped to the signed-in user"
rg -F 'name="profile-achievement-list"' \
  "$project_root/Assets/WordQuest/Resources/UI/Screens/Profile.uxml" \
  >/dev/null ||
  fail "Profile must expose the full achievement list"
rg -F "SpeechRecognitionAdapter.Create()" \
  "$project_root/Assets/WordQuest/Runtime/Presentation/WordQuestApp.cs" \
  >/dev/null ||
  fail "Pronunciation must use the desktop speech recognizer"
test -f \
  "$project_root/Assets/WordQuest/Native/macOS/WordQuestSpeech.mm" ||
  fail "Missing macOS Speech framework bridge"

echo "Unity project validation PASS"
