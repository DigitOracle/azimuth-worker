// v238 — THE PILLARS CARD (Kendall, 22 Sep 2026).
//
// Broker training says a buyer asks four things: where is it, who built it, can they finish it, what does
// it cost. Three of those the Land Department registers can answer and one they cannot, and this file is
// built around being straight about which is which.
//
//   LOCATION        metro or tram distance from THIS building, plus the schools and clinics in its
//                   district. Absent where no transit distance is held — about a third of buildings.
//   TRACK RECORD    a rank among developers we can judge: years licensed, registered projects,
//                   cancellations folded in. Not "credibility" — a register cannot judge that.
//   DELIVERY RECORD the share of the developer's projects that were PAST their due date and finished.
//                   100 means every one landed. Not a financing measure: there are no balance sheets in
//                   DLD, so "can they fund themselves" is reported as unanswerable rather than proxied.
//   PRICE           beside the chart, never on it. See PRICE_ON_POLYGON below.
//
// WHY PRICE IS NOT A SPOKE. A spider's whole value is that the SHAPE is readable at a glance — that is why
// anyone picks one over four numbers. Putting price on it needs the mid-ring to mean "at the area median"
// while the other three mid-rings mean "middle of the field", so the shape, which is the thing the eye
// actually consumes, stops being comparable across spokes. The readout rescues whoever reads it; nobody
// reads it, they look at the polygon and form an impression. And price has no agreed direction anyway:
// cheaper than the area is value to a buyer and a warning to an investor, so no orientation of that spoke
// is right for both. Beside the chart, "+18% vs the area median" is unambiguous and sayable out loud.
//
// DECIDED, not defaulted. This deviates from the four-in-one-spider Kendall asked for, so it went to him
// with the reasoning on both sides and his answer on 22 Sep 2026 was "keep price beside the chart". What
// settled it was reading the real sentence back off a real building: "+28% above the Business Bay median
// of AED 1,974/sq ft, across 425 registered sales" - the sale count is what makes the figure trustworthy
// rather than merely sayable, and none of it survives being squeezed onto a spoke.
// The flag still works if that is ever revisited; changing it needs a decision, not a preference.
export const PRICE_ON_POLYGON = false;

const R = 76, CX = 150, CY = 112;                 // the ring, and where it sits in the 300-wide box
const VB = '0 0 300 232';                         // wide enough for two-word labels at the rim, which 256 clipped
const RINGS = [0.25, 0.5, 0.75, 1];
const METRO_ZERO_M = 3000;                        // beyond this, the metro contributes nothing
const SCHOOL_CAP = 20, HEALTH_CAP = 50;           // past these, more stops counting
const SQM_TO_SQFT = 10.7639;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const n0 = (v) => (v == null ? null : Number(v).toLocaleString("en-US", { maximumFractionDigits: 0 }));

// ── the axes ────────────────────────────────────────────────────────────────
// Every axis is {key,label,value,read,why}. `value` null means NOT HELD, and null must draw as a gap:
// a point at the origin would say "scored zero", which is the opposite claim. `read` is the raw fact the
// score came from, because a bare 0-100 is not something anyone can repeat to a client.

export function locationAxis(D, pill, areaLabel) {
  const transit = (D && D.transit) || [];
  const rail = transit.filter((t) => t && t.m != null && (t.kind === "Metro" || t.kind === "Tram"))
    .sort((a, b) => a.m - b.m)[0];
  if (!rail) {
    return { key: "location", label: "LOCATION", value: null, read: null,
      why: "no metro or tram distance is held for this building" };
  }
  const railScore = clamp(100 * (1 - rail.m / METRO_ZERO_M), 0, 100);
  const schools = D.schoolsAll || 0, health = D.healthN || 0;
  // The district's amenity density is a RANK against the other districts, not a score against a fixed cap.
  // Capped, Business Bay's 26 schools and 563 clinics both saturated, so every dense district scored a flat
  // 100 and LOCATION collapsed to "metro distance plus fifty" - a tower 3 km from rail read as middling
  // rather than badly connected. Where no rank is held the axis is the rail alone, and says so.
  const dis = ((pill && pill.districts) || {})[String(areaLabel || D.district || "").trim()] || null;
  const rank = dis && dis.rank != null ? dis.rank : null;
  const value = rank == null ? Math.round(railScore) : Math.round(0.55 * railScore + 0.45 * rank);
  const km = D.amenKm || 5;
  const read = esc(rail.kind) + " " + (rail.m >= 1000 ? (rail.m / 1000).toFixed(1) + " km" : rail.m + " m")
    + " · " + schools + " schools, " + health + " clinics within " + km + " km"
    + (rank == null ? " (district not ranked)" : "");
  return { key: "location", label: "LOCATION", value, read,
    note: "The rail distance is this building's. The schools and clinics are its district's, so every tower in the district shares them." };
}

// v238.2 - `thin` is a developer the register DOES name but which is not scored: a name and three counts.
// It exists because saying nothing and saying "no developer" are different claims, and the card was making
// the second when the truth was the first. On /building/businessbay/12 that printed "the register does not
// join this building to a developer" directly under a header reading OMNIYAT. A wrong reason is worse than
// a missing one - a blank invites a question, an explanation gets believed.
export function developerAxes(dev, thin) {
  if (!dev) {
    const why = !thin
      ? "the register does not join this building to a developer"
      : thin.total == null
        ? esc(thin.name) + " is named on this building, but carries no scored record in the register"
        : "too early to judge — " + esc(thin.name || "this developer") + " has "
          + (thin.total === 1 ? "1 registered project" : thin.total + " registered projects")
          + (thin.due ? ", " + thin.due + " past their due date" : ", none past their due date yet");
    return [{ key: "track", label: "TRACK RECORD", value: null, read: null, why },
      { key: "delivery", label: "DELIVERY RECORD", value: null, read: null, why }];
  }
  const p = dev.projects || {};
  const bits = [];
  if (dev.licensed) bits.push("Licensed " + String(dev.licensed).slice(0, 4));
  if (p.total != null) bits.push(p.total + (p.total === 1 ? " project" : " projects"));
  if (p.cancelled) bits.push(p.cancelled + " cancelled");
  else if (p.total) bits.push("none cancelled");
  const track = { key: "track", label: "TRACK RECORD", value: dev.track == null ? null : dev.track,
    read: bits.join(" · ") || null, why: dev.track == null ? (dev.track_why || "not scored") : null };

  const dRead = p.due
    ? p.delivered + " of " + p.due + " due projects delivered" + (p.overdue ? " · " + p.overdue + " overdue" : " · none overdue")
    : null;
  const delivery = { key: "delivery", label: "DELIVERY RECORD", value: dev.delivery == null ? null : dev.delivery,
    read: dRead, why: dev.delivery == null ? (dev.delivery_why || "not scored") : null,
    note: "Not a financing measure. The registers hold no balance sheets, so whether a developer can fund itself is not answerable from this data."
      + (dev.escrow_named_pct != null ? " An escrow agent is named on " + dev.escrow_named_pct + "% of its projects." : "") };
  return [track, delivery];
}

// PRICE is a reading, not a score: {aedSqft, areaAedSqft, deltaPct, area, why}
export function priceReading(D, pill, areaLabel) {
  const rows = (D && D.register) || [];
  const each = rows.map((r) => (r.median && r.sqm ? r.median / (r.sqm * SQM_TO_SQFT) : null)).filter((x) => x && isFinite(x));
  if (!each.length) return { why: "the register prices none of this building's types" };
  each.sort((a, b) => a - b);
  const aedSqft = Math.round(each[Math.floor(each.length / 2)]);
  const areas = (pill && pill.areas) || {};
  // The AREA name the register knows, which is not always the name the twin's rail shows. The district
  // amenity block's centre label IS that name, so it is preferred; D.district is the fallback.
  const want = String(areaLabel || (D && D.district) || "").trim().toUpperCase();
  let hit = null;
  for (const k of Object.keys(areas)) { if (k.trim().toUpperCase() === want) { hit = areas[k]; break; } }
  if (!hit) {
    return { aedSqft, why: "no median is held for " + (areaLabel || D.district || "this area") + " — fewer than "
      + (((pill || {}).floors || {}).areaMinSales || 200) + " registered residential sales" };
  }
  return { aedSqft, areaAedSqft: hit.aed_sqft, area: areaLabel || D.district, sales: hit.sales,
    deltaPct: Math.round(100 * (aedSqft - hit.aed_sqft) / hit.aed_sqft) };
}

// ── the shape ───────────────────────────────────────────────────────────────
export function spiderSvg(axes) {
  const n = axes.length;
  if (!n) return "";
  const at = (i, r) => {
    const a = (-90 + i * (360 / n)) * Math.PI / 180;
    return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
  };
  const pt = (i, v) => at(i, R * clamp(v, 0, 100) / 100);
  const xy = (p) => p[0].toFixed(1) + "," + p[1].toFixed(1);

  let s = '<svg class=spdr viewBox="' + VB + '" role=img aria-label="The pillars, scored out of a hundred">';
  for (const f of RINGS) {
    s += '<polygon class=spgrid points="' + axes.map((_, i) => xy(at(i, R * f))).join(" ") + '"/>';
  }
  // A held axis gets a solid spoke; a missing one gets a dashed spoke and no point, so the eye reads
  // "nothing here" rather than "nothing scored".
  axes.forEach((a, i) => {
    s += '<line class="spoke' + (a.value == null ? " miss" : "") + '" x1="' + CX + '" y1="' + CY
      + '" x2="' + at(i, R)[0].toFixed(1) + '" y2="' + at(i, R)[1].toFixed(1) + '"/>';
  });
  // The polygon is drawn edge by edge and simply skips any edge touching a missing axis, so it stays open
  // across the gap instead of closing through the middle and inventing a shape.
  const all = axes.every((a) => a.value != null);
  if (all) {
    s += '<polygon class=spfill points="' + axes.map((a, i) => xy(pt(i, a.value))).join(" ") + '"/>';
  } else {
    for (let i = 0; i < n; i++) {
      const b = (i + 1) % n;
      if (axes[i].value == null || axes[b].value == null) continue;
      const p = pt(i, axes[i].value), q = pt(b, axes[b].value);
      s += '<line class=spedge x1="' + p[0].toFixed(1) + '" y1="' + p[1].toFixed(1) + '" x2="' + q[0].toFixed(1) + '" y2="' + q[1].toFixed(1) + '"/>';
    }
  }
  axes.forEach((a, i) => {
    if (a.value == null) return;
    const p = pt(i, a.value);
    s += '<circle class=spdot cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3.4"/>';
    // The figure sits INSIDE its own vertex, along the spoke. Fixed above the dot it collided with the rim
    // label on the two lower spokes - "100" landed on top of "RECORD".
    const vp = at(i, Math.max(R * clamp(a.value, 0, 100) / 100 - 15, 15));
    s += '<text class=spval x="' + vp[0].toFixed(1) + '" y="' + (vp[1] + 3.5).toFixed(1) + '">' + a.value + "</text>";
  });
  // Two-word labels wrap onto two lines. "DELIVERY RECORD" on one line ran off the box and rendered as
  // "RECORD", which names the wrong axis rather than merely looking untidy.
  axes.forEach((a, i) => {
    const l = at(i, R + 16);
    const anchor = Math.abs(l[0] - CX) < 8 ? "middle" : (l[0] > CX ? "start" : "end");
    const words = String(a.label).split(" ");
    const lines = words.length > 1 ? [words[0], words.slice(1).join(" ")] : words;
    const top = l[1] + 4 - (lines.length - 1) * 4.6;
    s += '<text class="splab' + (a.value == null ? " miss" : "") + '" x="' + l[0].toFixed(1) + '" y="' + top.toFixed(1)
      + '" text-anchor="' + anchor + '">'
      + lines.map((w, k) => '<tspan x="' + l[0].toFixed(1) + '" dy="' + (k ? 9.2 : 0) + '">' + esc(w) + "</tspan>").join("")
      + (a.value == null ? '<tspan x="' + l[0].toFixed(1) + '" dy="9.2">— not held</tspan>' : "") + "</text>";
  });
  return s + "</svg>";
}

export const PILLAR_CSS =
  '.pill{margin:12px 0;padding:12px 13px;border:1px solid var(--line);border-radius:12px;background:rgba(197,165,106,.05)}'
  + '.pill>b{display:block;font:600 .8rem/1.2 Fraunces,Georgia,serif;color:var(--gold);letter-spacing:.02em}'
  + '.pill>b span{display:block;font:400 .6rem/1.4 "IBM Plex Mono",monospace;color:var(--mut);letter-spacing:.04em;margin-top:3px}'
  + '.spdr{display:block;width:100%;max-width:280px;margin:6px auto 2px;height:auto}'
  + '.spgrid{fill:none;stroke:var(--line);stroke-width:.7;opacity:.5}'
  + '.spoke{stroke:var(--line);stroke-width:.7;opacity:.6}'
  + '.spoke.miss{stroke-dasharray:3 4;opacity:.85}'
  + '.spfill{fill:rgba(197,165,106,.22);stroke:var(--gold);stroke-width:1.6;stroke-linejoin:round}'
  + '.spedge{stroke:var(--gold);stroke-width:1.6;stroke-linecap:round}'
  + '.spdot{fill:var(--gold)}'
  + '.spval{fill:var(--text);font:600 10px "IBM Plex Mono",monospace;text-anchor:middle}'
  + '.splab{fill:var(--mut);font:500 8.6px "IBM Plex Mono",monospace;letter-spacing:.07em}'
  + '.splab.miss{fill:var(--mut);opacity:.7}'
  + '.prow{display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-top:1px solid var(--line)}'
  + '.prow:first-of-type{border-top:0}'
  + '.prow i{font-style:normal;font:500 .62rem/1.5 "IBM Plex Mono",monospace;color:var(--gold);letter-spacing:.06em;flex:0 0 auto}'
  + '.prow s{text-decoration:none;display:block;font:400 .72rem/1.45 "IBM Plex Sans",system-ui,sans-serif;color:var(--text);text-align:right}'
  + '.prow s em{font-style:normal;color:var(--mut)}'
  + '.prow.miss s{color:var(--mut)}'
  + '.pprice{margin-top:8px;padding:9px 11px;border:1px dashed var(--line);border-radius:10px}'
  + '.pprice b{display:block;font:600 1.05rem/1.2 Fraunces,Georgia,serif;color:var(--text)}'
  + '.pprice span{display:block;font:400 .68rem/1.5 "IBM Plex Sans",system-ui,sans-serif;color:var(--mut);margin-top:2px}'
  + '.pprice u{text-decoration:none;color:var(--gold);font-weight:600}'
  + '.pnote{font:400 .62rem/1.5 "IBM Plex Sans",system-ui,sans-serif;color:var(--mut);margin-top:9px}';

function priceBlock(pr) {
  if (!pr || (!pr.aedSqft && pr.why)) {
    return '<div class=pprice><b>Price —</b><span>' + esc(pr && pr.why ? pr.why : "not held") + "</span></div>";
  }
  const head = "AED " + n0(pr.aedSqft) + " <span style=font-size:.62em>/ sq ft</span>";
  if (pr.deltaPct == null) {
    return '<div class=pprice><b>' + head + "</b><span>" + esc(pr.why || "") + "</span></div>";
  }
  const d = pr.deltaPct;
  const word = d === 0 ? "level with" : (d > 0 ? "<u>+" + d + "%</u> above" : "<u>" + d + "%</u> below");
  return '<div class=pprice><b>' + head + "</b><span>" + word + " the " + esc(pr.area) + " median of AED "
    + n0(pr.areaAedSqft) + "/sq ft, across " + n0(pr.sales) + " registered sales.</span></div>";
}

export function pillarsCard(o) {
  const axes = o.axes || [];
  // v238.4 - a chart with no data points is not a chart. Since the building page opens for every footprint
  // rather than the 1,996 with a floor stack, most pages have nothing behind this card at all: three dashed
  // spokes and "not held" three times, on 59,580 pages reading "Unnamed building". An empty polygon implies
  // data exists and is merely low; drawing nothing says the truth. One line instead, so the reader knows the
  // card exists and why it is not filled, rather than wondering whether it failed to load.
  const anyScore = axes.some((a) => a.value != null);
  const anyPrice = o.price && o.price.aedSqft != null;
  if (!anyScore && !anyPrice) {
    return '<div class=pill><b>The pillars<span>nothing on this building yet</span></b>'
      + '<div class=pnote>The register holds no location, developer or price figure for this building, so '
      + 'there is nothing to chart. It appears here as soon as any of the three does.</div></div>';
  }
  const shown = PRICE_ON_POLYGON && o.priceAxis ? axes.concat([o.priceAxis]) : axes;
  const rows = shown.map((a) =>
    '<div class="prow' + (a.value == null ? " miss" : "") + '"><i>' + esc(a.label) + "</i><s>"
    + (a.value == null ? "<em>not held — " + esc(a.why || "") + "</em>"
      : esc(a.read || "") + (a.read ? " · " : "") + "<em>" + a.value + "/100</em>") + "</s></div>").join("");
  const notes = shown.filter((a) => a.note).map((a) => esc(a.label) + ": " + esc(a.note)).join(" ");
  return '<div class=pill><b>The pillars<span>' + esc(o.subtitle || "") + "</span></b>"
    + spiderSvg(shown) + rows
    + (PRICE_ON_POLYGON ? "" : priceBlock(o.price))
    + (notes ? '<div class=pnote>' + notes + "</div>" : "")
    + '<div class=pnote>' + esc(o.sourceLine || "") + "</div></div>";
}

// ── putting it together for a building ──────────────────────────────────────
export function buildingPillars(D, pill, areaLabel) {
  const devs = (pill && pill.developers) || {};
  const byName = (pill && pill.by_name) || {};
  // By the register NUMBER first. The project row is joined to this building by property/project id with no
  // name comparison, so it is the sound route; the developer NAME on the unit mix reaches only 16% of
  // stacked buildings and matching it is guesswork. Name is the fallback, not the plan.
  let dev = null, thin = null;
  const unscored = (pill && pill.unscored) || {};
  const no = D && D.project && D.project.developer_no;
  const key = no == null ? null : String(no).replace(/\.0$/, "");
  if (key) { dev = devs[key] || null; if (!dev) thin = unscored[key] || null; }
  if (!dev && !thin) {
    const want = normName(D && D.developer);
    const ks = (want && byName[want]) || [];
    for (const k of ks) { if (devs[k]) { dev = devs[k]; break; } if (!thin && unscored[k]) thin = unscored[k]; }
  }
  // Named anywhere but absent from BOTH maps: still not "no developer". Say what is true - we have a name
  // and no record - rather than reaching for the nearest sentence.
  //
  // v238.3 - this used to require `key`, so it only caught buildings that had a register NUMBER. 287
  // buildings across the districts carry a developer NAME on the unit mix and no number, and every one of
  // them printed "the register does not join this building to a developer" beneath a header naming the
  // developer. Emaar, four times over, in Al Khairan First alone. The guard existed precisely to stop that
  // and was gated on the thing it was meant to be a fallback FOR.
  if (!dev && !thin) {
    const named = (D && D.project && D.project.developer_name) || (D && D.developer);
    if (named) thin = { name: named, total: null, due: null, dated: null };
  }
  const axes = [locationAxis(D, pill, areaLabel)].concat(developerAxes(dev, thin));
  const price = priceReading(D, pill, areaLabel);
  // v238.3 - the name the CARD should show, resolved here so the header and the axes cannot disagree.
  // They were computed independently before: the subtitle read D.developer while the axes read the id
  // join, which is a second route to the same contradiction even once the fallback above is fixed.
  const name = (dev && dev.name) || (thin && thin.name) || null;
  return { axes, price, dev, name };
}

export function normName(n) {
  let t = String(n || "").toLowerCase();
  for (const junk of ["l.l.c", "llc", "p.j.s.c", "pjsc", "fze", "f.z.e", "co.", "limited", "ltd"]) t = t.split(junk).join(" ");
  return t.replace(/[.,()]/g, " ").split(/\s+/).filter(Boolean).join(" ");
}

// ── the developer card ──────────────────────────────────────────────────────
// A DIFFERENT axis set on purpose. A developer does not have a location, so it does not get that spoke:
// on a building LOCATION is that building's rail distance, and the only developer-level version would be
// "the areas they build in", which is a different claim wearing the same label. Nobody comparing a
// developer's 86 with a building's 86 would know they meant different things. ON TIME takes the third
// place instead, and is genuinely about the developer.
export function developerCardAxes(dev) {
  const [track, delivery] = developerAxes(dev);
  const p = (dev && dev.projects) || {};
  const onTime = {
    key: "ontime", label: "ON TIME",
    value: dev && dev.on_time_pct != null ? dev.on_time_pct : null,
    read: p.dated ? p.on_time + " of " + p.dated + " finished by the date they were due"
      + (p.late ? " · " + p.late + " late" : " · none late") : null,
    why: !dev || dev.on_time_pct == null ? ((dev && dev.on_time_why) || "not scored") : null,
    note: "Delivered and delivered ON TIME are different questions: a developer can finish everything "
      + "eventually and still never hit a handover date.",
  };
  return [track, delivery, onTime];
}

export function developerPillarsCard(dev, sourceLine) {
  return pillarsCard({
    axes: developerCardAxes(dev),
    price: { why: "price is a building's figure, not a developer's — open any of its buildings for that" },
    subtitle: dev && dev.licensed ? "Licensed " + String(dev.licensed).slice(0, 4) + " · register record" : "register record",
    sourceLine: sourceLine || "DLD developer register and project register.",
  });
}
