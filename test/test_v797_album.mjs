// v797: Momo > Speaking > the event > a child Photos card; Najjuko sees only the events shared with her (Kendall 7 Nov).
import assert from "node:assert/strict";
import fs from "node:fs";
import { speakingRoute, najSharedSpeaking } from "../src/work_speaking.js";
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const rec = { items: [
  { id: "runway", title: "RUNWAY Dubai Awards", date: "2026-11-05", type: "award", status: "confirmed", shareWith: ["najjuko"], photos: [{ f: "runway05_dsc01" }], notes: "private note" },
  { id: "other", title: "Private talk", date: "2026-11-12", type: "talk", status: "confirmed", photos: [{ f: "other_p1" }] },
] };
const kv = new Map([["speaking_rec_kendall", JSON.stringify(rec)], ["speaking_file_kendall_runway05_dsc01", btoa("JPEGDATA")], ["speaking_file_kendall_other_p1", btoa("NO")]]);
const env = { MEETINGS: { get: async (k) => kv.get(k) ?? null, getWithMetadata: async (k) => ({ value: kv.get(k) ?? null, metadata: {} }) } };
const deps = (who) => ({ person: () => who, page: (k, rk, b) => "<html>" + b + "</html>" });
const go = (who, path, m) => speakingRoute(new Request("https://x" + path, { method: m || "GET" }), env, new URL("https://x" + path), deps(who));
let r = await go("najjuko", "/momo/work/speaking?key=n"); let h = await r.text();
ok(r.status === 200 && h.includes("RUNWAY Dubai Awards") && h.includes("Photos (1)"), "Najjuko: Speaking > the event > Photos");
ok(!h.includes("Private talk") && !h.includes("private note"), "she sees only the shared event, not its notes");
ok(h.includes("/momo/work/speaking/file?key=n&f=runway05_dsc01"), "photos load through her key");
r = await go("najjuko", "/momo/work/speaking/file?key=n&f=runway05_dsc01");
ok(r.status === 200 && (await r.text()) === "JPEGDATA", "she gets a photo of a shared event");
ok((await go("najjuko", "/momo/work/speaking/file?key=n&f=other_p1")).status === 404, "a photo of an unshared event is refused");
ok((await go("najjuko", "/momo/work/speaking/rec?key=n")).status === 404, "the full record stays Kendall's");
ok((await go("najjuko", "/momo/work/speaking/api?key=n", "POST")).status === 404, "she cannot change anything");
ok((await go("", "/momo/work/speaking?key=x")).status === 404, "no key, nothing");
ok(await najSharedSpeaking(env) === true, "front door knows an event is shared with her");
kv.set("speaking_rec_kendall", JSON.stringify({ items: [rec.items[1]] }));
ok(await najSharedSpeaking(env) === false && (await go("najjuko", "/momo/work/speaking?key=n")).status === 404, "nothing shared: no Speaking for her");
const idx = fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8"), src = fs.readFileSync(new URL("../src/work_speaking.js", import.meta.url), "utf8");
ok(!idx.includes("speaking/album") && idx.includes("speaking === true ? '<a class=card href=\"/momo/work/ggu'"), "no front-door album; GGU stays Kendall's");
ok(/pc=el\("details","sphc"\)/.test(src), "Kendall's event card holds Photos as a child card");
console.log("v797 shared speaking photos:", n, "checks passed");
