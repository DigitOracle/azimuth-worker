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
console.log("plot passport: " + pass + " passed, " + fail + " failed"); if (fail) process.exit(1);
