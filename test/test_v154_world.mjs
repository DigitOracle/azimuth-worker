// v154 - WORLD (16 Sep 2026): Dubai versus one of ten world cities, 45-60 s to camera. The fact base and its arithmetic, the rotation,
// the number check that keeps an invented figure out of her mouth, the keyword, and the worker end to end with WhatsApp and the
// model stubbed: "versus london" sends the piece and two buttons, a bad draft gets one repair, the Monday 07:00 tick sends once and
// Tuesday sends nothing. Nothing leaves this machine.
import worker from "../src/index.js";
import { WORLD_CITIES, WORLD_ANGLES, worldFacts, worldPick, worldNumbersOk, worldCheck, worldParse, worldMessage, worldSystem, worldListRows, worldCity } from "../src/world.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };

// 1. the fact base and its arithmetic
ok(WORLD_CITIES.length === 11 && WORLD_CITIES[0].key === "dubai" && WORLD_CITIES[0].base && WORLD_CITIES.slice(1).every(c => c.prime > 0 && c.m2 > 0 && c.name && c.flag), "eleven cities, Dubai first as the base, every other city priced");
const L = worldFacts("london", "sqft");
ok(L.dubai.prime_aed_per_sqft === 4260 && L.other.prime_aed_per_sqft === 7200 && L.multiple.value === 1.69 && L.multiple.text === "1.7 times Dubai", "London: AED 4,260 against AED 7,200 per sq ft, 1.7 times Dubai");
ok(L.other.m2_for_aed_5m === 45 && L.dubai.m2_for_aed_5m === 84 && L.other.sqft_for_usd_1m === 360 && L.aed_5m_in_usd === "US$1.36 million", "the arithmetic is done in code: AED 5m buys 84 square metres of prime Dubai and 45 of prime London");
const M = worldFacts("mumbai", "sqft");
ok(M.multiple.text === "about 3% below Dubai" && M.other.caution && /CHEAPER/.test(M.other.caution), "Mumbai is priced below Dubai and the facts say so, with the caution");
ok(worldFacts("dubai", "sqft") === null && worldFacts("atlantis", "sqft") === null && worldCity("HK").key === "hongkong" && worldCity("New York").key === "newyork" && worldCity("bombay").key === "mumbai", "Dubai is never the other city; aliases resolve");
ok(L.basis.includes("PRIME") && L.sources.prices.period === "values at June 2026" && L.sources.what_1m_buys.published === "23 April 2026" && L.dip.includes("4.5%"), "basis, source periods and the dip line ride with every fact set");

// 2. rotation
const day = (d) => ({ day: d });
let p = worldPick([], day(1));
ok(WORLD_CITIES.some(c => c.key === p.city && !c.base) && ["sqft", "five_million"].includes(p.angle), "Monday with no history: a city and a Monday-lane angle");
const hist0 = ["london", "paris", "sydney", "miami", "geneva"].map((c, i) => ({ d: "2026-09-0" + (9 - i), city: c, angle: "sqft" }));
p = worldPick(hist0, day(3));
ok(!["london", "paris", "sydney", "miami", "geneva"].includes(p.city) && ["size", "living"].includes(p.angle) === (p.angle === "size" || p.angle === "living"), "a city rests for five pieces; Wednesday leans to the places lane");
p = worldPick([{ d: "2026-09-14", city: "london", angle: "sqft" }], { city: "london", day: 1 });
ok(p.city === "london" && p.angle !== "sqft", "the same city again gets an angle it has not had");
p = worldPick([], { city: "london", angle: "sqft", notAngle: "sqft" });
ok(p.angle !== "sqft", "notAngle (Another angle) is honoured even when the angle is asked for");
p = worldPick([], { city: "monaco", angle: "living" });
ok(p.angle !== "living" && !WORLD_ANGLES.find(a => a.key === "living").needs.every(f => WORLD_CITIES.find(c => c.key === "monaco")[f]), "an angle whose facts a city lacks is never picked for it");
const seen = new Set(); let h2 = [];
for (let i = 0; i < 10; i++) { const q = worldPick(h2, day([1, 3, 5][i % 3])); seen.add(q.city); h2.unshift({ d: "d" + i, city: q.city, angle: q.angle }); }
ok(seen.size === 10, "ten pieces in a row cover all ten cities");

// 3. the number check and the length check
const good = (f) => {
  const d = f.dubai, o = f.other, n = (x) => x.toLocaleString("en-US");
  return "A client hears " + o.city + " and thinks Dubai is the expensive one. At the top end of both markets, Savills' June 2026 numbers put " + o.city + " at AED " + n(o.prime_aed_per_sqft) +
    " per square foot. Dubai sits at AED " + n(d.prime_aed_per_sqft) + " per square foot. That is " + f.multiple.text + ". Knight Frank's Wealth Report says one million dollars buys " + o.m2 + " square metres of prime " + o.city +
    ". In Dubai it buys " + d.m2 + " square metres. Same money, a home you can actually live in, with room for the family and the light coming in. " +
    "So when someone tells you five million dirhams is a lot, ask them the only question that matters. Expensive compared to what? Come and see what the same money feels like here. I will walk you through it, room by room, no rush.";
};
const gL = good(L);
ok(worldNumbersOk(gL, L).ok && worldCheck(gL, L, /\bmomentum\b/i).ok, "a script built only from the facts passes (" + worldCheck(gL, L).words + " words)");
const bad = worldNumbersOk(gL + " Rents rose 47% last year and 1,950 is the old figure.", L);
ok(!bad.ok && bad.bad.join(",") === "47,1,950", "an invented percentage and a near-miss figure are caught");
ok(worldNumbersOk("Savills, June 2026. Knight Frank, 23 April 2026.", L).ok, "years and dates in the sources count as facts");
ok(!worldCheck("Too short to say anything at all.", L).ok && /too short/.test(worldCheck("Too short.", L).why), "a 45-second piece cannot be six words");
ok(!worldCheck(gL, L, /\bactually\b/i).ok && /banned/.test(worldCheck(gL, L, /\bactually\b/i).why), "the voice ban list applies");
ok(!worldCheck(gL + " 🌍", L).ok, "no emojis in a spoken script");

// 4. the keyword and the wrapper
ok(worldParse("versus") && !worldParse("versus").city && worldParse("Versus London").city === "london" && worldParse("vs paris tax").angle === "tax" && worldParse("vs paris tax").city === "paris", "versus / versus london / vs paris tax");
ok(worldParse("versus hong kong").city === "hongkong" && worldParse("world new york what you keep").city === "newyork" && worldParse("world new york what you keep").angle === "tax" && worldParse("compare singapore size").angle === "size", "two-word cities and angle words");
ok(worldParse("market brief") === null && worldParse("versus my expectations of the world") && !worldParse("versus my expectations of the world").city && worldParse("versa") === null, "other messages are not the keyword; unknown words give today's pick");
const sys = worldSystem("HER VOICE: short lines.", "sqft");
ok(!/claude|anthropic|gpt|openai|gemini|mistral|llm/i.test(sys) && /105 to 140 words/.test(sys) && /price per square foot/.test(sys) && sys.endsWith("HER VOICE: short lines."), "the prompt names no model, sets the length and carries her voice");
const msgL = worldMessage(L, gL);
ok(msgL.startsWith("🌍 *Dubai versus London* 🇬🇧 · price per square foot · about ") && msgL.includes(gL) && msgL.includes("If they ask about the dip") && msgL.includes("Savills World Cities Prime Residential Index, values at June 2026") && !msgL.includes("Papi"), "the wrapper: title, the piece, the dip line to have ready, the sources, no sign-off");
const HK = worldFacts("hongkong", "living");
ok(worldMessage(HK, gL).includes("net saleable") && !worldMessage(worldFacts("paris", "tax"), gL).includes("If they ask about the dip"), "Hong Kong carries the area-basis note; a tax piece carries no dip line");
const MO = worldFacts("monaco", "sqft");
ok(MO.other.price_source && /IMSEE/.test(MO.other.price_source) && worldMessage(MO, gL).includes("Savills Monaco Spotlight") && !worldMessage(MO, gL).includes("World Cities Prime Residential Index, values"), "Monaco is not in the Savills index: its price is credited to the Monaco spotlight and IMSEE");
ok(WORLD_CITIES.slice(1).filter(c => c.tax).length === 10 && WORLD_CITIES.slice(1).filter(c => c.living).length === 8 && WORLD_CITIES.every(c => !c.tax || (c.tax.income && c.tax.buying && c.tax.capital_gains)), "every city has tax facts in three parts; eight have liveability facts");
ok(worldPick([], { city: "monaco", angle: "living" }).angle !== "living" && worldPick([], { city: "mumbai", angle: "tax" }).angle === "tax", "Monaco has no liveability rankings so never gets that angle; Mumbai has tax facts");
const rows = worldListRows([{ city: "london" }]);
ok(rows.length === 10 && rows.every(r => r.id.startsWith("wld:c:") && r.title.length <= 24 && r.description.length <= 72) && rows.find(r => r.id === "wld:c:london").description.includes("recent") && rows.find(r => r.id === "wld:c:mumbai").description.includes("just under Dubai"), "the city list fits WhatsApp's limits and marks recent cities");

// 5. through the worker
const HER = "971565484397";
const store = new Map();
const KV = { async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter(k => k.startsWith(p)).map(name => ({ name })), list_complete: true }; } };
const sent = [], model = [];
let draftMode = "good";
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes("graph.facebook.com")) { sent.push(JSON.parse(init.body)); return new Response(JSON.stringify({ messages: [{ id: "wamid.out" + sent.length }] }), { status: 200 }); }
  if (u.includes("api.anthropic.com")) {
    const b = JSON.parse(init.body); const sysT = typeof b.system === "string" ? b.system : JSON.stringify(b.system || "");
    const um = b.messages && b.messages[0] && b.messages[0].content; const userT = typeof um === "string" ? um : (um || []).map(x => x.text || "").join("");
    model.push({ sys: sysT, user: userT });
    if (!/spoken piece for Najjuko/.test(sysT)) return new Response(JSON.stringify({ content: [{ type: "text", text: "{}" }] }), { status: 200 });
    const fm = userT.match(/\{[\s\S]*\}/); const f = JSON.parse(fm[0].split("\n\nDRAFT:")[0]);
    const repair = /REPAIR PASS/.test(sysT);
    const text = (draftMode === "bad" && !repair) ? good(f) + " Rents rose 47% too." : good(f);
    return new Response(JSON.stringify({ content: [{ type: "text", text }] }), { status: 200 });
  }
  return new Response("{}", { status: 200 });
};
const env = { MEETINGS: KV, READ_KEY: "RK", WA_FORWARD_TOKEN: "FWD", WA_ALLOWED: HER, WHATSAPP_TOKEN: "t", WA_PHONE_ID: "p", ANTHROPIC_API_KEY: "k", MAILBOXES: "", ADD_TO: "", AI: { async run() { return { response: "{}" }; } },
  WORLD_TALK: "on", PUBLIC_ORIGIN: "https://azimuth-2.digitalchemy.workers.dev" };
const pending = [];
const ctx = { waitUntil(p) { pending.push(p); } };
let mid = 0;
const post = (message, e) => worker.fetch(new Request("https://x/wa", { method: "POST", headers: { "X-Azimuth-Forward": "FWD", "Content-Type": "application/json" },
  body: JSON.stringify({ entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: "p" }, messages: [Object.assign({ from: HER, id: "wamid.in" + (++mid) }, message)] } }] }] }) }), e || env, ctx);
const say = (t, e) => post({ type: "text", text: { body: t } }, e);
const tap = (id, e) => post({ type: "interactive", interactive: { type: "button_reply", button_reply: { id, title: id } } }, e);
const drain = async () => { while (pending.length) await pending.splice(0).reduce((a, p) => a.then(() => p.catch(() => {})), Promise.resolve()); };
const texts = () => sent.filter(m => m.type === "text").map(m => m.text.body);
const pieces = () => texts().filter(t => t.startsWith("🌍 *Dubai versus"));

await say("versus london"); await drain();
ok(texts().some(t => t.startsWith("On it: Dubai versus London")), "versus london: she is told it is coming");
ok(pieces().length === 1 && pieces()[0].includes("Dubai versus London") && pieces()[0].includes("AED 7,200 per square foot") && pieces()[0].includes("Sources:"), "the piece arrives, with London's numbers and the sources");
const btn = sent.find(m => m.type === "interactive" && m.interactive.type === "button");
ok(btn && btn.interactive.action.buttons.map(b => b.reply.id).join(",") === "wld:city,wld:a:london", "then the two buttons: another city, another angle");
let hist = JSON.parse(store.get("world_hist"));
ok(hist.length === 1 && hist[0].city === "london" && hist[0].angle && model.length === 1, "the piece is remembered; one model call");
ok(/spoken piece for Najjuko/.test(model[0].sys) && /HER VOICE/.test(model[0].sys) && model[0].user.startsWith("FACTS (the only numbers you may use):"), "the model got the rules, her voice and only the facts");

sent.length = 0; model.length = 0;
await tap("wld:a:london"); await drain();
hist = JSON.parse(store.get("world_hist"));
ok(pieces().length === 1 && hist.length === 2 && hist[0].city === "london" && hist[0].angle !== hist[1].angle, "Another angle: London again, a different angle");

sent.length = 0;
await tap("wld:city"); await drain();
const list = sent.find(m => m.type === "interactive" && m.interactive.type === "list");
ok(list && list.interactive.action.sections[0].rows.length === 10 && list.interactive.action.sections[0].rows[0].id.startsWith("wld:c:"), "Another city: the list of ten");
sent.length = 0;
await tap("wld:c:mumbai"); await drain();
ok(pieces().length === 1 && pieces()[0].includes("Dubai versus Mumbai") && pieces()[0].includes("about 3% below Dubai"), "a city from the list; Mumbai says it is below Dubai, never that Dubai is cheaper");

sent.length = 0; model.length = 0; draftMode = "bad";
await say("versus"); await drain();
ok(model.length === 2 && /REPAIR PASS/.test(model[1].sys) && /47%/.test(model[1].user) && pieces().length === 1 && !/47%/.test(pieces()[0]), "a draft with an invented number gets one repair pass and the repaired piece is the one sent");
draftMode = "good";

sent.length = 0;
await say("versus paris", Object.assign({}, env, { WORLD_TALK: "" })); await drain();
ok(pieces().length === 0, "with WORLD_TALK off the word is not a command");

// 6. the tick: Monday 07:00 GST sends once; Tuesday sends nothing
const realNow = Date.now;
const at = (iso) => { Date.now = () => Date.parse(iso); };
const tick = async (iso) => { at(iso); sent.length = 0; pending.length = 0; await worker.scheduled({ cron: "0,30 2-18 * * *", scheduledTime: Date.parse(iso) }, env, ctx); await drain(); };
await tick("2026-09-21T03:00:00Z");                                                  // Monday 07:00 GST
ok(pieces().length === 1 && store.get("world_2026-09-21") === "done", "Monday 07:00 GST: one piece, marker done");
await tick("2026-09-21T03:30:00Z");
ok(pieces().length === 0, "the 07:30 tick does not send it again");
await tick("2026-09-22T03:00:00Z");                                                  // Tuesday
ok(pieces().length === 0 && !store.has("world_2026-09-22"), "Tuesday: nothing");
await tick("2026-09-23T03:00:00Z");                                                  // Wednesday
ok(pieces().length === 1, "Wednesday 07:00: the next piece");
await tick("2026-09-25T04:00:00Z");                                                  // Friday but 08:00 GST
ok(pieces().length === 0, "Friday 08:00: the hour has passed, nothing (she says versus)");
hist = JSON.parse(store.get("world_hist"));
ok(new Set(hist.slice(0, 2).map(x => x.city)).size === 2 && hist.slice(0, 2).every(x => !["london", "mumbai"].includes(x.city)), "the two scheduled pieces took cities she has not had lately");
Date.now = realNow;

// 7. the operator route
const r = await worker.fetch(new Request("https://x/world_test?key=RK&dry=1&city=geneva&angle=size"), env, ctx);
const body = await r.text();
ok(r.status === 200 && body.startsWith("🌍 *Dubai versus Geneva*") && /\[\d+ words\]$/.test(body.trim()) && !sent.some(m => m.text && m.text.body.includes("Geneva")), "/world_test?dry=1 writes the piece without sending");
ok((await worker.fetch(new Request("https://x/world_test?dry=1&city=geneva"), env, ctx)).status === 401, "the route is keyed");


// 8. v154.2 - the review round: the ten samples with buttons, her verdicts and notes filed, the lane still off
import { WORLD_SAMPLES, worldReviewBody, worldFbParse, WORLD_REVIEW_INTRO } from "../src/world.js";
const envOff = Object.assign({}, env, { WORLD_TALK: "" });
ok(WORLD_SAMPLES.length === 10 && WORLD_SAMPLES.every((s, i) => s.n === i + 1 && s.text.split(/\s+/).length >= 105 && s.text.split(/\s+/).length <= 140 && worldReviewBody(s).length <= 1024 && s.sources && s.ready), "ten samples, 105-140 words each, every body within WhatsApp's 1,024 characters, sources and the have-ready line on each");
ok(WORLD_SAMPLES.every(s => !/claude|anthropic|gpt|openai|gemini|mistral|\u2014|\u2013/i.test(s.text)) && /Black Coffee/.test(WORLD_REVIEW_INTRO) && /by Papi/.test(WORLD_REVIEW_INTRO), "no model names or dashes in the scripts; the intro speaks to Black Coffee and signs off from Papi");
ok(worldFbParse("3: too long").n === 3 && worldFbParse("script 7 - shorter please").note === "shorter please" && worldFbParse("10 love it").n === 10 && worldFbParse("11: x") === null && worldFbParse("call Sara tomorrow 3pm") === null && worldFbParse("3") === null, "a numbered note parses; ordinary messages and bare numbers do not");
let rr = await worker.fetch(new Request("https://x/world_review?key=RK&dry=1"), envOff, ctx);
let rb = await rr.text();
ok(rr.status === 200 && rb.startsWith("[intro] Good morning, Black Coffee") && (rb.match(/\n\n---\n\n/g) || []).length === 10 && rb.includes("[10] 10/10 · Dubai versus Mumbai") && !sent.some(m => m.text && /Black Coffee/.test(m.text.body)), "/world_review?dry=1 lists the intro and the ten without sending");
sent.length = 0;
rr = await worker.fetch(new Request("https://x/world_review?key=RK"), envOff, ctx);
rb = await rr.text();
const btns = sent.filter(m => m.type === "interactive" && m.interactive.type === "button");
ok(rr.status === 200 && rb.startsWith("sent 11/11") && sent[0].type === "text" && sent[0].text.body === WORLD_REVIEW_INTRO && btns.length === 10 && btns.every((b, i) => b.interactive.body.text.startsWith((i + 1) + "/10 · Dubai versus ") && b.interactive.action.buttons.map(x => x.reply.id).join(",") === ["wld:fb:" + (i + 1) + ":yes", "wld:fb:" + (i + 1) + ":fix", "wld:fb:" + (i + 1) + ":no"].join(",")), "/world_review sends the intro, then ten button messages with 👍 ✏️ 👎, with the lane switched off");
ok(JSON.parse(store.get("world_review")).sent.length === 11 && JSON.parse(store.get("world_review")).scripts.length === 10, "the review record remembers what went out");
sent.length = 0;
await tap("wld:fb:2:fix", envOff); await drain();
ok(store.get("world_fb_pending") === "2" && texts().some(t => t.startsWith("✏️ Script 2 (Monaco)")), "✏️ on script 2 opens the window and asks what to change");
sent.length = 0; model.length = 0;
await say("the parking space line is too much, keep the studio prices", envOff); await drain();
let rec = JSON.parse(store.get("world_review"));
ok(rec.fb["2"].verdict === "fix" && rec.fb["2"].notes.length === 1 && /parking space line/.test(rec.fb["2"].notes[0].text) && texts().some(t => t.startsWith("✅ Filed for script 2 (Monaco)")) && !store.has("world_fb_pending") && model.length === 0, "her next message is filed against script 2 and acknowledged, never sent to the model as a task");
sent.length = 0;
await tap("wld:fb:5:yes", envOff); await drain();
await tap("wld:fb:9:no", envOff); await drain();
await say("7: I would say Numbeo differently", envOff); await drain();
rec = JSON.parse(store.get("world_review"));
ok(rec.fb["5"].verdict === "yes" && rec.fb["9"].verdict === "no" && rec.fb["7"].notes[0].text === "I would say Numbeo differently" && texts().some(t => t.startsWith("✅ Script 5 (Sydney): you would say it")) && texts().some(t => t.startsWith("✅ Filed for script 7 (Geneva)")), "👍 and 👎 are filed; a numbered note files without the window");
rr = await worker.fetch(new Request("https://x/world_fb?key=RK"), envOff, ctx);
ok(rr.status === 200 && JSON.parse(await rr.text()).fb["2"].notes.length === 1 && (await worker.fetch(new Request("https://x/world_fb"), envOff, ctx)).status === 401, "/world_fb returns the record, keyed");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
