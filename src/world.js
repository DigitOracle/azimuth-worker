// v154 - WORLD (16 Sep 2026, Kendall with Naj): Dubai against one of ten world cities, spoken to camera in 45-60 seconds.
// Not a card, not a picture: a narrative she says to a real lens. Sent Monday, Wednesday and Friday at 07:00 GST, and on
// demand with one word. One city and one angle per piece: price per square foot one day, what the same money buys another,
// tax, how the city lives, why that city's people buy here. The numbers come ONLY from the fact base below; the model
// phrases, it never supplies a figure, and every number in the script is checked against the facts before it is sent.
//
// The fact base is the record. Savills refreshes its index twice a year (February and August); Knight Frank's "what US$1m
// buys" once a year (April). Update the figures here, bump the source dates, and the scripts follow. Nothing is fetched live.
//
// Basis, stated on every piece: PRIME (the top few per cent of each market), because that is the only basis these indices
// publish. Dubai market-wide is about AED 1,670 per sq ft; put THAT next to prime London and Dubai is understated two and a
// half times over. The floor-area basis (net saleable in Hong Kong, built-up in Dubai) is not published by either source,
// so the piece never claims the areas are measured the same way.

export const USD_AED = 3.6725;                                   // the peg
export const WORLD_SOURCES = {
  savills: { name: "Savills World Cities Prime Residential Index", period: "values at June 2026", published: "19 August 2026", spoken: "Savills' June 2026 numbers" },
  kf: { name: "Knight Frank Wealth Report 2026 (PIRI)", period: "values at Q4 2025", published: "23 April 2026", spoken: "Knight Frank's 2026 Wealth Report" },
};

// prime = prime US$ per sq ft (Savills); m2 = square metres US$1m buys (Knight Frank). x_dubai and the AED figures are derived.
// buyers = what we can say about that city's people buying in Dubai; the ranking sources are brokerage deal books, never the
// Land Department, and the piece says "brokerage rankings" if it names the rank at all.
export const WORLD_CITIES = [
  { key: "dubai",
    tax: { income: "no personal income tax in the UAE (PwC, 2026)", buying: "4% Dubai Land Department transfer fee, usually paid by the buyer, plus about AED 4,000 in fees", capital_gains: "no capital gains tax for individuals (PwC, 2026)" },
    extra: { yield: "average gross rental yield about 5.5% market-wide (Global Property Guide, Q2 2026); Palm Jumeirah about 4.6%, Downtown about 5.1% (Engel & Voelkers, August 2026)", sunshine: "about 3,570 hours of sunshine a year (Dubai Meteorological Office)", savills_h1_2026: "prime values down 4.5% and prime rents down 6.7% in the first half of 2026; Savills expects around 10% more off in the second half" }, living: { liveability: "EIU Global Liveability Index 2026: 79th of 173 cities", cost_of_living: "Mercer Cost of Living 2024: 15th most expensive of 226 cities, the costliest in the Middle East", safety: "Numbeo crowd-sourced Safety Index, mid-2026: 6th safest of 401 cities (index 83.8)", quality_of_living: "Mercer Quality of Living 2024: 83rd of 241, the highest in the Middle East", millionaires: "Henley & Partners 2025: 81,200 resident millionaires, 18th in the world" }, name: "Dubai", flag: "🇦🇪", prime: 1160, m2: 62, base: true,
    note: "prime is the top end: the Palm, Downtown, Jumeirah Bay, Emirates Hills; market-wide the 2025 average was about AED 1,670 per sq ft (Betterhomes, full-year 2025)",
    dip: "Savills has Dubai prime values down 4.5% in the first half of 2026 and expects a fall of about 10% in the second half." },
  { key: "monaco",
    price_source: "not in the Savills 30-city index: Savills' Monaco Spotlight (March 2026) gives a 2025 average of EUR 57,569 per square metre from IMSEE, Monaco's statistics office, which is about US$6,200 per square foot",
    tax: { income: "no personal income tax for residents, except French nationals (Monaco government, 2026)", buying: "registration duty of about 4.5 to 4.75% plus notary fees of about 1.5% when an individual buys (Savills Monaco; CMS)", capital_gains: "none for Monaco-resident individuals (CMS)" },
    extra: { yield: "average gross rental yield about 3.3% (Global Property Guide, Q4 2025)", flight: "Emirates non-stop Dubai to Nice, about 6 hours 50 minutes, then the road to Monaco", sunshine: "about 2,575 hours of sunshine a year (Meteo-France, 1981-2010)" }, name: "Monaco", flag: "🇲🇨", prime: 6205, m2: 16, approx: true, role: "the world's ceiling: the most expensive homes on earth, so the sharpest single comparison. Say the price comes from Savills' Monaco spotlight and Monaco's statistics office, not the world cities index" },
  { key: "hongkong",
    tax: { income: "salaries tax capped at a standard 15% on the first HKD 5 million and 16% above (PwC, year of assessment 2025/26)", buying: "the extra stamp duties on foreign and second-home buyers were abolished in February 2024; stamp duty now runs up to 4.25% (Inland Revenue Department, 2026)", capital_gains: "no capital gains tax (PwC)" },
    extra: { yield: "average gross rental yield about 3.5% (Global Property Guide, Q3 2026)", flight: "non-stop from Dubai about 7 hours 10 minutes (Emirates and Cathay Pacific)", sunshine: "about 1,829 hours of sunshine a year (Hong Kong Observatory, 1991-2020)", savills_h1_2026: "prime values broadly flat in the first half of 2026; prime rents up 5.2% over the year" }, living: { liveability: "EIU Global Liveability Index 2026: 44th of 173 cities", cost_of_living: "Mercer Cost of Living 2024: the most expensive city of 226", safety: "Numbeo crowd-sourced Safety Index, mid-2026: 14th safest of 401 cities (index 78.2)", millionaires: "Henley & Partners 2025: 154,900 resident millionaires, 8th in the world" }, name: "Hong Kong", flag: "🇭🇰", prime: 3750, m2: 23, aliases: ["hong kong", "hk", "hongkong"], role: "the most expensive city in the Savills index" },
  { key: "geneva",
    tax: { income: "about 45% combined at the top: federal 11.5% plus cantonal and communal, about 44.75% in the City of Geneva (PwC; AccountEX, 2026)", buying: "about 4% all in: 3% registration duty, 0.3% land registry and the notary (Geneva Chamber of Notaries)", capital_gains: "a cantonal property gains tax by holding period: 50% under two years, falling to 2% after 25 years (2025)" },
    extra: { yield: "average gross rental yield about 2.6% in the canton (Global Property Guide, Q1 2026)", flight: "Emirates non-stop from Dubai about 6 hours 50 minutes", sunshine: "about 1,887 hours of sunshine a year (MeteoSwiss, 1991-2020)", savills_h1_2026: "prime values up 3.1% in the first half of 2026" }, living: { liveability: "EIU Global Liveability Index 2026: 6th of 173 cities", cost_of_living: "Mercer Cost of Living 2024: 4th most expensive of 226 cities", safety: "Numbeo crowd-sourced Safety Index, mid-2026: 75th safest of 401 cities (index 70.5)", quality_of_living: "Mercer Quality of Living 2024: 3rd of 241", millionaires: "Henley & Partners 2025: 70,200 resident millionaires, 22nd in the world" }, name: "Geneva", flag: "🇨🇭", prime: 2830, m2: 28, role: "the Swiss address wealth keeps: private banking, the lake, the quiet" },
  { key: "newyork",
    tax: { income: "federal 37% (2025) plus New York State up to 10.9% and New York City up to 3.876%, about 52% combined at the top (PwC; state and city rates from secondary sources)", buying: "a mansion tax paid by the buyer, 1% rising to 3.9% on the priciest homes, plus state and city transfer taxes (New York State and City, 2026)", capital_gains: "federal 20% plus a 3.8% net investment income tax, before state and city; 15% withheld from foreign sellers under FIRPTA (PwC; IRS)" },
    extra: { yield: "average gross rental yield about 5.0% (Global Property Guide, Q2 2026)", flight: "Emirates non-stop from Dubai about 14 hours 10 minutes", sunshine: "about 2,535 hours of sunshine a year (NOAA, Central Park)", savills_h1_2026: "prime values up 2.4% in the first half of 2026; Savills sees North America broadly flat in the second half" }, living: { liveability: "EIU Global Liveability Index 2026: 66th of 173 cities", cost_of_living: "Mercer Cost of Living 2024: 7th most expensive of 226 cities", safety: "Numbeo crowd-sourced Safety Index, mid-2026: 261st safest of 401 cities (index 49.2)", quality_of_living: "Mercer Quality of Living 2024: 45th of 241", millionaires: "Henley & Partners 2025: 384,500 resident millionaires, the most in the world" }, name: "New York", flag: "🇺🇸", prime: 2700, m2: 34, aliases: ["new york", "nyc", "ny", "manhattan", "newyork"], role: "the benchmark every broker's comparison uses" },
  { key: "paris",
    tax: { income: "45% top rate plus a 3 to 4% exceptional contribution on high incomes, and a 20% minimum tax from 2025 (PwC, income year 2025)", buying: "about 6.3% in transfer duties and levies on a Paris purchase since April 2025 (French notaries' guidance, 2026)", capital_gains: "19% tax plus 17.2% social charges, 36.2% together, plus a 2 to 6% surtax on larger gains; the gain is exempt after 22 to 30 years (PwC)" },
    extra: { yield: "average gross rental yield about 4.7% (Global Property Guide, Q2 2026)", flight: "non-stop from Dubai about 7 hours 35 minutes (Emirates and Air France)", sunshine: "about 1,717 hours of sunshine a year (Meteo-France, 1991-2020)", savills_h1_2026: "prime values up 0.7% in the first half of 2026; Savills expects 0 to 1.9% in the second half" }, living: { cost_of_living: "Mercer Cost of Living 2024: 29th most expensive of 226 cities", safety: "Numbeo crowd-sourced Safety Index, mid-2026: 313th safest of 401 cities (index 42.1)", quality_of_living: "Mercer Quality of Living 2024: 34th of 241", millionaires: "Henley & Partners 2025: 160,100 resident millionaires, 7th in the world" }, name: "Paris", flag: "🇫🇷", prime: 2040, m2: 37, role: "the European gateway" },
  { key: "london",
    tax: { income: "45% additional rate above GBP 125,140 (PwC, 2026/27)", buying: "stamp duty up to 12% at the top band, plus 5% for an additional property and 2% for a non-resident: up to 19% at the top for a foreign buyer of a second home (GOV.UK, 2026)", capital_gains: "18% or 24% on residential property from April 2026 (GOV.UK)" },
    extra: { yield: "average gross rental yield about 6.6% (Global Property Guide, Q2 2026)", flight: "non-stop from Dubai about 8 hours 10 minutes (Emirates and British Airways)", sunshine: "about 1,526 hours of sunshine a year (Met Office, Greenwich, 1991-2020)", savills_h1_2026: "prime values down 1.9% in the first half of 2026 and still 24.5% below their 2014 peak in prime central London; Savills expects up to 1.9% more off in the second half" }, living: { liveability: "EIU Global Liveability Index 2026: 54th of 173 cities", cost_of_living: "Mercer Cost of Living 2024: 8th most expensive of 226 cities", safety: "Numbeo crowd-sourced Safety Index, mid-2026: 298th safest of 401 cities (index 44.7)", quality_of_living: "Mercer Quality of Living 2024: 40th of 241", millionaires: "Henley & Partners 2025: 215,700 resident millionaires, 6th in the world" }, name: "London", flag: "🇬🇧", prime: 1960, m2: 33, role: "the benchmark every broker's comparison uses",
    buyers: "British buyers were the second-largest group in Dubai in 2025 (brokerage rankings: Anarock via Khaleej Times; Betterhomes full-year 2025)" },
  { key: "sydney",
    tax: { income: "45% above AUD 190,000 plus a 2% Medicare levy (PwC, 2025/26)", buying: "transfer duty up to 7% above AUD 3.87 million, plus a 9% surcharge purchaser duty for foreign persons (Revenue NSW, 2026/27)", capital_gains: "at the marginal rate; the 50% discount for a home held over 12 months is not available to foreign residents (PwC)" },
    extra: { yield: "average gross rental yield about 4.7% (Global Property Guide, Q3 2026)", flight: "Emirates non-stop from Dubai about 13 hours 55 minutes", sunshine: "about 2,639 hours of sunshine a year (Bureau of Meteorology, 1991-2020)", savills_h1_2026: "prime values down 3.3% in the first half of 2026; Savills expects 2 to 3.9% more off in the second half" }, living: { liveability: "EIU Global Liveability Index 2026: 4th of 173 cities", cost_of_living: "Mercer Cost of Living 2024: 58th most expensive of 226 cities", safety: "Numbeo crowd-sourced Safety Index, mid-2026: 107th safest of 401 cities (index 66.2)", quality_of_living: "Mercer Quality of Living 2024: 12th of 241", millionaires: "Henley & Partners 2025: 152,900 resident millionaires, 9th in the world" }, name: "Sydney", flag: "🇦🇺", prime: 1910, m2: 42, role: "the sunbelt city Dubai's buyers know",
    buyers: "Australian buyers entered Dubai's top four buyer groups in spring 2026 (brokerage rankings)" },
  { key: "singapore",
    tax: { income: "24% top rate above SGD 1 million (PwC, year of assessment 2026)", buying: "buyer's stamp duty up to 6% plus an additional buyer's stamp duty of 60% for foreigners since April 2023 (Ministry of Finance)", capital_gains: "no capital gains tax; a seller's stamp duty of up to 16% if sold within the holding period (PwC)" },
    extra: { yield: "average gross rental yield about 3.1% (Global Property Guide, Q2 2026)", flight: "non-stop from Dubai about 7 hours 35 minutes (Emirates and Singapore Airlines)", sunshine: "about 2,074 hours of sunshine a year (1991-2020)", savills_h1_2026: "prime values up 0.4% in the first half of 2026; Savills expects 2 to 3.9% in the second half" }, living: { liveability: "EIU Global Liveability Index 2026: 26th of 173 cities", cost_of_living: "Mercer Cost of Living 2024: 2nd most expensive of 226 cities", safety: "Numbeo crowd-sourced Safety Index, mid-2026: 21st safest of 401 cities (index 77.7)", quality_of_living: "Mercer Quality of Living 2024: 30th of 241, the only Asian city in the top 50", millionaires: "Henley & Partners 2025: 242,400 resident millionaires, 4th in the world" }, name: "Singapore", flag: "🇸🇬", prime: 1850, m2: 28, role: "the closest rival hub: small, safe, expensive" },
  { key: "miami",
    tax: { income: "federal 37% (2025); Florida has no state income tax (PwC)", buying: "a documentary stamp tax of 0.7% on the deed in Florida (Florida Department of Revenue)", capital_gains: "federal 20% plus a 3.8% net investment income tax, no state tax; 15% withheld from foreign sellers under FIRPTA (PwC; IRS)" },
    extra: { yield: "average gross rental yield about 6.8% (Global Property Guide, Q2 2026)", flight: "Emirates non-stop from Dubai about 15 hours 45 minutes", sunshine: "about 3,154 hours of sunshine a year (NOAA)", savills_h1_2026: "prime values down 0.3% in the first half of 2026, prime rents down 5% over the year; Savills sees North America broadly flat in the second half" }, name: "Miami", flag: "🇺🇸", prime: 1410, m2: 58, role: "the other sunbelt market with no state income tax" },
  { key: "mumbai",
    tax: { income: "30% top rate plus surcharge and cess, about 39% at the highest incomes (PwC, 2025/26)", buying: "stamp duty of 6% for men and 5% for women including the metro cess, plus registration of up to INR 30,000 (Maharashtra, 2026); foreign nationals of non-Indian origin living abroad generally cannot buy, only lease for up to five years, under FEMA", capital_gains: "long-term gains over 24 months at 12.5% without indexation, plus surcharge (PwC)" },
    extra: { yield: "average gross rental yield about 3.7% (Global Property Guide, Q2 2026)", flight: "non-stop from Dubai about 3 hours 15 minutes (Emirates, Air India, flydubai, IndiGo)", sunshine: "about 2,612 hours of sunshine a year (India Meteorological Department)", savills_h1_2026: "prime values up 1.4% in the first half of 2026; Savills expects 0 to 1.9% in the second half" }, living: { liveability: "EIU Global Liveability Index 2026: 121st of 173 cities (score 47.9)", cost_of_living: "Mercer Cost of Living 2024: 136th most expensive of 226 cities", safety: "Numbeo crowd-sourced Safety Index, mid-2026: 187th safest of 401 cities (index 56.1)", quality_of_living: "Mercer Quality of Living 2024: 158th of 241", millionaires: "Henley & Partners 2025: more than 51,000 resident millionaires, 27th in the world" }, name: "Mumbai", flag: "🇮🇳", prime: 1130, m2: 96, aliases: ["mumbai", "bombay"], role: "the home city of Dubai's largest buyer group",
    buyers: "Indian buyers were the largest group in Dubai in 2025 (brokerage rankings: Anarock via Khaleej Times; Betterhomes full-year 2025)",
    caution: "Mumbai prime is slightly CHEAPER than Dubai prime per square foot. Never claim Dubai is cheaper; the argument for an Indian buyer is what the money buys, tax, title and the ease of owning, only where the facts below support it." },
];

// Six angles. lanes: Mon = market numbers, Wed = places, Fri = education / buyer maths (Naj's content cadence, 5 Sep 2026).
// needs = fact fields the city must have for the angle to run; an angle with a missing fact is never picked for that city.
export const WORLD_ANGLES = [
  { key: "sqft", label: "price per square foot", lane: 1, needs: [],
    brief: "Prime price per square foot, Dubai against this city, and the multiple. One number each side, then the multiple. Say 'the top end of both markets' once so nobody thinks this is the average flat." },
  { key: "five_million", label: "expensive compared to what", lane: 1, needs: [],
    brief: "Start from the shock: a buyer hears 'five million dirhams' and flinches. Expensive compared to what? Say what AED 5 million buys at the top end in Dubai and in this city, in square metres, and let the gap speak." },
  { key: "size", label: "what the same money buys", lane: 3, needs: [],
    brief: "Space, not price. What US$1 million buys at the top end in this city versus Dubai, in square metres, and make each size feel real with one of the size references supplied (a parking bay, a hotel room, a court). If no reference is supplied, describe the size plainly." },
  { key: "living", label: "how the city lives", lane: 3, needs: ["living"],
    brief: "Not price. Quality of life, cost of living, safety, sunshine, the flight home: only the facts supplied, each with its ranking body named once. End with what a family actually gets for the money in each place." },
  { key: "tax", label: "what you keep", lane: 5, needs: ["tax"],
    brief: "Income tax, the duty on buying, and capital gains when you sell, this city against Dubai, only the rates supplied. Name the year the rate applies. No advice: she describes, the viewer decides with their adviser." },
  { key: "home_market", label: "why they buy here", lane: 5, needs: ["buyers"],
    brief: "Speak to a buyer FROM this city. What their home market costs at the top end, what Dubai costs, and one honest reason they come: the buyer-group fact supplied, credited as a brokerage ranking. If this city is cheaper than Dubai, say so and make the case on what the money buys instead." },
];
const LANES = { 1: ["sqft", "five_million"], 3: ["size", "living"], 5: ["tax", "home_market"] };

const r10 = (x) => Math.round(x / 10) * 10;
export function worldCity(k) {
  const s = String(k || "").trim().toLowerCase().replace(/[^a-z ]/g, "");
  if (!s) return null;
  return WORLD_CITIES.find(c => c.key === s || c.name.toLowerCase() === s || (c.aliases || []).includes(s)) || null;
}
export function worldAngle(k) { const s = String(k || "").trim().toLowerCase(); return WORLD_ANGLES.find(a => a.key === s) || null; }
export function angleAvailable(city, angle) { return (angle.needs || []).every(f => city[f] || (f === "buyers" ? !!city.buyers : false)); }

// Everything the model may quote for one city, with the arithmetic already done. AED 5m = US$1.36m at the peg.
export function worldFacts(cityKey, angleKey, refs) {
  const dubai = WORLD_CITIES[0];
  const city = worldCity(cityKey);
  const angle = worldAngle(angleKey) || WORLD_ANGLES[0];
  if (!city || city.base) return null;
  const aed5m = 5000000 / USD_AED / 1000000;                                   // millions of dollars in AED 5m
  const row = (c) => ({
    city: c.name,
    prime_usd_per_sqft: c.prime, prime_usd_approx: !!c.approx,
    prime_aed_per_sqft: r10(c.prime * USD_AED),
    m2_for_usd_1m: c.m2, sqft_for_usd_1m: Math.round(c.m2 * 10.7639 / 10) * 10,
    m2_for_aed_5m: Math.round(c.m2 * aed5m),
    note: c.note || undefined, price_source: c.price_source || undefined, role: c.role || undefined, buyers: c.buyers || undefined, caution: c.caution || undefined,
    living: c.living || undefined, tax: c.tax || undefined, extra: c.extra || undefined,
  });
  const mult = city.prime / dubai.prime;
  return {
    angle: angle.key, angle_brief: angle.brief,
    basis: "PRIME: the top few per cent of each market by value. Not the average home. Floor-area basis is not published by either source and may differ by city.",
    dubai: row(dubai), other: row(city),
    multiple: { text: city.prime >= dubai.prime ? (Math.round(mult * 10) / 10) + " times Dubai" : "about " + Math.round((1 - mult) * 100) + "% below Dubai", value: Math.round(mult * 100) / 100 },
    aed_5m_in_usd: "US$1.36 million",
    sources: { prices: WORLD_SOURCES.savills, what_1m_buys: WORLD_SOURCES.kf },
    size_references: (refs && refs.length ? refs : (WORLD_REFS || [])),
    story: (typeof WORLD_STORY !== "undefined" ? WORLD_STORY[city.key] : undefined),   // v157 - the city's own verified detail, so a story can be built from it
    dip: dubai.dip,
  };
}

// Size references a Dubai viewer can picture. Filled from checked sources only; empty means the piece describes size plainly.
export const WORLD_REFS = [
  "a Rove Downtown hotel room: 26 square metres (Rove Hotels, room page)",
  "a car parking bay in Dubai: 2.5 by 5.5 metres, about 14 square metres (Dubai Building Code 2021)",
  "a padel court: 200 square metres (International Padel Federation rules, 2026)",
  "a doubles tennis court: about 261 square metres (ITF Rules of Tennis)",
  "the average home in England: 96 square metres (English Housing Survey 2024-25)",
  "a Hong Kong nano flat: under 24 square metres (Rider Levett Bucknall, 2022); the minimum on new government land sales is 26 (2022)",
  "a one-bedroom at Sobha Solis, Motor City: about 536 square feet, 50 square metres (developer floor plan)",
];

// Rotation. hist = [{d, city, angle}] newest first. A city rests for five pieces; the angle follows the day's lane when it can,
// otherwise the angle this city has not had for longest. Deterministic for a given history, so 07:00 and a tap agree.
export function worldPick(hist, opts) {
  const o = opts || {};
  const h = Array.isArray(hist) ? hist : [];
  const others = WORLD_CITIES.filter(c => !c.base);
  let city = o.city ? worldCity(o.city) : null;
  if (!city || city.base) {
    const recent = h.slice(0, 5).map(x => x.city);
    const pool = others.filter(c => !recent.includes(c.key) && c.key !== o.notCity);
    const cand = (pool.length ? pool : others.filter(c => c.key !== o.notCity));
    const last = (k) => { const i = h.findIndex(x => x.city === k); return i < 0 ? 1e9 : i; };   // older = larger index; never = first
    cand.sort((a, b) => last(b.key) - last(a.key) || a.key.localeCompare(b.key));
    city = cand[0] || others[0];
  }
  let angle = o.angle ? worldAngle(o.angle) : null;
  if (!angle || !angleAvailable(city, angle) || angle.key === o.notAngle) {
    const usable = WORLD_ANGLES.filter(a => angleAvailable(city, a) && a.key !== o.notAngle);
    const lastA = (k) => { const i = h.findIndex(x => x.angle === k); return i < 0 ? 1e9 : i; };
    const lane = (LANES[o.day] || []).filter(k => usable.some(a => a.key === k));
    const cityHad = h.filter(x => x.city === city.key).map(x => x.angle);
    let pick = lane.map(worldAngle).filter(a => !cityHad.includes(a.key)).sort((a, b) => lastA(b.key) - lastA(a.key))[0];
    if (!pick) pick = usable.filter(a => !cityHad.includes(a.key)).sort((a, b) => lastA(b.key) - lastA(a.key))[0];
    if (!pick) pick = usable.sort((a, b) => lastA(b.key) - lastA(a.key))[0] || WORLD_ANGLES[0];
    angle = pick;
  }
  return { city: city.key, angle: angle.key };
}

// The system prompt. `voice` is styleVoice(env): her locked card, the ban list, her sentences for the shape.
export function worldSystem(voice, angleKey) {
  const a = worldAngle(angleKey) || WORLD_ANGLES[0];
  return "You write ONE spoken piece for Najjuko ('Naj'), a Dubai property broker, to say to camera in 45 to 60 seconds: 105 to 140 words. " +
    "She compares Dubai with ONE other city so a buyer understands value for money instead of flinching at a big number. " +
    "TODAY'S ANGLE: " + a.label + ". " + a.brief + " " +
    "IT MUST BE A STORY, not a read-out. A scene or a person she could have met, a moment where something turns, and a close she could say to a friend in a car. " +
    "The figure is the pivot of the story, never its content. Two or three numbers in the whole piece, and nothing that reads as a list. " +
    "Invent NOTHING she would have to stand behind: no named client, no deal that did not happen, no date she was somewhere. Say \"picture the viewing\", \"my clients describe\", or speak to the buyer as you, so every specific is either verified or plainly imagined. " +
    "RULES. Use ONLY the numbers in the FACTS you are given, exactly as given, and only the ones this angle needs. " +
    "Never invent, round, convert or average a figure; the conversions you may need are already in the facts. " +
    "Say the basis once in plain words ('the top end of both markets', 'prime'), because these are not average prices. " +
    "Say where a number comes from once, in speech ('Savills' June numbers', 'Knight Frank's Wealth Report'), never a URL. " +
    "Dirhams for Dubai; for the other city use the dirham figure supplied, and the dollar figure at most once if it helps. " +
    "Say 'per square foot' and 'square metres' in words. Never say cheap, bargain, or steal. Never promise growth or a return. " +
    "Open on a person, a question, a sum of money or a plain fact: never on 'welcome', 'did you know', 'imagine', or the city's name. " +
    "Close with one line a buyer can hold on to, or the question 'expensive compared to what?' in her own words. " +
    "No greeting, no sign-off, no emojis, no hashtags, no stage directions, no headings, no bullet points, no dashes. Plain text, the script only. " +
    voice;
}

const NUM_RX = /\d[\d,]*(?:\.\d+)?/g;
export function worldWords(t) { return String(t || "").trim().split(/\s+/).filter(Boolean).length; }
// Every number spoken must exist in the facts (commas ignored). Years in the source dates count as facts. A number that is a
// prefix of a fact number ("1,96" of "1,960") does not pass: the match is on whole tokens.
export function worldNumbersOk(script, facts) {
  const blob = JSON.stringify(facts);
  const have = new Set((blob.match(NUM_RX) || []).map(x => x.replace(/,/g, "")));
  const bad = [];
  for (const m of (String(script || "").match(NUM_RX) || [])) {
    const v = m.replace(/,/g, "").replace(/\.$/, "");
    if (!have.has(v) && !have.has(String(Number(v)))) bad.push(m);
  }
  return { ok: !bad.length, bad: [...new Set(bad)] };
}
export function worldCheck(script, facts, banRx) {
  const why = [];
  const w = worldWords(script);
  if (w < 95) why.push("too short: " + w + " words, needs 105 to 140");
  if (w > 160) why.push("too long: " + w + " words, needs 105 to 140");
  const n = worldNumbersOk(script, facts);
  if (!n.ok) why.push("these numbers are not in the facts and must go: " + n.bad.join(", "));
  if (banRx && banRx.test(String(script || ""))) why.push("uses a banned word or a dash; rewrite that sentence in her voice");
  if (/[\u{1F300}-\u{1FAFF}]/u.test(String(script || ""))) why.push("no emojis");
  return { ok: !why.length, why: why.join("; "), words: w };
}

export const WORLD_KEYWORD = /^(?:versus|vs\.?|world|compare)(?:\s+(.*))?\s*$/i;
const ANGLE_WORDS = [[/\b(sq\s*ft|square|per\s*foot|price|psf)\b/i, "sqft"], [/\b(five|5\s*m|million|expensive|shock)\b/i, "five_million"], [/\b(size|space|buys?|metres?|meters?)\b/i, "size"],
  [/\b(tax|keep|duty|stamp)\b/i, "tax"], [/\b(life|living|live|quality|safe|safety|cost)\b/i, "living"], [/\b(buyers?|why|home|market)\b/i, "home_market"]];
// "versus london tax" -> {city:"london", angle:"tax"}; "versus" -> {}; not the keyword -> null
export function worldParse(text) {
  const m = String(text || "").trim().match(WORLD_KEYWORD);
  if (!m) return null;
  const rest = (m[1] || "").trim();
  if (!rest) return {};
  let city = null, angle = null, s = rest.toLowerCase();
  for (const c of WORLD_CITIES) { if (c.base) continue; const names = [c.name.toLowerCase()].concat(c.aliases || []); const hit = names.find(n => new RegExp("\\b" + n.replace(/\s+/g, "\\s+") + "\\b").test(s)); if (hit) { city = c.key; s = s.replace(new RegExp("\\b" + hit.replace(/\s+/g, "\\s+") + "\\b"), " "); break; } }
  for (const [rx, k] of ANGLE_WORDS) if (rx.test(s)) { angle = k; break; }
  return { city: city || undefined, angle: angle || undefined, rest };
}

// The WhatsApp wrapper around the script: title, the piece, the line to have ready, the sources. No sign-off: like the feed,
// it is her material, not an update from Papi.
export function worldMessage(facts, script, secs) {
  const c = worldCity(facts.other.city), a = worldAngle(facts.angle);
  const s = secs || Math.round(worldWords(script) / 2.4);
  let out = "🌍 *Dubai versus " + c.name + "* " + (c.flag || "") + " · " + (a ? a.label : "") + " · about " + s + " seconds to camera\n\n" + String(script).trim();
  const ready = [];
  if (["sqft", "five_million", "size", "home_market"].includes(facts.angle) && facts.dip) ready.push("If they ask about the dip: " + facts.dip);
  if (c.key === "hongkong") ready.push("Hong Kong quotes net saleable area and Dubai built-up, a 20 to 25% gap; neither index says which it uses, so keep to 'per square foot' and don't argue the measuring.");
  if (ready.length) out += "\n\n_Have ready, not said: " + ready.join(" ") + "_";
  out += "\n\n_Sources: " + (c.price_source ? "Savills Monaco Spotlight, March 2026 (IMSEE 2025 average, converted)" : facts.sources.prices.name + ", " + facts.sources.prices.period) + " · " + facts.sources.what_1m_buys.name + ", " + facts.sources.what_1m_buys.period + " · prime basis, top end of each market_";
  return out;
}
export function worldListRows(hist) {
  const recent = (hist || []).slice(0, 5).map(x => x.city);
  return WORLD_CITIES.filter(c => !c.base).map(c => ({ id: "wld:c:" + c.key, title: (c.flag || "") + " " + c.name, description: "prime US$" + c.prime.toLocaleString("en-US") + " per sq ft · " + (c.prime >= 1160 ? (Math.round(c.prime / 116) / 10) + "× Dubai" : "just under Dubai") + (recent.includes(c.key) ? " · recent" : "") }));
}

// v154.2 - the ten sample scripts of 16 Sep 2026, one angle each, approved by Kendall for the review round with Naj. Every figure
// in them is sourced (the SOURCES line) and was checked against its facts before it was sent. They are the reference for the depth
// and shape the live generator must reach; the review record (KV world_review) says which ones she would say as they are.
// v157 (16 Sep 2026, Kendall: "each one needs to tell a story, a narrative, not just numbers"). Naj said the first London piece was
// "not me": it opened on a listing and stacked thirteen figures. Eight are rewritten as stories with a scene and a turn, at most three
// figures each, nothing invented that she would have to stand behind. Monaco and Mumbai keep revision 1 because she approved them.
// `rev` is why: a verdict she gave on revision 1 is never shown against revision 2 text she has not seen.
export const WORLD_SAMPLES = [
  { n: 1, rev: 2, city: "london", cityName: "London", title: "the morning after", angle: "size",
    text: "My British clients all describe the same room. A kitchen where you can touch both walls, in a flat that cost more than their parents' whole house. They are not imagining it. The average home in England is 96 square metres. In prime London, a million dollars buys 33. That is Knight Frank, not me. The same million here buys 62 square metres, and that is before we talk about what you keep. But the number is not the story. The story is the morning after you move. Coffee outside in February. The children downstairs, not in another postcode. Nobody hurrying you anywhere. Send me the London flat you are looking at. I will show you the same money as a life.",
    ready: "Prime London is AED 7,200 per square foot against Dubai's AED 4,260 (Savills, June 2026) if she is asked the price. A non-resident buying a second home pays stamp duty reaching 19% at the top band.",
    sources: "Knight Frank Wealth Report 2026 (what US$1m buys); English Housing Survey 2024-25 (96 m² average dwelling); Savills World Cities Prime Residential Index H1 2026." },
  { n: 2, rev: 1, city: "monaco", cityName: "Monaco", title: "sixteen square metres is not a home",
    text: "Knight Frank says a million dollars buys 16 square metres in Monaco. Nobody sells 16 square metres. It is arithmetic, not an apartment. Here is what Monaco actually sells. In 2025 the average studio changed hands at two million euros and the average one-bedroom at four million. That is IMSEE, Monaco's own statistics office. The cheapest studio listed this month is 950,000 euros for 25 square metres. A parking space alone runs from 150,000 to 600,000 euros. So a million dollars in Monaco buys a car's worth of floor, with no walls. In Dubai that same money, about 3.7 million dirhams, bought a two-bedroom of 128 square metres this year, across 2,324 registered sales. On Palm Jumeirah, 161. Same money. One is a place to park. The other is a place to live.",
    ready: "Monaco is not in the Savills 30-city index; its average was EUR 57,569 per square metre in 2025 (IMSEE). US$1m = AED 3.67m at the peg; the Dubai figure is the median size of 2,324 residential unit sales registered at AED 3.4–3.95m in 2026 (Palm Jumeirah: 60 sales, median 161 m²).",
    sources: "Knight Frank Wealth Report 2026; IMSEE Observatoire de l'Immobilier 2025 (Feb 2026); montecarlo-realestate.com and La Costa Properties listings (Sep 2026); Chambre Immobilière Monégasque via prime.mc; DLD Open Data 2026." },
  { n: 3, rev: 2, city: "hongkong", cityName: "Hong Kong", title: "the law about how small a home may be", angle: "size",
    text: "In 2022 Hong Kong had to pass a law about how small a home is allowed to be. Twenty six square metres. Think about what has to happen in a city before a government writes a floor under floor space. The flats had been getting smaller than people could live in. The median person there has about 16 square metres to themselves. Now take the smallest thing we sell. On the Dubai register this year the median studio was 36 square metres. Our smallest home is larger than their legal minimum. I am not laughing at Hong Kong. Half my clients love it there. I am saying space quietly stopped being a luxury here, and you only feel that after you have lived without it.",
    ready: "Hong Kong quotes saleable area and Dubai built-up, a 20 to 25% gap, so keep to the sizes and never argue the measuring. Prime Hong Kong is AED 13,770 per square foot against Dubai's AED 4,260.",
    sources: "HKSAR Government reply LCQ22, 29 March 2023 (2021 census, and the 26 m² minimum from 2022); DLD Open Data 2026 (29,577 studio sales); Savills H1 2026." },
  { n: 4, rev: 2, city: "singapore", cityName: "Singapore", title: "the permission before the car", angle: "tax",
    text: "Clients weighing Dubai against Singapore always tell me the same story. Safe city. Clean city. Everything works. Then somebody explains the car. In Singapore, before you buy the car, you buy the right to own one. This month that certificate went for 135,001 Singapore dollars. It lasts ten years and then you buy it again. Not the car. The permission. The home works the same way. A foreigner buying a three million dollar flat there pays sixty per cent on top in stamp duty. Here the transfer fee is four per cent, once, and nobody asks you to bid for permission to drive. Both cities are excellent. Only one of them charges you for arriving.",
    ready: "On a three million Singapore dollar flat the duties come to S$1,919,600, 64% of the price. Mercer ranks Singapore the second most expensive of 226 cities and Dubai fifteenth.",
    sources: "LTA certificate of entitlement results, September 2026; Ministry of Finance Singapore (ABSD from April 2023); PwC UAE; Mercer Cost of Living 2024." },
  { n: 5, rev: 2, city: "sydney", cityName: "Sydney", title: "the door that closed at home", angle: "home_market",
    text: "Australians ask me a version of the same question. Why is my money in Dubai and not at home? Because home closed the door. Since April 2025 Australia will not sell an established house to a foreign buyer, and that ban now runs to 2029. If you are one of the exceptions, the application fee alone on a three million dollar home is 187,800 dollars. That is before the house. Then the state adds a surcharge every single year you own it. Dubai wrote the opposite law twenty years ago. You hold freehold, in your own name, on the Palm, in the Marina. Four per cent, once. Sydney is glorious and I would live there happily. It simply does not want your name on the title.",
    ready: "New South Wales adds 9% surcharge purchaser duty and 5% surcharge land tax every year. Australians entered Dubai's top four buyer groups this spring per brokerage rankings, never a Land Department figure. The Dubai law is No. 7 of 2006.",
    sources: "Australian Taxation Office, page updated 12 May 2026 (the ban and the fee); Revenue NSW 2026/27; Dubai Law No. 7 of 2006; brokerage buyer rankings, spring 2026." },
  { n: 6, rev: 2, city: "newyork", cityName: "New York", title: "the bill that arrives after you own it", angle: "tax",
    text: "A two bedroom at CitySpire sold in August for 3.2 million dollars. The buyer owns it. And every month a bill still arrives. Taxes, 2,909 dollars. Common charges, 2,553. Over sixty thousand dollars a year to keep a home that is already paid for. That is the part nobody photographs. In Downtown Dubai you pay the building's service charge and that is the end of the list. No property tax. Nothing on the gain when you sell it. New York holds more millionaires than any city on earth, and takes about half of the last dollar each of them earns. It is the greatest city in the world. Just know what the key costs you every year after you turn it.",
    ready: "Federal tax 37%, New York State up to 10.9%, the city 3.876%. Selling costs 20% federal on the gain plus 3.8%, with 15% withheld from a foreign seller. Bellevue Towers Downtown is AED 24 per square foot a year.",
    sources: "StreetEasy closing record, 21 August 2026 (150 West 56th Street); Property Finder service-charge report, June 2026; PwC US; Henley & Partners 2025." },
  { n: 7, rev: 2, city: "geneva", cityName: "Geneva", title: "the best place you cannot get into", angle: "living",
    text: "Let me lose an argument first. On quality of life Geneva beats Dubai, and it is not close. Sixth in the world this year, against our seventy ninth. Healthcare, schools, the lake, the quiet. They have earned every place. Then a client actually tries to move there and finds the second half of the story. A foreigner living abroad generally needs the government's permission to buy at all. So you rent instead. The vacancy rate is 0.31 per cent. There is nothing to rent. A place can be the finest on earth to live in and still have no way in. That is worth saying out loud, because admiring a city and being allowed to belong in it are two different things.",
    ready: "Numbeo's crowd-sourced index puts Dubai 6th safest of 401 cities and Geneva 75th. Geneva's top combined rate is about 45% and prime Geneva is AED 10,390 per square foot.",
    sources: "EIU Global Liveability Index 2026; Chambre des notaires de Genève on Lex Koller; OCSTAT vacancy rate at 1 June 2026; Numbeo mid-2026." },
  { n: 8, rev: 2, city: "paris", cityName: "Paris", title: "the key, and the letters after it", angle: "tax",
    text: "Everyone wants the key to a Paris apartment. Nobody describes the letters that come afterwards. France taxes the property itself once your French real estate passes 1.3 million euros. Every year. Whether you set foot in it or not. Paris put its own property tax rate up to 20.5 per cent in 2023, and adds a surcharge of sixty per cent when the flat is a second home. So the apartment you visit in April writes to you in October. Here there is no annual property tax at all. A housing fee on the rent, the building's service charge, and that is the list. I love Paris. I would buy there for love, never for arithmetic. Go in knowing which one you are doing.",
    ready: "Selling a French second home is taxed at 36.2% with social charges. Buying costs about 6.3% in duties since April 2025, against 4% here.",
    sources: "impots.gouv.fr and service-public.fr 2026 (the property wealth tax); Ville de Paris, February 2026; PwC France; u.ae (the Dubai housing fee)." },
  { n: 9, rev: 2, city: "miami", cityName: "Miami", title: "the weather sends an invoice", angle: "living",
    text: "People put Dubai and Miami in the same sentence. Sun, sea, no state income tax. That is fair. So let us compare the summers honestly. Ours is brutal. July averages 41.7 degrees and I will never pretend otherwise. Miami's July is kinder. Miami's summer is also hurricane season, June to November, and in 2024 two of them came ashore in Florida. Then the weather sends an invoice. The average Miami home insurance premium is 15,396 dollars a year, against 2,808 across America. Our summer costs you the months you were travelling anyway. Theirs costs you a policy, every year, for as long as you own the place. Both cities are perfect in February. Only one makes you watch the forecast before you sign.",
    ready: "Miami property tax runs about 2% of value a year, near US$40,000 on a two million dollar home. Miami's gross yield is about 6.8% against Dubai's 5.5%, so concede that one plainly.",
    sources: "Dubai Meteorological Office and NOAA climate normals; NOAA National Hurricane Center (2024 season); Insurify, 31 August 2026; Miami-Dade Property Appraiser 2025 millage." },
  { n: 10, rev: 1, city: "mumbai", cityName: "Mumbai", title: "the home that pays you to be here",
    text: "To my clients from Mumbai, Dubai's largest buyer group, from 4.3 million Indians in the UAE. The uncomfortable part first. Prime Mumbai is not dearer than Dubai. Savills has it at AED 4,150 a square foot against 4,260 here, about 3% less, and a million dollars buys 96 square metres there against 62 here, Knight Frank says. So why do they come? What it earns. Mumbai's average gross yield is 3.7%, Dubai's 5.5%. What you keep. India's top rate of income tax is about 39%. Here, nothing. And the door. Maharashtra stamp duty is 6%, here it is 4%, with a freehold title in your own name, three hours fifteen minutes from home, and the Reserve Bank lets you send 250,000 dollars a year to do it. Mumbai is home. Dubai is the home that pays you to be here.",
    ready: "Buyer rank from brokerage deal books (Anarock via Khaleej Times; Betterhomes FY2025), never a Land Department figure. Indian diaspora 4.3m (Embassy of India Abu Dhabi, Jun 2026). LRS: US$250,000 per financial year per resident individual (RBI). Foreign nationals of non-Indian origin cannot buy in India under FEMA, only lease up to five years.",
    sources: "Savills H1 2026; Knight Frank Wealth Report 2026; Global Property Guide (Q2 2026); PwC India and UAE; HomeFirst India on Maharashtra stamp duty (Jun 2026); Dubai Law No. 7 of 2006; RBI FAQs; Embassy of India Abu Dhabi; FlightConnections." },
];

// The message she gets for each script: fits WhatsApp's 1,024-character button body.
export function worldReviewBody(s) {
  return s.n + "/10 · Dubai versus " + s.cityName + ": " + s.title + "\n\n" + s.text;
}
export const WORLD_REVIEW_INTRO = "Good morning, Black Coffee. Ten short scripts to camera, Dubai against one city each, 45 to 60 seconds. For each one tap 👍 if you would say it as it is, ✏️ if you want it changed, then tell me what, or 👎 if it is not you.\n\n— Curated for Black Coffee, by Papi";
export const WORLD_REVIEW_BUTTONS = (n) => [{ id: "wld:fb:" + n + ":yes", title: "👍 Say it" }, { id: "wld:fb:" + n + ":fix", title: "✏️ Change it" }, { id: "wld:fb:" + n + ":no", title: "👎 Not me" }];
// "3: too long" / "script 3 too long" / "3 - shorter" -> { n: 3, note: "too long" }; anything else -> null
export function worldFbParse(text) {
  const m = String(text || "").trim().match(/^(?:script\s*)?(\d{1,2})\s*(?:[:\-.]|\s)\s*(.{2,})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  if (n < 1 || n > 10) return null;
  return { n, note: m[2].trim() };
}

// ── v155 (16 Sep 2026) — the facts the Versus page shows beside the scripts. Same rule as everything above: read on a page, with the
// source and its date in the text; "not verified" where it was not. Kendall: "how do we use this data other than reading it?"
// The per-city numeric readings (door tax, gain tax, holding) exist so the page can draw bars; the sentences stay the record.
export const WORLD_STORY = {
  london: [
    ["home", "A Mayfair two-bedroom, this month", "Palm two-bed, 171 m²<small>AED 5m median, 78 register sales</small>", "944 sq ft, £1.5m<small>Bourdon Street, Knight Frank</small>", "<p>Knight Frank Mayfair apartments for sale, September 2026: Bourdon Street W1K, two bedrooms, 944 square feet, guide £1,500,000; Mount Street £1,550,000 for 1,031 square feet; Bolton Street £1,600,000 for 842 square feet.</p><p>Dubai side: DLD Open Data 2026, median size of the 78 two-bedroom sales registered at AED 4.5 to 5.5 million on Palm Jumeirah.</p>"],
    ["tag", "Stamp duty on that flat, foreign second home", "AED 200,000<small>4% of AED 5m</small>", "£198,750<small>13.25% of £1.5m</small>", "<p>GOV.UK rates with the 5% additional-property and 2% non-resident surcharges: 0 to £125k at 7% (£8,750), to £250k at 9% (£11,250), to £925k at 12% (£81,000), to £1.5m at 17% (£97,750). Total £198,750. On £3m it is £483,750, 16.1%.</p>"],
    ["yield", "Where prime London sits", "prime down 4.5% in H1 2026<small>Savills</small>", "24.5% below its 2014 peak<small>down 1.9% in H1 2026</small>", "<p>Savills: prime central London values fell 4.8% in 2025 and sit 24.5% below their 2014 peak; H1 2026 down 1.9%; forecast up to 1.9% more off in H2. Dubai prime down 4.5% in H1 2026 with around 10% expected off in H2.</p>"],
    ["calendar", "Council tax, band H, Westminster", "none<small>5% housing fee on rental value</small>", "£2,096 a year<small>2026/27</small>", "<p>Westminster City Council 2026/27: band H £1,074.68 plus the Greater London Authority £1,021.02 = £2,095.70. Montpelier Square adds a £1,101.70 precept.</p>"],
  ],
  monaco: [
    ["home", "What actually sells", "two-bed, 128 m²<small>at US$1m, citywide median</small>", "average studio €2.0m<small>average one-bedroom €4.0m</small>", "<p>IMSEE Observatoire de l'Immobilier 2025 (February 2026): 429 resales in 2025, average resale €7.6m, median €4.0m; average studio €2.0m (a record), average two-room flat €4.0m; only 274 resales under €5m. Knight Frank's 16 square metres for US$1m is arithmetic on the average price, not a home anyone sells.</p>"],
    ["area", "The cheapest studio listed", "36 m² median studio<small>AED 671,000 median, DLD 2026</small>", "€950,000 for 25 m²<small>Monaco-Ville, this month</small>", "<p>montecarlo-realestate.com, September 2026: €950,000 for 25 m² in Monaco-Ville; La Costa Properties €1,160,000 for 25 m² and €1,350,000 for 29 m².</p>"],
    ["key", "A parking space", "included with most units", "€150,000 to €600,000<small>up to €1.2m for a double</small>", "<p>Chambre Immobilière Monégasque via prime.mc; 122 spaces listed, lowest €235,000 (Millefiori), highest €1,200,000 (Carré d'Or double).</p>"],
    ["people", "Room to breathe", "3,570 hours of sun", "38,857 people on 2.02 km²<small>19,236 per km²</small>", "<p>IMSEE 2025 census 38,857 residents; area 2.02 km² (Monte-Carlo SBM). Density is my arithmetic.</p>"],
  ],
  hongkong: [
    ["area", "Floor space per person", "one-bed median 72 m²<small>DLD 2026, 37,573 sales</small>", "172 sq ft each<small>about 16 m², 2021 census</small>", "<p>HKSAR Government reply LCQ22, 29 March 2023: median per-capita floor area about 172 square feet at the 2021 census.</p>"],
    ["home", "The smallest a new flat may be", "studio median 36 m²", "26 m² since 2022<small>government land sales</small>", "<p>From late February 2022 flats on government land sales, railway and URA sites must be at least 26 m² (about 280 sq ft) saleable; public rental housing at least 21 m² internal.</p>"],
    ["city", "Small flats in a year", "—", "47% of 2022 completions ≤430 sq ft", "<p>Our Hong Kong Foundation, May 2023: 9,881 private flats of 430 square feet or less completed in 2022, 47% of completions.</p>"],
    ["tag", "Island, small flats, per sq ft", "AED 4,260 prime", "HK$14,205 saleable<small>Class A, July 2026</small>", "<p>Rating and Valuation Department, July 2026 provisional: Class A (under 40 m²) Hong Kong Island HK$152,904 per m² saleable, about HK$14,205 per square foot. Averages reflect the mix transacted; primary sales excluded.</p>"],
  ],
  singapore: [
    ["key", "The right to own a car", "no permit needed", "S$135,001 for 10 years<small>COE, September 2026</small>", "<p>LTA COE results, first bidding of September 2026: Category B S$135,001 (quota 934, 1,333 bids). A certificate lets you register and use a car for ten years.</p>"],
    ["tag", "Foreign buyer's stamp duty on S$3m", "4% transfer fee", "S$1,919,600<small>64% of the price</small>", "<p>Ministry of Finance: ABSD 60% for foreigners since 27 April 2023 (S$1,800,000) plus BSD in tiers (S$119,600) = S$1,919,600 on S$3,000,000.</p>"],
    ["people", "Year 7 school fees", "AED 97,415<small>Dubai College 2026/27</small>", "S$53,535<small>Tanglin Trust 2026/27</small>", "<p>Tanglin Trust School fees page 2026/27: Years 7 to 9 S$53,535 a year plus enrolment and capital levies; UWCSEA Grade 6 S$46,866 plus levies; Singapore American School first-year total S$62,990. Dubai College 2026/27 Years 7 to 11 AED 97,415 plus a refundable AED 30,000 debenture; GEMS Wellington International Year 7 AED 82,540 (2025/26).</p>"],
    ["home", "Renting a three-bed in the centre", "AED 300,000 a year<small>Downtown, 163 m² median, Ejari Aug-Sep 2026</small>", "S$7,400 a month<small>District 9, Q4 2024</small>", "<p>Singapore: Savills Research via Real Estate Asia, District 9 three-bedroom median S$7,400 a month, Q4 2024 (latest fetched). Dubai: new Ejari contracts registered 18 August to 15 September 2026, units of 140 to 200 m² in Burj Khalifa district, median AED 300,000 a year (405 contracts); Palm Jumeirah AED 205,000; Marina AED 170,000.</p>"],
  ],
  sydney: [
    ["key", "Can a foreigner buy an established home", "yes, freehold", "no, until 30 June 2029<small>ban since 1 April 2025</small>", "<p>Australian Taxation Office, updated 12 May 2026: the ban on foreign persons buying established dwellings started 1 April 2025 and was extended in Budget 2026-27 to 30 June 2029. Exceptions for supply-adding investments, permanent residents and New Zealand citizens.</p>"],
    ["tag", "Application fee on a AUD 3m home", "none", "AUD 187,800<small>established dwelling, 2026/27</small>", "<p>ATO fee schedule 1 July 2026 to 30 June 2027: established dwelling AUD 187,800 for the 'AUD 3 million or less' tier; new dwelling AUD 62,600. Vacant for 183 days in a year and the vacancy fee is double the application fee.</p>"],
    ["calendar", "Foreign owner, every year", "none", "5% of land value<small>surcharge land tax, no threshold</small>", "<p>Revenue NSW: surcharge land tax 5% of land value from the 2025 tax year, no tax-free threshold; surcharge purchaser duty 9% on top of transfer duty.</p>"],
    ["home", "Median house price", "AED 3.95m three-bed median<small>DLD 2026, apartments</small>", "AUD 1,733,891<small>Domain, June quarter 2026</small>", "<p>Domain House Price Report June 2026: Sydney median house AUD 1,733,891 (down 3.3% on the quarter, up 1.1% on the year); median unit AUD 849,068.</p>"],
  ],
  newyork: [
    ["home", "A Manhattan two-bed, sold in August", "Downtown two-bed median AED 3.8m<small>127 m², DLD 2026</small>", "US$3.2m at CitySpire<small>closed 21 August 2026</small>", "<p>StreetEasy: 150 West 56th Street #6001, two bedrooms, sold US$3,200,000 on 21 August 2026.</p>"],
    ["calendar", "Its monthly bills", "AED 24 per sq ft a year<small>Bellevue Towers service charge</small>", "US$2,909 tax + US$2,553 charges<small>over US$65,000 a year</small>", "<p>StreetEasy listing record: taxes US$2,909 a month (about 1.09% of the sale price a year), common charges US$2,553 a month. Manhattan condos average US$3.37 per square foot a month in charges and taxes (Miller Samuel via Brick Underground, Q2 2026). Dubai: Bellevue Towers AED 24.09 per square foot a year (DLD 2024/25 via Property Finder); no property tax.</p>"],
    ["coin", "Income tax at the top", "0%", "about 52%<small>37 + 10.9 + 3.876</small>", "<p>PwC: federal 37% (2025). New York State IT-2105-I 2026: 10.9% over US$25 million; New York City 3.876% over US$50,000.</p>"],
    ["people", "Millionaires in residence", "81,200<small>18th in the world</small>", "384,500<small>the most in the world</small>", "<p>Henley &amp; Partners World's Wealthiest Cities 2025.</p>"],
  ],
  geneva: [
    ["key", "Can a non-resident foreigner buy", "yes, freehold", "authorisation, in principle<small>Lex Koller</small>", "<p>Chambre des notaires de Genève: acquisition by a 'personne à l'étranger' is in principle subject to authorisation; exceptions for residents buying a principal residence.</p>"],
    ["home", "Anything to rent", "—", "0.31% vacancy<small>1 June 2026, lowest since 2011</small>", "<p>OCSTAT via Millenium Properties, August 2026: 793 vacant units, 0.31%. Average free-market rent for a four-room flat CHF 1,639 a month in 2025 (OCSTAT).</p>"],
    ["city", "Quality of living, two rankings", "83rd and 79th<small>Mercer 2024, EIU 2026</small>", "3rd and 6th<small>Mercer 2024, EIU 2026 at 96.1</small>", "<p>Mercer Quality of Living 2024 (241 cities): Geneva 3rd, Dubai 83rd, the highest in the Middle East. EIU Global Liveability 2026 (173 cities): Geneva 6th at 96.1, Dubai 79th, down four places on the Iran conflict. EIU weights: stability 25%, healthcare 20%, culture and environment 25%, education 10%, infrastructure 20%.</p>"],
    ["sun", "Sunshine and what you keep", "3,570 hours, 0% tax", "1,887 hours, about 45% tax", "<p>MeteoSwiss 1991-2020 Geneva Airport 1,887 hours; Dubai Meteorological Office 3,570. Geneva top combined rate about 44.75% (AccountEX; PwC gives federal 11.5% plus cantonal and communal).</p>"],
  ],
  paris: [
    ["wallet", "Wealth tax on the home, every year", "none", "0.5% to 1.5% above €1.3m<small>IFI, non-residents included</small>", "<p>impots.gouv.fr and service-public.fr, 2026: IFI applies above €1.3 million of net taxable real estate at 1 January; bands 0.5% (€800k to €1.3m once liable), 0.7%, 1%, 1.25%, 1.5% above €10m. Non-residents pay it on French property.</p>"],
    ["calendar", "Property tax, the rate and the surcharge", "none<small>5% housing fee on rental value</small>", "20.5% since 2023<small>plus 60% on second homes</small>", "<p>Ville de Paris, February 2026: taxe foncière rate raised from 13.5% to 20.5% in 2023; a 70 m² flat pays about €1,000 (11e) to €1,500 to €1,800 (7e) a year (Immover, August 2026). Taxe d'habitation on second homes carries a 60% majoration in Paris.</p>"],
    ["area", "The Sixth, per square metre", "AED 4,260 per sq ft prime", "€14,010 per m²<small>notaires, Q3 2025</small>", "<p>Chambre des Notaires de Paris, standardised prices for old apartments, Q3 2025: 6e €14,010, 7e €13,180, 8e €12,190 per m². MeilleursAgents, 1 September 2026: 6e €14,263, 7e €15,197.</p>"],
    ["tag", "Selling", "no tax on the gain", "36.2% plus a surtax<small>19% tax + 17.2% social</small>", "<p>PwC France: 19% income tax plus 17.2% social charges on the gain, plus a 2 to 6% surtax on gains over €50,000; exempt after 22 years (tax) and 30 years (social charges).</p>"],
  ],
  miami: [
    ["shield", "Home insurance, a year", "no insurance mandate on a flat<small>building cover in the service charge</small>", "US$15,396<small>Miami; US average US$2,808</small>", "<p>Insurify, updated 31 August 2026 (US$300k dwelling): Miami US$15,396, Florida US$6,432, United States US$2,808. Florida condo-unit premiums rose about 50% in the four years to December 2024 (WLRN).</p>"],
    ["calendar", "Property tax on a US$2m home", "none", "about US$40,000 a year<small>19.99 mills, City of Miami 2025</small>", "<p>Miami-Dade Property Appraiser 2025 adopted millage: City of Miami total 19.9878 mills, about 2.0% of assessed value before exemptions. US$40,000 is arithmetic on US$2m.</p>"],
    ["sun", "Heat, and the season", "July 41.7°C, no storms", "July 32.6°C, hurricanes June to November", "<p>Dubai Meteorological Office 1991-2020: July mean daily maximum 41.7°C, August 42.1°C, humidity 55%. NOAA 1991-2020 Miami: July 32.6°C, 187 mm of rain. Hurricane season 1 June to 30 November, peak 10 September. 2024: Helene and Milton hit Florida; 2025: no US landfall.</p>"],
    ["yield", "What the flat pays, gross", "5.5%", "6.8%<small>Miami wins this one</small>", "<p>Global Property Guide, Q2 2026: Miami about 6.8%, Dubai about 5.5% market-wide (Palm Jumeirah about 4.6%, Downtown about 5.1%, Engel &amp; Voelkers August 2026).</p>"],
  ],
  mumbai: [
    ["key", "Who may own", "any nationality, freehold<small>designated areas, Law 7 of 2006</small>", "NRIs and OCIs<small>foreign nationals: lease up to 5 years</small>", "<p>Reserve Bank of India FAQ: NRIs and OCIs may buy residential and commercial property; a foreign national of non-Indian origin resident outside India may only lease for up to five years or inherit.</p>"],
    ["wallet", "Money allowed out of India, a year", "—", "US$250,000<small>per person, LRS</small>", "<p>RBI Liberalised Remittance Scheme: US$250,000 per financial year per resident individual, minors included.</p>"],
    ["people", "Indians in the UAE", "4.3 million<small>the largest community</small>", "—", "<p>Embassy of India, Abu Dhabi, June 2026: approximately 4.3 million; 4.36 million at December 2024 per the Consul General, more than half in Dubai. UAE sends 19.2% of remittances to India.</p>"],
    ["area", "Worli, asking price", "AED 4,260 per sq ft prime", "₹74,050 per sq ft<small>asking, June 2026</small>", "<p>Square Yards, June 2026: Worli average asking ₹74,050 per square foot, up from ₹65,700 in September 2025. Asking, not registered.</p>"],
  ],
};
export const WORLD_CULTURE = {
  dubai:     { hall: ["Dubai Opera", "2016, 2,000 seats"], stars: ["2026 guide announced 6 October", "Michelin Guide Dubai, fifth edition"], unesco: ["none in Dubai", ""], event: ["—", "figure not verified"], f1: ["no race in Dubai", "Abu Dhabi Grand Prix, 4 to 6 December 2026"], air: ["95.2 million international", "DXB 2025, the most ever at any airport"], tall: ["Burj Khalifa, 828 m", "the tallest building in the world"] },
  monaco:    { hall: ["Opéra de Monte-Carlo", "1879, 524 seats"], stars: ["9 restaurants, 14 stars", "France and Monaco guide 2026"], unesco: ["none", ""], event: ["Grand Prix, 250,000 over four days", "2025, Saturday and Sunday sold out at 24,000"], f1: ["yes", "Grand Prix de Monaco, 5 to 7 June 2026"], air: ["15.2 million at Nice", "2025, the airport that serves Monaco"], tall: ["Tour Odéon, 170 m", ""] },
  hongkong:  { hall: ["Hong Kong Cultural Centre", "1989, 2,019 in the concert hall"], stars: ["77 starred restaurants", "7 three-star, Hong Kong and Macau guide 2026"], unesco: ["none", ""], event: ["Hong Kong Sevens", "attendance not verified"], f1: ["no", ""], air: ["—", "not verified"], tall: ["International Commerce Centre, 484 m", ""] },
  geneva:    { hall: ["Grand Théâtre de Genève", "1879, 1,488 seats"], stars: ["8 starred restaurants", "in and around the city, Switzerland guide 2026"], unesco: ["1 listed building", "Immeuble Clarté, Le Corbusier"], event: ["lakeside fireworks, 300,000 to 500,000", "Genève Genève; the old Fêtes de Genève drew about 2 million"], f1: ["no", ""], air: ["—", "not verified"], tall: ["Cité du Lignon tower, 91 m", ""] },
  newyork:   { hall: ["Metropolitan Opera House", "1966, 3,794 seats"], stars: ["—", "2025 city total not verified; 2 three-star, 6 two-star"], unesco: ["Statue of Liberty", "1984"], event: ["Macy's Thanksgiving Parade", "attendance not verified"], f1: ["no", ""], air: ["—", "not verified"], tall: ["One World Trade Center, 541 m", ""] },
  paris:     { hall: ["Palais Garnier", "1875, 1,979 seats"], stars: ["about 100 starred restaurants", "roughly 140 stars, 10 three-star, 2025 guide"], unesco: ["Banks of the Seine", "1991"], event: ["Fashion Week, about €1.2 billion", "economic impact, federation estimate 2026"], f1: ["no", ""], air: ["72.0 million at CDG", "2025"], tall: ["Tours DUO, 180 m", "Tour Triangle 181 m topped out"] },
  london:    { hall: ["Royal Opera House", "1858, 2,256 seats"], stars: ["—", "London total not verified; Great Britain and Ireland 2026: 225 starred"], unesco: ["4 sites", "Westminster, Tower of London, Greenwich, Kew"], event: ["Notting Hill Carnival, about 2 million", "annually"], f1: ["no", "British Grand Prix at Silverstone"], air: ["84 million at Heathrow", "2025"], tall: ["The Shard, 306 m", ""] },
  sydney:    { hall: ["Sydney Opera House", "1973, 2,679 in the concert hall"], stars: ["no Michelin guide", "Australia is not covered"], unesco: ["2 listings", "Sydney Opera House; convict sites"], event: ["New Year's Eve, nearly a million", "City of Sydney, 1 January 2026"], f1: ["no", "Australian Grand Prix in Melbourne"], air: ["17.2 million international", "of 42.5 million, 2025"], tall: ["One Barangaroo, 271 m", ""] },
  singapore: { hall: ["Esplanade, Theatres on the Bay", "2002, about 1,600 in the concert hall"], stars: ["45 starred restaurants", "3 three-star, Singapore guide 2026"], unesco: ["Botanic Gardens", "2015"], event: ["Grand Prix, 300,641 over three days", "2025, up 11.7%"], f1: ["yes", "Singapore Grand Prix, 9 to 11 October 2026, at night"], air: ["close to 70 million at Changi", "2025"], tall: ["Guoco Tower, 284 m", "8 Shenton Way, 300 m, listed by CTBUH; status not verified"] },
  miami:     { hall: ["Adrienne Arsht Center", "2006, 2,400 in the opera house"], stars: ["15 starred restaurants", "1 two-star, Florida guide 2026"], unesco: ["none in the city", "Everglades is elsewhere in Florida"], event: ["Art Basel Miami Beach", "attendance not verified"], f1: ["yes", "Miami Grand Prix, 1 to 3 May 2026"], air: ["24.8 million international", "of 55.3 million, 2025"], tall: ["Waldorf Astoria Residences, 317 m", ""] },
  mumbai:    { hall: ["NCPA, Jamshed Bhabha Theatre", "1999, 1,109 seats"], stars: ["no Michelin guide", "India is not covered"], unesco: ["2 sites", "Chhatrapati Shivaji Terminus; Victorian Gothic and Art Deco ensembles"], event: ["Ganesh Chaturthi", "attendance not verified"], f1: ["no", ""], air: ["16.3 million international", "of 55.5 million, 2025"], tall: ["Prestige Sky Tower, 308 m", ""] },
};
export const WORLD_CULTURE_SOURCES = {
  hall: "Venue articles on Wikipedia citing each house: Dubai Opera (2016, 2,000), Opéra de Monte-Carlo (1879, 524), Hong Kong Cultural Centre (1989), Grand Théâtre de Genève (1879, 1,488), Metropolitan Opera (1966, 3,794 seated), Palais Garnier (1875, 1,979), Royal Opera House (1858, 2,256), Sydney Opera House (1973, 2,679), Esplanade (2002), Adrienne Arsht Center (2006, 2,400), NCPA Mumbai (1999, 1,109).",
  stars: "Michelin selections as reported: Monaco 9 restaurants and 14 stars (Luxury Lifestyle, May 2026); Hong Kong 77 (afoodieworld, March 2026); Geneva 8 (Geneva Tourism, 2026 guide); Paris about 100 restaurants and 140 stars (Paris tourism office, 2025 guide); Singapore 45 (hungrygowhere, August 2026); Miami 15 (Greater Miami CVB, 2026); Dubai's 2026 selection is announced on 6 October 2026 (Gulf News); no guide covers Australia or India. New York and London city totals were not verified.",
  unesco: "UNESCO World Heritage lists by country (Wikipedia): London 4 (Westminster 1987, Tower 1988, Greenwich 1997, Kew 2003); Sydney Opera House 2007 and the convict sites 2010; Statue of Liberty 1984; Paris, Banks of the Seine 1991; Singapore Botanic Gardens 2015; Mumbai's terminus 2004 and ensembles 2018; Geneva's Immeuble Clarté within Le Corbusier's listing; none in Dubai, Monaco, Hong Kong or Miami.",
  event: "Monaco Life, 27 May 2025 (Grand Prix); Geneva Tourism (fireworks); Monocle, 11 March 2026 (Paris Fashion Week); Wikipedia (Notting Hill Carnival); City of Sydney, 1 January 2026; Singapore GP, 5 October 2025. Figures for Dubai Shopping Festival, the Hong Kong Sevens, Macy's parade, Art Basel and Ganesh Chaturthi were not read on a page and are left out.",
  f1: "Formula1.com 2026 calendar, 23 rounds: Monaco round 6 (5 to 7 June), Singapore round 17 (9 to 11 October), Miami round 4 (1 to 3 May), Abu Dhabi 4 to 6 December. No race in Dubai, London (Silverstone), Sydney (Melbourne), Paris, Geneva, Hong Kong, New York or Mumbai.",
  air: "Airport operators' 2025 results: Dubai Airports, 11 February 2026 (95.2 million, the highest annual international traffic any airport has recorded); Nice 15.23 million; Groupe ADP (CDG 72,029,407); Heathrow (84 million); Sydney Airport (17.17 million international of 42.54 million); Changi (close to 70 million); Miami-Dade Aviation (55.3 million, 24.8 million international); CSMIA Mumbai (55.5 million, 16.3 million international). Hong Kong, Geneva and JFK were not read on a page.",
  tall: "Council on Tall Buildings and Urban Habitat, skyscrapercenter.com city pages, September 2026. Paris: Tours DUO 180 m completed, Tour Triangle 181.4 m topped out. Singapore: CTBUH lists 8 Shenton Way redevelopment at 299.7 m with Guoco Tower 283.7 m next; completion status of the first was not verified.",
};
export const WORLD_NUMERIC = {
  door:   { dubai:4, monaco:6.25, hongkong:4.25, geneva:4, newyork:3.9, paris:6.3, london:19, sydney:16, singapore:66, miami:0.7, mumbai:6 },
  doorTxt:{ dubai:"4% transfer fee", monaco:"about 6.25%: duty plus notary", hongkong:"up to 4.25%", geneva:"about 4% all in", newyork:"up to 3.9% mansion tax", paris:"about 6.3%", london:"up to 19% for a foreign second-home buyer", sydney:"up to 16%: duty plus the foreign surcharge", singapore:"up to 66%: 60% ABSD plus 6% BSD", miami:"0.7% documentary stamp", mumbai:"6% stamp duty" },
  gains:  { dubai:0, monaco:0, hongkong:0, geneva:50, newyork:23.8, paris:36.2, london:24, sydney:47, singapore:0, miami:23.8, mumbai:12.5 },
  gainsTxt:{ dubai:"none", monaco:"none for residents", hongkong:"none", geneva:"50% in year one, 2% after 25 years", newyork:"23.8% federal, before state and city", paris:"36.2% with social charges", london:"24% higher rate", sydney:"marginal rate, no discount for foreigners", singapore:"none", miami:"23.8% federal, no state tax", mumbai:"12.5% long term" },
  hold:   { dubai:"no property tax; 5% housing fee on the rental value", monaco:"no property tax", hongkong:"rates and government rent", geneva:"cantonal wealth and property taxes", newyork:"about 1.1% of value a year in taxes, plus common charges", paris:"property tax up 52% since 2023; wealth tax above EUR 1.3m", london:"council tax, band H about GBP 2,100", sydney:"5% foreign-owner land tax surcharge every year", singapore:"property tax on annual value", miami:"about 2% of value a year, plus insurance averaging US$15,396", mumbai:"municipal property tax" },
};
export const WORLD_SIZE_REFS = [ [14, "a car parking bay"], [26, "a Rove hotel room"], [50, "a Dubai one-bedroom"], [96, "the average English home"], [200, "a padel court"], [261, "a doubles tennis court"] ];
// Dubai register bands: what a budget actually bought, DLD Open Data 1 Jan-14 Sep 2026 (residential unit sales, medians)
export const WORLD_REGISTER = [ [1600000, "a one-bedroom, 72 m² citywide median"], [3000000, "a two-bedroom, 116 m² citywide median"], [4200000, "a two-bedroom, 128 m² citywide; on the Palm 161 m²"], [6000000, "a two-bedroom, 147 m² citywide; on the Palm 171 m²"], [1e12, "a three-bedroom, 172 m² citywide median; on the Palm a two-bedroom, 162 m²"] ];
// Currency: ECB reference rates of 15 September 2026; the dirham pegged at 3.6725 per US dollar. Refresh with the rest.
export const WORLD_FX = { date: "15 September 2026", AED_PER_EUR: 1.1539 * 3.6725, rates: (function(){ const AED_PER_EUR = 1.1539 * 3.6725; return { AED: 1, USD: 3.6725, EUR: AED_PER_EUR, GBP: AED_PER_EUR / 0.8558, CHF: AED_PER_EUR / 0.9441, AUD: AED_PER_EUR / 1.6194, SGD: AED_PER_EUR / 1.4683, HKD: AED_PER_EUR / 9.0518, INR: AED_PER_EUR / 110.7285 }; })(), symbols: { AED: "AED ", USD: "US$", EUR: "€", GBP: "£", CHF: "CHF ", AUD: "A$", SGD: "S$", HKD: "HK$", INR: "₹" }, presets: { AED: [2e6, 3672500, 5e6, 1e7], USD: [5e5, 1e6, 2e6, 5e6], EUR: [5e5, 1e6, 2e6, 5e6], GBP: [5e5, 1e6, 2e6, 5e6], CHF: [5e5, 1e6, 2e6, 5e6], AUD: [1e6, 2e6, 3e6, 5e6], SGD: [1e6, 2e6, 3e6, 5e6], HKD: [5e6, 1e7, 2e7, 4e7], INR: [5e7, 1e8, 2e8, 5e8] } };
