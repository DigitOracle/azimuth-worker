// v830: Reels entries that share a `group` show as ONE card (<details>) that opens to hold them. Offline.
import { cleanReel, readReels, reelsBody, reelsRoute } from "../src/work_reels.js";
let fail = 0; const ok = (c, m, d) => { if (!c) { fail++; console.log("FAIL", m, d === undefined ? "" : JSON.stringify(d)); } else console.log("ok", m); };

// 1. cleanReel keeps `group`, trimmed and capped; drops an empty one; other unknown fields still stripped
const base = { slug: "s-1", title: "T", video_key: "vk" };
ok(cleanReel({ ...base, group: "  Ask   Series " }).group === "Ask Series", "cleanReel keeps group, whitespace collapsed");
ok(cleanReel({ ...base, group: "x".repeat(90) }).group.length === 60, "group capped at 60 characters");
ok(!("group" in cleanReel({ ...base, group: "   " })) && !("group" in cleanReel(base)), "blank or missing group is not set");
ok(!("junk" in cleanReel({ ...base, group: "G", junk: 1 })), "unknown fields are still stripped");

// 2. a mixed index: two groups and three ungrouped, deliberately out of order
const idx = [
  { slug: "solo-old", title: "Solo old", date: "2026-10-01", video_key: "v1" },
  { slug: "ask-10", title: "Ask Series 10 · Broker", date: "2026-11-09", video_key: "a10", group: "Ask Series", caption: "cap ten" },
  { slug: "ask-02", title: "Ask Series 02 · Buyer", date: "2026-11-09", video_key: "a02", group: "Ask Series", caption: "cap two" },
  { slug: "solo-new", title: "Solo new", date: "2026-11-08", video_key: "v2", caption: "cap solo" },
  { slug: "ask-01", title: "Ask Series 01 · Developer", date: "2026-11-09", video_key: "a01", group: "Ask Series" },
  { slug: "tour-b", title: "Tour B", date: "2026-11-01", video_key: "t2", group: 'Tours <b>&"x"' },
  { slug: "solo-undated", title: "Solo undated", video_key: "v3" },
];
const items = idx.map(cleanReel);
const html = reelsBody("k", "", items, "https://x");
const dets = html.match(/<details class=rg[\s\S]*?<\/details>/g) || [];
ok(dets.length === 2, "one <details> card per group", dets.length);
const ask = dets.find((d) => d.includes("Ask Series")) || "";
ok(/<summary>[\s\S]*<b>Ask Series<\/b> · <span class=rgc>3 videos<\/span>[\s\S]*<\/summary>/.test(ask), "summary reads 'Ask Series · 3 videos'");
ok((ask.match(/class=rt /g) || []).length === 3, "the Ask Series card holds its three tiles");
const askSlugs = [...ask.matchAll(/class=rt id="reel_([a-z0-9-]+)"/g)].map((m) => m[1]);
ok(askSlugs.join() === "ask-01,ask-02,ask-10", "inside a group: title ascending, natural order (02 before 10)", askSlugs);
const tour = dets.find((d) => d.includes("tour-b")) || "";
ok(tour.includes("<span class=rgc>1 video</span>"), "a group of one says '1 video'");
ok(!ask.includes("<details open") && !/<details[^>]*\sopen/.test(html), "group cards start collapsed");

// 3. HTML escaping of the group name
ok(tour.includes("Tours &lt;b&gt;&amp;&quot;x&quot;") && !html.includes("Tours <b>"), "group name is escaped");

// 4. groups sit ABOVE the ungrouped tiles; ungrouped keep today's order (newest first, undated last)
const lastDet = html.lastIndexOf("</details>");
const after = html.slice(lastDet);
const loose = [...after.matchAll(/class=rt id="reel_([a-z0-9-]+)"/g)].map((m) => m[1]);
ok(loose.join() === "solo-new,solo-old,solo-undated", "ungrouped tiles below the groups, in the usual order", loose);
ok(html.indexOf("<details") < html.indexOf('id="reel_solo-new"'), "group cards come first");

// 5. every tile's emitted index equals its DOM position (the page script uses querySelectorAll(".rt")[i])
const tiles = html.split(/(?=<div class=rt id="reel_)/).slice(1);
ok(tiles.length === 7, "seven tiles rendered", tiles.length);
let aligned = true; const seen = [];
tiles.forEach((t, pos) => {
  const di = (t.match(/class=rpl type=button data-i=(\d+)/) || [])[1], dp = (t.match(/data-p=(\d+)>Play</) || [])[1];
  seen.push([pos, di, dp]);
  if (+di !== pos || +dp !== pos || di === undefined || dp === undefined) aligned = false;
});
ok(aligned, "data-i and data-p equal the tile's DOM position for grouped and ungrouped tiles", seen);
ok(html.includes('querySelectorAll(".rt")'), "the script still addresses tiles by DOM order");

// 6. no groups at all: the page is exactly what it was (no <details>, same tiles in reelsSorted order)
const plain = reelsBody("k", "", items.map(({ group, ...r }) => r), "https://x");
ok(!plain.includes("<details"), "no group, no <details>");
const plainSlugs = [...plain.matchAll(/class=rt id="reel_([a-z0-9-]+)"/g)].map((m) => m[1]);
ok(plainSlugs.join() === "ask-01,ask-02,ask-10,solo-new,tour-b,solo-old,solo-undated", "ungrouped order unchanged", plainSlugs);
const oneTile = (h, slug) => (h.split(/(?=<div class=rt id="reel_)/).find((t) => t.startsWith('<div class=rt id="reel_' + slug + '"')) || "").split("<style>")[0].split("</div></details>")[0].replace(/data-(i|p)=\d+/g, "data-$1=N");
ok(oneTile(html, "solo-new") === oneTile(plain, "solo-new") && oneTile(html, "solo-new").length > 200, "an ungrouped tile's markup is unchanged");
ok(reelsBody("k", "", [], "https://x").includes("id=reels_empty"), "empty state unchanged");

// 7. deleting a grouped entry keeps the others' group (stored rows, through the route)
const store = new Map([["reels_index", JSON.stringify(idx)], ["vid_a02", "x"], ["vidposter_a02", "p"], ["vid_a01", "y"]]);
const env = { MEETINGS: { get: async (k) => store.get(k) ?? null, put: async (k, v) => store.set(k, v), delete: async (k) => store.delete(k) } };
const deps = { person: () => "najjuko", isNaj: () => true, page: (k, r, b) => b };
const u = "https://x/momo/work/reels/delete?key=k";
const r = await reelsRoute(new Request(u, { method: "POST", body: JSON.stringify({ slug: "ask-02" }) }), env, new URL(u), deps);
ok(r.status === 200 && (await r.json()).deleted === 1, "delete of a grouped entry succeeds");
const rawAfter = JSON.parse(store.get("reels_index"));
ok(!rawAfter.some((x) => x.slug === "ask-02") && rawAfter.length === 6, "only that entry left the index");
ok(rawAfter.filter((x) => x.group === "Ask Series").map((x) => x.slug).sort().join() === "ask-01,ask-10", "the other entries keep their group in the stored index");
ok(rawAfter.find((x) => x.slug === "tour-b").group === 'Tours <b>&"x"', "another group's stored name is untouched");
ok(!store.has("vid_a02") && store.has("vid_a01"), "its video removed, the others kept");
const again = await readReels(env);
ok(again.filter((x) => x.group === "Ask Series").length === 2, "readReels still returns the group after the delete");
const lu = "https://x/momo/work/reels/list?key=k";
const lst = await (await reelsRoute(new Request(lu), env, new URL(lu), deps)).json();
ok(lst.find((x) => x.slug === "ask-01").group === "Ask Series", "the list route carries group");
const pu = "https://x/momo/work/reels?key=k";
const page = await (await reelsRoute(new Request(pu), env, new URL(pu), deps)).text();
ok(page.includes("<span class=rgc>2 videos</span>"), "the page count follows the index after the delete");
process.exit(fail ? 1 : 0);
