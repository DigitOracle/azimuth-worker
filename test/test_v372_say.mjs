// v372 - /najj_say: one plain text to Najjuko only. Offline: KV and WhatsApp stubbed.   node test/test_v372_say.mjs
import worker from "../src/index.js";
const HER = "971565484397", READ = "RK";
const store = new Map();
const KV = { async get(k) { return store.has(k) ? store.get(k).v : null; }, async put(k, v) { store.set(k, { v }); }, async delete(k) { store.delete(k); },
  async list() { return { keys: [], list_complete: true }; } };
let out = [];
globalThis.fetch = async (input, init) => {
  const u = String((input && input.url) || input);
  if (u.includes("graph.facebook.com") && init && init.method === "POST") { out.push(JSON.parse(init.body || "{}")); return new Response(JSON.stringify({ messages: [{ id: "wamid.o" + out.length }] }), { status: 200 }); }
  return new Response("{}", { status: 200 });
};
const ctx = { waitUntil(p) { p && p.catch && p.catch(() => {}); } };
const env = { MEETINGS: KV, READ_KEY: READ, WHATSAPP_TOKEN: "t", WA_PHONE_ID: "p", WA_ALLOWED: HER, MAILBOXES: "", ADD_TO: "" };
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 300) : "")); } };
const say = (qs, body) => worker.fetch(new Request("https://x/najj_say" + qs, { method: "POST", headers: { "Content-Type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) }), env, ctx);
const TXT = "Black Coffee, your calendar.\n\nCurated by Papi";

let r = await say("", { text: TXT }); ok(r.status === 401, "no key: 401");
r = await say("?key=bad", { text: TXT }); ok(r.status === 401, "wrong key: 401");
r = await say("?key=RK", "{bad"); ok(r.status === 400, "bad json: 400");
r = await say("?key=RK", { text: "   " }); ok(r.status === 400, "blank text: 400");
r = await say("?key=RK", { text: "x".repeat(3801) }); ok(r.status === 400, "over 3800: 400");
ok(out.length === 0, "rejected requests send nothing");
r = await say("?key=RK", { text: TXT, to: "971500000000" }); let j = await r.json();
ok(r.status === 200 && j.dry === true && j.to === HER && out.length === 0, "dry by default, recipient fixed, nothing sent", JSON.stringify(j));
r = await say("?key=RK&dry=0", { text: TXT }); j = await r.json();
ok(r.status === 409 && j.ok === false && out.length === 0, "window closed: refused, nothing sent", JSON.stringify(j));
await store.set("wa_owner_last_in", { v: new Date().toISOString() });
r = await say("?key=RK&dry=0", { text: TXT, to: "971500000000" }); j = await r.json();
ok(j.ok === true && out.length === 1 && out[0].to === HER && out[0].text.body === TXT, "window open: one text to her, exact words, 'to' in the body ignored", JSON.stringify(out));
console.log("\n" + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
