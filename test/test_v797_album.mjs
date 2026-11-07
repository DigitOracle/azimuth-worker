// v797: shared photo album opened by everyone the album names (Kendall 7 Nov: "give access to Najjuko as well to these photographs").
import assert from "node:assert/strict";
import fs from "node:fs";
import { speakingRoute } from "../src/work_speaking.js";
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const kv = new Map([
  ["photo_album_runway05", JSON.stringify({ title: "RUNWAY Dubai", sub: "5 Nov 2026", who: ["kendall", "najjuko"], photos: [{ f: "runway05_dsc01" }] })],
  ["speaking_file_kendall_runway05_dsc01", btoa("JPEGDATA")], ["speaking_file_kendall_secret", btoa("NO")],
]);
const env = { MEETINGS: { get: async (k) => kv.get(k) ?? null, getWithMetadata: async (k) => ({ value: kv.get(k) ?? null, metadata: {} }) } };
const deps = (who) => ({ person: () => who, page: (k, rk, b) => "<html>" + b + "</html>" });
const go = (who, path) => speakingRoute(new Request("https://x" + path), env, new URL("https://x" + path), deps(who));
let r = await go("najjuko", "/momo/work/speaking/album?key=n&a=runway05"); let h = await r.text();
ok(r.status === 200 && h.includes("RUNWAY Dubai") && h.includes("1 photos") && h.includes("afile?key=n&a=runway05&f=runway05_dsc01"), "Najjuko opens the album");
r = await go("najjuko", "/momo/work/speaking/afile?key=n&a=runway05&f=runway05_dsc01");
ok(r.status === 200 && r.headers.get("Content-Type") === "image/jpeg" && (await r.text()) === "JPEGDATA", "Najjuko gets a photo in the album");
ok((await go("najjuko", "/momo/work/speaking/afile?key=n&a=runway05&f=secret")).status === 404, "a file outside the album is refused");
ok((await go("najjuko", "/momo/work/speaking/file?key=n&f=runway05_dsc01")).status === 404, "Kendall's own file route stays Kendall-only");
ok((await go("najjuko", "/momo/work/speaking?key=n")).status === 404, "Speaking page stays Kendall-only");
ok((await go("", "/momo/work/speaking/album?key=x&a=runway05")).status === 404, "no key, no album");
ok((await go("kendall", "/momo/work/speaking/album?key=k&a=nope")).status === 404, "unknown album refused");
ok((await go("kendall", "/momo/work/speaking/album?key=k&a=runway05")).status === 200, "Kendall opens it too");
const idx = fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
ok((idx.match(/d\.album \? '\/momo\/work\/speaking\/album' \+ q/g) || []).length === 2, "front door and product sheets link album entries");
console.log("v797 album:", n, "checks passed");
