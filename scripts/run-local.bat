@echo off
title NEXUS AI - Local Run + Cloudflare Tunnel
setlocal disabledelayedexpansion

echo.
echo ========================================================
echo    NEXUS AI - Local Run + Cloudflare Tunnel
echo    (Windows - khong can WSL)
echo ========================================================
echo.

cd /d "%~dp0\.."
echo Project dir: %CD%
echo.

REM ===== Step 0: Check .env =====
echo [0/5] Kiem tra .env...
if not exist ".env" (
    echo [X] Khong tim thay .env
    copy .env.example .env
    echo [] Mo file .env va dien API keys, roi chay lai
    pause
    exit /b 1
)
echo [v] .env da co
echo.

REM ===== Step 1: Check Bun =====
echo [1/5] Kiem tra Bun...
where bun >nul 2>&1
if errorlevel 1 (
    echo [X] Bun chua cai Cai: powershell -c "irm bun.sh/install.ps1 | iex"
    pause
    exit /b 1
)
echo [v] Bun:
bun --version
echo.

REM ===== Step 2: Install deps =====
echo [2/5] Install dependencies...
bun install
if errorlevel 1 (
    echo [X] Loi install
    pause
    exit /b 1
)
echo [v] Dependencies installed
echo.

REM ===== Step 3: Setup DB =====
echo [3/5] Setup database...
bun run db:push
if errorlevel 1 (
    echo [X] Loi database
    pause
    exit /b 1
)
echo [v] Database ready
echo.

REM ===== Step 4: Check cloudflared =====
echo [4/5] Kiem tra cloudflared...
where cloudflared >nul 2>&1
if errorlevel 1 (
    if exist ".\cloudflared.exe" (
        echo [v] cloudflared.exe da co
    ) else (
        echo [] Dang tai cloudflared...
        powershell -Command "Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'cloudflared.exe'"
        if not exist ".\cloudflared.exe" (
            echo [X] Khong tai duoc cloudflared
            goto :start_server_only
        )
        echo [v] cloudflared da tai
    )
) else (
    echo [v] cloudflared da cai
)
echo.

REM ===== Step 5: Start server + tunnel =====
:start_full
echo [5/5] Khoi dong Next.js + Cloudflare Tunnel...
echo.
echo Nhan Ctrl+C de dung.
echo.

REM Start Next.js
start /b bun run dev > dev.log 2>&1

REM Wait for server
echo Dang doi server san sang...
set /a tries=0
:wait_loop
set /a tries+=1
timeout /t 2 /nobreak >nul
curl -s -o nul -w "%%{http_code}" http://localhost:3000/ 2>nul | find "200" >nul
if errorlevel 1 (
    if %tries% lss 15 goto :wait_loop
    echo [X] Server khong khoi dong Kiem tra dev.log
    pause
    exit /b 1
)
echo [v] Server: http://localhost:3000
echo.

REM Start tunnel
echo Dang tao URL public...
start /b cloudflared.exe tunnel --url http://localhost:3000 > tunnel.log 2>&1

REM Wait 15s for tunnel
timeout /t 15 /nobreak >nul

REM Parse URL using separate PS1 file (avoid CMD escaping issues)
if exist tunnel-url.txt del tunnel-url.txt
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\parse-tunnel-url.ps1

REM Read URL from file
set "TUNNEL_URL="
if exist tunnel-url.txt set /p TUNNEL_URL=<tunnel-url.txt

if defined TUNNEL_URL (
    echo %TUNNEL_URL%> .public-url
    echo.
    echo ========================================================
    echo.
    echo  NEXUS AI DANG CHAY
    echo.
    echo     Local:  http://localhost:3000
    echo     Public: %TUNNEL_URL%
    echo.
    echo     Da cap nhat .public-url
    echo     Email se dung URL nay.
    echo.
    echo     Chia se URL public cho thanh vien:
    echo     %TUNNEL_URL%
    echo.
    echo     Nhan Ctrl+C de dung.
    echo.
) else (
    echo.
    echo ========================================================
    echo.
    echo  NEXUS AI DANG CHAY (localhost only)
    echo.
    echo     Local: http://localhost:3000
    echo.
    echo     Khong tao duoc URL tunnel.
    echo     Kiem tra tunnel.log de biet chi tiet.
    echo.
    echo     Nhan Ctrl+C de dung.
    echo.
)
goto :keep_alive

:start_server_only
echo.
echo ========================================================
echo.
echo  NEXUS AI DANG CHAY (localhost only)
echo.
echo     URL: http://localhost:3000
echo.
echo     Khong co URL public.
echo     Cai cloudflared de co URL public.
echo.
echo     Nhan Ctrl+C de dung.
echo.

:keep_alive
pause >nul
