// v289 - THE MORNING FEED MOVES FROM 06:00 TO 05:00 DUBAI (Kendall, 2 Oct 2026: "we need to move Najj feed from 6am to 5am").
//
// The hour is set in ONE place, FEED_HOUR_GST in wrangler.toml's azimuth-2 vars, and read through feedHourGst(). But a Worker
// only runs when its cron fires, and the cron cannot read a var: on 13 Sep (v140) the hour went from 7 to 6 and the cron had to
// be widened by hand in the same commit, or the feed would have had no tick at all. So this test reads BOTH from wrangler.toml
// and checks they agree, then drives the real scheduled() handler at 05:00 and at 06:00 Dubai and watches the feed's own
// attempt marker (mktfeed_<date>), which dailyFeedTick writes the moment its hour gate lets it through.
//
// NEGATIVE CONTROL: set FEED_HOUR_GST back to "6" (cron untouched) and this file must fail on the hour check and on the
// 05:00/06:00 ticks; set the cron back to "0,30 2-18" (hour 5 kept) and it must fail on the cron check. Verified both ways.
import { readFileSync } from "node:fs";
import worker from "../src/index.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };

// ---- 1. the config: one hour, and a cron that reaches it ---------------------------------------------------------------
const TOML = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
const section = (name) => { const i = TOML.indexOf("[" + name + "]"); if (i < 0) return ""; const rest = TOML.slice(i + name.length + 2); const j = rest.search(/^\[/m); return j < 0 ? rest : rest.slice(0, j); };
const vars = section("env.azimuth2.vars");
const hm = /^FEED_HOUR_GST\s*=\s*"(\d+)"/m.exec(vars);
const FEED_HOUR = hm ? parseInt(hm[1], 10) : null;
ok(FEED_HOUR === 5, "azimuth-2 FEED_HOUR_GST is 5 (found " + (hm ? hm[1] : "nothing") + ")");
ok((vars.match(/^FEED_HOUR_GST\s*=/gm) || []).length === 1, "FEED_HOUR_GST is set exactly once in the azimuth-2 vars");

const trig = section("env.azimuth2.triggers");
const cm = /crons\s*=\s*\[([^\]]*)\]/.exec(trig);
const crons = cm ? [...cm[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]) : [];
// a five-field cron matcher for the forms used here: *, a, a-b, a,b, */n
const field = (f, v) => f.split(",").some((p) => {
  const st = /^(\*|\d+-\d+|\d+)\/(\d+)$/.exec(p);
  if (st) { const [lo, hi] = st[1] === "*" ? [0, 59] : st[1].includes("-") ? st[1].split("-").map(Number) : [Number(st[1]), 59]; return v >= lo && v <= hi && (v - lo) % Number(st[2]) === 0; }
  if (p === "*") return true;
  if (p.includes("-")) { const [lo, hi] = p.split("-").map(Number); return v >= lo && v <= hi; }
  return Number(p) === v;
});
const fires = (cron, h, m) => { const f = cron.trim().split(/\s+/); return field(f[0], m) && field(f[1], h); };
const halfHour = crons.find((c) => c !== "* * * * *");
const utcHour = FEED_HOUR - 4;      // Dubai is UTC+4 all year (no daylight saving)
ok(!!halfHour && fires(halfHour, utcHour, 0) && fires(halfHour, utcHour, 30),
   "the azimuth-2 half-hour cron (" + halfHour + ") fires at " + String(utcHour).padStart(2, "0") + ":00 and :30 UTC = " + String(FEED_HOUR).padStart(2, "0") + ":00 and :30 Dubai");
ok(!!halfHour && !fires(halfHour, utcHour - 1, 30),
   "and not the hour before (04:30 Dubai) - nothing new is woken overnight");
ok(crons.includes("* * * * *"), "the minute tick (scene cards, meetings, live news) is still there");
ok(/^crons = \["\*\/5 3-18 \* \* \*"\]/m.test(TOML), "meeting-capture's own cron is untouched");

// ---- 2. the real handler: 05:00 Dubai fires the feed, 06:00 Dubai does not ---------------------------------------------
const realFetch = globalThis.fetch, realNow = Date.now;
globalThis.fetch = async () => new Response("", { status: 404 });     // nothing leaves this machine
const mkEnv = (store, hour) => {
  const KV = {
    async get(k) { return store.has(k) ? store.get(k) : null; },
    async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); },
    async list(o) { return { keys: [...store.keys()].filter((k) => !o || !o.prefix || k.startsWith(o.prefix)).map((name) => ({ name })), list_complete: true }; },
  };
  // mkt_latest is deliberately absent: the feed records its attempt, then stops at "no data" - so the marker proves the hour
  // gate opened without a model call or a WhatsApp send.
  return { MEETINGS: KV, MARKET_BRIEF: "on", FEED_HOUR_GST: String(hour), WA_ALLOWED: "971500000000", READ_KEY: "RK" };
};
const tick = async (iso, hour) => {
  const store = new Map();
  Date.now = () => Date.parse(iso);
  const ps = [];
  await worker.scheduled({ cron: halfHour, scheduledTime: Date.parse(iso) }, mkEnv(store, hour), { waitUntil(p) { ps.push(p); } });
  await Promise.all(ps);
  Date.now = realNow;
  return store;
};
const day = "2026-10-03";
let s = await tick(day + "T01:00:00Z", FEED_HOUR);
ok(s.get("mktfeed_" + day) === "1", "05:00 Dubai (01:00 UTC): the feed runs - attempt marker written");
s = await tick(day + "T01:30:00Z", FEED_HOUR);
ok(s.get("mktfeed_" + day) === "1", "05:30 Dubai: the second tick of the hour is still eligible (the retry slot)");
s = await tick(day + "T02:00:00Z", FEED_HOUR);
ok(!s.has("mktfeed_" + day), "06:00 Dubai (02:00 UTC): the feed does NOT run any more");
s = await tick(day + "T02:30:00Z", FEED_HOUR);
ok(!s.has("mktfeed_" + day), "06:30 Dubai: nor on the half hour");
s = await tick(day + "T00:30:00Z", FEED_HOUR);
ok(!s.has("mktfeed_" + day), "04:30 Dubai: not early either");
// the gate reads the var, not a literal: the old value still behaves as the old hour
s = await tick(day + "T02:00:00Z", 6);
ok(s.get("mktfeed_" + day) === "1", "with FEED_HOUR_GST = 6 the same handler fires at 06:00 - the hour comes from the var");

// ---- 3. no literal feed hour slipped into the code ----------------------------------------------------------------------
const SRC = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
const feed = SRC.slice(SRC.indexOf("async function dailyFeedTick("), SRC.indexOf("async function dailyFeedTick(") + 1500);
ok(/n\.getUTCHours\(\) !== feedHourGst\(env\)/.test(feed), "dailyFeedTick gates on feedHourGst(env), not a number");
const radar = SRC.slice(SRC.indexOf("async function trendRadarTick("), SRC.indexOf("async function trendRadarTick(") + 1500);
ok(/getUTCHours\(\) === feedHourGst\(env\)/.test(radar), "the trend radar follows the same hour");

globalThis.fetch = realFetch;
console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
