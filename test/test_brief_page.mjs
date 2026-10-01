// THE BRIEF, part B - the screens (30 Sep 2026). /start gains "00 THEY TELL YOU WHAT THEY WANT"; /brief is the form, the ranked
// list (GET /brief_api, Contract A) and the output buttons (GET /brief_pdf, Contract B). Both endpoints are built in parallel by
// other sessions, so this test stubs them exactly as the contract is written.
//
// What this proves, through the real worker and the page's OWN script (run in a small DOM stand-in, below):
//   S  /start shows 00 FIRST, above the five angles, which are still there and still in order; the 00 card is TWO BUTTONS (v277)
//   R  /brief renders on READ_KEY and on a client key, refuses no key, and restores a shared query into the form
//   P  every inline script on /start and /brief parses (node --check) - a broken script blanks the page on phones
//   T  the stepped flow (v277): one question per screen, Back, a progress marker; the /start button skips step 1; tapping Rent or
//      a bedroom count advances; the budget step refuses to advance without one; Skip on the must-haves runs the search
//   W  every button is wired (v273): each id has its handler; with nothing ticked each output button SAYS so; the search, the list,
//      Compare 5 / Compare 10 / Individual / Full pack call /brief_pdf with the right kind and keys; a failed or slow PDF says so
//      and offers Try again; the share link carries the CLIENT key, never the owner key, and opening it restores the list
//   A  DEVELOPER AVAILABILITY is drawn only where the API carries a developer sheet, named and dated; the register estimate is NOT
//      drawn even when the API still sends estimated_left (v277); "Show 20 / Show 50" re-runs with the bigger limit
//   B  "See them in blocks" opens /blocks with the district and the ticked footprint ids in rank order (dld: keys skipped)
// NEGATIVE CONTROL: comment out the line `outWire();` in src/brief_page.js and run this file - the W checks fail.
//
//   node test/test_brief_page.mjs
import worker from "../src/index.js";
import { BRIEF_JS, briefQuery } from "../src/brief_page.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 400) : "")); } };
const parses = (code) => { const f = path.join(os.tmpdir(), "brief_" + Math.random().toString(36).slice(2) + ".js"); fs.writeFileSync(f, code); try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); return true; } catch (e) { console.log(String(e.stderr || e.message).slice(0, 600)); return false; } finally { try { fs.unlinkSync(f); } catch (e) {} } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- the worker harness (v186 / v274) ----
const READ = "client_read_key_in_links_123", CLIENT = "client_key_for_links_456";
const store = new Map();
const KV = { async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); }, async list() { return { keys: [] }; } };
const realFetch = globalThis.fetch;
globalThis.fetch = async () => new Response("{}", { status: 200 });
const env = { MEETINGS: KV, READ_KEY: READ, CLIENT_KEY: CLIENT, INGEST_TOKEN: "ING", PUBLIC_ORIGIN: "https://azimuth-2.digitalchemy.workers.dev" };
const ORIGIN = "https://azimuth-2.digitalchemy.workers.dev";
const call = (p, init) => worker.fetch(new Request(ORIGIN + p, init), env, { waitUntil() {} });
const scripts = (html) => [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].filter((m) => !/\bsrc=/.test(m[1])).map((m) => ({ attrs: m[1], code: m[2] }));

// ---- S: /start ----
const startHtml = await (await call("/start?key=" + READ)).text();
// v278.1 (Kendall 1 Oct): START redesign - THE BRIEF (rent / buy), CONTRACTS SIGNED, ADVERTISED SUPPLY (owner only)
ok(/<a class="btn rent" href="\/brief\?mode=rent&amp;key=/.test(startHtml) && /<a class="btn buy" href="\/brief\?mode=buy&amp;key=/.test(startHtml), "S1 /start: the Brief buttons, rent and buy");
ok(startHtml.includes("THE BRIEF") && startHtml.includes("CONTRACTS SIGNED") && startHtml.includes("ADVERTISED SUPPLY"), "S2 owner START: three ways in - the Brief, Contracts signed, Advertised supply");
ok(!startHtml.includes("THEY NAME A BUILDING") && !startHtml.includes("THEY SAY") && !startHtml.includes("Six ways"), "S3 no angle cards, no cheat sheet, no Six ways in");
ok(/href="\/brief\?mode=rent&amp;key=client_read_key_in_links_123"/.test(startHtml) && /href="\/brief\?mode=buy&amp;key=/.test(startHtml), "S4 the Brief opens /brief for Rent and for Buy, with the key");
const startClient = await (await call("/start?key=" + CLIENT)).text();
ok(startClient.includes('class="btn rent"') && startClient.includes("key=" + CLIENT), "S5 the Brief is on the client-key /start too, threading the client key");
ok(!startClient.includes("ADVERTISED SUPPLY") && !startClient.includes("BLACK COFFEE"), "S6 client START: no Advertised supply (portal data never reaches a client), no Black Coffee");
// v279: the two v278.1 placeholders are replaced by the real cards - a search that opens /contracts, and (owner only) /supply
ok(/id=ejari0>[\s\S]*?action="\/contracts"/.test(startHtml) && /id=ejari0>[\s\S]*?action="\/contracts"/.test(startClient) && !/data-soon=/.test(startHtml + startClient), "S7 Contracts signed is a real search on both keys, no placeholder left (v279)");
ok(/id=supply0>[\s\S]*?action="\/supply"/.test(startHtml) && !startClient.includes("supply0") && !startClient.includes("/supply"), "S8 Advertised supply is a real search for the owner, and absent for a client (v279)");
for (const s of scripts(startHtml)) ok(parses(s.code), "P1 /start inline script parses (" + s.code.length + " chars)");

// ---- R: /brief renders and is gated ----
const r0 = await call("/brief");
ok(r0.status === 401, "R1 /brief with no key is refused", r0.status);
const r1 = await call("/brief?key=" + CLIENT);
ok(r1.status === 200, "R2 /brief opens on a client key", r1.status);
const rA = await call("/brief?key=" + READ);
const briefHtml = await rA.text();
ok(rA.status === 200 && /<title>The brief/.test(briefHtml), "R3 /brief renders on the owner key");
for (const w of ["They want to…", "How many <em>bedrooms</em>?", "Tap one or more.", "WHAT KIND OF HOME", "Townhouse", "What is the <em>budget</em>?", "stretch up to", "Furnished?", "Unfurnished", "Where?", "Anywhere in Dubai",
  "Compare these areas side by side", "What <em>matters</em> to them?", "Must", "Nice to have", "Don’t care", "private pool", "community pool", "pet-friendly (dog walks, play areas)", "newer or modern (completed 2018 or later)",
  "quality for a long-term stay", "Jumeirah Village Circle", "Arabian Ranches (Wadi Al Safa 6)", "Arabian Ranches 2 &amp; Serena (Wadi Al Safa 7)", "near a metro", "Studio", "3 or more", "SHOW ME THE HOMES", "Skip"])
  ok(briefHtml.includes(w), "R4 the steps carry “" + w + "”");
ok(!/HOW MANY BUILDINGS|id=flim/.test(briefHtml) && /id=ftype/.test(briefHtml) && /id=ffurn/.test(briefHtml) && /id=fstr/.test(briefHtml) && /id=fcmp/.test(briefHtml), "R4b v282: home type (on the bedrooms screen), the stretch, furnished and the compare switch are in the markup; how-many is still not asked");
ok(briefHtml.includes("id=fback") && briefHtml.includes("id=fstep") && briefHtml.includes("id=fdots"), "R4c Back and a progress marker are in the markup");
ok(!/goldensymphony/.test(briefHtml) && />Liwan</.test(briefHtml), "R5 the district list drops non-districts and fixes register spellings");
ok(!/\b(LOD|DLD|IQR|DEWA|KV)\b/.test(briefHtml.replace(/<script[\s\S]*?<\/script>/g, "")), "R6 no unexplained acronyms in the page markup");
const briefScripts = scripts(briefHtml);
ok(briefScripts.length >= 2, "R7 /brief serves its boot data and its script");
for (const s of briefScripts) ok(parses(s.code), "P2 /brief inline script parses (" + s.code.length + " chars)");
ok(!BRIEF_JS.includes("${") && !BRIEF_JS.includes("`"), "P3 the page script interpolates nothing and holds no backtick");
ok(briefScripts.some((s) => s.code.includes(BRIEF_JS.trim().slice(0, 120))), "P4 the served script is BRIEF_JS as written");
// the live district list is read from KV when it is there (read only)
store.set("img_districts_geo", JSON.stringify({ districts: Array.from({ length: 12 }, (_, i) => ({ slug: "zz" + i, name: "Test District " + i, corridor: "Coast" })) }));
const liveHtml = await (await call("/brief?key=" + READ)).text();
ok(liveHtml.includes("Test District 11") && !liveHtml.includes("Jumeirah Village Circle"), "R8 districts come from img_districts_geo when it is in KV");
store.delete("img_districts_geo");
ok(![...store.keys()].length, "R9 the page wrote nothing to KV");
const q = briefQuery(new URLSearchParams("mode=hack&beds=9&min=90000&max=60000&areas=JVC,,bad slug!,businessbay&type=castle&musts=pool,teleporter,pool&limit=999&pick=a:1,b:2"));
ok(q.mode === "rent" && q.beds.join() === "1" && q.min === 60000 && q.max === 90000 && q.areas.join() === "jvc,businessbay" && q.types.join() === "any" && q.musts.join() === "community_pool" && q.limit === 50 && q.pick.join() === "a:1,b:2" && q.modeSet === false,
  "R10 a shared query is cleaned, never guessed: bad values fall back, min and max swap, limit caps at 50; a bad mode does not count as chosen", JSON.stringify(q));
{ const k = briefQuery(new URLSearchParams("mode=rent&beds=3,2,9&type=townhouse,castle&max=240000&stretch=300000&furnished=furnished&musts=pets&nice=private_pool,pets&areas=wadialsafa6,damachills&compare=1"));
  ok(k.beds.join() === "2,3" && k.types.join() === "townhouse" && k.stretch === 300000 && k.furnished === "furnished" && k.musts.join() === "pets" && k.nice.join() === "private_pool" && k.compare === true,
    "R10b v282: several bedrooms (sorted, bad ones dropped), the home type list, the stretch, furnished, must and nice (a must is not also nice), compare", JSON.stringify(k));
  ok(briefQuery(new URLSearchParams("max=240000&stretch=200000")).stretch === 0 && briefQuery(new URLSearchParams("furnished=sofa")).furnished === "either", "R10c a stretch below the target, and a made-up furnished value, are dropped"); }
ok(briefQuery(new URLSearchParams("mode=buy")).modeSet === true && briefQuery(new URLSearchParams("")).modeSet === false, "R11 modeSet says whether the /start button chose rent or buy");

// ---- a small DOM stand-in, enough for the page script (getElementById, querySelectorAll on simple selectors, innerHTML) ----
const VOID = new Set(["input", "br", "img", "meta", "link", "hr", "source", "wbr"]);
const dec = (s) => String(s).replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
class El {
  constructor(tag, attrs, doc) { this.tagName = tag.toUpperCase(); this.attrs = attrs || {}; this.children = []; this.parent = null; this.doc = doc; this._t = "";
    this.value = this.attrs.value != null ? this.attrs.value : ""; this.checked = "checked" in this.attrs; this.style = {}; }
  getAttribute(n) { return n in this.attrs ? this.attrs[n] : null; }
  setAttribute(n, v) { this.attrs[n] = String(v); }
  get id() { return this.attrs.id || ""; } set id(v) { this.attrs.id = String(v); }
  get hidden() { return "hidden" in this.attrs; } set hidden(v) { if (v) this.attrs.hidden = ""; else delete this.attrs.hidden; }
  get className() { return this.attrs.class || ""; } set className(v) { this.attrs.class = String(v); }
  get href() { return this.attrs.href || ""; } set href(v) { this.attrs.href = String(v); }
  get classList() { const el = this, get = () => (el.attrs.class || "").split(/\s+/).filter(Boolean), set = (a) => { el.attrs.class = a.join(" "); };
    return { contains: (c) => get().includes(c), add: (c) => { if (!get().includes(c)) set(get().concat(c)); }, remove: (c) => set(get().filter((x) => x !== c)),
      toggle: (c, f) => { const has = get().includes(c), want = f === undefined ? !has : !!f; if (want && !has) set(get().concat(c)); if (!want && has) set(get().filter((x) => x !== c)); return want; } }; }
  set innerHTML(h) { this.children = []; this._t = ""; parseInto(this, String(h), this.doc); }
  set textContent(t) { this.children = []; this._t = String(t); }
  get textContent() { return this._t + this.children.map((c) => c.textContent).join(""); }
  appendChild(c) { c.parent = this; this.children.push(c); return c; }
  querySelectorAll(sel) { const m = compile(sel), out = []; const walk = (e) => { for (const c of e.children) { if (m(c)) out.push(c); walk(c); } }; walk(this); return out; }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  focus() {} select() {} scrollIntoView() {}
}
function compile(sel) {
  const m = sel.match(/^([a-z]*)((?:[#.][\w-]+)*)((?:\[[^\]]+\])*)$/i);
  if (!m) throw new Error("selector not supported by the stand-in: " + sel);
  const tag = m[1].toUpperCase(), ids = [...m[2].matchAll(/#([\w-]+)/g)].map((x) => x[1]), cls = [...m[2].matchAll(/\.([\w-]+)/g)].map((x) => x[1]);
  const at = [...m[3].matchAll(/\[([\w-]+)(?:=([^\]]+))?\]/g)].map((x) => [x[1], x[2]]);
  return (e) => e.tagName !== "#TEXT" && (!tag || e.tagName === tag) && ids.every((i) => e.id === i) && cls.every((c) => e.classList.contains(c)) && at.every(([k, v]) => k in e.attrs && (v == null || e.attrs[k] === v.replace(/^["']|["']$/g, "")));
}
function parseInto(root, html, doc) {
  const rx = /<!--[\s\S]*?-->|<!doctype[^>]*>|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[^\s=>\/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*\/?>|([^<]+)/gi;
  let cur = root, m;
  while ((m = rx.exec(html))) {
    if (m[4] != null) { const t = new El("#text", {}, doc); t._t = dec(m[4]); cur.appendChild(t); continue; }
    if (m[1]) { let p = cur; while (p && p !== root && p.tagName !== m[1].toUpperCase()) p = p.parent; if (p && p !== root) cur = p.parent; continue; }
    if (!m[2]) continue;
    const attrs = {}; for (const a of (m[3] || "").matchAll(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) attrs[a[1].toLowerCase()] = dec(a[2] != null ? a[2] : a[3] != null ? a[3] : a[4] != null ? a[4] : "");
    const el = new El(m[2], attrs, doc); cur.appendChild(el);
    const tg = m[2].toLowerCase();
    if (tg === "script" || tg === "style") { const end = html.toLowerCase().indexOf("</" + tg, rx.lastIndex); el._t = html.slice(rx.lastIndex, end < 0 ? html.length : end); rx.lastIndex = end < 0 ? html.length : html.indexOf(">", end) + 1; continue; }
    if (!VOID.has(tg)) cur = el;
  }
}

// a phone opening the page: the served HTML, the served scripts, and a stub for the two endpoints under construction
const RESULTS = Array.from({ length: 12 }, (_, i) => ({
  rank: i + 1, key: i === 3 ? "dld:bloom heights" : "jumeirahvillagecircle:" + (1490 + i), name: ["Binghatti Nova", "Binghatti Circle", "Oxford Terraces", "Bloom Heights", "Belgravia", "Seasons Community", "Park Place", "Ghalia", "Pantheon Elysee", "Luma 21", "Maison Elysee", "Sunrise Legend"][i],
  aliases: i === 3 ? ["CANAL VIEWS"] : [], district: "jumeirahvillagecircle", district_name: "Jumeirah Village Circle", app_id: i === 3 ? null : 1490 + i,
  building_url: i === 3 ? null : "/building/jumeirahvillagecircle/" + (1490 + i),
  evidence: { basis: "ejari", median: 60000 + i * 1000, q1: 57000 + i * 1000, q3: 66000 + i * 1000, n: 30 - i, n_new: 25 - i, sqm: 59, latest: "2026-09-28" },
  verdict: i === 6 ? "stretch" : ["within", "within", "within", "a_little_above", "above", "below"][i % 6], musts: { balcony: true, pool: i % 2 === 0, gym: null },
  // v282: the client's criteria, each answered with its source (row 0 yes, row 1 no, the rest not known)
  criteria: [{ k: "community_pool", label: "community pool", level: "must", v: i === 0 ? true : i === 1 ? false : null, src: i === 0 ? "Land Department building record: 2 swimming pools" : i === 1 ? "a source says no" : "Not known: no building record lists a pool." },
    { k: "pets", label: "pet-friendly (dog walks, play areas)", level: "nice", v: null, src: "Not known: no register we hold records whether a community allows pets.", detail: "park within 1 km: Test Park 300 m" },
    { k: "furnished", label: "furnished", level: "asked", v: null, src: "Not known: the Ejari register does not record whether a home is furnished." }],
  completeness: { record: true, layouts: i < 5, photos: i !== 2 }, why: i === 0 ? "most lettings; full layout data" : "",
  // the API still returns the register estimate (nothing on screen reads it now) and, on one row, a developer's own sheet
  ...(i === 0 ? { estimated_left: { about: 40, of: 310, running: 270, as_at: "2026-09-30" }, estimate_as_of: "2026-09-30" } : {}),
  ...(i === 1 ? { developer_availability: { developer: "Binghatti", as_of: "2026-09-08", project: "Binghatti Circle", count: 3, units: [{ unit: "BC-1203", type: "1 B/R", sqft: 741, aed: 1250000, view: "Pool" }, { unit: "BC-1403", type: "1 B/R", sqft: 741, aed: 1262000, view: "" }, { unit: "BC-1503", type: "1 B/R", sqft: 760, aed: 1300000, view: "" }] } } : {}),
  ...(i === 2 ? { developer_availability: { developer: "Arada", as_of: "2026-09-22", project: "Oxford Terraces", count: 0 } } : {})
}));
async function openPage(pathQ, opts) {
  opts = opts || {};
  const html = await (await call(pathQ)).text();
  const doc = { root: new El("#document", {}, null) }; parseInto(doc.root, html, doc);
  const byId = (id) => { let f = null; const walk = (e) => { for (const c of e.children) { if (!f && c.id === id) f = c; if (!f) walk(c); } }; walk(doc.root); return f; };
  const u = new URL(ORIGIN + pathQ);
  const calls = [], jobsLive = { n: 0, max: 0 };
  let pdfMode = opts.pdf || "ok", apiDrops = 0, pdfDrops = 0;
  const pageFetch = async (href) => {
    calls.push(href);
    if (href.indexOf("/brief_api?") === 0) {
      if (opts.api === 404) return new Response("not found", { status: 404 });
      if (opts.apiDrop && apiDrops < opts.apiDrop) { apiDrops++; await sleep(5); throw new TypeError("Failed to fetch"); }   // a dropped connection
      if (opts.apiDelay) await sleep(opts.apiDelay);
      if (opts.api === "cmp") return new Response(JSON.stringify(opts.cmpBody), { headers: { "content-type": "application/json" } });
      const sp = new URLSearchParams(href.split("?")[1]); const lim = +sp.get("limit") || 10;
      return new Response(JSON.stringify({ query: Object.fromEntries(sp), as_of: "2026-09-28", source: "img_rent_index", total_matched: RESULTS.length, results: RESULTS.slice(0, lim), notes: ["bedrooms read from size - the rent register rarely records them"] }), { headers: { "content-type": "application/json" } });
    }
    if (href.indexOf("/brief_pdf?") === 0) {
      jobsLive.n++; jobsLive.max = Math.max(jobsLive.max, jobsLive.n);
      await sleep(15); jobsLive.n--;
      if (pdfMode === "fail") return new Response("render failed", { status: 500 });
      if (pdfMode === "slow") { const e = new Error("aborted"); e.name = "AbortError"; throw e; }
      if (pdfMode === "dropOnce" && pdfDrops < 1) { pdfDrops++; throw new TypeError("Failed to fetch"); }
      if (pdfMode === "html") return new Response("<html>oops</html>", { headers: { "content-type": "text/html" } });
      return new Response(new Uint8Array([37, 80, 68, 70, 45]), { headers: { "content-type": "application/pdf" } });
    }
    return new Response("?", { status: 599 });
  };
  const clip = { text: null };
  const win = {
    document: { getElementById: byId, createElement: (t) => new El(t, {}, doc), body: doc.root },
    location: { href: u.href, origin: u.origin, pathname: u.pathname, search: u.search },
    scrollTo() {},
    history: { replaceState: (a, b, x) => { win.location.last = x; } },
    navigator: { clipboard: { writeText: async (t) => { clip.text = t; } } },
    fetch: pageFetch, setTimeout, clearTimeout, setInterval, clearInterval, AbortController, Blob, URL: { createObjectURL: () => "blob:pdf-1" },
    console, encodeURIComponent, decodeURIComponent
  };
  win.window = win;
  vm.createContext(win);
  const ss = scripts(html);
  for (const s of ss) vm.runInContext(s.code, win);
  await sleep(40);
  return { html, byId, calls, win, jobsLive, clip, setPdf: (m) => { pdfMode = m; } };
}
const click = async (el, ms) => { if (!el || typeof el.onclick !== "function") return false; el.onclick({ preventDefault() {}, stopPropagation() {}, target: el }); await sleep(ms == null ? 60 : ms); return true; };
const text = (el) => (el ? el.textContent : "");

// ---- T: the stepped flow (v277; v282 order, approved by Kendall 1 Oct: rent/buy, bedrooms + kind of home, budget, furnished, where, must-haves) ----
const stepShown = (Pg) => ["mode", "beds", "budget", "furn", "where", "musts"].filter((s) => !Pg.byId("s-" + s).hidden);
{
  const T0 = await openPage("/brief?key=" + READ);
  ok(stepShown(T0).join() === "mode" && text(T0.byId("fstep")) === "STEP 1 OF 6", "T1 with nothing chosen the page opens on step 1, rent or buy, and only that step is on screen", stepShown(T0).join());
  ok(T0.byId("fback").hidden && T0.byId("fdots").querySelectorAll("i").length === 6 && T0.byId("fdots").querySelectorAll("i.on").length === 1, "T2 no Back on the first step; six dots, the first lit");
  await click(T0.byId("fmode").querySelector("button[data-v=buy]"), 0);
  ok(stepShown(T0).join() === "beds" && T0.win.__brief.state.mode === "buy", "T3 tapping Buy moves to the bedrooms step");
  await click(T0.byId("fbeds").querySelector("button[data-v=2]"), 0);
  ok(T0.win.__brief.state.beds.join() === "2", "T4a the first tap replaces the 1 bedroom a fresh page starts on", T0.win.__brief.state.beds.join());
  await click(T0.byId("fbeds").querySelector("button[data-v=3]"), 0);
  await click(T0.byId("fbeds").querySelector("button[data-v=1]"), 0); await click(T0.byId("fbeds").querySelector("button[data-v=1]"), 0);
  ok(stepShown(T0).join() === "beds" && T0.win.__brief.state.beds.join() === "2,3", "T4 bedrooms are several: 2 and 3 both picked (1 tapped on and off again); the step stays for the kind of home", T0.win.__brief.state.beds.join());
  await click(T0.byId("ftype").querySelector("button[data-v=townhouse]"), 0);
  await click(T0.byId("ftype").querySelector("button[data-v=villa]"), 0);
  ok(T0.win.__brief.state.types.join() === "townhouse,villa" && T0.byId("ftype").querySelector("button[data-v=any]").classList.contains("on") === false, "T4b the kind of home is several too: townhouse and villa, Any goes off");
  await click(T0.byId("ftype").querySelector("button[data-v=any]"), 0);
  ok(T0.win.__brief.state.types.join() === "any", "T4c Any clears the others");
  await click(T0.byId("fnextbd"), 0);
  ok(stepShown(T0).join() === "budget" && T0.byId("fbudl").textContent.includes("PRICE") && T0.byId("fbudq").textContent.includes("price"), "T4d NEXT moves to the budget, worded as a price for Buy");
  await click(T0.byId("fnextb"), 20);
  ok(stepShown(T0).join() === "budget" && /budget/i.test(text(T0.byId("fmsg"))) && !T0.calls.length, "T5 NEXT without a budget stays put and says why; nothing is searched");
  await click(T0.byId("fback"), 0);
  ok(stepShown(T0).join() === "beds" && !T0.byId("fback").hidden, "T6 Back goes to the step before");
  await click(T0.byId("fback"), 0);
  ok(stepShown(T0).join() === "mode" && T0.byId("fback").hidden, "T7 Back all the way to step 1, where it disappears");
  const T1 = await openPage("/brief?mode=rent&key=" + READ);
  ok(stepShown(T1).join() === "beds" && text(T1.byId("fstep")) === "STEP 2 OF 6" && T1.win.__brief.state.mode === "rent", "T8 from the /start RENT button the page opens on the bedrooms step: rent or buy is already chosen");
  ok(T1.byId("fbudl").textContent.includes("RENT A YEAR"), "T9 and the budget is worded as rent a year");
  T1.win.__brief.state.beds.length = 0; await click(T1.byId("fnextbd"), 0);
  ok(stepShown(T1).join() === "beds" && /at least one bedroom/.test(text(T1.byId("fmsgb"))), "T9b with no bedroom count picked NEXT says so and stays");
  await click(T1.byId("fbeds").querySelector("button[data-v=1]"), 0); await click(T1.byId("fnextbd"), 0);
  T1.byId("fmax").value = "65k"; T1.byId("fstr").value = "60k";
  await click(T1.byId("fnextb"), 0);
  ok(stepShown(T1).join() === "budget" && /stretch has to be above the target/.test(text(T1.byId("fmsg"))), "T9c a stretch under the target is refused, in words", text(T1.byId("fmsg")));
  T1.byId("fstr").value = "75k";
  await click(T1.byId("fnextb"), 0);
  ok(stepShown(T1).join() === "furn" && T1.win.__brief.state.max === 65000 && T1.win.__brief.state.stretch === 75000, "T10 a typed target and stretch pass NEXT to the furnished step");
  await click(T1.byId("ffurn").querySelector("button[data-v=furnished]"), 0);
  ok(stepShown(T1).join() === "where" && T1.win.__brief.state.furnished === "furnished", "T10b tapping Furnished moves to where");
  ok(T1.byId("fcmp").hidden, "T10c with no area picked the compare switch is not shown");
  await click(T1.byId("fdl").querySelector("button[data-s=jumeirahvillagecircle]"), 0);
  ok(T1.byId("fcmp").hidden, "T10d with ONE area it never shows");
  await click(T1.byId("fdl").querySelector("button[data-s=damachills]"), 0);
  ok(!T1.byId("fcmp").hidden && T1.byId("fcmp").classList.contains("on") && T1.byId("fcmp").getAttribute("aria-pressed") === "true", "T10e with TWO areas it shows, and it is on by default");
  await click(T1.byId("fdl").querySelector("button[data-s=wadialsafa6]"), 0);
  ok(!T1.byId("fcmp").hidden, "T10f three areas: still shown");
  await click(T1.byId("fdl").querySelector("button[data-s=dubaimarina]"), 0);
  ok(T1.byId("fcmp").hidden, "T10g four areas: gone (side by side is for 2 or 3)");
  await click(T1.byId("fdl").querySelector("button[data-s=dubaimarina]"), 0); await click(T1.byId("fdl").querySelector("button[data-s=wadialsafa6]"), 0);
  await click(T1.byId("fcmp"), 0);
  ok(!T1.byId("fcmp").classList.contains("on") && T1.win.__brief.state.compare === false, "T10h the switch turns off");
  await click(T1.byId("fcmp"), 0);
  await click(T1.byId("fnextw"), 0);
  ok(stepShown(T1).join() === "musts" && text(T1.byId("fstep")) === "STEP 6 OF 6", "T11 NEXT on where reaches the must-haves");
  const wr = (k) => T1.byId("fwant").querySelector("div[data-k=" + k + "]");
  ok(T1.byId("fwant").querySelectorAll(".wr").length === 10 && wr("private_pool").querySelector("button[data-l=no]").classList.contains("on"), "T11b ten criteria, each must / nice to have / don't care, starting on don't care");
  await click(wr("pets").querySelector("button[data-l=must]"), 0);
  await click(wr("private_pool").querySelector("button[data-l=nice]"), 0);
  await click(wr("modern").querySelector("button[data-l=must]"), 0); await click(wr("modern").querySelector("button[data-l=no]"), 0);
  ok(T1.win.__brief.state.musts.join() === "pets" && T1.win.__brief.state.nice.join() === "private_pool" && /1 must, 1 nice to have/.test(text(T1.byId("fmustv"))), "T11c three-way: pets a must, private pool nice to have, modern back to don't care");
  await click(T1.byId("fgo"), 80);
  ok(T1.calls[0] === "/brief_api?key=" + READ + "&mode=rent&beds=1&min=0&max=65000&stretch=75000&areas=jumeirahvillagecircle,damachills&type=any&furnished=furnished&musts=pets&nice=private_pool&compare=1&limit=10", "T12 the search carries the whole brief: beds, target, stretch, areas, type, furnished, must, nice, compare", T1.calls[0]);
  ok(T1.byId("bform").hidden && !T1.byId("bsum").hidden && /To rent: 1 bedroom, up to AED 65k \(stretch to 75k\) a year, furnished, Jumeirah Village Circle, DAMAC Hills side by side, must: pet-friendly/.test(text(T1.byId("bsumt"))), "T13 the steps fold to one line above the list, with CHANGE", text(T1.byId("bsumt")));
  await click(T1.byId("bedit"), 0);
  ok(!T1.byId("bform").hidden && stepShown(T1).join() === "mode", "T14 CHANGE reopens the steps from the first");
  const T2 = await openPage("/brief?mode=rent&key=" + READ);
  await click(T2.byId("fbeds").querySelector("button[data-v=1]"), 0); await click(T2.byId("fnextbd"), 0);
  T2.byId("fmax").value = "65k"; await click(T2.byId("fnextb"), 0); await click(T2.byId("ffurn").querySelector("button[data-v=either]"), 0); await click(T2.byId("fnextw"), 0);
  await click(T2.byId("fskip"), 80);
  ok(T2.calls[0] === "/brief_api?key=" + READ + "&mode=rent&beds=1&min=0&max=65000&areas=&type=any&furnished=either&musts=&nice=&limit=10", "T15 Skip runs the search with no must-haves, home type Any and ten buildings", T2.calls[0]);
}

// ---- W: every button is wired ----
const ids = [...briefHtml.replace(/<script[\s\S]*?<\/script>/g, "").matchAll(/<button[^>]*\bid=([\w-]+)/g)].map((m) => m[1]);
ok(ids.length >= 12, "W0 /brief draws its buttons with ids: " + ids.join(" "));
const P = await openPage("/brief?key=" + READ);
for (const id of ids) ok(P.byId(id) && typeof P.byId(id).onclick === "function", "W1 #" + id + " has its handler");
ok(P.byId("fdl").querySelectorAll("button").every((b) => typeof b.onclick === "function") && P.byId("fwant").querySelectorAll("button").every((b) => typeof b.onclick === "function") && P.byId("fbeds").querySelectorAll("button").every((b) => typeof b.onclick === "function") && P.byId("ftype").querySelectorAll("button").every((b) => typeof b.onclick === "function") && P.byId("ffurn").querySelectorAll("button").every((b) => typeof b.onclick === "function"), "W2 every district chip, bedroom, home type, furnished and must-have button has its handler");
// the form: a click changes the state the search will send
await click(P.byId("fmode").querySelector("button[data-v=buy]"), 0);
ok(P.win.__brief.state.mode === "buy" && P.byId("fbudl").textContent.includes("PRICE"), "W3 Buy switches the budget to a price");
await click(P.byId("fmode").querySelector("button[data-v=rent]"), 0);
await click(P.byId("fgo"), 20);
ok(/budget/i.test(text(P.byId("fmsg"))) && !P.calls.length && stepShown(P).join() === "budget", "W4 no budget: the button SAYS what is missing, shows the budget step, and does not search");
P.byId("fmax").value = "65k";
await click(P.byId("fdl").querySelector("button[data-s=jumeirahvillagecircle]"), 0);
await click(P.byId("fwant").querySelector("div[data-k=community_pool]").querySelector("button[data-l=must]"), 0);
await click(P.byId("fgo"), 80);
ok(P.calls[0] === "/brief_api?key=" + READ + "&mode=rent&beds=1&min=0&max=65000&areas=jumeirahvillagecircle&type=any&furnished=either&musts=community_pool&nice=&limit=10", "W5 the search calls Contract A with the brief", P.calls[0]);
ok(/[?&]run=1/.test(P.win.location.last || "") && /max=65000/.test(P.win.location.last || ""), "W6 the address bar now holds the brief (reload restores it)", P.win.location.last);
const rows = P.byId("bres").querySelectorAll(".row");
ok(rows.length === 10, "W7 the ranked list draws 10 rows", rows.length);
ok(P.byId("bres").querySelectorAll("input[type=checkbox]").length === 10 && P.win.__brief.chosen().length === 10, "W8 each row has a checkbox; the ten are chosen to start with");
ok(text(rows[0]).includes("in budget") && text(rows[3]).includes("a little over budget") && text(rows[4]).includes("over budget") && text(rows[5]).includes("under budget"), "W9 each row carries its verdict in words");
ok(text(rows[0]).includes("AED 60k") && text(rows[0]).includes("middle half 57k – 66k") && text(rows[0]).includes("30 lettings (25 new)"), "W10 the row gives typical rent, the middle half and the lettings count");
ok(text(rows[0]).includes("✓ community pool (must)") && text(rows[1]).includes("✗ community pool (must)") && text(rows[2]).includes("pet-friendly (dog walks, play areas): not known"), "W11 each criterion shows yes / no / not known per building", text(rows[2]));
ok(rows[0].querySelector("details") && /where these answers come from/.test(text(rows[0])) && /Land Department building record: 2 swimming pools/.test(text(rows[0])), "W11b with the source of each answer folded under the marks");
ok(text(rows[2]).includes("furnished: not known") && !/OWNER ONLY/.test(text(P.byId("bres"))), "W11c furnished is not known; no owner hint where the API sends none");
ok(text(rows[6]).includes("stretch"), "W11d the stretch verdict has its word on the row");
ok(text(rows[3]).includes("also filed as CANAL VIEWS") && !rows[3].querySelector("a"), "W12 aliases shown; no building page link where the API has none");
ok(rows[0].querySelector("a").getAttribute("href") === "/building/jumeirahvillagecircle/1490?key=" + READ, "W13 the building page link carries the key");
// A: availability on the client face (v277)
ok(!/ESTIMATE|About 40|of 310|no tenancy running|real figure is lower|Still filling/.test(text(P.byId("bres"))), "A1 the register estimate is NOT drawn, although the API sends estimated_left on row 1");
ok(text(rows[1]).includes("DEVELOPER AVAILABILITY") && text(rows[1]).includes("Available now, per Binghatti’s sheet of 8 Sep 2026: 3 one-bedrooms."), "A2 a row with a developer sheet says so, named and dated, with the count", text(rows[1]));
ok(text(rows[1]).includes("BC-1203 · 741 sq ft · AED 1.25M") && /developer.s own list, not the register/.test(text(rows[1])), "A3 the sheet's unit rows are listed and the line says whose list it is");
ok(rows.filter((r, i) => i !== 1).every((r) => !text(r).includes("DEVELOPER AVAILABILITY") && !/availab|sheet of|availability to follow/i.test(text(r))), "A4 every other row shows nothing - no placeholder, no 'to follow' (row 3 has a sheet with none of this type)");
// Show 20 / Show 50
ok(P.byId("more20") && !P.byId("more50") && /the best 10 of 12/.test(text(P.byId("bres"))), "A5 under the list: the best 10 of 12, with Show 20 (Show 50 only when more than 20 match)");
await click(P.byId("more20"), 80);
ok(/limit=20$/.test(P.calls[P.calls.length - 1]) && P.byId("bres").querySelectorAll(".row").length === 12 && P.win.__brief.chosen().length === 10, "A6 Show 20 re-runs with limit=20 and keeps the ten ticked", P.calls[P.calls.length - 1]);
ok(!P.byId("more20") && !P.byId("more50"), "A7 with every match shown the links go");
P.win.__brief.state.limit = 10; await click(P.byId("fgo"), 80);
rows.length = 0; rows.push(...P.byId("bres").querySelectorAll(".row"));
// outputs
const pdfCalls = () => P.calls.filter((c) => c.indexOf("/brief_pdf?") === 0);
const keysOf = (c) => !c ? [] : decodeURIComponent(new URLSearchParams(c.split("?")[1]).get("keys") || "").split(",");
const kindOf = (c) => !c ? null : new URLSearchParams(c.split("?")[1]).get("kind");
await click(P.byId("o-c5"), 120);
let pc = pdfCalls();
ok(pc.length === 1 && kindOf(pc[0]) === "compare" && keysOf(pc[0]).length === 5 && keysOf(pc[0])[0] === "jumeirahvillagecircle:1490" && keysOf(pc[0])[3] === "dld:bloom heights", "W14 Compare 5 asks for kind=compare with the first five chosen", pc[0]);
ok(/[?&]mode=rent&beds=1&min=0&max=65000&type=any&furnished=either&musts=community_pool&areas=jumeirahvillagecircle/.test(pc[0]) && pc[0].includes("key=" + READ), "W15 the PDF call carries mode, beds, budget, type, furnished, the must-haves, the areas and the key", pc[0]);
let jobs = P.byId("jobs").querySelectorAll(".job");
ok(jobs.length === 1 && text(jobs[0]).includes("Ready") && jobs[0].querySelector("a").getAttribute("href") === "blob:pdf-1", "W16 the PDF arrives: Ready, with Open the PDF", text(jobs[0]));
await click(P.byId("o-c10"), 120);
pc = pdfCalls(); ok(kindOf(pc[1]) === "compare" && keysOf(pc[1]).length === 10, "W17 Compare 10 asks for kind=compare with ten");
await click(P.byId("o-pack"), 120);
pc = pdfCalls(); ok(kindOf(pc[2]) === "pack" && keysOf(pc[2]).length === 10, "W18 Full pack asks for kind=pack");
// Individual: one PDF per building, never more than two at once
await click(P.byId("bnone"), 0);
for (const i of [0, 1, 2]) { const cb = P.byId("bres").querySelectorAll("input[type=checkbox]")[i]; cb.checked = true; cb.onchange(); }
ok(P.win.__brief.chosen().length === 3 && text(P.byId("ochosen")) === "3 chosen", "W19 ticking rows changes what is chosen");
P.jobsLive.max = 0;
await click(P.byId("o-ind"), 200);
pc = pdfCalls().slice(3);
ok(pc.length === 3 && pc.every((c) => kindOf(c) === "dossier" && keysOf(c).length === 1), "W20 Individual PDFs: one kind=dossier call per building", pc.join(" | "));
ok(P.jobsLive.max <= 2, "W21 at most two PDFs are made at once", P.jobsLive.max);
// B: see them in blocks - the district and the ticked footprint ids, in rank order; a dld: key has no footprint and is skipped
await click(P.byId("bnone"), 0);
for (const i of [4, 3, 0, 2]) { const cb = P.byId("bres").querySelectorAll("input[type=checkbox]")[i]; cb.checked = true; cb.onchange(); }
P.win.location.href = ""; await click(P.byId("o-blocks"), 20);
ok(P.win.location.href === "/blocks?district=jumeirahvillagecircle&gold=1490,1492,1494&key=" + READ, "B1 See them in blocks opens /blocks with the district, the ticked ids in rank order (the dld: one skipped) and the key", P.win.location.href);
ok(/3 of the 4 chosen/.test(text(P.byId("omsg"))), "B2 and says one of the four has no footprint", text(P.byId("omsg")));
await click(P.byId("bnone"), 0);
{ const cb = P.byId("bres").querySelectorAll("input[type=checkbox]")[3]; cb.checked = true; cb.onchange(); }
P.win.location.href = ""; await click(P.byId("o-blocks"), 20);
ok(P.win.location.href === "" && /None of the chosen buildings has a footprint/.test(text(P.byId("omsg"))), "B3 only a dld: key ticked: nothing opens, and it says why", text(P.byId("omsg")));
// nothing chosen: every output button says so, none is silent
await click(P.byId("bnone"), 0);
for (const id of ["o-ind", "o-c5", "o-c10", "o-pack", "o-blocks"]) { P.byId("omsg").textContent = ""; const before = pdfCalls().length; await click(P.byId(id), 20);
  ok(/Tick at least/.test(text(P.byId("omsg"))) && pdfCalls().length === before, "W22 with nothing chosen, #" + id + " says what to do instead of nothing"); }
// a failed PDF, a slow one, a wrong answer: each says so, and Try again works
await click(P.byId("ball"), 0);
P.setPdf("fail"); const nJobs = () => P.byId("jobs").querySelectorAll(".job");
await click(P.byId("o-c5"), 120);
// same kind+keys as the first compare, which finished: a new job, so the failure is visible
let last = nJobs()[nJobs().length - 1];
ok(last.classList.contains("bad") && /error 500/.test(text(last)) && last.querySelector("button[data-a=retry]"), "W23 a failed PDF says it failed and offers Try again", text(last));
ok(last.querySelector("a") && last.querySelector("a").getAttribute("href").indexOf("/brief_pdf?") === 0, "W24 and a direct link");
P.setPdf("ok"); const before = pdfCalls().length;
await click(last.querySelector("button[data-a=retry]"), 120);
last = nJobs()[nJobs().length - 1];
ok(pdfCalls().length === before + 1 && text(last).includes("Ready"), "W25 Try again fetches again and comes back Ready", text(last));
P.setPdf("slow"); await click(P.byId("o-c10"), 120);
last = nJobs()[nJobs().length - 1];
ok(/taking longer than it should/.test(text(last)), "W26 a PDF that times out says so in words", text(last));
P.setPdf("html"); await click(P.byId("o-pack"), 120);
last = nJobs()[nJobs().length - 1];
ok(/not a PDF/.test(text(last)), "W27 an answer that is not a PDF is not passed off as one", text(last));
// share: the link carries the CLIENT key (never the owner key), the brief, and the ticked buildings
await click(P.byId("bnone"), 0);
for (const i of [1, 3]) { const cb = P.byId("bres").querySelectorAll("input[type=checkbox]")[i]; cb.checked = true; cb.onchange(); }
await click(P.byId("o-share"), 40);
const link = P.byId("shurl").value;
ok(link.indexOf(ORIGIN + "/brief?key=" + CLIENT + "&") === 0 && !link.includes(READ), "W28 Share this list: the link carries the client key, never the owner key", link);
ok(P.clip.text === link && /copied/i.test(text(P.byId("omsg"))) && !P.byId("shbox").hidden, "W29 the link is copied and shown, and the page says so");
ok(/[?&]run=1/.test(link) && /pick=jumeirahvillagecircle%3A1491,dld%3Abloom%20heights/.test(link), "W30 the link restores the brief and the ticked buildings", link);
ok(decodeURIComponent(P.byId("shwa").getAttribute("href")).includes(link), "W31 the WhatsApp button carries the link");
// opening the shared link on the client's phone restores the list and the choice
const S = await openPage(link.slice(ORIGIN.length));
await sleep(60);
ok(S.calls[0] === "/brief_api?key=" + CLIENT + "&mode=rent&beds=1&min=0&max=65000&areas=jumeirahvillagecircle&type=any&furnished=either&musts=community_pool&nice=&limit=10", "W32 the shared link runs the same search on open", S.calls[0]);
ok(S.win.__brief.chosen().join() === "jumeirahvillagecircle:1491,dld:bloom heights", "W33 with the same two buildings ticked", S.win.__brief.chosen().join());
ok(S.byId("fmax").value === "65k" && S.byId("fdl").querySelector("button[data-s=jumeirahvillagecircle]").classList.contains("on") && S.byId("fwant").querySelector("div[data-k=community_pool]").querySelector("button[data-l=must]").classList.contains("on") && S.win.__brief.state.beds.join() === "1" && S.win.__brief.state.mode === "rent", "W34 and the steps hold the whole brief it came from (rent, 1 bedroom, 65k, JVC, community pool a must)");
ok(S.byId("bform").hidden && /1 bedroom, up to AED 65k a year, Jumeirah Village Circle, must: community pool/.test(text(S.byId("bsumt"))), "W34b the shared link opens on the list, the brief folded to one line", text(S.byId("bsumt")));
// the search itself failing: said in words, with a working Try again
const F = await openPage("/brief?key=" + READ + "&mode=rent&beds=1&max=65000&run=1", { api: 404 });
ok(/not switched on yet/.test(text(F.byId("bres"))) && F.byId("bretry") && typeof F.byId("bretry").onclick === "function", "W35 a search that fails says so, with Try again", text(F.byId("bres")));
ok(F.byId("bout").hidden, "W36 and no output buttons are offered on a failed search");

// ---- v282: the retry, the comparison and tabs, the owner-only furnished hint ----
{
  // the search: a dropped connection is retried ONCE, with "Still working..." on screen, and the list then arrives
  const R = await openPage("/brief?key=" + READ + "&mode=rent&beds=1&max=65000&run=1", { apiDrop: 1, apiDelay: 120 });
  ok(/Still working/.test(text(R.byId("bres"))), "V1 a dropped search connection shows Still working... while it retries", text(R.byId("bres")));
  await sleep(200);
  ok(R.calls.filter((c) => c.indexOf("/brief_api?") === 0).length === 2 && R.byId("bres").querySelectorAll(".row").length === 10, "V2 it retries once by itself and the list arrives", R.calls.length);
  const R2 = await openPage("/brief?key=" + READ + "&mode=rent&beds=1&max=65000&run=1", { apiDrop: 2 });
  await sleep(60);
  ok(R2.calls.filter((c) => c.indexOf("/brief_api?") === 0).length === 2 && /after two tries/.test(text(R2.byId("bres"))) && R2.byId("bretry"), "V3 dropped twice: only one retry, then it says so in words, with Try again", text(R2.byId("bres")));
  const R3 = await openPage("/brief?key=" + READ + "&mode=rent&beds=1&max=65000&run=1", { api: 404 });
  ok(R3.calls.filter((c) => c.indexOf("/brief_api?") === 0).length === 1, "V4 an answer from the server (404) is not retried");
  // the PDF: one automatic retry on a dropped connection
  R.setPdf("dropOnce");
  const before = R.calls.filter((c) => c.indexOf("/brief_pdf?") === 0).length;
  await click(R.byId("o-c5"), 150);
  const pj = R.byId("jobs").querySelectorAll(".job"), lastJ = pj[pj.length - 1];
  ok(R.calls.filter((c) => c.indexOf("/brief_pdf?") === 0).length === before + 2 && text(lastJ).includes("Ready"), "V5 a PDF whose connection drops is fetched once more by itself and comes back Ready", text(lastJ));
  R.setPdf("slow"); await click(R.byId("o-c10"), 200);
  const pj2 = R.byId("jobs").querySelectorAll(".job");
  ok(/after two tries/.test(text(pj2[pj2.length - 1])), "V6 a PDF that times out twice says so after two tries", text(pj2[pj2.length - 1]));
  // the comparison: one column per area, every cell answered or not known with its source, and the homes in one tab per area
  const cellY = (say, src) => ({ v: true, say, src }), cellU = (say, src) => ({ v: null, say, src });
  const col = (slug, name, extra) => Object.assign({ slug, name, matches: cellY("2 in budget, 1 in the stretch", "this brief's list"), rent: cellY("3-bed villa or townhouse: AED 260,000 (51 contracts)", "Ejari rent contracts 2026-08-01 to 2026-09-30"),
    types: { apartment: cellU("not known: no apartment lettings in the window", "Ejari"), townhouse: cellU("not known: the register files townhouses as villas", "Ejari"), villa: cellY("villas or townhouses let here", "Ejari") },
    pools: { private: cellU("not known: no register records private pools", "registers"), community: cellU("not known: no building record here lists a pool", "Land Department building records") },
    parks: cellY("20 parks (15 community, 5 unknown)", "the map's amenity layer (OpenStreetMap)"), schools: cellY("2 schools: Safa Community School (Outstanding)", "KHDA"), newest: cellU("not known: no completion year on file", "Dubai Municipality building records") }, extra || {});
  const cmpRows = RESULTS.slice(0, 6).map((r, i) => Object.assign({}, r, { key: "k" + i, district: i < 3 ? "wadialsafa6" : "damachills", rank: (i % 3) + 1 }));
  cmpRows[0] = Object.assign({}, cmpRows[0], { furnished_hint: { none: "the advertised-supply data does not carry furnishing yet" } });
  const body = { as_of: "2026-09-30", total_matched: 6, comparison: [col("wadialsafa6", "Arabian Ranches (Wadi Al Safa 6)"), col("damachills", "DAMAC Hills", { newest: cellY("2021 (DAMAC Hills - Carson)", "Dubai Municipality building records") })], results: cmpRows, notes: [] };
  const Cp = await openPage("/brief?key=" + READ + "&mode=rent&beds=2,3&type=townhouse&max=240000&stretch=300000&areas=wadialsafa6,damachills&compare=1&musts=pets&nice=private_pool&furnished=furnished&run=1", { api: "cmp", cmpBody: body });
  await sleep(40);
  ok(Cp.calls[0].includes("&compare=1&") && Cp.calls[0].includes("beds=2,3") && Cp.calls[0].includes("stretch=300000"), "V7 a restored side-by-side brief asks the search for the comparison", Cp.calls[0]);
  const cb = Cp.byId("bcmp");
  ok(cb && /SIDE BY SIDE/.test(text(cb)) && /HOMES THAT MATCH/.test(text(cb)) && /TYPICAL RENT, LAST 60 DAYS/.test(text(cb)) && /HOME TYPES/.test(text(cb)) && /POOLS/.test(text(cb)) && /PARKS AND DOG-FRIENDLY SPACES/.test(text(cb)) && /SCHOOLS NEARBY/.test(text(cb)) && /NEWEST COMPLETION/.test(text(cb)),
    "V8 the results open with the comparison: matches, typical rent, home types, pools, parks and dog-friendly spaces, schools, newest completion");
  ok(cb.querySelectorAll(".cr").length === 7 && cb.querySelectorAll(".cc").length === 14 && /Arabian Ranches \(Wadi Al Safa 6\)/.test(text(cb)) && /DAMAC Hills/.test(text(cb)), "V9 one column per area in every row (7 rows x 2 areas)");
  ok(/✓ 20 parks/.test(text(cb)) && /not known not known: no completion year/.test(text(cb)) && /✓ 2021 \(DAMAC Hills - Carson\)/.test(text(cb)) && /OpenStreetMap/.test(text(cb)), "V10 each cell is ✓ / ✗ / not known with its words and its source", text(cb).slice(0, 300));
  const tabs = Cp.byId("btabs").querySelectorAll("button");
  ok(tabs.length === 2 && /Arabian Ranches \(Wadi Al Safa 6\) \(3\)/.test(text(tabs[0])) && tabs[0].classList.contains("on"), "V11 below it the homes are in one tab per area, the first open", tabs.map(text).join(" | "));
  const panes = Cp.byId("bres").querySelectorAll(".tabp");
  ok(panes.length === 2 && !panes[0].hidden && panes[1].hidden && panes[0].querySelectorAll(".row").length === 3, "V12 only the open tab's homes show");
  await click(tabs[1], 0);
  ok(panes[0].hidden && !panes[1].hidden && tabs[1].classList.contains("on"), "V13 tapping the second tab shows its homes");
  ok(Cp.win.__brief.chosen().length === 6, "V14 every row in both tabs can still be chosen for the PDFs");
  ok(/OWNER ONLY/.test(text(Cp.byId("bres"))) && /does not carry furnishing yet/.test(text(Cp.byId("bres"))), "V15 the owner sees the furnished hint the API sends to the owner key");
  await click(Cp.byId("o-pack"), 60);
  const pp = Cp.calls.filter((c) => c.indexOf("/brief_pdf?") === 0).pop();
  ok(/beds=2,3/.test(pp) && /stretch=300000/.test(pp) && /type=townhouse/.test(pp) && /furnished=furnished/.test(pp) && /musts=pets/.test(pp) && /nice=private_pool/.test(pp) && /areas=wadialsafa6,damachills/.test(pp) && /compare=1/.test(pp), "V16 the Full pack call carries the whole brief and compare=1, so the PDF opens with the same comparison", pp);
  // a client's page: the API never sends furnished_hint to a client key, and the page draws none without it
  const body2 = Object.assign({}, body, { results: cmpRows.map((r) => { const x = Object.assign({}, r); delete x.furnished_hint; return x; }) });
  const Cc = await openPage("/brief?key=" + CLIENT + "&mode=rent&beds=2,3&areas=wadialsafa6,damachills&compare=1&max=240000&furnished=furnished&run=1", { api: "cmp", cmpBody: body2 });
  await sleep(40);
  ok(!/OWNER ONLY/.test(text(Cc.byId("bres"))) && /furnished: not known/.test(text(Cc.byId("bres"))), "V17 a client's page: furnished is not known, and no listing-site hint");
}

globalThis.fetch = realFetch;
console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
