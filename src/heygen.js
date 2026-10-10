// v476 - SEEDANCE (HeyGen Cinematic Avatar) 15-SECOND VIDEOS FROM THE DESK, built on Kendall's own process (Visualization_Engine library,
// lessons L1-L59) and his decisions of 10 Oct 2026: "it's okay to change that rule" (generation through the HeyGen API on Make it), "always
// use Polo_Trained", "enhance prompt no because you should be giving full prompts", "the plates should come through ChatGPT through the API".
// The chain, each step his tap:  idea -> shape -> look (Polo_Trained only) -> TWO face-free plates (ChatGPT image API; Approve / Redo)
// -> the FULL prompt from his master template (summary, Show prompt, More options) -> Make it (HeyGen v3 /v3/videos cinematic_avatar,
// 15 s, 1080p, enhance_prompt false, the 2 plates as references; at most CLIP_DAILY_MAX a day) -> checks (length; speech starts early,
// via the da-video probe) -> the clip on the desk -> Post it / Rewrite caption / Discard. Nothing is spent before Make it except the plates.
// v1/v2 HeyGen APIs end 31 Oct 2026, so only v3 is used. Key: HEYGEN_API_KEY secret (put by Kendall, never seen).
import { SEEDANCE_TEMPLATE, SEEDANCE_EXAMPLE } from "./seedance_template.js";

export const HEYGEN_GROUP = "02d76b05f84b4379a03338bba1d38d60";   // Polo_Trained - the ONLY group allowed (memory: feedback_heygen_only_polo_trained)
export const CLIP_DAILY_MAX = 2;
export const LOOKS = {
  site: [
    { id: "f989182dbe1a4ccf9f873feaee3bcb6d", name: "high-visibility safety gear" },
    { id: "9d54206369064abeacf775fbb0372b52", name: "on a construction site" },
    { id: "68bd210794524623a3fd97753ec602fa", name: "yellow hard hat" },
    { id: "3b1a726176844f3ea5bd56f9f08bf16f", name: "holding construction blueprints" },
  ],
  office: [
    { id: "ae73e8f606e6423e9264e9a692a9784f", name: "tailored suit" },
    { id: "1bebf9020b1e4d919293b92a7db778a4", name: "tailored suit (2)" },
    { id: "0044265ddfdc4ae3a0f70305b1fd0bd3", name: "tailored suit (3)" },
    { id: "15d3a6a07f034abb92ee8760a946de45", name: "in a city office" },
  ],
  talk: [
    { id: "2a83be95e12c4a939e27185e1f628796", name: "plaid vest" },
    { id: "5cb106299f1c4a9190741f66e1bb25c2", name: "plaid blazer" },
    { id: "cd4cd8be1eaa44b4a13719840c5d65dd", name: "plaid blazer (2)" },
    { id: "342ce0e03fa244a7932151cf685fc8ac", name: "professor in plaid" },
    { id: "c7f46dcf298d4c14a5b24e4b11798d4e", name: "bow tie" },
  ],
  casual: [
    { id: "e952d9af35ac4179844eebbe93817f5d", name: "beige sweater" },
    { id: "ed312a92a121423499e69a9eec3232d0", name: "mustard cardigan" },
    { id: "79a82085f7e44e4bb3eccd39ce515358", name: "brown henley" },
    { id: "8ba44ec2871d485d807d8cf3608c6aac", name: "patterned cardigan" },
  ],
};
export const ALLOWED_LOOK_IDS = new Set(Object.values(LOOKS).flat().map((l) => l.id));
export const LOOK_KIND_LABEL = { site: "On site", office: "Suit / office", talk: "Plaid / talk", casual: "Casual / warm" };
export function lookKindFor(idea, kind) {
  const t = String(idea || "").toLowerCase();
  if (kind === "motivation" || kind === "friday") return "casual";
  if (/\b(site|construction|inspection|hard hat|crane|handover|snag|concrete|tower)\b/.test(t)) return "site";
  if (kind === "news" || kind === "smart" || /\b(iso|standard|smart city|ai|digital twin|bim)\b/.test(t)) return "talk";
  return "office";
}
export function pickLook(kindName, nth) { const L = LOOKS[kindName] || LOOKS.office; return L[Math.abs(Number(nth) || 0) % L.length]; }

// ---------- the writers (same model the desk captions use) ----------
export const PLATE_SYS = "You write two image-generation prompts for REFERENCE PLATES that guide a 15-second HeyGen Cinematic (Seedance) video for DigitAlchemy, a Dubai construction-technology company. " +
  "Rules from the owner's library: NO people and NO faces anywhere; no brands, no logos, no named studios or artists; NO text, letters, signs or numbers anywhere in the image; photographic, premium, never CGI. " +
  "The two plates show DIFFERENT aspects of the same scene (for example plate 1 = the setting wide, plate 2 = the key object or detail close; or start state and end state), with the same light and colour grade so they read as one place. " +
  "Teal-amber grade, low contrast, soft light. When a real place is wanted, describe its geometry instead of naming it. Reply with JSON only: {\"scene\":\"one line\",\"plate1\":\"...\",\"plate2\":\"...\"}.";

export function promptSys() {
  return "You are the owner's HeyGen Cinematic (Seedance) prompt writer. The owner's MASTER TEMPLATE and a recent fully-filled EXAMPLE follow. " +
    "Write ONE complete paste body for a clip of the LENGTH given in the request (8 or 15 seconds): everything from PROJECT: down to the GLOBAL notes (no UI SETTINGS block, no WHY/LESSONS sections). " +
    "Obey every hard rule in the template. Also: the presenter is 'the avatar' and is NEVER described (no clothes, face, hair, voice, glasses, jewellery); " +
    "the script fits the length (8 s: 14 to 20 words and 2 to 3 shots; 15 s: 26 to 36 words and 3 to 4 shots) and every shot timing adds up to exactly that length, first person, plain spoken, and is quoted in full in the SCRIPT section and stated again in the speaking shot's Line, and the GLOBAL notes say the avatar speaks ONLY that script, every other beat silent (Cinematic invents dialogue otherwise); " +
    "HARD CUT between shots and a sustained frontal medium shot of at least 3 seconds in the first half carrying the main line; " +
    "ZERO on-screen text and never quote a script word inside an AR, camera or lighting instruction (refer to the beat by position); no place names inside scene descriptions (describe geometry); " +
    "say 'Digital Alchemy' as two words in the script; no Arabic proper nouns in the script; at most ONE hero AR moment in #FFB347 or none; " +
    "match the two reference plates for location and grade; keep it under 9,000 characters. " +
    "Reply with JSON only: {\"script\":\"the exact words\",\"shots\":3,\"prompt\":\"the full paste body\"}.\n\n=== MASTER TEMPLATE ===\n" + SEEDANCE_TEMPLATE + "\n\n=== EXAMPLE PASTE BODY (Still Water, 9:16) ===\n" + SEEDANCE_EXAMPLE;
}
const APPEARANCE = /\b(beard|hair|bald|glasses|spectacles|eyes?|skin|suit|jacket|blazer|tie|shirt|sweater|cardigan|vest|hard hat|hi-?vis|wearing|dressed)\b/i;
// checks on the written prompt; returns a list of problems (empty = fine)
export function checkPrompt(p, script, secs) {
  const lo = Number(secs) === 8 ? 12 : 20, hi = Number(secs) === 8 ? 22 : 40, fit = Number(secs) === 8 ? "14 to 20 fit 8 seconds" : "26 to 36 fit 15 seconds";
  const out = [], body = String(p || ""), sc = String(script || "").trim();
  if (body.length < 1500) out.push("the prompt is too short");
  if (body.length > 9500) out.push("the prompt is over 9,500 characters (" + body.length + ")");
  const words = sc.split(/\s+/).filter(Boolean).length;
  if (words < lo || words > hi) out.push("the script is " + words + " words; " + fit);
  if (!/HARD CUT/i.test(body)) out.push("no HARD CUT between shots");
  if (!/frontal/i.test(body)) out.push("no frontal shot for the lip-sync to lock on");
  if (sc && !body.includes(sc.slice(0, 40))) out.push("the script is not quoted in the prompt");
  const avatarLines = body.split(/\n/).filter((l) => /\bavatar\b/i.test(l) && APPEARANCE.test(l) && !/inherited|do not re-describe|selected|look|twin/i.test(l));
  if (avatarLines.length) out.push("it describes the avatar's appearance (" + avatarLines[0].trim().slice(0, 80) + ")");
  return out;
}

// ---------- HeyGen v3 ----------
const API = "https://api.heygen.com";
const hdr = (env) => ({ "x-api-key": String(env.HEYGEN_API_KEY || "").trim(), "Content-Type": "application/json", Accept: "application/json" });
export async function heygenMe(env, deps) {
  const f = (deps && deps.fetch) || fetch;
  if (!env.HEYGEN_API_KEY) return { err: "no HeyGen key set" };
  try { const r = await f(API + "/v3/users/me", { headers: hdr(env) }); const j = await r.json().catch(() => ({})); return r.ok ? { ok: true, data: j.data || j } : { err: "HeyGen said " + r.status + ": " + String((j.error && (j.error.message || j.error)) || j.message || "").slice(0, 160) }; }
  catch (e) { return { err: "HeyGen did not answer" }; }
}
export async function cinematicStart(env, deps, o) {
  const f = (deps && deps.fetch) || fetch;
  if (!ALLOWED_LOOK_IDS.has(o.lookId)) return { err: "refused: that look is not one of the approved Polo_Trained looks" };
  if (!env.HEYGEN_API_KEY) return { err: "no HeyGen key set" };
  const body = { type: "cinematic_avatar", prompt: String(o.prompt).slice(0, 10000), avatar_id: [o.lookId], references: (o.plateUrls || []).slice(0, 2).map((url) => ({ type: "url", url })),
    aspect_ratio: o.shape === "landscape" ? "16:9" : "9:16", resolution: "1080p", duration: Number(o.secs) === 15 ? 15 : 8, auto_duration: false, enhance_prompt: false, title: String(o.title || "DigitAlchemy desk clip").slice(0, 80) };
  try {
    const r = await f(API + "/v3/videos", { method: "POST", headers: hdr(env), body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    const id = j && j.data && j.data.video_id;
    if (!r.ok || !id) return { err: "HeyGen refused (" + r.status + "): " + String((j.error && (j.error.message || j.error)) || j.message || "no video id").slice(0, 220) };
    return { videoId: id };
  } catch (e) { return { err: "HeyGen did not answer" }; }
}
export async function videoStatus(env, deps, id) {
  const f = (deps && deps.fetch) || fetch;
  try {
    const r = await f(API + "/v3/videos/" + encodeURIComponent(id), { headers: hdr(env) });
    const j = await r.json().catch(() => ({})), d = (j && j.data) || {};
    return { status: String(d.status || (r.ok ? "unknown" : "error")), url: d.video_url || "", duration: Number(d.duration) || 0, error: String(d.failure_message || (d.error && (d.error.message || d.error)) || "").slice(0, 200) };
  } catch (e) { return { status: "unknown" }; }
}

// ---------- the desk flow ----------
const K = "desk_clip_pick", J = "desk_clip_job";
const kvJ = async (env, k, d) => { try { const v = await env.MEETINGS.get(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
const put = (env, k, o, ttl) => env.MEETINGS.put(k, JSON.stringify(o), ttl ? { expirationTtl: ttl } : undefined);
const parseJ = (s) => { try { const m = String(s || "").match(/\{[\s\S]*\}/); return m ? JSON.parse(m[0]) : null; } catch (e) { return null; } };
const dayOf = (ms) => new Date(ms + 4 * 3600000).toISOString().slice(0, 10);
const nowOf = (deps) => (deps && deps.now ? deps.now() : Date.now());

// deps: { send, buttons, list, image, video, llm, genImage(env, prompt, size) -> {bytes}|{err}, storeImage(env, bytes) -> key, origin, now, probe?(env,url), fetch? }
export async function clipStart(env, deps, idea, kind, lane) {
  const lk = lookKindFor(idea, kind), look = pickLook(lk, Math.floor(nowOf(deps) / 86400000));
  await put(env, K, { step: "shape", idea, kind: kind || "", lane: lane || "alchemy", lookKind: lk, lookId: look.id, lookName: look.name, at: nowOf(deps) }, 6 * 3600);
  await deps.buttons(env, "A short video of you (Polo_Trained, " + look.name + "). Which shape?\nIdea: " + String(idea).slice(0, 300), [
    { id: "dc2:shape:portrait", title: "Portrait 9:16" }, { id: "dc2:shape:landscape", title: "Landscape 16:9" }, { id: "dc2:cancel", title: "Cancel" }]);
}
export const clipCredits = (secs) => (Number(secs) === 15 ? 60 : 32);
async function makePlates(env, deps, s) {
  await deps.send(env, "Making the two reference plates (no people, no text). About a minute...");
  const j = parseJ(await deps.llm(env, PLATE_SYS, "IDEA: " + s.idea + "\nSHAPE: " + (s.shape === "landscape" ? "landscape 16:9" : "portrait 9:16") + (s.plate_notes ? "\nOWNER'S NOTES: " + s.plate_notes : ""), 900));
  if (!j || !j.plate1 || !j.plate2) { await deps.send(env, "I could not write the plate descriptions just now. Tap Redo plates to try again."); return; }
  const size = s.shape === "landscape" ? "1536x1024" : "1024x1536", keys = [];
  for (const pr of [j.plate1, j.plate2]) {
    const g = await deps.genImage(env, pr + " Photographic, no people, no faces, no text, no letters, no signs, no logos.", size);
    if (g.err) { await deps.send(env, "A plate could not be made: " + (g.cap ? "the monthly picture budget is used up" : g.err) + "."); return; }
    keys.push(await deps.storeImage(env, g.bytes));
  }
  Object.assign(s, { step: "plates", plates: keys, plate_prompts: [j.plate1, j.plate2], scene: j.scene || "" }); await put(env, K, s, 6 * 3600);
  for (let i = 0; i < 2; i++) await deps.image(env, deps.origin(env) + "/ig_media/" + keys[i], "Plate " + (i + 1) + " of 2 (reference only, no people)." + (i === 0 && j.scene ? " Scene: " + j.scene : ""));
  await deps.buttons(env, "Use these two plates?", [{ id: "dc2:plates:ok", title: "Approve plates" }, { id: "dc2:plates:redo", title: "Redo plates" }, { id: "dc2:cancel", title: "Cancel" }]);
}
async function writePrompt(env, deps, s) {
  await deps.send(env, "Writing the full prompt from your master template...");
  let j = null, probs = [];
  for (let t = 0; t < 2; t++) {
    const user = "IDEA: " + s.idea + "\nLENGTH: " + (s.secs || 8) + " seconds\nSHAPE: " + (s.shape === "landscape" ? "landscape 16:9" : "vertical 9:16") + "\nPLATE 1: " + s.plate_prompts[0] + "\nPLATE 2: " + s.plate_prompts[1] +
      (s.changes && s.changes.length ? "\nOWNER'S CHANGES (follow them): " + s.changes.join(" | ") : "") + (probs.length ? "\nFIX THESE PROBLEMS IN THE LAST ATTEMPT: " + probs.join("; ") : "");
    j = parseJ(await deps.llm(env, promptSys(), user, 4000));
    if (!j || !j.prompt) { probs = ["no JSON came back"]; continue; }
    probs = checkPrompt(j.prompt, j.script, s.secs || 8);
    if (!probs.length) break;
  }
  if (!j || !j.prompt) { await deps.send(env, "The prompt could not be written just now. Tap More options, then Rewrite prompt."); return; }
  Object.assign(s, { step: "prompt", prompt: j.prompt, script: String(j.script || "").trim(), shots: j.shots || "", problems: probs }); await put(env, K, s, 6 * 3600);
  const sum = "Ready to make (about " + clipCredits(s.secs) + " HeyGen credits):\nLook: Polo_Trained, " + s.lookName + "\nShape: " + (s.shape === "landscape" ? "16:9" : "9:16") + ", " + (s.secs || 8) + " s, 1080p, Enhance off\nScript: \"" + s.script + "\"\nShots: " + (s.shots || "?") + ", prompt " + s.prompt.length + " characters" +
    (probs.length ? "\nStill to check: " + probs.join("; ") : "\nChecks passed: no description of you, hard cuts, a frontal shot for the lip-sync, no on-screen text.");
  await deps.buttons(env, sum.slice(0, 1020), [{ id: "dc2:make", title: "Make it" }, { id: "dc2:show", title: "Show prompt" }, { id: "dc2:more", title: "More options" }]);
}
export async function clipButton(env, deps, id) {
  const s = await kvJ(env, K, null);
  if (id === "dc2:cancel") { await env.MEETINGS.delete(K); await deps.send(env, "Cancelled. No HeyGen credits were used."); return true; }
  if (!s) { await deps.send(env, "That video set-up has expired. Pick the idea again."); return true; }
  let m;
  if ((m = id.match(/^dc2:shape:(portrait|landscape)$/))) { s.shape = m[1]; await put(env, K, s, 6 * 3600);
    await deps.buttons(env, "How long?", [{ id: "dc2:len:8", title: "8 seconds" }, { id: "dc2:len:15", title: "15 seconds" }, { id: "dc2:cancel", title: "Cancel" }]); return true; }
  if ((m = id.match(/^dc2:len:(8|15)$/))) { s.secs = Number(m[1]); return makePlates(env, deps, s).then(() => true); }
  if (id === "dc2:plates:redo") return makePlates(env, deps, s).then(() => true);
  if (id === "dc2:plates:ok") return writePrompt(env, deps, s).then(() => true);
  if (id === "dc2:show") {
    const P = String(s.prompt || ""); for (let i = 0; i < P.length && i < 9600; i += 3800) await deps.send(env, (i ? "" : "The full prompt:\n\n") + P.slice(i, i + 3800));
    await deps.buttons(env, "Make it?", [{ id: "dc2:make", title: "Make it" }, { id: "dc2:more", title: "More options" }, { id: "dc2:cancel", title: "Cancel" }]); return true;
  }
  if (id === "dc2:more") {
    await deps.list(env, "What should change?", "Choose", [
      { id: "dc2:rewrite", title: "Rewrite the prompt", description: "A fresh version, same plates" },
      { id: "dc2:change", title: "Type a change", description: "Your next message is the change" },
      { id: s.secs === 15 ? "dc2:relen:8" : "dc2:relen:15", title: s.secs === 15 ? "Make it 8 seconds" : "Make it 15 seconds", description: "Rewrites the script to fit" },
      { id: "dc2:look", title: "Change look", description: "Another Polo_Trained look" },
      { id: "dc2:plates:redo", title: "Redo the plates" },
      { id: "dc2:cancel", title: "Cancel", description: "No credits used" }]);
    return true;
  }
  if ((m = id.match(/^dc2:relen:(8|15)$/))) { s.secs = Number(m[1]); return writePrompt(env, deps, s).then(() => true); }
  if (id === "dc2:rewrite") return writePrompt(env, deps, s).then(() => true);
  if (id === "dc2:change") { s.step = "change_text"; await put(env, K, s, 6 * 3600); await deps.send(env, "Tell me the change in your next message, for example: walk towards the camera in the first shot, or make the last line warmer."); return true; }
  if (id === "dc2:look") {
    await deps.list(env, "Which kind of look?", "Pick look", Object.keys(LOOKS).map((k) => ({ id: "dc2:lk:" + k, title: LOOK_KIND_LABEL[k], description: LOOKS[k].map((l) => l.name).join(", ").slice(0, 72) }))); return true;
  }
  if ((m = id.match(/^dc2:lk:(site|office|talk|casual)$/))) {
    const prev = LOOKS[m[1]].findIndex((l) => l.id === s.lookId), lk = LOOKS[m[1]][(prev + 1) % LOOKS[m[1]].length];
    Object.assign(s, { lookKind: m[1], lookId: lk.id, lookName: lk.name }); await put(env, K, s, 6 * 3600);
    await deps.send(env, "Look changed to " + lk.name + ". The prompt stays the same (it never describes you)."); return writePrompt(env, deps, s).then(() => true);
  }
  if (id === "dc2:make") {
    if (!s.prompt) { await deps.send(env, "There is no prompt yet."); return true; }
    const day = dayOf(nowOf(deps)), used = Number(await env.MEETINGS.get("clip_count_" + day)) || 0;
    if (used >= CLIP_DAILY_MAX) { await deps.send(env, "That is today's " + CLIP_DAILY_MAX + " videos already (the daily limit). It will work tomorrow, or raise the limit with me."); return true; }
    const busy = await kvJ(env, J, null); if (busy && !busy.done) { await deps.send(env, "A video is still being made; wait for it first."); return true; }
    const o = deps.origin(env), r = await cinematicStart(env, deps, { lookId: s.lookId, prompt: s.prompt, plateUrls: s.plates.map((k) => o + "/ig_media/" + k), shape: s.shape, secs: s.secs || 8, title: "Desk: " + s.idea.slice(0, 60) });
    if (r.err) { await deps.send(env, "Not started: " + r.err + ". No credits used."); return true; }
    await env.MEETINGS.put("clip_count_" + day, String(used + 1), { expirationTtl: 3 * 86400 });
    const n = Number(await env.MEETINGS.get("desk_clip_seq") || 0) + 1; await env.MEETINGS.put("desk_clip_seq", String(n));
    await put(env, J, { n, videoId: r.videoId, idea: s.idea, script: s.script, lookName: s.lookName, lookId: s.lookId, prompt: s.prompt, shape: s.shape, secs: s.secs || 8, plates: s.plates, at: nowOf(deps), polls: 0 }, 3 * 86400);
    await env.MEETINGS.delete(K);
    await deps.send(env, "Started at HeyGen (video " + (used + 1) + " of " + CLIP_DAILY_MAX + " today). It usually takes a few minutes; I will send it here when it is ready and checked.");
    return true;
  }
  return false;
}
export async function clipText(env, deps, t) {
  const s = await kvJ(env, K, null);
  if (!s || s.step !== "change_text") return false;
  s.changes = (s.changes || []).concat([String(t).slice(0, 300)]).slice(-5); s.step = "prompt"; await put(env, K, s, 6 * 3600);
  await writePrompt(env, deps, s); return true;
}

// the minute tick: poll the clip in progress; when done, check it, keep it, log it, show it
export async function clipTick(env, deps) {
  const j = await kvJ(env, J, null);
  if (!j || j.done || !j.videoId) return;
  const st = await videoStatus(env, deps, j.videoId);
  const save = () => put(env, J, j, 3 * 86400);
  if (st.status === "failed" || st.status === "error") { j.done = true; await save(); await deps.send(env, "HeyGen could not make the video" + (st.error ? ": " + st.error : "") + ". Nothing was posted."); return; }
  if (st.status !== "completed" || !st.url) { j.polls++; if (j.polls > 60) { j.done = true; await deps.send(env, "The video is taking over an hour at HeyGen; I stopped waiting. It will be in your HeyGen library."); } await save(); return; }
  const f = (deps && deps.fetch) || fetch;
  let bytes = null; try { const r = await f(st.url); if (r.ok) bytes = await r.arrayBuffer(); } catch (e) {}
  if (!bytes || bytes.byteLength < 10000) { j.polls++; await save(); return; }
  if (bytes.byteLength > 25 * 1024 * 1024) { j.done = true; await save(); await deps.send(env, "The video is over 25 MB, too big to keep here. It is in your HeyGen library; nothing was posted."); return; }
  const key = "clip_" + j.n;
  await env.MEETINGS.put("vid_" + key, bytes, { expirationTtl: 60 * 86400 });
  const link = deps.origin(env) + "/video/" + key;
  // the checks: length 8 to 16 s; speech must start in the first 8 s (Cinematic drops lines without the early frontal shot, lesson L19)
  const notes = [];
  let pr = null; if (deps.probe) { try { pr = await deps.probe(env, link); } catch (e) {} }
  const dur = (pr && pr.duration) || st.duration || 0;
  const want = j.secs || 8; if (dur && (dur < want - 2 || dur > want + 1.5)) notes.push("it is " + Math.round(dur) + " seconds long");
  if (pr && pr.speech_start != null && pr.speech_start > want / 2) notes.push("speech only starts at " + Math.round(pr.speech_start) + " s, so lines may be missing");
  if (pr && pr.speech_seconds != null && pr.speech_seconds < 3) notes.push("there is very little speech in it");
  j.done = true; j.key = key; j.checks = notes; await save();
  const L = await kvJ(env, "desk_clip_log", []); L.push({ n: j.n, at: Date.now(), idea: j.idea, look: j.lookName, video_id: j.videoId, key, chars: j.prompt.length, checks: notes });
  await put(env, "desk_clip_log", L.slice(-200)); await env.MEETINGS.put("clip_prompt_" + j.n, j.prompt, { expirationTtl: 90 * 86400 });
  await env.MEETINGS.put("desk_reel_pending", JSON.stringify({ url: link, caption: j.script, at: Date.now() }), { expirationTtl: 2 * 86400 });
  await env.MEETINGS.put("desk_vid_last", JSON.stringify({ key, bytes: bytes.byteLength, at: Date.now() }), { expirationTtl: 60 * 86400 });
  if (deps.video) await deps.video(env, link, "Your video (" + (dur ? Math.round(dur) + " s, " : "") + j.lookName + ")." + (notes.length ? " CHECK: " + notes.join("; ") + "." : " Checks passed: length and speech."));
  await deps.buttons(env, "Watch the first seconds: is it you, and are the words right?", [{ id: "dr:ok", title: "Post it" }, { id: "dc:ai:reel:" + key, title: "Rewrite caption" }, { id: "dr:no", title: "Discard" }]);
}
