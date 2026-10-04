// v307: community labels (src/community_labels.js), the buy PDF's source line, 2-page buy dossier, schools only with a rating.
//   node test/test_v307_labels.mjs
import fs from "node:fs";
import { COMMUNITY_LABELS, foldArea, communitySlugOfArea, communitiesOf, labelledName } from "../src/community_labels.js";
import { buildDocument, parseQuery } from "../src/brief_docs.js";
import { buildIndex } from "../scripts/build_devmap_index.mjs";
import { __resetKvMemo } from "../src/brief.js";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 300) : "")); } };

// labels
ok(labelledName("alhebiahfifth", "Al Hebiah 5") === "DAMAC Lagoons (Al Hebiah Fifth)", "Al Hebiah Fifth -> DAMAC Lagoons");
ok(labelledName("alyelayiss1", "x") === "DAMAC Islands (Al Yelayiss 1)", "Al Yelayiss 1 -> DAMAC Islands");
ok(labelledName("madinathind4", "x") === "DAMAC Hills 2 (Madinat Hind 4)", "Madinat Hind 4 -> DAMAC Hills 2");
ok(labelledName("alyufrah1", "x") === "The Valley (Al Yufrah 1)" && !/sobha/i.test(JSON.stringify(COMMUNITY_LABELS.alyufrah1)), "Al Yufrah 1 -> The Valley only (Sobha Sanctuary is not in the research)");
ok(labelledName("madinatalmataar", "x") === "Dubai South / Emaar South / Expo Living (Madinat Al Mataar)", "several communities are listed whole");
ok(communitiesOf("zaabeelsecond")[0] === "d3" && communitiesOf("wadialsafa5")[0] === "Arabian Ranches III", "d3 and Arabian Ranches III");
ok(labelledName("jltsouth", "Jumeirah Islands") === "Jumeirah Islands" && labelledName("burjkhalifa", "Downtown Dubai") === "Downtown Dubai", "unlabelled districts keep their name");
ok(communitySlugOfArea("AL HEBIAH FIFTH") === "alhebiahfifth" && communitySlugOfArea("Al Hebiah Fifth") === "alhebiahfifth" && communitySlugOfArea("MADINAT HIND 4") === "madinathind4", "upper-case DLD areas are case-folded before the join");
ok(foldArea("Al-Yelayiss  1") === "alyelayiss1", "foldArea");
ok(Object.values(COMMUNITY_LABELS).every((v) => v.dld && v.labels.length && v.why), "every entry has a DLD name, labels and a reason");

// devmap index carries the label
const U = { buildings_by_id: { 1: { name: "B1", developer: "DAMAC PROPERTIES", rows: [{ type: "1 bedroom", median_aed: 1000000, median_sqm: 70 }], dld_sales: { sold_by_type: { "1 bedroom": 5 } }, registered_homes: 10 } } };
const dir = fs.mkdtempSync(new URL("./", import.meta.url).pathname.replace(/^\//, "").replace(/%20/g, " ") + "_t");
fs.writeFileSync(dir + "/um_alhebiahfifth.raw", JSON.stringify(U));
fs.writeFileSync(dir + "/um_burjkhalifa.raw", JSON.stringify(U));
const idx = buildIndex({ umDir: dir, prices: { items: [] }, rent: { items: [] }, geo: { districts: [{ slug: "alhebiahfifth", name: "Al Hebiah 5", corridor: "x", bbox: [0, 0, 1, 1], centre: [0, 0] }, { slug: "burjkhalifa", name: "Downtown Dubai", corridor: "x", bbox: [0, 0, 1, 1], centre: [0, 0] }] } });
fs.rmSync(dir, { recursive: true, force: true });
ok(idx.areas.alhebiahfifth && idx.areas.alhebiahfifth.label === "DAMAC Lagoons (Al Hebiah Fifth)" && idx.areas.alhebiahfifth.community[0] === "DAMAC Lagoons", "index area carries label and community");
ok(idx.areas.burjkhalifa && idx.areas.burjkhalifa.label === undefined, "index: unlabelled area has no label");

// buy dossier
const FX = JSON.parse(fs.readFileSync(new URL("./fixtures/v306_real_kv.json", import.meta.url), "utf8"));
const store = new Map(); const J = (k, o) => store.set("img_" + k, JSON.stringify(o));
for (const [d, u] of Object.entries(FX.unitmix)) J("unitmix_" + d, u);
J("map_prices", { generated: "2026-10-04", items: FX.map_prices }); J("districts_geo", { districts: FX.districts });
J("amenities", { items: [{ k: "school", n: "Alpha School", x: "Not inspected due to COVID 19", lat: 25.0735, lon: 55.137 }, { k: "school", n: "Good School", x: "Good", lat: 25.0736, lon: 55.137 }] });
J("brochure_dubaimarina_10", { name: "VIDA Residences Dubai Marina", developer: "Emaar", source_url: "https://www.emaar.com/en/what-we-do/vida", retrieved: "2026-10-21", amenities: ["Pool"], photos: [] });
const env = { MEETINGS: { async get(k) { return store.has(k) ? store.get(k) : null; }, async list() { return { keys: [] }; } } };
__resetKvMemo();
const doc = await buildDocument(env, parseQuery(new URL("https://x/brief_pdf?mode=buy&kind=dossier&keys=dubaimarina:10&beds=2&min=1800000&max=2500000&num=1&of=3")), { origin: "" });
ok(doc.status === 200, "buy dossier builds", JSON.stringify(doc.body));
if (doc.status === 200) {
  const h = doc.html;
  ok(!/emaar\.com|https?:\/\/[^\s"<]*\.(com|ae)/i.test(h.replace(/<style[\s\S]*?<\/style>/g, "").replace(/href="[^"]*"|src="[^"]*"/g, "")), "no developer URL printed");
  ok(!/retrieved 21 October|2026-10-21/.test(h), "a future retrieved date is dropped");
  ok(!/Alpha School/.test(h), "a school with no rating is not listed");
  ok(doc.pages === 2, "buy dossier is 2 pages when there are no photos or layouts", doc.pages);
  ok(h.indexOf("What homes here sold for") > h.indexOf("Where it is"), "the sales table sits on the Where-it-is page");
  ok(!/APPENDIX/.test(h), "no appendix");
  ok(/PURCHASE/.test(h), "PURCHASE label kept");
}
console.log(pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
