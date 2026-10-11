// v513 - the kind counts in the all-Dubai twin's places drop-down follow the chosen district (Kendall 11 Oct 2026: "the numbers are still off"
// - Business Bay chosen, the list still said schools 286 / petrol stations 377, the city totals).
import fs from "node:fs";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const src = fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
ok(/const cnt=\{\};\(\(AM&&AM\.items\)\|\|\[\]\)\.forEach\(i=>\{if\(!dslug\|\|i\.d===dslug\)cnt\[i\.k\]=\(cnt\[i\.k\]\|\|0\)\+1\}\);/.test(src), "counts are recomputed per district on every recalc");
ok(/AMSEG\.querySelectorAll\("button\[data-k\]"\)\.forEach\(b=>\{const n=cnt\[b\.dataset\.k\]\|\|0;/.test(src), "each kind button shows its district count");
ok(/b\.classList\.toggle\("none",!n\)/.test(src) && /\.amseg button\.none\{opacity:\.45\}/.test(src), "a kind with nothing in the district is dimmed, not hidden");
ok(/AMSEG\.appendChild\(c\);amRecalc\(\)\}/.test(src), "v514: building the buttons recounts for the district already chosen");
console.log(`v513 counts follow district: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
