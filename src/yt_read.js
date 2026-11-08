// v823 - read one YouTube video for the huddle's Theme & clip card: title, description and, where YouTube publishes them, the English captions.
// The key is the worker secret YOUTUBE_API_KEY (the same YouTube Data API key the launches collector reads from its environment); it is sent only to
// googleapis.com and is never logged, returned or shown. Captions: the Data API cannot download captions without the channel owner's sign-in, so the
// public caption track (youtube.com/api/timedtext, English, then English auto-generated) is tried; when there is none, the draft uses title + description
// and the card says so. Plain requests only (no browser disguise).
export function ytId(url) {
  const s = String(url || "").trim();
  const m = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/.exec(s);
  return m ? m[1] : "";
}
const decode = (t) => String(t || "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
export async function ytRead(env, url, f) {
  f = f || fetch;
  const id = ytId(url); if (!id) return { error: "That is not a YouTube link. Paste the link Ali sent (youtube.com or youtu.be)." };
  const key = env.YOUTUBE_API_KEY; if (!key) return { error: "Reading YouTube is not switched on yet (the YouTube key is not set on the worker)." };
  let v = null;
  try { const r = await f("https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=" + id + "&key=" + encodeURIComponent(key)); const j = await r.json(); v = j && j.items && j.items[0]; } catch (e) { v = null; }
  if (!v) return { error: "YouTube did not return that video. Check the link is public." };
  const sn = v.snippet || {};
  let captions = "";
  for (const q of ["lang=en", "lang=en&kind=asr"]) {
    try { const ac = typeof AbortController !== "undefined" ? new AbortController() : null, tm = ac ? setTimeout(() => ac.abort(), 4000) : null; const r = await f("https://www.youtube.com/api/timedtext?" + q + "&v=" + id, ac ? { signal: ac.signal } : undefined); if (tm) clearTimeout(tm); if (r.ok) { const t = decode(await r.text()); if (t.length > 80) { captions = t.slice(0, 15000); break; } } } catch (e) {}
  }
  return { id, url: "https://www.youtube.com/watch?v=" + id, title: String(sn.title || "").slice(0, 200), description: String(sn.description || "").slice(0, 5000), channel: String(sn.channelTitle || "").slice(0, 100),
    duration: (v.contentDetails && v.contentDetails.duration) || "", captions, captions_ok: !!captions };
}
