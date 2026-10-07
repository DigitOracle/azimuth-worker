// v291 - THE DAMAC HILLS CHECKLIST (owner only): /checklist, /checklist/layer, /checklist/save, /checklist/photo, and the hooks that make
// the Brief documents, the Brief list and the Blocks page read the owner's corrections.
//
// Kendall, 2 Oct 2026: "I want to get 100% of DAMAC Hills done, correct, before moving to another community."
//
// What this proves, on an invented DAMAC Hills (test/v291_fixture.mjs) through the real worker (src/index.js) with a stub KV:
//   1. OWNER ONLY: a client key gets 401 on every route; no key 401; a POST with the owner key in the URL instead of the header 401;
//      a cross-site POST 403
//   2. MAP OVERRIDES: a save writes {add, remove, by, at}; areaIndex merges it (add, remove, and an add MOVES a home out of the cluster
//      the anchors file put it in); Brookfield-1 (no homes in the district model) goes from picture kind "district" to "blocks_area"
//      in the Brief's own loader; the Blocks page's cluster= gold follows the same index
//   3. BROKER FACTS: fill only what is still "not known", never override a register / amenity-file answer, say "per Najjuko, checked on
//      site <date>" in the API list and the PDF; "not sure" saves nothing
//   4. OWN PHOTOS: the card picture FIRST, above the developer's photo, credited "Photo: Najjuko"
//   5. UPLOAD LIMITS: JPEG only, 5 MB, 1600 px
//   6. NO KEY IN HTML: the page carries neither key, and its script moves the key to a header and out of the address bar
//   7. the list: every sub-community from the three sources, the family-level and community-level warnings, the progress line
// NEGATIVE CONTROL: NEG=1 node test/test_v291_checklist.mjs runs the same checks with the four brief/blocks hooks switched off (the
// overrides, broker facts and own photos stored but not read: __CHECKLIST_HOOKS_OFF) - the hook checks must FAIL.
import worker from "../src/index.js";
import { __setLauncher, areaIndex, loadContext, parseQuery } from "../src/brief_docs.js";
import { applyAnchorOverrides, applyBrokerFacts, longDate } from "../src/checklist_data.js";
import { checklistData, CHECK_JS } from "../src/checklist.js";
import { READ, CLIENT, GKEY, ORIGIN, D, ANCHORS, makeKV, makeEnv, jpeg } from "./v291_fixture.mjs";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 500) : "")); } };
const NEG = process.env.NEG === "1";

const KV = makeKV();
const env = makeEnv(KV);
let printed = [];
__setLauncher(async () => ({ async newPage() { return { async setViewport() {}, async setContent(h) { printed.push(h); }, async evaluate() { return true; }, async pdf() { return new TextEncoder().encode("%PDF-1.7 stub"); } }; }, async close() {} }));
globalThis.fetch = async () => new Response("{}", { status: 200 });
const call = (p, init) => worker.fetch(new Request(ORIGIN + p, init), env, { waitUntil() {} });
const post = (p, body, hdr) => call(p, { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, hdr || {}), body: typeof body === "string" || body instanceof Uint8Array ? body : JSON.stringify(body) });
const OWN = { "X-Owner-Key": READ };
const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const sorted = (a) => JSON.stringify([...(a || [])].sort((x, y) => x - y));
const TODAY = new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10);

// NEG: store everything, but make every reader blind to it (the hooks' KV keys answer null)
if (NEG) { const g = KV.get; KV.get = async (k, t) => (/^img_(anchor_overrides|broker_facts|ownphotos)_/.test(k) ? null : g(k, t)); }

async function picKind(key) {
  const q = parseQuery(new URL("https://x/?kind=compare&beds=3&type=villa&keys=" + encodeURIComponent(key)));
  const C = await loadContext(env, q, { need: { map: true, amen: false } });
  return C.recs[0];
}

// ---- 1. owner only -------------------------------------------------------------------------------------------------------------
{
  ok((await call("/checklist?d=" + D + "&key=" + CLIENT)).status === 401, "a client key gets 401 on the page");
  ok((await call("/checklist?d=" + D)).status === 401, "no key gets 401 on the page");
  ok((await call("/checklist/layer?d=" + D, { headers: { "X-Owner-Key": CLIENT } })).status === 401, "a client key in the header gets 401 on the layer");
  ok((await call("/checklist/layer?d=" + D + "&key=" + READ)).status === 401, "the layer will not take the owner key from the URL");
  ok((await post("/checklist/save", { d: D, kind: "facts", cluster: "DAMAC HILLS - TOPANGA", facts: { gym: "yes" } }, { "X-Owner-Key": CLIENT })).status === 401, "a client key gets 401 on save");
  ok((await post("/checklist/save?key=" + READ, { d: D, kind: "facts", cluster: "DAMAC HILLS - TOPANGA", facts: { gym: "yes" } })).status === 401, "save refuses the owner key in the URL (header only)");
  ok((await call("/checklist/photo?d=" + D + "&c=x", { method: "POST", headers: { "X-Owner-Key": CLIENT, "Content-Type": "image/jpeg" }, body: jpeg(800, 600) })).status === 401, "a client key gets 401 on upload");
  ok((await post("/checklist/save", { d: D, kind: "facts", cluster: "DAMAC HILLS - TOPANGA", facts: { gym: "yes" } }, Object.assign({ Origin: "https://evil.example" }, OWN))).status === 403, "a cross-site POST is refused (403)");
  ok((await call("/checklist/save", { method: "POST", headers: Object.assign({ "Content-Type": "text/plain" }, OWN), body: "{}" })).status === 415, "save takes JSON only");
  ok(!KV.writes.length, "nothing was written by any refused request", KV.writes.join(","));
  const r = await call("/checklist?d=" + D + "&key=" + READ);
  ok(r.status === 200 && /text\/html/.test(r.headers.get("Content-Type")) && r.headers.get("Cache-Control") === "no-store", "the owner key opens the page (no-store)");
}

// ---- 7. the list ---------------------------------------------------------------------------------------------------------------
{
  const data = await checklistData(env, D, { origin: ORIGIN });
  const names = data.rows.map((r) => norm(r.name));
  ok(["damachillstopanga", "damachillsbrookfield1", "damachillsbrookfield2", "damachillsrichmond", "akoyaone", "damachillsgolfvita"].every((n) => names.includes(n)) && data.rows.length === 6,
    "every sub-community from the rent index, the units register and the district model, once each", names.join(","));
  const R = Object.fromEntries(data.rows.map((r) => [norm(r.name), r]));
  ok(R.damachillsbrookfield2.mapped.n === 3 && /family-level/.test(R.damachillsbrookfield2.mapped.warn || "") && /Brookfield/.test(R.damachillsbrookfield2.mapped.warn), "Brookfield-2: 3 homes, warned family-level (one filed from the shared Brookfield place)", R.damachillsbrookfield2.mapped.warn);
  ok(/community-level/.test(R.damachillsrichmond.mapped.warn || ""), "Richmond: warned community-level (filed from the area's name)", R.damachillsrichmond.mapped.warn);
  ok(R.damachillstopanga.mapped.n === 4 && !R.damachillstopanga.mapped.warn, "Topanga: 4 homes, no warning");
  ok(R.damachillsbrookfield1.mapped.n === 0 && R.damachillsbrookfield1.picture.kind === "district", "Brookfield-1: not mapped, the report would show the bare district map");
  ok(R.akoyaone.picture.kind === "photo" && R.akoyaone.how === "building", "Akoya One: the developer's photo, placed by its own footprint");
  ok(R.damachillstopanga.picture.kind === "blocks", "Topanga without a Google key: a Blocks view (render)");
  ok(R.damachillstopanga.render === null && data.renderIndex === false, "render: unknown while img_render_index_damachills is not published");
  const tAm = Object.fromEntries(R.damachillstopanga.amen.map((a) => [a.k, a]));
  ok(tAm.gym.ok && tAm.pets.ok && tAm.community_pool.ok && tAm.parking.ok && !tAm.private_pool.ok && !tAm.home_type.ok, "Topanga amenities: the file answers gym, pets, pool, parking; private pool and home type not known");
  const data2 = await checklistData(makeEnv(KV, { GOOGLE_MAPS_KEY: GKEY }), D, { origin: ORIGIN });
  ok(data2.rows.find((r) => norm(r.name) === "damachillstopanga").picture.kind === "street_view", "with a Google key the same community reads Street View (else satellite)");
  KV.store.set("img_render_index_" + D, JSON.stringify({ slugs: ["topanga", "brookfield2"] }));
  const data3 = await checklistData(env, D, {});
  const R3 = Object.fromEntries(data3.rows.map((r) => [norm(r.name), r]));
  ok(R3.damachillstopanga.render === true && R3.damachillsbrookfield1.render === false, "render: read from img_render_index_<d> when it is there");
  KV.store.delete("img_render_index_" + D);
  ok(data.done === 0 && data.total === 6, "progress: 0 of 6 complete on the fixture");
  const html = await (await call("/checklist?d=" + D + "&key=" + READ)).text();
  ok(/DAMAC Hills 100% check:<\/b> <span id="pn">0 of 6<\/span> communities complete/.test(html), "the page's progress line: DAMAC Hills 100% check: 0 of 6 communities complete");
}

// ---- 2. map overrides --------------------------------------------------------------------------------------------------------------
{
  // the merge rule on its own
  const base = areaIndex(ANCHORS);
  const m = applyAnchorOverrides(base, { "DAMAC HILLS - BROOKFIELD-1": { add: [10, 4] }, "DAMAC HILLS - TOPANGA": { remove: [3] } });
  ok(sorted(m.get("damachillsbrookfield1")) === "[4,10]" && sorted(m.get("damachillstopanga")) === "[0,1,2]" && sorted(m.get("damachillsbrookfield2")) === "[5,6]",
    "applyAnchorOverrides: an add puts the home in, a remove takes it out, and an added home leaves the cluster the anchors file gave it");
  ok(sorted(base.get("damachillstopanga")) === "[0,1,2,3]", "the anchors index itself is not mutated");

  const before = await picKind("dld:damachillsbrookfield1");
  ok(before && before.picSource === "district", "before: Brookfield-1's picture kind is district", before && before.picSource);
  const r = await post("/checklist/save", { d: D, kind: "map", cluster: "DAMAC HILLS - BROOKFIELD-1", ids: [10, 11] }, OWN);
  const j = await r.json();
  const ov = JSON.parse(KV.store.get("img_anchor_overrides_" + D) || "{}");
  const e = ov["DAMAC HILLS - BROOKFIELD-1"] || {};
  ok(r.status === 200 && j.ok && sorted(e.add) === "[10,11]" && sorted(e.remove) === "[]" && e.by === "owner" && /^\d{4}-\d\d-\d\dT/.test(e.at || ""), "save writes {add, remove, by, at} to img_anchor_overrides_damachills", JSON.stringify(e));
  ok(j.row && j.row.mapped.n === 2 && j.row.mapped.override, "the saved row comes back with its 2 homes and the correction noted");
  const after = await picKind("dld:damachillsbrookfield1");
  ok(after && after.picSource === "blocks_area" && sorted(after.areaIds) === "[10,11]", "after: the Brief's loader draws Brookfield-1 as blocks_area on exactly ids 10, 11", after && after.picSource + " " + JSON.stringify(after.areaIds));
  // a remove, through the route
  await post("/checklist/save", { d: D, kind: "map", cluster: "DAMAC HILLS -  TOPANGA", ids: [0, 1] }, OWN);
  const ov2 = JSON.parse(KV.store.get("img_anchor_overrides_" + D));
  const top = await picKind("dld:damachillstopanga");
  ok(sorted(ov2["DAMAC HILLS - TOPANGA"].remove) === "[2,3]" && sorted(top.areaIds) === "[0,1]", "a remove: Topanga keeps 0 and 1 only, in the store and in the Brief's loader", JSON.stringify(ov2) + " " + JSON.stringify(top.areaIds));
  ok((await post("/checklist/save", { d: D, kind: "map", cluster: "DAMAC HILLS - TOPANGA", ids: [0, 999] }, OWN)).status === 400, "an id that is not a footprint of the layer is refused");
  ok((await post("/checklist/save", { d: D, kind: "map", cluster: "NOT A COMMUNITY", ids: [0] }, OWN)).status === 404, "a name that is not a sub-community is refused");
  // the Blocks page follows the same index
  const bl = await (await call("/blocks?district=" + D + "&cluster=" + encodeURIComponent("DAMAC HILLS - BROOKFIELD-1") + "&key=" + READ)).text();
  const cfg = JSON.parse((/window\.__BLOCKS_CFG__=(\{.*?\});<\/script>/.exec(bl) || [])[1] || "{}");
  ok(sorted((cfg.gold || []).map((g) => g.i)) === "[10,11]", "the Blocks page's cluster= gold is the corrected set (10, 11)", JSON.stringify(cfg.gold));
}

// ---- 3. broker facts -------------------------------------------------------------------------------------------------------------
{
  const r = await post("/checklist/save", { d: D, kind: "facts", cluster: "DAMAC HILLS - TOPANGA", facts: { private_pool: "some", gym: "no", home_type: "townhouse_row", furnished: "often", notes: "Gate 4, <b>quiet</b>", pets: "yes" } }, OWN);
  const BF = JSON.parse(KV.store.get("img_broker_facts_" + D) || "{}");
  const f = BF["DAMAC HILLS - TOPANGA"] || {};
  ok(r.status === 200 && f.by === "Najjuko (RERA licensed broker)" && f.checked_on === TODAY && f.private_pool === "some" && f.gym === "no" && !f.pets && !/</.test(f.notes),
    "facts saved with by: Najjuko (RERA licensed broker) and checked_on today; unknown fields dropped, notes cleaned", JSON.stringify(f));
  await post("/checklist/save", { d: D, kind: "facts", cluster: "DAMAC HILLS - BROOKFIELD-2", facts: { private_pool: "", gym: "", home_type: "", furnished: "" } }, OWN);
  ok(!JSON.parse(KV.store.get("img_broker_facts_" + D))["DAMAC HILLS - BROOKFIELD-2"], "an all \"not sure\" form saves nothing");
  // the rule on its own
  const crit = applyBrokerFacts({ gym: { v: true, src: "DAMAC page", level: "community" }, private_pool: { v: null, src: "Not known" } }, { gym: "no", private_pool: "none", checked_on: "2026-10-02" });
  ok(crit.gym.v === true && crit.gym.src === "DAMAC page" && crit.private_pool.v === false && /per Najjuko, checked on site 2 October 2026/.test(crit.private_pool.src), "applyBrokerFacts: a register yes stands; a not-known is filled, with its words");

  const api = await (await call("/brief_api?mode=rent&beds=3&type=villa,townhouse&furnished=furnished&musts=private_pool,gym&nice=&areas=" + D + "&limit=10&key=" + CLIENT)).json();
  const t = (api.results || []).find((x) => norm(x.name) === "damachillstopanga");
  const C = t ? Object.fromEntries(t.criteria.map((c) => [c.k, c])) : {};
  const say = "per Najjuko, checked on site " + longDate(TODAY);
  // v374: private pool and furnished are not offered in the Brief; the broker's notes for them stay on file but no row is built for them
  ok(t && !C.private_pool && !C.furnished, "the Brief list: no private pool or furnished row (pulled), whatever the broker noted");
  ok(t && C.gym && C.gym.v === true && !/Najjuko/.test(C.gym.src), "the Brief list: the amenity file's gym yes is NOT overridden by the broker's no", t && JSON.stringify(C.gym));
  ok(t && !JSON.stringify(api).includes("come up often"), "the Brief list: the broker's furnishing note is not shown");
  printed = [];
  const pr = await call("/brief_pdf?kind=dossier&keys=dld:damachillstopanga&mode=rent&beds=3&type=villa,townhouse&furnished=furnished&musts=private_pool,gym&key=" + CLIENT);
  const html = printed[0] || "";
  ok(pr.status === 200 && html.includes(say) && /Najjuko \(RERA licensed broker\)/.test(html), "the PDF (dossier, how it meets the brief) prints the broker's answer with \"" + say + "\"", pr.status + " " + html.length);
  const data = await checklistData(env, D, {});
  const row = data.rows.find((x) => norm(x.name) === "damachillstopanga");
  const am = Object.fromEntries(row.amen.map((a) => [a.k, a]));
  ok(am.private_pool.ok && am.private_pool.broker && am.private_pool.src.includes(say) && am.home_type.ok && /townhouses in rows/.test(am.home_type.v) && row.broker && row.broker.say === say, "the checklist row: private pool and home type answered, with the same words");
}

// ---- 4. own photos ---------------------------------------------------------------------------------------------------------------
{
  const card = (h) => (h.split('<div class="bcard"')[1] || "").split('class="sheet page')[0];
  printed = [];
  await call("/brief_pdf?kind=compare&keys=damachills:9&mode=rent&beds=1&type=apartment&key=" + CLIENT);
  ok(/bph_akoyaone_ext/.test(card(printed[0] || "")), "before: Akoya One's card shows the developer's photo");
  const up = await call("/checklist/photo?d=" + D + "&c=" + encodeURIComponent("Akoya One"), { method: "POST", headers: Object.assign({ "Content-Type": "image/jpeg" }, OWN), body: jpeg(1600, 1200) });
  const uj = await up.json();
  ok(up.status === 200 && uj.key === "ownphoto_damachills_akoyaone_1" && KV.store.get("img_ct_ownphoto_damachills_akoyaone_1") === "image/jpeg", "upload stores img_ownphoto_damachills_akoyaone_1 with its content type", JSON.stringify(uj).slice(0, 200));
  const IX = JSON.parse(KV.store.get("img_ownphotos_" + D) || "{}");
  ok(IX.akoyaone && IX.akoyaone.photos.length === 1 && IX.akoyaone.photos[0].by === "Najjuko", "and records it in img_ownphotos_damachills");
  printed = [];
  await call("/brief_pdf?kind=compare&keys=damachills:9&mode=rent&beds=1&type=apartment&key=" + CLIENT);
  const c = card(printed[0] || "");
  ok(/\/img\/ownphoto_damachills_akoyaone_1/.test(c) && !/bph_akoyaone_ext/.test(c) && /Photo: Najjuko/.test(c), "after: the card shows the own photo FIRST (not the developer's), credited Photo: Najjuko", c.slice(0, 300));
  printed = [];
  await call("/brief_pdf?kind=dossier&keys=damachills:9&mode=rent&beds=1&type=apartment&key=" + CLIENT);
  ok(/ownphoto_damachills_akoyaone_1/.test(printed[0] || "") && /Najjuko's own photograph/.test(printed[0] || ""), "the dossier's hero is the own photo, and its sources say so");
  const data = await checklistData(env, D, { origin: ORIGIN });
  const row = data.rows.find((x) => norm(x.name) === "akoyaone");
  ok(row.picture.kind === "own_photo" && row.photos.length === 1, "the checklist row: picture = own photo");
}

// ---- 5. upload limits ------------------------------------------------------------------------------------------------------------
{
  const n0 = KV.writes.length;
  const up = (body, ct, c) => call("/checklist/photo?d=" + D + "&c=" + encodeURIComponent(c || "DAMAC HILLS - TOPANGA"), { method: "POST", headers: Object.assign({ "Content-Type": ct }, OWN), body });
  ok((await up(jpeg(800, 600), "image/png")).status === 415, "a PNG content type is refused (415)");
  ok((await up(new TextEncoder().encode("not a jpeg at all, just text"), "image/jpeg")).status === 415, "bytes that are not a JPEG are refused (415)");
  ok((await up(jpeg(2400, 1800), "image/jpeg")).status === 413, "a JPEG over 1600 px is refused (413)");
  ok((await up(jpeg(1600, 1200, 5 * 1024 * 1024), "image/jpeg")).status === 413, "a body over 5 MB is refused (413)");
  ok((await up(jpeg(800, 600), "image/jpeg", "NOWHERE")).status === 404, "a photo for a name that is not a sub-community is refused");
  ok(KV.writes.length === n0, "nothing was stored by a refused upload");
  ok((await up(jpeg(1200, 900), "image/jpeg")).status === 200, "a 1200 px JPEG under 5 MB is taken");
}

// ---- 6. no key in HTML ----------------------------------------------------------------------------------------------------------
{
  const env2 = makeEnv(KV, { GOOGLE_MAPS_KEY: GKEY });
  const html = await (await worker.fetch(new Request(ORIGIN + "/checklist?d=" + D + "&key=" + READ), env2, { waitUntil() {} })).text();
  ok(html.length > 2000 && !html.includes(READ) && !html.includes(CLIENT) && !html.includes(GKEY), "the page HTML carries no owner key, no client key and no Google key");
  ok(/history\.replaceState/.test(CHECK_JS) && /searchParams\.delete\("key"\)/.test(CHECK_JS) && /"X-Owner-Key":K/.test(CHECK_JS) && !/[?&]key=/.test(CHECK_JS), "the script takes the key from its own URL, removes it with replaceState and sends it only as X-Owner-Key");
  ok(!/<a [^>]*href="[^"]*key=/.test(html), "no link on the page carries a key");
}

console.log((fail ? "FAIL" : "PASS") + " - v291 checklist: " + pass + " passed, " + fail + " failed" + (NEG ? " (NEGATIVE CONTROL: hooks blinded)" : ""));
process.exit(fail ? 1 : 0);
