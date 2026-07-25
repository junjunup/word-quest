#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "$0")/.." && pwd)"
windows_root="$project_root/Builds/Windows"
mac_app="$project_root/Builds/macOS/WordQuest.app"
mac_executable="$mac_app/Contents/MacOS/Word Quest"
mac_speech="$mac_app/Contents/Plugins/libWordQuestSpeech.dylib"
mac_plist="$mac_app/Contents/Info.plist"

fail() {
  echo "ERROR: $1" >&2
  exit 1
}

test -f "$windows_root/WordQuest.exe" ||
  fail "Missing Windows executable"
file "$windows_root/WordQuest.exe" |
  rg -q 'PE32\+ executable .* x86-64' ||
  fail "Windows executable is not x86_64"

windows_required=(
  "$windows_root/UnityPlayer.dll"
  "$windows_root/WordQuest_Data/globalgamemanagers"
  "$windows_root/WordQuest_Data/level0"
  "$windows_root/WordQuest_Data/boot.config"
  "$windows_root/WordQuest_Data/ScriptingAssemblies.json"
  "$windows_root/WordQuest_Data/Managed/WordQuest.Runtime.dll"
  "$windows_root/WordQuest_Data/Managed/WordQuest.Domain.dll"
  "$windows_root/MonoBleedingEdge/EmbedRuntime/mono-2.0-bdwgc.dll"
)
for artifact in "${windows_required[@]}"; do
  test -f "$artifact" ||
    fail "Missing Windows Player artifact: $artifact"
done
file "$windows_root/UnityPlayer.dll" |
  rg -q 'PE32\+ executable .* x86-64' ||
  fail "Windows UnityPlayer.dll is not x86_64"
file "$windows_root/MonoBleedingEdge/EmbedRuntime/mono-2.0-bdwgc.dll" |
  rg -q 'PE32\+ executable .* x86-64' ||
  fail "Windows Mono runtime is not x86_64"

test -d "$mac_app" || fail "Missing macOS app bundle"
test -f "$mac_executable" || fail "Missing macOS executable"
test -f "$mac_speech" || fail "Missing macOS speech bridge"
lipo "$mac_executable" -verify_arch x86_64 arm64 ||
  fail "macOS executable is not Universal"
lipo "$mac_speech" -verify_arch x86_64 arm64 ||
  fail "macOS speech bridge is not Universal"
plutil -lint "$mac_plist" >/dev/null ||
  fail "macOS Info.plist is invalid"

for key in \
  LSMinimumSystemVersion \
  NSMicrophoneUsageDescription \
  NSSpeechRecognitionUsageDescription; do
  /usr/libexec/PlistBuddy -c "Print :$key" "$mac_plist" >/dev/null ||
    fail "macOS Info.plist is missing $key"
done

codesign --verify --deep --strict "$mac_app" ||
  fail "macOS app signature is invalid"
entitlements="$(
  codesign -d --entitlements :- "$mac_app" 2>&1
)"
printf '%s' "$entitlements" |
  tr -d '\n' |
  rg -q \
    '<key>com\.apple\.security\.device\.audio-input</key><true/>' ||
  fail "macOS app is missing the audio-input entitlement"
codesign --verify --strict "$mac_speech" ||
  fail "macOS speech bridge signature is invalid"

bash "$project_root/Tools/smoke-macos-player.sh"

echo "Unity build artifact validation PASS"
