// v602 - the audit found every save since v583 threw: the script read a link field (#wl) the markup no longer had. This test loads the served markup and the served script together in a small DOM and
// presses the tick, so a control the script expects but the page lacks can never ship again.
const m = await import("../src/work_log.js");
let pass = 0, fail = 0; const ok = (c, msg, x) => { if (c) pass++; else { fail++; console.log("FAIL", msg, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };
const env = { MEETINGS: { get: async () => null, put: async () => {}, delete: async () => {}, list: async () => ({ keys: [], list_complete: true }) } };
const deps = { isNaj: () => true, model: "m", page: (k, r, b) => "<body>" + b + "</body>", claudeJSON: async () => null };
const html = await (await m.workRoute(new Request("https://w/momo/work?key=K"), env, new URL("https://w/momo/work?key=K"), deps)).text();
const js = await (await m.workRoute(new Request("https://w/momo/work.js?key=K"), env, new URL("https://w/momo/work.js?key=K"), deps)).text();
const ids = new Set([...html.matchAll(/\bid=([a-z_][a-z0-9_]*)/g)].map((x) => x[1]));
// every $("id") the script reads OUTSIDE a sheet/preview builder must exist in the page markup, or be guarded
const read = [...js.matchAll(/\$\("([a-z_][a-z0-9_]*)"\)\.value/g)].map((x) => x[1]);
const dynamic = new Set(["ps", "pxn", "ar_n", "pnw", "t_n", "a_t", "a_d", "a_s", "p_t", "e_note", "n_u", "n_h", "n_w", "n_a", "wd", "t_h", "t_w", "t_a", "tp_r"]);   // built by preview()/sheets, or present
const guarded = (id) => js.includes('if($("' + id + '"))$("' + id + '")') || js.includes('($("' + id + '")?$("' + id + '")');
const missing = [...new Set(read)].filter((id) => !ids.has(id) && !dynamic.has(id) && !guarded(id));
ok(missing.length === 0, "every field the script reads exists in the page or is guarded", missing);
ok(ids.has("pv") || /id=pv\b/.test(js), "the tick exists (in the page or drawn by the preview)");
ok(!/[^$]\$\("wl"\)\.value[^=]/.test(js.replace(/if\(\$\("wl"\)\)\$\("wl"\)\.value|\(\$\("wl"\)\?\$\("wl"\)\.value/g, "")), "the removed link field is never read unguarded");
console.log("v602 save markup: " + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
