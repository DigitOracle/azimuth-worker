// v154.5 - the world cards at /world (16 Sep 2026): Dubai against ten cities, prime price per square foot, the same numbers as the spoken
// pieces because both read src/world.js through worldFacts. Checks the page through the real worker, that every figure on it is the fact
// base's own, that the prime caveat and the sources are on the page, and that a client link without the key gets nothing.
import worker from "../src/index.js";
import { worldCardRows, worldCardsHtml } from "../src/world_cards.js";
import { WORLD_CITIES, USD_AED, worldFacts } from "../src/world.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };
const READ = "client_read_key_in_links_123";
const store = new Map();
const env = { MEETINGS: { async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); }, async list() { return { keys: [], list_complete: true }; } },
  READ_KEY: READ, WA_ALLOWED: "971565484397" };
globalThis.fetch = async () => new Response("{}");
const call = (p) => worker.fetch(new Request("https://azimuth-2.digitalchemy.workers.dev" + p), env, { waitUntil() {} });

// 1. the rows
const { dubai, rest, basis, sources, dip } = worldCardRows();
ok(dubai.city === "Dubai" && dubai.base === true && rest.length === WORLD_CITIES.length - 1, "rows: Dubai is the baseline and every other city has a card");
ok(rest.every((r, i) => i === 0 || rest[i - 1].prime_usd_per_sqft >= r.prime_usd_per_sqft), "rows: dearest first");
ok(rest[0].city === "Monaco" && rest.at(-1).city === "Mumbai", "rows: Monaco at the top, Mumbai at the foot - and Mumbai is cheaper than Dubai, which the page does not hide");
ok(rest.every(r => r.prime_aed_per_sqft === worldFacts(r.key, "psf").other.prime_aed_per_sqft), "rows: every AED figure is worldFacts' own arithmetic, so a card and a script cannot disagree");
ok(Math.abs(dubai.prime_aed_per_sqft - dubai.prime_usd_per_sqft * USD_AED) < 10, "rows: Dubai's AED figure follows the peg");

// 2. the page
const html = worldCardsHtml(READ, { fonts: "<!--fonts-->", navCss: ".nnav{}", nav: "<nav class=nnav></nav>" });
ok(html.startsWith("<!doctype html>") && html.includes("Dubai against the world") && !html.includes(READ), "page: renders, and the key is never printed on it");
ok((html.match(/class="c/g) || []).length + (html.match(/class="c me"/g) || []).length >= WORLD_CITIES.length, "page: one card per city");
ok(html.indexOf("Dubai</b>") < html.indexOf("Monaco</b>"), "page: Dubai is pinned first, then the dearest");
for (const r of [dubai, ...rest]) ok(html.includes("AED " + Number(r.prime_aed_per_sqft).toLocaleString("en-US")), "page: " + r.city + " shows its AED price per square foot");
ok(html.includes("AED 5m buys") && html.includes("US$1m buys"), "page: both framings - what AED 5 million buys, and what a million dollars buys");
ok(html.includes("<b>Prime</b>") && html.includes("AED 1,670") && html.includes("understate Dubai"), "page: says prime is the top few per cent, and that market-wide Dubai is a different number");
ok(html.includes(dip) && /down 4.5%/.test(html), "page: carries Savills' own line that Dubai prime fell this year - she is not caught out by a client");
ok(html.includes("saleable area") && html.includes("built-up"), "page: says the floor-area basis is not published and the cities are not measured alike");
ok(html.includes(sources.prices.published) && html.includes(sources.what_1m_buys.published) && html.includes("not a valuation"), "page: both sources with their publication dates, and no claim to be a valuation");
ok(html.includes("IMSEE") && html.includes("not in the world cities index"), "page: Monaco's figure is credited to the Monaco spotlight, not the index it is absent from");
const mumbai = rest.find(r => r.city === "Mumbai");
ok(html.includes(mumbai.multiple) && /below Dubai/.test(mumbai.multiple), "page: a city cheaper than Dubai says so in words, not just a number");
ok(html.includes("Income tax") && html.includes("Cost of buying") && html.includes("Rental yield") && html.includes("From Dubai"), "page: the detail behind a card - tax, what buying costs, yield, flight time");
ok(!/<script[^>]*>[^<]*fetch\(/.test(html) && html.includes('aria-expanded'), "page: no data is fetched at run time and the cards open with a tap");

// 3. through the worker
let r = await call("/world?key=" + READ);
const served = await r.text();
ok(r.status === 200 && /text\/html/.test(r.headers.get("Content-Type") || "") && served.includes("Dubai against the world"), "route: /world serves the page with the client key");
ok(/noindex/.test(r.headers.get("X-Robots-Tag") || "") && /no-store/.test(r.headers.get("Cache-Control") || ""), "route: not indexed, not cached");
for (const bad of ["/world", "/world?key=", "/world?key=wrong"]) { r = await call(bad); ok(r.status === 401, "route: " + (bad.split("=")[1] === undefined ? "no key" : bad.split("=")[1] ? "a wrong key" : "an empty key") + " gets 401"); }
r = await call("/find?key=" + READ);
ok(!(await r.text()).includes("/world?key="), "route: not linked from the app yet - which key it sits behind waits on the client-key split");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
