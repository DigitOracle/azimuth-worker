# Azimuth Worker — paste-deploy → wrangler migration runbook

**Goal:** deploy the exact same live worker (v35.1) through `wrangler` instead of paste/API-PUT,
with **zero behaviour change and zero binding/secret loss**, then retire the paste flow.

This scaffold was built 19 Aug 2026 with the **live binding config read directly from Cloudflare**
— `wrangler.toml` mirrors production exactly (KV ids, vars, service binding, compat dates, crons).

---

## The one risk, and why it's low

The only real risk is a first `wrangler deploy` **dropping a binding or secret**. Two protections:

1. **Secrets persist.** `wrangler deploy` does not touch secrets set via `wrangler secret put` /
   the dashboard — they are managed separately and survive deploys. `wrangler.toml` deliberately
   contains **no secrets**, only the KV/AI/service/vars bindings (which it declares in full).
2. **Verify before trusting.** Run `--dry-run` first, then deploy, then the verify suite below.
   Rollback is the paste-deploy backups (`Downloads\{meeting-capture,azimuth-2}-BACKUP-*.js`).

---

## Steps (terminal, has Cloudflare creds)

### 0. Auth + install
```
cd C:\Dev\azimuth-worker
npm install
# auth: either `wrangler login`, OR set the token you already have:
#   $env:CLOUDFLARE_API_TOKEN = (Get-Content C:\Users\kwils\.cf_token)
wrangler whoami
```

### 1. Dry-run both envs (uploads nothing — validates config + bindings)
```
npm run dry            # meeting-capture
npm run dry:azimuth2   # azimuth-2
```
Confirm each lists: KV `MEETINGS` (correct id), `AI`, vars as expected, and (meeting-capture only)
the `AZIMUTH_2` service binding. Fix wrangler.toml if anything is off BEFORE a real deploy.

### 2. Deploy meeting-capture, verify immediately
```
npm run deploy
```
Verify (all must pass — these prove bindings + secrets survived):
```
curl "https://meeting-capture.digitalchemy.workers.dev/health?key=daRadar_rd_4Tn8pB3z"        # 200
curl "https://meeting-capture.digitalchemy.workers.dev/people?key=daRadar_rd_4Tn8pB3z&format=json"   # JSON (READ_KEY secret intact)
curl -X POST "https://meeting-capture.digitalchemy.workers.dev/ingest" -H "X-Azimuth-Ingest: WRONG" -d "{}"  # 401 (INGEST_TOKEN intact)
curl "https://meeting-capture.digitalchemy.workers.dev/claude_ping?key=daRadar_rd_4Tn8pB3z"    # both tiers 200 (ANTHROPIC_API_KEY intact)
```
If `/health` or `/claude_ping` fail → a secret didn't survive; STOP and re-check (do not deploy azimuth2).

### 3. Deploy azimuth-2, verify
```
npm run deploy:azimuth2
curl "https://azimuth-2.digitalchemy.workers.dev/health?key=<READ_KEY>"   # 200
curl "https://azimuth-2.digitalchemy.workers.dev/groups?key=<READ_KEY>"   # its group registry
```

### 4. Cron sanity
`wrangler.toml` sets `*/5 3-18 * * *` (meeting-capture) and `0,30 3-18 * * *` (azimuth2). Confirm in
the dashboard the triggers match after deploy (wrangler manages crons from the toml now).

---

## After migration
- **All future deploys:** `npm run deploy` / `npm run deploy:azimuth2`. No more paste, no more
  `filename=worker.js` trap, no more settings-PATCH for secrets.
- **New secret:** `wrangler secret put NAME` (or `... --env azimuth2`).
- **Then:** begin the incremental module split (`src/connectors/`, `src/events.js`, `src/identity.js`,
  `src/attention.js`, ...) per `Azimuth_v36_Connector_Event_Model_Spec.md` — each split re-verified by
  `npm test` before the next.

## Secret inventory (already set on the live workers — verify, don't re-enter)
- **meeting-capture:** ANTHROPIC_API_KEY, CF_RENDER_TOKEN, GH_PAT, INGEST_TOKEN, MISTRAL_API_KEY,
  MS_CLIENT_SECRET, READ_KEY, TELEGRAM_CHAT_ID, TELEGRAM_TOKEN, WA_APP_SECRET, WA_FORWARD_TOKEN,
  WA_VERIFY_TOKEN, WEBHOOK_SECRET, WHATSAPP_TOKEN
- **azimuth-2:** ANTHROPIC_API_KEY, INGEST_TOKEN, READ_KEY, WA_FORWARD_TOKEN, **WA_PHONE_ID** (secret here),
  WA_VERIFY_TOKEN, WEBHOOK_SECRET, WHATSAPP_TOKEN
