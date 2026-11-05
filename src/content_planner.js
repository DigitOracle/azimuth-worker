// v758 FN CONTENT PLANNER (Kendall 4 Nov 2026: "Build it out in momo"; spec "FN Content Planner – Build Spec for Momo", 4 Nov 2026; approved
// mock-up Operations/Research/Content_Planner_Mockup_04NOV2026). A schedule, not a task list: Najjuko plans the slot, and choosing HOW IT'S MADE
// decides who makes it, so nobody types a name on every row. Every feed post and every story is one item; a Trial Reel is a date and a step on its Reel.
// The next unticked step is the item's status and its owner is who it is waiting on. Reached from Momo > Work > Content planner (no front-door card).
// KV (MEETINGS): cp_index [codes], cp_item_<code> {...item, log:[]}, cp_settings, cp_seq (ADD-n counter), cp_sheetmap (last import: code -> {tab,row}).
// The Google Sheet (content calendar) is two-way but INERT until Momo is connected (gsheet_token / cc_cfg from src/content_calendar.js).
import { gsToken } from "./content_calendar.js";

export const FEED_STEPS = ["Planned", "Who & how", "Brief", "Made", "Caption", "Approved", "Trial", "Scheduled", "Live", "Results"];
export const STORY_STEPS = ["Planned", "Who & how", "Made", "Approved", "Posted"];
// Responsible per step (contract RACI, Schedule 4); "maker" = derived from How it's made
export const OWNER = { "Planned": "Najjuko", "Who & how": "Najjuko", "Brief": "Najjuko", "Made": "maker", "Caption": "Sousan", "Approved": "Najjuko",
  "Trial": "Rouba", "Scheduled": "Rouba", "Live": "Rouba", "Results": "Sousan", "Posted": "Sousan" };
export const ACCOUNTABLE = { "Who & how": "Vishant consulted", "Brief": "Vishant consulted", "Made": "Vishant", "Approved": "Vishant checks first", "Scheduled": "Sousan backup", "Results": "Najjuko" };
export const HOW = ["Design (carousel / graphic)", "AI video", "In-house video (office)", "Professional video", "Edit of existing footage", "Repost / photo / text card"];
export const MAKER = { "Design (carousel / graphic)": "Monaza", "AI video": "Vishant", "In-house video (office)": "Liam", "Professional video": "Kareem",
  "Edit of existing footage": "Vishant", "Repost / photo / text card": "Sousan" };
export const FORMATS = ["Reel", "Carousel", "Static"];
export const STORY_TYPES = ["Commercial", "Trending", "Market"];
export const PILLARS = ["Trust", "Commercial", "Trending"];
export const NOT_COUNTED = ["AI", "Voice-over only", "No person", ""];
export const TEAM = ["Najjuko", "Vishant", "Monaza", "Liam", "Kareem", "Sousan", "Rouba"];
export const DEFAULT_SETTINGS = {
  pro_video_allowance: 10, on_camera_limit: 1, story_times: ["08:00", "13:00", "15:00"], plan_start: "2026-11-02", plan_end: "2026-12-31",
  best_from: "10:00", best_to: "14:00", evening_from: "17:00", evening_to: "21:00", reel_days: [2, 6], check_days: [1, 0],   // 0 Sun .. 6 Sat
  trial_hours: 72, feed_target: 51,
};
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const esc = (s) => String(s == null ? "" : s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
const J = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
const okDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ""));
const okTime = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(t || ""));
export const dubaiToday = (now) => new Date((now || Date.now()) + 4 * 3600e3).toISOString().slice(0, 10);
const nowIso = () => new Date().toISOString();
const dowOf = (d) => new Date(d + "T00:00:00Z").getUTCDay();
const addDays = (d, n) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
export const fmtDay = (d) => okDate(d) ? DOW[dowOf(d)] + " " + parseInt(d.slice(8), 10) + " " + MON[+d.slice(5, 7) - 1] : "";

// ---------- pure rules (tested) ----------
export const stepsOf = (it) => (it.kind === "story" ? STORY_STEPS : FEED_STEPS).filter((s) => s !== "Trial" || (it.kind === "feed" && it.format === "Reel"));
export const makerOf = (it) => MAKER[it && it.how] || "";
export function ownerOf(it, step) { const o = OWNER[step]; return o === "maker" ? (makerOf(it) || "the maker (choose how it's made)") : o; }
// v758 - "Who & how" ticks itself when both are chosen
export function doneSet(it) { const d = new Set(Object.keys(it.done || {}).filter((k) => it.done[k] && it.done[k].done)); if (it.who && it.how) d.add("Who & how"); return d; }
export function statusOf(it) {
  const d = doneSet(it), st = stepsOf(it);
  const nxt = st.find((s) => !d.has(s));
  return nxt ? { step: nxt, owner: ownerOf(it, nxt), done: st.filter((s) => d.has(s)).length, of: st.length } : { step: "Done", owner: "", done: st.length, of: st.length };
}
// Trial Reel date = live date - 3 days (72 hours), same time of day
export function trialOf(it, settings) {
  if (it.kind !== "feed" || it.format !== "Reel" || !okDate(it.date)) return null;
  const days = Math.round(((settings && settings.trial_hours) || 72) / 24);
  return { date: addDays(it.date, -days), time: it.time || "" };
}
const tm = (t) => okTime(t) ? +t.slice(0, 2) * 60 + +t.slice(3) : null;
// QA/QC against the DigitAlchemy Instagram audit (DA-RPT-FNR-001 Rev 3.0) and the 28 Oct posting rhythm. Feed posts only. Levels: fix > check > note.
export function qaOf(it, settings, today) {
  const S = Object.assign({}, DEFAULT_SETTINGS, settings || {}), out = [];
  if (it.kind !== "feed") return out;
  const t = tm(it.time), d = okDate(it.date) ? dowOf(it.date) : null;
  if (t == null) out.push(["fix", "No time set", "Posting rhythm"]);
  else if (t >= tm(S.evening_from) && t < tm(S.evening_to)) out.push(["fix", "Posted " + S.evening_from + "–" + S.evening_to, "Audit: evenings weakest (median 36)"]);
  else if (t < tm(S.best_from) || t >= tm(S.best_to)) out.push(["check", "Time outside " + S.best_from + "–" + S.best_to, "Posting rhythm (rotating until the 23 Nov review)"]);
  if (d === 1 && S.check_days.includes(1)) out.push(["check", "Monday", "Audit: weak day (median 46)"]);
  if (d === 0 && S.check_days.includes(0)) out.push(["check", "Sunday", "Audit: weakest day (median 25.5)"]);
  if (it.format === "Static") out.push(["fix", "Static image", "Audit: stop posting images (median 13)"]);
  if (it.format === "Carousel") out.push(["note", "Carousel", "Audit doesn't recommend carousels (median 17.5); kept as a trial"]);
  if (it.format === "Reel" && d != null && !S.reel_days.includes(d)) out.push(["note", "Reel not on Tue or Sat", "Audit: best days Tue (79), Sat (68.5)"]);
  const tr = trialOf(it, S);
  if (tr) {
    const ticked = doneSet(it).has("Trial");
    if (tr.date < S.plan_start) { if (!ticked) out.push(["check", "Trial date " + fmtDay(tr.date) + " is before the plan start", "Confirm it was posted"]); }
    else if (tr.date < (today || dubaiToday()) && !ticked) out.push(["fix", "Trial date " + fmtDay(tr.date) + " passed and not ticked", "72-hour trial rule"]);
  }
  if (it.pillar === "Commercial" || it.developer) out.push(["note", "Property content", "Trakheesi permit needed"]);
  return out;
}
export const qaLevel = (qa) => qa.some((x) => x[0] === "fix") ? "fix" : qa.some((x) => x[0] === "check") ? "check" : "clear";
// appearances per person in a month (AI, voice-over only and no person are not counted)
export function onCamera(items, month) {
  const m = {};
  items.forEach((it) => { if (it.deleted || !okDate(it.date) || it.date.slice(0, 7) !== month) return; String(it.who || "").split(",").map((x) => x.trim()).filter((x) => x && !NOT_COUNTED.includes(x)).forEach((p) => { m[p] = (m[p] || 0) + 1; }); });
  return m;
}
export function derive(it, settings, today) {
  const st = statusOf(it), qa = qaOf(it, settings, today), tr = trialOf(it, settings);
  return Object.assign({}, it, { maker: makerOf(it), steps: stepsOf(it), status: st, qa, qa_level: qaLevel(qa), trial: tr });
}

// ---------- store ----------
async function getJ(env, k, d) { try { const v = await env.MEETINGS.get(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
export async function readSettings(env) { return Object.assign({}, DEFAULT_SETTINGS, await getJ(env, "cp_settings", {})); }
export async function readItems(env) {
  const idx = await getJ(env, "cp_index", []), out = [];
  for (let i = 0; i < idx.length; i += 50) {
    const part = await Promise.all(idx.slice(i, i + 50).map((c) => getJ(env, "cp_item_" + c, null)));
    part.forEach((x) => { if (x && !x.deleted) out.push(x); });
  }
  return out;
}
const CODE_RX = /^[A-Z][A-Z0-9-]{1,40}$/;
const FIELDS = ["kind", "date", "time", "format", "story_type", "pillar", "series", "topic", "cta", "campaign", "developer", "who", "how", "added", "note"];
export function cleanItem(b, prev) {
  const it = Object.assign({ done: {}, log: [] }, prev || {});
  FIELDS.forEach((f) => { if (b[f] !== undefined) it[f] = typeof b[f] === "string" ? b[f].trim().slice(0, f === "topic" || f === "note" ? 400 : 120) : b[f]; });
  it.kind = it.kind === "story" ? "story" : "feed";
  if (it.kind === "story") { it.format = ""; it.pillar = ""; it.series = ""; it.cta = ""; it.campaign = ""; }
  if (it.format && !FORMATS.includes(it.format)) it.format = "";
  if (it.story_type && !STORY_TYPES.includes(it.story_type)) it.story_type = "";
  if (it.how && !HOW.includes(it.how)) it.how = "";
  if (it.date && !okDate(it.date)) return { error: "Date must be YYYY-MM-DD." };
  if (it.time && !okTime(it.time)) return { error: "Time must be HH:MM (Dubai)." };
  it.added = !!it.added;
  return { item: it };
}
const logAdd = (it, who, what) => { it.log = [{ at: nowIso(), who, what }].concat(it.log || []).slice(0, 200); };
async function saveItem(env, it) {
  await env.MEETINGS.put("cp_item_" + it.code, JSON.stringify(it));
  const idx = await getJ(env, "cp_index", []);
  if (!idx.includes(it.code)) { idx.push(it.code); await env.MEETINGS.put("cp_index", JSON.stringify(idx)); }
}
async function nextCode(env, it) {
  const n = (parseInt((await env.MEETINGS.get("cp_seq")) || "0", 10) || 0) + 1; await env.MEETINGS.put("cp_seq", String(n));
  return "ADD-" + n;
}
const diffLine = (prev, it) => FIELDS.filter((f) => String((prev || {})[f] || "") !== String(it[f] || "")).map((f) => f + ": " + (String((prev || {})[f] || "") || "empty") + " → " + (String(it[f] || "") || "empty")).join("; ");

// one write path for the page and the bridge: save (create/update), tick, delete, settings
export async function applyAction(env, b, who) {
  const S = await readSettings(env);
  if (b.action === "save") {
    const code = String(b.code || "").toUpperCase();
    const prev = code ? await getJ(env, "cp_item_" + code, null) : null;
    if (code && !CODE_RX.test(code)) return [400, { error: "Bad code." }];
    const r = cleanItem(b, prev); if (r.error) return [400, { error: r.error }];
    const it = r.item; it.code = code || await nextCode(env, it); if (!prev) it.added = b.added !== undefined ? !!b.added : !code;
    if (it.kind === "story" && !it.time) it.time = S.story_times[0];
    const ch = diffLine(prev, it); logAdd(it, who, prev ? (ch || "saved") : "created" + (it.added ? " (added outside the plan)" : ""));
    it.updated = nowIso(); await saveItem(env, it); return [200, { ok: true, item: derive(it, S) }];
  }
  if (b.action === "tick") {
    const code = String(b.code || "").toUpperCase(), step = String(b.step || "");
    const it = await getJ(env, "cp_item_" + code, null); if (!it || it.deleted) return [404, { error: "No item " + code + "." }];
    if (!stepsOf(it).includes(step)) return [400, { error: "Step " + step + " is not on this item." }];
    if (step === "Approved" && who !== "Najjuko" && who !== "Kendall") return [403, { error: "Only Najjuko can tick Approved." }];
    const on = b.done !== false; it.done = it.done || {};
    if (step === "Who & how" && !on && it.who && it.how) return [400, { error: "Who & how ticks itself while both are chosen: clear one to undo it." }];
    it.done[step] = on ? { done: true, by: who, at: nowIso() } : { done: false, by: who, at: nowIso() };
    logAdd(it, who, (on ? "ticked " : "unticked ") + step); it.updated = nowIso(); await saveItem(env, it);
    return [200, { ok: true, item: derive(it, S) }];
  }
  if (b.action === "delete") {
    const code = String(b.code || "").toUpperCase(); const it = await getJ(env, "cp_item_" + code, null); if (!it) return [404, { error: "No item." }];
    it.deleted = true; logAdd(it, who, "deleted"); it.updated = nowIso(); await env.MEETINGS.put("cp_item_" + code, JSON.stringify(it)); return [200, { ok: true }];
  }
  if (b.action === "settings") {
    if (who !== "Najjuko" && who !== "Kendall") return [403, { error: "Only Najjuko changes the settings." }];
    const cur = await getJ(env, "cp_settings", {}), x = b.settings || {};
    ["pro_video_allowance", "on_camera_limit", "trial_hours", "feed_target"].forEach((k) => { if (x[k] !== undefined && Number(x[k]) >= 0 && Number(x[k]) < 1000) cur[k] = Math.round(Number(x[k])); });
    ["best_from", "best_to", "evening_from", "evening_to"].forEach((k) => { if (okTime(x[k])) cur[k] = x[k]; });
    ["plan_start", "plan_end"].forEach((k) => { if (okDate(x[k])) cur[k] = x[k]; });
    if (Array.isArray(x.story_times) && x.story_times.every(okTime)) cur.story_times = x.story_times.slice(0, 6);
    await env.MEETINGS.put("cp_settings", JSON.stringify(cur)); return [200, { ok: true, settings: Object.assign({}, DEFAULT_SETTINGS, cur) }];
  }
  return [400, { error: "Unknown action." }];
}

export function report(items, S, from, to, today) {
  const its = items.filter((i) => okDate(i.date) && i.date >= from && i.date <= to).map((i) => derive(i, S, today));
  const feed = its.filter((i) => i.kind === "feed"), stories = its.filter((i) => i.kind === "story");
  const trials = items.map((i) => derive(i, S, today)).filter((i) => i.trial && i.trial.date >= from && i.trial.date <= to);
  const posted = its.filter((i) => i.status.step === "Done" || doneSet(i).has("Live") || doneSet(i).has("Posted")).length;
  const late = its.filter((i) => i.date < today && i.status.step !== "Done" && !doneSet(i).has("Live") && !doneSet(i).has("Posted")).length;
  const waiting = {}; its.forEach((i) => { if (i.status.step !== "Done") (waiting[i.status.owner] = waiting[i.status.owner] || []).push({ code: i.code, date: i.date, step: i.status.step, name: i.topic || "" }); });
  const allFeed = items.filter((i) => i.kind === "feed").map((i) => derive(i, S, today));
  const how = {}; allFeed.forEach((i) => { if (i.how) how[i.how] = (how[i.how] || 0) + 1; });
  return {
    from, to, totals: { feed: feed.length, stories: stories.length, trials: trials.length, posted_pct: its.length ? Math.round(posted * 100 / its.length) : 0, late, qa_fix: feed.filter((i) => i.qa_level === "fix").length, qa_check: feed.filter((i) => i.qa_level === "check").length },
    waiting, qa: feed.filter((i) => i.qa.length).map((i) => ({ code: i.code, date: i.date, time: i.time, topic: i.topic, format: i.format, level: i.qa_level, rules: i.qa })),
    plan: { feed_planned: allFeed.length, feed_target: S.feed_target, reels: allFeed.filter((i) => i.format === "Reel").length, carousels: allFeed.filter((i) => i.format === "Carousel").length,
      added: items.filter((i) => i.added).length, chosen_pct: allFeed.length ? Math.round(allFeed.filter((i) => i.who && i.how).length * 100 / allFeed.length) : 0 },
    how, pro_used: items.filter((i) => i.how === "Professional video").length, pro_allowance: S.pro_video_allowance,
    on_camera: onCamera(items, (to || today).slice(0, 7)), on_camera_limit: S.on_camera_limit,
  };
}

// ---------- Google Sheet (two-way, inert until connected) ----------
// Tolerant header matching. TODO(content_calendar_map.md on Najjuko's laptop): replace these patterns with the exact column map and the protected-cell list.
const HEAD = { code: /^(task\s*)?code$|^id$/i, date: /^date$|day.*date|^date\b/i, time: /^time\b|post(ing)?\s*time/i, format: /^format$|post type|^type$/i, story_type: /story\s*type|^type$/i, story_no: /^story\s*(#|no\b|number)/i,
  pillar: /pillar/i, series: /series/i, topic: /topic|idea|story|content|title|hook/i, cta: /call to action|^cta$/i, campaign: /campaign/i, developer: /developer|project/i,
  who: /who'?s in it|talent|agent|featuring/i, how: /how it'?s made|production|made by|source/i };
const PROTECTED = /trial/i;   // the trial-date formula column is never written
function tabFind(tabs, rx) { return (tabs || []).find((t) => rx.test(t)); }
function headerMap(headers, kind) {
  const m = {};
  headers.forEach((h, i) => { const hh = String(h || "").trim(); if (!hh || PROTECTED.test(hh)) return;
    for (const f of Object.keys(HEAD)) { if (m[f] != null) continue; if (f === "format" && kind === "story") continue; if (f === "story_type" && kind === "feed") continue; if (HEAD[f].test(hh)) { m[f] = i; break; } } });
  return m;
}
const colA = (i) => { let s = ""; i++; while (i > 0) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); } return s; };
function parseDate(v) {
  v = String(v || "").trim(); if (okDate(v)) return v;
  let m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/.exec(v); if (m) return m[3] + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0");
  m = /(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s*(\d{4})?/.exec(v); if (m) { const mo = MON.findIndex((x) => x.toLowerCase() === m[2].toLowerCase()); if (mo >= 0) return (m[3] || "2026") + "-" + String(mo + 1).padStart(2, "0") + "-" + m[1].padStart(2, "0"); }
  return "";
}
function parseTime(v) { const m = /(\d{1,2})[:.](\d{2})\s*(am|pm)?/i.exec(String(v || "")); if (!m) return ""; let h = +m[1]; if (m[3]) { const pm = /pm/i.test(m[3]); if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0; } return String(h).padStart(2, "0") + ":" + m[2]; }
const pick = (v, list) => { v = String(v || "").trim().toLowerCase(); return list.find((x) => x.toLowerCase() === v) || list.find((x) => v && x.toLowerCase().startsWith(v.split(/[ (]/)[0])) || ""; };
async function sheetCtx(env) {
  const tok = await gsToken(env); const cfg = await getJ(env, "cc_cfg", null);
  if (!tok || !cfg || !cfg.sheet_id) return null;
  return { tok, id: cfg.sheet_id, H: { Authorization: "Bearer " + tok } };
}
async function sheetTabs(cx) {
  const r = await fetch("https://sheets.googleapis.com/v4/spreadsheets/" + cx.id + "?fields=sheets.properties(title,sheetId)", { headers: cx.H });
  if (!r.ok) throw new Error("Google said " + r.status); return ((await r.json()).sheets || []).map((s) => s.properties);
}
async function readTab(cx, title) {
  const r = await fetch("https://sheets.googleapis.com/v4/spreadsheets/" + cx.id + "/values/" + encodeURIComponent("'" + title.replace(/'/g, "''") + "'!A1:Z800"), { headers: cx.H });
  if (!r.ok) throw new Error("Google said " + r.status + " reading " + title); return (await r.json()).values || [];
}
export function rowsToItems(values, kind, tab) {
  const headers = values[4] || [], map = headerMap(headers, kind), out = [], seen = {};   // header row 5, data from row 6
  for (let r = 5; r < values.length; r++) {
    const row = values[r] || [], g = (f) => map[f] != null ? String(row[map[f]] || "").trim() : "";
    const date = parseDate(g("date")); if (!date) continue;   // week band rows and blank rows carry no date
    // v773b (Kendall 5 Nov: her sheet has no code column) - Momo makes a stable code from the date and the order on that date (story # when given):
    // FD-1103-1 = first feed post on 3 Nov, ST-1102-2 = story 2 on 2 Nov. A real code column, when the sheet has one, still wins.
    const dk = kind + date; seen[dk] = (seen[dk] || 0) + 1;
    const nth = kind === "story" && /^\d{1,2}$/.test(g("story_no")) ? g("story_no") : String(seen[dk]);
    const code = (g("code") || ((kind === "story" ? "ST-" : "FD-") + date.slice(5, 7) + date.slice(8, 10) + "-" + nth)).toUpperCase().replace(/\s+/g, "");
    out.push({ code, kind, date, time: parseTime(g("time")), format: kind === "feed" ? pick(g("format"), FORMATS) : "", story_type: kind === "story" ? pick(g("story_type") || g("format"), STORY_TYPES) : "",
      pillar: kind === "feed" ? pick(g("pillar"), PILLARS) : "", series: g("series"), topic: g("topic"), cta: g("cta"), campaign: g("campaign"), developer: g("developer"), who: g("who"), how: pick(g("how"), HOW),
      _ref: { tab, row: r + 1 } });
  }
  return { items: out, map, headers };
}
export async function sheetImport(env, apply, who) {
  const cx = await sheetCtx(env); if (!cx) return [409, { error: "not_connected" }];
  let tabs; try { tabs = await sheetTabs(cx); } catch (e) { return [502, { error: String(e.message || e) }]; }
  const titles = tabs.map((t) => t.title), feedTab = tabFind(titles, /^feed/i), storyTab = tabFind(titles, /^stor/i);
  if (!feedTab && !storyTab) return [400, { error: "No Feed or Stories tab found. Tabs: " + titles.join(", ") }];
  const got = [], maps = {};
  try {
    if (feedTab) { const x = rowsToItems(await readTab(cx, feedTab), "feed", feedTab); got.push(...x.items); maps[feedTab] = x.map; }
    if (storyTab) { const x = rowsToItems(await readTab(cx, storyTab), "story", storyTab); got.push(...x.items); maps[storyTab] = x.map; }
  } catch (e) { return [502, { error: String(e.message || e) }]; }
  const preview = { feed: got.filter((i) => i.kind === "feed").length, stories: got.filter((i) => i.kind === "story").length, tabs: { feed: feedTab || null, stories: storyTab || null },
    columns: Object.fromEntries(Object.entries(maps).map(([t, m]) => [t, Object.keys(m)])), sample: got.slice(0, 3).map((i) => ({ code: i.code, date: i.date, time: i.time, topic: i.topic })) };
  if (!apply) return [200, { ok: true, preview }];
  const ref = {}, dates = {}, newCodes = []; let made = 0, changed = 0;
  for (const g of got) {
    const prev = await getJ(env, "cp_item_" + g.code, null), r = cleanItem(g, prev); if (r.error) continue;
    const it = r.item; it.code = g.code; it.added = prev ? !!prev.added : false; ref[g.code] = g._ref; dates[g.code] = g.date;
    const ch = diffLine(prev, it); if (prev && !ch) continue;
    logAdd(it, "Sheet", prev ? "from the sheet: " + ch : "imported from the sheet"); it.updated = nowIso();
    await env.MEETINGS.put("cp_item_" + it.code, JSON.stringify(it)); newCodes.push(it.code); prev ? changed++ : made++;   // v773c - the index is written ONCE below (231 writes to one key were refused)
  }
  if (newCodes.length) { const idx = await getJ(env, "cp_index", []); let add = false; for (const c of newCodes) if (!idx.includes(c)) { idx.push(c); add = true; } if (add) await env.MEETINGS.put("cp_index", JSON.stringify(idx)); }
  await env.MEETINGS.put("cp_sheetmap", JSON.stringify({ ref, dates, maps, at: nowIso(), by: who }));
  return [200, { ok: true, preview, created: made, updated: changed }];
}
// Momo -> sheet for one item: preview the cell changes, then (confirm) write them and append each to the Change log tab
export async function sheetPush(env, code, apply, who, why) {
  const cx = await sheetCtx(env); if (!cx) return [409, { error: "not_connected" }];
  const sm = await getJ(env, "cp_sheetmap", null), it = await getJ(env, "cp_item_" + code, null);
  if (!it) return [404, { error: "No item." }];
  const ref = sm && sm.ref && sm.ref[code]; if (!ref) return [409, { error: "This item is not in the sheet yet (added in Momo). Add its row in the sheet, then Import." }];
  const map = sm.maps[ref.tab] || {};
  let vals; try { vals = await readTab(cx, ref.tab); } catch (e) { return [502, { error: String(e.message || e) }]; }
  const row = vals[ref.row - 1] || []; if (map.code != null ? String(row[map.code] || "").trim().toUpperCase().replace(/\s+/g, "") !== code : (map.date != null && parseDate(row[map.date]) !== it.date && parseDate(row[map.date]) !== (sm.dates && sm.dates[code]))) return [409, { error: "The sheet row moved. Import again first." }];
  const changes = [];
  Object.keys(map).forEach((f) => { if (f === "code" || f === "story_no" || !(f in it)) return; const old = String(row[map[f]] || ""), nv = String(it[f] || "");
    if (f === "date" ? parseDate(old) !== nv : f === "time" ? parseTime(old) !== nv : old.trim() !== nv) changes.push({ cell: colA(map[f]) + ref.row, field: f, old, new: nv }); });
  if (!apply) return [200, { ok: true, tab: ref.tab, changes }];
  if (!changes.length) return [200, { ok: true, written: 0 }];
  const q = "'" + ref.tab.replace(/'/g, "''") + "'!";
  const w = await fetch("https://sheets.googleapis.com/v4/spreadsheets/" + cx.id + "/values:batchUpdate", { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, cx.H),
    body: JSON.stringify({ valueInputOption: "USER_ENTERED", data: changes.map((c) => ({ range: q + c.cell, values: [[c.new]] })) }) });
  if (!w.ok) return [502, { error: "Google said " + w.status + " writing the sheet." }];
  // the Change log tab: created on first use
  let tabs = []; try { tabs = await sheetTabs(cx); } catch (e) {}
  if (!tabs.some((t) => /^change log$/i.test(t.title))) {
    await fetch("https://sheets.googleapis.com/v4/spreadsheets/" + cx.id + ":batchUpdate", { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, cx.H), body: JSON.stringify({ requests: [{ addSheet: { properties: { title: "Change log" } } }] }) });
    await fetch("https://sheets.googleapis.com/v4/spreadsheets/" + cx.id + "/values/" + encodeURIComponent("'Change log'!A1") + ":append?valueInputOption=RAW", { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, cx.H), body: JSON.stringify({ values: [["When", "Tab", "Cell", "Item", "Old value", "New value", "Why", "Asked by", "Applied by"]] }) });
  }
  const when = new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 16).replace("T", " ");
  await fetch("https://sheets.googleapis.com/v4/spreadsheets/" + cx.id + "/values/" + encodeURIComponent("'Change log'!A1") + ":append?valueInputOption=RAW", { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, cx.H),
    body: JSON.stringify({ values: changes.map((c) => [when, ref.tab, c.cell, code, c.old, c.new, String(why || "Changed in Momo").slice(0, 200), who, "Momo"]) }) });
  it.log = [{ at: nowIso(), who, what: "written to the sheet: " + changes.map((c) => c.cell + " " + c.field).join(", ") }].concat(it.log || []).slice(0, 200);
  await env.MEETINGS.put("cp_item_" + code, JSON.stringify(it));
  return [200, { ok: true, written: changes.length }];
}

// ---------- the page ----------
function client(CFG) {
  var D = { items: [], settings: {}, today: "", connected: false }, V = "day", DAY = "", OPEN = null, SHOW = "all", AS = "", HOWF = "", WHOF = "", POLL = null;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[<>&"]/g, function (c) { return { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]; }); };
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var dow = function (d) { return new Date(d + "T00:00:00Z").getUTCDay(); };
  var fd = function (d) { return d ? DOW[dow(d)] + " " + parseInt(d.slice(8), 10) + " " + MON[+d.slice(5, 7) - 1] : ""; };
  var add = function (d, n) { var x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  var monday = function (d) { var w = dow(d); return add(d, w === 0 ? -6 : 1 - w); };
  var api = function (b) { return fetch(CFG.base + "/api" + CFG.q, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }).then(function (r) { return r.json(); }); };
  function toast(t, bad) { var e = $("toast"); e.textContent = t; e.className = "toast on" + (bad ? " bad" : ""); clearTimeout(e._t); e._t = setTimeout(function () { e.className = "toast"; }, 3200); }
  function load(quiet) { return fetch(CFG.base + "/data" + CFG.q).then(function (r) { return r.json(); }).then(function (j) { if (!j.ok) { if (!quiet) toast(j.error || "Could not load", true); return; } D = j; if (!DAY) DAY = j.today; draw(); }).catch(function () { if (!quiet) toast("No connection", true); }); }
  function vis(it) { if (SHOW === "feed" && it.kind !== "feed") return false; if (SHOW === "stories" && it.kind !== "story") return false; if (HOWF && it.how !== HOWF) return false; if (WHOF && String(it.who || "").indexOf(WHOF) < 0) return false; if (AS && it.status.owner !== AS && it.maker !== AS) return false; return true; }
  function typeOf(it) { return it.kind === "story" ? "Story" + (it.story_type ? " · " + it.story_type : "") : "Feed" + (it.format ? " · " + it.format : ""); }
  function nameOf(it) { return it.topic || "No idea yet (empty in the sheet)"; }
  function stepBtns(it) { var d = {}; Object.keys(it.done || {}).forEach(function (k) { if (it.done[k] && it.done[k].done) d[k] = 1; }); if (it.who && it.how) d["Who & how"] = 1;
    return '<div class=stp>' + it.steps.map(function (s) { var c = d[s] ? "done" : (it.status.step === s ? "cur" : ""); return '<button type=button class="' + c + '" data-tick="' + esc(it.code) + '" data-step="' + esc(s) + '" data-on="' + (d[s] ? 0 : 1) + '">' + esc(s) + '</button>'; }).join("") + '</div>'; }
  function card(it, trial) {
    if (trial) return '<div class=c data-open="' + esc(it.code) + '"><div class=h><span class=t>' + esc(it.trial.time || "") + '</span><span class=k>Trial Reel · goes live ' + esc(fd(it.date)) + '</span></div><div class=n>' + esc(nameOf(it)) + '</div><div class=nx>' + (it.done && it.done.Trial && it.done.Trial.done ? '<b>Trial posted</b>' : 'Next: <b>Trial</b> · Rouba') + '</div></div>';
    return '<div class=c data-open="' + esc(it.code) + '"><div class=h><span class=t>' + esc(it.time || "--:--") + '</span><span class=k>' + esc(typeOf(it)) + '</span></div><div class=n>' + esc(nameOf(it)) + '</div><div class=nx>' + (it.status.step === "Done" ? '<b>All steps done</b>' : 'Next: <b>' + esc(it.status.step) + '</b> · ' + esc(it.status.owner)) + '</div>' + stepBtns(it) + '</div>';
  }
  function on(day) { return D.items.filter(function (i) { return i.date === day && vis(i); }).sort(function (a, b) { return (a.time || "99") < (b.time || "99") ? -1 : 1; }); }
  function trialsOn(day) { return D.items.filter(function (i) { return i.trial && i.trial.date === day && vis(i); }); }
  function empty() { return '<div class=emp><p><b>Nothing planned yet.</b></p><p>Import the content calendar, or add the first item.</p>' + (D.connected ? '<button class=bt data-act=import>Import from sheet</button>' : '<a class=bt href="/gsheet/start' + CFG.q + '">Connect the content calendar</a>') + '<div class=row2><button class=bo data-add=feed>+ Add feed post</button><button class=bo data-add=story>+ Add story</button></div></div>'; }
  function vDay() {
    var s = on(DAY).filter(function (i) { return i.kind === "story"; }), f = on(DAY).filter(function (i) { return i.kind === "feed"; }), t = trialsOn(DAY);
    return '<div class=db><button class=ar data-day=-1 aria-label="Previous day">&#8249;</button><b>' + esc(fd(DAY)) + (DAY === D.today ? ' · today' : '') + '</b><button class=ar data-day=1 aria-label="Next day">&#8250;</button></div>'
      + '<div class=sec>STORIES · ' + s.length + '<button class=ad data-add=story>+ Add story</button></div>' + (s.map(function (i) { return card(i); }).join("") || '<p class=mt>No stories planned.</p>')
      + '<div class=sec>FEED<button class=ad data-add=feed>+ Add feed post</button></div>' + (f.map(function (i) { return card(i); }).join("") || '<p class=mt>No feed post planned.</p>')
      + '<div class=sec>TRIAL REELS TODAY</div>' + (t.map(function (i) { return card(i, true); }).join("") || '<p class=mt>None.</p>');
  }
  function vWeek() {
    var m = monday(DAY), cols = ""; for (var k = 0; k < 7; k++) { var d = add(m, k);
      cols += '<div class="wc' + (d === D.today ? ' td' : '') + '" data-goday="' + d + '"><b>' + DOW[dow(d)] + ' ' + parseInt(d.slice(8), 10) + '</b>'
        + on(d).filter(function (i) { return i.kind === "feed"; }).map(function (i) { return '<div class=wp draggable=true data-drag="' + esc(i.code) + '" data-open="' + esc(i.code) + '">' + esc((i.format || "Post") + " · " + nameOf(i)) + '</div>'; }).join("")
        + trialsOn(d).map(function (i) { return '<div class="wp tr" data-open="' + esc(i.code) + '">Trial · ' + esc(nameOf(i)) + '</div>'; }).join("")
        + on(d).filter(function (i) { return i.kind === "story"; }).map(function (i) { return '<div class=ws data-open="' + esc(i.code) + '">' + esc((i.time || "") + " " + (i.story_type || "Story")) + '</div>'; }).join("") + '</div>'; }
    return '<div class=db><button class=ar data-day=-7>&#8249;</button><b>Week of ' + esc(fd(m)) + '</b><button class=ar data-day=7>&#8250;</button></div><div class=wk>' + cols + '</div><p class=mt>Drag a post to another day to move it.</p>';
  }
  function vMonth() {
    var first = DAY.slice(0, 8) + "01", st = monday(first), h = ["M", "T", "W", "T", "F", "S", "S"].map(function (x) { return '<div class=dw>' + x + '</div>'; }).join("");
    for (var k = 0; k < 42; k++) { var d = add(st, k); if (k >= 35 && d.slice(0, 7) !== DAY.slice(0, 7)) break; var its = on(d), tr = trialsOn(d);
      h += '<div class="md' + (d.slice(0, 7) !== DAY.slice(0, 7) ? ' oth' : '') + (d === D.today ? ' td' : '') + '" data-goday="' + d + '"><span>' + parseInt(d.slice(8), 10) + '</span><div class=dots>'
        + its.filter(function (i) { return i.kind === "feed"; }).map(function () { return '<i></i>'; }).join("") + its.filter(function (i) { return i.kind === "story"; }).map(function () { return '<i class=s></i>'; }).join("") + tr.map(function () { return '<i class=t></i>'; }).join("") + '</div></div>'; }
    return '<div class=db><button class=ar data-month=-1>&#8249;</button><b>' + MON[+DAY.slice(5, 7) - 1] + ' ' + DAY.slice(0, 4) + '</b><button class=ar data-month=1>&#8250;</button></div><div class=lg><span><i></i>Feed post</span><span><i class=s></i>Story</span><span><i class=t></i>Trial Reel</span></div><div class=mo>' + h + '</div>';
  }
  function vQueue() {
    var rows = []; D.items.forEach(function (i) { if (!vis(i)) return; if (i.date >= D.today) rows.push([i.date + (i.time || "99"), i, false]); if (i.trial && i.trial.date >= D.today) rows.push([i.trial.date + (i.trial.time || "99"), i, true]); });
    rows.sort(function (a, b) { return a[0] < b[0] ? -1 : 1; });
    return '<div class=sec>FROM TODAY · IN TIME ORDER</div>' + (rows.slice(0, 120).map(function (r) { var i = r[1], d = r[2] ? i.trial.date : i.date, t = r[2] ? i.trial.time : i.time;
      var step = r[2] ? "Trial" : i.status.step, own = r[2] ? "Rouba" : i.status.owner, done = r[2] ? !!(i.done && i.done.Trial && i.done.Trial.done) : i.status.step === "Done";
      return '<div class=qr><input type=checkbox ' + (done ? 'checked ' : '') + (step === "Done" ? 'disabled ' : '') + 'data-tick="' + esc(i.code) + '" data-step="' + esc(step) + '" data-on="' + (done ? 0 : 1) + '" aria-label="Tick ' + esc(step) + '"><span class=qw>' + esc(fd(d).slice(0, 6)) + '<br>' + esc(t || "--:--") + '</span><div data-open="' + esc(i.code) + '">' + esc(r[2] ? "Trial Reel" : typeOf(i)) + ' — ' + esc(nameOf(i)) + '<br><small>' + (done ? 'Done' : 'Next: ' + esc(step) + ' · ' + esc(own)) + '</small></div></div>'; }).join("") || '<p class=mt>Nothing from today.</p>');
  }
  function vFlow() {
    var STEPS = ["Planned", "Who & how", "Brief", "Made", "Caption", "Approved", "Trial", "Scheduled", "Live", "Results", "Posted"];
    return '<div class=sec>WHAT IT’S WAITING ON · SWIPE →</div><div class=wf>' + STEPS.map(function (s) { var its = D.items.filter(function (i) { return vis(i) && i.status.step === s && i.date >= add(D.today, -14); });
      return '<div class=fc><h4>' + esc(s) + ' <span>' + its.length + '</span></h4><div class=ra>R ' + esc(D.owner[s] === "maker" ? "the maker" : D.owner[s]) + (D.acc[s] ? ' · ' + esc(D.acc[s]) : '') + '</div>'
        + its.slice(0, 30).map(function (i) { return '<div class=mi data-open="' + esc(i.code) + '"><b>' + esc(fd(i.date)) + '</b> ' + esc(typeOf(i)) + '<br>' + esc(nameOf(i)) + (s === "Made" && i.maker ? '<br><small>' + esc(i.maker) + '</small>' : '') + '</div>'; }).join("") + '</div>'; }).join("") + '</div>';
  }
  var RF = "week";
  function vRep() {
    var r = D.report || {}, t = r.totals || {}, p = r.plan || {};
    var tile = function (v, l, pct) { return '<div class=tl><div class=v>' + v + '</div><div class=l>' + l + '</div>' + (pct != null ? '<div class=bar><i style="width:' + Math.min(100, pct) + '%"></i></div>' : '') + '</div>'; };
    var oc = r.on_camera || {}, ppl = Object.keys(oc).sort();
    return '<div class=seg2>' + ["day", "week", "month"].map(function (x) { return '<button class="' + (RF === x ? 'on' : '') + '" data-rf=' + x + '>' + x.charAt(0).toUpperCase() + x.slice(1) + '</button>'; }).join("") + '</div>'
      + '<div class=db><b>' + esc(fd(r.from)) + (r.to !== r.from ? ' – ' + esc(fd(r.to)) : '') + '</b><button class=bo data-act=print>PDF</button></div>'
      + '<div class=tiles>' + tile(t.feed || 0, "Feed posts") + tile(t.stories || 0, "Stories") + tile(t.trials || 0, "Trial Reels due") + tile((t.posted_pct || 0) + "%", "Posted", t.posted_pct || 0) + tile(t.late || 0, "Late") + tile((t.qa_fix || 0) + " / " + (t.qa_check || 0), "QA/QC fix / check") + '</div>'
      + '<div class=sec>QA/QC · AGAINST THE AUDIT</div><div class=qa>' + ((r.qa || []).filter(function (q) { return q.level !== "clear"; }).map(function (q) { return '<div class=qq data-open="' + esc(q.code) + '"><span class="pl ' + q.level + '">' + q.level.toUpperCase() + '</span><div><b>' + esc(fd(q.date)) + ' · ' + esc(q.topic || q.code) + '</b><br>' + q.rules.filter(function (x) { return x[0] !== "note"; }).map(function (x) { return esc(x[1]) + ' <small>(' + esc(x[2]) + ')</small>'; }).join("<br>") + '</div></div>'; }).join("") || '<div class=qq><span class="pl clear">CLEAR</span><div>No fixes or checks.</div></div>') + '</div>'
      + '<div class=sec>WAITING ON</div><div class=ppl>' + Object.keys(r.waiting || {}).map(function (o) { return '<div class=pe><i>' + esc(o.charAt(0)) + '</i>' + esc(o) + '<em>' + r.waiting[o].length + '</em></div>'; }).join("") + '</div>'
      + '<div class=sec>PLANNING TOOLS</div><div class=tiles>' + tile((p.feed_planned || 0) + ' <small>/ ' + (p.feed_target || 0) + '</small>', "Feed plan to " + esc(fd(D.settings.plan_end)) + ' · ' + Math.max(0, (p.feed_target || 0) - (p.feed_planned || 0)) + ' to go', p.feed_target ? (p.feed_planned || 0) * 100 / p.feed_target : 0)
      + tile((r.pro_used || 0) + ' <small>/ ' + (r.pro_allowance || 0) + '</small>', "Professional videos used", r.pro_allowance ? (r.pro_used || 0) * 100 / r.pro_allowance : 0) + tile((p.reels || 0) + ' · ' + (p.carousels || 0), "Reels · carousels") + tile((p.chosen_pct || 0) + '%', "Who & how chosen · " + (p.added || 0) + " added", p.chosen_pct || 0) + '</div>'
      + '<div class=sec>HOW FEED POSTS ARE MADE</div><div class=ppl>' + Object.keys(r.how || {}).map(function (h) { return '<div class=pe>' + esc(h) + '<em>' + r.how[h] + ' · ' + esc(D.maker[h] || "") + '</em></div>'; }).join("") + '</div>'
      + '<div class=sec>ON CAMERA THIS MONTH · LIMIT ' + (r.on_camera_limit || 0) + '</div><div class=ppl>' + (ppl.map(function (n) { var lim = oc[n] >= r.on_camera_limit; return '<div class="pe' + (lim ? ' lim' : '') + '"><i>' + esc(n.charAt(0)) + '</i>' + esc(n) + '<em>' + oc[n] + (lim ? ' · limit reached' : '') + '</em></div>'; }).join("") || '<p class=mt>Nobody on camera yet.</p>') + '</div>'
      + '<div class=sec>NIGHT-BEFORE CHECK · ' + esc(fd(add(D.today, 1)).toUpperCase()) + '</div>' + (on(add(D.today, 1)).map(function (i) { return '<div class=qr><input type=checkbox ' + (i.status.step === "Done" ? 'checked disabled ' : '') + 'data-tick="' + esc(i.code) + '" data-step="' + esc(i.status.step) + '" data-on=1><span class=qw>' + esc(i.time || "") + '</span><div data-open="' + esc(i.code) + '">' + esc(typeOf(i)) + ' — ' + esc(nameOf(i)) + '<br><small>Next: ' + esc(i.status.step) + ' · ' + esc(i.status.owner) + '</small></div></div>'; }).join("") || '<p class=mt>Nothing planned tomorrow.</p>')
      + (CFG.admin ? '<div class=sec>SETTINGS</div><div class=set><label>Professional video allowance<input id=st_pv type=number min=0 value="' + D.settings.pro_video_allowance + '"></label><label>On camera, per person per month<input id=st_oc type=number min=0 value="' + D.settings.on_camera_limit + '"></label><label>Best posting window<span><input id=st_bf type=time value="' + D.settings.best_from + '"> to <input id=st_bt type=time value="' + D.settings.best_to + '"></span></label><label>Weak evening window<span><input id=st_ef type=time value="' + D.settings.evening_from + '"> to <input id=st_et type=time value="' + D.settings.evening_to + '"></span></label><label>Story times<input id=st_sx value="' + esc((D.settings.story_times || []).join(", ")) + '"></label><label>Feed posts planned to the end of the plan<input id=st_ft type=number min=0 value="' + D.settings.feed_target + '"></label><button class=bt data-act=settings>Save settings</button></div>' : '');
  }
  function draw() {
    $("conn").innerHTML = D.connected ? '<span class=ok>Content calendar connected</span><button class=bo data-act=import>Import from sheet</button>' : '<span>Not linked to the content calendar yet.</span><a class=bo href="/momo/work/calendar' + CFG.q + '">Connect</a>';
    var as = $("f_as"); if (as && !as.options.length) { as.innerHTML = '<option value="">Viewing as: everyone</option>' + D.team.map(function (p) { return '<option>' + esc(p) + '</option>'; }).join(""); }
    var hw = $("f_how"); if (hw && !hw.options.length) { hw.innerHTML = '<option value="">How it’s made: all</option>' + D.how.map(function (p) { return '<option>' + esc(p) + '</option>'; }).join(""); }
    var wh = $("f_who"); if (wh) { var people = {}; D.items.forEach(function (i) { String(i.who || "").split(",").forEach(function (p) { p = p.trim(); if (p) people[p] = 1; }); }); var cur = wh.value; wh.innerHTML = '<option value="">Who’s in it: all</option>' + Object.keys(people).sort().map(function (p) { return '<option' + (p === cur ? ' selected' : '') + '>' + esc(p) + '</option>'; }).join(""); }
    $("body").innerHTML = !D.items.length ? empty() : V === "day" ? vDay() : V === "week" ? vWeek() : V === "month" ? vMonth() : V === "queue" ? vQueue() : V === "flow" ? vFlow() : vRep();
    if (OPEN) { var it = D.items.filter(function (x) { return x.code === OPEN; })[0]; if (it && $("sheet").classList.contains("open")) panel(it); }
  }
  function sel(id, v, list, blank) { return '<select id="' + id + '">' + (blank ? '<option value="">' + blank + '</option>' : '') + list.map(function (x) { return '<option' + (x === v ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join("") + '</select>'; }
  function panel(it, isNew) {
    OPEN = it.code || null; var oc = (D.report && D.report.on_camera) || {}, lim = D.settings.on_camera_limit, feed = it.kind !== "story";
    var whoOpts = Object.keys(oc).concat(["AI", "Voice-over only", "No person"]);
    var h = '<div class=grab></div><div class=seg><button class="' + (feed ? 'on' : '') + '" data-kind=feed>Feed post</button><button class="' + (!feed ? 'on' : '') + '" data-kind=story>Story</button></div>'
      + '<div class=tag>' + esc(it.code || "NEW") + (it.added ? ' · ADDED OUTSIDE THE PLAN' : '') + '</div>'
      + '<dl class=f><dt>Date</dt><dd><input id=p_date type=date value="' + esc(it.date || DAY) + '"></dd><dt>Time (Dubai)</dt><dd><input id=p_time type=time value="' + esc(it.time || (feed ? "" : (D.settings.story_times || [])[0] || "")) + '"></dd>'
      + (feed ? '<dt>Format</dt><dd>' + sel("p_format", it.format, D.formats, "Choose") + '</dd><dt>Pillar</dt><dd>' + sel("p_pillar", it.pillar, D.pillars, "Choose") + '</dd><dt>Series</dt><dd><input id=p_series value="' + esc(it.series || "") + '" placeholder="Single post"></dd>'
        : '<dt>Story type</dt><dd>' + sel("p_story_type", it.story_type, D.story_types, "Choose") + '</dd>')
      + '<dt>Topic / idea</dt><dd><textarea id=p_topic rows=2>' + esc(it.topic || "") + '</textarea></dd>'
      + (feed ? '<dt>Call to action</dt><dd><input id=p_cta value="' + esc(it.cta || "") + '"></dd><dt>Campaign</dt><dd><input id=p_campaign value="' + esc(it.campaign || "") + '"></dd>' : '')
      + '<dt>Developer / project</dt><dd><input id=p_developer value="' + esc(it.developer || "") + '" placeholder="optional"></dd>'
      + '<dt>Who’s in it</dt><dd><input id=p_who list=whol value="' + esc(it.who || "") + '" placeholder="agent, staff, AI, voice-over only, no person"><datalist id=whol>' + whoOpts.map(function (p) { return '<option value="' + esc(p) + '">' + (oc[p] != null ? esc(p + " · " + oc[p] + " this month" + (oc[p] >= lim ? " · limit reached" : "")) : esc(p)) + '</option>'; }).join("") + '</datalist>'
      + '<div class=hint id=p_whohint></div></dd>'
      + '<dt>How it’s made</dt><dd>' + sel("p_how", it.how, D.how, "Choose") + '</dd></dl>'
      + '<div class=mk id=p_mk></div>';
    if (!isNew) {
      h += (it.qa && it.qa.length ? '<div class=qa>' + it.qa.map(function (x) { return '<div class=qq><span class="pl ' + x[0] + '">' + x[0].toUpperCase() + '</span><div>' + esc(x[1]) + '<br><small>' + esc(x[2]) + '</small></div></div>'; }).join("") + '</div>' : '')
        + (feed ? '<div class=sec>CAPTION CHECKLIST</div><ul class=ck><li>Under 100 characters</li><li>No questions</li><li>1–2 hashtags naming the developer</li><li>Persian or Arabic caption where it fits</li></ul>' : '')
        + '<div class=sec>STEPS</div>' + it.steps.map(function (s) { var dn = it.done && it.done[s] && it.done[s].done, auto = s === "Who & how" && it.who && it.how;
          return '<div class=srow><span class="' + (dn || auto ? 'dn' : (it.status.step === s ? 'cu' : '')) + '">' + esc(s) + '</span><small>' + esc(s === "Made" ? (it.maker || "the maker") : D.owner[s]) + (dn ? ' · ' + esc(it.done[s].by) + ' ' + esc(String(it.done[s].at).slice(5, 16).replace("T", " ")) : auto ? ' · ticks itself' : '') + '</small>' + (window.ckChip ? window.ckChip((it.checkins || []).filter(function (c) { return c.step === s; })[0]) : '') + '<button class=bo data-tick="' + esc(it.code) + '" data-step="' + esc(s) + '" data-on="' + (dn || auto ? 0 : 1) + '">' + (dn || auto ? 'Undo' : 'Done') + '</button>' + (window.ckBtn && !dn && !auto ? window.ckBtn("step|" + it.code + "|" + s, s) : '') + '</div>'; }).join("");
    }
    h += '<div class=row2 id=p_actions><button class=bt data-act=save>' + (isNew ? 'Save' : 'Save') + '</button>' + (isNew ? '' : (D.connected ? '<button class=bo data-act=push>Write to sheet</button>' : '') + '<button class="bo red" data-act=del>Delete</button>' + '') + '<div id=p_status style="grid-column:1/-1"></div></div>'
      + (!isNew && it.log && it.log.length ? '<div class=log><b>Activity</b>' + it.log.slice(0, 30).map(function (l) { return '<div>' + esc(String(l.at).slice(5, 16).replace("T", " ")) + ' · ' + esc(l.who) + ' · ' + esc(l.what) + '</div>'; }).join("") + '</div>' : '');
    $("sheet").innerHTML = h; $("sheet").classList.add("open"); $("scrim").classList.add("open"); $("sheet").dataset.kind = feed ? "feed" : "story"; $("sheet").dataset.code = it.code || "";
    var mk = function () { var how = ($("p_how") || {}).value, m = D.maker[how] || "", tr = "", d = $("p_date").value, f = ($("p_format") || {}).value, w = ($("p_who").value || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean);
      if (f === "Reel" && d) tr = ' · Trial Reel <b>' + esc(fd(add(d, -Math.round((D.settings.trial_hours || 72) / 24)))) + ' ' + esc($("p_time").value || "") + '</b> · Live <b>' + esc(fd(d)) + ' ' + esc($("p_time").value || "") + '</b>';
      $("p_mk").innerHTML = m ? '<b>Made by ' + esc(m) + '</b>' + (how === "Professional video" ? ' · professional video ' + ((D.report || {}).pro_used || 0) + ' of ' + D.settings.pro_video_allowance + ' used' : how === "In-house video (office)" ? ' · assigned by Vishant' : '') + tr : (tr ? 'Choose how it’s made to set the maker' + tr : 'Choose how it’s made to set the maker');
      $("p_whohint").innerHTML = w.map(function (p) { return oc[p] != null && oc[p] >= lim && it.who !== p ? '<span class=lr>' + esc(p) + ': limit reached this month</span>' : ''; }).join(" "); };
    ["p_how", "p_date", "p_time", "p_format", "p_who"].forEach(function (id) { var e = $(id); if (e) e.oninput = mk; }); mk();
  }
  function collect() { var g = function (id) { var e = $(id); return e ? e.value : undefined; }; return { action: "save", code: $("sheet").dataset.code || "", kind: $("sheet").dataset.kind, date: g("p_date"), time: g("p_time"), format: g("p_format"), story_type: g("p_story_type"), pillar: g("p_pillar"), series: g("p_series"), topic: g("p_topic"), cta: g("p_cta"), campaign: g("p_campaign"), developer: g("p_developer"), who: g("p_who"), how: g("p_how") }; }
  function closeP() { $("sheet").classList.remove("open"); $("scrim").classList.remove("open"); OPEN = null; }

  // v774h - before any cell in her workbook is rewritten: "You changed A, B and C. Rewrite these cells in the workbook?" Yes / No
  var FLD = { date: "Date", time: "Time", format: "Format", story_type: "Story type", pillar: "Pillar", series: "Series", topic: "Topic", cta: "Call to action", campaign: "Campaign", developer: "Developer / project", who: "Who's in it", how: "How it's made" };
  function writeAsk(code, afterSave) {
    api({ action: "push", code: code }).then(function (j) {
      if (!j.ok) { toast((afterSave ? "✓ Saved " + code + " in Momo. " : "") + (j.error || "Could not read the sheet"), true); return; }
      if (!j.changes || !j.changes.length) { toast(afterSave ? "✓ Saved " + code + " · the workbook already matches" : "The workbook already matches."); return; }
      var w = document.createElement("div"); w.id = "askw";
      w.setAttribute("style", "position:fixed;inset:0;z-index:80;background:rgba(28,40,38,.45);display:flex;align-items:flex-end;justify-content:center");
      var rows = j.changes.map(function (c) { return '<div style="border-top:1px solid #EFE9DE;padding:9px 0"><b style="font:600 .82rem IBM Plex Sans,sans-serif;color:#0A4F4A">' + esc(FLD[c.field] || c.field) + '</b> <span style="font:500 .72rem IBM Plex Mono,monospace;color:#8A6F3E">cell ' + esc(c.cell) + '</span><div style="font:500 .86rem IBM Plex Sans,sans-serif;color:#5F6B66;margin-top:3px"><s>' + esc(c.old || "empty") + '</s> &rarr; <b style="color:#1C2826">' + esc(c["new"] || "empty") + '</b></div></div>'; }).join("");
      w.innerHTML = '<div style="background:#FFFDF9;border-radius:20px 20px 0 0;max-width:560px;width:100%;padding:18px 18px 22px;box-shadow:0 -8px 30px rgba(0,0,0,.15);max-height:80vh;overflow:auto">'
        + '<div style="font:600 1.1rem Fraunces,serif;color:#0A4F4A;margin-bottom:4px">Update the workbook?</div>'
        + '<div style="font:500 .88rem IBM Plex Sans,sans-serif;color:#1C2826;margin-bottom:6px">You changed ' + j.changes.length + (j.changes.length === 1 ? ' thing' : ' things') + ' on ' + esc(code) + '. Rewrite ' + (j.changes.length === 1 ? 'this cell' : 'these cells') + ' in “' + esc(j.tab) + '”?</div>' + rows
        + '<div style="font:500 .76rem IBM Plex Sans,sans-serif;color:#5F6B66;margin:10px 0 14px">Each change is also added to the Change log tab.</div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><button type=button id=askw_no style="border:1px solid #0A4F4A;background:#fff;color:#0A4F4A;border-radius:999px;padding:12px;font:600 .92rem IBM Plex Sans,sans-serif">No, keep it in Momo</button>'
        + '<button type=button id=askw_yes style="border:0;background:#0A4F4A;color:#fff;border-radius:999px;padding:12px;font:600 .92rem IBM Plex Sans,sans-serif">Yes, update</button></div></div>';
      document.body.appendChild(w);
      var done = function () { if (w.parentNode) w.parentNode.removeChild(w); };
      document.getElementById("askw_no").onclick = function () { done(); toast(afterSave ? "✓ Saved " + code + " in Momo only. The workbook is unchanged." : "The workbook is unchanged."); };
      document.getElementById("askw_yes").onclick = function () { var b = this; b.disabled = true; b.textContent = "Writing…";
        api({ action: "push", code: code, apply: true, why: "Changed in Momo" }).then(function (k) { done(); if (k.ok) toast("✓ " + k.written + " cell(s) updated in the workbook"); else toast(k.error || "Not written", true); load(true); })
          .catch(function () { done(); toast("Not reached. Try Write to sheet again.", true); }); };
    }).catch(function () { toast("Could not reach the workbook. Try Write to sheet.", true); });
  }
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-tick],[data-open],[data-add],[data-act],[data-day],[data-month],[data-goday],[data-v],[data-kind],[data-rf]"); if (!t) return;
    if (t.dataset.v) { V = t.dataset.v; document.querySelectorAll("#tabs button").forEach(function (b) { b.classList.toggle("on", b === t); }); draw(); return; }
    if (t.dataset.tick) { e.stopPropagation(); t.disabled = true; api({ action: "tick", code: t.dataset.tick, step: t.dataset.step, done: t.dataset.on === "1" }).then(function (j) { if (!j.ok) { toast(j.error || "Not saved", true); t.disabled = false; return; } toast("✓ " + t.dataset.step + (t.dataset.on === "1" ? " done" : " undone")); load(true); }).catch(function () { toast("No connection: not saved", true); t.disabled = false; }); return; }
    if (t.dataset.kind && t.id !== "sheet") { $("sheet").dataset.kind = t.dataset.kind; var cur = collect(); cur.kind = t.dataset.kind; var base = D.items.filter(function (x) { return x.code === cur.code; })[0] || {}; panel(Object.assign({}, base, cur, { steps: base.steps || [], status: base.status || {} }), !cur.code); return; }
    if (t.dataset.open && !e.target.closest("[data-tick]")) { var it = D.items.filter(function (x) { return x.code === t.dataset.open; })[0]; if (it) panel(it); return; }
    if (t.dataset.add) { panel({ kind: t.dataset.add, date: DAY, time: t.dataset.add === "story" ? (D.settings.story_times || [])[0] : "" }, true); return; }
    if (t.dataset.day) { DAY = add(DAY, +t.dataset.day); draw(); return; }
    if (t.dataset.month) { var m = new Date(DAY.slice(0, 8) + "01T00:00:00Z"); m.setUTCMonth(m.getUTCMonth() + +t.dataset.month); DAY = m.toISOString().slice(0, 10); draw(); return; }
    if (t.dataset.goday) { if (e.target.closest("[data-open]")) return; DAY = t.dataset.goday; V = "day"; document.querySelectorAll("#tabs button").forEach(function (b) { b.classList.toggle("on", b.dataset.v === "day"); }); draw(); return; }
    if (t.dataset.rf) { RF = t.dataset.rf; fetch(CFG.base + "/data" + CFG.q + "&range=" + RF + "&day=" + DAY).then(function (r) { return r.json(); }).then(function (j) { if (j.ok) { D.report = j.report; draw(); } }); return; }
    var a = t.dataset.act;
    if (a === "save") { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); var b = collect(); t.disabled = true; var ps = $("p_status"); if (ps) ps.textContent = "Saving…"; api(b).then(function (j) { t.disabled = false; if (!j.ok) { if (ps) ps.textContent = "Not saved: " + (j.error || "please check the fields"); toast(j.error || "Not saved", true); return; } if (ps) ps.textContent = "Saved"; var cd = j.item.code; closeP(); load(true); if (!D.connected) { toast("✓ Saved " + cd); return; } writeAsk(cd, true); }); }
    if (a === "del") { if (!confirm("Delete this item from the planner?")) return; api({ action: "delete", code: $("sheet").dataset.code }).then(function (j) { if (j.ok) { toast("✓ Deleted"); closeP(); load(true); } else toast(j.error || "Not deleted", true); }); }
    if (a === "settings") { var sx = ($("st_sx").value || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean);
      api({ action: "settings", settings: { pro_video_allowance: $("st_pv").value, on_camera_limit: $("st_oc").value, best_from: $("st_bf").value, best_to: $("st_bt").value, evening_from: $("st_ef").value, evening_to: $("st_et").value, story_times: sx, feed_target: $("st_ft").value } }).then(function (j) { if (j.ok) { toast("✓ Settings saved"); load(true); } else toast(j.error || "Not saved", true); }); }
    if (a === "print") window.print();
    if (a === "import") { t.disabled = true; toast("Reading the content calendar…"); api({ action: "import" }).then(function (j) { t.disabled = false; if (!j.ok) { toast(j.error === "not_connected" ? "Connect the content calendar first." : (j.error || "Could not read the sheet"), true); return; }
      var p = j.preview; if (!confirm("Import from the sheet?\n\n" + p.feed + " feed posts (" + (p.tabs.feed || "no Feed tab") + ")\n" + p.stories + " stories (" + (p.tabs.stories || "no Stories tab") + ")\n\nColumns found: " + Object.keys(p.columns).map(function (k) { return k + ": " + p.columns[k].join(", "); }).join(" | ") + "\n\nNothing is written to the sheet.")) return;
      api({ action: "import", apply: true }).then(function (k) { if (k.ok) { toast("✓ Imported: " + k.created + " new, " + k.updated + " updated"); load(true); } else toast(k.error || "Import failed", true); }); }); }
    if (a === "push") { writeAsk($("sheet").dataset.code, false); }
  });
  document.addEventListener("dragstart", function (e) { var t = e.target.closest("[data-drag]"); if (t) e.dataTransfer.setData("text/plain", t.dataset.drag); });
  document.addEventListener("dragover", function (e) { if (e.target.closest(".wc")) e.preventDefault(); });
  document.addEventListener("drop", function (e) { var c = e.target.closest(".wc"); if (!c) return; e.preventDefault(); var code = e.dataTransfer.getData("text/plain"), it = D.items.filter(function (x) { return x.code === code; })[0]; if (!it || it.date === c.dataset.goday) return;
    if (!confirm("Move “" + (it.topic || code) + "” to " + fd(c.dataset.goday) + "?")) return; api({ action: "save", code: code, date: c.dataset.goday }).then(function (j) { if (j.ok) { toast("✓ Moved to " + fd(c.dataset.goday)); load(true); } else toast(j.error || "Not moved", true); }); });
  $("scrim").onclick = closeP;
  ["f_show", "f_as", "f_how", "f_who"].forEach(function (id) { $(id).onchange = function () { SHOW = $("f_show").value; AS = $("f_as").value; HOWF = $("f_how").value; WHOF = $("f_who").value; draw(); }; });
  load(); POLL = setInterval(function () { if (!$("sheet").classList.contains("open") && !document.hidden) load(true); }, 30000);   // another person's tick shows within a minute
}

const CSS = ':root{--cr:#FAF7F1;--cd:#FFFDF9;--ln:#E7E1D6;--ink:#1C2321;--mu:#5F6B66;--te:#0A4F4A;--go:#C5A56A;--g2:#8A6F3E;--gr:#2F7D5B}'
  + '.cp *{box-sizing:border-box}.cp .tabs{display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;scrollbar-width:none}.cp .tabs button{flex:0 0 auto;border:1px solid var(--ln);background:#fff;border-radius:999px;padding:7px 12px;font:600 .8rem "IBM Plex Sans",sans-serif;color:var(--mu);cursor:pointer}.cp .tabs button.on{background:var(--te);color:#fff;border-color:var(--te)}'
  + '.cp .filt{display:flex;gap:6px;overflow-x:auto;padding:4px 0 6px;scrollbar-width:none}.cp .filt select{flex:0 0 auto;font:500 .74rem "IBM Plex Sans",sans-serif;border:1px dashed var(--go);color:var(--g2);border-radius:8px;padding:5px 6px;background:#fff;max-width:200px}'
  + '.cp #conn{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:.78rem;color:var(--mu);background:var(--cd);border:1px solid var(--ln);border-radius:12px;padding:8px 10px;margin:4px 0 8px}.cp #conn .ok{color:var(--gr);font-weight:600}'
  + '.cp .db{display:flex;align-items:center;justify-content:space-between;margin:6px 0 10px;gap:8px}.cp .db b{font-family:Fraunces,serif;font-size:1.05rem;color:var(--te)}.cp .ar{border:1px solid var(--ln);background:#fff;border-radius:50%;width:34px;height:34px;cursor:pointer;color:var(--te);font-size:1.1rem}'
  + '.cp .sec{font:600 .66rem "IBM Plex Mono",monospace;letter-spacing:.14em;color:var(--g2);margin:14px 0 6px;display:flex;justify-content:space-between;align-items:center}.cp .ad{font:600 .74rem "IBM Plex Sans",sans-serif;color:var(--te);background:none;border:1px solid var(--te);border-radius:999px;padding:3px 10px;cursor:pointer;letter-spacing:0}'
  + '.cp .c{background:var(--cd);border:1px solid var(--ln);border-radius:14px;padding:11px 12px;margin:0 0 8px;cursor:pointer}.cp .c .h{display:flex;gap:8px;align-items:baseline}.cp .c .t{font:600 .76rem "IBM Plex Mono",monospace;color:var(--te)}.cp .c .k{font-size:.76rem;color:var(--mu)}.cp .c .n{font-weight:600;margin:3px 0 2px;font-size:.95rem;overflow-wrap:anywhere}.cp .c .nx{font-size:.8rem;color:var(--mu)}.cp .c .nx b{color:var(--ink)}'
  + '.cp .stp{display:flex;gap:4px;flex-wrap:wrap;margin-top:8px}.cp .stp button{font:500 .68rem "IBM Plex Sans",sans-serif;border:1px solid #DDD6C8;background:#F3EFE7;color:#8B918E;border-radius:999px;padding:4px 8px;cursor:pointer}.cp .stp button.cur{background:#fff;border:1.5px solid var(--ink);color:var(--ink);font-weight:600}.cp .stp button.done{background:var(--gr);border-color:var(--gr);color:#fff}'
  + '.cp .mt{color:var(--mu);font-size:.84rem;font-style:italic;margin:4px 0}.cp .emp{text-align:center;border:1px dashed var(--go);border-radius:18px;padding:26px 16px;color:var(--mu)}.cp .emp p{margin:4px 0}.cp .row2{display:flex;gap:8px;justify-content:center;margin-top:12px;flex-wrap:wrap}'
  + '.cp .bt{display:inline-block;background:var(--te);color:#fff;border:0;border-radius:999px;padding:10px 16px;font:600 .88rem "IBM Plex Sans",sans-serif;text-decoration:none;cursor:pointer}.cp .bo{display:inline-block;background:#fff;color:var(--te);border:1px solid var(--te);border-radius:999px;padding:7px 12px;font:600 .8rem "IBM Plex Sans",sans-serif;text-decoration:none;cursor:pointer}.cp .bo.red{color:#B4533C;border-color:#B4533C}'
  + '.cp .wk{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:3px}.cp .wc{background:#fff;border:1px solid var(--ln);border-radius:10px;padding:4px 3px;min-height:300px;min-width:0}.cp .wc.td{border-color:var(--te)}.cp .wc b{display:block;font:600 .6rem "IBM Plex Mono",monospace;color:var(--te);text-align:center;margin-bottom:4px}'
  + '.cp .wp{background:var(--te);color:#fff;border-radius:6px;padding:4px;font-size:.56rem;line-height:1.2;margin-bottom:4px;overflow-wrap:anywhere;cursor:grab}.cp .wp.tr{background:#fff;color:var(--te);border:1px dashed var(--te)}.cp .ws{font-size:.54rem;color:var(--mu);border-top:1px solid #F0EBE1;padding:2px 0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}'
  + '.cp .mo{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}.cp .dw{font:600 .6rem "IBM Plex Mono",monospace;color:var(--mu);text-align:center}.cp .md{background:#fff;border:1px solid var(--ln);border-radius:8px;min-height:52px;padding:4px;font-size:.66rem;cursor:pointer;display:flex;flex-direction:column;justify-content:space-between}.cp .md.oth{opacity:.4}.cp .md.td{border:2px solid var(--te)}.cp .md span{font-weight:600}'
  + '.cp .dots{display:flex;gap:2px;flex-wrap:wrap}.cp .dots i,.cp .lg i{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--te)}.cp .dots i.s,.cp .lg i.s{background:var(--go)}.cp .dots i.t,.cp .lg i.t{background:#fff;border:1px solid var(--te)}.cp .lg{display:flex;gap:12px;font-size:.72rem;color:var(--mu);margin:0 0 8px}.cp .lg i{margin-right:4px}'
  + '.cp .qr{display:flex;gap:10px;align-items:flex-start;border-bottom:1px solid var(--ln);padding:9px 0;font-size:.84rem;cursor:pointer}.cp .qr small{color:var(--mu)}.cp .qw{font:600 .7rem "IBM Plex Mono",monospace;color:var(--te);flex:0 0 58px}.cp .qr input{margin-top:3px;width:18px;height:18px;accent-color:var(--gr)}'
  + '.cp .wf{display:flex;gap:8px;overflow-x:auto;padding-bottom:8px}.cp .fc{flex:0 0 210px;background:#fff;border:1px solid var(--ln);border-radius:12px;padding:8px}.cp .fc h4{margin:0;font-family:Fraunces,serif;color:var(--te);font-size:.95rem;display:flex;justify-content:space-between}.cp .fc h4 span{font:600 .7rem "IBM Plex Mono",monospace;color:var(--g2)}.cp .ra{font-size:.68rem;color:var(--mu);margin:2px 0 8px}.cp .mi{border:1px solid #EFE9DE;border-radius:10px;padding:7px;margin-bottom:6px;font-size:.76rem;background:var(--cd);cursor:pointer}'
  + '.cp .tiles{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px}.cp .tl{background:#fff;border:1px solid var(--ln);border-radius:12px;padding:10px;min-width:0}.cp .tl .v{font-family:Fraunces,serif;font-size:1.45rem;color:var(--te)}.cp .tl .v small{font-size:.85rem;color:var(--mu)}.cp .tl .l{font-size:.74rem;color:var(--mu)}.cp .bar{height:7px;background:#EFE9DE;border-radius:99px;overflow:hidden;margin-top:6px}.cp .bar i{display:block;height:100%;background:var(--te)}'
  + '.cp .qa{border:1px solid var(--ln);background:#fff;border-radius:12px;padding:6px 10px;margin:8px 0;font-size:.8rem}.cp .qq{display:flex;gap:8px;padding:6px 0;border-top:1px solid #F0EBE1;cursor:pointer}.cp .qq:first-child{border-top:0}.cp .qq small{color:var(--mu)}'
  + '.cp .pl{font:600 .6rem "IBM Plex Mono",monospace;border-radius:999px;padding:2px 8px;flex:0 0 auto;height:fit-content}.cp .pl.fix{background:#F6E1DA;color:#9A3F2A}.cp .pl.check{background:#F5ECD9;color:var(--g2)}.cp .pl.note{background:#EEF0EE;color:var(--mu)}.cp .pl.clear{background:#DDEFE6;color:var(--gr)}'
  + '.cp .ppl{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:6px}.cp .pe{display:flex;align-items:center;gap:6px;background:#fff;border:1px solid var(--ln);border-radius:10px;padding:6px 8px;font-size:.76rem;min-width:0}.cp .pe i{flex:0 0 24px;width:24px;height:24px;border-radius:50%;background:var(--te);color:#fff;font:600 .62rem "IBM Plex Sans",sans-serif;font-style:normal;display:flex;align-items:center;justify-content:center}.cp .pe em{margin-left:auto;font-style:normal;font-size:.66rem;color:var(--mu);text-align:right}.cp .pe.lim{opacity:.6}.cp .pe.lim em{color:#9A3F2A}'
  + '.cp .seg2{display:flex;gap:6px;margin:4px 0}.cp .seg2 button{border:1px solid var(--ln);background:#fff;border-radius:999px;padding:6px 12px;font:600 .76rem "IBM Plex Sans",sans-serif;color:var(--mu);cursor:pointer}.cp .seg2 button.on{background:var(--go);color:#fff;border-color:var(--go)}'
  + '.cp .set{display:flex;flex-direction:column;gap:8px;background:#fff;border:1px solid var(--ln);border-radius:12px;padding:10px;font-size:.8rem}.cp .set label{display:flex;flex-direction:column;gap:4px;color:var(--mu)}.cp .set input{font:inherit;font-size:16px;border:1px solid var(--ln);border-radius:8px;padding:6px}'
  + '#scrim{position:fixed;inset:0;background:rgba(0,0,0,.25);opacity:0;pointer-events:none;transition:opacity .2s;z-index:60}#scrim.open{opacity:1;pointer-events:auto}'
  + '#sheet{position:fixed;left:0;right:0;bottom:0;max-height:85vh;max-height:85dvh;max-width:560px;margin:0 auto;background:#fff;border-radius:22px 22px 0 0;box-shadow:0 -10px 30px rgba(0,0,0,.2);transform:translateY(105%);visibility:hidden;transition:transform .22s,visibility 0s .22s;overflow-y:auto;padding:12px 16px 28px;z-index:61}#sheet.open{transform:translateY(0);visibility:visible;transition:transform .22s}'
  + '#p_actions{position:sticky;bottom:0;background:#fff;padding:10px 0 calc(14px + env(safe-area-inset-bottom));margin-top:8px;box-shadow:0 -8px 12px -8px rgba(0,0,0,.12);z-index:2}#p_actions .bt{min-height:48px;font-size:1rem}#p_status{font:500 .82rem IBM Plex Sans,sans-serif;color:#5F6B66;min-height:1.1em;margin-top:6px;text-align:center}#sheet .grab{width:40px;height:4px;border-radius:9px;background:#DDD6C8;margin:0 auto 10px}#sheet .seg{display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--te);border-radius:999px;overflow:hidden;margin-bottom:10px}#sheet .seg button{border:0;background:#fff;padding:8px;font:600 .8rem "IBM Plex Sans",sans-serif;color:var(--te);cursor:pointer}#sheet .seg button.on{background:var(--te);color:#fff}'
  + '#sheet .f{display:grid;grid-template-columns:104px minmax(0,1fr);gap:8px 10px;font-size:.82rem;margin:8px 0;align-items:center}#sheet .f dt{color:var(--mu)}#sheet .f dd{margin:0}#sheet .f input,#sheet .f select,#sheet .f textarea{font:inherit;font-size:16px;border:1px solid var(--ln);border-radius:8px;padding:6px;width:100%;background:var(--cr)}'
  + '#sheet .mk{background:var(--cr);border-left:3px solid var(--go);padding:8px 10px;font-size:.82rem;border-radius:6px;margin:8px 0}#sheet .hint .lr{color:#9A3F2A;font-size:.74rem}#sheet .ck{font-size:.8rem;margin:0;padding-left:18px;color:var(--mu)}'
  + '#sheet .srow{display:flex;align-items:center;gap:8px;padding:6px 0;border-top:1px solid #F0EBE1;font-size:.84rem}#sheet .srow span{flex:0 0 92px;font-weight:600;color:#8B918E}#sheet .srow span.dn{color:var(--gr)}#sheet .srow span.cu{color:var(--ink)}#sheet .srow small{flex:1;color:var(--mu);min-width:0}#sheet .tag{font:600 .64rem "IBM Plex Mono",monospace;letter-spacing:.14em;color:var(--g2)}'
  + '#sheet .log{font-size:.72rem;color:var(--mu);border-top:1px solid var(--ln);margin-top:12px;padding-top:8px}#sheet .log div{padding:2px 0}'
  + '.toast{position:fixed;left:50%;bottom:84px;transform:translateX(-50%) translateY(20px);background:var(--te);color:#fff;border-radius:999px;padding:9px 14px;font-size:.84rem;opacity:0;transition:all .2s;z-index:70;max-width:90vw;text-align:center}.toast.on{opacity:1;transform:translateX(-50%) translateY(0)}.toast.bad{background:#9A3F2A}'
  + '@media print{#tabs,.filt,#conn,.ar,.seg2,.bo,.bt,.set,nav{display:none!important}}';

export function plannerBody(key, rk, admin) {
  const q = "?key=" + encodeURIComponent(key) + (rk ? "&rk=" + encodeURIComponent(rk) : "");
  const CFG = { base: "/momo/work/planner", q, admin: !!admin };
  return '<a class=back href="/momo/work' + q + '">&#8592; Work</a><div class=cp><div class=tag>MOMO · WORK</div><h1>Content planner</h1><div id=conn></div>'
    + '<div class=tabs id=tabs><button class=on data-v=day>Day</button><button data-v=week>Week</button><button data-v=month>Month</button><button data-v=queue>Queue</button><button data-v=flow>Workflow</button><button data-v=rep>Reports</button></div>'
    + '<div class=filt><select id=f_as></select><select id=f_show><option value=all>Show: feed + stories</option><option value=feed>Show: feed</option><option value=stories>Show: stories</option></select><select id=f_how></select><select id=f_who></select></div>'
    + '<div id=body><p class=mt>Loading the plan…</p></div><div id=scrim></div><div id=sheet></div><div id=toast class=toast></div></div>'
    + '<style>' + CSS + '</style><script src="/momo/checkin.js"></script><script>var __name=function(f){return f};(' + client.toString() + ')(' + JSON.stringify(CFG).replace(/</g, "\\u003c") + ')</script>';
}

const WHO = { najjuko: "Najjuko", kendall: "Kendall" };
function rangeFor(r, day, S) {
  if (r === "day") return [day, day];
  if (r === "month") { const end = new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7), 0)).toISOString().slice(0, 10); return [day.slice(0, 8) + "01", end]; }
  const w = dowOf(day), m = addDays(day, w === 0 ? -6 : 1 - w); return [m, addDays(m, 6)];
}
export async function plannerData(env, url) {
  const S = await readSettings(env), today = dubaiToday(), items = await readItems(env);
  const day = okDate(url.searchParams.get("day")) ? url.searchParams.get("day") : today, r = url.searchParams.get("range") || "week";
  const [from, to] = okDate(url.searchParams.get("from")) && okDate(url.searchParams.get("to")) ? [url.searchParams.get("from"), url.searchParams.get("to")] : rangeFor(r, day, S);
  const tok = await env.MEETINGS.get("gsheet_token"), cfg = await env.MEETINGS.get("cc_cfg");
  return { ok: true, today, settings: S, connected: !!(tok && cfg), items: items.map((i) => derive(i, S, today)), report: report(items, S, from, to, today),
    team: TEAM, how: HOW, maker: MAKER, owner: OWNER, acc: ACCOUNTABLE, formats: FORMATS, story_types: STORY_TYPES, pillars: PILLARS };
}

export async function plannerRoute(request, env, url, deps) {
  const p = url.pathname; if (!p.startsWith("/momo/work/planner")) return null;
  const person = deps.person(env, url); if (!WHO[person]) return new Response("not found", { status: 404 });
  const key = url.searchParams.get("key") || "", rk = url.searchParams.get("rk") || "";
  if (p === "/momo/work/planner" && request.method === "GET")
    return new Response(deps.page(key, rk, plannerBody(key, rk, true)), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  if (p === "/momo/work/planner/data" && request.method === "GET") return J(await plannerData(env, url));
  if (p === "/momo/work/planner/api" && request.method === "POST") {
    let b = {}; try { b = await request.json(); } catch (e) {}
    if (b.action === "import") { const [s, o] = await sheetImport(env, !!b.apply, WHO[person]); return J(Object.assign({ ok: s < 300 }, o), s); }
    if (b.action === "push") { const [s, o] = await sheetPush(env, String(b.code || "").toUpperCase(), !!b.apply, WHO[person], b.why); return J(Object.assign({ ok: s < 300 }, o), s); }
    const [s, o] = await applyAction(env, b, WHO[person]); return J(Object.assign({ ok: s < 300 }, o), s);
  }
  return new Response("not found", { status: 404 });
}

// ---------- bridge (Claude through the Momo bridge: Bearer key, Idempotency-Key on writes; see src/work_bridge.js) ----------
export async function plannerBridgeGet(env, url, route) {
  const S = await readSettings(env), today = dubaiToday(), items = await readItems(env);
  if (route === "planner/items") {
    const from = url.searchParams.get("from") || "0000-00-00", to = url.searchParams.get("to") || "9999-12-31", who = url.searchParams.get("person") || "", step = url.searchParams.get("step") || "";
    const out = items.filter((i) => !okDate(i.date) || (i.date >= from && i.date <= to)).map((i) => derive(i, S, today)).filter((i) => (!who || i.status.owner === who || i.maker === who) && (!step || i.status.step === step));
    return { ok: true, data: out.map((i) => { const x = Object.assign({}, i); x.log = (i.log || []).slice(0, 10); return x; }) };
  }
  if (route === "planner/report") {
    const day = okDate(url.searchParams.get("day")) ? url.searchParams.get("day") : today;
    const [from, to] = okDate(url.searchParams.get("from")) && okDate(url.searchParams.get("to")) ? [url.searchParams.get("from"), url.searchParams.get("to")] : rangeFor(url.searchParams.get("range") || "week", day, S);
    return { ok: true, data: report(items, S, from, to, today) };
  }
  return null;
}
export async function plannerBridgePost(env, b, person, route) {
  const who = (WHO[person] || person) + " (via Claude)";
  if (route === "post:planner/item") { const [s, o] = await applyAction(env, Object.assign({}, b, { action: "save" }), who); return [s, s < 300 ? { ok: true, data: o.item } : { ok: false, code: "bad_request", error: o.error }]; }
  if (route === "post:planner/tick") { const [s, o] = await applyAction(env, Object.assign({}, b, { action: "tick" }), person === "najjuko" ? "Najjuko" : who); return [s, s < 300 ? { ok: true, data: o.item } : { ok: false, code: s === 403 ? "forbidden" : "bad_request", error: o.error }]; }
  return null;
}
