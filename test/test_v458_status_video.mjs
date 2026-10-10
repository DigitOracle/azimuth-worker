// v458 - "status <mp4 link>": the desk sends the clip to Kendall, ready to forward to his WhatsApp Status. Offline.   node test/test_v458_status_video.mjs
import { deskHandle } from "../src/desk.js";
import { DESK_VERSION } from "../src/desk.js";

const OWNER = "971562276093", STRANGER = "971500001234", PID = "1370146096179819";
const store = new Map();
const KV = { async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); }, async list() { return { keys: [] }; } };
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 500) : "")); } };
const texts = [], raws = []; let refuse = false;
globalThis.fetch = async () => new Response("{}");
const lab = { owner: OWNER, pid: PID, graph: "https://graph.facebook.com/v21.0", raw: async (e, p) => { raws.push(p); return refuse ? { error: { message: "(#131053) Media upload error" } } : {}; },
  send: async (e, t) => texts.push(t), image: async () => {}, origin: () => "", sleep: async () => {}, briefLink: () => "" };
const env = { MEETINGS: KV, WA_DESK_PHONE_ID: PID, WA_DESK_OWNER: OWNER, WHATSAPP_TOKEN: "T" };
const post = { send: async () => {}, buttons: async () => {}, image: async () => {}, llm: async () => "", fetchMedia: async () => ({}), origin: () => "", now: () => Date.now(), sleep: async () => {} };
const deps = { waSend: async (e, to, t) => texts.push("[waSend to " + to + "] " + t), post, lab };
let mid = 0;
const body = (from, t) => ({ entry: [{ changes: [{ value: { metadata: { phone_number_id: PID }, messages: [{ from, id: "wamid.in" + ++mid, type: "text", text: { body: t } }] } }] }] });
const say = async (t, from) => { texts.length = 0; raws.length = 0; await deskHandle(env, body(from || OWNER, t), deps); };
store.set("wa_desk_seen", "1");

await say("status https://example.com/clip60.mp4 : GoCanvas cut");
const p = raws[0];
ok(p && p.type === "video" && p.to === OWNER && p.video.link === "https://example.com/clip60.mp4", "sends the clip as a video to Kendall", JSON.stringify(raws));
ok(p && p.video.caption === "GoCanvas cut", "the clip's caption is ONLY the public note (a forward keeps it)", p && p.video.caption);
ok(/Forward, choose My status/.test(texts.join("\n")), "the steps come as a separate text");
await say("status https://example.com/a.mp4");
ok(raws[0] && !raws[0].video.caption, "no note and no known clip: no caption at all");
await say("status https://x.dev/video/site_clarity_75");
ok(raws[0] && /GoCanvas/.test(raws[0].video.caption) && !/Forward/.test(raws[0].video.caption), "a known clip gets its public caption");
await say("status");
ok(!raws.length && /status <link to the \.mp4>/.test(texts.join("\n")), "bare 'status' explains itself", texts.join("\n"));
refuse = true; await say("status https://example.com/big.mp4");
ok(/Could not send the clip\. Meta said: \(#131053\)/.test(texts.join("\n")), "a refusal comes back in Meta's words", texts.join("\n"));
refuse = false; await say("status https://example.com/a.mp4", STRANGER);
ok(!raws.length, "a stranger cannot use it");
await say("status http://example.com/a.mp4");
ok(!raws.length, "plain http links are not sent");
await say("lab");
ok(/status <mp4 link>/.test(texts.join("\n")), "it is on the lab menu");
ok(DESK_VERSION === "v471", "desk version bumped", DESK_VERSION);
console.log("\n" + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
