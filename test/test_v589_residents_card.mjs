// v589 - the building panel's "What residents say" card: loads gbld_<district>, shows rating + themes + five latest reviews + the Google credit, never scrolls the snapshot
import fs from "node:fs";
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const s = fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
ok(/fetch\("\/img\/gbld_\$\{slugName\}"\)/.test(s), "the panel loads the district's resident-review file");
ok(/What residents say/.test(s) && /Read the '\+gb\.reviews\.length\+' latest reviews/.test(s) && /Five most recent only; themes are our own reading/.test(s), "rating, themes and the latest reviews, with the honest limit");
ok(/Google reviews, as of /.test(s) && /Google Maps<\/a>/.test(s), "the Google credit and the Maps link");
ok(/const chip=chip0\+gchipR;/.test(s) && s.indexOf("const gchipR") < s.indexOf("const chip=chip0+gchipR;"), "the rating chip is declared before it is used");
ok(/'<div class=deep>'\+_vidHtml\+tstrip\+astrip\+resHtml\+umxHtml\+acts/.test(s), "the card sits in the deeper dive, so the snapshot never grows");
console.log("v589 residents card: " + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
