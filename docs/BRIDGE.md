# Momo bridge (src/work_bridge.js)

A JSON door for a person's OWN Claude Code. Key only in `Authorization: Bearer <key>` (never `?key=`), every POST carries
`Idempotency-Key`, 120 calls a minute per key, every call logged (person, route, status, time; never the content).
The full Najjuko-facing handover lives in the working folder: `Client_Engagements/FN_Realty/Bridge/` (HANDOVER_MOMO_BRIDGE_*.md,
momo-bridge/SKILL.md + scripts/momo.py).

## v675 - Product data sheets through the bridge (for Najjuko's Claude Code)

1. `GET /momo/bridge/v1/sheets` lists the loaded sheets plus her own uploads: `{slug,title,group,kind,ext,share,file,thumb,uploaded_by,added_at}`.
2. `POST /momo/bridge/v1/sheet` with JSON `{"title": "...", "group": "My sheets", "filename": "x.png", "content_b64": "<base64>"}` adds a PNG / JPEG / WebP / PDF (type sniffed from the bytes, at most 12 MB decoded); answer `{ok, slug, share, file, kind, ext, bytes, data}`.
3. `POST /momo/bridge/v1/sheet/delete` with `{"slug": "..."}` removes one of HER uploads (a loaded sheet answers 403 `not_yours`).
4. Headers on every call: `Authorization: Bearer $MOMO_BRIDGE_KEY`; on POST also `Idempotency-Key: $(uuidgen)` and `Content-Type: application/json`.
5. `curl -sS -X POST "$B/sheet" -H "Authorization: Bearer $MOMO_BRIDGE_KEY" -H "Idempotency-Key: $(uuidgen)" -H "Content-Type: application/json" --data-binary @body.json` where `B=https://azimuth-2.digitalchemy.workers.dev/momo/bridge/v1` and body.json is the object in step 2.
6. Codes: 401 `unauthorized`, 400 `no_title` / `no_content` / `bad_slug`, 413 `too_big`, 415 `bad_type`, 403 `not_yours`, 404 `not_found`, 429 `rate_limited`. Helper: `momo.py add-sheet --file <path> --title "..." [--group ...]`, `momo.py sheets`, `momo.py delete-sheet --slug <slug>`.
