<#
One-time local setup (Windows, PowerShell). Idempotent: safe to re-run.

  .\scripts\setup.ps1 -DatasetDir "C:\path\Датасет" -PortableDb   # no Docker: PostgreSQL+pgvector in WASM (PGlite)
  .\scripts\setup.ps1 -DatasetZip "C:\path\Датасет.zip"             # Postgres in Docker Desktop
  .\scripts\setup.ps1 -PortableDb                                  # data already unpacked into data/raw
  add -Cpu without an NVIDIA GPU

Needs: Python 3.11+ (3.12 tested), Node 20+ (24 tested), 7-Zip (only to unpack the dataset),
Docker Desktop (only without -PortableDb). First run downloads SigLIP 2 (~4.5 GB) and EasyOCR (~100 MB).
Then start the service with .\scripts\start-local.ps1
#>
param(
  [string]$DatasetZip = "",
  [string]$DatasetDir = "",
  [switch]$PortableDb,
  [switch]$Cpu,
  [string]$Model = "",
  [string]$Python = ""
)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Check() { if ($LASTEXITCODE -ne 0) { throw "command failed with exit code $LASTEXITCODE" } }
function Set-EnvLine($key, $value) {
  $lines = @(Get-Content .env)
  if ($lines -match "^$key=") { $lines = $lines -replace "^$key=.*$", "$key=$value" } else { $lines += "$key=$value" }
  $lines | Set-Content .env -Encoding utf8
}

# ---- tools -------------------------------------------------------------------
function Find-Python {
  if ($Python) { return $Python }
  $candidates = @()
  if (Get-Command py -ErrorAction SilentlyContinue) { $candidates += @('py -3.12', 'py -3.11') }
  $candidates += @("$env:LOCALAPPDATA\Programs\Python\Python312\python.exe", "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe", 'python')
  foreach ($c in $candidates) {
    $exe, $pyArgs = $c -split ' ', 2
    try {
      $ok = & $exe @($pyArgs | Where-Object { $_ }) -c "import sys; print(sys.version_info >= (3, 11))" 2>$null
      if ($ok -eq 'True') { return $c }
    } catch {}
  }
  throw 'Python 3.11+ not found. Install: winget install Python.Python.3.12 (the "python" alias from Microsoft Store does not work)'
}
if (-not (Get-Command node -ErrorAction SilentlyContinue) -and (Test-Path 'C:\Program Files\nodejs\node.exe')) {
  $env:Path = "C:\Program Files\nodejs;$env:Path"
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'Node.js 20+ not found. Install: winget install OpenJS.NodeJS.LTS' }

if (!(Test-Path .env)) { Copy-Item .env.example .env }
$data = ($Root -replace '\\', '/') + '/data'
Set-EnvLine 'HF_HOME' "$data/model-cache"
Set-EnvLine 'EASYOCR_MODULE_PATH' "$data/easyocr"
Set-EnvLine 'CATALOG_IMAGES_DIR' "$data/catalog/images"
if ($PortableDb) {
  Set-EnvLine 'DATABASE_URL' 'postgresql://postgres@127.0.0.1:5433/postgres'
  Set-EnvLine 'DB_POOL_MAX' '1'
}
if ($Cpu) { Set-EnvLine 'DEVICE' 'cpu' }
if ($Model) { Set-EnvLine 'MODEL_NAME' $Model }
Get-Content .env | ForEach-Object {
  if ($_ -match '^\s*([A-Z_][A-Z_0-9]*)\s*=\s*(.*?)\s*$') {
    [Environment]::SetEnvironmentVariable($Matches[1], ($Matches[2] -replace '\s+#.*$', '').Trim('"'), 'Process')
  }
}
$env:PYTHONUTF8 = '1'

if ($DatasetZip -or $DatasetDir) {
  Step "Unpacking dataset"
  & "$PSScriptRoot\prepare_data.ps1" -DatasetZip $DatasetZip -DatasetDir $DatasetDir
}
if (-not (Test-Path 'data\raw\strapi_output0709.csv')) { throw 'data\raw is empty: pass -DatasetDir or -DatasetZip' }
# From here on pip/npm/python write progress and warnings to stderr; with "Stop" Windows PowerShell 5.1
# would treat that as a failure when output is redirected. Failures are checked by exit code (Check).
$ErrorActionPreference = 'Continue'

Step "Python venv (ml/.venv)"
if (-not (Test-Path "ml\.venv\Scripts\python.exe")) {
  $pyCmd = Find-Python
  Write-Host "using $pyCmd"
  $exe, $pyArgs = $pyCmd -split ' ', 2
  & $exe @($pyArgs | Where-Object { $_ }) -m venv ml\.venv; Check
}
$py = "ml\.venv\Scripts\python.exe"
& $py -m pip install -q --upgrade pip; Check
if ($Cpu) {
  & $py -m pip install -q --retries 10 torch --index-url https://download.pytorch.org/whl/cpu; Check
  & $py -m pip install -q --retries 10 -e "ml[dev]"; Check
}
else {
  # exact versions tested on Windows + CUDA 12.8
  & $py -m pip install -q --retries 10 -r requirements-windows-tested.txt --extra-index-url https://download.pytorch.org/whl/cu128; Check
  & $py -m pip install -q -e "ml[dev]" --no-deps; Check
}

Step "Web: dependencies and production build"
Push-Location web; npm ci --no-audit --no-fund; Check; npm run build; Check; Pop-Location

if ($PortableDb) {
  Step "PostgreSQL + pgvector (PGlite, 127.0.0.1:5433)"
  Push-Location tools\local-db; npm ci --no-audit --no-fund; Check; Pop-Location
  if (-not (Get-NetTCPConnection -LocalPort 5433 -State Listen -ErrorAction SilentlyContinue)) {
    New-Item -ItemType Directory -Force data\runtime | Out-Null
    $node = (Get-Command node).Source
    $db = Start-Process -FilePath $node -ArgumentList 'tools/local-db/server.mjs' -WorkingDirectory $Root -WindowStyle Hidden -PassThru `
      -RedirectStandardOutput data\runtime\db.log -RedirectStandardError data\runtime\db-error.log
    $db.Id | Set-Content data\runtime\db.pid
    for ($i = 0; $i -lt 60 -and -not (Get-NetTCPConnection -LocalPort 5433 -State Listen -ErrorAction SilentlyContinue); $i++) { Start-Sleep 1 }
    if (-not (Get-NetTCPConnection -LocalPort 5433 -State Listen -ErrorAction SilentlyContinue)) { throw 'PGlite did not start, see data\runtime\db-error.log' }
  }
}
else {
  Step "Postgres + pgvector (docker)"
  docker compose up -d --wait db; Check
  Get-Content db\migrations\002_views.sql | docker compose exec -T db psql -q -U wine; Check   # no-op on a fresh DB
}

Step "Catalog: unambiguous positions"
& $py ml\scripts\build_catalog.py; Check
& $py ml\scripts\load_catalog.py; Check

Step "Index: SigLIP 2 embeddings -> pgvector (first run downloads the model, ~4.5 GB)"
& $py ml\scripts\build_index.py --batch 8; Check   # views: full + label_mid + label_low; already indexed wines are skipped
& $py ml\scripts\find_twins.py; Check              # data/catalog/twins.csv

Step "OCR models (EasyOCR ru+en, ~100 MB) - downloaded now so the demo works offline"
& $py -c "from wine_ml.ocr import OcrEngine; OcrEngine('cpu')"; Check

$start = if ($PortableDb) { '.\scripts\start-local.ps1 -PortableDb' } else { '.\scripts\start-local.ps1' }
Write-Host "`nDone. Start the service: $start   ->  http://127.0.0.1:8080" -ForegroundColor Green
