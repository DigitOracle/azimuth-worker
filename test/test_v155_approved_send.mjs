// v155 - approved sends, offline (18 Sep 2026). A request never reaches her by itself: the owner sees the exact text,
// taps Send, and her own instance delivers it. Two instances with separate KV, joined by a stubbed service binding.
import worker from "../src/index.js";

const OWNER = "971562276093", HER = "971565484397";
const mkKV = () => { const m = new Map(); return { m,
  async get(k) { return m.has(k) ? m.get(k) : null; }, async put(k, v) { m.set(k, v); }, async delete(k) { m.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...m.keys()].filter(k => k.startsWith(p)).map(name => ({ name })) }; } }; };
const sent = []; let waStatus = 200;
globalThis.fetch = async (url, init) => {
  if (String(url).includes("graph.facebook.com")) {
    sent.push(JSON.parse(init.body));
    return waStatus === 200 ? new Response(JSON.stringify({ messages: [{ id: "wamid.o" + sent.length }] }), { status: 200 }) : new Response('{"error":{"code":131047}}', { status: waStatus });
  }
  return new Response("{}", { status: 200 });
};
const ctx = { waitUntil() {} };
const her = { MEETINGS: mkKV(), READ_KEY: "RK", WA_FORWARD_TOKEN: "FWD", WHATSAPP_TOKEN: "t", WA_PHONE_ID: "p", WA_ALLOWED: HER, MAILBOXES: "" };
const binding = { calls: 0, async fetch(req) { this.calls++; return worker.fetch(req, her, ctx); } };
const owner = { MEETINGS: mkKV(), READ_KEY: "RK", WA_FORWARD_TOKEN: "FWD", WHATSAPP_TOKEN: "t", WA_PHONE_ID: "p", WA_ALLOWED: OWNER, MAILBOXES: "",
  OWNER_TEMPLATE: "azimuth_daily", OWNER_TEMPLATE_LANG: "en_US", TELEGRAM: "off", APPROVED_SEND: "najjuko:" + HER,
  ["WA_ROUTE_" + HER]: "AZIMUTH_2", AZIMUTH_2: binding };

const req = (e, body) => worker.fetch(new Request("https://x/send_request", { method: "POST", headers: { "Content-Type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) }), e, ctx);
let mid = 0;
const post = (message, e) => worker.fetch(new Request("https://x/wa", { method: "POST", headers: { "X-Azimuth-Forward": "FWD", "Content-Type": "application/json" },
  body: JSON.stringify({ entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: "p" }, messages: [Object.assign({ from: OWNER, id: "wamid.in" + (++mid) }, message)] } }] }] }) }), e || owner, ctx);
const tap = (id) => post({ type: "interactive", interactive: { type: "button_reply", button_reply: { id, title: id } } });
const say = (body) => post({ type: "text", text: { body } });
const toHer = () => sent.filter(m => m.to === HER);
const openWindow = () => owner.MEETINGS.put("wa_owner_last_in", new Date().toISOString());
const clearPending = () => { for (const k of [...owner.MEETINGS.m.keys()]) if (k.startsWith("sendreq_p_") || k.startsWith("sendreq_day_")) owner.MEETINGS.m.delete(k); };

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };
const MSG = "Hi Najjuko, here are the two documents.\n\n1. NDA: https://example/a\n2. Agreement: https://example/b";

// guards
let r = await req(her, { to: "najjuko", text: MSG });
ok(r.status === 403, "her instance cannot take send requests");
r = await req(Object.assign({}, owner, { APPROVED_SEND: undefined }), { to: "najjuko", text: MSG });
ok(r.status === 403, "owner instance with APPROVED_SEND unset: off");
r = await req(owner, { to: "someone", text: MSG });
ok(r.status === 400, "unknown recipient: 400");
r = await req(owner, { to: "kendall", text: MSG });
ok(r.status === 400, "a raw number that is not allow-listed cannot be named");
r = await req(owner, { to: "najjuko", text: "" });
ok(r.status === 400, "empty text: 400");
r = await req(owner, { to: "najjuko", text: "x".repeat(1501) });
ok(r.status === 400, "over 1500 chars: 400");
ok(sent.length === 0, "nothing sent by any rejected request");

// window open: the owner gets the exact text, then Send / Discard
await openWindow();
r = await req(owner, { to: "NAJJUKO", text: MSG });
const j = await r.json();
ok(r.status === 200 && j.ok && /^[A-Z0-9]{6}$/.test(j.id) && j.owner_notified === true, "request accepted, owner notified, ref " + j.id);
ok(toHer().length === 0, "requesting sends NOTHING to her");
const shown = sent.filter(m => m.to === OWNER);
ok(shown.length === 2 && shown[0].text.body.endsWith(MSG), "owner sees the full exact text first");
const btns = shown[1].interactive && shown[1].interactive.action.buttons.map(b => b.reply.id);
ok(btns && btns[0] === "sr:ok:" + j.id && btns[1] === "sr:no:" + j.id, "then Send / Discard buttons for that ref");

// someone other than the owner tapping is dropped by the sender check
sent.length = 0;
await post({ type: "interactive", interactive: { type: "button_reply", button_reply: { id: "sr:ok:" + j.id } } }, Object.assign({}, owner, { WA_ALLOWED: "971500000000" }));
ok(toHer().length === 0 && (await owner.MEETINGS.get("sendreq_p_" + j.id)), "a tap from another number does nothing; the request still waits");

// Send
sent.length = 0;
await tap("sr:ok:" + j.id);
ok(binding.calls === 1, "delivered through her instance (service binding)");
ok(toHer().length === 1 && toHer()[0].text.body === MSG, "she receives exactly the approved text, once");
ok(sent.some(m => m.to === OWNER && /Sent to Najjuko/.test(m.text && m.text.body)), "owner told it was sent");
ok(!(await owner.MEETINGS.get("sendreq_p_" + j.id)), "the request is gone after sending");

// a second tap cannot send twice
sent.length = 0;
await tap("sr:ok:" + j.id);
ok(toHer().length === 0 && sent.some(m => m.to === OWNER && /already handled/.test(m.text.body)), "double tap: nothing sent again");

// Discard
sent.length = 0;
const j2 = await (await req(owner, { to: "najjuko", text: "second" })).json();
await tap("sr:no:" + j2.id);
ok(toHer().length === 0 && sent.some(m => m.to === OWNER && /Discarded/.test(m.text && m.text.body)), "Discard: nothing to her");

// window closed: template notice only, then "show REF" opens the text and buttons
clearPending(); owner.MEETINGS.m.delete("wa_owner_last_in"); sent.length = 0;
const j3 = await (await req(owner, { to: "najjuko", text: MSG })).json();
ok(sent.length === 1 && sent[0].type === "template" && sent[0].to === OWNER, "window closed: one template notice to the owner");
ok(!JSON.stringify(sent[0]).includes("https://example/a"), "the template does not carry the message body");
sent.length = 0;
await say("show " + j3.id.toLowerCase());
ok(sent.length === 2 && sent[0].text.body.endsWith(MSG) && sent[1].type === "interactive", "\"show <ref>\" shows the text and the buttons");

// her 24-hour window closed: WhatsApp refuses, owner is told plainly
sent.length = 0; waStatus = 400;
await tap("sr:ok:" + j3.id);
waStatus = 200;
const warn = sent.filter(m => m.to === OWNER).pop();
ok(warn && /Not sent to Najjuko/.test(warn.text.body) && /24 hours/.test(warn.text.body), "rejected by WhatsApp: owner told it was NOT sent and why");
const log = JSON.parse(await owner.MEETINGS.get("sendreq_log"));
ok(log[0].state === "failed" && log.some(x => x.state === "sent") && log.some(x => x.state === "discarded"), "log records sent, discarded and failed");

// limits
clearPending();
for (let i = 0; i < 3; i++) await req(owner, { to: "najjuko", text: "p" + i });
r = await req(owner, { to: "najjuko", text: "p4" });
ok(r.status === 429, "more than 3 waiting: 429");
clearPending(); await owner.MEETINGS.put("sendreq_day_" + new Date().toISOString().slice(0, 10), "10");
r = await req(owner, { to: "najjuko", text: "p5" });
ok(r.status === 429, "more than 10 a day: 429");

// /approved_send on her instance is locked down
const aps = (e, hdr, body) => worker.fetch(new Request("https://x/approved_send", { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, hdr), body: JSON.stringify(body) }), e, ctx);
sent.length = 0;
ok((await aps(her, {}, { to: HER, text: "x" })).status === 401, "/approved_send without the forward token: 401");
ok((await aps(her, { "X-Azimuth-Forward": "BAD" }, { to: HER, text: "x" })).status === 401, "wrong forward token: 401");
ok((await aps(owner, { "X-Azimuth-Forward": "FWD" }, { to: HER, text: "x" })).status === 403, "owner instance refuses /approved_send");
ok((await aps(her, { "X-Azimuth-Forward": "FWD" }, { to: "971500000000", text: "x" })).status === 403, "her instance only ever sends to her own number");
ok(sent.length === 0, "none of those sent anything");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
