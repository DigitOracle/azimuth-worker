// Builds the delivery payload the investor PDF reads from KV img_devmap_delivery (v339). READ-ONLY here: it only writes a local JSON file.
//   node scripts/build_devmap_delivery.mjs <devmap_index.json> <dld__projects csv> <out.json>
// Shape: { as_of, by: { "<area slug>|<developer id>": { done:[projects, homes], active:[projects, homes, average percent complete], pending:[projects, homes], top:[[project, "active", percent, homes] x3] } },
//          area: { "<area slug>": { done:[p,h], active:[p,h], pending:[p,h] } } }
// A project is matched to an area by the register's area name (the index carries it as ev.dld) and to a developer by the developer crosswalk (src/devcross.js).
// Handed over = status FINISHED; active = ACTIVE; pending = not started, pending or conditional. No dates are used: the register overwrites the planned handover date.
import fs from "node:fs";
import { resolve } from "../src/devcross.js";

const [idxPath, csvPath, outPath] = process.argv.slice(2);
if (!idxPath || !csvPath || !outPath) { console.error("usage: node scripts/build_devmap_delivery.mjs <devmap_index.json> <projects csv> <out.json>"); process.exit(2); }
const IDX = JSON.parse(fs.readFileSync(idxPath, "utf8"));
function parseCsv(t) {
  const rows = []; let row = [], f = "", q = false;
  t = t.replace(/^﻿/, "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(f); f = ""; } else if (c === "\n") { row.push(f.replace(/\r$/, "")); rows.push(row); row = []; f = ""; } else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const h = rows.shift(); return rows.filter((r) => r.length === h.length).map((r) => Object.fromEntries(h.map((k, i) => [k, r[i]])));
}
const reg = parseCsv(fs.readFileSync(csvPath, "utf8"));
const slugOf = new Map();
for (const [s, a] of Object.entries(IDX.areas)) for (const n of (a.ev && a.ev.dld) || []) slugOf.set(String(n).toLowerCase().trim(), s);
const bucket = (st) => (st === "FINISHED" ? "done" : st === "ACTIVE" ? "active" : st === "NOT_STARTED" || st === "PENDING" || st === "CONDITIONAL_ACTIVATING" ? "pending" : null);
const blank = () => ({ done: [0, 0], active: [0, 0, 0], pending: [0, 0], top: [], _w: 0 });
const by = {}, area = {};
const add = (o, b, homes, pct, name) => { const e = o[b]; e[0]++; e[1] += homes; if (b === "active") { o._w += homes || 1; e[2] += (pct || 0) * (homes || 1); o.top.push([name, "active", pct || 0, homes]); } };
for (const r of reg) {
  const b = bucket(r.project_status), slug = slugOf.get(String(r.area_name_en || "").toLowerCase().trim());
  if (!b || !slug || (r.cancellation_date || "").trim()) continue;
  const homes = (Number(r.no_of_units) || 0) + (Number(r.no_of_villas) || 0), pct = Number(r.percent_completed) || 0;
  add(area[slug] || (area[slug] = blank()), b, homes, pct, r.project_name);
  // the register's developer field often names the land owner (a master developer), so a recognised brand in the project name wins
  const byProject = resolve(r.project_name, "project"), k = byProject.how !== "singleton" ? byProject.id : resolve(r.developer_name, "company").id;
  if (k && IDX.areas[slug].devs && IDX.areas[slug].devs[k]) add(by[slug + "|" + k] || (by[slug + "|" + k] = blank()), b, homes, pct, r.project_name);
}
const fin = (o) => { o.active[2] = o._w ? Math.round(o.active[2] / o._w * 10) / 10 : null; o.top = o.top.filter((t) => !/[\u0600-\u06FF]/.test(t[0])).sort((a, b) => b[3] - a[3]).slice(0, 3); delete o._w; return o; };
for (const o of Object.values(by)) fin(o);
for (const o of Object.values(area)) { fin(o); delete o.top; }
const asOf = (/(\d{4}-\d{2}-\d{2})/.exec(csvPath) || [])[1] || "";
fs.writeFileSync(outPath, JSON.stringify({ as_of: asOf, by, area }));
console.log("wrote", outPath, Object.keys(by).length, "developer-in-area records,", Object.keys(area).length, "areas");
