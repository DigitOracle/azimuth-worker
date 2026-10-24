// v623 - the transcript page of a recording has a Back button, Share and Share / Save as PDF, and carries the transcript safely (Kendall, 24 Oct 2026)
const m = await import("../src/work_log.js");
let pass = 0, fail = 0; const ok = (c, msg) => { if (c) pass++; else { fail++; console.log("FAIL", msg); } };
const store = new Map();
const KV = { get: async (k) => store.get(k) ?? null, put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); }, list: async ({ prefix }) => ({ keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) };
const env = { MEETINGS: KV };
store.set("recw_20261024abc", JSON.stringify({ id: "20261024abc", title: "FN Realty website meeting", date: "2026-10-24", started_hm: "10:00", ended_hm: "10:40", secs: 2400, status: "drafted", parts: 1, notes: { summary: "Website plan </script> test", decisions: [], actions: [], people: ["Ali"] } }));
store.set("recs_20261024abc_000", JSON.stringify({ n: 0, text: "Hello </script><b>team", secs: 2400 }));
const deps = { isNaj: (e, u) => u.searchParams.get("key") === "K", page: (k, r, b) => b };
const u = new URL("https://w/momo/work/rec/view?key=K&id=20261024abc"); const r = await m.workRoute(new Request(u), env, u, deps); const h = await r.text();
ok(r.status === 200, "page opens for her key");
ok(/Back<\/a>/.test(h) && h.includes("/momo/work?key=K"), "Back link returns to the work log");
ok(h.includes("Share / Save as PDF") && h.includes("print()"), "Save as PDF button");
ok(h.includes("id=sv") && h.includes("navigator.share"), "Share button");
ok(!/var T=[^;]*<\/script>/.test(h), "transcript text cannot close the script tag");
ok(h.includes("@media print{body{background:#fff}.bar,.no{display:none}"), "buttons are hidden on the PDF");   // v627: the small Delete control is hidden too
const u2 = new URL("https://w/momo/work/rec/view?key=bad&id=20261024abc"); const r2 = await m.workRoute(new Request(u2), env, u2, deps);
ok(r2.status === 404, "wrong key sees nothing");
console.log("v623 rec view: " + pass + " passed, " + fail + " failed"); if (fail) process.exit(1);
