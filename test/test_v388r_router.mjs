// v388r - phone-id router rule on the older line (meeting-capture): WA_ROUTE_PHONE_<phone_number_id> forwards that number's events to the named instance.
// Offline: KV, Workers AI, WhatsApp API and the AZIMUTH_2 service binding are stubbed.
//   node test/test_v388r_router.mjs
import worker from "../src/index.js";
import crypto from "node:crypto";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };

const KEN = "971562276093", NAJ = "971565484397", APP_SECRET = "app_secret_for_signing_0123456789", TOKEN = "FWD_TOKEN_1234", DESK = "1370146096179819";
const store = new Map();
const KV = { async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter((k) => k.startsWith(p)).sort().map((name) => ({ name })), list_complete: true }; } };
let fwd = [];
const AZ2 = { async fetch(req) { const body = await req.text(); fwd.push({ url: req.url, token: req.headers.get("X-Azimuth-Forward"), body }); return new Response("ok", { status: 200 }); } };
let out = [];
globalThis.fetch = async (u, init) => {
  const s = String((u && u.url) || u);
  if (s.endsWith("/messages")) { out.push(JSON.parse(init.body)); return new Response(JSON.stringify({ messages: [{ id: "wamid.OUT" }] })); }
  return new Response("{}");
};
const AI = { async run() { return { text: "" }; } };
const mkEnv = (extra) => Object.assign({ MEETINGS: KV, READ_KEY: "r", INGEST_TOKEN: "ING", WA_FORWARD_TOKEN: TOKEN, WA_APP_SECRET: APP_SECRET, WA_ALLOWED: KEN, WHATSAPP_TOKEN: "T", WA_PHONE_ID: "P", AI, AZIMUTH_2: AZ2, WA_ROUTE_971565484397: "AZIMUTH_2", MAILBOXES: "", ADD_TO: "" }, extra || {});
let n = 0;
const send = async (num, pid, bodyText, o) => {
  n++; const body = JSON.stringify({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: pid }, messages: [{ from: num, id: "wamid.in" + n, timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body: bodyText } }] } }] }] });
  const headers = { "Content-Type": "application/json" };
  if (o && o.fwdHeader) headers["X-Azimuth-Forward"] = TOKEN; else headers["X-Hub-Signature-256"] = "sha256=" + crypto.createHmac("sha256", APP_SECRET).update(body).digest("hex");
  try { const r = await worker.fetch(new Request("https://meeting-capture.example/wa", { method: "POST", headers, body }), (o && o.env) || mkEnv(), { waitUntil() {} }); return { r, body }; } catch (e) { return { r: { status: "threw: " + String(e && e.message || e).slice(0, 80) }, body }; }
};
const reset = () => { fwd = []; out = []; };

console.log("phone-id rule: the desk number's event is forwarded raw, with the secret, and not handled here");
reset();
let x = await send(KEN, DESK, "hello desk", { env: mkEnv({ ["WA_ROUTE_PHONE_" + DESK]: "AZIMUTH_2" }) });
ok(x.r.status === 200 && fwd.length === 1 && fwd[0].token === TOKEN && fwd[0].url === "https://internal/wa" && fwd[0].body === x.body, "forwarded byte for byte over the binding with X-Azimuth-Forward");
ok(out.length === 0, "this instance sends nothing");
ok(JSON.parse(store.get("diag_walog"))[0].router.routeKey === "WA_ROUTE_PHONE_" + DESK, "diag records the phone-id route key");

console.log("no var: unchanged (Kendall's message to the old number is handled here)");
reset();
x = await send(KEN, DESK, "hello desk");
ok(fwd.length === 0, "not forwarded when WA_ROUTE_PHONE_<id> is unset");
reset();
x = await send(KEN, "P", "hello");
ok(fwd.length === 0, "ordinary owner message on the old number is not forwarded");

console.log("unrelated phone id with the rule set for another id: unchanged");
reset();
x = await send(KEN, "999", "hello", { env: mkEnv({ ["WA_ROUTE_PHONE_" + DESK]: "AZIMUTH_2" }) });
ok(fwd.length === 0, "a different phone id is not forwarded");

console.log("loop guard: an already-forwarded body is never forwarded again");
reset();
x = await send(KEN, DESK, "hello desk", { fwdHeader: true, env: mkEnv({ ["WA_ROUTE_PHONE_" + DESK]: "AZIMUTH_2" }) });
ok(fwd.length === 0, "forwarded-in body is not re-forwarded");

console.log("sender rule still works for Najjuko (old number, and with the phone rule present)");
reset();
x = await send(NAJ, "P", "hi");
ok(fwd.length === 1 && fwd[0].body === x.body, "Najjuko's message is forwarded by the sender rule");
reset();
x = await send(NAJ, "P", "hi", { env: mkEnv({ ["WA_ROUTE_PHONE_" + DESK]: "AZIMUTH_2" }) });
ok(fwd.length === 1, "and still with the phone rule configured for another id");

console.log(fail ? "FAILED " + fail : "all passed (" + pass + ")");
process.exit(fail ? 1 : 0);
