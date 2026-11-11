// v834 (Kendall 11 Nov 2026, spec Operations/Handovers/DEV_BRIEF_Najma_Monthly_Market_Note_11NOV2026.md) - THE MONTHLY MARKET NOTE.
// Once a month every owner who said yes to market updates ("Keep me informed") gets one sentence about rents and prices in their area,
// built on the laptop from Ejari + DLD (naj-market-pulse scripts/build_market_notes.py) and APPROVED BY A HUMAN before it goes.
//   ingest   POST /ingest_market {month, mktNotes:[...]} (INGEST_TOKEN)  -> mkt_note_<yyyymm>_<slug>, mkt_note_index_<yyyymm>, mkt_note_last
//            a note already approved / skipped / sending / sent is never overwritten by a re-run (it is the record of what was sent)
//   screen   GET /momo/campaigns/notes?m=<yyyymm>   Kendall's key or Najjuko's: one card per area, Approve | Edit | Skip | Reopen
//   api      POST /momo/campaigns/notes/api {action, m, slug, text?, reason?}; every action appends to mkt_note_log_<yyyymm>
//   send     action "send_all" (OWNER key only, confirm "send-<yyyymm>"): one campaign per approved area, mkt-<yyyymm>-<slug>,
//            parent mkt-notes, template najjuko_market_update_v1 (vars name, =<area>, =<note>), audience tag area-<slug> AND consent
//            market-updates (or tag nurture), Mon-Fri 10:00-17:30, freq 28 days, one note per owner per month (c.mkt_month guard in
//            campStep). From then on the minute tick sends it; CAMPAIGNS_OFF=1 stops everything. Replies: flow mkt-note (KV data,
//            installed with action "flow_install"): Exploring selling / leasing -> handover to Najjuko, Stop -> opt-out (+ forget).
// Nothing here sends a message by itself. "send_all" refuses unless the template is APPROVED at Meta (camp_tpl_<name>.status) and
// the reply flow is installed. Never touches picjob_*, gmp_*, gcal_state.
import { cleanCampaign, hasConsent, isOptedOut } from "./campaigns.js";
import { ensureParent } from "./camp_parents.js";
import { MOMO_TOAST_JS } from "./momo_toast.js";

export const MN_TEMPLATE = "najjuko_market_update_v1", MN_FLOW = "mkt-note", MN_PARENT = "mkt-notes", MN_TOPIC = "market-updates";
const DIG = (s) => String(s || "").replace(/[^0-9]/g, "");
const esc = (s) => String(s == null ? "" : s).replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&#39;" }[c]));
const getJ = async (env, k, d) => { try { const v = await env.MEETINGS.get(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
const putJ = (env, k, v, o) => env.MEETINGS.put(k, JSON.stringify(v), o);
const J = (o, s) => new Response(JSON.stringify(o, null, 1), { status: s || 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const MONTH_RE = /^\d{6}$/, SLUG_RE = /^[a-z0-9-]{2,48}$/;
const OPEN = ["draft", "thin"], LOCKED = ["sending", "sent"];
export const noteKey = (m, slug) => "mkt_note_" + m + "_" + slug;
export const logKey = (m) => "mkt_note_log_" + m;

// The same rules as the generator (brief section 4): an edited note is checked again here.
const BANNED = /valuations?|value your|apprais|\bworth\b|guarantee|forecast|will rise|will fall|investment advice/i;
const BAD_FORM = /[\r\n\t]| {4,}|\{\{|https?:\/\/|www\.|[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
export function checkNoteText(t) {
  t = String(t == null ? "" : t);
  if (!t.trim()) return "empty";
  if (t.length >= 200) return "over 200 characters (" + t.length + ")";
  const m = BANNED.exec(t); if (m) return "banned word: " + m[0];
  if (BAD_FORM.test(t)) return "no newline, tab, 4 spaces, {{, link or emoji";
  return "";
}
export const monthLabel = (m) => { const d = new Date(Date.UTC(+m.slice(0, 4), +m.slice(4, 6) - 1, 1)); return isNaN(d) ? m : d.toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }); };
export const dubaiMonth = (now) => new Date(now + 4 * 3600000).toISOString().slice(0, 7).replace("-", "");

// ---------- ingest (from the laptop) ----------
export async function ingestNotes(env, body, now) {
  now = now || Date.now();
  const m = String((body && body.month) || ""), list = Array.isArray(body && body.mktNotes) ? body.mktNotes : null;
  if (!MONTH_RE.test(m) || !list) return { ok: false, error: "month yyyymm and mktNotes[] required" };
  if (list.length > 200) return { ok: false, error: "too many notes" };
  const ix = new Set(await getJ(env, "mkt_note_index_" + m, [])), out = { ok: true, month: m, written: [], kept: [], rejected: [] };
  for (const n of list) {
    const slug = String((n && n.area_slug) || "");
    if (!SLUG_RE.test(slug) || String(n.month || "") !== m) { out.rejected.push({ slug: slug.slice(0, 48), why: "slug or month" }); continue; }
    const thin = n.status === "thin", text = thin ? "" : String(n.text || "");
    const why = thin ? "" : checkNoteText(text); if (why) { out.rejected.push({ slug, why }); continue; }
    const k = noteKey(m, slug), prev = await getJ(env, k, null);
    if (prev && !OPEN.includes(prev.status)) { out.kept.push({ slug, status: prev.status }); continue; }   // never overwrite a decision
    const rec = { month: m, area_slug: slug, area_name: String(n.area_name || slug).slice(0, 60), dld_area: String(n.dld_area || "").slice(0, 60),
      text, text_draft: text, metrics: n.metrics && typeof n.metrics === "object" ? n.metrics : {}, status: thin ? "thin" : "draft",
      reason: thin ? String(n.reason || "too few records").slice(0, 160) : undefined, edited: false, ts: new Date(now).toISOString() };
    await putJ(env, k, rec); ix.add(slug); out.written.push(slug);
  }
  await putJ(env, "mkt_note_index_" + m, [...ix]);
  await putJ(env, "mkt_note_last", { month: m, at: new Date(now).toISOString(), areas: out.written.length, thin: list.filter((x) => x && x.status === "thin").length });
  return out;
}

// ---------- audience (who the note for one area goes to) ----------
export async function areaAudience(env, slug) {
  const tag = "area-" + slug, ix = await getJ(env, "camp_contact_index", []); let n = 0, noConsent = 0;
  for (const d of ix) {
    const k = await getJ(env, "camp_contact_" + d, null);
    if (!k || k.opted_out || k.undeliverable || k.removed || !(k.tags || []).includes(tag)) continue;
    if (!hasConsent(k, MN_TOPIC)) { noConsent++; continue; }
    if (await isOptedOut(env, d)) continue;
    n++;
  }
  return { n, no_consent: noConsent };
}

export async function loadMonth(env, m) {
  const out = [];
  for (const slug of await getJ(env, "mkt_note_index_" + m, [])) { const r = await getJ(env, noteKey(m, slug), null); if (r) out.push(r); }
  return out;
}
async function logAct(env, m, row) {
  const L = await getJ(env, logKey(m), []); L.push(row);
  await putJ(env, logKey(m), L.slice(-500), { expirationTtl: 400 * 86400 });
}

// A sending note becomes "sent" once its campaign is done or stopped; the counters are copied from camp_stats.
export async function syncSent(env, m, now) {
  for (const r of await loadMonth(env, m)) {
    if (r.status !== "sending" || !r.campaign_id) continue;
    const c = await getJ(env, "camp_" + r.campaign_id, null);
    if (!c || !["done", "stopped"].includes(c.status)) continue;
    const S = await getJ(env, "camp_stats_" + r.campaign_id, {}) || {};
    r.status = "sent"; r.sent_at = new Date(now).toISOString(); r.campaign_status = c.status;
    r.result = { sent: S.sent || 0, delivered: S.delivered || 0, read: S.read || 0, replied: S.replies || 0, optouts: S.optouts || 0 };
    await putJ(env, noteKey(m, r.area_slug), r);
  }
}

// ---------- the reply flow (data; installed once by the owner) ----------
// Button order follows the template: 0 Exploring selling, 1 Exploring leasing, 2 Stop messages. HANDOVER WORDING IS A DRAFT for
// Kendall / Najjuko to approve before flow_install (creative approval-first).
export const MKT_NOTE_FLOW = {
  id: MN_FLOW, start: "t0", stop_forgets: true, phone: "desk", freq_days: 28,
  nodes: {
    t0: { type: "template", template: MN_TEMPLATE, lang: "en",   // the variables come from each month's campaign, not the flow
      buttons: [{ id: "sell", title: "Exploring selling", next: "hs" }, { id: "lease", title: "Exploring leasing", next: "hl" }, { id: "stop", title: "Stop messages", optout: true }] },
    hs: { type: "handover", note: "market note: exploring selling", text: "Thank you, {first}. I will call you personally today about selling. Najjuko" },
    hl: { type: "handover", note: "market note: exploring leasing", text: "Thank you, {first}. I will call you personally today about leasing. Najjuko" },
  },
};

// One campaign per approved area. Returns {c} or {error}.
export function noteCampaign(r, audienceN) {
  const id = ("mkt-" + r.month + "-" + r.area_slug).slice(0, 42);
  const { c, err } = cleanCampaign({ id, name: "Market note · " + r.area_name + " · " + monthLabel(r.month), template: MN_TEMPLATE, lang: "en",
    vars: ["name", "=" + r.area_name, "=" + r.text], tags: ["area-" + r.area_slug], require_consent: MN_TOPIC, mkt_month: r.month,
    stop_forgets: true, phone: "desk", window: "10:00-17:30", days: "mon-fri", freq_days: 28, cap: Math.max(1, audienceN || 1), batch: 5,
    api: "mm", retry_131049: true, retry_days: 2, ramp: "off" }, null);
  if (err.length) return { error: err };
  c.flow = MN_FLOW; c.qr = 3; c.parent = MN_PARENT; c.mkt_note = noteKey(r.month, r.area_slug);
  return { c };
}

// ---------- route ----------
export async function notesRoute(request, env, url, ctx) {
  const { owner, viewer, key, rk, now, page } = ctx, p = url.pathname;
  const m = MONTH_RE.test(String(url.searchParams.get("m") || "")) ? String(url.searchParams.get("m")) : dubaiMonth(now);
  if (p === "/momo/campaigns/notes" && request.method === "GET") {
    await syncSent(env, m, now);
    const body = await notesBody(env, m, key, rk, owner, now);
    return new Response(page(key, rk, body), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  }
  if (p !== "/momo/campaigns/notes/api" || request.method !== "POST") return new Response("not found", { status: 404 });
  let b = {}; try { b = await request.json(); } catch (e) { return J({ ok: false, error: "bad json" }, 400); }
  const a = String(b.action || ""), bm = MONTH_RE.test(String(b.m || "")) ? String(b.m) : m, at = new Date(now).toISOString();
  if (a === "list") { await syncSent(env, bm, now); return J({ ok: true, month: bm, notes: await loadMonth(env, bm), log: (await getJ(env, logKey(bm), [])).slice(-20) }); }
  if (a === "flow_install") {   // owner only; the flow is data (no deploy). Wording must be approved first.
    if (!owner) return J({ ok: false, error: "owner only" }, 403);
    const { cleanFlow } = await import("./campaigns.js"); const { f, err } = cleanFlow(MKT_NOTE_FLOW); if (err.length) return J({ ok: false, error: err }, 400);
    await putJ(env, "camp_flow_" + f.id, f); return J({ ok: true, flow: f });
  }
  if (a === "send_all") return sendAll(env, bm, b, owner, viewer, now);
  const slug = String(b.slug || ""); if (!SLUG_RE.test(slug)) return J({ ok: false, error: "slug" }, 400);
  const k = noteKey(bm, slug), r = await getJ(env, k, null); if (!r) return J({ ok: false, error: "no such note" }, 404);
  if (LOCKED.includes(r.status)) return J({ ok: false, error: "already " + r.status + ": locked" }, 409);
  const before = r.text;
  if (a === "edit") {
    const t = String(b.text == null ? "" : b.text).replace(/\s+$/, ""); const why = checkNoteText(t); if (why) return J({ ok: false, error: why }, 400);
    if (r.status === "thin" && !r.text_draft) r.text_draft = "";
    r.text = t; r.edited = t !== r.text_draft; r.status = "draft"; delete r.approved_by; delete r.approved_at;   // an edit always needs Approve again
  } else if (a === "approve") {
    if (r.status !== "draft") return J({ ok: false, error: "only a draft can be approved (status " + r.status + ")" }, 409);
    const why = checkNoteText(r.text); if (why) return J({ ok: false, error: why }, 400);
    r.status = "approved"; r.approved_by = viewer; r.approved_at = at;
  } else if (a === "skip") {
    if (!["draft", "approved", "thin"].includes(r.status)) return J({ ok: false, error: "status " + r.status }, 409);
    r.status = "skipped"; r.skip_reason = String(b.reason || "").slice(0, 160) || undefined; r.skipped_by = viewer; r.skipped_at = at;
  } else if (a === "reopen") {
    if (!["approved", "skipped"].includes(r.status)) return J({ ok: false, error: "status " + r.status }, 409);
    r.status = r.text ? "draft" : "thin"; delete r.approved_by; delete r.approved_at; delete r.skip_reason;
  } else return J({ ok: false, error: "unknown action" }, 400);
  await putJ(env, k, r);
  await logAct(env, bm, { at, who: viewer, area_slug: slug, action: a, before: a === "edit" ? before : undefined, after: a === "edit" ? r.text : undefined, reason: a === "skip" ? r.skip_reason : undefined });
  return J({ ok: true, note: r });
}

async function sendAll(env, m, b, owner, viewer, now) {
  if (!owner) return J({ ok: false, error: "sending needs Kendall's approval (owner key)" }, 403);
  if (b.confirm !== "send-" + m) return J({ ok: false, error: "confirm must be send-" + m }, 400);
  if (env.CAMPAIGNS_OFF === "1") return J({ ok: false, error: "CAMPAIGNS_OFF is set" }, 409);
  const ts = await getJ(env, "camp_tpl_" + MN_TEMPLATE, null);
  if (!ts || String(ts.status || "").toUpperCase() !== "APPROVED") return J({ ok: false, error: "template " + MN_TEMPLATE + " not approved at Meta (" + ((ts && ts.status) || "unknown") + ")" }, 409);
  if (!(await getJ(env, "camp_flow_" + MN_FLOW, null))) return J({ ok: false, error: "reply flow " + MN_FLOW + " not installed (action flow_install)" }, 409);
  const ix = await getJ(env, "camp_index", []), made = [], skipped = [], at = new Date(now).toISOString();
  for (const r of await loadMonth(env, m)) {
    if (r.status !== "approved") continue;
    if (checkNoteText(r.text)) { skipped.push({ slug: r.area_slug, why: checkNoteText(r.text) }); continue; }
    const aud = await areaAudience(env, r.area_slug); if (!aud.n) { skipped.push({ slug: r.area_slug, why: "no consented owners tagged area-" + r.area_slug }); continue; }
    const { c, error } = noteCampaign(r, aud.n); if (error) { skipped.push({ slug: r.area_slug, why: error.join("; ") }); continue; }
    if (ix.includes(c.id)) { skipped.push({ slug: r.area_slug, why: "campaign " + c.id + " exists" }); continue; }
    c.status = "live"; c.started = at; c.live_by = "owner";
    await ensureParent(env, c, now); await putJ(env, "camp_" + c.id, c); ix.push(c.id);
    r.status = "sending"; r.campaign_id = c.id; r.n_contacts = aud.n; r.send_by = viewer; r.send_at = at; await putJ(env, noteKey(m, r.area_slug), r);
    await logAct(env, m, { at, who: viewer, area_slug: r.area_slug, action: "send", campaign: c.id, contacts: aud.n });
    made.push({ slug: r.area_slug, campaign: c.id, contacts: aud.n });
  }
  await putJ(env, "camp_index", ix);
  return J({ ok: true, month: m, live: made, skipped });
}

// The link card on the Campaigns dashboard: "Market notes · December: 3 to approve".
export async function mnLinkCard(env, q, now) {
  const m = dubaiMonth(now), notes = await loadMonth(env, m), todo = notes.filter((r) => r.status === "draft").length, ok = notes.filter((r) => r.status === "approved").length;
  const line = !notes.length ? "no drafts yet" : todo ? todo + " to approve" : ok ? ok + " approved, not sent" : notes.filter((r) => ["sending", "sent"].includes(r.status)).length + " sent";
  return '<a class=mnlink href="/momo/campaigns/notes' + q + '" style="display:flex;align-items:center;gap:10px;margin:0 0 12px;padding:12px 14px;border:1px solid #C5A56A;border-radius:14px;background:#FFFDF9;color:#0A4F4A;text-decoration:none;font-weight:600">'
    + ic('<path d="M4 19V5M4 19h16M8 15l3-4 3 2 4-6"/>') + "<span>Market notes · " + esc(monthLabel(m).split(" ")[0]) + ': <span style="color:#1C2321">' + esc(line) + "</span></span></a>";
}

// ---------- the screen (cards; one column at 375 px, two on desktop) ----------
const ST = { draft: ["To approve", "#8A6F3E"], approved: ["Approved", "#0A4F4A"], skipped: ["Skipped", "#5F6B66"], thin: ["Too few records", "#5F6B66"], sending: ["Sending", "#0A4F4A"], sent: ["Sent", "#2F7D5B"] };
const ic = (d) => '<svg viewBox="0 0 24 24" width=18 height=18 fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden=true>' + d + "</svg>";
const I = { ok: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>', skip: '<path d="M5 5l14 14M19 5L5 19"/>', undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>', send: '<path d="M4 12l16-8-6 16-2-6z"/>', users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/>' };
const CSS = "<style>.mn h1{font:600 1.25rem 'IBM Plex Sans',sans-serif;margin:4px 0 2px;color:#1C2321}.mn .sub{color:#5F6B66;font-size:.86rem;margin:0 0 12px}"
  + ".mng{display:grid;grid-template-columns:1fr;gap:12px}@media(min-width:760px){.mng{grid-template-columns:1fr 1fr}}"
  + ".mnc{background:#FFFDF9;border:1px solid #E7E1D6;border-radius:16px;padding:14px;box-sizing:border-box;min-width:0}.mnc.thin{opacity:.6}"
  + ".mnh{display:flex;justify-content:space-between;align-items:center;gap:8px}.mnh b{font-size:1rem;color:#1C2321}.pill{border-radius:999px;padding:2px 10px;font:600 .72rem 'IBM Plex Mono',monospace;color:#fff;white-space:nowrap}"
  + ".mnt{font-size:1.05rem;line-height:1.45;color:#1C2321;margin:10px 0 4px;overflow-wrap:anywhere}.mnm{color:#5F6B66;font:500 .74rem 'IBM Plex Mono',monospace}"
  + ".mnc details{margin:8px 0;font-size:.82rem;color:#5F6B66}.mnc details li{margin:2px 0}.mnb{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}"
  + ".mnb button{display:inline-flex;align-items:center;gap:6px;border:1.5px solid #0A4F4A;background:#fff;color:#0A4F4A;border-radius:12px;padding:9px 14px;font:600 .88rem 'IBM Plex Sans',sans-serif;cursor:pointer;min-height:40px}"
  + ".mnb button.pri{background:#0A4F4A;color:#fff}.mnc textarea{width:100%;box-sizing:border-box;border:1px solid #C5A56A;border-radius:10px;padding:8px;font:inherit;min-height:84px;display:none}"
  + ".mnlog{margin-top:16px;font-size:.8rem;color:#5F6B66}.mnlog div{padding:3px 0;border-bottom:1px solid #EFEAE0}.mnsend{margin:12px 0;padding:12px;border:1px solid #C5A56A;border-radius:14px;background:#FFF8EC}</style>";

export async function notesBody(env, m, key, rk, owner, now) {
  const notes = await loadMonth(env, m), q = "?key=" + encodeURIComponent(key) + (rk ? "&rk=" + encodeURIComponent(rk) : "");
  const last = notes.reduce((a, r) => (r.ts > a ? r.ts : a), ""), asOf = (notes.find((r) => r.metrics && r.metrics.as_of) || { metrics: { as_of: {} } }).metrics.as_of;
  const prev = (() => { const y = +m.slice(0, 4), mo = +m.slice(4, 6); const d = mo === 1 ? [y - 1, 12] : [y, mo - 1]; return d[0] + String(d[1]).padStart(2, "0"); })();
  let h = CSS + '<div class=mn><div class=nav2><a class=back href="/momo/campaigns' + q + '">&#8592; Campaigns</a> <a href="/momo/campaigns/notes' + q + "&m=" + prev + '">' + esc(monthLabel(prev)) + "</a></div>"
    + "<h1>Market notes · " + esc(monthLabel(m)) + "</h1>";
  if (!notes.length) return h + '<p class=sub>No drafts yet for ' + esc(monthLabel(m)) + ". They are built on the laptop on the first refresh on or after the 1st.</p></div>";
  h += '<p class=sub>Drafts built ' + esc(String(last).slice(0, 10)) + " from Ejari to " + esc(asOf.ejari || "?") + " and DLD sales to " + esc(asOf.dld || "?") + ". Nothing is sent until a note is approved and Kendall taps Send.</p>";
  const tpl = await getJ(env, "camp_tpl_" + MN_TEMPLATE, null), approved = notes.filter((r) => r.status === "approved").length;
  if (owner && approved) h += '<div class=mnsend><b>' + approved + " approved</b> · template " + esc(MN_TEMPLATE) + ": " + esc((tpl && tpl.status) || "status unknown")
    + '<div class=mnb><button class=pri id=mnsend data-m="' + m + '">' + ic(I.send) + " Send all approved</button></div></div>";
  const order = ["draft", "approved", "sending", "sent", "skipped", "thin"];
  notes.sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status) || String(a.area_name).localeCompare(b.area_name));
  h += "<div class=mng>";
  for (const r of notes) {
    const st = ST[r.status] || [r.status, "#5F6B66"], aud = await areaAudience(env, r.area_slug), mt = r.metrics || {};
    const fig = [];
    for (const [b, x] of Object.entries(mt.rent || {})) fig.push(b + "-bed rent AED " + Number(x.med).toLocaleString("en-GB") + " a year from " + x.n + " new contracts" + (x.qoq != null ? ", " + (x.qoq > 0 ? "+" : "") + x.qoq + "% vs the 90 days before (" + x.n_prv + ")" : ""));
    if (mt.sale) fig.push("Registered sales AED " + Number(mt.sale.psf).toLocaleString("en-GB") + "/sq ft from " + mt.sale.n + " sales" + (mt.sale.qoq != null ? ", " + (mt.sale.qoq > 0 ? "+" : "") + mt.sale.qoq + "%" : ""));
    if (mt.handovers) fig.push("Handovers due in 90 days: " + (mt.handovers.projects || 0) + " projects, " + (mt.handovers.units || 0) + " units");
    for (const d of mt.dropped || []) fig.push("Left out: " + d);
    h += '<div class="mnc' + (r.status === "thin" ? " thin" : "") + '" data-slug="' + esc(r.area_slug) + '"><div class=mnh><b>' + esc(r.area_name) + '</b><span class=pill style="background:' + st[1] + '">' + esc(st[0]) + "</span></div>"
      + '<div class=mnm>' + ic(I.users) + " goes to " + aud.n + " owner" + (aud.n === 1 ? "" : "s") + (aud.no_consent ? " · " + aud.no_consent + " tagged without consent (left out)" : "") + "</div>"
      + (r.text ? '<div class=mnt>' + esc(r.text) + '</div><div class=mnm>' + r.text.length + " characters" + (r.edited ? " · edited" : "") + (r.approved_by ? " · approved by " + esc(r.approved_by) : "") + "</div>"
        : '<div class=mnt style="font-size:.92rem;color:#5F6B66">No note: ' + esc(r.reason || "too few records") + "</div>")
      + (r.result ? '<div class=mnm>sent ' + r.result.sent + " · delivered " + r.result.delivered + " · read " + r.result.read + " · replied " + r.result.replied + " · opted out " + r.result.optouts + "</div>" : "")
      + (r.skip_reason ? '<div class=mnm>skipped: ' + esc(r.skip_reason) + "</div>" : "")
      + "<details><summary>The figures behind it</summary><ul>" + fig.map((x) => "<li>" + esc(x) + "</li>").join("") + "</ul></details>";
    if (!LOCKED.includes(r.status)) {
      h += '<textarea maxlength=199>' + esc(r.text || "") + "</textarea><div class=mnb>";
      if (r.status === "draft") h += '<button class="pri mna" data-a=approve>' + ic(I.ok) + " Approve</button>";
      if (r.status === "draft" || r.status === "thin") h += '<button class=mne>' + ic(I.edit) + " Edit</button>";
      if (["draft", "approved", "thin"].includes(r.status)) h += '<button class=mna data-a=skip>' + ic(I.skip) + " Skip</button>";
      if (["approved", "skipped"].includes(r.status)) h += '<button class=mna data-a=reopen>' + ic(I.undo) + " Reopen</button>";
      h += "</div>";
    }
    h += "</div>";
  }
  h += "</div>";
  const L = (await getJ(env, logKey(m), [])).slice(-20).reverse();
  if (L.length) h += "<div class=mnlog><b>Recent</b>" + L.map((x) => "<div>" + esc((x.who === "najjuko" ? "Najjuko" : "Kendall") + " " + ({ approve: "approved", edit: "edited", skip: "skipped", reopen: "reopened", send: "sent" }[x.action] || x.action) + " " + x.area_slug + ", " + String(x.at).slice(0, 16).replace("T", " ") + " UTC") + "</div>").join("") + "</div>";
  return h + "</div><script>" + MOMO_TOAST_JS + NOTES_JS.replace("__M__", m) + "</script>";
}

const NOTES_JS = "(function(){var M='__M__';function toast(t,o){if(window.momoToast)momoToast(t,o);else alert(t)}"
  + "function api(b){b.m=M;return fetch('/momo/campaigns/notes/api'+location.search,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).then(function(r){return r.json()})}"
  + "function done(j,msg){if(j&&j.ok){toast(msg);setTimeout(function(){location.reload()},700)}else toast((j&&j.error)||'Did not work',{error:true})}"
  + "document.querySelectorAll('.mna').forEach(function(b){b.onclick=function(){var c=b.closest('.mnc'),a=b.getAttribute('data-a'),x={action:a,slug:c.getAttribute('data-slug')};"
  + "if(a==='skip'){var r=prompt('Reason for skipping (optional)','');if(r===null)return;x.reason=r}"
  + "api(x).then(function(j){done(j,{approve:'Approved',skip:'Skipped',reopen:'Reopened'}[a])})}});"
  + "document.querySelectorAll('.mne').forEach(function(b){b.onclick=function(){var c=b.closest('.mnc'),t=c.querySelector('textarea');"
  + "if(t.style.display!=='block'){t.style.display='block';t.focus();b.lastChild.textContent=' Save';return}"
  + "api({action:'edit',slug:c.getAttribute('data-slug'),text:t.value}).then(function(j){done(j,'Saved: approve it to send')})}});"
  + "var s=document.getElementById('mnsend');if(s)s.onclick=function(){if(!confirm('Send every approved note this month to its owners? It starts in the next sending window (Mon-Fri 10:00-17:30).'))return;"
  + "api({action:'send_all',confirm:'send-'+M}).then(function(j){if(j&&j.ok){toast((j.live||[]).length+' area(s) live'+((j.skipped||[]).length?', '+j.skipped.length+' skipped':''));setTimeout(function(){location.reload()},900)}else toast((j&&j.error)||'Did not send',{error:true})})};"
  + "})();";
