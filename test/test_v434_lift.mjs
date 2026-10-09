// v434 - Momo gym machines: liftKey/liftMinutes and the page wiring, offline.   node test/test_v434_lift.mjs
import { liftKey, liftMinutes } from "../src/fit.js";
import fs from "node:fs";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + d : "")); } };
ok(liftKey("Leg Press") === liftKey(" leg-press ") && liftKey("Lat Pulldown") !== liftKey("Leg Press"), "the same machine matches however it is written");
ok(liftMinutes(3, 12) >= 8 && liftMinutes(3, 12) <= 11, "3 x 12 counts as about 9 minutes", liftMinutes(3, 12));
ok(liftMinutes(1, 1) >= 2 && liftMinutes(1, 1) <= 3, "a single set still counts 2 to 3 minutes", liftMinutes(1, 1));
const src = fs.readFileSync(new URL("../src/fit.js", import.meta.url), "utf8"), pg = fs.readFileSync(new URL("../src/fit_page.js", import.meta.url), "utf8");
ok(/op === "lift"/.test(src) && /op"\) === "machine"/.test(src), "the server takes a machine photo and a lift");
for (const id of ["mph", "lift", "ls", "lp", "lk", "lgo", "lno", "rt", "rtt", "rt60", "rt90", "rtx", "mphi", "lmn", "lmm", "llast"]) ok(src.indexOf('id="' + id + '"') > 0 && pg.indexOf("'" + id + "'") > 0, "page element " + id + " exists and is wired");
console.log("\n" + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
