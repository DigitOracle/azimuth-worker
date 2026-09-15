// v152.9 - the spoken meeting reminder (15 Sep 2026): text-to-speech as OGG/Opus, uploaded to WhatsApp media, sent as a native voice note
// at T-15, only when VOICE_REMINDERS is on and only inside the owner's 24-hour window. The voice block is lifted out of the worker and
// run with Workers AI, KV and the WhatsApp API stubbed; /voice_sample is exercised through the real worker. Nothing leaves this machine.
import worker from "../src/index.js";
import fs from "node:fs";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };
const src = fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const v0 = src.indexOf("// v152.9 - VOICE REMINDER"), v1 = src.indexOf("async function ringWhatsApp(env, text) {");
const OGG = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 1, 2, 3, 4]);
const calls = [], errors = [];
const store = new Map([["wa_owner_last_in", new Date(Date.now() - 3600e3).toISOString()]]);
const KV = { async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); }, async list() { return { keys: [] }; } };
const fetchStub = async (url, init) => {
  calls.push({ url: String(url), init });
  if (String(url).endsWith("/media")) return new Response(JSON.stringify({ id: "MEDIA123" }), { status: 200 });
  return new Response(JSON.stringify({ messages: [{ id: "wamid.X" }] }), { status: 200 });
};
const waPost = async (env, payload, kind) => { const r = await fetchStub("https://graph.facebook.com/v21.0/PHONE/messages", { body: JSON.stringify(payload), kind }); return r; };
const V = new Function("fetch", "WA_GRAPH", "waPost", "noteErr", "ownerWindowOpen", src.slice(v0, v1) + "\nreturn { voiceText, ttsOgg, waUploadAudio, voiceReminder, VOICE_MODEL };")(
  fetchStub, "https://graph.facebook.com/v21.0", waPost, async (env, where, msg) => { errors.push([where, msg]); },
  async (env) => { const t = await env.MEETINGS.get("wa_owner_last_in"); return !!t && (Date.now() - Date.parse(t)) < 23 * 3600e3; });
const aiCalls = [];
const env = { MEETINGS: KV, WHATSAPP_TOKEN: "T", WA_PHONE_ID: "PHONE", WA_ALLOWED: "971500000000", VOICE_REMINDERS: "on", VOICE_SPEAKER: "asteria",
  AI: { async run(model, input) { aiCalls.push([model, input]); return new ReadableStream({ start(c) { c.enqueue(OGG); c.close(); } }); } } };

// 1. what it says
ok(V.voiceText(env, { summary: "📅 Viewing with Ellington https://meet.google.com/abc-def", location: "Dubai Hills Estate" }) === "Reminder. Viewing with Ellington starts in fifteen minutes, at Dubai Hills Estate.", "wording: the meeting and its place, no links or emoji read aloud");
ok(V.voiceText(env, { summary: "Weekly sync", join: "https://meet.google.com/x" }) === "Reminder. Weekly sync starts in fifteen minutes, online.", "wording: an online meeting says online, not the link");
ok(V.voiceText(Object.assign({}, env, { VOICE_TEMPLATE: "Black Coffee, reminder. {what} starts in fifteen minutes{where}." }), { summary: "Viewing", location: "JVC" }) === "Black Coffee, reminder. Viewing starts in fifteen minutes, at JVC.", "wording: each instance can carry its own approved greeting");

// 2. the voice note itself
const out = await V.voiceReminder(env, "Reminder. Viewing starts in fifteen minutes.");
const up = calls.find(c => c.url.endsWith("/PHONE/media")), msg = calls.find(c => c.url.endsWith("/messages"));
ok(aiCalls.length === 1 && aiCalls[0][0] === "@cf/deepgram/aura-2-en" && aiCalls[0][1].encoding === "opus" && aiCalls[0][1].container === "ogg" && aiCalls[0][1].speaker === "asteria", "speech: OGG/Opus from the account's text-to-speech, in the chosen voice");
ok(!!up && up.init.headers.Authorization === "Bearer T" && up.init.body instanceof FormData && up.init.body.get("messaging_product") === "whatsapp" && up.init.body.get("type") === "audio/ogg", "upload: the audio goes to WhatsApp media as audio/ogg");
const payload = msg && JSON.parse(msg.init.body);
ok(payload && payload.type === "audio" && payload.audio.id === "MEDIA123" && payload.audio.voice === true && payload.to === "971500000000", "send: an audio message with voice:true, so it plays as a voice note, to the owner");
ok(out.ok === true && out.bytes === OGG.length && JSON.parse(store.get("voice_last")).ok === true, "record: the last voice note is kept for checking");

// 3. when it must not go
calls.length = 0; aiCalls.length = 0;
ok((await V.voiceReminder(Object.assign({}, env, { VOICE_REMINDERS: "off" }), "x")).skipped === "off" && !calls.length && !aiCalls.length, "off by default: nothing generated, nothing sent");
store.set("wa_owner_last_in", new Date(Date.now() - 30 * 3600e3).toISOString());
ok((await V.voiceReminder(env, "x")).skipped === "outside the 24-hour window" && !calls.length && !aiCalls.length, "outside the owner's 24-hour window: skipped (WhatsApp would refuse it); the text reminder still goes");
store.set("wa_owner_last_in", new Date().toISOString());
const badEnv = Object.assign({}, env, { AI: { async run() { throw new Error("model busy"); } } });
const bad = await V.voiceReminder(badEnv, "x");
ok(bad.ok === false && /model busy/.test(bad.error) && errors.some(e => e[0] === "voice-reminder"), "a failure is noted, never thrown into the reminder pass");

// 4. the hook in the reminder pass, and the sample route
const nudgeSrc = src.slice(src.indexOf("async function meetingNudges(env) {"), src.indexOf("function ageDays(ts)"));
ok(/if \(lead === 15 && env\.VOICE_REMINDERS === "on"\) \{\s*try \{ await voiceReminder\(env, voiceText\(env, m\)\); \} catch \(e\) \{\}/.test(nudgeSrc), "reminder pass: the voice note goes at T-15 when switched on");
const store2 = new Map();
const env2 = { MEETINGS: { async get(k) { return store2.get(k) ?? null; }, async put(k, v) { store2.set(k, v); }, async delete() {}, async list() { return { keys: [] }; } }, READ_KEY: "RK", AI: env.AI };
globalThis.fetch = async () => new Response("{}");
let r = await worker.fetch(new Request("https://x.dev/voice_sample?key=nope"), env2, { waitUntil() {} });
ok(r.status === 401, "/voice_sample: the client key is needed");
r = await worker.fetch(new Request("https://x.dev/voice_sample?key=RK&voice=orion&text=" + encodeURIComponent("Reminder. Test.")), env2, { waitUntil() {} });
const bytes = new Uint8Array(await r.arrayBuffer());
ok(r.status === 200 && r.headers.get("Content-Type") === "audio/ogg" && bytes[0] === 0x4f && decodeURIComponent(r.headers.get("X-Voice-Text")) === "Reminder. Test." && aiCalls.at(-1)[1].speaker === "orion", "/voice_sample: returns the voice note's audio in the asked voice, and sends nothing");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
