# ================================================================
# NEXUS AI — Local Run + Cloudflare Tunnel (PowerShell)
# Chạy: powershell -ExecutionPolicy Bypass -File scripts\run-local.ps1
# ================================================================

$ErrorActionPreference = "Stop"
$ProjectDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $ProjectDir

function Write-Step($num, $msg) {
    Write-Host "[$num/5] $msg" -ForegroundColor Yellow
}
function Write-OK($msg) {
    Write-Host "  ✓ $msg" -ForegroundColor Green
}
function Write-Err($msg) {
    Write-Host "  ❌ $msg" -ForegroundColor Red
}

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Blue
Write-Host "║   NEXUS AI — Local Run + Cloudflare Tunnel           ║" -ForegroundColor Blue
Write-Host "║   (PowerShell — khong can WSL)                      ║" -ForegroundColor Blue
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Blue
Write-Host ""

# ===== Bước 0: Kiểm tra .env =====
Write-Step 0 "Kiem tra .env..."
if (-not (Test-Path ".env")) {
    Write-Err "Khong tim thay .env!"
    Copy-Item ".env.example" ".env"
    Write-Host ""
    Write-Host "  ⚠ Mo file .env va dien API keys, roi chay lai script!" -ForegroundColor Yellow
    Read-Host "Nhan Enter de thoat"
    exit 1
}
Write-OK ".env da co"

# ===== Bước 1: Kiểm tra Bun =====
Write-Step 1 "Kiem tra Bun..."
$bunVersion = & bun --version 2>$null
if (-not $bunVersion) {
    Write-Err "Bun chua cai!"
    Write-Host ""
    Write-Host "  Cai Bun:" -ForegroundColor Yellow
    Write-Host "  powershell -c `"irm bun.sh/install.ps1 | iex`"" -ForegroundColor Cyan
    Write-Host ""
    Read-Host "Nhan Enter de thoat"
    exit 1
}
Write-OK "Bun: $bunVersion"

# ===== Bước 2: Install dependencies =====
Write-Step 2 "Install dependencies..."
& bun install 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Err "Loi install dependencies!"
    Read-Host "Nhan Enter de thoat"
    exit 1
}
Write-OK "Dependencies installed"

# ===== Bước 3: Setup database =====
Write-Step 3 "Setup database..."
& bun run db:push 2>&1 | Out-Null
Write-OK "Database ready"

# ===== Bước 4: Kiểm tra/cài cloudflared =====
Write-Step 4 "Kiem tra cloudflared..."
$cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cloudflared) {
    # Kiểm tra file local
    if (Test-Path ".\cloudflared.exe") {
        $cloudflared = ".\cloudflared.exe"
    } else {
        Write-Host "  ⚠ cloudflared chua cai. Dang tai..." -ForegroundColor Yellow
        try {
            Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile "cloudflared.exe"
            $cloudflared = ".\cloudflared.exe"
            Write-OK "cloudflared da tai"
        } catch {
            Write-Err "Khong tai duoc cloudflared!"
            Write-Host "  Tai thu cong: https://github.com/cloudflare/cloudflared/releases/latest" -ForegroundColor Yellow
            $runLocalOnly = $true
        }
    }
} else {
    Write-OK "cloudflared: $($cloudflared.Source)"
}

# ===== Bước 5: Khởi động server + tunnel =====
Write-Step 5 "Khoi dong Next.js..."
Write-Host ""
Write-Host "Server se chay o nen. Nhan Ctrl+C de dung ca 2." -ForegroundColor Cyan
Write-Host ""

# Khởi động Next.js server (background)
$serverJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location $dir
    bun run dev 2>&1
} -ArgumentList $ProjectDir

# Đợi server sẵn sàng
Write-Host "  Dang doi server san sang" -NoNewline
$tries = 0
$maxTries = 30
while ($tries -lt $maxTries) {
    Write-Host "." -NoNewline
    Start-Sleep -Seconds 2
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:3000/" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        if ($resp.StatusCode -eq 200) {
            Write-Host " ✓" -ForegroundColor Green
            break
        }
    } catch {
        $tries++
    }
}
if ($tries -ge $maxTries) {
    Write-Host " ❌" -ForegroundColor Red
    Write-Err "Server khong khoi dong duoc!"
    Stop-Job $serverJob -ErrorAction SilentlyContinue
    Read-Host "Nhan Enter de thoat"
    exit 1
}
Write-OK "Server san sang: http://localhost:3000"

if ($runLocalOnly) {
    Write-Host ""
    Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║   ✅ NEXUS AI DANG CHAY (localhost only)             ║" -ForegroundColor Green
    Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    Write-Host "  URL: http://localhost:3000" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  ⚠ Khong co URL public (cloudflared chua cai)" -ForegroundColor Yellow
    Write-Host "     Chi ban truy cap duoc." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Nhan Ctrl+C de dung." -ForegroundColor Cyan
    Write-Host ""
    while ($true) { Start-Sleep -Seconds 3600 }
    exit 0
}

# Khởi động Cloudflare Tunnel
Write-Host ""
Write-Host "  Dang tao URL public..." -ForegroundColor Yellow
Write-Host ""

# Chạy cloudflared, capture output để tìm URL
$tunnelProcess = Start-Process -FilePath $cloudflared -ArgumentList "tunnel", "--url", "http://localhost:3000" -PassThru -NoNewWindow -RedirectStandardOutput "tunnel.log" -RedirectStandardError "tunnel-err.log"

# Đợi và đọc log để tìm URL
Start-Sleep -Seconds 5
$urlFound = $false
$attempts = 0
while (-not $urlFound -and $attempts -lt 30) {
    Start-Sleep -Seconds 2
    $logContent = Get-Content "tunnel.log" -ErrorAction SilentlyContinue
    $errContent = Get-Content "tunnel-err.log" -ErrorAction SilentlyContinue
    $allContent = $logContent + $errContent

    foreach ($line in $allContent) {
        if ($line -match "https://[a-z0-9-]+\.trycloudflare\.com") {
            $publicUrl = $matches[0]
            $urlFound = $true

            # Cập nhật .public-url file
            $publicUrl | Out-File -FilePath ".public-url" -Encoding utf8 -NoNewline

            Write-Host ""
            Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Green
            Write-Host "║   ✅ NEXUS AI DANG CHAY!                             ║" -ForegroundColor Green
            Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Green
            Write-Host ""
            Write-Host "  Local:  http://localhost:3000" -ForegroundColor Cyan
            Write-Host "  Public: $publicUrl" -ForegroundColor Green
            Write-Host ""
            Write-Host "  📋 Chia se URL public cho thanh vien:" -ForegroundColor Yellow
            Write-Host "     $publicUrl" -ForegroundColor White
            Write-Host ""
            Write-Host "  ✉ Link trong email se tu dong dung URL nay." -ForegroundColor Yellow
            Write-Host ""
            Write-Host "  Nhan Ctrl+C de dung." -ForegroundColor Cyan
            Write-Host ""
            break
        }
    }
    $attempts++
}

if (-not $urlFound) {
    Write-Host ""
    Write-Err "Khong tao duoc URL tunnel. Kiem tra tunnel.log"
    Write-Host "  Server van chay tai: http://localhost:3000" -ForegroundColor Yellow
}

# Giữ script chạy
try {
    while ($true) {
        Start-Sleep -Seconds 3600
    }
} finally {
    # Cleanup
    Stop-Job $serverJob -ErrorAction SilentlyContinue
    Stop-Process $tunnelProcess -ErrorAction SilentlyContinue
    Remove-Job $serverJob -ErrorAction SilentlyContinue
}
