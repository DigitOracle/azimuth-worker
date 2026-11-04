// v734 - Building Passport neighbourhood from LOCATION for every plot (Kendall, 4 Nov 2026, on the Plot 9871152 Al Layan1 developer passport:
// "we know where the plot is, we know the GPS, we know the neighbourhood, we have district DNA"), plot facts (height, project bind, zoning),
// and the snapshot line in its own band (it overlapped each page's header).
// The nb records below are the ACTUAL output of naj-market-pulse/scripts/plot_passport_neighbourhood.py against the local lake on 4 Nov 2026
// (naj:plot:987-1152 = parcel 9871152, Al Layan1, empty; naj:plot:6816483, Jumeirah Village Circle), trimmed to the fields used.
const B = await import("../src/building_passports.js");
const N = await import("../src/passport_neighbourhood.js");
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 700)); } };
const all = (f) => f.lines.join("\n") + "\nMISSING " + f.missing.join("; ");

const EMPTY = { pt: { lat: 24.79211, lon: 55.10678, basis: "area centre: middle of 12 mapped plots in Al Layan1, not this plot's own position" }, district: "allayan1",
  metro: { n: "EXPO Metro Station", l: "Red Metro line", km: 19.5, as_of: "2026-09-21", src: "RTA metro station list" },
  near: { clinic: { n: "ADVANCED CARE MEDICAL CENTER (Br.) DIC", km: 4.8, r: 4.1, c: 90, d: "2026-10-14" } } };
const JVC = { pt: { lat: 25.05522, lon: 55.21073, basis: "plot outline centre (Makani outline (crawl 2026))" }, district: "jumeirahvillagecircle",
  metro: { n: "Jumeirah Golf Estates Metro Station", l: "Red Metro line", km: 6.3, as_of: "2026-09-21", src: "RTA metro station list" },
  near: { clinic: { n: "SmileWorks For Dental Surgery Clinic LLC", km: 0.3, r: 5.0, c: 434, d: "2026-10-14" }, mall: { n: "Circle Mall by Dubai Retail", km: 1.3, r: 4.4, c: 7229, d: "2026-10-14" },
    school: { n: "JSS International School", km: 1.3, r: 3.7, c: 90, d: "2026-10-14" }, park: { n: "YAS Community Park JVC", km: 0.2, r: 4.3, c: 9, d: "2026-10-14" } },
  top: [{ n: "The Wellness Haven Spa & Massage Center JVC", t: "daily life", r: 5.0, c: 808, m: 798, d: "2026-10-17" }, { n: "Barberhood Gents Salon", t: "daily life", r: 5.0, c: 487, m: 379, d: "2026-10-17" }], swept: true,
  drive: { from: "Q Gardens Lofts 2", km: 0.1, when: "Tue 08:00", as_of: "2026-11-02", d: { DIFC: [30, 25], "Dubai Mall": [27, 24], "DXB airport (T3)": [41, 39] }, src: "Google Routes" },
  facts: { h: { m: 41.2, kind: "model estimate - towers read low (about -19 m above 10 storeys), check", src: "gba", globfp: 55 } } };
const DNA = { name: "Jumeirah Village Circle", live: { v: "0.3 (15 Oct 2026)", as_of: "2026-11-03", conf: "high", p: { default: 60.0, family: 64.8 } }, dims: { everyday: 80.0, mobility: 30.3 }, pop: 55163,
  green: { share: 9.6, d: "2026-10-19", src: "Copernicus Sentinel-2 satellite" }, lines: [{ t: "family", s: "Jumeirah Village Circle: a typical community has 22 schools within 1.5 km.", src: "KHDA register; Google Places; Google Area Insights", as_of: "2026-11-03" }] };
const ppE = { id: "naj:plot:987-1152", parcel: "9871152", plot_no: "987-1152", area_name: "Al Layan1", district: "allayan1", land_type: "Public Facilities", sqm: 1201842.41, buildings: [], flats: {} };

// ---------- empty plot: neighbourhood from location, never the tenancy register
{
  const f = B.bppFacts(ppE, N.withNb({}, { nb: EMPTY, dna: null }), "2026-11-04"), t = all(f);
  ok(!/Neighbourhood (from the tenancy register)/.test(t) && /not from the tenancy register/.test(t), "neighbourhood no longer comes from the tenancy register", t);
  ok(/area centre: middle of 12 mapped plots in Al Layan1, not this plot's own position/.test(t), "an area-centre position says it is not the plot's own", t);
  ok(/Nearest metro station \(straight line, not a drive time\): EXPO Metro Station \(Red Metro line\) about 19\.5 km from the area centre \(RTA metro station list, as of 21 Sep 2026\)/.test(t), "metro: straight line, labelled, source and date", t);
  ok(/clinic ADVANCED CARE MEDICAL CENTER \(Br\.\) DIC 4\.8 km, rated 4\.1 from 90 reviews, retrieved 14 Oct 2026/.test(t), "nearest clinic with rating, count, date", t);
  ok(/nearest mall \(none within 10 km/.test(t) && /nearest school \(none within 10 km/.test(t), "missing kinds named with the reason", t);
  ok(/drive times \(no measured community point within 2 km\)/.test(t), "no drive time invented", t);
  ok(/this plot has no reviews of its own|not built, so it has no reviews of its own/.test(t) && /our Google place data does not cover this area yet/.test(t) && !/rating 4\.1 out of 5/.test(t), "Google: no reviews of the plot itself; coverage gap said plainly", t);
  ok(/district profile \(district DNA\) for allayan1: not covered/.test(t), "no district DNA: Not available yet, named", t);
  ok(/floors \(floor count not loaded yet\)/.test(t) && /zoning rules: Not verified/.test(t) && !/Height evidence/.test(t), "no floors / zoning row: said so; no height shown", t);
  ok(!/Nearby places/.test(t), "no nearby box when there are no nearby places");
}
// ---------- no position at all
{
  const t = all(B.bppFacts(ppE, {}, "2026-11-04"));
  ok(/Neighbourhood \(section 10\): Not available yet\. No map position is held for this plot/.test(t) && /plot map position/.test(t), "no position: said so, sources named", t);
}
// ---------- JVC: nearby places, drive times, DNA, height rule
{
  const f = B.bppFacts(Object.assign({}, ppE, { id: "naj:plot:6816483", district: "jumeirahvillagecircle", area_name: "Al Barsha South Fourth" }), N.withNb({}, { nb: JVC, dna: DNA }), "2026-11-04"), t = all(f);
  ok(/position 25\.05522, 55\.21073 \(plot outline centre/.test(t) && /from the plot/.test(t), "own plot position", t);
  ok(/Google box, titled 'Nearby places'[^\n]*NOT reviews of this plot[^\n]*Barberhood Gents Salon \(daily life\), rated 5 from 487 reviews, 379 m, retrieved 17 Oct 2026/.test(t), "nearby places with rating, count, distance, date; not reviews of the plot", t);
  ok(/Google shows at most 5 reviews per place; this is not every review/.test(t), "5-review caveat kept", t);
  ok(/Drive times \(Google Routes, measured from Q Gardens Lofts 2[^\n]*DIFC 30 min \(25 free-flowing\)/.test(t), "drive times with where they are measured from", t);
  ok(/'District DNA: Jumeirah Village Circle'[^\n]*DISTRICT LEVEL[^\n]*overall 60, families 64\.8/.test(t) && /green cover 9\.6% \(Copernicus Sentinel-2 satellite, 19 Oct 2026\)/.test(t), "district DNA card, labelled district level", t);
  ok(/District DNA line \(district level; source KHDA register/.test(t), "district lines carry source and date", t);
  ok(/Height evidence \(background only[^\n]*about 41 m, model estimate - towers read low[^\n]*Not a Dubai Municipality height[^\n]*towers read low on this source, check/.test(t) && !/55 m/.test(t) && !/Plot height \(section 02\)/.test(t), "height is evidence only, never DM, globfp never shown", t);
  ok(/floors \(floor count not loaded yet\)/.test(t), "no floors row: said so", t);
  ok(/mall Circle Mall by Dubai Retail 1\.3 km/.test(t), "nearest mall", t);
  ok(/District DNA/.test(B.bppPrompt(f, "4 Nov 2026")), "prompt asks for the district card");
}
// ---------- built building with its own Google place keeps it; nearby is extra, still not reviews
{
  const pack = N.withNb({ google: { places: [{ place_id: "P1", name: "Tower", rating: 4.2, count: 31, as_of: "2026-10-15", held: 5 }] }, project: { number: 9 } }, { nb: JVC });
  const t = all(B.bppFacts(ppE, pack, "2026-11-04"));
  ok(/rating 4\.2 out of 5 from 31 reviews/.test(t) && /Nearby places \(Google, within about 1 km from the plot, not reviews of this building\)/.test(t) && !/titled 'Nearby places'/.test(t), "built: building reviews kept, nearby labelled separately", t);
}
// ---------- project bind and zoning display rules
{
  const nb = Object.assign({}, JVC, { facts: { bind: { plot_level: false, plots_in_project: 14, project_sales: 120, project_sales_12m: 30, project_median_aed_per_m2: 15000, last_sale: "2026-10-20", project_ejari: 300, project_ejari_12m: 80, zoning_authority: "DDA" },
    zone: { evidence_class: "D", class_reason: "rule text only", height_text_en: "G+4", storeys: 5, storeys_status: "parsed: other", far: 2.5, far_method: "stated", setback_text: "3 m all sides", parking_text: "1 per unit", retrieved_at: "2026-11-03T10:00:00", conflicts: "two plans disagree" } } });
  const p = N.withNb({}, { nb }), r = N.plotFactLines(p), t = r.lines.join("\n");
  ok(/project-level \(one of 14 plots\)/.test(t) && /120 sales all time, 30 in the last 12 months/.test(t), "bind: project-level label when not plot level", t);
  ok(/Planning authority for this plot: DDA/.test(t), "zoning authority shown", t);
  ok(/evidence class D \(rule text only\)/.test(t) && /"G\+4"/.test(t) && !/5 storeys/.test(t), "height text verbatim; storeys only when parsed plain G+N", t);
  ok(/floor area ratio 2\.5 \(stated\), preliminary/.test(t) && /DM gives no effective date/.test(t) && /retrieved 3 Nov 2026/.test(t), "far with method, preliminary unless A; no effective date note", t);
  ok(r.flags.length === 1 && /review flag, not a finding/.test(r.flags[0]), "conflicts are review flags", r.flags);
  ok(p.zoning && p.zoning.far === 2.5 && p.zoning.verified === false, "far feeds the developer view, not verified unless class A", p.zoning);
  const pl = N.plotFactLines(N.withNb({}, { nb: Object.assign({}, JVC, { facts: { bind: { plot_level: true, project_sales: 4 }, zone: { evidence_class: "A", height_text_en: "G+12", storeys: 13, storeys_status: "parsed: plain G+N", far: 4 } } }) })).lines.join("\n");
  ok(/\(plot level;/.test(pl) && /\(13 storeys\)/.test(pl) && !/preliminary/.test(pl), "plot-level bind; parsed storeys; class A not preliminary", pl);
}
// ---------- floors headline (Kendall: floors, not height)
{
  const F = (fl) => N.plotFactLines(N.withNb({}, { nb: { pt: JVC.pt, facts: { fl } } })).lines.join("\n");
  ok(/Floors \(section 02 headline; print the label exactly\): Ground \+ 2 floors \(source: DM building record\)\. DM record as written: "G\+2"/.test(F({ floors_label: "Ground + 2 floors", floors_source: "DM building record", floors_shown: true, dm_record_text: "G+2" })), "DM floors with the record verbatim");
  ok(/: At least ground \+ 34 floors/.test(F({ floors_label: "Ground + 34 floors", floors_source: "DLD unit register (at least)", floors_shown: true })), "DLD figures are always 'at least'");
  ok(/About ground \+ 1 floor \(likely 2 to 3 levels\)[^\n]*estimate, medium confidence, likely 2 to 3 levels/.test(F({ floors_label: "About ground + 1 floor (likely 2 to 3 levels)", floors_source: "estimate", floors_shown: true, est_confidence: "medium", floors_low: 2, floors_high: 3 })), "estimate: About + range + confidence");
  const low = F({ floors_label: "About ground + 1 floor (likely 2 to 3 levels)", floors_source: "estimate", floors_shown: false, est_confidence: "low", floors_low: 2, floors_high: 3 });
  ok(/Building present - floors not verified/.test(low) && !/About ground/.test(low), "never a low-confidence estimate", low);
  ok(/Building present - floors not verified/.test(F({ floors_label: "Ground + 1 floor", floors_source: "estimate", est_confidence: "high" })), "an estimate without 'About' and a range is not shown");
  ok(/headline; print the label exactly\): No building recorded\.$/m.test(F({ floors_label: "No building recorded", floors_source: null, floors_shown: false })), "no building recorded");
}
// ---------- KV read: pp_nb_<crc32 % 4096> + pp_dna
{
  const { ppCrc32 } = await import("../src/plot_passport.js");
  const id = "naj:plot:987-1152", m = new Map([["pp_nb_" + (ppCrc32(id) % 4096), JSON.stringify({ [id]: EMPTY })], ["pp_dna", JSON.stringify({ jumeirahvillagecircle: DNA })]]);
  const env = { MEETINGS: { async get(k) { return m.has(k) ? m.get(k) : null; } } };
  const g = await N.nbGet(env, id);
  ok(g.nb && g.nb.metro.km === 19.5 && g.dna === null, "reads the bucket; a district without DNA gives none", g);
  const g2 = await N.nbGet(env, "naj:plot:nope");
  ok(g2.nb === null, "absent plot: null, never a crash");
}
// ---------- snapshot line: own band in each page, never fixed over the header
{
  const h = B.snapshotNote('<!doctype html><html><head></head><body><section class="page p1"><header>BUILDING PASSPORT</header><footer>f</footer></section><section class="page"><footer>f</footer></section><div class="page-header">x</div></body></html>', "2026-11-04T01:00:00Z");
  ok((h.match(/class="bpp-snap"/g) || []).length === 2, "one band per page (a 'page-header' class is not a page)", h);
  ok(!/position:fixed/.test(h) && /\.bpp-snap\{position:absolute;left:0;right:0;bottom:0;height:3\.2mm/.test(h) && /\.page\{position:relative\}/.test(h), "absolute bottom band inside the page, not fixed at the top", h);
  ok(/<footer>f<\/footer><div class="bpp-snap">Snapshot made 2026-11-04 05:00 GST/.test(h), "after the footer, inside the page", h);
  ok(/Keep the bottom 3\.5mm of every \.page empty/.test(B.bppPrompt({ lines: [], missing: [], risks: [], opps: [] }, "4 Nov 2026")), "the writer keeps the band free");
  ok(/closest\("\.bpp-snap"\)/.test(B.OVERFLOW_JS), "the overflow check ignores the band");
}
console.log("v734 passport neighbourhood: " + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
