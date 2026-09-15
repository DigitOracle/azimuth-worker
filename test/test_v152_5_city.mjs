// v152.5 - the all-Dubai twin gets the stack (15 Sep 2026): HOMES lights up matching buildings, COLOUR BY offers district, height and
// developer, and the residents key adds RESIDENTS on the ground. Through the real worker; the city's stack code runs on stand-in instances.
import worker from "../src/index.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const READ = "client_read_key_in_links_123";
const RES = "residents_private_key_0123456789abcdef";
const store = new Map();
const KV = { async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); }, async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter(k => k.startsWith(p)).map(name => ({ name })) }; } };
globalThis.fetch = async () => new Response("{}", { status: 200 });
const env = { MEETINGS: KV, READ_KEY: READ, INGEST_TOKEN: "ING", RESIDENTS_KEY: RES };
const call = (p, init, e) => worker.fetch(new Request("https://azimuth-2.digitalchemy.workers.dev" + p, init), e || env, { waitUntil() {} });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };
const parses = (code, ext) => { const f = path.join(os.tmpdir(), "v1525_" + Math.random().toString(36).slice(2) + ext); fs.writeFileSync(f, code); try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); return true; } catch (e) { console.log(String(e.stderr || e.message).slice(0, 600)); return false; } finally { try { fs.unlinkSync(f); } catch (e) {} } };
const moduleOf = (html) => (html.match(/<script type="module">([\s\S]*?)<\/script>/) || [])[1] || "";
const classicOf = (html) => (html.match(/<script>\(function\(\)\{([\s\S]*?)\}\)\(\);<\/script><script type="module">/) || [])[1] || "";

// 1. what the two city pages carry
let r = await call("/skyline?all=1&key=" + READ);
const client = await r.text();
ok(r.status === 200 && /<div class=hstack id=hstack><div id=hp class=hp>[\s\S]*?<div id=colp class="hp colp">/.test(client) && !client.includes("id=rp") && client.includes("<b id=colres>district</b>"), "client city: HOMES and COLOUR BY in the stack, no RESIDENTS");
ok(!client.includes("window.__resTwin=") && !client.includes("var RK=") && !client.includes("/residents") && !client.includes(RES) && client.includes("window.__cityTwin=true"), "client city: nothing private in the page");
ok(parses(moduleOf(client), ".mjs") && parses("(function(){" + classicOf(client) + "})();", ".js") && classicOf(client).includes("function homeMatches()") && classicOf(client).includes('hh.onclick=function(){var open=!hp.classList.contains("on")'), "client city: both scripts parse, and the HOMES matching and wiring are the map's own");
r = await call("/skyline?all=1&key=" + READ + "&rk=" + RES);
const priv = await r.text();
ok(/<div id=hp class=hp>[\s\S]*?<div id=rp class="hp rp">[\s\S]*?<div id=colp class="hp colp">/.test(priv) && moduleOf(priv).includes("window.__resTwin=") && classicOf(priv).includes("var RK=") && r.headers.get("Referrer-Policy") === "strict-origin-when-cross-origin", "private city: HOMES, RESIDENTS, COLOUR BY in that order; the ground renderer; origin-only referrer");
ok(parses(moduleOf(priv), ".mjs") && parses("(function(){" + classicOf(priv) + "})();", ".js"), "private city: both scripts parse");

// 2. the city's stack code on stand-in instances
const mod = moduleOf(priv);
const s0 = mod.indexOf("// ===== v152.5 CITY STACK: HOMES and COLOUR BY on the all-Dubai twin ====="), s1 = mod.indexOf("// ===== v152.5 CITY STACK - end =====");
class Color { constructor(h) { this.r = 0; this.g = 0; this.b = 0; if (h != null) this.set(h); } set(h) { return this.setHex(typeof h === "string" ? parseInt(h.slice(1), 16) : h); } setHex(h) { this.r = ((h >> 16) & 255) / 255; this.g = ((h >> 8) & 255) / 255; this.b = (h & 255) / 255; return this; } }
const V3 = class { constructor(x, y, z) { this.x = x; this.y = y; this.z = z; } clone() { return new V3(this.x, this.y, this.z); } };
const win = {}, leg = { innerHTML: "MASSING BY DISTRICT" };
const n = 4, U = 2;
// instance 0 sits on the home (in its district), 1 is 400 m away, 2 is in another district on the same spot, 3 is far
const originHome = { lon: 55.1425, lat: 25.0715 };
const setup = new Function("win", "leg", "Color", "V3", "n", "U", `
  const THREE={Color,Vector3:V3};const window=win;const document={getElementById:()=>leg};
  function utm40(lon,lat){const a=6378137,f=1/298.257223563,k0=0.9996,e2=f*(2-f),ep2=e2/(1-e2),e4=e2*e2,e6=e4*e2;const p=lat*Math.PI/180,l=lon*Math.PI/180,l0=57*Math.PI/180;const sp=Math.sin(p),cp=Math.cos(p),tp=Math.tan(p);const N=a/Math.sqrt(1-e2*sp*sp),T=tp*tp,C=ep2*cp*cp,A=cp*(l-l0);const M=a*((1-e2/4-3*e4/64-5*e6/256)*p-(3*e2/8+3*e4/32+45*e6/1024)*Math.sin(2*p)+(15*e4/256+45*e6/1024)*Math.sin(4*p)-(35*e6/3072)*Math.sin(6*p));return [k0*N*(A+(1-T+C)*A*A*A/6+(5-18*T+T*T+72*C-58*ep2)*Math.pow(A,5)/120)+500000,k0*(M+N*tp*(A*A/2+(5-T+9*C+4*C*C)*Math.pow(A,4)/24+(61-58*T+T*T+600*C-330*ep2)*Math.pow(A,6)/720))]}
  const O={lon:55.27,lat:25.12,e:325579.1,n:2779353.4};const q=utm40(${originHome.lon},${originHome.lat});const hx=q[0]-O.e,hz=-(q[1]-O.n);
  const xz=new Int16Array([Math.round(hx/U),Math.round(hz/U),Math.round((hx+400)/U),Math.round(hz/U),Math.round(hx/U),Math.round(hz/U),Math.round((hx+9000)/U),Math.round(hz/U)]);
  const hh=new Uint16Array([30,12,200,90]);const di=new Uint8Array([0,0,1,0]);
  const D={origin:O,devs:["","emaar"],districts:[{slug:"jltnorth"},{slug:"other"}],arrays:{dev_u8:"x"}};
  const mesh={instanceColor:{array:new Float32Array([0.1,0.1,0.1, 0.2,0.2,0.2, 0.3,0.3,0.3, 0.4,0.4,0.4]),needsUpdate:false}};
  const b64=()=>new Uint8Array([1,0,0,0]);const cam={position:new V3(0,0,0)},ctl={target:new V3(0,0,0),autoRotate:true};let anim=null;
  const setTimeout=(fn)=>{fn();return 1};const clearTimeout=()=>{};
  ` + mod.slice(s0, s1) + `
  return {mesh,get anim(){return anim}};`);
const C = setup(win, leg, Color, V3, n, U);
const o = win.__cityStack.utm40(55.27, 25.12);
ok(Math.abs(o[0] - 325579.1) < 1 && Math.abs(o[1] - 2779353.4) < 1, "city: lon/lat land on the model's own UTM 40N grid (the origin to within a metre)");
const orig = Array.from(C.mesh.instanceColor.array);
win.__onHomes([{ it: { lon: originHome.lon, lat: originHome.lat, d: "jltnorth" } }]);
const a1 = C.mesh.instanceColor.array, gold = new Color(0xC5A56A), dim = new Color(0x1f2826);
const is = (i, c) => Math.abs(a1[3 * i] - c.r) < 1e-6 && Math.abs(a1[3 * i + 1] - c.g) < 1e-6 && Math.abs(a1[3 * i + 2] - c.b) < 1e-6;
ok(win.__cityStack.homes === 1 && is(0, gold) && is(1, dim) && is(2, dim) && is(3, dim) && leg.innerHTML.includes("1 buildings with homes in your budget"), "homes: the building on the home (in its own district) lights up gold, everything else recedes, the key counts it");
win.__cityColour("height");
const blue = [new Color("#184f95"), new Color("#2a78d6"), new Color("#6da7ec"), new Color("#b7d3f6")];
ok(is(0, blue[1]) && is(1, dim) && leg.innerHTML.includes("height ") && leg.innerHTML.includes("(1)"), "homes + height: the match keeps its height colour, the rest recede");
win.__onHomes(null);
ok(is(0, blue[1]) && is(1, blue[0]) && is(2, blue[3]) && is(3, blue[2]) && /under 25 m \(1\)/.test(leg.innerHTML) && /150 m and over \(1\)/.test(leg.innerHTML), "height: four bands on the validated ramp, tallest lightest, counted in the key");
win.__cityColour("dev");
ok(is(0, new Color(0xC5A56A)) && is(1, dim) && leg.innerHTML.includes("Emaar (1)"), "developer: a developer's buildings take its colour, the rest recede");
win.__cityColour("");
ok(Array.from(C.mesh.instanceColor.array).every((v, i) => Math.abs(v - orig[i]) < 1e-6) && leg.innerHTML === "MASSING BY DISTRICT", "back to district: every building exactly as it was, the original key");
win.__cityFly(originHome.lon, originHome.lat);
const homeXZ = win.__cityStack.llx(originHome.lon, originHome.lat);
ok(C.anim && C.anim.go === null && Math.abs(C.anim.to.t.x - homeXZ[0]) < 1e-6 && Math.abs(C.anim.to.t.z - homeXZ[1]) < 1e-6, "a listed home flies the camera to it without leaving the city page");

// 3. the residents panel on the city hands drawing to the scene
function mk(id, ids) { return { id, innerHTML: "", textContent: "", value: "", style: {}, attrs: {}, handlers: {}, onclick: null, kids: [], classList: { s: new Set(), add(c) { this.s.add(c); }, remove(c) { this.s.delete(c); }, toggle(c, on) { if (on === undefined) on = !this.s.has(c); on ? this.s.add(c) : this.s.delete(c); return on; }, contains(c) { return this.s.has(c); } }, setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }, addEventListener(t, f) { this.handlers[t] = f; }, querySelector(sel) { return sel === "#rpx" && this.innerHTML.includes("id=rpx") ? ids.rpx : null; }, querySelectorAll(sel) { const from = (rx, attr) => { if (this._k === this.innerHTML) return this.kids; this.kids = [...this.innerHTML.matchAll(rx)].map(m => { const b = mk("", ids); b.attrs[attr] = m[1]; return b; }); this._k = this.innerHTML; return this.kids; }; if (sel === "button" && this.id === "rnat") return from(/data-n="([^"]*)"/g, "data-n"); if (sel === ".rrow") return from(/data-c="([^"]*)"/g, "data-c"); return []; } }; }
const mix = { rules: { minResidentialAccounts: 500 }, nationalities: ["India"], communities: [{ comm: 500, label: "JLT", official: "Al Thanyah Fifth", mix: [["India", 38]], other: 62, bands: { India: 20 } }], names: {}, outlines: { "500": [[55.135, 25.065], [55.15, 25.065], [55.15, 25.078]] } };
await call("/ingest_private", { method: "POST", headers: { "X-Azimuth-Ingest": "ING" }, body: JSON.stringify({ name: "community_resident_mix", json: mix }) });
const ids = {};
["rp", "rh", "rres", "rnat", "rlist", "rlh", "rmin", "rq", "rleg", "rclear", "rfull", "panel", "hint", "rpx"].forEach(k => ids[k] = mk(k, ids));
const FT = { draws: [], init(cb) { this.cb = cb; }, draw(fc, v) { this.draws.push(v); return true; }, fly() { return true; } };
const cls = classicOf(priv);
const escCity = new Function(cls.slice(cls.indexOf("function esc(t)"), cls.indexOf("\n", cls.indexOf("function esc(t)"))) + "\nreturn esc;")();   // the city page's own esc, from its chrome
new Function("document", "window", "fetch", "location", "innerWidth", "innerHeight", "setInterval", "clearInterval", "esc", "map", "STYLE_READY", cls.slice(cls.indexOf("var RK=")))(
  { body: mk("body", ids), getElementById: (k) => ids[k] || null, querySelectorAll: () => [] }, { __cityTwin: true, __resTwin: FT, __stackOpen() {} }, (u) => call(String(u)), { href: "" }, 1280, 800, (fn) => { fn(); return 1; }, () => {}, escCity, null, false);
ids.rh.onclick(); for (let i = 0; i < 30; i++) await new Promise(res => setTimeout(res, 5));
ids.rnat.kids[0].onclick(); for (let i = 0; i < 10; i++) await new Promise(res => setTimeout(res, 5));
ok(FT.draws.length >= 2 && FT.draws.at(-1) === true && ids.rres.textContent === "India · 1 communities", "private city: the panel shades through the scene, never a map");

// 4. the colours Kendall asked for: four distinct hues for the share bands, on every surface
r = await call("/map?key=" + READ + "&rk=" + RES);
const mapPage = await r.text();
r = await call("/residents?rk=" + RES);
const resPage = await r.text();
const hues = ["#3987e5", "#008300", "#c98500", "#d55181"];
ok(hues.every(h => mapPage.includes(h) && resPage.includes(h)) && ["0x3987e5", "0x008300", "0xc98500", "0xd55181"].every(h => priv.includes(h)) && !/1f5f58|a9e2da/.test(mapPage + resPage + priv), "bands: blue, green, amber, magenta on MAP, the residents page and the twins; the old teal shades are gone");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
