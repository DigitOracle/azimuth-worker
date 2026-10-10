// v461 - a video sent to the desk from the phone: stored, then reel / status / broadcast by caption or by button. Offline.
import { deskHandle } from "../src/desk.js";

const OWNER = "971562276093", STRANGER = "971500001234", PID = "1370146096179819";
const store = new Map();
const KV = { async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); }, async list() { return { keys: [] }; } };
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 500) : "")); } };
const texts = [], raws = [], fetched = []; let size = 10 * 1048576;
globalThis.fetch = async () => new Response("{}");
const lab = { owner: OWNER, pid: PID, graph: "g", raw: async (e, p) => { raws.push(p); return {}; }, send: async (e, t) => texts.push(t), image: async () => {}, origin: () => "https://w.dev", sleep: async () => {}, briefLink: () => "",
  reel: async () => ({ ok: false, err: "still processing" }),
  mediaInfo: async (e, id) => ({ id, file_size: size }), fetchMedia: async (e, id) => { fetched.push(id); return { bytes: new Uint8Array(size).buffer, mime: "video/mp4" }; } };
const env = { MEETINGS: KV, WA_DESK_PHONE_ID: PID, WA_DESK_OWNER: OWNER, WHATSAPP_TOKEN: "T" };
const post = { send: async () => {}, buttons: async () => {}, image: async () => {}, llm: async () => "", fetchMedia: async () => ({}), origin: () => "", now: () => Date.now(), sleep: async () => {} };
const deps = { waSend: async (e, to, t) => texts.push(t), post, lab };
let mid = 0;
const ev = (from, m) => ({ entry: [{ changes: [{ value: { metadata: { phone_number_id: PID }, messages: [Object.assign({ from, id: "wamid.in" + ++mid }, m)] } }] }] });
const go = async (m, from) => { texts.length = 0; raws.length = 0; fetched.length = 0; await deskHandle(env, ev(from || OWNER, m), deps); };
const video = (caption) => ({ type: "video", video: { id: "MEDIA1", mime_type: "video/mp4", caption } });
const tap = (id) => go({ type: "interactive", interactive: { type: "button_reply", button_reply: { id, title: id } } });
store.set("wa_desk_seen", "1");

await go(video("reel: Site clarity, with GoCanvas"));
ok(store.has("vid_desk_1") && fetched[0] === "MEDIA1", "the video is downloaded and stored as vid_desk_1");
const pend = JSON.parse(store.get("desk_reel_pending") || "null");
ok(pend && pend.url === "https://w.dev/video/desk_1" && pend.caption === "Site clarity, with GoCanvas", "reel: caption -> pending reel with its own link and caption", JSON.stringify(pend));
ok(raws[0] && raws[0].interactive.action.buttons[0].reply.id === "dr:ok", "Post it / Cancel offered; nothing posted yet");

await go(video("status: Complexity into clarity"));
ok(raws[0] && raws[0].type === "video" && raws[0].video.link === "https://w.dev/video/desk_2" && raws[0].video.caption === "Complexity into clarity", "status: the clip back with only the public caption", JSON.stringify(raws[0]));
ok(/Forward, choose My status/.test(texts.join("")), "steps as a separate text");

await go(video(""));
ok(raws[0] && raws[0].interactive && raws[0].interactive.action.buttons.map((b) => b.reply.id).join(",") === "dv:reel:desk_3,dv:status:desk_3,dv:broadcast:desk_3", "no caption: asks with three buttons", JSON.stringify(raws[0]).slice(0, 300));
await tap("dv:broadcast:desk_3");
ok(JSON.parse(store.get("desk_broadcast_video")).key === "desk_3" && /Nothing is sent to anyone/.test(texts.join("")), "Save for broadcast remembers it and sends nothing");
await tap("dv:status:desk_3");
ok(raws[0] && raws[0].interactive && raws[0].interactive.action.buttons.map((b) => b.reply.id).join(",") === "dc:ai:status:desk_3,dc:last:status:desk_3,dc:type:status:desk_3", "Status button offers Write it / Same as last / I'll type it", JSON.stringify(raws[0]).slice(0, 300));
await tap("dv:reel:desk_3");
ok(raws[0] && raws[0].interactive && raws[0].interactive.action.buttons[0].reply.id === "dc:ai:reel:desk_3", "Reel button asks for the caption with buttons");

await go({ type: "document", document: { id: "DOC1", mime_type: "video/mp4", filename: "Avatar Video_540p.mp4", caption: "status" } });
ok(raws[0] && raws[0].video && raws[0].video.link === "https://w.dev/video/desk_4", "a video sent as a DOCUMENT works too");

size = 20 * 1048576; await go(video("status: x"));
ok(!raws.some((r) => r.type === "video") && /only up to 16 MB/.test(texts.join("")), "20 MB: kept, but Status refused with the 540p advice", texts.join("|"));
size = 30 * 1048576; await go(video("reel: x"));
ok(!fetched.length && /can keep up to 25 MB/.test(texts.join("")), "30 MB: refused before downloading");
size = 5 * 1048576; await go(video("reel: x"), STRANGER);
ok(!fetched.length && !raws.length, "a stranger's video is ignored");
await go({ type: "document", document: { id: "D2", mime_type: "application/pdf", filename: "a.pdf" } });
ok(!fetched.length, "a PDF is not treated as a video");
console.log("\n" + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
