// v624 - Momo Work, Plan > Team (Kendall, 24 Oct 2026): what the FN marketing team is doing, read from the FN Realty production sheet.
// The sheet is the single source of truth and is READ ONLY here: nothing in Momo ever writes to it. Whoever owns the sheet changes it. Najjuko sees who has open work, what is finished lately,
// and which tasks have nobody named; the "needs a person" list has a report page she can save as a PDF and hand to the sheet's owner herself (Momo sends nothing).
// The sheet id is NOT in this file (the repo is public and the sheet is open to anyone with its link): it lives in KV under work_naj_cfg_sheet (set once by Kendall).
// The parsed copy lives in KV work_naj_team_model and is refreshed when it is older than STALE_MS and Najjuko opens Team (no cron, nothing runs when nobody looks).
const KEY_CFG = "work_naj_cfg_sheet", KEY_DAILY = "work_naj_cfg_daily_tab",KEY_MODEL = "work_naj_team_model", STALE_MS = 4 * 3600e3, RECENT_DAYS = 10;
const TABS = { design: "Graphic Design", motion: "Motion Graphics" };

export function parseCsv(text) {
  const rows = []; let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else if (c !== "\r") cur += c;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
function pd(s) {
  const m = String(s || "").trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (!m) return null;
  let y = +m[3]; if (y < 100) y += 2000;
  const d = new Date(Date.UTC(y, +m[2] - 1, +m[1]));
  return isNaN(d.getTime()) ? null : d;
}
const low = (s) => String(s || "").trim().toLowerCase();
const clean = (s) => String(s || "").replace(/\s+/g, " ").trim().slice(0, 140);
const nameKey = (s) => low(s).replace(/[^a-z0-9]+/g, " ").trim();

// tab rows -> tasks, with the column positions checked against the header so a changed sheet is noticed, not guessed
export function readDesign(rows) {
  const h = (rows[0] || []).map(low);
  if (h[0] !== "task" || h[2] !== "start date" || h[4] !== "status") return { warn: "The Graphic Design tab has different columns than expected." };
  const tasks = [];
  rows.slice(1).forEach((r, i) => {
    const task = clean(r[0]); if (!task) return;
    const st = low(r[4]), rel = low(r[5]);
    tasks.push({ tab: TABS.design, row: i + 2, task, who: clean(r[3]), start: pd(r[2]), done: st === "approved" || st === "completed" || rel === "released", cancelled: st === "cancelled", status: clean(r[4]) });
  });
  return { tasks };
}
export function readMotion(rows) {
  const h = (rows[0] || []).map(low);
  if (h[0] !== "task" || h[2] !== "status" || h[3] !== "editor") return { warn: "The Motion Graphics tab has different columns than expected." };
  const tasks = [];
  rows.slice(1).forEach((r, i) => {
    const task = clean(r[0]); if (!task) return;
    const st = low(r[2]), rel = low(r[6]);
    tasks.push({ tab: TABS.motion, row: i + 2, task, who: clean(r[3]), start: pd(r[5]) || pd(r[7]), released: pd(r[7]), done: st === "approved" || st === "completed" || rel === "released", cancelled: st === "cancelled" || rel === "cancelled", status: clean(r[2]) });
  });
  return { tasks };
}
export function readDaily(rows, who) {
  const out = [];
  rows.slice(1).forEach((r) => { const d = pd(r[0]), t = String(r[1] || "").trim(); if (d && t) out.push({ date: d.toISOString().slice(0, 10), text: t.split(/\n+/).map((x) => clean(x.replace(/^\d+\.\s*/, ""))).filter(Boolean).slice(0, 5) }); });
  return { who, entries: out.slice(-3) };
}

export function buildModel(parts, now) {
  const warn = [parts.design.warn, parts.motion.warn].filter(Boolean);
  const tasks = [].concat(parts.design.tasks || [], parts.motion.tasks || []).filter((t) => !t.cancelled);
  const recent = (t) => { const d = t.tab === TABS.motion ? (t.released || t.start) : t.start; return t.done && d && (now - d.getTime()) / 86400e3 <= RECENT_DAYS && (now - d.getTime()) >= -86400e3; };
  const people = new Map();
  const get = (who, tab) => { const k = nameKey(who); if (!people.has(k)) people.set(k, { name: who, tabs: new Set(), open: [], recent: 0, notes: [] }); const p = people.get(k); p.tabs.add(tab); return p; };
  const needs = [];
  tasks.forEach((t) => {
    if (!t.who) { if (!t.done) needs.push({ task: t.task, tab: t.tab, row: t.row }); return; }
    const p = get(t.who, t.tab);
    if (!t.done) p.open.push({ task: t.task, tab: t.tab, status: t.status || "Not started" });
    else if (recent(t)) p.recent++;
  });
  (parts.daily || []).forEach((d) => { if (d.who && d.entries.length) { const p = get(d.who, TABS.motion); p.notes = d.entries; } });
  const group = (tab, role) => ({
    role,
    people: [...people.values()].filter((p) => p.tabs.has(tab) && (tab === TABS.design || p.open.length || p.recent || p.notes.length))
      .sort((a, b) => b.open.length - a.open.length || a.name.localeCompare(b.name)).map((p) => ({ name: p.name, open: p.open.length, recent: p.recent }))
  });
  return {
    updated: new Date(now).toISOString(), warn: warn.join(" "),
    groups: [group(TABS.design, "Graphic design"), group(TABS.motion, "Video"), { role: "Photography", people: [] }],
    needs, people: Object.fromEntries([...people.values()].map((p) => [p.name, { name: p.name, open: p.open, recent: p.recent, notes: p.notes }]))
  };
}

async function readSheet(env, deps, id) {
  const get = async (name) => {
    const u = "https://docs.google.com/spreadsheets/d/" + encodeURIComponent(id) + "/gviz/tq?tqx=out:csv&sheet=" + encodeURIComponent(name);
    const t = deps && deps.fetchText ? await deps.fetchText(u) : await (await fetch(u, { redirect: "follow", headers: { "User-Agent": "momo-work-readonly" } })).text();
    if (/<html|<!doctype/i.test(t.slice(0, 200))) throw new Error("The sheet did not answer with data (is it still shared by link?)");
    return parseCsv(t);
  };
  // the daily-tasks tab (one editor's day-by-day list) is named in KV, never in this public file: work_naj_cfg_daily_tab = "<Name> Daily task"; unset = that tab is skipped quietly
  let tab = ""; try { tab = String((await env.MEETINGS.get(KEY_DAILY)) || "").trim().slice(0, 80); } catch (e) {}
  const who = tab.replace(/\s*daily.*$/i, "").trim();
  const [design, motion, daily] = await Promise.all([get(TABS.design), get(TABS.motion), tab && who ? get(tab).catch(() => []) : Promise.resolve([])]);
  return { design: readDesign(design), motion: readMotion(motion), daily: daily.length ? [readDaily(daily, who)] : [] };
}

export async function loadModel(env, deps, force) {
  let id = null; try { id = (await env.MEETINGS.get(KEY_CFG)) || ""; } catch (e) {}
  id = String(id || "").replace(/[^A-Za-z0-9_\-]/g, "");
  if (!id) return { error: "not_connected" };
  let saved = null; try { saved = JSON.parse(await env.MEETINGS.get(KEY_MODEL)); } catch (e) {}
  const now = deps && deps.now ? deps.now() : Date.now();
  if (saved && saved.model && !force && now - Date.parse(saved.fetched_at) < STALE_MS) return { model: saved.model, fetched_at: saved.fetched_at };
  try {
    const parts = await readSheet(env, deps, id);
    if (parts.design.warn && parts.motion.warn && saved && saved.model) throw new Error(parts.design.warn);
    const model = buildModel(parts, now), rec = { fetched_at: new Date(now).toISOString(), model };
    await env.MEETINGS.put(KEY_MODEL, JSON.stringify(rec));
    return { model, fetched_at: rec.fetched_at };
  } catch (e) {
    if (saved && saved.model) return { model: saved.model, fetched_at: saved.fetched_at, stale: String(e.message || e).slice(0, 120) };
    return { error: "unreachable", detail: String(e.message || e).slice(0, 120) };
  }
}

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmtDate = (iso) => { const d = new Date(iso); return d.getUTCDate() + " " + ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()] + " " + d.getUTCFullYear(); };

function reportHtml(r, key) {
  const m = r.model, back = "/momo/work/plan?key=" + encodeURIComponent(key);
  const rows = m.needs.map((n) => "<tr><td>" + esc(n.task) + "</td><td>" + esc(n.tab) + "</td><td>row " + n.row + "</td></tr>").join("");
  const text = "FN Realty Graphic Tasks 2026: tasks with nobody named (" + fmtDate(m.updated) + ")\n\n" + m.needs.map((n, i) => (i + 1) + ". " + n.task + " (" + n.tab + ", row " + n.row + ")").join("\n") + "\n\nPlease add a name next to each in the sheet.";
  const js = "<script>var T=" + JSON.stringify(text).replace(/</g, "\\u003c") + ";document.getElementById('sv').onclick=function(){var d={title:document.title,text:T};if(navigator.share){navigator.share(d).catch(function(){})}else if(navigator.clipboard){navigator.clipboard.writeText(T).then(function(){alert('Copied. Paste it where you want it.')})}else{alert('Use Share / Save as PDF')}}</script>";
  return "<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'><title>Tasks with nobody named</title><meta name=robots content=noindex><style>body{font:16px/1.5 'IBM Plex Sans',system-ui,sans-serif;color:#1C2321;background:#FAF7F1;margin:0;padding:0 16px 80px}.w{max-width:720px;margin:0 auto;padding-top:12px}.bar{position:sticky;top:0;background:#FAF7F1;display:flex;align-items:center;gap:8px;padding:10px 0;max-width:720px;margin:0 auto;border-bottom:1px solid #E3DDD1}.sp{flex:1}.bk{color:#0A4F4A;text-decoration:none;font-weight:600;padding:8px 10px}.bt{font:inherit;font-size:.9rem;padding:9px 14px;border-radius:12px;border:1px solid #0A4F4A;background:#fff;color:#0A4F4A}.bt.pr{background:#0A4F4A;color:#fff}h1{color:#0A4F4A;margin:8px 0 4px;font-size:1.3rem}.m{color:#626B78;font-size:.9rem}table{width:100%;border-collapse:collapse;margin-top:14px;background:#fff;border:1px solid #E3DDD1}td{padding:10px 12px;border-bottom:1px solid #EFE9DC;font-size:.95rem;vertical-align:top}td:nth-child(n+2){color:#626B78;white-space:nowrap}@media print{body{background:#fff}.bar{display:none}}</style></head><body>"
    + "<div class=bar><a class=bk href='" + back + "' onclick=\"if(history.length>1){history.back();return false}\">&#8592; Back</a><span class=sp></span><button class=bt id=sv>Share</button><button class='bt pr' onclick='print()'>Share / Save as PDF</button></div>"
    + "<div class=w><h1>Tasks with nobody named</h1><p class=m>FN Realty Graphic Tasks 2026 · read on " + esc(fmtDate(m.updated)) + " · for the owner of the sheet</p>"
    + (m.needs.length ? "<p>" + m.needs.length + " open " + (m.needs.length === 1 ? "task has" : "tasks have") + " no designer or editor named. Please add a name next to each one in the sheet.</p><table>" + rows + "</table>" : "<p>Every open task has a name next to it.</p>")
    + "</div>" + js + "</body></html>";
}

export async function teamRoute(request, env, url, deps) {
  const p = url.pathname, key = url.searchParams.get("key") || "";
  const J = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  if (p === "/momo/work/team/api") return J(await loadModel(env, deps, false));
  if (p === "/momo/work/team/report") {
    const r = await loadModel(env, deps, false);
    if (!r.model) return new Response("The FN sheet is not connected.", { status: 404 });
    return new Response(reportHtml(r, key), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  }
  return new Response("not found", { status: 404 });
}

// client side (runs inside the Plan page script; no backticks and no dollar-brace in here: it is a String.raw template)
export const TEAM_JS = String.raw`
var TM=null,TMV="home";
function tmAgo(iso){var m=Math.round((Date.now()-Date.parse(iso))/60000);return m<2?"just now":m<90?m+" min ago":m<1440?Math.round(m/60)+" h ago":"on "+new Date(iso).toISOString().slice(0,10)}
function tmBack(){return '<a href="#" id=tmb style="display:inline-block;color:#0A4F4A;font-weight:600;text-decoration:none;padding:4px 0 10px">&#8592; Team</a>'}
function tmRow(l,r,id){return '<div class=ent'+(id?' data-p="'+esc(id)+'" style="cursor:pointer"':'')+' style="padding:12px;margin:0 0 8px"><div style="display:flex;align-items:baseline;gap:8px"><b style="font-weight:500;flex:1">'+esc(l)+'</b><span class=m>'+esc(r)+'</span></div></div>'}
function drawTeam(){var el=$("pbody");
 if(!TM){el.innerHTML='<div class=line>Reading the FN sheet...</div>';fetch("/momo/work/team/api?key="+encodeURIComponent(KEY)).then(function(r){return r.json()}).then(function(j){TM=j;draw()}).catch(function(){TM={error:"unreachable"};draw()});return}
 if(TM.error==="not_connected"){el.innerHTML='<div class=empty><p>The FN sheet is not connected yet.</p></div>';return}
 if(TM.error){el.innerHTML='<div class=empty><p>The FN sheet did not answer just now. Try again in a little while.</p></div>';return}
 var m=TM.model,h="";
 if(TMV==="need"){h=tmBack()+'<h2 style="margin:0 0 4px">'+m.needs.length+' task'+(m.needs.length===1?'':'s')+' with nobody named</h2><div class=m style="margin-bottom:10px">Name a person in the FN sheet and it moves to them.</div>'+m.needs.map(function(n){return '<div class=ent style="padding:12px;margin:0 0 8px"><div>'+esc(n.task)+'</div><div class=m>'+esc(n.tab)+' · row '+n.row+'</div></div>'}).join("")+'<a class=ghost target=_blank style="display:block;text-align:center;text-decoration:none;margin-top:12px" href="/momo/work/team/report?key='+encodeURIComponent(KEY)+'">Share / Save as PDF</a>'}
 else if(TMV!=="home"&&m.people[TMV]){var p=m.people[TMV];h=tmBack()+'<h2 style="margin:0 0 10px">'+esc(p.name)+'</h2>'+(p.open.length?'<div class=m style="margin-bottom:6px">Open · '+p.open.length+'</div>'+p.open.map(function(o){return '<div class=ent style="padding:12px;margin:0 0 8px"><div>'+esc(o.task)+'</div><div class=m>'+esc(o.tab)+' · '+esc(o.status)+'</div></div>'}).join(""):'<div class=line>Nothing open.</div>')+(p.recent?'<div class=m style="margin-top:10px">Finished lately: '+p.recent+'</div>':'')+(p.notes&&p.notes.length?'<div class=m style="margin:14px 0 6px">Latest notes</div>'+p.notes.map(function(n){return '<div class=ent style="padding:12px;margin:0 0 8px"><div class=m>'+esc(n.date)+'</div><div>'+n.text.map(esc).join("<br>")+'</div></div>'}).join(""):'')}
 else{h=(m.needs.length?'<div class=ent id=tmn style="padding:14px;margin:0 0 12px;cursor:pointer;border-color:#C5A56A"><div class=m>Needs a person</div><div style="font-size:1.1rem">'+m.needs.length+' task'+(m.needs.length===1?'':'s')+'</div><div class=m>Nobody is named on them in the sheet yet</div></div>':'<div class=line style="margin:0 0 12px">Every open task has a name next to it.</div>')
  +m.groups.map(function(g){return '<div class=m style="margin:12px 0 6px">'+esc(g.role)+'</div>'+(g.people.length?g.people.map(function(p){return tmRow(p.name,p.open?p.open+' open':'All done',p.name)}).join(""):'<div class=line>Nothing in the sheet</div>')}).join("")
  +(TM.stale?'<div class=m style="margin-top:12px">The sheet did not answer just now, so this is the copy from '+tmAgo(TM.fetched_at)+'.</div>':'')+'<div class=m style="text-align:center;margin-top:14px">Updated '+tmAgo(TM.fetched_at)+(m.warn?' · '+esc(m.warn):'')+'</div>'}
 el.innerHTML=h;var b=$("tmb");if(b)b.onclick=function(e){e.preventDefault();TMV="home";draw()};var n=$("tmn");if(n)n.onclick=function(){TMV="need";draw()};
 el.querySelectorAll("[data-p]").forEach(function(x){x.onclick=function(){TMV=x.getAttribute("data-p");draw()}})}
`;
