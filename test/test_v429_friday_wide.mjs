// v429 - Friday Reflection in the feed, the terrace background, and /post wide (built on the v426 harness) (Kendall 8 Oct: "like Naj's: type feed, 10 ideas, choose a picture and a background, the picture is made"), offline.
//   node test/test_v426_deskfeed.mjs
import { deskPostRoute, allPlans, PICTURE_CHOICES, BACKGROUND_CHOICES } from "../src/desk_post.js";

const OWNER = "971562276093";
const store = new Map();
const KV = { async get(k, t) { const v = store.has(k) ? store.get(k) : null; if (v == null) return null; if (t === "arrayBuffer") return v instanceof ArrayBuffer ? v : new TextEncoder().encode(String(v)).buffer; return v instanceof ArrayBuffer ? new TextDecoder().decode(v) : v; },
  async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); }, async list() { return { keys: [] }; } };
let T = Date.UTC(2026, 9, 9, 2, 0, 0);   // Fri 9 Oct 2026 06:00 Dubai
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

// 1. on a Friday the Friday Reflection is idea 1, and the list still has 10
await reset(4);
let r = await say("feed");
ok(/\n1\. \[abbot\] Friday Reflection, about life/.test(r) && /\n10\./.test(r) && !/\n11\./.test(r), "Friday: idea 1 is the Friday Reflection, still 10 ideas", r);
// 2. picking it, you speaking, terrace: the caption writer is told it is about life, the picture is on a terrace with him in it
let sysSeen = ""; const llm0 = deps.llm; deps.llm = async (env, sys, user, mx) => { if (!/suggest Instagram post ideas/.test(sys)) sysSeen = sys; return llm0(env, sys, user, mx); };
await say("1"); r = await say("2");
ok(BACKGROUND_CHOICES.length === 5 && /5\. Calm terrace at sunrise/.test(r), "a fifth background: calm terrace at sunrise", r);
await say("5");
let p = await lastPlan(); const g = gens[gens.length - 1];
ok(p.kind === "friday" && p.picture === "speaking" && p.background === "terrace", "the draft is marked as the Friday Reflection, speaking, terrace");
ok(/FRIDAY REFLECTION/.test(sysSeen) && /about LIFE/.test(sysSeen), "the caption writer is told it is about life, not only work");
ok(g.edit && g.refs >= 2 && /quiet terrace at sunrise/.test(g.prompt), "the picture shows him, on the terrace", g.prompt);
ok(p.slides[0].prompt && /terrace/.test(p.slides[0].prompt), "the picture's description is kept for a wide version");
// 3. /post wide makes a 1536x1024 version of the same scene, with his references, sent only to the desk
const before = gens.length; out.length = 0;
await say("/post wide " + p.id);
const w = gens[gens.length - 1];
ok(gens.length === before + 1 && w.edit && w.refs === 3 && /WIDESCREEN: recreate the FIRST reference/.test(w.prompt) && /quiet terrace/.test(w.prompt), "a widescreen picture is made from the original picture plus 2 of his references", w && (w.refs + " " + w.prompt));
p = await lastPlan();
ok(p.wide_key && p.status === "draft" && p.approved === false, "the wide picture is kept on the draft; nothing is approved or posted");
// a draft from before v429 (no stored description) still works: the description is rebuilt
const old = await lastPlan(); delete old.slides[0].prompt; const { putPlan } = await import("../src/desk_post.js"); await putPlan(env, old);
await say("/post wide " + old.id); const w2 = gens[gens.length - 1];
ok(w2.refs === 3 && /quiet terrace at sunrise/.test(w2.prompt) && /speaking or teaching/.test(w2.prompt), "an older draft gets its description rebuilt from its choices", w2.prompt);
r = await say("/post wide nope");
ok(/No draft nope/.test(r), "an unknown draft is refused");
// 4. not Friday: no Friday idea
T = Date.UTC(2026, 9, 10, 2, 0, 0);   // Saturday
await reset(4); r = await say("feed");
ok(!/Friday Reflection/.test(r), "on a Saturday the Friday Reflection is not offered", r);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
