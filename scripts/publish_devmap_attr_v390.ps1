# v390 - the v373 rebuild PLUS the building key bk (scripts\build_devmap_index.mjs: bindKey / attachBk) on every project whose footprint is bound to the register (tx_bindings, or reg_bindings by property id). Dry run first:
#   powershell -File scripts\publish_devmap_attr_v390.ps1 -DryRun   (reads the live store read-only, writes nothing; needs the env var NODE_OPTIONS=--dns-result-order=ipv4first --network-family-autoselection-attempt-timeout=5000)
# v373 - REBUILD and PUBLISH the Developers-by-area index WITH ATTRIBUTION EVIDENCE (Kendall, 7 Oct 2026: the Land Department register is the authority; a developer's own web site is a claim).
# Same pipeline as publish_devmap_all_v327.ps1, built by the v373 code: every project carries its register project number, register developer, match basis and evidence label
# (REGISTER_VERIFIED / NAME_ONLY / DEVELOPER_CLAIMED / UNVERIFIED) and its OWN area (no borrowed community labels); the evidence builder labels the 12-month lists the same way.
# Adds the ATTRIBUTION GATE (scripts\check_attribution_gate.mjs): not more than the configured share of projects off REGISTER_VERIFIED (scripts\attribution_gate.json, start 22%),
# the nine fixtures (Vento Tower and The Pad not verified under Beyond; Marina Vista, Jumeirah Living Marina Gate, Ocean Heights verified; Imtiaz Symphony Tower and Wynwood Horizon in
# Meydan Horizon, Cove Grand in Dubai Land Residence Complex, Westwood By Imtiaz in Al Furjan) and an audit-trail CSV (devmap_index.attribution_audit.csv, kept in the work folder).
# img_devmap_index is a PROTECTED key. KENDALL APPROVES, THEN THIS RUNS. Claude has NOT run it. Dry run first (writes nothing to the live store):
#   powershell -File scripts\publish_devmap_attr_v373.ps1 -DryRun
#   powershell -File scripts\publish_devmap_attr_v373.ps1 [-DryRun] [-Cards <cov_cards dir>] [-Shares <dld_tier_shares json>] [-Slugs <off-plan districts>] [-Work <dir>]
# It stops at the first failure. Roll-back line printed at the end. The v372 worker ignores the new keys (ce, bx, b12x, c12e, attr); the v373 worker reads them, so the order does not matter.
# Needs (all local, read-only): the lake, C:\Dev\naj-market-pulse\data\transactions-2026-*.csv (the community AREA_EN of each project), data\registers\developers\developers_*.csv, data\dev_meta\developer_dna.json.
param([string]$Cards = "C:\Users\kwils\AppData\Local\Temp\claude\C--Users-kwils-Downloads\cfd69a2f-a784-4bee-87d0-17cb12cabffb\scratchpad\cov_cards",
      [string]$Shares = "C:\Users\kwils\AppData\Local\Temp\claude\C--Users-kwils-Downloads\cfd69a2f-a784-4bee-87d0-17cb12cabffb\scratchpad\shares.json",
      [string]$Slugs = "majan,madinatalmataar,jabalalifirst,alkhairanfirst,alhebiahfifth,dubaiinvestmentparkfirst,dubaiinvestmentparksecond,alyelayiss1,alyelayiss2,alyufrah1,wadialsafa4,wadialsafa5,palmdeira",
      [string]$RegBind = "C:\Dev\naj-market-pulse\data\identity\official\dld\reg_bindings.json", [string]$TxBind = "C:\Dev\naj-market-pulse\data\identity\official\dld\tx_bindings.json",
      [string]$Work = "", [switch]$DryRun)
$Here = if (Test-Path "$PSScriptRoot\build_devmap_index.mjs") { $PSScriptRoot } else { "C:\Dev\_clientsheet390\scripts" }
. "$Here\_kv_common.ps1"
$dub = [TimeZoneInfo]::ConvertTimeBySystemTimeZoneId((Get-Date), "Arabian Standard Time")
$mins = $dub.Hour * 60 + $dub.Minute
if ($mins -ge 240 -and $mins -lt 375) { Stop-Here "it is $($dub.ToString('HH:mm')) Dubai: the 04:00-06:15 morning chain window. Run this after 06:15." }
Test-QuietWindow
if (-not $Work) { $Work = Join-Path $env:TEMP ("devmap_attr_v390_" + (Get-Date -Format "yyyyMMdd_HHmmss")) }
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
Copy-Item "$Work\devmap_index.backup.json" (Join-Path $bk ("img_devmap_index_before_v390_" + (Get-Date -Format "yyyyMMdd_HHmmss") + ".json"))
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
$rf = Join-Path (Split-Path -Parent $Here) "data\regfacts\register_facts.json"   # v386 - status, percent complete, planned end, units, unit mix and parcel count of every register project (build_register_facts.py), carried in bx / b12x
if ((Test-Path $RegBind) -and (Test-Path $TxBind)) { $common += @("--regbind", $RegBind, "--txbind", $TxBind); Write-Host "building keys: bindings $RegBind, $TxBind" } else { Write-Host "building keys: no binding files, so only cards with their own transactions binding get a key" }
if (Test-Path $rf) { $common += @("--regfacts", $rf); Write-Host "register facts: $rf" } else { Write-Host "register facts: none (run scripts\build_register_facts.py first); the index is built without them" }
& node "$Here\build_devmap_index.mjs" @common --projdev-out "$Work\projdev.json" --out "$Work\devmap_index.first.json"
if ($LASTEXITCODE -ne 0) { Stop-Here "the first index build failed (message above)" }
& python "$Here\build_area_evidence.py" --geo "$Work\districts_geo_all.json" --projdev "$Work\projdev.json" --out "$Work\area_evidence.json"
if ($LASTEXITCODE -ne 0) { Stop-Here "the evidence build failed (message above)" }
$out = "$Work\devmap_index.new.json"
& node "$Here\build_devmap_index.mjs" @common --evidence "$Work\area_evidence.json" --out $out
if ($LASTEXITCODE -ne 0) { Stop-Here "the final index build failed (message above)" }
Write-Host "building keys (bk): $(& node -e "const j=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));let n=0,t=0;for(const a of Object.values(j.areas))for(const d of Object.values(a.devs))for(const k of ['bx','b12x'])for(const x of d[k]||[]){t++;if(x.bk)n++}console.log(n+' of '+t+' evidence records')" $out)"
Write-Host "4/5 checks"
& node "$Here\check_devmap_evidence.mjs" "$Work\devmap_index.first.json" $out "$Work\devmap_index.backup.json"
if ($LASTEXITCODE -ne 0) { Stop-Here "the evidence checks failed (message above): nothing was published" }
& node "$Here\check_devmap_all_v323.mjs" $out --min-areas 40
if ($LASTEXITCODE -ne 0) { Stop-Here "the index is missing something it must carry, or holds fewer than 40 areas (message above): nothing was published" }
& node "$Here\check_devmap_v327.mjs" $out --before "$Work\devmap_index.backup.json" --min-areas 40
if ($LASTEXITCODE -ne 0) { Stop-Here "the v327 checks failed (message above): nothing was published" }
& node "$Here\check_attribution_gate.mjs" $out --audit-csv "$Work\devmap_index.attribution_audit.csv"
if ($LASTEXITCODE -ne 0) { Stop-Here "the ATTRIBUTION GATE failed on the NEW index (message above; the audit trail is $Work\devmap_index.attribution_audit.csv): nothing was published" }
& python "$Here\guard_devmap_attribution.py" --index $out --register "$Work\area_register.json" --out "$Work\guard_new.json"
if ($LASTEXITCODE -ne 0) { Stop-Here "the attribution guard failed on the NEW index (message above): nothing was published" }
$n = [int](& node -e "console.log(Object.keys(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).areas).length)" $out)
$nd = [int](& node -e "console.log(Object.keys(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).devs).length)" $out)
if ($n -lt 40) { Stop-Here "the new index holds only $n areas: a failed build is not published" }
if ($DryRun) { Write-Host "DRY RUN: nothing written to the live store. New index: $out ($n areas, $nd developers, $([math]::Round((Get-Item $out).Length/1KB)) KB; the live one is $([math]::Round((Get-Item "$Work\devmap_index.backup.json").Length/1KB)) KB)"; exit 0 }
Write-Host "5/5 putting"
Put-Kv "img_devmap_index" $out
Verify-Kv "img_devmap_index" $n "Object.keys(j.areas).length"
Read-Live "img_devmap_index" "$Work\devmap_index.live_after.json"
& node "$Here\check_devmap_all_v323.mjs" "$Work\devmap_index.live_after.json" --min-areas 40
$c1 = $LASTEXITCODE
& node "$Here\check_devmap_v327.mjs" "$Work\devmap_index.live_after.json" --before "$Work\devmap_index.backup.json" --min-areas 40
if ($LASTEXITCODE -ne 0) { $c1 = 1 }
& node "$Here\check_attribution_gate.mjs" "$Work\devmap_index.live_after.json" --audit-csv "$Work\devmap_index.live_attribution_audit.csv"
if ($LASTEXITCODE -ne 0) { $c1 = 1 }
& python "$Here\guard_devmap_attribution.py" --index "$Work\devmap_index.live_after.json" --register "$Work\area_register.json"
$c2 = $LASTEXITCODE
if ($c1 -ne 0 -or $c2 -ne 0) {
  Write-Host "THE LIVE INDEX FAILED A CHECK. Roll back now (from $script:WORKER):" -ForegroundColor Red
  Write-Host "  npx wrangler kv key put img_devmap_index --path `"$Work\devmap_index.backup.json`" --env $script:ENVN --namespace-id $script:NS"
  exit 1
}
Write-Host ""; Write-Host "DONE. To roll back (from $script:WORKER):"
Write-Host "  npx wrangler kv key put img_devmap_index --path `"$Work\devmap_index.backup.json`" --env $script:ENVN --namespace-id $script:NS"
