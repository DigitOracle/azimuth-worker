# v339 - publish img_devmap_delivery: delivery status of each developer's projects in each area, and the homes coming in each area, from the Dubai Land Department project register.
# The investor PDF (/developers_pdf?kind=investor) reads this key; without it the delivery and supply cards are simply left out. Nothing else reads it.
# KENDALL RUNS THIS (it writes production KV). Claude has run it only with -DryRun, which writes nothing.   Dry run first:
#   powershell -File scripts\publish_devmap_delivery.ps1 -DryRun
#   powershell -File scripts\publish_devmap_delivery.ps1 [-DryRun] [-Register <dld__projects csv>] [-Work <dir>] [-Index <local devmap_index.json, instead of the live one>]
# What it does (it stops at the first failure and prints the real error from wrangler or node):
#   0  refuses to run 04:00-06:15 Dubai time or while Najma_Daily_Refresh / Najma_Avail_Sweep is Running (a dry run skips this: it writes nothing)
#   1  reads the LIVE img_devmap_index (read-only; it carries the register's area names) and the live img_devmap_delivery if there is one, which is BACKED UP to <Work> and <Work>\..\devmap_backups
#   2  builds the value with scripts\build_devmap_delivery.mjs from the register file
#   3  validates it (scripts\check_devmap_delivery.mjs): size, areas, developer-in-area records, projects counted, spot checks (Sobha in Sobha Hartland, Binghatti in JVC, Azizi), percent range; nothing is published if one fails
#   4  puts img_devmap_delivery (cmd /c, output shown and logged, no --remote flag: wrangler 3.114.17 rejects it), reads it back and compares the count
# The roll-back command is printed at the end (the first publish has no earlier value: roll back by deleting the key).
param([string]$Register = "C:\Dev\naj-market-pulse\data\raw_downloads\dd\dld__projects__2026-10-02.csv", [string]$Work = "", [string]$Index = "", [switch]$DryRun)
$Here = if (Test-Path "$PSScriptRoot\_kv_common.ps1") { $PSScriptRoot } else { "C:\Dev\_inv339\scripts" }
. "$Here\_kv_common.ps1"
$script:REPO = Split-Path -Parent $Here
if (-not $DryRun) {
  $dub = [TimeZoneInfo]::ConvertTimeBySystemTimeZoneId((Get-Date), "Arabian Standard Time"); $mins = $dub.Hour * 60 + $dub.Minute
  if ($mins -ge 240 -and $mins -lt 375) { Stop-Here "it is $($dub.ToString('HH:mm')) Dubai: the 04:00-06:15 morning chain window. Run this after 06:15." }
  Test-QuietWindow
}
if (-not (Test-Path $Register)) { Stop-Here "the register file is not there: $Register" }
if (-not $Work) { $Work = Join-Path $env:TEMP ("devmap_delivery_" + (Get-Date -Format "yyyyMMdd_HHmmss")) }
New-Item -ItemType Directory -Force $Work | Out-Null
$bk = Join-Path (Split-Path -Parent $Work) "devmap_backups"; New-Item -ItemType Directory -Force $bk | Out-Null
Write-Host "Work folder: $Work"
Write-Host "1/4 reading live inputs (read-only) and backing up any live delivery value"
if ($Index) { if (-not (Test-Path $Index)) { Stop-Here "the index file is not there: $Index" }; Copy-Item $Index "$Work\devmap_index.json"; Write-Host "  using the local index file $Index (instead of reading the live one)" } else { Read-Live "img_devmap_index" "$Work\devmap_index.json" }
$hadLive = $false
Read-Live "img_devmap_delivery" "$Work\devmap_delivery.backup.json" -AllowMissing
if (Test-Path "$Work\devmap_delivery.backup.json") { $hadLive = $true; Copy-Item "$Work\devmap_delivery.backup.json" (Join-Path $bk ("img_devmap_delivery_before_v339_" + (Get-Date -Format "yyyyMMdd_HHmmss") + ".json")); Write-Host "  backed up the live value" } else { Write-Host "  no live value yet (first publish)" }
Write-Host "2/4 building from $Register"
$out = "$Work\devmap_delivery.new.json"
& node "$Here\build_devmap_delivery.mjs" "$Work\devmap_index.json" $Register $out
if ($LASTEXITCODE -ne 0) { Stop-Here "the build failed (message above)" }
Write-Host "3/4 checks"
& node "$Here\check_devmap_delivery.mjs" $out
if ($LASTEXITCODE -ne 0) { Stop-Here "the delivery value failed a check (message above): nothing was published" }
$n = [int](& node -e "console.log(Object.keys(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).by).length)" $out)
$na = [int](& node -e "console.log(Object.keys(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).area).length)" $out)
$rb = if ($hadLive) { "npx wrangler kv key put img_devmap_delivery --path `"$Work\devmap_delivery.backup.json`" --env $script:ENVN --namespace-id $script:NS" } else { "npx wrangler kv key delete img_devmap_delivery --env $script:ENVN --namespace-id $script:NS" }
if ($DryRun) {
  Write-Host ""; Write-Host "DRY RUN: nothing written to the live store. New value: $out ($na areas, $n developer-in-area records, $([math]::Round((Get-Item $out).Length/1KB)) KB)"
  Write-Host "Roll-back command it would print (from $script:WORKER):"; Write-Host "  $rb"; exit 0
}
Write-Host "4/4 putting"
Put-Kv "img_devmap_delivery" $out
Verify-Kv "img_devmap_delivery" $n "Object.keys(j.by).length"
Write-Host ""; Write-Host "DONE. To roll back (from $script:WORKER):"; Write-Host "  $rb"
