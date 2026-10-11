// v515 - the all-Dubai twin carries no colour without a meaning: one stone colour for every building, the legend names only what is on
// screen, and colour appears only under COLOUR BY (height / developer, both with legends) or a PLACES kind. Kendall 11 Oct 2026:
// "the colours should mean something ... otherwise what do they mean?"
import fs from "node:fs";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const src = fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
ok(/const stone=new THREE\.Color\(0xC9D4CD\);/.test(src) && /for\(let i=0;i<n;i\+\+\)\{let r=stone\.r,g=stone\.g,b=stone\.b;/.test(src), "every building starts stone, not its district hue");
ok(/else paintCity\(\);\s*\/\/ v515/.test(src), "the neutral paint is applied at load");
ok(/<div id=leg><i style="background:#C9D4CD"><\/i>buildings <i style="background:#3E8A7E"><\/i>sea/.test(src), "the legend names buildings, sea, water - no 'massing by district', no 'towers lighter'");
ok(!/massing by district/.test(src), "the old legend wording is gone");
ok(/<b id=colres>none<\/b>/.test(src) && /data-c="">none<\/button>/.test(src), "COLOUR BY defaults to none");
ok(/Colour only where it means something/.test(src), "the panel says why");
console.log(`v515 no meaningless colour: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
