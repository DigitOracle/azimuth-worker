// v682 (Kendall, 1 Nov 2026, "build it now" after the mock-up): the BROKERS card on Najjuko's Momo - the Dubai Land Department broker
// register, searchable as she types, with licence status, contacts, where each broker lists, and her own memory of every broker.
//
// DATA (KV MEETINGS, loaded by naj-market-pulse scripts):
//   momo_brokers          gzipped JSON {v, checked, keys, rows}: every card as a row array (scripts/momo_brokers_register.py)
//   momo_brokers_meta     small JSON {checked, cards, offices, valid, expiring_30, ...}
//   momo_broker_activity  OPTIONAL JSON map card_number -> {districts: {name: count}, sale, rent, land, last_listed, portals}
//                         (scripts/momo_broker_activity.py). The card works without it; the district features switch on when it appears.
// HER MEMORY (her Work namespace, one key per broker, never a shared pick key): work_naj_brk_<card> = {fav, contacted, note, draft, at}
//   plus work_naj_brk_favs = [card, ...] so "My favourites" and the favourite-first ranking cost one read.
// ROUTES (all under /momo/work/brokers, gated by HER key exactly like the other Momo cards: deps.isNaj):
//   GET  /momo/work/brokers                      the page
//   GET  /momo/work/brokers/api?q=&district=&valid=1&gold=1&stars=4&fav=1   top 40 with a total, stats, the district list
//   GET  /momo/work/brokers/office/<real_estate_number>?district=   the office screen
//   GET  /momo/work/brokers/<card>?q=&district=  the broker screen (with the WhatsApp draft built from her search)
//   POST /momo/work/brokers/api {action:"note", card, fav?, contacted?, note?, draft?}   her memory (listed in index.js MOMO_WORK_POSTS)
// The 33k-row register is gunzipped and parsed ONCE per isolate into a module cache (REG), refreshed after 30 minutes; the activity map
// likewise after 10 minutes. Nothing here names any AI model; icons are inline SVG, never emoji.
const esc = (s) => String(s == null ? "" : s).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
export const BROKERS_ICON = '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 4.5a3 3 0 0 1 0 6"/><path d="M17.5 13.5a5 5 0 0 1 3 4.5"/><path d="m20 2 1 1.5-1 1.5"/>';

export const REG_TTL = 30 * 60e3, ACT_TTL = 10 * 60e3, PAGE_N = 40;
let REG = { at: 0, p: null }, ACT = { at: 0, p: null };
export function _resetCache() { REG = { at: 0, p: null }; ACT = { at: 0, p: null }; }

// ---- helpers ----------------------------------------------------------------------------------------------------------------------
export const dubaiToday = () => new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10);
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const dmy = (d) => { const m = String(d || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? +m[3] + " " + MON[+m[2] - 1] + " " + m[1] : ""; };
export const my = (d) => { const m = String(d || "").match(/^(\d{4})-(\d{2})/); return m ? MON[+m[2] - 1] + " " + m[1] : ""; };
const KEEP_UP = /^(LLC|L\.L\.C\.?|FZE|FZCO|FZ|LLP|PJSC|DMCC|JLT|DIFC|UAE|RE|LTD|CO|INC|II|III|IV|SPC|OPC|L\.L\.C-FZ|FZ-LLC|LLC-FZ|DWC|DSO|JVC|JVT|JBR|MBR)$/i;
export function titleCase(s) {
  return String(s || "").trim().split(/\s+/).map((w) => (KEEP_UP.test(w) || /\./.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ").replace(/\b(Al|El|Bin|Bint|Ibn)\b/g, (m) => m);
}
export const firstName = (n) => { const w = titleCase(n).split(" ").filter((x) => !/^(Mr|Mrs|Ms|Dr|Miss|Eng|Sheikh|Syed)\.?$/i.test(x)); return w[0] || ""; };
export const initials = (n) => titleCase(n).split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

// a UAE number in +971 form: "971|0506555800", "0509166543", "971|52-7207866", "+971 50 123 4567", "00971..." all become +971XXXXXXXXX
export function normPhone(v) {
  let s = String(v == null ? "" : v).trim(); if (s.includes("|")) s = s.split("|").slice(-1)[0];
  let d = s.replace(/\D/g, ""); if (d.startsWith("00")) d = d.slice(2);
  if (!d || d.length < 8 || /^0+$/.test(d)) return "";
  if (d.startsWith("971")) d = "971" + d.slice(3).replace(/^0+/, "");
  else if (d.startsWith("0")) d = "971" + d.replace(/^0+/, "");
  else if (d.length <= 9) d = "971" + d;
  if (d.length < 11 || d.length > 15) return "";
  return "+" + d;
}
export const isMobile = (p) => /^\+9715\d{8}$/.test(p);
export const waLink = (p, text) => { const d = String(p || "").replace(/\D/g, ""); return d ? "https://wa.me/" + d + (text ? "?text=" + encodeURIComponent(text) : "") : ""; };

// licence status against the Dubai date: valid / soon (within 60 days) / expired / unknown, with the day count
export function licence(exp, today) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(exp || ""))) return { state: "unknown", days: null, label: "Licence date unknown" };
  const days = Math.round((Date.parse(String(exp).slice(0, 10) + "T00:00:00Z") - Date.parse((today || dubaiToday()) + "T00:00:00Z")) / 86400e3);
  if (days < 0) return { state: "expired", days, label: "Expired " + dmy(exp) };
  if (days <= 60) return { state: "soon", days, label: "Valid to " + dmy(exp) + " · " + days + (days === 1 ? " day" : " days") };
  return { state: "valid", days, label: "Valid to " + my(exp) };
}
export const starsOf = (cri) => (cri >= 6 && cri <= 10 ? cri - 5 : 0);   // DLD card_rank_id: 5 General, 6 One Star ... 10 Five Stars
export const officeRank = (ori) => ({ 4: "Gold", 3: "Silver", 2: "Bronze" }[ori] || "");

// ---- districts: a short alias list so "JVT" finds Jumeirah Village Triangle before any listing data exists; the activity map adds its own names
export const DISTRICT_ALIAS = {
  jvt: "Jumeirah Village Triangle", jvc: "Jumeirah Village Circle", jlt: "Jumeirah Lake Towers", jbr: "Jumeirah Beach Residence", difc: "DIFC",
  dso: "Dubai Silicon Oasis", marina: "Dubai Marina", downtown: "Downtown Dubai", palm: "Palm Jumeirah", dip: "Dubai Investment Park",
  dsc: "Dubai Sports City", mbr: "Mohammed Bin Rashid City", "mbr city": "Mohammed Bin Rashid City", jge: "Jumeirah Golf Estates",
  "dubai hills": "Dubai Hills Estate", "creek harbour": "Dubai Creek Harbour", tecom: "Barsha Heights", "expo city": "Expo City Dubai",
  "business bay": "Business Bay", "al furjan": "Al Furjan", arjan: "Arjan", "damac hills": "DAMAC Hills", "damac hills 2": "DAMAC Hills 2",
  dubailand: "Dubailand", "motor city": "Motor City", "discovery gardens": "Discovery Gardens", "international city": "International City",
  "town square": "Town Square", "emaar beachfront": "Emaar Beachfront", bluewaters: "Bluewaters", "dubai islands": "Dubai Islands",
  "al barsha": "Al Barsha", "sobha hartland": "Sobha Hartland", "the greens": "The Greens", "the views": "The Views", "jumeirah park": "Jumeirah Park",
  "the springs": "The Springs", "the meadows": "The Meadows", "arabian ranches": "Arabian Ranches", mudon: "Mudon", mirdif: "Mirdif", deira: "Deira",
  "bur dubai": "Bur Dubai", "al jaddaf": "Al Jaddaf", "dubai south": "Dubai South", "dubai harbour": "Dubai Harbour", "city walk": "City Walk",
  "al quoz": "Al Quoz", "jumeirah": "Jumeirah", "umm suqeim": "Umm Suqeim", "al satwa": "Al Satwa", "nad al sheba": "Nad Al Sheba",
  "dubai production city": "Dubai Production City", impz: "Dubai Production City", "studio city": "Dubai Studio City", "sports city": "Dubai Sports City",
  "la mer": "La Mer", "al barari": "Al Barari", "the villa": "The Villa", "remraam": "Remraam", "liwan": "Liwan", "majan": "Majan", "al warsan": "Al Warsan",
  "silicon oasis": "Dubai Silicon Oasis", "lake towers": "Jumeirah Lake Towers", "village circle": "Jumeirah Village Circle", "village triangle": "Jumeirah Village Triangle",
  "beach residence": "Jumeirah Beach Residence", "dubai marina": "Dubai Marina", "palm jumeirah": "Palm Jumeirah", "downtown dubai": "Downtown Dubai",
};
export const norm = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9؀-ۿ]+/g, " ").trim();
// find a district in the typed words (longest phrase first, up to 3 words); returns {name, used:[indexes]} or null
export function findDistrict(words, known) {
  const names = Object.assign({}, DISTRICT_ALIAS); for (const k of known || []) names[norm(k)] = k;
  for (let len = 3; len >= 1; len--) for (let i = 0; i + len <= words.length; i++) {
    const ph = words.slice(i, i + len).join(" "); if (!ph) continue;
    if (names[ph]) return { name: names[ph], used: Array.from({ length: len }, (_, j) => i + j) };
    if (len >= 2 || ph.length >= 5) { const hit = Object.keys(names).find((k) => k.length >= 5 && k.startsWith(ph) && k !== ph && (k.split(" ").length === len || len >= 2)); if (hit && ph.length >= 5) return { name: names[hit], used: Array.from({ length: len }, (_, j) => i + j) }; }
  }
  return null;
}

// ---- the query: what she typed, split into what the draft needs (district, beds, type, mode, budget) and what is left for the name search
const TYPES = { villa: "villa", villas: "villa", apartment: "apartment", apartments: "apartment", apt: "apartment", flat: "apartment", townhouse: "townhouse", townhouses: "townhouse", penthouse: "penthouse", plot: "plot", plots: "plot", land: "plot", office: "office", offices: "office", shop: "shop", retail: "shop", warehouse: "warehouse", duplex: "duplex", hotel: "hotel apartment" };
const MODES = { rent: "rent", rental: "rent", rentals: "rent", renting: "rent", lease: "rent", let: "rent", tenant: "rent", sale: "sale", buy: "sale", buying: "sale", purchase: "sale", sell: "sale", selling: "sale", investor: "sale", investment: "sale", offplan: "sale" };
// a phone typed with spaces, dashes or brackets ("050 222 3333", "+971 50-222 3333") becomes one digit run before the words are split
export const squashPhones = (q) => String(q || "").replace(/\+?\d[\d\s().-]{6,}\d/g, (m) => m.replace(/\D/g, ""));
export function parseQuery(q, known) {
  let raw = squashPhones(q).replace(/(\d)\s*-\s*(bed|br|bhk)/gi, "$1 $2").replace(/\boff-plan\b/gi, "offplan");
  const out = { beds: null, type: "", mode: "", budget: null, district: "", text: [] };
  // the budget first, on the raw text, so "2.5m" keeps its decimal point (norm() would read it as 5m)
  const bm = raw.match(/(?:\baed\s*)?(\d+(?:\.\d+)?)\s*(m|mn|mil|million|k)\b/i);
  if (bm) { out.budget = Math.round(+bm[1] * (bm[2].toLowerCase() === "k" ? 1e3 : 1e6)); raw = raw.replace(bm[0], " "); }
  const words = norm(raw).split(" ").filter(Boolean), used = new Set();
  const d = findDistrict(words, known); if (d) { out.district = d.name; d.used.forEach((i) => used.add(i)); }
  for (let i = 0; i < words.length; i++) {
    if (used.has(i)) continue; const w = words[i], nx = words[i + 1] || "";
    if (w === "studio") { out.beds = 0; used.add(i); continue; }
    let m = w.match(/^(\d{1,2})(bed|beds|br|bhk|bedroom|bedrooms|b)$/); if (m && +m[1] <= 12) { out.beds = +m[1]; used.add(i); continue; }
    if (/^\d{1,2}$/.test(w) && /^(bed|beds|br|bhk|bedroom|bedrooms)$/.test(nx) && +w <= 12) { out.beds = +w; used.add(i); used.add(i + 1); continue; }
    if (TYPES[w]) { out.type = TYPES[w]; used.add(i); continue; }
    if (MODES[w]) { out.mode = MODES[w]; used.add(i); continue; }
    if (w === "aed" && /^\d/.test(nx)) { used.add(i); continue; }
    if (out.budget == null && /^\d{5,7}$/.test(w) && +w >= 10000) { out.budget = +w; used.add(i); continue; }   // 120000 typed in full (a phone is 9+ digits)
    out.text.push(phoneTok(w));
  }
  return out;
}
export const fmtAed = (n) => (n >= 1e6 ? String(Math.round(n / 1e5) / 10).replace(/\.0$/, "") + "m" : n >= 1e3 ? Math.round(n / 1e3) + "k" : String(n));
// the WhatsApp line, pre-written from what she searched; never a fixed sentence
export function draftMessage(q, district, brokerName, known) {
  const p = parseQuery(q, known), dist = district || p.district;
  const core = p.beds == null ? "" : p.beds === 0 ? "studio" : p.beds + "-bed";
  const an = (s) => (/^[aeiou]/i.test(s) ? "an " : "a ") + s;
  let what;
  if (p.mode === "rent") what = core && !p.type ? an(core + " rental") : an([core, p.type || "property"].filter(Boolean).join(" ") + " to rent");
  else if (p.mode === "sale") what = an([core, p.type || "property"].filter(Boolean).join(" ") + " to buy");
  else if (core || p.type) what = an([core, p.type || (core ? "home" : "")].filter(Boolean).join(" "));
  else what = "a property";
  const where = " in " + (dist || "Dubai");
  const money = p.budget ? " around AED " + fmtAed(p.budget) + (p.mode === "rent" ? " a year" : "") : "";
  const first = firstName(brokerName);
  return (first ? "Hi " + first + ", " : "Hello, ") + "this is Najjuko from FN Realty. I have a client looking for " + what + where + money + ". Do you have anything available?";
}

// ---- the register ---------------------------------------------------------------------------------------------------------------
async function gunzipJson(v) {
  if (v == null) return null;
  if (typeof v === "string") return JSON.parse(v);
  let u8 = new Uint8Array(v);
  if (u8.length > 2 && u8[0] === 0x1f && u8[1] === 0x8b) u8 = new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer());
  return JSON.parse(new TextDecoder().decode(u8));
}
// rows -> broker objects with a lowercase search string; also the office index
export function buildRegister(doc) {
  const keys = (doc && doc.keys) || [], rows = (doc && doc.rows) || [], ix = {}; keys.forEach((k, i) => (ix[k] = i));
  const g = (r, k) => (ix[k] == null ? "" : r[ix[k]]);
  const list = [], offices = new Map();
  for (const r of rows) {
    const b = { c: String(g(r, "c")), n: String(g(r, "n")), a: String(g(r, "a")), i: g(r, "i"), x: g(r, "x"), r: String(g(r, "r")), l: g(r, "l"), o: String(g(r, "o")), oa: String(g(r, "oa")),
      oi: g(r, "oi"), ox: g(r, "ox"), ori: +g(r, "ori") || 0, orr: g(r, "orr"), cri: +g(r, "cri") || 0, cr: g(r, "cr"), w: +g(r, "w") || 0, p: g(r, "p"), m: g(r, "m"), e: g(r, "e"), ph: g(r, "ph"), lg: +g(r, "lg") || 0 };
    b.mob = normPhone(b.m); b.tel = normPhone(b.p);
    if (b.mob && !isMobile(b.mob) && isMobile(b.tel)) { const t = b.mob; b.mob = b.tel; b.tel = t; }   // the register sometimes swaps the two
    b.s = [norm(b.n), b.a, norm(b.o), b.c, b.mob.replace(/\D/g, ""), b.tel.replace(/\D/g, ""), b.mob.slice(-9), b.tel.slice(-9), norm(b.e)].join(" ");
    list.push(b);
    if (b.r) { const o = offices.get(b.r) || { r: b.r, o: b.o, oa: b.oa, oi: b.oi, ox: b.ox, ori: b.ori, orr: b.orr, lg: b.lg, cards: [] }; o.cards.push(b.c); offices.set(b.r, o); }
  }
  const byCard = new Map(list.map((b) => [b.c, b]));
  return { checked: (doc && doc.checked) || "", list, byCard, offices };
}
export async function loadRegister(env) {
  if (REG.p && Date.now() - REG.at < REG_TTL) return REG.p;
  const at = Date.now();
  const p = (async () => { let doc = null; try { doc = await gunzipJson(await env.MEETINGS.get("momo_brokers", "arrayBuffer")); } catch (e) { doc = null; } return buildRegister(doc); })();
  REG = { at, p }; p.catch(() => { REG = { at: 0, p: null }; }); return p;
}
export async function loadActivity(env) {
  if (ACT.p && Date.now() - ACT.at < ACT_TTL) return ACT.p;
  const at = Date.now();
  const p = (async () => { try { const a = await gunzipJson(await env.MEETINGS.get("momo_broker_activity", "arrayBuffer")); return a && typeof a === "object" && !Array.isArray(a) ? a : null; } catch (e) { return null; } })();
  ACT = { at, p }; return p;
}
export async function loadMeta(env) { try { return JSON.parse(await env.MEETINGS.get("momo_brokers_meta")) || {}; } catch (e) { return {}; } }
// the district names the activity map knows, most listed first
export function activityDistricts(act) {
  const n = {}; if (act) for (const c in act) { const d = act[c] && act[c].districts; if (d) for (const k in d) n[k] = (n[k] || 0) + (+d[k] || 0); }
  return Object.keys(n).sort((a, b) => n[b] - n[a]);
}
const dKey = (d) => norm(d);
export function actIn(a, district) { if (!a || !a.districts || !district) return 0; const k = dKey(district); for (const d in a.districts) if (dKey(d) === k) return +a.districts[d] || 0; return 0; }
export const actTotal = (a) => (a && a.districts ? Object.values(a.districts).reduce((s, v) => s + (+v || 0), 0) : 0);

// ---- search + ranking -------------------------------------------------------------------------------------------------------------
export const phoneTok = (t) => (/^\d{7,}$/.test(t) ? t.replace(/^(00)?971/, "").replace(/^0/, "") : t);   // a typed number -> its local digits (what the search string holds)
export const tokenise = (q) => norm(squashPhones(q)).split(" ").filter(Boolean).map(phoneTok);
export function matches(b, toks) { for (const t of toks) if (!b.s.includes(t)) return false; return true; }
// district activity first, then favourites, then a valid licence, stars, office rank; expired last
export function rankKey(b, ctx) {
  const st = licence(b.x, ctx.today).state, a = ctx.act ? ctx.act[b.c] : null;
  return [st === "expired" ? 1 : 0, ctx.district ? -actIn(a, ctx.district) : 0, ctx.favs && ctx.favs.has(b.c) ? 0 : 1, st === "valid" || st === "soon" ? 0 : 1, -b.cri, -b.ori, -actTotal(a), b.n];
}
export const cmpKeys = (x, y) => { for (let i = 0; i < x.length; i++) { if (x[i] < y[i]) return -1; if (x[i] > y[i]) return 1; } return 0; };
export function searchBrokers(reg, act, favs, o) {
  const today = o.today || dubaiToday(), toks = o.tokens || [], district = o.district || "";
  const hit = [];
  for (const b of reg.list) {
    if (toks.length && !matches(b, toks)) continue;
    const st = licence(b.x, today).state, a = act ? act[b.c] : null;
    if (o.valid && !(st === "valid" || st === "soon")) continue;
    if (o.gold && b.ori !== 4) continue;
    if (o.stars && starsOf(b.cri) < o.stars) continue;
    if (o.fav && !(favs && favs.has(b.c))) continue;
    if (o.active && !(district ? actIn(a, district) > 0 : actTotal(a) > 0)) continue;
    hit.push(b);
  }
  const ctx = { today, act, favs, district };
  const keyed = hit.map((b) => [rankKey(b, ctx), b]); keyed.sort((x, y) => cmpKeys(x[0], y[0]));
  return { total: hit.length, items: keyed.slice(0, o.limit || PAGE_N).map((x) => x[1]) };
}

// ---- her memory -------------------------------------------------------------------------------------------------------------------
const NK = (c) => "work_naj_brk_" + String(c).replace(/[^0-9A-Za-z]/g, "");
export async function readNote(env, c) { try { return JSON.parse(await env.MEETINGS.get(NK(c))) || {}; } catch (e) { return {}; } }
export async function readFavs(env) { try { const a = JSON.parse(await env.MEETINGS.get("work_naj_brk_favs")); return new Set(Array.isArray(a) ? a.map(String) : []); } catch (e) { return new Set(); } }
export async function saveNote(env, c, patch) {
  const cur = await readNote(env, c), next = Object.assign({}, cur);
  if ("fav" in patch) next.fav = !!patch.fav;
  if ("contacted" in patch) next.contacted = patch.contacted ? (/^\d{4}-\d{2}-\d{2}$/.test(String(patch.contacted)) ? String(patch.contacted) : dubaiToday()) : "";
  if ("note" in patch) next.note = String(patch.note || "").slice(0, 600);
  if ("draft" in patch) next.draft = String(patch.draft || "").slice(0, 900);
  next.at = new Date().toISOString();
  const empty = !next.fav && !next.contacted && !next.note && !next.draft;
  if (empty) await env.MEETINGS.delete(NK(c)); else await env.MEETINGS.put(NK(c), JSON.stringify(next));
  const favs = await readFavs(env); if (next.fav) favs.add(String(c)); else favs.delete(String(c));
  await env.MEETINGS.put("work_naj_brk_favs", JSON.stringify([...favs]));
  return empty ? {} : next;
}

// ---- shaping for the page ------------------------------------------------------------------------------------------------------------
const PHOTO = "https://mobile.dubailand.gov.ae/brokerphoto/", LOGO = "https://mobile.dubailand.gov.ae/companylogos/";
export function cardOut(b, ctx) {
  const st = licence(b.x, ctx.today), a = ctx.act ? ctx.act[b.c] : null, note = (ctx.notes && ctx.notes[b.c]) || {};
  const top = a && a.districts ? Object.keys(a.districts).sort((p, q) => a.districts[q] - a.districts[p])[0] : "";
  const dName = ctx.district && actIn(a, ctx.district) ? ctx.district : top, dN = dName ? actIn(a, dName) : 0;
  const name = titleCase(b.n), draft = ctx.noDraft ? "" : draftMessage(ctx.q, ctx.district, name, ctx.known);
  return { c: b.c, n: name, a: b.a, o: titleCase(b.o), r: b.r, x: b.x, st, stars: starsOf(b.cri), cr: b.cr, orank: officeRank(b.ori), w: b.w, mob: b.mob, tel: b.tel, e: b.e, ph: b.ph ? PHOTO + b.ph : "", ini: initials(b.n),
    act: a ? { d: dName, n: dN, total: actTotal(a), last: a.last_listed || "" } : null, fav: !!note.fav, contacted: note.contacted || "", note: note.note || "", draft: note.draft || draft, draft_auto: draft, wa: b.mob ? waLink(b.mob, note.draft || draft) : "" };
}
export function detailOut(b, reg, ctx) {
  const o = cardOut(b, ctx), a = ctx.act ? ctx.act[b.c] : null, off = reg.offices.get(b.r);
  const dl = a && a.districts ? Object.keys(a.districts).map((k) => ({ d: k, n: +a.districts[k] || 0 })).sort((p, q) => q.n - p.n) : [];
  return Object.assign(o, { i: b.i, since: my(b.i), expires: dmy(b.x), l: b.l, tel_office: b.tel, districts: dl, sale: a ? +a.sale || 0 : 0, rent: a ? +a.rent || 0 : 0, land: a ? +a.land || 0 : 0, last_listed: a ? a.last_listed || "" : "", portals: a && a.portals ? a.portals : [], beds: a && a.beds ? a.beds : null, price: a && (a.price_min || a.price_max) ? [a.price_min || 0, a.price_max || 0] : null,
    office: off ? { r: off.r, o: titleCase(off.o), oa: off.oa, rank: officeRank(off.ori), n: off.cards.length, lg: off.lg ? LOGO + off.r + ".jpg" : "" } : null });
}
export function officeOut(off, reg, ctx) {
  const members = off.cards.map((c) => reg.byCard.get(c)).filter(Boolean), st = licence(off.ox, ctx.today);
  const agg = {}; let active = 0, listings = 0;
  for (const b of members) { const a = ctx.act ? ctx.act[b.c] : null; if (a && a.districts) { active++; for (const k in a.districts) { agg[k] = (agg[k] || 0) + (+a.districts[k] || 0); listings += +a.districts[k] || 0; } } }
  const keyed = members.map((b) => [rankKey(b, ctx), b]); keyed.sort((x, y) => cmpKeys(x[0], y[0]));
  const brokers = keyed.slice(0, 200).map((x) => cardOut(x[1], Object.assign({}, ctx, { noDraft: true })));
  const tel = members.map((b) => b.tel).find((t) => t && !isMobile(t)) || members.map((b) => b.tel).find(Boolean) || "";
  return { r: off.r, o: titleCase(off.o), oa: off.oa, rank: officeRank(off.ori), ini: initials(off.o), lg: off.lg ? LOGO + off.r + ".jpg" : "", since: off.oi ? String(off.oi).slice(0, 4) : "", expires: dmy(off.ox), st, n: members.length, active, listings,
    districts: Object.keys(agg).map((k) => ({ d: k, n: agg[k] })).sort((p, q) => q.n - p.n).slice(0, 12), tel, brokers };
}

// ---- the page -------------------------------------------------------------------------------------------------------------------------
const IC = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>', back: '<path d="m15 18-6-6 6-6"/>',
  wa: '<path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2.1 1-2.4c.2-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .6l-.4.6-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.7-.1l1.9.9c.3.1.5.2.5.3.1.2.1.8-.2 1.3Z"/>',
  call: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>', copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  office: '<path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>', id: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6 16a3 3 0 0 1 6 0M14 10h4M14 14h4"/>',
  map: '<path d="M12 21s-6-5.3-6-11a6 6 0 0 1 12 0c0 5.7-6 11-6 11Z"/><circle cx="12" cy="10" r="2.2"/>', note: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>', check: '<path d="M20 6 9 17l-5-5"/>', users: BROKERS_ICON, award: '<circle cx="12" cy="9" r="5"/><path d="m8.5 13.5-2 7 5.5-3 5.5 3-2-7"/>',
};
export const brokersCss = '.bk{--teal:#0A4F4A;--gold:#C5A56A;--ink:#1C2321;--mut:#5F6B66;--line:#E3DDD1;--card:#fff;--ok:#2F7A4E;--amb:#B7791F;--bad:#B4432F;--wa:#1F8F5A;--silver:#7D8790;--bronze:#9A6A43}'
  + '.bk .bar{display:flex;align-items:center;gap:10px;margin:0 0 10px}.bk .bar h1{margin:0;flex:1}.bk .stamp{font:600 .68rem "IBM Plex Mono",monospace;letter-spacing:.08em;color:#8A6F3E;text-transform:uppercase}.bk .bkb{width:34px;height:34px;border-radius:50%;border:1px solid var(--line);background:#fff;display:grid;place-items:center;cursor:pointer;color:var(--teal)}'
  + '.bk .srch{display:flex;align-items:center;gap:8px;background:#fff;border:1.5px solid var(--gold);border-radius:14px;padding:4px 10px 4px 12px;margin:0 0 10px}.bk .srch input{border:0;background:transparent;padding:9px 0;font-size:1rem;outline:none}.bk .srch input:focus{outline:none}.bk .srch button{border:0;background:transparent;color:var(--mut);cursor:pointer;padding:6px}'
  + '.bk .chips{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 10px}.bk .chip{font:500 .76rem "IBM Plex Sans",sans-serif;padding:6px 11px;border-radius:999px;border:1px solid var(--line);background:#fff;color:var(--ink);cursor:pointer}.bk .chip.on{background:var(--teal);border-color:var(--teal);color:#fff}.bk .chip.off{opacity:.45;cursor:default}'
  + '.bk .stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0 0 12px}.bk .stat{background:#fff;border:1px solid var(--line);border-radius:12px;padding:9px 6px;text-align:center}.bk .stat b{display:block;font:600 1.05rem Fraunces,serif;color:var(--teal);font-variant-numeric:tabular-nums}.bk .stat small{font-size:.66rem;color:var(--mut);line-height:1.2;display:block}'
  + '.bk .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.bk .res{background:#fff;border:1px solid var(--line);border-radius:16px;padding:10px;display:flex;flex-direction:column;gap:8px;min-width:0}.bk .res.grey{opacity:.55}.bk .res.wide{grid-column:1/-1}'
  + '.bk .who{display:flex;gap:8px;align-items:center;min-width:0;cursor:pointer}.bk .av{width:40px;height:40px;border-radius:50%;flex:none;display:grid;place-items:center;font:600 .85rem "IBM Plex Sans",sans-serif;color:#fff;background:var(--teal);overflow:hidden;position:relative}.bk .av img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.bk .av.fav{box-shadow:0 0 0 2px var(--gold)}'
  + '.bk .nm{font:600 .84rem "IBM Plex Sans",sans-serif;line-height:1.2;color:var(--ink);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.bk .of{font-size:.7rem;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
  + '.bk .meta{display:flex;flex-wrap:wrap;gap:4px}.bk .pill{display:inline-flex;align-items:center;gap:3px;font-size:.66rem;padding:2px 7px;border-radius:999px;background:#F3EEE4;color:var(--ink);white-space:nowrap}.bk .pill.ok{background:transparent;border:1px solid var(--ok);color:var(--ok)}.bk .pill.amb{background:transparent;border:1px solid var(--amb);color:var(--amb)}.bk .pill.bad{background:transparent;border:1px solid var(--bad);color:var(--bad)}.bk .pill.gold{background:transparent;border:1px solid var(--gold);color:#8A6F3E}.bk .pill.silver{background:transparent;border:1px solid var(--silver);color:var(--silver)}.bk .pill.bronze{background:transparent;border:1px solid var(--bronze);color:var(--bronze)}.bk .pill.act{background:var(--teal);color:#fff}'
  + '.bk .btns{display:grid;grid-template-columns:1fr 1fr;gap:6px}.bk .btn{display:flex;align-items:center;justify-content:center;gap:5px;border-radius:11px;padding:9px 6px;font:600 .78rem "IBM Plex Sans",sans-serif;border:1px solid var(--line);background:#fff;color:var(--teal);text-decoration:none;cursor:pointer}.bk .btn.wa{background:var(--wa);border-color:var(--wa);color:#fff}.bk .btn.dis{opacity:.4;pointer-events:none}.bk .big .btn{padding:13px;font-size:.92rem}'
  + '.bk .num{display:flex;justify-content:space-between;align-items:center;gap:6px;font-size:.74rem;color:var(--mut);min-width:0}.bk .num span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bk .cp{flex:none;font:500 .68rem "IBM Plex Sans",sans-serif;color:var(--teal);border:1px solid var(--line);border-radius:8px;padding:3px 8px;background:#fff;cursor:pointer;display:inline-flex;gap:3px;align-items:center}.bk .cp.ok{background:var(--teal);color:#fff;border-color:var(--teal)}'
  + '.bk .hero{display:flex;flex-direction:column;align-items:center;gap:5px;text-align:center;margin:0 0 12px}.bk .hero .av{width:76px;height:76px;font-size:1.35rem}.bk .hero .nm{font-size:1.15rem;font-family:Fraunces,serif;-webkit-line-clamp:3}.bk .ar{font-size:.95rem;color:var(--mut);direction:rtl}'
  + '.bk .sec{background:#fff;border:1px solid var(--line);border-radius:16px;padding:12px;display:flex;flex-direction:column;gap:8px;margin:0 0 10px}.bk .sec h3{margin:0;display:flex;align-items:center;gap:6px;font:600 .7rem "IBM Plex Mono",monospace;letter-spacing:.08em;text-transform:uppercase;color:#8A6F3E}.bk .sec h3 svg{color:var(--gold)}'
  + '.bk .kv{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.bk .kv div{background:#FAF7F1;border-radius:10px;padding:8px 10px}.bk .kv small{display:block;font-size:.66rem;color:var(--mut)}.bk .kv b{font-size:.86rem;font-weight:600}'
  + '.bk .drow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;align-items:center;font-size:.82rem}.bk .track{grid-column:1/-1;height:6px;border-radius:6px;background:#EEE8DD;overflow:hidden}.bk .track i{display:block;height:100%;background:var(--gold)}.bk .mutd{font-size:.74rem;color:var(--mut)}'
  + '.bk textarea.draft{min-height:112px;font-size:.9rem;line-height:1.4}.bk .saved{font-size:.7rem;color:var(--ok);min-height:1em}.bk .mine{display:flex;gap:6px;flex-wrap:wrap}.bk .notebox{background:#FAF7F1;border-radius:12px;padding:8px 10px;font-size:.84rem;white-space:pre-wrap}'
  + '.bk .team{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.bk .mate{background:#fff;border:1px solid var(--line);border-radius:14px;padding:10px;display:flex;flex-direction:column;gap:5px;align-items:flex-start;cursor:pointer}.bk .mate .av{width:34px;height:34px;font-size:.72rem}.bk .mate b{font-size:.8rem;line-height:1.2}.bk .mate small{font-size:.68rem;color:var(--mut)}'
  + '.bk .empty{text-align:center;color:var(--mut);padding:34px 12px;border:1px dashed var(--line);border-radius:16px}.bk .more{display:block;width:100%;margin:10px 0 0}.bk .toast{position:fixed;left:50%;bottom:92px;transform:translateX(-50%);background:var(--teal);color:#fff;padding:10px 16px;border-radius:999px;font-size:.84rem;opacity:0;transition:opacity .2s;pointer-events:none;z-index:60}.bk .toast.on{opacity:1}.bk .toast.bad{background:var(--bad)}.bk .view{display:none}.bk .view.on{display:block}.bk .starbtn{background:transparent;border:0;cursor:pointer;color:var(--line)}.bk .starbtn.on{color:var(--gold)}';
const svg = (d, n, fill) => '<svg viewBox="0 0 24 24" width=' + (n || 16) + ' height=' + (n || 16) + ' fill="' + (fill ? "currentColor" : "none") + '" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden=true>' + d + "</svg>";
export const BROKERS_JS = String.raw`(function(){var IC=__IC__,KEY=__KEY__,Q0="",STATE={q:"",district:"",valid:0,gold:0,stars:0,fav:0,active:0,limit:40},ACT=false,KNOWN=[],CUR=null,T=null;
function E(i){return document.getElementById(i)}function H(s){return String(s==null?"":s).replace(/[<>&"]/g,function(c){return{"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;"}[c]})}
function svg(d,n,f){return '<svg viewBox="0 0 24 24" width='+(n||16)+' height='+(n||16)+' fill="'+(f?"currentColor":"none")+'" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+d+"</svg>"}
function toast(m,bad){var t=E("bk_toast");t.textContent=m;t.className="toast on"+(bad?" bad":"");clearTimeout(T);T=setTimeout(function(){t.className="toast"},1800)}
function api(path,opt){return fetch("/momo/work/brokers"+path+(path.indexOf("?")<0?"?":"&")+"key="+encodeURIComponent(KEY),opt||{}).then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json()})}
function show(v){["s","b","o"].forEach(function(k){E("bk_v"+k).classList.toggle("on",k===v)});window.scrollTo(0,0)}
function pillSt(st){return st.state==="expired"?'<span class="pill bad">'+H(st.label)+'</span>':st.state==="soon"?'<span class="pill amb">'+H(st.label)+'</span>':st.state==="valid"?'<span class="pill ok">'+H(st.label)+'</span>':""}
function pillRank(r){return r?'<span class="pill '+r.toLowerCase()+'">'+r+' office</span>':""}
function stars(n,cr){return n?'<span class=pill>'+svg(IC.star,11,true)+' '+H(cr)+'</span>':""}
function av(x,big){return '<div class="av'+(x.fav?" fav":"")+'">'+H(x.ini)+(x.ph?'<img loading=lazy src="'+H(x.ph)+'" alt="" onerror="this.remove()">':"")+'</div>'}
function copyBtn(v){return v?'<button class=cp type=button data-c="'+H(v)+'">'+svg(IC.copy,11)+' Copy</button>':""}
function numRow(lbl,v){return v?'<div class=num><span>'+(lbl?lbl+" ":"")+H(v)+'</span>'+copyBtn(v)+'</div>':""}
function wired(root){root.querySelectorAll(".cp").forEach(function(b){b.onclick=function(ev){ev.stopPropagation();var v=b.dataset.c;var done=function(){b.classList.add("ok");b.innerHTML=svg(IC.check,11)+" Copied";setTimeout(function(){b.classList.remove("ok");b.innerHTML=svg(IC.copy,11)+" Copy"},1500)};
if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(v).then(done,function(){prompt("Copy:",v)});else prompt("Copy:",v)}});
root.querySelectorAll("[data-open]").forEach(function(b){b.onclick=function(ev){ev.stopPropagation();openBroker(b.dataset.open)}});root.querySelectorAll("[data-office]").forEach(function(b){b.onclick=function(ev){ev.stopPropagation();openOffice(b.dataset.office)}});
root.querySelectorAll("[data-contact]").forEach(function(a){a.addEventListener("click",function(){mark(a.dataset.contact)})})}
function mark(c){api("/api",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"note",card:c,contacted:true})}).then(function(){if(CUR&&CUR.c===c){CUR.contacted=todayD();var el=E("bk_contacted");if(el){el.classList.add("on");el.textContent="Contacted "+dmy(CUR.contacted)}}}).catch(function(){})}
function todayD(){return new Date(Date.now()+4*3600e3).toISOString().slice(0,10)}var MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];function dmy(d){var m=String(d||"").match(/^(\d{4})-(\d{2})-(\d{2})/);return m?(+m[3])+" "+MON[+m[2]-1]+" "+m[1]:""}
function resCard(x){var g=x.st.state==="expired";var act=x.act&&x.act.n?'<span class="pill act">Active in '+H(x.act.d)+' · '+x.act.n+(x.act.n===1?" listing":" listings")+'</span>':"";
return '<div class="res'+(g?" grey":"")+'" data-card="'+H(x.c)+'"><div class=who data-open="'+H(x.c)+'">'+av(x)+'<div style="min-width:0"><div class=nm>'+H(x.n)+'</div><div class=of>'+H(x.o)+'</div></div></div><div class=meta>'+act+pillSt(x.st)+stars(x.stars,x.cr)+pillRank(x.orank)+'</div>'
+'<div class=btns><a class="btn wa'+(x.wa?"":" dis")+'" href="'+H(x.wa||"#")+'" target=_blank rel=noopener data-contact="'+H(x.c)+'">'+svg(IC.wa,14,true)+'WhatsApp</a><a class="btn'+(x.mob||x.tel?"":" dis")+'" href="tel:'+H(x.mob||x.tel)+'" data-contact="'+H(x.c)+'">'+svg(IC.call,13)+'Call</a></div>'+numRow("",x.mob||x.tel)+'</div>'}
function draw(d){var box=E("bk_list");KNOWN=d.districts||[];ACT=!!d.activity;E("bk_stamp").textContent=d.checked?"Checked "+dmy(d.checked):"";
E("bk_s1").innerHTML="<b>"+(d.stats.licensed||0).toLocaleString("en")+"</b><small>licensed brokers</small>";
E("bk_s2").innerHTML=ACT?"<b>"+(d.stats.active||0).toLocaleString("en")+"</b><small>active in "+H(d.stats.district||"Dubai")+" this week</small>":"<b>&ndash;</b><small>listing activity not loaded yet</small>";
E("bk_s3").innerHTML="<b>"+(d.stats.expiring||0).toLocaleString("en")+"</b><small>cards expire in 30 days</small>";
var ca=E("bk_c_active");ca.classList.toggle("off",!ACT);ca.textContent=d.district?"Active in "+d.district:"Active this week";E("bk_c_fav").classList.toggle("on",!!STATE.fav);
if(!d.items.length){box.innerHTML='<div class=empty><b>No broker found</b><br><span class=mutd>Try a name, an office, a card number, a phone number or a district.</span></div>';E("bk_total").textContent="";return}
box.innerHTML='<div class=grid>'+d.items.map(resCard).join("")+'</div>'+(d.total>d.items.length?'<button class="ghost more" id=bk_more type=button>Show more of '+d.total.toLocaleString("en")+'</button>':"");
E("bk_total").textContent=d.total.toLocaleString("en")+(d.total===1?" broker":" brokers")+(d.district?" · "+d.district:"");wired(box);var m=E("bk_more");if(m)m.onclick=function(){STATE.limit+=40;load()}}
var seq=0;function load(){var my=++seq,p="/api?q="+encodeURIComponent(STATE.q)+"&district="+encodeURIComponent(STATE.district)+"&valid="+STATE.valid+"&gold="+STATE.gold+"&stars="+STATE.stars+"&fav="+STATE.fav+"&active="+STATE.active+"&limit="+STATE.limit;
api(p).then(function(d){if(my!==seq)return;if(d.district&&!STATE.district)d.district=d.district;draw(d)}).catch(function(e){if(my===seq)toast("Could not load brokers",true)})}
var deb=null;E("bk_q").oninput=function(){STATE.q=E("bk_q").value;STATE.limit=40;clearTimeout(deb);deb=setTimeout(load,180)};E("bk_clear").onclick=function(){E("bk_q").value="";STATE.q="";STATE.limit=40;load();E("bk_q").focus()};
[["bk_c_active","active"],["bk_c_valid","valid"],["bk_c_gold","gold"],["bk_c_stars","stars"],["bk_c_fav","fav"]].forEach(function(p){var el=E(p[0]);el.onclick=function(){if(el.classList.contains("off"))return;var on=!el.classList.contains("on");el.classList.toggle("on",on);STATE[p[1]]=on?(p[1]==="stars"?4:1):0;STATE.limit=40;load()}});
function openBroker(c){api("/"+encodeURIComponent(c)+"?q="+encodeURIComponent(STATE.q)+"&district="+encodeURIComponent(STATE.district)).then(function(x){CUR=x;drawBroker(x);show("b")}).catch(function(){toast("Could not open this broker",true)})}
function bar(t,n,max){return '<div class=drow><span>'+H(t)+'</span><b>'+n+'</b><span class=track><i style="width:'+Math.max(4,Math.round(100*n/(max||1)))+'%"></i></span></div>'}
function drawBroker(x){var ph=x.mob||x.tel;var lists=x.districts&&x.districts.length?'<div>'+x.districts.slice(0,8).map(function(d){return bar(d.d,d.n,x.districts[0].n)}).join("")+'</div><div class=meta>'+(x.rent||x.sale?'<span class=pill>For rent '+x.rent+' · for sale '+x.sale+'</span>':"")+(x.land?'<span class=pill>Land '+x.land+'</span>':"")+'</div>'+(x.last_listed?'<div class=mutd>Last listed '+H(dmy(x.last_listed)||x.last_listed)+'. From portal listings matched to this licence.</div>':""):'<div class=mutd>No listing activity found yet.</div>';
E("bk_vb").innerHTML='<div class=bar><button class=bkb id=bk_back1 type=button aria-label="Back">'+svg(IC.back,14)+'</button><h1 style="font-size:1.2rem">Broker</h1><button class="starbtn'+(x.fav?" on":"")+'" id=bk_fav type=button aria-label="Favourite">'+svg(IC.star,24,true)+'</button></div>'
+'<div class=hero>'+av(x,1)+'<div class=nm>'+H(x.n)+'</div>'+(x.a?'<div class=ar>'+H(x.a)+'</div>':"")+'<div class=meta style="justify-content:center">'+stars(x.stars,x.cr)+pillSt(x.st)+pillRank(x.orank)+'</div></div>'
+'<div class=sec><h3>'+svg(IC.wa,13,true)+' Your message</h3><textarea class=draft id=bk_draft>'+H(x.draft)+'</textarea><div class=num><span class=saved id=bk_dsaved></span><button class=cp id=bk_dreset type=button>Rewrite from my search</button></div>'
+'<div class="btns big"><a class="btn wa'+(x.mob?"":" dis")+'" id=bk_wa href="'+H(x.wa||"#")+'" target=_blank rel=noopener data-contact="'+H(x.c)+'">'+svg(IC.wa,16,true)+'WhatsApp</a><a class="btn'+(ph?"":" dis")+'" href="tel:'+H(ph)+'" data-contact="'+H(x.c)+'">'+svg(IC.call,15)+'Call</a></div></div>'
+'<div class=sec><h3>'+svg(IC.call,13)+' Contact</h3>'+numRow("Mobile",x.mob)+numRow("Office",x.tel_office&&x.tel_office!==x.mob?x.tel_office:"")+numRow("",x.e)+(!x.mob&&!x.tel&&!x.e?'<div class=mutd>No contact on the register.</div>':"")+'</div>'
+'<div class=sec><h3>'+svg(IC.id,13)+' Licence</h3><div class=kv><div><small>Card number</small><b>'+H(x.c)+'</b></div><div><small>Licensed since</small><b>'+H(x.since||"Not stated")+'</b></div><div><small>Expires</small><b>'+H(x.expires||"Not stated")+(x.st.days!=null&&x.st.days>=0?' <span class=mutd>('+x.st.days+' days)</span>':"")+'</b></div><div><small>Awards</small><b>'+(x.w?x.w:"None")+'</b></div></div></div>'
+'<div class=sec><h3>'+svg(IC.map,13)+' Where '+(x.n?"they list":"")+'</h3>'+lists+'</div>'
+(x.office?'<div class=sec><h3>'+svg(IC.office,13)+' Office</h3><div class=who data-office="'+H(x.office.r)+'"><div class=av style="background:#8A6F3E">'+H((x.office.o||"").split(" ").slice(0,2).map(function(w){return w[0]}).join("").toUpperCase())+(x.office.lg?'<img loading=lazy src="'+H(x.office.lg)+'" alt="" onerror="this.remove()">':"")+'</div><div style="min-width:0"><div class=nm>'+H(x.office.o)+'</div><div class=of>'+(x.office.rank?x.office.rank+" · ":"")+x.office.n+(x.office.n===1?" broker":" brokers")+' at this office · open</div></div></div></div>':"")
+'<div class=sec><h3>'+svg(IC.note,13)+' My notes</h3><div class=mine><button class="chip'+(x.fav?" on":"")+'" id=bk_favc type=button>Favourite</button><button class="chip'+(x.contacted?" on":"")+'" id=bk_contacted type=button>'+(x.contacted?"Contacted "+dmy(x.contacted):"Mark contacted")+'</button></div><textarea id=bk_note placeholder="A private note, only you see it">'+H(x.note)+'</textarea><div class=num><span class=saved id=bk_nsaved></span><button class=cp id=bk_nsave type=button>Save note</button></div></div>';
var root=E("bk_vb");wired(root);E("bk_back1").onclick=function(){show("s")};
var fav=function(){var on=!CUR.fav;CUR.fav=on;E("bk_fav").classList.toggle("on",on);E("bk_favc").classList.toggle("on",on);root.querySelector(".hero .av").classList.toggle("fav",on);save({fav:on},function(){toast(on?"Added to your favourites":"Removed from favourites")})};E("bk_fav").onclick=fav;E("bk_favc").onclick=fav;
E("bk_contacted").onclick=function(){var on=!CUR.contacted;CUR.contacted=on?todayD():"";E("bk_contacted").classList.toggle("on",on);E("bk_contacted").textContent=on?"Contacted "+dmy(CUR.contacted):"Mark contacted";save({contacted:on})};
E("bk_nsave").onclick=function(){save({note:E("bk_note").value},function(){E("bk_nsaved").textContent="Saved";setTimeout(function(){E("bk_nsaved").textContent=""},1800)})};
var dt=null;E("bk_draft").oninput=function(){var v=E("bk_draft").value;CUR.draft=v;E("bk_wa").href=CUR.mob?"https://wa.me/"+CUR.mob.replace(/\D/g,"")+"?text="+encodeURIComponent(v):"#";clearTimeout(dt);dt=setTimeout(function(){save({draft:v===CUR.draft_auto?"":v},function(){E("bk_dsaved").textContent="Saved for "+(CUR.n.split(" ")[0]||"this broker");setTimeout(function(){E("bk_dsaved").textContent=""},1800)})},700)};
E("bk_dreset").onclick=function(){E("bk_draft").value=CUR.draft_auto;E("bk_draft").oninput()}}
function save(patch,then){if(!CUR)return;patch.action="note";patch.card=CUR.c;api("/api",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(patch)}).then(function(){if(then)then()}).catch(function(){toast("Not saved - check the connection",true)})}
function openOffice(r){api("/office/"+encodeURIComponent(r)+"?district="+encodeURIComponent(STATE.district)).then(function(o){drawOffice(o);show("o")}).catch(function(){toast("Could not open this office",true)})}
function drawOffice(o){var lists=o.districts.length?'<div>'+o.districts.slice(0,8).map(function(d){return bar(d.d,d.n,o.districts[0].n)}).join("")+'</div>':'<div class=mutd>No listing activity found yet.</div>';
E("bk_vo").innerHTML='<div class=bar><button class=bkb id=bk_back2 type=button aria-label="Back">'+svg(IC.back,14)+'</button><h1 style="font-size:1.2rem">Office</h1></div>'
+'<div class=hero><div class=av style="background:#8A6F3E">'+H(o.ini)+(o.lg?'<img loading=lazy src="'+H(o.lg)+'" alt="" onerror="this.remove()">':"")+'</div><div class=nm>'+H(o.o)+'</div>'+(o.oa?'<div class=ar>'+H(o.oa)+'</div>':"")+'<div class=meta style="justify-content:center">'+pillRank(o.rank)+pillSt(o.st)+'</div></div>'
+'<div class="btns big"><a class="btn'+(o.tel?"":" dis")+'" href="tel:'+H(o.tel)+'">'+svg(IC.call,15)+'Call office</a>'+(o.tel?'<div class=num><span>'+H(o.tel)+'</span>'+copyBtn(o.tel)+'</div>':'<div class=mutd>No office line on the register.</div>')+'</div>'
+'<div class=sec><h3>'+svg(IC.office,13)+' Office</h3><div class=kv><div><small>Brokers</small><b>'+o.n+'</b></div><div><small>Licensed since</small><b>'+H(o.since||"Not stated")+'</b></div><div><small>Active this week</small><b>'+(ACT?o.active+(o.active===1?" broker":" brokers"):"&ndash;")+'</b></div><div><small>Listings this week</small><b>'+(ACT?o.listings:"&ndash;")+'</b></div><div><small>Licence expires</small><b>'+H(o.expires||"Not stated")+'</b></div><div><small>Licence number</small><b>'+H(o.r)+'</b></div></div></div>'
+'<div class=sec><h3>'+svg(IC.map,13)+' Where the office lists</h3>'+lists+'</div>'
+'<div class=sec><h3>'+svg(IC.users,13)+' Brokers here'+(STATE.district&&ACT?" · most active in "+H(STATE.district)+" first":"")+'</h3><div class=team>'+o.brokers.map(function(x){return '<div class=mate data-open="'+H(x.c)+'">'+av(x)+'<b>'+H(x.n)+'</b><small>'+[x.act&&x.act.n?H(x.act.d)+" "+x.act.n:"",x.stars?H(x.cr):"",x.st.state==="expired"?"Expired":x.st.state==="soon"?"Expires soon":""].filter(Boolean).join(" · ")+'</small></div>'}).join("")+'</div></div>';
var root=E("bk_vo");wired(root);E("bk_back2").onclick=function(){show(CUR?"b":"s")}}
load()})()`;
export function brokersBody(key, rk, meta) {
  const q = "?key=" + encodeURIComponent(key) + (rk ? "&rk=" + encodeURIComponent(rk) : "");
  return '<div class=bk><div class="view on" id=bk_vs><a class=back href="/momo' + q + '">&#8592; Momo</a><div class=tag>MOMO</div><div class=bar><h1>Brokers</h1><span class=stamp id=bk_stamp>' + (meta && meta.checked ? "Checked " + esc(dmy(meta.checked)) : "") + '</span></div>'
    + '<div class=srch>' + svg(IC.search, 18) + '<input id=bk_q type=search autocomplete=off autocapitalize=off spellcheck=false placeholder="Name, office, card, phone or district" aria-label="Search brokers"><button id=bk_clear type=button aria-label="Clear">' + svg(IC.x, 16) + '</button></div>'
    + '<div class=chips><button class="chip off" id=bk_c_active type=button>Active this week</button><button class=chip id=bk_c_valid type=button>Valid licence</button><button class=chip id=bk_c_gold type=button>Gold office</button><button class=chip id=bk_c_stars type=button>4+ stars</button><button class=chip id=bk_c_fav type=button>My favourites</button></div>'
    + '<div class=stats><div class=stat id=bk_s1><b>' + (meta && meta.cards ? Number(meta.cards).toLocaleString("en") : "&ndash;") + '</b><small>licensed brokers</small></div><div class=stat id=bk_s2><b>&ndash;</b><small>active this week</small></div><div class=stat id=bk_s3><b>' + (meta && meta.expiring_30 != null ? Number(meta.expiring_30).toLocaleString("en") : "&ndash;") + '</b><small>cards expire in 30 days</small></div></div>'
    + '<div class=mutd id=bk_total style="margin:0 0 8px"></div><div id=bk_list><div class=empty>Loading the register</div></div><div class=mutd style="margin-top:14px">Source: the Dubai Land Department public broker register. Listing activity comes from portal adverts matched to a licence; a broker without a match shows "No listing activity found yet", not zero.</div></div>'
    + '<div class=view id=bk_vb></div><div class=view id=bk_vo></div><div class=toast id=bk_toast></div></div>'
    + '<style>' + brokersCss + '</style><script>' + BROKERS_JS.replace("__IC__", JSON.stringify(IC)).replace("__KEY__", JSON.stringify(key)) + '</script>';
}

// ---- the route ----------------------------------------------------------------------------------------------------------------------
export async function brokersRoute(request, env, url, deps) {
  const p = url.pathname, key = url.searchParams.get("key") || "", rk = url.searchParams.get("rk") || "";
  if (!(typeof deps.isNaj === "function" && deps.isNaj(env, url))) return new Response("unauthorized", { status: 401 });   // HER key only, like every Momo route
  const J = (o, s) => new Response(JSON.stringify(o), { status: s || 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
  if (p === "/momo/work/brokers" && request.method === "GET") {
    return new Response(deps.page(key, rk, brokersBody(key, rk, await loadMeta(env))), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
  }
  if (p === "/momo/work/brokers/api" && request.method === "POST") {
    let b = {}; try { b = await request.json(); } catch (e) { return J({ ok: false, error: "json body required" }, 400); }
    if (b.action !== "note") return J({ ok: false, error: "unknown action" }, 400);
    const card = String(b.card || "").replace(/[^0-9A-Za-z]/g, ""); if (!card) return J({ ok: false, error: "card required" }, 400);
    const reg = await loadRegister(env); if (!reg.byCard.has(card)) return J({ ok: false, error: "no such broker" }, 404);
    const patch = {}; for (const k of ["fav", "contacted", "note", "draft"]) if (k in b) patch[k] = b[k];
    return J({ ok: true, card, note: await saveNote(env, card, patch) });
  }
  if (request.method !== "GET") return new Response("not found", { status: 404 });
  const today = deps.today || dubaiToday();
  const [reg, act, favs] = await Promise.all([loadRegister(env), loadActivity(env), readFavs(env)]);
  if (!reg.list.length) return J({ ok: false, error: "register not loaded", total: 0, items: [], stats: { licensed: 0 }, activity: false, districts: [], checked: "" }, 503);
  const known = activityDistricts(act), q = url.searchParams.get("q") || "";
  if (p === "/momo/work/brokers/api") {
    const parsed = parseQuery(q, known), district = url.searchParams.get("district") || parsed.district;
    const o = { tokens: parsed.text, district, today, valid: url.searchParams.get("valid") === "1", gold: url.searchParams.get("gold") === "1", stars: +url.searchParams.get("stars") || 0, fav: url.searchParams.get("fav") === "1", active: url.searchParams.get("active") === "1", limit: Math.min(200, Math.max(1, +url.searchParams.get("limit") || PAGE_N)) };
    const r = searchBrokers(reg, act, favs, o);
    const notes = {}; await Promise.all(r.items.map(async (b) => { notes[b.c] = await readNote(env, b.c); }));
    let expiring = 0, active = 0; for (const b of reg.list) { const st = licence(b.x, today); if (st.state !== "expired" && st.days != null && st.days <= 30) expiring++; const a = act ? act[b.c] : null; if (a && (district ? actIn(a, district) > 0 : actTotal(a) > 0)) active++; }
    const ctx = { today, act, notes, q, district, known };
    return J({ ok: true, total: r.total, items: r.items.map((b) => cardOut(b, ctx)), district, parsed: { beds: parsed.beds, type: parsed.type, mode: parsed.mode, budget: parsed.budget }, activity: !!act, districts: known.slice(0, 60), checked: reg.checked, stats: { licensed: reg.list.length, active: act ? active : null, district: district || "", expiring } });
  }
  let m = p.match(/^\/momo\/work\/brokers\/office\/([0-9A-Za-z]{1,12})$/);
  if (m) {
    const off = reg.offices.get(m[1]); if (!off) return J({ ok: false, error: "no such office" }, 404);
    const district = url.searchParams.get("district") || "";
    return J(Object.assign({ ok: true }, officeOut(off, reg, { today, act, favs, district, notes: {}, known })));
  }
  m = p.match(/^\/momo\/work\/brokers\/([0-9A-Za-z]{1,12})$/);
  if (m) {
    const b = reg.byCard.get(m[1]); if (!b) return J({ ok: false, error: "no such broker" }, 404);
    const district = url.searchParams.get("district") || parseQuery(q, known).district, notes = {}; notes[b.c] = await readNote(env, b.c);
    return J(Object.assign({ ok: true }, detailOut(b, reg, { today, act, notes, q, district, known })));
  }
  return new Response("not found", { status: 404 });
}
