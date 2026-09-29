// v265 - a small X on the HOMES filter panel (#stkp) closes it. On mobile the panel can cover the whole
// screen, and the only other control is the "HOMES" toggle button that opened it - which sits in the
// filter row above the panel and can be scrolled out of reach once the panel is open and tall.
// NEGATIVE CONTROL: remove the stkx element (or its click wiring, or the pointerdown guard) and run this
// file - the matching assertion(s) must fail. Verified by doing so for each of the three pieces.
import { readFileSync } from "node:fs";
const SRC = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
let pass = 0, fail = 0;
const ok = (c, w) => { if (c) { pass++; console.log("  ok - " + w); } else { fail++; console.log("  FAIL - " + w); } };

// 1. HTML: the stkx close element is inside the panel's <h4>, so it is part of the draggable header
ok(SRC.includes("p.innerHTML='<h4>Homes<u class=stkx id=stkx title=close>✕</u></h4>"),
   "stkx (close X) is the first child of the HOMES panel's <h4>");

// 2. CSS: .stkx is positioned inside the (now relative) h4, so it doesn't get carried off by any layout shift
ok(SRC.includes("#stkp h4{position:relative}.stkx{position:absolute;top:0;right:0;"),
   ".stkx is absolutely positioned inside the now-relative #stkp h4");

// 3. JS: clicking stkx closes the panel AND syncs the HOMES toggle button's own "on" state, so reopening
//    via that button still works correctly afterwards (no stuck-open/stuck-closed desync)
const stkxWireIdx = SRC.indexOf('const stkx=document.getElementById("stkx");');
ok(stkxWireIdx > 0, "the stkx close wiring exists");
const wire = SRC.slice(stkxWireIdx, stkxWireIdx + 220);
ok(/STKON=false/.test(wire), "clicking stkx sets STKON=false");
ok(/btn\.classList\.remove\("on"\)/.test(wire), "clicking stkx un-highlights the HOMES toggle button");
ok(/p\.classList\.remove\("on"\)/.test(wire), "clicking stkx hides the panel itself");

// 4. the drag handler on the header must not fire when the click originated on stkx - otherwise closing
//    the panel would also start (and instantly cancel) a drag, or worse, eat the click before it reaches
//    the close button's own onclick
ok(SRC.includes('head.addEventListener("pointerdown",(e)=>{if(e.target&&e.target.id==="stkx")return;stkDrag(e)});'),
   "the header's drag-start handler ignores pointerdown events that originate on stkx");

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
