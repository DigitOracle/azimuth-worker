// v805 sample: The Woods (Sobha) report with the new cover (picture + launch + developer DNA) and the Esri map. Writes HTML for a screenshot.
// node test/sample_v805_woods.mjs <launches.json> <report_data.json> <dna.json> <logo_b64.txt> <out.html>
import { readFileSync, writeFileSync } from "node:fs";
import { reportHtml, tidyLaunches, pickRows, addMaps } from "../src/launch_report.js";
const [L, D, N, LOGO, OUT] = process.argv.slice(2);
const snap = tidyLaunches(JSON.parse(readFileSync(L, "utf8"))), rep = JSON.parse(readFileSync(D, "utf8")), dna = JSON.parse(readFileSync(N, "utf8"));
const row = snap.rows.find((r) => r.project === "The Woods");
const rows = pickRows(snap.rows, [row.key]), data = rep.rows;
const e = data[row.key];
if (!e.lat) {   // the 04:00 job will carry e.lat/e.lon; for this sample, back-solve the pin from the Burj Khalifa mark (km + bearing)
  const m = e.marks.find((x) => /Burj/.test(x.name)), R = 6371, b = ((m.deg + 180) % 360) * Math.PI / 180, d = m.km / R;
  const la1 = 25.1972 * Math.PI / 180, lo1 = 55.2744 * Math.PI / 180;
  const la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(b));
  const lo2 = lo1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la1), Math.cos(d) - Math.sin(la1) * Math.sin(la2));
  e.lat = la2 * 180 / Math.PI; e.lon = lo2 * 180 / Math.PI;
}
await addMaps(rows, data);
console.log("pin", e.lat.toFixed(4), e.lon.toFixed(4), "map", !!e._map, e._map && e._map.ref ? "with labels" : "");
let html = reportHtml(rows, data, { title: "The Woods · Najma Launch Report", sub: "8 Nov 2026", by: "kendall", dna });
html = html.replace(/(["'])najma_logo\.png\1/g, '"data:image/png;base64,' + readFileSync(LOGO, "utf8").trim() + '"');
writeFileSync(OUT, html);
