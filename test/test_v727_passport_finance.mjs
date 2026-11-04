// v727 - Building Passport x Najma Financial Intelligence Engine (Kendall, 4 Nov 2026).
// Part A: the vendored engine is the engine (byte-identical copy, version, no Excel module in the worker).
// Part B: STORED rows - test/fixtures/v725_stored_packs.json (built by plot_passport_market.packs_for against MotherDuck, read only, 4 Nov 2026):
//         Dubai Wharf Tower 2 (parcel 3265635) and U-Bora Towers (parcel 3466876). Investor and broker views checked against the stored figures.
// Part C: rules - preliminary when a material input is missing (never defaulted), observed vs assumed, labelled IRRs, net yield on total acquisition cost,
//         reader choice and fallbacks, developer view on an empty plot, the CSV schedule, the passport wiring (prompt, slug, card form, public route).
import fs from "node:fs";
const F = await import("../src/passport_finance.js");
const B = await import("../src/building_passports.js");
const E = await import("../src/finance/index.js");
const { ENGINE_SOURCE } = await import("../src/finance/SOURCE.js");
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 600)); } };
const near = (a, b, tol) => a != null && Math.abs(a - b) <= (tol == null ? 1e-9 : tol);
const T = "2026-11-04";

// ---------- A. the vendored engine
{
  ok(E.ENGINE_VERSION.startsWith("NFE-1.0.0"), "engine version NFE-1.0.0", E.ENGINE_VERSION);
  ok(ENGINE_SOURCE.commit === "58542f7" && ENGINE_SOURCE.excluded.includes("excel.js"), "source commit and the Excel module left out");
  ok(!fs.existsSync(new URL("../src/finance/excel.js", import.meta.url)), "no Node-only excel.js in the worker tree");
  const src = "C:/Dev/najma-finance-engine/src/", LF = (s) => s.replace(/\r\n/g, "\n");
  if (fs.existsSync(src)) for (const n of ["provenance", "units", "area", "returns", "costplan", "development", "cashflow", "income", "analysis", "modes", "index"])
    ok(LF(fs.readFileSync(src + n + ".js", "utf8")) === LF(fs.readFileSync(new URL("../src/finance/" + n + ".js", import.meta.url), "utf8")), "vendored " + n + ".js is identical to the engine repo (line endings aside)");
  const pf = fs.readFileSync(new URL("../src/passport_finance.js", import.meta.url), "utf8");
  ok(!/devmap_irr/.test(pf.replace(/^\/\/.*$/gm, "")), "passports do not import the old devmap_irr definitions");
  ok(!/Math\.pow\(1 \+ r/.test(pf) && !/function irr|function npv/.test(pf), "no IRR / NPV re-implemented in the passport layer");
  ok(!/gpt|openai|claude|gemini|FN Realty/i.test(pf), "no model or FN Realty names in the finance layer");
}

// ---------- B. stored rows
const P = JSON.parse(fs.readFileSync(new URL("./fixtures/v725_stored_packs.json", import.meta.url), "utf8"));
const WH = P["naj:plot:326-5635"], UB = P["naj:plot:346-6876"];
const ppOf = (id, pk, name) => ({ id, parcel: pk.parcel, project: name, area_name: "Dubai", buildings: [{ no: "1" }], flats: {} });
{
  // Dubai Wharf Tower 2: DLD project 1869, ready median AED 15,631 per m2 (9 deals 2026); studio rent AED 56,000 (68 lets); Tower 2 studio median 61.8 m2
  const inv = F.bppFinance(ppOf("naj:plot:326-5635", WH, "Dubai Wharf Tower 2"), WH, "investor", T);
  ok(inv.reader === "investor" && inv.kind === "completed", "Wharf: completed building, investor view", [inv.reader, inv.kind]);
  ok(inv.unit && inv.unit.b === "0" && inv.unit.sqm === 61.8 && inv.unit.rent === 56000, "Wharf: typical unit = studio (most lets), Tower 2 size, registered rent", inv.unit);
  ok(/Dubai Wharf - Tower 2/.test(inv.scope) && !/Tower 1/.test(inv.scope), "Wharf: sizes from Tower 2 (DLD project 1869) only, never Tower 1", inv.scope);
  ok(near(F.ASSUME && inv.case.price.value, Math.round(15631 * 61.8)), "Wharf: price = stored AED/m2 x stored size", inv.case.price.value);
  ok(near(inv.gross.value, 56000 / Math.round(15631 * 61.8), 1e-12) && inv.gross.status === "observed-inputs", "Wharf: gross yield from the engine on observed inputs", inv.gross);
  ok(inv.status === "preliminary" && inv.missing.some((m) => /service-charge/.test(m)), "Wharf: preliminary - the service charge is a material input and is missing");
  ok(inv.head.noi.value === null && inv.head.noi.status === "preliminary", "Wharf: NOI withheld, not defaulted", inv.head.noi);
  ok(inv.head.netYield.value === null && inv.head.unleveredIrr.irrAnnual === null && inv.head.leveredIrr.irrAnnual === null, "Wharf: net yield and both IRRs withheld");
  ok(inv.flags.some((x) => /9 ready sales/.test(x)), "Wharf: thin-evidence flag on 9 ready sales");
  const t = inv.lines.join("\n");
  ok(/ILLUSTRATIVE ONLY/.test(t) && /AED 10 per sq ft/.test(t) && /AED 20 per sq ft/.test(t), "Wharf: illustrative service-charge rows clearly labelled");
  ok(/as of 2 Nov 2026/.test(t) && /as of 30 Oct 2026/.test(t), "Wharf: stored as-of dates on price and rent");
  ok(/unlevered project/.test(t) && /levered equity/.test(t), "Wharf: every IRR labelled");
  ok(/Estimate, not a certified valuation\./.test(t), "Wharf: valuation note on the page");
  ok(/Vacancy between tenants 5%/.test(t) && /Market capitalisation rate 5\.5%/.test(t), "Wharf: assumptions printed with values");
  ok(/downside/.test(t) && /base net yield/.test(t) && /upside/.test(t), "Wharf: downside / base / upside");
  ok(inv.csv && /IRR levered equity/.test(inv.csv) && /Observed inputs/.test(inv.csv) && /Najma assumption/.test(inv.csv), "Wharf: CSV schedule has inputs, assumptions and labelled IRRs");
  // the illustrative rows are the ENGINE's completedMode, checked by hand on the AED 15 row
  const i15 = inv.illus.find((i) => i.scAedSqft === 15), rent = 56000, sqft = 61.8 * E.SQM_TO_SQFT;
  const noiHand = rent * (1 - 0.05 - 0.01) - (15 * sqft + rent * 0.05 + rent * 0.02);
  ok(near(i15.noi, noiHand, 1e-6), "Wharf: NOI build-up = rent - vacancy - credit loss - service charge - management - upkeep", [i15.noi, noiHand]);
  const tac = Math.round(15631 * 61.8) + Math.round(Math.round(15631 * 61.8) * 0.06 + 4200);
  ok(near(i15.netYield, noiHand / tac, 1e-6), "Wharf: net yield on TOTAL ACQUISITION COST (not on price)", [i15.netYield, noiHand / tac]);
  ok(i15.netYield < inv.gross.value, "Wharf: net yield below gross yield");

  const bro = F.bppFinance(ppOf("naj:plot:326-5635", WH, "Dubai Wharf Tower 2"), WH, "broker", T);
  ok(bro.reader === "broker" && bro.csv === null, "Wharf broker: no workbook");
  ok(bro.range && near(bro.range.low, 15631 * 61.8, 1e-6) && near(bro.range.high, 15631 * 189.9, 1e-6), "Wharf broker: value range studio to 3 bed from stored figures", bro.range);
  ok(bro.pace && bro.pace.deals === 9 && bro.pace.homes === 254, "Wharf broker: sales pace on 9 ready deals and Tower 2's 254 homes", bro.pace);
  ok(bro.letting && bro.letting.last12 === 148 && bro.letting.renewals === 96, "Wharf broker: letting pace from stored tenancy history");
  const bt = bro.lines.join("\n");
  ok(/AED 1,452 per sq ft/.test(bt) && /Net yield: not quoted/.test(bt), "Wharf broker: per sq ft quoted; net yield not quoted without the service charge");
}
{
  // U-Bora Towers: DLD project 516, ready median AED 12,904 per m2 (13 deals 2026); 1 bed rent AED 88,000 (67 lets), 91.8 m2; flats only in the residential tower
  const inv = F.bppFinance(ppOf("naj:plot:346-6876", UB, "U-Bora Towers"), UB, "investor", T);
  ok(inv.unit && inv.unit.b === "1" && inv.unit.sqm === 91.8 && inv.unit.rent === 88000, "U-Bora: typical unit = 1 bed", inv.unit);
  ok(near(inv.gross.value, 88000 / Math.round(12904 * 91.8), 1e-12), "U-Bora: gross yield on stored figures", inv.gross.value);
  ok(inv.status === "preliminary" && !inv.flags.some((x) => /ready sales/.test(x)), "U-Bora: preliminary (service charge), 13 sales is not thin");
  ok(!/U-BORA TOWERS, U-BORA TOWERS/.test(inv.scope), "U-Bora: building names not repeated", inv.scope);
  const bro = F.bppFinance(ppOf("naj:plot:346-6876", UB, "U-Bora Towers"), UB, "broker", T);
  ok(bro.classes.every((c) => ["1", "2", "3"].includes(c.b)), "U-Bora broker: homes only (offices and shops are not bedroom classes)", bro.classes.map((c) => c.b));
  ok(bro.pace.homes === 225, "U-Bora broker: 225 homes (offices excluded)", bro.pace);
  ok(bro.classes.find((c) => c.b === "3").contracts === 2, "U-Bora broker: 3 bed rent on 2 lets is shown with its count");
}

// ---------- C. rules
{
  // a service charge in the pack (when the index lands) turns the investor view into an estimate with numbers
  const pk = JSON.parse(JSON.stringify(WH)); pk.service_charge = { aed_sqft: 14, source: "RERA service charge index (test)", date: "2026-10-01" };
  const v = F.investorView({}, pk);
  ok(v.status === "estimate" && v.head.noi.value > 0 && v.head.netYield.value > 0, "service charge known: NOI and net yield computed", v.head.noi);
  ok(v.head.unleveredIrr.basis === "unlevered project" && v.head.leveredIrr.basis === "levered equity", "IRR bases from the engine");
  ok(v.illus.length === 1 && v.illus[0].scAedSqft === 14 && !v.scIllustrative, "no illustrative rows once the real rate is known");
  ok(v.head.dscr && v.head.ltv && near(v.head.ltv.value, 0.5, 1e-3), "mortgage figures present (loan to value 50%, assumed)");
  const sc = v.case.ownerOpex.service_charge;
  ok(sc.observed === true && /RERA/.test(sc.source), "observed service charge keeps its source");
  ok(v.case.vacancyRate.observed === false && /Najma assumption/.test(v.case.vacancyRate.source), "vacancy is an assumption, said so");
}
{
  // no sales or no rents: preliminary, nothing filled in
  const pk = JSON.parse(JSON.stringify(UB)); delete pk.sales;
  const v = F.investorView({}, pk);
  ok(v.status === "preliminary" && v.unit === null && v.missing.some((m) => /ready sales/.test(m)), "no sales: investor preliminary with no unit", v.missing);
  const b = F.brokerView({}, pk, T);
  ok(b.range === null && b.pace === null && b.status === "preliminary", "no sales: broker range and pace preliminary");
}
{
  // readers and the asset type
  ok(F.readerFor("nonsense") === "broker" && F.readerFor(undefined) === "broker" && F.readerFor("investor") === "investor", "reader default = broker");
  const land = F.bppFinance({ id: "naj:plot:1-1", sqm: 5000 }, null, "investor", T);
  ok(land.kind === "land" && land.reader === "developer" && /empty plot/.test(land.note), "empty plot: investor request falls back to the developer view");
  ok(land.status === "preliminary" && land.rlvStatic.value === null && land.gdv.value === null && land.missing.some((m) => /floor area ratio/.test(m)), "empty plot without zoning: preliminary, no numbers");
  ok(/preliminary \(needs the floor area ratio from the zoning plan\)/.test(land.lines.join("\n")), "missing input named in plain words");
  const wrongWay = F.bppFinance(ppOf("naj:plot:326-5635", WH, "x"), WH, "developer", T);
  ok(wrongWay.reader === "broker" && /does not apply/.test(wrongWay.note), "built plot: developer request falls back to broker with a note");
  // with zoning and a district price the engine's land mode runs (static and dynamic residual, profit at the residual, monthly schedule)
  const d = F.developerView({ sqm: 5000 }, { zoning: { far: 4, source: "zoning (test)", date: "2026-11-01", verified: false }, district_price: { aed_m2: 20000, source: "sales register (test)", date: "2026-11-01" } });
  ok(near(d.gfa.value, 20000) && near(d.gdv.value, 20000 * 0.8 * 20000), "developer: GFA = plot x FAR; GDV = 80% saleable x price", [d.gfa.value, d.gdv.value]);
  ok(d.rlvStatic.value > 0 && d.rlvDynamic.value > 0 && d.rlvDynamic.value < d.rlvStatic.value, "developer: dynamic residual (with interest) below static", [d.rlvStatic.value, d.rlvDynamic.value]);
  ok(near(d.profitOnGdv.value, 0.2, 1e-6), "developer: at the residual land value profit on GDV = the 20% target", d.profitOnGdv.value);
  ok(d.status === "preliminary" && d.flags.some((x) => /ASSUMED/.test(x)), "developer: unverified permitted use stays preliminary");
  ok(d.schedule.length === 37 && d.schedule[36].revenue > 0, "developer: monthly schedule 0..36, sales at completion");
  const dcsv = F.scheduleCsv(Object.assign(d, { engine: E.ENGINE_VERSION, engine_source: ENGINE_SOURCE }), {});
  ok(/month,cost,sales,equity in,loan draw,interest/.test(dcsv), "developer: CSV cash flow header");
}
{
  // passport wiring
  const pp = ppOf("naj:plot:326-5635", WH, "Dubai Wharf Tower 2");
  const f0 = B.bppFacts(pp, WH, T), fin = F.bppFinance(pp, WH, "investor", T), slug = B.bppSlugFor(f0.name, f0.parcel, fin.reader);
  ok(slug === B.bppSlug(f0.name, f0.parcel) + "-investor" && B.bppSlugFor(f0.name, f0.parcel, "broker") === B.bppSlug(f0.name, f0.parcel), "slug: broker keeps the plain slug, others get a suffix");
  const f = B.withFinance(f0, fin, slug), pr = B.bppPrompt(f, "4 Nov 2026");
  ok(/FINANCE for section 07/.test(pr) && pr.includes("/bp/f/" + slug + ".csv") && !/<this passport>/.test(pr), "prompt carries the finance block with this passport's schedule link");
  ok(!f.lines.some((l) => /^Investment( \(calculated\))?:/.test(l)), "older plain investment line replaced (one method on the page)");
  ok(/Estimate, not a certified valuation/.test(pr) && /Curated by Najjuko/.test(pr), "prompt: valuation note and the footer kept");
  const body = B.bppBody("k", "", [{ slug: "a-1-investor", title: "A", date: T, pdf: true, csv: true, reader: "investor", fin: "preliminary" }], [{ title: "B", reader: "investor", status: "pending" }], "https://x", "najjuko");
  ok(/name=bpp_reader value=broker checked/.test(body) && /value=investor/.test(body) && /value=developer/.test(body), "card: reader choice, broker pre-selected");
  ok(/reader:\(document\.querySelector\("#bpp_r input:checked"\)/.test(body), "card: reader sent with the request");
  ok(/\/bp\/f\/a-1-investor\.csv/.test(body) && /For an investor \(preliminary\)/.test(body) && /B · for an investor/.test(body), "card: schedule link, reader and preliminary on the tile; reader on the request");
  // the public schedule route
  const store = { "bpp_file_a-1-investor_csv": "x,y\r\n" };
  const env = { MEETINGS: { get: async (k) => store[k] || null } };
  const res = await B.bppPublic(new Request("https://x/bp/f/a-1-investor.csv"), env, new URL("https://x/bp/f/a-1-investor.csv"));
  ok(res && res.status === 200 && /text\/csv/.test(res.headers.get("Content-Type")) && (await res.text()) === "x,y\r\n", "public /bp/f/<slug>.csv serves the schedule");
  const r404 = await B.bppPublic(new Request("https://x/bp/f/none.csv"), env, new URL("https://x/bp/f/none.csv"));
  ok(r404.status === 404, "missing schedule = 404");
  // the request API stores the reader
  const kv = {}; const env2 = { MEETINGS: { get: async (k) => kv[k] || null, put: async (k, v) => { kv[k] = v; } } };
  const deps = { person: () => "najjuko", isNaj: () => true, page: (a, b, c) => c };
  const post = (o) => B.bppRoute(new Request("https://x/momo/work/passports/api", { method: "POST", body: JSON.stringify(o) }), env2, new URL("https://x/momo/work/passports/api"), deps);
  const j1 = await (await post({ op: "request", text: "3265635" })).json(), j2 = await (await post({ op: "request", text: "3265635", reader: "investor" })).json();
  ok(JSON.parse(kv["bpp_req_" + j1.id]).reader === "broker" && JSON.parse(kv["bpp_req_" + j2.id]).reader === "investor", "request: default broker, investor when chosen");
}
console.log("v727 passport finance: " + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
