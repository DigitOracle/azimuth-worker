// v264 - a single X closes the whole top row (title, search, district cards, chip row) on /map and the
// per-district twin (they share MAP_CHROME_JS/MAP_CHROME_CSS). Non-destructive: toggling .top's "closed"
// class only hides/shows via CSS, never touches search text, picked district, or chip toggle state.
// NEGATIVE CONTROL: remove the topx/topo elements from the .top HTML (or the JS wiring, or the CSS rules) and
// run this file - the matching assertion(s) must fail. Verified by doing so for each of the three pieces.
import { readFileSync } from "node:fs";
const SRC = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
let pass = 0, fail = 0;
const ok = (c, w) => { if (c) { pass++; console.log("  ok - " + w); } else { fail++; console.log("  FAIL - " + w); } };

// 1. HTML: topx (close) and topo (reopen) are direct children of .top, placed before <h1>
ok(SRC.includes('<div class=top><u class=topx id=topx title=close>✕</u><u class=topo id=topo title=show>▾ show</u><h1>'),
   "topx (close X) and topo (reopen tab) are both present as the first children of .top, before <h1>");

// 2. CSS: the close state hides exactly the named elements, and shows only the reopen tab
ok(SRC.includes('.top.closed h1,.top.closed .sub,.top.closed .srow,.top.closed .rail,.top.closed .am,.top.closed .topx{display:none}'),
   ".top.closed hides h1, .sub, .srow, .rail, .am and topx itself - everything except the reopen tab");
ok(SRC.includes('.top.closed .topo{display:block}'),
   ".top.closed explicitly shows .topo (the reopen tab)");
ok(SRC.includes(".topx{position:absolute;top:8px;right:8px;"), "the close button (.topx) has its own positioned style");
ok(SRC.includes(".topo{display:none;position:fixed;top:10px;left:12px;"), "the reopen tab (.topo) starts hidden by default, shown only when .top is closed");

// 3. JS: the wiring only ever toggles the "closed" class - never touches ON, ever, and it's a plain class
//    add/remove, so search text, the selected district, and every chip's own state survive a close/reopen
const wireIdx = SRC.indexOf('document.getElementById("topx"),to=document.getElementById("topo")');
ok(wireIdx > 0, "the topx/topo wiring IIFE exists");
const wire = SRC.slice(Math.max(0, wireIdx - 40), wireIdx + 260);
ok(/tx\.onclick=function\(\)\{tp\.classList\.add\("closed"\)\}/.test(wire), "clicking topx adds the .closed class to .top");
ok(/to\.onclick=function\(\)\{tp\.classList\.remove\("closed"\)\}/.test(wire), "clicking topo removes the .closed class from .top");
ok(!/\bON\[/.test(wire) && !wire.includes("value=\"\"") && !wire.includes(".value=''"),
   "the wiring never touches ON (chip state) or clears any input value - purely a class toggle");

// 4. the wiring is anchored right before within()'s own definition, so it runs unconditionally on the
//    first paint (both #topx and #topo exist in the static HTML from load, no async wait needed)
const withinIdx = SRC.indexOf("function within(i){var d=curD();");
ok(withinIdx > 0 && withinIdx > wireIdx && withinIdx - wireIdx < 300,
   "the wiring sits immediately before within()'s own definition - runs on first paint, not gated on any data fetch");

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
