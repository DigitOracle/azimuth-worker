// v414 - the CLIENT SHEET for a project that is not on the project register and has no building footprint: GET /brief_pdf?kind=dossier&keys=dev:<slug> (the existing generator, a new key kind).
// Built from three things only: the unit register's own facts for the project (homes, mix, sizes: DLD unit register), the developer's launch material (prices, payment plans, handover, amenities:
// 'developer says', with the source and the received date) and the developer's renders IF the picture permission is on file. Nothing is invented; no internal item (land sale, mortgage, rents, DEWA,
// comparisons, first-year pricing) is read or printed here. A key without the dev: prefix never reaches this file, so every existing dossier is byte-identical.
//
// PICTURE PERMISSION: pictures appear only when the claims record says render_permission.status === "on_file" (src/dev_claims.js). While it is "pending" the sheet is a FACTS SHEET: it says
// 'Pictures withheld until the developer's written permission is on file.' where the pictures would be, and the 'no exterior, no sheet' rule is relaxed for this developer-supplied path with that visible line.
import { BRIEF_KIT, PAGE_KIT, esc, HEADER_IMG_KEY, HEADER_JPG_KEY } from "./brief_docs.js";
import { kvJson } from "./brief.js";
import { loadFactsSharded } from "./investor_facts.js";
import { claimsFor, permissionOnFile, PICTURES_WITHHELD, launchFrom, money, receivedLong, positionOf, locationLine } from "./dev_claims.js";

const DEV = "developer says";
const NOT_ASKING = "Starting prices are the developer's own, not registered sales and not asking prices from us.";

export async function devDossierFacts(env, c) {
  try { return await loadFactsSharded((name) => kvJson(env, name), c.project.facts_id); } catch (e) { return null; }
}

const lbl = (t) => '<div class="lbl" style="font-size:9.5px;">' + t + "</div>";
const sec = (t) => '<div class="serif" style="font-size:19px;color:' + BRIEF_KIT.NAVY + ';margin-top:2px;">' + t + "</div>";
const note = (t) => '<div style="font-size:10px;color:' + BRIEF_KIT.MUTED + ';line-height:1.4;">' + t + "</div>";
const tag = (t) => '<span style="font-size:8.5px;letter-spacing:.6px;color:#A8814A;font-weight:600;">' + esc(t.toUpperCase()) + "</span>";

function unitTable(UR) {
  if (!UR || !UR.single || !(UR.single.units > 0)) return "";
  const s = UR.single, rows = [], sz = (b) => (UR.sizes || []).find((z) => /^studio/i.test(b) ? /^studio/i.test(z.beds) : String(z.beds).startsWith(b));
  const add = (label, n, b) => { if (n > 0) { const z = sz(b); rows.push([esc(label), String(n), z && z.min_sqft ? money(z.min_sqft) + " &ndash; " + money(z.max_sqft) + " sq ft" : "&mdash;"]); } };
  add("Studios", s.studio, "Studio"); add("1 bedroom", s.b1, "1"); add("2 bedrooms", s.b2, "2"); add("3 bedrooms", s.b3, "3");
  if (s.b4plus > 0) rows.push(["4 bedrooms or more", String(s.b4plus), "&mdash;"]);
  if (s.other > 0) rows.push(["Other", String(s.other), "&mdash;"]);
  return '<div style="display:flex;flex-direction:column;gap:6px;">' + sec("The homes in the unit register") + PAGE_KIT.tbl([["left", "HOME TYPE"], ["right", "HOMES"], ["right", "SIZE RANGE"]], rows) +
    note("<b>" + money(s.units) + " homes</b> in the Land Department unit register for this project. " + esc(UR.source || "") + ". The register does not record which homes are still for sale.") + "</div>";
}
function priceTable(c) {
  const l = launchFrom(c); if (!l) return "";
  const rows = l.rows.map((r) => [esc(r.type), "from " + money(r.size_sqft) + " sq ft", "from AED " + money(r.from_aed) + ' <span style="color:#8C887C;">(printed ' + esc(String(r.printed_price).replace(/^\s*Starting:\s*/i, "")) + ")</span>"]);
  return '<div style="display:flex;flex-direction:column;gap:6px;">' + sec("Launch prices " + tag(DEV)) + PAGE_KIT.tbl([["left", "HOME TYPE"], ["right", "SIZE"], ["right", "STARTING PRICE"]], rows) +
    note(esc(NOT_ASKING) + " Source: " + esc(c.source.name) + ", received " + esc(receivedLong(c)) + ".") + "</div>";
}
function planTables(c) {
  const plans = (c.payment_plans && c.payment_plans.plans) || [];
  if (!plans.length) return "";
  const one = (p) => '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:5px;"><div style="font-size:12.5px;font-weight:600;color:' + BRIEF_KIT.NAVY + ';">' + esc(p.label) + "</div>" +
    PAGE_KIT.tbl([["left", "INSTALMENT"], ["right", "PAYMENT"], ["right", "WHEN"]], p.steps.map((s) => [esc(s.label), s.pct + "%", s.when ? esc(s.when) + (s.marked ? "*" : "") : "on booking"])) + "</div>";
  return '<div style="display:flex;flex-direction:column;gap:6px;">' + sec("Payment plans " + tag(DEV)) + '<div style="display:flex;gap:14px;">' + plans.map(one).join("") + "</div>" +
    note("Dates marked * are indicative: the brochure does not say what the asterisk means here. No cash amount is worked out. Source: " + esc(c.source.name) + ", received " + esc(receivedLong(c)) + ".") + "</div>";
}
// v416 - where the project is: the plot (Dubai Municipality outline), said as a plot and not as the building. No map picture is drawn (no satellite imagery on a client document).
function locationBlock(c) {
  const l = positionOf(c);
  if (!l) return "";
  return '<div style="font-size:11.5px;color:' + BRIEF_KIT.NAVY + ';line-height:1.4;">' + esc(locationLine(l)) + "</div>";
}
// v416 - the developer's own "15-minute loop" travel times, as transcribed (developer says; the mode of travel is not stated, so they are never walking times)
function travelBlock(c) {
  const rows = (c.drive_times && c.drive_times.rows) || [];
  if (!rows.length) return "";
  return '<div style="display:flex;flex-direction:column;gap:6px;">' + sec("Travel times (developer says; mode not stated)") + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:3px 14px;font-size:10.5px;color:' + BRIEF_KIT.NAVY + ';">' +
    rows.map((r) => "<div>" + esc(r.to) + " &mdash; " + esc(String(r.min)) + " min</div>").join("") + "</div>" +
    note("From the 15-minute loop on the developer's location map. The brochure does not say how you travel, so these are not walking times. Source: " + esc(c.source.name) + ", received " + esc(receivedLong(c)) + ".") + "</div>";
}
function amenityBlock(c) {
  const by = (c.amenities && c.amenities.by_level) || [];
  if (!by.length) return "";
  return '<div style="display:flex;flex-direction:column;gap:6px;">' + sec("Amenities " + tag(DEV)) + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">' +
    by.map((l) => '<div class="card" style="padding:9px;">' + lbl(esc(l.where).toUpperCase()) + '<div style="font-size:11px;color:' + BRIEF_KIT.NAVY + ';line-height:1.4;">' + l.items.map((i) => "&#8226; " + esc(i)).join("<br>") + "</div></div>").join("") + "</div>" +
    note(esc((c.amenities.pillars_note ? "Also on the brochure's pillars page (" + (c.amenities.pillars_also_listed || []).join(", ") + "): the brochure does not say who provides these or whether any is included in the price. " : "")) + "Source: " + esc(c.source.name) + ", received " + esc(receivedLong(c)) + ".") + "</div>";
}

export async function buildDevDossier(env, q, opts) {
  const slug = String(q.keys[0] || "").slice(4).toLowerCase().replace(/[^a-z0-9_-]/g, "");
  const c = claimsFor(slug);
  if (!c) return { status: 404, body: { ok: false, reason: "no developer-says record for this project", keys: q.keys } };
  const facts = await devDossierFacts(env, c), UR = facts && facts.unit_register && facts.unit_register.single && facts.unit_register.single.units > 0 ? facts.unit_register : null;
  const hide = q.hide || [], on = permissionOnFile(c), origin = opts && opts.origin;
  const C = { buy: true, pages: 0, today: BRIEF_KIT.todayLong(opts && opts.now) };
  C.logo = (await BRIEF_KIT.kvDataUrl(env, HEADER_JPG_KEY, origin)) || (await BRIEF_KIT.kvDataUrl(env, HEADER_IMG_KEY, origin));
  const area = facts && facts.project && (facts.project.master_project || facts.project.area) || "";
  const sub = "PROJECT SHEET &middot; " + esc(c.project.name).toUpperCase() + " &middot; PURCHASE &middot; DEVELOPER SAYS" + (q.client ? " &middot; PREPARED FOR " + esc(q.client).toUpperCase() : "");
  const page = (body, small) => { C.pages++; return '<div class="sheet page">' + PAGE_KIT.header(C, sub) + '<div style="flex:1;display:flex;flex-direction:column;padding:16px 46px 0 46px;gap:12px;overflow:hidden;">' + body + "</div>" + BRIEF_KIT.footer(small, true, true) + "</div>"; };

  // pictures: only with the permission on file, only the stored renders without people, each labelled
  let pics = [], picNote = "";
  if (!hide.includes("photos")) {
    if (!on) picNote = PICTURES_WITHHELD;
    else {
      for (const r of c.renders || []) { const p = await PAGE_KIT.kvPic(env, r.kv, origin); if (p) pics.push({ p, r }); }
      if (!pics.length) picNote = "The developer's renders are not yet in the document store.";
    }
  }
  const ext = pics.find((x) => x.r.exterior);
  const hero = ext ? '<div>' + PAGE_KIT.fitImg(ext.p.p || ext.p, 702, 300, c.project.name, 0.4) + '<div style="font-size:9.5px;color:' + BRIEF_KIT.MUTED + ';margin-top:2px;">' + esc(ext.r.caption) + "</div></div>"
    : picNote ? '<div style="border:1px dashed #DED9D0;padding:14px 16px;font-size:12px;color:' + BRIEF_KIT.MUTED + ';">' + esc(picNote) + "</div>" : "";
  const L = launchFrom(c);
  const facts4 = [["DEVELOPER BRAND", esc(c.project.brand) + " " + tag(DEV)], ["AREA", esc(area || "Dubai")], ["HANDOVER", esc(c.handover.text) + "* " + tag(DEV)], ["REGISTERED SALES", facts && facts.sales && facts.sales.all_time === 0 ? "none to " + esc(String(facts.as_of && facts.as_of.sales || "")) : "&mdash;"]];
  const factHtml = '<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;">' + facts4.map(([k, v]) => '<div style="display:flex;flex-direction:column;gap:3px;">' + lbl(k) + '<div style="font-size:13px;">' + v + "</div></div>").join("") + "</div>";
  const title = '<div style="display:flex;flex-direction:column;gap:4px;"><div class="serif" style="font-size:33px;color:' + BRIEF_KIT.NAVY + ';line-height:1;">' + esc(c.project.name) + '</div><div style="font-size:13px;color:' + BRIEF_KIT.MUTED + ';">' +
    (L ? "Launch price from AED " + money(L.aed) + " (developer says). " : "") + "Not on the project register: no unit of this project has sold on the register.</div></div>";
  const p1 = page(hero + title + factHtml + locationBlock(c) + (hide.includes("layouts") ? "" : unitTable(UR)) + priceTable(c), "");
  const gallery = pics.length && !hide.includes("photos") ? '<div style="display:flex;flex-direction:column;gap:6px;">' + sec("Developer's renders") + '<div style="display:grid;grid-template-columns:repeat(' + Math.min(3, pics.length) + ',minmax(0,1fr));gap:8px;">' +
    pics.map((x) => "<div>" + PAGE_KIT.fitImg(x.p.p || x.p, 222, 150, x.r.what, 0.5) + '<div style="font-size:9px;color:' + BRIEF_KIT.MUTED + ';">' + esc(x.r.caption) + "</div></div>").join("") + "</div></div>" : "";
  const hs = '<div style="font-size:11.5px;color:' + BRIEF_KIT.NAVY + ';line-height:1.4;">Handover: ' + esc(c.handover.text) + "* " + tag(DEV) + ". The brochure prints the date with an asterisk and does not say what it means here, so the date is indicative.</div>";
  const small = BRIEF_KIT.smallPrint([
    UR ? "Homes, mix and sizes: " + esc(UR.source) + "." : "", "Prices, payment plans, handover and amenities: " + esc(c.source.name) + " (the developer's own material, " + esc(c.source.kind || "") + "), received " + esc(receivedLong(c)) + "; developer says, not registered facts.",
    pics.length ? "Pictures: the developer's renders (illustrations), shown with the developer's written permission." : (picNote ? esc(picNote) : "")]);
  const p2 = page(planTables(c) + hs + (hide.includes("amen") ? "" : amenityBlock(c)) + travelBlock(c) + gallery, small);
  const fname = c.project.name.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "") + "_Client_sheet.pdf";
  return { status: 200, html: PAGE_KIT.HEAD(c.project.name + " - client sheet", p1 + p2), pages: C.pages, fname, C };
}
