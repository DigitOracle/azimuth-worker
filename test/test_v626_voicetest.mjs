// v626 - the private speaker-detection test route (SYNTHETIC audio only; Kendall 24 Oct 2026)
import { readFileSync } from "node:fs";
const W = await import("../src/work_log.js"); const V = await import("../src/work_voicetest.js");
let pass = 0, fail = 0; const ok = (c, msg) => { if (c) pass++; else { fail++; console.log("FAIL", msg); } };
const store = new Map(), ttl = new Map();
const KV = { get: async (k) => store.get(k) ?? null, put: async (k, v, o) => { store.set(k, v); if (o && o.expirationTtl) ttl.set(k, o.expirationTtl); }, delete: async (k) => { store.delete(k); }, list: async () => ({ keys: [], list_complete: true }) };
const KEY = "sk-SYNTHETIC-KEY-1234567890abcdef";
const env = { MEETINGS: KV, OPENAI_API_KEY: KEY };

// a 16 kHz mono 16-bit WAV of a tone, `secs` long
const wav = (secs) => { const n = Math.floor(16000 * secs), out = new Uint8Array(44 + n * 2), o = new DataView(out.buffer), w = (at, s) => { for (let i = 0; i < s.length; i++) out[at + i] = s.charCodeAt(i); };
  w(0, "RIFF"); o.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt "); o.setUint32(16, 16, true); o.setUint16(20, 1, true); o.setUint16(22, 1, true); o.setUint32(24, 16000, true); o.setUint32(28, 32000, true); o.setUint16(32, 2, true); o.setUint16(34, 16, true); w(36, "data"); o.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) o.setInt16(44 + i * 2, Math.round(3000 * Math.sin(i / 8)), true); return out; };
const m4a = () => { const b = new Uint8Array(4000); b.set([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20]); return b; };

const calls = []; let mode = "ok";
const openaiFetch = async (u, init) => {
  const fd = init.body, rec = { url: u, auth: init.headers.Authorization, model: fd.get("model"), format: fd.get("response_format"), lang: fd.get("language"), chunking: fd.get("chunking_strategy"), names: fd.getAll("known_speaker_names[]"), refs: fd.getAll("known_speaker_references[]") };
  calls.push(rec);
  if (mode === "err") return new Response('{"error":{"message":"Incorrect API key provided: ' + KEY + '"}}', { status: 401 });
  return new Response(JSON.stringify({ text: "hello " + rec.model, language: "english", segments: [{ speaker: "A", text: "hi", start: 0, end: 1 }] }), { status: 200 });
};
const deps = { isNaj: (e, u) => u.searchParams.get("key") === "K", page: (k, r, b) => b, openaiFetch };
const post = async (path, body, d) => { const u = new URL("https://w" + path); return W.workRoute(new Request(u, { method: "POST", body }), env, u, d || deps); };

// the gate
let r = await post("/momo/work/voicetest?key=bad", wav(3)); ok(r.status === 401 && calls.length === 0, "wrong key: 401 and nothing is sent to the speech service");
const gu = new URL("https://w/momo/work/voicetest?key=K"); r = await W.workRoute(new Request(gu), env, gu, deps); ok(r.status === 405 && calls.length === 0, "a GET does nothing");
const noKey = { ...env, OPENAI_API_KEY: undefined }; const u0 = new URL("https://w/momo/work/voicetest?key=K"); r = await W.workRoute(new Request(u0, { method: "POST", body: wav(3) }), noKey, u0, deps); ok(r.status === 500 && calls.length === 0, "no key on the worker: a plain error, nothing sent");
r = await post("/momo/work/voicetest?key=K", new Uint8Array(3000).fill(7)); ok(r.status === 400 && calls.length === 0, "not audio: refused");
ok(!store.has("work_naj_voicetest_last"), "refusals do not start the spend guard");
const big = new Request("https://w/momo/work/voicetest?key=K", { method: "POST", body: wav(3), headers: { "content-length": String(26 * 1024 * 1024) } });
r = await W.workRoute(big, env, new URL(big.url), deps); ok(r.status === 413, "a declared size over 25 MB is refused before it is read");

// a normal run, no names
r = await post("/momo/work/voicetest?key=K", wav(3)); let j = await r.json();
ok(r.status === 200 && j.ok && calls.length === 3, "three runs: diarize, whisper auto, whisper forced English");
ok(calls.every((c) => c.url === "https://api.openai.com/v1/audio/transcriptions" && c.auth === "Bearer " + KEY), "all go to the transcription endpoint with the worker's own key");
const d = calls.find((c) => c.model === "gpt-4o-transcribe-diarize"); ok(d && d.format === "diarized_json" && d.chunking === "auto" && d.names.length === 0, "diarize: diarized_json, chunking auto, no known speakers");
const wa = calls.filter((c) => c.model === "whisper-1"); ok(wa.length === 2 && wa.filter((c) => c.lang === "en").length === 1 && wa.filter((c) => !c.lang).length === 1, "whisper once with the language left on auto, once forced to en");
ok(j.results.length === 3 && j.results.every((x) => x.ok && typeof x.ms === "number" && x.text), "each result carries its text and timing");
ok(!JSON.stringify(j).includes(KEY), "the key is never in the answer");
ok(store.has("work_naj_voicetest_last") && ttl.get("work_naj_voicetest_last") === 600, "a 10-minute spend guard is set");
const before = calls.length; r = await post("/momo/work/voicetest?key=K", wav(3)); ok(r.status === 429 && calls.length === before, "a second test inside 10 minutes is refused and spends nothing");

// known speakers cut from the hello (WAV only)
store.delete("work_naj_voicetest_last"); calls.length = 0;
r = await post("/momo/work/voicetest?key=K&names=Kay,Lee&refs=Kay:0-3,Lee:4-8", wav(20)); j = await r.json();
const k = calls.find((c) => c.names.length); ok(calls.length === 4 && k && k.names.join() === "Kay,Lee" && k.refs.length === 2 && k.refs.every((x) => x.startsWith("data:audio/wav;base64,")), "with refs: a fourth run sends known_speaker_names[] and a data-URL voice sample per name");
const clip = V.wavClip(wav(20), 4, 8); ok(clip && String.fromCharCode(...clip.subarray(0, 4)) === "RIFF" && clip.length === 44 + 4 * 32000, "a sample is a real WAV of the asked length (4 s)");
ok(V.wavClip(wav(20), 0, 1) === null && V.wavClip(m4a(), 0, 5) === null, "under 1.5 s, or not PCM WAV: no sample");
ok(V.parseRefs("A:0-5,B:5-3,C:1-2000,D:x,E:2-9").length === 2, "bad, reversed, over-30-s and malformed refs are dropped");
ok(V.parseRefs("a:0-1,b:0-1,c:0-1,d:0-1,e:0-1").length === 4, "at most four known speakers (the model's limit)");

store.delete("work_naj_voicetest_last"); calls.length = 0;
r = await post("/momo/work/voicetest?key=K&refs=Kay:0-3", m4a()); j = await r.json();
ok(calls.length === 3 && j.notes.some((n) => /WAV/.test(n)), "refs on a non-WAV file: the known-speaker run is skipped with an explanation");
store.delete("work_naj_voicetest_last"); calls.length = 0;
r = await post("/momo/work/voicetest?key=K&names=Kay", wav(5)); j = await r.json();
ok(calls.length === 3 && j.notes.some((n) => /voice sample/.test(n)), "names without refs: explained, not guessed");

// the key must never leak, even when the speech service echoes it back
store.delete("work_naj_voicetest_last"); calls.length = 0; mode = "err";
r = await post("/momo/work/voicetest?key=K", wav(3)); const raw = await r.text();
ok(r.status === 200 && !raw.includes(KEY) && !raw.includes("sk-SYNTH") && raw.includes("[key]"), "an upstream error that echoes the key comes back redacted");
mode = "ok";

// wiring
const idx = readFileSync(new URL("../src/index.js", import.meta.url), "latin1");
ok(/MOMO_WORK_POSTS = new Set\([^)]*"\/momo\/work\/voicetest"/.test(idx), "the POST guard lets the test address through (it is still owner-gated inside)");
const src = readFileSync(new URL("../src/work_voicetest.js", import.meta.url), "utf8");
ok((src.match(/OPENAI_API_KEY/g) || []).length === 1 && !/console\.(log|error|warn)/.test(src), "the key is read once and nothing is logged");
console.log("v626 voicetest: " + pass + " passed, " + fail + " failed"); if (fail) process.exit(1);
