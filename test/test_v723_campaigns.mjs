// v723 - the WhatsApp campaign engine (src/campaigns.js): CSV import + consent register, consent rejection, dedupe, opt-out phrases
// (English + Arabic, text + buttons), cap / window / shared-cap enforcement, auto-stop thresholds, dry run (no Meta call), status-webhook
// accounting, click logging, the branching flow (Palm Jebel Ali owners), the one follow-up, the /cb/ brief page, the card gate and the
// go-live approval. Through the REAL worker entry point where a route is involved. FAKE keys, FAKE numbers; graph.facebook.com is MOCKED
// and any other host throws, so nothing can leave this process.
import fs from "node:fs";
const worker = (await import("../src/index.js")).default;
const C = await import("../src/campaigns.js");
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 400)); } };

const store = new Map();
const KV = { get: async (k, t) => { if (!store.has(k)) return null; const v = store.get(k); return t === "arrayBuffer" ? new TextEncoder().encode(v).buffer : v; },
  put: async (k, v) => { store.set(k, String(v)); }, delete: async (k) => { store.delete(k); },
  list: async ({ prefix } = {}) => ({ keys: [...store.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) };
const NAJ = "ins_najjuko_TESTKEY0123456789abcd", KEN = "ins_kendall_TESTKEY0123456789abcd", OTHER = "ins_someoneelse_0123456789abcdefgh", READ = "readkey_TEST_0123456789abcdef";
const DESK = "100000000000001", MAIN = "100000000000002";
const env = { MEETINGS: KV, INSIDER_KEY: [NAJ, KEN, OTHER].join(","), READ_KEY: READ, WA_DESK_PHONE_ID: DESK, WA_PHONE_ID: MAIN, WHATSAPP_TOKEN: "TEST_TOKEN",
  WA_FORWARD_TOKEN: "fwd_TEST_0123456789", WA_ALLOWED: "971500000099", WA_DESK_OWNER: "971500000098", PUBLIC_ORIGIN: "https://w" };
const ctx = { waitUntil() {}, passThroughOnException() {} };

// ---- the mock Meta ----
const calls = []; let nextErr = null, wn = 0;
globalThis.fetch = async (u, init) => {
  const s = String(u && u.url || u);
  if (!/^https:\/\/graph\.facebook\.com\//.test(s)) throw new Error("network blocked in test: " + s);
  const body = init && init.body ? JSON.parse(init.body) : null; calls.push({ url: s, body });
  if (nextErr) { const e = nextErr; nextErr = null; return new Response(JSON.stringify({ error: e }), { status: 400 }); }
  return new Response(JSON.stringify({ messages: [{ id: "wamid.T" + (++wn) }] }), { status: 200 });
};
const get = (path, key, h) => worker.fetch(new Request("https://w" + path + (key === undefined ? "" : (path.includes("?") ? "&" : "?") + "key=" + encodeURIComponent(key)), { headers: h || {} }), env, ctx);
const post = (path, key, body, ct) => worker.fetch(new Request("https://w" + path + (path.includes("?") ? "&" : "?") + "key=" + encodeURIComponent(key), { method: "POST", headers: { "Content-Type": ct || "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) }), env, ctx);
const wa = (value) => worker.fetch(new Request("https://w/wa", { method: "POST", headers: { "X-Azimuth-Forward": env.WA_FORWARD_TOKEN, "Content-Type": "application/json" },
  body: JSON.stringify({ entry: [{ changes: [{ field: "messages", value: Object.assign({ metadata: { phone_number_id: DESK } }, value) }] }] }) }), env, ctx);
// 2026-11-04 08:00 UTC = 12:00 Dubai (inside 10:00-19:00); 2026-11-04 17:00 UTC = 21:00 Dubai (outside)
const IN = Date.UTC(2026, 10, 4, 8, 0), OUT = Date.UTC(2026, 10, 4, 17, 0);

// ---- phone numbers ----
ok(C.normPhone("050 123 4567") === "+971501234567", "UAE 05 local");
ok(C.normPhone("+971 (50) 123-4567") === "+971501234567", "UAE +971 with punctuation");
ok(C.normPhone("00971501234567") === "+971501234567" && C.normPhone("971501234567") === "+971501234567" && C.normPhone("501234567") === "+971501234567", "00 / 971 / 9 digit forms");
ok(C.normPhone("+97142223333") === "" && C.normPhone("12345") === "" && C.normPhone("") === "", "landline / junk refused");
ok(C.normPhone("+447700900123") === "+447700900123", "foreign number with +");

// ---- CSV import ----
const CSV = 'name,phone,source,consent_text,consent_date,tags\n'
  + '"Owner, One",050 000 0001,Big5 QR,"Yes, I agree to WhatsApp messages from Najjuko",2026-10-20,pja;pilot\n'
  + 'Owner Two,+971500000002,form,"Yes, I agree to WhatsApp messages",21/10/2026,pja\n'
  + 'Dup Two,00971500000002,form,"Yes, I agree to WhatsApp messages",2026-10-21,pja\n'
  + 'No Consent,0500000003,cold list,,2026-10-21,pja\n'
  + 'No Date,0500000004,form,"Yes, I agree to WhatsApp messages",,pja\n'
  + 'Bad Phone,04 222 3333,form,"Yes, I agree to WhatsApp messages",2026-10-21,pja\n'
  + 'Future,0500000005,form,"Yes, I agree to WhatsApp messages",2030-01-01,pja\n'
  + 'Owner Six,0500000006,form,"Yes, I agree to WhatsApp messages",2026-10-22,pja\n'
  + 'Owner Eight,0500000008,form,"Yes, I agree to WhatsApp messages",2026-10-22,pja\n'
  + 'Other Tag,0500000007,form,"Yes, I agree to WhatsApp messages",2026-10-22,newsletter\n';
let r = await post("/momo/campaigns/import", KEN, CSV, "text/csv"), j = await r.json();
ok(r.status === 200 && j.apply === false && j.accepted === 5 && !store.has("camp_contact_971500000001"), "preview stores nothing", j);
const reasons = j.rejections.map((x) => x.reason).sort();
ok(JSON.stringify(reasons) === JSON.stringify(["bad_phone", "duplicate_in_file", "no_consent_date", "no_consent_date", "no_consent_text"]), "every rejection has its reason (no consent, no/future date, bad phone, dupe)", reasons);
r = await post("/momo/campaigns/import?apply=1", NAJ, CSV, "text/csv"); j = await r.json();
ok(j.accepted === 5 && store.has("camp_contact_971500000001") && JSON.parse(store.get("camp_contact_index")).length === 5, "apply stores 5 contacts", j);
const c1 = JSON.parse(store.get("camp_contact_971500000001"));
ok(c1.name === "Owner, One" && c1.consent.text.includes("Najjuko") && c1.consent.date === "2026-10-20" && c1.tags.join() === "pja,pilot", "contact carries consent wording, date and tags", c1);
ok(JSON.parse(store.get("camp_contact_971500000002")).consent.date === "2026-10-21", "dd/mm/yyyy read the UAE way");
ok(store.has("camp_consent_" + j.import_id) && JSON.parse(store.get("camp_consent_" + j.import_id)).rejected.length === 5, "consent register keeps accepted + rejected rows");
r = await post("/momo/campaigns/import?apply=1", KEN, CSV, "text/csv"); j = await r.json();
ok(j.updated === 5 && JSON.parse(store.get("camp_contact_index")).length === 5, "re-import de-duplicates against stored contacts", j);

// ---- opt-out phrases ----
for (const s of ["STOP", "stop.", "Unsubscribe", "not for me", "Not this time", "remove me", "إلغاء", "الغاء", "توقف", "إلغاء الاشتراك", "لا أريد"]) ok(C.isOptOutText(s), "opt-out: " + s);
for (const s of ["don't stop", "stop by the office tomorrow please", "Not now", "Book a meeting", "yes", ""]) ok(!C.isOptOutText(s), "not an opt-out: " + s);

// ---- campaigns: create, gate, go-live approval ----
const base = { action: "create", id: "big5-wave1", name: "Big 5 wave 1", template: "digitalchemy_big5_invite", vars: ["name"], tags: ["pja"], cap: 3, batch: 2, header: { type: "image", link: "https://w/img/logo.jpg" } };
r = await post("/momo/campaigns/api", KEN, Object.assign({}, base, { header: null })); j = await r.json();
ok(r.status === 400 && String(j.error).includes("header"), "image-header template needs a header", j);
r = await post("/momo/campaigns/api", KEN, Object.assign({}, base, { vars: [] })); j = await r.json();
ok(r.status === 400 && String(j.error).includes("needs 1 variable"), "variable count checked against the template", j);
r = await post("/momo/campaigns/api", NAJ, base); j = await r.json();
ok(r.status === 200 && j.campaign.status === "draft" && j.campaign.phone === "desk" && j.campaign.qr === 2 && j.campaign.lang === "en", "Najjuko creates a draft (desk number default, 2 quick replies)", j);
r = await post("/momo/campaigns/api", OTHER, { action: "dry", id: "big5-wave1" }); ok(r.status === 404, "other insider: not found", r.status);
r = await post("/momo/campaigns/api", "wrongkey", { action: "dry", id: "big5-wave1" }); ok(r.status === 404, "wrong key: not found", r.status);
r = await post("/momo/campaigns/api", NAJ, { action: "live", id: "big5-wave1", confirm: "big5-wave1" }); ok(r.status === 403, "Najjuko cannot go live", r.status);
r = await post("/momo/campaigns/api", NAJ, { action: "request_live", id: "big5-wave1" }); j = await r.json(); ok(j.ok && j.campaign.status === "draft" && j.campaign.live_requested.by === "najjuko", "she can ASK Kendall", j);
r = await post("/momo/campaigns/api", KEN, { action: "live", id: "big5-wave1" }); ok(r.status === 400, "live needs confirm=id", r.status);

// ---- the tick never runs a draft ----
calls.length = 0;
let t = await C.campTick(env, { now: IN });
ok(calls.length === 0 && t.length === 0, "draft campaign: the tick sends nothing", t);

// ---- dry run: exact payloads, no Meta call ----
r = await post("/momo/campaigns/api", NAJ, { action: "dry", id: "big5-wave1" }); j = await r.json();
const dr = await C.campStep(env, JSON.parse(store.get("camp_big5-wave1")), { now: IN }, true);
ok(calls.length === 0, "dry run never calls Meta", calls.length);
ok(dr.would.length === 3 && dr.would[0].url === "https://graph.facebook.com/v21.0/" + DESK + "/messages", "dry run: today's allowance (cap 3) from the desk id", dr);
const p0 = dr.would[0].payload;
ok(p0.type === "template" && p0.template.name === "digitalchemy_big5_invite" && p0.template.components[0].type === "header" && p0.template.components[1].parameters[0].text === "Owner,"
  && p0.template.components[2].parameters[0].payload === "camp:big5-wave1:0", "payload: header, first name, quick-reply payloads", p0);
ok(store.has("camp_dry_big5-wave1") && !store.has("camp_q_big5-wave1") && !store.has("camp_sent24"), "dry run leaves queue, counters and 24 h log untouched");

// ---- live: window, batch, cap, shared cap ----
r = await post("/momo/campaigns/api", KEN, { action: "live", id: "big5-wave1", confirm: "big5-wave1" }); j = await r.json(); ok(j.ok && j.campaign.status === "live", "Kendall approves live", j);
await C.campTick(env, { now: OUT }); ok(calls.length === 0, "outside the Dubai window: nothing", calls.length);
await C.campTick(env, { now: IN }); ok(calls.length === 2, "one tick = one batch (2)", calls.length);
await C.campTick(env, { now: IN + 60000 }); ok(calls.length === 3, "daily cap 3 reached", calls.length);
await C.campTick(env, { now: IN + 120000 }); ok(calls.length === 3, "no send over the cap", calls.length);
ok(JSON.parse(store.get("camp_stats_big5-wave1")).sent === 3 && JSON.parse(store.get("camp_sent24")).length === 3, "sent counted + shared 24 h log");
ok(calls.every((c) => c.body.to !== "971500000007"), "wrong tag never messaged");
// shared cap across both numbers: a second campaign on the main number is refused (not routed) and a desk one stops at the shared cap
await post("/momo/campaigns/api", KEN, Object.assign({}, base, { id: "wave2", cap: 50, tags: ["pja"] }));
await post("/momo/campaigns/api", KEN, { action: "live", id: "wave2", confirm: "wave2" });
await C.campTick(env, { now: IN + 3600000 });
const w2 = JSON.parse(store.get("camp_stats_wave2") || "{}");
ok(w2.sent === 1 && (w2.skipped || {}).messaged_this_week === 3 && calls[calls.length - 1].body.to === "971500000008", "one marketing message a week per person, across campaigns (only the one wave 1 never reached)", w2);
env.CAMP_SHARED_CAP = "3";
const sh = await C.campStep(env, JSON.parse(store.get("camp_wave2")), { now: IN + 3600000 }, true);
ok(sh.note === "shared 24 h cap reached" && sh.would.length === 0, "shared 24 h cap (both numbers) holds", sh);
delete env.CAMP_SHARED_CAP;
await post("/momo/campaigns/api", KEN, { action: "pause", id: "wave2" });
const mainC = Object.assign(JSON.parse(store.get("camp_big5-wave1")), { phone: "main", status: "live" });
ok((await C.campStep(env, mainC, { now: IN, fetch: () => { throw new Error("no"); } }, false)).note.includes("main number refused"), "main number refused until routed (CAMP_MAIN_PHONE)");

// ---- status webhooks ----
const sentIds = JSON.parse(store.get("camp_msgs_big5-wave1"));
r = await wa({ statuses: [{ id: sentIds[0], status: "delivered", recipient_id: "971500000001" }] }); ok(r.status === 200, "webhook 200");
await wa({ statuses: [{ id: sentIds[0], status: "read", recipient_id: "971500000001" }] });
await wa({ statuses: [{ id: sentIds[0], status: "read", recipient_id: "971500000001" }] });   // a retry
await wa({ statuses: [{ id: sentIds[1], status: "read", recipient_id: "971500000002" }] });   // read without delivered first
await wa({ statuses: [{ id: "wamid.not.ours", status: "delivered", recipient_id: "971500000099" }] });
let S = JSON.parse(store.get("camp_stats_big5-wave1"));
ok(S.delivered === 2 && S.read === 2, "delivered/read counted once each, read implies delivered", S);

// ---- replies, button taps, opt-outs through the webhook ----
calls.length = 0;
await wa({ messages: [{ from: "971500000001", id: "in1", type: "button", button: { text: "Book a meeting", payload: "camp:big5-wave1:0" }, context: { id: sentIds[0] } }] });
S = JSON.parse(store.get("camp_stats_big5-wave1")); ok(S.replies === 1 && S.taps === 1, "button tap = reply + tap", S);
await wa({ messages: [{ from: "971500000002", id: "in2", type: "text", text: { body: "توقف" } }] });
ok(store.has("camp_optout_971500000002") && calls.length === 1 && calls[0].body.text.body.includes("not get any more") && calls[0].url.includes(DESK), "Arabic opt-out stored + one-line confirmation from the same number", calls);
await wa({ messages: [{ from: "971500000002", id: "in3", type: "text", text: { body: "STOP" } }] });
ok(calls.length === 1, "second STOP: no second confirmation");
ok(JSON.parse(store.get("camp_contact_971500000002")).opted_out === true && JSON.parse(store.get("camp_stats_big5-wave1")).optouts === 1, "contact flagged + counted");
r = await post("/momo/campaigns/import?apply=1", KEN, CSV, "text/csv"); j = await r.json();
ok(j.rejections.some((x) => x.reason === "opted_out" && x.e164 === "+971500000002"), "an opted-out number can never be re-imported", j.rejections);
// the owner numbers: an ordinary "stop" in Najjuko's or the desk owner's chat is NOT an opt-out
const before = calls.length;
await wa({ messages: [{ from: "971500000099", id: "in4", type: "text", text: { body: "stop" } }] });
ok(!store.has("camp_optout_971500000099") && calls.length === before, "Najjuko typing stop in her own chat: untouched");
const o = await C.campWebhook(env, { entry: [{ changes: [{ value: { metadata: { phone_number_id: MAIN }, messages: [{ from: "971555555555", type: "text", text: { body: "STOP" } }] } }] }] }, {});
ok(o.optouts === 0 && !store.has("camp_optout_971555555555"), "a stranger not on any list: no record, no reply", o);
// a 131050 failure (blocked marketing) opts the person out and counts as a block
await wa({ statuses: [{ id: sentIds[2], status: "failed", recipient_id: "971500000006", errors: [{ code: 131050 }] }] });
S = JSON.parse(store.get("camp_stats_big5-wave1"));
ok(S.blocks === 1 && store.has("camp_optout_971500000006"), "131050 = block + opt-out", S);

// ---- the store is read before EVERY message, even for a queue built before the opt-out ----
await post("/momo/campaigns/api", KEN, Object.assign({}, base, { id: "stale", cap: 50, tags: ["pja"] }));
store.set("camp_q_stale", JSON.stringify({ list: ["971500000002", "971500000008"], pos: 0 }));
store.set("camp_contact_971500000002", JSON.stringify(Object.assign(JSON.parse(store.get("camp_contact_971500000002")), { opted_out: false, last_mkt: null })));
store.set("camp_contact_971500000008", JSON.stringify(Object.assign(JSON.parse(store.get("camp_contact_971500000008")), { last_mkt: null })));
const so = await C.campStep(env, JSON.parse(store.get("camp_stale")), { now: IN }, true);
ok(so.would.length === 1 && so.would[0].payload.to === "971500000008" && so.skipped.opted_out === 1, "opted-out number skipped from a stale queue", so);

// ---- auto-stop thresholds ----
const c0 = { thresholds: {} };
ok(C.stopReason(c0, { sent: 10, blocks: 1, err: {} }) === "", "under the minimum sample: no stop");
ok(C.stopReason(c0, { sent: 200, blocks: 1, err: {} }) === "", "0.5% exactly: not over");
ok(/block rate/.test(C.stopReason(c0, { sent: 199, blocks: 1, err: {} })), "block rate over 0.5%: stop");
ok(/opt-out/.test(C.stopReason(c0, { sent: 100, optouts: 3, err: {} })), "opt-outs over 2%: stop");
ok(/quality/.test(C.stopReason(c0, { sent: 100, quality: 11, err: {} })), "quality errors over 10%: stop");
ok(/131048/.test(C.stopReason(c0, { sent: 1, err: { 131048: 1 } })), "131048 spam limit: hard stop at once");
// a live run that hits a hard stop code
store.delete("camp_sent24");
await post("/momo/campaigns/api", KEN, Object.assign({}, base, { id: "hard", cap: 10, tags: ["pilot"] }));
await post("/momo/campaigns/api", KEN, { action: "live", id: "hard", confirm: "hard" });
store.set("camp_contact_971500000001", JSON.stringify(Object.assign(JSON.parse(store.get("camp_contact_971500000001")), { last_mkt: null })));
nextErr = { code: 131048, message: "spam rate limit" };
await post("/momo/campaigns/api", NAJ, { action: "pause", id: "big5-wave1" });
await C.campTick(env, { now: IN + 6 * 86400000 });   // v726: Mon-Fri window (was IN + 3 days, a Saturday)
ok(JSON.parse(store.get("camp_hard")).status === "stopped" && /131048/.test(JSON.parse(store.get("camp_hard")).stopped.why), "131048 from Meta stops the campaign", JSON.parse(store.get("camp_hard")));

// ---- tracked links ----
const code = await C.makeLink(env, "big5-wave1", "971500000001", "https://digitalabbot.io/big5");
ok(/^[0-9A-Za-z]{8}$/.test(code) && (await C.makeLink(env, "x", "1", "javascript:alert(1)")) === "", "link code; non-https refused");
r = await get("/c/" + code, undefined, { "User-Agent": "WhatsApp/2.23 A" }); ok(r.status === 302 && JSON.parse(store.get("camp_link_" + code)).clicks === 0, "link preview fetch is not a click");
r = await get("/c/" + code, undefined, { "User-Agent": "Mozilla/5.0 iPhone" });
ok(r.status === 302 && r.headers.get("Location") === "https://digitalabbot.io/big5", "redirects to the target", r.status);
await get("/c/" + code, undefined, { "User-Agent": "Mozilla/5.0 iPhone" });
const L = JSON.parse(store.get("camp_link_" + code)); S = JSON.parse(store.get("camp_stats_big5-wave1"));
ok(L.clicks === 2 && L.d === "971500000001" && L.cid === "big5-wave1" && S.clicks === 2 && S.uclicks === 1, "click logged against contact + campaign (2 clicks, 1 person)", [L, S.clicks, S.uclicks]);
r = await get("/c/zzzzzzzz"); ok(r.status === 404, "unknown code 404");

// ---- the branching flow (Palm Jebel Ali owners) ----
const FLOW = JSON.parse(fs.readFileSync(new URL("./fixtures/flow_pja_owners.json", import.meta.url)));
ok(C.cleanFlow(FLOW).err.length === 0, "fixture flow validates", C.cleanFlow(FLOW).err);
ok(C.cleanFlow(Object.assign({}, FLOW, { nodes: Object.assign({}, FLOW.nodes, { a1: { type: "text", text: "x", next: "nowhere" } }) })).err.some((e) => /nowhere/.test(e)), "a missing next node is refused");
ok(C.cleanFlow(Object.assign({}, FLOW, { followup: { node: "a1" } })).err.some((e) => /followup/.test(e)), "a follow-up must be a template (their window is shut)");
r = await post("/momo/campaigns/api", NAJ, { action: "flow_put", flow: FLOW }); ok((await r.json()).ok, "flow stored as data (KV)");
r = await post("/momo/campaigns/api", NAJ, { action: "simulate", flow: "pja-owners", choices: ["selling", "listed", "two"] }); j = await r.json();
ok(j.ok && j.result.some((x) => x.handover) && j.result.some((x) => x.chose === "b2.two"), "simulate walks a branch with no KV writes and no Meta call", j);
// owners imported on their own tag, Najjuko's campaign from the desk number
const OWN = 'name,phone,source,consent_text,consent_date,tags,why\nPja A,0500000011,Najjuko form,"Yes to WhatsApp from Najjuko",2026-10-01,pjaowners,you own a unit at Palm Jebel Ali\nPja B,0500000012,Najjuko form,"Yes to WhatsApp from Najjuko",2026-10-01,pjaowners,you own a unit at Palm Jebel Ali\nPja C,0500000013,Najjuko form,"Yes to WhatsApp from Najjuko",2026-10-01,pjaowners,you own a unit at Palm Jebel Ali\nPja D,0500000014,Najjuko form,"Yes to WhatsApp from Najjuko",2026-10-01,pjaowners,you own a unit at Palm Jebel Ali\nPja E,0500000015,Najjuko form,"Yes to WhatsApp from Najjuko",2026-10-01,pjaowners,you own a unit at Palm Jebel Ali\n';
await post("/momo/campaigns/import?apply=1", NAJ, OWN, "text/csv");
r = await post("/momo/campaigns/api", NAJ, { action: "create", id: "pja", name: "Palm Jebel Ali owners", flow: "pja-owners", tags: ["pjaowners"], cap: 10, batch: 5, brn: "TEST1" }); j = await r.json();
ok(j.ok && j.campaign.template === "najjuko_pja_owner_intro_v2" && j.campaign.phone === "desk" && j.campaign.qr === 5 && j.campaign.freq_days === 14, "flow campaign takes template, buttons and fortnightly cap from the flow", j);
await post("/momo/campaigns/api", KEN, { action: "live", id: "pja", confirm: "pja" });
calls.length = 0; store.delete("camp_sent24");
await C.campTick(env, { now: IN });
ok(calls.length === 5 && calls[0].body.template.components.filter((x) => x.type === "button").length === 5, "opener to 5 owners with 5 quick replies", calls.length);
const pids = JSON.parse(store.get("camp_msgs_pja"));
const tap = (from, i, ctxId) => wa({ messages: [{ from, id: "t" + Math.random(), type: "button", button: { text: FLOW.nodes.s1.buttons[i].title, payload: "camp:pja:" + i }, context: { id: ctxId } }] });
const pick = (from, rid, title) => wa({ messages: [{ from, id: "p" + Math.random(), type: "interactive", interactive: { type: rid.includes(":b1:") ? "list_reply" : "button_reply", [rid.includes(":b1:") ? "list_reply" : "button_reply"]: { id: rid, title } } }] });
// (a) handover -> thank-you text + consent question; Yes records the consent per branch
calls.length = 0; await tap("971500000011", 0, pids[0]);
ok(calls.length === 2 && calls[0].body.type === "text" && calls[0].body.text.body.startsWith("Thank you Pja") && calls[1].body.interactive.type === "button", "(a) thank-you then the updates question", calls.map((c) => c.body.type));
await pick("971500000011", "cf:pja:a2:0", "Yes please");
const ka = JSON.parse(store.get("camp_contact_971500000011"));
ok(ka.consents["market-updates"].value === true && ka.consents["market-updates"].node === "a2" && store.has("camp_consentlog_971500000011"), "(a) consent stored with its branch and wording", ka.consents);
await pick("971500000011", "cf:pja:a2:0", "Yes please");
ok(JSON.parse(store.get("camp_stats_pja")).branch["a2.yes"] === 1, "a double tap is counted once");
// (b) selling -> list -> listed -> 2 agents -> trial offer + handover for Najjuko (recorded, nobody messaged)
calls.length = 0; await tap("971500000012", 1, pids[1]);
ok(calls[0].body.interactive.type === "list", "(b) the listed / not listed list");
await pick("971500000012", "cf:pja:b1:0", "Already listed"); await pick("971500000012", "cf:pja:b2:1", "2 agents");
const ho = JSON.parse(store.get("camp_handover_index"));
ok(ho[0].d === "971500000012" && ho[0].path.join() === "s1.selling,b1.listed,b2.two" && /trial/.test(calls.map((c) => JSON.stringify(c.body)).join()), "(b) trial-listing offer, handover recorded with the whole path", ho[0]);
ok(calls.every((c) => c.body.to !== "971500000099"), "the handover never messages Najjuko");
// (c) another Palm investment -> tracked link to the /cb/ brief, then a call offer
calls.length = 0; await tap("971500000013", 2, pids[2]);
const dc = calls[0].body;   // v774 - the stored illustration as a picture, the thank-you and a short personal link /p/<code>
const pcode = (/\/p\/([a-z2-9]{8})$/.exec((dc.image && dc.image.caption) || "") || [])[1];
ok(dc.type === "image" && dc.image.link === "https://w/dp/img/palm-springs" && /^Thank you(, \w+)?\. Your Palm Springs passport is ready:/.test(dc.image.caption) && pcode && JSON.parse(store.get("dp_doc_" + pcode)).reader === "investor" && !/971500000013/.test(dc.image.caption) && calls[1].body.interactive.action.buttons[0].reply.title === "Book a call", "(c) picture + personal short link (no number in it) + call offer", calls.map((c) => c.body));
// (d) not now -> one gentle ask
calls.length = 0; await tap("971500000014", 3, pids[3]);
ok(calls.length === 1 && /every two weeks/.test(calls[0].body.interactive.body.text), "(d) one gentle updates ask");
// STOP on the opener
calls.length = 0; await tap("971500000015", 4, pids[4]);
// v726: the PJA campaign has stop_forgets (the template says "Tap Stop and I'll delete your details"): opted out, details deleted, only a hashed opt-out kept
ok(await C.isOptedOut(env, "971500000015") && !store.has("camp_optout_971500000015") && !store.has("camp_contact_971500000015") && calls.length === 1 && /details are deleted/.test(calls[0].body.text.body), "STOP button opts out (and forgets)");
S = JSON.parse(store.get("camp_stats_pja"));
ok(S.branch["s1.handover"] === 1 && S.branch["s1.selling"] === 1 && S.branch["s1.palmsprings"] === 1 && S.branch["s1.notnow"] === 1 && S.handovers === 1, "every branch choice in the log", S.branch);

// ---- the follow-up: at most one, only to non-repliers, only after the wait ----
await C.importContacts(env, 'name,phone,consent_text,consent_date,tags,why\nSilent,0500000016,"Yes to WhatsApp from Najjuko",2026-10-01,pjaowners,you own a unit at Palm Jebel Ali\n', { apply: true, now: IN });
store.set("camp_q_pja", JSON.stringify(Object.assign(JSON.parse(store.get("camp_q_pja")), { list: JSON.parse(store.get("camp_q_pja")).list.concat(["971500000016"]) })));
store.set("camp_pja", JSON.stringify(Object.assign(JSON.parse(store.get("camp_pja")), { status: "live" })));   // the audience grew: back to live
calls.length = 0; await C.campTick(env, { now: IN + 3600000 }); ok(calls.length === 1, "late addition gets the opener", calls.length);
calls.length = 0; await C.campTick(env, { now: IN + 7200000 }); ok(calls.length === 0, "no follow-up before 72 h");
calls.length = 0; await C.campTick(env, { now: IN + 6 * 86400000 });   // v726: Mon-Fri window (was IN + 4 days, a Saturday)
ok(calls.length === 1 && calls[0].body.to === "971500000016" && calls[0].body.template.name === "najjuko_market_updates_ask", "exactly one follow-up, to the one who never replied", calls.map((c) => c.body.to));
calls.length = 0; await C.campTick(env, { now: IN + 9 * 86400000 }); ok(calls.length === 0, "never a second follow-up");

// ---- the /cb/ brief page: only stated facts, gaps say "to confirm" ----
store.set("camp_brief_palm-springs", JSON.stringify({ slug: "palm-springs", project: "Palm Springs", developer: "Test Developer", price: "AED 1M to AED 2M (indicative)", payment_plan: "to confirm", handover: "", unit_types: "3-bed townhouses", highlights: ["Park"], images: [] }));
r = await get("/cb/palm-springs"); t = await r.text();
ok(r.status === 301 && /\/dp\/palm-springs$/.test(r.headers.get("Location") || ""), "v771: /cb/palm-springs now opens the district passport (301 to /dp/)", r.status);
ok(!/AED [0-9.]+M<\/b><\/div>.*Handover<\/i><b>[0-9]/.test(t), "no invented handover date");
r = await get("/cb/nope"); ok(r.status === 404, "unknown brief 404");

// ---- the card: Najjuko's and Kendall's front door, nobody else's; charts; masked numbers ----
for (const [k, want, m] of [[NAJ, true, "Najjuko"], [KEN, true, "Kendall"], [OTHER, false, "other insider"]]) { r = await get("/momo", k); t = await r.text(); ok(t.includes("id=card_campaigns") === want, "card on door: " + m, r.status); }
r = await get("/momo/campaigns?c=pja", NAJ); t = await r.text();
ok(r.status === 200 && t.includes("<h1>Campaigns</h1>") && ["Funnel", "Branch choices", "Daily sends and replies", "Opt-out and block rate", "Clicks per link", "People ("].every((x) => t.includes(x)), "dashboard has every chart card", r.status);
ok((t.match(/<svg/g) || []).length >= 6 && t.includes("0.5% stop line") && t.includes("daily cap 10") && t.includes("To Najjuko"), "inline SVG charts with the stop line and cap labelled");
ok(t.includes("+971 ••• 0011") && !t.includes("971500000011"), "numbers masked to the last 4 digits");
ok(!t.includes("Approve live") && (t.includes(">Pause<") || t.includes(">Done<")), "no approve button for her");
ok(t.includes("Consent to updates") && t.includes("Follow up"), "totals + follow-up buttons");
r = await post("/momo/campaigns/api", NAJ, { action: "followup", id: "pja", w: pids[3] }); j = await r.json();
ok(j.ok && JSON.parse(store.get("camp_handover_index"))[0].kind === "follow_up", "Follow up flags it for her; nothing sent", j);
r = await get("/momo/campaigns", OTHER); ok(r.status === 404, "dashboard hidden from other insider");
r = await get("/momo/campaigns"); ok(r.status === 404, "dashboard needs a key");
const ids = [...t.matchAll(/\sid=["]?([a-z_0-9-]+)/g)].map((x) => x[1]); ok(ids.length === new Set(ids).size, "ids unique", ids);
ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(fs.readFileSync(new URL("../src/campaigns.js", import.meta.url), "utf8")), "no emoji in the module");
ok(!/picjob_|gmp_|gcal_state/.test(fs.readFileSync(new URL("../src/campaigns.js", import.meta.url), "utf8").replace(/Never touches picjob_\*, gmp_\*, gcal_state\./, "")), "never touches picjob_/gmp_/gcal_state");
ok([...store.keys()].every((k) => !/^(picjob_|gmp_|gcal_state)/.test(k)), "no protected KV keys written");

// ---- CAMPAIGNS_OFF stops everything ----
env.CAMPAIGNS_OFF = "1"; calls.length = 0; await C.campTick(env, { now: IN + 20 * 86400000 }); ok(calls.length === 0, "CAMPAIGNS_OFF=1: nothing"); delete env.CAMPAIGNS_OFF;

console.log("test_v723_campaigns: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
