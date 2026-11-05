// v783: Ask report -> WhatsApp. Signature, timestamp, idempotency, consent, opt-out, dry run, template pending, status callbacks signed.
import { askRoute, askWebhook, askTick, askSign, askTemplatePayload } from "../src/ask_report.js";
let fail = 0, pass = 0; const ok = (c, m, x) => { if (c) { pass++; console.log("ok", m); } else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x)); } };
const SECRET = "test_secret_0123456789abcdef";
const kv = {}; const env = { ASK_WEBHOOK_SECRET: SECRET, WA_DESK_PHONE_ID: "1370146096179819", MEETINGS: {
  get: async (k) => kv[k] ?? null, put: async (k, v) => { kv[k] = v; }, delete: async (k) => { delete kv[k]; } } };
const sent = []; let approved = "APPROVED", fallback = "APPROVED", opted = new Set();
const deps = { graph: "https://g", tplStatus: async (n) => ({ status: n === "digitalchemy_meeting_followup" ? fallback : approved }), isOptedOut: async (e, d) => opted.has(d),
  post: async (e, pl, pid) => { sent.push({ pl, pid }); return { ok: true, status: 200, id: "wamid.TEST" + sent.length }; } };
const body = (o) => Object.assign({ report_id: "rpt_1", question_id: "q1", recipient: { name: "Ali", whatsapp: "+971501234567", consent_whatsapp: true },
  question: "Palm Jebel Ali?", report: { title: "Palm Jebel Ali: buyer outlook", pages: 4, pdf_url: "https://digitalabbot.io/ask/files/rpt_1.pdf?token=x", pdf_filename: "Palm Jebel Ali - buyer outlook - prepared for Ali.pdf", portal_url: "https://digitalabbot.io/ask/r/rpt_1" },
  callback_url: "https://digitalabbot.io/api/ask/whatsapp-status" }, o || {});
const call = async (b, o) => { o = o || {}; const raw = typeof b === "string" ? b : JSON.stringify(b); const ts = o.ts || Math.floor(Date.now() / 1000);
  const sig = o.sig || await askSign(o.secret || SECRET, ts, raw);
  const req = new Request("https://x/ask/report-ready", { method: o.method || "POST", headers: { "Content-Type": "application/json", "X-DA-Timestamp": String(ts), "X-DA-Signature": sig, "Idempotency-Key": o.idem || (b.report_id || "") }, body: o.method === "GET" ? undefined : raw });
  const r = await askRoute(req, env, new URL(req.url), deps); return { s: r.status, j: await r.json() }; };

let r = await call(body({ test: true }));
ok(r.s === 200 && r.j.test && r.j.would_send.via === "template" && sent.length === 0, "dry run: 200, nothing sent", r);
const p = r.j.would_send.payload;
ok(p.type === "template" && p.template.name === "ask_report_ready" && p.template.components[0].parameters[0].document.filename.endsWith(".pdf") && p.template.components[2].parameters[0].text === "rpt_1" && p.template.components[3].sub_type === "quick_reply" && p.template.components[3].parameters[0].payload === "ask_ack:rpt_1" && p.to === "971501234567", "dry run payload: document header, url suffix, Got it reply, digits", p);
r = await call(body(), { sig: "sha256=deadbeef" }); ok(r.s === 401, "bad signature 401", r);
r = await call(body(), { secret: "wrong" }); ok(r.s === 401, "wrong secret 401", r);
r = await call(body(), { ts: Math.floor(Date.now() / 1000) - 600 }); ok(r.s === 401, "old timestamp 401", r);
r = await call(body({ recipient: { name: "Ali", whatsapp: "+971501234567", consent_whatsapp: false } })); ok(r.s === 400 && r.j.error === "consent_required", "no consent 400", r);
r = await call(body({ report: Object.assign(body().report, { portal_url: "https://elsewhere.com/x" }) })); ok(r.s === 400, "portal url must use the base", r);
r = await call(body(), { idem: "other" }); ok(r.s === 400, "Idempotency-Key must equal report_id", r);
opted.add("971501234567"); r = await call(body()); ok(r.s === 400 && r.j.error === "opted_out" && sent.length === 0, "opted out 400, nothing sent", r); opted.clear();
r = await call(body()); ok(r.s === 200 && r.j.message_id === "wamid.TEST1" && sent[0].pid === "1370146096179819", "real send from the desk number", r);
r = await call(body()); ok(r.s === 409 && sent.length === 1, "same report twice 409, not resent", r);
r = await call(body({ resend: true })); ok(r.s === 200 && sent.length === 2, "resend: true sends again", r);
// not approved, no 24 h window -> approved fallback template; fallback not approved either -> 503 with reasons; with window -> free document
approved = "PENDING"; delete kv["ask_tpl_status"];
r = await call(body({ report_id: "rpt_2" })); ok(r.s === 200 && r.j.via === "fallback_template" && sent[sent.length - 1].pl.template.name === "digitalchemy_meeting_followup" && /Ask portal: https:\/\/digitalabbot.io\/ask\/r\/rpt_1/.test(JSON.stringify(sent[sent.length - 1].pl)), "not approved, outside 24 h: fallback template with the link", r);
fallback = "PENDING"; delete kv["ask_tpl_status_digitalchemy_meeting_followup"];
r = await call(body({ report_id: "rpt_2b" })); ok(r.s === 503 && r.j.error === "template_pending" && r.j.pending.length === 3, "nothing possible: 503 with pending reasons", r);
await askWebhook(env, { entry: [{ changes: [{ value: { messages: [{ from: "971501234567", text: { body: "hello" } }] } }] }] }, {});
r = await call(body({ report_id: "rpt_3" })); ok(r.s === 200 && r.j.via === "freeform" && sent[sent.length - 1].pl.type === "document", "template pending, inside 24 h: free document", r);
// statuses -> callback queue -> signed callback
await askWebhook(env, { entry: [{ changes: [{ value: { statuses: [{ id: "wamid.TEST1", status: "delivered", timestamp: "1793860000" }] } }] }] }, {});
const calls = []; await askTick(env, { fetch: async (u, o) => { calls.push({ u, o }); return new Response("{}", { status: 200 }); } });
const del = calls.find((c) => JSON.parse(c.o.body).status === "delivered");
ok(del && del.u === "https://digitalabbot.io/api/ask/whatsapp-status" && del.o.headers["X-DA-Signature"] === await askSign(SECRET, del.o.headers["X-DA-Timestamp"], del.o.body), "status callback delivered, signed", calls.map((c) => c.o.body));
ok(JSON.parse(kv["ask_rr_rpt_1"]).status === "delivered" && JSON.parse(del.o.body).via === "template", "record shows delivered; callback carries via");
// "Got it" quick reply: logged, opens the window, consumed (never reaches the campaign flows), callback acknowledged
const ak = await askWebhook(env, { entry: [{ changes: [{ value: { messages: [{ from: "971501234567", type: "button", button: { text: "Got it", payload: "ask_ack:rpt_1" } }] } }] }] }, {});
ok(ak.consumed && ak.ack === 1 && JSON.parse(kv["ask_rr_rpt_1"]).acknowledged && kv["ask_win_971501234567"], "Got it: logged, window open, consumed", ak);
const calls2 = []; await askTick(env, { fetch: async (u, o) => { calls2.push(JSON.parse(o.body)); return new Response("{}", { status: 200 }); } });
ok(calls2.some((c) => c.status === "acknowledged" && c.acknowledged), "acknowledged callback sent", calls2);
// failed callback is retried later
kv["ask_cb_q"] = JSON.stringify([{ report_id: "rpt_1", status: "read", at: "x", tries: 0, next: 0, first: Date.now() }]);
await askTick(env, { fetch: async () => new Response("no", { status: 500 }) });
const q = JSON.parse(kv["ask_cb_q"]); ok(q.length === 1 && q[0].tries === 1 && q[0].next > Date.now(), "failed callback kept with back-off", q);
// STOP opts out
let optd = ""; await askWebhook(env, { entry: [{ changes: [{ value: { messages: [{ from: "971509999999", text: { body: "STOP" } }] } }] }] }, { optOut: async (e, d) => { optd = d; } });
ok(optd === "971509999999", "STOP opts out");
r = await call(body(), { method: "GET" }); ok(r.s === 405, "GET refused");
console.log("v783 ask report:", pass, "passed,", fail, "failed"); process.exit(fail ? 1 : 0);
