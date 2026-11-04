// v756: the Work task list is grouped by status into closed accordions of small cards; the served script must still parse
import { workRoute } from "../src/work_log.js";
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } else console.log("ok", m); };
const env = { MEETINGS: { get: async () => null, put: async () => {}, delete: async () => {}, list: async () => ({ keys: [] }) }, INSIDER_KEY: "ins_najjuko_TESTKEY0123456789abcd" };
const url = new URL("https://x/momo/work.js?key=ins_najjuko_TESTKEY0123456789abcd");
const res = await workRoute(new Request(url), env, url, { isNaj: () => true, isAny: () => true, person: () => "najjuko", page: (k, r, b) => b });
const js = await res.text();
let parsed = true; try { new Function(js); } catch (e) { parsed = false; console.log(e.message); }
ok(parsed, "the Work script parses");
ok(js.includes("details class=tgrp") && js.includes('["Stuck","#B4533C"]'), "tasks grouped in accordions, Stuck first");
ok(!/details class=tgrp[^>]*' \+ ?" open"/.test(js) && js.includes('(OPEN[g[0]]?" open":"")'), "groups closed unless she opened them before");
ok(js.includes("grid-template-columns:minmax(0,1fr) minmax(0,1fr)"), "2-up small cards");
ok(js.includes("taskSheet(D.tasks[+r.getAttribute(\"data-tk\")])"), "a tap still opens the task sheet");
process.exit(fail ? 1 : 0);
