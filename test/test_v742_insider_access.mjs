// v742 - every app entry point, opened with each kind of key (READ_KEY, Najjuko's insider key, Kendall's insider key, a client key,
// no key). /versus refused insider keys until v741a; this pins the whole matrix so no tab or tile can drift the same way again, and
// crawls every link a page hands a key holder to check none of them refuses that same key. Worker end to end; nothing leaves this machine.
import worker from "../src/index.js";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };
const store = new Map();
const KV = { async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); }, async list(o) { const pre = (o && o.prefix) || ""; return { keys: [...store.keys()].filter((k) => k.startsWith(pre)).map((name) => ({ name })), list_complete: true }; }, async getWithMetadata(k) { return { value: store.has(k) ? store.get(k) : null, metadata: null }; } };
const sent = [];
globalThis.fetch = async (u, init) => { if (String(u).includes("graph.facebook.com")) sent.push(init && init.body); return new Response("{}"); };
const READ = "read_key_v742_test_123456", NAJ = "ins_najjuko_v742test_0001", KEN = "ins_kendall_v742test_0001", CLI = "client_key_v742_abcdef01";
const env = { MEETINGS: KV, READ_KEY: READ, INSIDER_KEY: NAJ + "," + KEN, CLIENT_KEY: CLI, WA_ALLOWED: "971500000000", WHATSAPP_TOKEN: "t", WA_PHONE_ID: "p", AI: { async run() { return { response: "{}" }; } }, PUBLIC_ORIGIN: "https://x.dev", MAILBOXES: "" };
const ctx = { waitUntil() {} };
const call = (p, k) => worker.fetch(new Request("https://x.dev" + p + (k ? (p.includes("?") ? "&" : "?") + "key=" + k : "")), env, ctx);
const KEYS = [["READ", READ], ["naj", NAJ], ["ken", KEN], ["client", CLI], ["none", ""]];
const O = 200, U = 401, N = 404;
// path, linked from, expected [READ, naj, ken, client, none]
const MATRIX = [
  ["/start", "bar START", [O, O, O, O, U]], ["/find", "bar FIND", [O, O, O, O, U]], ["/market", "bar PULSE", [O, O, O, O, U]],
  ["/map", "bar MAP", [O, O, O, O, U]], ["/skyline?all=1", "bar TWIN", [O, O, O, O, U]], ["/momo", "bar MOMO", [O, O, O, U, N]],
  ["/more", "bar MORE", [O, O, O, O, U]], ["/versus", "MORE VS", [O, O, O, O, U]], ["/plans", "MORE PLANS", [O, O, O, O, U]],
  ["/clock", "MORE TIME", [O, O, O, O, U]], ["/plot_passport", "MORE PLOT PASSPORT", [O, O, O, U, U]], ["/plot_radar", "MORE ACTIVITY RADAR", [O, O, O, U, U]],
  ["/plot_land", "MORE LAND SCANNER", [O, O, O, U, U]], ["/board", "MORE BOARD (owner)", [O, O, O, U, U]], ["/charts", "MORE CARD SHEET (owner)", [O, O, O, O, U]],
  ["/data_checks", "MORE DATA CHECKS (owner)", [O, O, O, U, N]], ["/residents", "MORE RESIDENTS (public)", [O, O, O, O, O]], ["/fit", "Momo Play", [O, O, O, N, N]],
  ["/studio", "CARD SHEET link (v742: was READ only)", [O, O, O, U, U]], ["/src?id=x", "BOARD source link (owner only; v742 hides the link on an insider board)", [O, U, U, U, U]],
  ["/momo/work/sheets", "Momo tile", [N, O, O, U, N]], ["/momo/work/presentations", "Momo tile", [N, O, O, U, N]], ["/momo/work/passports", "Momo tile", [N, O, O, U, N]],
  ["/momo/work/reels", "Momo tile", [N, O, O, U, N]], ["/momo/work/brokers", "Momo tile (Najjuko only)", [U, O, U, U, N]], ["/momo/campaigns", "Momo tile", [O, O, O, N, N]],
  ["/developers_map", "MORE / START", [O, O, O, O, U]], ["/developer_profile", "FIND", [O, O, O, O, U]],
  // owner-only ops/data endpoints stay owner-only: an insider key must NOT widen these
  ["/people", "none (owner tool)", [O, U, U, U, U]], ["/groups_ui", "none (owner tool)", [O, U, U, U, U]], ["/twin_audit", "none (ops)", [null, U, U, U, U]],
  ["/setbg", "none (KV write)", [null, U, U, U, U]], ["/health", "none (ops)", [null, U, U, U, U]],
];
for (const [p, from, exp] of MATRIX) {
  const got = [];
  for (const [, k] of KEYS) { let s; try { s = (await call(p, k)).status; } catch (e) { s = "ERR"; } got.push(s); }
  const want = exp.map((e, i) => e === null ? got[i] : (p === "/src?id=x" && e === O ? 200 : e));
  const norm = got.map((s, i) => (p === "/src?id=x" && exp[i] === O && s === 200) ? 200 : s);
  ok(norm.every((s, i) => s === want[i]), p + " [" + from + "] READ/naj/ken/client/none = " + got.join("/") + (norm.join() === want.join() ? "" : " (want " + want.join("/") + ")"));
}
// owner actions stay Kendall's: an insider Najjuko key cannot send from VS
const vs = (k) => worker.fetch(new Request("https://x.dev/versus/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: k, city: "london", what: "script" }) }), env, ctx);
const _s0 = sent.length; const _vn = (await vs(NAJ)).status, _vc = (await vs(CLI)).status, _vk = (await vs(KEN)).status;
ok(_vn === 401 && _vc === 401 && _vk === 200 && sent.length === _s0 + 1, "VS send: Kendall's insider key sends (one message), Najjuko's insider key and a client key are refused");
const vh = await (await call("/versus", NAJ)).text(), vk = await (await call("/versus", KEN)).text();
ok(vh.includes('"OWNER":false') && vk.includes('"OWNER":true'), "VS page: send buttons drawn for Kendall's insider key, not Najjuko's");
store.set("act_t1", JSON.stringify({ id: "t1", text: "call the agent", src: { type: "email", from: "x" } }));
const _bo = await (await call("/board", READ)).text(), _bn = await (await call("/board", NAJ)).text();
ok(_bo.includes("/src?key=") && !_bn.includes("/src?key="), "BOARD: the owner key gets the email source link, an insider board draws none (/src stays owner-only, v608)");
// crawl: every link a page gives a key holder, carrying that key, must not refuse that key
const seeds = ["/start", "/find", "/market", "/map", "/skyline?all=1", "/momo", "/more", "/versus", "/board", "/charts", "/fit", "/plans", "/clock", "/developers_map"];
for (const [n, k] of KEYS.slice(0, 4)) {
  const seen = new Set(), q = seeds.map((s) => [s + (s.includes("?") ? "&" : "?") + "key=" + k, "seed"]), bad = [];
  while (q.length && seen.size < 300) {
    const [u, from] = q.shift(); const path = u.split("?")[0]; if (seen.has(path)) continue; seen.add(path);
    const r = await worker.fetch(new Request("https://x.dev" + u), env, ctx);
    if (from !== "seed" && (r.status === 401 || r.status === 403)) bad.push(path + "<-" + from);
    if (/html/.test(r.headers.get("content-type") || "")) for (const m of (await r.text()).matchAll(/href="(\/[^"#']*)"/g)) { const v = m[1].replace(/&amp;/g, "&"); if (v.includes("key=" + k)) q.push([v, path]); }
  }
  ok(bad.length === 0, n + " key: no linked page refuses the key that linked it (" + seen.size + " pages)" + (bad.length ? " - refused: " + bad.join(", ") : ""));
}
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
