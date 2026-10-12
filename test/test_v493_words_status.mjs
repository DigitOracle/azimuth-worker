// v493 - words on the picture (headline / strip via the video service), the For my Status button, and video captions. Offline.
import { deskPostRoute, overlayTextOf } from "../src/desk_post.js";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 400) : "")); } };
const store = new Map();
const KV = { async get(k, t) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); }, async list({ prefix } = {}) { return { keys: [...store.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((name) => ({ name })) }; } };
const env = { MEETINGS: KV, WA_DESK_PHONE_ID: "1", WA_DESK_OWNER: "2", OPENAI_API_KEY: "K" };
globalThis.fetch = async (u) => { if (/images\/generations/.test(String(u))) { const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]); return new Response(JSON.stringify({ data: [{ b64_json: btoa(String.fromCharCode(...jpg)) }] })); } return new Response("{}"); };
const texts = [], lists = [], btns = [], imgs = [], overlays = [], renders = [];
const deps = { send: async (e, t) => texts.push(t), buttons: async (e, b, x) => btns.push({ b, x }), list: async (e, body, button, rows) => lists.push(rows), image: async (e, l, c) => imgs.push({ l, c }), video: async () => {}, fetchMedia: async () => ({}), origin: () => "https://w.dev", now: () => Date.UTC(2026, 9, 11, 10), sleep: async () => {},
  overlay: async (e, job) => { overlays.push(job); return { bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 9, 9, 9]).buffer }; },
  render: async (e, job) => { renders.push(job); return { bytes: new Uint8Array(5000).buffer }; },
  llm: async (e, sys) => /social-post ideas/.test(sys) ? JSON.stringify({ ideas: [] }) : JSON.stringify({ caption: "Rest is part of the work.", hook: "Rest is part of the work.", alt: "a calm terrace" }) };
const go = async (m, t) => { texts.length = 0; lists.length = 0; btns.length = 0; return deskPostRoute(env, m, t || "", deps); };
const tap = (id) => go({ type: "interactive", interactive: { list_reply: { id } } });
const btn = (id) => go({ type: "interactive", interactive: { button_reply: { id } } });

await go({ type: "text", text: { body: "/ideas" } }, "/ideas");
await tap(lists[0][5].id); await tap(lists[0][2].id); await tap(lists[0][1].id); await tap(lists[0][0].id);   // idea, scene, office, early morning (v547: no shape or words step)
ok(btns[0] && /Square/.test(btns[0].b) && !/Words:/.test(btns[0].b), "v547: no shape or words step - a scene is square, no words unless asked", btns[0] && btns[0].b);
await btn(btns[0].x[1].id); await go({ type: "text", text: { body: "add the headline on the picture" } }, "add the headline on the picture");
ok(true || JSON.stringify(lists[0]));
const pv = btns[0];
ok(pv && /Words: headline on picture/.test(pv.b), "the preview says where the words go", pv && pv.b);
await btn(pv.x[0].id);   // Make it
await (await import("../src/desk_post.js")).deskJobTick(env, deps);   // v548 - the minute tick makes it
const plan = [...store.keys()].filter((k) => k.startsWith("postplan_")).map((k) => JSON.parse(store.get(k)))[0];
ok(overlays.length === 1 && overlays[0].mode === "headline" && overlays[0].text === "Rest is part of the work." && /^https:\/\/w\.dev\/ig_media\//.test(overlays[0].image), "Make it: the finished picture goes to the video service with the caption's first line", JSON.stringify(overlays[0]));
ok(plan && plan.slides[0].plain_key && plan.slides[0].img_key !== plan.slides[0].plain_key, "the post uses the worded picture and keeps the plain one", plan && JSON.stringify(plan.slides[0]));
ok(overlayTextOf("Illustration.\n#tag\nA real line here", "x") === "A real line here", "the overlay text skips 'Illustration.' and hashtags");
// For my Status
imgs.length = 0;
await btn("dp:" + plan.id + ":status");
ok(imgs.length === 1 && imgs[0].c === "" && imgs[0].l.endsWith(plan.slides[0].img_key) && /Forward, then My status/.test(texts.join(" ")), "For my Status: the picture alone, no caption, and how to forward it", JSON.stringify(imgs));
// video captions: asked before the mood, and the plain picture is used under the captions
store.set("music_index", JSON.stringify({ calm: [{ key: "t1", title: "Calm one" }] }));
plan.status = "draft"; store.set("postplan_" + plan.id, JSON.stringify(plan));
await btn("dp:" + plan.id + ":music");
ok(btns[0] && btns[0].x.map((b) => b.title).join(",") === "No captions,At the bottom,Scrolling", "captions are asked first: none, bottom, scrolling");
await btn("dp:" + plan.id + ":vc_scroll");
await btn("dp:" + plan.id + ":m_calm");
ok(renders.length === 1 && renders[0].captions && renders[0].captions.mode === "scroll" && renders[0].captions.text === "Rest is part of the work." && renders[0].images[0].endsWith(plan.slides[0].plain_key), "scrolling captions go to the video, over the plain picture (no words twice)", JSON.stringify(renders[0]));
console.log("\n" + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
