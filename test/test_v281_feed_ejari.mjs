// v281 - EJARI · WHAT MOVED, the morning card (Kendall, 1 Oct 2026: "the last pull from Ejari, a day or week, as a bar chart or quick
// look in cards, so she knows what moved the day before or the week before"; day / week / month; top 5 / 10 / 15 / 20 districts; the
// sub-type; the register's project name, Arabic name and number).
// Runs the real morning through /feed_test with the model, WhatsApp, the owner note and the Cloudflare render API stubbed, and the
// Ejari files from test/ejari_stub.mjs (the DDA session's shapes, invented figures).
// NEGATIVE CONTROL: set EJ_MAX_AGE_DAYS in src/feed_ejari.js to 999 (the stale-data guard off) and block C fails - the card goes out
// on five-day-old data. Verified on 1 Oct 2026, then restored.
import worker from "../src/index.js";
import { feedEjariView, ejariModel, ejariLoad, ejariCardHtml } from "../src/feed_ejari.js";
import { ejariStubKV } from "./ejari_stub.mjs";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };
const A = (hook, figure, source, family, reader) => ({ hook, figure, source, buyer: "b", family, reader });
const FIVE = [
  A("The plan targets 5.8 million residents by 2040.", "5.8 million (2040 target); 3.3 million (2020 baseline)", "Dubai Media Office, 13 Mar 2021", "growth_plan", "authority"),
  A("Dubai is adding 6,500 km of walking paths.", "6,500 km", "Dubai Media Office, 4 Mar 2025", "city_life", "move"),
  A("Land for schools and health rises 25% by 2040.", "25%", "Dubai Media Office, 13 Mar 2021", "education", "move"),
  A("City of Arabia moved 1,128 sales.", "1,128 sales", "DLD Open Data, 2026-09-20", "district", "invest"),
  A("Rents settled at 71,400 contracts.", "71,400 contracts", "DLD Open Data, 2026-09-20", "rents_yields", "move")
];

// ---- harness: the real worker, everything that leaves it stubbed ---------------------------------------------------------------
let sent = [], owner = [], renders = [], renderFail = false;
globalThis.fetch = async (u, o) => {
  const url = String(u && u.url ? u.url : u);
  if (/anthropic/i.test(url)) {
    let body = {}; try { body = JSON.parse(String(o && o.body || "{}")); } catch (e) {}
    const sys = JSON.stringify(body.system || "");
    let text;
    if (/last quality check/.test(sys)) {
      let today = []; try { const msg = body.messages[0].content; today = JSON.parse(typeof msg === "string" ? msg : msg[0].text).today; } catch (e) {}
      text = JSON.stringify({ verdicts: today.map(t => ({ angle: t.angle, repeat: false, why: "new" })) });
    } else if (/rewrite social-post hooks/.test(sys)) text = JSON.stringify({ items: [] });
    else text = JSON.stringify({ angles: /TOP-UP/.test(sys) ? [] : FIVE });
    return new Response(JSON.stringify({ content: [{ type: "text", text }], stop_reason: "end_turn" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  if (/browser-rendering\/screenshot/.test(url)) {   // the scene cards' render path (CF_RENDER_TOKEN): capture the HTML, answer a PNG
    let b = {}; try { b = JSON.parse(String(o && o.body || "{}")); } catch (e) {}
    renders.push(b.html || "");
    if (renderFail) return new Response("boom", { status: 500 });
    return new Response(new Uint8Array(9000).fill(7), { status: 200, headers: { "Content-Type": "image/png" } });
  }
  if (/graph\.facebook\.com/.test(url)) { let b = {}; try { b = JSON.parse(String(o && o.body || "{}")); } catch (e) {} sent.push(b); return new Response(JSON.stringify({ messages: [{ id: "wamid." + sent.length }] }), { status: 200 }); }
  if (/owner_note/.test(url)) { try { owner.push(JSON.parse(String(o.body)).text); } catch (e) {} return new Response("sent", { status: 200 }); }
  return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
};
const READ = "owner_admin_key_never_in_client_links_0001", CLIENT = "client_link_key_v281_abcdef";
const mkEnv = (store) => {
  const KV = { async get(k, t) { if (!store.has(k)) return null; const v = store.get(k); return t === "json" ? JSON.parse(v) : t === "arrayBuffer" ? (typeof v === "string" ? new TextEncoder().encode(v).buffer : v) : v; },   // like real KV: text comes back as bytes
    async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); },
    async list(o) { return { keys: [...store.keys()].filter((k) => !o || !o.prefix || k.startsWith(o.prefix)).map((name) => ({ name })), list_complete: true }; } };
  return { MEETINGS: KV, AI: { run: async () => ({ response: "{}" }) }, READ_KEY: READ, CLIENT_KEY: CLIENT, MARKET_BRIEF: "on", ANTHROPIC_API_KEY: "test-only-not-a-key",
    PUBLIC_ORIGIN: "https://azimuth-2.example", CF_RENDER_TOKEN: "test-only", CF_ACCOUNT_ID: "acc",
    WA_ALLOWED: "971565484397", WHATSAPP_TOKEN: "t", WA_PHONE_ID: "1", FEED_SCENES: "on", OWNER_NOTE_URL: "https://mc/owner_note", INGEST_TOKEN: "i" };
};
// a fixed Dubai morning: 05:00 GST on `day` (01:00 UTC) - the feed hour since v289 (was 06:00). gstNow() and the card read Date.now().
const realNow = Date.now;
const at = (day) => { const t = Date.parse(day + "T01:00:00Z"); Date.now = () => t; };
const addD = (s, n) => new Date(Date.parse(s + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
const run = async (day, kv, opts) => {
  opts = opts || {}; at(day); sent = []; owner = []; renders = []; renderFail = !!opts.renderFail;
  const store = opts.store || new Map([["mkt_latest", JSON.stringify({ generatedAt: new Date(Date.now()).toISOString() })], ["wa_owner_last_in", new Date(Date.now()).toISOString()]]);
  for (const k in (kv || {})) store.set(k, kv[k]);
  const env = mkEnv(store);
  const r = await worker.fetch(new Request("https://x/feed_test?key=" + READ + (opts.dry ? "&dry=1" : "")), env, { waitUntil() {} });
  const out = await r.text();
  let qa = null; try { qa = JSON.parse(store.get("mkt_feed_qa") || "null"); } catch (e) {}
  const kinds = sent.map(b => b.type === "text" && /Najma daily/.test(b.text.body) ? "morning" : b.type === "interactive" ? b.interactive.type : b.type === "image" && /\/img\/ejcard_/.test(b.image.link) ? "ejari" : b.type);
  const card = sent.find(b => b.type === "image" && /\/img\/ejcard_/.test(b.image.link));
  Date.now = realNow;
  return { out, qa, store, kinds, card, caption: card ? card.image.caption : "", html: renders[renders.length - 1] || "", note: qa ? qa.note : "" };
};

// ---- A. the card goes straight after the morning list and its picker, before the picture offer ---------------------------------
const DAY = "2026-09-30";   // a Wednesday: DAY
const a = await run(DAY, ejariStubKV(DAY));
const iM = a.kinds.indexOf("morning"), iL = a.kinds.indexOf("list"), iE = a.kinds.indexOf("ejari"), iB = a.kinds.indexOf("button");
ok(iM >= 0 && iE > iM, "the Ejari card is sent after the morning message: " + a.kinds.join(" > "));
ok(iL >= 0 && iE === iL + 1, "it is the very next message after the morning's list picker (the opening of her morning)");
ok(iB > iE, "and the picture offer still follows it");
ok(a.card && /\/img\/ejcard_20260930_day$/.test(a.card.image.link), "rendered through the scene cards' path and stored under /img/: " + (a.card && a.card.image.link));
ok(renders.length >= 1 && a.store.get("img_ct_ejcard_20260930_day") === "image/png", "the PNG is in KV the way every card is");
ok(/Ejari card sent: DAY top 5/.test(a.note), "the QA line records it: " + (a.note.match(/Ejari card[^|]*/) || [""])[0]);

// ---- B. which view goes out, by date ----------------------------------------------------------------------------------------
ok(feedEjariView("2026-09-30") === "day" && feedEjariView("2026-10-03") === "day", "a weekday morning is DAY");
ok(feedEjariView("2026-09-28") === "week" && feedEjariView("2026-10-05") === "week", "a Monday is WEEK");
ok(feedEjariView("2026-10-01") === "month" && feedEjariView("2026-11-01") === "month", "the 1st is MONTH");
ok(feedEjariView("2026-06-01") === "month", "the 1st wins over a Monday (1 Jun 2026 is both)");
ok(/view=day&top=5/.test(a.caption) && /<span class="on">DAY<\/span>/.test(a.html) && /filed with Ejari yesterday/.test(a.html), "Wednesday: DAY on the card and in the link, yesterday against the 7-day average");
ok(/on the 7-day average/.test(a.html), "DAY compares with the 7-day average");
const MONDAY = "2026-09-28", wk = await run(MONDAY, ejariStubKV(MONDAY));
ok(wk.card && /view=week&top=5/.test(wk.caption) && /<span class="on">WEEK<\/span>/.test(wk.html) && /on the 7 days before/.test(wk.html), "Monday: WEEK, the last 7 days against the 7 before");
ok(/21–27 Sep/.test(wk.html), "and it names the seven days it counted (21-27 Sep)");
const FIRST = "2026-10-01", mo = await run(FIRST, ejariStubKV(FIRST));
ok(mo.card && /view=month&top=5/.test(mo.caption) && /<span class="on">MONTH<\/span>/.test(mo.html) && /on the 30 days before/.test(mo.html), "the 1st: MONTH, the last 30 days against the 30 before");

// ---- C. stale or missing data: no card, a feed-log line, the morning untouched -------------------------------------------------
const st = await run(DAY, ejariStubKV(addD(DAY, -5)));
ok(!st.card, "data five days old: no card");
ok(st.kinds.includes("morning") && st.kinds.includes("button"), "the morning and the picture offer still go");
ok(/Ejari card SKIPPED: the Ejari data is 5 days old/.test(st.note), "and the QA line says why: " + (st.note.match(/Ejari card[^|]*/) || [""])[0]);
ok(!renders.length, "nothing was even rendered, so no stale number exists anywhere");
const edge = await run(DAY, ejariStubKV(addD(DAY, -3)));
ok(!!edge.card, "three days old is still inside the limit, and goes");
const none = await run(DAY, {});
ok(!none.card && /Ejari card SKIPPED: no Ejari data/.test(none.note) && none.kinds.includes("morning"), "no Ejari file at all: skipped, logged, morning sent");
const junk = await run(DAY, { img_ejari_filed_dubai: "{not json" });
ok(!junk.card && /Ejari card SKIPPED/.test(junk.note) && junk.kinds.includes("button"), "an unreadable file: skipped, and the chain carries on");
const rf = await run(DAY, ejariStubKV(DAY), { renderFail: true });
ok(!rf.card && /Ejari card SKIPPED: the render failed/.test(rf.note) && rf.kinds.includes("button"), "a failed render: skipped, and the chain carries on");

// ---- D. desk_like never ranks in MOST LET and is never counted --------------------------------------------------------------
ok(!/REGUS/i.test(a.html), "the flexi-desk business centre (400 desks a day in the stub) is not on the card");
{
  const kvD = ejariStubKV(DAY), kvN = ejariStubKV(DAY, { noDesk: true });
  const env = (kv) => ({ MEETINGS: { get: async (k) => kv[k] == null ? null : kv[k] } });
  const mD = ejariModel(await ejariLoad(env(kvD)), "day", DAY), mN = ejariModel(await ejariLoad(env(kvN)), "day", DAY);
  ok(mD.newLeases.n === mN.newLeases.n && mD.most.map(x => x.no).join() === mN.most.map(x => x.no).join(), "with and without the desk rows the counts and MOST LET are identical (" + mD.newLeases.n + ")");
  ok(!mD.most.some(x => x.no === "7001"), "desk_like project #7001 is not in MOST LET");
}

// ---- E. the register's identity on every MOST LET row: app name, project name, Arabic name, number -------------------------------
ok(/DAMAC Maison Canal Views/.test(a.html), "the app's building name");
ok(/THE VOGUE/.test(a.html) && /ذا فوغ/.test(a.html) && /#444/.test(a.html), "THE VOGUE · its Arabic name · #444");
ok(/BINGHATTI AMBER/.test(a.html) && /#2673/.test(a.html), "and the others carry theirs");
ok(/BY TYPE · EJARI SUB-TYPE/.test(a.html) && /Hotel apartment/.test(a.html) && /1 bed \+ hall/.test(a.html), "the sub-type row, in the register's words (Hotel -> Hotel apartment)");
ok(/TOP 5/.test(a.html) && (a.html.match(/class="bar"/g) || []).length === 5, "five district bars");

// ---- F. the caption: house style, client key only -------------------------------------------------------------------------------
ok(/^Black Coffee/.test(a.caption) && /curated by Papi$/.test(a.caption), "it opens Black Coffee and closes curated by Papi");
ok(a.caption.indexOf(READ) < 0 && a.html.indexOf(READ) < 0, "the owner key is in neither the caption nor the card");
ok(a.caption.indexOf("/contracts?view=day&top=5&key=" + CLIENT) >= 0, "the link carries the client key: " + (a.caption.match(/https\S+/) || [""])[0]);
ok(/Contracts signed, not homes available/.test(a.caption) && /Contracts signed, not homes available/.test(a.html), "Contracts signed, not homes available - on the card and in the caption");
{
  at(DAY);
  const s2 = new Map([["mkt_latest", JSON.stringify({ generatedAt: new Date(Date.now()).toISOString() })], ["wa_owner_last_in", new Date(Date.now()).toISOString()]]);
  const env0 = mkEnv(s2); delete env0.CLIENT_KEY; sent = []; renders = []; renderFail = false; for (const [k, v] of Object.entries(ejariStubKV(DAY))) s2.set(k, v);
  await worker.fetch(new Request("https://x/feed_test?key=" + READ), env0, { waitUntil() {} }); Date.now = realNow;
  const nk = sent.find(b => b.type === "image" && /ejcard_/.test(b.image.link));
  ok(nk && nk.image.caption.indexOf(READ) < 0 && !/\/contracts/.test(nk.image.caption), "with no client key configured the caption carries no link at all - never the owner key" + (nk ? "" : " (no card: " + String(s2.get("mkt_feed_qa")).slice(-200) + ")"));
}

// ---- G. no mock-up badge ---------------------------------------------------------------------------------------------------------
ok(a.html.length > 1000 && !/MOCK-UP/i.test(a.html) && !/SAMPLE FIGURES/i.test(a.html), "the rendered HTML has no MOCK-UP badge");

// ---- H. filed is preferred; contract start is the fallback, and the label switches with it ----------------------------------------
{
  const both = Object.assign({}, ejariStubKV(DAY, { basis: "start" }), ejariStubKV(DAY, { basis: "filed", days: 40, last: addD(DAY, -1) }));
  // make the two files disagree so the card shows which one it read
  const f = JSON.parse(both.img_ejari_filed_dubai); f.per_area.rows = f.per_area.rows.map(r => { const o = r.slice(); o[f.per_area.fields.indexOf("contracts")] *= 2; return o; }); both.img_ejari_filed_dubai = JSON.stringify(f);
  const env = { MEETINGS: { get: async (k) => both[k] == null ? null : both[k] } };
  const mF = ejariModel(await ejariLoad(env), "day", DAY);
  const r1 = await run(DAY, both);
  ok(mF.basis === "filed" && r1.card && /filed with Ejari yesterday/.test(r1.html) && !/by contract start date/.test(r1.html) && r1.html.indexOf(">" + mF.newLeases.n.toLocaleString("en-US") + "<") >= 0, "both present: the FILED file is used and the headline says filed with Ejari yesterday (" + mF.newLeases.n + ")");
  const r2 = await run(DAY, ejariStubKV(DAY, { basis: "start" }));
  ok(r2.card && /by contract start date/.test(r2.html) && !/filed with Ejari/.test(r2.html) && /by contract start date/.test(r2.caption), "only the start-date file: the card and the caption say by contract start date");
  ok(/\(by contract start date - no filed file\)/.test(r2.note), "and the QA line says it fell back");
}

// ---- I. once a day, and the dry run sends nothing -----------------------------------------------------------------------------
{
  for (const k of ["mkt_feed_famhist", "mkt_feed_hist", "mkt_feed_audit"]) a.store.delete(k);   // the same five angles again would be held as repeats
  const again = await run(DAY, {}, { store: a.store });
  ok(again.kinds.includes("morning"), "(the second morning itself goes: " + again.kinds.join(" > ") + ")");
  ok(!again.card && /already sent today/.test(again.note), "a second run the same day does not send the card twice");
  const dry = await run(DAY, ejariStubKV(DAY), { dry: true });
  ok(!sent.length && /Ejari card \(dry run, not rendered or sent\): DAY top 5/.test(dry.out), "a dry run reports what it would send and sends nothing");
}

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
