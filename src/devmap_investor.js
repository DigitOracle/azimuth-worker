// INVESTOR PDF (v339, 4 Oct 2026): ONE developer in ONE area, two A4 pages, to hand to an investor.
//   GET /developers_pdf?kind=investor&area=<slug>&developer=<id>&client=<optional name>&window=12m&key=<client key or owner key>
// PAGE 1 the headline case: four figures, the yearly price chart (the developer's own median price per sq ft, with the area as a lighter line),
//        and plain-language cards written from the numbers.
// PAGE 2 supporting cards: ready and off-plan, unit mix and size, sales per year, price against the area and Dubai, delivery status and homes
//        coming in the area (only where the project register is on file), the area in 3D blocks, sources and the disclaimer.
// RULES (Kendall's decisions, 4 Oct 2026): both series are shown and a dip is said plainly; gross rental yield only from 30 or more rent
// contracts for this developer in this area (else an area figure, labelled, else a quiet card); a year is shown only with 30 or more sales
// and the years left out are named; the current year is marked as part of a year with its cut-off date; delivery is status and percent
// complete only, never early or late; no forecast, no return promised, no advice. No emoji, icons only, no internal words.
import { DM } from "./devmap_dm.js";
import { kvJson } from "./brief.js";
import { BRIEF_KIT, esc } from "./brief_docs.js";
import { icon, secHead, outlinePanels, windowIndex, loadData, loadMapData, blocksPicture, dateLong, shortName, EXTRA_CSS } from "./devmap_pdf.js";

const { NAVY, MUTED } = BRIEF_KIT;
const TEAL = "#0A4F4A", GOLDI = "#C5A56A", INK = "#22262B", HAIR = "#E6E1D8";
const SQFT = DM.SQFT;
export const MIN_SALES = 30;          // a year (or a yield) needs at least this many sales (contracts) behind it
const FONT = "IBM Plex Sans, Segoe UI, Arial, sans-serif";

const fmt = (n) => (n == null || !isFinite(n) ? "" : Math.round(n).toLocaleString("en-US"));
const aed = (n) => "AED " + fmt(n);
const pct1 = (x) => (Math.round(Math.abs(x) * 1000) / 10).toFixed(1) + "%";
const plural = (n, one, many) => fmt(n) + " " + (n === 1 ? one : many || one + "s");
const NUM = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const numWord = (n) => (n >= 0 && n <= 10 ? NUM[n] : String(n));
const cleanName = (s) => String(s || "").replace(/\s*[(（][^)）]*[؀-ۿ][^)）]*[)）]\s*/g, " ").replace(/\s+/g, " ").trim() || String(s || "");

// ------------------------------------------------------------------------------------------------ the yearly series
// rows: the index's y = [[year, sales, median AED per sq m], ...]. A year is solid with MIN_SALES or more sales; the year the data stops in is a part year.
export function seriesModel(rows, asOf) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(asOf || ""));
  const curYear = m ? Number(m[1]) : null, partialYear = m && !(m[2] === "12" && m[3] === "31") ? curYear : null;
  const out = (rows || []).filter((r) => r && r[1] > 0 && r[2] > 0).map((r) => ({ year: r[0], sales: r[1], psf: r[2] / SQFT, partial: r[0] === partialYear, solid: r[1] >= MIN_SALES }))
    .sort((a, b) => a.year - b.year);
  return { rows: out, solid: out.filter((r) => r.solid), suppressed: out.filter((r) => !r.solid).map((r) => r.year), partialYear, cutoff: partialYear ? dateLong(asOf) : "" };
}
const pctChange = (a, b) => (a > 0 ? b / a - 1 : null);
// the longest run of solid, full years that are next to each other; ties go to the later run
export function longestRun(S) {
  const full = S.solid.filter((r) => !r.partial); let best = [], cur = [];
  for (const r of full) { if (cur.length && r.year === cur[cur.length - 1].year + 1) cur.push(r); else cur = [r]; if (cur.length >= best.length) best = cur.slice(); }
  return best;
}
// growth: the last full solid year against three years earlier (else the run that ends there), and the compound yearly rate over the longest run
export function growthFigures(S) {
  const full = S.solid.filter((r) => !r.partial), last = full[full.length - 1], g = { last: last || null, three: null, cagr: null, run: longestRun(S) };
  if (!last) return g;
  const byYear = new Map(full.map((r) => [r.year, r]));
  let from = byYear.get(last.year - 3), span = 3;
  if (!from) { let y = last.year - 1; while (byYear.has(y)) y--; const f = byYear.get(y + 1); if (f && f.year < last.year) { from = f; span = last.year - f.year; } }
  if (from) g.three = { from, to: last, span, change: pctChange(from.psf, last.psf), exact3: span === 3 };
  const run = g.run;
  if (run.length >= 3) { const a = run[0], b = run[run.length - 1], n = b.year - a.year; g.cagr = { from: a, to: b, years: n, rate: Math.pow(b.psf / a.psf, 1 / n) - 1 }; }
  return g;
}
// steps between neighbouring solid years (every solid row, the part year too, as the chart shows them)
export function stepsOf(S) {
  const steps = [];
  for (let i = 1; i < S.solid.length; i++) { const a = S.solid[i - 1], b = S.solid[i]; if (b.year === a.year + 1) steps.push({ year: b.year, from: a, to: b, change: pctChange(a.psf, b.psf), partial: b.partial }); }
  return steps;
}
const yearLabel = (r, S) => (r.partial ? r.year + " so far (to " + S.cutoff + ")" : String(r.year));

// ------------------------------------------------------------------------------------------------ gross rental yield
// Rent and sale cells come from different homes, so the yield is built bedroom by bedroom: a year's typical rent over the typical price of the
// same size of home, weighted by the sales. cells: sales [n, per sq m, AED, beds], rent [contracts, per sq m, AED a year, beds].
export function yieldFigure(saleCells, rentCells) {
  const agg = (cells, n) => { const o = {}; for (const c of cells || []) { const b = c[3]; if (b == null || b > 5 || !(c[0] > 0) || !(c[2] > 0)) continue; const k = Math.min(b, 4); const e = o[k] || (o[k] = { n: 0, sum: 0 }); e.n += c[0]; e.sum += c[0] * c[2]; } return o; };
  const S = agg(saleCells), R = agg(rentCells);
  let num = 0, den = 0, contracts = 0, classes = 0;
  for (const k of Object.keys(S)) { const s = S[k], r = R[k]; if (!r || s.n < 5 || r.n < 5) continue; const price = s.sum / s.n, rent = r.sum / r.n; num += s.n * rent; den += s.n * price; contracts += r.n; classes++; }
  if (!(den > 0)) return null;
  return { rate: num / den, contracts, classes, enough: contracts >= MIN_SALES };
}
// the yield to show: this developer here (30+ contracts), else the whole area (labelled as such), else nothing
export function yieldChoice(devY, areaY) {
  if (devY && devY.enough) return { scope: "developer", rate: devY.rate, contracts: devY.contracts };
  if (areaY && areaY.enough) return { scope: "area", rate: areaY.rate, contracts: areaY.contracts };
  return null;
}

// ------------------------------------------------------------------------------------------------ the sentences (written from the numbers)
export function trendSentences(o) {
  const { dev, area, devName, areaName } = o, out = [];
  const g = growthFigures(dev), steps = stepsOf(dev), dips = steps.filter((s) => s.change != null && s.change < 0);
  const fullRows = dev.solid.filter((r) => !r.partial), first = dev.solid[0], lastAny = fullRows[fullRows.length - 1];
  // 1. how the price moved (first year to the last full year), and where it dipped (the part year included, named as such)
  if (first && lastAny && first !== lastAny) {
    let t = "The median price per sq ft of " + devName + " homes in " + areaName + " was " + aed(first.psf) + " in " + first.year + " and " + aed(lastAny.psf) + " in " + lastAny.year + ", " + (lastAny.psf >= first.psf ? "up " : "down ") + pct1(pctChange(first.psf, lastAny.psf)) + ".";
    if (steps.length >= 2 && !dips.length && steps.length === dev.solid.length - 1) t += " It was higher than the year before in every year on the chart.";
    else if (dips.length) t += " It was lower than the year before in " + dips.map((s) => (s.partial ? s.year + " so far, to " + dev.cutoff : s.year) + " (" + aed(s.to.psf) + ", down " + pct1(s.change) + ")").join(" and in ") + "; " + (steps.length - dips.length > 0 ? "in the other " + (steps.length - dips.length === 1 ? "year it rose" : numWord(steps.length - dips.length) + " years it rose") + "." : "it did not rise in any year.");
    else t += " Not every year is on the chart, so year-by-year moves are shown only between neighbouring years.";
    const part = dev.solid.find((r) => r.partial);
    if (part && !dips.some((s) => s.partial)) t += " So far in " + part.year + " (to " + dev.cutoff + ") it is " + aed(part.psf) + ".";
    out.push({ key: "trend", icon: "chart-bar", title: "How the price has moved", text: t });
  }
  // 2. against the area over the same years
  const aMap = new Map(area.solid.map((r) => [r.year, r]));
  if (first && lastAny && aMap.has(first.year) && aMap.has(lastAny.year) && first !== lastAny) {
    const a0 = aMap.get(first.year), a1 = aMap.get(lastAny.year), dc = pctChange(first.psf, lastAny.psf), ac = pctChange(a0.psf, a1.psf), gap = dc - ac;
    const t = "Over the same years the price per sq ft of all homes in " + areaName + " went from " + aed(a0.psf) + " to " + aed(a1.psf) + " (" + (ac >= 0 ? "up " : "down ") + pct1(ac) + "). " + devName + " moved " + (Math.abs(gap) < 0.005 ? "in line with the area" : pct1(gap * 1) .replace(/%$/, "") + " percentage points " + (gap > 0 ? "more" : "less") + " than the area") + ".";
    out.push({ key: "area", icon: "stack", title: "Against the whole area", text: t });
  }
  // 3. volume
  const busiest = dev.solid.filter((r) => !r.partial).sort((a, b) => b.sales - a.sales)[0];
  if (busiest) {
    const total = dev.solid.reduce((q, r) => q + r.sales, 0), lastFull = dev.solid.filter((r) => !r.partial).slice(-1)[0];
    let t = fmt(total) + " sales by " + devName + " in " + areaName + " are on the register" + (dev.solid.length > 1 ? " in the years shown, " + dev.solid[0].year + " to " + (dev.solid[dev.solid.length - 1].partial ? "part of " : "") + dev.solid[dev.solid.length - 1].year : "") + ". The busiest year was " + busiest.year + " with " + fmt(busiest.sales) + " sales" + (lastFull && lastFull.year !== busiest.year ? "; " + lastFull.year + " had " + fmt(lastFull.sales) : "") + ".";
    if (o.offplanShare != null && o.offplanShare > 0.6) t += " Most recent sales are of homes still to be built (off-plan, " + Math.round(o.offplanShare * 100) + "%), so a launch can lift a single year.";
    out.push({ key: "volume", icon: "chart-donut", title: "How much has sold", text: t });
  }
  // 4. the yield, only when it stands up
  if (o.yield) {
    const y = o.yield, t = (y.scope === "developer" ? "Registered rent contracts for " + devName + " homes in " + areaName : "Registered rent contracts for all homes in " + areaName + " (an area figure, not specific to " + devName + ")") + " point to a gross rental yield near " + (Math.round(y.rate * 1000) / 10).toFixed(1) + "%. Gross means a year's rent as a share of the purchase price, before service charges, fees and empty months. It is built from " + fmt(y.contracts) + " rent contracts and the typical sale price of the same size of home.";
    out.push({ key: "yield", icon: "wallet", title: "What the rent contracts show", text: t });
  } else if (o.offplan && o.offplan.ready && o.offplan.off) {
    const d = pctChange(o.offplan.ready.psf, o.offplan.off.psf);
    out.push({ key: "offplan", icon: "buildings", title: "Ready and off-plan", text: "In the last 12 months ready homes sold at a median " + aed(o.offplan.ready.psf) + " per sq ft and homes still to be built (off-plan) at " + aed(o.offplan.off.psf) + ", " + pct1(d) + (d < 0 ? " lower" : " higher") + ". Off-plan prices are the contract price, not what the home would fetch today." });
  }
  return out.slice(0, 4);
}

// ------------------------------------------------------------------------------------------------ the model
export function resolveDeveloper(areaRec, id) {
  const want = String(id || "").toLowerCase().trim(), devs = (areaRec && areaRec.devs) || {};
  for (const k of [want, want.replace(/ /g, "-"), want.replace(/-/g, " ")]) if (k && k !== "_" && devs[k]) return k;
  return null;
}
const sumCells = (devs, f) => { const o = []; for (const k of Object.keys(devs)) if (k !== "_") for (const c of devs[k][f] || []) o.push(c); return o; };

export function investorModel(IDX0, slug, k, deliv) {
  const area = IDX0.areas[slug], d = area.devs[k], EV = IDX0.ev || {}, asOf = EV.as_of || IDX0.as_of;
  const dEv = d.ev || {}, aEv = area.ev || {};
  const dev = seriesModel(dEv.y, asOf), ar = seriesModel(aEv.y, asOf);
  const m = { slug, k, name: cleanName(d.n || k), asOf, source: EV.source_as_of || IDX0.as_of, dev, area: ar, growth: growthFigures(dev) };
  m.enough = dev.solid.length >= 2 && dev.solid.some((r) => !r.partial);
  const l12 = dEv.l12 || [], a12 = aEv.l12 || [];
  m.l12 = { sales: l12[0] || 0, psf: l12[1] ? l12[1] / SQFT : null, ready: l12[2] >= 3 && l12[3] ? { n: l12[2], psf: l12[3] / SQFT } : null, off: l12[4] >= 3 && l12[5] ? { n: l12[4], psf: l12[5] / SQFT } : null, size: l12[10] ? [l12[10], l12[11], l12[12]].map((x) => x * SQFT) : null, apt: l12[6] || 0, villa: l12[8] || 0 };
  m.areaL12 = { sales: a12[0] || 0, psf: a12[1] ? a12[1] / SQFT : null };
  m.from = EV.l12_from; m.to = EV.l12_to;
  m.dubaiPsf = IDX0.cuts && IDX0.cuts.bounds ? IDX0.cuts.bounds[2] / SQFT : null;
  m.bandPsf = IDX0.cuts && IDX0.cuts.bounds ? IDX0.cuts.bounds.map((x) => x / SQFT) : null;      // top 5%, upper fifth, median start (per sq ft)
  m.offplanShare = m.l12.sales >= 10 && m.l12.off ? m.l12.off.n / m.l12.sales : null;
  const c12 = d.c12 || [], mix = [0, 0, 0, 0]; let tot = 0;
  for (const c of c12) { if (c[3] == null || c[3] > 5) continue; const i = Math.min(c[3], 3); mix[i] += c[0]; tot += c[0]; }
  m.mix = tot > 0 ? { share: mix.map((x) => x / tot), n: tot } : null;
  const devY = yieldFigure(c12.length ? c12 : [], d.r || []);
  const areaY = yieldFigure(sumCells(area.devs, "c12"), sumCells(area.devs, "r"));
  m.yield = yieldChoice(devY, areaY);
  m.yieldNote = !m.yield && devY ? { contracts: devY.contracts } : null;
  m.deliv = deliv && deliv.by ? deliv.by[slug + "|" + k] || null : null;
  m.supply = deliv && deliv.area ? deliv.area[slug] || null : null;
  m.delivAsOf = deliv && deliv.as_of ? deliv.as_of : null;
  m.sentences = m.enough ? trendSentences({ dev, area: ar, devName: m.name, areaName: area.name, offplanShare: m.offplanShare, yield: m.yield, offplan: { ready: m.l12.ready, off: m.l12.off } }) : [];
  return m;
}

// ------------------------------------------------------------------------------------------------ the pieces
const CAP = (s) => s.charAt(0).toUpperCase() + s.slice(1);
function chartSvg(m, areaName) {
  const dev = m.dev, ar = m.area, W = 678, H = 300, L = 54, R = 48, T = 34, B = 54, PW = W - L - R, PH = H - T - B;
  const years = dev.rows.map((r) => r.year), y0 = Math.min(...years), y1 = Math.max(...years), span = Math.max(1, y1 - y0);
  const aIn = ar.solid.filter((r) => r.year >= y0 && r.year <= y1);
  const vals = dev.solid.map((r) => r.psf).concat(aIn.map((r) => r.psf));
  const lo = Math.min(...vals), hi = Math.max(...vals), ymin = Math.floor(lo * 0.9 / 100) * 100, ymax = Math.ceil(hi * 1.07 / 100) * 100;
  const X = (y) => L + 22 + (y - y0) / span * (PW - 44), Y = (v) => T + PH - (v - ymin) / (ymax - ymin) * PH;
  const halo = ' stroke="#FFFFFF" stroke-width="3" paint-order="stroke" stroke-linejoin="round"';
  let s = '<svg viewBox="0 0 ' + W + " " + H + '" width="100%" role="img" aria-label="Median price per sq ft by year, ' + esc(m.name) + " and all homes in " + esc(areaName) + '" font-family="' + FONT + '">';
  const ticks = 4; for (let i = 0; i <= ticks; i++) { const v = ymin + (ymax - ymin) * i / ticks, y = Y(v); s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '" stroke="#ECE8DE" stroke-width="1"/><text x="' + (L - 6) + '" y="' + (y + 3) + '" font-size="9" fill="' + MUTED + '" text-anchor="end">' + fmt(v) + "</text>"; }
  const line = (rows, col, dashPartial) => {
    let d = "", dd = "";
    for (let i = 0; i < rows.length; i++) { const r = rows[i], p = rows[i - 1], pt = X(r.year).toFixed(1) + " " + Y(r.psf).toFixed(1); if (p && r.year === p.year + 1) { if (r.partial && dashPartial) dd += "M" + X(p.year).toFixed(1) + " " + Y(p.psf).toFixed(1) + "L" + pt; else d += "L" + pt; } else d += "M" + pt; }
    return (d ? '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' : "") + (dd ? '<path d="' + dd + '" fill="none" stroke="' + col + '" stroke-width="2" stroke-dasharray="4 3"/>' : "");
  };
  s += line(aIn, "#CDB57F", true) + line(dev.solid, TEAL, true);
  for (const r of aIn) s += '<circle cx="' + X(r.year).toFixed(1) + '" cy="' + Y(r.psf).toFixed(1) + '" r="2.4" fill="' + (r.partial ? "#FFFFFF" : "#CDB57F") + '" stroke="#CDB57F" stroke-width="1.4"/>';
  const aBy = new Map(aIn.map((r) => [r.year, r]));
  for (const r of dev.solid) {
    const x = X(r.year), y = Y(r.psf), a = aBy.get(r.year), above = !a || r.psf >= a.psf;
    s += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="3.8" fill="' + (r.partial ? "#FFFFFF" : TEAL) + '" stroke="' + TEAL + '" stroke-width="1.8"/>';
    s += '<text x="' + x.toFixed(1) + '" y="' + (above ? y - 8 : y + 15).toFixed(1) + '" font-size="9.6" font-weight="600" fill="' + TEAL + '" text-anchor="middle"' + halo + ">" + fmt(r.psf) + "</text>";
  }
  // the area's two ends, labelled on the side the developer's label is not on
  for (const r of [aIn[0], aIn[aIn.length - 1]].filter((v, i, q) => v && q.indexOf(v) === i)) {
    const d = dev.solid.find((q) => q.year === r.year), below = d ? d.psf >= r.psf : true;
    if (d && Math.abs(d.psf - r.psf) / r.psf < 0.004) continue;
    s += '<text x="' + X(r.year).toFixed(1) + '" y="' + (below ? Y(r.psf) + 15 : Y(r.psf) - 8).toFixed(1) + '" font-size="9.2" font-weight="600" fill="#8A6D2C" text-anchor="middle"' + halo + ">" + fmt(r.psf) + "</text>";
  }
  for (const r of dev.rows) {
    const x = X(r.year).toFixed(1);
    s += '<text x="' + x + '" y="' + (H - 28) + '" font-size="10" font-weight="600" fill="' + INK + '" text-anchor="middle">' + r.year + (r.partial ? "*" : "") + "</text><text x=\"" + x + '" y="' + (H - 15) + '" font-size="8.6" fill="' + MUTED + '" text-anchor="middle"' + (r.solid ? "" : ' font-style="italic"') + ">" + (r.solid ? fmt(r.sales) + " sales" : "under " + MIN_SALES) + "</text>";
  }
  return s + "</svg>";
}

function sparkBars(rows, W, H, labelFont) {
  const mx = Math.max(...rows.map((r) => r.sales)), n = rows.length, bw = Math.min(34, (W - 8) / n - 6), gap = (W - 8 - bw * n) / Math.max(1, n - 1);
  let s = '<svg viewBox="0 0 ' + W + " " + H + '" width="100%" role="img" aria-label="Sales per year" font-family="' + FONT + '">';
  rows.forEach((r, i) => {
    const x = 4 + i * (bw + gap), h = Math.max(2, (H - 30) * r.sales / mx), y = H - 14 - h;
    s += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="2" fill="' + (r.partial ? "#7FA9A4" : TEAL) + '"/>' +
      '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (y - 3).toFixed(1) + '" font-size="' + (labelFont || 8.6) + '" fill="' + INK + '" text-anchor="middle">' + fmt(r.sales) + "</text><text x=\"" + (x + bw / 2).toFixed(1) + '" y="' + (H - 3) + '" font-size="8.6" fill="' + MUTED + '" text-anchor="middle">' + "'" + String(r.year).slice(2) + "</text>";
  });
  return s + "</svg>";
}

function bandGauge(m) {
  const pts = [], W = 320, H = 70, L = 8, R = 8, dub = m.dubaiPsf, b = m.bandPsf;
  if (!m.l12.psf || !dub) return "";
  const hiV = Math.max(b ? b[0] : dub * 2, m.l12.psf * 1.08), X = (v) => L + v / hiV * (W - L - R);
  let s = '<svg viewBox="0 0 ' + W + " " + H + '" width="100%" role="img" aria-label="Price per sq ft against the area and Dubai" font-family="' + FONT + '"><rect x="' + L + '" y="30" width="' + (W - L - R) + '" height="8" rx="4" fill="#ECE8DE"/>';
  if (b) s += '<rect x="' + X(b[2]).toFixed(1) + '" y="30" width="' + (X(b[1]) - X(b[2])).toFixed(1) + '" height="8" fill="#DCE9E6"/><rect x="' + X(b[1]).toFixed(1) + '" y="30" width="' + (X(b[0]) - X(b[1])).toFixed(1) + '" height="8" fill="#BBD5D0"/>';
  const tick = (v, lab, up) => '<line x1="' + X(v).toFixed(1) + '" x2="' + X(v).toFixed(1) + '" y1="28" y2="40" stroke="#7B8A86" stroke-width="1"/><text x="' + X(v).toFixed(1) + '" y="' + (up ? 24 : 52) + '" font-size="8.4" fill="' + MUTED + '" text-anchor="middle">' + lab + "</text>";
  s += tick(dub, "Dubai median " + fmt(dub), false);
  if (b) s += '<text x="' + (W - R) + '" y="64" font-size="8" fill="' + MUTED + '" text-anchor="end">Dearest 1 in 20 Dubai sales from ' + fmt(b[0]) + "</text>";
  if (m.areaL12.psf) s += '<circle cx="' + X(m.areaL12.psf).toFixed(1) + '" cy="34" r="5" fill="#FFFFFF" stroke="' + TEAL + '" stroke-width="1.8"/>';
  s += '<circle cx="' + X(m.l12.psf).toFixed(1) + '" cy="34" r="5.5" fill="' + GOLDI + '" stroke="' + TEAL + '" stroke-width="1.8"/>';
  return s + "</svg>";
}

const card = (ic, title, body, cls) => '<div class="ivc' + (cls ? " " + cls : "") + '"><div class="ivch">' + icon(ic, 17, TEAL) + '<span class="serif">' + title + "</span></div>" + body + "</div>";
const hero = (k, v, sub) => '<div class="ivhero"><div class="tk">' + k + '</div><div class="ivhv">' + v + '</div><div class="ivhs">' + sub + "</div></div>";

function heroCards(m) {
  const g = m.growth, out = [];
  const L = m.l12;
  if (L.psf && L.sales >= MIN_SALES) out.push(hero("Median price, 12 months", aed(L.psf), "per sq ft &middot; " + plural(L.sales, "sale")));
  else if (g.last) out.push(hero("Median price, " + g.last.year, aed(g.last.psf), "per sq ft &middot; " + plural(g.last.sales, "sale") + " &middot; full year"));
  else out.push(hero("Median price", "&ndash;", "fewer than " + MIN_SALES + " sales"));
  if (g.three) out.push(hero("Change over " + (g.three.exact3 ? "3 years" : numWord(g.three.span) + (g.three.span === 1 ? " year" : " years")), (g.three.change >= 0 ? "+" : "&minus;") + pct1(g.three.change), g.three.from.year + " to " + g.three.to.year + " &middot; full years"));
  else out.push(hero("Change over time", "&ndash;", "needs two full years with " + MIN_SALES + " sales"));
  if (g.cagr) out.push(hero("Compound yearly rate", (g.cagr.rate >= 0 ? "+" : "&minus;") + pct1(g.cagr.rate), g.cagr.from.year + " to " + g.cagr.to.year + " &middot; " + g.cagr.years + " years"));
  else out.push(hero("Compound yearly rate", "&ndash;", "needs three full years in a row"));
  if (m.yield) out.push(hero("Gross rental yield", (Math.round(m.yield.rate * 1000) / 10).toFixed(1) + "%", (m.yield.scope === "area" ? "area-level &middot; " : "") + "gross, before fees and vacancy &middot; " + plural(m.yield.contracts, "rent contract")));
  else out.push(hero("Gross rental yield", "&ndash;", "not enough rent contracts yet"));
  return '<div class="ivheroes">' + out.join("") + "</div>";
}

function chartCard(m, areaName) {
  const dev = m.dev, sup = dev.rows.filter((r) => !r.solid).map((r) => r.year);
  const notes = [];
  if (dev.partialYear && dev.rows.some((r) => r.partial && r.solid)) notes.push(dev.partialYear + "* is part of a year, to " + dev.cutoff + " (dashed line, hollow dot).");
  if (sup.length) notes.push(sup.join(", ") + (sup.length === 1 ? ": fewer than " : ": each with fewer than ") + MIN_SALES + " sales, not shown.");
  const dips = stepsOf(dev).filter((s) => s.change != null && s.change < 0);
  const cap = [notes.join(" "), "Each figure is the median price per sq ft of the homes sold that year, from the Land Department register."].filter(Boolean).join(" ");
  return '<div class="ivc ivchart"><div class="ivch">' + icon("chart-bar", 17, TEAL) + '<span class="serif">Median price per sq ft, year by year</span></div>' +
    '<div class="ivleg"><span><i style="background:' + TEAL + '"></i>' + esc(shortName(m.name, 28)) + " in " + esc(areaName) + '</span><span><i style="background:#CDB57F"></i>All homes in ' + esc(areaName) + " (area line)</span><span class=\"ivlegn\">AED per sq ft</span></div>" +
    chartSvg(m, areaName) + '<div class="ivcap">' + esc(cap) + "</div></div>";
}

function whyCards(m) {
  if (!m.sentences.length) return "";
  return '<div class="ivwhy">' + m.sentences.map((s) => '<div class="ivw"><span class="icw ivicw">' + icon(s.icon, 18, TEAL) + '</span><div><div class="ivwt serif">' + esc(s.title) + '</div><p>' + esc(s.text) + "</p></div></div>").join("") + "</div>";
}

// ---- page 2 cards
function readyOffCard(m) {
  const r = m.l12.ready, o = m.l12.off, mx = Math.max(r ? r.psf : 0, o ? o.psf : 0);
  if (!r && !o) return "";
  const bar = (lab, e, col) => e ? '<div class="ivbr"><span class="ivbl">' + lab + '</span><span class="ivbt"><i style="width:' + Math.round(e.psf / mx * 100) + "%;background:" + col + '"></i></span><span class="ivbv"><b>' + aed(e.psf) + "</b> &middot; " + plural(e.n, "sale") + "</span></div>" : "";
  let t = "";
  if (r && o) { const d = pctChange(r.psf, o.psf); t = "Off-plan sold " + pct1(d) + (d < 0 ? " below" : " above") + " ready homes. Off-plan is the contract price agreed before the home is finished."; }
  else t = "Only " + (r ? "ready" : "off-plan") + " sales have a median in the last 12 months.";
  return card("buildings", "Ready and off-plan", bar("Ready", r, TEAL) + bar("Off-plan", o, GOLDI) + '<div class="ivcap">Last 12 months, per sq ft. ' + esc(t) + "</div>");
}
function mixCard(m) {
  const mx = m.mix, sz = m.l12.size; if (!mx && !sz) return "";
  const lab = ["Studio", "1 bed", "2 bed", "3+ bed"];
  const bars = mx ? lab.map((l, i) => mx.share[i] >= 0.005 ? '<div class="ivbr"><span class="ivbl">' + l + '</span><span class="ivbt"><i style="width:' + Math.max(2, Math.round(mx.share[i] * 100)) + '%;background:' + TEAL + '"></i></span><span class="ivbv"><b>' + Math.round(mx.share[i] * 100) + "%</b></span></div>" : "").join("") : "";
  const size = sz ? '<div class="ivcap">Typical home ' + fmt(sz[1]) + " sq ft. Eight in ten are between " + fmt(sz[0]) + " and " + fmt(sz[2]) + " sq ft.</div>" : "";
  return card("ruler", "Home sizes", bars + size);
}
function liquidityCard(m) {
  const rows = m.dev.solid; if (rows.length < 2) return "";
  const busiest = rows.slice().filter((r) => !r.partial).sort((a, b) => b.sales - a.sales)[0];
  return card("chart-donut", "Sales per year", sparkBars(rows, 320, 92) + '<div class="ivcap">Homes sold each year' + (m.dev.partialYear && rows.some((r) => r.partial) ? " (lighter bar: part of " + m.dev.partialYear + ", to " + m.dev.cutoff + ")" : "") + (busiest ? ". Busiest full year " + busiest.year + ": " + fmt(busiest.sales) + " sales" : "") + ". " + (m.l12.sales ? plural(m.l12.sales, "sale") + " in the last 12 months." : "") + "</div>");
}
function priceCard(m, areaName) {
  if (!m.l12.psf) return "";
  const parts = [], a = m.areaL12.psf, d = m.dubaiPsf;
  if (a) { const c = pctChange(a, m.l12.psf); parts.push(Math.abs(c) < 0.005 ? "level with the area median (" + aed(a) + ")" : pct1(c) + (c > 0 ? " above" : " below") + " the median of all homes in " + areaName + " (" + aed(a) + ")"); }
  if (d) { const c = pctChange(d, m.l12.psf); parts.push(Math.abs(c) < 0.005 ? "level with the Dubai median" : pct1(c) + (c > 0 ? " above" : " below") + " the Dubai median (" + aed(d) + ")"); }
  return card("stack", "Price against the area and Dubai", bandGauge(m) + '<div class="ivcap"><b>Gold dot</b>: ' + esc(shortName(m.name, 24)) + " " + aed(m.l12.psf) + " per sq ft, last 12 months. <b>Ring</b>: the area. " + esc(CAP(parts.join(", and "))) + ".</div>");
}
function deliveryCard(m) {
  const dv = m.deliv; if (!dv) return "";
  const stat = (k, p) => '<div class="ivst"><b>' + fmt(p ? p[0] : 0) + '</b><span>' + k + (p && p[1] ? "<br>" + fmt(p[1]) + " homes" : "") + "</span></div>";
  const act = dv.active && dv.active[0] ? dv.active : null;
  const top = (dv.top || []).slice(0, 3).map((t) => '<div class="ivbr"><span class="ivbl" style="width:112px">' + esc(shortName(t[0], 22)) + '</span><span class="ivbt"><i style="width:' + Math.max(2, Math.min(100, Math.round(t[2] || 0))) + '%;background:' + GOLDI + '"></i></span><span class="ivbv"><b>' + Math.round(t[2] || 0) + "%</b> complete</span></div>").join("");
  return card("buildings", "Delivery status of its projects here", '<div class="ivsts">' + stat("handed over", dv.done) + stat("under construction" + (act && act[2] != null ? ", " + Math.round(act[2]) + "% on average" : ""), act) + stat("not started", dv.pending) + "</div>" + top + '<div class="ivcap">Status and percent complete from the Dubai Land Department project register' + (m.delivAsOf ? " of " + esc(dateLong(m.delivAsOf)) : "") + ". The register records status, not whether a project was early or late.</div>");
}
function supplyCard(m, areaName) {
  const s = m.supply; if (!s || !((s.active && s.active[0]) || (s.pending && s.pending[0]))) return "";
  const a = s.active || [0, 0], p = s.pending || [0, 0];
  return card("map-trifold", "Homes coming in " + esc(areaName), '<div class="ivsts">' + '<div class="ivst"><b>' + fmt(a[1]) + "</b><span>homes in " + plural(a[0], "project") + " under construction</span></div>" + '<div class="ivst"><b>' + fmt(p[1]) + "</b><span>homes in " + plural(p[0], "project") + " not yet started</span></div></div>" + '<div class="ivcap">All developers in this area, from the project register' + (m.delivAsOf ? " of " + esc(dateLong(m.delivAsOf)) : "") + ". Registered homes, not a forecast of sales.</div>");
}

export function disclaimerText(m) {
  return "This sheet describes past sales and rent registrations held by the Dubai Land Department to " + dateLong(m.asOf) + ". It is not investment, financial, legal or tax advice, and not an offer or a forecast. Past prices do not guarantee future prices, and no return is promised. Figures are medians of registered transactions. A sale is matched to a developer through its project; some sales cannot be matched and are left out of the developer figures. Gross rental yield is a year's rent as a share of the purchase price before service charges, fees and empty months. Availability and the price of any home must be confirmed with the developer. Check each property, its running costs and your own circumstances with a licensed adviser before buying.";
}
function sourcesCard(m) {
  return '<div class="ivc ivsrc"><div class="ivch">' + icon("info", 17, TEAL) + '<span class="serif">Sources and the small print</span></div><div class="ivsrct"><b>Sources.</b> Dubai Land Department sales register, settled sales to ' + esc(dateLong(m.asOf)) + " (the register runs to " + esc(dateLong(m.source)) + "); registered rent contracts; the Dubai Land Department project register" + (m.delivAsOf ? ", " + esc(dateLong(m.delivAsOf)) : "") + ". Last 12 months means " + esc(dateLong(m.from)) + " to " + esc(dateLong(m.to)) + ". Prices per sq ft are medians. " + esc(disclaimerText(m)) + "</div></div>";
}

// ------------------------------------------------------------------------------------------------ page chrome
const INV_CSS = `
  .ivtitle { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; }
  .ivprep { margin-top:7px; font-size:11px; color:${INK}; display:flex; gap:7px; align-items:baseline; } .ivprep b { font-weight:600; color:${NAVY}; }
  .ivprep .ul2 { display:inline-block; min-width:210px; border-bottom:1px solid #8A9A96; height:12px; }
  .ivheroes { display:grid; grid-template-columns:repeat(4,1fr); gap:9px; }
  .ivhero { border:1px solid ${HAIR}; border-top:3px solid ${GOLDI}; background:#fff; padding:6px 10px 6px; min-width:0; }
  .ivhv { font-family:Newsreader, Georgia, serif; font-size:23px; color:${NAVY}; line-height:1.12; margin-top:2px; white-space:nowrap; }
  .ivhs { font-size:9.4px; color:${MUTED}; line-height:1.3; margin-top:1px; }
  .ivhero .tk { font-size:8.4px; }
  .ivc { border:1px solid ${HAIR}; border-radius:8px; background:#fff; padding:8px 12px 9px; display:flex; flex-direction:column; gap:6px; min-width:0; }
  .ivch { display:flex; gap:7px; align-items:center; font-size:14.5px; color:${NAVY}; white-space:nowrap; }
  .ivleg { display:flex; gap:16px; font-size:9.4px; color:#3d4249; align-items:center; margin-top:-2px; } .ivleg i { display:inline-block; width:14px; height:3px; margin-right:5px; vertical-align:middle; } .ivlegn { margin-left:auto; color:${MUTED}; }
  .ivcap { font-size:9.8px; color:${MUTED}; line-height:1.38; }
  .ivwhy { display:grid; grid-template-columns:1fr 1fr; gap:9px; }
  .ivw { display:flex; gap:10px; align-items:flex-start; border:1px solid ${HAIR}; border-left:4px solid ${GOLDI}; border-radius:6px; background:#fff; padding:8px 11px 8px 10px; }
  .ivicw { width:30px; height:30px; } .ivwt { font-size:14px; color:${NAVY}; line-height:1.15; } .ivw p { margin:3px 0 0; font-size:10.4px; line-height:1.42; color:#33383e; }
  .ivgrid { display:grid; grid-template-columns:1fr 1fr; gap:9px; align-items:stretch; }
  .ivbr { display:grid; grid-template-columns:54px 1fr auto; gap:7px; align-items:center; font-size:10px; } .ivbl { color:#3d4249; } .ivbv { color:${MUTED}; white-space:nowrap; } .ivbv b { color:${INK}; font-weight:600; }
  .ivbt { height:9px; background:#F0ECE2; border-radius:5px; overflow:hidden; display:block; } .ivbt i { display:block; height:100%; border-radius:5px; }
  .ivsts { display:flex; gap:8px; } .ivst { flex:1; background:#F8F5EE; border-radius:6px; padding:5px 8px; display:flex; flex-direction:column; gap:1px; } .ivst b { font-family:Newsreader, Georgia, serif; font-size:21px; color:${NAVY}; font-weight:400; line-height:1.1; } .ivst span { font-size:8.8px; color:#3d4249; line-height:1.3; }
  .ivfig { border:1px solid ${HAIR}; border-radius:8px; background:#fff; padding:7px 9px 6px; display:flex; flex-direction:column; gap:5px; }
  .ivfm { background:#EFEFEA; border-radius:5px; overflow:hidden; } .ivfm svg { display:block; width:100%; height:auto; }
  .ivsrc { background:#FBFAF7; } .ivsrct { font-size:9px; line-height:1.42; color:#3d4249; }
  .ivnone { display:flex; gap:14px; align-items:center; border:1px solid ${HAIR}; border-radius:8px; background:#fff; padding:22px 24px; margin-top:20px; font-size:13px; color:${NAVY}; line-height:1.5; }
`;
const head = (title, body) => '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>' + esc(title) + "</title>" +
  '<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=Newsreader:opsz,wght@6..72,400&display=swap" rel="stylesheet"><style>' + BRIEF_KIT.CSS + EXTRA_CSS + INV_CSS + "</style></head><body>" + body + "</body></html>";
function page(C, m, sub, body, i, total) {
  const hdr = '<div style="height:96px;display:flex;align-items:center;justify-content:space-between;padding:0 46px;background:#FFFFFF;border-bottom:1px solid #E6E1D8;flex-shrink:0;"><div style="display:flex;flex-direction:column;gap:4px;max-width:560px;"><div class="lbl" style="text-transform:uppercase">' + esc(m.name) + " in " + esc(C.names.title) + " &middot; " + sub + '</div><div style="font-size:10.5px;color:' + MUTED + ';line-height:1.35;">' + C.today + " &middot; Sales settled " + esc(dateLong(m.from)) + " to " + esc(dateLong(m.to)) + " (the last 12 months)</div></div>" + BRIEF_KIT.logo(C, 70) + "</div>";
  const small = BRIEF_KIT.smallPrint(["Source: Dubai Land Department registers, " + esc(dateLong(m.asOf)) + ". Past prices only: no forecast, no promised return, not financial advice." + (total > 1 ? " &middot; Page " + (i + 1) + " of " + total : "")]);
  return '<div class="sheet page dm-body">' + hdr + '<div class="dmb" style="flex:1;display:flex;flex-direction:column;padding:14px 46px 0 46px;gap:10px;overflow:hidden;">' + body + "</div>" + BRIEF_KIT.footer(small, true) + "</div>";
}

function page1(C, m) {
  const areaName = C.names.plain, client = C.p.client ? "<b>" + esc(C.p.client) + "</b>" : '<span class="ul2"></span>';
  const title = '<div class="ivtitle"><div><div class="lbl" style="margin-bottom:3px;text-transform:uppercase">Investor summary</div><h1 class="serif" style="font-size:27px">' + esc(shortName(m.name, 34)) + " in " + esc(C.names.title) + '</h1><div class="ivprep">Prepared for ' + client + "</div></div>" + outlinePanels(C) + "</div>";
  return title + heroCards(m) + chartCard(m, areaName) + whyCards(m);
}
function page2(C, m, pic) {
  const areaName = C.names.plain;
  const cards = [readyOffCard(m), mixCard(m), liquidityCard(m), priceCard(m, areaName), deliveryCard(m), supplyCard(m, areaName)].filter(Boolean);
  const grid = '<div class="ivgrid">' + cards.join("") + "</div>";
  const picH = cards.length >= 5 ? 190 : cards.length >= 3 ? 250 : 300;
  const fig = pic ? '<div class="ivfig"><div class="ivch">' + icon("map-trifold", 17, TEAL) + '<span class="serif">' + esc(areaName) + ' in blocks</span><span class="ivcap" style="margin-left:6px;white-space:nowrap">' + esc(shortName(m.name, 24)) + " in colour by price band, other developers grey</span></div>" +
    '<div class="ivfm" style="height:' + picH + 'px">' + pic.svg + '</div><div class="mkey">' + pic.key + '</div><div class="ivcap">Each outline is raised to its height and seen from the south.</div></div>' : "";
  return grid + fig + sourcesCard(m);
}

// the page for a pair with too little on the register
function degradedPage(C, m, name) {
  return '<div class="ivtitle"><div><div class="lbl" style="margin-bottom:3px;text-transform:uppercase">Investor summary</div><h1 class="serif" style="font-size:27px">' + esc(shortName(name, 34)) + " in " + esc(C.names.title) + '</h1></div>' + outlinePanels(C) + "</div>" +
    '<div class="ivnone">' + icon("info", 30, TEAL) + "<div><b>Not enough registered sales yet for this developer in this area.</b><br>A price history is shown only where at least " + MIN_SALES + " sales in a year are on the Dubai Land Department register, and at least two such years. " + (m ? plural(m.dev.rows.reduce((q, r) => q + r.sales, 0), "sale") + " by " + esc(shortName(name, 30)) + " are recorded here so far." : "") + " The whole-area figures are in the Developers by area summary.</div></div>";
}

// ------------------------------------------------------------------------------------------------ the document
export async function buildInvestorPdf(env, p, opts) {
  if (!p.developer) return { status: 400, body: { ok: false, reason: "developer is needed for kind=investor (a developer id from the developers index)" } };
  const L = await loadData(env, p, opts);
  if (L.status !== 200) return L;
  const C = L.C, k = resolveDeveloper(C.IDX0.areas[p.area], p.developer);
  if (!k) return { status: 404, body: { ok: false, reason: "developer not in this area of the developers index", area: p.area, developer: p.developer } };
  const deliv = await kvJson(env, "devmap_delivery");
  const m = investorModel(C.IDX0, p.area, k, deliv);
  const pages = [];
  if (!m.enough) pages.push(page(C, m, "Investor summary", degradedPage(C, m, m.name), 0, 1));
  else {
    const M = await loadMapData(env, C); C.M = M;
    const pic = blocksPicture(C, M, 702, 300, "fit", k);
    pages.push(page(C, m, "Page 1 &middot; the headline case", page1(C, m), 0, 2));
    pages.push(page(C, m, "Page 2 &middot; the supporting figures", page2(C, m, pic), 1, 2));
  }
  const nm = (m.name + "_" + C.names.plain).replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return { status: 200, html: head("Investor summary - " + m.name + " in " + C.names.plain, pages.join("")), pages: pages.length, fname: "Investor_" + nm + ".pdf", C, model: m };
}
