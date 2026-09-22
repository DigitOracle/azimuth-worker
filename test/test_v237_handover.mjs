// v237 — HAND ANY BUILDING OVER (Kendall, 22 Sep 2026, looking at Kingdom Gate: "I am still missing the
// download, whatsapp, email share buttons on this, message other chats").
//
// The whole share row used to sit inside `if (D.dossier)`. A dossier PDF exists for 206 buildings; Dubai has
// tens of thousands. So on almost every building the row was simply absent — not disabled, absent — and there
// was no way to send the thing you were standing in front of.
//
// NOTE ON WHAT THIS CAN CHECK. The row is built by a function that runs in the BROWSER, inside a script
// string, so a server-side render carries its source, not its output — both arms of every ternary sit in the
// HTML whatever D holds. Asserting `html.includes(">Download<")` would therefore pass on a page that never
// draws a Download button, which is the kind of test that lets a regression through. So branch behaviour is
// pinned on the emitted SOURCE, and only what is really decided on the server (the share key) is asserted
// against the rendered page.
//
// What these checks are for:
//   1. The row is reached whether or not a dossier was built. That is the whole point of v237.
//   2. A SHARE NEVER CARRIES THE OWNER KEY. Kendall browses with READ_KEY; a WhatsApp or QR built from it
//      would hand the owner key to a buyer. v220 got this right for the dossier; v237 widens the surface to
//      every building in Dubai, so the invariant is pinned here rather than trusted.
//   3. With no client key on the worker there is nothing a share could carry, so the row says so instead of
//      drawing buttons that produce a link the recipient cannot open.
import { buildingPageHtml } from "../src/building_page.js";
import { readFileSync } from "node:fs";

const READ = "owner_admin_key_never_in_client_links_0001";
const CLIENT = "client_key_current_abcdefghij";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };

const base = { name: "Kingdom Gate", district: "Jabal Ali First", slug: "jabalalifirst", id: "101", floors: [], sales: {}, register: [], units: null, people: null, anchors: null, plans: null };
const render = (extra) => buildingPageHtml(Object.assign({}, base, extra), READ, "");
const FILE = readFileSync(new URL("../src/building_page.js", import.meta.url), "utf8");

// 1. the row is reached for every building — the bug v237 fixes
ok(/\n\s*dossierBlock\(\) \+/.test(FILE) && !/D\.dossier \? dossierBlock\(\)/.test(FILE),
  "the row is called unconditionally; the `D.dossier ?` gate that hid it on most of Dubai is gone");
ok(/D\.dossier \? "The dossier" : "Send this building"/.test(FILE),
  "with a PDF it reads The dossier, without one it reads Send this building");

// 2. inside the row, the parts that really do depend on a PDF
ok(/\(D\.dossier \? '<a class=da target=_blank rel=noopener href="' \+ esc\(dossierUrl\(false\)\) \+ '" download>Download<\/a>' : ""\)/.test(FILE),
  "Download is drawn only where a PDF was actually built");
ok(/id=dwa[\s\S]{0,160}id=dmail[\s\S]{0,160}id=dshare[\s\S]{0,160}id=dcopy[\s\S]{0,160}id=dqr/.test(FILE),
  "WhatsApp, Email, the phone's share sheet, Copy link and QR are all in the row (\"message other chats\")");
ok(FILE.includes("'<span class=dnote>sharing needs a client key on this worker</span>'"),
  "with no client key the row explains itself instead of drawing buttons that cannot open");

// 3. the guard: the wiring waits on the share key, NOT on a dossier
const wire = FILE.split("function wireDossier()")[1].split("function showQR")[0];
ok(/if \(!D\.shareKey\) return;/.test(wire) && !/!D\.dossier/.test(wire),
  "wireDossier returns early only when there is no share key - a missing dossier no longer disables it");
ok(wire.includes("handoverUrl(true)") && !/\bK\b/.test(wire),
  "every share control is built from handoverUrl(true) - the share key - and never from the page key");
ok(/function pageUrl\(share\) \{[\s\S]{0,200}share \? \(D\.shareKey[\s\S]{0,200}location\.pathname/.test(FILE),
  "pageUrl takes the share key when sharing, and is built from location so every building route is right");
ok(FILE.includes("function handoverUrl(share) { return D.dossier ? dossierUrl(share) : pageUrl(share); }"),
  "a share sends the PDF where one exists and the page where one does not");

// 4. the server side: the owner key never reaches a page as the thing a share would carry
const asOwner = render({ shareKey: CLIENT });
ok(asOwner.includes(CLIENT), "the client share key is handed to the page");
ok(!/wa\.me[^"'\\]*owner_admin_key/.test(asOwner) && !/mailto:[^"'\\]*owner_admin_key/.test(asOwner),
  "no share link anywhere in the rendered page is built with the owner key");
ok(render({ shareKey: "" }).includes("sharing needs a client key on this worker"),
  "a worker with no client key still renders the building page, share row and all");

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
