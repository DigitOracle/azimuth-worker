// v186 — THE 24-HOUR WINDOW (Naj, 21 Sep 2026: "I didn't receive anything this morning").
//
// She last wrote on 19 Sep. On 21 Sep WhatsApp accepted all ten of the morning's messages - five angles, five cards - and then
// failed every one with "Re-engagement message", because a business may only send freely within 24 hours of the customer's last
// message. Nothing noticed: the QA line said "5 sent". Now the feed checks the window first, HOLDS the morning, nudges her with
// the approved template, tells Kendall, flushes when she writes back, and a watchdog reads the receipts rather than the send.
import worker from "../src/index.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("ok - " + m); } else { fail++; console.log("not ok - " + m); } };
const A = (hook, figure, source, family, reader) => ({ hook, figure, source, buyer: "b", family, reader });
const FIVE = [A("Public beaches grow 400% by 2040.", "400%", "Dubai Media Office, 13 Mar 2021", "city_life", "move"),
  A("14 new Metro stations on the Blue Line.", "14 stations", "Dubai Media Office, 4 Mar 2025", "transit", "invest"),
  A("The plan targets 5.8 million residents by 2040.", "5.8 million (2040 target); 3.3 million (2020 baseline)", "Dubai Media Office, 13 Mar 2021", "growth_plan", "authority"),
  A("Prices held at AED 1,520 per sq ft.", "AED 1,520 per sq ft", "DLD Open Data, 2026-09-18", "prices", "invest"),
  A("4,410 homes handed over this quarter.", "4,410 handovers", "DLD Open Data, Q3 2026", "handover_supply", "invest")];

let sent = [], owner = [];
globalThis.fetch = async (u, o) => {
  const url = String(u && u.url ? u.url : u);
  if (/anthropic/i.test(url)) {
    let body = {}; try { body = JSON.parse(String(o && o.body || "{}")); } catch (e) {}
    const isVoice = /rewrite social-post hooks/.test(JSON.stringify(body.system || ""));
    return new Response(JSON.stringify({ content: [{ type: "text", text: isVoice ? JSON.stringify({ items: [] }) : JSON.stringify({ angles: FIVE }) }], stop_reason: "end_turn" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  if (/graph\.facebook\.com/.test(url)) { let b = {}; try { b = JSON.parse(String(o && o.body || "{}")); } catch (e) {} sent.push(b); return new Response(JSON.stringify({ messages: [{ id: "wamid." + sent.length }] }), { status: 200 }); }
  if (/owner_note/.test(url)) { try { owner.push(JSON.parse(String(o.body)).text); } catch (e) {} return new Response("sent", { status: 200 }); }
  return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
};
const READ = "owner_admin_key_never_in_client_links_0001";
const HER = "971565484397";
const mkStore = (lastIn) => new Map([["mkt_latest", JSON.stringify({ generatedAt: new Date().toISOString() })], ["mkt_feed_famhist", "[]"]].concat(lastIn ? [["wa_owner_last_in", lastIn]] : []));
const mkEnv = (store, extra) => Object.assign({ MEETINGS: {
    async get(k, t) { if (!store.has(k)) return null; const v = store.get(k); return t === "json" ? JSON.parse(v) : v; },
    async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); },
    async list(o) { return { keys: [...store.keys()].filter((k) => !o || !o.prefix || k.startsWith(o.prefix)).map((name) => ({ name })), list_complete: true }; } },
  AI: { run: async () => ({ response: "{}" }) },   // the inbound path runs the meeting parser; it is not what this test is about
  READ_KEY: READ, MARKET_BRIEF: "on", ANTHROPIC_API_KEY: "test-only-not-a-key", PUBLIC_ORIGIN: "https://x", WA_ALLOWED: HER, WHATSAPP_TOKEN: "t", WA_PHONE_ID: "1",
  FEED_SCENES: "on", FEED_TEMPLATE: "azimuth_daily", FEED_TEMPLATE_LANG: "en_US", OWNER_NOTE_URL: "https://mc/owner_note", INGEST_TOKEN: "i", MINUTE_TICK: "on" }, extra || {});
const feed = async (store, extra) => { sent = []; owner = []; const r = await worker.fetch(new Request("https://x/feed_test?key=" + READ), mkEnv(store, extra), { waitUntil() {} }); await r.text(); };
const jobs = (store) => [...store.keys()].filter((k) => k.startsWith("picjob_s"));
const texts = () => sent.filter((m) => m.type !== "template").map((m) => (m.text && m.text.body) || (m.interactive && JSON.stringify(m.interactive)) || "");

// ---- her window is SHUT (she last wrote two days ago) -------------------------------------------------------------------------
const shut = mkStore(new Date(Date.now() - 48 * 3600 * 1000).toISOString());
await feed(shut);
ok(!texts().some((t) => /Najma daily/.test(t)), "with her window shut, the morning is NOT fired into the void");
const tpl = sent.find((m) => m.type === "template");
ok(tpl && tpl.template && tpl.template.name === "azimuth_daily", "she gets the approved template instead - the only message Meta delivers outside the window");
ok(tpl && /ready/i.test(JSON.stringify(tpl.template.components)) && /Reply/i.test(JSON.stringify(tpl.template.components)), "which tells her it's ready and to reply: " + (tpl ? JSON.stringify(tpl.template.components).slice(0, 120) : ""));
ok(owner.some((t) => /HELD/.test(t) && /window is shut/.test(t)), "Kendall is told the morning is held: " + (owner[0] || "").slice(0, 90));
ok(shut.has("mkt_feed_pending"), "and the morning is kept, in full");
ok(jobs(shut).length === 0, "no picture jobs are queued into a shut window either");

// ---- she writes back: everything goes at once ---------------------------------------------------------------------------------
sent = []; owner = [];
const wa = { entry: [{ changes: [{ value: { metadata: { phone_number_id: "1" }, messages: [{ from: HER, id: "m1", timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body: "hi" } }] } }] }] };
await worker.fetch(new Request("https://x/wa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(wa) }), mkEnv(shut), { waitUntil() {} });
await new Promise((r) => setTimeout(r, 60));   // the flush runs as background work (ctx.waitUntil), which this fake runtime does not await
ok(texts().some((t) => /Najma daily/.test(t)), "her reply sends the held morning immediately");
ok(texts().some((t) => /Choose an angle/.test(t)), "with the pick-an-angle list");
ok(jobs(shut).length === 5, "and queues the five cards: " + jobs(shut).length);
ok(!shut.has("mkt_feed_pending"), "the held morning is cleared, so it cannot go twice");
ok(owner.some((t) => /wrote back/.test(t)), "Kendall is told it went");

// ---- a held morning that is too old is dropped, not sent late ------------------------------------------------------------------
const stale = mkStore(new Date(Date.now() - 48 * 3600 * 1000).toISOString());
stale.set("mkt_feed_pending", JSON.stringify({ at: Date.now() - 30 * 3600 * 1000, at_gst: "2026-09-19T06:00:00+04:00", bodyTxt: "old morning", rows: [], angles: FIVE }));
sent = []; owner = [];
await worker.fetch(new Request("https://x/wa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(wa) }), mkEnv(stale), { waitUntil() {} });
await new Promise((r) => setTimeout(r, 60));
ok(!texts().some((t) => /old morning/.test(t)) && !stale.has("mkt_feed_pending"), "a morning older than 20 hours is dropped rather than sent stale");
ok(owner.some((t) => /too old/.test(t)), "and Kendall is told why");

// ---- her window is OPEN: nothing changes ---------------------------------------------------------------------------------------
const open = mkStore(new Date().toISOString());
await feed(open);
ok(texts().some((t) => /Najma daily/.test(t)) && jobs(open).length === 5, "with her window open the morning goes as usual, five cards and all");
ok(!sent.some((m) => m.type === "template"), "and no template is spent when it isn't needed");

// ---- the watchdog reads RECEIPTS, not the send ----------------------------------------------------------------------------------
const w = mkStore(new Date().toISOString());
w.set("wa_outbox", JSON.stringify([1, 2, 3].map((i) => ({ id: "w" + i, kind: "image", state: "failed", sent_at: new Date(Date.now() - 60000).toISOString(), error: "Re-engagement message" }))));
sent = []; owner = [];
await worker.scheduled({ cron: "* * * * *", scheduledTime: Date.now() }, mkEnv(w), { waitUntil: (p) => p });
await new Promise((r) => setTimeout(r, 60));
ok(owner.some((t) => /FAILED/.test(t) && /Re-engagement/.test(t)), "three accepted-then-failed messages raise an alert to Kendall: " + (owner.find((t) => /FAILED/.test(t)) || "").slice(0, 100));
owner = [];
await worker.scheduled({ cron: "* * * * *", scheduledTime: Date.now() }, mkEnv(w), { waitUntil: (p) => p });
ok(!owner.some((t) => /FAILED/.test(t)), "and it is said once a day, not every minute");

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
