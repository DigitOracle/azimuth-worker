// v185/v188 — THE FIVE MORNING SCENE CARDS (Kendall, 19 Sep 2026: "make sure this is what happens every day"; Naj, 21 Sep:
// "I don't get to choose anymore" -> Kendall: Azimuth offers, she taps). The morning now ENDS WITH THE OFFER; one tap makes
// the same five jobs this test always checked.
//
// On 19 Sep the cards were made by hand through /scene_test: Naj drawn into each place from her sparkly-jacket photo, today's text
// on the card, each sent as a post and a story. The feed now queues exactly those jobs after the morning list; the minute tick
// makes and sends them. This runs a real (not dry) morning with every send faked and checks what was queued.
import worker from "../src/index.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("ok - " + m); } else { fail++; console.log("not ok - " + m); } };
const A = (hook, figure, source, family, reader) => ({ hook, figure, source, buyer: "b", family, reader });
const FIVE = [A("Public beaches grow 400% by 2040.", "400%", "Dubai Media Office, 13 Mar 2021", "city_life", "move"),
  A("14 new Metro stations on the Blue Line.", "14 stations", "Dubai Media Office, 4 Mar 2025", "transit", "invest"),
  A("The plan targets 5.8 million residents by 2040.", "5.8 million (2040 target); 3.3 million (2020 baseline)", "Dubai Media Office, 13 Mar 2021", "growth_plan", "authority"),
  A("Prices held at AED 1,520 per sq ft.", "AED 1,520 per sq ft", "DLD Open Data, 2026-09-18", "prices", "invest"),
  A("4,410 homes handed over this quarter.", "4,410 handovers", "DLD Open Data, Q3 2026", "handover_supply", "invest")];

const sent = [];
globalThis.fetch = async (u, o) => {
  const url = String(u && u.url ? u.url : u);
  if (/anthropic/i.test(url)) {
    let body = {}; try { body = JSON.parse(String(o && o.body || "{}")); } catch (e) {}
    const isVoice = /rewrite social-post hooks/.test(JSON.stringify(body.system || ""));
    const text = isVoice ? JSON.stringify({ items: [] }) : JSON.stringify({ angles: FIVE });
    return new Response(JSON.stringify({ content: [{ type: "text", text }], stop_reason: "end_turn" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  if (/graph\.facebook\.com/.test(url)) { try { sent.push(JSON.parse(String(o && o.body || "{}"))); } catch (e) {} return new Response(JSON.stringify({ messages: [{ id: "wamid.x" }] }), { status: 200 }); }
  return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
};
const READ = "owner_admin_key_never_in_client_links_0001";
let LAST = null;
const tap = async (id) => {   // v188 - her tap on the offer, on the store the morning just wrote
  sent.length = 0;
  const body = { entry: [{ changes: [{ value: { metadata: { phone_number_id: "1" }, messages: [{ from: "971565484397", id: "t" + Date.now(), timestamp: String(Math.floor(Date.now() / 1000)), type: "interactive", interactive: { type: "button_reply", button_reply: { id, title: id } } }] } }] }] };
  await worker.fetch(new Request("https://x/wa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), LAST.env, { waitUntil() {} });
  const jobs = [...LAST.store.keys()].filter((k) => k.startsWith("picjob_s")).map((k) => JSON.parse(LAST.store.get(k)));
  return { jobs, store: LAST.store };
};
const run = async (q, extraEnv) => {
  sent.length = 0;
  const store = new Map([["mkt_latest", JSON.stringify({ generatedAt: new Date().toISOString() })], ["mkt_feed_famhist", "[]"], ["wa_owner_last_in", new Date().toISOString()]]);
  const KV = { async get(k, t) { if (!store.has(k)) return null; const v = store.get(k); return t === "json" ? JSON.parse(v) : v; },
    async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); }, async list(o) { return { keys: [...store.keys()].filter((k) => !o || !o.prefix || k.startsWith(o.prefix)).map((name) => ({ name })), list_complete: true }; } };
  const env = Object.assign({ MEETINGS: KV, AI: { run: async () => ({ response: "{}" }) }, READ_KEY: READ, MARKET_BRIEF: "on", ANTHROPIC_API_KEY: "test-only-not-a-key", PUBLIC_ORIGIN: "https://x",
    WA_ALLOWED: "971565484397", WHATSAPP_TOKEN: "t", WA_PHONE_ID: "1", FEED_SCENES: "on" }, extraEnv || {});
  const r = await worker.fetch(new Request("https://x/feed_test?key=" + READ + q), env, { waitUntil() {} });
  await r.text();
  const jobs = [...store.keys()].filter((k) => k.startsWith("picjob_s")).map((k) => JSON.parse(store.get(k)));
  LAST = { store, env };
  return { jobs, store };
};

const offered = await run("");
ok(offered.jobs.length === 0, "v188 - the morning itself makes nothing: she is asked first");
const ask = sent.find((m) => m.interactive && /Make all five/.test(JSON.stringify(m.interactive)));
ok(!!ask && /I'll choose/.test(JSON.stringify(ask.interactive)), "she is offered 'Make all five' or 'I'll choose'");
const live = await tap("fs:all");
ok(live.jobs.length === 5, "a real morning queues FIVE scene jobs, one per angle: " + live.jobs.length);
ok(live.jobs.every((j) => j.scene && j.meKey === "style_ref_21" && j.to === "971565484397" && j.auto === "feed"), "each is a scene job with her sparkly-jacket photo (style_ref_21), addressed to her");
ok(live.jobs.every((j) => j.post && j.post.hook && j.post.figure && j.post.caption && j.option && j.option.id), "each carries today's hook, figure and caption, and a backdrop - what the minute tick needs to make and send the card");
ok(new Set(live.jobs.map((j) => j.tid)).size >= 3, "the times of day vary across the five: " + live.jobs.map((j) => j.tid).join(","));
ok([1, 2, 3, 4, 5].every((n) => live.store.has("fbg_" + n)), "each angle's backdrop choices are saved, so her later pick-an-angle still works");
ok(sent.some((m) => /pictures are being made now/.test((m.text && m.text.body) || "")), "she is told the pictures are on their way");
ok(!sent.some((m) => /password/i.test(JSON.stringify(m))), "nothing sensitive in any send");

const dry = await run("&dry=1");
ok(dry.jobs.length === 0, "a dry run queues nothing");
const off = await run("", { FEED_SCENES: "" });
ok(off.jobs.length === 0, "and FEED_SCENES off switches it off");

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
