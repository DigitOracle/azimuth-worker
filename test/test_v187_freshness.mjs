// v187 — "IT GAVE ME THE SAME DATA AS YESTERDAY AND USED THE SAME IMAGES" (Naj, 21 Sep 2026).
//
// Both were true. v184 had exempted the plan's facts from EVERY repeat check, so "5.8 million by 2040" went out on the 20th and
// again on the 21st; and every card since the cards went in had used the first backdrop, "Skyline, blue hour". Worse, the 06:00
// run on the 21st recorded its five figures into her history although WhatsApp delivered none of them, so the rebuild an hour
// later was reasoning against figures she had never seen. Three fixes, and a check that runs before she gets the morning.
import worker from "../src/index.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("ok - " + m); } else { fail++; console.log("not ok - " + m); } };
const A = (hook, figure, source, family, reader) => ({ hook, figure, source, buyer: "b", family, reader });
const figKey = (f) => String(f).toLowerCase().replace(/[^0-9a-z%.]/g, "").slice(0, 40);
const day = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const H = (figure, family, daysAgo) => ({ d: day(daysAgo), f: family, k: figKey(figure), n: [], s: family + ":-" });

const POP = A("The plan targets 5.8 million residents by 2040.", "5.8 million (2040 target); 3.3 million (2020 baseline)", "Dubai Media Office, 13 Mar 2021", "growth_plan", "authority");
const WALK = A("Dubai is adding 6,500 km of walking paths.", "6,500 km", "Dubai Media Office, 4 Mar 2025", "city_life", "move");
const EDU = A("Land for schools and health rises 25% by 2040.", "25%", "Dubai Media Office, 13 Mar 2021", "education", "move");
const SALES = A("City of Arabia moved 1,128 sales.", "1,128 sales", "DLD Open Data, 2026-09-20", "district", "invest");
const RENTS = A("Rents settled at 71,400 contracts.", "71,400 contracts", "DLD Open Data, 2026-09-20", "rents_yields", "move");
const FIVE = [POP, WALK, EDU, SALES, RENTS];

let serve = FIVE, topup = [], sendOk = true, sent = [], owner = [];
globalThis.fetch = async (u, o) => {
  const url = String(u && u.url ? u.url : u);
  if (/anthropic/i.test(url)) {
    let body = {}; try { body = JSON.parse(String(o && o.body || "{}")); } catch (e) {}
    const sys = JSON.stringify(body.system || "");
    const isVoice = /rewrite social-post hooks/.test(sys), isTop = /TOP-UP/.test(sys);
    return new Response(JSON.stringify({ content: [{ type: "text", text: isVoice ? JSON.stringify({ items: [] }) : JSON.stringify({ angles: isTop ? topup : serve }) }], stop_reason: "end_turn" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  if (/graph\.facebook\.com/.test(url)) {
    let b = {}; try { b = JSON.parse(String(o && o.body || "{}")); } catch (e) {}
    sent.push(b);
    if (!sendOk) return new Response(JSON.stringify({ error: { message: "(#131047) Re-engagement message", code: 131047 } }), { status: 400 });
    return new Response(JSON.stringify({ messages: [{ id: "wamid." + sent.length }] }), { status: 200 });
  }
  if (/owner_note/.test(url)) { try { owner.push(JSON.parse(String(o.body)).text); } catch (e) {} return new Response("sent", { status: 200 }); }
  return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
};
const READ = "owner_admin_key_never_in_client_links_0001";
const run = async (famhist, opts) => {
  opts = opts || {}; serve = opts.serve || FIVE; topup = opts.topup || []; sendOk = opts.sendOk !== false; sent = []; owner = [];
  const store = new Map([["mkt_latest", JSON.stringify({ generatedAt: new Date().toISOString() })], ["mkt_feed_famhist", JSON.stringify(famhist)], ["wa_owner_last_in", new Date().toISOString()]]);
  for (const k in (opts.kv || {})) store.set(k, opts.kv[k]);
  const KV = { async get(k, t) { if (!store.has(k)) return null; const v = store.get(k); return t === "json" ? JSON.parse(v) : v; },
    async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); },
    async list(o) { return { keys: [...store.keys()].filter((k) => !o || !o.prefix || k.startsWith(o.prefix)).map((name) => ({ name })), list_complete: true }; } };
  const env = { MEETINGS: KV, READ_KEY: READ, MARKET_BRIEF: "on", ANTHROPIC_API_KEY: "test-only-not-a-key", PUBLIC_ORIGIN: "https://x",
    WA_ALLOWED: "971565484397", WHATSAPP_TOKEN: "t", WA_PHONE_ID: "1", FEED_SCENES: "on", OWNER_NOTE_URL: "https://mc/owner_note", INGEST_TOKEN: "i" };
  const r = await worker.fetch(new Request("https://x/feed_test?key=" + READ + (opts.dry ? "&dry=1" : "")), env, { waitUntil() {} });
  const out = await r.text();
  let qa = null; try { qa = JSON.parse(store.get("mkt_feed_qa") || "null"); } catch (e) {}
  let audit = null; try { audit = JSON.parse(store.get("mkt_feed_audit") || "null"); } catch (e) {}
  const jobs = [...store.keys()].filter((k) => k.startsWith("picjob_s")).map((k) => JSON.parse(store.get(k)));
  return { out, qa, audit, store, jobs, famh: JSON.parse(store.get("mkt_feed_famhist") || "[]") };
};

// ---- the plan's facts rest, instead of coming back every morning ---------------------------------------------------------------
const y = await run([H("5.8 million (2040 target); 3.3 million (2020 baseline)", "growth_plan", 1)], { dry: true });
ok(!/5\.8 million/.test(y.out), "a plan fact she had YESTERDAY does not come again today - the v184 blanket exemption is gone");
const old = await run([H("5.8 million (2040 target); 3.3 million (2020 baseline)", "growth_plan", 6)], { dry: true });
ok(/5\.8 million/.test(old.out), "but after a few days' rest it may be restated - the plan is the spine, it is meant to recur");
const subj = await run([{ d: day(1), f: "growth_plan", k: "somethingelse", n: [], s: "growth_plan:-" }], { dry: true });
ok(/5\.8 million/.test(subj.out), "and the subject lock still does not apply to it - that is what emptied the 19 Sep morning");

// ---- history is written when she GETS it -----------------------------------------------------------------------------------------
const refused = await run([], { sendOk: false });
ok(refused.famh.length === 0, "when WhatsApp refuses the morning, nothing is recorded against her history: " + refused.famh.length + " rows");
ok(owner.some((t) => /REFUSED/.test(t)), "and Kendall is told it was refused");
const okrun = await run([]);
ok(okrun.famh.length === 5, "when it goes, all five are recorded: " + okrun.famh.length + " rows");

// ---- the pictures change with the day -------------------------------------------------------------------------------------------
ok(okrun.jobs.length === 5, "five cards queued");
const backs = okrun.jobs.map((j) => j.opt);
ok(new Set(backs).size > 1, "they do not all use the same backdrop any more: " + backs.join(","));
const scenes = JSON.parse(okrun.store.get("feed_scenes_last"));
ok(Array.isArray(scenes.backdrops) && scenes.backdrops.length === 5, "and what was used is recorded, so tomorrow can differ: " + JSON.stringify(scenes.backdrops));

// ---- the morning checks itself before she gets it -----------------------------------------------------------------------------
ok(okrun.audit && Array.isArray(okrun.audit.issues), "every morning writes its own check: " + JSON.stringify(okrun.audit && okrun.audit.issues));
ok(okrun.qa && /check (passed|FAILED)/.test(okrun.qa.note), "and the QA line says whether it passed: " + (okrun.qa ? okrun.qa.note.slice(-60) : ""));
const thin = await run([], { serve: [POP, WALK, EDU], topup: [] });
ok(thin.audit && thin.audit.issues.some((i) => /only \d angles|split is/.test(i)), "a short or lopsided morning is caught: " + JSON.stringify(thin.audit && thin.audit.issues));
ok(owner.some((t) => /failed its own check/.test(t)), "and Kendall hears about it, not Naj");

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
