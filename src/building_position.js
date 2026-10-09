// v452 - BUILDING POSITION CHECK (Kendall, 9 Oct 2026: "Make sure you utilize all the sources. You've got Makani ... you're depending on one maybe.")
// img_bldg_pos_<district> (naj-market-pulse scripts/building_position.py): per register key "<district>:<i>" the consensus point of every
// position joined BY ID - our footprint, Makani entrances, the register project's plot, the Municipality addresses on it, Property Finder's
// pin - with the sources that agree (within 100 m) and those that do not. A district without the file keeps the old behaviour (no line).
const SAY = { makani: "Makani", plot: "the plot", footprint: "our footprint", address: "the Municipality addresses", pf: "Property Finder" };
const SHORT = { makani: "Makani", plot: "plot", footprint: "footprint", address: "Municipality addresses", pf: "Property Finder" };
const and = (a) => (a.length <= 1 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1]);

// the stored record for one key, checked; null when absent or malformed
export function positionOf(doc, key) {
  const r = doc && doc.b && typeof doc.b === "object" ? doc.b[key] : null;
  if (!r || !isFinite(r.lat) || !isFinite(r.lon) || Math.abs(r.lat) > 85 || Math.abs(r.lon) > 180 || !Array.isArray(r.sources_agree)) return null;
  const dis = Array.isArray(r.disagree) ? r.disagree.filter((d) => d && SAY[d.source] && isFinite(d.metres)) : [];
  return { lat: Number(r.lat), lon: Number(r.lon), agree: r.sources_agree.filter((s) => SAY[s]), disagree: dis,
    index: Number.isInteger(r.footprint_index) ? r.footprint_index : null, moved: Number.isInteger(r.moved_to) };
}

// the one quiet line under the map (plain words, no codes)
// noPf: a page that must never name Property Finder (the PDF, and anything not on the owner key) - its pin is left out of the line
export function positionLine(p, noPf) {
  if (!p) return "";
  if (noPf) p = Object.assign({}, p, { agree: p.agree.filter((s) => s !== "pf"), disagree: p.disagree.filter((d) => d.source !== "pf") });
  const off = Object.fromEntries(p.disagree.map((d) => [d.source, Math.round(d.metres)]));
  const ours = p.agree.filter((s) => s !== "pf").map((s) => SAY[s]);
  if (p.moved) return "Our first outline sat " + (off.footprint || "over 100") + " m off; the gold outline is the one at " + (and(ours) || "the agreed point") + ".";
  if (off.pf != null) return "Property Finder's pin is " + off.pf + " m off; using " + (and(ours) || "our footprint") + ".";
  if (p.agree.length >= 2) return "Position: " + and(p.agree.map((s) => SHORT[s])) + " agree.";
  return p.agree.length ? "Position: " + SAY[p.agree[0]] + " only; no second source to check it against yet." : "";
}

// where to draw: the footprint index to colour gold (the stored one, which the resolver moves only when ours disagreed) and the centre
export function placement(p, bk) {
  if (!p) return null;
  return { ll: [p.lat, p.lon], bk: p.index != null ? p.index : bk, line: positionLine(p), lineNoPf: positionLine(p, true), flagged: p.moved };
}
