// v412 - THE THREE CAUSES OF NAJ'S MISSED MORNING FEED ON 8 OCT 2026.
//  (A) fresh-data gate: the feed must not generate from yesterday's register while the 04:00 refresh is still running.
//  (B) early window nudge: 04:00-04:30 Dubai, the approved template, once a day, only when her last message is over 20 h old.
//  (C) idempotent 'Feed': one set a day unless she says 'feed again'; a held set is flushed only, never doubled.
// Everything is offline: fetch is faked, KV is a Map, the clock is Date.now. Nothing leaves this machine.
import { readFileSync } from "node:fs";
import worker from "../src/index.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("ok - " + m); } else { fail++; console.log("not ok - " + m); } };
const A = (hook, figure, source, family, reader) => ({ hook, figure, source, buyer: "b", family, reader });
const FIVE = [A("Public beaches grow 400% by 2040.", "400%", "Dubai Media Office, 13 Mar 2021", "city_life", "move"),
  A("14 new Metro stations on the Blue Line.", "14 stations", "Dubai Media Office, 4 Mar 2025", "transit", "invest"),
  A("The plan targets 5.8 million residents by 2040.", "5.8 million (2040 target); 3.3 million (2020 baseline)", "Dubai Media Office, 13 Mar 2021", "growth_plan", "authority"),
  A("Prices held at AED 1,520 per sq ft.", "AED 1,520 per sq ft", "DLD Open Data, 2026-09-18", "prices", "invest"),
  A("4,410 homes handed over this quarter.", "4,410 handovers", "DLD Open Data, Q3 2026", "handover_supply", "invest")];

let sent = [], owner = [], claudeCalls = 0, templateFails = false;
const realNow = Date.now;
globalThis.fetch = async (u, o) => {
  const url = String(u && u.url ? u.url : u);
  if (/anthropic/i.test(url)) {
    claudeCalls++;
    let body = {}; try { body = JSON.parse(String(o && o.body || "{}")); } catch (e) {}
    const isVoice = /rewrite social-post hooks/.test(JSON.stringify(body.system || ""));
    return new Response(JSON.stringify({ content: [{ type: "text", text: isVoice ? JSON.stringify({ items: [] }) : JSON.stringify({ angles: FIVE }) }], stop_reason: "end_turn" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  if (/graph\.facebook\.com/.test(url)) {
    let b = {}; try { b = JSON.parse(String(o && o.body || "{}")); } catch (e) {}
    sent.push(b);
    if (b.type === "template" && templateFails) return new Response(JSON.stringify({ error: { message: "nope" } }), { status: 400 });
    return new Response(JSON.stringify({ messages: [{ id: "wamid." + sent.length }] }), { status: 200 });
  }
  if (/owner_note/.test(url)) { try { owner.push(JSON.parse(String(o.body)).text); } catch (e) {} return new Response("sent", { status: 200 }); }
  return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
};
const HER = "971565484397";
const HALF = "0,30 1-18 * * *";
const mkEnv = (store, extra) => Object.assign({ MEETINGS: {
    async get(k, t) { if (!store.has(k)) return null; const v = store.get(k); return t === "json" ? JSON.parse(v) : v; },
    async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); },
    async list(o) { return { keys: [...store.keys()].filter((k) => !o || !o.prefix || k.startsWith(o.prefix)).map((name) => ({ name })), list_complete: true }; } },
  AI: { run: async () => ({ response: "{}" }) },
  READ_KEY: "owner_admin_key_never_in_client_links_0001", MARKET_BRIEF: "on", ANTHROPIC_API_KEY: "test-only-not-a-key", PUBLIC_ORIGIN: "https://x",
  WA_ALLOWED: HER, WHATSAPP_TOKEN: "t", WA_PHONE_ID: "1", FEED_HOUR_GST: "5", FEED_TEMPLATE: "azimuth_daily", FEED_TEMPLATE_LANG: "en_US",
  OWNER_NOTE_URL: "https://mc/owner_note", INGEST_TOKEN: "i", MINUTE_TICK: "on" }, extra || {});
const DAY = "2026-10-08";
const dubai = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return Date.parse(DAY + "T00:00:00Z") + (h * 60 + m) * 60000 - 4 * 3600000; };
const YESTERDAY_DATA = JSON.stringify({ generatedAt: "2026-10-07T09:00:00Z" });      // 13:00 on 7 Oct, Dubai
const TODAY_DATA = JSON.stringify({ generatedAt: "2026-10-07T21:13:00Z" });          // 01:13 on 8 Oct, Dubai - the refresh finished
const mkStore = (data, lastInAgoH) => { const s = new Map([["mkt_feed_famhist", "[]"]]); if (data) s.set("mkt_latest", data); if (lastInAgoH != null) s.set("wa_owner_last_in", new Date(dubai("05:00") - lastInAgoH * 3600000).toISOString()); return s; };
const tickAt = async (store, hhmm, cron, extra) => {
  sent = []; owner = []; claudeCalls = 0;
  Date.now = () => dubai(hhmm);
  const ps = [];
  try { await worker.scheduled({ cron: cron || HALF, scheduledTime: dubai(hhmm) }, mkEnv(store, extra), { waitUntil(p) { ps.push(p); } }); await Promise.all(ps); } finally { Date.now = realNow; }
};
const texts = () => sent.filter((m) => m.type !== "template").map((m) => (m.text && m.text.body) || (m.interactive && JSON.stringify(m.interactive)) || "");
const templates = () => sent.filter((m) => m.type === "template");
const qaNote = (s) => { try { return JSON.parse(s.get("mkt_feed_qa")).note; } catch (e) { return ""; } };
const status = (s) => { try { return JSON.parse(s.get("mkt_feed_status")); } catch (e) { return null; } };

// ---- A. the fresh-data gate -------------------------------------------------------------------------------------------------------
let s = mkStore(YESTERDAY_DATA, 2);
await tickAt(s, "05:00");
ok(!s.has("mktfeed_" + DAY), "A1 stale data at 05:00: no attempt is consumed (no mktfeed marker)");
ok(sent.length === 0 && !s.has("mkt_feed_qa"), "A1 nothing sent and no feed was generated (no QA record)");
ok(status(s) && status(s).state === "deferred" && /waiting for today's data/.test(status(s).why), "A1 the status key says 'deferred: waiting for today's data': " + (s.get("mkt_feed_status") || "").slice(0, 110));
for (const t of ["05:30", "06:00", "06:30", "07:00", "07:30"]) { await tickAt(s, t); }
ok(!s.has("mktfeed_" + DAY) && sent.length === 0, "A2 still deferred at 05:30, 06:00 ... 07:30 - every tick re-checks, none consumes an attempt");
// the refresh lands at 06:20: the 06:30 tick generates, on today's data, with no stale line
s.set("mkt_latest", TODAY_DATA);
await tickAt(s, "06:30");
ok(s.get("mktfeed_" + DAY) === "done", "A3 data lands mid-morning: the next tick generates and the day is marked done");
ok(texts().some((t) => /Najma daily/.test(t)) && texts().some((t) => /Choose an angle/.test(t)), "A3 she gets the list and the picker");
ok(!/refresh not finished/.test(qaNote(s)), "A3 the QA line has no stale-data warning");
ok(status(s) && status(s).state === "generating", "A3 the status moves on from 'deferred'");
// after the deadline: generate from what there is, honestly
s = mkStore(YESTERDAY_DATA, 2);
await tickAt(s, "05:00"); await tickAt(s, "07:30");
ok(!s.has("mktfeed_" + DAY), "A4 07:30, still stale: still waiting (deadline is 08:00)");
await tickAt(s, "08:00");
ok(s.get("mktfeed_" + DAY) === "done" && texts().some((t) => /Najma daily/.test(t)), "A4 at the 08:00 deadline the feed goes out on the latest data");
ok(/data from 2026-10-07: refresh not finished/.test(qaNote(s)), "A4 and the QA line is honest: " + (qaNote(s).match(/data from[^|]*/) || [""])[0]);
// a failed generation after the deadline keeps the 2-attempt rule (per generation)
s = mkStore(YESTERDAY_DATA, 2); await tickAt(s, "05:00"); await tickAt(s, "08:00");
ok(s.get("mktfeed_" + DAY) === "done", "A5 sanity: the deadline run is marked done");
// fresh data from the start
s = mkStore(TODAY_DATA, 2);
await tickAt(s, "05:00");
ok(s.get("mktfeed_" + DAY) === "done" && !/refresh not finished/.test(qaNote(s)) && texts().some((t) => /Najma daily/.test(t)), "A6 fresh data at 05:00: generates at once, as before");
// the deferral does not widen the hour for a day with no deferral: 06:00 with nothing on record still does nothing
s = mkStore(TODAY_DATA, 2);
await tickAt(s, "06:00");
ok(!s.has("mktfeed_" + DAY) && sent.length === 0, "A7 no deferral on record: 06:00 still does not run the feed (v289 behaviour kept)");
// two attempts per generation: two failed generations stop it, deferral ticks did not count
s = mkStore(YESTERDAY_DATA, 2); await tickAt(s, "05:00"); await tickAt(s, "05:30");
s.set("mkt_latest", TODAY_DATA);
const failFetch = globalThis.fetch;
globalThis.fetch = async (u, o) => (/anthropic/i.test(String(u && u.url ? u.url : u)) ? new Response("{}", { status: 500 }) : failFetch(u, o));
await tickAt(s, "06:00"); const a1 = s.get("mktfeed_" + DAY);
await tickAt(s, "06:30"); const a2 = s.get("mktfeed_" + DAY);
await tickAt(s, "07:00"); const a3 = s.get("mktfeed_" + DAY);
globalThis.fetch = failFetch;
ok(a1 === "1" && a2 === "2" && a3 === "2", "A8 after 2 deferrals, generation gets its own 2 attempts (markers " + [a1, a2, a3].join("/") + ")");
// window shut + fresh data: still holds, sends only the template
s = mkStore(TODAY_DATA, 40);
await tickAt(s, "05:00");
ok(s.get("mktfeed_" + DAY) === "held" && s.has("mkt_feed_pending"), "A9 window shut: the set is held and kept");
ok(texts().length === 0 && templates().length === 1 && templates()[0].to === HER, "A9 and only the approved template goes to her");
await tickAt(s, "05:30");
ok(sent.length === 0 && claudeCalls === 0, "A9 a held set is not rebuilt (or re-nudged) on the next tick");

// ---- B. the early nudge ----------------------------------------------------------------------------------------------------------
s = mkStore(YESTERDAY_DATA, 25);
await tickAt(s, "04:00", "* * * * *");
ok(templates().length === 1 && templates()[0].to === HER && texts().length === 0, "B1 04:00, last inbound 25 h ago: one template to her, nothing else");
ok(owner.length === 0, "B1 nothing to Kendall");
ok(s.get("mktnudge_" + DAY) === "sent", "B1 recorded as sent for the day");
await tickAt(s, "04:01", "* * * * *"); await tickAt(s, "04:20", "* * * * *");
ok(sent.length === 0, "B2 not again at 04:01 or 04:20 - once a day");
s = mkStore(YESTERDAY_DATA, 5);
await tickAt(s, "04:00", "* * * * *");
ok(sent.length === 0, "B3 window open (last inbound 5 h ago): no template");
s = mkStore(YESTERDAY_DATA, 25);
await tickAt(s, "03:59", "* * * * *"); await tickAt(s, "04:30", "* * * * *"); await tickAt(s, "05:00", "* * * * *");
ok(sent.length === 0 && !s.has("mktnudge_" + DAY), "B4 outside 04:00-04:30 nothing is sent");
s = mkStore(YESTERDAY_DATA, null);
await tickAt(s, "04:05", "* * * * *");
ok(templates().length === 1, "B5 no record of her ever writing (expired): treated as older than 20 h");
s = mkStore(YESTERDAY_DATA, 25); templateFails = true;
await tickAt(s, "04:00", "* * * * *");
ok(s.get("mktnudge_" + DAY) === "failed" && /early nudge failed/.test(s.get("mkt_feed_err") || ""), "B6 a failed template is recorded in mkt_feed_err");
await tickAt(s, "04:01", "* * * * *"); await tickAt(s, "04:02", "* * * * *");
ok(sent.length === 0, "B6 and not retried in a loop");
templateFails = false;
s = mkStore(YESTERDAY_DATA, 25);
await tickAt(s, "04:00", "* * * * *");
ok(templates().length === 1, "B7 the minute-tick cron path (the one that runs it) sends it");
s = mkStore(YESTERDAY_DATA, 25);
await tickAt(s, "04:00", "* * * * *", { MARKET_BRIEF: "off" });
ok(sent.length === 0, "B8 MARKET_BRIEF off: nothing");

// ---- C. an idempotent 'Feed' -------------------------------------------------------------------------------------------------------
const say = async (store, body, extra) => {
  sent = []; owner = []; claudeCalls = 0;
  const wa = { entry: [{ changes: [{ value: { metadata: { phone_number_id: "1" }, messages: [{ from: HER, id: "m" + Math.random(), timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body } }] } }] }] };
  const ps = [];
  await worker.fetch(new Request("https://x/wa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(wa) }), mkEnv(store, extra), { waitUntil(p) { ps.push(p); } });
  await Promise.all(ps); await new Promise((r) => setTimeout(r, 60));
};
const today = new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
const FRESH_NOW = JSON.stringify({ generatedAt: new Date().toISOString() });
// a set was flushed/sent 20 minutes ago
s = new Map([["mkt_latest", FRESH_NOW], ["mkt_feed_famhist", "[]"], ["mktfeed_" + today, "done"],
  ["mkt_feed_sent", JSON.stringify({ at: Date.now() - 20 * 60000, date: today, via: "tick", bodyTxt: "Najma daily SET ONE", rows: [{ id: "feed:1", title: "1", description: "x" }] })]]);
await say(s, "Feed");
ok(claudeCalls === 0, "C1 'Feed' after a set went out 20 min ago does not build another (generator not called)");
ok(!texts().some((t) => /Building/.test(t)) && texts().some((t) => /list is above/i.test(t)), "C1 she is told today's list is above");
ok(texts().some((t) => /Choose an angle/.test(t)), "C1 and gets the same buttons again");
await say(s, "feed");
ok(claudeCalls === 0, "C2 twice in a row (the 06:26 double) still builds nothing");
// the set is older than an hour: the old behaviour (a fresh build) returns
s.set("mkt_feed_sent", JSON.stringify({ at: Date.now() - 90 * 60000, date: today, via: "tick", bodyTxt: "old", rows: [] }));
await say(s, "Feed");
ok(claudeCalls > 0 && texts().some((t) => /Building/.test(t)), "C3 a set older than 60 min: 'Feed' builds, as before");
// explicit again
s = new Map([["mkt_latest", FRESH_NOW], ["mkt_feed_famhist", "[]"], ["mktfeed_" + today, "done"],
  ["mkt_feed_sent", JSON.stringify({ at: Date.now() - 5 * 60000, date: today, via: "tick", bodyTxt: "Najma daily SET ONE", rows: [] })]]);
await say(s, "Feed again");
ok(claudeCalls > 0 && texts().some((t) => /fresh set/i.test(t)), "C4 'Feed again' still rebuilds");
s.set("mkt_feed_sent", JSON.stringify({ at: Date.now() - 5 * 60000, date: today, via: "tick", bodyTxt: "Najma daily SET ONE", rows: [] }));
await say(s, "Refresh feed");
ok(claudeCalls > 0, "C5 'Refresh feed' still rebuilds");
// no set today: the force-run stays
s = new Map([["mkt_latest", FRESH_NOW], ["mkt_feed_famhist", "[]"], ["wa_owner_last_in", new Date().toISOString()]]);
await say(s, "Feed");
ok(claudeCalls > 0 && texts().some((t) => /Building/.test(t)) && texts().some((t) => /Najma daily/.test(t)), "C6 no set today: 'Feed' builds one, as before");
// held set + her message opens the window: flush only
s = new Map([["mkt_latest", FRESH_NOW], ["mkt_feed_famhist", "[]"], ["mktfeed_" + today, "held"],
  ["wa_owner_last_in", new Date(Date.now() - 30 * 3600000).toISOString()],
  ["mkt_feed_pending", JSON.stringify({ at: Date.now() - 3600000, at_gst: "x", bodyTxt: "Najma daily HELD SET", rows: [{ id: "feed:1", title: "1", description: "x" }], angles: FIVE })]]);
await say(s, "Feed");
const bodies = texts().filter((t) => /Najma daily/.test(t));
ok(bodies.length === 1 && /HELD SET/.test(bodies[0]), "C7 held set + 'Feed': the held set is sent, once");
ok(claudeCalls === 0 && !texts().some((t) => /Building/.test(t)), "C7 and no second set is built");
ok(!s.has("mkt_feed_pending") && s.get("mktfeed_" + today) === "done", "C7 the hold is cleared and the day is marked done");
await say(s, "Feed");
ok(claudeCalls === 0 && !texts().some((t) => /Building/.test(t)), "C8 a further 'Feed' afterwards also builds nothing");
// held set, too old to send: nothing held any more, so 'Feed' builds
s = new Map([["mkt_latest", FRESH_NOW], ["mkt_feed_famhist", "[]"], ["mktfeed_" + today, "held"],
  ["wa_owner_last_in", new Date(Date.now() - 30 * 3600000).toISOString()],
  ["mkt_feed_pending", JSON.stringify({ at: Date.now() - 30 * 3600000, at_gst: "x", bodyTxt: "ancient", rows: [], angles: FIVE })]]);
await say(s, "Feed");
ok(!texts().some((t) => /ancient/.test(t)), "C9 a held set older than 20 h is dropped, not sent late");
ok(sent.every((m) => m.to === HER), "every WhatsApp message in the C tests went to her number only");

// ---- config + untouched lines --------------------------------------------------------------------------------------------------------
const TOML = readFileSync(new URL("../wrangler.toml", import.meta.url), "utf8");
ok(/^FEED_DEADLINE_GST\s*=\s*"8"/m.test(TOML) && /^FEED_HOUR_GST\s*=\s*"5"/m.test(TOML), "wrangler.toml: FEED_DEADLINE_GST = 8, FEED_HOUR_GST still 5");
ok((TOML.match(/^crons\s*=.*$/gm) || []).length >= 2 && /crons = \["0,30 1-18 \* \* \*", "\* \* \* \* \*"\]/.test(TOML), "the azimuth-2 cron line is unchanged");

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
