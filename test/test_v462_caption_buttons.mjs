// v462 - captions by tapping: Write it for me / Same as last / I'll type it / No caption, a Rewrite button on the reel, and "menu". Offline.
import { deskHandle } from "../src/desk.js";

const OWNER = "971562276093", PID = "1370146096179819";
const store = new Map();
const KV = { async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); }, async list() { return { keys: [] }; } };
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 500) : "")); } };
const texts = [], raws = [], asks = []; let draft = "Site truth, same day. Complexity into clarity. #GoCanvas #DigitAlchemy";
globalThis.fetch = async () => new Response("{}");
const lab = { owner: OWNER, pid: PID, graph: "g", raw: async (e, p) => { raws.push(p); return {}; }, send: async (e, t) => texts.push(t), image: async () => {}, origin: () => "https://w.dev", sleep: async () => {}, briefLink: () => "",
  reel: async () => ({ ok: false, err: "still processing" }), mediaInfo: async (e, id) => ({ file_size: 1000 }), fetchMedia: async () => ({ bytes: new Uint8Array(1000).buffer }),
  llm: async (e, sys, user) => { asks.push(sys + " | " + user); return draft; } };
const env = { MEETINGS: KV, WA_DESK_PHONE_ID: PID, WA_DESK_OWNER: OWNER, WHATSAPP_TOKEN: "T" };
const post = { send: async () => {}, buttons: async () => {}, image: async () => {}, llm: async () => "", fetchMedia: async () => ({}), origin: () => "", now: () => Date.now(), sleep: async () => {} };
const deps = { waSend: async (e, to, t) => texts.push(t), post, lab };
let mid = 0;
const ev = (m) => ({ entry: [{ changes: [{ value: { metadata: { phone_number_id: PID }, messages: [Object.assign({ from: OWNER, id: "wamid.in" + ++mid }, m)] } }] }] });
const go = async (m) => { texts.length = 0; raws.length = 0; await deskHandle(env, ev(m), deps); };
const say = (t) => go({ type: "text", text: { body: t } });
const tap = (id) => go({ type: "interactive", interactive: { type: "button_reply", button_reply: { id, title: id } } });
const ids = (r) => r && r.interactive && r.interactive.action.buttons ? r.interactive.action.buttons.map((b) => b.reply.id).join(",") : "";
store.set("wa_desk_seen", "1");

await say("menu");
const r0 = raws[0] && raws[0].interactive.action.sections[0].rows.map((r) => r.id);
ok(r0 && r0.length === 3 && new Set(r0).size === r0.length, "menu with no desk video yet: no duplicate rows (Meta refuses duplicates)", JSON.stringify(r0));

await go({ type: "video", video: { id: "V1" } });
await tap("dv:reel:desk_1");
ok(ids(raws[0]) === "dc:ai:reel:desk_1,dc:type:reel:desk_1", "first time: Write it for me / I'll type it (no 'Same as last' yet)", ids(raws[0]));
await tap("dc:ai:reel:desk_1");
ok(/GoCanvas/.test(asks[0]) && !/Claude|GPT|model/i.test(draft), "the draft is asked for in DigitAlchemy's voice");
ok(ids(raws[0]) === "dr:ok,dc:ai:reel:desk_1,dr:no" && raws[0].interactive.body.text.includes(draft), "the drafted caption is shown with Post it / Rewrite caption / Cancel", JSON.stringify(raws[0]).slice(0, 300));
draft = "Second version. Complexity into clarity."; await tap("dc:ai:reel:desk_1");
ok(JSON.parse(store.get("desk_reel_pending")).caption === draft, "Rewrite caption replaces it");

await go({ type: "video", video: { id: "V2" } });
await tap("dv:reel:desk_2");
ok(ids(raws[0]).includes("dc:last:reel:desk_2") && /Last one: Second version/.test(raws[0].interactive.body.text), "next video: 'Same as last' appears, showing the last caption");
await tap("dc:last:reel:desk_2");
ok(JSON.parse(store.get("desk_reel_pending")).caption === draft && JSON.parse(store.get("desk_reel_pending")).url === "https://w.dev/video/desk_2", "Same as last reuses it on the new video");

await tap("dv:status:desk_2");
ok(ids(raws[0]) === "dc:ai:status:desk_2,dc:none:status:desk_2", "Status first time: Write it for me / No caption", ids(raws[0]));
await tap("dc:none:status:desk_2");
ok(raws[0] && raws[0].type === "video" && !raws[0].video.caption, "No caption sends the clip bare");

await go({ type: "video", video: { id: "V3" } });
await tap("dv:reel:desk_3"); await tap("dc:type:reel:desk_3");
ok(/next message/.test(texts.join("")), "I'll type it waits for the next message");
await say("My own words. Complexity into clarity.");
ok(JSON.parse(store.get("desk_reel_pending")).caption === "My own words. Complexity into clarity.", "the next message becomes the caption");
await say("hello"); ok(!/Reel for Instagram/.test(JSON.stringify(raws)), "only ONE message is taken as a caption");

await say("menu");
const rows = raws[0] && raws[0].interactive && raws[0].interactive.action.sections[0].rows.map((r) => r.id);
ok(raws[0] && raws[0].interactive.type === "list" && rows.includes("dv:reel:desk_3") && rows.includes("dv:status:site_clarity_75"), "menu lists the latest video's actions and the site-clarity ones", JSON.stringify(rows));
await go({ type: "interactive", interactive: { type: "list_reply", list_reply: { id: "dv:reel:site_clarity_75", title: "x" } } });
ok(raws[0] && /GoCanvas/.test(raws[0].interactive.body.text) && ids(raws[0]).startsWith("dr:ok"), "a menu row works like the button (site clarity uses its approved caption)");
console.log("\n" + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
