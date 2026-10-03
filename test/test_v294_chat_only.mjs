// v294 (Kendall, 3 Oct 2026): Naj typed in WhatsApp and was sent to "her board", a page that did not exist. Everything is completed in WhatsApp; the board and
// the special-key links are gone. This sends the worker the messages she might type and checks that no reply carries the board, a READ_KEY link, or a link built
// from a host other than the public origin.
//   B  "board" / "show my board" / "dashboard" answer in the chat, with no link at all
//   H  "help" no longer advertises the board
//   L  "market" and "charts" links are built on the public origin and carry the client key, never the read key
//   T  the trend radar replies print their items in the chat, with no /trends?key= link
// NEGATIVE CONTROL: run against the live v292.1 source (BRIEF_SRC-style copy of src/): B, H and T fail.
//   node test/test_v294_chat_only.mjs
import worker from "../src/index.js";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 300) : "")); } };
const HER = "971565484397", READ = "SECRET_READ_KEY_123", CLIENT = "client_key_456", PUB = "https://azimuth-2.digitalchemy.workers.dev";
const store = new Map();
const KV = { async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter((k) => k.startsWith(p)).map((name) => ({ name })) }; } };
const sent = [];
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes("graph.facebook.com")) { sent.push(JSON.parse(init.body)); return new Response(JSON.stringify({ messages: [{ id: "wamid.out" + sent.length }] }), { status: 200 }); }
  return new Response("{}", { status: 200 });
};
const env = { MEETINGS: KV, READ_KEY: READ, CLIENT_KEY: CLIENT, WA_FORWARD_TOKEN: "FWD", WA_ALLOWED: HER, WHATSAPP_TOKEN: "t", WA_PHONE_ID: "p", MAILBOXES: "", ADD_TO: "", PUBLIC_ORIGIN: PUB };
const pending = []; const ctx = { waitUntil(p) { pending.push(p); } };
let mid = 0;
// the message arrives on ANOTHER host than the public one (the case that gave dead links)
const say = async (body) => {
  sent.length = 0;
  await worker.fetch(new Request("https://forwarded-host/wa", { method: "POST", headers: { "X-Azimuth-Forward": "FWD", "Content-Type": "application/json" },
    body: JSON.stringify({ entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: "p" }, messages: [{ from: HER, id: "wamid.in" + (++mid), type: "text", text: { body } }] } }] }] }) }), env, ctx);
  await Promise.all(pending.splice(0));
  return sent.map((m) => (m.text && m.text.body) || JSON.stringify(m)).join("\n");
};
const links = (t) => t.match(/https?:\/\/\S+/g) || [];

console.log("B - the board");
for (const w of ["board", "show my board", "dashboard", "open the board"]) {
  const r = await say(w);
  ok(r.length > 20 && links(r).length === 0 && !/READ_KEY|SECRET_READ_KEY/.test(r) && !/\/board/.test(r), "\"" + w + "\" answers in the chat with no link", r);
}
console.log("H - help");
const hp = await say("help");
ok(hp.length > 50 && !/\bboard\b/i.test(hp), "help does not advertise a board", hp.match(/.{0,40}\bboard\b.{0,40}/i));
console.log("L - market and charts links");
for (const w of ["market", "charts"]) {
  const r = await say(w); const ls = links(r);
  ok(!r.includes(READ) && ls.every((l) => l.startsWith(PUB)), "\"" + w + "\": " + (ls.length ? "links on the public origin only" : "no link") + ", never the read key", r);
}
console.log("T - the trend radar");
for (const w of ["trends", "trend 2"]) {
  const r = await say(w);
  ok(!r.includes(READ) && !/\/trends\?key=/.test(r), "\"" + w + "\" carries no /trends?key= link or read key", r);
}
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
