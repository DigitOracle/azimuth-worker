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
  bukadra: { dld: "Bukadra", labels: ["Sobha Hartland II"], why: "8,249 of the 10,050 register sales (82%) are Sobha Skyvue, Skyscape and the six Riverside Crescent towers, the launches of Sobha Hartland II; the rest are Meydan Group projects (Claydon House by Ellington, Prestige One Parkway and Waterway, The Highgrove, Belmore). The Dubai Municipality community is named Sobha Hartland II / Bukadra" },
  dubaiinvestmentparksecond: { dld: "Dubai Investment Park Second", labels: ["DAMAC Riverside", "Grand Polo Club"], why: "one area holding DAMAC Riverside and Grand Polo Club (Emaar)" },
};

// "Al Hebiah Fifth", "AL HEBIAH FIFTH" and "al-hebiah fifth" are one area: the register spells 104 area values in upper case.
export const foldArea = (s) => String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9]+/g, "");
const BY_FOLD = Object.fromEntries(Object.entries(COMMUNITY_LABELS).map(([slug, v]) => [foldArea(v.dld), slug]));
export const communitySlugOfArea = (area) => BY_FOLD[foldArea(area)] || null;   // case-folded DLD area -> district slug, only for labelled areas

// the community names for a district slug, or [] when none is on file
export const communitiesOf = (slug) => (COMMUNITY_LABELS[slug] ? COMMUNITY_LABELS[slug].labels.slice() : []);

// "DAMAC Lagoons (Al Hebiah Fifth)"; several communities are joined with " / ". An unlabelled district keeps the name it came with.
export function labelledName(slug, name) {
  const e = COMMUNITY_LABELS[slug];
  if (!e) return name;
  return e.labels.join(" / ") + " (" + e.dld + ")";
}
