// v367 - PLAN QUESTIONS BY DROPDOWN (Kendall, 6 Oct 2026). Offline: KV and WhatsApp stubbed.
//   node test/test_v367_plan_ask.mjs
import worker from "../src/index.js";

const HER = "971565484397";
const mkKV = () => { const m = new Map(); return { m, async get(k) { return m.has(k) ? m.get(k) : null; }, async put(k, v) { m.set(k, v); }, async delete(k) { m.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...m.keys()].filter(k => k.startsWith(p)).map(name => ({ name })) }; } }; };
const sent = [];
globalThis.fetch = async (url, init) => {
  if (String(url).includes("graph.facebook.com")) { sent.push(JSON.parse(init.body)); return new Response(JSON.stringify({ messages: [{ id: "wamid.o" + sent.length }] }), { status: 200 }); }
  return new Response("{}", { status: 200 });
};
const ctx = { waitUntil(p) { p && p.catch && p.catch(() => {}); } };
const env = { MEETINGS: mkKV(), READ_KEY: "RK", WHATSAPP_TOKEN: "t", WA_PHONE_ID: "p", WA_ALLOWED: HER, MAILBOXES: "", FEED_TEMPLATE: "azimuth_daily", AI: { async run() { return { response: "{}" }; } } };
const EMOJI = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
const MODEL = /\b(claude|gpt|chatgpt|openai|anthropic|gemini|llama|deepseek|opus|sonnet|haiku)\b/i;
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 300) : "")); } };
const INTRO = "Black Coffee, four quick taps and your plan is set. Pick from each list below.\n\nCurated by Papi";
const ask = (qs, body, e) => worker.fetch(new Request("https://x/plan_ask" + qs, { method: "POST", headers: { "Content-Type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) }), e || env, ctx);
let mid = 0;
const tap = (id, e) => worker.fetch(new Request("https://x/wa", { method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: "p" }, messages: [{ from: HER, id: "wamid.in" + (++mid), type: "interactive", interactive: { type: "list_reply", list_reply: { id, title: id } } }] } }] }] }) }), e || env, ctx);
const text = (b, e) => worker.fetch(new Request("https://x/wa", { method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: "p" }, messages: [{ from: HER, id: "wamid.in" + (++mid), type: "text", text: { body: b } }] } }] }] }) }), e || env, ctx);

console.log("1 - auth and dry run");
let r = await ask("", { intro: INTRO });
ok(r.status === 401, "no key: 401");
r = await ask("?key=bad", { intro: INTRO });
ok(r.status === 401, "wrong key: 401");
r = await ask("?key=RK", { intro: "" });
ok(r.status === 400, "empty intro: 400");
r = await ask("?key=RK", { intro: "x".repeat(901) });
ok(r.status === 400, "intro over 900 characters: 400");
r = await ask("?key=RK", "not json");
ok(r.status === 400, "bad json: 400");
ok(sent.length === 0, "nothing sent by rejected requests");
r = await ask("?key=RK&to=971500000000", { intro: INTRO, to: "971500000000" });
let j = await r.json();
ok(r.status === 200 && j.dry === true && j.to === HER, "dry by default; recipient is env.WA_ALLOWED, a 'to' parameter or body field is ignored", JSON.stringify(j).slice(0, 200));
ok(sent.length === 0, "dry run sends nothing");
ok(j.intro === INTRO && j.questions.length === 4, "dry run shows the intro and four questions");
const ids = j.questions.map(q => q.rows.map(x => x.id));
ok(JSON.stringify(ids[0]) === JSON.stringify(["plan_q1_montue", "plan_q1_tuefri", "plan_q1_wedsat", "plan_q1_weekly"]), "Q1 row ids", ids[0]);
ok(JSON.stringify(j.questions[0].rows.map(x => x.title)) === JSON.stringify(["Mon + Thu", "Tue + Fri", "Wed + Sat", "Weekly (one day)"]), "Q1 titles");
ok(j.questions[0].body === "Which days for your NAJJESTY plan?" && j.questions[1].body === "What time?" && j.questions[2].body === "Your NAJMA morning five" && j.questions[3].body === "Momo check-ins", "question wording");
ok(j.questions[1].rows.map(x => x.title).join() === "08:00,12:00,17:00,20:00", "Q2 rows");
ok(j.questions[2].rows.map(x => x.title).join() === "Keep at 05:00,06:00,07:00", "Q3 rows");
ok(j.questions[3].rows.map(x => x.title).join() === "Keep 21:00 + 05:00,Move to 20:00 + 06:00,Evening only", "Q4 rows");
ok(ids.flat().every(i => /^plan_q[1-4]_[a-z0-9]+$/.test(i)) && new Set(ids.flat()).size === 14, "all 14 ids are plan_-prefixed and unique");
ok(j.questions.every(q => q.rows.every(x => x.title.length <= 24 && x.description.length <= 72)), "titles <= 24, descriptions <= 72 (WhatsApp limits)");
ok(j.window_open === false && /template najma_feed_ready/.test(j.path), "dry run says the window is closed and what the path would be");
const alltxt = JSON.stringify(j.questions) + INTRO;
ok(!EMOJI.test(alltxt) && !MODEL.test(alltxt), "no emoji, no model name in what is sent");

console.log("2 - window open: send for real");
await env.MEETINGS.put("wa_owner_last_in", new Date().toISOString());
r = await ask("?key=RK&dry=0", { intro: INTRO });
j = await r.json();
ok(j.ok && j.sent, "dry=0 sends", JSON.stringify(j));
ok(sent.length === 5 && sent.every(m => m.to === HER), "five messages, all to env.WA_ALLOWED", sent.length);
ok(sent[0].type === "text" && sent[0].text.body === INTRO, "first is the intro text, exact");
const lists = sent.slice(1);
ok(lists.every(m => m.type === "interactive" && m.interactive.type === "list"), "then four interactive lists");
ok(lists[0].interactive.action.sections[0].rows[0].id === "plan_q1_montue" && lists[3].interactive.action.sections[0].rows.length === 3, "list rows carry the ids");
ok(!(await env.MEETINGS.get("plan_pending")), "window open: nothing queued");

console.log("3 - her answers");
sent.length = 0;
await tap("plan_q1_montue");
let rec = JSON.parse(await env.MEETINGS.get("najj_plan"));
ok(rec.q1 === "Mon + Thu" && !!rec.at, "Q1 stored in najj_plan with a timestamp", JSON.stringify(rec));
ok(sent.length === 1 && /^Locked in: /.test(sent[0].text.body) && /Mon \+ Thu/.test(sent[0].text.body), "short confirmation 'Locked in: ...'", sent[0] && sent[0].text.body);
await tap("plan_q2_1700"); await tap("plan_q3_keep0500");
ok(!sent.some(m => m.text && /All set/.test(m.text.body)), "not 'All set' with three of four in");
await tap("plan_q4_eve");
rec = JSON.parse(await env.MEETINGS.get("najj_plan"));
ok(rec.q1 === "Mon + Thu" && rec.q2 === "17:00" && rec.q3 === "Keep at 05:00" && rec.q4 === "Evening only", "all four stored", JSON.stringify(rec));
ok(sent[sent.length - 1].text.body === "All set, Black Coffee. Curated by Papi", "final message when all four are in");
ok(sent.every(m => m.to === HER && !EMOJI.test(m.text.body) && !MODEL.test(m.text.body)), "confirmations: to her, no emoji, no model name");
await tap("plan_q2_0800");
ok(JSON.parse(await env.MEETINGS.get("najj_plan")).q2 === "08:00", "changing an answer overwrites it");
ok(!env.MEETINGS.m.has("feed_hour") && !env.MEETINGS.m.has("FEED_HOUR_GST"), "Q3 changes no schedule (no schedule key written)");
sent.length = 0;
await tap("plan_q9_nope"); await tap("plan_q1_bogus");
ok(sent.length === 0, "an unknown plan_ id is not answered");
r = await worker.fetch(new Request("https://x/plan_status?key=RK"), env, ctx);
j = await r.json();
ok(r.status === 200 && j.q4 === "Evening only" && j.q1 === "Mon + Thu", "GET /plan_status returns najj_plan");
r = await worker.fetch(new Request("https://x/plan_status?key=zz"), env, ctx);
ok(r.status === 401, "/plan_status needs the key");
const env0 = Object.assign({}, env, { MEETINGS: mkKV() });
r = await worker.fetch(new Request("https://x/plan_status?key=RK"), env0, ctx);
ok((await r.text()) === "{}", "/plan_status on an empty store is {}");

console.log("4 - window closed: template first, queue, flush on her reply");
const envC = Object.assign({}, env, { MEETINGS: mkKV() });
sent.length = 0;
r = await ask("?key=RK&dry=0", { intro: INTRO }, envC);
j = await r.json();
ok(j.queued === true && j.ok === true, "queued", JSON.stringify(j));
ok(sent.length === 1 && sent[0].type === "template" && sent[0].to === HER, "exactly one message: a template, no free text");
ok(sent[0].template.name === "azimuth_daily" || sent[0].template.name === "najma_feed_ready", "template used: " + sent[0].template.name);
const pend = JSON.parse(await envC.MEETINGS.get("plan_pending"));
ok(pend && pend.intro === INTRO, "intro queued in KV plan_pending");
await envC.MEETINGS.put("feed_tmpl_flag", "najma_feed_ready");
sent.length = 0;
await text("hello", envC);
await new Promise(r2 => setTimeout(r2, 50));
const out = sent.filter(m => m.to === HER);
const li = out.filter(m => m.interactive && m.interactive.type === "list");
ok(out.some(m => m.text && m.text.body === INTRO) && li.length === 4 && li[0].interactive.action.sections[0].rows[0].id === "plan_q1_montue", "her reply sends the intro and four lists", out.length);
ok(!(await envC.MEETINGS.get("plan_pending")), "queue cleared after flush");
sent.length = 0;
await text("hello again", envC); await new Promise(r2 => setTimeout(r2, 20));
ok(!sent.some(m => m.interactive && m.interactive.type === "list"), "a second message does not resend");

console.log("5 - existing handlers unaffected");
sent.length = 0;
await tap("zzz:unknown");
ok(!(await env.MEETINGS.get("najj_plan_x")), "a non-plan id never touches najj_plan");
const before = await env.MEETINGS.get("najj_plan");
await tap("feed:1"); await tap("fs:pick"); await tap("bq:p1:1:y");
ok((await env.MEETINGS.get("najj_plan")) === before, "feed:, fs:, bq: taps leave najj_plan untouched");
ok(!sent.some(m => m.text && /Locked in/.test(m.text.body)), "no plan confirmation on other handlers' ids");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
