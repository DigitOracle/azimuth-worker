// v763: passport search from the one-name list (pp_g_* / pp_ge_*), real built shards from naj-market-pulse/data/search_gaz
import fs from "fs";
import { ppSearch, ppEntity } from "../src/plot_passport.js";
import { bppBody } from "../src/building_passports.js";
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } else console.log("ok", m); };
const KV = new Map();
const dir = "C:/Dev/naj-market-pulse/data/search_gaz/";
if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) if (/^bulk_\d+\.json$/.test(f)) for (const it of JSON.parse(fs.readFileSync(dir + f, "utf8"))) KV.set(it.key, it.value);
const meta = fs.existsSync(dir + "meta.json") ? JSON.parse(fs.readFileSync(dir + "meta.json", "utf8")) : null;
const env = { MEETINGS: { get: async (k) => k === "pp_meta" ? JSON.stringify(meta) : (KV.get(k) ?? null) } };
if (meta) {
  const names = (r) => r.groups.map((g) => g.name.toLowerCase()).concat(r.results.map((x) => x.label.toLowerCase()));
  const cases = [["damac lagoons", "damac lagoons"], ["sobha hartland", "sobha hartland"], ["jumeirah park", "jumeirah park"], ["orchid", "orchid"],
    ["loreto", "loreto"], ["arabian ranches", "arabian ranches"], ["15 northside", "15 northside"], ["al furjan", "al furjan"]];
  for (const [q, want] of cases) {
    const r = await ppSearch(env, q);
    ok(r.gaz && names(r).some((x) => x.includes(want)), q + " -> " + names(r).slice(0, 4).join(" | "));
  }
  const o = await ppSearch(env, "orchid"); const dh = o.groups.find((g) => /damac hills/i.test(g.path || ""));
  ok(!!dh, "orchid has a DAMAC Hills path: " + (dh && dh.path));
  const ar = await ppSearch(env, "arabian ranches"); const fam = ar.groups[0];
  const en = await ppEntity(env, fam.id);
  ok(en && en.c.length >= 3, "arabian ranches opens with children: " + (en && en.c.slice(0, 4).map((c) => c[2]).join(", ")));
  const dm = await ppSearch(env, "damock"); ok(dm.didYouMean.includes("damac"), "damock -> did you mean " + dm.didYouMean.join(","));
} else console.log("skip: no built shards");
const old = { MEETINGS: { get: async (k) => (k === "pp_meta" ? JSON.stringify({}) : null) } };
ok((await ppSearch(old, "orchid")).gaz === undefined, "without pp_meta.gaz the old search answers");
const h = bppBody("k", "", {}, [], "https://x", "kendall");
for (const m of h.matchAll(/<script>([\s\S]*?)<\/script>/g)) { try { new Function(m[1]); ok(true, "page script parses"); } catch (e) { ok(false, "page script: " + e.message); } }
ok(h.includes("function tent(g)"), "community tap lists children");
process.exit(fail ? 1 : 0);
