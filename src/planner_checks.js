// v782b (Kendall 5 Nov, deep spec) - PLANNER CHECKS the evening before. Pure: items + settings + today (+ what the meetings said, open pop-ups) -> problems.
// Window: tomorrow plus the next 7 days. Two levels: "fix" = will go wrong, "check" = worth a look. Skipped days (settings.skip_days) and held items
// are never flagged. Every problem carries the one-tap fix it needs: time / topic / ask / camera / add / skip / made / step.
// The same function runs live (any change rechecks at once, because the planner reads it on every load) and at 18:00 Dubai in the minute tick.

const okDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ""));
const okTime = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(t || ""));
const addDays = (d, n) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const dowOf = (d) => new Date(d + "T00:00:00Z").getUTCDay();
const tm = (t) => okTime(t) ? +t.slice(0, 2) * 60 + +t.slice(3) : null;
const mondayOf = (d) => addDays(d, -((dowOf(d) + 6) % 7));
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fd = (d) => okDate(d) ? DOW[dowOf(d)] + " " + parseInt(d.slice(8), 10) + " " + MON[+d.slice(5, 7) - 1] : "";
export const PLACEHOLDER_RX = /^\s*\[|\[(flex|project|advisor|market|developer|trend)/i;
const NOT_PERSON = /^(ai|voice-over only|no person|)$/i;
// due point of each step, in days before the live date (Trial is checked at its own date)
export const STEP_DUE = { "Planned": -7, "Who & how": -6, "Brief": -5, "Made": -3, "Caption": -1, "Approved": -1, "Scheduled": 0, "Live": 0, "Posted": 0, "Results": 2 };

export const STORY_DUE = { "Made": -1, "Approved": 0, "Posted": 0 };
export const CHECK_DEFAULTS = { feed_min_week: 4, posting_days: null, market_deadline: "18:00", check_hour: "18:00", skip_days: [] };

export function isHeld(it) { return !!(it && (it.hold || /\bON HOLD\b/i.test(String(it.note || "")))); }
export function isPlaceholder(it) { const t = String((it && it.topic) || "").trim(); return !t || PLACEHOLDER_RX.test(t); }
const people = (it) => String((it && it.who) || "").split(",").map((x) => x.trim()).filter((x) => x && !NOT_PERSON.test(x));

// posting days: settings.posting_days, else the days of week her sheet plans feed posts on in at least 2 weeks
export function postingDays(items, S) {
  if (Array.isArray(S.posting_days) && S.posting_days.length) return S.posting_days.map(Number);
  const wk = {}; items.forEach((i) => { if (i.kind !== "feed" || !okDate(i.date) || i.deleted) return; const d = dowOf(i.date); (wk[d] = wk[d] || new Set()).add(mondayOf(i.date)); });
  return Object.keys(wk).filter((d) => wk[d].size >= 2).map(Number).sort();
}

// items: planner items (already derived: status, steps, trial, done); S: settings; today "YYYY-MM-DD"; opt: { nowHm, said: {date:[text]}, popups: {date:n}, doneSet, statusOf }
export function plannerChecks(items, settings, today, opt) {
  const S = Object.assign({ best_from: "10:00", best_to: "14:00", story_times: ["08:00", "13:00", "15:00"], on_camera_limit: 1, pro_video_allowance: 10, trial_hours: 72 }, CHECK_DEFAULTS, settings || {});
  const o = opt || {}, nowHm = o.nowHm || "12:00", said = o.said || {}, popups = o.popups || {};
  const live = (items || []).filter((i) => i && !i.deleted && okDate(i.date));
  const from = addDays(today, 1), to = addDays(today, 8), skip = new Set((S.skip_days || []).filter(okDate));
  const inWin = (d) => d >= from && d <= to && !skip.has(d);
  const byItem = {}, byDay = {}, list = [];
  const put = (lvl, date, code, what, fix, extra) => {
    if (!inWin(date)) return; const p = Object.assign({ lvl, date, code: code || "", what, fix: fix || "" }, extra || {});
    list.push(p); if (code) (byItem[code] = byItem[code] || []).push(p); (byDay[date] = byDay[date] || []).push(p);
  };
  const done = (it, step) => !!(it.done && it.done[step] && it.done[step].done) || (step === "Who & how" && it.who && it.how);
  const pdays = postingDays(live, S);

  // per day: feed presence, story slots, Monday market, open meeting pop-ups
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (skip.has(d)) continue;
    const day = live.filter((i) => i.date === d && !isHeld(i)), feed = day.filter((i) => i.kind === "feed"), stories = day.filter((i) => i.kind === "story");
    if (pdays.includes(dowOf(d)) && !feed.length) put("fix", d, "", "No feed post on a posting day", "add", { said: said[d] || [] });
    const slots = (S.story_times || []).length;
    if (stories.length && slots && stories.length < slots) put("check", d, "", stories.length + " of " + slots + " story slots planned", "add", { kind: "story" });
    if (dowOf(d) === 1) {
      const mk = stories.find((i) => i.story_type === "Market");
      const sundayDeadline = addDays(d, -1) < today || (addDays(d, -1) === today && nowHm >= S.market_deadline);
      if (!mk) put(sundayDeadline ? "fix" : "check", d, "", "No Monday market update planned", "add", { kind: "story", story_type: "Market" });
      else if (isPlaceholder(mk)) put(sundayDeadline ? "fix" : "check", d, mk.code, "Monday market update has no topic yet (due Sunday " + S.market_deadline + ")", "topic", { said: said[d] || [] });
    }
    if (popups[d]) put("check", d, "", popups[d] + " meeting change" + (popups[d] === 1 ? "" : "s") + " for this day not answered", "popups");
  }

  // per item
  const weekCam = {}, monthPro = {};
  live.slice().sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || ""))).forEach((it) => {
    if (isHeld(it)) return;
    const d = it.date, days = Math.round((Date.parse(d) - Date.parse(today)) / 864e5);
    // time
    if (it.kind === "feed") {
      const t = tm(it.time);
      if (t == null) put("fix", d, it.code, "No time set", "time");
      else if (t < tm(S.best_from) || t >= tm(S.best_to)) put("fix", d, it.code, "Time " + it.time + " is outside " + S.best_from + "–" + S.best_to, "time");
    }
    // placeholder
    if (isPlaceholder(it) && !(it.kind === "story" && it.story_type === "Market" && dowOf(d) === 1)) put(days <= 2 ? "fix" : "check", d, it.code, "Still a placeholder: " + (String(it.topic || "").trim() || "no topic"), "topic", { said: said[d] || [] });
    // nobody owns the next step
    if ((!it.who || !it.how) && (it.kind === "feed" || days <= 2)) put("check", d, it.code, (!it.how ? "How it's made not chosen, so there is no maker" : "Who's in it not set"), "step");
    // steps overdue by more than 1 day
    // only the item's NEXT step, and not Planned / Who & how (the placeholder and no-maker checks already cover those)
    { const st = (it.steps || []).find((x) => !done(it, x));
      if (st && st !== "Trial" && st !== "Planned" && st !== "Who & how") { const off = (it.kind === "story" ? STORY_DUE : STEP_DUE)[st];
        if (off != null) { const due = addDays(d, off); if (due < addDays(today, -1)) put("fix", d, it.code, st + " was due " + fd(due) + " (owner: " + ownerName(it, st) + ")", "ask", { step: st, owner: ownerName(it, st) }); } } }
    // Trial Reel: Made by the trial date (live - 72 h)
    if (it.trial && okDate(it.trial.date) && !done(it, "Made") && it.trial.date <= addDays(today, 1)) put("fix", d, it.code, "Trial Reel goes out " + fd(it.trial.date) + " and it isn't Made yet", "made", { owner: ownerName(it, "Made") });
    // on camera per week
    const wk = mondayOf(d); people(it).forEach((p) => { const k = wk + "|" + p; weekCam[k] = (weekCam[k] || 0) + 1; if (weekCam[k] > S.on_camera_limit) put("check", d, it.code, p + " is on camera " + weekCam[k] + " times this week (limit " + S.on_camera_limit + ")", "camera", { person: p }); });
    // professional videos per month
    if (it.how === "Professional video") { const m = d.slice(0, 7); monthPro[m] = (monthPro[m] || 0) + 1; if (monthPro[m] > S.pro_video_allowance) put("check", d, it.code, "Professional video " + monthPro[m] + " of " + S.pro_video_allowance + " this month", "step"); }
    // caption checklist (only when a caption is stored)
    if (it.caption) {
      const c = String(it.caption), bad = [];
      if (c.length > 100) bad.push("over 100 characters"); if (/\?/.test(c)) bad.push("has a question"); if (it.developer && !/#\w/.test(c)) bad.push("no developer hashtag");
      if (bad.length) put("check", d, it.code, "Caption " + bad.join(", "), "topic");
    }
  });

  // minimum feed posts a week (weeks that touch the window)
  const weeks = new Set(); for (let d = from; d <= to; d = addDays(d, 1)) weeks.add(mondayOf(d));
  weeks.forEach((m) => {
    const n = live.filter((i) => i.kind === "feed" && !isHeld(i) && !isPlaceholder(i) && i.date >= m && i.date <= addDays(m, 6) && !skip.has(i.date)).length;
    const first = [0, 1, 2, 3, 4, 5, 6].map((k) => addDays(m, k)).find(inWin);
    if (first && n < S.feed_min_week) put("fix", first, "", "Week of " + fd(m) + ": " + n + " real feed post" + (n === 1 ? "" : "s") + " (minimum " + S.feed_min_week + ")", "add");
  });

  const tomorrow = from, fixT = list.filter((p) => p.lvl === "fix" && p.date === tomorrow).length, fixAll = list.filter((p) => p.lvl === "fix").length, chk = list.filter((p) => p.lvl === "check").length;
  const line = fixT || fixAll || chk ? [fixT ? fixT + " thing" + (fixT === 1 ? "" : "s") + " to check for tomorrow" : (fixAll ? fixAll + " to check this week" : ""), chk ? chk + " note" + (chk === 1 ? "" : "s") + " for this week" : ""].filter(Boolean).join(" · ") : "Nothing to check for tomorrow or this week";   // v791 (Kendall 6 Nov): "to check", never "to fix"
  return { from, to, items: byItem, days: byDay, list, fix_tomorrow: fixT, fix: fixAll, check: chk, line, posting_days: pdays, best: suggestTimes(S) };
}

const OWNER = { "Planned": "Najjuko", "Who & how": "Najjuko", "Brief": "Najjuko", "Caption": "Sousan", "Approved": "Najjuko", "Trial": "Rouba", "Scheduled": "Rouba", "Live": "Rouba", "Results": "Sousan", "Posted": "Sousan" };
const MAKER = { "Design (carousel / graphic)": "Monaza", "AI video": "Vishant", "In-house video (office)": "Liam", "Professional video": "Kareem", "Edit of existing footage": "Vishant", "Repost / photo / text card": "Sousan" };
function ownerName(it, st) { if (it && it.owners && it.owners[st]) return it.owners[st]; return st === "Made" ? (MAKER[it.how] || "the maker") : (OWNER[st] || "Najjuko"); }
// suggested time slots inside the best window, on the hour
export function suggestTimes(S) { const a = tm(S.best_from), b = tm(S.best_to), out = []; if (a == null || b == null) return out; for (let t = a; t < b && out.length < 6; t += 60) out.push(String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0")); return out; }
