// v599 - a save says so (Kendall 14 Oct: Najjuko entered something at 12 and could not tell whether it was saved). The screen script parses; the tick handler confirms in words, tells her
// when a save did NOT happen (network, bad answer) and keeps what she wrote; an entry being checked is kept as a draft on the phone until it is saved or discarded.
const m = await import("../src/work_log.js");
let pass = 0, fail = 0; const ok = (c, msg, x) => { if (c) pass++; else { fail++; console.log("FAIL", msg, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };
const env = { MEETINGS: { get: async () => null, put: async () => {}, delete: async () => {}, list: async () => ({ keys: [], list_complete: true }) } };
const js = await (await m.workRoute(new Request("https://w/momo/work.js?key=K"), env, new URL("https://w/momo/work.js?key=K"), { isNaj: () => true, model: "m", page: (k, r, b) => b, claudeJSON: async () => null })).text();
let parsed = false; try { new Function(js); parsed = true; } catch (e) { console.log(String(e)); }
ok(parsed, "the screen script parses");
ok(/function toast\(msg,bad\)/.test(js) && js.includes("\\u2713 Saved: ") && /is filed under /.test(js), "a saved entry is confirmed in words with the day it was filed under");
ok(/\.catch\(function\(\)\{\$\("pv"\)\.disabled=false;toast\("Not saved: no connection/.test(js), "a failed save (no connection) re-enables the tick and says it did not save");
ok(/toast\("Not saved: "\+\(j\.error/.test(js) && !/alert\(j\.error\|\|"Could not save"\)/.test(js), "a refused save says so in the same place instead of a pop-up");
ok(/The server answered |The server sent something unexpected/.test(js), "a non-JSON or error answer becomes a readable message");
ok(/momo_work_draft/.test(js) && /function resumeDraft/.test(js) && /load\(\);resumeDraft\(\)/.test(js) && /function preview\(e\)\{PREV=JSON\.parse\(JSON\.stringify\(e\)\);saveDraft\(\);/.test(js), "an entry being checked is kept as a draft and offered back when the app opens");
ok(/clearDraft\(\);EDIT=null;/.test(js) && /\$\("wreset"\)\.onclick=function\(\)\{clearDraft\(\)/.test(js), "cancelling or starting over discards the draft");
// run the draft helpers against a small localStorage stand-in
const lift = (name) => { const at = js.indexOf("function " + name + "("); let d = 0; for (let i = js.indexOf("{", at); i < js.length; i++) { if (js[i] === "{") d++; else if (js[i] === "}" && --d === 0) return js.slice(at, i + 1); } };
const store = {}; const localStorage = { setItem: (k, v) => (store[k] = v), getItem: (k) => store[k] || null, removeItem: (k) => delete store[k] };
const f = new Function("localStorage", "PREV", "QUEUE", "QI", "$", lift("saveDraft") + "\n" + lift("clearDraft") + "\nreturn {saveDraft, clearDraft};");
const h = f(localStorage, { title: "Pixxi leads" }, [{ title: "a" }, { title: "b" }], 1, () => ({ value: "2026-10-14" }));
h.saveDraft(); const d = JSON.parse(store.momo_work_draft);
ok(d.prev.title === "Pixxi leads" && d.qi === 1 && d.q.length === 2 && d.date === "2026-10-14", "the draft keeps the entry, its place in the queue and the date", d);
h.clearDraft(); ok(!store.momo_work_draft, "a saved or cancelled entry leaves no draft");
console.log("v599 save confirmation: " + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
