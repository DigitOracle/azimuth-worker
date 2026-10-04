// v314 - replay the coverage audit's 410 query cells through the Brief's own code (src/brief.js briefSearch), against local copies of the
// KV files, and count the empty ones. READ-ONLY: nothing is fetched, nothing is written to KV.
//   node scripts/cov_matrix_replay.mjs <src dir> <cells.json> [--rent <rent_index file>] [--map <map_prices file>] [--board <dir of unitmix_*.json>] [--extra <dir>] [--out file]
// <src dir>   C:\Dev\_cov_v314\src (the fixed code) or C:\Dev\_rel312\src (release-v312, the negative control)
// <cells.json> scratchpad\cov\cells.json (the audit's matrix: area, mode, bed, type, the live result, the audit's cause)
// --extra     a directory whose files are named img-key.json (e.g. unitmix_alyelayiss1.json): they override the board copy (v314 cards)
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { pathToFileURL } from "node:url";

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const SRC = path.resolve(args[0]), CELLS = args[1];
const RENT = flag("--rent"), MAP = flag("--map"), BOARD = flag("--board", "C:/Dev/naj-market-pulse/data/board"), EXTRA = flag("--extra"), OUT = flag("--out");
const GEO = flag("--geo");   // --no-area-figure: run without the v314 area-figure fallback (fix 1 alone)

function readMaybeGz(p) { let b = fs.readFileSync(p); if (b[0] === 0x1f && b[1] === 0x8b) b = zlib.gunzipSync(b); return b; }
const cache = new Map();
function fileFor(name) {                      // name = the key without "img_"
  if (name === "rent_index" && RENT) return RENT;
  if (name === "map_prices" && MAP) return MAP;
  if (name === "districts_geo" && GEO) return GEO;
  if (EXTRA && fs.existsSync(path.join(EXTRA, name + ".json"))) return path.join(EXTRA, name + ".json");
  const p = path.join(BOARD, name + ".json");
  return fs.existsSync(p) ? p : null;
}
const KV = {
  async get(key, opts) {
    const name = String(key).replace(/^img_/, "");
    const f = fileFor(name); if (!f) return null;
    let buf = cache.get(f); if (!buf) { buf = readMaybeGz(f); if (buf.length < 30e6) cache.set(f, buf); }
    const asBuf = opts === "arrayBuffer" || (opts && opts.type === "arrayBuffer");
    return asBuf ? buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) : buf.toString("utf8");
  },
  async list() { return { keys: [], list_complete: true }; },
};
const env = { MEETINGS: KV };
const mod = await import(pathToFileURL(path.join(SRC, "brief.js")).href);
const cells = JSON.parse(fs.readFileSync(CELLS, "utf8"));
const rows = [];
for (const c of cells) {
  mod.__resetKvMemo && mod.__resetKvMemo();
  const sp = new URLSearchParams(c.params);
  const r = await mod.briefSearch(env, sp, { owner: false, live: false, areaFigure: !args.includes("--no-area-figure") });
  const res = (r.body && r.body.results) || [];
  rows.push({ area: c.area, mode: c.mode, bed: c.bed, tclass: c.tclass, reg_n: c.reg_n, cause: c.cause, live_empty: c.live_empty, empty: res.length === 0 ? 1 : 0,
    nres: res.length, area_rows: res.filter((x) => x.area_figure).length, status: r.status, names: res.slice(0, 2).map((x) => x.name) });
}
const sum = (a, f) => a.reduce((t, x) => t + f(x), 0);
const emp = rows.filter((r) => r.empty);
const by = {}; for (const r of emp) { const k = r.cause || "(none)"; by[k] = by[k] || { cells: 0, reg: 0 }; by[k].cells++; by[k].reg += r.reg_n; }
const out = { src: SRC, cells: rows.length, empty: emp.length, empty_buy: emp.filter((r) => r.mode === "buy").length, empty_rent: emp.filter((r) => r.mode === "rent").length,
  empty_reg_records: sum(emp, (r) => r.reg_n), agree_with_live: rows.filter((r) => r.empty === r.live_empty).length, cells_answered_by_area_figure: rows.filter((r) => r.area_rows > 0 && r.nres === r.area_rows).length, by_cause: by };
console.log(JSON.stringify(out, null, 1));
if (OUT) fs.writeFileSync(OUT, JSON.stringify({ summary: out, rows }, null, 0));
