// v425 - Instagram alt text, Meta's AI label and the wider insights on the desk, offline: fake fetch, fake KV. Nothing leaves.   node test/test_v425_deskextras.mjs
import { deskIgPublish, deskIgPublishCarousel, deskIgPull, mediaExtras } from "../src/ig_desk.js";

const store = new Map();
const KV = { async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter(k => k.startsWith(p)).map(name => ({ name })) }; } };
const J = (o, st) => new Response(JSON.stringify(o), { status: st || 200, headers: { "Content-Type": "application/json" } });
let refuseExtras = false, refuseWideInsights = false, n = 0;
const posts = [], insightCalls = [];
globalThis.fetch = async (url, init) => {
  const u = new URL(String(url));
  if (u.pathname === "/v21.0/9001/media") {
    const b = Object.fromEntries(new URLSearchParams(String(init.body)));
    posts.push(b);
    if (refuseExtras && (b.alt_text || b.is_ai_generated)) return J({ error: { message: "(#100) Invalid parameter" } }, 400);
    return J({ id: "C" + (++n) });
  }
  if (/^\/v21\.0\/C\d+$/.test(u.pathname)) return J({ status_code: "FINISHED" });
  if (u.pathname === "/v21.0/9001/media_publish") return J({ id: "POST" + n });
  if (/\/insights$/.test(u.pathname)) {
    const m = u.searchParams.get("metric"); insightCalls.push(m);
    if (refuseWideInsights && m.includes("views")) return J({ error: { message: "(#100) metric not supported" } }, 400);
    return J({ data: m.split(",").map((name, i) => ({ name, values: [{ value: 10 + i }] })) });
  }
  if (u.pathname === "/me") return J({ user_id: "9001", followers_count: 12, media_count: 1 });
  if (/^\/v21\.0\/POST/.test(u.pathname)) return J({ permalink: "https://www.instagram.com/p/x/" });
  return J({});
};
store.set("ig_auth_desk", JSON.stringify({ token: "T", user_id: "9001", expires_at: Date.now() + 30 * 86400000, perms: "instagram_business_basic,instagram_business_content_publish,instagram_business_manage_insights" }));
const env = { MEETINGS: KV };
const sleep = async () => {};
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 300) : "")); } };

// 1. mediaExtras
let p = mediaExtras({ a: 1 }, "  A slide   about\n sign-off ", true);
ok(p.alt_text === "A slide about sign-off" && p.is_ai_generated === "true", "alt text is tidied and the AI label is set");
p = mediaExtras({ a: 1 }, "", false);
ok(!("alt_text" in p) && !("is_ai_generated" in p), "nothing is added when there is no alt text and no AI picture");
ok(mediaExtras({}, "x".repeat(1500), false).alt_text.length === 1000, "alt text is capped at Meta's 1000 characters");

// 2. single image carries both
posts.length = 0;
let r = await deskIgPublish(env, { approved: true, imageUrl: "https://x/ig_media/a", altText: "Alt one", aiGenerated: true, caption: "Hi\n\nIllustration.", sleep });
ok(r.ok && posts[0].alt_text === "Alt one" && posts[0].is_ai_generated === "true", "a single AI picture is sent with alt text and the AI label", JSON.stringify(posts[0]));
posts.length = 0;
r = await deskIgPublish(env, { approved: true, imageUrl: "https://x/ig_media/b", altText: "", aiGenerated: false, caption: "Own photo", sleep });
ok(r.ok && !posts[0].alt_text && !posts[0].is_ai_generated, "an unedited own photo carries no AI label");

// 3. carousel: alt text per slide, AI label on the parent only
posts.length = 0;
r = await deskIgPublishCarousel(env, { approved: true, imageUrls: ["https://x/1", "https://x/2", "https://x/3"], altTexts: ["S1", "S2", ""], aiGenerated: true, caption: "C", sleep });
const kids = posts.filter(b => b.is_carousel_item === "true"), parent = posts.find(b => b.media_type === "CAROUSEL");
ok(r.ok && kids.length === 3 && kids[0].alt_text === "S1" && kids[1].alt_text === "S2" && !kids[2].alt_text, "each slide carries its own alt text");
ok(kids.every(b => !b.is_ai_generated) && parent && parent.is_ai_generated === "true", "the AI label is on the carousel container only");

// 4. Meta refuses the new fields: retried once without them, the post still goes out
refuseExtras = true; posts.length = 0;
r = await deskIgPublish(env, { approved: true, imageUrl: "https://x/c", altText: "Alt", aiGenerated: true, caption: "Hi\n\nIllustration.", sleep });
ok(r.ok && posts.length === 2 && !posts[1].alt_text && !posts[1].is_ai_generated, "a refused label or alt text never holds a single post", JSON.stringify(posts));
posts.length = 0;
r = await deskIgPublishCarousel(env, { approved: true, imageUrls: ["https://x/1", "https://x/2"], altTexts: ["S1", "S2"], aiGenerated: true, caption: "C", sleep });
ok(r.ok, "a refused label or alt text never holds a carousel", JSON.stringify(r));
refuseExtras = false;

// 5. not approved still refuses, before anything is sent
posts.length = 0;
r = await deskIgPublish(env, { approved: false, imageUrl: "https://x/d", altText: "A", aiGenerated: true, caption: "x", sleep });
ok(!r.ok && posts.length === 0, "an unapproved post is still refused and nothing is sent");

// 6. insights: the wide set, with a fallback to the old three
insightCalls.length = 0;
let o = await deskIgPull(env, Date.now(), ["M1"]);
ok(insightCalls[0].includes("views") && insightCalls[0].includes("shares") && insightCalls[0].includes("follows") && !insightCalls[0].includes("impressions"), "insights ask for views, shares and follows, never the retired impressions");
ok(o.media.M1 && o.media.M1.views != null && o.media.M1.shares != null, "the wider measures are stored");
refuseWideInsights = true; insightCalls.length = 0;
o = await deskIgPull(env, Date.now(), ["M2"]);
ok(insightCalls.length === 2 && insightCalls[1] === "reach,likes,saved" && o.media.M2 && o.media.M2.reach != null, "a refused wide request falls back to reach, likes and saves");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
