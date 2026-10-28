// v653 - Edit and Share PDF on every FN printable page (entry, report, plan week/month); her key only. FAKE data only (the worker repo is public).
const worker = (await import("../src/index.js")).default;
const { HTML2PDF_SRC } = await import("../src/pdf_tools.js");
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };
const store = new Map();
const KV = { get: async (k) => (store.has(k) ? store.get(k) : null), put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); },
  list: async ({ prefix } = {}) => ({ keys: [...store.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) };
const NAJ = "ins_najjuko_TESTKEY0123456789abcd", OWNER = "ins_kendall_TESTKEY0123456789abcd";
const env = { MEETINGS: KV, INSIDER_KEY: NAJ + "," + OWNER }, ctx = { waitUntil() {}, passThroughOnException() {} };
const get = (path, key) => worker.fetch(new Request("https://w" + path + (path.includes("?") ? "&" : "?") + "key=" + encodeURIComponent(key)), env, ctx);

store.set("work_naj_2026-10-25_abc123", JSON.stringify({ id: "abc123", date: "2026-10-25", created: "2026-10-25T08:00:00Z", title: "Example campaign kickoff", type: "Meeting",
  summary: "Agreed the example campaign plan.", people: ["Example Person"], kpis: [2], scope: ["m2"], works: ["Example Campaign"], effort: "1-2 hours", text: "Notes." }));

const pages = { entry: "/momo/work/item/entry?id=2026-10-25_abc123", report: "/momo/work/report?days=2026-10-25", week: "/momo/work/plan/week?from=2026-10-19", month: "/momo/work/plan/month?month=2026-10" };
for (const [name, path] of Object.entries(pages)) {
  const r = await get(path, NAJ), h = await r.text();
  ok(r.status === 200, name + ": her key opens it", r.status);
  ok(h.includes('id=pt_ed') && h.includes('id=pt_sh') && /Share PDF/.test(h) && /print\(\)/.test(h) && /Save as PDF/.test(h), name + ": Edit, Share PDF and Save as PDF buttons");
  ok(h.includes('<script src="' + HTML2PDF_SRC + '"></script>') && /html2pdf\.js\/0\.10\.1\//.test(h), name + ": pinned html2pdf script");
  ok(!/Share \/ Save as PDF/.test(h), name + ": old single button gone");
  ok(/clause 12\.2/.test(h) || name !== "entry", name + ": clause 12.2 footer kept");
  const m = h.match(/<script>(var __name=function\(f\)\{return f\};[\s\S]*?)<\/script>/);
  ok(!!m, name + ": tools script starts with the __name shim");
  let parsed = false; try { new Function(m ? m[1] : "x("); parsed = true; } catch (e) { console.log(e.message); }
  ok(parsed, name + ": tools script parses");
  ok(m && /navigator\.share/.test(m[1]) && /canShare/.test(m[1]) && /contentEditable/.test(m[1]) && /"FN_"/.test(m[1]), name + ": share, fallback, edit and file name code present");
  const o = await get(path, OWNER), w = await get(path, "nope");
  const ot = o.status === 200 ? await o.text() : "";   // v662 - the owner's key opens HIS OWN Work pages, never hers
  ok(w.status === 404 && (o.status === 404 || !/Najjuko|FN Realty/.test(ot)), name + ": other keys get 404; the owner gets only his own page", [o.status, w.status]);
}
console.log(`v653 pdf tools: ${pass} passed, ${fail} failed`); if (fail) process.exit(1);
