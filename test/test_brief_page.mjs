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
ok((startHtml.match(/data-soon="/g) || []).length === 2 && (startClient.match(/data-soon="/g) || []).length === 1, "S7 the placeholders open a coming panel, not a dead button (owner 2, client 1)");
ok(/id="p-ejari" hidden>Coming this week/.test(startHtml) && /id="p-supply" hidden>Coming this week/.test(startHtml), "S8 each placeholder says what is coming");
for (const s of scripts(startHtml)) ok(parses(s.code), "P1 /start inline script parses (" + s.code.length + " chars)");

// ---- R: /brief renders and is gated ----
const r0 = await call("/brief");
ok(r0.status === 401, "R1 /brief with no key is refused", r0.status);
const r1 = await call("/brief?key=" + CLIENT);
ok(r1.status === 200, "R2 /brief opens on a client key", r1.status);
const rA = await call("/brief?key=" + READ);
const briefHtml = await rA.text();
ok(rA.status === 200 && /<title>The brief/.test(briefHtml), "R3 /brief renders on the owner key");
for (const w of ["They want to…", "How many <em>bedrooms</em>?", "What is the <em>budget</em>?", "Where?", "Anywhere in Dubai", "not do without", "Jumeirah Village Circle", "near a metro", "newer building (2020 or later)", "Studio", "3 or more", "SHOW ME THE BUILDINGS", "Skip"])
  ok(briefHtml.includes(w), "R4 the steps carry “" + w + "”");
ok(!/HOME TYPE|Villa &amp; townhouse|HOW MANY BUILDINGS|id=ftype|id=flim/.test(briefHtml), "R4b home type and how-many are no longer asked (v277)");
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
ok(q.mode === "rent" && q.beds === "1" && q.min === 60000 && q.max === 90000 && q.areas.join() === "jvc,businessbay" && q.type === "any" && q.musts.join() === "pool" && q.limit === 50 && q.pick.join() === "a:1,b:2" && q.modeSet === false,
  "R10 a shared query is cleaned, never guessed: bad values fall back, min and max swap, limit caps at 50; a bad mode does not count as chosen", JSON.stringify(q));
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
  verdict: ["within", "within", "within", "a_little_above", "above", "below"][i % 6], musts: { balcony: true, pool: i % 2 === 0, gym: null },
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
  let pdfMode = opts.pdf || "ok";
  const pageFetch = async (href) => {
    calls.push(href);
    if (href.indexOf("/brief_api?") === 0) {
      if (opts.api === 404) return new Response("not found", { status: 404 });
      const sp = new URLSearchParams(href.split("?")[1]); const lim = +sp.get("limit") || 10;
      return new Response(JSON.stringify({ query: Object.fromEntries(sp), as_of: "2026-09-28", source: "img_rent_index", total_matched: RESULTS.length, results: RESULTS.slice(0, lim), notes: ["bedrooms read from size - the rent register rarely records them"] }), { headers: { "content-type": "application/json" } });
    }
    if (href.indexOf("/brief_pdf?") === 0) {
      jobsLive.n++; jobsLive.max = Math.max(jobsLive.max, jobsLive.n);
      await sleep(15); jobsLive.n--;
      if (pdfMode === "fail") return new Response("render failed", { status: 500 });
      if (pdfMode === "slow") { const e = new Error("aborted"); e.name = "AbortError"; throw e; }
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

// ---- T: the stepped flow (v277) ----
const stepShown = (Pg) => ["mode", "beds", "budget", "where", "musts"].filter((s) => !Pg.byId("s-" + s).hidden);
{
  const T0 = await openPage("/brief?key=" + READ);
  ok(stepShown(T0).join() === "mode" && text(T0.byId("fstep")) === "STEP 1 OF 5", "T1 with nothing chosen the page opens on step 1, rent or buy, and only that step is on screen", stepShown(T0).join());
  ok(T0.byId("fback").hidden && T0.byId("fdots").querySelectorAll("i").length === 5 && T0.byId("fdots").querySelectorAll("i.on").length === 1, "T2 no Back on the first step; five dots, the first lit");
  await click(T0.byId("fmode").querySelector("button[data-v=buy]"), 0);
  ok(stepShown(T0).join() === "beds" && T0.win.__brief.state.mode === "buy", "T3 tapping Buy moves to the bedrooms step");
  await click(T0.byId("fbeds").querySelector("button[data-v=2]"), 0);
  ok(stepShown(T0).join() === "budget" && T0.win.__brief.state.beds === "2" && T0.byId("fbudl").textContent.includes("PRICE") && T0.byId("fbudq").textContent.includes("price"), "T4 tapping a bedroom count moves to the budget, worded as a price for Buy");
  await click(T0.byId("fnextb"), 20);
  ok(stepShown(T0).join() === "budget" && /budget/i.test(text(T0.byId("fmsg"))) && !T0.calls.length, "T5 NEXT without a budget stays put and says why; nothing is searched");
  await click(T0.byId("fback"), 0);
  ok(stepShown(T0).join() === "beds" && !T0.byId("fback").hidden, "T6 Back goes to the step before");
  await click(T0.byId("fback"), 0); await click(T0.byId("fback"), 0);
  ok(stepShown(T0).join() === "mode" && T0.byId("fback").hidden, "T7 Back all the way to step 1, where it disappears");
  const T1 = await openPage("/brief?mode=rent&key=" + READ);
  ok(stepShown(T1).join() === "beds" && text(T1.byId("fstep")) === "STEP 2 OF 5" && T1.win.__brief.state.mode === "rent", "T8 from the /start RENT button the page opens on the bedrooms step: rent or buy is already chosen");
  ok(T1.byId("fbudl").textContent.includes("RENT A YEAR"), "T9 and the budget is worded as rent a year");
  await click(T1.byId("fbeds").querySelector("button[data-v=1]"), 0);
  T1.byId("fmax").value = "65k";
  await click(T1.byId("fnextb"), 0);
  ok(stepShown(T1).join() === "where" && T1.win.__brief.state.max === 65000, "T10 a typed budget passes NEXT to the where step");
  await click(T1.byId("fnextw"), 0);
  ok(stepShown(T1).join() === "musts" && text(T1.byId("fstep")) === "STEP 5 OF 5", "T11 NEXT on where (Anywhere in Dubai) reaches the must-haves");
  await click(T1.byId("fskip"), 80);
  ok(T1.calls[0] === "/brief_api?key=" + READ + "&mode=rent&beds=1&min=0&max=65000&areas=&type=any&musts=&limit=10", "T12 Skip runs the search with no must-haves, home type Any and ten buildings", T1.calls[0]);
  ok(T1.byId("bform").hidden && !T1.byId("bsum").hidden && /To rent: 1 bedroom, up to AED 65k a year, anywhere in Dubai/.test(text(T1.byId("bsumt"))), "T13 the steps fold to one line above the list, with CHANGE", text(T1.byId("bsumt")));
  await click(T1.byId("bedit"), 0);
  ok(!T1.byId("bform").hidden && stepShown(T1).join() === "mode", "T14 CHANGE reopens the steps from the first");
}

// ---- W: every button is wired ----
const ids = [...briefHtml.replace(/<script[\s\S]*?<\/script>/g, "").matchAll(/<button[^>]*\bid=([\w-]+)/g)].map((m) => m[1]);
ok(ids.length >= 12, "W0 /brief draws its buttons with ids: " + ids.join(" "));
const P = await openPage("/brief?key=" + READ);
for (const id of ids) ok(P.byId(id) && typeof P.byId(id).onclick === "function", "W1 #" + id + " has its handler");
ok(P.byId("fdl").querySelectorAll("button").every((b) => typeof b.onclick === "function") && P.byId("fmust").querySelectorAll("button").every((b) => typeof b.onclick === "function"), "W2 every district chip and every must-have chip has its handler");
// the form: a click changes the state the search will send
await click(P.byId("fmode").querySelector("button[data-v=buy]"), 0);
ok(P.win.__brief.state.mode === "buy" && P.byId("fbudl").textContent.includes("PRICE"), "W3 Buy switches the budget to a price");
await click(P.byId("fmode").querySelector("button[data-v=rent]"), 0);
await click(P.byId("fgo"), 20);
ok(/budget/i.test(text(P.byId("fmsg"))) && !P.calls.length && stepShown(P).join() === "budget", "W4 no budget: the button SAYS what is missing, shows the budget step, and does not search");
P.byId("fmax").value = "65k";
await click(P.byId("fdl").querySelector("button[data-s=jumeirahvillagecircle]"), 0);
await click(P.byId("fmust").querySelector("button[data-v=pool]"), 0);
await click(P.byId("fgo"), 80);
ok(P.calls[0] === "/brief_api?key=" + READ + "&mode=rent&beds=1&min=0&max=65000&areas=jumeirahvillagecircle&type=any&musts=pool&limit=10", "W5 the search calls Contract A with the brief", P.calls[0]);
ok(/[?&]run=1/.test(P.win.location.last || "") && /max=65000/.test(P.win.location.last || ""), "W6 the address bar now holds the brief (reload restores it)", P.win.location.last);
const rows = P.byId("bres").querySelectorAll(".row");
ok(rows.length === 10, "W7 the ranked list draws 10 rows", rows.length);
ok(P.byId("bres").querySelectorAll("input[type=checkbox]").length === 10 && P.win.__brief.chosen().length === 10, "W8 each row has a checkbox; the ten are chosen to start with");
ok(text(rows[0]).includes("in budget") && text(rows[3]).includes("a little over budget") && text(rows[4]).includes("over budget") && text(rows[5]).includes("under budget"), "W9 each row carries its verdict in words");
ok(text(rows[0]).includes("AED 60k") && text(rows[0]).includes("middle half 57k – 66k") && text(rows[0]).includes("30 lettings (25 new)"), "W10 the row gives typical rent, the middle half and the lettings count");
ok(text(rows[0]).includes("✓ pool") && text(rows[1]).includes("✗ no pool"), "W11 the must-haves show yes / no per building");
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
ok(/[?&]mode=rent&beds=1&min=0&max=65000/.test(pc[0]) && pc[0].includes("key=" + READ), "W15 the PDF call carries mode, beds, min, max and the key", pc[0]);
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
ok(S.calls[0] === "/brief_api?key=" + CLIENT + "&mode=rent&beds=1&min=0&max=65000&areas=jumeirahvillagecircle&type=any&musts=pool&limit=10", "W32 the shared link runs the same search on open", S.calls[0]);
ok(S.win.__brief.chosen().join() === "jumeirahvillagecircle:1491,dld:bloom heights", "W33 with the same two buildings ticked", S.win.__brief.chosen().join());
ok(S.byId("fmax").value === "65k" && S.byId("fdl").querySelector("button[data-s=jumeirahvillagecircle]").classList.contains("on") && S.byId("fmust").querySelector("button[data-v=pool]").classList.contains("on") && S.win.__brief.state.beds === "1" && S.win.__brief.state.mode === "rent", "W34 and the steps hold the whole brief it came from (rent, 1 bedroom, 65k, JVC, pool)");
ok(S.byId("bform").hidden && /1 bedroom, up to AED 65k a year, Jumeirah Village Circle, with pool/.test(text(S.byId("bsumt"))), "W34b the shared link opens on the list, the brief folded to one line");
// the search itself failing: said in words, with a working Try again
const F = await openPage("/brief?key=" + READ + "&mode=rent&beds=1&max=65000&run=1", { api: 404 });
ok(/not switched on yet/.test(text(F.byId("bres"))) && F.byId("bretry") && typeof F.byId("bretry").onclick === "function", "W35 a search that fails says so, with Try again", text(F.byId("bres")));
ok(F.byId("bout").hidden, "W36 and no output buttons are offered on a failed search");

globalThis.fetch = realFetch;
console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
