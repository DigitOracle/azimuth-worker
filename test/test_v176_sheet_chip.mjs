// v176 — "can we add here a button, to only show the properties that we have the .pdf for?" (Kendall, 18 Sep 2026),
// then "combine it, don't replace the other chips".
//
// Two ways this goes wrong, and both have already happened once today in another object:
//   1. Filtering on r.sheet ALONE. 2,597 rows in the index carry a slug; 22 documents exist. A chip built on the slug
//      would hand her 2,575 rows that open nothing — the icon over symphony, one layer up.
//   2. A count that is not what the screen is showing. "22" above a list of four buildings claims something untrue.
// And because it COMBINES rather than replaces, clearing the type filter must not silently answer the sheet question
// for her — she only answered it once.
import worker from "../src/index.js";

const READ = "owner_admin_key_never_in_client_links_0001";
const CLIENT = "client_key_current_abcdefghij";

const store = new Map();
store.set("img_search_index", JSON.stringify({ items: [
  { n: "Bellevue Towers", t: "building", sheet: "bellevue_towers" },
  { n: "Churchill Tower", t: "building", sheet: "churchill_tower" },
  { n: "Eden House The Park", t: "development", sheet: "eden_house_the_park" },
  { n: "A Development", t: "development", sheet: "no_document_here" },
  { n: "Arada", t: "developer" },
] }));
for (const slug of ["bellevue_towers", "churchill_tower", "eden_house_the_park"]) {
  store.set("sheet_" + slug, "%PDF-1.4 pretend document");
  store.set("sheetm_" + slug, JSON.stringify({ slug, pages: 2, bytes: 380000 }));
}

const KV = {
  async get(k, t) { if (!store.has(k)) return null; const v = store.get(k); if (t === "json") { try { return JSON.parse(v); } catch (e) { return null; } } return v; },
  async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter((k) => k.startsWith(p)).map((name) => ({ name })), list_complete: true }; },
};
globalThis.fetch = async () => new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
const env = { MEETINGS: KV, READ_KEY: READ, CLIENT_KEY: CLIENT, GOOGLE_MAPS_KEY: "g", PUBLIC_ORIGIN: "https://x" };
const call = (k) => worker.fetch(new Request("https://x/find?key=" + encodeURIComponent(k)), env, { waitUntil() {} });

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("ok - " + m); } else { fail++; console.log("not ok - " + m); } };

const owner = await (await call(READ)).text();
const client = await (await call(CLIENT)).text();

ok(owner.includes('id=shchip'), "the owner gets the chip");
ok(!client.includes("id=shchip"), "a client link does not - only the owner can open a sheet at all, so the filter would be a promise the page cannot keep");

// it COMBINES: the type chips must not be able to clear it
ok(/var SHEETS=null/.test(client), "and a client page is told of NO documents, so the handler it still carries can never filter on anything");
ok(owner.includes('document.querySelectorAll(".chip[data-t]")'), "the type chips select among themselves by data-t, so they cannot switch the sheet chip off");
ok(!/querySelectorAll\("\.chip"\)\.forEach\(function\(c\)\{c\.onclick/.test(owner), "and the old all-chips handler, which would have cleared it, is gone");
ok(/SH=SH\?0:1/.test(owner), "the sheet chip toggles its own state");
ok(/var IDX=null,T="",SH=0;/.test(owner), "SH lives beside T rather than inside it - clearing the type filter leaves her sheet answer alone");

// it filters on the DOCUMENT, never on the slug
ok(/if\(SH\)rows=rows\.filter\(function\(r\)\{return r\.sheet&&SHEETS&&SHEETS\[r\.sheet\]\}\)/.test(owner),
   "the filter requires the slug to be in SHEETS - a row whose slug has no document is not offered");
ok(!/if\(SH\)rows=rows\.filter\(function\(r\)\{return r\.sheet\}\)/.test(owner), "and never on the slug alone");

// the count is the intersection of what is showing
ok(/for\(var _i=0;_i<rows\.length;_i\+\+\)/.test(owner), "the count is computed over the rows CURRENTLY showing, after the type and text filters");
ok(/_sc2\.textContent="with a PDF · "\+_nsh/.test(owner), "and the chip prints that number, so it cannot disagree with the list under it");

// when we cannot know, it offers nothing rather than a filter that lies
ok(/if\(_sc&&!SHEETS\)\{_sc\.remove\(\)\}/.test(owner), "if the document list could not be read, the chip removes itself - an unanswerable filter is worse than none");

// and the live map really is the documents, not the metas (v174)
ok(/"bellevue_towers":1/.test(owner) && /"churchill_tower":1/.test(owner), "the live document map reaches the page");
ok(!/"no_document_here":1/.test(owner), "a slug with no document is absent from it, so the chip can never count it");

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
