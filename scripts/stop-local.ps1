<#
Stop the processes started by start-local.ps1 / setup.ps1 (PIDs in data/runtime).
  .\scripts\stop-local.ps1          # web + ml + portable DB
  .\scripts\stop-local.ps1 -KeepDb  # keep the portable DB running
#>
param([switch]$KeepDb)
$Root = Split-Path -Parent $PSScriptRoot
$run = Join-Path $Root 'data/runtime'
$names = @('web', 'ml') + $(if ($KeepDb) { @() } else { @('db') })
foreach ($name in $names) {
  $pidFile = Join-Path $run "$name.pid"
  if (-not (Test-Path $pidFile)) { continue }
  $id = [int](Get-Content $pidFile)
  if (Get-Process -Id $id -ErrorAction SilentlyContinue) { Stop-Process -Id $id -Force; Write-Host "$name stopped (PID $id)" }
  Remove-Item $pidFile -Force
}
