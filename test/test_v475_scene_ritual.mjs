// v475 -> v547 - the desk follows Najjuko's scene ritual (Kendall 12 Oct 2026: "rewrite everything according to Azimuth"): idea -> picture ->
// background -> time of day -> "Here's the picture I'll make" with Make it / Change it / Cancel. Every list row carries the whole choice
// in its own id; nothing a tap needs is read back from a shared key; nothing is generated before Make it. Offline.
import { deskPostRoute, deskJobTick, bgLine, sceneExtras, scenePreview } from "../src/desk_post.js";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 500) : "")); } };
const store = new Map();
const KV = { async get(k, t) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); }, async list({ prefix } = {}) { return { keys: [...store.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((name) => ({ name })) }; } };
const env = { MEETINGS: KV, WA_DESK_PHONE_ID: "1", WA_DESK_OWNER: "2", OPENAI_API_KEY: "K" };
const imgCalls = [];
globalThis.fetch = async (u, init) => { if (/images\/(edits|generations)/.test(String(u))) { const body = init.body; imgCalls.push(typeof body === "string" ? JSON.parse(body) : { prompt: body.get("prompt"), size: body.get("size"), n: body.getAll("image[]").length }); const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]); return new Response(JSON.stringify({ data: [{ b64_json: btoa(String.fromCharCode(...jpg)) }] })); } return new Response("{}"); };
for (let i = 1; i <= 4; i++) { store.set("desk_ref_" + i, JSON.stringify({ n: i, key: "desk_refimg_" + i, tag: "general", approved: true })); store.set("desk_refimg_" + i, new Uint8Array([0xff, 0xd8, i]).buffer); }
store.set("desk_ref_index", JSON.stringify([1, 2, 3, 4]));
const texts = [], lists = [], btns = [];
const deps = { send: async (e, t) => texts.push(t), buttons: async (e, b, x) => btns.push({ b, x }), list: async (e, body, button, rows) => lists.push(rows), image: async () => {}, fetchMedia: async () => ({}), origin: () => "https://w.dev", now: () => Date.UTC(2026, 9, 11, 10), sleep: async () => {},
  llm: async (e, sys) => /social-post ideas/.test(sys) ? JSON.stringify({ ideas: [] }) : JSON.stringify({ caption: "A caption.", hook: "Hook", alt: "alt" }) };
const go = async (m, t) => { texts.length = 0; lists.length = 0; btns.length = 0; return deskPostRoute(env, m, t || "", deps); };
const tap = (id) => go({ type: "interactive", interactive: { list_reply: { id } } });
const btn = (id) => go({ type: "interactive", interactive: { button_reply: { id } } });
const say = (t) => go({ type: "text", text: { body: t } }, t);
const row = (title) => { const L = lists[lists.length - 1] || []; const r = L.find((x) => x.title === title || x.title.indexOf(title) >= 0); return r && r.id; };

await say("/ideas");
const ideaRows = lists[0] || [];
ok(ideaRows.length >= 6 && ideaRows.every((r) => /^dp:i:[a-z0-9]{10,}:\d+$/.test(r.id)), "the idea list: each row carries the feed's own snapshot and its number", JSON.stringify(ideaRows.slice(0, 2)));
await tap(ideaRows[5].id);
ok(lists[0] && lists[0].map((r) => r.title).join(",") === "You on site,You speaking or teaching,A scene, no person,Poster (layout varies),Infographic slides (caro,A short video of you", "the picture choices, as one list (no typed menu)", JSON.stringify(lists[0] && lists[0].map((r) => r.title)));
ok(texts.length === 0, "no numbered text menu beside the list", texts.join(" | "));
await tap(row("You on site"));
ok(lists[0] && lists[0].length === 5 && lists[0][4].title === "Calm terrace at sunrise" && /^dp:b:[a-z0-9]+:6:1:\d$/.test(lists[0][0].id), "then the background: five settings, each row carrying idea and picture", JSON.stringify(lists[0]));
await tap(row("Dubai skyline"));
ok(lists[0] && lists[0].map((r) => r.title).join(",") === "Early morning,Midday,Late afternoon,Sunset,Night", "then the time of day", JSON.stringify(lists[0]));
const before = imgCalls.length;
await tap(row("Sunset"));
// v548 - he is in the picture: his photos come as numbered pictures, then a list to choose one
ok(lists[0] && lists[0].length === 5 && /^dp:r:[a-z0-9]{10,}:3$/.test(lists[0][2].id) && lists[0][4].title === "Any (you choose)", "then his photos to choose from (four photos and Any)", JSON.stringify(lists[0]));
await tap(lists[0][2].id);   // photo 3 = reference #3
const pv = btns[0];
ok(pv && /Your face from: photo 3/.test(pv.b), "the preview says which photo", pv && pv.b);
ok(pv && /Here's the picture I'll make/.test(pv.b) && /Dubai skyline/.test(pv.b) && /Sunset/.test(pv.b) && /Portrait/.test(pv.b), "Here's the picture I'll make, in plain words (portrait: he is in it)", pv && pv.b);
ok(pv && /^dp:scene:make:[a-z0-9]{10,},dp:scene:change:[a-z0-9]{10,},dp:scene:cancel:[a-z0-9]{10,}$/.test(pv.x.map((b) => b.id).join(",")), "Make it / Change it / Cancel, each carrying the preview's own snapshot id", pv && pv.x.map((b) => b.id).join(","));
ok(!store.has("desk_feed_pick"), "no shared 'choice so far' key is written any more");
ok(imgCalls.length === before, "nothing is generated before Make it");
await btn(pv.x[1].id);
ok(/Tell me the change/.test(texts.join("")), "Change it asks for the change");
await say("put the Burj Khalifa behind me");
ok(btns[0] && /Your change: put the Burj Khalifa behind me/.test(btns[0].b), "the preview comes back with the change");
const nMake = imgCalls.length;
await btn(btns[0].x[0].id);
ok(/Making it now/.test(texts.join("")) && imgCalls.length === nMake, "Make it answers at once; nothing is made inside the tap (v548)", texts.join(" | "));
await deskJobTick(env, deps);
ok(![...store.keys()].some((k) => k.startsWith("deskjob_")), "the minute tick takes the job and makes it");
const call = imgCalls[imgCalls.length - 1];
ok(call && /A realistic photograph/.test(call.prompt) && !/illustration/i.test(call.prompt) && /Dubai skyline/.test(call.prompt) && /Sunset: the sun just above the horizon/.test(call.prompt) && /Change: put the Burj Khalifa behind me\./.test(call.prompt) && /glasses exactly as in the photo/.test(call.prompt), "Make it: a photograph (not the old illustration style) with his setting, light, change and face", call && call.prompt);
ok(call && call.size === "1024x1536" && call.n === 1, "portrait, from ONE reference photo", JSON.stringify({ size: call && call.size, n: call && call.n }));
// a scene is square and has no person
await say("/ideas"); await tap((lists[0] || [])[5].id); await tap(row("A scene, no person")); await tap(row("Plain studio")); await tap(row("Midday"));
ok(btns[0] && /Square/.test(btns[0].b) && /A scene, no person/.test(btns[0].b), "a scene is square, no person");
// cancel
const n0 = imgCalls.length; await btn(btns[0].x[2].id);
ok(/Cancelled\. Nothing was made\./.test(texts.join("")) && imgCalls.length === n0, "Cancel makes nothing");
// typed numbers and lists from before the rewrite never land on a step
await say("2");
ok(/Tap the list above/.test(texts.join("")) && btns.length === 0 && lists.length === 0, "a typed number points to the list, it picks nothing");
await tap("dp:fn:2");
ok(/from before today's update/.test(texts.join("")), "an old list row says so instead of guessing");
await tap("dp:i:nosuchfeedtoken:3");
ok(/expired/.test(texts.join("")), "a list whose feed is gone says it has expired");
// helpers
ok(bgLine({ background: "custom", bg_text: "a souk" }) === "Setting: a souk. " && /terrace/.test(bgLine({ background: "terrace" })), "background line: own words or the chosen setting");
ok(sceneExtras({}) === "" && /Night: a deep blue sky/.test(sceneExtras({ tod: "nt" })), "no extras unless chosen");
ok(/A scene, no person/.test(scenePreview({ picture: "scene", background: "skyline", idea: "x" })), "a scene preview says there is no person");
console.log("\n" + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
