// v302 (Kendall, 4 Oct 2026, live walkthrough): a rental Brief, 3-bed townhouse, budget AED 250K-300K, and the list showed 183K, 190K, 193K, 180K.
// "If the client says 250 I want 250 and MORE. 250 is my starting point." The budget MINIMUM is a hard floor: nothing under it is offered,
// no -10% window. The above-the-top window (+15%, labelled) and the stretch keep their meaning.
// CAUSE reproduced here: (1) with min=250000 the old code listed down to 225000 (BELOW_FLOOR 10%) as "below"; (2) with the figure typed as
// target 250 + stretch 300 and "from" left empty, min=0 so EVERYTHING under 250 was "within". Case (2) is the page's own request shape.
// NEGATIVE CONTROL: run against release-v300 (git stash-free: copy src from that branch) - floor checks A1-A4 fail there.
//   node test/test_v302_budget_floor.mjs
import { briefSearch, verdictOf, __resetKvMemo } from "../src/brief.js";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? " :: " + String(d).slice(0, 400) : "")); } };
const S = (m) => ({ n: 12, nn: 8, nr: 4, m, q1: m - 5000, q3: m + 5000, mn: m, q1n: m - 5000, q3n: m + 5000, s: 180, last: "2026-09-29" });
const mk = (p, n, m) => ({ p, n, area: "Damac Hills 2", d: "damachills", last: "2026-09-29", v: { "3": S(m) } });
const RI = { as_of: "2026-09-30", window: ["2026-08-01", "2026-09-30"], items: [
  mk("a", "Cluster A", 183000), mk("b", "Cluster B", 190000), mk("c", "Cluster C", 193000), mk("d", "Cluster D", 180000), mk("e", "Cluster E", 230000),
  mk("f", "Cluster F", 250000), mk("g", "Cluster G", 275000), mk("h", "Cluster H", 300000), mk("i", "Cluster I", 330000), mk("j", "Cluster J", 400000) ] };
const store = new Map([["img_rent_index", JSON.stringify(RI)]]);
const env = { MEETINGS: { async get(k) { return store.has(k) ? store.get(k) : null; }, async list() { return { keys: [], list_complete: true }; } } };
const run = async (qs, owner) => { __resetKvMemo(); return (await briefSearch(env, new URLSearchParams("mode=rent&beds=3&type=townhouse&areas=damachills&limit=50&" + qs), { owner: !!owner, live: false })).body; };
const names = (j) => j.results.map((r) => r.name + ":" + r.evidence.median).join(", ");

let j = await run("min=250000&max=300000", true);   // v309: the notes are owner only
ok(j.results.every((r) => r.evidence.median >= 250000), "A1 min 250K: nothing under 250K is offered", names(j));
ok(!j.results.some((r) => [180000, 183000, 190000, 193000, 230000].includes(r.evidence.median)), "A2 the 180-193K and 230K options are gone (230K was inside the old -10% window)", names(j));
ok(j.results.length === 4 && j.results[0].verdict === "within", "A3 250K, 275K, 300K within, 330K above (+10%) listed; 400K out", names(j));
ok(!j.results.some((r) => r.verdict === "below") && j.counts.below === 0, "A4 no 'below' verdict exists any more");
ok(j.notes.some((n) => /hard floor/.test(n) && /5 options under the minimum hidden/.test(n)), "A5 the API notes count the hidden-below options (5)", j.notes.filter((n) => /floor/.test(n)).join("|"));
ok(!/Cluster [ABCDE]\b/.test(JSON.stringify(j.results)), "A6 no hidden option leaks into results");
// the +15% window stays, and a stretch keeps its meaning
j = await run("min=250000&max=300000&stretch=330000");
ok(j.results.find((r) => r.evidence.median === 330000).verdict === "stretch" && j.results.every((r) => r.evidence.median >= 250000), "B1 stretch still means above the target up to the stretch; floor still holds", names(j));
ok(verdictOf(249999, 250000, 300000) === null && verdictOf(250000, 250000, 300000) === "within" && verdictOf(300001, 250000, 300000) === "a_little_above" && verdictOf(344999, 250000, 300000) === "above" && verdictOf(345001, 250000, 300000) === null, "B2 edges: 250,000 in, 249,999 out; above-the-top 5% / +15% unchanged");
// no minimum given: nothing is hidden and no floor note
j = await run("max=300000");
ok(j.results.length === 9 && !j.notes.some((n) => /hard floor/.test(n)), "C1 no minimum: no floor", names(j));
// the cause (2): 'from' empty, 250 as the target and 300 as the stretch - the page sends min=0, so the floor cannot act
j = await run("min=0&max=250000&stretch=300000");
ok(j.results.some((r) => r.evidence.median < 250000), "C2 (documents the cause) target 250 + stretch 300 with 'from' empty sends min=0: under-250 homes are in budget", names(j));

// documents: the pick flow in the page script
import fs from "node:fs";
const page = fs.readFileSync(new URL("../src/brief_page.js", import.meta.url), "utf8");
ok(/Showing "\+esc\(fmtAed\(st\.min\)\)\+" and above/.test(page), "D1 the page says 'Showing AED 250K and above' when a minimum is set");
ok(/Compare these "\+n/.test(page) && /Individual PDFs \(/.test(page), "D2 the compare and individual buttons carry the ticked count");
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
