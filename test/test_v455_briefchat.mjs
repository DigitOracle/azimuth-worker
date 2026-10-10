// v455 - the client brief as a CHAT (lists, buttons, typed answers), offline through deskHandle. Nothing leaves.
//   node test/test_v455_briefchat.mjs
import { deskHandle } from "../src/desk.js";
import { answersToQuery, FLOW_AREAS } from "../src/wa_flows.js";
import { AREA_GROUPS, briefChatRoute, briefChatNajOn, parseAed, MSG, BC_PREFIX } from "../src/brief_chat.js";

const OWNER = "971562276093", PID = "1370146096179819";
const store = new Map();
const KV = { async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); }, async list() { return { keys: [] }; } };
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 500) : "")); } };
const raws = [], texts = [], searches = [];
globalThis.fetch = async () => new Response("{}");
const lab = { owner: OWNER, pid: PID, graph: "https://g", raw: async (e, p) => { raws.push(p); return { messages: [{ id: "w" }] }; },
  send: async (e, t) => texts.push(t), image: async () => {}, origin: () => "https://o", sleep: async () => {},
  briefLink: (e, sp) => "https://o/brief?" + sp.toString(),
  briefSearch: async (e, sp) => { searches.push(sp.toString()); return { status: 200, body: { results: [{ name: "Marina Gate 2", district_name: "Dubai Marina", evidence: { median: 98000, n: 23 } }] } }; } };
const postTexts = [];
const post = { send: async (e, t) => postTexts.push(t), buttons: async () => {}, image: async () => {}, llm: async () => "", fetchMedia: async () => ({}), origin: () => "", now: () => Date.now(), sleep: async () => {} };
const env = { MEETINGS: KV, WA_DESK_PHONE_ID: PID, WA_DESK_OWNER: OWNER, WHATSAPP_TOKEN: "T" };
const deps = { waSend: async (e, to, t) => texts.push("[waSend] " + t), post, lab };
let mid = 0;
const body = (m) => ({ entry: [{ changes: [{ value: { metadata: { phone_number_id: PID }, messages: [Object.assign({ from: OWNER, id: "wamid.in" + ++mid }, m)] } }] }] });
const clr = () => { raws.length = 0; texts.length = 0; postTexts.length = 0; };
const say = async (t) => { clr(); await deskHandle(env, body({ type: "text", text: { body: t } }), deps); };
const tap = async (id, title) => { clr(); await deskHandle(env, body({ type: "interactive", interactive: { type: "button_reply", button_reply: { id, title: title || id } } }), deps); };
const pickRow = async (id) => { clr(); await deskHandle(env, body({ type: "interactive", interactive: { type: "list_reply", list_reply: { id, title: id } } }), deps); };
const last = () => raws[raws.length - 1];
const bodyText = () => last() && last().interactive.body.text;
const rows = () => last().interactive.action.sections[0].rows;
const btns = () => last().interactive.action.buttons.map((b) => b.reply);
const limitsOk = (p) => p.interactive.type === "list" ? (p.interactive.action.sections[0].rows.length <= 10 && p.interactive.action.sections[0].rows.every((r) => r.title.length <= 24 && (!r.description || r.description.length <= 72)) && p.interactive.action.button.length <= 20)
  : (p.interactive.action.buttons.length <= 3 && p.interactive.action.buttons.every((b) => b.reply.title.length <= 20));
const allSent = []; const _raw = lab.raw; lab.raw = async (e, p, k) => { allSent.push(p); return _raw(e, p, k); };
store.set("wa_desk_seen", "1");

// groups cover the 32 areas exactly once, at most 9 per group (room for Back)
const flat = AREA_GROUPS.flatMap((g) => g.slugs);
ok(flat.length === FLOW_AREAS.length && new Set(flat).size === flat.length && FLOW_AREAS.every(([s]) => flat.includes(s)) && AREA_GROUPS.every((g) => g.slugs.length <= 9), "the 4 area groups hold all 32 form areas once each");
ok(parseAed("120000") === 120000 && parseAed("120,000") === 120000 && parseAed("120k") === 120000 && parseAed("1.2m") === 1200000 && parseAed("AED 95000") === 95000 && parseAed("cheap") === null && parseAed("12") === null, "budgets are read as AED");

// ---- happy path ----
await say("brief");
ok(bodyText() === MSG.name && btns().map((b) => b.title).join() === "Skip,Cancel", "brief starts the chat: name question with Skip", JSON.stringify(last()));
await say("Ms Rahman");
ok(bodyText() === MSG.mode && btns().map((b) => b.title).join() === "Rent,Buy", "rent or buy: 2 buttons");
await tap("bc:mode:rent");
ok(bodyText() === MSG.beds && rows().map((r) => r.title).join() === "Studio,1 bedroom,2 bedrooms,3 bedrooms or more,Any", "bedrooms list", JSON.stringify(rows()));
await pickRow("bc:beds:1");
ok(/Bedrooms so far: 1 bedroom/.test(bodyText()) && btns().map((b) => b.title).join() === "Add another,Next", "after a bedroom pick: Add another / Next");
await tap("bc:beds:more");
ok(!rows().some((r) => r.id === "bc:beds:1") && !rows().some((r) => r.id === "bc:beds:any"), "the second bedroom list leaves out what was picked");
await pickRow("bc:beds:2"); await tap("bc:beds:next");
ok(bodyText() === MSG.type && rows().map((r) => r.title).join() === "Any,Apartment,Townhouse,Villa", "home type list");
await pickRow("bc:type:apartment");
ok(bodyText() === MSG.areaGroups && rows().length === 5 && rows()[4].title === "Any area", "area groups list with Any area", JSON.stringify(rows()));
await pickRow("bc:ag:0");
ok(/Marina and the coast: pick an area/.test(bodyText()) && rows().some((r) => r.id === "bc:area:dubaimarina") && rows()[rows().length - 1].title === "Back to groups", "the group's areas, with Back");
await pickRow("bc:area:dubaimarina");
ok(/Areas so far: Dubai Marina/.test(bodyText()) && btns().map((b) => b.title).join() === "Add another area,Done", "after an area: Add another area / Done");
await tap("bc:area:more"); await pickRow("bc:ag:2");
ok(rows().some((r) => r.title === "Village Triangle" && r.description === "Jumeirah Village Triangle"), "a long area name is shortened in the title, full in the description");
await pickRow("bc:area:jumeirahvillagecircle"); await tap("bc:area:done");
ok(bodyText() === MSG.max && btns()[0].title === "Skip", "budget: typed, with Skip");
await say("lots");
ok(/^Please type the amount in AED/.test(bodyText()), "a budget that is not a number is asked again politely");
await say("120k");
ok(bodyText() === MSG.min, "then the lowest budget");
await say("80000");
ok(bodyText() === MSG.musts && rows().some((r) => r.title === "Near a metro") && rows()[rows().length - 1].title === "None", "must-haves list with None");
await pickRow("bc:must:metro"); await tap("bc:must:more"); await pickRow("bc:must:gym"); await tap("bc:must:done");
ok(/Here is the brief for Ms Rahman/.test(bodyText()) && /Areas: Dubai Marina, Jumeirah Village Circle/.test(bodyText()) && /from AED 80,000 up to AED 120,000/.test(bodyText()) && btns().map((b) => b.title).join() === "Search,Change,Cancel", "summary with Search / Change / Cancel", bodyText());
await tap("bc:go");
const expect = answersToQuery({ client: "Ms Rahman", mode: "rent", beds: ["1", "2"], type: "apartment", areas1: ["dubaimarina", "jumeirahvillagecircle"], max: "120000", min: "80000", musts: ["metro", "gym"] }).sp.toString();
ok(searches[searches.length - 1] === expect, "the search query is exactly what the form would give", searches[searches.length - 1] + " vs " + expect);
ok(/^Brief for Ms Rahman: Rent, 1 bed or 2 bed, apartment, up to AED 120,000, 2 area\(s\)\./.test(texts[0]) && /1\. Marina Gate 2, Dubai Marina: typical AED 98,000 a year/.test(texts[0]) && texts[0].indexOf("https://o/brief?" + expect) >= 0, "the reply is the form's reply with the Brief link", texts[0]);
ok(!store.has(BC_PREFIX + OWNER), "the brief is closed after the search");
ok(allSent.every(limitsOk), "every list and button message respects WhatsApp's limits (" + allSent.length + " messages)");

// ---- skip paths, Any, Change ----
searches.length = 0;
await say("brief"); await tap("bc:skip"); await tap("bc:mode:buy"); await pickRow("bc:beds:any");
ok(bodyText() === MSG.type, "Any bedrooms goes straight on");
await pickRow("bc:type:any"); await pickRow("bc:area:any");
ok(bodyText() === MSG.max, "Any area goes straight to budget");
await tap("bc:skip"); await tap("bc:skip"); await pickRow("bc:must:none");
ok(/Here is the brief:/.test(bodyText()) && /Budget: no limit/.test(bodyText()) && /Areas: Any area/.test(bodyText()), "skipped name and budgets show in the summary", bodyText());
await tap("bc:change");
ok(bodyText() === MSG.change && rows().length === 7, "Change offers what to change");
await pickRow("bc:chg:type"); await pickRow("bc:type:villa");
ok(/Home type: Villa/.test(bodyText()) && btns()[0].title === "Search", "a changed answer returns to the summary");
await tap("bc:go");
ok(searches[0] === answersToQuery({ mode: "buy", beds: ["studio", "1", "2", "3"], type: "villa" }).sp.toString(), "skip path query matches the form", searches[0]);

// ---- invalid input, re-ask ----
await say("brief"); await tap("bc:skip");
await say("maybe");
ok(bodyText() === MSG.sorry + MSG.mode, "unexpected text at a button step is asked again");
await tap("bc:type:villa");
ok(bodyText() === MSG.sorry + MSG.mode, "a stale button from another step is asked again");
await say("buy");
ok(bodyText() === MSG.beds, "typed buy is accepted");
await say("2 bedrooms");
ok(/Bedrooms so far: 2 bedrooms/.test(bodyText()), "typed 2 bedrooms is accepted");

// ---- a desk command mid-brief still works, and the brief stays open ----
await say("/desk_status");
ok(texts.some((t) => /Desk status/.test(t)) && raws.length === 0, "a desk command mid-brief runs normally", texts.join(" | "));
ok(store.has(BC_PREFIX + OWNER), "the brief is still open after it");
await say("lab");
ok(/Desk lab/.test(texts[0]), "lab still answers mid-brief");
await tap("bc:beds:next");
ok(bodyText() === MSG.type, "and the brief carries on where it was");
await say("cancel");
ok(texts[0] === MSG.cancelled && !store.has(BC_PREFIX + OWNER), "cancel closes the brief");

// ---- timeout ----
await say("brief"); store.delete(BC_PREFIX + OWNER);   // KV expiry after 30 minutes
await tap("bc:skip");
ok(texts[0] === MSG.expired, "a tap after the brief timed out says so");
await say("hello");
ok(!texts.some((t) => t === MSG.expired) && texts.some((t) => /Received/.test(t)), "ordinary text with no brief open is not taken by the brief");

// ---- the form stays reachable ----
await say("brief form");
ok(last() && last().interactive.type === "flow", "brief form still opens the form");

// ---- the Naj switch ----
const nenv = { MEETINGS: KV };
ok(!(await briefChatNajOn(nenv)), "Naj switch is OFF by default");
ok((await briefChatNajOn({ MEETINGS: KV, BRIEF_CHAT_NAJ: "1" })) === true, "env BRIEF_CHAT_NAJ=1 turns it on");
store.set("brief_chat_naj", "on"); ok(await briefChatNajOn(nenv), "KV brief_chat_naj=on turns it on"); store.delete("brief_chat_naj");
const naj = "971565484397", nr = [], nt = [];
ok(await briefChatRoute(nenv, naj, { type: "text", text: { body: "brief" } }, { raw: async (e, p) => { nr.push(p); return {}; }, send: async (e, t) => nt.push(t) }) && nr[0].to === naj && store.has(BC_PREFIX + naj), "with the switch on, Naj's brief would start in her own chat");
store.delete(BC_PREFIX + naj);
const src = (await import("node:fs")).readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
ok(/if \(await briefChatNajOn\(env\)\) \{/.test(src), "index.js calls the chat brief for Naj only behind the switch");

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
