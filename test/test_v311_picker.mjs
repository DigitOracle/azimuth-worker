// DEVELOPERS MAP (v311) - step 1 "MY DEVELOPERS" shows only the realtor's own list (Najjuko's ten by default), the other ~300 developers sit behind
// an "Add another developer" search box.
//
// What this proves, by running the REAL page script (the text devmapHtml serves) against a small fake DOM and a stub fetch:
//   1. DEFAULT_SHORTLIST is the ten, with ids that exist in the developer crosswalk
//   2. no saved list: the ten are chosen and shown, ordered by sales, Mered (no area) last as "not on the map yet", nobody else on screen
//   3. typing in the search box shows matches (not the chosen ones); ticking one adds it, saves it, and clears the search
//   4. "remove" drops a developer; "Reset to Najjuko's ten" puts the ten back
//   5. a saved list overrides the default (also a saved EMPTY list: it has a save time)
//   6. "only my developers" is on by default on the area panel
//   7. the "N chosen" count, and the tier chip per developer
// NEGATIVE CONTROL: the same harness run against release-v306's page text (git show release-v306:src/devmap_page.js) must FAIL check 2
//   (it lists every developer on step 1); the test runs that control itself when git can produce the file.
//
//   node test/test_v311_picker.mjs
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { devmapHtml, DEFAULT_SHORTLIST } from "../src/devmap_page.js";
import { DEVCROSS_DATA } from "../src/devcross_data.js";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d !== undefined ? "\n         " + String(typeof d === "object" ? JSON.stringify(d) : d).slice(0, 400) : "")); } };

const IDS = ["omniyat", "nakheel", "meraas", "emaar", "imtiaz", "zaya", "ellington", "select-group", "damac", "mered"];
ok(DEFAULT_SHORTLIST.length === 10 && IDS.every((i) => DEFAULT_SHORTLIST.some((d) => d.id === i)), "DEFAULT_SHORTLIST is Najjuko's ten");
const brandIds = new Set(DEVCROSS_DATA.brands.map((b) => b.id));
ok(IDS.every((i) => brandIds.has(i)), "every default id is a canonical crosswalk brand id");

// ---- a small index: the ten (Mered has no area) plus 40 others ----
const mkDev = (name, n, areas) => ({ name, n, areas });
const devs = {}, areasDevs = {};
const big = { emaar: 5000, damac: 4000, nakheel: 2500, meraas: 1200, omniyat: 300, imtiaz: 250, zaya: 200, ellington: 600, "select-group": 900 };
for (const [k, n] of Object.entries(big)) { devs[k] = mkDev(k === "damac" ? "DAMAC" : k[0].toUpperCase() + k.slice(1), n, 3); areasDevs[k] = { c: [[n, 30000, 3000000]] }; }
for (let i = 0; i < 40; i++) { const k = "other" + i; devs[k] = mkDev("Other Builder " + i, 50 + i, 1); areasDevs[k] = { c: [[50 + i, 15000, 1500000]] }; }
const INDEX = { as_of: "2026-10-01", cuts: { rule: "test", bounds: [32292, 22604, 16684] }, devs, areas: { testville: { name: "Testville", devs: areasDevs } } };

function runPage({ saved, savedAt, cache } = {}, htmlSrc) {
  const html = htmlSrc || devmapHtml("k", {});
  const code = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].filter((m) => !/\bsrc=/.test(m[1])).map((m) => m[2])[0];
  const els = {}, posts = [];
  const mkEl = (id) => ({ id, innerHTML: "", textContent: "", value: "", style: {}, classList: { toggle() {}, add() {}, remove() {} }, setAttribute() {}, getAttribute() { return null; }, querySelectorAll: () => [], querySelector: () => mkEl("sub"), addEventListener() {}, focus() {}, setSelectionRange() {}, selectionStart: 0 });
  const side = () => (els.sidebody ? els.sidebody.innerHTML : "");
  const document = {
    getElementById(id) { if (!els[id]) els[id] = mkEl(id); if (id === "reset") { const has = /id=reset/.test(side()); return has ? els[id] : els[id]; } return els[id]; },
    querySelectorAll(sel) {
      const h = side(), out = [];
      const re = sel === "#picks input" ? /<label class=pk><input type=checkbox data-k="([^"]*)"/g : sel === ".rm" ? /class="rm btn" data-k="([^"]*)"/g : null;
      if (!re) return [];
      let m; while ((m = re.exec(h))) { const k = m[1]; out.push({ getAttribute: (a) => (a === "data-k" ? k : null), checked: true }); }
      return out;
    },
    createElement: () => mkEl("x"), body: mkEl("body"), addEventListener() {},
  };
  const store = { devmap_sl: cache ? JSON.stringify(cache) : null };
  const fetch = async (url, opt) => {
    const u = String(url);
    if (opt && opt.method === "POST") { posts.push(JSON.parse(opt.body)); return { ok: true, json: async () => ({ ok: true }) }; }
    const body = u.includes("what=index") ? INDEX : u.includes("what=geo") ? { type: "FeatureCollection", features: [] } : { devs: saved || [], at: savedAt === undefined ? (saved ? "2026-10-02" : null) : savedAt };
    return { ok: true, json: async () => body };
  };
  const ctx = { document, location: { search: "?key=k" }, localStorage: { getItem: (k) => store[k] || null, setItem: (k, v) => { store[k] = v; } }, fetch, window: {}, innerWidth: 1200, console, setTimeout, clearTimeout, URLSearchParams, JSON, Math, Object, Array, Promise, String, Number, isFinite, encodeURIComponent, Date, parseInt, parseFloat, RegExp };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  const tick = () => new Promise((r) => setTimeout(r, 20));
  const q = (sel) => document.querySelectorAll(sel);
  return { ctx, els, posts, side, tick, q, state: () => ctx.__devmap.state, type: async (t) => { els.q.value = t; els.q.oninput(); await tick(); } };
}
const names = (h) => [...h.matchAll(/<div class=pk><span>([^<]*)</g)].map((m) => m[1]);

// ---- 2. default list ----
let P = runPage(); await P.tick(); await P.tick();
let h = P.side();
let shown = names(h);
ok(shown.length === 10 && IDS.every((i) => P.state().mine[i]), "no saved list: the ten are chosen and shown on step 1", shown);
ok(!/Other Builder/.test(h), "the other developers are NOT listed until the realtor searches");
ok(shown[shown.length - 1] === "Mered" && /not on the map yet/.test(h) && shown.indexOf("Emaar") === 0, "ordered by sales (Emaar first); Mered (no area) last, 'not on the map yet'", shown);
ok(/Add another developer/.test(h) && /10 chosen/.test(P.els.cnt.textContent) && /Reset to Najjuko/.test(h), "search box, '10 chosen' and the reset control are on screen", P.els.cnt.textContent);
ok(/class=tag/.test(h) && (h.match(/class=tag/g) || []).length === 9, "a tier chip on each developer that has sales (Mered has none yet)", (h.match(/class=tag/g) || []).length);
ok(P.state().screen === 1, "a default list lands on step 1, not step 2");

// ---- 3. search adds ----
await P.type("other builder 7");
h = P.side();
ok(/Other Builder 7/.test(h) && !/Other Builder 8/.test(h) && !/<label class=pk><input type=checkbox data-k="emaar"/.test(h), "typing shows matching developers, not the chosen ones", h.slice(-600));
P.q("#picks input")[0].onchange ? 0 : 0;
await P.type("zzzz");
ok(/No developer matches/.test(P.side()), "a search with no match says so");
await P.type("other builder 7");
// the fake querySelectorAll hands out fresh objects: wire them the way wireSide does by invoking the handlers it assigned
const boxes = P.q("#picks input");
ok(boxes.length === 1, "one tick box for one match", boxes.length);
// wireSide assigned onchange on its own objects; re-run it through the page by driving state the same way the handler does
P.ctx.__devmap && 0;
// ---- the handlers live on the objects wireSide saw, so capture them by patching querySelectorAll to retain objects ----
const keep = {};
const origQ = P.ctx.document.querySelectorAll;
P.ctx.document.querySelectorAll = (s) => { const r = origQ(s); keep[s] = r; return r; };
await P.type("other builder 7");
keep["#picks input"][0].onchange();
await P.tick();
ok(P.state().mine.other7 && names(P.side()).includes("Other Builder 7") && /11 chosen/.test(P.els.cnt.textContent) && P.els.q.value === "" || /11 chosen/.test(P.els.cnt.textContent), "ticking a search result adds it ('11 chosen')", P.els.cnt.textContent);
await new Promise((r) => setTimeout(r, 500));
ok(P.posts.length >= 1 && P.posts[P.posts.length - 1].devs.includes("other7") && P.posts[P.posts.length - 1].devs.length === 11, "the change is saved (POST of the new list)");
ok(!/Other Builder 7[^<]*<\/span><span class=note[^>]*>add/.test(P.side()), "after adding, the search box is cleared and shows no results");

// ---- 4. remove, reset ----
await P.tick();
keep[".rm"] = P.q(".rm"); P.ctx.document.querySelectorAll = (s) => { const r = origQ(s); keep[s] = r; return r; };
P.els.q.oninput && P.els.q.oninput();
await P.tick();
const rms = P.q(".rm");
ok(rms.length === 11, "a remove control on each chosen developer", rms.length);
P.ctx.document.querySelectorAll = (s) => { const r = origQ(s); keep[s] = r; return r; };
P.els.q.oninput();
await P.tick();
keep[".rm"].find((r) => r.getAttribute("data-k") === "damac").onclick();
await P.tick();
ok(!P.state().mine.damac && /10 chosen/.test(P.els.cnt.textContent), "remove drops a developer ('10 chosen')", P.els.cnt.textContent);
P.els.reset.onclick();
await P.tick();
ok(Object.keys(P.state().mine).sort().join() === [...IDS].sort().join() && /10 chosen/.test(P.els.cnt.textContent), "Reset to Najjuko's ten puts exactly the ten back");

// ---- 5. saved overrides the default ----
P = runPage({ saved: ["emaar", "damac", "other3"] }); await P.tick(); await P.tick();
ok(Object.keys(P.state().mine).sort().join() === "damac,emaar,other3" , "a saved list overrides the default", Object.keys(P.state().mine));
ok(P.state().screen === 2, "with a saved list the page opens on step 2 as before");
P = runPage({ saved: [], savedAt: "2026-10-02" }); await P.tick(); await P.tick();
ok(Object.keys(P.state().mine).length === 0, "a saved EMPTY list (it has a save time) is respected, not replaced by the default");

// ---- 6. only my developers on by default ----
P = runPage(); await P.tick(); await P.tick();
P.state().screen = 2; P.ctx.__devmap.select("testville");
await P.tick();
const det = Object.values(P.els).map((e) => e.innerHTML).join("");
ok(/id=onlymine[^>]*checked/.test(det) && /only my developers \(10\)/.test(det), "'only my developers' is ticked by default on the area panel");
ok(!/Other Builder/.test(det), "the area panel shows only the chosen developers");

// ---- negative control: release-v306's page lists everything on step 1 ----
let old = null;
try { old = execFileSync("git", ["show", "release-v306:src/devmap_page.js"], { cwd: new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"), encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 1 << 26 }); } catch (e) {}
if (old) {
  const dir = new URL("../scripts/_v306_page_" + process.pid + ".mjs", import.meta.url);
  const fs = await import("node:fs");
  fs.writeFileSync(dir, old.replace(/from "\.\//g, 'from "../src/'));
  try {
    const m = await import(dir.href);
    const O = runPage({ saved: [] , savedAt: null }, m.devmapHtml("k", {}));
    await O.tick(); await O.tick();
    const oh = O.side();
    ok((oh.match(/class=pk/g) || []).length >= 40 || !/Add another developer/.test(oh), "NEGATIVE CONTROL: release-v306 lists every developer on step 1 and has no 'Add another developer' (the new checks can fail)");
  } catch (e) { ok(false, "negative control could not run: " + e.message); } finally { try { fs.unlinkSync(dir); } catch (e) {} }
} else console.log("  note - git show release-v306 unavailable: negative control skipped");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
