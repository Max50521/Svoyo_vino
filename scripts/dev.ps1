<#
Run the service locally: Postgres in docker, ml + web on the host (GPU without docker/WSL fuss).
  .\scripts\dev.ps1            # ENGINE=vector (real recognition)
  .\scripts\dev.ps1 -Stub      # web only, fake engine (no ml/model needed)
  .\scripts\dev.ps1 -Prod      # built Nuxt server instead of dev server (for latency measurements)
API: http://127.0.0.1:8080  (POST /v1/eval/predict, POST /v1/search, GET /v1/wines/:slug, GET /health)
#>
param([switch]$Stub, [switch]$Prod)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (Test-Path .env) {
  Get-Content .env | ForEach-Object {
    if ($_ -match '^\s*([A-Z_][A-Z_0-9]*)\s*=\s*(.*?)\s*$') {
      [Environment]::SetEnvironmentVariable($Matches[1], ($Matches[2] -replace '\s+#.*$','').Trim('"'), 'Process')
    }
  }
}
if (-not $Stub) {
  docker compose up -d --wait db
  if ($LASTEXITCODE -ne 0) { throw "failed to start Postgres (is Docker Desktop running?)" }
}

if (!$env:ML_URL) { $env:ML_URL='http://127.0.0.1:8001' }
$env:HF_HUB_OFFLINE = "1"   # model is already cached by setup; avoids slow network checks
$ml = $null
if (-not $Stub) {
  $ml = Start-Process -PassThru -WindowStyle Hidden -FilePath "ml\.venv\Scripts\python.exe" `
    -ArgumentList "-m", "uvicorn", "wine_ml.service:app", "--host", "127.0.0.1", "--port", "8001"
  Write-Host "ml service starting (pid $($ml.Id)), loading model..."
  $mlReady=$false
  for ($i=0; $i -lt 120; $i++) {
    try { $r=Invoke-RestMethod "$env:ML_URL/health" -TimeoutSec 2; if ($r.status -eq 'ok') {$mlReady=$true;break} } catch {}
    Start-Sleep -Seconds 1
  }
  if (!$mlReady) { Stop-Process -Id $ml.Id -ErrorAction SilentlyContinue; throw 'ML readiness failed' }
}

$env:ENGINE = if ($Stub) { "stub" } else { "vector" }
try {
  Push-Location web
  if ($Prod) {
    npm run build
    $env:PORT = "8080"; $env:CATALOG_IMAGES_DIR = (Join-Path $Root "data\catalog\images")
    node .output/server/index.mjs
  }
  else {
    npm run dev
  }
}
finally {
  Pop-Location
  if ($ml) { Stop-Process -Id $ml.Id -ErrorAction SilentlyContinue }
}
