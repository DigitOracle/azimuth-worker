// v564 MOMO WORK (Kendall 14 Oct 2026): Najjuko's FN Realty work log. "For each day ... any meetings, any updates, anything she
// organizes, anything that she does ... enter in that activity, and then it needs to map directly to her KPIs ... and FN Realty's
// overall goals ... at the end of the week, she could create a report of her activities."
// Private to Najjuko's own link (Kendall's choice, 14 Oct): nobody else, the owner included, can read the log.
// The reference data below comes from "FN Realty – HANDOVER.md" (14 Oct 2026): contract V1.2 Schedule 1 (scope), Schedule 2 (review
// framework, soft ratings, no weights) and org chart draft v8. No ID numbers, salary slips or personal documents are held here.

export const KPIS = [
  { id: 1, name: "Marketing direction", good: "A clear marketing strategy guiding activity; a sharper, more consistent advisory story", ev: "Strategy and plan shared with leadership; regular updates" },
  { id: 2, name: "Content & creative", good: "A steady content rhythm; a recognisable look; video directed and produced with the videographer", ev: "Content calendar; published content" },
  { id: 3, name: "Digital growth", good: "Reach, engagement and community on @fn.realty trending up against the Sept 2026 audit (2,785 followers; median 54 engagements a post)", ev: "Instagram and Meta insights, read as a trend" },
  { id: 4, name: "PR & leadership visibility", good: "Key messages agreed; media relationships started; stories pitched; leaders more visible", ev: "Pitch and activity log; coverage, appearances, articles" },
  { id: 5, name: "Growth, visibility & partnerships", good: "Opportunities identified and shared; speaking building the profile; relationships and AI ideas brought in", ev: "Opportunity notes, engagement log, introductions" },
];
export const SCOPE = [
  { id: "m1", area: "Marketing", name: "Marketing" }, { id: "m2", area: "Marketing", name: "Content & Creative Production" },
  { id: "m3", area: "Marketing", name: "Digital Growth & Distribution" }, { id: "p1", area: "PR", name: "PR Strategy" },
  { id: "p2", area: "PR", name: "Media Relations & Press Office" }, { id: "p3", area: "PR", name: "Leadership Visibility & Thought Leadership" },
  { id: "p4", area: "PR", name: "Stakeholder & Community Relations" }, { id: "b1", area: "Business Development", name: "Growth Strategy & Markets" },
  { id: "b2", area: "Business Development", name: "Strategic Visibility & Partnerships" }, { id: "b3", area: "Business Development", name: "AI-Enabled Growth" },
  { id: "b4", area: "Business Development", name: "Events & Community Impact" },
];
export const PEOPLE = [
  ["Ali Kalhor", "Managing Director (her manager)", "manager"], ["Faez Noorzad", "General Manager, part-owner", "owner"], ["Sultan Ahmad Noorzad", "Co-Founder", "owner"],
  ["Sousan Khatibzadeh", "Social Media Management", "team"], ["Vishant Singh", "Editor / Head of Visuals", "team"], ["Monaza", "Graphic Designer (remote)", "team"],
  ["Nare Kirakosyan", "On-camera presenter", "team"], ["Akash", "Lead Generation & Campaigns (dotted line)", "dotted"], ["Karim", "Video editing support", "team"],
  ["Fatu", "External consultant, sales structure (dotted line)", "dotted"], ["Ilona Dorothy Biro", "Team Leader, Premium team; Business Development", "peer"],
  ["Ruzanna Avanyan (Rose)", "Sales Team Leader", "sales"], ["Ellie", "Sales Team Leader", "sales"], ["Savia Gomes", "HR, Admin & Compliance", "admin"],
  ["Khadija", "Temporary HR cover", "admin"], ["Jaffer", "PRO (government relations)", "admin"], ["Mekhrona Sharipova", "Front desk", "admin"],
  ["Raihana Taheri", "Office assistant", "admin"], ["Nousheen", "PR contact", "external"], ["Babak Hassan", "Premium team", "sales"],
  // v564 (Kendall 14 Oct: "the breast cancer ... directly touches the employee Sally ... interrogate it to ensure that you're capturing everything") - every agent by name
  ...["Revant Vaish", "Hanieh Haghighi", "Youssef Farouk", "Adnan Shafi", "Najibullah Musa Jan", "Sally Zehil", "Irfan Sayyed", "Akrama Ahmad Ijaz", "Abubakar Irfan", "Hafiz Muhammad", "Parminder Kaur", "Seyedeh Elham"].map((n) => [n, "Sales agent, Rose's team", "sales"]),
  ...["Hussien Alfayadh", "Igwenagha Ogochukwu", "Mina Rahimi", "Charry Enriquez Poquita", "Sadaf Kazi", "Sunny Fernandes", "Amir Nadiri", "Syed Ali Mudassir", "Simran Singh", "Haidy Essam", "Khatija Musa Habib"].map((n) => [n, "Sales agent, Ellie's team", "sales"]),
  ["Zumer Balkan", "Role to confirm", "other"], ["Rouba Hochane", "Candidate, Property Management Coordinator", "external"], ["All sales agents", "The whole sales floor", "sales"],
];
// FN Realty's campaigns and running tasks (task board, 14 Oct 2026), so an entry links to the work it belongs to
export const WORKS = ["Employment agreement", "Org chart", "90-day plan", "Execution Team hiring (videographer, designer)", "Social content pillars and calendar",
  "Breast Cancer Awareness (October)", "Halloween (31 Oct)", "November 30/30", "December campaign (UAE National Day)", "Team building: bowling", "Quarterly top-agent appreciation",
  "Monday Weekly Huddle", "Business Development needs proposal", "PR launch: Faez and Sultan", "Brand and digital footprint", "Peer brokerage benchmark",
  "Property Management Coordinator hire", "Meeting recording pipeline", "Big 5 Global (23-26 Nov)"];
export const PHASES = [
  { name: "Month 1 · Foundation", from: "2026-10-02", to: "2026-11-01", aim: "Execution Team in place; Instagram audit refreshed; strategy, key messages and spokespeople agreed" },
  { name: "Month 2 · Build", from: "2026-11-02", to: "2026-12-01", aim: "Content and video rhythm running; media outreach and speaking pipeline; first scan of growth opportunities" },
  { name: "Month 3 · Grow & Review", from: "2026-12-02", to: "2027-01-01", aim: "Refine using the data; leadership visibility and AI ideas; day-75 review and renewal" },
];
export const REVIEW_DUE = "2026-12-15", TERM_END = "2027-01-01";
const TYPES = ["Meeting", "Deliverable", "Update", "Organising", "Outreach", "Event", "Other"];
// v565 (Najjuko 14 Oct: "my videographer ... will say 50% ... I need to be able to communicate, I started this task ... it took five days") -
// each entry moves its tasks on (status + percent) and carries a rough effort, so a task shows how far along it is and how many days it took
export const STATUS = ["Started", "In progress", "Waiting on others", "Done"];
export const EFFORT = [["Under 1 hour", 0.5], ["1-2 hours", 1.5], ["Half a day", 4], ["Full day", 8]];

const SCHEMA = { type: "object", additionalProperties: false, required: ["title", "type", "summary", "people", "kpis", "scope", "works", "deliverables", "evidence", "next", "questions"], properties: {
  works: { type: "array", items: { type: "string" } }, questions: { type: "array", items: { type: "string" } },
  effort: { type: "string", enum: EFFORT.map((x) => x[0]) },
  progress: { type: "array", items: { type: "object", additionalProperties: false, required: ["work", "status", "percent"], properties: { work: { type: "string" }, status: { type: "string", enum: STATUS }, percent: { type: "integer" } } } },
  title: { type: "string" }, type: { type: "string", enum: TYPES }, summary: { type: "string" },
  people: { type: "array", items: { type: "string" } }, kpis: { type: "array", items: { type: "integer" } },
  scope: { type: "array", items: { type: "string" } }, deliverables: { type: "array", items: { type: "string" } },
  evidence: { type: "array", items: { type: "string" } }, next: { type: "array", items: { type: "string" } } } };

function sysPrompt() {
  return "You file one work-log entry for Serah Najjuko Ganyana, Strategic Lead - Marketing, PR & Business Development at FN Realty (a Dubai off-plan real estate advisory). "
    + "She reports to Ali Kalhor. Her role is strategic: she strategises, manages, delegates and reviews; hands-on work belongs to the Execution Team.\n"
    + "Her five review focus areas (kpis, use the numbers):\n" + KPIS.map((k) => k.id + ". " + k.name + ": " + k.good + ". Evidence: " + k.ev).join("\n")
    + "\nThe eleven parts of her role (scope, use the ids):\n" + SCOPE.map((s) => s.id + " = " + s.area + ": " + s.name).join("\n")
    + "\nPeople (use these exact names when the entry mentions them, including first names, nicknames or roles):\n" + PEOPLE.map((p) => p[0] + " - " + p[1]).join("\n")
    + "\nFN Realty campaigns and running work (works, use these exact names):\n" + WORKS.join("\n")
    + "\nRead the entry closely and capture EVERYTHING: every person named, even by first name only (Sally = Sally Zehil); every campaign it touches; anything produced. "
    + "A huddle or all-hands touches 'All sales agents' and the team leaders. Where one person is ambiguous or something material is missing (who attended, the outcome, a decision, a file, a date), "
    + "put up to three short, specific questions in questions; otherwise leave questions empty. Never ask about something the entry already answers."
    + "\nworks may also include a NEW task in a few words when the entry is about something not on the list (e.g. 'Rebrand of the office reception'). "
    + "progress: one item per task in works: status (" + STATUS.join(", ") + ") and percent complete as she describes it (started or kicked off about 10, drafted or halfway about 50, sent for approval about 80, finished or delivered 100); "
    + "if the entry gives a percentage, use it. effort: a rough time for the whole entry (" + EFFORT.map((x) => x[0]).join(", ") + "), judged from what was done; a meeting plus preparing a deck is about half a day."
    + "\nRules: use only what the entry says; never invent people, figures or outcomes. title: under 8 words. summary: one or two plain sentences in the third person (\"Najjuko ...\"). "
    + "people: everyone she dealt with. kpis: only the areas the activity genuinely advances, usually one or two. deliverables: things she produced (e.g. a PowerPoint). "
    + "evidence: what this adds to her day-75 review evidence, in the review's own words (e.g. 'Strategy and plan shared with leadership'). next: follow-ups the entry mentions. "
    + "Spell out abbreviations. Plain English.";
}

// keyword fallback when the writing model is unavailable: still files the entry, marked for her to check
function fallback(text) {
  const t = text.toLowerCase(), kp = new Set(), sc = new Set();
  if (/strateg|plan|positioning|message/.test(t)) { kp.add(1); sc.add("m1"); }
  if (/content|video|film|edit|design|creative|calendar|shoot/.test(t)) { kp.add(2); sc.add("m2"); }
  if (/instagram|social|followers|engagement|post|reel|tiktok|linkedin/.test(t)) { kp.add(3); sc.add("m3"); }
  if (/press|media|pr\b|journalist|pitch|interview|podcast|article/.test(t)) { kp.add(4); sc.add("p2"); }
  if (/partner|event|speak|developer|opportunit|referral|network|ai\b/.test(t)) { kp.add(5); sc.add("b2"); }
  if (/huddle|team|staff|internal|meeting/.test(t)) { kp.add(1); sc.add("p4"); }
  const people = PEOPLE.filter((p) => p[0].split(/[ ()]+/).some((w) => w.length > 2 && t.indexOf(w.toLowerCase()) >= 0)).map((p) => p[0]);
  const works = WORKS.filter((w) => w.toLowerCase().split(/[ ():,]+/).some((x) => x.length > 5 && t.indexOf(x) >= 0));
  return { title: text.split(/[.\n]/)[0].slice(0, 60), type: /meeting|huddle|call/.test(t) ? "Meeting" : "Update", summary: text.slice(0, 300), people, kpis: [...kp], scope: [...sc], works, deliverables: [], evidence: [], next: [], questions: [], check: true,
    effort: /all day|full day/.test(t) ? "Full day" : /meeting|huddle|deck|powerpoint/.test(t) ? "Half a day" : "1-2 hours",
    progress: works.map((w) => ({ work: w, status: /finish|done|deliver|complet|sent/.test(t) ? "Done" : /start|kick|began|initiat/.test(t) ? "Started" : "In progress", percent: /finish|done|deliver|complet|sent/.test(t) ? 100 : /start|kick|began|initiat/.test(t) ? 10 : 50 })) };
}

function clean(x) {
  const ids = new Set(SCOPE.map((s) => s.id)), names = new Set(PEOPLE.map((p) => p[0]));
  const arr = (a, n) => (Array.isArray(a) ? a : []).map((v) => String(v).slice(0, 200)).filter(Boolean).slice(0, n || 12);
  return { title: String(x.title || "").slice(0, 90), type: TYPES.includes(x.type) ? x.type : "Other", summary: String(x.summary || "").slice(0, 700),
    people: arr(x.people).filter((p) => names.has(p)), kpis: [...new Set((x.kpis || []).map(Number).filter((n) => n >= 1 && n <= 5))],
    scope: [...new Set(arr(x.scope).filter((s) => ids.has(s)))], works: [...new Set(arr(x.works).map((w) => w.slice(0, 80).trim()).filter(Boolean))].slice(0, 6),
    effort: EFFORT.some((e) => e[0] === x.effort) ? x.effort : "1-2 hours",
    progress: (Array.isArray(x.progress) ? x.progress : []).map((p) => ({ work: String(p.work || "").slice(0, 80).trim(), status: STATUS.includes(p.status) ? p.status : "In progress", percent: Math.max(0, Math.min(100, Math.round(Number(p.percent) || 0))) })).filter((p) => p.work).slice(0, 6), questions: arr(x.questions, 3), answers: arr(x.answers, 3), deliverables: arr(x.deliverables, 8), evidence: arr(x.evidence, 8), next: arr(x.next, 8), check: !!x.check };
}
const dubaiToday = () => new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10);
const okDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || "")) ? String(d) : dubaiToday();
function weekOf(d) { const t = new Date(d + "T00:00:00Z"); const dow = (t.getUTCDay() + 6) % 7; const m = new Date(t.getTime() - dow * 864e5); return [m.toISOString().slice(0, 10), new Date(m.getTime() + 6 * 864e5).toISOString().slice(0, 10)]; }
const PFX = "work_naj_";

async function listEntries(env, from, to) {
  const out = []; let cursor;
  do {
    const r = await env.MEETINGS.list({ prefix: PFX, cursor }); cursor = r.list_complete ? null : r.cursor;
    for (const k of r.keys) { const d = k.name.slice(PFX.length, PFX.length + 10); if ((!from || d >= from) && (!to || d <= to)) out.push(k.name); }
  } while (cursor);
  const vals = await Promise.all(out.map((n) => env.MEETINGS.get(n).then((v) => { try { return JSON.parse(v); } catch (e) { return null; } })));
  return vals.filter(Boolean).sort((a, b) => (a.date + a.created < b.date + b.created ? 1 : -1));
}

// v565 - every task across her entries: latest status and percent, first and last day, the distinct days worked, rough hours
export function tasksOf(es) {
  const T = {};
  [...es].sort((a, b) => (a.date + a.created < b.date + b.created ? -1 : 1)).forEach((e) => {
    const hrs = (EFFORT.find((x) => x[0] === e.effort) || EFFORT[1])[1], ws = e.works || [];
    ws.forEach((w) => {
      const t = T[w] = T[w] || { name: w, first: e.date, last: e.date, days: new Set(), hours: 0, status: "In progress", percent: 0, entries: 0, kpis: new Set() };
      const p = (e.progress || []).find((x) => x.work === w);
      t.last = e.date; t.days.add(e.date); t.hours += hrs / ws.length; t.entries++; (e.kpis || []).forEach((k) => t.kpis.add(k));
      if (p) { t.status = p.status; t.percent = p.percent; }
    });
  });
  return Object.values(T).map((t) => ({ ...t, days: t.days.size, kpis: [...t.kpis], hours: Math.round(t.hours * 10) / 10 }))
    .sort((a, b) => (a.status === "Done") - (b.status === "Done") || (a.last < b.last ? 1 : -1));
}
export function hoursByKpi(es) {
  return KPIS.map((k) => ({ id: k.id, name: k.name, hours: Math.round(es.filter((e) => (e.kpis || []).includes(k.id)).reduce((s, e) => s + (EFFORT.find((x) => x[0] === e.effort) || EFFORT[1])[1] / Math.max(1, (e.kpis || []).length), 0) * 10) / 10 }));
}
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmtD = (d) => { const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]; const p = String(d).split("-"); return (+p[2]) + " " + M[+p[1] - 1] + " " + p[0]; };
const dayName = (d) => ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(d + "T00:00:00Z").getUTCDay()];

export async function workRoute(request, env, url, deps) {
  const p = url.pathname;
  if (!p.startsWith("/momo/work")) return null;
  const key = url.searchParams.get("key") || "", rk = url.searchParams.get("rk") || "";
  const J = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  if (!deps.isNaj(env, url)) {   // the owner (or anyone else): the room exists, the log is hers alone
    if (p !== "/momo/work") return new Response("not found", { status: 404 });
    return new Response(deps.page(key, rk, '<a class=back href="/momo?key=' + encodeURIComponent(key) + '">&#8592; Momo</a><div class=tag>MOMO</div><h1>Work</h1><div class=empty><p>Najjuko\'s work log is private to her link.</p></div>'), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  }
  if (p === "/momo/work.js") return new Response(WORK_JS, { headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "no-store" } });
  if (p === "/momo/work/api") {
    if (request.method === "GET") {
      const [f, t] = weekOf(okDate(url.searchParams.get("week")));
      const week = await listEntries(env, f, t), all = await listEntries(env, PHASES[0].from, TERM_END);
      const tally = KPIS.map((k) => ({ id: k.id, name: k.name, week: week.filter((e) => e.kpis.includes(k.id)).length, term: all.filter((e) => e.kpis.includes(k.id)).length }));
      return J({ from: f, to: t, today: dubaiToday(), entries: week, tally, tasks: tasksOf(all), hours: hoursByKpi(week), status: STATUS, effort: EFFORT.map((x) => x[0]), review_due: REVIEW_DUE, phase: PHASES.find((x) => dubaiToday() >= x.from && dubaiToday() <= x.to) || null, scope: SCOPE, kpis: KPIS, people: PEOPLE.map((x) => x[0]), works: WORKS, types: TYPES });
    }
    let b = {}; try { b = await request.json(); } catch (e) { return J({ error: "Send JSON." }, 400); }
    if (b.action === "parse") {
      const text = String(b.text || "").trim().slice(0, 4000);
      if (!text) return J({ error: "Write what happened first." }, 400);
      let x = null;
      try { x = await deps.claudeJSON(env, sysPrompt(), "Date: " + okDate(b.date) + " (" + dayName(okDate(b.date)) + ")\nEntry:\n" + text, SCHEMA, deps.model, 1200); } catch (e) {}
      return J({ entry: clean(x || fallback(text)) });
    }
    if (b.action === "save") {
      const e = clean(b.entry || {}); const date = okDate(b.date), text = String(b.text || "").slice(0, 4000), link = /^https?:\/\//.test(String(b.link || "")) ? String(b.link).slice(0, 500) : "";
      const id = String(b.id || "").replace(/[^a-z0-9]/g, "").slice(0, 16) || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
      const rec = { id, date, text, link, ...e, check: false, created: b.created || new Date().toISOString(), updated: new Date().toISOString() };
      if (b.id && b.oldDate && b.oldDate !== date) await env.MEETINGS.delete(PFX + okDate(b.oldDate) + "_" + id);
      await env.MEETINGS.put(PFX + date + "_" + id, JSON.stringify(rec));
      return J({ ok: true, entry: rec });
    }
    if (b.action === "delete") { await env.MEETINGS.delete(PFX + okDate(b.date) + "_" + String(b.id || "").replace(/[^a-z0-9]/g, "")); return J({ ok: true }); }
    return J({ error: "Unknown action." }, 400);
  }
  if (p === "/momo/work/report") {
    const from = okDate(url.searchParams.get("from") || weekOf(dubaiToday())[0]), to = okDate(url.searchParams.get("to") || weekOf(from)[1]);
    return new Response(reportHtml(await listEntries(env, from, to), from, to, tasksOf(await listEntries(env, PHASES[0].from, to))), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  }
  if (p === "/momo/work") return new Response(deps.page(key, rk, WORK_BODY.replace("__KEY__", esc(key))), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  return new Response("not found", { status: 404 });
}

// the weekly report: FN Realty's brand (navy #1F2B44, gold #C9A97A, Anton + Inter), internal confidentiality footer on every page
export function reportHtml(es, from, to, allTasks) {
  const byK = KPIS.map((k) => ({ k, es: es.filter((e) => e.kpis.includes(k.id)) }));
  const daily = from === to, hk = hoursByKpi(es), totH = Math.round(hk.reduce((s, x) => s + x.hours, 0) * 10) / 10;
  const tk = (allTasks || tasksOf(es)).filter((t) => t.last >= from && t.first <= to);
  const bar = (p) => '<span style="display:inline-block;width:70px;height:7px;background:#E9EAEC;border-radius:4px;vertical-align:middle"><span style="display:block;width:' + p + '%;height:7px;background:#C9A97A;border-radius:4px"></span></span> ' + p + '%';
  const people = {}; es.forEach((e) => e.people.forEach((n) => { (people[n] = people[n] || []).push(e.title); }));
  const dels = es.flatMap((e) => e.deliverables.map((d) => ({ d, e })));
  const next = es.flatMap((e) => e.next);
  const sc = SCOPE.map((s) => ({ s, n: es.filter((e) => e.scope.includes(s.id)).length })).filter((x) => x.n);
  const FOOT = "<b>CONFIDENTIAL · FN Realty internal use only.</b> Not to be copied, distributed, modified, reissued or shared outside FN Realty without prior written approval from FN Realty management. © 2026 FN Realty. All rights reserved.";
  const li = (a) => a.length ? "<ul>" + a.map((x) => "<li>" + x + "</li>").join("") + "</ul>" : "<p class=none>None this week.</p>";
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + (from === to ? 'Daily' : 'Weekly') + ' activity report</title>'
    + '<link rel=stylesheet href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600&display=swap"><style>'
    + '@page{size:A4;margin:16mm 16mm 22mm}body{margin:0;background:#F9F1EF;color:#202020;font-family:Inter,sans-serif;font-size:10.5pt;line-height:1.5}.pg{max-width:780px;margin:0 auto;background:#fff;padding:28px 34px 40px}'
    + 'header{background:#1F2B44;color:#C9A97A;margin:-28px -34px 22px;padding:22px 34px}header h1{font-family:Anton,sans-serif;font-weight:400;font-size:26pt;letter-spacing:.02em;margin:0}header p{margin:4px 0 0;color:#EFE5D7;font-size:10pt}'
    + 'h2{font-family:Anton,sans-serif;font-weight:400;color:#1F2B44;font-size:14pt;letter-spacing:.03em;margin:22px 0 8px;border-bottom:2px solid #C9A97A;padding-bottom:3px}'
    + '.tiles{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.tile{background:#FAF6F2;border:1px solid #EFE5D7;border-radius:8px;padding:9px 8px;text-align:center}.tile b{display:block;font-family:Anton,sans-serif;font-weight:400;font-size:20pt;color:#1F2B44}.tile span{font-size:8pt;color:#626B7C}'
    + '.e{border-left:3px solid #C9A97A;padding:4px 0 4px 12px;margin:8px 0}.e .m{font-size:8.5pt;color:#626B7C}.e b{color:#1F2B44}ul{margin:4px 0 0 18px;padding:0}.none{color:#626B7C;font-style:italic;margin:4px 0}'
    + 'table{width:100%;border-collapse:collapse}td{padding:5px 6px;border-bottom:1px solid #E9EAEC;vertical-align:top}td:first-child{font-weight:600;color:#1F2B44;width:34%}'
    + 'footer{margin-top:26px;border-top:1px solid #E9EAEC;padding-top:8px;font-size:7.5pt;color:#626B7C}.pf{position:fixed;bottom:6mm;left:16mm;right:16mm;font-size:7pt;color:#626B7C;display:none}'
    + '.btn{position:fixed;right:16px;bottom:16px;background:#1F2B44;color:#C9A97A;border:0;border-radius:99px;padding:10px 18px;font:600 10pt Inter,sans-serif;cursor:pointer}'
    + '@media print{body{background:#fff}.pg{padding:0;max-width:none}header{margin:0 0 18px}.btn{display:none}.pf{display:block}footer{display:none}}</style></head><body><div class=pg>'
    + '<header><h1>' + (daily ? 'DAILY' : 'WEEKLY') + ' ACTIVITY REPORT</h1><p>Serah Najjuko Ganyana · Strategic Lead – Marketing, PR &amp; Business Development · ' + (daily ? esc(dayName(from)) + ' ' + esc(fmtD(from)) : esc(fmtD(from)) + ' to ' + esc(fmtD(to))) + '</p></header>'
    + '<p>' + es.length + ' logged ' + (es.length === 1 ? 'activity' : 'activities') + (daily ? ' this day' : ' this week') + ', about ' + totH + ' hours of work, mapped to the five focus areas of the Review Framework (Schedule 2) and the scope of the role (Schedule 1).</p>'
    + '<div class=tiles>' + byK.map((x, i) => '<div class=tile><b>' + x.es.length + '</b><span>' + esc(x.k.name) + '<br>about ' + hk[i].hours + ' h</span></div>').join("") + '</div>'
    + '<h2>TASK PROGRESS</h2>' + (tk.length ? '<table><tr><td style="color:#626B7C;font-weight:500">Task</td><td style="color:#626B7C">Status</td><td style="color:#626B7C">Complete</td><td style="color:#626B7C">Started</td><td style="color:#626B7C">Days worked</td><td style="color:#626B7C">Time</td></tr>'
      + tk.map((t) => '<tr><td>' + esc(t.name) + '</td><td>' + esc(t.status) + '</td><td style="white-space:nowrap">' + bar(t.percent) + '</td><td style="white-space:nowrap">' + esc(fmtD(t.first)) + '</td><td>' + t.days + '</td><td style="white-space:nowrap">about ' + t.hours + ' h</td></tr>').join("") + '</table>'
      + '<p style="font-size:8pt;color:#626B7C">Complete is the percentage logged with the latest entry for the task. Time is a rough estimate from each entry (under 1 hour, 1-2 hours, half a day or a full day).</p>' : '<p class=none>No tasks logged.</p>')
    + '<h2>BY FOCUS AREA</h2>' + byK.map((x) => '<h3 style="color:#1F2B44;margin:14px 0 2px;font-size:11pt">' + x.k.id + '. ' + esc(x.k.name) + '</h3><div class=m style="font-size:8.5pt;color:#626B7C">Evidence sought: ' + esc(x.k.ev) + '</div>'
      + (x.es.length ? x.es.map((e) => '<div class=e><b>' + esc(e.title) + '</b> <span class=m>· ' + esc(dayName(e.date)) + ' ' + esc(fmtD(e.date)) + ' · ' + esc(e.type) + '</span><div>' + esc(e.summary) + '</div></div>').join("") : '<p class=none>Nothing logged against this area this week.</p>')).join("")
    + '<h2>DELIVERABLES</h2>' + li(dels.map((x) => esc(x.d) + ' <span style="color:#626B7C">(' + esc(fmtD(x.e.date)) + ')</span>'))
    + '<h2>CAMPAIGNS AND TASKS</h2>' + (() => { const w = {}; es.forEach((e) => (e.works || []).forEach((n) => { (w[n] = w[n] || []).push(e.title); })); return Object.keys(w).length ? '<table>' + Object.keys(w).map((n) => '<tr><td>' + esc(n) + '</td><td>' + w[n].map(esc).join('; ') + '</td></tr>').join("") + '</table>' : '<p class=none>None recorded.</p>'; })()
    + '<h2>PEOPLE AND TOUCHPOINTS</h2>' + (Object.keys(people).length ? '<table>' + Object.keys(people).sort().map((n) => '<tr><td>' + esc(n) + '</td><td>' + people[n].map(esc).join('; ') + '</td></tr>').join("") + '</table>' : '<p class=none>None recorded.</p>')
    + '<h2>SCOPE OF THE ROLE COVERED</h2>' + (sc.length ? '<table>' + sc.map((x) => '<tr><td>' + esc(x.s.area) + '</td><td>' + esc(x.s.name) + ' (' + x.n + ')</td></tr>').join("") + '</table>' : '<p class=none>None recorded.</p>')
    + '<h2>NEXT STEPS</h2>' + li(next.map(esc))
    + '<footer>' + FOOT + '</footer></div><div class=pf>' + FOOT + '</div><button class=btn onclick="print()">Save as PDF</button></body></html>';
}

const WORK_BODY = '<div class=tag>MOMO · WORK</div><h1>My work log</h1>'
  + '<div class=wk id=wkhead></div>'
  + '<form id=wf class=box><label>What did you do?</label><textarea id=wt rows=4 placeholder="e.g. Monday huddle: built the PowerPoint, ran the meeting with Ali and the team, laid out the week."></textarea>'
  + '<div class=row><input id=wd type=date><input id=wl type=url placeholder="Link to a file (optional)"></div><button type=submit id=wb class=gold>File it</button></form>'
  + '<div id=wprev></div><a id=wday class=gold style="display:block;text-align:center;text-decoration:none;margin-top:12px" target=_blank>Today\'s summary</a>'
  + '<div class=sec>MY TASKS</div><div id=wtasks></div>'
  + '<div class=sec>FOCUS AREAS · THIS WEEK / SINCE 2 OCT</div><div id=wtally class=tally></div>'
  + '<div class=sec id=wlisth>THIS WEEK</div><div id=wlist></div>'
  + '<div class=row2><button type=button id=wprevw class=ghost>&#8592; Previous week</button><button type=button id=wnextw class=ghost>Next week &#8594;</button></div>'
  + '<a id=wrep class=ghost style="display:block;text-align:center;text-decoration:none;margin-top:12px" target=_blank>This week\'s report</a>'
  + '<script src="/momo/work.js?key=__KEY__"></script>';

export const WORK_CSS = '.wk{color:#8FA39B;font-size:.85rem;margin:-12px 0 16px}.box{border:1px solid #24352F;border-radius:16px;padding:14px;background:#0E1918}.box label{display:block;color:#C5A56A;font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;margin-bottom:8px}'
  + 'textarea,input{width:100%;box-sizing:border-box;background:#0C1413;border:1px solid #24352F;border-radius:10px;color:#E8E4D8;font:inherit;padding:10px}.row{display:grid;grid-template-columns:150px 1fr;gap:8px;margin:8px 0}'
  + '.gold{background:#C5A56A;color:#0C1413;border:0;border-radius:12px;padding:12px;font:600 .95rem inherit;width:100%;cursor:pointer}.ghost{background:transparent;border:1px solid #24352F;color:#B9B2A3;border-radius:10px;padding:9px;cursor:pointer;font:inherit}'
  + '.row2{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}.sec{color:#C5A56A;font-family:"IBM Plex Mono",monospace;font-size:.68rem;letter-spacing:.12em;margin:22px 0 8px}'
  + '.tally{display:grid;grid-template-columns:1fr 1fr;gap:8px}.tl{border:1px solid #24352F;border-radius:12px;padding:10px 12px;background:#0E1918}.tl b{font-family:Fraunces,serif;font-size:1.5rem;color:#F3EFE4}.tl i{font-style:normal;color:#8FA39B;font-size:.8rem}.tl span{display:block;font-size:.78rem;color:#B9B2A3;margin-top:2px}'
  + '.ent{border:1px solid #24352F;border-left:3px solid #C5A56A;border-radius:12px;padding:12px;margin:8px 0;background:#0E1918}.ent h3{margin:0 0 4px;font-size:1rem;color:#F3EFE4}.ent .m{color:#8FA39B;font-size:.78rem}.ent p{margin:6px 0;color:#D8D2C4;font-size:.9rem}'
  + '.chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.chip{border:1px solid #24352F;border-radius:99px;padding:4px 10px;font-size:.75rem;color:#B9B2A3;background:transparent;cursor:pointer}.chip.on{border-color:#C5A56A;color:#C5A56A;background:#15231F}'
  + '.prev{border:1px solid #C5A56A;border-radius:16px;padding:14px;margin-top:12px;background:#0E1918}.prev input{margin-bottom:8px}.lab{color:#8FA39B;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;margin:10px 0 4px}.warn{color:#E3A08F;font-size:.8rem}.acts{display:flex;gap:10px;margin-top:8px}.acts button{flex:1}.del{color:#8FA39B;background:none;border:0;font-size:.78rem;cursor:pointer;padding:0;margin-top:6px}'
  + '.tk{border:1px solid #24352F;border-radius:12px;padding:10px 12px;margin:6px 0;background:#0E1918}.tk b{color:#F3EFE4;font-weight:600}.tk .m{color:#8FA39B;font-size:.76rem;margin-top:3px}.pb{height:6px;background:#1B2A26;border-radius:4px;margin-top:7px;overflow:hidden}.pb i{display:block;height:6px;background:#C5A56A}.tk.done{opacity:.6}'
  + '.pg{border-top:1px solid #24352F;padding-top:8px;margin-top:8px}.pg input[type=range]{padding:0;accent-color:#C5A56A}.addw{display:grid;grid-template-columns:1fr auto;gap:6px;margin-top:6px}';

const WORK_JS = String.raw`(function(){
var KEY=(document.currentScript.src.split("key=")[1]||"").split("&")[0];KEY=decodeURIComponent(KEY);
var $=function(i){return document.getElementById(i)};var D=null,WEEK=null,PREV=null,EDIT=null;
function esc(s){return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]})}
var M=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],DN=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
function fd(d){var p=d.split("-");return DN[new Date(d+"T00:00:00Z").getUTCDay()]+" "+(+p[2])+" "+M[+p[1]-1]}
function api(o){return fetch("/momo/work/api?key="+encodeURIComponent(KEY),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(o)}).then(function(r){return r.json()})}
function load(w){fetch("/momo/work/api?key="+encodeURIComponent(KEY)+(w?"&week="+w:"")).then(function(r){return r.json()}).then(function(j){D=j;WEEK=j.from;draw()})}
function shift(n){var t=new Date(WEEK+"T00:00:00Z");t.setUTCDate(t.getUTCDate()+7*n);load(t.toISOString().slice(0,10))}
function draw(){var days=Math.round((Date.parse(D.review_due)-Date.parse(D.today))/864e5);
 $("wkhead").textContent=(D.phase?D.phase.name+" · ":"")+(days>=0?days+" days to the day-75 review (15 Dec)":"Review due date passed");
 if(!$("wd").value)$("wd").value=D.today;
 $("wtally").innerHTML=D.tally.map(function(t){return '<div class=tl><b>'+t.week+'</b> <i>/ '+t.term+'</i><span>'+esc(t.id+". "+t.name)+'</span></div>'}).join("");
 $("wlisth").textContent="WEEK OF "+fd(D.from).toUpperCase()+" · "+D.entries.length+" ENTR"+(D.entries.length===1?"Y":"IES");
 $("wlist").innerHTML=D.entries.length?D.entries.map(function(e,i){return '<div class=ent><h3>'+esc(e.title)+'</h3><div class=m>'+esc(fd(e.date))+' · '+esc(e.type)+(e.people.length?' · '+esc(e.people.join(", ")):'')+'</div><p>'+esc(e.summary)+'</p>'
  +'<div class=chips>'+e.kpis.map(function(k){var x=D.kpis.filter(function(y){return y.id===k})[0];return '<span class="chip on">'+esc(x?x.name:k)+'</span>'}).join("")+'</div>'
  +(e.deliverables.length?'<div class=m style="margin-top:6px">Produced: '+esc(e.deliverables.join("; "))+'</div>':'')+(e.link?'<div class=m><a style="color:#C5A56A" href="'+esc(e.link)+'" target=_blank rel=noopener>Open the file</a></div>':'')
  +'<button class=del data-e='+i+'>Edit</button> &middot; <button class=del data-d='+i+'>Delete</button></div>'}).join(""):'<p style="color:#8FA39B">Nothing logged this week yet.</p>';
 $("wlist").querySelectorAll("[data-d]").forEach(function(b){b.onclick=function(){var e=D.entries[+b.getAttribute("data-d")];if(!confirm("Delete \""+e.title+"\"?"))return;api({action:"delete",id:e.id,date:e.date}).then(function(){load(WEEK)})}});
 $("wlist").querySelectorAll("[data-e]").forEach(function(b){b.onclick=function(){var e=D.entries[+b.getAttribute("data-e")];EDIT=e;$("wt").value=e.text;$("wd").value=e.date;$("wl").value=e.link||"";preview(e);scrollTo(0,0)}});
 $("wtasks").innerHTML=(D.tasks||[]).length?D.tasks.map(function(t){return '<div class="tk'+(t.status==="Done"?' done':'')+'"><b>'+esc(t.name)+'</b> <span style="color:#C5A56A;float:right">'+t.percent+'%</span><div class=pb><i style="width:'+t.percent+'%"></i></div>'
  +'<div class=m>'+esc(t.status)+' · started '+esc(fd(t.first))+' · '+t.days+' day'+(t.days===1?'':'s')+' worked · about '+t.hours+' h'+(t.last!==t.first?' · last '+esc(fd(t.last)):'')+'</div></div>'}).join(""):'<p style="color:#8FA39B">Tasks appear here as you log work on them.</p>';
 $("wday").href="/momo/work/report?key="+encodeURIComponent(KEY)+"&from="+D.today+"&to="+D.today;
 var to=new Date(Date.parse(D.from)+6*864e5).toISOString().slice(0,10);$("wrep").href="/momo/work/report?key="+encodeURIComponent(KEY)+"&from="+D.from+"&to="+to}
function chips(list,on,attr){return list.map(function(x){var id=x.id!=null?x.id:x,nm=x.name||x;return '<button type=button class="chip'+(on.indexOf(id)>=0?' on':'')+'" data-'+attr+'="'+esc(id)+'">'+esc(nm)+'</button>'}).join("")}
function preview(e){PREV=JSON.parse(JSON.stringify(e));var h='<div class=prev>'+(e.check?'<div class=warn>Filed by keyword only: please check the areas and people.</div>':'')
 +'<div class=lab>Title</div><input id=pt value="'+esc(e.title)+'"><div class=lab>Summary</div><textarea id=ps rows=3>'+esc(e.summary)+'</textarea>'
 +'<div class=lab>Type</div><div class=chips>'+chips(D.types,[e.type],"t")+'</div>'
 +'<div class=lab>Focus areas (her review)</div><div class=chips>'+chips(D.kpis,e.kpis,"k")+'</div>'
 +'<div class=lab>Part of the role</div><div class=chips>'+chips(D.scope,e.scope,"s")+'</div>'
 +'<div class=lab>About how long</div><div class=chips>'+chips(D.effort,[e.effort],"f")+'</div>'
 +'<div class=lab>Campaign or task</div><div class=chips>'+chips((e.works||[]).filter(function(w){return D.works.indexOf(w)<0}).concat(D.works),e.works||[],"w")+'</div>'
 +'<div class=addw><input id=pnw placeholder="Add a new task"><button type=button class=ghost id=pnb>Add</button></div><div id=pprog></div>'
 +'<div class=lab>People</div><div class=chips>'+chips(e.people.concat(D.people.filter(function(p){return e.people.indexOf(p)<0})),e.people,"p")+'</div>'
 +((e.questions||[]).length?'<div class=lab>A few questions so nothing is missed</div>'+e.questions.map(function(q,i){return '<div class=m style="color:#D8D2C4;margin:6px 0 4px">'+esc(q)+'</div><input class=pq data-q='+i+' placeholder="Your answer (optional)">'}).join("")+'<button type=button class=ghost id=pa style="width:100%;margin-top:6px">Answer and refile</button>':'')
 +(e.deliverables.length?'<div class=lab>Produced</div><div class=m style="color:#D8D2C4">'+esc(e.deliverables.join("; "))+'</div>':'')
 +(e.next.length?'<div class=lab>Next steps</div><div class=m style="color:#D8D2C4">'+esc(e.next.join("; "))+'</div>':'')
 +'<div class=acts><button type=button class=ghost id=pc>Cancel</button><button type=button class=gold id=pv>Save</button></div></div>';
 $("wprev").innerHTML=h;
 $("wprev").querySelectorAll("[data-t]").forEach(function(b){b.onclick=function(){PREV.type=b.getAttribute("data-t");$("wprev").querySelectorAll("[data-t]").forEach(function(x){x.classList.toggle("on",x===b)})}});
 function tog(attr,arr,num){$("wprev").querySelectorAll("[data-"+attr+"]").forEach(function(b){b.onclick=function(){var v=b.getAttribute("data-"+attr);if(num)v=+v;var i=PREV[arr].indexOf(v);if(i>=0)PREV[arr].splice(i,1);else PREV[arr].push(v);b.classList.toggle("on")}})}
 PREV.works=PREV.works||[];PREV.progress=PREV.progress||[];tog("k","kpis",1);tog("s","scope",0);tog("p","people",0);
 $("wprev").querySelectorAll("[data-f]").forEach(function(b){b.onclick=function(){PREV.effort=b.getAttribute("data-f");$("wprev").querySelectorAll("[data-f]").forEach(function(x){x.classList.toggle("on",x===b)})}});
 function prog(){PREV.progress=PREV.works.map(function(w){var p=PREV.progress.filter(function(x){return x.work===w})[0];if(p)return p;var old=(D.tasks||[]).filter(function(t){return t.name===w})[0];return {work:w,status:old&&old.percent>0?"In progress":"Started",percent:old?old.percent:10}});
  $("pprog").innerHTML=PREV.progress.map(function(p,i){return '<div class=pg><div class=m style="color:#E8E4D8">'+esc(p.work)+' <b id=pp'+i+' style="color:#C5A56A;float:right">'+p.percent+'%</b></div><input type=range min=0 max=100 step=5 value='+p.percent+' data-pc='+i+'><div class=chips>'+D.status.map(function(s){return '<button type=button class="chip'+(s===p.status?' on':'')+'" data-st="'+i+'|'+esc(s)+'">'+esc(s)+'</button>'}).join("")+'</div></div>'}).join("");
  $("pprog").querySelectorAll("[data-pc]").forEach(function(r){r.oninput=function(){var i=+r.getAttribute("data-pc");PREV.progress[i].percent=+r.value;$("pp"+i).textContent=r.value+"%";if(+r.value===100){PREV.progress[i].status="Done"}}});
  $("pprog").querySelectorAll("[data-st]").forEach(function(b){b.onclick=function(){var v=b.getAttribute("data-st").split("|"),i=+v[0];PREV.progress[i].status=v[1];if(v[1]==="Done"){PREV.progress[i].percent=100}prog()}})}
 prog();
 $("wprev").querySelectorAll("[data-w]").forEach(function(b){b.onclick=function(){var v=b.getAttribute("data-w"),i=PREV.works.indexOf(v);if(i>=0)PREV.works.splice(i,1);else PREV.works.push(v);b.classList.toggle("on");prog()}});
 $("pnb").onclick=function(){var v=$("pnw").value.trim();if(!v||PREV.works.indexOf(v)>=0)return;PREV.works.push(v);$("pnw").value="";var c=document.createElement("button");c.type="button";c.className="chip on";c.textContent=v;c.onclick=function(){var i=PREV.works.indexOf(v);if(i>=0)PREV.works.splice(i,1);else PREV.works.push(v);c.classList.toggle("on");prog()};$("pnw").parentNode.previousSibling.appendChild(c);prog()};
 if($("pa"))$("pa").onclick=function(){var qa=[];$("wprev").querySelectorAll(".pq").forEach(function(i){if(i.value.trim())qa.push("Q: "+e.questions[+i.getAttribute("data-q")]+"\nA: "+i.value.trim())});
  if(!qa.length)return;$("wt").value=$("wt").value.trim()+"\n\n"+qa.join("\n");$("pa").disabled=true;$("pa").textContent="Refiling…";
  api({action:"parse",text:$("wt").value,date:$("wd").value}).then(function(j){if(j.entry)preview(j.entry)})};
 $("pc").onclick=function(){$("wprev").innerHTML="";EDIT=null};
 $("pv").onclick=function(){PREV.title=$("pt").value;PREV.summary=$("ps").value;$("pv").disabled=true;$("pv").textContent="Saving…";
  api({action:"save",entry:PREV,text:$("wt").value,date:$("wd").value,link:$("wl").value,id:EDIT&&EDIT.id,oldDate:EDIT&&EDIT.date,created:EDIT&&EDIT.created}).then(function(j){if(!j.ok){alert(j.error||"Could not save");$("pv").disabled=false;$("pv").textContent="Save";return}
   $("wprev").innerHTML="";$("wt").value="";$("wl").value="";EDIT=null;
   var t=new Date(j.entry.date+"T00:00:00Z"),dow=(t.getUTCDay()+6)%7;var wk=new Date(t.getTime()-dow*864e5).toISOString().slice(0,10);
   if(wk===D.from){D.entries=[j.entry].concat(D.entries.filter(function(x){return x.id!==j.entry.id}));D.tally.forEach(function(x){x.week=D.entries.filter(function(e){return e.kpis.indexOf(x.id)>=0}).length});draw();setTimeout(function(){load(WEEK)},1500)}else load(wk)})}}
$("wf").onsubmit=function(ev){ev.preventDefault();var t=$("wt").value.trim();if(!t)return;$("wb").disabled=true;$("wb").textContent="Filing…";
 api({action:"parse",text:t,date:$("wd").value}).then(function(j){$("wb").disabled=false;$("wb").textContent="File it";if(j.error){alert(j.error);return}preview(j.entry)}).catch(function(){$("wb").disabled=false;$("wb").textContent="File it";alert("Could not file it just now. Try again.")})};
$("wprevw").onclick=function(){shift(-1)};$("wnextw").onclick=function(){shift(1)};
load()})();`;
