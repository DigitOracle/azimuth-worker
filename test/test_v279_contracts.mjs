// v279 - CONTRACTS SIGNED (Ejari) and ADVERTISED SUPPLY, on Kendall's go (1 Oct 2026).
// "If a broker wants to check a particular building or district, we should be able to say: this building / this developer, on this
// day, signed N contracts through Ejari."
//
// Through the real worker (worker.fetch) over a stubbed KV of realistic rows (test/v279_fixture.mjs), this proves:
//   S  START: the Brief first, CONTRACTS SIGNED second, ADVERTISED SUPPLY third and for the OWNER only; a client key sees neither the
//      supply card nor "Black Coffee"; with no Ejari data the card is the search box alone (no chart, no numbers)
//   A  the adapter reads the DDA session's final field names, array rows with `fields`, and missing fields without breaking
//   Q  the search: by app name, English name, Arabic name and project number; a district by what people call it
//   B  a building: the count for the window, bands, property types, identity "THE VOGUE · <arabic> · #444" under the app's own name,
//      links to its building page and to Blocks
//   V  a developer: the same across its projects in two districts, with a per-building table
//   D  a district and all of Dubai: totals, "most let buildings" with flexi-desk licences EXCLUDED, where the new leases are, Top 5/10/15/20
//   W  Day / Week / Month / Custom, with the comparison; FILED is the default date axis, the "contract start" switch, and the fallback
//   T  property-type chips (Hotel apartment its own type) and the EN / عربي names toggle ("EN only" / "AR only", never translated)
//   K  the client key works and no owner key leaks; the caveat is always on screen; the word "availability" never is
//   P  every inline script parses (node --check), and the START, panel and supply scripts behave in a small DOM stand-in
//   U  ADVERTISED SUPPLY: 404 to a client key and to no key, the page, the refresh request / status flow and the poller's routes
//   I  /img/: ejari_* needs the owner or a client key, pf_* the owner key only, everything else stays keyless
// NEGATIVE CONTROL: in src/ejari_page.js ejariRank, change `if (r.desk || !r.key) continue;` to `if (!r.key) continue;` - D3/D4 fail.
//
//   node test/test_v279_contracts.mjs
import worker from "../src/index.js";
import { ejariRow, ejariDoc, ejariProjects, EJARI_FIELDS, ejariCacheReset, EJARI_JS, EJARI_START_JS, EJARI_PANEL_JS, ejariBuildingPanel, ejariPulse, subSay } from "../src/ejari_page.js";
import { supplyRow, SUPPLY_JS, supplyStatus } from "../src/supply_page.js";
import { buildingPageHtml } from "../src/building_page.js";
import { AS_OF, addD, buildStore, startRows, filedRows, dubaiRows, FIELDS } from "./v279_fixture.mjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 500) : "")); } };
const parses = (code) => { const f = path.join(os.tmpdir(), "v279_" + Math.random().toString(36).slice(2) + ".js"); fs.writeFileSync(f, code); try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); return true; } catch (e) { console.log(String(e.stderr || e.message).slice(0, 600)); return false; } finally { try { fs.unlinkSync(f); } catch (e) {} } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- the worker harness ----
const READ = "client_read_key_in_links_123", CLIENT = "client_key_for_links_456";
let store = buildStore();
const writes = [];
const KV = {
  async get(k, type) { if (!store.has(k)) return null; const v = store.get(k); return type === "arrayBuffer" ? new TextEncoder().encode(v).buffer : v; },
  async put(k, v) { writes.push(k); store.set(k, v); }, async delete(k) { store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter((k) => k.startsWith(p)).map((name) => ({ name })), list_complete: true }; }
};
globalThis.fetch = async () => new Response("{}", { status: 200 });
const env = { MEETINGS: KV, READ_KEY: READ, CLIENT_KEY: CLIENT, INGEST_TOKEN: "ING", PUBLIC_ORIGIN: "https://azimuth-2.digitalchemy.workers.dev" };
const ORIGIN = "https://azimuth-2.digitalchemy.workers.dev";
const call = (p, init) => worker.fetch(new Request(ORIGIN + p, init), env, { waitUntil() {} });
const page = async (p) => { const r = await call(p); return { status: r.status, html: await r.text() }; };
const scripts = (html) => [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].filter((m) => !/\bsrc=|type="?(module|importmap)/.test(m[1])).map((m) => m[2]);
const visible = (html) => html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const headN = (html) => { const m = /id=ejhl>[\s\S]*? signed <b>([\d,]+)<\/b>/.exec(html); return m ? +m[1].replace(/,/g, "") : NaN; };
const block = (html, id) => { const m = new RegExp("id=" + id + "[ >]").exec(html); const i = m ? m.index : -1; if (i < 0) return ""; const j = html.indexOf("</div></div></div>", i); return html.slice(i, j < 0 ? undefined : j + 18); };
const rankRows = (html, id) => [...(block(html, id) || "").matchAll(/<div class=rk>[\s\S]*?<div class=rn>([\s\S]*?)<\/div>[\s\S]*?<div class=rc>([\d,]+)<small>/g)].map((m) => ({ name: visible(m[1]).trim(), n: +m[2].replace(/,/g, "") }));
const K = (k) => "key=" + encodeURIComponent(k);
const reset = (opts) => { store = buildStore(opts); ejariCacheReset(); };

// the expectations, from the fixture rows directly (not through the module)
const S = startRows(), F = filedRows();
const sum = (rows, pred) => rows.filter((r) => !r.desk_like && pred(r)).reduce((s, r) => s + r.contracts, 0);
const inW = (from, to) => (r) => r.date >= from && r.date <= to;
const WEEK = [addD(AS_OF, -6), AS_OF], PREV_WEEK = [addD(AS_OF, -13), addD(AS_OF, -7)], MONTH = [addD(AS_OF, -29), AS_OF];

// ---- A: the adapter ----
{
  ok(EJARI_FIELDS.date[0] === "date" && EJARI_FIELDS.project[0] === "dld_project" && EJARI_FIELDS.projectNo[0] === "dld_project_number" && EJARI_FIELDS.med[0] === "rent_median" && EJARI_FIELDS.band[0] === "beds" && EJARI_FIELDS.sub[0] === "sub_type" && EJARI_FIELDS.usage[0] === "usage",
    "A1 the adapter reads the DDA session's final field names first (date, dld_project, dld_project_number, beds, rent_median, sub_type, usage)");
  const r = ejariRow(S[0]);
  ok(r && r.date === S[0].date && r.key === S[0].key && r.project === S[0].dld_project && r.projectNo === S[0].dld_project_number && r.n === S[0].contracts && r.band === S[0].beds && r.sub === S[0].sub_type, "A2 an object row maps field for field", JSON.stringify(r));
  const arr = ejariRow(FIELDS.map((f) => S[0][f]), FIELDS);
  ok(JSON.stringify(arr) === JSON.stringify(r), "A3 an array row in the order of `fields` reads the same");
  const bare = ejariRow({ date: "2026-09-30", contracts: 2, dld_project: "X" });
  ok(bare && bare.sub === null && bare.projectAr === "" && bare.usage === null && bare.key === "dld:x" && bare.band === "other" && !bare.desk, "A4 a row missing sub_type, Arabic name, usage and key is read, null-safe", JSON.stringify(bare));
  ok(ejariRow({ contracts: 3 }) === null && ejariRow(null) === null, "A5 a row with no date is dropped, not guessed");
  const old = ejariRow({ contract_start_date: "2026-09-29", dld_project: "Y", beds_band: "2", median_rent: 90000, contracts: 1 });
  ok(old && old.date === "2026-09-29" && old.band === "2" && old.med === 90000, "A6 the earlier spec's names still read (a rename is a one-line change)");
  ok(subSay("Hotel") === "Hotel apartment" && subSay("1bed room+Hall") === "1bed room + hall", "A7 sub_type 'Hotel' reads as Hotel apartment; Ejari's own words otherwise");
  const pj = ejariProjects(JSON.parse(store.get("img_ejari_projects_index")));
  ok(pj.get("444") && pj.get("444").en === "THE VOGUE" && pj.get("444").key === "jumeirahvillagecircle:1492" && pj.size === 9, "A8 img_ejari_projects_index {index:{number:{...}}} reads", pj.size);
  const d = ejariDoc(JSON.parse(store.get("img_ejari_filed_jumeirahvillagecircle")));
  ok(d.basis === "filed" && d.asOf === AS_OF, "A9 a filed file says basis filed");
}

// ---- S: START ----
{
  const own = await page("/start?" + K(READ));
  const iB = own.html.indexOf('class="btn rent"'), iE = own.html.indexOf("id=ejari0"), iS = own.html.indexOf("id=supply0");
  ok(own.status === 200 && iB > 0 && iE > iB && iS > iE, "S1 owner START: the Brief, then CONTRACTS SIGNED, then ADVERTISED SUPPLY", [iB, iE, iS].join(" "));
  ok(own.html.includes("CONTRACTS SIGNED · EJARI") && /<form class=ejf method=get action="\/contracts">/.test(own.html) && own.html.includes("Who’s letting, where"), "S2 the Ejari card: its rule, its heading and one search box that opens /contracts");
  ok(/GOOD (MORNING|AFTERNOON|EVENING), BLACK COFFEE/.test(own.html), "S3 the owner is greeted as Black Coffee");
  ok(own.html.includes("ADVERTISED SUPPLY") && own.html.includes("live rental adverts from listing sites, not vacancy"), "S4 the owner's supply card carries the label");
  const cli = await page("/start?" + K(CLIENT));
  ok(cli.status === 200 && cli.html.includes("id=ejari0") && cli.html.includes('name=key value="' + CLIENT + '"'), "S5 client START: the Ejari search is there, carrying the client key");
  ok(!cli.html.includes("supply0") && !cli.html.includes("ADVERTISED SUPPLY") && !cli.html.includes("/supply") && !/adverts/i.test(cli.html), "S6 client START: NO advertised-supply card, no /supply link, no word of adverts");
  ok(!cli.html.includes("BLACK COFFEE") && /GOOD (MORNING|AFTERNOON|EVENING)</.test(cli.html) && !cli.html.includes(READ), "S7 client START: never greeted as Black Coffee (the v278.1 greeting); no owner key");
  const card = block(own.html, "ejari0");
  ok(/<div id=ejpulse hidden>/.test(own.html) && !/\d{2,}/.test(visible(card.replace(/<form[\s\S]*?<\/form>/, ""))), "S8 the card is drawn with its chart hidden and no number in it until the data answers");
  for (const c of scripts(own.html)) ok(parses(c), "P1 START inline script parses (" + c.length + " chars)");
}

// ---- P: the START card's script in a small DOM stand-in: no data -> search alone; data -> 7 bars, chips, Day/Week/Month ----
function miniDom(ids) {
  const els = {};
  const mk = (id) => ({ id, hidden: id === "ejpulse", innerHTML: "", textContent: "", _btns: [], getElementsByTagName() { return this._btns; }, querySelector(sel) { const m = /data-b=(\w+)/.exec(sel); return m ? this._btns.find((b) => b.getAttribute("data-b") === m[1]) || null : null; } });
  for (const id of ids) els[id] = mk(id);
  const btn = (attr, v) => ({ className: "", disabled: false, title: "", getAttribute: (a) => (a === attr ? v : null), onclick: null });
  els.ejseg._btns = ["day", "week", "month"].map((v) => btn("data-m", v));
  els.ejbas._btns = ["filed", "start"].map((v) => btn("data-b", v));
  return { els, document: { getElementById: (id) => els[id] || null } };
}
async function runStart(pulseFor) {
  const D = miniDom(["ejpulse", "ejseg", "ejspark", "ejchips", "ejsub", "ejbas"]);
  const calls = [];
  const win = { document: D.document, console, encodeURIComponent, __EJS: { key: READ, rk: "" },
    fetch: async (u) => { calls.push(u); const b = /basis=(\w+)/.exec(u); return new Response(JSON.stringify(await pulseFor(b ? b[1] : "filed")), { status: 200, headers: { "content-type": "application/json" } }); } };
  win.window = win; vm.createContext(win); vm.runInContext(EJARI_START_JS, win); await sleep(30);
  return { D, win, calls };
}
{
  const none = await runStart(async () => ({ ok: false }));
  ok(none.D.els.ejpulse.hidden === true && none.D.els.ejspark.innerHTML === "" && none.D.els.ejchips.innerHTML === "", "P2 START card with no Ejari data: the chart, toggle and chips stay hidden (search box only, no fake numbers)");
  reset();
  const live = await runStart((b) => ejariPulse(env, b, Date.parse("2026-10-01T06:00:00Z")));
  const bars = (live.D.els.ejspark.innerHTML.match(/<i /g) || []).length;
  ok(!live.D.els.ejpulse.hidden && bars === 7, "P3 with data: seven bars", bars);
  const pf = await ejariPulse(env, "filed", Date.parse("2026-10-01T06:00:00Z"));
  const FD = dubaiRows(F), expDay = FD.filter((r) => r.date === AS_OF && r.reg_type === "New" && !r.desk_like).reduce((s, r) => s + r.contracts, 0);
  ok(pf.basis === "filed" && pf.when === "yesterday" && pf.day.n === expDay && pf.day.bars[6].to === AS_OF, "P4 Day: yesterday's new leases (filed), the last bar is yesterday", pf.day.n + " vs " + expDay);
  ok(live.D.els.ejsub.textContent.indexOf(expDay.toLocaleString("en-US") + " new leases filed yesterday") === 0, "P5 the line under the heading: N new leases filed yesterday, against the 7-day average", live.D.els.ejsub.textContent);
  ok(/class=chip href="\/contracts\?kind=district&id=[a-z]+&range=day&key=/.test(live.D.els.ejchips.innerHTML) && /<b>\d+<\/b>/.test(live.D.els.ejchips.innerHTML), "P6 district chips with counts, each opening that district on /contracts");
  live.D.els.ejseg._btns[1].onclick.call(live.D.els.ejseg._btns[1]);
  const expWeek = FD.filter((r) => inW(...WEEK)(r) && r.reg_type === "New" && !r.desk_like).reduce((s, r) => s + r.contracts, 0);
  ok(live.D.els.ejseg._btns[1].className === "on" && live.D.els.ejsub.textContent.indexOf(expWeek.toLocaleString("en-US") + " new leases filed in the last 7 days") === 0 && /range=week/.test(live.D.els.ejchips.innerHTML), "P7 Week: the last 7 days, and the chips follow", live.D.els.ejsub.textContent);
  live.D.els.ejseg._btns[2].onclick.call(live.D.els.ejseg._btns[2]);
  ok(/in the last 30 days/.test(live.D.els.ejsub.textContent) && pf.month.bars.length === 7 && pf.month.bars[6].from === MONTH[0], "P8 Month: the last 30 days, seven 30-day bars");
  live.D.els.ejbas._btns[1].onclick.call(live.D.els.ejbas._btns[1]);
  await sleep(20);
  ok(live.calls.some((u) => /basis=start/.test(u)) && /starting/.test(live.D.els.ejsub.textContent), "P9 the 'Contract start' switch re-reads on the start-date basis", live.D.els.ejsub.textContent);
  reset({ filed: false });
  const fb = await runStart((b) => ejariPulse(env, b, Date.parse("2026-10-01T06:00:00Z")));
  ok(!fb.D.els.ejpulse.hidden && fb.D.els.ejbas._btns[0].disabled && fb.D.els.ejbas._btns[1].className === "on" && /starting/.test(fb.D.els.ejsub.textContent), "P10 no filed file: the card falls back to contract start and shows Filed as not loaded");
  reset({ ejari: false });
  ok(!(await ejariPulse(env, "filed")).ok, "P11 /contracts_api?pulse=1 with nothing in KV says ok:false");
  reset();
}

// ---- Q: the search ----
{
  const r1 = await page("/contracts?q=binghatti&" + K(READ));
  const pick = block(r1.html, "ejpick");
  ok(/Binghatti Nova/.test(pick) && /BINGHATTI DEVELOPERS FZE/.test(pick), "Q1 'binghatti' asks which one: the building (by its app name) and the developer", visible(pick).slice(0, 300));
  const r2 = await page("/contracts?q=%23444&" + K(READ));
  ok(/data-kind=building/.test(r2.html) && /id=ejname>DAMAC Maison Canal Views</.test(r2.html), "Q2 '#444' (the project number) opens the building, titled with the app's own name");
  const r3 = await page("/contracts?q=" + encodeURIComponent("ذا فوج") + "&" + K(READ));
  ok(/data-kind=building/.test(r3.html) && /id=ejname>DAMAC Maison Canal Views</.test(r3.html), "Q3 the Arabic name finds the same building");
  const r4 = await page("/contracts?q=the+vogue&" + K(READ));
  ok(/id=ejname>DAMAC Maison Canal Views</.test(r4.html), "Q4 the register's English name finds it too");
  const r5 = await page("/contracts?q=jvc&" + K(READ));
  ok(/data-kind=district/.test(r5.html) && /Jumeirah Village Circle/.test(r5.html), "Q5 'jvc' opens the district");
  const idx = await (await call("/contracts_api?index=1&" + K(READ))).json();
  ok(idx.ok && idx.b.some((x) => x[0] === "dubaimarina:3002" && x[6] === "3100") && idx.d.some((x) => x[0] === "dubai"), "Q6 the suggestion index carries every project in the projects index (even one with no recent contract) and 'All of Dubai'");
  const r6 = await page("/contracts?q=zzqqxx&" + K(READ));
  ok(/id=ejnone>Nothing in the contract record matches/.test(r6.html), "Q7 no match says so");
}

// ---- B: a building ----
{
  const id = "jumeirahvillagecircle:1492";
  const r = await page("/contracts?kind=building&id=" + encodeURIComponent(id) + "&range=week&" + K(READ));
  const exp = sum(F, (x) => x.key === id && inW(...WEEK)(x));
  ok(r.status === 200 && headN(r.html) === exp, "B1 the building, this week, FILED: DAMAC Maison Canal Views signed N contracts", headN(r.html) + " vs " + exp);
  ok(/id=ejhl>DAMAC Maison Canal Views signed <b>[\d,]+<\/b> contracts, filed with Ejari between 24 Sep and 30 Sep 2026\./.test(r.html), "B2 in Kendall's sentence: this building signed N contracts, filed with Ejari between two dates");
  ok(/id=ejid>THE VOGUE · <span lang=ar dir=rtl>ذا فوج<\/span> · #444<\/div>/.test(r.html), "B3 the register identity under the app's name: THE VOGUE · <arabic> · #444");
  ok(/<th>HOME<\/th>/.test(r.html) && /<td>Studio<\/td>/.test(r.html) && /<td>1 bedroom<\/td>/.test(r.html) && /TYPICAL RENT A YEAR/.test(r.html), "B4 totals by bedroom band, New vs Renewed, and the typical rent per band");
  ok(/BY PROPERTY TYPE/.test(r.html) && /<td>1bed room \+ hall<\/td>/.test(r.html), "B5 and a breakdown by Ejari's property type");
  ok(r.html.includes('href="/building/jumeirahvillagecircle/1492?key=' + READ + '"') && r.html.includes('href="/blocks?district=jumeirahvillagecircle&amp;gold=1492&amp;key=' + READ + '"'), "B6 links to its building page and to Blocks");
  ok(/<svg viewBox="0 0 70 70"/.test(r.html), "B7 the daily bar strip: seven days, seven bars");
  const pr = sum(F, (x) => x.key === id && inW(...PREV_WEEK)(x));
  ok(new RegExp("id=ejcmp>[\\s\\S]*? on the 7 days before \\(" + pr.toLocaleString("en-US") + "\\)").test(r.html), "B8 Week compares with the 7 days before", (/id=ejcmp>[^\n]*?<\/div>/.exec(r.html) || [""])[0]);
  const api = await (await call("/contracts_api?kind=building&panel=1&id=" + encodeURIComponent(id) + "&" + K(READ))).json();
  ok(api.ok && api.d7.n === exp && api.d30.n === sum(F, (x) => x.key === id && inW(...MONTH)(x)) && api.basis === "filed" && /see|contracts/.test(api.see), "B9 the building page's panel data: 7 and 30 days, by band, New vs Renewed, with 'see all'", JSON.stringify(api).slice(0, 200));
  const panel = ejariBuildingPanel("jumeirahvillagecircle", "1490", READ, "");
  ok(panel.includes("Contracts signed") && panel.includes("id=ejp") && scripts(panel).every(parses), "B10 the panel block for the building page is drawn and its scripts parse");
  const bp = buildingPageHtml({ slug: "jumeirahvillagecircle", id: "1490", name: "Binghatti Nova", district: "Jumeirah Village Circle", register: [], floors: [] }, READ, "");
  ok(bp.includes("id=ejp") && bp.includes("Contracts signed <u>Ejari</u>"), "B11 the building page draws the Contracts signed panel inside its FILTERS panel");
  for (const c of scripts(bp)) ok(parses(c), "P12 building page classic inline script parses (" + c.length + " chars)");
  const src = fs.readFileSync(new URL("../src/building_page.js", import.meta.url), "utf8");
  ok((src.match(/ejariBuildingPanel\(/g) || []).length === 1 && /==== v279 CONTRACTS SIGNED[\s\S]{0,200}==== end CONTRACTS SIGNED ====/.test(src), "B12 building_page.js holds ONE marked block");
}

// ---- V: a developer ----
{
  const r = await page("/contracts?kind=developer&id=1234&range=month&" + K(READ));
  const exp = sum(F, (x) => x.developer_number === "1234" && inW(...MONTH)(x));
  ok(headN(r.html) === exp && /BINGHATTI DEVELOPERS FZE signed/.test(r.html), "V1 the developer across all its projects, this month", headN(r.html) + " vs " + exp);
  const rows = rankRows(r.html, "ejproj");
  const names = rows.map((x) => x.name).join(" | ");
  ok(rows.length === 3 && /Binghatti Nova/.test(names) && /OXFORD TERRACES/.test(names) && /VERA RESIDENCES/.test(names) && rows.reduce((s, x) => s + x.n, 0) === exp, "V2 the per-building table: its three projects in two districts, adding up", names);
}

// ---- D: a district and all of Dubai; desk_like out of the rankings ----
{
  const r = await page("/contracts?kind=district&id=businessbay&range=week&top=10&" + K(READ));
  const exp = sum(F, (x) => x.district === "businessbay" && inW(...WEEK)(x));
  ok(headN(r.html) === exp, "D1 the district total, desk licences left out", headN(r.html) + " vs " + exp);
  const desk = F.filter((x) => x.district === "businessbay" && x.desk_like && inW(...WEEK)(x)).reduce((s, x) => s + x.contracts, 0);
  ok(new RegExp("id=ejdesk>Plus " + desk.toLocaleString("en-US") + " flexi-desk licences").test(r.html), "D2 the flexi-desk licences are reported on their own line", desk);
  const rank = rankRows(r.html, "ejrank");
  const want = ["businessbay:2001", "businessbay:2002", "businessbay:2050"].map((k) => ({ k, n: sum(F, (x) => x.key === k && inW(...WEEK)(x)) })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
  ok(rank.length === want.length && rank.every((x, i) => x.n === want[i].n), "D3 most let buildings: ranked on real lettings only", JSON.stringify(rank) + " vs " + JSON.stringify(want));
  ok(rank[0] && !/BAY SQUARE/.test(rank[0].name) && rank.every((x) => !/BAY SQUARE/.test(x.name) || x.n < 40), "D4 the business centre's flexi-desk licences do not put it at the top", JSON.stringify(rank));
  const db = await page("/contracts?kind=dubai&range=week&" + K(READ));
  ok(/data-kind=dubai/.test(db.html) && rankRows(db.html, "ejwhere").length === 5 && rankRows(db.html, "ejrank").length === 5, "D5 all of Dubai: where the new leases are, and the most let buildings, Top 5 by default");
  ok(!/BY PROPERTY TYPE/.test(db.html) && !/>Not stated</.test(db.html), "D5b the all-Dubai file has no property type: no table of 'Not stated'");
  const w = rankRows(db.html, "ejwhere");
  ok(w.every((x, i) => i === 0 || w[i - 1].n >= x.n) && /style="width:100%"/.test(block(db.html, "ejwhere")), "D6 ranked by new leases, the bars scaled to the largest in view");
  const db10 = await page("/contracts?kind=dubai&range=week&top=10&" + K(READ));
  ok(rankRows(db10.html, "ejwhere").length === 8 && rankRows(db10.html, "ejrank").length === 8 && /class="ch on" href="[^"]*top=10/.test(db10.html), "D7 Top 10 applies to both lists (8 districts, 8 buildings on record)", rankRows(db10.html, "ejwhere").length + " / " + rankRows(db10.html, "ejrank").length);
  ok(["Top 5", "Top 10", "Top 15", "Top 20"].every((t) => block(db.html, "ejtop").includes(">" + t + "<")), "D8 the selector offers Top 5 / 10 / 15 / 20");
  const plain = await page("/contracts?" + K(READ));
  ok(/data-kind=dubai/.test(plain.html), "D9 /contracts with nothing asked opens on all of Dubai");
}

// ---- W: Day / Week / Month / Custom; filed vs start; the fallback ----
{
  const base = "/contracts?kind=district&id=jumeirahvillagecircle&" + K(READ);
  const day = await page(base + "&range=day");
  ok(headN(day.html) === sum(F, (x) => x.district === "jumeirahvillagecircle" && x.date === AS_OF) && /filed with Ejari on 30 Sep 2026/.test(day.html), "W1 Day: the latest day");
  const avg = sum(F, (x) => x.district === "jumeirahvillagecircle" && inW(addD(AS_OF, -7), addD(AS_OF, -1))(x)) / 7;
  ok(new RegExp("the 7-day average before it \\(" + (Math.round(avg * 10) / 10).toLocaleString("en-US") + " a day\\)").test(day.html), "W2 Day compares with the 7-day average before it", avg);
  const month = await page(base + "&range=month");
  ok(headN(month.html) === sum(F, (x) => x.district === "jumeirahvillagecircle" && inW(...MONTH)(x)) && /the 30 days before/.test(month.html), "W3 Month: the last 30 days, against the 30 before");
  const cus = await page(base + "&range=custom&from=2026-06-01&to=2026-06-30");
  ok(headN(cus.html) === sum(F, (x) => x.district === "jumeirahvillagecircle" && inW("2026-06-01", "2026-06-30")(x)) && !/id=ejcmp/.test(cus.html) && /<input type=date name=from value="2026-06-01" min="2025-08-27" max="2026-09-30">/.test(cus.html), "W4 Custom: any span up to 400 days back, no comparison");
  const far = await page(base + "&range=custom&from=2024-01-01&to=2026-09-30");
  ok(/between 27 Aug 2025 and 30 Sep 2026/.test(far.html), "W5 a custom span is clipped to 400 days");
  const seg = block(week = (await page(base + "&range=week")).html, "ejrange");
  ok(/<a class=on data-r=week/.test(week) && ["Day", "Week", "Month", "Custom"].every((t) => week.includes(">" + t + "</a>")), "W6 the Day / Week / Month / Custom toggle sits at the top of the results, Week on");
  const st = await page(base + "&range=week&basis=start");
  ok(headN(st.html) === sum(S, (x) => x.district === "jumeirahvillagecircle" && inW(...WEEK)(x)) && /by contract start date, between/.test(st.html) && /<a class=on data-b=start/.test(st.html), "W7 the 'contract start' switch counts by start date", headN(st.html));
  ok(headN(week) !== headN(st.html), "W8 the two axes really differ in the fixture (the switch is not a no-op)");
  ok(/id=ejcav>Counted by the day each contract was filed with Ejari, usually within hours of signing\. No unit numbers are published\./.test(week), "W9 the caveat names the filed axis by default");
  ok(/id=ejcav>Ejari records each contract’s start date; it can be filed before or after that day\. No unit numbers are published\./.test(st.html), "W10 and the start axis when switched (the caveat as Kendall wrote it)");
  reset({ filed: false });
  const fb = await page(base + "&range=week");
  ok(headN(fb.html) === sum(S, (x) => x.district === "jumeirahvillagecircle" && inW(...WEEK)(x)) && /filing dates not loaded yet/.test(fb.html) && /Filing dates are not loaded for this yet, so these are contract start dates\./.test(fb.html), "W11 no filed file: falls back to contract start, and says so twice");
  reset();
  const filt = await page(base + "&range=week&reg=renew&beds=1");
  ok(headN(filt.html) === sum(F, (x) => x.district === "jumeirahvillagecircle" && inW(...WEEK)(x) && x.reg_type === "Renew" && x.beds === "1"), "W12 Renewals, one bedroom: the filters apply");
}
var week;

// ---- T: property types and the EN / AR names ----
{
  const r = await page("/contracts?kind=district&id=dubaimarina&range=month&" + K(READ));
  ok(/id=ejsub>[\s\S]*?>Hotel apartment</.test(r.html), "T1 the property-type chips carry Hotel apartment as its own type");
  const h = await page("/contracts?kind=district&id=dubaimarina&range=month&sub=hotel&" + K(READ));
  ok(headN(h.html) === sum(F, (x) => x.district === "dubaimarina" && inW(...MONTH)(x) && x.sub_type === "Hotel"), "T2 sub=hotel counts the hotel apartments only");
  const jv = await page("/contracts?kind=district&id=jumeirahvillagecircle&range=week&top=10&" + K(READ));
  ok(/id=ejlang/.test(jv.html) && jv.html.includes(">EN</a>") && jv.html.includes(">عربي</a>") && /<html lang=en data-lang=en>/.test(jv.html), "T3 the EN / عربي toggle, English first");
  ok(/<span class=pn><span class=en>OXFORD TERRACES<\/span><span class=ar>OXFORD TERRACES<small class=tgx>EN only<\/small><\/span><\/span>/.test(jv.html), "T4 a project with no Arabic name shows its English one, tagged EN only - never translated");
  ok(/<span class=en><span lang=ar dir=rtl>برايم [^<]*<\/span><small class=tgx>AR only<\/small><\/span>/.test(jv.html), "T5 a project with no English name shows its Arabic one, tagged AR only");
  ok(/<span class=ar><span lang=ar dir=rtl>ذا فوج<\/span><\/span>/.test(jv.html), "T6 both names are there for the toggle to switch");
  const ar = await page("/contracts?kind=district&id=jumeirahvillagecircle&range=week&lang=ar&" + K(READ));
  ok(/<html lang=en data-lang=ar>/.test(ar.html) && /lang=ar/.test((/href="([^"]*kind=building[^"]*)"/.exec(ar.html) || [""])[0]), "T7 lang=ar shows the Arabic names, and the links keep it");
  // the page script remembers the viewer's choice
  const attrs = { "data-lang": "en" }, ls = { najma_ejari_lang: "ar" };
  const doc = { documentElement: { getAttribute: (a) => attrs[a], setAttribute: (a, v) => { attrs[a] = v; } }, getElementById: () => null };
  const w2 = { document: doc, localStorage: { getItem: (k) => ls[k] || null, setItem: (k, v) => { ls[k] = v; } }, __EJ: { key: READ, lang: "" }, console, encodeURIComponent };
  w2.window = w2; vm.createContext(w2); vm.runInContext(EJARI_JS, w2);
  ok(attrs["data-lang"] === "ar", "T8 with no lang in the link, the viewer's remembered choice (Arabic) is applied");
}

// ---- K: the client key, the caveat, the word ----
{
  const c = await page("/contracts?kind=district&id=businessbay&range=week&" + K(CLIENT));
  ok(c.status === 200 && !c.html.includes(READ) && c.html.includes("key=" + CLIENT), "K1 /contracts opens on a client key; every link carries the client key, never the owner key");
  ok((await call("/contracts?kind=district&id=businessbay")).status === 401 && (await call("/contracts_api?index=1")).status === 401, "K2 no key: refused");
  ok((await call("/contracts_api?index=1&" + K(CLIENT))).status === 200, "K3 the suggestion list answers a client key");
  for (const p of ["/contracts?" + K(READ), "/contracts?kind=building&id=jumeirahvillagecircle:1490&" + K(READ), "/contracts?q=zzqqxx&" + K(READ), "/contracts?kind=developer&id=1234&" + K(READ)]) {
    const r = await page(p);
    ok(/id=ejcav>/.test(r.html), "K4 the caveat is on screen: " + p.split("&")[0]);
    ok(!/availab/i.test(visible(r.html)), "K5 never called availability: " + p.split("&")[0]);
    for (const s of scripts(r.html)) ok(parses(s), "P13 inline script parses on " + p.split("&")[0] + " (" + s.length + " chars)");
  }
  const before = writes.length;
  await page("/contracts?kind=dubai&" + K(READ)); await call("/contracts_api?pulse=1&" + K(READ)); await call("/contracts_api?index=1&" + K(READ));
  ok(writes.length === before, "K6 the contract pages write nothing to KV");
  ok(!EJARI_JS.includes("${") && !EJARI_JS.includes("`") && !EJARI_START_JS.includes("`") && !EJARI_PANEL_JS.includes("`") && !SUPPLY_JS.includes("`"), "P14 the page scripts interpolate nothing and hold no backtick");
}

// ---- U: ADVERTISED SUPPLY, owner only ----
{
  for (const p of ["/supply?" + K(CLIENT), "/supply", "/supply/summary?" + K(CLIENT), "/supply/status?id=x&" + K(CLIENT), "/supply?" + K("nonsense_key_000000")]) {
    const r = await call(p); ok(r.status === 404, "U1 " + p.replace(CLIENT, "CLIENT") + " -> 404", r.status);
  }
  const w0 = writes.length;
  const rc = await call("/supply/request?district=jumeirahvillagecircle&" + K(CLIENT), { method: "POST" });
  ok(rc.status === 404 && writes.length === w0 && ![...store.keys()].some((k) => k.startsWith("pf_req_")), "U2 a client key cannot ask for a crawl: 404 and nothing written");
  const r = await page("/supply?d=jumeirahvillagecircle&" + K(READ));
  ok(r.status === 200 && /id=sulabel>Advertised supply · live rental adverts from listing sites, not vacancy · fetched 1 Oct, 09:40/.test(r.html), "U3 the owner's page, labelled, with the fetch time (Dubai)");
  ok(/<b>42<\/b> adverts across 3 sites/.test(r.html) && /Property Finder <b>35<\/b> ↗/.test(r.html) && /Bayut <b>24<\/b>/.test(r.html) && /Dubizzle <b>6<\/b>/.test(r.html), "U4 per building: N adverts across M sites, with each site's count and link");
  ok(/MEDIAN ASKING RENT/.test(r.html) && /MEDIAN DAYS LISTED/.test(r.html) && /DELISTED SINCE LAST CRAWL/.test(r.html) && /rough sign of letting/.test(r.html), "U5 by bedroom: live adverts, median asking rent, median days listed, delisted since last crawl (a rough sign of letting)");
  ok(/LISTING SITE NAME<\/div><div class=nm>JVC Skyline Tower<span class=tg>not matched to the register<\/span>/.test(r.html) && /Newsite <b>2<\/b>/.test(r.html), "U6 an unmatched building appears under the site's own name only; a site added later shows with no code change");
  ok(supplyRow({ listings_live: null, sources: { a: 3, b: 5 } }).live === 5, "U7 no de-duplicated total: the biggest site, never the sum");
  for (const s of scripts(r.html)) ok(parses(s), "P15 /supply inline script parses (" + s.length + " chars)");
  // the request / status flow
  const rq = await (await call("/supply/request?district=jumeirahvillagecircle&slug=binghatti-nova&" + K(READ), { method: "POST" })).json();
  const rec = JSON.parse(store.get("pf_req_" + rq.id) || "null");
  ok(rq.ok && /^[0-9a-f-]{36}$/.test(rq.id) && rec && rec.district === "jumeirahvillagecircle" && rec.building_slug === "binghatti-nova" && rec.requested_at, "U8 Refresh now writes pf_req_<uuid> = {district, building_slug, requested_at}", JSON.stringify(rec));
  const again = await (await call("/supply/request?district=jumeirahvillagecircle&slug=binghatti-nova&" + K(READ), { method: "POST" })).json();
  ok(again.id === rq.id && again.existing, "U9 asking for the same building again does not queue a second crawl");
  const t0 = Date.parse(rec.requested_at);
  ok((await supplyStatus(env, rq.id, t0 + 30000)).state === "waiting", "U10 not yet taken: waiting");
  ok((await supplyStatus(env, rq.id, t0 + 100000)).state === "offline", "U11 no pickup in 90 s: the office computer is offline");
  store.set("pf_take_" + rq.id, JSON.stringify({ taken_at: new Date(t0 + 60000).toISOString(), host: "office-laptop" }));
  const f = await supplyStatus(env, rq.id, t0 + 120000);
  ok(f.state === "fetching" && f.expect_s === 300 && f.kind === "building", "U12 taken: fetching, a building about 5 minutes", JSON.stringify(f));
  const dq = await (await call("/supply/request?district=businessbay&" + K(READ), { method: "POST" })).json();
  ok(dq.ok && dq.queued_behind && dq.queued_behind.building_slug === "binghatti-nova", "U13 a second request while one runs is queued behind it");
  const q = await supplyStatus(env, dq.id, Date.parse(JSON.parse(store.get("pf_req_" + dq.id)).requested_at) + 200000);
  ok(q.state === "queued" && q.kind === "district", "U14 queued, not 'offline', while the first is running", JSON.stringify(q));
  ok((await supplyStatus(env, rq.id, t0 + 60000 + 31 * 60000)).state === "failed", "U15 taken and not done in 30 minutes: failed (offer a re-request)");
  store.set("pf_done_" + rq.id, JSON.stringify({ status: "held_by_daily_chain", district: "jumeirahvillagecircle", building_slug: "binghatti-nova" }));
  ok((await supplyStatus(env, rq.id)).state === "deferred", "U16 held by the daily chain: available after the morning refresh");
  store.set("pf_done_" + rq.id, JSON.stringify({ status: "error", note: "site refused" }));
  const er = await supplyStatus(env, rq.id); ok(er.state === "error" && er.note === "site refused", "U17 an error is reported with its note");
  store.set("pf_done_" + rq.id, JSON.stringify({ status: "ok", as_of: "2026-10-01", district: "jumeirahvillagecircle", image: "img_pf_supply_jumeirahvillagecircle", seconds: 212 }));
  ok((await supplyStatus(env, rq.id)).state === "done", "U18 done: the page reloads the fresh copy");
  ok((await (await call("/supply/status?id=" + rq.id + "&" + K(READ))).json()).state === "done", "U19 the same through GET /supply/status");
  // the page script: Refresh now -> request -> poll -> a sentence, never a dead button
  async function runSupply(states) {
    const box = { textContent: "" }, attrs = { "data-district": "jumeirahvillagecircle", "data-slug": "binghatti-nova" };
    const btn = { disabled: false, textContent: "Refresh now", nextElementSibling: box, getAttribute: (a) => attrs[a] || null, onclick: null };
    const seq = states.slice(), calls = [];
    const w = { document: { querySelectorAll: () => [btn] }, localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, location: { reload() { w.reloaded = true; } }, console, encodeURIComponent, setTimeout, Date, JSON, __SU: { key: READ }, __SU_POLL_MS: 5,
      fetch: async (u, o) => { calls.push((o && o.method) || "GET"); if (/\/supply\/request/.test(u)) return new Response(JSON.stringify({ ok: true, id: "11111111-2222-3333-4444-555555555555" })); return new Response(JSON.stringify({ ok: true, state: seq.length > 1 ? seq.shift() : seq[0], note: "x" })); } };
    w.window = w; vm.createContext(w); vm.runInContext(SUPPLY_JS, w);
    btn.onclick(); await sleep(150);
    return { btn, box, w, calls };
  }
  const a1 = await runSupply(["waiting", "fetching", "deferred"]);
  ok(/morning refresh/.test(a1.box.textContent) && !a1.btn.disabled && a1.calls[0] === "POST", "U20 the button: fetching, then 'available after the morning refresh', and usable again", a1.box.textContent);
  const a2 = await runSupply(["offline"]);
  ok(/office computer is offline; showing the last saved copy/.test(a2.box.textContent) && !a2.btn.disabled, "U21 offline says so and the button comes back", a2.box.textContent);
  const a3 = await runSupply(["fetching", "failed"]);
  ok(/did not finish in 30 minutes/.test(a3.box.textContent) && a3.btn.textContent === "Request again", "U22 failed offers Request again", a3.btn.textContent);
  const a4 = await runSupply(["fetching", "done"]);
  await sleep(900);
  ok(/Fresh copy in/.test(a4.box.textContent) && a4.w.reloaded, "U23 done reloads the page");
  // the laptop poller's routes: the ingest header only, take / done round trips, the queue drains
  const ING = { "X-Azimuth-Ingest": "ING" };
  ok((await call("/pf_queue")).status === 401 && (await call("/pf_queue", { headers: { "X-Azimuth-Ingest": "wrong" } })).status === 401 && (await call("/pf_queue?" + K(READ))).status === 401,
    "U24 /pf_queue: no header, a wrong header, or the owner's URL key -> 401");
  ok((await call("/pf_status", { method: "POST", headers: { "X-Azimuth-Ingest": "nope", "content-type": "application/json" }, body: JSON.stringify({ id: dq.id, stage: "take" }) })).status === 401, "U25 /pf_status with a wrong header -> 401");
  let qd = await (await call("/pf_queue", { headers: ING })).json();
  ok(qd.pending.length === 1 && qd.pending[0].id === dq.id && qd.pending[0].district === "businessbay" && qd.pending[0].building_slug === null && qd.pending[0].requested_at, "U26 the queue lists only the request with no pf_done (the finished one has dropped out)", JSON.stringify(qd));
  const tk = await call("/pf_status", { method: "POST", headers: Object.assign({ "content-type": "application/json" }, ING), body: JSON.stringify({ id: dq.id, stage: "take", result: { taken_at: new Date().toISOString(), host: "office-laptop" } }) });
  ok(tk.status === 200 && JSON.parse(store.get("pf_take_" + dq.id)).host === "office-laptop" && (await supplyStatus(env, dq.id)).state === "fetching", "U27 stage take writes pf_take_<id>; the page sees fetching");
  const dn = await call("/pf_status", { method: "POST", headers: Object.assign({ "content-type": "application/json" }, ING), body: JSON.stringify({ id: dq.id, stage: "done", result: { status: "ok", as_of: "2026-10-01", district: "businessbay", building_slug: null, image: "img_pf_supply_businessbay", seconds: 2011, note: "" } }) });
  qd = await (await call("/pf_queue", { headers: ING })).json();
  ok(dn.status === 200 && JSON.parse(store.get("pf_done_" + dq.id)).seconds === 2011 && (await supplyStatus(env, dq.id)).state === "done" && qd.pending.length === 0 && JSON.parse(store.get("pf_queue")).length === 0, "U28 stage done writes pf_done_<id>, the page sees done, and the queue drains", JSON.stringify(qd));
  const bad = await call("/pf_status", { method: "POST", headers: Object.assign({ "content-type": "application/json" }, ING), body: JSON.stringify({ id: dq.id, stage: "done", result: { status: "maybe" } }) });
  ok(bad.status === 400, "U29 a done with an unknown status is refused");
}

// ---- I: /img/ - the new data behind keys (v279) ----
{
  store.set("img_ejari_daily_dubai", store.get("img_ejari_daily_dubai") || "{}");
  store.set("img_blocks_jumeirahvillagecircle", "GLB-bytes-stand-in");
  const st = async (p, m) => (await call(p, m ? { method: m } : undefined)).status;
  ok(await st("/img/ejari_daily_dubai") === 401 && await st("/img/ejari_daily_dubai", "HEAD") === 401, "I1 no key: /img/ejari_daily_dubai is refused (401), GET and HEAD");
  const ce = await call("/img/ejari_daily_dubai?" + K(CLIENT));
  ok(ce.status === 200 && /no-store/.test(ce.headers.get("Cache-Control") || ""), "I2 a client key opens the Ejari data, and it is never shared-cached");
  ok(await st("/img/pf_supply_jumeirahvillagecircle?" + K(CLIENT)) === 404 && await st("/img/pf_supply_jumeirahvillagecircle") === 404 && await st("/img/pf_supply_jumeirahvillagecircle?" + K(CLIENT), "HEAD") === 404, "I3 a client key (or none) gets 404 on the advertised-supply data");
  ok(await st("/img/ejari_daily_dubai?" + K(READ)) === 200 && await st("/img/pf_supply_jumeirahvillagecircle?" + K(READ)) === 200, "I4 the owner opens both");
  const bl = await call("/img/blocks_jumeirahvillagecircle");
  ok(bl.status === 200 && /public/.test(bl.headers.get("Cache-Control") || ""), "I5 /img/blocks_jumeirahvillagecircle still opens keyless, as before");
}

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
