// v281 - a realistic Ejari stub for the morning-card test and the local renders. NOT a test (run_all only runs test_*.mjs).
// Deterministic: the same `asOf` always gives the same rows. The shapes are the DDA session's (1 Oct 2026): the Dubai-wide file is
// {as_of, source, caveat, basis, per_area: {fields, rows: [arrays]}, per_developer}, a district file is {as_of, source, basis, fields,
// rows: [objects]}, the projects index is {as_of, source, projects, index: {"<project_number>": {name_en, name_ar, ...}}}.
// The figures are invented for testing and rendering only.

const D = 86400000;
const dstr = (ms) => new Date(ms).toISOString().slice(0, 10);
const addD = (s, n) => dstr(Date.parse(s + "T00:00:00Z") + n * D);

// district slug, area (register), weight, projects [key id, name_en, name_ar, number, app name, developer]
const DISTRICTS = [
  ["jumeirahvillagecircle", "Al Barsha South Fourth", 1.0, [[101, "BINGHATTI AMBER", "بن غاطي أمبر", "2673", "Binghatti Amber", "Binghatti"], [102, "BLOOM HEIGHTS", "بلوم هايتس", "1871", "Bloom Heights", "Bloom"], [103, "OXFORD 212", "أكسفورد 212", "3120", "", "Tiger"]]],
  ["businessbay", "Business Bay", 0.75, [[201, "THE VOGUE", "ذا فوغ", "444", "DAMAC Maison Canal Views", "DAMAC"], [202, "AYKON CITY 2", "أيكون سيتي 2", "", "Aykon City 2", "DAMAC"], [203, "BAY SQUARE", "باي سكوير", "905", "Bay Square", "Dubai Properties"]]],
  ["dubaimarina", "Marsa Dubai", 0.62, [[301, "MARINA GATE 1", "مارينا جيت 1", "1688", "Marina Gate", "Select"], [302, "PRINCESS TOWER", "برنسيس تاور", "512", "Princess Tower", "Tameer"]]],
  ["jltnorth", "Al Thanyah Fifth", 0.48, [[401, "LAKE CITY TOWER", "ليك سيتي تاور", "377", "Lake City Tower", "Nakheel"]]],
  ["arjan", "Al Barsha South Third", 0.4, [[501, "MIRACLEZ TOWER", "ميراكلز تاور", "2241", "Miraclz Tower", "Danube"]]],
  ["burjkhalifa", "Burj Khalifa", 0.36, [[601, "BURJ VISTA 1", "برج فيستا 1", "1033", "Burj Vista", "Emaar"]]],
  ["dubaisportscity", "Al Hebiah Fourth", 0.3, [[701, "ELITE SPORTS RESIDENCE 5", "إيليت سبورتس ريزيدنس 5", "988", "", "Elite"]]],
  ["siliconoasis", "Nadd Hessa", 0.22, [[801, "BINGHATTI ROSE", "بن غاطي روز", "2210", "Binghatti Rose", "Binghatti"]]]
];
// sub_type as the register writes it, beds band, share, median rent (AED a year)
const TYPES = [["1bed room+Hall", "1", 0.38, 72000], ["Studio", "studio", 0.29, 52000], ["2bed room+Hall", "2", 0.16, 115000], ["Hotel", "studio", 0.05, 88000], ["Villa", "3+", 0.04, 240000], ["3bed room+Hall", "3", 0.04, 165000], ["Office", "office", 0.04, 95000]];

function rng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0; return (s >>> 8) / 16777216; }; }

// all project-level rows for `days` days ending `last`; desk: a business-centre flexi-desk block that would top MOST LET if counted
export function ejariStub(asOf, opts) {
  opts = opts || {};
  const last = opts.last || addD(asOf, -1), days = opts.days || 70, basis = opts.basis || "filed";
  const r = rng(Date.parse(last) / D);
  const rows = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addD(last, -i), dow = new Date(date + "T00:00:00Z").getUTCDay();
    const dayW = dow === 0 ? 0.35 : dow === 6 ? 0.45 : 1;   // Sunday and Saturday are quiet at the typing centres
    for (const [slug, area, w, projects] of DISTRICTS) {
      projects.forEach(([id, en, ar, no, , dev], pi) => {
        for (const [sub, beds, share, rent] of TYPES) {
          if (sub === "Villa" && slug !== "jumeirahvillagecircle" && slug !== "arjan") continue;
          for (const reg of ["New", "Renew"]) {
            const base = 52 * w * dayW * share * (reg === "Renew" ? 1.6 : 1) * (pi === 0 ? 1.1 : 0.8 / projects.length);
            const n = Math.round(base * (0.7 + 0.6 * r()));
            if (!n) continue;
            rows.push({ date, district: slug, area, dld_project: en, project_name_ar: ar, dld_project_number: no, key: slug + ":" + id, developer_number: "", developer: dev, beds, sub_type: sub, usage: sub === "Office" ? "Commercial" : "Residential", reg_type: reg, contracts: n, props: n, rent_median: Math.round(rent * (0.9 + 0.2 * r()) / 500) * 500, rent_q1: null, rent_q3: null, desk_like: false });
          }
        }
      });
    }
    if (!opts.noDesk) rows.push({ date, district: "businessbay", area: "Business Bay", dld_project: "REGUS BUSINESS CENTRE", project_name_ar: "ريجس بزنس سنتر", dld_project_number: "7001", key: "businessbay:999", developer_number: "", developer: "", beds: "office", sub_type: "Office", usage: "Commercial", reg_type: "New", contracts: 400, props: 400, rent_median: 9000, rent_q1: null, rent_q3: null, desk_like: true });
  }
  const FIELDS = ["date", "district", "area", "beds", "sub_type", "usage", "reg_type", "contracts", "props", "rent_median", "rent_q1", "rent_q3", "desk_like"];
  const agg = new Map();
  for (const x of rows) {
    const k = [x.date, x.district, x.area, x.beds, x.sub_type, x.usage, x.reg_type, x.desk_like].join("|");
    const a = agg.get(k) || Object.assign({}, x, { contracts: 0, props: 0, _r: [] });
    a.contracts += x.contracts; a.props += x.props; a._r.push(x.rent_median); agg.set(k, a);
  }
  const perArea = [...agg.values()].map((a) => { const s = a._r.sort((p, q) => p - q); a.rent_median = s[Math.floor(s.length / 2)]; return FIELDS.map((f) => a[f]); });
  const source = "Dubai Land Department, Ejari tenancy register" + (basis === "filed" ? " (gateway feed, by registration date)" : " (portal export, by contract start date)");
  const dubai = { as_of: asOf, source, caveat: "Counts are tenancy contracts, not units", basis, per_area: { fields: FIELDS, rows: perArea }, per_developer: { fields: ["date", "developer", "contracts"], rows: [] } };
  const byD = {};
  for (const x of rows) (byD[x.district] = byD[x.district] || []).push(x);
  const districts = {}; for (const k in byD) districts[k] = { as_of: asOf, source, basis, fields: Object.keys(byD[k][0]), rows: byD[k] };
  const index = {}; for (const [slug, area, , projects] of DISTRICTS) for (const [id, en, ar, no, , dev] of projects) if (no) index[no] = { name_en: en, name_ar: ar, area, district: slug, key: slug + ":" + id, developer: dev };
  const projectsIdx = { as_of: asOf, source: "Dubai Land Department, projects", projects: Object.keys(index).length, index };
  const items = []; for (const [slug, , , projects] of DISTRICTS) for (const [id, , , , app] of projects) if (app) items.push({ d: slug, i: id, n: app });
  return { dubai, districts, projects: projectsIdx, rentIndex: { items } };
}
// the KV entries, on the basis asked for: filed -> img_ejari_filed_*, start -> img_ejari_daily_dubai + img_ejari_recent_*
export function ejariStubKV(asOf, opts) {
  opts = opts || {};
  const s = ejariStub(asOf, opts), kv = {}, filed = (opts.basis || "filed") === "filed";
  kv[filed ? "img_ejari_filed_dubai" : "img_ejari_daily_dubai"] = JSON.stringify(s.dubai);
  for (const k in s.districts) kv[(filed ? "img_ejari_filed_" : "img_ejari_recent_") + k] = JSON.stringify(s.districts[k]);
  kv.img_ejari_projects_index = JSON.stringify(s.projects);
  kv.img_rent_index = JSON.stringify(s.rentIndex);
  return kv;
}
