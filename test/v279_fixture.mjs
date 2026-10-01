// v279 fixture: a realistic stub of the DDA session's Ejari files and the listing-site supply files, for
// test/test_v279_contracts.mjs and for rendering the screens at phone width. Deterministic: no randomness, no clock.
//
// Contract rows use the DDA session's FINAL field names (1 Oct 2026): date, district, area, dld_project, project_name_ar,
// dld_project_number, key, developer_number, developer, beds, sub_type, usage, reg_type, contracts, props, rent_median,
// rent_q1, rent_q3, desk_like. One file (businessbay, 30 days) is written as {fields, rows:[[...]]} to exercise that shape.
export const AS_OF = "2026-09-30";
const DAY = 86400000;
export const addD = (s, n) => new Date(Date.parse(s + "T00:00:00Z") + n * DAY).toISOString().slice(0, 10);
export const FIELDS = ["date", "district", "area", "dld_project", "project_name_ar", "dld_project_number", "key", "developer_number", "developer", "beds", "sub_type", "usage", "reg_type", "contracts", "props", "rent_median", "rent_q1", "rent_q3", "desk_like"];

// the buildings: [key, district, area, en, ar, number, devNo, dev, weight, bands, sub types by band, desk?]
export const B = [
  ["jumeirahvillagecircle:1490", "jumeirahvillagecircle", "Al Barsha South Fourth", "BINGHATTI NOVA", "بن غاطي نوفا", "1201", "1234", "BINGHATTI DEVELOPERS FZE", 5, ["studio", "1", "2"]],
  ["jumeirahvillagecircle:1491", "jumeirahvillagecircle", "Al Barsha South Fourth", "OXFORD TERRACES", "", "1310", "1234", "BINGHATTI DEVELOPERS FZE", 3, ["1", "2"]],
  ["jumeirahvillagecircle:1492", "jumeirahvillagecircle", "Al Barsha South Fourth", "THE VOGUE", "ذا فوج", "444", "777", "DAMAC PROPERTIES", 4, ["studio", "1"]],
  ["dld:prime residency 3", "jumeirahvillagecircle", "Al Barsha South Fourth", "", "برايم ريزيدنسي 3", "1555", "555", "PRIME DEVELOPERS", 2, ["studio"]],
  ["businessbay:2001", "businessbay", "Business Bay", "THE OPUS", "ذا أوبوس", "2210", "888", "OMNIYAT", 4, ["1", "2", "3"]],
  ["businessbay:2002", "businessbay", "Business Bay", "VERA RESIDENCES", "فيرا ريزيدنسز", "2215", "1234", "BINGHATTI DEVELOPERS FZE", 3, ["studio", "1"]],
  ["businessbay:2050", "businessbay", "Business Bay", "BAY SQUARE BUILDING 7", "باي سكوير 7", "2290", "999", "DUBAI PROPERTIES", 1, ["office"]],
  ["dubaimarina:3001", "dubaimarina", "Marsa Dubai", "MARINA GATE", "مارينا جيت", "3010", "321", "SELECT GROUP", 3, ["1", "2", "3+"]]
];
const SUB = { studio: "Studio", "1": "1bed room+Hall", "2": "2bed room+Hall", "3": "3bed room+Hall", "3+": "4bed room+Hall", office: "Office" };
const RENT = { studio: 52000, "1": 78000, "2": 115000, "3": 160000, "3+": 240000, office: 90000 };
// contracts for one building, band and reg on day i (0 = AS_OF): a fixed pattern, never random
const cnt = (i, b, k, reg) => { const w = B[b][8]; const v = ((i * 7 + b * 13 + k * 3 + (reg === "Renew" ? 5 : 0)) % 4); return reg === "Renew" ? Math.max(0, v - 1) * Math.ceil(w / 2) : v * Math.ceil(w / 2) + (i % 5 === 0 ? 1 : 0); };

// the contract rows by START date, 400 days back
export function startRows() {
  const rows = [];
  for (let i = 0; i < 400; i++) {
    const date = addD(AS_OF, -i);
    B.forEach((x, b) => x[9].forEach((band, k) => ["New", "Renew"].forEach((reg) => {
      let n = cnt(i, b, k, reg);
      // Marina Gate: some of its 1-beds are hotel apartments (the register says "Hotel")
      const hotel = x[0] === "dubaimarina:3001" && band === "1";
      if (n > 0) rows.push(row(x, date, band, hotel ? "Hotel" : SUB[band], reg, n, false));
      // Bay Square 7: flexi-desk licences, many a day, and a trickle of real office lettings
      if (x[0] === "businessbay:2050" && reg === "New") rows.push(row(x, date, "office", "Office", "New", 40 + (i % 3) * 5, true));
    })));
  }
  return rows;
}
function row(x, date, band, sub, reg, n, desk) {
  const r = RENT[band] || 80000;
  return { date, district: x[1], area: x[2], dld_project: x[3] || null, project_name_ar: x[4] || null, dld_project_number: x[5], key: x[0], developer_number: x[6], developer: x[7],
    beds: band, sub_type: sub, usage: band === "office" ? "Commercial" : "Residential", reg_type: reg, contracts: n, props: n,
    rent_median: n >= 3 ? r : (n >= 1 ? r + 1000 : null), rent_q1: n >= 3 ? r - 6000 : null, rent_q3: n >= 3 ? r + 7000 : null, desk_like: !!desk };
}
// the same contracts by FILING date: filed three days after they start (and never after AS_OF), so the two axes differ
export function filedRows() {
  return startRows().map((r) => Object.assign({}, r, { date: addD(r.date, 3) })).filter((r) => r.date <= AS_OF);
}
// Dubai-wide: per area, developer, bedrooms and reg type per day (no project, no sub_type), plus five districts we hold no files for
const EXTRA = [["alwasl", "Al Wasl", 6], ["dubaihills", "Hadaeq Sheikh Mohammed Bin Rashid", 5], ["arjan", "Al Barsha South Third", 4], ["jltnorth", "Al Thanyah Fifth", 7], ["motorcity", "Al Hebiah First", 2]];
export function dubaiRows(rows) {
  const g = new Map();
  for (const r of rows) {
    const k = [r.date, r.district, r.area, r.developer_number, r.beds, r.reg_type, r.desk_like].join("|");
    const x = g.get(k) || { date: r.date, district: r.district, area: r.area, developer_number: r.developer_number, developer: r.developer, beds: r.beds, reg_type: r.reg_type, contracts: 0, desk_like: r.desk_like };
    x.contracts += r.contracts; g.set(k, x);
  }
  const out = [...g.values()];
  const dates = [...new Set(rows.map((r) => r.date))];
  for (const d of dates) { const i = Math.round((Date.parse(AS_OF) - Date.parse(d)) / DAY); EXTRA.forEach((e, j) => { out.push({ date: d, district: e[0], area: e[1], developer_number: "9" + j, developer: "OTHER DEVELOPER " + j, beds: "1", reg_type: "New", contracts: e[2] + ((i + j) % 3), desk_like: false }); }); }
  return out;
}
export const APP_NAMES = { "jumeirahvillagecircle:1490": "Binghatti Nova", "jumeirahvillagecircle:1492": "DAMAC Maison Canal Views", "businessbay:2001": "The Opus by Omniyat" };

// the whole store. opts.filed=false leaves the filed files out (the fallback); opts.ejari=false leaves every Ejari file out.
export function buildStore(opts) {
  opts = opts || {};
  const store = new Map();
  const put = (k, v) => store.set(k, JSON.stringify(v));
  const S = startRows(), F = filedRows(), recentFrom = addD(AS_OF, -29);
  const dists = [...new Set(B.map((x) => x[1]))];
  if (opts.ejari !== false) {
    for (const d of dists) {
      const sd = S.filter((r) => r.district === d), fd = F.filter((r) => r.district === d);
      const recent = sd.filter((r) => r.date >= recentFrom);
      if (d === "businessbay") put("img_ejari_recent_" + d, { as_of: AS_OF, source: "fixture", basis: "start", fields: FIELDS, rows: recent.map((r) => FIELDS.map((f) => r[f])) });
      else put("img_ejari_recent_" + d, { as_of: AS_OF, source: "fixture", basis: "start", fields: FIELDS, rows: recent });
      put("img_ejari_daily_" + d, { as_of: AS_OF, source: "fixture", basis: "start", fields: FIELDS, rows: sd });
      if (opts.filed !== false) put("img_ejari_filed_" + d, { as_of: AS_OF, source: "fixture", basis: "filed", fields: FIELDS, rows: fd });
    }
    put("img_ejari_daily_dubai", { as_of: AS_OF, source: "fixture", basis: "start", rows: dubaiRows(S) });
    if (opts.filed !== false) put("img_ejari_filed_dubai", { as_of: AS_OF, source: "fixture", basis: "filed", rows: dubaiRows(F) });
    const index = {};
    for (const x of B) index[x[5]] = { name_en: x[3] || null, name_ar: x[4] || null, area: x[2], district: x[1], key: x[0], developer: x[7] };
    index["3100"] = { name_en: "MARINA PINNACLE", name_ar: "مارينا بيناكل", area: "Marsa Dubai", district: "dubaimarina", key: "dubaimarina:3002", developer: "TAMANI" };
    put("img_ejari_projects_index", { as_of: AS_OF, source: "fixture", projects: Object.keys(index).length, index });
  }
  put("img_rent_index", { items: Object.entries(APP_NAMES).map(([k, n]) => ({ d: k.split(":")[0], i: +k.split(":")[1], n })) });
  if (opts.supply !== false) {
    const t = "2026-10-01T05:40:00Z";
    put("img_pf_supply_jumeirahvillagecircle", { as_of: "2026-10-01", measure: "live rental adverts", rows: [
      { key: "jumeirahvillagecircle:1490", dld_project: "BINGHATTI NOVA", building_slug: "binghatti-nova", pf_name: "Binghatti Nova", beds_band: "studio", listings_live: 14, sources: { propertyfinder: 11, bayut: 9 }, median_price: 55000, median_days_listed: 12, delisted_since_last: 3, first_seen_min: "2026-08-02", crawled_at: t, urls: { propertyfinder: "https://www.propertyfinder.ae/en/building/binghatti-nova", bayut: "https://www.bayut.com/buildings/binghatti-nova" } },
      { key: "jumeirahvillagecircle:1490", dld_project: "BINGHATTI NOVA", building_slug: "binghatti-nova", pf_name: "Binghatti Nova", beds_band: "1", listings_live: 22, sources: { propertyfinder: 18, bayut: 15, dubizzle: 6 }, median_price: 79000, median_days_listed: 19, delisted_since_last: 5, crawled_at: t, pf_url: "https://www.propertyfinder.ae/en/building/binghatti-nova" },
      { key: "jumeirahvillagecircle:1490", dld_project: "BINGHATTI NOVA", pf_name: "Binghatti Nova", beds_band: "2", listings_live: 6, sources: { propertyfinder: 6 }, median_price: 118000, median_days_listed: 33, delisted_since_last: 1, crawled_at: t },
      { key: null, dld_project: null, building_slug: "jvc-skyline-tower", pf_name: "JVC Skyline Tower", beds_band: "1", listings_live: 9, sources: { propertyfinder: 9, newsite: 2 }, median_price: 72000, median_days_listed: 8, delisted_since_last: 2, crawled_at: t, pf_url: "https://www.propertyfinder.ae/en/building/jvc-skyline-tower" }
    ] });
  }
  return store;
}
