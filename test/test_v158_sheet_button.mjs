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
// v169 - an icon appears only where a sheet EXISTS. A slug says where one would live; these records say one does.
for (const slug of ["bellevue_towers", "the_edge", "churchill_tower"]) {
  store.set("sheetm_" + slug, JSON.stringify({ slug, pages: 3, bytes: 448000 }));
  store.set("sheet_" + slug, "%PDF-1.4 pretend document");   // v174 - the DOCUMENT is what makes a sheet exist
}
// v174 - and a meta with NO document is a hold placeholder: sheets.js writes one to record WHY a building has no
// sheet. Symphony had exactly this on a building row and showed an icon that 404d on tap, which is the fault
// v169 was written to prevent. Stage one here so the gate can never drift back.
store.set("sheetm_symphony", JSON.stringify({ slug: "symphony", name: "symphony", hold: "pictures are of a different building" }));
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
ok(ownerHtml.includes("class=gs title="), "the owner's page carries the sheet action");
ok(!clientHtml.includes("class=gs title="), "a client link carries NO sheet action - the routes would refuse it anyway, so the button must not be there");
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
ok(ownerHtml.includes('(r.t==="building"||r.t==="development")?((r.sheet&&(!SHEETS||SHEETS[r.sheet]))?'), "the action appears where the row's slug points at a sheet that EXISTS - a development row names a real building too");
ok(ownerHtml.includes('":(r.t==="building"?"<i class=gsp></i>":"")'), "only a building row holds the slot open, so the 4,470 development rows do not shift");
ok(!/"symphony":1/.test(ownerHtml), "a slug with a META but no DOCUMENT is not offered - that icon 404s on tap, which is the whole point of the existence check");
ok(ownerHtml.includes("var SHEETS={") && ownerHtml.includes('"bellevue_towers":1'), "the page is told which sheets exist, rather than assuming a slug means a document");
ok(clientHtml.includes("var SHEETS=null"), "a client link is told nothing about which sheets exist - it has no action to gate anyway");

// ── v160: icons, not text links (Kendall: "these should be nice small icons, not buttons") ────────────────
ok(ownerHtml.includes("var IC=") && ownerHtml.includes('viewBox=\\"0 0 256 256\\"'), "the row icons come from the app's own set, so a row and the tab bar do not draw the same place twice");
// The page carries these as the ESCAPE text \u2192 inside its own script, not as the arrow character, so a check written against the
// character alone can never fail. Check both spellings, and prove the check can see an arrow at all before trusting that it found none.
// Scoped to the ACTION labels, not to the word "twin" anywhere: the description line still ends with a prose link "on the twin \u2192", which
// is deliberate \u2014 it is a sentence, not one of the three actions. A broader check fails on that and teaches you to loosen it, which is how
// a test stops meaning anything.
const OLD_ACTION_LABELS = ['?"twin \\u2192"', '?"district \\u2192"', '>map \\u2192</a>', '>sheet \\u2192</a>'];
ok(OLD_ACTION_LABELS.every((s) => !ownerHtml.includes(s)), "no action is a text-and-arrow label any more - arrows read as a sequence, and these are three independent actions");
ok(ownerHtml.includes("on the twin \\u2192"), "the prose link in the description line is untouched - it is a sentence, and the check above is scoped so it stays that way");
ok(ownerHtml.includes("<i class=gsp></i>"), "a building with no sheet holds the slot open, so twin and map do not shift under her thumb between rows");
ok(ownerHtml.includes("width:40px;height:40px"), "the tap area is 40px around a 17px glyph - she is using this one-handed with a client watching");
ok(ownerHtml.includes('title="Client sheet"') && ownerHtml.includes('aria-label="Client sheet"'), "the icon still says what it is, to a finger and to a screen reader");
ok(ownerHtml.includes("esc(String(r.sheet))"), "the row's slug is used as given, and escaped");
ok(!ownerHtml.includes('replace(/[^a-z0-9]+/g,"_")'), "no name-derivation survives anywhere on the page");
ok(!ownerHtml.includes("slugOf"), "the derivation helper is gone, not merely unused");
ok(!ownerHtml.includes("data-d=") && !ownerHtml.includes("derived"), "the derived/authoritative flag is gone with it");
ok(!ownerHtml.includes("may be filed under the register"), "the hedge is gone - it existed only because we were guessing the name");

// ── what the panel says ──────────────────────────────────────────────────────────────────────────
ok(ownerHtml.includes('if(m.hold){d.innerHTML="<div class=spr>"+__se(m.hold)'), "a held building shows the pipeline's reason verbatim, escaped, and no dead button");
ok(ownerHtml.includes('m.pictures?" &middot; "+__se(m.pictures)'), 'the panel says WHICH pictures - "exteriors only" is a different proposition from "layouts and interiors"');
ok(ownerHtml.includes("m.has_pictures===false"), "has_pictures still answers for sheets pushed before the phrase existed");
ok(ownerHtml.includes('d.addEventListener("click",function(ev){ev.stopPropagation()})'), "a tap inside the panel does not also jump to the twin");
// v162 - the button hands her the FILE through the phone's share sheet and she picks the client. The old worry (a prefetch firing a send)
// is gone because the page no longer sends anything at all; the new worry is a LINK reaching a buyer, because a link to a sheet carries the
// owner key. These pin the file path and rule out the link path.
ok(ownerHtml.includes("navigator.share({files:") && ownerHtml.includes("navigator.canShare({files:"), "the sheet is shared as a file, and only after checking the device will take one");
ok(ownerHtml.includes('new File([bl],fn,{type:"application/pdf"})'), "it shares the bytes, not an address");
ok(!ownerHtml.includes("wa.me") && !ownerHtml.includes("api.whatsapp.com"), "no WhatsApp deep link is built - a link would carry the owner key into a buyer's hands");
ok(!ownerHtml.includes("/sheet_send"), "the page no longer posts the sheet into her own thread; she sends it herself, to whom she chooses");
ok(ownerHtml.includes('dl.download=fn') && ownerHtml.includes('"Saved - attach it in WhatsApp"'), "where there is no share sheet (a desktop browser) the file is saved and she is told what to do with it");
ok(ownerHtml.includes('(e&&e.name==="AbortError")?LBL'), "cancelling the share puts the button back, rather than reporting a failure she did not cause");

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
