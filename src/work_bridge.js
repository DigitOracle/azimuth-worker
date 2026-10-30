// v654 MOMO BRIDGE (Kendall, 27 Oct 2026: "build the bridge and the handover") - a JSON door for a person's OWN Claude Code, so Najjuko can run her
// work from her phone through her own agents. The bridge key travels ONLY in the header "Authorization: Bearer <key>", never in a link; a ?key= on a
// bridge address is refused. Keys live in the worker secret MOMO_BRIDGE_KEYS, comma-separated "person:key" (key at least 32 characters); deleting an
// entry revokes it at the next request. Each key opens that person's data and nothing else: najjuko = her Work (entries, tasks, plan, meetings, the
// client card); kendall = his Jobs, Speaking and GGU records (read only). Every POST needs an Idempotency-Key header (the last 500 per person are
// remembered, so a retry returns the first answer and writes nothing twice). 120 requests a minute per key. Each call is logged (person, route,
// status, time; never the content) for 14 days. Nothing here sends anything to anyone.
import { BRIDGE_LOG as L, tasksOf, applyOverrides, NAJ_PROF, profOf } from "./work_log.js";
import { workEnv, readCfg } from "./work_person.js";   // v662 - kendall's bridge key opens HIS Work, on his own keys
import { planItems, cleanItem, PLP } from "./work_plan.js";
import { readAnne } from "./work_anne.js";
import { readRec } from "./work_jobs.js";
import { readSpk } from "./work_speaking.js";
import { readGgu } from "./work_ggu.js";
import { readSheetsIndex, sheetsFor, sheetOut, bridgeSheetUpload, bridgeSheetDelete } from "./work_sheets.js";   // v675 - Product data sheets through the bridge

export const BRIDGE_BASE = "/momo/bridge/v1/";
export const RATE_PER_MIN = 120, IDEM_MAX = 500, LOG_TTL = 14 * 86400, MAX_SPAN_DAYS = 92;
const PEOPLE = ["najjuko", "kendall"];
const ROUTES = {   // route -> [method, who may call it]
  whoami: ["GET", PEOPLE], entries: ["GET", PEOPLE], entry: ["GET", PEOPLE], tasks: ["GET", PEOPLE], plan: ["GET", PEOPLE],
  meetings: ["GET", PEOPLE], meeting: ["GET", PEOPLE], anne: ["GET", ["najjuko"]], "pdf-links": ["GET", PEOPLE],
  jobs: ["GET", ["kendall"]], speaking: ["GET", ["kendall"]], ggu: ["GET", ["kendall"]],
  "post:entry": ["POST", PEOPLE], "post:task": ["POST", PEOPLE], "post:plan-item": ["POST", PEOPLE], "post:note": ["POST", PEOPLE],
  // v675 - Product data sheets (the shared pds_* store, not a person's Work keys): the loaded sheets plus the caller's own uploads
  sheets: ["GET", PEOPLE], "post:sheet": ["POST", PEOPLE], "post:sheet/delete": ["POST", PEOPLE],
};

function ctEq(a, b) { a = String(a || ""); b = String(b || ""); let r = a.length ^ b.length; for (let i = 0; i < Math.max(a.length, b.length); i++) r |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0); return r === 0; }
export function bridgePerson(env, request) {
  const h = String(request.headers.get("Authorization") || ""), m = /^Bearer\s+(\S+)$/.exec(h.trim()); if (!m) return "";
  let who = "";
  for (const e of String(env.MOMO_BRIDGE_KEYS || "").split(",")) {
    const i = e.indexOf(":"); if (i < 1) continue;
    const person = e.slice(0, i).trim(), key = e.slice(i + 1).trim();
    if (!PEOPLE.includes(person) || key.length < 32) continue;
    if (ctEq(m[1], key) && !who) who = person;   // keep looping: the time taken does not depend on which entry matched
  }
  return who;
}
async function sha(s) { const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32); }
const J = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
const ERR = (code, error, s) => J({ ok: false, code, error }, s);
const OK = (data) => J({ ok: true, data });
const dOk = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ""));
function span(url, defDays) {
  let to = dOk(url.searchParams.get("to")) ? url.searchParams.get("to") : L.dubaiToday();
  let from = dOk(url.searchParams.get("from")) ? url.searchParams.get("from") : new Date(Date.parse(to) - (defDays - 1) * 864e5).toISOString().slice(0, 10);
  if (to < from) { const x = from; from = to; to = x; }
  if ((Date.parse(to) - Date.parse(from)) / 864e5 >= MAX_SPAN_DAYS) return null;
  return [from, to];
}
async function readJson(request) { try { const b = await request.json(); return b && typeof b === "object" ? b : null; } catch (e) { return null; } }

async function rateOk(env, person) {
  const k = "brg_rl_" + person + "_" + Math.floor(Date.now() / 60000), n = Number(await env.MEETINGS.get(k)) || 0;
  if (n >= RATE_PER_MIN) return false;
  await env.MEETINGS.put(k, String(n + 1), { expirationTtl: 120 }); return true;
}
async function logCall(env, person, route, status) {
  try { await env.MEETINGS.put("brg_log_" + person + "_" + new Date().toISOString() + "_" + Math.random().toString(36).slice(2, 6), JSON.stringify({ person, route, status, at: new Date().toISOString() }), { expirationTtl: LOG_TTL }); } catch (e) {}
}
async function idemGet(env, person, h) { try { return JSON.parse(await env.MEETINGS.get("brg_idem_" + person + "_" + h)); } catch (e) { return null; } }
async function idemPut(env, person, h, status, body) {
  await env.MEETINGS.put("brg_idem_" + person + "_" + h, JSON.stringify({ status, body }));
  let idx = []; try { idx = JSON.parse(await env.MEETINGS.get("brg_idemidx_" + person)) || []; } catch (e) {}
  idx.push(h); while (idx.length > IDEM_MAX) await env.MEETINGS.delete("brg_idem_" + person + "_" + idx.shift());
  await env.MEETINGS.put("brg_idemidx_" + person, JSON.stringify(idx));
}

// the FN printable pages for one item. They open on her own Momo link (her key), which the bridge never knows or returns: her Claude hands her the
// address and she opens it with her link, or adds &key=<her link key> herself.
function pdfLinks(origin, type, id) {
  const q = encodeURIComponent(id), base = origin + "/momo/work/";
  if (type === "entry") { const m = /^(\d{4}-\d{2}-\d{2})_([a-z0-9]{1,40})$/.exec(id); if (!m) return null; return { item_pdf: base + "item/entry?id=" + q, debrief: base + "debrief?date=" + m[1] + "&id=" + m[2] }; }
  if (type === "task") return id && id.length <= 120 ? { item_pdf: base + "item/task?id=" + q } : null;
  if (type === "meeting") { const r = L.recId(id); return r ? { item_pdf: base + "item/meeting?id=" + r, minutes: base + "rec/minutes?id=" + r } : null; }
  if (type === "report") { const m = /^(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/.exec(id); return m ? { report: base + "report?from=" + m[1] + "&to=" + m[2] } : null; }
  if (type === "plan-week") return dOk(id) ? { week: base + "plan/week?from=" + id } : null;
  if (type === "plan-month") return /^\d{4}-\d{2}$/.test(id) ? { month: base + "plan/month?month=" + id } : null;
  return null;
}
const entryId = (e) => e.date + "_" + e.id;
const meetingOut = (m) => ({ id: m.id, title: m.title || "Recording", date: m.date, started_hm: m.started_hm || "", status: m.status || "", secs: m.secs || 0, attendees: m.attendees || [], notes: m.notes || null, minutes: m.minutes || null, added_notes: m.added_notes || [] });
// v656 - the meeting with its transcript (Momo's own speech-to-text: the recs_<id>_<nnn> parts joined with [mm:ss] markers) and the minutes in a fixed
// shape: { title, purpose, decisions[{headline, detail}], discussion[{heading, bullets[]}], actions[{action, owner, due, due_stated}], open_questions[] }
const TX_MAX = 400000;
const arr = (v) => (Array.isArray(v) ? v : []);
const minutesOut = (x) => (x && typeof x === "object" ? { title: String(x.title || ""), purpose: String(x.purpose || ""),
  decisions: arr(x.decisions).map((d) => ({ headline: String((d && d.headline) || ""), detail: String((d && d.detail) || "") })),
  discussion: arr(x.discussion).map((d) => ({ heading: String((d && d.heading) || ""), bullets: arr(d && d.bullets).map(String) })),
  actions: arr(x.actions).map((a) => ({ action: String((a && a.action) || ""), owner: String((a && a.owner) || ""), due: String((a && a.due) || ""), due_stated: !!(a && a.due_stated) })),
  open_questions: arr(x.open_questions).map(String) } : null);
async function meetingFull(env, m) {
  const tx = L.recTranscriptText(await L.recSegs(env, m.id), true, m), o = meetingOut(m);   // v663 - lines carry the named speakers when the recording has them
  o.speakers = L.speakersOut(m);   // v663 - [{ id, name, shown_as, confidence, confirmed, labels }], [] for a recording without speaker data
  o.minutes = minutesOut(m.minutes); o.transcript_chars = tx.length;
  o.transcript_status = !tx.trim() ? "not_transcribed" : tx.length > TX_MAX ? "too_long_truncated" : "ready";
  o.transcript = tx.slice(0, TX_MAX);
  return o;
}

// v662 - the Work routes run on the caller's own Work keys (her legacy keys for najjuko, parallel keys for kendall); never on anyone else's
const WORK_ROUTES = new Set(["entries", "entry", "tasks", "plan", "meetings", "meeting", "post:entry", "post:task", "post:plan-item", "post:note"]);
async function workSide(env, person) {
  const w = workEnv(env, person);
  if (person !== "najjuko" && !(await w.MEETINGS.get("work_naj_planseed"))) await w.MEETINGS.put("work_naj_planseed", "1");   // her campaign seed never lands in his plan
  return w;
}
async function doGet(env, url, person, route) {
  if (WORK_ROUTES.has(route)) env = await workSide(env, person);
  if (route === "whoami") return OK({ person, routes: Object.keys(ROUTES).filter((r) => ROUTES[r][1].includes(person)).map((r) => (ROUTES[r][0] + " " + BRIDGE_BASE + r.replace(/^post:/, ""))), limits: { per_minute: RATE_PER_MIN, max_span_days: MAX_SPAN_DAYS } });
  if (route === "entries") {
    const sp = span(url, 7); if (!sp) return ERR("span_too_long", "Ask for at most " + MAX_SPAN_DAYS + " days at a time.", 400);
    const es = await L.listEntries(env, sp[0], sp[1]);
    return OK({ from: sp[0], to: sp[1], entries: es.filter((e) => e && e.id && dOk(e.date)).map((e) => Object.assign({ ref: entryId(e) }, e)) });
  }
  if (route === "entry") {
    const m = /^(\d{4}-\d{2}-\d{2})_([a-z0-9]{1,40})$/.exec(String(url.searchParams.get("id") || "")); if (!m) return ERR("bad_id", "id is <date>_<id>, as /entries gives it in ref.", 400);
    let e = null; try { e = JSON.parse(await env.MEETINGS.get(L.PFX + m[1] + "_" + m[2])); } catch (x) {}
    return e ? OK(Object.assign({ ref: entryId(e) }, e)) : ERR("not_found", "No entry with that id.", 404);
  }
  if (route === "tasks") {
    return OK({ tasks: applyOverrides(tasksOf(await L.listEntries(env, "2000-01-01", "2999-12-31")), await L.taskOverrides(env)), statuses: L.STATUS });
  }
  if (route === "plan") {
    const sp = span(url, 31); if (!sp) return ERR("span_too_long", "Ask for at most " + MAX_SPAN_DAYS + " days at a time.", 400);
    const all = await planItems(env);
    return OK({ from: sp[0], to: sp[1], items: all.filter((i) => i.undated || (i.end >= sp[0] && i.start <= sp[1])) });
  }
  if (route === "meetings") {
    const sp = span(url, 31); if (!sp) return ERR("span_too_long", "Ask for at most " + MAX_SPAN_DAYS + " days at a time.", 400);
    const ids = []; let cursor;
    do { const r = await env.MEETINGS.list({ prefix: L.RECW, cursor }); cursor = r.list_complete ? null : r.cursor; for (const k of r.keys) ids.push(k.name.slice(L.RECW.length)); } while (cursor);
    const ms = (await Promise.all(ids.map((x) => L.recGet(env, x)))).filter((m) => m && m.date >= sp[0] && m.date <= sp[1]);
    return OK({ from: sp[0], to: sp[1], meetings: ms.sort((a, b) => (String(a.started || a.date) < String(b.started || b.date) ? 1 : -1)).map((m) => ({ id: m.id, title: m.title || "Recording", date: m.date, started_hm: m.started_hm || "", status: m.status || "", secs: m.secs || 0, has_notes: !!(m.notes && m.notes.summary), has_minutes: !!m.minutes })) });
  }
  if (route === "meeting") {
    const id = L.recId(url.searchParams.get("id")), m = id ? await L.recGet(env, id) : null;
    return m ? OK(await meetingFull(env, m)) : ERR("not_found", "No meeting with that id.", 404);
  }
  if (route === "anne") { const a = await readAnne(env); return a ? OK(a) : ERR("not_found", "There is no client card.", 404); }
  if (route === "pdf-links") {
    const links = pdfLinks(url.origin, String(url.searchParams.get("type") || ""), String(url.searchParams.get("id") || ""));
    if (!links) return ERR("bad_item", "type is entry, task, meeting, report (id from_to), plan-week (id = Monday) or plan-month (id = YYYY-MM).", 400);
    return OK({ links, open_with: "These pages open on the person's own Momo link. Give them the address; they open it with their link (or add &key=<their link key>). The bridge key does not open them." });
  }
  if (route === "sheets") return OK({ sheets: sheetsFor(await readSheetsIndex(env), person).map((e) => sheetOut(e, url.origin)), max_bytes: 12 * 1024 * 1024, accepts: ["image/png", "image/jpeg", "image/webp", "application/pdf"] });   // v675
  if (route === "jobs") { const r = await readRec(env, person); return OK(r || null); }
  if (route === "speaking") { const r = await readSpk(env, person); return OK(r || null); }
  if (route === "ggu") { const r = await readGgu(env, person); return OK(r || null); }
  return ERR("not_found", "Unknown route.", 404);
}

async function doPost(env, b, person, route, origin) {
  if (route === "post:sheet") return bridgeSheetUpload(env, person, b, origin);   // v675 - sniffed by content, at most 12 MB, index merged by slug
  if (route === "post:sheet/delete") return bridgeSheetDelete(env, person, b);   // v675 - only the uploader
  const now = new Date().toISOString(), prof = person === "najjuko" ? NAJ_PROF : profOf(await readCfg(env, person));
  if (WORK_ROUTES.has(route)) env = await workSide(env, person);
  if (route === "post:entry") {
    const date = dOk(b.date) ? b.date : L.dubaiToday(), e = L.clean(b.entry || {}, prof);
    if (!e.title && !String(b.text || "").trim()) return [400, { ok: false, code: "empty", error: "An entry needs a title or text." }];
    const id = String(b.id || "").replace(/[^a-z0-9]/g, "").slice(0, 16) || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
    let prev = null; if (b.id) { try { prev = JSON.parse(await env.MEETINGS.get(L.PFX + (dOk(b.oldDate) ? b.oldDate : date) + "_" + id)); } catch (x) {} }
    const rec = { id, date, text: String(b.text || "").slice(0, 4000), link: /^https?:\/\//.test(String(b.link || "")) ? String(b.link).slice(0, 500) : "", ...e, check: false, created: (prev && prev.created) || now, updated: now, via: "bridge" };
    if (b.id && dOk(b.oldDate) && b.oldDate !== date) await env.MEETINGS.delete(L.PFX + b.oldDate + "_" + id);
    await env.MEETINGS.put(L.PFX + date + "_" + id, JSON.stringify(rec));
    return [200, { ok: true, data: Object.assign({ ref: entryId(rec) }, rec) }];
  }
  if (route === "post:task") {
    const name = String(b.name || "").trim().slice(0, 80); if (!name) return [400, { ok: false, code: "bad_task", error: "Which task? Send name." }];
    // v674 - the same record rule as her progress sheet: "Waiting on others" arrives as Stuck (reason "Waiting on someone"), a stuck reason she set is
    // kept when the sync re-sends Stuck, and leaving Stuck closes the stuck period. reason/control/note are optional here.
    let prev = null; try { prev = JSON.parse((await env.MEETINGS.get(L.TPFX + L.slug(name))) || "null"); } catch (e) {}
    const rec = L.taskRecord(prev, b, now, false).rec;
    await env.MEETINGS.put(L.TPFX + L.slug(name), JSON.stringify(rec)); return [200, { ok: true, data: rec }];
  }
  if (route === "post:plan-item") {
    const it = cleanItem(b.item || {}, String((b.item || {}).id || "").replace(/[^a-z0-9_]/gi, "").slice(0, 40) || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6)));
    if (!it.title) return [400, { ok: false, code: "no_title", error: "A plan item needs a title." }];
    delete it.suggest; await env.MEETINGS.put(PLP + it.id, JSON.stringify(it)); return [200, { ok: true, data: it }];
  }
  if (route === "post:note") {
    const text = String(b.text || "").trim().slice(0, 2000); if (!text) return [400, { ok: false, code: "empty", error: "Send text." }];
    const note = { at: now, text };
    if (b.link != null) {   // v656 - an optional tappable link, https only
      const u = String((b.link && b.link.url) || "").trim(), lb = String((b.link && b.link.label) || "").trim().slice(0, 80);
      if (!/^https:\/\/[^\s<>"']+$/.test(u) || u.length > 500) return [400, { ok: false, code: "bad_link", error: "link.url must be an https address of at most 500 characters." }];
      note.link = { url: u, label: lb || "Open" };
    }
    if (b.type === "meeting") {
      const id = L.recId(b.id), m = id ? await L.recGet(env, id) : null; if (!m) return [404, { ok: false, code: "not_found", error: "No meeting with that id." }];
      m.added_notes = (m.added_notes || []).concat(note).slice(-50); await L.recPut(env, m); return [200, { ok: true, data: meetingOut(m) }];
    }
    if (b.type === "entry") {
      const mm = /^(\d{4}-\d{2}-\d{2})_([a-z0-9]{1,40})$/.exec(String(b.id || "")); if (!mm) return [400, { ok: false, code: "bad_id", error: "id is <date>_<id>." }];
      let e = null; try { e = JSON.parse(await env.MEETINGS.get(L.PFX + mm[1] + "_" + mm[2])); } catch (x) {}
      if (!e) return [404, { ok: false, code: "not_found", error: "No entry with that id." }];
      e.text = (String(e.text || "") + (e.text ? "\n" : "") + "[" + now.slice(0, 16).replace("T", " ") + "] " + text + (note.link ? " " + note.link.label + ": " + note.link.url : "")).slice(-6000); e.updated = now;
      await env.MEETINGS.put(L.PFX + mm[1] + "_" + mm[2], JSON.stringify(e)); return [200, { ok: true, data: Object.assign({ ref: entryId(e) }, e) }];
    }
    return [400, { ok: false, code: "bad_type", error: "type is meeting or entry." }];
  }
  return [404, { ok: false, code: "not_found", error: "Unknown route." }];
}

export async function bridgeRoute(request, env, url) {
  if (!url.pathname.startsWith(BRIDGE_BASE)) return null;
  const name = url.pathname.slice(BRIDGE_BASE.length).replace(/\/+$/, ""), method = request.method;
  if (url.searchParams.has("key") || url.searchParams.has("token")) return ERR("key_in_url", "The bridge key goes in the Authorization header, never in the address.", 400);
  const person = bridgePerson(env, request);
  if (!person) return ERR("unauthorized", "Send Authorization: Bearer <your bridge key>.", 401);
  const route = method === "POST" ? "post:" + name : name, spec = ROUTES[route];
  if (!(await rateOk(env, person))) { await logCall(env, person, route, 429); return ERR("rate_limited", "Slow down: " + RATE_PER_MIN + " requests a minute.", 429); }
  let res;
  if (!spec || spec[0] !== method) res = ERR("not_found", "Unknown route.", 404);
  else if (!spec[1].includes(person)) res = ERR("forbidden", "This key does not open that.", 403);
  else if (method === "GET") res = await doGet(env, url, person, route);
  else {
    const ik = String(request.headers.get("Idempotency-Key") || "").trim();
    if (ik.length < 8 || ik.length > 200) res = ERR("idempotency_key", "Every POST needs an Idempotency-Key header (8-200 characters, new for each new write).", 400);
    else {
      const h = await sha(route + "|" + ik), seen = await idemGet(env, person, h);
      if (seen) { res = new Response(JSON.stringify(seen.body), { status: seen.status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "Idempotent-Replay": "true" } }); }
      else {
        const b = await readJson(request);
        if (!b) res = ERR("bad_json", "Send a JSON body.", 400);
        else { const [s, body] = await doPost(env, b, person, route, url.origin); if (s < 500) await idemPut(env, person, h, s, body); res = J(body, s); }
      }
    }
  }
  await logCall(env, person, route, res.status);
  return res;
}
