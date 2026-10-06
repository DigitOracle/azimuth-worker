// v356 - a picture of a schedule (a poster, a flyer, a weekly plan) becomes dated events, after she says yes.
// Pure parts only: the prompt, the schema, the clean-up of what the model returns, and the wording.
// The glue (the vision call, the confirm card, the filing) lives in src/index.js and reuses the meeting filing there.
// The picture itself is read once and dropped: nothing in here, or in the glue, has a put() that takes image bytes.

export const SCHED_MAX_EVENTS = 12;
export const SCHED_PAST_DAYS = 2;
export const SCHED_FUTURE_DAYS = 120;
export const SCHED_TTL = 24 * 60 * 60;

export const SCHED_SCHEMA = { type: "object", additionalProperties: false, properties: {
  kind: { type: "string", enum: ["schedule", "flyer", "other"] },
  events: { type: "array", items: { type: "object", additionalProperties: false, properties: {
    title: { type: "string" }, date: { type: "string" }, time: { type: ["string", "null"] }, place: { type: "string" }, note: { type: "string" } },
    required: ["title", "date", "time", "place", "note"] } }
}, required: ["kind", "events"] };

export function schedPrompt(nowIso, hints) {
  return "You are reading a picture someone sent their assistant. NOW is " + nowIso + " (Dubai, UTC+4). " + (hints || "") + "\n" +
"Decide what the picture is: \"schedule\" if it lists several dated events (a weekly plan, a programme, a calendar), \"flyer\" if it announces one or more dated events (an invitation, a launch poster), \"other\" for anything else (a person, a place, a meal, a screenshot with no dates).\n" +
"If it carries dated events, list EVERY event in it, in the order printed. For each event give: title (a short plain name, what happens, without the date or time), date as yyyy-mm-dd (read the year from the picture; if none is printed use the current Dubai year, or the next one if that date has already passed), time as HH:MM in 24 hours (9:00 PM is 21:00) or null when no time is printed, place exactly as printed (empty string if none), note (any extra words that matter, such as \"not mandatory\"; empty string if none).\n" +
"Read what is printed. Never guess a date, a time or a place that is not legible. If the picture is not a schedule or has no legible dates, set kind to \"other\" and events to an empty list.";
}

const pad2 = (n) => String(n).padStart(2, "0");
function cleanText(s, max) {
  return String(s == null ? "" : s).replace(/<[^>]*>/g, " ").replace(/[<>]/g, " ").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}
function validDate(d) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d || ""));
  if (!m) return null;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const x = new Date(t);
  if (x.getUTCFullYear() !== +m[1] || x.getUTCMonth() !== +m[2] - 1 || x.getUTCDate() !== +m[3]) return null;
  return t;
}
// raw = whatever the model returned. today = "yyyy-mm-dd" in Dubai. Returns {kind, events:[{title,date,time,place,note}]} or null for garbage.
export function schedSanitise(raw, today) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const kind = ["schedule", "flyer", "other"].indexOf(raw.kind) >= 0 ? raw.kind : "other";
  if (!Array.isArray(raw.events)) return null;
  const t0 = validDate(today); if (t0 == null) return null;
  const out = [], seen = new Set();
  for (const e of raw.events) {
    if (out.length >= SCHED_MAX_EVENTS) break;
    if (!e || typeof e !== "object") continue;
    const title = cleanText(e.title, 120); if (!title) continue;
    const date = String(e.date || "").trim(); const t = validDate(date); if (t == null) continue;
    const days = Math.round((t - t0) / 86400000);
    if (days < -SCHED_PAST_DAYS || days > SCHED_FUTURE_DAYS) continue;
    let time = null;
    const tm = /^(\d{1,2}):(\d{2})$/.exec(String(e.time || "").trim());
    if (tm && +tm[1] <= 23 && +tm[2] <= 59) time = pad2(+tm[1]) + ":" + tm[2];
    const k = title.toLowerCase() + "|" + date + "|" + (time || "");
    if (seen.has(k)) continue; seen.add(k);
    out.push({ title, date, time, place: cleanText(e.place, 120), note: cleanText(e.note, 160) });
  }
  return { kind, events: out };
}

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function schedLine(ev) {
  const t = validDate(ev.date); const d = new Date(t);
  return WD[d.getUTCDay()] + " " + d.getUTCDate() + " " + MO[d.getUTCMonth()] + (ev.time ? ", " + ev.time : "") + " - " + ev.title + (ev.place ? ", " + ev.place : "") + (ev.note ? " (" + ev.note + ")" : "");
}
export function schedCard(events) {
  return "I found " + events.length + (events.length === 1 ? " event" : " events") + " in this picture:\n\n" + events.map(schedLine).join("\n") + "\n\nShall I add them to your plate?";
}
// the event as the meeting filer wants it (start_iso in Dubai time; no printed time means 09:00, as for a typed date with no time)
export function schedToMeeting(ev) {
  return { summary: ev.title, start_iso: ev.date + "T" + (ev.time || "09:00") + ":00+04:00", location: ev.place || "", note: ev.note || "" };
}
// a caption that says what the picture is claims it for extraction
export function schedCaptionHit(cap) { return /\b(schedules?|calendar|agenda|events?|programme|program|timetable|itinerary)\b/i.test(String(cap || "")); }
export function schedKey(ev) { return String(ev.summary || ev.title || "").trim().toLowerCase() + "|" + String(ev.start_iso || (ev.date + "T" + (ev.time || "09:00") + ":00+04:00")).slice(0, 16); }

export const SCHED_MSG = {
  none: "I could not find dates in that picture. Send the dates as text, or tell me what it is.",
  no: "Okay, not added.",
  expired: "That one has expired. Send the picture again and I will read it fresh.",
  already: "Those were already on your plate.",
  added: (n) => "Added " + n + (n === 1 ? " event" : " events") + " to your plate."
};
// v370 - a caption that names a speaking engagement claims the picture and tags what is filed
export function eventCaptionHit(cap) { return /\b(events?|speaking|panel|talk|keynote)\b/i.test(String(cap || "")); }
