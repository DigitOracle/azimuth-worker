// v517 - COLOUR BY (district / height / developer) withdrawn from the all-Dubai twin, hidden like HOMES, wiring inert.
// Kendall 11 Oct 2026: "useless ... I wouldn't care about heights ... we're already zoned in on a district ... developers we have multiple other ways to get to".
import fs from "node:fs";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const src = fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
ok(/\+ '#hp,#stkp,#stkbtn,#colp\{display:none!important\}'/.test(src), "the stack CSS hides COLOUR BY with the other withdrawn panels");
ok(/<div id=colp class="hp colp">/.test(src), "the panel markup stays (hidden, not deleted - its wiring expects the elements)");
ok(/CITY_COLOUR_HTML \+ CITY_PLACES_HTML/.test(src), "PLACES stays in the stack");
console.log(`v517 colour by withdrawn: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
