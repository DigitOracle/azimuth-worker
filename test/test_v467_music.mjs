// v467 - music for posts: library (audio captioned music: <mood>), Approve -> Post as is / Add music -> mood -> render -> preview ->
// Use it / Another track / No music; "Use it" hands over to the video flow. Motivational posts are about life only. Offline.
import { deskPostRoute } from "../src/desk_post.js";
import { addTrack, musicIndex, pickTrack, musicRoute, renderVideo } from "../src/music.js";
import { readFileSync } from "fs";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 500) : "")); } };
const store = new Map();
const KV = { async get(k, t) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); }, async list({ prefix } = {}) { return { keys: [...store.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((name) => ({ name })) }; } };
const env = { MEETINGS: KV, WA_DESK_PHONE_ID: "1370146096179819", WA_DESK_OWNER: "971562276093" };
const texts = [], btns = [], lists = [], videos = [], jobs = [];
let renderResult = { bytes: new Uint8Array(5000).buffer };
const deps = { send: async (e, t) => texts.push(t), buttons: async (e, b, x) => btns.push({ b, x }), image: async () => {}, llm: async () => "", origin: () => "https://w.dev", now: () => Date.now(), sleep: async () => {},
  fetchMedia: async () => ({ bytes: new Uint8Array(3000).buffer, mime: "audio/mpeg" }),
  render: async (e, job) => { jobs.push(job); return renderResult; }, video: async (e, link, cap) => videos.push({ link, cap }), list: async (e, body, button, rows) => lists.push(rows) };
const go = async (msg, text) => { texts.length = 0; btns.length = 0; lists.length = 0; videos.length = 0; return deskPostRoute(env, msg, text || "", deps); };
const tap = (id) => go({ type: "interactive", interactive: { button_reply: { id } } });
const ids = () => (btns[0] ? btns[0].x.map((b) => b.id).join(",") : "");

// library
await go({ type: "text" }, "music");
ok(/library is empty/.test(texts[0]) && /royalty-free/.test(texts[0]), "music on an empty library explains how to add tracks");
await go({ type: "audio", audio: { id: "A1", caption: "music: calm Morning Light" } });
let ix = await musicIndex(env);
ok(ix.calm && ix.calm.length === 1 && ix.calm[0].title === "Morning Light" && store.has("music_" + ix.calm[0].key) && /Added to calm/.test(texts[0]), "an audio file captioned music: calm <title> joins the library", JSON.stringify(ix));
await go({ type: "document", document: { id: "A2", mime_type: "audio/mpeg", caption: "music: calm", filename: "Sea Breeze.mp3" } });
ix = await musicIndex(env);
ok(ix.calm.length === 2 && ix.calm[1].title === "Sea Breeze.mp3", "an audio document works too, named from its file");
await go({ type: "audio", audio: { id: "A3", caption: "my song" } });
ok(/caption music: <mood> <title>/.test(texts[0]) && (await musicIndex(env)).calm.length === 2, "without the music: caption nothing is added");
ok(pickTrack(ix, "calm", ix.calm[0].key).key === ix.calm[1].key && pickTrack(ix, "calm", ix.calm[1].key).key === ix.calm[0].key, "Another track goes round the mood");
const mr = await musicRoute(env, new URL("https://w.dev/music/" + ix.calm[0].key));
ok(mr.status === 200 && (await mr.arrayBuffer()).byteLength === 3000, "/music/<key> serves the track to the video service");

// approve -> music
const plan = { id: "pm1", status: "draft", idea: "x", type: "single", lane: "abbot", caption: "Cap", slides: [{ img_key: "g1", src: "ai" }], approved: false, history: [], created: Date.now(), expires_at: Date.now() + 1e9 };
store.set("postplan_pm1", JSON.stringify(plan));
await tap("dp:pm1:ok");
ok(ids() === "dp:pm1:nomusic,dp:pm1:music", "Approve offers Post as is / Add music", ids());
await tap("dp:pm1:music");
ok(ids() === "dp:pm1:m_calm", "only moods that have tracks are offered", ids());
await tap("dp:pm1:m_calm");
const p1 = JSON.parse(store.get("postplan_pm1"));
ok(jobs[0] && jobs[0].images[0] === "https://w.dev/ig_media/g1" && /^https:\/\/w\.dev\/music\/calm_/.test(jobs[0].audio) && jobs[0].height === 1920, "renders the pictures with the track, portrait", JSON.stringify(jobs[0]));
ok(store.has("vid_post_pm1") && p1.video_key === "post_pm1" && videos[0].link === "https://w.dev/video/post_pm1", "the video is stored and previewed on the desk");
ok(ids() === "dp:pm1:muse,dp:pm1:mtry,dp:pm1:mno", "Use it / Another track / No music");
const first = p1.music_last; await tap("dp:pm1:mtry");
ok(JSON.parse(store.get("postplan_pm1")).music_last !== first && jobs.length === 2, "Another track renders with the next one");
await tap("dp:pm1:muse");
const rp = JSON.parse(store.get("desk_reel_pending") || "null");
ok(rp && rp.url === "https://w.dev/video/post_pm1" && rp.caption === "Cap" && JSON.parse(store.get("postplan_pm1")).status === "as-video", "Use it hands the video and caption to the video flow");
ok(ids() === "dr:ok,dc:ai:reel:post_pm1,dr:no", "then Post it / Rewrite caption / Cancel", ids());

// No music goes back to the normal approve
const plan2 = Object.assign({}, plan, { id: "pm2" }); store.set("postplan_pm2", JSON.stringify(plan2));
await tap("dp:pm2:nomusic");
const p2 = JSON.parse(store.get("postplan_pm2"));
ok(p2.music_asked && p2.approved === true, "Post as is approves as before (no LinkedIn connected here)");
// render failure
const plan3 = Object.assign({}, plan, { id: "pm3" }); store.set("postplan_pm3", JSON.stringify(plan3));
renderResult = { err: "the video service did not answer" };
await tap("dp:pm3:m_calm");
ok(/Could not make the video: the video service did not answer/.test(texts.join("")) && !store.has("vid_post_pm3"), "a render failure is told plainly, nothing stored");
// renderVideo without the binding
ok((await renderVideo({}, {})).err === "the video service is not connected", "no binding: a clear error");

// motivational = life only
const src = readFileSync(new URL("../src/desk_post.js", import.meta.url), "utf8");
const mot = src.slice(src.indexOf("const MOT_IDEAS = ["), src.indexOf("].map((text) => ({ lane: \"abbot\", kind: \"motivation\""));
ok(!/\b(site|project|client|building|construction|handover|team|work)\b/i.test(mot), "the fallback motivational ideas never mention work", mot);
ok(/purely motivational ideas about LIFE/.test(src) && /ABOUT LIFE ONLY/.test(src) && /Do NOT mention work/.test(src), "the idea and caption instructions say life, not work");
console.log("\n" + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
