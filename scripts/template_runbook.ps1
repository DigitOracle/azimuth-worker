# v329 - WhatsApp template runbook. Run AFTER the worker is deployed. Only step 1 is executable as written; it is a dry run.
# Steps 2-5 are listed as comments: run each by hand, in order, when ready.
#
# Needs: $env:AZ_HOST (the azimuth-2 worker host), $env:AZ_KEY (the owner key, READ_KEY) and the WhatsApp Business
# ACCOUNT id ($env:WABA). Kendall supplies the WABA id from WhatsApp Manager > Account tools, or
# Business settings > WhatsApp accounts. It is NOT the phone number id.
# The routes use the worker's own WHATSAPP_TOKEN. Never paste a token anywhere.

param([string]$Name = "najma_feed_ready")
if (-not $env:AZ_HOST -or -not $env:AZ_KEY) { Write-Host "Set AZ_HOST and AZ_KEY first."; return }
$waba = if ($env:WABA) { $env:WABA } else { "WABA_ID_HERE" }

# 1. DRY RUN (safe: sends nothing to Meta, returns the exact JSON that would be submitted).
Invoke-RestMethod -Method Post -Uri "https://$($env:AZ_HOST)/wa_template_create?name=$Name&waba=$waba&confirm=yes&key=$($env:AZ_KEY)" | ConvertTo-Json -Depth 6

# 2. CREATE (submits to Meta for review; needs the real WABA id). Run for najma_feed_ready, then najma_log_day:
#    Invoke-RestMethod -Method Post -Uri "https://$($env:AZ_HOST)/wa_template_create?name=$Name&waba=$waba&confirm=yes&dry=0&key=$($env:AZ_KEY)"
#
# 3. POLL STATUS (PENDING -> APPROVED or REJECTED with a reason; usually minutes, sometimes a day):
#    Invoke-RestMethod -Uri "https://$($env:AZ_HOST)/wa_template_status?name=$Name&waba=$waba&key=$($env:AZ_KEY)"
#
# 4. SWITCH THE FEED NUDGE (najma_feed_ready only; the worker re-checks and refuses unless APPROVED):
#    Invoke-RestMethod -Method Post -Uri "https://$($env:AZ_HOST)/wa_template_use?name=najma_feed_ready&waba=$waba&confirm=yes&key=$($env:AZ_KEY)"
#
# 5. VERIFY: the next held-feed nudge, or /feed_nudge_send, goes out as najma_feed_ready with no parameters.
#    najma_log_day has no send path in this worker; the log worker reads LOG_NUDGE_TEMPLATE once it is APPROVED.
# Rollback: set KV feed_template back to azimuth_daily (or delete the key); the default is azimuth_daily.
