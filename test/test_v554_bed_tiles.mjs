// v554 - the twin's advertised-now pop-up: four bedroom tiles instead of a line of words (Kendall 12 Oct 2026, film session)
import fs from "node:fs";
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : String(x).slice(0, 400)); } };
const src = fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const a = src.indexOf("function bedTiles(it){"), b = src.indexOf("\n", a);
const js = new Function("return `" + src.slice(a, b) + "`")();   // as the browser receives it
const bedTiles = new Function(js + "\nreturn bedTiles;")();
const h = bedTiles({ b: { studio: 1, "1": 8, "2": 3, "3+": 1 } });
ok((h.match(/<div( class=z)?><b>/g) || []).length === 4 && /<b>8<\/b><i>1 bed<\/i>/.test(h) && /<b>1<\/b><i>Studio<\/i>/.test(h) && /<b>1<\/b><i>3\+ bed<\/i>/.test(h), "Loreto: four tiles, the count large and the label under it", h);
const z = bedTiles({ b: { "1": 2 } });
ok((z.match(/class=z/g) || []).length === 3 && /<div class=z><b>0<\/b><i>Studio<\/i>/.test(z), "an empty band is a dimmed 0, never a missing tile", z);
ok(/advertised to rent now<\/span>'\+bedTiles\(it\)\+'<\/div>/.test(src) && !/<small>'\+amEsc\(bedLine\(it\)\)/.test(src), "the pop-up shows the tiles in place of the line of words");
ok(/\.bct\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/.test(src), "four columns that share the width (about 110 px each at 540 wide)");
console.log(`v554 bed tiles: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
