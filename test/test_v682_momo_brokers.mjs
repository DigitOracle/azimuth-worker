// v682 - the Brokers card on Najjuko's Momo: the DLD broker register from KV (gzipped), search as she types, ranking (district activity
// first, expired last, amber within 60 days), the phone normaliser, the key gate (401 without her key), the no-activity fallback, her
// per-broker memory, the WhatsApp draft built from her search, and no emoji in the card source.
// Through the REAL worker entry point (src/index.js) with a fake KV. FAKE keys and FAKE data only (the worker repo is public).
import fs from "node:fs";
import zlib from "node:zlib";
const worker = (await import("../src/index.js")).default;
const B = await import("../src/work_brokers.js");
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };
const store = new Map();
const KV = { get: async (k, t) => { if (!store.has(k)) return null; const v = store.get(k); return t === "arrayBuffer" ? (typeof v === "string" ? new TextEncoder().encode(v).buffer : v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength)) : (typeof v === "string" ? v : new TextDecoder().decode(v)); },
  put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); },
  list: async ({ prefix } = {}) => ({ keys: [...store.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) };
const NAJ = "ins_najjuko_TESTKEY0123456789abcd", KEN = "ins_kendall_TESTKEY0123456789abcd", OTHER = "ins_someoneelse_0123456789abcdefgh", READ = "readkey_TEST_0123456789abcdef";
const env = { MEETINGS: KV, INSIDER_KEY: [NAJ, KEN, OTHER].join(","), READ_KEY: READ };
const ctx = { waitUntil() {}, passThroughOnException() {} };
const get = (path, key) => worker.fetch(new Request("https://w" + path + (key === undefined ? "" : (path.includes("?") ? "&" : "?") + "key=" + encodeURIComponent(key))), env, ctx);
const post = (path, key, body) => worker.fetch(new Request("https://w" + path + "?key=" + encodeURIComponent(key), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), env, ctx);
const TODAY = B.dubaiToday();   // the fixture dates are RELATIVE to today so the test never drifts
const D = (n) => new Date(Date.parse(TODAY + "T00:00:00Z") + n * 86400e3).toISOString().slice(0, 10);
const X_DM = D(63), X_OK = D(358), X_EXP = D(-32), X_AMB = D(49), X_FAR = D(800);

// ---- a fake register: 7 cards, 3 offices (row arrays in the loader's key order)
const KEYS = ["c", "n", "a", "i", "x", "r", "l", "o", "oa", "oi", "ox", "ori", "orr", "cri", "cr", "w", "p", "m", "e", "ph", "lg"];
const row = (o) => KEYS.map((k) => (k in o ? o[k] : (["ori", "cri", "w", "lg"].includes(k) ? 0 : "")));
const ROWS = [
  row({ c: "1001", n: "DMITRII BOBYLEV", a: "دميترى", i: "2023-05-10", x: X_DM, r: "9001", o: "NEGINSKIY BUREAU REAL ESTATE L.L.C", ori: 2, orr: "BRONZE", cri: 8, cr: "Three Stars", p: "971|043334444", m: "971|0501112222", e: "dmitrii@example.com" }),
  row({ c: "1002", n: "OMAR YOUSSEF OMAR", i: "2020-01-01", x: X_OK, r: "9002", o: "AL HIRMAS AL THAHABI REAL ESTATE", ori: 4, orr: "GOLD", cri: 7, cr: "Two Star", m: "0502223333" }),
  row({ c: "1003", n: "ABDULMAJID HUSSAIN FAYAD", i: "2015-01-01", x: X_OK, r: "9002", o: "AL HIRMAS AL THAHABI REAL ESTATE", ori: 4, orr: "GOLD", cri: 10, cr: "Five Stars", m: "0503334444", w: 2 }),
  row({ c: "1004", n: "RANA KHALED", i: "2018-01-01", x: X_EXP, r: "9003", o: "OLD LINE PROPERTIES", ori: 1, orr: "GENERAL", cri: 5, cr: "GENERAL", m: "0504445555" }),   // expired
  row({ c: "1005", n: "SARA AHMED", i: "2021-01-01", x: X_AMB, r: "9003", o: "OLD LINE PROPERTIES", ori: 1, orr: "GENERAL", cri: 9, cr: "Four Stars", m: "0505556666" }),   // 49 days -> amber
  row({ c: "1006", n: "JOHN NOPHONE", i: "2021-01-01", x: X_FAR, r: "9001", o: "NEGINSKIY BUREAU REAL ESTATE L.L.C", ori: 2, orr: "BRONZE", cri: 5, cr: "GENERAL" }),
  row({ c: "1007", n: "ZED GENERAL", i: "2021-01-01", x: X_FAR, r: "9002", o: "AL HIRMAS AL THAHABI REAL ESTATE", ori: 4, orr: "GOLD", cri: 5, cr: "GENERAL", m: "0507778888" }),
];
const DOC = { v: 1, checked: "2026-11-01", keys: KEYS, rows: ROWS };
store.set("momo_brokers", zlib.gzipSync(Buffer.from(JSON.stringify(DOC))));
store.set("momo_brokers_meta", JSON.stringify({ checked: "2026-11-01", cards: 7, expiring_30: 0 }));

// 1. pure helpers: the phone normaliser
ok(B.normPhone("971|0506555800") === "+971506555800", "971|0506555800 -> +971506555800", B.normPhone("971|0506555800"));
ok(B.normPhone("0509166543") === "+971509166543", "0509166543 -> +971509166543");
ok(B.normPhone("971|52-7207866") === "+971527207866", "971|52-7207866 -> +971527207866", B.normPhone("971|52-7207866"));
ok(B.normPhone("+971 50 123 4567") === "+971501234567", "+971 50 123 4567 -> +971501234567");
ok(B.normPhone("00971501234567") === "+971501234567", "00971... -> +971...");
ok(B.normPhone("042340007") === "+97142340007", "a landline 04 -> +9714");
ok(B.normPhone("0") === "" && B.normPhone("") === "" && B.normPhone("-") === "", "0, empty and - give nothing");
ok(B.isMobile("+971501234567") && !B.isMobile("+97142340007"), "isMobile tells 05 from 04");
ok(B.waLink("+971501234567", "hi there") === "https://wa.me/971501234567?text=hi%20there", "wa.me link has digits only and the text", B.waLink("+971501234567", "hi there"));

// 2. the search tokeniser
ok(JSON.stringify(B.tokenise("  Omar  YOUSSEF ")) === '["omar","youssef"]', "lowercase words", B.tokenise("  Omar  YOUSSEF "));
ok(JSON.stringify(B.tokenise("+971 50 222 3333")) === '["502223333"]' || JSON.stringify(B.tokenise("+971502223333")) === '["502223333"]', "a phone becomes its local digits", B.tokenise("+971502223333"));
ok(JSON.stringify(B.tokenise("050-222-3333")) === '["502223333"]', "0xx-xxx-xxxx loses the 0 and the dashes", B.tokenise("050-222-3333"));
ok(JSON.stringify(B.tokenise("Al-Hirmas")) === '["al","hirmas"]', "hyphens split", B.tokenise("Al-Hirmas"));
ok(B.norm("Café") === "cafe", "accents fold");

// 3. licence status
ok(B.licence(D(358), TODAY).state === "valid", "a year out is valid");
ok(B.licence(D(49), TODAY).state === "soon" && B.licence(D(49), TODAY).days === 49, "49 days out is amber (soon)", B.licence(D(49), TODAY));
ok(B.licence(D(60), TODAY).state === "soon" && B.licence(D(60), TODAY).days === 60, "exactly 60 days is still amber", B.licence(D(60), TODAY));
ok(B.licence(D(61), TODAY).state === "valid" && B.licence(D(61), TODAY).days === 61, "61 days is green");
ok(B.licence(D(-32), TODAY).state === "expired", "a past date is expired");
ok(B.licence("", TODAY).state === "unknown" && B.licence("0001-01-01", TODAY).state === "unknown" || B.licence("", TODAY).state === "unknown", "no date is unknown");
ok(B.starsOf(10) === 5 && B.starsOf(6) === 1 && B.starsOf(5) === 0 && B.starsOf(0) === 0, "card_rank_id 6..10 -> 1..5 stars, GENERAL 0");
ok(B.officeRank(4) === "Gold" && B.officeRank(3) === "Silver" && B.officeRank(2) === "Bronze" && B.officeRank(1) === "", "office_rank_id -> Gold/Silver/Bronze");
ok(B.titleCase("NEGINSKIY BUREAU REAL ESTATE L.L.C") === "Neginskiy Bureau Real Estate L.L.C", "office title case keeps L.L.C", B.titleCase("NEGINSKIY BUREAU REAL ESTATE L.L.C"));
ok(B.firstName("DMITRII BOBYLEV") === "Dmitrii" && B.initials("abdulmajid hussain fayad") === "AH", "first name and initials");

// 4. the query parser and the WhatsApp draft (three queries: district only; district + beds + rent + budget; empty)
{ const d1 = B.draftMessage("JVT", "", "DMITRII BOBYLEV");
  ok(d1 === "Hi Dmitrii, this is Najjuko from FN Realty. I have a client looking for a property in Jumeirah Village Triangle. Do you have anything available?", "district only", d1);
  const d2 = B.draftMessage("JVT 2 bed rent 120k", "", "DMITRII BOBYLEV");
  ok(d2 === "Hi Dmitrii, this is Najjuko from FN Realty. I have a client looking for a 2-bed rental in Jumeirah Village Triangle around AED 120k a year. Do you have anything available?", "district + beds + rent + budget", d2);
  const d3 = B.draftMessage("", "", "DMITRII BOBYLEV");
  ok(d3 === "Hi Dmitrii, this is Najjuko from FN Realty. I have a client looking for a property in Dubai. Do you have anything available?", "empty query falls back to a property in Dubai", d3);
  ok(B.draftMessage("", "", "") .startsWith("Hello, this is Najjuko"), "no name: Hello");
  const d4 = B.draftMessage("marina villa buy 2.5m", "", "SARA AHMED");
  ok(d4.includes("a villa to buy in Dubai Marina around AED 2.5m.") && !d4.includes("a year"), "sale budget has no 'a year'", d4);
  const d5 = B.draftMessage("studio rent", "Business Bay", "OMAR YOUSSEF OMAR");
  ok(d5.includes("a studio rental in Business Bay."), "the district filter wins and studio reads naturally", d5);
  const d6 = B.draftMessage("apartment", "", "x y");
  ok(d6.includes("an apartment in Dubai."), "an apartment (article)", d6);
  const d7 = B.draftMessage("2-bed", "", "x y");
  ok(d7.includes("a 2-bed home in Dubai."), "beds only -> home", d7);
  const p = B.parseQuery("Omar JVT 2 bed rent 120k");
  ok(p.district === "Jumeirah Village Triangle" && p.beds === 2 && p.mode === "rent" && p.budget === 120000 && JSON.stringify(p.text) === '["omar"]', "the name stays a search word; district, beds, mode and budget leave the search", p);
  ok(B.parseQuery("1.5m villa sale").budget === 1500000 && B.parseQuery("AED 900k").budget === 900000 && B.parseQuery("120000").budget === 120000, "1.5m, AED 900k and 120000 read as budgets");
  ok(B.parseQuery("Jumeirah Village Circle", ["Jumeirah Village Circle"]).district === "Jumeirah Village Circle", "a district name from the activity map is found");
  ok(B.parseQuery("Jumeirah Village Circle").district === "Jumeirah Village Circle", "a full district name is found from the alias list too");
}

// 5. the key gate: 401 without her key, for every address
for (const [lbl, k] of [["no key", undefined], ["wrong key", "wrong"], ["another insider", OTHER], ["Kendall's key", KEN], ["admin read key", READ]]) {
  for (const path of ["/momo/work/brokers", "/momo/work/brokers/api?q=omar", "/momo/work/brokers/1001", "/momo/work/brokers/office/9001"]) {
    const r = await get(path, k); ok(r.status === 401 || r.status === 404, path + " refuses " + lbl, r.status);
  }
  const r = await post("/momo/work/brokers/api", k || "", { action: "note", card: "1001", fav: true }); ok(r.status === 401 || r.status === 404, "POST note refuses " + lbl, r.status);
}
ok(!store.has("work_naj_brk_1001"), "nothing was written by the refused POSTs");

// 6. the page
{ const r = await get("/momo/work/brokers", NAJ); const h = await r.text();
  ok(r.status === 200 && h.includes("<h1>Brokers</h1>") && h.includes("id=bk_q") && h.includes("Checked 1 Nov 2026"), "her page opens with the search box and the Checked stamp", r.status);
  ok(h.includes('<div class="view on" id=bk_vs>'), "the search view is the one shown on load (v682 harness found it hidden)");
  for (const id of ["bk_c_active", "bk_c_valid", "bk_c_gold", "bk_c_stars", "bk_c_fav", "bk_s1", "bk_s2", "bk_s3", "bk_vb", "bk_vo", "bk_toast"]) ok(h.includes("id=" + id), "page has " + id);
  ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(h), "no emoji on the page");
  ok(!/claude|anthropic|openai|gpt|gemini|mistral|llama/i.test(h), "no AI model named on the page");
  const f = await (await get("/momo", NAJ)).text(); const c = [...f.matchAll(/<a class=card[^>]*href="([^"]+)"[^>]*>.*?<b>([^<]+)<\/b><\/a>/g)].map((m) => m[2]);
  ok(c[0] === "Product sheets" && c[1] === "Brokers", "Brokers is the second card on her front door, after Product sheets (v754)", c);
  const fk = await (await get("/momo", KEN)).text(); ok(!fk.includes("<b>Brokers</b>"), "Kendall's front door has no Brokers card"); }
// the source itself: no emoji
{ const src = fs.readFileSync(new URL("../src/work_brokers.js", import.meta.url), "utf8");
  ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(src), "no emoji characters in src/work_brokers.js");
  ok(!/claude|anthropic|openai|gpt-|gemini|mistral/i.test(src), "no AI model named in src/work_brokers.js"); }

// 7. search without activity: everyone found, expired last, valid-then-stars order, amber flagged, fallback text
const api = async (qs) => (await get("/momo/work/brokers/api?" + qs + "", NAJ)).json();
B._resetCache();
{ const d = await api("q=");
  ok(d.ok && d.total === 7 && d.items.length === 7 && d.activity === false, "empty query lists all 7; activity false while momo_broker_activity is absent", [d.total, d.activity]);
  ok(d.items[d.items.length - 1].c === "1004", "the expired card is last", d.items.map((x) => x.c));
  ok(d.items[0].c === "1003", "Five Stars + Gold office first when nobody has activity", d.items.map((x) => x.c));
  const sara = d.items.find((x) => x.c === "1005"); ok(sara.st.state === "soon" && sara.st.days === 49 && /49 days/.test(sara.st.label), "Sara's card is amber at 49 days", sara.st);
  ok(d.items.every((x) => x.act === null), "no activity -> act null on every card (the page says 'No listing activity found yet')");
  ok(d.stats.licensed === 7 && d.stats.active === null && d.stats.expiring === 0, "stats: licensed 7, active unknown, expiring 0", d.stats);
  const dm = d.items.find((x) => x.c === "1001"); ok(dm.mob === "+971501112222" && dm.tel === "+97143334444" && dm.wa.startsWith("https://wa.me/971501112222?text=Hi%20Dmitrii"), "Dmitrii's mobile, office line and WhatsApp link", [dm.mob, dm.tel, dm.wa.slice(0, 60)]);
  ok(dm.draft === "Hi Dmitrii, this is Najjuko from FN Realty. I have a client looking for a property in Dubai. Do you have anything available?", "the draft rides on every result", dm.draft);
  const jn = d.items.find((x) => x.c === "1006"); ok(jn.mob === "" && jn.wa === "", "no number -> no WhatsApp link (the button is greyed)"); }
{ const d = await api("q=omar"); ok(d.total === 1 && d.items[0].c === "1002", "name search: omar", d.items.map((x) => x.c)); }
{ const d = await api("q=hirmas"); ok(d.total === 3, "office search: hirmas finds its three brokers", d.total); }
{ const d = await api("q=1005"); ok(d.total === 1 && d.items[0].c === "1005", "card number search"); }
{ const d = await api("q=050 222 3333"); ok(d.total === 1 && d.items[0].c === "1002", "phone search in local form", d.items.map((x) => x.c)); }
{ const d = await api("q=%2B971502223333"); ok(d.total === 1 && d.items[0].c === "1002", "phone search in +971 form", d.items.map((x) => x.c)); }
{ const d = await api("q=JVT"); ok(d.total === 7 && d.district === "Jumeirah Village Triangle", "JVT alone resolves the district and lists everyone (no activity yet)", [d.total, d.district]);
  ok(d.items[0].draft.includes("in Jumeirah Village Triangle"), "the draft names the district she typed"); }
{ const d = await api("q=JVT%202%20bed%20rent%20120k%20omar"); ok(d.total === 1 && d.items[0].c === "1002" && d.parsed.beds === 2 && d.parsed.budget === 120000, "mixed query: the name filters, the rest shapes the draft", [d.total, d.parsed]);
  ok(d.items[0].draft === "Hi Omar, this is Najjuko from FN Realty. I have a client looking for a 2-bed rental in Jumeirah Village Triangle around AED 120k a year. Do you have anything available?", "the JVT 2 bed rent 120k draft", d.items[0].draft); }
{ const d = await api("q=&valid=1"); ok(d.total === 6 && !d.items.some((x) => x.c === "1004"), "Valid licence chip drops the expired card", d.total); }
{ const d = await api("q=&gold=1"); ok(d.total === 3 && d.items.every((x) => x.orank === "Gold"), "Gold office chip", d.total); }
{ const d = await api("q=&stars=4"); ok(d.total === 2 && d.items.map((x) => x.c).join() === "1003,1005", "4+ stars chip (Five Stars first, Four Stars amber second)", d.items.map((x) => x.c)); }
{ const d = await api("q=&active=1"); ok(d.total === 0, "Active chip with no activity data finds nobody (the chip is greyed on the page)", d.total); }
{ const d = await api("q=zzzz"); ok(d.total === 0 && d.items.length === 0, "nothing found is an empty list, not an error"); }
{ const r = await get("/momo/work/brokers/1001", NAJ); const x = await r.json();
  ok(r.status === 200 && x.n === "Dmitrii Bobylev" && x.a === "دميترى" && x.since === "May 2023" && x.expires === B.dmy(X_DM) && x.st.days === 63 && x.st.state === "valid", "the broker screen: names, since, expires with day count", [x.n, x.since, x.expires, x.st]);
  ok(x.districts.length === 0 && x.last_listed === "" && x.office && x.office.n === 2 && x.office.rank === "Bronze" && x.office.o === "Neginskiy Bureau Real Estate L.L.C", "no activity -> empty districts; office block counts 2 brokers", x.office);
  ok(x.e === "dmitrii@example.com" && x.tel_office === "+97143334444", "contacts: e-mail and office line"); }
{ const r = await get("/momo/work/brokers/office/9002", NAJ); const o = await r.json();
  ok(r.status === 200 && o.n === 3 && o.rank === "Gold" && o.brokers.length === 3 && o.brokers[0].c === "1003" && o.districts.length === 0 && o.active === 0, "the office screen: 3 brokers, Gold, Five Stars first, no districts yet", [o.n, o.rank, o.brokers.map((x) => x.c)]); }
ok((await get("/momo/work/brokers/9999", NAJ)).status === 404 && (await get("/momo/work/brokers/office/1", NAJ)).status === 404, "unknown card / office -> 404");

// 8. her memory: favourite, contacted, note, draft edit; favourites rise; the draft edit is kept per broker
{ let r = await post("/momo/work/brokers/api", NAJ, { action: "note", card: "1001", fav: true, note: "Fast replies, good with JVT rentals." }); const j = await r.json();
  ok(r.status === 200 && j.ok && j.note.fav === true && j.note.note === "Fast replies, good with JVT rentals.", "save fav + note", j);
  ok(store.has("work_naj_brk_1001") && JSON.parse(store.get("work_naj_brk_favs")).includes("1001"), "stored per broker under work_naj_brk_<card>, favs list updated");
  r = await post("/momo/work/brokers/api", NAJ, { action: "note", card: "1001", contacted: true }); ok((await r.json()).note.contacted === new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10), "contacted = today's Dubai date");
  r = await post("/momo/work/brokers/api", NAJ, { action: "note", card: "1001", draft: "Hi Dmitrii, Najjuko here - anything in JVT this week?" }); ok((await r.json()).note.draft.startsWith("Hi Dmitrii, Najjuko here"), "her edited draft is saved");
  const d = await api("q="); ok(d.items[0].c === "1001" && d.items[0].fav === true, "a favourite rises to the top of the search", d.items.map((x) => x.c));
  const dm = d.items[0]; ok(dm.draft === "Hi Dmitrii, Najjuko here - anything in JVT this week?" && dm.wa.includes(encodeURIComponent("Najjuko here")) && dm.draft_auto.includes("a property in Dubai"), "the result carries her edit, the link uses it, and the automatic draft is still offered", [dm.draft, dm.draft_auto]);
  const x = await (await get("/momo/work/brokers/1001?q=JVT", NAJ)).json(); ok(x.draft.startsWith("Hi Dmitrii, Najjuko here") && x.note === "Fast replies, good with JVT rentals." && x.fav && x.contacted, "the broker screen shows her memory", [x.draft, x.note]);
  const f = await api("q=&fav=1"); ok(f.total === 1 && f.items[0].c === "1001", "My favourites chip");
  r = await post("/momo/work/brokers/api", NAJ, { action: "note", card: "1001", fav: false, note: "", draft: "", contacted: false }); ok(!store.has("work_naj_brk_1001") && !JSON.parse(store.get("work_naj_brk_favs")).includes("1001"), "clearing everything removes her key and the favourite");
  ok((await post("/momo/work/brokers/api", NAJ, { action: "note", card: "9999", fav: true })).status === 404, "a note on an unknown card is refused");
  ok((await post("/momo/work/brokers/api", NAJ, { action: "other", card: "1001" })).status === 400, "an unknown action is refused");
  ok(![...store.keys()].some((k) => k.startsWith("work_kendall_") || k.startsWith("momo_pick")), "no shared pick key, nothing in anyone else's namespace"); }

// 9. activity appears: district features switch on (no deploy needed)
store.set("momo_broker_activity", JSON.stringify({
  "1001": { districts: { "Jumeirah Village Triangle": 7, "Dubai Islands": 1 }, sale: 0, rent: 8, land: 0, last_listed: "2026-11-01", portals: ["propertyfinder"] },
  "1002": { districts: { "Jumeirah Village Triangle": 12 }, sale: 2, rent: 10, land: 0, last_listed: "2026-10-30", portals: ["propertyfinder"] },
  "1004": { districts: { "Jumeirah Village Triangle": 30 }, sale: 30, rent: 0, land: 0, last_listed: "2026-10-30", portals: ["propertyfinder"] },   // expired, most active: still last
  "1005": { districts: { "Dubai Marina": 4 }, sale: 4, rent: 0, land: 0, last_listed: "2026-10-29", portals: ["propertyfinder"] },
}));
B._resetCache();
{ const d = await api("q=JVT");
  ok(d.activity === true && d.district === "Jumeirah Village Triangle" && d.districts.includes("Jumeirah Village Triangle"), "activity on: the district list is served", [d.activity, d.district, d.districts]);
  ok(d.items.map((x) => x.c).slice(0, 2).join() === "1002,1001", "district activity ranks first: Omar 12 then Dmitrii 7", d.items.map((x) => x.c));
  ok(d.items[d.items.length - 1].c === "1004", "the expired broker stays last even with 30 JVT listings", d.items.map((x) => x.c));
  const om = d.items[0]; ok(om.act && om.act.d === "Jumeirah Village Triangle" && om.act.n === 12, "'Active in JVT · 12 listings' data on the card", om.act);
  ok(d.stats.active === 3 && d.stats.district === "Jumeirah Village Triangle", "stats: 3 active in JVT (the expired one counts as active, it is still listing)", d.stats); }
{ const d = await api("q=JVT&active=1"); ok(d.total === 3 && !d.items.some((x) => x.c === "1003"), "Active in district chip keeps only brokers listing there", d.items.map((x) => x.c)); }
{ const d = await api("q=&active=1"); ok(d.total === 4 && d.stats.active === 4, "Active this week (no district) = anyone with activity", [d.total, d.stats]); }
{ const d = await api("q=marina"); ok(d.district === "Dubai Marina" && d.items[0].c === "1005", "marina -> Dubai Marina, Sara first", [d.district, d.items.map((x) => x.c)]); }
{ const x = await (await get("/momo/work/brokers/1001?q=JVT%201%20bed%20rent", NAJ)).json();
  ok(x.districts.length === 2 && x.districts[0].d === "Jumeirah Village Triangle" && x.districts[0].n === 7 && x.rent === 8 && x.last_listed === "2026-11-01", "the broker screen lists districts with counts, rent/sale, last listed", x.districts);
  ok(x.draft === "Hi Dmitrii, this is Najjuko from FN Realty. I have a client looking for a 1-bed rental in Jumeirah Village Triangle. Do you have anything available?", "detail draft from the query (no budget typed)", x.draft); }
{ const o = await (await get("/momo/work/brokers/office/9001?district=Jumeirah%20Village%20Triangle", NAJ)).json();
  ok(o.active === 1 && o.listings === 8 && o.districts[0].d === "Jumeirah Village Triangle" && o.brokers[0].c === "1001", "office screen: 1 active broker, 8 listings, JVT first, Dmitrii first", [o.active, o.listings, o.districts]); }
{ const o = await (await get("/momo/work/brokers/office/9003?district=Jumeirah%20Village%20Triangle", NAJ)).json();
  ok(o.brokers[0].c === "1005" && o.brokers[1].c === "1004", "an expired broker is last in the office even with the most JVT listings", o.brokers.map((x) => x.c)); }

// 10. the module cache: the register is read from KV once per isolate, not per request
{ let reads = 0; const kv2 = Object.assign({}, KV, { get: async (k, t) => { if (k === "momo_brokers") reads++; return KV.get(k, t); } });
  const env2 = Object.assign({}, env, { MEETINGS: kv2 }); B._resetCache();
  for (let i = 0; i < 5; i++) await worker.fetch(new Request("https://w/momo/work/brokers/api?q=omar&key=" + NAJ), env2, ctx);
  ok(reads === 1, "five searches, one KV read of momo_brokers", reads); }
// 11. the register missing: an honest 503, not a crash
{ store.delete("momo_brokers"); B._resetCache(); const r = await get("/momo/work/brokers/api?q=omar", NAJ); ok(r.status === 503 && (await r.json()).error === "register not loaded", "no register -> 503 register not loaded", r.status);
  store.set("momo_brokers", zlib.gzipSync(Buffer.from(JSON.stringify(DOC)))); B._resetCache(); }

console.log("v682 momo brokers: " + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
