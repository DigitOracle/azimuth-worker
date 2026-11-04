// v737 - community names people know, beside the official DLD/DM district name (Kendall, 4 Nov 2026: DAMAC Hills was only findable as "Al Hebiah Third").
// Static: district slug (pp_dl) -> community labels. Only communities we are sure sit in that district; when unsure the district shows its official name alone.
export const DISTRICT_COMMUNITIES = {
  damachills: ["DAMAC Hills"],
  motorcity: ["Motor City"],
  dubaisportscity: ["Dubai Sports City"],
  dubaistudiocity: ["Dubai Studio City"],
  jumeirahvillagecircle: ["JVC - Jumeirah Village Circle"],
  jumeirahvillagetriangle: ["JVT - Jumeirah Village Triangle"],
  dubaisciencepark: ["Dubai Science Park"],
  arjan: ["Arjan"],
  dubaihills: ["Dubai Hills Estate"],
  dubaimarina: ["Dubai Marina", "JBR - Jumeirah Beach Residence"],
  althanyahfifth: ["JLT - Jumeirah Lake Towers"],
  burjkhalifa: ["Downtown Dubai"],
  businessbay: ["Business Bay"],
  palmjumeirah: ["Palm Jumeirah"],
  palmjabalali: ["Palm Jebel Ali"],
  palmdeira: ["Dubai Islands"],
  meydanone: ["Meydan"],
  siliconoasis: ["Dubai Silicon Oasis"],
  dubaiproductioncity: ["Dubai Production City (IMPZ)"],
  dubaiindustrialcity: ["Dubai Industrial City"],
  dubaimaritimecity: ["Dubai Maritime City"],
  samaaljadaf: ["Al Jaddaf"],
  alkhairanfirst: ["Dubai Creek Harbour"],
  liwan1: ["Liwan"],
  majan: ["Majan"],
  jabalalifirst: ["Al Furjan", "Discovery Gardens"],
  dubaiinvestmentparkfirst: ["Dubai Investment Park"],
  dubaiinvestmentparksecond: ["Dubai Investment Park"],
  madinatalmataar: ["Dubai South"],
  worldislands: ["The World Islands"],
};
// typed words that should also find a district (sister districts of a known community)
export const DISTRICT_SEARCH_EXTRA = {
  motorcity: "damac hills", dubaisportscity: "damac hills", dubaistudiocity: "damac hills", alhebiahfifth: "damac hills", alhebiahsixth: "damac hills",
};
const nrm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
// the label shown: "DAMAC Hills (Al Hebiah Third)"; up to 2 communities, then "+N"; official name alone when it already says the same thing
export function districtLabel(d) {
  const c = DISTRICT_COMMUNITIES[d && d.slug] || [], nm = (d && d.name) || "";
  const shown = c.filter((x) => nrm(x) !== nrm(nm));
  if (!shown.length) return nm;
  return shown.slice(0, 2).join(", ") + (shown.length > 2 ? " +" + (shown.length - 2) : "") + " (" + nm + ")";
}
// add label + search words to every district row (the packs stay as built)
export function withCommunities(list) {
  return (list || []).map((d) => {
    const c = (DISTRICT_COMMUNITIES[d.slug] || []).map(nrm); if (DISTRICT_SEARCH_EXTRA[d.slug]) c.push(DISTRICT_SEARCH_EXTRA[d.slug]);
    return Object.assign({}, d, { label: districtLabel(d), kw: c.join(" | ") });
  });
}
