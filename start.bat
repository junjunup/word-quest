@echo off
chcp 65001 >nul
echo.
echo ======================================
echo   词汇大冒险 Word Quest - 一键部署
echo ======================================
echo.

:: 检查 Docker
docker --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到 Docker，请先安装 Docker Desktop
    echo 下载地址: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

:: 检查 .env 文件
if not exist ".env" (
    echo [提示] 未检测到 .env 配置文件，将从模板创建...
    copy .env.example .env >nul
    echo [提示] 已创建 .env，请编辑填入你的百度文心一言 API Key
    echo [提示] 如果不填写，小智将使用本地模拟回复
    echo.
    echo 按任意键继续部署（或先编辑 .env 后重新运行此脚本）...
    pause >nul
)

echo.
echo [1/3] 构建 Docker 镜像...
docker-compose build --parallel
if errorlevel 1 (
    echo [错误] 构建失败，请检查上方错误信息
    pause
    exit /b 1
)

echo.
echo [2/3] 启动所有服务...
docker-compose up -d
if errorlevel 1 (
    echo [错误] 启动失败
    pause
    exit /b 1
)

echo.
echo [3/3] 等待服务就绪...
timeout /t 8 /nobreak >nul

:: 检查健康状态
echo.
echo 检查服务状态:
docker-compose ps

echo.
echo ======================================
echo   部署完成！
echo ======================================
echo.
echo   游戏地址:    http://localhost:3000
echo   API 地址:    http://localhost:4000/api/health
echo   LLM 服务:    http://localhost:8000/health
echo.
echo   测试账号:    test / 123456
echo.
echo   停止服务:    docker-compose down
echo   查看日志:    docker-compose logs -f
echo   重新部署:    docker-compose up -d --build
echo ======================================
echo.
pause
