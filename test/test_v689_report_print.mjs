// v689 (Kendall 1 Nov 2026, from the printed October report on his iPhone) - the monthly report prints cleanly on A4: the cover fills page one
// at a fixed A4 height, the donut cards fit (legend values never wrap), IN SHORT and headings never split, and the month reads as one bar per
// week against the 15 h line instead of a daily chart whose labels overlapped. FAKE data only.
const m = await import("../src/work_log.js");
let pass = 0, fail = 0; const ok = (c, msg, extra) => { if (c) pass++; else { fail++; console.log("FAIL", msg, extra === undefined ? "" : JSON.stringify(extra).slice(0, 300)); } };
const base = { type: "Meeting", summary: "", people: ["Ali Al Mansoori"], kpis: [], scope: ["m1"], works: ["Q4 plan"], effort: "1-2 hours", time_of_day: "Morning", in_scope: true, broker: false, broker_tasks: [], start: "09:00", end: "12:00", out_role: "", external: [], progress: [] };
const es = [];
for (let d = 1; d <= 31; d++) { const ds = "2026-10-" + String(d).padStart(2, "0"); const dow = new Date(ds).getUTCDay(); if (dow === 0 || dow === 6) continue;
  es.push(Object.assign({}, base, { date: ds, title: "Plan " + d }));
  if (d % 3 === 0) es.push(Object.assign({}, base, { date: ds, title: "Viewing " + d, broker: true, broker_tasks: ["viewing"], start: "13:00", end: "14:00" })); }
const h = m.reportHtml(es, "2026-10-01", "2026-10-31", null);

// weekly bars
ok(typeof m.weekBars === "function", "weekBars is exported");
ok(h.includes("MONTH AT A GLANCE") && !h.includes('aria-label="Activities per day"'), "the month no longer draws the daily chart");
const rows = (h.match(/<div class=wbr><span class=wl>/g) || []).length, trs = (h.match(/<table class=glance>[\s\S]*?<\/table>/) || [""])[0].split("<tr").length - 2;
ok(rows === 5 && rows === trs, "one bar per week, the same weeks as the table", { rows, trs });
ok((h.match(/part week · \d days/g) || []).length === 2, "1-4 Oct and 26-31 Oct are labelled part weeks");
ok(/class=wm style="left:[\d.]+%"/.test(h) && h.includes("15 h minimum"), "a 15 h marker on every bar and its label");
ok(/<span class=wn>\d+(\.\d)?&nbsp;h<\/span>/.test(h), "hours written at the end of each bar, never wrapping");
ok(h.includes("background:#15948A") && h.includes("background:#D9782E"), "bars split by role colour");
const wb = m.weekBars([{ days: ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"], pic: { total: 30, kinds: [{ name: "Strategic Lead", hours: 20 }, { name: "Broker", hours: 10 }] } }]);
ok(/width:66\.7%;background:#15948A/.test(wb) && /width:33\.3%;background:#D9782E/.test(wb) && !/part week/.test(wb), "segment widths follow hours; a full week has no part label", wb.slice(0, 400));
ok(/\.wl small\{[^}]*font-size:8\.5pt/.test(h) && /\.wn\{[^}]*font-size:11pt/.test(h), "large, legible text (>= 11 px in print)");

// donut cards
ok(!h.includes("grid-template-columns:118px 1fr") && /<svg class=dn viewBox/.test(h) && /\.dn\{[^}]*max-width:96px/.test(h), "the donut is sized to its card, not a fixed 140 px in a 118 px column");
ok(/\.lr b\{white-space:nowrap;text-align:right/.test(h) && /<b>\d+(\.\d)?&nbsp;h<\/b>/.test(h), "legend values never wrap and are right aligned");
ok(/\.lr\{display:grid;grid-template-columns:10px minmax\(0,1fr\) auto/.test(h), "legend is a grid: swatch, label that may wrap, value");

// print rules
ok(/\.keep,\.sum,[^{]*\{break-inside:avoid;page-break-inside:avoid\}/.test(h) && /h2,h3\{break-after:avoid/.test(h), "IN SHORT, cards and sections never split; headings stay with their content");
ok(/<div class=keep><h2>THE TWO ROLES<\/h2>/.test(h) && /<div class=keep><h2>TASKS<\/h2>/.test(h) && h.includes("<div class=dd><h3>"), "two roles, tasks and each day are kept together");
ok((h.match(/@page\{size:A4;/g) || []).length === 1 && !/@page\s*:first/.test(h), "one A4 page size for every page, no first-page variant");
ok(/@media print\{[^]*\.cover\{max-width:none;width:auto;min-height:0;height:262mm;[^}]*overflow:hidden;break-inside:avoid/.test(h) && !/100vh/.test(h), "the cover is one A4 page by fixed height, never a viewport-height guess");
ok(!/zoom:|transform:scale/.test(h), "no zoom or scale anywhere on the page");
ok(/@media \(max-width:600px\)\{body \.pg/.test(h) && /body \.rg tr\{display:grid;grid-template-columns:1fr/.test(h), "phone width: the role grid stacks into one column");
ok(h.includes("clause 12.2"), "clause 12.2 still prints");

// donuts and weekly bars agree (Kendall 1 Nov): same totals, same role split, same colours, clocked entries included (fake Kendall-style week of 5 Oct)
const es2 = es.concat(["05", "06", "07", "08", "09"].flatMap((d) => [Object.assign({}, base, { date: "2026-10-" + d, title: "Strategy block " + d, start: "08:00", end: "12:24" }),
  Object.assign({}, base, { date: "2026-10-" + d, title: "Broker calls " + d, broker: true, broker_tasks: ["call"], start: "15:00", end: "16:24" })]));
const h2 = m.reportHtml(es2, "2026-10-01", "2026-10-31", null);
const hp = m.hoursPicture(es2), seg = {}; let barSum = 0;
for (const x of h2.matchAll(/data-role="([^"]+)" data-h="([\d.]+)" style="width:[\d.]+%;background:(#[0-9A-F]+)"/g)) { seg[x[1]] = (seg[x[1]] || 0) + +x[2]; seg[x[1] + "c"] = x[3]; }
const ends = [...h2.matchAll(/<span class=wn>([\d.]+)&nbsp;h<\/span>/g)].reduce((s, x) => s + +x[1], 0);
const bothH = (h2.match(/<tr class=al>[\s\S]*?<\/tr>/) || [""])[0].split("<td>")[2] || "";
const leg = (n) => +((bothH.match(new RegExp(n + "</span><b>([0-9.]+)&nbsp;h")) || [])[1] || 0);
const r1 = (n) => Math.round(n * 10) / 10;
ok(r1(ends) === hp.total && bothH.includes(">" + hp.total + "</text>"), "donut total = sum of the weekly bars", { ends, total: hp.total });
for (const k of hp.kinds) ok(r1(seg[k.name] || 0) === k.hours && leg(k.name) === k.hours, "role " + k.name + ": donut legend = sum of its weekly segments", { seg: seg[k.name], leg: leg(k.name), want: k.hours });
ok(seg["Strategic Leadc"] === "#15948A" && seg["Brokerc"] === "#D9782E" && bothH.includes('stroke="#15948A"') && bothH.includes('stroke="#D9782E"'), "same colours on both charts");
ok(/5 Oct–11 Oct<\/b>[\s\S]*?<span class=wn>(\d+(\.\d)?)&nbsp;h/.test(h2) && +h2.match(/5 Oct–11 Oct<\/b>[\s\S]*?<span class=wn>([\d.]+)&nbsp;h/)[1] >= 29, "the added clocked week of 5 Oct shows its hours");

// hierarchy (Kendall 1 Nov): Strategic Lead parts (Marketing, PR, Business Development, Unassigned) = Strategic Lead total = KPI tile = weekly SL segments; same for Broker
const es3 = es2.concat([Object.assign({}, base, { date: "2026-10-20", title: "No area", scope: [], kpis: [], start: "10:00", end: "10:07" }), Object.assign({}, base, { date: "2026-10-21", title: "Odd minutes", scope: ["p1"], start: "09:00", end: "09:13" })].concat([1, 2, 3].flatMap((i) => [Object.assign({}, base, { date: "2026-10-22", title: "Short U" + i, scope: [], kpis: [], start: "11:0" + i, end: "11:0" + (i + 7 > 9 ? 9 : i + 7) }), Object.assign({}, base, { date: "2026-10-22", title: "Short P" + i, scope: ["p1"], start: "14:00", end: "14:07" })])));
const h3 = m.reportHtml(es3, "2026-10-01", "2026-10-31", null), hp3 = m.hoursPicture(es3);
const rowsOf = (cls) => ((h3.match(new RegExp("<tr class=" + cls + ">[\\s\\S]*?</tr>")) || [""])[0].split("<td>")[2] || "");
const parts = (cell) => [...cell.matchAll(/<span>([^<]+)<\/span><b>([0-9.]+)&nbsp;h<\/b>/g)].map((x) => [x[1], +x[2]]);
const segs3 = {}; for (const x of h3.matchAll(/data-role="([^"]+)" data-h="([0-9.]+)"/g)) segs3[x[1]] = r1((segs3[x[1]] || 0) + +x[2]);
for (const [cls, name, tileWord] of [["sl", "Strategic Lead", "as Strategic Lead"], ["bk", "Broker", "as a broker"]]) {
  const ps = parts(rowsOf(cls)), sum = r1(ps.reduce((s, p) => s + p[1], 0)), want = hp3.kinds.find((k) => k.name === name).hours;
  const centre = +((rowsOf(cls).match(/font-size="26"[^>]*>([0-9.]+)</) || [])[1]);
  const tile = +((h3.match(new RegExp("([0-9.]+) h " + tileWord)) || [])[1]);
  ok(sum === want && centre === want && tile === want && segs3[name] === want, name + ": parts = role donut = KPI tile = weekly segments", { ps, sum, centre, tile, seg: segs3[name], want });
}
ok(parts(rowsOf("sl")).some((p) => p[0] === "Unassigned"), "Unassigned stays visible in the Strategic Lead donut so the sum reconciles");

console.log(`v689 report print: ${pass} passed, ${fail} failed`); if (fail) process.exit(1);
