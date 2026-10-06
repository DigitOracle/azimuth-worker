// v364 - THE DIGITAL THREAD BEHIND OUR OWN RENDERS + THE COMMUNITY PICTURE SLOT (Kendall, 6 Oct 2026).
//
// What this proves (worker.fetch and buildDocument, KV stubbed):
//   1. reader: KV thread_<suffix> -> a plain-language view from a whitelist; caveat codes map to plain sentences; an unknown code says nothing;
//      floors_assumed makes the caption and the text say "estimate"; no internal field (paths, hashes, ids, rules, known_issues) leaves
//   2. /img/thread_... is 404 even when the record is stored (under thread_ and under img_thread_); /render/ needs a key and serves only img_render_
//   3. area page: a community picture shows as a hero with the caption "Illustration - Najma render - not as built" and the About note
//   4. Brief: a register community takes the community render; the dossier hero carries the About note; the thread's caveats reach the text
//   5. DARK LAUNCH: with no thread_ and no community keys the area page and the Brief document are byte-identical to a store holding only
//      unrelated keys, and carry no "About this picture", no /render/ link and no community caption
//   6. no emoji anywhere in what the reader emits
//
//   node test/test_v364_thread.mjs
import worker from "../src/index.js";
import { threadView, aboutHtml, caveatSentence, CAVEAT_CODES, loadThread, communityPics, communityBlockHtml, communitySuffix, renderSuffixOfKey } from "../src/thread.js";
import { buildDocument, parseQuery } from "../src/brief_docs.js";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 400) : "")); } };
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);
const mkKV = (init) => {
  const store = new Map(Object.entries(init || {}));
  return { store, async get(k, t) { const v = store.get(k); if (v == null) return null; return t === "arrayBuffer" && typeof v !== "string" ? v.slice(0) : v; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); },
    async list(o) { return { keys: [...store.keys()].filter((k) => k.startsWith((o && o.prefix) || "")).map((name) => ({ name })) }; } };
};
const EMOJI = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
const LEAKS = [/data\/(lab|brand|ce|dm)/i, /sha256/i, /\.(png|jpg|glb|json|py)\b/i, /Rings|Kendall|Makani|DDA|OSM|osm_geom|Blender|Cycles|README|known_issues|\brules\b/i, /\b[0-9a-f]{16}\b/, /footprint_offset_vs_makani|floors_assumed|developer_design_permission|illustration_not_as_built/];
const strip = (h) => String(h).replace(/<style>[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/&middot;/g, "-").replace(/\s+/g, " ");

// ---- thread records as the publish scripts will write them (the real file shape, trimmed) ----------------------------------------
const BUILDING = { brief_key: "businessbay:73", slug: "img_render_businessbay-73", kind: "render_exterior", building: "Aykon City", file: "data/lab/pilot/out/img_render_businessbay-73.jpg", sha256_16: "b40393853f52421b", bytes: 261347,
  label: "Illustration - Aykon City", subject: { district: "businessbay", footprint_index: 73, name_in_layer: "Aykon City", height_m: 201.4, height_source: "osm_geom", levels: "4" },
  developer: { basis_text: "clear DAMAC (DDA 4 Oct follow-up: projects 1726/2200)", check: "DDA register check 4 Oct 2026" }, made_with: { renderer: "Blender 5.1 Cycles", scene: "data/ce/_glb/sky_businessbay_v5_0.glb" },
  status: "live in KV since 4 Oct 2026 (Rings: SHA-256 equal)", caveats: ["developer_design_permission"], rules: ["Research use; publishing needs Kendall's go (via Rings)"], known_issues: ["internal note"], caption_note: null };
const SHAMAL = { brief_key: null, slug: "img_shamal_cluster_test", kind: "render_oblique_community", building: "Shamal community, Jumeirah Village Circle", file: "data/lab/shamal_scene/shamal_cluster_test.png", sha256_16: "b94952fc9cbebf8b",
  lands: [{ land: 554, name: "Waves 2", parcel_id: "6817180", height_basis: "register 4 floors x 3.2 m (estimate)", makani_numbers: "18314 71712", dm_building_ids: "1000103195" }],
  caveats: ["footprint_offset_vs_makani", "floors_assumed", "developer_design_permission", "made_up_code"], known_issues: ["Live layer names footprint 919 'Stax'"], caption_note: "Say 'estimate' on client faces where floors are assumed" };
const ARTESIA = { kind: "render_community_illustration", building: "DAMAC Hills Artesia", files: { street: { file: "data/brand/renders/damachills_artesia/x.jpg", sha256_16: "849f50129896f749" } },
  source_data: { heights: "Dubai Municipality permitted height (render-reference pack spec.json)" }, caveats: ["developer_design_permission", "illustration_not_as_built"] };

console.log("1 - the reader");
const vB = threadView(BUILDING), vS = threadView(SHAMAL), vA = threadView(ARTESIA);
ok(vB && /About 201 m/.test(vB.lines.map((l) => l.join(" ")).join(" ")) && !vB.estimate, "a building: height shown, not an estimate");
ok(vB.caption === "Illustration &middot; Najma render", "a building caption is the v298 caption", vB.caption);
ok(vS.estimate && /estimate/i.test(vS.caption) && /estimate/i.test(strip(aboutHtml(vS))), "floors_assumed: the caption and the About text say estimate");
ok(vA.community && /not as built/.test(vA.caption), "a community caption says not as built", vA.caption);
for (const c of ["footprint_offset_vs_makani", "floors_assumed", "developer_design_permission", "illustration_not_as_built"]) ok(CAVEAT_CODES.includes(c) && caveatSentence(c).length > 30 && !/_/.test(caveatSentence(c)), "caveat " + c + " has a plain sentence");
ok(caveatSentence("made_up_code") === null && vS.notes.length === 3, "an unknown code says nothing (3 of 4 codes spoken)", vS.notes.length);
ok(vB.lines.some(([k, v]) => k === "Developer check" && /Land Department register/.test(v)), "developer check named in plain words");
for (const [n, v] of [["building", vB], ["shamal", vS], ["artesia", vA]]) {
  const t = strip(aboutHtml(v, { dark: true })) + " " + strip(v.caption);
  ok(!EMOJI.test(t), n + ": no emoji");
  const hit = LEAKS.map((r) => (r.exec(t) || [])[0]).filter(Boolean);
  ok(!hit.length, n + ": no internal field in the client text", hit.join(" | ") + " :: " + t.slice(0, 300));
}
ok(threadView(null) === null && aboutHtml(null) === "" && communitySuffix("damachills", "DAMAC HILLS - GOLF VISTA") === "community-damachills-golfvista" && renderSuffixOfKey("businessbay:73") === "businessbay-73", "helpers: null view, suffixes");
const KVr = mkKV({ "thread_businessbay-73": JSON.stringify(BUILDING), "thread_bad": "{not json" });
ok((await loadThread({ MEETINGS: KVr }, "businessbay-73")).building === "Aykon City" && (await loadThread({ MEETINGS: KVr }, "bad")) === null && (await loadThread({ MEETINGS: KVr }, "nothing")) === null && (await loadThread({ MEETINGS: KVr }, "../x")) === null, "loadThread: reads, tolerates bad JSON, missing key and a bad name");

console.log("2 - /img never serves the thread; /render needs a key");
const OWN = "owner_key_abcdefgh", CLI = "client_key_123456";
const A_NAME = "Jumeirah Village Circle";
const mkt = JSON.stringify({ areaIntel: { areas: [{ area: A_NAME, sales: 120, medianAedSqft: 1000, medianTicketAed: 1200000, offPlanPct: 20, byRoom: {} }, { area: "DAMAC Hills", sales: 90, medianAedSqft: 900, medianTicketAed: 2000000, offPlanPct: 10, byRoom: {} }] } });
const base = () => ({ mkt_latest: mkt });
const withThread = () => Object.assign(base(), {
  "thread_businessbay-73": JSON.stringify(BUILDING), "img_thread_businessbay73": "x", "thread_x": "y",
  "img_render_community-jumeirahvillagecircle-shamal": JPEG, "img_ct_render_community-jumeirahvillagecircle-shamal": "image/jpeg", "thread_community-jumeirahvillagecircle-shamal": JSON.stringify(SHAMAL),
  "img_render_community-damachills-artesia": JPEG, "img_ct_render_community-damachills-artesia": "image/jpeg", "thread_community-damachills-artesia": JSON.stringify(ARTESIA) });
const envOf = (init) => ({ MEETINGS: mkKV(init), READ_KEY: OWN, CLIENT_KEY: CLI });
const get = (env, p) => worker.fetch(new Request("https://x.example" + p), env, { waitUntil() {} });
const e2 = envOf(withThread());
for (const p of ["/img/thread_businessbay-73", "/img/thread_businessbay73", "/img/thread_x", "/img/THREAD_x"]) ok((await get(e2, p)).status === 404, p + " is 404");
ok((await get(e2, "/render/community-damachills-artesia")).status === 401, "/render without a key is 401");
const rr = await get(e2, "/render/community-damachills-artesia?key=" + CLI);
ok(rr.status === 200 && /image\/jpeg/.test(rr.headers.get("content-type")) && (await rr.arrayBuffer()).byteLength === JPEG.length, "/render with a client key serves the picture");
ok((await get(e2, "/render/businessbay-73?key=" + CLI)).status === 404 && (await get(e2, "/render/thread_x?key=" + CLI)).status === 404 && (await get(e2, "/render/..%2Fx?key=" + CLI)).status === 404, "/render of a missing render, of thread_x and of a traversal is 404");

console.log("3 - the area page");
const areaHtml = async (init, name) => { const r = await get(envOf(init), "/area/" + encodeURIComponent(name) + "?key=" + CLI); return { s: r.status, h: await r.text() }; };
const a1 = await areaHtml(withThread(), A_NAME);
ok(a1.s === 200 && /\/render\/community-jumeirahvillagecircle-shamal\?key=/.test(a1.h), "JVC area page shows the Shamal community picture", a1.s);
ok(/Illustration &middot; Najma render &middot; not as built &middot; heights are an estimate/.test(a1.h) && /About this picture/.test(a1.h), "caption says not as built and estimate; the About note is there");
ok(!/artesia/i.test(a1.h) && !/<img[^>]+satellite/i.test(a1.h) && !/Esri|Maxar|Vantor/i.test(a1.h), "no other district's picture, no satellite credit");
const a2 = await areaHtml(withThread(), "DAMAC Hills");
ok(/community-damachills-artesia/.test(a2.h) && /not as built/.test(a2.h) && !/estimate<\/div>/.test(a2.h.split("About this picture")[0].slice(-200)), "DAMAC Hills page shows the cluster picture (no estimate wording: floors not assumed)");
ok(!EMOJI.test(strip(communityBlockHtml(await communityPics(envOf(withThread()), "jumeirahvillagecircle"), CLI))), "the community block has no emoji");

console.log("4 - the Brief");
const COMM = { n: 6, nn: 5, nr: 1, m: 300000, q1: 281250, q3: 307500, s: 354.5, last: "2026-09-24", mn: 300000, q1n: 275000, q3n: 310000 };
const briefInit = (extra) => {
  const o = Object.assign({ img_rent_index: JSON.stringify({ as_of: "2026-09-30", source_file: "rents-test.csv", items: [{ p: "damachillspiccadillygreen", n: "DAMAC HILLS - PICCADILLY GREEN", area: "Al Hebiah Third", d: "damachills", last: "2026-09-24", v: { "3": COMM } }] }),
    img_districts_geo: JSON.stringify({ districts: [{ slug: "damachills", name: "DAMAC Hills" }] }), img_amenities: JSON.stringify({ items: [] }) }, extra || {});
  return o;
};
const doc = async (init, kind) => { const env = { MEETINGS: mkKV(init) }; const q = parseQuery(new URL("https://x/brief_pdf?kind=" + kind + "&mode=rent&beds=3&type=villa&keys=" + encodeURIComponent("dld:damachillspiccadillygreen") + "&format=html")); return buildDocument(env, q, { now: new Date("2026-10-06T08:00:00Z") }); };
const pg = { "img_render_community-damachills-piccadillygreen": JPEG, "img_ct_render_community-damachills-piccadillygreen": "image/jpeg", "thread_community-damachills-piccadillygreen": JSON.stringify(Object.assign({}, ARTESIA, { building: "DAMAC Hills Piccadilly Green", caveats: ["floors_assumed", "developer_design_permission", "illustration_not_as_built"] })) };
const d1 = await doc(briefInit(pg), "dossier");
ok(d1.status === 200 && d1.C.recs[0].renderKind === "community" && d1.C.recs[0].picSource === "render", "the register community takes the community render", d1.status + " " + (d1.C && d1.C.recs[0] && d1.C.recs[0].picSource));
ok(/class="renderpic"/.test(d1.html) && /Najma render &middot; not as built &middot; heights are an estimate/.test(d1.html), "the dossier hero carries the community caption with estimate");
ok(/class="aboutpic"/.test(d1.html) && /About this picture/.test(d1.html) && /estimate/i.test(strip(d1.html).split("About this picture")[1].slice(0, 700)), "the dossier hero carries the About note, in plain words");
ok(!EMOJI.test(strip(d1.html).split("About this picture")[1].slice(0, 900)), "no emoji in the note");
const hit = LEAKS.map((r) => (r.exec(strip(d1.html).split("About this picture")[1].slice(0, 900)) || [])[0]).filter(Boolean);
ok(!hit.length, "no internal field in the Brief note", hit.join(" | "));

console.log("5 - dark launch: nothing in KV, nothing changes");
const unrelated = { thread_zzz_other: "{}", img_render_somewhere: JPEG, "img_ct_render_somewhere": "image/jpeg" };
const [x0, x1] = [await doc(briefInit(), "dossier"), await doc(briefInit(unrelated), "dossier")];
ok(x0.status === 200 && x0.html === x1.html, "Brief dossier: identical with and without unrelated keys");
ok(!/aboutpic|About this picture|\/render\/|not as built/.test(x0.html) && x0.C.recs[0].renderPic == null, "Brief dossier: no note, no render, no community caption");
const c0 = await doc(briefInit(), "compare"); ok(c0.status === 200 && !/aboutpic|renderpic/.test(c0.html), "Brief compare: no render figure");
const [p0, p1] = [await areaHtml(base(), A_NAME), await areaHtml(Object.assign(base(), unrelated, { "img_render_community-damachills-artesia": JPEG, "img_ct_render_community-damachills-artesia": "image/jpeg" }), A_NAME)];
ok(p0.s === 200 && p0.h === p1.h && !/aboutpic|About this picture|\/render\/|Najma render/.test(p0.h), "area page: identical to a store with only other districts' pictures; no note, no render");
const noCt = await areaHtml(Object.assign(base(), { "img_render_community-jumeirahvillagecircle-shamal": JPEG }), A_NAME);
ok(noCt.h === p0.h, "a picture whose content-type companion is missing is not shown (no broken image)");
const b0 = await communityPics(envOf(base()), "jumeirahvillagecircle"); ok(Array.isArray(b0) && !b0.length && communityBlockHtml(b0, CLI) === "", "no keys: communityPics is empty and the block is empty");

console.log("\n" + (fail ? "FAIL - " + fail + " failed, " + pass + " passed" : "PASS - v364 thread: " + pass + " checks"));
process.exit(fail ? 1 : 0);
