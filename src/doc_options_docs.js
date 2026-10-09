// v407 - the options pages for the CLIENT sheet and the BROKER sheet: the same page as the Investor selector (src/doc_options_page.js), chosen before the PDF is made.
//   GET /doc_client?keys=<district:index>[&mode=rent|buy][&beds=all|studio|1|2|3]&key=...      -> a page; Generate opens /brief_pdf?kind=dossier&... (src/brief_docs.js)
//   GET /doc_broker?area=<slug>&developers=a,b[&kind=snapshot|detailed][&window=12m|all][&mode=buy|rent]&key=...   -> a page; Generate opens /developers_pdf?kind=snapshot|detailed&... (src/devmap_pdf.js)
// An option is offered only when its data exists for THIS project (or developer): otherwise it is a greyed card that says why (the same pattern as the disabled document buttons).
// The default choices reproduce today's one-click links; the only parameter every default adds is the "prepared for" line (client=). Nothing here reads a secret into the page except the
// caller's own key, which is already in the address (the same pattern as the Investor selector). Nothing here writes KV.
import { optionsHtml } from "./doc_options_page.js";
import { esc, loadContext, parseQuery, buyOf, BEDS } from "./brief_docs.js";
import { icon, parseParams, loadData, dateLong } from "./devmap_pdf.js";
import { DM } from "./devmap_dm.js";
import { claimsFor, permissionOnFile, PICTURES_WITHHELD } from "./dev_claims.js";   // v414
import { loadBuilding, buildingConfig } from "./broker_building.js";   // v450 - kind=building: one building's broker sheet

const PREP = "the reader of this sheet";
const MID = "·";
const BAND_LABEL = { studio: "Studio", 1: "1 bedroom", 2: "2 bedrooms", 3: "3 bedrooms or more" };
const BANDS = ["studio", "1", "2", "3"];
const cleanKey = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9:_.-]+/g, "").slice(0, 80);

// ---------------------------------------------------------------------------------------------------------- CLIENT: what the building's own records can support
async function ctxFor(env, key, mode, origin) {
  try {
    const q = parseQuery(new URL("https://x/brief_pdf?kind=dossier&beds=all&mode=" + mode + "&keys=" + encodeURIComponent(key)));
    const C = await loadContext(env, q, { origin, need: { units: true, photos: true, map: false, avail: false }, deferLive: true });
    try { await C.live; } catch (e) {}
    if (C.error || C.missing.length || (C.buy && C.noEvidence.length) || !C.recs.length) return null;
    return C.recs[0];
  } catch (e) { return null; }
}
export async function clientFacts(env, key, origin) {
  const [rr, rb] = await Promise.all([ctxFor(env, key, "rent", origin), ctxFor(env, key, "buy", origin)]);
  const rec = rr || rb;
  if (!rec) return null;
  const rent = {}, buy = {};
  if (rr) for (const b of BANDS) if (rr.sts && rr.sts[b]) rent[b] = true;
  if (rb && rb.um) for (const b of BANDS) { try { if (buyOf(rb.um, { beds: b, bedsList: [b], min: 0, max: null, stretch: 0 })) buy[b] = true; } catch (e) {} }
  const amenLines = ((rec.br && rec.br.amenities) || []).length + (rec.crit ? ["gym", "parking", "balcony"].filter((k) => rec.crit[k] && (rec.crit[k].v === true || rec.crit[k].v === false)).length : 0);
  return { key, name: rec.name, district: rec.dist, rent, buy, rentOk: !!Object.keys(rent).length, buyOk: !!(rb && Object.keys(buy).length),
    photos: (rec.photos || []).length, layouts: !!(rec.un && rec.un.floors), amen: amenLines > 0 || !!(rec.pos || rec.cpos), render: !!rec.renderPic, devPhoto: !!(rec.heroPic || rec.cardPic) };
}

export function clientConfig(f, o) {
  const mode0 = o && o.mode === "buy" && f.buyOk ? "buy" : o && o.mode === "rent" && f.rentOk ? "rent" : f.rentOk ? "rent" : f.buyOk ? "buy" : "rent";
  const beds0 = o && BANDS.concat(["all"]).includes(String(o.beds)) ? String(o.beds) : "all";
  const noRent = "No rent contracts are recorded for this building, so there is no rent to show.";
  const noBuy = "Fewer than three settled sales of any home type are recorded for this building, so no price can be shown.";
  const sec = [];
  sec.push({ id: "mode", title: "Rent or buy", type: "single", options: [
    { id: "rent", title: "Rent", small: "What homes here let for a year, from registered contracts.", icon: "wallet", off: !f.rentOk, why: [noRent], set: { mode: "rent" }, def: mode0 === "rent" },
    { id: "buy", title: "Buy", small: "What homes here sold for, from registered sales (not asking prices).", icon: "chart-bar", off: !f.buyOk, why: [noBuy], set: { mode: "buy" }, def: mode0 === "buy" }] });
  const bedsOpts = [{ id: "all", title: "Every home type", small: "One figure per type the building has.", icon: "buildings", set: { beds: "all" }, def: beds0 === "all" }];
  for (const b of BANDS) {
    const r = !!f.rent[b], bu = !!f.buy[b], one = { id: b, title: BAND_LABEL[b], small: "Only this home type.", icon: "ruler", set: { beds: b }, def: beds0 === b };
    if (!r && !bu) { one.off = true; one.why = ["Neither a rent record nor three settled sales exist for this home type in this building."]; }
    else if (r && !bu) { one.when = { sec: "mode", ids: ["rent"] }; one.whyNot = "Fewer than three settled sales of this home type are recorded, so no price can be shown."; }
    else if (!r && bu) { one.when = { sec: "mode", ids: ["buy"] }; one.whyNot = "No rent contracts are recorded for this home type."; }
    bedsOpts.push(one);
  }
  sec.push({ id: "beds", title: "Which homes", type: "single", options: bedsOpts });
  sec.push({ id: "budget", title: "Budget (optional)", help: "Rent is a year in AED; a purchase is the price in AED.", type: "text", when: { sec: "beds", ids: BANDS }, whyNot: "A budget applies to one home type: choose a bedroom count first.",
    fields: [{ param: "min", title: "From", small: "AED. Leave empty for no lower limit.", kind: "money", ph: "for example 60000", max: 12 }, { param: "max", title: "Up to", small: "AED. Leave empty for no upper limit.", kind: "money", ph: "for example 90000", max: 12 }] });
  sec.push({ id: "inc", title: "What the sheet includes", type: "multi", param: "hide", mode: "omit", options: [
    { id: "amen", title: "Amenities, where it is, what is nearby", small: "Straight-line distances; schools with their inspection rating where one exists.", icon: "map-pin", val: "amen", def: true, off: !f.amen, why: ["No amenity, position or nearby record is held for this building."] },
    { id: "photos", title: "Developer photographs", small: "Pictures from the developer's own project page, credited.", icon: "map-trifold", val: "photos", def: true, off: !f.photos, why: ["The developer's page publishes no photographs of this building."] },
    { id: "layouts", title: "Layouts table", small: "Flat by flat, from the Land Department units register.", icon: "stack", val: "layouts", def: true, off: !f.layouts, why: ["The units register does not cover this building flat by flat."] }] });
  const both = f.rentOk && f.buyOk;
  sec.push({ id: "later", title: "Offered when the evidence supports it", help: "These are shown so you can see why they are not available today.", type: "multi", param: "extra", mode: "include", options: [
    { id: "walk", title: "Walking times", small: "Only where a person has checked the walk on site.", icon: "map-pin", val: "walk", off: true, why: ["No walking time has been checked by a person for this building. The sheet gives straight-line distances only."] },
    { id: "plan", title: "Payment plan", small: "Only as the developer states it.", icon: "wallet", val: "plan", off: true, why: ["The client sheet does not carry a payment plan. The investor report does, where a developer sheet is on file."] },
    { id: "yield", title: "Rent yield", small: "Needs rent and sale evidence for the same home type.", icon: "calculator", val: "yield", off: true, why: [both ? "Rent and sale evidence both exist for this building, but the client sheet does not work out a yield. The investor report does." : "A yield needs both rent contracts and settled sales for this building; " + (f.rentOk ? "settled sales are" : "rent contracts are") + " missing."] },
    { id: "short", title: "Shortlist of comparable projects", small: "Several buildings side by side.", icon: "chart-donut", val: "short", off: true, why: ["A shortlist compares two or more buildings. Open it from the Brief with several buildings chosen."] },
    { id: "ar", title: "Arabic", small: "The sheet in Arabic.", icon: "chat-circle-text", val: "ar", off: true, why: ["The client sheet is in English only."] }] });
  sec.push({ id: "prep", title: "Prepared for", type: "text", fields: [{ param: "client", title: "Name on the sheet", small: "Shown under the title. If left empty it reads: " + PREP + ".", ph: PREP, max: 60, always: PREP }] });
  return {
    title: "Client sheet: choose the version", sub: esc(f.name) + " in " + esc(f.district) + ". Chosen before the sheet is made.",
    sections: sec, base: "/brief_pdf", fixed: [["kind", "dossier"], ["keys", f.key]], key: (o && o.key) || "", go: "Make the client sheet", stop: !f.rentOk && !f.buyOk,
    coverNote: "The sheet lists its sources at the foot of its pages.", icons: ["wallet", "chart-bar", "buildings", "ruler", "map-pin", "map-trifold", "stack", "calculator", "chart-donut", "chat-circle-text", "info"],
    core: [
      { title: "Registered facts", small: "Developer, completion, floors and homes, as the Land Department register and the developer's own page give them." },
      { title: "The figure and its evidence", small: "The typical rent or price, how many lettings or sales stand behind it, and where it comes from. Sales recorded at the Land Department, not asking prices." },
      { title: "Pictures, labelled", small: "The developer's photograph, else a street-level picture aimed at the building, else our own illustration marked as one. Never a satellite image." },
      { title: "Prepared for", small: "The line that names who the sheet is for." },
      { title: "Legal footer", small: "Curated by Najjuko " + MID + " Dubai Decoded, WhatsApp +971 56 548 4397, and the line that availability and price are confirmed with the developer or the listing broker." }] };
}

// v414 - the CLIENT sheet of a project that is not on the register (keys=dev:<slug>): what the developer's record and the unit register support. Pictures only with the developer's written permission on file.
export function devClientConfig(c, o) {
  const on = permissionOnFile(c), hasPlans = !!(c.payment_plans && c.payment_plans.plans && c.payment_plans.plans.length), key = "dev:" + c.key;
  const sec = [];
  sec.push({ id: "mode", title: "Rent or buy", type: "single", options: [
    { id: "rent", title: "Rent", small: "What homes here let for a year, from registered contracts.", icon: "wallet", off: true, why: ["This project has no registered rent contracts: it is a new launch. The sheet is a purchase sheet."], set: { mode: "rent" } },
    { id: "buy", title: "Buy", small: "The developer's own launch prices (developer says), beside the unit register's homes.", icon: "chart-bar", set: { mode: "buy" }, def: true }] });
  sec.push({ id: "inc", title: "What the sheet includes", type: "multi", param: "hide", mode: "omit", options: [
    { id: "amen", title: "Amenities (developer says)", small: "The developer's list by level, with its source and the date received.", icon: "map-pin", val: "amen", def: true },
    { id: "photos", title: "Developer's pictures", small: "The developer's own renders and brochure pages, each labelled as the developer's.", icon: "map-trifold", val: "photos", def: on, off: !on, why: on ? [] : [PICTURES_WITHHELD] },
    { id: "layouts", title: "Homes in the unit register", small: "Home types, counts and size ranges, from the Land Department unit register.", icon: "stack", val: "layouts", def: true }] });
  sec.push({ id: "later", title: "Offered when the evidence supports it", help: "These are shown so you can see why they are not available today.", type: "multi", param: "extra", mode: "include", options: [
    { id: "plan", title: "Payment plans (developer says)", small: "Both plans, as the developer prints them.", icon: "wallet", val: "plan", def: hasPlans, off: true, why: [hasPlans ? "The sheet always carries the developer's payment plans, as printed, with the asterisk note." : "The developer's record holds no payment plan."] },
    { id: "walk", title: "Walking times", small: "Only where a person has checked the walk on site.", icon: "map-pin", val: "walk", off: true, why: ["No walking time has been checked by a person for this project."] },
    { id: "ar", title: "Arabic", small: "The sheet in Arabic.", icon: "chat-circle-text", val: "ar", off: true, why: ["The client sheet is in English only."] }] });
  sec.push({ id: "prep", title: "Prepared for", type: "text", fields: [{ param: "client", title: "Name on the sheet", small: "Shown under the title. If left empty it reads: " + PREP + ".", ph: PREP, max: 60, always: PREP }] });
  return {
    title: "Client sheet: choose the version", sub: esc(c.project.name) + ". A project that is not on the project register: its facts are the developer's (developer says) and the unit register's. Chosen before the sheet is made.",
    sections: sec, base: "/brief_pdf", fixed: [["kind", "dossier"], ["keys", key], ["mode", "buy"], ["beds", "all"]], key: (o && o.key) || "", go: "Make the client sheet", stop: false,
    coverNote: "The sheet lists its sources at the foot of its pages.", icons: ["wallet", "chart-bar", "buildings", "ruler", "map-pin", "map-trifold", "stack", "calculator", "chart-donut", "chat-circle-text", "info"],
    core: [
      { title: "Registered facts", small: "The homes, their types and size ranges, as the Land Department unit register gives them, with its date." },
      { title: "Developer says, labelled", small: "Launch prices, payment plans, handover and amenities as the developer prints them, with the source and the date received. Not registered sales, not asking prices from us." },
      { title: "Pictures, labelled", small: on ? "The developer's renders and brochure pages, each marked as the developer's. Never a satellite image, never a picture made by us." : PICTURES_WITHHELD },
      { title: "Prepared for", small: "The line that names who the sheet is for." },
      { title: "Legal footer", small: "Curated by Najjuko " + MID + " Dubai Decoded, WhatsApp +971 56 548 4397, and the line that availability and price are confirmed with the developer or the listing broker." }] };
}

// ---------------------------------------------------------------------------------------------------------- BROKER: what the area and its developers support
export function brokerConfig(C, o) {
  const area = C.area, slug = C.slug, ix = C.ix, hasEvA = !!(C.IDX0.areas[slug] && C.IDX0.areas[slug].ev && C.IDX0.areas[slug].ev.all);
  const A0 = C.IDX0.areas[slug] || area, devKeys = Object.keys(A0.devs || {}).filter((k) => k !== "_");   // the roster on the register (every window), not the window filter
  const salesOf = (d) => (d.c || []).reduce((q, c) => q + (c[0] || 0), 0);
  const hasRent = devKeys.some((k) => (A0.devs[k].r || []).length);
  const chosen = new Set(Object.keys(C.mine));
  const kind0 = o && o.kind === "detailed" ? "detailed" : "snapshot";
  const win0 = C.p.win === "all" || !hasEvA ? "all" : "12m";
  const mode0 = C.p.mode === "rent" && hasRent ? "rent" : "buy";
  const enough = !!C.st.enough, bounds = C.st.bounds || [];
  const sec = [];
  sec.push({ id: "kind", title: "How much", type: "single", options: [
    { id: "snapshot", title: "Snapshot", small: "One page: the area at a glance, with the price bands.", icon: "stack", set: { kind: "snapshot" }, def: kind0 === "snapshot" },
    { id: "detailed", title: "Detailed", small: "Maps, projects by developer, budget pages and the method.", icon: "buildings", set: { kind: "detailed" }, def: kind0 === "detailed", off: !enough, why: ["Fewer than three settled sales are on the register for this area, so only the one-page note can be made."] }] });
  sec.push({ id: "win", title: "Sales window", type: "single", options: [
    { id: "12m", title: "Last 12 months", small: "Sales by year are on the register for this area.", icon: "chart-bar", set: { window: "12m" }, def: win0 === "12m", off: !hasEvA, why: ["This area has no record by year, so the last 12 months cannot be shown."] },
    { id: "all", title: "All years", small: "Every settled sale on the register.", icon: "chart-donut", set: { window: "all" }, def: win0 === "all" }] });
  sec.push({ id: "mode", title: "Buy or rent", type: "single", options: [
    { id: "buy", title: "Buy", small: "Registered sales.", icon: "wallet", set: { mode: "buy" }, def: mode0 === "buy" },
    { id: "rent", title: "Rent", small: "Registered rent contracts.", icon: "calculator", set: { mode: "rent" }, def: mode0 === "rent", off: !hasRent, why: ["No rent contracts are recorded for these developers in this area."] }] });
  const others = Object.entries((C.IDX0.areas) || {}).filter(([s, a]) => s !== slug && a && a.devs && devKeys.some((k) => chosen.has(k) && a.devs[k])).slice(0, 12);
  const nav = (s, a, cur) => ({ id: s, title: String(a.name || s), small: cur ? "This sheet" : "Open the choices for this area", icon: "map-pin", cur, href: "/doc_broker?area=" + encodeURIComponent(s) + "&developers=" + encodeURIComponent(devKeys.filter((k) => chosen.has(k) && (cur || a.devs[k])).join(",")) + "&kind=" + kind0 + "&window=" + win0 + "&mode=" + mode0 + (o && o.key ? "&key=" + encodeURIComponent(o.key) : "") });
  sec.push({ id: "area", title: "Area", help: "One area per sheet. The areas below are where the chosen developers also have sales.", type: "nav", options: [nav(slug, area, true)].concat(others.map(([s, a]) => nav(s, a, false))) });
  sec.push({ id: "devs", title: "Developers", help: "At least one. A developer with no settled sale here cannot be added.", type: "multi", param: "developers", mode: "include", options: devKeys.map((k) => {
    const d = A0.devs[k], n = salesOf(d), pr = (d.b || []).length;
    return { id: k, title: String(d.n || k), small: n + " settled sales, " + pr + " project" + (pr === 1 ? "" : "s") + " named.", icon: "buildings", val: k, def: chosen.has(k) && n > 0, off: n === 0, why: ["No settled sale is recorded for this developer here."] };
  }) });
  const tierOpt = (t) => ({ id: "t" + t, title: DM.TIER_NAMES[t], small: t === 0 ? "AED " + Math.round(bounds[0]).toLocaleString("en-US") + " per sq m and above" : t === 3 ? "Under AED " + Math.round(bounds[2]).toLocaleString("en-US") + " per sq m" : "AED " + Math.round(bounds[t]).toLocaleString("en-US") + " to " + Math.round(bounds[t - 1]).toLocaleString("en-US") + " per sq m",
    icon: "chart-bar", set: Object.assign({ basis: "sqm" }, t < 3 ? { min: Math.round(bounds[t]) } : {}, t > 0 ? { max: Math.round(bounds[t - 1]) } : {}), when: { sec: "mode", ids: ["buy"] }, whyNot: "A price band is a price per area for a purchase: choose Buy.", off: !enough || bounds.length < 3, why: ["Not enough settled sales to set price bands for this area."] });
  sec.push({ id: "band", title: "Price band", help: "Price bands describe homes, not developers.", type: "single", options: [{ id: "any", title: "Any price", small: "No budget match.", icon: "stack", def: true, set: {} }].concat([0, 1, 2, 3].map(tierOpt)) });
  sec.push({ id: "beds", title: "Bedrooms for the band", type: "single", when: { sec: "band", ids: ["t0", "t1", "t2", "t3"] }, whyNot: "Choose a price band first.", options: [{ id: "any", title: "Any", small: "All home types.", icon: "buildings", def: true, set: {} }].concat(BANDS.map((b) => ({ id: b, title: BAND_LABEL[b], small: "Match the band for this home type.", icon: "ruler", set: { beds: b === "studio" ? "0" : b } }))) });
  sec.push({ id: "plan", title: "Off-plan or ready homes", type: "single", options: [
    { id: "off", title: "Off-plan only", small: "Homes sold before they are finished.", icon: "buildings", off: true, why: ["The sales on this sheet are not split by handover status, so this cannot be offered yet."] },
    { id: "ready", title: "Ready only", small: "Completed homes.", icon: "buildings", off: true, why: ["The sales on this sheet are not split by handover status, so this cannot be offered yet."] }] });
  sec.push({ id: "add", title: "Add to the sheet", type: "multi", param: "contact", mode: "include", options: [
    { id: "contact", title: "Broker contact block", small: "Blank lines for your name, mobile and email, to fill in by hand.", icon: "chat-circle-text", val: "1", def: false },
    { id: "nc", title: "Projects not yet confirmed", small: "As a group of their own, never mixed into the numbers.", icon: "info", val: "nc", def: false, off: true, why: ["The sheet does not list unconfirmed projects as a group yet. They are kept out of every number."] }] });
  sec.push({ id: "prep", title: "Prepared for", type: "text", fields: [{ param: "client", title: "Name on the sheet", small: "Shown in the header. If left empty it reads: " + PREP + ".", ph: PREP, max: 60, always: PREP }] });
  return {
    title: "Broker sheet: choose the version", sub: esc(C.names.plain) + ". Sales data to " + esc(dateLong(C.IDX0.as_of)) + ". Chosen before the sheet is made.",
    sections: sec, base: "/developers_pdf", fixed: [["area", slug]], key: (o && o.key) || "", go: "Make the broker sheet",
    coverNote: "The sheet states the window and the date of the register on every page.", icons: ["stack", "buildings", "chart-bar", "chart-donut", "wallet", "calculator", "map-pin", "ruler", "chat-circle-text", "info"],
    core: [
      { title: "Registered facts", small: "The Dubai Land Department sales register, with its date and the window used, on every page." },
      { title: "Evidence labels", small: "How many sales stand behind each figure. Under three sales no price is shown." },
      { title: "Only confirmed projects in the numbers", small: "A project the register does not confirm is kept out of every figure." },
      { title: "Prepared for", small: "The line that names who the sheet is for." },
      { title: "Legal footer", small: "The permit reminder and the page numbers. Past registered facts only: not an offer, not advice." }] };
}

// ---------------------------------------------------------------------------------------------------------- the route
const HDR = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" };
const J = (o, status) => new Response(JSON.stringify(o, null, 1), { status: status || 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
export async function docOptionsRoute(request, env, url, deps) {
  if (request.method !== "GET" && request.method !== "HEAD") return new Response("method not allowed", { status: 405 });
  if (!deps || !deps.keyOk || !deps.keyOk(env, url)) return new Response("unauthorized", { status: 401 });
  const key = url.searchParams.get("key") || "";
  if (url.pathname === "/doc_client") {
    const k = cleanKey(String(url.searchParams.get("keys") || "").split(",")[0]);
    if (!k) return J({ ok: false, reason: "keys= is required (one building)" }, 400);
    if (/^dev:/.test(k)) { const c = claimsFor(k.slice(4)); if (!c) return J({ ok: false, reason: "no developer-says record for this project", key: k }, 404); return new Response(optionsHtml(devClientConfig(c, { key }), icon), { headers: HDR }); }   // v414
    const f = await clientFacts(env, k, url.origin);
    if (!f) return J({ ok: false, reason: "this building is in neither the rent index nor the unit-mix register", key: k }, 404);
    return new Response(optionsHtml(clientConfig(f, { key, mode: url.searchParams.get("mode"), beds: url.searchParams.get("beds") }), icon), { headers: HDR });
  }
  const p = parseParams(url);
  if (p.kind === "building") {   // v450 - the one-building broker sheet (src/broker_building.js); the area sheet below is unchanged
    const LB = await loadBuilding(env, p, { origin: url.origin, owner: !!(deps.owner && deps.owner(env, url)) });
    if (LB.status !== 200) return J(LB.body, LB.status);
    return new Response(optionsHtml(buildingConfig(LB.B, { key }), icon), { headers: HDR });
  }
  const L = await loadData(env, p, { origin: url.origin });
  if (L.status !== 200) return J(L.body, L.status);
  return new Response(optionsHtml(brokerConfig(L.C, { key, kind: p.kind }), icon), { headers: HDR });
}
