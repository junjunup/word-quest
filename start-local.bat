@echo off
chcp 65001 >nul 2>nul
title Word Quest - Local Dev
echo.
echo ======================================
echo   Word Quest - Local Start (No Docker)
echo ======================================
echo.

:: Check Node.js
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Please install from https://nodejs.org
    pause
    exit /b 1
)
echo [OK] Node.js found

:: Install server deps
echo.
echo [1/4] Installing server dependencies...
cd /d "%~dp0server"
if not exist node_modules (
    call npm install
) else (
    echo       Already installed, skipping...
)

:: Install client deps
echo.
echo [2/4] Installing client dependencies...
cd /d "%~dp0client"
if not exist node_modules (
    call npm install
) else (
    echo       Already installed, skipping...
)

:: Seed database (only if MongoDB is available; otherwise app.js auto-seeds with in-memory DB)
echo.
echo [3/4] Starting backend server (port 4000)...
echo       (If MongoDB is not installed, an in-memory database will be used automatically)
echo       (Data seeding is handled automatically on startup)
cd /d "%~dp0server"
start "WordQuest-Server" cmd /c "node src/app.js & pause"
:: Wait for server to be ready
echo       Waiting for server to start...
timeout /t 5 /nobreak >nul

:: Verify server is running
curl -s http://localhost:4000/api/health >nul 2>&1
if errorlevel 1 (
    echo [WARN] Server may not be ready yet. If login fails, wait a moment and retry.
) else (
    echo [OK] Backend server is running
)

:: Start client
echo.
echo [4/4] Starting frontend (port 3000)...
echo.
echo ======================================
echo   Ready!
echo ======================================
echo.
echo   Game:     http://localhost:3000
echo   API:      http://localhost:4000/api/health
echo   Account:  test / 123456
echo.
echo   Press Ctrl+C to stop frontend
echo   Close the other terminal to stop backend
echo ======================================
echo.
cd /d "%~dp0client"
call npx vite --host
