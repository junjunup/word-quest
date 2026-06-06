#!/usr/bin/env python3
"""Stop hook: 每次关闭 Claude Code 时将会话信息追加到 docs/session-notes.md"""
import json
import sys
import os
from datetime import datetime

def main():
    # 读取 stdin 中的 session 信息
    try:
        data = json.load(sys.stdin)
        sid = data.get('session_id', 'unknown')[:20]
    except Exception:
        sid = 'unknown'

    notes_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'docs')
    os.makedirs(notes_dir, exist_ok=True)
    notes_path = os.path.join(notes_dir, 'session-notes.md')

    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    entry = f"""
---

## 📅 {now}

**会话ID**: `{sid}`

### 📋 工作进度


### 📝 修改的文件


### ✅ 待办事项


"""

    with open(notes_path, 'a', encoding='utf-8') as f:
        f.write(entry)

    # 输出 systemMessage 告知用户
    print(json.dumps({"systemMessage": "📝 会话笔记已追加到 docs/session-notes.md"}))


if __name__ == '__main__':
    main()
