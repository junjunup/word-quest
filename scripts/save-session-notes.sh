#!/usr/bin/env bash
# Stop hook: 每次关闭 Claude Code 时将会话信息追加到 docs/session-notes.md

set -euo pipefail

NOTES_DIR="docs"
NOTES_FILE="$NOTES_DIR/session-notes.md"
NOW=$(date '+%Y-%m-%d %H:%M:%S')

# 尝试从 stdin 读取 session_id
SID="unknown"
if [ -p /dev/stdin ] || [ ! -t 0 ]; then
  read -r stdin_line 2>/dev/null || true
  SID=$(echo "$stdin_line" | sed 's/.*"session_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/' 2>/dev/null || echo "unknown")
  SID="${SID:-unknown}"
fi

mkdir -p "$NOTES_DIR"

cat >> "$NOTES_FILE" << EOF

---

## 📅 $NOW

**会话ID**: \`${SID:0:20}\`

### 📋 工作进度


### 📝 修改的文件


### ✅ 待办事项


EOF

# 输出 systemMessage
echo '{"systemMessage": "📝 会话笔记已追加到 docs/session-notes.md"}'
