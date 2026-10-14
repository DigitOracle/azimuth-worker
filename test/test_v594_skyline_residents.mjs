// v594 - WHAT RESIDENTS SAY on the twin's building tab: the page's OWN gbHtml/loadGb lifted out of the MAP_CHROME_JS literal in src/index.js, so what is asserted is what the browser runs.
// The panel code is a chain of single-quoted strings that node --check cannot see inside (v181.1 shipped a ReferenceError that way), so the whole chrome is also parsed as JavaScript here.
//   node test/test_v594_skyline_residents.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const lines = fs.readFileSync(path.join(HERE, "..", "src", "index.js"), "utf8").split("\n");
let fails = 0; const ok = (c, n, d) => { if (c) return console.log("  ok   " + n); fails++; console.log("  FAIL " + n + (d ? "\n         " + d : "")); };
const start = lines.findIndex((l) => /^const MAP_CHROME_JS\s*=\s*''\s*$/.test(l));
if (start < 0) throw new Error("MAP_CHROME_JS not found");
const cont = (l) => /^\s*\+/.test(l) || /^\s*\/\//.test(l) || /^\s*$/.test(l);
let end = start + 1; while (end < lines.length && cont(lines[end])) end++;
const scope = new Proxy({}, { has: () => true, get: (t, k) => (k in t ? t[k] : k in globalThis ? globalThis[k] : ""), set: (t, k, v) => ((t[k] = v), true) });
const CHROME = new Function("scope", "with(scope){" + lines.slice(start, end).join("\n").replace(/^const /, "var ") + ";\nreturn MAP_CHROME_JS;}")(scope);

let parsed = true; try { new Function(CHROME); } catch (e) { parsed = false; console.log(String(e)); }
ok(parsed, "the whole map chrome script parses as JavaScript");
const lift = (name) => { const at = CHROME.indexOf("function " + name + "("); if (at < 0) return null; let d = 0; for (let i = CHROME.indexOf("{", at); i < CHROME.length; i++) { if (CHROME[i] === "{") d++; else if (CHROME[i] === "}" && --d === 0) return CHROME.slice(at, i + 1); } return null; };
const srcG = lift("gbHtml"), srcL = lift("loadGb");
ok(!!srcG && !!srcL, "gbHtml and loadGb are in the page");
ok(/GBC\[slug\]===undefined/.test(CHROME) && /twinI!=null\?gbHtml\(slug,twinI\)/.test(CHROME), "a building opens with its residents card, loaded once per district");

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const GBC = { damachills: { "679": { rating: 4.3, count: 32, praise: { management: 2, cooling: 1, security: 1 }, complaint: { parking: 2 }, reviews: [{ stars: 5, date: "2023-07-14", text: "Best place to stay <b>" }, { stars: 1, date: "2026-01-05", text: "Big issue with AC" }], url: "https://maps.google.com/?cid=1", as_of: "2026-10-14" } } };
const gbHtml = new Function("GBC", "esc", srcG + "; return gbHtml;")(GBC, esc);
const h = gbHtml("damachills", 679);
ok(/What residents say/.test(h) && /4\.3 from 32 reviews/.test(h) && /Praised for management, cooling, security/.test(h) && /Complaints about parking/.test(h), "rating, praise and complaint themes");
ok(/Read the 2 latest reviews/.test(h) && /★★★★★/.test(h) && /Big issue with AC/.test(h), "the latest reviews sit behind a tap");
ok(!/<b>Best place/.test(h) && /&lt;b&gt;/.test(h), "review text is escaped");
ok(/Google reviews, as of 2026-10-14/.test(h) && /Five most recent only/.test(h) && /Google Maps/.test(h), "the Google credit, the date, the honest limit and the Maps link");
ok(gbHtml("damachills", 5) === "" && gbHtml("nowhere", 679) === "", "a building without a Google match shows nothing");
console.log(fails ? "\nv594: " + fails + " FAILED" : "\nv594: all passing"); process.exit(fails ? 1 : 0);
