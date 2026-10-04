// v298 - DATA PATCH for the two adjoining DAMAC Hills Piccadilly Green townhouses (K015B, K016B). READ-ONLY on KV: it reads the live
// img_rent_index and img_brief_fp_damachills, builds the patched JSON locally, writes it to OUT_DIR and prints a diff summary and the
// publish commands. It never writes to KV. Run from the worker repo:   node scripts/two_villas_v298_patch.mjs [OUT_DIR]
// Source geometry: naj-market-pulse data/lab/briefs/k015b_k016b_plots.json (UTM 40N: plot polygon + as-built building outline).
// Owner details are NOT read, NOT carried.
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { execSync } from "child_process";

const NS = "2cdf36a27f834b5f9c726294d36770fb", ENVN = "azimuth2";
const OUT = process.argv[2] || path.join(process.cwd(), "v298_out");
const SRC = process.env.PLOTS_JSON || "C:/Dev/naj-market-pulse/data/lab/briefs/k015b_k016b_plots.json";
fs.mkdirSync(OUT, { recursive: true });

export const VILLAS = [
  { slug: "k015b", parcel: "6766257", name: "Villa K015B, Land 740, DAMAC Hills - Piccadilly Green", id: 2001 },
  { slug: "k016b", parcel: "6766245", name: "Villa K016B, Land 741, DAMAC Hills - Piccadilly Green", id: 2002 },
];
const COMMUNITY_P = "damachillspiccadillygreen", COMMUNITY_SAY = "DAMAC Hills - Piccadilly Green";
const HEIGHT_M = 8;   // G + 1 + 50% roof (zoning), drawn as a simple block

function kvGet(key) {   // a plain or gzipped JSON value, as src/brief.js kvJson reads it
  const raw = execSync(`npx wrangler kv key get ${key} --text --env ${ENVN} --namespace-id ${NS}`, { cwd: process.env.WORKER_DIR || "C:/Dev/azimuth-worker-dewa", maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
  const txt = raw[0] === 0x1f && raw[1] === 0x8b ? zlib.gunzipSync(raw).toString("utf8") : raw.toString("utf8");
  return JSON.parse(txt.slice(txt.indexOf("{")));
}
const area = (r) => { let s = 0; for (let i = 0; i + 1 < r.length; i++) s += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; return Math.abs(s) / 2; };
const inside = (p, ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, yi] = ring[i], [xj, yj] = ring[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) c = !c; } return c; };

const plots = JSON.parse(fs.readFileSync(SRC, "utf8"));
const ri = kvGet("img_rent_index"), fp = kvGet("img_brief_fp_damachills");
const comm = ri.items.find((it) => it.p === COMMUNITY_P);
if (!comm || !comm.v || !comm.v["3"]) throw new Error("the community record or its 3-bed evidence is not in the live rent index");
const maxId = Math.max(...fp.b.map((b) => b[0]));
if (VILLAS.some((v) => v.id <= maxId)) throw new Error("new footprint ids collide with the layer (max " + maxId + ")");

// ---- footprint layer: our two outlines, in the layer's own units (UTM minus o); the orphan OSM footprints that sit inside the two plots go
const o = fp.o, removed = [];
const plotsLocal = VILLAS.map((v) => plots[v.parcel].plot_utm.map(([E, N]) => [E - o[0], N - o[1]]));
const kept = fp.b.filter((b) => {
  const g = b[2]; let cx = 0, cy = 0, n = 0; for (let k = 0; k + 1 < g.length; k += 2) { cx += g[k]; cy += g[k + 1]; n++; }
  const c = [cx / n, cy / n];
  if (plotsLocal.some((pl) => inside(c, pl)) && !VILLAS.some((v) => v.id === b[0])) { removed.push(b[0]); return false; }
  return !VILLAS.some((v) => v.id === b[0]);
});
const fp2 = Object.assign({}, fp, { b: kept.slice() });
for (const v of VILLAS) {
  const ring = plots[v.parcel].building_utm.map(([E, N]) => [Math.round((E - o[0]) * 10) / 10, Math.round((N - o[1]) * 10) / 10]);
  fp2.b.push([v.id, HEIGHT_M, ring.flat()]);
}

// ---- rent index: two records, the community's evidence copied verbatim, flagged as the community's (ev_scope); no owner fields
const items = ri.items.filter((it) => !VILLAS.some((v) => it.p === COMMUNITY_P + v.slug));
for (const v of VILLAS) {
  items.push({ p: COMMUNITY_P + v.slug, n: v.name, area: comm.area, d: comm.d, last: comm.last, v: JSON.parse(JSON.stringify(comm.v)),
    fp: [v.id], ev_scope: COMMUNITY_SAY, render_basis: "plot_outline", parcel: v.parcel, plot_m2: Math.round(area(plots[v.parcel].plot_utm) * 100) / 100 });
}
const ri2 = Object.assign({}, ri, { items });

fs.writeFileSync(path.join(OUT, "img_rent_index.v298.json"), JSON.stringify(ri2));
fs.writeFileSync(path.join(OUT, "img_brief_fp_damachills.v298.json"), JSON.stringify(fp2));
console.log("rent index: " + ri.items.length + " -> " + ri2.items.length + " items (+" + VILLAS.map((v) => COMMUNITY_P + v.slug).join(", +") + "); community record untouched");
console.log("footprint layer: " + fp.b.length + " -> " + fp2.b.length + " footprints; added ids " + VILLAS.map((v) => v.id).join(",") + "; removed orphan OSM footprints inside the two plots: " + (removed.join(",") || "none"));
for (const v of VILLAS) console.log(v.slug + ": plot " + area(plots[v.parcel].plot_utm).toFixed(2) + " m2, outline " + area(plots[v.parcel].building_utm).toFixed(2) + " m2, key dld:" + COMMUNITY_P + "-" + v.slug);
console.log("\nPUBLISH (Kendall; writes production KV - run from C:\\Dev\\azimuth-worker-dewa):");
for (const [k, f] of [["img_brief_fp_damachills", "img_brief_fp_damachills.v298.json"], ["img_rent_index", "img_rent_index.v298.json"]])
  console.log(`  npx wrangler kv key put ${k} --path "${path.join(OUT, f)}" --env ${ENVN} --namespace-id ${NS}`);
