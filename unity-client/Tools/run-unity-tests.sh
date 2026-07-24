#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "$0")/.." && pwd)"
editor="${UNITY_EDITOR_BIN:-/Applications/Unity/Hub/Editor/6000.5.3f1/Unity.app/Contents/MacOS/Unity}"

if test ! -x "$editor"; then
  echo "NOT RUN: Unity 6000.5.3f1 unavailable at $editor" >&2
  exit 2
fi

mkdir -p "$project_root/TestResults"

run_suite() {
  local platform="$1"
  "$editor" \
    -batchmode \
    -nographics \
    -projectPath "$project_root" \
    -runTests \
    -testPlatform "$platform" \
    -testResults "$project_root/TestResults/${platform}.xml" \
    -quit
}

case "${1:-all}" in
  EditMode|PlayMode)
    run_suite "$1"
    ;;
  all)
    run_suite EditMode
    run_suite PlayMode
    ;;
  *)
    echo "Usage: $0 [all|EditMode|PlayMode]" >&2
    exit 64
    ;;
esac
