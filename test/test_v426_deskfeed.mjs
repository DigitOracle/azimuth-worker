// SUPERSEDED by v473 (Kendall 10 Oct 2026 replaced the 10-idea mix with 3 news / 2 motivation / 2 DigitAlchemy / 2 smart-ISO).
// The feed, its tap lists, the picture and background choices and the drafts are covered by test_v472_ideas_morning.mjs.
console.log('superseded by v473: see test_v472_ideas_morning.mjs'); console.log('0 failed'); process.exit(0);
/*
// v426 - the desk FEED (Kendall 8 Oct: "like Naj's: type feed, 10 ideas, choose a picture and a background, the picture is made"), offline.
//   node test/test_v426_deskfeed.mjs
import { deskPostRoute, allPlans, PICTURE_CHOICES, BACKGROUND_CHOICES } from "../src/desk_post.js";

const OWNER = "971562276093";
const store = new Map();
const KV = { async get(k, t) { const v = store.has(k) ? store.get(k) : null; if (v == null) return null; if (t === "arrayBuffer") return v instanceof ArrayBuffer ? v : new TextEncoder().encode(String(v)).buffer; return v instanceof ArrayBuffer ? new TextDecoder().decode(v) : v; },
  async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); }, async list() { return { keys: [] }; } };
const T = Date.UTC(2026, 9, 8, 6, 0, 0);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]).buffer, JB64 = btoa(String.fromCharCode(...new Uint8Array(JPEG)));
const gens = [];
const J = (o, st) => new Response(JSON.stringify(o), { status: st || 200, headers: { "Content-Type": "application/json" } });
globalThis.fetch = async (url, init) => {
  const u = new URL(String(url)), body = init && init.body;
  if (u.host === "api.openai.com") { let prompt = ""; try { prompt = typeof body === "string" ? JSON.parse(body).prompt : body.get("prompt"); } catch (e) {} gens.push({ prompt, edit: u.pathname.endsWith("/edits"), refs: body && body.getAll ? body.getAll("image[]").length : 0 }); return J({ data: [{ b64_json: JB64 }] }); }
  return J({});
};
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 400) : "")); } };
const out = []; let llmIdeas = "good";
const IDEAS10 = { ideas: [
  ...["Why a handover needs one owner", "What a site manager should ask before trusting a model", "Standards decoded: the one clause that matters", "A lesson from my first tower", "AI on site: who signs off", "Reading a BIM model in five minutes"].map((text) => ({ lane: "abbot", text })),
  ...["How we check a building's record", "What the digital footprint shows", "Our governance in plain words", "Dubai Marina logged 12,345 sales"].map((text) => ({ lane: "alchemy", text })) ] };
const deps = {
  async send(env, text) { out.push({ t: "text", text }); },
  async buttons(env, text, buttons) { out.push({ t: "buttons", text, buttons }); },
  async image(env, link, cap) { out.push({ t: "image", text: cap }); },
  async llm(env, sys, user) {
    if (/suggest Instagram post ideas/.test(sys)) return llmIdeas === "good" ? JSON.stringify(IDEAS10) : llmIdeas === "unsourced" ? JSON.stringify({ ideas: [{ lane: "abbot", text: "Prices will rise 47 percent" }] }) : "";
    if (/Also give 'slides'/.test(sys)) return JSON.stringify({ hook: "Who signs off", lines: [{ text: "A plain answer.", fact: "" }], hashtags: ["#Dubai", "#AI", "#Site"], slides: [{ title: "Who signs off", body: "The engineer" }, { title: "Step one", body: "Read it" }, { title: "Step two", body: "Sign it" }] });
    return JSON.stringify({ hook: "Who signs off", lines: [{ text: "A plain answer.", fact: "" }], hashtags: ["#Dubai", "#AI", "#Site"] });
  },
  async vision() { return null; }, async fetchMedia() { return { bytes: JPEG }; },
  origin: () => "https://x.workers.dev", now: () => T, sleep: async () => {},
};
const env = { MEETINGS: KV, WA_DESK_OWNER: OWNER, OPENAI_API_KEY: "sk-test" };
let mid = 0;
const say = async (text) => { out.length = 0; await deskPostRoute(env, { type: "text", from: OWNER, id: "m" + ++mid }, text, deps); return out.map((x) => x.text || "").join("\n"); };
const reset = async (refs) => { store.clear(); gens.length = 0; llmIdeas = "good";
  store.set("mkt_latest", JSON.stringify({ facts: [{ id: "f1", figure: "12,345 sales", says: "Dubai Marina recorded 12,345 sales", source: "DLD Open Data, 2026" }] }));
  const ix = []; for (let n = 1; n <= (refs || 0); n++) { store.set("desk_ref_" + n, JSON.stringify({ n, tag: ["headshot", "site", "speaking", "three-quarter"][(n - 1) % 4], key: "desk_refimg_" + n, approved: true })); store.set("desk_refimg_" + n, JPEG); ix.push(n); }
  store.set("desk_ref_index", JSON.stringify(ix)); };
const lastPlan = async () => (await allPlans(env)).sort((a, b) => b.created - a.created)[0];

// 1. feed gives ten numbered ideas, six Abbot then four Alchemy
await reset(4);
let r = await say("feed");
ok(/^Your feed/.test(r) && /\n10\. \[motivation\]/.test(r) && !/\n11\./.test(r), "feed lists exactly 10 numbered ideas", r);
// v454 (Kendall 10 Oct): 3 Abbot, 3 Alchemy, 4 motivational, in that order
ok((r.match(/\[abbot\]/g) || []).length === 3 && (r.match(/\[alchemy\]/g) || []).length === 3 && (r.match(/\[motivation\]/g) || []).length === 4 && /\n4\. \[alchemy\]/.test(r) && /\n7\. \[motivation\]/.test(r), "three Abbot, three Alchemy, four motivational", r);
ok(/Reply with a number \(1 to 10\)/.test(r) && /Nothing is posted without your Approve/.test(r), "it says how to pick and that nothing posts without Approve");
ok((await say("Feed")).startsWith("Your feed") && (await say("/feed")).startsWith("Your feed"), "Feed and /feed work too");

// 2. a number opens the picture menu with four choices
r = await say("2");
ok(/Idea 2: What a site manager should ask/.test(r) && PICTURE_CHOICES.every((c, i) => r.includes((i + 1) + ". " + c.label)), "a number shows the idea and the four picture choices", r);
ok(!(await allPlans(env)).length, "no draft exists yet");

// 3. picture 1 (you on site) then the background menu, then background 3 (skyline) makes the post
r = await say("1");
ok(/You on site\. Now the background/.test(r) && BACKGROUND_CHOICES.every((c, i) => r.includes((i + 1) + ". " + c.label)), "picture 1 asks for one of four backgrounds", r);
r = await say("3");
let p = await lastPlan();
ok(p && p.type === "image" && p.picture === "site" && p.background === "skyline" && p.lane === "abbot", "the draft carries the choices: image, on site, skyline", JSON.stringify(p && { type: p.type, picture: p.picture, background: p.background }));
const g = gens[gens.length - 1];
ok(g && g.edit && g.refs >= 2, "the picture is made with his reference photos (so it shows him)", JSON.stringify(g));
ok(g && /hard hat/.test(g.prompt) && /Dubai skyline/.test(g.prompt), "the prompt carries the on-site pose and the skyline setting", g && g.prompt);
ok(p.status === "draft" && p.approved === false, "it stops at the draft: nothing approved, nothing scheduled");
ok(!store.has("desk_feed_pick"), "the choice is closed once the draft is made");

// 4. a scene with no person, in the Alchemy lane: never his likeness
await say("feed"); await say("4"); await say("3"); await say("2");
p = await lastPlan(); const g2 = gens[gens.length - 1];
ok(p.picture === "scene" && p.background === "office" && p.lane === "alchemy", "Alchemy idea, scene, office");
ok(g2 && !g2.edit && /No people/.test(g2.prompt) && /office or boardroom/.test(g2.prompt), "a scene is generated with no person and the office setting", g2 && g2.prompt);

// 5. slides skip the background question and make a carousel
await say("feed"); r = await say("5"); r = await say("4");
p = await lastPlan();
ok(p.type === "carousel" && p.picture === "slides", "slides make a carousel with no background question");

// 6. speaking in the Alchemy lane still shows him (the choice wins over the lane rule)
await say("feed"); await say("6"); await say("2"); await say("4");
p = await lastPlan(); const g3 = gens[gens.length - 1];
ok(p.picture === "speaking" && g3.edit && /speaking or teaching/.test(g3.prompt) && /studio/.test(g3.prompt), "speaking in the studio uses his references even in the Alchemy lane", g3.prompt);

// 7. fewer than 3 references: no likeness, and the card says why
await reset(1); await say("feed"); await say("1"); await say("1"); r = await say("1");
const g4 = gens[gens.length - 1];
ok(!g4.edit && /No people/.test(g4.prompt) && /need at least 3/.test(r), "with too few references he is not drawn, and the card says so", r);

// 8. bad replies are re-asked, nothing is created
await reset(4); await say("feed"); r = await say("12");
ok(/No idea 12/.test(r), "a number outside the feed is refused");
await say("1"); r = await say("9");
ok(/Pick a picture/.test(r) && !(await allPlans(env)).length, "a picture number outside 1 to 4 asks again");

// 9. a bare number with no feed open is not taken; editing a draft still gets the number
await reset(4); r = await say("3");
ok(r === "", "a bare number with no open feed is ignored here");

// 10. an idea carrying an unsourced figure is dropped; the list is filled from the house ideas
await reset(4); llmIdeas = "unsourced"; r = await say("feed");
ok(!/47 percent/.test(r) && /\n10\./.test(r), "an idea with a figure we do not hold is dropped, and the list still has 10", r);
await reset(4); llmIdeas = "none"; r = await say("feed");
ok(/\n10\./.test(r), "if the writer does not answer, the 10 house ideas are used");

// 11. /post 10 works with a ten-item list
await reset(4); await say("feed"); r = await say("/post 10");
p = await lastPlan();
ok(p && p.kind === "motivation", "/post 10 drafts the tenth idea (a motivational one)", p && JSON.stringify({ idea: p.idea, kind: p.kind }));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);

*/
