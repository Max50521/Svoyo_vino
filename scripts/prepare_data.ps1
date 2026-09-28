<#
Unpack the organizer dataset archive into data/raw.
  .\scripts\prepare_data.ps1 -DatasetZip "C:\path\Датасет.zip"
Result:
  data/raw/strapi_output0709.csv
  data/raw/eval/                  (organizer eval kit)
  data/raw/strapi/.../uploads     (catalog photos)
#>
param([Parameter(Mandatory = $true)][string]$DatasetZip, [string]$SevenZipPath="")
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Raw = Join-Path $Root "data\raw"
$SevenZip = @("$env:ProgramFiles\7-Zip\7z.exe", "${env:ProgramFiles(x86)}\7-Zip\7z.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($SevenZipPath) { $SevenZip=$SevenZipPath }
if (-not $SevenZip) { throw "7-Zip not found: install from https://www.7-zip.org/" }

New-Item -ItemType Directory -Force $Raw | Out-Null
$tmp = Join-Path $Raw "_zip"
& $SevenZip x -y "-o$tmp" $DatasetZip | Out-Null
if ($LASTEXITCODE -ne 0) { throw "failed to unpack $DatasetZip" }

$inner = Get-ChildItem $tmp -Recurse -File
Move-Item -Force ($inner | Where-Object Name -like "*.csv").FullName (Join-Path $Raw "strapi_output0709.csv")
& $SevenZip x -y "-o$(Join-Path $Raw 'eval')" ($inner | Where-Object Name -eq "eval.zip").FullName -x!__MACOSX | Out-Null
$part1 = ($inner | Where-Object Name -like "*.part1.rar").FullName
& $SevenZip x -y "-o$(Join-Path $Raw 'strapi')" $part1 | Out-Null
if ($LASTEXITCODE -gt 1) { throw "failed to unpack $part1" }
if ($LASTEXITCODE -eq 1) { Write-Warning 'Archive extracted with warnings. Check the 7-Zip log.' }
$testZip=$inner | Where-Object Name -eq 'Тестовые фото.zip' | Select-Object -First 1
if ($testZip) {
  & $SevenZip x -y "-o$(Join-Path $Root 'eval/real/photos')" $testZip.FullName -x!__MACOSX | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Failed to extract real test photos' }
}
$resolvedTemp=[IO.Path]::GetFullPath($tmp)
$allowedRoot=[IO.Path]::GetFullPath($Raw).TrimEnd('\')+'\'
if (!$resolvedTemp.StartsWith($allowedRoot,[StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe temporary path' }
Remove-Item -LiteralPath $resolvedTemp -Recurse -Force
Write-Host "Dataset unpacked to $Raw"
