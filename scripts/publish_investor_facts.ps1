# v379 - PUBLISH the investor-PDF facts of EVERY project (Kendall, 7 Oct 2026: 'build the investor PDF facts for all projects'). KENDALL APPROVES, THEN THIS RUNS. Claude has NOT run it.
# Input: the folder written by scripts\build_investor_facts.py (index.json + investor_tiers_facts_<district>.json), already checked by scripts\check_investor_facts.mjs (this script runs the check again and stops on any violation).
# Writes, in this order: each district shard KV img_investor_tiers_facts_<district>, then LAST the index KV img_investor_tiers_index (so the index never points at a shard that is not there).
#   DRY RUN IS THE DEFAULT: without -Apply nothing is written to the live store. It still reads the live store (read-only) to say what it would create and what it would replace.
#   powershell -File scripts\publish_investor_facts.ps1 -Folder <folder>                 dry run
#   powershell -File scripts\publish_investor_facts.ps1 -Folder <folder> -Apply          create the keys (refuses if ANY target key already exists)
#   powershell -File scripts\publish_investor_facts.ps1 -Folder <folder> -Apply -Replace replace keys that already exist (each live value is backed up first)
# Rules: never touches a protected key (data\protected_keys.json in naj-market-pulse, plus img_investor_tiers_facts, the v376 single key that keeps Chelsea live, and img_devmap_index);
# refuses 04:00-06:15 Dubai (the morning chain window); stops at the first failure; reads every key back and compares it with what was written; prints the roll-back line for each key.
# The v379 worker reads the index and the shards and falls back to the single key, so the order of deploy and publish does not matter; publishing before the deploy changes nothing visible.
param([Parameter(Mandatory = $true)][string]$Folder, [switch]$Apply, [switch]$Replace, [switch]$SkipGate, [string]$Work = "", [string]$Protected = "C:\Dev\naj-market-pulse\data\protected_keys.json")
$DryRun = -not $Apply
$Here = if (Test-Path "$PSScriptRoot\_kv_common.ps1") { $PSScriptRoot } else { "C:\Dev\azimuth-worker-dewa\scripts" }
. "$Here\_kv_common.ps1"
$dub = [TimeZoneInfo]::ConvertTimeBySystemTimeZoneId((Get-Date), "Arabian Standard Time")
$mins = $dub.Hour * 60 + $dub.Minute
if ($mins -ge 240 -and $mins -lt 375) { Stop-Here "it is $($dub.ToString('HH:mm')) Dubai: the 04:00-06:15 morning chain window. Run this after 06:15." }
Test-QuietWindow
if (-not (Test-Path "$Folder\index.json")) { Stop-Here "$Folder\index.json does not exist: run scripts\build_investor_facts.py first" }
if (-not $Work) { $Work = Join-Path $env:TEMP ("investor_facts_" + (Get-Date -Format "yyyyMMdd_HHmmss")) }
New-Item -ItemType Directory -Force $Work | Out-Null
$bk = Join-Path $Work "backup"; New-Item -ItemType Directory -Force $bk | Out-Null

Write-Host "1/5 the offline quality gates (scripts\check_investor_facts.mjs) on $Folder"
& node "$Here\check_investor_facts.mjs" $Folder
if ($LASTEXITCODE -ne 0) { Stop-Here "the quality gates failed (message above): nothing was published" }

Write-Host "2/5 the keys this would write"
$targets = @()
foreach ($f in Get-ChildItem "$Folder\investor_tiers_facts_*.json" | Sort-Object Name) { $targets += [pscustomobject]@{ Key = "img_" + $f.BaseName; File = $f.FullName; Kind = "shard" } }
if ($targets.Count -lt 1) { Stop-Here "no shard files in $Folder" }
$targets += [pscustomobject]@{ Key = "img_investor_tiers_index"; File = "$Folder\index.json"; Kind = "index" }
$pat = @()
if (Test-Path $Protected) { $pat += @((Get-Content $Protected -Raw | ConvertFrom-Json).patterns) } else { Stop-Here "the protected-keys list $Protected is missing: refusing to publish without it" }
$pat += "img_investor_tiers_facts", "img_devmap_index"
foreach ($t in $targets) {
  foreach ($p in $pat) { if ($t.Key -like $p) { Stop-Here "$($t.Key) is protected (matches '$p'): this script never touches it" } }
  if ($t.Key -notmatch '^img_investor_tiers_(facts_[a-z0-9]+|index)$') { Stop-Here "$($t.Key) is not an investor-facts key" }
}
$idx = Get-Content "$Folder\index.json" -Raw | ConvertFrom-Json
$shardCount = ($targets | Where-Object { $_.Kind -eq "shard" }).Count
Write-Host ("  {0} shards + the index, {1} projects; largest shard {2} KB; index {3} KB" -f $shardCount, $idx.count, [math]::Round((($targets | Where-Object { $_.Kind -eq "shard" } | ForEach-Object { (Get-Item $_.File).Length } | Measure-Object -Maximum).Maximum) / 1KB), [math]::Round((Get-Item "$Folder\index.json").Length / 1KB))

Write-Host "3/5 which of them already exist live (read-only)"
$exist = @()
foreach ($t in $targets) {
  $live = Join-Path $Work ("live_" + $t.Key + ".json")
  Read-Live $t.Key $live -AllowMissing | Out-Null
  if (Test-Path $live) { $t | Add-Member -NotePropertyName Live -NotePropertyValue $live; $exist += $t }
}
Write-Host ("  would create {0} keys, would replace {1} existing keys" -f ($targets.Count - $exist.Count), $exist.Count)
if ($exist.Count -gt 0 -and -not $Replace) {
  Write-Host ("  already live: " + (($exist | Select-Object -First 8 | ForEach-Object { $_.Key }) -join ", ") + $(if ($exist.Count -gt 8) { ", ..." }))
  if (-not $DryRun) { Stop-Here "$($exist.Count) target keys already exist and -Replace was not given: nothing was written. Re-run with -Replace to replace them (each live value is backed up first)." }
}
# v397g HARD STOP: the completeness gate (scripts\gate_guard.py) runs with the new file substituted for its layer and must pass before anything is written; -SkipGate publishes UNGATED and says so loudly
$gg = Join-Path $PSScriptRoot "gate_guard.py"
if ($SkipGate) { $skipMsg = "!!! COMPLETENESS GATE SKIPPED (-SkipGate): THIS PUBLISH IS UNGATED. Nothing has checked that it keeps every fixture and surface. !!!"; Write-Host $skipMsg -ForegroundColor Red; [Console]::Error.WriteLine($skipMsg) }
elseif (-not (Test-Path $gg)) { Stop-Here "scripts\gate_guard.py is missing: refusing to publish without the completeness gate (-SkipGate overrides it, loudly)" }
else {
  $ggArgs = @("--layer", "investor_tiers_index", "--file", "$Folder\index.json"); if ($DryRun) { $ggArgs += "--dry-run" }
  & python $gg @ggArgs
  if ($LASTEXITCODE -ne 0) { if ($DryRun) { Write-Host "DRY RUN: the completeness gate WOULD BLOCK this publish (table above)." -ForegroundColor Yellow } else { Stop-Here "the COMPLETENESS GATE blocked the publish (table above): nothing was written. -SkipGate overrides it, loudly." } }
}
if ($DryRun) { Write-Host "DRY RUN: nothing written to the live store. Add -Apply to publish."; exit 0 }

Write-Host "4/5 putting: the shards first, the index last"
$done = @()
function Show-Rollback {
  Write-Host ""; Write-Host "ROLL BACK (from $script:WORKER):" -ForegroundColor Yellow
  foreach ($d in $done) {
    if ($d.Backup) { Write-Host "  npx wrangler kv key put $($d.Key) --path `"$($d.Backup)`" --env $script:ENVN --namespace-id $script:NS" }
    else { Write-Host "  npx wrangler kv key delete $($d.Key) --env $script:ENVN --namespace-id $script:NS" }
  }
}
foreach ($t in $targets) {
  $backup = $null
  if ($t.PSObject.Properties.Name -contains "Live") { $backup = Join-Path $bk ($t.Key + ".before.json"); Copy-Item $t.Live $backup }
  $done += [pscustomobject]@{ Key = $t.Key; Backup = $backup }       # recorded BEFORE the put, so a failed put is still on the roll-back list
  try { Put-Kv $t.Key $t.File } catch { Show-Rollback; throw }
  # read it back and compare with what was written (the whole value, not a count)
  $back = Join-Path $Work ("after_" + $t.Key + ".json")
  Read-Live $t.Key $back | Out-Null
  $same = & node -e "const fs=require('fs');const a=JSON.stringify(JSON.parse(fs.readFileSync(process.argv[1],'utf8'))),b=JSON.stringify(JSON.parse(fs.readFileSync(process.argv[2],'utf8')));console.log(a===b?'same':'DIFFERENT')" $t.File $back
  if ($same -ne "same") { Show-Rollback; Stop-Here "read-back of $($t.Key) differs from what was written" }
  Write-Host "  verified $($t.Key): read back and identical" -ForegroundColor Green
}

Write-Host "5/5 done"
Show-Rollback
Write-Host ""; Write-Host "Check by hand (read-only): /developers_map_api?what=inv&key=... answers the compact index; /developers_pdf?kind=investor_selector&project=<id>&format=html&key=... opens a project."
