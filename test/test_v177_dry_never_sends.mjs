// v177 — A DRY RUN MUST NEVER REACH HER PHONE (18 Sep 2026).
//
// /feed_test?dry=1 is the documented safe diagnostic: it generates the morning five and returns them as text. It
// calls dailyFeedTick(env, true, true) — so FORCE IS ALWAYS TRUE in a dry run. Two sends sat before the dry return:
// the stale-data notice, and a "couldn't build" notice gated only on force. The data session found them by reading
// the tick after running it at 01:00 GST. Had the market refresh been stale, the safe preview would have WhatsApped
// Naj in the middle of the night — and an outage is exactly when someone reaches for a diagnostic.
//
// This is a behavioural test, not a string match: it runs the real route with WhatsApp configured so that a send
// WOULD leave, and records every outbound request.
import worker from "../src/index.js";

const READ = "owner_admin_key_never_in_client_links_0001";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("ok - " + m); } else { fail++; console.log("not ok - " + m); } };

const sent = [];
globalThis.fetch = async (u, o) => {
  const url = String(u && u.url ? u.url : u);
  if (/graph\.facebook\.com|messages/.test(url)) sent.push({ url, body: o && o.body ? String(o.body).slice(0, 160) : "" });
  return new Response(JSON.stringify({ messages: [{ id: "wamid.test" }] }), { status: 200, headers: { "Content-Type": "application/json" } });
};

const staleStore = (ageDays) => {
  const store = new Map();
  store.set("mkt_latest", JSON.stringify({ generatedAt: new Date(Date.now() - ageDays * 86400000).toISOString() }));
  return {
    async get(k, t) { if (!store.has(k)) return null; const v = store.get(k); return t === "json" ? JSON.parse(v) : v; },
    async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); },
    async list() { return { keys: [], list_complete: true }; },
  };
};
const envOf = (kv) => ({
  MEETINGS: kv, READ_KEY: READ, MARKET_BRIEF: "on", PUBLIC_ORIGIN: "https://x",
  WHATSAPP_TOKEN: "wa_token_for_test_only", WA_PHONE_ID: "1234567890", WA_ALLOWED: "971500000000",   // configured, so a send WOULD leave
});
const dryRun = (env) => worker.fetch(new Request("https://x/feed_test?dry=1&key=" + READ), env, { waitUntil() {} });

// --- stale market data, dry run --------------------------------------------------------------------
sent.length = 0;
const r = await dryRun(envOf(staleStore(12)));
const txt = await r.text();
ok(r.status === 200, "the dry run answers");
ok(sent.length === 0, "and NOTHING was sent to WhatsApp with 12-day-old market data" + (sent.length ? " - it sent: " + JSON.stringify(sent) : ""));
ok(/dry run - nothing sent/.test(txt) && /12 days old/.test(txt), "instead it RETURNS what the morning would have said, so the diagnostic still diagnoses: " + txt.slice(0, 90));

// --- the guard must not have silenced the real morning ---------------------------------------------
// The live (non-dry) path with stale data must still tell her, because that message is the point of the gate.
sent.length = 0;
const live = envOf(staleStore(12));
const tick = await worker.fetch(new Request("https://x/feed_test?key=" + READ), live, { waitUntil() {} });
await tick.text();
ok(sent.length === 1, "a REAL run with stale data still sends her the notice exactly once - the guard is on the dry path only");

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
