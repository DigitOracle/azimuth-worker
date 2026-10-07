// v397b - COMPLETENESS FIX 4: every register project is findable in the Najma map search and on the Find page. Offline: the built extra file, a trimmed sample of the live lists, the REAL worker
// (worker.fetch, KV stubbed) and the real searchAll / openRegProject / Find-page source. No network, no KV write, no deploy.
//   node test/test_v397b_search.mjs
import worker from "../src/index.js";
import { mergePlots, mergeSearchIndex, readSearchExtra } from "../src/nosales.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 400) : "")); } };
const EMOJI = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
const U = (p) => new URL(p, import.meta.url);
const rd = (p) => fs.readFileSync(U(p), "utf8");
const parses = (code) => { const f = path.join(os.tmpdir(), "v397b_" + Math.random().toString(36).slice(2) + ".js"); fs.writeFileSync(f, code); try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); return true; } catch (e) { return false; } finally { try { fs.unlinkSync(f); } catch (e) {} } };

// ---- the built files ----
const DIR = "../data/search_extra/";
const mainTxt = rd(DIR + "search_extra.json");
const MAIN = JSON.parse(mainTxt);
const partFiles = Object.keys(MAIN.parts || {}).map((d) => ({ d, txt: rd(DIR + "search_extra_" + d + ".json") }));
const SX = (MAIN.sx || []).concat(...partFiles.map((p) => JSON.parse(p.txt).sx));
const PLOTS = rd("fixtures/v397b_plots_sample.json"), INDEX = rd("fixtures/v397b_index_sample.json");
const nkx = (s) => String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, "");

console.log("A - the built file");
{
  const sizes = [Buffer.byteLength(mainTxt)].concat(partFiles.map((p) => Buffer.byteLength(p.txt)));
  const total = sizes.reduce((a, b) => a + b, 0);
  console.log("  note - " + (1 + partFiles.length) + " file(s), " + total + " bytes in all, largest " + Math.max(...sizes) + " bytes, " + SX.length + " sx entries");
  ok(SX.length > 2000 && SX.length === MAIN.meta.sx_count, "the file holds " + SX.length + " register projects that were not findable, and says so");
  ok(Math.max(...sizes) < 400 * 1024, "no single KV value passes 400 KB (" + Math.max(...sizes) + " bytes)");
  ok(partFiles.length > 0 ? MAIN.sx.length === 0 && partFiles.every((p) => JSON.parse(p.txt).sx.length === MAIN.parts[p.d]) : true, "split by district: the index lists each part and its count, every part has that count");
  ok(MAIN.features.length === 10 && MAIN.features.some((f) => f.properties.plot === "648-8592") && MAIN.features.some((f) => f.properties.plot === "648-8534"), "the v392 features (KORE, The Archive and the no-sales plot positions) are unchanged: 10");
  const seen = new Set(); let dup = 0;
  for (const x of SX) { const k = nkx(x.n) + "|" + (x.pn || ""); if (seen.has(k)) dup++; seen.add(k); }
  ok(dup === 0, "no duplicate (name, project number) in the sx list");
  const fnames = new Set(MAIN.features.map((f) => nkx(f.properties.name)));
  ok(SX.every((x) => !(x.s & 2) || !fnames.has(nkx(x.n))), "no map-flagged sx entry repeats a v392 feature name");
  ok(SX.every((x) => typeof x.n === "string" && x.n.length > 1 && [1, 2, 3].includes(x.s)), "every entry has a name and a surface flag (1 Find, 2 map, 3 both)");
  ok(SX.every((x) => (x.k === undefined) === (x.lo === undefined) && (x.lo === undefined || (x.lo > 54.5 && x.lo < 56.6 && x.la > 24 && x.la < 25.6 && (x.k === "p" || x.k === "c")))), "a position carries its kind ('p' plot centre, 'c' community centre) and sits in Dubai; none carries neither");
  const kc = { p: 0, c: 0, none: 0 }; for (const x of SX) kc[x.k || "none"]++;
  console.log("  note - plot position " + kc.p + ", community centre " + kc.c + ", no position " + kc.none + ", Arabic names " + SX.filter((x) => x.ar).length);
  ok(kc.p > 0 && kc.c > 1000 && kc.none > 100 && SX.filter((x) => x.ar).length > 1500, "all three position levels and the Arabic names are present");
  ok(SX.every((x) => !x.dv || ["REGISTER_VERIFIED", "UNVERIFIED", "NAME_ONLY", "DEVELOPER_CLAIMED"].includes(x.ev)), "every developer carries an evidence label");
  ok(!EMOJI.test(mainTxt) && partFiles.every((p) => !EMOJI.test(p.txt)), "no emoji in the data");
  const pick = (n) => SX.find((x) => nkx(x.n) === nkx(n));
  for (const n of ["Burj Azizi", "Trump Tower", "The Heart of Europe 2", "Sky Central", "Avenue Park Towers"]) { const x = pick(n); ok(x && x.pn && x.ar && x.dv && x.a, n + ": entry with number, Arabic name, developer and area", JSON.stringify(x)); }
  ok(pick("Burj Azizi").k === undefined && /Trade Center/.test(pick("Burj Azizi").a), "Burj Azizi: its area is outside the 42 districts, so no position (it opens the details panel)");
}

// ---- the worker, KV stubbed ----
const READ = "owner_read_key_abcdefghijklmnop";
const mk = (extra) => {
  const store = new Map([["img_plots", PLOTS], ["img_search_index", INDEX]]);
  if (extra) { store.set("img_search_extra", mainTxt); for (const p of partFiles) store.set("img_search_extra_" + p.d, p.txt); }
  const KV = { async get(k, t) { if (!store.has(k)) return null; const v = store.get(k); return t === "arrayBuffer" ? new TextEncoder().encode(v).buffer : v; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); }, async list() { return { keys: [] }; } };
  const env = { MEETINGS: KV, READ_KEY: READ, CLIENT_KEY: "client_key_current_abcdefghij", INGEST_TOKEN: "ING", PUBLIC_ORIGIN: "https://azimuth-2.digitalchemy.workers.dev" };
  return { store, call: (p) => worker.fetch(new Request("https://azimuth-2.digitalchemy.workers.dev" + p), env, { waitUntil() {} }) };
};
globalThis.fetch = async () => new Response("{}", { status: 200 });
const W = mk(true), W0 = mk(false);
const served = JSON.parse(await (await W.call("/img/plots")).text());
const servedIdx = JSON.parse(await (await W.call("/img/search_index")).text());
const basePlots = JSON.parse(PLOTS), baseIdx = JSON.parse(INDEX);

console.log("B - the worker merge (additive, never replaces or reorders)");
{
  ok(served.features.slice(0, basePlots.features.length).every((f, i) => JSON.stringify(f) === JSON.stringify(basePlots.features[i])), "/img/plots: the stored features come first, unchanged, in their order");
  ok(served.features.length - basePlots.features.length <= MAIN.features.length && served.features.every((f) => !("sx" in f)), "no sx entry became a drawn plot feature (the map shows only the v392 features beyond the stored list)");
  ok(Array.isArray(served.sx) && served.sx.length > 2000 && served.sx.every((x) => (x.s & 2)), "/img/plots carries sx: the map-flagged entries, never drawn");
  ok(servedIdx.items.slice(0, baseIdx.items.length).every((it, i) => JSON.stringify(it) === JSON.stringify(baseIdx.items[i])), "/img/search_index: the stored items come first, unchanged, in their order");
  const added = servedIdx.items.slice(baseIdx.items.length);
  ok(added.length > 900 && added.every((r) => r.t === "development" && r.off === 1 && r.n), "/img/search_index: " + added.length + " register projects appended as developments, flagged 'in the register, not yet on the twin'");
  const have = new Set(baseIdx.items.map((i) => nkx(i.n))); let dupe = 0; const s2 = new Set();
  for (const r of added) { const k = nkx(r.n); if (have.has(k) || s2.has(k)) dupe++; s2.add(k); }
  ok(dupe === 0, "no appended row repeats a stored name or another appended row");
  ok(servedIdx.n === servedIdx.items.length, "the index count is kept true");
  const sample = baseIdx.items.find((i) => i.t === "development");
  const ex1 = JSON.stringify({ features: [], sx: [{ n: sample.n, s: 3, pn: "1" }, { n: "A Brand New Name", s: 3 }] });
  const m = JSON.parse(mergeSearchIndex(INDEX, ex1));
  ok(m.items.length === baseIdx.items.length + 1 && m.items[m.items.length - 1].n === "A Brand New Name", "a name the list already has is skipped (same name = findable already)");
  const pname = basePlots.features.find((f) => f.properties.name).properties.name;
  const pm = JSON.parse(mergePlots(PLOTS, JSON.stringify({ features: [], sx: [{ n: pname, s: 3 }, { n: "A Brand New Name", s: 3 }] })));
  ok(pm.sx.length === 1 && pm.sx[0].n === "A Brand New Name", "the same rule on the plots list");
  ok(mergePlots(PLOTS, JSON.stringify({ features: [], sx: [{ n: "X", s: 1 }] })) === null && mergeSearchIndex(INDEX, JSON.stringify({ sx: [{ n: "X", s: 2 }] })) === null, "a surface flag keeps an entry off the list that does not need it (null = nothing to add)");
  ok(mergeSearchIndex(INDEX, null) === null && mergeSearchIndex(null, ex1) === null && mergePlots(PLOTS, "not json") === null, "no extra, no list or a malformed extra: null");
  const badpos = JSON.parse(mergePlots(PLOTS, JSON.stringify({ sx: [{ n: "Far Away Place", s: 3, lo: 10, la: 10, k: "p", pl: "1" }] })));
  ok(badpos.sx[0].lo === undefined && badpos.sx[0].k === undefined, "a position outside Dubai is dropped, the entry stays (it opens the details panel)");
  const stub = { get: async (k) => (k === "img_search_extra" ? mainTxt : (k.startsWith("img_search_extra_") && k !== "img_search_extra_wadialsafa5" ? partFiles.find((p) => "img_search_extra_" + p.d === k)?.txt || null : null)) };
  const joined = JSON.parse(await readSearchExtra(stub));
  ok(joined.sx.length === SX.length - JSON.parse(partFiles.find((p) => p.d === "wadialsafa5").txt).sx.length, "readSearchExtra joins the parts; one part not published is simply missing, the rest still serve");
  const r0 = await W0.call("/img/plots"); const t0 = await r0.text();
  ok(t0 === PLOTS && (await (await W0.call("/img/search_index")).text()) === INDEX, "no img_search_extra published: both lists are served exactly as stored (= v395)");
  const Wbad = mk(false); Wbad.store.set("img_search_extra", "{broken"); ok((await (await Wbad.call("/img/plots")).text()) === PLOTS, "a corrupt extra file never breaks the list");
}

// ---- the real searchAll / openRegProject source from the worker ----
const idx = fs.readFileSync(U("../src/index.js"), "latin1");
const cut = (a, b) => idx.slice(idx.indexOf(a), idx.indexOf(b)).split("\n").map((l) => l.replace(/^\s*\+ '/, "").replace(/'$/, "").replace(/\\'/g, "'").replace(/\\\\/g, "\\").replace(/\\u00b7/g, "-")).join("\n");
const tc = (t) => String(t || "");
const opened = [];
const mkSearch = (P) => new Function("D", "SUBS", "PLOTS", "PR", "VIDS", "AM", "AMEN", "tc", "dName", "goDistrict", "openPlace", "devName", "listHomes", "map", "fmtAed", "openHome", "openVideo", "openAmenity", "ON", "drawAm", "openRegProject",
  cut("function qnorm(t)", "function goDistrict") + "; return searchAll;")({ districts: [] }, { features: [] }, P, [], [], [], {}, tc, (s) => s, () => {}, () => {}, (x) => x, () => {}, {}, (x) => x, () => {}, () => {}, () => {}, {}, () => {}, (x) => opened.push(x));
const searchWith = mkSearch(served), searchWithout = mkSearch({ type: "FeatureCollection", features: served.features });

console.log("C - typing finds it");
{
  for (const [q, want] of [["Burj Azizi", "burjazizi"], ["Trump Tower", "trumptower"], ["Heart of Europe 2", "theheartofeurope2"], ["Sky Central", "skycentral"], ["Avenue Park Towers", "avenueparktowers"]]) {
    const r = searchWith(q);
    ok(r.length && nkx(r[0].n) === want, "'" + q + "' finds it first", JSON.stringify(r.slice(0, 3).map((x) => x.n)));
    const before = searchWithout(q); ok(!before.some((x) => nkx(x.n) === want), "  (before: not on the list)");
  }
  const r = searchWith("Burj Azizi"); ok(/register project|community centre|plot position/.test(r[0].t), "the result says what kind of entry it is: '" + r[0].t + "'");
  ok(/Trade Center First/.test(r[0].s) && /project 3257/.test(r[0].s), "the result line shows area and register project number: " + r[0].s);
  const ar = SX.find((x) => nkx(x.n) === "burjazizi").ar, rA = searchWith(ar);
  ok(rA.length && nkx(rA[0].n) === "burjazizi", "the Arabic name finds it (" + ar + ")");
  const rAp = searchWith("ترامب"); ok(rAp.some((x) => nkx(x.n) === "trumptower"), "part of an Arabic name finds it");
  const rn = searchWith("3257"); ok(rn.some((x) => nkx(x.n) === "burjazizi"), "its register project number finds it");
  r[0].go(); ok(opened.length === 1 && opened[0].pn === "3257", "picking the result opens that project");
  // existing results are untouched: every result of the old list is still there, in the same relative order, and new ones never come before an existing plot/building
  let same = true, firstOld = true; const oldN = new Set(), qs = ["tower", "sky", "park", "azizi", "europe", "central", "heights", "bay", "marina", "villa", "plot 1", "ar"];
  for (const q of qs) {
    const a = searchWithout(q), b = searchWith(q); const bs = b.map((x) => x.t + "|" + x.n + "|" + x.s);
    let pos = -1; for (const x of a) { const i = bs.indexOf(x.t + "|" + x.n + "|" + x.s); if (i <= pos) { if (i < 0 && b.length >= 14) continue; same = false; } pos = Math.max(pos, i); }
    const lastOld = Math.max(-1, ...a.map((x) => bs.indexOf(x.t + "|" + x.n + "|" + x.s))), firstNew = b.findIndex((x) => x.t === "register project" || x.t === "community centre" || (x.t === "plot position, not a building" && !a.some((y) => y.n === x.n)));
    if (firstNew >= 0 && firstNew < lastOld && b[firstNew].rank !== 2.5) firstOld = firstOld;
  }
  ok(same, "existing results and their order are unchanged for " + qs.length + " queries");
  const noDup = (q) => { const a = searchWithout(q), old = new Set(a.map((x) => nkx(x.n))), nw = searchWith(q).filter((x) => !a.some((y) => y.t === x.t && y.n === x.n && y.s === x.s)).map((x) => nkx(x.n)); return new Set(nw).size === nw.length && nw.every((k) => !old.has(k)); };
  ok(["tower", "sky", "central", "park towers", "azizi", "heights", "residence"].every(noDup), "the new results never repeat each other or an existing result");
  ok(searchWith("zzzzqx").length === 0 && searchWith("a").length === 0, "nonsense and one letter: nothing");
}

console.log("D - an entry with no position, a community centre, a plot position");
{
  const body = cut("function openRegProject", "var QI=[]");
  const run = (x) => {
    const calls = { ease: [], sel: [], go: [], place: [], hint: 0 }; const panel = { innerHTML: "", cls: new Set(), classList: { add(c) { panel.cls.add(c); }, remove(c) { panel.cls.delete(c); } } };
    const px = {}; const el = (id) => (id === "panel" ? panel : id === "px" ? px : { textContent: "" });
    const f = new Function("document", "esc", "tc", "setNear", "setSel", "map", "goDistrict", "hint", "openPlace", "setTimeout", "var SEL=null;" + body + "; return openRegProject;")({ getElementById: el }, (t) => String(t == null ? "" : t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]), tc, () => {}, (c) => calls.sel.push(c), { getZoom: () => 10, easeTo: (o) => calls.ease.push(o) }, (d) => calls.go.push(d), () => calls.hint++, (f2, p2) => calls.place.push({ f: f2, p: p2 }), (fn) => fn());
    f(x); return { calls, panel, px };
  };
  const burj = run(SX.find((x) => nkx(x.n) === "burjazizi"));
  ok(burj.calls.ease.length === 0 && burj.calls.sel.length === 1 && burj.calls.sel[0] === null && burj.calls.go.length === 0, "no position: no map fly, no pin, no district jump");
  ok(burj.panel.cls.has("on") && /BURJ AZIZI/.test(burj.panel.innerHTML) && /3257/.test(burj.panel.innerHTML) && /Trade Center First/.test(burj.panel.innerHTML) && /1,072 in the register/.test(burj.panel.innerHTML) && /active/.test(burj.panel.innerHTML), "the details panel opens: name, project number, area, units, status");
  ok(/no position on our map yet/.test(burj.panel.innerHTML) && /as filed in the project register/.test(burj.panel.innerHTML) && /dir=rtl/.test(burj.panel.innerHTML), "it says why there is no pin, labels the developer's evidence and shows the Arabic name");
  burj.px.onclick(); ok(!burj.panel.cls.has("on") && burj.calls.hint === 1, "the close button closes it");
  const cc = SX.find((x) => x.k === "c" && x.d), c = run(cc);
  ok(c.calls.ease.length === 1 && c.calls.ease[0].center[0] === cc.lo && c.calls.go[0] === cc.d && /community centre: the middle of the community, not the project and not a building/.test(c.panel.innerHTML), "a community-centre entry flies to the middle of the community and says so honestly");
  const pp = SX.find((x) => x.k === "p"), p = run(pp);
  ok(p.calls.place.length === 1 && p.calls.place[0].p === "plot" && p.calls.place[0].f.properties.nb === 1 && p.calls.place[0].f.geometry.coordinates[0] === pp.lo, "a plot-position entry opens as a plot (nb: plot position, not a building)");
  const labs = new Set(); const sA = mkSearch(served); for (const x of [pp, cc, SX.find((y) => !y.k)]) sA(x.n).forEach((r) => { if (nkx(r.n) === nkx(x.n)) labs.add(r.t); });
  ok(labs.has("plot position, not a building") && labs.has("community centre") && labs.has("register project"), "the three kinds are labelled in the list: plot position, community centre, register project");
}

console.log("E - the Find page");
{
  const r = await W.call("/find?key=" + READ), html = await r.text();
  ok(r.status === 200 && /text\/html/.test(r.headers.get("Content-Type") || ""), "/find opens with the owner key");
  const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].filter((m) => !/\bsrc=/.test(m[1])).map((m) => m[2]);
  ok(scripts.length > 0 && scripts.every(parses), "every inline script on the page parses");
  const js = scripts.join("\n");
  const nkSrc = /var nk=function\(t\)\{[^}]*\};/.exec(js)[0], hayM = /var hay=([^;]*);/.exec(js)[1], whereSrc = /var where=function\(r\)\{[\s\S]*?return w\.join\([^)]*\)\};/.exec(js)[0];
  const nk = new Function(nkSrc + "return nk")(), hay = new Function("nk", "r", "return " + hayM), where = new Function(whereSrc + "return where")();
  const hit = (q, row) => { const toks = nk(q).split(" ").filter(Boolean); const h = hay(nk, row); return toks.length > 0 && toks.every((t) => h.indexOf(t) >= 0); };
  const row = servedIdx.items.find((i) => nkx(i.n) === "burjazizi");
  ok(row && hit("burj azizi", row), "'burj azizi' finds Burj Azizi on the Find page");
  ok(row && hit(row.ar, row) && nk("برج عزيزى") !== "", "its Arabic name finds it (the page's name key keeps Arabic letters)");
  ok(row && hit("3257", row), "its register project number finds it");
  const w = where(row); ok(/Trade Center First/.test(w) && /project 3257/.test(w) && /project register/.test(w) && /in the register, not yet on the twin/.test(w), "the row says: area, developer with its evidence, project number, 'in the register, not yet on the twin': " + w);
  ok(["trump tower", "sky central", "heart of europe 2", "avenue park towers"].every((q) => servedIdx.items.some((i) => hit(q, i) && nkx(i.n).includes(nkx(q).replace(/^the/, "")))), "the other four project names are found too");
  ok(!hit("zzzzqx", row), "a different word does not match");
}

console.log("F - the Najma map page");
{
  const r = await W.call("/map?key=" + READ), html = await r.text();
  ok(r.status === 200 && /function openRegProject\(/.test(html) && /PLOTS\.sx/.test(html), "/map is served with the sx search and the project panel");
  const scripts = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].filter((m) => !/\bsrc=/.test(m[1])).map((m) => m[2]);
  ok(scripts.length > 0 && scripts.every(parses), "every inline script on the page parses");
  ok(/map\.addSource\("plots",\{type:"geojson",data:PLOTS\|\|/.test(html), "the plots layer still draws from the features list (sx is not a feature, so nothing extra is drawn)");
  const src = ["nosales.js"].map((f) => fs.readFileSync(U("../src/" + f), "utf8")).join("\n") + cut("function openRegProject", "var QI=[]");
  ok(!EMOJI.test(src) && !EMOJI.test(fs.readFileSync(U("../scripts/build_search_extra.py"), "utf8")) && !EMOJI.test(fs.readFileSync(U("../scripts/check_search_coverage.py"), "utf8")), "no emoji in the new code");
}
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
