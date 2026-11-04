// v745 (Kendall, 4 Nov 2026: "more visual timeline"): section 03A BUILDING STORY drawn by the worker, never by the passport writer.
// A deterministic inline SVG: a time axis (first event -> last event or planned completion, dashed past today), four swim-lanes by source,
// key milestones as larger labelled markers above the axis (placed in tiers so no two labels overlap), a shaded bar per construction period,
// same-day repeats collapsed into one dot with a count. Under it a one-line plain-English summary, the sources, and a compact 2-column list.
// The writer leaves an empty <div class="bpp-story"></div> (fixed height); placeStory() fills it after the writer has finished.
const esc = (s) => String(s == null ? "" : s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ISO = /^\d{4}-\d{2}-\d{2}/;
const dShort = (d) => MON[+d.slice(5, 7) - 1] + " " + d.slice(0, 4);
const dLong = (d) => (+d.slice(8, 10)) + " " + MON[+d.slice(5, 7) - 1] + " " + d.slice(0, 4);
export const STORY_H_MM = 74;   // the fixed height the writer reserves (prompt + placeholder)

export const LANES = [
  { id: "land", name: "Land & registration", sub: "Land Department" },
  { id: "build", name: "Construction", sub: "Municipality, DLD" },
  { id: "market", name: "Sales & rent", sub: "DLD sales, Ejari" },
  { id: "permit", name: "Permits & changes", sub: "Municipality permits" },
];

function short(what) {
  return String(what || "").replace(/^The .*? project: /, "").replace(/\s*\((?:file|permit) [^)]*\)/gi, "").replace(/ in the Land Department (?:project )?register/i, "")
    .replace(/^Building permit issued by the Municipality: /i, "").replace(/, as recorded by the Land Department on .*$/i, "").replace(/\s*\(planned, not (?:yet recorded as complete|a fact)\)/i, "").trim();
}
// one event -> lane + kind (milestone kind or "")
export function classify(t) {
  const w = String(t.what || ""), src = String(t.src || "");
  let lane = /building_permits/.test(src) ? "permit" : /^chat_(sales|rent)/.test(src) ? "market" : /dm__project_information/.test(src) ? "build" : "land";
  let kind = "";
  if (/PLANNED/i.test(w)) { kind = "planned"; lane = "build"; }
  else if (/start date|Construction started/i.test(w)) { kind = "start"; lane = "build"; }
  else if (/construction \d+% complete/i.test(w)) { kind = "pct"; lane = "build"; }
  else if (/completed|recorded as complete/i.test(w)) { kind = "done"; lane = "build"; }
  else if (/Construction file opened/i.test(w)) { kind = "file"; lane = "build"; }
  else if (/first sale of a ready/i.test(w)) kind = "ready";
  else if (/first sale registered/i.test(w)) kind = "sale";
  else if (/first rent contract/i.test(w)) kind = "rent";
  else if (/project registered/i.test(w)) kind = "reg";
  else if (/cancelled/i.test(w)) kind = "cancel";
  const file = (w.match(/\(file ([^)]+)\)/i) || [])[1] || "";
  return { lane, kind, file };
}

// the events, oldest first, plus the registration date from the project record (it is not in the plot timeline)
export function storyEvents(pp, pack) {
  const out = [];
  for (const t of (pp && pp.timeline) || []) if (ISO.test(t.date || "")) out.push(Object.assign({ date: t.date.slice(0, 10), what: t.what, src: t.src }, classify(t)));
  const pj = (pack && pack.project) || {};
  if (ISO.test(pj.registered || "") && !out.some((e) => e.kind === "reg")) out.push({ date: pj.registered.slice(0, 10), what: "Project registered with the Land Department", src: "g_dld__projects", lane: "land", kind: "reg", file: "" });
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return out;
}

// same day + same lane + same wording (numbers dropped) = one row with a count
export function collapse(ev) {
  const m = new Map();
  for (const e of ev) {
    const k = e.date + "|" + e.lane + "|" + short(e.what).toLowerCase();
    const g = m.get(k);
    if (g) g.n++; else m.set(k, Object.assign({}, e, { n: 1, label: short(e.what) }));
  }
  return [...m.values()];
}
const plural = (s, n) => (n > 1 ? n + " × " + s : s);

// pick the milestones (at most 8): registered, construction start, complete, first sale, first rent, handover / planned completion
export function milestones(ev, today) {
  const first = (f) => ev.find(f), last = (f) => ev.slice().reverse().find(f);
  const M = [];
  const add = (e, label, opt) => { if (e && !M.some((x) => x.date === e.date && x.label === label)) M.push(Object.assign({ date: e.date, label, lane: e.lane }, opt || {})); };
  add(first((e) => e.kind === "reg") || first((e) => /Buildings? entered/i.test(e.what)), "Registered");
  add(first((e) => e.kind === "start"), "Construction start");
  const done = first((e) => e.kind === "done");   // the original build; later files show as bars
  add(done, "Construction complete");
  const s = first((e) => e.kind === "sale");
  if (s) add(s, "First sale" + (/off-plan/i.test(s.what) ? " (off-plan)" : ""));
  add(first((e) => e.kind === "ready"), "First ready sale");
  const r = first((e) => e.kind === "rent");
  add(r, "First rent (Ejari)");
  const pl = last((e) => e.kind === "planned");
  if (pl && !done) add(pl, pl.date > today ? "Planned completion" : "Completion was planned", { planned: pl.date > today });
  const pct = last((e) => e.kind === "pct");
  if (pct && !done) add(pct, (pct.what.match(/(\d+)% complete/) || [])[1] + "% built");
  return M.sort((a, b) => (a.date < b.date ? -1 : 1)).slice(0, 8);
}

// construction periods: per Municipality file (start -> completed / planned), else the DLD project (start -> complete / planned / last % reading)
export function periods(ev, today) {
  const P = [], files = {};
  for (const e of ev) if (e.file && /Construction (started|completed)|PLANNED construction/i.test(e.what)) {
    const f = files[e.file] || (files[e.file] = { file: e.file });
    if (/started/i.test(e.what)) f.a = e.date; else if (/PLANNED/i.test(e.what)) { f.b = f.b || e.date; f.plan = true; } else { f.b = e.date; f.plan = false; }
  }
  for (const k in files) { const f = files[k]; if (f.a) P.push({ a: f.a, b: f.b || today, plan: !!f.plan || !f.b, file: f.file }); }
  if (!P.length) {
    const st = ev.find((e) => e.kind === "start"), dn = ev.slice().reverse().find((e) => e.kind === "done"), pl = ev.slice().reverse().find((e) => e.kind === "planned");
    if (st) P.push(dn ? { a: st.date, b: dn.date, plan: false } : { a: st.date, b: pl ? pl.date : today, plan: true });
  }
  return P.filter((p) => p.b >= p.a);
}

const TW = (s, fs) => s.length * fs * 0.56 + 2;   // conservative Inter width estimate
// lay the labels out in tiers above the axis; returns boxes so the test can prove nothing overlaps
export function layoutLabels(M, X, x0, x1) {
  const TIERS = [8, 34, 60], tierBoxes = TIERS.map(() => []), out = [];
  for (const m of M) {
    const cx = X(m.date), w = Math.max(TW(m.label, 8.6), TW(dShort(m.date), 7.6));
    let lx = Math.min(Math.max(cx - w / 2, x0 - 4), x1 + 4 - w);
    let placed = false;
    for (let t = 0; t < TIERS.length && !placed; t++) {
      const box = { x: lx, y: TIERS[t], w, h: 22 };
      if (tierBoxes[t].every((b) => box.x >= b.x + b.w + 4 || box.x + box.w + 4 <= b.x)) { tierBoxes[t].push(box); out.push(Object.assign({}, m, { cx, box })); placed = true; }
    }
  }
  return out;
}

export function storySvg(pp, pack, today) {
  const ev0 = storyEvents(pp, pack);
  if (!ev0.length) return null;
  const ev = collapse(ev0);
  const W = 760, LW = 128, x0 = LW + 12, x1 = W - 14, AY = 96, LY0 = 116, LH = 19, H = LY0 + LH * LANES.length + 2;
  const lo = ev0[0].date;
  let hi = ev0[ev0.length - 1].date; if (today > hi) hi = today;
  const t = (d) => Date.parse(d + "T00:00:00Z");
  const y0 = +lo.slice(0, 4), y1 = +hi.slice(0, 4) + 1, A = t(y0 + "-01-01"), B = t(y1 + "-01-01");
  const X = (d) => x0 + (x1 - x0) * (t(d) - A) / (B - A);
  const span = y1 - y0, step = span > 16 ? 4 : span > 9 ? 2 : 1;
  const tx = (x) => x.toFixed(1);
  let s = '<svg class="bpp-story-svg" viewBox="0 0 ' + W + " " + H + '" width="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Building story timeline" style="display:block;flex:none;width:100%;height:auto;font-family:Inter,Arial,sans-serif">';
  // lanes
  LANES.forEach((L, i) => {
    const y = LY0 + i * LH;
    s += '<rect x="0" y="' + (y - LH / 2 + 1) + '" width="' + W + '" height="' + (LH - 2) + '" rx="3" fill="' + (i % 2 ? "#F7F3EA" : "#EFE8D8") + '"/>'
      + '<text x="6" y="' + (y + 3) + '" font-size="8.4" font-weight="600" fill="#0A4F4A">' + esc(L.name) + '</text>';
  });
  // year ticks + axis (dashed past today)
  for (let y = y0; y <= y1; y += step) {
    const x = X(y + "-01-01");
    s += '<line x1="' + tx(x) + '" y1="' + (AY - 3) + '" x2="' + tx(x) + '" y2="' + (H - 2) + '" stroke="#D9CDB0" stroke-width="0.6"/>'
      + '<text x="' + tx(x) + '" y="' + (AY + 11) + '" font-size="7.6" fill="#8A6A2C" text-anchor="middle">' + y + '</text>';
  }
  const xt = Math.min(Math.max(X(today), x0), x1);
  s += '<line x1="' + x0 + '" y1="' + AY + '" x2="' + tx(xt) + '" y2="' + AY + '" stroke="#0A4F4A" stroke-width="1.6"/>';
  if (xt < x1) s += '<line x1="' + tx(xt) + '" y1="' + AY + '" x2="' + x1 + '" y2="' + AY + '" stroke="#0A4F4A" stroke-width="1.6" stroke-dasharray="4 3"/>';
  if (X(today) > x0 && X(today) < x1) s += '<line x1="' + tx(xt) + '" y1="' + (AY - 6) + '" x2="' + tx(xt) + '" y2="' + (H - 2) + '" stroke="#8A6A2C" stroke-width="0.8" stroke-dasharray="2 2"/><text x="' + tx(xt + 3) + '" y="' + (H - 4) + '" font-size="6.6" fill="#8A6A2C">today</text>';
  // construction periods
  const by = LY0 + LH;
  periods(ev0, today).forEach((p, i, a) => {
    const xa = X(p.a), xb = Math.max(X(p.b), xa + 3), h = a.length > 1 ? 6 : 9, yy = by - (a.length > 1 ? 7 - (i % 2) * 8 : 4.5);
    s += '<rect x="' + tx(xa) + '" y="' + yy.toFixed(1) + '" width="' + tx(xb - xa) + '" height="' + h + '" rx="2" fill="' + (p.plan ? "none" : "#0A4F4A") + '" fill-opacity="' + (p.plan ? 1 : 0.28) + '" stroke="#0A4F4A" stroke-width="0.8"' + (p.plan ? ' stroke-dasharray="3 2"' : "") + '/>';
  });
  // dots, one per lane per day (same-day repeats collapsed, count beside)
  const dots = new Map();
  for (const e of ev) { const k = e.lane + "|" + e.date; dots.set(k, (dots.get(k) || 0) + e.n); }
  for (const [k, n] of dots) {
    const [lane, d] = k.split("|"), i = LANES.findIndex((L) => L.id === lane), x = X(d), y = LY0 + i * LH, fut = d > today;
    s += '<circle cx="' + tx(x) + '" cy="' + y + '" r="' + (n > 1 ? 4.2 : 3) + '" fill="' + (fut ? "#F7F3EA" : lane === "permit" ? "#8A6A2C" : "#0A4F4A") + '" stroke="' + (lane === "permit" ? "#8A6A2C" : "#0A4F4A") + '" stroke-width="1"' + (fut ? ' stroke-dasharray="2 1.5"' : "") + '/>';
    if (n > 1) s += '<text x="' + tx(x + 6) + '" y="' + (y + 3) + '" font-size="7" font-weight="700" fill="#8A6A2C">' + n + '</text>';
  }
  // milestones with leader lines, labels in tiers
  const lab = layoutLabels(milestones(ev0, today), X, x0, x1);
  for (const m of lab) {
    const i = LANES.findIndex((L) => L.id === m.lane), ly = LY0 + Math.max(0, i) * LH, b = m.box, tcx = b.x + b.w / 2;
    s += '<path d="M' + tx(m.cx) + " " + ly + " V" + AY + " L" + tx(m.cx) + " " + (b.y + b.h + 1) + '" stroke="#C5A56A" stroke-width="0.8" fill="none"' + (m.planned ? ' stroke-dasharray="2 2"' : "") + '/>'
      + '<path d="M' + tx(m.cx) + " " + (AY - 5) + " l5 5 l-5 5 l-5 -5 z" + '" fill="' + (m.planned ? "#F7F3EA" : "#C5A56A") + '" stroke="#8A6A2C" stroke-width="0.9"/>'
      + '<text x="' + tx(tcx) + '" y="' + (b.y + 8) + '" font-size="7.6" fill="#8A6A2C" text-anchor="middle">' + esc(dShort(m.date)) + '</text>'
      + '<text x="' + tx(tcx) + '" y="' + (b.y + 18) + '" font-size="8.6" font-weight="600" fill="#0A4F4A" text-anchor="middle">' + esc(m.label) + '</text>';
  }
  s += "</svg>";
  return { svg: s, labels: lab, events: ev, raw: ev0, W, H };
}

export function storySummary(raw, today) {
  const f = (k) => raw.find((e) => e.kind === k), l = (k) => raw.slice().reverse().find((e) => e.kind === k);
  const P = [];
  const reg = f("reg") || raw.find((e) => /Buildings? entered/i.test(e.what));
  if (reg) P.push("Registered " + reg.date.slice(0, 4));
  const st = f("start"), dn = f("done"), pl = l("planned"), pct = l("pct");
  if (st && dn) P.push("built " + st.date.slice(0, 4) + (dn.date.slice(0, 4) !== st.date.slice(0, 4) ? "–" + dn.date.slice(0, 4) : ""));
  else if (st) P.push("construction from " + st.date.slice(0, 4) + (pct ? ", " + (pct.what.match(/(\d+)% complete/) || [])[1] + "% built at " + dShort(pct.date) : "") + (pl ? ", completion " + (pl.date > today ? "planned " : "was planned ") + dShort(pl.date) : ""));
  const s = f("sale"); if (s) P.push("first sale " + dShort(s.date) + (/off-plan/i.test(s.what) ? " (off-plan)" : /ready/i.test(s.what) ? " (ready)" : ""));
  const r = f("rent"); if (r) P.push("first rent " + dShort(r.date));
  const past = raw.filter((e) => e.date <= today && e.kind !== "planned"), z = past[past.length - 1];
  if (z) P.push("latest activity " + dShort(z.date) + ": " + short(z.what).replace(/^./, (c) => c.toLowerCase()));
  return P.join(" · ").replace(/^./, (c) => c.toUpperCase());
}

const SRCN = { g_dld__projects: "Land Department projects register", g_dld__buildings: "Land Department buildings register", chat_sales: "Land Department sales", chat_rent_contracts: "Ejari tenancy register", g_dm__project_information: "Municipality construction files", g_dm__building_permits: "Municipality building permits" };
export function storyBlock(pp, pack, today) {
  const r = storySvg(pp, pack, today);
  if (!r) return '<div style="font:500 8pt Inter,sans-serif;color:#5F6B66;padding:6mm 2mm">No dated events on record for this building yet.</div>';
  const src = [...new Set(r.raw.map((e) => SRCN[e.src]).filter(Boolean))];
  const rows = r.events.slice().reverse(), MAX = 6, shown = rows.slice(0, MAX);
  const li = shown.map((e) => '<li style="break-inside:avoid;margin:0 0 .6mm"><b style="font-weight:600;color:#8A6A2C">' + esc(dLong(e.date)) + "</b> " + esc(plural(e.label, e.n)) + (e.date > today ? " (planned)" : "") + "</li>").join("");
  return '<div class="bpp-story-in" style="width:100%;height:100%;overflow:hidden;display:flex;flex-direction:column;gap:1.2mm">' + r.svg
    + '<div style="font:600 8.2pt Inter,sans-serif;color:#0A4F4A;line-height:1.3">' + esc(storySummary(r.raw, today)) + "</div>"
    + '<div style="font:500 6.4pt Inter,sans-serif;color:#5F6B66">Sources: ' + esc(src.join("; ")) + ". Diamonds = milestones; bars = construction (dashed = planned); a number = same-day records." + (rows.length > MAX ? " Newest " + MAX + " of " + rows.length + " records listed." : "") + "</div>"
    + '<ol style="margin:0;padding:0;list-style:none;columns:2;column-gap:6mm;font:500 6.4pt Inter,sans-serif;color:#1C2826;line-height:1.25">' + li + "</ol>"
    + "</div>";
}

const STORY_RE = /(<div[^>]*class=(["'])[^"']*\bbpp-story\b[^"']*\2[^>]*>)\s*<\/div>/i;
export const hasStory = (html) => STORY_RE.test(String(html || ""));
export function placeStory(html, block) {
  if (!block) return html;
  return String(html).replace(STORY_RE, (m, open) => open + block + "</div>");
}
