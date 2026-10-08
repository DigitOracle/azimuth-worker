# v411 - PUBLISH the rebuilt investor-PDF facts (KORE by Imtiaz and the other projects the developer announces that are in no register). KENDALL APPROVES, THEN THIS RUNS. Claude has NOT run it.
# It adds nothing of its own: it checks the rebuild against the baseline (no register-verified record may change), then hands the folder to the existing publisher, scripts\publish_investor_facts.ps1,
# which runs the quality gates (scripts\check_investor_facts.mjs), refuses protected keys and the 04:00-06:15 Dubai window, runs the completeness gate (scripts\gate_guard.py, layer investor_tiers_index),
# writes the district shards first and the index last, reads every key back and prints the roll-back line for each key (each live value is backed up first).
#   powershell -File scripts\publish_investor_facts_v411.ps1 -Folder <rebuilt folder> -Baseline <folder built by the v410 code>                 dry run (the default)
#   powershell -File scripts\publish_investor_facts_v411.ps1 -Folder <rebuilt folder> -Baseline <v410 folder> -Apply                          replace the live shards and the index
# Build the folders first:   python scripts\build_investor_facts.py --out-dir <folder> --built <date>     (the baseline is the same command run on the v410 code)
param([Parameter(Mandatory = $true)][string]$Folder, [Parameter(Mandatory = $true)][string]$Baseline, [switch]$Apply, [switch]$SkipGate)
$Here = $PSScriptRoot
Write-Host "1/2 no register-verified record may differ from the baseline (scripts\compare_investor_facts.py)"
& python "$Here\compare_investor_facts.py" $Baseline $Folder
if ($LASTEXITCODE -ne 0) { Write-Host "STOP: a register-verified record would change, or the index moved. Nothing was published." -ForegroundColor Red; exit 1 }
Write-Host "2/2 the existing publisher (quality gates, protected keys, completeness gate, read-back, roll-back lines)"
$inner = Join-Path $Here "publish_investor_facts.ps1"
$ia = @("-NoProfile", "-File", $inner, "-Folder", $Folder); if ($Apply) { $ia += "-Apply"; $ia += "-Replace" }; if ($SkipGate) { $ia += "-SkipGate" }   # the inner publisher runs the completeness gate (gate_guard.py); -SkipGate is passed through
& powershell @ia
exit $LASTEXITCODE
