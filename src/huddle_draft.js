// v823 - one input per card, Momo drafts the slide fields. Theme & clip: from the YouTube clip (title, description, captions when available), from a SALES
// perspective. Recognition / Announcements / Tip: from the one pasted update. Uses the worker's existing model call (deps.claudeJSON); without it, a plain
// deterministic draft so the card still works. Every value is cut to the field's maximum. No team member is named in the tip; nothing is invented about people.
const clip = (v, n) => { const s = String(v == null ? "" : v).replace(/\s+/g, " ").trim(); return s.length <= n ? s : s.slice(0, Math.max(0, n - 1)).replace(/\s+\S*$/, "") + "…"; };
const SENT = (t) => String(t || "").replace(/https?:\/\/\S+/g, " ").split(/(?<=[.!?])\s+|\n+/).map((x) => x.replace(/[#*_]+/g, "").replace(/^.*?\btip\s*\d+\s*:\s*/i, "").trim()).filter((x) => x.length > 25 && x.length < 220 && !/subscribe|register|free training|follow me|link in|summary:|sponsor|download|click/i.test(x));   // promo lines are not lessons
export const THEME_KEYS = ["cover_title_line1", "cover_title_line2", "cover_subtitle", "cover_pillars", "cover_notes", "motivation_headline_1", "motivation_headline_2",
  "pillar1_title", "pillar1_text", "pillar2_title", "pillar2_text", "pillar3_title", "pillar3_text", "clip_url", "clip_label", "motivation_notes"];
const schemaFor = (keys) => ({ type: "object", additionalProperties: false, required: keys, properties: Object.fromEntries(keys.map((k) => [k, { type: "string" }])) });
function fit(vals, meta) { const o = {}; for (const k of Object.keys(vals)) if (meta[k]) o[k] = clip(vals[k], meta[k].max); return o; }

export function themeFallback(yt, redo) {
  const words = String(yt.title || "This week").replace(/[|\-–—:]+/g, " ").split(/\s+/).filter(Boolean);
  const half = Math.min(words.length, redo ? 2 : 3);
  const ss = SENT(yt.captions || yt.description), pick = (i) => ss[(i + (redo ? 3 : 0)) % Math.max(1, ss.length)] || "";
  const pt = (s) => s.split(/\s+/).slice(0, 3).join(" ");
  return {
    cover_title_line1: words.slice(0, half).join(" ").toUpperCase(), cover_title_line2: words.slice(half, half + 4).join(" ").toUpperCase(),
    cover_subtitle: "What this week's clip means for how we sell", cover_pillars: [pt(pick(0)), pt(pick(1)), pt(pick(2))].filter(Boolean).join(" · "),
    cover_notes: "Open with the clip (" + clip(yt.title, 80) + "). Ask: where did this show up in a deal last week?",
    motivation_headline_1: clip(yt.title, 60), motivation_headline_2: "Three things to take into every client conversation this week",
    pillar1_title: pt(pick(0)), pillar1_text: pick(0), pillar2_title: pt(pick(1)), pillar2_text: pick(1), pillar3_title: pt(pick(2)), pillar3_text: pick(2),
    clip_url: yt.url, clip_label: yt.title + (yt.channel ? " · " + yt.channel : ""),
    motivation_notes: "From the clip" + (yt.captions_ok ? " (captions)" : " (title and description only: no captions were available)") + ". Link each point to a real viewing, call or offer from last week.",
  };
}
export async function draftTheme(env, deps, yt, meta, redo) {
  let x = null;
  if (deps && deps.claudeJSON) {
    const sys = "You prepare the Monday sales huddle at FN Realty, a Dubai real-estate brokerage, for Najjuko (Strategic Lead). From ONE motivational video Ali chose, write the weekly theme slides FROM A SALES PERSPECTIVE: "
      + "what the agents should do differently with buyers, owners and leads this week. Plain, energetic English. Never invent statistics, quotes or names. Fit each field to its maximum length in characters: "
      + THEME_KEYS.map((k) => k + " " + ((meta[k] || {}).max || 80)).join(", ") + ". pillar1-3 = the three things the team learns from the clip (title of 2-3 words + one sentence). clip_url = the link exactly; clip_label = the video title"
      + (redo ? ". This is a second draft: take a clearly different angle from an obvious first draft." : ".");
    const user = "Video: " + yt.title + (yt.channel ? " (" + yt.channel + ")" : "") + "\nLink: " + yt.url + "\nDescription:\n" + String(yt.description || "").slice(0, 2500)
      + (yt.captions_ok ? "\n\nCaptions (automatic):\n" + yt.captions.slice(0, 12000) : "\n\n(No captions were available: work from the title and description only.)");
    try { x = await deps.claudeJSON(env, sys, user, schemaFor(THEME_KEYS), deps.model, 3000); } catch (e) { x = null; }
  }
  const v = x && typeof x === "object" ? x : themeFallback(yt, redo);
  v.clip_url = yt.url; if (!v.clip_label) v.clip_label = yt.title;
  return { values: fit(v, meta), by: x ? "model" : "plain" };
}
// one pasted update -> the section's fields
export async function draftPaste(env, deps, sid, text, keys, meta, prevForm) {
  const ks = keys.filter((k) => meta[k] && meta[k].editable);
  let x = null;
  if (deps && deps.claudeJSON) {
    const sys = "You fill one slide of FN Realty's Monday sales huddle from an update Najjuko pasted. Use ONLY what the update says; never invent names, numbers or dates; leave a field empty (\"\") when the update does not cover it. "
      + (sid === "tip" ? "This is the tip of the week: frame it as friendly support for everyone, never aimed at one person, and name no one. " : "")
      + (sid === "recognition" ? "Recognition: keep last week's wording for anything the update does not change. " : "")
      + "Fields and maximum characters: " + ks.map((k) => k + " " + meta[k].max).join(", ") + ".";
    const user = "The update:\n" + String(text).slice(0, 6000) + (prevForm ? "\n\nLast week's values (keep when unchanged):\n" + ks.map((k) => k + ": " + (Array.isArray(prevForm[k]) ? prevForm[k].join(" | ") : prevForm[k] || "")).join("\n") : "");
    try { x = await deps.claudeJSON(env, sys, user, schemaFor(ks), deps.model, 2500); } catch (e) { x = null; }
  }
  if (!x || typeof x !== "object") {   // plain: the lines of the update, in order, into the section's text fields; the whole update into the notes
    const lines = String(text).split(/\n+/).map((l) => l.trim()).filter(Boolean), notes = ks.filter((k) => /_notes$/.test(k)), body = ks.filter((k) => !/_notes$/.test(k));
    x = {}; if (sid === "recognition" && prevForm) for (const k of body) x[k] = prevForm[k] == null ? "" : prevForm[k];
    body.forEach((k, i) => { if (lines[i] != null) x[k] = meta[k].type === "list" ? [lines[i]] : lines[i]; });
    for (const k of notes) x[k] = String(text);
  }
  const out = {}; for (const k of ks) { if (!(k in x)) continue; const v = x[k]; out[k] = Array.isArray(v) ? v.map((s) => clip(s, meta[k].max)) : meta[k].type === "list" && typeof v === "string" && prevForm && Array.isArray(prevForm[k]) ? v.split(/\s*\|\s*|\n/).filter(Boolean).map((s) => clip(s, meta[k].max)) : clip(v, meta[k].max); }
  return { values: out, by: deps && deps.claudeJSON && x ? "model" : "plain" };
}
