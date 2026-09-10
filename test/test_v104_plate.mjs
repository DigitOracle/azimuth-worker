// v104 — the background plate carries the figure (8 Sep 2026, Naj: "an image without the data").
// Pulls bgPromptBlock straight out of src/index.js and checks both branches.
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
const a = src.indexOf("function bgPromptBlock(angle, place, pal) {");   // v117: takes her palette
const b = src.indexOf("\nfunction visualPromptBlock(angle) {");
const h0 = src.indexOf("function hashStr("); const h1 = src.indexOf("\n", h0);   // v105: the prompt seeds its look with hashStr
const bgPromptBlock = new Function(src.slice(h0, h1) + "\n" + src.slice(a, b) + "\nreturn bgPromptBlock;")();

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };

// The angle Naj picked on 8 Sep (angle 1 of brief 1788836576905), as /angle_svg rendered it.
const ang = { hook: "Treppan Living locked 572 sales across its active pipeline—an 83% off-plan concentration proving Fakhruddin Properties' buyer conviction now towers over the market's average", figure: "83%", source: "MEED Projects corpus, dldPulse register" };
const p = bgPromptBlock(ang);
ok(p.includes('"THE DIGEST"'), "masthead is asked for");
ok(/the figure "83%" set VERY LARGE in (bronze gold #A88448|deep green #003C1E)/.test(p), "figure is rendered very large in her palette");
ok(p.includes('the source line "MEED Projects corpus, dldPulse register" in deep green'), "source sits under the gold rule, as on her cards");
ok(p.includes("all of it inside the LEFT COLUMN, none of it crossing into the right side"), "text is confined to the LEFT column");
ok(p.includes("that is where a standing figure is composited later"), "the RIGHT side is her standing area");
ok(p.includes("ABSOLUTELY NO PEOPLE"), "still no people");
ok(!p.includes("do not render any of this as text"), "the old 'do not render' clause is gone when there is a figure");
ok(p.includes("Render \"THE DIGEST\", \"83%\", \""), "verbatim list names every string");
ok(/headline "[^"]{20,120}"/.test(p), "long hook trimmed to <=120 chars for the model");
ok(!/headline "[^"]*[—,;:-]"/.test(p), "trimmed headline does not end on dangling punctuation");
ok(p.includes("check the figure reads exactly “83%”"), "she is told to check the number");
ok(p.startsWith("🎨 *Cover plate"), "titled as a cover plate");
ok(p.split("```").length === 3, "exactly one code block");

// Empty angle (the fallback the send path uses) keeps the old text-free plate.
const e = bgPromptBlock({ hook: "", figure: "", source: "" });
ok(e.startsWith("🎨 *Background plate"), "empty angle: still a background plate");
ok(e.includes("no text, no captions, no numbers"), "empty angle: text-free");
ok(e.includes("LEFT COLUMN still carries the soft cream wash"), "empty angle: column reserved for later type");
ok(!e.includes("TEXT —"), "empty angle: no TEXT section");
ok(e.split("```").length === 3, "empty angle: one code block");

// Campaign angle keeps The Valley place line.
const c = bgPromptBlock({ hook: "Family lawns", figure: "AED 1.2m", source: "DLD", campaign: true });
ok(c.includes("The Valley by Emaar"), "campaign: Valley place kept");
ok(c.includes('"AED 1.2m" set VERY LARGE'), "campaign: figure on the plate");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
