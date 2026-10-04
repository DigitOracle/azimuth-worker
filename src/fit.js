// v328 FIT - a food and exercise log for the two people who use Azimuth (Kendall, Najjuko). OWNER ONLY.
//
// What it is: say what you ate or did on WhatsApp (text, voice note, or a photo of the plate) and it is logged; open FIT in
// the bottom bar to see the day, the week and the 30-day challenge. No calories, no macros - the point is whether you
// stuck to the plan, and the plan is four numbers you set: a 30-day window (extendable), a weekly exercise target,
// a daily floor (a workout of N minutes, or STEPS_FLOOR steps - so there is always an option), and the eating windows.
//
// Rules this file keeps:
//  - PHOTOS ARE NEVER STORED. A meal photo is read once and the bytes are dropped; only the one-line description is kept.
//  - OWNER ONLY. /fit and /fit_api answer 404 to anything but READ_KEY (keyTier "admin") - a client link never sees them,
//    and the FIT tab is stripped from client pages by OWNER_LINK_RE in index.js. Health data does not go on a demo link.
//  - ONE INSTANCE = ONE PERSON. Kendall's data lives in meeting-capture's KV, Najjuko's in azimuth-2's, exactly like her tasks.
//  - NO KEY EVER GOES INTO A WHATSAPP MESSAGE. Replies are plain text; the page is opened from the bottom bar.
//  - THE EVENING VERDICT USES NO TEMPLATE. Outside the 24-hour window it simply waits (the page still shows it).
//
// Storage (KV namespace MEETINGS): fit_<date>_<ms>_<rand> = one entry, with the entry repeated as KV metadata so a range
// is read with list() alone, no per-entry get. fitc_* = config, flags, one-turn pending answers.
// Entry: { id, d: "YYYY-MM-DD" (GST), t: ms, k: "food"|"ex", x: text, m: minutes, n: steps, o: 1 if outside the eating windows, s: source }

import { FIT_IMG } from "./fit_img.js";   // the page photos, bundled (scripts/gen_fit_img.mjs; Pexels licence, assets/fit/CREDITS.md)

const GST_MS = 4 * 3600 * 1000, DAY_MS = 86400000;
export const gstDate = (ms) => new Date(ms + GST_MS).toISOString().slice(0, 10);
export const gstHM = (ms) => new Date(ms + GST_MS).toISOString().slice(11, 16);
const DATE_RX = /^\d{4}-\d\d-\d\d$/, HM_RX = /^([01]\d|2[0-3]):[0-5]\d$/, ID_RX = /^\d{4}-\d\d-\d\d_\d{10,14}_[a-z0-9]{4,10}$/;
export const addDays = (d, n) => new Date(Date.parse(d + "T00:00:00Z") + n * DAY_MS).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / DAY_MS);
export const weekStart = (d) => addDays(d, -((new Date(d + "T00:00:00Z").getUTCDay() + 6) % 7));   // Monday
const rnd = () => Math.random().toString(36).slice(2, 8).padEnd(6, "0");
const clip = (s, n) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, n);

export function fmtMin(m) {
  m = Math.max(0, Math.round(Number(m) || 0));
  if (m < 60) return m + " min";
  const h = Math.floor(m / 60), r = m % 60;
  return r ? h + "h" + String(r).padStart(2, "0") : h + "h";
}
const fmtSteps = (n) => Number(n || 0).toLocaleString("en-US");

// ---- config: the plan -------------------------------------------------------------------------------------------------
export const FIT_CFG_DEFAULT = {
  goal: "",             // the end goal, in his/her own words
  start: "",            // first day of the challenge (set on the first log, or by hand)
  days: 30,             // challenge length; EXTEND adds 30
  weekMin: 600,         // the carry-over weekly target in minutes (10 hours): a week uses its own Sunday-set target, else this
  minDay: 30,           // a workout counts toward the daily floor when the day's total reaches this
  stepsFloor: 10000,    // ...or the day's steps reach this: the "no excuse" option
  tone: "firm",         // kind | firm | brutal - how the verdict talks
  windows: [{ n: "Breakfast", a: "06:00", b: "09:00" }, { n: "Lunch", a: "11:00", b: "14:00" }, { n: "Evening", a: "17:00", b: "21:00" }]   // eating windows (GST)
};
const intIn = (v, lo, hi, dflt) => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= lo && n <= hi ? n : dflt; };
export function fitCleanCfg(inp, base) {
  const b = Object.assign({}, FIT_CFG_DEFAULT, base || {});
  const c = inp && typeof inp === "object" ? inp : {};
  const out = Object.assign({}, b);
  if ("goal" in c) out.goal = clip(c.goal, 200);
  if ("start" in c) out.start = c.start === "" ? "" : (DATE_RX.test(String(c.start)) ? String(c.start) : b.start);
  if ("days" in c) out.days = intIn(c.days, 1, 365, b.days);
  if ("weekMin" in c) out.weekMin = intIn(c.weekMin, 0, 6000, b.weekMin);
  if ("minDay" in c) out.minDay = intIn(c.minDay, 5, 600, b.minDay);
  if ("stepsFloor" in c) out.stepsFloor = intIn(c.stepsFloor, 0, 100000, b.stepsFloor);
  if ("tone" in c) out.tone = ["kind", "firm", "brutal"].includes(c.tone) ? c.tone : b.tone;
  if ("windows" in c && Array.isArray(c.windows)) {
    out.windows = c.windows.slice(0, 6).map((w) => ({ n: clip(w && w.n, 20), a: String((w && w.a) || ""), b: String((w && w.b) || "") }))
      .filter((w) => w.n && HM_RX.test(w.a) && HM_RX.test(w.b) && w.a < w.b);
  }
  return out;
}
// ---- who: one instance can serve more than one person -----------------------------------------------------------------
// FIT_USERS = "kendall:971562276093,najjuko:971565484397" (id : WhatsApp number). Every entry, setting, target and flag is keyed by the
// person, so two people on one instance never mix. Unset = one person ("me", reached on WA_ALLOWED): exactly the single-user behaviour.
export function fitUsers(env) {
  const out = [];
  for (const part of String((env && env.FIT_USERS) || "").split(",")) {
    const m = /^\s*([a-z0-9]{1,12})\s*:\s*(\d{8,15})?\s*$/i.exec(part);
    if (m && !out.some((u) => u.id === m[1].toLowerCase())) out.push({ id: m[1].toLowerCase(), wa: m[2] || "" });
  }
  if (!out.length) out.push({ id: "me", wa: String((env && env.WA_ALLOWED) || "").replace(/\D/g, "") });
  return out;
}
const pickUser = (env, u) => { const us = fitUsers(env); return us.some((x) => x.id === u) ? u : us[0].id; };   // an unknown name falls back to the first person, never to a new keyspace
const uOf = (env, cfg) => pickUser(env, cfg && cfg.u);
export const fitUserFor = (env, from) => { const d = String(from || "").replace(/\D/g, ""), us = fitUsers(env); return (us.find((x) => x.wa && x.wa === d) || us[0]).id; };   // the sender decides whose log it is
export async function fitCfg(env, u) {
  const id = pickUser(env, u);
  let raw = null; try { raw = JSON.parse((await env.MEETINGS.get("fitc_cfg_" + id)) || "null"); } catch (e) {}
  const c = fitCleanCfg(raw || {}, FIT_CFG_DEFAULT); c.u = id; return c;   // u rides on the object at run time and is never stored in it
}
export async function fitSaveCfg(env, cfg) { const { u, ...rest } = cfg; await env.MEETINGS.put("fitc_cfg_" + pickUser(env, u), JSON.stringify(rest)); return cfg; }
// The challenge starts the first time anything is logged, unless a start date was already set.
async function ensureStarted(env, cfg, d) { if (!cfg.start) { cfg.start = d; await fitSaveCfg(env, cfg); } return cfg; }

// ---- parsing ----------------------------------------------------------------------------------------------------------
// "45 min", "1h30", "1 hour 30 min", "1.5 hours", "half an hour", "an hour"  ->  minutes, or null
export function parseDuration(s) {
  s = String(s || "").toLowerCase();
  let m = s.match(/(\d+(?:\.\d+)?)\s*(?:h|hrs?|hours?)(?![a-z])\s*(?:and\s*)?(?:(\d{1,2})\s*(?:m|mins?|minutes?)?(?![a-z]))?/);
  if (m) { const v = Math.round(parseFloat(m[1]) * 60 + (m[2] ? parseInt(m[2], 10) : 0)); return v > 0 && v <= 1440 ? v : null; }
  m = s.match(/(\d+(?:\.\d+)?)\s*(?:m|mins?|minutes?)(?![a-z])/);
  if (m) { const v = Math.round(parseFloat(m[1])); return v > 0 && v <= 1440 ? v : null; }
  if (/\bhalf an? hour\b/.test(s)) return 30;
  if (/\b(?:an|one) hour\b/.test(s)) return 60;
  return null;
}
// "10000 steps", "10,000 steps", "10k steps", "8.5k steps"  ->  number, or null
export function parseSteps(s) {
  const m = String(s || "").toLowerCase().match(/(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(k)?\s*steps?\b/);
  if (!m) return null;
  let v = parseFloat(m[1].replace(/,/g, "")); if (m[2]) v *= 1000;
  v = Math.round(v); return v >= 100 && v <= 200000 ? v : null;
}
const EX_WORDS = /\b(gym|weights?|lift(?:ed|ing)?|run|ran|running|jog(?:ged|ging)?|walk(?:ed|ing)?|swim|swam|swimming|cycl(?:e|ed|ing)|bike|biked|biking|spin|padel|tennis|squash|football|basketball|golf|yoga|pilates|hiit|crossfit|boxing|row(?:ed|ing)?|hik(?:e|ed|ing)|climb(?:ed|ing)?|danc(?:e|ed|ing)|stretch(?:ed|ing)?|workout|work(?:ed)? out|training|cardio|treadmill|elliptical)\b/i;
const FOODISH = /\b(ate|eat|eaten|eating|breakfast|lunch|dinner|supper|snack|brunch|had|drank|coffee|smoothie|shake|meal|food|pizza|burger|salad|rice|chicken|sandwich|pasta|eggs?|steak|fish|sushi|fruit|oats?|yogh?urt|steps?)\b/i;
export function exLabel(w) {
  w = String(w || "").toLowerCase();
  if (/^(gym|weights?|lift|lifted|lifting|training|workout|work out|worked out|crossfit)$/.test(w)) return "Gym";
  if (/^(run|ran|running|jog|jogged|jogging|treadmill)$/.test(w)) return "Run";
  if (/^(walk|walked|walking)$/.test(w)) return "Walk";
  if (/^(swim|swam|swimming)$/.test(w)) return "Swim";
  if (/^(cycle|cycled|cycling|bike|biked|biking|spin)$/.test(w)) return "Cycle";
  if (/^(hike|hiked|hiking)$/.test(w)) return "Hike";
  return w.charAt(0).toUpperCase() + w.slice(1);
}
// No model needed: "gym 45 min", "ran 5k in 30 min", "10k steps". Returns { type, minutes, steps } or null.
export function quickExercise(text) {
  const steps = parseSteps(text);
  if (steps) return { type: "Steps", minutes: 0, steps };
  const dur = parseDuration(text), w = String(text || "").match(EX_WORDS);
  if (w && dur) return { type: exLabel(w[1] || w[0]), minutes: dur, steps: 0 };
  return null;
}
const FOOD_PREFIX = /^\s*(?:🍽️?\s*|(?:food|meal|ate|eating|breakfast|lunch|dinner|snack|brunch|supper)\s*[:\-–—]\s*)(.+)$/is;
const EX_PREFIX = /^\s*(ex|exercise|workout|gym|train(?:ing)?)\s*[:\-–—]\s*(.+)$/is;
export const fitCaptionIsFood = (c) => /^\s*(?:🍽|food\b|meal\b|ate\b|eating\b|breakfast\b|lunch\b|dinner\b|snack\b|brunch\b|supper\b)/i.test(String(c || ""));
export const fitLooksRelevant = (t) => { t = String(t || ""); return t.length > 1 && t.length <= 240 && !/\?\s*$/.test(t) && (FOODISH.test(t) || EX_WORDS.test(t)); };

// ---- eating windows ---------------------------------------------------------------------------------------------------
export function windowFor(cfg, ms) {
  const w = (cfg && cfg.windows) || [];
  if (!w.length) return { name: "", out: false };
  const hm = gstHM(ms);
  for (const x of w) if (x.a <= hm && hm < x.b) return { name: x.n, out: false };
  return { name: "", out: true };
}
export const windowsText = (cfg) => ((cfg && cfg.windows) || []).map((w) => w.n + " " + w.a + "-" + w.b).join(" · ") || "none set";

// ---- storage ----------------------------------------------------------------------------------------------------------
async function putEntry(env, e) {
  const body = JSON.stringify(e);
  await env.MEETINGS.put("fit_" + e.u + "_" + e.id, body, { metadata: e });   // metadata repeats the entry: a range needs list() only
  return e;
}
export async function fitAdd(env, f) {
  const t = f.t || Date.now(), d = f.d || gstDate(t);
  const e = { u: pickUser(env, f.u), id: d + "_" + String(t).padStart(10, "0") + "_" + rnd(), d, t, k: f.k === "ex" ? "ex" : "food", x: clip(f.x, 140), m: f.k === "ex" ? Math.max(0, Math.round(f.m || 0)) : 0, n: f.k === "ex" ? Math.max(0, Math.round(f.n || 0)) : 0, s: clip(f.s || "web", 12) };
  if (f.o) e.o = 1;
  return putEntry(env, e);
}
export async function fitGet(env, id, u) {
  if (!ID_RX.test(String(id))) return null;
  try { return JSON.parse((await env.MEETINGS.get("fit_" + pickUser(env, u) + "_" + id)) || "null"); } catch (e) { return null; }
}
export async function fitDelete(env, id, u) { if (!ID_RX.test(String(id))) return false; await env.MEETINGS.delete("fit_" + pickUser(env, u) + "_" + id); return true; }
export async function fitEdit(env, id, patch, u) {
  const e = await fitGet(env, id, u); if (!e) return null;
  if ("x" in patch) e.x = clip(patch.x, 140) || e.x;
  if (e.k === "ex") { if ("m" in patch) e.m = Math.max(0, Math.min(1440, Math.round(patch.m || 0))); if ("n" in patch) e.n = Math.max(0, Math.min(200000, Math.round(patch.n || 0))); }
  return putEntry(env, e);
}
// every entry with from <= d <= to, sorted. One list() walk; entries come back in metadata.
export async function fitRange(env, from, to, u) {
  let i = 0; while (i < from.length && from[i] === to[i]) i++;
  const base = "fit_" + pickUser(env, u) + "_", prefix = base + from.slice(0, i), out = [];
  let cursor;
  for (let guard = 0; guard < 40; guard++) {
    const r = await env.MEETINGS.list({ prefix, cursor, limit: 1000 });
    for (const k of r.keys || []) {
      const d = k.name.slice(base.length, base.length + 10);
      if (!DATE_RX.test(d) || d < from || d > to) continue;
      let e = k.metadata;
      if (!e || !e.id) { try { e = JSON.parse((await env.MEETINGS.get(k.name)) || "null"); } catch (x) { e = null; } }
      if (e && e.id) out.push(e);
    }
    if (r.list_complete || !r.cursor) break;
    cursor = r.cursor;
  }
  return out.sort((a, b) => a.t - b.t);
}

// ---- the weekly target is set every Sunday, for the week ahead --------------------------------------------------------
// A week runs Monday-Sunday. Sunday is the day the week is judged AND the next one is set: "fit target 10" sent on a Sunday
// (GST) is the target for the week starting tomorrow; sent any other day it is this week's. Either way it also becomes the
// carry-over default, so a week nobody set keeps last week's number.
export async function weekTarget(env, cfg, ws) {
  try { const v = parseInt((await env.MEETINGS.get("fitc_wk_" + uOf(env, cfg) + "_" + ws)) || "", 10); if (v >= 0 && v <= 6000) return v; } catch (e) {}
  return cfg.weekMin;
}
export async function fitSetWeekTarget(env, cfg, minutes, today) {
  const m = intIn(minutes, 0, 6000, null); if (m == null) return null;
  const sunday = new Date(today + "T00:00:00Z").getUTCDay() === 0;
  const ws = sunday ? addDays(today, 1) : weekStart(today);
  await env.MEETINGS.put("fitc_wk_" + uOf(env, cfg) + "_" + ws, String(m), { metadata: { m } });
  cfg.weekMin = m; await fitSaveCfg(env, cfg);
  return { week: ws, minutes: m, next: sunday };
}
const SUNDAY_ASK = (cfg, cur) => "📅 It's Sunday - set next week's target. Reply \"momo target 10\" (hours). If you don't, it stays at " + fmtMin(cur) + ".";

// ---- the numbers ------------------------------------------------------------------------------------------------------
export function dayStats(entries, cfg) {
  const s = { meals: 0, out: 0, ex: 0, steps: 0, qualifies: false };
  for (const e of entries || []) {
    if (e.k === "food") { s.meals++; if (e.o) s.out++; }
    else if (e.k === "ex") { if (e.n) s.steps += e.n; else s.ex += e.m || 0; }
  }
  s.qualifies = s.ex >= cfg.minDay || (cfg.stepsFloor > 0 && s.steps >= cfg.stepsFloor);
  return s;
}
export function groupByDay(entries) { const g = {}; for (const e of entries || []) (g[e.d] = g[e.d] || []).push(e); return g; }
export function weekMinutes(byDay, d) {
  const ws = weekStart(d); let m = 0;
  for (let i = 0; i < 7; i++) for (const e of byDay[addDays(ws, i)] || []) if (e.k === "ex" && !e.n) m += e.m || 0;
  return { start: ws, minutes: m };
}
export function challengeStats(byDay, cfg, today) {
  if (!cfg.start) return null;
  const end = addDays(cfg.start, cfg.days - 1);
  if (today < cfg.start) return { start: cfg.start, end, day: 0, days: cfg.days, hit: 0, streak: 0, done: false, over: false };
  const last = today < end ? today : end;
  let hit = 0, streak = 0, run = 0;
  for (let d = cfg.start; d <= last; d = addDays(d, 1)) {
    const q = dayStats(byDay[d], cfg).qualifies;
    if (q) { hit++; run++; } else if (d < today) run = 0;   // today may still be won; yesterday's miss resets the run
  }
  streak = run;
  return { start: cfg.start, end, day: daysBetween(cfg.start, last) + 1, days: cfg.days, hit, streak, done: today >= end, over: today > end };
}
// one read that serves the page, the replies and the evening verdict
export async function fitSummary(env, d, cfg, today) {
  const sFrom = (() => { const hi = addDays(d, 3) < today ? addDays(d, 3) : today; return { from: addDays(hi, -6), to: hi }; })();   // the 7-day strip ends 3 days after the chosen day, never past today
  const wk = weekStart(d), chStart = cfg.start || d, chEnd = cfg.start ? (addDays(cfg.start, cfg.days - 1) < today ? addDays(cfg.start, cfg.days - 1) : today) : d;
  const from = [sFrom.from, wk, chStart, d].sort()[0], to = [sFrom.to, addDays(wk, 6), chEnd, d].sort().slice(-1)[0];
  const all = await fitRange(env, from, to, cfg.u), by = groupByDay(all);
  const days = []; for (let x = sFrom.from; x <= sFrom.to; x = addDays(x, 1)) { const s = dayStats(by[x], cfg); days.push({ d: x, meals: s.meals, out: s.out, ex: s.ex, steps: s.steps, ok: s.qualifies }); }
  const week = weekMinutes(by, d); week.target = await weekTarget(env, cfg, week.start);
  return { today, d, entries: by[d] || [], stats: dayStats(by[d], cfg), strip: days, week, challenge: challengeStats(by, cfg, today), by };
}

// ---- cumulative: day by day, week by week, month by month, and the whole challenge ------------------------------------
// A week with no target of its own carries the most recent earlier one; a week before the first target ever set uses that first one.
export function carryTarget(stored, ws, fallback) {
  const ks = Object.keys(stored || {}).sort();
  if (!ks.length) return fallback;
  let t = stored[ks[0]];
  for (const k of ks) { if (k <= ws) t = stored[k]; else break; }
  return t;
}
async function storedTargets(env, u) {
  const out = {}, base = "fitc_wk_" + pickUser(env, u) + "_"; let cursor;
  for (let g = 0; g < 10; g++) {
    const r = await env.MEETINGS.list({ prefix: base, cursor, limit: 1000 });
    for (const k of r.keys || []) {
      const ws = k.name.slice(base.length); if (!DATE_RX.test(ws)) continue;
      let m = k.metadata && k.metadata.m; if (m == null) { try { m = parseInt((await env.MEETINGS.get(k.name)) || "", 10); } catch (e) { m = NaN; } }
      if (Number.isFinite(m)) out[ws] = m;
    }
    if (r.list_complete || !r.cursor) break; cursor = r.cursor;
  }
  return out;
}
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export async function fitHistory(env, cfg, today) {
  let from = cfg.start && cfg.start <= today ? cfg.start : addDays(today, -29);
  if (from < addDays(today, -400)) from = addDays(today, -400);
  const by = groupByDay(await fitRange(env, from, today, cfg.u)), stored = await storedTargets(env, cfg.u);
  const days = [], weeks = {}, months = {};
  const t = { days: 0, hit: 0, minutes: 0, steps: 0, meals: 0, out: 0, bestStreak: 0, weeksMet: 0, weeksDone: 0, from, to: today };
  let run = 0;
  for (let d = from; d <= today; d = addDays(d, 1)) {
    const s = dayStats(by[d], cfg), ok = s.qualifies;
    days.push({ d, meals: s.meals, out: s.out, ex: s.ex, steps: s.steps, ok });
    t.days++; t.minutes += s.ex; t.steps += s.steps; t.meals += s.meals; t.out += s.out;
    if (ok) { t.hit++; run++; if (run > t.bestStreak) t.bestStreak = run; } else if (d < today) run = 0;
    const ws = weekStart(d), w = weeks[ws] || (weeks[ws] = { ws, from: d, to: d, days: 0, hit: 0, minutes: 0, steps: 0, meals: 0, out: 0 });
    w.to = d; w.days++; w.minutes += s.ex; w.steps += s.steps; w.meals += s.meals; w.out += s.out; if (ok) w.hit++;
    const mk = d.slice(0, 7), m = months[mk] || (months[mk] = { m: mk, label: MONTHS[parseInt(mk.slice(5), 10) - 1] + " " + mk.slice(0, 4), days: 0, hit: 0, minutes: 0, steps: 0, meals: 0, out: 0 });
    m.days++; m.minutes += s.ex; m.steps += s.steps; m.meals += s.meals; m.out += s.out; if (ok) m.hit++;
  }
  const wl = Object.values(weeks).sort((a, b) => (a.ws < b.ws ? -1 : 1));
  for (const w of wl) {
    w.target = carryTarget(stored, w.ws, cfg.weekMin); w.complete = addDays(w.ws, 6) < today;   // the week is over only once its Sunday has passed w.met = w.target > 0 && w.minutes >= w.target;
    if (w.complete) { t.weeksDone++; if (w.met) t.weeksMet++; }
  }
  return { today, cfg, days, weeks: wl, months: Object.values(months).sort((a, b) => (a.m < b.m ? -1 : 1)), totals: t };
}
const wd = (d) => new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
const dm = (d) => new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
function weekText(cfg, sum) {
  const ws = sum.week.start, L = ["📅 This week (" + dm(ws) + " - " + dm(addDays(ws, 6)) + ")"];
  for (let i = 0; i < 7; i++) {
    const d = addDays(ws, i), s = dayStats(sum.by[d], cfg), future = d > sum.today;
    L.push(wd(d) + " " + (future ? "·" : s.qualifies ? "✅" : d === sum.today ? "⏳" : "❌") + (future ? "" : " " + fmtMin(s.ex) + (s.steps ? " + " + fmtSteps(s.steps) + " steps" : "") + " · " + s.meals + " meal" + (s.meals === 1 ? "" : "s") + (s.out ? " (" + s.out + " outside)" : "")));
  }
  L.push("", "Week: " + fmtMin(sum.week.minutes) + " of " + fmtMin(sum.week.target) + (sum.week.target && sum.week.minutes >= sum.week.target ? " ✅" : ""));
  return L.join("\n");
}
function historyText(h) {
  const t = h.totals, L = ["📈 " + (h.cfg.start ? "Since " + dm(h.cfg.start) : "Last " + t.days + " days") + " · " + t.days + " days"];
  L.push("Days hit: " + t.hit + " of " + t.days + " · best streak " + t.bestStreak);
  L.push("Exercise: " + fmtMin(t.minutes) + (t.steps ? " · " + fmtSteps(t.steps) + " steps" : ""));
  L.push("Weeks on target: " + t.weeksMet + " of " + t.weeksDone + " finished · meals outside windows: " + t.out + " of " + t.meals);
  L.push("");
  for (const w of h.weeks.slice(-8)) L.push("Wk " + dm(w.ws) + ": " + fmtMin(w.minutes) + " of " + fmtMin(w.target) + (w.complete ? (w.met ? " ✅" : " ❌") : " ⏳") + " · " + w.hit + "/" + w.days + " days");
  return L.join("\n");
}

// ---- how it talks -----------------------------------------------------------------------------------------------------
// kind: gentle. firm: plain and direct. brutal: no padding - and still about what was DONE, never about who the person is.
const SAY = {
  dayDone: { kind: "Today's minimum is done. Well done.", firm: "Minimum done. That is the standard - repeat it tomorrow.", brutal: "Floor cleared. That is the bare minimum, so do not get comfortable." },
  weekDone: { kind: "🎉 Weekly target hit - a brilliant week.", firm: "🎉 Weekly target hit. This is what sticking to the plan looks like.", brutal: "🎉 Weekly target hit. Now do it again - one week proves nothing." },
  dayPass: { kind: "Great day - minimum done and meals on plan.", firm: "Good day. Minimum done, meals in their windows. That is the plan working.", brutal: "Clean day. Minimum done and every meal in its window. Exactly what was promised - now repeat it." },
  mixed: { kind: "Movement done - a couple of meals fell outside your windows. Easy to fix tomorrow.", firm: "Movement done, but {out} meal{s} outside your eating windows. Half a win - the windows are part of the plan.", brutal: "You moved, but {out} meal{s} landed outside your eating windows. The windows were your rule and you broke them. Half a win is still half a miss." },
  dayFail: { kind: "Today's movement did not happen. Tomorrow is a fresh start - and even {steps} steps counts.", firm: "You missed today: no {min}-minute workout and no {steps} steps. There was always an option and none was taken. Tomorrow starts the moment you wake up.", brutal: "Today was weak. No workout, and not even the {steps} steps that existed for exactly this day. String days like this together and you will be heavier and slower by next month - by your own choice. Fix it tomorrow." },
  weekMiss: { kind: "Weekly target missed this time ({got} of {want}). New week, new start.", firm: "Weekly target missed: {got} of {want}. Look at which days were skipped and close that gap next week.", brutal: "Weekly target missed: {got} of {want}. The days you skipped are the gap. Close it next week or stop calling it a target." }
};
function say(cfg, key, vars) {
  const t = (SAY[key] && (SAY[key][cfg.tone] || SAY[key].firm)) || "";
  return t.replace(/\{(\w+)\}/g, (_, k) => (vars && k in vars ? vars[k] : ""));
}
const sayVars = (cfg, extra) => Object.assign({ steps: fmtSteps(cfg.stepsFloor), min: cfg.minDay }, extra || {});

// the one-line state of the day, week and challenge - appended to every acknowledgement
function stateLines(cfg, sum) {
  const st = sum.stats, L = [];
  L.push("Today: " + st.meals + " meal" + (st.meals === 1 ? "" : "s") + " · " + fmtMin(st.ex) + (st.steps ? " · " + fmtSteps(st.steps) + " steps" : ""));
  L.push(st.qualifies ? "✅ Daily minimum done" : "⏳ Still needed: " + cfg.minDay + " min of exercise" + (cfg.stepsFloor ? " or " + fmtSteps(cfg.stepsFloor) + " steps" : ""));
  if (sum.week.target) L.push("Week: " + fmtMin(sum.week.minutes) + " of " + fmtMin(sum.week.target));
  const ch = sum.challenge; if (ch && ch.day) L.push("Challenge: day " + Math.min(ch.day, ch.days) + " of " + ch.days + " · " + ch.hit + " days hit" + (ch.streak > 1 ? " · streak " + ch.streak : ""));
  return L.join("\n");
}

// ---- what a log does: write, then say where that leaves the day -------------------------------------------------------
async function flagOnce(env, key) {
  try { if (await env.MEETINGS.get(key)) return false; await env.MEETINGS.put(key, "1", { expirationTtl: 60 * 86400 }); return true; } catch (e) { return false; }
}
async function logEntry(env, deps, from, f) {
  const u = fitUserFor(env, from), cfg = await fitCfg(env, u), now = Date.now();
  const off = Math.max(-2, Math.min(0, Math.round(f.off || 0))), t = now + off * DAY_MS, d = gstDate(t);
  await ensureStarted(env, cfg, d);
  let o = false, win = "";
  if (f.k === "food" && off === 0) { const w = windowFor(cfg, t); o = w.out; win = w.name; }   // an earlier day has no clock time to judge
  const e = await fitAdd(env, { u, k: f.k, x: f.x, m: f.m, n: f.n, t, d, o, s: f.s });
  const today = gstDate(now), sum = await fitSummary(env, d, cfg, today);
  let head;
  if (e.k === "food") head = "🍽 Logged - " + e.x + (off ? " (" + (off === -1 ? "yesterday" : "2 days ago") + ")" : "") + (win ? " · " + win : "");
  else if (e.n) head = "👟 Logged - " + fmtSteps(e.n) + " steps" + (off ? " (" + (off === -1 ? "yesterday" : "2 days ago") + ")" : "");
  else head = "🏃 Logged - " + e.x + " · " + fmtMin(e.m) + (off ? " (" + (off === -1 ? "yesterday" : "2 days ago") + ")" : "");
  const parts = [head];
  if (o) parts.push("⚠ That is outside your eating windows (" + windowsText(cfg) + ").");
  parts.push("", stateLines(cfg, sum));
  // positive reinforcement the moment a target is reached, once each
  if (e.k === "ex" && sum.stats.qualifies && await flagOnce(env, "fitc_flag_" + u + "_" + d + "_day")) parts.push("", "✅ " + say(cfg, "dayDone", sayVars(cfg)));
  if (e.k === "ex" && sum.week.target && sum.week.minutes >= sum.week.target && await flagOnce(env, "fitc_flag_" + u + "_" + sum.week.start + "_week")) parts.push("", say(cfg, "weekDone", sayVars(cfg)));
  await reply(env, deps, from, parts.join("\n"), [{ id: "fit:undo:" + u + ":" + e.id, title: "↩ Undo" }]);
  return e;
}
async function reply(env, deps, to, body, buttons) {
  try {
    if (buttons && buttons.length) await deps.waSendButtons(env, to, String(body).slice(0, 1024), buttons);
    else await deps.waSend(env, to, String(body).slice(0, 4000));
  } catch (e) {}
}

// ---- WhatsApp: text (and voice notes, once transcribed) ---------------------------------------------------------------
const CLASS_SCHEMA = { type: "object", additionalProperties: false, properties: {
  kind: { type: "string", enum: ["food", "exercise", "other"] }, text: { type: ["string", "null"] }, type: { type: ["string", "null"] },
  minutes: { type: ["integer", "null"] }, steps: { type: ["integer", "null"] }, day_offset: { type: "integer" } },
  required: ["kind", "text", "type", "minutes", "steps", "day_offset"] };
async function classify(env, deps, text) {
  const sys = "You log food and exercise for one person. Decide whether the message reports something ALREADY eaten, drunk or done (past tense or just now).\n" +
    "- \"food\": a meal, snack or drink. text = what was eaten, plain, under 100 characters, no calories, no judgement.\n" +
    "- \"exercise\": a workout, sport, walk or step count. type = a short label (Gym, Walk, Run, Padel, Steps...). minutes = total minutes as an integer (1 hour = 60), null when no duration is given. For a step count use type \"Steps\" and steps = the number, minutes null.\n" +
    "- \"other\": anything else - plans, questions, meetings (\"lunch with Sara on Friday\"), tasks, future intent (\"gym tomorrow at 6\"), bookings, anything not yet done.\n" +
    "day_offset: 0 for today, -1 when the message says yesterday, -2 for the day before. Output ONLY the JSON.";
  const g = deps.claudeJSON ? await deps.claudeJSON(env, sys, text, CLASS_SCHEMA, deps.CLAUDE_FAST, 250) : null;
  return g && g.kind ? g : null;
}
function statusText(cfg, sum) {
  const L = ["📊 " + (sum.d === sum.today ? "Today" : sum.d), stateLines(cfg, sum)];
  if (cfg.goal) L.push("Goal: " + cfg.goal);
  const ents = sum.entries.slice(-8).map((e) => (e.k === "food" ? "🍽 " + e.x + (e.o ? " ⚠" : "") : e.n ? "👟 " + fmtSteps(e.n) + " steps" : "🏃 " + e.x + " " + fmtMin(e.m)));
  if (ents.length) L.push("", ents.join("\n"));
  if (sum.today === sum.d && new Date(sum.today + "T00:00:00Z").getUTCDay() === 0) L.push("", SUNDAY_ASK(cfg, sum.week.target));
  L.push("", "Open Momo in the bottom bar for the full view.");
  return L.join("\n");
}
// true when the message was FIT's and has been answered; false leaves it for the rest of the webhook
export async function fitWhatsAppText(env, from, text, deps) {
  text = String(text || "").trim(); if (!text) return false;
  text = text.replace(/^\s*momo\b/i, "fit");   // the app is called Momo: "momo week" is "fit week"
  const U = fitUserFor(env, from);
  // a one-turn follow-up: "How long was the gym?" -> "45 min"
  let pend = null; try { pend = JSON.parse((await env.MEETINGS.get("fitc_pend_" + from)) || "null"); } catch (e) {}
  if (pend) {
    try { await env.MEETINGS.delete("fitc_pend_" + from); } catch (e) {}
    const m = /^\s*(\d+(?:\.\d+)?)\s*$/.exec(text), dur = m ? (parseFloat(m[1]) >= 6 ? Math.round(parseFloat(m[1])) : null) : (text.length <= 24 ? parseDuration(text) : null);   // a bare 1-5 is a feed pick, not a duration
    if (dur && dur > 0 && dur <= 1440) { await logEntry(env, deps, from, { k: "ex", x: pend.type, m: dur, s: "wa", off: pend.off || 0 }); return true; }
  }
  // commands
  let c;
  if (/^\s*(fit|my fit|fit log|fit status|my log|food log)\s*\??\s*$/i.test(text)) { const cfg = await fitCfg(env, U), today = gstDate(Date.now()); await reply(env, deps, from, statusText(cfg, await fitSummary(env, today, cfg, today))); return true; }
  if (/^\s*fit\s+(week|this week)\s*$/i.test(text)) { const cfg = await fitCfg(env, U), today = gstDate(Date.now()); await reply(env, deps, from, weekText(cfg, await fitSummary(env, today, cfg, today))); return true; }
  if (/^\s*fit\s+(history|total|totals|weeks|progress)\s*$/i.test(text)) { const cfg = await fitCfg(env, U); await reply(env, deps, from, historyText(await fitHistory(env, cfg, gstDate(Date.now())))); return true; }
  if ((c = /^\s*fit\s+goal\s*[:\-–—]?\s*(.{3,200})$/i.exec(text))) { const cfg = await fitCfg(env, U); cfg.goal = clip(c[1], 200); await fitSaveCfg(env, cfg); await reply(env, deps, from, "🎯 Goal set: " + cfg.goal); return true; }
  if ((c = /^\s*fit\s+target\s*[:\-–—]?\s*(\d+(?:\.\d+)?)\s*(?:h|hrs?|hours?)?\s*$/i.exec(text))) {
    const cfg = await fitCfg(env, U), r = await fitSetWeekTarget(env, cfg, parseFloat(c[1]) * 60, gstDate(Date.now()));
    await reply(env, deps, from, r ? "🎯 Target for " + (r.next ? "next week (from Mon " + r.week.slice(5) + ")" : "this week") + ": " + fmtMin(r.minutes) : "That target is out of range - try a number of hours, like \"momo target 10\".");
    return true;
  }
  if ((c = /^\s*fit\s+tone\s*[:\-–—]?\s*(kind|firm|brutal)\s*$/i.exec(text))) { const cfg = await fitCfg(env, U); cfg.tone = c[1].toLowerCase(); await fitSaveCfg(env, cfg); await reply(env, deps, from, "Tone set to " + cfg.tone + "."); return true; }
  if (/^\s*fit\s+extend\s*$/i.test(text)) { const cfg = await fitCfg(env, U); cfg.days = Math.min(365, cfg.days + 30); await fitSaveCfg(env, cfg); await reply(env, deps, from, "➕ Challenge extended to " + cfg.days + " days."); return true; }
  if (/^\s*fit\s+(start|restart)\s*$/i.test(text)) { const cfg = await fitCfg(env, U); cfg.start = gstDate(Date.now()); await fitSaveCfg(env, cfg); await reply(env, deps, from, "▶️ Challenge starts today - " + cfg.days + " days."); return true; }
  // explicit prefixes need no model: "food: grilled chicken and rice", "gym: 45 min"
  if ((c = EX_PREFIX.exec(text))) {
    const rest = c[2].trim(), steps = parseSteps(rest), dur = parseDuration(rest);
    const word = /^(ex|exercise)$/i.test(c[1]) ? (rest.match(EX_WORDS) ? exLabel(rest.match(EX_WORDS)[1] || rest.match(EX_WORDS)[0]) : clip(rest.replace(/[\d.,]+\s*(h|hrs?|hours?|m|mins?|minutes?)\b/gi, ""), 40) || "Workout") : exLabel(c[1]);
    if (steps) { await logEntry(env, deps, from, { k: "ex", x: "Steps", n: steps, s: "wa" }); return true; }
    if (dur) { await logEntry(env, deps, from, { k: "ex", x: word, m: dur, s: "wa" }); return true; }
    await env.MEETINGS.put("fitc_pend_" + from, JSON.stringify({ type: word, off: 0 }), { expirationTtl: 180 });
    await reply(env, deps, from, "⏱ How long was the " + word.toLowerCase() + "? Reply like \"45 min\" or \"1h30\"."); return true;
  }
  if ((c = FOOD_PREFIX.exec(text))) { await logEntry(env, deps, from, { k: "food", x: c[1], s: "wa" }); return true; }
  // anything else must LOOK like food or exercise before a model is asked, so ordinary tasks and meetings never pay for it
  if (!fitLooksRelevant(text)) return false;
  const quick = quickExercise(text);
  const g = await classify(env, deps, text);
  if (g) {
    if (g.kind === "other") return false;
    const off = Math.max(-2, Math.min(0, Math.round(g.day_offset || 0)));
    if (g.kind === "food" && clip(g.text, 140)) { await logEntry(env, deps, from, { k: "food", x: g.text, s: "wa", off }); return true; }
    if (g.kind === "exercise") {
      const steps = g.steps || (quick && quick.steps) || 0, dur = g.minutes || (quick && quick.minutes) || 0, type = clip(g.type, 40) || (quick && quick.type) || "Workout";
      if (steps) { await logEntry(env, deps, from, { k: "ex", x: "Steps", n: steps, s: "wa", off }); return true; }
      if (dur) { await logEntry(env, deps, from, { k: "ex", x: type, m: dur, s: "wa", off }); return true; }
      await env.MEETINGS.put("fitc_pend_" + from, JSON.stringify({ type, off }), { expirationTtl: 180 });
      await reply(env, deps, from, "⏱ How long was the " + type.toLowerCase() + "? Reply like \"45 min\" or \"1h30\"."); return true;
    }
    return false;
  }
  // the model was unreachable: only what is unambiguous without it
  if (quick) { await logEntry(env, deps, from, { k: "ex", x: quick.type, m: quick.minutes, n: quick.steps, s: "wa" }); return true; }
  return false;
}

// ---- WhatsApp: photos -------------------------------------------------------------------------------------------------
// The bytes are read once by the model and dropped; nothing here has a put() that takes an image.
const MEAL_SCHEMA = { type: "object", additionalProperties: false, properties: { meal: { type: ["string", "null"] } }, required: ["meal"] };
export async function fitVision(env, deps, buf, mime, cap) {
  const sys = "You read a photo someone sent to log what they ate or drank. If it shows food or drink (a plate, bowl, takeaway box, snack, drink), set meal to a plain description of what is on it, under 15 words, no calories and no judgement. If it shows no food or drink (a menu, a receipt, a recipe page, a person, a place), set meal to null. Do not invent detail that is not visible.";
  const content = [{ type: "image", source: { type: "base64", media_type: mime || "image/jpeg", data: deps.b64of(buf) } }, { type: "text", text: cap ? "The sender's caption: " + cap : "No caption." }];
  const g = deps.claudeJSON ? await deps.claudeJSON(env, sys, content, MEAL_SCHEMA, deps.CLAUDE_FAST, 200) : null;
  return g && g.meal ? clip(g.meal, 140) : "";
}
// A caption such as "lunch" claims the photo outright. Returns true when handled.
export async function fitPhotoCaptioned(env, from, mediaId, cap, deps) {
  if (!fitCaptionIsFood(cap)) return false;
  let desc = "";
  try { const m = await deps.waFetchMedia(env, mediaId); if (m.bytes.byteLength <= 4 * 1024 * 1024) desc = await fitVision(env, deps, m.bytes, m.mime, cap); } catch (e) {}
  if (!desc) desc = clip(String(cap).replace(/^\s*(?:🍽️?|food|meal|ate|eating|breakfast|lunch|dinner|snack|brunch|supper)\s*[:\-–—]?\s*/i, ""), 140);
  if (!desc) { await reply(env, deps, from, "🍽 I could not tell what was on that plate - send it again or describe it, like \"food: grilled chicken and rice\"."); return true; }
  await logEntry(env, deps, from, { k: "food", x: desc, s: "photo" });
  return true;
}
// rd = what readPhoto returned (kind "meal" carries the description). True when the photo was a meal and is logged.
export async function fitPhotoRead(env, from, rd, cap, deps) {
  if (!rd || rd.kind !== "meal") return false;
  const desc = clip(rd.meal || "", 140); if (!desc) return false;
  await logEntry(env, deps, from, { k: "food", x: desc, s: "photo" });
  return true;
}

// ---- WhatsApp: buttons ------------------------------------------------------------------------------------------------
export async function fitButton(env, from, bid, deps) {
  bid = String(bid || "");
  if (bid.indexOf("fit:undo:") === 0) {
    const rest = bid.slice(9), m = /^([a-z0-9]{1,12}):(.+)$/.exec(rest), u = m ? m[1] : fitUserFor(env, from), id = m ? m[2] : rest;
    const e = await fitGet(env, id, u);
    if (e) { await fitDelete(env, e.id, u); await reply(env, deps, from, "↩ Removed - " + (e.k === "ex" ? (e.n ? fmtSteps(e.n) + " steps" : e.x + " " + fmtMin(e.m)) : e.x)); }
    else await reply(env, deps, from, "Already removed.");
    return true;
  }
  if (bid === "fit:extend") { const cfg = await fitCfg(env, fitUserFor(env, from)); cfg.days = Math.min(365, cfg.days + 30); await fitSaveCfg(env, cfg); await reply(env, deps, from, "➕ Challenge extended to " + cfg.days + " days. Keep going."); return true; }
  return false;
}

// ---- the evening verdict (21:00-21:29 GST, once a day, only while the 24-hour window is open) -------------------------
export async function fitEvening(env, deps, nowMs) {
  const hm = gstHM(nowMs); if (hm < "21:00" || hm >= "21:30") return false;
  if (!env.WA_ALLOWED) return false;
  const mine = String(env.WA_ALLOWED).replace(/\D/g, ""); let sent = false;
  for (const user of fitUsers(env)) {
    if (user.wa !== mine) continue;   // this instance can only speak to its own number: the others read their verdict on the page
    if (await eveningFor(env, deps, nowMs, user.id)) sent = true;
  }
  return sent;
}
async function eveningFor(env, deps, nowMs, u) {
  const cfg = await fitCfg(env, u); if (!cfg.start) return false;
  const today = gstDate(nowMs); if (today < cfg.start) return false;
  const end = addDays(cfg.start, cfg.days - 1); if (today > end) return false;
  // the window check comes BEFORE the once-a-day flag: a closed window must not use up the day's verdict (the next cron tick tries again)
  let open = false; try { open = deps.ownerWindowOpen ? await deps.ownerWindowOpen(env) : false; } catch (e) {}
  if (!open) {
    // The 24-hour window is shut. The verdict itself never goes out as a template (it waits on the page). The approved no-variable nudge
    // (LOG_NUDGE_TEMPLATE, off until Meta approves it) may: once a day, and only if nothing has been logged yet today.
    if (env.LOG_NUDGE_TEMPLATE && deps.waSendTemplate) {
      const first = await fitSummary(env, today, cfg, today);
      if (!first.entries.length && await flagOnce(env, "fitc_nudge_" + u + "_" + today)) {
        try { await deps.waSendTemplate(env, env.WA_ALLOWED, env.LOG_NUDGE_TEMPLATE, env.LOG_NUDGE_LANG || "en_US", []); } catch (e) {}
        return true;
      }
    }
    return false;
  }
  if (!(await flagOnce(env, "fitc_sent_" + u + "_" + today))) return false;
  const sum = await fitSummary(env, today, cfg, today), st = sum.stats, ch = sum.challenge, V = sayVars(cfg);
  const L = [];
  if (!st.qualifies) L.push("🔴 Day " + ch.day + " of " + cfg.days + " - " + say(cfg, "dayFail", V));
  else if (st.out > 0) L.push("🟡 Day " + ch.day + " of " + cfg.days + " - " + say(cfg, "mixed", Object.assign({}, V, { out: st.out, s: st.out === 1 ? "" : "s" })));
  else L.push("🟢 Day " + ch.day + " of " + cfg.days + " - " + say(cfg, "dayPass", V));
  L.push("", stateLines(cfg, sum));
  if (new Date(today + "T00:00:00Z").getUTCDay() === 0) {   // Sunday: this week is judged, next week is set
    if (sum.week.target) L.push("", sum.week.minutes >= sum.week.target ? say(cfg, "weekDone", V) : say(cfg, "weekMiss", Object.assign({}, V, { got: fmtMin(sum.week.minutes), want: fmtMin(sum.week.target) })));
    if (!(await env.MEETINGS.get("fitc_wk_" + u + "_" + addDays(today, 1)))) L.push("", SUNDAY_ASK(cfg, cfg.weekMin));
  }
  const buttons = [];
  if (today === end) { L.push("", "🏁 Challenge complete: " + ch.hit + " of " + cfg.days + " days hit. Extend it?"); buttons.push({ id: "fit:extend", title: "➕ Extend 30 days" }); }
  await reply(env, deps, env.WA_ALLOWED, L.join("\n"), buttons);
  return true;
}

// ---- the page and its API (owner only) --------------------------------------------------------------------------------
const IMG_BYTES = {};
const J = (o, status) => new Response(JSON.stringify(o), { status: status || 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
// h: { keyTier, najNav, NAJ_NAV_CSS, NAJ_FONTS } + the WhatsApp deps (claudeJSON, CLAUDE_FAST, b64of) for the photo upload.
export async function fitRoutes(request, env, url, h) {
  const p = url.pathname, isImg = p.indexOf("/fit_img/") === 0;
  if (p !== "/fit" && p !== "/fit_api" && !isImg) return null;
  if (h.keyTier(env, url) !== "admin") return new Response("not found", { status: 404 });   // a client key, no key, a wrong key: all the same 404
  const key = url.searchParams.get("key") || "";
  if (isImg) {   // the bundled photos, served from the worker itself: the page never asks a third party for anything
    const n = p.slice(9).replace(/\.jpg$/, "");
    if (!Object.prototype.hasOwnProperty.call(FIT_IMG, n)) return new Response("not found", { status: 404 });
    const bytes = IMG_BYTES[n] || (IMG_BYTES[n] = Uint8Array.from(atob(FIT_IMG[n]), (c) => c.charCodeAt(0)));   // constants of the bundle, never user data: safe to keep between requests
    return new Response(bytes, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=86400", "X-Robots-Tag": "noindex", "Referrer-Policy": "no-referrer" } });
  }
  if (p === "/fit") {
    const html = fitPageHtml({ key, nav: h.najNav(key, "fit", ""), navCss: h.NAJ_NAV_CSS, fonts: h.NAJ_FONTS });
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" } });
  }
  const now = Date.now(), today = gstDate(now), us = fitUsers(env).map((x) => x.id), cfg = await fitCfg(env, url.searchParams.get("u"));
  if (request.method === "GET") {
    if (url.searchParams.get("view") === "history") return J(Object.assign({ ok: true, u: cfg.u, users: us }, await fitHistory(env, cfg, today)));
    let d = url.searchParams.get("d") || today; if (!DATE_RX.test(d) || d > today) d = today;
    const sum = await fitSummary(env, d, cfg, today);
    return J({ ok: true, u: cfg.u, users: us, today, d, cfg, entries: sum.entries, stats: sum.stats, strip: sum.strip, week: sum.week, challenge: sum.challenge });
  }
  if (request.method !== "POST") return J({ ok: false, why: "method" }, 405);
  if (url.searchParams.get("op") === "photo") {   // read once, drop: nothing about the image is stored
    const buf = await request.arrayBuffer();
    if (!buf.byteLength || buf.byteLength > 4 * 1024 * 1024) return J({ ok: false, why: "photo must be under 4 MB" }, 413);
    const mime = (request.headers.get("content-type") || "image/jpeg").split(";")[0];
    if (!/^image\/(jpeg|png|webp|gif)$/.test(mime)) return J({ ok: false, why: "not an image" }, 415);
    let meal = ""; try { meal = await fitVision(env, h, buf, mime, ""); } catch (e) {}
    return J({ ok: true, meal });
  }
  let b; try { b = await request.json(); } catch (e) { return J({ ok: false, why: "bad json" }, 400); }
  const op = b && b.op;
  if (op === "add") {
    let d = DATE_RX.test(String(b.d || "")) ? b.d : today; if (d > today) d = today;
    const kind = b.kind === "ex" ? "ex" : "food", x = clip(b.text, 140);
    if (!x) return J({ ok: false, why: "say what it was" }, 400);
    let m = 0, n = 0;
    if (kind === "ex") {
      n = Math.round(Number(b.steps) || 0); m = Math.round(Number(b.minutes) || 0);
      if (n < 0 || n > 200000 || m < 0 || m > 1440 || (!n && !m)) return J({ ok: false, why: "give minutes or steps" }, 400);
    }
    await ensureStarted(env, cfg, d);
    const t = d === today ? now : Date.parse(d + "T12:00:00Z") - GST_MS;   // an earlier day has no clock time
    let o = false; if (kind === "food" && d === today) o = windowFor(cfg, t).out;
    const e = await fitAdd(env, { u: cfg.u, k: kind, x: kind === "ex" && n ? "Steps" : x, m, n, t, d, o, s: "web" });
    return J({ ok: true, entry: e });
  }
  if (op === "del") return J({ ok: await fitDelete(env, b.id, cfg.u) });
  if (op === "edit") {
    const patch = {}; if (typeof b.text === "string") patch.x = b.text; if (b.minutes != null) patch.m = b.minutes; if (b.steps != null) patch.n = b.steps;
    const e = await fitEdit(env, b.id, patch, cfg.u); return e ? J({ ok: true, entry: e }) : J({ ok: false, why: "no such entry" }, 404);
  }
  if (op === "weektarget") { const r = await fitSetWeekTarget(env, cfg, Math.round(Number(b.hours) * 60), today); return r ? J({ ok: true, target: r }) : J({ ok: false, why: "hours out of range" }, 400); }
  if (op === "cfg") { const next = fitCleanCfg(b.cfg, cfg); await fitSaveCfg(env, next); return J({ ok: true, cfg: next }); }
  if (op === "extend") { cfg.days = Math.min(365, cfg.days + 30); await fitSaveCfg(env, cfg); return J({ ok: true, cfg }); }
  return J({ ok: false, why: "unknown op" }, 400);
}

const FIT_CSS = ".fw{max-width:640px;margin:0 auto;padding:18px 16px calc(96px + env(safe-area-inset-bottom))}h1.ft{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:1.7rem;margin:4px 0 2px;color:#F2EFE6}" +
  ".fsub{color:#8FA39B;font-size:.78rem;margin-bottom:14px;font-family:'IBM Plex Mono',monospace;letter-spacing:.03em}.fc{background:#0E1918;border:1px solid #24352F;border-radius:14px;padding:14px;margin:12px 0}" +
  ".fc h2{font-family:'IBM Plex Mono',monospace;font-size:.7rem;letter-spacing:.12em;color:#C5A56A;margin:0 0 10px;font-weight:500}.bar{height:9px;background:#16241f;border-radius:99px;overflow:hidden;margin:6px 0 4px}.bar i{display:block;height:100%;background:#C5A56A;border-radius:99px;transition:width .4s}.bar i.ok{background:#5FBF8A}" +
  ".row{display:flex;justify-content:space-between;gap:10px;font-size:.82rem;color:#CFD8D3}.row b{color:#F2EFE6;font-weight:600}.goal{font-family:Fraunces,Georgia,serif;font-size:1rem;color:#F2EFE6;margin:2px 0 10px}" +
  ".strip{display:flex;gap:6px;margin:6px 0}.strip button{flex:1;min-width:0;border:1px solid #2E4540;background:#0E1918;color:#CFD8D3;border-radius:12px;padding:7px 2px;font:inherit;font-size:.66rem;cursor:pointer;line-height:1.35}.strip button.on{border-color:#C5A56A;color:#F2EFE6}.strip .dot{display:block;font-size:.95rem}" +
  ".dn{display:flex;align-items:center;justify-content:space-between;margin:8px 0}.dn button{background:none;border:1px solid #2E4540;color:#CFD8D3;border-radius:10px;min-width:40px;min-height:36px;font-size:1rem;cursor:pointer}.dn span{font-size:.9rem;color:#F2EFE6}" +
  ".it{display:flex;align-items:center;gap:8px;padding:9px 0;border-top:1px solid #1b2a26;font-size:.88rem;color:#E6E9E4}.it:first-of-type{border-top:0}.it .x{flex:1;min-width:0;word-break:break-word}.it small{color:#8FA39B;font-size:.7rem;display:block}.it .w{color:#E0A458}.it button{background:none;border:0;color:#8FA39B;font-size:1rem;min-width:34px;min-height:34px;cursor:pointer}" +
  ".fc .add+.row{margin-top:12px}.hero{position:relative;height:176px;border-radius:16px;overflow:hidden;background:#16241f center/cover no-repeat;margin:0 0 12px}.hero:after,.ph:after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(12,20,19,.04) 28%,rgba(12,20,19,.80))}.hero .ht{position:absolute;left:16px;right:16px;bottom:12px;z-index:1}.hero h1.ft{margin:0}.hero .fsub{margin:2px 0 0;color:#E6E9E4}.ph{position:relative;height:92px;margin:-14px -14px 12px;border-radius:14px 14px 0 0;background:#16241f center/cover no-repeat;overflow:hidden}.ph b{position:absolute;left:14px;bottom:8px;z-index:1;font-family:'IBM Plex Mono',monospace;font-size:.7rem;letter-spacing:.12em;color:#C5A56A;font-weight:500}.cred{text-align:center;color:#6E847B;font-size:.66rem;margin:6px 0 0}.empty{color:#8FA39B;font-size:.8rem;padding:6px 0}.add{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}.add input,.add select,.add textarea,.set input,.set select{background:#0C1413;border:1px solid #2E4540;color:#F2EFE6;border-radius:10px;padding:9px 10px;font:inherit;font-size:.88rem;min-width:0}.add textarea{flex:1 1 100%;min-height:44px;resize:vertical}.add input.g{flex:1}" +
  ".btn{background:#C5A56A;color:#0C1413;border:0;border-radius:10px;padding:9px 14px;font:inherit;font-weight:600;font-size:.85rem;cursor:pointer;min-height:40px}.btn.s{background:#0E1918;color:#CFD8D3;border:1px solid #2E4540;font-weight:500}" +
  ".chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px}.chips button.on{border-color:#C5A56A;color:#F2EFE6}.chips button{border:1px solid #2E4540;background:#0C1413;color:#CFD8D3;border-radius:99px;padding:7px 12px;font:inherit;font-size:.78rem;cursor:pointer}" +
  ".set label{display:block;font-size:.72rem;color:#8FA39B;margin:10px 0 4px;font-family:'IBM Plex Mono',monospace}.set input,.set select{width:100%;box-sizing:border-box}.wr{display:flex;gap:6px;margin-top:6px}.wr input{flex:1}.note{color:#8FA39B;font-size:.72rem;margin-top:10px;line-height:1.5}.toast{position:fixed;left:50%;bottom:84px;transform:translateX(-50%);background:#16241f;border:1px solid #C5A56A;color:#F2EFE6;border-radius:12px;padding:10px 14px;font-size:.84rem;max-width:88%;display:none;z-index:50}";

function fitPageHtml(o) {
  const keyJs = JSON.stringify(o.key || "").replace(/</g, "\\u003c");
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta name="theme-color" content="#0C1413"><title>Momo</title><link rel="icon" href="/naj_icon.svg">' + (o.fonts || "") +
    '<style>:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#0C1413;color:#E6E9E4;font-family:"IBM Plex Sans",system-ui,sans-serif}' + FIT_CSS + (o.navCss || "") + '</style></head><body><div class="fw">' +
    '<div class="hero" data-img="hero"><div class="ht"><h1 class="ft">Momo</h1><div class="fsub" id="sub">&nbsp;</div></div></div><div class="chips" id="usr" style="margin:0 0 4px"></div>' +
    '<div class="fc" id="ch"></div>' +
    '<div class="dn"><button id="prev" aria-label="Previous day">&#8249;</button><span id="dl"></span><button id="next" aria-label="Next day">&#8250;</button></div><div class="strip" id="strip"></div>' +
    '<div class="fc"><div class="ph" data-img="food"><b>FOOD</b></div><div id="food"></div><div class="note" id="win"></div>' +
    '<div class="add"><textarea id="ft" placeholder="What did you eat or drink?" maxlength="140"></textarea><label class="btn s" for="ph" style="display:inline-flex;align-items:center">&#128247; Photo</label><input id="ph" type="file" accept="image/*" hidden><button class="btn" id="fa">Add food</button></div>' +
    '<div class="note">A photo is read once and thrown away. Only the description is kept.</div></div>' +
    '<div class="fc"><div class="ph" data-img="exercise"><b>EXERCISE</b></div><div id="ex"></div>' +
    '<div class="chips" id="chips"></div><div class="add"><input class="g" id="et" placeholder="Activity" maxlength="40"><input id="en" type="number" inputmode="decimal" min="0" step="any" placeholder="min" style="width:84px"><select id="eu"><option value="m">min</option><option value="h">hours</option><option value="s">steps</option></select><button class="btn" id="ea">Add</button></div></div>' +
    '<details class="fc" id="hist"><summary style="cursor:pointer;color:#C5A56A;font-family:\'IBM Plex Mono\',monospace;font-size:.7rem;letter-spacing:.12em">PROGRESS &middot; DAY BY DAY, WEEK BY WEEK</summary><div class="ph" data-img="walk" style="margin:12px 0 10px;border-radius:12px;height:104px;background-position:center 76%"><b>EVERY STEP COUNTS</b></div><div class="chips" id="hv"></div><div id="hb"></div></details>' +
    '<details class="fc set" id="set"><summary style="cursor:pointer;color:#C5A56A;font-family:\'IBM Plex Mono\',monospace;font-size:.7rem;letter-spacing:.12em">THE PLAN</summary>' +
    '<label>END GOAL</label><input id="s_goal" maxlength="200" placeholder="What is this 30 days for?"><label>CHALLENGE STARTS</label><input id="s_start" type="date"><label>CHALLENGE LENGTH (DAYS)</label><input id="s_days" type="number" min="1" max="365">' +
    '<label>WEEKLY TARGET (HOURS) - CARRIES OVER UNTIL YOU SET IT ON A SUNDAY</label><input id="s_week" type="number" min="0" step="0.5"><label>DAILY FLOOR: WORKOUT MINUTES</label><input id="s_min" type="number" min="5">' +
    '<label>DAILY FLOOR: OR THIS MANY STEPS (0 = OFF)</label><input id="s_steps" type="number" min="0"><label>FEEDBACK TONE</label><select id="s_tone"><option value="kind">Kind</option><option value="firm">Firm</option><option value="brutal">Brutal</option></select>' +
    '<label>EATING WINDOWS (NAME, FROM, TO)</label><div id="s_win"></div>' +
    '<div class="add"><button class="btn" id="save">Save the plan</button><button class="btn s" id="ext">Extend +30 days</button></div></details>' +
    '<div class="cred">Photos: Pexels</div><div class="toast" id="toast"></div></div>' + (o.nav || "") +
    '<script>' + FIT_JS.replace("__KEY__", keyJs) + '</script></body></html>';
}

// the page's script. No template literals and no ${ in here: it is spliced into a string above.
const FIT_JS = "(function(){var KEY=__KEY__;var S={d:null,data:null,u:null};try{S.u=localStorage.getItem('fit_u')||null}catch(e){}var $=function(i){return document.getElementById(i)};" +
  "function img(n){return 'url(/fit_img/'+n+'.jpg?key='+encodeURIComponent(KEY)+')'}" +
  "function api(method,body,q){var u='/fit_api?key='+encodeURIComponent(KEY)+(S.u?'&u='+encodeURIComponent(S.u):'')+(q||'');return fetch(u,{method:method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined}).then(function(r){return r.json()})}" +
  "function say(t){var e=$('toast');e.textContent=t;e.style.display='block';clearTimeout(say.t);say.t=setTimeout(function(){e.style.display='none'},3200)}" +
  "function fm(m){m=Math.round(m||0);if(m<60)return m+' min';var h=Math.floor(m/60),r=m%60;return r?h+'h'+(r<10?'0':'')+r:h+'h'}" +
  "function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}" +
  "function hm(ms){var d=new Date(ms+4*3600000);return d.toISOString().slice(11,16)}" +
  "function dlab(d,today){if(d===today)return 'Today';var a=new Date(d+'T00:00:00Z');return a.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'})}" +
  "function bar(p,ok){var b=el('div','bar'),i=el('i',ok?'ok':'');i.style.width=Math.max(0,Math.min(100,p))+'%';b.appendChild(i);return b}" +
  "function pills(j){var o=$('usr');o.textContent='';if(!j.users||j.users.length<2)return;var lb=el('span',null,'Whose log:');lb.style.cssText='color:#8FA39B;font-size:.72rem;align-self:center;margin-right:2px';o.appendChild(lb);j.users.forEach(function(n){var b=el('button',n===j.u?'on':null,n.charAt(0).toUpperCase()+n.slice(1));b.onclick=function(){S.u=n;try{localStorage.setItem('fit_u',n)}catch(e){}load()};o.appendChild(b)})}" +
  "function load(d){api('GET',null,d?'&d='+d:'').then(function(j){if(!j.ok)return;S.data=j;S.d=j.d;S.u=j.u;pills(j);draw()})}" +
  "function draw(){var j=S.data,c=j.cfg,st=j.stats,ch=j.challenge;$('sub').textContent=ch&&ch.day?'Day '+Math.min(ch.day,ch.days)+' of '+ch.days:'Log your first entry to start the 30 days';" +
  "var box=$('ch');box.textContent='';box.appendChild(el('h2',null,'THE CHALLENGE'));if(c.goal)box.appendChild(el('div','goal',c.goal));" +
  "if(ch&&ch.day){var r=el('div','row');r.appendChild(el('span',null,'Days hit'));r.appendChild(el('b',null,ch.hit+' of '+Math.min(ch.day,ch.days)+(ch.streak>1?'  ·  streak '+ch.streak:'')));box.appendChild(r);box.appendChild(bar(ch.hit/c.days*100,ch.hit>=c.days));if(ch.over)box.appendChild(el('div','note','The '+c.days+' days are up. Extend it from THE PLAN below.'))}" +
  "var w=el('div','row');w.appendChild(el('span',null,'This week'));w.appendChild(el('b',null,fm(j.week.minutes)+' of '+fm(j.week.target)));box.appendChild(w);box.appendChild(bar(j.week.target?j.week.minutes/j.week.target*100:0,j.week.target&&j.week.minutes>=j.week.target));" +
  "if(new Date(j.today+'T00:00:00Z').getUTCDay()===0&&S.d===j.today){var sb=el('div','add');var si=el('input');si.type='number';si.min='0';si.step='0.5';si.placeholder='Next week target, hours';si.value=Math.round(c.weekMin/6)/10;si.style.flex='1';var sg=el('button','btn','Set');sg.onclick=function(){api('POST',{op:'weektarget',hours:parseFloat(si.value)}).then(function(r){say(r.ok?'Next week: '+fm(r.target.minutes):(r.why||'Could not save'));load(S.d)})};sb.appendChild(si);sb.appendChild(sg);box.appendChild(el('div','note','It is Sunday - this is when the target for next week is set.'));box.appendChild(sb)}" +
  "var q=el('div','row');q.appendChild(el('span',null,'Daily floor ('+c.minDay+' min'+(c.stepsFloor?' or '+c.stepsFloor.toLocaleString()+' steps':'')+')'));q.appendChild(el('b',null,st.qualifies?'✅ done':'⏳ not yet'));box.appendChild(q);" +
  "var wm=j.week.target&&j.week.minutes>=j.week.target;if((st.qualifies&&S.d===j.today)||wm){var wb=el('div','ph');wb.style.cssText='margin:12px 0 0;border-radius:12px;height:96px;background-position:center 22%';wb.style.backgroundImage=img('win');wb.appendChild(el('b',null,wm?'WEEKLY TARGET HIT':'DAILY FLOOR DONE'));box.appendChild(wb)}" +
  "$('dl').textContent=dlab(S.d,j.today);$('next').disabled=S.d>=j.today;$('next').style.opacity=S.d>=j.today?.3:1;" +
  "var sp=$('strip');sp.textContent='';j.strip.forEach(function(x){var b=el('button',x.d===S.d?'on':'');var wd=new Date(x.d+'T00:00:00Z').toLocaleDateString('en-GB',{weekday:'narrow',timeZone:'UTC'});b.appendChild(el('span',null,wd+' '+x.d.slice(8)));b.appendChild(el('span','dot',x.ok?'🟢':(x.d<j.today?'🔴':'⚪')));b.appendChild(el('span',null,fm(x.ex)));b.onclick=function(){load(x.d)};sp.appendChild(b)});" +
  "var f=$('food');f.textContent='';var fe=j.entries.filter(function(e){return e.k==='food'});if(!fe.length)f.appendChild(el('div','empty','Nothing logged yet.'));fe.forEach(function(e){f.appendChild(item(e))});" +
  "$('win').textContent=c.windows.length?'Eating windows: '+c.windows.map(function(w){return w.n+' '+w.a+'–'+w.b}).join('  ·  '):'';" +
  "var x=$('ex');x.textContent='';var xe=j.entries.filter(function(e){return e.k==='ex'});if(!xe.length)x.appendChild(el('div','empty','Nothing logged yet.'));xe.forEach(function(e){x.appendChild(item(e))});" +
  "fillSet(c)}" +
  "function item(e){var r=el('div','it'),b=el('div','x');var t=e.k==='food'?e.x:(e.n?e.n.toLocaleString()+' steps':e.x+' · '+fm(e.m));b.appendChild(document.createTextNode(t));var s=el('small',e.o?'w':null,hm(e.t)+(e.k==='food'&&e.o?'  ·  outside your eating windows':'')+(e.s==='photo'?'  ·  from a photo':''));b.appendChild(s);r.appendChild(b);" +
  "var ed=el('button',null,'✎');ed.onclick=function(){edit(e)};var de=el('button',null,'✕');de.onclick=function(){api('POST',{op:'del',id:e.id}).then(function(){load(S.d)})};r.appendChild(ed);r.appendChild(de);return r}" +
  "function edit(e){var t=prompt(e.k==='food'?'Edit the description':(e.n?'Edit steps':'Edit minutes'),e.k==='food'?e.x:(e.n?e.n:e.m));if(t==null)return;var b={op:'edit',id:e.id};if(e.k==='food')b.text=t;else if(e.n)b.steps=parseInt(t,10);else b.minutes=parseInt(t,10);api('POST',b).then(function(r){if(!r.ok)say(r.why||'Could not save');load(S.d)})}" +
  "$('prev').onclick=function(){var a=new Date(S.d+'T00:00:00Z');a.setUTCDate(a.getUTCDate()-1);load(a.toISOString().slice(0,10))};$('next').onclick=function(){if(S.d>=S.data.today)return;var a=new Date(S.d+'T00:00:00Z');a.setUTCDate(a.getUTCDate()+1);load(a.toISOString().slice(0,10))};" +
  "$('fa').onclick=function(){var t=$('ft').value.trim();if(!t){say('Say what it was');return}api('POST',{op:'add',kind:'food',text:t,d:S.d}).then(function(r){if(!r.ok){say(r.why||'Could not save');return}$('ft').value='';var e=r.entry;load(S.d);if(e.o)say('Logged - but outside your eating windows')})};" +
  "$('ea').onclick=function(){var t=$('et').value.trim(),n=parseFloat($('en').value),u=$('eu').value;if(u==='s'){t=t||'Steps'}if(!t||!(n>0)){say('Give the exercise and a number');return}var b={op:'add',kind:'ex',text:t,d:S.d};if(u==='s')b.steps=Math.round(n);else b.minutes=Math.round(u==='h'?n*60:n);api('POST',b).then(function(r){if(!r.ok){say(r.why||'Could not save');return}$('et').value='';$('en').value='';load(S.d)})};" +
  "var CH=[['Gym','m'],['Walk','m'],['Run','m'],['Steps','s']];CH.forEach(function(c){var b=el('button',null,c[0]==='Steps'?'10,000 steps':c[0]);b.onclick=function(){$('et').value=c[0];$('eu').value=c[1];if(c[0]==='Steps'){$('en').value=S.data&&S.data.cfg.stepsFloor||10000}else{$('en').value='';$('en').focus()}};$('chips').appendChild(b)});" +
  "$('ph').onchange=function(){var f=this.files[0];this.value='';if(!f)return;say('Reading the photo…');var im=new Image();im.onload=function(){var s=Math.min(1,1280/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);c.getContext('2d').drawImage(im,0,0,c.width,c.height);c.toBlob(function(bl){fetch('/fit_api?op=photo&key='+encodeURIComponent(KEY),{method:'POST',headers:{'Content-Type':'image/jpeg'},body:bl}).then(function(r){return r.json()}).then(function(r){if(r.ok&&r.meal){$('ft').value=r.meal;say('Check it, then tap Add food')}else say('No food found in that photo')}).catch(function(){say('Could not read the photo')})},'image/jpeg',.8)};im.onerror=function(){say('Could not open that photo')};im.src=URL.createObjectURL(f)};" +
  "function fillSet(c){if(document.activeElement&&$('set').contains(document.activeElement))return;$('s_goal').value=c.goal;$('s_start').value=c.start;$('s_days').value=c.days;$('s_week').value=c.weekMin/60;$('s_min').value=c.minDay;$('s_steps').value=c.stepsFloor;$('s_tone').value=c.tone;var w=$('s_win');w.textContent='';var ws=c.windows.slice();while(ws.length<4)ws.push({n:'',a:'',b:''});ws.forEach(function(x){var r=el('div','wr'),n=el('input'),a=el('input'),b=el('input');n.placeholder='Name';n.value=x.n;a.type='time';a.value=x.a;b.type='time';b.value=x.b;r.appendChild(n);r.appendChild(a);r.appendChild(b);w.appendChild(r)})}" +
  "$('save').onclick=function(){var ws=[].slice.call($('s_win').children).map(function(r){var i=r.querySelectorAll('input');return{n:i[0].value,a:i[1].value,b:i[2].value}}).filter(function(x){return x.n&&x.a&&x.b});" +
  "api('POST',{op:'cfg',cfg:{goal:$('s_goal').value,start:$('s_start').value,days:parseInt($('s_days').value,10),weekMin:Math.round(parseFloat($('s_week').value)*60),minDay:parseInt($('s_min').value,10),stepsFloor:parseInt($('s_steps').value,10)||0,tone:$('s_tone').value,windows:ws}}).then(function(r){say(r.ok?'Plan saved':'Could not save');$('set').open=false;load(S.d)})};" +
  "$('ext').onclick=function(){api('POST',{op:'extend'}).then(function(r){say(r.ok?'Extended to '+r.cfg.days+' days':'Could not extend');load(S.d)})};" +
  "var HV='weeks',HD=null,HN=[['days','Days'],['weeks','Weeks'],['months','Months'],['total','Total']];" +
  "HN.forEach(function(n){var b=el('button',null,n[1]);b.id='hv_'+n[0];b.onclick=function(){HV=n[0];hdraw()};$('hv').appendChild(b)});" +
  "function hload(){api('GET',null,'&view=history').then(function(j){if(!j.ok)return;HD=j;hdraw()})}" +
  "function hrow(l,r,sub,pct,ok,red){var w=el('div','it');var b=el('div','x');b.appendChild(document.createTextNode(l));if(sub)b.appendChild(el('small',red?'w':null,sub));if(pct!=null)b.appendChild(bar(pct,ok));w.appendChild(b);w.appendChild(el('b',null,r));return w}" +
  "function dl(d){return new Date(d+'T00:00:00Z').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'})}" +
  "function hdraw(){if(!HD)return;HN.forEach(function(n){$('hv_'+n[0]).style.borderColor=n[0]===HV?'#C5A56A':''});var o=$('hb');o.textContent='';var t=HD.totals;" +
  "if(HV==='days'){HD.days.slice().reverse().forEach(function(x){var s=(x.steps?x.steps.toLocaleString()+' steps · ':'')+x.meals+' meal'+(x.meals===1?'':'s')+(x.out?' ('+x.out+' outside)':'');o.appendChild(hrow(dl(x.d),(x.ok?'🟢 ':(x.d<HD.today?'🔴 ':'⚪ '))+fm(x.ex),s,null,false,x.out>0))})}" +
  "else if(HV==='weeks'){HD.weeks.slice().reverse().forEach(function(w){var r=fm(w.minutes)+' of '+fm(w.target)+(w.complete?(w.met?' ✅':' ❌'):' ⏳');o.appendChild(hrow('Week of '+dl(w.ws),r,w.hit+' of '+w.days+' days hit'+(w.out?' · '+w.out+' meal'+(w.out===1?'':'s')+' outside windows':''),w.target?w.minutes/w.target*100:0,w.met,w.out>0))})}" +
  "else if(HV==='months'){HD.months.slice().reverse().forEach(function(m){o.appendChild(hrow(m.label,fm(m.minutes),m.hit+' of '+m.days+' days hit'+(m.steps?' · '+m.steps.toLocaleString()+' steps':'')+' · '+m.meals+' meals',m.days?m.hit/m.days*100:0,m.hit===m.days,false))})}" +
  "else{[['Days hit',t.hit+' of '+t.days],['Best streak',t.bestStreak+' days'],['Exercise in total',fm(t.minutes)],['Steps in total',t.steps.toLocaleString()],['Weeks on target',t.weeksMet+' of '+t.weeksDone+' finished'],['Meals logged',String(t.meals)],['Outside eating windows',t.out+' of '+t.meals]].forEach(function(r){var w=el('div','row');w.style.padding='7px 0';w.appendChild(el('span',null,r[0]));w.appendChild(el('b',null,r[1]));o.appendChild(w)});o.appendChild(bar(t.days?t.hit/t.days*100:0,t.hit===t.days&&t.days>0));o.appendChild(el('div','note','From '+dl(t.from)+' to '+dl(t.to)))}}" +
  "$('hist').addEventListener('toggle',function(){if(this.open)hload()});" +
  "var _ld=load;load=function(d){_ld(d);if($('hist').open)hload()};" +
  "[].forEach.call(document.querySelectorAll('[data-img]'),function(e){e.style.backgroundImage=img(e.getAttribute('data-img'))});" +
  "load()})();";
