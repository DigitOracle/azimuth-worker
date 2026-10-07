# v321 - REBUILD and PUBLISH the Developers-by-area index with project lists (one entry per building: sales, price per sq m, project name) and the
# project counts behind each developer's brand profile. KENDALL RUNS THIS (it writes production KV). The worker for v321 must be deployed for the page to use it;
# the old page ignores the extra fields, so publishing the index first is safe.
#   powershell -File scripts\publish_devmap_profile_v321.ps1 [-DryRun]
# It runs scripts\publish_devmap_offplan.ps1, which: reads the live inputs (read only), builds the index with scripts\build_devmap_index.mjs, refuses to publish
# a build with fewer than 35 areas, saves the live index as devmap_index.backup.json in the work folder BEFORE writing, puts img_devmap_index and reads it back.
# This wrapper then reads the live index again and checks the new fields are there. It stops at the first failure and prints the real error.
param([switch]$DryRun, [switch]$SkipGate)
$ErrorActionPreference = "Stop"
$Work = Join-Path $env:TEMP ("devmap_profile_v321_" + (Get-Date -Format "yyyyMMdd_HHmmss"))
New-Item -ItemType Directory -Force $Work | Out-Null
Write-Host "Work folder (the backup of the live index will be here): $Work"
$inner = Join-Path $PSScriptRoot "publish_devmap_offplan.ps1"
$ia = @("-NoProfile", "-File", $inner, "-Work", $Work); if ($DryRun) { $ia += "-DryRun" }; if ($SkipGate) { $ia += "-SkipGate" }   # v397g: the inner publisher runs the completeness gate (gate_guard.py); -SkipGate is passed through
& powershell @ia
if ($LASTEXITCODE -ne 0) { Write-Host "STOPPED: the publish script failed (message above). Nothing more was done."; exit 1 }
if ($DryRun) {
  $new = Join-Path $Work "devmap_index.new.json"
  & node -e "const j=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));const d=Object.values(j.devs);console.log('DRY RUN check: developers',d.length,'with project counts',d.filter(x=>x.profile&&x.profile.projects>0).length,'scale cut-offs',JSON.stringify(j.scale))" $new
  exit $LASTEXITCODE
}
. "$PSScriptRoot\_kv_common.ps1"
Read-Live "img_devmap_index" "$Work\devmap_index.live_after.json"
& node -e "const j=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));const d=Object.values(j.devs);const n=d.filter(x=>x.profile&&x.profile.projects>0).length;console.log('LIVE check: developers',d.length,'with project counts',n,'scale cut-offs',JSON.stringify(j.scale));if(n<100||!j.scale){console.error('the live index does not carry the project fields');process.exit(2)}" "$Work\devmap_index.live_after.json"
if ($LASTEXITCODE -ne 0) { Write-Host "CHECK FAILED. To roll back, run (from C:\Dev\azimuth-worker-dewa):"; Write-Host "  npx wrangler kv key put img_devmap_index --path `"$Work\devmap_index.backup.json`" --env azimuth2 --namespace-id 2cdf36a27f834b5f9c726294d36770fb"; exit 1 }
Write-Host "DONE. Backup of the previous live index: $Work\devmap_index.backup.json"
