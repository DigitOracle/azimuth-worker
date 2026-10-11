// v516 - on the all-Dubai twin, picking a district hides every OTHER district's buildings; within it, chosen kinds narrow further;
// "all Dubai" (the button, the panel's control, or the blank jump-to option) brings everything back.
// Kendall 11 Oct 2026: "when I pick Jumeirah Lake Towers, I want everything else on that digital twin to disappear".
import fs from "node:fs";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const src = fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
ok(/if\(di\[i\]!==AMDIST\|\|\(ks\.length&&!AMKEEP\.has\(i\)\)\)\{AMHID\.push\(i\);/.test(src), "other districts hidden; within the district only chosen kinds stay when kinds are on");
ok(/AMALL\.hidden=AMDIST<0;/.test(src) && /AMALL\.textContent="\\u2190 all Dubai"/.test(src), "an 'all Dubai' button shows while a district is in focus");
ok(/AMALL\.onclick=\(\)=>\{AMDIST=-1;const s=document\.getElementById\("sel"\);if\(s\)s\.value="";amRecalc\(\)\}/.test(src), "the button clears the focus and the jump-to box");
ok(/s\.addEventListener\("change",\(\)=>\{if\(!s\.value\)\{AMDIST=-1;amRecalc\(\)\}\}\)/.test(src), "the blank jump-to option is all Dubai too");
ok(/AMSC\.hidden=!dslug;/.test(src), "the panel's 'all Dubai' control shows whenever a district is in focus");
ok(/ar\.className="amarr";ar\.textContent="\\u25BE";ar\.onclick=\(e\)=>\{e\.stopPropagation\(\);L\.classList\.toggle\("open"\)\}/.test(src), "accordion: an arrow on the kind opens its list without toggling the kind");
ok(/b\.classList\.toggle\("has",!!\(AMON\[b\.dataset\.k\]&&dslug&&n\)\)/.test(src), "the arrow shows only for a kind that is on, in a district, with places");
ok(/const rows=\(\(AM&&AM\.items\)\|\|\[\]\)\.filter\(i=>i\.k===k&&i\.d===dslug\)\.sort/.test(src), "the list is that kind's places in that district, by name");
ok(/r\.onclick=\(\)=>\{const i=rows\[\+r\.dataset\.ix\];if\(window\.__cityFly\)window\.__cityFly\(i\.lon,i\.lat,700\);/.test(src), "tapping a row flies to the place");
console.log(`v516 district focus: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
