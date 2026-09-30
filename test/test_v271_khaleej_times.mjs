// v271 - ONE KHALEEJ TIMES ANGLE EVERY MORNING (Kendall, 30 Sep 2026: "you must bring one from Khaleej Times").
// K1 missing -> one is asked for and admitted, keeping five and the split; K2 its number must be in the story; K3 no story held ->
// said so; K4 already there -> nothing extra; K5 Khaleej Times stories always reach the model even when outscored; K6 a morning
// without one tells Kendall why.
// NEGATIVE CONTROL: run this file against v270's src/index.js - K1, K2, K3, K4, K5 and K6 each fail. Verified on 30 Sep 2026.
import worker from "../src/index.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };
const A = (hook, figure, source, family, reader) => ({ hook, figure, source, buyer: "b", family, reader });
const POP = A("The plan targets 5.8 million residents by 2040.", "5.8 million (2040 target); 3.3 million (2020 baseline)", "Dubai Media Office, 13 Mar 2021", "growth_plan", "authority");
const WALK = A("Dubai is adding 6,500 km of walking paths.", "6,500 km", "Dubai Media Office, 4 Mar 2025", "city_life", "move");
const EDU = A("Land for schools and health rises 25% by 2040.", "25%", "Dubai Media Office, 13 Mar 2021", "education", "move");
const SALES = A("City of Arabia moved 1,128 sales.", "1,128 sales", "DLD Open Data, 2026-09-20", "district", "invest");
const RENTS = A("Rents settled at 71,400 contracts.", "71,400 contracts", "DLD Open Data, 2026-09-20", "rents_yields", "move");
const FIVE = [POP, WALK, EDU, SALES, RENTS];
const KT_GOOD = A("Etihad Rail now runs 10 daily journeys from Dubai.", "10 daily journeys", "reported by Khaleej Times, 30 Sep 2026", "transit", "move");
const KT_BAD = A("Etihad Rail will lift nearby prices by 15%.", "15%", "reported by Khaleej Times, 30 Sep 2026", "transit", "invest");

const nowIso = new Date().toISOString();
const ktItem = { title: "Etihad Rail passenger service launches", outlet: "Khaleej Times", url: "https://www.khaleejtimes.com/uae/transport/etihad-rail",
  summary: "Etihad Rail's passenger service launched with 10 daily journeys between Dubai and Abu Dhabi.", published: nowIso, seen: nowIso, score: 2, entities: [{ name: "Etihad Rail", type: "infrastructure" }] };
const other = (i) => ({ title: "Dubai Metro Blue Line milestone " + i, outlet: "The National", url: "https://www.thenationalnews.com/x" + i,
  summary: "The Blue Line reached milestone " + i + ".", published: nowIso, seen: nowIso, score: 20, entities: [{ name: "Blue Line " + i, type: "infrastructure" }] });

let serve = FIVE, kt = [], ktCalls = 0, sent = [], owner = [], gen = null;
globalThis.fetch = async (u, o) => {
  const url = String(u && u.url ? u.url : u);
  if (/anthropic/i.test(url)) {
    let body = {}; try { body = JSON.parse(String(o && o.body || "{}")); } catch (e) {}
    const sys = typeof body.system === "string" ? body.system : JSON.stringify(body.system || "");
    let text;
    if (/last quality check/.test(sys)) { let today = []; try { const m = body.messages[0].content; today = JSON.parse(typeof m === "string" ? m : m[0].text).today; } catch (e) {} text = JSON.stringify({ verdicts: today.map(t => ({ angle: t.angle, repeat: false, why: "new" })) }); }
    else if (/KHALEEJ TIMES ANGLE/.test(sys)) { ktCalls++; text = JSON.stringify({ angles: kt }); }
    else if (/TOP-UP/.test(sys)) text = JSON.stringify({ angles: [] });
    else if (/rewrite social-post hooks/.test(sys)) text = JSON.stringify({ items: [] });
    else { if (sys.startsWith("You pick FIVE")) gen = body; text = JSON.stringify({ angles: serve }); }
    return new Response(JSON.stringify({ content: [{ type: "text", text }], stop_reason: "end_turn" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  if (/graph\.facebook\.com/.test(url)) { let b = {}; try { b = JSON.parse(String(o && o.body || "{}")); } catch (e) {} sent.push(b); return new Response(JSON.stringify({ messages: [{ id: "wamid." + sent.length }] }), { status: 200 }); }
  if (/owner_note/.test(url)) { try { owner.push(JSON.parse(String(o.body)).text); } catch (e) {} return new Response("sent", { status: 200 }); }
  return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
};
const READ = "owner_admin_key_never_in_client_links_0001";
const run = async (opts) => {
  opts = opts || {}; serve = opts.serve || FIVE; kt = opts.kt || []; ktCalls = 0; sent = []; owner = []; gen = null;
  const store = new Map([["mkt_latest", JSON.stringify({ generatedAt: new Date().toISOString() })], ["mkt_feed_famhist", "[]"], ["wa_owner_last_in", new Date().toISOString()],
    ["news_live", JSON.stringify({ items: opts.news || [], feeds: {} })]]);
  const KV = { async get(k, t) { if (!store.has(k)) return null; const v = store.get(k); return t === "json" ? JSON.parse(v) : v; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); },
    async list(o) { return { keys: [...store.keys()].filter((k) => !o || !o.prefix || k.startsWith(o.prefix)).map((name) => ({ name })), list_complete: true }; } };
  const env = { MEETINGS: KV, AI: { run: async () => ({ response: "{}" }) }, READ_KEY: READ, MARKET_BRIEF: "on", ANTHROPIC_API_KEY: "test-only-not-a-key", PUBLIC_ORIGIN: "https://x",
    WA_ALLOWED: "971565484397", WHATSAPP_TOKEN: "t", WA_PHONE_ID: "1", FEED_SCENES: "on", OWNER_NOTE_URL: "https://mc/owner_note", INGEST_TOKEN: "i", LIVE_NEWS: "on" };
  const r = await worker.fetch(new Request("https://x/feed_test?key=" + READ + (opts.dry ? "&dry=1" : "")), env, { waitUntil() {} });
  const out = await r.text();
  let qa = null; try { qa = JSON.parse(store.get("mkt_feed_qa") || "null"); } catch (e) {}
  let data = null; try { const m = gen.messages[0].content; data = JSON.parse(typeof m === "string" ? m : m.map(x => x.text || "").join("")); } catch (e) {}
  return { out, qa, data, morning: sent.map(b => (b.text && b.text.body) || "").find(t => /Najma daily/.test(t)) || "" };
};

// K1
const k1 = await run({ news: [ktItem], kt: [KT_GOOD], dry: true });
ok(ktCalls === 1, "K1 with no Khaleej Times angle and a Khaleej Times story held, one is asked for");
ok(/10 daily journeys/.test(k1.out), "K1 and it is in the morning");
ok(k1.qa && /Khaleej Times: added in place of "Land for schools/.test(k1.qa.note), "K1 in place of a plan angle (three plan -> two), so the split holds: " + (k1.qa ? (k1.qa.note.match(/Khaleej Times:[^|]*/) || [""])[0] : ""));
const k1list = k1.out.split("QA:")[0];   // the QA line quotes the replaced hook, so check the angle list only
ok(!/Land for schools and health rises 25%/.test(k1list) && (k1list.match(/^\d\. /gm) || []).length === 5, "K1 still five angles");
// K2
const k2 = await run({ news: [ktItem], kt: [KT_BAD], dry: true });
ok(!/15%/.test(k2.out), "K2 a Khaleej Times angle whose number is not in the story is not admitted");
ok(k2.qa && /Khaleej Times: story held, but no angle passed \(news: a number in it is not in the Khaleej Times story/.test(k2.qa.note), "K2 and the QA line says why");
// K3
const k3 = await run({ news: [other(1)], kt: [KT_GOOD], dry: true });
ok(ktCalls === 0 && k3.qa && /Khaleej Times: NO story held/.test(k3.qa.note), "K3 no Khaleej Times story held: nothing asked, and the QA line says the feed was not reached");
// K4
const k4 = await run({ news: [ktItem], serve: [POP, WALK, KT_GOOD, SALES, RENTS], kt: [KT_BAD], dry: true });
ok(ktCalls === 0 && k4.qa && /Khaleej Times: in the set/.test(k4.qa.note), "K4 already carrying one: no extra call");
// K5
const many = Array.from({ length: 12 }, (_, i) => other(i));
const k5 = await run({ news: many.concat([ktItem]), kt: [KT_GOOD], dry: true });
ok(k5.data && Array.isArray(k5.data.news) && k5.data.news.some(n => n.outlet === "Khaleej Times"), "K5 a Khaleej Times story reaches the model even when twelve others outscore it (" + (k5.data && k5.data.news ? k5.data.news.length : 0) + " items)");
// K6
const k6 = await run({ news: [ktItem], kt: [KT_BAD] });
ok(k6.morning && !/15%/.test(k6.morning), "K6 the morning still goes without it");
ok(owner.some(t => /NO Khaleej Times angle: story held, but no angle passed/.test(t)), "K6 and Kendall is told there is no Khaleej Times angle, and why");

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
