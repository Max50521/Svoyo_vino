param([string]$NodeExe='node', [switch]$PortableDb, [switch]$NoWait)
$ErrorActionPreference='Stop'
$Root=Split-Path -Parent $PSScriptRoot
Set-Location $Root
if (!(Test-Path .env)) { throw 'Copy .env.example to .env and configure first.' }
Get-Content .env | ForEach-Object {
  if ($_ -match '^\s*([A-Z_][A-Z_0-9]*)\s*=\s*(.*?)\s*$') {
    $value=$Matches[2] -replace '\s+#.*$',''
    [Environment]::SetEnvironmentVariable($Matches[1],$value.Trim('"').Trim("'"),'Process')
  }
}
$env:PYTHONUTF8='1'
$env:HF_HUB_OFFLINE='1'
$run=Join-Path $Root 'data/runtime'
New-Item -ItemType Directory -Force $run | Out-Null
function Running($port) { return [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue) }
function Launch($name,$exe,$argv) {
  $p=Start-Process -FilePath $exe -ArgumentList $argv -WorkingDirectory $Root -WindowStyle Hidden -PassThru -RedirectStandardOutput "$run/$name.log" -RedirectStandardError "$run/$name-error.log"
  $p.Id | Set-Content "$run/$name.pid"
  Write-Host "$name started (PID $($p.Id))"
}
if ($PortableDb -and !(Running 5433)) { Launch 'db' $NodeExe @('tools/local-db/server.mjs') }
if ($env:ENGINE -ne 'stub' -and !(Running 8001)) { Launch 'ml' (Join-Path $Root 'ml/.venv/Scripts/python.exe') @('-m','uvicorn','wine_ml.service:app','--host','127.0.0.1','--port','8001') }
if (!(Running 8080)) { Launch 'web' $NodeExe @('web/.output/server/index.mjs') }
if (!$NoWait) {
  $ready=$false
  for ($i=0;$i -lt 120;$i++) {
    try { $r=Invoke-RestMethod 'http://127.0.0.1:8080/ready' -TimeoutSec 5; if ($r.ready) {$ready=$true;break} } catch {}
    Start-Sleep -Seconds 1
  }
  if (!$ready) { throw "Readiness failed. See $run logs and GET /ready." }
}
Write-Host 'Open http://127.0.0.1:8080'
