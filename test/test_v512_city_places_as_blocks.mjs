// v512 - on the all-Dubai twin, in a chosen district the places ARE blocks: the building nearest each place stays in the kind's colour,
// the rest of that district is hidden, other districts stay whole, clearing restores. Kendall 11 Oct 2026: "when I click on malls, that
// should be a block ... everything else should disappear ... dots make no sense within the digital footprint".
import fs from "node:fs";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const src = fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
ok(/const AMMAT0=mesh\.instanceMatrix\.array\.slice\(0\);/.test(src), "the original instance matrices are kept for the restore");
ok(/for\(const i of AMHID\)\{for\(let k=0;k<16;k\+\+\)M\[16\*i\+k\]=AMMAT0\[16\*i\+k\]\}/.test(src), "hidden buildings are restored before every recompute");
ok(/const j=nearestInst\(q\[0\],q\[1\],AMDIST,90\);p\.blk=j>=0;/.test(src), "each place takes the nearest building of the chosen district within 90 m");
ok(/if\(di\[i\]!==AMDIST\|\|\(ks\.length&&!AMKEEP\.has\(i\)\)\)\{AMHID\.push\(i\);for\(let k=0;k<16;k\+\+\)M\[16\*i\+k\]=0\}/.test(src), "v516: the chosen district stands alone (other districts hidden), and within it only the chosen kinds' blocks stay");
ok(/if\(AMDIST>=0\)\{if\(ks\.length\)\{/.test(src) && /else for\(const p of AMPTS\)p\.blk=false;/.test(src), "no district = nothing hidden; a district with no kinds shows the whole district (v516)");
ok(/const _paint0=paintCity;paintCity=function\(\)\{_paint0\(\);amPaint\(\)\}/.test(src), "kept blocks wear the kind's colour whatever COLOUR BY says");
ok(/for\(const p of AMPTS\)\{if\(p\.blk\)\{p\.sx=-1;continue\}/.test(src), "a place shown as a block draws no badge");
ok(/\+" as blocks"/.test(src), "the header says how many are shown as blocks");
console.log(`v512 city places as blocks: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
