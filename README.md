# azimuth-worker

Azimuth — personal-assistant / commitment-ledger Cloudflare Worker.
Migrated from paste-deploy to **wrangler** (v36 foundation, 19 Aug 2026).

## Layout
```
wrangler.toml     # two envs: default = meeting-capture, [env.azimuth2] = azimuth-2. Live bindings.
src/index.js      # the worker (v35.1). One module today; splits into src/connectors, events, identity,
                  # attention, deliver/... incrementally per the v36 spec.
test/             # offline suites (relationship v35, sent-items v35.1, twilio v34) — 46 checks
MIGRATION.md      # step-by-step: paste-deploy -> wrangler, with the verify suite. READ FIRST.
```

## Commands
```
npm install
npm run check          # node --check the entry
npm test               # run the offline suites (no network, stubs fetch+KV)
npm run dry            # wrangler deploy --dry-run (meeting-capture)
npm run deploy         # deploy meeting-capture
npm run deploy:azimuth2
npm run tail           # live logs
```

## Deploy model
`wrangler.toml` mirrors the live bindings read from Cloudflare on 19 Aug 2026 (KV ids, vars,
`AZIMUTH_2` service binding, per-env compatibility_date, crons). **Secrets are not in the repo** —
they already exist on both workers and wrangler preserves them across deploys. See MIGRATION.md.

## Canonical worker versions
Version lineage + paste-ready copies live in the DigitAlchemy tree
(`Operations/DevOps/Azimuth/`, `Synergies/Azimuth/worker_vNN_*.js`) and GitHub
`DigitOracle/meeting-reminder-bot` (`worker.js`). This repo becomes the source of truth once the
wrangler cutover is verified.
