// v273 - "Send this building" (WhatsApp / Email / Copy link / QR code) did nothing (Kendall, 30 Sep 2026). The buttons are
// drawn by dossierBlock() inside the About card, but wireDossier() - which gives them their href and click handlers - was only
// called from the floor card, which has no such buttons. The About card must wire them after it draws them.
// NEGATIVE CONTROL: delete the wireDossier() call at the end of the About handler and run this file - A2 fails. Verified.
import { readFileSync } from "node:fs";
const SRC = readFileSync(new URL("../src/building_page.js", import.meta.url), "utf8");
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };

const a0 = SRC.indexOf('$("about").onclick = () => {');
const a1 = SRC.indexOf("\n  };", a0);
const about = SRC.slice(a0, a1);
ok(a0 > 0 && a1 > a0 && about.includes("dossierBlock()"), "A1 the About card draws the Send buttons (dossierBlock)");
const drawn = about.lastIndexOf("open_("), wired = about.lastIndexOf("wireDossier();");
ok(wired > drawn && drawn > 0, "A2 and wires them AFTER it draws them (wireDossier follows open_)");

// every button the block draws has its action in wireDossier
const w0 = SRC.indexOf("function wireDossier() {"), w1 = SRC.indexOf("\n  }", w0);
const wire = SRC.slice(w0, w1);
for (const id of ["dwa", "dmail", "dcopy", "dqr", "dshare"]) ok(new RegExp('\\$\\("' + id + '"\\)').test(wire), "A3 wireDossier gives #" + id + " its action");

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
