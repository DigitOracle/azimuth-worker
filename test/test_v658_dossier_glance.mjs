// v658 - briefing cards at a glance: KPI tiles and SVG charts drawn from the record, sections open as the record says, nothing injectable. FAKE data only.
const worker = (await import("../src/index.js")).default;
const { cleanGlance, chartSvg, glanceHtml } = await import("../src/work_dossier_charts.js");
const { cleanDossier, dossierPage } = await import("../src/work_dossier.js");
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };
const store = new Map();
const KV = { get: async (k) => (store.has(k) ? store.get(k) : null), put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); }, list: async () => ({ keys: [], list_complete: true }) };
const K = "ins_najjuko_TESTKEY0123456789abcd", N = "ins_kendall_TESTKEY0123456789abcd";
const env = { MEETINGS: KV, INSIDER_KEY: [K, N].join(",") }, ctx = { waitUntil() {}, passThroughOnException() {} };
const get = (p, k) => worker.fetch(new Request("https://w" + p + (k == null ? "" : (p.includes("?") ? "&" : "?") + "key=" + encodeURIComponent(k))), env, ctx);

// cleaning: bad types, bad numbers and bad labels never reach the page
const g = cleanGlance({
  kpis: [{ label: "Price", value: "AED 1", sub: "x" }, { label: "", value: "dropped" }, { label: "<script>", value: "<b>" }],
  charts: [
    { type: "bar", title: "Fake bars", items: [{ label: "A", value: 10 }, { label: "B", value: "NaN" }, { label: "C", value: -4 }, { label: "D", value: 6, ghost: 9, highlight: true }], ref: { value: 8, label: "ref" } },
    { type: "pie", title: "unknown type", items: [{ label: "x", value: 1 }] },
    { type: "range", title: "Fake range", items: [{ label: "R", low: 10, base: 15, high: 20, value: 12 }, { label: "bad", low: 30, high: 20 }] },
    { type: "line", title: "Fake line", series: [{ name: "S", points: [[2020, 5], [2022, 7], ["x", 1], [2021, 6]] }] },
    { type: "distance", title: "Fake distance", unit: "min", items: [{ label: "Here", value: 4 }] },
    { type: "bar", title: "empty", items: [] }
  ]
});
ok(g.kpis.length === 2, "KPI tiles need a label and a value", g.kpis);
ok(g.charts.map((c) => c.type).join() === "bar,range,line,distance", "unknown types and empty charts dropped", g.charts.map((c) => c.type));
ok(g.charts[0].items.map((t) => t.label).join() === "A,D", "non-numbers and negatives dropped from bars", g.charts[0].items);
ok(g.charts[1].items.length === 1, "a range with high below low is dropped");
ok(JSON.stringify(g.charts[2].series[0].points) === "[[2020,5],[2021,6],[2022,7]]", "line points cleaned and sorted", g.charts[2].series[0].points);
const svgs = g.charts.map(chartSvg);
ok(svgs.every((s) => s.startsWith("<svg") && s.endsWith("</svg>") && !/NaN|undefined|Infinity/.test(s)), "every chart is a clean SVG", svgs.map((s) => s.slice(0, 60)));
ok(svgs[0].includes('stroke-dasharray="3 2"') && svgs[0].includes(">9<"), "ghost bar drawn with its value");
ok(svgs[0].includes("ref"), "reference line labelled");
ok(svgs[2].includes("stroke-dasharray") === false, "consecutive years draw solid lines");
const gl = glanceHtml(g);
ok(!gl.includes("<script>") && gl.includes("&lt;script&gt;") && !gl.includes("<b><") , "labels escaped in tiles", gl.slice(0, 200));
ok(chartSvg(cleanGlance({ charts: [{ type: "line", title: "gap", series: [{ name: "s", points: [[2010, 1], [2015, 2]] }] }] }).charts[0]).includes("stroke-dasharray"), "missing years drawn dashed");

// sections: the record decides which open; older records keep the first one open
const rec = cleanDossier({ title: "Fake", sections: [{ id: "a", title: "A", md: "- one" }, { id: "b", title: "B", md: "- two", open: true }, { id: "c", title: "C", md: "- three", open: true }],
  kpis: [{ label: "L", value: "V" }], charts: [{ type: "bar", title: "T", items: [{ label: "x", value: 1 }] }] });
let pg = dossierPage(rec);
ok(!/id="s-a"[^>]*open|<details class=ds open id="s-a"/.test(pg) && pg.includes('<details class=ds open id="s-b"') && pg.includes('<details class=ds open id="s-c"'), "sections open as the record says");
ok(pg.indexOf("class=kg") < pg.indexOf('id="s-a"') && pg.includes("At a glance") && pg.includes("The detail"), "tiles and charts come before the detail");
pg = dossierPage(cleanDossier({ title: "Old", sections: [{ id: "a", title: "A", md: "x" }, { id: "b", title: "B", md: "y" }] }));
ok(pg.includes('<details class=ds open id="s-a"') && !pg.includes('<details class=ds open id="s-b"') && !pg.includes("class=kg") && !pg.includes("At a glance"), "old records: first open, no empty glance block");

// end to end: her key sees tiles and charts; the record route carries them; Kendall still gets not found
store.set("dossier_list_najjuko", JSON.stringify([{ slug: "faketower", title: "Fake Tower" }]));
store.set("dossier_rec_najjuko_faketower", JSON.stringify({ title: "Fake Tower", usps: "- one", kpis: [{ label: "Fake KPI", value: "123" }],
  charts: [{ id: "p", type: "bar", title: "Fake price chart", items: [{ label: "Fake A", value: 100 }, { label: "Fake B", value: 80, highlight: true }] }], sections: [{ id: "s", title: "S", md: "- a bullet", open: true }] }));
let r = await get("/momo/work/brief?b=faketower", K), page = await r.text();
ok(r.status === 200 && page.includes("Fake KPI") && page.includes("Fake price chart") && page.includes("<svg viewBox") && page.includes("#C9A97A"), "her card shows tiles and charts", r.status);
ok(page.includes("var __name=function(f){return f};"), "page script keeps the __name shim");
const j = await (await get("/momo/work/brief/rec?b=faketower", K)).json(); ok(j.rec.kpis.length === 1 && j.rec.charts.length === 1, "rec route carries tiles and charts");
r = await get("/momo/work/brief?b=faketower", N); ok(r.status === 404, "Kendall's key still gets not found", r.status);

console.log(`v658 dossier glance: ${pass} passed, ${fail} failed`); if (fail) process.exit(1);
