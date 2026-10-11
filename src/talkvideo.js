// v506 (Kendall 11 Oct 2026: "yes go ahead with the video build") - a real talking-head video from his phone becomes a branded video.
// He sends a video to the desk -> "Make a branded video" -> background, layout, captions, music, name card, shape -> preview -> Make it.
// NOTHING is spent before Make it. After Make it a job record (KV tv_job) is worked one step per minute tick (like heygen.js clipTick):
//   words   - the clip's sound from the video service (/audio), then word timings from Workers AI speech-to-text (env.AI)
//   bg      - today's scene picture (genImage) or the brand plate (KV talk_plate_default), or none (keep his background)
//   matte   - the person cut out by the matting service (env.REPLICATE_API_TOKEN); no token or a failure -> no cut-out, his own background
//   compose - the video service /compose -> vid_talk_<n> -> sent to the desk with the post buttons and a "For my Status" button
// User-facing text never names a model or vendor ("the video service").
import { MOODS, musicIndex } from "./music.js";

export const TV_VERSION = "v506";
export const TALK_NAME = { line1: "Dr. Kendall Wilson", line2: "Digital Abbot" };
export const KV_MAX = 25 * 1024 * 1024;
const DRAFT = "tv_draft", JOB = "tv_job";
export const REPLICATE_MODEL = "arielreplicate/robust_video_matting";   // inputs: input_video (uri), output_type green-screen|alpha-mask|foreground-mask; output: uri
const REPLICATE = "https://api.replicate.com/v1";
export const WHISPER = "@cf/openai/whisper";   // returns { text, word_count, words:[{word,start,end}], vtt }
const MATTE_POLLS = 40, JOB_TTL = 3 * 86400;

const kvJ = async (env, k, d) => { try { const v = await env.MEETINGS.get(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const put = (env, k, v, ttl) => env.MEETINGS.put(k, JSON.stringify(v), { expirationTtl: ttl || JOB_TTL });

export function nameDefault(env) {
  const s = String((env && env.TALK_NAME_DEFAULT) || "").trim();
  if (!s) return Object.assign({}, TALK_NAME);
  return splitName(s);
}
export function splitName(s) {
  const p = String(s || "").split(/\s*(?:·|\||\n|;)\s*/).map((x) => x.trim()).filter(Boolean);
  return { line1: (p[0] || "").slice(0, 40), line2: (p.slice(1).join(" ") || "").slice(0, 40) };
}
const nameText = (n) => (n ? [n.line1, n.line2].filter(Boolean).join(" · ") : "none");

// ---- WhatsApp payloads (max 3 buttons, titles <= 20; list rows <= 10, titles <= 24) ----
export function buttonsPayload(to, body, btns) {
  return { messaging_product: "whatsapp", to, type: "interactive", interactive: { type: "button", body: { text: String(body).slice(0, 1024) },
    action: { buttons: btns.slice(0, 3).map((b) => ({ type: "reply", reply: { id: b.id, title: String(b.title).slice(0, 20) } })) } } };
}
export function listPayload(to, body, button, rows) {
  return { messaging_product: "whatsapp", to, type: "interactive", interactive: { type: "list", body: { text: String(body).slice(0, 1024) },
    action: { button: String(button).slice(0, 20), sections: [{ title: "Choose one", rows: rows.slice(0, 10).map((r) => ({ id: r.id, title: String(r.title).slice(0, 24), description: r.description ? String(r.description).slice(0, 72) : undefined })) }] } } };
}
// the extra offer under the existing "Got your video" buttons
export const offerPayload = (to, key) => buttonsPayload(to, "Or turn it into a branded video: new background, your words as captions, name card, music.", [{ id: "tv:start:" + key, title: "Make branded video" }]);

const BG = { scene: "Today's scene", plate: "Brand plate", keep: "Keep my background" };
const LAYOUT = { full: "Full", lower: "Lower third" };
const CAPS = { none: "No captions", bottom: "At the bottom", scroll: "Scrolling" };
const SHAPE = { p: "Portrait 9:16", l: "Landscape 16:9" };

async function ask(env, deps, d) {
  const to = deps.owner, raw = (p, k) => deps.raw(env, p, k);
  if (d.step === "bg") return raw(buttonsPayload(to, "Background behind you?", [{ id: "tv:bg:scene", title: "Today's scene" }, { id: "tv:bg:plate", title: "Brand plate" }, { id: "tv:bg:keep", title: "Keep my background" }]), "tv-bg");
  if (d.step === "layout") return raw(buttonsPayload(to, "How big should you be?", [{ id: "tv:ly:full", title: "Full" }, { id: "tv:ly:lower", title: "Lower third" }]), "tv-layout");
  if (d.step === "caps") return raw(buttonsPayload(to, "Captions from your own words?", [{ id: "tv:cp:none", title: "None" }, { id: "tv:cp:bottom", title: "At the bottom" }, { id: "tv:cp:scroll", title: "Scrolling" }]), "tv-caps");
  if (d.step === "music") {
    const ix = await musicIndex(env), rows = [{ id: "tv:mu:none", title: "No music" }];
    for (const m of MOODS) if ((ix[m] || []).length) rows.push({ id: "tv:mu:" + m, title: m[0].toUpperCase() + m.slice(1), description: (ix[m] || []).length + " track(s)" });
    if (rows.length === 1) { d.mood = ""; d.step = "name"; await put(env, DRAFT, d); return ask(env, deps, d); }
    return raw(listPayload(to, "Music under your voice? It goes quiet while you speak.", "Pick music", rows), "tv-music");
  }
  if (d.step === "name") return raw(buttonsPayload(to, "Name card: " + nameText(nameDefault(env)) + "?", [{ id: "tv:nm:def", title: "Use this" }, { id: "tv:nm:type", title: "I'll type it" }, { id: "tv:nm:none", title: "No name card" }]), "tv-name");
  if (d.step === "name_type") return deps.send(env, "Type the name card as your next message, two lines split with | (for example: Dr. Kendall Wilson | Digital Abbot).");
  if (d.step === "shape") return raw(buttonsPayload(to, "Shape?", [{ id: "tv:sh:p", title: "Portrait 9:16" }, { id: "tv:sh:l", title: "Landscape 16:9" }]), "tv-shape");
  if (d.step === "preview") return raw(buttonsPayload(to, previewText(d), [{ id: "tv:go", title: "Make it" }, { id: "tv:chg", title: "Change it" }, { id: "tv:x", title: "Cancel" }]), "tv-preview");
}
export function previewText(d) {
  return "Branded video from " + d.key + ":\nBackground: " + BG[d.bg] + "\nYou: " + LAYOUT[d.layout] + "\nCaptions: " + CAPS[d.caps] +
    "\nMusic: " + (d.mood || "none") + "\nName card: " + nameText(d.name) + "\nShape: " + SHAPE[d.shape] + "\nIt takes a few minutes. Nothing is made until you tap Make it.";
}

// the button/list taps and the typed name. Returns true when handled.
export async function talkRoute(env, msg, text, deps) {
  const it = msg && msg.type === "interactive" && msg.interactive;
  const id = it ? String((it.button_reply && it.button_reply.id) || (it.list_reply && it.list_reply.id) || "") : "";
  const send = (s) => deps.send(env, s);
  if (!id || !/^tv:/.test(id)) {
    if (msg && msg.type === "text" && text && !/^\//.test(text)) {
      const d = await kvJ(env, DRAFT, null);
      if (d && d.step === "name_type") { d.name = splitName(text); d.step = "shape"; await put(env, DRAFT, d); await ask(env, deps, d); return true; }
    }
    return false;
  }
  let m = id.match(/^tv:start:([a-z0-9_]+)$/);
  if (m) {
    const d = { key: m[1], step: "bg", at: Date.now() };
    await put(env, DRAFT, d); await ask(env, deps, d); return true;
  }
  const d = await kvJ(env, DRAFT, null);
  if (!d) { await send("That branded video is no longer waiting. Send the video again."); return true; }
  if ((m = id.match(/^tv:bg:(scene|plate|keep)$/))) {
    d.bg = m[1];
    if (d.bg === "plate" && !(await env.MEETINGS.get("talk_plate_default", "arrayBuffer"))) { await send("No brand plate is stored yet, so I will use today's scene."); d.bg = "scene"; }
    d.step = "layout";
  } else if ((m = id.match(/^tv:ly:(full|lower)$/))) { d.layout = m[1]; d.step = "caps"; }
  else if ((m = id.match(/^tv:cp:(none|bottom|scroll)$/))) { d.caps = m[1]; d.step = "music"; }
  else if ((m = id.match(/^tv:mu:([a-z]+)$/))) { d.mood = m[1] === "none" ? "" : m[1]; d.step = "name"; }
  else if ((m = id.match(/^tv:nm:(def|type|none)$/))) { d.name = m[1] === "def" ? nameDefault(env) : null; d.step = m[1] === "type" ? "name_type" : "shape"; }
  else if ((m = id.match(/^tv:sh:(p|l)$/))) { d.shape = m[1]; d.step = "preview"; }
  else if (id === "tv:chg") { d.step = "bg"; }
  else if (id === "tv:x") { await env.MEETINGS.delete(DRAFT); await send("Cancelled. Nothing was made."); return true; }
  else if (id === "tv:go") return makeIt(env, deps, d);
  else return false;
  await put(env, DRAFT, d); await ask(env, deps, d); return true;
}

async function makeIt(env, deps, d) {
  if (d.step !== "preview" || !d.bg || !d.layout || !d.caps || !d.shape) { d.step = "bg"; await put(env, DRAFT, d); await ask(env, deps, d); return true; }
  const cur = await kvJ(env, JOB, null);
  if (cur && !cur.done) { await deps.send(env, "A branded video is already being made. I will send it when it is ready, then you can start the next."); return true; }
  const n = Number((await env.MEETINGS.get("tv_seq")) || 0) + 1;
  await env.MEETINGS.put("tv_seq", String(n));
  const job = Object.assign({}, d, { n, stage: "words", polls: 0, notes: [], at: Date.now(), done: false });
  await put(env, JOB, job); await env.MEETINGS.delete(DRAFT);
  if (deps.typing && deps.msgId) { try { await deps.typing(env, deps.msgId); } catch (e) {} }
  await deps.send(env, "Working on it. Your branded video takes a few minutes; I will send it here.");
  return true;
}

// ---- the minute tick ----
// deps: { send, buttons, video, origin, genImage(env,prompt,size), storeImage(env,bytes), fetch? }
export async function talkTick(env, deps) {
  const j = await kvJ(env, JOB, null);
  if (!j || j.done) return;
  const now = Date.now();
  if (j.busy && now - j.busy < 9 * 60000) return;   // a long step from the previous tick is still running
  j.busy = now; await put(env, JOB, j);
  const f = (deps && deps.fetch) || fetch, o = deps.origin(env), videoUrl = o + "/video/" + j.key;
  const save = async () => { j.busy = 0; await put(env, JOB, j); };
  try {
    if (j.stage === "words") {
      j.words = [];
      if (j.caps !== "none") {
        const w = await transcribe(env, f, videoUrl);
        if (w.err) j.notes.push("no captions (" + w.err + ")"); else { j.words = w.words; j.transcript = w.text; }
      }
      j.stage = "bg"; return save();
    }
    if (j.stage === "bg") {
      j.bgUrl = null;
      if (j.bg !== "keep") {
        let bytes = null;
        if (j.bg === "plate") bytes = await env.MEETINGS.get("talk_plate_default", "arrayBuffer");
        if (!bytes) {
          const g = await deps.genImage(env, scenePrompt(), j.shape === "l" ? "1536x1024" : "1024x1536");
          if (g && g.bytes) bytes = g.bytes; else j.notes.push("no new background (" + ((g && g.err) || "the picture failed") + ")");
        }
        if (bytes) j.bgUrl = o + "/ig_media/" + (await deps.storeImage(env, bytes));
      }
      j.stage = j.bgUrl ? "matte" : "compose"; return save();
    }
    if (j.stage === "matte") {
      const r = await matteStep(env, f, j, videoUrl);
      if (r === "wait") return save();
      j.stage = "compose"; return save();
    }
    if (j.stage === "compose") return composeStep(env, deps, f, j, o, save);
  } catch (e) {
    j.done = true; await save();
    await deps.send(env, "The branded video failed (" + String((e && e.message) || e).slice(0, 100) + "). Nothing was posted.");
  }
}
export function scenePrompt() {
  return "A calm, bright Dubai scene as a video backdrop: modern skyline and construction cranes in soft morning light, teal and warm gold tones, shallow depth of field, " +
    "empty space in the lower centre for a speaker. No people, no text, no letters, no logos, no watermark.";
}
// speech to word timings: the video service extracts the sound, Workers AI writes the words
export async function transcribe(env, f, videoUrl) {
  if (!env.AI) return { err: "speech-to-text is not connected" };
  if (!env.VIDEO_SVC) return { err: "the video service is not connected" };
  let audio;
  try {
    const r = await env.VIDEO_SVC.fetch("https://da-video/audio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ video: videoUrl }) });
    if (!r.ok) return { err: "could not read the sound" };
    audio = await r.arrayBuffer();
  } catch (e) { return { err: "the video service did not answer" }; }
  let out;
  try { out = await env.AI.run(WHISPER, { audio: [...new Uint8Array(audio)] }); } catch (e) { return { err: "the words could not be read" }; }
  const words = ((out && out.words) || []).map((x) => ({ w: String(x.word || "").trim(), start: Number(x.start), end: Number(x.end) })).filter((x) => x.w && isFinite(x.start) && isFinite(x.end));
  if (!words.length) return { err: "no speech found" };
  return { words, text: String((out && out.text) || words.map((x) => x.w).join(" ")).trim() };
}
// the cut-out: one call per tick (start, then poll). Returns "wait" while it runs; sets j.matteUrl on success; notes the fallback otherwise.
export async function matteStep(env, f, j, videoUrl) {
  const tok = env.REPLICATE_API_TOKEN;
  const fallback = (why) => { j.matteUrl = null; j.notes.push("kept your own background (" + why + ")"); return "done"; };
  if (!tok) return fallback("the cut-out is not switched on");
  const H = { Authorization: "Bearer " + tok, "Content-Type": "application/json" };
  try {
    if (!j.pred) {
      const mr = await f(REPLICATE + "/models/" + REPLICATE_MODEL, { headers: H });
      const mj = mr.ok ? await mr.json() : null, version = mj && mj.latest_version && mj.latest_version.id;
      if (!version) return fallback("the cut-out service is unavailable");
      const pr = await f(REPLICATE + "/predictions", { method: "POST", headers: H, body: JSON.stringify({ version, input: { input_video: videoUrl, output_type: "alpha-mask" } }) });
      const pj = pr.ok ? await pr.json() : null;
      if (!pj || !pj.id) return fallback("the cut-out could not start");
      j.pred = pj.id; j.polls = 0; return "wait";
    }
    const gr = await f(REPLICATE + "/predictions/" + j.pred, { headers: H });
    const g = gr.ok ? await gr.json() : null;
    const st = g && g.status;
    if (st === "succeeded") {
      const url = Array.isArray(g.output) ? g.output[g.output.length - 1] : g.output;
      if (/^https:\/\//.test(String(url || ""))) { j.matteUrl = url; return "done"; }
      return fallback("the cut-out came back empty");
    }
    if (st === "failed" || st === "canceled") return fallback("the cut-out failed");
    j.polls = (j.polls || 0) + 1;
    if (j.polls > MATTE_POLLS) return fallback("the cut-out took too long");
    return "wait";
  } catch (e) { return fallback("the cut-out service did not answer"); }
}
export function composeJob(j, o) {
  const land = j.shape === "l";
  let music = null;
  if (j.trackKey) music = o + "/music/" + j.trackKey;
  return { video: o + "/video/" + j.key, matte: j.matteUrl || null, background: j.matteUrl ? j.bgUrl || null : null, layout: j.layout === "lower" ? "lower" : "full",
    captions: { mode: j.caps, words: (j.words || []).map((x) => ({ w: x.w, start: x.start, end: x.end })) }, name: j.name || null, music,
    width: land ? 1920 : 1080, height: land ? 1080 : 1920, intro_seconds: 0 };
}
export async function composeVideo(env, job) {
  if (!env.VIDEO_SVC) return { err: "the video service is not connected" };
  try {
    const r = await env.VIDEO_SVC.fetch("https://da-video/compose", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(job) });
    if (!r.ok) { let x = {}; try { x = await r.json(); } catch (e) {} return { err: "the video service said: " + String(x.error || ("HTTP " + r.status)).slice(0, 200) }; }
    const bytes = await r.arrayBuffer();
    return bytes.byteLength > 1000 ? { bytes } : { err: "the video came back empty" };
  } catch (e) { return { err: "the video service did not answer" }; }
}
async function composeStep(env, deps, f, j, o, save) {
  if (j.mood) { const L = (await musicIndex(env))[j.mood] || []; if (L.length) j.trackKey = L[(j.n || 0) % L.length].key; }
  const r = await composeVideo(env, composeJob(j, o));
  if (!r.bytes) { j.done = true; await save(); await deps.send(env, "The branded video could not be made: " + r.err + ". Nothing was posted."); return; }
  const key = "talk_" + j.n, size = r.bytes.byteLength;
  if (size <= KV_MAX) await env.MEETINGS.put("vid_" + key, r.bytes, { expirationTtl: 60 * 86400 });
  else if (env.MEDIA) await env.MEDIA.put("vid_" + key, r.bytes, { httpMetadata: { contentType: "video/mp4" } });
  else { j.done = true; await save(); await deps.send(env, "The branded video came out at " + (size / 1048576).toFixed(1) + " MB, too big to keep here. Send a shorter clip."); return; }
  j.done = true; j.out = key; j.busy = 0; await put(env, JOB, j);
  const link = o + "/video/" + key, caption = String(j.transcript || "").slice(0, 300);
  await env.MEETINGS.put("desk_reel_pending", JSON.stringify({ url: link, caption, at: Date.now() }), { expirationTtl: 2 * 86400 });
  await env.MEETINGS.put("desk_vid_last", JSON.stringify({ key, bytes: size, at: Date.now() }), { expirationTtl: 60 * 86400 });
  const notes = j.notes && j.notes.length ? " Note: " + j.notes.join("; ") + "." : "";
  if (deps.video) await deps.video(env, link, "Your branded video (" + (size / 1048576).toFixed(1) + " MB)." + notes);
  else await deps.send(env, "Your branded video: " + link + notes);
  await deps.buttons(env, "Watch it through: are the words and the name right?", [{ id: "dr:ok", title: "Post it" }, { id: "dc:ai:reel:" + key, title: "Rewrite caption" }, { id: "dr:no", title: "Discard" }]);
  await deps.buttons(env, "Or keep it for your WhatsApp Status.", [{ id: "dv:status:" + key, title: "For my Status" }]);
}
