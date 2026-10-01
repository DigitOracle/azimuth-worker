// v284 - THE FACT LEDGER (Kendall, 1 Oct 2026: "we have all these different sources and you're still struggling to stop her feed
// repeating"). On 1 Oct the morning and a dry run on fresh data both ended "no angle survived, even after the top-up and the gate".
// Measured: 178 of the 197 numbers handed to the generator were fresh, but the generator kept offering the same favourites, and 15 of
// the 21 "same subject" refusals were the generic "<family>:-" key, which locked 13 of 14 families for five days.
// This test runs the real worker on HER REAL 14-DAY HISTORY from 1 Oct (v284_fixture.mjs) with a model stub that replays what the
// 1 Oct runs kept offering, in every pass:
//   L1 the old code sends 0 (live: 1); v284 sends 5 distinct ones, 2-3 plan and 2-3 real estate, with the Khaleej Times angle
//   L2 the generator is handed fresh facts only (ledger), including the Ejari filed leases read from a GZIPPED KV value
//   L3 the subject lock still locks a REAL subject (Madinat Al Mataar), but no longer a whole family
//   L4 an angle that claims a fact but carries another figure is not bound to it
//   L5 what she is sent is written to her history with its fact id
//   L6 when the gate removes angles, the ledger refills and the refill is gated again
// NEGATIVE CONTROL: FEED_SRC=C:/Dev/_rel283/src/index.js node test/test_v284_fact_ledger.mjs - 10 of 20 fail, L1 L2 L5 L6 among them (v283 sends no angle at all on this replay; 1 on the live 1 Oct run). Verified 1 Oct 2026.
import zlib from "node:zlib";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { FAMHIST_1OCT, HIST_1OCT, LATEST_1OCT } from "./v284_fixture.mjs";
const SRC = process.env.FEED_SRC ? pathToFileURL(path.resolve(process.env.FEED_SRC)).href : new URL("../src/index.js", import.meta.url).href;
const worker = (await import(SRC)).default;

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };
const A = (hook, figure, source, family, reader, extra) => Object.assign({ hook, figure, source, buyer: "b", family, reader }, extra || {});
const DAY = 86400000, iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const day = (n) => iso(Date.now() - n * DAY);
const FAMH = FAMHIST_1OCT.map(({ ago, ...x }) => Object.assign(x, { d: day(ago) }));
const nowIso = new Date().toISOString();
const NEWS = [
  { title: "UAE petrol prices jump 16%: Residents plan Dubai Metro trips, fewer office days", outlet: "Khaleej Times", url: "https://example.test/kt1", summary: "", published: nowIso, seen: nowIso, score: 12, entities: [{ name: "Dubai Metro", type: "infrastructure" }] },
  { title: "Will monthly rent become the new norm in Dubai?", outlet: "Khaleej Times", url: "https://example.test/kt2", summary: "Flexi Rent lets tenants pay monthly or quarterly.", published: nowIso, seen: nowIso, score: 10, entities: [] },
  { title: "Dubai property: Studio sales jump 185% in Dubai South as developers hold prices", outlet: "Arabian Business", url: "https://example.test/ab1", summary: "", published: nowIso, seen: nowIso, score: 11, entities: [{ name: "Dubai South", type: "district" }] },
];
// the Ejari filed leases, gzipped as push_ejari stores them: 14 whole days and today's half day
const EJ_ROWS = []; for (let i = 14; i >= 0; i--) { const d = day(i); for (const [area, n] of [["Al Barsha South Fourth", 40 + (i < 7 ? 12 : 0)], ["Business Bay", 30], ["Al Warsan First", 25]]) { EJ_ROWS.push([d, area, "Flat", "New", i === 0 ? 1 : n]); EJ_ROWS.push([d, area, "Flat", "Renew", i === 0 ? 1 : n - 5]); } EJ_ROWS.push([d, "Business Bay", "Hotel", "New", i === 0 ? 0 : 6]); }
const EJ_GZ = zlib.gzipSync(Buffer.from(JSON.stringify({ as_of: day(0), basis: "filed", source: "DLD open-data gateway rents feed", caveat: "test", per_area: { fields: ["date", "area", "sub_type", "reg_type", "contracts"], rows: EJ_ROWS } })));

// what the 1 Oct runs offered again and again (the stored QA notes and gate records), returned by EVERY model call
const FAV = [
  A("Madinat Al Mataar drew 2,414 sales in 8 weeks. The plan names five urban centres, each built for 1 to 1.5 million residents.", "2,414 sales", "DLD Open Data, 2026-08-05 to 2026-09-30", "growth_plan", "invest"),
  A("Off-plan homes took 14,195 sales in 8 weeks against 7,296 ready.", "14,195 off-plan sales", "DLD Open Data, 2026-08-05 to 2026-09-30", "offplan_ready", "invest"),
  A("Green spaces and parks rise 105% by 2040.", "105%", "Dubai Media Office, 4 Mar 2025", "city_life", "move"),
  A("Beyond released 4 three-bedroom units at Hado Tower B.", "4 units", "Beyond availability sheets", "inventory", "invest"),
  A("Rent no longer needs a full year upfront: Flexi Rent lets tenants pay monthly or quarterly.", "monthly or quarterly rent, Flexi Rent", "reported by Khaleej Times, 1 Oct 2026", "rents_yields", "move"),
];
let calls = [], qaFn = () => [], sent = [], genData = null, serve = FAV;
globalThis.fetch = async (u, o) => {
  const url = String(u && u.url ? u.url : u);
  if (/anthropic/i.test(url)) {
    let body = {}; try { body = JSON.parse(String(o && o.body || "{}")); } catch (e) {}
    const sys = typeof body.system === "string" ? body.system : JSON.stringify(body.system || "");
    const m = body.messages && body.messages[0] && body.messages[0].content; const user = typeof m === "string" ? m : (m && m[0] && m[0].text) || "";
    calls.push(sys.slice(0, 60));
    let text;
    if (/last quality check/.test(sys)) { let today = []; try { today = JSON.parse(user).today; } catch (e) {} const v = qaFn(today); text = JSON.stringify({ verdicts: today.map(t => ({ angle: t.angle, repeat: v.includes(t.angle), why: v.includes(t.angle) ? "the same point as a recent hook" : "new" })) }); }
    else if (/rewrite social-post hooks/.test(sys)) text = JSON.stringify({ items: [] });
    else { if (/You pick FIVE/.test(sys) && !/REPAIR|TOP-UP|KHALEEJ TIMES ANGLE/.test(sys) && genData === null) genData = user; text = JSON.stringify({ angles: serve }); }
    return new Response(JSON.stringify({ content: [{ type: "text", text }], stop_reason: "end_turn" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  if (/graph\.facebook\.com/.test(url)) { let b = {}; try { b = JSON.parse(String(o && o.body || "{}")); } catch (e) {} sent.push(b); return new Response(JSON.stringify({ messages: [{ id: "wamid." + sent.length }] }), { status: 200 }); }
  return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
};
const READ = "owner_admin_key_never_in_client_links_0001";
const run = async (opts) => {
  opts = opts || {}; calls = []; sent = []; genData = null; qaFn = opts.qa || (() => []); serve = opts.serve || FAV;
  const store = new Map([["mkt_latest", JSON.stringify(Object.assign({ generatedAt: nowIso }, LATEST_1OCT))], ["mkt_feed_famhist", JSON.stringify(FAMH)], ["mkt_feed_hist", JSON.stringify(HIST_1OCT)],
    ["wa_owner_last_in", nowIso], ["news_live", JSON.stringify({ items: NEWS, feeds: {} })]]);
  const bin = new Map([["img_ejari_filed_dubai", EJ_GZ]]);
  const KV = { async get(k, t) { if (bin.has(k)) { const b = bin.get(k); return t === "arrayBuffer" ? b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) : b.toString("latin1"); }
      if (!store.has(k)) return null; const v = store.get(k); return t === "json" ? JSON.parse(v) : t === "arrayBuffer" ? new TextEncoder().encode(v).buffer : v; },
    async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); },
    async list(o) { return { keys: [...store.keys()].filter((k) => !o || !o.prefix || k.startsWith(o.prefix)).map((name) => ({ name })), list_complete: true }; } };
  const env = { MEETINGS: KV, AI: { run: async () => ({ response: "{}" }) }, READ_KEY: READ, MARKET_BRIEF: "on", ANTHROPIC_API_KEY: "test-only-not-a-key", PUBLIC_ORIGIN: "https://x",
    WA_ALLOWED: "971565484397", WHATSAPP_TOKEN: "t", WA_PHONE_ID: "1", LIVE_NEWS: "on", OWNER_NOTE_URL: "https://mc/owner_note", INGEST_TOKEN: "i" };
  const r = await worker.fetch(new Request("https://x/feed_test?key=" + READ + (opts.live ? "" : "&dry=1")), env, { waitUntil() {} });
  const out = await r.text();
  const list = out.split("\n\nQA:")[0];
  const angles = []; for (const m of list.matchAll(/^(\d)\. (?:\[VALLEY\] )?\[([a-z_]+|-)\] (.*)\n   (.*?) · (.*)$/gm)) angles.push({ family: m[2], hook: m[3], figure: m[4], source: m[5] });
  let qa = null; try { qa = JSON.parse(store.get("mkt_feed_qa") || "null"); } catch (e) {}
  let famh = []; try { famh = JSON.parse(store.get("mkt_feed_famhist") || "[]"); } catch (e) {}
  let gd = null; try { gd = JSON.parse(genData || "null"); } catch (e) {}
  return { out, angles, qa, famh, gd, morning: sent.map(b => (b.text && b.text.body) || "").find(t => /Najma daily/.test(t)) || "" };
};
const isPlan = (a) => /Dubai Media Office|UAE Government/i.test(a.source);

// ---- L1. today's real situation ------------------------------------------------------------------------------------------------
const l1 = await run(); console.log("    QA: " + (l1.qa && l1.qa.note));
console.log("    sent (" + l1.angles.length + "): " + l1.angles.map(a => "[" + a.family + "] " + a.figure).join(" | "));
ok(l1.angles.length === 5, "L1 her real 1 Oct history and the same favourites in every pass: five angles (v283 sends none on this replay, 1 on the live run): " + l1.angles.length);
ok(new Set(l1.angles.map(a => a.family)).size === l1.angles.length, "L1 five different families: " + l1.angles.map(a => a.family).join(","));
ok(new Set(l1.angles.map(a => a.figure.toLowerCase())).size === l1.angles.length, "L1 five different figures");
const P = l1.angles.filter(isPlan).length;
ok(P >= 2 && P <= 3 && l1.angles.length - P >= 2 && l1.angles.length - P <= 3, "L1 the split holds: " + P + " plan, " + (l1.angles.length - P) + " real estate");
ok(l1.angles.some(a => /Khaleej Times/i.test(a.source)), "L1 with the Khaleej Times angle");
const seenNums = new Set(FAMH.flatMap(x => x.n || []));
const nk = (t) => [...String(t).matchAll(/\d[\d,]*(?:\.\d+)?/g)].map(m => m[0].replace(/,/g, "")).filter(v => v.replace(".", "").length >= 3 && !/^20\d\d$/.test(v));
ok(!l1.angles.filter(a => !isPlan(a)).some(a => nk(a.hook + " " + a.figure).some(n => seenNums.has(n))), "L1 no real-estate angle repeats a number from her 14 days");
ok(!/2,414|14,195|4 units/.test(l1.out.split("QA:")[0]), "L1 none of the favourites the guards refused got through");
ok(l1.qa && /ledger: \d+ facts/.test(l1.qa.note) && /filled \d from the fact ledger/.test(l1.qa.note), "L1 the QA line shows the ledger and its fill: " + (l1.qa ? (l1.qa.note.match(/ledger: [^|]*/) || [""])[0].slice(0, 160) : ""));

// ---- L2. what the generator is handed --------------------------------------------------------------------------------------------
const facts = (l1.gd && l1.gd.facts) || [];
ok(facts.length >= 20 && !l1.gd.dldSales && !l1.gd.areaIntel, "L2 the generator gets a list of fresh facts, not the raw blocks: " + facts.length + " facts");
ok(facts.some(f => f.block === "ejari" && /new leases/.test(f.figure)), "L2 including the Ejari filed leases, read from a gzipped KV value: " + (facts.find(f => f.block === "ejari") || {}).says);
ok(facts.some(f => f.block === "areaIntel") && facts.some(f => f.block === "news" && /Khaleej/.test(f.source)), "L2 and the per-area prices and a Khaleej Times story with its own figure (16%)");
ok(!facts.some(f => nk(f.figure).some(n => seenNums.has(n))), "L2 no fact carries a number she has had in the last 14 days");
ok(!facts.some(f => /madinat al mataar/i.test(f.subject) && f.family === "growth_plan"), "L2 Madinat Al Mataar is not handed under the subject she had on 29 Sep");
ok(!facts.some(f => f.block === "dubai2040" && /105%/.test(f.figure)), "L2 a plan line in her recent hooks (105% green space) rests");

// ---- L3. the subject lock --------------------------------------------------------------------------------------------------------
ok(l1.qa && /same subject \(growth_plan:madinat al mataar\)/.test(l1.qa.note), "L3 a REAL subject inside five days is still refused (Madinat Al Mataar)");
ok(l1.qa && !/same subject \([a-z_]+:-\)/.test(l1.qa.note), "L3 and no angle is refused for a whole family ('<family>:-')");
ok(l1.qa && !/same subject \(rents_yields:-\)/.test(JSON.stringify(l1.qa.gate || {})), "L3 the gate no longer removes a rents angle because a rents angle ran yesterday (1 Oct: the Khaleej Times rent story)");

// ---- L4. a claimed fact with another figure is not bound -------------------------------------------------------------------------
const l4 = await run({ serve: [A("JVC sold 9,999 homes.", "9,999 sales", "DLD Open Data", "volume", "invest", { fact: "dld:sales:jumeirah-village-circle:2026-09-30" })] });
ok(!/9,999/.test(l4.out.split("QA:")[0]), "L4 an angle claiming a fact but carrying another figure fails the data test and is not sent");

// ---- L5. history records the fact ------------------------------------------------------------------------------------------------
const l5 = await run({ live: true });
const todays = l5.famh.slice(0, l5.famh.length - FAMH.length);   // the new rows are written in front of the history
ok(l5.morning && todays.length === 5 && todays.filter(x => x.id).length >= 3, "L5 the five she is sent go into her history, the ledger ones with their fact id: " + todays.map(x => x.id || "-").join(","));

// ---- L6. the gate removes, the ledger refills, the gate runs again ---------------------------------------------------------------
let qaRound = 0;
const l6 = await run({ qa: (today) => (++qaRound === 1 ? today.filter(t => /^The Dubai 2040/.test(t.hook)).slice(0, 1).map(t => t.angle) : []) });
ok(l6.angles.length === 5 && l6.qa && /after the gate: refilled 1 from the fact ledger/.test(l6.qa.note), "L6 the gate removes one, the ledger refills it and the gate checks the refill: " + l6.angles.length + " | " + (l6.qa ? (l6.qa.note.match(/after the gate[^|]*/) || ["(no refill)"])[0].slice(0, 140) : ""));

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
