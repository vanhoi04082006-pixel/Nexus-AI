@echo off
setlocal disabledelayedexpansion
title NEXUS AI - Local Run + Tunnel

echo.
echo ========================================================
echo    NEXUS AI - Local Run + Tunnel
echo ========================================================
echo.

cd /d "%~dp0\.."
echo Project dir: %CD%
echo.

REM ===== Load tunnel config =====
set "TUNNEL_MODE=quick"
set "TUNNEL_NAME="
set "TUNNEL_URL="
set "NGROK_DOMAIN="
if exist "tunnel.conf" (
    for /f "usebackq tokens=1,2 delims==" %%a in ("tunnel.conf") do (
        set "line=%%a"
        if not "%%a"=="" if not "%%a:~0,1%"=="#" (
            if /i "%%a"=="TUNNEL_MODE" set "TUNNEL_MODE=%%b"
            if /i "%%a"=="TUNNEL_NAME" set "TUNNEL_NAME=%%b"
            if /i "%%a"=="TUNNEL_URL" set "TUNNEL_URL=%%b"
            if /i "%%a"=="NGROK_DOMAIN" set "NGROK_DOMAIN=%%b"
        )
    )
)
echo [*] Tunnel mode: %TUNNEL_MODE%
echo.

REM ===== Step 0: Check .env =====
echo [0/5] Kiem tra .env...
if not exist ".env" (
    echo [X] Khong tim thay .env
    copy .env.example .env
    echo [*] Mo file .env va dien API keys, roi chay lai
    pause
    exit /b 1
)
echo [v] .env da co
echo.

REM ===== Step 1: Check Bun =====
echo [1/5] Kiem tra Bun...
where bun >nul 2>&1
if errorlevel 1 (
    echo [X] Bun chua cai. Cai: powershell -c "irm bun.sh/install.ps1 | iex"
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

REM ===== Step 4: Check tunnel tool =====
echo [4/5] Kiem tra tunnel tool...
if /i "%TUNNEL_MODE%"=="ngrok" (
    where ngrok >nul 2>&1
    if errorlevel 1 (
        echo [X] ngrok chua cai. Tai tai https://ngrok.com/download
        echo [*] Sau khi cai, chay: ngrok config add-authtoken YOUR_TOKEN
        echo [*] Hoac doi TUNNEL_MODE=quick trong tunnel.conf
        pause
        exit /b 1
    )
    echo [v] ngrok da cai
) else if /i "%TUNNEL_MODE%"=="cloudflare-named" (
    where cloudflared >nul 2>&1
    if errorlevel 1 (
        if exist ".\cloudflared.exe" (
            echo [v] cloudflared.exe da co
        ) else (
            echo [X] cloudflared chua cai. Cai truoc khi dung named tunnel.
            echo [*] Hoac doi TUNNEL_MODE=quick trong tunnel.conf
            pause
            exit /b 1
        )
    ) else (
        echo [v] cloudflared da cai
    )
    if "%TUNNEL_NAME%"=="" (
        echo [X] TUNNEL_NAME chua cau hinh trong tunnel.conf
        echo [*] Xem huong dan trong tunnel.conf (Phuong an 2)
        pause
        exit /b 1
    )
) else (
    REM Quick tunnel mode — check cloudflared
    where cloudflared >nul 2>&1
    if errorlevel 1 (
        if exist ".\cloudflared.exe" (
            echo [v] cloudflared.exe da co
        ) else (
            echo [*] Dang tai cloudflared...
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
)
echo.

REM ===== Step 5: Start server + tunnel =====
:start_full
echo [5/5] Khoi dong Next.js + Tunnel...
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
    echo [X] Server khong khoi dong. Kiem tra dev.log
    pause
    exit /b 1
)
echo [v] Server: http://localhost:3000
echo.

REM ===== Start tunnel based on mode =====
if /i "%TUNNEL_MODE%"=="ngrok" goto :start_ngrok
if /i "%TUNNEL_MODE%"=="cloudflare-named" goto :start_cf_named
goto :start_cf_quick

REM ── NGROK (fixed domain) ──
:start_ngrok
echo [*] Dang khoi dong ngrok voi domain: %NGROK_DOMAIN%
start /b ngrok http 3000 --domain=%NGROK_DOMAIN% > tunnel.log 2>&1
timeout /t 5 /nobreak >nul
set "FINAL_URL=https://%NGROK_DOMAIN%"
echo %FINAL_URL%> .public-url
goto :show_success

REM ── CLOUDFLARE NAMED TUNNEL (fixed URL) ──
:start_cf_named
echo [*] Dang khoi dong Cloudflare Named Tunnel: %TUNNEL_NAME%
start /b cloudflared.exe tunnel run %TUNNEL_NAME% > tunnel.log 2>&1
timeout /t 8 /nobreak >nul
set "FINAL_URL=%TUNNEL_URL%"
if "%FINAL_URL%"=="" (
    echo [!] TUNNEL_URL chua cau hinh — dung TUNNEL_NAME lam URL
    set "FINAL_URL=https://%TUNNEL_NAME%.cfargotunnel.com"
)
echo %FINAL_URL%> .public-url
goto :show_success

REM ── CLOUDFLARE QUICK TUNNEL (random URL) ──
:start_cf_quick
echo Dang tao URL public (random)...
start /b cloudflared.exe tunnel --url http://localhost:3000 > tunnel.log 2>&1
timeout /t 15 /nobreak >nul
if exist tunnel-url.txt del tunnel-url.txt
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\parse-tunnel-url.ps1
set "FINAL_URL="
if exist tunnel-url.txt set /p FINAL_URL=<tunnel-url.txt
if not defined FINAL_URL goto :no_tunnel_url
if "%FINAL_URL%"=="" goto :no_tunnel_url
echo %FINAL_URL%> .public-url
goto :show_success

REM ── SUCCESS ──
:show_success
echo.
echo ========================================================
echo.
echo  NEXUS AI DANG CHAY
echo.
echo     Local:  http://localhost:3000
echo     Public: %FINAL_URL%
echo.
if /i not "%TUNNEL_MODE%"=="quick" (
    echo     [*] URL CO DINH — khong doi khi restart
    echo     [*] Tunnel mode: %TUNNEL_MODE%
) else (
    echo     [!] URL se doi moi lan restart
    echo     [*] De co URL co dinh, xem tunnel.conf
)
echo.
echo     Da cap nhat .public-url
echo     Email se dung URL nay.
echo.
echo     Chia se URL public cho thanh vien:
echo     %FINAL_URL%
echo.
echo     Nhan Ctrl+C de dung.
echo.
goto :keep_alive

:no_tunnel_url
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
echo     Cai cloudflared hoac ngrok de co URL public.
echo.
echo     Nhan Ctrl+C de dung.
echo.

:keep_alive
pause >nul
