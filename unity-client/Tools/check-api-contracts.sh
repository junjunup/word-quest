#!/usr/bin/env bash
set -euo pipefail

tool_dir="$(cd "$(dirname "$0")" && pwd)"
exec "$tool_dir/validate-api-contracts.sh"
