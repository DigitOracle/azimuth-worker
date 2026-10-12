// v532 - with a home-type pill on, each building card's count and "from AED" follow the chosen types (Kendall 12 Oct 2026: "there is still a mismatch")
import { SUPPLY_JS } from "../src/supply_page.js";
import fs from "node:fs";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const src = fs.readFileSync(new URL("../src/supply_page.js", import.meta.url), "utf8");
ok(/b\.pmint = pt;/.test(src) && /data-pmt="/.test(src), "the card carries the cheapest rent per home type");
ok(/pm=on\.length\?tmin\(c,on\):/.test(SUPPLY_JS), "the budget uses the chosen types' cheapest rent");
ok(/"from <b>AED "\+fmtA\(tm\)\+"<\/b> a year for "\+nm2/.test(SUPPLY_JS), "the 'from' line names the chosen types");
ok(/hl2\.innerHTML="<b>"\+k2\+"<\/b> "\+nm2/.test(SUPPLY_JS) && /in all<\/span>/.test(SUPPLY_JS), "the big count is the chosen types', the total underneath");
ok(/hl3\.innerHTML=hl3\.getAttribute\("data-h0"\)/.test(SUPPLY_JS), "pill off: the card goes back");
console.log(`v532 card follows type: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
