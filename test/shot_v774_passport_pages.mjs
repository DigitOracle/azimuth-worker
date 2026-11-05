// v774 review: render /p/ pages for "Test" (keeper, seller, investor) from REAL stored data (DP_FIX folder of KV values) to HTML files in OUT.
import fs from "fs";
import { dpLoad } from "../src/district_passport.js";
import { docHtml } from "../src/district_doc.js";
const DIR = process.env.DP_FIX, OUT = process.env.OUT, ORIGIN = "https://azimuth-2.digitalchemy.workers.dev";
const env = { MEETINGS: { get: async (k) => { if (/^dp_img_.*_meta$/.test(k)) return "image/jpeg"; try { return fs.readFileSync(DIR + "/" + k + ".json", "utf8"); } catch (e) { return null; } } } };
const at = "2026-11-05T05:00:00Z";
for (const [slug, reader, answer] of [["palm-jebel-ali", "keeper", "Keeping it until handover"], ["palm-jebel-ali", "seller", "Open to selling"], ["palm-springs", "investor", "Another Palm investment"]]) {
  const d = await dpLoad(env, slug);
  const h = docHtml(d, { slug, reader, name: "Test", answer, at }, ORIGIN);
  fs.writeFileSync(OUT + "/p_" + reader + ".html", h);
  console.log(reader, h.length, /to confirm/i.test(h) ? "TO CONFIRM FOUND" : "clean", /\.pdf\b/i.test(h) ? "PDF NAME FOUND" : "");
}
