// v353 - the executive summary: a pure, rule-based reading. Tests of every rule, the sentences, and the banned words. Nothing live is read.
import { assess, rate, overall, growthSolve, T, OVERALL, HOW } from "../src/devmap_summary.js";
import { scenario, irr } from "../src/devmap_irr.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2B55}\u{FE0F}\u{200D}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{25A0}-\u{25FF}]/u;
const BANNED = /\bAI\b|crosswalk|\bKV\b|claude|gpt|gemini|openai|anthropic|\bwill\b|\bexpect|guarantee|recommend|\bbuy\b|should (buy|invest)|you should|best buy/i;
const base = { price: 1750000, feeTransfer: 0.04, feeOther: 0.02, rent0: 105000, rentGrowth: 0.02, svc: 0, vacancy: 0.05, mgmt: 0.05, sellCost: 0.02, years: 5 };
const N = (o) => Object.assign({
  name: "Acme", areaName: "Test Area", psf: 1500, gross: 0.062, areaYield: 0.058, yieldScope: "developer", svcPsf: null, svcN: 0, svcOf: 5, net: null,
  g3: { change: 0.30, from: 2022, to: 2025 }, areaG3: { change: 0.20, from: 2022, to: 2025 }, cagr: 0.08, areaCagr: 0.06,
  sales: 300, offShare: 0.2, peakSales: 500, peakYear: 2023, supplyYears: 1.2, supplyHomes: 1500, pastHomes: 100,
  stressIrr: 0.05, histIrr: 0.12, histG: 0.07, base, exitShare: 0.4, histYearOne: 0.05, yearOne: 0.05, rentCagr: 0.05, rentFrom: 2019, rentTo: 2025, rents: 900,
  topBedSales: 100, topBedName: "1 bed", pg: { scen: 6 },
}, o || {});
const texts = (a) => [a.headline, a.chip].concat(a.reasons.concat(a.cautions, a.changers).map((c) => c.title + " " + c.number + " " + c.text), a.questions.map((q) => q.title + " " + q.text), a.dims.map((d) => d.label + " " + d.text), a.key.map((k) => k.label + " " + k.value + " " + k.sub)).join(" | ");
const v = (a, k) => a.dims.find((d) => d.key === k).verdict;

console.log("the five ratings, rule by rule");
{
  const d = (o) => rate(N(o)); const g = (x, k) => x.find((y) => y.key === k).verdict;
  ok(g(d({ gross: 0.062 }), "income") === "sup" && g(d({ gross: 0.056, areaYield: 0.058 }), "income") === "sup", "income: 5% or more and level with the area (within 0.25 points) is Supportive");
  ok(g(d({ gross: 0.052, areaYield: 0.07 }), "income") === "mix" && g(d({ gross: 0.045 }), "income") === "mix", "income: below the area, or 4 to 5%, is Mixed");
  ok(g(d({ gross: 0.035 }), "income") === "cau", "income: under 4% is Cautionary");
  ok(g(d({ gross: 0.062, svcPsf: 40, net: 0.062 - 40 / 1500 }), "income") === "mix", "income: a service charge that takes the yield under 4% moves Supportive down to Mixed");
  ok(g(d({ gross: 0.062, svcPsf: 10, net: 0.062 - 10 / 1500 }), "income") === "sup", "income: a small service charge leaves it Supportive");
  ok(g(d({ g3: { change: -0.02, from: 2022, to: 2025 } }), "growth") === "cau", "growth: a fall over three years is Cautionary");
  ok(g(d({ g3: { change: 0.10, from: 2022, to: 2025 }, cagr: 0.03, areaCagr: 0.06 }), "growth") === "mix", "growth: a rise that trails the area on both measures is Mixed");
  ok(g(d({ g3: { change: 0.10, from: 2022, to: 2025 }, cagr: 0.07, areaCagr: 0.06 }), "growth") === "sup", "growth: a rise with a compound rate at or above the area's is Supportive");
  ok(g(d({ sales: 300, peakSales: 500 }), "liquidity") === "sup" && g(d({ sales: 300, peakSales: 700 }), "liquidity") === "mix", "liquidity: 200+ sales and 50% of the peak is Supportive; 43% of the peak is Mixed");
  ok(g(d({ sales: 50 }), "liquidity") === "cau" && g(d({ sales: 300, peakSales: 2000 }), "liquidity") === "cau", "liquidity: under 60 sales, or under 20% of the peak, is Cautionary");
  ok(g(d({ sales: 300, peakSales: 500, offShare: 0.8 }), "liquidity") === "mix", "liquidity: 70% or more off-plan moves it one step down");
  ok(g(d({ supplyYears: 1.4 }), "supply") === "sup" && g(d({ supplyYears: 1.5 }), "supply") === "mix" && g(d({ supplyYears: 3 }), "supply") === "mix" && g(d({ supplyYears: 3.1 }), "supply") === "cau", "supply: under 1.5 Supportive, 1.5 to 3 Mixed, over 3 Cautionary");
  ok(g(d({ stressIrr: 0.041 }), "downside") === "sup" && g(d({ stressIrr: 0.04 }), "downside") === "mix" && g(d({ stressIrr: 0 }), "downside") === "mix" && g(d({ stressIrr: -0.001 }), "downside") === "cau", "downside: over 4% Supportive, 0 to 4% Mixed, under 0 Cautionary");
  ok(g(d({ supplyYears: null }), "supply") === "na" && g(d({ stressIrr: null }), "downside") === "na" && g(d({ gross: null }), "income") === "na" && g(d({ g3: null }), "growth") === "na", "a missing number is Not rated, never guessed");
}

console.log("the overall reading, from the counts");
{
  const sup = assess(N());
  ok(sup.overall.key === "worth" && sup.chip === OVERALL.worth && sup.overall.counts.sup === 5 && sup.overall.counts.cau === 0, "five supportive: 'A case worth a closer look'");
  ok(/a case worth a closer look/.test(sup.headline) && sup.headline.startsWith("Acme in Test Area: "), "the action title leads with the developer, the area and the reading");
  const mixed = assess(N({ g3: { change: 0.10, from: 2022, to: 2025 }, cagr: 0.03, supplyYears: 2, stressIrr: 0.02 }));
  ok(mixed.overall.key === "mixed" && mixed.chip === OVERALL.mixed && mixed.overall.counts.cau === 0, "income and liquidity supportive, the rest mixed: 'Mixed: depends on what you value'");
  const weak = assess(N({ stressIrr: -0.01, supplyYears: 4 }));
  ok(weak.overall.key === "weak" && weak.chip === OVERALL.weak && weak.overall.counts.cau === 2, "two cautionary: 'Weak case on the register'");
  ok(/a weak case on the register/.test(weak.headline) && /but /.test(weak.headline), "the weak title names the reading and the concern");
  const one = assess(N({ stressIrr: -0.01 }));
  ok(one.overall.key === "mixed" && one.overall.counts.cau === 1 && one.overall.counts.sup === 4, "one cautionary among four supportive is Mixed, not worth: a single Cautionary rules out 'worth a closer look'");
  ok(overall([{ verdict: "sup" }, { verdict: "sup" }, { verdict: "sup" }, { verdict: "na" }, { verdict: "na" }]).key === "worth", "three supportive and no Cautionary is enough even when two are not rated");
  ok(overall([{ verdict: "cau" }, { verdict: "cau" }, { verdict: "sup" }, { verdict: "sup" }, { verdict: "sup" }]).key === "weak", "two Cautionary beat three Supportive");
}

console.log("the cards: always three reasons, three cautions, up to three changers, four questions");
{
  for (const [nm, a] of [["supportive", assess(N())], ["weak", assess(N({ stressIrr: -0.01, supplyYears: 4, gross: 0.035, g3: { change: -0.05, from: 2022, to: 2025 }, sales: 40 }))], ["mixed", assess(N({ supplyYears: 2, stressIrr: 0.02 }))]]) {
    ok(a.reasons.length === 3 && a.cautions.length === 3 && a.questions.length === 4 && a.changers.length >= 2 && a.key.length === 5 && a.dims.length === 5, nm + ": 3 reasons, 3 cautions, 4 questions, 2+ changers, 5 key numbers, 5 ratings");
    ok([].concat(a.reasons, a.cautions).every((c) => c.title && c.number != null && c.text), nm + ": every card has a title, one key number and a sentence");
  }
  const sup = assess(N());
  ok(sup.cautions.some((c) => /Service charge not on the register/.test(c.title) && /The register holds no service charge/.test(c.text) && /5\.0% year-one cash return is before it/.test(c.text)), "no service charge on the register: said in the cautions with the year-one figure ('before it')");
  const withS = assess(N({ svcPsf: 16.8, svcN: 10, svcOf: 16, net: 0.062 - 16.8 / 1500 }));
  ok(!withS.cautions.some((c) => /Service charge not on the register/.test(c.title)), "service charge on the register: that caution is not printed");
  ok(/The register median is AED 16\.8 per sq ft for 10 of 16 buildings/.test(withS.questions[0].text), "the question about the service charge quotes the register figure when there is one");
  const noSup = assess(N({ supplyYears: null, supplyHomes: null, pastHomes: null }));
  ok(v(noSup, "supply") === "na" && noSup.overall.counts.na === 1 && noSup.changers.some((c) => /further fall in sales/.test(c.title)), "missing supply: Not rated, not counted, and the supply changer is replaced by the sales one");
  ok(!/Supply/.test(noSup.key.map((k) => k.label).join()) || noSup.key[3].value === "n/a", "missing supply: the key number says n/a");
  ok(noSup.reasons.length === 3 && noSup.cautions.length === 3, "missing supply: still three and three");
  ok(sup.changers[0].number === "AED " + ((0.062 - 0.04) * 1500).toFixed(1) && /below 4%/.test(sup.changers[0].text), "the service charge changer: AED " + ((0.062 - 0.04) * 1500).toFixed(1) + " per sq ft is where the gross yield 6.2% falls to 4% (0.022 x 1,500)");
  ok(sup.questions.map((q) => q.title).join() === "Service charge for the exact building,Handover date,Payment plan,Comparable recent sales", "the four questions");
  ok(/100 sales of 1 bed homes/.test(sup.questions[3].text), "the comparable-sales question carries the count");
  const gs = growthSolve(base, 0.04);
  ok(Math.abs(scenario(Object.assign({}, base, { growth: gs })).irr - 0.04) < 1e-6, "the 'slower price growth' threshold is the growth at which the five-year return is exactly 4% (" + (gs * 100).toFixed(2) + "% a year)");
  ok(sup.changers.some((c) => /Slower price growth/.test(c.title) && c.text.includes((Math.round(gs * 1000) / 10).toFixed(1) + "%")), "and it is the number printed");
}

console.log("what the text may and may not say");
{
  const all = [assess(N()), assess(N({ stressIrr: -0.01, supplyYears: 4 })), assess(N({ supplyYears: null })), assess(N({ gross: null, svcPsf: 16.8, net: null })), assess(N({ g3: null, stressIrr: null, base: null }))];
  for (const a of all) { const t = texts(a); ok(!BANNED.test(t) && !EMOJI.test(t), "no banned word or emoji (" + a.chip + ": " + (BANNED.exec(t) || [""])[0] + ")"); }
  ok(!BANNED.test(HOW) && /No score, no model/.test(HOW) && /1\.5 to 3 mixed/.test(HOW) && /over 4% supportive/.test(HOW), "the 'How this reading is made' line states the thresholds and that there is no score or model");
  ok(T.supplyLo === 1.5 && T.supplyHi === 3 && T.downHi === 0.04 && T.downLo === 0, "the editorial thresholds are the ones Kendall set");
  const bare = assess(N({ g3: null, stressIrr: null, base: null, gross: null, supplyYears: null, sales: 100, peakSales: null }));
  ok(bare.headline.length > 20 && bare.reasons.length === 3 && bare.cautions.length === 3, "with nearly nothing computed the page still has a headline and full cards (" + bare.overall.counts.na + " not rated)");
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
