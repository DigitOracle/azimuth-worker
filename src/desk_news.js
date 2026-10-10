// v473 - THE DESK NEWS WATCHER (Kendall 10 Oct 2026: "DigitAlchemy ideas: current events relating to AI or tech, upcoming events in Dubai,
// big changes in AI ... Smart City or ISO ... do a deep dive for the sources" + "things like the BIG 5, GITEX ... these watchers should pick
// up these events"). Sources verified 10 Oct 2026 (69 tested: status, items, freshness, robots.txt). Google News RSS is NOT used: its
// robots.txt disallows /rss/ and its terms are personal-use only; Bing News RSS is allowed and stands in. Only headline, link, outlet and
// date are kept - never article text. Event queries carry the current year (without it Bing returns last year's coverage).
// KV desk_news = { at, items: { <cat>: [{ t, link, src, d, feed }] } }, newest 25 per category.

export const NEWS_UA = "DigitAlchemy-desk/1.0 (contact@digitalabbot.io)";
const bing = (q) => "https://www.bing.com/news/search?q=" + encodeURIComponent(q) + "&format=rss&mkt=en-AE";

// cat: ai (global AI/tech), uae (UAE/Dubai tech), events (Dubai trade events), smart (smart city / ISO / BIM), build (projects, tenders)
export function newsFeeds(year) {
  const Y = String(year);
  return [
    { id: "mit_ai", cat: "ai", src: "MIT Technology Review", url: "https://www.technologyreview.com/topic/artificial-intelligence/feed" },
    { id: "tc_ai", cat: "ai", src: "TechCrunch", url: "https://techcrunch.com/category/artificial-intelligence/feed/" },
    { id: "verge_ai", cat: "ai", src: "The Verge", url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml" },
    { id: "cnet_ai", cat: "ai", src: "CNET", url: "https://www.cnet.com/rss/ai/" },
    { id: "cnet_tech", cat: "ai", src: "CNET", url: "https://www.cnet.com/rss/tech/" },
    { id: "wired_ai", cat: "ai", src: "Wired", url: "https://www.wired.com/feed/tag/ai/latest/rss" },
    { id: "ars_ai", cat: "ai", src: "Ars Technica", url: "https://arstechnica.com/ai/feed/" },
    { id: "google_ai", cat: "ai", src: "Google", url: "https://blog.google/technology/ai/rss/" },
    { id: "openai", cat: "ai", src: "OpenAI", url: "https://openai.com/news/rss.xml", max: 8 },
    { id: "bing_ai_reg", cat: "ai", src: null, url: bing("AI regulation") },
    { id: "tn_tech", cat: "uae", src: "The National", url: "https://www.thenationalnews.com/arc/outboundfeeds/rss/category/future/technology/?outputType=xml" },
    { id: "dff", cat: "uae", src: "Dubai Future Foundation", url: "https://www.dubaifuture.ae/feed/" },
    { id: "bing_uae_ai", cat: "uae", src: null, url: bing("UAE artificial intelligence") },
    { id: "bing_dubai_ai", cat: "uae", src: null, url: bing("Dubai AI technology") },
    { id: "bing_wam_ai", cat: "uae", src: null, url: bing("WAM artificial intelligence UAE") },
    { id: "bing_g42", cat: "uae", src: null, url: bing("G42 AI") },
    { id: "bing_mgx", cat: "uae", src: null, url: bing("MGX Abu Dhabi") },
    { id: "ev_gitex", cat: "events", src: null, url: bing("GITEX Global " + Y) },
    { id: "ev_big5", cat: "events", src: null, url: bing("\"Big 5 Global\" Dubai " + Y) },
    { id: "ev_cityscape", cat: "events", src: null, url: bing("Cityscape Global " + Y) },
    { id: "ev_dff", cat: "events", src: null, url: bing("Dubai Future Forum " + Y) },
    { id: "ev_ai_fest", cat: "events", src: null, url: bing("Dubai AI Festival " + Y) },
    { id: "ev_dwtc", cat: "events", src: null, url: bing("\"Dubai World Trade Centre\" event " + Y) },
    { id: "ev_sweep", cat: "events", src: null, url: bing("Dubai conference exhibition " + Y) },
    { id: "ev_dwtc_cal", cat: "events", src: null, url: bing("Dubai World Trade Centre exhibition " + Y) },
    { id: "big5_rss", cat: "events", src: "Big 5 Global", url: "https://www.big5global.com/feed/" },
    { id: "bing_adipec", cat: "events", src: null, url: bing("ADIPEC " + Y) },
    { id: "scd", cat: "smart", src: "Smart Cities Dive", url: "https://www.smartcitiesdive.com/feeds/news/" },
    { id: "cities_today", cat: "smart", src: "Cities Today", url: "https://cities-today.com/feed/" },
    { id: "geo_world", cat: "smart", src: "Geospatial World", url: "https://geospatialworld.net/feed/" },
    { id: "bing_smart_dxb", cat: "smart", src: null, url: bing("smart city Dubai") },
    { id: "bing_iso19650", cat: "smart", src: null, url: bing("ISO 19650") },
    { id: "bing_bim_twin", cat: "smart", src: null, url: bing("BIM digital twin construction") },
    { id: "bing_award", cat: "build", src: null, url: bing("contract awarded Dubai construction") },
    { id: "bing_dm_tender", cat: "build", src: null, url: bing("Dubai Municipality tender") },
    { id: "bing_rta", cat: "build", src: null, url: bing("RTA Dubai project") },
    { id: "bing_etihad_rail", cat: "build", src: null, url: bing("Etihad Rail") },
    { id: "bing_d2040", cat: "build", src: null, url: bing("Dubai 2040 urban master plan") },
  ];
}
export const NEWS_CATS = ["ai", "uae", "events", "smart", "build"];

const unent = (s) => String(s || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (m, n) => String.fromCharCode(Number(n))).replace(/\s+/g, " ").trim();
const tag = (block, name) => { const m = block.match(new RegExp("<" + name + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + name + ">", "i")); return m ? unent(m[1]) : ""; };
// RSS <item> or Atom <entry>; Bing's outlet is in <News:Source>
export function parseFeed(xml, feed) {
  const out = [];
  const blocks = String(xml || "").match(/<item[\s>][\s\S]*?<\/item>|<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  for (const b of blocks.slice(0, feed && feed.max ? feed.max : 30)) {
    const t = tag(b, "title"); if (!t) continue;
    let link = tag(b, "link"); if (!link) { const m = b.match(/<link[^>]*href="([^"]+)"/i); link = m ? m[1] : ""; }
    const d = Date.parse(tag(b, "pubDate") || tag(b, "updated") || tag(b, "published") || tag(b, "dc:date")) || 0;
    const src = (feed && feed.src) || tag(b, "News:Source") || tag(b, "source") || "news";
    if (!/^https?:\/\//.test(link)) continue;
    out.push({ t: t.slice(0, 220), link: link.slice(0, 600), src: String(src).slice(0, 60), d, feed: feed ? feed.id : "" });
  }
  return out;
}

export async function newsGet(env) { try { return JSON.parse((await env.MEETINGS.get("desk_news")) || "null") || { at: 0, items: {}, last: {} }; } catch (e) { return { at: 0, items: {}, last: {} }; } }

// a few feeds per run, oldest-fetched first; every feed refreshed about every 3 hours. deps: { fetch?, now? }
export async function newsTick(env, deps, opts) {
  const f = (deps && deps.fetch) || fetch, now = (deps && deps.now) ? deps.now() : Date.now();
  const st = await newsGet(env); st.last = st.last || {}; st.items = st.items || {};
  const feeds = newsFeeds(new Date(now + 4 * 3600000).getUTCFullYear());
  const due = feeds.filter((x) => now - (st.last[x.id] || 0) >= 3 * 3600000).sort((a, b) => (st.last[a.id] || 0) - (st.last[b.id] || 0)).slice(0, (opts && opts.max) || 6);
  if (!due.length) return { fetched: 0 };
  let got = 0;
  for (const fd of due) {
    st.last[fd.id] = now;
    try {
      const r = await f(fd.url, { headers: { "User-Agent": NEWS_UA, Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" } });
      if (!r.ok) continue;
      const items = parseFeed(await r.text(), fd).filter((i) => !i.d || now - i.d < 30 * 86400000);
      const L = (st.items[fd.cat] || []).concat(items);
      const seen = new Set(); st.items[fd.cat] = L.filter((i) => { const k = i.t.toLowerCase().slice(0, 80); if (seen.has(k)) return false; seen.add(k); return true; })
        .sort((a, b) => (b.d || 0) - (a.d || 0)).slice(0, 25);
      got += items.length;
    } catch (e) {}
  }
  st.at = now; await env.MEETINGS.put("desk_news", JSON.stringify(st), { expirationTtl: 30 * 86400 });
  return { fetched: due.length, items: got };
}

// the headlines handed to the idea writer: id, category, outlet, title (links stay here and are attached to the chosen idea)
export function headlinesFor(st, perCat) {
  const out = [];
  for (const c of NEWS_CATS) (st.items[c] || []).slice(0, perCat || 8).forEach((i, k) => out.push(Object.assign({ id: c + (k + 1), cat: c }, i)));
  return out;
}

// ---------- events with real dates (KV desk_events); the news only flags them, the dates are kept by hand ----------
export const EVENTS_SEED = [
  { name: "Big 5 Global", start: "2026-11-23", end: "2026-11-26", venue: "Dubai World Trade Centre", ours: true, note: "DigitAlchemy stand H4 SC 10, Hall 4" },
  // dates read from the organisers' own pages on 10 Oct 2026 (Big 5: its iCal file; the others: homepage date text). Cityscape's site is the Riyadh show, so not listed.
  { name: "ADIPEC", start: "2026-11-02", end: "2026-11-05", venue: "Abu Dhabi" },
  { name: "GITEX Global", start: "2026-12-07", end: "2026-12-11", venue: "Dubai" },
  { name: "Expand North Star", start: "2026-12-08", end: "2026-12-10", venue: "Dubai" },
];
export async function eventsGet(env) { try { const v = JSON.parse((await env.MEETINGS.get("desk_events")) || "null"); return Array.isArray(v) ? v : EVENTS_SEED.slice(); } catch (e) { return EVENTS_SEED.slice(); } }
export const daysTo = (iso, now) => Math.round((Date.parse(iso + "T00:00:00Z") - Date.parse(new Date(now + 4 * 3600000).toISOString().slice(0, 10) + "T00:00:00Z")) / 86400000);
// countdown points: 30, 14, 7, 1 days before, and the opening day
export function countdownsDue(events, now) {
  return events.map((e) => ({ e, n: daysTo(e.start, now) })).filter((x) => [30, 14, 7, 1, 0].includes(x.n));
}
export function upcoming(events, now, days) { return events.filter((e) => { const n = daysTo(e.start, now); return n >= 0 && n <= (days || 60); }).sort((a, b) => a.start.localeCompare(b.start)); }

// "events" / "event add <name> <yyyy-mm-dd> [<yyyy-mm-dd>] [: note]" / "event remove <name>"
export async function eventsCommand(env, send, t, now) {
  let L = await eventsGet(env), m;
  if ((m = t.match(/^\/?event\s+add\s+(.+?)\s+(\d{4}-\d{2}-\d{2})(?:\s+(\d{4}-\d{2}-\d{2}))?(?:\s*:\s*(.+))?$/i))) {
    L = L.filter((e) => e.name.toLowerCase() !== m[1].toLowerCase()).concat([{ name: m[1].trim(), start: m[2], end: m[3] || m[2], note: (m[4] || "").trim() }]);
    await env.MEETINGS.put("desk_events", JSON.stringify(L)); await send("Added " + m[1].trim() + " on " + m[2] + (m[3] ? " to " + m[3] : "") + ". It will appear in the feeds as it gets close."); return true;
  }
  if ((m = t.match(/^\/?event\s+remove\s+(.+)$/i))) {
    const before = L.length; L = L.filter((e) => e.name.toLowerCase() !== m[1].trim().toLowerCase());
    await env.MEETINGS.put("desk_events", JSON.stringify(L)); await send(before === L.length ? "No event called " + m[1].trim() + "." : "Removed " + m[1].trim() + "."); return true;
  }
  if (/^\/?events?$/i.test(t)) {
    const up = L.slice().sort((a, b) => a.start.localeCompare(b.start)).filter((e) => daysTo(e.end || e.start, now) >= 0);
    await send(up.length ? "Events I count down to:\n" + up.map((e) => e.name + ": " + e.start + (e.end && e.end !== e.start ? " to " + e.end : "") + " (" + daysTo(e.start, now) + " days)" + (e.note ? ". " + e.note : "")).join("\n") + "\nAdd one: event add <name> <yyyy-mm-dd> [<end date>] [: note]" : "No events yet. Add one: event add GITEX Global 2026-12-07 2026-12-11 : DWTC");
    return true;
  }
  return false;
}

// ---------- standard of the week (rotates by ISO week; a carousel explainer) ----------
export const STANDARDS = [
  "ISO 19650: how information is managed across a building's whole life, and why the client's requirements come first",
  "ISO 37120: the city indicators that let Dubai compare itself with other cities",
  "ISO 37122: indicators for smart cities, and what makes a city count as smart",
  "ISO 41001: facility management that starts at design, not at handover",
  "ISO 55000: treating buildings and infrastructure as assets with a whole-life plan",
  "ISO 23247: digital twins for manufacturing, and what construction can borrow from them",
  "ISO 16739 (IFC): the open file format that lets different BIM tools share one model",
  "Dubai Green Building Regulations: what Al Sa'fat asks of new buildings",
  "ISO 14001: environmental management on a live construction site",
  "ISO 45001: site safety management, and how digital inspections prove it",
  "ISO 9001: quality management, and why a paper checklist is not evidence",
  "ISO 37101: sustainable development in communities, the framework behind city strategies",
];
export const standardOfWeek = (now) => STANDARDS[Math.floor((now + 4 * 3600000) / (7 * 86400000)) % STANDARDS.length];
