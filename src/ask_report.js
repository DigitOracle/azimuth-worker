// v783 (Kendall, 5 Nov 2026) - ASK -> REPORT -> WHATSAPP. digitalabbot.io publishes a 3-5 page report in a person's Ask portal and, at the same
// moment, calls POST /ask/report-ready here. This worker checks the call is genuine, checks consent and opt-out, and sends the person (first: Ali)
// a WhatsApp from the DESK number with the PDF attached. Delivery / read / failed come back through the normal WhatsApp status webhook and are
// passed on, signed, to the caller's callback_url (retried from the minute tick for up to 24 h).
// Contract: Operations/Handovers/DEV_BRIEF_Ask_Report_to_WhatsApp_05NOV2026.md.
// KV (MEETINGS): ask_rr_<report_id> {record}, ask_msg_<wamid> {report_id}, ask_cb_q [pending callbacks], ask_win_<digits> (last inbound, 24 h window),
// ask_tpl_status (cached template status, 10 min).
import { templateStatus } from "./wa_templates.js";

export const ASK_TEMPLATE = "ask_report_ready";
// v783 (24 h window hardening): if ask_report_ready is not approved yet and the person has not written in 24 h, the report link goes in an
// ALREADY-APPROVED utility template on the desk number: digitalchemy_meeting_followup ("Hi {{1}}, thank you for your time on {{2}}. As agreed,
// the next step is: {{3}}. Reply here with any questions. ..."). No document can be attached to it, so {{3}} carries the title and the portal link.
export const ASK_FALLBACK = "digitalchemy_meeting_followup";
const DIG = (s) => String(s || "").replace(/[^0-9]/g, "");
const J = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const getJ = async (env, k, d) => { try { const v = await env.MEETINGS.get(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const putJ = (env, k, v, o) => env.MEETINGS.put(k, JSON.stringify(v), o);
const RID = /^[A-Za-z0-9_.:-]{3,80}$/;
export const ASK_PORTAL_BASE_DEFAULT = "https://digitalabbot.io/ask/r/";

async function hmacHex(secret, text) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(text));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function ctEq(a, b) { a = String(a || ""); b = String(b || ""); let r = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) r |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return r === 0; }
// The signature is HMAC-SHA256 of the RAW request body (as in the dev brief); X-DA-Timestamp must be within 5 minutes and report_id is idempotent.
export async function askSign(secret, ts, raw) { return "sha256=" + (await hmacHex(secret, raw)); }

export function askValidate(b, env) {
  const err = [];
  if (!b || typeof b !== "object") return ["body must be JSON"];
  if (!RID.test(String(b.report_id || ""))) err.push("report_id missing or invalid");
  const r = b.recipient || {}, rep = b.report || {};
  if (!String(r.name || "").trim()) err.push("recipient.name missing");
  const d = DIG(r.whatsapp); if (d.length < 8 || d.length > 15 || !/^\+/.test(String(r.whatsapp || "").trim())) err.push("recipient.whatsapp must be international format, e.g. +9715XXXXXXXX");
  if (r.consent_whatsapp !== true) err.push("consent_required");
  if (!String(rep.title || "").trim()) err.push("report.title missing");
  const pg = parseInt(rep.pages, 10); if (!(pg >= 1 && pg <= 50)) err.push("report.pages must be 1-50");
  if (!/^https:\/\/[^\s]+$/i.test(String(rep.pdf_url || ""))) err.push("report.pdf_url must be a public https link");
  if (!/\.pdf$/i.test(String(rep.pdf_filename || ""))) err.push("report.pdf_filename must end in .pdf");
  const base = String((env && env.ASK_PORTAL_BASE) || ASK_PORTAL_BASE_DEFAULT);
  if (!String(rep.portal_url || "").startsWith(base) || String(rep.portal_url).length <= base.length) err.push("report.portal_url must start with " + base);
  if (b.callback_url != null && b.callback_url !== "" && !/^https:\/\/[^\s]+$/i.test(String(b.callback_url))) err.push("callback_url must be https");
  return err;
}

// The exact Meta payload. Template: header DOCUMENT, body {{1}} name {{2}} title {{3}} pages, URL button with a fixed base + {{1}} suffix.
export function askTemplatePayload(b, env) {
  const r = b.recipient, rep = b.report, base = String((env && env.ASK_PORTAL_BASE) || ASK_PORTAL_BASE_DEFAULT);
  return { messaging_product: "whatsapp", to: DIG(r.whatsapp), type: "template", template: { name: ASK_TEMPLATE, language: { code: "en" }, components: [
    { type: "header", parameters: [{ type: "document", document: { link: rep.pdf_url, filename: rep.pdf_filename } }] },
    { type: "body", parameters: [{ type: "text", text: String(r.name).trim().slice(0, 60) }, { type: "text", text: String(rep.title).trim().slice(0, 200) }, { type: "text", text: String(parseInt(rep.pages, 10)) }] },
    { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: String(rep.portal_url).slice(base.length) }] },
    { type: "button", sub_type: "quick_reply", index: "1", parameters: [{ type: "payload", payload: "ask_ack:" + b.report_id }] } ] } };
}
// Outside 24 h and before ask_report_ready is approved: the approved meeting follow-up template, plain and factual (stays UTILITY).
export function askFallbackPayload(b, now) {
  const r = b.recipient, rep = b.report, day = new Date((now || Date.now()) + 4 * 3600e3), M = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return { messaging_product: "whatsapp", to: DIG(r.whatsapp), type: "template", template: { name: ASK_FALLBACK, language: { code: "en" }, components: [
    { type: "body", parameters: [{ type: "text", text: String(r.name).trim().slice(0, 60) }, { type: "text", text: "your question (" + day.getUTCDate() + " " + M[day.getUTCMonth()] + ")" },
      { type: "text", text: "your report \u201c" + String(rep.title).trim().slice(0, 120) + "\u201d (" + parseInt(rep.pages, 10) + " pages) is ready in your Ask portal: " + rep.portal_url }] } ] } };
}
// Inside the person's 24 h window and before the template is approved: a free-form document with the same words as its caption.
export function askFreePayload(b) {
  const r = b.recipient, rep = b.report;
  return { messaging_product: "whatsapp", to: DIG(r.whatsapp), type: "document", document: { link: rep.pdf_url, filename: rep.pdf_filename,
    caption: "Hi " + String(r.name).trim() + ", your report is ready: " + String(rep.title).trim() + " (" + parseInt(rep.pages, 10) + " pages). You can also open it in your Ask portal: " + rep.portal_url } };
}

async function tplApproved(env, deps, name) {
  name = name || ASK_TEMPLATE; const ck = "ask_tpl_status" + (name === ASK_TEMPLATE ? "" : "_" + name);
  const c = await getJ(env, ck, null);
  if (c && Date.now() - c.at < 600000) return c.status === "APPROVED";
  let st = "UNKNOWN"; try { const r = await (deps.tplStatus ? deps.tplStatus(name) : templateStatus(env, deps.graph, name, env.WABA_ID || "1588773749592854")); st = r && r.status || "UNKNOWN"; } catch (e) {}
  await putJ(env, ck, { status: st, at: Date.now() }, { expirationTtl: 3600 });
  return st === "APPROVED";
}

// POST /ask/report-ready. deps: { graph, post(env, payload, fromPhoneId) -> {ok, id|wamid, error}, isOptedOut(env, digits), now?, tplStatus? }
export async function askRoute(request, env, url, deps) {
  if (url.pathname !== "/ask/report-ready") return null;
  if (request.method !== "POST") return J({ ok: false, error: "POST only" }, 405);
  const secret = String(env.ASK_WEBHOOK_SECRET || ""); if (!secret) return J({ ok: false, error: "not configured" }, 503);
  const raw = await request.text(); if (raw.length > 64000) return J({ ok: false, error: "body too large" }, 413);
  const ts = parseInt(request.headers.get("X-DA-Timestamp") || "", 10), now = (deps && deps.now) || Date.now();
  if (!ts || Math.abs(now / 1000 - ts) > 300) return J({ ok: false, error: "timestamp missing or older than 5 minutes" }, 401);
  if (!ctEq(String(request.headers.get("X-DA-Signature") || ""), await askSign(secret, ts, raw))) return J({ ok: false, error: "bad signature" }, 401);
  let b; try { b = JSON.parse(raw); } catch (e) { return J({ ok: false, error: "body must be JSON" }, 400); }
  const idem = String(request.headers.get("Idempotency-Key") || "");
  if (idem && idem !== String(b.report_id || "")) return J({ ok: false, error: "Idempotency-Key must equal report_id" }, 400);
  const err = askValidate(b, env); if (err.length) return J({ ok: false, error: err.includes("consent_required") ? "consent_required" : err.join("; "), errors: err }, 400);
  const d = DIG(b.recipient.whatsapp);
  if (deps && deps.isOptedOut && await deps.isOptedOut(env, d)) return J({ ok: false, error: "opted_out" }, 400);
  const key = "ask_rr_" + b.report_id, prev = await getJ(env, key, null);
  if (prev && prev.wamid && b.resend !== true && !b.test) return J({ ok: false, error: "already sent", message_id: prev.wamid }, 409);
  // Send order (v783 hardening): 1 ask_report_ready approved -> template (any time); 2 not approved, inside 24 h -> free-form document + text;
  // 3 not approved, outside 24 h -> approved fallback template (link only); 4 none possible -> 503 template_pending (digitalabbot.io retries).
  const approved = await tplApproved(env, deps), win = (await env.MEETINGS.get("ask_win_" + d)) ? true : false;
  const fbOk = !approved && !win ? await tplApproved(env, deps, ASK_FALLBACK) : false;
  const via = approved ? "template" : (win ? "freeform" : (fbOk ? "fallback_template" : ""));
  const pending = []; if (!approved) pending.push("ask_report_ready not approved yet"); if (!approved && !win) pending.push("no message from the person in the last 24 h"); if (!approved && !win && !fbOk) pending.push(ASK_FALLBACK + " not approved");
  const payload = via === "freeform" ? askFreePayload(b) : (via === "fallback_template" ? askFallbackPayload(b, now) : askTemplatePayload(b, env));
  if (b.test === true) return J({ ok: true, test: true, would_send: { via: via || "none (a real call would answer 503 template_pending)", from: "desk", pending, payload } });
  if (!via) return J({ ok: false, error: "template_pending", pending, retry_after_s: 1800 }, 503);
  const pid = DIG(env.WA_DESK_PHONE_ID);
  let res; try { res = await deps.post(env, payload, pid); } catch (e) { res = { ok: false, error: String(e && e.message || e) }; }
  const wamid = res && (res.id || res.wamid);
  if (!res || !res.ok || !wamid) { const code = res && res.status; return J({ ok: false, error: "whatsapp: " + String((res && res.error) || "send failed").slice(0, 200) }, code === 429 ? 429 : 502); }
  const rec = { report_id: b.report_id, question_id: String(b.question_id || ""), d, name: String(b.recipient.name).slice(0, 60), title: String(b.report.title).slice(0, 200), via, wamid, callback_url: String(b.callback_url || ""), at: new Date(now).toISOString(), status: "sent", history: (prev && prev.history || []).concat(prev && prev.wamid ? [{ wamid: prev.wamid, at: prev.at }] : []) };
  await putJ(env, key, rec, { expirationTtl: 400 * 86400 });
  await putJ(env, "ask_msg_" + wamid, { report_id: b.report_id }, { expirationTtl: 30 * 86400 });
  await askQueue(env, { report_id: b.report_id, status: "sent", at: rec.at });
  return J({ ok: true, message_id: wamid, via, pending });
}

async function askQueue(env, ev) {
  const rec = await getJ(env, "ask_rr_" + ev.report_id, null); if (!rec || !rec.callback_url) return;
  const q = await getJ(env, "ask_cb_q", []); q.push(Object.assign({ tries: 0, next: 0, first: Date.now() }, ev)); await putJ(env, "ask_cb_q", q.slice(-500));
}

// From the WhatsApp webhook: statuses for our wamids, inbound messages (24 h window, STOP). deps: { optOut(env, digits) }
export async function askWebhook(env, body, deps) {
  const out = { statuses: 0, stop: 0 };
  for (const en of (body && body.entry) || []) for (const ch of (en && en.changes) || []) {
    const v = ch && ch.value; if (!v) continue;
    for (const s of v.statuses || []) {
      const m = s && s.id ? await getJ(env, "ask_msg_" + s.id, null) : null; if (!m) continue;
      const st = String(s.status || ""); if (!["sent", "delivered", "read", "failed"].includes(st)) continue;
      out.statuses++;
      const rec = await getJ(env, "ask_rr_" + m.report_id, null);
      if (rec) { const rank = { sent: 1, delivered: 2, read: 3, failed: 4 }; if ((rank[st] || 0) >= (rank[rec.status] || 0)) { rec.status = st; if (st === "failed") rec.error = String((s.errors && s.errors[0] && (s.errors[0].title || s.errors[0].message)) || "failed").slice(0, 160); await putJ(env, "ask_rr_" + m.report_id, rec, { expirationTtl: 400 * 86400 }); } }
      const at = s.timestamp ? new Date(parseInt(s.timestamp, 10) * 1000).toISOString() : new Date().toISOString();
      await askQueue(env, Object.assign({ report_id: m.report_id, status: st, at }, st === "failed" && rec && rec.error ? { error: rec.error } : {}));
    }
    for (const msg of v.messages || []) {
      const d = DIG(msg && msg.from); if (!d) continue;
      await env.MEETINGS.put("ask_win_" + d, String(Date.now()), { expirationTtl: 86400 });
      const pl = String((msg.button && msg.button.payload) || (msg.interactive && msg.interactive.button_reply && msg.interactive.button_reply.id) || "");
      if (pl.indexOf("ask_ack:") === 0) {   // v783 - "Got it" on the report message: logged, opens his 24 h window, never reaches the campaign flows
        const rid = pl.slice(8), rec = await getJ(env, "ask_rr_" + rid, null);
        if (rec) { rec.acknowledged = new Date().toISOString(); await putJ(env, "ask_rr_" + rid, rec, { expirationTtl: 400 * 86400 }); await askQueue(env, { report_id: rid, status: "acknowledged", at: rec.acknowledged }); }
        out.ack = (out.ack || 0) + 1; out.consumed = true; continue;
      }
      const t = String((msg.text && msg.text.body) || (msg.button && msg.button.text) || "").trim();
      const own = [env.WA_ALLOWED, env.WA_DESK_OWNER].map(DIG).filter(Boolean).includes(d);   // owners typing "stop" in their own chat are never opted out
      if (!own && /^(stop|unsubscribe)$/i.test(t) && deps && deps.optOut) { try { await deps.optOut(env, d); out.stop++; } catch (e) {} }
    }
  }
  return out;
}

// Minute tick: deliver pending callbacks, signed like the webhook; back-off 1, 5, 30 min then hourly, up to 24 h.
export async function askTick(env, deps) {
  const q = await getJ(env, "ask_cb_q", []); if (!q.length) return 0;
  const secret = String(env.ASK_WEBHOOK_SECRET || ""), now = Date.now(), keep = []; let sent = 0;
  const f = (deps && deps.fetch) || fetch, waits = [60e3, 300e3, 1800e3, 3600e3];
  for (const ev of q) {
    if (ev.next > now || sent >= 20) { keep.push(ev); continue; }
    const rec = await getJ(env, "ask_rr_" + ev.report_id, null); if (!rec || !rec.callback_url || !secret) continue;
    const raw = JSON.stringify(Object.assign({ report_id: ev.report_id, status: ev.status, at: ev.at, via: rec.via || "" }, ev.error ? { error: ev.error } : {}, ev.status === "acknowledged" ? { acknowledged: true } : {}));
    const ts = Math.floor(now / 1000); let ok = false;
    try { const r = await f(rec.callback_url, { method: "POST", headers: { "Content-Type": "application/json", "X-DA-Timestamp": String(ts), "X-DA-Signature": await askSign(secret, ts, raw), "Idempotency-Key": ev.report_id + ":" + ev.status }, body: raw }); ok = r.status >= 200 && r.status < 300; } catch (e) {}
    sent++;
    if (!ok) { ev.tries++; if (now - ev.first < 86400e3) { ev.next = now + waits[Math.min(ev.tries - 1, waits.length - 1)]; keep.push(ev); } }
  }
  await putJ(env, "ask_cb_q", keep); return sent;
}
