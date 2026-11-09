// v828 (Kendall 9 Nov 2026: "there should be children for each campaign"): parent campaigns with child runs.
// 1. Runs of one parent show as ONE card, totals de-duplicated per person (furthest status).
// 2. The default card is the parent with the latest sending activity, never an empty draft.
// 3. A live run whose whole queue is "too soon" (131049 retry) stays live/scheduled with "next eligible at", never "done" with 0 sent.
// 4. "create" attaches a run with the same flow + first tag to the existing parent.
import { campaignRoute, campStep } from "../src/campaigns.js";
import { personRollup, buildParents, pickParent } from "../src/camp_parents.js";

const store = new Map();
const env = { READ_KEY: "rk-owner", WA_DESK_PHONE_ID: "111", WHATSAPP_TOKEN: "t", MEETINGS: { get: async (k) => (store.has(k) ? store.get(k) : null), put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); } } };
const put = (k, v) => store.set(k, JSON.stringify(v)), getj = (k) => JSON.parse(store.get(k) || "null");
const fail = (m) => { console.error("FAIL", m); process.exit(1); };
const NOW = Date.parse("2026-11-09T08:00:00Z");   // 12:00 Dubai, Monday
const deps = { now: NOW, fetch: async () => { throw new Error("no network in tests"); } };

const base = { template: "tpl", lang: "en", vars: [], tags: ["pja-frond-b"], flow: "pja-owners", phone: "desk", window: "10:00-20:00", days: "all", cap: 70, batch: 5, ramp: false, owner_tz: false };
put("camp_index", ["r1", "r2", "r3", "other"]);
put("camp_r1", Object.assign({}, base, { id: "r1", name: "PJA (launch 8 Nov)", status: "stopped", created: "2026-11-08T13:24:00Z", started: "2026-11-08T13:25:00Z", stopped: { at: "2026-11-08T13:30:00Z", why: "x" } }));
put("camp_r2", Object.assign({}, base, { id: "r2", name: "PJA (8 Nov, remaining)", status: "done", created: "2026-11-08T13:45:00Z", started: "2026-11-08T13:46:00Z", done: "2026-11-08T13:53:00Z" }));
put("camp_r3", Object.assign({}, base, { id: "r3", name: "PJA (Mon 9 Nov retry)", status: "draft", created: "2026-11-08T14:44:00Z", api: "mm", retry_131049: true, retry_days: 1 }));
put("camp_other", Object.assign({}, base, { id: "other", name: "Older thing", tags: ["dh2"], flow: "", status: "done", created: "2026-11-01T10:00:00Z", started: "2026-11-01T10:00:00Z", done: "2026-11-01T11:00:00Z" }));
put("camp_stats_r1", { sent: 3, delivered: 2, read: 1, day: { "2026-11-08": 3 } });
put("camp_stats_r2", { sent: 2, delivered: 2, read: 2, day: { "2026-11-08": 2 } });
put("camp_stats_other", { sent: 1, delivered: 1, read: 0, day: { "2026-11-01": 1 } });
// person A: delivered in r1, read in r2 -> once, as read. B: read in r1. C: failed in r1. D: read in r2.
put("camp_msgs_r1", ["w1", "w2", "w3"]); put("camp_msgs_r2", ["w4", "w5"]); put("camp_msgs_other", ["w6"]);
put("camp_msg_w1", { cid: "r1", d: "971500000001", at: "2026-11-08T13:25:00Z", st: "delivered", delivered: true });
put("camp_msg_w2", { cid: "r1", d: "971500000002", at: "2026-11-08T13:25:00Z", st: "read", delivered: true, read: true });
put("camp_msg_w3", { cid: "r1", d: "971500000003", at: "2026-11-08T13:25:00Z", st: "failed" });
put("camp_msg_w4", { cid: "r2", d: "971500000001", at: "2026-11-08T13:47:00Z", st: "read", delivered: true, read: true });
put("camp_msg_w5", { cid: "r2", d: "971500000004", at: "2026-11-08T13:47:00Z", st: "read", delivered: true, read: true });
put("camp_msg_w6", { cid: "other", d: "971500000009", at: "2026-11-01T10:00:00Z", st: "delivered", delivered: true });

const all = []; for (const id of ["r1", "r2", "r3", "other"]) all.push({ c: getj("camp_" + id), S: Object.assign({ sent: 0 }, getj("camp_stats_" + id) || {}) });
const P = await buildParents(env, all);
if (P.length !== 2) fail("two parents expected, got " + P.map((x) => x.id));
const fb = P.find((x) => x.id === "pja-frond-b"); if (!fb || fb.runs.length !== 3) fail("Frond B parent must hold r1, r2, r3");
if (pickParent(P).id !== "pja-frond-b") fail("default must be the parent with the latest activity");
const { tot } = await personRollup(env, fb.runs);
if (tot.sent !== 4 || tot.delivered !== 3 || tot.read !== 3 || tot.failed !== 1) fail("dedup totals wrong " + JSON.stringify(tot));

// a parent that is only a draft is never the default
const P2 = await buildParents(env, [all[2], all[3]]); if (pickParent(P2).id !== "dh2") fail("draft-only parent became default");

// the card
const html = await (await campaignRoute(new Request("https://x/momo/campaigns"), env, new URL("https://x/momo/campaigns?key=rk-owner"), deps)).text();
if (!/id="camp_pja-frond-b"/.test(html)) fail("parent card missing");
if (!/Runs \(3\)/.test(html) || !/id="run_r1"/.test(html) || !/id="run_r3"/.test(html)) fail("child runs missing");
if (!/<b>4<\/b><i>Messaged<\/i>/.test(html)) fail("parent tiles must show de-duplicated totals");
if (!/Scheduled \/ not sent yet/.test(html)) fail("draft run must read Scheduled / not sent yet");
if (!/data-a=live data-id="r3"/.test(html)) fail("the draft child carries its own launch action");
if (/data-a=live data-id="r[12]"/.test(html)) fail("done / stopped runs have no launch action");

// 3. the guard: a LIVE run where everyone is "too soon" stays live, records next eligible, never "done"
put("camp_index", ["r1", "r2", "r3", "other", "r5"]);
put("camp_r5", Object.assign({}, base, { id: "r5", name: "PJA (retry)", status: "live", created: "2026-11-09T07:00:00Z", started: "2026-11-09T07:59:00Z", api: "mm", retry_131049: true, retry_days: 1, freq_days: 14 }));
const consent = { text: "consented to hear about PJA", date: "2026-11-01" };
put("camp_contact_index", ["971500000007", "971500000008"]);
put("camp_contact_971500000007", { e164: "+971500000007", name: "A", tags: ["pja-frond-b"], consent, last_mkt: "2026-11-08T14:00:00Z", skip_code: 131049 });   // too soon (retry 1 day)
put("camp_contact_971500000008", { e164: "+971500000008", name: "B", tags: ["pja-frond-b"], consent, last_mkt: "2026-11-08T13:47:00Z" });                    // messaged this week
const r = await campStep(env, getj("camp_r5"), deps, false);
if (r.sent !== 0 || r.skipped.retry_131049_too_soon !== 1) fail("step " + JSON.stringify(r));
const c5 = getj("camp_r5"); if (c5.status !== "live") fail("a run with people waiting for retry must NOT be closed as done (got " + c5.status + ")");
const q5 = getj("camp_q_r5"); if (!q5.later || q5.later.length !== 1 || q5.later[0].due !== Date.parse("2026-11-09T14:00:00Z")) fail("q.later " + JSON.stringify(q5.later));
const s5 = getj("camp_stats_r5"); if (s5.next_eligible !== "2026-11-09T14:00:00.000Z") fail("next_eligible " + s5.next_eligible);
const html2 = await (await campaignRoute(new Request("https://x/momo/campaigns"), env, new URL("https://x/momo/campaigns?key=rk-owner&c=r5"), deps)).text();
if (!/next eligible at 18:00 Dubai, 9 Nov/.test(html2)) fail("child card must show next eligible");
// once due, the person comes back from q.later; the tick tries to send (fetch throws -> a failed attempt, not silently dropped)
const later = await campStep(env, getj("camp_r5"), Object.assign({}, deps, { now: Date.parse("2026-11-09T14:01:00Z") }), false);
if (later.skipped.retry_131049_too_soon) fail("due person still skipped");
if ((getj("camp_q_r5").later || []).length) fail("q.later should be empty once worked");

// 4. create attaches to the existing parent
put("camp_flow_pja-owners", { id: "pja-owners", start: "s", nodes: { s: { type: "template", template: "tpl", lang: "en", vars: [] } } });
const cr = await campaignRoute(new Request("https://x/momo/campaigns/api", { method: "POST", body: JSON.stringify({ action: "create", id: "r6", name: "PJA r6", flow: "pja-owners", tags: ["pja-frond-b"] }) }), env, new URL("https://x/momo/campaigns/api?key=rk-owner"), deps);
const cj = await cr.json(); if (!cj.ok || cj.campaign.parent !== "pja-frond-b") fail("create should attach to pja-frond-b: " + JSON.stringify(cj));
if (getj("camp_r6").status !== "draft") fail("new run must be a draft");
if (!getj("camp_parent_pja-frond-b")) fail("parent record should exist");
console.log("v828 campaign parents: all checks passed");
