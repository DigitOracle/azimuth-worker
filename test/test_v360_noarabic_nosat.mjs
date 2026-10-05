// v360 - Kendall's standing rules: never satellite / aerial imagery in the product; no raw Arabic on a client page that is not bilingual.
import fs from "node:fs";
import { arFree } from "../src/building_page.js";
import { ejariIdentity } from "../src/ejari_page.js";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };
const strip = (s) => s.split(String.fromCharCode(10)).filter((l) => !/^\s*\/\//.test(l)).join(String.fromCharCode(10));   // whole-line comments are allowed to say the word
const BAD = /World_Imagery|World Imagery|arcgisonline|Vantor|Earthstar|satellite|arcgis\/imagery|\bimagery\b/i;
console.log("A - no satellite in the user-facing modules");
for (const f of ["building_page", "blocks_page", "brief_page", "devmap_page", "ejari_page", "start_page", "supply_page", "world_page", "tapcards", "twin_blocks"]) {
  const p = new URL("../src/" + f + ".js", import.meta.url);
  if (!fs.existsSync(p)) continue;
  const code = strip(fs.readFileSync(p, "utf8"));
  const m = code.match(BAD);
  ok(!m, f + ".js has no satellite or aerial imagery" + (m ? " (found: " + m[0] + ")" : ""));
}
const ix = fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
ok(!/arcgis\/imagery/.test(ix), "index.js: no Esri imagery basemap style (report map)");
ok(!/sat:"arcgis/.test(ix) && !/🛰 satellite/.test(ix), "index.js: the /map page has no satellite view");
ok(!/<div class=satc>Esri World Imagery/.test(ix) && !/url\(' \+ najSat\(a\.area\)/.test(ix), "index.js: the area page has no satellite hero or credit");
ok(!/GIMG=g;HAVE_GROUND=true/.test(ix) && /function drawGroundImagery\(\)\{return\}/.test(ix), "index.js: the twin no longer drapes an aerial sheet");
console.log("B - no raw Arabic");
ok(arFree("SHAMAL WAVES · شمال ويفس · #1807") === "SHAMAL WAVES · #1807", "Ejari-style identity keeps the English name and the number");
ok(arFree("بنك الإمارات") === "name in Arabic on the register", "an Arabic-only string says so without the characters");
ok(arFree("Emirates NBD") === "Emirates NBD", "English text is untouched");
ok(ejariIdentity("SHAMAL WAVES", "شمال", "1807") === "SHAMAL WAVES · #1807", "ejariIdentity drops the Arabic");
ok(ejariIdentity("", "شمال", "1807") === "name in Arabic on the register · #1807", "ejariIdentity with only Arabic");
console.log("\n" + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
