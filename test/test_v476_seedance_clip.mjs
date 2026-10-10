// v476 - a short HeyGen (Seedance / Cinematic) video from the desk: idea -> "A short video of you" -> shape -> length (8 default / 15)
// -> two plates (no people) -> full prompt with checks -> Make it (v3 cinematic_avatar, Polo_Trained look only, enhance off, the length
// asked for, 2 a day) -> tick polls, stores, sends Post it / Discard. Nothing at HeyGen before Make it. Offline.
import { deskPostRoute } from "../src/desk_post.js";
import { clipTick, checkPrompt, ALLOWED_LOOK_IDS, cinematicStart } from "../src/heygen.js";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 500) : "")); } };
const store = new Map();
const KV = { async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); }, async list({ prefix } = {}) { return { keys: [...store.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((name) => ({ name })) }; } };
const env = { MEETINGS: KV, WA_DESK_PHONE_ID: "1", WA_DESK_OWNER: "2", OPENAI_API_KEY: "K", HEYGEN_API_KEY: "H" };
const heygen = [], imgs = []; let status = "processing";
globalThis.fetch = async (u, init) => {
  u = String(u);
  if (/images\/generations/.test(u)) { imgs.push(JSON.parse(init.body)); const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2]); return new Response(JSON.stringify({ data: [{ b64_json: btoa(String.fromCharCode(...jpg)) }] })); }
  if (u === "https://api.heygen.com/v3/videos" && init && init.method === "POST") { heygen.push(JSON.parse(init.body)); return new Response(JSON.stringify({ data: { video_id: "vid1" } })); }
  if (/v3\/videos\/vid1/.test(u)) return new Response(JSON.stringify({ data: { status, video_url: status === "completed" ? "https://cdn.heygen/x.mp4" : undefined, duration: 8.1 } }));
  if (u === "https://cdn.heygen/x.mp4") return new Response(new Uint8Array(20000));
  return new Response("{}");
};
const SCRIPT = "Every site has a quiet moment when the plan meets the ground. Digital Alchemy keeps that moment clear.";
const PROMPT = "PROJECT: test\nSHOT 1 - 0 to 4 s - frontal medium shot, the avatar speaks: \"" + SCRIPT + "\"\nHARD CUT\nSHOT 2 - 4 to 8 s - the slab at dawn.\nGLOBAL: the avatar speaks ONLY the script.\n" + "x".repeat(1600);
const texts = [], lists = [], btns = [], vids = [];
const llmCalls = [];
const deps = { send: async (e, t) => texts.push(t), buttons: async (e, b, x) => btns.push({ b, x }), list: async (e, body, button, rows) => lists.push(rows), image: async () => {}, video: async (e, l, c) => vids.push({ l, c }), fetchMedia: async () => ({}), origin: () => "https://w.dev", now: () => Date.UTC(2026, 9, 11, 10), sleep: async () => {},
  llm: async (e, sys, user) => { llmCalls.push({ sys, user }); if (/social-post ideas/.test(sys)) return JSON.stringify({ ideas: [] }); if (/REFERENCE PLATES/.test(sys)) return JSON.stringify({ scene: "a slab at dawn", plate1: "wide slab", plate2: "rebar close" }); if (/Seedance/.test(sys)) return JSON.stringify({ script: SCRIPT, shots: 2, prompt: PROMPT }); return JSON.stringify({ caption: "c", hook: "h", alt: "a" }); } };
const go = async (m, t) => { texts.length = 0; lists.length = 0; btns.length = 0; return deskPostRoute(env, m, t || "", deps); };
const tap = (id) => go({ type: "interactive", interactive: { list_reply: { id } } });
const btn = (id) => go({ type: "interactive", interactive: { button_reply: { id } } });

await go({ type: "text", text: { body: "/ideas" } }, "/ideas");
await tap("dp:fn:6");
ok(lists[0] && lists[0].some((r) => r.title === "A short video of you"), "the picture choices offer a short video", JSON.stringify(lists[0]));
const vi = lists[0].findIndex((r) => r.title === "A short video of you") + 1;
await tap("dp:fn:" + vi);
ok(btns[0] && btns[0].x.map((b) => b.id).join(",") === "dc2:shape:portrait,dc2:shape:landscape,dc2:cancel", "then the shape", btns[0] && JSON.stringify(btns[0]));
await btn("dc2:shape:portrait");
ok(btns[0] && btns[0].x.map((b) => b.title).join(",") === "8 seconds,15 seconds,Cancel", "then the length: 8 or 15 seconds");
await btn("dc2:len:8");
ok(imgs.length === 2 && imgs.every((i) => /no people/.test(i.prompt) && i.size === "1024x1536"), "two portrait plates, no people", JSON.stringify(imgs));
ok(btns[0] && /Approve plates/.test(JSON.stringify(btns[0].x)), "Approve / Redo plates");
ok(heygen.length === 0, "nothing at HeyGen yet");
await btn("dc2:plates:ok");
const pc = llmCalls[llmCalls.length - 1];
ok(/LENGTH: 8 seconds/.test(pc.user) && /MASTER TEMPLATE/.test(pc.sys), "the prompt is written to the 8-second length from the master template");
ok(btns[0] && /8 s, 1080p, Enhance off/.test(btns[0].b) && /about 32 HeyGen credits/.test(btns[0].b) && /Make it/.test(JSON.stringify(btns[0].x)), "summary: 8 s, about 32 credits, Make it", btns[0] && btns[0].b);
ok(heygen.length === 0, "still nothing at HeyGen before Make it");
await btn("dc2:make");
const h = heygen[0];
ok(h && h.type === "cinematic_avatar" && h.duration === 8 && h.enhance_prompt === false && h.auto_duration === false && ALLOWED_LOOK_IDS.has(h.avatar_id[0]) && h.references.length === 2 && h.aspect_ratio === "9:16", "Make it: v3 cinematic, 8 s, enhance off, a Polo_Trained look, two plates", JSON.stringify(h));
await clipTick(env, deps);
ok(vids.length === 0, "still processing: nothing sent");
status = "completed"; btns.length = 0; await clipTick(env, deps);
ok(vids.length === 1 && /Checks passed/.test(vids[0].c) && store.has("vid_clip_1"), "completed: stored and sent with checks", JSON.stringify(vids));
ok(btns[0] && btns[0].x.map((b) => b.id).join(",").startsWith("dr:ok"), "Post it / Rewrite caption / Discard");
// the daily cap
store.set("clip_count_2026-10-11", "2");
await tap("dp:fn:1"); // stale list, ignore result
store.set("desk_clip_pick", JSON.stringify({ step: "prompt", idea: "x", prompt: PROMPT, script: SCRIPT, lookId: h.avatar_id[0], plates: ["a", "b"], shape: "portrait", secs: 8 }));
const n0 = heygen.length; await btn("dc2:make");
ok(heygen.length === n0 && /daily limit/.test(texts.join("")), "a third video the same day is refused");
// guards
ok((await cinematicStart(env, deps, { lookId: "842ff984aaaa", prompt: "p" })).err.includes("refused"), "a look outside Polo_Trained is refused");
ok(checkPrompt(PROMPT, SCRIPT, 8).length === 0, "the example prompt passes the 8-second checks", checkPrompt(PROMPT, SCRIPT, 8).join("; "));
ok(checkPrompt(PROMPT, SCRIPT, 15).some((p) => /26 to 36/.test(p)), "the same script is too short for 15 seconds");
ok(checkPrompt(PROMPT.replace("frontal medium shot, the avatar", "the avatar in a tailored suit"), SCRIPT, 8).some((p) => /appearance|frontal/.test(p)), "describing the avatar or no frontal shot is caught");
await btn("dc2:cancel");
ok(/No HeyGen credits were used/.test(texts.join("")), "Cancel spends nothing");
console.log("\n" + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
