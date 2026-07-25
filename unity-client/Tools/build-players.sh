#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "$0")/.." && pwd)"
editor="${UNITY_EDITOR_BIN:-/Applications/Unity/Hub/Editor/6000.5.3f1/Unity.app/Contents/MacOS/Unity}"

if test ! -x "$editor"; then
  echo "NOT RUN: Unity 6000.5.3f1 unavailable at $editor" >&2
  exit 2
fi

"$editor" \
  -batchmode \
  -nographics \
  -projectPath "$project_root" \
  -executeMethod WordQuest.Editor.BuildCommand.BuildWindows \
  -quit

"$editor" \
  -batchmode \
  -nographics \
  -projectPath "$project_root" \
  -executeMethod WordQuest.Editor.BuildCommand.BuildMacOS \
  -quit

bash "$project_root/Tools/validate-build-artifacts.sh"
