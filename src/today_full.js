import { calToday } from "./today_cal.js";   // v786b
import { briefingPage } from "./dev_briefing.js";   // v786a
// v786 (Kendall 5 Nov 2026: "build the full today card") - Najjuko's FULL Today card at the top of her Work.
// 1 Meetings & visits (her own visits list + today's Meeting entries + tasks due today naming a developer; calendar in v786b)
// 2 Broker: calls due (campaign follow-ups), leads gone quiet 7+ days, deals in progress by stage, new developer stock for her leads' projects
// 3 Strategic Lead: stuck tasks + who she waits on, due today (Done / Check in), team replies
// 4 Content: today's posts (next step, owner, Done), "N things to fix for tomorrow"
// 5 Your week: hours against 15 h by role, focus areas, a nudge for an empty area
// + Add: Task / Meeting / Lead / Post / Note. Edit in place: tap a row. Every save shows the shared Saved card (v778).
// KV: naj_leads [ids], naj_lead_<id> {id,name,phone,wants,project,stage,next,due,notes,created,updated,snooze}, naj_visits_<yyyy-mm-dd> [{id,time,kind,who,with,notes}]
// Rules: no WhatsApp is ever sent from here (wa.me opens HER phone); availability only from developer sheets with their date; light cream; icons not emoji.

const J = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
async function getJ(env, k, d) { try { const v = await env.MEETINGS.get(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
const dubaiToday = () => new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10);
const addDays = (d, n) => new Date(Date.parse(d + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
const okDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || "")) ? String(d) : "";
const str = (v, n) => String(v == null ? "" : v).trim().slice(0, n || 200);
const slugOf = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);
export const STAGES = ["Lead", "Viewing", "Offer", "Contract", "Won", "Lost"];
export const DEVELOPERS = ["Sobha", "Nakheel", "DAMAC", "Emaar", "Beyond", "Binghatti", "Arada", "Imtiaz", "Select", "Fakhruddin", "Prestige One", "Object 1", "Ellington", "Meraas", "Danube", "Aldar", "Azizi", "Omniyat", "Samana", "Deyaar", "Dubai Properties", "Meydan", "Wasl", "Majid Al Futtaim", "Sunrise", "Tiger", "Reportage", "Leos", "Iman", "Union Properties"];
export const devIn = (s) => { const t = " " + String(s || "").toLowerCase() + " "; return DEVELOPERS.find((d) => t.includes(" " + d.toLowerCase() + " ") || t.includes(" " + d.toLowerCase() + "'") || t.includes(" " + d.toLowerCase() + ",") || t.includes(" " + d.toLowerCase() + ".")) || ""; };

export function cleanLead(x, prev) {
  const p = prev || {};
  const stage = STAGES.includes(x.stage) ? x.stage : (p.stage || "Lead");
  const phone = str(x.phone != null ? x.phone : p.phone, 24).replace(/[^\d+]/g, "");
  return { id: p.id || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6)), name: str(x.name != null ? x.name : p.name, 80), phone,
    wants: str(x.wants != null ? x.wants : p.wants, 200), project: str(x.project != null ? x.project : p.project, 80), stage,
    next: str(x.next != null ? x.next : p.next, 200), due: okDate(x.due != null ? x.due : p.due), notes: str(x.notes != null ? x.notes : p.notes, 800),
    snooze: okDate(x.snooze != null ? x.snooze : p.snooze), created: p.created || new Date().toISOString(), updated: new Date().toISOString(), last_contact: okDate(x.last_contact) || p.last_contact || dubaiToday() };
}
async function readLeads(env) {
  const ids = await getJ(env, "naj_leads", []), out = [];
  for (const id of ids.slice(-300)) { const l = await getJ(env, "naj_lead_" + id, null); if (l && !l.deleted) out.push(l); }
  return out;
}
// the UAE mobile in wa.me form: 05x -> 9715x
export const waNum = (p) => { let d = String(p || "").replace(/\D/g, ""); if (/^05\d{8}$/.test(d)) d = "971" + d.slice(1); if (/^5\d{8}$/.test(d)) d = "971" + d; if (d.startsWith("00")) d = d.slice(2); return d; };

export async function todayFullData(env) {
  const today = dubaiToday(), out = { today, visits: [], leads: [], quiet: [], deals: {}, calls: [], stock: [] };
  out.visits = await getJ(env, "naj_visits_" + today, []);
  try { out.cal = await calToday(env, today); } catch (e) { out.cal = { connected: false, broken: true }; }
  const leads = await readLeads(env); out.leads = leads;
  const open = leads.filter((l) => l.stage !== "Won" && l.stage !== "Lost");
  STAGES.forEach((s) => { out.deals[s] = leads.filter((l) => l.stage === s).length; });
  out.quiet = open.filter((l) => (!l.snooze || l.snooze <= today) && l.last_contact && l.last_contact <= addDays(today, -7)).slice(0, 8);
  out.due = open.filter((l) => l.due && l.due <= today).slice(0, 8);
  // campaign follow-up calls (the follow-up list the campaigns write); "Tomorrow" moves next_call
  const ix = await getJ(env, "camp_handover_index", []);
  out.calls = ix.map((x, i) => ({ ...x, _i: i })).filter((x) => x && x.kind === "follow_up" && x.status !== "done" && x.status !== "closed" && (!x.next_call || x.next_call <= today))
    .slice(0, 8).map((x) => ({ i: x._i, cid: x.cid, d: x.d, name: x.name || "", answer: (x.answers || []).slice(-1)[0] || "", opened: x.opened || "", tries: (x.call_log || []).length }));
  // new developer stock for her leads' projects (developer sheets only, with the sheet date)
  const avi = await getJ(env, "av_idx", {}), keys = Object.keys(avi || {});
  for (const l of open) {
    const s = slugOf(l.project); if (!s || s.length < 3) continue;
    const k = keys.find((k) => k.includes("|b:" + s) || k.endsWith("b:" + s) || (k.includes("|b:") && k.split("|b:")[1].includes(s)));
    if (!k) continue; const e = await getJ(env, "av_e_" + k, null);
    if (e && e.units > 0) out.stock.push({ lead: l.name, project: l.project, units: e.units, developer: e.developer || "", sheet_date: e.sheet_date || "" });
    if (out.stock.length >= 5) break;
  }
  return out;
}

export async function todayFullApi(env, b, who) {
  const today = dubaiToday();
  if (b.action === "lead_save") {
    const ids = await getJ(env, "naj_leads", []), prev = b.id ? await getJ(env, "naj_lead_" + str(b.id, 24), null) : null;
    const l = cleanLead(b.lead || {}, prev); if (!l.name) return J({ ok: false, error: "Add the lead's name." }, 400);
    await env.MEETINGS.put("naj_lead_" + l.id, JSON.stringify(l)); if (!ids.includes(l.id)) { ids.push(l.id); await env.MEETINGS.put("naj_leads", JSON.stringify(ids.slice(-1000))); }
    return J({ ok: true, lead: l, saved: "Lead " + l.name });
  }
  if (b.action === "lead_delete") { const l = await getJ(env, "naj_lead_" + str(b.id, 24), null); if (!l) return J({ ok: false, error: "No such lead." }, 404); l.deleted = true; l.updated = new Date().toISOString(); await env.MEETINGS.put("naj_lead_" + l.id, JSON.stringify(l)); return J({ ok: true, saved: "Lead removed" }); }
  if (b.action === "lead_touch") { const l = await getJ(env, "naj_lead_" + str(b.id, 24), null); if (!l) return J({ ok: false, error: "No such lead." }, 404);
    if (b.snooze) l.snooze = addDays(today, Math.max(1, Math.min(30, +b.snooze || 3))); else l.last_contact = today; l.updated = new Date().toISOString();
    await env.MEETINGS.put("naj_lead_" + l.id, JSON.stringify(l)); return J({ ok: true, lead: l, saved: b.snooze ? l.name + " · snoozed to " + l.snooze : l.name + " · contacted today" }); }
  if (b.action === "visit_save") {
    const date = okDate(b.date) || today, L = await getJ(env, "naj_visits_" + date, []);
    const v = { id: str(b.id, 24) || (Date.now().toString(36) + Math.random().toString(36).slice(2, 5)), time: /^\d{2}:\d{2}$/.test(b.time) ? b.time : "", kind: ["Developer", "Client", "Internal"].includes(b.kind) ? b.kind : "Internal",
      with: str(b.with, 80), notes: str(b.notes, 400), by: who, at: new Date().toISOString() };
    if (!v.with) return J({ ok: false, error: "Who is the meeting with?" }, 400);
    const i = L.findIndex((x) => x.id === v.id); if (i >= 0) L[i] = v; else L.push(v); L.sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
    await env.MEETINGS.put("naj_visits_" + date, JSON.stringify(L), { expirationTtl: 60 * 864e2 }); return J({ ok: true, visit: v, saved: (v.time ? v.time + " " : "") + v.with });
  }
  if (b.action === "visit_delete") { const date = okDate(b.date) || today, L = (await getJ(env, "naj_visits_" + date, [])).filter((x) => x.id !== b.id); await env.MEETINGS.put("naj_visits_" + date, JSON.stringify(L), { expirationTtl: 60 * 864e2 }); return J({ ok: true, saved: "Meeting removed" }); }
  if (b.action === "call_mark") {
    const ix = await getJ(env, "camp_handover_index", []), i = ix.findIndex((x) => x && x.kind === "follow_up" && x.cid === b.cid && x.d === b.d);
    if (i < 0) return J({ ok: false, error: "That follow-up is no longer on the list." }, 404);
    const x = ix[i], o = String(b.outcome || ""); x.call_log = (x.call_log || []).concat([{ at: new Date().toISOString(), outcome: o, note: str(b.note, 300), by: who }]).slice(-20);
    if (o === "called") x.status = "done"; if (o === "tomorrow" || o === "noanswer") x.next_call = addDays(today, 1);
    x.updated = new Date().toISOString(); ix[i] = x; await env.MEETINGS.put("camp_handover_index", JSON.stringify(ix));
    return J({ ok: true, saved: (x.name || "Call") + " · " + ({ called: "called", noanswer: "no answer, again tomorrow", tomorrow: "moved to tomorrow" }[o] || "noted") });
  }
  return J({ ok: false, error: "Unknown action." }, 400);
}

export async function todayFullRoute(request, env, url, deps) {
  const p = url.pathname;
  if (p === "/momo/today.js") return new Response("var __name=function(f){return f};(" + TODAY_CLIENT.toString() + ")();", { headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-store" } });
  if (p !== "/momo/work/today/data" && p !== "/momo/work/today/api" && p !== "/momo/work/briefing") return null;
  const who = deps.person(env, url); if (who !== "najjuko" && who !== "kendall") return new Response("not found", { status: 404 });
  if (p === "/momo/work/briefing") return new Response(await briefingPage(env, url), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  if (p === "/momo/work/today/data" && request.method === "GET") return J({ ok: true, ...(await todayFullData(env)) });
  if (p === "/momo/work/today/api" && request.method === "POST") { let b = {}; try { b = await request.json(); } catch (e) {} return todayFullApi(env, b, who === "najjuko" ? "Najjuko" : "Kendall"); }
  return new Response("not found", { status: 404 });
}

// ---------------- the page script (served as /momo/today.js; runs beside work.js and reads its D) ----------------
function TODAY_CLIENT() {
  var Q = location.search, KEY = (new URLSearchParams(Q)).get("key") || "", X = null, LAST = null;
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[<>&"]/g, function (c) { return { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]; }); }
  function ic(d) { return '<svg viewBox="0 0 24 24" width=18 height=18 fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden=true>' + d + "</svg>"; }
  var I = { cal: ic('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'), call: ic('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>'),
    task: ic('<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>'), warn: ic('<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>'),
    user: ic('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'), home: ic('<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'), post: ic('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 13l3 3 5-6"/>'),
    clock: ic('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'), chat: ic('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'), plus: ic('<path d="M12 5v14M5 12h14"/>') };
  function api(b) { return fetch("/momo/work/today/api" + Q, { method: "POST", headers: { "Content-Type": "application/json", "X-Momo-Confirm": "page" }, body: JSON.stringify(b) }).then(function (r) { return r.json(); }); }
  function wapi(b) { return fetch("/momo/work/api" + Q, { method: "POST", headers: { "Content-Type": "application/json", "X-Momo-Confirm": "page" }, body: JSON.stringify(b) }).then(function (r) { return r.json(); }); }
  function papi(b) { return fetch("/momo/work/planner/api" + Q, { method: "POST", headers: { "Content-Type": "application/json", "X-Momo-Confirm": "page" }, body: JSON.stringify(b) }).then(function (r) { return r.json(); }); }
  function said(j, title, line) { if (window.momoConfirm) window.momoConfirm(!!(j && j.ok), j && j.ok ? (title || "Saved") : "Not saved", j && j.ok ? (line || j.saved || "") : ((j && j.error) || "Something went wrong")); }
  function load() { return fetch("/momo/work/today/data" + Q).then(function (r) { return r.json(); }).then(function (j) { if (j && j.ok) { X = j; draw(); } }).catch(function () {}); }
  function reloadWork() { if (typeof window.load === "function") { try { window.load(); } catch (e) {} } load(); }
  function fd(d) { try { return new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }); } catch (e) { return d; } }
  function btn(lab, attr, cls) { return '<button type=button class="tb' + (cls ? " " + cls : "") + '" ' + attr + ">" + esc(lab) + "</button>"; }
  function row(icon, main, sub, acts, attr) { return '<div class=tr ' + (attr || "") + '><span class=ti>' + icon + '</span><div class=tm><b>' + main + "</b>" + (sub ? "<small>" + sub + "</small>" : "") + (acts ? '<div class=ta>' + acts + "</div>" : "") + "</div></div>"; }
  function sec(n, title, body, empty) { return '<div class=ts><div class=th><span class=tn>' + n + "</span>" + esc(title) + "</div>" + (body || '<div class=te>' + esc(empty) + "</div>") + "</div>"; }

  // ---------- the small edit / add sheet ----------
  function sheet(title, fields, vals, onSave, extra) {
    var w = document.createElement("div"); w.id = "tdsheet";
    w.setAttribute("style", "position:fixed;inset:0;z-index:90;background:rgba(28,40,38,.45);display:flex;align-items:flex-end;justify-content:center");
    var h = '<div style="background:#FFFDF9;border-radius:20px 20px 0 0;max-width:560px;width:100%;padding:16px 16px calc(18px + env(safe-area-inset-bottom));max-height:86vh;overflow:auto"><div style="font:600 1.08rem Fraunces,serif;color:#0A4F4A;margin-bottom:8px">' + esc(title) + "</div>";
    fields.forEach(function (f) { var v = vals[f[0]] == null ? "" : vals[f[0]];
      h += '<label style="display:block;font:600 .7rem IBM Plex Mono,monospace;letter-spacing:.06em;color:#8A6F3E;text-transform:uppercase;margin:8px 0 3px">' + esc(f[1]) + "</label>";
      if (f[2] === "sel") h += '<select data-f="' + f[0] + '" style="width:100%;box-sizing:border-box;border:1px solid #D8D1C4;border-radius:12px;padding:11px;font:500 .95rem IBM Plex Sans,sans-serif;background:#fff">' + f[3].map(function (o) { return "<option" + (o === v ? " selected" : "") + ">" + esc(o) + "</option>"; }).join("") + "</select>";
      else if (f[2] === "long") h += '<textarea data-f="' + f[0] + '" rows=3 style="width:100%;box-sizing:border-box;border:1px solid #D8D1C4;border-radius:12px;padding:11px;font:500 .95rem IBM Plex Sans,sans-serif">' + esc(v) + "</textarea>";
      else h += '<input data-f="' + f[0] + '" type="' + (f[2] || "text") + '" value="' + esc(v) + '" style="width:100%;box-sizing:border-box;border:1px solid #D8D1C4;border-radius:12px;padding:11px;font:500 .95rem IBM Plex Sans,sans-serif;background:#fff">'; });
    h += (extra || "") + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px;position:sticky;bottom:0;background:#FFFDF9;padding-top:6px"><button type=button id=tdx class=tb2>Cancel</button><button type=button id=tds class="tb2 tbp">Save</button></div><div id=tdmsg style="font:500 .82rem IBM Plex Sans,sans-serif;color:#5F6B66;text-align:center;margin-top:6px"></div></div>';
    w.innerHTML = h; document.body.appendChild(w);
    var close = function () { if (w.parentNode) w.parentNode.removeChild(w); };
    w.onclick = function (e) { if (e.target === w) close(); };
    $("tdx").onclick = close;
    $("tds").onclick = function () { var v = {}; Array.prototype.forEach.call(w.querySelectorAll("[data-f]"), function (x) { v[x.getAttribute("data-f")] = x.value; });
      var b = this; b.disabled = true; $("tdmsg").textContent = "Saving…";
      Promise.resolve(onSave(v)).then(function (j) { b.disabled = false; said(j); if (j && j.ok) { close(); reloadWork(); } else $("tdmsg").textContent = "Not saved: " + ((j && j.error) || "please check the fields"); })
        .catch(function () { b.disabled = false; $("tdmsg").textContent = "No connection. Try again."; said({ ok: false, error: "No connection. Your change was not saved." }); }); };
    return w;
  }
  var STG = ["Lead", "Viewing", "Offer", "Contract", "Won", "Lost"];
  function leadSheet(l) { l = l || {}; sheet(l.id ? "Edit lead" : "Add a lead", [["name", "Name"], ["phone", "WhatsApp number", "tel"], ["wants", "What they want"], ["project", "Project or building"], ["stage", "Stage", "sel", STG], ["next", "Next step"], ["due", "Next step due", "date"], ["notes", "Notes", "long"]], l,
    function (v) { return api({ action: "lead_save", id: l.id, lead: v }); }, l.id ? '<button type=button class=tb2 style="margin-top:12px;width:100%;color:#B4533C;border-color:#B4533C" id=tddel>Remove lead</button>' : "");
    var d = $("tddel"); if (d) d.onclick = function () { if (!confirm("Remove " + (l.name || "this lead") + "?")) return; api({ action: "lead_delete", id: l.id }).then(function (j) { said(j); var s = $("tdsheet"); if (s) s.parentNode.removeChild(s); load(); }); }; }
  function visitSheet(v) { v = v || {}; sheet(v.id ? "Edit meeting" : "Add a meeting or visit", [["time", "Time", "time"], ["kind", "Type", "sel", ["Developer", "Client", "Internal"]], ["with", "With (developer, client or team)"], ["notes", "Notes", "long"]], v,
    function (x) { return api({ action: "visit_save", id: v.id, time: x.time, kind: x.kind, with: x.with, notes: x.notes }); }, v.id ? '<button type=button class=tb2 style="margin-top:12px;width:100%;color:#B4533C;border-color:#B4533C" id=tddel>Remove</button>' : "");
    var d = $("tddel"); if (d) d.onclick = function () { api({ action: "visit_delete", id: v.id }).then(function (j) { said(j); var s = $("tdsheet"); if (s) s.parentNode.removeChild(s); load(); }); }; }
  function taskSheetNew() { sheet("Add a task", [["name", "Task"], ["owner", "Who owns it"], ["due", "Due", "date"], ["notes", "Notes", "long"]], {}, function (v) {
    if (!v.name) return Promise.resolve({ ok: false, error: "Name the task." });
    var D = window.D || {}, today = D.today || new Date().toISOString().slice(0, 10);
    return wapi({ action: "save", date: today, text: "New task: " + v.name + (v.notes ? ". " + v.notes : ""), entry: { title: "New task: " + v.name, type: "Organising", summary: v.notes || ("Task added from Today: " + v.name), works: [v.name], people: v.owner ? [v.owner] : [],
      progress: [{ work: v.name, status: "Started", percent: 0, owners: v.owner ? [v.owner] : [], due: v.due || "" }] } }).then(function (j) { if (j && j.ok) j.saved = "Task " + v.name + (v.due ? " · due " + v.due : ""); return j; }); }); }
  function noteSheet() { sheet("Add a note", [["text", "Note", "long"]], {}, function (v) { if (!v.text) return Promise.resolve({ ok: false, error: "Write the note." });
    var D = window.D || {}, today = D.today || new Date().toISOString().slice(0, 10);
    return wapi({ action: "save", date: today, text: v.text, entry: { title: v.text.slice(0, 80), type: "Other", summary: v.text } }).then(function (j) { if (j && j.ok) j.saved = "Note added to today's log"; return j; }); }); }
  function addMenu() { var w = document.createElement("div"); w.id = "tdsheet"; w.setAttribute("style", "position:fixed;inset:0;z-index:90;background:rgba(28,40,38,.45);display:flex;align-items:flex-end;justify-content:center");
    w.innerHTML = '<div style="background:#FFFDF9;border-radius:20px 20px 0 0;max-width:560px;width:100%;padding:16px 16px calc(18px + env(safe-area-inset-bottom))"><div style="font:600 1.08rem Fraunces,serif;color:#0A4F4A;margin-bottom:10px">Add</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
      + [["task", "Task", I.task], ["meet", "Meeting or visit", I.cal], ["lead", "Lead", I.user], ["post", "Post or story", I.post], ["note", "Note", I.chat]].map(function (a) { return '<button type=button data-am="' + a[0] + '" class=tcard>' + a[2] + "<b>" + esc(a[1]) + "</b></button>"; }).join("") + "</div></div>";
    document.body.appendChild(w); w.onclick = function (e) { var t = e.target.closest ? e.target.closest("[data-am]") : null; if (e.target === w) { w.parentNode.removeChild(w); return; } if (!t) return; w.parentNode.removeChild(w);
      var a = t.getAttribute("data-am"); if (a === "task") taskSheetNew(); else if (a === "meet") visitSheet(); else if (a === "lead") leadSheet(); else if (a === "note") noteSheet(); else location.href = "/momo/work/planner" + Q + "&add=feed"; }; }

  // ---------- drawing ----------
  function draw() {
    var W = $("wtoday2"), D = window.D; if (!W || !D || !X) return;
    var T = D.todaycard || {}, TK = D.tasks || [], today = X.today || D.today, pl = "/momo/work/planner" + Q, h = "";
    // 1 Meetings & visits: her list + today's Meeting entries + tasks due today naming a developer
    var M = (X.visits || []).map(function (v) { return { v: v, time: v.time, with: v.with, kind: v.kind, src: "visit" }; });
    (D.entries || []).forEach(function (e) { if (e.date === today && (e.type === "Meeting" || (e.prep && e.prep.developer))) M.push({ time: e.start || "", with: (e.prep && e.prep.developer) || e.title, kind: e.prep && e.prep.developer ? "Developer" : "Internal", src: "entry" }); });
    var DEV = ["Sobha", "Nakheel", "DAMAC", "Emaar", "Beyond", "Binghatti", "Arada", "Imtiaz", "Select", "Fakhruddin", "Prestige One", "Object 1", "Ellington", "Meraas", "Danube", "Aldar", "Azizi", "Omniyat", "Samana"];
    var CAL = X.cal || {}; (CAL.events || []).forEach(function (e) { var dv = DEV.filter(function (d) { return (" " + e.title + " ").toLowerCase().indexOf(" " + d.toLowerCase()) >= 0; })[0];
      M.push({ time: e.all_day ? "All day" : e.time, with: dv || e.title, kind: dv ? "Developer" : (/client|viewing|buyer|tenant|owner/i.test(e.title) ? "Client" : "Internal"), src: "cal", title: e.title, where: e.where }); });
    M.sort(function (a, b) { return String(a.time || "99").localeCompare(String(b.time || "99")); });
    TK.forEach(function (t) { if (t.status !== "Done" && t.due === today) { var dv = DEV.filter(function (d) { return (" " + t.name + " ").toLowerCase().indexOf(" " + d.toLowerCase()) >= 0; })[0]; if (dv) M.push({ time: "", with: dv, kind: "Developer", src: "task", task: t.name }); } });
    var mh = M.map(function (m, i) { var dev = m.kind === "Developer";
      var acts = (dev ? btn("Open briefing", 'data-brief="' + esc(m.with) + '" data-bt="' + esc(m.time || "") + '"', "tbp") : m.kind === "Client" ? btn("Prepare me", 'data-prep="' + esc(m.with) + '"', "tbp") : "") + btn("Record", "data-rec=1") + (m.src === "visit" ? btn("Edit", "data-ev=" + i) : "");
      return row(I.cal, esc((m.time || "--:--") + " " + m.with), (dev ? "Briefing ready" : m.kind === "Client" ? "Pack ready" : "Internal") + (m.src === "task" ? " · from your task " + esc(m.task) : "") + (m.src === "cal" ? " · " + esc(m.with !== m.title ? m.title : "your calendar") + (m.where ? " · " + esc(m.where) : "") : ""), acts); }).join("");
    if (!CAL.connected) mh += row(I.cal, CAL.broken ? "Your calendar needs reconnecting" : "Connect your Google Calendar", "One time. Momo only reads it, and your meetings show here each morning.", '<a class="tb tbp" href="/gcal/read/start' + Q + '">Connect your calendar</a>');
    h += sec(1, "Meetings & visits", mh, "No meetings yet today. + Add one, and a developer gets a briefing.");
    // 2 Broker
    var bh = "";
    (X.calls || []).forEach(function (c, i) { bh += row(I.call, "Call " + esc(c.name || "the owner"), esc(c.answer || "Campaign follow-up") + (c.opened ? " · opened the passport" : "") + (c.tries ? " · tried " + c.tries + "x" : ""), btn("Called", 'data-cm="called" data-ci=' + i, "tbp") + btn("No answer", 'data-cm="noanswer" data-ci=' + i) + btn("Tomorrow", 'data-cm="tomorrow" data-ci=' + i)); });
    (X.due || []).forEach(function (l) { bh += row(I.user, esc(l.name) + " · " + esc(l.next || l.stage), "Due " + esc(fd(l.due)) + (l.project ? " · " + esc(l.project) : ""), btn("Edit", 'data-lead="' + l.id + '"')); });
    (X.quiet || []).forEach(function (l) { var n = (l.phone || "").replace(/\D/g, ""); if (/^05\d{8}$/.test(n)) n = "971" + n.slice(1);
      var msg = "Hi " + (l.name || "").split(" ")[0] + ", Najjuko here. Just checking in" + (l.project ? " on " + l.project : "") + ". Is now a good time to talk?";
      bh += row(I.user, esc(l.name) + " has gone quiet", "Last contact " + esc(fd(l.last_contact)) + (l.project ? " · " + esc(l.project) : ""), (n ? '<a class="tb tbp" target=_blank rel=noopener data-lt="' + l.id + '" href="https://wa.me/' + n + "?text=" + encodeURIComponent(msg) + '">Message</a>' : "") + btn("Snooze 3 days", 'data-snz="' + l.id + '"') + btn("Edit", 'data-lead="' + l.id + '"')); });
    var dl = X.deals || {}, act = ["Lead", "Viewing", "Offer", "Contract"];
    bh += '<div class=tg4>' + act.map(function (s) { return '<button type=button class=tst data-stage="' + s + '"><b>' + (dl[s] || 0) + "</b><span>" + s + "</span></button>"; }).join("") + "</div>";
    (X.stock || []).forEach(function (s) { bh += row(I.home, esc(s.units) + " available at " + esc(s.project), "For your lead " + esc(s.lead) + " · from " + esc(s.developer) + "'s availability sheet" + (s.sheet_date ? " · " + esc(fd(s.sheet_date)) : "")); });
    bh += '<div class=ta style="margin-top:6px">' + btn("+ Add lead", "data-addlead=1") + btn("All leads", "data-alllead=1") + "</div>";
    h += sec(2, "Broker", bh, "");
    // 3 Strategic Lead
    var sh = "";
    TK.forEach(function (t, i) { if (t.status === "Stuck") sh += row(I.warn, esc(t.name), "Stuck" + (t.stuck_note ? " · " + esc(t.stuck_note) : "") + ((t.owners || []).length ? " · waiting on " + esc(t.owners.join(", ")) : ""), btn("Open", "data-tk=" + i) + btn("Check in", "data-tkc=" + i)); });
    TK.forEach(function (t, i) { if (t.status !== "Done" && t.status !== "Stuck" && t.due && t.due <= today) sh += row(I.task, esc(t.name), (t.due < today ? "Overdue since " : "Due ") + esc(fd(t.due)) + ((t.owners || []).length ? " · " + esc(t.owners.join(", ")) : ""), btn("Done", "data-tkd=" + i, "tbp") + btn("Check in", "data-tkc=" + i)); });
    Object.keys(D.checkins || {}).forEach(function (n) { var c = D.checkins[n]; if (c && c.at && String(c.at).slice(0, 10) >= today) sh += row(I.chat, esc(c.who || "") + ": " + esc({ done: "Done", notyet: "Not yet", stuck: "Stuck", inprogress: "In progress" }[c.ans] || c.ans || "answered"), esc(n)); });
    if (T.popups) sh += row(I.chat, T.popups + " meeting change" + (T.popups === 1 ? "" : "s") + " to answer", "From your meetings: Yes, No or Edit", btn("Answer", "data-pop=1", "tbp"));
    h += sec(3, "Strategic Lead", sh, "Nothing stuck or due today.");
    // 4 Content
    var ch = "";
    (T.posts || []).forEach(function (p) { ch += row(I.post, esc((p.time || "--:--") + " " + p.label) + " · " + esc(p.topic || "No topic yet"), p.step === "Done" ? "All steps done" : "Next: " + esc(p.step) + " · " + esc(p.owner),
      (p.step && p.step !== "Done" ? btn("Done", 'data-pd="' + esc(p.code) + '" data-ps="' + esc(p.step) + '"', "tbp") : "") + '<a class=tb href="' + pl + "&day=" + esc(p.date) + "&open=" + encodeURIComponent(p.code) + '">Open</a>'); });
    if (T.checks) { var bad = T.checks.fix || T.checks.check; ch += row(bad ? I.warn : I.task, esc(T.checks.line), bad ? "Set times, fill from meetings, or skip" : "", bad ? '<a class="tb tbp" href="' + pl + "&day=" + esc(T.checks.from || "") + '">Fix now</a>' + '<a class=tb href="' + pl + "&day=" + esc(T.checks.from || "") + '&fix=time">Set time</a>' + btn("Fill from meeting", "data-pop=1") : ""); }
    h += sec(4, "Content", ch, "No posts today.");
    // 5 Your week
    var hw = D.hoursweek || {}, wh = "";
    if (hw.total != null) { var pct = Math.min(100, Math.round((+hw.total || 0) / (+hw.min || 15) * 100));
      wh += '<div class=twk><b>' + esc(hw.total) + " / " + esc(hw.min || 15) + " h</b><span>this week</span><i style=\"width:" + pct + '%"></i></div>';
      var KD = Array.isArray(hw.kinds) ? hw.kinds.filter(function (k) { return k && +k.hours; }) : [];   // v787 - the same split as the Work page hours line (hoursPicture kinds)
      if (KD.length) wh += '<div class=tsub>' + KD.map(function (k) { return esc(k.hours) + " h " + esc(k.name === "Strategic Lead" ? "as Strategic Lead" : k.name === "Broker" ? "as a broker" : "supporting others"); }).join(" \u00b7 ") + "</div>";
      var roles = KD.length ? null : (hw.roles || hw.by_role || hw.split || null); if (roles && typeof roles === "object") wh += '<div class=tsub>' + Object.keys(roles).map(function (k) { var v = roles[k]; return esc(k) + " " + esc(typeof v === "object" ? (v.hours || v.h || "") : v) + " h"; }).join(" · ") + "</div>"; }
    var TL = D.tally || []; if (TL.length) { wh += '<div class=tg2>' + TL.map(function (k) { return '<div class="tfa' + (k.week ? "" : " t0") + '"><b>' + (k.week || 0) + "</b><span>" + esc(k.name) + "</span></div>"; }).join("") + "</div>";
      var empty = TL.filter(function (k) { return !k.week; }); if (empty.length) wh += '<div class=tnudge>' + I.warn + "<span>Nothing logged this week for <b>" + esc(empty.map(function (k) { return k.name; }).join(", ")) + "</b>. Your review counts each area.</span></div>"; }
    h += sec(5, "Your week", wh, "Log your work and your week fills in here.");
    W.innerHTML = '<div class=tcard0><div class=thd><div><div class=tk>TODAY</div><b>' + esc(fd(today)) + '</b></div><button type=button class="tb tbp" id=tdadd>' + I.plus + " Add</button></div>" + h + "</div>";
    bind(M);
  }
  function bind(M) {
    var W = $("wtoday2"), D = window.D || {}, TK = D.tasks || [];
    $("tdadd").onclick = addMenu;
    W.onclick = function (e) { var t = e.target.closest ? e.target.closest("button,a") : null; if (!t) return; var g = function (a) { return t.getAttribute(a); };
      if (g("data-brief") != null) { location.href = "/momo/work/briefing" + Q + "&dev=" + encodeURIComponent(g("data-brief")) + (g("data-bt") ? "&time=" + encodeURIComponent(g("data-bt")) : ""); return; }
      if (g("data-prep") != null) { var pb = document.getElementById("wprep") || document.querySelector("[data-prep-open],#prepbtn"); if (pb) pb.click(); else location.href = "/momo/work" + Q + "#prep"; return; }
      if (g("data-rec") != null) { location.href = "/momo/work/rec" + Q; return; }
      if (g("data-ev") != null) { var m = M[+g("data-ev")]; if (m && m.v) visitSheet(m.v); return; }
      if (g("data-cm") != null) { var c = X.calls[+g("data-ci")]; if (!c) return; var note = g("data-cm") === "called" ? (prompt("A note from the call (optional)") || "") : ""; api({ action: "call_mark", cid: c.cid, d: c.d, outcome: g("data-cm"), note: note }).then(function (j) { said(j); load(); }); return; }
      if (g("data-lead") != null) { var l = (X.leads || []).filter(function (x) { return x.id === g("data-lead"); })[0]; if (l) leadSheet(l); return; }
      if (g("data-snz") != null) { api({ action: "lead_touch", id: g("data-snz"), snooze: 3 }).then(function (j) { said(j); load(); }); return; }
      if (g("data-lt") != null) { api({ action: "lead_touch", id: g("data-lt") }).then(function () { load(); }); return; }
      if (g("data-addlead") != null) { leadSheet(); return; }
      if (g("data-alllead") != null || g("data-stage") != null) { allLeads(g("data-stage")); return; }
      if (g("data-tk") != null) { if (typeof window.taskSheet === "function") window.taskSheet(TK[+g("data-tk")]); return; }
      if (g("data-tkc") != null) { var tk = TK[+g("data-tkc")]; if (typeof window.taskSheet === "function") window.taskSheet(tk); return; }
      if (g("data-tkd") != null) { var td = TK[+g("data-tkd")]; wapi({ action: "task_progress", name: td.name, status: "Done", percent: 100 }).then(function (j) { if (j && j.ok) j.saved = td.name + " · Done"; said(j); reloadWork(); }); return; }
      if (g("data-pd") != null) { papi({ action: "tick", code: g("data-pd"), step: g("data-ps"), done: true }).then(function (j) { if (j && j.ok) j.saved = g("data-pd") + " · " + g("data-ps") + " done"; said(j); reloadWork(); }); return; }
      if (g("data-pop") != null) { var pp = document.querySelector("[data-tdpop],#msauto,[data-sync-open]"); if (pp) pp.click(); else location.href = "/momo/work/planner" + Q; return; }
    };
  }
  function allLeads(stage) { var L = (X.leads || []).filter(function (l) { return !stage || l.stage === stage; }), w = document.createElement("div"); w.id = "tdsheet";
    w.setAttribute("style", "position:fixed;inset:0;z-index:90;background:rgba(28,40,38,.45);display:flex;align-items:flex-end;justify-content:center");
    w.innerHTML = '<div style="background:#FFFDF9;border-radius:20px 20px 0 0;max-width:560px;width:100%;padding:16px;max-height:86vh;overflow:auto"><div style="font:600 1.08rem Fraunces,serif;color:#0A4F4A;margin-bottom:8px">' + esc(stage ? stage + " (" + L.length + ")" : "All leads (" + L.length + ")") + '</div><div class=tg2>'
      + (L.length ? L.map(function (l) { return '<button type=button class=tcard data-lid="' + l.id + '" style="text-align:left;align-items:flex-start"><b>' + esc(l.name) + "</b><span>" + esc(l.stage) + (l.project ? " · " + esc(l.project) : "") + "</span>" + (l.next ? "<span>Next: " + esc(l.next) + "</span>" : "") + "</button>"; }).join("") : "<div class=te>No leads here yet.</div>")
      + "</div><button type=button class=tb2 style=\"width:100%;margin-top:12px\" id=tdxl>Close</button></div>";
    document.body.appendChild(w); w.onclick = function (e) { var t = e.target.closest ? e.target.closest("[data-lid]") : null; if (e.target === w || e.target.id === "tdxl") { w.parentNode.removeChild(w); return; } if (t) { w.parentNode.removeChild(w); leadSheet(L.filter(function (l) { return l.id === t.getAttribute("data-lid"); })[0]); } }; }
  // styles once
  var css = document.createElement("style");
  css.textContent = "#wtoday{display:none}#wtoday2 .tcard0{border:1px solid #E3DDD1;border-radius:18px;background:#FFFDF9;padding:14px;margin:0 0 14px}#wtoday2 .thd{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}#wtoday2 .thd b{font:600 1.15rem Fraunces,serif;color:#0A4F4A}#wtoday2 .tk,#wtoday2 .th{font:600 .68rem IBM Plex Mono,monospace;letter-spacing:.12em;color:#8A6F3E;text-transform:uppercase}"
    + "#wtoday2 .ts{border-top:1px solid #EFE9DE;padding:10px 0 4px}#wtoday2 .th{display:flex;align-items:center;gap:8px;margin-bottom:6px}#wtoday2 .tn{display:inline-flex;width:20px;height:20px;border-radius:50%;background:#0A4F4A;color:#fff;align-items:center;justify-content:center;font-size:.66rem;letter-spacing:0}"
    + "#wtoday2 .tr{display:flex;gap:10px;align-items:flex-start;border:1px solid #EFE9DE;border-radius:14px;background:#fff;padding:10px;margin:6px 0}#wtoday2 .ti{color:#0A4F4A;flex:0 0 18px;margin-top:2px}#wtoday2 .tm{flex:1;min-width:0}#wtoday2 .tm b{display:block;font:600 .9rem IBM Plex Sans,sans-serif;color:#1C2826;overflow-wrap:anywhere}#wtoday2 .tm small{display:block;font:500 .78rem IBM Plex Sans,sans-serif;color:#5F6B66;margin-top:2px}"
    + "#wtoday2 .ta{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.tb{border:1px solid #0A4F4A;background:#fff;color:#0A4F4A;border-radius:999px;padding:7px 12px;font:600 .8rem IBM Plex Sans,sans-serif;text-decoration:none;cursor:pointer;display:inline-flex;align-items:center;gap:6px}.tbp{background:#0A4F4A;color:#fff}"
    + ".tb2{border:1px solid #0A4F4A;background:#fff;color:#0A4F4A;border-radius:999px;padding:12px;font:600 .92rem IBM Plex Sans,sans-serif;cursor:pointer}.tb2.tbp{background:#0A4F4A;color:#fff}.tcard{display:flex;flex-direction:column;align-items:center;gap:6px;border:1px solid #E3DDD1;border-radius:14px;background:#fff;padding:14px 10px;color:#0A4F4A;cursor:pointer}.tcard b{font:600 .9rem IBM Plex Sans,sans-serif}.tcard span{font:500 .76rem IBM Plex Sans,sans-serif;color:#5F6B66}"
    + "#wtoday2 .tg4{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:8px 0}.tst{border:1px solid #E3DDD1;border-radius:12px;background:#fff;padding:8px 4px;text-align:center;cursor:pointer}.tst b{display:block;font:600 1.1rem Fraunces,serif;color:#0A4F4A}.tst span{font:500 .7rem IBM Plex Sans,sans-serif;color:#5F6B66}"
    + ".tg2{display:grid;grid-template-columns:1fr 1fr;gap:8px}#wtoday2 .tfa{border:1px solid #E3DDD1;border-radius:12px;background:#fff;padding:8px 10px}#wtoday2 .tfa b{font:600 1.05rem Fraunces,serif;color:#0A4F4A;margin-right:6px}#wtoday2 .tfa span{font:500 .76rem IBM Plex Sans,sans-serif;color:#1C2826}#wtoday2 .t0{background:#FBF3EA;border-color:#E9C9A8}"
    + "#wtoday2 .twk{position:relative;border:1px solid #E3DDD1;border-radius:12px;background:#fff;padding:10px;overflow:hidden;margin-bottom:6px}#wtoday2 .twk b{font:600 1.05rem Fraunces,serif;color:#0A4F4A;position:relative}#wtoday2 .twk span{font:500 .78rem IBM Plex Sans,sans-serif;color:#5F6B66;margin-left:6px;position:relative}#wtoday2 .twk i{position:absolute;left:0;bottom:0;height:4px;background:#C5A56A}"
    + "#wtoday2 .tsub{font:500 .78rem IBM Plex Sans,sans-serif;color:#5F6B66;margin:2px 2px 8px}#wtoday2 .tnudge{display:flex;gap:8px;align-items:flex-start;background:#FBF3EA;border:1px solid #E9C9A8;border-radius:12px;padding:9px;margin-top:8px;font:500 .8rem IBM Plex Sans,sans-serif;color:#7A4A22}#wtoday2 .te{font:500 .82rem IBM Plex Sans,sans-serif;color:#8FA39B;padding:4px 2px 8px}";
  document.head.appendChild(css);
  // follow work.js: draw when its data (window.D) arrives or changes
  setInterval(function () { if (window.D && window.D !== LAST) { LAST = window.D; if (!X) load(); else draw(); } }, 600);
  load();
}
