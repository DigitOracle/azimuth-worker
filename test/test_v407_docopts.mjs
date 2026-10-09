// v407 - the Client and Broker options pages (same shell as the Investor selector), the new PDF switches (hide=, client=, contact=), and the buttons that open them.
// Offline: hand-worked fixtures and a stubbed store; no network, nothing live is read or written.   node test/test_v407_docopts.mjs
import fs from "node:fs";
import crypto from "node:crypto";
import { optionsHtml, optRuntime, optFrame, OPT_CSS, OPT_CSS_EXTRA } from "../src/doc_options_page.js";
import { clientFacts, clientConfig, brokerConfig, docOptionsRoute } from "../src/doc_options_docs.js";
import { loadData, parseParams, buildAreaPdf, icon } from "../src/devmap_pdf.js";
import { buildDocument, parseQuery } from "../src/brief_docs.js";
import { selectorHtml, buildTiersHtml } from "../src/investor_tiers_page.js";
import * as T from "../src/investor_tiers.js";
import { __resetKvMemo } from "../src/brief.js";
import worker from "../src/index.js";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 400) : "")); } };
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2B55}\u{FE0F}\u{200D}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{25A0}-\u{25FF}]/u;
const textOf = (h) => h.replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<svg[\s\S]*?<\/svg>/g, " ").replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ");
const scriptOf = (h) => /<script>([\s\S]*)<\/script>/.exec(h)[1];
const dataOf = (h) => JSON.parse(/var D=(\{[\s\S]*?\}),I=/.exec(scriptOf(h))[1]);
const params = (href) => { const u = new URL("https://x" + href); const o = {}; for (const [k, v] of u.searchParams) o[k] = v; return o; };
// run the page runtime on a stand-in DOM and hand back the live object
function runPage(html) {
  const els = {}, hs = {};
  const doc = { getElementById: (id) => (els[id] = els[id] || { id, innerHTML: "", textContent: "", href: "", className: "" }), addEventListener: (t, f) => (hs[t] = f) };
  const D = dataOf(html), I = JSON.parse(/,I=(\{[\s\S]*?\});\(/.exec(scriptOf(html))[1]);
  const rt = new Function("D", "I", "document", "return (" + optRuntime.toString() + ")()")(D, I, doc);
  return { rt, els, D, doc };
}
const pick = (rt, sec, id) => { rt.st.sel[sec] = id; rt.draw(); };

// ------------------------------------------------------------------------------------------------ A - the Investor selector and PDFs are untouched
console.log("A - the Investor selector and the investor PDFs are byte-for-byte what they were");
{
  const src = fs.readFileSync(new URL("./test_v376_investor_tiers.mjs", import.meta.url), "utf8");
  const a = src.indexOf("const BASE = {"), b = a + src.slice(a).search(/\n\};\r?\n/) + 3;
  const BASE = new Function("clone", src.slice(a, b).replace("const BASE =", "return"))((o) => JSON.parse(JSON.stringify(o)));
  const h = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);
  const parts = [selectorHtml(BASE, "/developers_pdf", "KEY123"), selectorHtml(BASE, "/developers_pdf", "")];
  for (const type of [null, "income"]) for (const tier of ["summary", "standard", "full"]) parts.push(buildTiersHtml(BASE, T.buildPlan({ facts: BASE, type, tier, segments: [] }), { client: "Test Client" }).html);
  // fingerprints taken from release rel-v405 (before the shell was split out)
  const want = "af8e5df3bc86435d a260b7ced76c7a16 b80599bb3b895b2b 85948ec2ae03caaa 4cff9a42693e9f2d c54f6c732a842d07 644d11fa6f8a6c6d 48425d96869dfff7".split(" ");
  ok(parts.map(h).join(" ") === want.join(" "), "selector page (with and without key) and six investor reports hash the same as before", parts.map(h).join(" "));
}

// ------------------------------------------------------------------------------------------------ fixtures: a client building (rent only), one (buy only), a broker area
const store = new Map();
const KV = { async get(k, t) { if (!store.has(k)) return null; const v = store.get(k); return t === "arrayBuffer" ? (typeof v === "string" ? new TextEncoder().encode(v).buffer : v) : (typeof v === "string" ? v : new TextDecoder().decode(v)); }, async put() {}, async delete() {}, async list() { return { keys: [] }; } };
const J = (k, o) => store.set("img_" + k, JSON.stringify(o));
const st = (n, m, q1, q3, s, last) => ({ n, nn: n, nr: 0, m, q1, q3, s, last });
J("rent_index", { as_of: "2026-09-30", items: [{ p: "alphatower", n: "Alpha Tower", d: "testdistrict", i: 10, lon: 55.2, lat: 25.05, area: "Al Test Fourth", last: "2026-09-30", b: { "1": st(16, 65000, 60000, 70500, 59.1, "2026-09-30") } }] });
J("districts_geo", { districts: [{ slug: "testdistrict", name: "Test District", bbox: [55.19, 25.04, 55.21, 25.06] }, { slug: "dubaimarina", name: "Dubai Marina" }] });
J("amenities", { items: [{ k: "metro", n: "Test Metro Station", lat: 25.059, lon: 55.2 }] });
J("unitmix_testdistrict", { buildings_by_id: { "10": { name: "Alpha Tower", total_units: 211, floors: 21, dld: { buildings: 1 }, rows: [{ type: "1 bedroom", units: 178, basis: "DLD units register", median_sqm: 59.5 }] } } });
J("units_testdistrict", { buildings_by_id: { "10": { floors: { "1": [{ c: "1", sqft: 700, bal: 100 }], "2": [{ c: "1", sqft: 640, bal: 85 }] } } } });
const FX = JSON.parse(fs.readFileSync(new URL("./fixtures/v306_real_kv.json", import.meta.url), "utf8"));
for (const [d, u] of Object.entries(FX.unitmix)) J("unitmix_" + d, u);
J("map_prices", { generated: "2026-10-04", items: FX.map_prices });
J("districts_geo", { districts: [{ slug: "testdistrict", name: "Test District" }].concat(FX.districts) });
// a broker area: two areas, the first with a yearly record, the second without
const BOUNDS = [32292, 22604, 16684];
const cell = (n, psf, bed) => { const ppsm = Math.round(psf * 10.7639); return [n, ppsm, Math.round(ppsm * (60 + 25 * bed)), bed]; };
const evv = (n, med) => [n, med, n, med, 0, 0, n, med, 0, 0, 50, 80, 120];
const dev = (name, psf, n, projects, withRent, noev) => { const c = [cell(Math.ceil(n * 0.5), psf, 1), cell(Math.ceil(n * 0.5), psf * 1.02, 2)]; const d = { n: name, h: n * 3, c, b: projects.map((nm) => [Math.ceil(n / projects.length), Math.round(psf * 10.7639), nm]), r: withRent ? [[6, 900, 90000, 1]] : [] }; if (!noev) d.ev = { all: evv(n, Math.round(psf * 10.7639)), l12: evv(Math.ceil(n / 2), Math.round(psf * 10.7639)), y: [[2025, n, Math.round(psf * 10.7639)]], top: [[projects[0], n, 1, n, 1, 0]] }; if (!noev) d.c12 = c.map((x) => [Math.max(3, Math.floor(x[0] / 2)), x[1], x[2], x[3]]); return d; };
const IDX = { as_of: "2026-09-09", generated: "2026-09-09", cuts: { bounds: BOUNDS, shares: { bounds: BOUNDS, window: ["2025-09-01", "2026-09-01"], sales: 1000, n: [9, 20, 35, 36], money: [26, 25, 26, 24] }, rule: "x" }, devs: {}, alias: {},
  areas: {
    alpha: { name: "Alpha Village", bbox: [55.1, 25.0, 55.2, 25.1], register_sales_12m: 900, register_sales_all_time: 2400, ev: { all: evv(2000, 1500), l12: evv(900, 1600), y: [[2025, 900, 16000]] }, devs: { omniyat: dev("Omniyat", 3400, 60, ["Skyline One", "Skyline Two"], true), nakheel: dev("Nakheel", 2400, 80, ["Palm Court", "Palm Two"], false), empty: { n: "Empty Dev", h: 0, c: [], b: [], r: [] } } },
    beta: { name: "Beta Old Town", bbox: [55.3, 25.1, 55.35, 25.15], register_sales_all_time: 300, devs: { omniyat: dev("Omniyat", 3000, 40, ["Beta House"], false, true), zaya: dev("Zaya", 1500, 30, ["Zaya Court"], false, true) } } },
  scale: {}, ev: { as_of: "2026-08-31", since: "2019-01-01", l12_from: "2025-09-01", l12_to: "2026-08-31", source_as_of: "2026-09-17", sales: 5000, filters: "Ordinary sales of homes, price from AED 100,000." } };
for (const [s, a] of Object.entries(IDX.areas)) for (const [k, d] of Object.entries(a.devs)) { if (k === "_") continue; const e = IDX.devs[k] || (IDX.devs[k] = { name: d.n, areas: 0, n: 0, profile: { projects: 0, homes: 0 } }); e.areas++; e.n += (d.c || []).reduce((q, c) => q + c[0], 0); e.profile.projects += (d.b || []).length; }
J("devmap_index", IDX);
const env = { MEETINGS: KV, READ_KEY: "owner_key_abcdefgh", CLIENT_KEY: "client_key_123456", PUBLIC_ORIGIN: "https://azimuth-2.digitalchemy.workers.dev" };
const call = (path) => worker.fetch(new Request("https://azimuth-2.digitalchemy.workers.dev" + path), env, { waitUntil() {} });
const PREP = "the reader of this sheet";

// ------------------------------------------------------------------------------------------------ B - the client options page
console.log("B - the client options page: a rent-only building");
__resetKvMemo();
const f1 = await clientFacts(env, "testdistrict:10", "");
ok(f1 && f1.name === "Alpha Tower" && f1.rentOk && !f1.buyOk && f1.rent["1"] && !f1.rent["2"], "facts: Alpha Tower has rent for 1 bedroom, no sales, no 2 bedroom", JSON.stringify(f1));
const html1 = optionsHtml(clientConfig(f1, { key: "client_key_123456" }), icon);
{
  const D = dataOf(html1), sec = (id) => D.sections.find((s) => s.id === id), opt = (s, id) => sec(s).options.find((o) => o.id === id);
  ok(D.core.length === 5 && ["Registered facts", "The figure and its evidence", "Pictures, labelled", "Prepared for", "Legal footer"].every((t, i) => D.core[i].title === t), "the locked core is five cards: registered facts, figure and evidence, pictures, prepared for, legal footer");
  ok(/Curated by Najjuko · Dubai Decoded/.test(D.core[4].small) && /\+971 56 548 4397/.test(D.core[4].small), "the legal footer card carries the client-document footer and the WhatsApp number");
  ok(!/satellite image/.test(JSON.stringify(D.sections)) && /Never a satellite/.test(D.core[2].small) && /illustration/.test(D.core[2].small), "pictures: own illustration labelled, never satellite");
  ok(opt("mode", "buy").off && /no price can be shown/.test(opt("mode", "buy").why[0]) && !opt("mode", "rent").off, "Buy is greyed with its reason (fewer than 3 sales); Rent is on");
  ok(opt("beds", "1").when.ids.join() === "rent" && !opt("beds", "1").off && opt("beds", "2").off && /Neither/.test(opt("beds", "2").why[0]), "1 bedroom is offered (rent exists); 2 bedrooms is greyed with a reason");
  ok(sec("budget").when.sec === "beds" && /one home type/.test(sec("budget").whyNot), "the budget is only open once one home type is chosen");
  ok(!opt("inc", "amen").off && !opt("inc", "layouts").off && opt("inc", "photos").off && /no photographs/.test(opt("inc", "photos").why[0]), "amenities and layouts are offered (data exists); photographs are greyed (the developer page has none)");
  ok(sec("later").options.map((o) => o.id).join() === "walk,plan,yield,short,ar" && sec("later").options.every((o) => o.off && o.why[0].length > 30), "walking times, payment plan, yield, shortlist and Arabic are each greyed with a reason");
  ok(/rent contracts and settled sales/.test(opt("later", "yield").why[0]) && /settled sales are missing/.test(opt("later", "yield").why[0]), "the yield reason names which evidence is missing");
  const P = runPage(html1), u0 = P.rt.url();
  const q0 = params(u0.href);
  ok(u0.href.startsWith("/brief_pdf?"), "Generate goes to /brief_pdf");
  ok(q0.kind === "dossier" && q0.keys === "testdistrict:10" && q0.beds === "all" && q0.mode === "rent" && q0.key === "client_key_123456" && q0.client === PREP && !("hide" in q0) && !("min" in q0) && !("max" in q0), "the default choice is today's link (kind, keys, beds=all, mode=rent, key) plus only the prepared-for line", u0.href);
  ok(Object.keys(q0).filter((k) => !["kind", "keys", "beds", "mode", "key", "client"].includes(k)).length === 0, "no other parameter is added by default");
  P.rt.st.chk["inc/amen"] = false; P.rt.draw();
  ok(params(P.rt.url().href).hide === "amen", "unticking amenities adds hide=amen");
  pick(P.rt, "beds", "1"); P.rt.st.txt.max = "90000"; P.rt.st.txt.min = "60000"; P.rt.st.txt.client = "A. Buyer"; P.rt.draw();
  const q1 = params(P.rt.url().href);
  ok(q1.beds === "1" && q1.max === "90000" && q1.min === "60000" && q1.client === "A. Buyer", "a bedroom count opens the budget; the budget and the name are carried");
  pick(P.rt, "mode", "buy");
  ok(params(P.rt.url().href).mode === "rent", "a greyed choice cannot be selected");
  pick(P.rt, "beds", "all"); P.rt.draw();
  ok(!("min" in params(P.rt.url().href)) && !("max" in params(P.rt.url().href)), "back to every home type: the budget is dropped");
  // locked core: nothing in the page can switch it off
  const core = P.els.core.innerHTML;
  ok(core.split("Always included").length - 1 === 5 && !/<input|<button|<label/.test(core), "the core cards are plain text with an 'Always included' tag and no control");
  const all = JSON.stringify(P.D.sections);
  ok(!/Registered facts|Legal footer|Prepared for.*val/.test(JSON.stringify(P.D.sections.filter((s) => s.type === "multi" || s.type === "single").map((s) => s.options.map((o) => o.title)))), "no option is named after a core item");
  const tryOff = (v) => { P.rt.st.chk["inc/core"] = false; P.rt.st.chk["core"] = false; P.rt.draw(); return P.rt.url().href; };
  ok(!/core/.test(tryOff()), "forcing a core switch off changes nothing in the link");
}
console.log("B2 - a buy-only building");
{
  __resetKvMemo();
  const f2 = await clientFacts(env, "dubaimarina:10", "");
  ok(f2 && f2.buyOk && !f2.rentOk, "facts: the Dubai Marina building has sales and no rent index record", JSON.stringify(f2 && { r: f2.rentOk, b: f2.buyOk }));
  const D = dataOf(optionsHtml(clientConfig(f2, { key: "k" }), icon)), P = runPage(optionsHtml(clientConfig(f2, { key: "k" }), icon));
  ok(D.sections[0].options.find((o) => o.id === "rent").off && /no rent to show/.test(D.sections[0].options.find((o) => o.id === "rent").why[0]), "Rent is greyed with its reason");
  ok(params(P.rt.url().href).mode === "buy", "the default falls to Buy when only sales exist");
  const none = clientConfig({ key: "x:1", name: "Nothing", district: "D", rent: {}, buy: {}, rentOk: false, buyOk: false, photos: 0, layouts: false, amen: false }, { key: "k" });
  ok(none.stop === true && optionsHtml(none, icon).includes("class=go id=go"), "a building with neither: every choice greyed and the Generate link is marked stopped");
}

// ------------------------------------------------------------------------------------------------ C - the PDF switches
console.log("C - the new dossier switches leave today's document unchanged");
{
  const build = async (qs) => { __resetKvMemo(); return buildDocument(env, parseQuery(new URL("https://x/brief_pdf?" + qs)), { origin: "" }); };
  const base = await build("kind=dossier&keys=testdistrict:10&beds=all&mode=rent");
  ok(base.status === 200 && /AMENITIES/.test(base.html) && !/PREPARED FOR/.test(base.html), "today's link: amenities card present, no prepared-for line", base.status);
  const noA = await build("kind=dossier&keys=testdistrict:10&beds=all&mode=rent&hide=amen&client=" + encodeURIComponent("A. Buyer"));
  ok(noA.status === 200 && !/>AMENITIES</.test(noA.html) && /PREPARED FOR A\. BUYER/.test(noA.html), "hide=amen drops the amenities cards; client= adds the prepared-for line");
  ok(/Curated by Najjuko/.test(noA.html) && /\+971 56 548 4397/.test(noA.html), "the footer and the WhatsApp number stay");
  const same = await build("kind=dossier&keys=testdistrict:10&beds=all&mode=rent&hide=nonsense");
  ok(same.html === base.html, "an unknown hide token changes nothing (byte for byte)");
  const noP = await build("kind=dossier&keys=testdistrict:10&beds=all&mode=rent&hide=photos,layouts");
  ok(noP.status === 200 && noP.pages === base.pages - 1, "hiding photographs and layouts drops the third page", base.pages + " vs " + noP.pages);
  const lay = await build("kind=dossier&keys=testdistrict:10&beds=all&mode=rent&hide=layouts");
  ok(lay.status === 200 && lay.pages === base.pages && !/layouts, every type/.test(lay.html), "hiding only the layouts keeps the page and drops the table");
  ok(!EMOJI.test(noA.html), "no emoji in the dossier");
}
console.log("C2 - the broker switches");
{
  const mk = async (qs) => buildAreaPdf(env, parseParams(new URL("https://x/developers_pdf?" + qs)), { now: Date.parse("2026-10-04T08:00:00Z") });
  const plain = await mk("kind=snapshot&area=alpha&developers=omniyat&mode=buy&window=12m");
  ok(plain.status === 200 && !/Broker contact/.test(plain.html) && !/Prepared for/.test(plain.html), "today's link: no contact block, no prepared-for line", plain.status);
  const withC = await mk("kind=snapshot&area=alpha&developers=omniyat&mode=buy&window=12m&contact=1&client=" + encodeURIComponent("A. Broker Client"));
  ok(/Broker contact, to fill in/.test(withC.html) && /Prepared for A\. Broker Client/.test(withC.html) && /Remember: adverts need the permit number/.test(withC.html), "contact=1 and client= add the blank contact block and the prepared-for line; the permit reminder stays");
  ok(withC.html.replace(/<div style="font-size:10\.5px;color:#22262B;">[\s\S]*?<\/div>/, "").length > 0 && !EMOJI.test(withC.html), "no emoji");
}

// ------------------------------------------------------------------------------------------------ D - the broker options page
console.log("D - the broker options page");
const bpage = async (qs) => { const L = await loadData(env, parseParams(new URL("https://x/developers_pdf?" + qs)), {}); return L.status === 200 ? { C: L.C, html: optionsHtml(brokerConfig(L.C, { key: "client_key_123456", kind: "snapshot" }), icon) } : L; };
{
  const B = await bpage("kind=snapshot&area=alpha&developers=omniyat&mode=buy&window=12m");
  const D = dataOf(B.html), sec = (id) => D.sections.find((s) => s.id === id), opt = (s, id) => sec(s).options.find((o) => o.id === id);
  ok(["kind", "win", "mode", "area", "devs", "band", "beds", "plan", "add", "prep"].join() === D.sections.map((s) => s.id).join(), "sections: how much, window, buy or rent, area, developers, price band, bedrooms, off-plan or ready, add, prepared for");
  ok(D.core.map((c) => c.title).join("|") === "Registered facts|Evidence labels|Only confirmed projects in the numbers|Prepared for|Legal footer", "the locked core: registered facts, evidence labels, confirmed projects only, prepared for, legal footer");
  ok(opt("devs", "empty").off && /No settled sale/.test(opt("devs", "empty").why[0]) && !opt("devs", "nakheel").off, "a developer with no sale here is greyed with a reason");
  ok(opt("plan", "off").off && opt("plan", "ready").off && /handover status/.test(opt("plan", "off").why[0]), "off-plan or ready is greyed: the sales are not split by handover status");
  ok(opt("add", "nc").off && /unconfirmed/.test(opt("add", "nc").why[0]) && !opt("add", "contact").off, "the not-confirmed group is greyed with a reason; the contact block is offered");
  ok(!opt("mode", "rent").off, "rent is offered (a developer here has rent contracts)");
  ok(sec("area").options.length === 2 && sec("area").options[0].cur && /area=beta&developers=omniyat/.test(sec("area").options[1].href) && /key=client_key_123456/.test(sec("area").options[1].href), "areas: this one, and the other where the chosen developer also sells, as a link");
  const P = runPage(B.html), u0 = P.rt.url(), q0 = params(u0.href);
  ok(u0.href.startsWith("/developers_pdf?"), "Generate goes to /developers_pdf");
  ok(q0.kind === "snapshot" && q0.area === "alpha" && q0.window === "12m" && q0.mode === "buy" && q0.developers === "omniyat" && q0.key === "client_key_123456" && q0.client === PREP && !("contact" in q0) && !("min" in q0), "the default is today's snapshot link (kind, area, window, mode, developers, key) plus the prepared-for line", u0.href);
  ok(Object.keys(q0).filter((k) => !["kind", "area", "window", "mode", "developers", "key", "client"].includes(k)).length === 0, "no other parameter by default");
  pick(P.rt, "kind", "detailed"); P.rt.st.chk["devs/nakheel"] = true; P.rt.st.chk["add/contact"] = true; pick(P.rt, "band", "t1"); pick(P.rt, "beds", "2");
  const q1 = params(P.rt.url().href);
  ok(q1.kind === "detailed" && q1.developers === "omniyat,nakheel" && q1.contact === "1" && q1.basis === "sqm" && Number(q1.min) === BOUNDS[1] && Number(q1.max) === BOUNDS[0] && q1.beds === "2", "detailed, two developers, the contact block, the Upper band and 2 bedrooms are all carried", P.rt.url().href);
  pick(P.rt, "mode", "rent");
  ok(!("basis" in params(P.rt.url().href)) && !("min" in params(P.rt.url().href)), "a price band needs Buy: choosing Rent drops it");
  const Bn = await bpage("kind=snapshot&area=beta&developers=omniyat,zaya&mode=buy&window=12m");
  const Dn = dataOf(Bn.html);
  ok(Dn.sections.find((s) => s.id === "win").options.find((o) => o.id === "12m").off && /no record by year/.test(Dn.sections.find((s) => s.id === "win").options.find((o) => o.id === "12m").why[0]), "an area with no yearly record: the last 12 months is greyed with its reason");
  ok(Dn.sections.find((s) => s.id === "mode").options.find((o) => o.id === "rent").off, "an area with no rent contracts: Rent is greyed");
  ok(params(runPage(Bn.html).rt.url().href).window === "all", "and the default window becomes all years");
}

// ------------------------------------------------------------------------------------------------ E - routes and keys
console.log("E - the routes");
{
  ok((await call("/doc_client?keys=testdistrict:10")).status === 401 && (await call("/doc_broker?area=alpha&key=wrong_key_zzzzzzzz")).status === 401, "no key or a wrong key: 401 on both");
  const c = await call("/doc_client?keys=testdistrict:10&key=client_key_123456");
  const ch = await c.text();
  ok(c.status === 200 && /text\/html/.test(c.headers.get("content-type")) && c.headers.get("cache-control") === "no-store" && /noindex/.test(c.headers.get("x-robots-tag")), "/doc_client with a client key: 200 html, no-store, noindex");
  ok(ch.includes("client_key_123456") && !ch.includes("owner_key_abcdefgh") && !/READ_KEY|INGEST|GOOGLE_MAPS_KEY/.test(ch), "the page carries only the caller's own key, no other secret");
  const o = await call("/doc_client?keys=testdistrict:10&key=owner_key_abcdefgh");
  ok(o.status === 200, "the owner key opens it too");
  ok((await call("/doc_client?key=client_key_123456")).status === 400, "no building: 400");
  ok((await call("/doc_client?keys=nowhere:9&key=client_key_123456")).status === 404, "an unknown building: 404");
  const b = await call("/doc_broker?area=alpha&developers=omniyat&key=client_key_123456");
  ok(b.status === 200 && /Broker sheet: choose the version/.test(await b.text()), "/doc_broker: 200");
  ok((await call("/doc_broker?area=nowhere&key=client_key_123456")).status === 404, "an unknown area: 404");
  ok((await worker.fetch(new Request("https://azimuth-2.digitalchemy.workers.dev/doc_client?keys=testdistrict:10&key=client_key_123456", { method: "POST" }), env, { waitUntil() {} })).status === 405, "POST: 405");
}

// ------------------------------------------------------------------------------------------------ F - the page rules: no emoji, 375 px, scripts parse, buttons
console.log("F - page rules");
{
  const pages = [html1, optionsHtml(clientConfig(await clientFacts(env, "dubaimarina:10", ""), { key: "k" }), icon), (await bpage("kind=snapshot&area=alpha&developers=omniyat")).html];
  for (const [i, h] of pages.entries()) {
    const n = ["client rent", "client buy", "broker"][i];
    let parsed = true; try { new Function(scriptOf(h)); } catch (e) { parsed = false; ok(false, n + ": script parses: " + e.message); }
    ok(parsed, n + ": the page script parses");
    ok(!EMOJI.test(h), n + ": no emoji");
    ok(/<meta name="viewport" content="width=device-width,initial-scale=1">/.test(h), n + ": viewport meta");
  }
  const css = OPT_CSS + OPT_CSS_EXTRA;
  ok(/minmax\(150px,1fr\)/.test(css) && /padding:16px/.test(css) && !/[^-]width:\s*[4-9]\d\dpx|[^-]width:\s*\d{4,}px/.test(css), "375 px: two cards across (minmax 150px), 16 px gutter, no fixed width above 375");
  ok(/\.txt\{[^}]*font-size:16px/.test(css), "text boxes are 16 px so a phone does not zoom in");
  ok(/\.card\{[^}]*min-width:0/.test(css), "cards can shrink (no horizontal page scroll)");
  ok(optFrame({ title: "T", sub: "s", body: "b", script: "x" }).includes("<main><h1>T</h1><div class=sm>s</div>b</main><script>x</script>"), "the shared frame is title, subtitle, body, script");
  const dp = fs.readFileSync(new URL("../src/devmap_page.js", import.meta.url), "utf8");
  ok(dp.includes("'/doc_client?keys='") && dp.includes('.replace("/developers_pdf?","/doc_broker?")') && dp.includes("'/doc_broker?kind=building&area='") && !dp.includes("'/brief_pdf?kind=dossier&keys='"), "the Client and Broker buttons open the options pages");
  ok(dp.includes("invHref(q.id)") && dp.includes("function invHref(id){return '/developers_pdf?kind=investor_selector"), "the Investor button is unchanged");
  const ix = fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
  ok(/"\/doc_client", "\/doc_broker"\]/.test(ix) && /pathname === "\/doc_client" \|\| url\.pathname === "\/doc_broker"/.test(ix), "both routes are in the Worker and open to a client key");
}
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
