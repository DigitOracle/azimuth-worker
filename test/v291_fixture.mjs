// v291 CHECKLIST - the fixture shared by test/test_v291_checklist.mjs and the phone screenshot (test/render_v291_checklist.mjs).
// A small invented DAMAC Hills: twelve footprints, four sub-communities in the district model, a rent index, a units register, an
// amenity facts file and one developer brochure. Nothing here is real data.
export const READ = "read_key_for_the_owner_1234567890", CLIENT = "client_key_in_links_12345";
export const GKEY = "GMAPS_SECRET_v291_never_in_html_77ab";
export const ORIGIN = "https://azimuth-2.digitalchemy.workers.dev";
export const D = "damachills";

const sq = (x, y, s) => [x, y, x + s, y, x + s, y + s, x, y + s, x, y];
// ids 0-11 on a 4 x 3 grid, 60 m apart; ll maps lon/lat to x/y (x = 100000 lon - 5525000, y = 110000 lat - 2750000)
export const LAYER = { d: D, v: 1, b: Array.from({ length: 12 }, (_, i) => [i, 12, sq(60 * (i % 4), 60 * Math.floor(i / 4), 40)]),
  s: [], rp: [[-20, -10, 260, -10]], ll: [100000, 0, -5525000, 0, 110000, -2750000] };
const A = (i, cluster, extra) => Object.assign({ i, id: String(i), cluster, kind: "villa", lon: 55.25 + 0.0006 * (i % 4), lat: 25 + 0.0005 * Math.floor(i / 4) }, extra || {});
export const ANCHORS = { district: D, anchors: [
  A(0, "DAMAC HILLS -  TOPANGA", { place_label: "Topanga villa, Damac Hills", place_basis: "cluster" }),
  A(1, "DAMAC HILLS -  TOPANGA", { place_label: "Topanga villa, Damac Hills", place_basis: "cluster" }),
  A(2, "DAMAC HILLS -  TOPANGA", { place_label: "Topanga villa, Damac Hills", place_basis: "cluster" }),
  A(3, "DAMAC HILLS -  TOPANGA", { place_label: "Topanga villa, Damac Hills", place_basis: "cluster" }),
  A(4, "DAMAC HILLS - BROOKFIELD-2", { place_label: "Brookfield villa, Damac Hills", place_basis: "cluster" }),   // family-level: the shared "Brookfield" place
  A(5, "DAMAC HILLS - BROOKFIELD-2", { place_label: "Brookfield-2 villa, Damac Hills", place_basis: "cluster" }),
  A(6, "DAMAC HILLS - BROOKFIELD-2", { place_label: "Brookfield-2 villa, Damac Hills", place_basis: "cluster" }),
  A(7, "DAMAC HILLS -  RICHMOND", { place_label: "Al Hebiah Third villa", place_basis: "community" }),
  A(8, "DAMAC HILLS -  RICHMOND", { place_label: "Al Hebiah Third villa", place_basis: "community" }),
  A(9, null, { name: "Akoya One", kind: "building" }), A(10, null), A(11, null),
] };
const st = (n, m, s) => ({ n, nn: n, nr: 0, m, q1: m - 10000, q3: m + 10000, s, last: "2026-09-25" });
export const RENT_INDEX = { as_of: "2026-09-30", source_file: "rents-test.csv", items: [
  { p: "damachillstopanga", n: "DAMAC HILLS -  TOPANGA", area: "Al Hebiah Third", d: D, last: "2026-09-25", v: { "3": st(6, 189000, 253) } },
  { p: "damachillsbrookfield1", n: "DAMAC HILLS - BROOKFIELD-1", area: "Al Hebiah Third", d: D, last: "2026-09-08", v: { "3": st(4, 255000, 390) } },
  { p: "damachillsbrookfield2", n: "DAMAC HILLS - BROOKFIELD-2", area: "Al Hebiah Third", d: D, last: "2026-09-10", v: { "3": st(5, 240000, 300) } },
  { p: "akoyaone", n: "Akoya One", area: "Al Hebiah Third", d: D, i: 9, lon: 55.2512, lat: 25.0012, last: "2026-09-30", b: { "1": st(16, 65000, 59.1) } },
] };
export const UNITS = { district: D, buildings_by_id: { "9": { name: "Akoya One", units: 300 }, "20": { name: "DAMAC Hills - Golf Vita", units: 510 } } };
const fact = (v, level, say, source_name) => ({ v, level, say, source_name, as_of: "2026-09-18" });
export const AMENITIES = { district: D, homes: [
  { key: "dld:damachillstopanga", names: ["DAMAC HILLS - TOPANGA"], facts: {
    gym: fact(true, "community", "Gyms (DAMAC Hills)", "DAMAC's own DAMAC Hills page"),
    community_pool: fact(true, "community", "Community pools (DAMAC Hills)", "DAMAC's own DAMAC Hills page"),
    pets: fact(true, "community", "Pet-friendly (DAMAC Hills)", "DAMAC's own DAMAC Hills page"),
    parking: fact(true, "building", "Private parking", "the Land Department units register") } },
] };
export const BROCHURE = { name: "Akoya One", developer: "DAMAC", source_url: "https://www.damacproperties.com/en/projects/akoya-one", retrieved: "2026-09-20",
  amenities: ["Swimming pool", "Gym"], photos: [{ file: "exterior.jpg", key: "bph_akoyaone_ext", source_url: "https://www.damacproperties.com/en/projects/akoya-one" }] };
export const DISTRICTS_GEO = { districts: [{ slug: D, name: "DAMAC Hills" }] };

// a JPEG header the worker can size (jpegSize): SOI, SOF0 with the dimensions, a little padding, EOI
export function jpeg(w, h, pad) {
  const head = [0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1];
  const u = new Uint8Array(head.length + (pad || 64) + 2);
  u.set(head, 0); u[u.length - 2] = 0xff; u[u.length - 1] = 0xd9;
  return u;
}

export function makeKV() {
  const store = new Map();
  const KV = {
    store, writes: [],
    async get(k, t) {
      if (!store.has(k)) return null;
      const v = store.get(k);
      if (t === "arrayBuffer") return typeof v === "string" ? new TextEncoder().encode(v).buffer : (v instanceof Uint8Array ? v.buffer.slice(v.byteOffset, v.byteOffset + v.byteLength) : v);
      if (t === "json") return JSON.parse(typeof v === "string" ? v : new TextDecoder().decode(v));
      return typeof v === "string" ? v : new TextDecoder().decode(v);
    },
    async put(k, v) { KV.writes.push(k); store.set(k, v); }, async delete(k) { store.delete(k); },
    async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter((k) => k.startsWith(p)).map((name) => ({ name })), list_complete: true }; },
  };
  const J = (k, o) => store.set("img_" + k, JSON.stringify(o));
  J("rent_index", RENT_INDEX); J("anchors_" + D, ANCHORS); J("brief_fp_" + D, LAYER); J("units_" + D, UNITS);
  J("amenities_" + D, AMENITIES); J("districts_geo", DISTRICTS_GEO); J("brochure_" + D + "_9", BROCHURE);
  store.set("img_bph_akoyaone_ext", jpeg(1200, 800)); store.set("img_ct_bph_akoyaone_ext", "image/jpeg");
  return KV;
}
export const makeEnv = (KV, extra) => Object.assign({ MEETINGS: KV, READ_KEY: READ, CLIENT_KEY: CLIENT, INGEST_TOKEN: "ING", PUBLIC_ORIGIN: ORIGIN, BROWSER: { fetch() {} } }, extra || {});
