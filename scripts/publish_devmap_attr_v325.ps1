# v325 - REBUILD and PUBLISH the Developers-by-area index with the REGISTER FIRST (developer attribution fix), with a backup of the live index and a roll-back line.
# Kendall, 4 Oct 2026: Town Square showed Imtiaz with a project called Symphony (the register says Nshama). Audit: developer attribution WAS systemically wrong in two places
# (the register-built cards used the Arabic master name; the 12-month evidence tied developers to projects by NAME only). This script publishes the fixed index.
# KENDALL RUNS THIS (it writes production KV). Claude has NOT run it. Dry run first:   powershell -File scripts\publish_devmap_attr_v325.ps1 -DryRun
#   powershell -File scripts\publish_devmap_attr_v325.ps1 [-DryRun] [-Cards <cov_cards dir>] [-Shares <dld_tier_shares json>] [-Slugs <off-plan districts>] [-Work <dir>]
# What it does (stops at the first failure, prints the real error):
#   0  refuses to run 04:00-06:15 Dubai time, or while Najma_Daily_Refresh / Najma_Avail_Sweep is Running
#   1  reads the LIVE inputs (read-only) and BACKS UP the live img_devmap_index to <Work>\devmap_index.backup.json (plus a second copy in <Work>\..\devmap_backups)
#   2  lake (read-only): register home-sale counts per district, and the REGISTER'S developer for every building name (build_register_projdev.py -> regdev.json)
#   3  first build (writes the project-to-developer map), evidence from the lake (register first), final build with profile, evidence and regdev
#   4  checks: the v323 checks, then the ATTRIBUTION GUARD on the new index (register contradicts at most 1% of listed sales): nothing is published if it fails
#   5  puts img_devmap_index (no --remote flag: wrangler 3.114.17 rejects it), reads it back, checks the LIVE index again with the v323 check and the guard
# The index carries new optional fields (q, q12: sales verified by the register / matched by project name). The OLD page ignores them; the NEW page (worker v325, deployed
# separately through the one deploy queue) shows "matched by project name". The order of index and worker does not matter.
# Roll-back line is printed at the end.
param([string]$Cards = "C:\Users\kwils\AppData\Local\Temp\claude\C--Users-kwils-Downloads\cfd69a2f-a784-4bee-87d0-17cb12cabffb\scratchpad\cov_cards",
      [string]$Shares = "C:\Users\kwils\AppData\Local\Temp\claude\C--Users-kwils-Downloads\cfd69a2f-a784-4bee-87d0-17cb12cabffb\scratchpad\shares.json",
      [string]$Slugs = "majan,madinatalmataar,jabalalifirst,alkhairanfirst,alhebiahfifth,dubaiinvestmentparkfirst,dubaiinvestmentparksecond,alyelayiss1,alyelayiss2,alyufrah1,wadialsafa4,wadialsafa5,palmdeira",
      [string]$Work = "", [switch]$DryRun, [switch]$SkipGate)
$Here = if (Test-Path "$PSScriptRoot\build_devmap_index.mjs") { $PSScriptRoot } else { "C:\Dev\_attr_v325\scripts" }
. "$Here\_kv_common.ps1"
$dub = [TimeZoneInfo]::ConvertTimeBySystemTimeZoneId((Get-Date), "Arabian Standard Time")
$mins = $dub.Hour * 60 + $dub.Minute
if ($mins -ge 240 -and $mins -lt 375) { Stop-Here "it is $($dub.ToString('HH:mm')) Dubai: the 04:00-06:15 morning chain window. Run this after 06:15." }
Test-QuietWindow
if (-not $Work) { $Work = Join-Path $env:TEMP ("devmap_attr_v325_" + (Get-Date -Format "yyyyMMdd_HHmmss")) }
$um = Join-Path $Work "um"; New-Item -ItemType Directory -Force $um | Out-Null
$bk = Join-Path (Split-Path -Parent $Work) "devmap_backups"; New-Item -ItemType Directory -Force $bk | Out-Null
Write-Host "Work folder (the backup of the live index will be here): $Work"
Write-Host "1/5 reading live inputs (read-only) and backing up the live index"
foreach ($k in "districts_geo", "map_prices", "rent_index") { Read-Live "img_$k" "$Work\$k.json" }
Read-Live "img_district_polygons" "$Work\district_polygons.json"
& node "$Here\merge_districts_geo.mjs" "$Work\districts_geo.json" "$Work\district_polygons.json" "$Work\districts_geo_all.json"
if ($LASTEXITCODE -ne 0) { Stop-Here "merging the district list failed (message above)" }
Read-Live "img_ejari_projects_index" "$Work\ejari_projects_index.json" -AllowMissing
Read-Live "img_devmap_index" "$Work\devmap_index.backup.json"
Copy-Item "$Work\devmap_index.backup.json" (Join-Path $bk ("img_devmap_index_before_v325_" + (Get-Date -Format "yyyyMMdd_HHmmss") + ".json"))
$geo = Get-Content "$Work\districts_geo_all.json" -Raw | ConvertFrom-Json
foreach ($d in $geo.districts) { Read-Live "img_unitmix_$($d.slug)" "$um\um_$($d.slug).raw" -AllowMissing }
Write-Host "2/5 register counts and the register's developer per building name (lake, read-only)"
& python "$Here\build_area_register_counts.py" --geo "$Work\districts_geo_all.json" --out "$Work\area_register.json"
if ($LASTEXITCODE -ne 0) { Stop-Here "the register counts failed (message above)" }
& python "$Here\build_register_projdev.py" --register "$Work\area_register.json" --out "$Work\regdev.json"
if ($LASTEXITCODE -ne 0) { Stop-Here "the register developer map failed (message above)" }
Write-Host "3/5 building: first pass, evidence from the lake (register first), final pass"
$common = @("--um", $um, "--prices", "$Work\map_prices.json", "--rent", "$Work\rent_index.json", "--geo", "$Work\districts_geo_all.json", "--shares", $Shares, "--register", "$Work\area_register.json", "--offplan", $Cards, "--offplan-slugs", $Slugs, "--regdev", "$Work\regdev.json")
if (Test-Path "$Work\ejari_projects_index.json") { $common += @("--ejari", "$Work\ejari_projects_index.json") }
& node "$Here\build_devmap_index.mjs" @common --projdev-out "$Work\projdev.json" --out "$Work\devmap_index.first.json"
if ($LASTEXITCODE -ne 0) { Stop-Here "the first index build failed (message above)" }
& python "$Here\build_area_evidence.py" --geo "$Work\districts_geo_all.json" --projdev "$Work\projdev.json" --out "$Work\area_evidence.json"
if ($LASTEXITCODE -ne 0) { Stop-Here "the evidence build failed (message above)" }
$out = "$Work\devmap_index.new.json"
& node "$Here\build_devmap_index.mjs" @common --evidence "$Work\area_evidence.json" --out $out
if ($LASTEXITCODE -ne 0) { Stop-Here "the final index build failed (message above)" }
Write-Host "4/5 checks"
& node "$Here\check_devmap_evidence.mjs" "$Work\devmap_index.first.json" $out "$Work\devmap_index.backup.json"
if ($LASTEXITCODE -ne 0) { Stop-Here "the evidence checks failed (message above): nothing was published" }
& node "$Here\check_devmap_all_v323.mjs" $out --min-areas 40
if ($LASTEXITCODE -ne 0) { Stop-Here "the index is missing something it must carry, or holds fewer than 40 areas (message above): nothing was published" }
& python "$Here\guard_devmap_attribution.py" --index $out --register "$Work\area_register.json" --out "$Work\guard_new.json"
if ($LASTEXITCODE -ne 0) { Stop-Here "the attribution guard failed on the NEW index (message above): nothing was published" }
$n = [int](& node -e "console.log(Object.keys(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).areas).length)" $out)
$nd = [int](& node -e "console.log(Object.keys(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).devs).length)" $out)
if ($n -lt 40) { Stop-Here "the new index holds only $n areas: a failed build is not published" }
# v397g HARD STOP: the completeness gate (scripts\gate_guard.py) runs with the new file substituted for its layer and must pass before anything is written; -SkipGate publishes UNGATED and says so loudly
$gg = Join-Path $PSScriptRoot "gate_guard.py"
if ($SkipGate) { $skipMsg = "!!! COMPLETENESS GATE SKIPPED (-SkipGate): THIS PUBLISH IS UNGATED. Nothing has checked that it keeps every fixture and surface. !!!"; Write-Host $skipMsg -ForegroundColor Red; [Console]::Error.WriteLine($skipMsg) }
elseif (-not (Test-Path $gg)) { Stop-Here "scripts\gate_guard.py is missing: refusing to publish without the completeness gate (-SkipGate overrides it, loudly)" }
else {
  $ggArgs = @("--layer", "index", "--file", "$out"); if ($DryRun) { $ggArgs += "--dry-run" }
  & python $gg @ggArgs
  if ($LASTEXITCODE -ne 0) { if ($DryRun) { Write-Host "DRY RUN: the completeness gate WOULD BLOCK this publish (table above)." -ForegroundColor Yellow } else { Stop-Here "the COMPLETENESS GATE blocked the publish (table above): nothing was written. -SkipGate overrides it, loudly." } }
}
if ($DryRun) { Write-Host "DRY RUN: nothing written to the live store. New index: $out ($n areas, $nd developers, $([math]::Round((Get-Item $out).Length/1KB)) KB; the live one is $([math]::Round((Get-Item "$Work\devmap_index.backup.json").Length/1KB)) KB)"; exit 0 }
Write-Host "5/5 putting"
Put-Kv "img_devmap_index" $out
Verify-Kv "img_devmap_index" $n "Object.keys(j.areas).length"
Read-Live "img_devmap_index" "$Work\devmap_index.live_after.json"
& node "$Here\check_devmap_all_v323.mjs" "$Work\devmap_index.live_after.json" --min-areas 40
$c1 = $LASTEXITCODE
& python "$Here\guard_devmap_attribution.py" --index "$Work\devmap_index.live_after.json" --register "$Work\area_register.json"
$c2 = $LASTEXITCODE
if ($c1 -ne 0 -or $c2 -ne 0) {
  Write-Host "THE LIVE INDEX FAILED A CHECK. Roll back now (from $script:WORKER):" -ForegroundColor Red
  Write-Host "  npx wrangler kv key put img_devmap_index --path `"$Work\devmap_index.backup.json`" --env $script:ENVN --namespace-id $script:NS"
  exit 1
}
Write-Host ""; Write-Host "DONE. To roll back (from $script:WORKER):"
Write-Host "  npx wrangler kv key put img_devmap_index --path `"$Work\devmap_index.backup.json`" --env $script:ENVN --namespace-id $script:NS"
