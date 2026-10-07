// v388 - KENDALL DESK step 1: second WhatsApp number, owner-only. Offline: KV and WhatsApp stubbed.   node test/test_v388_desk.mjs
import worker from "../src/index.js";
import fs from "node:fs";
const KEND = "971562276093", HER = "971565484397", DESK = "1370146096179819", MAIN = "mainpid", READ = "RK", FWD = "fwdtok";
const store = new Map();
const KV = { async get(k) { return store.has(k) ? store.get(k).v : null; }, async put(k, v) { store.set(k, { v }); }, async delete(k) { store.delete(k); },
  async list() { return { keys: [], list_complete: true }; } };
let out = [];   // { url, body }
globalThis.fetch = async (input, init) => {
  const u = String((input && input.url) || input);
  if (u.includes("graph.facebook.com") && init && init.method === "POST") { out.push({ url: u, body: JSON.parse(init.body || "{}") }); return new Response(JSON.stringify({ messages: [{ id: "wamid.o" + out.length }] }), { status: 200 }); }
  return new Response("{}", { status: 200 });
};
const ctx = { waitUntil(p) { p && p.catch && p.catch(() => {}); } };
const base = { MEETINGS: KV, READ_KEY: READ, WHATSAPP_TOKEN: "t", WA_PHONE_ID: MAIN, WA_ALLOWED: HER, WA_FORWARD_TOKEN: FWD, MAILBOXES: "", ADD_TO: "", AI: { async run() { return { response: "{}" }; } } };
const envOff = { ...base };
const envOn = { ...base, WA_DESK_PHONE_ID: DESK, WA_DESK_OWNER: KEND };
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 300) : "")); } };
let n = 0;
const hook = (env, pid, from, text) => worker.fetch(new Request("https://x/wa", { method: "POST", headers: { "Content-Type": "application/json", "X-Azimuth-Forward": FWD },
  body: JSON.stringify({ entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: pid }, messages: [{ from, id: "wamid.in" + (++n), type: "text", text: { body: text } }] } }] }] }) }), env, ctx);
const say = (env, qs, body) => worker.fetch(new Request("https://x/desk_say" + qs, { method: "POST", headers: { "Content-Type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) }), env, ctx);
const reset = () => { store.clear(); out = []; };

// desk off: a message to the desk id is treated as any other event (no desk reply, nothing from the desk id)
reset(); await hook(envOff, DESK, KEND, "hello");
ok(!store.has("wa_desk_last_in") && !out.some(o => o.url.includes("/" + DESK + "/")), "desk off: no desk record, nothing sent from the desk id");
// desk on, owner, first message
reset(); await hook(envOn, DESK, KEND, "hi there");
ok(out.length === 1 && out[0].url.includes("/" + DESK + "/messages") && !out[0].url.includes(MAIN) && out[0].body.to === KEND, "owner first message: reply goes out from the desk phone id to the owner", JSON.stringify(out));
ok(out[0] && out[0].body.text.body === "Desk is live. This number is for you only (Dr. Kendall Wilson). Commands: /desk_status.", "first message text exact");
ok(store.has("wa_desk_last_in"), "wa_desk_last_in recorded");
ok(!store.has("wa_owner_last_in"), "the ordinary owner window is untouched by a desk message");
// /desk_status and anything else
out = []; await hook(envOn, DESK, KEND, "/desk_status");
const st = out[0] && out[0].body.text.body;
ok(out.length === 1 && out[0].url.includes("/" + DESK + "/") && /Window: open/.test(st) && /Desk number configured: yes/.test(st) && /Dubai/.test(st) && /Version: v388/.test(st), "/desk_status: Dubai time, window open, configured yes, version", st);
out = []; await hook(envOn, DESK, KEND, "what is the weather");
ok(out.length === 1 && out[0].body.text.body === "Received. The desk only has /desk_status so far.", "anything else gets the Received line");
// stranger and Najjuko: no reply, counter + last 4, nothing to ordinary handlers
reset(); await hook(envOn, DESK, "971500001234", "hello?");
let rec = JSON.parse((await KV.get("desk_stranger")) || "{}");
ok(out.length === 0 && rec.count === 1 && rec.last4 === "1234" && !store.has("wa_desk_last_in") && !store.has("diag_lastdrop"), "stranger: no reply, counter and last 4 only", JSON.stringify(rec));
await hook(envOn, DESK, HER, "hi from Najjuko");
rec = JSON.parse((await KV.get("desk_stranger")) || "{}");
ok(out.length === 0 && rec.count === 2 && rec.last4 === "4397" && !store.has("wa_owner_last_in") && !store.has("wa_desk_last_in"), "Najjuko writing to the desk is a stranger: no reply, her flows untouched", JSON.stringify(rec));
ok(!JSON.stringify([...store.values()]).includes(HER), "her full number is not stored");
// owner unset = nobody answered
reset(); await hook({ ...envOn, WA_DESK_OWNER: "" }, DESK, KEND, "hi");
ok(out.length === 0, "WA_DESK_OWNER empty: nobody is answered");
// duplicate delivery is not answered twice
reset(); const dup = { entry: [{ changes: [{ value: { metadata: { phone_number_id: DESK }, messages: [{ from: KEND, id: "wamid.same", type: "text", text: { body: "x" } }] } }] }] };
for (let i = 0; i < 2; i++) await worker.fetch(new Request("https://x/wa", { method: "POST", headers: { "Content-Type": "application/json", "X-Azimuth-Forward": FWD }, body: JSON.stringify(dup) }), envOn, ctx);
ok(out.length === 1, "the same message id is answered once");
// ordinary number unaffected, desk on: Najjuko's ordinary message still opens her window and the desk stays silent
reset(); await hook(envOn, MAIN, HER, "hello");
ok(store.has("wa_owner_last_in") && !store.has("wa_desk_last_in") && !out.some(o => o.url.includes("/" + DESK + "/")), "ordinary number: her message handled as before, nothing from the desk id");
reset(); await hook(envOn, MAIN, KEND, "hello");
ok(!store.has("wa_desk_last_in") && !out.some(o => o.url.includes("/" + DESK + "/")), "ordinary number: a non-allowed sender is dropped as before");
// ordinary reply still uses WA_PHONE_ID
reset(); store.set("wa_owner_last_in", { v: new Date().toISOString() });
let r = await worker.fetch(new Request("https://x/najj_say?key=RK&dry=0", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: "Black Coffee" }) }), envOn, ctx);
ok(out.length === 1 && out[0].url.includes("/" + MAIN + "/messages") && out[0].body.to === HER, "ordinary send still uses WA_PHONE_ID", JSON.stringify(out));
// /desk_say
reset();
r = await say(envOn, "", { text: "x" }); ok(r.status === 401, "desk_say: no key 401");
r = await say(envOn, "?key=bad", { text: "x" }); ok(r.status === 401, "desk_say: wrong key 401");
r = await say(envOn, "?key=RK", "{bad"); ok(r.status === 400, "desk_say: bad json 400");
r = await say(envOn, "?key=RK", { text: " " }); ok(r.status === 400, "desk_say: blank 400");
r = await say(envOn, "?key=RK", { text: "x".repeat(3801) }); ok(r.status === 400, "desk_say: over 3800 400");
r = await say(envOn, "?key=RK", { text: "Good morning", to: "971500000000" }); let j = await r.json();
ok(r.status === 200 && j.dry === true && j.to === KEND && out.length === 0, "desk_say dry by default, recipient fixed", JSON.stringify(j));
r = await say(envOn, "?key=RK&dry=0", { text: "Good morning" }); j = await r.json();
ok(r.status === 409 && j.ok === false && /window closed/.test(j.why) && out.length === 0, "desk_say window closed: refused, nothing sent", JSON.stringify(j));
store.set("wa_owner_last_in", { v: new Date().toISOString() });
r = await say(envOn, "?key=RK&dry=0", { text: "Good morning" });
ok(r.status === 409 && out.length === 0, "the ordinary owner window does not open the desk window");
store.set("wa_desk_last_in", { v: new Date().toISOString() });
r = await say(envOn, "?key=RK&dry=0", { text: "Good morning", to: "971500000000" }); j = await r.json();
ok(j.ok === true && out.length === 1 && out[0].url.includes("/" + DESK + "/") && out[0].body.to === KEND && out[0].body.text.body === "Good morning", "desk_say window open: one text to the owner from the desk id, 'to' ignored", JSON.stringify(out));
store.set("wa_desk_last_in", { v: new Date(Date.now() - 24 * 3600 * 1000).toISOString() });
out = []; r = await say(envOn, "?key=RK&dry=0", { text: "late" });
ok(r.status === 409 && out.length === 0, "desk_say after 24 h: refused");
r = await say(envOff, "?key=RK&dry=0", { text: "x" });
ok(out.length === 0 && r.status !== 200, "desk_say with the desk off sends nothing");
// phone-id route: a router forwards the desk number's traffic to the receiver
reset(); let fwd = [];
const rcv = { fetch: async (rq) => { fwd.push(rq.headers.get("X-Azimuth-Forward")); return new Response("ok"); } };
const router = { ...base, WA_ALLOWED: KEND, WA_APP_SECRET: "", WA_FORWARD_TOKEN: FWD, WA_ROUTE_PHONE_1370146096179819: "AZ2", AZ2: rcv };
await worker.fetch(new Request("https://x/wa", { method: "POST", headers: { "Content-Type": "application/json", "X-Azimuth-Forward": FWD },
  body: JSON.stringify({ entry: [{ changes: [{ value: { metadata: { phone_number_id: DESK }, messages: [{ from: KEND, id: "wamid.r1", type: "text", text: { body: "hi" } }] } }] }] }) }), router, ctx);
ok(fwd.length === 0, "a forwarded body is never re-forwarded (no loops)");
// source hygiene
const src = fs.readFileSync(new URL("../src/desk.js", import.meta.url), "utf8") + fs.readFileSync(new URL("./test_v388_desk.mjs", import.meta.url), "utf8").split("// source hygiene")[0];
ok(!/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(fs.readFileSync(new URL("../src/desk.js", import.meta.url), "utf8")), "no emoji in the desk module");
ok(!/\b(claude|gpt|openai|anthropic|gemini|llama)\b/i.test(fs.readFileSync(new URL("../src/desk.js", import.meta.url), "utf8")), "no model names in the desk module");
console.log("\n" + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
