// v646 - MOMO - SPEAKING ENGAGEMENTS (Kendall, 27 Oct 2026: "a front end card that is speaking engagements, because there's quite a few"; part of his DNA).
// One record per person in KV, speaking_rec_kendall: every talk, masterclass, keynote, panel, webinar, lecture or award, with its date, venue, audience,
// objectives and session outline. Kendall's key only (personOfKey = "kendall"); anyone else gets "not found". THIS REPO IS PUBLIC: titles, organisers,
// venues and outlines live in the KV record (loaded once by a script kept outside git, then edited on the page); the code holds only the shape and the page.
export const SPK_PREFIX = "speaking_rec_";
export const SPK_FILE = "speaking_file_";   // v660 - speaking_file_<person>_<slug>: base64 body, metadata {type, name}
export const TYPES = ["masterclass", "keynote", "talk", "panel", "webinar", "lecture", "award", "judge"];
export const FORMATS = ["in-person", "online", "hybrid"];
export const SPK_STATUSES = ["proposed", "confirmed", "delivered", "cancelled"];
export const MAX_ITEMS = 300;
const S = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").slice(0, n);
const url = (v) => { const u = S(v, 500).trim(); return /^https?:\/\/[^\s]+$/i.test(u) ? u : ""; };
const day = (v) => { const d = S(v, 10).trim(); return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : ""; };
const hm = (v) => { const t = S(v, 5).trim(); return /^([01]\d|2[0-3]):[0-5]\d$/.test(t) ? t : ""; };
const int = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n > 0 ? Math.min(n, 100000) : 0; };
const slug = (v) => S(v, 60).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
const pick = (v, list, d) => (list.includes(v) ? v : d);
const strs = (a, n, m) => (Array.isArray(a) ? a : []).slice(0, n).map((x) => S(x, m).trim()).filter(Boolean);

export function cleanItem(x, prev) {
  const g = x && typeof x === "object" ? x : {}, o = Object.assign({}, prev || {}), has = (k) => g[k] !== undefined;
  [["title", 160], ["organiser", 120], ["venue", 120], ["city", 60], ["country", 60], ["audience", 600], ["summary", 1500], ["folder", 300], ["notes", 2000]]
    .forEach(([k, n]) => { if (has(k)) o[k] = S(g[k], n).trim(); else if (o[k] === undefined) o[k] = ""; });
  if (has("type")) o.type = pick(g.type, TYPES, "talk"); else if (!o.type) o.type = "talk";
  if (has("format")) o.format = pick(g.format, FORMATS, "in-person"); else if (!o.format) o.format = "in-person";
  if (has("status")) o.status = pick(g.status, SPK_STATUSES, o.status || "proposed"); else if (!o.status) o.status = "proposed";
  if (has("date")) o.date = day(g.date); else if (o.date === undefined) o.date = "";
  if (has("endDate")) o.endDate = day(g.endDate); else if (o.endDate === undefined) o.endDate = "";
  if (has("start")) o.start = hm(g.start); else if (o.start === undefined) o.start = "";
  if (has("end")) o.end = hm(g.end); else if (o.end === undefined) o.end = "";
  if (has("durationMins")) o.durationMins = int(g.durationMins); else if (o.durationMins === undefined) o.durationMins = 0;
  if (has("website")) o.website = url(g.website) || (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(S(g.website, 300).trim()) ? "https://" + S(g.website, 300).trim() : ""); else if (o.website === undefined) o.website = "";
  if (has("objectives")) o.objectives = strs(g.objectives, 20, 300); else if (!Array.isArray(o.objectives)) o.objectives = [];
  if (has("outline")) o.outline = (Array.isArray(g.outline) ? g.outline : []).slice(0, 40).map((s) => ({ time: S(s && s.time, 20).trim(), mins: int(s && s.mins), segment: S(s && s.segment, 160).trim(), covers: S(s && s.covers, 600).trim(), interactive: S(s && s.interactive, 400).trim() })).filter((s) => s.segment);
  else if (!Array.isArray(o.outline)) o.outline = [];
  if (has("materials")) o.materials = (Array.isArray(g.materials) ? g.materials : []).slice(0, 20).map((m) => ({ label: S(m && m.label, 120).trim(), url: url(m && m.url) })).filter((m) => m.label && m.url);
  else if (!Array.isArray(o.materials)) o.materials = [];
  if (has("due")) o.due = cleanDue(g.due);   // v648 - absent = defaults by type (dueOf); [] = nothing due
  if (o.due == null) delete o.due;
  o.id = slug(g.id || o.id) || ("s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
  return o;
}
// v648 (Kendall 27 Oct: "it should tell me if I have something due ... don't make it too complicated"): a short due list per engagement.
export const MAX_DUE = 8;
export function cleanDue(a) {
  if (!Array.isArray(a)) return null;
  const real = (v) => { const d = day(v); return d && !isNaN(Date.parse(d + "T00:00:00Z")) && new Date(d + "T00:00:00Z").toISOString().slice(0, 10) === d ? d : ""; };
  return a.map((d) => ({ what: S(d && d.what, 80).trim(), by: real(d && d.by), done: !!(d && d.done) })).filter((d) => d.what).slice(0, MAX_DUE);
}
export const emptySpk = () => ({ v: 1, updatedAt: "", items: [], log: [] });
export function cleanSpk(r) {
  const x = r && typeof r === "object" ? r : {}, seen = new Set(), items = [];
  (Array.isArray(x.items) ? x.items : []).slice(0, MAX_ITEMS).forEach((i) => { const c = cleanItem(i); c.updatedAt = S(i && i.updatedAt, 30); if (!seen.has(c.id)) { seen.add(c.id); items.push(c); } });
  return { v: 1, updatedAt: S(x.updatedAt, 30), items, log: (Array.isArray(x.log) ? x.log : []).slice(0, 40).map((l) => ({ at: S(l && l.at, 30), text: S(l && l.text, 200) })).filter((l) => l.text) };
}
export async function readSpk(env, person) { let r = null; try { r = JSON.parse(await env.MEETINGS.get(SPK_PREFIX + person)); } catch (e) {} return r ? cleanSpk(r) : null; }
async function writeSpk(env, person, rec, line) {
  const now = new Date().toISOString(); rec.updatedAt = now;
  if (line) rec.log = [{ at: now, text: S(line, 200) }].concat(rec.log || []).slice(0, 40);
  await env.MEETINGS.put(SPK_PREFIX + person, JSON.stringify(rec)); return rec;
}
export async function spkApi(env, person, b) {
  const rec = (await readSpk(env, person)) || emptySpk(), find = (id) => rec.items.findIndex((i) => i.id === slug(id)), now = new Date().toISOString();
  switch (b.action) {
    case "save_item": {
      const i = b.item && b.item.id ? find(b.item.id) : -1;
      if (i < 0 && rec.items.length >= MAX_ITEMS) return { error: "The list is full.", status: 400 };
      const c = cleanItem(b.item || {}, i >= 0 ? rec.items[i] : null); c.updatedAt = now;
      if (!c.title) return { error: "Give it a title.", status: 400 };
      if (i >= 0) rec.items[i] = c; else rec.items.push(c);
      await writeSpk(env, person, rec, (i >= 0 ? "Edited: " : "Added: ") + c.title); return { ok: true, rec };
    }
    case "delete_item": { const i = find(b.id); if (i < 0) return { error: "Not found.", status: 404 }; const t = rec.items[i].title; rec.items.splice(i, 1); await writeSpk(env, person, rec, "Removed: " + t); return { ok: true, rec }; }
    case "set_status": {
      const i = find(b.id); if (i < 0) return { error: "Not found.", status: 404 };
      if (!SPK_STATUSES.includes(b.status)) return { error: "Unknown status.", status: 400 };
      rec.items[i].status = b.status; rec.items[i].updatedAt = now; await writeSpk(env, person, rec, rec.items[i].title + ": " + b.status); return { ok: true, rec };
    }
    case "import_items": {   // merge by id: fields sent replace, fields not sent stay (so later refreshes keep the page's edits)
      const list = Array.isArray(b.items) ? b.items : []; let added = 0, merged = 0;
      for (const x of list) {
        const id = slug(x && x.id); const i = id ? find(id) : -1;
        if (i >= 0) { rec.items[i] = Object.assign(cleanItem(x, rec.items[i]), { updatedAt: now }); merged++; }
        else if (rec.items.length < MAX_ITEMS) { const c = cleanItem(x); c.updatedAt = now; if (c.title) { rec.items.push(c); added++; } }
      }
      await writeSpk(env, person, rec, "Imported " + added + " new, " + merged + " updated"); return { ok: true, added, merged, rec };
    }
    case "set_due": {
      const i = find(b.id); if (i < 0) return { error: "Not found.", status: 404 };
      rec.items[i].due = cleanDue(Array.isArray(b.due) ? b.due : []); rec.items[i].updatedAt = now;
      await writeSpk(env, person, rec, rec.items[i].title + ": due list updated"); return { ok: true, rec };
    }
    case "toggle_due": {
      const i = find(b.id); if (i < 0) return { error: "Not found.", status: 404 };
      const it = rec.items[i]; if (!Array.isArray(it.due)) it.due = dueOf(it).map((d) => ({ what: d.what, by: d.by, done: d.done }));
      const k = Math.floor(Number(b.index)); if (!(k >= 0 && k < it.due.length)) return { error: "No such item.", status: 400 };
      it.due[k].done = b.done === undefined ? !it.due[k].done : !!b.done; it.updatedAt = now;
      await writeSpk(env, person, rec, it.title + ": " + it.due[k].what + (it.due[k].done ? " done" : " reopened")); return { ok: true, rec };
    }
    default: return { error: "Unknown action.", status: 400 };
  }
}


// v649 - the DNA record (Kendall's checked facts and master bios) and two phone helpers: "Write it for me" (bio / abstract /
// talk title / speaker intro from the DNA + the engagement) and "Add from invite" (pasted text or a screenshot -> a draft event).
// The facts live in KV (dna_rec_<person>), never in this public repo; the rules below are enforced on the server.
export const DNA_PREFIX = "dna_rec_";
export const WRITE_KINDS = { bio: 120, abstract: 150, title: 14, intro: 60 };
export function cleanDna(x) {
  const g = x && typeof x === "object" ? x : {}, b = g.bios && typeof g.bios === "object" ? g.bios : {};
  return { v: 1, updatedAt: S(g.updatedAt, 30), name: S(g.name, 80).trim(), titles: strs(g.titles, 12, 160), education: strs(g.education, 12, 200),
    roles: (Array.isArray(g.roles) ? g.roles : []).slice(0, 30).map((r) => ({ title: S(r && r.title, 120).trim(), org: S(r && r.org, 120).trim(), from: S(r && r.from, 20).trim(), to: S(r && r.to, 20).trim() })).filter((r) => r.title || r.org),
    employersNamed: strs(g.employersNamed, 20, 80), teaching: strs(g.teaching, 20, 200), awards: strs(g.awards, 20, 200), certifications: strs(g.certifications, 30, 120),
    highlights: strs(g.highlights, 30, 300), bios: { short: S(b.short, 800).trim(), medium: S(b.medium, 1500).trim(), long: S(b.long, 3000).trim(), intro: S(b.intro, 800).trim() },
    rules: strs(g.rules, 20, 200) };
}
export async function readDna(env, person) { let r = null; try { r = JSON.parse(await env.MEETINGS.get(DNA_PREFIX + person)); } catch (e) {} return r ? cleanDna(r) : null; }
const BANNED = /\bMODON\b/i;
const VENDOR_SRC = "\\b(ChatGPT|OpenAI|GPT-?\\d[\\w.-]*|Claude|Anthropic|Gemini|Copilot|Llama|Mistral|Perplexity|Grok)\\b";
// remove model/vendor names, except inside protected phrases (e.g. an engagement title such as "Beyond ChatGPT")
export function stripVendors(text, keep) {
  let t = String(text || ""); const ph = [];
  (keep || []).filter((k) => k && new RegExp(VENDOR_SRC, "i").test(k)).forEach((k) => { let i; while ((i = t.indexOf(k)) >= 0) { ph.push(k); t = t.slice(0, i) + "\u0001" + (ph.length - 1) + "\u0002" + t.slice(i + k.length); } });
  t = t.replace(new RegExp(VENDOR_SRC, "gi"), "").replace(/\(\s*\)/g, "").replace(/ {2,}/g, " ").replace(/ ([,.;:])/g, "$1");
  return t.replace(/\u0001(\d+)\u0002/g, (m, n) => ph[+n]).trim();
}
const WRITE_SCHEMA = { type: "object", additionalProperties: false, required: ["text"], properties: { text: { type: "string" } } };
const INVITE_SCHEMA = { type: "object", additionalProperties: false, required: ["title"], properties: {
  title: { type: "string" }, organiser: { type: "string" }, type: { type: "string" }, date: { type: "string" }, endDate: { type: "string" }, start: { type: "string" }, end: { type: "string" },
  venue: { type: "string" }, city: { type: "string" }, country: { type: "string" }, format: { type: "string" }, role: { type: "string" }, audience: { type: "string" }, summary: { type: "string" },
  due: { type: "array", items: { type: "object", additionalProperties: false, required: ["what"], properties: { what: { type: "string" }, by: { type: "string" } } } } } };
function writeSys(dna, strict) {
  return "You write short professional texts for a speaker, in plain business English, using ONLY the facts in the SPEAKER RECORD. "
    + "Never invent employers, titles, dates, numbers, degrees or awards. Name these employers where relevant: " + (dna.employersNamed.join(", ") || "none") + ". "
    + "Never name the speaker's last government employer: always say 'a confidential government developer'. Do not mention any AI model, chatbot or vendor brand unless it is part of an event title given to you. "
    + (dna.rules.length ? "House rules: " + dna.rules.join("; ") + ". " : "")
    + (strict ? "STRICT: your previous answer named a forbidden organisation. Do not name it under any circumstances. " : "")
    + "Return JSON {\"text\": \"...\"} only.";
}
export async function writeFor(env, deps, dna, item, kind, words) {
  const k = WRITE_KINDS[kind] ? kind : "bio", n = Math.max(8, Math.min(400, int(words) || WRITE_KINDS[k]));
  const ask = { bio: "a third-person speaker bio of about " + n + " words", abstract: "a talk abstract of about " + n + " words for this engagement", title: "one talk title (at most " + n + " words), no quotes", intro: "a spoken host introduction of about " + n + " words, ending with the speaker's name" }[k];
  const user = "Write " + ask + ".\n\nENGAGEMENT: " + JSON.stringify({ title: item.title, organiser: item.organiser, type: item.type, audience: item.audience, summary: item.summary, date: item.date })
    + "\n\nSPEAKER RECORD: " + JSON.stringify({ name: dna.name, titles: dna.titles, education: dna.education, roles: dna.roles, teaching: dna.teaching, awards: dna.awards, certifications: dna.certifications, highlights: dna.highlights, approvedBios: dna.bios });
  const keep = [item.title].concat(dna.teaching);
  for (let attempt = 0; attempt < 2; attempt++) {
    let x = null; try { x = await deps.claudeJSON(env, writeSys(dna, attempt > 0), user, WRITE_SCHEMA, deps.model, 1200); } catch (e) {}
    const t = stripVendors(S(x && x.text, 4000).trim(), keep);
    if (t && !BANNED.test(t)) return { text: t, kind: k };
  }
  return { error: "Could not write it this time. Try again.", status: 502 };
}
export async function parseInvite(env, deps, b, today) {
  let text = S(b.text, 8000).trim();
  if (!text && b.image && typeof b.image === "object") {
    const ct = S(b.image.type, 60), d = String(b.image.data || "").replace(/\s+/g, "");
    if (!/^image\/(png|jpe?g|webp|heic)$/i.test(ct) || !/^[A-Za-z0-9+/]+={0,2}$/.test(d) || d.length > 8e6) return { error: "Send a PNG or JPG photo, or paste the text.", status: 400 };
    if (typeof deps.ocr !== "function") return { error: "Reading photos is not available here: paste the text instead.", status: 400 };
    try { text = S(await deps.ocr(env, S(b.image.name, 80) || "invite", ct, d), 8000).trim(); } catch (e) { text = ""; }
    if (!text) return { error: "Could not read the photo: paste the text instead.", status: 400 };
  }
  if (!text) return { error: "Paste the invite text or add a photo.", status: 400 };
  const sys = "You turn an event invitation into a calendar entry for the invited speaker. Today is " + today + " (Gulf Standard Time, UTC+4). "
    + "Resolve weekday or partial dates to the next matching date on or after today, as YYYY-MM-DD; times as HH:MM 24-hour GST. "
    + "Only use what the text says: leave a field empty if it is not stated, never guess a venue, time or role. "
    + "type is one of " + TYPES.join(", ") + "; format is one of " + FORMATS.join(", ") + ". role is the speaker's role (e.g. panelist, judge, keynote). "
    + "due lists only things the invitation asks the speaker to send or prepare (with a by-date if stated). Return JSON only.";
  let x = null; try { x = await deps.claudeJSON(env, sys, "INVITATION:\n" + text, INVITE_SCHEMA, deps.model, 1200); } catch (e) {}
  if (!x || !S(x.title, 200).trim()) return { error: "Could not read that invite. Check the text and try again.", status: 502 };
  const item = cleanItem({ title: x.title, organiser: x.organiser, type: TYPES.includes(x.type) ? x.type : "talk", date: x.date, endDate: x.endDate, start: x.start, end: x.end,
    venue: x.venue, city: x.city, country: x.country, format: FORMATS.includes(x.format) ? x.format : "in-person", audience: x.audience,
    summary: [x.role ? "Role: " + S(x.role, 80) : "", S(x.summary, 600)].filter(Boolean).join(". "), status: "proposed" });
  item.due = cleanDue(Array.isArray(x.due) ? x.due.map((d) => ({ what: d.what, by: d.by, done: false })) : []);
  return { ok: true, draft: item, source: text.slice(0, 1200) };
}

// Dubai's calendar day (UTC+4, no daylight saving) and the upcoming / past split: upcoming = ends today or later, soonest first; past = newest first.
export const dubaiDay = (ms) => new Date((ms == null ? Date.now() : ms) + 4 * 3600e3).toISOString().slice(0, 10);
export function splitItems(items, today) {
  const t = today || dubaiDay(), last = (i) => i.endDate || i.date;
  const tbc = (i) => !i.date && (i.status === "proposed" || i.status === "confirmed");   // date TBC: listed under Upcoming, after the dated ones
  const up = items.filter((i) => (i.date && last(i) >= t && i.status !== "cancelled") || tbc(i)).sort((a, b) => (a.date ? 0 : 1) - (b.date ? 0 : 1) || (a.date + a.start).localeCompare(b.date + b.start));
  const past = items.filter((i) => !up.includes(i)).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  return { up, past };
}
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function whenLabel(i) {
  if (!i.date) return "Date TBC";
  const d = new Date(i.date + "T00:00:00Z"), a = WD[d.getUTCDay()] + " " + d.getUTCDate() + " " + MO[d.getUTCMonth()] + " " + d.getUTCFullYear();
  const e = i.endDate && i.endDate !== i.date ? " to " + Number(i.endDate.slice(8)) + " " + MO[Number(i.endDate.slice(5, 7)) - 1] : "";
  return a + e + (i.start ? ", " + i.start + (i.end ? "-" + i.end : "") + " GST" : "");
}
export function countdown(i, today) {
  if (!i || !i.date) return "";
  const n = Math.round((Date.parse(i.date + "T00:00:00Z") - Date.parse((today || dubaiDay()) + "T00:00:00Z")) / 864e5);
  return n < 0 ? "under way" : n === 0 ? "today" : n === 1 ? "tomorrow" : "in " + n + " days";
}

// v648 - what is due: an explicit list wins; otherwise panels, judging and awards need nothing, and talks of every kind need slides.
export const NODUE = ["panel", "judge", "award"];
export function dueOf(i) {
  if (i.status === "delivered" || i.status === "cancelled") return [];   // nothing is due on an engagement that is over
  if (Array.isArray(i.due)) return i.due;
  return NODUE.indexOf(i.type) >= 0 ? [] : [{ what: "Slides / presentation", by: "", done: false, implied: true }];
}
export function dueChip(i, today) {
  var t = today || new Date(Date.now() + 144e5).toISOString().slice(0, 10), open = dueOf(i).filter(function (d) { return !d.done; });
  if (!open.length) return { cls: "ok", text: NODUE.indexOf(i.type) >= 0 && !Array.isArray(i.due) ? "Nothing due, just show up" : "Nothing due", open: 0 };
  var f = open[0], n = i.date ? Math.round((Date.parse(i.date + "T00:00:00Z") - Date.parse(t + "T00:00:00Z")) / 864e5) : 99;
  var soon = n <= 2 || (f.by && f.by <= t), more = open.length > 1 ? " +" + (open.length - 1) + " more" : "";
  return { cls: soon ? "red" : "amber", text: (soon ? "Due soon: " : "Due: ") + f.what + more, open: open.length };
}
export function dueQuestion(i, today) {
  var t = today || new Date(Date.now() + 144e5).toISOString().slice(0, 10), open = dueOf(i).filter(function (d) { return !d.done; });
  var W = { talk: "Presentation", lecture: "Presentation", webinar: "Webinar", keynote: "Keynote", masterclass: "Masterclass", panel: "Panel", judge: "Judging", award: "Awards" };
  var n = i.date ? Math.round((Date.parse(i.date + "T00:00:00Z") - Date.parse(t + "T00:00:00Z")) / 864e5) : null;
  var when = n == null ? "date TBC" : n < 0 ? "under way" : n === 0 ? "today" : n === 1 ? "tomorrow" : "in " + n + " days";
  var head = (W[i.type] || "Engagement") + " " + when + ". ";
  if (!open.length) return head + (NODUE.indexOf(i.type) >= 0 && !Array.isArray(i.due) ? "Nothing due, just show up." : "Nothing due.");
  var w = open[0].what; return head + w + (/slide|presentation|deck/i.test(w) ? " ready?" : " done?");
}

// ---- page ----
export const SPK_ICON = '<path d="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4M8 21h8"/>';
const SPK_CSS = '<style>.inv{background:#fff;border:1px solid #D8E3DE;border-radius:14px;padding:10px 12px;margin:0 0 12px}.inv summary{font-weight:600;color:#0A4F4A;cursor:pointer}.inv textarea,.wr textarea{width:100%;box-sizing:border-box;border:1px solid #D8E3DE;border-radius:10px;padding:8px;font:inherit;margin:6px 0}.wr{margin:10px 0;padding:10px;border:1px dashed #C5A56A;border-radius:12px;background:#FFFDF6}.wr .row{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.wr select,.wr button{border:1px solid #0A4F4A;border-radius:999px;padding:6px 11px;font:600 .78rem IBM Plex Sans,sans-serif;background:#fff;color:#0A4F4A}.wr .pri{background:#0A4F4A;color:#fff}.sh{color:#5F6B66;font-size:.82rem;margin:0 0 10px}.nx{background:#0A4F4A;color:#fff;border-radius:16px;padding:14px 16px;margin:0 0 14px}.nx small{color:#C5A56A;font-family:"IBM Plex Mono",monospace;letter-spacing:.12em;font-size:.66rem}'
  + '.nx b{display:block;font-family:Fraunces,serif;font-size:1.1rem;margin:4px 0}.nx span{font-size:.85rem;opacity:.9}.ch{display:inline-block;background:#C5A56A;color:#0A4F4A;border-radius:999px;padding:3px 10px;font-weight:700;font-size:.78rem;margin-top:8px}'
  + '.sf{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px}.sf select{border:1px solid #D8D1C4;border-radius:999px;padding:7px 10px;background:#fff;font:600 .8rem "IBM Plex Sans",sans-serif}'
  + 'h2{font-family:Fraunces,serif;font-size:1.05rem;color:#0A4F4A;margin:18px 0 8px}.sc{background:#fff;border:1px solid #E5DFD3;border-left:4px solid #C5A56A;border-radius:14px;padding:12px 14px;margin:0 0 10px;cursor:pointer}'
  + '.sc h3{margin:0 0 4px;font-size:.98rem}.sc p{margin:2px 0;color:#5F6B66;font-size:.82rem}.sc i{font-style:normal;font-size:.7rem;font-weight:700;border-radius:999px;padding:2px 8px;margin-right:5px;background:#E6F0EE;color:#0A4F4A}'
  + '.sc i.st{background:#F6EEDC;color:#7A5B1E}.sd{display:none;margin-top:10px;border-top:1px solid #EEE7DA;padding-top:10px;font-size:.84rem}.sc.open .sd{display:block}.sd table{width:100%;border-collapse:collapse;font-size:.76rem}'
  + '.sd th,.sd td{border-bottom:1px solid #EEE7DA;text-align:left;padding:5px 4px;vertical-align:top}.sd th{color:#0A4F4A}.sb{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}'
  + '.sb a,.sb button{border:1px solid #0A4F4A;background:#fff;color:#0A4F4A;border-radius:999px;padding:7px 12px;font:600 .78rem "IBM Plex Sans",sans-serif;text-decoration:none;cursor:pointer}'
  + '.sb .pri{background:#0A4F4A;color:#fff}.fm{display:none;background:#fff;border:1px solid #E5DFD3;border-radius:14px;padding:12px;margin:10px 0}.fm.on{display:block}.fm label{display:block;font-size:.74rem;color:#5F6B66;margin:8px 0 2px}'
  + '.fm input,.fm select,.fm textarea{width:100%;box-sizing:border-box;border:1px solid #D8D1C4;border-radius:10px;padding:8px;font:400 .86rem "IBM Plex Sans",sans-serif}.g2{display:grid;grid-template-columns:1fr 1fr;gap:8px}.dc{display:inline-block;border-radius:999px;padding:3px 10px;font-weight:700;font-size:.74rem;margin-top:6px}.dc.ok{background:#E3F1E7;color:#1F6B3A}.dc.amber{background:#FBEFD5;color:#8A5A00}.dc.red{background:#FBE1DE;color:#A12A1D}.nx .dc{margin-right:6px}.nx .yd{border:0;background:#C5A56A;color:#0A4F4A;border-radius:999px;padding:5px 12px;font-weight:700;font-size:.78rem;cursor:pointer}.dl label{display:flex;gap:8px;align-items:center;margin:4px 0;font-size:.84rem}.dl .add{display:flex;gap:6px;margin-top:6px}.dl .add input{flex:1;border:1px solid #D8D1C4;border-radius:10px;padding:6px}.dl .add button{border:1px solid #0A4F4A;background:#fff;color:#0A4F4A;border-radius:999px;padding:5px 12px;font-weight:600;cursor:pointer}.em{color:#5F6B66;font-size:.85rem;padding:16px 0}</style>';
export const SPK_BODY = SPK_CSS + '<a class=back href="/momo" id=sback>&#8592; Momo</a><div class=tag>MOMO</div><h1>Speaking</h1><p class=sh id=supd>Loading...</p><div id=snext></div>'
  + '<div class=sf><select id=fy><option value="">All years</option></select><select id=ft><option value="">All types</option></select><button type=button id=sadd style="border:1px solid #0A4F4A;background:#0A4F4A;color:#fff;border-radius:999px;padding:7px 12px;font:600 .8rem IBM Plex Sans,sans-serif">Add</button>'
  + '<a id=sall target=_blank rel=noopener style="border:1px solid #0A4F4A;color:#0A4F4A;border-radius:999px;padding:7px 12px;font:600 .8rem IBM Plex Sans,sans-serif;text-decoration:none">Download all</a></div>'
  + '<details class=inv id=sinv><summary>Add from invite</summary><p class=sh>Paste the WhatsApp or email text, or add a photo of the invite. Check the details, then Save.</p><textarea id=iv_t rows=4 placeholder="Paste the invite here"></textarea><input type=file id=iv_f accept="image/*"><div class=sb><button type=button class=pri id=iv_go>Read invite</button></div><p class=sh id=iv_msg></p></details>'
  + '<div class=fm id=sform><input type=hidden id=f_id><label>Title</label><input id=f_title><label>Organiser</label><input id=f_org>'
  + '<div class=g2><div><label>Type</label><select id=f_type></select></div><div><label>Status</label><select id=f_status></select></div></div>'
  + '<div class=g2><div><label>Date</label><input id=f_date type=date></div><div><label>End date</label><input id=f_end type=date></div></div>'
  + '<div class=g2><div><label>Start (GST)</label><input id=f_start type=time></div><div><label>End (GST)</label><input id=f_endt type=time></div></div>'
  + '<div class=g2><div><label>Venue</label><input id=f_venue></div><div><label>City</label><input id=f_city></div></div>'
  + '<div class=g2><div><label>Country</label><input id=f_country></div><div><label>Format</label><select id=f_format></select></div></div>'
  + '<label>Website</label><input id=f_web><label>Audience</label><textarea id=f_aud rows=2></textarea><label>Summary</label><textarea id=f_sum rows=3></textarea>'
  + '<label>Objectives (one per line)</label><textarea id=f_obj rows=3></textarea><label>Notes</label><textarea id=f_notes rows=2></textarea>'
  + '<div class=sb><button type=button class=pri id=f_save>Save</button><button type=button id=f_cancel>Cancel</button></div><p class=sh id=f_msg></p></div>'
  + '<h2>Upcoming</h2><div id=sup></div><h2>Past</h2><div id=spast></div>';
// v647 - wrangler's bundler wraps functions with __name(fn,"name"); embedding fn.toString() in the page carries that call, so the page must define __name or it throws before drawing (Speaking showed "Could not load", 27 Oct).
export const SPK_JS = "var __name=function(f){return f};var whenLabel=" + whenLabel.toString() + ";var countdown=" + countdown.toString() + ";var splitItems=" + splitItems.toString() + ";var dubaiDay=" + dubaiDay.toString() + ";var NODUE=" + JSON.stringify(NODUE) + ";var dueOf=" + dueOf.toString() + ";var dueChip=" + dueChip.toString() + ";var dueQuestion=" + dueQuestion.toString() + ";var WD=" + JSON.stringify(WD) + ";var MO=" + JSON.stringify(MO)
  + ";var TYPES=" + JSON.stringify(TYPES) + ";var FORMATS=" + JSON.stringify(FORMATS) + ";var STS=" + JSON.stringify(SPK_STATUSES) + ";" + String.raw`(function(){
var KEY=new URLSearchParams(location.search).get("key")||"",REC={items:[]},$=function(i){return document.getElementById(i)};
$("sback").href="/momo?door=1&key="+encodeURIComponent(KEY);$("sall").href="/momo/work/speaking/report?key="+encodeURIComponent(KEY);
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}
function opts(id,list){var s=$(id);list.forEach(function(v){var o=el("option","",v);o.value=v;s.appendChild(o)})}
opts("f_type",TYPES);opts("f_status",STS);opts("f_format",FORMATS);opts("ft",TYPES);
function api(b){return fetch("/momo/work/speaking/api?key="+encodeURIComponent(KEY),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(b)}).then(function(r){return r.json()})}
function card(i){var c=el("div","sc");c.appendChild(el("h3","",i.title));c.appendChild(el("p","",(i.organiser||"")+(i.venue?" | "+i.venue:"")+(i.city?", "+i.city:"")));c.appendChild(el("p","",whenLabel(i)));
var t=el("p");var a=el("i","",i.type);t.appendChild(a);var b=el("i","st",i.status);t.appendChild(b);if(i.format)t.appendChild(el("i","",i.format));c.appendChild(t);var dch=dueChip(i,dubaiDay());c.appendChild(el("span","dc "+dch.cls,dch.text));
var d=el("div","sd");d.appendChild(dueList(i));d.appendChild(writeBox(i));if(i.audience)d.appendChild(el("p","","Audience: "+i.audience));if(i.summary)d.appendChild(el("p","",i.summary));
if(i.objectives&&i.objectives.length){var ul=el("ul");i.objectives.forEach(function(o){ul.appendChild(el("li","",o))});d.appendChild(el("p","","Objectives"));d.appendChild(ul)}
if(i.outline&&i.outline.length){var tb=el("table"),h=el("tr");["Time","Min","Segment","What it covers","Interactive"].forEach(function(x){h.appendChild(el("th","",x))});tb.appendChild(h);
i.outline.forEach(function(s){var r=el("tr");[s.time,s.mins||"",s.segment,s.covers,s.interactive].forEach(function(x){r.appendChild(el("td","",x))});tb.appendChild(r)});d.appendChild(tb)}
if(i.website){var w=el("a","",i.website);w.href=i.website;w.target="_blank";w.rel="noopener noreferrer";var wp=el("p");wp.appendChild(w);d.appendChild(wp)}
(i.materials||[]).forEach(function(m){var mp=el("p"),ma=el("a","",m.label);ma.href=/\/momo\/work\/speaking\/file\?/.test(m.url)?m.url.replace(/^https?:\/\/[^\/]+/,"")+"&key="+encodeURIComponent(KEY):m.url;ma.target="_blank";ma.rel="noopener noreferrer";mp.appendChild(ma);d.appendChild(mp)});
if(i.folder)d.appendChild(el("p","","Folder: "+i.folder));if(i.notes)d.appendChild(el("p","","Notes: "+i.notes));
var sb=el("div","sb"),pdf=el("a","pri","Brief (PDF)");pdf.href="/momo/work/speaking/report?id="+encodeURIComponent(i.id)+"&key="+encodeURIComponent(KEY);pdf.target="_blank";sb.appendChild(pdf);
var ed=el("button","","Edit");ed.type="button";ed.onclick=function(e){e.stopPropagation();openForm(i)};sb.appendChild(ed);
var ss=el("select");STS.forEach(function(v){var o=el("option","",v);o.value=v;if(v===i.status)o.selected=true;ss.appendChild(o)});ss.onclick=function(e){e.stopPropagation()};
ss.onchange=function(){api({action:"set_status",id:i.id,status:ss.value}).then(function(r){if(r.rec){REC=r.rec;draw()}})};sb.appendChild(ss);d.appendChild(sb);c.appendChild(d);
c.onclick=function(){c.classList.toggle("open")};return c}
function dueList(i){var box=el("div","dl"),L=dueOf(i);box.appendChild(el("p","",L.length?"What is due":"Nothing due"));box.onclick=function(e){e.stopPropagation()};
L.forEach(function(x,k){var lb=el("label"),cb=el("input");cb.type="checkbox";cb.checked=!!x.done;cb.onchange=function(){api({action:"toggle_due",id:i.id,index:k,done:cb.checked}).then(function(r){if(r.rec){REC=r.rec;draw()}})};lb.appendChild(cb);lb.appendChild(el("span","",x.what+(x.by?" (by "+x.by+")":"")));box.appendChild(lb)});
var ad=el("div","add"),inp=el("input"),bt=el("button","","Add");inp.placeholder="Add something due";bt.type="button";
bt.onclick=function(){var w=inp.value.trim();if(!w)return;var cur=dueOf(i).map(function(x){return{what:x.what,by:x.by,done:x.done}});cur.push({what:w,by:"",done:false});api({action:"set_due",id:i.id,due:cur}).then(function(r){if(r.rec){REC=r.rec;draw()}})};
ad.appendChild(inp);ad.appendChild(bt);box.appendChild(ad);return box}
function draw(){$("supd").textContent=REC.items.length+" engagements"+(REC.updatedAt?" | updated "+REC.updatedAt.slice(0,10):"");
var ys={};REC.items.forEach(function(i){if(i.date)ys[i.date.slice(0,4)]=1});var fy=$("fy"),cur=fy.value;while(fy.options.length>1)fy.remove(1);Object.keys(ys).sort().reverse().forEach(function(y){var o=el("option","",y);o.value=y;fy.appendChild(o)});fy.value=cur;
var Y=fy.value,T=$("ft").value,list=REC.items.filter(function(i){return(!Y||(i.date||"").slice(0,4)===Y)&&(!T||i.type===T)});
var sp=splitItems(list,dubaiDay()),nx=$("snext");nx.textContent="";var all=splitItems(REC.items,dubaiDay());
if(all.up.length){var n=all.up[0],b=el("div","nx");b.appendChild(el("small","","NEXT"));b.appendChild(el("b","",n.title));b.appendChild(el("span","",whenLabel(n)+(n.venue?" | "+n.venue:"")));b.appendChild(el("div"));b.lastChild.appendChild(el("span","ch",countdown(n,dubaiDay())));
var q=el("div");q.style.marginTop="8px";var qc=dueChip(n,dubaiDay());q.appendChild(el("span","dc "+qc.cls,dueQuestion(n,dubaiDay())));
if(qc.open){var yb=el("button","yd","Yes, done");yb.type="button";var NL=dueOf(n),ix=NL.findIndex(function(x){return!x.done});yb.onclick=function(){api({action:"toggle_due",id:n.id,index:ix,done:true}).then(function(r){if(r.rec){REC=r.rec;draw()}})};q.appendChild(yb)}
b.appendChild(q);nx.appendChild(b)}
[["sup",sp.up,"Nothing coming up."],["spast",sp.past,"Nothing yet."]].forEach(function(x){var box=$(x[0]);box.textContent="";if(!x[1].length)box.appendChild(el("p","em",x[2]));x[1].forEach(function(i){box.appendChild(card(i))})})}
function openForm(i){i=i||{};$("sform").classList.add("on");$("f_id").value=i.id||"";$("f_title").value=i.title||"";$("f_org").value=i.organiser||"";$("f_type").value=i.type||"talk";$("f_status").value=i.status||"proposed";
$("f_date").value=i.date||"";$("f_end").value=i.endDate||"";$("f_start").value=i.start||"";$("f_endt").value=i.end||"";$("f_venue").value=i.venue||"";$("f_city").value=i.city||"";$("f_country").value=i.country||"";
$("f_format").value=i.format||"in-person";$("f_web").value=i.website||"";$("f_aud").value=i.audience||"";$("f_sum").value=i.summary||"";$("f_obj").value=(i.objectives||[]).join("\n");$("f_notes").value=i.notes||"";$("f_msg").textContent="";window.scrollTo(0,$("sform").offsetTop-20)}

var WK={bio:"Bio",abstract:"Abstract",title:"Talk title",intro:"Speaker intro"};
function kindOf(t){t=(t||"").toLowerCase();if(/abstract/.test(t))return"abstract";if(/intro/.test(t))return"intro";if(/title|topic/.test(t))return"title";if(/bio/.test(t))return"bio";return""}
function writeBox(i){var w=el("div","wr"),row=el("div","row"),sel=el("select"),go=el("button","pri","Write it for me");w.onclick=function(e){e.stopPropagation()};
Object.keys(WK).forEach(function(k){var o=el("option","",WK[k]);o.value=k;sel.appendChild(o)});
var open=dueOf(i).map(function(x,k){return{x:x,k:k}}).filter(function(o){return!o.x.done&&kindOf(o.x.what)});if(open.length)sel.value=kindOf(open[0].x.what);
go.type="button";row.appendChild(el("span","","Write:"));row.appendChild(sel);row.appendChild(go);w.appendChild(row);
var out=el("div");w.appendChild(out);
go.onclick=function(){out.textContent="";out.appendChild(el("p","sh","Writing..."));api({action:"write",id:i.id,kind:sel.value}).then(function(r){out.textContent="";if(r.error){out.appendChild(el("p","sh",r.error));return}
var ta=el("textarea");ta.rows=7;ta.value=r.text;out.appendChild(ta);var b=el("div","row");
var cp=el("button","","Copy");cp.type="button";cp.onclick=function(){copyT(ta.value,cp)};b.appendChild(cp);
var sh=el("button","","Share");sh.type="button";sh.onclick=function(){if(navigator.share){navigator.share({title:WK[sel.value]+": "+i.title,text:ta.value}).catch(function(){})}else copyT(ta.value,sh)};b.appendChild(sh);
var sv=el("button","","Save to this event");sv.type="button";sv.onclick=function(){var it=Object.assign({},i);it.notes=((i.notes||"")+"\n\n"+WK[sel.value]+":\n"+ta.value).trim().slice(0,1900);api({action:"save_item",item:it}).then(function(x){if(x.rec){REC=x.rec;sv.textContent="Saved"}})};b.appendChild(sv);
var m=open.filter(function(o){return kindOf(o.x.what)===sel.value})[0];if(m){var dn=el("button","pri","Mark done");dn.type="button";dn.onclick=function(){api({action:"toggle_due",id:i.id,index:m.k,done:true}).then(function(x){if(x.rec){REC=x.rec;draw()}})};b.appendChild(dn)}
out.appendChild(b)})};return w}
function copyT(t,btn){var done=function(){var o=btn.textContent;btn.textContent="Copied";setTimeout(function(){btn.textContent=o},1500)};if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(done,function(){prompt("Copy:",t)});else prompt("Copy:",t)}
$("iv_go").onclick=function(){var t=$("iv_t").value.trim(),f=$("iv_f").files&&$("iv_f").files[0],msg=$("iv_msg");msg.textContent="Reading...";
var send=function(body){api(Object.assign({action:"parse_invite"},body)).then(function(r){if(r.error){msg.textContent=r.error;return}msg.textContent="Check the details below, then Save.";var d=r.draft;openForm(d);if(d.due&&d.due.length)$("f_notes").value=((d.notes||"")+"\nDue: "+d.due.map(function(x){return x.what+(x.by?" (by "+x.by+")":"")}).join("; ")).trim()})};
if(t)return send({text:t});if(!f){msg.textContent="Paste the invite text or add a photo.";return}
var rd=new FileReader();rd.onload=function(){var s=String(rd.result||""),c=s.indexOf(",");send({image:{name:f.name,type:f.type,data:s.slice(c+1)}})};rd.onerror=function(){msg.textContent="Could not read the photo: paste the text instead."};rd.readAsDataURL(f)};
$("sadd").onclick=function(){openForm()};$("f_cancel").onclick=function(){$("sform").classList.remove("on")};$("fy").onchange=draw;$("ft").onchange=draw;
$("f_save").onclick=function(){var it={id:$("f_id").value||undefined,title:$("f_title").value,organiser:$("f_org").value,type:$("f_type").value,status:$("f_status").value,date:$("f_date").value,endDate:$("f_end").value,start:$("f_start").value,end:$("f_endt").value,venue:$("f_venue").value,city:$("f_city").value,country:$("f_country").value,format:$("f_format").value,website:$("f_web").value,audience:$("f_aud").value,summary:$("f_sum").value,objectives:$("f_obj").value.split("\n"),notes:$("f_notes").value};
api({action:"save_item",item:it}).then(function(r){if(r.error){$("f_msg").textContent=r.error;return}REC=r.rec;$("sform").classList.remove("on");draw()})};
fetch("/momo/work/speaking/rec?key="+encodeURIComponent(KEY)).then(function(r){return r.json()}).then(function(d){REC=d.rec||REC;draw()}).catch(function(){$("supd").textContent="Could not load. Try again."})})();`;

// ---- printable brief: one engagement (?id=) or the whole list; DigitAlchemy identity (teal #0A4F4A, gold #C5A56A) ----
const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const R_CSS = '@page{size:A4 portrait;margin:14mm}body{margin:0;background:#fff;color:#1C2321;font-family:"IBM Plex Sans",Arial,sans-serif;font-size:10.5pt}.top{background:#0A4F4A;color:#fff;padding:16px 18px;border-bottom:4px solid #C5A56A}'
  + '.top small{color:#C5A56A;letter-spacing:.14em;font-size:8pt}.top h1{font-family:Georgia,serif;font-size:18pt;margin:4px 0 2px}.top p{margin:0;font-size:9.5pt;opacity:.92}.bd{padding:14px 18px}h2{color:#0A4F4A;font-family:Georgia,serif;font-size:12pt;border-bottom:1px solid #C5A56A;padding-bottom:3px;margin:16px 0 6px}'
  + 'table{width:100%;border-collapse:collapse;font-size:9pt}th,td{border-bottom:1px solid #E5DFD3;text-align:left;padding:5px 4px;vertical-align:top}th{color:#0A4F4A}.it{page-break-inside:avoid;border-left:3px solid #C5A56A;padding:6px 10px;margin:0 0 10px}'
  + '.it b{color:#0A4F4A}.ft{color:#5F6B66;font-size:8pt;border-top:1px solid #E5DFD3;margin-top:18px;padding-top:6px}.np{margin:10px 18px}.np button{border:1px solid #0A4F4A;background:#0A4F4A;color:#fff;border-radius:999px;padding:8px 14px;font:600 10pt Arial;cursor:pointer}@media print{.np{display:none}}';
const MIC = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#C5A56A" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="vertical-align:-3px;margin-right:6px">' + SPK_ICON + '</svg>';
function rowsOf(i) {
  return [["When", whenLabel(i)], ["Organiser", i.organiser], ["Venue", [i.venue, i.city, i.country].filter(Boolean).join(", ")], ["Format", i.format + (i.durationMins ? ", " + i.durationMins + " minutes" : "")],
    ["Type", i.type], ["Status", i.status], ["Website", i.website]].filter((r) => r[1]).map((r) => "<tr><th>" + esc(r[0]) + "</th><td>" + esc(r[1]) + "</td></tr>").join("");
}
export function spkReport(rec, id) {
  const one = id ? rec.items.find((i) => i.id === slug(id)) : null;
  let body;
  if (one) {
    body = '<div class=top><small>' + MIC + 'SPEAKING ENGAGEMENT</small><h1>' + esc(one.title) + '</h1><p>' + esc(whenLabel(one)) + (one.venue ? " | " + esc(one.venue) : "") + '</p></div><div class=bd><table>' + rowsOf(one) + '</table>'
      + (one.audience ? "<h2>Audience</h2><p>" + esc(one.audience) + "</p>" : "") + (one.summary ? "<h2>Summary</h2><p>" + esc(one.summary) + "</p>" : "")
      + (one.objectives.length ? "<h2>Objectives</h2><ul>" + one.objectives.map((o) => "<li>" + esc(o) + "</li>").join("") + "</ul>" : "")
      + (one.outline.length ? "<h2>Session outline</h2><table><tr><th>Time</th><th>Min</th><th>Segment</th><th>What it covers</th><th>Interactive element</th></tr>" + one.outline.map((s) => "<tr><td>" + esc(s.time) + "</td><td>" + (s.mins || "") + "</td><td>" + esc(s.segment) + "</td><td>" + esc(s.covers) + "</td><td>" + esc(s.interactive) + "</td></tr>").join("") + "</table>" : "")
      + "<h2>What is due</h2>" + (dueOf(one).length ? "<ul>" + dueOf(one).map((d) => "<li>" + esc(d.what) + (d.by ? " (by " + esc(d.by) + ")" : "") + " - " + (d.done ? "done" : "open") + "</li>").join("") + "</ul>" : "<p>" + esc(dueChip(one).text) + "</p>")
      + (one.notes ? "<h2>Notes</h2><p>" + esc(one.notes) + "</p>" : "") + "</div>";
  } else {
    const sp = splitItems(rec.items);
    const block = (i) => '<div class=it><b>' + esc(i.title) + '</b><br>' + esc(whenLabel(i)) + '<br>' + esc([i.organiser, i.venue, i.city].filter(Boolean).join(" | ")) + '<br>' + esc(i.type + " | " + i.status) + '</div>';
    body = '<div class=top><small>' + MIC + 'SPEAKING ENGAGEMENTS</small><h1>Talks, masterclasses and keynotes</h1><p>' + rec.items.length + ' engagements' + (rec.updatedAt ? ' | updated ' + esc(rec.updatedAt.slice(0, 10)) : '') + '</p></div><div class=bd>'
      + '<h2>Upcoming</h2>' + (sp.up.map(block).join("") || "<p>Nothing coming up.</p>") + '<h2>Past</h2>' + (sp.past.map(block).join("") || "<p>Nothing yet.</p>") + '</div>';
  }
  if (id && !one) body = '<div class=bd><p>Not found.</p></div>';
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>' + esc(one ? one.title : "Speaking engagements") + '</title><style>' + R_CSS + '</style></head><body>'
    + '<div class=np><button type=button onclick="window.print()">Save as PDF</button></div>' + body + '<p class="ft bd">DigitAlchemy&reg; Tech Limited | prepared from the Momo speaking register</p>'
    + '<script>if(new URLSearchParams(location.search).get("print")==="1")setTimeout(function(){window.print()},400)</script></body></html>';
}

export async function speakingRoute(request, env, url, deps) {
  const p = url.pathname, key = url.searchParams.get("key") || "", rk = url.searchParams.get("rk") || "";
  const J = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  const person = typeof deps.person === "function" ? deps.person(env, url) : "";
  if (person !== "kendall") return new Response("not found", { status: 404 });   // Kendall's key only
  const H = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" };
  if (p === "/momo/work/speaking" && request.method === "GET") return new Response(deps.page(key, rk, SPK_BODY + "<script>" + SPK_JS + "</script>"), { headers: H });
  if (p === "/momo/work/speaking/dna" && request.method === "GET") return J({ dna: (await readDna(env, person)) || cleanDna({}) });
  if (p === "/momo/work/speaking/rec" && request.method === "GET") return J({ rec: (await readSpk(env, person)) || emptySpk() });
  if (p === "/momo/work/speaking/file" && request.method === "GET") {   // v660 - a file for an engagement (PDF or picture), loaded to KV outside git; Kendall's key only
    const f = slug(url.searchParams.get("f") || ""), r = f ? await env.MEETINGS.getWithMetadata(SPK_FILE + person + "_" + f) : null;
    if (!r || !r.value) return new Response("not found", { status: 404 });
    const bin = Uint8Array.from(atob(r.value), (c) => c.charCodeAt(0)), m = r.metadata || {};
    return new Response(bin, { headers: { "Content-Type": m.type || "application/pdf", "Content-Disposition": 'inline; filename="' + String(m.name || f).replace(/[^\w. -]/g, "") + '"', "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  }
  if (p === "/momo/work/speaking/report" && request.method === "GET") return new Response(spkReport((await readSpk(env, person)) || emptySpk(), url.searchParams.get("id") || ""), { headers: H });
  if (p === "/momo/work/speaking/api" && request.method === "POST") {
    let b = {}; try { b = await request.json(); } catch (e) { return J({ error: "Send JSON." }, 400); }
    b = b || {};
    if (b.action === "save_dna") { const d = cleanDna(b.dna); d.updatedAt = new Date().toISOString(); await env.MEETINGS.put(DNA_PREFIX + person, JSON.stringify(d)); return J({ ok: true, dna: d }); }
    if (b.action === "write") {
      const rec = (await readSpk(env, person)) || emptySpk(), it = rec.items.find((i) => i.id === slug(b.id)); if (!it) return J({ error: "Not found." }, 404);
      const dna = await readDna(env, person); if (!dna) return J({ error: "Your DNA is not loaded yet." }, 400);
      const w = await writeFor(env, deps, dna, it, b.kind, b.words); return w.error ? J({ error: w.error }, w.status || 400) : J({ ok: true, text: w.text, kind: w.kind });
    }
    if (b.action === "parse_invite") { const r = await parseInvite(env, deps, b, dubaiDay()); return r.error ? J({ error: r.error }, r.status || 400) : J(r); }
    const r = await spkApi(env, person, b); return r.error ? J({ error: r.error }, r.status || 400) : J(r);
  }
  return new Response("not found", { status: 404 });
}
