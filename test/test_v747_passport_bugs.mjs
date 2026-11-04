// v747 - four Building Passport bugs found on the Luma Park Views broker passport (plot 681-7149), 4 Nov 2026
import { makaniLine } from "../src/building_passports.js";
import { plotFactLines, dnaLines, dldFloors } from "../src/passport_neighbourhood.js";
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL " + m, x === undefined ? "" : JSON.stringify(x).slice(0, 400)); } };

// 1. Makani
ok(makaniLine({ numbers: ["2795895411"], src: "Makani (Dubai Municipality), 2026 plot layer" }) === "Makani number: 27958 95411 (source: Makani (Dubai Municipality), 2026 plot layer).", "one Makani number", makaniLine({ numbers: ["2795895411"] }));
const two = makaniLine({ numbers: ["2795895411", "2795895422"] });
ok(/Makani numbers \(2 on this plot[^)]*\): 27958 95411, 27958 95422/.test(two), "every Makani on a multi-building plot", two);
ok(makaniLine(null) === "" && makaniLine({ numbers: ["12"] }) === "", "no Makani held: empty (the passport lists it as missing)");

// 2. Floors: one answer
const luma = { bldgs: [{ no: "1", name: "Luma Park Views", floors: 25, flats: 0, shops: 6 }], nb: { facts: {} } };
let r = plotFactLines(luma);
ok(r.lines.some((l) => /^Floors .*: 25 floors \(source: DLD buildings register\)/.test(l)), "no lk_plot_floors: falls back to the DLD buildings register", r.lines);
ok(!r.missing.some((m) => /not loaded/.test(m)), "never 'not loaded' when the register has floors", r.missing);
r = plotFactLines({ bldgs: luma.bldgs, nb: { facts: { fl: { floors_label: "G+24 (25 floors)", floors_source: "DM building record", dm_record_text: "G+24" } } } });
ok(r.lines.some((l) => /G\+24 \(25 floors\) \(source: DM building record\)/.test(l)) && !r.lines.some((l) => /DLD buildings register/.test(l)), "DM record wins over the register", r.lines);
r = plotFactLines({ bldgs: luma.bldgs, nb: { facts: { fl: { floors_label: "About 20 floors", floors_source: "estimate", est_confidence: "high", floors_low: 18, floors_high: 22 } } } });
ok(r.lines.some((l) => /25 floors \(source: DLD buildings register\)/.test(l)) && !r.lines.some((l) => /About 20/.test(l)), "DLD register beats an About estimate", r.lines);
r = plotFactLines({ nb: { facts: {} } });
ok(r.missing.some((m) => /floor count not loaded yet/.test(m)), "no source at all: said so", r.missing);
ok(dldFloors({ bldgs: [{ name: "A", floors: 10 }, { name: "B", floors: 12 }] }) === "A 10 floors; B 12 floors", "per building when they differ");

// 4. Liveability: the version is never printed as the score
const d = dnaLines({ dna: { name: "Jumeirah Village Circle", live: { v: "0.3", as_of: "2026-11-03", p: { default: 60, family: 64.8 } } } });
ok(!/liveability index 0\.3/.test(d.lines[0]) && /scores 0 to 100[^:]*index version 0\.3[^:]*: overall 60, families 64\.8/.test(d.lines[0]), "index version labelled as a version, scores on 0-100", d.lines[0]);

console.log("v747 passport bugs: " + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
