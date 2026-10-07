// v322 - the checks the evidence publish runs before it puts anything. READ-ONLY.
//   node scripts/check_devmap_evidence.mjs <first-pass index> <final index> <live index (the backup)>
// Exit 0 = safe to publish, 1 = stop. Prints what it checked.
import fs from "node:fs";
const [first, fin, live] = process.argv.slice(2).map((p) => JSON.parse(fs.readFileSync(p, "utf8")));
const size = fs.statSync(process.argv[3]).size;
const bad = [];
const nA = Object.keys(fin.areas).length;
if (nA < 35) bad.push("only " + nA + " areas in the final index (the live one has " + Object.keys(live.areas).length + ")");
if (nA < Object.keys(live.areas).length - 1) bad.push("the final index has fewer areas (" + nA + ") than the live one (" + Object.keys(live.areas).length + ")");
const withEv = Object.keys(fin.areas).filter((s) => fin.areas[s].ev && Array.isArray(fin.areas[s].ev.all) && fin.areas[s].ev.all[0] > 0);
if (withEv.length < 30) bad.push("the evidence is on only " + withEv.length + " areas (need 30)");
if (size > 2.0 * 1024 * 1024) bad.push("the file is " + Math.round(size / 1024) + " KB (limit 2,048 KB)");   // v378 - was 1.5 MB; the v373 evidence keys (bx, ce, b12x, c12e) add about 0.7 MB to the 0.97 MB live index, and the /img route serves it gzipped
// the old numbers are untouched
let cellsChecked = 0;
for (const s of Object.keys(first.areas)) {
  const A = fin.areas[s]; if (!A) { bad.push("area " + s + " is missing from the final index"); continue; }
  for (const k of Object.keys(first.areas[s].devs)) {
    const a = first.areas[s].devs[k], b = A.devs[k];
    if (!b) { bad.push(s + "/" + k + " is missing from the final index"); continue; }
    for (const f of ["c", "r", "h", "n", "b"]) if (JSON.stringify(a[f]) !== JSON.stringify(b[f])) bad.push(s + "/" + k + "." + f + " changed");
    cellsChecked += (a.c || []).length;
  }
}
if (JSON.stringify(first.cuts) !== JSON.stringify(fin.cuts)) bad.push("the tier cuts changed");
console.log("areas " + nA + " | with evidence " + withEv.length + " | size " + Math.round(size / 1024) + " KB | building cells compared " + cellsChecked + " | problems " + bad.length);
if (bad.length) { console.error("PROBLEMS:\n  " + bad.slice(0, 30).join("\n  ")); process.exit(1); }
