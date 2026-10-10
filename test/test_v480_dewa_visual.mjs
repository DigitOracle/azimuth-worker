// v480 - the DEWA section as a picture: B busy (this complete year vs last), A timeline, C mix; no logo; the
// "connection is not a home" sentence kept; never an occupancy rate. Offline.
import { writeFileSync } from "node:fs";
import { dewaVisual } from "../src/building_page.js";
let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 400) : "")); } };
const o = { connections: 483, first: "2014-09", last: "2025-12", y2024: 81, y2025: 137, y2026: 40, residential: 471, commercial: 12 };
const h = dewaVisual(o, { withheld: 733, floor: 5 });
ok(/Is the building busy\?/.test(h) && />137<span>new connections in 2025/.test(h) && /Up from 81 in 2024 \(\+69%\)/.test(h), "B: 2025 against 2024, +69%");
ok(!/in 2026<\/span>/.test(h), "B never compares a part year");
ok(/When people moved in/.test(h) && (h.match(/class="dw-bar/g) || []).length === 3 && /Earlier years are not split out yet/.test(h), "A: the three years held, and says earlier years are not split yet");
ok(/What's in the building/.test(h) && /Homes 471/.test(h) && /Shops \/ offices 12/.test(h) && /not how full the building is/.test(h), "C: the mix, labelled as not occupancy");
ok(/A connection is not a home:/.test(h) && /733 of them/.test(h), "the not-a-home sentence and the withheld line survive");
ok(/Source: DEWA meter connections/.test(h) && !/<img/i.test(h) && !/[\u{1F300}-\u{1FAFF}⚡]/u.test(h), "a source line with an icon, no logo, no emoji");
ok(!/occupancy rate of|% occupied|vacan/i.test(h.replace(/give an occupancy rate/, "")), "no occupancy or vacancy figure");
const full = dewaVisual(Object.assign({}, o, { by_year: { "2014": 6, "2015": "<5", "2016": 20, "2024": 81, "2025": 137 } }), null);
ok((full.match(/class="dw-bar/g) || []).length === 5 && /2015: fewer than 5/.test(full) && !/not split out/.test(full), "with the yearly series: every year, small years shown as fewer than 5");
ok(dewaVisual({ connections: 7, first: "2020-01" }, null).indexOf("Is the building busy") < 0, "no year figures: no busy card, nothing invented");
writeFileSync(process.env.TEMP + "/dw_preview.html", '<!doctype html><meta charset=utf-8><body style="background:#141c19;color:#e8e2d4;font-family:system-ui;max-width:380px;padding:16px">' + h);
console.log("\n" + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
