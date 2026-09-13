// v147.2 - /owner_note answers POST (13 Sep 2026). In v142 it sat inside the GET branch, so every POST fell through to the
// default 401 and no pipeline alert could reach the owner. Offline: KV and fetch stubbed, nothing sent anywhere.
import worker from "../src/index.js";

const store = new Map();
const KV = { async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter(k => k.startsWith(p)).map(name => ({ name })) }; } };
const sent = [];
globalThis.fetch = async (url, init) => {
  if (String(url).includes("graph.facebook.com")) { sent.push(JSON.parse(init.body)); return new Response(JSON.stringify({ messages: [{ id: "wamid.o" + sent.length }] }), { status: 200 }); }
  return new Response("{}", { status: 200 });
};
const owner = { MEETINGS: KV, READ_KEY: "RK", INGEST_TOKEN: "ING", WHATSAPP_TOKEN: "t", WA_PHONE_ID: "p", WA_ALLOWED: "971562276093", MAILBOXES: "",
  OWNER_TEMPLATE: "azimuth_daily", OWNER_TEMPLATE_LANG: "en_US", TELEGRAM: "off" };
const her = Object.assign({}, owner, { OWNER_TEMPLATE: undefined, WA_ALLOWED: "971565484397" });
const ctx = { waitUntil() {} };
const postNote = (e, body, token) => worker.fetch(new Request("https://x/owner_note", { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, token ? { "X-Azimuth-Ingest": token } : {}), body }), e, ctx);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };

let r = await postNote(owner, JSON.stringify({ text: "" }), "ING");
ok(r.status === 400 && (await r.text()) === "no text", "POST with the token and no text reaches the handler: 400 no text");
r = await postNote(owner, JSON.stringify({ text: "Pipeline: refresh failed" }), "BAD");
ok(r.status === 401, "wrong token: 401");
r = await postNote(owner, JSON.stringify({ text: "Pipeline: refresh failed" }), "");
ok(r.status === 401, "no token: 401");
r = await postNote(her, JSON.stringify({ text: "Pipeline: refresh failed" }), "ING");
ok(r.status === 403 && sent.length === 0, "her instance (no OWNER_TEMPLATE): 403 and nothing sent");
r = await postNote(owner, JSON.stringify({ text: "Pipeline: refresh failed" }), "ING");
const body = await r.text();
ok(r.status === 200 && body === "sent", "owner instance with the token and text: 200 sent");
ok(sent.length >= 1 && sent.every(m => m.to === "971562276093"), "the alert goes to the owner's number only");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
