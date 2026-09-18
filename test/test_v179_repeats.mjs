// v179 — THE REPEAT CHECK NOW BLOCKS (Kendall, 18 Sep 2026: "fix the repeat check").
//
// The fresh run at 09:43 GST sent her five angles, three of which reused figures from her 06:00 set - 68,323 rent contracts,
// 2,916 weekly sales, 6,144 bus stops. The audit SAW it ("4 still overlap") and let them out, because it only dropped repeats
// when at least 3 angles would remain. When MOST of a set repeated, the floor stopped the drop and every repeat went out: the
// check failed exactly when repetition was worst. Now repeats are always dropped, after three attempts at replacements.
//
// And the plan must not starve: it has 16 official facts, and a 14-day lock on each would exhaust the Dubai 2040 spine in
// about a week. Plan facts restate on a 3-day cooldown; live figures keep the 14-day lock.
import worker from "../src/index.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("ok - " + m); } else { fail++; console.log("not ok - " + m); } };

const A = (hook, figure, source, family, reader) => ({ hook, figure, source, buyer: "b", family, reader });
const figKey = (f) => String(f).toLowerCase().replace(/[^0-9a-z%.]/g, "").slice(0, 40);
const nums = (f) => [...new Set((String(f).match(/\d[\d,]*(?:\.\d+)?/g) || []).map((v) => v.replace(/,/g, "")).filter((v) => v.replace(".", "").length >= 3 && !/^20\d\d$/.test(v)))];
const day = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const hist = (figure, family, daysAgo) => ({ d: day(daysAgo), f: family, k: figKey(figure), n: nums(figure), s: family + ":-" });

let serve = [];
globalThis.fetch = async (u, o) => {
  const url = String(u && u.url ? u.url : u);
  if (/anthropic/i.test(url)) {
    let body = {}; try { body = JSON.parse(String(o && o.body || "{}")); } catch (e) {}
    const isVoice = /rewrite social-post hooks/.test(JSON.stringify(body.system || ""));
    // every call - including the three repair passes - returns the same set, so a repeat can only leave by being dropped
    const text = isVoice ? JSON.stringify({ items: [] }) : JSON.stringify({ angles: serve });
    return new Response(JSON.stringify({ content: [{ type: "text", text }], stop_reason: "end_turn" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
};
const READ = "owner_admin_key_never_in_client_links_0001";
const run = async (angles, famhist) => {
  serve = angles;
  const store = new Map([["mkt_latest", JSON.stringify({ generatedAt: new Date().toISOString() })], ["mkt_feed_famhist", JSON.stringify(famhist)]]);
  const KV = { async get(k, t) { if (!store.has(k)) return null; const v = store.get(k); return t === "json" ? JSON.parse(v) : v; },
    async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); }, async list() { return { keys: [], list_complete: true }; } };
  const env = { MEETINGS: KV, READ_KEY: READ, MARKET_BRIEF: "on", ANTHROPIC_API_KEY: "test-only-not-a-key", PUBLIC_ORIGIN: "https://x" };
  const r = await worker.fetch(new Request("https://x/feed_test?dry=1&key=" + READ), env, { waitUntil() {} });
  let qa = null; try { qa = JSON.parse(store.get("mkt_feed_qa") || "null"); } catch (e) {}
  return { out: await r.text(), qa };
};

// ---- this morning, replayed: her 06:00 figures in the history, four of the new five repeating them ------------------------
const RENT = A("68,323 rental contracts through mid-September.", "68,323 contracts", "DLD Open Data, rents to 2026-09-17", "rents_yields", "move");
const WEEK = A("Week 37 moved 2,916 homes.", "2,916 sales", "DLD Open Data, 2026-W37", "volume", "move");
const MAD = A("Madinat Al Mataar took 2,964 sales.", "2,964 sales", "DLD Open Data, 2026-07-22 to 2026-09-17", "district", "invest");
const OFF = A("Off-plan took 15,760 homes.", "15,760 off-plan units", "DLD Open Data, 2026-07-22 to 2026-09-17", "offplan_ready", "invest");
const PLAN = A("50+ master plans and AED 55 billion approved.", "50+ master plans, AED 55 billion", "Dubai Media Office, 4 Mar 2025", "growth_plan", "authority");
const at0600 = [hist("68,323 contracts", "rents_yields", 0), hist("2,916 sales", "volume", 0), hist("2,964 sales", "district", 0), hist("15,760 off-plan units", "offplan_ready", 0)];

const m = await run([RENT, WEEK, MAD, OFF, PLAN], at0600);
ok(!/68,323 contracts/.test(m.out) && !/2,916 sales/.test(m.out) && !/2,964 sales/.test(m.out) && !/15,760/.test(m.out),
   "all four repeats of her 06:00 figures are DROPPED - under the old '3 must remain' floor, all five went out");
ok(/50\+ master plans/.test(m.out), "the one fresh angle still goes out");
ok(m.qa && /dropped rather than repeated/.test(m.qa.note), "and the QA line says they were dropped rather than repeated: " + (m.qa ? m.qa.note.slice(0, 90) : "no QA"));

// ---- the plan's facts: a 3-day cooldown, not a 14-day lock -----------------------------------------------------------------
const BEACH = A("Public beaches up by as much as 400% by 2040.", "400%", "Dubai Media Office, 13 Mar 2021", "city_life", "move");
const FRESH = [A("Rents at 71,000 contracts.", "71,000 contracts", "DLD Open Data", "rents_yields", "move"),
               A("Week 38 at 3,101 homes.", "3,101 sales", "DLD Open Data", "volume", "move"),
               A("A district at 1,777 sales.", "1,777 sales", "DLD Open Data", "district", "invest"),
               A("50+ master plans.", "50+ master plans, AED 55 billion", "Dubai Media Office, 4 Mar 2025", "growth_plan", "authority")];
const five = await run([BEACH, ...FRESH], [hist("400%", "city_life", 5)]);
ok(/400%/.test(five.out), "a plan fact last used FIVE days ago may be restated - the plan's thesis does not wear out in a fortnight");
const one = await run([BEACH, ...FRESH], [hist("400%", "city_life", 1)]);
ok(!/400%/.test(one.out), "but not the day after - a plan fact used YESTERDAY is held back for its 3-day cooldown");

const LIVE = A("12,345 homes in one quarter.", "12,345 homes", "DLD Open Data", "district", "invest");
const live = await run([LIVE, FRESH[0], FRESH[1], FRESH[3], BEACH], [hist("12,345 homes", "district", 5)]);
ok(!/12,345 homes/.test(live.out), "a LIVE figure used five days ago is still blocked - the 14-day lock is unchanged for everything but the plan");

// ---- nothing fresh at all: send nothing, never the repeats and never an empty set ------------------------------------------
const all = await run([RENT, WEEK, MAD, OFF, A("Rents again: 68,323.", "68,323 contracts", "DLD Open Data", "rents_yields", "move")], at0600);
ok(/nothing would be sent/.test(all.out), "when every angle repeats even after three repair passes, NOTHING is sent: " + all.out.slice(0, 80));

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
