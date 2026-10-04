// v299 (Kendall, 3-4 Oct 2026): the 06:02 card said "45 new leases, down 97%" from 1 Oct, a day that was still filling. The card now steps back
// over a day whose contracts are under half the same-weekday median of the weeks before it.
// NEGATIVE CONTROL: against v297 (no completeness test) the anchor stays on 1 Oct and the first assertion fails.
import { ejariModel } from "../src/feed_ejari.js";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? " :: " + d : "")); } };
const addD = (s, n) => new Date(Date.parse(s + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
const rows = [];
const wk = { 1: 3000, 2: 3100, 3: 2900, 4: 3000, 5: 2500, 6: 1200, 0: 600 };      // Thu 1 Oct 2026 is getUTCDay 4
for (let d = addD("2026-10-01", -40); d <= "2026-09-30"; d = addD(d, 1)) {
  const t = wk[new Date(d + "T00:00:00Z").getUTCDay()];
  rows.push({ date: d, n: Math.round(t * 0.55), reg: "New", area: "Business Bay", district: "businessbay", desk: false });
  rows.push({ date: d, n: Math.round(t * 0.45), reg: "Renew", area: "Business Bay", district: "businessbay", desk: false });
}
rows.push({ date: "2026-10-01", n: 45, reg: "New", area: "Business Bay", district: "businessbay", desk: false });
rows.push({ date: "2026-10-01", n: 51, reg: "Renew", area: "Business Bay", district: "businessbay", desk: false });
const src = { dubai: { rows, asOf: "2026-10-01", last: "2026-10-01", first: rows[0].date, source: "DLD Ejari", caveat: "", basis: "filed" }, districts: new Map(), names: {}, appNames: new Map(), projects: new Map() };
const m = ejariModel(src, "day", "2026-10-03");
ok(m.to === "2026-09-30", "the card is anchored on 30 Sep, the last complete day, not 1 Oct", m.to);
ok(Array.isArray(m.skippedPartial) && m.skippedPartial.includes("2026-10-01"), "the partial day is reported as skipped", JSON.stringify(m.skippedPartial));
ok(m.newLeases.n > 1000, "new leases are a full day's count, not 45", m.newLeases.n);
ok(m.newLeases.pct === null || m.newLeases.pct > -30, "no -97% style change", m.newLeases.pct);
// a complete last day is used as is
const rows2 = rows.filter((r) => !(r.date === "2026-10-01"));
const m2 = ejariModel({ dubai: { rows: rows2, asOf: "2026-09-30", last: "2026-09-30", first: rows2[0].date, source: "DLD Ejari", caveat: "", basis: "filed" }, districts: new Map(), names: {}, appNames: new Map(), projects: new Map() }, "day", "2026-10-03");
ok(m2.to === "2026-09-30" && m2.skippedPartial.length === 0, "a complete last day is kept");
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
