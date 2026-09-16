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
ok(!html.split("const DATA = ")[1].split("</script>")[0].includes(READ) && html.includes('"FB":{"2":"yes"}') && !html.includes('"1":"no"') && html.includes('"LIVE":true') && html.includes("Monaco") && html.includes("Mumbai") && html.includes('"CULT":') && html.includes('"STORY":') && html.includes('"/versus/send", { method: "POST"'), "no key inside the page data; the live send and both fact sets are in it, and a verdict given on a since-rewritten script (1, London) is not shown");
ok(html.includes("const DATA = {") && !html.includes("__DATA__") && (html.match(/<script>/g) || []).length === 1 && !/<\/script/i.test(JSON.stringify(html.split("const DATA = ")[1].split(";\n")[0]).slice(1, -1).replace(/<\\\\\/script/g, "")), "data is injected once and cannot close the script tag");
r = await post({ key: READ, city: "london", what: "script" }); let t = await r.text();
ok(r.status === 200 && /Script for Dubai versus London sent/.test(t) && sent.length === 1 && sent[0].to === HER && sent[0].type === "text" && sent[0].text.body.startsWith("🎬 Dubai versus London: the morning after") && sent[0].text.body.includes("Have ready, not said"), "send script: her WhatsApp gets the London piece with its have-ready line");
r = await post({ key: READ, city: "monaco", what: "card", cur: "GBP", budget: 5000000 }); t = await r.text();
const body = sent[1] && sent[1].text.body;
ok(r.status === 200 && /Client card for Dubai versus Monaco sent/.test(t) && body.startsWith("Dubai versus Monaco · for your £1m") && body.includes("Prime price per sq ft: £") && body.includes("Your budget buys: 84 m² vs 22 m²") && body.includes("Top income tax: 0% vs 0%") && body.includes("AED 1,670 per sq ft") && body.includes("down 4.5%") && !/http|key=/.test(body) && body.endsWith("— Najma"), "send card: six lines in the client's currency, the prime caveat and Savills' line, no links, no keys");
ok((await post({ city: "london", what: "script" })).status === 401 && (await post({ key: READ, city: "dubai" })).status === 404 && (await post({ key: READ, city: "atlantis" })).status === 404 && (await call("/versus/send?key=" + READ + "&city=london&what=script"), sent.length === 2), "send: keyed; Dubai and unknown cities refused; a GET never sends");
ok(worldScriptText("nowhere") === null && worldCardText("nowhere", 1, "AED") === null && worldCardText("paris", 3672500, "USD").includes("for your US$1m") && worldCardText("paris", 3672500, "USD").includes("Paid at the door: US$40,000 (4%) vs US$63,000 (6.3%)"), "helpers: unknown city is null; the card does the currency arithmetic");
const own = worldPageHtml({}), cli = worldPageHtml({}, false);
ok(own.includes('"OWNER":true') && own.includes("Send me this script") && cli.includes('"OWNER":false') && cli.includes("(OWNER ?") && cli.includes("sendTo(") === own.includes("sendTo("), "owner flag: a client-key render carries OWNER false so the page draws no send buttons (the code is present, the guard hides it)");

// v155.2 - the tab and the client key; v155.3 - the picture
import { worldPicturePrompt } from "../src/world_page.js";
const CLIENT = "client_only_key_abcdefgh0123";
const envC = Object.assign({}, env, { CLIENT_KEY: CLIENT, OPENAI_API_KEY: "oai" });
const callC = (p) => worker.fetch(new Request("https://azimuth-2.digitalchemy.workers.dev" + p), envC, ctx);
r = await callC("/versus?key=" + CLIENT); html = await r.text();
ok(r.status === 200 && html.includes('"OWNER":false') && html.includes('<nav class=nnav>') && html.includes('class=on href="/versus?key=' + CLIENT + '"') && html.includes("<span>VS</span>") && !html.includes(READ), "a client key opens the page: no send buttons, the tab bar with VS active, links carrying the client key, never the owner key");
r = await callC("/versus?key=" + READ); html = await r.text();
ok(r.status === 200 && html.includes('"OWNER":true') && html.includes("Make me a picture") && html.includes('href="/versus?key=' + READ + '"'), "the owner key opens it with the sends and the picture button, tab links carrying the owner key");
ok((await callC("/versus?key=wrong")).status === 401 && html.indexOf("<span>PLANS</span>") < html.indexOf("<span>VS</span>") && html.indexOf("<span>VS</span>") < html.indexOf("<span>CHARTS</span>"), "wrong key refused; VS sits between PLANS and CHARTS in the bar");
const pp = worldPicturePrompt("london");
ok(/DUBAI  vs  LONDON/.test(pp) && pp.includes("AED 4,260 / sq ft") && pp.includes("AED 7,200 / sq ft") && pp.includes("#006039") && /Big Ben/.test(pp) && worldPicturePrompt("nowhere") === null, "the picture prompt carries only the fact base's two prices and the city's landmark");
const png = Buffer.alloc(30000, 9).toString("base64"); let imgCalls = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => { const u = String(url); if (u.includes("api.openai.com/v1/images/generations")) { imgCalls++; const b = JSON.parse(init.body); if (!/DUBAI  vs  MONACO/.test(b.prompt) || b.model !== "gpt-image-1") return new Response("bad", { status: 400 }); return new Response(JSON.stringify({ data: [{ b64_json: png }] })); } return realFetch(url, init); };
const postC = (path, b) => worker.fetch(new Request("https://azimuth-2.digitalchemy.workers.dev" + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) }), envC, ctx);
sent.length = 0;
r = await postC("/versus/picture", { key: READ, city: "monaco" }); const pj = JSON.parse(await r.text());
ok(r.status === 200 && pj.ok && /\/img\/versus_monaco_\d{6}$/.test(pj.url) && imgCalls === 1 && sent.length === 1 && sent[0].type === "image" && sent[0].image.link === pj.url && /Dubai versus Monaco/.test(sent[0].image.caption) && store.has("img_" + pj.url.split("/img/")[1]), "picture: one image call with the pair's prompt, stored under img_, sent to her WhatsApp as an image with a caption");
ok((await postC("/versus/picture", { key: CLIENT, city: "monaco" })).status === 401 && (await postC("/versus/picture", { key: READ, city: "dubai" })).status === 404 && imgCalls === 1, "picture: the client key cannot make one; Dubai is not a pair");
globalThis.fetch = realFetch;
import { WORLD_SAMPLES as SMP } from "../src/world.js";
ok(SMP.length === 10 && SMP.filter(x => (x.rev || 1) === 2).length === 8 && SMP.filter(x => (x.rev || 1) === 1).map(x => x.city).join() === "monaco,mumbai" && SMP.every(x => x.text.split(/\s+/).length >= 105 && x.text.split(/\s+/).length <= 140), "v157: eight scripts are at revision 2 as stories; Monaco and Mumbai stay at revision 1 because she approved them; all still 105 to 140 words");
const revPage = (fb) => worldPageHtml(fb, true).split("const DATA = ")[1].split(";\n")[0];
ok(/"FB":\{\}/.test(revPage({ "1": { verdict: "no" } })), "a verdict with no revision is revision 1: on London, now revision 2, it is not shown");
ok(/"FB":\{"1":"yes"\}/.test(revPage({ "1": { verdict: "yes", rev: 2 } })), "a verdict recorded on revision 2 IS shown on the revision 2 script (the case that would have shipped broken)");
ok(/"FB":\{"2":"yes"\}/.test(revPage({ "2": { verdict: "yes" } })) && /"FB":\{\}/.test(revPage({ "2": { verdict: "yes", rev: 2 } })), "Monaco is still revision 1, so her revision 1 verdict shows and a revision 2 verdict would not");
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
