// DEVELOPER CROSSWALK tests (4 Oct 2026). Includes NEGATIVE CONTROLS: names that look like a brand but must not merge,
// and a deliberately broken rule that the same assertions must catch.
import assert from "node:assert/strict";
import { canonicalOf, aliasesOf, displayOf, norm, resolve, DEVCROSS_PARITY } from "../src/devcross.js";
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.equal(a, b, m + " -> got " + a); n++; };

// 1. Python/JS parity: every vector the builder wrote must resolve identically here
for (const [name, id] of Object.entries(DEVCROSS_PARITY)) eq(canonicalOf(name), id, "parity " + JSON.stringify(name));

// 2. Kendall's ten + the extra nine: every spelling collapses to ONE id
const must = {
  nakheel: ["NAKHEEL .(P J S C)", "شركة نخيل (ش.م.خ)", "NAKHEEL INVESTMENT PROJECTS (L.L.C)", "Nakheel Greenwood Life Real Estate LLC", "THE PALM - JEBEL ALI CO. (L.L.C)", "شركة النخلة - جميرا (ش.ذ.م.م)", "Nakheel"],
  damac: ["DAMAC CANAL ONE PROPERTY DEVELOPMENT L.L.C", "DAMAC PROPERTIES CO (L.L.C)", "داماك كريسنت للعقارات (ش.ذ.م.م)", "DAMAC GULF PROPERTIES", "Damac Crown Properties Company", "DAMAC"],
  zaya: ["S K A I ZAYA REAL ESTATE DEVELOPMENT L.L.C", "Zaya", "ZAYA/Palma", "ZAYA HATTA REAL ESTATE DEVELOPMENT L.L.C", "اس كيه ايه اي زايا لتطوير العقارات ش.ذ.م.م"],
  mered: ["MERED RESIDENCES REAL ESTATE L.L.C", "ميريد ريزيدنسز للعقارات ش.ذ.م.م", "Mered"],
  meraas: ["MERAAS ESTATES (L.L.C)", "مراس العقارية (ش.ذ.م.م)", "MERAAS BAY AND RESIDENCE L.L.C", "Meraas"],
  emaar: ["EMAAR PROPERTIES (P.J.S.C)", "إعمار للتطوير (مساهمة عامة)", "EMAAR DUBAI SOUTH DWC LLC", "Emaar"],
  omniyat: ["OMNIYAT PROPERTIES SEVENTEEN LIMITED", "امنيات ميدل إيست للتطوير العقاري ش.ذ.م.م", "OMNIYAT"],
  imtiaz: ["IMTIAZ REAL ESTATE INVESTMENT & DEVELOPMENT L.L.C", "IMTIAZ GI REAL ESTATE DEVELOPMENT L.L.C", "Imtiaz", "امتياز سنست للتطوير العقاري ش.ذ.م.م"],
  ellington: ["ELLINGTON PROPERTIES DEVELOPMENT L.L.C", "ellington", "إلينجتون كارما للتطوير ذ.م.م", "Ellington"],
  "select-group": ["SELECT GLOBAL DEVELOPMENT L.L.C", "Select Group", "select", "Select"],
  sobha: ["SOBHA L.L.C", "شوبا ش.ذ.م.م", "SOBHA PROPERTIES LIMITED", "Sobha"],
  binghatti: ["Binghatti Developers FZE", "بن غاطي للتطوير العقاري م م ح", "Binghatti"],
  arada: ["ARADA DEVELOPMENTS L.L.C S.O.C", "Arada", "اراد للتطوير ذ.م.م ش.ش.و"],
  danube: ["DANUBE PROPERTIES DEVELOPMENT L.L.C", "Danube"],
  azizi: ["AZIZI DEVELOPMENTS L.L.C", "BURJ AZIZI DEVELOPMENT L.L.C", "Azizi"],
  "dubai-properties": ["DUBAI PROPERTIES(L.L.C)", "دبي للعقارات (ش.ذ.م.م)", "Dubai Properties"],
  deyaar: ["DEYAAR DEVELOPMENT (P.J.S.C)", "ديار للتطوير (ش.م.ع)"],
  "union-properties": ["UNION PROPERTIES (P.J.S.C)", "الاتحاد العقارية (شركة مساهمة عامة)"],
  aldar: ["ALDAR PROPERTIES P J S C - DUBAI BRANCH", "الدار العقارية ش م ع - فرع دبي"],
};
for (const [id, names] of Object.entries(must)) for (const nm of names) eq(canonicalOf(nm), id, id + " <- " + nm);

// 3. NEGATIVE CONTROLS: look-alikes that are different developers and must NOT collapse into a brand
const not = [["AL MAZAYA REAL ESTATE FZ-LLC", "zaya"], ["WELLINGTON OCEAN REAL ESTATE DEVELOPMENT L.L.C", "ellington"], ["SPAIN SELECT LIMITED", "select-group"],
  ["TORCH SELECT LIMITED", "select-group"], ["MEYDAN GROUP (L.L.C)", "mered"], ["PALMRIDGE REAL ESTATE DEVELOPMENT L.L.C", "mered"], ["MERIDIEN BEACH", "mered"],
  ["NEW DUBAI PROPERTIES (L.L.C)", "dubai-properties"], ["CENTRAL ONE DUBAI PROPERTIES L.L.C", "dubai-properties"], ["AL DAR REAL ESTATE L.L.C", "aldar"],
  ["AL ETIHAD REAL ESTATE DEVELOPMENT L.L.C", "union-properties"], ["DUBAI HILLS ESTATE L.L.C", "emaar"], ["DUBAI HILLS ESTATE L.L.C", "meraas"], ["MEYDAN GROUP (L.L.C)", "azizi"]];
for (const [nm, id] of not) ok(canonicalOf(nm) !== id, "must not be " + id + ": " + nm);
eq(canonicalOf("MEYDAN GROUP (L.L.C)"), "meydan", "Meydan is its own developer, never Mered");
eq(canonicalOf("MERAAS ESTATES (L.L.C)") === "meraas" && canonicalOf("Dubai Holding") !== "meraas" ? "ok" : "bad", "ok", "Meraas stays separate from Dubai Holding");

// 4. project-name route is explicit and lower confidence
const r = resolve("Hado By Beyond", "project"); eq(r.id, "beyond", "project token"); ok(r.confidence < 1, "project token < 1.0");
ok(resolve("Hado By Beyond").how === "singleton", "a project name is not a company name unless asked");
eq(resolve("THE MERIVA COLLECTION", "project").id !== "mered" ? "ok" : "bad", "ok", "Meriva is not Mered");

// 5. spaced letters, legal suffixes, empties
eq(norm("S K A I ZAYA REAL ESTATE L.L.C"), "skai zaya real estate", "norm joins spaced letters, drops legal"); eq(canonicalOf(""), "", "empty"); eq(canonicalOf(null), "", "null");
ok(canonicalOf("Totally New Developer LLC") === "totally-new-developer", "unknown -> deterministic slug, not an error");
ok(aliasesOf("nakheel").length >= 5, "aliases of nakheel"); ok(aliasesOf("nope").length === 0, "aliases of unknown");
eq(displayOf("damac"), "DAMAC", "display"); eq(displayOf("x"), null, "display of unknown");

// 6. the gate itself must be able to fail: break one rule and show the same assertion trips
const broken = (nm) => (norm(nm).startsWith("damac") ? "x" : canonicalOf(nm));
assert.throws(() => assert.equal(broken("DAMAC PROPERTIES CO (L.L.C)"), "damac"), "negative control: a broken rule is caught"); n++;
// 7. tier floors as TOTAL PURCHASE PRICES (Kendall, 4 Oct): 3,000 / 2,100 / 1,550 per sq ft on 401 / 779 / 1,248 / 1,848 sq ft
import { DM } from "../scripts/build_devmap_index.mjs";
eq(DM.TIER_CFG.bounds.join(), "32292,22604,16684", "default value-weighted bounds");
eq(DM.tierPrices(0, DM.TIER_CFG.bounds), "Studio from AED 1.20m · 1-bed from AED 2.34m · 2-bed from AED 3.74m · 3-bed from AED 5.54m", "ultra-luxury floors");
ok(/^Studio from AED 842k/.test(DM.tierPrices(1, DM.TIER_CFG.bounds)) && /^Studio from AED 622k/.test(DM.tierPrices(2, DM.TIER_CFG.bounds)) && /^Studio under AED 622k/.test(DM.tierPrices(3, DM.TIER_CFG.bounds)), "luxury / premium / budget floors");
eq(DM.tierShare(0, { cuts: { shares: { n: [9, 20, 35, 36], money: [26, 25, 26, 24] } } }), "Dubai-wide: 9% of buyers, 26% of the money", "share text");
eq(DM.tierShare(0, {}), "", "no shares, no claim");
console.log("test_devcross OK -", n, "assertions");
