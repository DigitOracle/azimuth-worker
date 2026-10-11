// v510 - the district twin's own HOMES stack panel (#stkp + its HOMES button) is withdrawn as well: it was the panel in Kendall's
// screenshot on 11 Oct 2026 ("useless ... Property Finder tells us exactly what's available where"). v509 had only hidden the
// map's budget panel (#hp). Hidden and off from the start; wiring inert.
import fs from "node:fs";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const src = fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
ok(/\+ '#hp,#stkp,#stkbtn(,#[a-z]+)*\{display:none!important\}'/.test(src), "STACK_CSS hides the map budget panel, the twin stack panel and its button (v517 added COLOUR BY to the same rule)");
ok(/STKON=false;\s*\/\/ v510/.test(src), "the stack filter starts OFF (no gold floor filter running behind a hidden panel)");
ok(/btn\.className="stkb";btn\.id="stkbtn";btn\.textContent="HOMES";btn\.hidden=true;/.test(src), "the HOMES launcher is hidden at creation");
ok(!/STKON=true;p\.classList\.add\("on"\);/.test(src), "the open-from-the-start line is gone");
console.log(`v510 twin homes stack withdrawn: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
