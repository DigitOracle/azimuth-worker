// v605 - COLLAPSIBLE PANELS (the left sheet and the right panel of the Developers-by-area page hide and show; the map takes the room; the choice is kept per browser).
// Offline: the module's script runs against a stub page (body classes, two buttons, a store, a map with resize), the page text is checked for its wiring and parsed. No network, no deploy.
//   node test/test_v605_panels.mjs
import { devmapHtml } from "../src/devmap_page.js";
import { PANELS_JS, PANELS_CSS, PANELS_HTML } from "../src/devmap_panels.js";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 400) : "")); } };
const EMOJI = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/u;

const make = (storeObj, opts) => {
  const o = opts || {}, cls = new Set(), store = storeObj || {};
  const btn = () => ({ attrs: {}, title: "", fn: null, setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; }, addEventListener(t, f) { this.fn = f; }, click() { this.fn && this.fn(); } });
  const els = { tglL: btn(), tglR: btn() };
  const document = { body: { classList: { toggle(c, on) { on ? cls.add(c) : cls.delete(c); } } }, getElementById: (id) => (o.noButtons ? null : els[id] || null) };
  const localStorage = o.badStore ? { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } } : { getItem: (k) => (store[k] == null ? null : store[k]), setItem: (k, v) => { store[k] = v; } };
  const counter = { n: 0 }; const map = o.noMap ? undefined : { resize() { counter.n++; if (o.mapThrows) throw new Error("x"); } };
  const P = new Function("document", "localStorage", "map", PANELS_JS + "; return PANELS;")(document, localStorage, map);
  return { P, cls, els, store, counter };
};

console.log("A - the behaviour (PANELS)");
let w = make(); w.P.init();
ok(!w.cls.has("colL") && !w.cls.has("colR") && w.els.tglL.attrs["aria-expanded"] === "true" && w.els.tglR.attrs["aria-expanded"] === "true", "fresh browser: both panels open");
w.els.tglL.click();
ok(w.cls.has("colL") && !w.cls.has("colR") && w.els.tglL.attrs["aria-expanded"] === "false" && w.els.tglL.attrs["aria-label"] === "Show the left panel" && w.els.tglL.title === "Show the left panel", "tap the left tab: left collapses, its label says Show, the right is untouched");
w.els.tglR.click();
ok(w.cls.has("colL") && w.cls.has("colR") && w.els.tglR.attrs["aria-label"] === "Show the right panel", "tap the right tab: both collapsed, each independent");
ok(w.counter.n >= 3, "the map is resized after every change (and once at start)", w.counter.n);
w.els.tglL.click();
ok(!w.cls.has("colL") && w.cls.has("colR") && w.els.tglL.attrs["aria-label"] === "Hide the left panel", "tap again: the left panel is back");
ok(JSON.parse(w.store.devmap_panels).L === 0 && JSON.parse(w.store.devmap_panels).R === 1, "the choice is stored as {L, R}");
const w2 = make(w.store); w2.P.init();
ok(!w2.cls.has("colL") && w2.cls.has("colR") && JSON.stringify(w2.P.state()) === '{"L":0,"R":1}', "next visit: the right panel is still collapsed, the left open");
const w3 = make({ devmap_panels: "not json" }); w3.P.init();
ok(!w3.cls.has("colL") && !w3.cls.has("colR"), "a corrupted stored value means both open, not a crash");
const w4 = make(null, { badStore: true }); w4.P.init(); w4.els.tglR.click();
ok(w4.cls.has("colR"), "a browser that blocks storage still collapses for the visit");
const w5 = make(null, { noMap: true }); w5.P.init(); w5.els.tglL.click();
ok(w5.cls.has("colL"), "before the map exists nothing breaks");
const w6 = make(null, { mapThrows: true }); w6.P.init(); w6.els.tglL.click();
ok(w6.cls.has("colL"), "a map that throws on resize does not stop the toggle");
const w7 = make(null, { noButtons: true });
let threw = false; try { w7.P.init(); w7.P.flip("L"); } catch (e) { threw = true; }
ok(!threw && w7.cls.has("colL"), "missing buttons do not throw");

console.log("B - the page");
const deps = { clientOk: () => true, najNav: () => "", NAJ_NAV_CSS: "", NAJ_FONTS: "" };
const html = devmapHtml("k", deps);
ok(html.includes("<button type=button id=tglL class=ptg") && html.includes("<button type=button id=tglR class=ptg") && html.indexOf("id=tglL") > html.indexOf("<aside id=detail>"), "both tabs are in the page, after the panels");
ok(html.includes("var PANELS=(function(){") && html.includes(";PANELS.init();</script>"), "the module is in the page and starts after the page script");
ok(html.includes("@media(min-width:761px){body.colL #side{display:none}") && html.includes("@media(min-width:1101px){body.colR #detail{display:none}"), "a collapse only applies where the panel is a side panel (left from 761 px, right from 1101 px)");
ok(html.includes("@media(max-width:1100px){#tglR{display:none}}") && html.includes("@media(max-width:760px){#tglL{display:none}}"), "the tabs are hidden where the panel is not a side panel");
ok(/body\.colL #map\{left:0\}/.test(html) && /body\.colR #map\{right:0\}/.test(html) && /body\.colL #tglL\{left:0\}/.test(html) && /body\.colR #tglR\{right:0\}/.test(html), "the map takes the room and each tab moves to the screen edge");
ok(html.includes("#tglL{left:340px") && html.includes("#tglR{right:400px"), "open: each tab sits on its panel's inner edge (340 px and 400 px, the panels' widths)");
ok(html.includes("var VENUES=(function(){") && html.includes("var BEDMED=(function(){") && html.includes("VENUES.load(r[15])"), "the venue block and the bedroom boxes are still wired");
ok(!PANELS_JS.includes("`") && !PANELS_JS.includes("${") && !PANELS_CSS.includes("`"), "no backticks or substitutions in the injected text");
ok(!EMOJI.test(PANELS_JS) && !EMOJI.test(PANELS_CSS) && !EMOJI.test(PANELS_HTML), "no emoji (the tab arrow is an inline SVG)");
ok(/aria-expanded=true aria-label="Hide the left panel"/.test(PANELS_HTML) && /aria-expanded=true aria-label="Hide the right panel"/.test(PANELS_HTML), "each tab is a real button with an accessible name and state");
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
let parsed = 0, perr = ""; for (const s of scripts) { try { new Function(s); parsed++; } catch (e) { perr = e.message; } }
ok(scripts.length > 0 && parsed === scripts.length, "every inline script in the page parses (" + parsed + " of " + scripts.length + ")", perr);

console.log(fail ? "\n" + fail + " FAILED, " + pass + " passed" : "\nall " + pass + " passed");
process.exit(fail ? 1 : 0);
