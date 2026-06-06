"""
Word Quest 本地启动脚本
彻底清除代理环境变量后启动三个服务，避免代理干扰千问API
"""
import subprocess
import sys
import os
import time
import signal

# 1. 清除所有代理环境变量
proxy_vars = ['HTTP_PROXY', 'http_proxy', 'HTTPS_PROXY', 'https_proxy',
              'ALL_PROXY', 'all_proxy', 'NO_PROXY', 'no_proxy']
clean_env = os.environ.copy()
for var in proxy_vars:
    clean_env.pop(var, None)

PROJECT = os.path.dirname(os.path.abspath(__file__))
processes = []

def cleanup(signum=None, frame=None):
    print("\n正在停止所有服务...")
    for p in processes:
        try:
            p.terminate()
            p.wait(timeout=5)
        except:
            try:
                p.kill()
            except:
                pass
    print("已停止。")
    sys.exit(0)

signal.signal(signal.SIGINT, cleanup)
signal.signal(signal.SIGTERM, cleanup)

# 2. 启动后端 (port 4000)
print("[1/3] 启动后端 (port 4000)...")
p_server = subprocess.Popen(
    [sys.executable if False else "node", "src/app.js"],
    cwd=os.path.join(PROJECT, "server"),
    env=clean_env,
    creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0,
)
processes.append(p_server)

# 3. 启动 llm-service (port 8000)
print("[2/3] 启动 LLM 服务 (port 8000)...")
python_exe = os.path.join(PROJECT, "llm-service", "venv", "Scripts", "python.exe")
p_llm = subprocess.Popen(
    [python_exe, "main.py"],
    cwd=os.path.join(PROJECT, "llm-service"),
    env=clean_env,
    creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0,
)
processes.append(p_llm)

# 4. 启动前端 (port 3000)
print("[3/3] 启动前端 (port 3000)...")
p_client = subprocess.Popen(
    ["npx", "vite", "--host"],
    cwd=os.path.join(PROJECT, "client"),
    env=clean_env,
    creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == "win32" else 0,
)
processes.append(p_client)

# 5. 等待服务就绪
print("\n等待服务启动...")
time.sleep(5)

import urllib.request
services = [
    ("前端", 3000), ("后端", 4000), ("LLM", 8000),
]
all_ok = True
for name, port in services:
    try:
        urllib.request.urlopen(f"http://localhost:{port}", timeout=3)
        print(f"  [OK] {name} :{port}")
    except:
        print(f"  [FAIL] {name} :{port}")
        all_ok = False

if all_ok:
    print(f"\n{'='*45}")
    print(f"  全部启动成功！")
    print(f"  游戏: http://localhost:3000")
    print(f"  账号: test / 123456")
    print(f"{'='*45}")
else:
    print("\n部分服务启动失败，请检查日志。")

print("\n按 Ctrl+C 停止所有服务...\n")

# 6. 监控子进程
try:
    while True:
        time.sleep(1)
        for p in processes:
            ret = p.poll()
            if ret is not None:
                print(f"[WARN] 进程退出 (code={ret}): {p.args}")
except KeyboardInterrupt:
    cleanup()
