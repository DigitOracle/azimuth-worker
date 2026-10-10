// v467 - MUSIC FOR POSTS (Kendall 10 Oct 2026: "free music, cloud, build it and deploy"). Instagram's and LinkedIn's own music
// libraries cannot be used from outside their apps, so music goes INTO the video: post pictures + a royalty-free track -> a short
// portrait MP4 made by the da-video Worker (ffmpeg in a Cloudflare Container), which then posts as a Reel / LinkedIn video.
// Library: KV music_index = {mood: [{key, title, source, licence, at}]}; bytes in music_<key> (audio, up to 20 MB); served at /music/<key>.
// Tracks come only from royalty-free sources with a commercial licence (YouTube Audio Library, Pixabay Music) or Kendall's own files.

export const MOODS = ["calm", "corporate", "upbeat", "cinematic", "inspiring"];
export const MUSIC_MAX = 20 * 1024 * 1024;

export async function musicIndex(env) { try { return JSON.parse((await env.MEETINGS.get("music_index")) || "{}"); } catch (e) { return {}; } }
export function moodOf(s) { const m = String(s || "").toLowerCase().match(/\b(calm|corporate|upbeat|cinematic|inspiring)\b/); return m ? m[1] : ""; }

export async function addTrack(env, bytes, mood, title, source) {
  if (!MOODS.includes(mood)) return { err: "mood must be one of " + MOODS.join(", ") };
  if (!bytes || !bytes.byteLength) return { err: "no audio" };
  if (bytes.byteLength > MUSIC_MAX) return { err: "that track is over 20 MB" };
  const ix = await musicIndex(env);
  const n = Object.values(ix).reduce((a, L) => a + L.length, 0) + 1;
  const key = mood + "_" + n + "_" + Math.random().toString(36).slice(2, 6);
  await env.MEETINGS.put("music_" + key, bytes);
  (ix[mood] = ix[mood] || []).push({ key, title: String(title || mood + " " + n).slice(0, 80), source: String(source || "sent by Kendall").slice(0, 120), licence: "royalty-free", at: Date.now() });
  await env.MEETINGS.put("music_index", JSON.stringify(ix));
  return { key, count: ix[mood].length };
}

export function libraryText(ix) {
  const have = MOODS.filter((m) => (ix[m] || []).length);
  if (!have.length) return "The music library is empty. To add a track, send an audio file here with the caption music: <mood> <title> (moods: " + MOODS.join(", ") + "). Use only royalty-free tracks with a commercial licence (YouTube Audio Library, Pixabay Music).";
  return "Music library:\n" + have.map((m) => m + ": " + ix[m].map((t) => t.title).join(", ")).join("\n") + "\nAdd one: send an audio file with the caption music: <mood> <title>.";
}

// the next track in a mood after the one last used (round-robin), or null
export function pickTrack(ix, mood, lastKey) {
  const L = ix[mood] || []; if (!L.length) return null;
  const i = L.findIndex((t) => t.key === lastKey);
  return L[(i + 1) % L.length];
}

// GET /music/<key>: public (the video service fetches it), audio bytes
export async function musicRoute(env, url) {
  if (url.pathname.indexOf("/music/") !== 0) return null;
  const key = url.pathname.slice(7).replace(/[^a-z0-9_]/gi, "");
  const b = key ? await env.MEETINGS.get("music_" + key, "arrayBuffer") : null;
  if (!b) return new Response("no track", { status: 404 });
  return new Response(b, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=86400" } });
}

// ask the video service for the MP4; returns {bytes} or {err}
export async function renderVideo(env, job) {
  if (!env.VIDEO_SVC) return { err: "the video service is not connected" };
  try {
    const r = await env.VIDEO_SVC.fetch("https://da-video/render", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(job) });
    if (!r.ok) { let j = {}; try { j = await r.json(); } catch (e) {} return { err: "the video service said: " + String(j.error || ("HTTP " + r.status)).slice(0, 200) }; }
    const bytes = await r.arrayBuffer();
    return bytes.byteLength > 1000 ? { bytes } : { err: "the video came back empty" };
  } catch (e) { return { err: "the video service did not answer" }; }
}
