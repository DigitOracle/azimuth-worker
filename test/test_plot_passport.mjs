// Plot Passport (2 Nov 2026): through the real worker entry with a fake KV, and the served page + served script checked together.
import worker from "../src/index.js";
import { ppCrc32 } from "../src/plot_passport.js";
import vm from "node:vm";
import zlib from "node:zlib";
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL " + m); } };
const store = new Map();
const KV = { async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, String(v)); }, async delete(k) { store.delete(k); }, async list(o) { const pre = (o && o.prefix) || ""; return { keys: [...store.keys()].filter((k) => k.startsWith(pre)).map((name) => ({ name })), list_complete: true }; } };
const env = { MEETINGS: KV, READ_KEY: "RK", INGEST_TOKEN: "ING", MAILBOXES: "" };
const get = (p) => worker.fetch(new Request("https://x" + p), env, { waitUntil() {} });
const ID = "naj:plot:319-268";
ok(ppCrc32(ID) === zlib.crc32(Buffer.from(ID)), "the worker's bucket hash equals the builder's (Python zlib.crc32)");
const P = { id: ID, parcel: "3190268", plot_no: "319-268", area_land: "388/80", area_name: "Oud Metha", district: "oudmetha", land_type: "Commercial", prop_type: "Land", sub_type: "Commercial", sqm: 3716.12, freehold: false, as_of: "2026-11-01", rule: "plot-master v1", last: "2025-12-12",
  buildings: [{ no: "80", name: null, floors: "1", type: "Building", date: "2011-08-15", s: "d" }],
  projects: [{ no: "456378", status: "Completed", consultant: "ACME Consultants", contractor: "Build Co", start: "2025-08-01", done: "2025-12-12", s: "d" }],
  permits: [{ no: "458961-1-1", type: "Apply for Buildings Drawings", status: "Approved", date: "2025-08-06", s: "d" }],
  evidence: [{ src: "g_dm__building_permits", label: "Building permits (Dubai Municipality)", method: "parcel_direct", conf: 0.95, n: 1, s: "d", as_of: "2026-11-01", cov: 94.3 }, { src: "lk_rooftop_2017", label: "2017 rooftop outlines", method: "point_in_parcel_2017", conf: 0.7, n: 26, s: "m" }],
  projlevel: [{ src: "lk_dld_rents", label: "Rent contracts (Ejari), project level", method: "via_project", conf: 0.4, n: 3, s: "p" }],
  timeline: [{ date: "2025-12-12", what: "Project 456378 completed", src: "g_dm__project_information", s: "d" }], flags: [{ k: "map_only", t: "Some records reach this plot only by location." }] };
store.set("pp_meta", JSON.stringify({ as_of: "2026-11-01", plots: 1, buckets: 4096, built_at: "2026-11-02T02:00:00Z" }));
store.set("pp_b_" + (ppCrc32(ID) % 4096), JSON.stringify({ [ID]: P }));
store.set("pp_s_31", JSON.stringify([["3190268", "Plot 3190268 · Oud Metha", ID, ppCrc32(ID) % 4096, "number"], ["319 268", "Plot 3190268 · Oud Metha", ID, 0, "number"]]));

for (const p of ["/plot_passport", "/plot_passport/search?q=31", "/plot_passport/p?id=" + ID, "/plot_passport/report?id=" + ID]) ok((await get(p + (p.includes("?") ? "&" : "?") + "key=BAD")).status === 401, "wrong key refused: " + p);
let r = await get("/plot_passport?key=RK"); const html = await r.text();
ok(r.status === 200 && /Plot <em>passport<\/em>/.test(html), "the page serves");
ok(/Register snapshot 2026-11-01/.test(html), "the page states the data freshness");
ok(!/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(html), "no emoji on the page");
ok(!/dewa/i.test(html) && !/google\s*(places|maps)/i.test(html), "no DEWA or Google content");
ok(/Direct match/.test(html) && /Map-based estimate/.test(html) && /Project-level only/.test(html), "the legend carries all three strengths");
const js = html.match(/<script>(\(function\(\)\{[\s\S]*?\}\)\(\);)<\/script>/);
ok(!!js, "the page script is present");
try { new vm.Script(js[1]); } catch (e) { ok(false, "page script parses: " + e.message); }
for (const id of [...js[1].matchAll(/\$\("([a-z]+)"\)/g)].map((m) => m[1])) ok(html.includes("id=" + id), "markup has #" + id + " that the script reads");
ok(/id=ppmt/.test(html), "method vocabulary embedded");
let j = await (await get("/plot_passport/search?key=RK&q=319-268")).json();
ok(j.results.length === 1 && j.results[0].id === ID, "search by municipality plot number (319-268) finds the plot once");
j = await (await get("/plot_passport/search?key=RK&q=3190268")).json();
ok(j.results[0] && j.results[0].exact, "search by parcel number: exact match first");
j = await (await get("/plot_passport/search?key=RK&q=3")).json();
ok(j.short && !j.results.length, "one character asks for more");
j = await (await get("/plot_passport/search?key=RK&q=zz")).json();
ok(j.results.length === 0, "no shard = no results, no error");
r = await get("/plot_passport/p?key=RK&id=" + encodeURIComponent(ID)); j = await r.json();
ok(r.status === 200 && j.ok && j.plot.parcel === "3190268", "passport returns the plot");
ok((await get("/plot_passport/p?key=RK&id=bad%3Cx")).status === 400, "a malformed id is refused");
ok((await get("/plot_passport/p?key=RK&id=naj:plot:9999999")).status === 404, "an unknown plot is a 404");
r = await get("/plot_passport/report?key=RK&id=" + encodeURIComponent(ID)); const rep = await r.text();
ok(r.status === 200 && /Print or save as PDF/.test(rep), "report serves with a print button");
ok(/Research use only/.test(rep) && /snapshot 2026-11-01/.test(rep), "report states research use and the snapshot date");
ok(/Rent contracts \(Ejari\), project level/.test(rep) && /Project-level only/.test(rep), "project-level evidence is labelled project-level, not a plot fact");
ok(/ACME Consultants/.test(rep) && /458961-1-1/.test(rep), "report carries projects and permits");
ok(/Prepared for Dr\. Digital Abbot/.test(rep), "report addressed per house style");
const more = await (await get("/more?key=RK")).text();
ok(/href="\/plot_passport\?key=RK/.test(more) && /PLOT PASSPORT/.test(more), "More lists PLOT PASSPORT with the key carried");
// the served script run against a minimal DOM, fetching through the worker (page + script together)
const els = {}; const mk = (id) => (els[id] = els[id] || { id, value: "", hidden: false, innerHTML: "", textContent: "", classList: { contains() { return false; }, toggle() {} }, addEventListener() {}, scrollIntoView() {}, querySelector() { return null; } });
const doc = { body: { getAttribute: (a) => (a === "data-key" ? "RK" : "") }, getElementById: (id) => (id === "ppmt" ? { textContent: html.match(/id=ppmt>([\s\S]*?)<\/script>/)[1] } : /^ic-/.test(id) ? { innerHTML: "<svg></svg>" } : mk(id)), addEventListener() {}, title: "" };
const ctx = { document: doc, window: { addEventListener() {} }, location: { search: "?key=RK&id=" + encodeURIComponent(ID), href: "" }, history: { pushState() {} }, URLSearchParams, setTimeout, clearTimeout, navigator: {}, fetch: async (u) => get(u) };
vm.runInNewContext(js[1], ctx);
await new Promise((res) => setTimeout(res, 50));
const outH = els.ppout.innerHTML;
ok(/Plot 3190268/.test(outH) && /3,716 sq m/.test(outH), "page script renders the summary in plain words");
ok(/Research report/.test(outH) && /Research flags/.test(outH), "renders the report button and research flags");
ok(!/Rent contracts \(Ejari\)/.test(outH) && /more source/.test(outH), "default view hides inferred links and says they exist");
ok(!/2017 rooftop outlines/.test(outH), "default view: map-based links are not shown as direct facts");
// ---- hierarchical browse (Kendall 2 Nov: users will not know parcel numbers): district -> building -> plot
const ID2 = "naj:plot:346-550", ID3 = "naj:plot:346-551", ID4 = "naj:plot:346-552";
for (const [i, x] of [[ID2, "3460550"], [ID3, "3460551"], [ID4, "3460552"]]) { const k = "pp_b_" + (ppCrc32(i) % 4096); const cur = JSON.parse(store.get(k) || "{}"); cur[i] = { ...P, id: i, parcel: x, district: "businessbay", area_name: "Business Bay" }; store.set(k, JSON.stringify(cur)); }
store.set("pp_dl", JSON.stringify([{ slug: "businessbay", name: "Business Bay", n: 3, g: 2 }, { slug: "oudmetha", name: "Oud Metha", n: 1, g: 1 }]));
store.set("pp_d_businessbay", JSON.stringify({ slug: "businessbay", name: "Business Bay", n: 3, groups: [["014 TOWER", "b", [[ID2, "Plot 3460550"]]], ["Bay Square", "p", [[ID3, "Plot 3460551"], [ID4, "Plot 3460552"]]], ["Burj Views", "b", [[ID4, "Plot 3460552"]]]], vacant: [[ID4, "Plot 3460552 · Residential"]] }));
j = await (await get("/plot_passport/districts?key=RK")).json();
ok(j.districts.length === 2 && j.districts[0].name === "Business Bay", "districts route lists friendly names");
j = await (await get("/plot_passport/d?key=RK&slug=businessbay")).json();
ok(j.ok && j.district.groups.length === 3 && j.district.vacant.length === 1, "district route returns buildings, projects and plots without a building");
ok((await get("/plot_passport/d?key=RK&slug=../x")).status === 400 && (await get("/plot_passport/d?key=RK&slug=nowhere")).status === 404, "bad or unknown district refused");
ok((await get("/plot_passport/districts?key=BAD")).status === 401, "districts route is key-gated");
ok(/id=ppb1/.test(html) && /id=ppb2/.test(html) && /role=dialog/.test(html) && /aria-labelledby=ppsht/.test(html), "browse steps and an accessible sheet are in the markup");
{
  const E = {}; let clickH = null;
  const el = (id) => (E[id] = E[id] || { id, value: "", hidden: id === "ppsheet" || id === "ppscrim", disabled: false, innerHTML: "", textContent: "", placeholder: "", attrs: {}, setAttribute(a, v) { this.attrs[a] = v; }, getAttribute(a) { return this.attrs[a]; }, hasAttribute(a) { return a in this.attrs; }, classList: { contains() { return false; }, toggle() {} }, addEventListener(t, f) { if (id === "ppshq" && t === "input") this.onin = f; }, focus() {}, scrollIntoView() {}, querySelector() { return null; } });
  const d2 = { body: { getAttribute: (a) => (a === "data-key" ? "RK" : "") }, activeElement: null, getElementById: (id) => (id === "ppmt" ? { textContent: html.match(/id=ppmt>([\s\S]*?)<\/script>/)[1] } : /^ic-/.test(id) ? { innerHTML: "<svg></svg>" } : el(id)), addEventListener(t, f) { if (t === "click") clickH = f; }, title: "" };
  const c2 = { document: d2, window: { addEventListener() {} }, location: { search: "?key=RK", href: "" }, history: { pushState() {} }, URLSearchParams, setTimeout, clearTimeout, navigator: {}, fetch: async (u) => get(u) };
  vm.runInNewContext(js[1], c2);
  const tick = () => new Promise((res) => setTimeout(res, 30));
  const tap = (attrs, id) => clickH({ target: { closest: () => ({ id: id || "", attrs, hasAttribute: (a) => a in attrs, getAttribute: (a) => attrs[a], classList: { contains: () => false } }) } });
  const optIndex = (label) => { const m = [...E.ppshl.innerHTML.matchAll(/data-opt="(\d+)"><svg[^>]*>.*?<\/svg><span><b>([^<]*)<\/b>/g)].find((x) => x[2] === label); return m ? m[1] : null; };
  tap({}, "ppb1"); await tick();
  ok(E.ppsheet.hidden === false && /Choose a district/.test(E.ppsht.textContent) && optIndex("Business Bay") !== null, "tap 1 opens the district sheet with friendly names");
  E.ppshq.value = "busi"; E.ppshq.onin(); ok(optIndex("Business Bay") !== null && optIndex("Oud Metha") === null, "type-ahead filters the district list");
  tap({ "data-opt": optIndex("Business Bay") }); await tick();
  ok(/Business Bay: buildings and projects/.test(E.ppsht.textContent) && E.ppb1v.textContent === "Business Bay" && E.ppb2.disabled === false, "choosing a district opens its buildings straight away and fills step 1");
  ok(/Plots without a building/.test(E.ppshl.innerHTML), "the building list offers Plots without a building");
  E.ppshq.value = "bur"; E.ppshq.onin();
  ok(optIndex("Burj Views") !== null && optIndex("014 TOWER") === null && optIndex("Bay Square") === null, "scoped filter inside the district: first letters narrow the buildings");
  ok(/Plots without a building/.test(E.ppshl.innerHTML), "the vacant-land option stays visible while filtering");
  E.ppshq.value = "014"; E.ppshq.onin(); tap({ "data-opt": optIndex("014 TOWER") }); await tick(); await tick();
  ok(/Plot 3460550/.test(E.ppout.innerHTML) && E.ppsheet.hidden === true, "a building on one plot opens its passport with no extra tap");
  ok(/id=pp-crumb/.test(E.ppout.innerHTML) && /data-crumb=d>Business Bay</.test(E.ppout.innerHTML) && /data-crumb=g>014 TOWER</.test(E.ppout.innerHTML) && /aria-current=page>Plot 3460550</.test(E.ppout.innerHTML), "breadcrumb reads District > Building > Plot");
  tap({ "data-crumb": "d" }); await tick();
  ok(E.ppsheet.hidden === false && /Business Bay: buildings and projects/.test(E.ppsht.textContent), "the district crumb steps back up to the building list");
  tap({}, "ppshx"); tap({}, "ppb2"); E.ppshq.value = "bay sq"; E.ppshq.onin(); tap({ "data-opt": optIndex("Bay Square") }); await tick();
  ok(/Bay Square: choose the plot/.test(E.ppsht.textContent) && /Plot 3460551/.test(E.ppshl.innerHTML) && /Plot 3460552/.test(E.ppshl.innerHTML), "a project on several plots lists its plots (tap 3)");
  tap({ "data-opt": "1" }); await tick(); await tick();
  ok(/Plot 3460552/.test(E.ppout.innerHTML) && /data-crumb=g>Bay Square</.test(E.ppout.innerHTML), "tap 3 opens the chosen plot with the project in the breadcrumb");
}
console.log("plot passport: " + pass + " passed, " + fail + " failed"); if (fail) process.exit(1);
