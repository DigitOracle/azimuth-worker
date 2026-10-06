// v370 - QUESTIONNAIRE ENGINE (/ask_set, ns_ answers, /intake_status) and EVENT INTAKE (photo, text, voice). Offline: KV, WhatsApp and the extraction call stubbed.
//   node test/test_v370_intake.mjs
import worker from "../src/index.js";
import { NS_SETS, nsPartView } from "../src/ask_sets.js";

const HER = "971565484397", READ = "RK";
const store = new Map();
const KV = { async get(k) { return store.has(k) ? store.get(k).v : null; }, async put(k, v, o) { store.set(k, { v, ttl: o && o.expirationTtl }); }, async delete(k) { store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter(k => k.startsWith(p)).map(name => ({ name })), list_complete: true }; } };
let out = [], aiCalls = 0, extract = { kind: "flyer", events: [] };
globalThis.fetch = async (input, init) => {
  const u = String((input && input.url) || input), body = init && typeof init.body === "string" ? init.body : "";
  if (u.includes("api.anthropic.com")) { aiCalls++; return new Response(JSON.stringify({ content: [{ type: "text", text: JSON.stringify(extract) }], stop_reason: "end_turn" }), { status: 200 }); }
  if (u.includes("graph.facebook.com") && init && init.method === "POST") { out.push(JSON.parse(body || "{}")); return new Response(JSON.stringify({ messages: [{ id: "wamid.o" + out.length }] }), { status: 200 }); }
  if (u.includes("graph.facebook.com")) return new Response(JSON.stringify({ url: "https://media.test/m1", mime_type: "image/jpeg" }), { status: 200 });
  if (u.includes("media.test")) return new Response(new Uint8Array(500), { status: 200, headers: { "Content-Type": "image/jpeg" } });
  return new Response("{}", { status: 200 });
};
const ctx = { waitUntil(p) { p && p.catch && p.catch(() => {}); } };
const env = { MEETINGS: KV, READ_KEY: READ, WHATSAPP_TOKEN: "t", WA_PHONE_ID: "p", WA_ALLOWED: HER, MAILBOXES: "", ADD_TO: "", ANTHROPIC_API_KEY: "k", FEED_TEMPLATE: "azimuth_daily",
  AI: { async run() { return { text: "Event panel on resilience 14 Nov 18:00 at DIFC" }; } } };
const EMOJI = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
const MODEL = /\b(claude|gpt|chatgpt|openai|anthropic|gemini|llama|deepseek|opus|sonnet|haiku)\b/i;
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 300) : "")); } };
const ask = (qs, body) => worker.fetch(new Request("https://x/ask_set" + qs, { method: "POST", headers: { "Content-Type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) }), env, ctx);
let mid = 0;
const wa = (msg) => worker.fetch(new Request("https://x/wa", { method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: "p" }, messages: [Object.assign({ from: HER, id: "wamid.in" + (++mid) }, msg)] } }] }] }) }), env, ctx);
const tap = (id) => wa({ type: "interactive", interactive: { type: "list_reply", list_reply: { id, title: id } } });
const text = (b, extra) => wa(Object.assign({ type: "text", text: { body: b } }, extra || {}));
const said = () => out.map(o => (o.text && o.text.body) || (o.interactive && o.interactive.body && o.interactive.body.text) || "");
const last = () => said()[out.length - 1];
const intake = () => JSON.parse(store.has("najj_intake") ? store.get("najj_intake").v : "{}");
const dub = (off) => new Date(Date.now() + 4 * 3600000 + off * 86400000).toISOString().slice(0, 10);

console.log("1 - auth, validation, dry run per part");
let r = await ask("", { set: "najjesty_intake", part: "A" }); ok(r.status === 401, "no key: 401");
r = await ask("?key=bad", { set: "najjesty_intake", part: "A" }); ok(r.status === 401, "wrong key: 401");
r = await ask("?key=RK", { set: "najjesty_intake", part: "D" }); ok(r.status === 400, "unknown part: 400");
r = await ask("?key=RK", { set: "nope", part: "A" }); ok(r.status === 400, "unknown set: 400");
r = await ask("?key=RK", { set: "__proto__", part: "A" }); ok(r.status === 400, "prototype key: 400");
r = await ask("?key=RK", { set: "najjesty_intake", part: "A", intro: "x".repeat(901) }); ok(r.status === 400, "intro over 900: 400");
r = await ask("?key=RK", { set: "najjesty_intake", part: "A", intro: "  " }); ok(r.status === 400, "blank intro: 400");
r = await ask("?key=RK", { set: "najjesty_intake", part: "A", questions: [{ body: "free text" }] }); let j = await r.json();
ok(r.status === 200 && JSON.stringify(j).indexOf("free text") < 0, "arbitrary question text in the request is ignored");
r = await ask("?key=RK", "not json"); ok(r.status === 400, "bad json: 400");
ok(out.length === 0, "rejected requests and dry runs send nothing");
const want = { A: { n: 5, rows: [4, 5, 3, 5, 2], intro: "Black Coffee, three quick taps to lock your posting rhythm." }, B: { n: 6, rows: [5, 8, 3, 6, 4, 4], intro: "Black Coffee, a few taps on what the page says. Everything is about emotional intelligence in your voice." }, C: { n: 5, rows: [3, 5, 3, 3, 2], intro: "Black Coffee, last part: your events and who helps." } };
const allIds = [];
for (const part of ["A", "B", "C"]) {
  r = await ask("?key=RK&to=971500000000", { set: "najjesty_intake", part, to: "971500000000" }); j = await r.json();
  console.log("  dry-run " + part + ": " + JSON.stringify({ intro: j.intro, questions: j.questions.map(q => ({ body: q.body, button: q.button, rows: q.rows.map(x => x.title + (x.description ? " [" + x.description + "]" : "") + " <" + x.id + ">") })) }));
  ok(r.status === 200 && j.dry === true && j.to === HER, part + ": dry by default; recipient fixed to env.WA_ALLOWED");
  ok(j.intro === want[part].intro && j.questions.length === want[part].n, part + ": default intro and " + want[part].n + " questions");
  ok(JSON.stringify(j.questions.map(q => q.rows.length)) === JSON.stringify(want[part].rows), part + ": row counts " + want[part].rows.join(","));
  const ids = j.questions.flatMap(q => q.rows.map(x => x.id)); allIds.push(...ids);
  ok(ids.every(i => new RegExp("^ns_" + part + "_q[1-6]_[a-z0-9]+$").test(i)), part + ": every id is ns_" + part + "_<q>_<opt>");
  ok(j.questions.every(q => q.rows.length <= 10 && q.rows.every(x => x.title.length <= 24 && x.description.length <= 72) && q.body.length <= 1024 && q.button.length <= 20), part + ": WhatsApp limits (10 rows, title 24, description 72, button 20)");
  ok(j.questions.every(q => new Set(q.rows.map(x => x.id)).size === q.rows.length), part + ": ids unique within each list");
  ok(!EMOJI.test(JSON.stringify(j)) && !MODEL.test(JSON.stringify(j)), part + ": no emoji, no model name");
}
ok(new Set(allIds).size === allIds.length && allIds.length === 4 + 5 + 3 + 5 + 2 + 5 + 8 + 3 + 6 + 4 + 4 + 3 + 5 + 3 + 3 + 2, "all 69 ids unique across parts");
r = await ask("?key=RK", { set: "najjesty_intake", part: "B" }); j = await r.json();
ok(j.questions[3].rows.map(x => x.title).join("|") === "Courage to See Yourself|Power of Witnessing Pain|The Power of the Pause|No.|Guilt That Comes After|Book launch video", "B4 episode titles fit 24 characters");
ok(j.questions[3].rows[0].description === "The Courage to See Yourself", "B4 long titles carry the full wording in the description");
r = await ask("?key=RK", { set: "najjesty_intake", part: "A", intro: "Custom intro, Black Coffee." }); j = await r.json();
ok(j.intro === "Custom intro, Black Coffee.", "an intro string overrides the default");

console.log("2 - closed window queues, open window sends");
r = await ask("?key=RK&dry=0", { set: "najjesty_intake", part: "A" }); j = await r.json();
ok(j.queued === true && store.has("ns_pending") && store.get("ns_pending").ttl === 3600, "closed window: queued in ns_pending with 1 h expiry");
ok(out.length <= 1 && out.every(o => o.to === HER), "closed window: only the template nudge went out, to her");
out = [];
await text("hello"); await new Promise(r => setTimeout(r, 100));
ok(!store.has("ns_pending") && said()[0] === NS_SETS.najjesty_intake.parts.A.intro && out.filter(o => o.interactive && o.interactive.type === "list").length === 5, "her next message flushes: intro then 5 lists");
out = [];
await store.set("wa_owner_last_in", { v: new Date().toISOString() });
r = await ask("?key=RK&dry=0", { set: "najjesty_intake", part: "A" }); j = await r.json();
ok(j.ok === true && out.length === 6 && out[0].text && out.slice(1).every(o => o.interactive.type === "list" && o.to === HER), "open window: intro + 5 lists, all to her");
ok(out.slice(1).every(o => o.interactive.action.sections[0].rows.every(x => x.title.length <= 24)), "sent rows within the title limit");

console.log("3 - answers, confirmations, part done, no auto-chain");
out = [];
await tap("ns_A_q1_monwedsat");
ok(last() === "Locked in: Posting days - Mon + Wed + Sat.", "confirm: " + last());
ok(intake().A.q1 === "Mon + Wed + Sat" && !!intake().at, "stored under najj_intake.A.q1 with a timestamp");
await tap("ns_A_q2_1700"); await tap("ns_A_q3_halfandhalf"); await tap("ns_A_q4_morningof");
ok(!said().some(s => /Part A done/.test(s)), "no 'done' before the last question");
await tap("ns_A_q5_keepthefivewes");
const doneA = said().filter(s => /Part A done/.test(s));
ok(doneA.length === 1 && /^Part A done, Black Coffee\./.test(doneA[0]) && /Curated by Papi$/.test(doneA[0]), "last answer: 'Part A done, Black Coffee.' closing 'Curated by Papi'", doneA[0]);
ok(last() === doneA[0], "the done message is the final one");
const before = out.length; await tap("ns_A_q2_1200");
ok(out.length === before + 1 && intake().A.q2 === "12:00", "re-answering updates and does not repeat 'done'");
ok(!out.some(o => o.interactive && o.interactive.type === "list") && !store.has("ns_pending"), "Part B is NOT sent automatically");
ok(JSON.stringify(Object.keys(intake()).sort()) === JSON.stringify(["A", "at"]), "record shape {A:{..},at}");

console.log("4 - Other flow");
out = [];
await tap("ns_B_q2_other");
ok(last() === "Type it in one line." && store.get("ns_other").ttl === 1800, "Other asks for one line, expiry 30 min");
await text("Grief and resilience");
ok(intake().B.q2 === "Grief and resilience" && /^Locked in: Lead topic - Grief and resilience\.$/.test(last()), "her next text is stored under B2 and confirmed");
ok(!store.has("ns_other"), "the pending Other is consumed");
aiCalls = 0; out = [];
await text("event");
ok(!/Locked in/.test(last()) && /^To add an event, type: event/.test(last()), "after the Other is consumed, text goes to its normal route");
await tap("ns_A_q1_other"); const o = JSON.parse(store.get("ns_other").v); o.at = Date.now() - 31 * 60000; store.set("ns_other", { v: JSON.stringify(o) });
out = []; await text("Sun + Mon");
ok(intake().A.q1 === "Mon + Wed + Sat" && !out.some(s => /Locked in/.test((s.text && s.text.body) || "")), "an Other older than 30 minutes is ignored; the old answer stands");
await tap("ns_C_q1_yesiwillsendth"); ok(intake().C.q1 === "Yes, I will send them", "C1 stored");
await tap("ns_C_q2_atypeit".replace("atypeit", "itypeit")); await tap("ns_C_q3_yeshostsandspe"); await tap("ns_C_q4_myteamreplies");
out = []; await tap("ns_C_q5_editinchatfirs");
const doneC = said().find(s => /Part C done/.test(s));
ok(/^Part C done, Black Coffee\. To add an event later, send a photo of the flyer with the word event, or type: event, then the name, date, time and place\.\n\nCurated by Papi$/.test(doneC || ""), "Part C closing carries the event instructions", doneC);
r = await worker.fetch(new Request("https://x/intake_status?key=RK"), env, ctx); j = await r.json();
ok(r.status === 200 && j.A.q1 === "Mon + Wed + Sat" && j.C.q5 === "Edit in chat first", "/intake_status returns najj_intake");
r = await worker.fetch(new Request("https://x/intake_status"), env, ctx); ok(r.status === 401, "/intake_status needs the key");
ok(!EMOJI.test(JSON.stringify(out)) && !MODEL.test(JSON.stringify(out)), "no emoji, no model name in the confirmations");

console.log("5 - event intake");
out = []; extract = { kind: "flyer", events: [{ title: "Panel on resilience", date: dub(10), time: "18:00", place: "DIFC", note: "" }] };
await wa({ type: "image", image: { id: "m1", mime_type: "image/jpeg", caption: "speaking event" } });
ok(/^I found 1 event in this picture:/.test(last()) && out[out.length - 1].interactive.action.buttons.length === 2, "photo captioned 'speaking event': confirm card with yes/no buttons");
ok([...store.keys()].filter(k => k.startsWith("evt_")).length === 0 && !store.has("najj_events"), "nothing filed before her tap");
let yes = out[out.length - 1].interactive.action.buttons[0].reply.id;
await wa({ type: "interactive", interactive: { type: "button_reply", button_reply: { id: yes, title: "Add all" } } });
let ev = [...store.entries()].filter(([k]) => k.startsWith("evt_")).map(([, e]) => JSON.parse(e.v));
ok(ev.length === 1 && ev[0].tag === "speaking_engagement" && ev[0].summary === "Panel on resilience", "photo: filed in the meeting store with tag speaking_engagement");
let L = JSON.parse(store.get("najj_events").v);
ok(L.length === 1 && L[0].title === "Panel on resilience" && L[0].time === "18:00" && L[0].place === "DIFC" && L[0].source === "photo" && !!L[0].at, "photo: najj_events entry with source 'photo'");
out = []; aiCalls = 0; extract = { kind: "flyer", events: [{ title: "Breakfast talk", date: dub(20), time: null, place: "Jumeirah", note: "" }] };
await text("event Breakfast talk, Jumeirah, in 20 days");
ok(aiCalls === 1 && /^I found 1 event/.test(last()) && out[out.length - 1].interactive.action.buttons.length === 2, "text 'event ...': same extraction call, same confirm card");
ok([...store.keys()].filter(k => k.startsWith("evt_")).length === 1, "text: nothing filed before her tap");
yes = out[out.length - 1].interactive.action.buttons[0].reply.id;
await wa({ type: "interactive", interactive: { type: "button_reply", button_reply: { id: yes, title: "Add all" } } });
L = JSON.parse(store.get("najj_events").v);
ok(L.length === 2 && L[1].source === "text" && [...store.entries()].some(([k, e]) => k.startsWith("evt_") && /speaking_engagement/.test(e.v) && /Breakfast/.test(e.v)), "text: filed and listed with source 'text'");
out = []; extract = { kind: "flyer", events: [{ title: "Book club", date: dub(15), time: "19:00", place: "Dubai", note: "" }] };
await text("event Book club 19:00", { context: { forwarded: true } });
yes = out[out.length - 1].interactive.action.buttons[0].reply.id;
await wa({ type: "interactive", interactive: { type: "button_reply", button_reply: { id: yes, title: "Add all" } } });
ok(JSON.parse(store.get("najj_events").v)[2].source === "forward", "a forwarded message is recorded with source 'forward'");
out = []; aiCalls = 0; extract = { kind: "flyer", events: [{ title: "Panel on resilience", date: dub(40), time: "18:00", place: "DIFC", note: "" }] };
await wa({ type: "audio", audio: { id: "a1" } });
ok(aiCalls === 1 && /^I found 1 event/.test(last()), "voice note starting 'event': transcribed, then the same parser and confirm card");
out = []; yes = null;
await text("event Gala, no date at all"); extract = { kind: "other", events: [] };
out = []; await text("event just chatting");
ok(/^I could not find a date/.test(last()), "no date found: she is told how to type it");
out = []; aiCalls = 0; await text("eventually I will call Sara tomorrow 3pm");
ok(aiCalls <= 3 && !/I found/.test(said().join()) && !/To add an event/.test(said().join()), "a word that only starts with 'event' is not routed to event intake");
out = []; await wa({ type: "image", image: { id: "m2", mime_type: "image/jpeg", caption: "talk" } });
ok(aiCalls >= 1 && /could not find|I found/.test(last()), "a picture captioned 'talk' is claimed by the extraction route");

console.log("6 - regression: plan_, poll and fit handlers untouched");
out = [];
await wa({ type: "interactive", interactive: { type: "list_reply", list_reply: { id: "plan_q1_montue", title: "Mon + Thu" } } });
ok(JSON.parse(store.get("najj_plan").v).q1 === "Mon + Thu" && /^Locked in: Which days for your NAJJESTY plan - Mon \+ Thu\.$/.test(last()), "plan_ answers still go to najj_plan");
ok(!store.get("najj_intake").v.includes("Mon + Thu\""), "...and not into najj_intake");
out = [];
await wa({ type: "interactive", interactive: { type: "button_reply", button_reply: { id: "fit:undo:zzz", title: "Undo" } } });
ok(!intake().fit && !said().some(s => /Locked in/.test(s)), "fit: ids do not reach the questionnaire");
await tap("ns_Z_q1_x"); ok(!said().some(s => /Locked in/.test(s)), "an unknown ns_ id is ignored");
ok(nsPartView("najjesty_intake", "A").questions.length === 5, "view helper");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
