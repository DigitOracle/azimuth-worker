// Builds the Developers-by-area PDF HTML locally from files read earlier from the live store (read-only) with a stub KV. Nothing is written anywhere live.
//   node scripts/area_pdf_samples.mjs <data dir> <out dir> <area> <kind> [budget] [beds]
// data dir holds: index.json (devmap_index), geo.json (district_polygons), fp_<area>.json, unitmix_<area>.json, map_prices.json, rent_index.json
import fs from "node:fs";
import { buildAreaPdf, parseParams } from "../src/devmap_pdf.js";
const [dir, out, area, kind, budget, beds] = process.argv.slice(2);
const files = { devmap_index: "index.json", district_polygons: "geo.json", ["brief_fp_" + area]: "fp_" + area + ".json", ["unitmix_" + area]: "unitmix_" + area + ".json", map_prices: "map_prices.json", rent_index: "rent_index.json" };
const KV = { async get(k) { const n = files[String(k).replace(/^img_/, "")]; if (!n || !fs.existsSync(dir + "/" + n)) return null; return fs.readFileSync(dir + "/" + n, "utf8"); } };
const ten = "omniyat,nakheel,meraas,emaar,imtiaz,zaya,ellington,select-group,damac,mered";
const u = new URL("https://x/developers_pdf?kind=" + kind + "&area=" + area + "&developers=" + ten + "&mode=buy" + (budget ? "&budget=" + budget + "&beds=" + beds : ""));
const d = await buildAreaPdf({ MEETINGS: KV }, parseParams(u), { now: Date.parse("2026-10-04T08:00:00Z") });
if (d.status !== 200) { console.log(d); process.exit(1); }
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(out + "/" + kind + "_" + area + ".html", d.html);
console.log(kind, area, d.pages + " pages", Math.round(d.html.length / 1024) + " KB");
