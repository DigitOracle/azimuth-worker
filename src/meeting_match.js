// v781 (Kendall 5 Nov 2026) - MEETING -> CONTENT PLANNER MATCHER. Reads what was said in a meeting (the transcript lines) against her
// planner items, with no model: day words are resolved in the order they were spoken, topics are recognised from the planner's own
// vocabulary (formats, series, developers/projects, team names) plus a small set of her recurring content words, and each spoken plan is
// matched to the item on that day. Classes (Operations/Research/Meeting_Sync_05NOV2026/MAPPING_Vishant_meeting_05NOV2026.md):
//   sure     - the day, the kind and a format/series/topic word agree with one item
//   likely   - the day and kind agree but the item is a placeholder with nothing else to confirm it ([Flex], [Project] ...)
//   conflict - the day has a real (non-placeholder) item about something else
//   new      - nothing on that day fits
//   task     - an arrangement for a person (not a post)
//   recurring- "every Monday ..." style rules, asked once
// Nothing here writes anything: it returns proposals; Work asks her one at a time.

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const ORD = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15,
  sixteenth: 16, seventeenth: 17, eighteenth: 18, nineteenth: 19, twentieth: 20, "twenty first": 21, "twenty second": 22, "twenty third": 23, "twenty fourth": 24, "twenty fifth": 25,
  "twenty sixth": 26, "twenty seventh": 27, "twenty eighth": 28, "twenty ninth": 29, thirtieth: 30, "thirty first": 31 };
const norm = (s) => String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const iso = (d) => d.toISOString().slice(0, 10);
const addD = (s, n) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const dow = (s) => new Date(s + "T00:00:00Z").getUTCDay();
export const isPlaceholder = (t) => /^\s*\[/.test(String(t || "")) || /\bflex\b/i.test(String(t || "")) || !String(t || "").trim();

// her recurring content words -> what the post is (kind, format, topic text, words that confirm an item)
const RULES = [
  { rx: /\bmortgage\b|\bellington\b/, kind: "feed", topic: "Mortgage + Ellington video", format: "Reel", confirm: ["mortgage", "ellington"] },
  { rx: /\bobject (one|1)\b/, kind: "feed", topic: "Object 1 goes live", format: "Reel", confirm: ["object"] },
  { rx: /\bd[iu]wali\b/, same: true, kind: "story", story_type: "Trending", topic: "Diwali video", confirm: ["diwali"] },
  { rx: /\bmarket update\b/, kind: "story", story_type: "Market", topic: "Market update by Monaza (morning)", time: "10:00", who: "Monaza", confirm: ["market"], recurring: true },
  { rx: /\bmonday (morning )?meeting\b|\bhuddl/, kind: "feed", topic: "Monday meeting recording", format: "Reel", confirm: ["meeting", "huddle"] },
  { rx: /\bdeal of the day\b/, kind: "feed", topic: "Deal of the day (Monaza, morning)", time: "10:00", who: "Monaza", confirm: ["deal"] },
  { rx: /\bpalm springs?\b/, kind: "feed", topic: "Palm Springs AI video", format: "Reel", confirm: ["palm springs"] },
  { rx: /\brockefeller\b/, kind: "feed", topic: "Rockefeller", format: "Reel", confirm: ["rockefeller", "project"] },
  { rx: /\bskip a day\b|\bskip\b/, kind: "feed", topic: "", skip: true, confirm: ["flex"] },
  { rx: /\bthis versus this\b|\bversus\b|\bcomparison\b/, kind: "feed", topic: "Adviser comparison video", format: "Reel", confirm: ["advisor", "adviser"], needsAdviser: true },
  { rx: /\badvis[eo]r intake\b|\bali'?s video\b|\bpodcast\b/, kind: "feed", topic: "Ali (video or podcast clip)", format: "Reel", who: "Ali Kalhor", confirm: ["ali", "advisor", "adviser"] },
  { rx: /\bcarousel\b/, same: true, kind: "feed", format: "Carousel", topic: "Two carousels", confirm: ["carousel"] },
];
const TASK_RX = /\b(arrange|email them|find a project)\b/;   // v782a - follow up with someone is a promise now (owner + due)
// v782a - a promise: someone will do something ("I'll send the brochure", "Sousan will check the Babak recording", "check with Susan if she recorded")
const PROMISE_RX = /\b(check with|follow ?up with|send (him|her|them|the|a|it)|email (him|her|them)|call (him|her|them)|book (a|the)|ask (him|her|them|ali|susan|sousan|monaza|vishant|liam|rouba))\b/;
const ALIAS = { susan: "Sousan", sosan: "Sousan", sousan: "Sousan", monaza: "Monaza", vishant: "Vishant", liam: "Liam", kareem: "Kareem", karim: "Kareem", rouba: "Rouba", najjuko: "Najjuko", ali: "Ali Kalhor" };
export function ownerIn(u, team) {
  const n = " " + norm(u) + " ";
  for (const k of Object.keys(ALIAS)) if (n.indexOf(" " + k + " ") >= 0 && !new RegExp("\\b(with|from|to|ask) " + k + "\\b").test(n)) return ALIAS[k];
  for (const t of team || []) { const nm = norm(t && t.name ? t.name : t).split(" ")[0]; if (nm.length >= 3 && n.indexOf(" " + nm + " will ") >= 0) return t && t.name ? t.name : t; }
  if (/\b(i'?ll|i will|i'?m going to)\b/.test(n)) return "Najjuko";
  const w = /\b(check|follow ?up) with (\w+)/.exec(n); if (w && ALIAS[w[2]]) return "Najjuko";
  return "Najjuko";
}
export function taskWords(u, before) {
  let t = String(u || "").replace(/\s+/g, " ").trim();
  // "follow up with her" names the person said just before ("Sosan was doing the editing")
  if (/\bwith (her|him)\b/i.test(t)) { const b = " " + norm(before) + " "; const hit = Object.keys(ALIAS).filter((k) => b.indexOf(" " + k + " ") >= 0).pop(); if (hit) t = t.replace(/\bwith (her|him)\b/i, "with " + ALIAS[hit]); }
  const m = /\b(follow-? ?up with|check with|send|email|call|book|ask)\b/i.exec(t); if (m) t = t.slice(m.index);
  t = t.replace(/^follow-? ?up/i, "Follow up").replace(/^check with/i, "Check with").replace(/\b(susan|sosan)\b/gi, "Sousan").replace(/[.?!]+$/, "");
  return (t.charAt(0).toUpperCase() + t.slice(1)).slice(0, 80);
}
const nextWorkday = (d) => { let x = d; for (let i = 0; i < 4; i++) { x = addD(x, 1); const w = new Date(x + "T00:00:00Z").getUTCDay(); if (w !== 0 && w !== 6) return x; } return x; };

const EVENT_RX = /\b(huge|viral|event)\b.*\bvideo\b|\bvideo\b.*\b(huge|viral|event)\b/;

// split into short spoken units (sentences), keeping order
export function units(text) { return String(text || "").replace(/\s+/g, " ").split(/(?<=[.?!])\s+/).map((s) => s.trim()).filter(Boolean); }

// day words, resolved in spoken order: a weekday is the first such day on/after (cursor - 2 days); "the 17th"/"seventeenth" sets an explicit day
export function resolveDays(us, meetingDate) {
  let cursor = addD(meetingDate, 1); const out = [];
  for (const u of us) {
    const n = " " + norm(u) + " "; let date = "", explicit = false;
    const md = new Date(meetingDate + "T00:00:00Z");
    // ordinals count as a date only when spoken as one ("the 17th", "Eleventh is Wednesday", "Seventeenth."), never "a second option"
    let dom = null; for (const k of Object.keys(ORD).sort((a, b) => b.length - a.length)) if (n.indexOf(" the " + k + " ") >= 0 || n.indexOf(" " + k + " is ") === 0 || n === " " + k + " ") { dom = ORD[k]; break; }
    const m2 = /\b(\d{1,2})(st|nd|rd|th)\b/.exec(n); if (!dom && m2) dom = +m2[1];
    if (dom && dom >= 1 && dom <= 31) { let d = new Date(Date.UTC(md.getUTCFullYear(), md.getUTCMonth(), dom)); if (iso(d) < meetingDate) d = new Date(Date.UTC(md.getUTCFullYear(), md.getUTCMonth() + 1, dom)); date = iso(d); explicit = true; }
    if (!date) {
      const wd = DAYS.find((w) => n.indexOf(" " + w + " ") >= 0);
      if (/\btomorrow\b/.test(n)) date = addD(meetingDate, 1);   // "tomorrow" wins over a weekday said in the same breath
      else if (wd) { let d = addD(cursor, -2); if (d <= meetingDate) d = addD(meetingDate, 1); for (let i = 0; i < 8 && dow(d) !== DAYS.indexOf(wd); i++) d = addD(d, 1); date = d; }
    }
    if (date && (!explicit || date >= cursor)) cursor = date > cursor ? date : cursor;
    out.push({ u, date, explicit, every: /\b(every|always)\b/.test(n) });
  }
  // a unit with no day word carries the last spoken day (people say "Friday ... mortgage and Ellington" across two sentences)
  let last = ""; for (const x of out) { if (x.date) last = x.date; else x.carry = last; }
  return out;
}

const words = (s) => new Set(norm(s).split(" ").filter((w) => w.length >= 3));
function itemWords(it) { return norm([it.topic, it.series, it.format, it.story_type, it.developer, it.who].join(" ")); }

// main: transcript text + meeting date + planner items (+ team names) -> proposals
export function matchMeeting(text, meetingDate, items, opt) {
  const us = units(text), R = resolveDays(us, meetingDate), out = [], seen = new Set();
  const byDay = {}; (items || []).forEach((i) => { if (!i.deleted) (byDay[i.date] = byDay[i.date] || []).push(i); });
  R.forEach((x, idx) => {
    const n = norm(x.u), day = x.date || x.carry; if (!n) return;
    if (PROMISE_RX.test(n) && !TASK_RX.test(n) && x.u.length > 24 && (/\b(check with|follow ?up with|ask)\b/.test(n) || !RULES.some((r) => r.rx.test(n)))) { const owner = ownerIn(x.u, (opt && opt.team) || []), due = x.date && x.explicit ? addD(x.date, -1) > meetingDate ? addD(x.date, -1) : x.date : nextWorkday(meetingDate);
      const key = "promise:" + n.slice(0, 40); if (!seen.has(key)) { seen.add(key); out.push({ cls: "task", promise: true, owner, due, quote: x.u, task: taskWords(x.u, R.slice(Math.max(0, idx - 3), idx).map((y) => y.u).join(" ")) }); } }
    if (TASK_RX.test(n) && !RULES.some((r) => r.rx.test(n))) { const key = "task:" + n.slice(0, 30); if (!seen.has(key)) { seen.add(key); out.push({ cls: "task", quote: x.u, task: x.u.replace(/^(we need to|need to)\s*/i, "").slice(0, 80) }); } return; }
    if (EVENT_RX.test(n) && x.explicit) { const key = "new:event:" + day; if (!seen.has(key)) { seen.add(key); out.push({ cls: "new", quote: x.u, date: day, kind: "feed", fields: { topic: "Video at the event", format: "Reel" } }); } return; }
    for (const r of RULES) {
      if (!r.rx.test(n) || !day || (r.same && !x.date)) continue;   // generic words (carousel, Diwali) count only with a day in the same sentence
      const kind = r.kind, key = kind + ":" + day + ":" + (r.topic || "skip");
      if (seen.has(key)) continue; seen.add(key);
      const cands = (byDay[day] || []).filter((i) => i.kind === kind && (kind !== "story" || !r.story_type || i.story_type === r.story_type));
      const any = (byDay[day] || []).filter((i) => i.kind === kind);
      const fields = Object.assign({}, r.topic ? { topic: r.topic } : {}, r.format ? { format: r.format } : {}, r.story_type ? { story_type: r.story_type } : {}, r.time ? { time: r.time } : {}, r.who ? { who: r.who } : {});
      const pick = cands[0] || any[0];
      let cls = "new", why = "";
      if (pick) {
        const w = itemWords(pick), hit = r.confirm.some((c) => w.indexOf(norm(c)) >= 0);
        if (r.skip) { cls = isPlaceholder(pick.topic) ? "sure" : "conflict"; why = "skip this day"; }
        else if (isPlaceholder(pick.topic)) { cls = hit ? "sure" : "likely"; }
        else cls = hit ? "sure" : "conflict";
      }
      const p = { cls, quote: x.u, date: day, kind, code: pick ? pick.code : "", current: pick ? { topic: pick.topic || "", time: pick.time || "", format: pick.format || pick.story_type || "", series: pick.series || "" } : null, fields, skip: !!r.skip, why };
      if (r.needsAdviser) p.ask = "Who is the adviser?";
      if (cls === "likely" && pick && !pick.time && !fields.time) p.ask = "Time is not set. Add one?";
      out.push(p);
      if (r.recurring && (x.every || /\bmonday\b/.test(n))) { const rk = "rec:" + r.topic; if (!seen.has(rk)) { seen.add(rk); out.push({ cls: "recurring", quote: x.u, kind, weekday: dow(day), fields, rule: "Every " + DAYS[dow(day)][0].toUpperCase() + DAYS[dow(day)].slice(1) + ": " + r.topic }); } }
      continue;   // one sentence can name several posts ("market update, plus the huddle")
    }
  });
  // one proposal per planner item: the strongest (sure > conflict > likely), first spoken wins a tie; passing mentions drop out
  const rank = { sure: 3, conflict: 2, likely: 1 }, best = {};
  out.forEach((p, i) => { if (!p.code) return; const b = best[p.code]; if (!b || (rank[p.cls] || 0) > (rank[b.p.cls] || 0)) best[p.code] = { p, i }; });
  let res = out.filter((p) => !p.code || best[p.code].p === p);
  // the event video is said a sentence or two after its date ("Eleventh is Wednesday ... It's huge ... we should make video")
  R.forEach((x, i) => { if (!x.explicit) return; for (let j = i; j < Math.min(R.length, i + 4); j++) { const n2 = norm(R[j].u); if (/\b(huge|viral)\b/.test(n2) || (/\bvideo\b/.test(n2) && /\b(should|make)\b/.test(n2) && j > i)) { if (!res.some((p) => p.cls === "new" && p.date === x.date)) res.push({ cls: "new", quote: R[i].u + " " + R[j].u, date: x.date, kind: "feed", fields: { topic: "Video at the event", format: "Reel" } }); break; } } });
  // tasks said over several sentences become one task
  const tasks = res.filter((p) => p.cls === "task" && !p.promise);
  if (tasks.length > 1) { const merged = { cls: "task", quote: tasks.map((t) => t.quote).join(" ").slice(0, 400), task: "Arrange the visits and projects discussed (" + tasks.length + " mentions)" }; res = res.filter((p) => !(p.cls === "task" && !p.promise)).concat([merged]); }
  // v782a - a card keeps its id when a meeting is read again (her earlier answers stay on the right card)
  const hid = (x) => { let h = 5381; const t = [x.cls, x.code || "", x.date || "", String(x.task || (x.fields && x.fields.topic) || ""), String(x.quote || "").slice(0, 60)].join("|"); for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) | 0; return "m" + (h >>> 0).toString(36); };
  const used = {}; return res.map((p) => { let id = hid(p); while (used[id]) id += "x"; used[id] = 1; return Object.assign({ id }, p); });
}
