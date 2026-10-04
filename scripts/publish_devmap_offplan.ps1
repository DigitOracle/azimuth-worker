# v314 - REBUILD and PUBLISH the Developers-by-area index with Dubai Islands (Palm Deira) off-plan sales. KENDALL RUNS THIS (writes production KV).
#   powershell -File scripts\publish_devmap_offplan.ps1 [-Cards <cov_cards dir>] [-Shares <dld_tier_shares json>] [-Slugs palmdeira] [-Work <dir>] [-DryRun]
# Also builds area_register.json (the register's own home-sale counts per district, read-only on the lake) so a panel can say "X of about Y settled sales are loaded".
# Reads the LIVE inputs (read-only): districts_geo, map_prices, rent_index, ejari_projects_index, devmap_index (the backup) and img_unitmix_<slug> for every district;
# runs scripts\build_devmap_index.mjs --offplan (register-built cards ADDED for the -Slugs districts; a project already on a priced card is skipped; off-plan prices are
# labelled as contract values in the area note); prints the before/after for those areas; puts img_devmap_index; reads it back.
# Run AFTER publish_cov_cards.ps1 is NOT required: the index reads the cards file you give it, not KV. Deploy the v314 worker for the panel wording.
param([string]$Cards = "C:\Users\kwils\AppData\Local\Temp\claude\C--Users-kwils-Downloads\cfd69a2f-a784-4bee-87d0-17cb12cabffb\scratchpad\cov_cards",
      [string]$Shares = "C:\Users\kwils\AppData\Local\Temp\claude\C--Users-kwils-Downloads\cfd69a2f-a784-4bee-87d0-17cb12cabffb\scratchpad\shares.json",
      [string]$Slugs = "majan,madinatalmataar,jabalalifirst,alkhairanfirst,alhebiahfifth,dubaiinvestmentparkfirst,dubaiinvestmentparksecond,alyelayiss1,alyelayiss2,alyufrah1,wadialsafa4,wadialsafa5,palmdeira", [string]$Work = "", [switch]$DryRun)
. "$PSScriptRoot\_kv_common.ps1"
Test-QuietWindow
if (-not $Work) { $Work = Join-Path $env:TEMP ("devmap_publish_" + (Get-Date -Format "yyyyMMdd_HHmmss")) }
$um = Join-Path $Work "um"; New-Item -ItemType Directory -Force $um | Out-Null
Write-Host "1/4 reading live inputs (read-only)"
foreach ($k in "districts_geo", "map_prices", "rent_index") { Read-Live "img_$k" "$Work\$k.json" }
Read-Live "img_ejari_projects_index" "$Work\ejari_projects_index.json" -AllowMissing
Read-Live "img_devmap_index" "$Work\devmap_index.backup.json"
$geo = Get-Content "$Work\districts_geo.json" -Raw | ConvertFrom-Json
foreach ($d in $geo.districts) { Read-Live "img_unitmix_$($d.slug)" "$um\um_$($d.slug).raw" -AllowMissing }
Write-Host "2/4 building (register counts from the lake, then the index)"
& python "$PSScriptRoot\build_area_register_counts.py" --geo "$Work\districts_geo.json" --out "$Work\area_register.json"
if ($LASTEXITCODE -ne 0) { Stop-Here "the register counts failed (message above)" }
$out = "$Work\devmap_index.new.json"
$args2 = @("$PSScriptRoot\build_devmap_index.mjs", "--um", $um, "--prices", "$Work\map_prices.json", "--rent", "$Work\rent_index.json", "--geo", "$Work\districts_geo.json", "--shares", $Shares, "--register", "$Work\area_register.json", "--offplan", $Cards, "--offplan-slugs", $Slugs, "--out", $out)
if (Test-Path "$Work\ejari_projects_index.json") { $args2 += @("--ejari", "$Work\ejari_projects_index.json") }
& node @args2
if ($LASTEXITCODE -ne 0) { Stop-Here "the index build failed (message above)" }
Write-Host "3/4 before / after"
& node -e "const fs=require('fs');const a=JSON.parse(fs.readFileSync(process.argv[1],'utf8')),b=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));const sl=process.argv[3].split(',');const n=(x,s)=>{const A=x.areas[s];if(!A)return 'no area';let t=0,k=0,u=0;for(const d in A.devs){const q=A.devs[d].c.reduce((p,c)=>p+c[0],0);t+=q;if(d==='_')u=q;else k++}return t+' sales, '+k+' developers, '+u+' with the developer not recorded'};console.log('areas: '+Object.keys(a.areas).length+' -> '+Object.keys(b.areas).length+' | developers: '+Object.keys(a.devs).length+' -> '+Object.keys(b.devs).length);for(const s of sl)console.log('  '+s+': '+n(a,s)+'  =>  '+n(b,s))" "$Work\devmap_index.backup.json" $out $Slugs
$n = [int](& node -e "console.log(Object.keys(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).areas).length)" $out)
if ($n -lt 35) { Stop-Here "the new index holds only $n areas (live had about 39): a failed build is not published" }
if ($DryRun) { Write-Host "DRY RUN: nothing written. New index: $out"; exit 0 }
Write-Host "4/4 putting"
Put-Kv "img_devmap_index" $out
Verify-Kv "img_devmap_index" $n "Object.keys(j.areas).length"
Write-Host ""; Write-Host "DONE. To roll back (from $script:WORKER):"
Write-Host "  npx wrangler kv key put img_devmap_index --path `"$Work\devmap_index.backup.json`" --env $script:ENVN --namespace-id $script:NS"
