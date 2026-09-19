// v184 — THE MORNING FLOOR AND THE SPLIT (Kendall, 19 Sep 2026).
//
// The 06:00 feed on 19 Sep sent NOTHING. Its QA record: angle 1 (growth_plan) "same subject (growth_plan:-) on 2026-09-18";
// 2 "number 34.9 already used on 2026-09-10"; 3 "number 105 already used on 2026-09-19"; 4 (education) "same subject
// (education:-) on 2026-09-17"; 5 "number 72000 already used on 2026-09-12" - all five dropped, no floor. The fix: the plan's
// fixed facts are exempt from the history locks, the set is 2-3 plan + 2-3 real-estate angles, and the send never has fewer
// than five. This replays that morning and the edges of the new rules.
import worker from "../src/index.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("ok - " + m); } else { fail++; console.log("not ok - " + m); } };
const A = (hook, figure, source, family, reader) => ({ hook, figure, source, buyer: "b", family, reader });
const figKey = (f) => String(f).toLowerCase().replace(/[^0-9a-z%.]/g, "").slice(0, 40);
const nums = (f) => [...new Set((String(f).match(/\d[\d,]*(?:\.\d+)?/g) || []).map((v) => v.replace(/,/g, "")).filter((v) => v.replace(".", "").length >= 3 && !/^20\d\d$/.test(v)))];
const day = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const H = (figure, family, daysAgo, subj) => ({ d: day(daysAgo), f: family, k: figKey(figure), n: nums(figure), s: family + ":" + (subj || "-") });

let serve = [], topup = [], topupAsks = [];
globalThis.fetch = async (u, o) => {
  const url = String(u && u.url ? u.url : u);
  if (/anthropic/i.test(url)) {
    let body = {}; try { body = JSON.parse(String(o && o.body || "{}")); } catch (e) {}
    const sys = JSON.stringify(body.system || "");
    const isVoice = /rewrite social-post hooks/.test(sys), isTop = /TOP-UP \(the morning must have five\)/.test(sys);
    if (isTop) topupAsks.push((sys.match(/Return ONLY (\d+) NEW angle\(s\): (\d+) Dubai 2040 angle\(s\)[^,]*, and (\d+) real-estate/) || []).slice(1).join("/"));
    const text = isVoice ? JSON.stringify({ items: [] }) : JSON.stringify({ angles: isTop ? topup : serve });
    return new Response(JSON.stringify({ content: [{ type: "text", text }], stop_reason: "end_turn" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
};
const READ = "owner_admin_key_never_in_client_links_0001";
const run = async (angles, famhist, top) => {
  serve = angles; topup = top || []; topupAsks = [];
  const store = new Map([["mkt_latest", JSON.stringify({ generatedAt: new Date().toISOString() })], ["mkt_feed_famhist", JSON.stringify(famhist)]]);
  const KV = { async get(k, t) { if (!store.has(k)) return null; const v = store.get(k); return t === "json" ? JSON.parse(v) : v; },
    async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); }, async list() { return { keys: [], list_complete: true }; } };
  const env = { MEETINGS: KV, READ_KEY: READ, MARKET_BRIEF: "on", ANTHROPIC_API_KEY: "test-only-not-a-key", PUBLIC_ORIGIN: "https://x" };
  const r = await worker.fetch(new Request("https://x/feed_test?dry=1&key=" + READ), env, { waitUntil() {} });
  let qa = null; try { qa = JSON.parse(store.get("mkt_feed_qa") || "null"); } catch (e) {}
  const out = await r.text();
  return { out, qa, n: (out.match(/^\d\. /gm) || []).length };
};

// ---- 19 Sep replayed ---------------------------------------------------------------------------------------------------------
const POP = A("The plan targets 5.8 million residents by 2040.", "5.8 million (2040 target); 3.3 million (2020 baseline)", "Dubai Media Office, 13 Mar 2021", "growth_plan", "authority");
const PRICE = A("Prices up 34.9% in a year.", "34.9%", "DLD Open Data", "prices", "invest");
const SATWA = A("A 105% increase planned for Al Wasl.", "105% increase planned", "DLD Open Data", "city_life", "move");
const EDU = A("Land for schools and health rises 25% by 2040.", "25%", "Dubai Media Office, 13 Mar 2021", "education", "move");
const RENT = A("72,000 rent contracts.", "72,000 contracts", "DLD Open Data", "rents_yields", "move");
const hist19 = [H("50+ master plans, AED 55 billion", "growth_plan", 1), H("34.9%", "prices", 9), H("105% increase planned", "city_life", 0, "al wasl"),
  H("the plan", "education", 2), H("72,000 contracts", "rents_yields", 7)];
const TOP_RE = [A("4,410 homes handed over this quarter.", "4,410 handovers", "DLD Open Data, Q3 2026", "handover_supply", "invest"),
  A("Off-plan share at 61% this month.", "61% off-plan", "DLD Open Data, Sep 2026", "offplan_ready", "invest"),
  A("14 new Metro stations on the Blue Line.", "14 stations", "Dubai Media Office, 4 Mar 2025", "transit", "authority")];
const r19 = await run([POP, PRICE, SATWA, EDU, RENT], hist19, TOP_RE);
ok(/5\.8 million/.test(r19.out) && /25%/.test(r19.out), "the two plan angles that 19 Sep's subject lock blocked now go out - plan facts are exempt from the history locks");
ok(!/34\.9%/.test(r19.out) && !/72,000/.test(r19.out), "the live figures she already had (34.9%, 72,000) are still dropped");
ok(r19.n === 5, "and she gets FIVE, not the empty morning of 19 Sep: " + r19.n);
ok(r19.qa && /five-floor: 5 sent \((2|3) plan, (2|3) real estate\)/.test(r19.qa.note), "in the 2-3 / 2-3 split, stated in the QA line: " + (r19.qa ? r19.qa.note.slice(-70) : ""));

// ---- the split: an all-plan set is trimmed to three and topped up with real estate --------------------------------------------
const PLAN5 = [POP, EDU, A("6,500 km of walking paths are planned.", "6,500 km", "Dubai Media Office, 4 Mar 2025", "city_life", "move"),
  A("14 new Metro stations.", "14 stations", "Dubai Media Office, 4 Mar 2025", "transit", "invest"),
  A("Five urban centres, each for a city's worth of people.", "5 urban centres", "Dubai 2040 Urban Master Plan, UAE Government portal, 13 Mar 2021", "district", "invest")];
const sp = await run(PLAN5, [], TOP_RE.slice(0, 2));
ok(sp.n === 5 && sp.qa && /trimmed a plan angle over three/.test(sp.qa.note) && /3 plan, 2 real estate/.test(sp.qa.note), "five plan angles: two trimmed, two real-estate angles topped up - " + (sp.qa ? sp.qa.note.slice(-60) : ""));
ok(topupAsks.includes("2/0/2"), "the top-up asks for exactly what is missing - 2 new, 0 plan, 2 real estate: " + topupAsks.join(" "));

// ---- honesty holds inside the top-up: an invented plan citation is refused ------------------------------------------------------
const INVENT = A("12 new hospitals are coming.", "12 new hospitals", "Dubai Media Office, 4 Mar 2025", "education", "move");
const hon = await run([POP, PRICE, SATWA, EDU, RENT], hist19, [INVENT, ...TOP_RE]);
ok(!/12 new hospitals/.test(hon.out) && hon.n === 5, "a top-up angle citing the plan for a figure the plan does not contain is refused, and the floor still reaches five");

// ---- the content guards: the first dry run of the floor on real data carried both of these ------------------------------------
const WORDS = A("Fifty-five million residents move within walking distance of a Metro station by 2040.", "55 districts, 11 within 2 km walk, 14 stations planned", "cityLife metro data; Dubai Media Office, 4 Mar 2025", "transit", "move");
const NINE = A("Arada released 9 units across 3 projects.", "9 units released", "developerInventory moves, 2026-09-07 to 2026-09-11", "offplan_ready", "invest");
const INVENTED_NUM = A("Approvals are 73% faster.", "50+ master plans, AED 55 billion", "Dubai Media Office, 4 Mar 2025", "growth_plan", "authority");
const cg = await run([WORDS, NINE, INVENTED_NUM, EDU, POP], [], TOP_RE);
ok(!/Fifty-five million/.test(cg.out), "a hook with a big number spelled out in words is dropped - '55 districts' became 'Fifty-five million residents'");
ok(!/9 units released/.test(cg.out), "an inventory move under 20 units is never a headline, top-up or not");
ok(!/73% faster/.test(cg.out), "a hook number that appears nowhere in the figure or the data is dropped");
ok(cg.n >= 4 && cg.qa && /DROPPED 3 for content/.test(cg.qa.note), "and the floor replaces them, saying why: " + (cg.qa ? (cg.qa.note.match(/DROPPED 3 for content[^|]*/) || [""])[0].slice(0, 160) : ""));

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
