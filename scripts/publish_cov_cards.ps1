# v314 - PUBLISH the register-built Buy cards. KENDALL RUNS THIS (it writes production KV). Deploy the v314 worker FIRST (the Brief must read img_buy_extra).
#   powershell -File scripts\publish_cov_cards.ps1 [-Cards <cov_cards dir>] [-Work <dir>] [-DryRun]
# Order and what it does:
#   1 reads LIVE img_map_prices and img_unitmix_<slug> for each target (read-only) into <Work>\live  - these files ARE the backups (also copied to <Work>\backup)
#   2 merges the cards onto them locally (scripts\merge_cov_cards.mjs): existing cards untouched, a rebuild replaces the previous register-built set, a project
#     already on a priced live card is dropped, an id clash stops the run  -> <Work>\new, with the diff summary printed
#   3 puts, in this order: img_unitmix_<slug> for each district, img_buy_extra, img_map_prices (the Liwan items with a real footprint, added; every other field kept);
#     each put is read back and counted. First failure stops everything and prints wrangler's own error and the rollback commands.
# -DryRun does steps 1-2 only and writes nothing to KV.
param([string]$Cards = "C:\Users\kwils\AppData\Local\Temp\claude\C--Users-kwils-Downloads\cfd69a2f-a784-4bee-87d0-17cb12cabffb\scratchpad\cov_cards",
      [string]$Work = "", [switch]$DryRun, [switch]$SkipGate)
. "$PSScriptRoot\_kv_common.ps1"
Test-QuietWindow
if (-not $Work) { $Work = Join-Path $env:TEMP ("cov_cards_publish_" + (Get-Date -Format "yyyyMMdd_HHmmss")) }
$live = Join-Path $Work "live"; $new = Join-Path $Work "new"; $bak = Join-Path $Work "backup"
New-Item -ItemType Directory -Force $live, $new, $bak | Out-Null
$slugs = Get-ChildItem $Cards -Filter "unitmix_*.synthetic.json" | ForEach-Object { $_.Name -replace "^unitmix_|\.synthetic\.json$", "" }
if (-not $slugs) { Stop-Here "no unitmix_*.synthetic.json in $Cards" }
Write-Host "districts: $($slugs -join ', ')"
Write-Host "1/3 reading live values (read-only)"
Read-Live "img_map_prices" "$live\map_prices.json"
foreach ($s in $slugs) { Read-Live "img_unitmix_$s" "$live\unitmix_$s.json" -AllowMissing }
Copy-Item "$live\*" $bak -Force
Write-Host "2/3 merging locally"
$summary = Join-Path $Work "merge_summary.json"
& node "$PSScriptRoot\merge_cov_cards.mjs" --cards $Cards --live $live --out $new --summary $summary | Out-Null
if ($LASTEXITCODE -ne 0) { Stop-Here "the merge stopped (see the message above)" }
$sum = Get-Content $summary -Raw | ConvertFrom-Json
$sum.districts | Format-Table slug, cards_before, replaced_previous_synthetic, added, dropped_already_answered, cards_after, new_file -AutoSize | Out-String | Write-Host
Write-Host "buy_extra: $($sum.buy_extra.items_written) items | map_prices: $($sum.map_prices.items_before) -> $($sum.map_prices.items_after) (added: $($sum.map_prices.added -join '; '))"
if ($sum.dropped_as_already_answered.Count) { Write-Host "dropped as already answered: $($sum.dropped_as_already_answered -join '; ')" }
# v397g HARD STOP: the completeness gate (scripts\gate_guard.py) runs with the new file substituted for its layer and must pass before anything is written; -SkipGate publishes UNGATED and says so loudly
$gg = Join-Path $PSScriptRoot "gate_guard.py"
if ($SkipGate) { $skipMsg = "!!! COMPLETENESS GATE SKIPPED (-SkipGate): THIS PUBLISH IS UNGATED. Nothing has checked that it keeps every fixture and surface. !!!"; Write-Host $skipMsg -ForegroundColor Red; [Console]::Error.WriteLine($skipMsg) }
elseif (-not (Test-Path $gg)) { Stop-Here "scripts\gate_guard.py is missing: refusing to publish without the completeness gate (-SkipGate overrides it, loudly)" }
else {
  $ggArgs = @("--layer", "map_prices", "--file", "$new\map_prices.json"); if ($DryRun) { $ggArgs += "--dry-run" }; $ggArgs += "--also"; $ggArgs += "buy_extra=$new\buy_extra.json"
  & python $gg @ggArgs
  if ($LASTEXITCODE -ne 0) { if ($DryRun) { Write-Host "DRY RUN: the completeness gate WOULD BLOCK this publish (table above)." -ForegroundColor Yellow } else { Stop-Here "the COMPLETENESS GATE blocked the publish (table above): nothing was written. -SkipGate overrides it, loudly." } }
}
if ($DryRun) { Write-Host "DRY RUN: nothing written. Files: $new"; exit 0 }
Write-Host "3/3 putting"
$rollback = @()
foreach ($s in $slugs) {
  Put-Kv "img_unitmix_$s" "$new\unitmix_$s.json"
  $n = [int](& node -e "console.log(Object.keys(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).buildings_by_id).length)" "$new\unitmix_$s.json")
  Verify-Kv "img_unitmix_$s" $n "Object.keys(j.buildings_by_id).length"
  $rollback += if (Test-Path "$bak\unitmix_$s.json") { "npx wrangler kv key put img_unitmix_$s --path `"$bak\unitmix_$s.json`" --env $script:ENVN --namespace-id $script:NS" } else { "npx wrangler kv key delete img_unitmix_$s --env $script:ENVN --namespace-id $script:NS   # it did not exist before" }
}
Put-Kv "img_buy_extra" "$new\buy_extra.json"
Verify-Kv "img_buy_extra" $sum.buy_extra.items_written "j.items.length"
$rollback += "npx wrangler kv key delete img_buy_extra --env $script:ENVN --namespace-id $script:NS   # it did not exist before"
Put-Kv "img_map_prices" "$new\map_prices.json"
Verify-Kv "img_map_prices" $sum.map_prices.items_after "j.items.length"
$rollback += "npx wrangler kv key put img_map_prices --path `"$bak\map_prices.json`" --env $script:ENVN --namespace-id $script:NS"
Write-Host ""; Write-Host "DONE. To roll back (run from $script:WORKER):"; $rollback | ForEach-Object { Write-Host "  $_" }
