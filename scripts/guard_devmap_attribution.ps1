# v325 - MONTHLY GUARD: does the register contradict the developers the LIVE Developers-by-area index shows? Read-only (reads the live index and the lake; writes one local report).
# Run monthly, after the register refresh (Najma_Gov_Weekly):   powershell -File C:\Dev\_attr_v325\scripts\guard_devmap_attribution.ps1 [-MaxContradicted 0.01]
# Exit 0 = OK. Exit 1 = FAILED: the register contradicts more than 1% of the sales the guard could check (or one developer has more than 2% of its listed sales contradicted, at least 50 sales).
# The report (top contradictions) is written to %TEMP%\devmap_guard_<time>\guard.json. Fix: re-run scripts\publish_devmap_attr_v325.ps1 (it rebuilds with the register first).
param([double]$MaxContradicted = 0.01, [double]$MaxProjectContradicted = 0.02)
$Here = if (Test-Path "$PSScriptRoot\guard_devmap_attribution.py") { $PSScriptRoot } else { "C:\Dev\_attr_v325\scripts" }
. "$Here\_kv_common.ps1"
$dub = [TimeZoneInfo]::ConvertTimeBySystemTimeZoneId((Get-Date), "Arabian Standard Time")
$mins = $dub.Hour * 60 + $dub.Minute
if ($mins -ge 240 -and $mins -lt 375) { Stop-Here "it is $($dub.ToString('HH:mm')) Dubai: the 04:00-06:15 morning chain window. Run this after 06:15." }
Test-QuietWindow
$Work = Join-Path $env:TEMP ("devmap_guard_" + (Get-Date -Format "yyyyMMdd_HHmmss")); New-Item -ItemType Directory -Force $Work | Out-Null
Read-Live "img_devmap_index" "$Work\devmap_index.live.json"
Read-Live "img_districts_geo" "$Work\districts_geo.json"
Read-Live "img_district_polygons" "$Work\district_polygons.json"
& node "$Here\merge_districts_geo.mjs" "$Work\districts_geo.json" "$Work\district_polygons.json" "$Work\districts_geo_all.json"
if ($LASTEXITCODE -ne 0) { Stop-Here "merging the district list failed (message above)" }
& python "$Here\build_area_register_counts.py" --geo "$Work\districts_geo_all.json" --out "$Work\area_register.json"
if ($LASTEXITCODE -ne 0) { Stop-Here "the register counts failed (message above)" }
& python "$Here\guard_devmap_attribution.py" --index "$Work\devmap_index.live.json" --register "$Work\area_register.json" --max-contradicted $MaxContradicted --max-project-contradicted $MaxProjectContradicted --out "$Work\guard.json"
$code = $LASTEXITCODE
Write-Host "Report: $Work\guard.json"
exit $code
