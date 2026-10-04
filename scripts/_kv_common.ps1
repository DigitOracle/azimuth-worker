# v314 - shared helpers for the three publish scripts (dot-sourced). Nothing here runs by itself.
#   rules: no --remote flag (wrangler 3.114.17 rejects it for 'kv key put'); print the REAL error; stop at the first failure; back up each live value before replacing it.
$ErrorActionPreference = "Stop"
$script:NS = "2cdf36a27f834b5f9c726294d36770fb"
$script:ENVN = "azimuth2"
$script:WORKER = "C:\Dev\azimuth-worker-dewa"
$script:REPO = Split-Path -Parent $PSScriptRoot

function Stop-Here($msg) { Write-Host ""; Write-Host "STOPPED: $msg" -ForegroundColor Red; exit 1 }

function Test-QuietWindow {
  $h = (Get-Date).Hour
  if ($h -ge 4 -and $h -lt 6) { Stop-Here "it is $((Get-Date).ToString('HH:mm')) Dubai: the 04:00-06:00 morning chain window. Run this after 06:30." }
  foreach ($t in "Najma_Daily_Refresh", "Najma_Avail_Sweep") {
    $st = (Get-ScheduledTask -TaskName $t -ErrorAction SilentlyContinue)
    if ($st -and $st.State -eq "Running") { Stop-Here "$t is Running. Wait for it to finish." }
  }
}

# read one live value to a local plain-JSON file (node scripts\kv_read_live.mjs). -AllowMissing: a missing key is fine (no file written)
function Read-Live($key, $file, [switch]$AllowMissing) {
  $log = Join-Path $env:TEMP ("kvread_" + [guid]::NewGuid().ToString("N") + ".log")
  $extra = if ($AllowMissing) { " --allow-missing" } else { "" }
  cmd /c "node `"$script:REPO\scripts\kv_read_live.mjs`" $key `"$file`"$extra > `"$log`" 2>&1"
  $code = $LASTEXITCODE
  $out = (Get-Content $log -Raw) -split "`r?`n" | Where-Object { $_ -and $_ -notmatch "DEP0190|trace-deprecation" }
  if ($code -ne 0) { Stop-Here "reading $key failed:`n$($out -join "`n")" }
  Write-Host ($out -join "`n")
}

# put one local file to KV; shows wrangler's own output; stops on a non-zero exit
function Put-Kv($key, $file) {
  if (-not (Test-Path $file)) { Stop-Here "$file does not exist" }
  $log = Join-Path $env:TEMP ("kvput_" + [guid]::NewGuid().ToString("N") + ".log")
  Push-Location $script:WORKER
  try { cmd /c "npx wrangler kv key put $key --path `"$file`" --env $script:ENVN --namespace-id $script:NS > `"$log`" 2>&1"; $code = $LASTEXITCODE } finally { Pop-Location }
  $txt = if (Test-Path $log) { Get-Content $log -Raw } else { "" }
  if ($code -ne 0) { Stop-Here "wrangler kv key put $key failed (exit $code):`n$txt" }
  Write-Host "  put $key ($([math]::Round((Get-Item $file).Length/1KB)) KB)" -ForegroundColor Green
}

# after a put: read the value back and check the item count (or card count) is what was written
function Verify-Kv($key, $expectedCount, $countJs) {
  $tmp = Join-Path $env:TEMP ("kvverify_" + [guid]::NewGuid().ToString("N") + ".json")
  Read-Live $key $tmp | Out-Null
  $n = & node -e "const j=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));console.log($countJs)" $tmp
  if ([int]$n -ne [int]$expectedCount) { Stop-Here "read-back of $key holds $n, expected $expectedCount. Roll back with the backup file listed above." }
  Write-Host "  verified $key ($n)" -ForegroundColor Green
}
