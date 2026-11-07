// v798: Download all - one zip of an event's photos, Kendall for any event, Najjuko for shared events only.
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { speakingRoute } from "../src/work_speaking.js";
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const rec = { items: [
  { id: "runway", title: "RUNWAY Dubai Awards", date: "2026-11-05", type: "award", status: "confirmed", shareWith: ["najjuko"], photos: [{ f: "runway05_dsc01" }, { f: "runway05_dsc02" }] },
  { id: "other", title: "Private talk", date: "2026-11-12", type: "talk", status: "confirmed", photos: [{ f: "other_p1" }] } ] };
const kv = new Map([["speaking_rec_kendall", JSON.stringify(rec)], ["speaking_file_kendall_runway05_dsc01", btoa("JPEG-ONE")], ["speaking_file_kendall_runway05_dsc02", btoa("JPEG-TWO")], ["speaking_file_kendall_other_p1", btoa("NO")]]);
const env = { MEETINGS: { get: async (k) => kv.get(k) ?? null, getWithMetadata: async (k) => ({ value: kv.get(k) ?? null, metadata: {} }) } };
const deps = (who) => ({ person: () => who, page: (k, rk, b) => "<html>" + b + "</html>" });
const go = (who, path) => speakingRoute(new Request("https://x" + path), env, new URL("https://x" + path), deps(who));
let r = await go("najjuko", "/momo/work/speaking/zip?key=n&id=runway");
ok(r.status === 200 && r.headers.get("Content-Type") === "application/zip" && /RUNWAY_Dubai_Awards_photos\.zip/.test(r.headers.get("Content-Disposition")), "Najjuko downloads the shared event's zip");
const f = new URL("./_v798.zip", import.meta.url); fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
const py = execFileSync("python", ["-c", "import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print(';'.join(i.filename+'='+z.read(i).decode() for i in z.infolist()))", f.pathname.replace(/^\/([A-Z]:)/, "$1")], { encoding: "utf8" }).trim();
fs.unlinkSync(f);
ok(py === "dsc01.jpg=JPEG-ONE;dsc02.jpg=JPEG-TWO", "zip opens and holds both photos intact: " + py);
ok((await go("najjuko", "/momo/work/speaking/zip?key=n&id=other")).status === 404, "unshared event refused for her");
ok((await go("kendall", "/momo/work/speaking/zip?key=k&id=other")).status === 200, "Kendall downloads any event");
ok((await go("", "/momo/work/speaking/zip?key=x&id=runway")).status === 404, "no key, no zip");
const h = await (await go("najjuko", "/momo/work/speaking?key=n")).text();
ok(h.includes("Download all (2 photos)") && h.includes("/momo/work/speaking/zip?key=n&id=runway"), "her Photos card has the button");
const src = fs.readFileSync(new URL("../src/work_speaking.js", import.meta.url), "utf8");
ok(/zb=el\("a","zipb","Download all \("/.test(src), "Kendall's Photos card has the button");
console.log("v798 photo zip:", n, "checks passed");
