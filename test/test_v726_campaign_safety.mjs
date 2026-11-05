// v726 - campaign SAFETY (Kendall 4 Nov, items 1-8): Mon-Fri 10:00-17:30 Dubai window, error buckets, phone quality webhook,
// ramp 50/100/150/250, back-off on throughput limits, "Stop promotions" opt-out, template status/quality webhooks, owner time zone,
// per-message status rows (90-day TTL), "forget me", and the PJA defaults (template _v2, desk number; owner replies on the desk reach campWebhook).
// FAKE numbers; graph.facebook.com is MOCKED and any other host throws.
import fs from "node:fs";
const worker = (await import("../src/index.js")).default;
const C = await import("../src/campaigns.js");
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 500)); } };
const store = new Map(), ttl = new Map();
const KV = { get: async (k) => (store.has(k) ? store.get(k) : null), put: async (k, v, o) => { store.set(k, String(v)); if (o && o.expirationTtl) ttl.set(k, o.expirationTtl); }, delete: async (k) => { store.delete(k); },
  list: async ({ prefix } = {}) => ({ keys: [...store.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) };
const NAJ = "971500000099", KEN = "971500000098", MAIN = "100000000000002", DESK = "100000000000001";
const env = { MEETINGS: KV, WA_ALLOWED: NAJ, WA_DESK_OWNER: KEN, WA_DESK_PHONE_ID: DESK, WA_PHONE_ID: MAIN, WHATSAPP_TOKEN: "TEST_TOKEN", WA_FORWARD_TOKEN: "fwd_TEST_0123456789", PUBLIC_ORIGIN: "https://w", AI: { run: async () => ({ response: "{}" }) } };
const ctx = { waitUntil() {}, passThroughOnException() {} };
const calls = []; let nextErr = null, n = 0;
globalThis.fetch = async (u, init) => {
  const s = String(u && u.url || u);
  if (!/^https:\/\/graph\.facebook\.com\//.test(s)) throw new Error("network blocked in test: " + s);
  calls.push({ url: s, body: init && init.body ? JSON.parse(init.body) : null });
  if (nextErr) { const e = nextErr; nextErr = null; return new Response(JSON.stringify({ error: e }), { status: 400 }); }
  return new Response(JSON.stringify({ messages: [{ id: "wamid.S" + (++n) }] }), { status: 200 });
};
const J = (k) => JSON.parse(store.get(k) || "null");
const alerts = []; const deps = (now) => ({ now, alert: async (e, t) => { alerts.push(t); } });
const hook = (val, field) => C.campWebhook(env, { entry: [{ changes: [{ field: field || "messages", value: val }] }] }, deps(T));
// Wed 4 Nov 2026 11:00 UTC = 15:00 Dubai, 11:00 London, 16:30 India, 06:00 New York
const T = Date.UTC(2026, 10, 4, 11, 0);
const SAT = Date.UTC(2026, 10, 7, 11, 0), LATE = Date.UTC(2026, 10, 4, 14, 0);   // Saturday; Wed 18:00 Dubai

// 1. sending window
ok(C.DEFAULTS.window === "10:00-17:30" && C.DEFAULTS.days === "mon-fri", "default window Mon-Fri 10:00-17:30 Dubai");
const w = { window: "10:00-17:30", days: "mon-fri" };
ok(C.inWindow(w, T) && !C.inWindow(w, SAT) && !C.inWindow(w, LATE), "inWindow: weekday afternoon yes, Saturday no, 18:00 no");
ok(C.inWindow({ window: "10:00-17:30", days: "all" }, SAT), "days all: Saturday open");
ok(String(C.parseDays("sun-thu")) === "0,1,2,3,4" && C.parseDays("xyz") === null, "parseDays");
let cc = C.cleanCampaign({ id: "x1", template: "t", lang: "en", tags: ["a"] }, null);
ok(cc.c.window === "10:00-17:30" && cc.c.days === "mon-fri" && !cc.err.length, "new campaign gets the legal window", cc);
ok(C.cleanCampaign({ id: "x2", template: "t", lang: "en", tags: ["a"], days: "funday" }, null).err.some((e) => /days/.test(e)), "bad days refused");

// 8a. owner time zone
ok(C.ownerOpen({}, "+447700900000", T) && C.ownerOpen({}, "+919800000000", T) && !C.ownerOpen({}, "+12125550100", T), "owner local hours: London and India open, New York (06:00) shut");
ok(C.ownerOffset("+447700900000", Date.UTC(2026, 6, 1)) === 60 && C.ownerOffset("+447700900000", T) === 0, "UK summer time");
ok(C.ownerOffset("+12125550100", Date.UTC(2026, 6, 1)) === -240 && C.ownerOffset("+12125550100", T) === -300, "US summer time ends 1 Nov");
ok(C.ownerTz("+999123").std === 240 && C.ownerTz("+79161234567").std === 180 && C.ownerTz("+8613800000000").std === 480 && C.ownerTz("+96171123456").std === 120, "unknown -> Dubai; Russia, China, Lebanon");
ok(!C.ownerOpen({}, "+971500000001", Date.UTC(2026, 10, 6, 11, 0)) === false, "UAE owner on a Friday 15:00: open (Mon-Fri)");

// set up: a campaign on the desk number, 5 contacts (UAE x3, UK, US)
const csv = "name,phone,consent_text,consent_date,tags,why\nA,0500000001,\"Yes to WhatsApp\",2026-10-01,t,you own a unit\nB,0500000002,\"Yes to WhatsApp\",2026-10-01,t,x\nUk,+447700900001,\"Yes to WhatsApp\",2026-10-01,t,x\nUs,+12125550101,\"Yes to WhatsApp\",2026-10-01,t,x\nD,0500000004,\"Yes to WhatsApp\",2026-10-01,t,x\n";
const im = await C.importContacts(env, csv, { apply: true, now: T }); ok(im.accepted === 5 && J("camp_contact_971500000001").why === "you own a unit", "import keeps the reason line", im);
const mk = (id, extra) => { const { c, err } = C.cleanCampaign(Object.assign({ id, name: id, template: "najjuko_pja_owner_intro_v2", lang: "en", tags: ["t"], vars: ["name", "why", "brn"], brn: "TEST1", cap: 250, batch: 10 }, extra || {}), null); c.status = "live"; store.set("camp_" + id, JSON.stringify(c)); const ix = J("camp_index") || []; if (!ix.includes(id)) ix.push(id); store.set("camp_index", JSON.stringify(ix)); return c; };
let c1 = mk("c1");
calls.length = 0; let r = await C.campStep(env, c1, deps(SAT), false); ok(calls.length === 0 && /outside window/.test(r.note), "Saturday: nothing sent", r);
calls.length = 0; r = await C.campStep(env, J("camp_c1"), deps(T), false);
ok(r.sent === 4 && r.skipped.owner_local_hours === 1 && calls.every((x) => x.url.includes("/" + DESK + "/")), "4 sent from the desk; the New York owner waits for their morning", r);
ok(calls[0].body.template.name === "najjuko_pja_owner_intro_v2" && calls[0].body.template.components[0].parameters.map((p) => p.text).join("|") === "A|you own a unit|TEST1", "template _v2 with name | reason | BRN", calls[0].body);
let q = J("camp_q_c1"); ok(q.wait.length === 1 && q.wait[0] === "12125550101" && J("camp_c1").status === "live", "queue keeps the waiting owner; campaign not done", q);
calls.length = 0; r = await C.campStep(env, J("camp_c1"), deps(Date.UTC(2026, 10, 4, 13, 0)), false);   // 17:00 Dubai, 08:00 NY: still shut
ok(calls.length === 0, "NY at 08:00 local: still waiting");
// 8b. per-message status rows, 90-day TTL, forward-only
const w1 = "wamid.S1"; ok(J("camp_status_" + w1).sent && ttl.get("camp_status_" + w1) === 90 * 86400, "status row written at send, 90-day TTL", J("camp_status_" + w1));
await hook({ metadata: { phone_number_id: DESK }, statuses: [{ id: w1, status: "read", timestamp: String(T / 1000 + 60) }] });
await hook({ metadata: { phone_number_id: DESK }, statuses: [{ id: w1, status: "delivered", timestamp: String(T / 1000 + 120) }] });
let sr = J("camp_status_" + w1); ok(sr.read && sr.delivered === sr.read && sr.sent, "read implies delivered; a late delivered never overwrites", sr);

// 2. error buckets
ok(!C.QUALITY.includes(131049) && !C.QUALITY.includes(131026) && !C.QUALITY.includes(131047) && !C.QUALITY.includes(130472), "the four codes are out of QUALITY");
ok(!C.HARD_STOP.includes(130429) && !C.HARD_STOP.includes(131056), "throughput codes are not a hard stop");
await hook({ metadata: { phone_number_id: DESK }, statuses: [{ id: "wamid.S2", status: "failed", errors: [{ code: 131026 }] }] });
ok(J("camp_contact_971500000002").undeliverable && J("camp_stats_c1").quality === 0, "131026: contact undeliverable, not quality", J("camp_stats_c1"));
await hook({ metadata: { phone_number_id: DESK }, statuses: [{ id: "wamid.S3", status: "failed", errors: [{ code: 131049 }] }] });
ok(J("camp_contact_447700900001").skip_code === 131049 && J("camp_stats_c1").quality === 0, "131049: skipped this cycle, not quality");
alerts.length = 0; await hook({ metadata: { phone_number_id: DESK }, statuses: [{ id: "wamid.S4", status: "failed", errors: [{ code: 131047 }] }] });
ok(alerts.length === 1 && /24-hour/.test(alerts[0]) && J("camp_stats_c1").flow_bug === 1 && J("camp_stats_c1").quality === 0, "131047: alerted as our flow bug, not quality", alerts);
ok(C.stopReason({}, { sent: 100, quality: 0, err: { 131049: 40, 131026: 20 } }) === "", "40% of 131049/131026 cannot trip the auto-stop");
// a fresh run: 131026 never resent
store.delete("camp_q_c1"); for (const d of ["971500000001", "971500000002", "447700900001", "971500000004"]) { const k = J("camp_contact_" + d); k.last_mkt = null; store.set("camp_contact_" + d, JSON.stringify(k)); }
calls.length = 0; r = await C.campStep(env, J("camp_c1"), deps(T + 600000), false);
ok(!calls.some((x) => x.body.to === "971500000002"), "undeliverable contact never sent again", r);

// 5. back-off on 130429 / 131056
let c2 = mk("c2", { tags: ["t"] }); store.delete("camp_q_c2"); for (const d of ["971500000001", "971500000004"]) { const k = J("camp_contact_" + d); k.last_mkt = null; store.set("camp_contact_" + d, JSON.stringify(k)); }
nextErr = { code: 130429, message: "rate" }; calls.length = 0; r = await C.campStep(env, c2, deps(T), false);
let bo = J("camp_backoff_c2"); ok(r.backoff && bo.n === 1 && bo.until === T + 30000 && J("camp_c2").status === "live" && (J("camp_stats_c2") || {}).sent === 0, "130429: back off 30 s, campaign stays live, not counted as a send", { r, bo });
calls.length = 0; r = await C.campStep(env, J("camp_c2"), deps(T + 10000), false); ok(calls.length === 0 && /backing off/.test(r.note), "inside the back-off: nothing");
calls.length = 0; r = await C.campStep(env, J("camp_c2"), deps(T + 31000), false); ok(r.sent >= 1 && calls[0].body.to === "971500000001" && !store.has("camp_backoff_c2"), "after it: the same person first, back-off cleared", r);
let c3 = mk("c3"); store.set("camp_backoff_c3", JSON.stringify({ n: 5 }));
alerts.length = 0; nextErr = { code: 131056, message: "pair" }; const k1 = J("camp_contact_971500000004"); k1.last_mkt = null; store.set("camp_contact_971500000004", JSON.stringify(k1));
store.set("camp_q_c3", JSON.stringify({ list: ["971500000004"], pos: 0 })); r = await C.campStep(env, c3, deps(T), false);
ok(J("camp_c3").status === "stopped" && /throughput/.test(J("camp_c3").stopped.why) && alerts.length === 1, "sixth back-off in a row: stopped, Kendall alerted", J("camp_c3"));

// 4. ramp
const R = (S, rating, today) => C.rampLevel({}, S, today || "2026-11-05", rating);
ok(R({ day: {} }, "GREEN").cap === 50, "day 1: 50");
ok(R({ day: { "2026-11-04": 50 }, bday: {}, ramp: { level: 0, for: "2026-11-04" } }, "GREEN").cap === 100, "clean day, GREEN: up to 100");
ok(R({ day: { "2026-11-04": 1000 }, bday: { "2026-11-04": 3 }, ramp: { level: 1, for: "2026-11-04" } }, "GREEN").cap === 100, "block rate 0.3%: hold");
ok(R({ day: { "2026-11-04": 100 }, bday: {}, ramp: { level: 1, for: "2026-11-04" } }, "YELLOW").cap === 100, "YELLOW: hold");
ok(R({ day: { "2026-11-04": 150 }, ramp: { level: 3, for: "2026-11-04" } }, "GREEN").cap === 250, "top step stays 250");
ok(R({ day: { "2026-11-04": 50 }, ramp: { level: 0, for: "2026-11-05", prev: "2026-11-04" } }, "GREEN").cap === 50, "decided once a day (no double step)");
let c4 = mk("c4", { cap: 30 }); store.delete("camp_q_c4"); store.set("camp_stats_c4", JSON.stringify({ day: { "2026-11-03": 50 }, ramp: { level: 0, for: "2026-11-03" } }));
r = await C.campStep(env, c4, deps(T), true); ok(r.day_cap === 30, "ramp never above c.cap", r);
store.set("camp_stats_c4", JSON.stringify({ day: {} })); const { c: c4b } = C.cleanCampaign({ cap: 500 }, J("camp_c4")); r = await C.campStep(env, c4b, deps(T), true); ok(r.day_cap === 50, "first day of a 500 cap campaign: 50", r);

// 3. phone quality webhook (desk display number 971585446093)
alerts.length = 0; let a = await hook({ display_phone_number: "971585446093", event: "UNKNOWN", quality_rating: "YELLOW" }, "phone_number_quality_update");
ok(J("camp_quality_desk").rating === "YELLOW" && alerts.length === 1 && /half/.test(alerts[0]), "YELLOW: stored, Kendall alerted", alerts);
store.set("camp_stats_c4", JSON.stringify({ day: {}, ramp: { level: 3, for: "2026-11-04" } })); const { c: c4c } = C.cleanCampaign({ cap: 250 }, J("camp_c4")); r = await C.campStep(env, c4c, deps(T), true); ok(r.day_cap === 125, "YELLOW halves the cap", r);
await hook({ display_phone_number: "971585446093", event: "UNKNOWN", current_quality_rating: "MEDIUM" }, "phone_number_quality_update"); ok(J("camp_quality_desk").rating === "YELLOW", "MEDIUM = YELLOW (old field name)");
alerts.length = 0; const liveBefore = ["c1", "c2", "c4"].filter((id) => J("camp_" + id).status === "live");
a = await hook({ display_phone_number: "+971 58 544 6093", event: "FLAGGED" }, "phone_number_quality_update");
ok(liveBefore.every((id) => J("camp_" + id).status === "paused") && J("camp_quality_desk").rating === "RED" && alerts.length === 1 && /Paused/.test(alerts[0]), "FLAGGED/RED: every live desk campaign paused, alert", { a, alerts });
r = await C.campStep(env, Object.assign(J("camp_c1"), { status: "live" }), deps(T), false); ok(/RED/.test(r.note), "RED: the sender refuses too");
store.set("camp_quality_desk", JSON.stringify({ rating: "GREEN" })); mk("c5"); alerts.length = 0;
await hook({ display_phone_number: "971585446093", event: "DOWNGRADE", old_limit: "TIER_2K", max_daily_conversations_per_business: "TIER_250" }, "phone_number_quality_update");
ok(J("camp_c5").status === "paused" && alerts.length === 1, "tier downgrade pauses (new field name)");
store.set("camp_quality_desk", JSON.stringify({ rating: "GREEN" })); mk("c6");
await hook({ display_phone_number: "971585446093", event: "THROUGHPUT_UPGRADE", current_limit: "TIER_UNLIMITED" }, "phone_number_quality_update");
ok(J("camp_c6").status === "live", "an upgrade changes nothing");
await hook({ display_phone_number: "971585876093", event: "FLAGGED" }, "phone_number_quality_update");
ok(J("camp_c6").status === "live" && J("camp_quality_main").rating === "RED", "the main number's RED does not pause a desk campaign");

// 7. template status / quality webhooks
alerts.length = 0; await hook({ event: "PAUSED", message_template_name: "najjuko_pja_owner_intro_v2", message_template_language: "en", reason: "NONE", other_info: { title: "FIRST_PAUSE" } }, "message_template_status_update");
ok(J("camp_c6").status === "paused" && /paused/.test(J("camp_c6").paused_by.why) && alerts.length === 1, "template PAUSED: campaign paused, alert", J("camp_c6"));
mk("c7", { template: "other_tpl" }); mk("c8");
store.set("camp_tpl_najjuko_pja_owner_intro_v2", JSON.stringify({ status: "APPROVED" }));
await hook({ event: "APPROVED", message_template_name: "other_tpl" }, "message_template_status_update"); ok(J("camp_c7").status === "live", "APPROVED: nothing paused");
await hook({ previous_quality_score: "GREEN", new_quality_score: "YELLOW", message_template_name: "najjuko_pja_owner_intro_v2" }, "message_template_quality_update");
ok(J("camp_c8").status === "paused" && J("camp_c7").status === "live", "template quality drop: only campaigns using it paused");
await hook({ event: "REJECTED", message_template_name: "other_tpl", reason: "PROMOTIONAL" }, "message_template_status_update"); ok(J("camp_c7").status === "paused", "REJECTED pauses");
r = await C.campStep(env, Object.assign(J("camp_c7"), { status: "live" }), deps(T), false); ok(/template other_tpl rejected/.test(r.note), "the sender refuses a rejected template", r);
// a template used only inside a flow (the follow-up) counts too
store.set("camp_flow_fl", JSON.stringify({ id: "fl", start: "s", nodes: { s: { type: "template", template: "a_tpl" }, n: { type: "template", template: "nudge_tpl" } } })); mk("c9", { template: "a_tpl", flow: "fl" });
await hook({ event: "DISABLED", message_template_name: "nudge_tpl" }, "message_template_status_update"); ok(J("camp_c9").status === "paused", "flow follow-up template disabled: paused");

// 6. Meta's "Stop promotions" button and the template's own "Stop messages"
ok(C.isOptOutText("Stop promotions") && C.isOptOutText("STOP MESSAGES") && C.isForgetText("Delete my details") && !C.isForgetText("stop"), "opt-out and forget wording");
await C.importContacts(env, "name,phone,consent_text,consent_date,tags\nP,0500000031,\"Yes to WhatsApp\",2026-10-01,t\nQ,0500000032,\"Yes to WhatsApp\",2026-10-01,t\n", { apply: true, now: T });
await hook({ metadata: { phone_number_id: DESK }, messages: [{ from: "971500000031", id: "x1", type: "button", button: { text: "Stop promotions", payload: "Stop promotions" } }] });
ok(store.has("camp_optout_971500000031") && J("camp_optout_971500000031").how === "button", "Stop promotions tap: opted out (store)");

// 8c. forget me
const s0 = JSON.parse(JSON.stringify(J("camp_msgs_c1") || []));
store.set("camp_consentlog_971500000001", "[]");
const fr = await C.forgetContact(env, "971500000001", "test", T);
ok(!store.has("camp_contact_971500000001") && !store.has("camp_consentlog_971500000001") && !store.has("camp_status_wamid.S1") && !(J("camp_contact_index") || []).includes("971500000001"), "forget: contact, consent and status rows gone", fr);
ok(await C.isOptedOut(env, "971500000001") && ![...store.keys()].some((k) => k.endsWith("971500000001")) && !store.get("camp_msg_wamid.S1").includes("971500000001"), "only a hashed opt-out keeps them from ever being messaged", [...store.keys()].filter((k) => k.includes("971500000001")));
const re = await C.importContacts(env, "name,phone,consent_text,consent_date,tags\nA,0500000001,\"Yes to WhatsApp\",2026-10-01,t\n", { apply: false, now: T });
ok(re.accepted === 0 && re.rejections[0].reason === "opted_out", "a forgotten number cannot be re-imported", re);
await hook({ metadata: { phone_number_id: DESK }, messages: [{ from: "971500000032", id: "x2", type: "text", text: { body: "Delete my details" } }] });
ok(!store.has("camp_contact_971500000032") && await C.isOptedOut(env, "971500000032"), "\"Delete my details\" forgets");

// PJA defaults: fixture flow -> template _v2, desk number, Stop deletes; BRN needed to go live
const FLOW = JSON.parse(fs.readFileSync(new URL("./fixtures/flow_pja_owners.json", import.meta.url)));
const { f } = C.cleanFlow(FLOW); ok(f.nodes.s1.template === "najjuko_pja_owner_intro_v2" && f.phone === "desk" && f.stop_forgets && String(f.nodes.s1.vars) === "name,why,brn", "fixture: _v2, desk, Stop deletes, reason + BRN", f.nodes.s1);
ok(!/FN Realty/i.test(JSON.stringify(FLOW)), "no FN Realty");
store.set("camp_flow_pja-owners", JSON.stringify(f));
const post = (p, key, b) => worker.fetch(new Request("https://w" + p + "?key=" + key, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }), Object.assign({}, env, { READ_KEY: "rk_TEST" }), ctx);
let res = await (await post("/momo/campaigns/api", "rk_TEST", { action: "create", id: "pja", name: "PJA", flow: "pja-owners", tags: ["pja"] })).json();
ok(res.ok && res.campaign.phone === "desk" && res.campaign.template === "najjuko_pja_owner_intro_v2" && res.campaign.stop_forgets === true, "PJA campaign: _v2 from the desk number", res);
res = await (await post("/momo/campaigns/api", "rk_TEST", { action: "live", id: "pja", confirm: "pja" })).json(); ok(res.ok && res.campaign.brn === "98949", "v767: no BRN given -> her card 98949 is used, goes live", res);
await post("/momo/campaigns/api", "rk_TEST", { action: "pause", id: "pja" }); res = await (await post("/momo/campaigns/api", "rk_TEST", { action: "update", id: "pja", brn: "TEST1" })).json(); ok(res.ok && res.campaign && res.campaign.brn === "TEST1", "a campaign may still set its own BRN", res); await post("/momo/campaigns/api", "rk_TEST", { action: "resume", id: "pja" });

// an owner's reply on the DESK number reaches campWebhook (the flow answers) and the desk handler stays silent to them
store.set("camp_quality_desk", JSON.stringify({ rating: "GREEN" })); store.delete("camp_tpl_najjuko_pja_owner_intro_v2");
await C.importContacts(env, "name,phone,consent_text,consent_date,tags,why\nOwner,0500000041,\"Yes to WhatsApp\",2026-10-01,pja,you own a unit\n", { apply: true, now: T });
calls.length = 0; await C.campStep(env, J("camp_pja"), deps(T), false); const ow = calls.find((x) => x.body.to === "971500000041"); ok(ow && ow.url.includes("/" + DESK + "/"), "opener sent from the desk", calls.map((x) => x.url));
const wid = J("camp_contact_971500000041").last_wamid;
const strangerBefore = J("desk_stranger"); calls.length = 0;
const wres = await worker.fetch(new Request("https://w/wa", { method: "POST", headers: { "X-Azimuth-Forward": env.WA_FORWARD_TOKEN, "Content-Type": "application/json" },
  body: JSON.stringify({ entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: DESK }, messages: [{ from: "971500000041", id: "own1", type: "button", button: { text: "Open to selling", payload: "camp:pja:1" }, context: { id: wid } }] } }] }] }) }), env, ctx);
ok(wres.status === 200 && J("camp_msg_" + wid).replied && J("camp_msg_" + wid).tap && (J("camp_stats_pja").branch || {})["s1.selling"] === 1, "desk reply counted and branched by the campaign", J("camp_msg_" + wid));
ok(calls.length >= 1 && calls.every((x) => x.body.to === "971500000041" && x.url.includes("/" + DESK + "/")), "the flow answered the owner from the desk; nothing to anyone else", calls.map((x) => [x.body.to, x.body.type]));
ok(!calls.some((x) => x.body.to === KEN) && (J("desk_stranger") || {}).count === ((strangerBefore || {}).count || 0) + 1, "the desk handler only logged a stranger (no desk reply)", J("desk_stranger"));

// index.js wiring: the alert path goes to Kendall from the desk number
const src = fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
ok(/function campAlertSend\(env, text\)[^\n]*WA_DESK_PHONE_ID[^\n]*WA_DESK_OWNER[^\n]*waSend\(env, owner, text, pid\)/.test(src) && /campWebhook\(env, body, \{[^\n]*alert: campAlertSend/.test(src) && /campTick\(env, \{ graph: WA_GRAPH, alert: campAlertSend \}\)/.test(src), "alerts wired to WA_DESK_OWNER from the desk");
ok(J("camp_alerts").length >= 5, "every alert also logged in camp_alerts");

console.log("test_v726_campaign_safety: " + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
