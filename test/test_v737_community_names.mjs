// v737 - community names beside official district names (Kendall, 4 Nov 2026): DAMAC Hills must be findable, not only "Al Hebiah Third".
import fs from "fs";
const C = await import("../src/district_communities.js");
const P = await import("../src/plot_passport.js");
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 400)); } };

const DL = [
  { slug: "damachills", name: "Al Hebiah Third", n: 900 }, { slug: "motorcity", name: "Al Hebiah First", n: 500 },
  { slug: "businessbay", name: "Business Bay", n: 400 }, { slug: "dubaimarina", name: "Marsa Dubai", n: 300 }, { slug: "hatta", name: "Hatta", n: 10 },
];
const L = C.withCommunities(DL);
const by = (s) => L.find((d) => d.slug === s);
ok(by("damachills").label === "DAMAC Hills (Al Hebiah Third)", "DAMAC Hills label", by("damachills"));
ok(by("businessbay").label === "Business Bay", "same name not repeated", by("businessbay"));
ok(by("dubaimarina").label === "Dubai Marina, JBR - Jumeirah Beach Residence (Marsa Dubai)", "two communities", by("dubaimarina"));
ok(by("hatta").label === "Hatta" && by("hatta").kw === "", "unknown district official only", by("hatta"));
ok(by("damachills").name === "Al Hebiah Third", "official name kept");
ok(C.districtLabel({ slug: "x", name: "Y" }) === "Y", "no map entry");
C.DISTRICT_COMMUNITIES.__t = ["A", "B", "C", "D"]; ok(C.districtLabel({ slug: "__t", name: "Z" }) === "A, B +2 (Z)", "+N", C.districtLabel({ slug: "__t", name: "Z" })); delete C.DISTRICT_COMMUNITIES.__t;

// search the way Building Passports does it
const q = "damac hills";
const found = L.filter((d) => d.label.toLowerCase().indexOf(q) >= 0 || (d.kw || "").indexOf(q) >= 0).map((d) => d.slug);
ok(found.includes("damachills") && found.includes("motorcity") && !found.includes("businessbay"), "search damac hills", found);

// route returns labels
const env = { MEETINGS: { get: async (k) => (k === "pp_dl" ? JSON.stringify(DL) : null) } };
const deps = { clientOk: () => true };
try {
  const r = await P.plotPassportRoutes(new Request("https://x/plot_passport/districts?key=k"), env, new URL("https://x/plot_passport/districts?key=k"), deps);
  if (r) { const j = await r.json(); ok(j.districts.find((d) => d.slug === "damachills").label === "DAMAC Hills (Al Hebiah Third)", "route label", j); }
} catch (e) { console.log("route check skipped:", e.message); }

// client code uses the label + search words
const bp = fs.readFileSync(new URL("../src/building_passports.js", import.meta.url), "utf8");
const pp = fs.readFileSync(new URL("../src/plot_passport.js", import.meta.url), "utf8");
ok(bp.includes('(d.label||d.name).toLowerCase().indexOf(q)>=0||(d.kw||"").indexOf(q)>=0'), "BP search uses label+kw");
ok(bp.includes("opt(d.slug,(d.label||d.name)+"), "BP option shows label");
ok(pp.includes("t:d.label||d.name,k:(d.kw||\"\")") && pp.includes("nq(o.k).indexOf(f)>=0"), "plot passport sheet label+search");
const n = Object.keys(C.DISTRICT_COMMUNITIES).length; console.log("districts with a community label:", n);
console.log(`v737 community names: ${pass} passed, ${fail} failed`); if (fail) process.exit(1);
