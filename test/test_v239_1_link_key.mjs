// v239.1 — A LINK AZIMUTH SENDS NEVER CARRIES THE OWNER KEY, EVEN WHEN NO CLIENT KEY IS CONFIGURED.
//
// clientLinkKey() used to fall back to READ_KEY when CLIENT_KEY was unset. Seven of its eight call sites build a
// link that Azimuth SENDS to a phone — the market pulse, the charts, the compare deep-link, the versus skyline
// links. A page that prints the owner key is fixed by redeploying. A WhatsApp message carrying it is in someone
// else's chat history forever, and this owner key has already been on camera once.
//
// The fallback was latent, not live: CLIENT_KEY is configured on azimuth-2. This suite is here so it stays that
// way by construction rather than by configuration.
import worker from "../src/index.js";
import fs from "node:fs";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("ok - " + m); } else { fail++; console.log("not ok - " + m); } };

const READ = "owner_admin_key_never_in_client_links_0001";
const src = fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8");

// ---- the source rule ---------------------------------------------------------------------------------------
const decl = (src.split("\n").find((l) => /^const clientLinkKey/.test(l)) || "");
ok(!!decl, "clientLinkKey is still a one-line declaration: " + decl.slice(0, 90));
ok(!/READ_KEY/.test(decl), "its declaration does not mention READ_KEY at all - there is no owner-key path through it");
ok(/c\.length \? c\[0\] : ""/.test(decl), "with no client key it returns the empty string, not a key");

// ---- and through the real worker, on a worker with NO client key ---------------------------------------------
const sent = [];
globalThis.fetch = async (u, o) => {
  const url = String(u && u.url ? u.url : u);
  if (/graph\.facebook\.com/.test(url)) { try { sent.push(JSON.parse(String(o.body))); } catch (e) {} return new Response(JSON.stringify({ messages: [{ id: "wamid.1" }] }), { status: 200 }); }
  return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
};
const store = new Map();
const KV = { async get(k, t) { if (!store.has(k)) return null; const v = store.get(k); return t === "json" ? JSON.parse(v) : v; },
  async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); }, async list() { return { keys: [], list_complete: true }; } };
const env = { MEETINGS: KV, READ_KEY: READ, CLIENT_KEY: "", PUBLIC_ORIGIN: "https://x",
  WA_ALLOWED: "971565484397", WHATSAPP_TOKEN: "t", WA_PHONE_ID: "1" };

const tap = async (bid) => {
  const body = { entry: [{ changes: [{ value: { metadata: { phone_number_id: "1" }, messages: [{ from: "971565484397", id: "t" + Date.now() + bid, timestamp: String(Math.floor(Date.now() / 1000)), type: "interactive", interactive: { type: "button_reply", button_reply: { id: bid, title: bid } } }] } }] }] };
  await worker.fetch(new Request("https://x/wa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), env, { waitUntil() {} });
};
await tap("mkt:dash");
const texts = sent.map((b) => JSON.stringify(b)).join("\n");
ok(sent.length > 0, "the worker sent something for the market-pulse tap (" + sent.length + " message(s))");
ok(!texts.includes(READ), "and nothing it sent contains the owner key, on a worker with no CLIENT_KEY set");

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
