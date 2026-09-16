// v155 - the Versus page (16 Sep 2026): keyed, carries every city and the review verdicts, embeds no key; /versus/send puts the
// script or the client card into her WhatsApp as plain text. Worker end to end with WhatsApp stubbed; nothing leaves this machine.
import worker from "../src/index.js";
import { worldPageHtml, worldCardText, worldScriptText } from "../src/world_page.js";
import { WORLD_STORY, WORLD_CULTURE, WORLD_NUMERIC, WORLD_FX, WORLD_CITIES } from "../src/world.js";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };
const HER = "971565484397", READ = "client_read_key_in_links_123";
const store = new Map();
const KV = { async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); }, async list() { return { keys: [], list_complete: true }; } };
const sent = [];
globalThis.fetch = async (url, init) => { const u = String(url); if (u.includes("graph.facebook.com")) { sent.push(JSON.parse(init.body)); return new Response(JSON.stringify({ messages: [{ id: "wamid.out" + sent.length }] })); } return new Response("{}"); };
const env = { MEETINGS: KV, READ_KEY: READ, WA_FORWARD_TOKEN: "FWD", WA_ALLOWED: HER, WHATSAPP_TOKEN: "t", WA_PHONE_ID: "p", MAILBOXES: "", ADD_TO: "", AI: { async run() { return { response: "{}" }; } }, PUBLIC_ORIGIN: "https://azimuth-2.digitalchemy.workers.dev" };
const ctx = { waitUntil() {} };
const call = (p) => worker.fetch(new Request("https://azimuth-2.digitalchemy.workers.dev" + p), env, ctx);
const post = (b) => worker.fetch(new Request("https://azimuth-2.digitalchemy.workers.dev/versus/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }), env, ctx);

const keys = WORLD_CITIES.filter(c => !c.base).map(c => c.key);
ok(keys.every(k => WORLD_STORY[k] && WORLD_STORY[k].length >= 4 && WORLD_CULTURE[k] && WORLD_CULTURE.dubai && WORLD_NUMERIC.door[k] != null && WORLD_NUMERIC.gains[k] != null && WORLD_NUMERIC.hold[k]), "every city has a story, culture facts and the numeric readings");
ok(Math.abs(WORLD_FX.rates.USD - 3.6725) < 1e-9 && Math.abs(WORLD_FX.rates.GBP - 1.1539 * 3.6725 / 0.8558) < 1e-6 && WORLD_FX.date === "15 September 2026" && WORLD_FX.symbols.INR === "₹", "currency table: the peg and the ECB rates of 15 September 2026");

store.set("world_review", JSON.stringify({ fb: { "1": { verdict: "no" }, "2": { verdict: "yes" } } }));
let r = await call("/versus"); ok(r.status === 401, "/versus without the key: 401");
r = await call("/versus?key=" + READ); let html = await r.text();
ok(r.status === 200 && html.startsWith("<!doctype html>") && html.includes("<title>Dubai Versus</title>") && r.headers.get("Cache-Control") === "no-store" && r.headers.get("X-Robots-Tag") === "noindex", "the page renders, no-store, noindex");
ok(!html.includes(READ) && html.includes('"FB":{"1":"no","2":"yes"}') && html.includes('"LIVE":true') && html.includes("Monaco") && html.includes("Mumbai") && html.includes('"CULT":') && html.includes('"STORY":') && html.includes('fetch("/versus/send", { method: "POST"'), "no key inside the page; verdicts, both fact sets and the live send are in it");
ok(html.includes("const DATA = {") && !html.includes("__DATA__") && (html.match(/<script>/g) || []).length === 1 && !/<\/script/i.test(JSON.stringify(html.split("const DATA = ")[1].split(";\n")[0]).slice(1, -1).replace(/<\\\\\/script/g, "")), "data is injected once and cannot close the script tag");
r = await post({ key: READ, city: "london", what: "script" }); let t = await r.text();
ok(r.status === 200 && /Script for Dubai versus London sent/.test(t) && sent.length === 1 && sent[0].to === HER && sent[0].type === "text" && sent[0].text.body.startsWith("🎬 Dubai versus London: the price of the door") && sent[0].text.body.includes("Have ready, not said"), "send script: her WhatsApp gets the London piece with its have-ready line");
r = await post({ key: READ, city: "monaco", what: "card", cur: "GBP", budget: 5000000 }); t = await r.text();
const body = sent[1] && sent[1].text.body;
ok(r.status === 200 && /Client card for Dubai versus Monaco sent/.test(t) && body.startsWith("Dubai versus Monaco · for your £1m") && body.includes("Prime price per sq ft: £") && body.includes("Your budget buys: 84 m² vs 22 m²") && body.includes("Top income tax: 0% vs 0%") && body.includes("AED 1,670 per sq ft") && body.includes("down 4.5%") && !/http|key=/.test(body) && body.endsWith("— Najma"), "send card: six lines in the client's currency, the prime caveat and Savills' line, no links, no keys");
ok((await post({ city: "london", what: "script" })).status === 401 && (await post({ key: READ, city: "dubai" })).status === 404 && (await post({ key: READ, city: "atlantis" })).status === 404 && (await call("/versus/send?key=" + READ + "&city=london&what=script"), sent.length === 2), "send: keyed; Dubai and unknown cities refused; a GET never sends");
ok(worldScriptText("nowhere") === null && worldCardText("nowhere", 1, "AED") === null && worldCardText("paris", 3672500, "USD").includes("for your US$1m") && worldCardText("paris", 3672500, "USD").includes("Paid at the door: US$40,000 (4%) vs US$63,000 (6.3%)"), "helpers: unknown city is null; the card does the currency arithmetic");
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
