// v413 - DESK POSTING, PHASE 1: the whole loop for an Instagram post to @digitalabbotuae, from Kendall's own WhatsApp desk number.
// idea -> draft (caption + evidence) -> pictures -> preview with Approve / Edit / Skip -> improve -> approve -> slot -> publish on the
// minute tick -> "Posted" with the link -> insights. Nothing is posted without an explicit tap by the owner (plan.approved === true is set
// ONLY by the approval step), nothing auto-posts, and a failure goes to "held" with one message and no automatic retry.
// All side effects arrive through `deps` (send, buttons, image, llm, vision, fetchMedia, origin, now, sleep) so this file is testable offline.
// Docs: docs/DESK_POSTING_PHASE1.md
import { deskIgStatus, deskIgPublish, deskIgPublishCarousel, deskIgPermalink, deskIgPull } from "./ig_desk.js";
import { MOODS, musicIndex, libraryText, pickTrack, addTrack, moodOf } from "./music.js";   // v467 - music for posts

export const DP_VERSION = "v421";
// v421 (8 Oct): carousel slides are ALWAYS generated graphics from the house prompt; sent photos only on "use my photos" or a photo
// captioned post:; uncaptioned photos wait in a private inbox and get ONE question per burst; the preview sends every picture; no
// Approve without pictures; the publish tick refuses raw-photo carousels; /post regen <id>; /ref tag; owner import route.
const DIG = (s) => String(s == null ? "" : s).replace(/[^0-9]/g, "");
export const BRAND = { teal: "#0A4F4A", gold: "#C5A56A", cream: "#FBF7EC" };
export const LEGAL_LINE = "© 2026 DigitAlchemy® Tech Limited · ADGM No. 35004 · All rights reserved · contact@digitalabbot.io";
export const DAY_CAP_DEFAULT = 3, MAX_ROUNDS = 10, MAX_SLIDES = 8, EXPIRY_MS = 3 * 86400000, PLAN_TTL = 45 * 86400;
// An ESTIMATE of what one generated picture costs, per quality tier, in USD. It is a planning constant, NOT a price list: the provider's
// docs did not state a per-image price on 8 Oct 2026. Change it here when the invoice shows the real figure.
export const IMG_COST_EST = { low: 0.02, medium: 0.07, high: 0.19 };
export const IMG_CAP_DEFAULT = 20;

const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu;
const VENDOR = /\b(open\s?ai|chat\s?gpt|gpt[-\s]?[\w.]*|claude|anthropic|gemini|midjourney|dall[-\s]?e|copilot|llama|mistral|deepseek|perplexity|heygen|stable diffusion|language model|llm)\b/i;
const WORDNUM = /\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(-\w+)?\b|\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(hundred|thousand|million|billion)\b/i;
const MUSIC_MODES = ["none", "bed", "manual"];

// ---------- small helpers ----------
const rid = () => Math.random().toString(36).slice(2, 8);
const nowOf = (deps) => (deps && deps.now ? deps.now() : Date.now());
const sleepOf = (deps) => (deps && deps.sleep) || ((ms) => new Promise((r) => setTimeout(r, ms)));
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dub = (ms) => new Date(ms + 4 * 3600000);
export const dayKey = (ms) => dub(ms).toISOString().slice(0, 10);
export const monthKey = (ms) => dub(ms).toISOString().slice(0, 7).replace("-", "");
export function fmtSlot(ms) { const d = dub(ms); return DAYS[d.getUTCDay()] + " " + d.getUTCDate() + " " + MON[d.getUTCMonth()] + " " + String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0") + " Dubai"; }
export const stripEmoji = (s) => String(s == null ? "" : s).replace(EMOJI, "");
const a2l = (s) => String(s || "").replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660)).replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x6f0));
export function numsIn(text) {
  return (a2l(text).replace(/\u066c/g, ",").replace(/(\d),(?=\d)/g, "$1").match(/\d+(?:\.\d+)?/g) || []).filter((n) => n.replace(/\D/g, "").length >= 2);
}
// What may never reach public text: AI vendor / model names, "Dr. Digital Abbot", "Arabtec"; spacing of the brand; no emoji.
export function scrubPublic(s, lane) {
  let t = stripEmoji(s).replace(/Dr\.?\s+Digital\s*Abbot/gi, "Dr. Kendall Wilson, DigitAlchemy").replace(/Digital\s+Alchemy/gi, "DigitAlchemy");
  if (lane === "alchemy") t = t.replace(/\b(maquette|blocks)\b/gi, "digital footprint");
  return t.split(/\r?\n/).filter((l) => !VENDOR.test(l) && !/arabtec/i.test(l)).join("\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
const hasVendor = (s) => VENDOR.test(String(s || ""));

// ---------- KV ----------
const kvJ = async (env, k, d) => { try { const v = await env.MEETINGS.get(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const kvPut = (env, k, o, ttl) => env.MEETINGS.put(k, typeof o === "string" ? o : JSON.stringify(o), ttl ? { expirationTtl: ttl } : undefined);
export const getPlan = (env, id) => kvJ(env, "postplan_" + id, null);
export async function putPlan(env, p) {
  await kvPut(env, "postplan_" + p.id, p, PLAN_TTL);
  const ix = await kvJ(env, "postplan_index", []);
  if (!ix.includes(p.id)) { ix.unshift(p.id); await kvPut(env, "postplan_index", ix.slice(0, 80)); }
}
export async function allPlans(env) { const out = []; for (const id of await kvJ(env, "postplan_index", [])) { const p = await getPlan(env, id); if (p) out.push(p); } return out; }
const hist = (p, kind, note, now) => { (p.history = p.history || []).push({ at: new Date(now).toISOString(), kind, note: String(note || "").slice(0, 300) }); p.history = p.history.slice(-40); };

// ---------- slots, caps ----------
export const dayCap = (env) => Math.max(1, parseInt(env.IG_DAILY_CAP, 10) || DAY_CAP_DEFAULT);
// Mon / Wed / Sat 17:00 Dubai (= 13:00 UTC), the first free one at least 10 minutes away whose day is under the cap.
export function nextSlot(now, plans, cap) {
  const taken = new Set(plans.filter((p) => p.status === "scheduled" && p.slot).map((p) => p.slot));
  const perDay = {}; for (const p of plans) if (p.status === "scheduled" && p.slot) perDay[dayKey(p.slot)] = (perDay[dayKey(p.slot)] || 0) + 1;
  const base = new Date(now + 4 * 3600000); const y = base.getUTCFullYear(), m = base.getUTCMonth(), d0 = base.getUTCDate();
  for (let i = 0; i < 60; i++) {
    const t = Date.UTC(y, m, d0 + i, 13, 0, 0); const wd = new Date(t + 4 * 3600000).getUTCDay();
    if ((wd === 1 || wd === 3 || wd === 6) && t > now + 600000 && !taken.has(t) && (perDay[dayKey(t)] || 0) < cap) return t;
  }
  return now + 86400000;
}
const postedToday = async (env, now) => Number(await env.MEETINGS.get("desk_posts_day_" + dayKey(now))) || 0;

// ---------- costs ----------
export const costKey = (now) => "desk_costs_" + monthKey(now);
export const imgQuality = (env) => (IMG_COST_EST[env.DESK_IMG_QUALITY] ? env.DESK_IMG_QUALITY : "medium");
export async function costState(env, now) { return kvJ(env, costKey(now), { count: 0, est_usd: 0 }); }
const capUsd = (env) => (Number(env.IMG_MONTHLY_CAP_USD) > 0 ? Number(env.IMG_MONTHLY_CAP_USD) : IMG_CAP_DEFAULT);
export async function costText(env, now) {
  const c = await costState(env, now);
  return "Image spend " + monthKey(now) + ": " + c.count + " pictures, about USD " + c.est_usd.toFixed(2) + " (estimate, not a price: USD " + IMG_COST_EST[imgQuality(env)].toFixed(2) + " each) of the monthly cap USD " + capUsd(env).toFixed(2) + ".";
}

// ---------- the picture sources ----------
const OPENAI = "https://api.openai.com/v1/images";
const isJpeg = (b) => { const u = new Uint8Array(b, 0, Math.min(3, b.byteLength)); return u.length >= 3 && u[0] === 0xff && u[1] === 0xd8 && u[2] === 0xff; };
async function storeImage(env, bytes, ct) {
  const mid = rid() + rid() + rid();
  await env.MEETINGS.put("igm_" + mid, bytes, { expirationTtl: 14 * 86400 });
  await env.MEETINGS.put("igm_ct_" + mid, ct || "image/jpeg", { expirationTtl: 14 * 86400 });
  return mid;
}
const b64ToBuf = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
// One generated picture (JPEG asked for directly, so no conversion is needed). Refuses at the monthly cap. refs = approved reference photos.
export async function genImage(env, deps, prompt, refs, size) {   // v429 - size: "1024x1024" (Instagram) or "1536x1024" (widescreen, LinkedIn)
  size = size === "1536x1024" ? "1536x1024" : "1024x1024";
  const now = nowOf(deps), unit = IMG_COST_EST[imgQuality(env)], c = await costState(env, now);
  if (!env.OPENAI_API_KEY) return { err: "no image key set" };
  if (c.est_usd + unit > capUsd(env) + 1e-9) return { err: "cap", cap: true };
  let r;
  try {
    if (refs && refs.length) {
      const fd = new FormData(); fd.append("model", env.SCENE_MODEL || "gpt-image-1"); fd.append("prompt", prompt.slice(0, 3500)); fd.append("size", size); fd.append("quality", imgQuality(env)); fd.append("output_format", "jpeg");
      refs.forEach((b, i) => fd.append("image[]", new Blob([b], { type: "image/jpeg" }), "ref" + i + ".jpg"));
      r = await fetch(OPENAI + "/edits", { method: "POST", headers: { Authorization: "Bearer " + env.OPENAI_API_KEY }, body: fd });
    } else {
      r = await fetch(OPENAI + "/generations", { method: "POST", headers: { Authorization: "Bearer " + env.OPENAI_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ model: env.SCENE_MODEL || "gpt-image-1", prompt: prompt.slice(0, 3500), size, quality: imgQuality(env), output_format: "jpeg", n: 1 }) });
    }
  } catch (e) { return { err: "the picture service did not answer" }; }
  if (!r.ok) return { err: "the picture service refused (" + r.status + ")" };
  let j = null; try { j = await r.json(); } catch (e) {}
  const b64 = j && j.data && j.data[0] && j.data[0].b64_json;
  if (!b64) return { err: "no picture came back" };
  const bytes = b64ToBuf(b64);
  if (!isJpeg(bytes)) return { err: "the picture came back in the wrong format" };
  c.count += 1; c.est_usd = Math.round((c.est_usd + unit) * 1e4) / 1e4;
  await kvPut(env, costKey(now), c, 70 * 86400);
  return { bytes };
}
const STYLE = "Calm architectural illustration, teal (" + BRAND.teal + ") and gold (" + BRAND.gold + ") palette on a warm cream (" + BRAND.cream + ") ground, generous space, soft light, no text, no letters, no logos, no watermark. ";
const NO_PERSON = "No people, no faces, no hands, no portraits. ";
// One locked prompt per infographic slide, built from the slide spec and nothing else. The image model draws it; this code draws nothing.
export const LIKENESS = "Include the man shown in the reference photos, recognisably himself: same face, same build, same apparent age, no alteration of body or age. Only him in the picture, no other identifiable real people, no medical or financial endorsement, no logos. ";
// v421: withPerson = the Abbot hook slide composed with Kendall's approved references (images/edits); the text is still rendered by the model.
export function slidePrompt(s, i, n, last, withPerson) {
  const L = [
    "ONE square 1:1 infographic slide, clean uncluttered editorial, generous white space, large type, ONE idea only.",
    "Background: solid soft cream " + BRAND.cream + ". Deep teal " + BRAND.teal + " for headings and body, gold " + BRAND.gold + " for thin rules and accents only. Thin-line icon style. " + (withPerson ? LIKENESS + "He takes one side of the slide, the text the other; the text stays fully legible. No emoji." : "No photographs of people, no faces, no emoji."),
    "Render EXACTLY this text, spelled exactly as written, nothing added, nothing removed, nothing translated:",
    'TITLE: "' + s.title + '"',
  ];
  if (s.body) L.push('BODY: "' + s.body + '"');
  if (s.source) L.push('SOURCE (small, under the body): "' + s.source + '"');
  if (last) L.push('FOOTER (small, bottom strip, one line): "' + LEGAL_LINE + '"');
  L.push("Slide " + (i + 1) + " of " + n + ". Do not draw any seal, stamp or logo. Do not alter any word.");
  return L.join("\n");
}
export const expectedText = (s, last) => [s.title, s.body, s.source, last ? LEGAL_LINE : ""].filter(Boolean).join(" ");
const normWords = (t) => String(t || "").toLowerCase().replace(/[©®·]/g, " ").replace(/[^a-z0-9؀-ۿ@.]+/g, " ").replace(/\.(?=\s|$)/g, "").split(/\s+/).filter(Boolean);
export function textMatches(expected, got) {
  const want = normWords(expected), have = new Set(normWords(got)); if (!want.length) return true;
  return want.filter((w) => have.has(w)).length / want.length >= 0.9;
}
export const REF_TAGS = ["headshot", "three-quarter", "full-length", "speaking", "site", "formal", "casual", "general"];
export const REF_MIN = 3;
// v421: one place that saves a reference photo (caption ref:, the inbox "Reference photo" button, the owner import route)
async function addRef(env, bytes, tag, source, now, extra) {
  const ix = await kvJ(env, "desk_ref_index", []); const n = (ix.length ? Math.max(...ix) : 0) + 1;
  await env.MEETINGS.put("desk_refimg_" + n, bytes);
  await kvPut(env, "desk_ref_" + n, Object.assign({ n, tag, key: "desk_refimg_" + n, added: new Date(now).toISOString(), approved: true, source }, extra || {}));
  ix.push(n); await kvPut(env, "desk_ref_index", ix);
  return { n, total: ix.length };
}
export const markRefRequest = (env, now) => env.MEETINGS.put("desk_ref_request_at", String(now || Date.now()), { expirationTtl: 2 * 86400 });
const refRequestRecent = async (env, now) => { const v = Number(await env.MEETINGS.get("desk_ref_request_at")); return v > 0 && now - v < 86400000; };
// v421 migration: copy stored igm_<id> pictures into the reference set. Dry run unless apply. Skips ids already imported.
export async function refImport(env, ids, tag, apply, now) {
  now = now || Date.now(); tag = String(tag || "general").toLowerCase();
  if (!REF_TAGS.includes(tag)) return { ok: false, why: "tag must be one of " + REF_TAGS.join(", ") };
  if (!Array.isArray(ids) || !ids.length || ids.length > 60) return { ok: false, why: "ids must be a list of 1 to 60 igm_ media ids" };
  const done = new Set(); for (const n of await kvJ(env, "desk_ref_index", [])) { const m = await kvJ(env, "desk_ref_" + n, null); if (m && m.from_media) done.add(m.from_media); }
  const rows = [];
  for (const raw of ids) {
    const id = String(raw || "").replace(/^igm_/, "");
    if (!/^[a-z0-9]{6,40}$/.test(id)) { rows.push({ id, result: "bad id" }); continue; }
    if (done.has(id)) { rows.push({ id, result: "already imported" }); continue; }
    const b = await env.MEETINGS.get("igm_" + id, "arrayBuffer");
    if (!b || !b.byteLength) { rows.push({ id, result: "not found" }); continue; }
    if (!isJpeg(b)) { rows.push({ id, result: "not a JPEG" }); continue; }
    if (!apply) { rows.push({ id, result: "would import", bytes: b.byteLength }); continue; }
    const r = await addRef(env, b, tag, "owner upload 8 Oct, imported", now, { from_media: id }); done.add(id);
    rows.push({ id, result: "imported", n: r.n });
  }
  return { ok: true, dry: !apply, tag, rows, imported: rows.filter((r) => r.result === "imported").length, would: rows.filter((r) => r.result === "would import").length };
}
async function refList(env) { const out = []; for (const n of await kvJ(env, "desk_ref_index", [])) { const m = await kvJ(env, "desk_ref_" + n, null); if (m && m.approved === true) out.push(m); } return out; }
// 2-3 references for a scene, the best-matching tag first, then different tags so the face is seen from more than one angle
export async function pickRefs(env, idea, hint) {
  const all = await refList(env); const want = hint === "site" || hint === "speaking" ? hint : /\b(site|construction|building|tower|crane)\b/i.test(idea) ? "site" : /\b(speak|talk|keynote|conference|event|podcast|stage)\b/i.test(idea) ? "speaking" : /\b(formal|award|suit|ceremony)\b/i.test(idea) ? "formal" : "headshot";
  // v468 (Kendall 10 Oct: "you keep using the same exact picture ... the picture isn't rotating") - all 27 references were tagged
  // "general", so the old pick (the FIRST photo of each tag, then the first of the rest) returned the same three every time. Now a
  // cursor walks the whole set: a matching tag still goes first, but each call starts where the last one stopped.
  let cur = 0; try { cur = Number(await env.MEETINGS.get("desk_ref_cursor")) || 0; } catch (e) {}
  const rot = all.length ? all.slice(cur % all.length).concat(all.slice(0, cur % all.length)) : [];
  const order = [want, "three-quarter", "headshot", "casual", "full-length", "formal", "site", "speaking"]; const out = [];
  for (const t of order) { const m = rot.find((x) => x.tag === t && !out.includes(x)); if (m) out.push(m); if (out.length >= 3) break; }
  for (const m of rot) { if (out.length >= 3) break; if (!out.includes(m)) out.push(m); }
  try { if (all.length) await env.MEETINGS.put("desk_ref_cursor", String((cur + 3) % all.length)); } catch (e) {}
  const bufs = []; for (const m of out) { const b = await env.MEETINGS.get(m.key, "arrayBuffer"); if (b && b.byteLength) bufs.push(b); }
  return { bufs, count: all.length };
}
const withKendall = (idea) => /\bwith\s+kendall\b/i.test(String(idea || ""));
// v426 - the feed's picture and background choices (Kendall 8 Oct: "like Naj's feed: ideas, then a choice of picture and background")
export const PICTURE_CHOICES = [
  { id: "site", label: "You on site" },
  { id: "speaking", label: "You speaking or teaching" },
  { id: "scene", label: "A scene, no person" },
  { id: "slides", label: "Infographic slides (carousel)" },
];
export const BACKGROUND_CHOICES = [
  { id: "site", label: "Construction site" },
  { id: "office", label: "Office or boardroom" },
  { id: "skyline", label: "Dubai skyline" },
  { id: "studio", label: "Plain studio" },
  { id: "terrace", label: "Calm terrace at sunrise" },   // v429 - the Friday Reflection's setting; any post may use it
];
const POSE = {
  site: "He is on a construction site visit, wearing a white hard hat and a hi-vis vest, looking at the work or at a tablet. ",
  speaking: "He is speaking or teaching, mid-sentence, gesturing with one hand, as at a talk or a workshop. ",
};
const BACKGROUND = {
  site: "Setting: an active Dubai construction site, tower cranes and a concrete frame behind, daylight. ",
  office: "Setting: a calm modern Dubai office or boardroom, a large window, a table. ",
  skyline: "Setting: the Dubai skyline at golden hour, seen from a high terrace. ",
  studio: "Setting: a plain, warm studio backdrop in cream, nothing else. ",
  terrace: "Setting: a quiet terrace at sunrise, soft warm light, a coffee cup on a small table, the city calm and hazy in the distance. Relaxed, reflective mood. ",
};
const REF_CHECKLIST = "Aim for 8 to 12: front-facing neutral, three-quarter left and right, full-length, speaking or gesturing, on site, formal and casual, good light, only you in frame, no children or other people, no logos.";
const slugs = (idea) => { const w = String(idea || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((x) => x.length > 2); const out = []; for (let n = 3; n >= 1; n--) for (let i = 0; i + n <= w.length; i++) out.push(w.slice(i, i + n).join("-")); return out; };
async function renderFor(env, idea) {
  for (const s of slugs(idea)) { const b = await env.MEETINGS.get("img_render_" + s, "arrayBuffer"); if (b && b.byteLength && isJpeg(b)) return { bytes: b, slug: s }; }
  return null;
}

// Fills p.slides[i].img_key for every slide. Order: a picture Kendall sent > our own render (slide 1, idea names a project) > generated.
async function buildImages(env, deps, p, onlyIdx) {
  const notes = []; const n = p.slides.length;
  for (let i = 0; i < n; i++) {
    if (onlyIdx != null && i !== onlyIdx) continue;
    const s = p.slides[i];
    if (s.img_key && onlyIdx == null) continue;
    if (s.src === "sent" && s.img_key && p.use_my_photos) continue;
    if (s.src === "sent") { delete s.img_key; delete s.src; }      // v421: a sent photo is a slide ONLY when he said "use my photos"
    delete s.flag;
    if (p.type === "image" && i === 0 && !s.regen) { const rn = await renderFor(env, p.idea); if (rn) { s.img_key = await storeImage(env, rn.bytes, "image/jpeg"); s.src = "render"; s.alt = "Our own render, " + rn.slug.replace(/-/g, " "); continue; } }
    const infographic = p.type === "carousel";
    let refs = null;
    const hookWithHim = infographic && i === 0 && p.lane === "abbot";      // v421: the Abbot hook slide shows him when 3+ references are held
    // v426 feed choices: "site"/"speaking" always put him in the picture (either lane); "scene" never does; no choice = the v421 lane rule
    const personLane = p.picture === "scene" ? false : (p.picture === "site" || p.picture === "speaking") && !infographic ? true
      : hookWithHim || (!infographic && (p.lane === "abbot" || (p.lane === "alchemy" && withKendall(p.idea))));
    if (personLane) {
      const r = await pickRefs(env, p.idea, p.picture);
      if (r.count >= REF_MIN && r.bufs.length >= 2) refs = r.bufs.slice(0, 3);
      else notes.push((hookWithHim ? "Slide 1 is a text graphic without you" : "No person in the picture") + ": I hold " + r.count + " approved reference photo(s) and need at least " + REF_MIN + ". Send photos with the caption ref: <tag>.");
    }
    const last = i === n - 1;
    const prompt = infographic ? slidePrompt(s, i, n, last, !!refs) : STYLE + (refs ? "Place the man shown in the reference photos into this scene, recognisably himself: same face, same build, same apparent age, no alteration of body or age. Only him in the scene, no other identifiable real people, no medical or financial endorsement, no logos or text. " + (refs && POSE[p.picture] ? POSE[p.picture] : "") : NO_PERSON) + (BACKGROUND[p.background] || "") + "Subject: " + String(p.idea).replace(/\d+/g, "").slice(0, 300) + (s.regen ? " Variation " + s.regen + ": a different composition" + (p.background ? ", same setting." : " and background.") : "");
    let tries = infographic ? 3 : 1, g = null, ok = !infographic, checked = false;
    for (let t = 0; t < tries; t++) {
      g = await genImage(env, deps, prompt, refs);
      if (g.err) break;
      if (!infographic) break;
      if (!deps.vision) { checked = false; ok = true; break; }
      let seen = null; try { seen = await deps.vision(env, g.bytes, "image/jpeg", "Transcribe all the text visible in this image, exactly as written, nothing else."); } catch (e) {}
      if (seen == null) { checked = false; ok = true; break; }
      checked = true; ok = textMatches(expectedText(s, last), seen);
      if (ok) break;
    }
    if (g.err) { if (g.cap) return { cap: true, err: "the monthly picture budget is used up", notes }; return { err: g.err, notes }; }
    s.img_key = await storeImage(env, g.bytes, "image/jpeg"); s.src = refs ? "ai-person" : "ai"; s.regen = s.regen || 0; if (!infographic) s.prompt = prompt.slice(0, 3500);   // v429 - kept for /post wide
    if (infographic && checked && !ok) s.flag = "text check failed, please look";
    else if (infographic && !checked) s.flag = "text not checked";
    p.ai = true;
  }
  return { notes };
}

// ---------- the caption ----------
const LANE_VOICE = {
  abbot: "Voice: The Digital Abbot, Dr. Kendall Wilson's own account, tagline 'Complexity Into Clarity'. First-person teacher voice (I), plain construction-audience language, every acronym explained the first time, no hype, no selling. Topics: standards decoded, BIM, digital footprint and AI-governance explainers, short stories from my own career, podcast teasers. Credits, if any, read 'Created by Dr. Kendall Wilson, DigitAlchemy'.",
  alchemy: "Voice: DigitAlchemy, the company and platform (DigitAlchemy Tech Limited, ADGM). Third person, 'we', proof and outcomes: what the platform does, data governance, DigitOracle as the engine, project proof, training, events, partnerships. Hub71: we are a member. Say 'digital footprint' for the 3D model of buildings, never 'Blocks' or 'twin'.",
};
const SYS_COMMON = "You write Instagram captions for a Dubai built-environment company. Plain text only, no emoji, no markdown. Never name any AI model, AI company or AI tool. Never write a number that is not in the FACTS list or in the idea's own identifiers (like a standard number); if you have no fact for a number, leave the number out. Write big numbers in digits, never in words. Reply with JSON only: {\"hook\":\"one short line\",\"lines\":[{\"text\":\"a caption line\",\"fact\":\"fact id or empty\"}],\"hashtags\":[\"#a\",\"#b\",\"#c\"],\"slides\":[{\"title\":\"\",\"body\":\"\",\"fact\":\"\"}]}. lines: 2 to 4. hashtags: 3 to 5. slides only when asked.";
const parseJ = (t) => { try { const m = String(t || "").match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; } catch (e) { return null; } };
async function loadFacts(env) { const d = await kvJ(env, "mkt_latest", null); return ((d && d.facts) || []).filter((f) => f && f.id && f.figure).slice(0, 40); }
const factNorm = (f) => numsIn(f.figure + " " + f.says + " " + f.source);
const isDevSays = (f) => !!(f.developer_says || /developer (says|claims)/i.test(f.says || "") || (/developer/i.test(f.source || "") && !/DLD|register|Land Department|Ejari/i.test(f.source || "")));
const srcLabel = (f) => (isDevSays(f) ? "developer says: " : "") + String(f.source || "") + (/\b20\d\d\b/.test(String(f.source || "")) ? "" : " (register date not stated)");
const hashtagsOf = (arr, lane) => {
  const out = []; for (const h of (arr || [])) { const t = "#" + String(h).replace(/[^A-Za-z0-9_]/g, ""); if (t.length > 2 && !out.includes(t) && !hasVendor(t)) out.push(t); }
  for (const d of (lane === "abbot" ? ["#ComplexityIntoClarity", "#DigitalAbbot", "#Dubai", "#BIM", "#Standards"] : ["#DigitAlchemy", "#Dubai", "#DubaiRealEstate", "#BuiltEnvironment", "#DataGovernance"])) { if (out.length >= 3) break; if (!out.includes(d)) out.push(d); }
  return out.slice(0, 5);
};
// idea identifiers such as "ISO 30173" or "SC 10" are the idea's own, not claims about data
const idNums = (idea) => { const out = []; const rx = /\b(?:ISO|IEC|EN|BS|PAS|RIBA|IFC|COBie|SC|Stage|Part|Hall|Big\s?5)\W{0,3}(\d[\d.\-:]*)/gi; let m; while ((m = rx.exec(String(idea || "")))) out.push(...numsIn(m[1])); return out; };

// Turns the model's JSON into a caption that passes the evidence checks. Returns { caption, evidence, dropped, flags, slides }.
export function assemble(p, j, facts, extraAllow) {
  const dropped = [], flags = [];
  const byId = new Map(facts.map((f) => [f.id, f]));
  const pool = new Set([...facts.flatMap(factNorm), ...(p.allowNums || []), ...idNums(p.idea), ...(extraAllow || [])]);
  const test = (text, fid) => {
    const t = scrubPublic(text, p.lane); if (!t) return { bad: "empty" };
    if (WORDNUM.test(t)) return { bad: "a number written in words" };
    const f = fid && byId.get(fid); const own = f ? new Set(factNorm(f)) : null;
    for (const n of numsIn(t)) if (!(own && own.has(n)) && !pool.has(n)) return { bad: n };
    return { t };
  };
  let hook = null; const lines = [];
  const h = test(String((j && j.hook) || ""), "");
  if (h.t) hook = h.t; else if (j && j.hook) dropped.push("hook (" + h.bad + ")");
  for (const l of (j && j.lines) || []) {
    const o = typeof l === "string" ? { text: l, fact: "" } : l; const r = test(String(o.text || ""), o.fact);
    if (r.t) lines.push(r.t); else dropped.push('"' + String(o.text || "").slice(0, 50) + '" (' + (r.bad === "empty" ? "empty" : /^\d/.test(r.bad) ? "figure " + r.bad + " is not in the data" : r.bad) + ")");
  }
  if (!hook && lines.length) hook = lines.shift();
  const body = [hook].concat(lines.slice(0, 4)).filter(Boolean);
  if (!body.length) flags.push("no caption survived the evidence checks");
  if (!body.length) return { caption: "", evidence: [], dropped, flags, slides: [], tags: [] };
  const used = [], evidence = [];
  const bodyText = body.join(" ");
  for (const n of [...new Set(numsIn(bodyText))]) {
    const f = facts.find((x) => factNorm(x).includes(n));
    if (f) { evidence.push(n + ": " + f.figure + ", " + srcLabel(f)); if (!used.includes(f)) used.push(f); }
    else if ((p.allowNums || []).includes(n) || idNums(p.idea).includes(n)) evidence.push(n + ": from the idea or our own record, not market data");
    else evidence.push(n + ": from your message, not independently checked");
  }
  const sources = used.map(srcLabel);
  let cap = body.join("\n\n");
  if (sources.length) cap += "\n\nSource: " + sources.join(" | ");
  if (p.ai) cap += "\n\nIllustration.";
  const tags = hashtagsOf(j && j.hashtags, p.lane);
  cap = (cap + "\n\n" + tags.join(" ")).trim();
  if (cap.length > 2150) cap = cap.slice(0, 2150).replace(/\s+\S*$/, "");
  const slides = [];
  for (const s of ((j && j.slides) || []).slice(0, MAX_SLIDES)) {
    const t = test(String(s.title || ""), s.fact), b = s.body ? test(String(s.body), s.fact) : { t: "" };
    if (!t.t) { dropped.push("a slide title (" + t.bad + ")"); continue; }
    if (s.body && !b.t) { dropped.push('slide text "' + String(s.body).slice(0, 40) + '" (' + (/^\d/.test(b.bad) ? "figure " + b.bad + " is not in the data" : b.bad) + ")"); }
    const f = s.fact && byId.get(s.fact);
    slides.push({ title: t.t, body: b.t || "", source: f && b.t ? srcLabel(f) : "" });
  }
  return { caption: cap, evidence, dropped, flags, slides, tags };
}
async function llmDraft(env, deps, p, facts, instruction) {
  const sys = SYS_COMMON + " " + (LANE_VOICE[p.lane] || LANE_VOICE.abbot) + (p.kind === "motivation" ? " THIS POST IS MOTIVATIONAL, ABOUT LIFE ONLY (Kendall 10 Oct: either motivational or about work, never both): discipline, courage, resilience, gratitude, health, family, kindness, rest, purpose or growth, in Kendall's own warm first-person voice, like the Friday Reflection. Do NOT mention work, careers, construction, sites, projects, buildings, clients, teams, technology, DigitAlchemy or any product, and ignore any instruction above about the built environment for this post. One strong opening line, short lines, one honest personal example, no figures, no selling; end with a question or a call to act today. Hashtags about life and motivation only." : "") + (p.kind === "friday" ? " THIS POST IS THE FRIDAY REFLECTION: personal and about LIFE, not only work (health, family, kindness, courage, rest). Warm first person, no figures, no selling. The hook says it is Friday; the lines ask the three questions (what am I proud of this week, what made this week special, who do I want to be next week); the last line invites people to answer in the comments." : "") + (p.type === "carousel" ? " Also give 'slides': slide 1 is the hook, then 3 to 6 body slides each carrying ONE fact or step (title up to 8 words, body up to 20 words), and a last slide 'What to do next / follow' . Never more than " + MAX_SLIDES + " slides." : "");
  const fl = facts.map((f) => f.id + " | " + f.figure + " | " + f.says + " | " + srcLabel(f)).join("\n") || "(no facts available: write without any figure)";
  const user = "IDEA: " + p.idea + "\nFACTS:\n" + fl + (instruction ? "\nCURRENT CAPTION:\n" + (p.caption || "") + "\nCHANGE REQUESTED: " + instruction : "");
  let t = ""; try { t = await deps.llm(env, sys, user, 1100); } catch (e) {}
  return parseJ(t);
}
function carouselSkeleton(p, j) {
  let s = (j && j.slides) || [];
  if (!s.length) s = [{ title: String(p.idea).replace(/\d+/g, "").slice(0, 70) || "Today", body: "" }];
  return s;
}
function finishSlides(p, parsed, keepImgs) {
  const cta = { title: "What to do next", body: "Follow @digitalabbotuae for more. Complexity into clarity.", source: "" };
  let sl = parsed.slides.slice(0, MAX_SLIDES - 1);
  if (!sl.length) sl = [{ title: String(p.idea).replace(/\d+/g, "").slice(0, 70) || "Today", body: "", source: "" }];
  sl.push(cta);
  p.slides = sl.map((s, i) => Object.assign({}, s, p.use_my_photos && keepImgs && keepImgs[i] && keepImgs[i].src === "sent" ? { img_key: keepImgs[i].img_key, src: "sent" } : {}));
}

// ---------- preview ----------
function cardText(p) {
  const L = ["Draft " + p.id + " (" + p.type + ", lane " + p.lane + ", round " + (p.rounds || 0) + " of " + MAX_ROUNDS + ")", "", "Caption, exactly as it will go up:", "-----", p.caption || "(none)", "-----"];
  L.push("Evidence:"); if (p.evidence && p.evidence.length) for (const e of p.evidence) L.push("- " + e); else L.push("- no figures in this caption");
  if (p.dropped && p.dropped.length) { L.push("Left out because it could not be traced:"); for (const d of p.dropped) L.push("- " + d); }
  if (p.translation) L.push("Arabic caption: draft translation, please check.");
  if (p.type === "carousel") { L.push("Slides (" + p.slides.length + "):"); p.slides.forEach((s, i) => L.push((i + 1) + ". " + s.title + (s.body ? " / " + s.body : "") + (s.flag ? " [" + s.flag + "]" : ""))); }
  else if (p.slides[0] && p.slides[0].flag) L.push("Picture note: " + p.slides[0].flag);
  const srcs = p.slides.map((s, i) => (i + 1) + "=" + ({ sent: "your picture", render: "our own render", ai: "illustration", "ai-person": "illustration with your approved reference" }[s.src] || "none")).join(", ");
  L.push("Pictures: " + srcs + ".");
  for (const n of (p.notes || [])) L.push(n);
  L.push("Music: " + ((p.music && p.music.mode) || "none") + ".");
  return stripEmoji(L.join("\n"));
}
export const picturesMissing = (p) => !p.slides || !p.slides.length || p.slides.some((s) => !s.img_key);
// v421: the preview SENDS THE PICTURES: slide 1 with the card as its caption (card as a text right after when it is too long for a
// WhatsApp caption), then every other slide in order, then the buttons. No pictures = the first line says so and there is no Approve.
async function sendPreview(env, deps, p) {
  const origin = deps.origin(env), n = p.slides.length, missing = picturesMissing(p);
  let card = cardText(p);
  if (missing) card = "No pictures yet: " + (p.nopic_reason || "a picture is missing") + ". Approve comes back once every slide has its picture (/post regen " + p.id + ").\n\n" + card;
  let cardSent = false, k = 0;
  for (let i = 0; i < n && k < MAX_SLIDES; i++) {
    const s = p.slides[i]; if (!s.img_key) continue; k++;
    const label = "Draft " + p.id + (n > 1 ? ", slide " + (i + 1) + " of " + n : "") + (s.src === "ai" || s.src === "ai-person" ? " (illustration)" : "");
    const capT = !cardSent && card.length <= 1000 ? card : label;
    try { await deps.image(env, origin + "/ig_media/" + s.img_key, capT); if (capT === card) cardSent = true; } catch (e) {}
  }
  if (!cardSent) await deps.send(env, card);
  // v468 (Kendall 10 Oct: "there should be buttons") - New picture is one tap; the other changes sit under More options
  const btns = missing ? [{ id: "dp:" + p.id + ":newpic", title: "Make pictures" }, { id: "dp:" + p.id + ":more", title: "More options" }] : [{ id: "dp:" + p.id + ":ok", title: "Approve" }, { id: "dp:" + p.id + ":newpic", title: "New picture" }, { id: "dp:" + p.id + ":more", title: "More options" }];
  await deps.buttons(env, "Draft " + p.id + (missing ? ": no pictures yet, edit or skip?" : ": approve, edit or skip?"), btns);
}

// ---------- the draft step ----------
async function draftPlan(env, deps, p) {
  const now = nowOf(deps); const facts = await loadFacts(env);
  p.music = p.music || { mode: "none" };
  const j = await llmDraft(env, deps, p, facts, "");
  if (p.type === "carousel") { const sk = carouselSkeleton(p, j); j && (j.slides = j.slides && j.slides.length ? j.slides : sk); }
  const keep = p.slides;
  p.slides = p.slides && p.slides.length ? p.slides : [{ title: "", body: "", source: "" }];
  const img = await buildImagesFor(env, deps, p, j, facts, keep);
  return img;
}
// order matters: the slides are known before the pictures; the caption mentions "Illustration" only once pictures exist
async function buildImagesFor(env, deps, p, j, facts, keep) {
  const now = nowOf(deps);
  let a = assemble(p, j, facts);
  if (p.type === "carousel") finishSlides(p, a, keep); else p.slides = (keep && keep.length ? keep : [{}]).slice(0, 1).map((s) => ({ alt: s.alt || p.idea.slice(0, 100), img_key: s.img_key, src: s.src }));
  if (p.type === "image") p.slides[0].alt = scrubPublic(p.idea, p.lane).slice(0, 100);
  const r = await buildImages(env, deps, p);
  p.notes = r.notes || [];
  a = assemble(p, j, facts);      // again, now that p.ai is known, so the caption carries "Illustration."
  Object.assign(p, { caption: a.caption, evidence: a.evidence, dropped: a.dropped, tags: a.tags });
  // v421: a failed picture no longer ends silently: the plan is held, and the preview (no Approve button) says why in its first line
  if (r.cap || r.err) {
    p.status = "held"; p.held_reason = r.cap ? "the monthly picture budget is used up" : r.err; p.approved = false;
    p.nopic_reason = r.cap ? "the monthly picture budget (USD " + capUsd(env).toFixed(2) + ") is reached. " + (await costText(env, now)) + " Raise IMG_MONTHLY_CAP_USD, then /post regen " + p.id : r.err;
    hist(p, r.cap ? "cap" : "image", p.held_reason, now); await putPlan(env, p); await sendPreview(env, deps, p); return p;
  }
  delete p.nopic_reason;
  if (!p.caption) { p.notes.push("I could not build a caption that passes the evidence checks. Tap Edit and tell me what to say."); }
  if (!j) p.notes.push("The writing step did not answer, so there is no caption yet. Tap Edit and tell me what to say.");
  p.status = "draft"; p.facts_used = facts.length;
  hist(p, "draft", "drafted", now); await putPlan(env, p); await sendPreview(env, deps, p); return p;
}

// ---------- commands ----------
const LANE_Q = (id) => [{ id: "dp:" + id + ":laneA", title: "Abbot" }, { id: "dp:" + id + ":laneL", title: "Alchemy" }];
async function newPlan(env, deps, idea, lane, imgs, extra) {
  const now = nowOf(deps);
  const mine = !!(extra && extra.use_my_photos) && !!(imgs && imgs.length);      // v421: sent photos only by his explicit word
  if (!mine) imgs = [];
  const type = extra && extra.forceType ? extra.forceType : (imgs.length > 1) || /\b(carousel|slides|steps|decoded|guide|series|explainer|checklist)\b/i.test(idea) ? "carousel" : "image";   // v426: a feed choice fixes the format
  const p = Object.assign({ id: "p" + rid(), status: "draft", idea: stripEmoji(idea).trim(), type, lane: lane || "", caption: "", slides: imgs.map((k) => ({ img_key: k, src: "sent", alt: "" })), slot: null, created: now, expires_at: now + EXPIRY_MS, history: [], rounds: 0, music: { mode: "none" }, approved: false }, extra || {}, { use_my_photos: mine });
  if (p.type === "carousel" && p.slides.length) p.slides = p.slides.slice(0, 10);
  hist(p, "created", p.idea, now); await putPlan(env, p);
  if (!p.lane) { await deps.buttons(env, "Is this post for the Abbot (my own voice, explainers and stories) or for Alchemy (the company, proof and outcomes)?", LANE_Q(p.id)); return p; }
  await deps.send(env, "Drafting " + p.id + " (" + p.type + ", " + p.lane + ")...");
  return draftPlan(env, deps, p);
}
const IDEAS = [
  { lane: "abbot", text: "Complexity Into Clarity episode teaser: the one idea from the latest episode, in plain words", needs: "the episode notes" },
  { lane: "abbot", text: "Standards decoded: what ISO 30173 asks of a digital twin, step by step (carousel)", needs: "" },
  { lane: "abbot", text: "A short story from my own career: a handover that taught me why information needs one owner", needs: "" },
  { lane: "abbot", text: "AI governance explained for site teams: who signs off what a machine suggests (carousel)", needs: "" },
  { lane: "alchemy", text: "Platform proof: what our register coverage check found this month", needs: "a register figure", factKind: "re" },
  { lane: "alchemy", text: "The Brief: what a buyer sees in one page, and where each number comes from", needs: "" },
  { lane: "alchemy", text: "Our digital footprint of buildings: what it shows that a drawing does not (carousel)", needs: "" },
  { lane: "alchemy", text: "Big 5 Global, 23-26 Nov 2026, stand H4 SC 10, Hall 4: come and see the platform", needs: "", allow: ["23", "26", "10"] },
  { lane: "alchemy", text: "Training with CIOB and LUBM: what a site manager learns in the first week", needs: "the next course date" },
  { lane: "alchemy", text: "Hub71 member: what that means for the data we hold and how we govern it", needs: "" },
];
// v454 - the motivational four, used when the generated list falls short (Kendall 10 Oct: 3 + 3 + 4 motivational)
// v467 (Kendall 10 Oct: "the motivational quotes seem to still be like talking about work ... It should be motivational, like the Friday
// motivational. So it's either motivational or it has to do with work") - motivational means LIFE: no work, sites, projects, clients or buildings.
const MOT_IDEAS = [
  "Discipline beats motivation: the small habit that carries you on the days you do not feel like it",
  "The hardest season of my life taught me more than all the easy ones",
  "Courage is saying I don't know yet, and then going to find out",
  "Rest is not a reward you earn later: what changed when I stopped treating it like one",
  "Start before you feel ready; nobody ever feels ready",
  "Who you are is what you do when nobody is watching",
  "Gratitude is a muscle: three things I notice every morning",
  "Be kind to the version of you that is still learning",
].map((text) => ({ lane: "abbot", kind: "motivation", text, needs: "" }));
export async function ideasText(env, deps) {
  const now = nowOf(deps), facts = await loadFacts(env), wk = Math.floor(now / (7 * 86400000));
  const pick = []; const ab = IDEAS.filter((i) => i.lane === "abbot"), al = IDEAS.filter((i) => i.lane === "alchemy");
  for (let k = 0; k < 3; k++) pick.push(ab[(wk + k) % ab.length]); for (let k = 0; k < 2; k++) pick.push(al[(wk + k) % al.length]);
  const out = pick.map((i) => { const o = Object.assign({}, i); if (o.factKind) { const f = facts.find((x) => x.kind === o.factKind || x.block === "dldSales"); if (f) { o.text = o.text + " (" + f.says + ")"; o.fact = f.id; o.needs = ""; } } return o; });
  await kvPut(env, "desk_ideas", out, 14 * 86400);
  return "Five ideas for the week:\n" + out.map((o, i) => (i + 1) + ". [" + o.lane + "] " + o.text + (o.needs ? " (needs source: " + o.needs + ")" : "")).join("\n") + "\nReply /post 1 to /post 5 to draft one, or /post abbot: <your idea>.";
}
// ---------- v426 the feed: 10 ideas, then a picture choice and a background choice, then the usual draft -> preview -> approve ----------
const FEED_TTL = 3 * 3600;
// v429 (Kendall 9 Oct): a weekly LIFE reflection, not only work. Three questions, his one moment, a calm picture of him.
export const FRIDAY_IDEA = { lane: "abbot", kind: "friday", needs: "",
  text: "Friday Reflection, about life and not only work: what am I proud of this week, what made this week special, and who do I want to be next week" };
const FEED_SYS = "You suggest Instagram post ideas for two lanes of one Dubai built-environment brand. " + LANE_VOICE.abbot + " " + LANE_VOICE.alchemy +
  " Plain text, no emoji, no hashtags. Never name any AI model, AI company or AI tool. Never put a number in an idea unless it appears in the FACTS list. Each idea is ONE line, at most 18 words, specific and useful to people who build, own or manage buildings. Reply with JSON only: {\"ideas\":[{\"lane\":\"abbot\",\"text\":\"...\"}]}. Exactly 10 ideas: 3 abbot, 3 alchemy, then 4 with lane \"motivation\" - purely motivational ideas about LIFE (discipline, courage, resilience, gratitude, health, family, kindness, rest, purpose, growth), in the Abbot's own voice, like a Friday Reflection: NOT about work, careers, construction, sites, projects, buildings, clients, teams or the product. A post is either motivational or about work, never both.";   // v454 (Kendall 10 Oct): 3 + 3 + 4 motivational
export async function feedText(env, deps) {
  const now = nowOf(deps), facts = await loadFacts(env);
  let out = [];
  try {
    const user = "TODAY: " + dayKey(now) + "\nFACTS:\n" + (facts.map((f) => f.id + " | " + f.figure + " | " + f.says).join("\n") || "(none: no figures)") + "\nRecent ideas to avoid repeating:\n" + (await kvJ(env, "desk_ideas", [])).map((i) => i.text).join("\n");
    const j = parseJ(await deps.llm(env, FEED_SYS, user, 900));
    const pool = new Set(facts.flatMap(factNorm));
    for (const it of ((j && j.ideas) || [])) {
      const mot = it && it.lane === "motivation", lane = it && it.lane === "alchemy" ? "alchemy" : "abbot", text = scrubPublic(String((it && it.text) || ""), lane).slice(0, 160);
      if (!text || numsIn(text).some((x) => !pool.has(x) && !idNums(text).includes(x))) continue;      // an idea carrying an unsourced figure is dropped
      out.push(mot ? { lane: "abbot", kind: "motivation", text, needs: "" } : { lane, text, needs: "" });   // v454: motivational posts are in the Abbot's own voice
    }
  } catch (e) {}
  { const wk0 = Math.floor(now / 86400000); for (let k = 0; out.filter((o) => o.kind === "motivation").length < 4 && k < MOT_IDEAS.length; k++) { const i = MOT_IDEAS[(wk0 + k) % MOT_IDEAS.length]; if (!out.some((o) => o.text === i.text)) out.push(Object.assign({}, i)); } }   // v454: always four motivational
  { const mot = out.filter((o) => o.kind === "motivation").slice(0, 4), ab = out.filter((o) => !o.kind && o.lane === "abbot"), al = out.filter((o) => o.lane === "alchemy");
    out = ab.slice(0, 3).concat(al.slice(0, 3), mot, ab.slice(3), al.slice(3)); }   // v454: 3 Abbot, 3 Alchemy, 4 motivational, in that order
  if (out.length < 10) { const wk = Math.floor(now / (7 * 86400000)); for (let k = 0; out.length < 10 && k < IDEAS.length; k++) { const i = IDEAS[(wk + k) % IDEAS.length]; if (!out.some((o) => o.text === i.text)) out.push(Object.assign({}, i)); } }
  if (dub(now).getUTCDay() === 5) out.unshift(Object.assign({}, FRIDAY_IDEA));      // v429 - Fridays (Dubai): the Friday Reflection is idea 1
  out = out.slice(0, 10);
  await kvPut(env, "desk_ideas", out, 14 * 86400);
  await env.MEETINGS.put("desk_feed_open", String(now), { expirationTtl: FEED_TTL }); await env.MEETINGS.delete("desk_feed_pick");
  return "Your feed, " + dayKey(now) + ":\n" + out.map((o, i) => (i + 1) + ". [" + (o.kind === "motivation" ? "motivation" : o.kind === "friday" ? "friday" : o.lane) + "] " + o.text + (o.needs ? " (needs source: " + o.needs + ")" : "")).join("\n") + "\nReply with a number (1 to 10) to make one. Nothing is posted without your Approve.";
}
const menu = (title, list) => title + "\n" + list.map((c, i) => (i + 1) + ". " + c.label).join("\n") + "\nReply 1 to " + list.length + ".";
// a bare number while a feed or a choice is open; returns true when it was taken here
async function feedReply(env, deps, n) {
  const pick = await kvJ(env, "desk_feed_pick", null);
  if (pick && pick.step === "picture") {
    const c = PICTURE_CHOICES[n - 1]; if (!c) { await deps.send(env, menu("Pick a picture:", PICTURE_CHOICES)); return true; }
    if (c.id === "slides") { await env.MEETINGS.delete("desk_feed_pick"); await newPlan(env, deps, pick.idea, pick.lane, [], { forceType: "carousel", picture: "slides", from_feed: pick.n, allowNums: pick.allow || undefined, kind: pick.kind || undefined }); return true; }
    await kvPut(env, "desk_feed_pick", Object.assign(pick, { step: "background", picture: c.id }), FEED_TTL);
    await deps.send(env, menu(c.label + ". Now the background:", BACKGROUND_CHOICES)); return true;
  }
  if (pick && pick.step === "background") {
    const b = BACKGROUND_CHOICES[n - 1]; if (!b) { await deps.send(env, menu("Pick a background:", BACKGROUND_CHOICES)); return true; }
    await env.MEETINGS.delete("desk_feed_pick");
    await newPlan(env, deps, pick.idea, pick.lane, [], { forceType: "image", picture: pick.picture, background: b.id, from_feed: pick.n, allowNums: pick.allow || undefined, kind: pick.kind || undefined }); return true;
  }
  if (!(await env.MEETINGS.get("desk_feed_open"))) return false;
  const L = await kvJ(env, "desk_ideas", []), it = L[n - 1];
  if (!it) { await deps.send(env, "No idea " + n + " in today's feed. Reply 1 to " + L.length + ", or send feed for a new list."); return true; }
  await kvPut(env, "desk_feed_pick", { step: "picture", n, idea: it.text, lane: it.lane, allow: it.allow || null, kind: it.kind || null }, FEED_TTL);
  await deps.send(env, menu("Idea " + n + ": " + it.text + "\nPick a picture:", PICTURE_CHOICES)); return true;
}
async function queueText(env, deps) {
  const now = nowOf(deps), ps = (await allPlans(env)).filter((p) => ["draft", "editing", "approving", "scheduled", "held", "publishing"].includes(p.status));
  const L = ["Queue (" + ps.length + ")"];
  if (!ps.length) L.push("Nothing waiting.");
  for (const p of ps) L.push("- " + p.id + " [" + p.status + "] " + p.lane + " " + p.type + (p.slot ? ", " + (p.slot <= now ? "due now" : fmtSlot(p.slot)) : "") + ": " + p.idea.slice(0, 50) + (p.held_reason ? " (held: " + p.held_reason + ")" : ""));
  const s = []; let t = now; const sim = (await allPlans(env));
  for (let i = 0; i < 3; i++) { const x = nextSlot(t, sim, dayCap(env)); s.push(fmtSlot(x)); sim.push({ status: "scheduled", slot: x }); t = x; }
  L.push("Next free slots: " + s.join("; ") + ".");
  L.push("Daily cap " + dayCap(env) + "; today posted " + (await postedToday(env, now)) + ". Posting is " + ((await env.MEETINGS.get("desk_post_pause")) ? "PAUSED" : "on") + ".");
  return L.join("\n");
}
async function insightsText(env) {
  const posted = (await allPlans(env)).filter((p) => p.status === "posted" && p.media_id).sort((a, b) => (b.posted_at || 0) - (a.posted_at || 0)).slice(0, 5);
  const M = await kvJ(env, "desk_ig_media", {}), A = await kvJ(env, "desk_ig_account", null);
  const L = ["Desk Instagram" + (A ? ": " + A.followers + " followers (read " + A.at.slice(0, 10) + ")" : "")];
  if (!posted.length) L.push("No posts from the desk yet.");
  for (const p of posted) { const m = (M[p.media_id] || {}).m; L.push("- " + p.id + " " + dayKey(p.posted_at) + " " + p.type + ": " + (m ? "reach " + (m.reach ?? "n/a") + ", likes " + (m.likes ?? "n/a") + ", saves " + (m.saved ?? "n/a") + (m.views != null ? ", views " + m.views : "") + (m.shares != null ? ", shares " + m.shares : "") + (m.follows != null ? ", new followers " + m.follows : "") + (m.profile_visits != null ? ", profile visits " + m.profile_visits : "") : "numbers not read yet (every 3 hours)") + (p.permalink ? " " + p.permalink : "")); }
  return L.join("\n");
}

// ---------- editing ----------
export function classifyEdit(t) {
  const s = String(t || "").trim();
  let m;
  if ((m = s.match(/^swap\s+image\s+(\d+)/i))) return { kind: "image", idx: Number(m[1]) - 1 };
  if (/^another\s+background\b/i.test(s)) return { kind: "image", idx: 0 };
  if (/\barabic\b/i.test(s)) return { kind: "arabic" };
  return { kind: "caption", text: s };
}
async function applyEdit(env, deps, p, text) {
  const now = nowOf(deps);
  if ((p.rounds || 0) >= MAX_ROUNDS) { await deps.send(env, "Draft " + p.id + " has used all " + MAX_ROUNDS + " edit rounds. Approve it, skip it, or start fresh with /post."); return; }
  p.rounds = (p.rounds || 0) + 1; hist(p, "edit", text, now);
  const c = classifyEdit(text);
  if (c.kind === "image") {
    const s = p.slides[c.idx];
    if (!s) { p.rounds--; await deps.send(env, "There is no picture " + (c.idx + 1) + " in this draft."); return; }
    if (s.src === "sent") { p.rounds--; await deps.send(env, "Picture " + (c.idx + 1) + " is the one you sent. Send a new picture to replace it."); return; }
    s.regen = (s.regen || 0) + 1; delete s.img_key;
    const r = await buildImages(env, deps, p, c.idx);
    if (r.cap) { await deps.send(env, "The monthly picture budget is reached (" + (await costText(env, now)) + ") so I kept the old picture."); }
    else if (r.err) await deps.send(env, "Could not make a new picture: " + r.err + ".");
    p.notes = (r.notes || []);
  } else {
    const facts = await loadFacts(env);
    let extra = [], instr = c.kind === "arabic" ? "Translate the caption into Arabic, keep every number as a digit, keep the hashtags. Do not add anything." : c.text;
    if (c.kind === "caption" && /^add\b/i.test(c.text)) extra = numsIn(c.text);
    if (c.kind === "arabic") p.translation = true;
    const j = await llmDraft(env, deps, p, facts, instr);
    if (!j) { p.rounds--; await deps.send(env, "The writing step did not answer. Nothing changed; please try again."); return; }
    const a = assemble(p, j, facts, extra);
    if (!a.caption) { p.rounds--; await deps.send(env, "That change left no usable caption (" + (a.dropped.join("; ") || "empty") + "). Nothing changed."); return; }
    Object.assign(p, { caption: a.caption, evidence: a.evidence, dropped: a.dropped, tags: a.tags });
    if (c.kind !== "arabic") p.translation = false;
    if (p.type === "carousel" && a.slides.length && c.kind === "caption") { /* slides stay: only the affected part (the caption) is re-drafted */ }
  }
  await putPlan(env, p); await sendPreview(env, deps, p);
}

// ---------- buttons ----------
async function approve(env, deps, p) {
  if (!p.caption) { await deps.send(env, "Draft " + p.id + " has no caption yet. Tap Edit and tell me what to say."); return; }
  if (picturesMissing(p)) { await deps.send(env, "Draft " + p.id + " has no pictures yet, so it cannot be approved. Send /post regen " + p.id + " to make them."); return; }
  const g = publishGuard(p); if (g) { await deps.send(env, "Draft " + p.id + " cannot be approved: " + g + ". Send /post regen " + p.id + "."); return; }
  p.approved = true; p.approved_at = nowOf(deps); p.status = "approving"; p.expires_at = nowOf(deps) + 14 * 86400000;
  hist(p, "approved", "owner tapped Approve", nowOf(deps));
  await putPlan(env, p); await env.MEETINGS.delete("desk_post_editing");
  await deps.buttons(env, "Approved. Post now, or next slot (Mon/Wed/Sat 17:00 Dubai)?", [{ id: "dp:" + p.id + ":now", title: "Post now" }, { id: "dp:" + p.id + ":slot", title: "Next slot" }]);
}
async function schedule(env, deps, p, mode) {
  const now = nowOf(deps), plans = await allPlans(env), cap = dayCap(env);
  let slot, note = "";
  if (mode === "now") {
    const used = (await postedToday(env, now)) + plans.filter((x) => x.id !== p.id && x.status === "scheduled" && dayKey(x.slot) === dayKey(now)).length;
    if (used >= cap) { slot = nextSlot(now, plans, cap); note = "The cap of " + cap + " posts a day is reached today, so it moves to the next slot. "; } else slot = now;
  } else slot = nextSlot(now, plans, cap);
  p.slot = slot; p.status = "scheduled"; hist(p, "scheduled", fmtSlot(slot), now); await putPlan(env, p);
  await deps.send(env, note + (slot <= now ? "Scheduled " + p.id + " to post within a minute." : "Scheduled " + p.id + " for " + fmtSlot(slot) + ".") + (await env.MEETINGS.get("desk_post_pause") ? " Posting is paused right now (/resume)." : ""));
}
async function handleButton(env, deps, id) {
  const im = String(id).match(/^dp:inbox:(ref|use|ignore)$/); if (im) return inboxButton(env, deps, im[1], nowOf(deps));
  if (id === "dp:ref:keep") { await deps.send(env, "Kept."); return true; }
  if (id === "dp:ref:purge") { const ix = await kvJ(env, "desk_ref_index", []); for (const n of ix) { await env.MEETINGS.delete("desk_ref_" + n); await env.MEETINGS.delete("desk_refimg_" + n); } await env.MEETINGS.delete("desk_ref_index"); await env.MEETINGS.delete("desk_ref_cursor"); await deps.send(env, "All " + ix.length + " reference photos deleted."); return true; }
  // v466 - "post" alone: what kind of post, by tapping
  if (id === "dp:start:ideas") return deskPostRoute(env, { type: "text" }, "/ideas", deps);
  if (id === "dp:start:abbot" || id === "dp:start:alchemy") { const lane = id.slice(9); await kvPut(env, "desk_post_wait", lane, 3600); await deps.send(env, "Type the idea in one line (your next message), for example: why a handover needs one owner. Or send a photo with it as the caption."); return true; }
  const mm = String(id).match(/^dp:([a-z0-9]+):(music|nomusic|muse|mtry|mno|m_(calm|corporate|upbeat|cinematic|inspiring))$/);   // v467 - music
  if (mm) { const pm = await getPlan(env, mm[1]); if (!pm) { await deps.send(env, "That draft has expired."); return true; } return musicStep(env, deps, pm, mm[2], mm[3]); }
  // v468 - the change buttons: New picture, and More options (a list: rewrite, shorter, punchier, more formal, other background, Arabic, type a change, skip)
  const xm = String(id).match(/^dp:([a-z0-9]+):(newpic|more|e_short|e_punch|e_formal|e_bg|e_rewrite|e_arabic)$/);
  if (xm) {
    const px = await getPlan(env, xm[1]); if (!px) { await deps.send(env, "That draft has expired."); return true; }
    if (!["draft", "editing"].includes(px.status)) { await deps.send(env, "Draft " + px.id + " is " + px.status + "."); return true; }
    const a = xm[2];
    if (a === "more") {
      const rows = [{ id: "dp:" + px.id + ":e_rewrite", title: "Rewrite the caption", description: "A fresh version, same idea" },
        { id: "dp:" + px.id + ":e_short", title: "Shorter" }, { id: "dp:" + px.id + ":e_punch", title: "Punchier" }, { id: "dp:" + px.id + ":e_formal", title: "More formal" },
        { id: "dp:" + px.id + ":e_bg", title: "Another background", description: "Same idea, a different setting" }, { id: "dp:" + px.id + ":e_arabic", title: "Arabic version" },
        { id: "dp:" + px.id + ":edit", title: "Type my own change", description: "Your next message is the change" }, { id: "dp:" + px.id + ":skip", title: "Skip this post", description: "Nothing is posted" }];
      if (deps.list) await deps.list(env, "What should change on " + px.id + "?", "Choose a change", rows);
      else await deps.buttons(env, "What should change?", [{ id: "dp:" + px.id + ":e_rewrite", title: "Rewrite caption" }, { id: "dp:" + px.id + ":edit", title: "Type a change" }, { id: "dp:" + px.id + ":skip", title: "Skip" }]);
      return true;
    }
    px.status = "editing"; await putPlan(env, px);
    if (a === "newpic") {
      if (!(px.slides || []).some((s) => s.img_key)) { await deps.send(env, "Making the pictures for " + px.id + "..."); await regenPlan(env, deps, px); return true; }
      await deps.send(env, "Making a new picture for " + px.id + "..."); await applyEdit(env, deps, px, "swap image 1"); return true;
    }
    if (a === "e_bg") { const ids = BACKGROUND_CHOICES.map((b) => b.id); px.background = ids[(ids.indexOf(px.background) + 1) % ids.length]; await putPlan(env, px); await deps.send(env, "New setting: " + BACKGROUND_CHOICES.find((b) => b.id === px.background).label + ". Making the picture..."); await applyEdit(env, deps, px, "another background"); return true; }
    const say = { e_short: "shorter", e_punch: "punchier", e_formal: "more formal", e_bg: "another background", e_rewrite: "rewrite the caption completely in a fresh way, same idea and facts", e_arabic: "arabic version" }[a];
    await deps.send(env, "Working on it..."); await applyEdit(env, deps, px, say); return true;
  }
  const m = String(id).match(/^dp:([a-z0-9]+):(ok|edit|skip|now|slot|laneA|laneL|wig|wli|wboth)$/);
  if (!m) return false;
  const p = await getPlan(env, m[1]);
  if (!p) { await deps.send(env, "That draft has expired."); return true; }
  const act = m[2], now = nowOf(deps);
  if (["posted", "cancelled", "skipped", "expired", "scheduled", "publishing"].includes(p.status) && act !== "skip") { await deps.send(env, "Draft " + p.id + " is already " + p.status + "."); return true; }
  if (act === "laneA" || act === "laneL") { p.lane = act === "laneA" ? "abbot" : "alchemy"; await putPlan(env, p); await deps.send(env, "Drafting " + p.id + " (" + p.type + ", " + p.lane + ")..."); await draftPlan(env, deps, p); return true; }
  if (act === "skip") { if (p.status === "scheduled") { await deps.send(env, "Draft " + p.id + " is scheduled; use /post cancel " + p.id + "."); return true; } p.status = "skipped"; hist(p, "skipped", "", now); await putPlan(env, p); await env.MEETINGS.delete("desk_post_editing"); await deps.send(env, "Skipped " + p.id + ". Nothing was posted."); return true; }
  if (act === "edit") { p.status = "editing"; await putPlan(env, p); await kvPut(env, "desk_post_editing", p.id, 3 * 86400); await deps.send(env, "Tell me what to change on " + p.id + ": shorter, punchier, more formal, add <fact>, remove <x>, swap image <n>, another background, or Arabic version. (" + (MAX_ROUNDS - (p.rounds || 0)) + " rounds left.)"); return true; }
  if (act === "ok" || act === "wig" || act === "wli" || act === "wboth") {
    if (p.status !== "draft" && p.status !== "editing") { await deps.send(env, "Draft " + p.id + " is " + p.status + "."); return true; }
    // v467 - Approve first offers music (when the video service is connected)
    if (act === "ok" && deps.render && !p.music_asked) {
      await deps.buttons(env, "Post " + p.id + " as it is, or add music? (With music it goes out as a short video.)", [{ id: "dp:" + p.id + ":nomusic", title: "Post as is" }, { id: "dp:" + p.id + ":music", title: "Add music" }]);
      return true;
    }
    // v466 - with LinkedIn connected, Approve first asks where the post goes
    if (act === "ok" && deps.liConnected && await deps.liConnected(env)) {
      await deps.buttons(env, "Post " + p.id + " where?", [{ id: "dp:" + p.id + ":wig", title: "Instagram" }, { id: "dp:" + p.id + ":wli", title: "LinkedIn" }, { id: "dp:" + p.id + ":wboth", title: "Both" }]);
      return true;
    }
    p.targets = act === "wli" ? ["li"] : act === "wboth" ? ["ig", "li"] : ["ig"]; await putPlan(env, p);
    await approve(env, deps, p); return true;
  }
  if (act === "now" || act === "slot") { if (p.status !== "approving" || p.approved !== true) { await deps.send(env, "Draft " + p.id + " is not approved yet."); return true; } await schedule(env, deps, p, act); return true; }
  return true;
}

// ---------- v467 music: Approve -> Post as is / Add music -> mood -> preview video -> Use it / Another track / No music ----------
// "Use it" hands the video to the desk's video flow (Post it -> Instagram / LinkedIn / Both); the picture plan is then closed as "as-video".
async function musicStep(env, deps, p, act, mood) {
  if (!["draft", "editing"].includes(p.status)) { await deps.send(env, "Draft " + p.id + " is " + p.status + "."); return true; }
  const origin = deps.origin(env);
  if (act === "nomusic" || act === "mno") { p.music_asked = true; p.music = { mode: "none" }; await putPlan(env, p); return handleButton(env, deps, "dp:" + p.id + ":ok"); }
  const ix = await musicIndex(env);
  if (act === "music") {
    const have = MOODS.filter((m) => (ix[m] || []).length);
    if (!have.length) { await deps.send(env, libraryText(ix)); return true; }
    if (have.length <= 3 || !deps.list) await deps.buttons(env, "Which mood?", have.slice(0, 3).map((m) => ({ id: "dp:" + p.id + ":m_" + m, title: m.charAt(0).toUpperCase() + m.slice(1) })));
    else await deps.list(env, "Which mood for " + p.id + "?", "Pick a mood", have.map((m) => ({ id: "dp:" + p.id + ":m_" + m, title: m.charAt(0).toUpperCase() + m.slice(1), description: ix[m].length + " track" + (ix[m].length > 1 ? "s" : "") })));
    return true;
  }
  if (act === "muse") {
    if (!p.video_key) { await deps.send(env, "No music video is ready for " + p.id + "."); return true; }
    await env.MEETINGS.put("desk_reel_pending", JSON.stringify({ url: origin + "/video/" + p.video_key, caption: p.caption, at: Date.now() }), { expirationTtl: 2 * 86400 });
    p.status = "as-video"; hist(p, "as-video", p.video_key, nowOf(deps)); await putPlan(env, p);
    await deps.buttons(env, "Post " + p.id + " as a video with music?", [{ id: "dr:ok", title: "Post it" }, { id: "dc:ai:reel:" + p.video_key, title: "Rewrite caption" }, { id: "dr:no", title: "Cancel" }]);
    return true;
  }
  const md = act === "mtry" ? p.music_mood : mood;
  const track = pickTrack(ix, md, p.music_last);
  if (!track) { await deps.send(env, "No " + md + " tracks in the library. " + libraryText(ix)); return true; }
  const imgs = (p.slides || []).filter((s) => s.img_key).map((s) => origin + "/ig_media/" + s.img_key);
  if (!imgs.length) { await deps.send(env, "Draft " + p.id + " has no pictures to make a video from."); return true; }
  await deps.send(env, "Making the video with " + track.title + " (" + md + "). About half a minute...");
  const r = await deps.render(env, { images: imgs, audio: origin + "/music/" + track.key, seconds: imgs.length === 1 ? 12 : 4, width: 1080, height: 1920 });
  if (r.err) { await deps.send(env, "Could not make the video: " + r.err + ". Tap Post as is, or try again."); return true; }
  const key = "post_" + p.id;
  await env.MEETINGS.put("vid_" + key, r.bytes, { expirationTtl: 60 * 86400 });
  p.video_key = key; p.music_last = track.key; p.music_mood = md; p.music = { mode: "bed", track: track.title, mood: md }; hist(p, "music", track.title, nowOf(deps)); await putPlan(env, p);
  if (deps.video) await deps.video(env, origin + "/video/" + key, "Draft " + p.id + " with music: " + track.title + " (" + md + ").");
  await deps.buttons(env, "Use this version?", [{ id: "dp:" + p.id + ":muse", title: "Use it" }, { id: "dp:" + p.id + ":mtry", title: "Another track" }, { id: "dp:" + p.id + ":mno", title: "No music" }]);
  return true;
}

// ---------- pictures sent by Kendall ----------
async function takeImage(env, deps, msg) {
  let m; try { m = await deps.fetchMedia(env, msg.image.id); } catch (e) { return { err: "I could not read that picture. Send it again." }; }
  if (!m || !m.bytes || !m.bytes.byteLength) return { err: "I could not read that picture. Send it again." };
  if (!isJpeg(m.bytes)) return { err: "Instagram needs a JPEG. Send it as a photo (not as a file or a screenshot in another format)." };
  if (m.bytes.byteLength > 8 * 1024 * 1024) return { err: "That picture is over 8 MB. Send a smaller one." };
  return { bytes: m.bytes };
}
async function handleImage(env, deps, msg) {
  const cap = String((msg.image && msg.image.caption) || "").trim(), now = nowOf(deps);
  const t = await takeImage(env, deps, msg);
  if (t.err) { await deps.send(env, t.err); return true; }
  const rm = cap.match(/^(?:\/ref\s+add|ref)\s*[: ]\s*([\w-]*)/i) || (/^\/ref\s+add\s*$/i.test(cap) ? ["", ""] : null);
  if (rm) {
    await markRefRequest(env, now);
    const tag = String(rm[1] || "").toLowerCase();
    if (!REF_TAGS.includes(tag)) { await deps.send(env, "Which kind of photo is it? Send it again with the caption ref: <tag>, where tag is one of " + REF_TAGS.join(", ") + "."); return true; }
    const r = await addRef(env, t.bytes, tag, "owner upload", now);
    await deps.send(env, "Reference saved: " + tag + " (" + r.total + " total). " + REF_CHECKLIST);
    return true;
  }
  const eid = await env.MEETINGS.get("desk_post_editing"); const ep = eid && await getPlan(env, eid);
  if (ep && ep.status === "editing" && !/^(\/post|post\b)/i.test(cap)) {
    t.key = await storeImage(env, t.bytes, "image/jpeg");
    const n = Math.max(1, parseInt((cap.match(/\d+/) || ["1"])[0], 10)); const i = Math.min(n, p0(ep.slides.length)) - 1;
    ep.slides[i] = Object.assign(ep.slides[i] || {}, { img_key: t.key, src: "sent", alt: "" }); delete ep.slides[i].flag; delete ep.slides[i].regen;
    ep.rounds = (ep.rounds || 0) + 1; hist(ep, "edit", "swap image " + (i + 1) + " (sent)", now); await putPlan(env, ep); await sendPreview(env, deps, ep); return true;
  }
  const pm = cap.match(/^(?:\/post\b|post\b)\s*[:\-]?\s*(.*)$/is);
  if (pm) {
    // v421: a photo captioned post: <idea> is a single-image post of THAT photo; earlier photos join only when he says "use my photos"
    t.key = await storeImage(env, t.bytes, "image/jpeg");
    const rest = pm[1] || "Post this picture";
    const pend = MY_PHOTOS.test(rest) ? (await pendingMine(env, true)) : [];
    return startFromText(env, deps, rest, pend.concat([t.key]).slice(-MAX_SLIDES), true);
  }
  // v421: an uncaptioned photo is NEVER silently a slide. It waits privately in the inbox; the minute tick asks ONE question per burst.
  const ib = await kvJ(env, "desk_post_inbox", { items: [] });
  const ik = "desk_inbox_img_" + rid() + rid() + rid();
  await env.MEETINGS.put(ik, t.bytes, { expirationTtl: 86400 });
  ib.items.push({ k: ik, at: now }); ib.items = ib.items.slice(-40); ib.first_at = ib.first_at || now; ib.last_at = now; ib.asked = false;
  await kvPut(env, "desk_post_inbox", ib, 86400);
  return true;
}
// "use my photos" / "with my photos": the only words that turn sent photos into post pictures
export const MY_PHOTOS = /\b(use|with)\s+my\s+(own\s+)?(photos?|pictures?|pics?|images?)\b/i;
// photos he chose with "Use in a post", plus (when he says use my photos) whatever waits in the inbox; copied to the public media route only now
async function pendingMine(env, withInbox) {
  const keys = await kvJ(env, "desk_post_pendimg", []); await env.MEETINGS.delete("desk_post_pendimg");
  const ib = await kvJ(env, "desk_post_inbox", null);
  if (withInbox && ib && ib.items && ib.items.length) { for (const it of ib.items) { const b = await env.MEETINGS.get(it.k, "arrayBuffer"); if (b && b.byteLength) keys.push(await storeImage(env, b, "image/jpeg")); await env.MEETINGS.delete(it.k); } await env.MEETINGS.delete("desk_post_inbox"); }
  return keys.slice(-MAX_SLIDES);
}
export const INBOX_QUIET_MS = 45000, INBOX_BURST_MS = 120000;
// called from the minute tick: once a burst has been quiet for 45 s, ONE question covering every photo in it
export async function inboxAsk(env, deps, now) {
  const ib = await kvJ(env, "desk_post_inbox", null);
  if (!ib || !ib.items || !ib.items.length || ib.asked || now - (ib.last_at || 0) < INBOX_QUIET_MS) return false;
  const n = ib.items.length, refFirst = await refRequestRecent(env, now);
  const these = n === 1 ? "this photo" : "these " + n + " photos";
  const ref = { id: "dp:inbox:ref", title: "Reference photo" }, use = { id: "dp:inbox:use", title: "Use in a post" }, ign = { id: "dp:inbox:ignore", title: "Ignore" };
  const q = refFirst ? "Save " + these + " as reference photos?" : "You sent " + these + " without a caption. What are they for?";
  await deps.buttons(env, q + " Reference photos are saved with the tag general (change one later with /ref tag <n> <tag>). Nothing is posted from here.", refFirst ? [ref, use, ign] : [use, ref, ign]);
  ib.asked = true; ib.asked_at = now; await kvPut(env, "desk_post_inbox", ib, 86400);
  return true;
}
async function inboxButton(env, deps, act, now) {
  const ib = await kvJ(env, "desk_post_inbox", null);
  if (!ib || !ib.items || !ib.items.length) { await deps.send(env, "Those photos are no longer waiting. Send them again."); return true; }
  if (act === "ignore") { for (const it of ib.items) await env.MEETINGS.delete(it.k); await env.MEETINGS.delete("desk_post_inbox"); await deps.send(env, "Ignored " + ib.items.length + " photo(s). Nothing was kept."); return true; }
  if (act === "ref") {
    await markRefRequest(env, now); let saved = 0, total = 0, first = 0;
    for (const it of ib.items) { const b = await env.MEETINGS.get(it.k, "arrayBuffer"); if (b && b.byteLength) { const r = await addRef(env, b, "general", "owner upload", now); saved++; total = r.total; first = first || r.n; } await env.MEETINGS.delete(it.k); }
    await env.MEETINGS.delete("desk_post_inbox");
    await deps.send(env, "Saved " + saved + " reference photo(s) with the tag general (numbers " + first + " to " + (first + saved - 1) + ", " + total + " in all). Tag one with /ref tag <n> <tag> (" + REF_TAGS.join(", ") + "). They are never posted as they are.");
    return true;
  }
  // use: move to the post queue; the next /post uses them, and says so
  const keys = await kvJ(env, "desk_post_pendimg", []);
  for (const it of ib.items) { const b = await env.MEETINGS.get(it.k, "arrayBuffer"); if (b && b.byteLength) keys.push(await storeImage(env, b, "image/jpeg")); await env.MEETINGS.delete(it.k); }
  await env.MEETINGS.delete("desk_post_inbox"); await kvPut(env, "desk_post_pendimg", keys.slice(-MAX_SLIDES), 3600);
  await deps.send(env, keys.slice(-MAX_SLIDES).length + " photo(s) ready for your next post (one hour). Send /post <idea> and they will be its pictures.");
  return true;
}
const p0 = (n) => Math.max(1, n);
async function startFromText(env, deps, rest, imgsIn, fromPhoto) {
  let idea = String(rest || "").trim(), lane = "";
  const lm = idea.match(/^(abbot|alchemy)\b\s*[:\-]?\s*(.*)$/is); if (lm) { lane = lm[1].toLowerCase(); idea = lm[2].trim(); }
  if (/^cancel\b/i.test(idea) || /^retry\b/i.test(idea)) return false;
  const nm = idea.match(/^(\d{1,2})$/);      // v426: the feed lists 10
  let extra = {};
  if (nm) { const L = await kvJ(env, "desk_ideas", []); const it = L[Number(nm[1]) - 1]; if (!it) { await deps.send(env, "No idea " + nm[1] + ". Send /ideas first."); return true; } idea = it.text; lane = lane || it.lane; if (it.allow) extra.allowNums = it.allow; if (it.kind) extra.kind = it.kind; }   // v454: /post N keeps a motivational or Friday idea's kind
  if (!idea && !(imgsIn && imgsIn.length)) { await deps.send(env, "Send /post followed by your idea, for example /post abbot: why a handover needs one owner."); return true; }
  if (/\b(reel|reels|video)\b/i.test(idea)) { await deps.send(env, "Reels come in phase 2. For now I can do a single picture or a carousel of up to " + MAX_SLIDES + " slides."); return true; }
  // v421: photos become post pictures only (a) when he says use/with my photos, (b) a photo captioned post:, or (c) photos he put in the
  // post queue himself with the "Use in a post" button. Uncaptioned photos waiting in the inbox are never taken silently.
  let imgs = imgsIn;
  if (!imgs) { const chosen = await kvJ(env, "desk_post_pendimg", []); imgs = (MY_PHOTOS.test(idea) || chosen.length) ? await pendingMine(env, MY_PHOTOS.test(idea)) : []; }
  extra.use_my_photos = !!(imgs && imgs.length) && (fromPhoto || !imgsIn);
  await newPlan(env, deps, idea, lane, imgs, extra); return true;
}

// ---------- the router: returns true when the message was handled here ----------
export async function deskPostRoute(env, msg, text, deps) {
  const now = nowOf(deps);
  if (msg.type === "interactive") { const id = msg.interactive && msg.interactive.button_reply && msg.interactive.button_reply.id; return id && /^dp:/.test(id) ? handleButton(env, deps, id) : false; }
  if (msg.type === "image" && msg.image && msg.image.id) return handleImage(env, deps, msg);
  // v467 - a track for the music library: an audio file (or audio document) captioned music: <mood> <title>
  const au = (msg.type === "audio" && msg.audio) || (msg.type === "document" && msg.document && /^audio\//i.test(String(msg.document.mime_type || "")) && msg.document);
  if (au && au.id) {
    const cap = String(au.caption || (msg.document && msg.document.caption) || "").trim();
    const cm = cap.match(/^music\s*:?\s*(.*)$/i);
    if (!cm) { await deps.send(env, "To add this to the music library, send it again with the caption music: <mood> <title>. Moods: " + MOODS.join(", ") + ". Royalty-free tracks only."); return true; }
    const mood = moodOf(cm[1]); if (!mood) { await deps.send(env, "Say the mood in the caption: music: <mood> <title>. Moods: " + MOODS.join(", ") + "."); return true; }
    let got = null; try { got = await deps.fetchMedia(env, au.id); } catch (e) {}
    if (!got || !got.bytes) { await deps.send(env, "I could not download that audio. Send it again."); return true; }
    const r = await addTrack(env, got.bytes, mood, cm[1].replace(new RegExp("\\b" + mood + "\\b", "i"), "").trim() || (msg.document && msg.document.filename) || "", "sent by Kendall");
    await deps.send(env, r.err ? "Not added: " + r.err + "." : "Added to " + mood + " (" + r.count + " track" + (r.count > 1 ? "s" : "") + " in that mood)."); return true;
  }
  const t = String(text || "").trim(); if (!t) return false;
  if (/^\/?music$/i.test(t)) { await deps.send(env, libraryText(await musicIndex(env))); return true; }   // v467
  let m;
  if (/^\/pause\b/i.test(t)) { await env.MEETINGS.put("desk_post_pause", "1"); await env.MEETINGS.delete("desk_post_pause_told"); await deps.send(env, "Paused. Nothing will be published until you send /resume. Drafts and approvals still work."); return true; }
  if (/^\/resume\b/i.test(t)) { await env.MEETINGS.delete("desk_post_pause"); await env.MEETINGS.delete("desk_post_pause_told"); await deps.send(env, "Resumed. Scheduled posts go out at their slot."); return true; }
  if (/^\/queue\b/i.test(t)) { await deps.send(env, await queueText(env, deps)); return true; }
  if (/^\/cost\b/i.test(t)) { await deps.send(env, await costText(env, now)); return true; }
  if (/^\/insights\b/i.test(t)) { await deps.send(env, await insightsText(env)); return true; }
  if (/^\/ideas\b/i.test(t)) { await deps.send(env, await ideasText(env, deps)); return true; }
  if (/^\/?feed$/i.test(t)) { await deps.send(env, await feedText(env, deps)); return true; }   // v426
  if ((m = t.match(/^(\d{1,2})$/)) && !(await env.MEETINGS.get("desk_post_editing"))) { if (await feedReply(env, deps, Number(m[1]))) return true; }
  if ((m = t.match(/^\/ref\s+tag\s+(\d+)\s+([\w-]+)/i))) {   // v421
    const n = Number(m[1]), tag = m[2].toLowerCase(), r = await kvJ(env, "desk_ref_" + n, null);
    if (!r) { await deps.send(env, "No reference " + n + "."); return true; }
    if (!REF_TAGS.includes(tag)) { await deps.send(env, "Tag must be one of " + REF_TAGS.join(", ") + "."); return true; }
    r.tag = tag; await kvPut(env, "desk_ref_" + n, r); await deps.send(env, "Reference " + n + " is now tagged " + tag + "."); return true;
  }
  if ((m = t.match(/^\/ref\b\s*(\w*)\s*(\d*)/i))) {
    const ix = await kvJ(env, "desk_ref_index", []);
    if (/^add$/i.test(m[1])) await markRefRequest(env, now);
    if (/^list$/i.test(m[1]) || !m[1]) {
      const by = {}; for (const m2 of await refList(env)) by[m2.tag] = (by[m2.tag] || 0) + 1;
      await deps.send(env, ix.length ? ix.length + " approved reference photo(s): " + Object.keys(by).map((k) => k + " " + by[k]).join(", ") + ". " + (ix.length < REF_MIN ? "I need at least " + REF_MIN + " before any picture shows you. " : "") + "Used only in the Abbot lane (and Alchemy when the idea says with Kendall)." : "No reference photos yet. Send a photo with the caption ref: <tag> (" + REF_TAGS.join(", ") + "). " + REF_CHECKLIST + " Until then no post shows a person.");
      return true;
    }
    if (/^add$/i.test(m[1])) { await deps.send(env, "Send the photo itself with the caption ref: <tag> (" + REF_TAGS.join(", ") + ")."); return true; }
    if (/^remove$/i.test(m[1]) && m[2]) { const n = Number(m[2]); await env.MEETINGS.delete("desk_ref_" + n); await env.MEETINGS.delete("desk_refimg_" + n); await kvPut(env, "desk_ref_index", ix.filter((x) => x !== n)); await deps.send(env, "Removed reference " + n + "."); return true; }
    if (/^purge$/i.test(m[1])) { await deps.buttons(env, "Delete all " + ix.length + " reference photos? This cannot be undone.", [{ id: "dp:ref:purge", title: "Delete all" }, { id: "dp:ref:keep", title: "Keep them" }]); return true; }
    return false;
  }
  if ((m = t.match(/^\/post\s+cancel\s+([a-z0-9]+)/i))) { const p = await getPlan(env, m[1]); if (!p) { await deps.send(env, "No draft " + m[1] + "."); return true; } if (p.status === "posted") { await deps.send(env, "Already posted; I cannot take it down from here."); return true; } p.status = "cancelled"; hist(p, "cancelled", "", now); await putPlan(env, p); await deps.send(env, "Cancelled " + p.id + ". Nothing will be posted."); return true; }
  if ((m = t.match(/^\/post\s+wide\s+([a-z0-9]+)/i))) { const p = await getPlan(env, m[1]); if (!p) { await deps.send(env, "No draft " + m[1] + "."); return true; } await widePicture(env, deps, p); return true; }   // v429
  if ((m = t.match(/^\/post\s+regen\s+([a-z0-9]+)/i))) { const p = await getPlan(env, m[1]); if (!p) { await deps.send(env, "No draft " + m[1] + "."); return true; } await regenPlan(env, deps, p); return true; }   // v421
  if ((m = t.match(/^\/post\s+retry\s+([a-z0-9]+)/i))) {
    const p = await getPlan(env, m[1]);
    if (!p || p.status !== "held" || p.approved !== true) { await deps.send(env, "Only a held, approved draft can be retried."); return true; }
    if (p.media_id) { await deps.send(env, "That post already went up. It will not be posted again."); return true; }
    if (await env.MEETINGS.get("desk_post_pause")) { await deps.send(env, "Posting is paused (/resume first)."); return true; }
    p.status = "scheduled"; p.slot = now; hist(p, "retry", "owner asked", now); await putPlan(env, p);
    await publishOne(env, deps, p, now); return true;
  }
  // v466 - "post" (or /post) on its own: three buttons, no typing needed to start
  if (/^\/?post$/i.test(t)) {
    await deps.buttons(env, "New post. Pick a voice and type the idea, or tap Give me ideas. (To use your own photo, send it with the caption post: <idea>.)", [{ id: "dp:start:ideas", title: "Give me ideas" }, { id: "dp:start:abbot", title: "Digital Abbot" }, { id: "dp:start:alchemy", title: "DigitAlchemy" }]);
    return true;
  }
  if (!/^\//.test(t)) { const w = await env.MEETINGS.get("desk_post_wait"); if (w) { await env.MEETINGS.delete("desk_post_wait"); return startFromText(env, deps, w + ": " + t); } }
  if ((m = t.match(/^\/post(?:\s+([\s\S]*))?$/i))) return startFromText(env, deps, m[1] || "");
  if ((m = t.match(/^post\s*(abbot|alchemy)?\s*:\s*([\s\S]+)$/i))) return startFromText(env, deps, (m[1] ? m[1] + ": " : "") + m[2]);
  const eid = await env.MEETINGS.get("desk_post_editing");
  if (eid) { const p = await getPlan(env, eid); if (p && p.status === "editing") { await applyEdit(env, deps, p, t); return true; } }
  return false;
}

// v429 - a widescreen version of a draft's picture, for LinkedIn: same scene, 1536x1024, sent to the desk only and never posted to Instagram
async function widePicture(env, deps, p) {
  const s = p.slides && p.slides[0];
  const generated = s && (s.src === "ai" || s.src === "ai-person") && p.type !== "carousel";
  if (!generated) { await deps.send(env, "Draft " + p.id + " has no generated picture I can redo wide" + (s && s.src === "sent" ? " (it is your own photo)" : p.type === "carousel" ? " (a carousel is made of text slides)" : "") + "."); return; }
  const person = s.src === "ai-person";
  // a draft made before v429 kept no description: rebuild it the way buildImages writes it
  const base = s.prompt || (STYLE + (person ? "Place the man shown in the reference photos into this scene, recognisably himself: same face, same build, same apparent age, no alteration of body or age. Only him in the scene, no other identifiable real people, no medical or financial endorsement, no logos or text. " + (POSE[p.picture] || "") : NO_PERSON) + (BACKGROUND[p.background] || "") + "Subject: " + String(p.idea).replace(/\d+/g, "").slice(0, 300));
  // the ORIGINAL square picture leads the references, so the wide one is the same scene extended, not a new scene
  const refs = [];
  const orig = s.img_key ? await env.MEETINGS.get("igm_" + s.img_key, "arrayBuffer") : null;
  if (orig && orig.byteLength) refs.push(orig);
  if (person) { const r = await pickRefs(env, p.idea, p.picture); if (r.count >= REF_MIN) refs.push(...r.bufs.slice(0, 2)); }
  await deps.send(env, "Making a widescreen version of " + p.id + "...");
  const g = await genImage(env, deps, base + " WIDESCREEN: recreate the FIRST reference image as a wide 3:2 landscape picture. Keep everything in it the same: the same person, face, clothes, pose and expression, the same room, light, colours and view. Only extend the scene naturally to the left and right, with the person in the centre third. No blur, no borders, no text.", refs.length ? refs : null, "1536x1024");
  if (g.err) { await deps.send(env, "Could not make the widescreen picture: " + (g.cap ? "the monthly picture budget is used up" : g.err) + "."); return; }
  const key = await storeImage(env, g.bytes, "image/jpeg");
  p.wide_key = key; hist(p, "wide", "widescreen made", nowOf(deps)); await putPlan(env, p);
  await deps.image(env, deps.origin(env) + "/ig_media/" + key, "Widescreen version of " + p.id + " (1536 x 1024), for LinkedIn. Illustration. Not posted anywhere; save it from here.");
}

// ---------- publishing ----------
// v421: refuses a plan whose slides lack pictures, and a carousel built from raw sent photos unless he said "use my photos"
export function publishGuard(p) {
  if (picturesMissing(p)) return "a slide has no picture";
  if (p.type === "carousel" && !p.use_my_photos && p.slides.some((s) => s.src === "sent")) return "its slides are raw photos you sent, not made slides";
  return "";
}
// v421: /post regen <id> - every slide picture made again from the slide specs (sent photos kept only when use_my_photos), back to draft,
// approval cleared, a NEW preview with the pictures
async function regenPlan(env, deps, p) {
  const now = nowOf(deps);
  if (["posted", "publishing", "cancelled"].includes(p.status)) { await deps.send(env, "Draft " + p.id + " is " + p.status + "; nothing to rebuild."); return; }
  p.approved = false; delete p.approved_at; p.status = "draft"; p.slot = null; delete p.held_reason; delete p.nopic_reason; p.containers = {};
  p.expires_at = now + EXPIRY_MS;
  for (const s of p.slides) { if (s.src === "sent" && p.use_my_photos) continue; delete s.img_key; delete s.src; delete s.flag; }
  hist(p, "regen", "all slide pictures rebuilt; approval cleared", now);
  await deps.send(env, "Rebuilding the pictures for " + p.id + " (" + p.slides.length + " slide" + (p.slides.length > 1 ? "s" : "") + "). It needs your approval again.");
  const r = await buildImages(env, deps, p);
  p.notes = r.notes || [];
  if (r.cap || r.err) { p.status = "held"; p.held_reason = r.err; p.nopic_reason = r.cap ? "the monthly picture budget (USD " + capUsd(env).toFixed(2) + ") is reached. " + (await costText(env, now)) : r.err; }
  if (p.ai && p.caption && !/\bIllustration\./.test(p.caption)) p.caption = p.caption.replace(/(\n\n#[^\n]*)?$/, (m) => "\n\nIllustration." + m);
  await putPlan(env, p); await env.MEETINGS.delete("desk_post_editing"); await sendPreview(env, deps, p);
}
async function hold(env, deps, p, why) {
  const now = nowOf(deps);
  p.status = "held"; p.held_reason = String(why).slice(0, 160); hist(p, "held", why, now); await putPlan(env, p);
  await deps.send(env, "Draft " + p.id + " was not posted: " + p.held_reason + ". Nothing was retried. When ready, send /post retry " + p.id + ". Check the Instagram feed first if the message said so.");
}
// v466 - the LinkedIn half of a post (pictures from igm_<key>, the same caption). Reported on its own; never holds the Instagram half.
async function publishLinkedIn(env, deps, p, now) {
  if (p.li_id) return true;
  if (!deps.liPostImages) { await deps.send(env, "LinkedIn is not wired for posts on this worker; " + p.id + " was not posted there."); return false; }
  const imgs = [];
  for (const s of p.slides) { const b = s.img_key ? await env.MEETINGS.get("igm_" + s.img_key, "arrayBuffer") : null; if (!b) { await deps.send(env, "LinkedIn: a picture of " + p.id + " is no longer stored; not posted there."); return false; } imgs.push({ bytes: b, alt: s.alt || "" }); }
  const r = await deps.liPostImages(env, imgs, p.caption);
  if (!r.ok) { hist(p, "li-held", r.err, now); await putPlan(env, p); await deps.send(env, "LinkedIn: " + p.id + " was not posted (" + r.err + ")."); return false; }
  p.li_id = r.id; p.li_url = r.url; hist(p, "li-posted", r.id, now); await putPlan(env, p);
  await deps.send(env, "Posted " + p.id + " to LinkedIn" + (r.url ? ": " + r.url : "") + ".");
  return true;
}
export async function publishOne(env, deps, p, now) {
  const targets = Array.isArray(p.targets) && p.targets.length ? p.targets : ["ig"];
  if (!targets.includes("ig")) {   // v466 - LinkedIn only
    if (p.approved !== true) return hold(env, deps, p, "this draft was never approved");
    const g = publishGuard(p); if (g) return hold(env, deps, p, g + " (send /post regen " + p.id + " for proper pictures)");
    const ok2 = await publishLinkedIn(env, deps, p, now);
    p.status = ok2 ? "posted" : "held"; if (!ok2) p.held_reason = "LinkedIn refused it"; p.posted_at = ok2 ? now : p.posted_at; await putPlan(env, p); return;
  }
  const st = await deskIgStatus(env, now);
  if (!st.connected) return hold(env, deps, p, st.expired ? "the desk Instagram token has expired and needs a fresh link" : "the desk Instagram is not connected");
  if (!st.can_post) return hold(env, deps, p, "the desk Instagram connection does not allow posting (content_publish is missing)");
  if (p.approved !== true) return hold(env, deps, p, "this draft was never approved");
  const guard = publishGuard(p); if (guard) return hold(env, deps, p, guard + " (send /post regen " + p.id + " for proper pictures)");   // v421
  if (p.media_id) { p.status = "posted"; await putPlan(env, p); return; }
  if ((await postedToday(env, now)) >= dayCap(env)) {
    const plans = await allPlans(env); p.slot = nextSlot(now, plans.filter((x) => x.id !== p.id), dayCap(env)); hist(p, "cap", "moved to " + fmtSlot(p.slot), now); await putPlan(env, p);
    await deps.send(env, "The cap of " + dayCap(env) + " posts a day is reached, so " + p.id + " moves to " + fmtSlot(p.slot) + "."); return;
  }
  const lock = rid(); p.status = "publishing"; p.lock = lock; p.started = now; await putPlan(env, p);
  await sleepOf(deps)(300);
  const again = await getPlan(env, p.id); if (!again || again.lock !== lock) return;      // another tick has it
  const origin = deps.origin(env), urls = [];
  for (const s of p.slides) { if (!s.img_key || !(await env.MEETINGS.get("igm_" + s.img_key, "arrayBuffer"))) return hold(env, deps, p, "a picture is no longer stored"); urls.push(origin + "/ig_media/" + s.img_key); }
  p.containers = p.containers || {};
  const save = async () => { await putPlan(env, p); };
  let res;
  // v425 - Meta's own "AI info" label (is_ai_generated) whenever the caption carries "Illustration.", and each slide's alt text (alt_text, images only)
  const altTexts = p.slides.map((s) => String(s.alt || "")), aiGenerated = !!p.ai;
  if (p.type === "carousel" && urls.length > 1) {
    res = await deskIgPublishCarousel(env, { now, approved: p.approved === true, imageUrls: urls, altTexts, aiGenerated, caption: p.caption, state: p.containers, sleep: sleepOf(deps), onProgress: async (s) => { Object.assign(p.containers, s); await save(); } });
  } else {
    res = await deskIgPublish(env, { now, approved: p.approved === true, imageUrl: urls[0], altText: altTexts[0], aiGenerated, caption: p.caption, container: p.containers.single, sleep: sleepOf(deps), onContainer: async (id) => { p.containers.single = id; await save(); } });
    if (res.container) p.containers.single = res.container;
  }
  if (!res.ok) { return hold(env, deps, p, res.err || "Instagram refused the post"); }
  p.status = "posted"; p.media_id = res.id; p.posted_at = now; p.permalink = res.permalink || (await deskIgPermalink(env, res.id)) || "";
  hist(p, "posted", p.media_id, now); await putPlan(env, p);
  await env.MEETINGS.put("desk_posts_day_" + dayKey(now), String((await postedToday(env, now)) + 1), { expirationTtl: 3 * 86400 });
  const M = await kvJ(env, "desk_ig_media", {}); M[p.media_id] = { plan: p.id, at: new Date(now).toISOString(), permalink: p.permalink }; await kvPut(env, "desk_ig_media", M);
  await deps.send(env, "Posted " + p.id + (p.permalink ? ": " + p.permalink : "") + ".");
  if (targets.includes("li")) await publishLinkedIn(env, deps, p, now);   // v466
}
// The minute tick. Expires old drafts, publishes at most one due plan, never when paused.
export async function deskPostTick(env, deps) {
  if (!DIG(env.WA_DESK_PHONE_ID) || !DIG(env.WA_DESK_OWNER)) return { skipped: "desk off" };
  const now = nowOf(deps); const plans = await allPlans(env); const out = { expired: 0, published: 0 };
  try { out.asked = await inboxAsk(env, deps, now); } catch (e) {}   // v421: one question per burst of uncaptioned photos
  const exp = plans.filter((p) => ["draft", "editing", "approving"].includes(p.status) && p.expires_at && now > p.expires_at);
  for (const p of exp) { p.status = "expired"; hist(p, "expired", "3 days without approval", now); await putPlan(env, p); out.expired++; }
  if (exp.length) { await env.MEETINGS.delete("desk_post_editing"); await deps.send(env, "Expired after 3 days unapproved: " + exp.map((p) => p.id).join(", ") + "."); }
  for (const p of plans.filter((x) => x.status === "publishing" && now - (x.started || 0) > 600000)) await hold(env, deps, p, "it stopped part-way; look at the Instagram feed before retrying");
  const due = plans.filter((p) => p.status === "scheduled" && p.slot && p.slot <= now).sort((a, b) => a.slot - b.slot);
  if (!due.length) return out;
  if (await env.MEETINGS.get("desk_post_pause")) {
    if (!(await env.MEETINGS.get("desk_post_pause_told"))) { await env.MEETINGS.put("desk_post_pause_told", "1", { expirationTtl: 3 * 86400 }); await deps.send(env, "Posting is paused. " + due.length + " approved post(s) are waiting. Send /resume to let them go."); }
    out.paused = true; return out;
  }
  await publishOne(env, deps, due[0], now); out.published = 1; return out;
}
// every 3 hours, same slot as her pull: followers and per-media numbers for desk-posted media
export async function deskPostPull(env, now) {
  const M = await kvJ(env, "desk_ig_media", {}); const r = await deskIgPull(env, now || Date.now(), Object.keys(M));
  if (r.account) await kvPut(env, "desk_ig_account", { followers: r.account.followers, media_count: r.account.media_count, at: new Date(now || Date.now()).toISOString() });
  for (const id in (r.media || {})) { if (M[id]) { M[id].m = r.media[id]; M[id].read_at = now || Date.now(); } }
  await kvPut(env, "desk_ig_media", M); return r;
}
