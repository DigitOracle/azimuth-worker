// v370 - QUESTIONNAIRE SETS for the WhatsApp dropdown engine (Kendall, 6 Oct 2026). Pure data and pure helpers; the sending and the
// answer handling live in src/index.js (nsAsk, nsReply, nsTextTry). Question wording is fixed here, never taken from a request.
// WhatsApp list limits: 10 rows per list, row title <= 24 characters, row description <= 72. Where the full wording is longer than
// 24 characters the row shows a short title and carries the full wording in its description; the stored answer is the full wording (v).
export const NS_LIMITS = { rows: 10, title: 24, desc: 72, button: 20, body: 1024 };
const R = (t, d, v) => ({ t, d: d || "", v: v || t });

export const NS_SETS = {
  najjesty_intake: {
    label: "Najjesty intake",
    parts: {
      A: { name: "Schedule", intro: "Black Coffee, three quick taps to lock your posting rhythm.", qs: [
        { key: "q1", label: "Posting days", button: "Pick days", other: true, rows: [R("Mon + Wed + Sat", "Three posts a week"), R("Tue + Thu + Sat", "Three posts a week"), R("Mon + Thu + Sun", "Three posts a week"), R("Other", "Type your own days")] },
        { key: "q2", label: "Post time", button: "Pick a time", rows: [R("07:00"), R("12:00"), R("17:00"), R("19:00"), R("21:00")] },
        { key: "q3", label: "Reels vs carousels", button: "Pick a mix", rows: [R("Half and half"), R("More carousels"), R("More reels")] },
        { key: "q4", label: "Reminder", button: "Pick a reminder", rows: [R("Day before, 17:00"), R("Morning of"), R("Two hours before"), R("Day before + morning", "Both day before and morning", "Both day before and morning"), R("No reminders")] },
        { key: "q5", label: "Hashtags", button: "Pick one", rows: [R("Keep the five we set"), R("Change them")] }
      ] },
      B: { name: "Content", intro: "Black Coffee, a few taps on what the page says. Everything is about emotional intelligence in your voice.", qs: [
        { key: "q1", label: "Main goal", button: "Pick a goal", rows: [R("Grow followers"), R("Sell the book"), R("Get speaking invitations"), R("Build community"), R("Partnerships and collabs")] },
        { key: "q2", label: "Lead topic", button: "Pick a topic", other: true, rows: [R("Self-awareness"), R("Self-regulation"), R("Empathy"), R("Social skills"), R("Motivation"), R("Relationships"), R("Boundaries"), R("Other", "Type your own topic")] },
        { key: "q3", label: "Podcast teasers", button: "Pick one", rows: [R("Yes, 30-second teasers", "Yes, cut 30-second teasers", "Yes, cut 30-second teasers"), R("Only some episodes"), R("No, I record fresh")] },
        { key: "q4", label: "Which episode first", button: "Pick an episode", rows: [R("Courage to See Yourself", "The Courage to See Yourself", "The Courage to See Yourself"), R("Power of Witnessing Pain", "The Power of Witnessing Pain", "The Power of Witnessing Pain"), R("The Power of the Pause"), R("No."), R("Guilt That Comes After", "The Guilt That Comes After", "The Guilt That Comes After"), R("Book launch video")] },
        { key: "q5", label: "Reel style", button: "Pick a style", rows: [R("Reflection to camera"), R("Lesson from experience", "A lesson from an experience", "A lesson from an experience"), R("Advice for a situation"), R("Clip from talk or panel", "Clip from a talk or panel", "Clip from a talk or panel")] },
        { key: "q6", label: "Carousel style", button: "Pick a style", rows: [R("What to do when..."), R("Myth vs truth"), R("Step-by-step practice"), R("Quote and meaning")] }
      ] },
      C: { name: "Events and people", intro: "Black Coffee, last part: your events and who helps.", done: "To add an event later, send a photo of the flyer with the word event, or type: event, then the name, date, time and place.", qs: [
        { key: "q1", label: "Events soon", button: "Pick one", rows: [R("Yes, I will send them"), R("None in the next 90 days"), R("Not sure yet")] },
        { key: "q2", label: "How you send events", button: "Pick one", rows: [R("A photo of the flyer"), R("A screenshot"), R("I type it"), R("Forward a message"), R("A voice note")] },
        { key: "q3", label: "Collaborations", button: "Pick one", rows: [R("Yes, creators", "Yes, creators and bookstagrammers", "Yes, creators and bookstagrammers"), R("Yes, hosts and speakers"), R("Not right now")] },
        { key: "q4", label: "Comment replies", button: "Pick one", rows: [R("I reply myself"), R("My team replies"), R("Draft replies for me")] },
        { key: "q5", label: "Approving drafts", button: "Pick one", rows: [R("Tap Approve in WhatsApp"), R("Edit in chat first")] }
      ] }
    }
  }
};

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 14) || "x";
// ids are ns_<part>_<q>_<opt>; "Other" is always ns_<part>_<q>_other
export function nsRowId(part, q, row) { return "ns_" + part + "_" + q.key + "_" + (row.t === "Other" ? "other" : slug(row.t)); }
export function nsPartView(setName, part) {
  const set = NS_SETS[setName], p = set && set.parts[part]; if (!p) return null;
  return { set: setName, part, name: p.name, intro: p.intro, done: p.done || "", questions: p.qs.map((q) => ({ key: q.key, label: q.label, body: q.label, button: q.button, other: !!q.other,
    rows: q.rows.map((r) => ({ id: nsRowId(part, q, r), title: r.t, description: r.d, v: r.v, other: r.t === "Other" })) })) };
}
export function nsFindRow(bid) {
  const m = /^ns_([ABC])_(q\d)_([a-z0-9]+)$/.exec(String(bid || "")); if (!m) return null;
  for (const setName of Object.keys(NS_SETS)) {
    const v = nsPartView(setName, m[1]); if (!v) continue;
    const q = v.questions.find((x) => x.key === m[2]); if (!q) continue;
    const row = q.rows.find((r) => r.id === bid); if (row) return { set: setName, part: m[1], view: v, q, row };
  }
  return null;
}
