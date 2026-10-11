// v509 - the HOMES budget panel is withdrawn from every stack (map, district twins, all-Dubai twin): Kendall 11 Oct 2026,
// "useless ... we have Property Finder to tell us exactly what's available where". Hidden by CSS; the wiring stays inert.
import fs from "node:fs";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const src = fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
ok(/const STACK_CSS = ''\r?\n\s*\+ '#hp(,#[a-z]+)*\{display:none!important\}'/.test(src), "STACK_CSS hides #hp first thing (v510 widened the same rule to the twin's stack panel)");
ok(/<div id=hp class=hp>/.test(src), "the panel markup is still there (hidden, not deleted - its wiring expects the elements)");
ok(/CITY_COLOUR_HTML \+ CITY_PLACES_HTML/.test(src), "the PLACES drop-down stays in the city stack");
console.log(`v509 homes panel withdrawn: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
