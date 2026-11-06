// v650 - MOMO GGU (Kendall, 27 Oct 2026: "make another card ... specific to GGU"): his Golden Gate University work in one place - roles,
// the doctoral candidates he chairs (stage, next milestone, what is due), programme deadlines, his own tasks, documents and portals,
// contacts (names and roles only, never emails on the page) and his own DBA. Kendall's key only (person 'kendall'); every other key 404s.
// One record per person in KV: ggu_rec_<person>. The real data is loaded from a seed kept OUTSIDE git (the GGU engagement folder).
// Same page patterns as Speaking (src/work_speaking.js), incl. the v647 rule: page scripts that embed server functions start with __name.
export const GGU_PREFIX = "ggu_rec_";
const S = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, n);
const day = (v) => { const d = S(v, 10).trim(); return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : ""; };
const slug = (v) => S(v, 60).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
const url = (v) => { const u = S(v, 500).trim(); return /^https?:\/\/[^\s]+$/i.test(u) ? u : ""; };
const arr = (a, n) => (Array.isArray(a) ? a : []).slice(0, n);
const noMail = (v, n) => S(v, n).replace(/[^\s@<>()]+@[^\s@<>()]+\.[a-z]{2,}/gi, "[email removed]");   // names and roles only on this card

export const cleanTask = (t) => ({ what: noMail(t && t.what, 200).trim(), by: day(t && t.by), done: !!(t && t.done) });
export function cleanCandidate(c, prev) {
  const o = Object.assign({}, prev || {}), g = c && typeof c === "object" ? c : {}, has = (k) => g[k] !== undefined;
  [["name", 80], ["cohort", 40], ["mode", 40], ["topic", 300], ["stage", 120], ["nextMilestone", 200], ["feedbackOwed", 200]].forEach(([k, n]) => { if (has(k)) o[k] = noMail(g[k], n).trim(); else if (o[k] === undefined) o[k] = ""; });
  if (has("notes")) o.notes = noMail(g.notes, 2000); else if (o.notes === undefined) o.notes = "";
  if (has("meetings")) o.meetings = arr(g.meetings, 20).map((m) => ({ when: S(m && m.when, 40).trim(), what: noMail(m && m.what, 200).trim() })).filter((m) => m.what); else if (!Array.isArray(o.meetings)) o.meetings = [];
  if (has("due")) o.due = arr(g.due, 12).map(cleanTask).filter((t) => t.what); else if (!Array.isArray(o.due)) o.due = [];
  o.id = slug(g.id || o.id || o.name) || ("c" + Date.now().toString(36));
  return o;
}

// v777g (Kendall 5 Nov 2026) - GGU DBA Cohort 8 (8919): Kendall is dissertation CHAIR. One child card per learner; details stored as GGU sent them.
// Learner e-mails are kept here (Kendall-only record, mailto on the sheet) - unlike the supervisor candidates above, which strip addresses.
const CHAIR_DEFAULT = {
  cohort: "Cohort 8 (8919)", phase: "Dissertation", role: "Chair",
  note: "Allocation received 5 Nov 2026 - acknowledgment to confirm",
  contact: { name: "Ekta Chauhan", role: "Associate - Student Success, GGU DBA ET (Gen AI)", phone: "+91 9136446094", booking: "https://calendly.com/ekta1-chauhan-upgrad/15min" },
  learners: [
    { id: "noaman-kazi", name: "Noaman Kazi", email: "noaman.kazi@gmail.com", plan: "Business Plan", country: "United Arab Emirates", industry: "AI infrastructure",
      title: "Commercial Viability of a Modular Governed Agentic AI Platform for SMEs and Digital Businesses",
      summary: "Intgr8 is a proposed business-software company that provides governed agentic AI infrastructure to digital agencies, software product teams, and knowledge-intensive SMEs. Agentic AI refers to language-model systems that plan and act through tools, documents, and sessions instead of only answering prompts. The company addresses a specific problem: moving an AI demonstration to a dependable service requires repeated, customer-specific assembly of models, documents, tools, and permissions, and most small organizations lack the capacity or risk tolerance to do this work." },
    { id: "john-nova", name: "John Nova", email: "jn@javontech.com", plan: "Business Plan", country: "Canada", industry: "Entrepreneurship & Business Services",
      title: "A Business Plan for an AI-Native Platform to Reduce Expertise & Execution Barriers in Solo Venture Creation",
      summary: "This business plan proposes AI Venture OS, an AI-native platform that helps solo founders turn ideas and expertise into revenue-generating businesses. Using generative AI and automation, the platform simplifies opportunity identification, market validation, business launch, customer acquisition, and operations while minimizing the need for specialized expertise and large teams." },
    { id: "abdullah-albar", name: "Abdullah Albar", email: "a_al_bar@hotmail.com", plan: "Business Plan", country: "Saudi Arabia", industry: "RegTech",
      title: "Autonomous Compliance in Saudi Arabia",
      summary: "Autonomous Compliance in Saudi Arabia: A Doctoral Business Project for STAMP. This project tests whether a governed generative AI pipeline can convert compliance expertise into scalable, legally reviewed software for Saudi firms. The proposed system drafts machine-executable rules from Arabic legal sources, requires legal approval of every rule, and executes eligible filings deterministically with human exception handling. Using STAMP, a live Saudi RegTech venture, as the laboratory, the project validates reliability, segment-level willingness to pay, and unit economics through consented interviews, pilot logs, and commercial records, and delivers a decision-ready 2026-2030 business plan and prototype with explicit go or no-go evidence gates." },
  ],
};
const mail = (v) => { const m = S(v, 120).trim(); return /^[^\s@<>()]+@[^\s@<>()]+\.[a-z]{2,}$/i.test(m) ? m : ""; };
export function cleanLearner(l, prev) {
  const o = Object.assign({}, prev || {}), g = l && typeof l === "object" ? l : {}, has = (k) => g[k] !== undefined;
  [["name", 80], ["plan", 60], ["country", 60], ["industry", 80], ["title", 300], ["stage", 120]].forEach(([k, n]) => { if (has(k)) o[k] = S(g[k], n).trim(); else if (o[k] === undefined) o[k] = ""; });
  if (has("summary")) o.summary = S(g.summary, 2000).trim(); else if (o.summary === undefined) o.summary = "";
  if (has("notes")) o.notes = S(g.notes, 4000); else if (o.notes === undefined) o.notes = "";
  if (has("email")) o.email = mail(g.email); else if (o.email === undefined) o.email = "";
  if (has("meetings")) o.meetings = arr(g.meetings, 40).map((m) => ({ date: day(m && m.date), time: S(m && m.time, 5).replace(/[^0-9:]/g, ""), what: S(m && m.what, 400).trim() })).filter((m) => m.date || m.what); else if (!Array.isArray(o.meetings)) o.meetings = [];
  if (has("milestones")) o.milestones = arr(g.milestones, 30).map(cleanTask).filter((t) => t.what); else if (!Array.isArray(o.milestones)) o.milestones = [];
  if (has("docs")) o.docs = arr(g.docs, 30).map((d) => ({ label: S(d && d.label, 160).trim(), url: S(d && d.url, 500).trim() })).filter((d) => d.label || d.url); else if (!Array.isArray(o.docs)) o.docs = [];
  o.id = slug(g.id || o.id || o.name) || ("l" + Date.now().toString(36));
  return o;
}
export function cleanChair(c) {
  const x = c && typeof c === "object" ? c : CHAIR_DEFAULT, k = x.contact && typeof x.contact === "object" ? x.contact : {};
  return { cohort: S(x.cohort, 60).trim(), phase: S(x.phase, 60).trim(), role: S(x.role, 40).trim(), note: S(x.note, 300).trim(), acknowledged: !!x.acknowledged,
    contact: { name: S(k.name, 80).trim(), role: S(k.role, 160).trim(), phone: S(k.phone, 30).trim(), booking: url(k.booking) },
    learners: arr(x.learners, 30).map((l) => cleanLearner(l)).filter((l) => l.name) };
}
export const emptyGgu = () => ({ v: 1, updatedAt: "", roles: [], candidates: [], deadlines: [], documents: [], portals: [], contacts: [], tasks: [], ownDba: { cohort: "", mode: "", completed: "", notes: "" }, chair: cleanChair(CHAIR_DEFAULT), log: [] });
export function cleanGgu(r) {
  const x = r && typeof r === "object" ? r : {}, e = emptyGgu();
  e.updatedAt = S(x.updatedAt, 30);
  e.roles = arr(x.roles, 12).map((q) => ({ title: noMail(q && q.title, 160).trim(), detail: noMail(q && q.detail, 600).trim(), source: S(q && q.source, 60).trim() })).filter((q) => q.title);
  e.candidates = arr(x.candidates, 40).map((c) => cleanCandidate(c)).filter((c) => c.name);
  e.deadlines = arr(x.deadlines, 40).map((d) => ({ date: day(d && d.date), what: noMail(d && d.what, 240).trim(), confirmed: !!(d && d.confirmed) })).filter((d) => d.date && d.what);
  e.documents = arr(x.documents, 60).map((d) => ({ label: S(d && d.label, 160).trim(), path_or_url: S(d && d.path_or_url, 400).trim() })).filter((d) => d.label && d.path_or_url);
  e.portals = arr(x.portals, 20).map((d) => ({ label: S(d && d.label, 120).trim(), url: url(d && d.url) })).filter((d) => d.label);
  e.contacts = arr(x.contacts, 30).map((c) => ({ name: noMail(c && c.name, 80).trim(), role: noMail(c && c.role, 200).trim() })).filter((c) => c.name);
  e.tasks = arr(x.tasks, 40).map(cleanTask).filter((t) => t.what);
  const d = x.ownDba && typeof x.ownDba === "object" ? x.ownDba : {};
  e.ownDba = { cohort: S(d.cohort, 40).trim(), mode: S(d.mode, 60).trim(), completed: S(d.completed, 40).trim(), notes: noMail(d.notes, 1500) };
  e.log = arr(x.log, 40).map((l) => ({ at: S(l && l.at, 30), text: S(l && l.text, 200) }));
  e.chair = cleanChair(x.chair || CHAIR_DEFAULT);   // v777g - the Cohort 8 learners appear even before the first save
  return e;
}
export async function readGgu(env, person) { let r = null; try { r = JSON.parse(await env.MEETINGS.get(GGU_PREFIX + person)); } catch (e) {} return r ? cleanGgu(r) : null; }
async function writeGgu(env, person, rec, line) {
  const now = new Date().toISOString(); rec.updatedAt = now;
  if (line) rec.log = [{ at: now, text: S(line, 200) }].concat(rec.log || []).slice(0, 40);
  await env.MEETINGS.put(GGU_PREFIX + person, JSON.stringify(rec)); return rec;
}
export async function gguApi(env, person, b) {
  const rec = (await readGgu(env, person)) || emptyGgu(), ci = (id) => rec.candidates.findIndex((c) => c.id === slug(id));
  switch (b.action) {
    case "save_all": case "import": {   // merge: candidates by id; the other lists are replaced when sent, kept when not
      const x = b.rec && typeof b.rec === "object" ? b.rec : {};
      const n = cleanGgu(Object.assign({}, rec, x, { candidates: [] }));
      ["roles", "deadlines", "documents", "portals", "contacts", "tasks"].forEach((k) => { if (Array.isArray(x[k])) rec[k] = n[k]; });
      if (x.ownDba) rec.ownDba = n.ownDba;
      let added = 0, merged = 0;
      for (const c of arr(x.candidates, 40)) { const i = ci(c && (c.id || c.name)); if (i >= 0) { rec.candidates[i] = cleanCandidate(c, rec.candidates[i]); merged++; } else { const k = cleanCandidate(c); if (k.name) { rec.candidates.push(k); added++; } } }
      await writeGgu(env, person, rec, S(b.note, 200).trim() || ("Imported: " + added + " new, " + merged + " updated candidates")); return { ok: true, added, merged, rec };   // v788 - the page names its own task edits
    }
    case "learner_save": {   // v777g - edit one learner's sheet (stage, meetings, milestones, documents, notes); the GGU details stay unless sent
      const L = rec.chair.learners, i = L.findIndex((l) => l.id === slug(b.id)); if (i < 0) return { error: "Not found.", status: 404 };
      const g = b.learner && typeof b.learner === "object" ? b.learner : {}, pick = {};
      ["stage", "meetings", "milestones", "docs", "notes"].forEach((k) => { if (g[k] !== undefined) pick[k] = g[k]; });
      L[i] = cleanLearner(pick, L[i]); await writeGgu(env, person, rec, L[i].name + ": sheet saved"); return { ok: true, rec };
    }
    case "chair_ack": { rec.chair.acknowledged = !!b.done; await writeGgu(env, person, rec, "Cohort 8 allocation " + (b.done ? "acknowledged" : "reopened")); return { ok: true, rec }; }
    case "set_task_done": { const i = Number(b.index); if (!rec.tasks[i]) return { error: "Not found.", status: 404 }; rec.tasks[i].done = !!b.done; await writeGgu(env, person, rec, (b.done ? "Done: " : "Reopened: ") + rec.tasks[i].what); return { ok: true, rec }; }
    case "set_candidate_stage": {
      const i = ci(b.id); if (i < 0) return { error: "Not found.", status: 404 };
      rec.candidates[i] = cleanCandidate({ stage: b.stage, nextMilestone: b.nextMilestone !== undefined ? b.nextMilestone : rec.candidates[i].nextMilestone }, rec.candidates[i]);
      await writeGgu(env, person, rec, rec.candidates[i].name + ": " + rec.candidates[i].stage); return { ok: true, rec };
    }
    case "add_note": {
      const t = noMail(b.text, 600).trim(); if (!t) return { error: "Write the note first.", status: 400 };
      const i = b.id ? ci(b.id) : -1; const stamp = new Date().toISOString().slice(0, 10);
      if (b.id && i < 0) return { error: "Not found.", status: 404 };
      if (i >= 0) rec.candidates[i].notes = S((rec.candidates[i].notes ? rec.candidates[i].notes + "\n" : "") + stamp + ": " + t, 2000);
      await writeGgu(env, person, rec, "Note" + (i >= 0 ? " on " + rec.candidates[i].name : "") + ": " + t.slice(0, 80)); return { ok: true, rec };
    }
    case "toggle_due": {
      const i = ci(b.id), k = Number(b.index); if (i < 0 || !rec.candidates[i].due[k]) return { error: "Not found.", status: 404 };
      rec.candidates[i].due[k].done = !!b.done; await writeGgu(env, person, rec, rec.candidates[i].name + ": " + rec.candidates[i].due[k].what + (b.done ? " done" : " reopened")); return { ok: true, rec };
    }
  }
  return { error: "Unknown action.", status: 400 };
}

// ---- what is due (shared by the server tests and the page) ----
export const gguToday = (ms) => new Date((ms == null ? Date.now() : ms) + 4 * 3600e3).toISOString().slice(0, 10);
export function openItems(rec, today) {   // every open dated thing, soonest first: tasks, candidate due items, upcoming deadlines
  var t = today, out = [];
  (rec.tasks || []).forEach(function (x, i) { if (!x.done) out.push({ kind: "task", what: x.what, by: x.by || "", i: i }); });
  (rec.candidates || []).forEach(function (c) { (c.due || []).forEach(function (x, i) { if (!x.done) out.push({ kind: "due", what: c.name + ": " + x.what, by: x.by || "", id: c.id, i: i }); }); });
  (rec.deadlines || []).forEach(function (d) { if (d.date >= t) out.push({ kind: "deadline", what: d.what + (d.confirmed ? "" : " (unconfirmed)"), by: d.date }); });
  out.sort(function (a, b) { return (a.by || "9999") < (b.by || "9999") ? -1 : (a.by || "9999") > (b.by || "9999") ? 1 : 0; });
  return out;
}
export function chipFor(by, today) {   // red: today, past or within 2 days; amber: open; green handled by the caller when nothing is open
  if (!by) return "amber";
  var n = Math.round((Date.parse(by + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / 864e5);
  return n <= 2 ? "red" : "amber";
}
export function nextDue(rec, today) {
  var o = openItems(rec, today); if (!o.length) return { cls: "ok", text: "Nothing due" };
  var f = o[0], c = chipFor(f.by, today); return { cls: c, text: (c === "red" ? "Due soon: " : "Due: ") + f.what + (f.by ? " (" + f.by + ")" : ""), item: f };
}
export function candidateChip(c, today) {
  var open = (c.due || []).filter(function (d) { return !d.done; });
  if (!open.length) return { cls: "ok", text: "Nothing due" };
  open.sort(function (a, b) { return (a.by || "9999") < (b.by || "9999") ? -1 : 1; });
  var cls = chipFor(open[0].by, today); return { cls: cls, text: (cls === "red" ? "Due soon: " : "Due: ") + open[0].what + (open.length > 1 ? " +" + (open.length - 1) + " more" : "") };
}

// v788 - grouping shared by the tests and the page. "Mine" = his own degree (tasks and deadlines prefixed "My DBA:" / "My graduation:").
export function gguMine(w) { return /^My (DBA|graduation):/i.test(String(w || "")); }
export function gguGroups(tasks, today) {   // every task once, with its index in rec.tasks: mine | done | late | week (today..+7 days) | later | nodate
  var g = { mine: [], late: [], week: [], later: [], nodate: [], done: [] }, lim = new Date(Date.parse(today + "T00:00:00Z") + 7 * 864e5).toISOString().slice(0, 10);
  (tasks || []).forEach(function (t, i) { var e = { t: t, i: i }; if (/^My (DBA|graduation):/i.test(String(t.what || ""))) g.mine.push(e); else if (t.done) g.done.push(e); else if (!t.by) g.nodate.push(e); else if (t.by < today) g.late.push(e); else if (t.by <= lim) g.week.push(e); else g.later.push(e); });
  var s = function (a, b) { return (a.t.by || "9999") < (b.t.by || "9999") ? -1 : (a.t.by || "9999") > (b.t.by || "9999") ? 1 : 0; };
  g.late.sort(s); g.week.sort(s); g.later.sort(s); return g;
}

// ---- page ----
// v788 (Kendall 6 Nov 2026: "very clean cards ... make sure I can move through there"): a "what's next" card, a grid of section tiles, and seven
// collapsible sections with counts. "My graduation" is built from ownDba plus the tasks and deadlines prefixed "My DBA:" / "My graduation:", which
// then stay out of the general Tasks section. Tasks are grouped (Overdue / This week / Later / No date / Done) and can be added, edited and deleted
// from the page (save_all with the whole task list). Class names carry a g- prefix: the Momo page shell already owns .sec .tl .tk .row .chip .grid.
export const GGU_ICON = '<path d="M3 9l9-5 9 5-9 5z"/><path d="M7 11.5V16c0 1.5 2.2 3 5 3s5-1.5 5-3v-4.5"/><path d="M21 9v5"/>';
const GGU_CSS = '<style>'
  + '.g-up{color:#5F6B66;font-size:.85rem;margin:-8px 0 12px}'
  + '.g-nx{background:#0A4F4A;color:#fff;border-radius:18px;padding:14px 12px 8px;margin:0 0 12px}.g-nx .k{font:600 .68rem "IBM Plex Mono",monospace;letter-spacing:.12em;color:#E6D3A8;text-transform:uppercase;display:flex;align-items:center;gap:6px;margin:0 2px 9px}'
  + '.g-nx button{display:flex;gap:10px;align-items:flex-start;width:100%;box-sizing:border-box;text-align:left;background:rgba(255,255,255,.09);border:0;border-radius:12px;padding:9px 10px;margin:0 0 6px;color:#fff;font:inherit;cursor:pointer}'
  + '.g-nx .d{flex:0 0 62px;font:600 .76rem "IBM Plex Sans",sans-serif;color:#E6D3A8;line-height:1.3}.g-nx .d small{display:block;color:#fff;opacity:.78;font-weight:400;font-size:.68rem}.g-nx .t{flex:1 1 auto;min-width:0;font-size:.86rem;line-height:1.36;overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}'
  + '.g-nx button.late{background:#F6D5D0;color:#8A2A1E}.g-nx button.late .d,.g-nx button.late .d small{color:#8A2A1E}.g-nx p{margin:0 2px 8px;font-size:.9rem}'
  + '.g-jt{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:0 0 16px}.g-jt button,.g-jt a{position:relative;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;gap:5px;min-width:0;background:#fff;border:1px solid #E5DFD3;border-radius:14px;padding:12px 2px 9px;color:#0A4F4A;font:600 .7rem "IBM Plex Sans",sans-serif;cursor:pointer;text-decoration:none}'
  + '.g-jt i{position:absolute;top:5px;right:6px;font-style:normal;background:#F6EEDC;color:#7A5B1E;border-radius:999px;padding:1px 6px;font-size:.64rem;font-weight:700}.ic{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto}'
  + '.gs{margin:0 0 10px;scroll-margin-top:8px}.gs>.hd{display:flex;align-items:center;gap:10px;width:100%;box-sizing:border-box;background:#fff;border:1px solid #E5DFD3;border-radius:14px;padding:13px 14px;color:#0A4F4A;font:600 1.02rem Fraunces,serif;cursor:pointer;text-align:left}'
  + '.gs>.hd .n{margin-left:auto;background:#F6EEDC;color:#7A5B1E;border-radius:999px;padding:2px 9px;font:700 .7rem "IBM Plex Sans",sans-serif;white-space:nowrap}.gs>.hd .cv{display:flex;color:#8A6F3E;transition:transform .15s}.gs.on>.hd .cv{transform:rotate(180deg)}.gs.on>.hd{border-color:#C5A56A;background:#FBF4E6}'
  + '.gs>.bd{display:none;padding:10px 0 6px}.gs.on>.bd{display:block}'
  + '.g-sub{display:flex;align-items:center;gap:8px;font:600 .68rem "IBM Plex Mono",monospace;letter-spacing:.08em;color:#8A6F3E;text-transform:uppercase;margin:16px 2px 7px}.g-sub:first-child{margin-top:2px}.g-sub .g-b{margin-left:auto;text-transform:none;letter-spacing:0}'
  + '.g-c{background:#fff;border:1px solid #E5DFD3;border-radius:14px;padding:12px 14px;margin:0 0 8px;overflow-wrap:anywhere}.g-c h3{margin:0 0 4px;font:600 .98rem Fraunces,serif;color:#0A4F4A}.g-c p{margin:3px 0;color:#3B4441;font-size:.84rem;line-height:1.42}.g-c p b{color:#1C2321}.g-c.g-gold{border-left:4px solid #C5A56A}'
  + '.g-st{display:flex;gap:12px;align-items:center;background:#0A4F4A;color:#fff;border-radius:16px;padding:14px;margin:0 0 8px}.g-st .bi{width:46px;height:46px;border-radius:50%;background:#C5A56A;color:#0A4F4A}.g-st b{display:block;font:600 1.12rem Fraunces,serif}.g-st span.s{display:block;font-size:.8rem;opacity:.85;margin-top:2px;line-height:1.35}'
  + '.g-ch{display:inline-block;border-radius:999px;padding:2px 9px;font:600 .7rem "IBM Plex Sans",sans-serif;background:#F1ECE2;color:#5F6B66;margin:0 5px 3px 0;white-space:nowrap}.g-ch.red{background:#F6D5D0;color:#8A2A1E}.g-ch.amber{background:#F6E7C8;color:#7A5B1E}.g-ch.ok{background:#DDEFE6;color:#1D5B3A}.g-ch.teal{background:#E1EEEC;color:#0A4F4A}.g-ch.un{background:#fff;color:#7A5B1E;border:1px dashed #C5A56A}'
  + '.g-tc{display:flex;gap:2px;align-items:flex-start;background:#fff;border:1px solid #E5DFD3;border-radius:14px;padding:10px 4px 9px 12px;margin:0 0 8px}.g-tc label{display:flex;gap:10px;align-items:flex-start;flex:1 1 auto;min-width:0;cursor:pointer;font-size:.88rem;line-height:1.4;color:#1C2321}'
  + '.g-tc .tx{display:block}.g-tc .mt{display:block;margin-top:6px}.g-tc.done .tx{opacity:.55;text-decoration:line-through}.g-tc.late{border-left:4px solid #B4533C}.g-tc .ed{flex:0 0 36px;width:36px;height:36px;border:0;background:none;color:#8A6F3E;border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}'
  + 'input[type=checkbox],input[type=radio]{width:22px!important;height:22px;min-width:22px;flex:0 0 22px;padding:0!important;margin:2px 0 0!important;border-radius:6px;accent-color:#0A4F4A}label>*:not(input){flex:1 1 auto;min-width:0;overflow-wrap:anywhere}'
  + '.g-b{display:inline-flex;gap:6px;align-items:center;border:1px solid #0A4F4A;background:#fff;color:#0A4F4A;border-radius:999px;padding:7px 12px;font:600 .76rem "IBM Plex Sans",sans-serif;cursor:pointer;text-decoration:none;margin:0 6px 0 0}.g-b.pri{background:#0A4F4A;color:#fff}.g-b.on{background:#0A4F4A;color:#fff}.g-b.q{border-color:#D8D1C4;color:#5F6B66}'
  + '.g-fl{display:flex;flex-wrap:wrap;gap:6px 0;margin:0 0 10px}.g-nt{color:#5F6B66;font-size:.8rem;margin:6px 2px}'
  + '.g-tl{position:relative;margin:0 0 4px;padding:0 0 0 22px}.g-tl:before{content:"";position:absolute;left:6px;top:8px;bottom:8px;width:2px;background:#E5DFD3}.g-tr{position:relative;background:#fff;border:1px solid #E5DFD3;border-radius:14px;padding:10px 12px 8px;margin:0 0 8px;overflow-wrap:anywhere}'
  + '.g-tr:before{content:"";position:absolute;left:-21px;top:15px;width:10px;height:10px;border-radius:50%;background:#0A4F4A;box-shadow:0 0 0 3px #FAF7F1}.g-tr.un{border-style:dashed;border-color:#C5A56A}.g-tr.un:before{box-sizing:border-box;background:#FAF7F1;border:2px solid #C5A56A}'
  + '.g-tr .dt{font:600 .95rem Fraunces,serif;color:#0A4F4A}.g-tr .dt small{font:400 .74rem "IBM Plex Sans",sans-serif;color:#5F6B66;margin-left:7px}.g-tr p{margin:3px 0 6px;font-size:.84rem;line-height:1.4;color:#1C2321}.g-tr.past{opacity:.6}'
  + '.pend{display:flex;gap:10px;align-items:flex-start;background:#F6EEDC;border-radius:14px;padding:11px 12px;margin:0 0 10px;font-size:.84rem;line-height:1.4;color:#7A5B1E;cursor:pointer}.pend.ok{background:#DDEFE6;color:#1D5B3A}'
  + '.lg{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px;margin:0 0 10px}.lc{box-sizing:border-box;min-width:0;display:flex;flex-direction:column;align-items:flex-start;text-align:left;background:#fff;border:1px solid #E5DFD3;border-top:4px solid #0A4F4A;border-radius:14px;padding:11px;cursor:pointer;font:inherit;color:inherit;overflow-wrap:anywhere}'
  + '.av{width:34px;height:34px;flex:0 0 34px;border-radius:50%;background:#0A4F4A;color:#fff;display:flex;align-items:center;justify-content:center;font:600 .8rem Fraunces,serif}.lc .av{margin:0 0 8px}.lc b{display:block;font:600 .95rem Fraunces,serif;color:#0A4F4A;line-height:1.2}.lc small{display:block;color:#5F6B66;font-size:.74rem;margin:2px 0 6px}'
  + '.lc .ind{display:inline-block;border:1px solid #C5A56A;color:#8A6F3E;border-radius:999px;padding:2px 8px;font-size:.68rem;font-weight:600;margin:0 0 7px}.lc p{margin:0 0 8px;font-size:.78rem;color:#1C2321;line-height:1.35;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}'
  + '.lc .nx{margin:auto 0 0;padding-top:7px;border-top:1px solid #EFE9DE;width:100%;font-size:.74rem;color:#3B4441;line-height:1.35}.lc .nx.no{color:#8A938E}.lc .g-ch{margin:7px 0 0;white-space:normal}'
  + '.g-d{display:flex;gap:11px;align-items:flex-start}.g-d .bi{width:36px;height:36px;flex:0 0 36px;border-radius:10px;background:#F6EEDC;color:#8A6F3E}.g-d .x{flex:1 1 auto;min-width:0}.g-d .x b{display:block;font-size:.9rem;line-height:1.32;color:#1C2321;font-weight:600}'
  + '.g-d .x small{display:block;color:#5F6B66;font-size:.78rem;line-height:1.38;margin:3px 0 0;overflow-wrap:anywhere}.g-d .x small.pa{font:400 .66rem "IBM Plex Mono",monospace;color:#7B847F;margin:4px 0 2px}.g-d .x .g-b{margin-top:7px;padding:5px 11px}a.g-c{display:flex;text-decoration:none;color:inherit}'
  + '.cd textarea{width:100%;box-sizing:border-box;border:1px solid #D8D1C4;border-radius:10px;padding:8px;font:400 .84rem "IBM Plex Sans",sans-serif;margin-top:8px;background:#fff}.cd ul{margin:4px 0 0 18px;padding:0;font-size:.82rem}.cd .hh{display:flex;gap:10px;align-items:center;width:100%;background:none;border:0;padding:0;text-align:left;font:inherit;color:inherit;cursor:pointer}.cd .hh>div:not(.av){flex:1 1 auto;min-width:0}.cd .more{display:none;margin-top:10px;text-align:left}.cd.on .more{display:block}'
  + '#lsheet{position:fixed;inset:0;z-index:70;background:rgba(28,35,33,.45);display:none;align-items:flex-end;justify-content:center}#lsheet.on{display:flex}#lsheet .in{background:#FFFDF9;border-radius:20px 20px 0 0;max-width:560px;width:100%;max-height:90vh;overflow:auto;box-sizing:border-box;padding:16px 16px 24px}'
  + '#lsheet h3{font:600 1.15rem Fraunces,serif;color:#0A4F4A;margin:0 0 2px}#lsheet .k{font:600 .68rem "IBM Plex Mono",monospace;letter-spacing:.06em;color:#8A6F3E;text-transform:uppercase;margin:14px 0 4px}#lsheet p{margin:3px 0;font-size:.86rem;color:#1C2321;line-height:1.45;overflow-wrap:anywhere}'
  + '#lsheet input,#lsheet textarea{box-sizing:border-box;width:100%;border:1px solid #D8D1C4;border-radius:10px;padding:9px;font:400 .86rem "IBM Plex Sans",sans-serif;background:#fff;margin:3px 0}#lsheet .row{display:grid;grid-template-columns:1fr 90px;gap:6px;margin:0}'
  + '#lsheet .it{background:#fff;border:1px solid #E5DFD3;border-radius:10px;padding:8px 10px;margin:4px 0;font-size:.84rem;display:flex;gap:8px;align-items:flex-start;justify-content:space-between;overflow-wrap:anywhere}#lsheet .it button{border:0;background:none;color:#B4533C;font-size:.8rem;cursor:pointer}'
  + '#lsheet .bt{border:1px solid #0A4F4A;background:#fff;color:#0A4F4A;border-radius:999px;padding:8px 14px;font:600 .82rem "IBM Plex Sans",sans-serif;cursor:pointer;margin:8px 6px 0 0}#lsheet .bt.pri{background:#0A4F4A;color:#fff}#lsheet .bt.del{border-color:#B4533C;color:#B4533C}#lsheet .top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}'
  + '#gtoast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%) translateY(20px);z-index:90;background:#0A4F4A;color:#fff;border-radius:999px;padding:10px 18px;font:600 .84rem "IBM Plex Sans",sans-serif;opacity:0;pointer-events:none;transition:opacity .2s,transform .2s;max-width:86vw;text-align:center;box-shadow:0 6px 20px rgba(28,35,33,.25)}#gtoast.on{opacity:1;transform:translateX(-50%)}'
  + '#gtop{position:fixed;right:14px;bottom:18px;z-index:60;width:46px;height:46px;border-radius:50%;border:0;background:#0A4F4A;color:#fff;display:none;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 6px 18px rgba(28,35,33,.28);padding:0}#gtop.on{display:flex}'
  + '@media(min-width:760px){.w{max-width:720px}.g-2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px;margin:0 0 8px}.g-2>*{margin:0}.lg{grid-template-columns:repeat(3,minmax(0,1fr))}}'
  + '</style>';
const GGU_SECS = [["grad", "My graduation", "<div id=ggrad></div>"], ["learn", "My learners", "<div id=gchair></div><div class=lg id=glearn></div><div id=gcontact></div><div id=gcand></div>"], ["tasks", "Tasks", "<div id=gtk></div>"],
  ["dates", "Dates", "<div id=gdl></div>"], ["docs", "Documents", "<div class=g-2 id=gdocs></div>"], ["people", "People", "<div class=g-2 id=gct></div><div id=groles></div>"], ["links", "Links", "<div class=g-2 id=glinks></div>"]];
export const GGU_BODY = GGU_CSS + '<a class=back href="/momo" id=gback>&#8592; Momo</a><div class=tag>MOMO</div><h1>GGU</h1><p class=g-up id=gupd>Loading...</p><div id=gnext></div><div class=g-jt id=gjump></div>'
  + GGU_SECS.map((s) => '<section class=gs id=s_' + s[0] + '><button type=button class=hd data-s=' + s[0] + '><span class=ic id=i_' + s[0] + '></span><span>' + s[1] + '</span><span class=n id=n_' + s[0] + '></span><span class=cv></span></button><div class=bd>' + s[2] + '</div></section>').join("")
  + '<div id=lsheet><div class=in id=lsin></div></div><div id=gtoast role=status></div><button type=button id=gtop aria-label="Back to the sections"></button>';
export const GGU_JS = "var __name=function(f){return f};var gguToday=" + gguToday.toString() + ";var openItems=" + openItems.toString() + ";var chipFor=" + chipFor.toString() + ";var nextDue=" + nextDue.toString() + ";var candidateChip=" + candidateChip.toString() + ";var gguMine=" + gguMine.toString() + ";var gguGroups=" + gguGroups.toString() + ";" + String.raw`(function(){
var KEY=new URLSearchParams(location.search).get("key")||"",REC=null,$=function(i){return document.getElementById(i)};
$("gback").href="/momo?door=1&key="+encodeURIComponent(KEY);
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
function api(b){return fetch("/momo/work/ggu/api?key="+encodeURIComponent(KEY),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)}).then(function(r){return r.json()})}
function say(t){var o=$("gtoast");o.textContent=t;o.className="on";clearTimeout(say.t);say.t=setTimeout(function(){o.className=""},2000)}
function send(b,msg){return api(b).then(function(r){if(r&&r.rec){REC=r.rec;draw();say(msg||"Saved")}else{draw();say((r&&r.error)||"Not saved. Try again.")}return r}).catch(function(){draw();say("Not saved. Check the connection.")})}
function chip(c){return el("span","g-ch "+c.cls,c.text)}
function ch(c,t){return el("span","g-ch"+(c?" "+c:""),t)}
function copyT(t,btn){var done=function(){var o=btn.textContent;btn.textContent="Copied";setTimeout(function(){btn.textContent=o},1500)};if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(done,function(){window.prompt("Copy:",t)})}else{window.prompt("Copy:",t)}}
var SV='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden=true ';
var P={next:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',grad:'<path d="M3 9l9-5 9 5-9 5z"/><path d="M7 11.5V16c0 1.5 2.2 3 5 3s5-1.5 5-3v-4.5"/><path d="M21 9v5"/>',
 learn:'<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17.5" cy="9" r="2.4"/><path d="M17 14.3c2.3.5 4 2.8 4 5.7"/>',
 tasks:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12l3 3 5-6"/>',dates:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
 docs:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 13h6M9 17h6"/>',folder:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
 people:'<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7"/>',links:'<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
 rep:'<path d="M7 8V3h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><rect x="7" y="14" width="10" height="7" rx="1"/>',
 edit:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',plus:'<path d="M12 5v14M5 12h14"/>',chev:'<path d="M6 9l6 6 6-6"/>',up:'<path d="M6 15l6-6 6 6"/>',
 phone:'<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',role:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>'};
function ic(n,s){return SV+"width="+(s||18)+" height="+(s||18)+">"+P[n]+"</svg>"}
function icon(n,s,c){var e=el("span","ic"+(c?" "+c:""));e.innerHTML=ic(n,s);return e}
function btn(t,c,i){var b=el("button","g-b"+(c?" "+c:""));b.type="button";if(i)b.innerHTML=ic(i,14);b.appendChild(document.createTextNode(t));return b}
var IC={mail:SV+'width=15 height=15><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>'};
var MO=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fd(d){return d?(+d.slice(8,10))+" "+MO[+d.slice(5,7)-1]+" "+d.slice(0,4):""}
function dn(d,T){return Math.round((Date.parse(d+"T00:00:00Z")-Date.parse(T+"T00:00:00Z"))/864e5)}
function rel(d,T,past){var n=dn(d,T);return n<0?(-n)+(n===-1?" day ":" days ")+(past||"late"):n===0?"today":n===1?"tomorrow":n<=21?"in "+n+" days":""}
var RX=/^(My DBA|My graduation|Chair):\s*/i;
function bare(w){var s=String(w||"").replace(RX,"");return s.charAt(0).toUpperCase()+s.slice(1)}
function pre(w){var m=RX.exec(w||"");return m?m[1]:""}
function sub(p,t){var s=el("div","g-sub",t);p.appendChild(s);return s}
function ini(n){return String(n||"?").replace(/^(Dr|Prof|Mr|Ms|Mrs)\.?\s+/i,"").split(/\s+/).map(function(x){return x.charAt(0)}).join("").replace(/[^A-Za-z]/g,"").slice(0,2).toUpperCase()||"?"}

var OPEN={grad:1,learn:1,tasks:1,dates:1};try{var sv0=JSON.parse(localStorage.getItem("ggu_open")||"null");if(sv0&&typeof sv0==="object")OPEN=sv0}catch(e){}
var SEC=["grad","learn","tasks","dates","docs","people","links"];
function paint(){SEC.forEach(function(s){$("s_"+s).className="gs"+(OPEN[s]?" on":"")})}
function setOpen(s,on){OPEN[s]=on?1:0;try{localStorage.setItem("ggu_open",JSON.stringify(OPEN))}catch(e){}paint()}
function jump(s){setOpen(s,true);var e=$("s_"+s);if(e.scrollIntoView)e.scrollIntoView({behavior:"smooth",block:"start"})}
SEC.forEach(function(s){$("i_"+s).innerHTML=ic(s,20);var h=$("s_"+s).firstChild;h.lastChild.innerHTML=ic("chev",18);h.onclick=function(){setOpen(s,!OPEN[s])}});paint();
$("gtop").innerHTML=ic("up",22);$("gtop").onclick=function(){window.scrollTo({top:0,behavior:"smooth"})};
window.addEventListener("scroll",function(){$("gtop").className=(window.pageYOffset||document.documentElement.scrollTop||0)>420?"on":""});

function dchip(by,T,done){if(!by)return ch("","No date");var n=dn(by,T),r=rel(by,T);return ch(done?"":n<=2?"red":n<=7?"amber":"",fd(by)+(r&&!done?" · "+r:""))}
function taskCard(t,i,T,tag,extra){var c=el("div","g-tc"+(t.done?" done":(t.by&&t.by<T?" late":""))),lb=el("label"),cb=el("input");cb.type="checkbox";cb.checked=!!t.done;
 cb.onchange=function(){send({action:"set_task_done",index:i,done:cb.checked},cb.checked?"Ticked off":"Reopened")};lb.appendChild(cb);
 var s=el("span");s.appendChild(el("span","tx",bare(t.what)));var m=el("span","mt"),p=pre(t.what);if(tag&&p)m.appendChild(ch("teal",/^chair$/i.test(p)?"Chairing":p));if(extra)m.appendChild(ch("amber",extra));m.appendChild(dchip(t.by,T,t.done));s.appendChild(m);lb.appendChild(s);c.appendChild(lb);
 var e=el("button","ed");e.type="button";e.title="Edit";e.setAttribute("aria-label","Edit task");e.innerHTML=ic("edit",17);e.onclick=function(){openT(i)};c.appendChild(e);return c}
function dateRow(d,T,tag){var r=el("div","g-tr"+(d.confirmed?"":" un")+(d.date<T?" past":"")),h=el("div","dt",fd(d.date)),rl=rel(d.date,T,"ago");if(rl)h.appendChild(el("small","",rl));r.appendChild(h);r.appendChild(el("p","",bare(d.what)));
 var p=pre(d.what);if(tag&&p)r.appendChild(ch("teal",/^chair$/i.test(p)?"Chairing":p));r.appendChild(d.confirmed?ch("ok","Confirmed"):ch("un","Not confirmed"));return r}
function byDate(a,b){var x=(a.t?a.t.by:a.date)||"9999",y=(b.t?b.t.by:b.date)||"9999";return x<y?-1:x>y?1:0}

function drawNext(T){var nx=$("gnext");nx.textContent="";var b=el("div","g-nx"),k=el("div","k");k.innerHTML=ic("next",15);k.appendChild(document.createTextNode("What’s next"));b.appendChild(k);
 var o=openItems(REC,T),late=o.filter(function(x){return x.by&&x.by<T}),up=o.filter(function(x){return x.by&&x.by>=T}).slice(0,3);
 var where=function(x){return x.kind==="due"?"learn":gguMine(x.what)?"grad":x.kind==="task"?"tasks":"dates"};
 var row=function(cls,d,ds,t,to){var r=el("button",cls);r.type="button";var dd=el("span","d",d);if(ds)dd.appendChild(el("small","",ds));r.appendChild(dd);r.appendChild(el("span","t",t));r.onclick=function(){jump(to)};b.appendChild(r)};
 if(late.length){var gl=late.filter(function(x){return where(x)==="tasks"});row("late","Overdue",late.length+(late.length===1?" item":" items"),"Oldest: "+bare(late[0].what),gl.length?"tasks":where(late[0]))}
 up.forEach(function(x){row("",fd(x.by).replace(/ \d{4}$/,""),rel(x.by,T)||x.by.slice(0,4),bare(x.what).replace(" (unconfirmed)"," (date not confirmed)"),where(x))});
 if(!late.length&&!up.length)b.appendChild(el("p","","You are up to date."));nx.appendChild(b)}

function drawJump(N){var j=$("gjump");j.textContent="";[["grad","Graduation"],["learn","Learners"],["tasks","Tasks"],["dates","Dates"],["docs","Documents"],["people","People"],["links","Links"]].forEach(function(s){var t=el("button");t.type="button";t.innerHTML=ic(s[0],22);t.appendChild(el("span","",s[1]));if(N[s[0]])t.appendChild(el("i","",String(N[s[0]])));t.onclick=function(){jump(s[0])};j.appendChild(t);$("n_"+s[0]).textContent=N[s[0]+"_t"]||String(N[s[0]]||0)});
 var a=el("a");a.id="grep";a.target="_blank";a.rel="noopener";a.href="/momo/work/ggu/report?key="+encodeURIComponent(KEY);a.innerHTML=ic("rep",22);a.appendChild(el("span","","Report"));j.appendChild(a)}

var NOTES=false;
function drawGrad(T,G){var w=$("ggrad");w.textContent="";var o=REC.ownDba||{};
 var st=el("div","g-st");st.appendChild(icon("grad",26,"bi"));var x=el("div");x.appendChild(el("b","",o.completed||"Status not recorded"));x.appendChild(el("span","s",["Doctor of Business Administration (DBA)","Golden Gate University",o.cohort?"Cohort "+o.cohort:"",o.mode].filter(Boolean).join(" · ")));st.appendChild(x);w.appendChild(st);
 var M=G.mine,dn0=M.filter(function(e){return e.t.done}),wt=M.filter(function(e){return !e.t.done&&/\bSENT\b/.test(e.t.what)}),nx=M.filter(function(e){return !e.t.done&&!/\bSENT\b/.test(e.t.what)}).sort(byDate);
 var D=REC.deadlines.filter(function(d){return gguMine(d.what)}).sort(byDate),cer=D.filter(function(d){return /ceremony|commencement/i.test(d.what)})[0];
 var isC=function(w0){return /^My graduation:/i.test(w0)};
 if(dn0.length||wt.length){sub(w,"Done and sent");dn0.forEach(function(e){w.appendChild(taskCard(e.t,e.i,T))});wt.forEach(function(e){w.appendChild(taskCard(e.t,e.i,T,false,"Sent · waiting for a reply"))})}
 var s1=sub(w,"Next: diploma and transcript"),a1=btn("Add","","plus");a1.onclick=function(){openT(-1,"My DBA: ")};s1.appendChild(a1);
 nx.filter(function(e){return !isC(e.t.what)}).forEach(function(e){w.appendChild(taskCard(e.t,e.i,T))});
 var d1=D.filter(function(d){return !isC(d.what)&&d.date>=T});if(d1.length){var t1=el("div","g-tl");d1.forEach(function(d){t1.appendChild(dateRow(d,T))});w.appendChild(t1)}
 var s2=sub(w,"Ceremony"),a2=btn("Add","","plus");a2.onclick=function(){openT(-1,"My graduation: ")};s2.appendChild(a2);
 if(cer){var c=el("div","g-c g-gold");c.appendChild(cer.confirmed?ch("ok","Confirmed · "+fd(cer.date)):ch("un","Date not confirmed"));c.appendChild(el("p","",bare(cer.what)));if(!cer.confirmed)c.appendChild(el("p","g-nt","Placeholder in the diary: "+fd(cer.date)));w.appendChild(c)}
 nx.filter(function(e){return isC(e.t.what)}).forEach(function(e){w.appendChild(taskCard(e.t,e.i,T))});
 var d2=D.filter(function(d){return isC(d.what)&&d!==cer&&d.date>=T});if(d2.length){var t2=el("div","g-tl");d2.forEach(function(d){t2.appendChild(dateRow(d,T))});w.appendChild(t2)}
 if(o.notes){var nb=btn(NOTES?"Hide the notes":"Notes and record","q");nb.style.marginTop="6px";nb.onclick=function(){NOTES=!NOTES;draw()};w.appendChild(nb);
  if(NOTES){var nc=el("div","g-c");nc.style.marginTop="8px";o.notes.split(/(?=\[[A-Z][^\]]{2,60}\])/).forEach(function(seg){var m=/^\[([^\]]+)\]\s*/.exec(seg),p=el("p");if(m){p.appendChild(el("b","",m[1].charAt(0)+m[1].slice(1).toLowerCase()+": "));p.appendChild(document.createTextNode(seg.slice(m[0].length)))}else p.textContent=seg;nc.appendChild(p)});w.appendChild(nc)}}}

function drawChair(){var C=REC.chair||{learners:[]},w=$("gchair"),T=gguToday(),L=C.learners||[];w.textContent="";
 var plans={};L.forEach(function(l){var k=l.plan||"Plan not recorded";plans[k]=(plans[k]||0)+1});
 sub(w,[C.cohort,C.role?"you are "+C.role:""].filter(Boolean).join(" · "));
 if(C.note){var pd=el("label","pend"+(C.acknowledged?" ok":""));var cb=el("input");cb.type="checkbox";cb.checked=!!C.acknowledged;cb.onchange=function(){send({action:"chair_ack",done:cb.checked},cb.checked?"Marked as confirmed":"Reopened")};pd.appendChild(cb);var ps=el("span");ps.appendChild(el("b","",C.acknowledged?"Allocation confirmed to upGrad. ":"Tick when you have confirmed to upGrad. "));ps.appendChild(document.createTextNode(C.note));pd.appendChild(ps);w.appendChild(pd)}
 w.appendChild(el("p","g-nt",L.length+(L.length===1?" learner":" learners")+": "+Object.keys(plans).map(function(k){return plans[k]+" "+k}).join(", ")+". Tap a card for the full sheet."));
 var g=$("glearn");g.textContent="";L.forEach(function(l){var c=el("button","lc");c.type="button";c.appendChild(el("div","av",ini(l.name)));c.appendChild(el("b","",l.name));c.appendChild(el("small","",l.country));if(l.plan)c.appendChild(el("span","ind",l.plan));c.appendChild(el("p","",l.title));
  var ms=(l.milestones||[]).filter(function(m){return !m.done}).sort(function(a,b){return (a.by||"9999")<(b.by||"9999")?-1:1})[0],nm=(l.meetings||[]).filter(function(m){return m.date&&m.date>=T}).sort(function(a,b){return a.date<b.date?-1:1})[0];
  var n=el("div","nx"+(ms||nm||l.stage?"":" no"));n.textContent=nm?"Meeting "+fd(nm.date)+(nm.time?" "+nm.time:""):ms?"Next: "+ms.what+(ms.by?" · "+fd(ms.by):""):l.stage?"Stage: "+l.stage:"No meeting booked yet";c.appendChild(n);
  if(!C.acknowledged&&/not (yet )?confirmed|unconfirmed/i.test(l.notes||""))c.appendChild(ch("amber","Acceptance not confirmed"));
  c.onclick=function(){openL(l.id)};g.appendChild(c)});
 var k=$("gcontact");k.textContent="";if(C.contact&&C.contact.name){sub(k,"Cohort contact");var b=el("div","g-c g-d");b.appendChild(el("div","av",ini(C.contact.name)));var x=el("div","x");x.appendChild(el("b","",C.contact.name));if(C.contact.role)x.appendChild(el("small","",C.contact.role));
  if(C.contact.phone){var t=el("a","g-b");t.innerHTML=ic("phone",14);t.appendChild(document.createTextNode(C.contact.phone));t.href="tel:"+C.contact.phone.replace(/[^0-9+]/g,"");x.appendChild(t)}if(C.contact.booking){var bk=el("a","g-b");bk.innerHTML=ic("dates",14);bk.appendChild(document.createTextNode("Book a 15-minute call"));bk.href=C.contact.booking;bk.target="_blank";bk.rel="noopener";x.appendChild(bk)}b.appendChild(x);k.appendChild(b)}}
var DRAFT=null;function openL(id){var l=(REC.chair.learners||[]).filter(function(x){return x.id===id})[0];if(!l)return;DRAFT=JSON.parse(JSON.stringify(l));drawL();$("lsheet").className="on"}
function closeL(){$("lsheet").className="";DRAFT=null}
function lst(key,box,fmt){(DRAFT[key]||[]).forEach(function(it,i){var r=el("div","it");r.appendChild(el("span","",fmt(it)));var x=el("button","","Remove");x.type="button";x.onclick=function(){DRAFT[key].splice(i,1);drawL()};r.appendChild(x);box.appendChild(r)})}
function drawL(){var l=DRAFT,b=$("lsin");b.textContent="";var top=el("div","top");var h=el("div");h.appendChild(el("h3","",l.name));h.appendChild(el("p","",[l.plan,l.country].filter(Boolean).join(" · ")));top.appendChild(h);var cx=el("button","bt","Close");cx.type="button";cx.style.marginTop="0";cx.onclick=closeL;top.appendChild(cx);b.appendChild(top);
if(l.email){var m=el("a","bt");m.href="mailto:"+l.email;m.innerHTML=IC.mail+" ";m.appendChild(document.createTextNode(l.email));m.style.display="inline-flex";m.style.gap="6px";m.style.alignItems="center";m.style.textDecoration="none";b.appendChild(m)}
b.appendChild(el("div","k","Industry"));b.appendChild(el("p","",l.industry||"-"));b.appendChild(el("div","k","Dissertation title"));b.appendChild(el("p","",l.title||"-"));b.appendChild(el("div","k","Summary"));b.appendChild(el("p","",l.summary||"-"));
b.appendChild(el("div","k","Stage"));var st=el("input");st.placeholder="e.g. Proposal, Chapter 1 draft, Defense";st.value=l.stage||"";st.oninput=function(){DRAFT.stage=st.value};b.appendChild(st);
b.appendChild(el("div","k","Meetings"));var mb=el("div");lst("meetings",mb,function(it){return [it.date,it.time].filter(Boolean).join(" ")+(it.what?" · "+it.what:"")});b.appendChild(mb);
var mr=el("div","row"),md=el("input"),mt=el("input"),mw=el("input");md.type="date";mt.type="time";mw.placeholder="What it is for (optional)";mr.appendChild(md);mr.appendChild(mt);b.appendChild(mr);b.appendChild(mw);var ma=el("button","bt","Add meeting");ma.type="button";ma.onclick=function(){if(!md.value&&!mw.value.trim())return;DRAFT.meetings=(DRAFT.meetings||[]).concat([{date:md.value,time:mt.value,what:mw.value.trim()}]);drawL()};b.appendChild(ma);
b.appendChild(el("div","k","Milestones"));var ml=el("div");lst("milestones",ml,function(it){return it.what+(it.by?" · by "+it.by:"")+(it.done?" · done":"")});b.appendChild(ml);
var nr=el("div","row"),nw=el("input"),nb=el("input");nw.placeholder="Milestone";nb.type="date";nr.appendChild(nw);nr.appendChild(nb);b.appendChild(nr);var na=el("button","bt","Add milestone");na.type="button";na.onclick=function(){if(!nw.value.trim())return;DRAFT.milestones=(DRAFT.milestones||[]).concat([{what:nw.value.trim(),by:nb.value,done:false}]);drawL()};b.appendChild(na);
b.appendChild(el("div","k","Documents & links"));var dl=el("div");lst("docs",dl,function(it){return it.label+(it.url?" · "+it.url:"")});b.appendChild(dl);var dla=el("input"),dlu=el("input");dla.placeholder="Label (e.g. Proposal v1)";dlu.placeholder="Link or file path";b.appendChild(dla);b.appendChild(dlu);var da=el("button","bt","Add document");da.type="button";da.onclick=function(){if(!dla.value.trim()&&!dlu.value.trim())return;DRAFT.docs=(DRAFT.docs||[]).concat([{label:dla.value.trim(),url:dlu.value.trim()}]);drawL()};b.appendChild(da);
b.appendChild(el("div","k","Notes"));var nt=el("textarea");nt.rows=4;nt.value=l.notes||"";nt.oninput=function(){DRAFT.notes=nt.value};b.appendChild(nt);
var sv=el("button","bt pri","Save");sv.type="button";sv.onclick=function(){sv.disabled=true;sv.textContent="Saving…";api({action:"learner_save",id:DRAFT.id,learner:{stage:DRAFT.stage,meetings:DRAFT.meetings,milestones:DRAFT.milestones,docs:DRAFT.docs,notes:DRAFT.notes}}).then(function(r){if(r.rec){REC=r.rec;closeL();draw();say("Saved")}else{sv.disabled=false;sv.textContent="Save";say(r.error||"Not saved. Try again.")}}).catch(function(){sv.disabled=false;sv.textContent="Save";say("Not saved. Check the connection.")})};b.appendChild(sv)}
$("lsheet").onclick=function(e){if(e.target===$("lsheet"))closeL()};
function openT(i,pf){var t=i>=0?REC.tasks[i]:{what:pf||"",by:"",done:false};if(!t)return;DRAFT=null;var b=$("lsin");b.textContent="";var top=el("div","top");top.appendChild(el("h3","",i>=0?"Edit task":"New task"));var cx=el("button","bt","Close");cx.type="button";cx.style.marginTop="0";cx.onclick=closeL;top.appendChild(cx);b.appendChild(top);
 b.appendChild(el("div","k","What needs doing"));var ta=el("textarea");ta.rows=4;ta.maxLength=200;ta.value=t.what;b.appendChild(ta);b.appendChild(el("div","k","Due date (optional)"));var dt=el("input");dt.type="date";dt.value=t.by||"";b.appendChild(dt);
 var sv=el("button","bt pri","Save");sv.type="button";b.appendChild(sv);var put=function(L,note,msg){sv.disabled=true;api({action:"save_all",rec:{tasks:L},note:note}).then(function(r){if(r.rec){REC=r.rec;closeL();draw();say(msg)}else{sv.disabled=false;say(r.error||"Not saved. Try again.")}}).catch(function(){sv.disabled=false;say("Not saved. Check the connection.")})};
 var copy=function(){return REC.tasks.map(function(x){return {what:x.what,by:x.by,done:x.done}})};
 sv.onclick=function(){var w=ta.value.trim();if(!w||/^(My DBA|My graduation|Chair):$/i.test(w)){ta.focus();return}var L=copy();if(i>=0){L[i].what=w;L[i].by=dt.value}else{if(L.length>=40){say("The list is full (40 tasks). Delete a finished one first.");return}L.push({what:w,by:dt.value,done:false})}put(L,(i>=0?"Task edited: ":"Task added: ")+w.slice(0,120),i>=0?"Task saved":"Task added")};
 if(i>=0){var dl=el("button","bt del","Delete");dl.type="button";dl.onclick=function(){if(!window.confirm("Delete this task?"))return;var L=copy();L.splice(i,1);put(L,"Task deleted: "+t.what.slice(0,120),"Task deleted")};b.appendChild(dl)}
 $("lsheet").className="on"}

var CO={};
function drawCand(T){var cd=$("gcand");cd.textContent="";if(!REC.candidates.length)return;sub(cd,"Earlier cohorts");
REC.candidates.forEach(function(c){var x=el("div","g-c cd"+(CO[c.id]?" on":"")),hh=el("button","hh");hh.type="button";hh.appendChild(el("div","av",ini(c.name)));var hd=el("div");hd.appendChild(el("h3","",c.name));hd.appendChild(el("p","",[c.cohort?"Cohort "+c.cohort:"",c.mode].filter(Boolean).join(" · ")));hd.appendChild(chip(candidateChip(c,T)));hh.appendChild(hd);hh.appendChild(icon("chev",18));hh.onclick=function(){CO[c.id]=!CO[c.id];draw()};x.appendChild(hh);
var mo=el("div","more");x.appendChild(mo);if(c.topic)mo.appendChild(el("p","",c.topic));
var p1=el("p");p1.appendChild(el("b","","Stage: "));p1.appendChild(document.createTextNode(c.stage||"-"));mo.appendChild(p1);var p2=el("p");p2.appendChild(el("b","","Next: "));p2.appendChild(document.createTextNode(c.nextMilestone||"-"));mo.appendChild(p2);
if(c.feedbackOwed){var p3=el("p");p3.appendChild(el("b","","Feedback owed: "));p3.appendChild(document.createTextNode(c.feedbackOwed));mo.appendChild(p3)}
if(c.meetings&&c.meetings.length){var ul=el("ul");c.meetings.forEach(function(m){ul.appendChild(el("li","",(m.when?m.when+": ":"")+m.what))});mo.appendChild(ul)}
if(c.due&&c.due.length){var tk=el("div");tk.style.marginTop="10px";c.due.forEach(function(d,i){var r=el("div","g-tc"+(d.done?" done":(d.by&&d.by<T?" late":""))),lb=el("label"),cb=el("input");cb.type="checkbox";cb.checked=!!d.done;cb.onchange=function(){send({action:"toggle_due",id:c.id,index:i,done:cb.checked},cb.checked?"Ticked off":"Reopened")};lb.appendChild(cb);var s=el("span");s.appendChild(el("span","tx",d.what));var m=el("span","mt");m.appendChild(dchip(d.by,T,d.done));s.appendChild(m);lb.appendChild(s);r.appendChild(lb);tk.appendChild(r)});mo.appendChild(tk)}
if(c.notes)mo.appendChild(el("p","",c.notes));
var ta=el("textarea");ta.rows=2;ta.placeholder="Add a note";mo.appendChild(ta);var sv=btn("Save note");sv.style.marginTop="8px";sv.onclick=function(){if(!ta.value.trim())return;send({action:"add_note",id:c.id,text:ta.value},"Note saved")};mo.appendChild(sv);cd.appendChild(x)})}

var DONE=false;
function drawTasks(T,G){var w=$("gtk");w.textContent="";var a=btn("Add a task","pri","plus");a.onclick=function(){openT(-1,"")};var fl=el("div","g-fl");fl.appendChild(a);w.appendChild(fl);
 [["late","Overdue"],["week","This week"],["later","Later"],["nodate","No date"]].forEach(function(g){var L=G[g[0]];if(!L.length)return;sub(w,g[1]+" ("+L.length+")");L.forEach(function(e){w.appendChild(taskCard(e.t,e.i,T,true))})});
 if(!G.late.length&&!G.week.length&&!G.later.length&&!G.nodate.length)w.appendChild(el("p","g-nt","No open tasks."));
 if(G.done.length){var s=sub(w,"Done ("+G.done.length+")"),b=btn(DONE?"Hide":"Show","q");b.onclick=function(){DONE=!DONE;draw()};s.appendChild(b);if(DONE)G.done.forEach(function(e){w.appendChild(taskCard(e.t,e.i,T,true))})}
 if(G.mine.length){var n=el("p","g-nt");n.appendChild(document.createTextNode("Your own degree tasks ("+G.mine.length+") are under "));var j=el("a","","My graduation");j.href="#s_grad";j.style.color="#0A4F4A";j.style.fontWeight="600";j.onclick=function(e){e.preventDefault();jump("grad")};n.appendChild(j);n.appendChild(document.createTextNode("."));w.appendChild(n)}}

var DF="chair",PAST=false;
function drawDates(T){var w=$("gdl");w.textContent="";var all=REC.deadlines.slice().sort(byDate),ch0=all.filter(function(d){return !gguMine(d.what)}),L=DF==="all"?all:ch0;
 if(all.length!==ch0.length){var fl=el("div","g-fl");[["chair","Chairing ("+ch0.length+")"],["all","All dates ("+all.length+")"]].forEach(function(f){var b=btn(f[1],DF===f[0]?"on":"");b.onclick=function(){DF=f[0];draw()};fl.appendChild(b)});w.appendChild(fl)}
 var up=L.filter(function(d){return d.date>=T}),pa=L.filter(function(d){return d.date<T});
 if(up.length){var t=el("div","g-tl");up.forEach(function(d){t.appendChild(dateRow(d,T,DF==="all"))});w.appendChild(t)}else w.appendChild(el("p","g-nt","No dates coming up."));
 if(pa.length){var s=sub(w,"Past ("+pa.length+")"),b=btn(PAST?"Hide":"Show","q");b.onclick=function(){PAST=!PAST;draw()};s.appendChild(b);if(PAST){var t2=el("div","g-tl");pa.forEach(function(d){t2.appendChild(dateRow(d,T,DF==="all"))});w.appendChild(t2)}}}

function drawDocs(){var dc=$("gdocs");dc.textContent="";REC.documents.forEach(function(d){var web=/^https?:/.test(d.path_or_url),x=el("div","g-c g-d");x.appendChild(icon(/[\\\/]$/.test(d.path_or_url)?"folder":"docs",19,"bi"));var y=el("div","x");y.appendChild(el("b","",d.label));y.appendChild(el("small","pa",d.path_or_url));
 if(web){var a=el("a","g-b","Open");a.href=d.path_or_url;a.target="_blank";a.rel="noopener";y.appendChild(a)}else{var bt=btn("Copy path");bt.onclick=function(){copyT(d.path_or_url,bt)};y.appendChild(bt)}x.appendChild(y);dc.appendChild(x)});
 if(!REC.documents.length)dc.appendChild(el("p","g-nt","No documents yet."))}
function drawLinks(){var w=$("glinks");w.textContent="";REC.portals.forEach(function(p){var x=el(p.url?"a":"div","g-c g-d");if(p.url){x.href=p.url;x.target="_blank";x.rel="noopener"}x.appendChild(icon("links",19,"bi"));var y=el("div","x");y.appendChild(el("b","",p.label));
 if(p.url)y.appendChild(el("small","pa",p.url.replace(/^https?:\/\//,"").replace(/\/$/,"")));else{var c=ch("un","Address not recorded");c.style.marginTop="6px";y.appendChild(c)}x.appendChild(y);w.appendChild(x)});
 if(!REC.portals.length)w.appendChild(el("p","g-nt","No links yet."))}
function drawPeople(){var ct=$("gct");ct.textContent="";REC.contacts.forEach(function(c){var x=el("div","g-c g-d");x.appendChild(el("div","av",ini(c.name)));var y=el("div","x");y.appendChild(el("b","",c.name));var ph=/\.?\s*Phone:?\s*(\+[0-9][0-9 ]{6,18}[0-9])/i.exec(c.role||""),role=ph?c.role.replace(ph[0],"").trim():c.role;if(role)y.appendChild(el("small","",role));
 if(ph){var t=el("a","g-b");t.innerHTML=ic("phone",14);t.appendChild(document.createTextNode(ph[1]));t.href="tel:"+ph[1].replace(/[^0-9+]/g,"");y.appendChild(t)}x.appendChild(y);ct.appendChild(x)});
 var ro=$("groles");ro.textContent="";if(REC.roles.length)sub(ro,"My roles");REC.roles.forEach(function(q){var x=el("div","g-c g-d");x.appendChild(icon("role",19,"bi"));var y=el("div","x");y.appendChild(el("b","",q.title));if(q.detail)y.appendChild(el("small","",q.detail));if(q.source)y.appendChild(el("small","pa","Source: "+q.source));x.appendChild(y);ro.appendChild(x)})}

function draw(){var T=gguToday(),G=gguGroups(REC.tasks,T);$("gupd").textContent=(REC.updatedAt?"Updated "+fd(REC.updatedAt.slice(0,10)):"No data yet");
 var openG=G.late.length+G.week.length+G.later.length+G.nodate.length,openM=G.mine.filter(function(e){return !e.t.done}).length,upD=REC.deadlines.filter(function(d){return d.date>=T&&!gguMine(d.what)}).length,nl=((REC.chair||{}).learners||[]).length+REC.candidates.length;
 drawNext(T);drawJump({grad:openM,grad_t:openM+" open",learn:nl,tasks:openG,tasks_t:openG+" open"+(G.late.length?" · "+G.late.length+" overdue":""),dates:upD,dates_t:upD+" coming up",docs:REC.documents.length,people:REC.contacts.length,links:REC.portals.length});
 drawGrad(T,G);drawChair();drawCand(T);drawTasks(T,G);drawDates(T);drawDocs();drawPeople();drawLinks()}
fetch("/momo/work/ggu/rec?key="+encodeURIComponent(KEY)).then(function(r){return r.json()}).then(function(d){REC=d.rec;draw()}).catch(function(){$("gupd").textContent="Could not load. Try again."})})();`;

const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const R_CSS = '@page{size:A4 portrait;margin:14mm}body{margin:0;background:#fff;color:#1C2321;font-family:"IBM Plex Sans",Arial,sans-serif;font-size:10.5pt}.bd{padding:0 2mm}h1{font-family:Georgia,serif;color:#0A4F4A;font-size:20pt;margin:0 0 2mm}'
  + '.rule{height:2px;background:#C5A56A;margin:0 0 5mm}h2{font-family:Georgia,serif;color:#0A4F4A;font-size:12.5pt;margin:6mm 0 2mm}table{width:100%;border-collapse:collapse;font-size:9.5pt}th,td{border-bottom:1px solid #E5DFD3;text-align:left;padding:4px 3px;vertical-align:top}'
  + 'th{color:#0A4F4A}.np{padding:8px 2mm}.np button{border:1px solid #0A4F4A;background:#0A4F4A;color:#fff;border-radius:999px;padding:7px 14px;font:600 10pt Arial;cursor:pointer}.ft{color:#5F6B66;font-size:8.5pt;margin-top:8mm}tr{page-break-inside:avoid}@media print{.np{display:none}}';
export function gguReport(rec, today) {
  const t = today || gguToday(), n = nextDue(rec, t), tr = (a) => "<tr>" + a.map((c) => "<td>" + esc(c) + "</td>").join("") + "</tr>";
  let b = '<div class=bd><h1>Golden Gate University</h1><div class=rule></div><p><b>Next due:</b> ' + esc(n.item ? n.item.what + (n.item.by ? " (" + n.item.by + ")" : "") : "Nothing due") + "</p>";
  b += "<h2>Roles</h2><table>" + rec.roles.map((q) => tr([q.title, q.detail])).join("") + "</table>";
  b += "<h2>Candidates</h2><table><tr><th>Name</th><th>Cohort</th><th>Topic</th><th>Stage</th><th>Next</th></tr>" + rec.candidates.map((c) => tr([c.name, c.cohort, c.topic, c.stage, c.nextMilestone])).join("") + "</table>";
  b += "<h2>Deadlines</h2><table>" + rec.deadlines.slice().sort((a, c) => (a.date < c.date ? -1 : 1)).map((d) => tr([d.date, d.what, d.confirmed ? "confirmed" : "unconfirmed"])).join("") + "</table>";
  b += "<h2>My tasks</h2><table>" + rec.tasks.map((x) => tr([x.done ? "done" : "open", x.what, x.by || ""])).join("") + "</table>";
  b += "<h2>Contacts</h2><table>" + rec.contacts.map((c) => tr([c.name, c.role])).join("") + "</table></div>";
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>GGU brief</title><style>' + R_CSS + '</style></head><body>'
    + '<div class=np><button type=button onclick="window.print()">Save as PDF</button></div>' + b + '<p class="ft bd">DigitAlchemy&reg; Tech Limited | prepared from the Momo GGU card | private</p>'
    + '<script>if(new URLSearchParams(location.search).get("print")==="1")setTimeout(function(){window.print()},400)</script></body></html>';
}

export async function gguRoute(request, env, url, deps) {
  const p = url.pathname, key = url.searchParams.get("key") || "", rk = url.searchParams.get("rk") || "";
  const J = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  const person = typeof deps.person === "function" ? deps.person(env, url) : "";
  if (person !== "kendall") return new Response("not found", { status: 404 });   // Kendall's key only
  const H = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" };
  if (p === "/momo/work/ggu" && request.method === "GET") return new Response(deps.page(key, rk, GGU_BODY + "<script>" + GGU_JS + "</script>"), { headers: H });
  if (p === "/momo/work/ggu/rec" && request.method === "GET") return J({ rec: (await readGgu(env, person)) || emptyGgu() });
  if (p === "/momo/work/ggu/report" && request.method === "GET") return new Response(gguReport((await readGgu(env, person)) || emptyGgu()), { headers: H });
  if (p === "/momo/work/ggu/api" && request.method === "POST") {
    let b = {}; try { b = await request.json(); } catch (e) { return J({ error: "Send JSON." }, 400); }
    const r = await gguApi(env, person, b || {}); return r.error ? J({ error: r.error }, r.status || 400) : J(r);
  }
  return new Response("not found", { status: 404 });
}
