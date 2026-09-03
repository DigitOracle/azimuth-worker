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
// Anthropic intermittently 403s ("Request not allowed") / 429s / 5xx on some Cloudflare egress
// IPs; a retry from a fresh attempt usually clears it. Retry transient statuses a few times.
// v72.1 — Anthropic 403 "Request not allowed" is intermittent on some Cloudflare egress IPs.
// claudeFetch already retries; these helpers only COUNT what happened so /health can show it.
async function bumpClaude403(env, model, attempt) {
  try {
    if (!env || !env.MEETINGS) return;
    const k = "diag_claude403_" + new Date().toISOString().slice(0, 10);
    const n = parseInt((await env.MEETINGS.get(k)) || "0", 10) + 1;
    await env.MEETINGS.put(k, String(n), { expirationTtl: 3 * 86400 });
    await env.MEETINGS.put("diag_claude403_last", JSON.stringify({ at: new Date().toISOString(), model, attempt, count_today: n }), { expirationTtl: 30 * 86400 });
  } catch (e) {}
}
async function noteClaudeFail(env, model, lastStatus) {
  try { if (env && env.MEETINGS) await env.MEETINGS.put("diag_claude_fail_last", JSON.stringify({ at: new Date().toISOString(), model, last_status: lastStatus }), { expirationTtl: 30 * 86400 }); } catch (e) {}
}
async function claudeFetch(env, model, maxTok, sys, user, schema) {
  let lastStatus = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    let r;
    try {
      r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: claudeBody(model, maxTok, sys, user, schema),
      });
    } catch (e) { lastStatus = "threw"; await new Promise(s => setTimeout(s, 400 * (attempt + 1))); continue; }
    lastStatus = r.status;
    if (r.ok) return r;
    if (r.status === 403) await bumpClaude403(env, model, attempt);
    if (r.status === 403 || r.status === 429 || r.status >= 500) { await new Promise(s => setTimeout(s, 500 * (attempt + 1))); continue; }
    return r;   // 4xx that won't fix on retry (400/401) — give up
  }
  await noteClaudeFail(env, model, lastStatus);
  return null;
}

async function claudeJSON(env, sys, user, schema, model, maxTok) {
  if (!env.ANTHROPIC_API_KEY) return null;
  try {
    const r = await claudeFetch(env, model || CLAUDE_FAST, maxTok || 300, sys, user, schema);
    if (!r || !r.ok) return null;
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
  if (env.ANTHROPIC_API_KEY) { try { const r = await claudeFetch(env, model || CLAUDE_SMART, maxTok || 600, sys, user, null); if (r && r.ok) { const j = await r.json(); const txt = (j.content || []).filter(b => b && b.type === "text").map(b => b.text).join("").trim(); if (txt) return txt; } } catch (e) {} }
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
function renderBoard(meetings, actions, key, env, mkt, avail) {
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
${NAJ_FONTS}
<style>
:root{--paper:#FAF8F3;--ink:#16211F;--muted:#5F6B66;--teal:#0A4F4A;--gold:#B98B3E;--line:#E9E4D7;--card:#FFF;--online:#3E7C8C;--radius:16px}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;-webkit-font-smoothing:antialiased;position:relative;min-height:100vh}body::before{content:"";position:fixed;inset:0;z-index:-2;background:url(/bg.jpg) center 14%/cover no-repeat}body::after{content:"";position:fixed;inset:0;z-index:-1;background:linear-gradient(180deg,rgba(12,20,19,.44) 0%,rgba(12,20,19,.26) 96px,rgba(250,248,243,.60) 230px,rgba(250,248,243,.86) 430px,rgba(250,248,243,.93) 100%)}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.wrap{max-width:460px;margin:0 auto;padding:22px 18px 40px;position:relative}.num{font-variant-numeric:tabular-nums}
.brand{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;color:#F6F3EA;text-shadow:0 1px 10px rgba(12,20,19,.55)}
.mark{display:flex;align-items:center;gap:9px;font-weight:700;font-size:16px;letter-spacing:.03em}
.mark .glyph{width:20px;height:20px;position:relative}.mark .glyph span{position:absolute;inset:0;border:1.5px solid #F6F3EA;border-radius:50%;opacity:.9}
.mark .glyph span:nth-child(2){inset:5px;opacity:.55}.mark .glyph::after{content:"";position:absolute;left:50%;top:50%;width:5px;height:5px;margin:-2.5px;border-radius:50%;background:var(--gold)}
.today{font-size:12.5px;color:rgba(246,243,234,.82)}
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
    return '<section><a href="/market?key=' + encodeURIComponent(key) + '" style="display:block;text-decoration:none;color:#E8E4D8;background:#0C1413;border:1px solid #24352F;border-left:3px solid #C5A56A;border-radius:var(--radius);padding:.9rem 1rem;box-shadow:0 8px 22px rgba(12,20,19,.28)">' +
      '<div style="display:flex;justify-content:space-between;align-items:center"><span style="display:inline-flex;align-items:center;gap:8px;font-family:Fraunces,Georgia,serif;font-weight:600;font-size:1.06rem;letter-spacing:.01em"><svg viewBox="0 0 256 256" width="15" height="15" fill="#C5A56A" aria-hidden="true"><path d="' + NAJ_ICONS.star + '"/></svg>Najma <span style="color:#C5A56A">نجمة</span></span><span style="color:#C5A56A;font-weight:600;font-size:.8rem">open →</span></div>' +
      '<div style="color:#B8C4BD;font-size:.8rem;margin-top:.35rem">AED ' + t2.salesValueAedBn + 'bn registered · ' + (off2 == null ? "" : off2 + "% off-plan") + (y2 ? " · top yield " + y2.area + " " + y2.yieldPct + "%" : "") + '</div>' +
      '<div style="color:#8FA39B;font-size:.68rem;margin-top:.15rem;font-family:\'IBM Plex Mono\',monospace">DLD Open Data · ' + String(t2.periodFrom || "") + " → " + String(t2.periodTo || "") + '</div></a></section>';
  })()}
${(() => {                                                      // v68 — developer availability strip (sheets from her group)
    const sheets = (avail && avail.sheets) || [];
    if (!sheets.length) return "";
    const rows = sheets.slice(0, 6).map(x => {
      const inner = '<span style="color:#E8E4D8">📄 ' + String(x.sheet || "").slice(0, 34) + '</span>' +
        '<span style="color:' + (x.mapped ? "#8FC7B9" : "#C5A56A") + ';text-align:right">' + String(x.note || "").slice(0, 46) + (x.d ? ' ›' : '') + '</span>';
      const st = 'display:flex;justify-content:space-between;gap:10px;padding:.32rem 0;border-top:1px solid #24352F;font-size:.76rem';
      return x.d ? '<a href="/avail?d=' + encodeURIComponent(x.d) + '&key=' + encodeURIComponent(key) + '" style="' + st + ';text-decoration:none">' + inner + '</a>'
                 : '<div style="' + st + '">' + inner + '</div>';
    }).join("");
    return '<section><div style="color:#E8E4D8;background:#0C1413;border:1px solid #24352F;border-left:3px solid #3E8A7E;border-radius:var(--radius);padding:.9rem 1rem;box-shadow:0 8px 22px rgba(12,20,19,.28)">' +
      '<div style="display:flex;justify-content:space-between;align-items:center"><span style="font-family:Fraunces,Georgia,serif;font-weight:600;font-size:1rem">Developer availability</span>' +
      '<span style="color:#8FA39B;font-size:.68rem;font-family:\'IBM Plex Mono\',monospace">' + sheets.length + ' sheet' + (sheets.length === 1 ? "" : "s") + ' · via your group</span></div>' +
      '<div style="margin-top:.4rem">' + rows + '</div>' +
      '<div style="color:#8FA39B;font-size:.64rem;margin-top:.45rem;font-family:\'IBM Plex Mono\',monospace">developer-stated · dated per sheet · shown beside register figures, never mixed</div></div></section>';
  })()}
<section><div class="plate-h"><div class="l"><span class="n num">${acts.length}</span><span class="cap">on your plate</span></div><div class="hint">${(env && env.TELEGRAM_TOKEN) ? "clear in Telegram ✓" : "tap a circle to clear ✓"}</div></div>${tasksHtml}
<div class="legend"><span><i style="background:#0A4F4A"></i>Abu Dhabi</span><span><i style="background:#B98B3E"></i>Dubai</span><span><i style="background:#7A4A93"></i>Sharjah</span><span><i style="background:#3E7C8C"></i>Online</span></div>
<div class="foot">Live · ${(env && MB(env).length) ? "meetings from Outlook · actions from your inbox" : "captured from WhatsApp"} · ${upd} GST</div>
</section></div><script>window.__l=Date.now();document.addEventListener("visibilitychange",function(){if(!document.hidden&&Date.now()-window.__l>15000){location.reload()}});window.addEventListener("pageshow",function(e){if(e.persisted){location.reload()}});document.addEventListener("click",function(e){var r=e.target.closest?e.target.closest(".task .ring"):null;if(!r)return;var c=r.closest(".task");var id=c&&c.getAttribute("data-id");if(!id)return;var k=new URLSearchParams(location.search).get("key");if(r.classList.contains("done"))return;r.classList.add("done");fetch("/done?key="+encodeURIComponent(k)+"&id="+encodeURIComponent(id)).then(function(x){if(x.ok){c.style.transition="opacity .3s";c.style.opacity="0.25";setTimeout(function(){c.remove();var n=document.querySelector(".plate-h .n");if(n){n.textContent=Math.max(0,(parseInt(n.textContent,10)||1)-1)}},300)}else{r.classList.remove("done")}}).catch(function(){r.classList.remove("done")})});document.addEventListener("click",function(e){var a=e.target.closest?e.target.closest("a.card"):null;if(a){var h=a.getAttribute("href");if(h){e.preventDefault();try{window.open(h,"_blank")||(location.href=h)}catch(x){location.href=h}}}},true);</script>
<div id="spl" style="position:fixed;inset:0;z-index:60;background:#0C1413;display:none;align-items:center;justify-content:center"><video id="splv" playsinline muted preload="auto" style="width:100%;height:100%;object-fit:cover"></video><div id="splm" style="position:absolute;top:calc(14px + env(safe-area-inset-top));right:14px;font-family:'IBM Plex Sans',system-ui,sans-serif;font-size:13px;font-weight:600;color:#0C1413;background:#C5A56A;border-radius:99px;padding:8px 14px;cursor:pointer">🔇 tap for sound</div><div id="splw" style="position:absolute;bottom:40px;left:0;right:0;text-align:center;font-family:Fraunces,Georgia,serif;font-size:32px;color:#E8E4D8;opacity:0;transition:opacity .9s">Najma <span style="color:#C5A56A">نجمة</span></div></div>
<script>(function(){try{fetch("/img/splash",{method:"HEAD"}).then(function(r){if(!r.ok)return;var s=document.getElementById("spl"),v=document.getElementById("splv"),w=document.getElementById("splw"),m=document.getElementById("splm");v.src="/img/splash";s.style.display="flex";var done=function(){if(!s.parentNode)return;s.style.transition="opacity .6s";s.style.opacity="0";setTimeout(function(){s.remove()},650)};v.onended=done;s.onclick=done;v.onerror=done;m.onclick=function(e){e.stopPropagation();v.muted=!v.muted;m.textContent=v.muted?"🔇 tap for sound":"🔊 sound on"};setTimeout(function(){w.style.opacity="1"},9000);setTimeout(done,20000);var p=v.play();if(p&&p.catch)p.catch(done)})}catch(e){}})();</script></body></html>`;
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
// v45 — send an image by public link (the heat map etc.); caption optional
async function waSendImage(env, to, link, caption) {
  return waPost(env, { messaging_product: "whatsapp", to, type: "image", image: { link, caption: caption || undefined } }, "image");
}
// v37.2 — interactive LIST (up to 10 rows; row title <=24 chars, description <=72)
async function waSendList(env, to, body, buttonLabel, rows) {
  return waPost(env, { messaging_product: "whatsapp", to, type: "interactive", interactive: { type: "list", body: { text: body }, action: { button: buttonLabel, sections: [{ rows: rows.map(r => ({ id: r.id, title: String(r.title).slice(0, 24), description: String(r.description || "").slice(0, 72) })) }] } } }, "list");
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
    if (request.method === "HEAD" && url.pathname.indexOf("/img/") === 0) {  // v49 — board splash probes /img/splash without downloading it
      const _hn = url.pathname.slice(5).replace(/[^a-z0-9_]/gi, "");
      const _hv = await env.MEETINGS.get("img_" + _hn, "arrayBuffer");
      return new Response(null, { status: _hv ? 200 : 404 });
    }
    if (request.method === "GET") {
      if (url.pathname === "/bg.jpg") {
        { const _u = await env.MEETINGS.get("cfg_bg", { type: "arrayBuffer" }); if (_u && _u.byteLength > 0) { const _ct = (await env.MEETINGS.get("cfg_bg_ct")) || "image/jpeg"; return new Response(_u, { headers: { "Content-Type": _ct, "Cache-Control": "public, max-age=300" } }); } }
        { const _nb = await env.MEETINGS.get("img_bg_board", { type: "arrayBuffer" }); if (_nb && _nb.byteLength > 0) { const _nct = (await env.MEETINGS.get("img_ct_bg_board")) || "image/jpeg"; return new Response(_nb, { headers: { "Content-Type": _nct, "Cache-Control": "public, max-age=3600" } }); } } // v49 — Najma default backdrop (personal cfg_bg above still wins)
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
        dep.claude = env.ANTHROPIC_API_KEY ? await (async () => { try { const r = await claudeFetch(env, CLAUDE_FAST, 4, "Reply with the single character: 1", "1", null); return r ? (r.ok ? "ok" : ("HTTP " + r.status)) : "FAILED after 4 attempts (403/429/5xx) — see claude_403"; } catch (e) { return "unreachable"; } })() : "no key";
        const c403 = await (async () => { try { const today = new Date().toISOString().slice(0, 10); const n = parseInt((await env.MEETINGS.get("diag_claude403_" + today)) || "0", 10); const last = JSON.parse((await env.MEETINGS.get("diag_claude403_last")) || "null"); const fail = JSON.parse((await env.MEETINGS.get("diag_claude_fail_last")) || "null"); return { retried_403s_today: n, last_403: last, last_total_failure: fail, note: "403s are retried up to 4x; only last_total_failure means a user-facing miss" }; } catch (e) { return null; } })();
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
          claude_403: c403,
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
            const _r = await claudeFetch(env, _t[1], 32, "Answer in one word.", "ping", null);
            if (!_r) { _o[_t[0]] = "FAILED after 4 attempts (403/429/5xx)"; continue; }
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
        let _avail = null; try { _avail = JSON.parse((await env.MEETINGS.get("img_avail_index")) || "null"); } catch (e) {}
        return new Response(renderBoard(meetings, actions, url.searchParams.get("key"), env, mkt, _avail), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
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
      if (url.pathname === "/ig_connect") {                    // v38 — start Instagram OAuth (official Instagram API with Instagram Login; free, tester role, no review)
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        if (!env.IG_APP_ID) return new Response("Instagram app not configured yet", { status: 503 });
        const st = rid();
        await env.MEETINGS.put("ig_state_" + st, "1", { expirationTtl: 600 });
        const auth = "https://www.instagram.com/oauth/authorize?response_type=code" +
          "&client_id=" + encodeURIComponent(env.IG_APP_ID) +
          "&redirect_uri=" + encodeURIComponent(url.origin + "/ig_callback") +
          "&state=" + st + "&scope=" + encodeURIComponent("instagram_business_basic,instagram_business_content_publish");
        return Response.redirect(auth, 302);
      }
      if (url.pathname === "/ig_callback") {                   // v38 — Instagram OAuth return: code -> short token -> 60-day token
        const st = url.searchParams.get("state") || "";
        if (!(await env.MEETINGS.get("ig_state_" + st))) return new Response("state mismatch — start again from the connect link", { status: 400 });
        await env.MEETINGS.delete("ig_state_" + st);
        const code = url.searchParams.get("code");
        if (!code) return new Response("Instagram declined: " + (url.searchParams.get("error_description") || url.searchParams.get("error") || "no code"), { status: 400 });
        const tr = await fetch("https://api.instagram.com/oauth/access_token", {
          method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ client_id: env.IG_APP_ID, client_secret: env.IG_APP_SECRET, grant_type: "authorization_code", redirect_uri: url.origin + "/ig_callback", code }),
        });
        const tj = await tr.json();
        const shortTok = tj.access_token, igUser = tj.user_id;
        if (!shortTok) return new Response("token exchange failed: " + JSON.stringify(tj).slice(0, 200), { status: 502 });
        const lr = await fetch("https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=" + encodeURIComponent(env.IG_APP_SECRET) + "&access_token=" + encodeURIComponent(shortTok));
        const lj = await lr.json();
        const tok = lj.access_token || shortTok;
        await env.MEETINGS.put("ig_auth", JSON.stringify({ token: tok, userId: String(igUser), expiresAt: Date.now() + (lj.expires_in ? (lj.expires_in - 86400) * 1000 : 59 * 86400000) }));
        try { await waSend(env, env.WA_ALLOWED, "📸 Instagram connected — send me any finished image with the caption “post to instagram” and I'll publish it with your latest caption draft."); } catch (e) {}
        return new Response('<!doctype html><meta charset=utf-8><body style="font-family:system-ui;background:#0C1413;color:#E8E4D8;padding:2rem;text-align:center"><h2 style="color:#C5A56A">Connected ✓</h2><p>Instagram publishing is live. You can close this and go back to WhatsApp.</p>', { headers: { "Content-Type": "text/html; charset=utf-8" } });
      }
      if (url.pathname.indexOf("/ig_media/") === 0) {          // v38 — serve a stored image publicly (unguessable id; Instagram fetches from here)
        const mid = url.pathname.slice(10).replace(/[^a-z0-9]/gi, "");
        const bytes = await env.MEETINGS.get("igm_" + mid, "arrayBuffer");
        if (!bytes) return new Response("gone", { status: 404 });
        const ct = (await env.MEETINGS.get("igm_ct_" + mid)) || "image/jpeg";
        return new Response(bytes, { headers: { "Content-Type": ct, "Cache-Control": "public, max-age=3600" } });
      }
      if (url.pathname === "/li_connect") {                    // v36.6 — start LinkedIn OAuth (free native posting; token ~60 days)
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        if (!env.LI_CLIENT_ID) return new Response("LinkedIn app not configured yet", { status: 503 });
        const st = rid();
        await env.MEETINGS.put("li_state_" + st, "1", { expirationTtl: 600 });
        const auth = "https://www.linkedin.com/oauth/v2/authorization?response_type=code" +
          "&client_id=" + encodeURIComponent(env.LI_CLIENT_ID) +
          "&redirect_uri=" + encodeURIComponent(url.origin + "/li_callback") +
          "&state=" + st + "&scope=" + encodeURIComponent("openid profile w_member_social");
        return Response.redirect(auth, 302);
      }
      if (url.pathname === "/li_callback") {                   // v36.6 — LinkedIn OAuth return: exchange code, store member token
        const st = url.searchParams.get("state") || "";
        if (!(await env.MEETINGS.get("li_state_" + st))) return new Response("state mismatch — start again from the connect link", { status: 400 });
        await env.MEETINGS.delete("li_state_" + st);
        const code = url.searchParams.get("code");
        if (!code) return new Response("LinkedIn declined: " + (url.searchParams.get("error_description") || url.searchParams.get("error") || "no code"), { status: 400 });
        const tr = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
          method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: url.origin + "/li_callback", client_id: env.LI_CLIENT_ID, client_secret: env.LI_CLIENT_SECRET }),
        });
        const tj = await tr.json();
        if (!tj.access_token) return new Response("token exchange failed: " + JSON.stringify(tj).slice(0, 200), { status: 502 });
        const ui = await (await fetch("https://api.linkedin.com/v2/userinfo", { headers: { Authorization: "Bearer " + tj.access_token } })).json();
        if (!ui.sub) return new Response("could not read the LinkedIn profile id", { status: 502 });
        await env.MEETINGS.put("li_auth", JSON.stringify({ token: tj.access_token, sub: ui.sub, name: ui.name || "", expiresAt: Date.now() + (tj.expires_in ? (tj.expires_in - 86400) * 1000 : 59 * 86400000) }));
        try { await waSend(env, env.WA_ALLOWED, "🔗 LinkedIn connected" + (ui.name ? " as " + ui.name : "") + " — one-tap posting is live for ~2 months."); } catch (e) {}
        return new Response('<!doctype html><meta charset=utf-8><body style="font-family:system-ui;background:#0C1413;color:#E8E4D8;padding:2rem;text-align:center"><h2 style="color:#C5A56A">Connected ✓</h2><p>LinkedIn posting is live. You can close this and go back to WhatsApp.</p>', { headers: { "Content-Type": "text/html; charset=utf-8" } });
      }
      if (url.pathname === "/brief_test") {                    // v36.3 — force the Sunday brief + content buttons now (live demo / recovery)
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        try { await marketBriefTick(env, true); } catch (e) { return new Response("brief error: " + (e && e.message ? e.message : String(e)), { status: 500 }); }
        return new Response("brief fired — check WhatsApp");
      }
      if (url.pathname === "/news_test") {                     // v37.1 — force a news sweep and return the matched stories + feed diagnostics
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        try { await newsTick(env, true); } catch (e) { return new Response("news error: " + (e && e.message ? e.message : String(e)), { status: 500 }); }
        const nn = (await env.MEETINGS.get("mkt_news")) || "[]";
        const st = (await env.MEETINGS.get("mkt_news_stats")) || "{}";
        return new Response('{"stats":' + st + ',"stories":' + nn + "}", { headers: { "Content-Type": "application/json" } });
      }
      if (url.pathname === "/sendimg") {                       // v45 — send a stored image to the user (admin-keyed, Kendall-approved sends)
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        const nm = (url.searchParams.get("name") || "").replace(/[^a-z0-9_]/gi, "");
        if (!(await env.MEETINGS.get("img_" + nm))) return new Response("no such image: " + nm, { status: 404 });
        try { await waSendImage(env, env.WA_ALLOWED, url.origin + "/img/" + nm, url.searchParams.get("caption") || undefined); }
        catch (e) { return new Response("send failed", { status: 502 }); }
        return new Response("sent " + nm);
      }
      if (url.pathname === "/announce") {                      // v37.2 — send the user a one-off service message (admin-keyed; used for feature updates)
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        const tx = url.searchParams.get("text") || "";
        if (!tx || tx.length > 3500) return new Response("text required (<=3500 chars)", { status: 400 });
        try { await waSend(env, env.WA_ALLOWED, tx); } catch (e) { return new Response("send failed", { status: 502 }); }
        return new Response("announced");
      }
      if (url.pathname === "/trust_test") {                    // v72.2 — developer trust check, RETURN it (does not message the user)
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        const q = url.searchParams.get("q") || "";
        if (!q) return new Response("pass ?q=<developer name>", { status: 400 });
        return new Response(devTrustText(await devTrust(env, q)), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
      }
      if (url.pathname === "/launch_test") {                   // v43 — run a launch check, RETURN the briefing (does not message the user)
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        const q = url.searchParams.get("q") || "";
        if (!q) return new Response("pass ?q=<launch brief>", { status: 400 });
        let out = "";
        try { out = await launchMode(env, null, q, true); } catch (e) { return new Response("launch error: " + (e && e.message ? e.message : String(e)), { status: 500 }); }
        return new Response(out || "(no output)", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
      }
      if (url.pathname === "/feed_test") {                     // v37 — force the daily feed now; v56 — ?dry=1 generates WITHOUT sending (safe diagnostic)
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        if (url.searchParams.get("dry")) {
          let out = null;
          try { out = await dailyFeedTick(env, true, true); } catch (e) { return new Response("feed error: " + (e && e.message ? e.message : String(e)), { status: 500 }); }
          return new Response(out || "(no output — check MARKET_BRIEF/mkt_latest)", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
        }
        try { await dailyFeedTick(env, true); } catch (e) { return new Response("feed error: " + (e && e.message ? e.message : String(e)), { status: 500 }); }
        return new Response("feed fired — check WhatsApp");
      }
      if (url.pathname.indexOf("/r/") === 0) {                 // v58 — client briefing (PUBLIC by unguessable id; no keys on the page)
        const rid = url.pathname.slice(3).replace(/[^a-f0-9]/g, "").slice(0, 24);
        const snapRaw = rid ? await env.MEETINGS.get("rpt_" + rid) : null;
        if (!snapRaw) return new Response("This briefing link has expired. Ask your agent for a fresh one.", { status: 404 });
        let sn; try { sn = JSON.parse(snapRaw); } catch (e) { return new Response("snapshot error", { status: 500 }); }
        let _tok = null, _poly = null;
        try { const _t2 = await esriToken(env); _tok = _t2 && _t2.token; } catch (e) {}
        try { const _ar2 = JSON.parse((await env.MEETINGS.get("mp_areas_json")) || (new TextDecoder().decode(await env.MEETINGS.get("img_mp_areas", "arrayBuffer")) || "null"));
              if (_ar2 && _ar2.features) { const _f = _ar2.features.find(f => f.properties && f.properties.n === (sn.area && sn.area.area)); if (_f) _poly = _f.geometry; } } catch (e) {}
        return new Response(renderReport(sn, _tok, _poly), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
      }
      if (url.pathname.indexOf("/img/") === 0) {               // v45 — serve a stored rendered image (public; WhatsApp fetches by link)
        const nm = url.pathname.slice(5).replace(/[^a-z0-9_]/gi, "");
        const buf = await env.MEETINGS.get("img_" + nm, "arrayBuffer");
        if (!buf) return new Response("not found", { status: 404 });
        const ct = (await env.MEETINGS.get("img_ct_" + nm)) || "image/png";
        return new Response(buf, { headers: { "Content-Type": ct, "Cache-Control": "public, max-age=3600" } });
      }
      if (url.pathname === "/charts") {                        // v41 — post-ready SVG charts from the register
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        const _cRaw = await env.MEETINGS.get("mkt_latest");
        let _amenRaw = null;
        try { const _cd = JSON.parse(_cRaw || "null"); const _t0 = _cd && _cd.areaIntel && _cd.areaIntel.areas && _cd.areaIntel.areas[0]; if (_t0) _amenRaw = await env.MEETINGS.get("amen_" + _t0.area.toLowerCase().replace(/[^a-z0-9]/g, "")); } catch (e) {}
        return new Response(renderCharts(_cRaw, url.searchParams.get("key") || "", _amenRaw), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
      }
      if (url.pathname === "/market") {                        // v36 — Market Pulse dashboard (GET — MUST sit above the keyed catch-all dump below)
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        const _ml = await env.MEETINGS.get("mkt_latest");
        const _mp = await env.MEETINGS.get("mkt_prev");
        return new Response(renderMarket(_ml, _mp, url.searchParams.get("key") || "", url.origin, await env.MEETINGS.get("mkt_watch")), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
      }
      if (url.pathname === "/manifest.webmanifest") {          // v49 — PWA: "Najma" installs from /market (key rides in start_url)
        const _mk = url.searchParams.get("key") || "";
        return new Response(JSON.stringify({ name: "Najma", short_name: "Najma", start_url: "/market?key=" + _mk, display: "standalone", background_color: "#0C1413", theme_color: "#0C1413", icons: [{ src: "/naj_icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }] }), { headers: { "Content-Type": "application/manifest+json" } });
      }
      if (url.pathname === "/home") {                         // v73 - developer grid (2 x 5): the new top of the board (board_devs pushed by build_board.py)
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        let _bd = null; try { _bd = JSON.parse((await env.MEETINGS.get("img_board_devs")) || "null"); } catch (e) {}
        if (!_bd) return new Response("no board data yet - run build_board.py", { status: 404 });
        const _p = (n) => String(url.searchParams.get(n) || "").replace(/[^a-z0-9_]/g, "");
        let _cmp = null; if (_p("mode") === "compare") { try { _cmp = JSON.parse((await env.MEETINGS.get("img_dev_compare")) || "null"); } catch (e) {} }   // v73.4 compare mode
        return new Response(renderHome(_bd, url.searchParams.get("key") || "", _cmp, { mode: _p("mode"), bed: _p("bed"), band: _p("band"), metric: _p("metric"), sort: _p("sort"), tier: _p("tier"), life: _p("life") }), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
      }
      if (url.pathname === "/dev") {                          // v73 - one developer: its property cards (ours -> registered -> trading), then down to unit cards
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        let _bd = null; try { _bd = JSON.parse((await env.MEETINGS.get("img_board_devs")) || "null"); } catch (e) {}
        const _dv = _bd && (_bd.developers || []).find(x => x.key === String(url.searchParams.get("d") || "").replace(/[^a-z0-9_]/g, ""));
        if (!_dv) return new Response("no such developer on the board", { status: 404 });
        let _galleries = {};
        for (const _b of (_dv.ours || [])) { try { const _j = JSON.parse((await env.MEETINGS.get("img_cards_" + _b + "_index")) || "null"); if (_j) _galleries[_b] = _j; } catch (e) {} }
        return new Response(renderDev(_dv, _bd, _galleries, url.searchParams.get("key") || ""), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
      }
      if (url.pathname === "/compare") {                      // v73.3 - two developers side by side, click-only (dev_compare pushed by build_compare.py)
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        let _bd = null, _cmp = null;
        try { _bd = JSON.parse((await env.MEETINGS.get("img_board_devs")) || "null"); } catch (e) {}
        try { _cmp = JSON.parse((await env.MEETINGS.get("img_dev_compare")) || "null"); } catch (e) {}
        if (!_bd || !_cmp) return new Response("no comparison data yet - run build_compare.py", { status: 404 });
        const _p = (n) => String(url.searchParams.get(n) || "").replace(/[^a-z0-9_]/g, "");
        return new Response(renderCompare(_cmp, _bd, { a: _p("a"), b: _p("b"), bed: _p("bed") || "all", band: _p("band") || "all", diff: _p("diff") === "1" }, url.searchParams.get("key") || ""), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
      }
      if (url.pathname === "/view") {                         // v78 - THE REAL VIEW: photorealistic tiles rendered live from one facade
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        const _num = (n, d) => { const v = parseFloat(url.searchParams.get(n)); return isFinite(v) ? v : d; };
        const _s = (n) => String(url.searchParams.get(n) || "").replace(/[^\w .,'&()-]/g, "").slice(0, 80);
        const gk = url.searchParams.get("gkey") || env.GOOGLE_MAPS_KEY || "";
        return new Response(renderRealView({ lon: _num("lon", 55.2744), lat: _num("lat", 25.1972), h: _num("h", 120), head: _num("head", 0),
          name: _s("name"), side: _s("side"), sees: _s("sees"), gkey: gk }, url.searchParams.get("key") || ""),
          { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
      }
      if (url.pathname === "/cards") {                        // v72 - unit-type card gallery for a building (cards_<b>_index pushed by push_cards.py)
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        const _cb = String(url.searchParams.get("b") || "symphony").replace(/[^a-z0-9]/g, "");
        let _ci = null; try { _ci = JSON.parse((await env.MEETINGS.get("img_cards_" + _cb + "_index")) || "null"); } catch (e) {}
        if (!_ci) return new Response("no cards for " + _cb, { status: 404 });
        return new Response(renderCards(_ci, _cb, url.searchParams.get("key") || "", url.searchParams.get("t") || ""), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
      }
      if (url.pathname === "/avail") {                        // v69 - availability drill (donut of registered mix; claimed units join after extraction)
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        const _dk = String(url.searchParams.get("d") || "").replace(/[^a-z0-9]/g, "");
        let _dd3 = null; try { _dd3 = JSON.parse((await env.MEETINGS.get("img_drill_" + _dk)) || "null"); } catch (e) {}
        if (!_dd3) return new Response("no drill data", { status: 404 });
        let _cards = [];                                          // v72 - card galleries that belong to this developer's drill
        for (const _b of (CARD_BUILDINGS[_dk] || [])) { try { const _j = JSON.parse((await env.MEETINGS.get("img_cards_" + _b + "_index")) || "null"); if (_j) _cards.push(_j); } catch (e) {} }
        const _full = url.searchParams.get("full") === "1" && _dd3.claimed && _dd3.claimed.detail;
        let _dt = null; try { _dt = await devTrust(env, String(_dd3.title || _dk).replace(/\s*\(.*?\)\s*$/, "")); } catch (e) {}   // v72.2
        return new Response(_full ? renderAvailUnits(_dd3, _dk, url.searchParams.get("key") || "") : renderAvailDrill(_dd3, _dk, url.searchParams.get("key") || "", _cards, _dt), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
      }
      if (url.pathname.indexOf("/report/") === 0) {           // v81 - district stock report, read straight off the model's own measurements
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        const _rs = url.pathname.slice(8).replace(/[^a-z0-9]/gi, "").toLowerCase();
        let _rn = {}; try { const _rd = JSON.parse((await env.MEETINGS.get("mkt_latest")) || "null"); for (const x of ((_rd && _rd.areaIntel && _rd.areaIntel.areas) || [])) _rn[x.area.toLowerCase().replace(/[^a-z0-9]/g, "")] = x.area; } catch (e) {}
        return new Response(renderStock(_rs, _rn[_rs] || _rs, url.searchParams.get("key") || "",
          await env.MEETINGS.get("img_bldgfacts_" + _rs), await env.MEETINGS.get("img_anchors_" + _rs),
          await env.MEETINGS.get("img_projfacts"), await env.MEETINGS.get("mkt_latest")),
          { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
      }
      if (url.pathname === "/skyline" || url.pathname.indexOf("/skyline/") === 0) { // v64 — 3D viewer + district rail (MUST sit above the keyed catch-all dump below)
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        // rail: every sky_<slug> GLB in KV, named from the register where it can be
        let _rail = [];
        let _names = {};
        try { const _dd = JSON.parse((await env.MEETINGS.get("mkt_latest")) || "null"); for (const x of ((_dd && _dd.areaIntel && _dd.areaIntel.areas) || [])) _names[x.area.toLowerCase().replace(/[^a-z0-9]/g, "")] = x.area; } catch (e) {}
        try { const _kl = await env.MEETINGS.list({ prefix: "img_sky_" }); _rail = _kl.keys.map(k => k.name.slice(8)).sort().map(sl => ({ s: sl, n: _names[sl] || sl })); } catch (e) {}
        let _sk = url.pathname === "/skyline" ? (url.searchParams.get("d") || (_rail[0] && _rail[0].s) || "") : url.pathname.slice(9);
        _sk = _sk.replace(/[^a-z0-9]/gi, "").toLowerCase();
        const _an2 = _names[_sk] || _sk;
        return new Response(renderSkyline(_sk, _an2, url.searchParams.get("key") || "", _rail), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
      }
      if (url.pathname === "/studio") {                        // v61 — editorial card studio (MUST sit above the keyed catch-all dump below)
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        return new Response(renderStudio(await env.MEETINGS.get("mkt_latest"), url.searchParams.get("key") || "", !!(env.ESRI_CLIENT_ID && env.ESRI_CLIENT_SECRET)), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
      }
      if (url.pathname === "/map") {                           // v50 — interactive community map (MUST sit above the keyed catch-all dump below)
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        let _sky64 = [];
        try { const _kl2 = await env.MEETINGS.list({ prefix: "img_sky_" }); _sky64 = _kl2.keys.map(k => k.name.slice(8)); } catch (e) {}
        return new Response(renderMap(await env.MEETINGS.get("mkt_latest"), url.searchParams.get("key") || "", env.WA_BOT_NUMBER || "", !!(env.ESRI_CLIENT_ID && env.ESRI_CLIENT_SECRET), await env.MEETINGS.get("mkt_prev"), _sky64), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
      }
      if (url.pathname.indexOf("/area/") === 0) {              // v50 — per-community deep dive (MUST sit above the keyed catch-all dump below)
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        let _an = ""; try { _an = decodeURIComponent(url.pathname.slice(6)); } catch (e) { _an = url.pathname.slice(6); }
        return new Response(renderArea(await env.MEETINGS.get("mkt_latest"), _an, url.searchParams.get("key") || ""), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
      }
      if (url.pathname === "/amenities") {                     // v58 — nearest POIs per community via geocoder category search; ONE paid call set per area, cached forever
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        const nmq = (url.searchParams.get("area") || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const coord = Object.entries(DXB_COORDS).find(([k]) => k.replace(/[^a-z0-9]/g, "") === nmq);
        if (!coord) return new Response(JSON.stringify({ ok: false, note: "no coordinates for that community" }), { status: 400, headers: { "Content-Type": "application/json" } });
        const ak = "amen_" + nmq;
        const hit = await env.MEETINGS.get(ak);
        if (hit) return new Response(hit, { headers: { "Content-Type": "application/json" } });
        const t = await esriToken(env);
        if (!t) return new Response(JSON.stringify({ ok: false, note: "Esri token unavailable" }), { status: 503, headers: { "Content-Type": "application/json" } });
        const [lon, lat] = coord[1];
        const CATS = [["Metro Station", "Nearest metro"], ["School", "Nearest school"], ["Shopping Center", "Nearest mall"], ["Hospital", "Nearest hospital"]];
        const out = [];
        let privErr = null;
        for (const [cat, label] of CATS) {
          try {
            const q = new URLSearchParams({ f: "json", token: t.token, langCode: "en", category: cat, location: lon + "," + lat, maxLocations: "1", outFields: "PlaceName,Distance", searchExtent: (lon - 0.12) + "," + (lat - 0.12) + "," + (lon + 0.12) + "," + (lat + 0.12) });
            const r = await fetch("https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?" + q.toString(), { headers: { "Referer": "https://azimuth-2.digitalchemy.workers.dev/" } });
            const j = await r.json();
            if (j && j.error) { privErr = j.error.message || "geocode error"; break; }
            const c = j && j.candidates && j.candidates[0];
            if (c) {
              const km = c.attributes && c.attributes.Distance != null ? null : null;
              const dx = (c.location.x - lon) * 87, dy = (c.location.y - lat) * 111;   // rough km at Dubai latitude
              out.push({ label, value: (c.address || c.attributes && c.attributes.PlaceName || "found") + " · ~" + Math.round(Math.sqrt(dx * dx + dy * dy) * 10) / 10 + " km" });
            }
          } catch (e) {}
        }
        if (privErr) return new Response(JSON.stringify({ ok: false, note: /token|invalid/i.test(privErr) ? "amenities need the geocoding privilege on the Esri credential" : privErr.slice(0, 120) }), { status: 503, headers: { "Content-Type": "application/json" } });
        const body = JSON.stringify({ ok: true, amen: out });
        await env.MEETINGS.put(ak, body);                       // cacheable by licence (geocode, not Places)
        return new Response(body, { headers: { "Content-Type": "application/json" } });
      }
      if (url.pathname === "/iso") {                           // v57 — cached drive-time rings (needs servicearea privilege on the Esri credential)
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        const ANCHORS = { difc: [55.282, 25.211], downtown: [55.276, 25.194], marina: [55.138, 25.080], dxb: [55.365, 25.253], mediacity: [55.156, 25.095] };
        const an = url.searchParams.get("anchor") || "";
        if (!ANCHORS[an]) return new Response(JSON.stringify({ ok: false, note: "unknown anchor" }), { status: 400, headers: { "Content-Type": "application/json" } });
        const ck = "iso_" + an;                                 // permanent cache: one paid call per anchor, ever
        const cached = await env.MEETINGS.get(ck);
        if (cached) return new Response(cached, { headers: { "Content-Type": "application/json" } });
        const t = await esriToken(env);
        if (!t) return new Response(JSON.stringify({ ok: false, note: "Esri token unavailable" }), { status: 503, headers: { "Content-Type": "application/json" } });
        try {
          const q = new URLSearchParams({ f: "json", token: t.token, facilities: ANCHORS[an][0] + "," + ANCHORS[an][1], defaultBreaks: "10 20 30", outSR: "4326", trimOuterPolygons: "true" });
          const r = await fetch("https://route-api.arcgis.com/arcgis/rest/services/World/ServiceAreas/NAServer/ServiceArea_World/solveServiceArea?" + q.toString(), { headers: { "Referer": "https://azimuth-2.digitalchemy.workers.dev/" } });
          const j = await r.json();
          if (!j || !j.saPolygons || !j.saPolygons.features) {
            const msg = j && j.error ? (j.error.message || "") : "no polygons";
            const priv = /token|privilege|not licensed|access/i.test(msg);
            return new Response(JSON.stringify({ ok: false, note: priv ? "drive-time needs the service-area privilege on the Esri credential" : msg.slice(0, 120) }), { status: 503, headers: { "Content-Type": "application/json" } });
          }
          const geo = { type: "FeatureCollection", features: j.saPolygons.features.map(f => ({ type: "Feature", properties: { toBreak: f.attributes && f.attributes.ToBreak }, geometry: { type: "Polygon", coordinates: f.geometry.rings } })) };
          const body = JSON.stringify({ ok: true, anchor: an, geo });
          await env.MEETINGS.put(ck, body);
          return new Response(body, { headers: { "Content-Type": "application/json" } });
        } catch (e) { return new Response(JSON.stringify({ ok: false, note: "isochrone error" }), { status: 503, headers: { "Content-Type": "application/json" } }); }
      }
      if (url.pathname === "/esri_token") {                    // v54 — short-lived Esri basemap token for the map client (secret stays server-side)
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        const t = await esriToken(env);
        if (!t) return new Response(JSON.stringify({ ok: false, detail: JSON.parse((await env.MEETINGS.get("esri_err")) || "null") }), { status: 503, headers: { "Content-Type": "application/json" } });
        return new Response(JSON.stringify({ ok: true, token: t.token, expires: t.exp }), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
      }
      if (url.pathname === "/naj_icon.svg") {                  // v49 — gold star app icon
        return new Response('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" rx="52" fill="#0C1413"/><g transform="translate(39,39) scale(0.695)"><path d="' + NAJ_ICONS.star + '" fill="#C5A56A"/></g></svg>', { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=604800" } });
      }
      if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 }); const list = await env.MEETINGS.list(); const events = []; for (const k of list.keys) { if (!k.name.startsWith("evt_")) continue; const v = await env.MEETINGS.get(k.name); if (v) { try { events.push(JSON.parse(v)); } catch (e) {} } } return new Response(JSON.stringify(events), { headers: { "Content-Type": "application/json" } });
    }
    if (request.method === "POST") {
      if (url.pathname === "/ingest_market") {                 // v36 — Market Pulse aggregates (collector -> KV, ~10 KB)
        if (request.method !== "POST") return new Response("method", { status: 405 });
        const _mh = request.headers.get("X-Azimuth-Ingest");
        if (!env.INGEST_TOKEN || !_mh || !ctEq(_mh, env.INGEST_TOKEN)) return new Response("unauthorized", { status: 401 });
        let _mb; try { _mb = await request.json(); } catch (e) { return new Response("bad json", { status: 400 }); }
        if (_mb && _mb.projectIndex && Array.isArray(_mb.projectIndex)) {          // v37.1 — compact active-project name index for news cross-referencing
          if (_mb.projectIndex.length < 100 || _mb.projectIndex.length > 50000) return new Response("index size implausible", { status: 400 });
          await env.MEETINGS.put("mkt_index", JSON.stringify(_mb.projectIndex));
          return new Response(JSON.stringify({ ok: true, indexed: _mb.projectIndex.length }), { headers: { "Content-Type": "application/json" } });
        }
        if (_mb && _mb.image && _mb.imageName) {                                  // v45 — rendered heat-map (or other) PNG from the collector
          const nm = String(_mb.imageName).replace(/[^a-z0-9_]/gi, "").slice(0, 40);
          const bin = Uint8Array.from(atob(_mb.image), c => c.charCodeAt(0));
          if (bin.length > 5 * 1024 * 1024) return new Response("image too large", { status: 400 });
          await env.MEETINGS.put("img_" + nm, bin.buffer);
          await env.MEETINGS.put("img_ct_" + nm, _mb.contentType || "image/png");
          await env.MEETINGS.put("img_at_" + nm, gstNowIso());
          return new Response(JSON.stringify({ ok: true, image: nm, bytes: bin.length }), { headers: { "Content-Type": "application/json" } });
        }
        if (_mb && _mb.developerIndex && Array.isArray(_mb.developerIndex)) {      // v40 — per-developer track record for launch-briefing due diligence
          if (_mb.developerIndex.length < 20 || _mb.developerIndex.length > 5000) return new Response("developer index size implausible", { status: 400 });
          await env.MEETINGS.put("mkt_devindex", JSON.stringify(_mb.developerIndex));
          try { await env.MEETINGS.put("mkt_devindex_at", String(_mb.generatedAt || new Date().toISOString())); } catch (e) {}   // v72.2 — snapshot date for the trust check
          return new Response(JSON.stringify({ ok: true, developers: _mb.developerIndex.length }), { headers: { "Content-Type": "application/json" } });
        }
        if (_mb && _mb.newsItems && Array.isArray(_mb.newsItems)) {                // v37.2 — Google News batch from the collector (GN blocks Cloudflare IPs)
          if (_mb.newsItems.length > 100) return new Response("too many items", { status: 400 });
          await env.MEETINGS.put("mkt_news_pending", JSON.stringify(_mb.newsItems.slice(0, 50)), { expirationTtl: 86400 });
          try { await newsTick(env, true); } catch (e) {}
          return new Response(JSON.stringify({ ok: true, pending: Math.min(_mb.newsItems.length, 50) }), { headers: { "Content-Type": "application/json" } });
        }
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
        if (msg.type === "interactive" && msg.interactive && (msg.interactive.button_reply || msg.interactive.list_reply)) {
          const bid = (msg.interactive.button_reply && msg.interactive.button_reply.id) || (msg.interactive.list_reply && msg.interactive.list_reply.id) || "";
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
          else if (/^mkt:(pod|li|ig|car|art):\d$/.test(bid)) { const _mp2 = bid.split(":"); await draftFromAngle(env, from, _mp2[1], parseInt(_mp2[2], 10)); if (_mp2[1] === "car" || _mp2[1] === "art") { let _fa2 = null; try { const _c2 = JSON.parse((await env.MEETINGS.get("mkt_briefctx")) || "null"); _fa2 = _c2 && _c2.angles && _c2.angles[parseInt(_mp2[2], 10) - 1]; } catch (e) {} if (_fa2) await waSend(env, from, visualPromptBlock(_fa2)); } }
          else if (/^feed:[1-5]$/.test(bid)) {                 // v37 — daily-feed pick: full content package for one angle
            const _fn = parseInt(bid.slice(5), 10);
            let _fc = null; try { _fc = JSON.parse((await env.MEETINGS.get("mkt_briefctx")) || "null"); } catch (e) {}
            const _fa = _fc && _fc.angles && _fc.angles[_fn - 1];
            if (_fa) {                                          // v39 — taste memory: remember what she chooses; mornings learn her
              try {
                let _pk = JSON.parse((await env.MEETINGS.get("mkt_picks")) || "[]");
                _pk.unshift({ at: gstDateStr(gstNow()), hook: _fa.hook, figure: _fa.figure, source: _fa.source });
                await env.MEETINGS.put("mkt_picks", JSON.stringify(_pk.slice(0, 21)), { expirationTtl: 60 * 86400 });
              } catch (e) {}
              await dnaSignal(env, "picked_angle", _fa.hook);
            }
            await waSend(env, from, "Good pick. What do you want from it?");
            await waSendList(env, from, "Choose a format:", "Format", [
              { id: "mkt:li:" + _fn, title: "✍️ LinkedIn post", description: "Short feed post to copy in" },
              { id: "mkt:car:" + _fn, title: "🎠 LinkedIn carousel", description: "6 swipeable slides + image prompt" },
              { id: "mkt:art:" + _fn, title: "📝 LinkedIn article", description: "Long-form thought-leadership" },
              { id: "mkt:ig:" + _fn, title: "📸 Instagram", description: "Reel script + caption + visual" }]);
          }
          else if (bid === "match:done") { await waSend(env, from, "👍 Ready for your meeting. Every figure is DLD-registered — you're the most credible person at that table."); }
          else if (bid === "match:post") {                     // v40 — turn a client-match briefing into a public post angle
            let lm = null; try { lm = JSON.parse((await env.MEETINGS.get("mkt_lastmatch")) || "null"); } catch (e) {}
            if (!lm) { await waSend(env, from, "That match expired — run the client brief again."); }
            else {
              await env.MEETINGS.put("mkt_briefctx", JSON.stringify({ at: Date.now(), brief: "MARKET INSIGHT FROM A REAL CLIENT BRIEF (anonymised — never name the client):\n" + lm.brief, data: JSON.stringify(lm.ask), angles: [] }), { expirationTtl: 3 * 86400 });
              await waSend(env, from, "Turning it into content — pick a format:");
              await waSendList(env, from, "Draft from this insight:", "Format", [
                { id: "mkt:li:1", title: "✍️ LinkedIn post", description: "Short feed post" },
                { id: "mkt:car:1", title: "🎠 LinkedIn carousel", description: "6 slides + image prompt" },
                { id: "mkt:art:1", title: "📝 LinkedIn article", description: "Long-form" },
                { id: "mkt:ig:1", title: "📸 Instagram", description: "Reel + caption + visual" }]);
            }
          }
          else if (bid === "mkt:post:li") { await publishDraft(env, from); }
          else if (bid === "mkt:discard") { await env.MEETINGS.delete("mkt_lastdraft_li"); await dnaSignal(env, "discarded_linkedin_draft", ""); await waSend(env, from, "✖️ Dropped. Ask for another angle any time — “draft linkedin 2”."); }
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
          if (/\bpost\b.*\b(insta(gram)?|ig)\b/i.test(_cap)) {             // v38 — publish this image to her Instagram with the stored caption draft
            try {
              const _pimg = await waFetchMedia(env, msg.image.id);
              if (_pimg.bytes.byteLength > 8 * 1024 * 1024) { await waSend(env, from, "That image is over 8 MB — Instagram wants smaller. Try again."); return new Response("ok"); }
              const _mid = rid() + rid();
              await env.MEETINGS.put("igm_" + _mid, _pimg.bytes, { expirationTtl: 86400 });
              await env.MEETINGS.put("igm_ct_" + _mid, _pimg.mime || "image/jpeg", { expirationTtl: 86400 });
              await waSend(env, from, "📤 Got it — publishing to Instagram…");
              await publishInstagram(env, from, url.origin + "/ig_media/" + _mid);
            } catch (e) { await waSend(env, from, "⚠ Couldn't read that image — send it again."); }
            return new Response("ok");
          }
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
          {                                                      // v58 — "report <area> [for <client>]": client briefing link in seconds
            const _rm = text.match(/^report\s+(.{2,50}?)(?:\s+for\s+(.{2,40}))?\s*$/i);
            if (_rm) {
              const _q = _rm[1].trim(), _cl = (_rm[2] || "").trim();
              const _nz2 = (x) => String(x || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
              let _d3 = null; try { _d3 = JSON.parse((await env.MEETINGS.get("mkt_latest")) || "null"); } catch (e) {}
              const _ai = (_d3 && _d3.areaIntel && _d3.areaIntel.areas) || [];
              const _nq = _nz2(_q);
              const _a = _ai.find(x => _nz2(x.area) === _nq) || _ai.find(x => _nz2(x.area).indexOf(_nq) >= 0 || (_nq.length > 5 && _nq.indexOf(_nz2(x.area)) >= 0));
              if (!_a) { await waSend(env, from, "📄 Couldn't match “" + _q + "” to a community with register depth. Use the area name as it shows on your pulse."); return new Response("ok"); }
              const _sup = ((_d3.projects && _d3.projects.supplyByArea) || {})[_a.area] || null;
              const _projs = ((_d3.projects && _d3.projects.projectLookup) || []).filter(p2 => (p2.area || "").toLowerCase() === _a.area.toLowerCase()).sort((x, y) => (y.units || 0) - (x.units || 0)).slice(0, 6);
              let _amen = null; try { const _am = JSON.parse((await env.MEETINGS.get("amen_" + _a.area.toLowerCase().replace(/[^a-z0-9]/g, ""))) || "null"); if (_am && _am.ok) _amen = _am.amen; } catch (e) {}
              const _id = [...crypto.getRandomValues(new Uint8Array(9))].map(b => b.toString(16).padStart(2, "0")).join("");
              const _snap = { v: 1, at: gstNowIso(), client: _cl, area: _a, sup: _sup, projs: _projs, amen: _amen, period: _d3.transactions ? [_d3.transactions.periodFrom, _d3.transactions.periodTo] : null };
              await env.MEETINGS.put("rpt_" + _id, JSON.stringify(_snap), { expirationTtl: 60 * 86400 });
              await waSend(env, from, "📄 " + _a.area + " briefing" + (_cl ? " for " + _cl : "") + " — ready to forward:\n" + url.origin + "/r/" + _id + "\n\nFrozen to today's register figures · link lives 60 days · shows the client nothing but the briefing.");
              return new Response("ok");
            }
          }
          {                                                      // v52 — track/untrack: Naj curates her development radar; the register still ranks it
            const _tm = text.match(/^(un)?track\s+(.{2,60})$/i);
            if (_tm) {
              const _off = !!_tm[1], _q = _tm[2].trim().replace(/[?.!]+$/, "");
              const _nz = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
              let _w = {}; try { _w = JSON.parse((await env.MEETINGS.get("mkt_watch")) || "{}"); } catch (e) {}
              _w.add = _w.add || []; _w.del = _w.del || [];
              let _d2 = null, _ix = [];
              try { _d2 = JSON.parse((await env.MEETINGS.get("mkt_latest")) || "null"); } catch (e) {}
              try { _ix = JSON.parse((await env.MEETINGS.get("mkt_index")) || "[]"); } catch (e) {}
              const _m2 = (_d2 && _d2.meed) || {};
              const _pool = [];
              for (const dv of (_m2.developments || [])) _pool.push(dv.development);
              for (const r of (_m2.recentBigUpdates || []).concat(_m2.largestUnderConstruction || [])) _pool.push(r.title);
              for (const p2 of ((_d2 && _d2.projects && _d2.projects.projectLookup) || [])) _pool.push(p2.project);
              for (const r of _ix) _pool.push(r.t);
              const _nq = _nz(_q); let _hit = null;
              for (const nm of _pool) { if (!nm) continue; const nn = _nz(nm); if (nn === _nq) { _hit = nm; break; } }
              if (!_hit) for (const nm of _pool) { if (!nm) continue; const nn = _nz(nm); if (nn.indexOf(_nq) >= 0 || (_nq.length > 5 && _nq.indexOf(nn) >= 0)) { _hit = nm; break; } }
              if (_off) {
                const _tg = _hit || _q;
                _w.del = Array.from(new Set(_w.del.concat([_nz(_tg)]))).slice(-40);
                _w.add = _w.add.filter(a => _nz(a.name) !== _nz(_tg));
                await env.MEETINGS.put("mkt_watch", JSON.stringify(_w));
                await waSend(env, from, "📡 Off the radar: " + _tg + ". Say “track " + _tg + "” anytime to bring it back.");
              } else if (_hit) {
                _w.del = _w.del.filter(x => x !== _nz(_hit));
                if (!_w.add.some(a => _nz(a.name) === _nz(_hit))) _w.add.push({ name: _hit, at: gstNowIso() });
                _w.add = _w.add.slice(-20);
                await env.MEETINGS.put("mkt_watch", JSON.stringify(_w));
                await waSend(env, from, "📡 On the radar: " + _hit + ". The register ranks it with the rest — demand and delivery decide its spot from the next refresh. “untrack " + _hit + "” removes it.");
              } else {
                await waSend(env, from, "📡 Couldn't find “" + _q + "” in the register or the project corpus. Try the name as the developer registered it — or send me a news story about it and I'll cross-reference.");
              }
              return new Response("ok");
            }
          }
          const _dm = text.match(/^draft\s+(?:an?\s+)?(podcast|video|script|article|linkedin|post|carousel|slides?|instagram|insta|reel|ig)(?:\s+(?:script|post|reel|carousel|article))?(?:\s+(?:for\s+)?(?:angle\s+)?(\d))?\s*$/i);
          if (_dm) {
            const _kind = /podcast|video|script/i.test(_dm[1]) ? "pod" : /article/i.test(_dm[1]) ? "art" : /carousel|slide/i.test(_dm[1]) ? "car" : /instagram|insta|reel|ig/i.test(_dm[1]) ? "ig" : "li";
            await draftFromAngle(env, from, _kind, _dm[2] ? parseInt(_dm[2], 10) : 1);
            return new Response("ok");
          }
          if (/^market\s+brief$/i.test(text)) {
            await waSend(env, from, "🕐 Running your market brief now — give me a moment…");
            try { await marketBriefTick(env, true); } catch (e) { await waSend(env, from, "Couldn't build the brief just now — try again shortly."); }
            return new Response("ok");
          }
          {                                                     // v72.2 — developer trust check: "trust Binghatti" / "check developer Imtiaz"
            const _tm = text.match(/^(?:trust check|trust|check developer|developer check|verify developer)\b[:\s]*(.+)$/i);
            if (_tm && _tm[1] && _tm[1].trim().length > 1) {
              try { await waSend(env, from, devTrustText(await devTrust(env, _tm[1].trim()))); } catch (e) { await waSend(env, from, "Couldn't run that check — try again shortly."); }
              try { await dnaSignal(env, "trust_check", _tm[1].trim()); } catch (e) {}
              return new Response("ok");
            }
          }
          {                                                     // v40 — launch mode: due diligence in the developer's briefing room
            const _lm = text.match(/^(?:launch|at a launch|new launch|briefing|due diligence)\b[:\s]*(.+)$/i);
            if (_lm && _lm[1] && _lm[1].trim().length > 8) {
              await waSend(env, from, "🏗 Checking that launch against the register…");
              try { await launchMode(env, from, _lm[1].trim()); } catch (e) { await waSend(env, from, "Couldn't build that check — try again shortly."); }
              return new Response("ok");
            }
          }
          {                                                     // v40 — client match: "client has 1.5M wants a 1-bed for rental" / "match ..."
            const _mm = text.match(/^(?:match|client|buyer|find(?:\s+me)?)\b[:\s]*(.+)$/i) ||
                        (/\bclient\b|\bbudget\b|\bwants?\b|\blooking for\b/i.test(text) && /\b\d/.test(text) && /\b(bed|b\/?r|studio|villa|apartment|invest|rent|yield|budget|aed|k\b|m\b|million)\b/i.test(text) ? [null, text] : null);
            if (_mm && _mm[1] && _mm[1].trim().length > 6) {
              await waSend(env, from, "🎯 Working the register for that brief…");
              try { await clientMatch(env, from, _mm[1].trim()); } catch (e) { await waSend(env, from, "Couldn't build that match — try again shortly."); }
              return new Response("ok");
            }
          }
          if (/^dna\s*\??$/i.test(text)) {                     // v39 — transparency: show her what it has learned about her
            const _d = await dnaGet(env);
            await waSend(env, from, _d ? ("🧬 What I've learned about your content identity so far:" + NL10 + NL10 + _d + NL10 + NL10 + "This updates itself nightly from what you pick, draft and skip. It only ever learns from your own choices.") : "🧬 Still learning you — pick a few angles from your morning feeds and check back in a couple of days.");
            return new Response("ok");
          }
          if (/^news\s*\??$/i.test(text)) {
            try { await newsTick(env, true); } catch (e) {}
            let nn = []; try { nn = JSON.parse((await env.MEETINGS.get("mkt_news")) || "[]"); } catch (e) {}
            if (!nn.length) { await waSend(env, from, "📰 Nothing property-worthy in the last couple of days' headlines."); return new Response("ok"); }
            await waSend(env, from, "📰 Latest, cross-checked against the project register:" + NL10 + NL10 + nn.slice(0, 6).map(x =>
              "• " + x.title + (x.outlet ? " — " + x.outlet : "") +
              (x.xref ? NL10 + "   🔗 matches “" + x.xref.meedName + "” in the MEED corpus" + (x.xref.facts && x.xref.facts.completionDate ? " · completion " + String(x.xref.facts.completionDate).slice(0, 10) : "") + (x.xref.facts && x.xref.facts.stage ? " · " + x.xref.facts.stage : "") : "")
            ).join(NL10 + NL10) + NL10 + NL10 + "Say “feed” to turn today's data + news into three post-ready angles.");
            return new Response("ok");
          }
          if (/^(?:maps?|heat\s*maps?|heatmap)\s*\??$/i.test(text)) {
            const has = await env.MEETINGS.get("img_heatmap_story");
            if (has) {
              await waSendImage(env, from, url.origin + "/img/heatmap_story", "🗺 Dubai — where it's trading. Registered sales heat, straight from the register. Long-press to save and post.");
              await waSendImage(env, from, url.origin + "/img/heatmap_square", "Square version for your grid.");
            } else {
              await waSend(env, from, "🗺 The map's rendering on the next refresh — for now your charts (incl. a map) are here:\n" + url.origin + "/charts?key=" + env.READ_KEY);
            }
            return new Response("ok");
          }
          if (/^(?:charts?|graphs?|visuals?)\s*\??$/i.test(text)) {
            await waSend(env, from, "📊 Your charts — bar, line, off-plan split, yields, and a Dubai map, all from the register:\n" + url.origin + "/charts?key=" + env.READ_KEY + "\n\nLong-press any one to save it, then post — the source line is already on it.");
            return new Response("ok");
          }
          if (/^(?:feed|daily|today(?:'s)?\s+(?:feed|angles|posts?))\s*\??$/i.test(text)) {
            await waSend(env, from, "☀️ Building this morning's three — a moment…");
            try { await dailyFeedTick(env, true); } catch (e) { await waSend(env, from, "Couldn't build the feed just now — try again shortly."); }
            return new Response("ok");
          }
          if (/^(?:help|menu|commands|what\s+can\s+you\s+do|what\s+do\s+you\s+do|how\s+do(?:es)?\s+(?:i|you|this)\s+(?:use\s+)?(?:you|this|work))\s*\??$/i.test(text)) {
            await waSend(env, from, "🧭 Here's what I can do:" + NL10 +
              "📋 Tasks — just tell me (“call Sara tomorrow 3pm”)" + NL10 +
              "🗓 Meetings — text or voice note, I file them with reminders" + NL10 +
              "📷 Photos — flyers, invites, whiteboards; I read them and file what's in them" + NL10 +
              "❓ Questions — ask about anything I've filed for you" + NL10 +
              "📡 “track <project>” / “untrack <project>” — curate your development radar" + NL10 +
              "🤝 “who owes me” · “what do I owe” · “status with <name>”" + NL10 +
              "👀 “list groups” · “watch <name>” — what I listen to" + NL10 +
              "🖥 “board” — your live board link" + NL10 +
              "📈 “market” — your Najma market pulse" + NL10 +
              "📊 “charts” — post-ready bar/line/pie + a Dubai map" + NL10 +
              "🎯 “client has 1.5M, wants a 1-bed to rent” — instant register-grounded advice for a meeting" + NL10 +
              "🏗 “launch: <developer> in <area>, 1-bed from 1.2M, claims 8% ROI” — due diligence while you're in the pitch" + NL10 +
              "🛡 “trust <developer>” — MEED delivery record + the official DLD pages to verify licence, escrow and disputes" + NL10 +
              "☀️ “feed” — today's five post-ready angles, any time" + NL10 +
              "📰 “news” — latest headlines, cross-checked against the project register" + NL10 +
              "🕐 “market brief” — your weekly brief, on demand" + NL10 +
              "✍️ “draft linkedin 2” · 🎠 “draft carousel 2” · 📝 “draft article 2” · 📸 “draft instagram 3”" + NL10 +
              "🧬 “dna” — what I've learned about your style");
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
      try { await dnaReflect(env); } catch (e) {}             // v39 — nightly DNA reflection (~20:00 GST, only when new signals exist)
      try { await newsTick(env); } catch (e) {}               // v37.1 — hourly news sweep + MEED cross-reference
      try { await dailyFeedTick(env); } catch (e) {}          // v37 — Najma daily feed: three post-ready angles ~07:00 GST
      try { await marketBriefTick(env); } catch (e) {}        // v36 — weekly Market Pulse brief (Sunday ~09:00 GST, MARKET_BRIEF="on" only)
    })());
  },
};

// ── Market Pulse (v36) ── dashboard renderer + weekly brief ─────────────────────────────
function mkFmtM(v) { if (v == null) return "—"; if (v >= 1000) return "$" + (v / 1000).toFixed(1) + "bn"; return "$" + Math.round(v) + "m"; }
// v49 — Najma UI uplift: Phosphor icons (MIT, phosphoricons.com), inlined as single paths, gold via currentColor
const NAJ_ICONS = { cube: "M128 24l96 52v104l-96 52-96-52V76zM32 76l96 52 96-52M128 128v104",
  grid: "M40 40h76v76H40zM140 40h76v76h-76zM40 140h76v76H40zM140 140h76v76h-76z", star:"M237.28,97.87A14.18,14.18,0,0,0,224.76,88l-60.25-4.87-23.22-56.2a14.37,14.37,0,0,0-26.58,0L91.49,83.11,31.24,88a14.18,14.18,0,0,0-12.52,9.89A14.43,14.43,0,0,0,23,113.32L69,152.93l-14,59.25a14.4,14.4,0,0,0,5.59,15,14.1,14.1,0,0,0,15.91.6L128,196.12l51.58,31.71a14.1,14.1,0,0,0,15.91-.6,14.4,14.4,0,0,0,5.59-15l-14-59.25L233,113.32A14.43,14.43,0,0,0,237.28,97.87Zm-12.14,6.37-48.69,42a6,6,0,0,0-1.92,5.92l14.88,62.79a2.35,2.35,0,0,1-.95,2.57,2.24,2.24,0,0,1-2.6.1L131.14,184a6,6,0,0,0-6.28,0L70.14,217.61a2.24,2.24,0,0,1-2.6-.1,2.35,2.35,0,0,1-1-2.57l14.88-62.79a6,6,0,0,0-1.92-5.92l-48.69-42a2.37,2.37,0,0,1-.73-2.65,2.28,2.28,0,0,1,2.07-1.65l63.92-5.16a6,6,0,0,0,5.06-3.69l24.63-59.6a2.35,2.35,0,0,1,4.38,0l24.63,59.6a6,6,0,0,0,5.06,3.69l63.92,5.16a2.28,2.28,0,0,1,2.07,1.65A2.37,2.37,0,0,1,225.14,104.24Z", sun:"M122,40V16a6,6,0,0,1,12,0V40a6,6,0,0,1-12,0Zm68,88a62,62,0,1,1-62-62A62.07,62.07,0,0,1,190,128Zm-12,0a50,50,0,1,0-50,50A50.06,50.06,0,0,0,178,128ZM59.76,68.24a6,6,0,1,0,8.48-8.48l-16-16a6,6,0,0,0-8.48,8.48Zm0,119.52-16,16a6,6,0,1,0,8.48,8.48l16-16a6,6,0,1,0-8.48-8.48ZM192,70a6,6,0,0,0,4.24-1.76l16-16a6,6,0,0,0-8.48-8.48l-16,16A6,6,0,0,0,192,70Zm4.24,117.76a6,6,0,0,0-8.48,8.48l16,16a6,6,0,0,0,8.48-8.48ZM46,128a6,6,0,0,0-6-6H16a6,6,0,0,0,0,12H40A6,6,0,0,0,46,128Zm82,82a6,6,0,0,0-6,6v24a6,6,0,0,0,12,0V216A6,6,0,0,0,128,210Zm112-88H216a6,6,0,0,0,0,12h24a6,6,0,0,0,0-12Z", buildings:"M240,210H222V96a14,14,0,0,0-14-14H142V32a14,14,0,0,0-21.77-11.64l-80,53.33A14,14,0,0,0,34,85.34V210H16a6,6,0,0,0,0,12H240a6,6,0,0,0,0-12ZM208,94a2,2,0,0,1,2,2V210H142V94ZM46,85.34a2,2,0,0,1,.89-1.66l80-53.34A2,2,0,0,1,130,32V210H46ZM110,112v16a6,6,0,0,1-12,0V112a6,6,0,0,1,12,0Zm-32,0v16a6,6,0,0,1-12,0V112a6,6,0,0,1,12,0Zm0,56v16a6,6,0,0,1-12,0V168a6,6,0,0,1,12,0Zm32,0v16a6,6,0,0,1-12,0V168a6,6,0,0,1,12,0Z", chart:"M230,208a6,6,0,0,1-6,6H32a6,6,0,0,1-6-6V48a6,6,0,0,1,12,0v98.78l54.05-47.3a6,6,0,0,1,7.55-.28l60.11,45.08,60.34-52.8a6,6,0,0,1,7.9,9l-64,56a6,6,0,0,1-7.55.28L96.29,111.72,38,162.72V202H224A6,6,0,0,1,230,208Z", pin:"M128,66a38,38,0,1,0,38,38A38,38,0,0,0,128,66Zm0,64a26,26,0,1,1,26-26A26,26,0,0,1,128,130Zm0-112a86.1,86.1,0,0,0-86,86c0,30.91,14.34,63.74,41.47,94.94a252.32,252.32,0,0,0,41.09,38,6,6,0,0,0,6.88,0,252.32,252.32,0,0,0,41.09-38c27.13-31.2,41.47-64,41.47-94.94A86.1,86.1,0,0,0,128,18Zm0,206.51C113,212.93,54,163.62,54,104a74,74,0,0,1,148,0C202,163.62,143,212.93,128,224.51Z", trend:"M238,56v64a6,6,0,0,1-12,0V70.48l-85.76,85.76a6,6,0,0,1-8.48,0L96,120.49,28.24,188.24a6,6,0,0,1-8.48-8.48l72-72a6,6,0,0,1,8.48,0L136,143.51,217.52,62H168a6,6,0,0,1,0-12h64A6,6,0,0,1,238,56Z", coins:"M224.56,103.81C213.43,97.75,198.47,93.39,182,91.34V84c0-12.12-9.58-23.1-27-30.93C139.16,45.93,118.2,42,96,42S52.84,45.93,37,53.07C19.58,60.9,10,71.88,10,84v40c0,12.12,9.58,23.1,27,30.93,10.49,4.72,23.21,8,37,9.73V172c0,12.12,9.58,23.1,27,30.93C116.84,210.07,137.8,214,160,214s43.16-3.93,59-11.07c17.39-7.83,27-18.81,27-30.93V132C246,121.35,238.39,111.34,224.56,103.81Zm-5.74,10.54C228.61,119.68,234,126,234,132c0,14.19-30.39,30-74,30a166.9,166.9,0,0,1-21.21-1.34A110.79,110.79,0,0,0,155,154.93c17.39-7.83,27-18.81,27-30.93V103.43C196.4,105.36,209.3,109.16,218.82,114.35ZM108.16,153.58c-3.92.27-8,.42-12.16.42-5.3,0-10.4-.24-15.28-.67a2.22,2.22,0,0,0-.37,0c-3.58-.33-7-.77-10.35-1.3V124.12A178,178,0,0,0,96,126a178,178,0,0,0,26-1.88V152c-4.34.69-8.91,1.22-13.69,1.56ZM170,105.89V124c0,9.54-13.75,19.8-36,25.51V121.85a115,115,0,0,0,21-6.92A66.2,66.2,0,0,0,170,105.89ZM96,54c43.61,0,74,15.81,74,30s-30.39,30-74,30S22,98.19,22,84,52.39,54,96,54ZM22,124V105.89a66.2,66.2,0,0,0,15,9,115,115,0,0,0,21,6.92v27.66C35.75,143.8,22,133.54,22,124Zm64,48v-6.28c3.3.18,6.63.28,10,.28q5.91,0,11.66-.37A123.17,123.17,0,0,0,122,169.84v27.67C99.75,191.8,86,181.54,86,172Zm48,28V172.1a177.84,177.84,0,0,0,26,1.9,178,178,0,0,0,26-1.88V200a170,170,0,0,1-52,0Zm64-2.49V169.85a115,115,0,0,0,21-6.92,66.2,66.2,0,0,0,15-9V172C234,181.54,220.25,191.8,198,197.51Z", key:"M215.15,40.85A78,78,0,0,0,86.2,121.31l-56.1,56.1a13.94,13.94,0,0,0-4.1,9.9V216a14,14,0,0,0,14,14H72a6,6,0,0,0,6-6V206H96a6,6,0,0,0,6-6V182h18a6,6,0,0,0,4.24-1.76l10.45-10.44A77.59,77.59,0,0,0,160,174h.1A78,78,0,0,0,215.15,40.85ZM226,98.16c-1.12,35.16-30.67,63.8-65.88,63.84a65.93,65.93,0,0,1-24.51-4.67,6,6,0,0,0-6.64,1.26L117.51,170H96a6,6,0,0,0-6,6v18H72a6,6,0,0,0-6,6v18H40a2,2,0,0,1-2-2V187.31a2,2,0,0,1,.58-1.41l58.83-58.83a6,6,0,0,0,1.26-6.64A65.61,65.61,0,0,1,94,95.92C94,60.71,122.68,31.16,157.83,30A66,66,0,0,1,226,98.16ZM190,76a10,10,0,1,1-10-10A10,10,0,0,1,190,76Z", crane:"M240,82H107.71L85.37,37.32A6,6,0,0,0,80,34H48a6,6,0,0,0-6,6V82H24a6,6,0,0,0,0,12H42V210H24a6,6,0,0,0,0,12H128a6,6,0,0,0,0-12H110V94H210v90a2,2,0,0,1-2,2H192a2,2,0,0,1-2-2v-8a6,6,0,0,0-12,0v8a14,14,0,0,0,14,14h16a14,14,0,0,0,14-14V94h18a6,6,0,0,0,0-12ZM54,46H76.29l18,36H54Zm0,164V158H98v52Zm44-64H54V94H98Z", house:"M240,210H222V131.17l5.76,5.76a6,6,0,0,0,8.48-8.49L137.9,30.09a14,14,0,0,0-19.8,0L19.76,128.44a6,6,0,0,0,8.48,8.49L34,131.17V210H16a6,6,0,0,0,0,12H240a6,6,0,0,0,0-12ZM46,119.17l80.58-80.59a2,2,0,0,1,2.84,0L210,119.17V210H158V152a6,6,0,0,0-6-6H104a6,6,0,0,0-6,6v58H46ZM146,210H110V158h36Z", bed:"M216,74H30V48a6,6,0,0,0-12,0V208a6,6,0,0,0,12,0V174H242v34a6,6,0,0,0,12,0V112A38,38,0,0,0,216,74ZM30,86h76v76H30Zm88,76V86h98a26,26,0,0,1,26,26v50Z", file:"M212.24,83.76l-56-56A6,6,0,0,0,152,26H56A14,14,0,0,0,42,40V216a14,14,0,0,0,14,14H200a14,14,0,0,0,14-14V88A6,6,0,0,0,212.24,83.76ZM158,46.48,193.52,82H158ZM200,218H56a2,2,0,0,1-2-2V40a2,2,0,0,1,2-2h90V88a6,6,0,0,0,6,6h50V216A2,2,0,0,1,200,218Zm-34-82a6,6,0,0,1-6,6H96a6,6,0,0,1,0-12h64A6,6,0,0,1,166,136Zm0,32a6,6,0,0,1-6,6H96a6,6,0,0,1,0-12h64A6,6,0,0,1,166,168Z" };
const najIcon = (n) => NAJ_ICONS[n] ? '<svg viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="' + NAJ_ICONS[n] + '"/></svg>' : "";
// v62 — the register labels layouts "1 B/R" / "Studio" / "PENTHOUSE"; sort numerically, Studio first
const najRoomKey = (k) => { const m = String(k).match(/(\d+)/); return /studio/i.test(k) ? 0 : m ? parseInt(m[1], 10) : 98; };
const najRooms = (byRoom) => Object.entries(byRoom || {}).sort((a, b) => najRoomKey(a[0]) - najRoomKey(b[0]));
const najH2 = (icon, title) => '<h2><span class=ih>' + najIcon(icon) + '</span>' + title + '</h2>';
// v55 — satellite banners: real Esri World Imagery of each community, pre-stitched and stored in
// KV as sat_<slug> (make_area_banners.py). Real location beats stock photography, and it is
// licensed, accurate and defensible. Falls back silently to nothing if a banner is absent.
const najSlug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const najSat = (name) => '/img/sat_' + najSlug(name);
const NAJ_FONTS = '<link rel=preconnect href=https://fonts.googleapis.com><link rel=preconnect href=https://fonts.gstatic.com crossorigin><link rel=stylesheet href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">';
// v51 — shared bottom tab bar: one app, four rooms. Inject NAJ_NAV_CSS in <style> and najNav() before </body>.
const NAJ_NAV_CSS = '.nnav{position:fixed;left:0;right:0;bottom:0;z-index:40;display:flex;justify-content:space-around;align-items:center;background:rgba(12,20,19,.93);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);border-top:1px solid #24352F;padding:8px 4px calc(8px + env(safe-area-inset-bottom))}.nnav a{display:flex;flex-direction:column;align-items:center;gap:3px;text-decoration:none;color:#8FA39B;font-size:.58rem;font-family:"IBM Plex Mono",monospace;letter-spacing:.05em;-webkit-tap-highlight-color:transparent}.nnav a svg{width:19px;height:19px}.nnav a.on{color:#C5A56A}';
const najNav = (key, active) => {
  const k = encodeURIComponent(key || "");
  const items = [["homes", "/home", "grid", "HOMES"], ["pulse", "/market", "trend", "PULSE"], ["twin", "/skyline", "cube", "TWIN"], ["map", "/map", "pin", "MAP"], ["charts", "/charts", "chart", "CHARTS"], ["board", "/board", "house", "BOARD"]];   // v79 - the digital twin is one tap from anywhere   // v73.2 - HOMES = developer cover (2 x 5) is the entry to the property lane
  return '<nav class=nnav>' + items.map(i => '<a' + (active === i[0] ? ' class=on' : '') + ' href="' + i[1] + '?key=' + k + '">' + najIcon(i[2]) + '<span>' + i[3] + '</span></a>').join('') + '</nav>';
};

function renderMarket(latestRaw, prevRaw, key, origin, watchRaw) {
  let d = null, p = null, watch = {};
  try { d = JSON.parse(latestRaw || "null"); } catch (e) {}
  try { p = JSON.parse(prevRaw || "null"); } catch (e) {}
  try { watch = JSON.parse(watchRaw || "{}") || {}; } catch (e) {}
  if (!d) return '<!doctype html><meta charset=utf-8><body style="font-family:system-ui;background:#0C1413;color:#E8E4D8;padding:2rem"><h2 style="color:#C5A56A">Najma</h2><p>No data yet — the collector has not delivered. Run the market-pulse collector once, then refresh.</p>';
  const m = d.meed || {};
  const prevStage = {}; if (p && p.meed && p.meed.byStage) for (const s of p.meed.byStage) prevStage[s.stage] = s;
  const ageDays = (Date.now() - Date.parse(d.generatedAt || 0)) / 86400000;
  const stale = !(ageDays < 3);
  const esc2 = (s) => String(s == null ? "" : s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const stageRows = (m.byStage || []).map(s => {
    const pv = prevStage[s.stage]; let delta = "";
    if (pv && pv.count !== s.count) { const df = s.count - pv.count; delta = ' <span style="color:' + (df > 0 ? "#56B584" : "#D9A441") + '">' + (df > 0 ? "▲" : "▼") + Math.abs(df) + "</span>"; }
    return '<div class=srow><span>' + esc2(s.stage) + delta + '</span><span class=sv>' + s.count + ' · ' + mkFmtM(s.valueUsdM) + '</span></div>';
  }).join("");
  const projRows = (list) => (list || []).map(r => '<div class=prow data-track="' + esc2(r.title) + '"><div class=pt>' + esc2(r.title) + ' <span class=trk>📡</span></div><div class=pm><span>' + esc2(r.stage) + '</span><span>' + mkFmtM(r.valueUsdM) + (r.updated ? ' · ' + esc2(r.updated) : '') + '</span></div></div>').join("");

  const t = d.transactions || null, rn = d.rents || null, mo = d.monthly || null, ho = d.handover || null;
  const num2 = (v) => (v == null ? "—" : Number(v).toLocaleString("en-US"));
  const eKey = encodeURIComponent(key || "");
  const areaLink = (nm) => '/area/' + encodeURIComponent(nm) + '?key=' + eKey;
  let body = "";

  // ── THE PULSE — DLD registered sales ──
  if (t) {
    const offTot = (t.offPlanSplit && (t.offPlanSplit["Off-Plan"] || 0) + (t.offPlanSplit["Ready"] || 0)) || 0;
    const offPct = offTot ? Math.round(100 * (t.offPlanSplit["Off-Plan"] || 0) / offTot) : null;
    body += '<a class=hero href="/map?key=' + eKey + '"><div class=hv>AED ' + esc2(t.salesValueAedBn) + '<small> billion</small></div><div class=hl>registered sales · ' + esc2(String(t.periodFrom || "")) + " → " + esc2(String(t.periodTo || "")) + ' · Dubai Land Department (DLD)</div><div class=hgo>see it on the live map ›</div></a>' +
      '<div class=grid>' +
      '<a class=st href="/map?key=' + eKey + '"><div class=v>' + num2(t.salesCount) + '</div><div class=l>sales registered ›</div></a>' +
      '<a class=st href="/charts?key=' + eKey + '"><div class=v>' + num2(t.medianResidentialAedSqft) + '<small>/sq ft</small></div><div class=l>median residential (AED) ›</div></a>' +
      '<a class=st href="/charts?key=' + eKey + '"><div class=v>' + (t.medianTicketAed ? (t.medianTicketAed / 1e6).toFixed(2) + "m" : "—") + '</div><div class=l>median ticket (AED) ›</div></a>' +
      '<a class=st href="/charts?key=' + eKey + '"><div class=v>' + (offPct == null ? "—" : offPct + "<small>%</small>") + '</div><div class=l>of sales are off-plan ›</div></a>' +
      "</div>";
    if (offPct != null) body += '<a class="card clk" href="/charts?key=' + eKey + '">' + najH2("house", "Off-plan vs ready") + '<div class=bar><i style="width:' + offPct + '%;background:#C5A56A"></i><i style="width:' + (100 - offPct) + '%;background:#3E8A7E"></i></div><div class=lg><span><b>' + num2(t.offPlanSplit["Off-Plan"]) + "</b> off-plan</span><span><b>" + num2(t.offPlanSplit["Ready"]) + "</b> ready</span></div></a>";
    if (t.weekly && t.weekly.length) {
      const mx = Math.max(...t.weekly.map(w => w.sales)) || 1;
      body += '<a class="card clk" href="/charts?key=' + eKey + '">' + najH2("chart", "Sales by week") + '<div class=spark>' + t.weekly.map((w, i) => '<div class=wk title="' + esc2(w.week) + ": " + num2(w.sales) + ' sales"><i style="height:' + Math.max(4, Math.round(64 * w.sales / mx)) + "px" + (i === t.weekly.length - 1 ? ";opacity:.45;border:1px dashed #3B584F;background:none" : (w.sales === mx ? ";background:#C5A56A" : "")) + '"></i><span>' + esc2(String(w.week).slice(-3)) + "</span></div>").join("") + '</div><div class=note>Newest bar is a part-week — registration lags the deal.</div></a>';
    }
    if (t.topAreas && t.topAreas.length) {
      const amx = t.topAreas[0].sales || 1;
      body += '<div class=card>' + najH2("pin", "Where the market is trading") + t.topAreas.slice(0, 8).map(a => '<a class=arow href="' + areaLink(a.area) + '"><span class=nm>' + esc2(a.area) + '</span><span class=tr><i style="width:' + Math.round(100 * a.sales / amx) + '%"></i></span><span class=ct>' + num2(a.sales) + '</span><span class=chv>›</span></a>').join("") + '<div class=note>Tap an area for its full deep dive.</div></div>';
    }
  }
  if (mo && mo.series && mo.series.length) {
    const vmx = Math.max(...mo.series.map(s => s.valueAedBn)) || 1;
    body += '<a class="card clk" href="/charts?key=' + eKey + '">' + najH2("trend", 'The year so far — AED ' + esc2(mo.ytdValueAedBn) + "bn · " + num2(mo.ytdSales) + ' sales') + '<div class=spark>' + mo.series.map((s, i) => '<div class=wk title="' + esc2(s.month) + ": AED " + s.valueAedBn + 'bn"><i style="height:' + Math.max(4, Math.round(64 * s.valueAedBn / vmx)) + "px" + (i === mo.series.length - 1 ? ";opacity:.45;border:1px dashed #3B584F;background:none" : "") + '"></i><span>' + esc2(String(s.month).slice(5)) + "</span></div>").join("") + "</div></a>";
  }

  // ── RENTS & YIELDS — Ejari ──
  if (rn) {
    body += '<div class=card>' + najH2("coins", 'Rents &amp; gross yields · ' + num2(rn.contractsCount) + " contracts, " + esc2(String(rn.registrationTo || ""))) +
      '<div class=grid style="margin-bottom:.5rem"><div class=st><div class=v>' + (rn.medianAnnualRentAed ? Math.round(rn.medianAnnualRentAed / 1000) + "k" : "—") + '</div><div class=l>median annual rent (AED)</div></div><div class=st><div class=v>' + esc2(rn.medianRentAedSqftYr || "—") + '<small>/sq ft/yr</small></div><div class=l>median residential (AED)</div></div></div>' +
      ((rn.grossYieldPctByArea || []).slice(0, 6).map(y => { const ymx = rn.grossYieldPctByArea[0].yieldPct || 1; return '<a class=arow href="' + areaLink(y.area) + '"><span class=nm>' + esc2(y.area) + '</span><span class=tr><i style="width:' + Math.round(100 * y.yieldPct / ymx) + '%"></i></span><span class=ct>' + y.yieldPct + '%</span><span class=chv>›</span></a>'; }).join("")) +
      '<div class=note>' + esc2(rn.yieldNote || "") + "</div></div>";
  }

  // ── HANDOVER RADAR ──
  if (ho && ho.meedByQuarter) {
    const qs = Object.entries(ho.meedByQuarter).slice(0, 5);
    body += '<a class="card clk" href="/map?m=su&key=' + eKey + '">' + najH2("key", "Handover radar") + qs.map(([q, e]) => '<div class=arow><span class=nm style="color:#C5A56A">' + esc2(q) + '</span><span style="flex:1;font-size:.82rem">' + e.packages + " package(s) · " + mkFmtM(e.valueUsdM) + "</span></div>").join("") + '<div class=note>' + esc2((ho.note || "").slice(0, 160)) + "</div></a>";
  }

  // ── TRACKED DEVELOPMENTS — demand (DLD) vs delivery (MEED) ──
  const _nz = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const wdel = (watch.del || []), wadd = (watch.add || []);
  const devPool = (m.developments || []).filter(dv => !wdel.includes(_nz(dv.development)));
  if (devPool.length || wadd.length) {
    // v52 — the list ranks ITSELF from the register: demand momentum (vs previous pulse) +
    // delivery proximity decide the order, every card says why it sits where it sits, and
    // Naj curates the pool from chat ("track X" / "untrack X").
    const prevDev = {};
    if (p && p.meed && p.meed.developments) for (const v of p.meed.developments) prevDev[v.development] = v;
    const aiAreas = (d.areaIntel && d.areaIntel.areas) || [];
    const devSlug = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const devHref = (nm, loc) => { const l = _nz(loc || ""); const hitA = aiAreas.find(a2 => l.indexOf(_nz(a2.area)) >= 0); return hitA ? areaLink(hitA.area) : ('/map?key=' + eKey); };
    // Photo if Kendall has supplied one (dev_<slug>); otherwise real satellite imagery of the
    // matched community (sat_<slug>) — accurate and licensed, never a generic stock shot.
    const devImg = (nm, loc) => {
      const l = _nz(loc || ""); const hitA = aiAreas.find(a2 => l.indexOf(_nz(a2.area)) >= 0);
      const alt = hitA ? najSat(hitA.area) : "";
      return '<img class=devimg src="/img/dev_' + devSlug(nm) + '" alt="" loading=lazy' +
        (alt ? ' data-sat="' + alt + '" onerror="if(this.dataset.sat&&this.src.indexOf(\'sat_\')<0){this.src=this.dataset.sat}else{this.remove()}"' : ' onerror="this.remove()"') + '>';
    };
    const scored = devPool.map(dv => {
      const dp = dv.dldPulse; let s = 0; const why = [];
      if (dp) {
        s += Math.min(40, (dp.salesCount || 0) / 20);
        const pv = prevDev[dv.development], pc = pv && pv.dldPulse ? pv.dldPulse.salesCount : null;
        if (pc != null && dp.salesCount != null && dp.salesCount !== pc) {
          const delta = dp.salesCount - pc;
          if (delta > 0) { s += Math.min(30, delta / 5); why.push("▲" + num2(delta) + " sales vs last pulse"); }
          else why.push("▼" + num2(-delta) + " sales vs last pulse");
        }
      }
      if (dv.nextCompletion) {
        const days = Math.round((Date.parse(dv.nextCompletion) - Date.now()) / 86400000);
        if (days >= 0 && days <= 240) { s += (240 - days) / 8; why.push("handover " + days + "d out"); }
      }
      if (!dp) s -= 10;
      if (!why.length) why.push(dp ? "steady demand on the register" : "delivery watch only");
      return { dv, s, why };
    }).sort((x, y) => y.s - x.s);
    const extras = wadd.filter(w => !devPool.some(dv => _nz(dv.development) === _nz(w.name)) && !wdel.includes(_nz(w.name))).map(w => {
      const pl = ((d.projects && d.projects.projectLookup) || []).find(p2 => { const a = _nz(p2.project), b = _nz(w.name); return a === b || a.indexOf(b) >= 0 || (b.length > 5 && b.indexOf(a) >= 0); });
      const ai2 = pl ? (((d.areaIntel && d.areaIntel.areas) || []).find(a2 => a2.area === pl.area) || null) : null;
      return '<a class=dev href="' + (pl && pl.area ? areaLink(pl.area) : ('/map?key=' + eKey)) + '">' + devImg(w.name, pl ? pl.area : "") + '<div class=devh><b>' + esc2(w.name) + '</b><span class=pv>' + (pl ? esc2((pl.developer || "") + (pl.area ? " · " + pl.area : "")) : "on your watchlist") + '</span></div><div class=why>tracked by you · register-only card</div><div class=devg><div><span class=k>DEMAND — DLD' + (ai2 ? " (" + esc2(pl.area) + " area)" : "") + '</span>' +
        (ai2 ? ("<br>" + num2(ai2.sales) + " area sales · " + num2(ai2.medianAedSqft) + "/sq ft" + (ai2.netYieldPct != null ? "<br>net yield " + ai2.netYieldPct + "%" : "")) : "<br><span class=pv>searching the register</span>") +
        '</div><div><span class=k>DELIVERY — DLD REGISTER</span><br>' + (pl ? ((pl.percentComplete != null ? pl.percentComplete + "% built" : esc2(pl.status || "registered")) + (pl.units ? " · " + num2(pl.units) + " units" : "") + (pl.escrowRegistered ? "<br>escrow ✓" : "") + (pl.endDate ? "<br>completion " + esc2(String(pl.endDate).slice(0, 10)) : "")) : '<span class=pv>full delivery detail joins on the next collector run</span>') + '</div></div></a>';
    }).join("");
    body += '<div class=card>' + najH2("star", "Development radar — ranked by the register") + scored.map(({ dv, why }) => {
      const dp = dv.dldPulse;
      return '<a class=dev href="' + devHref(dv.development, dv.location) + '">' + devImg(dv.development, dv.location) + '<div class=devh><b>' + esc2(dv.development) + "</b><span class=pv>" + esc2(dv.developer) + " · " + esc2(dv.location || "") + '</span></div><div class=why>' + esc2(why.join(" · ")) + '</div><div class=devg><div><span class=k>DEMAND — DLD</span>' +
        (dp ? ("<br>" + num2(dp.salesCount) + " sales · AED " + num2(dp.salesValueAedM) + "m<br>" + num2(dp.medianResidentialAedSqft) + "/sq ft · " + dp.offPlanPct + "% off-plan") : "<br><span class=pv>" + esc2(dv.mapNote || "outside DLD coverage") + "</span>") +
        '</div><div><span class=k>DELIVERY — MEED</span><br>' + dv.activeProjects + " active · " + mkFmtM(dv.pipelineValueUsdM) + (dv.nextCompletion ? "<br>next handover " + esc2(String(dv.nextCompletion).slice(0, 10)) : "") + "</div></div></a>";
    }).join("") + extras + '<div class=note>This list re-orders itself every refresh — demand momentum and delivery proximity from the register decide, not an editor. Curate it from chat: “track &lt;project&gt;” / “untrack &lt;project&gt;”. ' + esc2(m.valueDisclaimer || "Project values are MEED estimates in US$; progress is editorial, not measured.") + "</div></div>";
  }

  // ── SUPPLY CORPUS — MEED daily collector ──
  if (m.byStage) {
    body += '<a class="card clk" href="/map?m=su&key=' + eKey + '">' + najH2("buildings", esc2(m.country || "UAE") + " supply pipeline by stage") + stageRows + "</a>";
    if (m.recentBigUpdates && m.recentBigUpdates.length) body += '<div class=card>' + najH2("file", 'Recently updated · ≥ $50m') + projRows(m.recentBigUpdates) + '<div class=note>Tap a project to copy its “track” command for Azimuth.</div></div>';
    if (m.largestUnderConstruction && m.largestUnderConstruction.length) body += '<div class=card>' + najH2("crane", 'Largest under construction') + projRows((m.largestUnderConstruction || []).slice(0, 8)) + '<div class=note>Tap a project to copy its “track” command for Azimuth.</div></div>';
  }

  const chips = '<div class=chips>' +
    (t ? '<span class=chip>' + esc2(String(t.periodFrom || "")) + ' → ' + esc2(String(t.periodTo || "")) + '</span>' : '') +
    '<span class=chip>DLD · refreshed ' + esc2(String(d.generatedAt || "").slice(0, 10)) + '</span>' +
    (m.corpusVersion ? '<span class=chip>MEED corpus v' + esc2(m.corpusVersion) + ' · fixed snapshot</span>' : '') +
    '<span class="chip g">register-grounded ✓</span></div>';
  return '<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Najma</title>' +
    '<meta name=theme-color content="#0C1413"><meta name=apple-mobile-web-app-capable content=yes><meta name=apple-mobile-web-app-status-bar-style content=black-translucent><meta name=apple-mobile-web-app-title content=Najma>' +
    '<link rel=manifest href="/manifest.webmanifest?key=' + encodeURIComponent(key || "") + '"><link rel=icon href=/naj_icon.svg>' +
    '<meta property=og:title content="Najma — the Dubai market pulse"><meta property=og:description content="Register-grounded Dubai property figures — settled, not asking."><meta property=og:image content="' + (origin || "") + '/img/heatmap_square">' +
    NAJ_FONTS + '<style>' +
    ":root{--ink:#0C1413;--card:#131F1D;--card2:#182823;--line:#24352F;--text:#E8E4D8;--mut:#8FA39B;--gold:#C5A56A;--teal:#3E8A7E;--amber:#D9A441}" +
    'body{font-family:"IBM Plex Sans",system-ui,sans-serif;background:var(--ink);color:var(--text);margin:auto;padding:0 12px 88px;max-width:460px}' +
    '.phead{margin:0 -12px 12px;padding:44px 16px 14px;background:linear-gradient(180deg,rgba(12,20,19,.18) 0%,rgba(12,20,19,.42) 40%,rgba(12,20,19,.86) 78%,#0C1413 98%),url(/img/bg_market) center 38%/cover no-repeat}' +
    '.mast{font-family:Fraunces,Georgia,serif;font-size:2.05rem;font-weight:600;letter-spacing:-.01em}.mast em{font-style:normal;color:var(--gold)}' +
    ".sub{color:var(--mut);font-size:.8rem;margin:.25rem 0 .75rem}" +
    '.chips{display:flex;flex-wrap:wrap;gap:6px}.chip{font-family:"IBM Plex Mono",monospace;font-size:.6rem;letter-spacing:.03em;border:1px solid var(--line);background:rgba(19,31,29,.78);border-radius:99px;padding:4px 9px;color:var(--text)}.chip.g{color:var(--gold);border-color:rgba(197,165,106,.55)}' +
    "a.hero{display:block;text-decoration:none;color:inherit;background:var(--card2);border:1px solid var(--line);border-radius:10px;padding:14px;margin-bottom:10px;-webkit-tap-highlight-color:transparent}a.hero:active{opacity:.82}" +
    ".hgo{color:var(--gold);font-size:.74rem;font-weight:600;margin-top:7px}" +
    '.hv{font-family:Fraunces,Georgia,serif;font-size:2.1rem;font-weight:600;color:var(--gold);font-variant-numeric:tabular-nums}.hv small{font-size:1rem;color:var(--mut);font-family:"IBM Plex Sans",sans-serif}.hl{color:var(--mut);font-size:.75rem;margin-top:2px}' +
    ".grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}" +
    '.st{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px}.st .v{font-family:Fraunces,Georgia,serif;font-size:1.4rem;font-weight:600;font-variant-numeric:tabular-nums}.st .v small{font-size:.8rem;color:var(--mut);font-family:"IBM Plex Sans",sans-serif}.st .l{color:var(--mut);font-size:.72rem;margin-top:2px}' +
    'a.st{display:block;text-decoration:none;color:inherit;-webkit-tap-highlight-color:transparent}a.st:active{opacity:.82}' +
    ".card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:13px;margin-bottom:10px}" +
    'a.card{display:block;text-decoration:none;color:inherit;-webkit-tap-highlight-color:transparent}a.card:active{opacity:.82}.clk h2::after{content:"›";margin-left:auto;color:var(--gold);font-size:.9rem}' +
    "h2{display:flex;align-items:center;gap:7px;font-size:.68rem;letter-spacing:.14em;color:var(--gold);text-transform:uppercase;margin:0 0 .6rem;font-weight:600}" +
    ".ih{display:inline-flex;flex:none}.ih svg{width:15px;height:15px;color:var(--gold)}" +
    ".bar{display:flex;height:10px;border-radius:5px;overflow:hidden;background:var(--card2)}.bar i{display:block;height:100%}" +
    ".lg{display:flex;justify-content:space-between;color:var(--mut);font-size:.75rem;margin-top:5px}.lg b{color:var(--text)}" +
    ".spark{display:flex;align-items:flex-end;gap:4px}.wk{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px}.wk i{display:block;width:100%;background:var(--teal);border-radius:2px 2px 0 0}.wk span{font-size:.58rem;color:var(--mut)}" +
    ".arow{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #182823;text-decoration:none;color:inherit;-webkit-tap-highlight-color:transparent}.arow:last-of-type{border-bottom:none}a.arow:active{background:#182823}.nm{flex:0 0 44%;font-size:.8rem}.tr{flex:1;height:6px;border-radius:3px;background:var(--card2);overflow:hidden}.tr i{display:block;height:100%;background:var(--teal)}.ct{font-size:.72rem;color:var(--mut);min-width:40px;text-align:right;font-variant-numeric:tabular-nums}.chv{color:var(--gold);font-size:.95rem;line-height:1}" +
    NAJ_NAV_CSS +
    'a.dev{display:block;text-decoration:none;color:inherit;-webkit-tap-highlight-color:transparent;overflow:hidden}a.dev:active{opacity:.85}' +
    '.devimg{display:block;width:calc(100% + 20px);height:112px;object-fit:cover;border-radius:8px 8px 0 0;margin:-10px -10px 9px}' +
    '.prow[data-track]{cursor:pointer;-webkit-tap-highlight-color:transparent}.prow[data-track]:active{background:#182823}.trk{color:var(--gold);font-size:.68rem}' +
    ".dev{border:1px solid var(--line);border-radius:8px;background:var(--card2);padding:10px;margin-bottom:8px}.devh{display:flex;justify-content:space-between;gap:8px;align-items:baseline}.devh b{font-family:Fraunces,Georgia,serif;font-weight:600}.devg{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:6px;font-size:.78rem}.k{font-size:.6rem;letter-spacing:.1em;color:var(--mut)}.why{color:var(--gold);font-size:.64rem;font-family:\'IBM Plex Mono\',monospace;letter-spacing:.03em;margin-top:4px}" +
    ".note{color:var(--mut);font-size:.72rem;margin-top:.5rem}.pv{font-size:.72rem;color:var(--mut)}" +
    '.srow{display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-bottom:1px solid #182823;font-size:.8rem}.srow:last-child{border-bottom:none}.srow .sv{color:var(--mut);white-space:nowrap;font-variant-numeric:tabular-nums}' +
    '.prow{padding:6px 0;border-bottom:1px solid #182823;font-size:.82rem}.prow:last-child{border-bottom:none}.prow .pm{display:flex;justify-content:space-between;gap:8px;color:var(--mut);font-size:.72rem;margin-top:2px}' +
    ".warn{background:#33270F;color:var(--amber);border:1px solid #4A3B1E;padding:.5rem .7rem;border-radius:.5rem;font-size:.78rem;margin:.6rem 0}" +
    "</style></head><body>" +
    '<div class=phead><div class=mast>Najma <em>نجمة</em></div><div class=sub>The market pulse — Dubai property from the official register.</div>' + chips + '</div>' +
    (stale ? "<div class=warn>⚠️ Data is " + Math.round(ageDays) + " days old — collector may be down. Do not quote until refreshed.</div>" : "") +
    body +
    '<div class=pv style="margin-top:1rem;line-height:1.6">' +
    (t ? "Source: Dubai Land Department (DLD) Open Data. Contains information from the Government of Dubai.<br>" : "") +
    "Project data licensed from MEED Projects (GlobalData), served via Digital Abbot Cloud" + (m.corpusVersion ? " — corpus v" + esc2(m.corpusVersion) : "") + ".<br>" +
    "Every source passes a fail-closed sanity gate; a failing source is quarantined, never averaged in. Refreshed " + esc2(String(d.generatedAt || "").slice(0, 16)) + "Z." +
    "</div>" + najNav(key, "pulse") +
    '<div id=mtoast style="position:fixed;left:50%;bottom:74px;transform:translateX(-50%) translateY(90px);background:#C5A56A;color:#0C1413;font-size:.78rem;font-weight:600;padding:9px 16px;border-radius:99px;transition:transform .25s;z-index:99;max-width:88vw"></div>' +
    '<script>document.addEventListener("click",function(e){var r=e.target.closest?e.target.closest("[data-track]"):null;if(!r)return;var cmd="track "+r.getAttribute("data-track");function t(m){var el=document.getElementById("mtoast");el.textContent=m;el.style.transform="translateX(-50%) translateY(0)";setTimeout(function(){el.style.transform="translateX(-50%) translateY(90px)"},2200)}(navigator.clipboard?navigator.clipboard.writeText(cmd):Promise.reject()).then(function(){t("Copied \\u201c"+cmd+"\\u201d \\u2014 paste it to Azimuth")},function(){t(cmd)})});</script>' +
    "</body></html>";
}
async function marketBriefTick(env, force) {
  if ((env.MARKET_BRIEF || "") !== "on") return;                                   // opt-in per instance
  const n = gstNow();
  if (!force && n.getUTCHours() !== 9) return;                                     // 09:00 + 09:30 GST cron ticks both eligible
  const isSunday = force ? true : n.getUTCDay() === 0;                             // Sunday = full roundup; force = full roundup now
  const bk = "mktbrief_" + gstDateStr(n);
  let briefAttempts = 0;
  if (!force) {                                                                    // v56 — marker records SUCCESS, not attempt (same silent-morning fix as the feed)
    const bv = await env.MEETINGS.get(bk);
    if (bv === "done") return;
    briefAttempts = parseInt(bv, 10) || 0;
    if (briefAttempts >= 2) return;
    await env.MEETINGS.put(bk, String(briefAttempts + 1), { expirationTtl: 3 * 86400 });
  }
  const raw = await env.MEETINGS.get("mkt_latest");
  if (!raw) return;
  let d; try { d = JSON.parse(raw); } catch (e) { return; }
  const ageDays = (Date.now() - Date.parse(d.generatedAt || 0)) / 86400000;
  if (!(ageDays < 4)) { if (isSunday) { try { await waSend(env, env.WA_ALLOWED, "Market brief skipped this week — the data feed is " + Math.round(ageDays) + " days old and I will not brief from stale numbers. The collector needs attention."); } catch (e) {} } return; }
  const m = d.meed || {};
  const _nzb = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  let wl = {}; try { wl = JSON.parse((await env.MEETINGS.get("mkt_watch")) || "{}") || {}; } catch (e) {}
  const devsForBrief = (m.developments || []).filter(x => !(wl.del || []).includes(_nzb(x.development)));
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
    developments: devsForBrief.map(x => ({ development: x.development, developer: x.developer, activeProjects: x.activeProjects, pipelineValueUsdM: x.pipelineValueUsdM, nextCompletion: x.nextCompletion, dldPulse: x.dldPulse })),
    supply: { source: m.source, corpusVersion: m.corpusVersion, country: m.country, byStage: m.byStage, recentBigUpdates: m.recentBigUpdates, largestUnderConstruction: (m.largestUnderConstruction || []).slice(0, 5), gccTotals: m.gcc && m.gcc.totals, byCountry: m.gcc && m.gcc.byCountry } });
  let brief = null, briefErr = null;
  try { brief = await claudeText(env, sys, user, null, 900); } catch (e) { briefErr = e && e.message ? e.message : String(e); }
  if (!brief) {
    try { await env.MEETINGS.put("mkt_brief_err", JSON.stringify({ at: gstNowIso(), attempts: briefAttempts + 1, err: briefErr || "empty brief" }), { expirationTtl: 7 * 86400 }); } catch (e) {}
    if (!force && briefAttempts + 1 >= 2 && isSunday) { try { await waSend(env, env.WA_ALLOWED, "🕐 Morning — this week's brief didn't come together on my side (twice, so I'm telling you rather than staying quiet). Say “market brief” anytime and I'll run it fresh."); } catch (e) {} }
    return;
  }
  const hasDld = !!d.transactions;
  const head = (isSunday ? (hasDld ? "🕐 Najma weekly — the pulse is in" : "🏗️ Weekly Market Pulse — supply side") : "🏗️ Market movement — supply side") + " (" + String(d.generatedAt || "").slice(0, 10) + ")\n\n";
  let radarLine = "";                                                              // v52 — one register-picked candidate she can adopt with a reply
  if (isSunday) {
    try {
      const cand = (m.recentBigUpdates || []).find(r => r.title && !devsForBrief.some(x => _nzb(x.development) === _nzb(r.title)) && !(wl.add || []).some(a => _nzb(a.name) === _nzb(r.title)) && !(wl.del || []).includes(_nzb(r.title)));
      if (cand) radarLine = "\n\n📡 Radar candidate: " + cand.title + " — " + (cand.stage || "on the register") + (cand.valueUsdM ? ", $" + cand.valueUsdM + "m" : "") + ". Reply “track " + cand.title + "” to watch it.";
    } catch (e) {}
  }
  let briefSent = false;
  try { await waSend(env, env.WA_ALLOWED, head + brief + radarLine); briefSent = true; } catch (e) {}
  if (briefSent && !force) { try { await env.MEETINGS.put(bk, "done", { expirationTtl: 3 * 86400 }); } catch (e) {} }
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
    : kind === "art"
    ? "You write a LinkedIn ARTICLE (long-form thought-leadership) for Najjuko, a Dubai property broker, from ONE angle of the provided brief. Structure, plain text: a strong HEADLINE on the first line; then 600-900 words in short paragraphs with 2-3 bold subheadings; open with a scene or a sharp observation, build the argument around the provided figures (every figure carries its source and period exactly as given), give the reader something genuinely useful they can act on, and close with a forward-looking line and one question. Warm, credible, construction-literate, no hype, first person as Naj. Use ONLY figures from the provided brief and data — never invent or sharpen a number. At most 3 hashtags at the very end."
    : kind === "car"
    ? "You write a LinkedIn CAROUSEL (a swipeable document) for Najjuko, a Dubai property broker, from ONE angle of the provided brief. 6 slides. Output EXACTLY this structure, plain text, each slide 1-2 short lines only (carousels are visual — few words per slide): 'SLIDE 1 — COVER: <a bold hook that makes them stop scrolling>'. 'SLIDE 2 — THE NUMBER: <the single headline figure, big and clear> / <its source and period>'. 'SLIDE 3 — CONTEXT: <one line on what settled vs asking, or the trend>'. 'SLIDE 4 — WHAT IT MEANS: <one line for a buyer>'. 'SLIDE 5 — THE CATCH: <the what-not-to-claim / the honest caveat>'. 'SLIDE 6 — CTA: <invite to DM her for the full picture>'. Then after the slides, a line 'CAPTION:' with a 2-3 line post caption + at most 3 hashtags. Use ONLY figures from the provided brief and data — never invent or sharpen a number."
    : "You write a LinkedIn post for Najjuko, a Dubai property broker. First line is the angle's hook — specific, no clickbait. Short paragraphs. Use ONLY figures from the provided brief and data; every figure carries its source and period. One practical buyer takeaway. End with one question inviting comments. At most 3 hashtags. Under 140 words, plain text.";
  await dnaSignal(env, "drafted_" + kind, "angle " + n);
  const dna = await dnaGet(env);
  const user2 = "DRAFT FROM ANGLE " + n + " of this brief.\n\nTHE BRIEF:\n" + ctx.brief + "\n\nTHE FIGURES (the only numbers you may use):\n" + ctx.data +
    (dna ? "\n\nHER DNA PROFILE (learned from her own choices — write in HER style, favour HER framings):\n" + dna : "");
  let out = null;
  try { out = await claudeText(env, sys, user2, null, 900); } catch (e) {}
  if (!out) { await waSend(env, to, "Couldn't draft that just now — try again in a minute."); return; }
  const label = kind === "pod" ? "🎙 Podcast script" : kind === "ig" ? "📸 Instagram package" : kind === "car" ? "🎠 LinkedIn carousel" : kind === "art" ? "📝 LinkedIn article" : "✍️ LinkedIn post";
  await waSend(env, to, label + " — Angle " + n + "\n\n" + out + "\n\n— a draft to make your own.");
  if (kind === "li") await waSend(env, to, "✍️ Copy this straight into LinkedIn. Want a different angle? Say “draft linkedin 3”.");
  if (kind === "art") await waSend(env, to, "📝 Paste this into LinkedIn → “Write article”. Add a cover image with the prompt below.");
  if (kind === "car") await waSend(env, to, "🎠 Build these 6 slides in Canva (or PowerPoint → save as PDF), then upload the PDF to LinkedIn as a *document* — it becomes a swipeable carousel. Use the image prompt below for the look; paste the CAPTION as the post text.");
  if (kind === "ig") {                                                             // v38 — stash the caption; her next "post to instagram" image publishes with it
    const capM = out.match(/CAPTION:\s*([\s\S]+)$/i);
    await env.MEETINGS.put("mkt_lastdraft_ig", (capM ? capM[1] : out).trim().slice(0, 2100), { expirationTtl: 2 * 86400 });
    await waSend(env, to, "🎬 For a reel: record the script (30-45s, phone vertical). For an image post: generate the visual with the prompt below, then send it back to me captioned “post to instagram” — I'll publish it with this caption.");
  }
}

// v38 — publish an image to her Instagram via the official API: container -> poll -> publish.
async function publishInstagram(env, to, imageUrl) {
  let auth = null; try { auth = JSON.parse((await env.MEETINGS.get("ig_auth")) || "null"); } catch (e) {}
  if (!env.IG_APP_ID) { await waSend(env, to, "🔌 Instagram posting isn't switched on yet — the app link-up on DigitAlchemy's side is in progress."); return; }
  if (!auth || !auth.token || (auth.expiresAt && Date.now() > auth.expiresAt)) {
    await waSend(env, to, "🔗 Instagram needs a (re)connect — one tap and a sign-in:\n" + LI_ORIGIN(env) + "/ig_connect?key=" + env.READ_KEY + "\n\nYour image is saved; send it again after connecting.");
    return;
  }
  const caption = (await env.MEETINGS.get("mkt_lastdraft_ig")) || "";
  try {
    const cr = await (await fetch("https://graph.instagram.com/v21.0/" + auth.userId + "/media", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ image_url: imageUrl, caption, access_token: auth.token }),
    })).json();
    if (!cr.id) { await waSend(env, to, "⚠ Instagram didn't accept the image — " + JSON.stringify(cr).slice(0, 160)); return; }
    let status = "IN_PROGRESS";
    for (let i = 0; i < 6 && status === "IN_PROGRESS"; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const sj = await (await fetch("https://graph.instagram.com/v21.0/" + cr.id + "?fields=status_code&access_token=" + encodeURIComponent(auth.token))).json();
      status = sj.status_code || "FINISHED";
    }
    const pj = await (await fetch("https://graph.instagram.com/v21.0/" + auth.userId + "/media_publish", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ creation_id: cr.id, access_token: auth.token }),
    })).json();
    if (pj.id) await waSend(env, to, "📸 Posted to Instagram." + (caption ? "" : " (No caption draft was on file — it went up caption-less.)"));
    else await waSend(env, to, "⚠ Publish step failed — " + JSON.stringify(pj).slice(0, 160) + ". The image is still saved; try again in a minute.");
  } catch (e) {
    await waSend(env, to, "⚠ Couldn't reach Instagram — try again in a minute.");
  }
}

// v36.6 — publish the stored LinkedIn draft DIRECTLY via LinkedIn's own free API.
// Fires ONLY from Naj's explicit button tap. Auth: the worker runs its own OAuth flow
// (/li_connect -> LinkedIn consent -> /li_callback stores the member token in KV, ~60 days).
// No third-party posting service, no subscription.
const LI_ORIGIN = (env2) => "https://azimuth-2.digitalchemy.workers.dev";
async function publishDraft(env, to) {
  const draft = await env.MEETINGS.get("mkt_lastdraft_li");
  if (!draft) { await waSend(env, to, "That draft expired — ask for a fresh one (“draft linkedin 1”)."); return; }
  if (!env.LI_CLIENT_ID || !env.LI_CLIENT_SECRET) {
    await waSend(env, to, "🔌 Direct posting isn't switched on yet — a free one-time setup on DigitAlchemy's side. Until then: copy the draft above and paste it into LinkedIn — 20 seconds. You'll get a “connect LinkedIn” link here the moment it's ready.");
    return;
  }
  let auth = null; try { auth = JSON.parse((await env.MEETINGS.get("li_auth")) || "null"); } catch (e) {}
  if (!auth || !auth.token || (auth.expiresAt && Date.now() > auth.expiresAt)) {
    await waSend(env, to, "🔗 LinkedIn needs a (re)connect — it's one tap and a sign-in, then posting works for ~2 months:\n" + LI_ORIGIN(env) + "/li_connect?key=" + env.READ_KEY + "\n\nYour draft is saved; tap Post again after connecting.");
    return;
  }
  try {
    const r = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + auth.token, "X-Restli-Protocol-Version": "2.0.0" },
      body: JSON.stringify({
        author: "urn:li:person:" + auth.sub,
        lifecycleState: "PUBLISHED",
        specificContent: { "com.linkedin.ugc.ShareContent": { shareCommentary: { text: draft }, shareMediaCategory: "NONE" } },
        visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
      }),
    });
    if (r.status === 401) {
      await waSend(env, to, "🔗 LinkedIn signed the connection out — reconnect (one tap + sign-in):\n" + LI_ORIGIN(env) + "/li_connect?key=" + env.READ_KEY + "\n\nYour draft is saved; tap Post again after.");
      return;
    }
    if (r.ok || r.status === 201) {
      const pid = r.headers.get("x-restli-id") || "";
      await env.MEETINGS.delete("mkt_lastdraft_li");
      await waSend(env, to, "🚀 Posted to LinkedIn." + (pid ? "\nhttps://www.linkedin.com/feed/update/" + pid : ""));
    } else {
      let msg = ""; try { const j = await r.json(); msg = (j && j.message) || ""; } catch (e) {}
      await waSend(env, to, "⚠ LinkedIn didn't accept the post — " + (msg || ("status " + r.status)) + ". The draft is still saved; try again in a minute.");
    }
  } catch (e) {
    await waSend(env, to, "⚠ Couldn't reach LinkedIn — the draft is still saved; try again in a minute.");
  }
}

// ── v37 — NAJMA DAILY FEED ──────────────────────────────────────────────────────
// Every morning ~07:00 GST: three post-ready angles from the freshest gated data.
// Tap one -> Instagram package + LinkedIn package (with one-tap post) + a complete,
// self-contained image-generation prompt in BOTH ratios (9:16 story + 16:9 landscape).
// Total intended time from wake-up to posted: under five minutes.
const FEED_SCHEMA = { type: "object", additionalProperties: false, properties: { angles: { type: "array", items: { type: "object", additionalProperties: false, properties: { hook: { type: "string" }, figure: { type: "string" }, source: { type: "string" }, buyer: { type: "string" } }, required: ["hook", "figure", "source", "buyer"] } } }, required: ["angles"] };
// v76 — campaign angles add one line on what to film / which supplied asset to cut from
const CAMPAIGN_SCHEMA = { type: "object", additionalProperties: false, properties: { angles: { type: "array", items: { type: "object", additionalProperties: false, properties: { hook: { type: "string" }, figure: { type: "string" }, source: { type: "string" }, buyer: { type: "string" }, shot: { type: "string" } }, required: ["hook", "figure", "source", "buyer", "shot"] } } }, required: ["angles"] };

async function dailyFeedTick(env, force, dry) {
  if ((env.MARKET_BRIEF || "") !== "on") return;
  const n = gstNow();
  if (!force && n.getUTCHours() !== 7) return;                                    // 07:00 + 07:30 GST cron ticks both eligible
  const fk = "mktfeed_" + gstDateStr(n);
  let attempts = 0;
  if (!force) {                                                                    // v56 — marker records SUCCESS, not attempt: a failed
    const fv = await env.MEETINGS.get(fk);                                         // generation no longer silently eats the whole morning
    if (fv === "done") return;
    attempts = parseInt(fv, 10) || 0;
    if (attempts >= 2) return;
    await env.MEETINGS.put(fk, String(attempts + 1), { expirationTtl: 2 * 86400 });
  }
  const raw = await env.MEETINGS.get("mkt_latest");
  if (!raw) return;
  let d; try { d = JSON.parse(raw); } catch (e) { return; }
  const ageDays = (Date.now() - Date.parse(d.generatedAt || 0)) / 86400000;
  if (ageDays >= 8) {                                                              // stale gate + the refresh reminder
    await waSend(env, env.WA_ALLOWED, "☀️ Morning — no feed today: the market data is " + Math.round(ageDays) + " days old and I won't hand you a stale figure to say out loud. The refresh needs running on DigitAlchemy's side — I've flagged it. Your board and tasks are unaffected.");
    return;
  }
  // recent-angle memory so mornings don't repeat themselves
  let hist = []; try { hist = JSON.parse((await env.MEETINGS.get("mkt_feed_hist")) || "[]"); } catch (e) {}
  // v39 — taste memory: the angles she actually CHOSE recently bias today's five
  let picks = []; try { picks = JSON.parse((await env.MEETINGS.get("mkt_picks")) || "[]"); } catch (e) {}
  const m = d.meed || {};

  // v37.3 — TREND DELTAS, computed here so every delta is exact and quotable.
  // The final week/month in each series is partial (registration lags) — compare the
  // last two COMPLETE periods only.
  const trends = [];
  try {
    const wk = (d.transactions && d.transactions.weekly) || [];
    if (wk.length >= 3) {
      const a = wk[wk.length - 3], b = wk[wk.length - 2];
      if (a.sales) trends.push({ metric: "weekly sales count", from: a.week, to: b.week, change: b.sales - a.sales, changePct: Math.round(1000 * (b.sales - a.sales) / a.sales) / 10, values: [a.sales, b.sales], source: "DLD Open Data, registered sales by week" });
      if (a.valueAedBn) trends.push({ metric: "weekly sales value (AED bn)", from: a.week, to: b.week, change: Math.round(100 * (b.valueAedBn - a.valueAedBn)) / 100, changePct: Math.round(1000 * (b.valueAedBn - a.valueAedBn) / a.valueAedBn) / 10, values: [a.valueAedBn, b.valueAedBn], source: "DLD Open Data, registered sales by week" });
    }
    const mo2 = (d.monthly && d.monthly.series) || [];
    if (mo2.length >= 3) {
      const a = mo2[mo2.length - 3], b = mo2[mo2.length - 2];
      if (a.sales) trends.push({ metric: "monthly sales count", from: a.month, to: b.month, change: b.sales - a.sales, changePct: Math.round(1000 * (b.sales - a.sales) / a.sales) / 10, values: [a.sales, b.sales], source: "DLD Open Data, registered sales by month" });
      if (a.valueAedBn) trends.push({ metric: "monthly sales value (AED bn)", from: a.month, to: b.month, change: Math.round(100 * (b.valueAedBn - a.valueAedBn)) / 100, changePct: Math.round(1000 * (b.valueAedBn - a.valueAedBn) / a.valueAedBn) / 10, values: [a.valueAedBn, b.valueAedBn], source: "DLD Open Data, registered sales by month" });
      const peak = mo2.slice(0, -1).reduce((x, y) => (y.valueAedBn > x.valueAedBn ? y : x), mo2[0]);
      trends.push({ metric: "year shape", note: "strongest complete month so far: " + peak.month + " at AED " + peak.valueAedBn + "bn", source: "DLD Open Data, monthly" });
    }
    if (d.transactions && d.transactions.topAreas && d.transactions.topAreas[0] && d.transactions.salesCount) {
      const ta = d.transactions.topAreas[0];
      trends.push({ metric: "area concentration", note: ta.area + " alone took " + Math.round(100 * ta.sales / d.transactions.salesCount) + "% of all sales this period (" + ta.sales + " of " + d.transactions.salesCount + ")", source: "DLD Open Data, " + (d.transactions.periodFrom || "") + " to " + (d.transactions.periodTo || "") });
    }
  } catch (e) {}

  // v37.3 — DAILY RANDOMIZER: two required lenses rotate every morning so the mix
  // never settles into a pattern. The no-repeat history handles exact hooks; this
  // handles the shape of the day.
  const LENSES = ["register price/volume trend (use the computed trends)", "rental yields and the rent register",
    "one area spotlight (top-areas or yields by area)", "handover watch (what's completing, when)",
    "news-led with corpus cross-reference", "off-plan vs ready split", "the year-to-date arc month by month",
    "one tracked development, demand vs delivery"];
  const pick = () => LENSES[Math.floor(Math.random() * LENSES.length)];
  let lensA = pick(), lensB = pick();
  while (lensB === lensA) lensB = pick();
  const data = JSON.stringify({
    dldSales: d.transactions ? { period: [d.transactions.periodFrom, d.transactions.periodTo], salesCount: d.transactions.salesCount, salesValueAedBn: d.transactions.salesValueAedBn, medianTicketAed: d.transactions.medianTicketAed, medianResidentialAedSqft: d.transactions.medianResidentialAedSqft, offPlanSplit: d.transactions.offPlanSplit, topAreas: (d.transactions.topAreas || []).slice(0, 8), weekly: d.transactions.weekly } : null,
    monthly: d.monthly || null,
    rents: d.rents ? { registrationTo: d.rents.registrationTo, contractsCount: d.rents.contractsCount, medianAnnualRentAed: d.rents.medianAnnualRentAed, medianRentAedSqftYr: d.rents.medianRentAedSqftYr, grossYieldPctByArea: d.rents.grossYieldPctByArea, versionSplit: d.rents.versionSplit } : null,
    handover: d.handover ? { meedByQuarter: d.handover.meedByQuarter } : null,
    developments: (m.developments || []).map(x => ({ development: x.development, developer: x.developer, activeProjects: x.activeProjects, pipelineValueUsdM: x.pipelineValueUsdM, nextCompletion: x.nextCompletion, dldPulse: x.dldPulse })),
    supply: m.byStage ? { byStage: m.byStage, recentBigUpdates: m.recentBigUpdates, largestUnderConstruction: (m.largestUnderConstruction || []).slice(0, 5) } : null,
    trends,
    news: await (async () => { try { const nn = JSON.parse((await env.MEETINGS.get("mkt_news")) || "[]"); return nn.slice(0, 8).map(x => ({ title: x.title, outlet: x.outlet, meedCrossReference: x.xref ? { project: x.xref.meedName, facts: x.xref.facts } : null })); } catch (e) { return null; } })(),
  });
  const sys = "You pick FIVE distinct, post-worthy story angles for a Dubai property broker's daily social content, from the data provided. Use ONLY the figures provided — never invent or sharpen a number. Each angle: hook = one arresting spoken sentence built around ONE specific figure; figure = that exact figure verbatim; source = its source and period exactly as given (e.g. 'DLD Open Data, 30 Jun-25 Aug'); buyer = one line on what it means for a buyer. The five angles must cover DIFFERENT figures and span different sections. AT LEAST TWO of the five must come from the Dubai Land Department register data (dldSales, monthly, rents, trends) — the register is a primary story source, and its `trends` entries are precomputed movement deltas that make the strongest hooks (quote them exactly, direction and all). TODAY'S REQUIRED EMPHASES (at least one angle each): (A) " + lensA + "; (B) " + lensB + ". HER TASTE: these are angles she personally chose to post on recent mornings — bias the five toward similar subjects and styles WITHOUT repeating any hook: " + JSON.stringify(picks.slice(0, 8).map(p => p.hook)) + ". HER DNA PROFILE (learned from her choices — honour it): " + ((await dnaGet(env)) || "(still learning)") + ". NEWS RULES: news items may anchor at most TWO of the five angles; name the outlet in the source (e.g. 'reported by Khaleej Times'); if an item carries meedCrossReference, weave those corpus facts in as the second layer of the story (stage, value, completion — source 'MEED Projects corpus') — that cross-reference IS the angle's strength; a news item with no figures and no cross-reference is context only, never the hook. DO NOT reuse any of these recent hooks: " + JSON.stringify(hist.slice(0, 12)) + ". Return JSON only.";
  let g = null, genErr = null;
  try { g = await claudeJSON(env, sys, data, FEED_SCHEMA, null, 1400); } catch (e) { genErr = e && e.message ? e.message : String(e); }
  const angles = g && Array.isArray(g.angles) ? g.angles.slice(0, 5) : [];
  if (angles.length < 3) {
    try { await env.MEETINGS.put("mkt_feed_err", JSON.stringify({ at: gstNowIso(), attempts: attempts + 1, err: genErr || ("angles=" + angles.length) }), { expirationTtl: 7 * 86400 }); } catch (e) {}
    if (dry) return "GENERATION FAILED: " + (genErr || ("only " + angles.length + " angles"));
    if (force) await waSend(env, env.WA_ALLOWED, "Couldn't build this morning's angles — try “feed” again in a minute.");
    else if (attempts + 1 >= 2) await waSend(env, env.WA_ALLOWED, "☀️ Morning — today's angles didn't come together on my side (twice, so I'm telling you rather than staying quiet). Say “feed” anytime and I'll build them fresh.");
    return;
  }
  // v76 — CAMPAIGN TRACK: while a campaign pack is live (Emaar District Ambassador, The Valley, closes 15 Sep 2026) the morning
  // carries TWO extra angles for it, written ONLY from the pack's evidence and bound by the pack's guardrails (no capital-
  // appreciation claim, sales-only rates, hashtag + tag, permit still open). They sit after the five market angles.
  let camp = null; try { camp = JSON.parse((await env.MEETINGS.get("img_valley_pack")) || "null"); } catch (e) {}
  if (camp && camp.contest && gstDateStr(n) <= camp.contest.closes) {
    const csys = "You write TWO post angles a day for a Dubai broker competing in a developer's video contest. She wins on things NOBODY ELSE CAN SAY. " +
      "Every angle MUST be built on one item from pack.edges — facts that exist only because she reads the official registers — and must be one a competitor working from the brochure could not write. " +
      "If a developer's marketing page could plausibly say it, discard it and take a different edge. Never write a stat read-out: choose a form from pack.creative_modes and write the angle inside it. " +
      "OBEY EVERY LINE of pack.guardrails and pack.creative_rules; accuracy and brand compliance are two of the four judged criteria. Use ONLY the pack's figures, exactly as given, one number per angle. " +
      "Make the two angles different in kind: one human (a person, a room, a walk, a question), one from the register (money, supply, yield, velocity). " +
      "Each angle: hook = the first sentence she says to camera, specific and arresting, with no adjectives such as stunning, vibrant, nestled or oasis; figure = the one exact number with its unit; " +
      "source = the register or document it comes from; buyer = who it speaks to; shot = one line she can film this week on a phone, or the exact cut to take from the two supplied films. Return JSON only.";
    const cdata = JSON.stringify({ pack: camp, daysLeft: Math.max(0, Math.round((Date.parse(camp.contest.closes) - Date.parse(gstDateStr(n))) / 86400000)), avoidHooks: hist.slice(0, 12) });
    let cg = null; try { cg = await claudeJSON(env, csys, cdata, CAMPAIGN_SCHEMA, null, 900); } catch (e) {}
    const cangles = cg && Array.isArray(cg.angles) ? cg.angles.slice(0, 2).map(a => Object.assign({}, a, { campaign: camp.contest.name })) : [];
    if (cangles.length) angles.push(...cangles);
  }
  if (dry) return angles.map((a, i) => (i + 1) + ". " + (a.campaign ? "[VALLEY] " : "") + a.hook + "\n   " + a.figure + " · " + a.source + (a.shot ? "\n   shot: " + a.shot : "")).join("\n");
  // store as the drafting context (draftFromAngle reads this) + remember the hooks
  const briefTxt = angles.map((a, i) => "ANGLE " + (i + 1) + ": " + a.hook + "\nFigure: " + a.figure + " (" + a.source + ")\nBuyer: " + a.buyer).join("\n\n");
  await env.MEETINGS.put("mkt_briefctx", JSON.stringify({ at: Date.now(), brief: briefTxt, data, angles }), { expirationTtl: 3 * 86400 });
  hist = angles.map(a => a.hook).concat(hist).slice(0, 24);
  await env.MEETINGS.put("mkt_feed_hist", JSON.stringify(hist), { expirationTtl: 30 * 86400 });
  const nCamp = angles.filter(a => a.campaign).length;
  const dLeft = camp && camp.contest ? Math.max(0, Math.round((Date.parse(camp.contest.closes) - Date.now()) / 86400000)) : 0;
  const bodyTxt = "☀️ *Najma daily — " + (angles.length === 5 ? "five" : String(angles.length)) + " you could post today*" +
    (nCamp ? "\n_the last " + (nCamp === 1 ? "one is" : String(nCamp) + " are") + " for the Valley contest · " + dLeft + " day" + (dLeft === 1 ? "" : "s") + " left_" : "") + "\n\n" +
    angles.map((a, i) => (i + 1) + "️⃣ " + (a.campaign ? "🏡 " : "") + a.hook + "\n     " + a.figure + " · " + a.source + (a.shot ? "\n     🎬 " + a.shot : "")).join("\n\n") +
    "\n\nPick one — you'll get the Instagram package, the LinkedIn post with one-tap publish, and the image prompt in both sizes.";
  await waSend(env, env.WA_ALLOWED, bodyTxt);
  await waSendList(env, env.WA_ALLOWED, "Today's pick:", "Choose an angle",
    angles.map((a, i) => ({ id: "feed:" + (i + 1), title: (i + 1) + "️⃣ " + (a.figure || "").slice(0, 20), description: a.hook })));
  if (!force) { try { await env.MEETINGS.put(fk, "done", { expirationTtl: 2 * 86400 }); } catch (e) {} }
}

// ── v39 — DNA: a self-learning profile of HER content identity ──────────────────
// Every interaction is a signal (angle picked, draft discarded, format requested,
// group watched). A nightly reflection distills the rolling signal log + the previous
// profile into a compact DNA document, which then shapes the morning five and every
// draft's voice. Transparent by design: she can read it any time with "dna".
async function dnaSignal(env, type, detail) {
  try {
    let s = JSON.parse((await env.MEETINGS.get("mkt_signals")) || "[]");
    s.unshift({ at: gstNowIso().slice(0, 16), type, detail: String(detail || "").slice(0, 160) });
    await env.MEETINGS.put("mkt_signals", JSON.stringify(s.slice(0, 80)), { expirationTtl: 90 * 86400 });
  } catch (e) {}
}

async function dnaGet(env) {
  try { const d = JSON.parse((await env.MEETINGS.get("mkt_dna")) || "null"); return (d && d.text) || ""; } catch (e) { return ""; }
}

async function dnaReflect(env, force) {
  const n = gstNow();
  if (!force && (n.getUTCHours() !== 20 || n.getUTCMinutes() >= 30)) return;       // nightly ~20:00 GST
  let s = []; try { s = JSON.parse((await env.MEETINGS.get("mkt_signals")) || "[]"); } catch (e) {}
  let cur = null; try { cur = JSON.parse((await env.MEETINGS.get("mkt_dna")) || "null"); } catch (e) {}
  const seenCount = (cur && cur.signalsSeen) || 0;
  if (!force && s.length - seenCount < 3) return;                                  // reflect only when there's something new
  let picks = []; try { picks = JSON.parse((await env.MEETINGS.get("mkt_picks")) || "[]"); } catch (e) {}
  const sys = "You maintain the compact working profile ('DNA') of one Dubai property broker's content identity, learned ONLY from her observed choices. Update the existing profile with the new signals — evolve it, don't rewrite from scratch; keep what still holds, sharpen what the new evidence supports, drop what it contradicts. Structure, plain text, UNDER 170 words total: SUBJECTS SHE FAVOURS (data themes/areas she picks) · STYLE (tone and framing her chosen hooks share) · FORMATS (what she drafts most: Instagram vs LinkedIn, image vs reel) · AVOIDS (what she skips or discards). Never invent traits with no signal behind them — write 'not yet known' where evidence is thin.";
  const user = "EXISTING PROFILE:\n" + ((cur && cur.text) || "(none yet)") +
    "\n\nANGLES SHE CHOSE (newest first):\n" + JSON.stringify(picks.slice(0, 15)) +
    "\n\nINTERACTION SIGNALS (newest first):\n" + JSON.stringify(s.slice(0, 40));
  let out = null;
  try { out = await claudeText(env, sys, user, null, 700); } catch (e) {}
  if (!out) return;
  await env.MEETINGS.put("mkt_dna", JSON.stringify({ text: out.trim().slice(0, 1400), updatedAt: gstNowIso(), signalsSeen: s.length }));
}

// ── v40 — CLIENT MATCH: budget + preferences -> register-grounded actionable intelligence ──
// The feature that sells property, not just followers. She texts a client brief; the Worker
// filters the per-area settled-price reality to where that budget REALISTICALLY buys, ranks it
// (by yield for investors, by fit for end-users), attaches matching MEED pipeline/handovers, and
// hands her sourced talking points for the meeting — settled prices, never asking prices.
const MATCH_SCHEMA = { type: "object", additionalProperties: false, properties: { budgetAed: { type: ["number", "null"] }, roomType: { type: "string" }, purpose: { type: "string" }, readyPref: { type: "string" }, areaHint: { type: "string" } }, required: ["budgetAed", "roomType", "purpose", "readyPref", "areaHint"] };

async function clientMatch(env, to, briefText) {
  let d = null; try { d = JSON.parse((await env.MEETINGS.get("mkt_latest")) || "null"); } catch (e) {}
  const ai = d && d.areaIntel && d.areaIntel.areas;
  if (!ai || !ai.length) { await waSend(env, to, "The area data isn't loaded yet — try again after the next refresh."); return; }

  const isys = "Extract a Dubai property buyer brief. roomType is one of: Studio, 1 B/R, 2 B/R, 3 B/R, 4 B/R, 5 B/R, villa, any. purpose: invest (yield/rental) | live (end-user) | any. readyPref: ready | off-plan | any. areaHint: an area name if the client named one, else empty. budgetAed: the number in AED (convert 'k'/'m'/'million'); null if none given. JSON only.";
  const intent = await claudeJSON(env, isys, briefText, MATCH_SCHEMA, null, 300);
  if (!intent) { await waSend(env, to, "Couldn't read that brief — try e.g. “client has 1.5M, wants a 1-bed for rental income”."); return; }
  const budget = intent.budgetAed, rt = (intent.roomType || "any"), purpose = (intent.purpose || "any"), ready = (intent.readyPref || "any");

  // score each area by how well the budget buys the requested room type
  const cand = [];
  for (const a of ai) {
    if (intent.areaHint && a.area.toLowerCase().indexOf(intent.areaHint.toLowerCase()) === -1) continue;
    const rr = (rt !== "any" && rt !== "villa") ? (a.byRoom && a.byRoom[rt]) : null;
    const med = rr ? rr.medianAed : a.medianTicketAed;
    if (!med) continue;
    if (rt !== "any" && rt !== "villa" && !rr) continue;                 // asked for a room type this area has no depth in
    let fit = 1;
    if (budget) {
      const lo = rr && rr.p25Aed ? rr.p25Aed * 0.9 : med * 0.75;
      const hi = rr && rr.p75Aed ? rr.p75Aed * 1.1 : med * 1.25;
      if (budget < lo * 0.85 || budget > hi * 1.3) continue;            // budget can't realistically buy here
      fit = 1 - Math.min(1, Math.abs(med - budget) / budget);
    }
    if (ready === "ready" && a.offPlanPct >= 80) continue;              // wants ready, area is overwhelmingly off-plan
    if (ready === "off-plan" && a.offPlanPct <= 20) continue;
    cand.push({ area: a.area, sales: a.sales, medianForType: med, medianAedSqft: a.medianAedSqft,
                offPlanPct: a.offPlanPct, grossYieldPct: a.grossYieldPct,
                netYieldPct: a.netYieldPct, serviceChargeAedSqftYr: a.serviceChargeAedSqftYr,
                serviceChargeIsEstimate: a.serviceChargeIsEstimate, roomType: rt, fit,
                p25: rr && rr.p25Aed, p75: rr && rr.p75Aed });
  }
  if (!cand.length) { await waSend(env, to, "Nothing in the register cleanly matches that brief — the budget may be below where that type transacts. Try a wider budget or “any” room type."); return; }

  // rank: investors by yield (known first), end-users by budget-fit then depth
  cand.sort((x, y) => {
    if (purpose === "invest") { const yx = (x.netYieldPct != null ? x.netYieldPct : x.grossYieldPct) || -1, yy = (y.netYieldPct != null ? y.netYieldPct : y.grossYieldPct) || -1; if (yx !== yy) return yy - yx; }
    if (x.fit !== y.fit) return y.fit - x.fit;
    return y.sales - x.sales;
  });
  const top = cand.slice(0, 5);

  // attach matching MEED pipeline/handovers + DLD incoming-supply by area name
  const devs = (d.meed && d.meed.developments) || [];
  const sba = (d.projects && d.projects.supplyByArea) || {};
  for (const c of top) {
    const hit = devs.find(dv => (dv.dldPulse && String(dv.location || "").toLowerCase().indexOf(c.area.toLowerCase()) !== -1) || (c.area.toLowerCase().indexOf((dv.development || "").toLowerCase()) !== -1));
    if (hit) c.pipeline = { development: hit.development, developer: hit.developer, nextCompletion: hit.nextCompletion, activeProjects: hit.activeProjects };
    for (const k of Object.keys(sba)) { if (k.toLowerCase() === c.area.toLowerCase()) { c.incomingSupply = { units: sba[k].units, projects: sba[k].projects, nextDelivery: sba[k].nextEnd }; break; } }
  }

  const period = d.transactions ? (d.transactions.periodFrom + " to " + d.transactions.periodTo) : "recent";
  const sys = "You are advising a Dubai property broker preparing for a client meeting. Turn the matched register data into a crisp, sourced briefing she can speak from. Use ONLY the numbers provided — never invent or round beyond the nearest thousand. Structure, plain text, under 240 words: open with one line restating the client's ask; then for each of up to 4 candidate areas a short block — area name, the settled median for the requested type (say 'settled, not asking'), price per sq ft, off-plan share, and — when purpose is investment — lead with NET yield and show the working ('gross X%, minus ~SC AED/sq ft service charge = net Y%'), because net is what the buyer actually earns; any pipeline/handover fact. If two areas have similar gross but different net, CALL THAT OUT — it's the insight no one else gives. If an area has incomingSupply, add one line — units registered to deliver there and by when — as rental-competition context (more supply can soften rents). Then a NEGOTIATION line: these are DLD-registered settled prices, portals show higher asking prices — that gap is her leverage. Then WHAT NOT TO CLAIM: service charges tagged 'estimate' are RERA-published community typicals not the specific building's Mollak figure (confirm per building); no yield claim where absent; transaction history, not a forecast. Tag price figures 'DLD Open Data, " + period + "'.";
  const user = JSON.stringify({ clientAsk: { budgetAed: budget, roomType: rt, purpose, readyPref: ready, areaHint: intent.areaHint || null }, candidates: top });
  let out = null;
  try { out = await claudeText(env, sys, user, null, 1100); } catch (e) {}
  if (!out) { await waSend(env, to, "Couldn't build the briefing just now — try again in a minute."); return; }
  await env.MEETINGS.put("mkt_lastmatch", JSON.stringify({ at: gstNowIso(), ask: intent, brief: out }), { expirationTtl: 3 * 86400 });
  await dnaSignal(env, "client_match", (rt !== "any" ? rt + " " : "") + purpose + (budget ? " ~" + Math.round(budget / 1000) + "k" : ""));
  await waSend(env, to, "🎯 Client match — register-grounded\n\n" + out);
  // v73.6 — one tap from the brief into the board: compare mode pre-set to this client's bedrooms + budget (who builds this, at what
  // range), plus the 3D skyline of the matched areas where we hold one. Deeper links (a developer's page, a unit card) attach
  // once the match ranks projects rather than areas.
  try {
    const bedKey = /studio/i.test(rt) ? "studio" : (/^([1-4])\s*B/i.test(rt) ? rt.match(/^([1-4])/)[1] : (/^5/.test(rt) ? "4" : "all"));
    const bandKey = !budget ? "all" : budget < 1e6 ? "lt1" : budget < 2e6 ? "1to2" : budget < 4e6 ? "2to4" : "gt4";
    const base = LI_ORIGIN(env) + "/home?mode=compare&bed=" + bedKey + "&band=" + bandKey + "&metric=range&key=" + encodeURIComponent(env.READ_KEY || "");
    let skyLinks = "";
    try {
      const _kl = await env.MEETINGS.list({ prefix: "img_sky_" });                 // same enumeration the /skyline rail uses
      const slugs = new Set(_kl.keys.map(k => k.name.slice(8)));
      skyLinks = top.map(c => { const s = String(c.area || "").toLowerCase().replace(/[^a-z0-9]/g, ""); return slugs.has(s) ? "⬢ " + c.area + " in 3D: " + LI_ORIGIN(env) + "/skyline/" + s + "?key=" + encodeURIComponent(env.READ_KEY || "") : null; }).filter(Boolean).slice(0, 3).join("\n");
    } catch (e) {}
    await waSend(env, to, "🗂 On the board\n" + "Who builds " + (bedKey === "all" ? "this" : bedKey === "studio" ? "studios" : bedKey + "-beds") + (budget ? " under AED " + (budget / 1e6).toFixed(1) + " M" : "") + ", side by side: " + base + (skyLinks ? "\n" + skyLinks : ""));
  } catch (e) {}
  await waSendButtons(env, to, "Turn this into content, or refine the brief in a reply.", [
    { id: "match:post", title: "📸 Make it a post" },
    { id: "match:done", title: "✓ Just for the meeting" }]);
}

// ── v40 — LAUNCH MODE: real-time due diligence in the developer's briefing room ──
// She's at a new-launch pitch. She types what they're claiming; the Worker checks the price
// against what actually SETTLES in that area, sanity-checks the ROI claim against real yields,
// pulls the developer's delivery track record from the MEED corpus, flags competing supply,
// and hands her the questions to ask in the room. Quiet edge no other broker there has.
const LAUNCH_SCHEMA = { type: "object", additionalProperties: false, properties: { developer: { type: "string" }, area: { type: "string" }, roomType: { type: "string" }, priceAed: { type: ["number", "null"] }, pricePsfAed: { type: ["number", "null"] }, handoverYear: { type: ["number", "null"] }, roiClaimPct: { type: ["number", "null"] } }, required: ["developer", "area", "roomType", "priceAed", "pricePsfAed", "handoverYear", "roiClaimPct"] };

function _devMatch(devIndex, name) {
  if (!name) return null;
  const nl = name.toLowerCase();
  let best = null, bestScore = 0;
  const nt = nl.split(/[^a-z0-9]+/).filter(w => w.length > 2);
  for (const dv of devIndex) {
    const dl = String(dv.d || "").toLowerCase();
    let score = 0;
    if (dl.indexOf(nl) !== -1 || nl.indexOf(dl) !== -1) score = 5;
    else { const dt = dl.split(/[^a-z0-9]+/); score = nt.filter(w => dt.indexOf(w) !== -1).length; }
    if (score > bestScore) { bestScore = score; best = dv; }
  }
  return bestScore >= 1 ? best : null;
}

// v72.2 — DEVELOPER TRUST CHECK. Owner decision 2 Sep 2026 (option A): sourced MEED Projects
// counts + the OFFICIAL DLD verification pages, nothing else. Third-party dispute tables (PARCEL etc.)
// are unverifiable, ~15 months stale and a defamation risk — NEVER wired in. Counts are records, not
// a rating; only the DLD register proves licence, escrow and %-complete. All URLs verified live 2 Sep 2026.
const DLD_VERIFY = [
  ["Licensed developers (DLD)", "https://dubailand.gov.ae/en/eservices/approved-real-estate-developers/"],
  ["Project status + escrow (DLD)", "https://dubailand.gov.ae/en/eservices/real-estate-project-status-landing/"],
  ["Licences & permits check (DLD)", "https://dubailand.gov.ae/en/eservices/validate-real-estate-licenses-and-permits/"],
  ["Contractual disputes inquiry (RVS)", "https://dubailand.gov.ae/en/eservices/rvs-contractual-disputes-overview/"],
  ["Approved escrow trustees (DLD)", "https://dubailand.gov.ae/en/eservices/certified-escrow-agents/"],
  ["Dubai REST app — iOS", "https://apps.apple.com/us/app/dubai-rest/id1437805105"],
  ["Dubai REST app — Android", "https://play.google.com/store/apps/details?id=ae.gov.dubailand.selfregistration"],
];
async function devTrust(env, name) {
  let devIndex = []; try { devIndex = JSON.parse((await env.MEETINGS.get("mkt_devindex")) || "[]"); } catch (e) {}
  let asAt = null; try { asAt = await env.MEETINGS.get("mkt_devindex_at"); } catch (e) {}
  const dev = _devMatch(devIndex, name);
  const track = dev ? { name: dev.d, projectsInCorpus: dev.n, completed: dev.complete, underConstruction: dev.construction, cancelled: dev.cancelled, onHold: dev.onhold, activeNow: dev.active, pipelineUsdM: dev.valueUsdM } : null;
  return { asked: String(name || "").trim(), track, asAt: asAt || null, links: DLD_VERIFY };
}
function devTrustText(t) {
  const n = (x) => (x == null ? 0 : x);
  const src = "MEED Projects record" + (t.asAt ? " (snapshot " + String(t.asAt).slice(0, 10) + ")" : " (snapshot, undated)");
  const head = "🛡 Developer trust check — " + (t.track ? t.track.name : t.asked);
  const rec = t.track
    ? src + ": " + n(t.track.projectsInCorpus) + " projects · " + n(t.track.completed) + " completed · " + n(t.track.underConstruction) + " under construction · " + n(t.track.cancelled) + " cancelled · " + n(t.track.onHold) + " on hold" + (t.track.pipelineUsdM ? " · pipeline US$" + Math.round(t.track.pipelineUsdM).toLocaleString("en-US") + "m" : "")
    : src + ": no developer matched “" + t.asked + "” — that alone says nothing either way.";
  const links = t.links.map(l => "• " + l[0] + ": " + l[1]).join("\n");
  return head + "\n" + rec + "\n\nVerify on the official pages before you rely on it:\n" + links + "\n\nCounts are project records, not a rating. Only the DLD register proves licence, escrow and %-complete.";
}
function devTrustHtml(t) {
  const e = (x) => String(x == null ? "" : x).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const n = (x) => (x == null ? 0 : x);
  const rec = t.track
    ? '<div style="font-size:.74rem">' + e(t.track.name) + ' — ' + n(t.track.projectsInCorpus) + ' projects · <b>' + n(t.track.completed) + ' completed</b> · ' + n(t.track.underConstruction) + ' under construction · <b style="color:#E0A090">' + n(t.track.cancelled) + ' cancelled</b> · ' + n(t.track.onHold) + ' on hold</div>'
    : '<div style="font-size:.74rem;color:var(--mut)">no developer matched “' + e(t.asked) + '” in the MEED record — says nothing either way</div>';
  const links = t.links.map(l => '<a href="' + e(l[1]) + '" target=_blank rel=noopener style="display:block;color:var(--gold);text-decoration:none;font-size:.72rem;padding:.28rem 0;border-top:1px solid rgba(197,165,106,.25)">↗ ' + e(l[0]) + '</a>').join("");
  return '<div style="margin-top:14px;background:rgba(62,138,126,.08);border:1px solid rgba(62,138,126,.45);border-radius:12px;padding:.7rem .9rem">' +
    '<div style="font-family:Fraunces,Georgia,serif;font-weight:600;color:var(--gold)">Verify the developer</div>' +
    '<div style="color:var(--mut);font-size:.62rem;font-family:\'IBM Plex Mono\',monospace;margin:2px 0 6px">MEED Projects record' + (t.asAt ? ' · snapshot ' + e(String(t.asAt).slice(0, 10)) : ' · snapshot, undated') + '</div>' + rec +
    '<div style="margin-top:.5rem">' + links + '</div>' +
    '<div style="color:var(--mut);font-size:.6rem;margin-top:.4rem;font-family:\'IBM Plex Mono\',monospace">records, not a rating — only the DLD register proves licence, escrow and %-complete</div></div>';
}

async function launchMode(env, to, briefText, returnOnly) {
  if (returnOnly) launchMode._out = "";
  const _send = async (msg) => { if (returnOnly) { launchMode._out += msg + "\n\n"; } else { await waSend(env, to, msg); } };
  const _sendButtons = async (body, btns) => { if (!returnOnly) await waSendButtons(env, to, body, btns); };
  let d = null; try { d = JSON.parse((await env.MEETINGS.get("mkt_latest")) || "null"); } catch (e) {}
  let devIndex = []; try { devIndex = JSON.parse((await env.MEETINGS.get("mkt_devindex")) || "[]"); } catch (e) {}
  const ai = (d && d.areaIntel && d.areaIntel.areas) || [];

  const isys = "Extract the facts of a Dubai property NEW-LAUNCH pitch a broker is hearing. developer: the developer/brand name. area: the location/community. roomType: Studio|1 B/R|2 B/R|3 B/R|4 B/R|villa|any. priceAed: headline unit price in AED (convert k/m/million), null if none. pricePsfAed: price per sq ft in AED if stated, else null. handoverYear: 4-digit year if stated, else null. roiClaimPct: any ROI / rental-return percentage the developer claims, else null. JSON only.";
  const intent = await claudeJSON(env, isys, briefText, LAUNCH_SCHEMA, null, 300);
  if (!intent) { await _send("Couldn't read the launch details — try e.g. “launch: Binghatti in JVC, 1-bed from 1.2M, handover 2027, claims 8% ROI”."); return returnOnly ? launchMode._out : undefined; }

  // 1. price reality — area settled comparables
  const areaHit = ai.find(a => intent.area && a.area.toLowerCase().indexOf(intent.area.toLowerCase()) !== -1)
                || ai.find(a => intent.area && intent.area.toLowerCase().indexOf(a.area.toLowerCase()) !== -1);
  let priceCheck = null;
  if (areaHit) {
    const rr = intent.roomType && intent.roomType !== "any" && intent.roomType !== "villa" ? (areaHit.byRoom && areaHit.byRoom[intent.roomType]) : null;
    priceCheck = {
      area: areaHit.area, sales: areaHit.sales, settledMedianAed: rr ? rr.medianAed : areaHit.medianTicketAed,
      settledMedianAedSqft: areaHit.medianAedSqft, offPlanPct: areaHit.offPlanPct, grossYieldPct: areaHit.grossYieldPct,
      roomType: intent.roomType,
    };
    if (intent.pricePsfAed && areaHit.medianAedSqft) priceCheck.launchVsSettledPsfPct = Math.round(100 * (intent.pricePsfAed - areaHit.medianAedSqft) / areaHit.medianAedSqft);
    if (intent.priceAed && priceCheck.settledMedianAed) priceCheck.launchVsSettledPct = Math.round(100 * (intent.priceAed - priceCheck.settledMedianAed) / priceCheck.settledMedianAed);
  }

  // 1b. DLD register match — escrow + %-complete for THIS project, if it's in the register
  let regHit = null;
  const pl = (d && d.projects && d.projects.projectLookup) || [];
  const dl2 = (intent.developer || "").toLowerCase(), al2 = (intent.area || "").toLowerCase();
  for (const p of pl) {
    const pd = (p.developer || "").toLowerCase(), pa = (p.area || "").toLowerCase();
    if ((dl2 && (pd.indexOf(dl2) !== -1 || dl2.indexOf(pd) !== -1)) && (!al2 || pa.indexOf(al2) !== -1 || al2.indexOf(pa) !== -1)) { regHit = p; break; }
  }
  // 1c. competing supply in the area (units already registered to deliver nearby)
  let areaSupply = null;
  const sba = (d && d.projects && d.projects.supplyByArea) || {};
  for (const k of Object.keys(sba)) { if (areaHit && k.toLowerCase() === areaHit.area.toLowerCase()) { areaSupply = { area: k, ...sba[k] }; break; } }

  // 2. developer track record
  const dev = _devMatch(devIndex, intent.developer);
  const track = dev ? { name: dev.d, projectsInCorpus: dev.n, completed: dev.complete, underConstruction: dev.construction, cancelled: dev.cancelled, onHold: dev.onhold, activeNow: dev.active, pipelineUsdM: dev.valueUsdM } : null;

  // 3. ROI reality — compare their claim to the area's NET yield (what a buyer actually earns)
  const roiReality = { developerClaimPct: intent.roiClaimPct,
    areaGrossYieldPct: areaHit ? areaHit.grossYieldPct : null,
    areaNetYieldPct: areaHit ? areaHit.netYieldPct : null,
    serviceChargeAedSqftYr: areaHit ? areaHit.serviceChargeAedSqftYr : null,
    serviceChargeIsEstimate: areaHit ? areaHit.serviceChargeIsEstimate : null };

  const period = d && d.transactions ? (d.transactions.periodFrom + " to " + d.transactions.periodTo) : "recent";
  const sys = "You are briefing a Dubai property broker DISCREETLY while she sits in a developer's new-launch pitch. Give her the register's reality check on what she's being told, so she asks sharp questions and advises her clients honestly. Use ONLY the numbers provided; never invent. Structure, plain text, under 230 words: PRICE — is the launch price a premium or discount to what SETTLES in that area (give the % and the settled figure, 'DLD Open Data, " + period + "', settled not asking); if no area data say so plainly. RETURN — compare any ROI claim to the area's real NET yield (gross minus service charge — the number the buyer actually keeps); developers quote gross or projected ROI and hide the service charge, so if their claim exceeds the registered NET yield, name the gap and name the service charge as the reason (flag it 'estimate' where the service charge is a community typical, not the building's Mollak figure). TRACK RECORD — from the MEED corpus, the developer's completed vs under-construction vs cancelled counts and what that suggests about delivery (a high cancelled count is a flag; no record found = say so, not a verdict). ESCROW &amp; REGISTRATION — if dldRegisterMatch is present, state it plainly: whether the project is on the DLD register, whether an escrow account is registered (escrowRegistered), its recorded %-complete and registered completion date — this is verification the developer can't spin; if no register match, say it's not in the open sample (not a verdict, just say to confirm the Oqood/escrow number in the room). SUPPLY — if competingSupplyInArea is present, note how many units are already registered to deliver in that area and by when (absorption/rental-competition risk the buyer should hear). ASK IN THE ROOM — three specific questions (escrow account number to verify on Dubai REST, realistic handover given their track record, service-charge estimate, post-handover payment terms — pick the sharpest three, informed by the gaps above). Close with WHAT NOT TO CLAIM: this is transaction history and corpus data, not a guarantee about this specific building.";
  const user = JSON.stringify({ launch: intent, priceCheck, developerTrackRecord: track, roiReality, dldRegisterMatch: regHit, competingSupplyInArea: areaSupply });
  let out = null;
  try { out = await claudeText(env, sys, user, null, 1200); } catch (e) {}
  if (!out) { await _send("Couldn't build the check just now — try again in a minute."); return; }
  await dnaSignal(env, "launch_check", (intent.developer || "") + " / " + (intent.area || ""));
  await env.MEETINGS.put("mkt_lastmatch", JSON.stringify({ at: gstNowIso(), ask: intent, brief: out }), { expirationTtl: 3 * 86400 });
  await _send("🏗 Launch check — what the register says\n\n" + out);
  try { await _send(devTrustText(await devTrust(env, intent.developer))); } catch (e) {}   // v72.2 — official verification doors, always
  await _sendButtons("Keep it for the room, or turn the honest read into content.", [
    { id: "match:post", title: "📸 Make it a post" },
    { id: "match:done", title: "✓ Just for me" }]);
  if (returnOnly) return launchMode._out;
}

// ── v41 — CHARTS: post-ready visuals rendered from the register (native SVG, no libraries,
// no image generator — real numbers only). Each card is sized for a screenshot to become an
// Instagram/LinkedIn asset, with the NAJMA wordmark and DLD attribution already on it.
const CH = { ink: "#0C1413", card: "#131F1D", card2: "#182823", line: "#24352F", text: "#E8E4D8", mut: "#8FA39B", gold: "#C5A56A", teal: "#3E8A7E", amber: "#D9A441" };
const _sx = (s) => String(s == null ? "" : s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

function chLine(title, sub, pts) {          // pts: [{label, value}]
  const W = 1080, H = 1080, PL = 90, PR = 70, PT = 250, PB = 150;
  const vals = pts.map(p => p.value), mx = Math.max(...vals, 1), mn = Math.min(...vals, 0);
  const x = i => PL + (W - PL - PR) * (pts.length === 1 ? 0.5 : i / (pts.length - 1));
  const y = v => PT + (H - PT - PB) * (1 - (v - mn) / (mx - mn || 1));
  const line = pts.map((p, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(p.value).toFixed(1)).join(" ");
  const area = "M" + x(0).toFixed(1) + " " + (H - PB) + " " + pts.map((p, i) => "L" + x(i).toFixed(1) + " " + y(p.value).toFixed(1)).join(" ") + " L" + x(pts.length - 1).toFixed(1) + " " + (H - PB) + " Z";
  const dots = pts.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="7" fill="${CH.gold}"/>`).join("");
  const labs = pts.map((p, i) => `<text x="${x(i).toFixed(1)}" y="${H - PB + 45}" fill="${CH.mut}" font-size="26" text-anchor="middle">${_sx(p.label)}</text>`).join("");
  const vlab = pts.map((p, i) => `<text x="${x(i).toFixed(1)}" y="${(y(p.value) - 22).toFixed(1)}" fill="${CH.text}" font-size="24" text-anchor="middle" font-weight="600">${_sx(p.disp || p.value)}</text>`).join("");
  return _chWrap(title, sub, `<defs><linearGradient id="lg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${CH.teal}" stop-opacity=".35"/><stop offset="1" stop-color="${CH.teal}" stop-opacity="0"/></linearGradient></defs><path d="${area}" fill="url(#lg)"/><path d="${line}" fill="none" stroke="${CH.teal}" stroke-width="5"/>${dots}${vlab}${labs}`);
}

function chBars(title, sub, rows) {         // rows: [{label, value, disp}]
  const W = 1080, H = 1080, PL = 90, PT = 250, PB = 90, rowH = (H - PT - PB) / rows.length;
  const mx = Math.max(...rows.map(r => r.value), 1);
  const bw = W - PL - 90;
  let body = "";
  rows.forEach((r, i) => {
    const yy = PT + i * rowH, w = Math.max(4, bw * r.value / mx);
    body += `<text x="${PL}" y="${yy + 26}" fill="${CH.text}" font-size="30">${_sx(r.label)}</text>` +
      `<rect x="${PL}" y="${yy + 42}" width="${w.toFixed(1)}" height="26" rx="6" fill="${i === 0 ? CH.gold : CH.teal}"/>` +
      `<text x="${(PL + w + 14).toFixed(1)}" y="${yy + 63}" fill="${CH.mut}" font-size="26" font-weight="600">${_sx(r.disp != null ? r.disp : r.value)}</text>`;
  });
  return _chWrap(title, sub, body);
}

function chDonut(title, sub, parts) {       // parts: [{label, value, color}]
  const W = 1080, H = 1080, cx = W / 2, cy = 560, R = 210, r = 120;
  const tot = parts.reduce((s, p) => s + p.value, 0) || 1;
  let ang = -Math.PI / 2, segs = "";
  const pt = (a, rad) => [cx + rad * Math.cos(a), cy + rad * Math.sin(a)];
  parts.forEach(p => {
    const a2 = ang + 2 * Math.PI * p.value / tot, big = (a2 - ang) > Math.PI ? 1 : 0;
    const [x1, y1] = pt(ang, R), [x2, y2] = pt(a2, R), [x3, y3] = pt(a2, r), [x4, y4] = pt(ang, r);
    segs += `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} A${R} ${R} 0 ${big} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} L${x3.toFixed(1)} ${y3.toFixed(1)} A${r} ${r} 0 ${big} 0 ${x4.toFixed(1)} ${y4.toFixed(1)} Z" fill="${p.color}"/>`;
    ang = a2;
  });
  const leg = parts.map((p, i) => `<rect x="330" y="${840 + i * 56}" width="30" height="30" rx="5" fill="${p.color}"/><text x="378" y="${864 + i * 56}" fill="${CH.text}" font-size="32">${_sx(p.label)} — ${Math.round(100 * p.value / tot)}%</text>`).join("");
  return _chWrap(title, sub, segs + leg);
}

// Curated public community coordinates (well-known Dubai geography, not proprietary data),
// normalised into the card. Bubble size = sales volume. An honest, screenshot-ready map.
const DXB_COORDS = { "business bay": [55.264, 25.186], "jumeirah village circle": [55.207, 25.058], "downtown dubai": [55.276, 25.194], "dubai marina": [55.138, 25.080], "palm jumeirah": [55.138, 25.112], "jumeirah lakes towers": [55.141, 25.069], "dubai hills estate": [55.246, 25.104], "arjan": [55.243, 25.055], "al furjan": [55.145, 25.026], "dubai south": [55.161, 24.896], "madinat al mataar": [55.16, 24.90], "city of arabia": [55.30, 25.13], "jumeirah village triangle": [55.19, 25.05], "damac hills": [55.25, 25.03], "dubai creek harbour": [55.34, 25.20], "meydan": [55.30, 25.16], "town square": [55.28, 25.02], "the valley": [55.45, 25.02], "sobha hartland": [55.30, 25.18], "majan": [55.26, 25.07], "dubai land residence complex": [55.28, 25.06], "al barsha": [55.20, 25.11], "deira": [55.32, 25.27], "palm deira": [55.32, 25.30], "dubai islands": [55.33, 25.30], "jabal ali first": [55.13, 25.00], "wadi al safa 5": [55.30, 25.07] };
function chMap(title, sub, areas) {         // areas: [{area, sales}]
  const W = 1080, H = 1080, PT = 250, PB = 80;
  const pts = areas.map(a => ({ a, c: DXB_COORDS[a.area.toLowerCase()] })).filter(p => p.c);
  if (pts.length < 4) return null;
  const lons = pts.map(p => p.c[0]), lats = pts.map(p => p.c[1]);
  const lo0 = Math.min(...lons), lo1 = Math.max(...lons), la0 = Math.min(...lats), la1 = Math.max(...lats);
  const px = lon => 110 + (W - 220) * (lon - lo0) / (lo1 - lo0 || 1);
  const py = lat => PT + (H - PT - PB) * (1 - (lat - la0) / (la1 - la0 || 1));
  const mx = Math.max(...pts.map(p => p.a.sales), 1);
  let body = `<rect x="70" y="${PT - 20}" width="${W - 140}" height="${H - PT - PB + 10}" rx="24" fill="${CH.card2}"/>`;
  pts.sort((a, b) => b.a.sales - a.a.sales).forEach((p, i) => {
    const r = 16 + 60 * Math.sqrt(p.a.sales / mx);
    body += `<circle cx="${px(p.c[0]).toFixed(1)}" cy="${py(p.c[1]).toFixed(1)}" r="${r.toFixed(1)}" fill="${i === 0 ? CH.gold : CH.teal}" fill-opacity="0.5" stroke="${i === 0 ? CH.gold : CH.teal}" stroke-width="2"/>`;
    if (i < 6) body += `<text x="${px(p.c[0]).toFixed(1)}" y="${(py(p.c[1]) + 8).toFixed(1)}" fill="${CH.text}" font-size="22" text-anchor="middle" font-weight="600">${_sx(p.a.area.length > 16 ? p.a.area.slice(0, 15) + "…" : p.a.area)}</text>`;
  });
  return _chWrap(title, sub, body);
}

// Heat map on a self-contained vector Dubai basemap (coastline + Palm Jumeirah + Sheikh Zayed
// Road for orientation) — no tiles, no API key, no external calls. Heat = registered sales
// density per community; warmer + bigger = more sales. Fixed projection so basemap and heat align.
const DXB_BBOX = { lo0: 55.02, lo1: 55.42, la0: 24.86, la1: 25.32 };
function chHeatMap(title, sub, areas) {
  const W = 1080, H = 1080, PT = 250, PB = 90;
  const px = lon => 80 + (W - 160) * (lon - DXB_BBOX.lo0) / (DXB_BBOX.lo1 - DXB_BBOX.lo0);
  const py = lat => PT + (H - PT - PB) * (1 - (lat - DXB_BBOX.la0) / (DXB_BBOX.la1 - DXB_BBOX.la0));
  const pts = areas.map(a => ({ a, c: DXB_COORDS[a.area.toLowerCase()] })).filter(p => p.c);
  if (pts.length < 4) return null;
  const mx = Math.max(...pts.map(p => p.a.sales), 1);

  // basemap: sea fill + coastline + Palm + arterial road (thin, subtle — heat is the star)
  const shore = [[55.02, 24.98], [55.10, 25.05], [55.135, 25.095], [55.15, 25.10], [55.19, 25.135], [55.24, 25.20], [55.285, 25.26], [55.35, 25.30]];
  const shorePath = shore.map((c, i) => (i ? "L" : "M") + px(c[0]).toFixed(0) + " " + py(c[1]).toFixed(0)).join(" ");
  const seaFill = "M" + px(55.02).toFixed(0) + " " + py(24.98).toFixed(0) + " " + shore.slice(1).map(c => "L" + px(c[0]).toFixed(0) + " " + py(c[1]).toFixed(0)).join(" ") + " L" + px(55.35).toFixed(0) + " " + PT + " L" + px(55.02).toFixed(0) + " " + PT + " Z";
  const road = [[55.14, 25.06], [55.20, 25.13], [55.27, 25.19], [55.33, 25.26]].map((c, i) => (i ? "L" : "M") + px(c[0]).toFixed(0) + " " + py(c[1]).toFixed(0)).join(" ");
  // Palm Jumeirah at 55.138,25.112 — a small iconic mark
  const palmX = px(55.138), palmY = py(25.112), pr = 34;
  let palm = `<circle cx="${palmX.toFixed(0)}" cy="${palmY.toFixed(0)}" r="8" fill="none" stroke="${CH.teal}" stroke-width="2" opacity="0.5"/>`;
  for (let k = 0; k < 9; k++) { const a = -Math.PI * 0.9 + k * (Math.PI * 0.8 / 8); palm += `<line x1="${palmX.toFixed(0)}" y1="${palmY.toFixed(0)}" x2="${(palmX + pr * Math.cos(a)).toFixed(0)}" y2="${(palmY + pr * Math.sin(a)).toFixed(0)}" stroke="${CH.teal}" stroke-width="1.5" opacity="0.45"/>`; }
  palm += `<path d="M${(palmX - pr - 8).toFixed(0)} ${(palmY - pr).toFixed(0)} A${pr + 10} ${pr + 10} 0 0 1 ${(palmX + pr + 8).toFixed(0)} ${(palmY - pr + 4).toFixed(0)}" fill="none" stroke="${CH.teal}" stroke-width="2" opacity="0.45"/>`;

  // heat blobs (radial gradient, additive look via opacity), then labels for the top areas
  let defs = "", heat = "", dots = "", labels = "";
  pts.sort((a, b) => b.a.sales - a.a.sales).forEach((p, i) => {
    const t = p.a.sales / mx, r = 34 + 120 * Math.sqrt(t);
    const col = t > 0.55 ? CH.gold : CH.teal;
    defs += `<radialGradient id="h${i}"><stop offset="0" stop-color="${col}" stop-opacity="${(0.55 * t + 0.18).toFixed(2)}"/><stop offset="100%" stop-color="${col}" stop-opacity="0"/></radialGradient>`;
    heat += `<circle cx="${px(p.c[0]).toFixed(0)}" cy="${py(p.c[1]).toFixed(0)}" r="${r.toFixed(0)}" fill="url(#h${i})"/>`;
    if (i < 8) { dots += `<circle cx="${px(p.c[0]).toFixed(0)}" cy="${py(p.c[1]).toFixed(0)}" r="5" fill="${col}"/>`; labels += `<text x="${px(p.c[0]).toFixed(0)}" y="${(py(p.c[1]) - 12).toFixed(0)}" fill="${CH.text}" font-size="21" text-anchor="middle" font-weight="600">${_sx(p.a.area.length > 15 ? p.a.area.slice(0, 14) + "…" : p.a.area)}</text>`; }
  });
  const body = `<defs>${defs}</defs>` +
    `<rect x="70" y="${PT - 18}" width="${W - 140}" height="${H - PT - PB + 8}" rx="24" fill="#0F211E"/>` +
    `<path d="${seaFill}" fill="${CH.teal}" fill-opacity="0.10"/>` +
    `<path d="${shorePath}" fill="none" stroke="${CH.teal}" stroke-width="2.5" opacity="0.6"/>` +
    `<path d="${road}" fill="none" stroke="${CH.mut}" stroke-width="2" stroke-dasharray="2 5" opacity="0.5"/>` +
    palm + heat + dots + labels +
    `<text x="96" y="${H - 108}" fill="${CH.mut}" font-size="20">◍ warmer &amp; larger = more registered sales · ✦ Palm Jumeirah · – – Sheikh Zayed Road</text>`;
  return _chWrap(title, sub, body);
}

function _chWrap(title, sub, body) {
  const W = 1080, H = 1080;
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" width="100%" style="max-width:520px;display:block">` +
    `<rect width="${W}" height="${H}" fill="${CH.ink}"/><rect x="24" y="24" width="${W - 48}" height="${H - 48}" rx="28" fill="${CH.card}" stroke="${CH.line}" stroke-width="2"/>` +
    `<text x="70" y="120" fill="${CH.gold}" font-size="30" font-weight="700" letter-spacing="1" font-family="Fraunces,Georgia,serif">NAJMA نجمة</text>` +
    `<text x="70" y="188" fill="${CH.text}" font-size="46" font-weight="600" font-family="Fraunces,Georgia,serif">${_sx(title)}</text>` +
    `<text x="70" y="228" fill="${CH.mut}" font-size="26" font-family="'IBM Plex Sans',sans-serif">${_sx(sub)}</text>` +
    body +
    `<text x="70" y="${H - 44}" fill="${CH.mut}" font-size="22" font-family="'IBM Plex Sans',sans-serif">Source: Dubai Land Department (DLD) Open Data · settled, not asking</text>` +
    `</svg>`;
}


// v59 — AREA POSTCARD: 1080×1080 post card — real satellite of the community, Fraunces
// masthead, five dot-leader facts (price, ticket, net yield, who lives there, what's near,
// what's coming). Screenshot-and-post, like every /charts card.
function chPostcard(a, sup, amen) {
  const slug = String(a.area || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const num2 = (v) => (v == null ? "—" : Number(v).toLocaleString("en-US"));
  const facts = [];
  if (a.medianAedSqft) facts.push(["Median settled", num2(a.medianAedSqft) + " AED/sqft"]);
  if (a.medianTicketAed) facts.push(["Median ticket", (a.medianTicketAed / 1e6).toFixed(2) + "m AED"]);
  if (a.netYieldPct != null) facts.push(["Net yield", a.netYieldPct + "%"]);
  if (a.pop) facts.push(["Who lives here", num2(a.pop) + " residents"]);
  if (amen && amen.length) facts.push(["Nearby", String(amen[0].value).split("·")[0].trim()]);
  if (sup && sup.units) facts.push(["Coming", num2(sup.units) + " units in pipeline"]);
  const rows = facts.slice(0, 5).map(([k, v], i) => {
    const y = 700 + i * 62;
    return `<text x="88" y="${y}" fill="#8FA39B" font-size="26" font-family="'IBM Plex Mono',monospace">${_sx(k.toUpperCase())}</text>` +
      `<text x="992" y="${y}" fill="#E8E4D8" font-size="30" font-weight="600" text-anchor="end" font-family="'IBM Plex Sans',sans-serif">${_sx(v)}</text>` +
      `<line x1="88" y1="${y + 16}" x2="992" y2="${y + 16}" stroke="#24352F" stroke-width="1"/>`;
  }).join("");
  return `<svg viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg" width="100%" style="max-width:520px;display:block">` +
    `<defs><clipPath id="pcclip"><rect x="24" y="24" width="1032" height="1032" rx="28"/></clipPath>` +
    `<linearGradient id="pcg" x1="0" y1="0" x2="0" y2="1"><stop offset="0.3" stop-color="#0C1413" stop-opacity="0"/><stop offset="0.62" stop-color="#0C1413" stop-opacity="0.82"/><stop offset="1" stop-color="#0C1413" stop-opacity="0.97"/></linearGradient></defs>` +
    `<rect width="1080" height="1080" fill="#0C1413"/>` +
    `<g clip-path="url(#pcclip)"><image href="/img/sat_${slug}" x="24" y="24" width="1032" height="1032" preserveAspectRatio="xMidYMid slice"/>` +
    `<rect x="24" y="24" width="1032" height="1032" fill="url(#pcg)"/></g>` +
    `<rect x="24" y="24" width="1032" height="1032" rx="28" fill="none" stroke="#24352F" stroke-width="2"/>` +
    `<rect x="40" y="40" width="1000" height="1000" rx="20" fill="none" stroke="rgba(232,228,216,.28)" stroke-width="2" stroke-dasharray="1 6" stroke-linecap="round"/>` +
    `<text x="88" y="118" fill="#C5A56A" font-size="26" font-weight="700" letter-spacing="3" font-family="'IBM Plex Mono',monospace">NAJMA نجمة · AREA POSTCARD</text>` +
    `<rect x="908" y="76" width="96" height="96" rx="8" fill="rgba(12,20,19,.55)" stroke="#C5A56A" stroke-width="2"/>` +
    `<g transform="translate(924,92) scale(0.25)"><path d="${NAJ_ICONS.star}" fill="#C5A56A"/></g>` +
    `<text x="88" y="600" fill="#E8E4D8" font-size="76" font-weight="600" font-family="Fraunces,Georgia,serif">${_sx(a.area)}</text>` +
    `<text x="88" y="644" fill="#8FA39B" font-size="26" font-family="'IBM Plex Sans',sans-serif">settled, not asking — the register's own numbers</text>` +
    rows +
    `<text x="88" y="1020" fill="#8FA39B" font-size="22" font-family="'IBM Plex Sans',sans-serif">Source: Dubai Land Department (DLD) Open Data · imagery: Esri World Imagery</text>` +
    `</svg>`;
}

function renderCharts(latestRaw, key, amenRaw) {
  let d = null; try { d = JSON.parse(latestRaw || "null"); } catch (e) {}
  if (!d || !d.transactions) return '<!doctype html><meta charset=utf-8><body style="font-family:system-ui;background:#0C1413;color:#E8E4D8;padding:2rem"><h2>Charts</h2><p>No data yet — the collector has not delivered.</p>';
  const t = d.transactions, mo = d.monthly, rn = d.rents;
  const cards = [];
  // v59 — postcard leads the sheet: the most personal, most postable card
  const topA = (d.areaIntel && d.areaIntel.areas && d.areaIntel.areas[0]) || null;
  if (topA) {
    let amen = null; try { const am = JSON.parse(amenRaw || "null"); if (am && am.ok) amen = am.amen; } catch (e) {}
    const supA = ((d.projects && d.projects.supplyByArea) || {})[topA.area] || null;
    cards.push(chPostcard(topA, supA, amen));
  }
  if (mo && mo.series && mo.series.length) cards.push(chLine("Sales value by month", "AED billion · " + (mo.ytdValueAedBn || "") + "bn year to date", mo.series.map(s => ({ label: s.month.slice(5), value: s.valueAedBn, disp: s.valueAedBn }))));
  if (t.topAreas && t.topAreas.length) cards.push(chBars("Where the market trades", "Registered sales by area · " + (t.periodFrom || "") + " to " + (t.periodTo || ""), t.topAreas.slice(0, 8).map(a => ({ label: a.area.length > 22 ? a.area.slice(0, 21) + "…" : a.area, value: a.sales, disp: a.sales.toLocaleString("en-US") }))));
  if (t.offPlanSplit) cards.push(chDonut("Off-plan vs ready", "Share of registered sales", [{ label: "Off-plan", value: t.offPlanSplit["Off-Plan"] || 0, color: CH.gold }, { label: "Ready", value: t.offPlanSplit["Ready"] || 0, color: CH.teal }]));
  // net-yield chart from areaIntel (gross minus service charge) — the number that actually matters
  const nety = (d.areaIntel && d.areaIntel.areas || []).filter(a => a.netYieldPct != null).sort((a, b) => b.netYieldPct - a.netYieldPct).slice(0, 7);
  if (nety.length) cards.push(chBars("Net rental yield by area", "Gross minus service charge — what the buyer keeps", nety.map(a => ({ label: a.area.length > 22 ? a.area.slice(0, 21) + "…" : a.area, value: a.netYieldPct, disp: a.netYieldPct + "%" }))));
  else if (rn && rn.grossYieldPctByArea && rn.grossYieldPctByArea.length) cards.push(chBars("Gross rental yield by area", "Registered rent ÷ registered price · Ejari + DLD", rn.grossYieldPctByArea.slice(0, 7).map(y => ({ label: y.area.length > 22 ? y.area.slice(0, 21) + "…" : y.area, value: y.yieldPct, disp: y.yieldPct + "%" }))));
  const map = t.topAreas ? (chHeatMap("Dubai — where it's trading", "Sales heat on the map · Ejari + DLD register", t.topAreas.slice(0, 20)) || chMap("Dubai — where it's trading", "Bubble size = registered sales volume", t.topAreas.slice(0, 20))) : null;
  if (map) cards.push(map);
  return '<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>Najma charts</title><link rel=icon href=/naj_icon.svg>' + NAJ_FONTS + '<style>body{background:#0C1413;color:#E8E4D8;font-family:"IBM Plex Sans",system-ui,sans-serif;margin:0;padding:14px 12px 88px;max-width:560px;margin:auto}.h{font-family:Fraunces,Georgia,serif;font-size:1.6rem;font-weight:600;margin:.3rem 0}.h em{font-style:normal;color:#C5A56A}.s{color:#8FA39B;font-size:.8rem;margin-bottom:1rem}.c{margin:0 0 16px}.t{color:#8FA39B;font-size:.7rem;text-align:center;margin-top:4px}' + NAJ_NAV_CSS + '</style></head><body>' +
    '<div class=h>Najma <em>نجمة</em> — charts</div><div class=s>Long-press any chart to save it, then post. Every figure is register-grounded. <a href="/studio?key=' + encodeURIComponent(key || "") + '" style="color:#C5A56A;font-weight:600;text-decoration:none">🎨 open the studio →</a></div>' +
    cards.map(c => '<div class=c>' + c + '<div class=t>screenshot or long-press to save · then post</div></div>').join("") +
    najNav(key, "charts") + '</body></html>';
}

// v54 — ESRI BASEMAPS: OAuth 2.0 app-authentication token minted SERVER-SIDE from
// ESRI_CLIENT_ID/ESRI_CLIENT_SECRET (never in page source), cached in KV until shortly before
// expiry. The map asks /esri_token for a short-lived token; if anything fails it silently keeps
// the offline canvas basemap, so the map can never go blank.
async function esriToken(env) {
  if (!env.ESRI_CLIENT_ID || !env.ESRI_CLIENT_SECRET) return null;
  try {
    const cached = await env.MEETINGS.get("esri_tok");
    if (cached) { const c = JSON.parse(cached); if (c.exp > Date.now() + 300000) return c; }
  } catch (e) {}
  try {
    const body = new URLSearchParams({ client_id: env.ESRI_CLIENT_ID, client_secret: env.ESRI_CLIENT_SECRET, grant_type: "client_credentials", expiration: "20160" });
    const r = await fetch("https://www.arcgis.com/sharing/rest/oauth2/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
    const j = await r.json();
    if (!j || !j.access_token) { try { await env.MEETINGS.put("esri_err", JSON.stringify({ at: gstNowIso(), status: r.status, err: j && j.error ? j.error : j }), { expirationTtl: 86400 }); } catch (e) {} return null; }
    const out = { token: j.access_token, exp: Date.now() + (Math.min(j.expires_in || 1209600, 1209600) * 1000) };
    await env.MEETINGS.put("esri_tok", JSON.stringify(out), { expirationTtl: Math.max(3600, Math.floor((out.exp - Date.now()) / 1000) - 600) });
    return out;
  } catch (e) { return null; }
}

// v50 — INTERACTIVE MAP (/map): canvas pan-zoom over the offline basemap JSON (/img/mp_basemap),
// gold dot per community, tap -> bottom sheet (stats + actions), metric toggle. No map service,
// no external libraries — everything is register data + curated public coordinates.
function renderMap(latestRaw, key, waBot, esriOn, prevRaw, skySlugs) {
  let d = null, pv = null; try { d = JSON.parse(latestRaw || "null"); } catch (e) {}
  try { pv = JSON.parse(prevRaw || "null"); } catch (e) {}
  const prevA = {}; if (pv && pv.areaIntel && pv.areaIntel.areas) for (const x of pv.areaIntel.areas) prevA[x.area] = x.sales || 0;
  const esc2 = (s) => String(s == null ? "" : s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  if (!d || !d.areaIntel || !(d.areaIntel.areas || []).length) return '<!doctype html><meta charset=utf-8><body style="font-family:system-ui;background:#0C1413;color:#E8E4D8;padding:2rem"><h2 style="color:#C5A56A">Najma map</h2><p>No area intelligence yet — run the collector once, then refresh.</p>';
  const sup = (d.projects && d.projects.supplyByArea) || {};

  const mkA = (a) => ({
    n: a.area, s: a.sales || 0, psf: a.medianAedSqft || null,
    tik: a.medianTicketAed || null, off: a.offPlanPct == null ? null : a.offPlanPct,
    ny: a.netYieldPct == null ? null : a.netYieldPct, gy: a.grossYieldPct == null ? null : a.grossYieldPct,
    su: (sup[a.area] && sup[a.area].units) || 0,
    dl: prevA[a.area] != null ? (a.sales || 0) - prevA[a.area] : null,
    rm: najRooms(a.byRoom).slice(0, 3).map(([k, r]) => [k, r.medianAed])
  });
  const list = (d.areaIntel.areas || []).filter(a => DXB_COORDS[a.area.toLowerCase()]).map(a => Object.assign(mkA(a), { c: DXB_COORDS[a.area.toLowerCase()] }));
  const list2 = (d.areaIntel.areas || []).map(mkA);   // full register list — polygon taps reach beyond the 27 dots
  const period = d.transactions ? (String(d.transactions.periodFrom || "") + " → " + String(d.transactions.periodTo || "")) : "";
  return `<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no"><title>Najma map</title><link rel=icon href=/naj_icon.svg><meta name=theme-color content="#0C1413">${NAJ_FONTS}<style>
:root{--ink:#0C1413;--card:#131F1D;--card2:#182823;--line:#24352F;--text:#E8E4D8;--mut:#8FA39B;--gold:#C5A56A;--teal:#3E8A7E;--topscrim:rgba(12,20,19,.92);--chipbg:rgba(19,31,29,.85)}
html[data-theme=light]{--ink:#F2EEE3;--card:#FBF8F0;--card2:#EDE7D7;--line:#DCD5C2;--text:#1A2422;--mut:#6E7B74;--gold:#A88544;--teal:#2F6E64;--topscrim:rgba(242,238,227,.94);--chipbg:rgba(251,248,240,.9)}
html,body{margin:0;height:100%;background:var(--ink);color:var(--text);font-family:"IBM Plex Sans",system-ui,sans-serif;overflow:hidden;overscroll-behavior:none}
#cv{position:fixed;inset:0;touch-action:none;cursor:grab}
.top{position:fixed;top:0;left:0;right:0;padding:12px 14px 26px;background:linear-gradient(180deg,var(--topscrim),rgba(12,20,19,0));pointer-events:none}
html[data-theme=light] .top{background:linear-gradient(180deg,var(--topscrim),rgba(242,238,227,0))}
.mast{font-family:Fraunces,Georgia,serif;font-size:1.45rem;font-weight:600}.mast em{font-style:normal;color:var(--gold)}
.per{color:var(--mut);font-size:.7rem;font-family:"IBM Plex Mono",monospace;margin-top:2px}
.tog{position:fixed;top:64px;left:14px;display:flex;gap:6px;pointer-events:auto}
.tg{font-family:"IBM Plex Mono",monospace;font-size:.66rem;letter-spacing:.03em;border:1px solid var(--line);background:var(--chipbg);border-radius:99px;padding:6px 11px;color:var(--mut);cursor:pointer;-webkit-tap-highlight-color:transparent}
.tg.on{color:var(--gold);border-color:rgba(197,165,106,.6)}
#sh{position:fixed;left:0;right:0;bottom:0;background:var(--card);border-top:1px solid var(--line);border-radius:16px 16px 0 0;padding:10px 16px calc(16px + env(safe-area-inset-bottom));transform:translateY(105%);transition:transform .28s ease;box-shadow:0 -12px 34px rgba(0,0,0,.45);max-height:62vh;overflow-y:auto}
#sh.open{transform:translateY(0)}
.grab{width:38px;height:4px;border-radius:2px;background:var(--line);margin:0 auto 10px}
.shn{font-family:Fraunces,Georgia,serif;font-size:1.35rem;font-weight:600}
.shgrid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px;margin:10px 0}
.shs{background:var(--card2);border:1px solid var(--line);border-radius:8px;padding:8px}.shs .v{font-family:Fraunces,Georgia,serif;font-size:1.05rem;font-weight:600;font-variant-numeric:tabular-nums}.shs .v small{font-size:.7rem;color:var(--mut)}.shs .l{color:var(--mut);font-size:.62rem;margin-top:1px}
.shr{color:var(--mut);font-size:.72rem;margin:2px 0 10px}
.shrm{font-family:"IBM Plex Mono",monospace;font-size:.68rem;color:var(--mut);margin:0 0 10px;line-height:1.7}.shrm b{color:var(--text);font-weight:600}.up{color:#56B584}.dn{color:#D9A441}
.acts{display:grid;grid-template-columns:1fr 1fr;gap:7px}
.act{display:block;text-align:center;text-decoration:none;font-size:.8rem;font-weight:600;border:1px solid var(--line);border-radius:9px;padding:10px 6px;color:var(--text);background:var(--card2);cursor:pointer;-webkit-tap-highlight-color:transparent}
.act.pri{background:var(--gold);color:#0C1413;border-color:var(--gold)}
#toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%) translateY(80px);background:var(--gold);color:#0C1413;font-size:.78rem;font-weight:600;padding:9px 16px;border-radius:99px;transition:transform .25s;z-index:99}
#toast.on{transform:translateX(-50%) translateY(0)}
.foot{position:fixed;right:10px;bottom:calc(64px + env(safe-area-inset-bottom));color:rgba(143,163,155,.7);font-size:.58rem;font-family:"IBM Plex Mono",monospace;pointer-events:none}
${NAJ_NAV_CSS}
#sh{z-index:50}
</style></head><body>
<canvas id=cv></canvas>
<div class=top><div class=mast>Najma <em>نجمة</em> — the map</div><div class=per>${esc2(period)} · tap a community — the rest dims · ⬢ = 3D</div></div>
<div class=tog><span class="tg on" data-m=s>sales</span><span class=tg data-m=ny>net yield</span><span class=tg data-m=su>supply</span><span class=tg data-m=gap>🎯 gap</span><span class=tg id=thm>☀️ light</span></div><div id=leg style="position:fixed;left:14px;bottom:calc(64px + env(safe-area-inset-bottom));z-index:35;background:var(--chipbg);border:1px solid var(--line);border-radius:9px;padding:7px 11px;font-family:'IBM Plex Mono',monospace;font-size:.6rem;color:var(--mut)"><div id=legt style="margin-bottom:4px;color:var(--text)">registered sales</div><div style="display:flex;align-items:center;gap:6px"><span>less</span><span style="display:inline-block;width:86px;height:7px;border-radius:4px;background:linear-gradient(90deg,#3E8A7E,#C5A56A)"></span><span>more</span></div></div>
<div id=sh><div class=grab></div><div class=shn id=shn></div><div class=shr id=shr></div><div class=shgrid id=shg></div><div class=shrm id=shrm></div><div class=acts id=sha></div></div>
<div id=toast></div>
<div class=foot>DLD Open Data · © OpenStreetMap contributors</div>
<script>
var AREAS=${JSON.stringify(list)},AREAS2=${JSON.stringify(list2)},KEY=${JSON.stringify(key || "")},WA=${JSON.stringify(waBot || "")},ESRI=${esriOn ? "true" : "false"};
var SKY=${JSON.stringify(skySlugs||[])},SEL=null;function njslug(x){return String(x||"").toLowerCase().replace(/[^a-z0-9]/g,"")}
var cv=document.getElementById("cv"),ctx=cv.getContext("2d"),dpr=Math.min(2,window.devicePixelRatio||1);
var PAL={dark:{bg:"#0C1413",water:"#0A1A22",rMid:"#152E2A",rMaj:"#2A4742",heatHot:"197,165,106",heatCool:"62,138,126",dotHot:"#C5A56A",dotCool:"#3E8A7E",dotEdge:"#0C1413",label:"#E8E4D8",halo:"rgba(12,20,19,.85)"},light:{bg:"#F2EEE3",water:"#BFD5DB",rMid:"#E0DACA",rMaj:"#CDC5B0",heatHot:"168,133,68",heatCool:"47,110,100",dotHot:"#A88544",dotCool:"#2F6E64",dotEdge:"#F2EEE3",label:"#1A2422",halo:"rgba(242,238,227,.88)"}};
var THM=localStorage.getItem("naj_thm")||((window.matchMedia&&matchMedia("(prefers-color-scheme: light)").matches)?"light":"dark");
document.documentElement.setAttribute("data-theme",THM);
function pal(){return PAL[THM]||PAL.dark}
var MLMAP=null,BASE_TRANSPARENT=false;
// Keep the Esri basemap locked to our canvas transform: our world units are wx/wy at scale
// view.s, so the visible lon/lat window follows directly from the current view.
function syncML(){if(!MLMAP||!W)return;
var lon0=B[0]+((0-view.x)/view.s)/(3000*K),lon1=B[0]+((W-view.x)/view.s)/(3000*K);
var lat0=B[3]-((H-view.y)/view.s)/3000,lat1=B[3]-((0-view.y)/view.s)/3000;
try{MLMAP.jumpTo(MLMAP.cameraForBounds([[lon0,lat0],[lon1,lat1]],{padding:0}))}catch(e){}}
var BM=null,B=[54.98,24.83,55.55,25.36],view={s:1,x:0,y:0},metric="s",W=0,H=0,K=Math.cos(25.1*Math.PI/180);
function wx(lon){return (lon-B[0])*K*3000}function wy(lat){return (B[3]-lat)*3000}
function resize(){W=window.innerWidth;H=window.innerHeight;cv.width=W*dpr;cv.height=H*dpr;cv.style.width=W+"px";cv.style.height=H+"px";draw()}
function fit(){var xs=AREAS.map(function(a){return wx(a.c[0])}),ys=AREAS.map(function(a){return wy(a.c[1])});var x0=Math.min.apply(0,xs),x1=Math.max.apply(0,xs),y0=Math.min.apply(0,ys),y1=Math.max.apply(0,ys);var p=70;var s=Math.min((W-2*p)/(x1-x0||1),(H-2*p)/(y1-y0||1));view.s=s;view.x=(W-s*(x0+x1))/2;view.y=(H-s*(y0+y1))/2}
function mval(a){return metric==="ny"?(a.ny||0):metric==="su"?(a.su||0):metric==="gap"?((a.s||0)/((a.su||0)+40)):(a.s||0)}
var MLBL={s:"registered sales",ny:"net yield %",su:"units in pipeline",gap:"demand vs supply gap"};
function draw(){if(!W)return;var P=pal();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);if(!BASE_TRANSPARENT){ctx.fillStyle=P.bg;ctx.fillRect(0,0,W,H)}ctx.setTransform(dpr*view.s,0,0,dpr*view.s,dpr*view.x,dpr*view.y);
syncML();
if(BM&&!BASE_TRANSPARENT){ctx.fillStyle=P.water;BM.water.forEach(function(r){ctx.beginPath();for(var i=0;i<r.length;i++){var p=r[i];if(i)ctx.lineTo(wx(p[0]),wy(p[1]));else ctx.moveTo(wx(p[0]),wy(p[1]))}ctx.closePath();ctx.fill()});
ctx.strokeStyle=P.rMid;ctx.lineWidth=1.1/view.s;BM.roadsMid.forEach(function(l){ctx.beginPath();for(var i=0;i<l.length;i++){var p=l[i];if(i)ctx.lineTo(wx(p[0]),wy(p[1]));else ctx.moveTo(wx(p[0]),wy(p[1]))}ctx.stroke()});
ctx.strokeStyle=P.rMaj;ctx.lineWidth=2.2/view.s;BM.roadsMajor.forEach(function(l){ctx.beginPath();for(var i=0;i<l.length;i++){var p=l[i];if(i)ctx.lineTo(wx(p[0]),wy(p[1]));else ctx.moveTo(wx(p[0]),wy(p[1]))}ctx.stroke()})}
var mx=0;AREAS.forEach(function(a){if(mval(a)>mx)mx=mval(a)});mx=mx||1;
AREAS.forEach(function(a){var v=mval(a);if(v<=0)return;var r=(26+95*Math.sqrt(v/mx))/view.s;var g=ctx.createRadialGradient(wx(a.c[0]),wy(a.c[1]),0,wx(a.c[0]),wy(a.c[1]),r);var hot=v/mx>0.55;var c=hot?P.heatHot:P.heatCool;g.addColorStop(0,"rgba("+c+",0.34)");g.addColorStop(1,"rgba("+c+",0)");ctx.fillStyle=g;ctx.beginPath();ctx.arc(wx(a.c[0]),wy(a.c[1]),r,0,7);ctx.fill()});
ctx.setTransform(dpr,0,0,dpr,0,0);
var top=AREAS.slice().sort(function(a,b){return mval(b)-mval(a)});
AREAS.forEach(function(a){var x=view.s*wx(a.c[0])+view.x,y=view.s*wy(a.c[1])+view.y;if(x<-30||y<-30||x>W+30||y>H+30)return;var v=mval(a),hot=v/mx>0.55;ctx.fillStyle=hot?P.dotHot:P.dotCool;ctx.strokeStyle=P.dotEdge;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,4.5,0,7);ctx.fill();ctx.stroke()});
ctx.font="600 11px 'IBM Plex Sans',sans-serif";ctx.textAlign="center";var nlab=view.s>((W-140)/((wx(B[2])-wx(B[0]))||1))*2.2?14:8;
top.slice(0,nlab).forEach(function(a){var x=view.s*wx(a.c[0])+view.x,y=view.s*wy(a.c[1])+view.y-9;if(x<10||y<70||x>W-10||y>H-20)return;ctx.lineWidth=3;ctx.strokeStyle=P.halo;ctx.strokeText(a.n,x,y);ctx.fillStyle=P.label;ctx.fillText(a.n,x,y)});}
var ptrs={},lastD=0;
cv.addEventListener("pointerdown",function(e){cv.setPointerCapture(e.pointerId);ptrs[e.pointerId]={x:e.clientX,y:e.clientY,mx:0}});
cv.addEventListener("pointermove",function(e){var p=ptrs[e.pointerId];if(!p)return;var ks=Object.keys(ptrs);var dx=e.clientX-p.x,dy=e.clientY-p.y;p.mx+=Math.abs(dx)+Math.abs(dy);
if(ks.length===1){view.x+=dx;view.y+=dy}else if(ks.length===2){var o=ptrs[ks[0]===String(e.pointerId)?ks[1]:ks[0]];var d=Math.hypot(e.clientX-o.x,e.clientY-o.y);if(lastD){var f=d/lastD;var cx=(e.clientX+o.x)/2,cy=(e.clientY+o.y)/2;zoomAt(cx,cy,f)}lastD=d}
p.x=e.clientX;p.y=e.clientY;requestAnimationFrame(draw)});
function up(e){var p=ptrs[e.pointerId];delete ptrs[e.pointerId];lastD=0;if(p&&p.mx<8)tap(e.clientX,e.clientY)}
cv.addEventListener("pointerup",up);cv.addEventListener("pointercancel",function(e){delete ptrs[e.pointerId];lastD=0});
cv.addEventListener("wheel",function(e){e.preventDefault();zoomAt(e.clientX,e.clientY,e.deltaY<0?1.18:0.85)},{passive:false});
function zoomAt(cx,cy,f){var ns=Math.max(0.5,Math.min(30,view.s*f));f=ns/view.s;view.x=cx-(cx-view.x)*f;view.y=cy-(cy-view.y)*f;view.s=ns;requestAnimationFrame(draw)}
function tap(cx,cy){var best=null,bd=26;AREAS.forEach(function(a){var x=view.s*wx(a.c[0])+view.x,y=view.s*wy(a.c[1])+view.y;var d=Math.hypot(cx-x,cy-y);if(d<bd){bd=d;best=a}});if(best)sheet(best);else document.getElementById("sh").classList.remove("open")}
function fmt(v){return v==null?"—":Number(v).toLocaleString("en-US")}
function sheet(a){document.getElementById("shn").textContent=a.n;
document.getElementById("shr").textContent="Settled figures from the register · "+fmt(a.s)+" sales this period";
document.getElementById("shg").innerHTML=
'<div class=shs><div class=v>'+fmt(a.psf)+'<small>/sqft</small></div><div class=l>median (AED)</div></div>'+
'<div class=shs><div class=v>'+(a.tik?(a.tik/1e6).toFixed(2)+"m":"—")+'</div><div class=l>median ticket</div></div>'+
'<div class=shs><div class=v>'+(a.off==null?"—":a.off+"<small>%</small>")+'</div><div class=l>off-plan</div></div>'+
'<div class=shs><div class=v>'+(a.ny==null?"—":a.ny+"<small>%</small>")+'</div><div class=l>net yield</div></div>'+
'<div class=shs><div class=v>'+(a.gy==null?"—":a.gy+"<small>%</small>")+'</div><div class=l>gross yield</div></div>'+
'<div class=shs><div class=v>'+fmt(a.su)+'</div><div class=l>units in pipeline</div></div>';
var acts=document.getElementById("sha");acts.innerHTML="";
var full=document.createElement("a");full.className="act pri";full.textContent="📊 Full area page";full.href="/area/"+encodeURIComponent(a.n)+"?key="+encodeURIComponent(KEY);acts.appendChild(full);
if(SKY.indexOf(njslug(a.n))>=0){var td=document.createElement("a");td.className="act";td.textContent="⬢ 3D skyline";td.href="/skyline/"+njslug(a.n)+"?key="+encodeURIComponent(KEY);acts.appendChild(td)}
[["✍️ Draft a post","area post "+a.n],["🎯 Client match","client match in "+a.n],["🏗 Launch check","launch check "+a.n]].forEach(function(x){var b=document.createElement(WA?"a":"button");b.className="act";b.textContent=x[0];
if(WA){b.href="https://wa.me/"+WA+"?text="+encodeURIComponent(x[1])}else{b.onclick=function(){(navigator.clipboard?navigator.clipboard.writeText(x[1]):Promise.reject()).then(function(){toast("Copied — paste it to Azimuth")},function(){toast(x[1])})}}
acts.appendChild(b)});
var rmEl=document.getElementById("shrm");var bits=[];
if(a.dl!=null&&a.dl!==0)bits.push(a.dl>0?'<span class=up>▲'+fmt(a.dl)+' sales vs last pulse</span>':'<span class=dn>▼'+fmt(-a.dl)+' vs last pulse</span>');
(a.rm||[]).forEach(function(r){bits.push('<b>'+r[0]+'</b> '+(r[1]?(r[1]/1e6).toFixed(2)+'m':'—'))});
rmEl.innerHTML=bits.join(' · ');rmEl.style.display=bits.length?'':'none';
document.getElementById("sh").classList.add("open")}
function toast(m){var t=document.getElementById("toast");t.textContent=m;t.classList.add("on");setTimeout(function(){t.classList.remove("on")},1800)}
document.querySelectorAll(".tg[data-m]").forEach(function(el){el.onclick=function(){metric=el.getAttribute("data-m");document.querySelectorAll(".tg[data-m]").forEach(function(o){o.classList.remove("on")});el.classList.add("on");var lt=document.getElementById("legt");if(lt)lt.textContent=MLBL[metric]||metric;draw()}});
var thm=document.getElementById("thm");function thmLbl(){thm.textContent=THM==="dark"?"☀️ light":"🌙 dark"}thmLbl();
thm.onclick=function(){THM=THM==="dark"?"light":"dark";try{localStorage.setItem("naj_thm",THM)}catch(e){}document.documentElement.setAttribute("data-theme",THM);thmLbl();
if(MLMAP){fetch("/esri_token?key="+encodeURIComponent(KEY)).then(function(r){return r.json()}).then(function(j){if(j&&j.ok)MLMAP.setStyle("https://basemapstyles-api.arcgis.com/arcgis/rest/services/styles/v2/styles/arcgis/"+(THM==="light"?"light-gray":"dark-gray")+"?token="+encodeURIComponent(j.token))}).catch(function(){})}
draw()};
window.addEventListener("resize",resize);
try{var _mq=new URLSearchParams(location.search).get("m");if(_mq&&{s:1,ny:1,su:1}[_mq]){metric=_mq;document.querySelectorAll(".tg[data-m]").forEach(function(o){o.classList.toggle("on",o.getAttribute("data-m")===metric)})}}catch(e){}
resize();fit();draw();
fetch("/img/mp_basemap").then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(j){BM=j;B=j.bounds||B;draw()}).catch(function(){});
// v57 — MapLibre-PRIMARY map when Esri credentials exist: real vector basemap, four VIEWS
// (dark / light / satellite / data), Arabic labels, UAE worldview, LABEL SANDWICH (our
// layers insert before the style's first symbol layer), community CHOROPLETH from
// /img/mp_areas, and cached drive-time rings via /iso. The offline canvas stays untouched
// as the automatic fallback — any failure and the map still works.
(function(){if(!ESRI)return;
var VIEWS={dark:"arcgis/dark-gray",light:"arcgis/light-gray",sat:"arcgis/imagery",streets:"arcgis/navigation",data:"arcgis/human-geography-dark"};
var VIEW=localStorage.getItem("naj_view")||((THM==="light")?"light":"dark");if(!VIEWS[VIEW])VIEW="dark";
var LANG=localStorage.getItem("naj_lang")||"en";
var TOKEN=null,map=null,AR2=null,ISO_ON=null;
function styleUrl(){return "https://basemapstyles-api.arcgis.com/arcgis/rest/services/styles/v2/styles/"+VIEWS[VIEW]+"?token="+encodeURIComponent(TOKEN)+"&worldview=unitedArabEmirates"+(LANG==="ar"?"&language=ar":"")}
function metricVal(a){return metric==="ny"?(a.ny||0):metric==="su"?(a.su||0):(a.s||0)}
function ramp(v,mx){var t=mx?Math.min(1,v/mx):0;var c1=[62,138,126],c2=[197,165,106];var c=[0,1,2].map(function(i){return Math.round(c1[i]+(c2[i]-c1[i])*t)});return "rgb("+c.join(",")+")"}
function firstSymbol(){var ls=map.getStyle().layers;for(var i=0;i<ls.length;i++){if(ls[i].type==="symbol")return ls[i].id}return undefined}
function paintData(){if(!map||!map.getLayer("naj-fill"))return;var mx=0;AREAS2.forEach(function(a){var v=metricVal(a);if(v>mx)mx=v});
var m=["match",["get","n"]];AREAS2.forEach(function(a){m.push(a.n,ramp(metricVal(a),mx))});m.push("rgba(0,0,0,0)");
map.setPaintProperty("naj-fill","fill-color",m);
var mc=["match",["get","n"]];AREAS.forEach(function(a){var v=metricVal(a),hot=mx&&v/mx>0.55;mc.push(a.n,hot?"#C5A56A":"#3E8A7E")});mc.push("#3E8A7E");
map.setPaintProperty("naj-dot","circle-color",mc);
var mr=["match",["get","n"]];AREAS.forEach(function(a){mr.push(a.n,4+9*Math.sqrt(mx?metricVal(a)/mx:0))});mr.push(4);
map.setPaintProperty("naj-dot","circle-radius",mr);
if(map.getLayer("naj-lab")){var top12=AREAS.slice().sort(function(a,b){return metricVal(b)-metricVal(a)}).slice(0,12).map(function(a){return a.n});
map.setFilter("naj-lab",["in",["get","n"],["literal",top12]])}}
function addData(){var before=firstSymbol();
if(AR2)map.addSource("naj-areas",{type:"geojson",data:AR2});
map.addSource("naj-pts",{type:"geojson",data:{type:"FeatureCollection",features:AREAS.map(function(a){return {type:"Feature",properties:{n:a.n},geometry:{type:"Point",coordinates:a.c}}})}});
if(AR2){map.addLayer({id:"naj-fill",type:"fill",source:"naj-areas",paint:{"fill-color":"rgba(0,0,0,0)","fill-opacity":VIEW==="sat"?0.42:0.34}},before);
map.addLayer({id:"naj-line",type:"line",source:"naj-areas",paint:{"line-color":VIEW==="light"?"rgba(26,36,34,.45)":"rgba(232,228,216,.38)","line-width":1}},before);}
map.addLayer({id:"naj-dot",type:"circle",source:"naj-pts",paint:{"circle-color":"#3E8A7E","circle-radius":5,"circle-stroke-color":VIEW==="light"?"#F2EEE3":"#0C1413","circle-stroke-width":1.5}},before);
map.addLayer({id:"naj-lab",type:"symbol",source:"naj-pts",layout:{"text-field":["get","n"],"text-size":11,"text-offset":[0,1.1],"text-anchor":"top","text-allow-overlap":false},paint:{"text-color":VIEW==="light"?"#1A2422":"#E8E4D8","text-halo-color":VIEW==="light"?"rgba(242,238,227,.9)":"rgba(12,20,19,.9)","text-halo-width":1.4}});
paintData();drawIso();if(SEL)isolate(SEL)}
function isolate(n){SEL=n;if(!map||!map.getLayer("naj-fill"))return;
map.setPaintProperty("naj-fill","fill-opacity",["case",["==",["get","n"],n],(VIEW==="sat"?0.55:0.5),0.07]);
map.setPaintProperty("naj-line","line-color",["case",["==",["get","n"],n],"#C5A56A",(VIEW==="light"?"rgba(26,36,34,.45)":"rgba(232,228,216,.38)")]);
map.setPaintProperty("naj-line","line-width",["case",["==",["get","n"],n],2.5,1]);
if(map.getLayer("naj-dot"))map.setPaintProperty("naj-dot","circle-opacity",["case",["==",["get","n"],n],1,0.25]);}
function unisolate(){SEL=null;if(!map||!map.getLayer("naj-fill"))return;
map.setPaintProperty("naj-fill","fill-opacity",VIEW==="sat"?0.42:0.34);
map.setPaintProperty("naj-line","line-color",VIEW==="light"?"rgba(26,36,34,.45)":"rgba(232,228,216,.38)");
map.setPaintProperty("naj-line","line-width",1);
if(map.getLayer("naj-dot"))map.setPaintProperty("naj-dot","circle-opacity",1);}
function findArea(n){var k=String(n||"").toLowerCase();for(var i=0;i<AREAS2.length;i++){if(AREAS2[i].n.toLowerCase()===k)return AREAS2[i]}return null}
var POP=null;
function wire(){POP=new maplibregl.Popup({closeButton:false,closeOnClick:false,offset:10});
map.on("mousemove",function(e){var fs=map.queryRenderedFeatures(e.point,{layers:(map.getLayer("naj-fill")?["naj-dot","naj-fill"]:["naj-dot"])});
if(!fs.length){POP.remove();map.getCanvas().style.cursor="";return}
map.getCanvas().style.cursor="pointer";var a=findArea(fs[0].properties.n);if(!a)return;
var v=metric==="ny"?(a.ny==null?"—":a.ny+"%"):metric==="su"?fmt(a.su)+" units":metric==="gap"?"gap "+(Math.round(mval(a)*100)/100):fmt(a.s)+" sales";
POP.setLngLat(e.lngLat).setHTML('<div style="font-family:\\'IBM Plex Sans\\',sans-serif;font-size:12px;color:#0C1413"><b>'+a.n+'</b><br>'+v+'</div>').addTo(map)});
map.on("click",function(e){var fs=map.queryRenderedFeatures(e.point,{layers:(map.getLayer("naj-fill")?["naj-dot","naj-fill"]:["naj-dot"])});
if(!fs.length){document.getElementById("sh").classList.remove("open");unisolate();return}
var a=findArea(fs[0].properties.n);if(a){sheet(a);isolate(a.n)}});
map.on("mouseenter","naj-dot",function(){map.getCanvas().style.cursor="pointer"});
map.on("mouseleave","naj-dot",function(){map.getCanvas().style.cursor=""})}
function boot(){var host=document.createElement("div");host.id="mlmap";host.style.cssText="position:fixed;inset:0;z-index:0";document.body.insertBefore(host,cv);
cv.style.display="none";
map=new maplibregl.Map({container:"mlmap",style:styleUrl(),center:[55.23,25.10],zoom:9.6,attributionControl:{compact:true}});
map.on("style.load",function(){addData()});wire()}
function reStyle(){if(!map)return;fetchTok(function(){map.setStyle(styleUrl())})}
function fetchTok(cb){fetch("/esri_token?key="+encodeURIComponent(KEY)).then(function(r){return r.json()}).then(function(j){if(j&&j.ok){TOKEN=j.token;cb()}}).catch(function(){})}
// view chips
var vrow=document.createElement("div");vrow.className="tog";vrow.style.top="104px";
[["dark","🌑 dark"],["light","☀️ light"],["sat","🛰 satellite"],["streets","🛣️ streets"],["data","📊 data"]].forEach(function(v){
var el=document.createElement("span");el.className="tg"+(VIEW===v[0]?" on":"");el.textContent=v[1];el.setAttribute("data-v",v[0]);
el.onclick=function(){VIEW=v[0];try{localStorage.setItem("naj_view",VIEW)}catch(e){}
THM=(VIEW==="light")?"light":"dark";document.documentElement.setAttribute("data-theme",THM);
vrow.querySelectorAll(".tg").forEach(function(o){o.classList.remove("on")});el.classList.add("on");reStyle()};
vrow.appendChild(el)});
var ar=document.createElement("span");ar.className="tg";ar.textContent=LANG==="ar"?"EN":"ع";
ar.onclick=function(){LANG=LANG==="ar"?"en":"ar";try{localStorage.setItem("naj_lang",LANG)}catch(e){}ar.textContent=LANG==="ar"?"EN":"ع";reStyle()};
vrow.appendChild(ar);
// drive-time chips
var irow=document.createElement("div");irow.className="tog";irow.style.top="146px";
var ichip=document.createElement("span");ichip.className="tg";ichip.textContent="⏱ drive-time";irow.appendChild(ichip);
var anchors=[["difc","DIFC"],["downtown","Downtown"],["marina","Marina"],["dxb","DXB apt"],["mediacity","Media City"]];var sub=[];
ichip.onclick=function(){var open=sub.length&&sub[0].style.display!=="none";sub.forEach(function(s){s.style.display=open?"none":""});if(!sub.length){anchors.forEach(function(an){var s=document.createElement("span");s.className="tg";s.textContent=an[1];s.onclick=function(){if(ISO_ON===an[0]){ISO_ON=null;s.classList.remove("on");drawIso();return}ISO_ON=an[0];sub.forEach(function(o){o.classList.remove("on")});s.classList.add("on");loadIso(an[0])};irow.appendChild(s);sub.push(s)})}};
function loadIso(a){fetch("/iso?key="+encodeURIComponent(KEY)+"&anchor="+a).then(function(r){return r.json()}).then(function(j){if(j&&j.ok){ISO_GEO=j.geo;drawIso()}else{toast(j&&j.note?j.note:"drive-time not enabled yet")}}).catch(function(){toast("drive-time unavailable")})}
var ISO_GEO=null;
function drawIso(){if(!map)return;["iso-fill","iso-line"].forEach(function(id){if(map.getLayer(id))map.removeLayer(id)});if(map.getSource("naj-iso"))map.removeSource("naj-iso");
if(!ISO_ON||!ISO_GEO)return;var before=firstSymbol();
map.addSource("naj-iso",{type:"geojson",data:ISO_GEO});
map.addLayer({id:"iso-fill",type:"fill",source:"naj-iso",paint:{"fill-color":"#D9A441","fill-opacity":0.10}},before);
map.addLayer({id:"iso-line",type:"line",source:"naj-iso",paint:{"line-color":"#D9A441","line-width":1.6,"line-dasharray":[2,2]}},before)}
// metric + theme chips re-wire for ML mode
document.querySelectorAll(".tg[data-m]").forEach(function(el){var old=el.onclick;el.onclick=function(){old.call(el);paintData()}});
var thmEl=document.getElementById("thm");if(thmEl)thmEl.style.display="none";  // theme folded into views
// assets then boot
var css=document.createElement("link");css.rel="stylesheet";css.href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css";document.head.appendChild(css);
var s=document.createElement("script");s.src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js";
s.onload=function(){fetchTok(function(){
fetch("/img/mp_areas").then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(j){AR2=j}).catch(function(){AR2=null}).then(function(){
if(!window.maplibregl)return;document.querySelector(".tog").insertAdjacentElement("afterend",vrow);vrow.insertAdjacentElement("afterend",irow);boot()})})};
s.onerror=function(){};document.head.appendChild(s);})();
</script>${najNav(key, "map")}</body></html>`;
}


// v58 — CLIENT BRIEFING (/r/<id>): a polished, client-safe page Naj builds from chat in
// seconds ("report business bay for Ahmed") and forwards after a viewing. Snapshot frozen
// in KV (60d TTL, unguessable id), no keys, no internal controls, satellite hero, every
// figure sourced. Our native answer to "StoryMaps for clients".
function renderReport(sn, esriTok, poly) {
  const esc2 = (x) => String(x == null ? "" : x).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const a = sn.area || {}; const num2 = (v) => (v == null ? "—" : Number(v).toLocaleString("en-US"));
  const slug = String(a.area || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const rooms = najRooms(a.byRoom);
  const rmax = Math.max(...rooms.map(r => r[1].medianAed || 0), 1);
  const period = sn.period ? (String(sn.period[0] || "") + " → " + String(sn.period[1] || "")) : "";
  const amen = sn.amen || null;
  return '<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name=robots content=noindex><title>' + esc2(a.area) + ' — Najma briefing</title><link rel=icon href=/naj_icon.svg><meta name=theme-color content="#0C1413">' + NAJ_FONTS + '<style>' +
    ':root{--ink:#0C1413;--card:#131F1D;--card2:#182823;--line:#24352F;--text:#E8E4D8;--mut:#8FA39B;--gold:#C5A56A;--teal:#3E8A7E}' +
    'body{font-family:"IBM Plex Sans",system-ui,sans-serif;background:var(--ink);color:var(--text);margin:auto;padding:0 14px 48px;max-width:560px}' +
    '.hero{margin:0 -14px;padding:150px 18px 18px;background-image:linear-gradient(180deg,rgba(12,20,19,.10) 0%,rgba(12,20,19,.55) 55%,rgba(12,20,19,.93) 86%,#0C1413 100%),url(/img/sat_' + slug + ');background-size:cover;background-position:center}' +
    '.brand{font-family:"IBM Plex Mono",monospace;font-size:.62rem;letter-spacing:.16em;color:var(--gold);text-transform:uppercase}' +
    'h1{font-family:Fraunces,Georgia,serif;font-size:2rem;font-weight:600;margin:.25rem 0 .15rem;text-shadow:0 2px 16px rgba(12,20,19,.8)}' +
    '.for{color:#B8C4BD;font-size:.85rem;text-shadow:0 1px 8px rgba(12,20,19,.8)}' +
    '.per{font-family:"IBM Plex Mono",monospace;font-size:.66rem;color:var(--mut);margin-top:4px}' +
    '.grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin:14px 0 10px}' +
    '.st{background:var(--card);border:1px solid var(--line);border-radius:9px;padding:12px}.st .v{font-family:Fraunces,Georgia,serif;font-size:1.45rem;font-weight:600;font-variant-numeric:tabular-nums}.st .v small{font-size:.8rem;color:var(--mut)}.st .l{color:var(--mut);font-size:.72rem;margin-top:2px}' +
    '.card{background:var(--card);border:1px solid var(--line);border-radius:11px;padding:14px;margin-bottom:10px}' +
    'h2{font-size:.68rem;letter-spacing:.14em;color:var(--gold);text-transform:uppercase;margin:0 0 .6rem;font-weight:600}' +
    '.srow{display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-bottom:1px solid #182823;font-size:.83rem}.srow:last-child{border-bottom:none}.srow .sv{color:var(--mut);white-space:nowrap;font-variant-numeric:tabular-nums}' +
    '.arow{display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #182823}.arow:last-of-type{border-bottom:none}.nm{flex:0 0 42%;font-size:.82rem}.tr{flex:1;height:6px;border-radius:3px;background:var(--card2);overflow:hidden}.tr i{display:block;height:100%;background:var(--teal)}.ct{font-size:.74rem;color:var(--mut);min-width:46px;text-align:right;font-variant-numeric:tabular-nums}' +
    '.note{color:var(--mut);font-size:.72rem;margin-top:.5rem}.foot{color:var(--mut);font-size:.7rem;line-height:1.6;margin-top:16px;border-top:1px solid var(--line);padding-top:12px}' +
    '</style></head><body>' +
    '<div class=hero><div class=brand>Najma · market briefing</div><h1>' + esc2(a.area) + '</h1>' +
    (sn.client ? '<div class=for>Prepared for ' + esc2(sn.client) + '</div>' : '') +
    '<div class=per>' + esc2(period) + ' · prepared ' + esc2(String(sn.at || "").slice(0, 10)) + ' · settled figures, not asking prices</div></div>' +
    '<div class=grid>' +
    '<div class=st><div class=v>' + num2(a.sales) + '</div><div class=l>sales registered this period</div></div>' +
    '<div class=st><div class=v>' + num2(a.medianAedSqft) + '<small>/sqft</small></div><div class=l>median settled (AED)</div></div>' +
    '<div class=st><div class=v>' + (a.medianTicketAed ? (a.medianTicketAed / 1e6).toFixed(2) + 'm' : '—') + '</div><div class=l>median ticket (AED)</div></div>' +
    '<div class=st><div class=v>' + (a.netYieldPct == null ? '—' : a.netYieldPct + '<small>%</small>') + '</div><div class=l>net rental yield</div></div></div>' +
    '<div class=card><h2>The yield, honestly</h2>' +
    '<div class=srow><span>Gross yield (registered rents ÷ registered prices)</span><span class=sv>' + (a.grossYieldPct == null ? '—' : a.grossYieldPct + '%') + '</span></div>' +
    '<div class=srow><span>Typical service charge</span><span class=sv>' + (a.serviceChargeAedSqftYr == null ? '—' : a.serviceChargeAedSqftYr + ' AED/sqft/yr') + '</span></div>' +
    '<div class=srow><span><b>Net to the owner</b></span><span class=sv style="color:var(--gold);font-weight:600">' + (a.netYieldPct == null ? '—' : a.netYieldPct + '%') + '</span></div>' +
    '<div class=note>Most portals quote gross. Net is what actually lands after the building is paid for.</div></div>' +
    (rooms.length ? '<div class=card><h2>What each layout actually sells for</h2>' + rooms.map(([rb, r]) =>
      '<div class=arow><span class=nm>' + esc2(rb) + ' <span style="color:#8FA39B;font-size:.68rem">' + num2(r.sales) + ' sales</span></span><span class=tr><i style="width:' + Math.round(100 * (r.medianAed || 0) / rmax) + '%"></i></span><span class=ct>' + (r.medianAed ? (r.medianAed / 1e6).toFixed(2) + 'm' : '—') + (r.p25Aed && r.p75Aed ? '<br><span style="color:#8FA39B;font-size:.62rem">' + (r.p25Aed / 1e6).toFixed(2) + '–' + (r.p75Aed / 1e6).toFixed(2) + '</span>' : '') + '</span></div>').join('') +
      '<div class=note>Median settled prices from the register; the range is the middle half of transactions (p25–p75).</div></div>' : '') +
    (amen && amen.length ? '<div class=card><h2>Around the community</h2>' + amen.map(x =>
      '<div class=srow><span>' + esc2(x.label) + '</span><span class=sv>' + esc2(x.value) + '</span></div>').join('') +
      '<div class=note>Nearest points of interest, geocoded once from the community centre.</div></div>' : '') +
    ((a.pop || a.households) ? '<div class=card><h2>Who lives here</h2>' +
      (a.pop ? '<div class=srow><span>Population</span><span class=sv>' + num2(a.pop) + '</span></div>' : '') +
      (a.households ? '<div class=srow><span>Households</span><span class=sv>' + num2(a.households) + '</span></div>' : '') +
      (a.densityKm2 ? '<div class=srow><span>Density</span><span class=sv>' + num2(a.densityKm2) + '/km²</span></div>' : '') +
      '<div class=note>Dubai Statistics Center, by community.</div></div>' : '') +
    (sn.sup ? '<div class=card><h2>What is being built here</h2>' +
      '<div class=srow><span>Units in the registered pipeline</span><span class=sv>' + num2(sn.sup.units) + '</span></div>' +
      '<div class=srow><span>Active registered projects</span><span class=sv>' + num2(sn.sup.projects) + '</span></div>' +
      (sn.sup.nextEnd ? '<div class=srow><span>Next completion on file</span><span class=sv>' + esc2(String(sn.sup.nextEnd).slice(0, 10)) + '</span></div>' : '') + '</div>' : '') +
    ((sn.projs || []).length ? '<div class=card><h2>Projects on the register</h2>' + sn.projs.map(pj =>
      '<div class=srow><span>' + esc2(pj.project) + (pj.escrowRegistered ? ' <span style="color:#56B584;font-size:.7rem">escrow ✓</span>' : '') + '</span><span class=sv>' + (pj.percentComplete != null ? pj.percentComplete + '% built' : esc2(pj.status || '')) + '</span></div>').join('') + '</div>' : '') +
    (esriTok ? '<div class=card style="padding:8px"><div id=bmap style="height:330px;border-radius:8px"></div><div class=note style="padding:0 6px 4px">Pan and zoom — the gold line is the community boundary. Imagery: Esri.</div></div>' +
      '<link rel=stylesheet href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css"><script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></' + 'script>' +
      '<script>(function(){try{var P=' + JSON.stringify(poly || null) + ',A=' + JSON.stringify((sn.amen || []).slice(0, 6)) + ';' +
      'var m=new maplibregl.Map({container:"bmap",style:"https://basemapstyles-api.arcgis.com/arcgis/rest/services/styles/v2/styles/arcgis/imagery?token=' + encodeURIComponent(esriTok) + '&worldview=unitedArabEmirates",center:[55.27,25.19],zoom:12,attributionControl:{compact:true}});' +
      'm.on("load",function(){if(P){m.addSource("cm",{type:"geojson",data:{type:"Feature",geometry:P}});' +
      'm.addLayer({id:"cmf",type:"fill",paint:{"fill-color":"#C5A56A","fill-opacity":0.08},source:"cm"});' +
      'm.addLayer({id:"cml",type:"line",paint:{"line-color":"#C5A56A","line-width":2.5},source:"cm"});' +
      'var cs=(P.type==="Polygon"?P.coordinates[0]:P.coordinates[0][0]);var xs=cs.map(function(c){return c[0]}),ys=cs.map(function(c){return c[1]});' +
      'm.fitBounds([[Math.min.apply(0,xs),Math.min.apply(0,ys)],[Math.max.apply(0,xs),Math.max.apply(0,ys)]],{padding:34,animate:false});}});' +
      '}catch(e){}})();</' + 'script>' : '') +
    '<div class=foot>Every figure on this page comes from official registers: Dubai Land Department (DLD) Open Data (sales and Ejari rentals; contains information from the Government of Dubai) and the DLD registered-projects file. Satellite imagery: Esri World Imagery. Communities under 20 settled sales are not reported; layouts shown only at 8+ sales. Figures are period medians, not valuations of any specific unit. Prepared with Najma.</div>' +
    '</body></html>';
}


// v61 — THE STUDIO (/studio): six editorial post-card templates. MapLibre renders the Esri
// style (newspaper / midcentury / blueprint / antique / colored-pencil / nova) into a
// 1080×1080 buffer (preserveDrawingBuffer), Najma chrome is painted on a canvas overlay,
// "save card" composites both into a PNG she downloads or long-presses. Content only —
// the working map is untouched.
function renderStudio(latestRaw, key, esriOn) {
  let d = null; try { d = JSON.parse(latestRaw || "null"); } catch (e) {}
  if (!esriOn) return '<!doctype html><meta charset=utf-8><body style="font-family:system-ui;background:#0C1413;color:#E8E4D8;padding:2rem"><h2 style="color:#C5A56A">Studio</h2><p>The studio needs the Esri basemap credential.</p>';
  if (!d || !d.transactions) return '<!doctype html><meta charset=utf-8><body style="font-family:system-ui;background:#0C1413;color:#E8E4D8;padding:2rem"><h2 style="color:#C5A56A">Studio</h2><p>No market data yet.</p>';
  const t = d.transactions, mo = d.monthly || {};
  const sup = (d.projects && d.projects.supplyByArea) || {};
  const wk = (t.weekly || []); const lastFull = wk.length >= 2 ? wk[wk.length - 2] : null;
  const areas = (d.areaIntel && d.areaIntel.areas || []).filter(a => DXB_COORDS[a.area.toLowerCase()]).map(a => ({
    n: a.area, c: DXB_COORDS[a.area.toLowerCase()], psf: a.medianAedSqft, tik: a.medianTicketAed,
    off: a.offPlanPct, ny: a.netYieldPct, su: (sup[a.area] && sup[a.area].units) || 0,
    rm: najRooms(a.byRoom).slice(0, 2).map(([k, r]) => [k, r.medianAed])
  }));
  const DATA = { weekBn: lastFull ? lastFull.valueAedBn : null, week: lastFull ? lastFull.week : "",
    periodFrom: t.periodFrom, periodTo: t.periodTo, salesBn: t.salesValueAedBn, salesCount: t.salesCount,
    ytdBn: mo.ytdValueAedBn, ytdSales: mo.ytdSales, areas };
  return `<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>Najma studio</title><link rel=icon href=/naj_icon.svg>${NAJ_FONTS}<link rel=stylesheet href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css"><style>
:root{--ink:#0C1413;--card:#131F1D;--line:#24352F;--text:#E8E4D8;--mut:#8FA39B;--gold:#C5A56A}
body{margin:0;background:var(--ink);color:var(--text);font-family:"IBM Plex Sans",system-ui,sans-serif;padding:14px 12px 90px;display:flex;flex-direction:column;align-items:center;gap:12px}
h1{font:600 1.4rem Fraunces,Georgia,serif;margin:.2rem 0 0;align-self:flex-start}h1 em{font-style:normal;color:var(--gold)}
.row{display:flex;flex-wrap:wrap;gap:6px;align-self:flex-start}
.tg{font-family:"IBM Plex Mono",monospace;font-size:.66rem;border:1px solid var(--line);background:rgba(19,31,29,.85);border-radius:99px;padding:6px 11px;color:var(--mut);cursor:pointer}
.tg.on{color:var(--gold);border-color:rgba(197,165,106,.6)}
select{background:var(--card);color:var(--text);border:1px solid var(--line);border-radius:8px;padding:7px 10px;font-family:"IBM Plex Sans",sans-serif;font-size:.8rem}
#stage{position:relative;width:min(92vw,540px);aspect-ratio:1/1;border-radius:12px;overflow:hidden;border:1px solid var(--line)}
#smap{position:absolute;inset:0}#chrome{position:absolute;inset:0;pointer-events:none;width:100%;height:100%}
.act{font-size:.85rem;font-weight:600;background:var(--gold);color:#0C1413;border:none;border-radius:9px;padding:11px 22px;cursor:pointer}
#out{max-width:min(92vw,540px);display:none;border-radius:12px;border:1px solid var(--line)}
.hint{color:var(--mut);font-size:.72rem;max-width:min(92vw,540px)}
${NAJ_NAV_CSS}</style></head><body>
<h1>Najma <em>نجمة</em> — studio</h1>
<div class=row id=tpls></div>
<div class=row><select id=asel></select></div>
<div id=stage><div id=smap></div><canvas id=chrome width=1080 height=1080></canvas></div>
<div class=row><button class=act id=save>Save card</button><span class=hint id=st>pick a template — the map is live, drag it until the frame feels right, then save</span></div>
<img id=out alt="your card — long-press to save">
${najNav(key, "charts")}
<script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
<script>
var D=${JSON.stringify(DATA)},KEY=${JSON.stringify(key || "")};
var TPL={
 front:{name:"📰 Front Page",style:"arcgis/newspaper",scope:"city",ink:"#1A1A1A",paper:"#F2EEE3",acc:"#8A1F1F"},
 mid:{name:"🏝 Postcard",style:"arcgis/midcentury",scope:"area",ink:"#2B2320",paper:"#F0E7D8",acc:"#C24F2E"},
 blue:{name:"📐 Blueprint",style:"open/blueprint",scope:"area",ink:"#EAF2FA",paper:"#123A5F",acc:"#EAF2FA"},
 ant:{name:"🧭 Explorer",style:"arcgis/modern-antique",scope:"city",ink:"#3A2E20",paper:"#EFE6D2",acc:"#7A5B2E"},
 soft:{name:"🎨 Soft Map",style:"arcgis/colored-pencil",scope:"area",ink:"#33403B",paper:"#F6F3EA",acc:"#3E8A7E"},
 nova:{name:"🌃 Night Signal",style:"arcgis/nova",scope:"area",ink:"#E8F4FF",paper:"#0A1626",acc:"#37C0F5"}};
var cur="front",AREA=D.areas[0]||null,TOKEN=null,map=null,POLY={};
var tr=document.getElementById("tpls");
Object.keys(TPL).forEach(function(k){var el=document.createElement("span");el.className="tg"+(k===cur?" on":"");el.textContent=TPL[k].name;el.onclick=function(){cur=k;tr.querySelectorAll(".tg").forEach(function(o){o.classList.remove("on")});el.classList.add("on");sync()};tr.appendChild(el)});
var sel=document.getElementById("asel");
D.areas.forEach(function(a,i){var o=document.createElement("option");o.value=i;o.textContent=a.n;sel.appendChild(o)});
sel.onchange=function(){AREA=D.areas[+sel.value];sync()};
function fmt(v){return v==null?"—":Number(v).toLocaleString("en-US")}
function styleUrl(){return "https://basemapstyles-api.arcgis.com/arcgis/rest/services/styles/v2/styles/"+TPL[cur].style+"?token="+encodeURIComponent(TOKEN)+"&worldview=unitedArabEmirates"}
function fitScope(){if(!map)return;if(TPL[cur].scope==="city"){map.jumpTo({center:[55.22,25.11],zoom:9.4});return}
var ALIAS={"DUBAI SOUTH":"Madinat Al Mataar","DUBAI HILLS":"DUBAI HILLS ESTATE"};
var pg=AREA&&(POLY[AREA.n]||POLY[ALIAS[AREA.n]]);if(pg){var cs=(pg.type==="Polygon"?pg.coordinates[0]:pg.coordinates[0][0]);var xs=cs.map(function(c){return c[0]}),ys=cs.map(function(c){return c[1]});map.fitBounds([[Math.min.apply(0,xs),Math.min.apply(0,ys)],[Math.max.apply(0,xs),Math.max.apply(0,ys)]],{padding:150,animate:false})}
else if(AREA)map.jumpTo({center:AREA.c,zoom:12.4})}
function addPoly(){if(!map)return;["st-f","st-l"].forEach(function(id){if(map.getLayer(id))map.removeLayer(id)});if(map.getSource("st"))map.removeSource("st");
var pg=TPL[cur].scope==="area"&&AREA&&(POLY[AREA.n]||POLY[{"DUBAI SOUTH":"Madinat Al Mataar"}[AREA.n]]);if(!pg)return;
map.addSource("st",{type:"geojson",data:{type:"Feature",geometry:pg}});
map.addLayer({id:"st-f",type:"fill",source:"st",paint:{"fill-color":TPL[cur].acc,"fill-opacity":0.10}});
map.addLayer({id:"st-l",type:"line",source:"st",paint:{"line-color":TPL[cur].acc,"line-width":3}})}
function chrome(){var c=document.getElementById("chrome"),x=c.getContext("2d");x.clearRect(0,0,1080,1080);
var T=TPL[cur],a=AREA||{};
function band(y,h,col,al){x.globalAlpha=al;x.fillStyle=col;x.fillRect(0,y,1080,h);x.globalAlpha=1}
function txt(str,px,py,size,font,col,align,ls){x.fillStyle=col;x.textAlign=align||"left";x.font=size+"px "+font;if(ls){x.save();str=String(str).split("").join(String.fromCharCode(8202));}x.fillText(str,px,py);if(ls)x.restore()}
var srcLine="Source: Dubai Land Department (DLD) Open Data · basemap © Esri";
if(cur==="front"){band(0,240,T.paper,.96);band(880,200,T.paper,.96);
txt("THE NAJMA REGISTER",540,74,34,"700 'IBM Plex Mono',monospace",T.ink,"center");
x.strokeStyle=T.ink;x.lineWidth=3;x.beginPath();x.moveTo(60,92);x.lineTo(1020,92);x.stroke();
txt((D.periodTo||"")+"  ·  DUBAI, U.A.E.",540,122,20,"'IBM Plex Mono',monospace",T.ink,"center");
txt("DUBAI REGISTERS AED "+(D.weekBn!=null?D.weekBn:D.salesBn)+"BN WEEK",540,190,52,"600 Fraunces,Georgia,serif",T.ink,"center");
txt(fmt(D.salesCount)+" sales settled "+D.periodFrom+" – "+D.periodTo,540,226,22,"'IBM Plex Sans',sans-serif",T.ink,"center");
txt("Where the money moved — registered sales by community",540,930,26,"600 'IBM Plex Sans',sans-serif",T.ink,"center");
txt(srcLine,540,1046,18,"'IBM Plex Mono',monospace",T.ink,"center");}
if(cur==="mid"){band(700,380,T.paper,.94);
txt("COMMUNITY OF THE WEEK",90,780,24,"700 'IBM Plex Mono',monospace",T.acc);
txt(a.n||"",90,856,64,"600 Fraunces,Georgia,serif",T.ink);
txt((a.psf?fmt(a.psf)+" AED/sqft settled":"")+(a.ny!=null?"   ·   net yield "+a.ny+"%":""),90,905,26,"'IBM Plex Sans',sans-serif",T.ink);
txt((a.rm||[]).map(function(r){return r[0]+" "+(r[1]/1e6).toFixed(2)+"m"}).join("   ·   "),90,945,24,"'IBM Plex Mono',monospace",T.ink);
txt(srcLine,90,1030,18,"'IBM Plex Mono',monospace",T.ink);
x.strokeStyle=T.acc;x.lineWidth=6;x.strokeRect(34,34,1012,1012);}
if(cur==="blue"){x.strokeStyle=T.ink;x.lineWidth=2;x.strokeRect(40,40,1000,1000);x.strokeRect(52,52,976,976);
band(60,150,T.paper,.88);
txt("NAJMA — SUPPLY DRAWING NO. "+((D.periodTo||"").replace(/-/g,"")),80,110,24,"'IBM Plex Mono',monospace",T.ink);
txt((fmt(a.su)||"0")+" UNITS DRAWN UP: "+(a.n||""),80,160,40,"600 'IBM Plex Mono',monospace",T.ink);
band(940,90,T.paper,.88);
txt("registered pipeline · escrow-gated · DLD projects file · basemap © Esri",80,995,20,"'IBM Plex Mono',monospace",T.ink);
x.strokeStyle=T.ink;x.strokeRect(830,880,200,60);txt("NAJMA نجمة",930,918,22,"700 'IBM Plex Mono',monospace",T.ink,"center");}
if(cur==="ant"){band(0,190,T.paper,.93);
txt("✦  CHARTING THE YEAR  ✦",540,82,30,"700 'IBM Plex Mono',monospace",T.acc,"center");
txt("AED "+(D.ytdBn||"—")+" billion · "+fmt(D.ytdSales)+" voyages settled",540,140,34,"600 Fraunces,Georgia,serif",T.ink,"center");
txt("registered upon the ledgers of the Dubai Land Department, anno "+String(D.periodTo||"").slice(0,4),540,172,20,"italic 'IBM Plex Sans',sans-serif",T.ink,"center");
band(1010,70,T.paper,.93);txt(srcLine,540,1052,18,"'IBM Plex Mono',monospace",T.ink,"center");}
if(cur==="soft"){band(760,320,T.paper,.92);
txt("A gentler look at "+(a.n||""),90,830,42,"600 Fraunces,Georgia,serif",T.ink);
txt((a.rm&&a.rm.length?("A "+a.rm[0][0]+" here settles around "+(a.rm[0][1]/1e6).toFixed(2)+"m — the register's number, not the listing's."):("Median settled: "+fmt(a.psf)+" AED/sqft")),90,880,26,"'IBM Plex Sans',sans-serif",T.ink);
txt("for families doing the maths",90,922,22,"italic 'IBM Plex Sans',sans-serif",T.acc);
txt(srcLine,90,1030,18,"'IBM Plex Mono',monospace",T.ink);}
if(cur==="nova"){band(0,10,T.acc,1);band(1070,10,T.acc,1);
band(740,340,T.paper,.82);
txt("OFF-PLAN SIGNAL",90,810,26,"700 'IBM Plex Mono',monospace",T.acc);
txt(a.n||"",90,880,58,"600 Fraunces,Georgia,serif",T.ink);
txt((a.off!=null?a.off+"% of sales are off-plan":"")+(a.psf?"  ·  "+fmt(a.psf)+" AED/sqft":""),90,925,26,"'IBM Plex Sans',sans-serif",T.ink);
txt(srcLine,90,1030,18,"'IBM Plex Mono',monospace",T.ink);}
txt("NAJMA نجمة",1000,120,26,"700 'IBM Plex Mono',monospace",(cur==="front"||cur==="mid"||cur==="ant"||cur==="soft")?TPL[cur].ink:"#C5A56A","right");}
var CURSTYLE="";
function sync(){document.fonts.ready.then(function(){chrome()});sel.style.display=TPL[cur].scope==="area"?"":"none";
if(!map)return;
var u=styleUrl();
if(u!==CURSTYLE){CURSTYLE=u;map.setStyle(u);map.once("style.load",function(){fitScope();addPoly()})}
else{fitScope();addPoly()}}
function boot(){CURSTYLE=styleUrl();map=new maplibregl.Map({container:"smap",style:CURSTYLE,center:[55.22,25.11],zoom:9.4,attributionControl:false,preserveDrawingBuffer:true,pixelRatio:2});
map.on("style.load",function(){fitScope();addPoly()});sync()}
document.getElementById("save").onclick=function(){var o=document.createElement("canvas");o.width=1080;o.height=1080;var g=o.getContext("2d");
g.drawImage(map.getCanvas(),0,0,1080,1080);g.drawImage(document.getElementById("chrome"),0,0);
var img=document.getElementById("out");img.src=o.toDataURL("image/png");img.style.display="block";
document.getElementById("st").textContent="rendered below — long-press (or right-click) the image to save, then post";img.scrollIntoView({behavior:"smooth"})};
fetch("/esri_token?key="+encodeURIComponent(KEY)).then(function(r){return r.json()}).then(function(j){if(!j||!j.ok)throw 0;TOKEN=j.token;
return fetch("/img/mp_areas").then(function(r){return r.ok?r.json():null})}).then(function(ar){
if(ar&&ar.features)ar.features.forEach(function(f){POLY[f.properties.n]=f.geometry});boot()}).catch(function(){document.getElementById("st").textContent="studio unavailable — Esri token failed"});
</script></body></html>`;
}


// v63 — SKYLINE VIEWER (/skyline/<slug>): CityEngine massing exported as GLB (sky_<slug> in
// KV), rendered in three.js with orbit controls and status filters. Materials carry the CGA
// palette: ink-grey existing / teal construction / gold pipeline — meshes are classified by
// material color, which is what the filter chips toggle. Register-grounded massing, in 3D,
// inside Najma.
// v72 - UNIT CARDS: buildings with card galleries per drill key, label helper, and the gallery page
const CARD_BUILDINGS = { imtiaz: ["symphony"] };
function cardLabel(t) { return String(t || "").replace(/_/g, " ").replace(/MasterSuite 1BR/, "Master Suite 1BR").replace(/4BR Duplex (lower|upper)/, "4BR Duplex - $1"); }
// v73 - HOME: the developer grid. Ten cards, two by five, one per developer on Najjuko's list; tap -> /dev. Logos come from
// KV logo_<key> (/img/logo_<key>) with a monogram fallback so a missing logo never breaks the grid.
const TIER_GLYPH = { crown: "M4 18h16l-1.5-9-4.5 4-2-7-2 7-4.5-4z", gem: "M6 3h12l4 6-10 12L2 9z", leaf: "M20 4C10 4 4 10 4 20c10 0 16-6 16-16zM4 20 14 10", spark: "M12 2l2.2 6.8L21 11l-6.8 2.2L12 20l-2.2-6.8L3 11l6.8-2.2z", key: "M14 3a5 5 0 1 0 4.6 7L21 12.4l-2 2-2-2-2 2-2-2-1.4 1.4A5 5 0 0 0 14 3z" };
function tierSvg(icon) { return '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#C5A56A" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="' + (TIER_GLYPH[icon] || TIER_GLYPH.spark) + '"/></svg>'; }
function devLogo(dv, size) {
  const mono = dv.name.replace(/[^A-Za-z&]/g, "").slice(0, 2).toUpperCase();
  const fb = '<div class=mono style="width:' + size + 'px;height:' + size + 'px;line-height:' + size + 'px;font-size:' + Math.round(size * .38) + 'px' + (dv.logo ? ';display:none' : '') + '">' + mono + '</div>';
  // img first, monogram hidden behind it; a failed logo hides itself and reveals the monogram (no HTML inside the attribute)
  // logo plates are 2:1 (wordmarks fill the width, square marks fill the height); the monogram fallback stays square
  return (dv.logo ? '<img class=logo src="' + dv.logo + '" alt="" width=' + (size * 2) + ' height=' + size + ' onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'block\'">' : '') + fb;
}
// v73.4 - COMPARE MODE on the cover (Kendall, 2 Sep): one filter, all eleven answers at once. The tiles keep their places and
// "flip" to a back face showing the chosen metric for the chosen bedroom / price band, with a bar scaled to the largest value
// and a rank. Tapping a flipped tile still opens that developer. s = { mode, bed, band, metric, sort } from the query string.
const CMP_METRICS = { price: "median price", sqm: "AED / m²", sales: "sales 2026", range: "price range", offplan: "off-plan share", rent: "median rent" };
function renderHome(bd, key, cmp, s) {
  s = s || {}; const K = encodeURIComponent(key); const compare = s.mode === "compare" && cmp && cmp.developers;
  const fm = (n) => n == null ? "-" : (n >= 1e9 ? (n / 1e9).toFixed(1) + " bn" : n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 2) + " M" : Math.round(n).toLocaleString("en-US"));
  const q = (o) => { const p = Object.assign({ mode: "compare", bed: s.bed || "all", band: s.band || "all", metric: s.metric || "range", sort: s.sort || "", tier: s.tier || "", life: s.life || "" }, o); return '/home?' + Object.keys(p).filter(k => p[k]).map(k => k + '=' + encodeURIComponent(p[k])).join('&') + '&key=' + K; };
  let tiles = "", bar = "";
  if (!compare) {
    tiles = (bd.developers || []).map(dv => {
      // default view = clean: logo, name, tier (and a quiet "modelled" mark). Numbers live ONLY in compare mode (Kendall, 2 Sep).
      return '<a class=tile href="/dev?d=' + encodeURIComponent(dv.key) + '&key=' + K + '">' + devLogo(dv, 56) +
        '<div class=nm>' + dv.name + '</div><div class=tier>' + tierSvg(dv.icon) + '<span>' + dv.segment_label + '</span></div>' +
        (dv.ours && dv.ours.length ? '<div class=kpi><b style="color:#8FC7B9">' + dv.ours.length + ' modelled</b></div>' : '') + '</a>';
    }).join("");
    bar = '<div class=chips><a class="chip on" href="' + q({ bed: "2", metric: "range" }) + '">compare mode →</a></div>';
  } else {
    const bed = s.bed || "all", band = s.band || "all", metric = CMP_METRICS[s.metric] ? s.metric : "range"; const cut = bed + "|" + band;
    // tier 2: a lifestyle / vicinity tag narrows the same bedroom x budget cut (cells precomputed by build_compare.py: life["bed|band|tag"])
    const life = s.life && cmp.life && cmp.life[s.life] ? s.life : "";
    const val = (dv) => {                                              // -> { v: number|null, big: string, sub: string, more: string }
      const c = cmp.developers[dv.key] || {}; const x = life ? (c.life || {})[cut + "|" + life] : (c.cells || {})[cut]; const r = (c.rents || {})[bed];
      const am = c.amenities && c.amenities.items && c.amenities.items.length ? c.amenities.items.filter(a => a.share >= 0.25).slice(0, 5).map(a => a.label).join(" · ") : "";
      const more = (x && x.areas && x.areas.length ? '<div class=bs>' + x.areas.slice(0, 2).join(" · ") + '</div>' : '') + (life && am ? '<div class="bs am">' + am + ' <i>developer site</i></div>' : '');
      if (life && !x) return { v: null, big: "—", sub: "none in " + cmp.life[life] + " for this cut", more: "" };
      if (life && x) return { v: x.median, big: "AED " + fm(x.p10) + " – " + fm(x.p90), sub: "median " + fm(x.median) + " · " + x.n + " sales", more };
      if (metric === "rent") return r ? { v: r.median, big: "AED " + fm(r.median), sub: r.n + " Ejari contracts / yr" } : { v: null, big: "—", sub: "no rent data" };
      if (!x) return { v: null, big: "—", sub: "no sales in this cut" };
      if (metric === "price") return { v: x.median, big: "AED " + fm(x.median), sub: fm(x.p10) + " – " + fm(x.p90) + " · " + x.n + " sales" };
      if (metric === "sqm") return { v: x.sqm, big: x.sqm ? "AED " + fm(x.sqm) : "—", sub: "per m² · " + x.n + " sales" };
      if (metric === "sales") return { v: x.n, big: fm(x.n), sub: "registered sales 2026" };
      if (metric === "offplan") return { v: x.offplan, big: Math.round(x.offplan * 100) + "%", sub: "off-plan · " + x.n + " sales" };
      return { v: x.p90 && x.p10 ? x.p90 - x.p10 : null, big: "AED " + fm(x.p10) + " – " + fm(x.p90), sub: "P10 – P90 · median " + fm(x.median) };
    };
    const rows = (bd.developers || []).map(dv => ({ dv, r: val(dv) }));
    const max = Math.max(0, ...rows.map(x => x.r.v || 0));
    const order = rows.slice().sort((a, b) => (b.r.v || -1) - (a.r.v || -1)); const rank = new Map(order.map((x, i) => [x.dv.key, x.r.v == null ? null : i + 1]));
    tiles = (s.sort ? order : rows).map(({ dv, r }) => {
      const rk = rank.get(dv.key); const w = r.v && max ? Math.max(4, Math.round(r.v / max * 100)) : 0;
      return '<a class="tile back' + (life && r.v == null ? ' dim' : '') + '" href="/dev?d=' + encodeURIComponent(dv.key) + '&key=' + K + '">' +
        '<div class=bh>' + devLogo(dv, 30) + (rk ? '<span class=rk>#' + rk + '</span>' : '') + '</div><div class=bn>' + dv.name + '</div>' +
        '<div class="bv' + (metric === "range" || life ? ' rg' : '') + '"' + (r.v == null ? ' style="color:var(--mut)"' : '') + '>' + r.big + '</div><div class=bs>' + r.sub + '</div>' + (r.more || '') +
        '<div class=bar><i style="width:' + w + '%"></i></div></a>';
    }).join("");
    const chips = (name, map, cur) => '<div class=chips>' + Object.keys(map).map(k => '<a class="chip' + (k === cur ? ' on' : '') + '" href="' + q({ [name]: k }) + '">' + map[k] + '</a>').join("") + '</div>';
    // tier 1 = budget triage: bedrooms + price band up front; the metric row stays small (default = the price range, so a
    // client priced out of a developer is visible at a glance); tier 2 (geography, lifestyle, amenities) comes after the shortlist
    const tier2 = s.tier === "2" || !!life;
    const lifeChips = tier2 ? '<div class=sec>Lifestyle &amp; vicinity</div><div class=chips>' + '<a class="chip' + (!life ? ' on' : '') + '" href="' + q({ life: "", tier: "2" }) + '">anywhere</a>' +
      Object.keys(cmp.life || {}).map(k => '<a class="chip' + (k === life ? ' on' : '') + '" href="' + q({ life: k, tier: "2" }) + '">' + cmp.life[k] + '</a>').join("") + '</div>' : '';
    bar = '<div class=sec>Bedrooms</div>' + chips("bed", cmp.beds || {}, bed) + '<div class=sec>Client budget</div>' + chips("band", cmp.bands || {}, band) + lifeChips +
      (life ? '' : '<div class=sec>Show</div>' + chips("metric", CMP_METRICS, metric).replace('<div class=chips>', '<div class="chips small">')) +
      '<div class="chips small">' + (tier2 ? '<a class=chip href="' + q({ tier: "", life: "" }) + '">← budget only</a>' : '<a class="chip on" href="' + q({ tier: "2" }) + '">lifestyle &amp; vicinity →</a>') +
      '<a class="chip' + (s.sort ? ' on' : '') + '" href="' + q({ sort: s.sort ? "" : "1" }) + '">rank order</a><a class=chip href="/home?key=' + K + '">exit compare</a></div>' +
      '<div class=sub style="margin:8px 0 4px">' + (cmp.beds || {})[bed] + ' · ' + (life ? cmp.life[life] + ' · price range' : CMP_METRICS[metric]) + ' · ' + (cmp.bands || {})[band] + ' · bar = share of the largest value' + (life ? ' · areas are where those sales registered; amenities only where we hold the developer\'s own site' : ' · a developer with many projects shows a wide range') + '</div>';
  }
  return `<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Najma - developers</title><link rel=icon href=/naj_icon.svg><meta name=theme-color content="#0C1413">${NAJ_FONTS}<style>
:root{--ink:#0C1413;--card:#131F1D;--line:#24352F;--text:#E8E4D8;--mut:#8FA39B;--gold:#C5A56A}
body{margin:auto;max-width:720px;background:var(--ink);color:var(--text);font-family:"IBM Plex Sans",system-ui,sans-serif;padding:14px 14px 88px}
.mast{font-family:Fraunces,Georgia,serif;font-size:1.3rem;font-weight:600}.mast em{font-style:normal;color:var(--gold)}
.sub{color:var(--mut);font-size:.7rem;font-family:"IBM Plex Mono",monospace;margin:2px 0 14px}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.tile{display:block;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 12px 12px;text-decoration:none;color:var(--text);min-height:132px;position:relative;min-width:0}
.tile:active{border-color:var(--gold)}
.logo,.mono{border-radius:12px;background:#fff;object-fit:contain;padding:6px;display:block}.mono{background:#1C2B28;color:var(--gold);text-align:center;font-family:Fraunces,Georgia,serif;font-weight:600;padding:0}
.nm{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:1.02rem;margin-top:10px;line-height:1.15}
.tier{display:flex;align-items:center;gap:5px;color:var(--gold);font-size:.66rem;text-transform:uppercase;letter-spacing:.08em;margin-top:4px}
.kpi{color:var(--mut);font-size:.66rem;font-family:"IBM Plex Mono",monospace;margin-top:6px;line-height:1.35}
.act{display:inline-block;border:1px solid var(--line);border-radius:99px;padding:6px 11px;color:var(--text);text-decoration:none;font-size:.72rem;margin:0 6px 8px 0;background:var(--card)}
.sec{color:var(--mut);font-size:.6rem;text-transform:uppercase;letter-spacing:.12em;margin:10px 2px 5px}.chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:4px}
.chip{border:1px solid var(--line);border-radius:99px;padding:5px 10px;color:var(--text);text-decoration:none;font-size:.7rem;background:var(--card)}.chip.on{border-color:var(--gold);color:var(--gold)}
.tile.back{min-height:128px;background:#182A26;border-color:#2E4A44;animation:flip .45s ease both;transform-origin:center}.tile.back .logo,.tile.back .mono{border-radius:8px;padding:3px}
@keyframes flip{from{transform:rotateY(90deg);opacity:.2}to{transform:none;opacity:1}}
.bh{display:flex;align-items:center;justify-content:space-between;gap:8px}.bn{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:.92rem;line-height:1.1;margin-top:8px}.rk{color:var(--mut);font-size:.66rem;font-family:"IBM Plex Mono",monospace}
.bv{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:1.2rem;color:var(--gold);margin-top:8px;line-height:1.05;overflow-wrap:anywhere}.bv.rg{font-size:.98rem}.bs{color:var(--mut);font-size:.62rem;font-family:"IBM Plex Mono",monospace;margin-top:5px;overflow-wrap:anywhere}
.chips.small .chip{padding:3px 8px;font-size:.64rem}.tile.back.dim{opacity:.45}.bs.am{color:#8FC7B9}.bs.am i{font-style:normal;color:var(--mut)}
.bar{height:4px;background:#24352F;border-radius:2px;margin-top:10px;overflow:hidden}.bar i{display:block;height:100%;background:var(--gold);border-radius:2px}
${NAJ_NAV_CSS}</style></head><body>
<div class=mast>Najma <em>نجمة</em> · developers${compare ? ' · <span style="color:var(--mut);font-weight:400;font-size:.9rem">compare</span>' : ''}</div>
<div class=sub>${compare ? 'one filter, all ' + (bd.developers || []).length + ' developers at once · tap a tile for its properties' : 'your ' + (bd.developers || []).length + ' developers in five tiers · tap one for its properties, then a property for its unit cards · updated ' + (bd.updated || "")}</div>
${bar}
<div class=grid>${tiles}</div>
<div style="margin-top:14px"><a class=act href="/board?key=${encodeURIComponent(key)}">meetings board</a><a class=act href="/market?key=${encodeURIComponent(key)}">market pulse</a></div>
<div class=sub style="margin-top:10px">${bd.note || ""}</div>
${najNav(key, "homes")}
</body></html>`;
}
// v73 - DEVELOPER PAGE: property cards. "ours" first (modelled, unit cards ready), then DLD-registered 2026 projects, then projects trading in 2026.
function renderDev(dv, bd, galleries, key) {
  const fm = (n) => n == null ? "-" : (n >= 1e9 ? (n / 1e9).toFixed(2) + " bn" : n >= 1e6 ? (n / 1e6).toFixed(1) + " M" : Math.round(n).toLocaleString("en-US"));
  const k = dv.kpi || {};
  const kp = [k.tx_2026 ? ["Sales 2026", fm(k.tx_2026)] : null, k.value_aed ? ["Value", "AED " + fm(k.value_aed)] : null, k.median_aed_per_sqm ? ["Median", "AED " + fm(k.median_aed_per_sqm) + "/m²"] : null,
              k.registered_2026 ? ["Registered 2026", String(k.registered_2026)] : null, k.meed_projects ? ["MEED projects", String(k.meed_projects)] : null].filter(Boolean)
    .map(x => '<div class=k><div class=v>' + x[1] + '</div><div class=l>' + x[0] + '</div></div>').join("");
  const cards = (dv.properties || []).map(p => {
    if (p.kind === "ours") {
      const g = galleries[p.building]; const n = g && g.cards ? g.cards.length : 0;
      const cu = '/cards?b=' + encodeURIComponent(p.cards) + '&key=' + encodeURIComponent(key);
      return '<div class="prop ours"><a class=cover href="' + cu + '" aria-label="unit cards"></a><div class=ph><span class=pn>' + p.name + '</span><span class=badge>modelled</span></div>' +
        '<div class=pm>' + (p.area || "") + ' · ' + (p.status || "") + '</div>' +
        '<div class=pm style="color:#8FC7B9">' + (n ? n + ' unit-type cards · availability from the latest developer sheet' : 'cards being generated') + '</div>' +
        '<div class=row><a class=go href="' + cu + '">unit cards →</a>' + (p.drill ? '<a class=mini href="/avail?d=' + p.drill + '&key=' + encodeURIComponent(key) + '">the mix</a>' : '') + (p.meta ? '<a class=mini href="/skyline/' + p.meta + '?key=' + encodeURIComponent(key) + '">3D</a>' : '') + '</div></div>';
    }
    if (p.kind === "portfolio") {                                   // v73.3 - from the developer's own site, enriched with DLD + the availability sheet
      const specs = [p.area, p.structure || (p.storeys ? p.storeys + ' storeys' : null), p.units ? Math.round(p.units) + ' units' : null, (p.plans && p.plans.length) ? p.plans.join(' / ') + ' plan' : null].filter(Boolean).join(' · ');
      const mix = (p.mix || []).filter(m => !/retail|office/.test(m)).join(', ');
      const dld = p.dld ? 'DLD ' + (p.dld.status || 'registered') + (p.dld.pct != null ? ' · ' + Math.round(p.dld.pct) + '% built' : '') : '';
      const trade = p.tx ? p.tx + ' registered sales 2026' + (p.median_aed_per_sqm ? ' · median AED ' + fm(p.median_aed_per_sqm) + '/m²' : '') : '';
      const sh = p.sheet ? '<div class=pm style="color:#8FC7B9">on the developer sheet ' + (p.sheet.sheet || '') + ': ' + p.sheet.units + ' unit' + (p.sheet.units === 1 ? '' : 's') + ' for sale · ' + (p.sheet.types || []).join(', ') + (p.sheet.plan ? ' · ' + p.sheet.plan : '') + '</div>' : '';
      const img = p.image ? '<img class=hero src="' + p.image + '" alt="" loading=lazy referrerpolicy=no-referrer>' : '';
      return '<div class="prop' + (p.sheet ? ' ours' : '') + '">' + img + '<div class=ph><span class=pn>' + p.name + '</span><span class=badge' + (p.handover ? '' : ' style="border-color:var(--line);color:var(--mut)"') + '>' + (p.handover ? 'handover ' + p.handover : 'developer site') + '</span></div>' +
        '<div class=pm>' + specs + '</div>' + (mix ? '<div class=pm style="color:var(--mut)">' + mix + '</div>' : '') +
        ((dld || trade) ? '<div class=pm style="color:var(--mut)">' + [dld, trade].filter(Boolean).join(' · ') + '</div>' : '') + sh +
        '<div class=row>' + (p.sheet ? '<a class=go href="/avail?d=' + encodeURIComponent(dv.key) + '&key=' + encodeURIComponent(key) + '">the mix →</a>' : '<span class=pm style="margin:0;color:var(--mut)">no floor plans on file - the developer gates them behind a form; ask the group for the brochure</span>') +
        '<a class=mini href="' + p.url + '" target=_blank rel=noopener>developer page</a></div></div>';
    }
    if (p.kind === "registered") {
      return '<div class=prop><div class=ph><span class=pn>' + p.name + '</span><span class=badge style="border-color:var(--line);color:var(--mut)">DLD ' + (p.status || "registered") + '</span></div>' +
        '<div class=pm>' + (p.area || "") + (p.units ? ' · ' + Math.round(p.units) + ' units' : '') + (p.pct != null ? ' · ' + p.pct + '% built' : '') + (p.value_aed ? ' · AED ' + fm(p.value_aed) : '') + '</div>' +
        '<div class=pm style="color:var(--mut)">registered ' + (p.start || "2026") + ' · no cards yet - send the floor-plan deck and the availability sheet to the group</div></div>';
    }
    return '<div class=prop><div class=ph><span class=pn>' + p.name + '</span><span class=badge style="border-color:var(--line);color:var(--mut)">trading</span></div>' +
      '<div class=pm>' + (p.area || "") + ' · ' + p.tx + ' registered sales 2026' + (p.median_aed_per_sqm ? ' · median AED ' + fm(p.median_aed_per_sqm) + '/m²' : '') + (p.offplan_share != null ? ' · ' + Math.round(p.offplan_share * 100) + '% off-plan' : '') + '</div>' +
      '<div class=pm style="color:var(--mut)">last registration ' + (p.last || "") + ' · DLD Open Data</div></div>';
  }).join("");
  return `<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${dv.name} - properties</title><link rel=icon href=/naj_icon.svg><meta name=theme-color content="#0C1413">${NAJ_FONTS}<style>
:root{--ink:#0C1413;--card:#131F1D;--line:#24352F;--text:#E8E4D8;--mut:#8FA39B;--gold:#C5A56A}
body{margin:auto;max-width:720px;background:var(--ink);color:var(--text);font-family:"IBM Plex Sans",system-ui,sans-serif;padding:14px 14px 88px}
.hd{display:flex;gap:14px;align-items:center;margin-bottom:6px}.logo,.mono{border-radius:14px;background:#fff;object-fit:contain;padding:8px;display:block}.mono{background:#1C2B28;color:var(--gold);text-align:center;font-family:Fraunces,Georgia,serif;font-weight:600;padding:0}
.mast{font-family:Fraunces,Georgia,serif;font-size:1.35rem;font-weight:600;line-height:1.1}.tier{display:flex;align-items:center;gap:5px;color:var(--gold);font-size:.68rem;text-transform:uppercase;letter-spacing:.08em;margin-top:4px}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:8px;margin:12px 0 16px}.k{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 10px 8px}.k .v{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:1.05rem;color:var(--gold)}.k .l{color:var(--mut);font-size:.62rem;text-transform:uppercase;letter-spacing:.08em;margin-top:2px}
.sec{color:var(--mut);font-size:.66rem;text-transform:uppercase;letter-spacing:.12em;margin:14px 2px 8px}
.prop{display:block;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px 14px;margin-bottom:10px;text-decoration:none;color:var(--text)}
.hero{width:100%;height:110px;object-fit:cover;border-radius:10px;margin-bottom:8px;display:block;background:#1C2B28}
.prop.ours{border-color:#2E4A44;position:relative}.prop.ours:active{border-color:var(--gold)}.cover{position:absolute;inset:0;border-radius:14px}.row a{position:relative;z-index:1}.go{text-decoration:none}
.ph{display:flex;justify-content:space-between;align-items:baseline;gap:8px}.pn{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:1rem}.badge{border:1px solid #3E7C6C;color:#8FC7B9;border-radius:99px;padding:2px 8px;font-size:.62rem;white-space:nowrap}
.pm{color:var(--text);font-size:.72rem;margin-top:4px;font-family:"IBM Plex Mono",monospace}.row{display:flex;gap:8px;align-items:center;margin-top:8px}.go{color:var(--gold);font-weight:600;font-size:.78rem}.mini{margin-left:auto;border:1px solid var(--line);border-radius:99px;padding:3px 9px;color:var(--text);text-decoration:none;font-size:.66rem}.mini+.mini{margin-left:6px}
.act{display:inline-block;border:1px solid var(--line);border-radius:99px;padding:6px 11px;color:var(--text);text-decoration:none;font-size:.72rem;margin:0 6px 8px 0;background:var(--card)}
${NAJ_NAV_CSS}</style></head><body>
<div class=hd>${devLogo(dv, 64)}<div><div class=mast>${dv.name}</div><div class=tier>${tierSvg(dv.icon)}<span>${dv.segment_label}</span></div></div></div>
<div class=kpis>${kp}</div>
${(dv.properties || []).some(p => p.kind === "ours") ? '<div class=sec>Modelled - unit cards ready</div>' : ''}
${cards || '<div class=prop><div class=pm>No properties on file yet - the first floor-plan deck or availability sheet posted to the group starts the file.</div></div>'}
<div style="margin-top:14px"><a class=act href="/compare?a=${dv.key}&key=${encodeURIComponent(key)}">compare with another developer</a><a class=act href="/home?key=${encodeURIComponent(key)}">← developers</a><a class=act href="/board?key=${encodeURIComponent(key)}">board</a></div>
<div class=sub style="color:var(--mut);font-size:.66rem;font-family:'IBM Plex Mono',monospace;margin-top:10px">${(dv.entities || []).length ? 'DLD entities: ' + dv.entities.join(' · ') : ''}</div>
${najNav(key, "homes")}
</body></html>`;
}
// v73.3 - COMPARE: two developers, attributes as rows, click-only. Pattern follows the comparison-table guidance we researched:
// dynamic selection capped at TWO on mobile, a persistent tray showing what is picked, sticky column header with the two marks,
// short values (no sentences), a "differences only" toggle, and filter chips (bedroom, price band) that re-cut every row.
function renderCompare(cmp, bd, s, key) {
  const K = encodeURIComponent(key); const devs = bd.developers || []; const C = cmp.developers || {};
  const fm = (n) => n == null ? "-" : (n >= 1e9 ? (n / 1e9).toFixed(2) + " bn" : n >= 1e6 ? (n / 1e6).toFixed(2) + " M" : Math.round(n).toLocaleString("en-US"));
  const q = (o) => { const p = Object.assign({ a: s.a, b: s.b, bed: s.bed, band: s.band, diff: s.diff ? "1" : "" }, o); return '/compare?' + Object.keys(p).filter(k => p[k]).map(k => k + '=' + encodeURIComponent(p[k])).join('&') + '&key=' + K; };
  const byKey = (k) => devs.find(d => d.key === k);
  const A = byKey(s.a), B = byKey(s.b);
  const head = '<div class=mast>Compare developers</div><div class=sub>tap two developers - every row re-cuts by bedroom and price band</div>';
  // ---- stage 1: pick (grid of the eleven; the tray pins the first pick)
  if (!A || !B) {
    const first = A || B;
    const tiles = devs.filter(d => !first || d.key !== first.key).map(d =>
      '<a class=tile href="' + q(first ? { a: first.key, b: d.key } : { a: d.key, b: "" }) + '">' + devLogo(d, 44) + '<div class=tn>' + d.name + '</div><div class=tt>' + tierSvg(d.icon) + '<span>' + d.segment_label + '</span></div></a>').join("");
    const tray = first
      ? '<div class=tray>' + devLogo(first, 36) + '<div><div class=trn>' + first.name + '</div><div class=trs>now tap the second developer</div></div><a class=mini href="/compare?key=' + K + '">clear</a></div>'
      : '<div class=tray><div class=trs>pick the first developer - two slots</div></div>';
    return page(head + '<div class=grid>' + tiles + '</div>' + tray);
  }
  // ---- stage 2: the table
  const ca = C[A.key] || {}, cb = C[B.key] || {}; const cut = s.bed + "|" + s.band;
  const xa = (ca.cells || {})[cut], xb = (cb.cells || {})[cut];
  const ra = (ca.rents || {})[s.bed], rb = (cb.rents || {})[s.bed];
  const pct = (v) => v == null ? null : Math.round(v * 100) + "%";
  const rng = (x) => x && x.p10 ? "AED " + fm(x.p10) + " - " + fm(x.p90) : null;
  const yld = (r, x) => (r && x && x.median) ? (r.median / x.median * 100).toFixed(1) + "%" : null;
  // rows: [label, valueA, valueB, numericA, numericB]  (numeric drives the marker; null = no marker)
  const rows = [
    ["Registered sales 2026", xa ? fm(xa.n) : null, xb ? fm(xb.n) : null, xa && xa.n, xb && xb.n],
    ["Median price", xa && xa.median ? "AED " + fm(xa.median) : null, xb && xb.median ? "AED " + fm(xb.median) : null, xa && xa.median, xb && xb.median],
    ["Typical range (P10-P90)", rng(xa), rng(xb), null, null],
    ["Median AED / m²", xa && xa.sqm ? fm(xa.sqm) : null, xb && xb.sqm ? fm(xb.sqm) : null, xa && xa.sqm, xb && xb.sqm],
    ["Off-plan share", xa ? pct(xa.offplan) : null, xb ? pct(xb.offplan) : null, xa && xa.offplan, xb && xb.offplan],
    ["Where the sales are", xa && xa.areas ? xa.areas.join(" · ") : null, xb && xb.areas ? xb.areas.join(" · ") : null, null, null],
    ["Median rent " + (cmp.beds[s.bed] || ""), ra ? "AED " + fm(ra.median) + " / yr" : null, rb ? "AED " + fm(rb.median) + " / yr" : null, ra && ra.median, rb && rb.median],
    ["Gross yield proxy", yld(ra, xa), yld(rb, xb), null, null],
    ["Projects trading 2026", String(ca.projects_trading || 0), String(cb.projects_trading || 0), ca.projects_trading, cb.projects_trading],
    ["Registered 2026 (DLD)", String(ca.registered_2026 || 0), String(cb.registered_2026 || 0), ca.registered_2026, cb.registered_2026],
    ["Handovers ahead", (ca.handovers || []).slice(0, 3).join(" · ") || null, (cb.handovers || []).slice(0, 3).join(" · ") || null, null, null],
    ["Portfolio on developer site", ca.portfolio != null ? String(ca.portfolio) : null, cb.portfolio != null ? String(cb.portfolio) : null, null, null],
    ["MEED active projects", String(ca.meed_active || 0), String(cb.meed_active || 0), ca.meed_active, cb.meed_active],
    ["Units on the developer sheet", ca.sheet_units ? String(ca.sheet_units) : null, cb.sheet_units ? String(cb.sheet_units) : null, null, null],
    ["Modelled - unit cards", ca.ours_cards ? "yes" : "not yet", cb.ours_cards ? "yes" : "not yet", null, null],
  ];
  const tr = rows.filter(r => !s.diff || (r[1] || "") !== (r[2] || "")).map(r => {
    const ma = r[3] != null && r[4] != null && r[3] > r[4], mb = r[3] != null && r[4] != null && r[4] > r[3];
    return '<tr><th>' + r[0] + '</th><td' + (ma ? ' class=hi' : '') + '>' + (r[1] || '<span class=none>no data in this cut</span>') + '</td><td' + (mb ? ' class=hi' : '') + '>' + (r[2] || '<span class=none>no data in this cut</span>') + '</td></tr>';
  }).join("");
  const chips = (name, map, cur) => '<div class=chips>' + Object.keys(map).map(k => '<a class="chip' + (k === cur ? ' on' : '') + '" href="' + q({ [name]: k }) + '">' + map[k] + '</a>').join("") + '</div>';
  const body = head +
    '<table class=cmp><thead><tr><th><a class=mini href="' + q({ a: B.key, b: A.key }) + '">swap</a></th>' +
    '<th><a class=col href="' + q({ a: "", b: B.key }) + '">' + devLogo(A, 40) + '<span>' + A.name + '</span><em>change</em></a></th>' +
    '<th><a class=col href="' + q({ a: A.key, b: "" }) + '">' + devLogo(B, 40) + '<span>' + B.name + '</span><em>change</em></a></th></tr></thead><tbody>' + tr + '</tbody></table>' +
    '<div class=sec>Bedrooms</div>' + chips("bed", cmp.beds, s.bed) + '<div class=sec>Price band</div>' + chips("band", cmp.bands, s.band) +
    '<div class=chips><a class="chip' + (s.diff ? ' on' : '') + '" href="' + q({ diff: s.diff ? "" : "1" }) + '">differences only</a><a class=chip href="' + q({ bed: "all", band: "all", diff: "" }) + '">reset</a></div>' +
    '<div class=legend><span class=dot></span> the higher of the two - not a verdict: a higher AED/m² is a pricier product, a higher off-plan share is a younger pipeline</div>' +
    '<div class=legend>' + (cmp.note || "") + ' Updated ' + (cmp.updated || "") + '.</div>' +
    '<div style="margin-top:12px"><a class=act href="/dev?d=' + A.key + '&key=' + K + '">' + A.name + ' properties</a><a class=act href="/dev?d=' + B.key + '&key=' + K + '">' + B.name + ' properties</a><a class=act href="/home?key=' + K + '">← developers</a></div>';
  return page(body);

  function page(inner) {
    return `<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Compare developers</title><link rel=icon href=/naj_icon.svg><meta name=theme-color content="#0C1413">${NAJ_FONTS}<style>
:root{--ink:#0C1413;--card:#131F1D;--line:#24352F;--text:#E8E4D8;--mut:#8FA39B;--gold:#C5A56A}
body{margin:auto;max-width:720px;background:var(--ink);color:var(--text);font-family:"IBM Plex Sans",system-ui,sans-serif;padding:14px 14px 150px}
.mast{font-family:Fraunces,Georgia,serif;font-size:1.35rem;font-weight:600}.sub{color:var(--mut);font-size:.72rem;margin:4px 0 12px;font-family:"IBM Plex Mono",monospace}
.logo,.mono{border-radius:10px;background:#fff;object-fit:contain;padding:4px;display:block}.mono{background:#1C2B28;color:var(--gold);text-align:center;font-family:Fraunces,Georgia,serif;font-weight:600;padding:0}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.tile{display:block;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:12px;text-decoration:none;color:var(--text)}.tile:active{border-color:var(--gold)}
.tn{font-family:Fraunces,Georgia,serif;font-weight:600;margin-top:8px}.tt{display:flex;gap:5px;align-items:center;color:var(--gold);font-size:.62rem;text-transform:uppercase;letter-spacing:.08em;margin-top:3px}
.tray{position:fixed;left:0;right:0;bottom:62px;z-index:39;display:flex;gap:10px;align-items:center;max-width:720px;margin:auto;background:rgba(19,31,29,.97);border-top:1px solid var(--line);padding:10px 14px}.trn{font-family:Fraunces,Georgia,serif;font-weight:600}.trs{color:var(--mut);font-size:.7rem;font-family:"IBM Plex Mono",monospace}
.mini{margin-left:auto;border:1px solid var(--line);border-radius:99px;padding:3px 9px;color:var(--text);text-decoration:none;font-size:.66rem;white-space:nowrap}
table.cmp{width:100%;border-collapse:collapse;font-size:.74rem}table.cmp thead th{position:sticky;top:0;background:var(--ink);z-index:2;padding:6px 4px 8px;border-bottom:1px solid var(--gold);text-align:left;vertical-align:bottom}
.col{display:flex;flex-direction:column;align-items:flex-start;gap:4px;text-decoration:none;color:var(--text)}.col span{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:.9rem;line-height:1.1}.col em{font-style:normal;color:var(--mut);font-size:.6rem;text-transform:uppercase;letter-spacing:.08em}
table.cmp tbody th{text-align:left;font-weight:500;color:var(--mut);padding:9px 6px 9px 0;border-bottom:1px solid var(--line);width:34%;vertical-align:top;font-size:.68rem}table.cmp tbody td{padding:9px 6px;border-bottom:1px solid var(--line);vertical-align:top;font-family:"IBM Plex Mono",monospace;width:33%}
td.hi{color:var(--gold)}td.hi::before{content:"";display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--gold);margin-right:6px;vertical-align:middle}.none{color:var(--mut);font-size:.64rem;font-family:"IBM Plex Sans",system-ui,sans-serif}
.sec{color:var(--mut);font-size:.62rem;text-transform:uppercase;letter-spacing:.12em;margin:14px 2px 6px}.chips{display:flex;flex-wrap:wrap;gap:6px}.chip{border:1px solid var(--line);border-radius:99px;padding:6px 11px;color:var(--text);text-decoration:none;font-size:.72rem;background:var(--card)}.chip.on{border-color:var(--gold);color:var(--gold)}
.legend{display:flex;gap:6px;align-items:flex-start;color:var(--mut);font-size:.64rem;margin-top:10px;font-family:"IBM Plex Mono",monospace}.dot{flex:none;width:6px;height:6px;border-radius:50%;background:var(--gold);margin-top:5px}
.act{display:inline-block;border:1px solid var(--line);border-radius:99px;padding:6px 11px;color:var(--text);text-decoration:none;font-size:.72rem;margin:0 6px 8px 0;background:var(--card)}
${NAJ_NAV_CSS}</style></head><body>${inner}${najNav(key, "homes")}</body></html>`;
  }
}
function renderCards(ci, b, key, t) {
  const cards = ci.cards || [];
  const sel = t ? cards.find(c => c.type === t) : null;
  const bt = String(ci.building || b); const title = bt.charAt(0).toUpperCase() + bt.slice(1);
  const pills = cards.map(c => '<a class=act' + (sel && sel.type === c.type ? ' style="border-color:var(--gold);color:var(--gold)"' : '') + ' href="/cards?b=' + encodeURIComponent(b) + '&t=' + encodeURIComponent(c.type) + '&key=' + encodeURIComponent(key) + '">' + cardLabel(c.type) + '</a>').join("");
  const body = sel
    ? '<a href="' + sel.url + '" target=_blank><img src="' + sel.url + '" alt="' + cardLabel(sel.type) + ' card" style="width:100%;border-radius:10px;border:1px solid var(--line);background:#fff"></a>' +
      '<div style="color:var(--mut);font-size:.66rem;margin-top:6px;font-family:\'IBM Plex Mono\',monospace">tap the card to open full size - pinch to zoom</div>'
    : cards.map(c => '<a href="/cards?b=' + encodeURIComponent(b) + '&t=' + encodeURIComponent(c.type) + '&key=' + encodeURIComponent(key) + '" style="display:block;margin-bottom:10px"><img src="' + c.url + '" loading=lazy alt="' + cardLabel(c.type) + '" style="width:100%;border-radius:10px;border:1px solid var(--line);background:#fff"></a>').join("");
  return `<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${title} - unit cards</title><link rel=icon href=/naj_icon.svg><meta name=theme-color content="#0C1413">${NAJ_FONTS}<style>
:root{--ink:#0C1413;--card:#131F1D;--line:#24352F;--text:#E8E4D8;--mut:#8FA39B;--gold:#C5A56A}
body{margin:auto;max-width:720px;background:var(--ink);color:var(--text);font-family:"IBM Plex Sans",system-ui,sans-serif;padding:14px 14px 88px}
.mast{font-family:Fraunces,Georgia,serif;font-size:1.3rem;font-weight:600}.mast em{font-style:normal;color:var(--gold)}
.sub{color:var(--mut);font-size:.7rem;font-family:"IBM Plex Mono",monospace;margin:2px 0 12px}
.act{display:inline-block;border:1px solid var(--line);border-radius:99px;padding:6px 11px;color:var(--text);text-decoration:none;font-size:.72rem;margin:0 6px 8px 0;background:var(--card)}
${NAJ_NAV_CSS}</style></head><body>
<div class=mast>${title} <em>- unit cards</em></div>
<div class=sub>developer plate per type - availability from the latest sheet - curated by DigitAlchemy</div>
<div>${pills}${ci.pdf ? '<a class=act href="' + ci.pdf + '" target=_blank>PDF, all types</a>' : ''}</div>
${body}
<div style="margin-top:12px"><a class=act href="/avail?d=imtiaz&key=${encodeURIComponent(key)}">back to the mix</a><a class=act href="/board?key=${encodeURIComponent(key)}">board</a></div>
${najNav(key, "homes")}
</body></html>`;
}

// v71 - UNIT LIST: every developer-stated unit, grouped by project. The bottom of the drill.
function renderAvailUnits(d, dk, key) {
  const fm = (n) => n == null ? "-" : (n >= 1e6 ? (n / 1e6).toFixed(2) + "M" : Math.round(n).toLocaleString("en-US"));
  const det = (d.claimed && d.claimed.detail) || [];
  const blocks = det.map(pr => {
    const rows = (pr.units || []).map(u =>
      '<div style="display:grid;grid-template-columns:64px 62px 1fr 84px;gap:8px;padding:.4rem 0;border-top:1px solid var(--line);font-size:.74rem;align-items:baseline">' +
      '<b>' + String(u[0]) + '</b>' +
      '<span style="color:var(--mut)">' + String(u[1]).replace(" Duplex", "·dx") + '</span>' +
      '<span>' + (u[4] ? '<span style="color:#8FC7B9">' + u[4] + '</span>' : '<span style="color:var(--mut)">—</span>') +
      '<span style="color:var(--mut);font-size:.66rem"> · ' + Math.round(u[2]).toLocaleString("en-US") + ' sqft</span></span>' +
      '<b style="color:var(--gold);text-align:right">' + fm(u[3]) + '</b></div>').join("");
    return '<div style="background:var(--card);border:1px solid var(--line);border-radius:12px;padding:.7rem .9rem;margin-bottom:12px">' +
      '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px"><span style="font-family:Fraunces,Georgia,serif;font-weight:600">' + pr.p + '</span>' +
      '<span style="color:var(--mut);font-size:.64rem;font-family:\'IBM Plex Mono\',monospace">' + (pr.units || []).length + ' units · ' + (pr.completion || "") + (pr.plan ? " · " + pr.plan : "") + '</span></div>' + rows + '</div>';
  }).join("");
  return `<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${d.title} — units</title><link rel=icon href=/naj_icon.svg><meta name=theme-color content="#0C1413">${NAJ_FONTS}<style>
:root{--ink:#0C1413;--card:#131F1D;--line:#24352F;--text:#E8E4D8;--mut:#8FA39B;--gold:#C5A56A}
body{margin:auto;max-width:520px;background:var(--ink);color:var(--text);font-family:"IBM Plex Sans",system-ui,sans-serif;padding:14px 14px 88px}
.mast{font-family:Fraunces,Georgia,serif;font-size:1.3rem;font-weight:600}.mast em{font-style:normal;color:var(--gold)}
.sub{color:var(--mut);font-size:.7rem;font-family:"IBM Plex Mono",monospace;margin:2px 0 14px}
${NAJ_NAV_CSS}</style></head><body>
<div class=mast>${d.title} <em>· every unit</em></div>
<div class=sub>developer-stated availability — sheet ${(d.claimed && d.claimed.as_of) || ""} · unit · layout · view · sqft · AED</div>
${blocks}
<div style="color:var(--mut);font-size:.62rem;font-family:'IBM Plex Mono',monospace">claimed by ${(d.claimed && d.claimed.source) || "the developer"} — not register data · <a href="/avail?d=${dk}&key=${encodeURIComponent(key)}" style="color:var(--gold)">← the mix</a></div>
${najNav(key, "homes")}
</body></html>`;
}

// v69 - AVAILABILITY DRILL: one project, registered sales mix as a donut + per-room medians.
// Developer-claimed unit availability joins this page after PDF extraction - separate, dated.
function renderAvailDrill(d, dk, key, cards, trust) {
  const COLS = ["#3E8A7E", "#C5A56A", "#8FC7B9", "#A88544", "#566B64", "#E8E4D8"];
  const rooms = (d.rooms || []).slice(0, 6);
  const total = rooms.reduce((a, x) => a + (x.n || 0), 0) || 1;
  const R = 74, C = 2 * Math.PI * R;
  let off = 0;
  const segs = rooms.map((x, i) => {
    const frac = (x.n || 0) / total, seg = frac * C;
    const el = '<circle r="' + R + '" cx="110" cy="110" fill="none" stroke="' + COLS[i % COLS.length] + '" stroke-width="30" stroke-dasharray="' + seg.toFixed(1) + ' ' + (C - seg).toFixed(1) + '" stroke-dashoffset="' + (-off).toFixed(1) + '" transform="rotate(-90 110 110)"/>';
    off += seg; return el;
  }).join("");
  const fm = (n) => n == null ? "-" : (n >= 1e6 ? (n / 1e6).toFixed(2) + "M" : Math.round(n).toLocaleString("en-US"));
  const chips = rooms.map((x, i) =>
    '<div style="display:flex;align-items:center;gap:9px;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:.55rem .8rem">' +
    '<span style="width:10px;height:10px;border-radius:3px;background:' + COLS[i % COLS.length] + ';flex:0 0 auto"></span>' +
    '<span style="min-width:56px;font-weight:600">' + String(x.r) + '</span>' +
    '<span style="color:var(--mut);font-size:.72rem">' + x.n + ' sold</span>' +
    '<span style="margin-left:auto;text-align:right"><b style="color:var(--gold)">AED ' + fm(x.med) + '</b><br><span style="color:var(--mut);font-size:.66rem">' + (x.psm ? fm(x.psm) + "/m²" : "") + '</span></span></div>').join("");
  const latest = (d.latest || []).map(x =>
    '<div style="display:flex;justify-content:space-between;gap:8px;padding:.3rem 0;border-top:1px solid var(--line);font-size:.74rem">' +
    '<span style="color:var(--mut)">' + x.d + '</span><span>' + (x.r || "") + ' · ' + (x.m2 || "?") + ' m²</span><b>AED ' + fm(x.aed) + '</b></div>').join("");
  const dist = String(d.district || "");
  const distSlug = dist.toLowerCase().replace(/[^a-z0-9]/g, "");
  const acts =
    (dist ? '<a class=act href="/area/' + encodeURIComponent(dist.toLowerCase()) + '?key=' + encodeURIComponent(key) + '">📊 area deep-dive</a>' : "") +
    (dist ? '<a class=act href="/skyline/' + distSlug + '?key=' + encodeURIComponent(key) + '">⬢ 3D district</a>' : "") +
    '<a class=act href="/board?key=' + encodeURIComponent(key) + '">← board</a>';
  return `<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${d.title} — availability</title><link rel=icon href=/naj_icon.svg><meta name=theme-color content="#0C1413">${NAJ_FONTS}<style>
:root{--ink:#0C1413;--card:#131F1D;--line:#24352F;--text:#E8E4D8;--mut:#8FA39B;--gold:#C5A56A}
body{margin:auto;max-width:460px;background:var(--ink);color:var(--text);font-family:"IBM Plex Sans",system-ui,sans-serif;padding:14px 14px 88px}
.mast{font-family:Fraunces,Georgia,serif;font-size:1.35rem;font-weight:600}.mast em{font-style:normal;color:var(--gold)}
.sub{color:var(--mut);font-size:.72rem;font-family:"IBM Plex Mono",monospace;margin:2px 0 14px}
.act{display:inline-block;border:1px solid var(--line);border-radius:99px;padding:7px 13px;color:var(--text);text-decoration:none;font-size:.76rem;margin:4px 6px 0 0;background:var(--card)}
${NAJ_NAV_CSS}</style></head><body>
<div class=mast>${d.title} <em>· the mix</em></div>
<div class=sub>registered sales by layout — DLD Open Data${dist ? " · " + dist : ""}</div>
<div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">
  <svg viewBox="0 0 220 220" width="46%" style="max-width:190px">${segs}
    <text x="110" y="104" text-anchor="middle" fill="#E8E4D8" font-size="30" font-weight="600" font-family="Fraunces,Georgia,serif">${total}</text>
    <text x="110" y="126" text-anchor="middle" fill="#8FA39B" font-size="11" font-family="IBM Plex Mono,monospace">registered sales</text></svg>
  <div style="flex:1;display:flex;flex-direction:column;gap:7px">${chips}</div>
</div>
${(() => {
  const cl = (d.claimed && d.claimed.rooms) || [];
  if (!cl.length) return '<div style="background:rgba(197,165,106,.08);border:1px solid rgba(197,165,106,.35);border-radius:10px;padding:.6rem .8rem;font-size:.72rem;color:var(--gold)">📄 Developer sheet on file (' + ((d.sheet && d.sheet.received) || "") + ') — unit-level availability appears here once read. Claimed figures will sit beside these, never mixed.</div>';
  const tot2 = cl.reduce((a, x) => a + (x.n || 0), 0);
  const rows2 = cl.map(x =>
    '<div style="display:flex;justify-content:space-between;gap:8px;padding:.34rem 0;border-top:1px solid rgba(197,165,106,.25);font-size:.76rem">' +
    '<span style="font-weight:600">' + String(x.r) + '</span>' +
    '<span style="color:var(--mut)">' + x.n + ' available</span>' +
    '<b style="color:var(--gold)">' + (x.from ? "from AED " + (x.from >= 1e6 ? (x.from / 1e6).toFixed(2) + "M" : Math.round(x.from).toLocaleString("en-US")) : "") + '</b></div>').join("");
  const unitsLink = (d.claimed && d.claimed.detail) ? '<a href="/avail?d=' + dk + '&full=1&key=' + encodeURIComponent(key) + '" style="color:var(--gold);text-decoration:none;font-size:.72rem;border:1px solid rgba(197,165,106,.5);border-radius:99px;padding:3px 10px">all units ›</a>' : "";
  return '<div style="background:rgba(197,165,106,.08);border:1px solid rgba(197,165,106,.45);border-radius:12px;padding:.7rem .9rem">' +
    '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px"><span style="font-family:Fraunces,Georgia,serif;font-weight:600;color:var(--gold)">Available now — developer-stated</span>' + unitsLink +
    '<span style="color:var(--mut);font-size:.66rem;font-family:\'IBM Plex Mono\',monospace">' + tot2 + ' units · sheet ' + ((d.claimed && d.claimed.as_of) || "") + '</span></div>' +
    rows2 +
    '<div style="color:var(--mut);font-size:.6rem;margin-top:.4rem;font-family:\'IBM Plex Mono\',monospace">claimed by ' + ((d.claimed && d.claimed.source) || "the developer") + ' — not register data; registered mix above is the settled record</div></div>';
})()}
${(() => {                                                      // v72 - unit-type cards (developer plate + facts), one gallery per building
  const gs = cards || []; if (!gs.length) return "";
  return gs.map(g => {
    const b = String(g.building || ""); const bt = b.charAt(0).toUpperCase() + b.slice(1);
    const pills = (g.cards || []).map(c => '<a class=act href="/cards?b=' + encodeURIComponent(b) + '&t=' + encodeURIComponent(c.type) + '&key=' + encodeURIComponent(key) + '">' + cardLabel(c.type) + '</a>').join("");
    return '<div style="margin-top:14px;background:rgba(197,165,106,.06);border:1px solid rgba(197,165,106,.35);border-radius:12px;padding:.7rem .9rem">' +
      '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px"><span style="font-family:Fraunces,Georgia,serif;font-weight:600;color:var(--gold)">Unit cards - ' + bt + '</span>' +
      (g.pdf ? '<a href="' + g.pdf + '" style="color:var(--gold);text-decoration:none;font-size:.72rem;border:1px solid rgba(197,165,106,.5);border-radius:99px;padding:3px 10px">PDF, all types</a>' : "") + '</div>' +
      '<div style="margin-top:6px">' + pills + '</div>' +
      '<div style="color:var(--mut);font-size:.6rem;margin-top:.4rem;font-family:\'IBM Plex Mono\',monospace">developer plate + availability as of the latest sheet - rebuilt daily</div></div>';
  }).join("");
})()}
${trust ? devTrustHtml(trust) : ""}
<div style="margin-top:14px"><div style="font-family:Fraunces,Georgia,serif;font-weight:600;margin-bottom:2px">Latest registered</div>${latest}</div>
<div style="margin-top:14px">${acts}</div>
<div style="color:var(--mut);font-size:.62rem;margin-top:16px;font-family:'IBM Plex Mono',monospace">settled, not asking — the register's own numbers</div>
${najNav(key, "homes")}
</body></html>`;
}

// v78 — THE REAL VIEW. The skyline model answers "which side and is it blocked"; this answers "what does it actually look like".
// Google Photorealistic 3D Tiles are rendered LIVE in CesiumJS from the facade's own point and height — under Google's terms the
// tiles may not be cached or re-served, so this is a live view, never a stored picture. Attribution stays on screen.
function renderRealView(v, key) {
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const noKey = !v.gkey;
  return `<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${esc(v.name || "The view")} — real view</title>
<link rel=icon href=/naj_icon.svg><meta name=theme-color content="#0C1413">${NAJ_FONTS}
<link rel=stylesheet href="https://cdn.jsdelivr.net/npm/cesium@1.121.0/Build/Cesium/Widgets/widgets.css">
<style>
:root{--ink:#0C1413;--card:#131F1D;--line:#24352F;--text:#E8E4D8;--mut:#8FA39B;--gold:#C5A56A}
html,body{margin:0;height:100%;background:var(--ink);color:var(--text);font-family:"IBM Plex Sans",system-ui,sans-serif;overflow:hidden}
#cv{position:fixed;inset:0}.cesium-widget-credits{font-size:10px!important;color:#cfcfcf!important}
.top{position:fixed;top:0;left:0;right:0;padding:12px 14px 30px;background:linear-gradient(180deg,rgba(12,20,19,.9),rgba(12,20,19,0));pointer-events:none;z-index:5}
.mast{font-family:Fraunces,Georgia,serif;font-size:1.2rem;font-weight:600}.sub{color:var(--mut);font-size:.68rem;font-family:"IBM Plex Mono",monospace;margin-top:3px}
.sees{position:fixed;left:14px;bottom:86px;max-width:60vw;background:rgba(19,31,29,.9);border:1px solid var(--line);border-radius:12px;padding:8px 12px;font-size:.72rem;z-index:5}
.sees b{color:var(--gold);font-family:"IBM Plex Mono",monospace;font-size:.6rem;text-transform:uppercase;letter-spacing:.08em;display:block;margin-bottom:2px}
.back{position:fixed;right:14px;top:14px;z-index:6;border:1px solid var(--line);background:rgba(19,31,29,.9);border-radius:99px;padding:7px 13px;color:var(--text);text-decoration:none;font-size:.72rem}
.msg{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:30px;text-align:center;color:var(--mut);font-size:.8rem;line-height:1.6;z-index:4}
${NAJ_NAV_CSS}</style></head><body>
<div id=cv></div>
<div class=top><div class=mast>${esc(v.name || "The view")}</div><div class=sub>${esc(v.side ? v.side + " facade" : "")} · standing at ${Math.round(v.h)} m · live photoreal imagery</div></div>
${v.sees ? '<div class=sees><b>this side looks at</b>' + esc(v.sees) + '</div>' : ''}
<a class=back href="javascript:history.back()">← back</a>
<div class=msg id=st>bringing the view into focus…</div>
${noKey ? '<div class=msg>The real view needs the mapping key.<br>Add <code>GOOGLE_MAPS_KEY</code> to the Worker, or open this page with <code>&amp;gkey=…</code>.</div>' : ''}
<script src="https://cdn.jsdelivr.net/npm/cesium@1.121.0/Build/Cesium/Cesium.js"></script>
<script>
window.CESIUM_BASE_URL="https://cdn.jsdelivr.net/npm/cesium@1.121.0/Build/Cesium/";
const GK=${JSON.stringify(v.gkey)},LON=${v.lon},LAT=${v.lat},H=${v.h},HEAD=${v.head};
if(GK){(async()=>{
  const viewer=new Cesium.Viewer("cv",{baseLayerPicker:false,geocoder:false,homeButton:false,sceneModePicker:false,navigationHelpButton:false,timeline:false,animation:false,
    infoBox:false,selectionIndicator:false,globe:false,skyAtmosphere:new Cesium.SkyAtmosphere()});
  viewer.scene.skyBox.show=true;viewer.scene.fog.enabled=true;viewer.scene.screenSpaceCameraController.enableCollisionDetection=false;
  viewer.scene.globe&&(viewer.scene.globe.show=false);
  const setCam=(head,pitch)=>viewer.camera.setView({destination:Cesium.Cartesian3.fromDegrees(LON,LAT,H),orientation:{heading:Cesium.Math.toRadians(head),pitch:Cesium.Math.toRadians(pitch),roll:0}});
  setCam(HEAD,-12);
  let ready=false;
  try{
    const t=await Cesium.Cesium3DTileset.fromUrl("https://tile.googleapis.com/v1/3dtiles/root.json?key="+encodeURIComponent(GK),{showCreditsOnScreen:true});
    t.maximumScreenSpaceError=8;                                    // sharper: the default 16 leaves the near city flat
    t.preloadWhenHidden=true;t.preferLeaves=true;
    viewer.scene.primitives.add(t);
    const st=document.getElementById("st");
    t.allTilesLoaded.addEventListener(()=>{ready=true;if(st)st.remove()});
    t.initialTilesLoaded.addEventListener(()=>{if(st)st.textContent="sharpening…"});
    setTimeout(()=>{ready=true;const s2=document.getElementById("st");if(s2)s2.remove()},12000);   // never wait forever
  }catch(e){document.body.insertAdjacentHTML("beforeend","<div class=msg>Photoreal imagery could not load. Check that the Map Tiles API is enabled for this key and that the key allows this site.</div>")}
  let t0=null,drag=false;                                           // the pan starts only once the view is sharp, and stops on touch
  viewer.scene.canvas.addEventListener("pointerdown",()=>{drag=true},{once:true});
  viewer.clock.onTick.addEventListener(()=>{if(drag||!ready)return;if(t0===null)t0=Date.now();
    setCam(HEAD+Math.sin((Date.now()-t0)/9000)*22,-12)});
})()}
</script>
${najNav(key, "twin")}
</body></html>`;
}
function renderSkyline(slugName, areaName, key, rail) {
  const _dr = (rail || []).map(r =>
    '<a class="dg' + (r.s === slugName ? ' on' : '') + '" href="/skyline/' + r.s + '?key=' + encodeURIComponent(key || '') + '">' + String(r.n).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])) + '</a>').join('');
  return `<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><title>${areaName} — 3D</title><link rel=icon href=/naj_icon.svg><meta name=theme-color content="#0C1413">${NAJ_FONTS}<style>
:root{--ink:#0C1413;--card:#131F1D;--line:#24352F;--text:#E8E4D8;--mut:#8FA39B;--gold:#C5A56A}
html,body{margin:0;height:100%;background:var(--ink);color:var(--text);font-family:"IBM Plex Sans",system-ui,sans-serif;overflow:hidden}
#cv3{position:fixed;inset:0}
#gcredit{position:fixed;right:14px;bottom:100px;color:var(--mut);font-size:.56rem;font-family:"IBM Plex Mono",monospace;opacity:.8;pointer-events:none;z-index:39}
#lbls{position:fixed;inset:0;pointer-events:none;overflow:hidden}#lbls svg{position:absolute;inset:0;width:100%;height:100%}
.lb{position:absolute;transform:translate(-50%,-100%);pointer-events:auto;text-decoration:none;color:var(--text);font-family:"IBM Plex Sans",system-ui,sans-serif;font-size:.74rem;font-weight:500;letter-spacing:.01em;white-space:nowrap;opacity:0;transition:opacity .45s ease;text-shadow:0 1px 3px rgba(0,0,0,.9),0 0 12px rgba(12,20,19,.9)}
.lb.on{opacity:1}.lb i{display:block;font-style:normal;color:var(--mut);font-size:.6rem;font-family:"IBM Plex Mono",monospace;margin-top:1px}.lb.dev{font-weight:600}
#devwrap{position:fixed;left:14px;top:192px;z-index:41;display:flex;flex-direction:row;flex-wrap:wrap;gap:6px;align-items:center;max-width:46vw}   // v74.9: filters live on the LEFT as a banner; the panel on the right fits without scrolling
#projsel{appearance:none;-webkit-appearance:none;font-family:"IBM Plex Mono",monospace;font-size:.68rem;color:var(--text);background:rgba(19,31,29,.92) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23E8E4D8' stroke-width='1.4'/%3E%3C/svg%3E") no-repeat right 11px center;border:1px solid var(--line);border-radius:99px;padding:6px 28px 6px 12px;max-width:52vw}
#ppanel{position:fixed;right:14px;top:82px;bottom:78px;width:min(52vw,600px);overflow:auto;background:rgba(19,31,29,.95);border:1px solid var(--line);border-radius:16px;padding:12px 14px;display:none;z-index:41}
#ppanel.on{display:block}.pt{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:1.05rem;padding-right:22px}.ps{color:var(--gold);font-size:.66rem;text-transform:uppercase;letter-spacing:.08em;margin:3px 0 10px}
.pr{display:flex;justify-content:space-between;gap:10px;border-top:1px solid var(--line);padding:6px 0;font-size:.72rem}.pr span:first-child{color:var(--mut)}.pr span:last-child{text-align:right;font-family:"IBM Plex Mono",monospace}
.px{position:absolute;right:12px;top:10px;color:var(--mut);cursor:pointer}.pa{margin-top:10px;display:flex;flex-wrap:wrap;gap:6px}
.pa .act{display:inline-block;border:1px solid var(--line);border-radius:99px;padding:5px 10px;color:var(--gold);text-decoration:none;font-size:.68rem;font-family:"IBM Plex Mono",monospace;background:rgba(24,42,38,.9)}
.vw{margin-bottom:8px}.vh{color:var(--mut);font-size:.58rem;text-transform:uppercase;letter-spacing:.1em;margin-bottom:5px}
.vr{display:block;color:var(--gold);font-size:.55rem;font-family:"IBM Plex Mono",monospace;text-decoration:none;margin-top:2px}
.vg{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}
.vc{display:block;text-decoration:none;color:var(--text);background:rgba(24,42,38,.9);border:1px solid #2E4A44;border-radius:10px;padding:8px 9px;min-width:0}
.vc.blk{border-color:var(--line);opacity:.72}
.vc b{display:block;font-family:Fraunces,Georgia,serif;font-size:.9rem;color:var(--gold);line-height:1}
.vc i{display:block;font-style:normal;color:var(--text);font-size:.58rem;line-height:1.3;margin-top:4px;min-height:2.6em}
.vc em{display:block;font-style:normal;color:var(--gold);font-size:.54rem;font-family:"IBM Plex Mono",monospace;margin-top:4px}
.tg{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px}.tl{background:rgba(24,42,38,.9);border:1px solid var(--line);border-radius:10px;padding:7px 8px 6px;min-width:0}
.tl svg{width:14px;height:14px;display:block;margin-bottom:3px}.tl b{display:block;font-family:Fraunces,Georgia,serif;font-weight:600;font-size:.74rem;line-height:1.12;overflow-wrap:anywhere}.tl i{display:block;font-style:normal;color:var(--mut);font-size:.52rem;font-family:"IBM Plex Mono",monospace;margin-top:2px;text-transform:uppercase;letter-spacing:.04em}
@media(max-width:900px){.tg{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:640px){.tg{grid-template-columns:repeat(3,minmax(0,1fr))}#devwrap{top:auto;bottom:74px;left:10px;right:10px;max-width:none}#ppanel.on~#devwrap{display:none}}.pn{color:var(--mut);font-size:.6rem;font-family:"IBM Plex Mono",monospace;margin-top:8px}
@media(max-width:640px){#ppanel{left:10px;right:10px;top:auto;bottom:74px;width:auto;max-height:46vh}}#devsel{appearance:none;-webkit-appearance:none;font-family:"IBM Plex Mono",monospace;font-size:.7rem;color:var(--gold);background:rgba(19,31,29,.92) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23C5A56A' stroke-width='1.4'/%3E%3C/svg%3E") no-repeat right 11px center;border:1px solid rgba(197,165,106,.5);border-radius:99px;padding:7px 28px 7px 12px;max-width:52vw}
#legend{position:fixed;left:14px;bottom:78px;display:flex;flex-direction:column;gap:5px;pointer-events:none;opacity:0;transition:opacity .4s}#legend.on{opacity:1}
.lg{display:flex;align-items:center;gap:7px;font-family:"IBM Plex Mono",monospace;font-size:.64rem;color:var(--text);background:rgba(19,31,29,.85);border:1px solid var(--line);border-radius:99px;padding:4px 10px 4px 6px}.lg b{width:9px;height:9px;border-radius:50%;display:inline-block}
.top{position:fixed;top:0;left:0;right:0;padding:12px 14px 26px;background:linear-gradient(180deg,rgba(12,20,19,.92),rgba(12,20,19,0));pointer-events:none}
.mast{font-family:Fraunces,Georgia,serif;font-size:1.3rem;font-weight:600}.mast em{font-style:normal;color:var(--gold)}
.sub{color:var(--mut);font-size:.7rem;font-family:"IBM Plex Mono",monospace;margin-top:2px}
.tog{position:fixed;top:118px;left:14px;display:flex;gap:6px;flex-wrap:wrap}
.feat{position:fixed;top:154px;left:14px;display:flex;gap:6px;flex-wrap:wrap}
.fg{font-family:"IBM Plex Mono",monospace;font-size:.66rem;border:1px solid rgba(197,165,106,.45);background:rgba(19,31,29,.9);border-radius:99px;padding:6px 11px;color:var(--gold);cursor:pointer;-webkit-tap-highlight-color:transparent}
.fg.on{background:rgba(197,165,106,.18);border-color:var(--gold)}
.tg{font-family:"IBM Plex Mono",monospace;font-size:.66rem;border:1px solid var(--line);background:rgba(19,31,29,.85);border-radius:99px;padding:6px 11px;color:var(--mut);cursor:pointer;-webkit-tap-highlight-color:transparent}
.tg.on{color:var(--gold);border-color:rgba(197,165,106,.6)}
.rail{position:fixed;top:68px;left:0;right:0;display:flex;gap:6px;overflow-x:auto;padding:6px 14px;pointer-events:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.rail::-webkit-scrollbar{display:none}
.dg{flex:0 0 auto;font-family:"IBM Plex Mono",monospace;font-size:.62rem;border:1px solid var(--line);background:rgba(19,31,29,.85);border-radius:99px;padding:5px 10px;color:var(--mut);text-decoration:none;-webkit-tap-highlight-color:transparent}
.dg.on{color:var(--gold);border-color:rgba(197,165,106,.6)}
#card{position:fixed;left:12px;right:12px;bottom:calc(74px + env(safe-area-inset-bottom));max-width:430px;margin:auto;background:rgba(19,31,29,.96);border:1px solid rgba(197,165,106,.5);border-radius:14px;padding:14px 16px;display:none;z-index:40}
#card.on{display:block}
#card .ct{font-family:Fraunces,Georgia,serif;font-size:1.05rem;font-weight:600;color:var(--gold)}
#card .cs{color:var(--mut);font-size:.68rem;font-family:"IBM Plex Mono",monospace;margin:2px 0 8px}
#card .cf{display:flex;justify-content:space-between;gap:10px;font-size:.72rem;padding:3px 0;border-top:1px solid rgba(36,53,47,.8)}
#card .cf span:first-child{color:var(--mut)}
#card .cf span:last-child{text-align:right}
#card .cx{position:absolute;top:8px;right:12px;color:var(--mut);cursor:pointer;font-size:1rem}
#card .cp{color:rgba(143,163,155,.75);font-size:.58rem;font-family:"IBM Plex Mono",monospace;margin-top:8px}
.rpt{margin-left:9px;font-family:"IBM Plex Mono",monospace;font-size:.55rem;letter-spacing:.05em;color:#C5A56A;background:rgba(197,165,106,.1);border:1px solid rgba(197,165,106,.42);border-radius:99px;padding:3px 9px;text-decoration:none;vertical-align:middle;white-space:nowrap}
#msg{position:fixed;inset:0;display:grid;place-items:center;color:var(--mut);font-size:.85rem;text-align:center;padding:0 30px}
.foot{position:fixed;right:10px;bottom:calc(64px + env(safe-area-inset-bottom));color:rgba(143,163,155,.7);font-size:.58rem;font-family:"IBM Plex Mono",monospace;pointer-events:none}
${NAJ_NAV_CSS}</style>
<script type="importmap">{"imports":{"three":"https://unpkg.com/three@0.169.0/build/three.module.js","three/addons/":"https://unpkg.com/three@0.169.0/examples/jsm/"}}</script>
</head><body>
<div id=cv3></div>
<div class=top><div class=mast>${areaName} <em>· 3D</em><a class=rpt href="/report/${slugName}?key=${encodeURIComponent(key || '')}">stock report →</a></div><div class=sub>massing from the register — heights real where known, illustrative where not</div></div>
<div class=rail>${_dr}</div>
<div id=card><span class=cx id=cx>✕</span><div class=ct id=ct></div><div class=cs id=cs></div><div id=cfacts></div><div class=cp id=cp></div></div>
<div class=tog id=filters></div>
<div class=feat id=feat></div>
<div id=msg>loading massing…</div>
<div class=foot>model: CityEngine from OSM footprints + DLD register · facades: Esri CityEngine texture library · © OpenStreetMap contributors</div>
${najNav(key, "twin")}
<script type="module">
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
const el=document.getElementById("cv3"),msg=document.getElementById("msg");
const MOBILE=innerWidth<600;   // v75 look pass: mobile gets a lighter pixel ratio and no MSAA in the composer
const scene=new THREE.Scene();scene.background=new THREE.Color(0x0C1413);scene.fog=new THREE.Fog(0x0C1413,2500,9000);
const cam=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,1,20000);
const ren=new THREE.WebGLRenderer({antialias:true});ren.setPixelRatio(Math.min(MOBILE?1.5:2,devicePixelRatio));ren.setSize(innerWidth,innerHeight);ren.toneMapping=THREE.ACESFilmicToneMapping;ren.toneMappingExposure=0.95;el.appendChild(ren.domElement);
ren.shadowMap.enabled=true;ren.shadowMap.type=THREE.PCFSoftShadowMap;
// v75 LOOK PASS (3 Sep): image-based light so the massing has real shading, a dark sky dome, soft sun shadows, gentle glow on pipeline.
{const pm=new THREE.PMREMGenerator(ren);scene.environment=pm.fromScene(new RoomEnvironment(),0.04).texture;pm.dispose();scene.environmentIntensity=0.45;}
const SKYCOL={horizon:new THREE.Color(0x1B332E),zenith:new THREE.Color(0x121D1B),warm:new THREE.Color(0xC5A56A)};   // pre-tone-map values chosen so ACES lands on ink #0C1413 / teal-black #152926   // deep teal-black at the horizon -> ink at zenith, a breath of gold on the skyline
const sky=new THREE.Mesh(new THREE.SphereGeometry(1,48,24),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,
  uniforms:{horizon:{value:SKYCOL.horizon},zenith:{value:SKYCOL.zenith},warm:{value:SKYCOL.warm}},
  vertexShader:"varying vec3 vW;void main(){vW=normalize((modelMatrix*vec4(position,1.0)).xyz);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
  fragmentShader:"uniform vec3 horizon,zenith,warm;varying vec3 vW;void main(){float h=clamp(vW.y,0.0,1.0);vec3 c=mix(horizon,zenith,pow(h,0.45));c+=warm*0.035*exp(-h*14.0);gl_FragColor=vec4(c,1.0);\\n#include <tonemapping_fragment>\\n#include <colorspace_fragment>\\n}"}));
sky.scale.setScalar(9000);sky.renderOrder=-1;sky.frustumCulled=false;scene.add(sky);
scene.add(new THREE.HemisphereLight(0xE8E4D8,0x182823,0.35));
const sun=new THREE.DirectionalLight(0xF2E7CF,2.2);sun.position.set(1,1.2,0.6);scene.add(sun);scene.add(sun.target);
sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.bias=-0.0004;sun.shadow.normalBias=0.6;
const fill=new THREE.DirectionalLight(0x3E8A7E,0.35);fill.position.set(-1,0.4,-0.8);scene.add(fill);
// selective bloom: pipeline meshes carry layer 1; everything else is painted black for the bloom pass, then the pure glow is added on top
const BLOOM=1,bloomLayer=new THREE.Layers();bloomLayer.set(BLOOM);const DARK=new THREE.MeshBasicMaterial({color:0x000000});
let bloomC=null,finalC=null,bloomPass=null;const _mats=new Map();
function setupBloom(){
  const pr=ren.getPixelRatio(),W=innerWidth,H=innerHeight;
  const rt=new THREE.WebGLRenderTarget(W*pr,H*pr,{type:THREE.HalfFloatType,samples:MOBILE?0:4});
  bloomC=new EffectComposer(ren);bloomC.renderToScreen=false;bloomC.addPass(new RenderPass(scene,cam));
  bloomPass=new UnrealBloomPass(new THREE.Vector2(W,H),0.35,0.45,0.6);bloomC.addPass(bloomPass);
  finalC=new EffectComposer(ren,rt);finalC.addPass(new RenderPass(scene,cam));
  const mix=new ShaderPass(new THREE.ShaderMaterial({uniforms:{baseTexture:{value:null},bloomTexture:{value:bloomPass.renderTargetsHorizontal[0].texture}},
    vertexShader:"varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader:"uniform sampler2D baseTexture;uniform sampler2D bloomTexture;varying vec2 vUv;void main(){gl_FragColor=texture2D(baseTexture,vUv)+vec4(texture2D(bloomTexture,vUv).rgb,0.0);}"}),"baseTexture");
  mix.needsSwap=true;finalC.addPass(mix);finalC.addPass(new OutputPass());}
function renderFrame(){
  if(!finalC){ren.render(scene,cam);return}
  const bg=scene.background;scene.background=null;sky.visible=false;
  scene.traverse(o=>{if(o.isMesh&&!o.layers.test(bloomLayer)){_mats.set(o,o.material);o.material=DARK}});
  bloomC.render();
  _mats.forEach((m,o)=>{o.material=m});_mats.clear();sky.visible=true;scene.background=bg;
  finalC.render();}
const ctl=new OrbitControls(cam,ren.domElement);ctl.enableDamping=true;ctl.autoRotate=true;ctl.autoRotateSpeed=0.5;ctl.maxPolarAngle=Math.PI*0.49;
addEventListener("pointerdown",()=>ctl.autoRotate=false,{once:true});
const GROUPS={existing:{label:"existing",col:0x39434F,on:true,meshes:[]},construction:{label:"under construction",col:0x3E8A7E,on:true,meshes:[]},pipeline:{label:"pipeline",col:0xC5A56A,on:true,meshes:[]}};
function classify(hex){const d=(a,b)=>{const c1=new THREE.Color(a),c2=new THREE.Color(b);return (c1.r-c2.r)**2+(c1.g-c2.g)**2+(c1.b-c2.b)**2};
let best="existing",bd=1e9;for(const k in GROUPS){const dd=d(hex,GROUPS[k].col);if(dd<bd){bd=dd;best=k}}return best}
const loader=new GLTFLoader();loader.setMeshoptDecoder(MeshoptDecoder);   // compressed GLBs load too
loader.load("/img/sky_${slugName}",g=>{
  msg.remove();
  const root=g.scene;
  const box=new THREE.Box3().setFromObject(root);const c=box.getCenter(new THREE.Vector3());const sz=box.getSize(new THREE.Vector3());
  root.position.sub(c);root.position.y+=sz.y/2- (c.y-box.min.y);
  const DISPLAY={existing:0x8A857C,construction:0x3E8A7E,pipeline:0xC5A56A};   // existing = warm grey under the image light (untextured v2 files)
  // v76 TEXTURES (3 Sep): v3 exports carry real facade photos (baseColorTexture, WebP) and the status in the mesh name
  // "b<i>_<class>_s<status>". A textured material is KEPT and only tinted (existing none / construction teal / pipeline gold + glass);
  // an untextured one is replaced by the flat status colour as before (status from the name when present, nearest colour otherwise).
  const STATUS_RE=/_s(existing|construction|pipeline)(?:_|$)/;
  const TINT={existing:0xFFFFFF,construction:0xA9DCCF,pipeline:0xE6CC94};
  const ANISO=Math.min(8,ren.capabilities.getMaxAnisotropy());
  function statusOf(o){for(let n=o;n;n=n.parent){const m=STATUS_RE.exec(n.name||"");if(m)return m[1]}
    const m0=Array.isArray(o.material)?o.material[0]:o.material;return classify(m0&&m0.color?m0.color.getHex():0x39434F)}
  root.traverse(o=>{if(o.isMesh){const grp=statusOf(o);
    const fix=(m)=>{if(!(m&&m.map))return new THREE.MeshStandardMaterial({color:DISPLAY[grp],flatShading:true,roughness:0.82,metalness:0.05,transparent:grp==="pipeline",opacity:grp==="pipeline"?0.55:1,
        emissive:grp==="pipeline"?0xC5A56A:0x000000,emissiveIntensity:grp==="pipeline"?0.28:1});
      m.map.colorSpace=THREE.SRGBColorSpace;m.map.anisotropy=ANISO;m.map.needsUpdate=true;   // photos are sRGB; anisotropy keeps window rows crisp at grazing angles
      m.flatShading=true;m.roughness=0.88;m.metalness=0;m.side=THREE.FrontSide;m.envMapIntensity=0.7;m.color.setHex(TINT[grp]);
      if(grp==="pipeline"){m.transparent=true;m.opacity=0.6;m.emissive=new THREE.Color(0xC5A56A);m.emissiveIntensity=0.22}
      else if(grp==="construction"){m.emissive=new THREE.Color(0x3E8A7E);m.emissiveIntensity=0.07}
      m.userData.textured=true;m.needsUpdate=true;return m};
    o.material=Array.isArray(o.material)?o.material.map(fix):fix(o.material);
    o.castShadow=grp!=="pipeline";o.receiveShadow=true;if(grp==="pipeline")o.layers.enable(BLOOM);   // ghosts glow, they do not throw shadows
    o.userData.grp=grp;GROUPS[grp].meshes.push(o);}});
  scene.add(root);
  ROOTREF=root;drawCtx();
  MESHES=[];root.traverse(o=>{if(o.isMesh)MESHES.push(o)});   // v74: export order = mesh index (per-building GLB), used by the anchors
  paintDevs();
  const ground=new THREE.Mesh(new THREE.CircleGeometry(Math.max(sz.x,sz.z)*1.4,64),new THREE.MeshStandardMaterial({color:0x16211E,roughness:1}));
  ground.rotation.x=-Math.PI/2;ground.position.y=box.min.y-c.y+0.1;ground.receiveShadow=true;scene.add(ground);
  GROUND=ground;drawGroundImagery();
  const R=Math.max(sz.x,sz.z);cam.position.set(R*0.9,R*0.42,R*0.9);ctl.target.set(0,sz.y*0.18,0);
  scene.fog.near=R*1.3;scene.fog.far=R*3.6;cam.far=Math.max(20000,R*8);cam.updateProjectionMatrix();
  sky.scale.setScalar(Math.min(cam.far*0.8,R*6));
  {const rad=sz.length()*0.52,d=new THREE.Vector3(1,1.2,0.6).normalize();sun.position.copy(d.multiplyScalar(rad*2.2));sun.target.position.set(0,0,0);   // shadow frustum hugs the model's bounding sphere
    const sc=sun.shadow.camera;sc.left=-rad;sc.right=rad;sc.top=rad;sc.bottom=-rad;sc.near=rad*1.1;sc.far=rad*3.4;sc.updateProjectionMatrix();}
  if(GROUPS.pipeline.meshes.length)setupBloom();   // no pipeline = no composer, plain render path
  const fr=document.getElementById("filters");
  for(const k in GROUPS){const gme=GROUPS[k];if(!gme.meshes.length)continue;
    // count BUILDINGS, not primitives: a textured building is walls + roof + bands (Kendall, 3 Sep)
    const bid=(m)=>{let o=m;for(let k=0;k<3&&o;k++){const mm=(o.name||"").match(/^b(\d+)/);if(mm)return mm[1];o=o.parent}return "m"+m.id};
    const nB=new Set(gme.meshes.map(bid)).size;
    const b=document.createElement("span");b.className="tg on";b.textContent=gme.label+" ("+nB+")";
    b.onclick=()=>{gme.on=!gme.on;b.classList.toggle("on",gme.on);gme.meshes.forEach(m=>m.visible=gme.on)};fr.appendChild(b)}
  buildFeat();
},undefined,()=>{msg.textContent="No 3D massing for this community yet — it gets built the first time CityEngine runs for it."});
let META=null;
fetch("/img/meta_${slugName}").then(r=>r.ok?r.json():null).then(m=>{META=m;buildFeat()}).catch(()=>{});
let CTX=null,ctxG=null,ROOTREF=null;
// v75 - AERIAL GROUND (Kendall, 3 Sep): Esri World Imagery draped under the massing (ground_<slug> json + ground_<slug>_jpg in KV,
// exported by scripts/ground_imagery.py in the GLB's own metres). Photographed roads/parks replace the drawn ctx roads/green.
let GROUND=null,GIMG=null,GPLANE=null,HAVE_GROUND=false;
fetch("/img/ground_${slugName}").then(r=>r.ok?r.json():null).then(g=>{if(!g||!g.scene)return;GIMG=g;HAVE_GROUND=true;drawGroundImagery();
  if(ctxG)ctxG.children.forEach(ch=>{if(ch.userData.k==="roads"||ch.userData.k==="green")ch.visible=false})}).catch(()=>{});
function drawGroundImagery(){
  if(!GIMG||!GROUND||!ROOTREF||GPLANE)return;
  const G=GIMG.scene;const tex=new THREE.TextureLoader().load("/img/ground_${slugName}_jpg");
  tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=Math.min(8,ren.capabilities.getMaxAnisotropy());
  const geo=new THREE.PlaneGeometry(G.x1-G.x0,G.z1-G.z0);geo.rotateX(-Math.PI/2);          // image top row = north = smaller z; no flip needed
  GPLANE=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({map:tex,roughness:1,metalness:0,color:0x9AA09A}));
  GPLANE.position.set((G.x0+G.x1)/2+ROOTREF.position.x,GROUND.position.y+0.05,(G.z0+G.z1)/2+ROOTREF.position.z);
  GPLANE.receiveShadow=true;GPLANE.renderOrder=-1;scene.add(GPLANE);
  const cr=document.createElement("div");cr.id="gcredit";cr.textContent=GIMG.attribution||"Source: Esri, Vantor, Earthstar Geographics, and the GIS User Community";document.body.appendChild(cr);}
// v77 STREETS (3 Sep): CityEngine street layer (ESRI.lib Street_Modern_Standard on the OSM centrelines, packed GLB in KV as streets_<slug>)
// in the same absolute metres as the massing. It sits 0.15 m above the imagery plane (GROUND+0.05), keeps its own asphalt/kerb/pavement
// textures, receives the building shadows and hides the drawn ctx roads. No streets GLB in KV = nothing changes.
let STREETS=null,_stTries=0;
loader.load("/img/streets_${slugName}",g=>{STREETS=g.scene;placeStreets()},undefined,()=>{});
function placeStreets(){
  if(!STREETS||STREETS.parent)return;
  if(!ROOTREF||!GROUND){if(_stTries++<2400)requestAnimationFrame(placeStreets);return}   // the massing may still be loading
  const ani=Math.min(8,ren.capabilities.getMaxAnisotropy());
  STREETS.traverse(o=>{if(!o.isMesh)return;o.receiveShadow=true;o.castShadow=false;
    const fix=m=>{if(m.map){m.map.colorSpace=THREE.SRGBColorSpace;m.map.anisotropy=ani;m.map.needsUpdate=true}
      m.roughness=0.95;m.metalness=0;m.envMapIntensity=0.5;m.polygonOffset=true;m.polygonOffsetFactor=-2;m.polygonOffsetUnits=-4;m.needsUpdate=true;return m};   // offset keeps the asphalt in front of the imagery plane at distance
    o.material=Array.isArray(o.material)?o.material.map(fix):fix(o.material)});
  STREETS.position.set(ROOTREF.position.x,GROUND.position.y+0.2,ROOTREF.position.z);   // GLB y=0 = street level = massing base; imagery plane is GROUND+0.05
  scene.add(STREETS);hideCtxRoads()}
function hideCtxRoads(){if(!STREETS||!STREETS.parent)return;if(!ctxG){if(_stTries++<2400)requestAnimationFrame(hideCtxRoads);return}
  ctxG.children.forEach(ch=>{if(ch.userData.k==="roads")ch.visible=false})}
fetch("/img/ctx_${slugName}").then(r=>r.ok?r.json():null).then(cx=>{CTX=cx;drawCtx()}).catch(()=>{});
function drawCtx(){
  if(!CTX||!ROOTREF||ctxG)return;
  ctxG=new THREE.Group();ctxG.position.copy(ROOTREF.position);
  const L=[["green",0x17301F,0.3,1],["roads",0x272C30,0.55,1]];   // v74.1: sea/water planes off (Kendall, 3 Sep) - they read badly against the ground disc
  L.forEach(t=>{const k=t[0],col=t[1],y=t[2],op=t[3];const polys=CTX[k]||[];if(!polys.length)return;
    const shapes=[];
    polys.forEach(rings=>{try{
      const sh=new THREE.Shape(rings[0].map(pp=>new THREE.Vector2(pp[0],-pp[1])));
      for(let i=1;i<rings.length;i++)sh.holes.push(new THREE.Path(rings[i].map(pp=>new THREE.Vector2(pp[0],-pp[1]))));
      shapes.push(sh)}catch(e){}});
    if(!shapes.length)return;
    const g2=new THREE.ShapeGeometry(shapes,1);g2.rotateX(-Math.PI/2);g2.translate(0,y,0);
    const mm=new THREE.Mesh(g2,new THREE.MeshStandardMaterial({color:col,roughness:0.95,metalness:0,transparent:op<1,opacity:op}));mm.receiveShadow=true;
    mm.userData.k=k;if(HAVE_GROUND&&(k==="roads"||k==="green"))mm.visible=false;          // the photo already shows them
    ctxG.add(mm)});
  scene.add(ctxG);}
let FOCUS=null,HOME=null;const ORIG=new Map();
function allMeshes(){return [...GROUPS.existing.meshes,...GROUPS.construction.meshes,...GROUPS.pipeline.meshes]}
function buildFeat(){
  if(!META||!META.buildings)return;
  const fe=document.getElementById("feat");if(!fe||fe.childElementCount)return;
  if(!GROUPS.construction.meshes.length&&!GROUPS.pipeline.meshes.length)return;
  for(const k in META.buildings){const b=META.buildings[k];
    const c=document.createElement("span");c.className="fg";c.textContent="⬢ "+(b.title||k).split("(")[0].trim();
    c.onclick=()=>focusBuilding(k,c);fe.appendChild(c)}}
function focusBuilding(k,chip){
  const b=META.buildings[k];if(!b)return;
  const target=GROUPS[b.status_key]&&GROUPS[b.status_key].meshes||[];
  if(!target.length)return;
  if(FOCUS===k){unfocus();return}
  document.querySelectorAll(".fg").forEach(x=>x.classList.remove("on"));if(chip)chip.classList.add("on");
  if(!HOME)HOME={pos:cam.position.clone(),tgt:ctl.target.clone(),rot:ctl.autoRotate,spd:ctl.autoRotateSpeed};
  FOCUS=k;
  allMeshes().forEach(m=>{if(target.indexOf(m)<0){if(!ORIG.has(m))ORIG.set(m,[m.material.transparent,m.material.opacity]);m.material.transparent=true;m.material.opacity=0.10}});
  target.forEach(m=>{if(ORIG.has(m)){m.material.transparent=ORIG.get(m)[0];m.material.opacity=ORIG.get(m)[1];ORIG.delete(m)}});
  const bb=new THREE.Box3();target.forEach(m=>bb.expandByObject(m));
  const c2=bb.getCenter(new THREE.Vector3()),s2=bb.getSize(new THREE.Vector3());
  const r2=Math.max(s2.x,s2.z,s2.y*0.9,30);
  ctl.target.copy(c2);cam.position.set(c2.x+r2*2.6,c2.y+r2*1.5,c2.z+r2*2.6);
  ctl.autoRotate=true;ctl.autoRotateSpeed=1.4;
  showCard(b);}
function unfocus(){
  FOCUS=null;document.querySelectorAll(".fg").forEach(x=>x.classList.remove("on"));
  ORIG.forEach((v,m)=>{m.material.transparent=v[0];m.material.opacity=v[1]});ORIG.clear();
  if(HOME){cam.position.copy(HOME.pos);ctl.target.copy(HOME.tgt);ctl.autoRotate=HOME.rot;ctl.autoRotateSpeed=HOME.spd;HOME=null}
  document.getElementById("card").classList.remove("on");}
function showCard(b){
  document.getElementById("ct").textContent=b.title;
  document.getElementById("cs").textContent=b.developer+" · "+b.status;
  document.getElementById("cfacts").innerHTML=(b.facts||[]).map(f=>"<div class=cf><span>"+f[0]+"</span><span>"+f[1]+"</span></div>").join("");
  document.getElementById("cp").textContent=(b.sources||[]).join(" · ")+(b.placement?" · "+b.placement:"");
  document.getElementById("card").classList.add("on");}
// ---- v74 LABELS + DEVELOPER COLOUR (Kendall, 3 Sep): names float above buildings passing the FRONT of the rotation, on thin
// leader lines at staggered heights, ten at most, held a few seconds, never painted on the model. Buildings of the eleven
// developers take their developer's colour; the legend lists only developers currently labelled. Anchors = data/names/anchors_<slug>.json
// (name, x/z in the GLB's own metres, roof height, developer key, mesh index) built by build_anchors.py.
const DEVCOL={omniyat:0xE8E4D8,hh:0xD96C5F,meraas:0xD9A441,select:0x3E8A7E,ellington:0x8FC7B9,arada:0x56B584,zaya_palma:0x9B8CE6,fakhruddin:0xF28C6A,beyond:0x4C9BE8,imtiaz:0xC41E3A,iman:0xB08BD9};
const DEVNAME={omniyat:"OMNIYAT",hh:"H&H",meraas:"Meraas",select:"Select Group",ellington:"Ellington",arada:"Arada",zaya_palma:"ZAYA / Palma",fakhruddin:"Fakhruddin",beyond:"BEYOND",imtiaz:"Imtiaz",iman:"Iman"};
const KEY=${JSON.stringify(key || "")};let ANCH=null,MESHES=null,LIVE=new Map();const TIERS=[62,118,168,92,142,196,76,128,182,106];
const lblWrap=document.createElement("div");lblWrap.id="lbls";lblWrap.innerHTML='<svg xmlns="http://www.w3.org/2000/svg"></svg>';document.body.appendChild(lblWrap);
const svgL=lblWrap.querySelector("svg");const legend=document.createElement("div");legend.id="legend";document.body.appendChild(legend);
fetch("/img/anchors_${slugName}").then(r=>r.ok?r.json():null).then(a=>{if(!a||!a.anchors)return;ANCH=a;paintDevs()}).catch(()=>{});
function paintDevs(){
  if(!ANCH||!MESHES||!ANCH.per_building_glb)return;
  // anchor -> mesh by POSITION (mesh order in a merged export is not the footprint order): nearest mesh centre within 12 m
  const _cc=new THREE.Vector3(),_bb=new THREE.Box3();ROOTREF.updateWorldMatrix(true,true);   // v76: packed (quantized) GLBs carry a dequantise transform on the node, so measure in ROOT space, not geometry space
  const cents=MESHES.map(m=>{if(!m.geometry.boundingBox)m.geometry.computeBoundingBox();_bb.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld);_bb.getCenter(_cc).sub(ROOTREF.position);return [_cc.x,_cc.z]});
  // a banded tower is several meshes (walls, floor bands, crown): give EVERY mesh to its nearest footprint, then an anchor owns all
  // the meshes of its footprint (a.meshes); a.mesh keeps the first for compatibility
  const fps=ANCH.fps||ANCH.anchors.map(a=>[a.i,a.x,a.z,a.h]);const byFp={};
  for(let i=0;i<cents.length;i++){let bi=-1,bd=1e9;for(const f of fps){if(f[1]==null)continue;const dx=f[1]-cents[i][0],dz=f[2]-cents[i][1],d=dx*dx+dz*dz;if(d<bd){bd=d;bi=f[0]}}
    if(bi>=0&&bd<=900)(byFp[bi]=byFp[bi]||[]).push(i)}
  for(const a of ANCH.anchors){const ms=byFp[a.i]||[];a.meshes=ms;a.mesh=ms.length?ms[0]:null}
  window.__sky={get anch(){return ANCH},get meshes(){return MESHES},get cam(){return cam},get ctl(){return ctl},get root(){return ROOTREF},get state(){return [SELDEV,SELPROJ]},sel:buildDevSel,dev:applyDev,proj:applyProj,open:openAnchor};
  // every mesh gets its own material copies (merged exports share materials and use arrays per primitive) so fading one never fades another
  for(const m of MESHES){m.material=Array.isArray(m.material)?m.material.map(x=>x.clone()):m.material.clone()}
  const mats=(m)=>Array.isArray(m.material)?m.material:[m.material];
  for(const a of ANCH.anchors){if(!a.dev||!a.meshes||!a.meshes.length)continue;
    for(const mi of a.meshes){const m=MESHES[mi];if(!m)continue;
      for(const mt of mats(m)){const dc=new THREE.Color(DEVCOL[a.dev]||0xC5A56A);
        if(mt.map){mt.color.lerp(dc,0.35);mt.emissive=dc;mt.emissiveIntensity=0.16}   // v76: textured tower keeps its facade photo, tinted 35 % towards the developer colour + a glow
        else{mt.color.copy(dc);mt.emissive=dc.clone();mt.emissiveIntensity=0.12}}m.userData.dev=a.dev}}
  buildDevSel();}
const MATS=(m)=>Array.isArray(m.material)?m.material:[m.material];
function ghost(m,on){m.visible=!on;      // Kendall: the others must go, not fade - hide them outright; roads and ground stay for context
  for(const mt of MATS(m)){if(!DEVORIG.has(mt))DEVORIG.set(mt,[mt.transparent,mt.opacity]);const o=DEVORIG.get(mt);mt.transparent=o[0];mt.opacity=o[1];mt.depthWrite=true;mt.needsUpdate=true}}
// v74.4 - DEVELOPER FILTER (Kendall, 3 Sep): pick a developer and every other building fades to a ghost; only that developer's
// towers stay solid, labelled, and the camera frames them. "all developers" restores the district.
let SELDEV="";const DEVORIG=new Map();
function buildDevSel(){
  if(document.getElementById("devsel"))return;
  const present=[...new Set((ANCH.anchors||[]).filter(a=>a.dev&&a.meshes&&a.meshes.length).map(a=>a.dev))];
  if(!present.length)return;
  const wrap=document.createElement("div");wrap.id="devwrap";
  const sel=document.createElement("select");sel.id="devsel";
  sel.innerHTML='<option value="">all developers</option>'+present.sort((x,y)=>DEVNAME[x].localeCompare(DEVNAME[y])).map(d=>'<option value="'+d+'">'+DEVNAME[d]+' ('+(ANCH.anchors.filter(a=>a.dev===d).length)+')</option>').join("");
  sel.onchange=()=>applyDev(sel.value);wrap.appendChild(sel);
  const ps=document.createElement("select");ps.id="projsel";ps.style.display="none";ps.onchange=()=>applyProj(ps.value);wrap.appendChild(ps);
  document.body.appendChild(wrap);}
{const pp=document.createElement("div");pp.id="ppanel";document.body.appendChild(pp);}   // fact panel exists from the start
// v74.5 - PROJECT DRILL: second dropdown lists the chosen developer's projects in this district; picking one keeps the tower in 3D,
// slides it to the left and opens the fact panel on the right (developer-site facts + availability sheet + DLD 2026 + nearest metro/mall).
let SELPROJ="",PROJFACTS=null;
fetch("/img/projfacts").then(r=>r.ok?r.json():null).then(j=>{PROJFACTS=j&&j.projects||null}).catch(()=>{});
const nz=(s)=>String(s||"").toLowerCase().replace(/\\b(the|by|at|residences?|residency|tower|towers|apartments?|dubai|building)\\b/g," ").replace(/[^a-z0-9]/g,"");
function projFor(dev,name){
  if(!PROJFACTS)return null;const k=nz(name);
  for(const id in PROJFACTS){const p=PROJFACTS[id];if(p.dev!==dev)continue;
    if(nz(p.name)===k||(p.aliases||[]).some(a=>nz(a)===k))return p}
  for(const id in PROJFACTS){const p=PROJFACTS[id];if(p.dev!==dev)continue;const pk=nz(p.name);if(pk.length>5&&(k.indexOf(pk)>=0||pk.indexOf(k)>=0))return p}
  return null}
function fillProjSel(d){
  const ps=document.getElementById("projsel");if(!ps)return;
  if(!d){ps.style.display="none";ps.innerHTML="";return}
  const names=[...new Set(ANCH.anchors.filter(a=>a.dev===d&&a.meshes&&a.meshes.length).map(a=>a.dev_project||a.name))].sort();
  ps.innerHTML='<option value="">all '+DEVNAME[d]+' projects</option>'+names.map(n=>'<option value="'+n.replace(/"/g,"&quot;")+'">'+n+'</option>').join("");
  ps.style.display=names.length?"block":"none";}
const fmA=(n)=>n==null?"-":(n>=1e6?(n/1e6).toFixed(2)+" M":Math.round(n).toLocaleString("en-US"));
// tap on a tower or its label: sync the dropdowns to that building's developer (if any) and open it
function openAnchor(a){
  const ds=document.getElementById("devsel"),ps=document.getElementById("projsel");
  const d=a.dev||"";
  if(d!==SELDEV){if(ds)ds.value=d;applyDev(d)}
  const nm=a.dev_project||a.name;
  if(ps&&d){if(![...ps.options].some(o=>o.value===nm)){const o=document.createElement("option");o.value=nm;o.textContent=nm;ps.appendChild(o)}ps.value=nm}
  applyProj(nm);}
function applyProj(name){
  SELPROJ=name;const pp=document.getElementById("ppanel");
  const mine=new Set();ANCH.anchors.filter(a=>(a.dev||"")===(SELDEV||"")&&(a.dev_project||a.name)===name).forEach(a=>(a.meshes||[]).forEach(i=>mine.add(i)));
  MESHES.forEach((m,i)=>ghost(m,!(name?mine.has(i):(SELDEV?m.userData.dev===SELDEV:true))));
  LIVE.forEach((L)=>{L.el.remove();L.ln.remove();L.dot.remove()});LIVE.clear();
  if(!name){pp.classList.remove("on");applyDev(SELDEV);return}
  if(!mine.size){pp.classList.remove("on");return}
  // frame the building, then slide the view so it sits in the left third and the panel takes the right
  const bb=new THREE.Box3();mine.forEach(i=>bb.expandByObject(MESHES[i]));
  const c2=bb.getCenter(new THREE.Vector3()),s2=bb.getSize(new THREE.Vector3());const r2=Math.max(s2.x,s2.z,s2.y*0.7,60);
  const eye=new THREE.Vector3(c2.x+r2*2.4,c2.y+r2*0.9,c2.z+r2*2.4);const dir=c2.clone().sub(eye).normalize();
  const right=new THREE.Vector3().crossVectors(dir,new THREE.Vector3(0,1,0)).normalize().multiplyScalar(innerWidth>640?r2*1.1:0);
  ctl.target.copy(c2.clone().add(right));cam.position.copy(eye.clone().add(right));ctl.autoRotate=false;
  const a0=ANCH.anchors.find(a=>(a.dev||"")===(SELDEV||"")&&(a.dev_project||a.name)===name);const f=SELDEV?(projFor(SELDEV,name)||projFor(SELDEV,a0&&a0.name)):null;
  const esc=(s)=>String(s==null?"":s).replace(/[&<>]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[ch]));
  const rows=[];if(f){
    const d=f.dld||{};
    if(f.area)rows.push(["Where",f.area]);if(f.handover)rows.push(["Handover",f.handover]);
    if(f.structure||f.storeys)rows.push(["Structure",f.structure||(f.storeys+" storeys")]);if(f.units)rows.push(["Units",f.units]);
    if(f.mix&&f.mix.length)rows.push(["Mix",f.mix.filter(m=>!/retail|office/.test(m)).join(", ")]);if(f.plans&&f.plans.length)rows.push(["Payment plan",f.plans.join(" / ")]);
    if(d.sales_2026)rows.push(["Registered sales 2026",d.sales_2026]);if(d.median_aed)rows.push(["Median price","AED "+fmA(d.median_aed)]);
    if(d.p10_aed)rows.push(["Typical range","AED "+fmA(d.p10_aed)+" – "+fmA(d.p90_aed)]);if(d.median_aed_per_sqm)rows.push(["Median AED / m²",fmA(d.median_aed_per_sqm)]);
    if(d.offplan_share!=null)rows.push(["Off-plan share",Math.round(d.offplan_share*100)+"%"]);if(d.rooms)rows.push(["Sold by type",Object.entries(d.rooms).map(x=>x[0]+" "+x[1]).join(" · ")]);
    if(d.nearest_metro)rows.push(["Nearest metro",d.nearest_metro]);if(d.nearest_mall)rows.push(["Nearest mall",d.nearest_mall]);if(d.nearest_landmark)rows.push(["Landmark",d.nearest_landmark]);
    if(f.sheet)rows.push(["On the developer sheet",f.sheet.units+" unit"+(f.sheet.units===1?"":"s")+" · "+(f.sheet.types||[]).join(", ")]);}
  if(a0&&a0.h>12)rows.push(["Height (model)",Math.round(a0.h)+" m"]);
  // from the model's own report: storeys, and the envelope (footprint x storeys - an upper bound, withheld where the
  // footprint we hold is a podium or the whole plot). Homes are the register's where we have them, indicative otherwise.
  const bf=a0&&BF?BF[String(a0.i)]:null;
  if(bf){
    if(bf.storeys>1&&!(f&&f.storeys))rows.splice(2,0,["Storeys (model)",String(bf.storeys)]);
    if(bf.plate_suspect)rows.splice(3,0,["Footprint","podium or plot"]);
    else if(bf.envelope_sqft)rows.splice(3,0,["Envelope (model)",fmA(bf.envelope_sqft)+" sq ft"]);
    if(bf.units_registered)rows.splice(4,0,["Homes (registered)",String(bf.units_registered)]);
    else if(bf.units_indicative)rows.splice(4,0,["Homes (indicative)","~"+bf.units_indicative]);}
  rows.splice(12);                                                     // the panel must never scroll: twelve tiles is the ceiling
  const acts='<div class=pa>'+(f&&f.cards?'<a class=act href="/cards?b='+encodeURIComponent(f.cards)+'&key='+encodeURIComponent(KEY)+'">unit cards →</a>':'')+
    (SELDEV?'<a class=act href="/dev?d='+SELDEV+'&key='+encodeURIComponent(KEY)+'">'+DEVNAME[SELDEV]+' page</a>':'')+(f&&f.url?'<a class=act href="'+esc(f.url)+'" target=_blank rel=noopener>developer site</a>':'')+'</div>';
  // icon tiles instead of a list (Kendall): small squares, gold line icons drawn inline, value first, label under
  const ICO={"Where":"M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10zm0-8a2 2 0 1 0 0-4 2 2 0 0 0 0 4z","Handover":"M4 6h16v14H4zM8 3v4M16 3v4M4 10h16","Structure":"M4 20h16M6 20V9l6-4 6 4v11M9 20v-5h6v5",
    "Units":"M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z","Mix":"M3 18V9h18v9M3 13h18M7 9V6h4v3","Payment plan":"M3 8h18v10H3zM7 8V5h10v3M12 13h.01",
    "Registered sales 2026":"M4 18l5-6 4 3 7-8M4 20h16","Median price":"M4 6h9l7 6-7 6H4zM8 12h.01","Typical range":"M4 12h16M7 8v8M17 8v8",
    "Median AED / m²":"M3 17l14-14 4 4L7 21H3zM13 7l2 2M10 10l2 2M7 13l2 2","Off-plan share":"M4 21h16M6 21V8h4v13M10 8l10-4v17M14 12h2M14 16h2",
    "Sold by type":"M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16M9 21v-6h6v6M9 9h.01M15 9h.01","Nearest metro":"M6 3h12v12H6zM6 15l-2 4M18 15l2 4M9 11h6M9 7h6",
    "Nearest mall":"M6 8h12l1 12H5zM9 8a3 3 0 0 1 6 0","Landmark":"M5 21V4M5 4h12l-2 4 2 4H5","On the developer sheet":"M6 3h12v18H6zM9 8h6M9 12h6M9 16h4",
    "Last registration":"M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2","Height (model)":"M12 20V6M8 10l4-4 4 4",
    "Envelope (model)":"M4 4h16v16H4zM4 10h16M10 4v16","Footprint":"M4 20h16M7 20V12h10v8M7 12l5-4 5 4","Storeys (model)":"M4 20h16M6 20V4h12v16M6 9h12M6 14h12",
    "Homes (registered)":"M4 21V10l8-6 8 6v11M9 21v-6h6v6M15 6l3-2","Homes (indicative)":"M4 21V10l8-6 8 6v11M9 21v-6h6v6"};
  const tile=(r)=>'<div class=tl><svg viewBox="0 0 24 24" fill="none" stroke="#C5A56A" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="'+(ICO[r[0]]||"M12 12h.01")+'"/></svg><b>'+esc(r[1])+'</b><i>'+esc(r[0])+'</i></div>';
  pp.innerHTML='<span class=px id=ppx>✕</span><div class=pt>'+esc(name)+'</div><div class=ps>'+(SELDEV?DEVNAME[SELDEV]:'on the map · developer not on the list')+(f&&f.status?' · '+esc(f.status):'')+'</div>'+
    (rows.length?'<div class=tg>'+rows.map(tile).join("")+'</div>':'<div class=pr><span>facts</span><span>no register facts on file yet</span></div>')+acts+
    '<div class=pn>developer site · availability sheet · DLD Open Data 2026 · storeys from our massing; envelope is footprint × storeys, an upper bound; homes indicative unless marked registered; blockers within this district only</div>';
  pp.classList.add("on");document.getElementById("ppx").onclick=()=>{document.getElementById("projsel").value="";applyProj("")};
  if(a0)buildViews(a0,mine);}
// v77 - VIEWS (Kendall, 3 Sep): what each side of the building actually looks at. Four thumbnails rendered live from the tower's own
// facades at two thirds of its height, plus a line-of-sight check to the named landmarks with the blocker named. Tap a thumbnail to
// stand at that facade. Facade midpoints and bearings come from the anchors (build_anchors.py), landmarks from /img/landmarks.
let LMK=null,VRT=null,VCAM=null;
fetch("/img/landmarks").then(r=>r.ok?r.json():null).then(j=>{LMK=j&&j.items||null}).catch(()=>{});
// v80 - BUILDING FACTS from our own model's reports (build_buildingfacts.py): floor area, storeys and homes per building
let BF=null;fetch("/img/bldgfacts_${slugName}").then(r=>r.ok?r.json():null).then(j=>{BF=j&&j.buildings_by_id||null}).catch(()=>{});
const VSIDE=["N","E","S","W"];
function viewEye(a,i){
  const p=a.fm&&a.fm[i];if(!p)return null;
  const eyeY=(GROUND?GROUND.position.y:0)+Math.max(6,a.h*0.66);
  const pos=new THREE.Vector3(p[0]+ROOTREF.position.x,eyeY,p[1]+ROOTREF.position.z);
  const c=new THREE.Vector3(a.x+ROOTREF.position.x,eyeY,a.z+ROOTREF.position.z);
  const dir=pos.clone().sub(c).setY(0).normalize();
  return {pos,dir};}
function losFor(a,i,own){
  if(!LMK)return[];
  const e=viewEye(a,i);if(!e)return[];
  const ray=new THREE.Raycaster();const out=[];
  const vis=MESHES.filter((m,k)=>!own.has(k));
  for(const L of LMK){
    const t=new THREE.Vector3(L.x+ROOTREF.position.x,(GROUND?GROUND.position.y:0)+Math.max(2,L.h*0.5),L.z+ROOTREF.position.z);
    const d=t.clone().sub(e.pos);const dist=d.length();d.normalize();
    if(d.dot(e.dir)<0.24)continue;                                        // not in this facade's field of view
    ray.set(e.pos,d);ray.far=Math.min(dist,4000);
    const hit=ray.intersectObjects(vis,false)[0];
    let blocker=null;
    if(hit){const idx=MESHES.indexOf(hit.object);const ba=ANCH.anchors.find(x=>x.meshes&&x.meshes.indexOf(idx)>=0);blocker=(ba&&ba.name)||"a neighbouring building"}
    out.push({name:L.name,km:Math.round(dist/100)/10,blocked:!!hit,blocker});}
  out.sort((x,y)=>(x.blocked-y.blocked)||(x.km-y.km));return out.slice(0,4);}
function buildViews(a,own){
  const pp=document.getElementById("ppanel");if(!pp||!a.fm||!MESHES||!ROOTREF)return;
  // v78.1 (Kendall): no model thumbnails - a grey massing picture is no use to a buyer. Four sides, what each looks at from our
  // line-of-sight check, and each card opens the REAL view: live photoreal imagery from that facade at that height.
  const wrap=document.createElement("div");wrap.className="vw";wrap.innerHTML='<div class=vh>The view from each side · tap to stand there</div><div class=vg></div>';
  pp.insertBefore(wrap,pp.querySelector(".tg")||pp.querySelector(".pa"));
  const grid=wrap.querySelector(".vg");
  VSIDE.forEach((side,i)=>{
    const e=viewEye(a,i);const ll=a.fm_ll&&a.fm_ll[i];if(!e||!ll)return;
    const los=losFor(a,i,own);const clear=los.filter(l=>!l.blocked).map(l=>l.name);const blocked=!clear.length&&los.length;
    const head=Math.round((Math.atan2(e.dir.x,-e.dir.z)*180/Math.PI+360)%360);
    const url="/view?lon="+ll[0]+"&lat="+ll[1]+"&h="+Math.round(Math.max(6,a.h*0.66))+"&head="+head+
      "&name="+encodeURIComponent(a.name)+"&side="+side+"&sees="+encodeURIComponent(clear.slice(0,3).join(" · "))+"&key="+encodeURIComponent(KEY);
    const cell=document.createElement("a");cell.className="vc"+(blocked?" blk":"");cell.href=url;
    cell.innerHTML='<b>'+side+'</b><i>'+(clear.length?esc2v(clear.slice(0,2).join(" · ")):(blocked?"blocked by "+esc2v(los[0].blocker):"open outlook"))+'</i><em>real view →</em>';
    grid.appendChild(cell);});}
function esc2v(s){return String(s==null?"":s).replace(/[&<>]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[ch]))}
function applyDev(d){
  SELDEV=d;SELPROJ="";const _pp=document.getElementById("ppanel");if(_pp)_pp.classList.remove("on");fillProjSel(d);
  for(const m of MESHES)ghost(m,!!d&&m.userData.dev!==d);
  LIVE.forEach((L)=>{L.el.remove();L.ln.remove();L.dot.remove()});LIVE.clear();
  if(!d){if(HOME){cam.position.copy(HOME.pos);ctl.target.copy(HOME.tgt);ctl.autoRotate=HOME.rot;ctl.autoRotateSpeed=HOME.spd;HOME=null}return}
  if(!HOME)HOME={pos:cam.position.clone(),tgt:ctl.target.clone(),rot:ctl.autoRotate,spd:ctl.autoRotateSpeed};
  const bb=new THREE.Box3();let n=0;for(const m of MESHES){if(m.userData.dev===d){bb.expandByObject(m);n++}}
  if(!n)return;const c2=bb.getCenter(new THREE.Vector3()),s2=bb.getSize(new THREE.Vector3());const r2=Math.max(s2.x,s2.z,s2.y*1.2,160);
  ctl.target.set(c2.x,c2.y*0.4,c2.z);cam.position.set(c2.x+r2*2.2,c2.y+r2*1.1,c2.z+r2*2.2);ctl.autoRotate=true;ctl.autoRotateSpeed=0.9;}
const _v=new THREE.Vector3(),_c=new THREE.Vector3(),_t=new THREE.Vector3();
function updateLabels(){
  if(!ANCH||!ROOTREF)return;
  const W=innerWidth,H=innerHeight;cam.getWorldDirection(_c);_t.copy(ctl.target);
  const fEl=document.getElementById("feat"),tEl=document.getElementById("filters");
  const TOP=Math.max(112,((fEl&&fEl.childElementCount?fEl:tEl)||tEl).getBoundingClientRect().bottom+14);   // labels stay clear of the masthead + chips
  const cand=[];
  for(const a of ANCH.anchors){
    if(a.x==null)continue;
    if(SELDEV&&a.dev!==SELDEV)continue;                            // developer filter: only that developer's buildings get labels
    if(SELPROJ&&(a.dev_project||a.name)!==SELPROJ)continue;        // project drill: only that project
    if(!a.dev&&(a.h<10||a.name.length<4||/^(shower|toilets?|wc|mosque|masjid|substation|parking|car park|guardhouse|gate|entrance|kiosk|atm)$/i.test(a.name)))continue;   // street furniture is not a landmark
    _v.set(a.x,a.h,a.z).add(ROOTREF.position);                   // GLB metres -> world (root is re-centred by the viewer)
    const toB=_v.clone().sub(cam.position);const depth=toB.dot(_c);if(depth<=0)continue;
    const front=SELDEV?true:_v.clone().sub(_t).dot(cam.position.clone().sub(_t))>0;   // on the camera's side of the orbit centre = passing in front (filtered: all of them)
    if(!front)continue;
    const p=_v.clone().project(cam);const sx=(p.x+1)/2*W,sy=(1-p.y)/2*H;
    if(sx<40||sx>W-40||sy<(SELDEV?70:TOP)||sy>H-120)continue;                 // filtered view: roofs may sit higher on screen
    cand.push({a,sx,sy,depth,score:(a.dev?1e6:0)+a.h*10-depth*0.02});}
  cand.sort((x,y)=>y.score-x.score);
  const pick=[],MINDX=Math.max(40,Math.min(64,W/8)),TS=Math.max(.55,Math.min(1,H/820));   // spacing and leader tiers scale with the screen
  const lw=(a)=>Math.min(W*0.6,a.name.length*7.2+16);                                  // estimated label width in px
  for(const c of cand){if(pick.length>=10)break;
    if(pick.some(q=>Math.abs(q.sx-c.sx)<Math.max(MINDX,(lw(q.a)+lw(c.a))/2+10)&&Math.abs(q.sy-c.sy)<140))continue;pick.push(c)}
  const now=performance.now();const keep=new Set();
  pick.forEach((c,i)=>{const k=String(c.a.i);keep.add(k);let L=LIVE.get(k);
    if(!L){const el=document.createElement("a");el.className="lb"+(c.a.dev?" dev":"");el.href="javascript:void 0";const _a=c.a;el.onclick=(ev)=>{ev.preventDefault();openAnchor(_a)};   // tap a name -> open it
      el.innerHTML=c.a.name.replace(/[&<>]/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[ch]))+(c.a.dev?"<i>"+DEVNAME[c.a.dev]+(c.a.h>20?" · "+Math.round(c.a.h)+" m":"")+"</i>":(c.a.h>40?"<i>"+Math.round(c.a.h)+" m</i>":""));
      const ln=document.createElementNS("http://www.w3.org/2000/svg","polyline");ln.setAttribute("fill","none");ln.setAttribute("stroke-width","1");
      const dot=document.createElementNS("http://www.w3.org/2000/svg","circle");dot.setAttribute("r","2.4");
      svgL.appendChild(ln);svgL.appendChild(dot);lblWrap.appendChild(el);
      L={el,ln,dot,tier:TIERS[LIVE.size%TIERS.length],born:now};LIVE.set(k,L);requestAnimationFrame(()=>el.classList.add("on"))}
    L.seen=now;const col=c.a.dev?"#"+DEVCOL[c.a.dev].toString(16).padStart(6,"0"):"rgba(197,165,106,.75)";
    const ty=Math.max(TOP,c.sy-L.tier*TS),e2=L.el;e2.style.left=c.sx+"px";e2.style.top=(ty-4)+"px";e2.style.color=c.a.dev?col:"";   // never under the masthead
    L.ln.setAttribute("points",c.sx+","+c.sy+" "+c.sx+","+(ty+2));L.ln.setAttribute("stroke",col);L.dot.setAttribute("cx",c.sx);L.dot.setAttribute("cy",c.sy);L.dot.setAttribute("fill",col);});
  LIVE.forEach((L,k)=>{if(!keep.has(k)){if(!L.dying){L.dying=now;L.el.classList.remove("on");L.ln.setAttribute("stroke","transparent");L.dot.setAttribute("fill","transparent")}
    else if(now-L.dying>500){L.el.remove();L.ln.remove();L.dot.remove();LIVE.delete(k)}}});
  const devs=[...new Set(pick.map(c=>c.a.dev).filter(Boolean))];
  legend.innerHTML=devs.map(d=>'<span class=lg><b style="background:#'+DEVCOL[d].toString(16).padStart(6,"0")+'"></b>'+DEVNAME[d]+'</span>').join("");
  legend.classList.toggle("on",devs.length>0);}
const ray=new THREE.Raycaster(),ptr=new THREE.Vector2();let pd=null;
addEventListener("pointerdown",e=>{pd=[e.clientX,e.clientY]});
addEventListener("pointerup",e=>{
  if(!pd||Math.hypot(e.clientX-pd[0],e.clientY-pd[1])>6){pd=null;return}
  pd=null;
  ptr.x=(e.clientX/innerWidth)*2-1;ptr.y=-(e.clientY/innerHeight)*2+1;
  ray.setFromCamera(ptr,cam);
  if(ANCH&&MESHES&&!(e.target&&e.target.closest&&e.target.closest("#ppanel,#devwrap,.lb,.nnav,.rail,.tog,.feat"))){   // v74.8 tap a tower -> open it
    const vis=MESHES.filter(m=>m.visible);vis.forEach(m=>m.updateWorldMatrix(true,false));
    const h=ray.intersectObjects(vis,false)[0];
    if(h){const idx=MESHES.indexOf(h.object);const a=ANCH.anchors.find(x=>x.meshes&&x.meshes.indexOf(idx)>=0);if(a){openAnchor(a);return}}}
  if(!META)return;
  const featured=[...GROUPS.construction.meshes,...GROUPS.pipeline.meshes].filter(m=>m.visible);
  featured.forEach(m=>m.updateWorldMatrix(true,false));
  const hit=ray.intersectObjects(featured,false)[0];
  const card=document.getElementById("card");
  if(!hit){card.classList.remove("on");return}
  const grp=hit.object.userData.grp;
  let bk=null;for(const k in (META.buildings||{})){if(META.buildings[k].status_key===grp){bk=k;break}}
  if(!bk)return;
  focusBuilding(bk,[...document.querySelectorAll(".fg")].find(x=>x.textContent.indexOf((META.buildings[bk].title||bk).split("(")[0].trim())>=0));
});
document.getElementById("cx").onclick=()=>{if(FOCUS)unfocus();else document.getElementById("card").classList.remove("on")};
addEventListener("resize",()=>{cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();ren.setSize(innerWidth,innerHeight);if(finalC){finalC.setSize(innerWidth,innerHeight);bloomC.setSize(innerWidth,innerHeight)}});
(function loop(){requestAnimationFrame(loop);ctl.update();renderFrame();try{updateLabels()}catch(e){}})();
</script></body></html>`;
}

// v50 — AREA DEEP DIVE (/area/<name>): everything the register holds for one community.
// v81 - DISTRICT STOCK REPORT (/report/<slug>). The massing writes a report for every building it builds - footprint,
// height, storeys - and build_buildingfacts.py joins that to the names, the developers and the register. This page reads it
// the way a broker would: how much stands here, how tall, whose it is, and what it sells for.
// The one thing this page must never do is dress an envelope up as a floor area. The model extrudes each footprint straight
// up, so the area it reports is footprint x storeys: an upper bound. Where the footprint we hold is a podium or a plot
// outline rather than the tower plate, that bound is far above the truth, and those buildings are flagged and shown as such.
function renderStock(slug, areaName, key, bfRaw, ancRaw, pfRaw, mktRaw) {
  const esc2 = (x) => String(x == null ? "" : x).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const num2 = (v) => (v == null ? "\u2014" : Number(v).toLocaleString("en-US"));
  let BF = null, MK = null, PF = null;
  try { BF = JSON.parse(bfRaw || "null"); } catch (e) {}
  try { MK = JSON.parse(mktRaw || "null"); } catch (e) {}
  try { PF = JSON.parse(pfRaw || "null"); } catch (e) {}
  // the anchors carry a developer key; the register carries the name the developer actually trades under
  const DNAME = {};
  try { const _p = (PF && PF.projects) || {}; for (const k in _p) if (_p[k].dev && _p[k].developer) DNAME[_p[k].dev] = _p[k].developer; } catch (e) {}
  const devName = (k) => DNAME[k] || String(k || "").replace(/_/g, " / ").replace(/\w/g, c => c.toUpperCase());
  const K = encodeURIComponent(key || "");
  if (!BF || !BF.buildings_by_id) return '<!doctype html><meta charset=utf-8><body style="font-family:system-ui;background:#0C1413;color:#E8E4D8;padding:2rem"><h2 style="color:#C5A56A">Najma</h2><p>No report for "' + esc2(areaName) + '" yet. The report is written when the district is massed \u2014 mass it first and this page fills itself.</p><a style="color:#C5A56A" href="/skyline?key=' + K + '">\u2190 back to the twin</a>';
  const B = Object.keys(BF.buildings_by_id).map(k => BF.buildings_by_id[k]);
  const sqft = (m2) => Math.round((m2 || 0) * 10.7639);
  const mm = (n) => (n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : Math.round(n / 1000) + "k");
  const byDev = {};
  B.forEach(b => {
    if (!b.dev) return;
    const d = byDev[b.dev] || (byDev[b.dev] = { dev: b.dev, n: 0, env: 0, reg: 0, tall: 0, projects: {} });
    d.n++; d.env += b.envelope_m2 || 0; d.reg += b.units_registered || 0;
    d.tall = Math.max(d.tall, b.height_m || 0); if (b.project) d.projects[b.project] = 1;
  });
  const devs = Object.keys(byDev).map(k => byDev[k]).sort((a, b) => b.env - a.env);
  const devMax = Math.max.apply(null, devs.map(d => d.env).concat([1]));
  const BANDS = [["Supertall \u2014 300 m and over", 300, 1e9], ["Tall \u2014 150 to 300 m", 150, 300], ["High-rise \u2014 75 to 150 m", 75, 150], ["Mid-rise \u2014 25 to 75 m", 25, 75], ["Low-rise \u2014 under 25 m", 0, 25]];
  const bands = BANDS.map(bd => ({ label: bd[0], n: B.filter(b => (b.height_m || 0) >= bd[1] && (b.height_m || 0) < bd[2]).length })).filter(x => x.n);
  const bMax = Math.max.apply(null, bands.map(x => x.n).concat([1]));
  const named = B.filter(b => b.name);
  const tallest = named.slice().sort((a, b) => (b.height_m || 0) - (a.height_m || 0)).slice(0, 14);
  const biggest = named.filter(b => !b.plate_suspect).slice().sort((a, b) => (b.envelope_m2 || 0) - (a.envelope_m2 || 0)).slice(0, 10);
  const tallN = B.filter(b => (b.height_m || 0) >= 150).length;
  let A = null;
  try { A = ((MK && MK.areaIntel && MK.areaIntel.areas) || []).find(x => String(x.area).toLowerCase().replace(/[^a-z0-9]/g, "") === slug) || null; } catch (e) {}
  // The headline carries only what we can stand behind: a count, a height, and homes the register actually names.
  let body = '<div class=grid>' +
    '<div class=st><div class=v>' + num2(B.length) + '</div><div class=l>buildings modelled</div></div>' +
    '<div class=st><div class=v>' + (tallest[0] ? Math.round(tallest[0].height_m) + '<small> m</small>' : '\u2014') + '</div><div class=l>tallest on file</div></div>' +
    '<div class=st><div class=v>' + num2(tallN) + '</div><div class=l>towers over 150 m</div></div>' +
    '<div class=st><div class=v>' + (BF.units_registered_total ? num2(BF.units_registered_total) : '\u2014') + '</div><div class=l>homes named by the register</div></div></div>';
  body += '<div class=card>' + najH2("buildings", "The shape of the skyline") +
    bands.map(x => '<div class=arow><div class=nm>' + esc2(x.label) + '</div><div class=tr><i style="width:' + Math.round(x.n / bMax * 100) + '%"></i></div><div class=ct>' + num2(x.n) + '</div></div>').join('') +
    '<div class=note>Every building in the district, sorted by the height the model holds for it. Heights come from the survey and the open registers, not from marketing copy.</div></div>';
  if (devs.length) body += '<div class=card>' + najH2("crane", "Who holds the bulk") +
    devs.map(d => {
      const np = Object.keys(d.projects).length;
      return '<div class=arow><div class=nm><a href="/dev?d=' + encodeURIComponent(d.dev) + '&key=' + K + '">' + esc2(devName(d.dev)) + '</a><span class=sm>' + d.n + ' building' + (d.n > 1 ? 's' : '') + (np ? ' \u00b7 ' + np + ' scheme' + (np > 1 ? 's' : '') : '') + (d.reg ? ' \u00b7 ' + num2(d.reg) + ' homes' : '') + '</span></div><div class=tr><i style="width:' + Math.round(d.env / devMax * 100) + '%"></i></div><div class=ct>' + mm(sqft(d.env)) + '</div></div>';
    }).join('') +
    '<div class=note>Bars compare built volume between developers, not a floor-area schedule \u2014 the figure is the modelled envelope (see below). A developer appears here only where we hold a confirmed binding between the building and the scheme; the rest of the district sits with owners outside the eleven.</div></div>';
  const trow = (b) => '<div class=prow><div style="display:flex;justify-content:space-between;gap:8px"><b>' + esc2(b.name) + '</b><span class=sv>' + (b.height_m ? Math.round(b.height_m) + ' m' : '\u2014') + '</span></div>' +
    '<div class=pm><span>' + (b.dev ? esc2(devName(b.dev)) + (b.project ? ' \u00b7 ' + esc2(b.project) : '') : 'owner not on the list') + '</span><span>' + (b.storeys > 1 ? b.storeys + ' storeys' : '') +
    (b.units_registered ? ' \u00b7 ' + num2(b.units_registered) + ' homes' : '') +
    (b.plate_suspect ? ' \u00b7 <span class=fl>podium footprint</span>' : ' \u00b7 ' + mm(sqft(b.envelope_m2)) + ' sqft envelope') + '</span></div></div>';
  body += '<div class=card>' + najH2("star", "Tallest on file") + tallest.map(trow).join('') +
    '<div class=note>Tap any of these in the twin to walk its facades and see what each side actually looks at. <span class=fl>podium footprint</span> means the outline we hold covers the whole plot, so no area is quoted for that building.</div></div>';
  if (biggest.length) body += '<div class=card>' + najH2("house", "Largest envelopes on a clean footprint") + biggest.map(trow).join('') +
    '<div class=note>Only buildings whose footprint reads as the building itself, so these envelopes are the closest this model gets to a floor area.</div></div>';
  if (A) body += '<div class=card>' + najH2("coins", "What it sells for") +
    '<div class=srow><span>Settled sales this period</span><span class=sv>' + num2(A.sales) + '</span></div>' +
    '<div class=srow><span>Median</span><span class=sv>' + num2(A.medianAedSqft) + ' AED/sqft</span></div>' +
    '<div class=srow><span>Median ticket</span><span class=sv>' + (A.medianTicketAed ? 'AED ' + (A.medianTicketAed / 1e6).toFixed(2) + 'm' : '\u2014') + '</span></div>' +
    '<div class=srow><span>Off-plan share</span><span class=sv>' + (A.offPlanPct == null ? '\u2014' : A.offPlanPct + '%') + '</span></div>' +
    (A.grossYieldPct != null ? '<div class=srow><span>Gross yield</span><span class=sv>' + A.grossYieldPct + '%</span></div>' : '') +
    '<div class=note>Settled registrations, not asking prices. <a href="/area/' + encodeURIComponent(A.area) + '?key=' + K + '">Full briefing for this community \u2192</a></div></div>';
  body += '<div class=card>' + najH2("file", "What this report can and cannot tell you") +
    '<div class=srow><span>Buildings carrying a name</span><span class=sv>' + num2(named.length) + ' of ' + num2(B.length) + '</span></div>' +
    '<div class=srow><span>Bound to a developer</span><span class=sv>' + num2(B.filter(b => b.dev).length) + '</span></div>' +
    '<div class=srow><span>Home counts from the register</span><span class=sv>' + num2(B.filter(b => b.units_registered).length) + ' buildings</span></div>' +
    '<div class=srow><span>Footprints reading as podium or plot</span><span class=sv>' + num2(BF.plate_suspect || 0) + '</span></div>' +
    '<div class=note><b>Heights, storeys and building counts are solid</b> \u2014 they come from the survey and the open registers. ' +
    '<b>Areas are an envelope, not a floor area.</b> The model extrudes each footprint straight up, so the area is footprint \u00d7 storeys: an upper bound. ' +
    'It is close for a plain tower or slab whose outline is the building itself, and far too high wherever the outline we hold covers a podium or the whole plot \u2014 ' + num2(BF.plate_suspect || 0) + ' building' + ((BF.plate_suspect || 0) === 1 ? '' : 's') + ' here read that way and carry no area at all. ' +
    'Home counts are the register\u2019s or the developer\u2019s own wherever we hold one; anywhere else the twin shows an indicative figure at ' + Math.round((BF.efficiency || 0.78) * 100) + '% efficiency on a ' + Math.round(BF.unit_m2 || 105) + ' m\u00b2 apartment, which is a planning figure for scale and never a schedule of units.</div></div>';
  return '<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name=robots content=noindex><title>' + esc2(areaName) + ' \u2014 stock report</title><link rel=icon href=/naj_icon.svg><meta name=theme-color content="#0C1413">' + NAJ_FONTS + '<style>' +
    ':root{--ink:#0C1413;--card:#111C1A;--card2:#0E1817;--line:#24352F;--gold:#C5A56A;--teal:#3E8A7E;--cream:#E8E4D8;--mut:#8FA39B}' +
    '*{box-sizing:border-box}body{margin:0;background:var(--ink);color:var(--cream);font-family:"IBM Plex Sans",system-ui,sans-serif;padding:0 12px 92px}' +
    '.hd{padding:18px 0 10px}.bk{font-family:"IBM Plex Mono",monospace;font-size:.62rem;letter-spacing:.05em;color:var(--gold);text-decoration:none}' +
    '.mast{font-family:Fraunces,serif;font-size:1.9rem;line-height:1.05;margin:.5rem 0 .2rem}.sub{color:var(--mut);font-size:.72rem;font-family:"IBM Plex Mono",monospace;letter-spacing:.04em}' +
    '.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0}.st{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:11px}' +
    '.st .v{font-family:Fraunces,serif;font-size:1.5rem;color:var(--gold);line-height:1}.st .v small{font-size:.72rem;color:var(--mut)}.st .l{color:var(--mut);font-size:.66rem;margin-top:4px}' +
    '.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:13px;margin-bottom:10px}' +
    'h2{display:flex;align-items:center;gap:7px;font-size:.68rem;letter-spacing:.14em;color:var(--gold);text-transform:uppercase;margin:0 0 .6rem;font-weight:600}.ih{display:inline-flex;flex:none}.ih svg{width:15px;height:15px;color:var(--gold)}' +
    '.srow{display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-bottom:1px solid #182823;font-size:.8rem}.srow:last-child{border-bottom:none}.srow .sv{color:var(--mut);white-space:nowrap;font-variant-numeric:tabular-nums}' +
    '.arow{display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #182823}.arow:last-of-type{border-bottom:none}.nm{flex:0 0 46%;font-size:.78rem}.nm a{color:var(--cream);text-decoration:none;border-bottom:1px solid rgba(197,165,106,.35)}.sm{display:block;color:var(--mut);font-size:.64rem;margin-top:2px}' +
    '.tr{flex:1;height:6px;border-radius:3px;background:var(--card2);overflow:hidden}.tr i{display:block;height:100%;background:var(--teal)}.ct{font-size:.72rem;color:var(--mut);min-width:56px;text-align:right;font-variant-numeric:tabular-nums}' +
    '.prow{padding:7px 0;border-bottom:1px solid #182823;font-size:.82rem}.prow:last-child{border-bottom:none}.prow .pm{display:flex;justify-content:space-between;gap:8px;color:var(--mut);font-size:.7rem;margin-top:3px}.prow .sv{color:var(--gold);font-variant-numeric:tabular-nums}' +
    '.fl{color:#D9A441}.note b{color:var(--cream);font-weight:600}' +
    '.note{color:var(--mut);font-size:.72rem;margin-top:.6rem;line-height:1.55}.note a{color:var(--gold)}' +
    '.pv{color:var(--mut);font-size:.7rem;line-height:1.6;margin-top:1rem}' +
    NAJ_NAV_CSS + '</style></head><body>' +
    '<div class=hd><a class=bk href="/skyline/' + esc2(slug) + '?key=' + K + '">\u2190 back to the twin</a>' +
    '<div class=mast>' + esc2(areaName) + '</div><div class=sub>stock report \u00b7 built from the model</div></div>' + body +
    '<div class=pv>Heights, storeys and footprints come from our own massing of this district, built on open survey footprints. Names and ownership come from the open registers and the developers\u2019 own published schemes. Sales figures are Dubai Land Department (DLD) Open Data \u2014 settled registrations, not asking prices. Contains information from the Government of Dubai.</div>' +
    najNav(key, "twin") + '</body></html>';
}

function renderArea(latestRaw, name, key) {
  let d = null; try { d = JSON.parse(latestRaw || "null"); } catch (e) {}
  const esc2 = (s) => String(s == null ? "" : s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const ai = (d && d.areaIntel && d.areaIntel.areas) || [];
  const a = ai.find(x => x.area.toLowerCase() === String(name || "").toLowerCase());
  if (!a) return '<!doctype html><meta charset=utf-8><body style="font-family:system-ui;background:#0C1413;color:#E8E4D8;padding:2rem"><h2 style="color:#C5A56A">Najma</h2><p>No register depth for "' + esc2(name) + '" this period (areas under 20 settled sales are omitted — that is the honesty gate, not an error).</p>';
  const sup = ((d.projects && d.projects.supplyByArea) || {})[a.area] || null;
  const projs = ((d.projects && d.projects.projectLookup) || []).filter(p => (p.area || "").toLowerCase() === a.area.toLowerCase()).sort((x, y) => (y.units || 0) - (x.units || 0)).slice(0, 10);
  const period = d.transactions ? (String(d.transactions.periodFrom || "") + " → " + String(d.transactions.periodTo || "")) : "";
  const num2 = (v) => (v == null ? "—" : Number(v).toLocaleString("en-US"));
  const rooms = najRooms(a.byRoom);
  const rmax = Math.max(...rooms.map(r => r[1].medianAed || 0), 1);
  let body = '<div class=grid>' +
    '<div class=st><div class=v>' + num2(a.sales) + '</div><div class=l>settled sales</div></div>' +
    '<div class=st><div class=v>' + num2(a.medianAedSqft) + '<small>/sqft</small></div><div class=l>median (AED)</div></div>' +
    '<div class=st><div class=v>' + (a.medianTicketAed ? (a.medianTicketAed / 1e6).toFixed(2) + 'm' : '—') + '</div><div class=l>median ticket (AED)</div></div>' +
    '<div class=st><div class=v>' + (a.offPlanPct == null ? '—' : a.offPlanPct + '<small>%</small>') + '</div><div class=l>off-plan share</div></div></div>';
  body += '<div class=card>' + najH2("coins", "The yield walk — what the buyer keeps") +
    '<div class=srow><span>Gross yield</span><span class=sv>' + (a.grossYieldPct == null ? '—' : a.grossYieldPct + '%') + '</span></div>' +
    '<div class=srow><span>Service charge' + (a.serviceChargeIsEstimate ? ' <span style="color:#D9A441;font-size:.68rem">~community estimate</span>' : '') + '</span><span class=sv>' + (a.serviceChargeAedSqftYr == null ? '—' : a.serviceChargeAedSqftYr + ' AED/sqft/yr') + '</span></div>' +
    '<div class=srow><span><b>Net yield</b></span><span class=sv style="color:#C5A56A;font-weight:600">' + (a.netYieldPct == null ? '—' : a.netYieldPct + '%') + '</span></div>' +
    '<div class=note>Net = gross minus service charge. Building-specific Mollak figures override community ranges when available.</div></div>';
  if (a.pop || a.households) body += '<div class=card>' + najH2("house", "Who lives here") +
    (a.pop ? '<div class=srow><span>Population</span><span class=sv>' + num2(a.pop) + '</span></div>' : '') +
    (a.households ? '<div class=srow><span>Households</span><span class=sv>' + num2(a.households) + '</span></div>' : '') +
    (a.densityKm2 ? '<div class=srow><span>Density</span><span class=sv>' + num2(a.densityKm2) + '/km²</span></div>' : '') +
    '<div class=note>Dubai Statistics Center, by community.</div></div>';
  if (rooms.length) body += '<div class=card>' + najH2("bed", "What each layout settles at") + rooms.map(([rb, r]) =>
    '<div class=arow><span class=nm>' + esc2(rb) + ' <span style="color:#8FA39B;font-size:.68rem">' + num2(r.sales) + ' sales</span></span><span class=tr><i style="width:' + Math.round(100 * (r.medianAed || 0) / rmax) + '%"></i></span><span class=ct>' + (r.medianAed ? (r.medianAed / 1e6).toFixed(2) + 'm' : '—') + (r.p25Aed && r.p75Aed ? '<br><span style="color:#8FA39B;font-size:.62rem">' + (r.p25Aed / 1e6).toFixed(2) + '–' + (r.p75Aed / 1e6).toFixed(2) + '</span>' : '') + '</span></div>').join('') +
    '<div class=note>Median settled price per layout; the small range is the p25–p75 spread — the middle half of what actually transacted.</div></div>';
  if (sup) body += '<div class=card>' + najH2("crane", "Incoming supply in " + esc2(a.area)) +
    '<div class=srow><span>Units in registered pipeline</span><span class=sv>' + num2(sup.units) + '</span></div>' +
    '<div class=srow><span>Projects</span><span class=sv>' + num2(sup.projects) + '</span></div>' +
    (sup.nextEnd ? '<div class=srow><span>Next completion on file</span><span class=sv>' + esc2(String(sup.nextEnd).slice(0, 10)) + '</span></div>' : '') + '</div>';
  if (projs.length) body += '<div class=card>' + najH2("file", "Projects on the register here") + projs.map(p =>
    '<div class=prow><div class=pt>' + esc2(p.project) + (p.escrowRegistered ? ' <span style="color:#56B584;font-size:.7rem">escrow ✓</span>' : '') + '</div><div class=pm><span>' + esc2(p.developer || '') + '</span><span>' + (p.percentComplete != null ? p.percentComplete + '% built' : (p.status ? esc2(p.status) : '')) + (p.units ? ' · ' + num2(p.units) + ' units' : '') + '</span></div></div>').join('') + '</div>';
  return '<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><title>' + esc2(a.area) + ' — Najma</title><link rel=icon href=/naj_icon.svg><meta name=theme-color content="#0C1413">' + NAJ_FONTS + '<style>' +
    ':root{--ink:#0C1413;--card:#131F1D;--card2:#182823;--line:#24352F;--text:#E8E4D8;--mut:#8FA39B;--gold:#C5A56A;--teal:#3E8A7E}' +
    'body{font-family:"IBM Plex Sans",system-ui,sans-serif;background:var(--ink);color:var(--text);margin:auto;padding:0 12px 88px;max-width:460px}' +
    '.ahead{position:relative;margin:0 -12px 12px;padding:16px 16px 14px;min-height:186px;display:flex;flex-direction:column;justify-content:flex-end;background-size:cover;background-position:center}' +
    '.satc{position:absolute;top:8px;right:12px;font-family:"IBM Plex Mono",monospace;font-size:.55rem;letter-spacing:.04em;color:rgba(232,228,216,.72);background:rgba(12,20,19,.55);border-radius:99px;padding:3px 8px}' +
    'a.bk{color:var(--gold);text-decoration:none;font-size:.78rem;font-family:"IBM Plex Mono",monospace;margin-bottom:auto}' + NAJ_NAV_CSS +
    '.mast{font-family:Fraunces,Georgia,serif;font-size:1.7rem;font-weight:600;margin-top:4px;text-shadow:0 2px 14px rgba(12,20,19,.75)}' +
    '.sub{color:#B8C4BD;font-size:.75rem;margin:.2rem 0 0;font-family:"IBM Plex Mono",monospace;text-shadow:0 1px 8px rgba(12,20,19,.8)}' +
    '.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}' +
    '.st{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:10px}.st .v{font-family:Fraunces,Georgia,serif;font-size:1.35rem;font-weight:600;font-variant-numeric:tabular-nums}.st .v small{font-size:.8rem;color:var(--mut);font-family:"IBM Plex Sans",sans-serif}.st .l{color:var(--mut);font-size:.72rem;margin-top:2px}' +
    '.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:13px;margin-bottom:10px}' +
    'h2{display:flex;align-items:center;gap:7px;font-size:.68rem;letter-spacing:.14em;color:var(--gold);text-transform:uppercase;margin:0 0 .6rem;font-weight:600}.ih{display:inline-flex;flex:none}.ih svg{width:15px;height:15px;color:var(--gold)}' +
    '.srow{display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-bottom:1px solid #182823;font-size:.8rem}.srow:last-child{border-bottom:none}.srow .sv{color:var(--mut);white-space:nowrap;font-variant-numeric:tabular-nums}' +
    '.arow{display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid #182823}.arow:last-of-type{border-bottom:none}.nm{flex:0 0 46%;font-size:.8rem}.tr{flex:1;height:6px;border-radius:3px;background:var(--card2);overflow:hidden}.tr i{display:block;height:100%;background:var(--teal)}.ct{font-size:.72rem;color:var(--mut);min-width:44px;text-align:right;font-variant-numeric:tabular-nums}' +
    '.prow{padding:6px 0;border-bottom:1px solid #182823;font-size:.82rem}.prow:last-child{border-bottom:none}.prow .pm{display:flex;justify-content:space-between;gap:8px;color:var(--mut);font-size:.72rem;margin-top:2px}' +
    '.note{color:var(--mut);font-size:.72rem;margin-top:.5rem}.pv{font-size:.72rem;color:var(--mut)}' +
    '</style></head><body>' +
    '<div class=ahead style="background-image:linear-gradient(180deg,rgba(12,20,19,.15) 0%,rgba(12,20,19,.62) 55%,rgba(12,20,19,.94) 88%,#0C1413 100%),url(' + najSat(a.area) + ')">' +
    '<a class=bk href="/map?key=' + encodeURIComponent(key || '') + '">← back to the map</a>' +
    '<div class=mast>' + esc2(a.area) + '</div><div class=sub>' + esc2(period) + ' · settled, not asking</div>' +
    '<div class=satc>Esri World Imagery</div>' +
    '<a href="/skyline/' + najSlug(a.area) + '?key=' + encodeURIComponent(key || '') + '" style="position:absolute;top:8px;left:12px;font-family:\'IBM Plex Mono\',monospace;font-size:.6rem;letter-spacing:.04em;color:#C5A56A;background:rgba(12,20,19,.6);border:1px solid rgba(197,165,106,.4);border-radius:99px;padding:4px 10px;text-decoration:none">⬢ view in 3D</a></div>' +
    body +
    '<div class=pv style="margin-top:1rem;line-height:1.6">Source: Dubai Land Department (DLD) Open Data. Contains information from the Government of Dubai. Areas under 20 settled sales are omitted; layouts shown only at 8+ sales. Every source passes a fail-closed sanity gate.</div>' +
    najNav(key, "twin") + '</body></html>';
}

// The complete, self-contained image prompt — one copyable block, BOTH ratios inside.
// Direction B: a Forbes/Fortune-style aspirational editorial COVER — a real Dubai broker/buyer
// as the hero, the figure as a gold cover-line, magazine grid, current gpt-image-2 text
// discipline (quote strings, "render verbatim") and anti-AI-slop negatives so it looks like
// real editorial photography, not AI. (Research: Businessweek/Forbes/Economist cover language.)
function visualPromptBlock(angle) {
  const H = String(angle.hook || "").replace(/"/g, "'");
  const F = String(angle.figure || "").replace(/"/g, "'");
  const S = String(angle.source || "").replace(/"/g, "'");
  return "🎨 Cover-image prompt — paste the whole block into ChatGPT (make an image), then ask for the second size:\n\n```" +
    "A premium business-magazine COVER in the style of a Forbes / Fortune editorial portrait — aspirational, warm, credible, high-end. Make it 1080x1920 (vertical 9:16) first; I will then ask you to remake it 1920x1080 (16:9).\n\n" +
    "HERO: a real, confident Dubai real-estate professional — pick one and keep it authentic to Dubai: an elegant Emirati woman in her 30s in a modern tailored abaya · OR a sharply dressed South-Asian man in his 30s in a well-cut suit · OR a Levantine woman in a cream blazer. Three-quarter framing, warm direct eye contact, a natural genuine half-smile, standing on a sunlit Dubai balcony with the skyline softly out of focus behind. Candid documentary-style photograph taken on a real camera, 85mm portrait lens, shallow depth of field, golden-hour side light with soft rim light. Natural UNRETOUCHED skin with visible pore detail, subtle tonal variation, a few flyaway hairs, restrained highlights, real fabric texture, fine film grain. Place the subject on the RIGHT THIRD; leave clean deep-teal negative space on the LEFT for text.\n\n" +
    "LAYOUT (magazine grid): masthead \"NAJMA\" across the very top in cream uppercase with wide letter-spacing. Down the LEFT negative space, a stacked cover-line: the figure \"" + F + "\" set LARGE in warm gold, bold condensed sans-serif; beneath it the headline \"" + H + "\" in smaller cream sans-serif; under a thin gold rule a small cream kicker \"" + S + "\".\n\n" +
    "COLOUR: only deep teal #3E8A7E, warm gold #C5A56A, cream #E8E4D8.\n" +
    "TEXT: render \"NAJMA\", \"" + F + "\", \"" + H + "\", \"" + S + "\" verbatim, exactly once each, perfectly legible — no extra characters, no duplicated or garbled text, no invented words or numbers.\n" +
    "NEGATIVE: no plastic or waxy skin, no airbrushing, no over-smoothing, no CGI gloss, no warped or extra fingers, no mangled hands, no distorted eyes, no fake or misspelled logos, no watermark, no gibberish text, no generic stock-photo feel, no oversaturated HDR." +
    "```\n\n👉 Before posting, just check the number reads exactly “" + F + "”. The face stops the scroll; the figure makes it credible. Ask ChatGPT “now the same as 1920x1080” for the LinkedIn version.";
}

// ── v37.1 — NEWS LAYER + MEED CROSS-REFERENCE ───────────────────────────────────
// Reads public RSS headlines (Google News aggregate + The National), keeps the recent
// property-relevant ones, and cross-references each against the MEED corpus we hold:
// the tracked developments, the collector's big-update/under-construction lists, and —
// when the collector has shipped one — the full active-project name index (mkt_index).
// A matched story carries the MEED facts (stage, value, completion) into the daily feed,
// so one headline becomes a multi-angle story with register-grade facts attached.
const NEWS_FEEDS = [
  // Google News 503s from Cloudflare's IPs (proven 26 Aug) — GN arrives via the daily
  // collector instead (newsItems ingest). Bing tolerates datacenter IPs.
  { url: "https://www.bing.com/news/search?q=dubai+real+estate&format=rss", outlet: null },
  { url: "https://www.bing.com/news/search?q=dubai+property+developer+launch&format=rss", outlet: null },
  { url: "https://www.thenationalnews.com/arc/outboundfeeds/rss/?outputType=xml", outlet: "The National" },
];
const NEWS_KEYWORDS = /\b(propert(y|ies)|real estate|developers?|towers?|residen(ce|ces|tial)|handovers?|launch(es|ed)?|off-?plan|master ?plan|mortgages?|rents?|rental|villas?|apartments?|dubai land|freehold|escrow|penthouses?|sq ?ft|square feet)\b/i;

function _newsTok(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
    .filter(w => w.length > 3 && !/^(the|and|with|from|dubai|uae|abu|dhabi|real|estate|property|properties|residential|project|projects|community|tower|towers|building|development|developments)$/.test(w));
}

// Match a headline against a MEED name: 2+ significant shared tokens, or a whole-name hit.
function _newsMatch(headTokens, headLower, name) {
  const nl = String(name || "").toLowerCase();
  if (nl.length > 4 && headLower.indexOf(nl) !== -1) return true;
  const nt = _newsTok(name);
  if (!nt.length) return false;
  const hits = nt.filter(t => headTokens.indexOf(t) !== -1).length;
  return hits >= Math.min(2, nt.length);
}

async function newsTick(env, force) {
  if ((env.MARKET_BRIEF || "") !== "on") return;
  const n = gstNow();
  if (!force && n.getUTCMinutes() >= 30) return;                                   // once per cron hour
  const nk = "mktnews_run_" + gstDateStr(n) + "_" + n.getUTCHours();
  if (!force) { if (await env.MEETINGS.get(nk)) return; await env.MEETINGS.put(nk, "1", { expirationTtl: 86400 }); }

  // cross-reference candidates: tracked developments + collector lists + full index if shipped
  let d = null, idx = [];
  try { d = JSON.parse((await env.MEETINGS.get("mkt_latest")) || "null"); } catch (e) {}
  try { idx = JSON.parse((await env.MEETINGS.get("mkt_index")) || "[]"); } catch (e) {}
  const m = (d && d.meed) || {};
  const cands = [];
  for (const dv of (m.developments || [])) cands.push({ name: dv.development, kind: "tracked", facts: { developer: dv.developer, activeProjects: dv.activeProjects, pipelineValueUsdM: dv.pipelineValueUsdM, nextCompletion: dv.nextCompletion, dldPulse: dv.dldPulse } });
  for (const r of (m.recentBigUpdates || []).concat(m.largestUnderConstruction || [])) cands.push({ name: r.title, kind: "corpus", facts: { stage: r.stage, valueUsdM: r.valueUsdM, updated: r.updated } });
  for (const r of idx) cands.push({ name: r.t, kind: "index", facts: { stage: r.s, valueUsdM: r.v, completionDate: r.c } });

  let seen = {}; try { seen = JSON.parse((await env.MEETINGS.get("mkt_news_seen")) || "{}"); } catch (e) {}
  const items = [], feedStats = [];
  for (const f of NEWS_FEEDS) {
    try {
      const r = await fetch(f.url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", "Accept": "application/rss+xml, application/xml, text/xml, */*" }, redirect: "follow" });
      feedStats.push({ url: f.url.slice(0, 60), status: r.status });
      if (!r.ok) continue;
      const xml = await r.text();
      feedStats[feedStats.length - 1].bytes = xml.length;
      feedStats[feedStats.length - 1].rawItems = xml.split("<item>").length - 1;
      for (const it of xml.split("<item>").slice(1, 40)) {
        const ti = (it.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/s) || [])[1] || "";
        const src = (it.match(/<source[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/source>/s) || [])[1] || (it.match(/<News:Source[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/News:Source>/s) || [])[1] || f.outlet || "";
        const lnk = (it.match(/<link>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/s) || [])[1] || "";
        const pd = Date.parse((it.match(/<pubDate>(.*?)<\/pubDate>/s) || [])[1] || "") || 0;
        const title = ti.replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').trim();
        if (!title || Date.now() - pd > 48 * 3600 * 1000) continue;
        if (f.outlet && !NEWS_KEYWORDS.test(title)) continue;                      // The National is general news — filter
        const key = title.toLowerCase().slice(0, 80);
        if (seen[key]) continue;
        const ht = _newsTok(title), hl = title.toLowerCase();
        let xref = null;
        for (const c of cands) { if (_newsMatch(ht, hl, c.name)) { xref = { meedName: c.name, via: c.kind, facts: c.facts }; break; } }
        items.push({ title, outlet: src.trim(), link: lnk.trim(), at: pd, xref });
        seen[key] = Date.now();
      }
    } catch (e) { feedStats.push({ url: f.url.slice(0, 60), error: String((e && e.message) || e).slice(0, 80) }); }
  }
  // collector-shipped Google News batch (arrives already query-scoped — no keyword filter)
  try {
    const pend = JSON.parse((await env.MEETINGS.get("mkt_news_pending")) || "[]");
    if (pend.length) await env.MEETINGS.delete("mkt_news_pending");
    for (const p of pend) {
      const title = String(p.title || "").trim();
      if (!title) continue;
      const key = title.toLowerCase().slice(0, 80);
      if (seen[key]) continue;
      const ht = _newsTok(title), hl = title.toLowerCase();
      let xref = null;
      for (const c of cands) { if (_newsMatch(ht, hl, c.name)) { xref = { meedName: c.name, via: c.kind, facts: c.facts }; break; } }
      items.push({ title, outlet: String(p.outlet || "").trim(), link: String(p.link || ""), at: Date.parse(p.at || "") || Date.now(), xref });
      seen[key] = Date.now();
    }
  } catch (e) {}
  try { await env.MEETINGS.put("mkt_news_stats", JSON.stringify({ at: gstNowIso(), feeds: feedStats, kept: items.length }), { expirationTtl: 2 * 86400 }); } catch (e) {}
  if (!items.length && !force) return;
  // keep a rolling window: cross-referenced first, then newest
  let stored = []; try { stored = JSON.parse((await env.MEETINGS.get("mkt_news")) || "[]"); } catch (e) {}
  stored = items.concat(stored).slice(0, 40);
  stored.sort((a, b) => ((b.xref ? 1 : 0) - (a.xref ? 1 : 0)) || (b.at - a.at));
  await env.MEETINGS.put("mkt_news", JSON.stringify(stored.slice(0, 24)), { expirationTtl: 4 * 86400 });
  for (const k of Object.keys(seen)) { if (Date.now() - seen[k] > 5 * 86400000) delete seen[k]; }
  await env.MEETINGS.put("mkt_news_seen", JSON.stringify(seen), { expirationTtl: 7 * 86400 });
}

