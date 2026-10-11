// v526 - fixes from the 11 Oct overnight audit of the twin and maps.
import fs from "node:fs";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const ix = fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
const bp = fs.readFileSync(new URL("../src/building_page.js", import.meta.url), "utf8");
const tb = fs.readFileSync(new URL("../src/twin_blocks.js", import.meta.url), "utf8");
const dm = fs.readFileSync(new URL("../src/devmap_page.js", import.meta.url), "utf8");
ok(/const HOMECAM=\{p:cam\.position\.clone\(\),t:ctl\.target\.clone\(\)\};/.test(ix) && /amRecalc\(\);anim=\{from:\{p:cam\.position\.clone\(\),t:ctl\.target\.clone\(\)\},to:\{p:HOMECAM\.p\.clone\(\),t:HOMECAM\.t\.clone\(\)\}/.test(ix), "'← all Dubai' flies back to the opening view of the whole city");
ok(/x\+=' <i style="background:'\+AMEN\[k\]\[2\]\+'"><\/i>'\+AMEN\[k\]\[0\]/.test(ix) && /x\+=' <i style="background:#C5A56A"><\/i>advertised now'/.test(ix), "every colour on screen has a legend entry");
ok(!/the twin \\u00b7 all Dubai/.test(ix) && !/">open the twin/.test(ix) && !/← the twin</.test(bp) && !/>Open the twin here|"Open the twin here/.test(tb), "no 'the twin' in titles, headings or links");
ok(/#hd\{max-width:calc\(100vw - 160px\)\}#hd h1\{font-size:17px/.test(ix) && /#amall\{position:fixed;left:14px;top:156px;z-index:7;/.test(ix), "phone width: the header stays clear of the panels; the search results sit over the all-Dubai button");
ok(/if\(d\.slug==="goldensymphony"\)e\.style\.display="none";/.test(ix) && /if\(D\.districts\[ix\]\.slug==="goldensymphony"\)return;/.test(ix), "the pilot slug is neither labelled nor offered as a district");
ok(/Loading the listings&hellip;/.test(dm) && /replace\(\/\\s\*-\\s\*\\d\+\$\/,''\)/.test(dm), "by developer: a loading line; a register name numbered '- 3' matches its listing's name");
const sp = fs.readFileSync(new URL("../src/supply_page.js", import.meta.url), "utf8");
ok(/data-tc="' \+ esc\(Object\.keys\(b\.tc/.test(sp) && /<div class=htn hidden><\/div>/.test(sp) && /tn\.innerHTML="<b>"\+k2\+"<\/b> of its adverts "/.test(sp), "with a pill on, each card says how many of ITS adverts are that type");
console.log(`v526 twin audit fixes: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
