// v284 - THE FACT LEDGER (Kendall, 1 Oct 2026: "we have all these different sources and you're still struggling to stop her
// feed repeating").
//
// What was wrong, measured on 1 Oct 2026 (two runs of the morning on fresh data, 42 angles refused between them):
//   - the generator was handed every block raw (28 KB, ~200 quotable numbers) plus a list of 59 numbers and 22 subjects NOT to
//     use, and asked to avoid them in prose. It went back to the same favourites anyway: Madinat Al Mataar six times, resting
//     plan figures six times, across the first pass, the repair passes and every top-up;
//   - half of all refusals (21 of 42) were "same subject", and 15 of those 21 were a subject of the form "<family>:-" - an angle
//     that names no district or developer on the short ENTITY list files under its FAMILY, so one rents angle yesterday locked
//     every rents angle for five days. 13 of the 14 families were locked that way on 1 Oct. That is a family lock, not a
//     subject lock, and it is what killed the Khaleej Times rent story at the gate;
//   - the register held 178 numbers she had never been given, and the app held sources the feed never read at all: the per-area
//     settled prices (areaIntel, 60 areas), the project pipeline by area, the Ejari filed leases.
//
// So the guards were not the main problem and neither was the size of the pool: the generator was choosing from everything and
// being punished afterwards. This module is PREVENTION: it turns every source into candidate facts with stable ids, and
// index.js drops the ones she has already had - with the SAME tests the guards use - before the generator sees anything. The
// generator is handed only fresh facts and must build each angle on one of them (its id in `fact`). Every guard still runs
// afterwards; their job is now the safety net.
//
// A fact: { id, block, kind: plan|re|news, family, subject, figure, says, buyer, source, reader, good }
//   id       stable for the same figure in the same period, so the history can say "this fact was used on <date>"
//   figure   the exact figure with its unit, as an angle must carry it
//   says     one plain-English sentence that states the fact with its period - every number in it is in the data
//   subject  the place, developer or line the fact is about (lower case), "" when it is city-wide
//   good     true when the honest reading is good news (her disposition: four of five good)
// Nothing here reads KV or calls a model: index.js loads the data and hands it in, so this is testable on its own.

const nf = (v) => Math.round(Number(v) || 0).toLocaleString("en-US");
const n1 = (v) => (Math.round(Number(v) * 10) / 10).toLocaleString("en-US", { maximumFractionDigits: 1 });
const aed = (v) => "AED " + nf(v);
const low = (s) => String(s || "").replace(/\s+/g, " ").trim().toLowerCase();
const titleCase = (s) => String(s || "").toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\bJvc\b/, "JVC").replace(/\bJlt\b/, "JLT").replace(/\bJvt\b/, "JVT");
const slug = (s) => low(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dSay = (iso) => { const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? Number(m[3]) + " " + MON[Number(m[2]) - 1] + " " + m[1] : String(iso || ""); };
const span = (a, b) => dSay(a) + " to " + dSay(b);

// the plan's themes, filed where the generation prompt already files them
const PLAN_FAMILY = { population: "growth_plan", centres: "growth_plan", tourism: "growth_plan", economy: "growth_plan", delivery: "growth_plan", history: "growth_plan",
  beaches: "city_life", green: "city_life", nature: "city_life", walk: "city_life", leisure: "city_life", education_health: "education", metro: "transit" };

export function planFacts(plan) {
  return ((plan && plan.facts) || []).map((f) => ({
    id: "plan:" + f.theme + ":" + slug(f.figure), block: "dubai2040", kind: "plan", family: PLAN_FAMILY[f.theme] || "growth_plan", subject: f.theme,
    figure: String(f.figure), says: "The Dubai 2040 Urban Master Plan: " + String(f.says).replace(/\.?\s*$/, "."), status: f.status,
    buyer: f.status === "target" ? "A 2040 target, not yet achieved - what the city is being planned around." : f.status === "delivered" ? "Already approved or delivered since the plan launched." : "Planned or announced, not yet built.",
    source: f.source + ", " + f.date, reader: f.reader || "invest", good: true
  }));
}

// the DLD register blocks of mkt_latest (the same data the feed has always had, now one fact per figure)
export function registerFacts(d, trends) {
  const out = [];
  const add = (f) => { if (f && f.figure && /\d/.test(f.figure)) out.push(Object.assign({ kind: "re", good: true }, f)); };
  const t = d && d.transactions;
  const per = t ? span(t.periodFrom, t.periodTo) : "";
  const perSrc = t ? "DLD Open Data, " + t.periodFrom + " to " + t.periodTo : "DLD Open Data";
  if (t) {
    for (const a of (t.topAreas || []).slice(0, 10)) add({ id: "dld:sales:" + slug(a.area) + ":" + t.periodTo, block: "dldSales", family: "volume", subject: low(a.area), figure: nf(a.sales) + " sales",
      says: titleCase(a.area) + " recorded " + nf(a.sales) + " registered sales from " + per + ".", buyer: "Where buyers actually signed, from the register.", source: perSrc, reader: "invest" });
    if (t.offPlanSplit && t.offPlanSplit["Off-Plan"]) add({ id: "dld:offplan:" + t.periodTo, block: "dldSales", family: "offplan_ready", subject: "", figure: nf(t.offPlanSplit["Off-Plan"]) + " off-plan sales",
      says: "Off-plan homes took " + nf(t.offPlanSplit["Off-Plan"]) + " registered sales from " + per + ", against " + nf(t.offPlanSplit.Ready) + " ready homes.", buyer: "Most buyers are choosing homes still being built.", source: perSrc, reader: "invest" });
    if (t.medianResidentialAedSqft) add({ id: "dld:sqft:" + t.periodTo, block: "dldSales", family: "prices", subject: "", figure: aed(t.medianResidentialAedSqft) + " per sq ft",
      says: "The median settled residential price in Dubai was " + aed(t.medianResidentialAedSqft) + " per sq ft from " + per + ".", buyer: "What a square foot actually sold for, not an asking price.", source: perSrc, reader: "authority" });
  }
  const mo = (d && d.monthly && d.monthly.series) || [];
  if (mo.length >= 2) {
    const m = mo[mo.length - 2];   // the last COMPLETE month (the last one is partial)
    add({ id: "dld:month:" + m.month, block: "monthly", family: "volume", subject: "", figure: "AED " + m.valueAedBn + " billion",
      says: "Registered sales in " + m.month + " came to AED " + m.valueAedBn + " billion across " + nf(m.sales) + " deals.", buyer: "A full month of the register, start to finish.", source: "DLD Open Data, registered sales by month", reader: "authority" });
  }
  for (const tr of (trends || [])) {
    if (!tr || tr.values == null) continue;
    const up = tr.change > 0;
    add({ id: "trend:" + slug(tr.metric) + ":" + tr.to, block: "trends", family: /value/.test(tr.metric) ? "prices" : "volume", subject: "", figure: (tr.changePct > 0 ? "+" : "") + tr.changePct + "%",
      says: "The " + tr.metric + " moved from " + tr.values[0] + " in " + tr.from + " to " + tr.values[1] + " in " + tr.to + " (" + (tr.changePct > 0 ? "+" : "") + tr.changePct + "%).", buyer: up ? "The register moving up." : "A softer period - more room for a buyer.", source: tr.source, reader: "authority", good: up });
  }
  const r = d && d.rents;
  if (r) {
    const rs = "DLD rent register (Ejari), " + r.registrationFrom + " to " + r.registrationTo;
    for (const y of (r.grossYieldPctByArea || [])) add({ id: "rent:yield:" + slug(y.area) + ":" + r.registrationTo, block: "rents", family: "rents_yields", subject: low(y.area), figure: n1(y.yieldPct) + "% gross yield",
      says: titleCase(y.area) + " shows a " + n1(y.yieldPct) + "% gross rental yield, from " + nf(y.rentSamples) + " rents and " + nf(y.saleSamples) + " sales on the register.", buyer: "What a home there earns before costs.", source: rs, reader: "invest" });
    if (r.medianAnnualRentAed) add({ id: "rent:median:" + r.registrationTo, block: "rents", family: "rents_yields", subject: "", figure: aed(r.medianAnnualRentAed) + " a year",
      says: "The median annual rent on the register was " + aed(r.medianAnnualRentAed) + ", across " + nf(r.contractsCount) + " contracts from " + span(r.registrationFrom, r.registrationTo) + ".", buyer: "The middle of the rent market, from signed contracts.", source: rs, reader: "move" });
  }
  // areaIntel - per-area settled prices and room-type medians. The feed never read this block before v284.
  const ai = (d && d.areaIntel && d.areaIntel.areas) || [];
  for (const a of ai.slice(0, 30)) {
    const sub = low(a.area), nm = titleCase(a.area);
    if (a.medianAedSqft) add({ id: "area:sqft:" + slug(a.area) + ":" + (t ? t.periodTo : ""), block: "areaIntel", family: "prices", subject: sub, figure: aed(a.medianAedSqft) + " per sq ft",
      says: "Homes in " + nm + " settled at a median " + aed(a.medianAedSqft) + " per sq ft from " + per + ", across " + nf(a.sales) + " sales.", buyer: "The settled price there, not the asking price.", source: perSrc + " (settled prices by area)", reader: "invest" });
    const room = (a.byRoom || {});
    const st = room.Studio, one = room["1 B/R"];
    if (one && one.sales >= 20) add({ id: "area:1br:" + slug(a.area) + ":" + (t ? t.periodTo : ""), block: "areaIntel", family: "buyer_maths", subject: sub, figure: aed(one.medianAed),
      says: "A 1-bedroom in " + nm + " settled at a median " + aed(one.medianAed) + " from " + per + " (" + nf(one.sales) + " sales).", buyer: "What a 1-bedroom there actually costs.", source: perSrc + " (settled prices by area)", reader: "move" });
    else if (st && st.sales >= 20) add({ id: "area:studio:" + slug(a.area) + ":" + (t ? t.periodTo : ""), block: "areaIntel", family: "buyer_maths", subject: sub, figure: aed(st.medianAed),
      says: "A studio in " + nm + " settled at a median " + aed(st.medianAed) + " from " + per + " (" + nf(st.sales) + " sales).", buyer: "The entry ticket there, from the register.", source: perSrc + " (settled prices by area)", reader: "move" });
    if (a.netYieldPct != null && a.yieldArea && low(a.yieldArea) === sub) add({ id: "area:net:" + slug(a.area) + ":" + (t ? t.periodTo : ""), block: "areaIntel", family: "rents_yields", subject: sub, figure: n1(a.netYieldPct) + "% net yield",
      says: nm + " returns a " + n1(a.netYieldPct) + "% net yield after service charges (" + n1(a.grossYieldPct) + "% gross).", buyer: "What is left after the service charge.", source: "DLD Open Data and RERA service-charge ranges", reader: "invest" });
  }
  // the DLD project pipeline by area and by delivery year - also never read by the feed before v284
  const p = d && d.projects;
  if (p && p.supplyByArea) {
    const rows = Object.entries(p.supplyByArea).filter(([, v]) => v && v.units >= 200).sort((x, y) => y[1].units - x[1].units).slice(0, 12);
    for (const [area, v] of rows) add({ id: "pipe:area:" + slug(area) + ":" + (v.units || 0), block: "projects", family: "handover_supply", subject: low(area), figure: nf(v.units) + " units",
      says: titleCase(area) + " has " + nf(v.units) + " units across " + nf(v.projects) + " projects in the DLD project register" + (v.nextEnd ? ", the next due " + dSay(v.nextEnd) : "") + ".", buyer: "New homes on their way to that area.", source: "DLD project register", reader: "invest" });
  }
  if (p && p.deliveryByYear) for (const [y, u] of Object.entries(p.deliveryByYear)) if (u >= 1000) add({ id: "pipe:year:" + y + ":" + u, block: "projects", family: "handover_supply", subject: "", figure: nf(u) + " units",
    says: nf(u) + " units in the DLD project register are due for completion in " + y + ".", buyer: "When the new supply lands.", source: "DLD project register", reader: "invest" });
  return out;
}

// cityLife, MEED and the developers' own sheets
export function otherFacts(d) {
  const out = [];
  const add = (f) => { if (f && f.figure && /\d/.test(f.figure)) out.push(Object.assign({ kind: "re", good: true }, f)); };
  const c = (d && d.cityLife) || {};
  if (c.metro) for (const x of (c.metro.closest || []).slice(0, 5)) add({ id: "metro:" + slug(x.district) + ":" + x.km, block: "cityLife", family: "transit", subject: low(x.district), figure: x.km + " km",
    says: x.district + " is " + x.km + " km from " + x.station + " on the " + x.line + ".", buyer: "A metro station within reach of home.", source: "RTA metro network, distance by district", reader: "move" });
  if (c.busCoverage) {
    const b = c.busCoverage, src = "RTA bus network coverage, " + dSay(b.reportDate);
    for (const x of (b.bestServed || []).slice(0, 3)) add({ id: "bus:" + slug(x.community) + ":" + x.stops, block: "cityLife", family: "city_life", subject: low(x.community), figure: nf(x.stops) + " bus stops",
      says: titleCase(x.community) + " has " + nf(x.stops) + " bus stops for " + nf(x.residents) + " residents, with " + x.coveragePct + "% of the community covered.", buyer: "A community easy to get around without a car.", source: src, reader: "move" });
    if (b.cityCoveragePct) add({ id: "bus:city:" + b.reportDate, block: "cityLife", family: "city_life", subject: "", figure: b.cityCoveragePct + "%",
      says: "RTA buses cover " + b.cityCoveragePct + "% of Dubai's residents, with " + nf(b.stops) + " stops across " + nf(b.communities) + " communities.", buyer: "Most of the city is within reach of a bus.", source: src, reader: "move" });
  }
  if (c.heritage && c.heritage.mostVisited) for (const h of c.heritage.mostVisited.slice(0, 2)) add({ id: "heritage:" + slug(h.site) + ":" + h.throughYear, block: "cityLife", family: "city_life", subject: low(h.site), figure: nf(h.visitors) + " visitors",
    says: "The " + h.site + " drew " + nf(h.visitors) + " visitors through " + h.throughYear + ".", buyer: "The city's history, and people going to see it.", source: "Dubai Culture heritage visitor counts", reader: "move" });
  const m = (d && d.meed) || {};
  for (const x of (m.developments || []).slice(0, 8)) if (x.activeProjects && x.pipelineValueUsdM) add({ id: "meed:dev:" + slug(x.development) + ":" + x.pipelineValueUsdM, block: "developments", family: "developer", subject: low(x.developer),
    figure: "USD " + nf(x.pipelineValueUsdM) + " million", says: x.developer + "'s " + x.development + " carries USD " + nf(x.pipelineValueUsdM) + " million of work across " + x.activeProjects + " active project" + (x.activeProjects === 1 ? "" : "s") + (x.nextCompletion ? ", the next completion due " + dSay(x.nextCompletion) : "") + ".",
    buyer: "A developer with work on the ground.", source: "MEED Projects corpus", reader: "invest" });
  for (const x of (m.largestUnderConstruction || []).slice(0, 5)) if (x.valueUsdM) add({ id: "meed:uc:" + x.id, block: "supply", family: "handover_supply", subject: low(String(x.title).split(" - ")[0]),
    figure: "USD " + nf(x.valueUsdM) + " million", says: x.title + " is under construction, valued at USD " + nf(x.valueUsdM) + " million.", buyer: "One of the largest projects being built in Dubai.", source: "MEED Projects corpus, updated " + dSay(x.updated), reader: "invest" });
  const inv = (d && d.developerInventory) || {};
  for (const x of (inv.current || [])) if (x.units >= 20) add({ id: "inv:" + slug(x.developer) + ":" + x.date + ":" + x.units, block: "developerInventory", family: "inventory", subject: low(x.developer), figure: nf(x.units) + " units",
    says: x.developer + "'s own sheet of " + dSay(x.date) + " lists " + nf(x.units) + " units still available across " + x.projects + " project" + (x.projects === 1 ? "" : "s") + ", from " + aed(x.from_aed) + ".", buyer: "Stock the developer itself says is on offer.", source: x.developer + " availability sheet, " + dSay(x.date), reader: "invest" });
  for (const x of (inv.moves || [])) if (Math.abs(x.change) >= 20) add({ id: "invmove:" + slug(x.developer) + ":" + slug(x.project) + ":" + x.to, block: "developerInventory", family: "inventory", subject: low(x.developer), figure: nf(Math.abs(x.change)) + " units",
    says: x.developer + " " + (x.movement === "released" ? "released" : "saw taken up") + " " + nf(Math.abs(x.change)) + " " + x.type + " units at " + x.project + " between " + dSay(x.from) + " and " + dSay(x.to) + ".", buyer: "", source: x.developer + " availability sheets", reader: "invest" });
  return out;
}

// EJARI - leases filed, the week against the week before (Dubai-wide, by area, by the register's own sub-type). The doc is
// feed_ejari.js's ejDoc() of img_ejari_filed_dubai. Whole days only: the file's last day is half-filed, so it is never used.
export function ejariFacts(doc, today, subSay) {
  const out = [];
  if (!doc || !doc.rows || !doc.rows.length || !doc.asOf) return out;
  const DAY = 86400000, ms = (s) => Date.parse(s + "T00:00:00Z"), ds = (x) => new Date(x).toISOString().slice(0, 10);
  if ((ms(today) - ms(doc.asOf)) / DAY > 3) return out;   // the card's own limit: stale Ejari says nothing
  const yest = ds(ms(today) - DAY), lastFull = doc.last && doc.last < doc.asOf ? doc.last : ds(ms(doc.asOf) - DAY);
  const to = lastFull < yest ? lastFull : yest, from = ds(ms(to) - 6 * DAY), pTo = ds(ms(from) - DAY), pFrom = ds(ms(pTo) - 6 * DAY);
  if (!doc.first || doc.first > pFrom) return out;
  const live = doc.rows.filter((r) => !r.desk);
  const sum = (pred, a, b) => live.reduce((s, r) => s + (r.date >= a && r.date <= b && pred(r) ? r.n : 0), 0);
  const pct = (a, b) => (b > 0 ? Math.round(((a - b) / b) * 100) : null);
  const src = "Dubai Land Department, Ejari tenancy register, contracts filed " + span(from, to);
  const per = span(from, to), tail = " Contracts signed, not homes available.";
  const isNew = (r) => r.reg === "New";
  const nNew = sum(isNew, from, to), pNew = sum(isNew, pFrom, pTo), nRen = sum((r) => r.reg === "Renew", from, to), pRen = sum((r) => r.reg === "Renew", pFrom, pTo);
  const pc = (x) => (x == null ? "" : ", " + (x >= 0 ? x + "% more than" : Math.abs(x) + "% fewer than") + " the 7 days before");
  if (nNew) out.push({ id: "ejari:new:dubai:" + to, block: "ejari", kind: "re", family: "rents_yields", subject: "ejari dubai", figure: nf(nNew) + " new leases",
    says: nf(nNew) + " new tenancy contracts were filed with Ejari across Dubai from " + per + pc(pct(nNew, pNew)) + "." + tail, buyer: "People signing up to live here, week by week.", source: src, reader: "move", good: pct(nNew, pNew) == null || pct(nNew, pNew) >= 0 });
  if (nRen) out.push({ id: "ejari:renew:dubai:" + to, block: "ejari", kind: "re", family: "rents_yields", subject: "ejari renewals", figure: nf(nRen) + " renewals",
    says: nf(nRen) + " tenancy renewals were filed with Ejari from " + per + pc(pct(nRen, pRen)) + "." + tail, buyer: "Tenants choosing to stay where they are.", source: src, reader: "authority", good: pct(nRen, pRen) == null || pct(nRen, pRen) >= 0 });
  // by area - the busiest areas for new leases this week, each with its own week-on-week move
  const byA = {}, prevA = {};
  for (const r of live) if (isNew(r) && r.area) { if (r.date >= from && r.date <= to) byA[r.area] = (byA[r.area] || 0) + r.n; else if (r.date >= pFrom && r.date <= pTo) prevA[r.area] = (prevA[r.area] || 0) + r.n; }
  for (const a of Object.keys(byA).filter((k) => byA[k] >= 30).sort((x, y) => byA[y] - byA[x]).slice(0, 8)) {
    const p = prevA[a] >= 20 ? pct(byA[a], prevA[a]) : null;
    out.push({ id: "ejari:area:" + slug(a) + ":" + to, block: "ejari", kind: "re", family: "district", subject: low(a), figure: nf(byA[a]) + " new leases",
      says: nf(byA[a]) + " new tenancy contracts were filed with Ejari in " + titleCase(a) + " from " + per + pc(p) + "." + tail, buyer: "Where people are moving in this week.", source: src, reader: "move", good: p == null || p >= 0 });
  }
  // by the register's own sub-type (Hotel apartments, villas, offices, shops) - Kendall: "the sub type field is valuable"
  const bySub = {}, prevSub = {};
  for (const r of live) if (isNew(r) && r.sub) { const s = subSay ? subSay(r.sub) : r.sub; if (r.date >= from && r.date <= to) bySub[s] = (bySub[s] || 0) + r.n; else if (r.date >= pFrom && r.date <= pTo) prevSub[s] = (prevSub[s] || 0) + r.n; }
  for (const s of Object.keys(bySub).filter((k) => bySub[k] >= 25 && !/^flat$|labou?r camp|staff accommodation|warehouse|workshop/i.test(k)).sort((x, y) => bySub[y] - bySub[x]).slice(0, 5)) {
    const p = prevSub[s] >= 20 ? pct(bySub[s], prevSub[s]) : null, word = s.toLowerCase();
    out.push({ id: "ejari:sub:" + slug(s) + ":" + to, block: "ejari", kind: "re", family: /hotel|villa/i.test(s) ? "offplan_ready" : "buyer_maths", subject: "ejari " + word, figure: nf(bySub[s]) + " new leases",
      says: nf(bySub[s]) + " new " + word + " leases (the register's own sub-type) were filed with Ejari from " + per + pc(p) + "." + tail, buyer: "Which kinds of home people are renting right now.", source: src, reader: "invest", good: p == null || p >= 0 });
  }
  return out;
}

// NEWS - each story the feed is handed with a real figure in its title or summary becomes one fact; the figure is copied out of
// the story's own words (Dh39, 16%, 200km), so the news honesty rule can only pass it.
const NEWS_FIG_RX = /(?:(?:AED|Dh|USD|\$)\s?\d[\d,]*(?:\.\d+)?\s?(?:bn|billion|million|m|k)?)|(?:\d[\d,]*(?:\.\d+)?\s?(?:%|per cent|km|kilometres|units|homes|villas|apartments|towers|stations|daily journeys|journeys|passengers|transactions|deals|sales|lanes|schools|metres|sq ft|beds?|minutes|hours))/i;
export function newsFacts(news) {
  const out = [];
  for (const it of (Array.isArray(news) ? news : [])) {
    const txt = String(it.title || "") + " " + String(it.summary || "");
    const m = txt.match(NEWS_FIG_RX); if (!m) continue;
    const fig = m[0].trim();
    if (/^20\d\d\b/.test(fig.replace(/[^0-9]/g, "")) && !/[%]|AED|Dh/i.test(fig)) continue;
    const lead = (Array.isArray(it.names) ? it.names : []).find(Boolean) || "";
    const fam = /metro|rail|tram|road|rta|station|bus|airport|transport|commute|petrol/i.test(txt) ? "transit" : /develop|launch|project|tower/i.test(txt) ? "developer" : /rent|tenan|lease|landlord/i.test(txt) ? "rents_yields" : "news";
    const date = String(it.published || "").replace(/\s+\d{2}:\d{2}.*$/, "");
    out.push({ id: "news:" + slug(it.outlet) + ":" + slug(it.title).slice(0, 60), block: "news", kind: "news", family: fam, subject: low(lead), figure: fig,
      says: String(it.title || "").replace(/\s+/g, " ").trim().replace(/\.?$/, "."), buyer: "Today's city news, as reported.", source: "reported by " + it.outlet + ", " + date, reader: fam === "transit" ? "move" : "invest", good: true, outlet: it.outlet, today: !!it.today });
  }
  return out;
}

// THE MENU - what the generator is handed: fresh facts only, a balanced spread across sources so no block crowds out the rest,
// subjects she has not heard about lately first, good news first, and the start rotated by the day so two mornings with the
// same pool do not open on the same facts.
export function factMenu(fresh, opts) {
  opts = opts || {};
  const day = opts.dayIndex || 0, recentSubj = opts.recentSubjects || new Set();
  const perBlock = opts.perBlock || 5, cap = opts.cap || 44;
  const score = (f) => (recentSubj.has(f.subject) && f.subject ? 2 : 0) + (f.good ? 0 : 1);
  const plan = fresh.filter((f) => f.kind === "plan");
  const news = fresh.filter((f) => f.kind === "news").slice(0, 8);
  const re = fresh.filter((f) => f.kind === "re");
  const blocks = {}; for (const f of re) (blocks[f.block] = blocks[f.block] || []).push(f);
  const lists = [];
  for (const b of Object.keys(blocks).sort()) {
    const L = blocks[b]; const rot = L.length ? day % L.length : 0;
    const rotated = L.slice(rot).concat(L.slice(0, rot)).map((f, i) => ({ f, i })).sort((x, y) => score(x.f) - score(y.f) || x.i - y.i).map((x) => x.f);
    lists.push(rotated.slice(0, perBlock));
  }
  const pickRe = [];   // round-robin across the blocks, so a cap trims every block a little rather than the last blocks entirely
  for (let k = 0; k < perBlock; k++) for (const L of lists) if (L[k]) pickRe.push(L[k]);
  const rotP = plan.length ? day % plan.length : 0;
  const planR = plan.slice(rotP).concat(plan.slice(0, rotP));
  const P = planR.slice(0, 8);   // the news is never crowded out by the register: the cap trims the register blocks, not the stories
  return P.concat(pickRe.slice(0, Math.max(0, cap - P.length - news.length)), news);
}
