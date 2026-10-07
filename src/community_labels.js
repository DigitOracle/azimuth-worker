// v307 - COMMUNITY LABELS: the app's districts are keyed by Land Department (DLD) area, but the market knows the same ground by another name.
// This curated table maps a district slug (the case-folded DLD area with spaces dropped) to the community name(s) a client would use, shown
// next to the DLD name: "DAMAC Lagoons (Al Hebiah Fifth)". One small module, no network, no fuzzy matching.
// Rules (research of 4 Oct 2026, projects-2026-09-01 register rows and the DLD sales extract):
//   - only a label the research marks as certain, with the reason beside it;
//   - where one DLD area holds several communities the list is shown whole, never one picked from it;
//   - an area with no entry shows its own name (no label is guessed).
// Not included on purpose: The Valley's neighbours (Sobha Sanctuary) - the register rows for Al Yufrah 1 name The Valley only.
export const COMMUNITY_LABELS = {
  alhebiahfifth: { dld: "Al Hebiah Fifth", labels: ["DAMAC Lagoons"], why: "all 2,183 register sales in this area are DAMAC Lagoons projects" },
  alyelayiss1: { dld: "Al Yelayiss 1", labels: ["DAMAC Islands"], why: "3,674 of 3,680 register sales are DAMAC Islands projects" },
  madinathind4: { dld: "Madinat Hind 4", labels: ["DAMAC Hills 2"], why: "all 727 register sales are DAMAC Hills 2 (Akoya) projects" },
  alyufrah1: { dld: "Al Yufrah 1", labels: ["The Valley"], why: "all 172 register sales are The Valley (Emaar)" },
  wadialsafa5: { dld: "Wadi Al Safa 5", labels: ["Arabian Ranches III", "Dubai Land Residence Complex"], why: "one area holding Arabian Ranches III and Dubai Land Residence Complex (Dubai Municipality community 648: Imtiaz Cove Edition Residences 1 to 6, Cove Grand, Cove Boulevard, Cove Living, Le Blanc); the 3,601 Imtiaz sales here are not Arabian Ranches III (4 Oct 2026 check)" },
  madinatalmataar: { dld: "Madinat Al Mataar", labels: ["Dubai South", "Emaar South", "Expo Living"], why: "one area holding several communities: Dubai South, Emaar South and Expo Living" },
  zaabeelsecond: { dld: "Zaabeel Second", labels: ["d3", "Artistry"], why: "one area holding d3 and Artistry" },
  alkhairanfirst: { dld: "Al Khairan First", labels: ["Dubai Creek Harbour"], why: "Dubai Creek Harbour is registered in this area" },
  majan: { dld: "Wadi Al Safa 3", labels: ["Majan"], why: "Majan is the Dubai Municipality community (645) that the Land Department files as Wadi Al Safa 3; the app's district slug is majan (the slug wadialsafa3 in the area map is the same ground)" },
  palmdeira: { dld: "Palm Deira", labels: ["Dubai Islands"], why: "Dubai Islands is registered in this area (Palm Deira)" },
  rasalkhor: { dld: "Ras Al Khor Industrial First", labels: ["Sobha One"], why: "3,349 of the 3,621 register sales (92%) are Sobha One and The Element at Sobha One; the scheme stands on the edge of the Ras Al Khor wildlife sanctuary (the flamingo sanctuary). The other 272 are Amaal 8 (Meydan Group)" },
  bukadra: { dld: "Bukadra", labels: ["Sobha Hartland II"], why: "8,249 of the 10,050 register sales (82%) are Sobha Skyvue, Skyscape and the six Riverside Crescent towers, the launches of Sobha Hartland II; the rest are Meydan Group projects (Claydon House by Ellington, Prestige One Parkway and Waterway, The Highgrove, Belmore). Meydan Horizon and Sobha Hartland II both stand inside this land district" },
  dubaiinvestmentparksecond: { dld: "Dubai Investment Park Second", labels: ["DAMAC Riverside", "Grand Polo Club"], why: "one area holding DAMAC Riverside and Grand Polo Club (Emaar)" },
};

// "Al Hebiah Fifth", "AL HEBIAH FIFTH" and "al-hebiah fifth" are one area: the register spells 104 area values in upper case.
export const foldArea = (s) => String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9]+/g, "");
const BY_FOLD = Object.fromEntries(Object.entries(COMMUNITY_LABELS).map(([slug, v]) => [foldArea(v.dld), slug]));
export const communitySlugOfArea = (area) => BY_FOLD[foldArea(area)] || null;   // case-folded DLD area -> district slug, only for labelled areas

// the community names for a district slug, or [] when none is on file
export const communitiesOf = (slug) => (COMMUNITY_LABELS[slug] ? COMMUNITY_LABELS[slug].labels.slice() : []);

// v373 - ATTRIBUTION AUDIT (Kendall, 7 Oct 2026): a district heading may carry ONE community, and only where that community is the whole district
// (flag `single`). A district that holds several communities, or one community with other projects beside it (Bukadra: 82% Sobha Hartland II, the rest
// Meydan Horizon), shows only its Land Department name: "an area with no entry shows its own name". A PROJECT is never labelled by a neighbour:
// projectAreaLabel() below gives it its own sales area or register master community.
const SINGLE = new Set(["alhebiahfifth", "alyelayiss1", "madinathind4", "alyufrah1", "palmdeira", "alkhairanfirst", "majan"]);

// "DAMAC Lagoons (Al Hebiah Fifth)" for a single-community district; every other district keeps the name it came with (never "A / B (DLD)").
export function labelledName(slug, name) {
  const e = COMMUNITY_LABELS[slug];
  if (!e || !SINGLE.has(slug) || e.labels.length !== 1) return name;
  return e.labels[0] + " (" + e.dld + ")";
}

// the table entry of a district that IS one community (for the area PDF's "Market name" line), else null
export const singleCommunity = (slug) => (COMMUNITY_LABELS[slug] && SINGLE.has(slug) && COMMUNITY_LABELS[slug].labels.length === 1 ? COMMUNITY_LABELS[slug] : null);

// The sales register spells an area as the community the market knows ("HORIZON"), not always as a name a client would say. Only the exceptions are listed;
// every other value is shown as the register spells it, in capitals-and-small-letters.
export const AREA_DISPLAY = { horizon: "Meydan Horizon", jlt: "Jumeirah Lakes Towers", arabianranches3: "Arabian Ranches III", arabianranchesiii: "Arabian Ranches III", jumeriahbeachresidencejbr: "Jumeirah Beach Residence", sobhaheartland: "Sobha Hartland" };   // v382: the register spells one community several ways
const titleArea = (s) => { s = String(s || "").replace(/\s+/g, " ").trim(); return /[a-z]/.test(s) && /[A-Z]/.test(s) ? s : s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()); };
export const areaDisplay = (raw) => { const k = foldArea(raw); return !k ? "" : (AREA_DISPLAY[k] || titleArea(raw)); };

// The area label of ONE PROJECT: the community its own sales rows are registered in (AREA_EN of the sales register, e.g. HORIZON), else its register master
// community (master_project_en), else the district's label. A value that is only the district's own Land Department name (the register's land area, e.g. Bukadra,
// Jabal Ali First) is not a community: it never beats a real community, and when nothing better exists the project shows the district's label (a single community)
// or the DLD name. returns {label, source}: source is "sales_area" | "register_master" | "district". dldAreas: the DLD land-area names of the district.
export function projectAreaLabel({ slug, districtName, salesArea, masterCommunity, dldAreas, aka }) {
  const dist = labelledName(slug, districtName);   // v382 - districtName is the HEADING (headingName); aka: other names the district list carried for the same ground (never a community, never shown)
  const own = new Set([foldArea(districtName), COMMUNITY_LABELS[slug] ? foldArea(COMMUNITY_LABELS[slug].dld) : ""].concat((dldAreas || []).map(foldArea), (aka || []).map(foldArea)).filter(Boolean));
  const community = (a) => { const f = foldArea(a); return f && !own.has(f); };
  if (salesArea && community(salesArea)) return { label: areaDisplay(salesArea), source: "sales_area" };
  if (masterCommunity && community(masterCommunity)) return { label: areaDisplay(masterCommunity), source: "register_master" };
  return { label: dist, source: "district" };
}

// v382 - AREA HEADINGS (Kendall, 7 Oct 2026): a district HEADING is the plain Land Department name of the district, never a combined label that borrows a community ("Sobha Hartland II / Bukadra",
// "Sobha One / Ras Al Khor", "JLT / Al Thanyah 5"). Where the district list we are fed carries such a name (it came from the Dubai Municipality polygon file) or an older spelling (Jebel Ali),
// this table gives the Land Department name. Every other district keeps the name it came with. The communities a district holds are NOT written by hand: see areaCommunities().
export const DLD_HEADING = { bukadra: "Bukadra", rasalkhor: "Ras Al Khor Industrial First", althanyahfifth: "Al Thanyah Fifth", jabalalifirst: "Jabal Ali First", jabalaliindustrialsecond: "Jabal Ali Industrial Second" };
export function headingName(slug, name) {
  if (DLD_HEADING[slug]) return DLD_HEADING[slug];
  const n = String(name || slug);
  return n.indexOf(" / ") >= 0 ? n.split(" / ").pop().trim() : n;      // a join of two names is never a heading: the last part is the land district
}

// The quiet second line of a district heading, built from the projects' own areas: [{a: area label, as: source, n: sales}] -> the communities (sales_area / register_master only; a
// project that fell back to the district name says nothing about a community) other than the heading itself, biggest first, at most `max`, each holding at least `minShare` of the
// classified sales or at least `minProjects` projects (one project that a name lookup placed elsewhere is not a community of the district). Returns [] when the data names none.
export function areaCommunities(projects, heading, max = 5, minShare = 0.1, minProjects = 2) {
  const hf = foldArea(heading), tot = {}; let all = 0;
  for (const p of projects || []) {
    if (!p || !p.a || (p.as !== "sales_area" && p.as !== "register_master")) continue;
    const f = foldArea(p.a); if (!f || f === hf || hf.indexOf(f) >= 0 || f.indexOf(hf) >= 0) continue;
    const w = Math.max(1, Number(p.n) || 1); const e = tot[f] || (tot[f] = { a: p.a, n: 0, p: 0 }); e.n += w; e.p++; all += w;
  }
  return Object.values(tot).filter((e) => e.n >= minShare * all || e.p >= minProjects).sort((x, y) => y.n - x.n || (x.a < y.a ? -1 : 1)).slice(0, max).map((e) => e.a);
}
