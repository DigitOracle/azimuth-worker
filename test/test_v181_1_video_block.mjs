// v181.1 — /dev?d=emaar AND /dev?d=sobha THREW (Error 1101), 18 Sep 2026.
//
// videoBlock is a top-level function but called esc2, which exists only inside other page functions. Every page that drew a
// video tour threw "esc2 is not defined"; Emaar and Sobha are the developers whose properties match a video. The test runs
// the function ALONE, in its own scope, which is exactly how the worker runs it - a helper borrowed from elsewhere fails here.
import { readFileSync } from "fs";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("ok - " + m); } else { fail++; console.log("not ok - " + m); } };

const src = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
const a = src.indexOf("function videoBlock(v) {");
const b = src.indexOf("\nfunction ", a + 10);
ok(a >= 0 && b > a, "videoBlock found");
let videoBlock = null, err = null;
try { videoBlock = new Function(src.slice(a, b) + ";return videoBlock;")(); } catch (e) { err = e; }
let html = "";
try { html = videoBlock({ poster: "/p.jpg", src: "/v.mp4", title: "Emaar <Beachfront> & \"Grande\"", approx: true, plot: "123-45" }); } catch (e) { err = e; }
ok(!err, "videoBlock runs on its own - it needs no helper from another function" + (err ? ": " + err.message : ""));
ok(/Emaar &lt;Beachfront&gt; &amp;/.test(html), "and the caption is still escaped");
ok(/plot 123-45/.test(html), "the approximate-pin note still names the plot");

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
