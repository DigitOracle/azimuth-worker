// v472 + v473 - fresh ideas by tapping; the news watcher; the 9-idea mix (3 news / 2 motivation / 2 DigitAlchemy / 2 smart-ISO);
// events with countdowns; standard of the week; the DigitAlchemy feed at 05:00 and 16:00 (ideas + three drafts), only inside the window. Offline.
import { deskPostRoute, deskMorningTick } from "../src/desk_post.js";
import { parseFeed, newsTick, newsFeeds, countdownsDue, EVENTS_SEED, standardOfWeek, NEWS_UA } from "../src/desk_news.js";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 500) : "")); } };
const store = new Map();
const KV = { async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); }, async list({ prefix } = {}) { return { keys: [...store.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((name) => ({ name })) }; } };
const env = { MEETINGS: KV, WA_DESK_PHONE_ID: "1", WA_DESK_OWNER: "2" };
let clock = Date.UTC(2026, 9, 11, 1, 0);   // 05:00 Dubai, a Sunday

// ---- feeds parse (RSS, Atom, Bing) and the watcher
const rss = `<rss><channel><item><title><![CDATA[OpenAI ships a new model]]></title><link>https://ex.com/a</link><pubDate>Sat, 10 Oct 2026 08:00:00 GMT</pubDate></item><item><title>Old story</title><link>https://ex.com/old</link><pubDate>Mon, 01 Jan 2024 08:00:00 GMT</pubDate></item></channel></rss>`;
const atom = `<feed><entry><title>Smart city twin goes live</title><link href="https://ex.com/b"/><updated>2026-10-09T08:00:00Z</updated></entry></feed>`;
const bingx = `<rss><channel><item><title>Big 5 Global announces finalists</title><link>https://www.bing.com/news/apiclick.aspx?url=x</link><pubDate>Wed, 07 Oct 2026 08:00:00 GMT</pubDate><News:Source>Khaleej Times</News:Source></item></channel></rss>`;
ok(parseFeed(rss, { id: "x", src: "TechCrunch" })[0].t === "OpenAI ships a new model" && parseFeed(atom, { id: "y" })[0].link === "https://ex.com/b" && parseFeed(bingx, { id: "z", src: null })[0].src === "Khaleej Times", "RSS, Atom and Bing feeds are read (title, link, outlet)");
const feeds = newsFeeds(2026);
ok(!feeds.some((f) => /news\.google\.com/.test(f.url)), "no Google News feeds (its robots.txt disallows /rss/)");
ok(feeds.filter((f) => f.cat === "events").every((f) => !/bing/.test(f.url) || /2026/.test(decodeURIComponent(f.url))), "every event search carries the year");
const asked = [];
const fakeFetch = async (u, init) => { asked.push({ u, ua: init.headers["User-Agent"] }); return new Response(/smartcities|cities-today|geospatial|smart|ISO|BIM/i.test(decodeURIComponent(u)) ? atom : /big5|Big\+5|Big 5/i.test(decodeURIComponent(u)) ? bingx : rss); };
for (let i = 0; i < 8; i++) await newsTick(env, { fetch: fakeFetch, now: () => clock });
const ns = JSON.parse(store.get("desk_news"));
ok(asked.every((a) => a.ua === NEWS_UA), "every fetch uses the honest DigitAlchemy user agent");
ok(ns.items.ai && ns.items.ai.length && !ns.items.ai.some((i) => i.t === "Old story"), "items older than 30 days are dropped");
ok(ns.items.smart && ns.items.smart[0].t === "Smart city twin goes live" && ns.items.events.some((i) => /Big 5/.test(i.t)), "categories fill (smart city, events)");
const before = asked.length; await newsTick(env, { fetch: fakeFetch, now: () => clock });
ok(asked.length === before, "a source is not read again within 3 hours");

// ---- the 9-idea mix
const ideasJson = (u) => { const ids = (u.match(/^(ai|uae|events|smart|build)\d+/gm) || []); const ai = ids.find((x) => x.startsWith("ai")), ev = ids.find((x) => x.startsWith("events")) || ai, sm = ids.find((x) => x.startsWith("smart")) || ai;
  return JSON.stringify({ ideas: [
    { slot: "news", text: "What the new model means for site reports", ref: ai }, { slot: "news", text: "Big 5 Global finalists and what they signal", ref: ev }, { slot: "news", text: "An invented story with no source", ref: "zz9" },
    { slot: "motivation", text: "Small habits on hard days" }, { slot: "motivation", text: "Gratitude before breakfast" },
    { slot: "alchemy", text: "Behind the build: a digital inspection, start to finish" }, { slot: "alchemy", text: "Myth or fact: AI replaces site engineers" },
    { slot: "smart", text: "A city twin goes live: three lessons for Dubai", ref: sm }, { slot: "smart", text: "Standard of the week explained", ref: "std" }] }); };
const prompts = [], texts = [], lists = [], btns = [];
const deps = { send: async (e, t) => texts.push(t), buttons: async (e, b, x) => btns.push({ b, x }), list: async (e, body, button, rows) => lists.push(rows), image: async () => {}, fetchMedia: async () => ({}), origin: () => "https://w.dev", now: () => clock, sleep: async () => {},
  llm: async (e, sys, user) => { prompts.push({ sys, user }); return /social-post ideas/.test(sys) ? ideasJson(user) : "{}"; } };
const say = async (t) => { texts.length = 0; lists.length = 0; btns.length = 0; return deskPostRoute(env, { type: "text", text: { body: t } }, t, deps); };
const tap = async (id) => { texts.length = 0; lists.length = 0; btns.length = 0; return deskPostRoute(env, { type: "interactive", interactive: { list_reply: { id } } }, "", deps); };

await say("/ideas");
const L = JSON.parse(store.get("desk_ideas"));
ok(L.length === 9 && L.map((o) => o.kind).join(",") === "news,news,news,motivation,motivation,alchemy,alchemy,smart,smart", "nine ideas in the order 3 news, 2 motivation, 2 DigitAlchemy, 2 smart/ISO", L.map((o) => o.kind).join(","));
ok(!L.some((o) => /invented story/.test(o.text)), "a news idea with no real headline behind it is dropped");
ok(L.filter((o) => o.kind === "news" && !o.countdown).every((o) => /^https:\/\//.test(o.link)) && /Source: /.test(texts.join("")), "each news idea carries its source link");
ok(L.some((o) => o.kind === "smart" && /standard of the week/i.test(o.src + o.text)), "the standard of the week is one of the smart slots");
ok(/HEADLINES/.test(prompts.at(-1).user) && /UPCOMING EVENTS:[\s\S]*Big 5 Global \| 2026-11-23/.test(prompts.at(-1).user) && /STANDARD OF THE WEEK: /.test(prompts.at(-1).user), "the writer gets headlines, upcoming events and the standard of the week");
ok(lists[0] && lists[0].length === 9 && /News/.test(lists[0][0].title) && lists[0].every((r) => r.title.length <= 24), "the nine come as a tap list with category labels");
await tap("dp:fn:4");
ok(/Idea 4:/.test(texts.join("")), "tapping an idea picks it");

// ---- events and countdowns
ok(EVENTS_SEED.some((e) => e.name === "Big 5 Global" && e.start === "2026-11-23" && e.ours) && EVENTS_SEED.some((e) => e.name === "GITEX Global" && e.start === "2026-12-07"), "Big 5 Global (ours) and GITEX are listed with their organisers' dates");
ok(countdownsDue(EVENTS_SEED, Date.UTC(2026, 9, 24, 5)).some((x) => x.e.name === "Big 5 Global" && x.n === 30), "30 days before Big 5 a countdown is due");
await say("event add Intersec 2027-01-12 2027-01-14 : DWTC");
ok(JSON.parse(store.get("desk_events")).some((e) => e.name === "Intersec" && e.end === "2027-01-14"), "event add keeps a new event with its dates");
await say("events"); ok(/Big 5 Global: 2026-11-23/.test(texts.join("")) && /Intersec/.test(texts.join("")), "events lists them with days to go");
clock = Date.UTC(2026, 9, 24, 3, 0); await say("/ideas");
ok(/30 days to Big 5 Global\. Come and see us: DigitAlchemy stand H4 SC 10/.test(JSON.parse(store.get("desk_ideas"))[0].text), "on the day, the countdown leads the news ideas", JSON.parse(store.get("desk_ideas"))[0].text);
ok(standardOfWeek(Date.UTC(2026, 9, 11)) !== standardOfWeek(Date.UTC(2026, 9, 18)), "the standard of the week changes weekly");

// ---- the feed at 05:00 and 16:00
store.delete("desk_morning_state"); store.delete("desk_feed_hours"); store.delete("desk_morning_hour");
clock = Date.UTC(2026, 9, 12, 0, 30); store.set("wa_desk_last_in", new Date(clock - 3600000).toISOString());   // 04:30 Dubai
texts.length = 0; let r = await deskMorningTick(env, deps); ok(r.skipped === "not the hour" && !texts.length, "nothing at 04:30");
clock = Date.UTC(2026, 9, 12, 1, 1); texts.length = 0; lists.length = 0; r = await deskMorningTick(env, deps);
ok(/Good morning/.test(texts.join("")) && lists[0] && lists[0].length === 9, "05:00: good morning and the nine ideas to tap");
for (let i = 0; i < 3; i++) { clock += 60000; await deskMorningTick(env, deps); }
const am = [...store.keys()].filter((k) => k.startsWith("postplan_")).map((k) => JSON.parse(store.get(k))).filter((p) => p.morning === "2026-10-12@5");
ok(am.length === 3 && am.some((p) => p.background === "skyline") && am.some((p) => p.kind === "motivation" && p.background === "terrace") && am.some((p) => p.picture === "site"), "three drafts: a news one, a motivational one, a DigitAlchemy one", JSON.stringify(am.map((p) => [p.lane, p.kind, p.background])));
ok(am.every((p) => p.approved !== true), "nothing approved or posted on its own");
clock += 60000; texts.length = 0; r = await deskMorningTick(env, deps); ok(r.done || r.skipped, "05:00 runs once");
clock = Date.UTC(2026, 9, 12, 12, 0); texts.length = 0; lists.length = 0; store.set("wa_desk_last_in", new Date(clock - 3600000).toISOString()); r = await deskMorningTick(env, deps);   // 16:00 Dubai
ok(/Good afternoon/.test(texts.join("")) && lists[0] && lists[0].length === 9, "16:00: the afternoon feed");
for (let i = 0; i < 3; i++) { clock += 60000; await deskMorningTick(env, deps); }
const pm = [...store.keys()].filter((k) => k.startsWith("postplan_")).map((k) => JSON.parse(store.get(k))).filter((p) => p.morning === "2026-10-12@16");
ok(pm.length === 3, "and its three drafts", pm.length);
store.delete("desk_morning_state"); clock = Date.UTC(2026, 9, 13, 1, 0); store.set("wa_desk_last_in", new Date(clock - 30 * 3600000).toISOString()); texts.length = 0;
r = await deskMorningTick(env, deps); ok(r.skipped === "window closed" && !texts.length, "24-hour window closed: skipped quietly");
await say("feed times 6,15"); ok(store.get("desk_feed_hours") === "6,15" && /06:00 and 15:00/.test(texts.join("")), "feed times 6,15 changes the hours");
await say("feed times off"); ok(store.get("desk_feed_hours") === "off", "feed times off");
await say("feed times 5,16"); ok(store.get("desk_feed_hours") === "5,16", "back to 05:00 and 16:00");
// v474 - "feed now": ideas at once, then the three drafts on the next ticks, never doubled
store.delete("desk_morning_state"); clock = Date.UTC(2026, 9, 14, 15, 10); store.set("wa_desk_last_in", new Date(clock - 60000).toISOString());   // 19:10 Dubai, not a feed hour
await say("feed now");
ok(/Fresh DigitAlchemy feed/.test(texts.join("")) && lists[0] && lists[0].length === 9, "feed now: the ideas straight away");
for (let i = 0; i < 3; i++) { clock += 60000; await deskMorningTick(env, deps); }
const fn = [...store.keys()].filter((k) => k.startsWith("postplan_")).map((k) => JSON.parse(store.get(k))).filter((p) => p.morning === "2026-10-14@19");
ok(fn.length === 3, "then the three drafts, outside the scheduled hours", fn.length);
await say("feed now"); ok(lists[0] && lists[0].length === 9, "feed now again after it finished gives a fresh one");
await say("feed now"); ok(/already on its way/.test(texts.join("")), "but not while one is still arriving");
console.log("\n" + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
