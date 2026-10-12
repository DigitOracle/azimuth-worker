// v541 - the places layer of the twins: (1) the marker loop's projection line had been swallowed by a trailing comment since v521
// (badges never drew, tapping a place on the map did nothing); (2) the chosen place gets a name tag on the map (Kendall 12 Oct, film take 16).
import fs from "node:fs";
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : String(x).slice(0, 300)); } };
const src = fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const a = src.indexOf("const CITY_PLACES_JS = `"), b = src.indexOf("\n`;", a);
let js = src.slice(a + "const CITY_PLACES_JS = `".length, b);
js = js.replace(/\\\\/g, "\\");
ok(!/distanceif\(/.test(js), "no code sits behind a comment on the marker line");
const loop = js.slice(js.indexOf("function amDraw()"), js.indexOf("(function amLoop()"));
ok(/p\.sx=\(q\.x\+1\)\/2\*W;p\.sy=\(1-q\.y\)\/2\*H;const col=AMEN\[p\.i\.k\]\[2\];/.test(loop.split("\n").find((l) => /const q=p\.v\.clone\(\)\.project\(cam\)/.test(l)) || ""), "the projection runs on the same live line as the loop, not inside a comment");
ok(/function amTagDraw\(W,H,r\)/.test(js) && /amTagDraw\(W,H,r\)\}/.test(js), "the tag is drawn every frame after the badges");
ok(/if\(!i\|\|!AMON\[i\.k\]\|\|i\.lon==null\)return;/.test(js), "the tag goes when its kind is switched off");
ok(/position approximate/.test(js.slice(js.indexOf("function amTagDraw"))) && /toUpperCase\(\)/.test(js.slice(js.indexOf("function amTagDraw"))), "second line: the kind in capitals, plus position approximate when flagged");
ok(/r\.onclick=\(\)=>\{const i=rows\[\+r\.dataset\.ix\];amTagSet\(i\);/.test(js) && /amTagSet\(i\);tip\.style\.display="block"/.test(js), "a tapped row and a tapped badge both set the tag");
ok(!/amTagSet\(null\)/.test(js.slice(js.indexOf('document.getElementById("amh").onclick'), js.indexOf('document.getElementById("amh").onclick') + 300)), "folding the panel keeps the tag");
// the whole script parses
try { new Function(js.replace(/\$\{[^}]*\}/g, "0")); pass++; } catch (e) { fail++; console.log("FAIL the places script does not parse:", e.message); }
console.log(`v541 place tag: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
