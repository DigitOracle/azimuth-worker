// v824 - START re-opt-in on the desk number. FAKE numbers; graph.facebook.com is MOCKED.
const C = await import("../src/campaigns.js");
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 600)); } };
const store = new Map();
const KV = { get: async (k) => (store.has(k) ? store.get(k) : null), put: async (k, v) => { store.set(k, typeof v === "string" ? v : String(v)); }, delete: async (k) => { store.delete(k); },
  list: async ({ prefix } = {}) => ({ keys: [...store.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) };
const NAJ = "971500000099", KEN = "971500000098", MAIN = "100000000000002", DESK = "100000000000001";
const env = { MEETINGS: KV, WA_ALLOWED: NAJ, WA_DESK_OWNER: KEN, WA_DESK_PHONE_ID: DESK, WA_PHONE_ID: MAIN, WHATSAPP_TOKEN: "TEST_TOKEN", PUBLIC_ORIGIN: "https://w" };
const calls = []; let n = 0;
globalThis.fetch = async (u, init) => {
  const s = String(u && u.url || u);
  if (!/^https:\/\/graph\.facebook\.com\//.test(s)) throw new Error("network blocked in test: " + s);
  calls.push({ url: s, body: init && init.body ? JSON.parse(init.body) : null });
  return new Response(JSON.stringify({ messages: [{ id: "wamid.R" + (++n) }] }), { status: 200 });
};
const J = (k) => JSON.parse(store.get(k) || "null");
const T = Date.UTC(2026, 10, 8, 20, 0);
let mid = 0;
const ev = (from, text, pid) => ({ entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: pid || DESK }, contacts: [{ profile: { name: "Omar Owner" }, wa_id: from }], messages: [{ from, id: "rin" + (++mid), type: "text", text: { body: text } }] } }] }] });
const hook = (b) => C.campWebhook(env, b, { now: T });

ok(C.isReOptInText("START") && C.isReOptInText(" start ") && C.isReOptInText("Start!") && C.isReOptInText("ابدأ"), "START / ابدأ match");
ok(!C.isReOptInText("start again please") && !C.isReOptInText("restart") && !C.isReOptInText("stop") && !C.isReOptInText(""), "only the exact word");

// an opted-out contact
const A = "971500000061";
store.set("camp_contact_" + A, JSON.stringify({ e164: "+" + A, name: "Omar", tags: ["pja-optin"], consent: { text: "old", date: "2026-11-01" } }));
store.set("camp_contact_index", JSON.stringify([A]));
await C.optOut(env, A, "text", { text: "STOP" }, T - 86400000);
ok(await C.isOptedOut(env, A) && J("camp_optout_index").includes(A) && J("camp_contact_" + A).opted_out, "set up: opted out");

// any other message from them: nothing sent
calls.length = 0; await hook(ev(A, "hello?")); await hook(ev(A, "Palm Jebel Ali Frond B"));
ok(calls.length === 0 && await C.isOptedOut(env, A), "opted out: other texts send nothing and keep the opt-out", calls);

// START on the MAIN number: not handled
calls.length = 0; await hook(ev(A, "START", MAIN)); ok(calls.length === 0 && await C.isOptedOut(env, A), "START on another number does nothing");

// START on the desk
calls.length = 0; let o = await hook(ev(A, "START"));
ok(o.consumed && o.reoptin && o.reoptin.sent, "consumed as re-opt-in", o);
ok(calls.length === 1 && calls[0].url === "https://graph.facebook.com/v21.0/" + DESK + "/messages" && calls[0].body.type === "text" && calls[0].body.to === A, "exactly one text from the desk", calls);
ok(calls[0].body.text.body === "Welcome back. You'll receive Palm Jebel Ali updates from Najjuko again. Reply STOP any time.", "confirmation wording", calls[0].body);
ok(!(await C.isOptedOut(env, A)) && !store.has("camp_optout_" + A) && !J("camp_optout_index").includes(A), "removed from opt-out list and index");
const k = J("camp_contact_" + A);
ok(!k.opted_out && k.consent.date === "2026-11-09" && /re-joined by sending START/.test(k.consent.text) && k.consent.text.includes("\"START\"") && k.consent_history.some((c) => c.text === "old"), "new consent with date + their message; old kept in history", k);
ok(J("camp_consentlog_" + A).some((c) => c.topic === "reoptin") && J("camp_reoptin_log")[0].d4 === "0061", "consent log + re-opt-in log");

// a retry of the same message id: no second send; a second START when no longer opted out: nothing
calls.length = 0; const e2 = ev(A, "START"); await hook(e2); ok(calls.length === 0, "not opted out any more: START sends nothing", calls);

// STOP again works as before
calls.length = 0; await hook(ev(A, "STOP")); ok(await C.isOptedOut(env, A), "STOP opts out again");

// Arabic, a forgotten (hashed) number
const B = "971500000062";
await C.forgetContact(env, B, "text", T);
ok(await C.isOptedOut(env, B) && !store.has("camp_contact_" + B), "set up: forgotten (hash only)");
calls.length = 0; o = await hook(ev(B, "ابدأ"));
ok(o.consumed && o.reoptin.forgotten && calls.length === 1 && !(await C.isOptedOut(env, B)), "ابدأ re-joins a forgotten number, one message", [o, calls.length]);
ok(J("camp_contact_" + B) && J("camp_contact_" + B).source === "START re-opt-in" && J("camp_contact_index").includes(B), "new contact row for a forgotten number");

// someone never opted out sending START: untouched
const Cn = "971500000063"; calls.length = 0; o = await hook(ev(Cn, "START"));
ok(!o.consumed && calls.length === 0 && !store.has("camp_contact_" + Cn), "not opted out: START is not consumed and sends nothing", o);

// switch off
const A2 = "971500000064"; await C.optOut(env, A2, "text", {}, T); env.CAMP_REOPTIN = "off"; calls.length = 0; await hook(ev(A2, "START"));
ok(calls.length === 0 && await C.isOptedOut(env, A2), "CAMP_REOPTIN=off: nothing"); delete env.CAMP_REOPTIN;

// replay of the same id while still opted out
const A3 = "971500000065"; await C.optOut(env, A3, "text", {}, T); const e3 = ev(A3, "START"); calls.length = 0; await hook(e3);
await C.optOut(env, A3, "text", {}, T); await hook(e3); ok(calls.length === 1, "same message id replayed sends once", calls.length);

console.log(`v824 re-opt-in: ${pass} passed, ${fail} failed`); if (fail) process.exit(1);
