// v797: event photos on a Speaking card (Kendall 7 Nov: RUNWAY Dubai photos on that card, stored in the cloud).
import assert from "node:assert/strict";
import fs from "node:fs";
import { cleanItem } from "../src/work_speaking.js";
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const c = cleanItem({ title: "x", photos: [{ f: "runway_01", cap: "Stage" }, { f: "" }, null] });
ok(c.photos.length === 1 && c.photos[0].f === "runway_01" && c.photos[0].cap === "Stage", "photos kept, empty dropped");
const kept = cleanItem({ notes: "n" }, c);
ok(kept.photos.length === 1, "an edit without photos keeps them");
ok(cleanItem({ title: "y" }).photos.length === 0, "new item starts with no photos");
ok(cleanItem({ title: "z", photos: Array.from({ length: 300 }, (_, i) => ({ f: "p" + i })) }).photos.length === 200, "capped at 200");
const src = fs.readFileSync(new URL("../src/work_speaking.js", import.meta.url), "utf8");
ok(/Photos \("\+i\.photos\.length/.test(src) && /im\.loading="lazy"/.test(src), "card draws a lazy photo grid");
ok(/speaking\/file\?f="\+encodeURIComponent\(p\.f\)\+"&key="/.test(src), "photos load through the key-gated file route");
ok(/\.sph\{display:grid/.test(src), "grid style present");
console.log("v797 event photos:", n, "checks passed");
