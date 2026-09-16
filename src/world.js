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
  { key: "dubai", living: { liveability: "EIU Global Liveability Index 2026: 79th of 173 cities", cost_of_living: "Mercer Cost of Living 2024: 15th most expensive of 226 cities, the costliest in the Middle East", safety: "Numbeo crowd-sourced Safety Index, mid-2026: 6th safest of 401 cities (index 83.8)", quality_of_living: "Mercer Quality of Living 2024: 83rd of 241, the highest in the Middle East", millionaires: "Henley & Partners 2025: 81,200 resident millionaires, 18th in the world" }, name: "Dubai", flag: "🇦🇪", prime: 1160, m2: 62, base: true,
    note: "prime is the top end: the Palm, Downtown, Jumeirah Bay, Emirates Hills; market-wide the 2025 average was about AED 1,670 per sq ft (Betterhomes, full-year 2025)",
    dip: "Savills has Dubai prime values down 4.5% in the first half of 2026 and expects a fall of about 10% in the second half." },
  { key: "monaco", name: "Monaco", flag: "🇲🇨", prime: 6205, m2: 16, approx: true, role: "the world's ceiling: the most expensive homes on earth, so the sharpest single comparison" },
  { key: "hongkong", living: { liveability: "EIU Global Liveability Index 2026: 44th of 173 cities", cost_of_living: "Mercer Cost of Living 2024: the most expensive city of 226", safety: "Numbeo crowd-sourced Safety Index, mid-2026: 14th safest of 401 cities (index 78.2)", millionaires: "Henley & Partners 2025: 154,900 resident millionaires, 8th in the world" }, name: "Hong Kong", flag: "🇭🇰", prime: 3750, m2: 23, aliases: ["hong kong", "hk", "hongkong"], role: "the most expensive city in the Savills index" },
  { key: "geneva", living: { liveability: "EIU Global Liveability Index 2026: 6th of 173 cities", cost_of_living: "Mercer Cost of Living 2024: 4th most expensive of 226 cities", safety: "Numbeo crowd-sourced Safety Index, mid-2026: 75th safest of 401 cities (index 70.5)", quality_of_living: "Mercer Quality of Living 2024: 3rd of 241", millionaires: "Henley & Partners 2025: 70,200 resident millionaires, 22nd in the world" }, name: "Geneva", flag: "🇨🇭", prime: 2830, m2: 28, role: "the Swiss address wealth keeps: private banking, the lake, the quiet" },
  { key: "newyork", living: { liveability: "EIU Global Liveability Index 2026: 66th of 173 cities", cost_of_living: "Mercer Cost of Living 2024: 7th most expensive of 226 cities", safety: "Numbeo crowd-sourced Safety Index, mid-2026: 261st safest of 401 cities (index 49.2)", quality_of_living: "Mercer Quality of Living 2024: 45th of 241", millionaires: "Henley & Partners 2025: 384,500 resident millionaires, the most in the world" }, name: "New York", flag: "🇺🇸", prime: 2700, m2: 34, aliases: ["new york", "nyc", "ny", "manhattan", "newyork"], role: "the benchmark every broker's comparison uses" },
  { key: "paris", living: { cost_of_living: "Mercer Cost of Living 2024: 29th most expensive of 226 cities", safety: "Numbeo crowd-sourced Safety Index, mid-2026: 313th safest of 401 cities (index 42.1)", quality_of_living: "Mercer Quality of Living 2024: 34th of 241", millionaires: "Henley & Partners 2025: 160,100 resident millionaires, 7th in the world" }, name: "Paris", flag: "🇫🇷", prime: 2040, m2: 37, role: "the European gateway" },
  { key: "london", living: { liveability: "EIU Global Liveability Index 2026: 54th of 173 cities", cost_of_living: "Mercer Cost of Living 2024: 8th most expensive of 226 cities", safety: "Numbeo crowd-sourced Safety Index, mid-2026: 298th safest of 401 cities (index 44.7)", quality_of_living: "Mercer Quality of Living 2024: 40th of 241", millionaires: "Henley & Partners 2025: 215,700 resident millionaires, 6th in the world" }, name: "London", flag: "🇬🇧", prime: 1960, m2: 33, role: "the benchmark every broker's comparison uses",
    buyers: "British buyers were the second-largest group in Dubai in 2025 (brokerage rankings: Anarock via Khaleej Times; Betterhomes full-year 2025)" },
  { key: "sydney", living: { liveability: "EIU Global Liveability Index 2026: 4th of 173 cities", cost_of_living: "Mercer Cost of Living 2024: 58th most expensive of 226 cities", safety: "Numbeo crowd-sourced Safety Index, mid-2026: 107th safest of 401 cities (index 66.2)", quality_of_living: "Mercer Quality of Living 2024: 12th of 241", millionaires: "Henley & Partners 2025: 152,900 resident millionaires, 9th in the world" }, name: "Sydney", flag: "🇦🇺", prime: 1910, m2: 42, role: "the sunbelt city Dubai's buyers know",
    buyers: "Australian buyers entered Dubai's top four buyer groups in spring 2026 (brokerage rankings)" },
  { key: "singapore", living: { liveability: "EIU Global Liveability Index 2026: 26th of 173 cities", cost_of_living: "Mercer Cost of Living 2024: 2nd most expensive of 226 cities", safety: "Numbeo crowd-sourced Safety Index, mid-2026: 21st safest of 401 cities (index 77.7)", quality_of_living: "Mercer Quality of Living 2024: 30th of 241, the only Asian city in the top 50", millionaires: "Henley & Partners 2025: 242,400 resident millionaires, 4th in the world" }, name: "Singapore", flag: "🇸🇬", prime: 1850, m2: 28, role: "the closest rival hub: small, safe, expensive" },
  { key: "miami", name: "Miami", flag: "🇺🇸", prime: 1410, m2: 58, role: "the other sunbelt market with no state income tax" },
  { key: "mumbai", living: { liveability: "EIU Global Liveability Index 2026: 121st of 173 cities (score 47.9)", cost_of_living: "Mercer Cost of Living 2024: 136th most expensive of 226 cities", safety: "Numbeo crowd-sourced Safety Index, mid-2026: 187th safest of 401 cities (index 56.1)", quality_of_living: "Mercer Quality of Living 2024: 158th of 241", millionaires: "Henley & Partners 2025: more than 51,000 resident millionaires, 27th in the world" }, name: "Mumbai", flag: "🇮🇳", prime: 1130, m2: 96, aliases: ["mumbai", "bombay"], role: "the home city of Dubai's largest buyer group",
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
    note: c.note || undefined, role: c.role || undefined, buyers: c.buyers || undefined, caution: c.caution || undefined,
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
    "RULES. Use ONLY the numbers in the FACTS you are given, exactly as given, and only the ones this angle needs: two or three numbers, never a list. " +
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
  out += "\n\n_Sources: " + facts.sources.prices.name + ", " + facts.sources.prices.period + " · " + facts.sources.what_1m_buys.name + ", " + facts.sources.what_1m_buys.period + " · prime basis, top end of each market_";
  return out;
}
export function worldListRows(hist) {
  const recent = (hist || []).slice(0, 5).map(x => x.city);
  return WORLD_CITIES.filter(c => !c.base).map(c => ({ id: "wld:c:" + c.key, title: (c.flag || "") + " " + c.name, description: "prime US$" + c.prime.toLocaleString("en-US") + " per sq ft · " + (c.prime >= 1160 ? (Math.round(c.prime / 116) / 10) + "× Dubai" : "just under Dubai") + (recent.includes(c.key) ? " · recent" : "") }));
}
