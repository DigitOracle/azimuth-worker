// v827 (audit fix 1 + gap 1, 8 Nov 2026): service charge and net yield on the "decide" card.
// Data contract (pp_pack_<plot>, written by build_plot_passport.py from the lake tables; the worker never calls MotherDuck):
//   pack.service_charge = { aed_sqft, year, project_number, source }            <- najma_service_charges, is_latest, usage 'Residential', not outlier
//   pack.net_yield      = { project_number, sales_to, rents_to, beds: [ { beds, status, sale, size, rent, sc_annual, gross, net, sales_n, rents_n } ] }
//                                                                               <- lk_project_net_yield (one row per project_number x beds 0-3)
// Status gate (the denominator is every row the pack carries, not only the shown ones):
//   ok -> figures; thin -> figures + "few rentals"; gross_only -> gross only, no net; withheld -> no figure; check -> no figure, logged for review.
const YIELD_LABEL = "typical-unit yield (median rent / median ready price), before vacancy and fees";
const SC_SOURCE = "Dubai Land Department Mollak";
const esc = (s) => String(s == null ? "" : s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
const num = (x) => typeof x === "number" && isFinite(x);
const int = (x) => Math.round(x).toLocaleString("en-US");
const pct = (x) => x.toFixed(1) + "%";
const BEDS = (b) => (Number(b) === 0 ? "Studio" : b + " bed");

export { YIELD_LABEL };

export function decideFacts(pack) {
  pack = pack || {};
  const sc = pack.service_charge && num(pack.service_charge.aed_sqft) && pack.service_charge.aed_sqft > 0 && pack.service_charge.aed_sqft <= 100 ? pack.service_charge : null;
  const ny = pack.net_yield && Array.isArray(pack.net_yield.beds) ? pack.net_yield : null;
  const rows = [], review = [];
  for (const r of ny ? ny.beds : []) {
    const b = Number(r.beds);
    if (!(b >= 0 && b <= 3)) continue;
    const st = String(r.status || "");
    const okRow = (st === "ok" || st === "thin") && num(r.gross) && num(r.net);
    const grossOnly = st === "gross_only" && num(r.gross);
    if (st === "check") review.push({ project_number: ny.project_number, beds: b, gross: r.gross, net: r.net });
    rows.push({
      beds: b, status: st,
      shown: okRow || grossOnly,
      gross: okRow || grossOnly ? r.gross : null,
      net: okRow ? r.net : null,
      thin: st === "thin",
      sc_annual: num(r.sc_annual) ? r.sc_annual : (sc && num(r.size) ? Math.round(sc.aed_sqft * r.size) : null),   // the stored figure (unrounded size) wins
      size: num(r.size) ? r.size : null,
    });
  }
  rows.sort((a, b) => a.beds - b.beds);
  // typical annual service charge: for the median unit size of the bedroom count with the most sales
  let typical = null;
  if (sc && ny) {
    const best = ny.beds.filter((r) => num(r.size)).sort((a, b) => (b.sales_n || 0) - (a.sales_n || 0))[0];
    if (best) typical = { beds: Number(best.beds), size: best.size, aed: num(best.sc_annual) ? best.sc_annual : Math.round(sc.aed_sqft * best.size) };
  }
  return { sc, typical, rows, review, project_number: ny ? ny.project_number : sc ? sc.project_number : null, asof: ny ? { sales: ny.sales_to, rents: ny.rents_to } : null };
}

// "check" rows are hidden from the client and logged for review (one line per row, never shown)
export function logReview(f, log = console.log) {
  for (const r of f.review) log("[v827 decide] yield check hidden for review: project " + r.project_number + " beds " + r.beds + " gross " + r.gross + "% net " + r.net + "%");
}

export const DECIDE_CSS = ".dc{background:#FBF7EF;border:1px solid #E7DCC6;border-radius:14px;padding:14px;margin:0 0 12px;font-family:inherit;color:#1F2A28}" +
  ".dc h3{margin:0 0 8px;font-size:16px;color:#0A4F4A;font-weight:600}.dc .dcsc{background:#fff;border:1px solid #EADFC9;border-radius:12px;padding:12px;margin-bottom:10px}" +
  ".dc .dcbig{font-size:20px;font-weight:700;color:#0A4F4A}.dc .dcsub{font-size:12px;color:#6B6455;margin-top:3px;line-height:1.4}" +
  ".dc .dcg{display:grid;grid-template-columns:1fr 1fr;gap:8px}.dc .dcc{min-width:0;overflow-wrap:anywhere;background:#fff;border:1px solid #EADFC9;border-radius:12px;padding:10px}" +
  ".dc .dcb{font-size:12px;color:#6B6455;font-weight:600}.dc .dcy{font-size:15px;font-weight:700;margin-top:4px}.dc .dcn{color:#0A4F4A}" +
  ".dc .dctag{display:inline-block;font-size:10px;background:#F3E7CC;color:#7A5B1E;border-radius:8px;padding:1px 6px;margin-left:4px}" +
  ".dc .dcna{font-size:12px;color:#8A8270;margin-top:6px}.dc .dclab{font-size:11px;color:#6B6455;margin-top:8px;line-height:1.4}";

export function decideCardHtml(pack, opts = {}) {
  const f = decideFacts(pack);
  logReview(f, opts.log || console.log);
  const sc = f.sc
    ? '<div class="dcsc"><div class="dcb">Service charge</div><div class="dcbig">AED ' + f.sc.aed_sqft.toFixed(2) + ' per sq ft per year</div><div class="dcsub">(' + esc(f.sc.year) + " budget, " + SC_SOURCE + ")" +
      (f.typical ? "<br>Typical annual cost about <b>AED " + int(f.typical.aed) + "</b> for a " + BEDS(f.typical.beds).toLowerCase() + " of " + int(f.typical.size) + " sq ft (the median size sold)" : "") + "</div></div>"
    : '<div class="dcsc"><div class="dcb">Service charge</div><div class="dcna">No owners-association budget on the ' + SC_SOURCE + " register for this project yet.</div></div>";
  const cards = f.rows.map((r) => '<div class="dcc"><div class="dcb">' + BEDS(r.beds) + (r.thin && r.shown ? '<span class="dctag">few rentals</span>' : "") + "</div>" +
    (r.shown
      ? '<div class="dcy">' + pct(r.gross) + ' <span style="font-weight:400;font-size:12px">gross</span></div>' +
        (r.net != null ? '<div class="dcy dcn">' + pct(r.net) + ' <span style="font-weight:400;font-size:12px">net of service charge</span></div>' : '<div class="dcna">net: no service charge budget</div>') +
        (r.sc_annual != null && r.net != null ? '<div class="dcsub">Service charge about AED ' + int(r.sc_annual) + " a year</div>" : "")
      : '<div class="dcna">not enough rentals</div>') + "</div>").join("");
  const yields = f.rows.length
    ? '<div class="dcb" style="margin-bottom:6px">Yield by bedroom count</div><div class="dcg">' + cards + '</div><div class="dclab">' + YIELD_LABEL + ". Not one flat's yield." +
      (f.asof ? " Sales to " + esc(f.asof.sales) + ", new rental contracts to " + esc(f.asof.rents) + ", 12 months." : "") + "</div>"
    : '<div class="dcna">Yield: not enough ready sales and new rentals in this project yet.</div>';
  return '<div class="dc"><h3>Decide: running cost and return</h3>' + sc + yields + "</div>";
}
