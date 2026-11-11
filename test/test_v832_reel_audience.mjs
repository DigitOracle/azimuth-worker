// v832: optional `audience` on a reel (person ids). Listed only for those people; no audience = everyone (unchanged). Offline.
import { cleanReel, reelsFor, reelsRoute, reelPublic } from "../src/work_reels.js";
let fail = 0; const ok = (c, m, d) => { if (!c) { fail++; console.log("FAIL", m, d === undefined ? "" : JSON.stringify(d)); } else console.log("ok", m); };
const base = { slug: "s-1", title: "T", video_key: "vk" };
ok(JSON.stringify(cleanReel({ ...base, audience: [" Kendall ", "kendall", "bob"] }).audience) === '["kendall"]', "audience kept, lower-cased, deduped, unknown ids dropped");
ok(!("audience" in cleanReel(base)) && !("audience" in cleanReel({ ...base, audience: [] })) && !("audience" in cleanReel({ ...base, audience: "kendall" })) && !("audience" in cleanReel({ ...base, audience: ["bob"] })), "missing, empty, non-array or all-unknown audience = no field (everyone)");
ok(JSON.stringify(cleanReel(base)) === JSON.stringify({ slug: "s-1", title: "T", video_key: "vk" }), "an entry without audience is cleaned exactly as before");
const idx = [
  { slug: "all-1", title: "All one", date: "2026-11-01", video_key: "a1" },
  { slug: "bio", title: "Bio", date: "2026-11-11", video_key: "b1", group: "Bio", audience: ["kendall"] },
  { slug: "both", title: "Both", date: "2026-11-02", video_key: "b2", audience: ["kendall", "najjuko"] },
];
const items = idx.map(cleanReel);
ok(reelsFor(items, "kendall").map((x) => x.slug).join() === "all-1,bio,both", "kendall sees all three");
ok(reelsFor(items, "najjuko").map((x) => x.slug).join() === "all-1,both", "najjuko does not see the kendall-only reel");
const store = new Map([["reels_index", JSON.stringify(idx)]]);
const env = { MEETINGS: { get: async (k) => store.get(k) ?? null, put: async (k, v) => store.set(k, v), delete: async (k) => store.delete(k) } };
for (const who of ["najjuko", "kendall"]) {
  const deps = { person: () => who, isNaj: () => true, page: (k, r, b) => b };
  const lu = "https://x/momo/work/reels/list?key=k";
  const lst = await (await reelsRoute(new Request(lu), env, new URL(lu), deps)).json();
  const pu = "https://x/momo/work/reels?key=k";
  const page = await (await reelsRoute(new Request(pu), env, new URL(pu), deps)).text();
  const want = who === "kendall";
  ok(lst.some((x) => x.slug === "bio") === want && page.includes('id="reel_bio"') === want, who + ": list and page " + (want ? "show" : "hide") + " the restricted reel");
  ok(lst.some((x) => x.slug === "all-1") && page.includes('id="reel_all-1"'), who + ": unrestricted reel still listed");
}
const pub = await reelPublic(new Request("https://x/reel/bio"), env, new URL("https://x/reel/bio"));
ok(pub.status === 200, "the public /reel/<slug> share link still works for a restricted reel (direct link)");
process.exit(fail ? 1 : 0);
