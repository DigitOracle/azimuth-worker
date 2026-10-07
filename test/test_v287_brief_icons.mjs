// v287 (Kendall, 1 Oct 2026: "add icons or emojis" on the Brief steps) and the 64-character ingest name.
//   I  every Brief choice carries its emoji, decorative only (aria-hidden), and the button's data-v / data-l are unchanged
//   N  POST /ingest_market keeps an image name up to 64 characters (ejari_filed_recent_dubaiinvestmentparkfirst is 43)
//   D  the contracts page's developer view on the filed basis: those files carry the developer's name and no number, so the
//      live v283.1 page said Emaar signed 0 in a month (Kendall, 1 Oct: "this is not possible"); rows are now matched on the name
// NEGATIVE CONTROL: run against the v286 source (before this release) - the I and N checks fail.
//
//   node test/test_v287_brief_icons.mjs
import worker from "../src/index.js";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 300) : "")); } };
const READ = "owner_key_v287", CLIENT = "client_key_v287";
const store = new Map();
const KV = { async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); }, async list() { return { keys: [] }; } };
globalThis.fetch = async () => new Response("{}", { status: 200 });
const env = { MEETINGS: KV, READ_KEY: READ, CLIENT_KEY: CLIENT, INGEST_TOKEN: "ING", PUBLIC_ORIGIN: "https://azimuth-2.digitalchemy.workers.dev" };
const ORIGIN = "https://azimuth-2.digitalchemy.workers.dev";
const call = (p, init) => worker.fetch(new Request(ORIGIN + p, init), env, { waitUntil() {} });

console.log("I - the Brief's emojis");
const html = await (await call("/brief?key=" + READ)).text();
for (const [v, e] of [["rent", "🔑"], ["buy", "🏠"], ["studio", "🛋️"], ["townhouse", "🏘️"], ["villa", "🏡"]])
  ok(new RegExp("data-v=" + v + "><span class=ic aria-hidden=true>" + e + "</span>").test(html), "the " + v + " button carries " + e);
for (const [k, e] of [["metro", "🚇"], ["schools", "🏫"], ["gym", "🏋️"], ["parking", "🅿️"], ["balcony", "🌇"]])
  ok(html.includes("data-k=" + k + "><div class=wl><span class=ic aria-hidden=true>" + e + "</span>"), "the " + k + " row carries " + e);
for (const k of ["furnished", "private_pool", "community_pool", "pets", "modern", "long_term"]) ok(!html.includes("data-k=" + k) && !html.includes("data-v=" + k), "v374 the " + k + " question is gone from the Brief");
ok(html.includes("data-l=must><span class=ic aria-hidden=true>⭐</span>Must</button>"), "Must carries a star");
ok(html.includes("data-l=nice><span class=ic aria-hidden=true>👍</span>Nice to have</button>"), "Nice to have carries a thumbs-up");
ok(html.includes(".ic{margin-right:6px"), "the icon has its spacing rule");
ok(!/<span class=ic>/.test(html), "every icon is hidden from screen readers");

console.log("N - a 64-character image name");
const nm = "ejari_filed_recent_dubaiinvestmentparkfirst";
const r = await call("/ingest_market", { method: "POST", headers: { "X-Azimuth-Ingest": "ING", "Content-Type": "application/json" }, body: JSON.stringify({ imageName: nm, image: Buffer.from("{\"a\":1}").toString("base64"), contentType: "application/json" }) });
ok(r.status === 200, "the ingest answers 200", r.status + " " + (await r.clone().text()).slice(0, 200));
ok(store.has("img_" + nm), "stored under the full name, not cut at 40", [...store.keys()].filter((k) => k.startsWith("img_")).join(", "));

console.log("D - a developer on the filed basis (the filed files carry the name, never the number)");
{
  const { ejariAnswer } = await import("../src/ejari_page.js");
  const row = (o) => Object.assign({ district: "businessbay", area: "Business Bay", dld_project_number: 7, key: "dld:p", beds: "1", sub_type: "Flat", usage: "Residential", reg_type: "New", contracts: 1, props: 1, rent_median: null, rent_q1: null, rent_q3: null, desk_like: false }, o);
  const s2 = new Map();
  s2.set("img_ejari_recent_businessbay", JSON.stringify({ as_of: "2026-09-30", district: "businessbay", rows: [
    row({ date: "2026-09-20", dld_project: "P ONE", developer_number: 501, developer: "EMAAR DEVELOPMENT P.J.S.C." }),
    row({ date: "2026-09-21", dld_project: "P TWO", developer_number: 777, developer: "OTHER DEVELOPER L.L.C" }) ] }));
  s2.set("img_ejari_filed_businessbay", JSON.stringify({ as_of: "2026-10-01", basis: "filed", district: "businessbay", rows: [
    row({ date: "2026-09-29", dld_project: "P ONE", developer_number: null, developer: "EMAAR  DEVELOPMENT P.J.S.C.", contracts: 5 }),
    row({ date: "2026-09-30", dld_project: "P ONE", developer_number: null, developer: "emaar development p.j.s.c.", contracts: 3 }),
    row({ date: "2026-09-30", dld_project: "P TWO", developer_number: null, developer: "OTHER DEVELOPER L.L.C", contracts: 9 }) ] }));
  const KV2 = { async get(k, t) { const v = s2.has(k) ? s2.get(k) : null; if (v == null) return null; return t === "arrayBuffer" ? new TextEncoder().encode(v).buffer : v; }, async put() {}, async list() { return { keys: [] }; } };
  const a = await ejariAnswer({ MEETINGS: KV2 }, { kind: "developer", id: "501", basis: "filed", range: "week" });
  const n = (a._rows || []).reduce((s, r) => s + (+r.n || 0), 0);
  ok(!a.notFound && a.basis === "filed", "Emaar is found on the filed basis", JSON.stringify(a).slice(0, 200));
  ok(n === 8, "Emaar's filed rows are matched on the name (5 + 3), the other developer's 9 are not", n);
}

console.log("S - Advertised supply: a real district with no adverts yet (v287.1, \"damac hills\")");
{
  const s3 = new Map();
  s3.set("img_pf_supply_businessbay", JSON.stringify({ district: "businessbay", crawled_at: "2026-10-01T08:00:00Z", buildings: [] }));
  const KV3 = { async get(k, t) { const v = s3.has(k) ? s3.get(k) : null; if (v == null) return null; return t === "arrayBuffer" ? new TextEncoder().encode(v).buffer : v; }, async put(k, v) { s3.set(k, v); }, async delete(k) { s3.delete(k); },
    async list(o) { const p = (o && o.prefix) || ""; return { keys: [...s3.keys()].filter((k) => k.startsWith(p)).map((name) => ({ name })), list_complete: true }; } };
  const env3 = Object.assign({}, env, { MEETINGS: KV3 });
  const get3 = (p) => worker.fetch(new Request(ORIGIN + p), env3, { waitUntil() {} }).then((r) => r.text());
  const h1 = await get3("/supply?key=" + READ + "&q=" + encodeURIComponent("damac hills"));
  ok(/No adverts fetched for DAMAC Hills yet/i.test(h1), "\"damac hills\" says no adverts fetched yet, not \"no district by that name\"", (h1.match(/id=sunone>[^<]*/) || [""])[0]);
  ok(/class=rf data-district="damachills"[^>]*>Fetch the adverts for DAMAC Hills now/i.test(h1), "and offers to fetch DAMAC Hills now");
  const h2 = await get3("/supply?key=" + READ + "&q=" + encodeURIComponent("zzqx nowhere"));
  ok(/No building or district by that name/.test(h2) && !/Fetch the adverts/.test(h2), "a name that is no district still says so, with no fetch button");
  const h3 = await get3("/supply?key=" + READ + "&d=damachills");
  ok(/Fetch the adverts for DAMAC Hills now/i.test(h3), "?d=damachills offers the fetch too");
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
