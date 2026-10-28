// v663 - Momo recorder: SPEAKER SEPARATION ("who said what"), Kendall approved 28 Oct 2026. Works the same for every Work person: everything lives on the
// recording record (recw_) and its parts (recs_), so the per-person key rewriting of src/work_person.js keeps each person's speakers private.
// THIS REPO IS PUBLIC: no names or transcripts here; names come only from the recording's own "who is in the room" list or from the user.
//
// Engine: Deepgram Nova-3 on Workers AI, "@cf/deepgram/nova-3" - https://developers.cloudflare.com/workers-ai/models/nova-3/
//   Input (schema-input.json on that page): { audio: { body: <stream>, contentType: <mime> }, diarize, utterances, smart_format, punctuate, detect_language, ... };
//   only `audio` is required. diarize: "each word in the transcript will be assigned a speaker number starting at 0".
//   Output (schema-output.json): { results: { channels: [ { alternatives: [ { transcript, confidence, words: [ { word, start, end, confidence } ] } ] } ] } }.
//   The published output schema does not list `speaker` / `punctuated_word` on a word or a `results.utterances` array, although the diarize description says each
//   word carries a speaker number; so this reader takes speaker from words[].speaker, prefers results.utterances when it is present (Deepgram's own shape:
//   { start, end, transcript, speaker }), and treats a response with no usable words as a failure -> Whisper reads the part instead (engine recorded per part).
//   Cost basis (same page, 28 Oct 2026): USD 0.0052 per audio minute over HTTP (472.73 neurons/min) = about USD 0.31 per hour of audio.
//   Whisper fallback (@cf/openai/whisper-large-v3-turbo) is only called when Nova-3 fails or returns nothing.
export const DIAR_MODEL = "@cf/deepgram/nova-3";
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const clip = (s, n) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().slice(0, n);

export function sniffMime(bytes, declared) {
  const d = String(declared || "").split(";")[0].trim().toLowerCase();
  if (/^audio\//.test(d)) return d;
  const s4 = (o) => String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
  if (bytes.length >= 12) {
    if (s4(0) === "RIFF" && s4(8) === "WAVE") return "audio/wav";
    if (s4(4) === "ftyp") return "audio/mp4";
    if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return "audio/webm";
    if (s4(0) === "OggS") return "audio/ogg";
  }
  return "audio/webm";
}
// words -> utterances: a new utterance whenever the speaker changes or there is a pause over 2 s. Each is { t: start seconds within the part, s: speaker number, x: text }
export function uttsFromNova(out) {
  const r = out && out.results; if (!r) return null;
  if (Array.isArray(r.utterances) && r.utterances.length && r.utterances.every((u) => Number.isFinite(+u.speaker)))
    return r.utterances.map((u) => ({ t: +u.start || 0, s: +u.speaker, x: clip(u.transcript, 4000) })).filter((u) => u.x);
  const alt = r.channels && r.channels[0] && r.channels[0].alternatives && r.channels[0].alternatives[0];
  const words = alt && Array.isArray(alt.words) ? alt.words : [];
  if (!words.length) return null;
  const out2 = []; let cur = null;
  for (const w of words) {
    const s = Number.isFinite(+w.speaker) ? +w.speaker : 0, txt = String(w.punctuated_word || w.word || "");
    if (!txt) continue;
    if (!cur || cur.s !== s || (+w.start || 0) - cur.end > 2) { cur = { t: +w.start || 0, s, x: txt, end: +w.end || 0 }; out2.push(cur); }
    else { cur.x += " " + txt; cur.end = +w.end || cur.end; }
  }
  return out2.map((u) => ({ t: u.t, s: u.s, x: clip(u.x, 4000) })).filter((u) => u.x);
}
// one part of audio -> { text, utts?, engine }. Nova-3 with diarization first; Whisper (the pre-v663 engine) when Nova-3 throws or gives nothing.
export async function speechWithSpeakers(env, bytes, mime, whisper) {
  try {
    const out = await env.AI.run(DIAR_MODEL, { audio: { body: new Response(bytes).body, contentType: sniffMime(bytes, mime) }, diarize: true, utterances: true, smart_format: true, punctuate: true, detect_language: true });
    const utts = uttsFromNova(out);
    if (utts && utts.length) return { text: utts.map((u) => u.x).join(" "), utts, engine: "nova-3" };
  } catch (e) {}
  return { text: await whisper(env, bytes), engine: "whisper" };
}

// ---- labels across parts. A part's speaker numbers are its own: P<n>-S<k>. m.speakers = { groups: [{ id: "A", labels: [...], name, confidence, confirmed }], at }.
export const partLabel = (n, s) => "P" + n + "-S" + s;
export function labelsOf(segs) {
  const seen = new Map();
  for (const g of segs) for (const u of g.utts || []) { const l = partLabel(g.n, u.s); const e = seen.get(l) || { label: l, n: g.n, words: 0, ex: [] }; e.words += u.x.split(" ").length; if (e.ex.join(" ").length < 400) e.ex.push(u.x.slice(0, 200)); seen.set(l, e); }
  return [...seen.values()];
}
export function speakerName(m, label) {
  const gs = m && m.speakers && m.speakers.groups;
  if (gs) { const g = gs.find((x) => x.labels.includes(label)); if (g) return g.name || "Speaker " + g.id; }
  const k = /-S(\d+)$/.exec(label); return "Speaker " + (k ? +k[1] + 1 : "?");   // before matching: the part's own numbering
}
const MATCH_SCHEMA = { type: "object", additionalProperties: false, required: ["groups"], properties: { groups: { type: "array", items: { type: "object", additionalProperties: false, required: ["labels", "name", "confidence"],
  properties: { labels: { type: "array", items: { type: "string" } }, name: { type: "string" }, confidence: { type: "number" } } } } } };
// The "match speakers" step, after Stop. Candidate names are ONLY the recording's "who is in the room" list (m.attendees) plus names the user already confirmed.
// A proposal is kept only for real labels, each label once, and a name only when it is on that list with confidence >= 0.6; everyone else stays "Speaker A/B/...".
// (The v626 voice test is a separate one-off comparison that stores nothing, so it holds no voice samples to match against.)
export async function matchSpeakers(env, deps, m, segs) {
  const labels = labelsOf(segs); if (!labels.length) return null;
  const known = labels.map((l) => l.label), allowed = new Map();
  for (const a of m.attendees || []) if (a && a.n) allowed.set(a.n.toLowerCase(), a.n);
  const keep = ((m.speakers && m.speakers.groups) || []).filter((g) => g.confirmed);   // the user's own choices are never undone
  for (const g of keep) if (g.name) allowed.set(g.name.toLowerCase(), g.name);
  const taken = new Set(keep.flatMap((g) => g.labels)), groups = keep.map((g) => ({ ...g, labels: g.labels.filter((l) => known.includes(l)) })).filter((g) => g.labels.length);
  const open = labels.filter((l) => !taken.has(l.label));
  if (open.length && deps && deps.claudeJSON) {
    const sys = "You link speaker labels from an automatic meeting transcript. The recording was cut into five-minute parts and each part numbered its own speakers, so P0-S0 and P1-S0 may or may not be the same person. "
      + "Group the labels that are the same person, using what they talk about, how they speak and who they address. A label from one part is never in two groups, and two labels from the SAME part are different people. "
      + "Give a name ONLY if it is on the list of people in the room AND the excerpts make it clear (someone addresses them by name, or they introduce themselves); otherwise name is ''. Never invent a name. confidence is 0 to 1.";
    const user = "People in the room: " + ([...allowed.values()].join(", ") || "not given") + "\n\n" + open.map((l) => l.label + " (" + l.words + " words): " + l.ex.join(" / ")).join("\n").slice(0, 12000);
    let x = null; try { x = await deps.claudeJSON(env, sys, user, MATCH_SCHEMA, deps.model, 1200); } catch (e) { x = null; }
    for (const g of (x && Array.isArray(x.groups) ? x.groups : [])) {
      const parts = new Set(), ls = [];
      for (const l of Array.isArray(g.labels) ? g.labels : []) { const p = /^P(\d+)-/.exec(l); if (!known.includes(l) || taken.has(l) || !p || parts.has(p[1])) continue; parts.add(p[1]); ls.push(l); }
      if (!ls.length) continue; ls.forEach((l) => taken.add(l));
      const conf = Math.max(0, Math.min(1, +g.confidence || 0)), nm = allowed.get(String(g.name || "").trim().toLowerCase());
      groups.push({ labels: ls, name: nm && conf >= 0.6 ? nm : "", confidence: Math.round(conf * 100) / 100, confirmed: false });
    }
  }
  for (const l of labels) if (!taken.has(l.label)) groups.push({ labels: [l.label], name: "", confidence: 0, confirmed: false });
  // letters in order of first appearance
  const first = (g) => Math.min(...g.labels.map((l) => known.indexOf(l)));
  groups.sort((a, b) => first(a) - first(b)).forEach((g, i) => { g.id = i < 26 ? LETTERS[i] : "Z" + i; });
  return { groups, at: new Date().toISOString() };
}
// the user confirms, renames or merges on the transcript page; a name is applied to every line of that speaker in this meeting
export function editSpeakers(m, b) {
  const gs = m.speakers && m.speakers.groups; if (!gs) return "This recording has no speaker data.";
  const g = gs.find((x) => x.id === String(b.group || ""));
  if (!g) return "No speaker with that letter.";
  if (b.op === "merge") { const into = gs.find((x) => x.id === String(b.into || "")); if (!into || into === g) return "Pick another speaker to merge with."; into.labels = into.labels.concat(g.labels); into.confirmed = true; m.speakers.groups = gs.filter((x) => x !== g); return ""; }
  const name = clip(b.name, 60).replace(/[<>"]/g, "");
  g.name = name; g.confirmed = true; g.confidence = name ? 1 : 0; return "";
}
export const speakersOut = (m) => (m.speakers && m.speakers.groups || []).map((g) => ({ id: g.id, name: g.name || "", shown_as: g.name || "Speaker " + g.id, confidence: g.confidence, confirmed: !!g.confirmed, labels: g.labels.slice() }));
// the one rule every notes / minutes prompt gets, so owners come out by name and an unknown speaker is never guessed
export const SPEAKER_RULE = "Transcript lines may start with the speaker ('Name: ...'). Use those names for who said what and for each action's owner. A line from 'Speaker A', 'Speaker B' (and so on) is someone not yet identified: keep that label, never guess who it is. ";
