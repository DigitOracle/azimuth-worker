// v603 - the fixes from the full-button audit of 14 Oct (people picker consistency, empty Schedule label, cut titles, debrief label, progress-sheet wording, 'Not assigned' rows, confirms on Drop/Made, partner flag, month PDF on a phone)
const m = await import("../src/work_log.js");
let pass = 0, fail = 0; const ok = (c, msg, x) => { if (c) pass++; else { fail++; console.log("FAIL", msg, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };
const store = new Map();
const KV = { get: async (k) => store.get(k) || null, put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); }, list: async ({ prefix }) => ({ keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) };
const env = { MEETINGS: KV }, deps = { isNaj: () => true, model: "m", page: (k, r, b) => b, claudeJSON: async () => null };
const req = (path, body) => m.workRoute(new Request("https://w" + path + (path.includes("?") ? "&" : "?") + "key=K", body ? { method: "POST", body: JSON.stringify(body) } : {}), env, new URL("https://w" + path + (path.includes("?") ? "&" : "?") + "key=K"), deps);
const long = "Prepared the breast cancer awareness carousel with Sousan and briefed Vishant on the pink post for Friday morning";
const pr = await (await req("/momo/work/api", { action: "parse", text: long, date: "2026-10-14" })).json();
ok(pr.entries[0].title.length <= 60 && pr.entries[0].title.endsWith("\u2026"), "a long typed title is cut with an ellipsis, not mid-word silently", pr.entries[0].title);
const js = await (await req("/momo/work.js")).text();
ok(/x\.classList\.toggle\("on",on\)/.test(js) && /dv==="__alone"\?\(PREV\.alone&&!PREV\.people\.length\)/.test(js), "the people picker redraws every tick so By yourself and the names never both show");
ok(/sc0&&sc0\.name\?'Schedule 1: /.test(js), "no empty 'Schedule 1: .' label");
ok(/Saved when you tap Save progress/.test(js) && !/Saved to the task straight away/.test(js), "the progress sheet says when it saves");
const sv = await (await req("/momo/work/api", { action: "save", entry: { title: "Huddle", type: "Meeting", summary: "s", people: [], kpis: [1], scope: [], works: ["Org chart"], deliverables: [], evidence: [], next: [], questions: [], in_scope: true, effort: "1-2 hours", progress: [{ work: "Org chart", status: "In progress", percent: 50, owners: [] }], time_of_day: "Morning" }, text: "t", date: "2026-10-14" })).json();
const db = await (await req("/momo/work/debrief?id=" + sv.entry.id + "&date=2026-10-14")).text();
ok(/50% at the time of this entry/.test(db), "the debrief labels the task figure as of the entry");
const pj = await (await req("/momo/work/plan")).text();
ok(/if\(val===''\)nm='Not assigned'/.test(pj), "the empty choice in the pickers reads 'Not assigned'");
ok(/confirm\("Drop this trend\?/.test(pj) && /confirm\("Mark this trend as made\?"\)/.test(pj), "Drop and Mark as made ask first");
ok(/if\(n\.pillar!=="market"\)n\.sub=""/.test(pj), "a partner flag is cleared when the item is not industry related");
const mp = await (await req("/momo/work/plan/month?month=2026-11")).text();
ok(/@media\(max-width:600px\)\{\.pg\{padding:16px 12px 80px\}/.test(mp) && /td\.bx\{white-space:normal/.test(mp), "the month PDF wraps its decision boxes and leaves room above the fixed button on a phone");
let parsed = 0; for (const src of [js, pj.match(/<script>([\s\S]*)<\/script>/)[1]]) { try { new Function(src); parsed++; } catch (e) { console.log(String(e)); } }
ok(parsed === 2, "both screen scripts still parse");
console.log("v603 audit fixes: " + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
