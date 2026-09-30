// v270 - LIVE CITY NEWS. Kendall, 30 Sep 2026: Etihad Rail's passenger service opened today and the morning feed missed it.
//
// Three pieces, each tested through the worker's own entry points (scheduled + fetch), never by calling helpers directly:
//   A. the collector on the minute tick: a few feeds per 5-minute slot (subrequest budget), 48 h window, de-duplicated by
//      canonical URL (Bing click-through unwrapped) and by title, world news dropped, Dubai entities tagged;
//   B. /news_live: READ_KEY-gated and read-only - no fetch, no KV write;
//   C. the morning feed: the model is handed today's story WITH outlet, time and summary, and a news angle whose number is not
//      in the story it cites is removed before it reaches her (the same honesty rule as the other angles, applied mechanically).
//
// NEGATIVE CONTROL: each of these was reverted in turn and this file re-run - the named assertions failed every time:
//   - remove the liveNewsTick line from the minute tick              -> A2, A5-A7, A9, B3, B4, C1-C3, C5, C6 fail
//   - put the old `news:` line back in dailyFeedTick (mkt_news only) -> C1-C3, C5, C6 fail
//   - remove `|| feedNewsTrue(a, news)` from feedFill's first loop    -> C6 fails (the invented 15% reaches her)
//   - remove the READ_KEY check from /news_live                      -> B1 fails
import worker from "../src/index.js";

const READ = "read_key_for_tests_269";
const store = new Map(); let puts = 0;
const KV = {
  async get(k) { return store.has(k) ? store.get(k) : null; },
  async put(k, v) { puts++; store.set(k, v); },
  async delete(k) { store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter(k => k.startsWith(p)).map(name => ({ name })) }; },
};
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };

const NOW = Date.now();
const rfc = (ms) => new Date(ms).toUTCString();
const KT_URL = "https://www.khaleejtimes.com/uae/transport/etihad-rail-first-passenger-train-dubai-abu-dhabi";
const KT_RSS = `<?xml version="1.0"?><rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>UAE</title>
<item><title>First Etihad Rail passenger train leaves Dubai&apos;s Al Yalayis station for Abu Dhabi</title><link>${KT_URL}</link><pubDate>${rfc(NOW - 120000)}</pubDate><description></description>
<content:encoded><![CDATA[<p>The first passenger train left <a href="x">Al Yalayis</a> station at 6.14am. Etihad Rail will run 10 daily journeys between Dubai and Abu Dhabi, with fares from Dh39.</p>]]></content:encoded></item>
<item><title>Bangkok floods: waters receding, normal conditions expected within days</title><link>https://www.khaleejtimes.com/world/bangkok-floods</link><pubDate>${rfc(NOW - 2 * 3600000)}</pubDate><description>Thai officials said residents should stay alert.</description></item>
<item><title>Dubai villa prices climb in Palm Jumeirah</title><link>https://www.khaleejtimes.com/business/old-villa-story</link><pubDate>${rfc(NOW - 72 * 3600000)}</pubDate><description>An old story.</description></item>
</channel></rss>`;
const BING_RSS = `<?xml version="1.0"?><rss version="2.0" xmlns:News="https://www.bing.com/news/search?q=x&amp;format=rss"><channel><title>Etihad Rail - BingNews</title>
<item><title>First Etihad Rail passenger train leaves Dubai's Al Yalayis station for Abu Dhabi</title><link>http://www.bing.com/news/apiclick.aspx?ref=FexRss&amp;aid=&amp;tid=1&amp;url=${encodeURIComponent(KT_URL + "?utm_source=bing")}&amp;c=1&amp;mkt=en-ae</link><description>The first passenger train left Al Yalayis.</description><pubDate>${rfc(NOW - 90000)}</pubDate><News:Source>Khaleej Times</News:Source></item>
<item><title>Dubai Land Department opens new real estate services centre</title><link>http://www.bing.com/news/apiclick.aspx?ref=FexRss&amp;url=https%3a%2f%2fwww.wam.ae%2fen%2farticle%2fdld-centre&amp;c=2</link><description>The centre serves property owners.</description><pubDate>${rfc(NOW - 5 * 3600000)}</pubDate><News:Source>Emirates News Agency on MSN</News:Source></item>
</channel></rss>`;

let feedHits = [];
const anth = [];
globalThis.fetch = async (url, init) => {
  const u = String(url);
  if (u.startsWith("https://api.anthropic.com/")) {
    const body = JSON.parse(init.body); anth.push(body);
    const sys = typeof body.system === "string" ? body.system : JSON.stringify(body.system || "");
    if (sys.startsWith("You pick FIVE")) return new Response(JSON.stringify({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify({ angles: ANGLES }) }] }), { status: 200 });
    return new Response("{}", { status: 400 });   // every other model call (repair, voice, top-up) gets nothing
  }
  if (/khaleejtimes\.com|thenationalnews\.com|gulfnews\.com|bing\.com/.test(u)) {
    feedHits.push(u);
    if (u.includes("khaleejtimes.com/api/v1/collections/uae.rss")) return new Response(KT_RSS, { status: 200, headers: { "Content-Type": "application/rss+xml" } });
    if (u.includes("bing.com/news/search?q=Etihad+Rail")) return new Response(BING_RSS, { status: 200, headers: { "Content-Type": "application/rss+xml" } });
    return new Response("<html>not found</html>", { status: 404 });
  }
  return new Response("{}", { status: 404 });
};

const baseEnv = { MEETINGS: KV, READ_KEY: READ, MINUTE_TICK: "on", LIVE_NEWS: "on" };
const slot = (ms) => Math.floor(ms / 300000) * 300000;   // a minute divisible by 5
async function tick(env, when) { const ps = []; await worker.scheduled({ cron: "* * * * *", scheduledTime: when }, env, { waitUntil(p) { ps.push(p); } }); await Promise.all(ps); }
const ageFeeds = () => { const s = JSON.parse(store.get("news_live") || "null"); if (!s) return; for (const k of Object.keys(s.feeds)) s.feeds[k].at = new Date(Date.parse(s.feeds[k].at) - 60 * 60000).toISOString(); store.set("news_live", JSON.stringify(s)); };

// A. the collector
{
  feedHits = [];
  await tick(Object.assign({}, baseEnv, { LIVE_NEWS: undefined }), slot(NOW));
  ok(feedHits.length === 0, "A1 LIVE_NEWS off: the minute tick fetches no news feed");

  feedHits = [];
  await tick(baseEnv, slot(NOW));
  ok(feedHits.length > 0 && feedHits.length <= 5, "A2 one 5-minute slot fetches at most 5 feeds (subrequest budget) - fetched " + feedHits.length);

  feedHits = [];
  await tick(baseEnv, slot(NOW) + 2 * 60000);
  ok(feedHits.length === 0, "A3 a minute that is not on the 5-minute slot fetches nothing");

  feedHits = [];
  await tick(baseEnv, slot(NOW) + 5 * 60000);
  ok(feedHits.length === 0 || !feedHits.some(u => u.includes("uae.rss")), "A4 a feed fetched this slot is not fetched again 5 minutes later");

  for (let i = 0; i < 5; i++) { ageFeeds(); await tick(baseEnv, slot(NOW)); }
  const s = JSON.parse(store.get("news_live") || "null") || { items: [] };
  const rail = s.items.filter(x => /etihad rail/i.test(x.title));
  ok(rail.length === 1, "A5 the Etihad Rail story is held exactly once although two feeds carried it (URL and title de-dup) - held " + rail.length);
  const r0 = rail[0] || {};
  ok((r0.entities || []).some(e => e.name === "Etihad Rail" && e.type === "infrastructure") && (r0.entities || []).some(e => e.name === "Al Yalayis"), "A6 it is tagged Etihad Rail (infrastructure) and Al Yalayis");
  ok(r0.outlet === "Khaleej Times" && !!r0.published && /10 daily journeys/.test(r0.summary || ""), "A7 it carries outlet, publish time and a summary from the article");
  ok(!s.items.some(x => /bangkok/i.test(x.title)) && !s.items.some(x => /old-villa-story/.test(x.url)), "A8 world news and a 72-hour-old story are not held");
  const dld = s.items.find(x => /land department/i.test(x.title));
  ok(!!dld && dld.url === "https://www.wam.ae/en/article/dld-centre" && dld.outlet === "Emirates News Agency", "A9 a Bing item is held under its real URL and outlet (click-through unwrapped, 'on MSN' dropped)");
}

// B. /news_live
{
  const r1 = await worker.fetch(new Request("https://azimuth-2.digitalchemy.workers.dev/news_live"), baseEnv, { waitUntil() {} });
  ok(r1.status === 401, "B1 /news_live without the key is unauthorized");
  feedHits = []; const p0 = puts;
  const r2 = await worker.fetch(new Request("https://azimuth-2.digitalchemy.workers.dev/news_live?key=" + READ), baseEnv, { waitUntil() {} });
  const j = await r2.json();
  ok(feedHits.length === 0 && puts === p0, "B2 /news_live is read-only: no feed fetched, nothing written");
  ok(j.held >= 2 && Array.isArray(j.feeds) && j.feeds.some(f => f.id === "kt_uae" && f.status === 200), "B3 it lists what is held and each feed's last fetch");
  const top = (j.morningFeedWouldGet || [])[0] || {};
  ok(/etihad rail/i.test(top.title || "") && top.today === true && top.outlet === "Khaleej Times", "B4 it shows what the morning feed would get - today's Etihad Rail story first");
}

// C. the morning feed (dry run - nothing is sent)
const ANGLES = [
  { hook: "Etihad Rail's first passenger trains left Al Yalayis today, and there will be 10 daily journeys to Abu Dhabi.", figure: "10 daily journeys", source: "reported by Khaleej Times, 30 Sep 2026", buyer: "A buyer near Al Yalayis gains a rail link.", family: "transit", reader: "move" },
  { hook: "Etihad Rail's launch will lift nearby home prices by 15%.", figure: "15%", source: "reported by Khaleej Times, 30 Sep 2026", buyer: "Buy before the rise.", family: "developer", reader: "invest" },
  { hook: "3,098 homes changed hands on the register this month.", figure: "3,098 homes", source: "DLD Open Data, 1 Sep-28 Sep", buyer: "A busy market means choice.", family: "volume", reader: "authority" },
];
{
  store.set("mkt_latest", JSON.stringify({ generatedAt: new Date().toISOString(), transactions: { periodFrom: "2026-09-01", periodTo: "2026-09-28", salesCount: 3098, salesValueAedBn: 9.1, topAreas: [] } }));
  const env = Object.assign({}, baseEnv, { MARKET_BRIEF: "on", ANTHROPIC_API_KEY: "test", WA_ALLOWED: "971500000000" });
  const r = await worker.fetch(new Request("https://azimuth-2.digitalchemy.workers.dev/feed_test?dry=1&key=" + READ), env, { waitUntil() {} });
  const out = await r.text();
  const gen = anth.find(b => String(typeof b.system === "string" ? b.system : JSON.stringify(b.system)).startsWith("You pick FIVE"));
  let data = null; try { const m = gen.messages[0].content; data = JSON.parse(typeof m === "string" ? m : m.map(x => x.text || "").join("")); } catch (e) {}
  const n0 = data && data.news && data.news[0];
  ok(!!n0 && /etihad rail/i.test(n0.title), "C1 the model is handed today's Etihad Rail story");
  ok(!!n0 && n0.today === true && n0.outlet === "Khaleej Times" && /GST$/.test(n0.published || ""), "C2 with its outlet, a Dubai-time publish stamp and today:true");
  ok(!!n0 && /10 daily journeys/.test(n0.summary) && (n0.names || []).includes("Etihad Rail"), "C3 and a summary carrying the figures it may quote, plus the names it mentions");
  ok(!!gen && /today:true item/.test(typeof gen.system === "string" ? gen.system : JSON.stringify(gen.system)), "C4 the prompt tells the model a same-day city story should become an angle, cited to its outlet");
  ok(out.includes("10 daily journeys"), "C5 a news angle whose number is in its story survives");
  ok(!out.includes("15%") && /news: a number in it is not in the Khaleej Times story/.test(out), "C6 a news angle with a number the story does not contain is DROPPED, and the QA line says why");
}

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
