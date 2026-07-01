@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

echo.
echo ╔══════════════════════════════════════════════════════╗
echo ║   NEXUS AI — Local Run + Cloudflare Tunnel (Windows) ║
echo ╚══════════════════════════════════════════════════════╝
echo.

cd /d "%~dp0\.."

REM ===== Bước 0: Kiểm tra dependencies =====
echo [0/5] Kiem tra dependencies...

REM Kiểm tra Bun
where bun >nul 2>&1
if errorlevel 1 (
    echo [!] Bun chua cai. Dang cai...
    powershell -Command "irm bun.sh/install.ps1 | iex"
    REM Refresh PATH
    set "PATH=%USERPROFILE%\.bun\bin;%PATH%"
)

REM Kiểm tra Node
where node >nul 2>&1
if errorlevel 1 (
    echo [X] Node.js chua cai. Tai tu https://nodejs.org
    pause
    exit /b 1
)
echo [OK] Node: 
node --version

REM Kiểm tra .env
if not exist ".env" (
    echo [!] Tao .env tu .env.example...
    copy .env.example .env >nul
    echo.
    echo [!] Mo file .env va dien API keys, roi chay lai script!
    echo     notepad .env
    echo.
    pause
    exit /b 1
)
echo [OK] .env da co
echo.

REM ===== Bước 1: Install dependencies =====
echo [1/5] Install dependencies...
call bun install
echo.

REM ===== Bước 2: Setup database =====
echo [2/5] Setup database...
call bun run db:push
echo.

REM ===== Bước 3: Kiểm tra cloudflared =====
echo [3/5] Kiem tra cloudflared...
where cloudflared >nul 2>&1
if errorlevel 1 (
    echo [!] cloudflared chua cai. Dang cai...
    
    REM Tải cloudflared cho Windows
    echo Dang tai cloudflared.exe...
    powershell -Command "Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile 'cloudflared.exe'"
    
    REM Move to a directory in PATH (hoặc dùng cùng folder)
    if not exist "%USERPROFILE%\bin" mkdir "%USERPROFILE%\bin"
    move cloudflared.exe "%USERPROFILE%\bin\cloudflared.exe" >nul
    set "PATH=%USERPROFILE%\bin;%PATH%"
    
    echo [OK] cloudflared da cai tai %USERPROFILE%\bin\
)
echo [OK] cloudflared: 
cloudflared --version 2>&1
echo.

REM ===== Bước 4: Khởi động Next.js server =====
echo [4/5] Khoi dong Next.js server (port 3000)...
echo Server se chay o nen. Nhan Ctrl+C de dung.
echo.

REM Khởi động Next.js trong background
start /b cmd /c "bun run dev > dev.log 2>&1"

REM Đợi server sẵn sàng
echo Dang doi server san sang...
set "SERVER_READY=0"
for /l %%i in (1,1,30) do (
    if "!SERVER_READY!"=="0" (
        timeout /t 2 /nobreak >nul
        curl -s -o nul -w "%%{http_code}" http://localhost:3000/ >nul 2>&1
        if not errorlevel 1 (
            for /f %%a in ('curl -s -o nul -w "%%{http_code}" http://localhost:3000/ 2^>nul') do (
                if "%%a"=="200" (
                    set "SERVER_READY=1"
                    echo [OK] Server san sang!
                )
            )
        )
        if "!SERVER_READY!"=="0" echo   doi... %%i/30
    )
)
echo.

REM ===== Bước 5: Khởi động Cloudflare Tunnel =====
echo [5/5] Khoi dong Cloudflare Tunnel...
echo Dang tao URL public...
echo.

REM Chạy cloudflared — tìm URL trong output
REM Lưu output vào file để parse
start /b cmd /c "cloudflared tunnel --url http://localhost:3000 > tunnel.log 2>&1"

REM Đợi và tìm URL trong tunnel.log
echo Dang cho URL...
set "TUNNEL_URL="
for /l %%i in (1,1,30) do (
    if "!TUNNEL_URL!"=="" (
        timeout /t 2 /nobreak >nul
        if exist "tunnel.log" (
            for /f "tokens=*" %%a in ('findstr /C:"trycloudflare.com" tunnel.log 2^>nul') do (
                for /f "tokens=2 delims= " %%b in ("%%a") do (
                    if "!TUNNEL_URL!"=="" (
                        REM Extract URL
                        for /f "tokens=*" %%u in ('echo %%b ^| findstr /R "https://.*trycloudflare.com"') do (
                            set "TUNNEL_URL=%%u"
                        )
                    )
                )
            )
        )
        if "!TUNNEL_URL!"=="" echo   doi... %%i/30
    )
)

REM Nếu không tìm thấy URL bằng findstr, thử cách khác
if "!TUNNEL_URL!"=="" (
    if exist "tunnel.log" (
        for /f "tokens=*" %%a in (tunnel.log) do (
            echo %%a | findstr /R "https://.*trycloudflare.com" >nul
            if not errorlevel 1 (
                if "!TUNNEL_URL!"=="" (
                    REM Parse URL từ dòng
                    for /f "tokens=*" %%u in ('echo %%a ^| powershell -Command "$input = $input -replace '.*?(https://[a-z0-9-]+\.trycloudflare\.com).*', '$1'; $input"') do (
                        set "TUNNEL_URL=%%u"
                    )
                )
            )
        )
    )
)

if "!TUNNEL_URL!"=="" (
    echo.
    echo [!] Khong tim thay URL tunnel. Kiem tra tunnel.log
    echo.
    echo Mo browser thu cong va xem:
    echo     type tunnel.log
    echo.
    echo Hoac mo http://localhost:3000 truc tiep.
    echo.
    pause
    exit /b 1
)

REM Cập nhật file .public-url để email dùng URL đúng
echo !TUNNEL_URL!> .public-url
echo [OK] Da cap nhat .public-url: !TUNNEL_URL!

echo.
echo ╔══════════════════════════════════════════════════════╗
echo ║   ✅ NEXUS AI DANG CHAY!                             ║
echo ╚══════════════════════════════════════════════════════╝
echo.
echo    Local:  http://localhost:3000
echo    Public: !TUNNEL_URL!
echo.
echo 📋 Chia se URL public cho thanh vien:
echo    !TUNNEL_URL!
echo.
echo ⚠ Luu y:
echo    - May phai BAT de URL hoat dong
echo    - URL doi moi lan chay lai script
echo    - Chat dung polling (3s) — khong can chat service
echo    - Email gui cho thanh vien se dung URL nay
echo.
echo Nhan Ctrl+C de dung. Hoac dong cua so nay.
echo.

REM Giữ script chạy
pause >nul

REM Cleanup khi dừng
echo Dang dung...
taskkill /f /im bun.exe >nul 2>&1
taskkill /f /im cloudflared.exe >nul 2>&1
echo Da dung.
