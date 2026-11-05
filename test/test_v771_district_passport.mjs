// v771: district passport from stored data. Fixtures are the REAL stored KV values pulled 5 Nov 2026 (camp_brief_*, camp_facts_pja) when present
// in DP_FIX (a folder), else small stand-ins; checks the rules: no file names, no "to confirm", one soft line, Talk to Najjuko, thank-you, cream.
import fs from "fs";
import { dpRoute, srcLabel, DP_SETS, THANKS } from "../src/district_passport.js";
import { followTask, nodePayload } from "../src/campaigns.js";
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } else console.log("ok", m); };
const DIR = process.env.DP_FIX || "";
const rd = (k) => { try { return fs.readFileSync(DIR + "/" + k + ".json", "utf8"); } catch (e) { return null; } };
const store = {};
const env = { MEETINGS: { get: async (k, t) => { if (k in store) return store[k]; if (t === "arrayBuffer") return null; return DIR ? rd(k) : null; }, put: async (k, v) => { store[k] = v; }, delete: async () => {}, list: async () => ({ keys: [], list_complete: true }) } };
if (!DIR) {
  store.camp_brief_palm_springs = null;
  store["camp_brief_palm-springs"] = JSON.stringify({ developer: { value: "Nakheel", source: "developer one-pager 179_Palm_Springs.pdf", as_of: "2026-11-03" }, price: { value: "AED 3.8M – AED 9M (indicative pre-launch pricing)", source: "developer one-pager 179_Palm_Springs.pdf", as_of: "2026-11-03" }, payment_plan: { value: "to confirm", source: "x.pdf" }, handover: { value: "to confirm", source: "x.pdf" }, unit_types: { value: "3 & 4-Bedroom Townhouses", source: "developer one-pager a.pdf", as_of: "2026-11-03" } });
  store.camp_facts_pja = JSON.stringify({ pja_home_sales: { value: "328 home sales registered on Palm Jebel Ali from 2026-01-01 to 2026-11-02 (328 off-plan, 0 ready)", source: "DLD gateway extract (local naj.duckdb)", as_of: "2026-11-02" }, pja_median_psf: { value: "AED 3,512 per sq ft (median, home sales)", source: "DLD gateway", as_of: "2026-11-02" }, pja_psf_by_month: { value: [{ month: "2026-01", sales: 82, median_psf: 3471 }, { month: "2026-03", sales: 3, median_psf: 3499 }], source: "DLD gateway", as_of: "2026-11-02" }, pja_rents: { value: "No Ejari rent contracts on Palm Jebel Ali yet (0)", source: "DLD Ejari", as_of: "2026-11-03" }, nakheel_track_record: { value: "to confirm", source: "x" } });
}
const get = async (path) => { const u = new URL("https://x" + path); const r = await dpRoute(new Request(u), env, u); return [r.status, await r.text()]; };
const [s1, one] = await get("/dp/palm-springs?r=investor&ty=1");
const [s2, full] = await get("/dp/palm-jebel-ali?r=investor&v=full");
ok(s1 === 200 && s2 === 200, "both pages open");
for (const [nm, h] of [["one-pager", one], ["full", full]]) {
  ok(!/\.pdf\b/i.test(h) && !/\d{10,}_/.test(h), nm + ": no file names");
  ok(!/to confirm/i.test(h), nm + ": never 'to confirm'");
  ok(/--cream:#F7F3EA/.test(h) && !/background:#0C1413/.test(h), nm + ": cream theme");
  ok(/Talk to Najjuko/.test(h), nm + ": Talk to Najjuko close");
}
ok((one.match(/class=soft/g) || []).length === 1 && /Najjuko will confirm the payment plan and handover date/.test(one), "one soft line for the missing deciding facts");
ok(one.includes("I appreciate you taking the time") && one.includes("<i>Najjuko</i>") && !/Black Coffee/.test(one), "thank-you at the top, signed Najjuko");
ok((full.match(/ \/ 4<\/span>/g) || []).length === 4, "4 pages numbered");
ok(srcLabel("developer one-pager 1793722042639_Palm_Springs_Jebel_Ali_One_Pager.pdf", "2026-11-03") === "Nakheel one-pager · 3 Nov 2026", "source label clean");
ok(!/Months with under 5/.test(full) || !full.includes(">Mar · 3<"), "months under 5 sales left out");
const [s3] = await get("/dp/nope"); ok(s3 === 404, "unknown district 404");
// the flow: a brief node with an image becomes an image message with the link in the caption
const pl = nodePayload("pja-test", "c1", { type: "brief", brief: "palm-springs", text: "Thank you very much, I appreciate you taking the time. Here is the one-pager:" }, { e164: "+971553001159", name: "Test" }, "https://x/c/ABC", {});
ok(pl && pl.text.body.includes("https://x/c/ABC"), "brief node carries the tracked link");
// follow-up task: one per campaign + contact, updated not duplicated
const c = { id: "pja-test", name: "PJA test" }, f = { nodes: { s1: { type: "template", buttons: [{ id: "selling", title: "Open to selling", next: "b1" }] } } };
store["camp_state_pja-test_971553001159"] = JSON.stringify({ path: ["s1.selling"] });
const k = { e164: "+971553001159", name: "Test" };
const t1 = await followTask(env, c, f, k, {}, Date.parse("2026-11-05T06:00:00Z"));
const t2 = await followTask(env, c, f, k, { opened: "Palm Jebel Ali", reader: "seller" }, Date.parse("2026-11-05T06:05:00Z"));
ok(t1.key === t2.key, "same task key on a second tap");
const e = JSON.parse(store[t1.key]); ok(e.works[0] === "Call Test (+971 ••• 1159), PJA test" && /Open to selling/.test(e.text) && /Opened: Palm Jebel Ali/.test(e.text), "task names the person, answer and version");
const hi = JSON.parse(store.camp_handover_index); ok(hi.length === 1 && hi[0].kind === "follow_up" && hi[0].answers[0] === "Open to selling", "one handover entry, updated");
ok(THANKS.endsWith("Najjuko"), "thank-you text signed Najjuko");
if (DIR) { fs.writeFileSync(DIR + "/out_onepager.html", one); fs.writeFileSync(DIR + "/out_full.html", full); }
console.log("test_v771_district_passport:", fail ? fail + " failed" : "all passed"); process.exit(fail ? 1 : 0);
