// v158 — THE CLIENT SHEET ON THE FIND ROW (Kendall, 16 Sep 2026: "let's put the button in the upper right-hand corner so I can get to it
// quickly", then, shown that the twin's upper right is already taken by the budget and colour-by controls, he chose the search result itself).
//
// v158.2 — the row now carries the Land Department slug, so the name-derivation that stood here is gone. It was always a crutch: the slug
// comes from the register's project name, and where the register is terser than the marketing ("Peninsula Four" against a row reading
// "Peninsula Four, The Plaza") deriving from the row missed a sheet that exists. With the slug on the row, a miss is a real miss.
//
// What these checks are actually for:
//   1. A CLIENT key must not see the action at all. Find is a client page; the sheet routes are owner-only. A button that cannot work is
//      worse than no button, and worse still on a link a buyer is holding.
//   2. The emitted page script must PARSE. It lives inside a string in index.js, so esbuild never sees it — a stray quote ships a blank
//      Find page to her and no build or test would have said a word. That is not hypothetical: it happened while this was being written.
//   3. No guessing may creep back. If a row has no slug, it has no Land Department project behind it and can never have a sheet, so it
//      gets no action rather than one that fetches and fails.
import worker from "../src/index.js";

const READ = "owner_admin_key_never_in_client_links_0001";
const CLIENT = "client_key_current_abcdefghij";

const store = new Map();
const KV = {
  async get(k, t) { if (!store.has(k)) return null; const v = store.get(k); if (t === "json") { try { return JSON.parse(v); } catch (e) { return null; } } return v; },
  async put(k, v) { store.set(k, v); },
  async delete(k) { store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter((k) => k.startsWith(p)).map((name) => ({ name })), list_complete: true }; },
};
globalThis.fetch = async () => new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
const env = { MEETINGS: KV, READ_KEY: READ, CLIENT_KEY: CLIENT, RESIDENTS_KEY: "r", INGEST_TOKEN: "ING", WA_ALLOWED: "971565484397",
  WHATSAPP_TOKEN: "t", WA_PHONE_ID: "p", PUBLIC_ORIGIN: "https://azimuth-2.digitalchemy.workers.dev" };
const ctx = { waitUntil() {} };
const ORIGIN = "https://azimuth-2.digitalchemy.workers.dev";
const call = (path) => worker.fetch(new Request(ORIGIN + path), env, ctx);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("ok - " + m); } else { fail++; console.log("not ok - " + m); } };

const ownerHtml = await (await call("/find?key=" + encodeURIComponent(READ))).text();
const clientHtml = await (await call("/find?key=" + encodeURIComponent(CLIENT))).text();

// ── owner versus client ─────────────────────────────────────────────────────────────────────────
ok(ownerHtml.includes("var OWNER=true"), "the owner's page is marked as the owner's");
ok(clientHtml.includes("var OWNER=false"), "a client link is NOT marked as the owner's");
ok(ownerHtml.includes("class=gs data-s="), "the owner's page carries the sheet action");
ok(!clientHtml.includes("class=gs data-s="), "a client link carries NO sheet action - the routes would refuse it anyway, so the button must not be there");
ok(!clientHtml.includes("/sheet_send") && !clientHtml.includes("/sheet/"), "a client link mentions no sheet route at all");
ok(!ownerHtml.includes(CLIENT) && !clientHtml.includes(READ), "neither page leaks the other key");

// ── the emitted script must parse. esbuild cannot see inside the string that holds it. ───────────
for (const [label, html] of [["owner", ownerHtml], ["client", clientHtml]]) {
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).filter((s) => s.trim());
  let parsed = 0, err = "";
  for (const s of scripts) { try { new Function(s); parsed++; } catch (e) { if (!err) err = String((e && e.message) || e).slice(0, 120); } }
  ok(scripts.length > 0 && parsed === scripts.length, "every script on the " + label + " page parses" + (err ? " — " + err : "") + " (" + parsed + "/" + scripts.length + ")");
}

// ── the slug comes from the row, and nothing is guessed ──────────────────────────────────────────
ok(ownerHtml.includes('r.t==="building"&&r.sheet'), "the action appears only on a building row that carries a slug");
ok(ownerHtml.includes("esc(String(r.sheet))"), "the row's slug is used as given, and escaped");
ok(!ownerHtml.includes('replace(/[^a-z0-9]+/g,"_")'), "no name-derivation survives anywhere on the page");
ok(!ownerHtml.includes("slugOf"), "the derivation helper is gone, not merely unused");
ok(!ownerHtml.includes("data-d=") && !ownerHtml.includes("derived"), "the derived/authoritative flag is gone with it");
ok(!ownerHtml.includes("may be filed under the register"), "the hedge is gone - it existed only because we were guessing the name");

// ── what the panel says ──────────────────────────────────────────────────────────────────────────
ok(ownerHtml.includes('if(m.hold){d.innerHTML="<div class=spr>"+esc(m.hold)'), "a held building shows the pipeline's reason verbatim, escaped, and no dead button");
ok(ownerHtml.includes('m.pictures?" &middot; "+esc(m.pictures)'), 'the panel says WHICH pictures - "exteriors only" is a different proposition from "layouts and interiors"');
ok(ownerHtml.includes("m.has_pictures===false"), "has_pictures still answers for sheets pushed before the phrase existed");
ok(ownerHtml.includes('d.addEventListener("click",function(ev){ev.stopPropagation()})'), "a tap inside the panel does not also jump to the twin");
ok(ownerHtml.includes("/sheet_send") && ownerHtml.includes('method:"POST"'), "the send is a POST, so no link preview or prefetch can fire it");

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
