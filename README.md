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

## Momo forward (v334)
Kendall's food and exercise log (Momo) lives on azimuth-2. This instance holds his WhatsApp number, so it hands his Momo messages on: a text starting `momo`, `food:` / `gym:` / `ex:` style prefixes,
`gym 40 min`, `12000 steps`, a photo captioned `lunch` or `food`, a Momo Undo button, or a voice note that opens with the word "momo". It uses the AZIMUTH_2 service binding and the WA_FORWARD_TOKEN secret that already
carry Najjuko's messages the other way, and it is switched on by `MOMO_FORWARD = "AZIMUTH_2"` in wrangler.toml (remove the line to switch it off). Everything else he writes is handled here exactly as before.
If azimuth-2 cannot be reached he is told so and the line is NOT filed as a task. `/walog` shows `momo: {forwarded, status}` on the last message.
