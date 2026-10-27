// v657 - building briefing cards: Najjuko's key only, sections render safely, PDF served, notes saved, front-door card. FAKE data only.
const worker = (await import("../src/index.js")).default;
const { DOSSIER_JS, mdToHtml, cleanDossier, slugOk } = await import("../src/work_dossier.js");
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };
const store = new Map();
const KV = { get: async (k) => (store.has(k) ? store.get(k) : null), put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); }, list: async () => ({ keys: [], list_complete: true }) };
const K = "ins_najjuko_TESTKEY0123456789abcd", N = "ins_kendall_TESTKEY0123456789abcd";
const env = { MEETINGS: KV, INSIDER_KEY: [K, N].join(",") }, ctx = { waitUntil() {}, passThroughOnException() {} };
const get = (p, k) => worker.fetch(new Request("https://w" + p + (k == null ? "" : (p.includes("?") ? "&" : "?") + "key=" + encodeURIComponent(k))), env, ctx);
const post = (b, k, slug) => worker.fetch(new Request("https://w/momo/work/brief/api?b=" + (slug || "faketower") + (k == null ? "" : "&key=" + encodeURIComponent(k)), { method: "POST", body: JSON.stringify(b), headers: { "content-type": "application/json" } }), env, ctx);

ok(!(() => { try { new Function(DOSSIER_JS); } catch (e) { return true; } })(), "page script parses");
ok(DOSSIER_JS.startsWith("var __name=function(f){return f};"), "page script carries the __name shim");
ok(slugOk("faketower") === "faketower" && slugOk("../x") === "" && slugOk("") === "", "slug guard");
const h0 = mdToHtml('## x\n**Bold** <script>alert(1)</script> [ok](https://a.example/b) [bad](javascript:alert(1))\n\n| A | B |\n|---|---|\n| 1 | <img src=x> |\n\n1. One\n   - sub\n2. Two');
ok(!/<script|<img/i.test(h0) && h0.includes("&lt;script&gt;") && h0.includes("<b>Bold</b>"), "markdown is escaped first", h0);
ok(h0.includes('href="https://a.example/b"') && !h0.includes("href=\"javascript"), "only https links become links");
ok(h0.includes("<table>") && h0.includes("<ol>") && h0.includes("<ul>"), "tables and nested lists render");
ok(cleanDossier({ sections: [{ icon: "nope" }] }).sections[0].icon === "doc", "unknown icon falls back");

// nothing loaded: no card, routes are not found
let r = await get("/momo/work/brief?b=faketower", K); ok(r.status === 404, "no record = not found", r.status);
let fd = await (await get("/momo", K)).text(); ok(!fd.includes("/momo/work/brief"), "no front-door card without a record");

// load fake record, list and PDF (what the loader does)
store.set("dossier_list_najjuko", JSON.stringify([{ slug: "faketower", title: "Fake Tower" }]));
store.set("dossier_rec_najjuko_faketower", JSON.stringify({ title: "Fake Tower", subtitle: "Test briefing", updatedAt: "2026-10-27", usps: "1. Near the metro\n2. Small units",
  sections: [{ id: "pitch", title: "The pitch", icon: "pitch", md: "Short **pitch**." }, { id: "compete", title: "Competitors", icon: "compete", md: "| Tower | AED |\n|---|---|\n| Fake A | 100 |" }] }));
store.set("dossier_pdf_najjuko_faketower", btoa("%PDF-1.4 fake"));

r = await get("/momo/work/brief?b=faketower", K); const page = await r.text();
ok(r.status === 200 && page.includes("Fake Tower") && page.includes("<b>pitch</b>") && page.includes("<table>"), "her key opens the card", r.status);
ok(page.includes("Open PDF") && page.includes("Share PDF") && page.includes("Copy USPs") && page.includes("My notes"), "the four buttons are there");
ok(page.includes("Near the metro"), "USPs ride in the page for copying");
r = await get("/momo/work/brief?b=faketower", N); ok(r.status === 404, "Kendall's key gets not found", r.status);
r = await get("/momo/work/brief?b=faketower", null); ok(r.status === 401 || r.status === 404 || r.status === 302, "no key is refused", r.status);
r = await get("/momo/work/brief?b=other", K); ok(r.status === 404, "unknown building = not found");

r = await get("/momo/work/brief/pdf?b=faketower", K);
ok(r.status === 200 && r.headers.get("content-type") === "application/pdf" && (await r.text()).startsWith("%PDF"), "PDF served to her");
r = await get("/momo/work/brief/pdf?b=faketower", N); ok(r.status === 404, "PDF refused to Kendall");

r = await post({ action: "note", text: "Call the sales team about the escrow bank", section: "Competitors" }, K);
let j = await r.json(); ok(r.status === 200 && j.ok && j.notes.length === 1 && j.notes[0].section === "Competitors" && j.notes[0].at, "note saved with time and section", j);
r = await post({ action: "note", text: "   " }, K); ok(r.status === 400, "empty note refused");
r = await post({ action: "note", text: "x" }, N); ok(r.status === 404, "Kendall cannot write notes", r.status);
r = await post({ action: "note", text: "x" }, null); ok(r.status !== 200, "no key cannot write notes", r.status);
j = await (await get("/momo/work/brief/rec?b=faketower", K)).json(); ok(j.notes.length === 1 && j.rec.title === "Fake Tower", "rec returns record and notes");

fd = await (await get("/momo", K)).text(); ok(fd.includes("/momo/work/brief?key=") && fd.includes("&b=faketower") && fd.includes("<b>Fake Tower</b>"), "front-door card for her");
fd = await (await get("/momo", N)).text(); ok(!fd.includes("/momo/work/brief"), "no card on Kendall's front door");

console.log(`v657 dossier: ${pass} passed, ${fail} failed`); if (fail) process.exit(1);
