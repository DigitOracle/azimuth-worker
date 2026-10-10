// v460 - "reel <link>": preview + Post/Cancel on the desk; Post starts the Instagram upload; the minute tick finishes it. Offline.
import { deskHandle } from "../src/desk.js";
import { deskReelTick } from "../src/desk_lab.js";
import { deskIgPublishReel } from "../src/ig_desk.js";

const OWNER = "971562276093", STRANGER = "971500001234", PID = "1370146096179819";
const store = new Map();
const KV = { async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); }, async list() { return { keys: [] }; } };
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 500) : "")); } };
const texts = [], raws = [], reelCalls = []; let reelResults = [];
globalThis.fetch = async () => new Response("{}");
const lab = { owner: OWNER, pid: PID, graph: "g", raw: async (e, p) => { raws.push(p); return {}; }, send: async (e, t) => texts.push(t), image: async () => {}, origin: () => "", sleep: async () => {}, briefLink: () => "",
  reel: async (e, o) => { reelCalls.push(o); const r = reelResults.shift() || { ok: false, err: "still processing (IN_PROGRESS); retry continues the same upload", container: "C1" }; if (!o.container && r.container && o.onContainer) await o.onContainer(r.container); return r; } };
const env = { MEETINGS: KV, WA_DESK_PHONE_ID: PID, WA_DESK_OWNER: OWNER, WHATSAPP_TOKEN: "T" };
const post = { send: async () => {}, buttons: async () => {}, image: async () => {}, llm: async () => "", fetchMedia: async () => ({}), origin: () => "", now: () => Date.now(), sleep: async () => {} };
const deps = { waSend: async (e, to, t) => texts.push(t), post, lab };
let mid = 0;
const ev = (from, m) => ({ entry: [{ changes: [{ value: { metadata: { phone_number_id: PID }, messages: [Object.assign({ from, id: "wamid.in" + ++mid }, m)] } }] }] });
const say = async (t, from) => { texts.length = 0; raws.length = 0; await deskHandle(env, ev(from || OWNER, { type: "text", text: { body: t } }), deps); };
const tap = async (id) => { texts.length = 0; raws.length = 0; await deskHandle(env, ev(OWNER, { type: "interactive", interactive: { type: "button_reply", button_reply: { id, title: id } } }), deps); };
store.set("wa_desk_seen", "1");

await say("reel https://x.dev/video/site_clarity_75");
ok(raws[0] && raws[0].type === "video" && /GoCanvas/.test(raws[0].video.caption) && raws[1].interactive.action.buttons[0].reply.id === "dr:ok", "preview with the approved caption, then Post it / Cancel", JSON.stringify(raws).slice(0, 400));
ok(!reelCalls.length, "nothing goes to Instagram before Post it");
await say("reel https://example.com/other.mp4");
ok(/Add the caption/.test(texts.join("")), "an unknown clip needs a caption");
await say("reel https://example.com/other.mp4 : My caption");
ok(JSON.parse(store.get("desk_reel_pending")).caption === "My caption", "a typed caption is used");
await tap("dr:no");
ok(!store.has("desk_reel_pending") && /Cancelled/.test(texts.join("")), "Cancel clears it");

await say("reel https://x.dev/video/site_clarity_75");
await tap("dr:ok");
ok(reelCalls.length === 1 && reelCalls[0].approved === true && /GoCanvas/.test(reelCalls[0].caption), "Post it starts the upload, approved, with the caption");
const st = JSON.parse(store.get("desk_reel_pending"));
ok(st.container === "C1" && st.approved && !st.posted, "the container is remembered while processing");
reelResults = [{ ok: true, id: "M9", container: "C1", permalink: "https://instagram.com/p/X" }];
texts.length = 0; await deskReelTick(env, lab);
ok(reelCalls.at(-1).container === "C1" && /Posted to Instagram\. https:\/\/instagram\.com\/p\/X/.test(texts.join("")), "the tick continues the SAME upload and reports the link", texts.join("|"));
const before = reelCalls.length; await deskReelTick(env, lab); await tap("dr:ok");
ok(reelCalls.length === before && /already posted/.test(texts.join("")), "never posts twice");
await say("reel https://x.dev/video/site_clarity_75", STRANGER);
ok(!raws.length, "a stranger gets nothing");

// the Instagram call itself: refused without approval, REELS container, polls, publish
const igStore = new Map([["ig_auth_desk", JSON.stringify({ token: "IGT", user_id: "U1", perms: "instagram_business_content_publish", expires_at: Date.now() + 1e9 })]]);
const env2 = { MEETINGS: { get: async (k) => igStore.get(k) || null, put: async () => {} } };
ok((await deskIgPublishReel(env2, { videoUrl: "https://x/v.mp4" })).err === "not approved", "the publisher refuses without approval");
const calls = []; let polls = 0;
globalThis.fetch = async (u, init) => { const s = String(u); calls.push({ s, body: init && init.body && String(init.body) });
  if (/\/U1\/media$/.test(s)) return new Response(JSON.stringify({ id: "C7" }));
  if (/C7\?fields=status_code/.test(s)) return new Response(JSON.stringify({ status_code: ++polls < 3 ? "IN_PROGRESS" : "FINISHED" }));
  if (/media_publish/.test(s)) return new Response(JSON.stringify({ id: "M7" }));
  if (/M7/.test(s)) return new Response(JSON.stringify({ permalink: "https://instagram.com/reel/Y" }));
  return new Response("{}"); };
const r = await deskIgPublishReel(env2, { approved: true, videoUrl: "https://x/v.mp4", caption: "Hi", sleep: async () => {} });
ok(r.ok && r.permalink === "https://instagram.com/reel/Y" && /media_type=REELS/.test(calls[0].body) && /video_url=https/.test(calls[0].body), "REELS container, polled to FINISHED, published", JSON.stringify(r));
polls = -100; calls.length = 0;
const r2 = await deskIgPublishReel(env2, { approved: true, videoUrl: "https://x/v.mp4", caption: "Hi", sleep: async () => {}, polls: 2 });
ok(!r2.ok && r2.container === "C7" && /still processing/.test(r2.err) && !calls.some((c) => /media_publish/.test(c.s)), "not finished in the polls given: hands back the container, no publish");
console.log("\n" + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
