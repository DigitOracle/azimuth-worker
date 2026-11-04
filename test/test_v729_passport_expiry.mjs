// v729 - Building Passports expire 24 hours after they are made (Kendall, 4 Nov 2026: "remove [passports] after we run it because
// the listings will change, it's not static"). A passport is a snapshot, never a library.
import fs from "fs";
const B = await import("../src/building_passports.js");
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 600)); } };

function memKV(init) {
  const m = new Map(Object.entries(init || {})), opts = new Map();
  return { m, opts, async get(k) { return m.has(k) ? m.get(k) : null; }, async put(k, v, o) { m.set(k, v); opts.set(k, o); }, async delete(k) { m.delete(k); },
    async list({ prefix }) { return { keys: [...m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; } };
}
const H = 3600e3, NOW = Date.parse("2026-11-04T20:00:00Z");
const P1 = "naj:plot:3265635", P2 = "naj:plot:3466876";
const iso = (ms) => new Date(ms).toISOString();
const files = (slug) => ({ ["bpp_file_" + slug + "_html"]: "<h>", ["bpp_file_" + slug + "_pdf"]: "%PDF", ["bpp_file_" + slug + "_csv"]: "a,b", ["bpp_photo_" + slug]: "{}", ["bpp_img_" + slug]: "jpg" });

// ---------- clock
ok(B.BPP_KEEP_S === 86400, "kept 24 hours");
ok(B.cleanEntry({ slug: "a", title: "A", made: iso(NOW) }).made === iso(NOW), "cleanEntry keeps the made time");
ok(B.cleanEntry({ slug: "a", title: "A", made: "junk" }).made === undefined, "bad made time dropped");
ok(!B.bppExpired({ made: iso(NOW - 23 * H) }, NOW) && B.bppExpired({ made: iso(NOW - 24 * H) }, NOW), "expires at exactly 24 h");
ok(B.bppExpired({ date: "2026-11-02" }, NOW) && !B.bppExpired({ date: "2026-11-05" }, NOW), "old entries without a time fall back to the start of their GST day");
ok(B.bppLeftText(5 * H + 7 * 60e3) === "5 h 7 min left" && B.bppLeftText(30e3) === "1 min left" && B.bppLeftText(-1) === "expiring now", "time-left text");
ok(B.bppTtl("u-bora-3466876").expirationTtl === 86400 && B.bppTtl("t-test") === undefined, "TTL on passports, never on photo-test keys");

// ---------- plan
{
  const idx = [{ slug: "old-3265635", title: "Old", plot_id: P1, date: "2026-11-03", made: iso(NOW - 25 * H) }, { slug: "new-3466876", title: "New", plot_id: P2, date: "2026-11-04", made: iso(NOW - 2 * H) }];
  const reqs = [{ id: "aaaaaa1", status: "done", at: iso(NOW - 26 * H), updated: iso(NOW - 25 * H) }, { id: "aaaaaa2", status: "failed", at: iso(NOW - 30 * H) },
    { id: "aaaaaa3", status: "done", updated: iso(NOW - 2 * H) }, { id: "aaaaaa4", status: "writing", at: iso(NOW - 48 * H) }, { id: "aaaaaa5", status: "needs a plot number", at: iso(NOW - 25 * H) }];
  const p = B.bppExpirePlan(idx, reqs, NOW);
  ok(p.index.length === 1 && p.index[0].slug === "new-3466876", "fresh passport kept", p.index);
  ok(p.expired.length === 1 && B.bppSlugKeys("old-3265635").every((k) => p.keys.includes(k)), "every key of the expired passport planned", p.keys);
  ok(p.jobs.sort().join() === "aaaaaa1,aaaaaa2,aaaaaa5", "finished + failed jobs past 24 h go; running and fresh stay", p.jobs);
}

// ---------- bppExpire against KV (tick-driven)
{
  const kv = memKV(Object.assign({
    bpp_index: JSON.stringify([{ slug: "old-3265635", title: "Old", plot_id: P1, date: "2026-11-03", made: iso(NOW - 25 * H) }, { slug: "new-3466876", title: "New", plot_id: P2, date: "2026-11-04", made: iso(NOW - H) }]),
    bpp_requests: JSON.stringify(["aaaaaa1", "aaaaaa3", "aaaaaa4"]),
    bpp_req_aaaaaa1: JSON.stringify({ id: "aaaaaa1", status: "done", updated: iso(NOW - 25 * H) }),
    bpp_req_aaaaaa3: JSON.stringify({ id: "aaaaaa3", status: "done", updated: iso(NOW - H) }),
    bpp_req_aaaaaa4: JSON.stringify({ id: "aaaaaa4", status: "pending", at: iso(NOW - 30 * H) }),
    bpp_logo_png: "L", bpp_photo_test_token: "T", "bpp_imgcount_2026-11-03": "3", "bpp_photo_t-x": "{}", "bpp_img_t-x": "j" }, files("old-3265635"), files("new-3466876")));
  const env = { MEETINGS: kv };
  const r = await B.bppTick(env, NOW);   // no OPENAI key: the prune still runs
  ok(r.idle === "no key", "tick still idles without a key", r);
  ok(B.bppSlugKeys("old-3265635").every((k) => !kv.m.has(k)), "expired files, photo and picture deleted");
  ok(B.bppSlugKeys("new-3466876").every((k) => kv.m.has(k)), "fresh passport untouched");
  const ix = JSON.parse(kv.m.get("bpp_index"));
  ok(ix.length === 1 && ix[0].slug === "new-3466876", "index entry pruned", ix);
  ok(!kv.m.has("bpp_req_aaaaaa1") && kv.m.has("bpp_req_aaaaaa3") && kv.m.has("bpp_req_aaaaaa4"), "old finished job deleted, fresh + pending kept");
  ok(JSON.parse(kv.m.get("bpp_requests")).join() === "aaaaaa3,aaaaaa4", "request list agrees");
  ok(["bpp_logo_png", "bpp_photo_test_token", "bpp_imgcount_2026-11-03", "bpp_photo_t-x", "bpp_img_t-x"].every((k) => kv.m.has(k)), "logo, test token, counters, t- photos left alone");
  // readBppIndex hides an expired entry even before a tick has pruned it
  kv.m.set("bpp_index", JSON.stringify([{ slug: "z-1", title: "Z", plot_id: P1, made: iso(Date.now() - 25 * H) }, { slug: "y-2", title: "Y", plot_id: P2, made: iso(Date.now() - H) }]));
  const live = await B.readBppIndex(env);
  ok(live.length === 1 && live[0].slug === "y-2", "list never shows one past 24 h", live);
}

// ---------- writes carry the TTL
{
  const kv = memKV({}); const env = { MEETINGS: kv };
  await B.bppPhoto(env, "u-bora-3466876", { name: "U", area: "A" }, {}, NOW);
  ok(kv.opts.get("bpp_photo_u-bora-3466876") && kv.opts.get("bpp_photo_u-bora-3466876").expirationTtl === 86400, "photo record written with a 24 h TTL");
  await B.bppPhoto(env, "t-x", { name: "U", area: "A" }, {}, NOW);
  ok(kv.opts.get("bpp_photo_t-x") === undefined, "photo-test record has no TTL");
  const src = fs.readFileSync(new URL("../src/building_passports.js", import.meta.url), "utf8");
  ["_csv\", fin.csv, bppTtl(r.slug)", "_html\", snapshotNote(full, made), bppTtl(r.slug)", "_pdf\", pdf, bppTtl(r.slug)", "b64ToBytes(b64), bppTtl(slug)"].forEach((s) => ok(src.includes(s), "TTL on write: " + s));
  ok(/date: todayGst\(now\), made,/.test(src), "index entry records when it was made");
  ok(/bppExpire\(env, now\)[^\n]*\n\s*if \(!env\.OPENAI_API_KEY\)/.test(src), "prune runs before the key check, every tick");
}

// ---------- snapshot line on the page and PDF
{
  const h = B.snapshotNote("<!doctype html><html><body class=x><div class=page>p</div></body></html>", "2026-11-04T16:05:00Z");
  ok(h.includes("Snapshot made 2026-11-04 20:05 GST; listings change daily, generate a fresh one before sending."), "snapshot line with GST date time", h);
  ok(/<body class=x><div class="bpp-snap"/.test(h) && /position:fixed/.test(h), "placed right after <body>, fixed (no extra page)");
  const src = fs.readFileSync(new URL("../src/building_passports.js", import.meta.url), "utf8");
  ok(/renderPdf\(env, snapshotNote\(/.test(src), "PDF render carries the snapshot line");
}

// ---------- the card
{
  const items = [{ slug: "u-bora-3466876", title: "U Bora", plot_id: P2, date: "2026-11-04", made: iso(NOW - 3 * H), html: true, pdf: true }];
  const body = B.bppBody("k", "", items, [], "https://x", "kendall", NOW);
  ok(body.includes("Ready to download (kept 24 hours) (1)"), "renamed list heading");
  ok(!body.includes("Passports made"), "old heading gone");
  ok(body.includes("21 h 0 min left"), "time left shown", body.slice(body.indexOf("bpp_list"), body.indexOf("bpp_list") + 800));
  ok(body.includes("generate a fresh one before sending"), "card explains the snapshot");
}

// ---------- same plot + reader always builds fresh: a new request is pending and is built, never served from storage
{
  const src = fs.readFileSync(new URL("../src/building_passports.js", import.meta.url), "utf8");
  ok(/status: "pending" \}\)/.test(src) && !/readBppIndex\(env\)[^\n]*op === "request"/.test(src), "request always queues a new build");
}

// ---------- coordinator additions: live status, reader actually built, no model names, assumptions on page 3
{
  ok(B.reqWho({ reader: "investor", reader_used: "developer" }) === "for a developer (empty plot; investor view needs a built plot)", "empty plot: says the developer view was built");
  ok(B.reqWho({ reader: "investor", reader_used: "investor" }) === "for an investor" && B.reqWho({ reader: "investor" }) === "for an investor", "same reader unchanged");
  ok(/built plot; developer view needs an empty plot/.test(B.reqWho({ reader: "developer", reader_used: "broker" })), "built plot asked as developer");
  ok(B.bppElapsed({ at: iso(NOW - 2 * 60e3) }, NOW) === "2 min" && B.bppElapsed({ at: iso(NOW - 75 * 60e3) }, NOW) === "1 h 15 min", "elapsed text");
  const reqs = [{ id: "bbbbbb1", text: "3466876", reader: "investor", reader_used: "developer", status: "fixing", at: iso(NOW - 3 * 60e3) }];
  const body = B.bppBody("k", "", [], reqs, "https://x", "kendall", NOW);
  ok(body.includes('data-id="bbbbbb1"') && body.includes("3 min") && body.includes("for a developer (empty plot"), "request row: id, elapsed, built view");
  const scripts = [...body.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  let parsed = true; scripts.forEach((c) => { try { new Function(c); } catch (e) { parsed = false; console.log(e.message); } });
  ok(scripts.length >= 2 && parsed, "card scripts parse");
  ok(scripts.some((c) => /op:"status"/.test(c) && /15000/.test(c) && /location\.reload/.test(c)), "poll every 15 s, reload when done");
  const kv = memKV({ bpp_requests: JSON.stringify(["bbbbbb1", "bbbbbb2"]), bpp_req_bbbbbb1: JSON.stringify(reqs[0]), bpp_req_bbbbbb2: JSON.stringify({ id: "bbbbbb2", text: "x", reader: "broker", status: "failed", msg: "The writer stopped (x).", at: iso(Date.now()) }) });
  const deps = { person: () => "kendall", page: (k, rk, b) => b };
  const res = await B.bppRoute(new Request("https://x/momo/work/passports/api", { method: "POST", body: JSON.stringify({ op: "status", ids: ["bbbbbb1", "zzzzzz9", "../bad"] }) }), { MEETINGS: kv }, new URL("https://x/momo/work/passports/api"), deps);
  const j = await res.json();
  ok(j.ok && j.requests.length === 1 && j.requests[0].status === "fixing" && j.requests[0].label === "Being made (fitting to 3 pages)" && j.requests[0].reader_used === "developer" && /developer/.test(j.requests[0].who), "status op returns the live rows", j);
  const src = fs.readFileSync(new URL("../src/building_passports.js", import.meta.url), "utf8");
  ok(!/(msg = |new Error\()"ChatGPT/.test(src) && !/msg = "[^"]*(ChatGPT|OpenAI|GPT)/.test(src), "no AI model named in any user-visible message");
  ok(/ASSUMPTIONS table goes on PAGE 3, never page 2/.test(src) && /two-column grid/.test(src), "assumptions table compact, on page 3");
}

console.log("v729 passport expiry: " + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
