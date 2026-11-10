// v831 (Kendall 10 Nov 2026): the Reels "Save" button becomes "Download" and the video route sends Content-Disposition: attachment for ?dl=1.
import { readFileSync } from "node:fs";
import { reelsBody } from "../src/work_reels.js";
let bad = 0; const ok = (c, m) => { if (!c) { bad++; console.log("FAIL", m); } else console.log("ok  ", m); };
const items = [{ slug: "siora-interiors-film-9x16", title: "SIORA interiors", video_key: "reel_siora_interiors_9x16_v2", secs: 91, format: "9:16", date: "2026-11-10" }];
const html = reelsBody("K", "", items, "https://example.dev");
ok(html.includes('href="/video/reel_siora_interiors_9x16_v2?dl=1&name=siora-interiors-film-9x16"') && html.includes('download="siora-interiors-film-9x16.mp4"') && html.includes(">Download</a>"), "tile has a Download link to ?dl=1 with a name");
ok(!html.includes(">Save</a>"), "no Save link remains");
const idx = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
ok(idx.includes('url.searchParams.get("dl") === "1"') && idx.includes("Content-Disposition") && idx.includes("attachment; filename="), "video route sends an attachment header for ?dl=1");
ok(idx.includes('.replace(/[^a-z0-9_-]/gi, "")') , "download name is sanitised");
console.log(bad ? bad + " FAILED" : "ALL OK"); process.exit(bad ? 1 : 0);
