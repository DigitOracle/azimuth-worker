// v178.2 — A POST MAY ONLY CITE THE 2040 PLAN FOR A FIGURE THE PLAN CONTAINS (18 Sep 2026).
//
// The first dry run of v178.1 told the Dubai story in the right shape, and to finish the story it invented a fact and
// gave it a real source: "Five schools now serve City of Arabia, Dubai Media Office, 4 Mar 2025". That update says no
// such thing. She quotes these to clients with the source attached, so a borrowed citation is the one fault that must
// never reach her - and it is checked mechanically, because asking the model not to do it is what failed.
//
// The cases below are the REAL angles from that dry run, plus genuine plan citations that must NOT be dropped - a guard
// that also deletes the true ones would be silently emptying her morning.
import worker from "../src/index.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("ok - " + m); } else { fail++; console.log("not ok - " + m); } };

const A = (hook, figure, source, family, reader) => ({ hook, figure, source, buyer: "b", family, reader });
const OFF = A("Off-plan took two-thirds of every deal this period.", "15,760 off-plan units", "DLD Open Data, 22 Jul-17 Sep 2026", "offplan_ready", "invest");
const POP = A("The target is 5.8 million residents by 2040.", "5.8 million (2040 target); 3.3 million (2020 baseline)", "Dubai Media Office, 13 Mar 2021", "growth_plan", "authority");
const WALK = A("Dubai has planned 6,500 km of walking paths.", "6,500 km", "Dubai Media Office, 4 Mar 2025", "city_life", "move");
const METRO = A("14 new Metro stations.", "14 stations", "Dubai Media Office, 4 Mar 2025", "transit", "invest");
const CENTRES = A("Five urban centres, each for a city's worth of people.", "5 urban centres", "Dubai 2040 Urban Master Plan, UAE Government portal, 13 Mar 2021", "growth_plan", "invest");
// the invented ones: the real v178.1 line, and a made-up one of the same kind
const SCHOOLS = A("Five schools now serve City of Arabia.", "5 schools operational", "Dubai Media Office, 4 Mar 2025", "education", "move");
const HOSP = A("12 new hospitals are coming.", "12 new hospitals", "Dubai Media Office, 4 Mar 2025", "education", "move");

const RETURNED = [OFF, POP, SCHOOLS, WALK, METRO];      // the real v178.1 set's shape: one invented citation among genuine ones
const EXTRA = [OFF, CENTRES, HOSP, WALK, METRO];        // a single-digit plan figure beside an invented one
const HONEST = [OFF, POP, WALK, METRO, A("Land for schools and health rises 25% by 2040.", "25%", "Dubai Media Office, 13 Mar 2021", "education", "move")];

let serve = RETURNED;
globalThis.fetch = async (u, o) => {
  const url = String(u && u.url ? u.url : u);
  if (/anthropic/i.test(url)) {
    let body = {}; try { body = JSON.parse(String(o && o.body || "{}")); } catch (e) {}
    const isVoice = /rewrite social-post hooks/.test(JSON.stringify(body.system || ""));
    const text = isVoice ? JSON.stringify({ items: [] }) : JSON.stringify({ angles: serve });
    return new Response(JSON.stringify({ content: [{ type: "text", text }], stop_reason: "end_turn" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
};
const READ = "owner_admin_key_never_in_client_links_0001";
const run = async (angles) => {
  serve = angles;
  const store = new Map([["mkt_latest", JSON.stringify({ generatedAt: new Date().toISOString() })]]);
  const KV = { async get(k, t) { if (!store.has(k)) return null; const v = store.get(k); return t === "json" ? JSON.parse(v) : v; },
    async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); }, async list() { return { keys: [], list_complete: true }; } };
  const env = { MEETINGS: KV, READ_KEY: READ, MARKET_BRIEF: "on", ANTHROPIC_API_KEY: "test-only-not-a-key", PUBLIC_ORIGIN: "https://x" };
  const r = await worker.fetch(new Request("https://x/feed_test?dry=1&key=" + READ), env, { waitUntil() {} });
  let qa = null; try { qa = JSON.parse(store.get("mkt_feed_qa") || "null"); } catch (e) {}
  return { out: await r.text(), qa };
};

const { out, qa } = await run(RETURNED);
ok(!/5 schools operational/.test(out), "the invented 'five schools' is REMOVED - it borrowed the Media Office's name for a fact that page does not state");
ok(qa && /DROPPED/.test(qa.note) && /cited the 2040 plan for a figure the plan does not contain/.test(qa.note), "and the removal is written into the QA line, not done silently: " + (qa ? qa.note.slice(qa.note.indexOf("DROPPED"), qa.note.indexOf("DROPPED") + 40) : "no QA"));
ok(/5\.8 million \(2040 target\)/.test(out), "the population target stays - its figures ARE the plan's");

ok(/6,500 km/.test(out), "'6,500 km' stays - the Dubai Walk figure, which the geography check used to drop as an unnamed community");
ok(/15,760 off-plan units/.test(out), "a register figure is not touched - it cites the register, not the plan");

const r2 = await run(EXTRA);
ok(/14 stations/.test(out), "'14 stations' stays - the Blue Line figure");
ok(/5 urban centres/.test(r2.out), "'5 urban centres' stays - a single digit, but the plan's own wording");
ok(!/12 new hospitals/.test(r2.out), "an invented '12 new hospitals' cited to the plan is removed too");

const r3 = await run(HONEST);
ok(!r3.qa || !/DROPPED/.test(r3.qa.note), "and when every plan citation is genuine, nothing is dropped - the guard does not empty an honest morning");

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
