// v161 — THE CLIENT SHEET ON A DEVELOPER CARD (Kendall, 17 Sep 2026, on the Arada page: "the .pdf should be added here as well with the icon").
//
// The join is the interesting part. These cards come from the developer record, not the search index, so the `sheet` slug the index carries is
// not reachable here. The page already resolves each card to a building through umLookup(p.name) — that is how "on the twin" and "on the map"
// work on these cards — so the slug rides on THAT record. One join per page, already trusted, rather than a second one with its own failures.
//
// Two traps these checks exist for:
//   1. `p.sheet` already means the DEVELOPER's availability sheet on these cards ("on the developer sheet: 26 units for sale"). The client
//      sheet must not be read off the property record, or the two will be confused — probably by us, later.
//   2. The panel is now ONE implementation shared with the Find row. If the two ever drift, the words beside a client depend on which screen
//      she arrived from. The last check here pins them together.
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

// umNkey strips "the"/"tower"/"towers" and every non-alphanumeric, so "Bellevue Towers" keys as "bellevue".
store.set("img_board_devs", JSON.stringify({ developers: [{ key: "arada", name: "Arada", segment_label: "Wellness luxury", icon: "", ours: [],
  properties: [
    { kind: "portfolio", name: "Bellevue Towers", area: "Downtown Dubai", url: "https://example.com/b", handover: "31-Oct-2029" },
    { kind: "portfolio", name: "Unjoined Tower", area: "Business Bay", url: "https://example.com/u" },
    { kind: "portfolio", name: "Malformed Tower", area: "Business Bay", url: "https://example.com/m" },
  ] }] }));
// THE REAL SHAPE, which is the point of this fixture: `sheet` on these records is a NUMBER - the count of units on the developer's
// availability list - and the slug lives in `client_sheet`. Reading `sheet` shipped an icon whose slug was "26". It fetched nothing and told
// her there was no sheet. The fixture I first wrote here invented `sheet: "bellevue_towers"`, so it could never have caught that; this one is
// copied from what the pipeline actually writes.
store.set("img_unitmix_projects", JSON.stringify({ projects: {
  bellevue: { district: "downtown", i: 12, sheet: 18, client_sheet: "bellevue_towers" },
  unjoined: { district: "businessbay", i: 3, sheet: 26 },
  malformed: { district: "businessbay", i: 4, client_sheet: "../../etc/passwd?key=x" },
} }));

const devOwner = await (await call("/dev?d=arada&key=" + encodeURIComponent(READ))).text();
const devClient = await (await call("/dev?d=arada&key=" + encodeURIComponent(CLIENT))).text();

ok(devOwner.includes('data-s="bellevue_towers"'), "a developer card carries the sheet action, joined through the lookup its twin and map links already use");
ok(!devOwner.includes('data-s="unjoined'), "a card whose building has no slug gets no action - a miss, never a wrong answer");
ok(!devOwner.includes('data-s="26"') && !devOwner.includes('data-s="18"'), "a UNIT COUNT is never mistaken for a slug - this is the bug that shipped, and the check that would have caught it");
ok(!devOwner.includes("etc/passwd") && !devOwner.includes('data-s="../'), "a slug that is not the shape sheets.js accepts is not offered at all, so nothing unchecked reaches an href");
ok(devOwner.includes("Client sheet") && devOwner.includes('aria-label="Client sheet"'), "the developer card's icon says what it is, to a finger and to a screen reader");
ok(devOwner.includes("on the developer sheet") === false || !devOwner.includes('data-s="26'), "the DEVELOPER's availability sheet and the client sheet stay distinct - the slug is read off the building, not the property record");

ok(!devClient.includes("Client sheet"), "a client link on a developer page carries no sheet action");
ok(!devClient.includes("/sheet_send") && !devClient.includes("/sheet/"), "a client link on a developer page mentions no sheet route at all");
ok(!devOwner.includes(CLIENT) && !devClient.includes(READ), "neither developer page leaks the other key");

// The scripts here live inside a template literal, which esbuild parses as a string and never as code.
for (const [label, html] of [["owner", devOwner], ["client", devClient]]) {
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).filter((x) => x.trim());
  let parsed = 0, err = "";
  for (const x of scripts) { try { new Function(x); parsed++; } catch (e) { if (!err) err = String((e && e.message) || e).slice(0, 140); } }
  ok(scripts.length > 0 && parsed === scripts.length, "every script on the developer " + label + " page parses" + (err ? " — " + err : "") + " (" + parsed + "/" + scripts.length + ")");
}

// ONE panel, two pages.
const findOwner = await (await call("/find?key=" + encodeURIComponent(READ))).text();
const PANEL = 'if(m.hold){d.innerHTML="<div class=spr>"+__se(m.hold)';
ok(findOwner.includes(PANEL) && devOwner.includes(PANEL), "both pages run the SAME panel, so the words a client reads cannot depend on which screen she came from");
ok(devOwner.includes(".it,.prop"), "the shared panel finds its container on either page rather than assuming one");

// v161.1 - Kendall asked whether Snapshot/Deeper dive duplicated the PDF. They do not: they open the UNIT MIX inline, which exists for
// buildings that have no sheet at all. But they were two buttons naming two states of one thing, so they are now one that says what it
// opens. These checks pin the replacement rather than the old pair.
ok(devOwner.includes("data-m=mix") && devOwner.includes(">Unit mix<"), "one button, named for what it opens");
ok(!devOwner.includes(">Snapshot<") && !devOwner.includes(">Deeper dive<"), "neither of the two state-named buttons survives");
ok(devOwner.includes('aria-expanded=false') && devOwner.includes('setAttribute("aria-expanded"'), "the toggle reports whether it is open, so it is not a mystery to a screen reader either");
ok(devOwner.includes('var open=!pr2.classList.contains("on")'), "it toggles from the card's actual state rather than from which button was pressed");

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
