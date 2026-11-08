// v821 - "owners message first": the wa.me / QR opt-in route on the desk number. FAKE numbers; graph.facebook.com is MOCKED.
import fs from "node:fs";
const worker = (await import("../src/index.js")).default;
const C = await import("../src/campaigns.js");
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 600)); } };
const store = new Map();
const KV = { get: async (k) => (store.has(k) ? store.get(k) : null), put: async (k, v) => { store.set(k, typeof v === "string" ? v : String(v)); }, delete: async (k) => { store.delete(k); },
  list: async ({ prefix } = {}) => ({ keys: [...store.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) };
const NAJ = "971500000099", KEN = "971500000098", TEAM = "971500000097", MAIN = "100000000000002", DESK = "100000000000001";
const env = { MEETINGS: KV, WA_ALLOWED: NAJ, WA_DESK_OWNER: KEN, WA_DESK_PHONE_ID: DESK, WA_PHONE_ID: MAIN, WHATSAPP_TOKEN: "TEST_TOKEN", WA_FORWARD_TOKEN: "fwd_TEST_0123456789", PUBLIC_ORIGIN: "https://w", CAMP_OPTIN_EXCLUDE: TEAM, AI: { run: async () => ({ response: "{}" }) } };
const ctx = { waitUntil() {}, passThroughOnException() {} };
const calls = []; let n = 0;
globalThis.fetch = async (u, init) => {
  const s = String(u && u.url || u);
  if (!/^https:\/\/graph\.facebook\.com\//.test(s)) throw new Error("network blocked in test: " + s);
  calls.push({ url: s, body: init && init.body ? JSON.parse(init.body) : null });
  return new Response(JSON.stringify({ messages: [{ id: "wamid.O" + (++n) }] }), { status: 200 });
};
const J = (k) => JSON.parse(store.get(k) || "null");
const T = Date.UTC(2026, 10, 8, 20, 0);   // Sunday 9 Nov 00:00 Dubai: OUTSIDE the marketing window - opt-in replies do not care
const FLOW = JSON.parse(fs.readFileSync(new URL("./fixtures/flow_pja_owners.json", import.meta.url)));
const { f } = C.cleanFlow(FLOW); store.set("camp_flow_pja-owners", JSON.stringify(f));
store.set("img_tplhdr_naj_pja_intro", "JPEGBYTES");
let mid = 0;
const ev = (from, text, pid, name) => ({ entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: pid || DESK }, contacts: [{ profile: { name: name || "Sara Owner" }, wa_id: from }], messages: [{ from, id: "in" + (++mid), type: "text", text: { body: text } }] } }] }] });
const hook = (b) => C.campWebhook(env, b, { now: T });

// matching
ok(C.optInMatch("Hi Najjuko, I own on Palm Jebel Ali Frond B") && C.optInMatch("hi, palm jebel ali please") && C.optInMatch("frond c owner") && C.optInMatch("مرحبا نجوكو، أملك في نخلة جبل علي"), "keywords en + ar, any case");
ok(!C.optInMatch("hello") && !C.optInMatch("Palm Jumeirah villa") && !C.optInMatch("status"), "no keyword, no match");
ok(C.optInFrond("I own on Palm Jebel Ali Frond B") === "b" && C.optInFrond("frond c") === "c" && C.optInFrond("Palm Jebel Ali") === "" && C.optInFrond("Fronds") === "", "frond letter");

// 1. a new owner scans the QR
calls.length = 0;
let o = await hook(ev("971500000041", "Hi Najjuko, I own on Palm Jebel Ali Frond B"));
ok(o.consumed && o.optin && o.optin.fresh && o.optin.frond === "b", "consumed as an opt-in", o);
ok(calls.length === 2 && calls.every((c) => c.url === "https://graph.facebook.com/v21.0/" + DESK + "/messages"), "two session messages from the DESK on /messages (no template, no marketing endpoint)", calls.map((c) => c.url));
ok(calls[0].body.type === "image" && calls[0].body.image.link === "https://w/img/tplhdr_naj_pja_intro", "1st: Najjuko's header picture", calls[0].body);
const it = calls[1].body; ok(it.type === "interactive" && it.interactive.type === "list" && !calls.some((c) => c.body.type === "template"), "2nd: the question as an interactive list (5 options), never a template", it);
ok(/Hi Sara, Najjuko here/.test(it.interactive.body.text) && /you messaged me about Palm Jebel Ali/.test(it.interactive.body.text) && /BRN 98949/.test(it.interactive.body.text) && !/\{\{/.test(it.interactive.body.text), "s1 wording with name, reason, BRN", it.interactive.body.text);
const rows = it.interactive.action.sections[0].rows; ok(rows.length === 5 && rows[1].id === "cf:pja-optin:s1:1" && rows.every((r) => r.title.length <= 24), "rows carry cf:pja-optin:s1:<i>", rows);
const k = J("camp_contact_971500000041");
ok(k && k.source === "wa.me opt-in" && k.consent.date === "2026-11-09" && k.consent.text.includes("\"Hi Najjuko, I own on Palm Jebel Ali Frond B\"") && k.name === "Sara Owner", "contact created with consent quoting their message + Dubai date", k);
ok(String(k.tags) === "pja-optin,pja-frond-b" && J("camp_contact_index").includes("971500000041"), "tags + index", k.tags);
const c = J("camp_pja-optin"); ok(c && c.status === "optin" && c.flow === "pja-owners" && J("camp_index").includes("pja-optin"), "pseudo-campaign pja-optin on the card", c);
const S = J("camp_stats_pja-optin"); ok(S.sent === 2 && S.optins === 1 && S.fronds.b === 1, "counted", S);
ok(J("camp_msgs_pja-optin").length === 2 && !store.has("camp_sent24"), "messages logged; not in the marketing 24 h cap");

// tick never sends for it
calls.length = 0; await C.campTick(env, { now: T }); ok(calls.length === 0, "the minute tick sends nothing for pja-optin");

// 2. the owner taps an option: the existing flow continues from the desk
calls.length = 0;
const lw = k.last_wamid;
const tap = { entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: DESK }, messages: [{ from: "971500000041", id: "tap1", type: "interactive", context: { id: lw }, interactive: { type: "list_reply", list_reply: { id: "cf:pja-optin:s1:1", title: "Open to selling" } } }] } }] }] };
o = await hook(tap);
ok(o.flow && o.flow[0].choice === "s1.selling" && calls.length >= 1 && calls.every((x) => x.body.to === "971500000041" && x.url.includes("/" + DESK + "/")), "flow continues: s1.selling -> b1 from the desk", [o.flow, calls.map((x) => x.body.type)]);
ok((J("camp_stats_pja-optin").branch || {})["s1.selling"] === 1 && J("camp_msg_" + lw).replied, "branch + reply counted under pja-optin");

// 3. a second keyword message while in the flow: not re-started
calls.length = 0; o = await hook(ev("971500000041", "Palm Jebel Ali")); ok(!o.optin && calls.length === 0, "already in a flow: no second intro", o);

// 4. existing contact from an import gets tags merged, consent history kept
await C.importContacts(env, "name,phone,consent_text,consent_date,tags\nOld Owner,0500000042,\"Yes to WhatsApp\",2026-10-01,pja\n", { apply: true, now: T });
calls.length = 0; o = await hook(ev("971500000042", "Hi Najjuko, I own on Palm Jebel Ali Frond C"));
const k2 = J("camp_contact_971500000042"); ok(o.optin && !o.optin.fresh && String(k2.tags) === "pja,pja-optin,pja-frond-c" && k2.consent_history.length === 1 && k2.name === "Old Owner" && k2.source === "csv", "existing contact: tags merged, old consent kept in history", k2);

// 5. Arabic
calls.length = 0; o = await hook(ev("971500000043", "مرحبا نجوكو، أملك في نخلة جبل علي")); ok(o.optin && calls.length === 2 && String(J("camp_contact_971500000043").tags) === "pja-optin", "Arabic text opts in", o);

// 6. never interfere
for (const [who, from, pid] of [["Najjuko", NAJ], ["Kendall", KEN], ["team", TEAM], ["main number", "971500000044", MAIN]]) {
  calls.length = 0; o = await hook(ev(from, "Palm Jebel Ali Frond B", pid)); ok(!o.optin && !o.consumed && calls.length === 0 && !store.has("camp_contact_" + from), who + ": untouched", o);
}
calls.length = 0; o = await hook(ev("971500000045", "hello, how are you")); ok(!o.consumed && calls.length === 0 && !store.has("camp_contact_971500000045"), "no keyword: untouched");
const img = { entry: [{ changes: [{ value: { metadata: { phone_number_id: DESK }, messages: [{ from: "971500000046", id: "im1", type: "image", image: { id: "1", caption: "Palm Jebel Ali" } }] } }] }] };
calls.length = 0; o = await hook(img); ok(!o.consumed && calls.length === 0, "non-text: untouched");

// 7. opted out gets nothing
await C.optOut(env, "971500000047", "text", {}, T);
calls.length = 0; o = await hook(ev("971500000047", "Palm Jebel Ali Frond B")); ok(o.consumed && o.optin.opted_out && calls.length === 0 && !store.has("camp_contact_971500000047"), "opted out: nothing sent, nothing stored", o);
// opt-out after opting in works through the existing path
calls.length = 0; o = await hook(ev("971500000043", "STOP")); ok(o.optouts === 1 && !store.has("camp_contact_971500000043"), "STOP after opt-in: opted out (and forgotten, stop_forgets)", o);

// 8. webhook retry of the same message id: once only
const e1 = ev("971500000048", "Palm Jebel Ali"); calls.length = 0; await hook(e1); await hook(e1); ok(calls.length === 2, "retry of the same message id sends once", calls.length);

// 9. switch off
env.CAMP_OPTIN = "off"; calls.length = 0; o = await hook(ev("971500000049", "Palm Jebel Ali")); ok(!o.consumed && calls.length === 0, "CAMP_OPTIN=off: untouched"); delete env.CAMP_OPTIN;

// 10. through the real /wa route (forward header): consumed, nothing to anyone else
calls.length = 0;
const r = await worker.fetch(new Request("https://w/wa", { method: "POST", headers: { "X-Azimuth-Forward": env.WA_FORWARD_TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(ev("971500000050", "Hi Najjuko, I own on Palm Jebel Ali Frond B")) }), env, ctx);
ok(r.status === 200 && calls.length === 2 && calls.every((x) => x.body.to === "971500000050"), "/wa: the opt-in is answered, nothing else sent", calls.map((x) => [x.body.to, x.body.type]));

// 11. no header picture stored: the question still goes
store.delete("img_tplhdr_naj_pja_intro"); calls.length = 0; await hook(ev("971500000051", "Palm Jebel Ali")); ok(calls.length === 1 && calls[0].body.type === "interactive", "no picture in KV: text + options only");

// 12. v819 follow-up groups: pja-optin shows, opt-in owners are "started" (warm), opted-out only counted
const FU = await import("../src/camp_followup.js");
const G = await FU.followupGroups(env, J("camp_pja-optin"), T);
const allD = Object.values(G.groups).flat().map((r) => r.d);
ok(G.groups.started.some((r) => r.d === "971500000041") && G.groups.started.some((r) => r.d === "971500000042") && !allD.includes("971500000043") && G.counts.optout >= 1, "v819 groups: opt-ins are started, the STOP is a count only", G.counts);
ok(FU.campTopic(J("camp_pja-optin")) === "Palm Jebel Ali", "suggested-message topic reads Palm Jebel Ali", FU.campTopic(J("camp_pja-optin")));

console.log("test_v821_optin: " + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
