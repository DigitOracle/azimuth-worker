// v748 - Building Passport prints EXACTLY 3 A4 pages + page 1 dashboard (Kendall, 4 Nov 2026, Luma Park Views 681-7149: "it is cut off";
// the live PDF printed 5 pages, pages 3 and 5 only a footer). Fixtures: v745_luma_681-7149.json and v740_hado_1011305.json (stored rows).
// The real-Chrome before/after render of the three stored passports is in the v748 report (5 -> 3 for Luma, 3 -> 3 for the other two).
import fs from "fs";
const B = await import("../src/building_passports.js");
const D = await import("../src/passport_dashboard.js");
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 600)); } };
const TODAY = "2026-11-04";
const pdfOf = (n) => new TextEncoder().encode("%PDF-1.7\n1 0 obj<</Type /Pages /Count " + n + ">>\n" + Array.from({ length: n }, (_, i) => (i + 2) + " 0 obj<</Type /Page>>").join("\n"));

// 1. page count from the PDF bytes: /Type /Page, never /Pages
ok(B.pdfPages(pdfOf(3)) === 3 && B.pdfPages(pdfOf(5)) === 5, "physical pages counted from the PDF");
ok(B.fitsThree(3, [{ over_mm: 0 }]) && !B.fitsThree(5, []) && !B.fitsThree(3, [{ over_mm: 4 }]), "3 pages and no overflow = fits; >3 pages or overflow = not");

// 2. the worker owns the page box: fixed A4, border-box, overflow hidden, a break after every page, cards never split; print media only
const H = '<!doctype html><html><head><style>.page{min-height:297mm}</style></head><body><section class="page p1">a</section><section class="page">b</section><div class="page-header">x</div><section class="page">c</section></body></html>';
const W = B.withFit(H);
ok(/@media print\{@page\{size:A4;margin:0\}/.test(W) && /height:297mm!important/.test(W) && /box-sizing:border-box!important/.test(W) && /overflow:hidden!important/.test(W), "fit css fixes the page box");
ok(/page-break-after:always!important/.test(W) && /break-inside:avoid/.test(W) && /\.page:last-of-type\{break-after:auto/.test(W), "a break after each page, none after the last, cards not split");
ok(W.indexOf("bpp-fit") < W.indexOf("</head>") && W.indexOf(".page{min-height:297mm}") < W.indexOf('id="bpp-fit"'), "fit css comes after the writer's css");
ok((W.match(/data-bpp-p="\d"/g) || []).join() === 'data-bpp-p="1",data-bpp-p="2",data-bpp-p="3"' && !/page-header[^>]*data-bpp-p/.test(W) && !/data-bpp-p[^>]*page-header/.test(W), "the three .page boxes numbered, .page-header untouched");
ok(B.withFit(W) === W, "applying the fit twice changes nothing");

// 3. the deterministic shrink: only the overflowing page, never the footer / snapshot line; the 03A box 74 -> 60 mm on a tight page
const Z = B.withFit(H, [1, 0.88, 1], [2]);
ok(/\.page\[data-bpp-p="2"\]>\*:not\(footer\):not\(\.footer\):not\(\[class\*=foot\]\):not\(\.bpp-snap\)\{zoom:0\.88\}/.test(Z) && !/data-bpp-p="1"\]>/.test(Z), "zoom only page 2, footer and band excluded");
ok(/\.page\[data-bpp-p="2"\] \.bpp-story\{height:60mm!important\}/.test(Z), "story box may drop to 60 mm");
ok(B.fitZoomCss([1, 1, 1], []) === "" && B.ZOOM_STEPS[0] < 1 && B.ZOOM_STEPS[B.ZOOM_STEPS.length - 1] >= 0.75, "no zoom when it fits; steps stop at 0.76");

// 4. the re-ask names the page, the sections and the millimetres, and asks to cut text, never data rows
const brief = B.fitBrief(5, [{ page: 1, over_mm: 0, wide: 0, sections: [], cut: [] }, { page: 2, over_mm: 38.5, wide: 0, sections: ["05 RENTALS", "06 OCCUPANCY", "07 INVESTMENT"], cut: ["Bayut 12 adverts"] }]);
ok(/came out as 5 physical pages \(it must be exactly 3\)/.test(brief) && /page 2 runs 38\.5 mm past the footer line \(sections 05 RENTALS, 06 OCCUPANCY, 07 INVESTMENT\)/.test(brief) && !/page 1 runs/.test(brief), "brief: pages, sections, mm", brief);
ok(/NEVER drop a data row/.test(brief) && /cutting and condensing TEXT/.test(brief), "brief: cut text, never data rows");
ok(/fixed 210mm x 297mm pages/.test(B.FIT_JS) === false && /over_mm/.test(B.FIT_JS) && /closest\("\.bpp-snap"\)/.test(B.FIT_JS), "the in-page measure reports mm and ignores the band");
let bad = null; try { new Function("return " + B.FIT_JS); } catch (e) { bad = e.message; } ok(!bad, "FIT_JS parses", bad);

// 5. the tick: a 5-page first print goes back to the writer with the brief; a second 5-page print fails, never delivered; 3 pages delivered
const src = fs.readFileSync(new URL("../src/building_passports.js", import.meta.url), "utf8");
ok(/fitBrief\(rp\.pages, rp\.fit\)/.test(src) && /renderPdf\(env, printHtml, \{ fit: true \}\)/.test(src) && /emulateMediaType\("print"\)/.test(src), "tick: re-ask with the brief, shrink as last resort, print media");
ok(/if \(!fitsThree\(n, rp\.fit\)\) \{\s*r\.status = "failed"/.test(src), "tick: not 3 pages after the fit = failed, not delivered");
{
  const kv = new Map(), env = { OPENAI_API_KEY: "k", MEETINGS: { get: async (k, t) => { const v = kv.get(k); return v == null ? null : t === "json" ? JSON.parse(v) : v; }, put: async (k, v) => { kv.set(k, typeof v === "string" ? v : v); }, delete: async (k) => kv.delete(k), list: async () => ({ keys: [...kv.keys()].map((name) => ({ name })), list_complete: true }) } };
  let pages = 5, fits = [{ page: 1, over_mm: 0, wide: 0, sections: [], cut: [] }, { page: 2, over_mm: 38, wide: 0, sections: ["05 RENTALS"], cut: ["x"] }, { page: 3, over_mm: 0, wide: 0, sections: [], cut: [] }];
  B.__setLauncher(async () => ({ newPage: async () => ({ setViewport: async () => {}, emulateMediaType: async () => {}, setContent: async () => {}, evaluate: async (x) => (typeof x === "string" && x.indexOf("over_mm") > 0 ? fits : typeof x === "string" && x.indexOf("cut off") < 0 && x.indexOf("const out") > 0 ? [] : true), pdf: async () => pdfOf(pages) }), close: async () => {} }));
  const sent = []; const realFetch = globalThis.fetch;
  globalThis.fetch = async (u, o) => { if (o && o.method === "POST") { sent.push(JSON.parse(o.body).input); return { ok: true, json: async () => ({ id: "resp" + sent.length }) }; }
    return { ok: true, json: async () => ({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "<!doctype html><html><head></head><body><section class=\"page\">1</section><section class=\"page\">2</section><section class=\"page\">3</section></body></html>" }] }] }) }; };
  const job = { id: "j748aaa", status: "writing", resp: "r0", started: new Date().toISOString(), slug: "luma-park-views-6817149", plot_id: "naj:plot:681-7149", tries: 0 };
  kv.set("bpp_req_" + job.id, JSON.stringify(job)); kv.set("bpp_requests", JSON.stringify([job.id]));
  try {
    const r1 = await B.bppTick(env, Date.now());
    if (r1 && r1.reask) {
      ok(/runs 38 mm past the footer line \(sections 05 RENTALS\)/.test(sent[0] || "") && /bpp-dash/.test(sent[0] || ""), "tick: the re-ask carries the brief and keeps the dashboard box", (sent[0] || "").slice(0, 300));
      const r2 = await B.bppTick(env, Date.now());
      const j2 = JSON.parse(kv.get("bpp_req_" + job.id));
      ok(j2.status === "failed" && /5 pages, not 3/.test(j2.msg) && !kv.has("bpp_file_luma-park-views-6817149_pdf"), "tick: still 5 pages after the fit = failed, no PDF stored", j2);
      pages = 3; fits = fits.map((p) => ({ ...p, over_mm: 0 }));
      kv.set("bpp_req_" + job.id, JSON.stringify({ ...job, tries: 1, status: "fixing" }));
      await B.bppTick(env, Date.now());
      const j3 = JSON.parse(kv.get("bpp_req_" + job.id));
      ok(j3.status === "done" && j3.pages === 3 && kv.has("bpp_file_luma-park-views-6817149_pdf") && /id="bpp-fit"/.test(kv.get("bpp_file_luma-park-views-6817149_html")), "tick: 3 pages delivered, stored HTML carries the same print fit", j3);
    } else ok(false, "tick: a 5-page first print is re-asked", r1);
  } finally { globalThis.fetch = realFetch; B.__setLauncher(null); }
}

// 6. page 1 dashboard: figures from the stored rows (Luma live pack has kind "Apartment building" after v747)
const luma = JSON.parse(fs.readFileSync(new URL("./fixtures/v745_luma_681-7149.json", import.meta.url), "utf8"));
const pack = { ...luma.pack, kind: "Apartment building" };
const f = B.bppFacts(luma.pp, pack, TODAY), d = D.dashFigures(luma.pp, pack, TODAY, f);
ok(d.status === "Ready" && d.type === "Apartment building" && d.community === "Jumeirah Village Circle", "Luma: Ready apartment building in JVC", d);
ok(d.homes === 600 && d.floors === 25, "Luma: 600 homes (shops excluded), 25 floors", [d.homes, d.floors]);
const mk = pack.market.kinds.ready;
ok(Math.round(d.price.now) === Math.round(mk.aed_m2_12m / 10.7639104) && d.price.deals12 === mk.deals_12m && d.pace.perMonth === mk.pace["12m"], "Luma: price per sq ft and pace are the pack's ready figures", d.price);
ok(d.beds.map((b) => b.b + ":" + b.rent).join() === Object.keys(pack.tenancies.beds).sort().map((b) => b + ":" + pack.tenancies.beds[b][0]).join(), "Luma: rent bars are the tenancy register medians");
ok(d.yieldR && d.yieldR.low > 0.03 && d.yieldR.high < 0.12, "Luma: gross yield from the finance engine", d.yieldR);
ok(d.places[0].icon === "metro" && /16 min drive/.test(d.places[0].d) && d.places.length === 3, "Luma: metro + 2 places with drive times", d.places);
const blk = D.dashBlock(luma.pp, pack, TODAY, f);
ok(/What the evidence supports/.test(blk) && /What could affect the decision/.test(blk) && /What to verify next/.test(blk), "verdict block has the 3 lines");
ok(/font:600 20pt Fraunces/.test(blk) && /<svg/.test(blk) && !/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(blk.replace(/&#96\d\d;/g, "")), "big numbers, icons are svg, no emoji");
ok(D.placeDash('<div class="page"><div class="bpp-dash" style="width:100%;height:' + D.DASH_H_MM + 'mm;overflow:hidden"></div></div>', blk).indexOf("bpp-dash-in") > 0 && D.placeDash("<div class=page></div>", blk) === "<div class=page></div>", "placeholder filled; none = nothing injected");
const pr = B.bppPrompt(f, "4 Nov 2026");
ok(pr.indexOf('<div class="bpp-dash" style="width:100%;height:' + D.DASH_H_MM + 'mm;overflow:hidden"></div>') > 0 && /page 1 = the whole answer at a glance, a DASHBOARD/.test(pr) && /page 2 = what the building is/.test(pr), "prompt: page 1 dashboard box, detail on pages 2-3");
// a building with no evidence: every tile says Not available yet, nothing invented
const e = D.dashBlock({ parcel: "1" }, {}, TODAY, { risks: [], opps: [], missing: [] });
ok((e.match(/Not available yet/g) || []).length >= 6, "empty pack: tiles say Not available yet");
// off-plan (Hado 1011305): the off-plan figures speak, with its progress
const hado = JSON.parse(fs.readFileSync(new URL("./fixtures/v740_hado_1011305.json", import.meta.url), "utf8"));
const dh = D.dashFigures(hado.pp, hado.pack, TODAY, B.bppFacts(hado.pp, hado.pack, TODAY));
ok(/^Off-plan/.test(dh.status) && dh.price && dh.price.kind === "off-plan", "Hado: off-plan status and off-plan prices", [dh.status, dh.price]);

console.log("v748 page fit: " + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
