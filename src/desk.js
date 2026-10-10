// v388 - KENDALL DESK, step 1: plumbing only. A second WhatsApp Business number (WA_DESK_PHONE_ID) that answers
// ONE person (WA_DESK_OWNER, Kendall) and nobody else. Off by default: with WA_DESK_PHONE_ID empty nothing here runs.
// A desk event is never handed to the ordinary handlers, and a stranger on the desk number is never answered and
// never reaches Najjuko's flows. Replies go out from the desk number (the from-phone-id override on waSend).
import { deskIgStatusText } from "./ig_desk.js";   // v404
import { deskPostRoute } from "./desk_post.js";   // v413 - the posting loop
import { deskLabRoute } from "./desk_lab.js";   // v428 - the desk lab
export const DESK_VERSION = "v467";   // 10 Oct: was left at v388 for 65 releases; bump with every desk-facing release
const DIG = (s) => String(s == null ? "" : s).replace(/[^0-9]/g, "");
export const DESK_FIRST = "Desk is live. This number is for you only (Dr. Kendall Wilson). Commands: /post, /ideas, /queue, /insights, /cost, /pause, /resume, /ref, /desk_status.";
export const DESK_OTHER = "Received. Commands: /post, /ideas, /queue, /insights, /cost, /pause, /resume, /ref, /desk_status.";

export function deskOn(env) { return !!DIG(env.WA_DESK_PHONE_ID); }

// The phone number id a webhook event was delivered to, or "".
export function eventPhoneId(body) {
  try { const v = body.entry[0].changes[0].value; return DIG(v && v.metadata && v.metadata.phone_number_id); } catch (e) { return ""; }
}
export function isDeskEvent(env, body) { return deskOn(env) && eventPhoneId(body) === DIG(env.WA_DESK_PHONE_ID); }

// The owner's desk window: open when they last wrote to the desk number within 23 hours.
export async function deskWindowOpen(env) {
  try { const t = await env.MEETINGS.get("wa_desk_last_in"); return !!t && (Date.now() - Date.parse(t)) < 23 * 3600 * 1000; } catch (e) { return false; }
}

function dubaiNow() {
  try { return new Date().toLocaleString("en-GB", { timeZone: "Asia/Dubai", dateStyle: "medium", timeStyle: "short" }) + " (Dubai)"; } catch (e) { return new Date().toISOString(); }
}

export async function deskStatusText(env) {
  const open = await deskWindowOpen(env);
  return "Desk status\nTime: " + dubaiNow() + "\nWindow: " + (open ? "open" : "closed") + "\nDesk number configured: " + (deskOn(env) ? "yes" : "no") + "\nVersion: " + DESK_VERSION;
}

// Handle one webhook body that was delivered to the desk number. Always returns true (the event is consumed).
// deps.waSend(env, to, text, fromPhoneId) sends a plain text.
export async function deskHandle(env, body, deps) {
  let v = null; try { v = body.entry[0].changes[0].value; } catch (e) {}
  const msg = v && v.messages && v.messages[0];
  if (!msg) return true;                                   // a delivery receipt on the desk number: nothing to do, never routed on
  const from = DIG(msg.from), owner = DIG(env.WA_DESK_OWNER);
  if (!owner || from !== owner) {                          // a stranger: no reply, a counter and the last 4 digits for audit only
    try {
      let rec = {}; try { rec = JSON.parse((await env.MEETINGS.get("desk_stranger")) || "{}") || {}; } catch (e) {}
      rec = { count: (Number(rec.count) || 0) + 1, last4: from.slice(-4), at: new Date().toISOString() };
      await env.MEETINGS.put("desk_stranger", JSON.stringify(rec), { expirationTtl: 30 * 86400 });
    } catch (e) {}
    return true;
  }
  if (msg.id) { const k = "deskmsg_" + msg.id; try { if (await env.MEETINGS.get(k)) return true; await env.MEETINGS.put(k, "1", { expirationTtl: 3 * 86400 }); } catch (e) {} }
  let first = false;
  try { first = !(await env.MEETINGS.get("wa_desk_seen")); await env.MEETINGS.put("wa_desk_last_in", new Date().toISOString(), { expirationTtl: 3 * 86400 }); if (first) await env.MEETINGS.put("wa_desk_seen", "1"); } catch (e) {}
  const text = msg.type === "text" && msg.text ? String(msg.text.body || "").trim() : "";
  if (!first && deps.lab) { let done = false; try { done = await deskLabRoute(env, msg, text, deps.lab); } catch (e) { try { await deps.waSend(env, owner, "The lab step failed (" + String((e && e.message) || e).slice(0, 80) + ").", DIG(env.WA_DESK_PHONE_ID)); } catch (e2) {} done = true; } if (done) return true; }   // v428 - the desk lab: new WhatsApp features, tried here first
  if (!first && deps.post) { let done = false; try { done = await deskPostRoute(env, msg, text, deps.post); } catch (e) { try { await deps.waSend(env, owner, "That did not work (" + String((e && e.message) || e).slice(0, 80) + "). Nothing was posted.", DIG(env.WA_DESK_PHONE_ID)); } catch (e2) {} done = true; } if (done) return true; }   // v413
  let reply;
  if (first) reply = DESK_FIRST;
  else if (/^\/desk_status\b/i.test(text)) reply = await deskStatusText(env);
  else if (/^\/desk_ig\b/i.test(text)) reply = await deskIgStatusText(env);   // v404
  else reply = DESK_OTHER;
  try { await deps.waSend(env, owner, reply, DIG(env.WA_DESK_PHONE_ID)); } catch (e) {}
  return true;
}
