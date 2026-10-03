// v295 - ALWAYS FIVE, FROM GUARANTEED SOURCE SLOTS; NOTHING INTERNAL REACHES HER (Kendall, 3 Oct 2026).
// What happened on 3 Oct (read from KV mkt_feed_qa): the model's five went to the gate, which removed 2 ("same idea as before"); the
// ledger refilled 2 and the gate removed 3 again; she was sent 2, and the text carried the whole technical note - "gate: removed 3
// (same idea as before: ...); QA agent removed 3". Kendall's design (restated): five slots, each filled BEFORE the gates and tied to
// real estate - Khaleej Times, an international / regional source, the Ejari contracts, a developer or project announcement, and
// infrastructure or a plan line - and the gates may only reject a figure or fact id she had in the last 14 days, after which the slot is
// refilled from the same source's next item.
// This runs the real worker on a morning where THE MODEL'S OWN FIVE ARE ALL REPEATS (the 3 Oct hooks, every figure in her history) and the
// QA agent calls everything "same idea", on her real 1 Oct 14-day history (v284_fixture.mjs):
//   F1/F2  all five slots are filled, one each, whatever the model and the QA agent do (F2: the 3 Oct gate sequence)
//   T1/T2  no gate / QA / ledger / removed-count wording reaches her; one friendly line; the owner gets the full note and the slot report
//   E1     a slot with no candidate is reported to the owner with the reason, and she still gets five
//   H1     the HARD rules hold: a repeated figure is refused and the slot is refilled from the same source's NEXT item
//   P1-P3  the property tie-in: a petrol item is rewritten with a property link, an infrastructure item names the area, an angle with no
//          property link is rejected (and its slot refilled)
//   W1     widening: plan lines unsaid for 30 days come back when nothing fresher fits infrastructure
//   C1     the honest count: fewer than five exist -> the header, the note and the scene offer say so, the owner is told why
//   R1     "Building this morning's five" no longer claims a number it does not know
// NEGATIVE CONTROL: FEED_SRC=<a copy of origin/dewa-screens (v294) src/index.js> node test/test_v295_feed_five.mjs - most assertions fail there.
// Tier 2 (the same fact again, only if its figure changed) is not exercised end to end.
import fs from "node:fs";
import zlib from "node:zlib";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { FAMHIST_1OCT, HIST_1OCT, LATEST_1OCT } from "./v284_fixture.mjs";
const SRCPATH = process.env.FEED_SRC ? path.resolve(process.env.FEED_SRC) : path.resolve(new URL("../src/index.js", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const worker = (await import(pathToFileURL(SRCPATH).href)).default;

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };
const A = (hook, figure, source, family, reader, extra) => Object.assign({ hook, figure, source, buyer: "b", family, reader }, extra || {});
const DAY = 86400000, iso = (ms) => new Date(ms).toISOString().slice(0, 10), day = (n) => iso(Date.now() - n * DAY);
const FAMH = FAMHIST_1OCT.map(({ ago, ...x }) => Object.assign(x, { d: day(ago) }));
const nowIso = new Date().toISOString();
const ent = (name, type) => ({ name, type });
const story = (outlet, title, summary, entities) => ({ title, outlet, url: "https://example.test/" + encodeURIComponent(title).slice(0, 30), summary: summary || "", published: nowIso, seen: nowIso, score: 8, entities: entities || [], feeds: [] });
const KT1 = story("Khaleej Times", "UAE petrol prices jump 16%: Residents plan Dubai Metro trips, fewer office days", "", [ent("Dubai Metro", "infrastructure")]);
const KT2 = story("Khaleej Times", "Will monthly rent become the new norm in Dubai?", "Flexi Rent lets tenants pay monthly or quarterly.", []);
const FT = story("Financial Times", "Gulf investors pile into property as oil slides to $71 a barrel", "Investors in the Gulf are moving money into Dubai homes as Brent falls.", []);
const BBC = story("BBC News", "Oil prices ease as OPEC weighs output", "", []);
const DEV = story("Arabian Business", "Emaar launches new residences in Dubai Hills", "", [ent("Emaar", "developer"), ent("Dubai Hills", "district")]);
const RAIL = story("The National", "Etihad Rail passenger service opens a Dubai station linking Jebel Ali", "", [ent("Etihad Rail", "infrastructure"), ent("Jebel Ali", "district")]);
const NEWS = [KT1, KT2, FT, BBC, DEV, RAIL];
const EJ_ROWS = []; for (let i = 14; i >= 0; i--) { const d = day(i); for (const [area, n] of [["Al Barsha South Fourth", 40], ["Business Bay", 30], ["Al Warsan First", 25]]) { EJ_ROWS.push([d, area, "Flat", "New", i === 0 ? 1 : n]); EJ_ROWS.push([d, area, "Flat", "Renew", i === 0 ? 1 : n - 5]); } }
const EJ_GZ = zlib.gzipSync(Buffer.from(JSON.stringify({ as_of: day(0), basis: "filed", source: "DLD open data", caveat: "test", per_area: { fields: ["date", "area", "sub_type", "reg_type", "contracts"], rows: EJ_ROWS } })));

// the five the 3 Oct model produced (hooks and figures as stored in mkt_feed_audit / the stored QA record)
const TODAY = [
  A("Five centres are planned, each sized for 1 to 1.5 million people. It means Deira, Downtown, Dubai Marina, Expo 2020 and Silicon Oasis carry the growth.", "5 urban centres, 1 to 1.5 million people each", "Dubai Media Office, 4 Mar 2025", "growth_plan", "authority"),
  A("Fuel prices moved. Over 50 kilometres, it shows in every delivery and recovery fee. That's what it costs you now, Khaleej Times reports, 3 Oct 2026.", "50 kilometres", "reported by Khaleej Times, 3 Oct 2026", "news", "move"),
  A("Public beaches grow 400%, by 2040. It means the waterfront stays shared, not gated.", "400%", "Dubai Media Office, 4 Mar 2025", "nature", "move"),
  A("Weekly sales count rose 0.6% in the last 7 days. The register is moving. buyers are signing, not waiting.", "+0.6%", "DLD Open Data, 2026-09-30", "volume", "invest"),
  A("Prices in Dubai Production City settled at AED 1,413 per sq ft, from 5 Aug to 30 Sep. It means the floor there is clear.", "AED 1,413 per sq ft", "DLD Open Data, 2026-08-05 to 2026-09-30", "prices", "authority"),
];
const fk = (x) => String(x.figure).toLowerCase().replace(/[^0-9a-z%.]/g, "").slice(0, 40);
const nums = (x) => [...new Set([...(String(x.hook || "") + " " + String(x.figure)).matchAll(/\d[\d,]*(?:\.\d+)?/g)].map(m => m[0].replace(/,/g, "")).filter(v => v.replace(".", "").length >= 3 && !/^20\d\d$/.test(v)))];
const rowOf = (x, ago) => ({ d: day(ago || 2), f: x.family, k: fk(x), n: nums(x), s: "" });
const REPEATS = FAMH.concat(TODAY.map(x => rowOf(x)));   // the model's own five are all figures she has had this week
const REAL_NOTE_WORDS = ["gate:", "removed 3", "QA agent", "same idea as before", "ledger:", "five-floor", "fact ledger", "voice repaired", "Khaleej Times: added", "slots:"];

let rewriteFn = () => [], sent = [], owner = [], qaCalls = 0, qaFn = () => [], serve = TODAY, gd = null;
globalThis.fetch = async (u, o) => {
  const url = String(u && u.url ? u.url : u);
  if (/anthropic/i.test(url)) {
    let body = {}; try { body = JSON.parse(String(o && o.body || "{}")); } catch (e) {}
    const sys = typeof body.system === "string" ? body.system : JSON.stringify(body.system || "");
    const m = body.messages && body.messages[0] && body.messages[0].content; const user = typeof m === "string" ? m : (m && m[0] && m[0].text) || "";
    let text;
    if (/last quality check/.test(sys)) { qaCalls++; let today = []; try { today = JSON.parse(user).today; } catch (e) {} const v = qaFn(today, qaCalls); text = JSON.stringify({ verdicts: today.map(t => ({ angle: t.angle, repeat: v.includes(t.angle), why: v.includes(t.angle) ? "Repeats the recent angle (same theme)" : "new" })) }); }
    else if (/PROPERTY TIE-IN REWRITE/.test(sys)) { let u = {}; try { u = JSON.parse(user); } catch (e) {} text = JSON.stringify({ items: rewriteFn(u.angles || []) }); }
    else if (/rewrite social-post hooks/.test(sys)) text = JSON.stringify({ items: [] });
    else { if (/You pick FIVE/.test(sys) && !/REPAIR|TOP-UP|KHALEEJ TIMES ANGLE/.test(sys) && gd === null) gd = user; text = JSON.stringify({ angles: serve }); }
    return new Response(JSON.stringify({ content: [{ type: "text", text }], stop_reason: "end_turn" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  if (/graph\.facebook\.com/.test(url)) { let b = {}; try { b = JSON.parse(String(o && o.body || "{}")); } catch (e) {} sent.push(b); return new Response(JSON.stringify({ messages: [{ id: "wamid." + sent.length }] }), { status: 200 }); }
  if (/owner_note/.test(url)) { try { owner.push(JSON.parse(String(o.body)).text); } catch (e) {} return new Response("sent", { status: 200 }); }
  return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
};
const READ = "owner_admin_key_never_in_client_links_0001";
const run = async (opts) => {
  opts = opts || {}; sent = []; owner = []; qaCalls = 0; gd = null; rewriteFn = opts.rewrite || (() => []); qaFn = opts.qa || (() => []); serve = opts.serve || TODAY;
  const famh0 = opts.famh || REPEATS;
  const store = new Map([["mkt_latest", JSON.stringify(Object.assign({ generatedAt: nowIso }, opts.latest || LATEST_1OCT))], ["mkt_feed_famhist", JSON.stringify(famh0)], ["mkt_feed_hist", JSON.stringify(opts.hist || HIST_1OCT)],
    ["wa_owner_last_in", nowIso], ...(opts.bare ? [] : [["news_live", JSON.stringify({ items: opts.news || NEWS, feeds: {} })]])]);
  const bin = new Map(opts.bare ? [] : [["img_ejari_filed_dubai", EJ_GZ]]);
  const KV = { async get(k, t) { if (bin.has(k)) { const b = bin.get(k); return t === "arrayBuffer" ? b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) : b.toString("latin1"); }
      if (!store.has(k)) return null; const v = store.get(k); return t === "json" ? JSON.parse(v) : t === "arrayBuffer" ? new TextEncoder().encode(v).buffer : v; },
    async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); },
    async list(o) { return { keys: [...store.keys()].filter((k) => !o || !o.prefix || k.startsWith(o.prefix)).map((name) => ({ name })), list_complete: true }; } };
  const env = { MEETINGS: KV, AI: { run: async () => ({ response: "{}" }) }, READ_KEY: READ, MARKET_BRIEF: "on", ANTHROPIC_API_KEY: "test-only-not-a-key", PUBLIC_ORIGIN: "https://x",
    WA_ALLOWED: "971565484397", WHATSAPP_TOKEN: "t", WA_PHONE_ID: "1", LIVE_NEWS: "on", FEED_SCENES: "on", OWNER_NOTE_URL: "https://mc/owner_note", INGEST_TOKEN: "i" };
  const r = await worker.fetch(new Request("https://x/feed_test?key=" + READ), env, { waitUntil() {} });
  await r.text();
  const morning = sent.map(b => (b.text && b.text.body) || "").find(t => /Najma daily/.test(t)) || "";
  const everything = sent.map(b => JSON.stringify(b)).join("\n");
  let qa = null; try { qa = JSON.parse(store.get("mkt_feed_qa") || "null"); } catch (e) {}
  const famh = JSON.parse(store.get("mkt_feed_famhist") || "[]"); const todays = famh.slice(0, famh.length - famh0.length);
  const items = [...morning.matchAll(/^\d️?⃣ (?:\u{1F3E1} )?(.*)\n {5}(.*?) · (.*)$/gmu)].map(m => ({ hook: m[1], figure: m[2], source: m[3] }));
  let gdj = null; try { gdj = JSON.parse(gd || "null"); } catch (e) {}
  return { morning, everything, qa, todays, items, gd: gdj, ownerAll: owner.join("\n---\n") };
};
const isPlan = (a) => /Dubai Media Office|UAE Government/i.test(a.source);
const flagAll = (today) => today.map(t => t.angle);
const showQA = (r) => console.log("    sent " + r.items.length + " | " + r.items.map(a => (isPlan(a) ? "P " : "R ") + a.figure.slice(0, 26) + " <" + a.source.slice(0, 22) + ">").join(" | "));
const PROP = /\b(buyers?|tenants?|investors?|renters?|landlords?|homes?|propert(?:y|ies)|apartments?|villas?|rents?|rental|yields?|off-plan|real estate|housing|where to live|commut\w*|sales?|sold|transactions?|leases?|mortgages?)\b/i;
// the five slots, told apart by what each angle is built on
const SLOT = {
  kt: (a) => /Khaleej Times/i.test(a.source),
  intl: (a) => /Financial Times|BBC/i.test(a.source),
  ejari: (a) => /Ejari/i.test(a.source),
  developer: (a) => /Emaar|Arabian Business|availability sheets|MEED|project register/i.test(a.source + " " + a.hook),
  infra: (a) => /Etihad Rail|Dubai Media Office|RTA|Dubai Culture|2040/i.test(a.source + " " + a.hook),
};
const slotsOf = (items) => Object.keys(SLOT).filter(k => items.some(SLOT[k]));

// ---- F1. the model's five are ALL repeats and the QA agent calls everything the same idea: five slots, five angles --------------------
const f1 = await run({ qa: flagAll }); showQA(f1);
ok(f1.items.length === 5 && /five you could post today/.test(f1.morning), "F1 five angles, header says five: " + f1.items.length);
ok(slotsOf(f1.items).length === 5, "F1 every slot is filled - kt, intl, ejari, developer, infra: " + slotsOf(f1.items).join(","));
ok(!f1.items.some(a => TODAY.some(t => fk(t) === fk(a))), "F1 none of the model's five repeats came through (every figure was in her history)");
ok(f1.qa && f1.qa.slots && !/EMPTY/.test(JSON.stringify(f1.qa.slots.slots)) && f1.qa.sent === 5 && f1.qa.short === false, "F1 mkt_feed_qa records the slots and sent 5: " + (f1.qa && f1.qa.slots ? f1.qa.slots.summary.slice(0, 160) : ""));
ok(f1.todays.length === 5, "F1 the five she got are the five written to her history: " + f1.todays.length);
ok(f1.items.every(a => PROP.test(a.hook)), "F1 every angle is tied to real estate: " + f1.items.filter(a => !PROP.test(a.hook)).map(a => a.hook.slice(0, 40)).join(" | "));
const news = f1.items.filter(a => SLOT.kt(a) || SLOT.intl(a) || /Arabian Business|The National/.test(a.source));
ok(news.length >= 3 && news.every(a => /\b(?:in|across|near|around|at) [A-Z][A-Za-z]+/.test(a.hook)), "F1 each news angle names the area it affects: " + news.map(a => (a.hook.match(/\b(?:in|across|near|around|at) [A-Z][A-Za-z ]+/) || ["-"])[0]).join(" | "));
ok(f1.items.filter(isPlan).length <= 1, "F1 only the infrastructure / plan slot may be a plan line: " + f1.items.filter(isPlan).length);

// ---- F2. the 3 Oct gate sequence: the gate removes 2, then everything the refill brought -----------------------------------------------------
const f2 = await run({ qa: (today, n) => n === 1 ? today.slice(0, 2).map(t => t.angle) : flagAll(today) }); showQA(f2);
ok(f2.items.length === 5 && slotsOf(f2.items).length === 5, "F2 the same five slots again (the 3 Oct run sent 2): " + f2.items.length + " / " + slotsOf(f2.items).join(","));

// ---- T1/T2. nothing internal reaches her -------------------------------------------------------------------------------------------------
ok(REAL_NOTE_WORDS.every(w => !f1.everything.includes(w)), "T1 none of the 3 Oct note's wording (or the slot report) is anywhere in what she receives: " + REAL_NOTE_WORDS.filter(w => f1.everything.includes(w)).join(", "));
ok(!/\bgate\b|QA agent|\bledger\b|removed \d|same idea|top-up|refill|floor|slot/i.test(f1.morning), "T1 the morning text carries no gate / QA / ledger / slot / removed wording");
ok(/✔ Checked against the registers: fresh figures, nothing repeated from the last two weeks\./.test(f1.morning), "T1 one friendly line instead: " + ((f1.morning.match(/_✔[^_]*_/) || [""])[0]));
ok(f1.qa && /ledger: \d+ facts/.test(f1.qa.note) && /slots: kt/.test(f1.qa.note), "T1 the full technical note is kept in mkt_feed_qa");
ok(/Full note:/.test(f1.ownerAll) && /ledger: \d+ facts/.test(f1.ownerAll) && /SLOTS: kt /.test(f1.ownerAll), "T1 and goes to the OWNER in full, with the slot report");
ok(/Same-theme warnings, kept/.test(f1.ownerAll), "T1 the same-theme verdicts reach the owner as warnings, not removals: " + ((f1.ownerAll.match(/Same-theme warnings, kept[^\n]{0,100}/) || [""])[0]));
const t2 = await run({ qa: (today, n) => n === 1 ? today.slice(0, 2).map(t => t.angle) : [] });
ok(t2.morning && !/gate|QA agent|removed|ledger|same idea|checked: /i.test(t2.morning) && /Checked against the registers/.test(t2.morning), "T2 a morning whose QA agent flagged two: only the friendly line reaches her");
ok(/flagged 2 as the same theme and kept them/.test(t2.ownerAll) && /Full note:/.test(t2.ownerAll), "T2 the owner gets the counts");

// ---- E1. a slot with no candidate: said to the owner with the reason, and she still gets five -----------------------------------------------
const e1 = await run({ qa: flagAll, news: [KT1, KT2, DEV, RAIL] }); showQA(e1);
ok(e1.items.length === 5, "E1 with no international story at all she still gets five: " + e1.items.length);
ok(/NOT FILLED: intl \(international \/ regional news\): no candidate in the pool/.test(e1.ownerAll), "E1 the owner is told which slot could not be filled, and why: " + ((e1.ownerAll.match(/NOT FILLED[^\n|]{0,120}/) || [""])[0]));
ok(!/NOT FILLED|intl/.test(e1.morning), "E1 and she is told none of it");

// ---- H1. hard rules: a repeated figure is refused, the slot refills from the SAME source's next item ---------------------------------------
const base = await run({ qa: flagAll });
const BF = (base.gd && base.gd.facts) || [];
const ejAreas = BF.filter(f => /^ejari:area/.test(f.id)), got1 = f1.items.find(SLOT.ejari);
const ktGot = f1.items.find(SLOT.kt);
const ban = (f) => ({ d: day(2), f: f.family, k: String(f.figure).toLowerCase().replace(/[^0-9a-z%.]/g, "").slice(0, 40), n: [], s: "", id: f.id });
const h1 = await run({ qa: flagAll, famh: REPEATS.concat([{ d: day(2), f: "district", k: "175newleases", n: ["175"], s: "", id: "x" }, { d: day(2), f: "district", k: "petrolpriserise", n: [], s: "" }]) }); showQA(h1);
ok(h1.items.length === 5 && slotsOf(h1.items).length === 5, "H1 a figure she had two days ago is refused (the Ejari 175 and the Khaleej petrol story banned) and every slot is still filled: " + slotsOf(h1.items).join(","));
ok(!h1.items.some(a => /175 new leases/.test(a.figure)), "H1 the banned Ejari figure is not sent: the slot took the same source's next item (" + ((h1.items.find(SLOT.ejari) || {}).figure || "-") + ")");
const seenNums = new Set(REPEATS.flatMap(x => x.n || []));
ok(!h1.items.some(a => nums(a).some(n => seenNums.has(n))), "H1 no angle shares a number with her last 14 days");
ok(h1.items.every(a => a.source && a.source.trim().length > 3), "H1 every angle has a source");
const REPEAT = A("Off-plan homes took 14,195 sales in 8 weeks against 7,296 ready.", "14,195 off-plan sales", "DLD Open Data, 2026-08-05 to 2026-09-30", "offplan_ready", "invest");
const h2 = await run({ serve: [REPEAT, REPEAT, REPEAT, REPEAT, REPEAT], famh: REPEATS.concat([{ d: day(3), f: "offplan_ready", k: "14195offplansales", n: ["14195"], s: "offplan_ready:-" }]) });
ok(!/14,195/.test(h2.morning) && h2.items.length === 5, "H2 a model angle repeating a figure from her last 14 days is not sent, and the morning is five: " + h2.items.length);

// ---- P. the property tie-in --------------------------------------------------------------------------------------------------------------------
const PETROL = A("Petrol prices jump 16%, and it shows in every delivery and recovery fee.", "16% petrol price rise", "reported by Khaleej Times, 1 Oct 2026", "news", "move");
const p1 = await run({ serve: [PETROL].concat(TODAY.slice(2)), famh: FAMH, rewrite: (bad) => bad.filter(b => /Petrol/.test(b.hook)).map(b => ({ i: b.i, hook: "Petrol prices jump 16%. Tenants and buyers in Business Bay will weigh homes closer to a metro station, for a shorter commute." })) }); showQA(p1);
ok(/closer to a metro station/.test(p1.morning) && !/delivery and recovery fee/.test(p1.morning), "P1 a petrol-price item with no property link is REWRITTEN with one (metro, commute, the area), not dropped");
ok(/property tie-in: rewrote with a property link: Petrol/.test(p1.qa ? p1.qa.note : ""), "P1 and the owner's note records the rewrite");
const p1b = await run({ serve: [PETROL].concat(TODAY.slice(2)), famh: FAMH, rewrite: (bad) => bad.map(b => ({ i: b.i, hook: "Petrol prices jump 99%, tenants and buyers will move." })) });
ok(!/99%/.test(p1b.morning), "P1 a rewrite that invents a number is refused");
const rail = f1.items.find(a => /Etihad Rail/.test(a.hook));
ok(rail && /Jebel Ali/.test(rail.hook) && PROP.test(rail.hook), "P2 an infrastructure item names the area it lifts and the property link: " + (rail ? rail.hook.slice(0, 170) : "(no Etihad Rail angle)"));
const NOLINK = A("Nobody expected this: 1,731 handovers landed in September.", "1,731 handovers", "DLD project register, 2026-09-30", "handover_supply", "invest");
const p3 = await run({ serve: [NOLINK].concat(TODAY.slice(1, 5)), famh: FAMH, rewrite: () => [] }); showQA(p3);
ok(!/Nobody expected this/.test(p3.morning), "P3 an angle with no property link, and none the model can supply, is rejected");
ok(/REJECTED, no property link[^|]*Nobody/.test(p3.qa ? p3.qa.note : "") && p3.items.length === 5 && slotsOf(p3.items).length >= 4, "P3 the QA line says why, and its slot is refilled from the ledger: " + p3.items.length + " / " + slotsOf(p3.items).join(","));

// ---- W1. widening: infrastructure may be a plan line unsaid for 30 days when nothing fresher fits ----------------------------------------------
const W_OPTS = { qa: flagAll, news: [KT1, KT2, FT, DEV], latest: Object.assign({}, LATEST_1OCT, { cityLife: null }) };   // nothing fresher than a plan line fits infrastructure
let hist = HIST_1OCT.slice(), probe = null;
for (let k = 0; k < 8; k++) { probe = await run(Object.assign({ hist }, W_OPTS)); const pf = ((probe.gd && probe.gd.facts) || []).filter(f => f.block === "dubai2040"); if (!pf.length) break; hist = pf.map(f => f.says + " " + f.figure).concat(hist); }
const w1 = await run(Object.assign({}, W_OPTS, { hist: hist.slice(0, 40) })); showQA(w1);
ok(w1.items.length === 5 && w1.items.some(isPlan) && w1.qa && /infra ledger .plan lines unsaid for 30 days./.test(w1.qa.note), "W1 with every plan line rested by her recent hooks and nothing else for infrastructure, the slot widens to a plan line unsaid for 30 days: " + ((w1.qa && w1.qa.note.match(/infra [^,;|]*/) || [""])[0]));
const planKeys = new Set(FAMH.map(x => x.k));
ok(!w1.items.filter(isPlan).some(a => planKeys.has(fk(a))), "W1 and it is not a plan line she had in her last 14 days");

// ---- C1. the honest count: nothing but the plan exists -> fewer than five, said plainly -----------------------------------------------------
const c1 = await run({ qa: flagAll, latest: {}, famh: FAMH.concat(TODAY.map(x => rowOf(x))), hist: [], bare: true }); showQA(c1);
const n1 = c1.items.length;
ok(n1 >= 1 && n1 < 5, "C1 with only the plan to draw on, fewer than five exist: " + n1);
ok(new RegExp("Najma daily — " + n1 + " you could post today").test(c1.morning), "C1 the header says the real number (" + n1 + "), not five");
ok(/not five\./.test(c1.morning) && new RegExp("I have " + n1 + " fresh one").test(c1.morning), "C1 and her line says it plainly: " + ((c1.morning.match(/_✔[^_]*_/) || [""])[0]));
ok(!/five/i.test(c1.morning.replace(/not five\./, "")), "C1 the word five appears nowhere else in her text");
ok(/Make all \d/.test(c1.everything) && !/Make all five/.test(c1.everything), "C1 the pictures offer says the real number too");
ok(/SHORT: she was told/.test(c1.ownerAll) && /NOT FILLED: kt/.test(c1.ownerAll), "C1 the owner is told why, slot by slot: " + ((c1.ownerAll.match(/SHORT:[^\n]{0,120}/) || [""])[0]));
ok(REAL_NOTE_WORDS.every(w => !c1.everything.includes(w)), "C1 still nothing internal in what she receives");

// ---- R1. the on-demand header no longer promises a number it does not know ---------------------------------------------------------------
const srcText = fs.readFileSync(SRCPATH, "latin1");
ok(!/Building this morning's five/.test(srcText), "R1 \"Building this morning's five\" is gone from the worker (the list's own header says the real number)");

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
