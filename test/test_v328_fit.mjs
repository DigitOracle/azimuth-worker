// v328 FIT - food and exercise log (src/fit.js). Offline: the real worker, KV and fetch stubbed, nothing leaves this machine.
// What this pins, and why each is here:
//   - OWNER ONLY: a client key, no key or a wrong key gets 404 on /fit and /fit_api and nothing is written; the FIT tab is stripped from a client page.
//   - PHOTOS ARE NEVER STORED: a meal photo is read and dropped; no stored value contains the image bytes.
//   - the plan's arithmetic: weekly target, daily floor (workout minutes OR steps), eating windows, 30-day count, extend.
//   - WhatsApp: "food:", "gym 45 min", "10k steps", the follow-up "how long?", Undo, and that a plan or meeting ("lunch with Sara Friday")
//     is NOT logged and never even reaches the model when it has no food or exercise word in it.
//   - the evening verdict goes out once, only while the 24-hour window is open, and a closed window does not use up the day.
//   node test/test_v328_fit.mjs
import worker from "../src/index.js";
import * as fit from "../src/fit.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };
const eq = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m + (JSON.stringify(a) === JSON.stringify(b) ? "" : "  got " + JSON.stringify(a) + " want " + JSON.stringify(b)));

// ---------- 1. the pure parts ----------
console.log("parsing");
eq(fit.parseDuration("45 min"), 45, "45 min");
eq(fit.parseDuration("1h30"), 90, "1h30");
eq(fit.parseDuration("1.5 hours"), 90, "1.5 hours");
eq(fit.parseDuration("1 hour 20 minutes"), 80, "1 hour 20 minutes");
eq(fit.parseDuration("ran 5k in 30 min"), 30, "5k in 30 min is 30 minutes, not 5");
eq(fit.parseDuration("half an hour"), 30, "half an hour");
eq(fit.parseDuration("padel with Sam"), null, "no duration -> null");
eq(fit.parseSteps("10,000 steps"), 10000, "10,000 steps");
eq(fit.parseSteps("10k steps today"), 10000, "10k steps");
eq(fit.parseSteps("8.5k steps"), 8500, "8.5k steps");
eq(fit.parseSteps("walked 12000 steps"), 12000, "12000 steps");
eq(fit.quickExercise("gym 45 min"), { type: "Gym", minutes: 45, steps: 0 }, "gym 45 min");
eq(fit.quickExercise("went for a run, 40 mins"), { type: "Run", minutes: 40, steps: 0 }, "run 40 mins");
eq(fit.quickExercise("lunch with Sara"), null, "a lunch plan is not exercise");
ok(fit.fitCaptionIsFood("lunch") && fit.fitCaptionIsFood("Food: noodles") && !fit.fitCaptionIsFood("this is me"), "photo captions that claim a photo for FIT");
ok(!fit.fitLooksRelevant("call the bank tomorrow") && fit.fitLooksRelevant("had a salad") && !fit.fitLooksRelevant("did I eat today?"), "only food or exercise words reach the model, and not questions");
eq(fit.fmtMin(45), "45 min", "fmtMin 45"); eq(fit.fmtMin(90), "1h30", "fmtMin 90"); eq(fit.fmtMin(600), "10h", "fmtMin 600");

console.log("the plan");
const cfg = fit.fitCleanCfg({}, fit.FIT_CFG_DEFAULT);
eq([cfg.days, cfg.weekMin, cfg.minDay, cfg.stepsFloor, cfg.tone], [30, 600, 30, 10000, "firm"], "defaults: 30 days, 10 hours a week, 30 min or 10,000 steps, firm");
const bad = fit.fitCleanCfg({ days: -4, weekMin: "abc", tone: "mean", start: "yesterday", windows: [{ n: "x", a: "09:00", b: "06:00" }, { n: "ok", a: "06:00", b: "09:00" }] }, cfg);
eq([bad.days, bad.weekMin, bad.tone, bad.start, bad.windows.length], [30, 600, "firm", "", 1], "bad input is refused field by field; a window that ends before it starts is dropped");
const T = (iso) => Date.parse(iso);
eq(fit.gstDate(T("2026-10-04T20:30:00Z")), "2026-10-05", "GST date rolls over at 20:00 UTC");
eq(fit.weekStart("2026-10-04"), "2026-09-28", "week starts Monday (4 Oct 2026 is a Sunday)");
eq(fit.windowFor(cfg, T("2026-10-04T04:00:00Z")).out, false, "08:00 GST is inside Breakfast");
eq(fit.windowFor(cfg, T("2026-10-04T06:30:00Z")).out, true, "10:30 GST is outside every window");
eq(fit.windowFor(cfg, T("2026-10-04T09:00:00Z")).name, "Lunch", "13:00 GST is Lunch");
eq([fit.windowFor(cfg, T("2026-10-04T14:30:00Z")).name, fit.windowFor(cfg, T("2026-10-04T11:00:00Z")).out, fit.windowFor(cfg, T("2026-10-04T17:00:00Z")).out], ["Evening", true, true], "18:30 GST is Evening (17:00-21:00); 15:00 and 21:00 are outside");
eq(cfg.windows.map((w) => w.n + w.a + w.b), ["Breakfast06:0009:00", "Lunch11:0014:00", "Evening17:0021:00"], "the three default windows");
const ex = (m, n) => ({ k: "ex", x: m ? "Gym" : "Steps", m: m || 0, n: n || 0 });
eq(fit.dayStats([ex(20)], cfg).qualifies, false, "20 minutes is under the floor");
eq(fit.dayStats([ex(20), ex(15)], cfg).qualifies, true, "two sessions add up to the floor");
eq(fit.dayStats([ex(0, 9999)], cfg).qualifies, false, "9,999 steps is not 10,000");
eq(fit.dayStats([ex(0, 10000)], cfg).qualifies, true, "10,000 steps is the no-excuse option");
eq(fit.dayStats([{ k: "food", x: "a", o: 1 }, { k: "food", x: "b" }], cfg), { meals: 2, out: 1, ex: 0, steps: 0, qualifies: false }, "meals and outside-window count");
const by = { "2026-09-28": [ex(60)], "2026-09-29": [ex(0, 10000), ex(30)], "2026-10-04": [ex(45)] };
eq(fit.weekMinutes(by, "2026-10-04").minutes, 135, "week minutes count exercise only, never steps");
const chal = fit.challengeStats({ "2026-10-01": [ex(40)], "2026-10-02": [ex(40)], "2026-10-04": [ex(0, 11000)] }, Object.assign({}, cfg, { start: "2026-10-01" }), "2026-10-04");
eq([chal.day, chal.hit, chal.streak, chal.done], [4, 3, 1, false], "day 4, 3 days hit, a missed day (3 Oct) resets the streak to 1");
const open = fit.challengeStats({ "2026-10-01": [ex(40)], "2026-10-02": [ex(40)], "2026-10-03": [ex(40)] }, Object.assign({}, cfg, { start: "2026-10-01" }), "2026-10-04");
eq(open.streak, 3, "today not yet won does not break yesterday's streak");

// ---------- 2. through the real worker ----------
const READ = "owner_admin_key_never_in_client_links_0001", CLIENT = "client_key_current_abcdefghij", HER = "971565484397";
const store = new Map(); let writes = [];
const KV = {
  async get(k, t) { if (!store.has(k)) return null; const v = store.get(k).v; return t === "json" ? JSON.parse(v) : v; },
  async put(k, v, o) { writes.push(k); store.set(k, { v: typeof v === "string" ? v : v, meta: o && o.metadata }); },
  async delete(k) { writes.push("-" + k); store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.entries()].filter(([k]) => k.startsWith(p)).map(([name, e]) => ({ name, metadata: e.meta })), list_complete: true }; },
};
const MARK = "PNGBYTES-MARKER-7f3a9c"; let outbound = [], aiCalls = [], aiAnswer = () => ({}), mediaBytes = new TextEncoder().encode(MARK + "x".repeat(2000));
globalThis.fetch = async (input, init) => {
  const u = String((input && input.url) || input), method = (init && init.method) || "GET", body = init && typeof init.body === "string" ? init.body : "";
  if (u.includes("api.anthropic.com")) {
    const j = JSON.parse(body), sys = String(j.system || ""), user = typeof j.messages[0].content === "string" ? j.messages[0].content : (j.messages[0].content.find((b) => b.type === "text") || {}).text || "";
    aiCalls.push({ sys, user });
    return new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify(aiAnswer(sys, user)) }], stop_reason: "end_turn" }), { status: 200 });
  }
  if (u.includes("graph.facebook.com") && method === "POST") { outbound.push(JSON.parse(body || "{}")); return new Response(JSON.stringify({ messages: [{ id: "wamid.out" + outbound.length }] }), { status: 200 }); }
  if (u.includes("graph.facebook.com")) return new Response(JSON.stringify({ url: "https://media.test/m1", mime_type: "image/jpeg" }), { status: 200 });
  if (u.includes("media.test")) return new Response(mediaBytes, { status: 200, headers: { "Content-Type": "image/jpeg" } });
  return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
};
const env = { MEETINGS: KV, READ_KEY: READ, CLIENT_KEY: CLIENT, INGEST_TOKEN: "ING", WA_FORWARD_TOKEN: "FWD", WA_ALLOWED: HER, WHATSAPP_TOKEN: "t", WA_PHONE_ID: "p",
  ANTHROPIC_API_KEY: "k", MAILBOXES: "", ADD_TO: "", PUBLIC_ORIGIN: "https://azimuth-2.digitalchemy.workers.dev" };
const ORIGIN = env.PUBLIC_ORIGIN, ctx = { waitUntil() {} };
const call = async (path, init) => { try { return await worker.fetch(new Request(ORIGIN + path, init), env, ctx); } catch (e) { return { status: "threw: " + String(e && e.message || e).slice(0, 120) }; } };
const K = (p, k) => p + (p.includes("?") ? "&" : "?") + "key=" + encodeURIComponent(k || READ);
const post = (p, o, k) => call(K(p, k), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(o) });
const jget = async (p, k) => { const r = await call(K(p, k)); return { status: r.status, j: r.status === 200 ? await r.json() : null }; };
const fitKeys = () => [...store.keys()].filter((k) => k.startsWith("fit_") && !k.startsWith("fitc_"));
const today = fit.gstDate(Date.now());

console.log("owner only");
for (const [label, k] of [["no key", ""], ["a wrong key", "wrong_key_value_0000000000"], ["the client key", CLIENT]]) {
  writes = [];
  const g = await call("/fit_api" + (k ? "?key=" + k : "")), p = await call("/fit" + (k ? "?key=" + k : "")), w = await call("/fit_api" + (k ? "?key=" + k : ""), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "add", kind: "food", text: "secret" }) });
  ok(g.status === 404 && p.status === 404 && w.status === 404, label + ": /fit, /fit_api GET and POST all 404");
  ok(writes.length === 0 && fitKeys().length === 0, label + ": nothing written");
}
const start = await (await call(K("/start"))).text(), startC = await (await call(K("/start", CLIENT))).text();
ok(/href="\/fit\?key=/.test(start), "the owner's bottom bar has the FIT tab");
ok(!/href="\/fit\b/.test(startC), "a client link has no FIT tab");

console.log("the page and the log");
const page = await call(K("/fit")); const html = await page.text();
ok(page.status === 200 && /<title>Momo<\/title>/.test(html) && /class=nnav/.test(html) && /class=on href="\/fit\?key=/.test(html), "/fit renders with the bottom bar and FIT highlighted");
ok(!/\$\{|undefined/.test(html.replace(/<script>[\s\S]*?<\/script>/, "")), "no template leftovers in the page");
let r = await jget("/fit_api");
eq([r.status, r.j.entries.length, r.j.challenge], [200, 0, null], "empty: no entries, challenge not started");
r = await (await post("/fit_api", { op: "add", kind: "food", text: "Oats with berries" })).json();
ok(r.ok && r.entry.k === "food" && r.entry.d === today, "add food");
ok((await jget("/fit_api")).j.challenge.day === 1, "the first log starts the 30 days");
r = await (await post("/fit_api", { op: "add", kind: "ex", text: "Gym", minutes: 50 })).json();
ok(r.ok && r.entry.m === 50, "add exercise 50 min");
r = await (await post("/fit_api", { op: "add", kind: "ex", text: "Steps", steps: 10000 })).json();
ok(r.ok && r.entry.n === 10000 && r.entry.x === "Steps", "add steps");
eq([(await post("/fit_api", { op: "add", kind: "food", text: "" })).status, (await post("/fit_api", { op: "add", kind: "ex", text: "Run" })).status, (await post("/fit_api", { op: "add", kind: "ex", text: "Run", minutes: 5000 })).status], [400, 400, 400], "empty text, no number, 5000 minutes are all refused");
r = await jget("/fit_api");
eq([r.j.entries.length, r.j.stats.meals, r.j.stats.ex, r.j.stats.steps, r.j.stats.qualifies, r.j.week.minutes], [3, 1, 50, 10000, true, 50], "the day adds up");
const food = r.j.entries.find((e) => e.k === "food");
r = await (await post("/fit_api", { op: "edit", id: food.id, text: "Oats and banana" })).json();
ok(r.ok && r.entry.x === "Oats and banana", "edit a meal");
ok((await (await post("/fit_api", { op: "del", id: food.id })).json()).ok && (await jget("/fit_api")).j.stats.meals === 0, "delete a meal");
ok(!(await (await post("/fit_api", { op: "del", id: "../../etc" })).json()).ok, "a made-up id is refused, not passed to KV");
const yday = fit.addDays(today, -1);
await post("/fit_api", { op: "add", kind: "ex", text: "Walk", minutes: 20, d: yday });
r = await jget("/fit_api?d=" + yday);
eq([r.j.d, r.j.entries.length, r.j.stats.qualifies], [yday, 1, false], "yesterday is its own day; 20 min misses the floor");
ok((await jget("/fit_api?d=2099-01-01")).j.d === today, "a future day falls back to today");
r = await (await post("/fit_api", { op: "cfg", cfg: { goal: "Fit for the wedding", weekMin: 480, tone: "brutal", windows: [{ n: "Lunch", a: "11:00", b: "13:00" }] } })).json();
eq([r.cfg.goal, r.cfg.weekMin, r.cfg.tone, r.cfg.windows.length, r.cfg.days], ["Fit for the wedding", 480, "brutal", 1, 30], "the plan saves");
eq((await (await post("/fit_api", { op: "extend" })).json()).cfg.days, 60, "extend adds 30 days");

console.log("web photo: read once, nothing kept");
store.clear(); writes = [];
aiAnswer = () => ({ meal: "Grilled salmon with rice and greens" });
let pr = await (await call(K("/fit_api?op=photo"), { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: mediaBytes })).json();
ok(pr.ok && /salmon/.test(pr.meal), "the photo comes back as a description");
ok(![...store.values()].some((e) => String(e.v).includes(MARK)) && writes.length === 0, "nothing was stored for it - not the bytes, not a key");
eq((await call(K("/fit_api?op=photo"), { method: "POST", headers: { "Content-Type": "text/plain" }, body: "x" })).status, 415, "a non-image is refused");

// ---------- 3. WhatsApp ----------
console.log("whatsapp");
store.clear(); writes = [];
let n = 0; const wa = async (msg) => { n++; return call("/wa", { method: "POST", headers: { "Content-Type": "application/json", "X-Azimuth-Forward": "FWD" }, body: JSON.stringify({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: "p" }, messages: [Object.assign({ from: HER, id: "wamid.in" + n, timestamp: String(Math.floor(Date.now() / 1000)) }, msg)] } }] }] }) }); };
const text = (b) => wa({ type: "text", text: { body: b } });
const said = () => { const o = outbound[outbound.length - 1]; return o ? (o.text && o.text.body) || (o.interactive && o.interactive.body && o.interactive.body.text) || "" : ""; };
const btns = () => { const o = outbound[outbound.length - 1]; return o && o.interactive && o.interactive.action && o.interactive.action.buttons ? o.interactive.action.buttons.map((b) => b.reply.id) : []; };
const classifier = (map) => (sys, u) => (/log food and exercise/.test(sys) ? (map[u] || { kind: "other", text: null, type: null, minutes: null, steps: null, day_offset: 0 }) : {});

outbound = []; aiCalls = [];
await text("food: grilled chicken and rice");
ok(/Logged - grilled chicken and rice/.test(said()) && aiCalls.length === 0, "\"food: ...\" logs with no model call");
ok(btns().some((b) => b.startsWith("fit:undo:")), "the reply carries an Undo button");
ok(fitKeys().length === 1, "one entry stored");
const undoId = btns()[0];
await wa({ type: "interactive", interactive: { type: "button_reply", button_reply: { id: undoId, title: "Undo" } } });
ok(fitKeys().length === 0 && /Removed/.test(said()), "Undo removes it");

aiAnswer = classifier({ "ran 5k in 30 min": { kind: "exercise", text: null, type: "Run", minutes: 30, steps: null, day_offset: 0 }, "gym": { kind: "exercise", text: null, type: "Gym", minutes: null, steps: null, day_offset: 0 },
  "had a salad for lunch yesterday": { kind: "food", text: "Salad", type: null, minutes: null, steps: null, day_offset: -1 }, "lunch with Sara on Friday at 1pm": { kind: "other", text: null, type: null, minutes: null, steps: null, day_offset: 0 } });
await text("ran 5k in 30 min");
ok(/Logged - Run · 30 min/.test(said()) && /Still needed|Daily minimum done/.test(said()), "free text: a run, 30 minutes, with where the day stands");
ok(/Daily minimum done/.test(said()) && /✅/.test(said()), "30 minutes meets the floor: congratulated at once");
await text("gym");
ok(/How long was the gym/.test(said()), "no duration -> it asks");
await text("45 min");
ok(/Logged - Gym · 45 min/.test(said()) && !/Today's minimum|Minimum done|Floor cleared/.test(said().split("Challenge")[1] || ""), "the answer logs it, and the day-done cheer is not repeated");
await text("had a salad for lunch yesterday");
ok(/\(yesterday\)/.test(said()) && fitKeys().some((k) => k.includes(fit.addDays(today, -1))), "\"yesterday\" files it on yesterday");
await text("10k steps");
ok(/10,000 steps/.test(said()), "steps logged");
const before = fitKeys().length; aiCalls = [];
await text("lunch with Sara on Friday at 1pm");
ok(fitKeys().length === before, "a lunch PLAN is not logged");
aiCalls = []; await text("call the bank tomorrow about the mortgage");
ok(!aiCalls.some((c) => /log food and exercise/.test(c.sys)), "an ordinary task never reaches the FIT model");
await text("fit");
ok(/📊 Today/.test(said()) && /Week:/.test(said()) && !/key=/.test(said()), "\"fit\" answers with the day, and carries no key");
await text("fit goal: Fit for the wedding in March");
ok(/Goal set/.test(said()), "set the end goal by WhatsApp");
await text("fit target 8");
ok(/Target for (this|next) week.*: 8h/.test(said()), "set the weekly target by WhatsApp");

console.log("whatsapp photos");
store.clear(); writes = []; outbound = [];
aiAnswer = (sys) => (/read a photo someone sent to log what they ate/.test(sys) ? { meal: "Chicken shawarma plate with salad" } : /reading a photo or screenshot/.test(sys) ? { kind: "meal", summary: "A plate of food", meal: "Chicken shawarma plate with salad", meeting: null, tasks: [] } : {});
await wa({ type: "image", image: { id: "mid1", mime_type: "image/jpeg", caption: "lunch" } });
ok(/Logged - Chicken shawarma plate with salad/.test(said()) && fitKeys().length === 1, "a photo captioned \"lunch\" is logged from what the model sees");
await wa({ type: "image", image: { id: "mid2", mime_type: "image/jpeg" } });
ok(/Logged - Chicken shawarma plate with salad/.test(said()) && fitKeys().length === 2, "a photo with no caption that the reader calls a meal is logged");
ok(![...store.values()].some((e) => String(e.v).includes(MARK)), "NO stored value contains the image bytes");
aiAnswer = (sys) => (/reading a photo or screenshot/.test(sys) ? { kind: "nothing", summary: "A selfie", meal: null, meeting: null, tasks: [] } : {});
const k2 = fitKeys().length; await wa({ type: "image", image: { id: "mid3", mime_type: "image/jpeg" } });
ok(fitKeys().length === k2, "a photo that is not food is not logged");

console.log("the evening verdict");
const E = (iso, e2) => fit.fitEvening(e2 || env, { waSend: async (en, to, b) => outbound.push({ text: { body: b } }), waSendButtons: async (en, to, b, bt) => outbound.push({ interactive: { body: { text: b }, action: { buttons: bt.map((x) => ({ reply: x })) } } }), ownerWindowOpen: async () => store.has("wa_owner_last_in") }, T(iso));
store.clear(); outbound = [];
await fit.fitSaveCfg(env, fit.fitCleanCfg({ start: "2026-10-03", tone: "firm", goal: "x" }, fit.FIT_CFG_DEFAULT));
ok(!(await E("2026-10-04T10:00:00Z")), "nothing before 21:00 GST");
ok(!(await E("2026-10-04T17:05:00Z")) && outbound.length === 0, "window closed: nothing is sent...");
store.set("wa_owner_last_in", { v: new Date().toISOString() });
ok(await E("2026-10-04T17:05:00Z"), "...and the same evening still goes out once the window is open (the day was not used up)");
ok(/🔴 Day 2 of 30/.test(said()) && /You missed today/.test(said()) && /10,000 steps/.test(said()), "a missed day: red, firm, names the 10,000-step option");
ok(!(await E("2026-10-04T17:10:00Z")), "only once per day");
await fit.fitAdd(env, { k: "ex", x: "Gym", m: 60, t: T("2026-10-05T12:00:00Z"), d: "2026-10-05" });
await fit.fitAdd(env, { k: "food", x: "Pizza", t: T("2026-10-05T07:00:00Z"), d: "2026-10-05", o: true });
ok(await E("2026-10-05T17:05:00Z") && /🟡/.test(said()) && /1 meal outside/.test(said()), "exercise done but a meal outside its window: yellow, half a win");
await fit.fitSaveCfg(env, fit.fitCleanCfg({ tone: "brutal" }, await fit.fitCfg(env)));
await fit.fitAdd(env, { k: "food", x: "Eggs", t: T("2026-10-06T04:00:00Z"), d: "2026-10-06" });
ok(await E("2026-10-06T17:05:00Z") && /🔴/.test(said()) && /heavier and slower/.test(said()) && !/horrible person/i.test(said()), "brutal tone: blunt about the consequence, never about who the person is");
await fit.fitAdd(env, { k: "ex", x: "Walk", m: 40, t: T("2026-10-07T12:00:00Z"), d: "2026-10-07" });
await fit.fitAdd(env, { k: "food", x: "Eggs", t: T("2026-10-07T04:00:00Z"), d: "2026-10-07" });
ok(await E("2026-10-07T17:05:00Z") && /🟢/.test(said()), "a clean day: green");
await fit.fitSaveCfg(env, fit.fitCleanCfg({ start: "2026-09-02", days: 30 }, await fit.fitCfg(env)));
await fit.fitAdd(env, { k: "ex", x: "Gym", m: 60, t: T("2026-10-01T12:00:00Z"), d: "2026-10-01" });
ok(await E("2026-10-01T17:05:00Z") && /Extend/.test(JSON.stringify(outbound[outbound.length - 1])), "the last day of the challenge offers Extend");
await wa({ type: "interactive", interactive: { type: "button_reply", button_reply: { id: "fit:extend", title: "Extend" } } });
eq((await fit.fitCfg(env)).days, 60, "tapping Extend adds 30 days");

console.log("the weekly target is set on Sunday");
store.clear(); outbound = [];
const kv2 = { MEETINGS: KV };
const c0 = await fit.fitCfg(kv2);
const sun = "2026-10-04", wed = "2026-10-07";   // 4 Oct 2026 is a Sunday
let tr = await fit.fitSetWeekTarget(kv2, Object.assign({}, c0), 480, sun);
eq([tr.week, tr.minutes, tr.next], ["2026-10-05", 480, true], "set on a Sunday: it is for the week starting Monday");
eq(await fit.weekTarget(kv2, c0, "2026-10-05"), 480, "that week uses it");
eq(await fit.weekTarget(kv2, (await fit.fitCfg(kv2)), "2026-10-12"), 480, "a week nobody set carries the last number forward");
tr = await fit.fitSetWeekTarget(kv2, await fit.fitCfg(kv2), 300, wed);
eq([tr.week, tr.next], ["2026-10-05", false], "set mid-week: it changes THIS week");
eq(await fit.fitSetWeekTarget(kv2, await fit.fitCfg(kv2), 99999, sun), null, "an absurd target is refused");
eq(fit.weekMinutes({ "2026-10-05": [ex(60)] }, "2026-10-07").minutes, 60, "Monday starts the week");
store.clear(); outbound = []; store.set("wa_owner_last_in", { v: new Date().toISOString() });
await fit.fitSaveCfg(env, fit.fitCleanCfg({ start: "2026-09-28", tone: "firm" }, fit.FIT_CFG_DEFAULT));
await fit.fitAdd(env, { k: "ex", x: "Gym", m: 45, t: T("2026-10-04T12:00:00Z"), d: "2026-10-04" });
ok(await E("2026-10-04T17:05:00Z") && /Weekly target missed: 45 min of 10h/.test(said()) && /set next week's target/.test(said()) && /momo target 10/.test(said()), "Sunday 21:00: the week is judged against its own target and next week's is asked for");
store.clear(); outbound = []; store.set("wa_owner_last_in", { v: new Date().toISOString() });
await fit.fitSaveCfg(env, fit.fitCleanCfg({ start: "2026-09-28" }, fit.FIT_CFG_DEFAULT));
await env.MEETINGS.put("fitc_wk_me_2026-10-05", "600");
await fit.fitAdd(env, { k: "ex", x: "Gym", m: 45, t: T("2026-10-04T12:00:00Z"), d: "2026-10-04" });
ok(await E("2026-10-04T17:05:00Z") && !/set next week's target/.test(said()), "already set for next week: it does not ask again");
ok(((await jget("/fit_api")).j.week.target) > 0, "the page API carries the week's own target");
r = await (await post("/fit_api", { op: "weektarget", hours: 7.5 })).json();
eq([r.ok, r.target.minutes], [true, 450], "the page can set it too");
eq((await (await post("/fit_api", { op: "weektarget", hours: -3 })).json()).ok, false, "a negative target is refused");

console.log("photos on the page");
const imgOwner = await call(K("/fit_img/logo.jpg"));
const imgBytes = new Uint8Array(await imgOwner.arrayBuffer());
ok(imgOwner.status === 200 && imgOwner.headers.get("content-type") === "image/jpeg" && imgBytes[0] === 0xff && imgBytes[1] === 0xd8 && imgBytes.length > 10000, "the owner gets a real JPEG from the worker itself");
for (const nm of ["logo", "food", "exercise", "walk", "win"]) { const r2 = await call(K("/fit_img/" + nm + ".jpg")); ok(r2.status === 200 && r2.headers.get("content-type") === "image/jpeg", "bundled image: " + nm); }
const icoR = await call(K("/fit_img/icon.png")), ico = new Uint8Array(await icoR.arrayBuffer());
ok(icoR.status === 200 && icoR.headers.get("content-type") === "image/png" && ico[0] === 0x89 && ico[1] === 0x50 && ico[2] === 0x4e && ico[3] === 0x47, "the page icon is a real PNG served as image/png");
eq([(await call("/fit_img/logo.jpg")).status, (await call(K("/fit_img/logo.jpg", CLIENT))).status, (await call(K("/fit_img/nope.jpg"))).status, (await call(K("/fit_img/..%2Fsecret.jpg"))).status], [404, 404, 404, 404], "no key, a client key, an unknown name and a path trick are all 404");
const pageHtml = await (await call(K("/fit"))).text();
ok(!/https?:\/\/(?!fonts\.(googleapis|gstatic)\.com)[^"'\s)]*\.(jpe?g|png|webp)/i.test(pageHtml) && !/pexels\.com\/[^ ]*photo/i.test(pageHtml), "the page asks no third party for a picture (only the app's own fonts)");
ok(/<img class="logo" src="\/fit_img\/logo\.jpg\?key=[^"]+" alt="Momo">/.test(pageHtml) && !/data-img="hero"/.test(pageHtml) && /data-img="food"/.test(pageHtml) && /data-img="exercise"/.test(pageHtml) && /data-img="walk"/.test(pageHtml), "the Motion logo is the banner (no header photo any more); food, exercise and walking banners are on the page");
ok(/<link rel="icon" type="image\/png" href="\/fit_img\/icon\.png\?key=[^"]+">/.test(pageHtml) && /<link rel="apple-touch-icon" href="\/fit_img\/icon\.png\?key=/.test(pageHtml) && !/naj_icon\.svg/.test(pageHtml), "the page icon and the home-screen icon are the Momo tile, not the Najma one");
eq([(await call("/fit_img/icon.png")).status, (await call(K("/fit_img/icon.png", CLIENT))).status], [404, 404], "the icon is owner-only too");

console.log("FIT stands aside for Azimuth's other flows");
store.clear(); outbound = [];
store.set("fbgown_" + HER, { v: JSON.stringify({ n: "1" }) });
aiAnswer = classifier({ "lunch at the beach at sunset": { kind: "food", text: "Lunch", type: null, minutes: null, steps: null, day_offset: 0 } });
await text("lunch at the beach at sunset");
ok(fitKeys().length === 0 && !store.has("fbgown_" + HER), "her scene description for a backdrop is NOT logged as a meal, and the scene flow consumed it");
store.set("scedit_" + HER, { v: "abc" });
await text("food: gym bag snack");
ok(fitKeys().length === 0, "a scene edit in progress also keeps FIT out of it");
store.delete("scedit_" + HER);
store.set("pending_wa_" + HER, { v: "meeting with Sara" });
await text("ran 5k in 30 min");
ok(fitKeys().length === 0, "while a \"when is it?\" follow-up is open, FIT stays out");
store.delete("pending_wa_" + HER);
store.set("style_flow", { v: JSON.stringify({ step: "change" }) });
await text("food: oats");
ok(fitKeys().length === 0, "while her style walk-through waits for a line, FIT stays out");
store.set("style_flow", { v: JSON.stringify({ step: "locked" }) });
await text("food: oats");
ok(fitKeys().length === 1, "a finished walk-through (step locked) does not block FIT for ever");

console.log("a bare number is never a feed pick");
store.clear(); outbound = [];
aiAnswer = classifier({ "gym": { kind: "exercise", text: null, type: "Gym", minutes: null, steps: null, day_offset: 0 } });
await text("gym");
ok(/How long was the gym/.test(said()), "asks how long");
const pendKey = [...store.keys()].find((k) => k.startsWith("fitc_pend_"));
ok(!!pendKey, "a one-turn follow-up is waiting");
await text("2");
ok(fitKeys().length === 0, "a bare 2 (a feed pick) is not logged as 2 minutes");
await text("gym");
await text("45");
ok(fitKeys().length === 1 && /Gym · 45 min/.test(said()), "a real duration still completes it");

console.log("cumulative: day by day, week by week, month by month, total");
eq([fit.carryTarget({}, "2026-10-05", 600), fit.carryTarget({ "2026-10-05": 480 }, "2026-09-28", 600), fit.carryTarget({ "2026-10-05": 480 }, "2026-10-19", 600), fit.carryTarget({ "2026-10-05": 480, "2026-10-12": 300 }, "2026-10-19", 600)], [600, 480, 480, 300], "a week with no target carries the latest earlier one; one before the first uses the first; none set uses the default");
store.clear(); outbound = [];
const start16 = fit.addDays(today, -15);
await fit.fitSaveCfg(env, fit.fitCleanCfg({ start: start16, tone: "firm" }, fit.FIT_CFG_DEFAULT));
const winOffsets = [12, 9, 8, 5, 3, 2, 1];   // days ago on which a 40-minute workout was logged
for (const o of winOffsets) { const d = fit.addDays(today, -o); await fit.fitAdd(env, { k: "ex", x: "Gym", m: 40, t: Date.parse(d + "T08:00:00Z"), d }); await fit.fitAdd(env, { k: "food", x: "Meal", t: Date.parse(d + "T08:00:00Z"), d, o: o % 2 === 0 }); }
await fit.fitAdd(env, { k: "ex", x: "Steps", n: 11000, t: Date.parse(fit.addDays(today, -6) + "T08:00:00Z"), d: fit.addDays(today, -6) });
const H = (await jget("/fit_api?view=history")).j;
ok(H.ok && H.days.length === 16 && H.days[0].d === start16 && H.days[15].d === today, "history spans the challenge: 16 days from the start to today");
eq(H.days.filter((x) => x.ok).map((x) => fit.addDays(today, 0) > x.d ? (Date.parse(today) - Date.parse(x.d)) / 864e5 : 0), [12, 9, 8, 6, 5, 3, 2, 1], "day by day: exactly the days with a workout or the steps floor are hit (6 days ago via 11,000 steps)");
eq([H.totals.days, H.totals.hit, H.totals.bestStreak, H.totals.minutes, H.totals.steps, H.totals.meals, H.totals.out], [16, 8, 3, 280, 11000, 7, 3], "totals: days hit, best streak, minutes, steps, meals, meals outside windows");
ok(H.weeks.reduce((a, w) => a + w.minutes, 0) === H.totals.minutes && H.weeks.reduce((a, w) => a + w.hit, 0) === H.totals.hit && H.weeks.reduce((a, w) => a + w.days, 0) === H.totals.days, "the weeks add up to the totals");
ok(H.months.reduce((a, m) => a + m.minutes, 0) === H.totals.minutes && H.months.reduce((a, m) => a + m.days, 0) === H.totals.days, "the months add up to the totals");
ok(H.weeks.every((w, k) => k === 0 || w.ws === fit.addDays(H.weeks[k - 1].ws, 7)) && H.weeks[H.weeks.length - 1].to === today && H.weeks.every((w) => w.target === 600), "weeks are consecutive Mondays, the last ends today, and each carries the 10-hour target");
ok(H.weeks[H.weeks.length - 1].complete === (new Date(today + "T00:00:00Z").getUTCDay() === 0 ? false : fit.addDays(H.weeks[H.weeks.length - 1].ws, 6) < today), "the current week is not complete until its Sunday has passed");
eq((await call(K("/fit_api?view=history", CLIENT))).status, 404, "a client key gets no history");
await text("fit week");
ok(/📅 This week/.test(said()) && /Mon/.test(said()) && /Sun/.test(said()) && /Week: .* of 10h/.test(said()) && !/key=/.test(said()), "WhatsApp: fit week lists the seven days and the week total, no key");
await text("fit history");
ok(/📈 Since/.test(said()) && /Days hit: 8 of 16 · best streak 3/.test(said()) && /Wk /.test(said()), "WhatsApp: fit history gives the totals and a line per week");

console.log("two people on one instance (Momo)");
eq(fit.fitUsers({ FIT_USERS: "Kendall:971562276093, najjuko:971565484397, bad entry, x:12" }).map((u) => u.id + ":" + u.wa), ["kendall:971562276093", "najjuko:971565484397"], "FIT_USERS is parsed, lower-cased, and a bad entry is dropped");
eq(fit.fitUsers({ WA_ALLOWED: "971565484397" }), [{ id: "me", wa: "971565484397" }], "unset: one person on WA_ALLOWED - the single-user behaviour");
eq(fit.fitUsers({ FIT_USERS: "kendall:971562276093:Dr. Doli,najjuko:971565484397:Black Coffee,x::Only Name,y:971500000000:<b>Bad,Name</b>" }).map((u) => [u.id, u.wa, u.name]),
  [["kendall", "971562276093", "Dr. Doli"], ["najjuko", "971565484397", "Black Coffee"], ["x", "", "Only Name"], ["y", "971500000000", "bBad"]], "display names are parsed (spaces and a full stop are fine), optional, and stripped of anything but letters, digits, space . ' -");
const KEN = "971562276093";
env.FIT_USERS = "kendall:" + KEN + ",najjuko:" + HER;
eq([fit.fitUserFor(env, HER), fit.fitUserFor(env, KEN), fit.fitUserFor(env, "+971 56 548 4397"), fit.fitUserFor(env, "999")], ["najjuko", "kendall", "najjuko", "kendall"], "the sender's number decides whose log it is; a stranger falls to the first person");
store.clear(); outbound = [];
await text("food: her oats");
ok(fitKeys().length === 1 && fitKeys()[0].startsWith("fit_najjuko_") && /Logged - her oats/.test(said()), "her WhatsApp message is filed under najjuko");
ok(btns().some((b) => b.startsWith("fit:undo:najjuko:")), "its Undo button names her");
r = await (await post("/fit_api?u=kendall", { op: "add", kind: "food", text: "his eggs" })).json();
ok(r.ok && fitKeys().some((k) => k.startsWith("fit_kendall_")), "an add on the page for kendall is filed under kendall");
let kd = (await jget("/fit_api?u=kendall")).j, nj = (await jget("/fit_api?u=najjuko")).j;
eq([kd.u, kd.entries.map((e) => e.x), nj.u, nj.entries.map((e) => e.x)], ["kendall", ["his eggs"], "najjuko", ["her oats"]], "each person sees only their own day");
eq(kd.users, ["kendall", "najjuko"], "the page is told who the people are");
eq(kd.names, { kendall: "Kendall", najjuko: "Najjuko" }, "with no display names set, the page falls back to the capitalised id");
env.FIT_USERS = "kendall:" + KEN + ":Dr. Doli,najjuko:" + HER + ":Black Coffee";
const named = (await jget("/fit_api?u=najjuko")).j;
eq([named.names, named.users, named.u], [{ kendall: "Dr. Doli", najjuko: "Black Coffee" }, ["kendall", "najjuko"], "najjuko"], "with display names set: the page shows Dr. Doli and Black Coffee while the ids (and so every storage key) stay kendall and najjuko");
ok(fitKeys().every((k) => /^fit_(kendall|najjuko)_/.test(k)), "no storage key contains a display name");
env.FIT_USERS = "kendall:" + KEN + ",najjuko:" + HER;
const nobody = (await jget("/fit_api?u=nobody")).j;
ok(nobody.u === "kendall" && !fitKeys().some((k) => k.includes("nobody")) && ![...store.keys()].some((k) => k.includes("nobody")), "an unknown person falls back to the first - and never opens a new keyspace");
const hisId = kd.entries[0].id;
eq((await (await post("/fit_api?u=najjuko", { op: "del", id: hisId })).json()).ok === true && fitKeys().some((k) => k.startsWith("fit_kendall_")), true, "najjuko's session deletes 'ok' but cannot remove kendall's entry (the key is per person)");
await post("/fit_api?u=kendall", { op: "cfg", cfg: { goal: "Marathon in spring", tone: "kind" } });
eq([(await jget("/fit_api?u=kendall")).j.cfg.goal, (await jget("/fit_api?u=najjuko")).j.cfg.goal, store.has("fitc_cfg_kendall"), store.has("fitc_cfg_najjuko")], ["Marathon in spring", "", true, true], "the plan is per person: different goals, separate stored settings (hers exists because her first log started her challenge)");
await post("/fit_api?u=kendall", { op: "add", kind: "ex", text: "Gym", minutes: 60 });
eq([(await jget("/fit_api?u=kendall&view=history")).j.totals.minutes, (await jget("/fit_api?u=najjuko&view=history")).j.totals.minutes], [60, 0], "history is per person");
await text("momo week");
ok(/📅 This week/.test(said()), "\"momo week\" works like \"fit week\"");
await text("momo target 8");
ok(/Target for (this|next) week.*: 8h/.test(said()) && store.has("fitc_cfg_najjuko") && [...store.keys()].some((k) => /^fitc_wk_najjuko_/.test(k)) && ![...store.keys()].some((k) => /^fitc_wk_kendall_/.test(k)), "a target set from her number is hers alone");
// the evening verdict: each instance speaks only to its own number
store.set("wa_owner_last_in", { v: new Date().toISOString() }); outbound = [];
await fit.fitSaveCfg(env, fit.fitCleanCfg({ start: "2026-10-03" }, Object.assign({}, fit.FIT_CFG_DEFAULT, { u: "najjuko" })));
await fit.fitSaveCfg(env, fit.fitCleanCfg({ start: "2026-10-03" }, Object.assign({}, fit.FIT_CFG_DEFAULT, { u: "kendall" })));
ok(await E("2026-10-04T17:05:00Z") && outbound.length === 1, "21:00: exactly one verdict goes out - to this instance's own number");
ok([...store.keys()].some((k) => k === "fitc_sent_najjuko_2026-10-04") && ![...store.keys()].some((k) => k === "fitc_sent_kendall_2026-10-04"), "...it is najjuko's, and kendall's is left for the page (his number belongs to the other instance)");
delete env.FIT_USERS;

console.log("deploy config and the nudge template");
import fs from "node:fs";
const toml = fs.readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const az2 = toml.slice(toml.indexOf("[env.azimuth2.vars]"), toml.indexOf("[env.azimuth2.triggers]"));
const fu = /^FIT_USERS = "([^"]+)"/m.exec(az2);
ok(!!fu, "wrangler.toml [env.azimuth2.vars] carries FIT_USERS, so a deploy never runs as a single person by accident");
const parsed = fit.fitUsers({ FIT_USERS: fu ? fu[1] : "" });
eq(parsed.map((u) => u.id), ["kendall", "najjuko"], "it parses to kendall and najjuko");
eq(parsed.map((u) => u.name), ["Dr. Doli", "Black Coffee"], "the page names are Dr. Doli and Black Coffee");
ok(parsed[1].wa === /^WA_ALLOWED = "(\d+)"/m.exec(az2)[1], "najjuko's number is the one this instance talks to (WA_ALLOWED)");
ok(parsed[0].wa === /^WA_ALLOWED = "(\d+)"/m.exec(toml)[1] && parsed[0].wa !== parsed[1].wa, "kendall's number is the default instance's, and the two differ");
ok(!/^\s*LOG_NUDGE_TEMPLATE\s*=/m.test(toml), "the nudge template is OFF in the committed config (commented out) until Meta approves it");
ok(/MOMO/.test(fs.readFileSync(new URL("../README.md", import.meta.url), "utf8")) && /disappears for her by design/.test(fs.readFileSync(new URL("../README.md", import.meta.url), "utf8")), "the README says MOMO disappears for her if a client key is turned on");
// the template branch
store.clear(); outbound = []; let tpl = [];
const depsT = { waSend: async () => {}, waSendButtons: async () => {}, waSendTemplate: async (en, to, name, lang, params) => tpl.push({ to, name, lang, params }), ownerWindowOpen: async () => false };
await fit.fitSaveCfg(env, fit.fitCleanCfg({ start: "2026-10-03" }, fit.FIT_CFG_DEFAULT));
env.LOG_NUDGE_TEMPLATE = undefined;
await fit.fitEvening(env, depsT, T("2026-10-04T17:05:00Z"));
eq(tpl.length, 0, "template not configured: nothing is sent into a shut window");
env.LOG_NUDGE_TEMPLATE = "najma_log_day"; env.LOG_NUDGE_LANG = "en_GB";
ok((await fit.fitEvening(env, depsT, T("2026-10-04T17:05:00Z"))) === true && tpl.length === 1 && tpl[0].name === "najma_log_day" && tpl[0].lang === "en_GB" && tpl[0].params.length === 0 && tpl[0].to === HER, "configured + window shut + nothing logged: the no-variable nudge goes to her number");
await fit.fitEvening(env, depsT, T("2026-10-04T17:10:00Z"));
eq(tpl.length, 1, "only once a day");
await fit.fitAdd(env, { k: "food", x: "Oats", t: T("2026-10-05T04:00:00Z"), d: "2026-10-05" });
await fit.fitEvening(env, depsT, T("2026-10-05T17:05:00Z"));
eq(tpl.length, 1, "she has logged today: no nudge");
eq(store.has("fitc_sent_me_2026-10-05"), false, "and the shut window did not use up the verdict (it waits for the window or the page)");
delete env.LOG_NUDGE_TEMPLATE; delete env.LOG_NUDGE_LANG;

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
