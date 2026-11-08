// v799 - MOMO "NEW LAUNCHES" (Kendall, 7 Nov 2026), for Kendall and Najjuko. Reads the same snapshot the 05:00 feed reads (KV img_launches,
// written by the 04:00 refresh from the announced projects layer): one store, two views. Light cream, 2-up cards, icons not emojis. Each card:
// project, developer, area, from AED (as advertised), unit types, plan, handover, a confidence chip, sources count, last seen, links.
// Filters (v802): This week / All / Filter (a sheet: developer, Dubai 2040 zone, sort) / Reset; first 20, then Show more.
// v811 (Kendall 8 Nov 2026, "Go ahead"): truthful launches. One card per project (name variants merged), the launch date by its basis
// ("Launched 13 Aug 2026 · 448 sold", "Launched 2 Feb (Khaleej Times)", "Launch date unknown") and a status pill (EOI / allocation pending,
// Coming soon, Just launched, Selling with % sold, Nearly sold out) on every card; sorted by launch_date, not first_seen. Tabs This week /
// Hot this month (off-plan register sales, last 30 days) / Coming soon / All; Filter: developer, Area (register area and district: the
// Dubai 2040 zone stays in the data, off the filter), launch dates (last 30 days / 4 months / 12 months / custom), sort. Nothing here is for a client sheet: prices are as advertised until the developer's sheet confirms.

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const svg = (d, s) => '<svg viewBox="0 0 24 24" width="' + (s || 14) + '" height="' + (s || 14) + '" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + "</svg>";
export const LAUNCH_ICONS = {
  launch: '<path d="M4 20l4-1 9-9a2.8 2.8 0 0 0-4-4l-9 9-1 4z"/><path d="M13.5 6.5l4 4"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
  bed: '<path d="M3 18V8M3 14h18v4M21 14v-3a3 3 0 0 0-3-3h-7v6"/>',
  plan: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  zone: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  size: '<path d="M3 21L21 3M3 21h6M3 21v-6M21 3h-6M21 3v6"/>',
  pdf: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M12 10v7M9 14l3 3 3-3"/>',
  wa: '<path d="M4 20l1.5-4.5A8 8 0 1 1 9 19z"/><path d="M9.5 9.5c.5 2 2 3.5 4 4"/>',
  report: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
};
const nf = (v) => Math.round(Number(v) || 0).toLocaleString("en-US");
const ago = (iso, today) => { const d = Math.round((Date.parse(today) - Date.parse(iso)) / 86400000); return isNaN(d) ? "" : d <= 0 ? "today" : d === 1 ? "yesterday" : d + " days ago"; };

// Kendall 7 Nov (on the 375 px preview): a picture on every card (the newest video's thumbnail, tap = open the video; an Instagram
// picture copied into KV; else the developer's initial), small "Image: <channel>" credit; only cards with an area or a starting price;
// registered launches too, one card per project, with a status chip; filter by Dubai 2040 zone.
import { safePic, tidyLaunches, launchStatus, launchSay, salesTo } from "./launch_report.js";   // v800 - only our own face-checked picture copies are ever shown (Kendall 7 Nov: no faces)
const shown = (r) => r && r.project && (r.area || r.from_aed);
const mq = (u) => String(u || "").replace("/hqdefault.jpg", "/mqdefault.jpg");
const seenOn = (k) => (k || []).filter((x) => x === "youtube" || x === "instagram" || x === "news").map((x) => x === "youtube" ? "YouTube" : x === "instagram" ? "Instagram" : "the news");

// v802 (Kendall 7 Nov 2026, "Yes, push all of this"): the price as a short headline (AED 2.85M), the status chip only (the confidence
// stays in the data, off the card), the picture credit as small text on the picture's bottom edge, a gold "New" badge for a launch first
// seen in the last 24 hours, PDF and WhatsApp as two small icon buttons in one row.
// WRONG PICTURES (Kendall 7 Nov: a Meraas masterplan aerial was on "Bluewaters Residences" and on "Overall"): a picture shows only when
// it belongs to that exact project - (1) the same picture on two different projects is a developer's generic image, so it is shown on
// neither; (2) a picture taken from a web page (not a video or a post) shows only when the page address carries the project's own name.
// The 04:00 job applies the same two rules before the snapshot is written (announced_social.py snapshot, launch_media.py enrich).
export const aedShort = (v) => { v = Number(v); if (!v) return ""; return v >= 1e6 ? "AED " + String(+(v / 1e6).toFixed(2)) + "M" : "AED " + Math.round(v / 1e3) + "K"; };
const PIC_STOP = new Set(["residences", "residence", "tower", "towers", "villas", "villa", "dubai", "apartments", "homes", "estates", "gardens", "park", "views", "phase", "the", "and", "city", "hills", "community", "project", "projects", "portfolio", "html", "php", "aspx"]);
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
export function picBelongs(r) {
  const link = String((r && r.pic_link) || "");
  if (!link || /youtube\.com|youtu\.be|instagram\.com/.test(link)) return true;   // a frame of the project's own video, or its own post
  let segs = []; try { segs = decodeURIComponent(new URL(link).pathname).split("/").filter((x) => x && !/^\d+$/.test(x) && !/^(en|ar)$/i.test(x)); } catch (e) { return false; }
  const last = norm(segs[segs.length - 1] || ""), path = last.replace(/ /g, "");
  const dev = new Set(norm(r.developer).split(" ")), full = new Set(norm(r.project).split(" "));
  // the page address names the project ("Binghatti Pinnacle Al Jaddaf" -> binghatti-pinnacle) ...
  const toks = norm(String(r.project || "").split(/\s+(?:at|by|in)\s+|\s+-\s+|,|\(/i)[0]).split(" ").filter((t) => t.length >= 4 && !PIC_STOP.has(t) && !dev.has(t));
  if (toks.length && !toks.some((t) => path.includes(t))) return false;
  // ... and the address names no other project ("bluewaters-bay" is not "Bluewaters Residences"); a short code with no vowel (pdlm) is allowed
  return last.split(" ").every((t) => t.length < 3 || full.has(t) || dev.has(t) || PIC_STOP.has(t) || !/[aeiouy]/.test(t) || ["by", "at", "in", "of"].includes(t));
}
export function picCounts(rows) {
  const c = new Map();
  for (const r of rows || []) if (r && r.pic) { const k = r.pic; c.set(k, (c.get(k) || new Set()).add(r.key || r.project)); }
  return c;
}
export const picOk = (r, counts) => safePic(r.pic) && picBelongs(r) && (!counts || !counts.get(r.pic) || counts.get(r.pic).size <= 1);
export const isLaunch = (r) => !r || r.launch !== false;   // v802: the snapshot marks portfolio rows launch:false (kept for "All", off "This week" and the feed)

// v811: the Area filter value of a card (register area and district, lower case, "|" separated) and the options offered
export const areaKey = (r) => [...new Set([r.area_dld, r.district].filter(Boolean).map((x) => String(x).toLowerCase()))].join("|");
export const areaOptions = (rows) => [...new Set((rows || []).flatMap((r) => [r.district, r.area_dld]).filter(Boolean))].sort();
// v811: the page's lists as one pure function (the page script does the same on the cards): tab week | hot | soon | all; dev; area; days
// (launch_date within the last N days) or from / to on launch_date; sorted by launch_date newest first (unknown dates last), hot by sales.
// v811b sort (Kendall 8 Nov): LAUNCHED projects first, newest launch_date first; then Coming soon (soonest first, it has its own tab);
// "Announced · no date yet" at the bottom.
export function launchRank(r, today) {
  const la = r.launch_date || "", st = launchStatus(r, today).status;
  if (st === "announced" || !la) return [2, String(r.first_seen || "")];
  if (la > today || st === "coming_soon") return [1, la];
  return [0, la];
}
const byLaunch = (today) => (a, b) => {
  const x = launchRank(a, today), y = launchRank(b, today);
  if (x[0] !== y[0]) return x[0] - y[0];
  if (x[0] === 1) return x[1].localeCompare(y[1]);
  return y[1].localeCompare(x[1]) || String(b.first_seen || "").localeCompare(String(a.first_seen || ""));
};
export function selectLaunches(rows, o, today) {
  o = o || {};
  const back = (n) => new Date(Date.parse(today) - n * 864e5).toISOString().slice(0, 10), week = back(7);
  const list = (rows || []).filter(shown).filter((r) => {
    const la = r.launch_date || "", st = launchStatus(r, today).status;
    if (o.tab === "week" && !(la >= week && la <= today && isLaunch(r))) return false;
    if (o.tab === "hot" && !(Number(r.sales_30d) > 0)) return false;
    if (o.tab === "soon" && !(st === "coming_soon" || st === "eoi")) return false;
    if (o.dev && String(r.developer || "").toLowerCase().indexOf(String(o.dev).toLowerCase()) < 0) return false;
    if (o.area && ("|" + areaKey(r) + "|").indexOf("|" + String(o.area).toLowerCase() + "|") < 0) return false;
    if (o.days && !(la && la >= back(o.days))) return false;
    if ((o.from || o.to) && !(la && (!o.from || la >= o.from) && (!o.to || la <= o.to))) return false;
    return true;
  });
  if (o.tab === "hot") return list.sort((a, b) => (Number(b.sales_30d) || 0) - (Number(a.sales_30d) || 0));
  return list.sort(byLaunch(today));
}

export function launchCards(rows, today, q) {
  q = q || "";
  const list = (rows || []).filter(shown), counts = picCounts(list);
  const day = new Date(Date.parse(today) - 86400000).toISOString().slice(0, 10);
  return list.map((r, i) => {
    const line = (ic, v) => (v ? '<div class=ln>' + svg(LAUNCH_ICONS[ic]) + '<span>' + esc(v) + '</span></div>' : "");
    const links = (r.links || []).slice(0, 2).map((u, i) => '<a class=lk href="' + esc(u) + '" target=_blank rel="noopener noreferrer">' + svg(LAUNCH_ICONS.link, 12) + (/youtube|youtu\.be/.test(u) ? "Video" : /instagram/.test(u) ? "Post" : "Source") + (i ? " " + (i + 1) : "") + "</a>").join("");
    const ini = '<span class=pini>' + esc(String(r.developer || "?").slice(0, 1)) + '</span>';
    const fresh = r.launch_date && r.launch_date >= day && r.launch_date <= today && isLaunch(r);   // v811: launched in the last day, never "first seen"
    const ls = launchStatus(r, today), say = launchSay(r, today);
    const pill = '<span class="st st-' + ls.status + '">' + esc(ls.label) + ((ls.status === "selling" || ls.status === "nearly_sold_out") && ls.pct !== null ? " · " + ls.pct.toFixed(0) + "% sold" : "") + "</span>";
    const warn = [r.dev_vs_register, r.campaign_note, ls.status === "eoi" ? r.eoi_note : ""].filter(Boolean).map((t) => '<div class=wn>' + esc(t) + "</div>").join("");
    const towers = (r.towers || []).length > 1 ? '<div class=tw>' + esc(r.towers.length + " parts: " + r.towers.map((t) => t.name).join(", ")) + "</div>" : "";
    const badge = fresh ? '<span class=nw>New</span>' : "";
    const ok = picOk(r, counts);
    const pic = ok
      ? '<a class=pic href="' + esc(r.pic_link || (r.links || [])[0] || "#") + '" target=_blank rel="noopener noreferrer"><img src="' + esc(r.pic) + '" alt="" loading=lazy onerror="this.parentNode.classList.add(\'none\');this.remove()">' + ini + badge + (/youtube|youtu\.be/.test(r.pic_link || "") ? '<span class=play>' + svg('<path d="M8 5v14l11-7z" fill="currentColor"/>', 14) + '</span>' : "") + (r.pic_credit ? '<span class=cr>Image: ' + esc(r.pic_credit) + '</span>' : "") + '</a>'
      : '<div class="pic none">' + ini + badge + '</div>';
    const price = aedShort(r.from_aed);
    const rq = "/momo/work/launches/report" + q + (q ? "&" : "?") + "k=" + encodeURIComponent(r.key || "");
    const share = r.key ? '<div class=sh><a class=ib href="' + esc(rq) + '" aria-label="Report as PDF" title="Report as PDF">' + svg(LAUNCH_ICONS.pdf, 16) + '</a><a class="ib wa" href="' + esc(rq + "&wa=1") + '" aria-label="Send on WhatsApp" title="Send on WhatsApp">' + svg(LAUNCH_ICONS.wa, 16) + '</a></div>' : "";   // v800, v802 icons
    return '<div class=lc data-i="' + i + '" data-key="' + esc(r.key || "") + '" data-project="' + esc(r.project) + '" data-dev="' + esc(r.developer) + '" data-first="' + esc(r.first_seen) + '" data-launch="' + esc(r.launch_date || "") + '" data-rk="' + launchRank(r, today).join("|") + '" data-st="' + ls.status + '" data-s30="' + (Number(r.sales_30d) || 0) + '" data-area="' + esc(areaKey(r)) + '" data-zone="' + esc(r.zone || "") + '" data-l="' + (isLaunch(r) ? 1 : 0) + '" data-price="' + (Number(r.from_aed) || "") + '" data-ps="' + esc(price) + '" data-pic="' + (ok ? esc(r.pic) : "") + '" data-conf="' + esc(r.confidence || "") + '" data-q="' + esc([r.project, r.developer, r.area, r.area_dld, r.district, r.zone].filter(Boolean).join(" ").toLowerCase()) + '">'
      + pic + '<div class=bd>'
      + pill
      + '<b class=pj>' + esc(r.project) + '</b><div class=dv>' + esc(r.developer) + '</div>'
      + '<div class="lt' + (r.launch_date ? "" : " unk") + '">' + svg(LAUNCH_ICONS.launch, 12) + '<span>' + esc(say) + '</span></div>' + warn + towers
      + (price ? '<div class=pr>from ' + esc(price) + '<small>as advertised</small></div>' : "")
      + line("pin", [r.area, r.district && r.district !== r.area ? r.district : ""].filter(Boolean).join(" · ")) + line("bed", r.units)
      + line("size", r.sizes) + line("plan", r.plan ? r.plan + " plan" : "") + line("key", r.handover ? "handover " + r.handover : "")
      + '<div class=ft>' + svg(LAUNCH_ICONS.eye, 12) + '<span>' + (Number(r.sales_30d) ? nf(r.sales_30d) + " sold in 30 days" + esc(salesTo(r)) + " &middot; " : "") + (r.registered ? "on the register" : "not yet registered") + ' &middot; ' + nf(r.sources_n) + ' source' + (r.sources_n === 1 ? "" : "s") + '</span></div>'
      + '<div class=ac>' + (links ? '<div class=lks>' + links + '</div>' : "<span></span>") + share + '</div></div></div>';
  }).join("");
}

// v800 - MAKE A REPORT; v802: a clean list (small picture, project, developer, price, the tick on the right), aligned
const REPORT_PANEL = '<div id=rpp class=rpp hidden>'
  + '<div class=rpl>Period</div><div class=rpb><button type=button data-p=week class=on>This week</button><button type=button data-p=month>This month</button><button type=button data-p=30>Last 30 days</button><button type=button data-p=custom>Custom</button></div>'
  + '<div id=rpc hidden class=rpd><input type=date id=rpf aria-label=From><input type=date id=rpt aria-label=To></div>'
  + '<div class=rpl>Launches <span id=rpn></span></div><div class=rph>Tick up to 10. By launch date; the developer and area in Filter apply.</div><div id=rpk class=rpk></div>'
  + '<div class=rpa><a id=rpm class=bt href="#">' + svg(LAUNCH_ICONS.report, 14) + 'Make the report</a><a id=rpw class="bt wa" href="#">' + svg(LAUNCH_ICONS.wa, 14) + 'Send on WhatsApp</a></div></div>';

const FILTER_SHEET = '<div id=fs class=fs hidden><div class=fsb role=dialog aria-modal=true aria-label="Filter launches"><div class=fsh><b>Filter</b><button type=button id=fsx class=fsx aria-label=Close>' + svg('<path d="M6 6l12 12M18 6L6 18"/>', 18) + '</button></div>'
  + '<label class=rpl for=dv>Developer</label><input id=dv list=dvl autocomplete=off placeholder="By developer" aria-label="By developer"><datalist id=dvl>__DEVS__</datalist>'
  + '<label class=rpl for=zn>Area</label><select id=zn aria-label="By area"><option value="">Any area</option>__ZONES__</select>'
  + '<div class=rpl>Launch date</div><div class=rpb id=lr><button type=button data-r="" class=on>Any</button><button type=button data-r=30>Last 30 days</button><button type=button data-r=122>Last 4 months</button><button type=button data-r=365>Last 12 months</button><button type=button data-r=custom>Custom</button></div>'
  + '<div id=lrc hidden class=rpd><input type=date id=lrf aria-label="Launched from"><input type=date id=lrt aria-label="Launched to"></div>'
  + '<div class=rpl>Sort</div><div class=rpb id=so><button type=button data-s=new class=on>Newest launch</button><button type=button data-s=lo>Lowest price</button><button type=button data-s=hi>Highest price</button></div>'
  + '<div class=rpa><button type=button id=fsg class=bt>Show launches</button><button type=button id=fsc class="bt wa">Clear</button></div></div></div>';

export function launchesPage(key, rk, snap, today) {
  const q = "?key=" + encodeURIComponent(key) + (rk ? "&rk=" + encodeURIComponent(rk) : "");
  const rows = ((snap && snap.rows) || []).filter(shown);
  const devs = [...new Set(rows.map((r) => r.developer).filter(Boolean))].sort();
  const zones = areaOptions(rows);
  const asOf = (snap && snap.sales_as_of) || (rows.find((r) => r.sales_as_of) || {}).sales_as_of, hotTo = asOf ? " · Register sales" + salesTo({ sales_as_of: asOf }) : "";   // v811b: the real latest transaction date   // v811: register areas and districts in the data (the 2040 zone is off the filter)
  const week = new Date(Date.parse(today) - 7 * 86400000).toISOString().slice(0, 10);
  const qa = (snap && Array.isArray(snap.qa) && snap.qa.length) ? '<p class=qa>' + svg(LAUNCH_ICONS.eye, 12) + ' Check: ' + esc(snap.qa.join("; ")) + '</p>' : "";
  return '<a class=back href="/momo' + q + '">&#8592; Momo</a><div class=tag>MOMO &middot; MARKET</div><h1>New launches</h1>'
    + '<p class=ld>Dated by the register\'s first sale or the press, newest first &middot; prices as advertised</p>' + qa
    + '<div class=sr>' + svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>', 16) + '<input id=qs type=search autocomplete=off placeholder="Search project, developer or area" aria-label="Search launches"></div>'
    + '<div id=qsl class=qsl hidden role=listbox aria-label="Matching launches"></div>'
    + '<div class=fl><button type=button class=on data-f=week>This week</button><button type=button data-f=hot>Hot this month</button><button type=button data-f=soon>Coming soon</button><button type=button data-f=all>All</button><button type=button id=fo class=fo>' + svg('<path d="M4 6h16M7 12h10M10 18h4"/>', 14) + '<span id=fol>Filter</span></button><button type=button id=rs class=rs>Reset</button></div>'
    + '<p id=hn class=hn hidden>Off-plan sales in the last 30 days' + esc(hotTo) + '</p>'
    + '<div class=cl><span id=cn class=cn></span><button type=button id=rpo class=rpo>' + svg(LAUNCH_ICONS.report, 14) + 'Make a report</button></div>'
    + REPORT_PANEL + FILTER_SHEET.replace("__DEVS__", devs.map((d) => '<option value="' + esc(d) + '">').join("")).replace("__ZONES__", zones.map((z) => '<option value="' + esc(z.toLowerCase()) + '">' + esc(z) + '</option>').join(""))
    + '<div class=grid id=lg data-today="' + today + '" data-week="' + week + '">' + launchCards(selectLaunches(rows, {}, today), today, q) + '</div><div class=em id=le hidden>' + svg(LAUNCH_ICONS.launch, 28) + '<p>No launches match.</p></div>'
    + '<button type=button id=mo class=mo hidden>Show more</button>'
    + '<p class=nt>Updated ' + esc((snap && snap.generated) || "not yet") + ' by the 04:00 refresh.</p>'
    + '<style>.ld{color:#5F6B66;font-size:.88rem;margin:0 0 10px}.qa{font-size:.78rem;color:#8A6F3E;background:#F4E9D2;border-radius:10px;padding:6px 10px;margin:0 0 10px}'
    + '.qsl{background:#fff;border:1px solid #C5A56A;border-radius:16px;margin:-4px 0 10px;overflow:hidden;box-shadow:0 8px 20px rgba(0,0,0,.08)}.qsl button{display:flex;width:100%;gap:10px;align-items:center;text-align:left;border:0;border-bottom:1px solid #EEE7D8;background:#fff;padding:10px 14px;font:500 .9rem "IBM Plex Sans",sans-serif;color:#1C2321}.qsl button:last-child{border-bottom:0}.qsl b{display:block;color:#0A4F4A}.qsl i{display:block;font-style:normal;font-size:.78rem;color:#5F6B66}.qsl .qn{padding:12px 14px;font-size:.85rem;color:#5F6B66}.lc.hit{outline:3px solid #C5A56A;outline-offset:2px}'
    + '.sr{display:flex;align-items:center;gap:8px;background:#FFFDF9;border:1px solid #C5A56A;border-radius:999px;padding:4px 12px;margin:0 0 10px;color:#8A6F3E}.sr input{flex:1;min-width:0;border:0;background:transparent;font:500 .9rem "IBM Plex Sans",sans-serif;color:#1C2321;outline:none;padding:6px 0}'
    + '.fl{display:flex;gap:6px;margin:0 0 8px;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none}.fl button{flex:0 0 auto;white-space:nowrap;display:inline-flex;align-items:center;gap:4px;border:1px solid #C5A56A;background:#FFFDF9;color:#0A4F4A;border-radius:999px;padding:7px 12px;font:600 .8rem "IBM Plex Sans",sans-serif}.fl button.on{background:#0A4F4A;color:#fff;border-color:#0A4F4A}.fl .rs{margin-left:auto;border-color:#D8D1C4;color:#5F6B66}'
    + '.cl{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 10px}.cn{font:600 .8rem "IBM Plex Sans",sans-serif;color:#5F6B66}.rpo{display:inline-flex;gap:6px;align-items:center;border:1px solid #0A4F4A;background:#FFFDF9;color:#0A4F4A;border-radius:999px;padding:7px 12px;font:600 .8rem "IBM Plex Sans",sans-serif}.rpo.on{background:#0A4F4A;color:#fff}'
    + '.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.lc{background:#FFFDF9;border:1px solid #E7E1D6;border-radius:16px;display:flex;flex-direction:column;min-width:0;overflow:hidden}.bd{padding:8px 10px 10px;display:flex;flex-direction:column;gap:4px;flex:1;min-width:0}'
    + '.pic{position:relative;display:block;aspect-ratio:16/10;background:#EFE6D4;overflow:hidden}.pic img{width:100%;height:100%;object-fit:cover;display:block}.pic .pini{display:none}.pic.none{display:flex;align-items:center;justify-content:center}.pic.none .pini{display:flex;width:40px;height:40px;border-radius:50%;background:#0A4F4A;color:#F3E7CF;align-items:center;justify-content:center;font:600 1.1rem Fraunces,serif}'
    + '.cr{position:absolute;left:0;right:0;bottom:0;padding:10px 6px 3px;font-size:.58rem;line-height:1.2;color:#fff;background:linear-gradient(transparent,rgba(28,35,33,.62));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.play{position:absolute;right:6px;top:6px;width:26px;height:26px;border-radius:50%;background:rgba(10,79,74,.85);color:#fff;display:flex;align-items:center;justify-content:center}.nw{position:absolute;left:6px;top:6px;background:#C5A56A;color:#fff;font:700 .62rem "IBM Plex Sans",sans-serif;letter-spacing:.04em;border-radius:999px;padding:3px 8px;box-shadow:0 1px 4px rgba(0,0,0,.18)}'
    + '.st{align-self:flex-start;font:600 .62rem "IBM Plex Sans",sans-serif;border-radius:999px;padding:2px 7px;line-height:1.3}.st-on{background:#DCEBE4;color:#0A4F4A}.st-off{background:#F3E7CF;color:#8A6F3E}.st-just_launched{background:#0A4F4A;color:#fff}.st-selling{background:#DCEBE4;color:#0A4F4A}.st-nearly_sold_out{background:#F6DCCB;color:#8A3E1E}.st-coming_soon{background:#F3E7CF;color:#8A6F3E}.st-eoi{background:#E7E1F3;color:#4A3E8A}.st-no_sales{background:#EEE7D8;color:#5F6B66}.st-announced{background:#F1EEE8;color:#8FA39B}.hn{font-size:.76rem;color:#8A6F3E;margin:-2px 0 8px}.hn[hidden]{display:none}'
    + '.lt{display:flex;gap:5px;align-items:flex-start;font:600 .74rem "IBM Plex Sans",sans-serif;color:#0A4F4A}.lt svg{flex:0 0 12px;margin-top:2px;color:#C5A56A}.lt.unk{color:#8FA39B;font-weight:500}.wn{font-size:.68rem;line-height:1.3;color:#8A3E1E;background:#FBF0E6;border-radius:8px;padding:3px 6px}.tw{font-size:.66rem;color:#5F6B66}'
    + '.pj{font:600 .98rem/1.2 Fraunces,serif;color:#0A4F4A;margin-top:2px;overflow-wrap:anywhere}.dv{font-size:.76rem;color:#8A6F3E;font-weight:600}.pr{font:700 1.02rem Fraunces,serif;color:#1C2321;margin:2px 0}.pr small{display:block;font:500 .64rem "IBM Plex Sans",sans-serif;color:#8FA39B}'
    + '.ln{display:flex;gap:6px;align-items:flex-start;font-size:.78rem;color:#1C2321}.ln svg{flex:0 0 14px;color:#C5A56A;margin-top:2px}.ln span{min-width:0;overflow-wrap:anywhere}'
    + '.ft{display:flex;gap:5px;align-items:center;font-size:.7rem;color:#5F6B66;margin-top:auto;border-top:1px solid #EFE9DE;padding-top:6px}.ac{display:flex;align-items:center;justify-content:space-between;gap:6px;min-width:0}.lks{display:flex;gap:4px;flex-wrap:wrap;min-width:0}.lk{display:inline-flex;gap:3px;align-items:center;font-size:.7rem;color:#0A4F4A;text-decoration:none;border:1px solid #D8CDB8;border-radius:999px;padding:2px 7px}'
    + '.sh{display:flex;gap:6px;flex:0 0 auto}.ib{display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;background:#0A4F4A;color:#fff;text-decoration:none}.ib.wa{background:#FFFDF9;color:#0A4F4A;border:1px solid #0A4F4A;box-sizing:border-box}'
    + '.bt{display:inline-flex;gap:5px;align-items:center;justify-content:center;font:600 .82rem "IBM Plex Sans",sans-serif;color:#fff;background:#0A4F4A;text-decoration:none;border:1px solid #0A4F4A;border-radius:999px;padding:9px 14px;flex:1}.bt.wa{background:#FFFDF9;color:#0A4F4A}'
    + '.rpp{background:#FFFDF9;border:1px solid #E7E1D6;border-radius:16px;padding:12px;margin:0 0 12px}.rpp[hidden],#rpc[hidden],#lrc[hidden],.fs[hidden],.mo[hidden]{display:none}'
    + '.rpl{display:block;font:600 .7rem "IBM Plex Mono",monospace;letter-spacing:.08em;color:#8A6F3E;text-transform:uppercase;margin:10px 0 6px}.rph{font-size:.74rem;color:#5F6B66;margin:-2px 0 6px}.rpb{display:flex;gap:6px;flex-wrap:wrap}.rpb button{border:1px solid #C5A56A;background:#fff;color:#0A4F4A;border-radius:999px;padding:6px 12px;font:600 .8rem "IBM Plex Sans",sans-serif}.rpb button.on{background:#0A4F4A;color:#fff;border-color:#0A4F4A}'
    + '.rpd{display:flex;gap:6px;margin-top:6px}.rpd input{flex:1;min-width:0;border:1px solid #C5A56A;border-radius:10px;padding:6px}'
    + '.rpk{border:1px solid #EFE9DE;border-radius:12px;background:#fff;max-height:340px;overflow:auto}.rk{display:grid;grid-template-columns:40px minmax(0,1fr) auto 22px;gap:10px;align-items:center;padding:8px 10px;border-bottom:1px solid #EFE9DE;cursor:pointer}.rk:last-child{border-bottom:0}'
    + '.rkp{width:40px;height:40px;border-radius:8px;background:#EFE6D4 center/cover no-repeat;display:flex;align-items:center;justify-content:center;font:600 .9rem Fraunces,serif;color:#0A4F4A}.rkt{min-width:0}.rkt b{display:block;font:600 .84rem/1.2 "IBM Plex Sans",sans-serif;color:#0A4F4A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rkt i{display:block;font-style:normal;font-size:.72rem;color:#8A6F3E;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
    + '.rkv{font:600 .78rem "IBM Plex Sans",sans-serif;color:#1C2321;white-space:nowrap;text-align:right}.rk input{width:20px;height:20px;margin:0;accent-color:#0A4F4A;justify-self:end}.rke{padding:14px;font-size:.8rem;color:#5F6B66}.rpa{display:flex;gap:8px;margin-top:12px}.rpa .bt{white-space:nowrap;min-width:0;padding:9px 10px;font-size:.8rem}'
    + '.fs{position:fixed;inset:0;z-index:2000;background:rgba(28,40,38,.32);display:flex;align-items:flex-end;justify-content:center}.fsb{background:#FFFDF9;border-radius:18px 18px 0 0;padding:14px 16px 22px;width:100%;max-width:560px;box-sizing:border-box;max-height:88vh;overflow:auto}.fsh{display:flex;justify-content:space-between;align-items:center}.fsh b{font:600 1.15rem Fraunces,serif;color:#0A4F4A}.fsx{border:0;background:transparent;color:#5F6B66;padding:4px}'
    + '.fsb input,.fsb select{width:100%;box-sizing:border-box;border:1px solid #C5A56A;background:#fff;color:#0A4F4A;border-radius:12px;padding:10px 12px;font:600 .88rem "IBM Plex Sans",sans-serif}'
    + '.mo{display:block;width:100%;margin:12px 0 0;border:1px solid #0A4F4A;background:#FFFDF9;color:#0A4F4A;border-radius:999px;padding:10px;font:600 .86rem "IBM Plex Sans",sans-serif}'
    + '.em{display:flex;flex-direction:column;align-items:center;gap:8px;padding:40px 0;border:1px dashed #D8D1C4;border-radius:18px;color:#5F6B66}.em[hidden]{display:none}.em p{margin:0}.nt{font-size:.72rem;color:#8FA39B;margin-top:14px}</style>'
    + '<script>(function(){var g=document.getElementById("lg"),e=document.getElementById("le"),s=document.getElementById("dv"),z=document.getElementById("zn"),Q=document.getElementById("qs"),M=document.getElementById("mo"),CN=document.getElementById("cn"),FS=document.getElementById("fs"),FL=document.getElementById("fol"),f="week",srt="new",lim=20,W=g.getAttribute("data-week"),TD=g.getAttribute("data-today"),LR="",LF=document.getElementById("lrf"),LT=document.getElementById("lrt"),LC=document.getElementById("lrc");function has(c,a,v){return !v||String(c.getAttribute(a)||"").toLowerCase().indexOf(v.trim().toLowerCase())>=0}'
    + 'function num(c){var p=Number(c.getAttribute("data-price"));return p>0?p:null}function order(){var L=[].slice.call(g.children);L.sort(function(a,b){var ia=+a.getAttribute("data-i"),ib=+b.getAttribute("data-i");if(f==="hot"&&srt==="new"){return (+b.getAttribute("data-s30"))-(+a.getAttribute("data-s30"))||ia-ib}if(srt==="new"){var ka=(a.getAttribute("data-rk")||"2|").split("|"),kb=(b.getAttribute("data-rk")||"2|").split("|");if(ka[0]!==kb[0])return ka[0]<kb[0]?-1:1;if(ka[0]==="1")return ka[1]<kb[1]?-1:ka[1]>kb[1]?1:ia-ib;return ka[1]<kb[1]?1:ka[1]>kb[1]?-1:ia-ib}var pa=num(a),pb=num(b);if(pa===null&&pb===null)return ia-ib;if(pa===null)return 1;if(pb===null)return -1;return srt==="lo"?pa-pb:pb-pa});L.forEach(function(c){g.appendChild(c)})}'
    + 'function run(keep){if(!keep)lim=20;var n=0;[].forEach.call(g.children,function(c){var la=c.getAttribute("data-launch")||"",st=c.getAttribute("data-st"),ok=(f==="all"||(f==="week"&&la>=W&&la<=TD&&c.getAttribute("data-l")==="1")||(f==="hot"&&+c.getAttribute("data-s30")>0)||(f==="soon"&&(st==="coming_soon"||st==="eoi")))&&has(c,"data-dev",s.value)&&(!z.value||("|"+c.getAttribute("data-area")+"|").indexOf("|"+z.value+"|")>=0)&&inRange(la)&&Q.value.trim().toLowerCase().split(/\\s+/).every(function(w){return has(c,"data-q",w)});c.setAttribute("data-ok",ok?"1":"0");if(ok)n++;c.style.display=ok&&n<=lim?"":"none"});e.hidden=n>0;document.getElementById("hn").hidden=f!=="hot";M.hidden=n<=lim;M.textContent="Show more ("+(n-lim)+" more)";CN.textContent=f==="week"?n+" this week":f==="hot"?n+" selling this month":f==="soon"?n+" coming soon":n+" launch"+(n===1?"":"es");var a=(s.value?1:0)+(z.value?1:0)+(srt!=="new"?1:0)+(LR?1:0);FL.textContent=a?"Filter \\u00b7 "+a:"Filter"}'
    + 'M.onclick=function(){lim+=20;run(true)};[].forEach.call(document.querySelectorAll(".fl button[data-f]"),function(b){b.onclick=function(){f=b.getAttribute("data-f");[].forEach.call(document.querySelectorAll(".fl button[data-f]"),function(x){x.classList.toggle("on",x===b)});order();run()}});'
    + 'function back(n){return new Date(Date.parse(TD)-n*864e5).toISOString().slice(0,10)}function inRange(la){if(!LR)return true;if(LR==="custom"){if(!LF.value&&!LT.value)return true;return !!la&&(!LF.value||la>=LF.value)&&(!LT.value||la<=LT.value)}return !!la&&la>=back(+LR)}window.__lrange=inRange;'
    + 'function setLR(v){LR=v;[].forEach.call(document.querySelectorAll("#lr button"),function(x){x.classList.toggle("on",x.getAttribute("data-r")===v)});LC.hidden=v!=="custom";run()}[].forEach.call(document.querySelectorAll("#lr button"),function(b){b.onclick=function(){setLR(b.getAttribute("data-r"))}});LF.onchange=function(){run()};LT.onchange=function(){run()};'
    + 'function sheet(o){FS.hidden=!o}document.getElementById("fo").onclick=function(){sheet(true)};document.getElementById("fsx").onclick=function(){sheet(false)};document.getElementById("fsg").onclick=function(){sheet(false)};FS.onclick=function(ev){if(ev.target===FS)sheet(false)};'
    + 'function setSort(v){srt=v;[].forEach.call(document.querySelectorAll("#so button"),function(x){x.classList.toggle("on",x.getAttribute("data-s")===v)});order();run()}[].forEach.call(document.querySelectorAll("#so button"),function(b){b.onclick=function(){setSort(b.getAttribute("data-s"))}});'
    + 'document.getElementById("fsc").onclick=function(){s.value="";z.value="";LF.value="";LT.value="";setLR("");setSort("new");s.dispatchEvent(new Event("change"))};s.oninput=function(){run()};s.onchange=function(){run()};z.onchange=function(){run()};Q.oninput=function(){run()};'
    + 'document.getElementById("rs").onclick=function(){Q.value="";s.value="";z.value="";LF.value="";LT.value="";setLR("");f="week";[].forEach.call(document.querySelectorAll(".fl button[data-f]"),function(x){x.classList.toggle("on",x.getAttribute("data-f")==="week")});setSort("new");s.dispatchEvent(new Event("change"))};order();run()})()</script>'
    + '<script>(function(){var Q=document.getElementById("qs"),L=document.getElementById("qsl"),g=document.getElementById("lg");if(!Q||!L||!g)return;'
    + 'function hide(){L.hidden=true;L.innerHTML=""}'
    + 'function show(){var v=Q.value.trim().toLowerCase();if(v.length<2){hide();return}var hits=[];[].forEach.call(g.children,function(c){var t=((c.getAttribute("data-q")||"")+" "+(c.getAttribute("data-project")||"")+" "+(c.getAttribute("data-dev")||"")).toLowerCase();if(t.indexOf(v)>=0)hits.push(c)});'
    + 'L.innerHTML="";if(!hits.length){var n=document.createElement("div");n.className="qn";n.textContent="No launch matches \u201c"+Q.value.trim()+"\u201d";L.appendChild(n)}'
    + 'hits.slice(0,8).forEach(function(c){var b=document.createElement("button");b.type="button";b.setAttribute("role","option");var t=document.createElement("span"),x=document.createElement("b"),y=document.createElement("i");x.textContent=c.getAttribute("data-project")||"";y.textContent=[c.getAttribute("data-dev"),c.getAttribute("data-ps")].filter(Boolean).join(" \u00b7 ");t.appendChild(x);t.appendChild(y);b.appendChild(t);'
    + 'b.onclick=function(){var all=document.querySelector(".fl button[data-f=all]");if(all&&!all.classList.contains("on"))all.click();hide();setTimeout(function(){[].forEach.call(g.querySelectorAll(".hit"),function(h){h.classList.remove("hit")});c.hidden=false;c.style.display="";c.classList.add("hit");c.scrollIntoView({behavior:"smooth",block:"nearest",inline:"center"})},60)};L.appendChild(b)});'
    + 'if(hits.length>8){var m=document.createElement("div");m.className="qn";m.textContent=(hits.length-8)+" more: keep typing to narrow";L.appendChild(m)}L.hidden=false}'
    + 'Q.addEventListener("input",show);Q.addEventListener("focus",show);document.addEventListener("click",function(e){if(e.target!==Q&&!L.contains(e.target))hide()})})()</script>'
    + '<script>(function(){var o=document.getElementById("rpo"),P=document.getElementById("rpp"),g=document.getElementById("lg"),K=document.getElementById("rpk"),N=document.getElementById("rpn"),C=document.getElementById("rpc"),F=document.getElementById("rpf"),T=document.getElementById("rpt"),s=document.getElementById("dv"),z=document.getElementById("zn"),per="week",today=' + JSON.stringify(today) + ';'
    + 'function ago(n){return new Date(Date.parse(today)-n*864e5).toISOString().slice(0,10)}function range(){if(per==="month")return[today.slice(0,8)+"01",today];if(per==="30")return[ago(30),today];if(per==="custom"&&F.value&&T.value)return[F.value,T.value];return[ago(7),today]}'
    + 'function mk(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e}'
    + 'function list(){var r=range(),out=[];[].forEach.call(g.children,function(c){var f=c.getAttribute("data-launch");if(f&&f>=r[0]&&f<=r[1]&&(per!=="week"||c.getAttribute("data-l")==="1")&&(!s.value||String(c.getAttribute("data-dev")||"").toLowerCase().indexOf(s.value.trim().toLowerCase())>=0)&&(!z.value||("|"+c.getAttribute("data-area")+"|").indexOf("|"+z.value+"|")>=0))out.push(c)});'
    + 'K.innerHTML="";if(!out.length)K.appendChild(mk("div","rke","No launches in this period."));out.forEach(function(c,i){var l=mk("label","rk"),p=mk("span","rkp"),pic=c.getAttribute("data-pic");if(pic)p.style.backgroundImage="url(\\""+pic+"\\")";else p.textContent=String(c.getAttribute("data-dev")||"?").slice(0,1);var t=mk("span","rkt");t.appendChild(mk("b","",c.getAttribute("data-project")));t.appendChild(mk("i","",c.getAttribute("data-dev")));var b=document.createElement("input");b.type="checkbox";b.value=c.getAttribute("data-key");b.checked=i<10;b.onchange=cap;b.setAttribute("aria-label",c.getAttribute("data-project"));l.appendChild(p);l.appendChild(t);l.appendChild(mk("span","rkv",c.getAttribute("data-ps")||""));l.appendChild(b);K.appendChild(l)});cap()}'
    + 'function cap(){var on=K.querySelectorAll("input:checked");if(on.length>10)this.checked=false;on=K.querySelectorAll("input:checked");N.textContent="("+on.length+" ticked)";var k=[].map.call(on,function(b){return b.value}).join(","),r=range(),u=' + JSON.stringify("/momo/work/launches/report" + q + (q ? "&" : "?")) + '+"k="+encodeURIComponent(k)+"&period="+per+(per==="custom"?"&from="+r[0]+"&to="+r[1]:"");document.getElementById("rpm").href=u;document.getElementById("rpw").href=u+"&wa=1"}'
    + 'o.onclick=function(){P.hidden=!P.hidden;o.classList.toggle("on",!P.hidden);if(!P.hidden)list()};[].forEach.call(document.querySelectorAll(".rpb button[data-p]"),function(b){b.onclick=function(){per=b.getAttribute("data-p");[].forEach.call(document.querySelectorAll(".rpb button[data-p]"),function(x){x.classList.toggle("on",x===b)});C.hidden=per!=="custom";list()}});F.onchange=list;T.onchange=list;s.addEventListener("change",function(){if(!P.hidden)list()});z.addEventListener("change",function(){if(!P.hidden)list()})})()</script>';
}

export async function launchesRoute(request, env, url, deps) {
  if (url.pathname !== "/momo/work/launches" || request.method !== "GET") return null;
  let snap = null; try { snap = tidyLaunches(await deps.kv(env, "launches")); } catch (e) {}   // v803: register names in proper case
  const today = new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
  return new Response(deps.page(url.searchParams.get("key") || "", url.searchParams.get("rk") || "", launchesPage(url.searchParams.get("key") || "", url.searchParams.get("rk") || "", snap, today)),
    { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}
