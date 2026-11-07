// v802: the Momo New launches card, tidied (Kendall 7 Nov 2026, "Yes, push all of this"): right pictures only, the report list, icon
// buttons, the Quick task button out of the way, one-line intro, one filter row with a Filter sheet, paging, the card fields, what counts.
import assert from "node:assert/strict";
import fs from "node:fs";
import { launchCards, launchesPage, aedShort, picBelongs, picOk, picCounts } from "../src/launches_card.js";
import { launchAngles } from "../src/feed_ledger.js";
import { reportHtml, sharedPics } from "../src/launch_report.js";
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const W = "https://azimuth-2.digitalchemy.workers.dev";
const today = "2026-11-07";
let seq = 0;
const row = (o) => Object.assign({ key: "ap_" + String(++seq).padStart(12, "0"), project: "Ocean Crest", developer: "Samana", area: "Dubai Islands", from_aed: 2850000,
  units: "1BR, 2BR", handover: "Q4 2028", confidence: "high", registered: false, first_seen: "2026-11-07", last_seen: "2026-11-07", kinds: ["youtube"], sources_n: 1,
  links: ["https://www.youtube.com/watch?v=AAAAAAAAAAA"], pic: W + "/img/lpic_AAAAAAAAAAA_0", pic_credit: "Some Channel", pic_link: "https://www.youtube.com/watch?v=AAAAAAAAAAA" }, o);

// 1. WRONG PICTURES: the Meraas case - one masterplan aerial on several projects, shown on none of them
const GEN = W + "/img/lpic_dev_0e2b82231002c0";
const meraas = [row({ project: "Bluewaters Residences", developer: "Meraas", pic: GEN, pic_link: "https://meraas.com/en/project/bluewaters-residences", pic_credit: "Meraas (developer website)" }),
  row({ project: "Sur La Mer", developer: "Meraas", pic: GEN, pic_link: "https://meraas.com/en/project/sur-la-mer" })];
let html = launchCards(meraas, today, "?key=K");
ok(!html.includes(GEN) && (html.match(/class="pic none"/g) || []).length === 2, "the same picture on two projects is shown on neither");
ok(!picOk(meraas[0], picCounts(meraas)) && picOk(meraas[0], picCounts([meraas[0]])), "picOk counts across projects");
ok(picBelongs({ project: "Binghatti Dawn JVC", developer: "Binghatti", pic_link: "https://www.binghatti.com/en/projects/binghatti-dawn" }), "page named for the project: kept");
ok(!picBelongs({ project: "Bluewaters Residences", developer: "Meraas", pic_link: "https://meraas.com/en/project/bluewaters-bay" }), "page for another project: rejected");
ok(!picBelongs({ project: "Binghatti Dusk JVC", developer: "Binghatti", pic_link: "https://www.binghatti.com/en/projects/binghatti-dawn" }), "the developer's name alone is not a match");
ok(picBelongs({ project: "Le Pont at Port De La Mer", developer: "Meraas", pic_link: "https://meraas.com/en/project/pdlm-le-pont" }), "judged on the name, not its address");
ok(picBelongs({ project: "Binghatti Pinnacle Al Jaddaf", developer: "Binghatti", pic_link: "https://www.binghatti.com/en/projects/binghatti-pinnacle" }), "the area after the name does not stop the match");
ok(picBelongs({ project: "X", pic_link: "https://www.youtube.com/watch?v=AAAAAAAAAAA" }), "a frame of the project's own video is kept");
const shared = sharedPics({ a: { pics: [{ url: GEN }] }, b: { pics: [{ url: GEN }, { url: W + "/img/lpic_B_0" }] } });
ok(shared.has(GEN) && !shared.has(W + "/img/lpic_B_0"), "report: a picture under two launches is shared");
const rA = row({ key: "ap_aaaaaaaaaaaa" }), rB = row({ key: "ap_bbbbbbbbbbbb", project: "Sur La Mer" });
const rep = reportHtml([rA, rB], { [rA.key]: { pics: [{ url: GEN, credit: "Meraas" }] }, [rB.key]: { pics: [{ url: GEN, credit: "Meraas" }] } }, { by: "kendall" });
ok(!rep.includes(GEN) && /class="hero none"/.test(rep), "report: the generic picture is on no page");

// 8. the card
const one = row({ key: "ap_cccccccccccc", registered: true, kinds: ["dld_register", "youtube"] });
html = launchCards([one, row({ project: "Old Tower", first_seen: "2026-10-01", from_aed: 679000, pic: W + "/img/lpic_OLDOLDOLDOL_0" })], today, "?key=K");
ok(/from AED 2\.85M<small>as advertised<\/small>/.test(html) && /from AED 679K/.test(html) && aedShort(2000000) === "AED 2M" && aedShort(null) === "", "price headline shortened");
ok(/>On the register</.test(html) && !/seen on/.test(html) && !/class="cf/.test(html) && /data-conf="high"/.test(html), "status chip only; confidence kept in the data, off the card");
ok(/<span class=cr>Image: Some Channel<\/span><\/a>/.test(html) && /\.cr\{position:absolute;left:0;right:0;bottom:0/.test(launchesPage("K", "", { rows: [one] }, today)), "credit as small text on the picture's bottom edge");
ok((html.match(/class=nw>New</g) || []).length === 1, "gold New badge only for the launch first seen in the last 24 hours");
ok(/class=ib href="[^"]+" aria-label="Report as PDF"/.test(html) && /class="ib wa"[^>]+aria-label="Send on WhatsApp"/.test(html) && !/>PDF</.test(html), "3. PDF and WhatsApp as icon buttons");

// 5-7. the page
const many = Array.from({ length: 30 }, (_, i) => row({ project: "Project " + i, first_seen: i < 25 ? "2026-11-05" : "2026-09-01" })).concat([row({ project: "Portfolio Tower", launch: false })]);
const pg = launchesPage("K", "", { generated: today, rows: many }, today);
ok(/<p class=ld>New and registered launches &middot; prices as advertised<\/p>/.test(pg), "intro is one short line");
ok(/placeholder="Search project, developer or area"/.test(pg), "search placeholder");
ok(/<div class=fl><button type=button class=on data-f=week>This week<\/button><button type=button data-f=all>All<\/button><button type=button id=fo class=fo>.*?Filter<\/span><\/button><button type=button id=rs class=rs>Reset<\/button><\/div>/.test(pg), "6. one filter row: This week, All, Filter, Reset");
ok(/\.fl\{display:flex;gap:6px;margin:0 0 8px;flex-wrap:nowrap\}/.test(pg), "the filter row never wraps");
ok(/id=fs class=fs hidden/.test(pg) && /<input id=dv list=dvl/.test(pg) && /<select id=zn/.test(pg) && /data-s=new class=on>Newest/.test(pg) && /data-s=lo>Lowest price/.test(pg) && /data-s=hi>Highest price/.test(pg), "Filter sheet: developer, zone, sort");
ok(/id=rpo class=rpo>.*Make a report/.test(pg) && /<span id=cn class=cn>/.test(pg), "Make a report as a clear button on the count line");
ok(/lim=20/.test(pg) && /id=mo class=mo hidden>Show more/.test(pg) && /n\+" this week"/.test(pg), "7. first 20, Show more, count line");
ok(/data-l="0"/.test(pg) && /c\.getAttribute\("data-l"\)==="1"/.test(pg), "9. a portfolio row is off This week (kept for All)");
ok(/mk\("label","rk"\)/.test(pg) && /\.rk\{display:grid;grid-template-columns:40px minmax\(0,1fr\) auto 22px/.test(pg) && /mk\("span","rkv"/.test(pg) && !/\.rpk\{display:grid;grid-template-columns:repeat\(2/.test(pg), "2. report panel: a clean aligned list, tick on the right");
ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(pg) && /#FFFDF9/.test(pg), "light cream, icons not emojis");

// 9. the 05:00 feed never offers a portfolio row
const d = { transactions: { periodFrom: "2026-09-12", periodTo: "2026-11-06", medianResidentialAedSqft: 1650 }, areaIntel: { areas: [] } };
const fa = launchAngles({ rows: [row({ key: "ap_dddddddddddd", launch: false }), row({ key: "ap_eeeeeeeeeeee" })] }, d, [], today);
ok(fa.angles.length === 1 && fa.angles[0].fact === "launch:ap_eeeeeeeeeeee", "feed: launch:false rows are never a launch angle");

// 4. Quick task button
const qt = fs.readFileSync(new URL("../src/quick_task.js", import.meta.url), "utf8");
ok(/\/\^\\\/momo\\\/work\\\/launches\\\/\?\$\/\.test\(location\.pathname\)/.test(qt) && /width = "44px"/.test(qt), "smaller round button on the launches page");
ok(/translateY\(160px\)/.test(qt) && /addEventListener\("scroll"/.test(qt) && /passive: true/.test(qt), "hides while scrolling down, back on scroll up");
ok(!/`[^`]*`[^`]*`/.test(qt.split("String.raw`")[1].split("})();`")[0]), "no backticks inside the raw script");
console.log("v802 launches:", n, "checks passed");
