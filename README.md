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

## Do not deploy from `C:\Dev\azimuth-worker` (branch `approved-send`)

Written by the session that did it, 24 Sep 2026. That tree forked from live at v155 on 18 Sep and never
merged back; `git log` there looks perfectly healthy, the branch name says nothing, and `wrangler deploy`
in it does exactly what it appears to do - replace the whole worker with a build 90-odd versions behind.
Four deploys from it on 23-24 Sep (v156, v156.1, v156.2 and one no-op) took `/start` and every
`/building/<district>/<id>` page off live until the Rings session restored `dewa-screens` HEAD; the same
tree cost 57 commits on 18 Sep. Live is built from **`dewa-screens`** (worktree `C:\Dev\azimuth-worker-dewa`).
Ship a change as a branch off `dewa-screens` (this one travelled as `sobha/v156-mask`), let the owner of
that branch merge, run the suites and deploy TAGGED. To see a change against real data without touching
live: `wrangler versions upload --env azimuth2` gives a preview URL. `DO_NOT_DEPLOY_FROM_HERE.md` at the
root of the old tree says the same in more detail.
