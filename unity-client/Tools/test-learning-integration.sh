#!/usr/bin/env bash
set -euo pipefail
repo="$(cd "$(dirname "$0")/../.." && pwd)"
fixture_dir="$(mktemp -d)"
fixture_pid=""
cleanup() {
  if test -n "$fixture_pid"; then kill "$fixture_pid" 2>/dev/null || true; wait "$fixture_pid" 2>/dev/null || true; fi
  rm -rf "$fixture_dir"
}
trap cleanup EXIT
node "$repo/server/src/scripts/learningApiFixture.js" "$fixture_dir/api.json" > "$fixture_dir/server.log" 2>&1 &
fixture_pid=$!
for (( i=0; i<120; i++ )); do
  if test -s "$fixture_dir/api.json"; then break; fi
  if ! kill -0 "$fixture_pid" 2>/dev/null; then cat "$fixture_dir/server.log"; exit 1; fi
  sleep 1
done
if ! test -s "$fixture_dir/api.json"; then echo "Fixture startup timed out" >&2; exit 1; fi
WORDQUEST_TEST_API_FIXTURE="$fixture_dir/api.json" bash "$repo/unity-client/Tools/run-unity-tests.sh" PlayMode
