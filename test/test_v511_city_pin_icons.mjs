// v511 - the all-Dubai twin's amenity pins are icon badges (the kind's own icon in a disc, dashed ring = approximate), not dots,
// and the drop-down header says the count is across Dubai (Kendall 11 Oct 2026: "something else, like icons"; "seems like a lot for one district").
import fs from "node:fs";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const src = fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
ok(/function amImg\(k\)\{/.test(src) && /ICON\[k\]\.replace\("<svg ","<svg xmlns=/.test(src), "each kind's icon is rasterised once from MAP_ICONS");
ok(/actx\.setLineDash\(p\.i\.ap\?\[3\*r,2\.5\*r\]:\[\]\)/.test(src), "approximate pins get a dashed ring");
ok(/actx\.drawImage\(im,cx-s\/2,cy-s\/2,s,s\)/.test(src), "the icon is drawn inside the disc");
ok(/const where=dslug\?" in "\+D\.districts\[AMDIST\]\.name:" across Dubai"/.test(src), "the header says the count is in the chosen district, else across Dubai");
ok(/if\(dslug&&i\.d!==dslug\)return;/.test(src), "a chosen district scopes the pins to that district");
ok(/const _flyTo0=flyTo;flyTo=function\(ix,go\)\{AMDIST=ix;_flyTo0\(ix,go\);amRecalc\(\)\}/.test(src), "tap, search and jump-to all set the scope (they all go through flyTo)");
ok(/AMSC\.textContent="all Dubai";AMSC\.hidden=!dslug;/.test(src), "an 'all Dubai' control appears whenever a district is in focus (v516: with or without kinds)");
ok(!/actx\.fillStyle=p\.i\.ap\?"rgba\(12,20,19,\.8\)":col;/.test(src), "the plain dot is gone");
console.log(`v511 city pin icons: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
