// v314 - merge a rebuilt rent index (scripts/build_rent_index_12m.py) onto a FRESH READ of the live img_rent_index, locally. Writes only --out.
//   node scripts/merge_rent_index_live.mjs --new <rebuilt json> --live <fresh live read json> --out <file>
// Every live record that the lake cannot rebuild (anything with "fp" or "ev_scope": the two Piccadilly Green option records p damachillspiccadillygreenk015b / k016b with
// footprint ids 2001 / 2002, as scripts/two_villas_v298_patch.mjs wrote them) is carried over UNCHANGED. Stops (exit 1) if one of them is missing from the result,
// if the rebuilt file has no 'areas' rows, or if it is smaller than half the live index (a failed build is never published).
import fs from "node:fs";
import zlib from "node:zlib";
const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const rd = (p) => { let b = fs.readFileSync(p); if (b[0] === 0x1f && b[1] === 0x8b) b = zlib.gunzipSync(b); return JSON.parse(b.toString("utf8")); };
const [NEW, LIVE, OUT] = [arg("--new"), arg("--live"), arg("--out")];
if (!NEW || !LIVE || !OUT) { console.error("usage: node scripts/merge_rent_index_live.mjs --new <file> --live <file> --out <file>"); process.exit(2); }
const nw = rd(NEW), live = rd(LIVE);
const fail = (m) => { console.error("STOP: " + m); process.exit(1); };
if (!Array.isArray(nw.items) || !Array.isArray(nw.areas) || nw.areas.length < 100) fail("the rebuilt index has no usable items/areas");
if (nw.items.length < live.items.length * 0.5) fail("the rebuilt index has " + nw.items.length + " records against " + live.items.length + " live: a failed build");
const have = new Set(nw.items.map((i) => i.p + "|" + i.area));
const carried = [];
for (const it of live.items) if ((it.fp || it.ev_scope) && !have.has(it.p + "|" + it.area)) { nw.items.push(it); carried.push(it.p); }
for (const it of live.items.filter((i) => i.fp || i.ev_scope)) if (!nw.items.some((x) => x.p === it.p && JSON.stringify(x.fp) === JSON.stringify(it.fp))) fail("option record " + it.p + " is not in the result");
fs.writeFileSync(OUT, JSON.stringify(nw));
console.log(JSON.stringify({ live_items: live.items.length, new_items: nw.items.length, carried_from_live: carried, live_window: live.window, new_window: nw.window, areas_rows: nw.areas.length, bytes: fs.statSync(OUT).size }, null, 1));
