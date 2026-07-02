@echo off
chcp 65001 >nul
title NEXUS AI - Local Run + Cloudflare Tunnel

echo.
echo +======================================================+
echo |   NEXUS AI - Local Run + Cloudflare Tunnel           |
echo |   (Windows - khong can WSL)                          |
echo +======================================================+
echo.

REM ===== Detect project directory =====
cd /d "%~dp0\.."
echo Project dir: %CD%
echo.

REM ===== Bước 0: Kiểm tra .env =====
echo [0/5] Kiem tra .env...
if not exist ".env" (
    echo.
    echo [X] Khong tim thay .env!
    echo    Tao .env tu .env.example:
    copy .env.example .env
    echo.
    echo [!] Mo file .env va dien API keys, roi chay lai script nay!
    echo.
    pause
    exit /b 1
)
echo [v] .env da co
echo.

REM ===== Bước 1: Kiểm tra Bun =====
echo [1/5] Kiem tra Bun...
where bun >nul 2>&1
if errorlevel 1 (
    echo.
    echo [X] Bun chua cai! Cai now:
    echo    powershell -c "irm bun.sh/install.ps1 ^| iex"
    echo.
    echo Sau khi cai, mo terminal moi va chay lai script nay.
    pause
    exit /b 1
)
echo [v] Bun: 
bun --version
echo.

REM ===== Bước 2: Install dependencies =====
echo [2/5] Install dependencies...
bun install
if errorlevel 1 (
    echo [X] Loi install dependencies!
    pause
    exit /b 1
)
echo [v] Dependencies installed
echo.

REM ===== Bước 3: Setup database =====
echo [3/5] Setup database...
bun run db:push
if errorlevel 1 (
    echo [X] Loi setup database!
    pause
    exit /b 1
)
echo [v] Database ready
echo.

REM ===== Bước 4: Kiểm tra cloudflared =====
echo [4/5] Kiem tra cloudflared...
where cloudflared >nul 2>&1
if errorlevel 1 (
    echo.
    echo [!] cloudflared chua cai. Dang tai...
    echo.
    REM Tải cloudflared cho Windows
    powershell -Command "Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'cloudflared.exe'"
    if errorlevel 1 (
        echo [X] Khong tai duoc cloudflared!
        echo    Tai thu cong: https://github.com/cloudflare/cloudflared/releases/latest
        echo    Dat file cloudflared.exe vao thu muc project hoac them vao PATH
        echo.
        echo    Tam thoi, server se chay o localhost:3000
        echo    (Thanh vien khong truy cap duoc tu ngoai mang)
        echo.
        goto :start_server_only
    )
    echo [v] cloudflared da tai
)
echo.

REM ===== Bước 5: Khởi động server + tunnel =====
:start_full
echo [5/5] Khoi dong Next.js + Cloudflare Tunnel...
echo.
echo Server se chay o nen. Nhan Ctrl+C de dung.
echo.

REM Khoi dong Next.js server trong background
start /b bun run dev > dev.log 2>&1

REM Doi server san sang
echo Dang doi server san sang...
set /a tries=0
:wait_loop
set /a tries+=1
timeout /t 2 /nobreak >nul
curl -s -o nul -w "%%{http_code}" http://localhost:3000/ 2>nul | find "200" >nul
if errorlevel 1 (
    if %tries% lss 15 (
        echo.
        goto :wait_loop
    )
    echo [X] Server khong khoi dong duoc! Kiem tra dev.log
    pause
    exit /b 1
)
echo [v] Server san sang tai http://localhost:3000
echo.

REM Khoi dong Cloudflare Tunnel — output vao file de parse URL
echo Dang tao URL public...
echo.

REM Chay cloudflared va luu output vao tunnel.log
start /b cloudflared.exe tunnel --url http://localhost:3000 > tunnel.log 2>&1

REM Doi 15 giay de tunnel tao URL
timeout /t 15 /nobreak >nul

REM Dung PowerShell de parse URL tu tunnel.log (don gian, khong loi batch syntax)
for /f "delims=" %%i in ('powershell -NoProfile -Command "(Get-Content tunnel.log -Raw) -match 'https://[a-z0-9-]+\.trycloudflare\.com' | Out-Null; $matches[0]" 2^>nul') do set "TUNNEL_URL=%%i"

REM Neu van khong tim thay, thu lay tat ca cac dong co https
if not defined TUNNEL_URL (
    for /f "delims=" %%i in ('powershell -NoProfile -Command "Select-String -Path tunnel.log -Pattern 'https://' -AllMatches ^| ForEach-Object { $_.Matches } ^| ForEach-Object { $_.Value } ^| Select-Object -First 1" 2^>nul') do set "TUNNEL_URL=%%i"
)

if defined TUNNEL_URL (
    REM Ghi URL vao file .public-url
    echo %TUNNEL_URL%> .public-url
    echo.
    echo ========================================================
    echo.
    echo  NEXUS AI DANG CHAY!
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
    echo  NEXUS AI DANG CHAY (localhost only)!
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
echo  NEXUS AI DANG CHAY (localhost only)!
echo.
echo     URL: http://localhost:3000
echo.
echo     Khong co URL public. Chi ban truy cap duoc.
echo     Cai cloudflared de co URL public.
echo.
echo     Nhan Ctrl+C de dung.
echo.

:keep_alive
REM Giu script chay
pause >nul
