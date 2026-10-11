// v495 - the Poster picture: words first, one portrait picture in Kendall's "Scaling Railways" layout with him from his references,
// the text read back and checked (retry up to 3, then flagged), never a number that is not in the idea. Offline.
import { deskPostRoute, posterPrompt, posterWords, POSTER_BYLINE } from "../src/desk_post.js";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 500) : "")); } };
const store = new Map();
const KV = { async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); }, async list({ prefix } = {}) { return { keys: [...store.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((name) => ({ name })) }; } };
const env = { MEETINGS: KV, WA_DESK_PHONE_ID: "1", WA_DESK_OWNER: "2", OPENAI_API_KEY: "K" };
const calls = [];
globalThis.fetch = async (u, init) => { if (/images\/(edits|generations)/.test(String(u))) { const b = init.body; calls.push(typeof b === "string" ? JSON.parse(b) : { prompt: b.get("prompt"), size: b.get("size"), refs: b.getAll("image[]").length }); const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]); return new Response(JSON.stringify({ data: [{ b64_json: btoa(String.fromCharCode(...jpg)) }] })); } return new Response("{}"); };
for (let i = 1; i <= 4; i++) { store.set("desk_ref_" + i, JSON.stringify({ n: i, key: "desk_refimg_" + i, tag: "general", approved: true })); store.set("desk_refimg_" + i, new Uint8Array([0xff, 0xd8, i]).buffer); }
store.set("desk_ref_index", JSON.stringify([1, 2, 3, 4]));
const COPY = { kicker: "INFRASTRUCTURE + DIGITAL DELIVERY", h1: "When fares scale,", h2: "records must scale too.", sub: "Etihad Rail's expanding fares show records must scale with growth.",
  cards: [{ title: "FASTER EXPANSION", text: "New routes and fares add complexity quickly.", icon: "rising bar chart" }, { title: "BETTER RECORDS", text: "One reliable digital thread for every asset.", icon: "database cylinder" }, { title: "SMARTER DELIVERY", text: "When records lag, decisions fall behind too.", icon: "document with a gear" }],
  close1: "Scale the railway.", close2: "Scale the records with it." };
let visionSays = [];   // what the read-back returns, try by try
const texts = [], lists = [], btns = [];
let copyOut = COPY;
const deps = { send: async (e, t) => texts.push(t), buttons: async (e, b, x) => btns.push({ b, x }), list: async (e, body, button, rows) => lists.push(rows), image: async () => {}, fetchMedia: async () => ({}), origin: () => "https://w.dev", now: () => Date.UTC(2026, 9, 11, 10), sleep: async () => {},
  vision: async () => visionSays.shift() ?? posterWords(COPY),
  llm: async (e, sys) => /social-post ideas/.test(sys) ? JSON.stringify({ ideas: [] }) : /ONE portrait social-media poster/.test(sys) ? JSON.stringify(copyOut) : JSON.stringify({ caption: "When fares scale, records must scale too.", hook: "When fares scale, records must scale too.", alt: "a poster" }) };
const go = async (m, t) => { texts.length = 0; lists.length = 0; btns.length = 0; return deskPostRoute(env, m, t || "", deps); };
const tap = (id) => go({ type: "interactive", interactive: { list_reply: { id } } });
const btn = (id) => go({ type: "interactive", interactive: { button_reply: { id } } });
const plans = () => [...store.keys()].filter((k) => k.startsWith("postplan_")).map((k) => JSON.parse(store.get(k)));

async function makePoster() {
  await go({ type: "text", text: { body: "/ideas" } }, "/ideas");
  await tap("dp:fn:6");
  const pi = lists[0].findIndex((r) => /^Poster/.test(r.title)) + 1;
  await tap("dp:fn:" + pi);       // Poster
  await tap("dp:fn:3");           // Dubai skyline
  await tap("dp:fn:3");           // Late afternoon -> straight to the preview (no shape, no words step)
  return btns[0];
}
const pv = await makePoster();
ok(pv && /A poster in your Scaling Railways layout/.test(pv.b) && /Portrait 9:16/.test(pv.b), "the preview describes the poster, portrait, with no shape or words step", pv && pv.b);
const before = calls.length; await btn(pv.x[0].id);
const c = calls[calls.length - 1], p = plans().filter((x) => x.picture === "poster").pop();
ok(calls.length === before + 1 && c.size === "1024x1536" && c.refs >= 2, "Make it: one portrait picture, made with his reference photos", JSON.stringify({ n: calls.length - before, size: c.size, refs: c.refs }));
ok(c.prompt.includes("'When fares scale,' in deep navy") && c.prompt.includes("'records must scale too.' in rich gold") && c.prompt.includes("title 'BETTER RECORDS'") && c.prompt.includes(POSTER_BYLINE) && /Spell every word exactly/.test(c.prompt), "the prompt carries his layout: navy/gold headline, three cards, closing band, byline", c.prompt.slice(0, 400));
ok(p.slides[0].poster && p.slides[0].poster.h1 === "When fares scale," && !p.slides[0].flag && p.shape === "portrait", "the words are kept with the slide; the read-back matched, so no flag");
// a read-back that never matches: three tries, then flagged
visionSays = ["garbled", "garbled again", "still garbled"]; calls.length = 0;
const pv2 = await makePoster(); await btn(pv2.x[0].id);
const p2 = plans().filter((x) => x.picture === "poster").pop();
ok(calls.length === 3 && /spelling did not match/.test(p2.slides[0].flag || ""), "spelling wrong three times: three tries, then flagged for him", JSON.stringify({ tries: calls.length, flag: p2.slides[0].flag }));
// a number not in the idea: refused, nothing generated
copyOut = Object.assign({}, COPY, { sub: "Fares rose 40 percent this year." }); calls.length = 0; visionSays = [];
const pv3 = await makePoster(); await btn(pv3.x[0].id);
ok(calls.length === 0 && /number that is not in the idea/.test(texts.join(" ") + JSON.stringify(plans().map((x) => x.held_reason || x.nopic_reason || ""))), "an invented number in the poster words: refused before any picture is made", texts.join(" | "));
ok(posterPrompt(COPY, { idea: "x" }, false).includes("no people"), "with too few reference photos: the poster has no person");
console.log("\n" + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
