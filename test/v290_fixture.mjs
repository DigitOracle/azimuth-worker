// v290 AMENITY CARDS - the fixture shared by test/test_v290_amenity_cards.mjs and the local render (phone screenshot + PDF page).
// Spots follow the schema agreed on 2 Oct 2026 (naj-market-pulse scripts/build_amenity_spots.py -> data/amenities/spots_<district>.json).
// Every name and id here is invented for the test; nothing is a real Google photo name.
import zlib from "node:zlib";

export const READ = "read_key_for_the_owner_1234567890", CLIENT = "client_key_in_links_12345";
export const GKEY = "GMAPS_SECRET_v290_never_in_html_9f3a";
export const ORIGIN = "https://azimuth-2.digitalchemy.workers.dev";

const pp = (id, authors) => ({ route: "places_photo", place_id: "ChIJ" + id, photo_name: "places/ChIJ" + id + "/photos/AaTEST" + id, photo_authors: authors });
export const SPOTS_DAMAC = {
  district: "damachills", district_name: "DAMAC Hills", built: "2026-10-02T05:12:51",
  sources: ["© OpenStreetMap contributors (ODbL)", "Najma district layers"],
  spots: [
    { id: "osm:way/1", type: "dog_park", name: "Central Bark", lat: 25.0124, lng: 55.2555, community: "Orchid", source: "developer", source_url: "https://www.damacproperties.com/en/d-hub/dog-park", picture: pp("dog1", ["Test Author One"]) },
    { id: "osm:way/2", type: "dog_park", name: "Dog park in Golf Promenade", name_is_generic: true, lat: 25.02, lng: 55.25, community: "Golf Promenade", source: "OpenStreetMap", source_url: "https://www.openstreetmap.org/way/2", picture: { route: "satellite" } },
    { id: "osm:way/3", type: "dog_park", name: "Bark Park Portal", lat: 25.021, lng: 55.251, community: null, source: "Bayut", source_url: "https://www.bayut.com/area-guides/damac-hills/dog-park", picture: pp("portal", ["Someone"]) },
    { id: "dm:park:a", type: "park", name: "Trump Park", lat: 25.018, lng: 55.253, community: null, source: "Dubai Municipality", source_url: "", picture: { route: "street_view", pano_id: "PANO_A", heading: 120, distance_m: 30, pano_date: "2023-04" } },
    { id: "dm:park:b", type: "park", name: "Paradise Lake Park", lat: 25.019, lng: 55.254, community: null, source: "Dubai Municipality", source_url: "", picture: { route: "satellite" } },
    { id: "dm:park:c", type: "park", name: "Park in Silver Springs", name_is_generic: true, lat: 25.025, lng: 55.256, community: "Silver Springs", source: "OpenStreetMap", source_url: "https://www.openstreetmap.org/way/9", picture: { route: "none" } },
    { id: "osm:way/10", type: "community_pool", name: "Malibu Bay", lat: 25.022, lng: 55.26, community: "Longview", source: "OpenStreetMap", source_url: "https://www.openstreetmap.org/way/10", picture: pp("pool1", ["Pool Author"]) },
    { id: "osm:way/11", type: "community_pool", name: "Carson Pool", lat: 25.023, lng: 55.261, community: "Carson", source: "OpenStreetMap", source_url: "https://www.openstreetmap.org/way/11", picture: pp("pool2", []) },   // no author: never shown as a Places photo
    { id: "place:g1", type: "gym", name: "Golf Clubhouse Gym", lat: 25.02, lng: 55.25, community: null, source: "Google Places", source_url: "https://www.google.com/maps/place/?q=place_id:g1", picture: pp("gym1", ["Gym Author"]) },
    { id: "place:g2", type: "gym", name: "Fitness First Akoya", lat: 25.021, lng: 55.252, community: null, source: "Google Places", source_url: "https://www.google.com/maps/place/?q=place_id:g2", picture: { route: "satellite" } },
    { id: "place:g3", type: "gym", name: "Portal Gym", lat: 25.022, lng: 55.253, community: null, source: "Google Places", source_url: "https://www.propertyfinder.ae/en/community-guides/gym", picture: pp("g3", ["X"]) },
    { id: "khda:1", type: "school", name: "Jebel Ali School", lat: 25.03, lng: 55.25, community: null, source: "KHDA", source_url: "", picture: { route: "satellite" } },
    { id: "rta:bus/1", type: "bus", name: "DAMAC Hills, Gate 1", lat: 25.01, lng: 55.25, community: null, source: "RTA", source_url: "", picture: { route: "satellite" } },
    { id: "rta:bus/2", type: "bus", name: "Akoya Oxygen", lat: 25.011, lng: 55.251, community: null, source: "RTA", source_url: "", picture: { route: "satellite" } },
    { id: "x:1", type: "spaceport", name: "Not a type", lat: 25, lng: 55, source: "OpenStreetMap", picture: { route: "satellite" } },
  ],
};
export const SPOTS_JVC = {
  district: "jumeirahvillagecircle", built: "2026-10-02T05:30:00", sources: [],
  spots: [
    { id: "osm:node/5", type: "metro", name: "Dubai Internet City Metro Station", lat: 25.10, lng: 55.17, source: "RTA", source_url: "", picture: { route: "satellite" } },
    { id: "osm:way/6", type: "dog_park", name: "JVC Dog Park", lat: 25.06, lng: 55.21, source: "OpenStreetMap", source_url: "https://www.openstreetmap.org/way/6", picture: { route: "satellite" } },
  ],
};
// counts_<district>.json as naj-market-pulse scripts/amenity_counts.py writes it (commit 13a374f): the Google request definition, never
// the counts. google_counts.gym carries a PLANTED number: a stored count must never be shown (Google's terms; the card asks live).
const RING = [[25.0, 55.24], [25.0, 55.27], [25.04, 55.27], [25.04, 55.24], [25.0, 55.24]].map(([a, b]) => ({ latitude: a, longitude: b }));
export const COUNTS_DAMAC = {
  district: "damachills", name: "DAMAC Hills", built: "2026-10-02T05:28:37",
  area: { centroid: { lat: 25.022449, lng: 55.254547, method: "polygon centroid" } },
  google_counts: { gym: 999, park: null, dog_park: null, swimming_pool: null, school: null, subway_station: null }, google_counts_stored: false,
  google_requests: { endpoint: "POST https://areainsights.googleapis.com/v1:computeInsights", per_type: "one request per type; replace includedTypes with the type",
    body: { insights: ["INSIGHT_COUNT"], filter: { locationFilter: { customArea: { polygon: { coordinates: RING } } }, typeFilter: { includedTypes: ["<type>"] }, operatingStatus: ["OPERATING_STATUS_OPERATIONAL"] } } },
  schools: [{ name: "Jebel Ali School", lat: 25.0098, lng: 55.2549, position_source: "OpenStreetMap" }, { name: "Second Test Academy", lat: 25.03, lng: 55.26, position_source: "OpenStreetMap" }],
  stations: [],
  nearest_station: { name: "Jumeirah Golf Estates Metro Station", line: "Red Metro line", mode: "metro", source: "RTA metro stations register", distance_from_centroid_m: 9203 },
};
// what the stubbed Google answers, per Places Aggregate type (swimming_pool: Google leaves "count" out when it is zero)
export const LIVE_COUNTS = { gym: "7", dog_park: "3", park: "11", school: "24", subway_station: "0" };
export const LIVE_SCHOOLS = ["Jebel Ali School", "Victory Heights Primary School", "Ranches Primary School"];

const st = (n, m, q1, q3, s, last) => ({ n, nn: n, nr: 0, m, q1, q3, s, last });
// a small rent index so the Compare and Full-pack documents build
export const RENT_INDEX = { as_of: "2026-09-30", source_file: "rents-test.csv", items: [
  { p: "akoyaone", n: "Akoya One", d: "damachills", i: 10, lon: 55.252, lat: 25.02, area: "Al Hebiah Third", last: "2026-09-30", b: { "1": st(16, 65000, 60000, 70500, 59.1, "2026-09-30") } },
  { p: "carsontower", n: "Carson Tower", d: "damachills", i: 11, lon: 55.261, lat: 25.023, area: "Al Hebiah Third", last: "2026-09-20", b: { "1": st(9, 64000, 62000, 66000, 60, "2026-09-20") } },
] };
export const DISTRICTS_GEO = { districts: [{ slug: "damachills", name: "DAMAC Hills" }, { slug: "jumeirahvillagecircle", name: "Jumeirah Village Circle" }] };

// KV as the worker sees it: get(k, "arrayBuffer") or text
export function makeKV() {
  const store = new Map();
  const KV = {
    store,
    async get(k, t) {
      if (!store.has(k)) return null;
      const v = store.get(k);
      if (t === "arrayBuffer") return typeof v === "string" ? new TextEncoder().encode(v).buffer : v;
      return typeof v === "string" ? v : new TextDecoder().decode(v);
    },
    async put(k, v) { KV.writes.push(k); store.set(k, v); }, async delete(k) { store.delete(k); },
    async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter((k) => k.startsWith(p)).map((name) => ({ name })), list_complete: true }; },
    writes: [],
  };
  const J = (k, o) => store.set("img_" + k, JSON.stringify(o));
  const GZ = (k, o) => { const b = zlib.gzipSync(Buffer.from(JSON.stringify(o))); store.set("img_" + k, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
  J("amenity_spots_damachills", SPOTS_DAMAC);
  GZ("amenity_spots_jumeirahvillagecircle", SPOTS_JVC);     // gzipped, as the larger files will be
  J("amenity_counts_damachills", COUNTS_DAMAC);
  J("rent_index", RENT_INDEX);
  J("districts_geo", DISTRICTS_GEO);
  J("amenities", { items: [] });
  return { KV, J, GZ };
}

// a tiny but well-formed JPEG header (SOI, SOF0 of 16 x 9, EOI) - enough for jpegSize() and for a data: URL
export const TINY_JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x09, 0x00, 0x10, 0x03, 0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01, 0xff, 0xd9]);
