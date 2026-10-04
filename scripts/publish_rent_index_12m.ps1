# v314 - PUBLISH the rolling 12-month rent index. KENDALL RUNS THIS (writes production KV). Deploy the v314 worker FIRST.
#   powershell -File scripts\publish_rent_index_12m.ps1 [-Index <reviewed rebuilt file>] [-Rebuild] [-AsOf 2026-10-03] [-Work <dir>] [-DryRun]
# What it does: reads the LIVE img_rent_index (backup), merges the reviewed rebuilt index onto that fresh read (scripts\merge_rent_index_live.mjs: the two Piccadilly Green
# option records p damachillspiccadillygreenk015b / k016b, footprints 2001 / 2002, and anything else with "fp" or "ev_scope" is carried over unchanged; a failed or half-size
# build stops), prints the diff (scripts\rent_index_diff.py), then puts and reads back. -Rebuild re-runs scripts\build_rent_index_12m.py from the lake first (read-only).
# IMPORTANT: the daily chain's own rent step (build_rent_index.py --push) rebuilds the 2-month index and would overwrite this the next time it runs; switch that step to
# scripts\build_rent_index_12m.py (and merge_rent_index_live.mjs) before relying on it.
param([string]$Index = "C:\Users\kwils\AppData\Local\Temp\claude\C--Users-kwils-Downloads\cfd69a2f-a784-4bee-87d0-17cb12cabffb\scratchpad\cov\out\img_rent_index.12m.json",
      [switch]$Rebuild, [string]$AsOf = "", [string]$Work = "", [switch]$DryRun)
. "$PSScriptRoot\_kv_common.ps1"
Test-QuietWindow
if (-not $Work) { $Work = Join-Path $env:TEMP ("rent12m_publish_" + (Get-Date -Format "yyyyMMdd_HHmmss")) }
New-Item -ItemType Directory -Force $Work | Out-Null
$liveF = "$Work\live_rent_index.backup.json"
Write-Host "1/4 reading the live rent index (read-only; this file is the backup)"
Read-Live "img_rent_index" $liveF
if ($Rebuild) {
  if (-not $AsOf) { $AsOf = (Get-Date).AddDays(-1).ToString("yyyy-MM-dd") }
  $Index = "$Work\img_rent_index.12m.json"
  Write-Host "2/4 rebuilding from the lake (read-only), as of $AsOf"
  & python "$PSScriptRoot\build_rent_index_12m.py" --out $Index --as-of $AsOf --live $liveF
  if ($LASTEXITCODE -ne 0) { Stop-Here "the rebuild failed (message above)" }
} else { Write-Host "2/4 using the reviewed file $Index" }
Write-Host "3/4 merging onto the fresh live read"
$final = "$Work\img_rent_index.final.json"
& node "$PSScriptRoot\merge_rent_index_live.mjs" --new $Index --live $liveF --out $final
if ($LASTEXITCODE -ne 0) { Stop-Here "the merge stopped (message above); nothing was written" }
& python "$PSScriptRoot\rent_index_diff.py" $liveF $final
$n = [int](& node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).items.length)" $final)
if ($DryRun) { Write-Host "DRY RUN: nothing written. Final file: $final"; exit 0 }
Write-Host "4/4 putting"
Put-Kv "img_rent_index" $final
Verify-Kv "img_rent_index" $n "j.items.length"
Write-Host ""; Write-Host "DONE. To roll back (from $script:WORKER):"
Write-Host "  npx wrangler kv key put img_rent_index --path `"$liveF`" --env $script:ENVN --namespace-id $script:NS"
