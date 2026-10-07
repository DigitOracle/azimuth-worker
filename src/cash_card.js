// CASH NEEDED BEFORE HANDOVER (v375, Gap 1 of the off-plan buying journey, 7 Oct 2026).
//
// A card for an OFF-PLAN project, and only when BOTH exist for it: a payment plan whose structure the developer states in words (data/payment_plans,
// scripts/build_payment_plans.py) AND a list price from the developer's own sheet or brochure. Amount = the plan's percentage x the developer's list price.
// It is DERIVED, the method is written on the card, and it says what it leaves out. No mortgage, no resale value, no forecast.
//
// The Dubai Land Department registration fee (4%) is policy, not data: it is a separate line behind OFFPLAN_CONFIG.SHOW_REGISTRATION_FEE (src/config.js,
// default OFF). While the flag is off nothing about that fee is printed.
import { OFFPLAN_CONFIG } from "./config.js";
import { PHOSPHOR_LIGHT } from "./devmap_icons.js";

const ROMAN = { ii: "2", iii: "3", iv: "4", v: "5", vi: "6", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", i: "1" };
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = (n) => Math.round(n).toLocaleString("en-US");
const aed = (n) => "AED " + fmt(n);
const alnum = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

// the same name rule the builder uses (scripts/build_payment_plans.py Namer.norm): lower case, the developer's own name and "by <developer>" dropped, roman numerals as digits
export function normProject(name, devWords) {
  let t = String(name || "").toLowerCase();
  for (const a of devWords || []) {
    const w = String(a || "").toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (!w) continue;
    t = t.replace(new RegExp("\\bby\\s+" + w + "\\b", "g"), " ").replace(new RegExp("\\b" + w + "\\b", "g"), " ");
  }
  t = t.replace(/\b(residences?|residency|tower|the|apartments?|dubai|building)\b/g, " ").replace(/[^a-z0-9 ]/g, " ");
  return t.split(/\s+/).filter(Boolean).map((w) => ROMAN[w] || w).join(" ").trim();
}

// which record is this building? Exact normalised name against the record's aliases, AND the developer agrees when the building states one.
// (A name alone has been wrong before: the 7 Oct attribution audit; so a building that names a different developer is never matched.)
export function findRecord(doc, names, developer) {
  if (!doc || !doc.projects || !developer) return null;   // no developer stated for the building: a name alone is not enough (7 Oct attribution audit)
  const want = (names || []).filter(Boolean);
  if (!want.length) return null;
  for (const [key, r] of Object.entries(doc.projects)) {
    const words = [r.dev, r.developer].filter(Boolean);
    const have = new Set((r.aliases || [r.project]).map((a) => normProject(a, words)).filter(Boolean));
    if (!want.some((n) => have.has(normProject(n, words)))) continue;
    const d = alnum(developer), a = alnum(r.developer), k = alnum(r.dev);
    if (!(a && (a.includes(d) || d.includes(a))) && !(k && (d.includes(k) || k.includes(d)))) continue;
    return Object.assign({ key }, r);
  }
  return null;
}

// the options that can be turned into dirhams: the structure is stated (before handover, on handover, after handover all known)
export function usableOptions(rec) {
  return ((rec && rec.plans) || []).filter((o) => o && typeof o.before_handover_pct === "number" && typeof o.on_handover_pct === "number" && Math.abs((o.before_handover_pct + o.on_handover_pct + (o.after_handover_pct || 0)) - 100) < 0.05);
}

// the numbers, no markup: { rows: [{ type, from, before, onHandover, byHandover, after }] } for one plan option
export function cashFigures(opt, prices) {
  const out = [];
  for (const [type, p] of Object.entries((prices && prices.by_type) || {})) {
    if (!p || !(p.from_aed > 0)) continue;
    const price = p.from_aed;
    const before = price * opt.before_handover_pct / 100, onH = price * opt.on_handover_pct / 100, after = price * (opt.after_handover_pct || 0) / 100;
    out.push({ type, price, before, onHandover: onH, byHandover: before + onH, after });
  }
  return out;
}

function icon(name, cls) {
  const d = (PHOSPHOR_LIGHT && PHOSPHOR_LIGHT[name]) || [];
  return '<svg class="' + cls + '" viewBox="0 0 256 256" width="18" height="18" fill="currentColor" aria-hidden="true" style="vertical-align:-3px;margin-right:6px">' + d.map((p) => '<path d="' + p + '"/>').join("") + "</svg>";
}

const planWords = (o) => {
  const bits = [];
  if (o.on_booking_pct) bits.push(o.on_booking_pct + "% on booking");
  if (o.instalments_pct) bits.push(o.instalments_pct + "% in instalments before handover");
  else if (!o.on_booking_pct) bits.push(o.before_handover_pct + "% before handover");
  if (o.on_handover_pct) bits.push(o.on_handover_pct + "% on handover");
  if (o.after_handover_pct) bits.push(o.after_handover_pct + "% after handover");
  return bits.join(", ");
};

// the card, or "" when it must not appear. ctx = { offplan: bool }, cfg defaults to src/config.js
export function cashCardHtml(rec, ctx, cfg) {
  cfg = cfg || OFFPLAN_CONFIG;
  if (!rec || !ctx || !ctx.offplan) return "";
  const opts = usableOptions(rec);
  const prices = rec.prices && rec.prices.by_type && Object.keys(rec.prices.by_type).length ? rec.prices : null;
  if (!opts.length || !prices) return "";
  const shown = opts.slice(0, 2);
  const block = shown.map((o) => {
    const rows = cashFigures(o, prices).slice(0, 4);
    if (!rows.length) return "";
    return '<div class=src style="margin:8px 0 2px"><b>' + esc(o.label ? "Plan " + o.label : "Plan") + "</b>: " + esc(planWords(o)) + "</div>" +
      rows.map((r) => '<div class=row><span>' + esc(r.type) + "<br><small>list price from " + aed(r.price) + "</small></span><span>" +
        "<small>before handover</small> " + aed(r.before) + (r.onHandover > 0 ? "<br><small>on handover</small> " + aed(r.onHandover) + "<br><small>by the handover date</small> <b>" + aed(r.byHandover) + "</b>" : "") +
        (r.after > 0 ? "<br><small>after handover, not counted</small> " + aed(r.after) : "") + "</span></div>").join("");
  }).join("");
  if (!block.trim()) return "";
  const planSrc = shown[0].source || {}, pr = rec.prices;
  let fee = "";
  if (cfg.SHOW_REGISTRATION_FEE) {
    const src = String(cfg.REGISTRATION_FEE_SOURCE || "").trim();
    const first = cashFigures(shown[0], prices)[0];
    fee = '<div class=src style="margin-top:8px"><b>Dubai Land Department registration fee, ' + esc(cfg.REGISTRATION_FEE_PCT) + "% of the price</b> (a separate line, not in the amounts above): " +
      (first ? aed(first.price * cfg.REGISTRATION_FEE_PCT / 100) + " on the " + esc(first.type) + " at the list price. " : "") +
      "UNVERIFIED policy figure. " + (src ? "Source: " + esc(src) + "." : "Source to be confirmed by a person.") + "</div>";
  }
  return "<h3>" + icon("wallet", "cashi") + 'Cash needed up to handover <span style="font-size:.6rem;letter-spacing:.08em;border:1px solid currentColor;border-radius:4px;padding:1px 5px;margin-left:6px;vertical-align:2px">DERIVED</span></h3>' +
    '<div class=src style="margin-top:0">The developer says' + (rec.handover_text ? ": handover " + esc(rec.handover_text) : "") + ". These amounts are worked out here, not stated by the developer.</div>" +
    block + fee +
    "<div class=src><b>Method.</b> The developer's plan percentages (" + esc(planSrc.kind || "developer text") + (planSrc.url ? ", " + esc(planSrc.url) : "") + ") times the developer's list price (" +
    esc(pr.kind || "list price") + (pr.sheet_date ? ", " + esc(String(pr.sheet_date).slice(0, 10)) : "") + "); excludes fees. The amount shown is for the lowest listed price of each type. The plan and the price are the developer's own words, not Land Department register facts.</div>";
}
