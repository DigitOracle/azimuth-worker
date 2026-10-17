// v608 - ONE KEY FOR HER: the board (and the board's own tick-to-delete) open with an insider key (Najjuko's ins_najjuko_ link, Kendall's ins_kendall_ link) as well as the owner key, so the opening
// verse on the board and the board itself are reachable with the key she already uses for Momo Work (Kendall, 17 Oct 2026: "she doesn't need multiple ways to go in ... she needs to go in through that
// owner key"). Exactly two routes are widened; every other owner-only route is left strict; client keys still get nothing.
// Source-level, like test_v534_broker_mask.mjs: src/index.js is read as text and the two guard expressions are run against fake keys.
//   node test/test_v608_board_insider.mjs
import fs from "node:fs";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 300) : "")); } };
const src = fs.readFileSync(new URL("../src/index.js", import.meta.url)).toString("latin1");

console.log("A - the two widened routes");
const at = (needle) => { const i = src.indexOf(needle); return i < 0 ? "" : src.slice(i, i + 260); };
const board = at('if (url.pathname === "/board") {'), done = at('if (url.pathname === "/done") {');
ok(src.split('if (url.pathname === "/board") {').length === 2 && /^[^]{0,140}!== env\.READ_KEY && !isInsider\(env, url\)\) return new Response\("unauthorized", \{ status: 401 \}\)/.test(board.slice('if (url.pathname === "/board") {'.length)), "/board accepts the owner key or an insider key", board);
ok(src.split('if (url.pathname === "/done") {').length === 2 && /!== env\.READ_KEY && !isInsider\(env, url\)\) return new Response\("unauthorized", \{ status: 401 \}\)/.test(done), "/done (the board's tick-to-delete) accepts the same two", done);
ok((src.match(/get\("key"\) !== env\.READ_KEY && !isInsider\(env, url\)\)/g) || []).length === 2, "exactly two checks were widened");
ok((src.match(/get\("key"\) !== env\.READ_KEY\)/g) || []).length === 97, "the other 97 strict owner checks are untouched", (src.match(/get\("key"\) !== env\.READ_KEY\)/g) || []).length);

console.log("B - routes that must stay owner-only");
for (const r of ["/note", "/reindex", "/src", "/backfill", "/debugatt", "/setbg"]) {
  const t = at('if (url.pathname === "' + r + '"');
  ok(t !== "" && /!== env\.READ_KEY\)/.test(t) && !/isInsider/.test(t), r + " still takes the owner key only");
}
ok(/if \(url\.pathname === "\/najj_say" && request\.method === "POST"\) \{[^]{0,400}!== env\.READ_KEY\) return new Response\("unauthorized"/.test(src), "/najj_say (a send to her phone) still takes the owner key only");

console.log("C - the guard, run against fake keys");
const ctEq = new Function(src.match(/function ctEq\(a, b\) \{[^]*?\n\}/)[0] + "; return ctEq;")();
const isInsiderSrc = src.match(/function isInsider\(env, url\) \{[^]*?\n\}/)[0];
const isInsider = new Function("ctEq", isInsiderSrc + "; return isInsider;")(ctEq);
const OWNER = "owner_key_0123456789abcdef", NAJ = "ins_najjuko_0123456789abcdef0123", KEN = "ins_kendall_0123456789abcdef0123", CLIENT = "client_key_0123456789abcdef";
const env = { READ_KEY: OWNER, INSIDER_KEY: NAJ + "," + KEN, CLIENT_KEY: CLIENT };
const U = (k) => ({ searchParams: { get: (n) => (n === "key" ? k : null) } });
const allowed = (e, k) => { const url = U(k); return !(url.searchParams.get("key") !== e.READ_KEY && !isInsider(e, url)); };
ok(allowed(env, OWNER), "the owner key opens the board");
ok(allowed(env, NAJ) && allowed(env, KEN), "Najjuko's and Kendall's insider keys open the board");
ok(!allowed(env, CLIENT), "a client key does not (the board stays out of a forwarded link)");
ok(!allowed(env, "") && !allowed(env, null) && !allowed(env, "ins_najjuko_"), "no key, a null key and a bare prefix do not");
ok(!allowed(env, NAJ.slice(0, -1)) && !allowed(env, NAJ + "x"), "a key one character short or long does not");
ok(!allowed({ READ_KEY: OWNER, INSIDER_KEY: "" }, NAJ) && !allowed({ READ_KEY: OWNER }, NAJ), "with no insider keys configured, her key opens nothing extra");
ok(!allowed({ READ_KEY: OWNER, INSIDER_KEY: "short_key" }, "short_key"), "an insider entry under 20 characters is ignored");

console.log("D - her own link to the board");
ok(/const _il = _t\.match\(\/\\\{INSIDER_LINK\(\?::\(\\\/\[\^\}\\s\]\*\)\)\?\\\}\/\);/.test(src) && /_ik = String\(env\.INSIDER_KEY \|\| ""\)\.split\(","\)\.map\(\(x\) => x\.trim\(\)\)\.find\(\(x\) => x\.indexOf\("ins_najjuko_"\) === 0\)/.test(src), "{INSIDER_LINK:/board} in a note writes her own key at send time (the key is never in the request)");
ok(/renderBoard\(meetings, actions, url\.searchParams\.get\("key"\), env, mkt, _avail\)/.test(src), "the board page is drawn with whichever key opened it, so its links and its tick button carry that same key");

console.log(fail ? "\n" + fail + " FAILED, " + pass + " passed" : "\nall " + pass + " passed");
process.exit(fail ? 1 : 0);
