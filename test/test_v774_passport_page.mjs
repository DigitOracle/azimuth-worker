// v774: the personal passport page /p/<code>: personalised, light only, no "to confirm", opens counted and passed on; codes reused per person.
import { docCreate, docRoute, docHtml, docCaption } from "../src/district_doc.js";
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } else console.log("ok", m); };
const store = {
  "camp_brief_palm-springs": JSON.stringify({ developer: { value: "Nakheel", source: "developer one-pager 17937_x.pdf", as_of: "2026-11-03" }, price: { value: "AED 3.8M – AED 9M (indicative pre-launch pricing)", source: "developer one-pager a.pdf", as_of: "2026-11-03" }, payment_plan: { value: "to confirm" } }),
  camp_facts_pja: JSON.stringify({ pja_home_sales: { value: "328 home sales registered", source: "DLD gateway", as_of: "2026-11-02" }, pja_median_psf: { value: "AED 3,512 per sq ft (median, home sales)", source: "DLD gateway", as_of: "2026-11-02" },
    pja_supply_pipeline: { value: [{ project: "Palm Central Private Residences - Frond M", units: "212", planned_end: "2029-07-31" }], source: "DLD project register", as_of: "2026-11-02" } }),
};
const env = { MEETINGS: { get: async (k) => store[k] ?? null, put: async (k, v) => { store[k] = v; } } };
const c1 = await docCreate(env, { cid: "pja-test", d: "971553001159", slug: "palm-jebel-ali", reader: "keeper", name: "Test", answer: "Keeping it until handover" });
const c2 = await docCreate(env, { cid: "pja-test", d: "971553001159", slug: "palm-jebel-ali", reader: "keeper", name: "Test" });
ok(/^[a-z2-9]{8}$/.test(c1) && c1 === c2, "one 8-character code per person + version, reused");
let opened = null;
const u = new URL("https://x/p/" + c1); const r = await docRoute(new Request(u), env, u, { onOpen: (rec) => { opened = rec; } }); const h = await r.text();
ok(r.status === 200 && h.includes("Prepared for <b>Test</b>") && h.includes("You told me you&#39;re keeping") === false && /keeping your home until handover/.test(h), "personalised: prepared for, their answer reflected");
ok(/color-scheme content="only light"/.test(h) && !/to confirm/i.test(h) && !/\.pdf\b/.test(h), "light only, no 'to confirm', no file names");
ok(/wa\.me\/971565484397\?text=Hi%20Najjuko/.test(h) && /window\.print\(\)/.test(h) && /google\.com\/maps/.test(h) && /<nav class=nav>/.test(h), "WhatsApp pre-filled, Save as PDF, map, section anchors");
ok(opened && opened.opens === 1 && JSON.parse(store["dp_doc_" + c1]).opens === 1, "an open is counted and passed to the follow-up");
const u2 = new URL("https://x/p/zzzzzzzz"); const r2 = await docRoute(new Request(u2), env, u2, {}); ok(r2.status === 404, "unknown code: a kind expiry message");
ok(docCaption("Test", "palm-jebel-ali") === "Thank you, Test. Your Palm Jebel Ali passport is ready:", "caption");
console.log("test_v774_passport_page:", fail ? fail + " failed" : "all passed"); process.exit(fail ? 1 : 0);
