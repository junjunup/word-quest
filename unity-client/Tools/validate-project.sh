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
domain_asmdef="$project_root/Assets/WordQuest/Domain/WordQuest.Domain.asmdef"
runtime_asmdef="$project_root/Assets/WordQuest/Runtime/WordQuest.Runtime.asmdef"

test -f "$version_file" || fail "Missing ProjectSettings/ProjectVersion.txt"
editor_version="$(sed -n 's/^m_EditorVersion: //p' "$version_file")"
test "$editor_version" = "6000.5.3f1" || fail "Expected Unity 6000.5.3f1, found ${editor_version:-unset}"

test -f "$manifest_file" || fail "Missing Packages/manifest.json"
test -f "$scene_file" || fail "Missing Bootstrap.unity"
test -f "$domain_asmdef" || fail "Missing WordQuest.Domain.asmdef"
test -f "$runtime_asmdef" || fail "Missing WordQuest.Runtime.asmdef"

generated_dir="$(
  find "$project_root" -type d \
    \( -name Library -o -name Temp -o -name Logs -o -name Obj -o -name Builds -o -name TestResults \) \
    -print -quit
)"
test -z "$generated_dir" || fail "Generated Unity directory found: $generated_dir"

tracked_generated="$(
  git -C "$repo_root" ls-files 'unity-client/Library/**' 'unity-client/Temp/**' \
    'unity-client/Logs/**' 'unity-client/Obj/**' 'unity-client/Builds/**' \
    'unity-client/TestResults/**'
)"
test -z "$tracked_generated" || fail "Generated Unity content is tracked"

if rg -n 'using UnityEngine|UnityEngine\.' "$project_root/Assets/WordQuest/Domain" >/dev/null 2>&1; then
  fail "Domain assembly references UnityEngine"
fi

echo "Unity project validation PASS"
