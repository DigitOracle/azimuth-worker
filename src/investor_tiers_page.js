// v376 - the tiered investor report: the A4 pages, the selector page and the route builders. Logic is in src/investor_tiers.js (pure); this file only draws.
//   GET /developers_pdf?kind=investor_selector&project=<id>&key=...&format=html     the selector (investor type -> tier -> segment cards -> Generate)
//   GET /developers_pdf?kind=investor_tiers&project=<id>&type=<preset>&tier=<summary|standard|full>&segs=a,b,c&client=<name>&key=...      the PDF
//        &format=html shows the document; &format=audit returns the audit record as JSON (the sidecar). The audit record is also in the document's meta tags and the X-Investor-Audit header.
// The facts for a project are read from KV key "investor_tiers_facts" (read only here; nothing in this file writes KV).
import { kvJson } from "./brief.js";
import { BRIEF_KIT, esc } from "./brief_docs.js";
import { icon, EXTRA_CSS, pack } from "./devmap_pdf.js";
import { buildPlan, SEGMENTS, PRESETS, TIERS, CORE_IDS, LABEL_TEXT, CANNOT_TELL, THRESHOLDS, ORDER_FLAGS, RULE_CARDS, validRuleCard, validAssignmentCard, dateLong, fmt, aed, bedsWord, lintText } from "./investor_tiers.js";

const { NAVY, MUTED } = BRIEF_KIT;
const TEAL = "#0A4F4A", GOLD = "#C5A56A", INK = "#22262B", HAIR = "#E6E1D8";
const FONT = "IBM Plex Sans, Segoe UI, Arial, sans-serif";
const TIER_TITLE = { summary: "Summary", standard: "Standard", full: "Full evidence" };

export function parseInvestorParams(sp) {
  const clean = (s, n) => String(s || "").toLowerCase().replace(/[^a-z0-9_-]+/g, "").slice(0, n);
  const segs = sp.get("segs") == null ? null : String(sp.get("segs")).split(",").map((s) => clean(s, 40)).filter(Boolean).slice(0, 40);
  const flags = sp.get("flags") == null ? [] : String(sp.get("flags")).split(",").map((x) => clean(x, 30)).filter(Boolean).slice(0, 10);
  return { project: clean(sp.get("project"), 60), type: clean(sp.get("type"), 30), tier: clean(sp.get("tier"), 12), segs, flags, lang: clean(sp.get("lang"), 5) || "en" };
}

// ---------------------------------------------------------------------------------------------------------- segment content (facts -> words and figures)
const hero = (k, v, s) => '<div class="ivhero"><div class="tk">' + esc(k) + '</div><div class="ivhv">' + v + '</div><div class="ivhs">' + String(s).replace(/&(?!(middot|ndash|amp|lt|gt|quot|#\d+);)/g, "&amp;").replace(/</g, "&lt;") + "</div></div>";
function bars(rows, W, H, valOf, labOf, subOf, greyIf) {
  const mx = Math.max(...rows.map(valOf), 1), n = rows.length, bw = Math.min(46, (W - 8) / n - 8), gap = (W - 8 - bw * n) / Math.max(1, n - 1);
  let s = '<svg viewBox="0 0 ' + W + " " + H + '" width="100%" role="img" aria-label="Bars by year" font-family="' + FONT + '">';
  rows.forEach((r, i) => {
    const x = 4 + i * (bw + gap), h = Math.max(2, (H - 44) * valOf(r) / mx), y = H - 28 - h;
    s += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="2" fill="' + (greyIf && greyIf(r) ? "#B9C4C1" : TEAL) + '"/>' +
      '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (y - 3).toFixed(1) + '" font-size="9" fill="' + INK + '" text-anchor="middle">' + fmt(valOf(r)) + "</text>" +
      '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 15) + '" font-size="9.4" font-weight="600" fill="' + INK + '" text-anchor="middle">' + labOf(r) + "</text>" +
      '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 4) + '" font-size="8.2" fill="' + MUTED + '" text-anchor="middle">' + subOf(r) + "</text>";
  });
  return s + "</svg>";
}
const table = (head, rows) => '<table class="tb ivtb"><thead><tr>' + head.map((h, i) => "<th" + (i ? ' class="r"' : "") + ">" + esc(h) + "</th>").join("") + "</tr></thead><tbody>" +
  rows.map((r) => "<tr>" + r.map((c, i) => "<td" + (i ? ' class="r"' : "") + ">" + esc(c) + "</td>").join("") + "</tr>").join("") + "</tbody></table>";
const partYear = (f) => { const a = String(f.as_of.sales || ""); return /-12-31$/.test(a) ? null : Number(a.slice(0, 4)); };

function unitRegister(f) {
  const U = f.unit_register; if (!U) return {};
  const pc = (n, t) => Math.round(n / t * 100) + "%", one = (x) => [x.name + " (project " + x.project_number + ")", fmt(x.units), fmt(x.b1) + " (" + pc(x.b1, x.units) + ")", fmt(x.b2) + " (" + pc(x.b2, x.units) + ")", fmt(x.b3) + " (" + pc(x.b3, x.units) + ")", fmt(x.studio)];
  const a = U.phase1, b = U.phase2, t = { name: "Both projects", project_number: a.project_number + " and " + b.project_number, units: a.units + b.units, b1: a.b1 + b.b1, b2: a.b2 + b.b2, b3: a.b3 + b.b3, studio: 0 };
  const sentence = " Unit register: " + a.name + " has " + fmt(a.units) + " registered units, " + fmt(a.b1) + " one-bedroom (" + pc(a.b1, a.units) + "), " + fmt(a.b2) + " two-bedroom (" + pc(a.b2, a.units) + "), " + fmt(a.b3) + " three-bedroom (" + pc(a.b3, a.units) + "); " + b.name + " has " + fmt(b.units) + " units: " + fmt(b.b1) + ", " + fmt(b.b2) + " and " + fmt(b.b3) + "; no studios are registered. Units left for sale: " + U.left_for_sale.replace(/^not known: /, "not known, because ") + ".";
  return { regStory: sentence, regTable: table(["Project (Dubai Land Department unit register)", "Units", "1 bedroom", "2 bedrooms", "3 bedrooms", "Studios"], [one(a), one(b), one(t)]), regFlags: ["Units left for sale: " + U.left_for_sale + ".", U.unreconciled], regSource: U.source };
}
export function segmentContent(id, f, th) {
  const py = partYear(f), area = f.project.area, X = f.sales || {};
  switch (id) {
    case "market_history": {
      const rows = f.market.area_by_year, d = f.market.dubai_by_year || [], find = (y) => rows.find((r) => r.year === y);
      const a20 = find(2020), a21 = find(2021), last = rows[rows.length - 1];
      let story = "Registered sales in " + area + " by year: " + rows.map((r) => (r.year === py ? r.year + " so far" : r.year) + ", " + fmt(r.n)).join("; ") + ".";
      if (a20 && a21) story += " For example, this is what was registered in 2020 and 2021: " + fmt(a20.n) + " and " + fmt(a21.n) + " sales.";
      story += " These are dated registered numbers; this report gives no reason for any change.";
      return { story, figs: [hero("Registered sales, " + last.year + (last.year === py ? " so far" : ""), fmt(last.n), area + " &middot; median " + aed(last.psf) + " per sq ft"), hero("Years on the register", fmt(rows.length), rows[0].year + " to " + last.year + " &middot; years with sales only")],
        chart: bars(rows, 678, 150, (r) => r.n, (r) => r.year + (r.year === py ? "*" : ""), (r) => (r.n < th.period_min_sales ? "under " + th.period_min_sales : "sales"), (r) => r.n < th.period_min_sales),
        table: table(["Year", area + ": sales", "Median AED per sq ft", "Dubai: sales", "Dubai: median AED per sq ft"], rows.map((r) => { const dd = d.find((x) => x.year === r.year); return [String(r.year) + (r.year === py ? " (part year)" : ""), fmt(r.n), r.n >= th.period_min_sales ? fmt(r.psf) : "under " + th.period_min_sales + " sales", dd ? fmt(dd.n) : "", dd ? fmt(dd.psf) : ""]; })),
        method: "Each row is the unit sales (not land) settled in that year on the Dubai Land Department register; the price is the median per sq ft. A grey bar means fewer than " + th.period_min_sales + " sales. A star marks a part year." };
    }
    case "comparables": {
      const c = f.comparables, ps = c.map((x) => x.psf).sort((a, b) => a - b), mid = ps[Math.floor(ps.length / 2)];
      return { story: fmt(c.length) + " other off-plan projects in " + area + " each had " + th.period_min_sales + " or more registered sales in the last 12 months. Their median price per sq ft runs from " + aed(ps[0]) + " to " + aed(ps[ps.length - 1]) + "; the middle one is " + aed(mid) + ". This project: " + aed(X.l12_median_psf) + ".",
        figs: [hero("This project, 12 months", aed(X.l12_median_psf), "per sq ft &middot; " + fmt(X.l12) + " sales"), hero("Middle of " + c.length + " comparables", aed(mid), "per sq ft &middot; range " + fmt(ps[0]) + " to " + fmt(ps[ps.length - 1]))],
        table: table(["Project (as named on the register)", "Sales, 12 months", "Median AED per sq ft"], c.map((x) => [x.name, fmt(x.n), fmt(x.psf)])),
        method: "Comparable means: same registered area, off-plan unit sales, " + th.period_min_sales + " or more in the 12 months to " + dateLong(f.window.to) + ". Projects are named as on the register; this table does not say who built them." };
    }
    case "yield_rent": {
      const r = f.rents;
      return { story: "Registered rent contracts for this project: " + fmt(r.project_contracts) + (r.yield_rate != null ? ". They point to a gross yield near " + (Math.round(r.yield_rate * 1000) / 10).toFixed(1) + "%, before service charges, fees and empty months." : "."),
        figs: [hero("Rent contracts behind it", fmt(r.project_contracts), "this project &middot; to " + dateLong(f.as_of.sales)), hero("Gross yield", r.yield_rate != null ? (Math.round(r.yield_rate * 1000) / 10).toFixed(1) + "%" : "&ndash;", "gross, before fees and empty months")],
        method: "Gross yield is a year's registered rent as a share of the registered price of the same size of home. It needs " + th.yield_min_contracts + " or more rent contracts for this project. It describes past contracts only." };
    }
    case "area_story": {
      const n = f.neighbourhood;
      return { story: "Nearest places recorded on the sales register for this project, in a straight line (not travel time): " + n.map((x) => x.label.toLowerCase().replace("nearest ", "") + " " + x.value).join("; ") + ".", figs: n.map((x) => hero(x.label, esc(x.value), "straight line, as recorded")),
        method: "Source: " + n[0].source + ". Schools, clinics and travel times are not held for this project, so none are shown." };
    }
    case "city_context": {
      const c = f.city;
      return { story: "In the 12 months to " + dateLong(f.window.to) + " the register shows " + fmt(c.l12_sales) + " unit sales in Dubai at a median " + aed(c.l12_psf) + " per sq ft, " + Math.round(c.offplan_share * 100) + "% of them off-plan. In " + area + ": " + fmt(c.area_l12_sales) + " sales at " + aed(c.area_l12_psf) + ".",
        figs: [hero("Dubai, 12 months", fmt(c.l12_sales), "unit sales &middot; median " + aed(c.l12_psf) + " per sq ft"), hero(area + ", 12 months", fmt(c.area_l12_sales), "unit sales &middot; median " + aed(c.area_l12_psf) + " per sq ft")], method: "Unit sales (land excluded) on the Dubai Land Department register, " + dateLong(f.window.from) + " to " + dateLong(f.window.to) + "." };
    }
    case "price_charts": {
      const rows = (X.by_year || []);
      return { story: "Median price per sq ft of this project's registered sales: " + rows.map((r) => (r.year === py ? r.year + " so far, to " + dateLong(f.as_of.sales) : r.year) + " " + aed(r.psf) + " (" + fmt(r.n) + " sales)").join("; ") + ".",
        figs: rows.map((r) => hero("Median per sq ft, " + r.year + (r.year === py ? " so far" : ""), aed(r.psf), fmt(r.n) + " sales")),
        chart: bars(rows, 678, 150, (r) => r.psf, (r) => r.year + (r.year === py ? "*" : ""), (r) => fmt(r.n) + " sales", (r) => r.n < th.period_min_sales),
        method: "Each figure is the median price per sq ft of the homes sold that year. A year needs " + th.period_min_sales + " or more sales to be shown. A star marks a part year." };
    }
    case "developer_detail": {
      const D = f.developer, e = f.delivery.entity, b = f.delivery.brand_family;
      return { story: D.legal_entity + " was registered on " + dateLong(D.registered) + " and holds " + fmt(e.projects) + " registered projects, none handed over. The " + D.brand + " name across other registered companies: " + fmt(b.registered_finished) + " of " + fmt(b.past_planned_end) + " projects past their planned end are registered as handed over (matched by company name).",
        figs: [hero("Registered company", fmt(e.projects) + " projects", "none handed over &middot; register"), hero(D.brand + " name, all companies", fmt(b.registered_finished) + " of " + fmt(b.past_planned_end), "handed over, past planned end &middot; by name")],
        method: "The first figure is from the project register by developer id. The second joins every registered company whose name starts with " + D.brand + "; that is a name rule, not a register link, and the register records status, not early or late." };
    }
    case "amenities": return { story: "What the developer says is included (not on the register): " + f.amenities.join("; ") + ".", figs: [], method: "Developer says. Nothing here is confirmed by the Dubai Land Department register." };
    case "demand_momentum": {
      return { story: "Registered sales in the last 12 months: " + fmt(X.l12) + ", above the " + th.strong_sales_min_l12 + " this report needs before it describes sales as strong. In all: " + fmt(X.all_time) + " since " + dateLong(X.first) + ".",
        figs: [hero("Sales, 12 months", fmt(X.l12), dateLong(f.window.from) + " to " + dateLong(f.window.to)), hero("Sales so far", fmt(X.all_time), "since " + dateLong(X.first))], method: "Registered sales only; a home sold twice counts twice." };
    }
    case "delivery_progress": {
      const S = f.status;
      return { story: "Register status: " + S.text.toLowerCase() + ", " + Math.round(S.percent) + "% complete. Planned end " + dateLong(S.planned_end) + ". " + fmt(S.units) + " homes in " + fmt(S.buildings) + " buildings" + (S.zoning ? "; planning authority " + S.zoning : "") + ".",
        figs: [hero("Status", esc(S.text), Math.round(S.percent) + "% complete"), hero("Planned end", dateLong(S.planned_end), "register date, not a promise")], method: "Source: " + S.source + ", data to " + dateLong(f.as_of.register) + ". The register records status and dates; it does not say whether a project is early or late." };
    }
    case "unit_mix_prices": {
      const b = X.by_beds, tot = b.reduce((q, r) => q + r.n, 0);
      return { story: "Registered off-plan sales by size: " + b.map((r) => fmt(r.n) + " " + bedsWord(r.beds) + " (median " + aed(r.median_price) + ")").join("; ") + ".",
        figs: b.map((r) => hero(bedsWord(r.beds), aed(r.median_price), fmt(r.n) + " sales &middot; " + Math.round(r.n / tot * 100) + "%")),
        table: table(["Home", "Sales", "Typical size, sq ft", "Median price, AED", "Median AED per sq ft"], b.map((r) => [bedsWord(r.beds), fmt(r.n), fmt(r.sqft), fmt(r.median_price), fmt(r.psf)])),
        method: "Registered sales to " + dateLong(f.as_of.sales) + ". These are the homes sold so far, not the full list of homes in the project; a developer's price list must be asked for.", ...unitRegister(f) };
    }
    case "buyer_protections": {
      const S = f.status, D = f.developer;
      return { story: "The project is on the Dubai Land Department register as project " + f.project.project_number + ", status " + S.text.toLowerCase() + ". Escrow bank named on the register: " + (S.escrow ? S.escrow.replace(/\s*\(PUBLIC JOINT STOCK COMPANY\)/i, "") : "none named") + ". Registered developer: " + D.legal_entity + " (" + LABEL_TEXT[D.evidence] + ").",
        figs: [hero("Register project number", fmt(f.project.project_number), esc(S.source)), hero("Escrow bank", esc(S.escrow ? S.escrow.replace(/\s*\(PUBLIC JOINT STOCK COMPANY\)/i, "") : "none named"), "named on the register"), hero("Registered developer", esc(D.legal_entity), LABEL_TEXT[D.evidence])],
        table: table(["Check", "What the register shows"], [["Project registered", "Project " + f.project.project_number + ", status " + S.text.toLowerCase() + ", " + Math.round(S.percent) + "% complete"], ["Escrow bank", S.escrow ? S.escrow.replace(/\s*\(PUBLIC JOINT STOCK COMPANY\)/i, "") : "none named"], ["Registered developer", D.legal_entity + " (" + (D.evidence) + ")"], ["Developer brochure compared with the register", f.amenities ? "see Amenities" : "no brochure on file, so no comparison can be made"]]),
        method: "The register names the escrow bank; it does not show what the escrow account holds or how payments are released. Read the sales contract for that." };
    }
    case "residency_rule": {
      const card = (f.rule_cards && f.rule_cards.golden_visa) || RULE_CARDS.golden_visa, b = X.by_beds || [];
      const prices = b.length ? "Registered prices in this project, by size: " + b.map((r) => bedsWord(r.beds) + " median " + aed(r.median_price)).join("; ") + "." : "";
      if (validRuleCard(card)) {
        return { story: "Official rule as dated " + dateLong(card.as_of) + " (" + card.source + "): " + card.text + " " + prices + " Median prices compared with the rule's threshold of " + aed(card.threshold_aed) + ": " + b.map((r) => bedsWord(r.beds) + " " + (r.median_price >= card.threshold_aed ? "at or above" : "below")).join("; ") + ". This compares a price with a rule. It does not say that any purchase qualifies; the authority decides.", figs: [hero("Rule card dated", dateLong(card.as_of), esc(card.source))], method: "The rule text is copied from the dated card in the report's settings. Check the official service before acting." };
      }
      return { story: "No dated official rule card is on file, so this report states no residency rule, threshold or eligibility. " + prices, figs: [], method: "Whether any purchase qualifies for residency is decided by the authority. Ask the official service." };
    }
    case "payment_plan_cash": {
      const pl = f.price_plan.payment_plan, price = X.median_price, before = pl.milestones.filter((m) => m.before_handover).reduce((q, m) => q + m.pct, 0);
      return { story: "Payment plan (developer says): " + pl.text + ". Share of the price due before handover on that plan: " + before + "%, about " + aed(price * before / 100) + " at the median registered price of " + aed(price) + ". Fees are extra.",
        figs: [hero("Cash before handover", aed(price * before / 100), before + "% of the median price &middot; developer's plan"), hero("Median registered price", aed(price), "all sales to " + dateLong(f.as_of.sales))],
        table: table(["Milestone (developer says)", "Share of price", "Before handover"], pl.milestones.map((m) => [m.label, m.pct + "%", m.before_handover ? "yes" : "no"])), method: "Derived: the developer's plan applied to the median registered price. The plan comes from the developer, not the register." };
    }
    case "resale_activity": {
      const R = f.resales, d = R.district_window;
      const strong = R.separable && R.resale_l12 >= th.strong_sales_min_l12;
      return { story: "Registered sale rows for this project: " + fmt(R.project_rows) + ", all recorded as 'Sell - Pre registration'; rows under a resale procedure: " + fmt(R.project_resale_procedure_rows) + ". " + (R.separable ? "" : "The register does not separate a first sale from a resale: " + R.reason + ". No resale count is known. ") + "In the district in the 12 months to " + dateLong(d.to) + ": " + fmt(d.pre_registration) + " off-plan sale rows and " + fmt(d.existing_property_sell) + " sales of completed homes." + (strong ? " Registered resales are above the " + th.strong_sales_min_l12 + " this report needs before it calls resale strong." : ""),
        figs: [hero("Rows, this project", fmt(R.project_rows), "off-plan sale rows to " + dateLong(f.as_of.sales)), hero("Rows under a resale procedure", fmt(R.project_resale_procedure_rows), "this project")],
        chart: bars(R.project_by_month, 678, 150, (r) => r.n, (r) => r.month.slice(5) + "/" + r.month.slice(2, 4), () => "rows", null),
        method: "Sale rows per month for this project from the Dubai Land Department sales register (units only). Month labels are month and year." };
    }
    case "resale_conditions": {
      const card = (f.rule_cards && f.rule_cards.assignment) || RULE_CARDS.assignment;
      if (validAssignmentCard(card)) return { story: "Official rule as dated " + dateLong(card.as_of) + " (" + card.source + "): " + card.text + " Conditions can differ by developer; confirm them with the developer and the Dubai Land Department.", figs: [hero("Rule card dated", dateLong(card.as_of), esc(card.source))], method: "Copied from the dated card in the report's settings." };
      return { story: "The conditions for selling a home before handover differ by developer and must be confirmed with the developer and the Dubai Land Department. No dated official rule card is on file, so this report states no rule, minimum-paid threshold, fee or no-objection requirement.", figs: [], method: "Ask the developer for the contract terms in writing." };
    }
    case "supply_nearby": {
      const a = f.supply.ACTIVE || { projects: 0, homes: 0 }, n = f.supply.NOT_STARTED || { projects: 0, homes: 0 };
      return { story: "On the project register for " + area + ": " + fmt(a.homes) + " homes in " + fmt(a.projects) + " projects under construction and " + fmt(n.homes) + " homes in " + fmt(n.projects) + " projects not started, all developers.",
        figs: [hero("Under construction", fmt(a.homes), fmt(a.projects) + " projects"), hero("Not started", fmt(n.homes), fmt(n.projects) + " projects")], method: "Registered homes, not a forecast of sales. Project register data to " + dateLong(f.as_of.register) + "." };
    }
  }
  return { story: "", figs: [], method: "" };
}

// ---------------------------------------------------------------------------------------------------------- blocks
const CSS = `
  .ivtitle h1 { margin:0; font-size:26px; font-weight:400; color:${NAVY}; } .ivprep { margin-top:6px; font-size:11px; color:${INK}; }
  .ivbadges { display:flex; gap:8px; margin-top:8px; } .ivbadge { border:1px solid ${GOLD}; border-radius:12px; padding:2px 10px; font-size:10px; color:${NAVY}; background:#fff; }
  .ivc { border:1px solid ${HAIR}; border-radius:8px; background:#fff; padding:8px 12px 9px; display:flex; flex-direction:column; gap:5px; min-width:0; }
  .ivc.core { border-left:4px solid ${TEAL}; } .ivch { display:flex; gap:7px; align-items:center; font-size:14.5px; color:${NAVY}; } .ivch .chip { margin-left:auto; font-size:8.6px; letter-spacing:.4px; text-transform:uppercase; color:${TEAL}; border:1px solid ${TEAL}; border-radius:9px; padding:0 7px; white-space:nowrap; }
  .ivp { margin:0; font-size:10.6px; line-height:1.42; color:#33383e; } .ivlab { font-size:9.4px; color:${MUTED}; line-height:1.35; }
  .ivheroes { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:8px; } .ivhero { border:1px solid ${HAIR}; border-top:3px solid ${GOLD}; background:#fff; padding:5px 9px; min-width:0; }
  .ivhero .tk { font-size:8.4px; letter-spacing:1px; text-transform:uppercase; color:${MUTED}; font-weight:600; } .ivhv { font-family:Newsreader, Georgia, serif; font-size:20px; color:${NAVY}; line-height:1.15; } .ivhs { font-size:9.2px; color:${MUTED}; line-height:1.3; }
  .ivnote { border-left:3px solid #B5651D; background:#FBF3E8; padding:5px 9px; font-size:10px; line-height:1.4; color:#4a3a22; } .ivnote b { color:#7a3f00; }
  table.ivtb { width:100%; border-collapse:collapse; font-size:9.6px; } table.ivtb th { text-align:left; font-size:8.4px; color:${MUTED}; padding:3px 5px; border-bottom:1px solid ${GOLD}; } table.ivtb td { padding:2.5px 5px; border-bottom:1px solid ${HAIR}; } table.ivtb .r, table.ivtb th.r { text-align:right; }
  .ivcov { border:1px solid ${GOLD}; background:#FBFAF3; border-radius:8px; padding:8px 12px; font-size:10.4px; line-height:1.45; color:${INK}; }
  .ivkg { display:grid; grid-template-columns:1fr 1fr; gap:6px 10px; } .ivk { display:flex; gap:8px; align-items:flex-start; border:1px solid ${HAIR}; border-radius:6px; background:#fff; padding:6px 9px; } .ivk b { color:${NAVY}; font-size:11px; } .ivk p { margin:1px 0 0; font-size:9.8px; line-height:1.38; color:#3d4249; }
`;
const estLines = (t, per) => Math.max(1, Math.ceil(String(t).length / (per || 120)));
function coreBlock(it) {
  const body = it.lines.map((l) => '<p class="ivp">' + esc(l) + "</p>").join("");
  const h = 40 + it.lines.reduce((q, l) => q + estLines(l) * 15.2 + 3, 0);
  return { sub: "Report", h, keep: false, html: '<div class="ivc core"><div class="ivch">' + icon(it.icon, 17, TEAL) + '<span class="serif">' + esc(it.title) + '</span><span class="chip">Always included</span></div>' + body +
    '<div class="ivlab">Evidence: ' + esc(it.known ? LABEL_TEXT[it.label] : "not known; the reason is stated above") + "</div></div>" };
}
function segBlocks(row, f, tier0) {
  const tier = row.depth || tier0;
  const c = segmentContent(row.id, f, THRESHOLDS);
  const notes = row.notes.map((n) => '<div class="ivnote"><b>Beside this:</b> ' + esc(n) + "</div>").join("");
  const ev = '<div class="ivlab">Evidence: ' + esc(row.evidence) + "</div>";
  let body = "", h = 44;
  if (c.regStory) c.story += c.regStory;
  if (tier === "summary") { body = '<p class="ivp">' + esc(c.story) + "</p>"; h += estLines(c.story) * 15.2; }
  else {
    if (c.figs.length) { body += '<div class="ivheroes">' + c.figs.join("") + "</div>"; h += 62 * Math.ceil(c.figs.length / 4); }
    if (c.chart) { body += c.chart; h += 150; }
    body += '<p class="ivp">' + esc(c.story) + "</p>"; h += estLines(c.story) * 15.2;
    if (c.regTable) { body += c.regTable + '<div class="ivlab">Source: ' + esc(c.regSource) + "</div>"; h += 100; }
    if (tier === "full" || row.id === "buyer_protections") {
      if (c.table) { body += c.table; h += 22 + (c.table.match(/<tr>/g) || []).length * 17; }
      if (c.method) { body += '<div class="ivlab">Method: ' + esc(c.method) + "</div>"; h += estLines(c.method, 120) * 13; }
    }
  }
  if (c.regFlags) { body += c.regFlags.map((n) => '<div class="ivnote"><b>Please note:</b> ' + esc(n) + "</div>").join(""); h += c.regFlags.reduce((q, n) => q + estLines(n, 110) * 14 + 12, 0); }
  body += notes; h += row.notes.reduce((q, n) => q + estLines(n, 110) * 14 + 12, 0) + 22;
  return { sub: "Report", h, html: '<div class="ivc"><div class="ivch">' + icon(row.icon, 17, TEAL) + '<span class="serif">' + esc(row.title) + "</span></div>" + body + ev + "</div>" };
}
function lastPage(plan, f) {
  const kn = '<div class="ivc core"><div class="ivch">' + icon("info", 17, TEAL) + '<span class="serif">What this report cannot tell you</span><span class="chip">Always included</span></div><div class="ivkg">' +
    CANNOT_TELL.map((k) => '<div class="ivk"><div><b>' + esc(k[0]) + "</b><p>" + esc(k[1]) + "</p></div></div>").join("") + "</div></div>";
  const cov = '<div class="ivcov"><b>' + esc(plan.coverage.split(". Not covered:")[0]) + ".</b> " + esc("Not covered:" + plan.coverage.split(". Not covered:")[1]) + "</div>";
  const aud = '<div class="ivc"><div class="ivlab"><b>Record of this version.</b> Investor type: ' + esc(plan.type || "none chosen") + ". Tier: " + esc(TIER_TITLE[plan.tier]) + ". Sales data to " + esc(dateLong(f.as_of.sales)) + "; project register to " + esc(dateLong(f.as_of.register)) + ". Built " + esc(dateLong(f.as_of.built)) + ". The full record, with every check result, is kept with this file." +
    " This report describes past registered facts only. It is not investment, financial, legal or tax advice, not an offer and not a forecast.</div></div>";
  return { sub: "Last page", alone: true, h: 800, html: kn + cov + aud };
}
const head = (title, meta, body) => '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>' + esc(title) + "</title>" + meta +
  '<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=Newsreader:opsz,wght@6..72,400&display=swap" rel="stylesheet"><style>' + BRIEF_KIT.CSS + EXTRA_CSS + CSS + "</style></head><body>" + body + "</body></html>";

export function buildTiersHtml(facts, plan, opts) {
  const o = opts || {}, C = { logo: o.logo || null, today: o.today || dateLong(facts.as_of.built) };
  const title = '<div class="ivtitle"><div class="lbl" style="margin-bottom:3px;text-transform:uppercase">Investor report</div><h1 class="serif">' + esc(facts.project.name) + " in " + esc(facts.project.area) + '</h1><div class="ivprep">Prepared for ' + (o.client ? "<b>" + esc(o.client) + "</b>" : "the reader of this report") + '</div><div class="ivbadges"><span class="ivbadge">' + esc(TIER_TITLE[plan.tier]) + "</span>" + (plan.draft ? '<span class="ivbadge" style="border-color:#B5651D;color:#7a3f00">Draft, awaiting official check</span>' : "") + (plan.type ? '<span class="ivbadge">' + esc((PRESETS.find((p) => p.id === plan.type) || {}).title || plan.type) + "</span>" : "") + "</div></div>";
  const blocks = [{ sub: "Report", h: 96 + (plan.draft ? 52 : 0), html: title + (plan.draft ? '<div class="ivnote" style="margin-top:8px"><b>Draft, awaiting official check before client use.</b> ' + esc(plan.draft) + "</div>" : "") }];
  for (const it of plan.core) blocks.push(coreBlock(it));
  for (const r of plan.included) blocks.push(segBlocks(r, facts, plan.tier));
  if (plan.stats && plan.stats.length) blocks.push({ sub: "Report", h: 50 + plan.stats.reduce((q, t) => q + estLines(t.figure, 100) * 14 + 24, 0), html: '<div class="ivc"><div class="ivch">' + icon("chart-bar", 17, TEAL) + '<span class="serif">Published figures, with their sources</span></div>' + plan.stats.map((t) => '<p class="ivp">' + esc(t.figure) + '<br><span class="ivlab">Source: ' + esc(t.source) + ". Date: " + esc(t.date) + ". Basis: " + esc(t.basis) + ".</span></p>").join("") + "</div>" });
  if (plan.orderFlags && plan.orderFlags.length) blocks.push({ sub: "Report", h: 70, html: plan.orderFlags.map((o) => '<div class="ivnote"><b>' + esc(o.title) + ":</b> " + esc(o.note) + "</div>").join("") });
  blocks.push(lastPage(plan, facts));
  const pages = pack(blocks);
  const hdr = (i) => '<div style="height:96px;display:flex;align-items:center;justify-content:space-between;padding:0 46px;background:#FFFFFF;border-bottom:1px solid #E6E1D8;flex-shrink:0;"><div style="display:flex;flex-direction:column;gap:4px;max-width:560px;"><div class="lbl" style="text-transform:uppercase">' + esc(facts.project.name) + " in " + esc(facts.project.area) + " &middot; " + esc(TIER_TITLE[plan.tier]) + '</div><div style="font-size:10.5px;color:' + MUTED + ';">' + esc(C.today) + " &middot; Sales and register data as dated on each line</div></div>" + BRIEF_KIT.logo(C, 70) + "</div>";
  const html = pages.map((pg, i) => '<div class="sheet page dm-body">' + hdr(i) + '<div class="dmb" style="flex:1;display:flex;flex-direction:column;padding:14px 46px 0 46px;gap:10px;overflow:hidden;">' + pg.html + "</div>" +
    BRIEF_KIT.footer(BRIEF_KIT.smallPrint(["Source: Dubai Land Department registers, as dated on each line. Past registered facts only: no forecast, no promised return, not advice. &middot; Page " + (i + 1) + " of " + pages.length]), true) + "</div>").join("");
  const meta = '<meta name="description" content="' + esc(plan.coverage) + '"><meta name="investor-audit" content="' + esc(JSON.stringify(plan.audit)) + '">';
  const dbg = o.debugOverflow ? "<script>addEventListener('load',function(){var r=[];document.querySelectorAll('.dmb').forEach(function(e,i){r.push(e.scrollHeight>e.clientHeight+1?('page '+(i+1)+' overflow '+(e.scrollHeight-e.clientHeight)):('page '+(i+1)+' ok'))});document.body.setAttribute('data-overflow',r.join(' | '))})</script>" : "";
  const doc = head("Investor report - " + facts.project.name + " - " + TIER_TITLE[plan.tier], meta, html + dbg);
  const text = doc.replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<meta[^>]*>/g, " ").replace(/<svg[\s\S]*?<\/svg>/g, " ").replace(/<[^>]+>/g, " ");
  const lint = lintText(text);
  return { html: doc, pages: pages.length, lint, text };
}

// ---------------------------------------------------------------------------------------------------------- the selector (investor type -> tier -> segment cards -> Generate)
export function selectorHtml(facts, base, key) {
  const plan0 = buildPlan({ facts, type: null, tier: "standard", segments: [] });
  const data = { segments: plan0.segments.map((r) => ({ id: r.id, title: r.title, icon: r.icon, evidence: r.evidence, status: r.status, reasons: r.reasons, notes: r.notes })), presets: PRESETS.map((p) => ({ id: p.id, group: p.group, title: p.title, blurb: p.blurb, tier: p.tier, segments: p.segments, draft: p.status === "draft" ? p.needs_check : "" })), flags: ORDER_FLAGS,
    core: plan0.core.map((c) => ({ title: c.title, known: c.known, first: c.lines[0] })), tiers: TIERS.map((t) => ({ id: t, title: TIER_TITLE[t] })), base: base || "/developers_pdf", project: facts.project.id, key: key || "" };
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  const ico = (n) => icon(n, 20, TEAL);
  const icons = JSON.stringify(Object.fromEntries(SEGMENTS.map((s) => [s.icon, ico(s.icon)]).concat([["x", icon("x", 18, "#8A3B12")], ["info", icon("info", 18, TEAL)]]))).replace(/</g, "\\u003c");
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Investor report: choose the version</title><style>' +
    ':root{--teal:#0A4F4A;--gold:#C5A56A;--ink:#22262B;--hair:#E6E1D8;--bg:#FBFAF7;--warn:#B5651D}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:"IBM Plex Sans","Segoe UI",Arial,sans-serif;font-size:14px;line-height:1.4}' +
    "main{max-width:760px;margin:0 auto;padding:16px}h1{font-family:Newsreader,Georgia,serif;font-weight:400;font-size:24px;margin:4px 0 2px;color:#17283F}h2{font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#A8814A;margin:20px 0 8px}" +
    ".grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}.card{border:1px solid var(--hair);background:#fff;border-radius:10px;padding:10px;min-width:0;text-align:left;font:inherit;color:inherit}button.card{cursor:pointer}.card[aria-pressed=true]{border-color:var(--teal);box-shadow:inset 0 0 0 1px var(--teal)}" +
    ".card b{display:block;font-size:13px;color:#17283F}.card small{display:block;color:#5b6168;font-size:11.5px;margin-top:2px}.core{border-left:4px solid var(--teal)}.tag{display:inline-block;font-size:10px;border-radius:8px;padding:0 7px;margin-top:5px;border:1px solid var(--teal);color:var(--teal)}" +
    ".blocked{background:#F6F2EC;border-color:#D9B99B}.blocked .tag{border-color:#8A3B12;color:#8A3B12}.note{border-left:3px solid var(--warn);background:#FBF3E8;font-size:11.5px;padding:4px 8px;margin-top:6px}" +
    ".seg{display:flex;gap:8px;align-items:flex-start}.seg input{margin-top:3px;width:18px;height:18px}.go{display:block;width:100%;margin-top:18px;padding:14px;border-radius:10px;background:var(--teal);color:#fff;text-align:center;text-decoration:none;font-weight:600}.sm{font-size:11.5px;color:#5b6168}" +
    "</style></head><body><main><h1>Investor report: choose the version</h1><div class=sm>" + esc(facts.project.name) + " in " + esc(facts.project.area) + ". Sales data to " + esc(dateLong(facts.as_of.sales)) + ". Chosen before the report is made.</div>" +
    '<h2>1. Who is it for</h2><div class=grid id=types></div><h2>2. How deep</h2><div class=grid id=tiers></div><h2>3. Segments, checked against this project\'s own evidence</h2><div class=grid id=segs></div>' +
    '<h2>Order notes (optional)</h2><div class=grid id=flags></div><h2>Always included, in every version</h2><div class=grid id=core></div><a class=go id=go href="#">Generate the report</a><p class=sm id=covers></p></main><script>var D=' + json + ",I=" + icons + ";" +
    "var st={type:'',tier:'standard',on:{},fl:{}};function E(s){return String(s==null?'':s).replace(/[&<>\"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]})}" +
    "function setPreset(id){var p=D.presets.filter(function(x){return x.id==id})[0];st.type=id;st.tier=p.tier;st.on={};p.segments.forEach(function(s){st.on[s]=1});draw()}" +
    "function okSeg(s){return s.status!='blocked'&&s.status!='unavailable'}" +
    "function draw(){var h='';D.presets.forEach(function(p){h+='<button class=card aria-pressed='+(st.type==p.id)+' onclick=\"setPreset(\\''+p.id+'\\')\"><b>'+E(p.title)+'</b><small>'+(p.group=='investment'?'Investment':'End user')+'. '+E(p.blurb)+'</small>'+(p.draft?'<span class=\"tag\" style=\"border-color:#8A3B12;color:#8A3B12\">Draft, awaiting official check</span><div class=note>'+E(p.draft)+'</div>':'')+'</button>'});document.getElementById('types').innerHTML=h;" +
    "h='';D.tiers.forEach(function(t){h+='<button class=card aria-pressed='+(st.tier==t.id)+' onclick=\"st.tier=\\''+t.id+'\\';draw()\"><b>'+E(t.title)+'</b><small>'+({summary:'Short, story-led, with the locked core',standard:'The segments you choose, figures first',full:'Everything that the evidence allows'})[t.id]+'</small></button>'});document.getElementById('tiers').innerHTML=h;" +
    "h='';var full=st.tier=='full',keep=[];D.segments.forEach(function(s){var ok=okSeg(s),on=ok&&(full||st.on[s.id]);if(on)keep.push(s.id);h+='<label class=\"card seg'+(ok?'':' blocked')+'\"><input type=checkbox '+(on?'checked ':'')+((!ok||full)?'disabled ':'')+'onchange=\"st.on[\\''+s.id+'\\']=this.checked?1:0;draw()\"><span>'+(I[s.icon]||'')+'<b>'+E(s.title)+'</b><small>'+E(s.evidence)+'</small>'+(ok?(s.status=='annotated'?'<span class=tag>Shown with a note</span>':'<span class=tag>Supported</span>'):'<span class=tag>'+(s.status=='blocked'?'Blocked':'No data')+'</span>')+s.reasons.map(function(r){return '<div class=note>'+E(r)+'</div>'}).join('')+s.notes.map(function(r){return '<div class=note>Beside this: '+E(r)+'</div>'}).join('')+'</span></label>'});document.getElementById('segs').innerHTML=h;" +
    "document.getElementById('flags').innerHTML=D.flags.map(function(o){return '<label class=\"card seg\"><input type=checkbox '+(st.fl[o.id]?'checked ':'')+'onchange=\"st.fl[\\''+o.id+'\\']=this.checked?1:0;draw()\"><span><b>'+E(o.title)+'</b><small>'+E(o.note)+'</small></span></label>'}).join('');document.getElementById('core').innerHTML=D.core.map(function(c){return '<div class=\"card core\"><b>'+E(c.title)+'</b><small>'+E(c.first)+'</small></div>'}).join('')+'<div class=\"card core\"><b>What this report cannot tell you</b><small>The last page, in every version.</small></div>';" +
    "var u=D.base+'?kind=investor_tiers&project='+encodeURIComponent(D.project)+'&tier='+st.tier+(st.type?'&type='+st.type:'')+'&segs='+keep.join(',')+(Object.keys(st.fl).filter(function(k){return st.fl[k]}).length?'&flags='+Object.keys(st.fl).filter(function(k){return st.fl[k]}).join(','):'')+(D.key?'&key='+encodeURIComponent(D.key):'');document.getElementById('go').href=u;document.getElementById('covers').textContent=keep.length+' of '+D.segments.length+' segments chosen. The report lists on its last page what it covers and what it leaves out.'}draw();</script></body></html>";
}

// ---------------------------------------------------------------------------------------------------------- the route builders (called from src/devmap_pdf.js)
export async function loadFacts(env, project) {
  const all = await kvJson(env, "investor_tiers_facts");
  return all && all.projects ? all.projects[project] || null : null;
}
export async function buildInvestorTiersPdf(env, p, opts) {
  const q = p.inv || {};
  if (!q.project) return { status: 400, body: { ok: false, reason: "project is needed for kind=investor_tiers" } };
  const facts = opts && opts.facts ? opts.facts : await loadFacts(env, q.project);
  if (!facts) return { status: 404, body: { ok: false, reason: "no facts record for this project yet", project: q.project } };
  if (p.kind === "investor_selector") return { status: 200, html: selectorHtml(facts, "/developers_pdf", p.key), pages: 1, fname: "selector.html", htmlOnly: true };
  const plan = buildPlan({ facts, type: q.type, tier: q.tier, segments: q.segs, flags: q.flags, lang: q.lang });
  const doc = buildTiersHtml(facts, plan, { client: p.client });
  if (doc.lint.length) return { status: 500, body: { ok: false, reason: "the report text failed its own checks: " + doc.lint.join("; ") } };
  return { status: 200, html: doc.html, pages: doc.pages, fname: "Investor_" + facts.project.id + "_" + plan.tier + ".pdf", audit: plan.audit };
}
