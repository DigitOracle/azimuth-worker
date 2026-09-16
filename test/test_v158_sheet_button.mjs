// v158 — THE CLIENT SHEET ON THE FIND ROW (Kendall, 16 Sep 2026: "let's put the button in the upper right-hand corner so I can get to it
// quickly", then, shown that the twin's upper right is already taken by the budget and colour-by controls, he chose the search result itself).
//
// What these checks are actually for:
//   1. A CLIENT key must not see the action at all. Find is a client page; the sheet routes are owner-only. A button that cannot work is
//      worse than no button, and worse still on a link a buyer is holding.
//   2. The emitted page script must PARSE. It lives inside a string in index.js, so esbuild never sees it — a stray quote ships a blank
//      Find page to her and no build or test would have said a word. This is the check that catches that.
//   3. The slug derived from a building's name must match the slugs the pipeline actually pushed, or she is shown "no sheet yet" for a
//      tower that has one.
import worker from "../src/index.js";

const READ = "owner_admin_key_never_in_client_links_0001";
const CLIENT = "client_key_current_abcdefghij";
const HER = "971565484397";

const store = new Map();
const KV = {
  async get(k, t) { if (!store.has(k)) return null; const v = store.get(k); if (t === "json") { try { return JSON.parse(v); } catch (e) { return null; } } return v; },
  async put(k, v) { store.set(k, v); },
  async delete(k) { store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter((k) => k.startsWith(p)).map((name) => ({ name })), list_complete: true }; },
};
globalThis.fetch = async () => new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
const env = { MEETINGS: KV, READ_KEY: READ, CLIENT_KEY: CLIENT, RESIDENTS_KEY: "r", INGEST_TOKEN: "ING", WA_ALLOWED: HER,
  WHATSAPP_TOKEN: "t", WA_PHONE_ID: "p", PUBLIC_ORIGIN: "https://azimuth-2.digitalchemy.workers.dev" };
const ctx = { waitUntil() {} };
const ORIGIN = "https://azimuth-2.digitalchemy.workers.dev";
const call = (path) => worker.fetch(new Request(ORIGIN + path), env, ctx);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("ok - " + m); } else { fail++; console.log("not ok - " + m); } };

// ── the page, as the owner and as a client ──────────────────────────────────────────────────────
const ownerRes = await call("/find?key=" + encodeURIComponent(READ));
const ownerHtml = await ownerRes.text();
const clientRes = await call("/find?key=" + encodeURIComponent(CLIENT));
const clientHtml = await clientRes.text();

ok(ownerRes.status === 200 && clientRes.status === 200, "Find opens on both keys (it is an app page)");
ok(ownerHtml.includes("var OWNER=true"), "the owner's page is marked as the owner's");
ok(clientHtml.includes("var OWNER=false"), "a client link is NOT marked as the owner's");
ok(ownerHtml.includes("class=gs data-s="), "the owner's page carries the sheet action");
ok(!clientHtml.includes("class=gs data-s="), "a client link carries NO sheet action - the routes would refuse it anyway, so the button must not be there");
ok(!clientHtml.includes("/sheet_send") && !clientHtml.includes("/sheet/"), "a client link mentions no sheet route at all");
ok(!ownerHtml.includes(CLIENT) && !clientHtml.includes(READ), "neither page leaks the other key");

// ── the emitted script must parse. esbuild cannot see inside the string that holds it. ───────────
const scripts = [...ownerHtml.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).filter((s) => s.trim());
ok(scripts.length > 0, "the page emits a script");
let parsed = 0, firstErr = "";
for (const s of scripts) {
  try { new Function(s); parsed++; } catch (e) { if (!firstErr) firstErr = String((e && e.message) || e).slice(0, 120); }
}
ok(parsed === scripts.length, "every emitted script parses" + (firstErr ? " — " + firstErr : "") + " (" + parsed + "/" + scripts.length + ")");

const clientScripts = [...clientHtml.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).filter((s) => s.trim());
let cParsed = 0;
for (const s of clientScripts) { try { new Function(s); cParsed++; } catch (e) {} }
ok(cParsed === clientScripts.length, "every emitted script parses on a client link too (" + cParsed + "/" + clientScripts.length + ")");

// ── the slug rule, against the six the pipeline actually pushed ──────────────────────────────────
const slugOf = (name) => String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 50);
const REAL = [
  ["Bellevue Towers", "bellevue_towers"],
  ["The EDGE", "the_edge"],
  ["Treppan Tower", "treppan_tower"],
  ["Peninsula Four", "peninsula_four"],
  ["Symphony", "symphony"],
  ["Serenia District East", "serenia_district_east"],
];
for (const [name, want] of REAL) ok(slugOf(name) === want, 'slug: "' + name + '" -> ' + want);
ok(slugOf("Al Maktoum  -  Tower #2!") === "al_maktoum_tower_2", "slug: punctuation and doubled spaces collapse to single underscores");
ok(slugOf("   ") === "", "slug: a nameless row yields nothing rather than an underscore that would hit a wrong key");
ok(slugOf("x".repeat(80)).length === 50, "slug: capped at 50, the pipeline's own cap - 60 would miss every long name");
ok(slugOf("SERENIA DISTRICT - EAST") === "serenia_district_east", "slug: a spaced hyphen collapses to ONE underscore, as the pipeline does");

// the page's own copy of the rule must be the one tested above
ok(ownerHtml.includes('.slice(0,50)') && ownerHtml.includes('replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"")'), "the page derives the slug by the rule these checks cover");
ok(ownerHtml.includes("if(r.sheet)return String(r.sheet)"), "a slug supplied by the pipeline wins over the derived one, so a rename cannot break the link");

// ── the panel must not fire the row's jump to the twin ───────────────────────────────────────────
ok(ownerHtml.includes('d.addEventListener("click",function(ev){ev.stopPropagation()})'), "a tap inside the panel does not also jump to the twin");
ok(ownerHtml.includes('if(m.hold){d.innerHTML="<div class=spr>"+esc('), "a held building shows a reason, not a dead button");
ok(ownerHtml.includes(":m.hold)"), "a hold the pipeline stored is quoted as it stands");
ok(ownerHtml.includes("esc(o.st===404&&derived?"), "a 404 on a slug we DERIVED is worded as doubt, not as a confident \"no sheet\" - the register may name the tower more tersely than the row does");
ok(ownerHtml.includes('data-d="'), "the row records whether its slug came from the pipeline or was derived here");
ok(ownerHtml.includes('derived=a.getAttribute("data-d")==="1"'), "the panel reads that flag before it words a miss");

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
