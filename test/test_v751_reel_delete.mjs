// v751: Reels Delete button + POST /momo/work/reels/delete
import { reelsBody, reelsRoute } from "../src/work_reels.js";
const store = new Map(Object.entries({
  reels_index: JSON.stringify([
    { slug: "a-one", title: "A one", video_key: "va" }, { slug: "b-two", title: "B two", video_key: "vb" }, { slug: "c-dup", title: "C dup", video_key: "vb" }]),
  vid_va: "x", vidposter_va: "p", vid_vb: "y", vidposter_vb: "q" }));
const env = { MEETINGS: { get: async (k) => store.get(k) ?? null, put: async (k, v) => store.set(k, v), delete: async (k) => store.delete(k) } };
const deps = { person: () => "kendall", isNaj: () => true, page: (k, r, b) => b };
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } else console.log("ok", m); };
const html = reelsBody("k", "", JSON.parse(store.get("reels_index")), "https://x");
ok((html.match(/class="b d rd"/g) || []).length === 3, "a Delete button on every reel");
ok(html.includes("/momo/work/reels/delete?key=k"), "delete posts to the route with the key");
const del = (slug) => reelsRoute(new Request("https://x/momo/work/reels/delete?key=k", { method: "POST", body: JSON.stringify({ slug }) }), env, new URL("https://x/momo/work/reels/delete?key=k"), deps);
let r = await del("a-one"); ok(r.status === 200, "delete a-one 200");
ok(!JSON.parse(store.get("reels_index")).some((x) => x.slug === "a-one"), "a-one gone from index");
ok(!store.has("vid_va") && !store.has("vidposter_va"), "a-one video + poster deleted");
r = await del("b-two"); ok(store.has("vid_vb"), "shared video kept while c-dup still uses it");
r = await del("../x"); ok(r.status === 400, "bad slug refused");
const other = await reelsRoute(new Request("https://x/momo/work/reels/delete", { method: "POST", body: "{}" }), env, new URL("https://x/momo/work/reels/delete"), { ...deps, person: () => "someone" });
ok(other.status === 404, "not Kendall/Najjuko -> 404");
process.exit(fail ? 1 : 0);
