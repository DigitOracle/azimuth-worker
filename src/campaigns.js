// v723 (Kendall, 3 Nov 2026: "build it out in Azimuth") - the WhatsApp CAMPAIGN ENGINE: the four missing pieces of
// Operations/Research/WhatsApp_Campaign_Roadmap_03NOV2026 (M2 consent register, M3 throttled sender, M4 opt-out store, M5 log + dashboard,
// M6 tracked links). Owner only: Kendall's insider key (ins_kendall_) or READ_KEY. Najjuko's key gets "not found".
//
// NOTHING SENDS unless a campaign has been set to status "live" by the owner route with confirm=<campaign id>. Dry run (action "dry")
// walks the exact same code path as the minute tick and logs every payload it WOULD post, without calling Meta. CAMPAIGNS_OFF="1" stops all.
//
// KV keys (binding MEETINGS; digits = the E.164 number without "+"):
//   camp_contact_<digits>   {e164, name, company, role, source, tags[], consent{text,date,by,import_id}, added, last_mkt?, last_camp?}
//   camp_contact_index      [digits...]
//   camp_consent_<import>   the consent register entry for one import: rows accepted (with the wording) and every rejection with its reason
//   camp_imports            [{id, at, accepted, rejected, duplicates, updated}]
//   camp_optout_<digits>    {at, how, text?, cid?} PERMANENT (no TTL); the sender reads it before EVERY message
//   camp_optout_index       [digits...]
//   camp_index              [campaign ids]; camp_<id> the campaign; camp_stats_<id> its counters; camp_q_<id> {list, pos} its audience
//   camp_msgs_<id>          [wamids] (written by the sender only); camp_msg_<wamid> {cid, d, at, st, err?, replied?, tap?, optout?, link?}
//   camp_sent24             [epoch ms] every campaign send in the last 24 h, shared by BOTH numbers (the Meta limit is per portfolio)
//   camp_dry_<id>           the last dry run: exactly what would have been posted
//   camp_link_<code>        {cid, d, url, clicks, first} - /c/<code> logs the click and redirects
// Never touches picjob_*, gmp_*, gcal_state.
import { WA_TEMPLATES } from "./wa_templates.js";

const esc = (s) => String(s == null ? "" : s).replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[c]));
const DIG = (s) => String(s || "").replace(/[^0-9]/g, "");
const J = (o, s) => new Response(JSON.stringify(o, null, 1), { status: s || 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const getJ = async (env, k, d) => { try { const v = await env.MEETINGS.get(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
const putJ = (env, k, v) => env.MEETINGS.put(k, JSON.stringify(v));
const DAY = 86400000;

export const CAMP_ICON = '<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12"/>';
// v726 (Kendall 4 Nov): legal sending window Mon-Fri 10:00-17:30 Dubai; ramp 50 -> 100 -> 150 -> 250 a day.
export const DEFAULTS = { cap: 250, shared: 250, batch: 5, window: "10:00-17:30", days: "mon-fri", freqDays: 7,
  block: 0.005, optout: 0.02, quality: 0.10, failed: 0.20, min: 20, ramp: [50, 100, 150, 250], rampBlock: 0.003, ownerWindow: "10:00-19:00" };
// Meta error codes. HARD: one is enough to stop the campaign. QUALITY: counted against the quality threshold. BLOCK: the person blocked marketing.
// v726: 131049 / 131026 / 131047 / 130472 are NOT quality (they cannot trip the 10% auto-stop); 130429 / 131056 back off and retry, not stop.
export const HARD_STOP = [131048, 131031, 368, 133010, 131045];
export const QUALITY = [131048];
export const BLOCK = [131050];
export const UNDELIVERABLE = [131026];          // not on WhatsApp / old app / terms not accepted: never sent to again
export const SKIP_CYCLE = [131049, 130472];     // Meta's per-person marketing limit, or a Meta experiment: skip this cycle, no retry now
export const FLOW_BUG = [131047];               // 24-hour window shut: our flow sent free-form when it should not have (our bug, not quality)
export const BACKOFF = [130429, 131056];        // throughput / pair rate limit: wait and retry
export const BACKOFF_STEPS = [30000, 120000, 600000, 1800000, 3600000];   // 30 s, 2 min, 10 min, 30 min, 1 h; one more and the campaign stops

// v767 (Kendall 5 Nov 2026): Najjuko's Dubai Land Department broker card (BRN) 98949, Faez Noorzad Real Estate L.L.C., valid 22 Jul 2026 - 22 Jul 2027.
// RENEW BY 22 Jul 2027: after that date the campaign must stop quoting it. A campaign may still set its own brn.
export const NAJ_BRN = "98949", NAJ_BRN_EXPIRES = "2027-07-22";

import { DP_SETS, dpReader, dpFileName } from "./district_passport.js";   // v771, v772
import { docCreate, docCaption } from "./district_doc.js";   // v774 - the personal passport page /p/<code>

// ---------- phone numbers ----------
// UAE mobile: 05X XXX XXXX, 5X XXX XXXX, 9715..., 009715..., +9715... -> +9715XXXXXXXX. Other countries need a full + or 00 prefix.
export function normPhone(raw) {
  let s = String(raw || "").trim().replace(/[\s\-().‎‏]/g, "");
  if (!s) return "";
  if (s.indexOf("00") === 0) s = "+" + s.slice(2);
  if (/^\+/.test(s)) s = "+" + DIG(s); else {
    const d = DIG(s);
    if (/^05\d{8}$/.test(d)) s = "+971" + d.slice(1);
    else if (/^5\d{8}$/.test(d)) s = "+971" + d;
    else if (/^9715\d{8}$/.test(d)) s = "+" + d;
    else return "";
  }
  if (s.indexOf("+971") === 0) return /^\+9715\d{8}$/.test(s) ? s : "";   // UAE landlines and short codes are not WhatsApp numbers
  return /^\+[1-9]\d{7,14}$/.test(s) ? s : "";
}

// ---------- CSV ----------
export function parseCsv(text) {
  const rows = []; let row = [], f = "", q = false; const t = String(text || "").replace(/^﻿/, "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; continue; }
    if (c === '"') q = true; else if (c === ",") { row.push(f); f = ""; } else if (c === "\n" || c === "\r") { if (c === "\r" && t[i + 1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; } else f += c;
  }
  if (f !== "" || row.length) { row.push(f); rows.push(row); }
  return rows.filter((r) => r.some((x) => String(x).trim() !== ""));
}
const HDR = { name: ["name", "full name", "full_name"], phone: ["phone", "mobile", "number", "whatsapp", "e164"], source: ["source"], company: ["company"], role: ["role", "title"],
  consent_text: ["consent_text", "consent text", "consent", "consent wording"], consent_date: ["consent_date", "consent date", "opted in", "opt_in_date"], consent_by: ["consent_by", "collected by", "collected_by"], tags: ["tags", "tag", "segment"],
  why: ["why", "reason", "source_line", "why receiving", "receiving because"] };   // v726 - the per-owner "You're receiving this because ..." line (template {{2}})
const cleanTag = (x) => String(x || "").toLowerCase().trim().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
export const parseTags = (s) => [...new Set(String(s || "").split(/[;|,]/).map(cleanTag).filter(Boolean))];
function consentDate(s, now) {
  const v = String(s || "").trim(); if (!v) return "";
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v), d = null;
  if (m) d = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  else if ((m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v))) d = Date.UTC(+m[3], +m[2] - 1, +m[1]);   // day/month/year, the UAE way
  if (d == null || isNaN(d) || d > now + DAY) return "";
  return new Date(d).toISOString().slice(0, 10);
}

// Import: dry by default (apply=false returns the preview and stores nothing). Every row needs a valid number, consent wording and a consent date.
export async function importContacts(env, csv, opts) {
  opts = opts || {}; const now = opts.now || Date.now(); const rows = parseCsv(csv);
  if (!rows.length) return { ok: false, error: "empty file" };
  const head = rows[0].map((h) => String(h).trim().toLowerCase()); const col = {};
  for (const k of Object.keys(HDR)) { const i = head.findIndex((h) => HDR[k].includes(h)); if (i >= 0) col[k] = i; }
  if (col.phone == null) return { ok: false, error: "no phone column (expected one of: " + HDR.phone.join(", ") + ")" };
  const id = "imp" + new Date(now).toISOString().replace(/[^0-9]/g, "").slice(0, 14) + Math.random().toString(36).slice(2, 6);
  const seen = new Set(), accepted = [], rejected = []; let duplicates = 0, updated = 0;
  const index = await getJ(env, "camp_contact_index", []); const known = new Set(index);
  const cell = (r, k) => (col[k] == null ? "" : String(r[col[k]] == null ? "" : r[col[k]]).trim());
  for (let n = 1; n < rows.length; n++) {
    const r = rows[n], line = n + 1, e164 = normPhone(cell(r, "phone"));
    if (!e164) { rejected.push({ line, reason: "bad_phone", phone: cell(r, "phone").slice(0, 24) }); continue; }
    const d = DIG(e164);
    if (seen.has(d)) { duplicates++; rejected.push({ line, reason: "duplicate_in_file", e164 }); continue; }
    seen.add(d);
    const text = cell(r, "consent_text"), date = consentDate(cell(r, "consent_date"), now);
    if (!text || text.length < 8) { rejected.push({ line, reason: "no_consent_text", e164 }); continue; }
    if (!date) { rejected.push({ line, reason: "no_consent_date", e164 }); continue; }
    if (await isOptedOut(env, d)) { rejected.push({ line, reason: "opted_out", e164 }); continue; }
    const c = { e164, name: cell(r, "name").slice(0, 80), why: cell(r, "why").slice(0, 200) || undefined, company: cell(r, "company").slice(0, 80), role: cell(r, "role").slice(0, 80),
      source: (cell(r, "source") || opts.source || "csv").slice(0, 80), tags: parseTags(cell(r, "tags") + (opts.tags ? ";" + opts.tags : "")),
      consent: { text: text.slice(0, 600), date, by: cell(r, "consent_by").slice(0, 80), import_id: id }, added: new Date(now).toISOString() };
    if (known.has(d)) { duplicates++; updated++; }
    accepted.push(c);
  }
  const res = { ok: true, apply: !!opts.apply, import_id: id, rows: rows.length - 1, accepted: accepted.length, rejected: rejected.length, duplicates, updated,
    rejections: rejected.slice(0, 200), preview: accepted.slice(0, 10).map((c) => ({ e164: c.e164, name: c.name, tags: c.tags, consent_date: c.consent.date })) };
  if (!opts.apply) return res;
  for (const c of accepted) {
    const d = DIG(c.e164), k = "camp_contact_" + d;
    if (known.has(d)) { const o = await getJ(env, k, null); if (o) { c.tags = [...new Set((o.tags || []).concat(c.tags))]; if (o.last_mkt) c.last_mkt = o.last_mkt; if (o.last_camp) c.last_camp = o.last_camp; c.added = o.added || c.added; c.consent_history = (o.consent_history || []).concat([o.consent]).slice(-5); } }
    else { index.push(d); known.add(d); }
    await putJ(env, k, c);
  }
  await putJ(env, "camp_contact_index", index);
  await putJ(env, "camp_consent_" + id, { id, at: new Date(now).toISOString(), source: opts.source || "", rows: res.rows,
    accepted: accepted.map((c) => ({ e164: c.e164, name: c.name, source: c.source, consent: c.consent })), rejected });
  const imps = await getJ(env, "camp_imports", []); imps.unshift({ id, at: new Date(now).toISOString(), accepted: res.accepted, rejected: res.rejected, duplicates, updated });
  await putJ(env, "camp_imports", imps.slice(0, 100));
  return res;
}

// ---------- opt-out ----------
// The whole message (trimmed, punctuation and emoji removed) must be one of these, so "don't stop" or a long sentence never opts anyone out.
const OPT_EN = ["stop", "stop messages", "stop message", "stop it", "stop all", "unsubscribe", "unsubscribe me", "opt out", "optout", "opt-out", "remove me", "remove",
  "not for me", "not this time", "no more", "no more messages", "dont message me", "do not message me", "dont contact me", "do not contact me", "leave me alone", "end", "quit", "cancel subscription",
  "stop promotions", "stop promotion", "stop promotional messages", "stop marketing", "stop marketing messages"];   // v726 - Meta's own marketing opt-out button ("Stop promotions")
// v726 - asking for deletion: opt out AND forget (contact, consent and status rows deleted; only a hashed opt-out kept)
const FORGET_EN = ["delete my details", "delete my data", "delete my number", "delete me", "forget me", "remove my details", "remove my number", "remove my data", "erase my data"];
const FORGET_AR = ["احذفني", "احذف رقمي", "احذف بياناتي", "امسح رقمي", "امسح بياناتي"];
const OPT_AR = ["إلغاء", "الغاء", "إلغاء الاشتراك", "الغاء الاشتراك", "توقف", "توقّف", "أوقف", "اوقف", "إيقاف", "ايقاف", "قف", "لا أريد", "لا اريد", "لا شكرا", "لا شكراً", "أزلني", "ازلني", "احذفني", "احذف رقمي", "لا ترسل", "لا ترسلوا", "توقفوا"];
export function optOutNorm(s) {
  return String(s || "").normalize("NFC").toLowerCase().replace(/[ً-ْـ]/g, "").replace(/['’`]/g, "").replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim();
}
const FORGET_SET = new Set(FORGET_EN.concat(FORGET_AR).map(optOutNorm));
const OPT_SET = new Set(OPT_EN.concat(OPT_AR).map(optOutNorm).concat([...FORGET_SET]));
export function isOptOutText(s) { const n = optOutNorm(s); return !!n && n.length <= 40 && OPT_SET.has(n); }
export function isForgetText(s) { const n = optOutNorm(s); return !!n && n.length <= 40 && FORGET_SET.has(n); }
// v726 - a forgotten person is kept ONLY as camp_optout_h_<sha256(salt + digits)>: enough to never message them again, nothing to read back.
export async function optHash(env, d) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(env.CAMP_HASH_SALT || "camp-optout-v726") + ":" + DIG(d)));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
export async function isOptedOut(env, d) { d = DIG(d); if (!d) return false; return !!(await env.MEETINGS.get("camp_optout_" + d)) || !!(await env.MEETINGS.get("camp_optout_h_" + (await optHash(env, d)))); }
// "Forget me": delete the contact, consent log, flow state and per-message status rows; redact the number on message and link rows
// (the counters stay right); remove from both indexes; keep a hashed opt-out with the date. Returns what was removed.
export async function forgetContact(env, d, how, now) {
  d = DIG(d); if (!d) return null; const h = await optHash(env, d), at = new Date(now || Date.now()).toISOString(), out = { deleted: 0, redacted: 0 };
  const del = async (k) => { if ((await env.MEETINGS.get(k)) != null) { await env.MEETINGS.delete(k); out.deleted++; } };
  await del("camp_contact_" + d); await del("camp_consentlog_" + d); await del("camp_optout_" + d);
  const ci = await getJ(env, "camp_contact_index", []); if (ci.includes(d)) await putJ(env, "camp_contact_index", ci.filter((x) => x !== d));
  const oi = await getJ(env, "camp_optout_index", []); if (oi.includes(d)) await putJ(env, "camp_optout_index", oi.filter((x) => x !== d));
  for (const cid of await getJ(env, "camp_index", [])) {
    await del("camp_state_" + cid + "_" + d);
    for (const w of await getJ(env, "camp_msgs_" + cid, [])) { const m = await getJ(env, "camp_msg_" + w, null); if (!m || m.d !== d) continue; m.d = "h:" + h.slice(0, 16); await putJ(env, "camp_msg_" + w, m); out.redacted++; await del("camp_status_" + w); }
    for (const code of await getJ(env, "camp_links_" + cid, [])) { const L = await getJ(env, "camp_link_" + code, null); if (L && L.d === d) { L.d = ""; await putJ(env, "camp_link_" + code, L); out.redacted++; } }
    const q = await getJ(env, "camp_q_" + cid, null); if (q && q.list && q.list.includes(d)) { const i = q.list.indexOf(d); q.list.splice(i, 1); if (i < (q.pos || 0)) q.pos--; await putJ(env, "camp_q_" + cid, q); }
  }
  const hi = await getJ(env, "camp_handover_index", []); if (hi.some((x) => x.d === d)) await putJ(env, "camp_handover_index", hi.filter((x) => x.d !== d));
  await putJ(env, "camp_optout_h_" + h, { at, how: how || "forget", forgotten: true });
  const fl = await getJ(env, "camp_forget_log", []); fl.unshift({ at, how: how || "forget", h: h.slice(0, 12) }); await putJ(env, "camp_forget_log", fl.slice(0, 1000));
  return out;
}
export async function optOut(env, d, how, extra, now) {
  d = DIG(d); if (!d) return false;
  if (await isOptedOut(env, d)) return false;
  await putJ(env, "camp_optout_" + d, Object.assign({ at: new Date(now || Date.now()).toISOString(), how }, extra || {}));
  const ix = await getJ(env, "camp_optout_index", []); if (!ix.includes(d)) { ix.push(d); await putJ(env, "camp_optout_index", ix); }
  const c = await getJ(env, "camp_contact_" + d, null); if (c) { c.opted_out = true; await putJ(env, "camp_contact_" + d, c); }
  return true;
}
export const OPTOUT_REPLY = "Done. You will not get any more marketing messages from DigitAlchemy on WhatsApp. Reply here any time if you need us.";
export const FORGET_REPLY = "Done. Your details are deleted and Najjuko will not message you again on WhatsApp.";

// ---------- alerts to Kendall (v726) ----------
// Every alert is logged in camp_alerts; it is also sent to Kendall (WA_DESK_OWNER, from the desk number) through deps.alert,
// which /wa and the minute tick wire to waSend. A send that fails (his window shut) still leaves the log line for the Campaigns card.
async function campAlert(env, deps, kind, text, now) {
  const L = await getJ(env, "camp_alerts", []); L.unshift({ at: new Date(now || Date.now()).toISOString(), kind, text: String(text).slice(0, 400) }); await putJ(env, "camp_alerts", L.slice(0, 200));
  if (env.CAMP_ALERTS === "off" || !deps || typeof deps.alert !== "function") return false;
  try { await deps.alert(env, "Campaigns: " + text); return true; } catch (e) { return false; }
}

// ---------- phone quality (v726) ----------
// camp_quality_<desk|main> = {rating: GREEN|YELLOW|RED, raw, event, limit, at}. Missing = no warning from Meta = GREEN.
const DESK_DISPLAY = "971585446093", MAIN_DISPLAY = "971585876093";   // the two business numbers (public, in the handover), overridable by env
const phoneKeyOfDisplay = (env, disp) => { const d = DIG(disp); if (!d) return ""; if (d === DIG(env.CAMP_DESK_DISPLAY || DESK_DISPLAY)) return "desk"; if (d === DIG(env.CAMP_MAIN_DISPLAY || MAIN_DISPLAY)) return "main"; return ""; };
const phoneKeyOfId = (env, pid) => { pid = DIG(pid); if (!pid) return ""; if (pid === DIG(env.WA_DESK_PHONE_ID)) return "desk"; if (pid === DIG(env.WA_PHONE_ID)) return "main"; return ""; };
export const normRating = (r) => { r = String(r || "").toUpperCase(); return r === "GREEN" || r === "HIGH" ? "GREEN" : r === "YELLOW" || r === "MEDIUM" ? "YELLOW" : r === "RED" || r === "LOW" || r === "FLAGGED" ? "RED" : ""; };
const TIER_N = { TIER_50: 50, TIER_250: 250, TIER_1K: 1000, TIER_2K: 2000, TIER_10K: 10000, TIER_100K: 100000, TIER_UNLIMITED: 1e9 };
const tierN = (t) => { if (t == null || t === "") return 0; if (typeof t === "number") return t; const s = String(t).toUpperCase(); return TIER_N[s] || parseInt(s.replace(/[^0-9]/g, ""), 10) || 0; };
export async function phoneQuality(env, c) { return await getJ(env, "camp_quality_" + (c.phone === "main" ? "main" : "desk"), null); }

// ---------- per-message status rows (v726) ----------
// camp_status_<wamid> = {cid, d, sent, delivered, read, failed, code}: one timestamp per stage, forward-only (a late "delivered" never
// undoes "read"), kept 90 days (KV expirationTtl). camp_msg_<wamid> stays the counter record.
const STATUS_TTL = 90 * 86400;
async function statusRow(env, wamid, patch) {
  const k = "camp_status_" + wamid, r = Object.assign({}, await getJ(env, k, {}));
  for (const f of Object.keys(patch)) if (r[f] == null) r[f] = patch[f];
  await env.MEETINGS.put(k, JSON.stringify(r), { expirationTtl: STATUS_TTL });
}

// ---------- stats ----------
const blankStats = () => ({ sent: 0, delivered: 0, read: 0, failed: 0, replies: 0, taps: 0, clicks: 0, uclicks: 0, optouts: 0, blocks: 0, quality: 0, err: {}, day: {}, skipped: {} });
async function bump(env, cid, f) { const k = "camp_stats_" + cid; const s = Object.assign(blankStats(), await getJ(env, k, {})); f(s); await putJ(env, k, s); return s; }
export function rates(s) {
  const n = s.sent || 0, p = (x) => (n ? x / n : 0);
  return { sent: n, delivered: p(s.delivered), read: p(s.read), replied: p(s.replies), clicked: p(s.uclicks), optout: p(s.optouts), block: p(s.blocks), quality: p(s.quality), failed: p(s.failed) };
}
// The auto-stop rule (roadmap 3 Nov: block rate over 0.5%, opt-outs over 2%, quality-error spikes). Returns the reason or "".
export function stopReason(c, s) {
  const t = Object.assign({}, DEFAULTS, c.thresholds || {}), r = rates(s);
  for (const code of HARD_STOP) if ((s.err || {})[code]) return "Meta error " + code + " (hard stop)";
  if (r.sent < t.min) return "";
  if (r.block > t.block) return "block rate " + (r.block * 100).toFixed(1) + "% over " + (t.block * 100) + "%";
  if (r.optout > t.optout) return "opt-out rate " + (r.optout * 100).toFixed(1) + "% over " + (t.optout * 100) + "%";
  if (r.quality > t.quality) return "quality errors " + (r.quality * 100).toFixed(1) + "% over " + (t.quality * 100) + "%";
  if (r.failed > t.failed) return "failed " + (r.failed * 100).toFixed(1) + "% over " + (t.failed * 100) + "%";
  return "";
}
async function autoStop(env, cid, s, now) {
  const c = await getJ(env, "camp_" + cid, null); if (!c || c.status !== "live") return "";
  const why = stopReason(c, s); if (!why) return "";
  c.status = "stopped"; c.stopped = { at: new Date(now || Date.now()).toISOString(), why, auto: true }; await putJ(env, "camp_" + cid, c);
  return why;
}

// ---------- v726: what a failed code does to the contact and the campaign ----------
async function failedCodes(env, cid, d, codes, deps, now) {
  if (!codes.length) return;
  const k = d ? await getJ(env, "camp_contact_" + d, null) : null;
  if (k && codes.some((c) => UNDELIVERABLE.includes(c))) { k.undeliverable = { at: new Date(now).toISOString(), code: codes.find((c) => UNDELIVERABLE.includes(c)) }; await putJ(env, "camp_contact_" + d, k); }
  else if (k && codes.some((c) => SKIP_CYCLE.includes(c))) { k.last_mkt = new Date(now).toISOString(); k.skip_code = codes.find((c) => SKIP_CYCLE.includes(c)); await putJ(env, "camp_contact_" + d, k); }
  if (codes.some((c) => FLOW_BUG.includes(c))) await campAlert(env, deps, "flow_bug", "campaign " + cid + ": a message went out after the person's 24-hour reply window had closed (code 131047). That is a fault in our flow, not a quality problem. Nothing else changed.", now);
  if (codes.some((c) => BACKOFF.includes(c))) await backOff(env, cid, codes.find((c) => BACKOFF.includes(c)), deps, now);
}
// Throughput limits: wait 30 s, 2 min, 10 min, 30 min, 1 h; a sixth in a row stops the campaign. A good send resets the count.
async function backOff(env, cid, code, deps, now) {
  const k = "camp_backoff_" + cid, b = await getJ(env, k, { n: 0 }); b.n = (b.n || 0) + 1; b.code = code; b.at = new Date(now).toISOString();
  if (b.n > BACKOFF_STEPS.length) {
    const c = await getJ(env, "camp_" + cid, null);
    if (c && c.status === "live") { c.status = "stopped"; c.stopped = { at: b.at, why: "Meta throughput limit " + code + " " + b.n + " times in a row", auto: true }; await putJ(env, "camp_" + cid, c);
      await campAlert(env, deps, "backoff_stop", "campaign " + cid + " stopped: Meta kept refusing for sending too fast (code " + code + ", " + b.n + " times in a row). It needs your resume.", now); }
    b.until = 0;
  } else b.until = now + BACKOFF_STEPS[b.n - 1];
  await putJ(env, k, b); return b;
}
const TPL_BLOCK = ["PAUSED", "DISABLED", "REJECTED", "LOCKED", "FLAGGED", "PENDING_DELETION", "DELETED", "ARCHIVED", "LIMIT_EXCEEDED"];
async function campTemplates(env, c) { const s = new Set([c.template].filter(Boolean)); if (c.flow) { const f = await getJ(env, "camp_flow_" + c.flow, null); if (f) for (const n of Object.values(f.nodes || {})) if (n.template) s.add(n.template); } return s; }
// Pause every LIVE campaign that matches; returns their ids. Resuming stays with Kendall (the resume action needs his key).
async function pauseWhere(env, pred, why, now) {
  const ids = await getJ(env, "camp_index", []), hit = [];
  for (const id of ids) { const c = await getJ(env, "camp_" + id, null); if (!c || c.status !== "live" || !(await pred(c))) continue;
    c.status = "paused"; c.paused = new Date(now).toISOString(); c.paused_by = { at: c.paused, why, auto: true }; await putJ(env, "camp_" + id, c); hit.push(id); }
  return hit;
}
// Account-level webhooks (same /wa callback, field != "messages"). Meta's documented fields (checked 4 Nov 2026):
//   phone_number_quality_update {display_phone_number, event, current_limit, old_limit, max_daily_conversations_per_business}
//   message_template_status_update {event, message_template_name, message_template_language, reason, other_info{title}}
//   message_template_quality_update {previous_quality_score, new_quality_score, message_template_name}
// The phone-rating names are read defensively: older payloads carry event FLAGGED / UNFLAGGED / DOWNGRADE / UPGRADE and no rating field;
// any of quality_rating / current_quality_rating / quality_score / new_quality_score is used when present.
export async function accountEvent(env, field, v, deps, now) {
  now = now || Date.now(); const ev = String(v.event || "").toUpperCase();
  if (field === "phone_number_quality_update") {
    const key = phoneKeyOfDisplay(env, v.display_phone_number), keys = key ? [key] : ["desk", "main"];   // a number we cannot place: treat it as ours (safe side)
    let rating = normRating(v.quality_rating || v.current_quality_rating || v.quality_score || v.new_quality_score || (v.quality && v.quality.rating));
    if (!rating && ev === "FLAGGED") rating = "RED"; if (!rating && ev === "UNFLAGGED") rating = "GREEN";
    const nl = tierN(v.max_daily_conversations_per_business || v.max_daily_conversation_per_phone || v.current_limit), ol = tierN(v.old_limit);
    const down = /DOWNGRADE/.test(ev) || (ol > 0 && nl > 0 && nl < ol);
    const res = { field, keys, rating, event: ev, limit: nl || undefined, down, paused: [] };
    for (const pk of keys) {
      const prev = await getJ(env, "camp_quality_" + pk, {}) || {};
      const rec = { rating: rating || (down ? "RED" : prev.rating || ""), event: ev, limit: nl || prev.limit || undefined, raw: String(v.quality_rating || v.current_quality_rating || v.new_quality_score || "").slice(0, 20) || undefined, at: new Date(now).toISOString(), prev: prev.rating || undefined };
      await putJ(env, "camp_quality_" + pk, rec);
      const L = await getJ(env, "camp_quality_log", []); L.unshift(Object.assign({ phone: pk }, rec)); await putJ(env, "camp_quality_log", L.slice(0, 200));
      const label = pk === "desk" ? "the campaign number (544 6093)" : "the main number (587 6093)";
      if (rec.rating === "RED" || down) {
        const hit = await pauseWhere(env, async (c) => (c.phone === "main" ? "main" : "desk") === pk, "phone quality " + (down ? "limit lowered" : "RED"), now); res.paused = res.paused.concat(hit);
        await campAlert(env, deps, "quality_red", "Meta " + (down ? "lowered the messaging limit" : "rated " + label + " LOW (red)") + ". Paused " + (hit.length ? hit.join(", ") : "no live campaign") + ". Nothing sends from it until you resume.", now);
      } else if (rec.rating === "YELLOW" && prev.rating !== "YELLOW") {
        await campAlert(env, deps, "quality_yellow", "Meta rated " + label + " MEDIUM (yellow). Campaigns on it now send at half their daily cap until the rating is back to high.", now);
      }
    }
    return res;
  }
  if (field === "business_capability_update" || field === "account_update") {
    const nl = tierN(v.max_daily_conversations_per_business || v.max_daily_conversation_per_phone), prev = await getJ(env, "camp_meta_limit", {}) || {};
    if (nl) await putJ(env, "camp_meta_limit", { limit: nl, at: new Date(now).toISOString(), prev: prev.limit || undefined });
    const bad = field === "account_update" && /VIOLATION|RESTRICT|DISABLE|BAN|OFFBOARD|DELET/.test(ev), down = nl > 0 && prev.limit > 0 && nl < prev.limit;
    if (!bad && !down) return { field, event: ev, limit: nl || undefined };
    const hit = await pauseWhere(env, async () => true, field + " " + (ev || "limit lowered"), now);
    await campAlert(env, deps, "account", "Meta sent an account notice (" + (ev || "messaging limit lowered to " + nl) + "). Paused " + (hit.length ? hit.join(", ") : "no live campaign") + ".", now);
    return { field, event: ev, paused: hit };
  }
  if (field === "message_template_status_update" || field === "message_template_quality_update") {
    const name = String(v.message_template_name || "").replace(/[^a-z0-9_]/g, ""); if (!name) return null;
    const prev = await getJ(env, "camp_tpl_" + name, {}) || {}, rec = Object.assign({}, prev, { at: new Date(now).toISOString() });
    let block = false, why = "";
    if (field === "message_template_status_update") { rec.status = ev; rec.reason = v.reason || undefined; rec.title = (v.other_info && v.other_info.title) || undefined; block = TPL_BLOCK.includes(ev); why = "template " + name + " " + ev.toLowerCase() + (v.reason && v.reason !== "NONE" ? " (" + v.reason + ")" : ""); }
    else { const q = normRating(v.new_quality_score), pq = normRating(v.previous_quality_score) || prev.quality || "GREEN"; rec.quality = q || String(v.new_quality_score || ""); const rank = { GREEN: 0, YELLOW: 1, RED: 2 };
      block = !!q && q !== "GREEN" && (rank[q] > (rank[pq] || 0) || q === "RED"); why = "template " + name + " quality " + (q || "unknown").toLowerCase(); }
    await putJ(env, "camp_tpl_" + name, rec);
    if (!block) return { field, name, event: rec.status, quality: rec.quality };
    const hit = await pauseWhere(env, async (c) => (await campTemplates(env, c)).has(name), why, now);
    await campAlert(env, deps, "template", "Meta: " + why + ". Paused " + (hit.length ? hit.join(", ") : "no live campaign") + ".", now);
    return { field, name, event: rec.status, quality: rec.quality, paused: hit };
  }
  return null;
}

// ---------- webhook hook ----------
// Called from /wa for EVERY event before the existing handlers; it never consumes the event and never throws. It only acts on
// (a) status callbacks for a message the campaign sender sent (camp_msg_<wamid>), and (b) messages from a number in the contact list
// or replying to a campaign message. The owner numbers (WA_ALLOWED, WA_DESK_OWNER) can only opt out by tapping a campaign button or
// replying to a campaign message, so Najjuko's and the desk's ordinary chats are untouched.
export async function campWebhook(env, body, deps) {
  const out = { statuses: 0, optouts: 0, replies: 0, taps: 0, stopped: "" };
  try {
    const pv = await campPreview(env, body, deps); if (pv && pv.consumed) { out.consumed = true; out.preview = pv; return out; }
    const now = (deps && deps.now) || Date.now();
    for (const en of (body && body.entry) || []) for (const ch of (en && en.changes) || []) {
      if (!ch || !ch.value || !ch.field || ch.field === "messages") continue;
      try { const a = await accountEvent(env, ch.field, ch.value, deps, now); if (a) out.account = (out.account || []).concat([a]); } catch (e) { out.account_error = String(e && e.message || e).slice(0, 120); }
    }
    const val = body && body.entry && body.entry[0] && body.entry[0].changes && body.entry[0].changes[0] && body.entry[0].changes[0].value;
    if (!val) return out;
    const pid = DIG(val.metadata && val.metadata.phone_number_id);
    for (const s of (val.statuses || [])) {
      const k = "camp_msg_" + String(s.id || ""); const m = s.id ? await getJ(env, k, null) : null; if (!m) continue;
      out.statuses++;
      const st = String(s.status || ""), prev = m.st || "sent", codes = (s.errors || []).map((e) => Number(e && e.code)).filter(Boolean);
      const inc = { delivered: 0, read: 0, failed: 0 };
      if (st === "delivered" && !m.delivered) { m.delivered = true; inc.delivered = 1; }
      if (st === "read") { if (!m.delivered) { m.delivered = true; inc.delivered = 1; } if (!m.read) { m.read = true; inc.read = 1; } }
      if (st === "failed" && prev !== "failed") { inc.failed = 1; m.err = codes; }
      if (st === "failed") m.st = "failed"; else if (prev !== "failed" && (st === "read" || (st === "delivered" && prev !== "read"))) m.st = st;
      if (["sent", "delivered", "read", "failed"].includes(st)) { const ts = s.timestamp ? new Date(Number(s.timestamp) * 1000).toISOString() : new Date(now).toISOString(), patch = { [st]: ts };
        if (st === "read") patch.delivered = ts; if (st === "failed" && codes.length) patch.code = codes[0]; await statusRow(env, String(s.id), patch); }
      if (!inc.delivered && !inc.read && !inc.failed) continue;
      await putJ(env, k, m);
      const S = await bump(env, m.cid, (x) => { x.delivered += inc.delivered; x.read += inc.read; x.failed += inc.failed;
        if (inc.failed) for (const c of codes) { x.err[c] = (x.err[c] || 0) + 1; if (QUALITY.includes(c)) x.quality++; if (FLOW_BUG.includes(c)) x.flow_bug = (x.flow_bug || 0) + 1; if (BLOCK.includes(c)) { x.blocks++; x.bday = x.bday || {}; x.bday[dubaiDate(now)] = (x.bday[dubaiDate(now)] || 0) + 1; } } });
      if (inc.failed) { if (codes.some((c) => BLOCK.includes(c))) await optOut(env, m.d, "blocked_marketing", { cid: m.cid, code: 131050 }, now);
        await failedCodes(env, m.cid, m.d, codes, deps, now);
        const w = await autoStop(env, m.cid, S, now); if (w) out.stopped = w; }
    }
    for (const msg of (val.messages || [])) {
      const d = DIG(msg.from); if (!d) continue;
      const ctxId = msg.context && msg.context.id ? String(msg.context.id) : "";
      const cm = ctxId ? await getJ(env, "camp_msg_" + ctxId, null) : null;
      const contact = await getJ(env, "camp_contact_" + d, null);
      if (!cm && !contact) continue;
      const isBtn = msg.type === "button" || (msg.type === "interactive" && msg.interactive && (msg.interactive.button_reply || msg.interactive.list_reply));
      const txt = msg.type === "text" ? (msg.text && msg.text.body) : msg.type === "button" ? ((msg.button && (msg.button.text || msg.button.payload)) || "")
        : (msg.interactive && ((msg.interactive.button_reply && msg.interactive.button_reply.title) || (msg.interactive.list_reply && msg.interactive.list_reply.title))) || "";
      const owner = [DIG(env.WA_ALLOWED), DIG(env.WA_DESK_OWNER)].filter(Boolean).includes(d);
      const cid = (cm && cm.cid) || (contact && contact.last_camp) || "";
      const mk = cm ? "camp_msg_" + ctxId : (contact && contact.last_wamid ? "camp_msg_" + contact.last_wamid : "");
      const mrec = cm || (mk ? await getJ(env, mk, null) : null);
      if (isOptOutText(txt) && (!owner || isBtn || cm)) {
        const camp = cid ? await getJ(env, "camp_" + cid, null) : null;
        const forget = isForgetText(txt) || !!(camp && camp.stop_forgets);   // v726 - the template says "Tap Stop and I'll delete your details"
        const fresh = await optOut(env, d, isBtn ? "button" : "text", { text: String(txt).slice(0, 60), cid }, now);
        if (fresh) {
          out.optouts++;
          if (mrec && mk && !mrec.optout) { mrec.optout = true; await putJ(env, mk, mrec); }
          if (cid) { const S = await bump(env, cid, (x) => { x.optouts++; if (forget) x.forgotten = (x.forgotten || 0) + 1; x.oday = x.oday || {}; x.oday[dubaiDate(now)] = (x.oday[dubaiDate(now)] || 0) + 1; }); const w = await autoStop(env, cid, S, now); if (w) out.stopped = w; }
          if (forget) { out.forgotten = (out.forgotten || 0) + 1; await forgetContact(env, d, isBtn ? "button" : "text", now); }
          if (env.CAMP_OPTOUT_REPLY !== "off" && deps && typeof deps.send === "function") { try { await deps.send(env, d, forget ? FORGET_REPLY : OPTOUT_REPLY, pid); } catch (e) {} }
        }
        continue;
      }
      if (isBtn) { try { const fc = await flowChoice(env, msg, d, deps, now); if (fc) out.flow = (out.flow || []).concat([fc]); } catch (e) { out.flow_error = String(e && e.message || e).slice(0, 120); } }
      if (!cid || !mrec || owner && !cm && !isBtn) continue;
      let rep = 0, tap = 0;
      if (!mrec.replied) { mrec.replied = true; rep = 1; out.replies++; }
      if (isBtn && !mrec.tap) { mrec.tap = String(txt).slice(0, 40) || true; tap = 1; out.taps++; }
      if (rep || tap) { await putJ(env, mk, mrec); await bump(env, cid, (x) => { x.replies += rep; x.taps += tap; if (rep) { x.rday = x.rday || {}; x.rday[dubaiDate(now)] = (x.rday[dubaiDate(now)] || 0) + 1; } }); }
    }
  } catch (e) { out.error = String(e && e.message || e).slice(0, 120); }
  return out;
}

// ---------- tracked links ----------
const B62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const code8 = () => { const a = new Uint8Array(8); crypto.getRandomValues(a); return [...a].map((x) => B62[x % 62]).join(""); };
export const cleanTarget = (u) => { const s = String(u || "").trim(); return /^https:\/\/[^\s"<>]+$/i.test(s) && s.length <= 500 ? s : ""; };
export async function makeLink(env, cid, d, target) {
  const url = cleanTarget(target); if (!url) return "";
  const code = code8(); await putJ(env, "camp_link_" + code, { cid, d: DIG(d), url, clicks: 0 });
  if (cid) { const L = await getJ(env, "camp_links_" + cid, []); L.push(code); await putJ(env, "camp_links_" + cid, L.slice(-5000)); }
  return code;
}
export async function linkRoute(request, env, url, now) {
  const m = url.pathname.match(/^\/c\/([0-9A-Za-z]{6,12})\/?$/); if (!m) return null;
  const L = await getJ(env, "camp_link_" + m[1], null);
  if (!L || !cleanTarget(L.url)) return new Response("not found", { status: 404 });
  const ua = String(request.headers.get("User-Agent") || "");
  const bot = /facebookexternalhit|WhatsApp\/|bot|crawler|preview|Slackbot|TelegramBot/i.test(ua);   // the link-preview fetch is not a click
  if (!bot) {
    const first = !L.clicks; L.clicks = (L.clicks || 0) + 1; if (first) L.first = new Date(now || Date.now()).toISOString(); L.last = new Date(now || Date.now()).toISOString();
    await putJ(env, "camp_link_" + m[1], L);
    if (L.cid) await bump(env, L.cid, (x) => { x.clicks++; if (first) x.uclicks++; });
  }
  return new Response(null, { status: 302, headers: { Location: L.url, "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}

// ---------- campaigns ----------
const ID_RE = /^[a-z0-9][a-z0-9-]{1,40}$/;
export function parseWindow(w) { const m = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/.exec(String(w || DEFAULTS.window)); if (!m) return null; const a = +m[1] * 60 + +m[2], b = +m[3] * 60 + +m[4]; return a < b && b <= 1440 ? [a, b] : null; }
export const dubaiMin = (now) => { const d = new Date(now + 4 * 3600000); return d.getUTCHours() * 60 + d.getUTCMinutes(); };   // Dubai is UTC+4 all year
export const dubaiDate = (now) => new Date(now + 4 * 3600000).toISOString().slice(0, 10);
const WD = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
// v726: "mon-fri", "sun-thu", "mon,wed,fri", "all" -> weekday numbers (0 = Sunday); null when it cannot be read
export function parseDays(s) {
  s = String(s == null || s === "" ? DEFAULTS.days : s).toLowerCase().replace(/\s+/g, ""); if (s === "all" || s === "*") return [0, 1, 2, 3, 4, 5, 6];
  const out = new Set();
  for (const part of s.split(",")) { const m = /^([a-z]{3})(?:-([a-z]{3}))?$/.exec(part); if (!m) return null; const a = WD.indexOf(m[1]), b = m[2] ? WD.indexOf(m[2]) : a; if (a < 0 || b < 0) return null;
    for (let i = a, n = 0; n < 7; i = (i + 1) % 7, n++) { out.add(i); if (i === b) break; } }
  return out.size ? [...out].sort() : null;
}
const localParts = (now, offMin) => { const d = new Date(now + offMin * 60000); return { min: d.getUTCHours() * 60 + d.getUTCMinutes(), wd: d.getUTCDay() }; };
// The Dubai legal window: the campaign's hours AND its weekdays (default Mon-Fri 10:00-17:30 Dubai).
export const inWindow = (c, now) => { const w = parseWindow(c.window), days = parseDays(c.days), p = localParts(now, 240); return !!w && !!days && days.includes(p.wd) && p.min >= w[0] && p.min < w[1]; };
// ---------- owner time zone (v726) ----------
// Country calling code -> standard offset (minutes) and a summer-time rule ("eu": last Sunday Mar-Oct; "us": 2nd Sunday Mar - 1st Sunday Nov).
// Compact on purpose: the main Palm Jebel Ali owner origins. US/Canada use Eastern time (most owners). Unknown -> Dubai.
const TZ_CC = [
  ["971", 240], ["966", 180], ["974", 180], ["973", 180], ["965", 180], ["968", 240], ["44", 0, "eu"], ["353", 0, "eu"], ["91", 330], ["92", 300], ["880", 360], ["94", 330], ["977", 345],
  ["7", 180], ["86", 480], ["852", 480], ["65", 480], ["60", 480], ["63", 480], ["81", 540], ["82", 540], ["61", 600], ["64", 720], ["1", -300, "us"],
  ["49", 60, "eu"], ["33", 60, "eu"], ["39", 60, "eu"], ["34", 60, "eu"], ["31", 60, "eu"], ["32", 60, "eu"], ["41", 60, "eu"], ["43", 60, "eu"], ["46", 60, "eu"], ["47", 60, "eu"], ["45", 60, "eu"],
  ["48", 60, "eu"], ["420", 60, "eu"], ["36", 60, "eu"], ["351", 0, "eu"], ["30", 120, "eu"], ["40", 120, "eu"], ["359", 120, "eu"], ["358", 120, "eu"], ["380", 120, "eu"], ["961", 120, "eu"],
  ["90", 180], ["962", 180], ["964", 180], ["98", 210], ["20", 120], ["212", 60], ["234", 60], ["254", 180], ["27", 120], ["233", 0], ["375", 180], ["994", 240], ["998", 300]
].sort((a, b) => b[0].length - a[0].length);
const nthSun = (y, mo, n) => { if (n > 0) { const d = new Date(Date.UTC(y, mo, 1)); return 1 + ((7 - d.getUTCDay()) % 7) + (n - 1) * 7; } const last = new Date(Date.UTC(y, mo + 1, 0)); return last.getUTCDate() - last.getUTCDay(); };
function dstOn(rule, now, std) {
  const y = new Date(now).getUTCFullYear();
  if (rule === "eu") return now >= Date.UTC(y, 2, nthSun(y, 2, -1), 1) && now < Date.UTC(y, 9, nthSun(y, 9, -1), 1);
  if (rule === "us") return now >= Date.UTC(y, 2, nthSun(y, 2, 2), 2) - std * 60000 && now < Date.UTC(y, 10, nthSun(y, 10, 1), 2) - (std + 60) * 60000;
  return false;
}
export function ownerTz(e164) { const d = DIG(e164); for (const r of TZ_CC) if (d.indexOf(r[0]) === 0) return { cc: r[0], std: r[1], dst: r[2] || "" }; return { cc: "", std: 240, dst: "" }; }
export const ownerOffset = (e164, now) => { const t = ownerTz(e164); return t.std + (t.dst && dstOn(t.dst, now, t.std) ? 60 : 0); };
// The owner's own local window: 10:00-19:00, Monday-Friday of THEIR week. The sender needs this AND the Dubai window open.
export const ownerOpen = (c, e164, now) => { if (c.owner_tz === false) return true; const w = parseWindow(c.owner_window || DEFAULTS.ownerWindow), p = localParts(now, ownerOffset(e164, now)); return !!w && p.wd >= 1 && p.wd <= 5 && p.min >= w[0] && p.min < w[1]; };
export function cleanCampaign(x, prev) {
  const c = Object.assign({}, prev || {}); const err = [];
  if (!prev) { if (!ID_RE.test(String(x.id || ""))) err.push("id: lowercase letters, digits and dashes"); c.id = String(x.id || ""); c.status = "draft"; c.created = new Date().toISOString(); }
  if (x.name != null) c.name = String(x.name).slice(0, 80);
  if (x.template != null) c.template = String(x.template).replace(/[^a-z0-9_]/g, "").slice(0, 80);
  const def = WA_TEMPLATES[c.template];
  if (x.lang != null) c.lang = String(x.lang).replace(/[^A-Za-z_]/g, "").slice(0, 8);
  if (!c.lang && def) c.lang = def.language;
  if (x.vars != null) c.vars = (Array.isArray(x.vars) ? x.vars : String(x.vars).split("|")).map((v) => String(v).slice(0, 300));
  if (x.tags != null) c.tags = Array.isArray(x.tags) ? x.tags.map(cleanTag).filter(Boolean) : parseTags(x.tags);
  if (x.cap != null) c.cap = Math.max(1, Math.min(10000, parseInt(x.cap, 10) || DEFAULTS.cap));
  if (x.batch != null) c.batch = Math.max(1, Math.min(20, parseInt(x.batch, 10) || DEFAULTS.batch));
  if (x.window != null) c.window = String(x.window).replace(/\s+/g, "");
  if (x.days != null) c.days = String(x.days).toLowerCase().replace(/\s+/g, "");
  if (x.brn != null) c.brn = String(x.brn).replace(/[^0-9A-Za-z-]/g, "").slice(0, 20);
  if (!c.brn) c.brn = NAJ_BRN;   // v767 (Kendall 5 Nov) - her broker card number is the default on every campaign
  if (x.ramp != null) c.ramp = x.ramp === false || x.ramp === "off" ? false : (Array.isArray(x.ramp) ? x.ramp : String(x.ramp).split(/[,|]/)).map((n) => parseInt(n, 10)).filter((n) => n > 0).slice(0, 10);
  if (x.owner_tz != null) c.owner_tz = !(x.owner_tz === false || x.owner_tz === "off");
  if (x.stop_forgets != null) c.stop_forgets = !!x.stop_forgets;
  if (x.phone != null) c.phone = x.phone === "main" ? "main" : "desk";
  if (x.flow != null) c.flow = ID_RE.test(String(x.flow)) ? String(x.flow) : "";
  if (x.freq_days != null) c.freq_days = Math.max(1, Math.min(60, parseInt(x.freq_days, 10) || DEFAULTS.freqDays));
  if (x.qr != null) c.qr = Math.max(0, Math.min(10, parseInt(x.qr, 10) || 0));
  if (x.link_url != null) c.link_url = cleanTarget(x.link_url);
  if (x.header != null) c.header = x.header && /^(image|video|document)$/.test(x.header.type) && (cleanTarget(x.header.link) || /^\d{5,30}$/.test(String(x.header.id || ""))) ? { type: x.header.type, link: cleanTarget(x.header.link) || undefined, id: x.header.id ? String(x.header.id) : undefined } : null;
  if (x.thresholds != null && typeof x.thresholds === "object") { c.thresholds = {}; for (const k of ["block", "optout", "quality", "failed", "min"]) if (Number(x.thresholds[k]) >= 0) c.thresholds[k] = Number(x.thresholds[k]); }
  c.cap = c.cap || DEFAULTS.cap; c.batch = c.batch || DEFAULTS.batch; c.window = c.window || DEFAULTS.window; c.days = c.days || DEFAULTS.days; c.phone = c.phone || "desk"; c.vars = c.vars || []; c.tags = c.tags || [];
  if (!parseDays(c.days)) err.push("days like mon-fri (Dubai weekdays)");
  if (!c.template) err.push("template required");
  if (!c.lang) err.push("lang required (template not in wa_templates.js)");
  if (!parseWindow(c.window)) err.push("window like 10:00-19:00 (Dubai)");
  if (!c.tags.length) err.push("at least one audience tag");
  if (def) {
    const need = (String(def.body).match(/\{\{\d+\}\}/g) || []).length; if (c.vars.length !== need) err.push("template " + c.template + " needs " + need + " variable(s), got " + c.vars.length);
    if ((def.header_image_key || def.header_video_key) && !c.header) err.push("template has a " + (def.header_image_key ? "image" : "video") + " header: give header {type, link|id}");
    if (!c.flow) c.qr = (def.buttons || []).filter((b) => b.type === "QUICK_REPLY").length;
  }
  if (c.vars.includes("link") && !c.link_url) err.push("variable 'link' needs link_url (https)");
  return { c, err };
}
export const phoneIdOf = (env, c) => DIG(c.phone === "main" ? env.WA_PHONE_ID : env.WA_DESK_PHONE_ID);
const firstName = (n) => (String(n || "").trim().split(/\s+/)[0] || "there").slice(0, 40);
export function buildPayload(c, contact, link) {
  const val = (v) => v === "name" ? firstName(contact.name) : v === "fullname" ? (contact.name || "there") : v === "company" ? (contact.company || "your team") : v === "role" ? (contact.role || "") : v === "link" ? link : v === "brn" ? (c.brn || "") : v === "why" ? (contact.why || "") : v.charAt(0) === "=" ? v.slice(1) : String(contact[v] || "");
  const comps = [];
  if (c.header) comps.push({ type: "header", parameters: [{ type: c.header.type, [c.header.type]: c.header.id ? { id: c.header.id } : { link: c.header.link } }] });
  if (c.vars.length) comps.push({ type: "body", parameters: c.vars.map((v) => ({ type: "text", text: (String(val(v)).replace(/\s+/g, " ").trim() || "-").slice(0, 900) })) });
  for (let i = 0; i < (c.qr || 0); i++) comps.push({ type: "button", sub_type: "quick_reply", index: String(i), parameters: [{ type: "payload", payload: "camp:" + c.id + ":" + i }] });
  const p = { messaging_product: "whatsapp", to: DIG(contact.e164), type: "template", template: { name: c.template, language: { code: c.lang } } };
  if (comps.length) p.template.components = comps;
  return p;
}
async function buildQueue(env, c) {
  const ix = await getJ(env, "camp_contact_index", []), list = [];
  for (const d of ix) { const k = await getJ(env, "camp_contact_" + d, null); if (k && !k.opted_out && !k.undeliverable && (k.tags || []).some((t) => c.tags.includes(t))) list.push(d); }
  return { list, pos: 0, built: new Date().toISOString() };
}

// v726 - the ramp: today's step of c.ramp (default 50, 100, 150, 250 a day). Decided once per Dubai day: step up only when the previous
// sending day's block rate was under 0.3% AND the phone is GREEN; otherwise hold. Never above c.cap or the shared cap (campStep takes the min).
export function rampLevel(c, S, today, rating) {
  const sched = c.ramp === false ? null : (Array.isArray(c.ramp) && c.ramp.length ? c.ramp : DEFAULTS.ramp);
  if (!sched) return { cap: Infinity, level: -1 };
  const st = Object.assign({ level: 0 }, S.ramp || {});
  if (st.for === today) return { cap: sched[Math.min(st.level, sched.length - 1)], level: st.level };
  const prev = Object.keys(S.day || {}).filter((d) => d < today && (S.day[d] || 0) > 0).sort().pop() || "";
  let level = st.level || 0, why = "first day";
  if (prev && prev !== st.prev) {
    const n = S.day[prev] || 0, b = (S.bday || {})[prev] || 0, br = n ? b / n : 0, lim = (c.thresholds && c.thresholds.ramp_block != null) ? c.thresholds.ramp_block : DEFAULTS.rampBlock;
    if (br < lim && rating === "GREEN") { level = Math.min(level + 1, sched.length - 1); why = "up: " + prev + " block rate " + (br * 100).toFixed(2) + "%"; }
    else why = "hold: " + (rating !== "GREEN" ? "quality " + rating : prev + " block rate " + (br * 100).toFixed(2) + "%");
  } else if (prev) why = "hold: no new sending day";
  const state = { level, for: today, prev: prev || st.prev || "", why };
  return { cap: sched[level], level, why, state };
}
// ONE step of a campaign: the minute tick (dry=false, status must be "live") and the dry run (dry=true) both come here.
export async function campStep(env, c, deps, dry) {
  const now = (deps && deps.now) || Date.now(), f = (deps && deps.fetch) || fetch, graph = (deps && deps.graph) || "https://graph.facebook.com/v21.0";
  const r = { id: c.id, dry: !!dry, sent: 0, would: [], skipped: {}, stop: "", note: "" };
  const skip = (why) => { r.skipped[why] = (r.skipped[why] || 0) + 1; };
  if (!dry && c.status !== "live") { r.note = "not live"; return r; }
  if (env.CAMPAIGNS_OFF === "1") { r.note = "CAMPAIGNS_OFF"; return r; }
  const pid = phoneIdOf(env, c); if (!pid) { r.note = "no phone id for " + c.phone; return r; }
  if (c.phone === "main" && env.CAMP_MAIN_PHONE !== "on") { r.note = "main number refused: its replies and receipts do not reach this worker (set CAMP_MAIN_PHONE=on once routed)"; return r; }
  const open = inWindow(c, now); r.window = open;
  if (!open && !dry) { r.note = "outside window " + c.window; return r; }
  // v726 - the phone's Meta quality: RED never sends (the webhook has already paused it); YELLOW halves the daily cap
  const qual = await phoneQuality(env, c), rating = (qual && qual.rating) || "GREEN"; r.quality = rating;
  if (rating === "RED") { r.note = "phone quality RED: not sending"; return r; }
  for (const t of await campTemplates(env, c)) { const ts = await getJ(env, "camp_tpl_" + t, null); if (ts && (TPL_BLOCK.includes(ts.status) || ts.quality === "RED")) { r.note = "template " + t + " " + (ts.status || "quality " + ts.quality).toLowerCase() + ": not sending"; return r; } }
  const bo = await getJ(env, "camp_backoff_" + c.id, null);
  if (!dry && bo && bo.until > now) { r.note = "backing off after Meta code " + bo.code + " until " + new Date(bo.until).toISOString(); return r; }
  const S = Object.assign(blankStats(), await getJ(env, "camp_stats_" + c.id, {}));
  const why0 = stopReason(c, S); if (why0) { r.stop = why0; if (!dry) await autoStop(env, c.id, S, now); return r; }
  const today = dubaiDate(now), s24 = (await getJ(env, "camp_sent24", [])).filter((t) => now - t < DAY);
  const shared = Math.max(0, parseInt(env.CAMP_SHARED_CAP, 10) || DEFAULTS.shared);
  const ramp = rampLevel(c, S, today, rating); r.ramp = ramp;
  let dayCap = Math.min(c.cap || DEFAULTS.cap, ramp.cap, shared); if (rating === "YELLOW") dayCap = Math.floor(dayCap / 2); r.day_cap = dayCap;
  let room = Math.min(c.batch || DEFAULTS.batch, dayCap - (S.day[today] || 0), shared - s24.length);
  if (dry) room = Math.min(dayCap - (S.day[today] || 0), shared - s24.length);   // the dry run shows the whole of today's allowance
  r.room = Math.max(0, room); r.shared_used = s24.length; r.shared_cap = shared;
  if (room <= 0) { r.note = (shared - s24.length <= 0) ? "shared 24 h cap reached" : "daily cap reached"; return r; }
  let q = await getJ(env, "camp_q_" + c.id, null); if (!q) { q = await buildQueue(env, c); if (!dry) await putJ(env, "camp_q_" + c.id, q); }
  let pos = q.pos || 0; const sentIds = [];
  const freq = (c.freq_days != null ? c.freq_days : DEFAULTS.freqDays) * DAY;
  // v726 - owners whose own local time is outside 10:00-19:00 Mon-Fri wait in q.wait (worked first on every tick; the number alone gives the zone)
  const wait = (q.wait || []).slice(), keepWait = []; let wi = 0;
  while (room > 0 && (wi < wait.length || pos < q.list.length)) {
    const fromWait = wi < wait.length, d = fromWait ? wait[wi++] : q.list[pos++];
    if (!ownerOpen(c, d, now)) { skip("owner_local_hours"); if (!dry) keepWait.push(d); continue; }
    const k = await getJ(env, "camp_contact_" + d, null);
    if (!k) { skip("gone"); continue; }
    if (await isOptedOut(env, d)) { skip("opted_out"); continue; }   // checked before EVERY message (v726: also the hashed "forget me" entries)
    if (k.opted_out) { skip("opted_out"); continue; }
    if (k.undeliverable) { skip("undeliverable"); continue; }   // v726 - 131026 once: never again
    if (c.vars.includes("why") && !k.why) { skip("no_reason_line"); continue; }   // the template must say why they are receiving it
    if (!k.consent || !k.consent.text || !k.consent.date) { skip("no_consent"); continue; }
    if (!(k.tags || []).some((t) => c.tags.includes(t))) { skip("tags_changed"); continue; }
    if (k.last_mkt && now - Date.parse(k.last_mkt) < freq) { skip("messaged_this_week"); continue; }
    let code = "", link = "";
    if (c.vars.includes("link")) { const base = String(env.PUBLIC_ORIGIN || (deps && deps.origin) || "https://azimuth-2.digitalchemy.workers.dev").replace(/\/+$/, "");
      if (dry) { code = "DRYRUN00"; } else { code = await makeLink(env, c.id, d, c.link_url); } link = base + "/c/" + code; }
    const payload = buildPayload(c, k, link);
    if (dry) { r.would.push({ from_phone_id: pid, url: graph + "/" + pid + "/messages", payload }); room--; continue; }
    let res = null, j = {}, code0 = 0;
    try { res = await f(graph + "/" + pid + "/messages", { method: "POST", headers: { Authorization: "Bearer " + env.WHATSAPP_TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(payload) }); j = await res.json().catch(() => ({})); } catch (e) { j = { error: { code: 0, message: String(e && e.message || e) } }; }
    const wamid = j && j.messages && j.messages[0] && j.messages[0].id;
    if (res && res.ok && wamid) {
      room--; r.sent++; s24.push(now); sentIds.push(wamid);
      await putJ(env, "camp_msg_" + wamid, { cid: c.id, d, at: new Date(now).toISOString(), st: "sent", link: code || undefined });
      await statusRow(env, wamid, { cid: c.id, d, sent: new Date(now).toISOString() });
      k.last_mkt = new Date(now).toISOString(); k.last_camp = c.id; k.last_wamid = wamid; await putJ(env, "camp_contact_" + d, k);
      if (code) { const L = await getJ(env, "camp_link_" + code, null); if (L) { L.wamid = wamid; await putJ(env, "camp_link_" + code, L); } }
      if (bo && bo.n) { await env.MEETINGS.delete("camp_backoff_" + c.id); bo.n = 0; }   // a good send ends the back-off run
    } else {
      code0 = Number(j && j.error && j.error.code) || 0; r.errors = (r.errors || []).concat([{ d: d.slice(0, 5) + "...", code: code0, msg: String(j && j.error && j.error.message || "").slice(0, 100) }]).slice(-10);
      if (BACKOFF.includes(code0)) {   // v726 - nothing was sent: not a send, not a failure; this person goes first next time; wait and retry
        await bump(env, c.id, (x) => { x.err[code0] = (x.err[code0] || 0) + 1; x.backoffs = (x.backoffs || 0) + 1; });
        if (fromWait) wi--; else pos--;
        const b = await backOff(env, c.id, code0, deps, now); r.backoff = b; break;
      }
      await bump(env, c.id, (x) => { x.sent++; x.failed++; x.err[code0] = (x.err[code0] || 0) + 1; if (QUALITY.includes(code0)) x.quality++; if (FLOW_BUG.includes(code0)) x.flow_bug = (x.flow_bug || 0) + 1;
        if (BLOCK.includes(code0)) { x.blocks++; x.bday = x.bday || {}; x.bday[today] = (x.bday[today] || 0) + 1; } x.day[today] = (x.day[today] || 0) + 1; });
      if (BLOCK.includes(code0)) await optOut(env, d, "blocked_marketing", { cid: c.id, code: code0 }, now);
      await failedCodes(env, c.id, d, [code0], deps, now);   // 131026 undeliverable for good; 131049 / 130472 skipped this cycle (no retry now); 131047 alert
      if (HARD_STOP.includes(code0)) break;
    }
  }
  if (dry) { r.queue = q.list.length; r.from = q.pos || 0; await putJ(env, "camp_dry_" + c.id, { at: new Date(now).toISOString(), window_open: open, room: r.room, would: r.would, skipped: r.skipped }); return r; }
  q.pos = pos; q.wait = keepWait.concat(wait.slice(wi)); await putJ(env, "camp_q_" + c.id, q);
  await putJ(env, "camp_sent24", s24.filter((t) => now - t < DAY));
  if (sentIds.length) { const L = await getJ(env, "camp_msgs_" + c.id, []); await putJ(env, "camp_msgs_" + c.id, L.concat(sentIds)); }
  const S2 = await bump(env, c.id, (x) => { x.sent += r.sent; x.day[today] = (x.day[today] || 0) + r.sent; if (ramp.state) x.ramp = ramp.state; for (const w of Object.keys(r.skipped)) x.skipped[w] = (x.skipped[w] || 0) + r.skipped[w]; });
  const why = await autoStop(env, c.id, S2, now); if (why) r.stop = why;
  if (!why && pos >= q.list.length && !q.wait.length) { const cc = await getJ(env, "camp_" + c.id, null); if (cc && cc.status === "live") { cc.status = "done"; cc.done = new Date(now).toISOString(); await putJ(env, "camp_" + c.id, cc); } }
  return r;
}
// The minute tick: every LIVE campaign, one small batch each. Nothing else runs.
export async function campTick(env, deps) {
  if (env.CAMPAIGNS_OFF === "1") return [];
  const ids = await getJ(env, "camp_index", []), out = [];
  for (const id of ids) { const c = await getJ(env, "camp_" + id, null); if (c && (c.status === "live" || (c.status === "done" && c.flow))) { try { if (c.status === "live") out.push(await campStep(env, c, deps, false)); if (c.flow) out.push(await flowFollowups(env, c, deps)); } catch (e) { out.push({ id, error: String(e && e.message || e).slice(0, 120) }); } } }
  return out;
}
// Rebuild the counters from the per-message records (the webhook and the sender both write counters; this is the check).
export async function recount(env, cid) {
  const ids = await getJ(env, "camp_msgs_" + cid, []), old = Object.assign(blankStats(), await getJ(env, "camp_stats_" + cid, {}));
  const s = blankStats(); s.day = old.day; s.skipped = old.skipped;
  const sendFails = old.sent - ids.length;   // refusals at send time have no wamid; keep them as counted
  s.sent = ids.length + Math.max(0, sendFails); s.failed = Math.max(0, sendFails); s.err = Object.assign({}, old.err);
  for (const w of ids) { const m = await getJ(env, "camp_msg_" + w, null); if (!m) continue;
    if (m.delivered) s.delivered++; if (m.read) s.read++; if (m.st === "failed") s.failed++; if (m.replied) s.replies++; if (m.tap) s.taps++; if (m.optout) s.optouts++;
    if (m.link) { const L = await getJ(env, "camp_link_" + m.link, null); if (L && L.clicks) { s.clicks += L.clicks; s.uclicks++; } } }
  s.blocks = old.blocks; s.quality = old.quality;
  await putJ(env, "camp_stats_" + cid, s); return s;
}

// ---------- owner routes ----------
// v723 (coordinator 3 Nov): the Campaigns card is NAJJUKO's card - her key and Kendall's open it; GOING LIVE stays with the owner (Kendall's key or READ_KEY).
export const isCampViewer = (env, url, deps) => isCampOwner(env, url, deps) || !!(deps && typeof deps.person === "function" && deps.person(env, url) === "najjuko" && (typeof deps.isNaj !== "function" || deps.isNaj(env, url)));
export const isCampOwner = (env, url, deps) => { const k = url.searchParams.get("key") || ""; if (!k) return false;
  if (deps && typeof deps.person === "function" && deps.person(env, url) === "kendall") return true;
  return !!env.READ_KEY && deps && typeof deps.ctEq === "function" ? deps.ctEq(k, String(env.READ_KEY)) : (!!env.READ_KEY && k === String(env.READ_KEY)); };

export async function campaignRoute(request, env, url, deps) {
  const p = url.pathname;
  if (p.startsWith("/c/")) return linkRoute(request, env, url, deps && deps.now);
  if (p.startsWith("/cb/")) { const _m = p.match(/^\/cb\/([a-z0-9-]{1,60})\/?$/); if (_m && DP_SETS[_m[1]]) return Response.redirect(new URL("/dp/" + _m[1] + url.search, url.origin).toString(), 301); return briefRoute(request, env, url); }   // v771 - /cb/ -> /dp/
  if (!p.startsWith("/momo/campaigns")) return null;
  if (!isCampViewer(env, url, deps)) return new Response("not found", { status: 404 });
  const owner = isCampOwner(env, url, deps);
  const key = url.searchParams.get("key") || "", rk = url.searchParams.get("rk") || "";
  const now = (deps && deps.now) || Date.now();
  if (p === "/momo/campaigns" && request.method === "GET") {
    const body = await dashBody(env, key, rk, now, url.searchParams.get("c") || "", owner);
    const html = deps && typeof deps.page === "function" ? deps.page(key, rk, body) : '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Campaigns</title></head><body>' + body + '</body></html>';
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  }
  if (p === "/momo/campaigns/import" && request.method === "POST") {
    const ct = String(request.headers.get("Content-Type") || ""); let csv = "", b = {};
    if (/json/i.test(ct)) { try { b = await request.json(); } catch (e) { return J({ ok: false, error: "bad json" }, 400); } csv = String(b.csv || ""); } else csv = await request.text();
    if (csv.length > 2000000) return J({ ok: false, error: "file over 2 MB" }, 413);
    const r = await importContacts(env, csv, { apply: url.searchParams.get("apply") === "1" || b.apply === true, source: url.searchParams.get("source") || b.source || "", tags: url.searchParams.get("tags") || b.tags || "", now });
    return J(r, r.ok ? 200 : 400);
  }
  if (p === "/momo/campaigns/api" && request.method === "GET") {
    const ids = await getJ(env, "camp_index", []), list = [];
    for (const id of ids) { const c = await getJ(env, "camp_" + id, null); if (c) list.push({ campaign: c, stats: Object.assign(blankStats(), await getJ(env, "camp_stats_" + id, {})), rates: rates(Object.assign(blankStats(), await getJ(env, "camp_stats_" + id, {}))) }); }
    const s24 = (await getJ(env, "camp_sent24", [])).filter((t) => now - t < DAY);
    return J({ ok: true, contacts: (await getJ(env, "camp_contact_index", [])).length, optouts: (await getJ(env, "camp_optout_index", [])).length, shared_24h: s24.length, shared_cap: parseInt(env.CAMP_SHARED_CAP, 10) || DEFAULTS.shared, imports: await getJ(env, "camp_imports", []), campaigns: list });
  }
  if (p === "/momo/campaigns/api" && request.method === "POST") {
    let b = {}; try { b = await request.json(); } catch (e) { return J({ ok: false, error: "bad json" }, 400); }
    const a = String(b.action || ""), id = String(b.id || "");
    if (a === "flow_put") { const { f, err } = cleanFlow(b.flow); if (err.length) return J({ ok: false, error: err }, 400); await putJ(env, "camp_flow_" + f.id, f); return J({ ok: true, flow: f }); }
    if (a === "flow_get") { const f = await getJ(env, "camp_flow_" + String(b.flow || ""), null); return f ? J({ ok: true, flow: f }) : J({ ok: false, error: "no such flow" }, 404); }
    if (a === "simulate") { const f = await getJ(env, "camp_flow_" + String(b.flow || ""), null); if (!f) return J({ ok: false, error: "no such flow" }, 404); return J({ ok: true, result: simulateFlow(f, Array.isArray(b.choices) ? b.choices : [], b.contact || { name: "Test Owner", e164: "+971500000000" }) }); }
    if (a === "handovers") return J({ ok: true, handovers: await getJ(env, "camp_handover_index", []) });
    if (a === "create") {
      const ix = await getJ(env, "camp_index", []); if (ix.includes(String(b.id || ""))) return J({ ok: false, error: "id exists" }, 409);
      if (b.flow) { const f = await getJ(env, "camp_flow_" + String(b.flow), null); if (!f) return J({ ok: false, error: "no such flow" }, 400); const st = f.nodes[f.start];
        b = Object.assign({}, b, { template: st.template, lang: st.lang, vars: st.vars || [], header: st.header || b.header, qr: (st.buttons || []).length, freq_days: b.freq_days || f.freq_days || 14,
          phone: b.phone || f.phone || "desk", stop_forgets: b.stop_forgets != null ? b.stop_forgets : !!f.stop_forgets }); }
      const { c, err } = cleanCampaign(b, null); if (err.length) return J({ ok: false, error: err }, 400);
      await putJ(env, "camp_" + c.id, c); ix.push(c.id); await putJ(env, "camp_index", ix); return J({ ok: true, campaign: c });
    }
    if (a === "forget") { if (!owner) return J({ ok: false, error: "owner key" }, 403); const d = DIG(normPhone(b.phone)); if (!d) return J({ ok: false, error: "bad phone" }, 400);
      await optOut(env, d, "owner_forget", {}, now); return J({ ok: true, removed: await forgetContact(env, d, "owner", now) }); }
    if (a === "alerts") return J({ ok: true, alerts: await getJ(env, "camp_alerts", []), quality: { desk: await getJ(env, "camp_quality_desk", null), main: await getJ(env, "camp_quality_main", null) } });
    if (a === "optout") { const d = DIG(normPhone(b.phone)); if (!d) return J({ ok: false, error: "bad phone" }, 400); return J({ ok: true, fresh: await optOut(env, d, "owner", { note: String(b.note || "").slice(0, 80) }, now) }); }
    const c = ID_RE.test(id) ? await getJ(env, "camp_" + id, null) : null; if (!c) return J({ ok: false, error: "no such campaign" }, 404);
    const save = async (st, extra) => { c.status = st; Object.assign(c, extra || {}); await putJ(env, "camp_" + id, c); return J({ ok: true, campaign: c }); };
    if (a === "update") { if (c.status === "live") return J({ ok: false, error: "pause it first" }, 409); const { c: n, err } = cleanCampaign(b, c); if (err.length) return J({ ok: false, error: err }, 400); Object.assign(c, n); await env.MEETINGS.delete("camp_q_" + id); await putJ(env, "camp_" + id, c); return J({ ok: true, campaign: c }); }
    if (a === "dry") { const r = await campStep(env, c, deps, true); return J({ ok: true, result: r }); }
    if (a === "request_live") { if (!["draft", "paused"].includes(c.status)) return J({ ok: false, error: "status " + c.status }, 409); c.live_requested = { at: new Date(now).toISOString(), by: owner ? "owner" : "najjuko" }; await putJ(env, "camp_" + id, c); return J({ ok: true, campaign: c, note: "Kendall must approve: action live with confirm=<id> on his key" }); }
    if (a === "live") {
      if (!owner) return J({ ok: false, error: "going live needs Kendall's approval (owner key)" }, 403);
      if (b.confirm !== id) return J({ ok: false, error: "confirm must equal the campaign id" }, 400);
      if (!["draft", "paused"].includes(c.status)) return J({ ok: false, error: "status " + c.status + " cannot go live" }, 409);
      const { err } = cleanCampaign({}, c); if (c.vars.includes("brn") && !c.brn) err.push("Najjuko's BRN is needed (update with brn)"); if (err.length) return J({ ok: false, error: err }, 400);
      return save("live", { started: c.started || new Date(now).toISOString(), live_by: "owner" });
    }
    if (a === "pause") { if (c.status !== "live") return J({ ok: false, error: "not live" }, 409); return save("paused", { paused: new Date(now).toISOString() }); }
    if (a === "resume") { if (!owner) return J({ ok: false, error: "resuming needs Kendall's approval (owner key)" }, 403); if (c.status !== "paused") return J({ ok: false, error: "not paused" }, 409); return save("live", { resumed: new Date(now).toISOString() }); }
    if (a === "stop") { if (["stopped", "done"].includes(c.status)) return J({ ok: false, error: "already " + c.status }, 409); return save("stopped", { stopped: { at: new Date(now).toISOString(), why: "owner", auto: false } }); }
    if (a === "recount") return J({ ok: true, stats: await recount(env, id) });
    if (a === "audience") { const q = await buildQueue(env, c); return J({ ok: true, size: q.list.length }); }
    if (a === "followup") { const mw = b.w ? await getJ(env, "camp_msg_" + String(b.w), null) : null; const d = mw && mw.cid === id ? mw.d : ""; const k = d ? await getJ(env, "camp_contact_" + d, null) : null; if (!k) return J({ ok: false, error: "no such contact" }, 404);
      const ix = await getJ(env, "camp_handover_index", []); ix.unshift({ kind: "follow_up", cid: id, d, name: k.name || "", e164: k.e164, at: new Date(now).toISOString(), by: owner ? "owner" : "najjuko", status: "open" }); await putJ(env, "camp_handover_index", ix.slice(0, 500));
      return J({ ok: true, note: "flagged; nothing was sent" }); }
    return J({ ok: false, error: "unknown action" }, 400);
  }
  return new Response("not found", { status: 404 });
}

// ---------- dashboard (cards, phone-first) ----------
const pc = (x) => (x * 100).toFixed(x > 0 && x < 0.1 ? 1 : 0) + "%";
const ic = (d, s) => '<svg viewBox="0 0 24 24" width=' + (s || 22) + ' height=' + (s || 22) + ' fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden=true>' + d + '</svg>';
const I = { users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>', ban: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>' };
const ST = { draft: ["Draft", "#5F6B66"], live: ["Live", "#0A4F4A"], paused: ["Paused", "#8A6F3E"], stopped: ["Stopped", "#A33A2B"], done: ["Done", "#0A4F4A"] };
// The Campaigns card (Najjuko's; phone-first, 375 px). Every chart is inline SVG drawn here; every number carries its label.
const TEAL = "#0A4F4A", GOLD = "#C5A56A", INK = "#1C2321", MUTE = "#5F6B66", RED = "#A33A2B", LINE = "#E7E1D6";
const maskNum = (e) => { const d = DIG(e); return d.length > 4 ? "+" + d.slice(0, 3) + " ••• " + d.slice(-4) : "+" + d; };
const lastDays = (now, n) => { const o = []; for (let i = n - 1; i >= 0; i--) o.push(dubaiDate(now - i * DAY)); return o; };
const updatesConsent = (k) => { const c = (k && k.consents) || {}; const t = Object.keys(c).find((x) => /update/.test(x)); return t ? c[t].value : null; };
function svgFunnel(st) {
  const max = Math.max(1, st[0][1]), W = 340, rh = 30;
  return '<svg viewBox="0 0 ' + W + ' ' + (st.length * rh + 4) + '" width="100%" role="img" aria-label="Funnel">' + st.map(([lab, v], i) => {
    const w = Math.max(2, Math.round((v / max) * 200)), y = i * rh + 2, pct = i ? Math.round((v / max) * 100) + "%" : "";
    return '<text x="0" y="' + (y + 18) + '" font-size="11" fill="' + MUTE + '">' + esc(lab) + '</text><rect x="92" y="' + (y + 5) + '" width="' + w + '" height="18" rx="4" fill="' + (i % 2 ? GOLD : TEAL) + '"/>'
      + '<text x="' + (96 + w) + '" y="' + (y + 18) + '" font-size="11" font-weight="600" fill="' + INK + '">' + v + (pct ? " · " + pct : "") + '</text>';
  }).join("") + '</svg>';
}
function svgDonut(parts) {
  const tot = parts.reduce((a, p) => a + p[1], 0); if (!tot) return '<p class=nd>No choices yet.</p>';
  const C = 2 * Math.PI * 42, cols = [TEAL, GOLD, "#5E8C84", "#8A6F3E", RED, "#9AA6A0"]; let off = 0;
  const arcs = parts.map((p, i) => { const L = (p[1] / tot) * C; const s = '<circle cx="60" cy="60" r="42" fill="none" stroke="' + cols[i % cols.length] + '" stroke-width="20" stroke-dasharray="' + L.toFixed(2) + ' ' + (C - L).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '" transform="rotate(-90 60 60)"/>'; off += L; return s; }).join("");
  const leg = parts.map((p, i) => '<div class=lg><span style="background:' + cols[i % cols.length] + '"></span>' + esc(p[0]) + ' <b>' + p[1] + '</b> <em>' + Math.round(p[1] / tot * 100) + '%</em></div>').join("");
  return '<div class=dn><svg viewBox="0 0 120 120" width="120" height="120" role="img" aria-label="Branch choices">' + arcs + '<text x="60" y="58" text-anchor="middle" font-size="18" font-weight="600" fill="' + INK + '">' + tot + '</text><text x="60" y="74" text-anchor="middle" font-size="9" fill="' + MUTE + '">choices</text></svg><div class=lgs>' + leg + '</div></div>';
}
function svgDaily(days, sends, reps, cap) {
  const W = 340, H = 140, top = 14, bh = 100, max = Math.max(cap, 1, ...sends), bw = Math.floor((W - 30) / days.length);
  const y = (v) => top + bh - (v / max) * bh;
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="Daily sends and replies">';
  s += '<line x1="24" x2="' + W + '" y1="' + y(cap).toFixed(1) + '" y2="' + y(cap).toFixed(1) + '" stroke="' + RED + '" stroke-dasharray="4 3"/><text x="' + (W - 2) + '" y="' + (y(cap) - 3).toFixed(1) + '" font-size="9" text-anchor="end" fill="' + RED + '">daily cap ' + cap + '</text>';
  days.forEach((d, i) => { const x = 26 + i * bw;
    s += '<rect x="' + x + '" y="' + y(sends[i]).toFixed(1) + '" width="' + Math.max(2, bw / 2 - 1) + '" height="' + (top + bh - y(sends[i])).toFixed(1) + '" fill="' + TEAL + '"><title>' + d + ' sent ' + sends[i] + '</title></rect>'
      + '<rect x="' + (x + bw / 2) + '" y="' + y(reps[i]).toFixed(1) + '" width="' + Math.max(2, bw / 2 - 1) + '" height="' + (top + bh - y(reps[i])).toFixed(1) + '" fill="' + GOLD + '"><title>' + d + ' replies ' + reps[i] + '</title></rect>';
    if (i % 3 === 0 || i === days.length - 1) s += '<text x="' + x + '" y="' + (H - 12) + '" font-size="9" fill="' + MUTE + '">' + d.slice(8) + '/' + d.slice(5, 7) + '</text>'; });
  return s + '<text x="0" y="' + (top + 4) + '" font-size="9" fill="' + MUTE + '">' + max + '</text><text x="0" y="' + (top + bh) + '" font-size="9" fill="' + MUTE + '">0</text></svg><div class=lgs2><div class=lg><span style="background:' + TEAL + '"></span>Sent</div><div class=lg><span style="background:' + GOLD + '"></span>Replies</div></div>';
}
function svgRate(days, rates) {
  const W = 340, H = 130, top = 12, h = 90, max = Math.max(0.01, ...rates) * 1.2, x = (i) => 30 + i * ((W - 40) / Math.max(1, days.length - 1)), y = (v) => top + h - (v / max) * h;
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="Opt-out and block rate">';
  s += '<line x1="30" x2="' + W + '" y1="' + y(0.005).toFixed(1) + '" y2="' + y(0.005).toFixed(1) + '" stroke="' + RED + '" stroke-dasharray="4 3"/><text x="' + (W - 2) + '" y="' + (y(0.005) - 3).toFixed(1) + '" font-size="9" text-anchor="end" fill="' + RED + '">0.5% stop line</text>';
  s += '<polyline fill="none" stroke="' + TEAL + '" stroke-width="2" points="' + rates.map((r, i) => x(i).toFixed(1) + "," + y(r).toFixed(1)).join(" ") + '"/>';
  rates.forEach((r, i) => { s += '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(r).toFixed(1) + '" r="2.5" fill="' + TEAL + '"><title>' + days[i] + ' ' + (r * 100).toFixed(2) + '%</title></circle>'; if (i % 3 === 0 || i === days.length - 1) s += '<text x="' + (x(i) - 8).toFixed(1) + '" y="' + (H - 10) + '" font-size="9" fill="' + MUTE + '">' + days[i].slice(8) + '/' + days[i].slice(5, 7) + '</text>'; });
  return s + '<text x="0" y="' + (top + 4) + '" font-size="9" fill="' + MUTE + '">' + (max * 100).toFixed(1) + '%</text><text x="0" y="' + (top + h) + '" font-size="9" fill="' + MUTE + '">0%</text></svg>';
}
function svgClicks(rows) {
  if (!rows.length) return '<p class=nd>No tracked links yet.</p>';
  const max = Math.max(1, ...rows.map((r) => r[1])), rh = 34;
  return '<svg viewBox="0 0 340 ' + (rows.length * rh) + '" width="100%" role="img" aria-label="Clicks per link">' + rows.map(([u, v, p], i) => { const w = Math.max(2, Math.round(v / max * 230)), y0 = i * rh;
    return '<text x="0" y="' + (y0 + 11) + '" font-size="10" fill="' + MUTE + '">' + esc(u.replace(/^https:\/\//, "").slice(0, 46)) + '</text><rect x="0" y="' + (y0 + 15) + '" width="' + w + '" height="13" rx="3" fill="' + GOLD + '"/><text x="' + (w + 4) + '" y="' + (y0 + 26) + '" font-size="10" font-weight="600" fill="' + INK + '">' + v + ' clicks · ' + p + ' people</text>'; }).join("") + '</svg>';
}
async function dashBody(env, key, rk, now, want, owner) {
  const q = "?key=" + encodeURIComponent(key) + (rk ? "&rk=" + encodeURIComponent(rk) : "");
  const ids = await getJ(env, "camp_index", []), camps = [];
  for (const id of ids) { const c = await getJ(env, "camp_" + id, null); if (c) camps.push(c); }
  const cur = camps.find((c) => c.id === want) || camps[camps.length - 1] || null;
  const cix = await getJ(env, "camp_contact_index", []); let consentN = 0;
  for (const d of cix.slice(0, 1500)) { const k = await getJ(env, "camp_contact_" + d, null); if (updatesConsent(k) === true) consentN++; }
  const S = cur ? Object.assign(blankStats(), await getJ(env, "camp_stats_" + cur.id, {})) : blankStats(), R = rates(S);
  const head = '<div class=hg>' + [["Contacts", cix.length], ["Sent", S.sent], ["Reply rate", pc(R.replied)], ["Consent to updates", consentN]].map((x) => '<div class=hc><b>' + esc(x[1]) + '</b><i>' + esc(x[0]) + '</i></div>').join("") + '</div>';
  const pick = camps.length > 1 ? '<div class=pk>' + camps.slice().reverse().map((c) => '<a class="pkc' + (cur && c.id === cur.id ? " on" : "") + '" href="/momo/campaigns' + q + '&c=' + encodeURIComponent(c.id) + '">' + esc(c.name || c.id) + '</a>').join("") + '</div>' : "";
  if (!cur) return '<a class=back href="/momo' + q + '">&#8592; Momo</a><div class=tag>MOMO</div><h1>Campaigns</h1>' + head + '<div class=empty id=camp_empty>' + ic(CAMP_ICON, 34) + '<p><b>No campaigns yet</b></p><p>Import a consented list, create a campaign, then run a dry run.</p></div>' + DASH_CSS;
  const st = ST[cur.status] || [cur.status, MUTE];
  const btn = (a, lab, cls) => '<button class="cb ' + (cls || "") + '" type=button data-a=' + a + ' data-id="' + esc(cur.id) + '">' + lab + '</button>';
  const acts = [btn("dry", "Dry run")];
  if (cur.status === "live") acts.push(btn("pause", "Pause", "pz"));
  if (["draft", "paused"].includes(cur.status)) acts.push(owner ? btn(cur.status === "paused" ? "resume" : "live", cur.status === "paused" ? "Resume (Kendall)" : "Approve live (Kendall)", "go") : btn("request_live", cur.live_requested ? "Asked Kendall" : "Ask Kendall to go live", "go"));
  const top = '<div class=cc id="camp_' + esc(cur.id) + '"><div class=ch><b>' + esc(cur.name || cur.id) + '</b><span class=cs style="background:' + st[1] + '">' + st[0] + '</span></div>'
    + '<p class=cm>' + esc(cur.template) + ' · ' + (cur.phone === "main" ? "main number" : "desk number") + ' · ' + esc(cur.window) + ' Dubai · cap ' + cur.cap + '/day · ' + esc((cur.tags || []).join(", ")) + '</p>'
    + (cur.stopped && cur.stopped.why ? '<p class=cw>Stopped: ' + esc(cur.stopped.why) + '</p>' : "") + (cur.live_requested && cur.status !== "live" ? '<p class=cm>Go-live asked ' + esc(cur.live_requested.at.slice(0, 16).replace("T", " ")) + ' UTC, waiting for Kendall.</p>' : "")
    + '<div class=cba>' + acts.join("") + '</div><p class=cr id="res_' + esc(cur.id) + '"></p></div>';
  const funnel = svgFunnel([["Sent", S.sent], ["Delivered", S.delivered], ["Read", S.read], ["Replied", S.replies], ["Clicked", S.uclicks], ["To Najjuko", S.handovers || 0]]);
  // branch donut: the opener's options by their titles, plus opt-outs as "Stopped"
  let parts = [];
  if (cur.flow) { const f = await getJ(env, "camp_flow_" + cur.flow, null); const n0 = f && f.nodes[f.start];
    if (n0) parts = (n0.buttons || []).filter((b) => !b.optout).map((b) => [b.title, (S.branch || {})[f.start + "." + b.id] || 0]); parts.push(["Stopped", S.optouts]); }
  const days = lastDays(now, 14);
  const daily = svgDaily(days, days.map((d) => S.day[d] || 0), days.map((d) => (S.rday || {})[d] || 0), cur.cap);
  const rl = svgRate(days, days.map((d) => { const n = S.day[d] || 0; return n ? (((S.oday || {})[d] || 0) + ((S.bday || {})[d] || 0)) / n : 0; }));
  const byUrl = {}; for (const code of (await getJ(env, "camp_links_" + cur.id, [])).slice(-2000)) { const L = await getJ(env, "camp_link_" + code, null); if (!L) continue; const u = byUrl[L.url] || (byUrl[L.url] = [L.url, 0, 0]); u[1] += L.clicks || 0; if (L.clicks) u[2]++; }
  const clicks = svgClicks(Object.values(byUrl).sort((a, b) => b[1] - a[1]).slice(0, 8));
  const seen = new Set(), people = [];
  for (const w of (await getJ(env, "camp_msgs_" + cur.id, [])).slice(-300).reverse()) { const m = await getJ(env, "camp_msg_" + w, null); if (!m || seen.has(m.d)) continue; seen.add(m.d);
    const k = await getJ(env, "camp_contact_" + m.d, null) || {}, s2 = await getJ(env, "camp_state_" + cur.id + "_" + m.d, null), oo = await env.MEETINGS.get("camp_optout_" + m.d);
    const status = oo ? "Opted out" : m.st === "failed" ? "Failed" : (s2 && s2.path && s2.path.length) || m.replied ? "Replied" : m.read ? "Read" : m.delivered ? "Delivered" : "Sent";
    const br = s2 && s2.path && s2.path.length ? s2.path[s2.path.length - 1] : "-", cu = updatesConsent(k);
    people.push('<div class=pc data-s="' + esc(((k.name || "") + " " + DIG(k.e164 || m.d).slice(-4)).toLowerCase()) + '"><div class=ph><b>' + esc(k.name || "Unknown") + '</b><span class="pst s_' + status.replace(/\s/g, "") + '">' + status + '</span></div>'
      + '<div class=pg><div><i>Number</i>' + esc(maskNum(k.e164 || m.d)) + '</div><div><i>Branch</i>' + esc(br) + '</div><div><i>Last activity</i>' + esc(String((s2 && s2.at) || m.at || "").slice(0, 16).replace("T", " ")) + '</div><div><i>Updates consent</i>' + (cu === true ? "Yes" : cu === false ? "No" : "Not asked") + '</div></div>'
      + (oo ? "" : '<button class="cb fu" type=button data-a=followup data-id="' + esc(cur.id) + '" data-w="' + esc(w) + '">Follow up</button>') + '</div>'); }
  const card = (t, b) => '<div class=gc><h2>' + t + '</h2>' + b + '</div>';
  return '<a class=back href="/momo' + q + '">&#8592; Momo</a><div class=tag>MOMO</div><h1>Campaigns</h1>' + head + pick + top
    + card("Funnel", funnel) + (cur.flow ? card("Branch choices", svgDonut(parts)) : "") + card("Daily sends and replies", daily) + card("Opt-out and block rate", rl) + card("Clicks per link", clicks)
    + card("People (" + people.length + ")", '<input id=psearch class=srch type=search placeholder="Search name or last 4 digits">' + (people.length ? '<div class=pl>' + people.join("") + '</div>' : '<p class=nd>Nobody messaged yet.</p>'))
    + DASH_CSS + '<script>(function(){var K=new URLSearchParams(location.search).get("key")||"";var sr=document.getElementById("psearch");if(sr)sr.oninput=function(){var v=sr.value.toLowerCase().trim();document.querySelectorAll(".pc").forEach(function(c){c.style.display=!v||c.dataset.s.indexOf(v)>=0?"":"none"})};'
    + 'document.querySelectorAll(".cb").forEach(function(b){b.onclick=function(){var a=b.dataset.a,id=b.dataset.id,o=document.getElementById("res_"+id);var body={action:a,id:id};if(a==="pause"&&!confirm("Pause this campaign?"))return;if(a==="live"){var c=prompt("Type the campaign id to approve it going live: "+id);if(c!==id)return;body.confirm=c}if(a==="followup")body.w=b.dataset.w;b.disabled=true;'
    + 'fetch("/momo/campaigns/api?key="+encodeURIComponent(K),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}).then(function(r){return r.json()}).then(function(j){b.disabled=false;if(a==="dry"){var x=j.result||{};o.textContent=j.ok?("Dry run: "+(x.would||[]).length+" would go now"+(x.window?"":" (outside the send window, live would wait)")+(x.note?" - "+x.note:"")+(x.stop?" - would stop: "+x.stop:"")+". Nothing was sent."):String(j.error)}else if(a==="followup"){b.textContent=j.ok?"Flagged for follow-up":"Not saved"}else if(j.ok)location.reload();else if(o)o.textContent=String(j.error)}).catch(function(){b.disabled=false;if(o)o.textContent="Network error"})}})})()</script>';
}
const DASH_CSS = '<style>.hg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-bottom:12px}.hc{border:1px solid ' + GOLD + ';background:' + TEAL + ';color:#fff;border-radius:14px;padding:12px;min-width:0}.hc b{display:block;font:600 1.4rem Fraunces,serif}.hc i{font:500 .72rem "IBM Plex Sans",sans-serif;font-style:normal;color:#E8DCC0}'
  + '.pk{display:flex;gap:6px;overflow-x:auto;margin-bottom:10px}.pkc{border:1px solid ' + GOLD + ';border-radius:999px;padding:6px 12px;color:' + TEAL + ';text-decoration:none;font-size:.8rem;white-space:nowrap}.pkc.on{background:' + TEAL + ';color:#fff}'
  + '.cc,.gc{border:1px solid ' + LINE + ';background:#FFFDF9;border-radius:14px;padding:12px;box-sizing:border-box;min-width:0;margin-bottom:12px}.gc h2{font:600 1rem Fraunces,serif;color:' + TEAL + ';margin:0 0 8px}.ch{display:flex;justify-content:space-between;align-items:center;gap:8px}.ch b{font:600 1.05rem Fraunces,serif;color:' + TEAL + ';overflow-wrap:anywhere}.cs{color:#fff;border-radius:999px;padding:3px 10px;font:600 .68rem "IBM Plex Mono",monospace;white-space:nowrap}'
  + '.cm{margin:4px 0 8px;font-size:.76rem;color:' + MUTE + ';overflow-wrap:anywhere}.cw{margin:0 0 8px;font-size:.8rem;color:' + RED + ';font-weight:600}.cba{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}.cb{border:1px solid ' + TEAL + ';color:' + TEAL + ';background:#fff;border-radius:999px;padding:10px 12px;font:600 .85rem "IBM Plex Sans",sans-serif;cursor:pointer}.cb.pz{background:#8A6F3E;border-color:#8A6F3E;color:#fff}.cb.go{background:' + TEAL + ';color:#fff}.cr{font-size:.75rem;color:' + MUTE + ';margin:6px 0 0;overflow-wrap:anywhere}'
  + '.dn{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.lgs{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1}.lgs2{display:flex;gap:12px;margin-top:4px}.lg{font-size:.78rem;color:' + INK + ';display:flex;align-items:center;gap:6px}.lg span{width:10px;height:10px;border-radius:3px;display:inline-block}.lg em{color:' + MUTE + ';font-style:normal}.nd{color:' + MUTE + ';font-size:.85rem;margin:0}'
  + '.srch{width:100%;box-sizing:border-box;border:1px solid ' + LINE + ';border-radius:999px;padding:10px 14px;font:inherit;margin-bottom:10px}.pl{display:flex;flex-direction:column;gap:8px}.pc{border:1px solid ' + LINE + ';border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:8px}.ph{display:flex;justify-content:space-between;gap:8px;align-items:center}.ph b{color:' + TEAL + ';overflow-wrap:anywhere}'
  + '.pst{font:600 .66rem "IBM Plex Mono",monospace;border-radius:999px;padding:2px 8px;border:1px solid ' + GOLD + ';color:#8A6F3E;white-space:nowrap}.s_Optedout,.s_Failed{border-color:' + RED + ';color:' + RED + '}.s_Replied{background:' + TEAL + ';color:#fff;border-color:' + TEAL + '}.pg{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;font-size:.8rem}.pg i{display:block;font-style:normal;font-size:.66rem;color:#8A6F3E;font-weight:600}.cb.fu{padding:8px}'
  + '.empty{display:flex;flex-direction:column;align-items:center;gap:6px;padding:34px 18px;border:1px dashed ' + GOLD + ';border-radius:18px;text-align:center;color:' + MUTE + '}.empty p{margin:0}</style>';

// ---------- FLOWS (v723, 3 Nov: the Palm Jebel Ali owners campaign is a small decision tree) ----------
// A flow is DATA in KV (camp_flow_<id>), so a new flow needs no code change. Shape:
//   { id, start, freq_days?, followup?: { after_hours, node }, nodes: { <nodeId>: node } }
// Node types:
//   template  the opening (or follow-up) template; buttons[] map its quick replies BY INDEX: {id, title, next?, consent?, optout?}
//   buttons   interactive reply buttons (max 3, titles max 20 chars): {text, buttons:[{id, title, next?, consent?:{topic, value}, optout?}]}
//   list      interactive list (max 10 rows, titles max 24): {text, button, rows:[{id, title, description?, next?, consent?}]}
//   text      {text, next?}
//   doc       {text, link (https; sent as a tracked /c/ link), next?}
//   brief     {text, brief: <slug>, next?} sends the tracked link to /cb/<slug>, the one-page brief built from captured developer data
//   handover  {text?, note, next?} records a human handover for the agent (camp_handover_index); never commits anything, never messages her
//   end       {text?}
// Text may use {first} {name} {company}. Free-form nodes only go out right after the person tapped (their 24-hour window is open).
// Interactive reply ids are cf:<campaign>:<node>:<index>; template quick replies carry camp:<campaign>:<index> (see buildPayload).
const NODE_TYPES = ["template", "buttons", "list", "text", "doc", "brief", "handover", "end"];
export function cleanFlow(x) {
  const err = [], f = { id: String((x && x.id) || ""), start: String((x && x.start) || ""), nodes: {} };
  if (!ID_RE.test(f.id)) err.push("flow id: lowercase letters, digits and dashes");
  if (x && /^[a-z0-9-]{1,40}$/.test(String(x.facts || ""))) f.facts = String(x.facts);
  if (x && Number(x.freq_days) > 0) f.freq_days = Math.min(60, Math.round(Number(x.freq_days)));
  if (x && x.stop_forgets) f.stop_forgets = true;
  if (x && x.send_card != null) f.send_card = x.send_card !== false;   // v771 - Najjuko's broker card after engagement (default on when absent)   // v726 - Stop deletes the person's details (the template promises it)
  if (x && /^(main|desk)$/.test(String(x.phone || ""))) f.phone = String(x.phone);
  if (x && x.followup && x.followup.node) f.followup = { after_hours: Math.max(12, Math.min(24 * 14, Number(x.followup.after_hours) || 72)), node: String(x.followup.node) };
  const N = (x && x.nodes) || {};
  for (const id of Object.keys(N)) {
    const n = N[id] || {}; if (!/^[a-z0-9_-]{1,24}$/.test(id)) { err.push("node id " + id); continue; }
    if (!NODE_TYPES.includes(n.type)) { err.push(id + ": type " + n.type); continue; }
    const o = { type: n.type };
    for (const k of ["text", "note", "template", "lang", "button", "next", "brief", "body", "reader", "image"]) if (n[k] != null) o[k] = String(n[k]).slice(0, k === "text" || k === "body" ? 1024 : 200);
    if (n.vars) o.vars = n.vars.map(String);
    if (n.header) o.header = n.header;
    if (n.link) { o.link = cleanTarget(n.link); if (!o.link) err.push(id + ": link must be https"); }
    if (n.type === "brief" && !/^[a-z0-9-]{1,60}$/.test(String(n.brief || ""))) err.push(id + ": brief slug");
    const opts = n.type === "list" ? n.rows : n.buttons;
    if (opts) {
      const max = n.type === "list" ? 10 : n.type === "buttons" ? 3 : 10, tl = n.type === "list" ? 24 : 20;
      if (opts.length > max) err.push(id + ": at most " + max + " options");
      o[n.type === "list" ? "rows" : "buttons"] = opts.map((b, i) => {
        const r = { id: String(b.id || i), title: String(b.title || "") };
        if (!r.title || (n.type !== "template" && r.title.length > tl)) err.push(id + ": option " + r.id + " title 1-" + tl + " chars");
        if (b.description) r.description = String(b.description).slice(0, 72);
        if (b.next) r.next = String(b.next);
        if (b.optout) r.optout = true;
        if (b.consent && b.consent.topic) r.consent = { topic: cleanTag(b.consent.topic), value: !!b.consent.value };
        return r;
      });
    }
    if (n.type === "template" && !o.template) err.push(id + ": template name");
    if (n.type === "template" && !o.lang) err.push(id + ": template lang");
    if ((n.type === "buttons" || n.type === "list") && !(opts && opts.length)) err.push(id + ": needs options");
    if (["buttons", "list", "text", "doc", "brief"].includes(n.type) && !o.text) err.push(id + ": needs text");
    f.nodes[id] = o;
  }
  if (!f.nodes[f.start] || f.nodes[f.start].type !== "template") err.push("start must be a template node");
  if (f.followup && (!f.nodes[f.followup.node] || f.nodes[f.followup.node].type !== "template")) err.push("followup.node must be a template node (no reply means the window is shut)");
  for (const [id, n] of Object.entries(f.nodes)) for (const nx of [n.next].concat((n.buttons || n.rows || []).map((b) => b.next))) if (nx && !f.nodes[nx]) err.push(id + ": next " + nx + " does not exist");
  return { f, err };
}
export const factText = (facts, key) => { const f = facts && facts[key]; const v = f && typeof f === "object" && "value" in f ? f.value : f; return v == null || v === "" || typeof v === "object" ? TBC : String(v); };
const fill = (t, k, facts) => String(t || "").replace(/\{first\}/g, firstName(k.name)).replace(/\{name\}/g, k.name || "there").replace(/\{company\}/g, k.company || "your company").replace(/\{\{1\}\}/g, firstName(k.name)).replace(/\{fact:([a-z0-9_]+)\}/g, (m, key) => factText(facts, key));
// v774c (Kendall 5 Nov: "the web address is really long") - SHORT_LINK_BASE (e.g. https://najma.digitalabbot.io) maps /<code> to /p/<code>; unset = the worker address
const passLink = (env, deps, pc) => env.SHORT_LINK_BASE ? String(env.SHORT_LINK_BASE).replace(/\/+$/, "") + "/" + pc : originOf(env, deps) + "/p/" + pc;
const originOf = (env, deps) => String(env.PUBLIC_ORIGIN || (deps && deps.origin) || "https://azimuth-2.digitalchemy.workers.dev").replace(/\/+$/, "");
// The payload for one free-form node (no send): what flowRun posts and what the simulator returns.
export function nodePayload(cid, nid, n, k, linkUrl, facts, pfx) {
  pfx = pfx || "cf"; const head = pfx === "pv" ? "TEST PREVIEW\n\n" : "";
  const to = DIG(k.e164);
  if (n.type === "buttons") return { messaging_product: "whatsapp", to, type: "interactive", interactive: { type: "button", body: { text: head + fill(n.text, k, facts) },
    action: { buttons: n.buttons.map((b, i) => ({ type: "reply", reply: { id: pfx + ":" + cid + ":" + nid + ":" + i, title: b.title } })) } } };
  if (n.type === "list") return { messaging_product: "whatsapp", to, type: "interactive", interactive: { type: "list", body: { text: head + fill(n.text, k, facts) },
    action: { button: (n.button || "Choose").slice(0, 20), sections: [{ title: "Options", rows: n.rows.map((r, i) => Object.assign({ id: pfx + ":" + cid + ":" + nid + ":" + i, title: r.title }, r.description ? { description: r.description } : {})) }] } } };
  if (n.type === "doc" || n.type === "brief") return { messaging_product: "whatsapp", to, type: "text", text: { body: head + fill(n.text, k, facts) + "\n" + (linkUrl || n.link || ("/cb/" + n.brief)), preview_url: true } };
  if ((n.type === "text" || n.type === "end" || n.type === "handover") && n.text) return { messaging_product: "whatsapp", to, type: "text", text: { body: head + fill(n.text, k, facts) } };
  return null;
}
// Walk from node nid: send it, and keep going through nodes with no options (text/doc/brief/handover), at most 6 steps.
async function flowRun(env, c, f, nid, k, deps, now, trail) {
  const facts = f.facts ? await getJ(env, "camp_facts_" + f.facts, {}) : {};
  const f2 = (deps && deps.fetch) || fetch, graph = (deps && deps.graph) || "https://graph.facebook.com/v21.0", pid = phoneIdOf(env, c), d = DIG(k.e164);
  for (let step = 0; nid && step < 6; step++) {
    const n = f.nodes[nid]; if (!n || n.type === "template") break;
    if (n.type === "handover") {
      const st = await getJ(env, "camp_state_" + c.id + "_" + d, { path: [] });
      const h = { cid: c.id, d, name: k.name || "", e164: k.e164, node: nid, note: n.note || "", path: st.path || [], at: new Date(now).toISOString(), status: "open" };
      const ix = await getJ(env, "camp_handover_index", []); ix.unshift(h); await putJ(env, "camp_handover_index", ix.slice(0, 500));
      await bump(env, c.id, (x) => { x.handovers = (x.handovers || 0) + 1; });
      trail.push({ handover: nid });
    }
    let link = "";
    if (n.type === "doc" || n.type === "brief") { const target = n.type === "brief" ? originOf(env, deps) + "/dp/" + n.brief + "?r=" + dpReader(n.reader) + "&ty=1" : n.link; const code = await makeLink(env, c.id, d, target); link = originOf(env, deps) + "/c/" + code; }   // v771 - the district passport
    let payload = nodePayload(c.id, nid, n, k, link, facts);
    let fallback = null, fallback2 = null;
    if (payload && n.type === "brief" && DP_SETS[n.brief]) {   // v774 (Kendall 5 Nov) - the stored illustration as a picture, "Thank you, <name>. Your <district> passport is ready:" and a short personal link
      const rd = dpReader(n.reader), one = n.brief === "palm-springs" || n.one === true, first = String(k.name || "").trim().split(/\s+/)[0] || "";
      const stp = await getJ(env, "camp_state_" + c.id + "_" + d, { path: [] }), last = (stp.path || []).slice(-1)[0] || "", [ln, lo] = last.split(".");
      const lopt = ln && f.nodes[ln] ? (f.nodes[ln].buttons || f.nodes[ln].rows || []).find((x) => String(x.id) === lo) : null;
      const pc = await docCreate(env, { cid: c.id, d, slug: n.brief, reader: rd, name: first, answer: lopt ? lopt.title : "", now });
      fallback = { messaging_product: "whatsapp", to: payload.to, type: "document", document: { link: originOf(env, deps) + "/dp/f/" + n.brief + "-" + rd + "-" + (one ? "one" : "full") + ".pdf", filename: dpFileName(n.brief, rd, one), caption: fill(n.text, k, facts) } };
      fallback2 = payload;
      payload = { messaging_product: "whatsapp", to: payload.to, type: "image", image: { link: originOf(env, deps) + "/dp/img/" + (n.image || (DP_SETS[n.brief] || {}).img), caption: docCaption(first, n.brief) + "\n" + passLink(env, deps, pc) } };
    }
    if (payload) {
      let ok = false, code = 0;
      try { const r = await f2(graph + "/" + pid + "/messages", { method: "POST", headers: { Authorization: "Bearer " + env.WHATSAPP_TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const j = await r.json().catch(() => ({})); ok = r.ok && !!(j.messages && j.messages[0]); code = Number(j.error && j.error.code) || 0; } catch (e) {}
      for (const fb of [fallback, fallback2]) {   // v774 - the picture + link did not go: the PDF document, then the plain link, so the owner is never left with nothing
        if (ok || !fb) continue;
        try { const r2 = await f2(graph + "/" + pid + "/messages", { method: "POST", headers: { Authorization: "Bearer " + env.WHATSAPP_TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(fb) });
          const j2 = await r2.json().catch(() => ({})); ok = r2.ok && !!(j2.messages && j2.messages[0]); trail.push({ fallback: fb.type, sent: ok }); } catch (e) {}
      }
      if (ok && fallback) await bump(env, c.id, (x) => { x.passports = (x.passports || 0) + 1; });
      trail.push({ node: nid, sent: ok, code: code || undefined });
    }
    if (n.type === "brief") { await sendCard(env, c, f, k, deps, now, trail, f2, graph, pid); await followTask(env, c, f, k, { opened: (DP_SETS[n.brief] || {}).name || n.brief, reader: dpReader(n.reader) }, now); }
    if (n.buttons || n.rows) break;   // wait for the tap
    nid = n.next;
  }
}
// v771 (Kendall 5 Nov) - after an owner ENGAGES, Najjuko's real broker card (the saved image, unaltered) with one line. Once per person per campaign,
// never in the cold opener, off when the flow says send_card:false, off after the card expires.
async function sendCard(env, c, f, k, deps, now, trail, f2, graph, pid) {
  if (f.send_card === false || now > Date.parse(NAJ_BRN_EXPIRES + "T23:59:59+04:00")) return;
  const d = DIG(k.e164), sk = "camp_cardsent_" + c.id + "_" + d; if (await env.MEETINGS.get(sk)) return;
  if (!(await env.MEETINGS.get("dp_img_card_najjuko_meta"))) return;
  const payload = { messaging_product: "whatsapp", to: d, type: "image", image: { link: originOf(env, deps) + "/dp/img/card.jpg", caption: "My broker card: BRN " + NAJ_BRN + ", Faez Noorzad Real Estate. You can check it with the QR code on the card. Najjuko" } };
  let ok = false; try { const r = await f2(graph + "/" + pid + "/messages", { method: "POST", headers: { Authorization: "Bearer " + env.WHATSAPP_TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const j = await r.json().catch(() => ({})); ok = r.ok && !!(j.messages && j.messages[0]); } catch (e) {}
  if (ok) await env.MEETINGS.put(sk, new Date(now).toISOString()); trail.push({ card: ok });
}
// v774 - /p/<code> was opened: the follow-up says so (time and how many opens)
export async function dpOpened(env, rec) {
  if (!rec || !rec.cid || !rec.d) return;
  const c = await getJ(env, "camp_" + rec.cid, null), k = await getJ(env, "camp_contact_" + rec.d, null); if (!c || !k || !c.flow) return;
  const f = await getJ(env, "camp_flow_" + c.flow, null); if (!f) return;
  await followTask(env, c, f, k, { opened: (DP_SETS[rec.slug] || {}).name + " passport, opened " + rec.opens + (rec.opens === 1 ? " time" : " times") + ", last " + String(rec.last_open).slice(11, 16) + " UTC", reader: rec.reader }, Date.now());
  await bump(env, c.id, (x) => { x.passport_opens = (x.passport_opens || 0) + 1; });
}
// v771 - every engaged owner becomes ONE follow-up for Najjuko: the campaign handover list (People "Follow up", the "To Najjuko" row) AND a task in her Work.
// Keyed by campaign + contact, so later taps update the same task instead of adding new ones.
export async function followTask(env, c, f, k, info, now) {
  const d = DIG(k.e164), st = await getJ(env, "camp_state_" + c.id + "_" + d, { path: [] }), at = new Date(now).toISOString();
  const ans = (st.path || []).map((t) => { const [nid, oid] = t.split("."); const n = f.nodes[nid]; const o = n && (n.buttons || n.rows || []).find((x) => String(x.id) === oid); return o ? o.title : ""; }).filter(Boolean);
  const who = (k.name || "Owner") + " (+971 \u2022\u2022\u2022 " + d.slice(-4) + ")", camp = c.name || c.id;
  const ix = await getJ(env, "camp_handover_index", []), i = ix.findIndex((x) => x.kind === "follow_up" && x.cid === c.id && x.d === d);
  const h = Object.assign(i >= 0 ? ix[i] : { kind: "follow_up", cid: c.id, d, name: k.name || "", e164: k.e164, at, by: "flow", status: "open" }, { answers: ans, opened: info.opened || "", reader: info.reader || "", updated: at });
  if (i >= 0) ix[i] = h; else ix.unshift(h); await putJ(env, "camp_handover_index", ix.slice(0, 500));
  const tk = "camp_task_" + c.id + "_" + d; let key = await env.MEETINGS.get(tk); const day = new Date(now + 4 * 3600000).toISOString().slice(0, 10);
  if (!key) { key = "work_naj_" + day + "_cf" + (c.id + d).replace(/[^a-z0-9]/gi, "").slice(-16); await env.MEETINGS.put(tk, key); }
  const prev = await getJ(env, key, null), name = "Call " + who + ", " + camp;
  const text = "Follow up from the " + camp + " campaign. Answers: " + (ans.join(" \u2192 ") || "none yet") + (info.opened ? ". Opened: " + info.opened + " (" + info.reader + ")" : "") + ". Call today or next working day.";
  const e = Object.assign(prev || { id: key.slice(key.lastIndexOf("_") + 1), date: day, created: at, kpis: [], people: [k.name || ""], in_scope: true, check: false, link: "" }, { text, works: [name], progress: [{ work: name, status: (prev && prev.progress && prev.progress[0] && prev.progress[0].status) || "Started", percent: (prev && prev.progress && prev.progress[0] && prev.progress[0].percent) || 0 }], source: "campaign", campaign: c.id, contact_last4: d.slice(-4), updated: at });
  await putJ(env, key, e); return { key, name };
}
// A tap on a campaign button: record the branch (and the consent, per branch), then send the next node.
export async function flowChoice(env, msg, d, deps, now) {
  let cid = "", nid = "", idx = -1, m;
  const pay = msg.type === "button" ? String((msg.button && msg.button.payload) || "") : "";
  const rid = msg.type === "interactive" && msg.interactive ? String(((msg.interactive.button_reply || msg.interactive.list_reply) || {}).id || "") : "";
  if ((m = /^camp:([a-z0-9-]+):(\d+)$/.exec(pay))) { cid = m[1]; idx = +m[2]; }
  else if ((m = /^cf:([a-z0-9-]+):([a-z0-9_-]+):(\d+)$/.exec(rid))) { cid = m[1]; nid = m[2]; idx = +m[3]; }
  else return null;
  const c = await getJ(env, "camp_" + cid, null); if (!c || !c.flow || c.status === "draft" || env.CAMPAIGNS_OFF === "1") return null;
  const f = await getJ(env, "camp_flow_" + c.flow, null); if (!f) return null;
  const k = await getJ(env, "camp_contact_" + d, null); if (!k) return null;
  const sk = "camp_state_" + cid + "_" + d, st = await getJ(env, sk, { path: [] });
  if (!nid) nid = st.followed_node || f.start;   // a template tap: the opener, or the follow-up template when that was the last one sent
  const n = f.nodes[nid], opt = n && (n.buttons || n.rows || [])[idx]; if (!opt) return null;
  const tag = nid + "." + opt.id;
  if ((st.path || []).includes(tag)) return { cid, choice: tag, repeat: true };   // a double tap or a webhook retry
  st.path = (st.path || []).concat([tag]); st.node = opt.next || nid; st.at = new Date(now).toISOString(); await putJ(env, sk, st);
  await bump(env, cid, (x) => { x.branch = x.branch || {}; x.branch[tag] = (x.branch[tag] || 0) + 1; });
  if (opt.consent) {
    k.consents = k.consents || {};
    k.consents[opt.consent.topic] = { value: opt.consent.value, at: new Date(now).toISOString(), cid, node: nid, choice: opt.id, wording: n.text || n.template || "" };
    await putJ(env, "camp_contact_" + d, k);
    const cl = await getJ(env, "camp_consentlog_" + d, []); cl.push(Object.assign({ topic: opt.consent.topic }, k.consents[opt.consent.topic])); await putJ(env, "camp_consentlog_" + d, cl.slice(-50));
  }
  if (opt.optout) { await optOut(env, d, "flow_button", { cid, choice: tag }, now); return { cid, choice: tag, optout: true }; }
  const trail = []; if (opt.next) await flowRun(env, c, f, opt.next, k, deps, now, trail);
  if (!trail.some((t) => t.node && f.nodes[t.node] && f.nodes[t.node].type === "brief") && !/^(d1|endok|nudge)/.test(nid + "") && !/not ?now|no thanks/i.test(opt.title || "")) await followTask(env, c, f, k, {}, now);   // v771
  return { cid, choice: tag, trail };
}
// The ONE follow-up to a non-replier (a TEMPLATE: their window is shut). Never more than one per person per campaign.
export async function flowFollowups(env, c, deps) {
  const now = (deps && deps.now) || Date.now(), r = { id: c.id, followups: 0, skipped: {} };
  const f = await getJ(env, "camp_flow_" + c.flow, null); if (!f || !f.followup || !inWindow(c, now) || env.CAMPAIGNS_OFF === "1") return r;
  const n = f.nodes[f.followup.node], after = f.followup.after_hours * 3600000;
  const ids = await getJ(env, "camp_msgs_" + c.id, []), cur = await getJ(env, "camp_fupos_" + c.id, 0);
  const s24 = (await getJ(env, "camp_sent24", [])).filter((t) => now - t < DAY), shared = parseInt(env.CAMP_SHARED_CAP, 10) || DEFAULTS.shared;
  const S = Object.assign(blankStats(), await getJ(env, "camp_stats_" + c.id, {})), today = dubaiDate(now);
  const qual = await phoneQuality(env, c), rating = (qual && qual.rating) || "GREEN"; if (rating === "RED" || (c.status !== "live" && c.status !== "done")) return r;   // v726
  const bo = await getJ(env, "camp_backoff_" + c.id, null); if (bo && bo.until > now) return r;
  if (n && n.template) { const ts = await getJ(env, "camp_tpl_" + n.template, null); if (ts && (TPL_BLOCK.includes(ts.status) || ts.quality === "RED")) return r; }
  let dayCap = Math.min(c.cap || DEFAULTS.cap, rampLevel(c, S, today, rating).cap, shared); if (rating === "YELLOW") dayCap = Math.floor(dayCap / 2);
  let room = Math.min(c.batch || DEFAULTS.batch, dayCap - (S.day[today] || 0), shared - s24.length), i = cur, sent = 0, firstWait = -1;
  const fc = Object.assign({}, c, { template: n.template, lang: n.lang, vars: n.vars || [], header: n.header || null, qr: (n.buttons || []).length });
  const f2 = (deps && deps.fetch) || fetch, graph = (deps && deps.graph) || "https://graph.facebook.com/v21.0", pid = phoneIdOf(env, c);
  for (; i < ids.length && room > 0; i++) {
    const m = await getJ(env, "camp_msg_" + ids[i], null); if (!m || m.fu) continue;
    if (now - Date.parse(m.at) < after) break;   // the list is in send order: the rest are younger
    const st = await getJ(env, "camp_state_" + c.id + "_" + m.d, null);
    if (m.replied || m.optout || (st && st.path && st.path.length)) { r.skipped.replied = (r.skipped.replied || 0) + 1; continue; }
    if (await isOptedOut(env, m.d)) { r.skipped.opted_out = (r.skipped.opted_out || 0) + 1; continue; }
    if (!ownerOpen(c, m.d, now)) { r.skipped.owner_local_hours = (r.skipped.owner_local_hours || 0) + 1; if (firstWait < 0) firstWait = i; continue; }   // v726 - comes back next tick
    const k = await getJ(env, "camp_contact_" + m.d, null); if (!k || k.undeliverable) continue;
    m.fu = true; await putJ(env, "camp_msg_" + ids[i], m);   // marked BEFORE the send, so a retry can never make it two
    let j = {}, ok = false;
    try { const res = await f2(graph + "/" + pid + "/messages", { method: "POST", headers: { Authorization: "Bearer " + env.WHATSAPP_TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(buildPayload(fc, k, "")) }); j = await res.json().catch(() => ({})); ok = res.ok && !!(j.messages && j.messages[0]); } catch (e) {}
    if (ok) {
      const w = j.messages[0].id; room--; sent++; s24.push(now);
      await putJ(env, "camp_msg_" + w, { cid: c.id, d: m.d, at: new Date(now).toISOString(), st: "sent", fu: true, followup: true });
      await statusRow(env, w, { cid: c.id, d: m.d, sent: new Date(now).toISOString(), followup: true });
      await putJ(env, "camp_state_" + c.id + "_" + m.d, Object.assign(st || { path: [] }, { node: f.followup.node, followed_node: f.followup.node }));
      k.last_mkt = new Date(now).toISOString(); k.last_wamid = w; await putJ(env, "camp_contact_" + m.d, k);
      const L = await getJ(env, "camp_msgs_" + c.id, []); L.push(w); await putJ(env, "camp_msgs_" + c.id, L);
    }
  }
  await putJ(env, "camp_fupos_" + c.id, firstWait >= 0 ? Math.min(i, firstWait) : i); await putJ(env, "camp_sent24", s24);
  if (sent) await bump(env, c.id, (x) => { x.sent += sent; x.followups = (x.followups || 0) + sent; x.day[today] = (x.day[today] || 0) + sent; });
  r.followups = sent; return r;
}
// Dry walk of a flow for a list of choices (option ids). No KV, no Meta: exactly the payloads that would go out.
export function simulateFlow(f, choices, k) {
  const out = []; let nid = f.start, ci = 0;
  for (let step = 0; nid && step < 30; step++) {
    const n = f.nodes[nid]; if (!n) break;
    if (n.type === "template") out.push({ node: nid, template: n.template, buttons: (n.buttons || []).map((b) => b.title) });
    else out.push({ node: nid, type: n.type, payload: nodePayload("sim", nid, n, k, "", k.facts), handover: n.type === "handover" ? n.note : undefined });
    const opts = n.buttons || n.rows;
    if (opts) {
      const o = opts.find((b) => b.id === choices[ci]); ci++;
      if (!o) { out.push({ waiting_for: opts.map((b) => b.id) }); break; }
      out.push({ chose: nid + "." + o.id, consent: o.consent, optout: o.optout || undefined }); if (o.optout) break; nid = o.next;
    } else nid = n.next;
  }
  return out;
}

// ---------- PROJECT BRIEFS (/cb/<slug>) ----------
// Built from the developer-availability group capture by scripts/build_camp_brief.py and stored as camp_brief_<slug>:
//   {slug, project, developer, location, price, payment_plan, handover, unit_types, unit_sizes, highlights[], nearby[], images[], caveat, source{file, captured_at}}
// Every field the capture did not state is the literal "to confirm"; the page never fills a gap with a figure.
export const TBC = "to confirm";
const BRIEF_ROWS = [["developer", "Developer"], ["developer_register", "Developer (DLD register)"], ["location", "Location"], ["homes", "Homes"], ["units_register", "Units (DLD register)"],
  ["price", "Price"], ["price_list", "Price list"], ["compare_pja", "Against Palm Jebel Ali"], ["payment_plan", "Payment plan"], ["handover", "Handover"], ["unit_types", "Unit types"],
  ["unit_types_brochure", "Unit types (brochure)"], ["unit_sizes", "Unit sizes"], ["dld_register", "DLD register"], ["highlights", "Highlights"], ["nearby", "Nearby"]];
export async function briefRoute(request, env, url) {
  const m = url.pathname.match(/^\/cb\/([a-z0-9-]{1,60})\/?$/); if (!m) return null;
  const b = await getJ(env, "camp_brief_" + m[1], null); if (!b) return new Response("not found", { status: 404 });
  const v = (x) => { const y = x && typeof x === "object" && !Array.isArray(x) && "value" in x ? x.value : x;
    return (y == null || y === "" || (Array.isArray(y) && !y.length)) ? TBC : Array.isArray(y) ? y.map((e) => typeof e === "object" ? Object.values(e).join(" ") : e).join(", ") : String(y); };
  const srcOf = (x) => x && typeof x === "object" && !Array.isArray(x) && x.source ? x.source + (x.as_of ? ", " + x.as_of : "") : "";
  const row = (key, lab) => { if (!(key in b) && !["developer", "price", "payment_plan", "handover", "unit_types"].includes(key)) return ""; const t = v(b[key]), sc = srcOf(b[key]);
    return '<div class=bc><i>' + esc(lab) + '</i><b' + (t === TBC ? ' class=tbc' : "") + '>' + esc(t) + '</b>' + (sc ? '<em>' + esc(sc) + '</em>' : "") + '</div>'; };
  const imgs = (b.images || []).filter((u) => /^https:\/\//.test(u) || /^\/img\//.test(u)).slice(0, 4);
  const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(b.project || "Project brief") + '</title><meta name="robots" content="noindex">'
    + '<style>body{margin:0;background:#FAF7F1;color:#1C2321;font-family:"IBM Plex Sans",system-ui,sans-serif;padding:20px 16px 40px}.w{max-width:560px;margin:0 auto}.tag{font:600 .68rem "IBM Plex Mono",monospace;letter-spacing:.14em;color:#8A6F3E}h1{font-family:Fraunces,serif;color:#0A4F4A;margin:4px 0 2px;font-size:1.7rem}.sub{color:#5F6B66;margin:0 0 14px}'
    + '.g{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.bc{border:1px solid #E7E1D6;background:#FFFDF9;border-radius:14px;padding:10px;min-width:0}.bc i{display:block;font:600 .7rem "IBM Plex Sans",sans-serif;color:#8A6F3E;font-style:normal}.bc b{font-weight:600;overflow-wrap:anywhere}.bc b.tbc{color:#A33A2B;font-style:italic;font-weight:500}.bc em{display:block;font:400 .62rem "IBM Plex Mono",monospace;color:#5F6B66;font-style:normal;margin-top:4px;overflow-wrap:anywhere}'
    + 'img{width:100%;border-radius:12px;margin:10px 0 0}.cv{font-size:.75rem;color:#5F6B66;margin-top:14px}.ft{font-size:.78rem;color:#5F6B66;margin-top:18px;border-top:1px solid #E7E1D6;padding-top:10px}</style></head><body><div class=w>'
    + '<div class=tag>PROJECT BRIEF</div><h1>' + esc(b.project || TBC) + '</h1><p class=sub>' + esc(v(b.developer)) + ' · ' + esc(v(b.location)) + '</p><div class=g>'
    + BRIEF_ROWS.map((r) => row(r[0], r[1])).join("") + '</div>' + imgs.map((u) => '<img loading=lazy alt="" src="' + esc(u) + '">').join("")
    + '<p class=cv>' + esc(b.caveat || "Indicative information from the developer, subject to change and to official release.") + '</p>'
    + '<p class=ft>Curated by Najjuko · Dubai Decoded · WhatsApp +971 56 548 4397</p></div></body></html>';
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300", "X-Robots-Tag": "noindex" } });
}

// ---------- PREVIEW MODE (v724, Kendall 3 Nov: Najjuko walks the flow on her own phone and judges the wording) ----------
// She types "campaign preview" (or "preview pja", or "preview <flow id>") to the number she already talks to Azimuth on. No Meta template is
// approved yet, so everything goes as free-form interactive messages inside her open 24-hour window, each starting "TEST PREVIEW".
// Only WA_ALLOWED (Najjuko), WA_DESK_OWNER (Kendall) and CAMP_PREVIEW_NUMBERS can start it. It is logged in camp_preview_* ONLY: never in
// campaign stats, never in camp_sent24 (the shared cap), never an opt-out, never a handover. Without the keyword or a pv: button nothing changes.
// If the flow is not in KV the event is NOT consumed, so the instance behaves exactly as before.
const PV_KEY = /^(?:campaign\s+preview|preview\s+campaign|preview(?:\s+([a-z0-9-]{2,40}))?)$/i;
const PV_ALIAS = { pja: "pja-owners" };
const PV_NAME = "Ahmed";   // the sample owner name in the template examples; {{1}} becomes this in a preview
export const previewAllowed = (env, d) => [DIG(env.WA_ALLOWED), DIG(env.WA_DESK_OWNER)].concat(String(env.CAMP_PREVIEW_NUMBERS || "").split(",").map(DIG)).filter(Boolean).includes(DIG(d));
const shortTitle = (t, n) => { t = String(t || ""); if (t.length <= n) return t; const c = t.slice(0, n - 1); return c.slice(0, Math.max(c.lastIndexOf(" "), 8)) + "\u2026"; };
// a template node as an interactive message: buttons when it fits (3 options, 20 chars), otherwise a list (full wording in the description)
export function previewTemplatePayload(f, nid, to, facts) {
  const n = f.nodes[nid], opts = n.buttons || [], k = { name: PV_NAME };
  // v726 - {{2}}, {{3}} ... follow the node's vars: the reason line and the BRN show as clear samples in a preview
  const PV_VAR = { why: "you own a unit at Palm Jebel Ali (sample reason)", brn: NAJ_BRN };
  let bodyT = String(n.body || n.text || "(no draft wording stored for this template)");
  (n.vars || []).forEach((v, i) => { if (i > 0) bodyT = bodyT.split("{{" + (i + 1) + "}}").join(PV_VAR[v] || (v.charAt(0) === "=" ? v.slice(1) : "(" + v + ")")); });
  const text = "TEST PREVIEW (template " + n.template + ")\n\n" + fill(bodyT, k, facts);
  if (opts.length <= 3 && opts.every((b) => b.title.length <= 20)) return { messaging_product: "whatsapp", to, type: "interactive", interactive: { type: "button", body: { text }, action: { buttons: opts.map((b, i) => ({ type: "reply", reply: { id: "pv:" + f.id + ":" + nid + ":" + i, title: b.title } })) } } };
  // v732 - more than 3 answers cannot be buttons in a preview: say so, and name the list button plainly (owners see the template's own buttons)
  return { messaging_product: "whatsapp", to, type: "interactive", interactive: { type: "list", body: { text: text + "\n\nTap \"See the " + opts.length + " options\" below: owners get these as buttons." }, action: { button: "See the " + opts.length + " options", sections: [{ title: "Your options", rows: opts.map((b, i) => Object.assign({ id: "pv:" + f.id + ":" + nid + ":" + i, title: shortTitle(b.title, 24) }, b.title.length > 24 ? { description: b.title.slice(0, 72) } : {})) }] } } };
}
const pvControls = (f, to, note) => ({ messaging_product: "whatsapp", to, type: "interactive", interactive: { type: "button", body: { text: "TEST PREVIEW: end of this branch." + (note ? "\n\n" + note : "") + "\n\nTry another branch?" },
  action: { buttons: [{ type: "reply", reply: { id: "pv:" + f.id + ":__:0", title: "Start again" } }].concat(f.followup ? [{ type: "reply", reply: { id: "pv:" + f.id + ":__:2", title: "See the follow-up" } }] : []).concat([{ type: "reply", reply: { id: "pv:" + f.id + ":__:1", title: "End preview" } }]) } } });
async function pvSend(env, deps, payload, pid) {
  if (deps && typeof deps.post === "function") return deps.post(env, payload, pid);
  const graph = (deps && deps.graph) || "https://graph.facebook.com/v21.0";
  return ((deps && deps.fetch) || fetch)(graph + "/" + (pid || DIG(env.WA_PHONE_ID)) + "/messages", { method: "POST", headers: { Authorization: "Bearer " + env.WHATSAPP_TOKEN, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
}
async function pvLog(env, d, flow, what, now) {
  const L = await getJ(env, "camp_preview_log", []); L.unshift({ at: new Date(now).toISOString(), who: d.slice(-4), flow, what }); await putJ(env, "camp_preview_log", L.slice(0, 300));
}
export async function campPreview(env, body, deps) {
  if (env.CAMP_PREVIEW === "off") return null;
  const now = (deps && deps.now) || Date.now();
  const val = body && body.entry && body.entry[0] && body.entry[0].changes && body.entry[0].changes[0] && body.entry[0].changes[0].value;
  const msg = val && val.messages && val.messages[0]; if (!msg) return null;
  const d = DIG(msg.from); if (!previewAllowed(env, d)) return null;
  const pid = DIG(val.metadata && val.metadata.phone_number_id);
  let flowId = "", nid = "", idx = -1, m;
  const txt = msg.type === "text" ? String((msg.text && msg.text.body) || "").trim() : "";
  const rid = msg.type === "interactive" && msg.interactive ? String(((msg.interactive.button_reply || msg.interactive.list_reply) || {}).id || "") : "";
  if (txt && (m = PV_KEY.exec(txt))) flowId = m[1] ? (PV_ALIAS[m[1].toLowerCase()] || m[1].toLowerCase()) : String(env.CAMP_PREVIEW_FLOW || "pja-owners");
  else if ((m = /^pv:([a-z0-9-]+):([a-z0-9_-]+|__):(\d+)$/.exec(rid))) { flowId = m[1]; nid = m[2]; idx = +m[3]; }
  else return null;
  const f = await getJ(env, "camp_flow_" + flowId, null); if (!f) return null;   // no flow here: not ours, behave as before
  if (msg.id) { const sk = "camp_preview_seen_" + msg.id; if (await env.MEETINGS.get(sk)) return { consumed: true, repeat: true }; await env.MEETINGS.put(sk, "1", { expirationTtl: 3 * 86400 }); }
  const facts = f.facts ? await getJ(env, "camp_facts_" + f.facts, {}) : {};
  const sent = [], send = async (p) => { sent.push(p); try { await pvSend(env, deps, p, pid); } catch (e) {} };
  const k = { name: PV_NAME, e164: "+" + d };
  const stK = "camp_preview_" + d, st = await getJ(env, stK, { flow: flowId, path: [] });
  const start = async () => { await putJ(env, stK, { flow: flowId, path: [], at: new Date(now).toISOString() }); await send(previewTemplatePayload(f, f.start, d, facts)); await pvLog(env, d, flowId, "start", now); };
  if (!nid) { await start(); return { consumed: true, sent }; }
  if (nid === "__") {
    if (idx === 0) await start();
    else if (idx === 2 && f.followup) { await send(previewTemplatePayload(f, f.followup.node, d, facts)); await pvLog(env, d, flowId, "followup", now); }
    else { await send({ messaging_product: "whatsapp", to: d, type: "text", text: { body: "TEST PREVIEW ended. Type \"campaign preview\" to start again." } }); await pvLog(env, d, flowId, "end", now); }
    return { consumed: true, sent };
  }
  const n = f.nodes[nid], opt = n && (n.buttons || n.rows || [])[idx]; if (!opt) return { consumed: true, sent };
  st.path = (st.path || []).concat([nid + "." + opt.id]); st.at = new Date(now).toISOString(); await putJ(env, stK, st);
  await pvLog(env, d, flowId, nid + "." + opt.id, now);
  if (opt.consent) await send({ messaging_product: "whatsapp", to: d, type: "text", text: { body: "TEST PREVIEW: here the live campaign would record consent \"" + opt.consent.topic + "\" = " + (opt.consent.value ? "yes" : "no") + " (nothing recorded in a preview)." } });
  if (opt.optout || isOptOutText(opt.title)) { await send({ messaging_product: "whatsapp", to: d, type: "text", text: { body: "TEST PREVIEW (no opt-out recorded)\n\n" + OPTOUT_REPLY } }); await send(pvControls(f, d, "")); return { consumed: true, sent }; }
  let cur = opt.next;
  for (let step = 0; cur && step < 8; step++) {
    const x = f.nodes[cur]; if (!x) break;
    if (x.type === "template") { await send(previewTemplatePayload(f, cur, d, facts)); return { consumed: true, sent }; }
    const link = x.type === "brief" ? originOf(env, deps) + "/cb/" + x.brief : x.type === "doc" ? x.link : "";
    const p = nodePayload(f.id, cur, x, k, link, facts, "pv"); if (p) await send(p);
    if (x.type === "handover") await send({ messaging_product: "whatsapp", to: d, type: "text", text: { body: "TEST PREVIEW: in the live campaign this is handed to Najjuko: " + (x.note || "") + " (nothing recorded in a preview)." } });
    if (x.buttons || x.rows) return { consumed: true, sent };
    cur = x.next;
  }
  await send(pvControls(f, d, ""));
  return { consumed: true, sent };
}
