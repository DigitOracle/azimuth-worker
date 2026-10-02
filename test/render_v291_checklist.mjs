// v291 CHECKLIST - a tool, not a test: writes the /checklist page as the worker serves it, for a phone screenshot.
//   node test/render_v291_checklist.mjs <out dir> [real]
// Without "real": the invented fixture (test/v291_fixture.mjs) with a saved map correction, broker facts and an own photo.
// With "real": the real DAMAC Hills rent index, anchors, units register, amenity file and district layer from naj-market-pulse
// (C:/Dev/naj-market-pulse/data and %TEMP%/brief_layers), read only - nothing is written anywhere but the out dir.
import fs from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import worker from "../src/index.js";
import { READ, ORIGIN, D, makeKV, makeEnv, jpeg } from "./v291_fixture.mjs";

const out = process.argv[2] || path.join(tmpdir(), "checklist");
const real = process.argv[3] === "real";
fs.mkdirSync(out, { recursive: true });
const KV = makeKV();
if (real) {
  const NAJ = "C:/Dev/naj-market-pulse/data", LAY = path.join(tmpdir(), "brief_layers");
  const rd = (f) => fs.readFileSync(f, "utf8");
  KV.store.clear();
  KV.store.set("img_rent_index", rd(path.join(NAJ, "board", "rent_index.json")));
  KV.store.set("img_anchors_" + D, rd(path.join(NAJ, "names", "anchors_" + D + ".json")));
  KV.store.set("img_brief_fp_" + D, rd(path.join(LAY, "brief_fp_" + D + ".json")));
  KV.store.set("img_amenities_" + D, rd(path.join(NAJ, "amenities", "amenities_" + D + ".json")));   // the amenity facts file (build_amenities.py)
  for (const f of ["units_" + D, "districts_geo"]) { const p = path.join(NAJ, "board", f + ".json"); if (fs.existsSync(p)) KV.store.set("img_" + f, rd(p)); }
}
const env = makeEnv(KV);
globalThis.fetch = async () => new Response("{}", { status: 200 });
const call = (p, init) => worker.fetch(new Request(ORIGIN + p, init), env, { waitUntil() {} });
const H = { "X-Owner-Key": READ, "Content-Type": "application/json" };
if (!real) {
  await call("/checklist/save", { method: "POST", headers: H, body: JSON.stringify({ d: D, kind: "map", cluster: "DAMAC HILLS - BROOKFIELD-1", ids: [10, 11] }) });
  await call("/checklist/save", { method: "POST", headers: H, body: JSON.stringify({ d: D, kind: "facts", cluster: "DAMAC HILLS - TOPANGA", facts: { private_pool: "some", home_type: "townhouse_row", gym: "yes", furnished: "often" } }) });
  await call("/checklist/photo?d=" + D + "&c=Akoya%20One", { method: "POST", headers: { "X-Owner-Key": READ, "Content-Type": "image/jpeg" }, body: jpeg(1600, 1200) });
}
const html = await (await call("/checklist?d=" + D + "&key=" + READ)).text();
fs.writeFileSync(path.join(out, "checklist" + (real ? "_real" : "") + ".html"), html);
const data = JSON.parse(/<script type="application\/json" id="cdata">([\s\S]*?)<\/script>/.exec(html)[1]);
console.log(data.done + " of " + data.total + " complete");
for (const r of data.rows) console.log((r.complete ? "done " : "todo ") + r.name + " | mapped " + r.mapped.n + (r.mapped.warn ? " WARN " + r.mapped.warn : "") + " | " + r.picture.kind + " | amen " + r.amen.filter((a) => a.ok).length + "/6");
