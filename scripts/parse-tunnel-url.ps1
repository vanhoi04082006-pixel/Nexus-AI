# NEXUS AI - Tunnel URL Parser
# Chay boi run-local.bat
# Doc tunnel.log, tim URL trycloudflare.com, ghi vao tunnel-url.txt

if (Test-Path tunnel.log) {
    $content = Get-Content tunnel.log -Raw -ErrorAction SilentlyContinue
    if ($content -and $content -match 'https://[a-z0-9-]+\.trycloudflare\.com') {
        $url = $matches[0]
        $url | Out-File -FilePath tunnel-url.txt -Encoding ascii -NoNewline
        Write-Host "URL found: $url"
    } else {
        # Thu tim bat ky URL https nao
        if ($content -match 'https://[^\s"]+') {
            $url = $matches[0]
            $url | Out-File -FilePath tunnel-url.txt -Encoding ascii -NoNewline
            Write-Host "URL found: $url"
        } else {
            Write-Host "No URL found in tunnel.log"
        }
    }
} else {
    Write-Host "tunnel.log not found"
}
