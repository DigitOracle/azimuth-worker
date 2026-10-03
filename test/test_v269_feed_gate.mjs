// v269 - NAJ'S MORNING, SECOND TIME (30 Sep 2026: duplicate ideas, and "still only getting presented with the same two or three
// pictures", nine days after v187 was built to stop exactly that). What was actually wrong, measured live:
//   1. the five-floor readmitted angles the audit had just dropped as repeats, testing them against a 2-day window instead of the
//      audit's own ("readmitted 1 to keep five (number 7.78 already used on 2026-09-28)");
//   2. v187's self-check ran after the message was built and only told Kendall ("It has been sent anyway");
//   3. the photo picker offered only the cut-out pool - six photos, three at a time, two fixed sets - because every photo she sent
//      after 23 Sep failed a full-length test that only the plate compositor needs; scenes draw from the photo itself;
//   4. the backdrop repeat check declared `_shift` and never set it.
// NEGATIVE CONTROL: run this file against v268's src/index.js - blocks A1, A2, A3, A4, B and C each fail (13 of 18 assertions).
// Verified by doing so on 30 Sep 2026; the 5 that pass there are the ones true either way (e.g. a plate's pool, first backdrops).
import worker from "../src/index.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };
const A = (hook, figure, source, family, reader) => ({ hook, figure, source, buyer: "b", family, reader });
const day = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

const POP = A("The plan targets 5.8 million residents by 2040.", "5.8 million (2040 target); 3.3 million (2020 baseline)", "Dubai Media Office, 13 Mar 2021", "growth_plan", "authority");
const WALK = A("Dubai is adding 6,500 km of walking paths.", "6,500 km", "Dubai Media Office, 4 Mar 2025", "city_life", "move");
const EDU = A("Land for schools and health rises 25% by 2040.", "25%", "Dubai Media Office, 13 Mar 2021", "education", "move");
const SALES = A("City of Arabia moved 1,128 sales.", "1,128 sales", "DLD Open Data, 2026-09-20", "district", "invest");
const RENTS = A("Rents settled at 71,400 contracts.", "71,400 contracts", "DLD Open Data, 2026-09-20", "rents_yields", "move");
const JVC = A("JVC took 4,410 sales this quarter.", "4,410 sales", "DLD Open Data, 2026-09-20", "volume", "invest");
const FIVE = [POP, WALK, EDU, SALES, RENTS];

// ---- harness: the /feed_test route through the real worker, with the model, WhatsApp and the owner note stubbed ----------------
let serve = FIVE, topup = [], qaFn = () => [], qaCalls = 0, sent = [], owner = [];
globalThis.fetch = async (u, o) => {
  const url = String(u && u.url ? u.url : u);
  if (/anthropic/i.test(url)) {
    let body = {}; try { body = JSON.parse(String(o && o.body || "{}")); } catch (e) {}
    const sys = JSON.stringify(body.system || "");
    let text;
    if (/last quality check/.test(sys)) {
      qaCalls++;
      let today = []; try { const msg = body.messages[0].content; today = JSON.parse(typeof msg === "string" ? msg : msg[0].text).today; } catch (e) {}
      const v = qaFn(today);
      text = v === "garbage" ? "not json at all" : JSON.stringify({ verdicts: today.map(t => ({ angle: t.angle, repeat: v.includes(t.angle), why: v.includes(t.angle) ? "the same point as a recent hook" : "new" })) });
    } else if (/rewrite social-post hooks/.test(sys)) text = JSON.stringify({ items: [] });
    else text = JSON.stringify({ angles: /TOP-UP/.test(sys) ? topup : serve });
    return new Response(JSON.stringify({ content: [{ type: "text", text }], stop_reason: "end_turn" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  if (/graph\.facebook\.com/.test(url)) { let b = {}; try { b = JSON.parse(String(o && o.body || "{}")); } catch (e) {} sent.push(b); return new Response(JSON.stringify({ messages: [{ id: "wamid." + sent.length }] }), { status: 200 }); }
  if (/owner_note/.test(url)) { try { owner.push(JSON.parse(String(o.body)).text); } catch (e) {} return new Response("sent", { status: 200 }); }
  return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
};
const READ = "owner_admin_key_never_in_client_links_0001";
const mkEnv = (store) => {
  const KV = { async get(k, t) { if (!store.has(k)) return null; const v = store.get(k); return t === "json" ? JSON.parse(v) : v; },
    async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); },
    async list(o) { return { keys: [...store.keys()].filter((k) => !o || !o.prefix || k.startsWith(o.prefix)).map((name) => ({ name })), list_complete: true }; } };
  return { MEETINGS: KV, AI: { run: async () => ({ response: "{}" }) }, READ_KEY: READ, MARKET_BRIEF: "on", ANTHROPIC_API_KEY: "test-only-not-a-key", PUBLIC_ORIGIN: "https://x",
    WA_ALLOWED: "971565484397", WHATSAPP_TOKEN: "t", WA_PHONE_ID: "1", FEED_SCENES: "on", FEED_SLOTS: "off", OWNER_NOTE_URL: "https://mc/owner_note", INGEST_TOKEN: "i" };
};
const run = async (famhist, opts) => {
  opts = opts || {}; serve = opts.serve || FIVE; topup = opts.topup || []; qaFn = opts.qa || (() => []); qaCalls = 0; sent = []; owner = [];
  const store = new Map([["mkt_latest", JSON.stringify({ generatedAt: new Date().toISOString() })], ["mkt_feed_famhist", JSON.stringify(famhist)], ["wa_owner_last_in", new Date().toISOString()]]);
  for (const k in (opts.kv || {})) store.set(k, opts.kv[k]);
  const env = mkEnv(store);
  const r = await worker.fetch(new Request("https://x/feed_test?key=" + READ + (opts.dry ? "&dry=1" : "")), env, { waitUntil() {} });
  const out = await r.text();
  let qa = null; try { qa = JSON.parse(store.get("mkt_feed_qa") || "null"); } catch (e) {}
  const morning = sent.map(b => (b.text && b.text.body) || "").find(t => /Najma daily/.test(t)) || "";
  return { out, qa, store, env, morning, famh: JSON.parse(store.get("mkt_feed_famhist") || "[]") };
};

// ---- A1. the floor no longer readmits a repeat: the exact 30 Sep case (a number she had three days ago) ---------------------------
const a1 = await run([{ d: day(3), f: "volume", k: "4410salesthisquarterx", n: ["4410"], s: "volume:-" }], { serve: [POP, WALK, EDU, JVC, RENTS], topup: [], dry: true });
ok(!/4,410/.test(a1.out), "an angle dropped for a number she had three days ago is not readmitted to make five (v268 readmitted it: its window was two days)");
ok(!/readmitted/.test(a1.qa ? a1.qa.note : ""), "and the QA line does not claim a readmission: " + (a1.qa ? a1.qa.note.slice(0, 160) : ""));

// ---- A2. the QA agent removes the same idea in new words, before the message is built --------------------------------------------
const a2 = await run([], { qa: (today) => today.filter(t => /walking paths/.test(t.hook)).map(t => t.angle) });
ok(qaCalls === 2, "the QA agent is asked before the send - and again on the refill that replaces what it removed (v284)");
ok(a2.morning && !/walking paths/.test(a2.morning), "the angle it flagged is not in the morning she receives");
ok(a2.morning && /5\.8 million/.test(a2.morning), "the rest of the morning still goes");
ok(a2.qa && /QA agent removed 1/.test(a2.qa.note), "the QA line records what the agent did: " + (a2.qa ? a2.qa.note.slice(-120) : ""));
ok(owner.some(t => /The gate removed 1/.test(t) && /walking paths/.test(t)), "and Kendall is told what was removed and why");
ok(a2.famh.length === 5 && !a2.famh.some(r => r.k && /6500/.test(r.k)), "only what she actually got is recorded against her history: " + a2.famh.length + " rows");

// ---- A3. every model angle fails -> v295: the morning is NOT held; the plan's fresh facts fill it and she is told the real number ----
// (v269 held it: "nothing survives -> HELD". v295, Kendall 3 Oct 2026 "it should consistently send 5": a same-idea verdict can no longer
// empty the morning while fresh unused facts exist. With only the plan to draw on there are three, so she gets three, said plainly.)
const a3 = await run([], { qa: (today) => today.map(t => t.angle) });
ok(a3.morning && /3 you could post today/.test(a3.morning) && /I have 3 fresh ones today, not five/.test(a3.morning), "when every model angle fails and only the plan is fresh, she gets the three that exist, and is told so");
ok(a3.famh.length === 3, "and exactly what she got is written to her history: " + a3.famh.length);
ok(owner.some(t => /SHORT/.test(t) && /Full note:/.test(t)), "Kendall is told why it is short: " + (owner.find(t => /SHORT/.test(t)) || "").slice(0, 140));

// ---- A4. a QA agent that cannot answer does not stop the morning; the mechanical checks still apply ---------------------------------
const a4 = await run([], { qa: () => "garbage" });
ok(a4.morning && /Najma daily/.test(a4.morning), "a failed QA agent call does not silence the morning");
ok(a4.qa && /QA agent did not run/.test(a4.qa.note), "and the QA line says so: " + (a4.qa ? a4.qa.note.slice(-110) : ""));

// ---- B. the photo picker: a scene may use any colour photo of her; a plate still only the cut-out pool ----------------------------
{
  const HER = "971565484397", store = new Map(), pending = [], ctx = { waitUntil(p) { pending.push(p); } };
  const env = Object.assign(mkEnv(store), { WA_FORWARD_TOKEN: "FWD", OPENAI_API_KEY: "o", SCENE_PICTURES: "on", MINUTE_TICK: "on", PUBLIC_ORIGIN: "https://azimuth-2.digitalchemy.workers.dev" });
  let mid = 0;
  const tap = (id, e) => worker.fetch(new Request("https://x/wa", { method: "POST", headers: { "X-Azimuth-Forward": "FWD", "Content-Type": "application/json" },
    body: JSON.stringify({ entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: "p" }, messages: [{ from: HER, id: "wamid.in" + (++mid), type: "interactive", interactive: { type: "button_reply", button_reply: { id, title: id } } }] } }] }] }) }), e || env, ctx);
  const settle = async () => { while (pending.length) await pending.shift(); };
  const fbg = JSON.stringify({ n: "4", area: "", angle: { hook: "No metro for five kilometres, yet 6.6% gross yield.", figure: "5 km+", source: "RTA metro network coverage" },
    options: [{ id: "B", name: "Street level", note: "A real residential street", place: "A residential street in Dubai at eye level" }] });
  store.set("fbg_4", fbg);
  // the live shape on 30 Sep: three pass the cut-out test; two half-length and one black-and-white do not
  store.set("img_style_me_pool", JSON.stringify({ usable: ["style_ref_17", "style_ref_21", "style_ref_22"], verdicts: {
    style_ref_17: { usable: true, why: "ok 0.37" }, style_ref_21: { usable: true, why: "ok 0.42" }, style_ref_22: { usable: true, why: "ok 0.38" },
    style_ref_25: { usable: false, why: "not full-length standing (0.65 wide)" }, style_ref_26: { usable: false, why: "not full-length standing (0.62 wide)" },
    style_ref_30: { usable: false, why: "black and white" } } }));
  const offered = new Set();
  for (let k = 0; k < 3; k++) {
    const i = sent.length; await tap("stm:4:B:ss"); await settle();
    for (const b of sent.slice(i)) if (b.type === "image") offered.add(String(b.image.link).split("/img/")[1]);
  }
  ok(offered.has("style_ref_25") && offered.has("style_ref_26"), "a scene offers her half-length photos too, not only the cut-out six: " + [...offered].sort().join(","));
  ok(!offered.has("style_ref_30"), "but never a black-and-white one");
  // a plate (SCENE_PICTURES off) pastes a cut-out, so it keeps to the cut-out pool
  const plate = Object.assign({}, env, { SCENE_PICTURES: "" }); const po = new Set();
  store.set("fbg_4", fbg); store.set("style_me_cursor", "0");
  for (let k = 0; k < 3; k++) { store.set("fbg_4", fbg); const i = sent.length; await tap("fbg:4:B", plate); await settle(); for (const b of sent.slice(i)) if (b.type === "image") po.add(String(b.image.link).split("/img/")[1]); }
  ok(po.size > 0 && [...po].every(k => ["style_ref_17", "style_ref_21", "style_ref_22"].includes(k)), "a plate still only offers photos with a usable cut-out: " + [...po].sort().join(","));
}

// ---- C. today's backdrops move on when they would repeat the last set -----------------------------------------------------------
{
  const tapAll = async (r) => {
    const body = { entry: [{ changes: [{ value: { metadata: { phone_number_id: "1" }, messages: [{ from: "971565484397", id: "t" + Date.now() + Math.random(), timestamp: String(Math.floor(Date.now() / 1000)), type: "interactive", interactive: { type: "button_reply", button_reply: { id: "fs:all", title: "Make all five" } } }] } }] }] };
    await worker.fetch(new Request("https://x/wa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), r.env, { waitUntil() {} });
    return JSON.parse(r.store.get("feed_scenes_last") || "null");
  };
  const c0 = await run([]); const s0 = await tapAll(c0);
  ok(s0 && s0.backdrops.length === 5, "first morning: five backdrops recorded: " + (s0 && s0.backdrops.join(",")));
  const c1 = await run([], { kv: { feed_scenes_last: JSON.stringify({ backdrops: s0.backdrops }) } }); const s1 = await tapAll(c1);
  ok(s1 && s1.backdrops.join() !== s0.backdrops.join(), "the same angles on a morning whose last set matches: the backdrops move on (" + (s1 && s1.backdrops.join(",")) + ")");
}

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
