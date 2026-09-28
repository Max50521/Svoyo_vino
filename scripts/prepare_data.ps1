<#
Unpack the organizer dataset into data/raw.
  .\scripts\prepare_data.ps1 -DatasetZip "C:\path\Датасет.zip"
  .\scripts\prepare_data.ps1 -DatasetDir "C:\path\Датасет"     # the same archive already extracted:
                                                               # strapi_output0709.csv, eval.zip, prod-svoe-vino-strapi.part1.rar, ...
Result:
  data/raw/strapi_output0709.csv
  data/raw/eval/                  (organizer eval kit)
  data/raw/strapi/.../uploads     (catalog photos)
  eval/real/photos/               (public field photos, when the archive has them)
#>
param([string]$DatasetZip = "", [string]$DatasetDir = "", [string]$SevenZipPath = "")
$ErrorActionPreference = "Stop"
if (-not $DatasetZip -and -not $DatasetDir) { throw "Pass -DatasetZip <archive> or -DatasetDir <extracted folder>" }
$Root = Split-Path -Parent $PSScriptRoot
$Raw = Join-Path $Root "data\raw"
$SevenZip = @("$env:ProgramFiles\7-Zip\7z.exe", "${env:ProgramFiles(x86)}\7-Zip\7z.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($SevenZipPath) { $SevenZip = $SevenZipPath }
if (-not $SevenZip) { throw "7-Zip not found: install from https://www.7-zip.org/ (winget install 7zip.7zip)" }

New-Item -ItemType Directory -Force $Raw | Out-Null
$tmp = $null
if ($DatasetZip) {
  $tmp = Join-Path $Raw "_zip"
  & $SevenZip x -y "-o$tmp" $DatasetZip | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "failed to unpack $DatasetZip" }
  $inner = Get-ChildItem $tmp -Recurse -File
}
else {
  if (-not (Test-Path $DatasetDir)) { throw "Dataset folder not found: $DatasetDir" }
  $inner = Get-ChildItem $DatasetDir -Recurse -File
}

$csv = $inner | Where-Object Name -like "*.csv" | Select-Object -First 1
if (-not $csv) { throw "strapi_output*.csv not found in the dataset" }
Copy-Item -Force $csv.FullName (Join-Path $Raw "strapi_output0709.csv")
$evalZip = $inner | Where-Object Name -eq "eval.zip" | Select-Object -First 1
if ($evalZip) {
  & $SevenZip x -y "-o$(Join-Path $Raw 'eval')" $evalZip.FullName -x!__MACOSX | Out-Null
}
$part1 = ($inner | Where-Object Name -like "*.part1.rar" | Select-Object -First 1).FullName
if (-not $part1) { throw "catalog photo archive (*.part1.rar) not found" }
& $SevenZip x -y "-o$(Join-Path $Raw 'strapi')" $part1 | Out-Null
if ($LASTEXITCODE -gt 1) { throw "failed to unpack $part1" }
if ($LASTEXITCODE -eq 1) { Write-Warning 'Archive extracted with warnings. Check the 7-Zip log.' }
$photos = $inner | Where-Object { $_.Name -in @('Тестовые фото.zip', 'Реальные фото.zip') } | Select-Object -First 1
if ($photos) {
  & $SevenZip x -y "-o$(Join-Path $Root 'eval/real/photos')" $photos.FullName -x!__MACOSX | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Failed to extract real test photos' }
}
if ($tmp) {
  $resolvedTemp = [IO.Path]::GetFullPath($tmp)
  $allowedRoot = [IO.Path]::GetFullPath($Raw).TrimEnd('\') + '\'
  if (!$resolvedTemp.StartsWith($allowedRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe temporary path' }
  Remove-Item -LiteralPath $resolvedTemp -Recurse -Force
}
$count = (Get-ChildItem (Join-Path $Raw 'strapi') -Recurse -File).Count
Write-Host "Dataset unpacked to $Raw ($count catalog files)"
