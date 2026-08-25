// meeting-capture — meetings (add/cancel via Outlook) + EMAIL ACTION-ITEM engine + reminders cron + /board visual page.
// v29 (17 Aug 2026) — GET /health?key= : last inbound, last SUCCESSFUL outbound, router result,
//   data counts, dependency reachability, and a ring of swallowed errors. Outbound sends are now
//   checked rather than fire-and-forget, so a Meta rejection is recorded instead of vanishing.
//   Every serious bug here has been "correct code that never ran, error swallowed" — this is the
//   instrument that makes that visible in one request.
// v28 (17 Aug 2026) — the board now renders meetings captured into KV, not only Outlook ones.
//   A mailbox-less instance was told "added" and then shown "No meetings in the next 7 days":
//   every captured meeting was written to evt_ and never read back. dedup() reconciles the two
//   sources so an instance with a calendar still renders each meeting once.
// v27 (17 Aug 2026) — send a PHOTO (invite screenshot, flyer, whiteboard) and Azimuth reads it
//   with Claude vision — one call, no OCR key — then shows what it found and files it only when
//   you tap Add. A photographed calendar is a weak input, so nothing is stored on a guess.
// v26 (17 Aug 2026) — fix: v25's upload branch sat inside the GET-only gate and never ran
//   (a POST fell through to the Telegram secret check → "unauthorized"). Hoisted above the gate.
// v25 (17 Aug 2026) — POST /setbg?key= with Content-Type: image/* uploads a backdrop directly,
//   so a personal photo never has to be published to a public host just to be fetched back.
// v24 (17 Aug 2026) — the board no longer claims Outlook/Telegram on instances that have
//   neither. Footer and plate hint are derived from MAILBOXES / TELEGRAM_TOKEN, so a
//   WhatsApp-only board says "captured from WhatsApp" and "tap a circle to clear".
// v23 (17 Aug 2026) — GET /setbg?key=&url=https://... stores a board backdrop directly (same
//   cfg_bg storage as the WhatsApp photo feature); ?clear=1 removes it. https + image/* + 4MB only.
// v22 (16 Aug 2026) — ROOT CAUSE FIX. Cloudflare error 1042: a Worker cannot fetch() another
//   Worker on the same account's workers.dev subdomain; the router's forward was rejected at the
//   platform level and swallowed by catch(e){}. WA_ROUTE_<digits> may now name a SERVICE BINDING
//   (env[name].fetch) — Cloudflare's sanctioned Worker->Worker call. A URL still works cross-account.
// v21 (16 Aug 2026) — /walog records now carry a "router" object: routeKey, destSet, tokenSet,
//   forwarded, fwdStatus/fwdBody or fwdErr. The router reports what it did — no inference.
// v20 (16 Aug 2026) — GET /walog?key= : shape of the last 10 /wa POSTs (bytes, hasMessages,
//   hasStatuses, from, msgType, phone_number_id) — content never stored. Ends the guessing.
// v19 (16 Aug 2026) — GET /lastdrop?key= : the sender digits + phone_number_id of the most
//   recent message the allow-list DROPPED (no content stored). Makes a router miss diagnosable.
// v18 (16 Aug 2026) — per-user board PHOTO via WhatsApp. Send a photo with the caption
//   "this is me" (or "my photo", "set as background"…) and it becomes /bg.jpg for THAT instance,
//   stored in its own KV (cfg_bg + cfg_bg_ct). Text/caption "clear my photo" removes it. A KV
//   photo takes precedence over the embedded founder portrait; BOARD_BG=off still 404s when no
//   photo is set. Zero operator config per user; isolation preserved (her KV, her Worker).
// v17 (16 Aug 2026) — sender-keyed inbound ROUTER for one-number / many-instance operation.
//   Meta delivers every message for a phone number to ONE webhook. The router lets that Worker
//   forward a recognised sender's RAW webhook body to another instance instead of handling it:
//     router side:   WA_ROUTE_<digits> = https://<other>.workers.dev/wa   +   WA_FORWARD_TOKEN
//     receiver side: WA_FORWARD_TOKEN (same value)  — accepted in place of the Meta signature
//   Forward happens AFTER signature verification (never relay a forgery) and BEFORE the
//   idempotency marker (the marker belongs to the receiving instance's KV). A forwarded body is
//   never re-forwarded, so no loops. Replies still go out via the receiver's own WHATSAPP_TOKEN
//   / WA_PHONE_ID — which, for a shared number, are the SAME credentials on both instances.
//   Data isolation is preserved (separate KV); path isolation is not (messages transit the
//   router). Set nothing and the router is inert — v16 behaviour exactly.
// v16 (16 Aug 2026) — ONE file, multiple instances. MAILBOXES / ADD_TO / BOARD_BG are now
//   read from Worker vars with the original values as defaults, so this file is byte-identical
//   in behaviour for the existing instance and can also run a second, isolated one. Telegram,
//   the GitHub cron dispatch and the board backdrop all switch off cleanly when unconfigured.
//   Isolation between instances comes from separate KV namespaces and separate secrets, NOT
//   from separate code. Microsoft is disabled by simply omitting MS_* secrets.
// v15 (16 Aug 2026) — commitment ledger fixes:
//   1. extractActions asked the model for "commitments" and then dropped the field on its return,
//      so scanEmails always saw undefined and the ledger never filled from email. Now returned.
//   2. The capture path (WhatsApp / Telegram) never produced commitments at all — cmtPut was only
//      reachable from scanEmails and /ledger_rebuild. classifyIntent now carries an optional
//      commitment on its EXISTING call (no extra latency on the interactive path) and captureText
//      writes it. A user with no mailbox connected now still accrues a ledger.
//   Not changed: the two explicit Telegram "task:" branches, which never call classifyIntent and
//   would need a second model call to classify. Telegram-only; revisit if it ever matters.
const OFFSET_MIN = 4 * 60;
const MODEL = "@cf/mistralai/mistral-small-3.1-24b-instruct";
const STT = "@cf/openai/whisper-large-v3-turbo";
// --- Claude (Anthropic) = primary extraction brain; falls back to Workers-AI Mistral on ANY failure ---
// --- Two Claude tiers: cheap+fast for high-volume classification, strong for the judgement calls ---
const CLAUDE_FAST = "claude-haiku-4-5";   // runs on EVERY message and email: intent classification, meeting parsing
const CLAUDE_SMART = "claude-sonnet-5";   // low volume, high stakes: email -> task extraction, recall answers, drafting
// Sonnet 5 runs ADAPTIVE THINKING by default when the thinking field is omitted, and thinking shares max_tokens
// with the answer - so every SMART call explicitly disables it (see claudeBody). Haiku 4.5 is never sent a
// thinking field at all (older model: no thinking unless explicitly enabled).
const EXTRACT_SCHEMA = { type: "object", additionalProperties: false, properties: { summary: { type: "string" }, actions: { type: "array", items: { type: "string" } }, meeting: { type: "object", additionalProperties: false, properties: { title: { type: "string" }, start_iso: { type: "string" }, location: { type: "string" } }, required: ["title", "start_iso", "location"] }, commitments: { type: "array", items: { type: "object", additionalProperties: false, properties: { text: { type: "string" }, direction: { type: "string", enum: ["owed_by_me", "owed_to_me"] }, counterparty: { type: "string" }, due_hint: { type: "string" } }, required: ["text", "direction", "counterparty", "due_hint"] } } }, required: ["summary", "actions", "meeting", "commitments"] };
const CLASSIFY_SCHEMA = { type: "object", additionalProperties: false, properties: { kind: { type: "string", enum: ["task", "meeting"] }, text: { type: ["string", "null"] }, due_iso: { type: ["string", "null"] }, commitment: { type: ["object", "null"], additionalProperties: false, properties: { direction: { type: "string", enum: ["owed_by_me", "owed_to_me"] }, counterparty: { type: "string" }, due_hint: { type: "string" } }, required: ["direction", "counterparty", "due_hint"] } }, required: ["kind", "text", "due_iso", "commitment"] };
const PARSE_SCHEMA = { type: "object", additionalProperties: false, properties: { ok: { type: "boolean" }, title: { type: ["string", "null"] }, start_iso: { type: ["string", "null"] }, location: { type: ["string", "null"] } }, required: ["ok", "title", "start_iso", "location"] };
// Builds the Anthropic request body. Only the SMART tier gets an explicit thinking:disabled — on Sonnet 5
// adaptive thinking is ON when the field is omitted and would consume max_tokens, truncating the answer.
function claudeBody(model, maxTok, sys, user, schema) {
  const b = { model: model, max_tokens: maxTok, system: sys, messages: [{ role: "user", content: user }] };
  if (model !== CLAUDE_FAST) b.thinking = { type: "disabled" };
  if (schema) b.output_config = { format: { type: "json_schema", schema } };
  return JSON.stringify(b);
}
async function claudeJSON(env, sys, user, schema, model, maxTok) {
  if (!env.ANTHROPIC_API_KEY) return null;
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: claudeBody(model || CLAUDE_FAST, maxTok || 300, sys, user, schema)
    });
    if (!r.ok) return null;
    const j = await r.json();
    if (j.stop_reason === "refusal") return null;
    const txt = (j.content || []).filter(b => b && b.type === "text").map(b => b.text).join("");
    return txt ? JSON.parse(txt) : null;
  } catch (e) { return null; }
}
const GH_DISPATCH = "https://api.github.com/repos/DigitOracle/meeting-reminder-bot/actions/workflows/reminders.yml/dispatches";
// ---- Instance configuration -------------------------------------------------------------
// Defaults are the original single-user values, so an instance that sets NOTHING behaves
// exactly as before. A second instance overrides via Worker vars:
//   MAILBOXES  comma-separated list to scan; set to "" (empty) to disable mail entirely
//   ADD_TO     mailbox that captured meetings are written to; "" disables calendar writes
//   BOARD_BG   "off" to suppress the founder-portrait board backdrop
// Microsoft access is switched off simply by NOT setting MS_TENANT_ID/MS_CLIENT_ID/
// MS_CLIENT_SECRET — every Graph path is already wrapped and degrades to no-op.
const MAILBOXES_DEFAULT = ["ceo@digitalabbot.io", "contact@digitalabbot.io", "radar@digitalabbot.io"];
function MB(env) {
  if (env && typeof env.MAILBOXES === "string") return env.MAILBOXES.split(",").map(x => x.trim()).filter(Boolean);
  return MAILBOXES_DEFAULT;
}
function AT(env) {
  if (env && typeof env.ADD_TO === "string") return env.ADD_TO.trim();
  return "ceo@digitalabbot.io";
}
const DOWS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const FOUNDER_BG = "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";

async function tg(env, method, payload) { if (!env.TELEGRAM_TOKEN) return null; return fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); }
const say = (env, text, html) => tg(env, "sendMessage", html ? { chat_id: env.TELEGRAM_CHAT_ID, parse_mode: "HTML", disable_web_page_preview: true, text } : { chat_id: env.TELEGRAM_CHAT_ID, text });
const answerCb = (env, id, text) => tg(env, "answerCallbackQuery", { callback_query_id: id, text: text || "" });
const clearBtns = (env, c, m) => tg(env, "editMessageReplyMarkup", { chat_id: c, message_id: m, reply_markup: { inline_keyboard: [] } });
const rid = () => Math.random().toString(36).slice(2, 10);
const pad = (n) => String(n).padStart(2, "0");
const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
function gstNow() { return new Date(Date.now() + OFFSET_MIN * 60000); }
function gstNowIso() { const d = gstNow(); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00+04:00`; }
function gstWeekday() { return DAYS[gstNow().getUTCDay()]; }
function gstDateStr(d) { return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; }
function dateHints() { const base = gstNow(); const parts = []; for (let i = 1; i <= 7; i++) { const d = new Date(base.getTime() + i * 86400000); parts.push(`${DAYS[d.getUTCDay()]}=${gstDateStr(d)}`); } return `Today is ${DAYS[base.getUTCDay()]} ${gstDateStr(base)} (GST). Do NOT calculate dates — read them from this map. A weekday name means its NEXT occurrence AFTER today: ${parts.join(", ")}. tomorrow=${gstDateStr(new Date(base.getTime() + 86400000))}, today/tonight=${gstDateStr(base)}.`; }
function wallPlus(iso, mins) { const d = new Date(iso.slice(0, 19) + "Z"); const d2 = new Date(d.getTime() + mins * 60000); return `${d2.getUTCFullYear()}-${pad(d2.getUTCMonth() + 1)}-${pad(d2.getUTCDate())}T${pad(d2.getUTCHours())}:${pad(d2.getUTCMinutes())}:00`; }
function humanGst(iso) { try { return new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Dubai", weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }); } catch (e) { return String(iso).replace("T", " ").slice(0, 16); } }
function asText(res) { let raw = res; if (raw && typeof raw === "object") { raw = raw.response ?? (raw.result && raw.result.response) ?? (raw.choices && raw.choices[0] && raw.choices[0].message && raw.choices[0].message.content) ?? raw; } if (typeof raw !== "string") raw = JSON.stringify(raw); return raw.trim(); }
const EMBED_MODEL = "@cf/baai/bge-base-en-v1.5";
const NL10 = String.fromCharCode(10);
async function embed(env, text) {
  try { const t = String(text || "").slice(0, 2000); if (!t.trim()) return null; const r = await env.AI.run(EMBED_MODEL, { text: [t] }); const v = r && r.data && r.data[0]; return Array.isArray(v) ? v : null; } catch (e) { return null; }
}
function cosine(a, b) { let d = 0, na = 0, nb = 0; const n = Math.min(a.length, b.length); for (let i = 0; i < n; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; } return (na && nb) ? d / (Math.sqrt(na) * Math.sqrt(nb)) : 0; }
async function indexDoc(env, id, kind, text, src) {
  try { const t = String(text || "").trim(); if (!t) return; const pfx = kind === "meeting" ? "Meeting: " : kind === "attachment" ? "Document: " : "Task: "; const vec = await embed(env, pfx + t); if (!vec) return; await env.MEETINGS.put("doc_" + id, JSON.stringify({ kind, text: t.slice(0, 1200), vec, src: src || null, created: Date.now() }), { expirationTtl: 180 * 86400 }); } catch (e) {}
}
async function claudeText(env, sys, user, model, maxTok) {
  if (env.ANTHROPIC_API_KEY) { try { const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: claudeBody(model || CLAUDE_SMART, maxTok || 600, sys, user, null) }); if (r.ok) { const j = await r.json(); const txt = (j.content || []).filter(b => b && b.type === "text").map(b => b.text).join("").trim(); if (txt) return txt; } } catch (e) {} }
  try { const res = await env.AI.run(MODEL, { messages: [{ role: "system", content: sys }, { role: "user", content: user }], max_tokens: 320, temperature: 0.2 }); return asText(res); } catch (e) { return ""; }
}
function isQuestion(t) { const s = (t || "").trim(); if (!s) return false; if (/[?]\s*$/.test(s)) return true; return /^(what|when|where|who|which|whose|how|why|is|are|was|were|do|does|did|has|have|any|show me|tell me|catch me up|status of|outstanding|remind me (what|when|who|where))\b/i.test(s); }
// --- Calendar questions answer from the LIVE Outlook calendar, never from the vector index ---
// Vector search has no temporal filter, so "today"/"tomorrow" must be answered deterministically.
function calWindow(t) {
  const s = (t || "").toLowerCase();
  if (/\btonight\b|\btoday\b|\bthis (morning|afternoon|evening)\b/.test(s)) return { kind: "today", days: 0 };
  if (/\btomorrow\b/.test(s)) return { kind: "tomorrow", days: 1 };
  if (/\bnext week\b/.test(s)) return { kind: "in the next 14 days", days: 14 };
  if (/\bthis week\b|\bthe week\b/.test(s)) return { kind: "this week", days: 7 };
  return { kind: "in the next 7 days", days: 7 };
}
function isCalendarQuery(t) {
  const s = (t || "").trim().toLowerCase();
  if (!s) return false;
  if (!/\b(meeting|meetings|calendar|schedule|agenda|appointment|appointments)\b/.test(s)) return false;
  return /\b(today|tonight|tomorrow|this week|next week|this morning|this afternoon|this evening|upcoming|when|what time|any|have|free|busy)\b/.test(s);
}
const CAL_STOP = new Set(["meeting", "meetings", "calendar", "schedule", "agenda", "appointment", "appointments", "today", "tonight", "tomorrow", "week", "have", "with", "when", "what", "time", "this", "next", "upcoming", "there", "about", "does", "doing", "free", "busy", "anything", "coming", "then", "some", "days", "day"]);
async function calendarAnswer(env, text) {
  let items = [];
  if (!MB(env).length) return null;                       // no mail configured -> not a calendar instance
  try { const tok = await msToken(env); for (const mb of MB(env)) items = items.concat(await msList(env, tok, mb)); } catch (e) { return null; }
  try { items = dedup(items); } catch (e) {}
  const gn = gstNow();
  const today = gstDateStr(gn);
  const w = calWindow(text);
  const words = (String(text).toLowerCase().match(/[a-z][a-z'-]{3,}/g) || []).filter(x => !CAL_STOP.has(x));
  const named = words.length ? items.filter(m => { const h = ((m.summary || "") + " " + (m.location || "")).toLowerCase(); return words.some(x => h.indexOf(x) !== -1); }) : [];
  let sel, label;
  if (named.length) { sel = named; label = "matching that"; }
  else if (w.kind === "today") { sel = items.filter(m => (m.start_iso || "").slice(0, 10) === today); label = "today"; }
  else if (w.kind === "tomorrow") { const tm = gstDateStr(new Date(gn.getTime() + 86400000)); sel = items.filter(m => (m.start_iso || "").slice(0, 10) === tm); label = "tomorrow"; }
  else { const end = gstDateStr(new Date(gn.getTime() + w.days * 86400000)); sel = items.filter(m => { const d = (m.start_iso || "").slice(0, 10); return d >= today && d <= end; }); label = w.kind; }
  sel.sort((a, b) => String(a.start_iso).localeCompare(String(b.start_iso)));
  if (!sel.length) return "\u{1F9ED} Nothing on your calendar " + label + " — you are clear. (Checked your Outlook calendar just now.)";
  const lines = sel.slice(0, 10).map((m, i) => (i + 1) + ". " + (m.summary || "(no title)") + " — " + humanGst(m.start_iso) + " GST" + (m.location ? " · " + m.location : ""));
  const more = sel.length > 10 ? NL10 + "…and " + (sel.length - 10) + " more." : "";
  return "\u{1F9ED} " + sel.length + " meeting" + (sel.length === 1 ? "" : "s") + " " + label + ":" + NL10 + lines.join(NL10) + more + NL10 + NL10 + "(live from your Outlook calendar)";
}
async function recall(env, question) {
  const qv = await embed(env, question);
  if (!qv) return { answer: "Couldn't process that just now — try again.", sources: [] };
  const list = await env.MEETINGS.list({ prefix: "doc_" });
  const scored = [];
  const CH = 25;
  for (let i = 0; i < list.keys.length; i += CH) { const vals = await Promise.all(list.keys.slice(i, i + CH).map(k => env.MEETINGS.get(k.name).catch(() => null))); for (const v of vals) { if (!v) continue; let d; try { d = JSON.parse(v); } catch (e) { continue; } if (!d.vec) continue; scored.push({ s: cosine(qv, d.vec), d }); } }
  scored.sort((a, b) => b.s - a.s);
  const top = scored.filter(x => x.s > 0.30).slice(0, 6);
  if (!top.length) return { answer: "Nothing in your recent tasks, meetings, or documents matches that.", sources: [] };
  const ctx = top.map((x, i) => "[" + (i + 1) + "] (" + x.d.kind + ") " + x.d.text + (x.d.src && x.d.src.subject ? " — re: " + x.d.src.subject : "") + (x.d.src && x.d.src.from ? " — from " + x.d.src.from : "")).join(NL10);
  const sys = "You are Azimuth, Kendall's assistant. Right now it is " + humanGst(gstNowIso()) + " GST. Answer the question ONLY from the numbered context (his own tasks, meetings and documents). Be concise: 1-3 sentences. Cite the item numbers you used like [1][2]. CRITICAL: never state a date, day, time, count, place or other specific that is not written verbatim in the context — if the context does not contain it, say plainly what is missing instead of inferring or estimating it. Do not describe something as being today, tomorrow or this week unless the context states that date explicitly. If the context does not answer the question, say so plainly.";
  const answer = await claudeText(env, sys, "Question: " + question + NL10 + NL10 + "Context:" + NL10 + ctx);
  let ans = answer || "Found related items but couldn't summarise — try rephrasing.";
  const cited = []; const cre = /\[(\d+)\]/g; let cm; while ((cm = cre.exec(ans)) !== null) { const n = parseInt(cm[1], 10); if (n >= 1 && n <= top.length && cited.indexOf(n) === -1) cited.push(n); }
  const chosen = cited.length ? cited.map(n => ({ x: top[n - 1], n })) : top.slice(0, 3).map((x, i) => ({ x, n: i + 1 }));
  const bykey = new Map();
  for (const o of chosen) { if (!o.x || !o.x.d) continue; const sc = o.x.d.src || {}; const key = ((sc.subject || "") + "|" + (sc.from || "") + "|" + (sc.channel || "")).toLowerCase(); if (!bykey.has(key)) bykey.set(key, { olds: [], kind: o.x.d.kind, subject: sc.subject, from: sc.from, webLink: sc.webLink }); bykey.get(key).olds.push(o.n); }
  const sources = Array.from(bykey.values());
  const remap = new Map(); sources.forEach((s, i) => { for (const oldn of s.olds) remap.set(oldn, i + 1); });
  ans = ans.replace(/\[(\d+)\]/g, (mm, dd) => { const nn = remap.get(parseInt(dd, 10)); return nn ? "[" + nn + "]" : ""; });
  ans = ans.replace(/(\[\d+\])(\1)+/g, "$1");
  return { answer: ans, sources };
}

async function msToken(env) { const r = await fetch(`https://login.microsoftonline.com/${env.MS_TENANT_ID}/oauth2/v2.0/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "client_credentials", client_id: env.MS_CLIENT_ID, client_secret: env.MS_CLIENT_SECRET, scope: "https://graph.microsoft.com/.default" }) }); const j = await r.json(); return j.access_token; }
async function msCreate(env, token, mailbox, ev) { const body = { subject: ev.summary, start: { dateTime: ev.start_iso.slice(0, 19), timeZone: "Arabian Standard Time" }, end: { dateTime: ev.end_iso ? ev.end_iso.slice(0, 19) : wallPlus(ev.start_iso, 30), timeZone: "Arabian Standard Time" }, location: { displayName: ev.location || "" }, isReminderOn: true, reminderMinutesBeforeStart: 1440, categories: ["DA-Radar"], body: ev.join ? { contentType: "HTML", content: 'Join: <a href="' + ev.join + '">' + ev.join + '</a>' } : undefined }; const r = await fetch(`https://graph.microsoft.com/v1.0/users/${mailbox}/events`, { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json(); return j.id || ""; }
async function msList(env, token, mailbox) { const start = new Date().toISOString(); const end = new Date(Date.now() + 30 * 86400000).toISOString(); const r = await fetch(`https://graph.microsoft.com/v1.0/users/${mailbox}/calendarView?startDateTime=${start}&endDateTime=${end}&$select=subject,start,location,isCancelled,onlineMeeting,bodyPreview&$orderby=start/dateTime&$top=50`, { headers: { Authorization: "Bearer " + token, Prefer: 'outlook.timezone="Arabian Standard Time"' } }); const j = await r.json(); const out = []; for (const e of (j.value || [])) { if (e.isCancelled) continue; const dt = e.start && e.start.dateTime ? e.start.dateTime.slice(0, 19) : null; if (!dt) continue; const loc = (e.location && e.location.displayName) || ""; out.push({ mailbox, id: e.id, summary: e.subject || "(no title)", start_iso: dt + "+04:00", location: loc, join: findJoin(loc, e.onlineMeeting, e.bodyPreview) }); } return out; }
function findJoin(loc, onlineMeeting, body) {
  const s = (loc || "").trim();
  if (/^https?:\/\//i.test(s)) return s.split(/\s/)[0];
  if (onlineMeeting && onlineMeeting.joinUrl) return onlineMeeting.joinUrl;
  const b = body || "";
  const known = b.match(/https?:\/\/\S*?(?:zoom\.us|teams\.microsoft\.com|teams\.live\.com|meet\.google\.com|calendly\.com|webex\.com|whereby\.com|gotomeet|bluejeans|chime\.aws)\S*/i);
  if (known) return known[0].replace(/[)>\].,;'"]+$/, "");
  const any = b.match(/https?:\/\/\S+/i);
  return any ? any[0].replace(/[)>\].,;'"]+$/, "") : "";
}
async function msDelete(env, token, mailbox, id) { const r = await fetch(`https://graph.microsoft.com/v1.0/users/${mailbox}/events/${id}`, { method: "DELETE", headers: { Authorization: "Bearer " + token } }); return r.status === 204 || r.status === 200; }
// Full message body (bodyPreview is truncated ~255 chars, which cuts off the When:/Where: block on forwarded invites).
async function msBody(env, token, mailbox, msgId) { try { const r = await fetch(`https://graph.microsoft.com/v1.0/users/${mailbox}/messages/${msgId}?$select=body`, { headers: { Authorization: "Bearer " + token } }); const j = await r.json(); return (j.body && j.body.content) || ""; } catch (e) { return ""; } }
// --- Calendar-invite auto-detection: parse the standard Outlook/Teams "When:/Where:" block into a concrete event ---
const MONTHNUM = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12, jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
function cleanInviteTitle(s) { return String(s || "").replace(/^(\s*(fw|fwd|re|updated invitation|invitation|accepted|tentative|canceled|cancelled)\s*:\s*)+/i, "").trim() || "Meeting"; }
function to24(h, ap) { h = +h; ap = (ap || "").toUpperCase(); if (ap === "PM" && h !== 12) h += 12; if (ap === "AM" && h === 12) h = 0; return h; }
function parseInvite(subject, body) {
  const b = String(body || "");
  const wm = b.match(/When:\s*([^\r\n]+)/i);
  if (!wm) return null;
  // e.g. "Monday, July 13, 2026 10:00 AM-11:00 AM." — weekday + end time optional.
  const m = wm[1].match(/(?:[A-Za-z]+,\s*)?([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})\s+(\d{1,2}):(\d{2})\s*([AaPp][Mm])(?:\s*[-–—]\s*(\d{1,2}):(\d{2})\s*([AaPp][Mm]))?/);
  if (!m) return null;
  const mo = MONTHNUM[m[1].toLowerCase()]; if (!mo) return null;
  const day = +m[2], yr = +m[3];
  const start_iso = `${yr}-${pad(mo)}-${pad(day)}T${pad(to24(m[4], m[6]))}:${pad(+m[5])}:00+04:00`;
  const end_iso = m[7] ? `${yr}-${pad(mo)}-${pad(day)}T${pad(to24(m[7], m[9]))}:${pad(+m[8])}:00+04:00` : null;
  const wh = b.match(/Where:\s*([^\r\n]+)/i);
  const location = wh ? wh[1].trim().replace(/\.\s*$/, "") : "";
  const join = findJoin("", null, b);
  if (!location && !join) return null; // avoid false positives from a bare "When:" mention
  return { title: cleanInviteTitle(subject), start_iso, end_iso, location, join };
}
async function msInbox(env, token, mailbox, sinceISO, top) { const r = await fetch(`https://graph.microsoft.com/v1.0/users/${mailbox}/mailFolders/inbox/messages?$filter=receivedDateTime%20ge%20${sinceISO}&$select=id,subject,from,toRecipients,ccRecipients,bodyPreview,receivedDateTime,hasAttachments,webLink&$orderby=receivedDateTime%20desc&$top=${top || 20}`, { headers: { Authorization: "Bearer " + token } }); const j = await r.json(); return (j.value || []).map(m => ({ id: m.id, subject: m.subject || "", from: (m.from && m.from.emailAddress && m.from.emailAddress.address) || "", fromName: (m.from && m.from.emailAddress && m.from.emailAddress.name) || "", body: m.bodyPreview || "", hasAttachments: !!m.hasAttachments, webLink: m.webLink || "", to: (m.toRecipients || []).map(x => ((x.emailAddress && x.emailAddress.address) || "").toLowerCase()), cc: (m.ccRecipients || []).map(x => ((x.emailAddress && x.emailAddress.address) || "").toLowerCase()) })); }
// ── v35.1 SENT-ITEMS SCAN — promises live in mail you SEND, not mail you receive ──
async function msSent(env, token, mailbox, sinceISO, top) {
  const r = await fetch(`https://graph.microsoft.com/v1.0/users/${mailbox}/mailFolders/sentitems/messages?$filter=sentDateTime%20ge%20${sinceISO}&$select=id,subject,toRecipients,ccRecipients,bodyPreview,sentDateTime&$orderby=sentDateTime%20desc&$top=${top || 20}`, { headers: { Authorization: "Bearer " + token } });
  const j = await r.json();
  return (j.value || []).map(m => ({ id: m.id, subject: m.subject || "", body: m.bodyPreview || "", sent: m.sentDateTime || "",
    to: (m.toRecipients || []).map(x => ({ addr: ((x.emailAddress && x.emailAddress.address) || "").toLowerCase(), name: (x.emailAddress && x.emailAddress.name) || "" })) }));
}
const SENT_SCHEMA = { type: "object", additionalProperties: false, properties: { commitments: { type: "array", items: { type: "object", additionalProperties: false, properties: { text: { type: "string" }, counterparty: { type: "string" }, due_hint: { type: "string" } }, required: ["text", "counterparty", "due_hint"] } } }, required: ["commitments"] };
async function extractSentCommitments(env, m) {
  const primary = (m.to[0] && (m.to[0].name || m.to[0].addr)) || "";
  const sys = "This is an email KENDALL WILSON SENT. Extract ONLY concrete promises KENDALL made — things he said HE would do/send/provide (\"I'll send the deck Friday\", \"I'll get back to you on pricing\", \"we'll issue the minutes\"). These are owed_by_me. IGNORE greetings, thanks, scheduling confirmations with no deliverable, vague intentions, and anything the OTHER party is doing. For each: text = the concrete deliverable/action, imperative, <=12 words; counterparty = who it was promised to" + (primary ? " (primary recipient: " + primary + ")" : "") + "; due_hint = stated timing verbatim else empty. Return {commitments:[]} — empty if none.";
  const g = await claudeJSON(env, sys, "Subject: " + m.subject + "\nBody: " + String(m.body).slice(0, 1500), SENT_SCHEMA, CLAUDE_SMART, 400);
  return (g && Array.isArray(g.commitments)) ? g.commitments : [];
}
async function scanSent(env, token, opts) {
  opts = opts || {};
  const since = new Date(Date.now() - (opts.sinceMin || 1440) * 60000).toISOString();
  const cap = opts.cap || 30; let made = 0, scanned = 0;
  for (const mb of MB(env)) {
    let msgs = []; try { msgs = await msSent(env, token, mb, since, Math.min(cap, 25)); } catch (e) { continue; }
    for (const m of msgs) {
      if (scanned >= cap) break; scanned++;
      const mk = "proc_sent_" + String(m.id).replace(/[^a-zA-Z0-9]/g, "").slice(-40);
      if (await env.MEETINGS.get(mk)) continue;
      await env.MEETINGS.put(mk, "1", { expirationTtl: 7 * 86400 });
      let cs = []; try { cs = await extractSentCommitments(env, m); } catch (e) {}
      for (let i = 0; i < cs.length && i < 5; i++) {
        const c = cs[i]; if (!c || !c.text || !c.counterparty) continue;
        if (await cmtPut(env, "sent_" + String(m.id).replace(/[^a-zA-Z0-9]/g, "").slice(-40) + "_" + i, { text: c.text, direction: "owed_by_me", counterparty: c.counterparty, due_hint: c.due_hint || "" }, { type: "sent-email", msgId: m.id, mailbox: mb, subject: m.subject, sent: m.sent })) made++;
      }
    }
  }
  return { scanned, made };
}
// ── own-brand guard — a counterparty that IS one of Kendall's own products is not a person who owes anything ──
const OWN_BRANDS_DEFAULT = ["digitalchemy", "digital alchemy", "digitalabbot", "digital abbot", "digitalabbot.io", "abbot", "digitoracle", "azimuth", "viper", "periodichotomy", "digitoracle connector"];
function ownBrands(env) { return (env.OWN_BRANDS ? String(env.OWN_BRANDS).split(",") : OWN_BRANDS_DEFAULT).map(s => s.trim().toLowerCase()).filter(Boolean); }
function isOwnBrand(env, name) { const n = normName(String(name || "")).name.toLowerCase().trim(); if (!n) return false; const list = ownBrands(env); return list.some(b => n === b || n.split(/\s+/).some(w => w === b)); }
async function msAttachments(env, token, mailbox, msgId) {
  try {
    const r = await fetch(`https://graph.microsoft.com/v1.0/users/${mailbox}/messages/${msgId}/attachments`, { headers: { Authorization: "Bearer " + token } });
    const j = await r.json();
    return (j.value || []).filter(a => a.contentBytes && a.size && a.size < 6 * 1024 * 1024);
  } catch (e) { return []; }
}
// --- Attachment UNDERSTANDING: two lanes ---
// Lane 1 (free): Workers AI toMarkdown for born-digital files (Office, text, PDFs WITH a text layer).
// Lane 2 (Mistral OCR): scans / photos / image-only PDFs — toMarkdown can't OCR those, Mistral is SOTA on tables+handwriting.
const MISTRAL_OCR_URL = "https://api.mistral.ai/v1/ocr";
const isImageCt = (ct) => /image\/(png|jpe?g|webp|gif|bmp|tiff?)/.test(ct);
const isPdfCt = (ct) => /pdf/.test(ct);
const isOfficeCt = (ct) => /word|officedocument|ms-excel|spreadsheet|ms-powerpoint|presentation|text\/|csv|rtf/.test(ct);
async function toMd(env, name, ct, b64) {
  try {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const res = await env.AI.toMarkdown([{ name: name || "attachment", blob: new Blob([bytes], { type: ct || "application/octet-stream" }) }]);
    const arr = Array.isArray(res) ? res : [res];
    return arr.map(d => (d && d.data) || "").join("\n").trim();
  } catch (e) { return ""; }
}
async function mistralOcr(env, name, ct, b64) {
  if (!env.MISTRAL_API_KEY) return "";
  const doc = isImageCt(ct)
    ? { type: "image_url", image_url: "data:" + (ct || "image/png") + ";base64," + b64 }
    : { type: "document_url", document_name: name || "document", document_url: "data:application/pdf;base64," + b64 };
  try {
    const r = await fetch(MISTRAL_OCR_URL, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + env.MISTRAL_API_KEY }, body: JSON.stringify({ model: "mistral-ocr-latest", document: doc }) });
    if (!r.ok) return "";
    const j = await r.json();
    return (j.pages || []).map(p => (p && p.markdown) || "").join("\n\n").trim();
  } catch (e) { return ""; }
}
async function attachmentText(env, atts) {
  let out = "";
  for (const a of atts.slice(0, 2)) {
    const ct = (a.contentType || "").toLowerCase();
    const name = a.name || "attachment";
    let text = "";
    if (isImageCt(ct)) {
      text = await mistralOcr(env, name, ct, a.contentBytes);                 // Lane 2: image → OCR
    } else if (isPdfCt(ct)) {
      text = await toMd(env, name, ct, a.contentBytes);                        // Lane 1: try text layer
      if (text.replace(/\s/g, "").length < 40) {                               // thin → scanned PDF
        const ocr = await mistralOcr(env, name, ct, a.contentBytes);           // Lane 2: OCR fallback
        if (ocr) text = ocr;
      }
    } else if (isOfficeCt(ct)) {
      text = await toMd(env, name, ct, a.contentBytes);                        // Lane 1: Office/text
    } else { continue; }
    if (text) out += `\n\n[Attachment: ${name}]\n${text.slice(0, 3500)}`;
  }
  return out;
}

function skipSender(from) { return /noreply|no-reply|donotreply|do-not-reply|newsletter|notification|mailer|marketing@|@email\.|@e\.|mailchimp|sendgrid|substack|read\.ai|brand24|@e\./i.test(from || ""); }
async function extractActions(env, m) {
  const sys = `You triage a work email (plus any attached document text) for Kendall Wilson (founder, DigitAlchemy). NOW is ${gstNowIso()} (${gstWeekday()}, GST/UTC+4).
Write a plain one-line "summary" (<=25 words) of what the email and its attachment(s) are actually about (the gist / key numbers / who wants what).
Extract ONLY genuine action items requiring KENDALL to act (reply, send, review, approve, decide, sign, pay, prepare, follow up, schedule). IGNORE newsletters, marketing, receipts, automated notices, pure FYIs.
Also detect if it proposes a specific meeting with a date AND time.
Output ONLY compact JSON: {"summary":"...","actions":["<short imperative, <15 words>", ...],"meeting":{"title":"...","start_iso":"YYYY-MM-DDTHH:MM:00+04:00","location":"..."}}
Use "meeting":null if none; "actions":[] if nothing actionable.
Also extract "commitments": interpersonal promises where a NAMED person or organisation is waiting. direction "owed_by_me" = Kendall promised it to them; "owed_to_me" = they owe it to Kendall. counterparty = the person or org as named. due_hint = any stated timing, verbatim, else "". Private work with nobody waiting is NOT a commitment. Never invent a counterparty. "commitments":[] if none.`;
  { const _u = "From: " + (m.fromName || "") + " <" + (m.from || "") + ">" + NL10 + "Subject: " + (m.subject || "") + NL10 + NL10 + (m.body || "");
    const _cj = await claudeJSON(env, sys, _u, EXTRACT_SCHEMA, CLAUDE_SMART, 900);
    if (_cj) return { actions: Array.isArray(_cj.actions) ? _cj.actions.filter(x => x && String(x).trim()) : [], meeting: (_cj.meeting && _cj.meeting.start_iso) ? _cj.meeting : null, summary: (_cj.summary == null ? "" : String(_cj.summary)).trim(), commitments: Array.isArray(_cj.commitments) ? _cj.commitments : [] }; }
  const res = await env.AI.run(MODEL, { messages: [{ role: "system", content: sys }, { role: "user", content: `From: ${m.fromName} <${m.from}>\nSubject: ${m.subject}\n\n${m.body}` }], max_tokens: 400, temperature: 0.1 });
  const mm = asText(res).match(/\{[\s\S]*\}/); if (!mm) return { actions: [], meeting: null, summary: "", commitments: [] };
  try { const j = JSON.parse(mm[0]); return { actions: Array.isArray(j.actions) ? j.actions : [], meeting: (j.meeting && j.meeting.start_iso) ? j.meeting : null, summary: (j.summary == null ? "" : String(j.summary)).trim(), commitments: Array.isArray(j.commitments) ? j.commitments : [] }; } catch (e) { return { actions: [], meeting: null, summary: "", commitments: [] }; }
}
async function scanEmails(env, token, sinceMin, cap, opts) {
  opts = opts || {};
  const silent = !!opts.silent;
  const boxes = opts.mailboxes || MB(env);
  const top = opts.top || 20;
  sinceMin = sinceMin || 45; cap = cap || 40;
  const since = new Date(Date.now() - sinceMin * 60000).toISOString();
  let handled = 0, sent = 0; const added = []; let attConv = 0; const ATT_CAP = 12;
  const existing = new Set();
  try { const _ol = await openActions(env); for (const _a of _ol) existing.add((_a.text || "").toLowerCase().trim()); } catch (e) {}
  for (const mb of boxes) {
    if (handled >= cap) break;
    let msgs = []; try { msgs = await msInbox(env, token, mb, since, top); } catch (e) { continue; }
    for (const m of msgs) {
      if (handled >= cap) break;
      const pk = "proc_" + m.id; if (await env.MEETINGS.get(pk)) continue; await env.MEETINGS.put(pk, "1", { expirationTtl: 3 * 86400 });
      if (skipSender(m.from)) continue;
      { const meAddr = (mb || "").toLowerCase(); if (!(m.to || []).includes(meAddr) && (m.cc || []).includes(meAddr)) continue; } // CC-only = FYI, skip the noise
      { // ecead-relayed mail carries original recipients as ORIGTO:/ORIGCC: markers (added by the Power Automate flow)
        const bt = m.body || "";
        if (/ORIGTO:|ORIGCC:/i.test(bt)) {
          const ecead = "kendall.w@ecead.ae";
          const mto = bt.match(/ORIGTO:\s*(.*?)(?=\s*ORIGCC:|[\r\n]|$)/i);
          const mcc = bt.match(/ORIGCC:\s*(.*?)(?=\s*----|[\r\n]|$)/i);
          const inTo = mto ? mto[1].toLowerCase().includes(ecead) : false;
          const inCc = mcc ? mcc[1].toLowerCase().includes(ecead) : false;
          if (!inTo && inCc) continue; // only in Cc on the original ecead mail → FYI, skip
          m.body = (bt.replace(/^[\s\S]*?ORIGCC:[^\r\n]*\r?\n?/i, "").replace(/^\s*----\s*\r?\n?/i, "").trim()) || bt;
        }
      }
      // --- AUTO-DETECT calendar invites (Outlook/Teams forwards) → add straight to the calendar, no manual tap ---
      {
        const sig = (m.subject || "") + " " + (m.body || "");
        const looksInvite = /\bWhen:\s/i.test(m.body || "") || /(invitation|invite|\bdeep dive\b|meeting|teams\.microsoft\.com|zoom\.us|meet\.google\.com)/i.test(sig);
        if (looksInvite) {
          let full = m.body || "";
          try { const fb = await msBody(env, token, mb, m.id); if (fb) full = fb.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&"); } catch (e) {}
          const inv = parseInvite(m.subject, full);
          if (inv && inv.start_iso) {
            const startMs = Date.parse(inv.start_iso);
            if (!isNaN(startMs) && startMs > Date.now() - 3600000) { // future only (1h grace)
              const key = "inv_" + inv.start_iso.slice(0, 16) + "_" + inv.title.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 32);
              if (await env.MEETINGS.get(key)) { handled++; continue; } // already auto-added
              await env.MEETINGS.put(key, "1", { expirationTtl: 30 * 86400 });
              // Guard: don't double-book if this meeting is already on the calendar (added manually or by an earlier run).
              let dup = false;
              try { const nt = inv.title.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 12); const sk = inv.start_iso.slice(0, 13); for (const ev of await msList(env, token, AT(env))) { if ((ev.start_iso || "").slice(0, 13) === sk && nt && (ev.summary || "").toLowerCase().replace(/[^a-z0-9]+/g, "").includes(nt)) { dup = true; break; } } } catch (e) {}
              if (!dup) {
                let oid = ""; try { oid = await msCreate(env, token, AT(env), { summary: inv.title, start_iso: inv.start_iso, end_iso: inv.end_iso, location: inv.location, join: inv.join }); } catch (e) {}
                const evt = { mailbox: AT(env), outlook_id: oid, summary: inv.title, start_iso: inv.start_iso, location: inv.location || "", join: inv.join || "", src: { type: "meeting-invite", msgId: m.id, mailbox: mb, from: m.from, subject: m.subject, webLink: m.webLink || "" } };
                await env.MEETINGS.put("evt_" + Date.now() + "_" + rid(), JSON.stringify(evt), { expirationTtl: 60 * 60 * 24 * 21 }); try { await indexDoc(env, "evt_inv_" + rid(), "meeting", (inv.title || "") + " " + (inv.location || "") + (inv.start_iso ? " " + inv.start_iso.slice(0, 10) + " " + humanGst(inv.start_iso) + " GST" : ""), evt.src || null); } catch (e) {}
                if (!silent) { await tg(env, "sendMessage", { chat_id: env.TELEGRAM_CHAT_ID, parse_mode: "HTML", disable_web_page_preview: true, text: `📅 <b>Auto-added to your calendar</b> — ${esc(inv.title)}\n🗓 ${humanGst(inv.start_iso)} GST${inv.location ? " · " + esc(inv.location) : ""}\n<i>from ${esc(m.from)} — ${esc(m.subject)}</i>` }); sent++; }
              }
              handled++;
              continue; // it's an invite, not an action item — done with this message
            }
          }
        }
      }
      handled++;
      let attGot = false, attNames = "";
      if (m.hasAttachments && attConv < ATT_CAP) { try { const _atts = await msAttachments(env, token, mb, m.id); const _at = await attachmentText(env, _atts); if (_at) { m.body = (m.body || "") + _at; attConv++; attGot = true; attNames = _atts.slice(0, 2).map(a => a.name).filter(Boolean).join(", "); try { await indexDoc(env, "att_" + rid(), "attachment", _at, { type: "email", msgId: m.id, mailbox: mb, from: m.from, subject: m.subject, webLink: m.webLink || "" }); } catch (e) {} } } catch (e) {} }
      let ext; try { ext = await extractActions(env, m); } catch (e) { continue; }
      try { const _cs = (ext && ext.commitments) || []; for (let _i = 0; _i < _cs.length && _i < 5; _i++) { await cmtPut(env, "msg_" + String(m.id).replace(/[^a-zA-Z0-9]/g, "").slice(-40) + "_" + _i, _cs[_i], { type: "email", msgId: m.id, mailbox: mb, from: m.from, subject: m.subject, webLink: m.webLink || "" }); } } catch (e) {}
      if (!silent && attGot) { await tg(env, "sendMessage", { chat_id: env.TELEGRAM_CHAT_ID, parse_mode: "HTML", disable_web_page_preview: true, text: `📎 <b>Attachment read</b> — ${esc(m.subject || "(no subject)")}\n${esc(ext.summary || "Document received.")}\n<i>${esc(attNames || "attachment")} · from ${esc(m.from)}</i>` }); sent++; }
      if (!silent && ext.meeting && ext.meeting.start_iso) { const cid = rid(); await env.MEETINGS.put("cand_" + cid, JSON.stringify(ext.meeting), { expirationTtl: 3 * 86400 }); await tg(env, "sendMessage", { chat_id: env.TELEGRAM_CHAT_ID, parse_mode: "HTML", disable_web_page_preview: true, text: `📧 <b>Possible meeting</b> — ${esc(ext.meeting.title || "Meeting")}\n🗓 ${humanGst(ext.meeting.start_iso)} GST${ext.meeting.location ? " · " + esc(ext.meeting.location) : ""}\n<i>from ${esc(m.from)} — ${esc(m.subject)}</i>`, reply_markup: { inline_keyboard: [[{ text: "📅 Add to calendar", callback_data: "m:" + cid }, { text: "🙈 Ignore", callback_data: "ig:" + cid }]] } }); sent++; }
      for (const a of (ext.actions || [])) {
        if (!a || !String(a).trim()) continue;
        const _k = String(a).trim().toLowerCase(); if (existing.has(_k)) continue; existing.add(_k);
        const aid = rid();
        await env.MEETINGS.put("act_" + aid, JSON.stringify({ id: aid, text: String(a).trim(), from: m.from, subject: m.subject, created: Date.now(), src: { type: "email", msgId: m.id, mailbox: mb, from: m.from, subject: m.subject, webLink: m.webLink || "" } }), { expirationTtl: 30 * 86400 });
        added.push(String(a).trim()); try { await indexDoc(env, "act_" + aid, "task", String(a).trim(), { type: "email", msgId: m.id, mailbox: mb, from: m.from, subject: m.subject, webLink: m.webLink || "" }); } catch (e) {}
        if (!silent) { await tg(env, "sendMessage", { chat_id: env.TELEGRAM_CHAT_ID, parse_mode: "HTML", disable_web_page_preview: true, text: `📋 <b>${esc(String(a).trim())}</b>\n<i>📧 ${esc(m.from)} — ${esc(m.subject)}</i>`, reply_markup: { inline_keyboard: [[{ text: "✅ Done", callback_data: "d:" + aid }]] } }); }
        sent++;
      }
    }
  }
  return { sent, added };
}
async function openActions(env) { const list = await env.MEETINGS.list({ prefix: "act_" }); const items = []; for (const k of list.keys) { const v = await env.MEETINGS.get(k.name); if (v) { try { items.push(JSON.parse(v)); } catch (e) {} } } items.sort((a, b) => { const ad = a.due_iso ? Date.parse(a.due_iso) : Infinity, bd = b.due_iso ? Date.parse(b.due_iso) : Infinity; if (ad !== bd) return ad - bd; const ac = a.created || 0, bc = b.created || 0; if (ac !== bc) return ac - bc; return String(a.id || "").localeCompare(String(b.id || "")); }); return items; }
async function findDupTask(env, text) { try { const k = String(text || "").trim().toLowerCase(); if (!k) return null; const items = await openActions(env); for (const it of items) { if ((it.text || "").trim().toLowerCase() === k) return it; } } catch (e) {} return null; }
async function listActions(env) { const items = await openActions(env); if (!items.length) { await say(env, "✅ <b>Your plate's clear</b> — no open action items.", true); return; } await say(env, `📋 <b>Your plate — ${items.length} open</b> (tap ✅ to clear):`, true); for (const it of items.slice(0, 15)) { await tg(env, "sendMessage", { chat_id: env.TELEGRAM_CHAT_ID, parse_mode: "HTML", disable_web_page_preview: true, text: `• <b>${esc(it.text)}</b>\n<i>${esc(it.from || "")}</i>`, reply_markup: { inline_keyboard: [[{ text: "✅ Done", callback_data: "d:" + it.id }]] } }); } }
async function morningDigest(env) { const items = await openActions(env); if (!items.length) { await say(env, "☀️ <b>Plate's clear</b> — no open action items from your inbox.", true); return; } const lines = items.slice(0, 15).map((it, i) => `${i + 1}. ${esc(it.text)}`).join("\n"); await say(env, `☀️ <b>Your plate today</b> — ${items.length} open action item(s):\n${lines}\n\nSay "action items" to tick them off.`, true); }

function emirateOf(loc) { const l = (loc || "").toLowerCase();
  if (/zoom|teams|meet|online|bluebeam|webinar|https?:|virtual|hangout|webex/.test(l)) return ["Online", "#3E7C8C", "Online"];
  if (/sharjah|الشارقة/.test(l)) return ["Sharjah", "#7A4A93", "In person"];
  if (/abu dhabi|أبو ظبي|reem|shams|yas|mafraq|مفرق/.test(l)) return ["Abu Dhabi", "#0A4F4A", "In person"];
  if (/dubai|دبي|jumeirah|difc|marsa/.test(l)) return ["Dubai", "#B98B3E", "In person"];
  if (/ajman|عجمان/.test(l)) return ["Ajman", "#9C6B3E", "In person"];
  if (/ras al khaimah|fujairah|umm al quwain/.test(l)) return ["UAE", "#6B7370", "In person"];
  return ["", "#9AA0A0", l ? "In person" : ""]; }
async function placesSearch(env, query) {
  if (!env.MAPS_KEY) return [];
  try {
    const r = await fetch("https://places.googleapis.com/v1/places:searchText", { method: "POST", headers: { "Content-Type": "application/json", "X-Goog-Api-Key": env.MAPS_KEY, "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.id" }, body: JSON.stringify({ textQuery: query, regionCode: "AE", maxResultCount: 4 }) });
    const j = await r.json();
    return (j.places || []).map(p => ({ name: (p.displayName && p.displayName.text) || "", address: p.formattedAddress || "" })).filter(p => p.address);
  } catch (e) { return []; }
}
function venueKey(s) { return "venue_" + (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 40); }
function isVenue(loc) {
  const l = (loc || "").trim().toLowerCase();
  if (!l || /^https?:\/\//.test(l)) return false;
  if (/\b(zoom|teams|meet|online|webex|hangout|virtual|skype|phone|call)\b/.test(l)) return false;
  if (/^(dubai|abu dhabi|sharjah|ajman|ras al khaimah|fujairah|umm al quwain|uae|tbd)$/.test(l)) return false;
  return /[a-z]/.test(l);
}
function dateHead(dateStr) { const d = new Date(dateStr + "T00:00:00Z"); return { dow: DOWS[d.getUTCDay()], dt: d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] }; }

// Renders a premium "Tomorrow" agenda card as HTML -> screenshotted to PNG for the WhatsApp image reminder.
function cardHtml(evs, dateStr, dayWord) {
  const dh = dateHead(dateStr);
  const dow = dh.dow[0] + dh.dow.slice(1).toLowerCase();
  const n = evs.length;
  let headline = "Open day — nothing scheduled.", locs = "";
  if (n) {
    const inp = [], seen = new Set(); let online = false;
    for (const m of evs) { const [em, , ty] = emirateOf(m.location); if (ty === "Online") online = true; if (em && ty === "In person" && !seen.has(em)) { seen.add(em); inp.push(em); } }
    headline = inp.length ? inp.join(", ") + (online ? ", then online." : ".") : "All online — no travel.";
    locs = inp.length ? inp.join(" · ") : "online";
  }
  const rows = evs.slice(0, 6).map(m => {
    const [em, col, ty] = emirateOf(m.location);
    const lab = (em || (ty === "Online" ? "Online" : "—")) + (ty === "Online" ? " · online" : (em ? " · in person" : ""));
    return `<div class="row"><div class="time">${m.start_iso.slice(11, 16)}<small>GST</small></div><span class="dot" style="background:${col}"></span><div class="minfo"><div class="mtt">${esc(m.summary)}</div><div class="mloc">${esc(lab)}</div></div></div>`;
  }).join("");
  const more = n > 6 ? `<div class="more">+ ${n - 6} more on your board</div>` : "";
  const sub = n ? `${n} meeting${n === 1 ? "" : "s"} · ${esc(locs)}` : "Clear day — enjoy it.";
  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,"Segoe UI",system-ui,sans-serif;background:#FAF8F3;padding:26px;width:760px}
.card{background:linear-gradient(158deg,#0A4F4A,#0B564F 60%,#0C5A54);border-radius:30px;padding:36px 36px 30px;color:#F2EFE6;position:relative;overflow:hidden}
.rings{position:absolute;right:-100px;top:-100px;width:340px;height:340px;border-radius:50%;background:radial-gradient(circle,transparent 0 66px,rgba(197,165,106,.20) 66px 68px,transparent 68px 116px,rgba(242,239,230,.10) 116px 118px,transparent 118px 172px,rgba(242,239,230,.06) 172px 174px,transparent 174px)}
.eb{font-size:15px;letter-spacing:.2em;text-transform:uppercase;color:rgba(242,239,230,.72);position:relative}
h1{font-size:${n >= 4 ? 36 : 42}px;line-height:1.08;font-weight:800;margin:12px 0 6px;position:relative;letter-spacing:-.015em}
.sub{font-size:18px;color:#CFDAD6;margin-bottom:26px;position:relative}
.rows{position:relative;display:flex;flex-direction:column;gap:11px}
.row{display:flex;align-items:center;gap:16px;background:rgba(255,255,255,.085);border:1px solid rgba(255,255,255,.06);border-radius:17px;padding:15px 18px}
.time{font-size:22px;font-weight:800;min-width:76px;font-variant-numeric:tabular-nums;line-height:1}
.time small{display:block;font-size:10.5px;font-weight:600;color:rgba(242,239,230,.55);letter-spacing:.1em;margin-top:3px}
.dot{width:13px;height:13px;border-radius:50%;flex:none;box-shadow:0 0 0 4px rgba(255,255,255,.06)}
.minfo{flex:1;min-width:0}.mtt{font-size:19.5px;font-weight:700;line-height:1.2}.mloc{font-size:14px;color:#C6D2CE;margin-top:3px}
.more{font-size:14px;color:rgba(242,239,230,.6);padding:8px 4px 0;position:relative}
.foot{position:relative;margin-top:24px;display:flex;justify-content:space-between;align-items:center;font-size:14px;color:rgba(242,239,230,.62);border-top:1px solid rgba(255,255,255,.08);padding-top:16px}
.bm{display:flex;align-items:center;gap:9px;font-weight:800;letter-spacing:.03em}
.glyph{width:20px;height:20px;position:relative;display:inline-block}.glyph i{position:absolute;inset:0;border:1.6px solid rgba(242,239,230,.85);border-radius:50%}.glyph i:nth-child(2){inset:5px;opacity:.5}.glyph::after{content:"";position:absolute;left:50%;top:50%;width:5px;height:5px;margin:-2.5px;border-radius:50%;background:#C5A56A}
</style></head><body>
<div class="card"><div class="rings"></div>
<div class="eb">${dayWord === "today" ? "Today" : "Tomorrow"} · ${dow} ${dh.dt}</div>
<h1>${esc(headline)}</h1>
<div class="sub">${sub}</div>
<div class="rows">${rows || '<div class="row"><div class="minfo"><div class="mtt">No meetings scheduled</div><div class="mloc">Enjoy the clear day.</div></div></div>'}</div>${more}
<div class="foot"><span class="bm"><span class="glyph"><i></i><i></i></span>Azimuth</span><span>${dow} ${dh.dt}</span></div>
</div></body></html>`;
}
function srcLink(a, key) { if (!a || !a.src || (a.src.type !== "email" && a.src.type !== "meeting-invite")) return ""; return '·<a class="src" target="_blank" rel="noopener" style="color:#B98B3E;text-decoration:none" href="/src?key=' + encodeURIComponent(key || "") + "&id=" + encodeURIComponent(a.id) + '">📧 source</a>'; }
function renderBoard(meetings, actions, key, env, mkt) {
  const gn = gstNow();
  const today = gstDateStr(gn);
  const tomo = gstDateStr(new Date(gn.getTime() + 86400000));
  const week = gstDateStr(new Date(gn.getTime() + 7 * 86400000));
  const th = dateHead(today);
  meetings = (meetings || []).slice().sort((a, b) => (Date.parse(a.start_iso) || 0) - (Date.parse(b.start_iso) || 0));
  const upcoming = meetings.filter(m => m.start_iso.slice(0, 10) >= today);

  // tomorrow pulse
  const tm = upcoming.filter(m => m.start_iso.slice(0, 10) === tomo);
  let headline, mini = "";
  if (!tm.length) { headline = "Open day — nothing scheduled."; }
  else {
    const inp = [], seen = new Set(); let online = false;
    for (const m of tm) { const [em, , ty] = emirateOf(m.location); if (ty === "Online" || (!em && /online/i.test(m.location))) online = true; if (em && ty === "In person" && !seen.has(em)) { seen.add(em); inp.push(em); } }
    if (inp.length) headline = inp.join(", ") + (online ? ", then online." : "."); else headline = "All online — no travel.";
    mini = tm.slice(0, 3).map(m => { const [em, col, ty] = emirateOf(m.location); return `<div class="m"><span class="t num">${m.start_iso.slice(11,16)}</span><span class="d" style="background:${col}"></span>${esc(m.summary)}${em?" · "+esc(em):(ty==="Online"?" · online":"")}</div>`; }).join("");
  }
  const pulse = `<section class="pulse"><div class="eb">Tomorrow · ${dateHead(tomo).dow[0]+dateHead(tomo).dow.slice(1).toLowerCase()} ${dateHead(tomo).dt}</div><h1>${esc(headline)}</h1><div class="mini">${mini}</div></section>`;

  // this-week day groups
  const byDate = {};
  for (const m of upcoming) { const dstr = m.start_iso.slice(0, 10); if (dstr > week) continue; (byDate[dstr] = byDate[dstr] || []).push(m); }
  const dates = Object.keys(byDate).sort();
  let daysHtml = "";
  for (const dstr of dates) {
    const h = dateHead(dstr);
    const tomClass = dstr === tomo ? " tom" : "";
    const cards = byDate[dstr].slice(0, 4).map(m => {
      const [em, col, ty] = emirateOf(m.location);
      const label = (em || (ty === "Online" ? "Online" : "")) + (ty === "Online" ? " · online" : (em ? " · in person" : ""));
      const isUrlLoc = /^https?:/i.test((m.location || "").trim());
      const physical = ty !== "Online" && (m.location || "").trim() && !isUrlLoc;
      let href = "", go = "";
      if (m.join) { href = m.join; go = '<span class="go">Join ↗</span>'; }
      else if (physical) { href = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(m.location); go = '<span class="go">Map ↗</span>'; }
      const tag = href ? "a" : "div";
      const attr = href ? ` href="${esc(href)}" rel="noopener"` : "";
      return `<${tag} class="card"${attr}><span class="bar" style="background:${col}"></span><div class="time num">${m.start_iso.slice(11,16)}<small>GST</small></div><div class="info"><div class="tt">${esc(m.summary)}</div><div class="loc"><span class="d" style="background:${col}"></span>${esc(label||"—")}</div></div>${go}</${tag}>`;
    }).join("");
    daysHtml += `<div class="day${tomClass}"><div class="dh"><span class="dow">${h.dow}</span><span class="dt num">${h.dt}</span></div>${cards}</div>`;
  }
  if (!daysHtml) daysHtml = `<div class="empty">No meetings in the next 7 days.</div>`;
  const later = upcoming.find(m => m.start_iso.slice(0, 10) > week);
  const nextLine = later ? `<div class="next">↷ Later — ${dateHead(later.start_iso.slice(0,10)).dow[0]+dateHead(later.start_iso.slice(0,10)).dow.slice(1).toLowerCase()} ${dateHead(later.start_iso.slice(0,10)).dt} · ${esc(later.summary)}, ${later.start_iso.slice(11,16)}</div>` : "";

  // plate
  const acts = actions || [];
  const tasksHtml = acts.length ? acts.slice(0, 200).map(a => {
    const hi = /\b(pay|approve|sign|urgent|asap|today|deadline|overdue)\b/i.test(a.text || "");
    return `<div class="task" data-id="${a.id}"><span class="ring" role="button" tabindex="0" aria-label="Mark done"></span><div class="tinfo"><div class="tt">${esc(a.text)}</div><div class="meta"><span>${esc((a.from||"").split("@")[0]||"inbox")}</span>${a.due_iso?'·<span class="due">⏰ '+esc(humanGst(a.due_iso))+'</span>':''}${hi?'·<span class="pri"><span class="pd"></span>High</span>':''}${srcLink(a,key)}</div></div></div>`;
  }).join("") : `<div class="empty">Plate's clear — nothing open. 🎉</div>`;

  const upd = gn.getUTCHours ? `${pad(gn.getUTCHours())}:${pad(gn.getUTCMinutes())}` : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="theme-color" content="#0A4F4A"><meta name="apple-mobile-web-app-title" content="Azimuth"><title>Azimuth</title>
<style>
:root{--paper:#FAF8F3;--ink:#16211F;--muted:#5F6B66;--teal:#0A4F4A;--gold:#B98B3E;--line:#E9E4D7;--card:#FFF;--online:#3E7C8C;--radius:16px}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;-webkit-font-smoothing:antialiased;position:relative;min-height:100vh}body::before{content:"";position:fixed;inset:0;z-index:-2;background:url(/bg.jpg) center 14%/cover no-repeat}body::after{content:"";position:fixed;inset:0;z-index:-1;background:linear-gradient(180deg,rgba(250,248,243,.40) 0%,rgba(250,248,243,.47) 34%,rgba(250,248,243,.50) 72%,rgba(250,248,243,.54) 100%)}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.wrap{max-width:460px;margin:0 auto;padding:22px 18px 40px;position:relative}.num{font-variant-numeric:tabular-nums}
.brand{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}
.mark{display:flex;align-items:center;gap:9px;font-weight:700;font-size:16px;letter-spacing:.03em}
.mark .glyph{width:20px;height:20px;position:relative}.mark .glyph span{position:absolute;inset:0;border:1.5px solid var(--teal);border-radius:50%;opacity:.9}
.mark .glyph span:nth-child(2){inset:5px;opacity:.55}.mark .glyph::after{content:"";position:absolute;left:50%;top:50%;width:5px;height:5px;margin:-2.5px;border-radius:50%;background:var(--gold)}
.today{font-size:12.5px;color:var(--muted)}
.pulse{position:relative;overflow:hidden;background:rgba(10,79,74,.60);color:#F2EFE6;-webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px);border-radius:20px;padding:20px 20px 22px;margin-bottom:26px;box-shadow:0 8px 26px rgba(10,79,74,.20)}
.pulse::after{content:"";position:absolute;right:-70px;top:-70px;width:230px;height:230px;border-radius:50%;background:radial-gradient(circle,transparent 0 34px,rgba(197,165,106,.16) 34px 35px,transparent 35px 62px),radial-gradient(circle,transparent 0 62px,rgba(242,239,230,.10) 62px 63px,transparent 63px 92px),radial-gradient(circle,transparent 0 92px,rgba(242,239,230,.07) 92px 93px,transparent 93px)}
.pulse .eb{font-size:11px;text-transform:uppercase;letter-spacing:.16em;color:rgba(242,239,230,.7);position:relative}
.pulse h1{position:relative;margin:6px 0 14px;font-size:26px;line-height:1.12;font-weight:700;text-wrap:balance;letter-spacing:-.01em}
.pulse .mini{position:relative;display:flex;flex-direction:column;gap:8px}
.pulse .m{display:flex;align-items:center;gap:10px;font-size:13.5px;color:#EEEADE}.pulse .m .t{font-weight:700;min-width:44px}.pulse .m .d{width:7px;height:7px;border-radius:50%}
.sec{display:flex;align-items:baseline;gap:10px;margin:0 2px 12px}.sec h2{font-size:12px;text-transform:uppercase;letter-spacing:.14em;color:var(--teal);margin:0;font-weight:700}.sec .rule{flex:1;height:1px;background:var(--line)}
.day{margin-bottom:16px}.day .dh{display:flex;align-items:baseline;gap:8px;margin:0 2px 8px}.day .dh .dow{font-size:12px;font-weight:700;letter-spacing:.06em}.day .dh .dt{font-size:12px;color:var(--muted)}.day.tom .dh .dow{color:var(--gold)}
.card{display:flex;gap:13px;background:rgba(255,255,255,.50);-webkit-backdrop-filter:blur(7px);backdrop-filter:blur(7px);border:1px solid rgba(255,255,255,.60);border-radius:var(--radius);padding:13px 15px;margin-bottom:8px;align-items:center}
a.card{text-decoration:none;color:inherit;-webkit-tap-highlight-color:transparent}a.card:active{opacity:.82}.go{margin-left:auto;font-size:11px;font-weight:700;color:var(--teal);white-space:nowrap;padding-left:8px}
.bar{width:4px;align-self:stretch;border-radius:4px}.time{min-width:46px;font-weight:700;font-size:15px;line-height:1.15}.time small{display:block;font-size:9.5px;font-weight:600;color:var(--muted);letter-spacing:.06em;margin-top:1px}
.info{flex:1;min-width:0}.info .tt{font-size:14.5px;font-weight:600;line-height:1.25}.info .loc{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);margin-top:4px}.info .loc .d{width:7px;height:7px;border-radius:50%;flex:none}
.plate-h{display:flex;align-items:flex-end;justify-content:space-between;margin:30px 2px 12px}.plate-h .l{display:flex;align-items:baseline;gap:9px}.plate-h .l .n{font-size:30px;font-weight:800;color:var(--teal);line-height:.9}.plate-h .l .cap{font-size:12px;text-transform:uppercase;letter-spacing:.13em;color:var(--muted)}.plate-h .hint{font-size:11.5px;color:var(--muted)}
.task{display:flex;gap:13px;background:rgba(255,255,255,.50);-webkit-backdrop-filter:blur(7px);backdrop-filter:blur(7px);border:1px solid rgba(255,255,255,.60);border-radius:var(--radius);padding:13px 15px;margin-bottom:8px;align-items:center}.ring{width:22px;height:22px;border-radius:50%;border:2px solid var(--gold);flex:none;cursor:pointer;transition:background .15s;-webkit-tap-highlight-color:transparent}.ring:active{transform:scale(.9)}.ring.done{background:var(--gold)}.task .tinfo{flex:1;min-width:0}.task .tt{font-size:14px;font-weight:600}.task .meta{display:flex;align-items:center;gap:8px;font-size:11.5px;color:var(--muted);margin-top:3px}.pri{display:inline-flex;align-items:center;gap:5px}.pri .pd{width:6px;height:6px;border-radius:50%;background:var(--gold)}.due{color:var(--gold);font-weight:600}
.empty{background:var(--card);border:1px dashed var(--line);border-radius:var(--radius);padding:16px;text-align:center;color:var(--muted);font-size:13px}
.next{font-size:12px;color:var(--muted);margin:4px 2px 0;padding-left:2px}
.legend{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;margin-top:24px;padding-top:16px;border-top:1px solid var(--line)}.legend span{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:var(--muted)}.legend i{width:8px;height:8px;border-radius:50%}
.foot{text-align:center;font-size:11px;color:var(--muted);margin-top:14px}
</style></head><body><div class="wrap">
<div class="brand"><div class="mark"><span class="glyph"><span></span><span></span></span>Azimuth</div><div class="today">${th.dow[0]+th.dow.slice(1).toLowerCase()} · ${th.dt}</div></div>
${pulse}
<section><div class="sec"><h2>This week</h2><span class="rule"></span></div>${daysHtml}${nextLine}</section>
${(() => {                                                      // v36.2 — Najma market strip (only when pulse data exists)
    if (!mkt || !mkt.transactions) return "";
    const t2 = mkt.transactions, r2 = mkt.rents || null;
    const off2 = t2.offPlanSplit ? Math.round(100 * (t2.offPlanSplit["Off-Plan"] || 0) / (((t2.offPlanSplit["Off-Plan"] || 0) + (t2.offPlanSplit["Ready"] || 0)) || 1)) : null;
    const y2 = r2 && r2.grossYieldPctByArea && r2.grossYieldPctByArea[0];
    return '<section><a href="/market?key=' + encodeURIComponent(key) + '" style="display:block;text-decoration:none;color:inherit;background:#FFF;border:1px solid var(--line);border-left:3px solid var(--gold);border-radius:var(--radius);padding:.8rem .95rem">' +
      '<div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-weight:700;letter-spacing:.02em">Najma <span style="color:var(--gold)">نجمة</span> · market pulse</span><span style="color:var(--gold);font-weight:600;font-size:.8rem">open →</span></div>' +
      '<div style="color:var(--muted);font-size:.8rem;margin-top:.25rem">AED ' + t2.salesValueAedBn + 'bn registered · ' + (off2 == null ? "" : off2 + "% off-plan") + (y2 ? " · top yield " + y2.area + " " + y2.yieldPct + "%" : "") + '</div>' +
      '<div style="color:var(--muted);font-size:.68rem;margin-top:.15rem">DLD Open Data · ' + String(t2.periodFrom || "") + " → " + String(t2.periodTo || "") + '</div></a></section>';
  })()}
<section><div class="plate-h"><div class="l"><span class="n num">${acts.length}</span><span class="cap">on your plate</span></div><div class="hint">${(env && env.TELEGRAM_TOKEN) ? "clear in Telegram ✓" : "tap a circle to clear ✓"}</div></div>${tasksHtml}
<div class="legend"><span><i style="background:#0A4F4A"></i>Abu Dhabi</span><span><i style="background:#B98B3E"></i>Dubai</span><span><i style="background:#7A4A93"></i>Sharjah</span><span><i style="background:#3E7C8C"></i>Online</span></div>
<div class="foot">Live · ${(env && MB(env).length) ? "meetings from Outlook · actions from your inbox" : "captured from WhatsApp"} · ${upd} GST</div>
</section></div><script>window.__l=Date.now();document.addEventListener("visibilitychange",function(){if(!document.hidden&&Date.now()-window.__l>15000){location.reload()}});window.addEventListener("pageshow",function(e){if(e.persisted){location.reload()}});document.addEventListener("click",function(e){var r=e.target.closest?e.target.closest(".task .ring"):null;if(!r)return;var c=r.closest(".task");var id=c&&c.getAttribute("data-id");if(!id)return;var k=new URLSearchParams(location.search).get("key");if(r.classList.contains("done"))return;r.classList.add("done");fetch("/done?key="+encodeURIComponent(k)+"&id="+encodeURIComponent(id)).then(function(x){if(x.ok){c.style.transition="opacity .3s";c.style.opacity="0.25";setTimeout(function(){c.remove();var n=document.querySelector(".plate-h .n");if(n){n.textContent=Math.max(0,(parseInt(n.textContent,10)||1)-1)}},300)}else{r.classList.remove("done")}}).catch(function(){r.classList.remove("done")})});document.addEventListener("click",function(e){var a=e.target.closest?e.target.closest("a.card"):null;if(a){var h=a.getAttribute("href");if(h){e.preventDefault();try{window.open(h,"_blank")||(location.href=h)}catch(x){location.href=h}}}},true);</script></body></html>`;
}

// --- WhatsApp Cloud API (two-way capture) -------------------------------
const WA_GRAPH = "https://graph.facebook.com/v21.0"; // match your app's Graph version
// Record something that would otherwise vanish into a catch block. Never throws — a broken
// diagnostic must not break the thing it is observing.
async function noteErr(env, where, detail) {
  try {
    const prev = JSON.parse((await env.MEETINGS.get("diag_errs")) || "[]");
    prev.unshift({ at: new Date().toISOString(), where: String(where), detail: String(detail).slice(0, 200) });
    await env.MEETINGS.put("diag_errs", JSON.stringify(prev.slice(0, 20)), { expirationTtl: 7 * 86400 });
  } catch (e) {}
}
// Remember the last outbound that actually succeeded, so "did she get a reply?" is answerable.
async function noteSent(env, kind) {
  try { await env.MEETINGS.put("diag_lastsend", JSON.stringify({ at: new Date().toISOString(), kind: kind }), { expirationTtl: 7 * 86400 }); } catch (e) {}
}
// Send and CHECK. Previously the fetch result was discarded, so a Meta rejection was silent —
// which is exactly how a whole day of "she got two ticks and nothing back" stays mysterious.
async function waPost(env, payload, kind) {
  try {
    const r = await fetch(`${WA_GRAPH}/${env.WA_PHONE_ID}/messages`, {
      method: "POST",
      headers: { Authorization: "Bearer " + env.WHATSAPP_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!r.ok) { const t = await r.text(); await noteErr(env, "whatsapp-send:" + kind, "HTTP " + r.status + " " + t.slice(0, 160)); }
    else await noteSent(env, kind);
    return r;
  } catch (e) { await noteErr(env, "whatsapp-send:" + kind, String(e && e.message || e)); throw e; }
}
async function waSend(env, to, body) {
  return waPost(env, { messaging_product: "whatsapp", to, type: "text", text: { body } }, "text");
}
async function waSendButtons(env, to, body, buttons) {
  return waPost(env, { messaging_product: "whatsapp", to, type: "interactive", interactive: { type: "button", body: { text: body }, action: { buttons: buttons.map(b => ({ type: "reply", reply: { id: b.id, title: b.title } })) } } }, "buttons");
}
// WhatsApp cancel flow: returns a reply string, or null if the message isn't a cancel. Reuses the Telegram cancel plumbing.
async function waHandleCancel(env, from, text) {
  const pk = "wacancel_" + from;
  const pend = JSON.parse((await env.MEETINGS.get(pk)) || "null");
  if (pend && pend.items) {
    const t = text.trim().toLowerCase();
    await env.MEETINGS.delete(pk);
    if (/^(none|no|cancel|stop|nvm|never ?mind)$/.test(t)) return "OK, nothing cancelled.";
    const n = parseInt(t.replace(/[^0-9]/g, ""), 10);
    if (!n || n < 1 || n > pend.items.length) return "Didn't catch a valid number — send a fresh \"cancel\".";
    const it = pend.items[n - 1];
    let ok = false; try { const tok = await msToken(env); ok = await msDelete(env, tok, it.mailbox, it.id); } catch (e) {}
    return ok ? `\u{1F5D1} Cancelled — ${it.summary} (${humanGst(it.start_iso)}).` : "⚠️ Couldn't cancel — try again.";
  }
  if (!(/(^|\b)(cancel|call\s*off)\b/i.test(text))) return null;
  let items = []; try { const tok = await msToken(env); for (const mb of MB(env)) { items = items.concat(await msList(env, tok, mb)); } } catch (e) {}
  items = dedup(items);
  if (!items.length) return "No upcoming meetings found to cancel.";
  const n = await matchCancel(env, text, items);
  if (n >= 1 && n <= items.length) {
    const it = items[n - 1];
    let ok = false; try { const tok = await msToken(env); ok = await msDelete(env, tok, it.mailbox, it.id); } catch (e) {}
    return ok ? `\u{1F5D1} Cancelled — ${it.summary} (${humanGst(it.start_iso)}).` : "⚠️ Couldn't cancel — try again.";
  }
  const lines = items.map((e, i) => `${i + 1}. ${e.summary} — ${humanGst(e.start_iso)}${e.location ? " · " + e.location : ""}`).join("\n");
  await env.MEETINGS.put(pk, JSON.stringify({ items }), { expirationTtl: 900 });
  return `Which one to cancel? Reply the number:\n${lines}`;
}
// Download any WhatsApp media by id. Same two-step as waTranscribe (metadata → signed URL).
// What Claude returns when it reads a photo. Everything required so the model cannot omit a
// field; nulls carry "not present" rather than the key being absent.
const PHOTO_SCHEMA = { type: "object", additionalProperties: false, properties: {
  kind: { type: "string", enum: ["meeting", "tasks", "nothing"] },
  summary: { type: "string" },
  meeting: { type: ["object", "null"], additionalProperties: false, properties: {
    title: { type: "string" }, start_iso: { type: ["string", "null"] }, location: { type: "string" } },
    required: ["title", "start_iso", "location"] },
  tasks: { type: "array", items: { type: "string" } }
}, required: ["kind", "summary", "meeting", "tasks"] };

// Bytes -> base64 without blowing the stack on a multi-MB image.
function b64of(buf) {
  const b = new Uint8Array(buf); let s = "";
  for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192));
  return btoa(s);
}

// Read a photo. Returns null if the model is unavailable or returns nothing usable.
async function readPhoto(env, buf, mime, caption) {
  const sys = `You are reading a photo or screenshot someone sent their assistant. NOW is ${gstNowIso()} (${gstWeekday()}, GST/UTC+4). ${dateHints()}
Decide what it shows:
- "meeting" if it shows ONE specific event with a date (an invite, a ticket, a flyer, a calendar entry). Give title, start_iso (YYYY-MM-DDTHH:MM:00+04:00) and location; start_iso null if no time is legible.
- "tasks" if it shows things to DO (a whiteboard, a checklist, a note, an agenda of actions). Each task a short imperative under 15 words.
- "nothing" if it is a person, a place, a meme, or anything with no commitment in it.
Read dates from the date map above; never calculate a weekday yourself. Prefer "nothing" over guessing. Do not invent detail that is not legible.
"summary" is one plain line (<=20 words) describing what the image actually is.`;
  const content = [
    { type: "image", source: { type: "base64", media_type: (mime || "image/jpeg"), data: b64of(buf) } },
    { type: "text", text: caption ? ("The sender's caption: " + caption) : "No caption." }
  ];
  const g = await claudeJSON(env, sys, content, PHOTO_SCHEMA, CLAUDE_SMART, 700);
  if (!g || !g.kind) return null;
  g.tasks = Array.isArray(g.tasks) ? g.tasks.filter(x => x && String(x).trim()).slice(0, 8) : [];
  if (g.meeting && !g.meeting.title) g.meeting = null;
  return g;
}

async function waFetchMedia(env, mediaId) {
  const meta = await (await fetch(`${WA_GRAPH}/${mediaId}`, { headers: { Authorization: "Bearer " + env.WHATSAPP_TOKEN } })).json();
  if (!meta.url) throw new Error("no media url");
  const r = await fetch(meta.url, { headers: { Authorization: "Bearer " + env.WHATSAPP_TOKEN } });
  return { bytes: await r.arrayBuffer(), mime: (meta.mime_type || r.headers.get("content-type") || "image/jpeg").split(";")[0] };
}
// "this is me" / "my photo" / "set as background" / "backdrop" — deliberately loose; a wrong
// match only costs a board backdrop, and the reply says how to undo it.
function isBgCaption(c) {
  c = String(c || "").trim();
  if (!c) return false;
  return /\b(this is me|that'?s me|it'?s me|my (photo|picture|pic|portrait|face)|(set|use|make)\b.*\b(background|backdrop|board)|background|backdrop|wallpaper)\b/i.test(c);
}
async function waTranscribe(env, mediaId) {
  const meta = await (await fetch(`${WA_GRAPH}/${mediaId}`, { headers: { Authorization: "Bearer " + env.WHATSAPP_TOKEN } })).json();
  if (!meta.url) throw new Error("no media url");
  const buf = await (await fetch(meta.url, { headers: { Authorization: "Bearer " + env.WHATSAPP_TOKEN } })).arrayBuffer();
  const bytes = new Uint8Array(buf); let bin = ""; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const out = await env.AI.run(STT, { audio: btoa(bin) });
  return (out && out.text ? out.text : "").trim();
}
// Constant-time equality for short secrets; length leak is acceptable, byte-position leak is not.
function ctEq(a, b) {
  a = String(a || ""); b = String(b || "");
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
async function waVerifySig(env, raw, sig) {
  if (!env.WA_APP_SECRET) return true;                 // skip if not configured
  if (!sig || !sig.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.WA_APP_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  const hex = [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, "0")).join("");
  return ("sha256=" + hex) === sig;
}
// Files a meeting or task from free text; returns a reply string. Channel-agnostic core.
async function captureText(env, text, source, from) {
  const intent = await classifyIntent(env, text);
  if (intent && intent.kind === "task" && intent.text) {
    { const _dup = await findDupTask(env, intent.text); if (_dup) { const dmsg = "📋 Already on your plate — " + intent.text; if (from) { try { await waSend(env, from, dmsg); return ""; } catch (e) {} } return dmsg; } }
    const aid = rid();
    await env.MEETINGS.put("act_" + aid, JSON.stringify({ id: aid, text: intent.text, from: "you", created: Date.now(), due_iso: intent.due_iso || null, src: { type: "captured", channel: source } }), { expirationTtl: 30 * 86400 }); try { await indexDoc(env, "act_" + aid, "task", intent.text, { type: "captured", channel: source }); } catch (e) {} try { if (intent.commitment) await cmtPut(env, "act_" + aid, { text: intent.text, direction: intent.commitment.direction, counterparty: intent.commitment.counterparty, due_hint: intent.commitment.due_hint }, { type: "captured", channel: source }); } catch (e) {}
    const tbody = `\u{1F4CB} ${intent.text}${intent.due_iso ? "\n⏰ " + humanGst(intent.due_iso) + " GST" : ""}\nAdded to your plate.`;
    if (from) { try { await waSendButtons(env, from, tbody, [{ id: "done:" + aid, title: "✅ Done" }]); return ""; } catch (e) {} }
    return tbody;
  }
  const parsed = await parseMeeting(env, text);
  if (!parsed.ok || !parsed.start_iso) return "\u{1F5D3} When is it? Reply like \"3pm Saturday in Dubai\".";
  const event = { summary: parsed.title || "Meeting", start_iso: parsed.start_iso, location: (parsed.location || "").trim(), source, src: { type: "captured", channel: source } };
  const u = text.match(/https?:\/\/\S+/i); if (u) event.join = u[0].replace(/[)>\].,;'"]+$/, "");
  if (isVenue(event.location) && env.MAPS_KEY) {
    const mem = JSON.parse((await env.MEETINGS.get(venueKey(event.location))) || "null");
    if (mem && mem.address) event.location = mem.address;
    else { const cands = await placesSearch(env, event.location); if (cands.length) event.location = cands[0].address; }
  }
  let inOutlook = false;
  try { const tok = await msToken(env); const oid = await msCreate(env, tok, AT(env), event); if (oid) { inOutlook = true; event.outlook_id = oid; event.mailbox = AT(env); } } catch (e) {}
  await env.MEETINGS.put("evt_" + Date.now() + "_" + rid(), JSON.stringify(event), { expirationTtl: 60 * 60 * 24 * 21 }); try { await indexDoc(env, "evt_" + rid(), "meeting", (event.summary || "") + " " + (event.location || "") + (event.start_iso ? " " + event.start_iso.slice(0, 10) + " " + humanGst(event.start_iso) + " GST" : ""), event.src || null); } catch (e) {}
  return `✅ Got it — ${event.summary}\n\u{1F5D3} ${humanGst(event.start_iso)} GST${event.location ? " · " + event.location : ""}\n${inOutlook ? "\u{1F4C5} Added to your Outlook calendar. " : ""}Reminders set. \u{1F9ED}`;
}
// Normalises the optional commitment the classifier may attach to a captured item.
// Returns null unless a real counterparty is named, so a hallucinated or empty name can never
// reach the ledger — an invented counterparty is worse than a missing one.
function normCmt(c) {
  if (!c || typeof c !== "object") return null;
  const cp = String(c.counterparty || "").trim();
  if (!cp || /^(none|n\/a|na|nobody|no one|unknown|someone|null)$/i.test(cp)) return null;
  const d = c.direction === "owed_to_me" ? "owed_to_me" : "owed_by_me";
  return { direction: d, counterparty: cp, due_hint: String(c.due_hint || "").trim() };
}
async function classifyIntent(env, text) {
  const sys = `Classify Kendall's message as a TASK or a MEETING. NOW is ${gstNowIso()} (${gstWeekday()}). ${dateHints()}
The ACTION VERB decides. TASK = something HE does himself — call, email, send, text, message, reply, follow up, chase, pay, invoice, submit, review, sign, approve, book, order, buy, prepare, draft, finish, remind. A TASK is still a TASK even if it names a time or a company ("call Sara 3pm tomorrow, Trojan" = TASK due 15:00 — capture the time).
MEETING = an event he ATTENDS with other people or at a venue/platform — "meeting", "meet", "sync", "catch up", "lunch", "interview", "conference", "session", or clearly gathering with someone (e.g. "meeting Monday in Dubai", "Zoom with the team 2pm").
Prefer TASK when he is performing an action; choose MEETING only for an event he attends. Read all dates from the date map above — never calculate a weekday; 3pm->15:00, 9am->09:00, noon->12:00.
Also set "commitment" when a NAMED person or organisation is waiting on this — direction "owed_by_me" if Kendall promised it to them, "owed_to_me" if they owe it to Kendall; counterparty = that person or org exactly as named; due_hint = any stated timing, verbatim, else "". Private work with nobody waiting is NOT a commitment. NEVER invent a counterparty — use null when none is named.
Output ONLY JSON: {"kind":"task","text":"<short imperative, <15 words>","due_iso":"YYYY-MM-DDTHH:MM:00+04:00" or null,"commitment":{"direction":"owed_by_me","counterparty":"Sara","due_hint":"Friday"} or null} or {"kind":"meeting","commitment":null}.`;
  const g = await claudeJSON(env, sys, text, CLASSIFY_SCHEMA);
  if (g && (g.kind === "task" || g.kind === "meeting")) {
    if (g.kind === "task" && g.text && String(g.text).trim()) return { kind: "task", text: String(g.text).trim(), due_iso: (g.due_iso && /^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(String(g.due_iso))) ? String(g.due_iso) : null, commitment: normCmt(g.commitment) };
    return { kind: "meeting" };
  }
  try {
    const res = await env.AI.run(MODEL, { messages: [{ role: "system", content: sys }, { role: "user", content: text }], max_tokens: 200, temperature: 0 });
    const m = asText(res).match(/\{[\s\S]*\}/); if (!m) return null;
    const j = JSON.parse(m[0]);
    if (j.kind === "task" && j.text && String(j.text).trim()) return { kind: "task", text: String(j.text).trim(), due_iso: (j.due_iso && /^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(String(j.due_iso))) ? String(j.due_iso) : null, commitment: normCmt(j.commitment) };
    return { kind: "meeting" };
  } catch (e) { return null; }
}
async function parseMeeting(env, text) {
  const sys = `You convert a message into ONE meeting in the UAE (GST, UTC+4). NOW is ${gstNowIso()} (${gstWeekday()}). ${dateHints()} Output ONLY compact JSON: {"ok":true,"title":"...","start_iso":"YYYY-MM-DDTHH:MM:00+04:00","location":"..."}. Resolve dates ONLY from the date map above — never calculate a weekday yourself; no year->nearest future; 9am->09:00,3pm->15:00,noon->12:00; date/day w/o time->09:00; title short else "Meeting"; location = any venue/company/place/city/platform the message names (e.g. Amana, Trojan, "Dubai Opera", Dubai, Sharjah, Zoom, Teams, online) else ""; {"ok":false} only if no date/day. Parts split by " | " combine.`;
  const g = await claudeJSON(env, sys, text, PARSE_SCHEMA);
  if (g && typeof g.ok === "boolean") return { ok: g.ok, title: g.title || "", start_iso: g.start_iso || "", location: g.location || "" };
  const res = await env.AI.run(MODEL, { messages: [{ role: "system", content: sys }, { role: "user", content: text }], max_tokens: 300, temperature: 0.1 }); const m = asText(res).match(/\{[\s\S]*\}/); if (!m) return { ok: false }; try { return JSON.parse(m[0]); } catch (e) { return { ok: false }; }
}
async function transcribe(env, fileId) { const gf = await (await fetch(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/getFile?file_id=${fileId}`)).json(); const buf = await (await fetch(`https://api.telegram.org/file/bot${env.TELEGRAM_TOKEN}/${gf.result.file_path}`)).arrayBuffer(); const bytes = new Uint8Array(buf); let bin = ""; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]); const out = await env.AI.run(STT, { audio: btoa(bin) }); return (out && out.text ? out.text : "").trim(); }
async function matchCancel(env, text, items) { const listStr = items.map((e, i) => `${i + 1}. ${e.summary} — ${humanGst(e.start_iso)}${e.location ? " (" + e.location + ")" : ""}`).join("\n"); try { const res = await env.AI.run(MODEL, { messages: [{ role: "system", content: `User cancels ONE meeting. Msg: "${text}". Meetings:\n${listStr}\nReply ONLY {"n":<number>} or {"n":0} if unclear.` }, { role: "user", content: text }], max_tokens: 40, temperature: 0 }); const m = asText(res).match(/\{[\s\S]*\}/); if (m) { const n = parseInt(JSON.parse(m[0]).n, 10); if (n >= 1 && n <= items.length) return n; } } catch (e) {} return 0; }
const STOPW = new Set(["meeting","call","with","the","and","for","weekly","catch","team","digital","abbot","review","sync","zoom","teams","online"]);
function words(s) { return ((s || "").toLowerCase().match(/[a-z]{4,}/g) || []).filter(w => !STOPW.has(w)); }
function dedup(items) {
  const sorted = items.sort((a, b) => (Date.parse(a.start_iso) || 0) - (Date.parse(b.start_iso) || 0));
  const out = [];
  for (const e of sorted) {
    const slot = (e.start_iso || "").slice(0, 16);
    const ew = words(e.summary); const es = (e.summary || "").toLowerCase().trim();
    let dupOf = null;
    for (const o of out) {
      if ((o.start_iso || "").slice(0, 16) !== slot) continue;
      const os = (o.summary || "").toLowerCase().trim();
      const shares = words(o.summary).some(w => ew.includes(w));
      if (es === os || shares || es === "meeting" || os === "meeting" || es === "(no title)" || os === "(no title)") { dupOf = o; break; }
    }
    if (dupOf) { if ((e.join && !dupOf.join) || (e.summary || "").length > (dupOf.summary || "").length) { dupOf.summary = e.summary; dupOf.location = e.location; dupOf.join = e.join || dupOf.join; } continue; }
    out.push(e);
  }
  return out;
}

// ===== Commitment Ledger (experiment) =====
// Tasks answer "what must I do". Commitments answer "who is waiting on me, and what am I waiting on".
// Stored SEPARATELY from act_ records so the working task pipeline is untouched.
// Keys are DETERMINISTIC (cmt_act_<id> / cmt_msg_<msgId>_<n>) so re-running never duplicates.
const CMT_TTL = 180 * 86400;
const CLASSIFY_CMT_SCHEMA = { type: "object", additionalProperties: false, properties: { is_commitment: { type: "boolean" }, direction: { type: "string", enum: ["owed_by_me", "owed_to_me", "none"] }, counterparty: { type: "string" }, due_hint: { type: "string" } }, required: ["is_commitment", "direction", "counterparty", "due_hint"] };

async function cmtPut(env, key, c, src) {
  if (!c || !c.text || !c.counterparty) return false;
  if (isOwnBrand(env, c.counterparty)) return false;   // v35.1 — own brand is not a counterparty who owes anything
  const d = c.direction === "owed_to_me" ? "owed_to_me" : "owed_by_me";
  await env.MEETINGS.put("cmt_" + key, JSON.stringify({
    id: key, text: String(c.text).trim(), direction: d, counterparty: String(c.counterparty).trim(),
    due_hint: String(c.due_hint || "").trim(), src: src || null, created: Date.now()
  }), { expirationTtl: CMT_TTL });
  return true;
}
async function openCommitments(env) {
  const list = await env.MEETINGS.list({ prefix: "cmt_" });
  const out = [];
  const CH = 25;
  for (let i = 0; i < list.keys.length; i += CH) {
    const vals = await Promise.all(list.keys.slice(i, i + CH).map(k => env.MEETINGS.get(k.name).catch(() => null)));
    for (const v of vals) { if (!v) continue; try { out.push(JSON.parse(v)); } catch (e) {} }
  }
  out.sort((a, b) => (a.created || 0) - (b.created || 0));   // oldest first — aging is the point
  return out;
}
// One-shot: read the EXISTING task list and infer the commitment behind each one.
// Lets the ledger be judged against the real corpus today, before new mail accrues.
async function ledgerRebuild(env) {
  const acts = await openActions(env);
  let made = 0, skipped = 0, failed = 0;
  for (const a of acts) {
    if (!a || !a.id || !a.text) continue;
    const sys = "You decide whether a to-do represents an interpersonal COMMITMENT — something a named person or organisation is waiting on. "
      + "owed_by_me = Kendall Wilson promised it to someone else. owed_to_me = someone else owes it to Kendall. "
      + "If it is just private work with no counterparty waiting (e.g. 'review the spreadsheet', 'submit annual accounts'), set is_commitment false and direction none. "
      + "counterparty = the person or organisation, as named. due_hint = any stated timing, verbatim, else empty string. Never invent a counterparty.";
    const usr = "To-do: " + a.text + (a.from && a.from !== "you" ? NL10 + "Came from email sender: " + a.from : "") + (a.subject ? NL10 + "Email subject: " + a.subject : "");
    const g = await claudeJSON(env, sys, usr, CLASSIFY_CMT_SCHEMA, CLAUDE_SMART, 200);
    if (!g) { failed++; continue; }                                   // model call returned nothing
    if (!g.is_commitment || g.direction === "none" || !g.counterparty) { skipped++; continue; }   // genuinely not a commitment
    if (await cmtPut(env, "act_" + a.id, { text: a.text, direction: g.direction, counterparty: g.counterparty, due_hint: g.due_hint }, a.src || null)) made++;
  }
  return { made: made, skipped: skipped, failed: failed, scanned: acts.length };
}
// ─────────────────────────────────────────────────────────────────────────────
// v30 (17 Aug 2026) — PASSIVE GROUP-CHAT INGEST.  POST /ingest
//
// A linked-device listener (azimuth-listener/) observes Kendall's real WhatsApp GROUP chats —
// the threads where logistics actually get settled — and posts candidate lines here.
//
// This path is deliberately NARROW and STRICTLY READ-ONLY:
//   * it writes cmt_ records ONLY. It never files a task, never touches the calendar,
//     never indexes, never replies.
//   * there is NO send call anywhere in it, by design. Observed groups carry other people's
//     messages; Azimuth must never speak into them.
//   * 1:1 chats are filtered out at the listener and REJECTED AGAIN here (not_group).
//
// Auth: header X-Azimuth-Ingest must equal INGEST_TOKEN (constant-time compare).
// Idempotent per WhatsApp message id via wachat_<id>, so replays and re-syncs are free.
const INGEST_MAX = 25;                 // items per request — keeps us inside Worker CPU limits
const WACHAT_TTL = 45 * 86400;         // dedupe-marker lifetime

async function ingestOne(env, it) {
  if (it && it.kind === "group_seen") return groupSeen(env, it); // registry event, not a message
  if (!it || !it.id || !it.text) return "bad";
  if (!it.is_group) return "not_group";                        // belt and braces — groups only
  const _grec = await grpGet(env, it.chat);                    // v31 backstop: OPT-IN only
  if (!_grec || !_grec.enabled) return "not_enabled";
  const mk = "wachat_" + String(it.id).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 96);
  if (await env.MEETINGS.get(mk)) return "dup";
  await env.MEETINGS.put(mk, "1", { expirationTtl: WACHAT_TTL });

  const speaker = it.from_me ? "Kendall Wilson (the user himself)" : (it.sender_name || it.sender || "another participant");
  const sys = "You decide whether ONE line from a WhatsApp group conversation contains an interpersonal COMMITMENT — "
    + "something a named person is now waiting on. "
    + "owed_by_me = Kendall Wilson promised or agreed to do it. owed_to_me = someone else promised it to Kendall or to the group. "
    + "Group chat is informal: 'will do', 'on it', 'I'll send it tonight', 'can you share the BOQ by Thursday' all count. "
    + "Small talk, opinions, questions carrying no promise, greetings, forwarded links and jokes are NOT commitments — set is_commitment false. "
    + "counterparty = the person or organisation waiting, as named; if only the group as a whole is waiting, use the group name. Never invent one. "
    + "due_hint = any stated timing, verbatim, else empty string.";
  const usr = "Group: " + (it.chat_name || "(unnamed group)") + NL10
    + "Speaker: " + speaker + NL10
    + "Message: " + String(it.text).slice(0, 900);
  const g = await claudeJSON(env, sys, usr, CLASSIFY_CMT_SCHEMA, CLAUDE_SMART, 200);
  if (!g) return "failed";                                     // model unreachable — marker already set, see /ingest notes
  if (!g.is_commitment || g.direction === "none" || !g.counterparty) return "skipped";
  const src = { type: "whatsapp-group", ref: String(it.chat || ""), label: String(it.chat_name || "WhatsApp group") };
  const ok = await cmtPut(env, "wa_" + mk.replace(/^wachat_/, ""), {
    text: it.text, direction: g.direction, counterparty: g.counterparty, due_hint: g.due_hint
  }, src);
  return ok ? "made" : "skipped";
}

// v31 — GROUP REGISTRY + IN-CHAT OPT-IN.  Groups default OFF. When the listener first sees a
// group it posts {kind:"group_seen"}; Azimuth WhatsApps Kendall "Monitor / Ignore" buttons.
// Nothing from a group is processed until he taps Monitor. The listener also polls GET /groups
// so it can skip disabled groups at the source — the Worker check here is the backstop.
function grpKey(jid) { return "grp_" + String(jid || "").replace(/[^A-Za-z0-9@._-]/g, "").slice(0, 96); }
async function grpGet(env, jid) { try { const v = await env.MEETINGS.get(grpKey(jid)); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
async function grpSet(env, jid, rec) { await env.MEETINGS.put(grpKey(jid), JSON.stringify(rec)); }
async function listGroups(env) {
  const l = await env.MEETINGS.list({ prefix: "grp_" });
  const out = [];
  const CH = 25;
  for (let i = 0; i < l.keys.length; i += CH) {
    const vals = await Promise.all(l.keys.slice(i, i + CH).map(k => env.MEETINGS.get(k.name).catch(() => null)));
    for (const v of vals) { if (!v) continue; try { out.push(JSON.parse(v)); } catch (e) {} }
  }
  out.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  return out;
}
// v33 — self-contained groups management page. One toggle per group, tap to watch/ignore,
// search filter, no typing. WhatsApp messages can't render per-row toggles (≤3 buttons / a
// single-select menu only), so the opt-in UI lives on a hosted page like the board.
function renderGroupsUi(groups, key) {
  const enabled = groups.filter(g => g.enabled);
  const rest = groups.filter(g => !g.enabled);
  const k = esc(key || "");
  const row = (g) => {
    const on = !!g.enabled;
    return '<div class="g" data-name="' + esc(String(g.name || "").toLowerCase()) + '">'
      + '<span class="nm">' + esc(g.name || "(unnamed group)") + '</span>'
      + '<button class="tg' + (on ? ' on' : '') + '" data-jid="' + esc(g.jid) + '" onclick="tog(this)">'
      + (on ? '👁 Watching' : 'Watch') + '</button></div>';
  };
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<title>Azimuth · Groups</title><style>'
    + 'body{margin:0;background:#0A4F4A;color:#FAF8F3;font:16px/1.4 -apple-system,system-ui,sans-serif}'
    + '.wrap{max-width:640px;margin:0 auto;padding:18px}'
    + 'h1{font-size:20px;margin:6px 0 2px}.sub{opacity:.7;font-size:13px;margin-bottom:14px}'
    + '#q{width:100%;box-sizing:border-box;padding:12px 14px;border:0;border-radius:12px;margin-bottom:14px;font-size:16px;background:rgba(255,255,255,.12);color:#fff}'
    + '.sec{font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.6;margin:16px 0 8px}'
    + '.g{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 12px;background:rgba(255,255,255,.06);border-radius:10px;margin-bottom:7px}'
    + '.nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
    + '.tg{flex:none;border:0;border-radius:20px;padding:8px 15px;font-size:14px;font-weight:600;background:rgba(255,255,255,.16);color:#fff;cursor:pointer}'
    + '.tg.on{background:#C5A56A;color:#0A2E2B}'
    + '.empty{opacity:.5;font-size:14px;padding:8px 2px}'
    + '</style></head><body><div class="wrap">'
    + '<h1>Your WhatsApp groups</h1><div class="sub">Tap to watch or ignore. Watched groups feed your ledger. Nothing else is read.</div>'
    + '<input id="q" placeholder="Search groups…" oninput="filt()">'
    + '<div class="sec">Watching (' + enabled.length + ')</div><div id="on">' + (enabled.length ? enabled.map(row).join("") : '<div class="empty">None yet — tap Watch on any group below.</div>') + '</div>'
    + '<div class="sec">All groups (' + rest.length + ')</div><div id="off">' + rest.map(row).join("") + '</div>'
    + '<script>'
    + 'var K="' + k + '";'
    + 'function filt(){var v=document.getElementById("q").value.toLowerCase();document.querySelectorAll(".g").forEach(function(g){g.style.display=g.dataset.name.indexOf(v)>-1?"":"none"})}'
    + 'function tog(b){var on=!b.classList.contains("on");b.disabled=true;'
    + 'fetch("/group_set?key="+encodeURIComponent(K)+"&jid="+encodeURIComponent(b.dataset.jid)+"&on="+(on?1:0))'
    + '.then(function(r){return r.json()}).then(function(j){b.disabled=false;if(j&&j.ok){b.classList.toggle("on",j.enabled);b.textContent=j.enabled?"👁 Watching":"Watch";}}).catch(function(){b.disabled=false});}'
    + '</script></div></body></html>';
}
async function groupSeen(env, it) {
  if (!it || !it.chat) return "bad";
  const have = await grpGet(env, it.chat);
  if (have) {                                                   // name refresh only — never re-prompt
    if (it.chat_name && it.chat_name !== have.name) { have.name = it.chat_name; await grpSet(env, it.chat, have); }
    return "dup";
  }
  await grpSet(env, it.chat, { jid: it.chat, name: String(it.chat_name || "(unnamed group)").slice(0, 120), enabled: false, seen: Date.now(), decided: 0 });
  // Prompt throttle — on first pairing the listener reports EVERY group at once; 30 button
  // messages is a flood. First 5 in an hour prompt individually, then ONE summary message.
  try {
    if (env.WHATSAPP_TOKEN && env.WA_ALLOWED) {
      const hk = "grpprompt_" + Math.floor(Date.now() / 3600000);
      const n = parseInt(await env.MEETINGS.get(hk) || "0", 10) + 1;
      await env.MEETINGS.put(hk, String(n), { expirationTtl: 7200 });
      if (n <= 5) {
        await waSendButtons(env, env.WA_ALLOWED,
          "👀 New WhatsApp group seen — “" + String(it.chat_name || "(unnamed group)").slice(0, 80) + "”.\nWant Azimuth to watch it for commitments and meetings? It only reads — it never posts.",
          [{ id: "ga:" + it.chat, title: "✅ Monitor" }, { id: "gi:" + it.chat, title: "🙈 Ignore" }]);
      } else if (n === 6) {
        await waSend(env, env.WA_ALLOWED, "👀 More new groups seen — say “list groups” to review the rest and “watch <name>” to enable any of them.");
      }
    }
  } catch (e) {}
  return "made";
}
async function ingestMessages(env, items) {
  const list = Array.isArray(items) ? items.slice(0, INGEST_MAX) : [];
  const tally = { received: list.length, made: 0, skipped: 0, dup: 0, failed: 0, bad: 0, not_group: 0, not_enabled: 0 };
  const seen = list.filter(x => x && x.kind === "group_seen"); // registry events run SEQUENTIALLY —
  const msgs = list.filter(x => !x || x.kind !== "group_seen"); // the prompt-throttle counter is read-modify-write
  for (const s of seen) {
    const r = await ingestOne(env, s).catch(() => "failed");
    if (Object.prototype.hasOwnProperty.call(tally, r)) tally[r]++;
  }
  const CH = 5;                                                // small chunks — each item is a model call
  for (let i = 0; i < msgs.length; i += CH) {
    const rs = await Promise.all(msgs.slice(i, i + CH).map(x => ingestOne(env, x).catch(() => "failed")));
    for (const r of rs) if (Object.prototype.hasOwnProperty.call(tally, r)) tally[r]++;
  }
  return tally;
}
// Meetings captured into KV (evt_). On a mailbox-less instance these are the ONLY meetings
// there are; on Kendall's they are a superset that dedup() reconciles against Outlook.
async function capturedMeetings(env) {
  const out = [];
  try {
    const l = await env.MEETINGS.list({ prefix: "evt_" });
    const CH = 25;
    for (let i = 0; i < l.keys.length; i += CH) {
      const vals = await Promise.all(l.keys.slice(i, i + CH).map(k => env.MEETINGS.get(k.name).catch(() => null)));
      for (const v of vals) {
        if (!v) continue;
        let e; try { e = JSON.parse(v); } catch (er) { continue; }
        if (!e || !e.start_iso) continue;
        out.push({ mailbox: "", id: e.outlook_id || "", summary: e.summary || "(no title)", start_iso: e.start_iso, location: e.location || "", join: e.join || "" });
      }
    }
  } catch (e) {}
  return out;
}
// ─────────────────────────────────────────────────────────────────────────────
// v32 (18 Aug 2026) — MEETING NUDGES: WhatsApp text at T-30 and T-15, plus an
// optional ring via a provider-agnostic call hook.
//
// CADENCE: needs the Worker cron at */5 (every 5 min) for the windows below to land.
// At the legacy 0,30 cadence a T-30 fire can arrive at T-42/T-12 — still useful, but
// change the Cron Trigger to `*/5 3-18 * * *` for accuracy. Windows are WIDE (±half a
// cadence) and idempotent so a nudge fires exactly once even if two ticks fall inside.
//
// mapsLink: a plain web Maps search the phone opens as tap-to-navigate (board uses the
// same pattern). Physical location only — never for online meetings.
function mapsLink(loc) {
  const s = String(loc || "").trim();
  if (!s || /^https?:\/\//i.test(s)) return "";                 // blank or already a URL (join link)
  return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(s);
}
// All upcoming meetings across Outlook + captured, de-duplicated by summary+start slot.
async function upcomingMeetings(env) {
  const out = [];
  try {
    const tok = await msToken(env);
    if (tok) for (const mb of MB(env)) { try { const l = await msList(env, tok, mb); out.push(...l); } catch (e) {} }
  } catch (e) {}
  try { out.push(...await capturedMeetings(env)); } catch (e) {}
  const seen = new Set(), keep = [];
  for (const m of out) {
    if (!m || !m.start_iso) continue;
    const k = (m.summary || "").toLowerCase().trim() + "|" + m.start_iso.slice(0, 16);
    if (seen.has(k)) continue;
    seen.add(k); keep.push(m);
  }
  return keep;
}
// The optional ring. Provider-agnostic and DEPLOY-SAFE: if no CALL_* env is set it is a
// silent no-op, so v32 deploys and nudges-by-text with zero call config. When a caller is
// wired (Green-API instance, or CallMeBot key), set CALL_URL to a template with {phone}
// and {text} placeholders and CALL_PROVIDER for logging. Never throws into the nudge path.
function xmlEsc(s) { return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;"); }
function callConfigured(env) { return !!((env.TWILIO_SID && env.TWILIO_TOKEN && env.TWILIO_FROM) || env.CALL_URL); }
// The ring. v34 adds native Twilio (a real phone call that SPEAKS the meeting). Twilio wins if
// configured; otherwise the generic CALL_URL template (CallMeBot / Green-API / anything). Deploy-
// safe: no provider set = silent no-op. Never throws into the nudge path.
async function ringNudge(env, phone, text) {
  try {
    if (!phone) return { ok: false, skipped: "no-target" };
    // Twilio: POST to the Calls API with inline TwiML <Say>. Basic auth = SID:token.
    if (env.TWILIO_SID && env.TWILIO_TOKEN && env.TWILIO_FROM) {
      const to = String(phone).trim().startsWith("+") ? String(phone).trim() : "+" + String(phone).replace(/[^0-9]/g, "");
      const voice = env.TWILIO_VOICE || "Polly.Arthur-Neural";
      const twiml = '<Response><Say voice="' + xmlEsc(voice) + '">' + xmlEsc(String(text).slice(0, 300)) + '</Say></Response>';
      const body = new URLSearchParams({ To: to, From: env.TWILIO_FROM, Twiml: twiml });
      const r = await fetch("https://api.twilio.com/2010-04-01/Accounts/" + encodeURIComponent(env.TWILIO_SID) + "/Calls.json", {
        method: "POST",
        headers: { "Authorization": "Basic " + btoa(env.TWILIO_SID + ":" + env.TWILIO_TOKEN), "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString()
      });
      return { ok: r.ok, status: r.status, provider: "twilio" };
    }
    // Generic URL-template fallback.
    if (env.CALL_URL) {
      const url = env.CALL_URL
        .replace("{phone}", encodeURIComponent(String(phone).replace(/[^0-9]/g, "")))
        .replace("{text}", encodeURIComponent(String(text).slice(0, 300)));
      const r = await fetch(url, { method: env.CALL_METHOD || "GET", headers: env.CALL_AUTH ? { "Authorization": env.CALL_AUTH } : {} });
      return { ok: r.ok, status: r.status, provider: env.CALL_PROVIDER || "custom" };
    }
    return { ok: false, skipped: "unconfigured" };
  } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
}
// One nudge pass. Fires per meeting at T-30 and T-15 (separate idempotency markers), each
// carrying the title, GST time, and a tap-to-navigate Maps link (or the join link online).
async function meetingNudges(env) {
  const now = Date.now();
  const meetings = await upcomingMeetings(env);
  let fired = 0;
  for (const m of meetings) {
    const t = Date.parse(m.start_iso); if (isNaN(t)) continue;
    const minsOut = (t - now) / 60000;
    for (const lead of [30, 15]) {
      // window = lead ± 3.5 min, so a 5-min cron always catches it once
      if (minsOut <= lead + 3.5 && minsOut > lead - 3.5) {
        const idBase = (m.id || (m.summary + m.start_iso)).replace(/[^A-Za-z0-9]/g, "").slice(0, 60);
        const mk = "nudge" + lead + "_" + idBase;
        if (await env.MEETINGS.get(mk)) continue;               // already nudged at this lead
        await env.MEETINGS.put(mk, "1", { expirationTtl: 6 * 3600 });
        const online = m.join && /^https?:\/\//i.test(m.join);
        const nav = online ? m.join : mapsLink(m.location);
        const when = humanGst(m.start_iso).replace(/^\w{3},\s*/, "");   // drop weekday, keep "18 Aug 16:00"
        let body = "⏰ In " + lead + " min — " + (m.summary || "meeting")
          + "\n🕓 " + when + " GST"
          + (m.location && !online ? "\n📍 " + m.location : "")
          + (nav ? "\n" + (online ? "Join: " : "Map: ") + nav : "");
        if (lead === 30) { try { body += await meetingPrepBrief(env, m); } catch (e) {} }   // v35 — relationship brief on the T-30 nudge
        try { if (env.WHATSAPP_TOKEN && env.WA_ALLOWED) await waSend(env, env.WA_ALLOWED, body); } catch (e) {}
        try { if (env.TELEGRAM_CHAT_ID) await tg(env, "sendMessage", { chat_id: env.TELEGRAM_CHAT_ID, disable_web_page_preview: true, text: body }); } catch (e) {}
        // The ring — only at T-15 by default (one call, not two), gated on a configured provider.
        if (lead === 15 && callConfigured(env) && (env.CALL_TO || env.WA_ALLOWED)) {
          try { await ringNudge(env, env.CALL_TO || env.WA_ALLOWED, (m.summary || "meeting") + " in 15 minutes" + (m.location && !online ? " at " + m.location : "")); } catch (e) {}
        }
        fired++;
      }
    }
  }
  return fired;
}
function ageDays(ts) { return Math.max(0, Math.floor((Date.now() - (ts || Date.now())) / 86400000)); }
// ── v35 RELATIONSHIP MEMORY — counterparty-indexed view ──────────────────────
// A "temporal obligation graph" delivered as a VIEW over flat KV: resolve every
// commitment + meeting to a canonical party, group by party, synthesise on demand.
// Deterministic resolution (normalise + unambiguous token-subset) + a manual `merge`
// alias map that survives reindex. Claude-assisted disambiguation deferred to v1.1.
function partyStop(w) { return /^(the|a|an|team|group|from|at|of|and|inc|ltd|llc|co|company|corp|dept|department|pvt|limited)$/i.test(w); }
function normName(str) {
  let s = String(str || "").trim(), org = "";
  let m = s.match(/^(.*?)\s*[\(\[]([^\)\]]+)[\)\]]\s*$/); if (m) { s = m[1].trim(); org = m[2].trim(); }   // X (Y)
  m = s.match(/^(.*?)\s+(?:from|@|at|of)\s+(.+)$/i); if (m) { s = m[1].trim(); org = org || m[2].trim(); } // X from Y
  s = s.replace(/^(dr|mr|mrs|ms|prof|sir|eng)\.?\s+/i, "");                                                 // honorifics
  return { name: s, org };
}
function pslug(str) { return String(str || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "unknown"; }
function nameKey(str) { return pslug(normName(str).name); }
function nameTokens(str) { return normName(str).name.toLowerCase().split(/\s+/).filter(w => w.length > 1 && !partyStop(w)); }
function keyTokens(key) { return String(key || "").split("-").filter(w => w.length > 1 && !partyStop(w)); }
// A party's match variants = its canonical tokens + each alias's tokens. Matching a haystack
// means ANY variant's tokens ALL appear — so "Bhaskar Raman" (alias "bhaskar") matches a meeting
// titled just "Bhaskar", without a bare first name matching everyone.
function partyVariants(p) { const vs = [nameTokens(p.name || "")]; for (const a of (p.aliases || [])) { const t = keyTokens(a); if (t.length) vs.push(t); } return vs.filter(v => v.length); }
function hayMatchParty(hay, p) { const h = String(hay || "").toLowerCase(); return partyVariants(p).some(v => v.every(t => h.includes(t))); }
async function paliasGet(env, key) { try { return await env.MEETINGS.get("palias_" + key); } catch (e) { return null; } }
// Resolve one counterparty string to a party slug, using an in-run cache [{key,slug,name,org,tokens,aliasKeys}].
async function resolveParty(env, str, cache) {
  const nm = normName(str); if (!nm.name) return null;
  if (isOwnBrand(env, str)) return null;   // v35.1 — own brand never becomes a party
  const key = pslug(nm.name);
  const pinned = await paliasGet(env, key); if (pinned) return pinned;                 // manual merge wins
  for (const p of cache) if (p.key === key) return p.slug;                             // exact
  const toks = new Set(nameTokens(str));
  const subs = cache.filter(p => { const pt = new Set(p.tokens); const a = [...toks].every(t => pt.has(t)), b = [...pt].every(t => toks.has(t)); return toks.size && (a || b); });
  if (subs.length === 1) { subs[0].aliasKeys.add(key); return subs[0].slug; }          // unambiguous subset (Bhaskar ⊂ Bhaskar Raman)
  const slug = pslug(nm.name);
  cache.push({ key, slug, name: nm.name, org: nm.org, tokens: nameTokens(str), aliasKeys: new Set([key]) });
  return slug;
}
// Rebuild the party_ registry from all cmt_ + evt_ records. Idempotent. Preserves manual merges.
async function peopleReindex(env) {
  const cmts = await openCommitments(env);
  const meetings = await capturedMeetings(env).catch(() => []);
  const cache = [], parties = {};
  const ensure = (slug, name, org) => (parties[slug] = parties[slug] || { slug, name, org: org || "", commitment_ids: [], meeting_refs: [], last_activity: 0, first_seen: Infinity });
  for (const c of cmts) {
    if (!c || !c.counterparty || !c.id) continue;
    const slug = await resolveParty(env, c.counterparty, cache); if (!slug) continue;
    const cc = cache.find(x => x.slug === slug) || {};
    const p = ensure(slug, cc.name || c.counterparty, cc.org);
    p.commitment_ids.push(c.id);
    if (c.created) { p.last_activity = Math.max(p.last_activity, c.created); p.first_seen = Math.min(p.first_seen, c.created); }
  }
  for (const p of Object.values(parties)) { const cc = cache.find(x => x.slug === p.slug); p.aliases = cc ? [...cc.aliasKeys] : []; }   // persist aliases for downstream matching
  for (const mtg of meetings) {
    const hay = ((mtg.summary || "") + " " + (mtg.location || "") + " " + ((mtg.attendees || []).join(" ")));
    const t = Date.parse(mtg.start_iso) || 0;
    for (const p of Object.values(parties)) {
      if (hayMatchParty(hay, p)) {
        p.meeting_refs.push({ summary: mtg.summary || "", start_iso: mtg.start_iso, location: mtg.location || "", join: mtg.join || "" });
        if (t) p.last_activity = Math.max(p.last_activity, t);
      }
    }
  }
  for (const cc of cache) for (const k of cc.aliasKeys) { try { await env.MEETINGS.put("palias_" + k, cc.slug); } catch (e) {} }
  const old = await env.MEETINGS.list({ prefix: "party_" });
  await Promise.all(old.keys.map(k => env.MEETINGS.delete(k.name).catch(() => {})));
  let n = 0;
  for (const p of Object.values(parties)) { if (p.first_seen === Infinity) p.first_seen = 0; await env.MEETINGS.put("party_" + p.slug, JSON.stringify(p)); n++; }
  return { parties: n, commitments: cmts.length, meetings: meetings.length };
}
async function listParties(env) {
  const l = await env.MEETINGS.list({ prefix: "party_" }); const out = []; const CH = 25;
  for (let i = 0; i < l.keys.length; i += CH) { const vals = await Promise.all(l.keys.slice(i, i + CH).map(k => env.MEETINGS.get(k.name).catch(() => null))); for (const v of vals) { if (!v) continue; try { out.push(JSON.parse(v)); } catch (e) {} } }
  return out;
}
async function getParty(env, slug) { try { const v = await env.MEETINGS.get("party_" + slug); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
// Assemble the per-party screen object.
async function assembleParty(env, slug) {
  const p = await getParty(env, slug); if (!p) return null;
  const allC = await openCommitments(env); const byId = {}; for (const c of allC) byId[c.id] = c;
  const cmts = (p.commitment_ids || []).map(id => byId[id]).filter(Boolean);
  const mine = cmts.filter(c => c.direction === "owed_by_me").map(c => ({ text: c.text, due: c.due_hint || "", age: ageDays(c.created) })).sort((a, b) => b.age - a.age);
  const theirs = cmts.filter(c => c.direction === "owed_to_me").map(c => ({ text: c.text, due: c.due_hint || "", age: ageDays(c.created) })).sort((a, b) => b.age - a.age);
  const now = Date.now();
  const refs = (p.meeting_refs || []).slice().sort((a, b) => Date.parse(a.start_iso) - Date.parse(b.start_iso));
  const past = refs.filter(m => Date.parse(m.start_iso) <= now); const last = past.length ? past[past.length - 1] : null;
  let next = null;
  try { const up = await upcomingMeetings(env); const hits = up.filter(m => hayMatchParty((m.summary || "") + " " + (m.location || ""), p) && Date.parse(m.start_iso) > now).sort((a, b) => Date.parse(a.start_iso) - Date.parse(b.start_iso)); next = hits[0] || null; } catch (e) {}
  const words = {}; for (const c of cmts) for (const w of String(c.text || "").toLowerCase().split(/\s+/)) if (w.length > 3 && !partyStop(w)) words[w] = (words[w] || 0) + 1;
  const thread = Object.entries(words).sort((a, b) => b[1] - a[1]).slice(0, 6).map(x => x[0]);
  return { slug: p.slug, name: p.name, org: p.org || "", owe_them: mine, owe_me: theirs, last, next, thread, last_activity: p.last_activity };
}
function partyTemplate(o) {
  const line = (c) => "• " + c.text + (c.due ? " (" + c.due + ")" : "") + " — " + c.age + "d" + (c.age >= 7 ? " ⚠" : "");
  let s = o.name + (o.org ? " · " + o.org : "");
  if (o.last) s += "\nLast: " + humanGst(o.last.start_iso).replace(/^\w{3},\s*/, "") + (o.last.summary ? " (" + o.last.summary + ")" : "");
  if (o.next) s += "\nNext: " + humanGst(o.next.start_iso).replace(/^\w{3},\s*/, "") + (o.next.summary ? " (" + o.next.summary + ")" : "");
  s += "\n\nYOU OWE" + (o.owe_them.length ? "\n" + o.owe_them.map(line).join("\n") : "\n• nothing open");
  s += "\n\nOWED TO YOU" + (o.owe_me.length ? "\n" + o.owe_me.map(line).join("\n") : "\n• nothing open");
  if (o.thread.length) s += "\n\nThread: " + o.thread.join(" · ");
  return s;
}
async function synthParty(env, o) {
  try {
    if (env.ANTHROPIC_API_KEY) {
      const sys = "You are a chief-of-staff. Summarise this relationship in <=90 words as a crisp WhatsApp brief: who they are, what the user owes them (with day-ages), what they owe the user, last/next contact. Direct, no fluff. Use the data verbatim; invent nothing.";
      const r = await claudeJSON(env, sys, JSON.stringify(o), { type: "object", additionalProperties: false, properties: { brief: { type: "string" } }, required: ["brief"] }, CLAUDE_FAST, 300);
      if (r && r.brief) return r.brief;
    }
  } catch (e) {}
  return partyTemplate(o);
}
async function findPartyByName(env, q) {
  const parties = await listParties(env); const qt = nameTokens(q); if (!qt.length) return null;
  const hits = parties.filter(p => partyVariants(p).some(v => qt.every(t => v.includes(t)) || v.every(t => qt.includes(t)))).sort((a, b) => (b.last_activity || 0) - (a.last_activity || 0));
  return hits[0] || null;
}
// The two-line meeting-prep brief, if a meeting resolves to a party.
async function meetingPrepBrief(env, meeting) {
  try {
    const parties = await listParties(env); if (!parties.length) return "";
    const hay = ((meeting.summary || "") + " " + (meeting.location || "")).toLowerCase();
    const match = parties.map(p => ({ p })).filter(x => hayMatchParty(hay, x.p)).sort((a, b) => (b.p.last_activity || 0) - (a.p.last_activity || 0))[0];
    if (!match) return "";
    const o = await assembleParty(env, match.p.slug); if (!o) return "";
    const first = o.name.split(/\s+/)[0], bits = [];
    if (o.owe_them.length) bits.push("you owe " + first + ": " + o.owe_them[0].text + " (" + o.owe_them[0].age + "d)");
    if (o.owe_me.length) bits.push(first + " owes you: " + o.owe_me[0].text + " (" + o.owe_me[0].age + "d)");
    return bits.length ? ("\n🧠 " + bits.join(" · ")) : "";
  } catch (e) { return ""; }
}
// Ledger grouped by party for "who owes me" / "what do i owe".
async function ledgerByParty(env, dir) {
  const parties = await listParties(env); const allC = await openCommitments(env); const byId = {}; for (const c of allC) byId[c.id] = c;
  const rows = [];
  for (const p of parties) {
    const cs = (p.commitment_ids || []).map(id => byId[id]).filter(c => c && c.direction === dir);
    for (const c of cs) rows.push({ who: p.name, text: c.text, age: ageDays(c.created) });
  }
  rows.sort((a, b) => b.age - a.age);
  return rows;
}
function renderPeople(parties, allC, key) {
  const k = esc(key || ""); const byId = {}; for (const c of allC) byId[c.id] = c;
  const rows = parties.slice().map(p => {
    const cs = (p.commitment_ids || []).map(id => byId[id]).filter(Boolean);
    const mine = cs.filter(c => c.direction === "owed_by_me").length, theirs = cs.filter(c => c.direction === "owed_to_me").length;
    const maxAge = cs.reduce((m, c) => Math.max(m, ageDays(c.created)), 0);
    return { p, mine, theirs, maxAge, la: p.last_activity || 0 };
  }).sort((a, b) => b.maxAge - a.maxAge || b.la - a.la);
  const row = (r) => '<a class="p" data-name="' + esc(String(r.p.name).toLowerCase()) + '" href="/person?key=' + k + '&id=' + esc(r.p.slug) + '">'
    + '<span class="nm">' + esc(r.p.name) + (r.p.org ? ' <span class="og">' + esc(r.p.org) + '</span>' : '') + '</span>'
    + '<span class="ct">' + (r.mine ? '<b class="you">' + r.mine + '</b>' : '') + (r.theirs ? '<b class="them">' + r.theirs + '</b>' : '') + (r.maxAge >= 7 ? '<i class="hot"></i>' : '') + '</span></a>';
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Azimuth · People</title><style>'
    + 'body{margin:0;background:#0A4F4A;color:#FAF8F3;font:16px/1.4 -apple-system,system-ui,sans-serif}.wrap{max-width:640px;margin:0 auto;padding:18px}'
    + 'h1{font-size:20px;margin:6px 0 2px}.sub{opacity:.7;font-size:13px;margin-bottom:14px}'
    + '#q{width:100%;box-sizing:border-box;padding:12px 14px;border:0;border-radius:12px;margin-bottom:14px;font-size:16px;background:rgba(255,255,255,.12);color:#fff}'
    + '.p{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px;background:rgba(255,255,255,.06);border-radius:10px;margin-bottom:7px;text-decoration:none;color:#fff}'
    + '.nm{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.og{opacity:.6;font-size:13px}'
    + '.ct{flex:none;display:flex;align-items:center;gap:6px}.you{background:#B3261E;color:#fff;border-radius:20px;padding:1px 9px;font-size:13px}.them{background:#C5A56A;color:#0A2E2B;border-radius:20px;padding:1px 9px;font-size:13px}.hot{width:8px;height:8px;border-radius:50%;background:#ff5b4a;display:inline-block}'
    + '</style></head><body><div class="wrap"><h1>People</h1><div class="sub">Red = you owe them · Gold = they owe you · dot = 7+ days aging</div>'
    + '<input id="q" placeholder="Search people…" oninput="var v=this.value.toLowerCase();document.querySelectorAll(&quot;.p&quot;).forEach(function(e){e.style.display=e.dataset.name.indexOf(v)>-1?&quot;&quot;:&quot;none&quot;})">'
    + (rows.length ? rows.map(row).join("") : '<div style="opacity:.5">No parties yet — run /people_reindex once commitments exist.</div>')
    + '</div></body></html>';
}
function renderPerson(o, key) {
  const line = (c) => '<div class="c"><span class="tx">' + esc(c.text) + (c.due ? ' <span class="due">· ' + esc(c.due) + '</span>' : '') + '</span><span class="ag' + (c.age >= 7 ? ' hot' : '') + '">' + c.age + 'd</span></div>';
  const mt = (m, lbl) => m ? '<div class="mt"><b>' + lbl + ':</b> ' + esc(humanGst(m.start_iso).replace(/^\w{3},\s*/, "")) + (m.summary ? ' — ' + esc(m.summary) : '') + '</div>' : '';
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(o.name) + ' · Azimuth</title><style>'
    + 'body{margin:0;background:#0A4F4A;color:#FAF8F3;font:16px/1.45 -apple-system,system-ui,sans-serif}.wrap{max-width:640px;margin:0 auto;padding:18px}'
    + 'h1{font-size:22px;margin:6px 0 2px}.org{opacity:.7;margin-bottom:10px}.mt{opacity:.85;font-size:14px;margin:2px 0}'
    + '.sec{font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.6;margin:18px 0 8px}'
    + '.c{display:flex;justify-content:space-between;gap:10px;padding:11px 12px;background:rgba(255,255,255,.06);border-radius:10px;margin-bottom:7px}'
    + '.tx{flex:1}.due{opacity:.6}.ag{flex:none;opacity:.7}.ag.hot{color:#ff8b7d;font-weight:600}.empty{opacity:.45;font-size:14px}'
    + '.thread{margin-top:18px;opacity:.8;font-size:14px}.back{color:#C5A56A;text-decoration:none;font-size:14px}'
    + '</style></head><body><div class="wrap"><a class="back" href="/people?key=' + esc(key || "") + '">← People</a>'
    + '<h1>' + esc(o.name) + '</h1>' + (o.org ? '<div class="org">' + esc(o.org) + '</div>' : '')
    + mt(o.last, "Last") + mt(o.next, "Next")
    + '<div class="sec">You owe them</div>' + (o.owe_them.length ? o.owe_them.map(line).join("") : '<div class="empty">Nothing open.</div>')
    + '<div class="sec">Owed to you</div>' + (o.owe_me.length ? o.owe_me.map(line).join("") : '<div class="empty">Nothing open.</div>')
    + (o.thread.length ? '<div class="thread"><b>Thread:</b> ' + esc(o.thread.join(" · ")) + '</div>' : '')
    + '</div></body></html>';
}
function renderLedger(cmts, key) {
  const mine = cmts.filter(c => c.direction === "owed_by_me");
  const theirs = cmts.filter(c => c.direction === "owed_to_me");
  const row = (c) => {
    const d = ageDays(c.created);
    const hot = d >= 7 ? ' style="color:#B3261E;font-weight:600"' : "";
    const link = (c.src && (c.src.type === "email" || c.src.type === "meeting-invite"))
      ? ' <a href="/src?key=' + encodeURIComponent(key || "") + '&id=' + encodeURIComponent(String(c.id).replace(/^act_/, "")) + '" target="_blank" rel="noopener" style="color:#C5A56A;text-decoration:none">↗</a>' : "";
    return '<div class="c"><div class="who">' + esc(c.counterparty) + '</div><div class="what">' + esc(c.text)
      + (c.due_hint ? ' <span class="due">· ' + esc(c.due_hint) + '</span>' : "")
      + '</div><div class="age"' + hot + '>' + d + 'd' + link + '</div></div>';
  };
  const col = (title, arr, empty) => '<section><h2>' + title + ' <span class="n">' + arr.length + '</span></h2>'
    + (arr.length ? arr.map(row).join("") : '<div class="empty">' + empty + '</div>') + '</section>';
  return '<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">'
    + '<title>Azimuth — Commitments</title><style>'
    + ':root{--teal:#0A4F4A;--gold:#C5A56A;--paper:#FAF8F3;--ink:#222;--line:#e7e2d8}'
    + '*{box-sizing:border-box}body{margin:0;padding:22px 16px;background:var(--paper);color:var(--ink);'
    + 'font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:760px;margin:0 auto}'
    + 'h1{color:var(--teal);font-size:20px;margin:0 0 2px}.sub{color:#7a756c;font-size:12px;margin-bottom:20px}'
    + 'h2{color:var(--teal);font-size:14px;text-transform:uppercase;letter-spacing:.06em;margin:22px 0 8px;'
    + 'border-bottom:1px solid var(--line);padding-bottom:6px}.n{color:var(--gold);font-weight:700}'
    + '.c{display:flex;gap:10px;align-items:baseline;padding:9px 0;border-bottom:1px solid var(--line)}'
    + '.who{flex:0 0 30%;font-weight:600;color:var(--teal);font-size:14px}'
    + '.what{flex:1;font-size:14px;line-height:1.35}.due{color:#7a756c;font-size:12px}'
    + '.age{flex:0 0 52px;text-align:right;font-size:12px;color:#7a756c;white-space:nowrap}'
    + '.empty{color:#9a958c;font-size:13px;padding:10px 0}'
    + '</style></head><body><h1>🧭 Commitments</h1>'
    + '<div class="sub">Who is waiting on you · what you are waiting on · red past 7 days · ↗ opens the evidence</div>'
    + col("You owe", mine, "Nothing outstanding to anyone.")
    + col("Owed to you", theirs, "Nobody owes you anything tracked.")
    + '</body></html>';
}
// ===== Phase 3 v1 — Proactive: propose, you approve, then it acts =====
// Three hard rules, each earned from a bug in this repo:
//  1. Proposals read AUTHORITATIVE sources only (msList / openActions) — never the vector index.
//     A proposal built on inferred evidence is worse than no proposal.
//  2. An approve tap executes EXACTLY ONCE — status flips to non-open BEFORE the action runs.
//  3. A failed pass is announced, never silent. A broken detector must not look like a calm day.
const PROP_TTL = 3 * 86400;
const STALE_DAYS = 21;   // an undated task untouched this long is worth questioning
const GAP_MIN = 90;      // shortest free block worth protecting (minutes)
const WORK_START = 9, WORK_END = 18;      // GST working hours
const MEET_ASSUMED_MIN = 60;              // msList does not select `end`, so assume 60m per meeting

async function propPut(env, kind, payload) {
  const id = rid();
  await env.MEETINGS.put("prop_" + id, JSON.stringify({ id: id, kind: kind, payload: payload, status: "open", created: Date.now() }), { expirationTtl: PROP_TTL });
  return id;
}
async function propCard(env, id, html, yes, no) {
  await tg(env, "sendMessage", { chat_id: env.TELEGRAM_CHAT_ID, parse_mode: "HTML", disable_web_page_preview: true, text: html, reply_markup: { inline_keyboard: [[{ text: yes, callback_data: "pa:" + id }, { text: no, callback_data: "pd:" + id }]] } });
}
// Rule 2 lives here: re-read, verify still open, flip status, THEN act.
async function propResolve(env, id, approve) {
  const raw = await env.MEETINGS.get("prop_" + id);
  if (!raw) return "expired";
  let p; try { p = JSON.parse(raw); } catch (e) { return "expired"; }
  if (p.status !== "open") return "already";
  p.status = approve ? "approved" : "denied";
  await env.MEETINGS.put("prop_" + id, JSON.stringify(p), { expirationTtl: PROP_TTL });
  if (!approve) {
    if (p.kind === "stale" && p.payload && p.payload.actId) await env.MEETINGS.put("propkeep_" + p.payload.actId, "1", { expirationTtl: STALE_DAYS * 86400 });
    return "denied";
  }
  try {
    if (p.kind === "stale") { await env.MEETINGS.delete("act_" + p.payload.actId); return "cleared"; }
    if (p.kind === "focus") {
      const tok = await msToken(env);
      const oid = await msCreate(env, tok, AT(env), { summary: "Focus: " + p.payload.task, start_iso: p.payload.start_iso, end_iso: p.payload.end_iso, location: "" });
      return oid ? "blocked" : "graph-failed";
    }
  } catch (e) { return "graph-failed"; }
  return "ok";
}
// Detector A — undated tasks that have gone quiet. Zero risk: clearing is your tap, not ours.
async function proposeStale(env, cap) {
  const items = await openActions(env);
  const cutoff = Date.now() - STALE_DAYS * 86400000;
  let n = 0;
  for (const a of items) {
    if (n >= cap) break;
    if (a.due_iso) continue;
    if ((a.created || 0) >= cutoff) continue;
    if (!a.id || !a.text) continue;
    if (await env.MEETINGS.get("propkeep_" + a.id)) continue;      // you already said keep
    if (await env.MEETINGS.get("propseen_stale_" + a.id)) continue; // proposed recently
    await env.MEETINGS.put("propseen_stale_" + a.id, "1", { expirationTtl: 7 * 86400 });
    const days = Math.floor((Date.now() - (a.created || Date.now())) / 86400000);
    const pid = await propPut(env, "stale", { actId: a.id, text: a.text });
    await propCard(env, pid, "🧹 <b>Still live?</b>" + NL10 + esc(a.text) + NL10 + "<i>open " + days + " days, no due date" + (a.from && a.from !== "you" ? " · from " + esc(a.from) : "") + "</i>", "🗑 Clear it", "✋ Keep");
    n++;
  }
  return n;
}
// Detector B — a real free block paired with a task actually worth protecting.
async function proposeFocus(env, dayOffset) {
  const gn = gstNow();
  const day = gstDateStr(new Date(gn.getTime() + dayOffset * 86400000));
  const dk = "propseen_focus_" + day;
  if (await env.MEETINGS.get(dk)) return 0;                        // one focus proposal per day, max
  const acts = await openActions(env);
  const soon = Date.now() + 3 * 86400000;
  const pick = acts.find(a => a.due_iso && Date.parse(a.due_iso) <= soon) || acts.find(a => /\b(pay|approve|sign|urgent|asap|deadline|overdue|submit)\b/i.test(a.text || ""));
  if (!pick) return 0;                                             // nothing worth protecting — stay quiet
  let items = [];
  const tok = await msToken(env);
  for (const mb of MB(env)) items = items.concat(await msList(env, tok, mb));
  try { items = dedup(items); } catch (e) {}
  const onDay = items.filter(m => (m.start_iso || "").slice(0, 10) === day).sort((a, b) => String(a.start_iso).localeCompare(String(b.start_iso)));
  const busy = onDay.map(m => { const s = parseInt(m.start_iso.slice(11, 13), 10) * 60 + parseInt(m.start_iso.slice(14, 16), 10); return [s, s + MEET_ASSUMED_MIN]; });
  let cur = WORK_START * 60;
  if (dayOffset === 0) cur = Math.max(cur, gn.getUTCHours() * 60 + gn.getUTCMinutes() + 30);
  let slot = null;
  for (const b of busy) { if (b[0] - cur >= GAP_MIN) { slot = [cur, b[0]]; break; } cur = Math.max(cur, b[1]); }
  if (!slot && (WORK_END * 60 - cur) >= GAP_MIN) slot = [cur, WORK_END * 60];
  if (!slot) return 0;
  const endMin = Math.min(slot[0] + GAP_MIN, slot[1]);
  const hhmm = (x) => pad(Math.floor(x / 60)) + ":" + pad(x % 60);
  const startIso = day + "T" + hhmm(slot[0]) + ":00+04:00";
  const endIso = day + "T" + hhmm(endMin) + ":00+04:00";
  await env.MEETINGS.put(dk, "1", { expirationTtl: 2 * 86400 });
  const pid = await propPut(env, "focus", { task: pick.text, start_iso: startIso, end_iso: endIso });
  await propCard(env, pid, "🎯 <b>Free block " + (dayOffset ? "tomorrow" : "today") + "</b> — " + hhmm(slot[0]) + "–" + hhmm(endMin) + " GST" + NL10 + "Protect it for: <b>" + esc(pick.text) + "</b>?", "📅 Block it", "🚫 No");
  return 1;
}
// Rule 3: a pass that throws says so out loud.
async function proposePass(env, slot) {
  if (!env.TELEGRAM_TOKEN) return;                          // approve/deny cards are Telegram-only
  try {
    let n = 0;
    if (slot === 7) { n += await proposeStale(env, 3); n += await proposeFocus(env, 0); }
    else if (slot === 15) { n += await proposeFocus(env, 0); }
    else { n += await proposeFocus(env, 1); }
    return n;
  } catch (e) {
    try { await tg(env, "sendMessage", { chat_id: env.TELEGRAM_CHAT_ID, text: "⚠ Proposal pass " + slot + ":00 failed — " + String(e && e.message ? e.message : e).slice(0, 160) }); } catch (e2) {}
    return 0;
  }
}
async function handleCallback(env, cbq) {
  if (String(cbq.message.chat.id) !== String(env.TELEGRAM_CHAT_ID)) { await answerCb(env, cbq.id); return; }
  const data = cbq.data || ""; const c = cbq.message.chat.id, mid = cbq.message.message_id;
  if (data.startsWith("d:")) { await env.MEETINGS.delete("act_" + data.slice(2)); await answerCb(env, cbq.id, "✅ Done"); await clearBtns(env, c, mid); return; }
  if (data.startsWith("pa:") || data.startsWith("pd:")) { const _ok = data.startsWith("pa:"); const _r = await propResolve(env, data.slice(3), _ok); const _m = _r === "cleared" ? "🗑 Cleared" : _r === "blocked" ? "📅 Blocked out" : _r === "denied" ? "✋ Kept" : _r === "already" ? "Already handled" : _r === "expired" ? "Expired" : _r === "graph-failed" ? "⚠ Calendar write failed" : "OK"; await answerCb(env, cbq.id, _m); await clearBtns(env, c, mid); return; }
  if (data.startsWith("ig:")) { await env.MEETINGS.delete("cand_" + data.slice(3)); await answerCb(env, cbq.id, "Ignored"); await clearBtns(env, c, mid); return; }
  if (data.startsWith("m:")) { const cid = data.slice(2); const cand = JSON.parse((await env.MEETINGS.get("cand_" + cid)) || "null"); let ok = false; if (cand) { try { const tok = await msToken(env); ok = !!(await msCreate(env, tok, AT(env), { summary: cand.title, start_iso: cand.start_iso, location: cand.location || "" })); } catch (e) {} } await env.MEETINGS.delete("cand_" + cid); await answerCb(env, cbq.id, ok ? "📅 Added" : "⚠️ Failed"); await clearBtns(env, c, mid); return; }
  if (data.startsWith("v:")) {
    const parts = data.split(":"); const vtok = parts[1]; const sel = parts[2];
    const vp = JSON.parse((await env.MEETINGS.get("vpick_" + vtok)) || "null");
    if (!vp) { await answerCb(env, cbq.id, "Expired — re-add the meeting"); await clearBtns(env, c, mid); return; }
    const event = vp.event;
    if (sel !== "raw") { const cd = vp.cands[parseInt(sel, 10)]; if (cd && cd.address) { event.location = cd.address; await env.MEETINGS.put(venueKey(vp.typed), JSON.stringify({ name: cd.name, address: cd.address }), { expirationTtl: 400 * 86400 }); } }
    let ok = false; try { const tk = await msToken(env); const oid = await msCreate(env, tk, AT(env), event); if (oid) { event.outlook_id = oid; event.mailbox = AT(env); ok = true; } } catch (e) {}
    await env.MEETINGS.put("evt_" + Date.now() + "_" + rid(), JSON.stringify(event), { expirationTtl: 60 * 60 * 24 * 21 });
    await env.MEETINGS.delete("vpick_" + vtok);
    await answerCb(env, cbq.id, "📍 Location set");
    await clearBtns(env, c, mid);
    await say(env, `✅ <b>${esc(event.summary)}</b>\n🗓 ${humanGst(event.start_iso)} GST\n📍 ${esc(event.location)}\n${ok ? "📅 Added to your Outlook calendar. " : ""}Reminders set. 🧭`, true);
    return;
  }
  await answerCb(env, cbq.id);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url); const CHAT = env.TELEGRAM_CHAT_ID;
    if (request.method === "POST" && url.pathname === "/setbg") {      // direct backdrop upload (raw image bytes)
      if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
      const _ct0 = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      if (!/^image\//.test(_ct0)) return new Response("POST needs Content-Type: image/* (got: " + (_ct0 || "none") + ")", { status: 415 });
      const _b0 = await request.arrayBuffer();
      if (_b0.byteLength > 4 * 1024 * 1024) return new Response("image too large: " + _b0.byteLength + " bytes (max 4MB)", { status: 413 });
      if (_b0.byteLength < 500) return new Response("image suspiciously small: " + _b0.byteLength + " bytes", { status: 422 });
      await env.MEETINGS.put("cfg_bg", _b0);
      await env.MEETINGS.put("cfg_bg_ct", _ct0);
      return new Response(JSON.stringify({ ok: true, via: "upload", bytes: _b0.byteLength, contentType: _ct0 }), { headers: { "Content-Type": "application/json" } });
    }
    if (request.method === "GET") {
      if (url.pathname === "/bg.jpg") {
        { const _u = await env.MEETINGS.get("cfg_bg", { type: "arrayBuffer" }); if (_u && _u.byteLength > 0) { const _ct = (await env.MEETINGS.get("cfg_bg_ct")) || "image/jpeg"; return new Response(_u, { headers: { "Content-Type": _ct, "Cache-Control": "public, max-age=300" } }); } }
        if (env.BOARD_BG === "off") return new Response("", { status: 404 }); const _b = Uint8Array.from(atob(FOUNDER_BG), c => c.charCodeAt(0)); return new Response(_b, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=604800, immutable" } }); }
      if (url.pathname === "/wa") {
        if (url.searchParams.get("hub.verify_token") === env.WA_VERIFY_TOKEN) return new Response(url.searchParams.get("hub.challenge") || "", { status: 200 });
        return new Response("forbidden", { status: 403 });
      }
      if (url.pathname === "/setbg") {
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        if (url.searchParams.get("clear")) { await env.MEETINGS.delete("cfg_bg"); await env.MEETINGS.delete("cfg_bg_ct"); return new Response("backdrop cleared"); }
        const _src = url.searchParams.get("url") || "";
        if (!/^https:\/\//i.test(_src)) return new Response("need ?url=https://... (or ?clear=1)", { status: 400 });
        let _r; try { _r = await fetch(_src, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36", "Accept": "image/*,*/*" } }); } catch (e) { return new Response("fetch failed: " + (e && e.message || e), { status: 502 }); }
        if (!_r.ok) return new Response("source returned HTTP " + _r.status, { status: 502 });
        const _ct = (_r.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
        if (!/^image\//.test(_ct)) return new Response("not an image (content-type: " + (_ct || "none") + ")", { status: 415 });
        const _buf = await _r.arrayBuffer();
        if (_buf.byteLength > 4 * 1024 * 1024) return new Response("image too large: " + _buf.byteLength + " bytes (max 4MB)", { status: 413 });
        if (_buf.byteLength < 500) return new Response("image suspiciously small: " + _buf.byteLength + " bytes", { status: 422 });
        await env.MEETINGS.put("cfg_bg", _buf);
        await env.MEETINGS.put("cfg_bg_ct", _ct);
        return new Response(JSON.stringify({ ok: true, bytes: _buf.byteLength, contentType: _ct }), { headers: { "Content-Type": "application/json" } });
      }
      if (url.pathname === "/health") {
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        const ago = (iso) => { if (!iso) return null; const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 60 ? m + "m ago" : (m < 1440 ? Math.round(m / 60) + "h ago" : Math.round(m / 1440) + "d ago"); };
        const count = async (p) => { try { return (await env.MEETINGS.list({ prefix: p })).keys.length; } catch (e) { return null; } };
        const wal = await (async () => { try { return JSON.parse((await env.MEETINGS.get("diag_walog")) || "[]"); } catch (e) { return []; } })();
        const lastIn = wal[0] || null;
        const lastMsg = wal.find(r => r && r.hasMessages) || null;
        const lastSend = await (async () => { try { return JSON.parse((await env.MEETINGS.get("diag_lastsend")) || "null"); } catch (e) { return null; } })();
        const errs = await (async () => { try { return JSON.parse((await env.MEETINGS.get("diag_errs")) || "[]"); } catch (e) { return []; } })();
        // dependencies — reachability only, never contents
        const dep = {};
        dep.claude = env.ANTHROPIC_API_KEY ? await (async () => { try { const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: claudeBody(CLAUDE_FAST, 4, "Reply with the single character: 1", "1", null) }); return r.ok ? "ok" : ("HTTP " + r.status); } catch (e) { return "unreachable"; } })() : "no key";
        dep.whatsapp = (env.WHATSAPP_TOKEN && env.WA_PHONE_ID) ? await (async () => { try { const r = await fetch(`${WA_GRAPH}/${env.WA_PHONE_ID}?fields=display_phone_number`, { headers: { Authorization: "Bearer " + env.WHATSAPP_TOKEN } }); const j = await r.json().catch(() => ({})); return r.ok ? ("ok · " + (j.display_phone_number || "?")) : ("HTTP " + r.status); } catch (e) { return "unreachable"; } })() : "not configured";
        dep.outlook = MB(env).length ? await (async () => { try { const tk = await msToken(env); return tk ? "ok · " + MB(env).length + " mailbox(es)" : "no token"; } catch (e) { return "unreachable"; } })() : "not configured (WhatsApp-only instance)";
        const body = {
          worker: (env.WA_ALLOWED ? ("allow-list …" + String(env.WA_ALLOWED).slice(-4)) : "no allow-list"),
          now: new Date().toISOString(),
          inbound: { last_webhook: lastIn && lastIn.at, last_webhook_ago: ago(lastIn && lastIn.at), last_message: lastMsg && lastMsg.at, last_message_ago: ago(lastMsg && lastMsg.at), last_message_type: lastMsg && lastMsg.msgType, via_forward: !!(lastMsg && lastMsg.viaForward) },
          outbound: { last_success: lastSend && lastSend.at, last_success_ago: ago(lastSend && lastSend.at), kind: lastSend && lastSend.kind },
          router: lastMsg && lastMsg.router ? { via: lastMsg.router.via, forwarded: lastMsg.router.forwarded, status: lastMsg.router.fwdStatus || lastMsg.router.fwdErr } : "not a router / no route matched",
          data: { open_tasks: await count("act_"), commitments: await count("cmt_"), captured_meetings: await count("evt_"), indexed_docs: await count("doc_"), pending_photo_reads: await count("pimg_") },
          dependencies: dep,
          recent_swallowed_errors: errs.slice(0, 8)
        };
        // A human-readable line first: the one sentence that says whether the loop is alive.
        const alive = (lastMsg && lastSend && Date.parse(lastSend.at) >= Date.parse(lastMsg.at)) ? "round trip OK — last inbound was answered" : (lastMsg ? "LAST INBOUND HAS NO LATER OUTBOUND — a reply may not have gone out" : "no inbound message seen yet");
        body.verdict = alive;
        return new Response(JSON.stringify(body, null, 2), { headers: { "Content-Type": "application/json" } });
      }
      if (url.pathname === "/walog") {
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        return new Response((await env.MEETINGS.get("diag_walog")) || "[]", { headers: { "Content-Type": "application/json" } });
      }
      if (url.pathname === "/lastdrop") {
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        return new Response((await env.MEETINGS.get("diag_lastdrop")) || "null", { headers: { "Content-Type": "application/json" } });
      }
      if (url.pathname === "/claude_ping") {
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        const _o = { has_api_key: !!env.ANTHROPIC_API_KEY, fast_model: CLAUDE_FAST, smart_model: CLAUDE_SMART };
        const _tiers = [["fast", CLAUDE_FAST], ["smart", CLAUDE_SMART]];
        for (const _t of _tiers) {
          if (!env.ANTHROPIC_API_KEY) { _o[_t[0]] = "no ANTHROPIC_API_KEY set"; continue; }
          try {
            const _r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: claudeBody(_t[1], 32, "Answer in one word.", "ping", null) });
            const _b = await _r.text();
            _o[_t[0]] = "HTTP " + _r.status + " :: " + _b.slice(0, 400);
          } catch (e) { _o[_t[0]] = "THREW :: " + (e && e.message ? e.message : String(e)); }
        }
        return new Response(JSON.stringify(_o, null, 2), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
      }
      if (url.pathname === "/nudge_test") {                    // v32 — preview the next meeting's nudge, fire nothing
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        const ms = await upcomingMeetings(env);
        ms.sort((a, b) => Date.parse(a.start_iso) - Date.parse(b.start_iso));
        const now = Date.now();
        const rows = ms.slice(0, 8).map(m => {
          const mins = Math.round((Date.parse(m.start_iso) - now) / 60000);
          const online = m.join && /^https?:\/\//i.test(m.join);
          return { summary: m.summary, in_min: mins, when: humanGst(m.start_iso), location: m.location || "", nav: online ? m.join : mapsLink(m.location) };
        });
        return new Response(JSON.stringify({ call_configured: callConfigured(env), call_provider: (env.TWILIO_SID ? "twilio" : (env.CALL_URL ? (env.CALL_PROVIDER || "custom") : null)), count: ms.length, next: rows }, null, 2), { headers: { "Content-Type": "application/json" } });
      }
      if (url.pathname === "/call_test") {                     // v34 — fire ONE test ring now (verify Twilio without a meeting)
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        const to = url.searchParams.get("to") || env.CALL_TO || env.WA_ALLOWED;
        const say = url.searchParams.get("text") || "This is a test call from Azimuth. Your meeting reminders will ring you like this.";
        const res = await ringNudge(env, to, say);
        return new Response(JSON.stringify({ called: to, result: res }, null, 2), { headers: { "Content-Type": "application/json" } });
      }
      if (url.pathname === "/nudge_run") {                     // v32 — force a real nudge pass now (for a live test)
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        const fired = await meetingNudges(env);
        return new Response(JSON.stringify({ fired }), { headers: { "Content-Type": "application/json" } });
      }
      if (url.pathname === "/people") {                        // v35 — relationship roster
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        const parties = await listParties(env);
        if (url.searchParams.get("format") === "json") return new Response(JSON.stringify(parties), { headers: { "Content-Type": "application/json" } });
        const allC = await openCommitments(env);
        return new Response(renderPeople(parties, allC, url.searchParams.get("key")), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
      }
      if (url.pathname === "/person") {                        // v35 — per-party screen
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        const o = await assembleParty(env, url.searchParams.get("id") || "");
        if (!o) return new Response("not found", { status: 404 });
        if (url.searchParams.get("format") === "json") return new Response(JSON.stringify(o), { headers: { "Content-Type": "application/json" } });
        return new Response(renderPerson(o, url.searchParams.get("key")), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
      }
      if (url.pathname === "/people_reindex") {                // v35 — rebuild party registry
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        const r = await peopleReindex(env);
        return new Response(JSON.stringify(r), { headers: { "Content-Type": "application/json" } });
      }
      if (url.pathname === "/party_merge") {                   // v35 — manual alias merge (from -> into)
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        const from = url.searchParams.get("from") || "", into = url.searchParams.get("into") || "";
        if (!from || !into) return new Response(JSON.stringify({ ok: false, error: "need from & into" }), { status: 400, headers: { "Content-Type": "application/json" } });
        await env.MEETINGS.put("palias_" + pslug(from), pslug(into));                 // pin the from-key to into-slug
        const r = await peopleReindex(env);
        return new Response(JSON.stringify({ ok: true, merged: from + " -> " + into, ...r }), { headers: { "Content-Type": "application/json" } });
      }
      if (url.pathname === "/groups_ui") {                     // v33 — tap-to-toggle groups page (no typing)
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        let _g = []; try { _g = await listGroups(env); } catch (e) {}
        return new Response(renderGroupsUi(_g, url.searchParams.get("key")), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
      }
      if (url.pathname === "/group_set") {                     // v33 — toggle one group's watched state
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        const jid = url.searchParams.get("jid") || "";
        const on = url.searchParams.get("on") === "1";
        const g = await grpGet(env, jid);
        if (!g) return new Response(JSON.stringify({ ok: false, error: "unknown group" }), { status: 404, headers: { "Content-Type": "application/json" } });
        g.enabled = on; g.decided = Date.now();
        await grpSet(env, jid, g);
        return new Response(JSON.stringify({ ok: true, name: g.name, enabled: g.enabled }), { headers: { "Content-Type": "application/json" } });
      }
      if (url.pathname === "/groups") {                        // v31 — listener polls this for the opt-in set
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        let _g = []; try { _g = await listGroups(env); } catch (e) {}
        return new Response(JSON.stringify(_g), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
      }
      if (url.pathname === "/ledger") {
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        let _c = [];
        try { _c = await openCommitments(env); } catch (e) {}
        return new Response(renderLedger(_c, url.searchParams.get("key")), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
      }
      if (url.pathname === "/commitments") {
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        let _c = [];
        try { _c = await openCommitments(env); } catch (e) {}
        return new Response(JSON.stringify(_c), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
      }
      if (url.pathname === "/ledger_rebuild") {
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        let r;
        try { r = await ledgerRebuild(env); } catch (e) { return new Response("rebuild error: " + (e && e.message ? e.message : String(e)), { status: 500 }); }
        return new Response("ledger rebuilt — commitments: " + r.made + " · not commitments: " + r.skipped + " · MODEL CALL FAILED: " + r.failed + " · tasks scanned: " + r.scanned + (r.failed ? "  <-- failures mean the Claude call returned nothing; check /claude_ping" : ""));
      }
      if (url.pathname === "/actions") {
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        let _out = [];
        try { _out = (await openActions(env)).map(a => ({ id: a.id, text: a.text, from: a.from || "", due_iso: a.due_iso || null, created: a.created || 0 })); } catch (e) {}
        return new Response(JSON.stringify(_out), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
      }
      if (url.pathname === "/reindex") {
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        let n = 0;
        try {
          const la = await env.MEETINGS.list({ prefix: "act_" });
          for (const k of la.keys) { const v = await env.MEETINGS.get(k.name); if (!v) continue; let a; try { a = JSON.parse(v); } catch (e) { continue; } if (!a.id) continue; await indexDoc(env, "act_" + a.id, "task", a.text, a.src || { type: "email", from: a.from, subject: a.subject }); n++; }
          const le = await env.MEETINGS.list({ prefix: "evt_" });
          for (const k of le.keys) { const v = await env.MEETINGS.get(k.name); if (!v) continue; let e; try { e = JSON.parse(v); } catch (er) { continue; } await indexDoc(env, k.name, "meeting", (e.summary || "") + " " + (e.location || "") + (e.start_iso ? " " + e.start_iso.slice(0, 10) + " " + humanGst(e.start_iso) + " GST" : ""), e.src || null); n++; }
        } catch (e) { return new Response("reindex error: " + (e && e.message ? e.message : String(e)), { status: 500 }); }
        return new Response("reindexed docs: " + n);
      }
      if (url.pathname === "/src") {
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        const _sid = url.searchParams.get("id"); if (!_sid) return new Response("no id", { status: 400 });
        let _src = null; const _raw = await env.MEETINGS.get("act_" + _sid); if (_raw) { try { _src = (JSON.parse(_raw) || {}).src || null; } catch (e) {} }
        if (_src && _src.webLink) return Response.redirect(_src.webLink, 302);
        const _lbl = _src ? ((_src.type || "source") + (_src.from ? " · " + _src.from : "") + (_src.channel ? " · via " + _src.channel : "")) : "no source on record for this item";
        const _html = `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#FAF8F3;color:#222;padding:28px;max-width:640px;margin:0 auto"><h2 style="color:#0A4F4A">🧭 Source</h2><p style="font-size:15px">${esc(_lbl)}</p>${_src && _src.subject ? `<p style="color:#555">${esc(_src.subject)}</p>` : ""}<p style="color:#999;font-size:13px">No direct link stored for this item (older item, or captured by voice/text — the provenance is recorded, just not a clickable link).</p></body>`;
        return new Response(_html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
      }
      if (url.pathname === "/board") {
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        let meetings = [], actions = [];
        try { if (MB(env).length) { const tok = await msToken(env); for (const mb of MB(env)) { meetings = meetings.concat(await msList(env, tok, mb)); } } } catch (e) {}
        try { meetings = meetings.concat(await capturedMeetings(env)); } catch (e) {}
        try { meetings = dedup(meetings); } catch (e) {}
        try { actions = await openActions(env); } catch (e) {}
        let mkt = null; try { mkt = JSON.parse((await env.MEETINGS.get("mkt_latest")) || "null"); } catch (e) {}
        return new Response(renderBoard(meetings, actions, url.searchParams.get("key"), env, mkt), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
      }
      if (url.pathname === "/card.png") {
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        const day = url.searchParams.get("day") === "today" ? "today" : "tomorrow";
        let meetings = [];
        try { if (MB(env).length) { const tok = await msToken(env); for (const mb of MB(env)) { try { meetings = meetings.concat(await msList(env, tok, mb)); } catch (e) {} } } } catch (e) {}
        try { meetings = meetings.concat(await capturedMeetings(env)); } catch (e) {}
        try { meetings = dedup(meetings); } catch (e) {}
        const gn = gstNow();
        const target = gstDateStr(new Date(gn.getTime() + (day === "today" ? 0 : 86400000)));
        const dayEvs = meetings.filter(m => (m.start_iso || "").slice(0, 10) === target).sort((a, b) => (Date.parse(a.start_iso) || 0) - (Date.parse(b.start_iso) || 0));
        const html = cardHtml(dayEvs, target, day);
        if (!env.CF_RENDER_TOKEN) return new Response("no CF_RENDER_TOKEN", { status: 500 });
        const acc = env.CF_ACCOUNT_ID || "76bc08573538d7426fce444cf7ef7645";
        try {
          const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${acc}/browser-rendering/screenshot`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + env.CF_RENDER_TOKEN },
            body: JSON.stringify({ html, viewport: { width: 760, height: 1200, deviceScaleFactor: 2 }, screenshotOptions: { fullPage: true, type: "png" } }),
          });
          if (!r.ok) return new Response("render " + r.status + ": " + (await r.text()).slice(0, 400), { status: 502 });
          const png = await r.arrayBuffer();
          return new Response(png, { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=300" } });
        } catch (e) { return new Response("render exception: " + String((e && e.message) || e), { status: 502 }); }
      }
      if (url.pathname === "/done") { if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 }); const _id = url.searchParams.get("id"); if (_id) await env.MEETINGS.delete("act_" + _id); return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" } }); }
      if (url.pathname === "/backfill") { if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 }); const mins = parseInt(url.searchParams.get("mins") || "2880", 10) || 2880; let added = []; try { const tok = await msToken(env); const r = await scanEmails(env, tok, mins, 60, { silent: true, top: 90, mailboxes: ["radar@digitalabbot.io"] }); added = r.added || []; } catch (e) { return new Response("backfill error: " + (e && e.message ? e.message : String(e)), { status: 500 }); } if (added.length) { const lines = added.slice(0, 25).map((t, i) => `${i + 1}. ${esc(t)}`).join("\n"); await say(env, `📥 <b>Backlog ingested</b> — ${added.length} action item(s) added to your plate:\n${lines}${added.length > 25 ? "\n…and more" : ""}\n\nSay "action items" to work through them, or open your board.`, true); } else { await say(env, "📥 Backlog scan — no new action items found in that batch.", true); } return new Response("backfill done — actions added: " + added.length); }
      if (url.pathname === "/debugatt") {
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        const mb = url.searchParams.get("mb") || "radar@digitalabbot.io"; const id = url.searchParams.get("id"); const out = { mb, hasMistralKey: !!env.MISTRAL_API_KEY };
        try {
          const tok = await msToken(env);
          const r = await fetch(`https://graph.microsoft.com/v1.0/users/${mb}/messages/${id}/attachments`, { headers: { Authorization: "Bearer " + tok } });
          out.graphStatus = r.status; const j = await r.json(); if (j.error) out.graphError = j.error;
          const atts = (j.value || []); out.atts = atts.map(a => ({ name: a.name, ct: a.contentType, size: a.size, hasBytes: !!a.contentBytes, bytesLen: a.contentBytes ? a.contentBytes.length : 0, odType: a["@odata.type"] }));
          const a = atts.find(x => x.contentBytes);
          if (!a) { out.note = "NO attachment with inlined contentBytes"; }
          else {
            const ct = (a.contentType || "").toLowerCase(); out.chosen = a.name;
            try { const bytes = Uint8Array.from(atob(a.contentBytes), c => c.charCodeAt(0)); const md = await env.AI.toMarkdown([{ name: a.name || "f", blob: new Blob([bytes], { type: a.contentType }) }]); const arr = Array.isArray(md) ? md : [md]; const t = arr.map(d => (d && d.data) || "").join("\n").trim(); out.toMarkdown = { len: t.length, head: t.slice(0, 250) }; } catch (e) { out.toMarkdownError = String((e && e.message) || e); }
            if (/pdf/.test(ct) || /image\//.test(ct)) {
              try { const doc = /image\//.test(ct) ? { type: "image_url", image_url: "data:" + ct + ";base64," + a.contentBytes } : { type: "document_url", document_name: a.name || "d", document_url: "data:application/pdf;base64," + a.contentBytes }; const mr = await fetch("https://api.mistral.ai/v1/ocr", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + env.MISTRAL_API_KEY }, body: JSON.stringify({ model: "mistral-ocr-latest", document: doc }) }); out.mistralStatus = mr.status; const mj = await mr.json(); if (mj.error) out.mistralError = mj.error; const mt = (mj.pages || []).map(p => (p && p.markdown) || "").join("\n\n").trim(); out.mistral = { pages: (mj.pages || []).length, len: mt.length, head: mt.slice(0, 250) }; } catch (e) { out.mistralError = String((e && e.message) || e); }
            }
          }
        } catch (e) { out.error = String((e && e.message) || e); }
        return new Response(JSON.stringify(out, null, 2), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
      }
      if (url.searchParams.get("scan") === env.READ_KEY) { const mins = parseInt(url.searchParams.get("mins") || "45", 10) || 45; let n = 0; try { const tok = await msToken(env); const _r = await scanEmails(env, tok, mins, 40); n = _r.sent; } catch (e) { return new Response("scan error: " + (e && e.message ? e.message : String(e)), { status: 500 }); } return new Response("scan complete — alerts sent this run: " + n); }
      if (url.pathname === "/scan_sent" && url.searchParams.get("key") === env.READ_KEY) { const mins = parseInt(url.searchParams.get("mins") || "1440", 10) || 1440; try { const tok = await msToken(env); const _r = await scanSent(env, tok, { sinceMin: mins, cap: 60 }); return new Response(JSON.stringify(_r), { headers: { "Content-Type": "application/json" } }); } catch (e) { return new Response("scan_sent error: " + (e && e.message ? e.message : String(e)), { status: 500 }); } }
      if (url.pathname === "/brief_test") {                    // v36.3 — force the Sunday brief + content buttons now (live demo / recovery)
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        try { await marketBriefTick(env, true); } catch (e) { return new Response("brief error: " + (e && e.message ? e.message : String(e)), { status: 500 }); }
        return new Response("brief fired — check WhatsApp");
      }
      if (url.pathname === "/market") {                        // v36 — Market Pulse dashboard (GET — MUST sit above the keyed catch-all dump below)
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        const _ml = await env.MEETINGS.get("mkt_latest");
        const _mp = await env.MEETINGS.get("mkt_prev");
        return new Response(renderMarket(_ml, _mp), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
      }
      if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 }); const list = await env.MEETINGS.list(); const events = []; for (const k of list.keys) { if (!k.name.startsWith("evt_")) continue; const v = await env.MEETINGS.get(k.name); if (v) { try { events.push(JSON.parse(v)); } catch (e) {} } } return new Response(JSON.stringify(events), { headers: { "Content-Type": "application/json" } });
    }
    if (request.method === "POST") {
      if (url.pathname === "/ingest_market") {                 // v36 — Market Pulse aggregates (collector -> KV, ~10 KB)
        if (request.method !== "POST") return new Response("method", { status: 405 });
        const _mh = request.headers.get("X-Azimuth-Ingest");
        if (!env.INGEST_TOKEN || !_mh || !ctEq(_mh, env.INGEST_TOKEN)) return new Response("unauthorized", { status: 401 });
        let _mb; try { _mb = await request.json(); } catch (e) { return new Response("bad json", { status: 400 }); }
        if (!_mb || !_mb.generatedAt || !(_mb.meed || _mb.transactions)) return new Response("bad payload", { status: 400 });
        // MERGE, don't replace: the daily MEED collector and the weekly Najma pulse feed
        // different sections of one dashboard. `meed` deep-merges (corpus stats + development
        // cards have disjoint keys); everything else merges at top level.
        let _prev0 = null; try { _prev0 = JSON.parse((await env.MEETINGS.get("mkt_latest")) || "null"); } catch (e) {}
        if (_prev0) { try { await env.MEETINGS.put("mkt_prev", JSON.stringify(_prev0)); } catch (e) {} }
        const _merged = Object.assign({}, _prev0 || {}, _mb);
        if (_prev0 && _prev0.meed && _mb.meed) _merged.meed = Object.assign({}, _prev0.meed, _mb.meed);
        await env.MEETINGS.put("mkt_latest", JSON.stringify(_merged));
        return new Response(JSON.stringify({ ok: true, bytes: JSON.stringify(_merged).length, sections: Object.keys(_merged).filter(k => typeof _merged[k] === "object") }), { headers: { "Content-Type": "application/json" } });
      }
      if (url.pathname === "/ingest") {                        // v30 — passive group-chat ingest (READ-ONLY, writes cmt_ only)
        const _ih = request.headers.get("X-Azimuth-Ingest");
        if (!env.INGEST_TOKEN || !_ih || !ctEq(_ih, env.INGEST_TOKEN)) return new Response("unauthorized", { status: 401 });
        let _ib; try { _ib = await request.json(); } catch (e) { return new Response("bad json", { status: 400 }); }
        const _t = await ingestMessages(env, _ib && _ib.items);
        return new Response(JSON.stringify(_t), { headers: { "Content-Type": "application/json" } });
      }
      if (url.pathname === "/wa") {
        const raw = await request.text();
        const _fwdHdr = request.headers.get("X-Azimuth-Forward");
        const _viaForward = !!(env.WA_FORWARD_TOKEN && _fwdHdr && ctEq(_fwdHdr, env.WA_FORWARD_TOKEN));
        if (_fwdHdr && !_viaForward) return new Response("bad forward token", { status: 401 });   // a PRESENT-but-wrong forward header never falls through to the sig path
        if (!_viaForward && env.WA_FORWARD_TOKEN && !env.WA_APP_SECRET) return new Response("forward token required", { status: 401 });   // receiver-only instance (no Meta secret): forwarding is the ONLY door
        if (!_viaForward && !(await waVerifySig(env, raw, request.headers.get("X-Hub-Signature-256")))) return new Response("bad sig", { status: 401 });
        let body; try { body = JSON.parse(raw); } catch (e) { return new Response("ok"); }
        try {                                                          // v20 shape probe — no message content stored
          const _v = body.entry && body.entry[0] && body.entry[0].changes && body.entry[0].changes[0] && body.entry[0].changes[0].value;
          const _m = _v && _v.messages && _v.messages[0];
          const _st = _v && _v.statuses && _v.statuses[0];
          const _rec = { at: new Date().toISOString(), bytes: raw.length, field: body.entry && body.entry[0] && body.entry[0].changes && body.entry[0].changes[0] && body.entry[0].changes[0].field || null,
            hasMessages: !!_m, hasStatuses: !!_st, from: _m ? String(_m.from) : null, msgType: _m ? _m.type : null,
            statusOf: _st ? String(_st.recipient_id || "") : null, status: _st ? _st.status : null,
            phone_number_id: (_v && _v.metadata && _v.metadata.phone_number_id) || null, display_phone_number: (_v && _v.metadata && _v.metadata.display_phone_number) || null,
            viaForward: !!_viaForward };
          const _prev = JSON.parse((await env.MEETINGS.get("diag_walog")) || "[]"); _prev.unshift(_rec);
          await env.MEETINGS.put("diag_walog", JSON.stringify(_prev.slice(0, 10)), { expirationTtl: 86400 });
        } catch (e) {}
        const val = body.entry && body.entry[0] && body.entry[0].changes && body.entry[0].changes[0] && body.entry[0].changes[0].value;
        const msg = val && val.messages && val.messages[0];
        if (!msg) return new Response("ok");                          // delivery/read status callbacks — ignore
        const from = msg.from;
        if (!_viaForward && from) {                                    // sender-keyed router (one number, many instances)
          const _rk = "WA_ROUTE_" + String(from).replace(/[^0-9]/g, "");
          const _dest = env[_rk];
          const _tr = { routeKey: _rk, destSet: !!_dest, destPrefix: _dest ? String(_dest).slice(0, 48) : null, tokenSet: !!env.WA_FORWARD_TOKEN, forwarded: false, fwdStatus: null, fwdErr: null };
          if (_dest && env.WA_FORWARD_TOKEN) {
            try {
              const _init = { method: "POST", headers: { "Content-Type": "application/json", "X-Azimuth-Forward": env.WA_FORWARD_TOKEN }, body: raw };
              const _svc = (typeof _dest === "string" && !/^https?:\/\//i.test(_dest)) ? env[_dest] : null;   // binding NAME -> service binding
              let _fr;
              if (_svc && typeof _svc.fetch === "function") { _tr.via = "service-binding:" + _dest; _fr = await _svc.fetch(new Request("https://internal/wa", _init)); }
              else { _tr.via = "url"; _fr = await fetch(_dest, _init); }
              _tr.forwarded = true; _tr.fwdStatus = _fr.status; _tr.fwdBody = (await _fr.text()).slice(0, 80);
              if (_fr.status >= 300) await noteErr(env, "router-forward", "HTTP " + _fr.status + " -> " + String(_dest).slice(0, 60));
            } catch (e) { _tr.fwdErr = String(e && e.message || e).slice(0, 120); await noteErr(env, "router-forward", String(e && e.message || e)); }
            try { const _p = JSON.parse((await env.MEETINGS.get("diag_walog")) || "[]"); if (_p[0]) { _p[0].router = _tr; await env.MEETINGS.put("diag_walog", JSON.stringify(_p), { expirationTtl: 86400 }); } } catch (e) {}
            return new Response("ok");                                 // owned by the destination instance now
          }
          try { const _p = JSON.parse((await env.MEETINGS.get("diag_walog")) || "[]"); if (_p[0]) { _p[0].router = _tr; await env.MEETINGS.put("diag_walog", JSON.stringify(_p), { expirationTtl: 86400 }); } } catch (e) {}
        }
        if (env.WA_ALLOWED && from !== env.WA_ALLOWED) {                       // only you can drive it
          try { await env.MEETINGS.put("diag_lastdrop", JSON.stringify({ from: String(from), phone_number_id: (val && val.metadata && val.metadata.phone_number_id) || null, display_phone_number: (val && val.metadata && val.metadata.display_phone_number) || null, type: msg.type || null, at: new Date().toISOString(), had_route_key: !!env["WA_ROUTE_" + String(from).replace(/[^0-9]/g, "")], via_forward: !!_viaForward }), { expirationTtl: 86400 }); } catch (e) {}
          return new Response("ok");
        }
        if (msg.id) { const _mk = "wamsg_" + msg.id; if (await env.MEETINGS.get(_mk)) return new Response("ok"); await env.MEETINGS.put(_mk, "1", { expirationTtl: 3 * 86400 }); }
        if (msg.type === "interactive" && msg.interactive && msg.interactive.button_reply) {
          const bid = (msg.interactive.button_reply.id) || "";
          if (bid.indexOf("done:") === 0) { await env.MEETINGS.delete("act_" + bid.slice(5)); await waSend(env, from, "✅ Done — cleared from your plate."); }
          if (bid.indexOf("ga:") === 0 || bid.indexOf("gi:") === 0) {   // v31 — group opt-in decision
            const _gj = bid.slice(3), _on = bid.indexOf("ga:") === 0;
            const _gr = (await grpGet(env, _gj)) || { jid: _gj, name: "(unnamed group)", seen: Date.now() };
            _gr.enabled = _on; _gr.decided = Date.now();
            await grpSet(env, _gj, _gr);
            await waSend(env, from, _on ? ("👀 Watching “" + _gr.name + "”. Commitments and meetings from it will land on your ledger. Reply “stop watching " + _gr.name + "” anytime.")
                                        : ("🙈 Ignoring “" + _gr.name + "”. Azimuth won't read it. If you change your mind, tell me “watch " + _gr.name + "”."));
          }
          else if (bid === "mkt:dash") { await waSend(env, from, "📊 Najma — your market pulse:\n" + url.origin + "/market?key=" + env.READ_KEY); }
          else if (/^mkt:(pod|li|ig):\d$/.test(bid)) { const _mp2 = bid.split(":"); await draftFromAngle(env, from, _mp2[1], parseInt(_mp2[2], 10)); }
          else if (bid === "mkt:post:li") { await publishDraft(env, from); }
          else if (bid === "mkt:discard") { await env.MEETINGS.delete("mkt_lastdraft_li"); await waSend(env, from, "✖️ Dropped. Ask for another angle any time — “draft linkedin 2”."); }
          else if (bid.indexOf("pno:") === 0) { await env.MEETINGS.delete("pimg_" + bid.slice(4)); await waSend(env, from, "OK — nothing filed."); }
          else if (bid.indexOf("pimg:") === 0) {
            const _p = JSON.parse((await env.MEETINGS.get("pimg_" + bid.slice(5))) || "null");
            if (!_p) { await waSend(env, from, "That one expired — send the photo again."); return new Response("ok"); }
            await env.MEETINGS.delete("pimg_" + bid.slice(5));
            if (_p.kind === "meeting" && _p.meeting && _p.meeting.start_iso) {
              const ev = { summary: _p.meeting.title || "Meeting", start_iso: _p.meeting.start_iso, location: _p.meeting.location || "", source: "whatsapp", src: { type: "captured", channel: "whatsapp-photo" } };
              let inOutlook = false;
              try { const tk = await msToken(env); const oid = await msCreate(env, tk, AT(env), ev); if (oid) { inOutlook = true; ev.outlook_id = oid; ev.mailbox = AT(env); } } catch (e) {}
              await env.MEETINGS.put("evt_" + Date.now() + "_" + rid(), JSON.stringify(ev), { expirationTtl: 60 * 60 * 24 * 21 });
              try { await indexDoc(env, "evt_" + rid(), "meeting", (ev.summary || "") + " " + (ev.location || "") + " " + humanGst(ev.start_iso), ev.src); } catch (e) {}
              await waSend(env, from, "✅ " + ev.summary + "\n" + humanGst(ev.start_iso) + " GST" + (inOutlook ? "\n📅 On your calendar." : "") + " 🧭");
            } else {
              let n = 0;
              for (const tx of (_p.tasks || [])) {
                if (await findDupTask(env, tx)) continue;
                const aid = rid();
                await env.MEETINGS.put("act_" + aid, JSON.stringify({ id: aid, text: tx, from: "you", created: Date.now(), due_iso: null, src: { type: "captured", channel: "whatsapp-photo" } }), { expirationTtl: 30 * 86400 });
                try { await indexDoc(env, "act_" + aid, "task", tx, { type: "captured", channel: "whatsapp-photo" }); } catch (e) {}
                n++;
              }
              await waSend(env, from, n ? ("✅ Added " + n + " to your plate. 🧭") : "Those were already on your plate.");
            }
          }
          return new Response("ok");
        }
        if (msg.type === "image" && msg.image && msg.image.id) {
          const _cap = String((msg.image.caption || "")).trim();
          if (isBgCaption(_cap)) {
            try {
              const _img = await waFetchMedia(env, msg.image.id);          // {bytes, mime}
              if (_img.bytes.byteLength > 4 * 1024 * 1024) { await waSend(env, from, "That photo is a bit large — try one under 4 MB."); return new Response("ok"); }
              await env.MEETINGS.put("cfg_bg", _img.bytes);
              await env.MEETINGS.put("cfg_bg_ct", _img.mime || "image/jpeg");
              await waSend(env, from, "🖼 Got it — that's now the backdrop on your board. Re-open the board (or re-pin it) to see it.");
            } catch (e) { await waSend(env, from, "⚠ Couldn't read that photo — try sending it again."); }
            return new Response("ok");
          }
          if (/^(clear|remove|reset)\s+(my\s+)?(photo|picture|background|backdrop)/i.test(_cap)) { await env.MEETINGS.delete("cfg_bg"); await env.MEETINGS.delete("cfg_bg_ct"); await waSend(env, from, "🖼 Backdrop cleared."); return new Response("ok"); }
          try {
            const _img2 = await waFetchMedia(env, msg.image.id);
            if (_img2.bytes.byteLength > 4 * 1024 * 1024) { await waSend(env, from, "That photo is a bit large to read — try a smaller one."); return new Response("ok"); }
            const _rd = await readPhoto(env, _img2.bytes, _img2.mime, _cap);
            if (!_rd || _rd.kind === "nothing") {
              await waSend(env, from, "📷 " + ((_rd && _rd.summary) ? _rd.summary : "Got the photo") + ".\n\nNothing to file from it. To make it your board backdrop, send it again captioned \"this is me\".");
              return new Response("ok");
            }
            const _tok = rid();
            await env.MEETINGS.put("pimg_" + _tok, JSON.stringify(_rd), { expirationTtl: 900 });
            let _msg2 = "📷 " + _rd.summary + "\n\n";
            if (_rd.kind === "meeting" && _rd.meeting) {
              _msg2 += "🗓 " + _rd.meeting.title + (_rd.meeting.start_iso ? "\n" + humanGst(_rd.meeting.start_iso) + " GST" : "\n(no time I could read)") + (_rd.meeting.location ? "\n📍 " + _rd.meeting.location : "") + "\n\nAdd it?";
            } else {
              _msg2 += _rd.tasks.map(t => "📋 " + t).join("\n") + "\n\nAdd " + (_rd.tasks.length === 1 ? "it" : "them") + "?";
            }
            await waSendButtons(env, from, _msg2, [{ id: "pimg:" + _tok, title: "✅ Add" }, { id: "pno:" + _tok, title: "✖️ No" }]);
          } catch (e) { await waSend(env, from, "⚠ Couldn't read that photo — try again, or send it captioned \"this is me\" to use it as your backdrop."); }
          return new Response("ok");
        }
        if (msg.type === "text" && /^(clear|remove|reset)\s+(my\s+)?(photo|picture|background|backdrop)\b/i.test((msg.text && msg.text.body || "").trim())) { await env.MEETINGS.delete("cfg_bg"); await env.MEETINGS.delete("cfg_bg_ct"); await waSend(env, from, "🖼 Backdrop cleared."); return new Response("ok"); }
        let text = "";
        if (msg.type === "text") text = (msg.text && msg.text.body || "").trim();
        else if (msg.type === "audio") { try { text = await waTranscribe(env, msg.audio.id); } catch (e) { await waSend(env, from, "⚠ Couldn't read that voice note — try text."); return new Response("ok"); } }
        if (!text) { await waSend(env, from, "Send a meeting or task (text or voice) and I'll file it. \u{1F9ED}"); return new Response("ok"); }
        {                                                      // v35 — relationship-memory intents (routed BEFORE recall)
          let pm = text.match(/^(?:merge)\s+(.{1,60})\s+into\s+(.{1,60})$/i);
          if (pm) { await env.MEETINGS.put("palias_" + pslug(pm[1].trim()), pslug(pm[2].trim())); await peopleReindex(env); await waSend(env, from, "🔗 Merged “" + pm[1].trim() + "” into “" + pm[2].trim() + "”."); return new Response("ok"); }
          if (/^(?:who\s+owes\s+me|what(?:'s)?\s+owed\s+to\s+me)\??$/i.test(text)) {
            const rows = await ledgerByParty(env, "owed_to_me");
            await waSend(env, from, rows.length ? ("📥 Owed to you:\n" + rows.map(r => "• " + r.who + " — " + r.text + " (" + r.age + "d)").join("\n")) : "Nothing owed to you on the ledger.");
            return new Response("ok");
          }
          if (/^(?:what\s+do\s+i\s+owe|who\s+do\s+i\s+owe)\??$/i.test(text)) {
            const rows = await ledgerByParty(env, "owed_by_me");
            await waSend(env, from, rows.length ? ("📤 You owe:\n" + rows.map(r => "• " + r.who + " — " + r.text + " (" + r.age + "d)").join("\n")) : "Nothing owed by you on the ledger.");
            return new Response("ok");
          }
          const sm = text.match(/^(?:status|where\s+am\s+i|where\s+are\s+we|what(?:'s)?\s+(?:the\s+)?status)\s+(?:with\s+|on\s+|of\s+)?(.{2,60})$/i);
          if (sm) {
            const party = await findPartyByName(env, sm[1].trim());
            if (party) { const o = await assembleParty(env, party.slug); await waSend(env, from, await synthParty(env, o)); return new Response("ok"); }
            const parties = await listParties(env);
            if (parties.length) { await waSend(env, from, "No one matching “" + sm[1].trim() + "”. Try “people” or check /people."); return new Response("ok"); }
          }
        }
        {                                                      // v31 — "watch <group>" / "stop watching <group>" / "list groups" by name
          const gm = text.match(/^(?:stop\s+watch(?:ing)?|unwatch|ignore\s+group)\s+(.{2,80})$/i) || text.match(/^(?:watch|monitor)\s+(?:group\s+)?(.{2,80})$/i);
          const wantOn = gm ? !/^(?:stop|unwatch|ignore)/i.test(text) : false;
          if (/^(?:list|show)\s+(?:my\s+)?groups$/i.test(text)) {
            const gs = await listGroups(env);
            await waSend(env, from, gs.length ? ("👀 Groups Azimuth knows:" + NL10 + gs.map(g => (g.enabled ? "✅ " : "🙈 ") + g.name).join(NL10) + NL10 + NL10 + "Say “watch <name>” or “stop watching <name>”.") : "No groups seen yet — they appear here once the listener is paired.");
            return new Response("ok");
          }
          if (gm) {
            const q = gm[1].trim().toLowerCase().replace(/[”“"']/g, "");
            const gs = await listGroups(env);
            const hit = gs.find(g => String(g.name || "").toLowerCase().indexOf(q) !== -1);
            if (hit) {
              hit.enabled = wantOn; hit.decided = Date.now(); await grpSet(env, hit.jid, hit);
              await waSend(env, from, wantOn ? ("👀 Watching “" + hit.name + "”.") : ("🙈 Stopped watching “" + hit.name + "”."));
              return new Response("ok");
            }
            if (gs.length) { await waSend(env, from, "Couldn't find a group matching “" + gm[1].trim() + "”. Say “list groups” to see the names I know."); return new Response("ok"); }
          }
        }
        {                                                      // v36.1 — board / market / help intents (routed BEFORE question-recall, which
          // can only answer from filed items and says so — the "I only do tasks" trap for new users)
          if (/^(?:show\s+|open\s+|what(?:'|’| i)?s\s+on\s+)?(?:my\s+|the\s+)?(?:board|dashboard)\s*\??$/i.test(text)) {
            await waSend(env, from, "🖥 Your board:" + NL10 + url.origin + "/board?key=" + env.READ_KEY + NL10 + NL10 + "Open it and use “Add to Home Screen” — it becomes an app icon and updates live as we talk.");
            return new Response("ok");
          }
          if (/^(?:show\s+|open\s+)?(?:my\s+|the\s+)?(?:najma|market(?:\s+pulse)?|pulse)\s*\??$/i.test(text)) {
            await waSend(env, from, "📈 Najma — your market pulse:" + NL10 + url.origin + "/market?key=" + env.READ_KEY + NL10 + NL10 + "Built from the official registers. Your weekly brief lands here every Sunday morning, and I'll flag same-day movements when something shifts.");
            return new Response("ok");
          }
          const _dm = text.match(/^draft\s+(?:an?\s+)?(podcast|video|script|linkedin|post|instagram|insta|reel|ig)(?:\s+(?:script|post|reel))?(?:\s+(?:for\s+)?(?:angle\s+)?(\d))?\s*$/i);
          if (_dm) {
            const _kind = /podcast|video|script/i.test(_dm[1]) ? "pod" : /instagram|insta|reel|ig/i.test(_dm[1]) ? "ig" : "li";
            await draftFromAngle(env, from, _kind, _dm[2] ? parseInt(_dm[2], 10) : 1);
            return new Response("ok");
          }
          if (/^market\s+brief$/i.test(text)) {
            await waSend(env, from, "🕐 Running your market brief now — give me a moment…");
            try { await marketBriefTick(env, true); } catch (e) { await waSend(env, from, "Couldn't build the brief just now — try again shortly."); }
            return new Response("ok");
          }
          if (/^(?:help|menu|commands|what\s+can\s+you\s+do|what\s+do\s+you\s+do|how\s+do(?:es)?\s+(?:i|you|this)\s+(?:use\s+)?(?:you|this|work))\s*\??$/i.test(text)) {
            await waSend(env, from, "🧭 Here's what I can do:" + NL10 +
              "📋 Tasks — just tell me (“call Sara tomorrow 3pm”)" + NL10 +
              "🗓 Meetings — text or voice note, I file them with reminders" + NL10 +
              "📷 Photos — flyers, invites, whiteboards; I read them and file what's in them" + NL10 +
              "❓ Questions — ask about anything I've filed for you" + NL10 +
              "🤝 “who owes me” · “what do I owe” · “status with <name>”" + NL10 +
              "👀 “list groups” · “watch <name>” — what I listen to" + NL10 +
              "🖥 “board” — your live board link" + NL10 +
              "📈 “market” — your Najma market pulse" + NL10 +
              "🕐 “market brief” — your weekly brief, on demand" + NL10 +
              "🎙 “draft podcast 1” · ✍️ “draft linkedin 2” · 📸 “draft instagram 3” — content from an angle");
            return new Response("ok");
          }
        }
        { const cx = await waHandleCancel(env, from, text); if (cx !== null) { await waSend(env, from, cx); return new Response("ok"); } }
        if (isCalendarQuery(text)) { const ca = await calendarAnswer(env, text); if (ca) { await waSend(env, from, ca); return new Response("ok"); } }
        if (isQuestion(text)) { const rr = await recall(env, text); let out = "🧭 " + rr.answer; if (rr.sources && rr.sources.length) { out += NL10 + NL10 + "Sources:" + NL10 + rr.sources.map((s, i) => (i + 1) + ". " + ((s.subject || s.kind || "item") + (s.from ? " — " + s.from : ""))).join(NL10); } await waSend(env, from, out); return new Response("ok"); }
        const pk = "pending_wa_" + from;                              // light one-turn "when?" follow-up
        const prev = await env.MEETINGS.get(pk);
        const full = prev ? (prev + " | " + text) : text;
        const reply = await captureText(env, full, "whatsapp", from);
        if (reply && reply.indexOf("When is it") !== -1) await env.MEETINGS.put(pk, full, { expirationTtl: 900 });
        else await env.MEETINGS.delete(pk);
        if (reply) await waSend(env, from, reply);
        return new Response("ok");
      }
      if (request.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.WEBHOOK_SECRET) return new Response("unauthorized", { status: 401 });
      let update; try { update = await request.json(); } catch (e) { return new Response("ok"); }
      if (update.callback_query) { await handleCallback(env, update.callback_query); return new Response("ok"); }
      const msg = update.message || update.edited_message; if (!msg || String(msg.chat.id) !== String(CHAT)) return new Response("ok");
      let text = (msg.text || "").trim(); let heard = "";
      if (!text && (msg.voice || msg.audio)) { try { text = (await transcribe(env, (msg.voice || msg.audio).file_id)).trim(); } catch (e) { await say(env, "⚠️ Voice error: " + (e && e.message ? e.message : String(e))); return new Response("ok"); } heard = text; if (!text) { await say(env, "I couldn't make out that audio — try again or type it."); return new Response("ok"); } }
      const pendKey = "pending_" + CHAT;
      if (!text) { await say(env, "Add a meeting (text/voice), say \"cancel\", or \"action items\" to see your plate."); return new Response("ok"); }
      if (text.startsWith("/")) { await env.MEETINGS.delete(pendKey); await say(env, "I can: add meetings, \"cancel\" a meeting, and show your email \"action items\"."); return new Response("ok"); }
      const pend = JSON.parse((await env.MEETINGS.get(pendKey)) || "null");
      if (!pend && /(action items?|on my plate|to-?do list|my tasks?|my plate|what.{0,6}(do|left|plate))/i.test(text)) { await listActions(env); return new Response("ok"); }
      if (!pend && isCalendarQuery(text)) { const ca = await calendarAnswer(env, text); if (ca) { await tg(env, "sendMessage", { chat_id: env.TELEGRAM_CHAT_ID, parse_mode: "HTML", disable_web_page_preview: true, text: esc(ca) }); return new Response("ok"); } }
      if (!pend && isQuestion(text)) { const rr = await recall(env, text); let out = "🧭 " + esc(rr.answer); if (rr.sources && rr.sources.length) { out += NL10 + NL10 + "<i>Sources:</i>" + NL10 + rr.sources.map((s, i) => { const lbl = esc((s.subject || s.kind || "item") + (s.from ? " — " + s.from : "")); return s.webLink ? (i + 1) + '. <a href="' + s.webLink + '">' + lbl + "</a>" : (i + 1) + ". " + lbl; }).join(NL10); } await tg(env, "sendMessage", { chat_id: env.TELEGRAM_CHAT_ID, parse_mode: "HTML", disable_web_page_preview: true, text: out }); return new Response("ok"); }
      if (pend && pend.mode === "task") { await env.MEETINGS.delete(pendKey); const t = text.trim(); if (!t || /^(cancel|stop|nvm|never ?mind|no)$/i.test(t)) { await say(env, "OK, no task added."); return new Response("ok"); } const _dupT = await findDupTask(env, t); if (_dupT) { await say(env, "📋 <b>Already on your plate</b> — " + esc(t), true); return new Response("ok"); } const aid = rid(); await env.MEETINGS.put("act_" + aid, JSON.stringify({ id: aid, text: t, from: "you", created: Date.now(), src: { type: "captured", channel: "telegram" } }), { expirationTtl: 30 * 86400 }); await tg(env, "sendMessage", { chat_id: CHAT, parse_mode: "HTML", disable_web_page_preview: true, text: `\u{1F4CB} <b>${esc(t)}</b>\n<i>added to your plate</i>`, reply_markup: { inline_keyboard: [[{ text: "\u2705 Done", callback_data: "d:" + aid }]] } }); return new Response("ok"); }
      const taskM = text.match(/^\s*(?:(?:add a task|add task|new task)\b[:,\-\s]*|(?:task|to-?do)\b[:,\-\s]+)(.*)$/i);
      if (!pend && taskM) { const t = (taskM[1] || "").trim(); if (!t) { await env.MEETINGS.put(pendKey, JSON.stringify({ mode: "task" }), { expirationTtl: 900 }); await say(env, "\u{1F4CB} What's the task? (e.g. \"send the deck to Sara\")"); return new Response("ok"); } const _dupT = await findDupTask(env, t); if (_dupT) { await say(env, "📋 <b>Already on your plate</b> — " + esc(t), true); return new Response("ok"); } const aid = rid(); await env.MEETINGS.put("act_" + aid, JSON.stringify({ id: aid, text: t, from: "you", created: Date.now(), src: { type: "captured", channel: "telegram" } }), { expirationTtl: 30 * 86400 }); await tg(env, "sendMessage", { chat_id: CHAT, parse_mode: "HTML", disable_web_page_preview: true, text: `\u{1F4CB} <b>${esc(t)}</b>\n<i>added to your plate</i>`, reply_markup: { inline_keyboard: [[{ text: "\u2705 Done", callback_data: "d:" + aid }]] } }); return new Response("ok"); }

      if (pend && pend.mode === "cancel") { await env.MEETINGS.delete(pendKey); const t = text.trim().toLowerCase(); if (/^(none|no|cancel|stop|nvm|never ?mind)$/.test(t)) { await say(env, "OK, nothing cancelled."); return new Response("ok"); } const n = parseInt(t.replace(/[^0-9]/g, ""), 10); if (!n || n < 1 || n > pend.items.length) { await say(env, "Didn't catch a valid number — send a fresh \"cancel\"."); return new Response("ok"); } const it = pend.items[n - 1]; let ok = false; try { const tok = await msToken(env); ok = await msDelete(env, tok, it.mailbox, it.id); } catch (e) {} await say(env, ok ? `🗑 Cancelled — <b>${esc(it.summary)}</b> (${humanGst(it.start_iso)}).` : "⚠️ Couldn't cancel — try again.", true); return new Response("ok"); }
      if (pend && /^(cancel|stop|abort|nvm|never ?mind|forget it)$/i.test(text)) { await env.MEETINGS.delete(pendKey); await say(env, "OK, discarded that."); return new Response("ok"); }

      const isCancel = /\b(cancel|delete|remove|scrap|drop)\b/i.test(text) || /call\s*off/i.test(text);
      if (!pend && isCancel) { let items = []; try { const tok = await msToken(env); for (const mb of MB(env)) { items = items.concat(await msList(env, tok, mb)); } } catch (e) {} items = dedup(items); if (!items.length) { await say(env, "No upcoming meetings found to cancel."); return new Response("ok"); } const n = await matchCancel(env, text, items); if (n >= 1 && n <= items.length) { const it = items[n - 1]; let ok = false; try { const tok = await msToken(env); ok = await msDelete(env, tok, it.mailbox, it.id); } catch (e) {} await say(env, ok ? `🗑 Cancelled — <b>${esc(it.summary)}</b> (${humanGst(it.start_iso)}).` : "⚠️ Couldn't cancel — try again.", true); return new Response("ok"); } const lines = items.map((e, i) => `${i + 1}. ${esc(e.summary)} — ${humanGst(e.start_iso)}${e.location ? " · " + esc(e.location) : ""}`).join("\n"); await env.MEETINGS.put(pendKey, JSON.stringify({ mode: "cancel", items }), { expirationTtl: 900 }); await say(env, `Which one to cancel? Reply the number:\n${lines}`, true); return new Response("ok"); }

      if (!pend && /\b(task|to-?do|todo|remind me|note to self|don'?t forget|jot down|add to (?:my )?plate|put on my plate|call|e-?mail|send|text|message|ping|reply|respond|follow ?up|chase|pay|invoice|submit|review|sign|approve|book|order|buy|prepare|draft|finish|complete|update|check)\b/i.test(text)) {
        const intent = await classifyIntent(env, text);
        if (intent && intent.kind === "task" && intent.text) {
          { const _dup = await findDupTask(env, intent.text); if (_dup) { await say(env, "📋 <b>Already on your plate</b> — " + esc(intent.text), true); return new Response("ok"); } }
          const aid = rid();
          await env.MEETINGS.put("act_" + aid, JSON.stringify({ id: aid, text: intent.text, from: "you", created: Date.now(), due_iso: intent.due_iso || null, src: { type: "captured", channel: "telegram" } }), { expirationTtl: 30 * 86400 }); try { await indexDoc(env, "act_" + aid, "task", intent.text, { type: "captured", channel: "telegram" }); } catch (e) {} try { if (intent.commitment) await cmtPut(env, "act_" + aid, { text: intent.text, direction: intent.commitment.direction, counterparty: intent.commitment.counterparty, due_hint: intent.commitment.due_hint }, { type: "captured", channel: "telegram" }); } catch (e) {}
          await tg(env, "sendMessage", { chat_id: CHAT, parse_mode: "HTML", disable_web_page_preview: true, text: `📋 <b>${esc(intent.text)}</b>${intent.due_iso ? "\n⏰ " + esc(humanGst(intent.due_iso)) + " GST" : ""}\n<i>added to your plate</i>`, reply_markup: { inline_keyboard: [[{ text: "✅ Done", callback_data: "d:" + aid }]] } });
          return new Response("ok");
        }
      }
      const skip = /^(no|none|skip|n\/?a|nowhere|tbd)$/i.test(text);
      const accumulated = pend ? (pend.text + " | " + text) : text;
      const asked = (pend && pend.asked) || { datetime: false, location: false };
      const parsed = await parseMeeting(env, accumulated);
      if (!parsed.ok || !parsed.start_iso) { if (!asked.datetime) { asked.datetime = true; await env.MEETINGS.put(pendKey, JSON.stringify({ mode: "add", text: accumulated, asked }), { expirationTtl: 900 }); await say(env, "🗓 When is it? (e.g. \"3pm Saturday\")"); return new Response("ok"); } await env.MEETINGS.delete(pendKey); await say(env, "I still couldn't get a date — try \"9am Saturday\"."); return new Response("ok"); }
      let loc = (parsed.location || "").trim();
      if (!loc && asked.location && !skip && !/^online$/i.test(text.trim())) loc = text.trim();
      if (!loc && !asked.location && !skip) { asked.location = true; await env.MEETINGS.put(pendKey, JSON.stringify({ mode: "add", text: accumulated, asked }), { expirationTtl: 900 }); await say(env, "📍 Where is it? — Dubai, Abu Dhabi, Sharjah… or reply \"online\" / \"skip\"."); return new Response("ok"); }
      await env.MEETINGS.delete(pendKey);
      const event = { summary: parsed.title || "Meeting", start_iso: parsed.start_iso, location: loc, source: "telegram", src: { type: "captured", channel: "telegram" } };
      const _u = accumulated.match(/https?:\/\/\S+/i); if (_u) event.join = _u[0].replace(/[)>\].,;'"]+$/, "");
      // resolve a named venue via Google Places before committing the location
      if (isVenue(loc) && env.MAPS_KEY) {
        const mem = JSON.parse((await env.MEETINGS.get(venueKey(loc))) || "null");
        if (mem && mem.address) { event.location = mem.address; }
        else {
          const cands = await placesSearch(env, loc);
          if (cands.length) {
            const vtok = rid();
            await env.MEETINGS.put("vpick_" + vtok, JSON.stringify({ event, typed: loc, cands }), { expirationTtl: 900 });
            const kb = cands.slice(0, 3).map((c, i) => { const em = emirateOf(c.address)[0]; return [{ text: `${c.name}${em ? " · " + em : ""}`.slice(0, 60), callback_data: `v:${vtok}:${i}` }]; });
            kb.push([{ text: `📌 Keep "${loc}" as I typed it`.slice(0, 60), callback_data: `v:${vtok}:raw` }]);
            await tg(env, "sendMessage", { chat_id: CHAT, parse_mode: "HTML", disable_web_page_preview: true, text: `📍 <b>${esc(loc)}</b> — which location?`, reply_markup: { inline_keyboard: kb } });
            return new Response("ok");
          }
        }
      }
      let inOutlook = false; try { const tok = await msToken(env); const oid = await msCreate(env, tok, AT(env), event); if (oid) { inOutlook = true; event.outlook_id = oid; event.mailbox = AT(env); } } catch (e) {}
      await env.MEETINGS.put("evt_" + Date.now() + "_" + rid(), JSON.stringify(event), { expirationTtl: 60 * 60 * 24 * 21 }); try { await indexDoc(env, "evt_" + rid(), "meeting", (event.summary || "") + " " + (event.location || "") + (event.start_iso ? " " + event.start_iso.slice(0, 10) + " " + humanGst(event.start_iso) + " GST" : ""), event.src || null); } catch (e) {}
      const heardLine = heard ? `🎤 <i>"${esc(heard)}"</i>\n` : "";
      await say(env, `${heardLine}✅ Got it — <b>${esc(event.summary)}</b>\n🗓 ${humanGst(event.start_iso)} GST${event.location ? " · " + esc(event.location) : ""}\n${inOutlook ? "📅 Added to your Outlook calendar. " : ""}Reminders set. 🧭`, true);
      return new Response("ok");
    }
    return new Response("meeting-capture is running");
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      try { if (env.GH_PAT) await fetch(GH_DISPATCH, { method: "POST", headers: { "Authorization": "Bearer " + env.GH_PAT, "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "meeting-capture-cron", "Content-Type": "application/json" }, body: JSON.stringify({ ref: "main", inputs: { force_mode: "auto" } }) }); } catch (e) {}
      try { const tok = await msToken(env); await scanEmails(env, tok); } catch (e) {}
      try { const tok = await msToken(env); await scanSent(env, tok, { sinceMin: 90, cap: 40 }); } catch (e) {}   // v35.1 — sent-items promises
      try { const n = gstNow(); if (n.getUTCHours() === 7 && n.getUTCMinutes() < 30) { const dk = "digest_" + n.getUTCFullYear() + pad(n.getUTCMonth() + 1) + pad(n.getUTCDate()); if (!(await env.MEETINGS.get(dk))) { await env.MEETINGS.put(dk, "1", { expirationTtl: 2 * 86400 }); await morningDigest(env); } } } catch (e) {}
      try { const _n = gstNow(); const _h = _n.getUTCHours(); if ((_h === 7 || _h === 15 || _h === 20) && _n.getUTCMinutes() < 30) { const _pk = "proppass_" + gstDateStr(_n) + "_" + _h; if (!(await env.MEETINGS.get(_pk))) { await env.MEETINGS.put(_pk, "1", { expirationTtl: 2 * 86400 }); await proposePass(env, _h); } } } catch (e) {}
      try {
        const now = Date.now();
        const tl = await env.MEETINGS.list({ prefix: "act_" });
        for (const k of tl.keys) {
          const v = await env.MEETINGS.get(k.name); if (!v) continue;
          let t; try { t = JSON.parse(v); } catch (e) { continue; }
          if (!t.due_iso || t.reminded) continue;
          const due = Date.parse(t.due_iso); if (isNaN(due)) continue;
          if (due <= now + 30 * 60 * 1000 && due >= now - 12 * 3600 * 1000) {
            await tg(env, "sendMessage", { chat_id: env.TELEGRAM_CHAT_ID, parse_mode: "HTML", disable_web_page_preview: true, text: `⏰ <b>Task due</b> — ${esc(t.text)}\n<i>${esc(humanGst(t.due_iso))} GST</i>`, reply_markup: { inline_keyboard: [[{ text: "✅ Done", callback_data: "d:" + t.id }]] } });
            try { if (env.WHATSAPP_TOKEN && env.WA_ALLOWED) await waSendButtons(env, env.WA_ALLOWED, `⏰ Task due — ${t.text} (${humanGst(t.due_iso)} GST)`, [{ id: "done:" + t.id, title: "✅ Done" }]); } catch (e) {}
            t.reminded = true;
            const ttl = Math.max(60, Math.floor(((t.created || now) + 30 * 86400 * 1000 - now) / 1000));
            await env.MEETINGS.put(k.name, JSON.stringify(t), { expirationTtl: ttl });
          }
        }
      } catch (e) {}
      try { await meetingNudges(env); } catch (e) {}          // v32 — T-30/T-15 meeting nudges
      try { const _n = gstNow(); if (_n.getUTCHours() === 6 && _n.getUTCMinutes() < 30) { const rk = "reindex_" + gstDateStr(_n); if (!(await env.MEETINGS.get(rk))) { await env.MEETINGS.put(rk, "1", { expirationTtl: 2 * 86400 }); await peopleReindex(env); } } } catch (e) {}   // v35 — daily party reindex ~06:00 GST
      try { await marketBriefTick(env); } catch (e) {}        // v36 — weekly Market Pulse brief (Sunday ~09:00 GST, MARKET_BRIEF="on" only)
    })());
  },
};

// ── Market Pulse (v36) ── dashboard renderer + weekly brief ─────────────────────────────
function mkFmtM(v) { if (v == null) return "—"; if (v >= 1000) return "$" + (v / 1000).toFixed(1) + "bn"; return "$" + Math.round(v) + "m"; }
function renderMarket(latestRaw, prevRaw) {
  let d = null, p = null;
  try { d = JSON.parse(latestRaw || "null"); } catch (e) {}
  try { p = JSON.parse(prevRaw || "null"); } catch (e) {}
  if (!d) return '<!doctype html><meta charset=utf-8><body style="font-family:system-ui;background:#0a2223;color:#eee6d6;padding:2rem"><h2>Market Pulse</h2><p>No data yet — the collector has not delivered. Run the market-pulse Action once, then refresh.</p>';
  const m = d.meed || {};
  const prevStage = {}; if (p && p.meed && p.meed.byStage) for (const s of p.meed.byStage) prevStage[s.stage] = s;
  const ageDays = (Date.now() - Date.parse(d.generatedAt || 0)) / 86400000;
  const stale = !(ageDays < 3);
  const esc2 = (s) => String(s == null ? "" : s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const stageRows = (m.byStage || []).map(s => {
    const pv = prevStage[s.stage]; let delta = "";
    if (pv && pv.count !== s.count) { const df = s.count - pv.count; delta = ' <span style="color:' + (df > 0 ? "#56B584" : "#D9A441") + '">' + (df > 0 ? "▲" : "▼") + Math.abs(df) + "</span>"; }
    return "<tr><td>" + esc2(s.stage) + delta + '</td><td style="text-align:right">' + s.count + '</td><td style="text-align:right">' + mkFmtM(s.valueUsdM) + "</td></tr>";
  }).join("");
  const projRows = (list) => (list || []).map(r => "<tr><td>" + esc2(r.title) + "</td><td>" + esc2(r.stage) + '</td><td style="text-align:right">' + mkFmtM(r.valueUsdM) + '</td><td style="text-align:right;white-space:nowrap">' + esc2(r.updated || "") + "</td></tr>").join("");

  const t = d.transactions || null, rn = d.rents || null, mo = d.monthly || null, ho = d.handover || null;
  const num2 = (v) => (v == null ? "—" : Number(v).toLocaleString("en-US"));
  let body = "";

  // ── THE PULSE — DLD registered sales ──
  if (t) {
    const offTot = (t.offPlanSplit && (t.offPlanSplit["Off-Plan"] || 0) + (t.offPlanSplit["Ready"] || 0)) || 0;
    const offPct = offTot ? Math.round(100 * (t.offPlanSplit["Off-Plan"] || 0) / offTot) : null;
    body += '<div class=hero><div class=hv>AED ' + esc2(t.salesValueAedBn) + '<small> billion</small></div><div class=hl>registered sales · ' + esc2(String(t.periodFrom || "")) + " → " + esc2(String(t.periodTo || "")) + ' · Dubai Land Department (DLD)</div></div>' +
      '<div class=grid>' +
      '<div class=st><div class=v>' + num2(t.salesCount) + '</div><div class=l>sales registered</div></div>' +
      '<div class=st><div class=v>' + num2(t.medianResidentialAedSqft) + '<small>/sq ft</small></div><div class=l>median residential (AED)</div></div>' +
      '<div class=st><div class=v>' + (t.medianTicketAed ? (t.medianTicketAed / 1e6).toFixed(2) + "m" : "—") + '</div><div class=l>median ticket (AED)</div></div>' +
      '<div class=st><div class=v>' + (offPct == null ? "—" : offPct + "<small>%</small>") + '</div><div class=l>of sales are off-plan</div></div>' +
      "</div>";
    if (offPct != null) body += '<div class=card><h2>Off-plan vs ready</h2><div class=bar><i style="width:' + offPct + '%;background:#C5A56A"></i><i style="width:' + (100 - offPct) + '%;background:#3E8A7E"></i></div><div class=lg><span><b>' + num2(t.offPlanSplit["Off-Plan"]) + "</b> off-plan</span><span><b>" + num2(t.offPlanSplit["Ready"]) + "</b> ready</span></div></div>";
    if (t.weekly && t.weekly.length) {
      const mx = Math.max(...t.weekly.map(w => w.sales)) || 1;
      body += '<div class=card><h2>Sales by week</h2><div class=spark>' + t.weekly.map((w, i) => '<div class=wk title="' + esc2(w.week) + ": " + num2(w.sales) + ' sales"><i style="height:' + Math.max(4, Math.round(64 * w.sales / mx)) + "px" + (i === t.weekly.length - 1 ? ";opacity:.45;border:1px dashed #3B584F;background:none" : (w.sales === mx ? ";background:#C5A56A" : "")) + '"></i><span>' + esc2(String(w.week).slice(-3)) + "</span></div>").join("") + '</div><div class=note>Newest bar is a part-week — registration lags the deal.</div></div>';
    }
    if (t.topAreas && t.topAreas.length) {
      const amx = t.topAreas[0].sales || 1;
      body += '<div class=card><h2>Where the market is trading</h2>' + t.topAreas.slice(0, 8).map(a => '<div class=arow><span class=nm>' + esc2(a.area) + '</span><span class=tr><i style="width:' + Math.round(100 * a.sales / amx) + '%"></i></span><span class=ct>' + num2(a.sales) + "</span></div>").join("") + "</div>";
    }
  }
  if (mo && mo.series && mo.series.length) {
    const vmx = Math.max(...mo.series.map(s => s.valueAedBn)) || 1;
    body += '<div class=card><h2>The year so far — AED ' + esc2(mo.ytdValueAedBn) + "bn · " + num2(mo.ytdSales) + ' sales</h2><div class=spark>' + mo.series.map((s, i) => '<div class=wk title="' + esc2(s.month) + ": AED " + s.valueAedBn + 'bn"><i style="height:' + Math.max(4, Math.round(64 * s.valueAedBn / vmx)) + "px" + (i === mo.series.length - 1 ? ";opacity:.45;border:1px dashed #3B584F;background:none" : "") + '"></i><span>' + esc2(String(s.month).slice(5)) + "</span></div>").join("") + "</div></div>";
  }

  // ── RENTS & YIELDS — Ejari ──
  if (rn) {
    body += '<div class=card><h2>Rents &amp; gross yields · ' + num2(rn.contractsCount) + " contracts, " + esc2(String(rn.registrationTo || "")) + "</h2>" +
      '<div class=grid style="margin-bottom:.5rem"><div class=st><div class=v>' + (rn.medianAnnualRentAed ? Math.round(rn.medianAnnualRentAed / 1000) + "k" : "—") + '</div><div class=l>median annual rent (AED)</div></div><div class=st><div class=v>' + esc2(rn.medianRentAedSqftYr || "—") + '<small>/sq ft/yr</small></div><div class=l>median residential (AED)</div></div></div>' +
      ((rn.grossYieldPctByArea || []).slice(0, 6).map(y => { const ymx = rn.grossYieldPctByArea[0].yieldPct || 1; return '<div class=arow><span class=nm>' + esc2(y.area) + '</span><span class=tr><i style="width:' + Math.round(100 * y.yieldPct / ymx) + '%"></i></span><span class=ct>' + y.yieldPct + "%</span></div>"; }).join("")) +
      '<div class=note>' + esc2(rn.yieldNote || "") + "</div></div>";
  }

  // ── HANDOVER RADAR ──
  if (ho && ho.meedByQuarter) {
    const qs = Object.entries(ho.meedByQuarter).slice(0, 5);
    body += '<div class=card><h2>Handover radar</h2>' + qs.map(([q, e]) => '<div class=arow><span class=nm style="color:#C5A56A">' + esc2(q) + '</span><span style="flex:1;font-size:.82rem">' + e.packages + " package(s) · " + mkFmtM(e.valueUsdM) + "</span></div>").join("") + '<div class=note>' + esc2((ho.note || "").slice(0, 160)) + "</div></div>";
  }

  // ── TRACKED DEVELOPMENTS — demand (DLD) vs delivery (MEED) ──
  if (m.developments && m.developments.length) {
    body += '<div class=card><h2>Tracked developments — demand vs delivery</h2>' + m.developments.map(dv => {
      const dp = dv.dldPulse;
      return '<div class=dev><div class=devh><b>' + esc2(dv.development) + "</b><span class=pv>" + esc2(dv.developer) + " · " + esc2(dv.location || "") + '</span></div><div class=devg><div><span class=k>DEMAND — DLD</span>' +
        (dp ? ("<br>" + num2(dp.salesCount) + " sales · AED " + num2(dp.salesValueAedM) + "m<br>" + num2(dp.medianResidentialAedSqft) + "/sq ft · " + dp.offPlanPct + "% off-plan") : "<br><span class=pv>" + esc2(dv.mapNote || "outside DLD coverage") + "</span>") +
        '</div><div><span class=k>DELIVERY — MEED</span><br>' + dv.activeProjects + " active · " + mkFmtM(dv.pipelineValueUsdM) + (dv.nextCompletion ? "<br>next handover " + esc2(String(dv.nextCompletion).slice(0, 10)) : "") + "</div></div></div>";
    }).join("") + '<div class=note>' + esc2(m.valueDisclaimer || "Project values are MEED estimates in US$; progress is editorial, not measured.") + "</div></div>";
  }

  // ── SUPPLY CORPUS — MEED daily collector ──
  if (m.byStage) {
    body += '<div class=card><h2>' + esc2(m.country || "UAE") + " supply pipeline by stage</h2><table>" + stageRows + "</table></div>";
    if (m.recentBigUpdates && m.recentBigUpdates.length) body += '<div class=card><h2>Recently updated · ≥ $50m</h2><table>' + projRows(m.recentBigUpdates) + "</table></div>";
    if (m.largestUnderConstruction && m.largestUnderConstruction.length) body += '<div class=card><h2>Largest under construction</h2><table>' + projRows((m.largestUnderConstruction || []).slice(0, 8)) + "</table></div>";
  }

  return '<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>Najma</title><style>' +
    "body{font-family:system-ui,-apple-system,Segoe UI,Roboto;background:#0C1413;color:#E8E4D8;margin:auto;padding:14px 12px 40px;max-width:460px}" +
    ".mast{font-size:1.7rem;font-weight:700;letter-spacing:-.01em}.mast em{font-style:normal;color:#C5A56A}" +
    ".sub{color:#8FA39B;font-size:.78rem;margin:.2rem 0 .9rem}" +
    ".hero{background:#182823;border:1px solid #24352F;border-radius:10px;padding:14px;margin-bottom:10px}" +
    ".hv{font-size:2rem;font-weight:600;color:#C5A56A}.hv small{font-size:1rem;color:#8FA39B}.hl{color:#8FA39B;font-size:.75rem;margin-top:2px}" +
    ".grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}" +
    ".st{background:#131F1D;border:1px solid #24352F;border-radius:8px;padding:10px}.st .v{font-size:1.35rem;font-weight:600}.st .v small{font-size:.8rem;color:#8FA39B}.st .l{color:#8FA39B;font-size:.72rem;margin-top:2px}" +
    ".card{background:#131F1D;border:1px solid #24352F;border-radius:10px;padding:13px;margin-bottom:10px}" +
    "h2{font-size:.68rem;letter-spacing:.14em;color:#C5A56A;text-transform:uppercase;margin:0 0 .6rem;font-weight:600}" +
    ".bar{display:flex;height:10px;border-radius:5px;overflow:hidden;background:#182823}.bar i{display:block;height:100%}" +
    ".lg{display:flex;justify-content:space-between;color:#8FA39B;font-size:.75rem;margin-top:5px}.lg b{color:#E8E4D8}" +
    ".spark{display:flex;align-items:flex-end;gap:4px}.wk{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px}.wk i{display:block;width:100%;background:#3E8A7E;border-radius:2px 2px 0 0}.wk span{font-size:.58rem;color:#8FA39B}" +
    ".arow{display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid #182823}.arow:last-of-type{border-bottom:none}.nm{flex:0 0 46%;font-size:.8rem}.tr{flex:1;height:6px;border-radius:3px;background:#182823;overflow:hidden}.tr i{display:block;height:100%;background:#3E8A7E}.ct{font-size:.72rem;color:#8FA39B;min-width:40px;text-align:right;font-variant-numeric:tabular-nums}" +
    ".dev{border:1px solid #24352F;border-radius:8px;background:#182823;padding:10px;margin-bottom:8px}.devh{display:flex;justify-content:space-between;gap:8px;align-items:baseline}.devg{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:6px;font-size:.78rem}.k{font-size:.6rem;letter-spacing:.1em;color:#8FA39B}" +
    ".note{color:#8FA39B;font-size:.72rem;margin-top:.5rem}.pv{font-size:.72rem;color:#8FA39B}" +
    "table{width:100%;border-collapse:collapse;font-size:.8rem}td{padding:.3rem .2rem;border-bottom:1px solid #182823;vertical-align:top}" +
    ".warn{background:#33270F;color:#D9A441;border:1px solid #4A3B1E;padding:.5rem .7rem;border-radius:.5rem;font-size:.78rem;margin:.6rem 0}" +
    "</style></head><body>" +
    '<div class=mast>Najma <em>نجمة</em></div><div class=sub>The market pulse — Dubai property from the official register.</div>' +
    (stale ? "<div class=warn>⚠️ Data is " + Math.round(ageDays) + " days old — collector may be down. Do not quote until refreshed.</div>" : "") +
    body +
    '<div class=pv style="margin-top:1rem;line-height:1.6">' +
    (t ? "Source: Dubai Land Department (DLD) Open Data. Contains information from the Government of Dubai.<br>" : "") +
    "Project data licensed from MEED Projects (GlobalData), served via Digital Abbot Cloud" + (m.corpusVersion ? " — corpus v" + esc2(m.corpusVersion) : "") + ".<br>" +
    "Every source passes a fail-closed sanity gate; a failing source is quarantined, never averaged in. Refreshed " + esc2(String(d.generatedAt || "").slice(0, 16)) + "Z." +
    "</div></body></html>";
}
async function marketBriefTick(env, force) {
  if ((env.MARKET_BRIEF || "") !== "on") return;                                   // opt-in per instance
  const n = gstNow();
  if (!force && (n.getUTCHours() !== 9 || n.getUTCMinutes() >= 30)) return;        // daily check ~09:00 GST
  const isSunday = force ? true : n.getUTCDay() === 0;                             // Sunday = full roundup; force = full roundup now
  if (!force) {
    const bk = "mktbrief_" + gstDateStr(n);
    if (await env.MEETINGS.get(bk)) return;
    await env.MEETINGS.put(bk, "1", { expirationTtl: 3 * 86400 });
  }
  const raw = await env.MEETINGS.get("mkt_latest");
  if (!raw) return;
  let d; try { d = JSON.parse(raw); } catch (e) { return; }
  const ageDays = (Date.now() - Date.parse(d.generatedAt || 0)) / 86400000;
  if (!(ageDays < 4)) { if (isSunday) { try { await waSend(env, env.WA_ALLOWED, "Market brief skipped this week — the data feed is " + Math.round(ageDays) + " days old and I will not brief from stale numbers. The collector needs attention."); } catch (e) {} } return; }
  const m = d.meed || {};
  // ── event gate: weekdays speak ONLY when something moved ──
  if (!isSunday) {
    let moved = [];
    try {
      const prawv = await env.MEETINGS.get("mkt_prev");
      const pd = prawv ? JSON.parse(prawv) : null;
      const ps = {}; if (pd && pd.meed && pd.meed.byStage) for (const s of pd.meed.byStage) ps[s.stage] = s;
      for (const s of (m.byStage || [])) {
        const pv = ps[s.stage];
        if (pv && Math.abs(s.count - pv.count) >= 5) moved.push(`${s.stage}: ${pv.count} -> ${s.count}`);
      }
      const today = gstDateStr(n), yd = gstDateStr(new Date(n.getTime() - 86400000));
      for (const r of (m.recentBigUpdates || [])) {
        if ((r.valueUsdM || 0) >= 250 && (r.updated === today || r.updated === yd)) moved.push(`updated: ${r.title} (${r.valueUsdM}m, ${r.updated})`);
      }
    } catch (e) {}
    if (!moved.length) return;                                                     // quiet day — say nothing
    d._movement = moved.slice(0, 8);                                               // pass the triggers to the drafter
  }
  const sys = isSunday
    ? "You draft a weekly WhatsApp market brief for a Dubai real-estate professional who makes short advisory videos. Plain English, construction-literate, no hype, at most one emoji. Use ONLY the figures provided — never invent, extrapolate or round beyond one decimal. The data may contain several SECTIONS: dldSales (registered sales transactions — price and volume claims allowed, tag 'DLD Open Data' with the period), monthly (year-to-date), rents (registered Ejari contracts — rent and gross-yield claims allowed, tag 'DLD Ejari'), handover (declared completion programmes), developments (tracked projects, demand vs delivery), supply (MEED project corpus — supply/pipeline claims ONLY, never price). Structure: THREE candidate story angles ranked by how unusual the movement is, each with its exact figure and a one-line source tag; then one line per angle on what it means for a buyer; then a final WHAT NOT TO CLAIM line naming the claims the provided sections cannot support (a section that is null supports no claim at all; supply data never supports a price claim). Under 280 words. Plain text."
    : "You draft a SHORT same-day market alert for a Dubai real-estate professional. Something moved in the construction-supply data TODAY — the movement triggers are provided. ONE angle only: the single most story-worthy movement, its exact figure, one line on what it means for a buyer, one line on why today. Use ONLY the figures provided. End with: (Supply data, MEED corpus — not sales transactions.) Under 110 words. Plain text, at most one emoji.";
  const user = JSON.stringify({ generatedAt: d.generatedAt, movementTriggers: d._movement || null,
    dldSales: d.transactions ? { period: [d.transactions.periodFrom, d.transactions.periodTo], salesCount: d.transactions.salesCount, salesValueAedBn: d.transactions.salesValueAedBn, medianTicketAed: d.transactions.medianTicketAed, medianResidentialAedSqft: d.transactions.medianResidentialAedSqft, offPlanSplit: d.transactions.offPlanSplit, topAreas: (d.transactions.topAreas || []).slice(0, 6), weekly: d.transactions.weekly } : null,
    monthly: d.monthly ? { ytdSales: d.monthly.ytdSales, ytdValueAedBn: d.monthly.ytdValueAedBn, series: d.monthly.series } : null,
    rents: d.rents ? { registrationTo: d.rents.registrationTo, contractsCount: d.rents.contractsCount, medianAnnualRentAed: d.rents.medianAnnualRentAed, medianRentAedSqftYr: d.rents.medianRentAedSqftYr, grossYieldPctByArea: d.rents.grossYieldPctByArea, versionSplit: d.rents.versionSplit } : null,
    handover: d.handover ? { meedByQuarter: d.handover.meedByQuarter } : null,
    developments: (m.developments || []).map(x => ({ development: x.development, developer: x.developer, activeProjects: x.activeProjects, pipelineValueUsdM: x.pipelineValueUsdM, nextCompletion: x.nextCompletion, dldPulse: x.dldPulse })),
    supply: { source: m.source, corpusVersion: m.corpusVersion, country: m.country, byStage: m.byStage, recentBigUpdates: m.recentBigUpdates, largestUnderConstruction: (m.largestUnderConstruction || []).slice(0, 5), gccTotals: m.gcc && m.gcc.totals, byCountry: m.gcc && m.gcc.byCountry } });
  let brief = null;
  try { brief = await claudeText(env, sys, user, null, 900); } catch (e) {}
  if (!brief) return;
  const hasDld = !!d.transactions;
  const head = (isSunday ? (hasDld ? "🕐 Najma weekly — the pulse is in" : "🏗️ Weekly Market Pulse — supply side") : "🏗️ Market movement — supply side") + " (" + String(d.generatedAt || "").slice(0, 10) + ")\n\n";
  try { await waSend(env, env.WA_ALLOWED, head + brief); } catch (e) {}
  if (isSunday) {                                                                  // v36.3 — tap-to-draft: store the brief + its figures, offer content buttons
    try {
      await env.MEETINGS.put("mkt_briefctx", JSON.stringify({ at: Date.now(), brief, data: user }), { expirationTtl: 8 * 86400 });
      await waSendButtons(env, env.WA_ALLOWED, "Turn an angle into content — or say e.g. “draft linkedin 3” for any angle:", [
        { id: "mkt:ig:1", title: "📸 Instagram — Angle 1" },
        { id: "mkt:li:2", title: "✍️ LinkedIn — Angle 2" },
        { id: "mkt:dash", title: "📊 Dashboard" }]);
    } catch (e) {}
  }
}

// v36.3 — draft content from one angle of the stored weekly brief. The draft inherits the
// brief's discipline: only the stored figures, every claim source-tagged. It is a DRAFT for
// Naj to approve and record — never something that posts itself anywhere.
async function draftFromAngle(env, to, kind, n) {
  const raw = await env.MEETINGS.get("mkt_briefctx");
  if (!raw) { await waSend(env, to, "No weekly brief on file yet — say “market brief” and I'll run one now."); return; }
  let ctx; try { ctx = JSON.parse(raw); } catch (e) { return; }
  const sys = kind === "pod"
    ? "You write a 60-90 second to-camera video script for Najjuko ('Naj'), a Dubai property broker. Spoken, warm, plain English, construction-literate, no hype, no emojis, no stage directions, no greetings like 'hey guys'. Open with the chosen angle's hook in one sentence. Use ONLY figures from the provided brief and data; every figure carries its source and period exactly as given (e.g. 'DLD Open Data, 30 Jun-25 Aug'). One practical takeaway for a buyer to close. 140-210 words, plain text."
    : kind === "ig"
    ? "You write an Instagram reel package for Najjuko, a Dubai property broker, from ONE angle of the provided brief. Two parts, exactly this structure, plain text: SCRIPT: a 30-45 second spoken-to-camera script (70-105 words) — hook in the first five words, one figure with its source and period said out loud, one buyer takeaway, no emojis, no stage directions. CAPTION: 2-4 short lines restating the figure WITH its source and period, one question to invite comments, then at most 5 hashtags on the final line. Use ONLY figures from the provided brief and data — never invent or sharpen a number."
    : "You write a LinkedIn post for Najjuko, a Dubai property broker. First line is the angle's hook — specific, no clickbait. Short paragraphs. Use ONLY figures from the provided brief and data; every figure carries its source and period. One practical buyer takeaway. End with one question inviting comments. At most 3 hashtags. Under 140 words, plain text.";
  const user2 = "DRAFT FROM ANGLE " + n + " of this brief.\n\nTHE BRIEF:\n" + ctx.brief + "\n\nTHE FIGURES (the only numbers you may use):\n" + ctx.data;
  let out = null;
  try { out = await claudeText(env, sys, user2, null, 900); } catch (e) {}
  if (!out) { await waSend(env, to, "Couldn't draft that just now — try again in a minute."); return; }
  const label = kind === "pod" ? "🎙 Podcast script" : kind === "ig" ? "📸 Instagram reel + caption" : "✍️ LinkedIn draft";
  await waSend(env, to, label + " — Angle " + n + "\n\n" + out + (kind === "li" ? "" : "\n\n— a draft to make your own, not to post as-is."));
  if (kind === "li") {                                                             // v36.5 — one-tap publish (LinkedIn is pure text; Instagram needs her recorded video first)
    await env.MEETINGS.put("mkt_lastdraft_li", out, { expirationTtl: 2 * 86400 });
    await waSendButtons(env, to, "Post it as-is, or tell me what to change and I'll redraft.", [
      { id: "mkt:post:li", title: "🚀 Post to LinkedIn" },
      { id: "mkt:discard", title: "✖️ Not this one" }]);
  }
  if (kind === "ig") {
    await waSend(env, to, "🎬 Record the script (30-45s, phone vertical) — the caption above is ready to paste. One-tap reel posting switches on once video upload is connected.");
  }
}

// v36.5 — publish the stored LinkedIn draft via Ayrshare. Fires ONLY from Naj's explicit
// button tap; without AYRSHARE_KEY it explains what's missing instead of failing.
async function publishDraft(env, to) {
  const draft = await env.MEETINGS.get("mkt_lastdraft_li");
  if (!draft) { await waSend(env, to, "That draft expired — ask for a fresh one (“draft linkedin 1”)."); return; }
  if (!env.AYRSHARE_KEY) {
    await waSend(env, to, "🔌 Direct posting isn't connected yet — it needs the Ayrshare link-up (a one-time setup on DigitAlchemy's side, then your LinkedIn connected once). Until then: copy the draft above and paste it into LinkedIn — 20 seconds. I'll tell you the moment one-tap posting is live.");
    return;
  }
  try {
    const r = await fetch("https://api.ayrshare.com/api/post", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + env.AYRSHARE_KEY },
      body: JSON.stringify({ post: draft, platforms: ["linkedin"] }),
    });
    const j = await r.json();
    if (r.ok && j && (j.status === "success" || (j.postIds && j.postIds.length))) {
      await env.MEETINGS.delete("mkt_lastdraft_li");
      const link = (j.postIds && j.postIds[0] && (j.postIds[0].postUrl || j.postIds[0].id)) || "";
      await waSend(env, to, "🚀 Posted to LinkedIn." + (link ? "\n" + link : ""));
    } else {
      await waSend(env, to, "⚠ LinkedIn didn't accept the post — " + ((j && (j.message || (j.errors && JSON.stringify(j.errors).slice(0, 140)))) || ("status " + r.status)) + ". The draft is still saved; try again in a minute.");
    }
  } catch (e) {
    await waSend(env, to, "⚠ Couldn't reach the posting service — the draft is still saved; try again in a minute.");
  }
}

