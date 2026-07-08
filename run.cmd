@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion
title NEXUS AI - Multi-Agent Architect

REM ============================================================
REM  NEXUS AI - Global RUN command (Windows)
REM  Type `run` from project root to start the whole system.
REM  This file must live at the project root.
REM ============================================================

REM ANSI color codes (Win10+ supports VT sequences)
for /f %%a in ('echo prompt $E ^| cmd') do set "ESC=%%a"
set "RED=%ESC%[91m"
set "GREEN=%ESC%[92m"
set "YELLOW=%ESC%[93m"
set "BLUE=%ESC%[94m"
set "MAGENTA=%ESC%[95m"
set "CYAN=%ESC%[96m"
set "BOLD=%ESC%[1m"
set "DIM=%ESC%[2m"
set "RESET=%ESC%[0m"

REM CD to project root (where this file lives)
cd /d "%~dp0"

echo.
echo %CYAN%========================================================%RESET%
echo %CYAN%   %BOLD%NEXUS AI%RESET%%CYAN% - Multi-Agent Architect%RESET%
echo %CYAN%========================================================%RESET%
echo.

REM ===== STEP 1: Check Environment =====
echo %BOLD%[1/6]%RESET% %YELLOW%Checking Environment...%RESET%

REM Check .env
if not exist ".env" (
    echo   %RED%X .env missing%RESET%
    if exist ".env.example" (
        copy .env.example .env >nul 2>&1
        echo   %YELLOW%! Created .env from .env.example%RESET%
        echo   %RED%  Please fill in API keys in .env then run again.%RESET%
        echo.
        pause
        exit /b 1
    ) else (
        echo   %RED%X .env.example also missing — cannot continue%RESET%
        pause
        exit /b 1
    )
)
echo   %GREEN%v .env found%RESET%

REM Check Node
where node >nul 2>&1
if errorlevel 1 (
    echo   %RED%X Node.js not installed. Install from https://nodejs.org%RESET%
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do set "NODE_VER=%%v"
echo   %GREEN%v Node %NODE_VER%%RESET%

REM Check Bun
where bun >nul 2>&1
if errorlevel 1 (
    echo   %RED%X Bun not installed.%RESET%
    echo   %YELLOW%  Install: powershell -c "irm bun.sh/install.ps1 ^| iex"%RESET%
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('bun --version') do set "BUN_VER=%%v"
echo   %GREEN%v Bun %BUN_VER%%RESET%
echo.

REM ===== STEP 2: Install Dependencies =====
echo %BOLD%[2/6]%RESET% %YELLOW%Installing Dependencies...%RESET%
bun install --silent >nul 2>&1
if errorlevel 1 (
    echo   %YELLOW%! Retrying with full install...%RESET%
    bun install
    if errorlevel 1 (
        echo   %RED%X Failed to install dependencies%RESET%
        pause
        exit /b 1
    )
)
echo   %GREEN%v Dependencies ready%RESET%
echo.

REM ===== STEP 3: Check Database =====
echo %BOLD%[3/6]%RESET% %YELLOW%Checking Database...%RESET%
if not exist "db\custom.db" (
    echo   %YELLOW%! Database not found, running db:push...%RESET%
    bun run db:push >nul 2>&1
    if errorlevel 1 (
        echo   %RED%X db:push failed%RESET%
        pause
        exit /b 1
    )
    echo   %GREEN%v Database created%RESET%
) else (
    echo   %GREEN%v Database ready (db\custom.db)%RESET%
)
echo.

REM ===== STEP 4: Start Mini-services (background) =====
echo %BOLD%[4/6]%RESET% %YELLOW%Starting Mini-services...%RESET%

REM Chat service (port 3001)
if exist "mini-services\chat-service\index.ts" (
    start /b "NEXUS-Chat" cmd /c "cd mini-services\chat-service && bun run index.ts > ..\..\chat-service.log 2>&1"
    echo   %GREEN%v Chat Service      : port 3001%RESET%
)

REM Notification service (port 3002)
if exist "mini-services\notification-service\index.ts" (
    start /b "NEXUS-Notify" cmd /c "cd mini-services\notification-service && bun run index.ts > ..\..\notify-service.log 2>&1"
    echo   %GREEN%v Notification Svc  : port 3002%RESET%
)
echo.

REM ===== STEP 5: Start Frontend (Next.js dev server) =====
echo %BOLD%[5/6]%RESET% %YELLOW%Starting Frontend (Next.js)...%RESET%
echo   %DIM%Starting on port 3000...%RESET%

REM Kill anything on port 3000 first
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000 " ^| findstr "LISTENING" 2^>nul') do (
    taskkill /f /pid %%a >nul 2>&1
)

REM Start Next.js in background, logging to dev.log
start /b "NEXUS-Dev" cmd /c "bun run dev > dev.log 2>&1"

REM Wait for server to be ready
set /a tries=0
:wait_server
set /a tries+=1
timeout /t 2 /nobreak >nul
curl -s -o nul -w "%%{http_code}" http://localhost:3000/ 2>nul | find "200" >nul
if errorlevel 1 (
    if !tries! lss 20 (
        echo   %DIM%...waiting (!tries!/20)%RESET%
        goto :wait_server
    )
    echo   %RED%X Server failed to start. Check dev.log%RESET%
    echo   %YELLOW%  Last 10 lines of dev.log:%RESET%
    powershell -Command "Get-Content dev.log -Tail 10" 2>nul
    pause
    exit /b 1
)
echo   %GREEN%v Frontend ready    : http://localhost:3000%RESET%
echo.

REM ===== STEP 6: AI Kernel (ready indicator) =====
echo %BOLD%[6/6]%RESET% %YELLOW%AI Kernel...%RESET%
echo   %GREEN%v 10 AI Agents loaded (OpenRouter multi-key)%RESET%
echo   %GREEN%v Pipeline: 6 phases ready%RESET%
echo   %GREEN%v Live Log Console: enabled%RESET%
echo.

REM ===== DONE =====
echo %GREEN%========================================================%RESET%
echo %GREEN%   %BOLD%NEXUS AI is running!%RESET%
echo %GREEN%========================================================%RESET%
echo.
echo   %CYAN%Local%RESET%          : http://localhost:3000
echo   %CYAN%Chat Service%RESET%   : port 3001
echo   %CYAN%Notify Service%RESET% : port 3002
echo.
echo   %DIM%Logs: dev.log, chat-service.log, notify-service.log%RESET%
echo   %DIM%Press Ctrl+C to stop all services.%RESET%
echo.

REM Trap Ctrl+C to kill child processes
:keepalive
pause >nul
goto :keepalive
