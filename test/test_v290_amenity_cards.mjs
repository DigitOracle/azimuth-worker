// v290 AMENITY CARDS (src/amenity_cards.js) - through the real worker (index.js dispatch) with a stubbed KV and a stubbed Google.
//
// What this proves:
//   1. cards appear ONLY for ticked must-haves that name a place (pets -> dog parks + parks; community_pool; gym; schools; metro, or bus
//      stops where no metro station is on file); parking / balcony / modern / long_term / private_pool open none; nice-to-haves open none
//   2. the counts are right (a portal-sourced spot and an unknown type are not counted); names are named-first, at most five
//   3. a portal source is refused everywhere: not counted, not named, its picture route answers 404
//  11. Google's place counts are asked LIVE (Places Aggregate, the request from counts_<district>.json, the key in a header), shown with
//      "Google Maps" beside the number, never read from the file (a planted stored count is not shown) and never written; schools lead
//      with Google's live count and names (OpenStreetMap is sparse for schools); metro with none inside says the nearest station
//   4. the Google key never appears in the Brief page, the cards JSON, the photo response headers or the PDF's HTML; it IS used server-side
//   5. /amenity_photo and /amenity_cards require the owner or a client key (no key, a wrong key: 401); a POST is refused
//   6. the fallbacks: no GOOGLE_MAPS_KEY secret -> no picture on any card, photo route 404, PDF still builds; Google answering 500, with
//      a non-image, or never answering (the timeout) -> 404 / the card without its picture, and the document still builds
//   7. a Places photo is shown only with its author ("Photo: <author> · Google Maps"); Street View with "© Google" and its month
//   8. the PDFs: Compare and Full pack carry "Around the community" with the picture embedded (data:), in the pack before the appendix;
//      a dossier, or no place-type must-have, carries none
//   9. the page script: drawRes() calls window.__amenCards; the script inserts the cards above the homes list (before .sa) and its
//      <img> points at /amenity_photo with the Brief's key, never at Google
//  10. the portal list agrees with src/brief_docs.js; a gzipped spots file reads
// NEGATIVE CONTROLS: (a) in-process, below: a deliberately leaky string and a deliberately wrong must-to-type mapping are fed through the
// same checks, which must fail them; (b) by hand (see the commit message): delete the isPortalSpot filter in loadSpots(), or the
// clientOk line in amenityRoutes(), and this file fails.
//
//   node test/test_v290_amenity_cards.mjs
import fs from "node:fs";
import vm from "node:vm";
import worker from "../src/index.js";
import { __setLauncher } from "../src/brief_docs.js";
import { amenityCards, MUST_TO_TYPES, PORTAL_RX, AMENITY_CARDS_JS, __setAmenityFetch } from "../src/amenity_cards.js";
import { makeKV, READ, CLIENT, GKEY, ORIGIN, TINY_JPEG, LIVE_COUNTS, LIVE_SCHOOLS, COUNTS_DAMAC } from "./v290_fixture.mjs";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 600) : "")); } };

const { KV } = makeKV();
const env = { MEETINGS: KV, READ_KEY: READ, CLIENT_KEY: CLIENT, INGEST_TOKEN: "ING", PUBLIC_ORIGIN: ORIGIN, BROWSER: { fetch() {} }, GOOGLE_MAPS_KEY: GKEY };
const envNoKey = Object.assign({}, env); delete envNoKey.GOOGLE_MAPS_KEY;

// ---- Google, stubbed: records every URL; GOOGLE_MODE picks the answer -----------------------------------------------------------------
let googleCalls = [], livePosts = [], GOOGLE_MODE = "ok";
globalThis.fetch = async (u, o) => {
  const s = String(u && u.url ? u.url : u);
  if (/googleapis\.com/.test(s)) {
    if (GOOGLE_MODE === "hang") return new Promise((res, rej) => { const sig = o && o.signal; if (sig) sig.addEventListener("abort", () => rej(new Error("aborted"))); });
    if (o && o.method === "POST") {                     // the live answers: Places Aggregate counts and Places Nearby Search
      const body = JSON.parse(o.body || "{}");
      livePosts.push({ u: s, h: o.headers || {}, body });
      if (GOOGLE_MODE === "500") return new Response("server error", { status: 500 });
      if (/v1:computeInsights$/.test(s)) { const c = LIVE_COUNTS[body.filter.typeFilter.includedTypes[0]]; return Response.json(c == null || c === "0" ? {} : { count: c }); }
      if (/places:searchNearby$/.test(s)) return Response.json({ places: LIVE_SCHOOLS.map((t) => ({ displayName: { text: t } })).concat([{ displayName: { text: "Closed School" }, businessStatus: "CLOSED_PERMANENTLY" }]) });
      return new Response("?", { status: 404 });
    }
    // v290.2 - Place Details (photos only): the place's current photo and its author, from the fixture's authors (Carson Pool has none)
    const det = /places\.googleapis\.com\/v1\/places\/ChIJ([A-Za-z0-9]+)$/.exec(s.split("?")[0]);
    if (det && GOOGLE_MODE === "ok") {
      const AUTH = { dog1: ["Test Author One"], portal: ["Someone"], pool1: ["Pool Author"], pool2: [], gym1: ["Gym Author"], g3: ["X"] }[det[1]] || [];
      return Response.json({ photos: [{ name: "places/ChIJ" + det[1] + "/photos/AaTEST" + det[1], authorAttributions: AUTH.map((a) => ({ displayName: a })) }] });
    }
    googleCalls.push(s);
    if (GOOGLE_MODE === "500") return new Response("server error", { status: 500 });
    if (GOOGLE_MODE === "html") return new Response("<html>quota</html>", { status: 200, headers: { "Content-Type": "text/html" } });
    return new Response(TINY_JPEG, { status: 200, headers: { "Content-Type": "image/jpeg" } });
  }
  return new Response("{}", { status: 200 });
};
__setAmenityFetch(null);
let printed = [];
__setLauncher(async () => ({ async newPage() { return { async setViewport() {}, async setContent(h) { printed.push(h); }, async evaluate() { return true; },
  async pdf() { return new TextEncoder().encode("%PDF-1.7 stub"); } }; }, async close() {} }));

const call = (p, e, init) => worker.fetch(new Request(ORIGIN + p, init), e || env, { waitUntil() {} });
const cardsOf = async (qs, e) => { const r = await call("/amenity_cards?" + qs + "&key=" + CLIENT, e); return { r, j: r.status === 200 ? await r.json() : null }; };
const types = (j) => j.cards.map((c) => c.d + ":" + c.type).join(",");
const GAPI = /(maps|places)\.googleapis\.com/;   // Google's picture services (fonts.googleapis.com, the page fonts, is not one)
const hasKey = (s) => String(s).includes(GKEY) || String(s).includes(encodeURIComponent(GKEY));

// ---- 1. only ticked must-haves that name a place -------------------------------------------------------------------------------------
let { r, j } = await cardsOf("areas=damachills&musts=pets");
ok(r.status === 200 && types(j) === "damachills:dog_park,damachills:park", "pets -> a dog-park card and a parks card", r.status + " " + JSON.stringify(j));
({ j } = await cardsOf("areas=damachills&musts=community_pool,gym,schools"));
ok(types(j) === "damachills:community_pool,damachills:gym,damachills:school", "community pool, gym, schools -> one card each, in the order asked", types(j));
({ j } = await cardsOf("areas=damachills&musts=parking,balcony,modern,long_term,private_pool"));
ok(j.cards.length === 0, "parking, balcony, modern, long-term and private pool open no card (they are about the home, not a place)", types(j));
({ j } = await cardsOf("areas=damachills&musts="));
ok(j.cards.length === 0, "no must-haves -> no cards");
({ j } = await cardsOf("areas=&musts=pets"));
ok(j.cards.length === 0, "no district -> no cards");
({ j } = await cardsOf("areas=damachills&musts=metro"));
ok(types(j) === "damachills:metro,damachills:bus" && j.cards[0].count === 0 && j.cards[1].instead_of === "metro" && /No metro station inside DAMAC Hills/.test(j.cards[1].note),
  "metro with no station in the district -> the metro card (none) and then the bus-stops card, saying so", JSON.stringify(j.cards));
ok(j.cards[0].note === "None inside DAMAC Hills. The nearest metro station is Jumeirah Golf Estates Metro Station (Red Metro line), about 9.2 km from the middle of DAMAC Hills in a straight line.",
  "the metro card names the nearest station and its straight-line distance (no travel time)", j.cards[0].note);
({ j } = await cardsOf("areas=jumeirahvillagecircle,damachills&musts=metro,pets"));
ok(types(j) === "jumeirahvillagecircle:metro,jumeirahvillagecircle:dog_park,jumeirahvillagecircle:park,damachills:metro,damachills:bus,damachills:dog_park,damachills:park",
  "two districts -> cards per district, in the order the areas were asked (and the gzipped spots file reads)", types(j));
({ j } = await cardsOf("areas=damachills,nofile&musts=gym"));
ok(types(j) === "damachills:gym" && j.missing.includes("nofile"), "a district with no spots file gives no card (no placeholder) and is listed as missing", JSON.stringify(j));
// the API takes musts only: a nice-to-have parameter is ignored
({ j } = await cardsOf("areas=damachills&nice=pets"));
ok(j.cards.length === 0, "a nice-to-have opens no card (cards are for must-haves)");

// ---- 2. counts and names ---------------------------------------------------------------------------------------------------------------
({ j } = await cardsOf("areas=damachills&musts=pets,gym,community_pool"));
const C = Object.fromEntries(j.cards.map((c) => [c.type, c]));
ok(C.dog_park.count === 2, "dog parks counted 2 (the portal one is not counted)", C.dog_park.count);
ok(C.park.count === 3 && C.gym.count === 2 && C.community_pool.count === 2, "parks 3, gyms 2 (portal gym not counted), community pools 2", [C.park.count, C.gym.count, C.community_pool.count].join(","));
ok(C.dog_park.title === "Dog parks in DAMAC Hills" && C.dog_park.emoji === "🐕", "the title reads 'Dog parks in DAMAC Hills' with its emoji", C.dog_park.title);
ok(C.community_pool.emoji === "🏊" && C.gym.emoji === "🏋️" && C.park.emoji === "🌳", "one emoji per type (pool, gym, park)");
ok(C.dog_park.names[0] === "Central Bark" && C.dog_park.names.includes("Dog park in Golf Promenade"), "names: named spots first, then the generic ones", C.dog_park.names.join(" | "));
ok(C.park.names.indexOf("Park in Silver Springs") === 2, "a generic name sorts after the real names", C.park.names.join(" | "));
ok(C.gym.google_count === 7 && C.dog_park.google_count === 3 && C.park.google_count === 11 && C.community_pool.google_count === null, "Google's live counts: gyms 7, dog parks 3, parks 11; a zero from Google (pools) is not shown beside our own 2", JSON.stringify([C.gym.google_count, C.dog_park.google_count, C.park.google_count, C.community_pool.google_count]));
ok(C.gym.google_count !== 999 && !JSON.stringify(j).includes("999"), "a count stored in the file (planted 999) is never shown: the card asks live");
ok(C.gym.count === 2 && C.gym.count_from === null, "the headline stays our own records' count; Google's sits beside it");
ok(/OpenStreetMap contributors/.test(C.dog_park.sources) && !/\b(KHDA|RTA|OSM)\b/.test(JSON.stringify(j.cards.map((c) => [c.sources, c.note]))), "sources are named in plain words (OpenStreetMap credited; no acronyms)", JSON.stringify(j.cards.map((c) => c.sources)));
const { j: jSch } = await cardsOf("areas=damachills&musts=schools,metro");
const bus = jSch.cards.find((c) => c.type === "bus"), sch = jSch.cards.find((c) => c.type === "school");
ok(sch.sources === "Names and count from Google Maps, asked when this was made and not kept." && /Roads and Transport Authority/.test(bus.sources), "schools named by Google say so; bus stops credit the transport authority in words", JSON.stringify(jSch.cards.map((c) => c.sources)));

// ---- 11. live Google counts and school names ----------------------------------------------------------------------------------------
ok(sch.count === 24 && sch.count_from === "Google Maps", "schools lead with Google's live count (24), credited to Google Maps", JSON.stringify(sch));
ok(sch.names_from === "Google Maps" && sch.names.join("|") === LIVE_SCHOOLS.join("|"), "schools are named from Google Places, asked live (a closed school dropped)", sch.names.join("|"));
livePosts = [];
({ j } = await cardsOf("areas=damachills&musts=gym"));
const ins = livePosts.filter((x) => /computeInsights/.test(x.u));
ok(ins.length === 1 && ins[0].u === "https://areainsights.googleapis.com/v1:computeInsights" && ins[0].h["X-Goog-Api-Key"] === GKEY && !hasKey(ins[0].u),
  "one live count per card: the Places Aggregate endpoint, the key in a header (not the address)", JSON.stringify(ins.map((x) => x.u)));
ok(ins[0] && JSON.stringify(ins[0].body.filter.typeFilter) === '{"includedTypes":["gym"]}' && JSON.stringify(ins[0].body.filter.locationFilter) === JSON.stringify(COUNTS_DAMAC.google_requests.body.filter.locationFilter) && ins[0].body.insights[0] === "INSIGHT_COUNT",
  "the request is the file's own (the district polygon), with the type filled in", ins[0] && JSON.stringify(ins[0].body).slice(0, 200));
livePosts = [];
({ j } = await cardsOf("areas=damachills&musts=schools", envNoKey));
const sch0 = j.cards[0];
ok(livePosts.length === 0 && sch0.count === 2 && sch0.count_from === null && sch0.names.join("|") === "Jebel Ali School|Second Test Academy" && sch0.google_count === null && /schools regulator/.test(sch0.sources) && /OpenStreetMap/.test(sch0.sources),
  "no secret: no live call; schools come from our records (the spot and the counts file, merged by name)", JSON.stringify(sch0));
GOOGLE_MODE = "500";
({ j } = await cardsOf("areas=damachills&musts=gym,schools"));
ok(j.cards.length === 2 && j.cards[0].google_count === null && j.cards[1].count === 2 && j.cards[1].count_from === null, "Google failing: the cards stand on our own records, no Google count", JSON.stringify(j.cards.map((c) => [c.count, c.google_count, c.count_from])));
GOOGLE_MODE = "ok";
livePosts = [];
({ j } = await cardsOf("areas=damachills&musts=parking"));
ok(livePosts.length === 0 && j.cards.length === 0, "no place must-have: Google is not asked at all", livePosts.length);

// ---- 3. portal refused --------------------------------------------------------------------------------------------------------------
const all = JSON.stringify(j);
ok(!/Bark Park Portal|Portal Gym|bayut|propertyfinder/i.test(all), "a portal-sourced spot is never named, counted or linked", all.slice(0, 300));
googleCalls = [];
r = await call("/amenity_photo?d=damachills&id=" + encodeURIComponent("osm:way/3") + "&key=" + CLIENT);
ok(r.status === 404 && googleCalls.length === 0, "the photo route refuses a portal spot (404) without calling Google", r.status + " " + googleCalls.length);

// ---- 7. which picture, with which credit ---------------------------------------------------------------------------------------------
ok(C.dog_park.picture && C.dog_park.picture.id === "osm:way/1" && C.dog_park.picture.credit === "Photo: Test Author One · Google Maps", "dog parks: the Places photo of the named one, credited to its author", JSON.stringify(C.dog_park.picture));
ok(C.park.picture && C.park.picture.route === "street_view" && C.park.picture.credit === "© Google · Street View, Apr 2023", "parks: Street View, '© Google' and the month", JSON.stringify(C.park.picture));
ok(C.community_pool.picture && C.community_pool.picture.id === "osm:way/10", "a Places photo with no author is never chosen (Carson Pool skipped)", JSON.stringify(C.community_pool.picture));
ok(!GAPI.test(JSON.stringify(j)) && !/key=/.test(JSON.stringify(j)), "the cards JSON carries no Google address and no key", JSON.stringify(j).slice(0, 200));

// ---- 4 + 5. the photo route: gated, streams, no-store, key server-side only ----------------------------------------------------------
const PH = "/amenity_photo?d=damachills&id=" + encodeURIComponent("osm:way/1");
ok((await call(PH)).status === 401, "the photo route without a key -> 401");
ok((await call(PH + "&key=wrong_key_000000000")).status === 401, "the photo route with a wrong key -> 401");
ok((await call("/amenity_cards?areas=damachills&musts=pets")).status === 401, "the cards route without a key -> 401");
ok((await call(PH + "&key=" + CLIENT, env, { method: "POST" })).status === 405, "a POST is refused");
googleCalls = [];
r = await call(PH + "&key=" + CLIENT);
const body = new Uint8Array(await r.arrayBuffer());
ok(r.status === 200 && r.headers.get("Content-Type") === "image/jpeg" && body[0] === 0xff && body[1] === 0xd8, "a client key gets the picture (image/jpeg)", r.status + " " + r.headers.get("Content-Type"));
ok(r.headers.get("Cache-Control") === "no-store", "the picture is served no-store (never cached)", r.headers.get("Cache-Control"));
ok(googleCalls.length === 1 && /^https:\/\/places\.googleapis\.com\/v1\/places\/ChIJdog1\/photos\/AaTESTdog1\/media\?maxWidthPx=800&key=/.test(googleCalls[0]) && hasKey(googleCalls[0]),
  "the worker asked Google for the Places photo itself, with the key, server-side", googleCalls[0]);
ok(![...r.headers.entries()].some(([, v]) => hasKey(v)), "no response header carries the key");
r = await call(PH + "&key=" + READ);
ok(r.status === 200, "the owner key opens it too");
googleCalls = [];
await call("/amenity_photo?d=damachills&id=" + encodeURIComponent("dm:park:a") + "&key=" + CLIENT);
ok(/maps\/api\/streetview\?size=640x360&pano=PANO_A&heading=120&fov=80&return_error_code=true&key=/.test(googleCalls[0] || ""), "Street View by pano and heading, asking Google for an error rather than a grey 'no imagery' picture", googleCalls[0]);
googleCalls = [];
await call("/amenity_photo?d=damachills&id=" + encodeURIComponent("dm:park:b") + "&key=" + CLIENT);
ok(googleCalls.length === 0 && !googleCalls.some((u) => /staticmap|satellite/.test(u)), "v298: a spot filed 'satellite' asks Google for nothing (NEVER satellite in the Brief)", googleCalls[0]);
r = await call("/amenity_photo?d=damachills&id=nope&key=" + CLIENT);
ok(r.status === 404, "an unknown spot -> 404");
r = await call("/amenity_photo?d=damachills&id=" + encodeURIComponent("dm:park:c") + "&key=" + CLIENT);
ok(r.status === 404, "a spot whose picture route is none -> 404");

// ---- 6. fallbacks ---------------------------------------------------------------------------------------------------------------------
({ j } = await cardsOf("areas=damachills&musts=pets,gym", envNoKey));
ok(j.cards.length === 3 && j.cards.every((c) => c.picture === null) && j.cards[0].count === 2, "no GOOGLE_MAPS_KEY: the same cards, with no picture", JSON.stringify(j.cards.map((c) => c.picture)));
googleCalls = [];
r = await call(PH + "&key=" + CLIENT, envNoKey);
ok(r.status === 404 && googleCalls.length === 0, "no GOOGLE_MAPS_KEY: the photo route 404s without calling Google", r.status);
for (const m of ["500", "html"]) {
  GOOGLE_MODE = m;
  r = await call(PH + "&key=" + CLIENT);
  ok(r.status === 404 && !hasKey(await r.text()), "Google answering " + (m === "500" ? "500" : "with a page, not a picture") + " -> 404, no key in the answer", r.status);
}
GOOGLE_MODE = "hang";
let t0 = Date.now();
r = await call(PH + "&key=" + CLIENT);
const waited = Date.now() - t0;
ok(r.status === 404 && waited < 6000, "Google never answering -> 404 after the short timeout (" + waited + " ms)", r.status + " " + waited);
GOOGLE_MODE = "ok";

// ---- 8. the PDFs ----------------------------------------------------------------------------------------------------------------------
const PQ = "&mode=rent&beds=1&min=60000&max=70000&areas=damachills";
const doc = async (qs, e) => { const r = await call("/brief_pdf?" + qs + PQ + "&format=html&key=" + CLIENT, e); return { r, html: await r.text() }; };
let D = await doc("kind=compare&keys=damachills:10,damachills:11&musts=pets,gym,schools");   // v374: pets is dropped from the Brief; gym and schools still open cards
ok(D.r.status === 200 && /Around the community/.test(D.html), "Compare with gym and schools carries 'Around the community'", D.r.status + " " + D.html.slice(0, 300));
ok(!/Dog parks in DAMAC Hills/.test(D.html) && /Gyms in DAMAC Hills/.test(D.html) && /Schools in (and near )?DAMAC Hills/.test(D.html), "v374: the PDF has the gym and schools cards, and no dog-park card (pets is not offered)");
ok((D.html.match(/class="acard"/g) || []).length === 2, "two cards in the PDF", (D.html.match(/class="acard"/g) || []).length);
ok(/data:image\/jpeg;base64,/.test(D.html.slice(D.html.indexOf("Around the community"))), "the picture is embedded in the document (fetched server-side), not linked");
ok(/Photo: [A-Za-z ]+ · Google Maps/.test(D.html), "the PDF credits the photo's author");
ok(!hasKey(D.html) && !GAPI.test(D.html), "the Google key and address are nowhere in the PDF's HTML");
ok(/7 in the whole district &middot; Google Maps/.test(D.html), "the PDF shows Google's live count with Google Maps beside it");
ok(D.html.indexOf("Around the community") > D.html.lastIndexOf("Akoya One"), "Compare: the page comes after the sheet");
// through the real PDF path (the stub browser records what it prints)
printed = [];
r = await call("/brief_pdf?kind=compare&keys=damachills:10,damachills:11&musts=gym" + PQ + "&key=" + CLIENT);
ok(r.status === 200 && /Around the community/.test(printed[0] || "") && !hasKey(printed[0] || ""), "the rendered PDF route prints the page, without the key", r.status);
D = await doc("kind=pack&keys=damachills:10&musts=gym");
const ia = D.html.indexOf("Around the community"), ix = D.html.indexOf("Appendix");
ok(D.r.status === 200 && ia > 0 && ix > ia, "Full pack: 'Around the community' sits before the appendix", ia + " / " + ix);
D = await doc("kind=dossier&keys=damachills:10&musts=gym");
ok(D.r.status === 200 && !/Around the community/.test(D.html), "an individual dossier carries no amenity page");
D = await doc("kind=compare&keys=damachills:10,damachills:11&musts=parking");
ok(D.r.status === 200 && !/Around the community/.test(D.html), "Compare with only a home must-have (parking) carries none");
D = await doc("kind=compare&keys=damachills:10,damachills:11&nice=gym");
ok(D.r.status === 200 && !/Around the community/.test(D.html), "Compare with gym only as a nice-to-have carries none");
D = await doc("kind=compare&keys=damachills:10,damachills:11&musts=gym", envNoKey);
ok(D.r.status === 200 && /Around the community/.test(D.html) && !/data:image\/jpeg/.test(D.html.slice(D.html.indexOf("Around the community"))), "no secret: the PDF still has the cards, with no picture");
GOOGLE_MODE = "hang"; t0 = Date.now();
D = await doc("kind=compare&keys=damachills:10,damachills:11&musts=gym,schools");
ok(D.r.status === 200 && /Around the community/.test(D.html) && Date.now() - t0 < 7000, "Google hanging: the PDF builds in time (pictures in parallel, " + (Date.now() - t0) + " ms), cards without pictures");
GOOGLE_MODE = "ok";

// ---- 4 + 9. the Brief page and its script ------------------------------------------------------------------------------------------
r = await call("/brief?key=" + CLIENT + "&mode=rent&beds=1&areas=damachills&musts=pets&run=1");
const page = await r.text();
ok(r.status === 200 && page.includes("window.__amenCards") && /if\(window\.__amenCards\)window\.__amenCards\(st,RES,KEY\)/.test(page), "the Brief page carries the cards script and drawRes() calls it");
ok(!hasKey(page) && !GAPI.test(page), "the Google key and address are nowhere in the Brief page");
ok(/\.acard\{/.test(page), "the cards' CSS is on the page");
try { new vm.Script(AMENITY_CARDS_JS); ok(!/\$\{|`/.test(AMENITY_CARDS_JS), "the page script parses, with no ${} or backticks"); } catch (e) { ok(false, "the page script parses", e.message); }

// run the script against a minimal page: #bres holding a .sa row; fetch answers with the real cards JSON
function fakeDom() {
  const mk = (tag) => { const el = { tagName: tag, children: [], parentNode: null, id: "", className: "", hidden: false, _html: "",
    set innerHTML(h) { this._html = h; }, get innerHTML() { return this._html; },
    insertBefore(n, ref) { n.parentNode = this; const i = this.children.indexOf(ref); this.children.splice(i < 0 ? this.children.length : i, 0, n); },
    removeChild(n) { this.children.splice(this.children.indexOf(n), 1); n.parentNode = null; },
    querySelector(sel) { return sel === ".sa" ? this.children.find((c) => c.className === "sa") || null : null; },
    querySelectorAll() { return []; } }; return el; };
  const bres = mk("div"); bres.id = "bres"; const sa = mk("div"); sa.className = "sa"; bres.insertBefore(sa, null);
  const doc = { getElementById: (id) => (id === "bres" ? bres : bres.children.find((c) => c.id === id) || null), createElement: mk };
  return { bres, doc };
}
const { bres, doc: fdoc } = fakeDom();
let asked = [];
const sandbox = { window: {}, document: fdoc, encodeURIComponent,
  fetch: async (u) => { asked.push(u); const rr = await call(u.replace(/^\/amenity_cards\?/, "/amenity_cards?")); return rr; } };
vm.createContext(sandbox); vm.runInContext(AMENITY_CARDS_JS, sandbox);
sandbox.window.__amenCards({ areas: ["damachills"], musts: ["gym", "parking"] }, { results: [] }, CLIENT);
await new Promise((res) => setTimeout(res, 300));
const box = bres.children[0];
ok(box && box.id === "bamen" && bres.children[1].className === "sa", "the cards box goes above the homes list (before the choose-all row)", bres.children.map((c) => c.id || c.className).join(","));
ok(asked.length === 1 && /^\/amenity_cards\?key=client_key_in_links_12345&areas=damachills&musts=gym$/.test(asked[0]), "it asks /amenity_cards with the Brief's key and only the place must-haves", asked[0]);
ok(box && /Gyms in DAMAC Hills/.test(box.innerHTML) && /AROUND THE COMMUNITY/.test(box.innerHTML), "it draws the cards", box && box.innerHTML.slice(0, 200));
ok(box && /src="\/amenity_photo\?key=client_key_in_links_12345&d=damachills&id=[a-z]+%3A[a-z0-9%]+"/.test(box.innerHTML) && !GAPI.test(box.innerHTML), "each picture points at /amenity_photo with the Brief's key, never at Google", box && (box.innerHTML.match(/src="[^"]+"/) || [""])[0]);
// with no areas, it uses the districts of the results
const f2 = fakeDom(); asked = [];
const sb2 = { window: {}, document: f2.doc, encodeURIComponent, fetch: async (u) => { asked.push(u); return call(u); } };
vm.createContext(sb2); vm.runInContext(AMENITY_CARDS_JS, sb2);
sb2.window.__amenCards({ areas: [], musts: ["gym"] }, { results: [{ district: "damachills" }, { district: "damachills" }, { district: "jumeirahvillagecircle" }] }, CLIENT);
await new Promise((res) => setTimeout(res, 200));
ok(/areas=damachills,jumeirahvillagecircle&musts=gym$/.test(asked[0] || ""), "anywhere in Dubai: the cards follow the districts of the homes listed", asked[0]);
const f3 = fakeDom(); asked = [];
const sb3 = { window: {}, document: f3.doc, encodeURIComponent, fetch: async (u) => { asked.push(u); return call(u); } };
vm.createContext(sb3); vm.runInContext(AMENITY_CARDS_JS, sb3);
sb3.window.__amenCards({ areas: ["damachills"], musts: ["balcony", "modern"] }, { results: [] }, CLIENT);
ok(asked.length === 0 && f3.bres.children.length === 1, "no place must-have: nothing asked, nothing drawn");

// ---- 10. the portal list, KV untouched -----------------------------------------------------------------------------------------------
const docsSrc = fs.readFileSync(new URL("../src/brief_docs.js", import.meta.url), "utf8");
const m = /const PORTAL_RX = (\/.*\/i);/.exec(docsSrc);
ok(m && m[1] === String(PORTAL_RX), "the portal list is the same as src/brief_docs.js PORTAL_RX", m && m[1]);
ok(KV.writes.length === 0, "nothing was written to KV", KV.writes.join(","));

// ---- NEGATIVE CONTROL (in-process): the checks above must catch a planted fault ------------------------------------------------------
ok(hasKey("<img src=\"https://maps.googleapis.com/x?key=" + GKEY + "\">") && hasKey("x?key=" + encodeURIComponent(GKEY)), "negative control: the leak check catches the key, raw or URL-encoded");
MUST_TO_TYPES.parking = ["gym"];   // plant the fault: parking now opens a card
const planted = await amenityCards(env, { areas: ["damachills"], musts: ["parking"] });
delete MUST_TO_TYPES.parking;
ok(planted.cards.length === 1, "negative control: with a planted mapping, the 'parking opens no card' check would have failed (1 card)", planted.cards.length);
const restored = await amenityCards(env, { areas: ["damachills"], musts: ["parking"] });
ok(restored.cards.length === 0, "negative control: restored, parking opens none again");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
