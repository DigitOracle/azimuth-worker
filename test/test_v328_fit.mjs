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
eq(fit.dayStats([{ k: "food", x: "a", o: 1 }, { k: "food", x: "b" }], cfg), { meals: 2, out: 1, ex: 0, steps: 0, protein: 0, pmeals: 0, qualifies: false }, "meals and outside-window count (and no protein yet: none was estimated)");
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
const stepsBefore = fitKeys().length;
await text("10k steps");
ok(fitKeys().length === stepsBefore + 1 && /Logged - 10,000 steps/.test(said()), "steps logged (a new entry, and the reply says so - not just the state line)");
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
ok(/\*VERDICT - DAY 2 OF 30\*/.test(said()) && (/\*[^*\r\n]*(missed|Missed|fell short|not do enough)[^*\r\n]*\*/.test(said()) || /\*[^*\r\n]*(Nothing logged|No entries)/.test(said())) && /10,000 steps/.test(said()) && /TOMORROW'S LINE IN THE SAND/.test(said()), "a missed day: a bold one-line verdict, the facts block, the 10,000-step option, and tomorrow's line in the sand");
ok(!(await E("2026-10-04T17:10:00Z")), "only once per day");
await fit.fitAdd(env, { k: "ex", x: "Gym", m: 60, t: T("2026-10-05T12:00:00Z"), d: "2026-10-05" });
await fit.fitAdd(env, { k: "food", x: "Pizza", t: T("2026-10-05T07:00:00Z"), d: "2026-10-05", o: true });
ok(await E("2026-10-05T17:05:00Z") && /half on plan|Floor met/.test(said()) && /Meals outside your windows: 1 of 1/.test(said()) && /Every meal inside its window/.test(said()), "exercise done but a meal outside its window: half a win, the number, and the window rule as tomorrow's line");
await fit.fitSaveCfg(env, fit.fitCleanCfg({ tone: "brutal" }, await fit.fitCfg(env)));
await fit.fitAdd(env, { k: "food", x: "Eggs", t: T("2026-10-06T04:00:00Z"), d: "2026-10-06" });
ok(await E("2026-10-06T17:05:00Z") && /You did not do enough today|was a miss|fell short/.test(said()) && /No negotiating/.test(said()) && !/horrible person|fat|heavier|ugly|disgusting|worthless|pathetic/i.test(said()), "brutal tone: unflinching about the missed actions, never about the body or the person");
await fit.fitAdd(env, { k: "ex", x: "Walk", m: 40, t: T("2026-10-07T12:00:00Z"), d: "2026-10-07" });
await fit.fitAdd(env, { k: "food", x: "Eggs", t: T("2026-10-07T04:00:00Z"), d: "2026-10-07" });
ok(await E("2026-10-07T17:05:00Z") && /every goal|Clean sheet|on plan/i.test(said()) && /Beat it: /.test(said()), "a clean day: says so, and raises the bar for tomorrow");
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
ok(/^\s*LOG_NUDGE_TEMPLATE\s*=\s*"najma_log_day"/m.test(toml) && /^\s*LOG_NUDGE_LANG\s*=\s*"en_US"/m.test(toml.split("[env.azimuth2.vars]")[1] || ""), "the nudge template is ON in the azimuth2 config now that Meta shows it ACTIVE (no variables, en_US)");
ok(!/^\s*LOG_NUDGE_TEMPLATE\s*=/m.test(toml.split("[env.azimuth2]")[0]), "and it is not set on the older instance");
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

console.log("v333: a week that hits its target is marked as met");
store.clear(); outbound = []; delete env.FIT_USERS;
const lastWeek = fit.addDays(fit.weekStart(today), -7);
await fit.fitSaveCfg(env, fit.fitCleanCfg({ start: fit.addDays(today, -21), weekMin: 100 }, fit.FIT_CFG_DEFAULT));
for (const o of [0, 1, 2]) { const d = fit.addDays(lastWeek, o); await fit.fitAdd(env, { k: "ex", x: "Gym", m: 40, t: Date.parse(d + "T08:00:00Z"), d }); }
const HM = (await jget("/fit_api?view=history")).j;
const wk1 = HM.weeks.find((w) => w.ws === lastWeek);
ok(wk1 && wk1.minutes === 120 && wk1.target === 100 && wk1.met === true && wk1.complete === true, "120 minutes against a 100-minute target: the week is MET (this flag used to be swallowed by a comment)");
ok(HM.totals.weeksMet === 1 && HM.totals.weeksDone >= 1, "and it is counted in weeks on target");
ok(HM.weeks.filter((w) => w.complete && w.ws !== lastWeek).every((w) => w.met === false), "a finished week with nothing logged is not met");

console.log("v333: rest days");
store.clear(); outbound = [];
await fit.fitSaveCfg(env, fit.fitCleanCfg({ start: fit.addDays(today, -2) }, fit.FIT_CFG_DEFAULT));
for (const o of [2, 1]) { const d = fit.addDays(today, -o); await fit.fitAdd(env, { k: "ex", x: "Gym", m: 40, t: Date.parse(d + "T08:00:00Z"), d }); }
await text("momo pause 1 flu");
ok(/Today is a rest day/.test(said()) && store.has("fitc_pause_me_" + today), "momo pause books today as a rest day");
let sr = await fit.fitSummary(env, today, await fit.fitCfg(env), today);
eq([sr.rest, sr.challenge.hit, sr.challenge.rest, sr.challenge.streak, sr.challenge.counted, sr.week.rest], [true, 2, 1, 2, 2, 1], "a rest day is not a miss: the streak of 2 carries over it, and it is left out of the days counted");
eq(sr.week.target, Math.round(600 * 6 / 7), "that week's target shrinks by the rest day (6/7 of 10 hours)");
const HR = (await jget("/fit_api?view=history")).j;
eq([HR.totals.rest, HR.totals.days, HR.totals.hit, HR.totals.bestStreak, HR.days[HR.days.length - 1].rest], [1, 2, 2, 2, true], "history leaves the rest day out of days hit of N and flags it");
store.set("wa_owner_last_in", { v: new Date().toISOString() }); outbound = [];
ok(await E(today + "T17:05:00Z") && /⏸/.test(said()) && !/🔴/.test(said()) && /rest|paused|day off/i.test(said()) && /flu/.test(said()), "the 21:00 message on a rest day says rest (with the reason), never a failure");
await text("momo pause 3 holiday");
ok(/Rest days:/.test(said()) && [...store.keys()].filter((k) => k.startsWith("fitc_pause_me_")).length === 3, "momo pause 3 books three days");
await text("momo resume");
ok(/Back on/.test(said()) && [...store.keys()].filter((k) => k.startsWith("fitc_pause_me_")).length === 0, "momo resume clears today and every later rest day");
await text("momo resume");
ok(/Nothing was paused/.test(said()), "resume with nothing booked says so");
eq((await (await post("/fit_api", { op: "pause", days: 2, reason: "travel" })).json()).dates.length, 2, "the page can book rest days too");
eq((await (await post("/fit_api", { op: "resume" })).json()).cleared, 2, "and clear them");

console.log("v333: steps are a day total, and the phone can send them");
store.clear(); delete env.FIT_TOKEN;
eq([fit.dayStats([{ k: "ex", n: 9000 }, { k: "ex", n: 12000 }, { k: "ex", m: 10 }], fit.FIT_CFG_DEFAULT).steps, fit.dayStats([{ k: "ex", n: 9000 }, { k: "ex", n: 12000 }], fit.FIT_CFG_DEFAULT).qualifies], [12000, true], "two step counts on one day do not add up: the largest wins");
const sp = (b, tok, k) => call(k ? K("/fit_steps", k) : "/fit_steps", { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, tok ? { "X-Momo-Token": tok } : {}), body: JSON.stringify(b) });
eq((await sp({ user: "me", steps: 9000 }, "anything")).status, 404, "no FIT_TOKEN set: the endpoint is off (404)");
env.FIT_TOKEN = "tok_0123456789abcdef0123";
const TOK = env.FIT_TOKEN;
eq([(await sp({ user: "me", steps: 9000 })).status, (await sp({ user: "me", steps: 9000 }, "wrong")).status, (await sp({ user: "me", steps: 9000 }, TOK, READ)).status], [401, 401, 200], "no token and a wrong token are 401; the right token works");
eq([(await sp({ user: "nobody", steps: 9000 }, TOK)).status, (await sp({ user: "me", steps: 999999 }, TOK)).status, (await sp({ user: "me", steps: 9000, date: fit.addDays(today, -5) }, TOK)).status, (await sp({ user: "me", steps: 9000, date: fit.addDays(today, 1) }, TOK)).status], [400, 400, 400, 400], "unknown user, absurd count, an old date and a future date are refused");
eq((await (await sp({ user: "me", steps: 50 }, TOK)).json()).skipped !== undefined, true, "under 100 steps is not logged");
eq((await call("/fit_steps", { method: "GET" })).status, 405, "GET is refused");
await sp({ user: "me", steps: 7000 }, TOK); await sp({ user: "me", steps: 11250 }, TOK);
const autos = [...store.keys()].filter((k) => k.endsWith("_autosteps"));
eq(autos.length, 1, "sending again REPLACES the day's automatic count (one entry, not two)");
eq((await jget("/fit_api")).j.stats.steps, 11250, "the page shows the latest count");
await text("12000 steps");
eq((await jget("/fit_api")).j.stats.steps, 12000, "a bigger typed count wins; a smaller one would not lower it");
await text("fit fix 9000 steps");
eq((await jget("/fit_api")).j.stats.steps, 11250, "fixing the typed count back down leaves the phone's count as the day's total");
const stepsEntry = (await jget("/fit_api")).j.entries.find((e) => e.s === "auto");
ok(stepsEntry && stepsEntry.n === 11250, "the automatic entry is marked as coming from the phone");
const ownerHtml = await (await call(K("/fit"))).text();
ok(!ownerHtml.includes(TOK), "the steps token never appears on any page");
delete env.FIT_TOKEN;

console.log("v333: a plain log needs no model");
store.clear(); outbound = []; aiCalls = []; aiAnswer = () => ({ kind: "other", text: null, type: null, minutes: null, steps: null, day_offset: 0 });
await text("gym 40 min"); ok(/Logged - Gym · 40 min/.test(said()) && fitKeys().length === 1, "\"gym 40 min\" is logged even when the model would have said 'other'");
await text("12000 steps yesterday"); ok(/\(yesterday\)/.test(said()) && fitKeys().length === 2, "\"12000 steps yesterday\" lands on yesterday");
ok(!aiCalls.some((c) => /log food and exercise/.test(c.sys)), "and neither asked the model anything");
await text("gym 40 min tomorrow at 6"); ok(fitKeys().length === 2, "a plan with a time in it is NOT logged (\"gym 40 min tomorrow at 6\")");
await text("I will do 10k steps tomorrow"); ok(fitKeys().length === 2, "nor is a promise");
console.log("v333: weight and waist");
store.clear(); outbound = [];
await fit.fitSaveCfg(env, fit.fitCleanCfg({ start: fit.addDays(today, -6) }, fit.FIT_CFG_DEFAULT));
await fit.fitAdd(env, { u: "me", k: "w", x: "weight", v: 85.5, d: fit.addDays(today, -3), t: Date.parse(fit.addDays(today, -3) + "T05:00:00Z"), s: "web" });
await text("momo weight 84");
ok(/Weight 84 kg logged/.test(said()) && /Since the first reading: -1\.5 kg \(85\.5 to 84\)/.test(said()) && btns().some((b) => b.startsWith("fit:undo:")), "a weight is logged with the change since the first reading, and an Undo");
await text("momo waist 91,5");
ok(/Waist 91\.5 cm logged/.test(said()) && /first reading/.test(said()), "a waist is logged (a comma works as the decimal point); the first reading says so");
await text("momo weight 500"); ok(/does not look right/.test(said()), "an absurd weight is refused");
await text("momo waist 20"); ok(/does not look right/.test(said()), "an absurd waist is refused");
const HW = (await jget("/fit_api?view=history")).j;
eq([HW.measures.weight.change, HW.measures.weight.first, HW.measures.weight.latest, HW.measures.weight.count, HW.measures.waist.count], [-1.5, 85.5, 84, 2, 1], "history carries the measurements");
await text("momo fix 83.2");
ok(/Updated/.test(said()), "momo fix corrects the last entry (a waist reading here)");
await text("momo weight 84"); await text("momo fix 83.2");
eq((await jget("/fit_api?view=history")).j.measures.weight.latest, 83.2, "momo fix changes a measurement's value");
await text("momo fix abc");
ok(/Give the right number/.test(said()), "a measurement cannot be 'fixed' with words");
eq([(await (await post("/fit_api", { op: "measure", what: "waist", value: 90 })).json()).ok, (await post("/fit_api", { op: "measure", what: "waist", value: 5 })).status, (await post("/fit_api", { op: "measure", what: "height", value: 180 })).status], [true, 400, 400], "the page logs a measurement; absurd values and unknown kinds are refused");
const statusMsg = (await text("momo"), said());
ok(/⚖️ weight/.test(statusMsg) || /📏 waist/.test(statusMsg), "the status lists today's measurements");
await text("momo history");
ok(/⚖️ Weight: 83\.2 kg \(-2\.3 kg since the first reading\)/.test(said()), "momo history shows the weight change");

console.log("v333: again, undo, fix, help");
store.clear(); outbound = [];
await text("food: eggs and toast");
await text("momo again");
ok(fitKeys().length === 2 && /Logged - eggs and toast/.test(said()), "momo again repeats the last meal");
await text("momo undo");
ok(fitKeys().length === 1 && /Removed - eggs and toast/.test(said()), "momo undo removes the last entry");
await text("momo fix scrambled eggs");
ok(/Updated - scrambled eggs/.test(said()) && (await jget("/fit_api")).j.entries[0].x === "scrambled eggs", "momo fix rewrites a meal");
await text("gym 40 min"); await text("momo fix 55");
ok(/Updated - Gym 55 min/.test(said()), "momo fix changes minutes");
await text("momo fix 4 min"); ok(/Updated - Gym 4 min/.test(said()), "a duration with its unit is taken as written");
store.clear(); await text("momo undo"); ok(/Nothing to undo/.test(said()), "undo with nothing logged says so");
await text("momo again"); ok(/Nothing to repeat/.test(said()), "again with nothing logged says so");
await text("momo help");
ok(/momo pause/.test(said()) && /momo weight/.test(said()) && /momo again/.test(said()) && /momo share/.test(said()) && !/key=/.test(said()), "momo help lists the commands");

console.log("v333: sharing the week and streak (both must opt in)");
store.clear(); outbound = [];
env.FIT_USERS = "kendall:" + KEN + ":Dr. Doli,najjuko:" + HER + ":Black Coffee";
for (const u of ["kendall", "najjuko"]) { await fit.fitSaveCfg(env, fit.fitCleanCfg({ start: fit.addDays(today, -3) }, Object.assign({}, fit.FIT_CFG_DEFAULT, { u }))); for (const o of [2, 1]) { const d = fit.addDays(today, -o); await fit.fitAdd(env, { u, k: "ex", x: "Gym", m: 45, t: Date.parse(d + "T08:00:00Z"), d }); } }
eq((await jget("/fit_api?u=najjuko")).j.partners, [], "nobody shares: nobody sees anything");
await post("/fit_api?u=kendall", { op: "share", on: true });
eq([(await jget("/fit_api?u=najjuko")).j.partners.length, (await jget("/fit_api?u=kendall")).j.partners.length], [0, 0], "one person sharing is not enough: it is mutual, so neither sees the other");
await text("momo share on");
ok(/Sharing is ON/.test(said()) && /never what you ate/.test(said()), "momo share on (from her number) explains what is shared");
const pj = (await jget("/fit_api?u=najjuko")).j;
// the fixture is two 45-minute days (2 days ago and yesterday); how many of them fall inside the CURRENT week depends on the weekday, so the expectation is built from the week start
const wkNow = fit.weekStart(today), inThisWeek = [2, 1].filter((o) => fit.addDays(today, -o) >= wkNow).length * 45;
eq([pj.share, pj.partners.length, pj.partners[0].name, pj.partners[0].streak, pj.partners[0].week], [true, 1, "Dr. Doli", 2, inThisWeek], "both on: she sees his name, streak and week minutes - counts only (the streak runs across the week boundary; the week minutes only count this week)");
ok(!JSON.stringify(pj.partners).includes("Oats"), "no food text travels with it");
store.set("wa_owner_last_in", { v: new Date().toISOString() }); outbound = [];
ok(await E(today + "T17:05:00Z") && new RegExp("🤝 Dr\\. Doli: " + fit.fmtMin(inThisWeek) + " of").test(said()), "her 21:00 message carries his week line");
await text("momo");
ok(/🤝 Dr\. Doli/.test(said()), "momo shows the partner line too");
await text("momo share off"); ok(/Sharing is OFF/.test(said()) && (await jget("/fit_api?u=kendall")).j.partners.length === 0, "switching off removes it for both");
delete env.FIT_USERS;

console.log("v333: Sunday, the long look");
store.clear(); outbound = [];
await fit.fitSaveCfg(env, fit.fitCleanCfg({ start: "2026-09-14", tone: "firm" }, fit.FIT_CFG_DEFAULT));
const THU = ["2026-09-17", "2026-09-24", "2026-10-01"];
for (let d = "2026-09-14"; d <= "2026-10-04"; d = fit.addDays(d, 1)) { if (THU.includes(d)) continue; await fit.fitAdd(env, { k: "ex", x: "Gym", m: d === "2026-09-22" ? 100 : 40, t: Date.parse(d + "T08:00:00Z"), d }); }
store.set("wa_owner_last_in", { v: new Date().toISOString() }); outbound = [];
ok(await E("2026-10-04T17:05:00Z"), "the Sunday verdict goes out");
const sun2 = said();
ok(/Against last week: -1h \(5h then, 4h now\)/.test(sun2), "it compares this week with last");
ok(/Best day: Mon, 40 min/.test(sun2) && /Missed: Thu/.test(sun2), "it names the best day and the day missed");
ok(/Pattern: you tend to miss Thursdays \(0 of 3\)/.test(sun2), "and the weekday that keeps going wrong");
ok(/momo target 10/.test(sun2), "and still asks for next week's target");

console.log("v333: the wording rotates by day");
const cfgW = Object.assign(fit.fitCleanCfg({ tone: "brutal" }, fit.FIT_CFG_DEFAULT), { u: "me" }), VW = { steps: "10,000", min: 30 };
const seen = new Set(); for (let k = 0; k < 12; k++) seen.add(fit.say(cfgW, "dayFail", VW, fit.addDays("2026-10-01", k)));
ok(seen.size >= 2 && seen.size <= 3, "different days say different things (" + seen.size + " variants over 12 days)");
eq(fit.say(cfgW, "dayFail", VW, "2026-10-01"), fit.say(cfgW, "dayFail", VW, "2026-10-01"), "the same day always says the same thing");
for (const tone of ["kind", "firm", "brutal"]) for (const key of ["dayDone", "weekDone", "dayPass", "mixed", "dayFail", "weekMiss", "rest"]) for (let k = 0; k < 6; k++) { const m = fit.say(Object.assign({}, cfgW, { tone }), key, Object.assign({ out: 2, s: "s", got: "1h", want: "10h", why: "" }, VW), fit.addDays("2026-10-01", k)); if (!m || /\{\w+\}/.test(m)) { ok(false, "unfilled placeholder in " + tone + "/" + key + ": " + m); } }
ok(true, "every tone and situation fills in all its placeholders");
for (let k = 0; k < 9; k++) { const m = fit.say(cfgW, "dayFail", VW, fit.addDays("2026-10-01", k)); if (!/heavier and slower/.test(m) || /horrible person|disgusting|worthless|stupid/i.test(m)) ok(false, "brutal wording crossed a line: " + m); }
ok(true, "brutal wording stays about the behaviour in every variant: heavier and slower, never a judgement of the person");

console.log("v333: export and health");
store.clear(); outbound = [];
await fit.fitSaveCfg(env, fit.fitCleanCfg({ start: fit.addDays(today, -1) }, fit.FIT_CFG_DEFAULT));
await fit.fitAdd(env, { k: "food", x: "=SUM(1,1) \"quoted\", with comma", t: Date.now(), d: today }); await fit.fitAdd(env, { k: "ex", x: "Gym", m: 30, t: Date.now(), d: today }); await fit.fitAdd(env, { k: "w", x: "weight", v: 80, t: Date.now(), d: today });
const csvR = await call(K("/fit_api?view=csv")), csv = await csvR.text();
ok(csvR.status === 200 && /text\/csv/.test(csvR.headers.get("content-type")) && /attachment; filename="momo-me-/.test(csvR.headers.get("content-disposition") || ""), "the CSV downloads as an attachment");
const rowsC = csv.trim().split("\n");
ok(rowsC[0] === "date,time_gst,kind,what,minutes,steps,value,outside_eating_window,source,protein_g_rough" && rowsC.length === 4, "header plus one row per entry (" + (rowsC.length - 1) + " rows)");
ok(csv.includes("\"'=SUM(1,1) \"\"quoted\"\", with comma\""), "a cell that starts with = is defused and quotes are escaped, so it cannot run as a formula");
ok(/exercise,Gym,30,/.test(csv) && /measurement,weight,,,80,/.test(csv), "exercise and measurement rows carry their numbers");
eq([(await call("/fit_api?view=csv")).status, (await call(K("/fit_api?view=csv", CLIENT))).status, (await call(K("/fit_api?view=health", CLIENT))).status], [404, 404, 404], "CSV and health are owner-only");
store.set("wa_owner_last_in", { v: new Date().toISOString() });
await E(today + "T17:05:00Z");
const hl = (await jget("/fit_api?view=health")).j;
ok(hl.ok && hl.entries_30d === 3 && hl.last_entry && hl.evening_check_last_ran && hl.verdict_last_sent_for_day === today && hl.steps_token_set === false && hl.nudge_template_set === false, "health says when the evening check ran, when the last verdict went, and when the last entry came");
ok(!JSON.stringify(hl).includes("tok_"), "health never shows a token");

console.log("v333: the page carries the new controls");
store.clear(); delete env.FIT_USERS; env.FIT_TOKEN = "tok_0123456789abcdef0123";
const pg = await (await call(K("/fit"))).text();
ok(/id="mf"/.test(pg) && /id="mw"/.test(pg) && /id="mv"/.test(pg) && /id="mb"/.test(pg), "a weight / waist form is in the Progress card");
ok(/id="csv"/.test(pg) && /id="s_share"/.test(pg) && /id="shl"/.test(pg), "the CSV link and the share switch are in the plan card");
ok(/op:'pause'/.test(pg) && /op:'resume'/.test(pg) && /op:'measure'/.test(pg) && /op:'share'/.test(pg), "the page script can pause, resume, log a measurement and switch sharing");
ok(/From your phone/.test(pg) && /rest left out/.test(pg) && /ic\('rest'/.test(pg), "automatic steps are labelled and rest days are shown (as an icon)");
ok(!pg.includes(env.FIT_TOKEN) && !/FIT_TOKEN|X-Momo-Token/.test(pg), "the steps token (and its name) appear nowhere on the page");
delete env.FIT_TOKEN;
const scriptOnly = pg.match(/<script>([\s\S]*?)<\/script>/)[1];
let parsed2 = true; try { new Function(scriptOnly); } catch (e) { parsed2 = false; }
ok(parsed2, "the page script is valid JavaScript");

console.log("v334: the guest door - a known person's Momo messages, forwarded from the instance that holds their number");
store.clear(); outbound = []; aiCalls = [];
env.FIT_USERS = "kendall:" + KEN + ":Dr. Doli,najjuko:" + HER + ":Black Coffee";
let gn = 0;
const waAs = (num, msg, o) => { gn++; const hdr = { "Content-Type": "application/json" }; if (!(o && o.noFwd)) hdr["X-Azimuth-Forward"] = (o && o.token) || "FWD"; return call("/wa", { method: "POST", headers: hdr, body: JSON.stringify({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: "p" }, messages: [Object.assign({ from: num, id: (o && o.id) || "wamid.guest" + gn, timestamp: String(Math.floor(Date.now() / 1000)) }, msg)] } }] }] }) }); };
const gtext = (num, b, o) => waAs(num, { type: "text", text: { body: b } }, o);
const lastTo = () => (outbound.length ? outbound[outbound.length - 1].to : null);
await gtext(KEN, "momo help");
ok(lastTo() === KEN && /momo pause/.test(said()), "his forwarded 'momo help' is answered, to HIS number");
const stray0 = [...store.keys()].filter((k) => /^(act_|evt_|cmt_)/.test(k)).length;
await gtext(KEN, "food: his eggs");
ok(lastTo() === KEN && /Logged - his eggs/.test(said()) && fitKeys().some((k) => k.startsWith("fit_kendall_")) && !fitKeys().some((k) => k.startsWith("fit_najjuko_")), "his meal is filed under kendall, not under her");
ok(store.has("fitc_in_kendall"), "and it notes when he last wrote (his 24-hour window)");
let r1 = await gtext(KEN, "food: unsigned", { noFwd: true });
eq([r1.status, fitKeys().filter((k) => k.startsWith("fit_kendall_")).length], [401, 1], "without the forward secret the message is refused (401) and nothing is logged");
r1 = await gtext(KEN, "food: wrong secret", { token: "WRONG" });
eq([r1.status, fitKeys().filter((k) => k.startsWith("fit_kendall_")).length], [401, 1], "with a wrong secret it is refused too");
const nOut = outbound.length;
await gtext("971500000001", "food: a stranger");
ok(outbound.length === nOut && !fitKeys().some((k) => /stranger/.test(JSON.stringify(store.get(k)))) && store.has("diag_lastdrop"), "a forwarded message from a number that is NOT in FIT_USERS is dropped, and noted in lastdrop");
await gtext(KEN, "call the bank tomorrow about the mortgage");
ok(/Momo handles food and exercise from this number/.test(said()) && [...store.keys()].filter((k) => /^(act_|evt_|cmt_)/.test(k)).length === stray0, "his non-Momo text gets the one-line rule and NEVER becomes a task, meeting or commitment on this instance");
const nOut2 = outbound.length;
r1 = await waAs(KEN, { type: "document", document: { id: "d1", filename: "x.pdf" } });
ok(outbound.length === nOut2, "a document from him is dropped: the door takes text, voice, photos and Momo buttons only");
const dupId = "wamid.dup1"; await gtext(KEN, "food: once only", { id: dupId }); await gtext(KEN, "food: once only", { id: dupId });
eq(fitKeys().filter((k) => k.startsWith("fit_kendall_") && JSON.parse(store.get(k).v).x === "once only").length, 1, "the same message id twice is logged once");
await waAs(KEN, { type: "interactive", interactive: { type: "button_reply", button_reply: { id: "done:abc", title: "Done" } } });
ok(outbound.length === nOut2 + 1 && !/Removed/.test(said()), "a non-Momo button from him (an Azimuth Done button) does nothing here");
const eggs = JSON.parse(store.get(fitKeys().find((k) => k.startsWith("fit_kendall_") && JSON.parse(store.get(k).v).x === "his eggs")).v);
await waAs(KEN, { type: "interactive", interactive: { type: "button_reply", button_reply: { id: "fit:undo:kendall:" + eggs.id, title: "Undo" } } });
ok(/Removed - his eggs/.test(said()) && lastTo() === KEN, "his Undo button works and answers him");
aiAnswer = (sys) => (/read a photo someone sent to log what they ate/.test(sys) ? { meal: "Shawarma wrap and salad" } : /reading a photo or screenshot/.test(sys) ? { kind: "meal", summary: "A wrap", meal: "Shawarma wrap and salad", meeting: null, tasks: [] } : {});
await waAs(KEN, { type: "image", image: { id: "mid9", mime_type: "image/jpeg", caption: "lunch" } });
ok(/Logged - Shawarma wrap and salad/.test(said()) && lastTo() === KEN && fitKeys().some((k) => k.startsWith("fit_kendall_") && /Shawarma/.test(store.get(k).v)), "a photo captioned 'lunch' from him is logged under kendall");
ok(![...store.values()].some((e) => String(e.v).includes(MARK)), "and the picture is still never stored");
aiAnswer = (sys) => (/reading a photo or screenshot/.test(sys) ? { kind: "nothing", summary: "A view", meal: null, meeting: null, tasks: [] } : {});
const kc = fitKeys().length; await waAs(KEN, { type: "image", image: { id: "mid10", mime_type: "image/jpeg" } });
ok(fitKeys().length === kc && /did not look like a meal/.test(said()), "a captionless photo that is not food is not logged, and he is told");
env.AI = { run: async () => ({ text: "food: his oats" }) };
await waAs(KEN, { type: "audio", audio: { id: "aud1", mime_type: "audio/ogg" } });
ok(/Logged - his oats/.test(said()) && lastTo() === KEN, "a voice note from him is transcribed and logged");
delete env.AI;
// the 21:00 verdict reaches him while HIS window is open - and only then
const E2 = async (iso) => { const sent = []; const ok2 = await fit.fitEvening(env, { waSend: async (en, to, b) => sent.push({ to, b }), waSendButtons: async (en, to, b) => sent.push({ to, b }), ownerWindowOpen: async () => store.has("wa_owner_last_in") }, T(iso)); return { ok: ok2, sent }; };
for (const u of ["kendall", "najjuko"]) await fit.fitSaveCfg(env, fit.fitCleanCfg({ start: "2026-10-03" }, Object.assign({}, fit.FIT_CFG_DEFAULT, { u })));
store.delete("fitc_in_kendall"); store.set("wa_owner_last_in", { v: new Date().toISOString() });
let ev = await E2("2026-10-04T17:05:00Z");
eq(ev.sent.map((x) => x.to), [HER], "his window closed (he has not written lately): only hers goes out");
store.set("fitc_in_kendall", { v: new Date().toISOString() }); for (const k of [...store.keys()]) if (k.startsWith("fitc_sent_")) store.delete(k);
ev = await E2("2026-10-04T17:05:00Z");
eq(ev.sent.map((x) => x.to).sort(), [KEN, HER].sort(), "his window open (he wrote just now): a verdict goes to him as well, to his own number");
store.set("fitc_in_kendall", { v: new Date(Date.now() - 30 * 3600 * 1000).toISOString() }); for (const k of [...store.keys()]) if (k.startsWith("fitc_sent_")) store.delete(k);
ev = await E2("2026-10-04T17:05:00Z");
eq(ev.sent.map((x) => x.to), [HER], "30 hours since he wrote: his 24-hour window is shut, so nothing is sent to him");
delete env.FIT_USERS;

console.log("v335: polish found by looking at the page");
store.clear(); delete env.FIT_USERS; delete env.FIT_TOKEN; outbound = [];
await fit.fitSaveCfg(env, fit.fitCleanCfg({ start: fit.addDays(today, -3) }, fit.FIT_CFG_DEFAULT));
await fit.fitPause(env, "me", fit.addDays(today, 10), 2, "trip");
const pj2 = (await jget("/fit_api")).j;
eq(pj2.paused, [fit.addDays(today, 10), fit.addDays(today, 11)], "rest days booked 10 days ahead are listed (they used to vanish when they fell outside the viewed week)");
await fit.fitAdd(env, { k: "w", x: "waist", v: 78, d: today });
const hp = (await jget("/fit_api?view=history")).j;
eq([hp.measures.waist.count, hp.measures.waist.change], [1, 0], "one reading: count 1, change 0");
await text("momo history");
ok(/📏 Waist: 78 cm \(first reading\)/.test(said()) && !/\(\+?0 cm since/.test(said()), "and the history says 'first reading' instead of '0 since the first reading'");
const pg2 = await (await call(K("/fit"))).text();
ok(/First reading/.test(pg2), "the page says it too");

console.log("v336: a write must say whose log it is (Najjuko's plan landed on Dr. Doli's)");
store.clear(); outbound = [];
env.FIT_USERS = "kendall:" + KEN + ":Dr. Doli,najjuko:" + HER + ":Black Coffee";
const firstView = (await jget("/fit_api")).j;
eq([firstView.ok, firstView.u, firstView.users], [true, "kendall", ["kendall", "najjuko"]], "a GET with no person still loads (the page needs it to ask who this is): it answers with the first person and the list");
const w0 = writes.length; writes = [];
let rw = await call(K("/fit_api"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "cfg", cfg: { goal: "saved onto the wrong person", weekMin: 480 } }) });
eq([rw.status, (await rw.json()).ok, writes.length, [...store.keys()].some((k) => k.startsWith("fitc_cfg_"))], [400, false, 0, false], "a plan save with NO person is refused (400) and writes nothing - it used to land on the first person and say saved");
rw = await post("/fit_api?u=nobody", { op: "cfg", cfg: { goal: "x" } });
eq([rw.status, writes.length], [400, 0], "an unknown person is refused too, never quietly mapped to the first");
for (const op of [{ op: "add", kind: "food", text: "x" }, { op: "pause", days: 1 }, { op: "share", on: true }, { op: "measure", what: "weight", value: 80 }, { op: "weektarget", hours: 8 }, { op: "extend" }, { op: "resume" }, { op: "del", id: "2026-10-04_1791100000000_abc123" }, { op: "edit", id: "2026-10-04_1791100000000_abc123", text: "x" }]) {
  const rr = await call(K("/fit_api"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(op) });
  if (rr.status !== 400) ok(false, "write op '" + op.op + "' was accepted without a person (" + rr.status + ")");
}
ok(writes.length === 0, "every kind of write (add, pause, share, measure, target, extend, resume, delete, edit) is refused without a person, and nothing was written");
await post("/fit_api?u=najjuko", { op: "cfg", cfg: { goal: "Fit for the wedding in March", weekMin: 480, tone: "kind" } });
const njv = (await jget("/fit_api?u=najjuko")).j, kdv = (await jget("/fit_api?u=kendall")).j;
eq([njv.cfg.goal, njv.cfg.weekMin, njv.cfg.tone, kdv.cfg.goal, kdv.cfg.weekMin, kdv.cfg.tone], ["Fit for the wedding in March", 480, "kind", "", 600, "firm"], "with the person named, hers is saved on hers and his is untouched");
const photoRes = await call(K("/fit_api?op=photo"), { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: mediaBytes });
eq(photoRes.status, 200, "the photo reader (it writes nothing) does not need a person");
const pgw = await (await call(K("/fit"))).text();
ok(/id="who"/.test(pgw) && /id="whob"/.test(pgw) && /WHO IS THIS\?/.test(pgw) && /nowho/.test(pgw), "the page carries a 'Who is this?' chooser that hides everything until a name is picked");
ok(/id="plw"/.test(pgw) && /This plan belongs to/.test(pgw) && /Plan saved for/.test(pgw), "the plan says whose it is, and the save names the person");
ok(/id="dirt"/.test(pgw) && /unsaved changes/.test(pgw), "unsaved plan edits are flagged, and not overwritten by a reload");
ok(/S\.picked=true/.test(pgw) && /localStorage\.setItem\('fit_u',n\)/.test(pgw), "choosing a name marks it picked and remembers it on this phone");
let okScript = true; try { new Function(pgw.match(/<script>([\s\S]*?)<\/script>/)[1]); } catch (e) { okScript = false; }
ok(okScript, "the page script is still valid JavaScript");
delete env.FIT_USERS;
store.clear();
const solo = await call(K("/fit_api"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "cfg", cfg: { goal: "solo" } }) });
eq([solo.status, (await solo.json()).ok], [200, true], "one person on the instance: no name needed, as before");

console.log("v348: rough protein - the table");
const tp = (t) => { const r = fit.tableProtein(t); return r ? r.g : null; };
eq([tp("Strawberry Greek yogurt"), tp("Green tea beverage in bottle"), tp("2 eggs"), tp("an egg"), tp("omelette"), tp("eggs on toast"), tp("grilled chicken, rice and salad"), tp("chicken wrap"), tp("latte"), tp("black coffee"), tp("water"), tp("kunafa"), tp("")],
  [17, 0, 12, 6, 14, 18, 37, 36, 8, 0, 0, null, null], "the built-in table: Greek yogurt 15 (not also plain yogurt) + fruit 2; a bottled tea is 0; 2 eggs 12; an omelette 14; eggs on toast 18; chicken + rice + salad 37; a latte 8; coffee and water 0; an unknown label is null");
let pcalls = 0;
const depsP = (ans) => ({ CLAUDE_FAST: "x", claudeJSON: async () => { pcalls++; return ans; } });
eq([(await fit.proteinFor(env, depsP({ protein_g: 14 }), "grilled chicken")).g, pcalls], [30, 0], "the table answers first: no model call for a food it knows");
eq([(await fit.proteinFor(env, depsP({ protein_g: 14 }), "kunafa")).g, pcalls], [14, 1], "a label the table cannot read goes to the model");
eq(await fit.proteinFor(env, depsP({ protein_g: null }), "mystery"), null, "asked and could not tell -> null (stored as 'not estimated')");
eq(await fit.proteinFor(env, depsP(null), "mystery"), undefined, "the model unreachable -> undefined (tried again later, never stored as 'none')");
eq(await fit.proteinFor(env, {}, "mystery"), undefined, "no model wired -> undefined");
eq(await fit.proteinFor(env, depsP({ protein_g: 999 }), "mystery"), null, "an absurd answer is never stored");

console.log("v348: rough protein - logging on WhatsApp");
store.clear(); delete env.FIT_USERS; outbound = []; aiCalls = [];
const PSYS = /ROUGH estimate of the protein/;
aiAnswer = (sys) => (PSYS.test(sys) ? { protein_g: 14 } : {});
const entryOf = (needle) => { const k = fitKeys().find((x) => JSON.parse(store.get(x).v).x === needle); return k ? JSON.parse(store.get(k).v) : null; };
await text("food: grilled chicken and rice");
ok(/About 35 g protein \(rough estimate\)/.test(said()) && aiCalls.length === 0, "'food: grilled chicken and rice' says about 35 g, from the table, with no model call");
eq([entryOf("grilled chicken and rice").p, entryOf("grilled chicken and rice").pr], [35, "rough"], "and the estimate is stored on the entry");
await text("food: Green tea beverage in bottle");
ok(/About 0 g protein/.test(said()), "a bottled tea is 0 g");
await text("food: kunafa");
ok(/About 14 g protein/.test(said()) && aiCalls.filter((c) => PSYS.test(c.sys)).length === 1, "an unknown label asks the model once and says about 14 g");
aiAnswer = () => ({});
await text("food: halwa");
ok(/Protein: not estimated/.test(said()) && entryOf("halwa").pr === "none" && entryOf("halwa").p === undefined, "when nobody can tell it says 'not estimated' and stores no number");
aiAnswer = (sys, u) => (/log food and exercise/.test(sys) ? { kind: "food", text: "Mixed salad with halloumi", type: null, minutes: null, steps: null, day_offset: 0, protein_g: 21 } : {});
aiCalls = []; await text("had a salad with halloumi for lunch");
ok(entryOf("Mixed salad with halloumi").p === 21 && !aiCalls.some((c) => PSYS.test(c.sys)), "free text: the classifier's own protein guess is used, with no second model call");

console.log("v348: momo today");
store.clear(); outbound = []; aiAnswer = () => ({});
await text("food: eggs and toast"); await text("food: Strawberry Greek yogurt");
await text("momo today"); const mt = said();
ok(/what you ate/.test(mt) && /1\. \d\d:\d\d/.test(mt) && /eggs and toast - about 18 g protein/.test(mt) && /2\. \d\d:\d\d/.test(mt) && /Strawberry Greek yogurt - about 17 g protein/.test(mt), "momo today lists each meal with its time and its rough protein");
ok(/Protein so far: about 35 g/.test(mt) && /rough estimate, not nutrition advice/.test(mt), "with the day's total, called rough, and not advice");
ok(!/\p{Extended_Pictographic}/u.test(mt), "and no emoji in it");
await text("momo meals"); ok(/what you ate/.test(said()), "'momo meals' is the same");
await text("momo protein 120");
ok(/Protein guide set: 120 g a day/.test(said()) && /not nutrition advice/.test(said()), "momo protein 120 sets an optional guide (and says it is not advice)");
await text("food: 2 eggs"); ok(/Protein today: about 47 of 120 g \(rough\)/.test(said()), "with a guide set, the day's state shows about 47 of 120 g");
await text("momo protein 999"); ok(/out of range/.test(said()), "an absurd guide is refused");
eq((await (await post("/fit_api", { op: "cfg", cfg: { proteinTarget: 9999 } })).json()).cfg.proteinTarget, 120, "the page cannot save an absurd guide either: the previous one stays");
await text("momo protein off"); eq((await jget("/fit_api")).j.cfg.proteinTarget, 0, "momo protein off removes the guide (default: none)");

console.log("v348: catching up meals logged before this existed");
store.clear(); outbound = [];
await fit.fitSaveCfg(env, fit.fitCleanCfg({ start: fit.addDays(today, -25) }, fit.FIT_CFG_DEFAULT));
for (const x of ["Oats with berries", "mystery stew"]) await fit.fitAdd(env, { k: "food", x, t: Date.now(), d: today, s: "web" });
aiAnswer = (sys) => (PSYS.test(sys) ? { protein_g: 11 } : {});
let dayR = (await jget("/fit_api")).j;
const byX = (j, x) => j.entries.find((e) => e.x === x);
eq([byX(dayR, "Oats with berries").p, byX(dayR, "Oats with berries").pr, byX(dayR, "mystery stew").p, dayR.stats.protein, dayR.stats.pmeals], [8, "rough", 11, 19, 2], "opening a day estimates its old meals: the table for oats and berries, the model for the stew");
ok(JSON.parse(store.get(fitKeys().find((k) => JSON.parse(store.get(k).v).x === "mystery stew")).v).pr === "rough", "and the estimate is saved, so it is not asked again");
for (let k = 0; k < 10; k++) await fit.fitAdd(env, { k: "food", x: "2 eggs", t: Date.now() + k + 1, d: today, s: "web" });
eq((await jget("/fit_api")).j.stats.pmeals, 10, "at most 8 meals are caught up per request (2 already + 8 = 10)");
eq((await jget("/fit_api")).j.stats.pmeals, 12, "the next request finishes the rest");
const old20 = fit.addDays(today, -20); await fit.fitAdd(env, { k: "food", x: "2 eggs", t: Date.parse(old20 + "T08:00:00Z"), d: old20, s: "web" });
const y1 = fit.addDays(today, -1); await fit.fitAdd(env, { k: "food", x: "2 eggs", t: Date.parse(y1 + "T08:00:00Z"), d: y1, s: "web" });
const hx = (await jget("/fit_api?view=history")).j;
eq([hx.days.find((x) => x.d === y1).pmeals, hx.days.find((x) => x.d === old20).pmeals], [1, 0], "the history catches up the last two weeks, not older days");
eq((await jget("/fit_api?d=" + old20)).j.stats.pmeals, 1, "an older day is caught up when it is opened");
const kOff = env.ANTHROPIC_API_KEY; env.ANTHROPIC_API_KEY = undefined;
const y2 = fit.addDays(today, -2); await fit.fitAdd(env, { k: "food", x: "kunafa special", t: Date.parse(y2 + "T08:00:00Z"), d: y2, s: "web" });
const dOff = (await jget("/fit_api?d=" + y2)).j;
ok(dOff.entries[0].pr === undefined && dOff.stats.pmeals === 0, "with the model unreachable a meal is left as it was (not marked 'none'), to be tried again");
env.ANTHROPIC_API_KEY = kOff;
eq((await jget("/fit_api?d=" + y2)).j.entries[0].p, 11, "and it is estimated on the next visit");
const edited = (await jget("/fit_api?d=" + y2)).j.entries[0];
await post("/fit_api", { op: "edit", id: edited.id, text: "2 eggs" });
const afterEdit = (await jget("/fit_api?d=" + y2)).j.entries[0];
eq([afterEdit.x, afterEdit.p], ["2 eggs", 12], "changing a meal's description re-estimates it");

console.log("v348: the history catches up the newest days first");
store.clear(); outbound = [];
await fit.fitSaveCfg(env, fit.fitCleanCfg({ start: fit.addDays(today, -9) }, fit.FIT_CFG_DEFAULT));
for (let o = 0; o < 6; o++) for (const hm of ["08:00", "13:00"]) { const d = fit.addDays(today, -o); await fit.fitAdd(env, { k: "food", x: "2 eggs", t: Date.parse(d + "T" + hm + ":00Z"), d, s: "web" }); }
const hNew = (await jget("/fit_api?view=history")).j;
eq([0, 1, 2, 3, 4, 5].map((o) => hNew.days.find((x) => x.d === fit.addDays(today, -o)).pmeals), [2, 2, 2, 2, 0, 0], "12 old meals, 8 per request: the four newest days are done first, the two oldest wait for the next visit");
eq((await jget("/fit_api?view=history")).j.days.find((x) => x.d === fit.addDays(today, -5)).pmeals, 2, "and the next visit finishes them");

console.log("v348: a day with a photo meal and a text meal");
store.clear(); outbound = [];
aiAnswer = (sys) => (/read a photo someone sent to log what they ate/.test(sys) ? { meal: "Chicken shawarma plate with salad" } : {});
await wa({ type: "image", image: { id: "mid5", mime_type: "image/jpeg", caption: "lunch" } });
await text("food: eggs and toast");
const dd = (await jget("/fit_api")).j, ml = dd.entries.filter((e) => e.k === "food");
eq(ml.map((e) => [e.s, e.x, e.p, e.pr]), [["photo", "Chicken shawarma plate with salad", 32, "rough"], ["wa", "eggs and toast", 18, "rough"]], "the photo meal and the text meal are both on the day, with their source and protein");
eq([dd.stats.protein, dd.stats.pmeals, dd.stats.meals], [50, 2, 2], "the day adds up to about 50 g");
ok(![...store.values()].some((e) => String(e.v).includes(MARK)), "and still no picture is stored anywhere");

console.log("v348: weekly average, and the people never mix");
store.clear(); outbound = [];
const lw = fit.addDays(fit.weekStart(today), -7);
await fit.fitSaveCfg(env, fit.fitCleanCfg({ start: fit.addDays(lw, -3) }, fit.FIT_CFG_DEFAULT));
for (const [o, g] of [[0, 40], [1, 60]]) { const d = fit.addDays(lw, o); await fit.fitAdd(env, { k: "food", x: "a meal", t: Date.parse(d + "T08:00:00Z"), d, s: "web", est: { g, how: "rough" } }); }
const sm = await fit.fitSummary(env, fit.addDays(lw, 3), await fit.fitCfg(env), today);
eq([sm.week.protein.total, sm.week.protein.days, sm.week.protein.avg], [100, 2, 50], "the week's protein: total 100, on 2 days with estimated meals, average 50");
const hw = (await jget("/fit_api?view=history")).j, wkp = hw.weeks.find((w) => w.ws === lw);
eq([wkp.pavg, hw.totals.pavg, hw.totals.pdays], [50, 50, 2], "history carries the weekly and overall average");
store.clear(); aiAnswer = () => ({});
env.FIT_USERS = "kendall:" + KEN + ":Dr. Doli,najjuko:" + HER + ":Black Coffee";
await post("/fit_api?u=kendall", { op: "add", kind: "food", text: "his chicken and rice" });
await text("food: her oats");
const foods = (j) => j.entries.filter((e) => e.k === "food").map((e) => e.x);
eq([foods((await jget("/fit_api?u=kendall")).j), foods((await jget("/fit_api?u=najjuko")).j)], [["his chicken and rice"], ["her oats"]], "each person's list shows only their own meals");
const hk = (await jget("/fit_api?view=history&u=kendall")).j, hn = (await jget("/fit_api?view=history&u=najjuko")).j;
eq([hk.days[hk.days.length - 1].meals, hn.days[hn.days.length - 1].meals, hk.days[hk.days.length - 1].protein, hn.days[hn.days.length - 1].protein], [1, 1, 35, 6], "History counts and protein are per person (35 g his, 6 g hers)");
await text("momo today"); ok(/her oats/.test(said()) && !/his chicken/.test(said()), "momo today from her number lists only hers");
const csvN = await (await call(K("/fit_api?view=csv&u=najjuko"))).text();
ok(/her oats/.test(csvN) && !/his chicken/.test(csvN) && /protein_g_rough/.test(csvN), "her CSV never carries his meals, and has the protein column");
delete env.FIT_USERS; store.clear();

console.log("v348: the page - cards, icons, no emoji, nothing internal");
const pgM = await (await call(K("/fit"))).text();
const scriptM = pgM.match(/<script>([\s\S]*?)<\/script>/)[1];
ok(!/\p{Extended_Pictographic}/u.test(pgM) && !/&#1\d{5};|&#x1f/i.test(pgM), "the page has no emoji (every mark is an icon)");
ok(/"meal":"M/.test(pgM) && /"check":"M/.test(pgM) && /"del":"M/.test(pgM) && /function ic\(/.test(scriptM), "the icons are drawn inline from the icon set");
ok(!/<ul|<ol|<li\b/i.test(pgM) && !/createElement\('(ul|ol|li)'\)/.test(scriptM) && /'mc'/.test(scriptM) && /'dc/.test(scriptM), "meals, days and weeks are cards, not lists");
ok(/What I ate/.test(pgM) && /WHAT I ATE/.test(pgM) && /Rough estimate, not nutrition advice/.test(pgM) && /id="prot"/.test(pgM) && /id="s_protein"/.test(pgM), "the page says What I ate, shows the protein card, and says rough and not advice");
ok(/openDay\(/.test(scriptM) && /What I ate \(/.test(scriptM) && /Open this day/.test(scriptM) && /tap a week/i.test(scriptM), "a day opens its meals, a week opens its days");
const BAD = /claude|haiku|sonnet|anthropic|openai|\bgpt\b|\bllm\b|\bmodel\b|fitc_|\bKV\b|worker|endpoint|FIT_TOKEN|FIT_USERS/i;   // words that must never reach a person
const BROKEN = /undefined|NaN|\[object/;   // a rendering slip: checked in what a person SEES (the page with its script removed, and every reply), not in the script, where undefined is a normal keyword
ok(!BAD.test(pgM), "no model is named and nothing internal appears anywhere on the page, script included");
ok(!BROKEN.test(pgM.replace(/<script>[\s\S]*?<\/script>/, "")), "and no undefined, NaN or [object] in the visible page");
store.clear(); outbound = []; aiAnswer = () => ({});
await text("food: grilled chicken and rice"); const r1m = said(); await text("momo today"); const r2m = said(); await text("momo protein 120"); const r3m = said(); await text("momo help"); const r4m = said();
ok(![r1m, r2m, r3m, r4m].some((m) => BAD.test(m) || BROKEN.test(m)), "no model is named, nothing internal and no undefined/NaN appears in any new WhatsApp reply");
ok(!/\p{Extended_Pictographic}/u.test(r2m) && !/\p{Extended_Pictographic}/u.test(r3m), "the new replies carry no emoji");
let okScript2 = true; try { new Function(scriptM); } catch (e) { okScript2 = false; } ok(okScript2, "the page script is valid JavaScript");

console.log("v351: journal - storage, limits, newest first");
store.clear(); delete env.FIT_USERS; outbound = []; aiCalls = [];
const SECRET = "ZEBRA-SECRET-LINE";
const e1 = await fit.jAdd(env, "me", { text: "first " + SECRET, title: "Monday", mood: 4, t: Date.parse("2026-10-05T05:00:00Z"), d: "2026-10-05" });
const e2 = await fit.jAdd(env, "me", { text: "second", t: Date.parse("2026-10-05T17:00:00Z"), d: "2026-10-05" });
const e3 = await fit.jAdd(env, "me", { text: "third day", mood: 9, t: Date.parse("2026-10-06T05:00:00Z"), d: "2026-10-06" });
eq([e1.mood, e2.mood, e3.mood, e1.title, e2.title], [4, 0, 0, "Monday", ""], "the title is optional; a mood outside 1 to 5 is dropped, not stored");
eq((await fit.jList(env, "me")).map((m) => m.id === e3.id ? "c" : m.id === e2.id ? "b" : "a").join(""), "cba", "entries list newest first");
eq((await fit.jList(env, "me", { day: "2026-10-05" })).length, 2, "and a day can be listed on its own");
eq(await fit.jAdd(env, "me", { text: "   " }), null, "an empty entry is refused");
const longT = "\u0645".repeat(6000), eL = await fit.jAdd(env, "me", { text: longT, title: "\u0639".repeat(200) });
eq([eL.x.length, eL.title.length], [4000, 80], "text is capped at 4000 characters and a title at 80");
const metaSz = new TextEncoder().encode(JSON.stringify(store.get("fitj_me_" + eL.id).meta)).length;
ok(metaSz <= 1024, "the list metadata stays under the storage limit even for long text in a script that takes 2 bytes a character (" + metaSz + " bytes)");
eq((await fit.jEdit(env, "me", e2.id, { text: "second, edited", title: "Evening", mood: 2 })).x, "second, edited", "an entry can be edited");
eq(await fit.jEdit(env, "me", e2.id, { text: "" }), null, "but not emptied");
ok(await fit.jDel(env, "me", e2.id) && (await fit.jGet(env, "me", e2.id)) === null, "and deleted");
eq([await fit.jGet(env, "me", "../x"), await fit.jDel(env, "me", "nope")], [null, false], "a made-up id is refused");

console.log("v351: journal on WhatsApp - saved for the sender, nothing else sees it");
store.clear(); outbound = []; aiCalls = [];
aiAnswer = () => ({});
await text("journal: today I felt calm " + SECRET);
ok(/Saved to your journal/.test(said()) && btns().some((x) => x.startsWith("fit:jundo:me:")) && !said().includes(SECRET), "'journal: ...' saves and replies 'Saved to your journal' with an Undo, without repeating the text");
eq([[...store.keys()].filter((k) => k.startsWith("fitj_me_")).length, aiCalls.length], [1, 0], "one entry, and no model was asked anything");
await text("momo journal: and this one too");
eq([...store.keys()].filter((k) => k.startsWith("fitj_me_")).length, 2, "'momo journal: ...' works too");
const nBefore = [...store.keys()].filter((k) => k.startsWith("fitj_")).length;
await text("journal entry is due on Friday"); eq([...store.keys()].filter((k) => k.startsWith("fitj_")).length, nBefore, "a typed sentence that merely starts with the word is NOT a journal entry (it needs the colon)");
store.set("pending_wa_" + HER, { v: "journal entry is due on Friday" });   // as the older flow leaves it after asking 'When is it?'
await text("journal: written while another flow was waiting QQTOKEN");
ok(/Saved to your journal/.test(said()) && [...store.keys()].filter((k) => k.startsWith("fitj_me_")).length === 3, "an explicit journal line is NOT eaten as the answer to 'When is it?' - it still goes to the journal");
ok(![...store.entries()].some(([k, v]) => !k.startsWith("fitj_") && !k.startsWith("wa_inbox") && String(v.v).includes("QQTOKEN")), "and none of it leaked into a meeting, a task or the waiting follow-up");
store.delete("pending_wa_" + HER);
const vr = await wa({ type: "audio", audio: { id: "VOICE1", mime_type: "audio/ogg" } });
env.AI = { run: async () => ({ text: "Journal. This morning I walked and thought about the week " + SECRET + "-voice" }) };
await wa({ type: "audio", audio: { id: "VOICE2", mime_type: "audio/ogg" } });
ok(/Saved to your journal/.test(said()) && [...store.keys()].filter((k) => k.startsWith("fitj_me_")).length === 4, "a voice note that opens with 'journal' is saved");
env.AI = { run: async () => ({ text: "Buy milk and call the bank" }) };
const nv = [...store.keys()].filter((k) => k.startsWith("fitj_")).length; await wa({ type: "audio", audio: { id: "VOICE3", mime_type: "audio/ogg" } });
eq([...store.keys()].filter((k) => k.startsWith("fitj_")).length, nv, "an ordinary voice note is not a journal entry");
delete env.AI;
await text("momo journal"); const jl = said();
ok(/Your journal today \((4)\)/.test(jl) && jl.includes(SECRET) && jl.includes("and this one too"), "'momo journal' lists today's entries (it goes to the sender's own phone) - got: " + JSON.stringify(jl.slice(0, 200)));
const lastJ = [...store.keys()].filter((k) => k.startsWith("fitj_me_")).pop();
await wa({ type: "interactive", interactive: { type: "button_reply", button_reply: { id: "fit:jundo:me:" + JSON.parse(store.get(lastJ).v).id, title: "Undo" } } });
ok(/Removed from your journal/.test(said()) && !store.has(lastJ), "the Undo button removes that entry");
const wi = JSON.stringify(JSON.parse(store.get("wa_inbox").v));
ok(!wi.includes(SECRET) && /\(journal entry\)/.test(wi), "the inbound log never holds a journal line (it says '(journal entry)')");
ok([...store.entries()].filter(([k, v]) => String(v.v).includes(SECRET)).every(([k]) => k.startsWith("fitj_")), "the text exists only under fitj_ keys: no log, no other record, anywhere");

console.log("v351: journal - nobody else ever sees it");
store.clear(); outbound = [];
env.FIT_USERS = "kendall:" + KEN + ":Dr. Doli,najjuko:" + HER + ":Black Coffee";
const hisE = await fit.jAdd(env, "kendall", { text: "his private thought " + SECRET, title: "Mine" });
await text("journal: her private line " + SECRET + "-HER");
await post("/fit_api?u=kendall", { op: "add", kind: "food", text: "his eggs" });
await post("/fit_api?u=kendall", { op: "share", on: true }); await post("/fit_api?u=najjuko", { op: "share", on: true });
const respsK = [(await jget("/fit_api?u=kendall")).j, (await jget("/fit_api?u=kendall&view=history")).j, (await jget("/fit_api?u=najjuko")).j, (await jget("/fit_api?u=najjuko&view=history")).j];
ok(!JSON.stringify(respsK).includes(SECRET), "no journal text in the day view, the history, or the sharing (both people sharing, both views checked)");
const csvK = await (await call(K("/fit_api?view=csv&u=kendall"))).text(), csvN2 = await (await call(K("/fit_api?view=csv&u=najjuko"))).text();
ok(!csvK.includes(SECRET) && !csvN2.includes(SECRET), "nor in either CSV");
const jn = (await jget("/fit_api?view=journal&u=najjuko")).j, jk = (await jget("/fit_api?view=journal&u=kendall")).j;
eq([jn.entries.length, jk.entries.length, JSON.stringify(jn).includes("his private"), JSON.stringify(jk).includes("her private")], [1, 1, false, false], "each person's journal list holds only their own entries");
eq([(await call(K("/fit_api?view=journal&u=najjuko&id=" + hisE.id))).status, (await call(K("/fit_api?view=journal&u=kendall&id=" + hisE.id))).status], [404, 200], "his entry's id opened under HER name is not found; under his it opens");
await text("momo"); await text("momo today"); await text("momo week"); await text("momo history");
ok(!outbound.some((o) => JSON.stringify(o).includes("his private")), "no WhatsApp summary (status, today, week, history) ever carries anyone's journal");
eq((await call(K("/fit_api?view=journal&u=kendall", CLIENT))).status, 404, "a client link gets nothing");
eq((await call("/fit_api?view=journal&u=kendall")).status, 404, "no key gets nothing");
eq((await post("/fit_api", { op: "jadd", text: "no person named" })).status, 400, "a write that names nobody is refused");

console.log("v351: the optional PIN");
const pr1 = await (await post("/fit_api?u=kendall", { op: "jpin", pin: "12ab" })).json();
eq(pr1.ok, false, "a PIN must be four digits");
eq((await (await post("/fit_api?u=kendall", { op: "jpin", pin: "4821" })).json()).ok, true, "a PIN can be set");
ok(!JSON.stringify([...store.entries()].filter(([k]) => k.startsWith("fitc_pin_"))).includes("4821"), "and it is stored only as a salted hash, never the digits");
const lk = (await jget("/fit_api?view=journal&u=kendall")).j;
eq([lk.pin, lk.locked, lk.entries.length], [true, true, 0], "with a PIN set and no unlock, the journal list is empty and says locked");
eq((await call(K("/fit_api?view=journal&u=kendall&id=" + hisE.id))).status, 403, "an entry cannot be opened without the unlock");
eq([(await post("/fit_api?u=kendall", { op: "jadd", text: "x" })).status, (await post("/fit_api?u=kendall", { op: "jdel", id: hisE.id })).status], [403, 403], "writes are refused too");
eq((await jget("/fit_api?view=journal&u=najjuko")).j.locked, false, "her journal is not locked by his PIN");
const bad1 = await post("/fit_api?u=kendall", { op: "junlock", pin: "0000" }); const bj = await bad1.json();
eq([bad1.status, /4 tries left/.test(bj.why)], [403, true], "a wrong PIN says how many tries are left (4 of 5 remain after the first)");
const okU = await (await post("/fit_api?u=kendall", { op: "junlock", pin: "4821" })).json();
ok(okU.ok && /^[0-9a-f]{24}$/.test(okU.token), "the right PIN gives a short-lived token");
const unlocked = (await jget("/fit_api?view=journal&u=kendall&jt=" + okU.token)).j;
eq([unlocked.locked, unlocked.entries.length], [false, 1], "with the token the journal opens");
eq((await post("/fit_api?u=kendall", { op: "jadd", text: "written while unlocked", jt: okU.token })).status, 200, "and writing works with it");
eq((await jget("/fit_api?view=journal&u=najjuko&jt=" + okU.token)).j.locked, false, "(her journal has no PIN)");
await post("/fit_api?u=najjuko", { op: "jpin", pin: "1111" });
eq((await jget("/fit_api?view=journal&u=najjuko&jt=" + okU.token)).j.locked, true, "his token does not open HER journal once she has a PIN");
let lastR; for (let k = 0; k < 6; k++) lastR = await post("/fit_api?u=kendall", { op: "junlock", pin: "9999" });
eq(lastR.status, 429, "five wrong tries lock the unlock for 15 minutes (429)");
eq((await post("/fit_api?u=kendall", { op: "junlock", pin: "4821" })).status, 429, "even the right PIN is refused while locked");
store.delete("fitc_pinfail_kendall");
eq((await post("/fit_api?u=kendall", { op: "jpin", pin: "5555", current: "0000" })).status, 403, "changing the PIN needs the current one");
eq((await post("/fit_api?u=kendall", { op: "jpin", pin: "5555", current: "4821" })).status, 200, "and works with it");
eq((await jget("/fit_api?view=journal&u=kendall&jt=" + okU.token)).j.locked, true, "changing the PIN ends every earlier unlock");
await text("journal: whatsapp still works with a PIN set");
const hisWa = [...store.keys()].filter((k) => k.startsWith("fitj_najjuko_")).length; ok(hisWa >= 2, "on WhatsApp the phone number is the lock: a PIN on the page does not stop 'journal:' (hers, from her number)");
eq((await post("/fit_api?u=kendall", { op: "jpin", pin: "", current: "5555" })).status, 200, "the PIN can be removed with the current one");
eq((await jget("/fit_api?view=journal&u=kendall")).j.locked, false, "and the journal is open again");
delete env.FIT_USERS;

console.log("v351: write in my book - streak arithmetic");
const dd0 = "2026-10-12";
const sset = (...o) => new Set(o.map((n) => fit.addDays(dd0, -n)));
eq([fit.bookStreak(sset(1, 2, 4), sset(), dd0), fit.bookStreak(sset(1, 2, 4), sset(3), dd0), fit.bookStreak(sset(0, 1, 2), sset(), dd0), fit.bookStreak(sset(2, 3), sset(), dd0), fit.bookStreak(sset(), sset(), dd0)], [2, 3, 3, 0, 0],
  "streak: yesterday and the day before = 2; a rest day between carries over (3); today done counts (3); a gap yesterday = 0; nothing = 0");
eq([fit.bookStreak(sset(2, 3), sset(0, 1), dd0), fit.bookStreak(sset(0), sset(1, 2), dd0), fit.bookStreak(sset(5), sset(1, 2, 3, 4), dd0)], [2, 1, 1], "rest days at the front, or several in a row, neither add nor break");
eq([fit.parseClock("21:30"), fit.parseClock("9pm"), fit.parseClock("9:05 am"), fit.parseClock("12am"), fit.parseClock("12pm"), fit.parseClock("7"), fit.parseClock("25:00"), fit.parseClock("soon"), fit.parseClock("13pm")],
  ["21:30", "21:00", "09:05", "00:00", "12:00", "07:00", null, null, null], "'momo book' times: 24-hour, 9pm, 9:05 am, noon and midnight, a bare hour, and nonsense is refused");
store.clear();
const cfgB = Object.assign(await fit.fitCfg(env), {});
await fit.bookMark(env, "me", fit.addDays(today, -3), true);
await fit.bookMark(env, "me", fit.addDays(today, -1), true);
await fit.fitPause(env, "me", fit.addDays(today, -2), 1, "ill");
const bi = await fit.bookInfo(env, cfgB, today);
eq([bi.days.length, bi.days[29].s, bi.days[28].s, bi.days[27].s, bi.days[26].s, bi.days[25].s, bi.streak, bi.doneToday], [30, "today", "done", "rest", "done", "none", 2, false], "30 dots: today pending, yesterday done, the rest day, the day before done, and days before the habit began are neutral (streak 2 across the rest day)");
await fit.bookMark(env, "me", fit.addDays(today, -4), false);
await fit.bookMark(env, "me", fit.addDays(today, -5), false);
eq((await fit.bookInfo(env, cfgB, today)).days[25].s, "none", "a day before the habit began is never called missed");

console.log("v351: write in my book - WhatsApp");
store.clear(); outbound = []; aiAnswer = () => ({});
await text("momo book"); ok(/Book reminder on: every day at 21:30/.test(said()), "'momo book' turns it on at the default 21:30");
await text("momo book 9pm"); eq([/at 21:00/.test(said()), (await fit.fitCfg(env)).bookTime, (await fit.fitCfg(env)).bookOn], [true, "21:00", true], "'momo book 9pm' sets 21:00");
await text("momo book soon"); ok(/did not catch the time/.test(said()), "a time it cannot read is not guessed");
await text("momo book"); ok(/Book reminder: on, at 21:00/.test(said()) && /Not yet today/.test(said()), "'momo book' on its own reports the state");
await text("momo booked"); ok(/Marked: you wrote in your book today/.test(said()), "'momo booked' marks the day");
await text("momo book"); ok(/Written today/.test(said()) && /Streak: 1 day\./.test(said()), "the state then says written, with the streak");
await text("momo book off"); eq([/Book reminder off/.test(said()), (await fit.fitCfg(env)).bookOn], [true, false], "'momo book off' stops it");
await wa({ type: "interactive", interactive: { type: "button_reply", button_reply: { id: "fit:booked:me", title: "Done" } } });
ok(/Marked: you wrote in your book today/.test(said()), "the Done button marks it too");

console.log("v351: write in my book - the reminder, inside the window only");
store.clear(); outbound = [];
await fit.fitSaveCfg(env, Object.assign(fit.fitCleanCfg({ bookOn: true, bookTime: "21:30", tone: "firm" }, fit.FIT_CFG_DEFAULT), {}));
const sentR = []; const dRem = { waSend: async (en, to, b) => sentR.push({ to, b }), waSendButtons: async (en, to, b, bt) => sentR.push({ to, b, bt }), ownerWindowOpen: async () => store.has("wa_owner_last_in") };
const R = async (iso, d) => { sentR.length = 0; const n = await fit.fitReminders(env, d || dRem, T(iso)); return n; };
const DAY = "2026-10-06";
eq(await R(DAY + "T17:20:00Z"), 0, "before the time (21:20 Dubai): nothing");
eq(await R(DAY + "T17:40:00Z"), 0, "at the time but the 24-hour window is closed: nothing is sent (no template)");
store.set("wa_owner_last_in", { v: new Date().toISOString() });
eq([await R(DAY + "T17:40:00Z"), sentR.length], [1, 1], "the window opens (she wrote): it is sent, once");
ok(sentR[0].to === HER && /Time to write in your book/.test(sentR[0].b) && sentR[0].bt[0].id === "fit:booked:me" && sentR[0].bt[0].title === "Done", "to her number, with a one-tap Done");
eq(await R(DAY + "T17:45:00Z"), 0, "never twice in a day");
eq(await R(DAY + "T18:20:00Z"), 0, "and not after the 30 minutes are over (22:20 Dubai)");
eq([await R("2026-10-07T17:40:00Z"), sentR.length], [1, 1], "the next day it is sent again");
await fit.bookMark(env, "me", "2026-10-08", true);
eq(await R("2026-10-08T17:40:00Z"), 0, "already written today: no reminder");
await fit.fitPause(env, "me", "2026-10-09", 1, "ill");
eq(await R("2026-10-09T17:40:00Z"), 0, "a rest day: no reminder");
await fit.fitSaveCfg(env, Object.assign(fit.fitCleanCfg({ bookOn: false }, await fit.fitCfg(env)), {}));
eq(await R("2026-10-10T17:40:00Z"), 0, "switched off: no reminder");
const wordsOf = async (tone, jr, withEntry) => { store.clear(); store.set("wa_owner_last_in", { v: new Date().toISOString() }); await fit.fitSaveCfg(env, fit.fitCleanCfg({ bookOn: true, tone, journalRemind: jr }, fit.FIT_CFG_DEFAULT)); if (withEntry) await fit.jAdd(env, "me", { text: "x", d: "2026-10-11", t: Date.parse("2026-10-11T05:00:00Z") }); await R("2026-10-11T17:40:00Z"); return sentR.length ? sentR[0].b : ""; };
const wKind = await wordsOf("kind", false), wFirm = await wordsOf("firm", false), wBrutal = await wordsOf("brutal", false);
ok(/gentle reminder/.test(wKind) && !/should|promise|said you would|failed/i.test(wKind + wFirm) && /said you would/.test(wBrutal), "kind and firm wording carry no guilt; only brutal says 'you said you would'");
const wJ = await wordsOf("firm", true, false), wJ2 = await wordsOf("firm", true, true);
ok(/journal/i.test(wJ) && !/journal/i.test(wJ2), "with 'also remind me to journal' the reminder adds a journal line - unless there is already an entry today");
store.clear(); store.set("wa_owner_last_in", { v: new Date().toISOString() });
env.FIT_USERS = "kendall:" + KEN + ":Dr. Doli,najjuko:" + HER + ":Black Coffee";
for (const u of ["kendall", "najjuko"]) await fit.fitSaveCfg(env, fit.fitCleanCfg({ bookOn: true }, Object.assign({}, fit.FIT_CFG_DEFAULT, { u })));
await R("2026-10-12T17:40:00Z"); eq(sentR.map((x) => x.to), [HER], "two people: only the one whose window is open is reminded (him: not while he has not written)");
store.set("fitc_in_kendall", { v: new Date().toISOString() }); store.delete("fitc_bk_sent_najjuko_2026-10-12");
await R("2026-10-12T17:41:00Z"); eq(sentR.map((x) => x.to).sort(), [KEN, HER].sort(), "once he has written (his window is open) he gets his own, to his own number");
delete env.FIT_USERS;
const idxSrc = (await import("node:fs")).readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
eq((idxSrc.match(/fitReminders\(env, fitDeps\(\)/g) || []).length, 2, "the reminder runs on both cron paths (the minute tick and the 5/30-minute run)");


console.log("v352: HOW YOU ARE DOING - the pop-up sheet (clock-pinned, per person, in their tone)");
store.clear(); outbound = [];
env.FIT_USERS = "kendall:" + KEN + ":Dr. Doli,najjuko:" + HER + ":Black Coffee";
const EMOJIZ = /[\u{1F000}-\u{1FAFF}\u{2300}-\u{23FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;
const mkcfgZ = async (u, o) => { const c = fit.fitCleanCfg(Object.assign({ start: "2026-10-01" }, o || {}), Object.assign({}, fit.FIT_CFG_DEFAULT, { u })); await fit.fitSaveCfg(env, c); return await fit.fitCfg(env, u); };
const FBZ = async (u, iso) => fit.fitFeedback(env, await fit.fitCfg(env, u), T(iso));
const ATZ = (u, k, o) => fit.fitAdd(env, Object.assign({ u, k }, o));
// Wed 7 Oct 2026. GST = UTC+4: 08:30 = 04:30Z, 12:00 = 08:00Z, 19:00 = 15:00Z, 21:10 = 17:10Z
const WEDZ = "2026-10-07", MZ = "2026-10-07T04:30:00Z", MIDZ = "2026-10-07T08:00:00Z", EVEZ = "2026-10-07T15:00:00Z", VERZ = "2026-10-07T17:10:00Z";
await mkcfgZ("kendall", { tone: "firm" }); await mkcfgZ("najjuko", { tone: "kind" });
let f = await FBZ("kendall", MZ);
eq([f.mode, f.empty, f.key], ["morning", true, "kendall_" + WEDZ + "_morning"], "08:30 is the morning, an empty day says so, and the key names person, day and mode");
ok(/Nothing logged yet/.test(f.head), "an empty day: a friendly 'nothing logged yet' (" + f.head + ")");
eq([(await FBZ("kendall", MIDZ)).mode, (await FBZ("kendall", EVEZ)).mode, (await FBZ("kendall", VERZ)).mode, (await FBZ("kendall", "2026-10-07T06:59:00Z")).mode, (await FBZ("kendall", "2026-10-07T07:00:00Z")).mode, (await FBZ("kendall", "2026-10-07T12:59:00Z")).mode, (await FBZ("kendall", "2026-10-07T13:00:00Z")).mode, (await FBZ("kendall", "2026-10-07T17:00:00Z")).mode],
  ["midday", "evening", "verdict", "morning", "midday", "midday", "evening", "verdict"], "the four times of day: before 11:00, 11:00-17:00, 17:00-21:00, from 21:00");
const eggsFb = await ATZ("kendall", "food", { x: "Eggs on toast", t: T("2026-10-07T03:30:00Z"), d: WEDZ, s: "wa", est: { g: 14, how: "rough" } });
const gymFb = await ATZ("kendall", "ex", { x: "Gym", m: 45, t: T("2026-10-07T03:00:00Z"), d: WEDZ });
f = await FBZ("kendall", MIDZ);
eq([f.empty, f.floor.done, f.windows.map((w) => w.state)], [false, true, ["done", "open", "later"]], "midday with breakfast and a workout: floor done, breakfast done, lunch open, evening later");
ok(/^Log your Lunch meal before 14:00/.test(f.next) && f.open.some((x) => /Lunch is open until 14:00/.test(x.t)), "midday names what is missing: the lunch window, and the ONE next step is that meal (" + f.next + ")");
eq([f.today.meals, f.today.minutes, f.today.protein], [1, 45, 14], "today so far: meals, minutes, rough protein");
await fit.fitDelete(env, gymFb.id, "kendall");
f = await FBZ("kendall", MIDZ);
ok(!f.floor.done && f.floor.needMin === 30 && f.open.some((x) => /Exercise: 30 min more/.test(x.t)) && /^Do 30 min of anything that moves/.test(f.next), "no workout yet: 30 min still open for today's qualification, and that is the one next step (" + f.next + ")");
f = await FBZ("kendall", EVEZ);
ok(f.mode === "evening" && /Before 21:00\.$/.test(f.next), "evening: the closing push says before 21:00 (" + f.next + ")");
f = await FBZ("kendall", VERZ);
ok(f.mode === "verdict" && /You missed today/.test(f.head) && /^Tomorrow: 30 minutes/.test(f.next), "after 21:00 it is the verdict, in firm tone, and the one step is tomorrow's (" + f.head.slice(0, 60) + ")");
const headsFb = {};
for (const tone of ["kind", "firm", "brutal"]) { await mkcfgZ("kendall", { tone }); headsFb[tone] = (await FBZ("kendall", VERZ)).head; }
ok(new Set(Object.values(headsFb)).size === 3, "the three tones say three different things for the same bad day");
ok(!/heavier|fat|horrible person|stupid|lazy/i.test(headsFb.kind + headsFb.firm), "kind and firm never shame: " + headsFb.kind.slice(0, 50));
ok(/weak|nothing|owe|bare|promise/i.test(headsFb.brutal) && !/you are (a )?(horrible|worthless|disgusting)/i.test(headsFb.brutal), "brutal is about the behaviour, never a verdict on the person");
await mkcfgZ("kendall", { tone: "firm" });
const gymFb2 = await ATZ("kendall", "ex", { x: "Gym", m: 45, t: T("2026-10-07T03:00:00Z"), d: WEDZ });
await ATZ("kendall", "food", { x: "Late shawarma", t: T("2026-10-07T07:00:00Z"), d: WEDZ, o: true, s: "wa" });
f = await FBZ("kendall", VERZ);
ok(/outside/i.test(f.head) && f.open.some((x) => /outside the windows/.test(x.t)), "floor met but a meal outside its window: the verdict says so, in the open list too");
await fit.fitDelete(env, gymFb2.id, "kendall");
// Monday: the week starts
f = await FBZ("kendall", "2026-10-05T04:30:00Z");
eq([f.week.state, f.week.expected, f.week.minutes], ["fresh", 0, 0], "Monday morning is a fresh week: nothing expected yet");
await ATZ("kendall", "ex", { x: "Run", m: 60, t: T("2026-10-05T03:00:00Z"), d: "2026-10-05" });
f = await FBZ("kendall", "2026-10-05T08:00:00Z");
eq([f.week.minutes, f.week.state], [60, "ahead"], "Monday with a 60 min run: the week starts on Monday, and it is ahead of pace");
f = await FBZ("kendall", "2026-10-11T08:00:00Z");   // the Sunday: six days finished
ok(f.week.expected === Math.round(600 * 6 / 7) && ["behind", "on", "ahead", "done"].includes(f.week.state), "Sunday: six of seven days are expected (" + f.week.expected + " of 600)");
// a rest day
await fit.fitPause(env, "kendall", WEDZ, 1, "ill");
f = await FBZ("kendall", MIDZ);
ok(f.floor.rest && /Rest day|Paused|day off/.test(f.head) && /ill/.test(f.head) && !f.open.some((x) => x.i === "barbell") && /^Rest/.test(f.next), "a rest day: kind about it, nothing is owed, no exercise item (" + f.head + ")");
eq([f.week.restDays, f.week.target], [1, Math.round(600 * 6 / 7)], "and the week's target is scaled for the rest day (6/7 of 10 hours)");
await fit.fitResume(env, "kendall", WEDZ);
// isolation
await mkcfgZ("kendall", { tone: "firm" });
await ATZ("najjuko", "food", { x: "NAJ-ONLY-MEAL", t: T("2026-10-07T03:30:00Z"), d: WEDZ, s: "wa" });
await ATZ("najjuko", "ex", { x: "NAJ-ONLY-RUN", m: 99, t: T("2026-10-07T03:00:00Z"), d: WEDZ });
await fit.jAdd(env, "kendall", { text: "his private journal line " + SECRET, d: WEDZ, t: T("2026-10-07T05:00:00Z") });
const fkZ = await FBZ("kendall", MIDZ), fnZ = await FBZ("najjuko", MIDZ);
const jkZ = JSON.stringify(fkZ), jnZ = JSON.stringify(fnZ);
ok(!/NAJ-ONLY|najjuko|Black Coffee/i.test(jkZ) && !jnZ.includes("Eggs on toast") && fnZ.today.minutes === 99 && fkZ.today.minutes === 0, "each sheet holds only that person's own data");
ok(!jkZ.includes(SECRET) && !jnZ.includes(SECRET), "no journal text in either sheet");
ok(fkZ.u === "kendall" && fnZ.u === "najjuko" && fkZ.key !== fnZ.key, "the key differs per person");
ok(!EMOJIZ.test(jkZ) && !EMOJIZ.test(jnZ), "no emoji in the sheet");
// the line about book and journal: counts only
await fit.fitSaveCfg(env, Object.assign(await fit.fitCfg(env, "kendall"), { bookOn: true }));
f = await FBZ("kendall", MIDZ);
ok(/Book: not yet today/.test(f.note) && /Journal: 1 entry today/.test(f.note) && !f.note.includes(SECRET), "one line for the book and the journal: status and a count, never the words (" + f.note + ")");
await post("/fit_api?u=kendall", { op: "jpin", pin: "4821" });
f = await FBZ("kendall", MIDZ);
ok(!/Journal/.test(f.note), "with a PIN set, not even a journal count is shown on the sheet");
await fit.bookMark(env, "kendall", WEDZ, true);
ok(/Book: written today/.test((await FBZ("kendall", MIDZ)).note), "once the book is ticked the line says so");
// once a day per open: the key is stable inside a mode and changes with day, mode and person
const k1Z = (await FBZ("kendall", MIDZ)).key, k2Z = (await FBZ("kendall", "2026-10-07T09:30:00Z")).key, k3Z = (await FBZ("kendall", "2026-10-08T08:00:00Z")).key;
ok(k1Z === k2Z && k1Z !== k3Z && k1Z !== (await FBZ("kendall", EVEZ)).key, "the same sheet keeps one key all through its time of day; a new day or time of day is a new sheet");
const pageSrc = await (await call(K("/fit"))).text();
ok(/localStorage\.getItem\('fit_fb_'\+j\.key\)==='1'/.test(pageSrc) && /localStorage\.setItem\('fit_fb_'\+FB\.key/.test(pageSrc) && /FBSEEN\[S\.u\]/.test(pageSrc), "the page pops it once per open, remembers a dismissal per person per day and time of day, and has a button to show it again");
ok(/id="fbopen"[^>]*>Show my feedback/.test(pageSrc), "a 'Show my feedback' button is on the page");
ok(!EMOJIZ.test(pageSrc.replace(/<style[\s\S]*?<\/style>/, "")), "no emoji anywhere in the page");
// the route
const rjZ = await jget("/fit_api?u=najjuko&view=feedback");
ok(rjZ.j && rjZ.j.ok && rjZ.j.u === "najjuko" && !JSON.stringify(rjZ.j).includes("Eggs on toast"), "GET view=feedback answers for the named person only");
eq((await call(K("/fit_api?u=najjuko&view=feedback", CLIENT))).status, 404, "a client key gets 404 on it, like every Momo route");
delete env.FIT_USERS;

// the headline must follow what is logged: a day with entries is never called empty, an empty day is never called busy (every tone, every time of day)
env.FIT_USERS = "kendall:" + KEN + ":Dr. Doli,najjuko:" + HER + ":Black Coffee";
const D14 = "2026-10-14", at14 = (hm) => "2026-10-14T" + hm + ":00Z";
const TIMES14 = { morning: "04:30", midday: "08:00", evening: "15:00", verdict: "17:10" };
const STATES14 = { empty: async () => {}, mealsOnly: async () => { await ATZ("kendall", "food", { x: "Oats", t: T(at14("03:30")), d: D14, s: "wa" }); await ATZ("kendall", "food", { x: "Chicken", t: T(at14("08:30")), d: D14, s: "wa" }); }, mealsAndWalk: async () => { await ATZ("kendall", "food", { x: "Oats", t: T(at14("03:30")), d: D14, s: "wa" }); await ATZ("kendall", "ex", { x: "Walk", m: 45, t: T(at14("03:00")), d: D14 }); } };
for (const [sname, setup] of Object.entries(STATES14)) {
  for (const e of await fit.fitRange(env, D14, D14, "kendall")) await fit.fitDelete(env, e.id, "kendall");
  await setup();
  for (const tone of ["kind", "firm", "brutal"]) {
    await mkcfgZ("kendall", { tone });
    for (const [mode, hm] of Object.entries(TIMES14)) {
      const g = await fit.fitFeedback(env, await fit.fitCfg(env, "kendall"), T(at14(hm)));
      const bad = sname === "empty" ? (mode !== "verdict" && !/Nothing logged|blank page|Silence|If it is not written down/i.test(g.head)) : /empty|nothing logged|nothing counted|blank|silence|not written down/i.test(g.head);
      ok(!bad && g.mode === mode && g.empty === (sname === "empty"), "headline matches what is logged [" + sname + " / " + tone + " / " + mode + "]: " + g.head.slice(0, 70));
    }
  }
}
delete env.FIT_USERS;

console.log("v355: brutal 9 PM verdict and 5 AM opener - outcome tiers, wording, quotes, the window rules");
store.clear(); outbound = [];
env.FIT_USERS = "kendall:" + KEN + ":Dr. Doli,najjuko:" + HER + ":Black Coffee";
env.LOG_NUDGE_TEMPLATE = undefined;
const cfgBr = async (u, o) => { const c = fit.fitCleanCfg(Object.assign({ start: "2026-10-01" }, o || {}), Object.assign({}, fit.FIT_CFG_DEFAULT, { u })); await fit.fitSaveCfg(env, c); return await fit.fitCfg(env, u); };
const addBr = (u, k, o) => fit.fitAdd(env, Object.assign({ u, k }, o));
const sumBr = async (u, d, today) => fit.fitSummary(env, d, await fit.fitCfg(env, u), today || d);
// outcome tiers
await cfgBr("kendall", { tone: "brutal", proteinTarget: 100 });
const D20 = "2026-10-20";
let oBr = fit.dayOutcome(await fit.fitCfg(env, "kendall"), await sumBr("kendall", D20));
eq([oBr.kind, oBr.tier], ["none", "missed"], "a day with nothing logged is 'none', and uses the missed quotes");
await addBr("kendall", "food", { x: "Oats", t: T("2026-10-20T03:30:00Z"), d: D20, s: "wa" });
oBr = fit.dayOutcome(await fit.fitCfg(env, "kendall"), await sumBr("kendall", D20));
eq(oBr.kind, "missed", "a meal but no exercise: missed");
const gBr = await addBr("kendall", "ex", { x: "Gym", m: 45, t: T("2026-10-20T03:00:00Z"), d: D20 });
await fit.fitDelete(env, (await fit.fitRange(env, D20, D20, "kendall")).find((e) => e.k === "food").id, "kendall");
await addBr("kendall", "food", { x: "Chicken", t: T("2026-10-20T03:30:00Z"), d: D20, s: "wa", est: { g: 20, how: "rough" } });
oBr = fit.dayOutcome(await fit.fitCfg(env, "kendall"), await sumBr("kendall", D20));
eq([oBr.kind, oBr.flaws], ["partial", ["protein"]], "floor met but rough protein far under the guide: partial, and it names the protein");
await fit.fitSaveCfg(env, Object.assign(await fit.fitCfg(env, "kendall"), { proteinTarget: 0 }));
oBr = fit.dayOutcome(await fit.fitCfg(env, "kendall"), await sumBr("kendall", D20));
eq(oBr.kind, "hit", "floor met, windows kept, no guide set: a clean hit");
await addBr("kendall", "food", { x: "Late snack", t: T("2026-10-20T07:00:00Z"), d: D20, o: true, s: "wa" });
oBr = fit.dayOutcome(await fit.fitCfg(env, "kendall"), await sumBr("kendall", D20));
eq([oBr.kind, oBr.flaws], ["partial", ["windows"]], "a meal outside its window: partial, naming the windows");
for (const e of await fit.fitRange(env, D20, D20, "kendall")) await fit.fitDelete(env, e.id, "kendall");
for (const d of ["2026-10-17", "2026-10-18", "2026-10-19", D20]) await addBr("kendall", "ex", { x: "Run", m: 40, t: T(d + "T03:00:00Z"), d });
oBr = fit.dayOutcome(await fit.fitCfg(env, "kendall"), await sumBr("kendall", D20));
eq([oBr.kind, oBr.streak >= 3], ["streak", true], "a clean day on a run of three or more: streak");
await fit.fitPause(env, "kendall", D20, 1, "ill"); oBr = fit.dayOutcome(await fit.fitCfg(env, "kendall"), await sumBr("kendall", D20)); eq(oBr.kind, "rest", "a booked rest day is rest"); await fit.fitResume(env, "kendall", D20);
// the wording: one bold-able line, three tones, never about the body or the person, no emoji
const BADW = /\b(fat|heavier|slower|ugly|disgusting|worthless|pathetic|stupid|lazy|loser|horrible person|body|weight|belly|skinny|obese)\b/i;
const EMOJI_BR = /[\u{1F000}-\u{1FAFF}\u{2300}-\u{23FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u;
let wordsBr = 0; const badBr = [];
for (const tone of ["kind", "firm", "brutal"]) for (const kind of ["missed", "none", "partial", "hit", "streak"]) for (const day of ["today", "yesterday"]) for (let k = 0; k < 8; k++) {
  const h = fit.brutalHead(Object.assign({}, fit.FIT_CFG_DEFAULT, { u: "kendall", tone }), { kind, streak: 5, flaws: [] }, day, fit.addDays("2026-10-01", k)); wordsBr++;
  if (BADW.test(h) || EMOJI_BR.test(h) || /[\r\n]/.test(h) || !h || /[{}]/.test(h)) badBr.push(h);
}
eq(badBr, [], "all " + wordsBr + " headlines (3 tones x 5 outcomes x today/yesterday): one line, no placeholders, no emoji, nothing about the body or the person");
const cB = Object.assign({}, fit.FIT_CFG_DEFAULT, { u: "kendall", tone: "brutal" }), cK = Object.assign({}, fit.FIT_CFG_DEFAULT, { u: "kendall", tone: "kind" });
const hB = fit.brutalHead(cB, { kind: "missed", flaws: [] }, "yesterday", "2026-10-21"), hK = fit.brutalHead(cK, { kind: "missed", flaws: [] }, "yesterday", "2026-10-21");
ok(hB !== hK && /yesterday/i.test(hB), "brutal and kind say different things, and the morning one is about yesterday (" + hB + ")");
ok(/hit every goal today|Clean sheet today/.test(fit.brutalHead(cB, { kind: "hit", flaws: [] }, "today", "2026-10-01") + fit.brutalHead(cB, { kind: "hit", flaws: [] }, "today", "2026-10-02") + fit.brutalHead(cB, { kind: "hit", flaws: [] }, "today", "2026-10-03")), "a hit in brutal: 'you hit every goal, now do better' in spirit");
// the line in the sand
const cfgSand = Object.assign({}, fit.FIT_CFG_DEFAULT, { u: "kendall", tone: "brutal", proteinTarget: 120 }), sumSand = { stats: { out: 2, ex: 20, protein: 60, meals: 3 } };
const sandMissed = fit.lineInSand(cfgSand, sumSand, { kind: "missed", flaws: ["windows"] }, "today");
ok(/Move 30 minutes before 12:00/.test(sandMissed) && /Every meal inside its window/.test(sandMissed), "a missed day with meals out of window: move first, and keep the windows");
ok(/Reach 120 g of protein/.test(fit.lineInSand(cfgSand, sumSand, { kind: "partial", flaws: ["protein"] }, "tomorrow")), "a protein miss: the commitment names the target");
ok(/Beat it: 40 minutes/.test(fit.lineInSand(cfgSand, { stats: { out: 0, ex: 30 } }, { kind: "hit", flaws: [] }, "tomorrow")), "a hit: raise the bar by ten minutes");
// the quote bank
const Q = await import("../src/fit_quotes.js");
const allQ = Q.QUOTE_TIERS.flatMap((t) => Q.FIT_QUOTES[t].map((q) => q));
ok(Q.QUOTE_COUNT >= 60 && new Set(allQ.map((q) => q[0])).size === allQ.length, "at least 60 distinct quotes (two a day for 30 days)");
ok(allQ.every((q) => !EMOJI_BR.test(q[0]) && q[0].length < 140 && !BADW.test(q[0])), "short, no emoji, nothing about the body");
ok(allQ.filter((q) => q[1]).every((q) => /^(Lao Tzu|Marcus Aurelius|attributed to|traditional proverb)/.test(q[1])) && allQ.filter((q) => q[1]).length <= 8, "an author appears only on a few long-public-domain sayings, and says 'attributed to' / 'traditional' where it is not verified");
store.clear(); await cfgBr("kendall", { tone: "brutal" }); await cfgBr("najjuko", { tone: "kind" });
const seenQ = []; let dayQ = "2026-11-01";
for (let k = 0; k < 30; k++) { for (let n = 0; n < 2; n++) seenQ.push(await fit.fitQuote(env, "kendall", "missed", dayQ)); dayQ = fit.addDays(dayQ, 1); }
eq([seenQ.length, new Set(seenQ).size], [60, 60], "60 draws in 30 days, all in the 'missed' tier: not one repeated (it widens to other tiers before repeating)");
const hitQ = await fit.fitQuote(env, "najjuko", "hit", "2026-11-01"); ok(Q.FIT_QUOTES.hit.some((q) => hitQ.includes(q[0])), "a hit draws from the hit tier first");
ok(store.has("fitc_qused_kendall") && store.has("fitc_qused_najjuko"), "each person has their own rotation record");
ok(!!(await fit.fitQuote(env, "kendall", "missed", "2026-12-15")), "a new month can reuse the bank");
// 21:00 text: whole message
store.clear(); outbound = [];
await cfgBr("kendall", { tone: "brutal", start: "2026-10-01" });
store.set("fitc_in_kendall", { v: new Date().toISOString() });
const sentBr = [];
const depsBr = { waSend: async (en, to, b) => sentBr.push({ to, b }), waSendButtons: async (en, to, b) => sentBr.push({ to, b }), waSendTemplate: async (en, to, name) => sentBr.push({ to, tpl: name }), ownerWindowOpen: async () => false };
await fit.fitEvening(env, depsBr, T("2026-10-08T17:05:00Z"));
const nine = sentBr.find((x) => x.to === KEN);
ok(nine && /^\*VERDICT - DAY 8 OF 30\*\n\*[^*\n]+\*\n\nToday: 0 meals/.test(nine.b) && /TOMORROW'S LINE IN THE SAND\*\nMove 30 minutes before lunch/.test(nine.b) && /\n"[^"]+"/.test(nine.b), "9 PM: bold title, a hard one-line verdict, the facts block, the line in the sand, the quote - in that order (" + (nine ? nine.b.slice(0, 80).replace(/\n/g, " / ") : "none") + ")");
ok(nine && !BADW.test(nine.b), "and nothing in it is about his body");
// 5 AM
const M5 = async (iso, d2) => { sentBr.length = 0; const r = await fit.fitMorning(env, d2 || depsBr, T(iso)); return { r, sent: sentBr.slice() }; };
let m5 = await M5("2026-10-09T00:30:00Z"); eq([m5.r, m5.sent.length], [false, 0], "04:30 Dubai: nothing yet");
m5 = await M5("2026-10-09T01:40:00Z"); eq([m5.r, m5.sent.length], [false, 0], "05:40 Dubai: too late for the opener");
m5 = await M5("2026-10-09T01:05:00Z");
const msg5 = (m5.sent.find((x) => x.to === KEN) || {}).b || "";
ok(m5.r && /^\*LET'S GET IT - DAY 9 OF 30\*\n\*[^*\n]+\*\n\n/.test(msg5) && /Yesterday: 0 meals/.test(msg5) && /Daily minimum was missed/.test(msg5) && /TODAY'S LINE IN THE SAND\*\nMove 30 minutes before 12:00/.test(msg5) && /\n"[^"]+"/.test(msg5), "05:05 Dubai, his window open: opener with day, honest about yesterday, the numbers, today's line in the sand and a quote (" + msg5.slice(0, 90).replace(/\n/g, " / ") + ")");
ok(/yesterday/i.test(msg5.split("\n")[1]), "'missed everything' is said plainly, about yesterday");
m5 = await M5("2026-10-09T01:10:00Z"); eq(m5.sent.length, 0, "once a day");
store.delete("fitc_in_kendall"); for (const k of [...store.keys()]) if (k.startsWith("fitc_msent_")) store.delete(k);
m5 = await M5("2026-10-09T01:05:00Z"); eq(m5.sent.length, 0, "his window closed: no free text, and no template for him (it greets her by name)");
env.LOG_NUDGE_TEMPLATE = "najma_log_day"; env.FIT_USERS = "najjuko:" + HER + ":Black Coffee"; await cfgBr("najjuko", { start: "2026-10-01", tone: "kind" });
m5 = await M5("2026-10-09T01:05:00Z"); eq(m5.sent.map((x) => x.tpl), ["najma_log_day"], "her window closed and nothing logged: ONE approved nudge");
m5 = await M5("2026-10-09T01:20:00Z"); eq(m5.sent.length, 0, "never a second one the same day");
for (const k of [...store.keys()]) if (k.startsWith("fitc_nudge_")) store.delete(k);
await addBr("najjuko", "food", { x: "Oats", t: T("2026-10-08T04:00:00Z"), d: "2026-10-08", s: "wa" });
m5 = await M5("2026-10-09T01:05:00Z"); eq(m5.sent.length, 0, "she logged yesterday: no paid nudge");
env.LOG_NUDGE_TEMPLATE = undefined;
const dOpen = Object.assign({}, depsBr, { ownerWindowOpen: async () => true });
store.clear(); await cfgBr("najjuko", { start: "2026-10-01", tone: "kind" });
m5 = await M5("2026-10-10T01:05:00Z", dOpen);
const hers = (m5.sent[0] || {}).b || "";
ok(/^\*Good morning - day 10 of 30\*/.test(hers) && /Yesterday: 0 meals/.test(hers) && /Today, one thing/.test(hers), "kind tone: a kind opener, same structure (" + hers.slice(0, 60).replace(/\n/g, " / ") + ")");
// day one: no yesterday to judge
store.clear(); await cfgBr("najjuko", { start: "2026-10-12", tone: "firm" });
m5 = await M5("2026-10-12T01:05:00Z", dOpen); const d1 = (m5.sent[0] || {}).b || "";
ok(/DAY 1 OF 30/.test(d1) && /Day one/.test(d1) && !/Yesterday:/.test(d1), "day one: no yesterday, a first commitment");
// rest day today: no commitment; after the challenge: nothing
await fit.fitPause(env, "najjuko", "2026-10-13", 1, "ill");
m5 = await M5("2026-10-13T01:05:00Z", dOpen); eq(m5.sent.length, 0, "a booked rest day today: no commitment is asked");
m5 = await M5("2026-12-01T01:05:00Z", dOpen); eq(m5.sent.length, 0, "after the 30 days are over: nothing");
// isolation: his opener holds only his data, and nothing touches the Najma morning chain
store.clear(); env.FIT_USERS = "kendall:" + KEN + ":Dr. Doli,najjuko:" + HER + ":Black Coffee";
await cfgBr("kendall", { start: "2026-10-01", tone: "brutal" }); await cfgBr("najjuko", { start: "2026-10-01", tone: "kind" });
await addBr("najjuko", "food", { x: "HER-ONLY-MEAL", t: T("2026-10-08T04:00:00Z"), d: "2026-10-08", s: "wa" }); await addBr("najjuko", "ex", { x: "HER-RUN", m: 99, t: T("2026-10-08T03:00:00Z"), d: "2026-10-08" });
await fit.jAdd(env, "kendall", { text: "his journal " + SECRET, d: "2026-10-08" });
store.set("fitc_in_kendall", { v: new Date().toISOString() });
m5 = await M5("2026-10-09T01:05:00Z", dOpen);
const toKen = (m5.sent.find((x) => x.to === KEN) || {}).b || "", toHer = (m5.sent.find((x) => x.to === HER) || {}).b || "";
ok(toKen && toHer && !/HER-|Black Coffee|99 min/.test(toKen) && !toHer.includes("his journal") && !toKen.includes(SECRET) && !toHer.includes(SECRET) && /1h39/.test(toHer), "each opener holds only that person's own numbers; no journal text in either (" + toHer.slice(0, 200).replace(/\n/g, " / ") + ")");
ok([...store.keys()].every((k) => !/^(picjob_|gmp_)/.test(k)), "the Najma morning chain keys (picjob_, gmp_) are never touched");
ok(!EMOJI_BR.test(toKen.replace(/[✅❌⏳⏸]/g, "")), "no new emoji in the opener (only the existing facts-block marks)");
const idxSrc2 = (await import("node:fs")).readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
eq((idxSrc2.match(/fitMorning\(env, fitDeps\(\)/g) || []).length, 2, "the 05:00 opener runs on both cron paths; no new cron was added");
const tomlSrc = (await import("node:fs")).readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
ok(/crons = \["0,30 1-18 \* \* \*", "\* \* \* \* \*"\]/.test(tomlSrc), "the azimuth2 cron line is unchanged");
delete env.FIT_USERS; env.LOG_NUDGE_TEMPLATE = undefined;

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
