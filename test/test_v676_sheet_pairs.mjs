// v676 - a product brief PDF and its matching infographic are ONE tile (Kendall 30 Oct 2026)
import { sheetsBody, infoOf, pairedSlugs, sheetsPublic } from "../src/work_sheets.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL " + m); } };

const idx = [
  { slug: "dubai-decoded", title: "Dubai, Decoded: Najma on one page", group: "Najma", kind: "image", ext: "jpg", uploaded_by: "najjuko" },
  { slug: "the-brief-decoded", title: "The Brief: from a client's wishes to a shortlist", group: "Najma", kind: "image", ext: "jpg", uploaded_by: "najjuko" },
  { slug: "najma-master", title: "Najma: Dubai property intelligence", group: "Najma", kind: "pdf", thumb: true, info: "dubai-decoded" },
  { slug: "najma-brief", title: "Najma: The Brief", group: "Najma deep dives", kind: "pdf", thumb: true, info: "the-brief-decoded" },
  { slug: "najma-docs", title: "Najma: Documents", group: "Najma deep dives", kind: "pdf", thumb: true },
  { slug: "lonely", title: "Bad pair", group: "X", kind: "pdf", info: "missing" }];

ok(infoOf(idx[2], idx) === idx[0] && infoOf(idx[3], idx) === idx[1], "each brief finds its own infographic");
ok(infoOf(idx[5], idx) === null && infoOf(idx[0], idx) === null, "missing info or an image is never paired");
ok([...pairedSlugs(idx)].sort().join() === "dubai-decoded,the-brief-decoded", "both infographics are paired");

const h = sheetsBody("k", "", idx, "https://o", "najjuko");
const tiles = (h.match(/class=tl /g) || []).length;
ok(tiles === 4, "4 tiles: 2 paired briefs, the plain PDF, the bad pair (got " + tiles + ")");
ok(!/data-t="Dubai, Decoded/.test(h) && !/data-t="The Brief: from/.test(h), "the infographics are not tiles of their own");
const master = h.slice(h.indexOf('data-t="Najma: Dubai property intelligence"'), h.indexOf('data-t="Najma: Dubai property intelligence"') + 400);
ok(/data-i="https:\/\/o\/pds\/f\/dubai-decoded\.jpg"/.test(master) && /src="\/pds\/f\/dubai-decoded\.jpg"/.test(master), "the intelligence brief shows and opens Dubai Decoded");
const brief = h.slice(h.indexOf('data-t="Najma: The Brief"'), h.indexOf('data-t="Najma: The Brief"') + 400);
ok(/data-i="https:\/\/o\/pds\/f\/the-brief-decoded\.jpg"/.test(brief), "The Brief shows and opens its own infographic");
ok(/<summary>Najma<span class=n>1<\/span>/.test(h), "the Najma group counts one card, not three");
ok(/id=pds_i/.test(h) && /E\("pds_i"\)\.style\.display/.test(h), "the sheet has an Open infographic button");

// Kendall cannot see Najjuko's uploads: his view degrades to the PDF alone
const kv = idx.filter((e) => !e.uploaded_by);
const hk = sheetsBody("k", "", kv, "https://o", "kendall");
ok(!/data-i=/.test(hk) && (hk.match(/class=tl /g) || []).length === 4, "without the infographic the PDF stands alone");

// public share page shows the infographic and offers both
const env = { MEETINGS: { get: async (k) => (k === "pds_index" ? JSON.stringify(idx) : null) } };
const r = await sheetsPublic(new Request("https://o/pds/najma-brief"), env, new URL("https://o/pds/najma-brief"));
const t = await r.text();
ok(/og:image" content="https:\/\/o\/pds\/f\/the-brief-decoded\.jpg"/.test(t) && /Open the PDF/.test(t) && /Download the infographic/.test(t), "share page: infographic picture, PDF and infographic buttons");

// the bridge: her Claude Code pairs her OWN infographic with a brief (pairing lives on the picture: for)
const { bridgeSheetPair } = await import("../src/work_sheets.js");
const plain = idx.map((e) => { const x = Object.assign({}, e); delete x.info; return x; });   // live data today: no info anywhere
const store = new Map([["pds_index", JSON.stringify(plain)]]);
const benv = { MEETINGS: { get: async (k) => store.get(k) || null, put: async (k, v) => { store.set(k, v); } } };
let r2 = await bridgeSheetPair(benv, "najjuko", { slug: "dubai-decoded", for: "najma-master" }, "https://o");
ok(r2[0] === 200 && r2[1].for === "najma-master", "pair her infographic with the intelligence brief");
r2 = await bridgeSheetPair(benv, "najjuko", { slug: "the-brief-decoded", for: "najma-brief" }, "https://o");
ok(r2[0] === 200, "pair the brief infographic with The Brief");
const after = JSON.parse(store.get("pds_index"));
ok(infoOf(after.find((x) => x.slug === "najma-master"), after).slug === "dubai-decoded" && infoOf(after.find((x) => x.slug === "najma-brief"), after).slug === "the-brief-decoded", "pairs read from the picture side");
ok((sheetsBody("k", "", after, "https://o", "najjuko").match(/class=tl /g) || []).length === 4, "after pairing: no separate infographic tiles");
ok((await bridgeSheetPair(benv, "kendall", { slug: "dubai-decoded", for: "najma-master" }, "https://o"))[0] === 403, "someone else's picture: refused");
ok((await bridgeSheetPair(benv, "najjuko", { slug: "dubai-decoded", for: "najma-brief" }, "https://o"))[0] === 409, "a brief that already has an infographic: refused");
ok((await bridgeSheetPair(benv, "najjuko", { slug: "dubai-decoded", for: "the-brief-decoded" }, "https://o"))[0] === 400, "pairing to a picture: refused");
ok((await bridgeSheetPair(benv, "najjuko", { slug: "dubai-decoded", for: "nope" }, "https://o"))[0] === 404, "unknown brief: refused");
ok((await bridgeSheetPair(benv, "najjuko", { slug: "najma-master", for: "najma-brief" }, "https://o"))[0] === 403, "a loaded PDF is nobody's to pair");
r2 = await bridgeSheetPair(benv, "najjuko", { slug: "dubai-decoded", for: "" }, "https://o");
ok(r2[0] === 200 && r2[1].for === null && !JSON.parse(store.get("pds_index")).find((x) => x.slug === "dubai-decoded").for, "for empty unpairs");

console.log("v676 sheet pairs: " + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
