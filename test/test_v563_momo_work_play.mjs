// v563 - the MOMO tab opens on Work and Play: Play is today's Momo (/fit), Work is an empty room for now; owner only
import fs from "node:fs";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const ix = fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
ok(/\["fit", "\/momo", "fit", "MOMO"\]/.test(ix), "the MOMO tab goes to /momo");
ok(/\(\?:board\|studio\|trends\|fit\|momo\)/.test(ix), "a client link never shows the MOMO tab (/momo stripped like /fit)");
ok(/url\.pathname === "\/momo" \|\| url\.pathname\.startsWith\("\/momo\/work"\)/.test(ix) && /keyTier\(env, url\) !== "admin"\) return new Response\("not found", \{ status: 404 \}\)/.test(ix), "/momo and /momo/work are owner only");
const fn = ix.slice(ix.indexOf("function momoHtml("), ix.indexOf("// v235 (Kendall, 22 Sep 2026) — START: five ways in."));
ok(/href="\/fit' \+ q \+ '"[^]*<b>Play<\/b>/.test(fn), "Play opens today's Momo (/fit)");
ok(/href="\/momo\/work' \+ q \+ '"[^]*<b>Work<\/b>/.test(fn), "Work opens /momo/work");
ok(/Nothing here yet\./.test(fn), "Work is empty for now");
ok(/najNav\(key, "fit", rk\)/.test(fn), "the tab bar shows MOMO as the current tab");
console.log(`v563 momo work and play: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
