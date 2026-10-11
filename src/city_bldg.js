// v519 CITY BUILDINGS - one small index for the all-Dubai twin: every named project on the map (img_plots) and every building
// Property Finder advertises now (img_pf_supply_<district>, the v444 "advertised" block), merged on the register key
// "<district>:<footprint index>". Kendall 11 Oct 2026 picked #2 (search a building by name) and #6 (an advertised-now filter on the twin).
//
// Positions: the building's own footprint (img_brief_fp_<district>, footprintRing) where the layer is published, else the plot point,
// else the median of its adverts' own pins. Names: the plot's name, else the Land Department project name the advert rows carry.
// Built at most every six hours (KV city_bldg_idx) because it reads 33 advert files and their footprint layers; a phone downloads
// one file of a few hundred KB instead of 33 MB.
import { kvJson } from "./brief.js";
import { advertisedDoc, advertisedForKey, advertisedHtml, ADV_CSS } from "./advertised.js";
import { footprintRing } from "./broker_building.js";

export const CITY_BLDG_KEY = "city_bldg_idx";
const TTL_S = 6 * 3600;
const BANDS = ["studio", "1", "2", "3+"];
const r6 = (x) => Math.round(x * 1e6) / 1e6;
const title = (s) => String(s || "").toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\s+/g, " ").trim();
const median = (a) => { const s = a.filter((x) => typeof x === "number" && isFinite(x)).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };

async function read(env, name) { try { return await kvJson(env, name); } catch (e) { return null; } }

// one district's advertised buildings -> [{k, n, d, lat, lon, f, b, a}]
export function advertisedItems(doc, layer, slug) {
  const A = advertisedDoc(doc);
  if (!A) return [];
  const names = {};
  for (const r of (doc && Array.isArray(doc.rows) ? doc.rows : [])) if (r && r.key && r.dld_project && !names[r.key]) names[r.key] = title(r.dld_project);
  const byKey = {};
  for (const s of Object.keys(A.buildings)) {
    const b = A.buildings[s]; if (!b.key) continue;
    const o = byKey[b.key] || (byKey[b.key] = { k: b.key, d: slug, b: {}, f: 0, a: 0, slugs: [] });
    o.slugs.push(s);
    for (const k of Object.keys(b.bands)) { const x = b.bands[k]; o.b[k] = (o.b[k] || 0) + (x.flats || 0); o.f += x.flats || 0; o.a += x.adverts || 0; }
  }
  const out = [];
  for (const o of Object.values(byKey)) {
    if (!o.f && !o.a) continue;
    const bk = Number(String(o.k).split(":")[1]);
    let ll = null;
    if (layer && isFinite(bk)) { const fr = footprintRing(layer, bk); if (fr && fr.ll) ll = fr.ll; }
    if (!ll) {   // the adverts' own pins, median per axis (a stray pin cannot move a median)
      const pins = [].concat(...o.slugs.map((s) => Object.values(((doc.adverts || {})[s]) || {}).flat()));
      const la = median(pins.map((p) => p && p.lat)), lo = median(pins.map((p) => p && p.lon));
      if (la != null && lo != null) ll = [la, lo];
    }
    if (!ll) continue;
    const b = {}; for (const k of BANDS) if (o.b[k]) b[k] = o.b[k];
    out.push({ k: o.k, n: names[o.k] || title(o.slugs[0].replace(/-/g, " ")), d: slug, lat: r6(ll[0]), lon: r6(ll[1]), f: o.f, a: o.a, b });
  }
  return out;
}

// the named projects of the map (img_plots features) -> [{k, n, d, lat, lon}]
export function plotItems(plots) {
  const out = [];
  for (const f of ((plots && plots.features) || [])) {
    const p = f && f.properties, c = f && f.geometry && f.geometry.coordinates;
    if (!p || !p.name || !p.district || !Array.isArray(c)) continue;
    out.push({ k: p.i != null ? p.district + ":" + p.i : null, n: title(p.name), d: p.district, lat: r6(c[1]), lon: r6(c[0]) });
  }
  return out;
}

// merge: an advertised building takes the plot's name and position when the plot has the same register key
export function mergeIndex(plotList, advLists) {
  const byKey = {};
  const items = [];
  for (const p of plotList) { const it = Object.assign({}, p); items.push(it); if (it.k) byKey[it.k] = it; }
  for (const list of advLists) for (const a of list) {
    const p = byKey[a.k];
    if (p) { p.f = a.f; p.a = a.a; p.b = a.b; }
    else { items.push(a); byKey[a.k] = a; }
  }
  return items;
}

// v520 - the register's word on each building, for the twin's pop-up card: status, % built, due / completed date, floors
export function stackFacts(items, stacks) {
  for (const it of items) {
    if (!it.k) continue;
    const [d, bk] = String(it.k).split(":"); const st = stacks[d];
    const b = st && st.buildings_by_id ? st.buildings_by_id[bk] : null;
    if (!b) continue;
    const p = b.project || {};
    if (p.status) it.s = String(p.status).toUpperCase();
    if (typeof p.pct === "number") it.p = Math.round(p.pct);
    if (p.end) it.e = String(p.end).slice(0, 7);
    if (Array.isArray(b.floors) && b.floors.length) it.fl = b.floors.length;
  }
  return items;
}

export async function buildCityIndex(env, districts) {
  const plots = await read(env, "plots");
  const adv = [];
  let asOf = "";
  for (const d of districts) {
    const doc = await read(env, "pf_supply_" + d);
    if (!doc || !doc.advertised) continue;
    const layer = await read(env, "brief_fp_" + d);
    adv.push(advertisedItems(doc, layer, d));
    if (doc.as_of && doc.as_of > asOf) asOf = doc.as_of;
  }
  const items = mergeIndex(plotItems(plots), adv);
  const ds = [...new Set(items.map((x) => x.d).filter((s) => /^[a-z0-9]+$/.test(String(s || ""))))];
  const stacks = {};
  for (const d of ds) { const st = await read(env, "stack_" + d); if (st) stacks[d] = { buildings_by_id: st.buildings_by_id || {} }; stackFacts(items.filter((x) => x.d === d), stacks); delete stacks[d]; }   // one district at a time: a stack is ~1 MB
  return { v: 1, built: new Date().toISOString(), as_of: asOf, advertised: items.filter((x) => x.f).length, items };
}

// v521 GET /adv_bldg?k=<district>:<id>&key= - ONE building's Property Finder listings card, for the Developers map's project card (Kendall 11 Oct
// 2026: "Available on Property Finder" at the top, as a pop-up). Read-only for every key; listings, never vacancy; rent only so far.
export async function advBldgRoute(env, url, deps) {
  const J = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { "Content-Type": "application/json", "Cache-Control": "private, max-age=600" } });
  if ((deps.method || "GET") !== "GET") return new Response("unauthorised", { status: 401 });
  if (!deps.tier(env, url)) return new Response("unauthorised", { status: 401 });
  const k = String(url.searchParams.get("k") || "");
  if (!/^[a-z0-9]+:\d+$/.test(k)) return J({ ok: false, reason: "k=<district>:<id> is required" }, 400);
  const doc = await read(env, "pf_supply_" + k.split(":")[0]);
  const A = advertisedDoc(doc), a = A ? advertisedForKey(A, k) : null;
  return J({ ok: true, k, as_of: (A && A.asOf) || (doc && doc.as_of) || "", covered: !!A, flats: a ? a.flats || 0 : 0, adverts: a ? a.adverts || 0 : 0,
    html: a ? "<style>" + ADV_CSS + "</style>" + advertisedHtml(a).replace("<details class=avd>", "<details class=avd open>") : "" });
}

// GET /city_bldg?key=  (READ_KEY or a client key; Property Finder figures are allowed on client surfaces since 11 Oct 2026).
// GET only. A client key READS the cached index and never writes (test_v156: a client key never writes); without a cache it gets the
// index built in memory. Only the owner key saves the cache, and only it may ask for a rebuild (fresh=1).
export async function cityBldgRoute(env, url, deps) {
  if ((deps.method || "GET") !== "GET") return new Response("unauthorised", { status: 401 });
  const tier = deps.tier ? deps.tier(env, url) : (deps.clientOk(env, url) ? "client" : "");
  if (!tier) return new Response("unauthorised", { status: 401 });
  const owner = tier === "admin";
  let body = null;
  if (!(owner && url.searchParams.get("fresh") === "1")) { try { body = await env.MEETINGS.get(CITY_BLDG_KEY); } catch (e) {} }
  if (!body) {
    let ds = [];
    try {
      const l = await env.MEETINGS.list({ prefix: "img_pf_supply_" });
      ds = (l.keys || []).map((x) => x.name.slice("img_pf_supply_".length)).filter((s) => /^[a-z0-9]+$/.test(s));
    } catch (e) {}
    body = JSON.stringify(await buildCityIndex(env, ds));
    if (owner) { try { await env.MEETINGS.put(CITY_BLDG_KEY, body, { expirationTtl: TTL_S }); } catch (e) {} }
  }
  return new Response(body, { headers: { "Content-Type": "application/json", "Cache-Control": "private, max-age=600" } });
}
