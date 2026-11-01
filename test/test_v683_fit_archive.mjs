// v683 Play: "Start a new month" archives the current window, Day 1 starts today, all-time totals, the Archive tab, the month page (src/fit.js, src/fit_page.js).
// Offline: the real worker, KV and fetch stubbed, nothing leaves this machine. Harness pattern from test_v328_fit.mjs.
// Kendall, 1 Nov 2026: "need to reset from today, but archive last month, as well need a running total, etc".
// What this pins:
//   - a reset archives the RIGHT window (cfg.start to yesterday-or-window-end) under fitc_arch_<user>, cfg.start moves to today, days/targets/windows stay
//   - a second reset the same day is a no-op that restates; entries are never deleted; the other person's keyspace is untouched
//   - all-time totals = archive + current; the Months view lists the archive first; the Archive tab reads the real days back
//   - the WhatsApp line "momo new month" / "momo reset"; the one-page month card /fit?month=YYYY-MM (archived and current); a non-owner key gets 404
//   - the export gains a "window" column; the page has the on-page confirm (no browser confirm) and no emoji
//   node test/test_v683_fit_archive.mjs
import worker from "../src/index.js";
import * as fit from "../src/fit.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + (JSON.stringify(a) === JSON.stringify(b) ? "" : "  got " + JSON.stringify(a) + " want " + JSON.stringify(b)));

const READ = "owner_admin_key_never_in_client_links_0001", CLIENT = "client_key_current_abcdefghij", HER = "971565484397", HIM = "971562276093";
const store = new Map(); let writes = [];
const KV = {
  async get(k, t) { if (!store.has(k)) return null; const v = store.get(k).v; return t === "json" ? JSON.parse(v) : v; },
  async put(k, v, o) { writes.push(k); store.set(k, { v, meta: o && o.metadata }); },
  async delete(k) { writes.push("-" + k); store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.entries()].filter(([k]) => k.startsWith(p)).map(([name, e]) => ({ name, metadata: e.meta })), list_complete: true }; },
};
let outbound = [];
globalThis.fetch = async (input, init) => {
  const u = String((input && input.url) || input), method = (init && init.method) || "GET", body = init && typeof init.body === "string" ? init.body : "";
  if (u.includes("api.anthropic.com")) return new Response(JSON.stringify({ content: [{ type: "text", text: "{}" }], stop_reason: "end_turn" }), { status: 200 });
  if (u.includes("graph.facebook.com") && method === "POST") { outbound.push(JSON.parse(body || "{}")); return new Response(JSON.stringify({ messages: [{ id: "wamid.out" + outbound.length }] }), { status: 200 }); }
  return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
};
const env = { MEETINGS: KV, READ_KEY: READ, CLIENT_KEY: CLIENT, INGEST_TOKEN: "ING", WA_FORWARD_TOKEN: "FWD", WA_ALLOWED: HER, WHATSAPP_TOKEN: "t", WA_PHONE_ID: "p",
  ANTHROPIC_API_KEY: "k", MAILBOXES: "", ADD_TO: "", PUBLIC_ORIGIN: "https://azimuth-2.digitalchemy.workers.dev", FIT_USERS: "kendall:" + HIM + ":Dr. Doli,najjuko:" + HER + ":Black Coffee" };
const ORIGIN = env.PUBLIC_ORIGIN, ctx = { waitUntil() {} };
const call = async (path, init) => { try { return await worker.fetch(new Request(ORIGIN + path, init), env, ctx); } catch (e) { return { status: "threw: " + String(e && e.message || e).slice(0, 160) }; } };
const K = (p, k) => p + (p.includes("?") ? "&" : "?") + "key=" + encodeURIComponent(k || READ);
const post = (p, o, k) => call(K(p, k), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(o) });
const jget = async (p, k) => { const r = await call(K(p, k)); return { status: r.status, j: r.status === 200 ? await r.json() : null }; };
const fitKeys = (u) => [...store.keys()].filter((k) => k.startsWith("fit_" + u + "_"));
const T = (d, h) => Date.parse(d + "T" + String(h).padStart(2, "0") + ":00:00Z");
const today = fit.gstDate(Date.now()), D = (n) => fit.addDays(today, n);
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const label = (d) => MONTHS[parseInt(d.slice(5, 7), 10) - 1] + " " + d.slice(0, 4);

// ---------- 0. the not-exercise guard ----------
console.log("not exercise");
const cfg0 = fit.fitCleanCfg({}, fit.FIT_CFG_DEFAULT);
ok(!fit.fitIsExercise("Hot air balloon") && !fit.fitIsExercise("balloon ride") && !fit.fitIsExercise("Massage") && fit.fitIsExercise("Walk") && fit.fitIsExercise("Lateral raise 3\u00d79 @ 110 kg"), "a balloon ride or a massage is not exercise; a walk and a strength set are");
eq(fit.dayStats([{ k: "ex", x: "Hot air balloon", m: 60 }], cfg0).qualifies, false, "60 minutes in a balloon does not meet the daily floor");
eq(fit.dayStats([{ k: "ex", x: "Balloon ride", m: 60 }, { k: "ex", x: "Walk", m: 20 }], cfg0).ex, 20, "only the walk counts toward the minutes");
eq(fit.weekMinutes({ "2026-10-05": [{ k: "ex", x: "Hot air balloon", m: 90 }, { k: "ex", x: "Run", m: 30 }] }, "2026-10-05").minutes, 30, "the week's minutes leave the balloon out too");

// ---------- 1. a 30-day window that ended two days ago, with a month of entries ----------
console.log("the window to archive");
const start = D(-31), end = D(-2);   // start + 29 = today - 2: the window ended before yesterday, so the archive ends at the window end
await fit.fitSaveCfg(env, fit.fitCleanCfg({ start, days: 30, weekMin: 600, goal: "Fit for the wedding" }, Object.assign({ u: "kendall" }, fit.FIT_CFG_DEFAULT)));
for (let i = 0; i < 3; i++) await fit.fitAdd(env, { u: "kendall", k: "ex", x: "Gym", m: 45, t: T(D(-31 + i), 12), d: D(-31 + i) });   // three days hit in a row
await fit.fitAdd(env, { u: "kendall", k: "ex", x: "Steps", n: 12000, t: T(D(-26), 12), d: D(-26) });   // a fourth, on steps
await fit.fitAdd(env, { u: "kendall", k: "food", x: "Chicken and rice", t: T(D(-30), 8), d: D(-30), est: { g: 30, how: "rough" } });
await fit.fitAdd(env, { u: "kendall", k: "ex", x: "Lateral raise 3\u00d79 @ 200 kg", m: 9, t: T(D(-31), 13), d: D(-31) });   // a strength line with a load that cannot be right on that move
await fit.fitAdd(env, { u: "kendall", k: "ex", x: "Hot air balloon", m: 60, t: T(D(-20), 6), d: D(-20) });   // logged as exercise; it is not
await fit.fitAdd(env, { u: "kendall", k: "food", x: "Late pizza", t: T(D(-29), 19), d: D(-29), o: 1 });
await fit.fitAdd(env, { u: "kendall", k: "w", x: "weight", v: 85, t: T(D(-31), 5), d: D(-31) });
await fit.fitAdd(env, { u: "kendall", k: "w", x: "weight", v: 83.5, t: T(D(-21), 5), d: D(-21) });
const before = fitKeys("kendall").length;
ok(before === 10, "ten entries in the window (" + before + ")");
let r = await jget("/fit_api?u=kendall");
eq([r.status, r.j.label, r.j.challenge.over, r.j.lastArchive], [200, label(start), true, null], "before the reset: the home card carries the month label, the window is over, nothing archived");

// ---------- 2. the reset ----------
console.log("start a new month");
writes = [];
r = await (await post("/fit_api?u=kendall", { op: "newmonth" })).json();
ok(r.ok && !r.same && r.archive, "newmonth answers with the archive");
const a = r.archive;
eq([a.label, a.start, a.end, a.days, a.hit, a.rest, a.minutes, a.steps, a.meals, a.out, a.bestStreak], [label(start), start, end, 30, 4, 0, 144, 12000, 2, 1, 3], "the archived record: the right window (start to the window end), 4 of 30 hit, 144 min (the balloon ride counts for nothing), 12,000 steps, 2 meals (1 outside), best streak 3");
ok(!JSON.stringify(a).includes("Chicken") && !JSON.stringify(a).includes("pizza"), "the archive record is counts only: no meal text");
eq([a.measures.weight.first, a.measures.weight.last, a.measures.weight.change, a.measures.weight.unit], [85, 83.5, -1.5, "kg"], "weight first/last/change frozen in the record");
ok(a.weeksDone >= 3 && typeof a.weeksMet === "number" && a.archivedOn === today, "weeks done/met counted, archived today");
ok(/Day 1 of 30 starts today/.test(r.text) && r.text.indexOf(label(start) + " archived") === 0, "the reply: the archived month's summary then 'Day 1 of 30 starts today'");
ok(store.has("fitc_arch_kendall") && JSON.parse(store.get("fitc_arch_kendall").v).length === 1, "fitc_arch_kendall holds one record");
ok(!store.has("fitc_arch_najjuko"), "nothing written under the other person");
let cfg = await fit.fitCfg(env, "kendall");
eq([cfg.start, cfg.days, cfg.weekMin, cfg.goal, cfg.windows.length], [today, 30, 600, "Fit for the wedding", 3], "cfg.start is today; days, target, goal and windows untouched");
ok(fitKeys("kendall").length === before, "no entry deleted");
r = await jget("/fit_api?u=kendall");
eq([r.j.challenge.day, r.j.challenge.hit, r.j.label, r.j.lastArchive && r.j.lastArchive.label], [1, 0, label(today), label(start)], "home card: Day 1, nothing hit yet, this month's label, the archived month shown on the first day");

console.log("a second reset the same day");
writes = [];
r = await (await post("/fit_api?u=kendall", { op: "newmonth" })).json();
ok(r.ok && r.same && r.archive && r.archive.label === label(start), "same day: restates the archive, same: true");
ok(/Already on Day 1 of 30 today/.test(r.text), "the reply says it is already Day 1");
ok(JSON.parse(store.get("fitc_arch_kendall").v).length === 1 && !writes.includes("fitc_arch_kendall"), "the archive list is not appended to");
eq((await fit.fitCfg(env, "kendall")).start, today, "cfg.start still today");

// ---------- 3. running totals ----------
console.log("all time");
await fit.fitAdd(env, { u: "kendall", k: "ex", x: "Run", m: 40, t: Date.now(), d: today });
r = await jget("/fit_api?view=history&u=kendall");
const h = r.j, t = h.totals, at = h.allTime;
eq([t.days, t.hit, t.minutes, t.from, t.to], [1, 1, 40, today, today], "This month: 1 of 1 hit, 40 min, from today");
eq([at.days, at.hit, at.minutes, at.steps, at.bestStreak, at.months, at.meals, at.out], [31, 5, 184, 12000, 3, 1, 2, 1], "All time = archive + current: 31 days, 5 hit, 184 min, 12,000 steps, best streak ever 3, 1 month completed");
ok(h.archives.length === 1 && h.archives[0].label === label(start), "the history carries the archive list");
ok(h.months[0].archived === true && h.months[0].label === label(start) && h.months[h.months.length - 1].archived === undefined, "Months: the archived month first, marked archived, then the current one");
eq(h.label, label(today), "the history names this month");
ok(h.days.length === 1 && h.days[0].d === today, "Days view stays on the current window");

console.log("the archive's days are still readable");
r = await jget("/fit_api?view=history&u=kendall&from=" + start + "&to=" + end);
ok(r.status === 200 && r.j.days.length === 30 && r.j.days[0].d === start && r.j.days[29].d === end, "a from/to read gives the 30 archived days");
eq([r.j.days[0].ex, r.j.days[0].ok, r.j.days[5].steps, r.j.totals.hit, r.j.totals.minutes], [54, true, 12000, 4, 144], "the real entries are read back for the archived window");
ok(!("archives" in r.j) && !("allTime" in r.j) && !("detail" in r.j), "a frozen-window read carries no all-time layer and no meal detail");

// ---------- 4. the month page: light Momo Work style, the person's own detail; side by side only when BOTH share ----------
console.log("the month page");
let p = await call(K("/fit?month=" + start.slice(0, 7) + "&u=kendall"));
let html = await p.text();
ok(p.status === 200 && html.includes("<h1 class=\"ft\">" + label(start) + "</h1>") && /ARCHIVED/.test(html), "/fit?month=<archived> renders the archived month");
ok(/--bg:#FAF7F1/.test(html) && /--ink:#1C2321/.test(html) && /--teal:#0A4F4A/.test(html) && /--gold:#B8924F/.test(html) && /--hit:#2F8F5B/.test(html) && /color-scheme:light/.test(html) && !/#0C1413/.test(html), "the LIGHT Momo Work palette: cream ground, ink, teal, gold, green for days hit - none of Play's dark ground");
ok(/<span>4<small>of 30<\/small><\/span>/.test(html) && /13% of days hit/.test(html) && /Best streak 3 days/.test(html), "the ring: 4 of 30, 13%, best streak 3");
ok((html.match(/class="c hit"/g) || []).length === 4 && (html.match(/class="c (hit|miss|rest)"/g) || []).length === 30, "the calendar strip: 30 cells, 4 of them hit");
ok(/2h24<\/div><div class="tl">Exercise<\/div><div class="ts">12,000 steps/.test(html) && /85 to 83.5 kg \(-1.5\)/.test(html) && /2<\/div><div class="tl">Meals logged<\/div><div class="ts">1 outside the eating windows \(50%\)/.test(html), "the tiles: minutes with steps, weight first to last, meals with the outside share");
ok(/<h2>Week by week<\/h2>/.test(html) && (html.match(/class="wk"/g) || []).length >= 5 && /<h2>Best days<\/h2>/.test(html) && /54 min/.test(html), "the week strip (5 weeks, bar against the week's own target) and the best days");
console.log("the person's own detail");
ok(/<h2>Exercise mix<\/h2>/.test(html) && /Weight training<\/span>.*2h15 &middot; 3</.test(html) && /Strength sets<\/span>.*9 min &middot; 1</.test(html), "the exercise mix by type with minutes and sessions");
ok(/<td>Lateral raise<\/td><td class="n">3 &times; 9<\/td><td class="n">200 kg <span class="flag">check the weight/.test(html), "the strength table: day, exercise, sets x reps, load - and 200 kg on a lateral raise is flagged, not changed");
ok(/Check the weights: Lateral raise 200 kg/.test(html) && />1<\/div><div class="tl">Strength days/.test(html), "the check-the-weight note and one strength day");
ok(/Left out of exercise: Hot air balloon on/.test(html), "the balloon ride is named as left out");
ok(/Meals logged \(water left out\)/.test(html) && /1 a day on 2 days/.test(html), "meals per day");
ok(/<h2>When you ate<\/h2>/.test(html) && /Lunch<\/span>.*>1</.test(html) && !/Breakfast<\/span>/.test(html) && /Outside the windows<\/span>.*>1</.test(html) && /outside your windows came at 23:00 \(1\)/.test(html), "meals by eating window from the entry time (08:00 UTC is 12:00 Dubai: Lunch), and the out-of-window hour");
ok(/30 g<\/div><div class="tl">Protein a day, rough<\/div><div class="ts">best day 30 g on/.test(html) && /<h2>Highest-protein meals<\/h2>/.test(html) && /Chicken and rice <small>/.test(html) && /<b>30 g<\/b>/.test(html), "protein average, best day and the highest-protein meals with their line");
ok(!/Late pizza/.test(html), "a meal with no estimate is not in the protein list");
ok(/Dr\. Doli/.test(html) && !/Black Coffee/.test(html) && (html.match(/<section class="p">/g) || []).length === 1 && /class="one"/.test(html), "one column: his own; nothing of the other person (sharing is off)");
p = await call(K("/fit?month=" + today.slice(0, 7) + "&u=kendall")); html = await p.text();
ok(p.status === 200 && html.includes(label(today)) && /THIS MONTH/.test(html) && /<span>1<small>of 1<\/small><\/span>/.test(html), "/fit?month=<current> renders the current window");
eq([(await call("/fit?month=" + start.slice(0, 7))).status, (await call(K("/fit?month=" + start.slice(0, 7), CLIENT))).status, (await call(K("/fit?month=" + start.slice(0, 7), "wrong_key_value_0000000000"))).status], [404, 404, 404], "no key, the client key, a wrong key: 404");
eq([(await call(K("/fit?month=2026-13"))).status, (await call(K("/fit?month=2099-01"))).status], [404, 404], "a bad month and a future month: 404");

console.log("side by side only when both share");
await fit.fitSaveCfg(env, fit.fitCleanCfg({ start: D(-31), days: 30 }, Object.assign({ u: "najjuko" }, fit.FIT_CFG_DEFAULT)));
await fit.fitAdd(env, { u: "najjuko", k: "ex", x: "Walk", m: 35, t: T(D(-30), 12), d: D(-30) });
await fit.fitAdd(env, { u: "najjuko", k: "food", x: "Grilled fish and salad", t: T(D(-30), 8), d: D(-30), est: { g: 28, how: "rough" } });
await fit.fitSetShare(env, "kendall", true);
p = await call(K("/fit?month=" + start.slice(0, 7) + "&u=kendall")); html = await p.text();
ok((html.match(/<section class="p">/g) || []).length === 1 && !/Black Coffee|Grilled fish/.test(html), "he shares, she does not: his column only, nothing of hers");
await fit.fitSetShare(env, "najjuko", true);
p = await call(K("/fit?month=" + start.slice(0, 7) + "&u=kendall")); html = await p.text();
ok((html.match(/<section class="p">/g) || []).length === 2 && /class="two"/.test(html) && /Dr\. Doli and Black Coffee, side by side/.test(html), "both share: two columns side by side");
ok(/Grilled fish and salad <small>/.test(html) && /Chicken and rice <small>/.test(html) && (html.match(/<h2>Highest-protein meals<\/h2>/g) || []).length === 2 && (html.match(/<h2>Strength sets<\/h2>/g) || []).length === 2, "both in full detail: her meals and his, two strength tables, two protein lists");
p = await call(K("/fit?month=" + start.slice(0, 7) + "&u=najjuko")); html = await p.text();
ok(/Black Coffee and Dr\. Doli, side by side/.test(html) && (html.match(/<section class="p">/g) || []).length === 2, "from her link the same page, her column first");
await fit.fitSetShare(env, "kendall", false);
p = await call(K("/fit?month=" + start.slice(0, 7) + "&u=najjuko")); html = await p.text();
ok((html.match(/<section class="p">/g) || []).length === 1 && !/Dr\. Doli|Chicken and rice/.test(html), "he switches sharing off: her page is hers alone again");
await fit.fitSetShare(env, "najjuko", false);
ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(html), "no emoji on the month page");

// ---------- 5. the export ----------
console.log("the export");
p = await call(K("/fit_api?view=csv&u=kendall")); const csv = await p.text(), rows = csv.trim().split("\n");
ok(rows[0].endsWith(",window") && rows.length === 12, "the spreadsheet has a window column and every entry, archived ones included");
ok(rows.slice(1, 11).every((x) => x.endsWith("," + label(start))) && rows[11].endsWith("," + label(today)), "each row names the window it fell in");

// ---------- 6. the page ----------
console.log("the page");
p = await call(K("/fit")); html = await p.text();
ok(p.status === 200 && /id="nm">Start a new month</.test(html) && /id="nmc"/.test(html), "the plan has the Start a new month button and its on-page confirm box");
const nmBlock = html.slice(html.indexOf("$('nm').onclick"), html.indexOf("var HV="));
ok(nmBlock.length > 100 && !/confirm\(/.test(nmBlock) && /Yes, start a new month/.test(nmBlock) && /Not now/.test(nmBlock), "the confirm step is on the page, never a browser confirm()");
ok(/\['archive','Archive'\]/.test(html) && /HV==='archive'/.test(html) && /allTime/.test(html), "a fifth history tab, Archive, and the all-time tiles");
ok(/\/fit\?month=/.test(html), "the Archive card links to the month page");
ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(html), "no emoji in the page source");
ok(!/\$\{|undefined/.test(html.replace(/<script>[\s\S]*?<\/script>/, "")), "no template leftovers");

// ---------- 7. WhatsApp ----------
console.log("whatsapp");
let n = 0; const wa = async (msg, from) => { n++; return call("/wa", { method: "POST", headers: { "Content-Type": "application/json", "X-Azimuth-Forward": "FWD" }, body: JSON.stringify({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: "p" }, messages: [Object.assign({ from: from || HER, id: "wamid.in" + n, timestamp: String(Math.floor(Date.now() / 1000)) }, msg)] } }] }] }) }); };
const text = (b, from) => wa({ type: "text", text: { body: b } }, from);
const said = () => { const o = outbound[outbound.length - 1]; return o ? (o.text && o.text.body) || (o.interactive && o.interactive.body && o.interactive.body.text) || "" : ""; };
await fit.fitSaveCfg(env, fit.fitCleanCfg({ start: D(-10), days: 30 }, Object.assign({ u: "najjuko" }, fit.FIT_CFG_DEFAULT)));
await fit.fitAdd(env, { u: "najjuko", k: "ex", x: "Walk", m: 35, t: T(D(-9), 12), d: D(-9) });
outbound = [];
await text("momo new month");
ok(/Day 1 of 30 starts today/.test(said()) && said().indexOf(label(D(-10)) + " archived") === 0 && /1 of 10/.test(said()), "\"momo new month\": her window (10 days, 1 hit) is archived and Day 1 starts today");
const na = JSON.parse(store.get("fitc_arch_najjuko").v);
eq([na.length, na[0].start, na[0].end, na[0].days, na[0].hit, na[0].minutes], [1, D(-10), D(-1), 10, 1, 35], "fitc_arch_najjuko: her own record, start to yesterday");
eq((await fit.fitCfg(env, "najjuko")).start, today, "her cfg.start is today");
ok(JSON.parse(store.get("fitc_arch_kendall").v).length === 1, "his archive untouched by her reset");
await text("momo reset");
ok(/Already on Day 1 of 30 today/.test(said()) && na.length === 1, "\"momo reset\" the same day restates");
await text("momo help"); ok(/momo new month/.test(said()), "momo help lists the command");
r = await jget("/fit_api?u=najjuko");
ok(r.j.lastArchive && r.j.lastArchive.label === label(D(-10)) && r.j.label === label(today), "her home card shows her archived month and this month's label");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
