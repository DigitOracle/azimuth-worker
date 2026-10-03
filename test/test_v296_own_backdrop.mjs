// v296 (Kendall, 3 Oct 2026): the backdrop list gets a "Describe your own" row, because an angle such as the petrol-price one is not on the list.
//   L  tapping an angle ("mkt:pic:N") offers the backdrops WITH "Describe your own" as the last row (9 rows, inside WhatsApp's 10)
//   T  tapping it asks her for the scene in a line
//   S  her next line becomes the scene: stored in fbg_<n> as option X, and the time-of-day list comes back carrying stm:<n>:X:<time>
//   C  a command ("feed", "cancel", a number) cancels the waiting state instead of becoming a scene
//   A  the automatic daily scene picks never see the own row (feedBackdrops without withOwn)
// NEGATIVE CONTROL: run against the live v294 source: L, T, S fail.
//   node test/test_v296_own_backdrop.mjs
import worker from "../src/index.js";

const HER = "971565484397";
const store = new Map();
const KV = { async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter((k) => k.startsWith(p)).map((name) => ({ name })) }; } };
const sent = [];
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.includes("graph.facebook.com")) { sent.push(JSON.parse(init.body)); return new Response(JSON.stringify({ messages: [{ id: "wamid.out" + sent.length }] }), { status: 200 }); }
  return new Response("{}", { status: 200 });
};
const env = { MEETINGS: KV, READ_KEY: "RK", WA_FORWARD_TOKEN: "FWD", WA_ALLOWED: HER, WHATSAPP_TOKEN: "t", WA_PHONE_ID: "p", OPENAI_API_KEY: "o", MAILBOXES: "", ADD_TO: "",
  SCENE_PICTURES: "on", PUBLIC_ORIGIN: "https://azimuth-2.digitalchemy.workers.dev" };
const pending = []; const ctx = { waitUntil(p) { pending.push(p); } };
let mid = 0;
const post = (message) => worker.fetch(new Request("https://x/wa", { method: "POST", headers: { "X-Azimuth-Forward": "FWD", "Content-Type": "application/json" },
  body: JSON.stringify({ entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: "p" }, messages: [Object.assign({ from: HER, id: "wamid.in" + (++mid) }, message)] } }] }] }) }), env, ctx);
const tap = (id) => post({ type: "interactive", interactive: { type: "list_reply", list_reply: { id, title: id } } });
const say = (body) => post({ type: "text", text: { body } });
const settle = async () => { while (pending.length) await pending.shift(); };
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 300) : "")); } };
const lastList = (i) => sent.slice(i).filter((x) => x.type === "interactive" && x.interactive.type === "list").pop();
const rowsOf = (m) => (m ? m.interactive.action.sections[0].rows : []);

store.set("mkt_briefctx", JSON.stringify({ at: Date.now(), brief: "", data: "", angles: [
  { family: "news_regional", hook: "Petrol prices are up 16% across the UAE. Buyers are asking whether living near a metro now saves them more than it costs.", figure: "16%", source: "Khaleej Times, 3 Oct 2026" }] }));

console.log("L - the backdrop list");
let i = sent.length; await tap("mkt:pic:1"); await settle();
let rows = rowsOf(lastList(i));
ok(rows.length === 9 && rows[8] && rows[8].title === "Describe your own" && rows[8].id === "fbg:1:X", "backdrops: 9 rows, the last is \"Describe your own\" (fbg:1:X)", rows.map((r) => r.id + "=" + r.title).join(", "));
ok(rows.length <= 10, "inside WhatsApp's 10-row list limit");

console.log("T - tapping it");
i = sent.length; await tap("fbg:1:X"); await settle();
const ask = sent.slice(i).map((x) => (x.text && x.text.body) || "").join(" ");
ok(/Describe the scene in a line/i.test(ask) && /petrol station/i.test(ask), "she is asked for the scene, with the petrol example", ask);
ok(store.has("fbgown_" + HER), "the waiting state is recorded");

console.log("S - her line becomes the scene");
i = sent.length; await say("At a petrol station at dusk, filling up the car"); await settle();
const tl = lastList(i);
ok(tl && /What time of day\?/.test(tl.interactive.body.text), "the time-of-day list comes back", JSON.stringify(sent.slice(i)).slice(0, 200));
ok(rowsOf(tl).length > 0 && rowsOf(tl).every((r) => /^stm:1:X:/.test(r.id)), "every time row carries stm:1:X:<time>", rowsOf(tl).map((r) => r.id).join(", "));
const fb = JSON.parse(store.get("fbg_1") || "{}"); const X = (fb.options || []).find((o) => o.id === "X");
ok(X && X.name === "Your scene" && /petrol station at dusk/i.test(X.place) && /Dubai/.test(X.place), "fbg_1 option X now holds her scene", JSON.stringify(X));
ok(!store.has("fbgown_" + HER), "the waiting state is cleared");

console.log("C - a command cancels it");
await tap("fbg:1:X"); await settle();
ok(store.has("fbgown_" + HER), "waiting again");
i = sent.length; await say("feed"); await settle();
ok(!store.has("fbgown_" + HER) && !lastList(i), "\"feed\" drops the waiting state and is not taken as a scene", JSON.stringify(sent.slice(i)).slice(0, 160));
await tap("fbg:1:X"); await settle(); i = sent.length; await say("2"); await settle();
ok(!store.has("fbgown_" + HER), "a bare number also cancels it");

console.log("A - automatic picks");
const src = (await import("node:fs")).readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
ok(/return withOwn \? _all : _all\.filter\(o => !o\.own\);/.test(src), "feedBackdrops hides the own row unless asked (code check)");
ok((src.match(/feedBackdrops\([^)]*, true\)/g) || []).length === 1, "only one caller (her list) passes withOwn");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
