// v626 - Momo Work: a private speaker-detection test (Kendall, 24 Oct 2026). POST an audio file to /momo/work/voicetest?key=<Najjuko's key> and the worker, using the speech key it already holds, runs
//   (a) gpt-4o-transcribe-diarize, with no known speakers, (b) the same with known speakers cut from the spoken hello (?refs=Name:start-end,... on a WAV file),
//   (c) whisper-1 with the language left on auto, (d) whisper-1 forced to English (the way Momo read audio before v625).
// Nothing is stored (apart from a 10-minute spend guard), the key is never logged or returned, and a GET does nothing.
const GUARD = "work_naj_voicetest_last", MAX_BYTES = 25 * 1024 * 1024, GUARD_SECS = 600;
const sniff = (b) => {
  const s4 = (o) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
  if (b.length < 12) return null;
  if (s4(0) === "RIFF" && s4(8) === "WAVE") return { ext: "wav", mime: "audio/wav" };
  if (s4(4) === "ftyp") return { ext: "m4a", mime: "audio/mp4" };
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { ext: "webm", mime: "audio/webm" };
  if (s4(0) === "OggS") return { ext: "ogg", mime: "audio/ogg" };
  if (s4(0).startsWith("ID3") || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return { ext: "mp3", mime: "audio/mpeg" };
  return null;
};
const b64 = (bytes) => { let bin = ""; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(bin); };
// a clip of a 16-bit PCM WAV, start..end seconds, as a new WAV (the only format a worker can cut without decoding)
export function wavClip(bytes, from, to) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let p = 12, fmt = null, data = null;
  while (p + 8 <= bytes.length) {
    const id = String.fromCharCode(bytes[p], bytes[p + 1], bytes[p + 2], bytes[p + 3]), sz = dv.getUint32(p + 4, true);
    if (id === "fmt ") fmt = { tag: dv.getUint16(p + 8, true), ch: dv.getUint16(p + 10, true), rate: dv.getUint32(p + 12, true), bits: dv.getUint16(p + 22, true) };
    if (id === "data") { data = { at: p + 8, len: Math.min(sz, bytes.length - (p + 8)) }; break; }
    p += 8 + sz + (sz % 2);
  }
  if (!fmt || !data || fmt.tag !== 1 || fmt.bits !== 16) return null;
  const frame = fmt.ch * 2, a = Math.max(0, Math.floor(from * fmt.rate)) * frame, z = Math.min(data.len, Math.floor(to * fmt.rate) * frame);
  if (z - a < frame * fmt.rate * 1.5) return null;   // under 1.5 s of speech is no voice sample
  const pcm = bytes.subarray(data.at + a, data.at + z), out = new Uint8Array(44 + pcm.length), o = new DataView(out.buffer), w = (off, s) => { for (let i = 0; i < s.length; i++) out[off + i] = s.charCodeAt(i); };
  w(0, "RIFF"); o.setUint32(4, 36 + pcm.length, true); w(8, "WAVE"); w(12, "fmt "); o.setUint32(16, 16, true); o.setUint16(20, 1, true); o.setUint16(22, fmt.ch, true); o.setUint32(24, fmt.rate, true); o.setUint32(28, fmt.rate * frame, true); o.setUint16(32, frame, true); o.setUint16(34, 16, true); w(36, "data"); o.setUint32(40, pcm.length, true); out.set(pcm, 44);
  return out;
}
export function parseRefs(s) {   // "Kendall:0-8,Najjuko:9-17" -> [{name, from, to}] (at most four, the model's limit)
  return String(s || "").split(",").map((x) => x.trim()).filter(Boolean).map((x) => { const m = /^([^:]{1,40}):(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/.exec(x); return m && +m[3] > +m[2] && +m[3] - +m[2] <= 30 ? { name: m[1].replace(/[^\p{L}\p{N} .'-]/gu, "").trim(), from: +m[2], to: +m[3] } : null; }).filter((r) => r && r.name).slice(0, 4);
}
export async function voiceTestRoute(request, env, url, J, deps) {
  if (request.method !== "POST") return J({ error: "POST an audio file here." }, 405);
  const key = env.OPENAI_API_KEY; if (!key) return J({ error: "The speech service is not set up on this worker." }, 500);
  const declared = parseInt(request.headers.get("content-length") || "0", 10);
  if (declared > MAX_BYTES) return J({ error: "That file is over 25 MB." }, 413);
  if (await env.MEETINGS.get(GUARD)) return J({ error: "One test per 10 minutes, to guard the spend. Try again shortly." }, 429);
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length > MAX_BYTES) return J({ error: "That file is over 25 MB." }, 413);
  const kind = sniff(bytes); if (!kind) return J({ error: "That does not look like audio (wav, m4a, mp3, webm or ogg)." }, 400);
  await env.MEETINGS.put(GUARD, String(Date.now()), { expirationTtl: GUARD_SECS });   // set first: a failed run still counts, so a stuck client cannot spend repeatedly
  const doFetch = (deps && deps.openaiFetch) || fetch, auth = { Authorization: "Bearer " + key };
  const safe = (t) => String(t || "").split(key).join("[key]").replace(/sk-[A-Za-z0-9_\-]{8,}/g, "[key]").slice(0, 240);
  const names = String(url.searchParams.get("names") || "").split(",").map((x) => x.trim().replace(/[^\p{L}\p{N} .'-]/gu, "")).filter(Boolean).slice(0, 4);
  const file = () => new Blob([bytes], { type: kind.mime });
  const run = async (label, model, fill) => {
    const t0 = Date.now();
    try {
      const fd = new FormData(); fd.append("file", file(), "meeting." + kind.ext); fd.append("model", model); fill(fd);
      const r = await doFetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: auth, body: fd }), txt = await r.text();
      if (!r.ok) return { label, model, ok: false, status: r.status, error: safe(txt), ms: Date.now() - t0 };
      let j = null; try { j = JSON.parse(txt); } catch (e) {}
      return { label, model, ok: true, ms: Date.now() - t0, text: j ? j.text || "" : txt, language: j && j.language || null, segments: j && (j.segments || null) };
    } catch (e) { return { label, model, ok: false, error: safe(e && e.message), ms: Date.now() - t0 }; }
  };
  const jobs = [
    run("diarize_no_names", "gpt-4o-transcribe-diarize", (fd) => { fd.append("response_format", "diarized_json"); fd.append("chunking_strategy", "auto"); }),
    run("whisper_auto", "whisper-1", (fd) => { fd.append("response_format", "verbose_json"); }),
    run("whisper_forced_en", "whisper-1", (fd) => { fd.append("response_format", "verbose_json"); fd.append("language", "en"); })
  ];
  const refs = parseRefs(url.searchParams.get("refs")), notes = [];
  if (refs.length) {
    if (kind.ext !== "wav") notes.push("Known-speaker run skipped: voice samples can only be cut from a 16-bit WAV file. Convert first: ffmpeg -i in.m4a -ac 1 -ar 16000 out.wav");
    else {
      const clips = refs.map((r) => ({ name: r.name, clip: wavClip(bytes, r.from, r.to) }));
      const bad = clips.filter((c) => !c.clip).map((c) => c.name);
      if (bad.length) notes.push("Known-speaker run skipped: no usable 16-bit WAV sample (at least 1.5 s) for " + bad.join(", ") + ".");
      else jobs.push(run("diarize_known_speakers", "gpt-4o-transcribe-diarize", (fd) => { fd.append("response_format", "diarized_json"); fd.append("chunking_strategy", "auto"); clips.forEach((c) => { fd.append("known_speaker_names[]", c.name); fd.append("known_speaker_references[]", "data:audio/wav;base64," + b64(c.clip)); }); }));
    }
  } else if (names.length) notes.push("names were given without ?refs=Name:start-end,... so no known-speaker run was made (the model needs a voice sample per name).");
  const results = await Promise.all(jobs);
  return J({ ok: true, bytes: bytes.length, format: kind.ext, names, refs: refs.map((r) => r.name + ":" + r.from + "-" + r.to), notes, results });
}
