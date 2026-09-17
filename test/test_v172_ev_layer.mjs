// v172 — EV CHARGING ON THE MAP (Kendall, 17 Sep 2026: "we have pulled EV charging stations ... it's not pulled into
// our overall map, maybe we should add a filter for it").
//
// The layer itself is data: the pipeline appends 297 points with k:"ev" to the amenities image and the map's chip loop
// builds from that table, so the app needed a label, a colour and an icon and nothing else.
//
// The check worth having is the PROVENANCE one. 186 of the points come from DEWA's Green Charger register, an
// authority; 80 from OpenChargeMap and 31 from OpenStreetMap, both contributed by the public. One OSM row reads
// "DEWA · 2 bays" — on screen that is indistinguishable from a point that really is in DEWA's register, and she
// repeats these to a client standing in front of her. So the doubt goes on the row.
import worker from "../src/index.js";

const READ = "owner_admin_key_never_in_client_links_0001";
const CLIENT = "client_key_current_abcdefghij";

const store = new Map();
store.set("img_amenities", JSON.stringify({ generated: "2026-09-17", items: [
  { k: "ev", n: "JAFZA Location 03", lon: 55.1, lat: 25.0, src: "dewa", x: "DEWA · 2 bays · AC Type 2" },
  { k: "ev", n: "Gardenia Townhomes", lon: 55.2, lat: 25.1, src: "osm", x: "DEWA · 2 bays" },
  { k: "ev", n: "La Ville Hotel", lon: 55.3, lat: 25.2, src: "ocm", x: "Tesla · 1 bay · 13 kW" },
  { k: "school", n: "A School", lon: 55.4, lat: 25.3, src: "khda", x: "Good" },
] }));
const KV = {
  async get(k, t) { if (!store.has(k)) return null; const v = store.get(k); if (t === "json") { try { return JSON.parse(v); } catch (e) { return null; } } return v; },
  async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter((k) => k.startsWith(p)).map((name) => ({ name })), list_complete: true }; },
};
globalThis.fetch = async () => new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
const env = { MEETINGS: KV, READ_KEY: READ, CLIENT_KEY: CLIENT, GOOGLE_MAPS_KEY: "g", PUBLIC_ORIGIN: "https://azimuth-2.digitalchemy.workers.dev" };
const ctx = { waitUntil() {} };
const call = (p, k) => worker.fetch(new Request("https://azimuth-2.digitalchemy.workers.dev" + p + "?key=" + encodeURIComponent(k)), env, ctx);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("ok - " + m); } else { fail++; console.log("not ok - " + m); } };

const html = await (await call("/map", READ)).text();

ok(html.includes('ev:["EV charging"'), "the EV chip is in the amenity table, so the chip loop builds it with the other eight");
ok(/"ev":\s*"<svg/.test(html), "and it has its own icon, drawn in the same language as the rest");
ok(html.includes("#C9A0E8") && !/beach[^]{0,40}#C9A0E8/.test(html), "its colour is its own - every green and blue on this map already means something else");

// The provenance note, checked by running the page's own function rather than by matching a string near it.
const src = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");
const m = src.match(/function srcNote\(i\)\{[\s\S]*?\}/);
ok(!!m, "the page carries a srcNote() for provenance");
if (m) {
  const srcNote = eval("(" + m[0] + ")");
  ok(srcNote({ src: "dewa" }) === "", "a DEWA point carries no caveat - it is in the authority's own register");
  ok(/community listing/.test(srcNote({ src: "ocm" })), "an OpenChargeMap point is marked as a community listing");
  ok(/community listing/.test(srcNote({ src: "osm" })), "an OpenStreetMap point is marked the same way");
  ok(srcNote({}) === "" && srcNote(null) === "", "a point with no source says nothing rather than guessing");
}
ok(/srcNote\(x\[1\]\)/.test(src), "and the row builder actually calls it - a helper nothing calls is decoration");

// v171: the list follows the district she is looking at, rather than contradicting the line above it.
ok(html.includes("listHomes(_hd?m.filter"), "the homes list is the district's matches when a district is open");
ok(html.includes('+(inD?" in "+dName(inD):"")'), "and the panel says which district, so it cannot disagree with the count above it");

const clientHtml = await (await call("/map", CLIENT)).text();
ok(clientHtml.includes('ev:["EV charging"'), "a client link sees the chargers too - they are an amenity of a building, not owner data");

// v172.1 - WHERE the caveat sits, which only shows when the row is rendered. It used to sit between the name and the detail, and the detail
// begins with the operator, so a real row read "Dukes Dubai - community listing, unverified Tesla - 2 bays - 13 kW". That is a sentence about
// Tesla, not about the listing, and she reads these aloud to a client. Nothing may follow the caveat.
ok(/esc\(x\[1\]\.x\)[\s\S]{0,120}srcNote\(x\[1\]\)/.test(src), "the caveat is rendered AFTER the detail field, so no operator name can follow it");
ok(!/srcNote\(x\[1\]\)[\s\S]{0,60}esc\(x\[1\]\.x\)/.test(src), "and never before it");
if (m) {
  const srcNote = eval("(" + m[0] + ")");
  const strip = (t) => t.replace(/<[^>]*>/g, "");
  const row = (i) => strip("<span>" + i.n + (i.x ? " <small>" + i.x + "</small>" : "") + srcNote(i) + "</span>");
  const tesla = row({ n: "Dukes Dubai", x: "Tesla \u00b7 2 bays \u00b7 13 kW", src: "ocm" });
  ok(!/unverified\s+\S/.test(tesla), "a rendered community row never leaves a word sitting after \"unverified\": " + tesla);
  ok(/community listing, unverified$/.test(tesla.trim()), "the caveat ends the row, where it qualifies the whole listing");
  ok(row({ n: "Anantara hotel", x: "DEWA \u00b7 2 bays", src: "dewa" }).indexOf("unverified") === -1, "and a DEWA row carries no caveat at all");
}

// v173 - a building must offer the same routes however she reached it (video session, tested A/B on the live app).
// Opened from the searchbox it had "on the twin"; opened from the homes LIST it had nothing, so the path she took
// decided what she could do next. And the filter panel stayed open on top of the card it had just opened.
ok(/on the twin[\s\S]{0,40}<\/a>[\s\S]{0,80}\+\(vv\?/.test(src) || /it\.d&&!window\.__twinDistrict/.test(src), "a building opened from the homes list offers the twin too");
ok(/_hp\)_hp\.classList\.remove\("on"\);openHome/.test(src), "and opening a result closes the filter panel, so the card is not behind the thing that found it");

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
