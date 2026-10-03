// v272 - THE NEWS FILLS THE GAP. The live dry run on v270 (30 Sep 2026) sent nothing: every register and plan figure the model
// found she had already had. When the set is still short after the register top-ups, the feed now asks for news angles - one
// story each, under the news honesty rule and the repeat audit - and news may anchor up to four of the five (was two).
// N1 a short morning is filled from the news; N2 a news angle whose number is not in its story is refused; N3 at most four news
// angles; N4 no news held -> no news top-up.
// NEGATIVE CONTROL: run this file against v271's src/index.js - N1, N2 and N3 fail. Verified on 30 Sep 2026.
import worker from "../src/index.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };
const A = (hook, figure, source, family, reader) => ({ hook, figure, source, buyer: "b", family, reader });
const POP = A("The plan targets 5.8 million residents by 2040.", "5.8 million (2040 target); 3.3 million (2020 baseline)", "Dubai Media Office, 13 Mar 2021", "growth_plan", "authority");
const nowIso = new Date().toISOString();
const item = (outlet, title, summary, name) => ({ title, outlet, url: "https://example.test/" + encodeURIComponent(title), summary, published: nowIso, seen: nowIso, score: 10, entities: [{ name, type: "infrastructure" }] });
const NEWS = [
  item("Khaleej Times", "Etihad Rail passenger service launches", "Etihad Rail's passenger service launched with 10 daily journeys between Dubai and Abu Dhabi.", "Etihad Rail"),
  item("The National", "Dubai villa sells for record price", "A villa on Palm Jumeirah sold for Dh170 million, a record for the year.", "Palm Jumeirah"),
  item("Gulf News", "RTA opens new Al Ittihad road lanes", "The RTA opened 4 new lanes on Al Ittihad Road to ease evening traffic.", "RTA"),
  item("Emirates News Agency", "Dubai Land Department reports quarter", "The Dubai Land Department recorded 42,300 transactions in the third quarter.", "Dubai Land Department"),
  item("Arabian Business", "Blue Line tender awarded", "The Blue Line's 30 km tender was awarded this week.", "Blue Line"),
];
const N_RAIL = A("Etihad Rail runs 10 daily journeys from Dubai, which lifts homes for tenants and buyers in Jebel Ali.", "10 daily journeys", "reported by Khaleej Times, 30 Sep 2026", "transit", "move");
const N_VILLA = A("A Palm Jumeirah villa just sold for Dh170 million.", "Dh170 million", "reported by The National, 30 Sep 2026", "luxury", "invest");
const N_ROAD = A("The RTA opened 4 new lanes on Al Ittihad Road, easing travel for tenants in Al Qusais.", "4 new lanes", "reported by Gulf News, 30 Sep 2026", "roads", "move");
const N_DLD = A("The DLD recorded 42,300 transactions last quarter across Dubai.", "42,300 transactions", "reported by Emirates News Agency, 30 Sep 2026", "volume", "authority");
const N_BLUE = A("The Blue Line's 30 km tender was awarded.", "30 km", "reported by Arabian Business, 30 Sep 2026", "developer", "invest");
const N_FAKE = A("The villa market jumped 22% this week.", "22%", "reported by The National, 30 Sep 2026", "luxury", "invest");

// the live 30 Sep shape: the model serves five, four of them figures she already had, so the audit leaves one
const day = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const figKey = (f) => String(f).toLowerCase().replace(/[^0-9a-z%.]/g, "").slice(0, 40);
const S1 = A("City of Arabia moved 1,128 sales.", "1,128 sales", "DLD Open Data, 2026-09-20", "district", "invest");
const S2 = A("Rents settled at 71,400 contracts.", "71,400 contracts", "DLD Open Data, 2026-09-20", "rents_yields", "move");
const S3 = A("JVC took 4,410 sales this quarter.", "4,410 sales", "DLD Open Data, 2026-09-20", "volume", "invest");
const S4 = A("Off-plan took 6,712 sales this period.", "6,712 sales", "DLD Open Data, 2026-09-20", "offplan", "authority");
const STALE = [S1, S2, S3, S4];
// numbers she has had (so the four are dropped); subjects kept distinct from the news angles so only the numbers decide
const HIST = [["1128", "district"], ["71400", "rents_yields"], ["4410", "volume"], ["6712", "offplan"]].map(([n, f], i) => ({ d: day(3), f, k: "old" + n, n: [n], s: "hist" + i + ":-" }));
const POP_RESTING = { d: day(1), f: "growth_plan", k: figKey(POP.figure), n: [], s: "growth_plan:-" };
let serve = [POP].concat(STALE), newsTop = [], newsCalls = 0;
globalThis.fetch = async (u, o) => {
  const url = String(u && u.url ? u.url : u);
  if (/anthropic/i.test(url)) {
    let body = {}; try { body = JSON.parse(String(o && o.body || "{}")); } catch (e) {}
    const sys = typeof body.system === "string" ? body.system : JSON.stringify(body.system || "");
    let text;
    if (/last quality check/.test(sys)) { let today = []; try { const m = body.messages[0].content; today = JSON.parse(typeof m === "string" ? m : m[0].text).today; } catch (e) {} text = JSON.stringify({ verdicts: today.map(t => ({ angle: t.angle, repeat: false, why: "new" })) }); }
    else if (/KHALEEJ TIMES ANGLE/.test(sys)) text = JSON.stringify({ angles: [] });
    else if (/NEWS TOP-UP/.test(sys)) { newsCalls++; text = JSON.stringify({ angles: newsTop }); }
    else if (/TOP-UP/.test(sys)) text = JSON.stringify({ angles: [] });
    else if (/rewrite social-post hooks/.test(sys)) text = JSON.stringify({ items: [] });
    else text = JSON.stringify({ angles: serve });
    return new Response(JSON.stringify({ content: [{ type: "text", text }], stop_reason: "end_turn" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  if (/graph\.facebook\.com/.test(url)) return new Response(JSON.stringify({ messages: [{ id: "wamid.x" }] }), { status: 200 });
  if (/owner_note/.test(url)) return new Response("sent", { status: 200 });
  return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
};
const READ = "owner_admin_key_never_in_client_links_0001";
const run = async (opts) => {
  serve = [POP].concat(STALE); newsTop = opts.newsTop || []; newsCalls = 0;
  const store = new Map([["mkt_latest", JSON.stringify({ generatedAt: new Date().toISOString() })], ["mkt_feed_famhist", JSON.stringify(HIST.concat(opts.popResting ? [POP_RESTING] : []))], ["wa_owner_last_in", new Date().toISOString()],
    ["news_live", JSON.stringify({ items: opts.news || [], feeds: {} })]]);
  const KV = { async get(k, t) { if (!store.has(k)) return null; const v = store.get(k); return t === "json" ? JSON.parse(v) : v; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); },
    async list(o) { return { keys: [...store.keys()].filter((k) => !o || !o.prefix || k.startsWith(o.prefix)).map((name) => ({ name })), list_complete: true }; } };
  const env = { MEETINGS: KV, AI: { run: async () => ({ response: "{}" }) }, READ_KEY: READ, MARKET_BRIEF: "on", ANTHROPIC_API_KEY: "test-only-not-a-key", PUBLIC_ORIGIN: "https://x",
    WA_ALLOWED: "971565484397", WHATSAPP_TOKEN: "t", WA_PHONE_ID: "1", OWNER_NOTE_URL: "https://mc/owner_note", INGEST_TOKEN: "i", LIVE_NEWS: "on" };
  const r = await worker.fetch(new Request("https://x/feed_test?dry=1&key=" + READ), env, { waitUntil() {} });
  const out = await r.text(); const list = out.split("QA:")[0];
  let qa = null; try { qa = JSON.parse(store.get("mkt_feed_qa") || "null"); } catch (e) {}
  return { out, list, qa, count: (list.match(/^\d\. /gm) || []).length };
};

// N1
const n1 = await run({ news: NEWS, newsTop: [N_RAIL, N_VILLA, N_ROAD, N_DLD] });
ok(newsCalls === 1, "N1 a morning left with one angle (four dropped as repeats) asks for news angles");
ok(n1.count === 5, "N1 and is filled to five: " + n1.count);
ok(/10 daily journeys/.test(n1.list) && /Dh170 million/.test(n1.list) && /4 new lanes/.test(n1.list) && /42,300/.test(n1.list), "N1 with four news angles, each from its own story");
ok(n1.qa && /news top-up added 4/.test(n1.qa.note), "N1 and the QA line says so");
// N2
const n2 = await run({ news: NEWS, newsTop: [N_FAKE, N_RAIL] });
ok(!/22%/.test(n2.list) && /10 daily journeys/.test(n2.list), "N2 a news angle whose number is not in its story is refused; the honest one is kept");
ok(n2.qa && /news top-up refused 1 \(news: a number in it is not in the The National story/.test(n2.qa.note), "N2 and the QA line says why: " + (n2.qa ? (n2.qa.note.match(/news top-up refused[^|]*/) || [""])[0].slice(0, 120) : ""));
// N3
const n3 = await run({ news: NEWS, popResting: true, newsTop: [N_RAIL, N_VILLA, N_ROAD, N_DLD, N_BLUE] });   // the plan fact is resting too: nothing but news is left
// v284 - the short set no longer stays at four: the fact ledger fills the fifth, never with a fifth news angle
ok((n3.list.match(/reported by/g) || []).length === 4 && !/Arabian Business/.test(n3.list) && n3.count === 5, "N3 at most four news angles, even when a fifth is offered and the set is short (v284: the fifth comes from the fact ledger): " + n3.count);
// N4
const n4 = await run({ news: [], newsTop: [N_RAIL] });
ok(newsCalls === 0 && !/10 daily journeys/.test(n4.list), "N4 no news held: no news top-up");

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
