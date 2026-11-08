// v823 - Najjuko's brief (8 Nov): "Project of the week" (chosen by the managing director) and "Mortgage information" slides.
// Her render_edition.py template has no layout for them yet, so they are NOT in the edition JSON (which stays exactly her 146 fields); the bridge hands
// them to her Claude as `extra_slides` with their own field lists, ready for two new layouts in the DNA. Project figures come ONLY from the developer's own
// material she pastes (brochure text, price list, the developer's page text) - never from portals or estimates; every figure carries its source; anything
// not found stays "" (her gold placeholder). Momo does not fetch developer sites itself.
export const PROJECT_FIELDS = [["project_name", 40], ["project_developer", 40], ["project_price_from", 30], ["project_payment_plan", 60], ["project_handover", 30], ["project_units", 80], ["project_source", 200], ["project_notes", 1200]];
export const MORTGAGE_FIELDS = [["mort_headline", 50], ["mort_dev_plan", 120], ["mort_market", 300], ["mort_partners", 300], ["mort_source", 300], ["mort_notes", 1200]];
const PORTALS = /(propertyfinder|bayut|dubizzle|property\s?monitor|reidin|houza|zillow|rightmove)/i;
const clip = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);
const money = (t) => { const m = /\b(?:from|starting(?: from| at)?|prices? from)\s*(?:AED|Dhs?\.?)\s*([\d.,]+\s*(?:m|mn|million|k)?)/i.exec(t) || /\b(?:AED|Dhs?\.?)\s*([\d.,]+\s*(?:m|mn|million)?)\b/i.exec(t);
  if (!m) return ""; let v = m[1].replace(/\s+/g, "").toLowerCase(); v = v.replace(/(mn|million)$/, "m"); return "From AED " + v.toUpperCase().replace(/M$/, "M"); };
export function projectFrom(text, nowDay) {
  const t = String(text || ""), lines = t.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (PORTALS.test(t)) return { error: "That looks like a property portal. Use the developer's own brochure, price list or page text: portal figures are never used." };
  const url = (/(https?:\/\/[^\s]+)/.exec(t) || [])[1] || "";
  const plan = (/\b(\d{1,2}\s*\/\s*\d{1,2}(?:\s*\/\s*\d{1,2})?)\s*(?:payment plan)?/i.exec(t) || [])[1] || "";
  const ho = (/\b(?:handover|completion)\b[^.\n]{0,20}?\b((?:Q[1-4]\s*)?20\d\d)\b/i.exec(t) || [])[1] || "";
  const units = (/\b((?:\d|studio)[^.\n]{0,40}?(?:bedroom|BR|villas?|townhouses?|apartments?)[^.\n]{0,30})/i.exec(t) || [])[1] || "";
  const dev = (/\bby\s+([A-Z][A-Za-z&. ]{2,30})/.exec(t) || [])[1] || "";
  const src = url ? "Developer material: " + url + " (as of " + nowDay + ")" : "Developer material pasted by Najjuko (" + nowDay + ")";
  const v = { project_name: clip(lines[0] || "", 40), project_developer: clip(dev, 40), project_price_from: clip(money(t), 30), project_payment_plan: plan ? clip(plan.replace(/\s+/g, ""), 60) : "",
    project_handover: clip(ho, 30), project_units: clip(units, 80), project_source: clip(src, 200), project_notes: clip("Every figure from the developer's own material (" + src + "). Check anything gold before Monday.", 1200) };
  v.sources = { project_price_from: v.project_price_from ? src : "", project_payment_plan: v.project_payment_plan ? src : "", project_handover: v.project_handover ? src : "", project_units: v.project_units ? src : "" };
  return { values: v };
}
export function mortgageFrom(text, project, nowDay) {
  const t = String(text || ""), lines = t.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const partners = lines.filter((l) => /\b(bank|finance|mortgage|partner|broker|islamic|NBD|ENBD|ADCB|FAB|Mashreq|DIB|RAK|CBD|HSBC|Standard Chartered)\b/i.test(l));
  const market = lines.filter((l) => /\b(rate|%|EIBOR|fixed|variable|LTV|loan[- ]to[- ]value|tenor|years?)\b/i.test(l));   // a bank line with a rate is both a partner and a market option
  const v = { mort_headline: "Financing that helps close this week", mort_dev_plan: project && project.project_payment_plan ? clip((project.project_name || "Project of the week") + ": " + project.project_payment_plan + " (" + (project.project_source || "developer") + ")", 120) : "",
    mort_market: clip(market.join(" · "), 300), mort_partners: clip(partners.join(" · "), 300), mort_source: clip("Bank / partner updates pasted by Najjuko (" + nowDay + ")" + (project && project.project_source ? "; payment plan: " + project.project_source : ""), 300), mort_notes: clip(t, 1200) };
  return { values: v };
}

// ---- v823 addendum 2: Celebrating every sale (rec_*), Company & department updates (dept*), Weekly schedule (week_range, day1-4_*) ----
const DEAL = [[/off[- ]?plan/i, "Off-plan"], [/rent|lease|tenan/i, "Rental"], [/secondary|resale|ready/i, "Secondary"], [/commercial|office|retail|plot|land/i, "Commercial / plot"]];
export const firstName = (n) => String(n || "").replace(/\(.*?\)/g, "").trim().split(/\s+/)[0] || "";
// "Name, deal type, project or area" one per line -> first names on the slide, deal types counted
export function salesFrom(text, meta) {
  const rows = String(text || "").split(/\n+/).map((l) => l.trim()).filter(Boolean).map((l) => { const parts = l.split(/\s*[,;\-–|]\s*/); const kind = (DEAL.find((d) => d[0].test(l)) || [0, "Sale"])[1]; return { who: firstName(parts[0]), kind, where: clip(parts.slice(2).join(" ") || parts[1] || "", 40) }; }).filter((r) => r.who);
  const count = {}; rows.forEach((r) => (count[r.kind] = (count[r.kind] || 0) + 1));
  const m = (k) => (meta[k] ? meta[k].max : 60);
  const v = { rec_headline: clip("Celebrating every sale", m("rec_headline")), rec_intro: clip(rows.length + " deal" + (rows.length === 1 ? "" : "s") + " closed this week. Thank you, team.", m("rec_intro")),
    rec_1st: clip(rows[0] ? rows[0].who : "", m("rec_1st")), rec_2nd: clip(rows[1] ? rows[1].who : "", m("rec_2nd")), rec_3rd: clip(rows[2] ? rows[2].who : "", m("rec_3rd")), rec_4th: clip(rows[3] ? rows[3].who : "", m("rec_4th")),
    rec_bar: clip(Object.entries(count).map(([k, n]) => k + " " + n).join(" · "), m("rec_bar")), rec_notes: clip(rows.map((r) => r.who + ": " + r.kind + (r.where ? ", " + r.where : "")).join("\n"), m("rec_notes")) };
  return { values: v, rows };
}
// one paste-all box -> sorted by department; the standing HR reminders card stays (last week's HR card when no HR update came)
const DEPTS = [[/^\s*(marketing)\b/i, "Marketing"], [/^\s*(business development|bd)\b/i, "Business Development"], [/^\s*(pr|advertising|pr\s*&\s*advertising)\b/i, "PR & Advertising"], [/^\s*(hr|human resources)\b/i, "Human Resources"]];
export function deptsFrom(text, prevForm, meta) {
  const blocks = []; let cur = null;
  for (const raw of String(text || "").split(/\n/)) {
    const l = raw.trim(); if (!l) continue;
    const d = DEPTS.find((x) => x[0].test(l));
    if (d || !cur) { cur = { dept: d ? d[1] : "Other", lines: [] }; blocks.push(cur); const rest = d ? l.replace(d[0], "").replace(/^[\s:\-–]+/, "") : l; if (rest) cur.lines.push(rest); continue; }
    cur.lines.push(l.replace(/^[-•*]\s*/, ""));
  }
  const hr = blocks.find((b) => b.dept === "Human Resources"), others = blocks.filter((b) => b.dept !== "Human Resources").slice(0, 2);
  const m = (k) => (meta[k] ? meta[k].max : 300), asBody = (k, lines) => (Array.isArray(prevForm && prevForm[k]) ? lines.map((x) => clip(x, m(k))) : clip(lines.join("\n"), m(k)));
  const v = { dept_headline: clip("Company and department updates", m("dept_headline")) };
  others.forEach((b, i) => { const n = i + 1; v["dept" + n + "_label"] = clip(b.dept.length <= m("dept" + n + "_label") ? b.dept : ({ "Business Development": "BD", "PR & Advertising": "PR & Ads", "Human Resources": "HR", "Marketing": "Marketing" }[b.dept] || b.dept), m("dept" + n + "_label")); v["dept" + n + "_title"] = clip(b.lines[0] || b.dept, m("dept" + n + "_title")); v["dept" + n + "_body"] = asBody("dept" + n + "_body", b.lines.slice(1).length ? b.lines.slice(1) : b.lines); });
  if (hr) { v.dept3_label = clip("Human Resources".length <= m("dept3_label") ? "Human Resources" : "HR", m("dept3_label")); v.dept3_title = clip(hr.lines[0] || "HR reminders", m("dept3_title")); v.dept3_body = asBody("dept3_body", hr.lines.slice(1).length ? hr.lines.slice(1) : hr.lines); }
  else if (prevForm) for (const k of ["dept3_label", "dept3_title", "dept3_body"]) if (prevForm[k] != null) v[k] = prevForm[k];   // the standing HR reminders card
  v.dept_notes = clip(text, m("dept_notes"));
  return { values: v, sorted: blocks.map((b) => b.dept) };
}
// "Paste the MD's week" -> Mon-Thu, each item labelled with its type
const TYPES = [[/launch/i, "Launch"], [/huddle/i, "Weekly huddle"], [/q\s*&\s*a|q&a|questions/i, "Q&A with the MD"], [/shoot|filming|photo/i, "Shoot at the office"], [/visit.*(our office|to us|fn office)|(at|to) our office/i, "Developer visit at our office"], [/visit|site|sales (office|centre|center)|developer/i, "Developer visit on site"]];
export const itemType = (l) => (TYPES.find((t) => t[0].test(l)) || [0, "For the sales team"])[1];
export function scheduleFrom(text, monday, meta, radar) {
  const DN = ["monday", "tuesday", "wednesday", "thursday"], v = {}, items = { 0: [], 1: [], 2: [], 3: [] };
  let cur = -1;
  for (const raw of String(text || "").split(/\n/)) { const l = raw.trim(); if (!l) continue; const d = DN.findIndex((x) => new RegExp("^" + x.slice(0, 3) + "(" + x.slice(3) + ")?\\b", "i").test(l)); if (d >= 0) { cur = d; const rest = l.replace(/^\w+[\s:,\-–]*/, ""); if (rest) items[d].push(rest); continue; } if (cur >= 0) items[cur].push(l); }
  for (const r of radar || []) { const i = Math.round((Date.parse(r.date) - Date.parse(monday)) / 864e5); if (i >= 0 && i < 4) items[i].push(r.title + " (launch, reported)"); }
  const m = (k) => (meta[k] ? meta[k].max : 40);
  for (let i = 0; i < 4; i++) { const it = items[i][0]; if (!it) continue; const n = i + 1, tm = (/\b(\d{1,2}[:.]\d{2}\s*(?:am|pm)?|\d{1,2}\s*(?:am|pm))\b/i.exec(it) || [])[1] || "", at = (/\b(?:at|@)\s+([^,;]+)/i.exec(it) || [])[1] || "";
    v["day" + n + "_event"] = clip(it.replace(tm, "").replace(/\b(?:at|@)\s+[^,;]+/i, "").replace(/[\s,;\-–]+$/, ""), m("day" + n + "_event")); v["day" + n + "_time"] = clip(tm, m("day" + n + "_time")); v["day" + n + "_place"] = clip(at, m("day" + n + "_place")); v["day" + n + "_purpose"] = clip(itemType(it), m("day" + n + "_purpose")); }
  v.focus_notes = clip(Object.values(items).flat().map((x) => itemType(x) + ": " + x).join("\n"), m("focus_notes"));
  return { values: v, items };
}


// ---- v823 addendum 3: the schedule Monday to Saturday (up to the 4 slots her template has), mandatory / optional, the week's focus line ----
export function weekFrom(text, monday, meta, radar) {
  const DN = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"], items = [];
  let cur = -1, focus = "";
  for (const raw of String(text || "").split(/\n/)) {
    const l = raw.trim(); if (!l) continue;
    if (/^focus\b/i.test(l)) { focus = l.replace(/^focus[\s:,\-–]*/i, ""); continue; }
    const d = DN.findIndex((x) => new RegExp("^" + x.slice(0, 3) + "(" + x.slice(3) + ")?\\b", "i").test(l));
    if (d >= 0) { cur = d; const rest = l.replace(/^\w+[\s:,\-–]*/, ""); if (rest) items.push({ d, t: rest }); continue; }
    if (cur >= 0) items.push({ d: cur, t: l });
  }
  for (const r of radar || []) { const i = Math.round((Date.parse(r.date) - Date.parse(monday)) / 864e5); if (i >= 0 && i < 6) items.push({ d: i, t: (r.title || "Launch") + " (launch, reported)" }); }
  items.sort((a, b) => a.d - b.d);
  const m = (k) => (meta[k] ? meta[k].max : 40), v = {}, DNAME = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const short = (d) => { const x = new Date(Date.parse(monday + "T00:00:00Z") + d * 864e5); return x.getUTCDate() + " " + ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][x.getUTCMonth()]; };
  for (let n = 1; n <= 4; n++) for (const x of ["name", "date", "event", "place", "time", "purpose"]) v["day" + n + "_" + x] = "";
  items.slice(0, 4).forEach((it, i) => { const n = i + 1, tm = (/\b(\d{1,2}[:.]\d{2}\s*(?:am|pm)?|\d{1,2}\s*(?:am|pm))\b/i.exec(it.t) || [])[1] || "", at = (/\b(?:at|@)\s+([^,;]+)/i.exec(it.t) || [])[1] || "";
    const req = /\boptional\b/i.test(it.t) ? "Optional" : /\b(mandatory|must attend|required|compulsory)\b/i.test(it.t) ? "Mandatory" : "";
    v["day" + n + "_name"] = DNAME[it.d]; v["day" + n + "_date"] = short(it.d);
    v["day" + n + "_event"] = clip(it.t.replace(tm, "").replace(/\b(?:at|@)\s+[^,;]+/i, "").replace(/\b(optional|mandatory|must attend|required|compulsory)\b/ig, "").replace(/[\s,;\-–()]+$/, ""), m("day" + n + "_event"));
    v["day" + n + "_time"] = clip(tm, m("day" + n + "_time")); v["day" + n + "_place"] = clip(at, m("day" + n + "_place"));
    v["day" + n + "_purpose"] = clip((req ? req + " · " : "") + itemType(it.t), m("day" + n + "_purpose")); });
  v.focus_strip = clip(focus, m("focus_strip"));
  v.focus_notes = clip(items.map((x) => DNAME[x.d] + ": " + itemType(x.t) + ": " + x.t).join("\n") + (items.length > 4 ? "\n(" + (items.length - 4) + " more item(s) than the slide's 4 slots: in these notes only)" : ""), m("focus_notes"));
  return { values: v, items, overflow: Math.max(0, items.length - 4) };
}
// ---- slide 11, FN Success Tips: one tip a week, rotating topics; never aimed at anyone ----
export const TIPS = [
  { topic: "Etiquette", title: "Reply within the hour", body: ["Answer every client message within an hour, even if only to say when you will have the answer."], why: "WHY IT WORKS: speed is the first proof of service; clients buy from the agent who answers." },
  { topic: "Energy", title: "Bring the energy you want back", body: ["Start every call standing up and smiling; the client hears it."], why: "WHY IT WORKS: people mirror the energy they meet, and confidence is contagious." },
  { topic: "Self-development", title: "Learn one project a week", body: ["Pick one project and learn its prices, plans and handover by heart this week."], why: "WHY IT WORKS: the agent who knows the detail wins the trust and the deal." },
  { topic: "Colleagues", title: "Share one lead you cannot serve", body: ["If a client is outside your area, hand them to a colleague who knows it."], why: "WHY IT WORKS: the team closes more together than any one of us alone." },
  { topic: "Etiquette", title: "Confirm every viewing the day before", body: ["Send a short confirmation with time, place and your number the day before."], why: "WHY IT WORKS: fewer no-shows, and the client feels looked after." },
  { topic: "Self-development", title: "Ask one more question", body: ["Before you pitch, ask one more question about what the client really needs."], why: "WHY IT WORKS: the right question shortens the sale." },
  { topic: "Energy", title: "Protect your first hour", body: ["Use the first hour of the day for calls, not admin."], why: "WHY IT WORKS: clients are fresh, and so are you." },
  { topic: "Colleagues", title: "Say thank you in public", body: ["Thank a colleague by name in the team group when they help you close."], why: "WHY IT WORKS: recognition builds the team that builds the numbers." },
];
export function tipValues(i, meta, prevForm) {
  const t = TIPS[((i % TIPS.length) + TIPS.length) % TIPS.length], m = (k) => (meta[k] ? meta[k].max : 300);
  const body = Array.isArray(prevForm && prevForm.tip_body) ? t.body.map((x) => clip(x, m("tip_body"))) : clip(t.body.join("\n"), m("tip_body"));
  return { tip_headline: clip("FN Success Tips", m("tip_headline")), tip_title: clip(t.title, m("tip_title")), tip_body: body, tip_strip: clip(t.why, m("tip_strip")), tip_sign_eyebrow: clip(t.topic, m("tip_sign_eyebrow")), tip_notes: clip("Tip of the week (" + t.topic + "): " + t.title + ". " + t.body.join(" ") + " " + t.why, m("tip_notes")) };
}
export const SHOUT_TITLE = "SHOUT-OUTS";
export function shoutsFrom(text) {
  return String(text || "").split(/\n+/).map((l) => l.trim()).filter(Boolean).map((l) => { const i = l.indexOf(":"); return i > 0 ? { to: clip(l.slice(0, i), 40), message: clip(l.slice(i + 1), 160) } : { to: "", message: clip(l, 160) }; }).slice(0, 8);
}

