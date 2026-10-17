// v612 - LIGHT AND DARK INTERFACE: a sun/moon button on the map switches the page tokens and the basemap, kept per browser; the map's layers are rebuilt after every style change and the
// handlers are bound once. Offline: the theme module runs against a fake page and store; the page text is checked for its wiring and parsed.
//   node test/test_v612_theme.mjs
import { devmapHtml } from "../src/devmap_page.js";
import { THEME_JS, THEME_CSS } from "../src/devmap_theme.js";
import { PLACES_JS } from "../src/devmap_places.js";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 400) : "")); } };
const EMOJI = /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}]/u;

const make = (storeObj, opts) => {
  const o = opts || {}, store = storeObj || {}, attrs = {}, kids = [];
  const btn = { type: "", id: "", innerHTML: "", title: "", a: {}, fn: null, setAttribute(k, v) { this.a[k] = v; }, addEventListener(t, f) { this.fn = f; }, click() { this.fn && this.fn(); } };
  const document = { documentElement: { setAttribute(k, v) { attrs[k] = v; } }, getElementById: (id) => (id === "map" ? (o.noMap ? null : { appendChild(el) { kids.push(el); } }) : id === "thm" ? (kids.length ? btn : null) : null), createElement: () => btn };
  const localStorage = o.badStore ? { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } } : { getItem: (k) => (store[k] == null ? null : store[k]), setItem: (k, v) => { store[k] = v; } };
  const T = new Function("document", "localStorage", THEME_JS + "; return THEME;")(document, localStorage);
  return { T, attrs, kids, btn, store };
};

console.log("A - the behaviour (THEME)");
let w = make();
const first = w.T.init();
ok(first === "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json" && w.T.get() === "dark" && w.attrs["data-theme"] === "dark", "fresh browser: dark, and init returns the dark basemap for the map to start with");
ok(w.kids.length === 1 && w.btn.id === "thm" && w.btn.type === "button" && /<svg/.test(w.btn.innerHTML) && w.btn.a["aria-label"] === "Switch to the light interface", "the button is on the map with an accessible name and the sun");
const got = []; w.T.onStyle((u) => got.push(u));
w.btn.click();
ok(w.T.get() === "light" && w.attrs["data-theme"] === "light" && got.join() === "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json" && w.btn.a["aria-label"] === "Switch to the dark interface" && w.store.devmap_theme === "light", "tap: light tokens, the light basemap is handed to the page, the button shows the moon, the choice is stored");
w.btn.click();
ok(w.T.get() === "dark" && got.length === 2 && got[1].includes("dark-matter") && w.store.devmap_theme === "dark", "tap again: back to dark");
const w2 = make(w.store); w2.T.set("light"); const w3 = make(w2.store); const s3 = w3.T.init();
ok(w3.T.get() === "light" && s3.includes("positron") && w3.attrs["data-theme"] === "light", "next visit: the stored choice applies before the map is made");
const w4 = make({ devmap_theme: "purple" }); w4.T.init();
ok(w4.T.get() === "dark", "a corrupted stored value means dark");
const w5 = make(null, { badStore: true }); w5.T.init(); w5.T.toggle();
ok(w5.T.get() === "light", "a browser that blocks storage still switches for the visit");
const w6 = make(null, { noMap: true }); let thr = false; try { w6.T.init(); w6.T.toggle(); } catch (e) { thr = true; }
ok(!thr && w6.T.get() === "light", "with no map element nothing throws");
const w7 = make(); w7.T.init(); w7.T.onStyle(() => { throw new Error("boom"); }); let thr7 = false; try { w7.T.toggle(); } catch (e) { thr7 = true; }
ok(!thr7 && w7.T.get() === "light", "a callback that throws does not stop the switch");
const w8 = make(); w8.T.init(); w8.T.init();
ok(w8.kids.length === 1, "init twice adds one button");

console.log("B - the places module after a style change");
ok(/function redraw\(\)\{if\(ACT\)show\(ACT\.sc,ACT\.k,true\)\}/.test(PLACES_JS) && /if\(BOUNDM\)return;BOUNDM=true;/.test(PLACES_JS), "PLACES binds its handlers once and can redraw the active kind");

console.log("C - the page");
const deps = { clientOk: () => true, najNav: () => "", NAJ_NAV_CSS: "", NAJ_FONTS: "" };
const html = devmapHtml("k", deps);
ok(html.includes("var THEME=(function(){") && html.includes('style:(typeof THEME!=="undefined"&&THEME?THEME.init():"https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json")'), "the map is created with the theme's basemap");
ok(html.includes("function buildLayers(){") && html.includes("function bindMap(){") && html.includes('map.on("load",buildLayers);'), "the load handler is split into layers (rebuilt) and handlers (once)");
ok(html.includes('THEME.onStyle(function(u){map.setStyle(u);map.once("style.load",buildLayers)})'), "a theme change swaps the basemap and rebuilds the layers");
ok(html.includes("if(!BOUND)CF.bind(map,maplibregl)") && html.includes("if(!BOUND){BOUND=true;bindMap()}"), "the centres module and the page bind once");
const bl = html.slice(html.indexOf("function buildLayers(){"), html.indexOf("function bindMap(){"));
ok(/updatePj\(\);if\(typeof PLACES!=="undefined"&&PLACES&&PLACES\.redraw\)PLACES\.redraw\(\);refreshMap\(\);/.test(bl) && !/map\.on\("mousemove"/.test(bl) && !/map\.on\("click"/.test(bl), "buildLayers refreshes the data after re-adding and binds nothing");
const bm = html.slice(html.indexOf("function bindMap(){"), html.indexOf('map.on("load",buildLayers);'));
ok(/map\.on\("click","a-fill"/.test(bm) && /map\.on\("mousemove","a-fill"/.test(bm) && !/updatePj\(\)/.test(bm) && !/addLayer\(/.test(bm), "bindMap holds the handlers and adds no layers");
ok(html.indexOf("html[data-theme=light]{--ground:") > html.indexOf(":root{--ground:") && html.includes("#thm{position:absolute"), "the light tokens come after the dark ones, and the button style is in the page");
ok(!THEME_JS.includes("`") && !THEME_JS.includes("${") && !THEME_CSS.includes("`") && !EMOJI.test(THEME_JS) && !EMOJI.test(THEME_CSS), "no backticks, substitutions or emoji");
const px = [...THEME_CSS.matchAll(/(?:^|[;{\s])(?:min-)?width:\s*(\d+)px/g)].map((m) => Number(m[1]));
ok(px.every((n) => n <= 375), "no fixed width over 375 px");
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
let parsed = 0, perr = ""; for (const s of scripts) { try { new Function(s); parsed++; } catch (e) { perr = e.message; } }
ok(scripts.length > 0 && parsed === scripts.length, "every inline script in the page parses (" + parsed + " of " + scripts.length + ")", perr);

console.log(fail ? "\n" + fail + " FAILED, " + pass + " passed" : "\nall " + pass + " passed");
process.exit(fail ? 1 : 0);
