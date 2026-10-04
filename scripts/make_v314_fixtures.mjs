// v314 - cut the REAL-DATA fixtures test/test_v314_coverage.mjs reads (nothing invented): records from a live read of img_rent_index, and cards/items from the
// register-built output of scripts/build_coverage_cards.py. Local files only.
//   node scripts/make_v314_fixtures.mjs <live rent index json> <cov_cards dir> <unit-mix mirror dir for Liwan's real priced cards>
import fs from "node:fs";
import path from "node:path";

const [RENT, CARDS, UM] = process.argv.slice(2);
if (!RENT || !CARDS) { console.error("usage: node scripts/make_v314_fixtures.mjs <rent index> <cov_cards dir> [unitmix dir]"); process.exit(2); }
const OUT = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "test", "fixtures");
fs.mkdirSync(OUT, { recursive: true });
const ri = JSON.parse(fs.readFileSync(RENT, "utf8"));
const AREAS = ["Al Warsan First", "Warsan Fourth", "Mirdif", "Jumeirah First", "Trade Center First", "Al Thanayah Fourth", "Al Satwa", "Wadi Al Safa 7"];
const items = ri.items.filter((it) => AREAS.includes(it.area));
const areas = ri.areas.filter((a) => AREAS.includes(a.area));
// one app district with a district slug, to prove nothing about a district search changes: JVC's first 12 records
const jvc = ri.items.filter((it) => it.d === "jumeirahvillagecircle").slice(0, 12);
const jvcAreas = ri.areas.filter((a) => a.d === "jumeirahvillagecircle");
fs.writeFileSync(path.join(OUT, "v314_rent.json"), JSON.stringify({ as_of: ri.as_of, window: ri.window, source_file: ri.source_file, bands: ri.bands, items: items.concat(jvc), areas: areas.concat(jvcAreas) }));
// buy fixtures: two register-built cards each of a villa area, an off-plan area and Arabian Ranches 2; the items for them; one real priced Liwan card
const pick = (slug, n) => { const f = path.join(CARDS, `unitmix_${slug}.synthetic.json`); const j = JSON.parse(fs.readFileSync(f, "utf8")); const ids = Object.keys(j.buildings_by_id).slice(0, n); return Object.fromEntries(ids.map((i) => [i, j.buildings_by_id[i]])); };
const bx = JSON.parse(fs.readFileSync(path.join(CARDS, "buy_extra.json"), "utf8"));
const cards = { alyelayiss1: pick("alyelayiss1", 3), palmdeira: pick("palmdeira", 3), wadialsafa7: pick("wadialsafa7", 4), wadialsafa6: {} };
const itemsOf = (slug) => bx.items.filter((x) => x.d === slug && cards[slug][String(x.i)]);
const out = { cards, items: [].concat(itemsOf("alyelayiss1"), itemsOf("palmdeira"), itemsOf("wadialsafa7")) };
if (UM) {
  const um = JSON.parse(fs.readFileSync(path.join(UM, "unitmix_liwan1.json"), "utf8")).buildings_by_id;
  out.liwan = { id: "579", card: um["579"], item: JSON.parse(fs.readFileSync(path.join(CARDS, "map_prices_add.json"), "utf8")).items.find((x) => x.i === 579) };
}
fs.writeFileSync(path.join(OUT, "v314_buy.json"), JSON.stringify(out));
console.log("rent fixture:", items.length + jvc.length, "items,", areas.length + jvcAreas.length, "area rows | buy fixture:", out.items.length, "items,", Object.values(cards).reduce((a, c) => a + Object.keys(c).length, 0), "cards");
