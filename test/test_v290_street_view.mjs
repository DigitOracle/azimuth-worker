// v290 (Kendall, 2 Oct 2026: "where is the actual picture of the building?" / "approve Street View in the report") - Street View on cards.
//   T  svTarget aims at the building's own footprints, or a community's attributed homes; never an approximate position or none
//   S  streetViewFor: no secret -> no call; a good panorama -> an embedded picture with its month; too old, too far, an error or
//      Google's tiny "no imagery" tile -> null (the card keeps its Blocks view); the key never appears in the picture or label
// NEGATIVE CONTROL: make streetViewFor return null at the top - the S "good panorama" checks fail.
//   node test/test_v290_street_view.mjs
import { svTarget, streetViewFor } from "../src/brief_docs.js";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 300) : "")); } };
// a toy district layer: x = 100000*(lon-55), y = 110000*(lat-25); building 7 a 20 m square near (25.001, 55.001)
const layer = { ll: [100000, 0, -5500000, 0, 110000, -2750000], b: [[7, 30, [100, 110, 120, 110, 120, 130, 100, 130, 100, 110]], [8, 9, [400, 400, 410, 400, 410, 410, 400, 410, 400, 400]]], s: [] };
const rec = (o) => Object.assign({ n: 1, name: "Test", it: { i: null }, pos: null, um: { floors: 20 } }, o);

console.log("T - what Street View aims at");
const tb = svTarget(rec({ it: { i: 7 } }), layer);
ok(tb && Math.abs(tb.c[0] - (25 + 120 / 110000)) < 1e-6 && Math.abs(tb.c[1] - (55 + 110 / 100000)) < 1e-6, "a building aims at its own footprint's centre", JSON.stringify(tb && tb.c));
ok(tb && tb.tall === true, "a 20-floor building is aimed as a tower");
const ta = svTarget(rec({ areaIds: [8] }), layer);
ok(ta && ta.pts.length > 0 && ta.tall === false, "a community aims at its attributed homes");
ok(svTarget(rec({ pos: [25.002, 55.002] }), layer) === null, "an approximate position alone gets no Street View");
ok(svTarget(rec({}), layer) === null, "no footprint and no position: none");
ok(svTarget(rec({ it: { i: 7 } }), null) === null, "no layer: none");

console.log("S - fetching it");
const KEY = "TEST_KEY_never_shown_123";
const img = new Uint8Array(9000).fill(7);
let calls = [];
const stub = (meta, imgOk = true, size = 9000) => async (url) => {
  calls.push(String(url));
  if (String(url).includes("/metadata")) return new Response(JSON.stringify(meta), { status: 200, headers: { "Content-Type": "application/json" } });
  return imgOk ? new Response(new Uint8Array(size).fill(7), { status: 200, headers: { "Content-Type": "image/jpeg" } }) : new Response("no", { status: 500 });
};
const near = { status: "OK", pano_id: "P1", date: "2023-04", copyright: "© Google", location: { lat: 25 + 120 / 110000 + 0.0003, lng: 55 + 110 / 100000 } };   // ~33 m north
globalThis.fetch = stub(near); calls = [];
ok(await streetViewFor({}, tb) === null && calls.length === 0, "no secret: no call to Google, no picture");
calls = [];
const sv = await streetViewFor({ GOOGLE_MAPS_KEY: KEY }, tb);
ok(sv && sv.src.startsWith("data:image/jpeg;base64,") && sv.date === "Apr 2023", "a good panorama gives an embedded picture with its month", sv && sv.date);
ok(calls.length === 2 && calls[1].includes("pano=P1") && /heading=1[5-9]\d|heading=2[0-1]\d/.test(calls[1]), "the picture is aimed from the panorama at the building (heading ~180, looking south)", calls[1]);
ok(sv && !JSON.stringify(sv).includes(KEY), "the key is not in the picture or its label");
globalThis.fetch = stub(Object.assign({}, near, { date: "2016-02" }));
ok(await streetViewFor({ GOOGLE_MAPS_KEY: KEY }, tb) === null, "a panorama older than 2019 is refused");
globalThis.fetch = stub(Object.assign({}, near, { location: { lat: 25.01, lng: 55.01 } }));
ok(await streetViewFor({ GOOGLE_MAPS_KEY: KEY }, tb) === null, "a panorama far from the building is refused");
globalThis.fetch = stub({ status: "ZERO_RESULTS" });
ok(await streetViewFor({ GOOGLE_MAPS_KEY: KEY }, tb) === null, "no panorama: null");
globalThis.fetch = stub(near, false);
ok(await streetViewFor({ GOOGLE_MAPS_KEY: KEY }, tb) === null, "an image error: null");
globalThis.fetch = stub(near, true, 1200);
ok(await streetViewFor({ GOOGLE_MAPS_KEY: KEY }, tb) === null, "Google's tiny no-imagery tile: null");
globalThis.fetch = async () => { throw new Error("network"); };
ok(await streetViewFor({ GOOGLE_MAPS_KEY: KEY }, tb) === null, "a network failure: null, no crash");

console.log("A - the satellite picture when Street View has none");
{
  const { satelliteFor } = await import("../src/brief_docs.js");
  calls = [];
  globalThis.fetch = stub({ status: "ZERO_RESULTS" });
  ok(await satelliteFor({}, ta) === null && calls.length === 0, "no secret: no satellite call");
  const sat = await satelliteFor({ GOOGLE_MAPS_KEY: KEY }, ta);
  ok(sat && sat.kind === "satellite" && sat.src.startsWith("data:image/jpeg;base64,") && /maptype=satellite/.test(calls[calls.length - 1]), "a community gets its satellite picture, framed on its centre");
  ok(sat && !JSON.stringify(sat).includes(KEY), "the key is not in the satellite picture");
  globalThis.fetch = stub(near, true, 1200);
  ok(await satelliteFor({ GOOGLE_MAPS_KEY: KEY }, ta) === null, "a tiny error tile: null (the Blocks view stays)");
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
