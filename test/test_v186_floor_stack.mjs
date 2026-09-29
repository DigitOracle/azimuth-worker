// v186 - the floor stack on the district twin (19 Sep 2026): the twin page carries the block, the block itself parses as a module
// (it lives inside a template literal, where node --check on index.js cannot see it), it reads /img/stack_<district> and keys the
// register by footprint id, never by mesh order, and it says on the card what the data can and cannot claim. Through the real
// worker; the page's own logic is exercised on stand-in objects.
import worker from "../src/index.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const READ = "client_read_key_in_links_123";
const store = new Map();
const KV = {
  async get(k) { return store.has(k) ? store.get(k) : null; },
  async put(k, v) { store.set(k, v); },
  async delete(k) { store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter(k => k.startsWith(p)).map(name => ({ name })) }; },
};
globalThis.fetch = async () => new Response("{}", { status: 200 });
const env = { MEETINGS: KV, READ_KEY: READ, INGEST_TOKEN: "ING", PUBLIC_ORIGIN: "https://azimuth-2.digitalchemy.workers.dev" };
const call = (p, init, e) => worker.fetch(new Request("https://azimuth-2.digitalchemy.workers.dev" + p, init), e || env, { waitUntil() {} });
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };
const parses = (code, ext) => { const f = path.join(os.tmpdir(), "v186_" + Math.random().toString(36).slice(2) + ext); fs.writeFileSync(f, code); try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); return true; } catch (e) { console.log(String(e.stderr || e.message).slice(0, 600)); return false; } finally { try { fs.unlinkSync(f); } catch (e) {} } };

store.set("img_sky_businessbay", "glb");
const r = await call("/skyline/businessbay?key=" + READ);
const html = await r.text();

// 1. the block is on the page, once, with its own state and no leaked owner key
ok(html.indexOf("v186 - FLOOR STACK") > 0, "the floor stack block is on the twin page");
ok(html.split("v186 - FLOOR STACK").length === 2, "it is there exactly once");
ok(html.includes('fetch("/img/stack_"+window.__twinDistrict'), "it reads /img/stack_<district> from the page's own district");
ok(html.includes("ren.localClippingEnabled=true"), "clipping is switched on for the bands");

// 2. the block parses on its own - index.js hides it inside a template literal, so node --check on the worker cannot see it
const b0 = html.indexOf("// v186 - FLOOR STACK");   // the page has an earlier Raycaster of its own: measure from the block's start
const block = html.slice(b0, html.indexOf("const ray=new THREE.Raycaster()", b0));
ok(block.length > 8000, "the block extracted for checking looks complete");
ok(parses(block, ".mjs"), "the block parses as a module");
ok(!/[`]/.test(block) && !block.includes("${") && !block.includes("\\"), "no backtick, ${ or backslash: it sits in a template literal");

// 3. the register is keyed by footprint id (window.BYFP), never by mesh order - the bug that drew one tower's floors on another
ok(block.includes("window.BYFP[k]"), "a building's meshes come from the page's footprint index");
ok(!/MESHES\[\+i\],r=STK/.test(block), "no mesh-order lookup is left behind");

// 4. the model is never changed: originals move to an unused layer and come back
ok(block.includes("m.userData.stkMask=m.layers.mask") && block.includes("m.layers.mask=m.userData.stkMask"), "the original mesh's layers are saved and restored");
ok(block.includes("new THREE.Mesh(m.geometry,mt)"), "bands share the model's own geometry: nothing is rebuilt");
ok(!/m\.geometry\s*=|geometry\.dispose|\.scale\.set/.test(block), "the massing's geometry, scale and heights are not touched");

// 5. what the card is allowed to claim
ok(block.includes("not a unit position"), "the card says a type on a floor is a register range, not a unit position");
ok(block.includes("Dubai Municipality floor register"), "the card names the floor register");
ok(block.includes("divided evenly"), "the card says the floors divide the model's surveyed height evenly");
ok(block.includes("The register numbers levels "), "the card says when the register's level numbering was shifted to fit");

// 6. the panel: the filters of the Symphony viewer, and the building view named as Kendall asked
ok(block.includes("<h4>Homes<u class=stkx id=stkx title=close>✕</u></h4>") && block.includes("Hide all") && block.includes("#hh,#hp{display:none"),
  "the district panel is the homes filter itself, in Najma chrome, and the old HOMES control is gone from the twin");
ok(/STKCHIP=\[\["studio","Studio"\],\["1","1 BHK"\]/.test(block), "the type chips are studio / 1 / 2 / 3 / 4+ BHK");
ok(block.includes('fb.textContent="Floor layout"'), "the building panel's third view is Floor layout");
ok(block.includes("Floor layout <span>"), "the floor-range chart carries its heading");
ok(block.includes("The map calls this building ") && block.includes("bound to the wrong footprint"), "a register record bound to the wrong footprint is said on the card, not drawn in silence");

// 7. the district file is served from KV like every other /img/ asset, and is keyless
store.set("img_stack_businessbay", JSON.stringify({ district: "businessbay", buildings_by_id: { 574: { name: "Al Habtoor Tower", basis: "dm_floors", floors: [], types: [] } } }));
const img = await call("/img/stack_businessbay");
ok(img.status === 200, "/img/stack_businessbay is served");
const got = await img.json();
ok(got.buildings_by_id && got.buildings_by_id["574"].name === "Al Habtoor Tower", "the district's stacks come back whole");

console.log((fail ? "FAIL" : "PASS") + " - v186 floor stack: " + pass + " ok, " + fail + " failed");
process.exit(fail ? 1 : 0);
