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
// Entry: { u, id, d: "YYYY-MM-DD" (GST), t: ms, k: "food"|"ex"|"w", x: text (or "weight"/"waist" for k "w"), m: minutes, n: steps (a DAY TOTAL: the day keeps the largest),
//          v: a measurement (k "w": kg or cm), o: 1 if outside the eating windows, s: source,
//          p: ROUGH grams of protein in a meal (pr: "rough"), or pr: "none" when it was tried and could not be told; no pr = not tried yet }

import { FIT_IMG, FIT_IMG_TYPE } from "./fit_img.js";
import { FIT_ICONS } from "./fit_icons.js";   // the page icons (Phosphor, MIT), generated
import { FIT_JS, FIT_CSS2 } from "./fit_page.js";   // the page script and the card styles   // the page photos, bundled (scripts/gen_fit_img.mjs; Pexels licence, assets/fit/CREDITS.md)

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
  proteinTarget: 0,     // an optional daily guide in grams, 0 = none. A guide the person sets for themselves; Momo never suggests a number
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
  if ("proteinTarget" in c) out.proteinTarget = intIn(c.proteinTarget, 0, 400, b.proteinTarget);
  if ("windows" in c && Array.isArray(c.windows)) {
    out.windows = c.windows.slice(0, 6).map((w) => ({ n: clip(w && w.n, 20), a: String((w && w.a) || ""), b: String((w && w.b) || "") }))
      .filter((w) => w.n && HM_RX.test(w.a) && HM_RX.test(w.b) && w.a < w.b);
  }
  return out;
}
// ---- who: one instance can serve more than one person -----------------------------------------------------------------
// FIT_USERS = "kendall:971562276093:Dr. Doli,najjuko:971565484397:Black Coffee" (id : WhatsApp number : the name shown on the page; the name is optional and
// is NEVER part of a storage key - the id is, so renaming someone does not move their log). Every entry, setting, target and flag is keyed by the
// person, so two people on one instance never mix. Unset = one person ("me", reached on WA_ALLOWED): exactly the single-user behaviour.
export function fitUsers(env) {
  const out = [];
  for (const part of String((env && env.FIT_USERS) || "").split(",")) {
    const m = /^\s*([a-z0-9]{1,12})\s*:\s*(\d{8,15})?\s*(?::\s*([^:,]{1,24}?))?\s*$/i.exec(part);
    if (m && !out.some((u) => u.id === m[1].toLowerCase())) {
      const u = { id: m[1].toLowerCase(), wa: m[2] || "" }, name = clip(String(m[3] || "").replace(/[^A-Za-z0-9 .'\-]/g, ""), 24);
      if (name) u.name = name;
      out.push(u);
    }
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
const FUTURE_RX = /\b(tomorrow|tonight|later|will|going to|gonna|plan|planning|next|want|wanna|should|need|maybe|could|goal|target|book|booked|at \d|\d\s?(am|pm))\b/i;
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

// ---- rough protein ----------------------------------------------------------------------------------------------------------
// A ROUGH guess for a food diary, for one normal serving of what the label says. It is not exact and it is not nutrition advice, and every place that
// shows it says "rough". A small built-in table answers the common foods for free; only a label the table cannot read goes to the model that already
// reads the meals (no other service). Drinks and foods with none count as 0 g; a label nobody can read is "not estimated" - never a made-up number.
const NUMW = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
const PROTEIN_GROUPS = [   // within a group the largest match counts; the groups add up
  ["meat", [[/\b(chicken|shawarma|tikka|rotisserie|nuggets|wings)\b/i, 30], [/\b(beef|steak|burger|kebab|kofta|lamb|mutton|meatballs?|mince|ribs?|brisket|veal)\b/i, 28], [/\b(fish|salmon|tuna|sea ?bass|hammour|shrimps?|prawns?|seafood|sardines?|cod|tilapia|sushi|sashimi)\b/i, 25], [/\b(turkey|duck|bacon|sausages?|salami|ham|pastrami)\b/i, 18]]],
  ["supp", [[/\b(protein (?:shake|bar|powder|drink)|whey)\b/i, 25]]],
  ["yogurt", [[/\b(greek yogh?urt|skyr|quark|cottage cheese)\b/i, 15], [/\b(yogh?urt|laban|labneh|kefir)\b/i, 8]]],
  ["milk", [[/\b(milk|latte|cappuccino|flat white|mocha|milkshake)\b/i, 8]]],
  ["cheese", [[/\b(halloumi|paneer|cheese|feta|mozzarella|cheddar)\b/i, 10]]],
  ["plant", [[/\b(tofu|tempeh|seitan|edamame)\b/i, 15], [/\b(lentils?|dal|daal|chickpeas?|beans?|ful|foul|falafel|hummus|hommus|peas)\b/i, 10]]],
  ["nuts", [[/\b(almonds?|nuts?|cashews?|walnuts?|pistachios?|peanuts?|peanut butter|seeds?|tahini)\b/i, 6]]],
  ["starch", [[/\b(pizza)\b/i, 18], [/\b(oats?|oatmeal|porridge|granola|muesli|cereal|bread|toast|bagel|croissant|pita|wrap|roti|paratha|naan|sandwich|pastry|cake|cookies?|muffin)\b/i, 6], [/\b(rice|pasta|spaghetti|noodles?|biryani|couscous|quinoa|potato|fries|chips)\b/i, 5]]],
  ["plants", [[/\b(salad|vegetables?|veggies|soup|fruit|apple|banana|berries|strawberr\w*|grapes?|dates?|avocado)\b/i, 2]]]
];
const PROTEIN_ZERO = /\b(water|sparkling|soda water|tea|karak|black coffee|americano|espresso|coffee|juice|lemonade|soda|cola|coke|pepsi|sprite|fanta|energy drink|beverage|sweets?|candy|gum)\b/i;
export function tableProtein(text) {
  const t = String(text || ""); if (!t.trim()) return null;
  let g = 0, hit = false;
  const eggs = /\b(\d+|an?|one|two|three|four|five|six)?\s*(?:large |boiled |fried |scrambled |poached )?eggs?\b/i.exec(t), omelet = /\bomelet(?:te)?s?\b/i.test(t);
  if (omelet) { g += 14; hit = true; } else if (eggs) { const q = eggs[1] ? (NUMW[eggs[1].toLowerCase()] || parseInt(eggs[1], 10) || 2) : 2; g += Math.min(q, 8) * 6; hit = true; }
  for (const [, rows] of PROTEIN_GROUPS) { let best = 0; for (const [rx, n] of rows) if (rx.test(t) && n > best) best = n; if (best) { g += best; hit = true; } }
  if (!hit) return PROTEIN_ZERO.test(t) ? { g: 0, how: "rough" } : null;
  return { g: Math.min(g, 90), how: "rough" };
}
const PROTEIN_SCHEMA = { type: "object", additionalProperties: false, properties: { protein_g: { type: ["integer", "null"] } }, required: ["protein_g"] };
const PROTEIN_SYS = "You give a ROUGH estimate of the protein in one meal or drink from a short description, for a person's own food diary. Assume one normal serving. Answer in whole grams. Water, tea, black coffee, juice, soda and anything else with no protein is 0. If the description is not food or drink, or you cannot tell, answer null. This is a rough guess, not advice: never refuse.";
// { g, how } an estimate - null: asked and could not tell - undefined: could not ask right now (try again later)
export async function proteinFor(env, deps, text) {
  const t = tableProtein(text); if (t) return t;
  if (!deps || !deps.claudeJSON) return undefined;
  let r; try { r = await deps.claudeJSON(env, PROTEIN_SYS, clip(text, 140), PROTEIN_SCHEMA, deps.CLAUDE_FAST, 80); } catch (e) { return undefined; }
  if (!r) return undefined;
  const n = Math.round(Number(r.protein_g));
  return r.protein_g == null || !(n >= 0 && n <= 150) ? null : { g: n, how: "rough" };
}
function applyProtein(e, est) { if (est === undefined) return e; if (est === null) { e.pr = "none"; delete e.p; } else { e.p = Math.max(0, Math.min(150, Math.round(est.g))); e.pr = "rough"; } return e; }
// meals that were logged before this existed (or when the model was away) get their estimate the first time the day is opened; a few at a time
export async function fitBackfillProtein(env, deps, entries, limit) {
  let n = 0;
  for (const e of entries || []) {
    if (e.k !== "food" || e.pr) continue;
    const est = await proteinFor(env, deps, e.x); if (est === undefined) continue;
    applyProtein(e, est); await putEntry(env, e); if (++n >= (limit || 8)) break;
  }
  return n;
}
export function weekProtein(byDay, ws, cfg) {
  let total = 0, days = 0;
  for (let i = 0; i < 7; i++) { const s = dayStats(byDay[addDays(ws, i)], cfg); if (s.pmeals > 0) { total += s.protein; days++; } }
  return { total, days, avg: days ? Math.round(total / days) : 0 };
}

// ---- storage ----------------------------------------------------------------------------------------------------------
async function putEntry(env, e) {
  const body = JSON.stringify(e);
  await env.MEETINGS.put("fit_" + e.u + "_" + e.id, body, { metadata: e });   // metadata repeats the entry: a range needs list() only
  return e;
}
export async function fitAdd(env, f) {
  const t = f.t || Date.now(), d = f.d || gstDate(t), kind = f.k === "ex" ? "ex" : f.k === "w" ? "w" : "food";
  const id = f.id && ID_RX.test(String(f.id)) ? String(f.id) : d + "_" + String(t).padStart(10, "0") + "_" + rnd();   // a caller may fix the id so a re-send REPLACES (automatic steps)
  const e = { u: pickUser(env, f.u), id, d, t, k: kind, x: clip(f.x, 140), m: kind === "ex" ? Math.max(0, Math.round(f.m || 0)) : 0, n: kind === "ex" ? Math.max(0, Math.round(f.n || 0)) : 0, s: clip(f.s || "web", 12) };
  if (kind === "w") e.v = Math.round((Number(f.v) || 0) * 10) / 10;
  if (f.o) e.o = 1;
  if (kind === "food" && f.est !== undefined) applyProtein(e, f.est);
  return putEntry(env, e);
}
export async function fitGet(env, id, u) {
  if (!ID_RX.test(String(id))) return null;
  try { return JSON.parse((await env.MEETINGS.get("fit_" + pickUser(env, u) + "_" + id)) || "null"); } catch (e) { return null; }
}
export async function fitDelete(env, id, u) { if (!ID_RX.test(String(id))) return false; await env.MEETINGS.delete("fit_" + pickUser(env, u) + "_" + id); return true; }
export async function fitEdit(env, id, patch, u) {
  const e = await fitGet(env, id, u); if (!e) return null;
  if ("x" in patch) { const nx = clip(patch.x, 140); if (nx && nx !== e.x && e.k === "food") { delete e.p; delete e.pr; } e.x = nx || e.x; }   // a new description needs a new estimate
  if (e.k === "w" && "v" in patch) { const r = MEASURES[e.x]; const v = Math.round((Number(patch.v) || 0) * 10) / 10; if (r && v >= r.lo && v <= r.hi) e.v = v; }
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

// ---- rest days: illness, travel, an injury --------------------------------------------------------------------------------
// A paused day is neither a win nor a miss: it does not break the streak, it is left out of "days hit of N", the verdict says "rest day" instead of
// calling it a failure, and that week's target shrinks in proportion (a week with 2 rest days asks for 5/7 of the target). A pause can start today
// or later, never in the past, so a missed day cannot be hidden afterwards. The 30 calendar days do not move.
export async function fitPausedDates(env, u, from, to) {
  const base = "fitc_pause_" + pickUser(env, u) + "_", out = new Set(); let cursor;
  for (let g = 0; g < 5; g++) {
    const r = await env.MEETINGS.list({ prefix: base, cursor, limit: 1000 });
    for (const k of r.keys || []) { const d = k.name.slice(base.length); if (DATE_RX.test(d) && d >= from && d <= to) out.add(d); }
    if (r.list_complete || !r.cursor) break; cursor = r.cursor;
  }
  return out;
}
export async function fitPause(env, u, today, days, reason) {
  const n = intIn(days, 1, 14, 1), base = "fitc_pause_" + pickUser(env, u) + "_", dates = [];
  for (let i = 0; i < n; i++) { const d = addDays(today, i); await env.MEETINGS.put(base + d, clip(reason, 60) || "rest"); dates.push(d); }
  return dates;
}
export async function fitResume(env, u, today) {
  const base = "fitc_pause_" + pickUser(env, u) + "_"; let n = 0, cursor;
  for (let g = 0; g < 5; g++) {
    const r = await env.MEETINGS.list({ prefix: base, cursor, limit: 1000 });
    for (const k of r.keys || []) { const d = k.name.slice(base.length); if (DATE_RX.test(d) && d >= today) { await env.MEETINGS.delete(k.name); n++; } }
    if (r.list_complete || !r.cursor) break; cursor = r.cursor;
  }
  return n;
}
export async function fitPauseReason(env, u, d) { try { return (await env.MEETINGS.get("fitc_pause_" + pickUser(env, u) + "_" + d)) || ""; } catch (e) { return ""; } }
const scaledTarget = (target, rest) => (rest > 0 ? Math.round(target * Math.max(0, 7 - rest) / 7) : target);

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
  const s = { meals: 0, out: 0, ex: 0, steps: 0, protein: 0, pmeals: 0, qualifies: false };
  for (const e of entries || []) {
    if (e.k === "food") { s.meals++; if (e.o) s.out++; if (e.pr === "rough" && Number.isFinite(e.p)) { s.protein += e.p; s.pmeals++; } }
    else if (e.k === "ex") { if (e.n) s.steps = Math.max(s.steps, e.n); else s.ex += e.m || 0; }   // steps are a total for the day (typed, or sent by the phone): the largest wins, they never add
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
export function challengeStats(byDay, cfg, today, paused) {
  if (!cfg.start) return null;
  const end = addDays(cfg.start, cfg.days - 1);
  if (today < cfg.start) return { start: cfg.start, end, day: 0, days: cfg.days, hit: 0, rest: 0, counted: 0, streak: 0, done: false, over: false };
  const last = today < end ? today : end;
  let hit = 0, streak = 0, run = 0, rest = 0;
  for (let d = cfg.start; d <= last; d = addDays(d, 1)) {
    if (paused && paused.has(d)) { rest++; continue; }   // a rest day is neither a win nor a miss: the run carries over it
    const q = dayStats(byDay[d], cfg).qualifies;
    if (q) { hit++; run++; } else if (d < today) run = 0;   // today may still be won; yesterday's miss resets the run
  }
  streak = run;
  const day = daysBetween(cfg.start, last) + 1;
  return { start: cfg.start, end, day, days: cfg.days, hit, rest, counted: day - rest, streak, done: today >= end, over: today > end };
}
// one read that serves the page, the replies and the evening verdict
export async function fitSummary(env, d, cfg, today) {
  const sFrom = (() => { const hi = addDays(d, 3) < today ? addDays(d, 3) : today; return { from: addDays(hi, -6), to: hi }; })();   // the 7-day strip ends 3 days after the chosen day, never past today
  const wk = weekStart(d), chStart = cfg.start || d, chEnd = cfg.start ? (addDays(cfg.start, cfg.days - 1) < today ? addDays(cfg.start, cfg.days - 1) : today) : d;
  const from = [sFrom.from, wk, chStart, d].sort()[0], to = [sFrom.to, addDays(wk, 6), chEnd, d].sort().slice(-1)[0];
  const all = await fitRange(env, from, to, cfg.u), by = groupByDay(all), paused = await fitPausedDates(env, cfg.u, from, [to, addDays(today, 14)].sort().slice(-1)[0]);   // looks 14 days ahead so booked rest days always show
  const days = []; for (let x = sFrom.from; x <= sFrom.to; x = addDays(x, 1)) { const s = dayStats(by[x], cfg); days.push({ d: x, meals: s.meals, out: s.out, ex: s.ex, steps: s.steps, ok: s.qualifies, rest: paused.has(x) }); }
  const week = weekMinutes(by, d); week.base = await weekTarget(env, cfg, week.start);
  week.rest = 0; for (let i = 0; i < 7; i++) if (paused.has(addDays(week.start, i))) week.rest++;
  week.target = scaledTarget(week.base, week.rest);
  week.protein = weekProtein(by, week.start, cfg);
  return { today, d, entries: by[d] || [], stats: dayStats(by[d], cfg), rest: paused.has(d), strip: days, week, challenge: challengeStats(by, cfg, today, paused), paused: [...paused].filter((x) => x >= today).sort(), by };
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
export async function fitHistory(env, cfg, today, deps) {
  let from = cfg.start && cfg.start <= today ? cfg.start : addDays(today, -29);
  if (from < addDays(today, -400)) from = addDays(today, -400);
  const all = await fitRange(env, from, today, cfg.u);
  await fitBackfillProtein(env, deps, all.filter((e) => e.d >= addDays(today, -14)).sort((a, b) => b.t - a.t), 8);   // the last two weeks, NEWEST first, so the days you look at are done before the older ones
  const by = groupByDay(all), stored = await storedTargets(env, cfg.u), paused = await fitPausedDates(env, cfg.u, from, addDays(today, 14));
  const days = [], weeks = {}, months = {};
  const t = { days: 0, rest: 0, hit: 0, minutes: 0, steps: 0, meals: 0, out: 0, protein: 0, pdays: 0, bestStreak: 0, weeksMet: 0, weeksDone: 0, from, to: today };
  let run = 0;
  for (let d = from; d <= today; d = addDays(d, 1)) {
    const s = dayStats(by[d], cfg), ok = s.qualifies, rest = paused.has(d);
    days.push({ d, meals: s.meals, out: s.out, ex: s.ex, steps: s.steps, protein: s.protein, pmeals: s.pmeals, ok, rest });
    t.minutes += s.ex; t.steps += s.steps; t.meals += s.meals; t.out += s.out; if (s.pmeals > 0) { t.protein += s.protein; t.pdays++; }
    const ws = weekStart(d), w = weeks[ws] || (weeks[ws] = { ws, from: d, to: d, days: 0, rest: 0, hit: 0, minutes: 0, steps: 0, meals: 0, out: 0, protein: 0, pdays: 0 });
    const mk = d.slice(0, 7), m = months[mk] || (months[mk] = { m: mk, label: MONTHS[parseInt(mk.slice(5), 10) - 1] + " " + mk.slice(0, 4), days: 0, rest: 0, hit: 0, minutes: 0, steps: 0, meals: 0, out: 0 });
    w.to = d; w.minutes += s.ex; w.steps += s.steps; w.meals += s.meals; w.out += s.out; if (s.pmeals > 0) { w.protein += s.protein; w.pdays++; }
    m.minutes += s.ex; m.steps += s.steps; m.meals += s.meals; m.out += s.out;
    if (rest) { t.rest++; w.rest++; m.rest++; continue; }   // a rest day is not a day to be judged: it is left out of "days hit of N" and it does not break the run
    t.days++; w.days++; m.days++;
    if (ok) { t.hit++; w.hit++; m.hit++; run++; if (run > t.bestStreak) t.bestStreak = run; } else if (d < today) run = 0;
  }
  const wl = Object.values(weeks).sort((a, b) => (a.ws < b.ws ? -1 : 1));
  for (const w of wl) {
    w.base = carryTarget(stored, w.ws, cfg.weekMin);
    let rest = 0; for (let i = 0; i < 7; i++) if (paused.has(addDays(w.ws, i))) rest++;
    w.target = scaledTarget(w.base, rest);
    w.complete = addDays(w.ws, 6) < today;   // the week is over only once its Sunday has passed
    w.met = w.target > 0 && w.minutes >= w.target;
    w.pavg = w.pdays ? Math.round(w.protein / w.pdays) : 0;
    if (w.complete) { t.weeksDone++; if (w.met) t.weeksMet++; }
  }
  t.pavg = t.pdays ? Math.round(t.protein / t.pdays) : 0;
  return { today, cfg, days, weeks: wl, months: Object.values(months).sort((a, b) => (a.m < b.m ? -1 : 1)), totals: t, measures: fitMeasures(all) };
}
// ---- weight and waist (optional; nothing asks for them) ---------------------------------------------------------------------
// The challenge has an end goal but nothing measures it. "momo weight 82.5" / "momo waist 90" keep the last reading of each day.
export const MEASURES = { weight: { unit: "kg", lo: 20, hi: 400 }, waist: { unit: "cm", lo: 30, hi: 250 } };
export function fitMeasures(entries) {
  const by = {};
  for (const e of entries || []) if (e.k === "w" && MEASURES[e.x]) (by[e.x] = by[e.x] || []).push(e);
  const out = {};
  for (const [what, list] of Object.entries(by)) {
    list.sort((a, b) => a.t - b.t);
    const perDay = {}; for (const e of list) perDay[e.d] = e;
    const series = Object.values(perDay).sort((a, b) => (a.d < b.d ? -1 : 1));
    out[what] = { unit: MEASURES[what].unit, first: series[0].v, latest: series[series.length - 1].v, change: Math.round((series[series.length - 1].v - series[0].v) * 10) / 10, count: series.length, series: series.slice(-8).map((e) => ({ d: e.d, v: e.v, id: e.id })) };
  }
  return out;
}
const sgn = (n) => (n > 0 ? "+" : n < 0 ? "-" : "") + Math.abs(n);
const wd = (d) => new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
const dm = (d) => new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
function weekText(cfg, sum) {
  const ws = sum.week.start, L = ["📅 This week (" + dm(ws) + " - " + dm(addDays(ws, 6)) + ")"];
  for (let i = 0; i < 7; i++) {
    const d = addDays(ws, i), s = dayStats(sum.by[d], cfg), future = d > sum.today, rest = sum.paused && sum.paused.includes(d) || (sum.restDays && sum.restDays.has && sum.restDays.has(d));
    L.push(wd(d) + " " + (rest ? "⏸" : future ? "·" : s.qualifies ? "✅" : d === sum.today ? "⏳" : "❌") + (future ? "" : " " + fmtMin(s.ex) + (s.steps ? " + " + fmtSteps(s.steps) + " steps" : "") + " · " + s.meals + " meal" + (s.meals === 1 ? "" : "s") + (s.out ? " (" + s.out + " outside)" : "")));
  }
  L.push("", "Week: " + fmtMin(sum.week.minutes) + " of " + fmtMin(sum.week.target) + (sum.week.target && sum.week.minutes >= sum.week.target ? " ✅" : ""));
  return L.join("\n");
}
function historyText(h) {
  const t = h.totals, L = ["📈 " + (h.cfg.start ? "Since " + dm(h.cfg.start) : "Last " + t.days + " days") + " · " + t.days + " days"];
  L.push("Days hit: " + t.hit + " of " + t.days + (t.rest ? " (" + t.rest + " rest day" + (t.rest === 1 ? "" : "s") + " left out)" : "") + " · best streak " + t.bestStreak);
  L.push("Exercise: " + fmtMin(t.minutes) + (t.steps ? " · " + fmtSteps(t.steps) + " steps" : ""));
  L.push("Weeks on target: " + t.weeksMet + " of " + t.weeksDone + " finished · meals outside windows: " + t.out + " of " + t.meals);
  for (const [what, m] of Object.entries(h.measures || {})) L.push((what === "weight" ? "⚖️ Weight: " : "📏 Waist: ") + m.latest + " " + m.unit + (m.count > 1 ? " (" + sgn(m.change) + " " + m.unit + " since the first reading)" : " (first reading)"));
  if (t.pdays) L.push("Protein: about " + t.pavg + " g a day on days with logged meals (rough estimate, not nutrition advice)");
  L.push("");
  for (const w of h.weeks.slice(-8)) L.push("Wk " + dm(w.ws) + ": " + fmtMin(w.minutes) + " of " + fmtMin(w.target) + (w.complete ? (w.met ? " ✅" : " ❌") : " ⏳") + " · " + w.hit + "/" + w.days + " days" + (w.rest ? " · " + w.rest + " rest" : ""));
  return L.join("\n");
}

// ---- sharing the week and the streak (mutual opt-in) --------------------------------------------------------------------
// Only counts are shared, never what anyone ate. You see the other person's week and streak only if BOTH of you switched it on ("momo share on").
export async function fitShareOn(env, u) { try { return !!(await env.MEETINGS.get("fitc_share_" + pickUser(env, u))); } catch (e) { return false; } }
export async function fitSetShare(env, u, on) { const k = "fitc_share_" + pickUser(env, u); if (on) await env.MEETINGS.put(k, "1"); else await env.MEETINGS.delete(k); return !!on; }
const niceName = (x) => x.name || x.id.charAt(0).toUpperCase() + x.id.slice(1);
export async function fitPartners(env, cfg, today) {
  if (!(await fitShareOn(env, cfg.u))) return [];
  const out = [];
  for (const p of fitUsers(env)) {
    if (p.id === cfg.u || !(await fitShareOn(env, p.id))) continue;
    const pc = await fitCfg(env, p.id), ps = await fitSummary(env, today, pc, today), ch = ps.challenge;
    out.push({ id: p.id, name: niceName(p), week: ps.week.minutes, target: ps.week.target, streak: ch ? ch.streak : 0, hit: ch ? ch.hit : 0, counted: ch ? ch.counted : 0, today: ps.stats.qualifies });
  }
  return out;
}
export const partnerLine = (p) => "🤝 " + p.name + ": " + fmtMin(p.week) + " of " + fmtMin(p.target) + " this week" + (p.streak > 1 ? " · streak " + p.streak : "") + (p.today ? " · today done" : "");

// ---- Sunday, the long look: this week against the last, the best day, the days missed, the weekday that keeps going wrong ----
function sundayExtras(cfg, sum, today) {
  const L = [], ws = sum.week.start, DN = ["Sundays", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays"];
  const paused = new Set(sum.paused || []);
  if (cfg.start && cfg.start < ws) {
    const lw = weekMinutes(sum.by, addDays(ws, -7)), diff = sum.week.minutes - lw.minutes;
    L.push("📈 Against last week: " + (diff === 0 ? "level" : (diff > 0 ? "+" : "-") + fmtMin(Math.abs(diff))) + " (" + fmtMin(lw.minutes) + " then, " + fmtMin(sum.week.minutes) + " now)");
  }
  let best = null; const missed = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(ws, i); if (d > today) break;
    const s = dayStats(sum.by[d], cfg);
    if (s.ex > 0 && (!best || s.ex > best.ex)) best = { d, ex: s.ex };
    if (!s.qualifies && !paused.has(d) && d >= (cfg.start || ws)) missed.push(wd(d));
  }
  if (best) L.push("🏅 Best day: " + wd(best.d) + ", " + fmtMin(best.ex));
  if (missed.length) L.push("❌ Missed: " + missed.join(", "));
  const tally = {};
  for (let d = cfg.start || today; d < today; d = addDays(d, 1)) {
    if (paused.has(d)) continue;
    const k = new Date(d + "T00:00:00Z").getUTCDay(), t = tally[k] || (tally[k] = { n: 0, hit: 0 });
    t.n++; if (dayStats(sum.by[d], cfg).qualifies) t.hit++;
  }
  let worst = null; for (const [k, t] of Object.entries(tally)) if (t.n >= 3 && t.hit / t.n <= 0.34 && (!worst || t.hit / t.n < worst.r)) worst = { k: +k, r: t.hit / t.n, hit: t.hit, n: t.n };
  if (worst) L.push("🔎 Pattern: you tend to miss " + DN[worst.k] + " (" + worst.hit + " of " + worst.n + "). Plan that day first next week.");
  return L;
}

// ---- export: everything one person has logged, as a spreadsheet ------------------------------------------------------------
const csvCell = (v) => { let t = String(v == null ? "" : v); if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };   // a leading = + - @ would run as a formula in a spreadsheet
export async function fitCsv(env, cfg, today) {
  const from = cfg.start && cfg.start <= today ? (cfg.start < addDays(today, -400) ? addDays(today, -400) : cfg.start) : addDays(today, -400);
  const rows = [["date", "time_gst", "kind", "what", "minutes", "steps", "value", "outside_eating_window", "source", "protein_g_rough"]];
  for (const e of await fitRange(env, from, today, cfg.u)) rows.push([e.d, gstHM(e.t), e.k === "ex" ? "exercise" : e.k === "w" ? "measurement" : "food", e.x, e.k === "ex" && !e.n ? e.m : "", e.n || "", e.k === "w" ? e.v : "", e.k === "food" ? (e.o ? "yes" : "no") : "", e.s, e.k === "food" && e.pr === "rough" ? e.p : ""]);
  return rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
}
// ---- is it working? one look at when things last happened ----------------------------------------------------------------
export async function fitHealth(env, cfg, today) {
  const g = async (k) => { try { return (await env.MEETINGS.get(k)) || null; } catch (e) { return null; } };
  const recent = await fitRange(env, addDays(today, -30), today, cfg.u);
  const last = recent.length ? recent[recent.length - 1] : null;
  return { u: cfg.u, today, entries_30d: recent.length, last_entry: last ? { d: last.d, at: new Date(last.t).toISOString(), source: last.s } : null,
    evening_check_last_ran: await g("fitc_lastrun"), verdict_last_sent_for_day: await g("fitc_lastsent_" + cfg.u), steps_token_set: !!env.FIT_TOKEN, nudge_template_set: !!env.LOG_NUDGE_TEMPLATE };
}

// ---- how it talks -----------------------------------------------------------------------------------------------------
// kind: gentle. firm: plain and direct. brutal: no padding - and still about what was DONE, never about who the person is.
const SAY = {
  dayDone: {
    kind: ["Today's minimum is done. Well done.", "That is today's floor cleared - lovely.", "Done for the day: you showed up. Well done."],
    firm: ["Minimum done. That is the standard - repeat it tomorrow.", "Floor cleared. This is what the plan asks, every day.", "Done. Now do the same tomorrow without being asked."],
    brutal: ["Floor cleared. That is the bare minimum, so do not get comfortable.", "Minimum met. Anyone can do it once - tomorrow is the test.", "Done - and it was the least you promised. Keep going."]
  },
  weekDone: {
    kind: ["🎉 Weekly target hit - a brilliant week.", "🎉 You hit the week's target. Be proud of that.", "🎉 Target met for the week - lovely work."],
    firm: ["🎉 Weekly target hit. This is what sticking to the plan looks like.", "🎉 Week's target reached. That is consistency, not luck.", "🎉 Target hit. Set the next one on Sunday and go again."],
    brutal: ["🎉 Weekly target hit. Now do it again - one week proves nothing.", "🎉 Target hit. It only counts if next week looks the same.", "🎉 You did the week. Do not let it be a one-off."]
  },
  dayPass: {
    kind: ["Great day - minimum done and meals on plan.", "A lovely day: you moved and you ate to plan.", "Movement done, meals in their windows - a good day."],
    firm: ["Good day. Minimum done, meals in their windows. That is the plan working.", "On plan today: the floor and the windows both held.", "Solid day. Floor met, every meal inside its window."],
    brutal: ["Clean day. Minimum done and every meal in its window. Exactly what was promised - now repeat it.", "Nothing to criticise today. Floor met, windows held. Do it again.", "Clean sheet. That is the standard, not a bonus."]
  },
  mixed: {
    kind: ["Movement done - {out} meal{s} outside your windows. Easy to fix tomorrow.", "You moved, which counts - just {out} meal{s} outside the windows. Tomorrow is a fresh go.", "Floor met, with {out} meal{s} outside your windows. A small thing to tidy up."],
    firm: ["Movement done, but {out} meal{s} outside your eating windows. Half a win - the windows are part of the plan.", "You moved, yet {out} meal{s} outside the windows. Fix the timing tomorrow.", "Floor met; {out} meal{s} outside the windows keep this from a clean day."],
    brutal: ["You moved, but {out} meal{s} landed outside your eating windows. The windows were your rule and you broke them. Half a win is still half a miss.", "Floor met, {out} meal{s} outside the windows. You set that rule yourself - hold to it.", "Movement done and {out} meal{s} outside the windows. Do not call that a clean day."]
  },
  dayFail: {
    kind: ["Today's movement did not happen. Tomorrow is a fresh start - and even {steps} steps counts.", "No movement today - it happens. Even {steps} steps would have counted; try again tomorrow.", "Today slipped. Be kind to yourself and take the {steps}-step option tomorrow if nothing else."],
    firm: ["You missed today: no {min}-minute workout and no {steps} steps. There was always an option and none was taken. Tomorrow starts the moment you wake up.", "You missed today: nothing hit the {min}-minute floor and the {steps} steps never happened. The option was there. Take it tomorrow, early.", "You missed today. No {min} minutes, no {steps} steps - and both were on offer. Reset tomorrow and do not negotiate with it."],
    brutal: ["Today was weak. No workout, and not even the {steps} steps that existed for exactly this day. String days like this together and you will be heavier and slower by next month - by your own choice. Fix it tomorrow.", "Weak day. No workout and not even {steps} steps - the one thing that was always available. Keep doing this and you will be heavier and slower by next month, and nobody did that to you. Fix it tomorrow.", "Nothing today. The {steps}-step floor exists so you have no excuse, and you still did not meet it. Repeat this often enough and you will be heavier and slower - your decision. Tomorrow, first thing."]
  },
  weekMiss: {
    kind: ["Weekly target missed this time ({got} of {want}). New week, new start.", "The week fell short ({got} of {want}) - set a fair target on Sunday and begin again.", "Not this week ({got} of {want}). Next week is yours."],
    firm: ["Weekly target missed: {got} of {want}. Look at which days were skipped and close that gap next week.", "Weekly target missed: {got} of {want}. The gap is in the days you skipped - plan those first next week.", "Weekly target missed: {got} of {want}. Be honest about why, then fix that one thing."],
    brutal: ["Weekly target missed: {got} of {want}. The days you skipped are the gap. Close it next week or stop calling it a target.", "Weekly target missed: {got} of {want}. A target you do not hit is just a wish - hit the next one.", "Weekly target missed: {got} of {want}. You know exactly which days did it. Do not repeat them."]
  },
  rest: {
    kind: ["⏸ Rest day{why}. No judgement - rest is part of it. Back tomorrow.", "⏸ A day off{why}. Look after yourself; the plan will be here."],
    firm: ["⏸ Rest day{why}. It does not count against you. Back at it tomorrow.", "⏸ Paused{why}. No miss recorded. Resume tomorrow."],
    brutal: ["⏸ Rest day{why}. Granted - but it is a pause, not a holiday. Back tomorrow.", "⏸ Paused{why}. Recorded as rest, not as a win. Tomorrow you are back."]
  }
};
// one of several lines, chosen by person + day + situation: the same day always says the same thing, tomorrow says something else
export function say(cfg, key, vars, day) {
  const v = SAY[key] && (SAY[key][cfg.tone] || SAY[key].firm), arr = Array.isArray(v) ? v : [v || ""];
  let h = 0; for (const ch of String((cfg.u || "") + (day || "") + key)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return String(arr[h % arr.length]).replace(/\{(\w+)\}/g, (_, k) => (vars && k in vars ? vars[k] : ""));
}
const sayVars = (cfg, extra) => Object.assign({ steps: fmtSteps(cfg.stepsFloor), min: cfg.minDay }, extra || {});

// the one-line state of the day, week and challenge - appended to every acknowledgement
function stateLines(cfg, sum) {
  const st = sum.stats, L = [];
  if (st.pmeals > 0) L.push("Protein today: about " + st.protein + (cfg.proteinTarget ? " of " + cfg.proteinTarget : "") + " g (rough)");
  L.push("Today: " + st.meals + " meal" + (st.meals === 1 ? "" : "s") + " · " + fmtMin(st.ex) + (st.steps ? " · " + fmtSteps(st.steps) + " steps" : ""));
  L.push(sum.rest ? "⏸ Rest day - not counted against you" : st.qualifies ? "✅ Daily minimum done" : "⏳ Still needed: " + cfg.minDay + " min of exercise" + (cfg.stepsFloor ? " or " + fmtSteps(cfg.stepsFloor) + " steps" : ""));
  if (sum.week.target) L.push("Week: " + fmtMin(sum.week.minutes) + " of " + fmtMin(sum.week.target));
  const ch = sum.challenge; if (ch && ch.day) L.push("Challenge: day " + Math.min(ch.day, ch.days) + " of " + ch.days + " · " + ch.hit + " days hit" + (ch.streak > 1 ? " · streak " + ch.streak : "") + (ch.rest ? " · " + ch.rest + " rest" : ""));
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
  const est = f.k === "food" ? (Number.isFinite(f.p) && f.p >= 0 && f.p <= 150 ? { g: f.p, how: "rough" } : await proteinFor(env, deps, f.x)) : undefined;   // the table first, the model only when it cannot tell
  const e = await fitAdd(env, { u, k: f.k, x: f.x, m: f.m, n: f.n, t, d, o, s: f.s, est });
  const today = gstDate(now), sum = await fitSummary(env, d, cfg, today);
  let head;
  if (e.k === "food") head = "🍽 Logged - " + e.x + (off ? " (" + (off === -1 ? "yesterday" : "2 days ago") + ")" : "") + (win ? " · " + win : "");
  else if (e.n) head = "👟 Logged - " + fmtSteps(e.n) + " steps" + (off ? " (" + (off === -1 ? "yesterday" : "2 days ago") + ")" : "");
  else head = "🏃 Logged - " + e.x + " · " + fmtMin(e.m) + (off ? " (" + (off === -1 ? "yesterday" : "2 days ago") + ")" : "");
  const parts = [head];
  if (o) parts.push("⚠ That is outside your eating windows (" + windowsText(cfg) + ").");
  if (e.k === "food") parts.push(e.pr === "rough" ? "About " + e.p + " g protein (rough estimate)" : e.pr === "none" ? "Protein: not estimated" : "Protein: not estimated yet");
  parts.push("", stateLines(cfg, sum));
  // positive reinforcement the moment a target is reached, once each
  if (e.k === "ex" && sum.stats.qualifies && await flagOnce(env, "fitc_flag_" + u + "_" + d + "_day")) parts.push("", "✅ " + say(cfg, "dayDone", sayVars(cfg), d));
  if (e.k === "ex" && sum.week.target && sum.week.minutes >= sum.week.target && await flagOnce(env, "fitc_flag_" + u + "_" + sum.week.start + "_week")) parts.push("", say(cfg, "weekDone", sayVars(cfg), sum.week.start));
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
  minutes: { type: ["integer", "null"] }, steps: { type: ["integer", "null"] }, day_offset: { type: "integer" }, protein_g: { type: ["integer", "null"] } },
  required: ["kind", "text", "type", "minutes", "steps", "day_offset", "protein_g"] };
async function classify(env, deps, text) {
  const sys = "You log food and exercise for one person. Decide whether the message reports something ALREADY eaten, drunk or done (past tense or just now).\n" +
    "- \"food\": a meal, snack or drink. text = what was eaten, plain, under 100 characters, no calories, no judgement.\n" +
    "- \"exercise\": a workout, sport, walk or step count. type = a short label (Gym, Walk, Run, Padel, Steps...). minutes = total minutes as an integer (1 hour = 60), null when no duration is given. For a step count use type \"Steps\" and steps = the number, minutes null.\n" +
    "- \"other\": anything else - plans, questions, meetings (\"lunch with Sara on Friday\"), tasks, future intent (\"gym tomorrow at 6\"), bookings, anything not yet done.\n" +
    "protein_g: for food, a ROUGH whole-number guess of the grams of protein in one normal serving (0 for water, tea, black coffee, juice, soda); null for exercise, other, or when you cannot tell.\n" +
    "day_offset: 0 for today, -1 when the message says yesterday, -2 for the day before. Output ONLY the JSON.";
  const g = deps.claudeJSON ? await deps.claudeJSON(env, sys, text, CLASS_SCHEMA, deps.CLAUDE_FAST, 250) : null;
  return g && g.kind ? g : null;
}
function statusText(cfg, sum, partners) {
  const L = ["📊 " + (sum.d === sum.today ? "Today" : sum.d), stateLines(cfg, sum)];
  if (cfg.goal) L.push("Goal: " + cfg.goal);
  for (const p of partners || []) L.push(partnerLine(p));
  if (sum.paused && sum.paused.length) L.push("⏸ Rest days booked: " + sum.paused.map(dm).join(", "));
  const ents = sum.entries.slice(-8).map((e) => (e.k === "food" ? "🍽 " + e.x + (e.o ? " ⚠" : "") : e.k === "w" ? "⚖️ " + e.x + " " + e.v + " " + (MEASURES[e.x] || {}).unit : e.n ? "👟 " + fmtSteps(e.n) + " steps" : "🏃 " + e.x + " " + fmtMin(e.m)));
  if (ents.length) L.push("", ents.join("\n"));
  if (sum.today === sum.d && new Date(sum.today + "T00:00:00Z").getUTCDay() === 0) L.push("", SUNDAY_ASK(cfg, sum.week.target));
  L.push("", "Open Momo in the bottom bar for the full view.");
  return L.join("\n");
}
const HELP_TEXT = "Momo - just say it and it is logged. (Protein figures are rough estimates, not nutrition advice.)\nfood: grilled chicken and rice (or send a photo of the plate)\ngym 45 min · 10k steps\n\nmomo - today · momo today (what you ate, with rough protein) · momo week · momo history\nmomo again (repeat your last meal) · momo undo · momo fix <the right text or number>\nmomo pause [days] [why] · momo resume\nmomo weight 82.5 · momo waist 90\nmomo target 10 · momo protein 120 (an optional guide; momo protein off removes it) · momo goal <text> · momo tone kind|firm|brutal\nmomo share on|off · momo extend";
function mealsText(cfg, sum) {
  const meals = sum.entries.filter((e) => e.k === "food"), st = sum.stats, L = [(sum.d === sum.today ? "Today" : dm(sum.d)) + " - what you ate"];
  if (!meals.length) L.push("Nothing logged yet.");
  meals.forEach((e, i) => { const w = windowFor(cfg, e.t), where = e.o ? "outside your windows" : w.name; L.push((i + 1) + ". " + gstHM(e.t) + (where ? " " + where : "") + " - " + e.x + " - " + (e.pr === "rough" ? "about " + e.p + " g protein" : "protein not estimated")); });
  if (st.pmeals > 0) L.push("", "Protein so far: about " + st.protein + " g" + (cfg.proteinTarget ? " (your guide: " + cfg.proteinTarget + " g)" : "") + " - rough estimate, not nutrition advice");
  if (sum.week.protein && sum.week.protein.days > 1) L.push("This week: about " + sum.week.protein.avg + " g a day on days with meals (rough)");
  return L.join("\n");
}
const entryText = (e) => (e.k === "food" ? e.x : e.k === "w" ? e.x + " " + e.v + " " + ((MEASURES[e.x] || {}).unit || "") : e.n ? fmtSteps(e.n) + " steps" : e.x + " " + fmtMin(e.m));
async function lastEntry(env, u, today) { const l = await fitRange(env, addDays(today, -2), today, u); return l.length ? l[l.length - 1] : null; }
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
  if (/^\s*(fit|my fit|fit log|fit status|my log|food log)\s*\??\s*$/i.test(text)) { const cfg = await fitCfg(env, U), today = gstDate(Date.now()); const sm = await fitSummary(env, today, cfg, today); let pl = []; try { pl = await fitPartners(env, cfg, today); } catch (e) {} await reply(env, deps, from, statusText(cfg, sm, pl)); return true; }
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
  if (/^\s*fit\s+(today|meals|what i ate)\s*$/i.test(text)) {
    const cfg = await fitCfg(env, U), today = gstDate(Date.now()); let sm = await fitSummary(env, today, cfg, today);
    if (await fitBackfillProtein(env, deps, sm.entries, 8)) sm = await fitSummary(env, today, cfg, today);
    await reply(env, deps, from, mealsText(cfg, sm)); return true;
  }
  if ((c = /^\s*fit\s+protein\s*[:\-–—]?\s*(\d{2,3}|off|none|0)\s*(?:g|grams?)?\s*$/i.exec(text))) {
    const cfg = await fitCfg(env, U), v = /^\d+$/.test(c[1]) ? parseInt(c[1], 10) : 0;
    if (v > 400) { await reply(env, deps, from, "That is out of range - try a number of grams up to 400, or \"momo protein off\"."); return true; }
    cfg.proteinTarget = v; await fitSaveCfg(env, cfg);
    await reply(env, deps, from, v ? "Protein guide set: " + v + " g a day. It is your own guide for comparing against the rough estimates - not nutrition advice." : "Protein guide off."); return true;
  }
  if (/^\s*fit\s+(help|commands|\?)\s*$/i.test(text)) { await reply(env, deps, from, HELP_TEXT); return true; }
  if ((c = /^\s*fit\s+pause\b\s*(\d{1,2})?\s*(.{0,60})$/i.exec(text))) {
    const today = gstDate(Date.now()), days = c[1] ? Math.max(1, Math.min(14, parseInt(c[1], 10))) : 1, dates = await fitPause(env, U, today, days, c[2]);
    await reply(env, deps, from, dates.length === 1 ? "⏸ Today is a rest day. It will not count against you, and the streak holds. \"momo resume\" ends it." : "⏸ Rest days: " + dm(dates[0]) + " to " + dm(dates[dates.length - 1]) + ". They will not count against you, and the streak holds. \"momo resume\" ends it early.");
    return true;
  }
  if (/^\s*fit\s+resume\s*$/i.test(text)) { const n = await fitResume(env, U, gstDate(Date.now())); await reply(env, deps, from, n ? "▶️ Back on. Rest days from today on are cleared." : "Nothing was paused."); return true; }
  if (/^\s*fit\s+undo\s*$/i.test(text)) {
    const today = gstDate(Date.now()), e = await lastEntry(env, U, today);
    if (!e) { await reply(env, deps, from, "Nothing to undo."); return true; }
    await fitDelete(env, e.id, U); await reply(env, deps, from, "↩ Removed - " + entryText(e)); return true;
  }
  if (/^\s*fit\s+again\s*$/i.test(text)) {
    const today = gstDate(Date.now()), meals = (await fitRange(env, addDays(today, -3), today, U)).filter((e) => e.k === "food"), e = meals[meals.length - 1];
    if (!e) { await reply(env, deps, from, "Nothing to repeat yet - log a meal first."); return true; }
    await logEntry(env, deps, from, { k: "food", x: e.x, s: "wa" }); return true;
  }
  if ((c = /^\s*fit\s+fix\s*[:\-–—]?\s*(.{1,140})$/i.exec(text))) {
    const today = gstDate(Date.now()), e = await lastEntry(env, U, today);
    if (!e) { await reply(env, deps, from, "Nothing to fix yet."); return true; }
    const what = c[1].trim(), patch = {}, bare = /^\s*(\d+(?:[.,]\d+)?)\s*$/.exec(what);
    if (e.k === "food") patch.x = what;
    else if (e.k === "w") { if (!bare) { await reply(env, deps, from, "Give the right number, like \"momo fix 82.1\"."); return true; } patch.v = parseFloat(bare[1].replace(",", ".")); }
    else if (e.n) { const n = parseSteps(what) || (bare && parseFloat(bare[1]) >= 100 ? Math.round(parseFloat(bare[1])) : 0); if (!n) { await reply(env, deps, from, "Give the right step count, like \"momo fix 9500 steps\"."); return true; } patch.n = n; }
    else { const dur = parseDuration(what) || (bare && parseFloat(bare[1]) >= 6 ? Math.round(parseFloat(bare[1])) : 0); if (dur) patch.m = dur; else patch.x = what; }
    const up = await fitEdit(env, e.id, patch, U); await reply(env, deps, from, up ? "✏️ Updated - " + entryText(up) : "Could not change that one."); return true;
  }
  if ((c = /^\s*fit\s+share\s*(on|off)\s*$/i.exec(text))) {
    const on = c[1].toLowerCase() === "on"; await fitSetShare(env, U, on);
    await reply(env, deps, from, on ? "🤝 Sharing is ON: only your week and streak (never what you ate). You will see the other person's too once they switch it on." : "Sharing is OFF. Nobody sees your week or streak."); return true;
  }
  if ((c = /^\s*fit\s+(weight|waist)\s*[:\-–—]?\s*(\d+(?:[.,]\d+)?)\s*(?:kg|cm)?\s*$/i.exec(text))) {
    const what = c[1].toLowerCase(), r = MEASURES[what], v = Math.round(parseFloat(c[2].replace(",", ".")) * 10) / 10;
    if (!(v >= r.lo && v <= r.hi)) { await reply(env, deps, from, "That does not look right for " + what + " (" + r.lo + "-" + r.hi + " " + r.unit + ")."); return true; }
    const cfg = await fitCfg(env, U), today = gstDate(Date.now()), e = await fitAdd(env, { u: U, k: "w", x: what, v, d: today, s: "wa" });
    const m = fitMeasures(await fitRange(env, cfg.start && cfg.start < today ? cfg.start : addDays(today, -400), today, U))[what];
    await reply(env, deps, from, (what === "weight" ? "⚖️ Weight " : "📏 Waist ") + v + " " + r.unit + " logged." + (m && m.count > 1 ? "\nSince the first reading: " + sgn(m.change) + " " + r.unit + " (" + m.first + " to " + m.latest + ")." : "\nThat is your first reading - the next ones show the change."), [{ id: "fit:undo:" + U + ":" + e.id, title: "↩ Undo" }]);
    return true;
  }
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
  // ...and a plain "gym 40 min" / "12000 steps" is unambiguous: no model, no cost, no chance of it being called a plan
  if (quick && text.length <= 40 && !FUTURE_RX.test(text)) {
    const off = /\byesterday\b/i.test(text) ? -1 : 0;
    await logEntry(env, deps, from, { k: "ex", x: quick.type, m: quick.minutes, n: quick.steps, s: "wa", off }); return true;
  }
  const g = await classify(env, deps, text);
  if (g) {
    if (g.kind === "other") return false;
    const off = Math.max(-2, Math.min(0, Math.round(g.day_offset || 0)));
    if (g.kind === "food" && clip(g.text, 140)) { await logEntry(env, deps, from, { k: "food", x: g.text, s: "wa", off, p: Number.isFinite(g.protein_g) ? g.protein_g : undefined }); return true; }
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

// ---- a guest: someone in FIT_USERS who is NOT this instance's owner --------------------------------------------------------
// Kendall's number belongs to the older instance (meeting-capture), which forwards ONLY his Momo messages here, exactly as it forwards Najjuko's
// to azimuth-2. The caller has already verified the forward secret. This door takes a sender who is in FIT_USERS with that number and nobody else,
// handles Momo (text, a voice note, a photo, an Undo button) and NOTHING ELSE of Azimuth: no tasks, no meetings, no calendar, no board.
// It also notes when he last wrote, so the 21:00 verdict may go to him while his 24-hour window is open. Returns true when it took the message.
const recentIn = async (env, u) => { try { const t = await env.MEETINGS.get("fitc_in_" + u); return !!t && Date.now() - Date.parse(t) < 23 * 3600 * 1000; } catch (e) { return false; } };
export async function fitGuest(env, from, msg, deps) {
  const d = String(from || "").replace(/\D/g, ""), person = fitUsers(env).find((x) => x.wa && x.wa === d);
  if (!person || !msg) return false;
  if (msg.id) { const k = "wamsg_" + msg.id; if (await env.MEETINGS.get(k)) return true; await env.MEETINGS.put(k, "1", { expirationTtl: 3 * 86400 }); }
  const rule = "Momo handles food and exercise from this number. Try \"food: grilled chicken and rice\", \"gym 40 min\" or \"momo help\".";
  let text = "";
  if (msg.type === "interactive" && msg.interactive && msg.interactive.button_reply) {
    const bid = String(msg.interactive.button_reply.id || "");
    if (bid.indexOf("fit:") !== 0) return false;
    await env.MEETINGS.put("fitc_in_" + person.id, new Date().toISOString(), { expirationTtl: 3 * 86400 });
    return fitButton(env, from, bid, deps);
  }
  if (msg.type === "text" && msg.text) text = String(msg.text.body || "").trim();
  else if (msg.type === "audio" && msg.audio && msg.audio.id && deps.waTranscribe) { try { text = await deps.waTranscribe(env, msg.audio.id); } catch (e) {} if (!text) { await reply(env, deps, from, "I could not read that voice note - try text."); return true; } }
  else if (msg.type === "image" && msg.image && msg.image.id) {
    await env.MEETINGS.put("fitc_in_" + person.id, new Date().toISOString(), { expirationTtl: 3 * 86400 });
    const cap = String(msg.image.caption || "").trim();
    if (await fitPhotoCaptioned(env, from, msg.image.id, cap, deps)) return true;
    try { const m = await deps.waFetchMedia(env, msg.image.id); if (m.bytes.byteLength <= 4 * 1024 * 1024 && deps.readPhoto) { const rd = await deps.readPhoto(env, m.bytes, m.mime, cap); if (await fitPhotoRead(env, from, rd, cap, deps)) return true; } } catch (e) {}
    await reply(env, deps, from, "That did not look like a meal. Add a caption like \"lunch\", or say it: \"food: grilled chicken and rice\"."); return true;
  } else return false;
  if (!text) return false;
  await env.MEETINGS.put("fitc_in_" + person.id, new Date().toISOString(), { expirationTtl: 3 * 86400 });
  if (!(await fitWhatsAppText(env, from, text, deps))) await reply(env, deps, from, rule);
  return true;
}

// ---- WhatsApp: buttons ------------------------------------------------------------------------------------------------
export async function fitButton(env, from, bid, deps) {
  bid = String(bid || "");
  if (bid.indexOf("fit:undo:") === 0) {
    const rest = bid.slice(9), m = /^([a-z0-9]{1,12}):(.+)$/.exec(rest), u = m ? m[1] : fitUserFor(env, from), id = m ? m[2] : rest;
    const e = await fitGet(env, id, u);
    if (e) { await fitDelete(env, e.id, u); await reply(env, deps, from, "↩ Removed - " + entryText(e)); }
    else await reply(env, deps, from, "Already removed.");
    return true;
  }
  if (bid === "fit:extend") { const cfg = await fitCfg(env, fitUserFor(env, from)); cfg.days = Math.min(365, cfg.days + 30); await fitSaveCfg(env, cfg); await reply(env, deps, from, "➕ Challenge extended to " + cfg.days + " days. Keep going."); return true; }
  return false;
}

// ---- the evening verdict (21:00-21:29 GST, once a day, only while the 24-hour window is open) -------------------------
export async function fitEvening(env, deps, nowMs) {
  const hm = gstHM(nowMs); if (hm < "21:00" || hm >= "21:30") return false;
  try { await env.MEETINGS.put("fitc_lastrun", new Date(nowMs).toISOString(), { expirationTtl: 3 * 86400 }); } catch (e) {}   // so /fit_api?view=health can say the check ran
  if (!env.WA_ALLOWED) return false;
  const mine = String(env.WA_ALLOWED).replace(/\D/g, ""); let sent = false;
  for (const user of fitUsers(env)) {
    // the owner of this instance: its own 24-hour window. A forwarded guest (Kendall): the window opened by his last Momo message, which arrived here.
    // Anyone else reads their verdict on the page.
    if (user.wa === mine) { if (await eveningFor(env, deps, nowMs, user.id, user.wa)) sent = true; }
    else if (user.wa && await recentIn(env, user.id)) { if (await eveningFor(env, deps, nowMs, user.id, user.wa, true)) sent = true; }
  }
  return sent;
}
async function eveningFor(env, deps, nowMs, u, to, guestWindowOpen) {
  const cfg = await fitCfg(env, u); if (!cfg.start) return false;
  const today = gstDate(nowMs); if (today < cfg.start) return false;
  const end = addDays(cfg.start, cfg.days - 1); if (today > end) return false;
  // the window check comes BEFORE the once-a-day flag: a closed window must not use up the day's verdict (the next cron tick tries again)
  let open = !!guestWindowOpen; if (!guestWindowOpen) { try { open = deps.ownerWindowOpen ? await deps.ownerWindowOpen(env) : false; } catch (e) {} }
  if (!open) {
    // The 24-hour window is shut. The verdict itself never goes out as a template (it waits on the page). The approved no-variable nudge
    // (LOG_NUDGE_TEMPLATE, off until Meta approves it) may: once a day, and only if nothing has been logged yet today.
    if (env.LOG_NUDGE_TEMPLATE && deps.waSendTemplate) {
      const first = await fitSummary(env, today, cfg, today);
      if (!first.entries.length && await flagOnce(env, "fitc_nudge_" + u + "_" + today)) {
        try { await deps.waSendTemplate(env, to || env.WA_ALLOWED, env.LOG_NUDGE_TEMPLATE, env.LOG_NUDGE_LANG || "en_US", []); } catch (e) {}
        return true;
      }
    }
    return false;
  }
  if (!(await flagOnce(env, "fitc_sent_" + u + "_" + today))) return false;
  const sum = await fitSummary(env, today, cfg, today), st = sum.stats, ch = sum.challenge, V = sayVars(cfg), head = "Day " + ch.day + " of " + cfg.days + " - ";
  const L = [];
  if (sum.rest) { const why = await fitPauseReason(env, u, today); L.push("⏸ " + head + say(cfg, "rest", { why: why && why !== "rest" ? " (" + why + ")" : "" }, today).replace(/^⏸\s*/, "")); }
  else if (!st.qualifies) L.push("🔴 " + head + say(cfg, "dayFail", V, today));
  else if (st.out > 0) L.push("🟡 " + head + say(cfg, "mixed", Object.assign({}, V, { out: st.out, s: st.out === 1 ? "" : "s" }), today));
  else L.push("🟢 " + head + say(cfg, "dayPass", V, today));
  L.push("", stateLines(cfg, sum));
  try { for (const p of await fitPartners(env, cfg, today)) L.push(partnerLine(p)); } catch (e) {}
  if (new Date(today + "T00:00:00Z").getUTCDay() === 0) {   // Sunday: this week is judged, next week is set
    if (sum.week.target) L.push("", sum.week.minutes >= sum.week.target ? say(cfg, "weekDone", V, sum.week.start) : say(cfg, "weekMiss", Object.assign({}, V, { got: fmtMin(sum.week.minutes), want: fmtMin(sum.week.target) }), sum.week.start));
    const extra = sundayExtras(cfg, sum, today); if (extra.length) L.push("", extra.join("\n"));
    if (!(await env.MEETINGS.get("fitc_wk_" + u + "_" + addDays(today, 1)))) L.push("", SUNDAY_ASK(cfg, cfg.weekMin));
  }
  try { await env.MEETINGS.put("fitc_lastsent_" + u, today, { expirationTtl: 30 * 86400 }); } catch (e) {}
  const buttons = [];
  if (today === end) { L.push("", "🏁 Challenge complete: " + ch.hit + " of " + cfg.days + " days hit. Extend it?"); buttons.push({ id: "fit:extend", title: "➕ Extend 30 days" }); }
  await reply(env, deps, to || env.WA_ALLOWED, L.join("\n"), buttons);
  return true;
}

// ---- steps sent by the phone ------------------------------------------------------------------------------------------------
// POST /fit_steps  {"user":"kendall","steps":10234,"date":"2026-10-04"}  with header  X-Momo-Token: <FIT_TOKEN>
// An iPhone Shortcut (README) sends the day's steps from Apple Health each evening. It has its OWN token, not the owner key: the token can write a step
// count and nothing else. Re-sending replaces that day's automatic count (the id is fixed), so the Shortcut can run as often as it likes. Off until FIT_TOKEN is set.
function ctEqual(a, b) { a = String(a || ""); b = String(b || ""); if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }
export async function fitStepsRoute(request, env) {
  if (!env.FIT_TOKEN || String(env.FIT_TOKEN).length < 16) return new Response("not found", { status: 404 });
  if (request.method !== "POST") return J({ ok: false, why: "POST only" }, 405);
  if (!ctEqual(request.headers.get("X-Momo-Token"), env.FIT_TOKEN)) return new Response("unauthorized", { status: 401 });
  let b; try { b = await request.json(); } catch (e) { return J({ ok: false, why: "bad json" }, 400); }
  const user = String((b && b.user) || "").toLowerCase(), steps = Math.round(Number(b && b.steps)), today = gstDate(Date.now());
  if (!fitUsers(env).some((x) => x.id === user)) return J({ ok: false, why: "unknown user" }, 400);
  if (!(steps >= 0 && steps <= 200000)) return J({ ok: false, why: "steps out of range" }, 400);
  const d = DATE_RX.test(String((b && b.date) || "")) ? b.date : today;
  if (d > today || d < addDays(today, -2)) return J({ ok: false, why: "date must be today or one of the last two days" }, 400);
  if (steps < 100) return J({ ok: true, skipped: "under 100 steps - not logged" });
  const idT = Date.parse(d + "T16:00:00Z");   // the id is fixed per day so a re-send replaces it; the entry itself carries the real time
  await fitAdd(env, { u: user, id: d + "_" + String(idT).padStart(10, "0") + "_autosteps", d, t: d === today ? Date.now() : idT, k: "ex", x: "Steps", n: steps, s: "auto" });
  return J({ ok: true, user, date: d, steps });
}

// ---- the page and its API (owner only) --------------------------------------------------------------------------------
const IMG_BYTES = {};
const J = (o, status) => new Response(JSON.stringify(o), { status: status || 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
// h: { keyTier, najNav, NAJ_NAV_CSS, NAJ_FONTS } + the WhatsApp deps (claudeJSON, CLAUDE_FAST, b64of) for the photo upload.
export async function fitRoutes(request, env, url, h) {
  const p = url.pathname, isImg = p.indexOf("/fit_img/") === 0;
  if (p === "/fit_steps") return fitStepsRoute(request, env);   // its own token, not the owner key
  if (p !== "/fit" && p !== "/fit_api" && !isImg) return null;
  if (h.keyTier(env, url) !== "admin") return new Response("not found", { status: 404 });   // a client key, no key, a wrong key: all the same 404
  const key = url.searchParams.get("key") || "";
  if (isImg) {   // the bundled photos, served from the worker itself: the page never asks a third party for anything
    const n = p.slice(9).replace(/\.(jpg|png)$/, "");
    if (!Object.prototype.hasOwnProperty.call(FIT_IMG, n)) return new Response("not found", { status: 404 });
    const bytes = IMG_BYTES[n] || (IMG_BYTES[n] = Uint8Array.from(atob(FIT_IMG[n]), (c) => c.charCodeAt(0)));   // constants of the bundle, never user data: safe to keep between requests
    return new Response(bytes, { headers: { "Content-Type": FIT_IMG_TYPE[n] || "image/jpeg", "Cache-Control": "private, max-age=86400", "X-Robots-Tag": "noindex", "Referrer-Policy": "no-referrer" } });
  }
  if (p === "/fit") {
    const html = fitPageHtml({ key, nav: h.najNav(key, "fit", ""), navCss: h.NAJ_NAV_CSS, fonts: h.NAJ_FONTS });
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" } });
  }
  const now = Date.now(), today = gstDate(now), ulist = fitUsers(env), us = ulist.map((x) => x.id), names = Object.fromEntries(ulist.map((x) => [x.id, x.name || x.id.charAt(0).toUpperCase() + x.id.slice(1)])), cfg = await fitCfg(env, url.searchParams.get("u"));
  if (request.method === "GET") {
    if (url.searchParams.get("view") === "history") return J(Object.assign({ ok: true, u: cfg.u, users: us, names }, await fitHistory(env, cfg, today, h)));
    if (url.searchParams.get("view") === "csv") return new Response(await fitCsv(env, cfg, today), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="momo-' + cfg.u + '-' + today + '.csv"', "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
    if (url.searchParams.get("view") === "health") return J(Object.assign({ ok: true }, await fitHealth(env, cfg, today)));
    let d = url.searchParams.get("d") || today; if (!DATE_RX.test(d) || d > today) d = today;
    let sum = await fitSummary(env, d, cfg, today);
    if (await fitBackfillProtein(env, h, sum.entries, 8)) sum = await fitSummary(env, d, cfg, today);   // opening a day estimates its meals that have no estimate yet
    return J({ ok: true, u: cfg.u, users: us, names, share: await fitShareOn(env, cfg.u), partners: await fitPartners(env, cfg, today), rest: sum.rest, paused: sum.paused, today, d, cfg, entries: sum.entries, stats: sum.stats, strip: sum.strip, week: sum.week, challenge: sum.challenge });
  }
  if (request.method !== "POST") return J({ ok: false, why: "method" }, 405);
  // With more than one person on this instance a write must NAME whose log it is. Without this a page that never asked "who is this?" (the default is the
  // first person) saved a second person's plan onto the first person's, and said "saved". An unknown name is refused too, never quietly mapped to the first.
  if (us.length > 1 && url.searchParams.get("op") !== "photo" && !us.includes(url.searchParams.get("u"))) return J({ ok: false, why: "say whose log this is (u=" + us.join("|") + ")" }, 400);
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
    const e = await fitAdd(env, { u: cfg.u, k: kind, x: kind === "ex" && n ? "Steps" : x, m, n, t, d, o, s: "web", est: kind === "food" ? await proteinFor(env, h, x) : undefined });
    return J({ ok: true, entry: e });
  }
  if (op === "del") return J({ ok: await fitDelete(env, b.id, cfg.u) });
  if (op === "edit") {
    const patch = {}; if (typeof b.text === "string") patch.x = b.text; if (b.minutes != null) patch.m = b.minutes; if (b.steps != null) patch.n = b.steps; if (b.value != null) patch.v = b.value;
    const e = await fitEdit(env, b.id, patch, cfg.u); return e ? J({ ok: true, entry: e }) : J({ ok: false, why: "no such entry" }, 404);
  }
  if (op === "pause") { const dates = await fitPause(env, cfg.u, today, b.days, b.reason); return J({ ok: true, dates }); }
  if (op === "resume") return J({ ok: true, cleared: await fitResume(env, cfg.u, today) });
  if (op === "share") return J({ ok: true, share: await fitSetShare(env, cfg.u, !!b.on) });
  if (op === "measure") {
    const what = String(b.what || ""), r = MEASURES[what], v = Math.round(Number(b.value) * 10) / 10;
    if (!r || !(v >= r.lo && v <= r.hi)) return J({ ok: false, why: "that does not look right" }, 400);
    return J({ ok: true, entry: await fitAdd(env, { u: cfg.u, k: "w", x: what, v, d: today, s: "web" }) });
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
  ".fc .add+.row{margin-top:12px}.brand{background:#FCF9F4;border-radius:16px;text-align:center;padding:14px 10px 10px;margin:0 0 12px}.brand .logo{display:block;width:min(172px,50%);height:auto;margin:0 auto}.brand .fsub{margin:8px 0 0;color:#4A5C55}.ph:after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,rgba(12,20,19,.04) 28%,rgba(12,20,19,.80))}.ph{position:relative;height:92px;margin:-14px -14px 12px;border-radius:14px 14px 0 0;background:#16241f center/cover no-repeat;overflow:hidden}.ph b{position:absolute;left:14px;bottom:8px;z-index:1;font-family:'IBM Plex Mono',monospace;font-size:.7rem;letter-spacing:.12em;color:#C5A56A;font-weight:500}.cred{text-align:center;color:#6E847B;font-size:.66rem;margin:6px 0 0}.empty{color:#8FA39B;font-size:.8rem;padding:6px 0}.add{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}.add input,.add select,.add textarea,.set input,.set select{background:#0C1413;border:1px solid #2E4540;color:#F2EFE6;border-radius:10px;padding:9px 10px;font:inherit;font-size:.88rem;min-width:0}.add textarea{flex:1 1 100%;min-height:44px;resize:vertical}.add input.g{flex:1}" +
  ".btn{background:#C5A56A;color:#0C1413;border:0;border-radius:10px;padding:9px 14px;font:inherit;font-weight:600;font-size:.85rem;cursor:pointer;min-height:40px}a.btn{display:inline-flex;align-items:center;text-decoration:none}.nowho .fc:not(#who),.nowho .dn,.nowho .strip,.nowho #usr{display:none}.set label.chk{display:flex;gap:8px;align-items:flex-start;font-size:.78rem;color:#CFD8D3;margin-top:14px;font-family:inherit}.set .chk input{width:auto;flex:none;margin:3px 0 0}.btn.s{background:#0E1918;color:#CFD8D3;border:1px solid #2E4540;font-weight:500}" +
  ".chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px}.chips button.on{border-color:#C5A56A;color:#F2EFE6}.chips button{border:1px solid #2E4540;background:#0C1413;color:#CFD8D3;border-radius:99px;padding:7px 12px;font:inherit;font-size:.78rem;cursor:pointer}" +
  ".set label{display:block;font-size:.72rem;color:#8FA39B;margin:10px 0 4px;font-family:'IBM Plex Mono',monospace}.set input,.set select{width:100%;box-sizing:border-box}.wr{display:flex;gap:6px;margin-top:6px}.wr input{flex:1}.note{color:#8FA39B;font-size:.72rem;margin-top:10px;line-height:1.5}.toast{position:fixed;left:50%;bottom:84px;transform:translateX(-50%);background:#16241f;border:1px solid #C5A56A;color:#F2EFE6;border-radius:12px;padding:10px 14px;font-size:.84rem;max-width:88%;display:none;z-index:50}";

function fitPageHtml(o) {
  const keyJs = JSON.stringify(o.key || "").replace(/</g, "\\u003c"), keyQ = encodeURIComponent(o.key || "");
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta name="theme-color" content="#0C1413"><title>Momo</title><link rel="icon" type="image/png" href="/fit_img/icon.png?key=' + keyQ + '"><link rel="apple-touch-icon" href="/fit_img/icon.png?key=' + keyQ + '">' + (o.fonts || "") +
    '<style>:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#0C1413;color:#E6E9E4;font-family:"IBM Plex Sans",system-ui,sans-serif}' + FIT_CSS + FIT_CSS2 + (o.navCss || "") + '</style></head><body><div class="fw">' +
    '<div class="brand"><img class="logo" src="/fit_img/logo.jpg?key=' + keyQ + '" alt="Momo"><div class="fsub" id="sub">&nbsp;</div></div><div class="chips" id="usr" style="margin:0 0 4px"></div>' +
    '<div class="fc" id="who" style="display:none"><h2>WHO IS THIS?</h2><div class="chips" id="whob"></div><div class="note">Pick your name once. This phone remembers it, and everything you log or save here goes under that name.</div></div>' +
    '<div class="fc" id="ch"></div>' +
    '<div class="dn"><button id="prev" aria-label="Previous day">&#8249;</button><span id="dl"></span><button id="next" aria-label="Next day">&#8250;</button></div><div class="strip" id="strip"></div>' +
    '<div class="fc"><div class="ph" data-img="food"><b>WHAT I ATE</b></div><div class="pc" id="prot" style="display:none"></div><div id="food"></div><div class="note" id="win"></div>' +
    '<div class="add"><textarea id="ft" placeholder="What did you eat or drink?" maxlength="140"></textarea><label class="btn s" for="ph" style="display:inline-flex;align-items:center"><span id="phi"></span>&nbsp;Photo</label><input id="ph" type="file" accept="image/*" hidden><button class="btn" id="fa">Add food</button></div>' +
    '<div class="note">A photo is read once and thrown away. Only the description is kept.</div></div>' +
    '<div class="fc"><div class="ph" data-img="exercise"><b>EXERCISE</b></div><div id="ex"></div>' +
    '<div class="chips" id="chips"></div><div class="add"><input class="g" id="et" placeholder="Activity" maxlength="40"><input id="en" type="number" inputmode="decimal" min="0" step="any" placeholder="min" style="width:84px"><select id="eu"><option value="m">min</option><option value="h">hours</option><option value="s">steps</option></select><button class="btn" id="ea">Add</button></div></div>' +
    '<details class="fc" id="hist"><summary style="cursor:pointer;color:#C5A56A;font-family:\'IBM Plex Mono\',monospace;font-size:.7rem;letter-spacing:.12em">PROGRESS &middot; DAY BY DAY, WEEK BY WEEK</summary><div class="ph" data-img="walk" style="margin:12px 0 10px;border-radius:12px;height:104px;background-position:center 76%"><b>EVERY STEP COUNTS</b></div><div class="add" id="mf"><select id="mw"><option value="weight">Weight (kg)</option><option value="waist">Waist (cm)</option></select><input id="mv" type="number" step="0.1" inputmode="decimal" placeholder="e.g. 82.5" style="width:110px"><button class="btn s" id="mb">Log it</button></div><div class="chips" id="hv"></div><div id="hb"></div></details>' +
    '<details class="fc set" id="set"><summary style="cursor:pointer;color:#C5A56A;font-family:\'IBM Plex Mono\',monospace;font-size:.7rem;letter-spacing:.12em">THE PLAN</summary><div class="note" id="plw" style="margin:10px 0 0"></div>' +
    '<label>END GOAL</label><input id="s_goal" maxlength="200" placeholder="What is this 30 days for?"><label>CHALLENGE STARTS</label><input id="s_start" type="date"><label>CHALLENGE LENGTH (DAYS)</label><input id="s_days" type="number" min="1" max="365">' +
    '<label>WEEKLY TARGET (HOURS) - CARRIES OVER UNTIL YOU SET IT ON A SUNDAY</label><input id="s_week" type="number" min="0" step="0.5"><label>DAILY FLOOR: WORKOUT MINUTES</label><input id="s_min" type="number" min="5">' +
    '<label>DAILY FLOOR: OR THIS MANY STEPS (0 = OFF)</label><input id="s_steps" type="number" min="0"><label>FEEDBACK TONE</label><select id="s_tone"><option value="kind">Kind</option><option value="firm">Firm</option><option value="brutal">Brutal</option></select>' +
    '<label>PROTEIN GUIDE (GRAMS A DAY, OPTIONAL, 0 = NONE) - A ROUGH GUIDE YOU SET FOR YOURSELF, NOT NUTRITION ADVICE</label><input id="s_protein" type="number" min="0" max="400" step="5">' +
    '<label>EATING WINDOWS (NAME, FROM, TO)</label><div id="s_win"></div>' +
    '<div class="note" id="dirt" style="display:none;color:#E0A458">You have unsaved changes - tap "Save the plan" below.</div><label class="chk" id="shl"><input type="checkbox" id="s_share"><span>Share my week and streak with the other person (counts only, never what I ate). It shows only when we both switch it on.</span></label><div class="add"><a class="btn s" id="csv" href="#">Download my log (CSV)</a></div><div class="add"><button class="btn" id="save">Save the plan</button><button class="btn s" id="ext">Extend +30 days</button></div></details>' +
    '<div class="cred">Photos: Pexels</div><div class="toast" id="toast"></div></div>' + (o.nav || "") +
    '<script>' + FIT_JS.replace("__KEY__", keyJs).replace("__ICONS__", JSON.stringify(FIT_ICONS)) + '</script></body></html>';
}
