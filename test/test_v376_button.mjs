// v376b - the 'Investor PDF: <project>' button on the developer profile; what=inv lists the projects that have a facts record.   node test/test_v376_button.mjs
import { devmapRoutes, devmapHtml } from "../src/devmap_page.js";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 300) : "")); } };
const store = new Map();
const env = { MEETINGS: { async get(k) { return store.has(k) ? store.get(k) : null; }, async put(k, v) { store.set(k, v); } }, READ_KEY: "RK" };
const deps = { clientOk: () => true, keyTier: () => "owner", najNav: () => "", NAJ_NAV_CSS: "", NAJ_FONTS: "", clientResp: (e, u, b, o) => new Response(b, o) };
const call = (q) => { const u = "https://x/developers_map_api?key=RK&" + q; return devmapRoutes(new Request(u), env, new URL(u), deps); };
let r = await call("what=inv"); let j = r ? await r.json() : null;
ok(j && Array.isArray(j.projects) && j.projects.length === 0, "no facts record: empty list, nothing offered", JSON.stringify(j));
store.set("img_investor_tiers_facts", JSON.stringify({ projects: { "chelsea-residences-by-damac": { project: { id: "chelsea-residences-by-damac", name: "Chelsea Residences", brand_name: "Chelsea Residences by DAMAC" }, big: "x".repeat(5000) } } }));
r = await call("what=inv"); j = await r.json();
ok(j.projects.length === 1 && j.projects[0].id === "chelsea-residences-by-damac" && j.projects[0].brand === "Chelsea Residences by DAMAC" && !JSON.stringify(j).includes("xxxx"), "facts present: id, name and brand only, no facts body", JSON.stringify(j));
const html = devmapHtml("k", deps);
ok(html.includes("function pdfRowProf") && html.includes('api("inv")') && html.includes("kind=investor_selector"), "page carries the button code and fetches the list");
const scripts = html.match(/<script>([\s\S]*?)<\/script>/g) || [];
let parses = true; try { scripts.forEach(s => { const body = s.replace(/^<script>|<\/script>$/g, ""); if (body.length > 2000) new Function(body); }); } catch (e) { parses = false; console.log(String(e)); }
ok(parses && scripts.length > 0, "the page script still parses");
console.log("\n" + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
