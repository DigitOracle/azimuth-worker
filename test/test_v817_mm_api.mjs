// v817 - campaign MARKETING template sends go to the Marketing Messages API (POST /<phone-id>/marketing_messages) when the campaign says
// api:"mm" (or env CAMP_MM_API=1); utility templates stay on /messages; an MM "not onboarded"-type refusal falls back to /messages once;
// retry_131049 lets a person Meta held back (131049) be tried again after retry_days (default 2). FAKE numbers; graph is MOCKED.
const C = await import("../src/campaigns.js");
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 500)); } };
const store = new Map();
const KV = { get: async (k) => (store.has(k) ? store.get(k) : null), put: async (k, v) => { store.set(k, String(v)); }, delete: async (k) => { store.delete(k); },
  list: async ({ prefix } = {}) => ({ keys: [...store.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) };
const DESK = "100000000000001";
const baseEnv = { MEETINGS: KV, WA_DESK_PHONE_ID: DESK, WA_PHONE_ID: "100000000000002", WHATSAPP_TOKEN: "TEST_TOKEN", PUBLIC_ORIGIN: "https://w" };
const calls = []; const queue = []; let n = 0;   // queue: error objects to answer with, in order (null = success)
const fetchMock = async (u, init) => {
  const s = String(u); if (!/^https:\/\/graph\.facebook\.com\//.test(s)) throw new Error("network blocked: " + s);
  calls.push({ url: s, body: JSON.parse(init.body) });
  const e = queue.length ? queue.shift() : null;
  if (e) return new Response(JSON.stringify({ error: e }), { status: 400 });
  return new Response(JSON.stringify({ messages: [{ id: "wamid.M" + (++n) }] }), { status: 200 });
};
const J = (k) => JSON.parse(store.get(k) || "null");
const T = Date.UTC(2026, 10, 9, 8, 0), DAYMS = 86400000;
const deps = (now) => ({ now, fetch: fetchMock, alert: async () => {} });
function reset() { n = 0; store.clear(); calls.length = 0; queue.length = 0; }
function contact(d, extra) { const k = Object.assign({ e164: "+" + d, name: "Test Owner", tags: ["t"], consent: { text: "ok", date: "2026-11-01" } }, extra || {});
  store.set("camp_contact_" + d, JSON.stringify(k)); const ix = J("camp_contact_index") || []; ix.push(d); store.set("camp_contact_index", JSON.stringify(ix)); }
const camp = (x) => Object.assign({ id: "mm1", status: "live", template: "pja_test_mkt", lang: "en", vars: [], tags: ["t"], cap: 100, batch: 10, window: "00:00-23:59", days: "all", ramp: false, owner_tz: false, phone: "desk" }, x || {});
const D1 = "971500000001", D2 = "971500000002", D3 = "971500000003";

// 1. defaults: off unless the campaign or env says so
reset(); contact(D1);
let r = await C.campStep(baseEnv, camp(), deps(T), false);
ok(r.sent === 1 && calls[0].url === "https://graph.facebook.com/v21.0/" + DESK + "/messages" && r.api_mode === "cloud", "default: /messages", { r, calls });
ok(J("camp_msg_wamid.M1").api === "cloud", "camp_msg records api cloud");

// 2. api:"mm" on a MARKETING template -> /marketing_messages, same payload
reset(); contact(D1);
r = await C.campStep(baseEnv, camp({ api: "mm" }), deps(T), false);
ok(r.sent === 1 && calls.length === 1 && calls[0].url === "https://graph.facebook.com/v21.0/" + DESK + "/marketing_messages", "api mm: /marketing_messages", calls);
ok(calls[0].body.type === "template" && calls[0].body.template.name === "pja_test_mkt" && calls[0].body.messaging_product === "whatsapp", "same template payload", calls[0].body);
ok(J("camp_msg_" + "wamid.M" + n).api === "mm", "camp_msg records api mm");

// 3. env CAMP_MM_API=1 turns it on; a campaign api:"cloud" turns it off again
reset(); contact(D1);
r = await C.campStep(Object.assign({}, baseEnv, { CAMP_MM_API: "1" }), camp(), deps(T), false);
ok(/\/marketing_messages$/.test(calls[0].url), "env CAMP_MM_API=1: MM", calls);
reset(); contact(D1);
r = await C.campStep(Object.assign({}, baseEnv, { CAMP_MM_API: "1" }), camp({ api: "cloud" }), deps(T), false);
ok(/\/messages$/.test(calls[0].url), "campaign api cloud overrides env", calls);

// 4. a UTILITY template stays on /messages even with api mm
reset(); contact(D1);
r = await C.campStep(baseEnv, camp({ api: "mm", template: "najma_feed_ready", lang: "en_US" }), deps(T), false);
ok(/\/messages$/.test(calls[0].url) && r.api_mode === "cloud", "utility template: /messages", calls);
ok(C.useMm({}, { api: "mm" }, "AUTHENTICATION") === false && C.useMm({}, { api: "mm" }, "MARKETING") === true, "useMm by category");

// 5. dry run shows the MM url
reset(); contact(D1);
r = await C.campStep(baseEnv, camp({ api: "mm" }), deps(T), true);
ok(calls.length === 0 && r.would.length === 1 && /\/marketing_messages$/.test(r.would[0].url) && r.would[0].api === "mm", "dry run: MM url, nothing sent", r.would);

// 6. "not onboarded"-type refusal: once more on /messages, reason recorded, rest of the step stays on /messages
reset(); contact(D1); contact(D2);
queue.push({ code: 100, message: "(#100) The business is not onboarded to Marketing Messages API" });
r = await C.campStep(baseEnv, camp({ api: "mm" }), deps(T), false);
ok(calls.length === 3 && /marketing_messages$/.test(calls[0].url) && /\/messages$/.test(calls[1].url) && /\/messages$/.test(calls[2].url), "fallback once, then /messages for the step", calls.map((c) => c.url));
ok(r.sent === 2 && /not onboarded/.test(r.mm_fallback || "") && /not onboarded/.test((J("camp_mm_fallback_mm1") || {}).why || ""), "fallback reason recorded", r);
ok(J("camp_msg_wamid.M1").api === "cloud_fallback" && /not onboarded/.test(J("camp_msg_wamid.M1").fallback), "camp_msg api cloud_fallback + why", J("camp_msg_wamid.M1"));
ok(J("camp_stats_mm1").failed === 0, "a fallback is not a failure", J("camp_stats_mm1"));

// 7. a real per-message refusal on MM (131049) does NOT fall back; it is counted as before
reset(); contact(D1);
queue.push({ code: 131049, message: "This message was not delivered to maintain healthy ecosystem engagement." });
r = await C.campStep(baseEnv, camp({ api: "mm" }), deps(T), false);
ok(calls.length === 1 && r.sent === 0 && !r.mm_fallback && J("camp_contact_" + D1).skip_code === 131049, "131049 on MM: no fallback, skip_code set", { calls, r });
ok(C.mmNotReady({ code: 131026, message: "marketing messages" }) === false && C.mmNotReady({ code: 10, message: "x" }) === true, "mmNotReady guards delivery codes");

// 8. opt-out still checked before an MM send
reset(); contact(D1); store.set("camp_optout_" + D1, "1");
r = await C.campStep(baseEnv, camp({ api: "mm" }), deps(T), false);
ok(calls.length === 0 && r.skipped.opted_out === 1, "opt-out still honoured", r);

// 9. retry_131049
reset();
contact(D1, { last_mkt: new Date(T - 3 * DAYMS).toISOString(), skip_code: 131049 });   // held 3 days ago
contact(D2, { last_mkt: new Date(T - 1 * DAYMS).toISOString(), skip_code: 131049 });   // held 1 day ago: too soon
contact(D3, { last_mkt: new Date(T - 3 * DAYMS).toISOString() });                      // really messaged 3 days ago: still freq-limited
r = await C.campStep(baseEnv, camp({ id: "r1" }), deps(T), false);
ok(r.sent === 0 && r.skipped.messaged_this_week === 3, "without retry_131049 all three are freq-limited", r);
reset();
contact(D1, { last_mkt: new Date(T - 3 * DAYMS).toISOString(), skip_code: 131049 });
contact(D2, { last_mkt: new Date(T - 1 * DAYMS).toISOString(), skip_code: 131049 });
contact(D3, { last_mkt: new Date(T - 3 * DAYMS).toISOString() });
r = await C.campStep(baseEnv, camp({ id: "r2", retry_131049: true }), deps(T), false);
ok(r.sent === 1 && calls.length === 1 && calls[0].body.to === D1, "retry_131049: only the 3-day-old 131049 is sent", { r, to: calls.map((c) => c.body.to) });
ok(r.skipped.retry_131049_too_soon === 1 && r.skipped.messaged_this_week === 1, "1-day-old 131049 too soon; real send still freq-limited", r.skipped);
ok(J("camp_contact_" + D1).skip_code === undefined, "a good send clears skip_code");
reset(); contact(D2, { last_mkt: new Date(T - 1 * DAYMS).toISOString(), skip_code: 131049 });
r = await C.campStep(baseEnv, camp({ id: "r3", retry_131049: true, retry_days: 1 }), deps(T), false);
ok(r.sent === 1, "retry_days 1: the 1-day-old one goes", r);
const cc = C.cleanCampaign({ id: "x1", template: "t", lang: "en", tags: ["a"], api: "mm", retry_131049: true, retry_days: "3" }, null).c;
ok(cc.api === "mm" && cc.retry_131049 === true && cc.retry_days === 3, "cleanCampaign keeps api / retry options", cc);

console.log("v817 MM API:", pass, "pass,", fail, "fail");
if (fail) process.exit(1);
