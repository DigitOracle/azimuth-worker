// v613 - Momo Work · Content plan · I HAVE AN IDEA (Kendall 20 Oct 2026): a word, a line, a link or a picture goes in; the plan looks in its own calendar first, then on the
// web (DuckDuckGo results, Bing News), in Google Places and in Najma's area thread, and the engine comes back with what it is, when, where it belongs and three angles.
// Offline: the network is stubbed, the engine and the OCR lane are fakes. Checks the parsers, the plain match without the engine, the idea_find action end to end, the new
// item fields (angle, mine, undated), the Ideas shelf rule in both PDFs, and that the page script carries the wiring and parses.
//   node test/test_v613_ideas.mjs
import fs from "node:fs";
const m = await import("../src/work_log.js");
const plan = await import("../src/work_plan.js");
let pass = 0, fail = 0; const ok = (c, msg, extra) => { if (c) pass++; else { fail++; console.log("FAIL", msg, extra === undefined ? "" : JSON.stringify(extra).slice(0, 400)); } };

// --- A. the parsers
const DDG = '<div class="result results_links results_links_deep web-result"><h2 class="result__title"><a rel="nofollow" class="result__a" href="https://x/1">Halloween in Dubai 2026: <b>events</b></a></h2><a class="result__snippet" href="https://x/1">Trick or treat trails, pumpkin patches and costume nights across the city on 31 October.</a></div>'
  + '<div class="result results_links results_links_deep web-result"><a class="result__a" href="https://x/2">Halloween 2026 date</a><div class="result__snippet">Halloween falls on Friday 31 October 2026.</div></div>'
  + '<div class="result results_links"><a class="result__a" href="https://x/3">No snippet here</a></div>';
const w = plan.parseDDG(DDG);
ok(w.length === 3 && w[0].title === "Halloween in Dubai 2026: events" && /pumpkin/.test(w[0].snippet) && /Friday 31 October/.test(w[1].snippet) && w[2].snippet === "", "DuckDuckGo results parse: title and snippet per block, tags stripped, missing snippet is empty", w);
ok(plan.parseDDG("").length === 0 && plan.parseDDG("<html>nothing</html>").length === 0, "no results parse to an empty list");
const RSS = '<rss><channel><item><title><![CDATA[Dubai gets ready for Halloween]]></title><pubDate>Sun, 19 Oct 2026 08:00:00 GMT</pubDate></item><item><title>Second &amp; last</title></item></channel></rss>';
const n = plan.parseRss(RSS);
ok(n.length === 2 && n[0].title === "Dubai gets ready for Halloween" && n[0].date === "19 Oct 2026" && n[1].title === "Second & last" && n[1].date === "", "Bing News RSS parses: CDATA and entities handled, date trimmed", n);

// --- B. the plain match (no engine)
const items = plan.SEED.map((s) => ({ id: s[0], start: s[1], end: s[2], title: s[3], pillar: s[4], certainty: s[5], sub: "" }));
ok(plan.plainMatch("diwali", items).id === "k_diwali_2026", "one word finds its calendar item");
ok(plan.plainMatch("the Dubai fitness challenge this year", items).id === "k_dfc_2026", "a sentence finds the item that shares two words");
ok(plan.plainMatch("halloween", items) === null && plan.plainMatch("", items) === null, "an idea the calendar does not hold matches nothing");

// --- C. the worker end to end, network stubbed
const store = new Map();
const KV = { get: async (k) => store.get(k) || null, put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); }, list: async ({ prefix }) => ({ keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) };
const env = { MEETINGS: KV, MAPS_KEY: "k", ASK_ENGINE_URL: "https://engine", ASK_SECRET: "s" };
const calls = [];
globalThis.fetch = async (u, o) => {
  const url = String(u); calls.push(url);
  const T = (t, ct) => ({ ok: true, status: 200, headers: { get: () => ct || "text/html" }, text: async () => t, json: async () => JSON.parse(t) });
  if (/duckduckgo/.test(url)) return T(DDG);
  if (/bing\.com\/news/.test(url)) return T(RSS, "application/xml");
  if (/places\.googleapis/.test(url)) return T(JSON.stringify({ places: [{ displayName: { text: "Global Village" }, formattedAddress: "Sheikh Mohammed Bin Zayed Rd, Dubai" }] }), "application/json");
  if (/engine\/area/.test(url)) return T(JSON.stringify({ status: "ok", name: "Dubai", lines: ["a line"] }), "application/json");
  if (/linktitle/.test(url)) return T('<html><head><meta property="og:title" content="Halloween at the Mall of the Emirates"></head></html>');
  throw new Error("unexpected fetch " + url);
};
let engineCalls = [];
const engine = async (envx, sys, user, schema, model, maxTok) => {
  engineCalls.push({ sys, user, schema, maxTok });
  const idea = ((user.match(/Her idea: "([^"]*)"/) || [])[1] || "") + " " + ((user.match(/The link's title: "([^"]*)"/) || [])[1] || "") + " " + ((user.match(/Text read from her picture: "([^"]*)"/) || [])[1] || "");
  if (/engine-down/.test(idea)) return null;
  if (/diwali/i.test(idea)) return { name: "Diwali", start: "2026-11-08", end: "2026-11-08", repeats: true, pillar: "known", sub: "", certainty: "Fixed", known: "k_diwali_2026", why: "The festival of lights.", angles: [{ title: "Lights in the lobby", line: "One warm photo of the office lit for the night.", format: "story", activity: "team" }] };
  return { name: "Halloween", start: "2026-10-31", end: "2026-10-31", repeats: true, pillar: "known", sub: "", certainty: "Fixed", known: "not_a_real_id", why: "A costume night every industry marks.",
    angles: [{ title: "Haunted viewings", line: "After-dark tour of our three oldest listings.", format: "reel", activity: "social" }, { title: "Trick or treat the neighbourhood", line: "Agents hand out sweets on a street we sell on.", format: "carousel", activity: "social" }, { title: "Costume at the office", line: "A photo wall and a warm team post.", format: "post", activity: "team" }, { title: "A fourth one", line: "too many", format: "post", activity: "social" }] };
};
const mk = (naj) => ({ isNaj: () => naj, model: "m", page: (k, rk, b) => "<html>" + b + "</html>", claudeJSON: engine, ocr: async (e, name, ct, b64) => (/jpeg|png/.test(ct) && b64 ? "HALLOWEEN NIGHT 31 OCT costumes welcome" : "") });
const req = (path, body, naj = true) => m.workRoute(new Request("https://w" + path + (path.includes("?") ? "&" : "?") + "key=K", body ? { method: "POST", body: JSON.stringify(body) } : {}), env, new URL("https://w" + path + (path.includes("?") ? "&" : "?") + "key=K"), mk(naj));
const api = (body) => req("/momo/work/plan/api", body).then((r) => r.json());

const nothing = await req("/momo/work/plan/api", { action: "idea_find", text: "", url: "", image: null });
ok(nothing.status === 422, "an idea with nothing in it is refused with a plain message");
const noKey = await req("/momo/work/plan/api", { action: "idea_find", text: "Halloween" }, false);
ok(noKey.status === 404, "only her link can ask");

calls.length = 0; engineCalls = [];
const h = await api({ action: "idea_find", text: "Halloween" });
ok(h.ok && h.found.engine === true && h.found.name === "Halloween" && h.found.start === "2026-10-31" && h.found.pillar === "known" && h.found.repeats === true, "a single word comes back as a dated commercial moment", h.found);
ok(h.found.known === "" && h.found.angles.length === 3 && h.found.angles[0].format === "reel" && h.found.angles[2].activity === "team", "an id the calendar does not hold is dropped; angles are capped at three and keep format and activity", h.found);
ok(h.checked.web === 3 && h.checked.news === 2 && h.checked.places === 1 && h.checked.najma === true && h.checked.calendar === plan.SEED.length, "the plan, the web, the news, the places and Najma were all checked", h.checked);
ok(calls.some((u) => /duckduckgo/.test(u)) && calls.some((u) => /bing\.com\/news/.test(u)) && calls.some((u) => /places\.googleapis/.test(u)) && calls.some((u) => /engine\/area/.test(u)), "all four lookups went out", calls);
const u = engineCalls[0].user;
ok(/In the plan already/.test(u) && /k_diwali_2026 \| 2026-11-08\.\.2026-11-08 \| Diwali/.test(u) && /pumpkin patches/.test(u) && /Dubai gets ready for Halloween/.test(u) && /Global Village/.test(u) && /Najma area thread/.test(u) && engineCalls[0].schema.required.includes("angles"), "the engine was given the calendar, the web, the news, the places and Najma, with a schema", u.slice(0, 600));
ok(/no figures in the angles/.test(engineCalls[0].sys) && /never invent a date/.test(engineCalls[0].sys), "the brief forbids invented dates and figures in the angles");

const d = await api({ action: "idea_find", text: "diwali" });
ok(d.found.known === "k_diwali_2026" && d.found.certainty === "Fixed", "an idea the calendar already holds comes back pointing at that item", d.found);

const pic = await api({ action: "idea_find", image: { name: "poster.jpg", type: "image/jpeg", data: "AAAA" } });
ok(pic.ok && /HALLOWEEN NIGHT/.test(pic.read) && pic.query.startsWith("HALLOWEEN NIGHT") && pic.found.name === "Halloween", "a picture alone is read by the OCR lane and looked up from what it says", pic);
const blank = await req("/momo/work/plan/api", { action: "idea_find", image: { name: "p.gif", type: "image/gif", data: "AAAA" } });
ok(blank.status === 422 && /could not read anything in that picture/.test(await blank.text()), "a picture with no readable text says so, in plain words");
const big = await req("/momo/work/plan/api", { action: "idea_find", image: { name: "p.jpg", type: "image/jpeg", data: "x".repeat(9_000_001) } });
ok(big.status === 400, "a picture over the limit is refused");

const lk = await api({ action: "idea_find", url: "https://linktitle.example/halloween" });
ok(lk.ok && /Halloween at the Mall/.test(engineCalls[engineCalls.length - 1].user) && lk.found.name === "Halloween", "a link's title is read and given to the engine", lk);

const down = await api({ action: "idea_find", text: "diwali engine-down" });
ok(down.ok && down.found.engine === false && down.found.known === "k_diwali_2026" && down.found.start === "2026-11-08" && down.found.angles.length === 0 && /already in the plan/.test(down.found.why), "without the engine the calendar still answers: a plain match", down.found);
const down2 = await api({ action: "idea_find", text: "halloween engine-down" });
ok(down2.ok && down2.found.engine === false && down2.found.name === "halloween engine-down" && down2.found.start === "" && /could not reach the engine/.test(down2.found.why), "without the engine and without a match the plan says so and keeps her words", down2.found);

// --- D. the new fields round-trip; an idea without a date stays off the calendar and the PDFs, and comes back when dated
const saved = await api({ action: "item_save", item: { title: "Winter outdoor living", start: "2026-10-20", pillar: "known", format: "post", owner: "Graphic designer", angle: "Villa gardens at dusk, the first cool week.", mine: true, undated: true, note: "" } });
ok(saved.ok && saved.item.angle.startsWith("Villa gardens") && saved.item.mine === true && saved.item.undated === true, "angle, mine and undated are kept on an item", saved.item);
const seededAgain = (await api({ action: "item_save", item: { title: "Plain", start: "2026-10-21", pillar: "known" } })).item;
ok(seededAgain.angle === "" && seededAgain.mine === false && seededAgain.undated === false, "the fields default to empty and false");
const week = await (await req("/momo/work/plan/week?from=2026-10-19")).text();
ok(!/Winter outdoor living/.test(week), "an idea without a date is not on the weekly PDF");
const month = await (await req("/momo/work/plan/month?month=2026-10")).text();
ok(!/Winter outdoor living/.test(month), "nor on the month PDF");
const dated = await api({ action: "item_save", item: { ...saved.item, start: "2026-10-22", end: "2026-10-22", undated: false } });
const week2 = await (await req("/momo/work/plan/week?from=2026-10-19")).text();
ok(dated.item.undated === false && /Winter outdoor living/.test(week2) && /Our angle:<\/b> Villa gardens at dusk/.test(week2) && /Added by Najjuko/.test(week2), "once dated it is on the weekly PDF with her angle and marked as hers", week2.slice(week2.indexOf("Winter"), week2.indexOf("Winter") + 300));
const month2 = await (await req("/momo/work/plan/month?month=2026-10")).text();
ok(/Winter outdoor living/.test(month2) && /Our angle:/.test(month2) && /Added by Najjuko/.test(month2), "and on the month PDF");
ok(!/\/momo\/work/.test(week2.replace(/https?:\/\/[^"']*/g, "")) && !/key=/.test(week2), "the PDF still carries no link into Momo Work");

// --- E. the page: the wiring is there and the script parses
const page = await (await req("/momo/work/plan")).text();
for (const w of ['id=pidea class=gold>I have an idea', "function ideaSheet", "function foundSheet", 'action:"idea_find"', "Ideas waiting for a date", "Our angle", 'accept="image/*"', "SpeechRecognition", "Added by you", "No date yet", 'id=e_angle', 'id=e_date']) ok(page.includes(w), "page carries: " + w);
const js = page.split("<script>")[1].split("</script>")[0];
let parses = true; try { new Function(js); } catch (e) { parses = false; console.log(e.message); }
ok(parses, "the page script parses");
ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(page), "no emoji characters in the page");
const src = fs.readFileSync(new URL("../src/work_plan.js", import.meta.url), "utf8");
ok((src.match(/v613/g) || []).length >= 5, "the version is marked in the code");

console.log(`test_v613_ideas: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
