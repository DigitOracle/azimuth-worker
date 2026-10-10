// v475 - the desk follows Naj's scene ritual: picture -> background (or Type my own) -> time of day -> shape -> "Here's the picture I'll
// make" with Make it / Change it / Cancel; nothing is generated before Make it; the prompt carries the own background, the light, the
// changes and the shape. Offline.
import { deskPostRoute, bgLine, sceneExtras, scenePreview } from "../src/desk_post.js";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 500) : "")); } };
const store = new Map();
const KV = { async get(k, t) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); }, async list({ prefix } = {}) { return { keys: [...store.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((name) => ({ name })) }; } };
const env = { MEETINGS: KV, WA_DESK_PHONE_ID: "1", WA_DESK_OWNER: "2", OPENAI_API_KEY: "K" };
const imgCalls = [];
globalThis.fetch = async (u, init) => { if (/images\/(edits|generations)/.test(String(u))) { const body = init.body; imgCalls.push(typeof body === "string" ? JSON.parse(body) : { prompt: body.get("prompt"), size: body.get("size") }); const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]); return new Response(JSON.stringify({ data: [{ b64_json: btoa(String.fromCharCode(...jpg)) }] })); } return new Response("{}"); };
for (let i = 1; i <= 4; i++) { store.set("desk_ref_" + i, JSON.stringify({ n: i, key: "desk_refimg_" + i, tag: "general", approved: true })); store.set("desk_refimg_" + i, new Uint8Array([0xff, 0xd8, i]).buffer); }
store.set("desk_ref_index", JSON.stringify([1, 2, 3, 4]));
const texts = [], lists = [], btns = [];
const deps = { send: async (e, t) => texts.push(t), buttons: async (e, b, x) => btns.push({ b, x }), list: async (e, body, button, rows) => lists.push(rows), image: async () => {}, fetchMedia: async () => ({}), origin: () => "https://w.dev", now: () => Date.UTC(2026, 9, 11, 10), sleep: async () => {},
  llm: async (e, sys) => /social-post ideas/.test(sys) ? JSON.stringify({ ideas: [] }) : JSON.stringify({ caption: "A caption.", hook: "Hook", alt: "alt" }) };
const go = async (m, t) => { texts.length = 0; lists.length = 0; btns.length = 0; return deskPostRoute(env, m, t || "", deps); };
const tap = (id) => go({ type: "interactive", interactive: { list_reply: { id } } });
const btn = (id) => go({ type: "interactive", interactive: { button_reply: { id } } });
const say = (t) => go({ type: "text", text: { body: t } }, t);

await say("/ideas");
await tap("dp:fn:6");                       // a DigitAlchemy idea
await tap("dp:fn:1");                       // You on site
ok(lists[0] && lists[0].length === 6 && lists[0][5].title === "Type my own", "the backgrounds end with Type my own", JSON.stringify(lists[0]));
await tap("dp:fn:6");                       // Type my own
ok(/Describe the background/.test(texts.join("")), "Type my own asks for one line");
await say("the Dubai Creek at dusk with abras on the water");
ok(lists[0] && lists[0].map((r) => r.title).join(",") === "Early morning,Midday,Late afternoon,Sunset,Night", "then the time of day", JSON.stringify(lists[0]));
await tap("dp:fn:4");                       // Sunset
ok(lists[0] && lists[0].length === 3 && /Landscape 16:9/.test(lists[0][1].title), "then the shape: square, landscape, portrait");
const before = imgCalls.length;
await tap("dp:fn:2");                       // Landscape
const pv = btns[0];
ok(pv && /Here's the picture I'll make/.test(pv.b) && /Dubai Creek at dusk/.test(pv.b) && /Sunset/.test(pv.b) && /Landscape 16:9/.test(pv.b), "Here's the picture I'll make, in plain words", pv && pv.b);
ok(pv && pv.x.map((b) => b.id).join(",") === "dp:scene:make,dp:scene:change,dp:scene:cancel", "Make it / Change it / Cancel");
ok(imgCalls.length === before, "nothing is generated before Make it");
await btn("dp:scene:change");
ok(/Tell me the change/.test(texts.join("")), "Change it asks for the change");
await say("put the Burj Khalifa behind me");
ok(btns[0] && /Your change: put the Burj Khalifa behind me/.test(btns[0].b), "the preview comes back with the change");
await btn("dp:scene:make");
const call = imgCalls[imgCalls.length - 1];
ok(call && /Setting: the Dubai Creek at dusk/.test(call.prompt) && /Sunset: the sun just above the horizon/.test(call.prompt) && /Change: put the Burj Khalifa behind me\./.test(call.prompt) && /reference photos/.test(call.prompt), "Make it: his own background, the light, his change and his face go into the picture", call && call.prompt);
ok(call && call.size === "1536x1024", "in the shape he chose (landscape)", call && call.size);
// cancel
await say("/ideas"); await tap("dp:fn:6"); await tap("dp:fn:3"); await tap("dp:fn:2"); await tap("dp:fn:1"); await tap("dp:fn:3");
const n0 = imgCalls.length; await btn("dp:scene:cancel");
ok(/Cancelled\. Nothing was made\./.test(texts.join("")) && imgCalls.length === n0, "Cancel makes nothing");
// helpers
ok(bgLine({ background: "custom", bg_text: "a souk" }) === "Setting: a souk. " && /terrace/.test(bgLine({ background: "terrace" })), "background line: own words or the chosen setting");
ok(sceneExtras({}) === "" && /Night: a deep blue sky/.test(sceneExtras({ tod: "nt" })), "no extras unless chosen");
ok(/A scene, no person/.test(scenePreview({ picture: "scene", background: "skyline", idea: "x" })), "a scene preview says there is no person");
console.log("\n" + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
