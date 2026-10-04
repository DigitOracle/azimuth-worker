// v314 - merge the register-built Buy cards (scripts/build_coverage_cards.py) onto LIVE copies of the KV files, locally. READ-ONLY on KV and on the inputs:
// it writes only into --out. scripts/publish_cov_cards.ps1 reads the live values first (scripts/kv_read_live.mjs), runs this, shows the diff, then puts.
//   node scripts/merge_cov_cards.mjs --cards <cov_cards dir> --live <dir of live files: unitmix_<slug>.json, map_prices.json> --out <dir> [--summary file]
// Rules (each one is a test in test/test_v314_coverage.mjs):
//   - a district's card file keeps EVERY existing card untouched; synthetic cards (synthetic: true) are added under ids 900000+ and REPLACE any synthetic card
//     a previous run published (a rebuild never duplicates); an id that a non-synthetic card holds is a collision and stops the run
//   - a register-built card whose name key matches a PRICED card of the live file is dropped (the app already answers it; nothing is counted twice)
//   - map_prices: the Liwan items with a footprint are appended unless the live file already has that (d, i); every other field of the live file is kept
//   - buy_extra: only items whose card survived (or that are real cards with no position) are written
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { nkey } from "../src/brief.js";

const arg = (n) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null; };
const CARDS = arg("--cards"), LIVE = arg("--live"), OUT = arg("--out"), SUM = arg("--summary");
if (!CARDS || !LIVE || !OUT) { console.error("usage: node scripts/merge_cov_cards.mjs --cards <dir> --live <dir> --out <dir> [--summary file]"); process.exit(2); }
fs.mkdirSync(OUT, { recursive: true });
const rd = (p) => { let b = fs.readFileSync(p); if (b[0] === 0x1f && b[1] === 0x8b) b = zlib.gunzipSync(b); return JSON.parse(b.toString("utf8")); };
const priced = (c) => (c.rows || []).some((r) => r.median_aed);
const namesOf = (c) => [c.name, c.dld && c.dld.project, c.dld_sales && c.dld_sales.project].filter(Boolean).map(nkey).filter(Boolean);
const onCard = (k, names) => names.some((n) => k === n || (n.length >= 6 && k.length >= 6 && (n.includes(k) || k.includes(n))));

const summary = { districts: [], map_prices: null, buy_extra: null, dropped_as_already_answered: [] };
const survivors = new Set();                                                    // "d:i" of every synthetic card kept
for (const f of fs.readdirSync(CARDS).filter((x) => /^unitmix_.+\.synthetic\.json$/.test(x)).sort()) {
  const slug = f.replace(/^unitmix_|\.synthetic\.json$/g, "");
  const syn = rd(path.join(CARDS, f));
  const lp = path.join(LIVE, `unitmix_${slug}.json`);
  const base = fs.existsSync(lp) ? rd(lp) : { district: slug, generated: syn.generated, buildings_by_id: {} };
  const b = base.buildings_by_id || {}, before = Object.keys(b).length;
  const old = Object.keys(b).filter((k) => b[k] && b[k].synthetic);
  for (const k of old) delete b[k];                                             // a rebuild replaces the previous synthetic set
  const names = new Set(); for (const c of Object.values(b)) if (priced(c)) for (const n of namesOf(c)) names.add(n);
  let added = 0, dropped = 0;
  for (const [id, c] of Object.entries(syn.buildings_by_id || {})) {
    if (b[id]) throw new Error(`${slug}: id ${id} is held by a card that is not register-built; refusing to overwrite it`);
    const k = nkey(c.name);
    if (k && onCard(k, [...names])) { dropped++; summary.dropped_as_already_answered.push(`${slug}: ${c.name}`); continue; }
    b[id] = c; survivors.add(`${slug}:${id}`); added++;
  }
  base.buildings_by_id = b;
  fs.writeFileSync(path.join(OUT, `unitmix_${slug}.json`), JSON.stringify(base));
  summary.districts.push({ slug, cards_before: before, replaced_previous_synthetic: old.length, added, dropped_already_answered: dropped, cards_after: Object.keys(b).length, new_file: !fs.existsSync(lp) });
}
// ---- buy_extra: items for the surviving synthetic cards, and the real position-less cards
const bx = rd(path.join(CARDS, "buy_extra.json"));
const keep = bx.items.filter((it) => (it.syn ? survivors.has(`${it.d}:${it.i}`) : true));
fs.writeFileSync(path.join(OUT, "buy_extra.json"), JSON.stringify({ ...bx, items: keep }));
summary.buy_extra = { items_built: bx.items.length, items_written: keep.length };
// ---- map_prices: the Liwan items with a footprint
const mpAdd = rd(path.join(CARDS, "map_prices_add.json")).items || [];
const mpPath = path.join(LIVE, "map_prices.json");
if (fs.existsSync(mpPath)) {
  const mp = rd(mpPath), have = new Set(mp.items.map((m) => m.d + ":" + m.i));
  const add = mpAdd.filter((x) => !have.has(x.d + ":" + x.i));
  const merged = { ...mp, items: mp.items.concat(add) };
  if (typeof mp.count === "number") merged.count = merged.items.length;
  fs.writeFileSync(path.join(OUT, "map_prices.json"), JSON.stringify(merged));
  summary.map_prices = { items_before: mp.items.length, added: add.map((x) => `${x.d}:${x.i} ${x.n}`), items_after: merged.items.length };
}
if (SUM) fs.writeFileSync(SUM, JSON.stringify(summary, null, 1));
console.log(JSON.stringify(summary, null, 1));
