// v521 - "Available on Property Finder" on the Developers map's project card: a prominent button above the four drop-downs, opening a
// pop-up with the building's listings (Kendall 11 Oct 2026). Plus the twin's contrast: darker, fainter ghosts; lifted chosen blocks;
// badges kept on chosen blocks.
import fs from "node:fs";
import { advBldgRoute } from "../src/city_bldg.js";
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };

// 1. the route
const doc = { as_of: "2026-10-10", advertised: { as_of: "2026-10-10", buildings: { "bb-p4": { key: "businessbay:647", bands: { studio: { flats: 28, adverts: 102, pmin: 75000, pmax: 145000, med_days: 16, new_wk: 35, gone_wk: 17 } } } } } };
const store = new Map([["img_pf_supply_businessbay", JSON.stringify(doc)]]);
const writes = [];
const env = { MEETINGS: { get: async (k, t) => { const v = store.get(k); if (v == null) return null; return t === "arrayBuffer" ? new TextEncoder().encode(v).buffer : v; }, put: async (k) => { writes.push(k); } } };
const tier = (e, u) => (u.searchParams.get("key") === "c" ? "client" : "");
const call = (q, method) => advBldgRoute(env, new URL("https://w.example/adv_bldg?" + q), { tier, method });
let r = await call("k=businessbay:647");
ok(r.status === 401, "no key: refused");
r = await call("k=businessbay:647&key=c", "POST");
ok(r.status === 401, "POST: refused (GET only)");
r = await call("k=../x&key=c");
ok(r.status === 400, "a malformed key is refused");
r = await call("k=businessbay:647&key=c"); let j = await r.json();
ok(r.status === 200 && j.covered && j.flats === 28 && j.adverts === 102 && j.as_of === "2026-10-10", "a client key gets the building's listings", j);
ok(/<details class=avd open>/.test(j.html) && /<style>/.test(j.html) && /28 flats · 102 adverts/.test(j.html), "the card comes open, styled, with flats and adverts");
ok(!/\bvacant\b/i.test(j.html), "never 'vacant' (the caveat 'not vacancy' is fine)");
r = await call("k=businessbay:9&key=c"); j = await r.json();
ok(j.covered && j.flats === 0 && j.html === "", "a covered district without this building: none listed, no card");
r = await call("k=marsa:1&key=c"); j = await r.json();
ok(!j.covered, "a district Property Finder is not read for: says not covered");
ok(writes.length === 0, "the route never writes");

// 2. the card on the Developers map
const dm = fs.readFileSync(new URL("../src/devmap_page.js", import.meta.url), "utf8");
ok(/var pfk=pdBldKey\(d,e\);if\(pfk\)h\+='<button type=button class=pfbtn data-pfk="'\+esc\(pfk\)\+'"/.test(dm), "the button is built from the project's register key");
ok(dm.indexOf("var pfk=pdBldKey(d,e)") < dm.indexOf('h+=pdSec("stack","Register facts",f);'), "it comes first, above Register facts");
ok(/<span>Available on Property Finder<\/span><b class=pfc>&hellip;<\/b><\/button>';setTimeout\(pfFill,0\);/.test(dm), "the count fills in when the card opens");
ok(/function pfOpen\(k,name\)\{/.test(dm) && /m\.id='pfpop'/.test(dm) && /#pfpop\{position:fixed;inset:0;z-index:2000;/.test(dm), "a pop-up, over everything");
ok(/A listing is not an empty flat/.test(dm) && /Rent only; sale listings are not read yet\./.test(dm) && !/\bvacant\b/i.test(dm.slice(dm.indexOf("// v521 AVAILABLE ON PROPERTY FINDER"), dm.indexOf("function pdClose(){"))), "says listings, not vacancy; rent only");
ok(/function pfInit\(\)\{if\(pfInit\.d\|\|typeof document==="undefined"/.test(dm) && /if\(e\.key==='Escape'\)pfClose\(\)/.test(dm) && /if\(e\.target===m\|\|/.test(dm), "closes with the cross, a tap outside, or Escape");
const PF = dm.slice(dm.indexOf("// v521 AVAILABLE ON PROPERTY FINDER"), dm.indexOf("function pdClose(){"));
ok(!/\\/.test(PF), "no backslashes in the shipped page script");

// 3. the route is wired and allowed for client keys
const src = fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
ok(/if \(url\.pathname === "\/adv_bldg"\) return advBldgRoute\(env, url, \{ tier: keyTier, method: request\.method \}\);/.test(src) && /const CLIENT_PATHS = \["\/adv_bldg", "\/city_bldg",/.test(src), "route mounted, client keys allowed");

// 4. the twin's contrast
ok(/color:0x56635E,transparent:true,opacity:\.35/.test(src), "ghosts: darker and fainter");
ok(/c\.set\(AMEN\[k\]\[2\]\)\.lerp\(w,\.2\)/.test(src), "chosen blocks: the kind's colour, lifted");
ok(/for\(const p of AMPTS\)\{const q=p\.v\.clone\(\)\.project\(cam\);/.test(src), "a place shown as a block keeps its badge");

ok(/\.pfbtn svg\{width:20px;height:20px;flex:none\}/.test(dm), "v521.1: the button icon is sized (it rendered page-wide and squeezed the label)");
console.log(`v521 Property Finder on the project card: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
