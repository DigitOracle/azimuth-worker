// v277 (Kendall, 1 Oct 2026) - the ways to the BLOCKS, and the building page's dossier button.
//
// "How do I get to the blocks?" - there was no link to /blocks anywhere. Now:
//   (a) /map (and the district twin, which shares the chrome) carries a BLOCKS button that follows the district on screen:
//       /blocks?district=<slug>&key=<key>, hidden until a district is picked, set at once on a twin (its district is fixed)
//   (b) the Brief's results page has "See them in blocks" (proved in test_brief_page.mjs, B1-B3)
//   (c) a building page's About card has a Blocks link with gold=<that building's id>
// And the dossier: Kendall pressed "The dossier · PDF" on Burj Binghatti Jacob & Co Residences and got the OLD-style PDF (Azimuth mark,
// company footer) from /sheet/<slug>.pdf. The button and the four hand-over links now make the NEW-style document:
//   /brief_pdf?kind=dossier&keys=<district>:<id>&mode=rent&beds=<the panel's bedroom choice, or all>&key=<key>
// The share links carry the CLIENT key, never the owner key (v245); no button on the page uses /sheet/ any more.
//
//   node test/test_v277_links.mjs
import worker from "../src/index.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 400) : "")); } };
const parses = (code, ext) => { const f = path.join(os.tmpdir(), "v277_" + Math.random().toString(36).slice(2) + (ext || ".js")); fs.writeFileSync(f, code); try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); return true; } catch (e) { console.log(String(e.stderr || e.message).slice(0, 600)); return false; } finally { try { fs.unlinkSync(f); } catch (e) {} } };
const scripts = (html) => [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].filter((m) => !/\bsrc=/.test(m[1])).map((m) => ({ attrs: m[1], code: m[2] }));

const READ = "owner_read_key_abcdefghijklmnop", CLIENT = "client_key_current_abcdefghij", RK = "residents_key_long_enough_012345";
const SLUG = "businessbay", ID = "6";
const stack = { district: SLUG, generated: "2026-09-22", sources: [], levels: {},
  buildings_by_id: { [ID]: { name: "Burj Test Residences", basis: "dm_floors", uses: ["homes"], area_sqm: 17010, height_m: 110,
    floors: [{ l: "5", n: 5, u: "homes", k: 8, a: 1200, t: ["1 bedroom"] }, { l: "6", n: 6, u: "homes", k: 8, a: 1200, t: ["2 bedroom"] }],
    types: [{ t: "1 bedroom", c: "1", units: 164, lo: 5, hi: 14, sqm: 103.5, aed: 1256938, est: false }, { t: "2 bedroom", c: "2", units: 80, lo: 5, hi: 14, sqm: 150, aed: 2000000, est: false }], total_units: 760 } } };
const unitmix = { district: SLUG, generated: "2026-09-22", buildings_by_id: { [ID]: { status: "verified", name: "Burj Test Residences", total_units: 760, floors: 37,
  rows: [{ type: "1 bedroom", median_sqm: 103.5, units: 164, basis: "DLD units register", median_aed: 1256938 }, { type: "2 bedroom", median_sqm: 150, units: 80, basis: "DLD units register" }] } } };
const store = new Map();
store.set("img_stack_" + SLUG, JSON.stringify(stack));
store.set("img_unitmix_" + SLUG, JSON.stringify(unitmix));
store.set("sheetm_b_" + SLUG + "_" + ID, JSON.stringify({ bytes: 12345, pages: 4, built_at: "2026-09-20" }));   // an OLD-style dossier IS in the store: the page must still not offer it
const KV = {
  async get(k, t) { if (!store.has(k)) return null; const v = store.get(k); if (t === "arrayBuffer") return typeof v === "string" ? new TextEncoder().encode(v).buffer : v; return typeof v === "string" ? v : new TextDecoder().decode(v); },
  async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter((k) => k.startsWith(p)).map((name) => ({ name })), list_complete: true }; },
};
globalThis.fetch = async () => new Response("{}", { status: 200 });
const env = { MEETINGS: KV, READ_KEY: READ, CLIENT_KEY: CLIENT, RESIDENTS_KEY: RK, INGEST_TOKEN: "ING", PUBLIC_ORIGIN: "https://azimuth-2.digitalchemy.workers.dev" };
const call = (p) => worker.fetch(new Request("https://azimuth-2.digitalchemy.workers.dev" + p), env, { waitUntil() {} });

// ---- (a) the map and the twin --------------------------------------------------------------------------------------------
const mapHtml = await (await call("/map?key=" + READ)).text();
ok(/<a class=blkbtn id=blkbtn hidden href="#">⬚ BLOCKS<\/a>/.test(mapHtml), "/map carries the BLOCKS button in its top chrome, hidden until a district is picked");
const chrome = scripts(mapHtml).find((s) => s.code.includes("function blocksLink("));
ok(!!chrome && parses(chrome.code), "the map chrome script with blocksLink parses");
ok(chrome && chrome.code.includes('b.href="/blocks?district="+encodeURIComponent(slug)+"&key="+encodeURIComponent(KEY)+(window.__RKQ||"")') && chrome.code.includes("CURD=slug;blocksLink(slug);") && chrome.code.includes('CURD="";blocksLink("");'),
  "picking a district sets the button to /blocks?district=<slug>&key=<key>(&rk) and clearing it hides the button again");
store.set("img_sky_jumeirahvillagecircle", "glb");
const twinHtml = await (await call("/skyline/jumeirahvillagecircle?key=" + READ + "&rk=" + RK)).text();
const twinChrome = scripts(twinHtml).find((s) => s.code.includes("function blocksLink("));
ok(!!twinChrome && twinHtml.includes("id=blkbtn") && twinChrome.code.includes('blocksLink(window.__twinDistrict||"");') && parses(twinChrome.code, /type=.?module/.test(twinChrome.attrs) ? ".mjs" : ".js"),
  "the district twin shares the chrome: its button is set at once to the twin's own district, and the script parses");

// ---- (c) the building page: the Blocks link and the dossier button -----------------------------------------------------------
const page = async (key, rk) => { const r = await call("/building/" + SLUG + "/" + ID + "?key=" + key + (rk ? "&rk=" + rk : "")); return { status: r.status, html: await r.text() }; };
const b = await page(READ);
ok(b.status === 200 && b.html.includes("Burj Test Residences"), "the building page renders");
const D = JSON.parse(/const D=(\{[\s\S]*?\}),KEY=/.exec(b.html)[1]);
ok(D.blocksUrl === "/blocks?district=" + SLUG + "&gold=" + ID + "&key=" + READ, "the page is handed its Blocks link: /blocks?district=businessbay&gold=6 with the key", D.blocksUrl);
ok(b.html.includes("id=blocksbtn href=\"' + esc(D.blocksUrl)") || /blocksbtn/.test(b.html), "the About card draws it as the Blocks link (#blocksbtn)");
const bRk = await page(READ, RK);
const D2 = JSON.parse(/const D=(\{[\s\S]*?\}),KEY=/.exec(bRk.html)[1]);
ok(D2.blocksUrl === "/blocks?district=" + SLUG + "&gold=" + ID + "&key=" + READ + "&rk=" + RK, "with the residents key on the page, the Blocks link carries it too");
// the dossier
ok(D.dossier && D.dossier.key === SLUG + ":" + ID && !("slug" in D.dossier), "the dossier the page is handed is the /brief_pdf key, not a /sheet/ slug - even with an old-style PDF in the store");
ok(/<a id=dossbtn target=_blank rel=noopener href="\/brief_pdf\?kind=dossier&amp;keys=businessbay%3A6&amp;mode=rent&amp;beds=all&amp;key=owner_read_key_abcdefghijklmnop">The dossier · PDF<\/a>/.test(b.html),
  "the panel's dossier button is /brief_pdf?kind=dossier&keys=businessbay:6&mode=rent&beds=all with the page's key", (/<a id=dossbtn[^>]*>/.exec(b.html) || [""])[0]);
ok(!/<a[^>]*href="[^"]*\/sheet\//.test(b.html) && !b.html.includes("/sheet/\" + ") && !b.html.includes('"/sheet/"'), "no button or link on the page uses /sheet/ (the route stays for old links only)");
const view = /const __name=\(f\)=>f;\(([\s\S]*)\)\(THREE,GLTFLoader/.exec(b.html);
ok(view && parses("(" + view[1] + ")", ".mjs"), "the page's view function still parses");
ok(view && /location\.origin \+ "\/brief_pdf\?kind=dossier&keys=" \+ encodeURIComponent\(D\.dossier\.key \|\| \(D\.slug \+ ":" \+ D\.id\)\) \+ "&mode=rent&beds=" \+ bedsChoice\(\)/.test(view[1]) &&
  /const k = share \? \(D\.shareKey \|\| ""\) : KEY;/.test(view[1]) && !/\/sheet\//.test(view[1]),
  "in the browser, dossierUrl builds /brief_pdf with the panel's bedroom choice, the CLIENT key for a share (v245) and never /sheet/");
ok(view && /function bedsChoice\(\)[\s\S]*if \(on\.length !== 1\) return "all";/.test(view[1]), "beds is the one chosen bedroom type, or all when none or several are chosen");
ok(view && /function syncDoss\(\)/.test(view[1]) && (view[1].match(/syncDoss\(\)/g) || []).length >= 4, "the chips re-point the button and the hand-over links as they change");
ok(D.shareKey === CLIENT && !b.html.includes('"shareKey":"' + READ), "the share key handed down is the client key, not the owner key");
// a client opening the page gets the same dossier, with the client key
const c = await page(CLIENT);
ok(c.status === 200 && /id=dossbtn[^>]*href="\/brief_pdf\?kind=dossier&amp;keys=businessbay%3A6&amp;mode=rent&amp;beds=all&amp;key=client_key_current_abcdefghij"/.test(c.html) && !c.html.includes(READ), "on a client key the button carries the client key and the owner key is nowhere");

// ---- the /brief_pdf the button points at answers (beds=all, a building the rent index does not know) ----------------------------
store.set("img_rent_index", JSON.stringify({ as_of: "2026-09-30", items: [] }));
const { __setLauncher } = await import("../src/brief_docs.js");
let printed = [];
__setLauncher(async () => ({ async newPage() { return { async setViewport() {}, async setContent(h) { printed.push(h); }, async evaluate() { return true; }, async pdf() { return new TextEncoder().encode("%PDF-1.7 stub"); } }; }, async close() {} }));
const r = await worker.fetch(new Request("https://azimuth-2.digitalchemy.workers.dev/brief_pdf?kind=dossier&keys=businessbay%3A6&mode=rent&beds=all&key=" + CLIENT), Object.assign({}, env, { BROWSER: { fetch() {} } }), { waitUntil() {} });
ok(r.status === 200 && r.headers.get("Content-Type") === "application/pdf" && (printed[0] || "").includes("ALL HOME TYPES") && (printed[0] || "").includes("Burj Test Residences") && (printed[0] || "").includes("Curated by Najjuko"),
  "the button's URL answers a NEW-style PDF: every home type, the record's name, the Curated by Najjuko footer", r.status + " " + (printed[0] || "").slice(0, 200));
ok(!/Azimuth|digitalabbot|contact@|\+971 58|\+971 56 227/i.test(printed[0] || ""), "and nothing of the old-style document (no Azimuth mark, no company footer)");

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
