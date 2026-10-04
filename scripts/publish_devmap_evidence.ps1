# v322 - REBUILD and PUBLISH the Developers-by-area index WITH THE EVIDENCE (price by year, last 12 months, ready / off-plan, apartments / villas, size).
# KENDALL RUNS THIS (it writes production KV). Claude has run it only with -DryRun, which writes nothing.
#   powershell -File scripts\publish_devmap_evidence.ps1 [-DryRun] [-Cards <cov_cards dir>] [-Shares <dld_tier_shares json>] [-Slugs <off-plan districts>] [-Work <dir>]
# What it does, in order (stops at the first failure and prints the real error):
#   1  reads the LIVE inputs (read-only) and BACKS UP the live img_devmap_index to <Work>\devmap_index.backup.json, plus a second copy in <Work>\..\devmap_backups
#   2  asks the lake (read-only, one short query) for the register's home-sale counts per district
#   3  first build (the same index as today, plus the project-to-developer map), then the evidence from the lake, then the final build WITH the evidence
#   4  checks: the old numbers are untouched (every developer's building cells equal the first build), the evidence is on at least 30 areas, the file is under 1.5 MB, the area count did not fall
#   5  puts img_devmap_index and reads it back
# Never run between 04:00 and 06:15 Dubai, nor while Najma_Daily_Refresh or Najma_Avail_Sweep is Running (Test-QuietWindow stops it). The old page keeps working with the new index (extra fields are ignored);
# the new page (v322) is deployed separately by the usual one deploy queue, and it works with the old index too (no window toggle until the evidence is there).
param([string]$Cards = "C:\Users\kwils\AppData\Local\Temp\claude\C--Users-kwils-Downloads\cfd69a2f-a784-4bee-87d0-17cb12cabffb\scratchpad\cov_cards",
      [string]$Shares = "C:\Users\kwils\AppData\Local\Temp\claude\C--Users-kwils-Downloads\cfd69a2f-a784-4bee-87d0-17cb12cabffb\scratchpad\shares.json",
      [string]$Slugs = "majan,madinatalmataar,jabalalifirst,alkhairanfirst,alhebiahfifth,dubaiinvestmentparkfirst,dubaiinvestmentparksecond,alyelayiss1,alyelayiss2,alyufrah1,wadialsafa4,wadialsafa5,palmdeira",
      [string]$Work = "", [switch]$DryRun)
$Here = if (Test-Path "$PSScriptRoot\build_devmap_index.mjs") { $PSScriptRoot } else { "C:\Dev\_evidence_v322\scripts" }
. "$Here\_kv_common.ps1"
Test-QuietWindow
if (-not $Work) { $Work = Join-Path $env:TEMP ("devmap_evidence_" + (Get-Date -Format "yyyyMMdd_HHmmss")) }
$um = Join-Path $Work "um"; New-Item -ItemType Directory -Force $um | Out-Null
$bk = Join-Path (Split-Path -Parent $Work) "devmap_backups"; New-Item -ItemType Directory -Force $bk | Out-Null
Write-Host "1/5 reading live inputs (read-only) and backing up the live index"
foreach ($k in "districts_geo", "map_prices", "rent_index") { Read-Live "img_$k" "$Work\$k.json" }
Read-Live "img_ejari_projects_index" "$Work\ejari_projects_index.json" -AllowMissing
Read-Live "img_devmap_index" "$Work\devmap_index.backup.json"
Copy-Item "$Work\devmap_index.backup.json" (Join-Path $bk ("img_devmap_index_before_evidence_" + (Get-Date -Format "yyyyMMdd_HHmmss") + ".json"))
$geo = Get-Content "$Work\districts_geo.json" -Raw | ConvertFrom-Json
foreach ($d in $geo.districts) { Read-Live "img_unitmix_$($d.slug)" "$um\um_$($d.slug).raw" -AllowMissing }
Write-Host "2/5 register counts from the lake (read-only)"
& python "$Here\build_area_register_counts.py" --geo "$Work\districts_geo.json" --out "$Work\area_register.json"
if ($LASTEXITCODE -ne 0) { Stop-Here "the register counts failed (message above)" }
Write-Host "3/5 building: first pass, evidence from the lake, final pass"
$common = @("--um", $um, "--prices", "$Work\map_prices.json", "--rent", "$Work\rent_index.json", "--geo", "$Work\districts_geo.json", "--shares", $Shares, "--register", "$Work\area_register.json", "--offplan", $Cards, "--offplan-slugs", $Slugs)
if (Test-Path "$Work\ejari_projects_index.json") { $common += @("--ejari", "$Work\ejari_projects_index.json") }
& node "$Here\build_devmap_index.mjs" @common --projdev-out "$Work\projdev.json" --out "$Work\devmap_index.first.json"
if ($LASTEXITCODE -ne 0) { Stop-Here "the first index build failed (message above)" }
& python "$Here\build_area_evidence.py" --geo "$Work\districts_geo.json" --projdev "$Work\projdev.json" --out "$Work\area_evidence.json"
if ($LASTEXITCODE -ne 0) { Stop-Here "the evidence build failed (message above)" }
$out = "$Work\devmap_index.new.json"
& node "$Here\build_devmap_index.mjs" @common --evidence "$Work\area_evidence.json" --out $out
if ($LASTEXITCODE -ne 0) { Stop-Here "the final index build failed (message above)" }
Write-Host "4/5 checks"
& node "$Here\check_devmap_evidence.mjs" "$Work\devmap_index.first.json" $out "$Work\devmap_index.backup.json"
if ($LASTEXITCODE -ne 0) { Stop-Here "the checks failed (message above): nothing was published" }
$n = [int](& node -e "console.log(Object.keys(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).areas).length)" $out)
if ($DryRun) { Write-Host "DRY RUN: nothing written to the live store. New index: $out ($([math]::Round((Get-Item $out).Length/1KB)) KB; the live one is $([math]::Round((Get-Item "$Work\devmap_index.backup.json").Length/1KB)) KB)"; exit 0 }
Write-Host "5/5 putting"
Put-Kv "img_devmap_index" $out
Verify-Kv "img_devmap_index" $n "Object.keys(j.areas).length"
Write-Host ""; Write-Host "DONE. To roll back (from $script:WORKER):"
Write-Host "  npx wrangler kv key put img_devmap_index --path `"$Work\devmap_index.backup.json`" --env $script:ENVN --namespace-id $script:NS"
