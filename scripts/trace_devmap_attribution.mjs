// v325 - TRACE how every building in the Developers map got its developer. Read-only; writes ONE local JSON (the trace) and, optionally, the index it built.
//   node scripts/trace_devmap_attribution.mjs <work dir with districts_geo_all.json map_prices.json rent_index.json ejari_projects_index.json area_register.json area_evidence.json um/> <cards dir> <shares.json> <out trace.json> [--slugs a,b,c] [--index-out file]
// Same inputs and same build call as scripts/publish_devmap_all_v323.ps1 (final pass), so the trace is of the index the publish would write.
import fs from "node:fs";
import path from "node:path";
import { buildIndex } from "./build_devmap_index.mjs";
import { canonicalOf } from "../src/devcross.js";

const [work, cards, shares, out] = process.argv.slice(2, 6);
const opt = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };
const rd = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const slugs = opt("--slugs", "majan,madinatalmataar,jabalalifirst,alkhairanfirst,alhebiahfifth,dubaiinvestmentparkfirst,dubaiinvestmentparksecond,alyelayiss1,alyelayiss2,alyufrah1,wadialsafa4,wadialsafa5,palmdeira").split(",");
const prices = rd(path.join(work, "map_prices.json"));
const trace = [];
const idx = buildIndex({
  umDir: path.join(work, "um"), prices, rent: rd(path.join(work, "rent_index.json")), geo: rd(path.join(work, "districts_geo_all.json")),
  ejariProjects: fs.existsSync(path.join(work, "ejari_projects_index.json")) ? rd(path.join(work, "ejari_projects_index.json")) : null,
  outAsOf: String(prices.generated || "").slice(0, 10), shares: rd(shares), offplanDir: cards, offplanSlugs: slugs,
  regdev: opt("--regdev", null) ? rd(opt("--regdev", null)) : null,
  register: rd(path.join(work, "area_register.json")), evidence: opt("--evidence", null) ? rd(opt("--evidence", null)) : (fs.existsSync(path.join(work, "area_evidence.json")) ? rd(path.join(work, "area_evidence.json")) : null), traceOut: trace,
});
for (const t of trace) t.canon = t.dev ? canonicalOf(t.dev) : "_";
fs.writeFileSync(out, JSON.stringify(trace));
const io = opt("--index-out", null); if (io) fs.writeFileSync(io, JSON.stringify(idx));
console.log("buildings traced", trace.length, "areas", Object.keys(idx.areas).length, "developers", Object.keys(idx.devs).length);
