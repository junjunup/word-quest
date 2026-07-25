#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "$0")/.." && pwd)"
mac_app="$project_root/Builds/macOS/WordQuest.app"
mac_executable="$project_root/Builds/macOS/WordQuest.app/Contents/MacOS/Word Quest"
results_root="$project_root/TestResults"
smoke_root="$(mktemp -d /tmp/wordquest-player-smoke.XXXXXX)"
player_log="$smoke_root/macOSPlayerSmoke.log"
bootstrap_log="$smoke_root/macOSPlayerBootstrap.log"
saved_player_log="$results_root/macOSPlayerSmoke.log"
saved_bootstrap_log="$results_root/macOSPlayerBootstrap.log"
player_pid=""

find_player_pid() {
  local candidate
  local command
  while IFS= read -r candidate; do
    command="$(
      ps -p "$candidate" -o command= 2>/dev/null ||
        true
    )"
    case "$command" in
      *"-logFile $player_log")
        printf '%s\n' "$candidate"
        return 0
        ;;
    esac
  done < <(pgrep -x "Word Quest" || true)
  return 1
}

fail() {
  echo "ERROR: $1" >&2
  if test -f "$bootstrap_log"; then
    sed -n '1,120p' "$bootstrap_log" >&2
  fi
  if test -f "$player_log"; then
    tail -n 120 "$player_log" >&2
  fi
  exit 1
}

cleanup() {
  if test -z "$player_pid"; then
    player_pid="$(find_player_pid || true)"
  fi
  if test -n "$player_pid" && kill -0 "$player_pid" 2>/dev/null; then
    kill "$player_pid" 2>/dev/null || true
    wait "$player_pid" 2>/dev/null || true
  fi
  mkdir -p "$results_root"
  test -f "$player_log" &&
    cp "$player_log" "$saved_player_log"
  test -f "$bootstrap_log" &&
    cp "$bootstrap_log" "$saved_bootstrap_log"
  rm -rf "$smoke_root"
}
trap cleanup EXIT

test -d "$mac_app" || fail "Missing macOS app bundle"
test -x "$mac_executable" || fail "Missing executable macOS Player"
mkdir -p "$results_root"
: >"$saved_player_log"
: >"$saved_bootstrap_log"
: >"$player_log"
: >"$bootstrap_log"

/usr/bin/open \
  -n \
  "$mac_app" \
  --args \
  -batchmode \
  -nographics \
  -logFile "$player_log" \
  >"$bootstrap_log" 2>&1

ready=0
for _ in $(seq 1 50); do
  if test -z "$player_pid"; then
    player_pid="$(find_player_pid || true)"
  fi
  if test -n "$player_pid" &&
    ! kill -0 "$player_pid" 2>/dev/null; then
    wait "$player_pid" 2>/dev/null || true
    fail "macOS Player exited before Bootstrap was ready"
  fi
  if rg -F "WORDQUEST_BOOTSTRAP_READY" "$player_log" >/dev/null 2>&1; then
    test -n "$player_pid" ||
      fail "Unable to identify the launched macOS Player"
    ready=1
    break
  fi
  sleep 0.2
done

test -n "$player_pid" ||
  fail "Unable to identify the launched macOS Player"
test "$ready" = "1" || fail "macOS Player Word Quest bootstrap timed out"
sleep 1

if rg -n \
  'ICU Data not available|[A-Za-z0-9_.]+Exception(:|$)|Unhandled exception|^Error:|Crash!!!|Segmentation fault|Abort trap|dyld\[' \
  "$player_log" "$bootstrap_log" >/dev/null; then
  fail "macOS Player logged a startup exception"
fi

echo "macOS Player smoke test PASS"
