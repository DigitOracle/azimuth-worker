// v298 - two adjoining DAMAC Hills Piccadilly Green townhouses (K015B, K016B) are TWO side-by-side options, each with its own exact position
// and aimed Street View - and NEVER a satellite picture anywhere in the Brief (Kendall, 4 Oct 2026).
//   A  data: two rent-index records (own footprint ids "fp", the community's evidence flagged "ev_scope") + two footprints on the layer
//   B  compare: two cards side by side, each placed EXACTLY (not approximate), each Street View card aimed at its own door (Google mocked),
//      rent evidence labelled as the community's with its n, no owner fields
//   C  picture order: developer/own photo -> Street View -> our own render ("Illustration - Najma render") -> Blocks view
//   D  no satellite URL is ever requested (Street View with no panorama, an amenity spot filed "satellite")
//   N  NEGATIVE CONTROL against the v297 source (git archive release-v297): the same data gives ONE unplaced community-style record per
//      key (no footprint, no Street View aimed), and v297 DOES request a satellite picture where Street View has none.
//   node test/test_v298_two_villas.mjs
import { buildDocument, parseQuery, markOf, svTarget } from "../src/brief_docs.js";
import { pictureOf, googleUrl } from "../src/amenity_cards.js";
import { makeKV, TINY_JPEG } from "./v290_fixture.mjs";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 400) : "")); } };

// ---- fixture: the real affine of the live layer, our two outlines, one app building (id 7), neighbours --------------------------------
const LL = [100920.1814, 1425.2759, -5610524.5562, -1294.6595, 110762.104, -2698279.874];
const xy = (lat, lon) => [LL[0] * lon + LL[1] * lat + LL[2], LL[3] * lon + LL[4] * lat + LL[5]];
const box = (lat, lon, w, h) => { const [x, y] = xy(lat, lon); const r = [x - w / 2, y - h / 2, x + w / 2, y - h / 2, x + w / 2, y + h / 2, x - w / 2, y + h / 2]; return r.concat(r.slice(0, 2)); };
const K15 = [25.0298437, 55.2651084], K16 = [25.029868, 55.2652418];   // building centres (peer session's figures, checked against the plot file)
const layer = { d: "damachills", v: 1, ll: LL, b: [[7, 12, box(25.0310, 55.2640, 14, 14)], [8, 12, box(25.0290, 55.2662, 14, 14)], [2001, 8, box(...K15, 9, 14)], [2002, 8, box(...K16, 9, 14)]], s: [] };
const COMM = { n: 6, nn: 5, nr: 1, m: 300000, q1: 281250, q3: 307500, s: 354.5, last: "2026-09-24", mn: 300000, q1n: 275000, q3n: 310000 };
const villa = (slug, name, fp) => ({ p: "damachillspiccadillygreen" + slug, n: name, area: "Al Hebiah Third", d: "damachills", last: "2026-09-24", v: { "3": JSON.parse(JSON.stringify(COMM)) },
  fp: [fp], ev_scope: "DAMAC Hills - Piccadilly Green", render_basis: "plot_outline" });
const items = (withFp) => [
  { p: "damachillspiccadillygreen", n: "DAMAC HILLS - PICCADILLY GREEN", area: "Al Hebiah Third", d: "damachills", last: "2026-09-24", v: { "3": COMM } },
  villa("k015b", "Villa K015B, Land 740, DAMAC Hills - Piccadilly Green", 2001), villa("k016b", "Villa K016B, Land 741, DAMAC Hills - Piccadilly Green", 2002),
  { p: "appvilla", n: "Test Villas Seven", area: "Al Hebiah Third", d: "damachills", i: 7, lat: 25.031, lon: 55.264, last: "2026-09-24", v: { "3": JSON.parse(JSON.stringify(COMM)) } },
].map((it) => (withFp ? it : (({ fp, ...r }) => r)(it)));
const KEYS = "dld:damachillspiccadillygreen-k015b,dld:damachillspiccadillygreen-k016b";
const PANO = [25.03005, 55.26517];   // ~25 m north of both houses, between them
const bearing = (p, q) => { const r = Math.PI / 180, y = Math.sin((q[1] - p[1]) * r) * Math.cos(q[0] * r), x = Math.cos(p[0] * r) * Math.sin(q[0] * r) - Math.sin(p[0] * r) * Math.cos(q[0] * r) * Math.cos((q[1] - p[1]) * r); return (Math.atan2(y, x) / r + 360) % 360; };

function mkEnv(rentItems, withRender) {
  const { KV, J } = makeKV();
  J("rent_index", { as_of: "2026-09-30", source_file: "rents-test.csv", items: rentItems });
  J("districts_geo", { districts: [{ slug: "damachills", name: "DAMAC Hills" }] });
  J("amenities", { items: [] }); J("brief_fp_damachills", layer);
  if (withRender) { KV.store.set("img_render_dld-damachillspiccadillygreen-k015b", TINY_JPEG.buffer.slice(0)); KV.store.set("img_ct_render_dld-damachillspiccadillygreen-k015b", "image/jpeg"); }
  return { MEETINGS: KV, GOOGLE_MAPS_KEY: "TEST_KEY_never_shown_123", PUBLIC_ORIGIN: "https://x.example" };
}
let urls = [];
const googleStub = (pano) => async (url) => {
  const u = String(url); urls.push(u);
  if (u.includes("/streetview/metadata")) return new Response(JSON.stringify(pano ? { status: "OK", pano_id: "P1", date: "2023-04", copyright: "© Google", location: { lat: PANO[0], lng: PANO[1] } } : { status: "ZERO_RESULTS" }), { status: 200, headers: { "Content-Type": "application/json" } });
  if (u.includes("/streetview?") || u.includes("staticmap")) return new Response(new Uint8Array(9000).fill(7), { status: 200, headers: { "Content-Type": "image/jpeg" } });
  return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
};
async function run(mod, rentItems, keys, pano, withRender) {
  urls = []; globalThis.fetch = googleStub(pano);
  const q = mod.parseQuery(new URL("https://x/brief_pdf?kind=compare&mode=rent&beds=3&type=villa&keys=" + encodeURIComponent(keys) + "&format=html"));
  const doc = await mod.buildDocument(mkEnv(rentItems, withRender), q, { now: new Date("2026-10-04T08:00:00Z") });
  return { doc, urls: urls.slice(), cards: (doc.html || "").split('<div class="bcard"').slice(1).map((c) => c.split('class="sheet page')[0]) };
}
const here = { parseQuery, buildDocument };

console.log("A/B - two options side by side, each placed exactly, each aimed");
const r1 = await run(here, items(true), KEYS, true, false);
ok(r1.doc.status === 200 && r1.cards.length === 2, "the compare has two option cards", r1.doc.status + " cards=" + r1.cards.length);
const recs = r1.doc.C.recs;
ok(recs.length === 2 && recs[0].name !== recs[1].name && /K015B/.test(recs[0].name) && /K016B/.test(recs[1].name), "two records, named for their own villa and land number", recs.map((r) => r.name).join(" | "));
const L = r1.doc.C.district.damachills.layer;
const m1 = recs.map((r) => markOf(r, L));
ok(m1.every((m) => m.placed && !m.approx && !m.area) && m1[0].ids[0] === 2001 && m1[1].ids[0] === 2002, "each is placed EXACTLY on its own footprint (not approximate, not an area)", JSON.stringify(m1.map((m) => [m.placed, m.approx, m.ids])));
ok(recs.every((r) => r.exact && r.pos && recs[0].pos[1] !== recs[1].pos[1]), "each has its own position (distances are from it, not 'approximate'), and the two differ", JSON.stringify(recs.map((r) => r.pos)));
ok(Math.abs(recs[0].pos[1] - K15[1]) < 3e-5 && Math.abs(recs[1].pos[1] - K16[1]) < 3e-5, "the positions are the two buildings' centres (within ~3 m)");
const heads = r1.urls.filter((u) => /\/streetview\?/.test(u)).map((u) => +/heading=(\d+)/.exec(u)[1]);
const want = [Math.round(bearing(PANO, K15)), Math.round(bearing(PANO, K16))];
ok(heads.length === 2 && new Set(heads).size === 2 && heads.every((h) => want.some((w) => Math.abs(h - w) <= 3)), "two Street View pictures, each aimed from the panorama at its own house (headings differ)", heads.join(",") + " want " + want.join(","));
ok(r1.cards.every((c) => /Street View &middot; &copy; Google/.test(c)), "both cards carry the Street View credit");
ok(r1.cards.every((c) => /AED 300,000/.test(c) && /5 new, 6|6 \(5 new\)/.test(c) && /community&rsquo;s, not this home&rsquo;s/.test(c) && /DAMAC Hills - Piccadilly Green/.test(c)),
  "each card shows the rent as the community's, with its n (6, 5 new)", r1.cards[0] && r1.cards[0].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 500));
ok(/this is the community's rent evidence, not that home's own/.test(r1.doc.html), "the rent source note says the evidence is the community's");
ok(!/owner|e-?mail|\+971|phone|mobile|\S@\S/i.test(r1.cards.join(" ").replace(/<[^>]+>/g, " ").replace(/\+971 56 548 4397/g, "")) && JSON.stringify(items(true).slice(1, 3)).search(/owner|email|phone|mobile/i) < 0, "no owner fields in the records or the cards");
ok(!r1.urls.some((u) => /staticmap|maptype=satellite/.test(u)), "no satellite request while Street View works");
ok(svTarget(recs[0], L) && svTarget(recs[1], L) && svTarget(recs[0], L).c[1] !== svTarget(recs[1], L).c[1], "svTarget aims at each villa's own footprint");

console.log("C - picture order: Street View, then our render, then Blocks");
const r2 = await run(here, items(true), KEYS, false, true);
ok(r2.cards.length === 2 && !/Street View &middot;/.test(r2.cards.join("")), "no panorama: no Street View card");
ok(/Illustration &middot; Najma render &middot; modelled from the plot and as-built outline/.test(r2.cards[0]) && /class="renderpic"/.test(r2.cards[0]), "K015B (render supplied) shows the render, labelled Illustration - Najma render, modelled from the plot and outline", r2.cards[0].slice(0, 300));
ok(!/Illustration/.test(r2.cards[1]) && /data-kind="blocks"/.test(r2.cards[1]), "K016B (no render) falls to the Blocks view", (/data-kind="(\w+)"/.exec(r2.cards[1]) || [])[1]);
ok(!/Najma render/.test(r2.cards[1]), "the render label never appears on a card without a render");
const r2b = await run(here, items(true), KEYS, true, true);
ok(/Street View &middot;/.test(r2b.cards[0]) && !/Najma render/.test(r2b.cards[0]), "with both, Street View wins over the render");
ok(r2.doc.C.recs[0].picSource === "render" && r2.doc.C.recs[1].picSource === "blocks", "picture kinds: render, blocks", r2.doc.C.recs.map((r) => r.picSource).join(","));

console.log("D - never a satellite request");
const r3 = await run(here, items(true), KEYS + ",damachills:7", false, false);
ok(!r3.urls.some((u) => /staticmap|maptype=satellite/.test(u)), "Street View with no panorama requests NO satellite picture", r3.urls.filter((u) => /static/.test(u)).join("\n"));
ok(!/Satellite view/.test(r3.doc.html), "no 'Satellite view' label anywhere in the document");
ok(pictureOf({ picture: { route: "satellite" }, lat: 1, lng: 1 }, true) === null, "an amenity spot filed 'satellite' offers no picture");
ok(googleUrl({ picture: { route: "satellite" }, lat: 25, lng: 55 }, "K", 640) === null, "googleUrl never builds a Maps Static address");

console.log("N - negative control: the v297 source");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "v297_"));
let v297 = null;
try {
  const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, "")), "..");
  const tarball = execFileSync("git", ["archive", "release-v297", "src"], { cwd: repo, maxBuffer: 64 * 1024 * 1024 });
  execFileSync("tar", ["-x"], { cwd: tmp, input: tarball });
  fs.symlinkSync(path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, "")), "..", "node_modules"), path.join(tmp, "node_modules"), "junction");
  v297 = await import(pathToFileURL(path.join(tmp, "src", "brief_docs.js")).href);
} catch (e) { console.log("  (v297 source not available here: " + String(e.message).slice(0, 120) + ")"); }
if (v297) {
  const n1 = await run(v297, items(true), KEYS, true, true);
  const N = n1.doc.C ? n1.doc.C.recs : [];
  const placed = N.map((r) => v297.markOf(r, n1.doc.C.district.damachills.layer));
  ok(placed.every((m) => !m.placed) && !n1.urls.some((u) => /\/streetview\?/.test(u)), "v297: the two records are NOT placed and get NO aimed Street View (the new data alone does nothing)", JSON.stringify(placed));
  ok(!/Najma render/.test(n1.doc.html), "v297: a supplied render is ignored (no render slot)");
  const n2 = await run(v297, items(true), "damachills:7", false, false);
  ok(n2.urls.some((u) => /staticmap/.test(u) && /maptype=satellite/.test(u)), "v297 DOES request a satellite picture where Street View has none (this is what v298 removes)");
}
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
