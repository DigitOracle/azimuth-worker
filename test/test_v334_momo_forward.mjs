// v334 - Momo forward on the older line (meeting-capture): Kendall's PLAINLY-Momo messages are handed to azimuth-2; nothing else of his is.
// Through the real worker with KV, Workers AI, the WhatsApp API and the AZIMUTH_2 service binding stubbed. Nothing leaves this machine.
//   node test/test_v334_momo_forward.mjs
import worker from "../src/index.js";
import crypto from "node:crypto";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };

const KEN = "971562276093", NAJ = "971565484397", APP_SECRET = "app_secret_for_signing_0123456789", TOKEN = "FWD_TOKEN_1234";
const store = new Map();
const KV = { async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter((k) => k.startsWith(p)).sort().map((name) => ({ name })), list_complete: true }; } };
let fwd = [], fwdStatus = 200, fwdThrow = false;
const AZ2 = { async fetch(req) { const body = await req.text(); fwd.push({ url: req.url, token: req.headers.get("X-Azimuth-Forward"), body }); if (fwdThrow) throw new Error("unreachable"); return new Response("ok", { status: fwdStatus }); } };
let out = [], aiText = "";
globalThis.fetch = async (u, init) => {
  const s = String((u && u.url) || u);
  if (s.endsWith("/messages")) { out.push(JSON.parse(init.body)); return new Response(JSON.stringify({ messages: [{ id: "wamid.OUT" }] })); }
  if (/graph\.facebook\.com\/v[\d.]+\/AUD\d$/.test(s)) return new Response(JSON.stringify({ url: "https://lookaside.example/a" }));
  if (s.startsWith("https://lookaside.example/")) return new Response(new Uint8Array(100));
  return new Response("{}");
};
const AI = { async run() { return { text: aiText }; } };
const mkEnv = (extra) => Object.assign({ MEETINGS: KV, READ_KEY: "r", INGEST_TOKEN: "ING", WA_FORWARD_TOKEN: TOKEN, WA_APP_SECRET: APP_SECRET, WA_ALLOWED: KEN, WHATSAPP_TOKEN: "T", WA_PHONE_ID: "P", AI, AZIMUTH_2: AZ2, WA_ROUTE_971565484397: "AZIMUTH_2", MOMO_FORWARD: "AZIMUTH_2", MAILBOXES: "", ADD_TO: "" }, extra || {});
let n = 0;
const send = async (num, msg, o) => {
  n++; const body = JSON.stringify({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: "P" }, messages: [Object.assign({ from: num, id: "wamid.in" + n, timestamp: String(Math.floor(Date.now() / 1000)) }, msg)] } }] }] });
  const headers = { "Content-Type": "application/json" };
  if (o && o.fwdHeader) headers["X-Azimuth-Forward"] = TOKEN; else headers["X-Hub-Signature-256"] = "sha256=" + crypto.createHmac("sha256", APP_SECRET).update(body).digest("hex");
  try { return await worker.fetch(new Request("https://meeting-capture.example/wa", { method: "POST", headers, body }), (o && o.env) || mkEnv(), { waitUntil() {} }); } catch (e) { return { status: "threw: " + String(e && e.message || e).slice(0, 80) }; }
};
const text = (num, b, o) => send(num, { type: "text", text: { body: b } }, o);
const reset = () => { fwd = []; out = []; fwdStatus = 200; fwdThrow = false; aiText = ""; };
const taskKeys = () => [...store.keys()].filter((k) => /^(act_|evt_|cmt_)/.test(k));

console.log("what IS Momo, from Kendall's number: forwarded, byte for byte, with the shared secret");
reset();
let r = await text(KEN, "momo week");
ok(r.status === 200 && fwd.length === 1 && fwd[0].token === TOKEN && fwd[0].url === "https://internal/wa" && JSON.parse(fwd[0].body).entry[0].changes[0].value.messages[0].text.body === "momo week", "'momo week' is handed to azimuth-2 exactly as Meta sent it, with the forward secret");
ok(out.length === 0 && taskKeys().length === 0, "and this instance says nothing and files nothing");
ok(JSON.parse(store.get("diag_walog"))[0].momo.forwarded === true && JSON.parse(store.get("diag_walog"))[0].momo.status === 200, "/walog records momo: {forwarded: true, status: 200}");
for (const t of ["food: his eggs", "Food - scrambled eggs", "gym: 45 min", "gym 40 min", "ran for 30 min", "12,000 steps", "10k steps yesterday", "fit week", "fit pause 2 flu", "fit target 10", "\u{1F37D}\u{FE0F} shawarma", "lunch: salad", "ex: padel 60 min", "Momo again", "momo", "  momo help"]) {
  reset(); await text(KEN, t);
  ok(fwd.length === 1 && out.length === 0, "forwarded: " + JSON.stringify(t));
}
reset(); await send(KEN, { type: "image", image: { id: "IMG1", mime_type: "image/jpeg", caption: "lunch" } });
ok(fwd.length === 1, "a photo captioned 'lunch' is forwarded");
reset(); await send(KEN, { type: "interactive", interactive: { type: "button_reply", button_reply: { id: "fit:undo:kendall:2026-10-04_1791100000000_abc123", title: "Undo" } } });
ok(fwd.length === 1, "a Momo Undo button is forwarded");
reset(); aiText = "momo week"; await send(KEN, { type: "audio", audio: { id: "AUD1", mime_type: "audio/ogg" } });
ok(fwd.length === 1, "a voice note that opens with 'momo' is forwarded");

console.log("what is NOT Momo stays here, exactly as before");
for (const t of ["call the bank tomorrow", "fit for purpose", "food", "lunch with Sara on Friday", "gym tomorrow at 6", "momentum report", "steps to take", "fitting at 3pm", "I will do 10k steps tomorrow", "foodstuff: x"]) {
  reset(); await text(KEN, t);
  ok(fwd.length === 0, "not forwarded: " + JSON.stringify(t));
}
reset(); await send(KEN, { type: "image", image: { id: "IMG2", mime_type: "image/jpeg", caption: "this is me" } });
ok(fwd.length === 0, "a photo captioned 'this is me' is not forwarded");
reset(); await send(KEN, { type: "image", image: { id: "IMG3", mime_type: "image/jpeg" } });
ok(fwd.length === 0, "a photo with no caption is not forwarded (it stays with the invite reader)");
reset(); await send(KEN, { type: "interactive", interactive: { type: "button_reply", button_reply: { id: "done:abc", title: "Done" } } });
ok(fwd.length === 0, "an Azimuth Done button is not forwarded");
reset(); aiText = "buy milk on the way home"; await send(KEN, { type: "audio", audio: { id: "AUD2", mime_type: "audio/ogg" } });
ok(fwd.length === 0, "an ordinary voice note is not forwarded");
reset(); aiText = "food: oats"; await send(KEN, { type: "audio", audio: { id: "AUD3", mime_type: "audio/ogg" } });
ok(fwd.length === 0, "a voice note must open with 'momo': 'food: oats' alone is not enough");
reset(); await send(KEN, { type: "document", document: { id: "D1", filename: "x.pdf" } });
ok(fwd.length === 0, "a document is not forwarded");

console.log("switches and safety");
reset(); await text(KEN, "momo week", { env: mkEnv({ MOMO_FORWARD: undefined }) });
ok(fwd.length === 0, "MOMO_FORWARD unset: inert, nothing is forwarded");
reset(); await text(KEN, "momo week", { env: mkEnv({ AZIMUTH_2: undefined }) });
ok(fwd.length === 0, "no AZIMUTH_2 binding: inert, and no crash");
reset(); await text(KEN, "momo week", { env: mkEnv({ WA_FORWARD_TOKEN: undefined, WA_APP_SECRET: APP_SECRET }) });
ok(fwd.length === 0, "no forward secret: inert");
reset(); await text(KEN, "momo week", { fwdHeader: true });
ok(fwd.length === 0, "a message that ARRIVED forwarded is never forwarded again (no loop)");
reset(); await text("971500000009", "momo week");
ok(fwd.length === 0, "a stranger's message is not forwarded by the Momo path");
reset(); await text(NAJ, "food: her oats");
ok(fwd.length === 1 && fwd[0].token === TOKEN, "Najjuko's messages still go through the existing router, once (not twice)");
console.log("when azimuth-2 cannot be reached");
reset(); fwdStatus = 500; let rf = await text(KEN, "food: his eggs");
ok(rf.status === 200 && fwd.length === 1 && out.length === 1 && out[0].to === KEN && /Momo could not be reached/.test(JSON.stringify(out[0])) && taskKeys().length === 0, "a 500 from azimuth-2: he is told, and the line is NOT filed as a task here");
reset(); fwdThrow = true; rf = await text(KEN, "food: his eggs");
ok(rf.status === 200 && out.length === 1 && /Momo could not be reached/.test(JSON.stringify(out[0])) && taskKeys().length === 0, "azimuth-2 unreachable (throws): same");
const errs = JSON.parse(store.get("diag_errs") || "[]");
ok(errs.some((e) => e.where === "momo-forward" && /unreachable/.test(e.detail)) && errs.some((e) => e.where === "momo-forward" && /HTTP 500/.test(e.detail)), "both failures are noted in diag_errs (where: momo-forward) so /health can show them");

console.log("v352 - the private journal: Kendall's journal lines go to azimuth-2, and are never copied into this instance's inbox log");
const JTXT = "JOURNAL-SECRET-WORDS";
for (const t of ["journal: " + JTXT, "Journal - " + JTXT, "momo journal: " + JTXT, "fit journal: " + JTXT, "momo journal"]) {
  reset(); store.delete("wa_inbox"); await text(KEN, t);
  ok(fwd.length === 1 && out.length === 0 && taskKeys().length === 0, "forwarded, no task and no reply from here: " + JSON.stringify(t.slice(0, 22)));
  ok(!(store.get("wa_inbox") || "").includes("JOURNAL-SECRET"), "and this instance's inbox log does not hold the words: " + JSON.stringify(t.slice(0, 22)));
}
reset(); store.delete("wa_inbox"); await text(KEN, "journal: " + JTXT);
ok(/journal entry/.test(store.get("wa_inbox") || ""), "the inbox log only records that a journal entry arrived");
reset(); aiText = "Journal. Today I walked and thought about the week"; await send(KEN, { type: "audio", audio: { id: "AUD7", mime_type: "audio/ogg" } });
ok(fwd.length === 1, "a voice note that opens with the word 'journal' is forwarded");
reset(); aiText = "I keep a journal every night and it helps"; await send(KEN, { type: "audio", audio: { id: "AUD8", mime_type: "audio/ogg" } });
ok(fwd.length === 0, "a voice note that merely mentions a journal is not forwarded");
for (const t of ["journal entry is due on Friday", "my journal is on the desk", "the journal: reply to the editor"]) {
  reset(); await text(KEN, t);
  ok(fwd.length === 0, "not forwarded (stays exactly as before): " + JSON.stringify(t));
}
reset(); await text(NAJ, "journal: " + JTXT);
ok(fwd.length === 1 && fwd[0].token === TOKEN, "Najjuko's journal line goes through the existing number router, once, as before (not twice)");
ok(!(store.get("wa_inbox") || "").includes("JOURNAL-SECRET"), "and it is not copied into the inbox log here either");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
