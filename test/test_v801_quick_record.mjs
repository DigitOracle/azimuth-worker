// v801: the Quick task button offers "Record a meeting instead", which opens the Momo Work recorder (Kendall 7 Nov).
import assert from "node:assert/strict";
import fs from "node:fs";
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const q = fs.readFileSync(new URL("../src/quick_task.js", import.meta.url), "utf8"), r = fs.readFileSync(new URL("../src/work_rec_page.js", import.meta.url), "utf8");
ok(q.includes('id="qt_rec"') && q.includes("Record a meeting instead"), "Quick task shows the record button");
ok(/getElementById\("wrec"\)/.test(q) && /w\.click\(\)/.test(q), "on the Work page it opens the recorder in place");
ok(/s\.set\("rec", "1"\)/.test(q) && q.includes('"/momo/work?"'), "elsewhere it goes to Work with rec=1, keeping the key");
ok(/get\("rec"\)==="1"/.test(r) && /\$\("wrec"\);if\(w\)w\.click\(\)/.test(r), "Work opens the recorder when rec=1");
const { QUICK_TASK_JS } = await import("../src/quick_task.js"); ok(typeof QUICK_TASK_JS === "string" && QUICK_TASK_JS.includes("qt_rec"), "module still exports the script");
new Function(QUICK_TASK_JS); ok(true, "quick task script parses");
console.log("v801 quick record:", n, "checks passed");
