// v525 - by developer: everything a developer has on Property Finder, every area, as cards grouped by area and gold points on the map
// (Kendall 11 Oct 2026). Plus: the broker sheet's rent card for "3+" contracts says "3 bedrooms or more" (it said "4 bedrooms or more").
import fs from "node:fs";
import { rentFigures } from "../src/broker_building.js";
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } };
const dm = fs.readFileSync(new URL("../src/devmap_page.js", import.meta.url), "utf8");
const blk = dm.slice(dm.indexOf("// v525 BY DEVELOPER"), dm.indexOf("// v521 AVAILABLE ON PROPERTY FINDER"));

ok(/h\+='<div id=devpf data-k="'\+esc\(k\)\+'"><\/div>';setTimeout\(function\(\)\{devPfFill\(k\)\},0\);/.test(dm), "the developer profile carries the section, filled after it opens");
ok(dm.indexOf("<div id=devpf") < dm.indexOf("<div class=seg style=\"margin-top:10px\" id=useg>"), "it sits near the top of the profile, before the price unit switch");
ok(/var ix=ixOf\('all'\),pp=DM\.devProfile\(ix,k\),areas=\(pp\.priced\|\|\[\]\)\.concat\(pp\.thin\|\|\[\]\)/.test(blk) && /DM\.drillProjects\(ix,k,t,a\.slug\)/.test(blk), "every building of the developer, all years, every area it builds in");
ok(/it=\(w\.key&&by\[w\.key\]&&by\[w\.key\]\.f\?by\[w\.key\]:null\)\|\|byN\[w\.slug\+'\|'\+pdNk\(w\.name\)\]\|\|byN\[w\.slug\+'\|'\+pdNk\(base\)\];if\(!it\|\|!it\.f\|\|seen\[it\.k\]\)return;/.test(blk), "joined to the Property Finder index by register key, else by district and name (listings filed under a project key); each building once");
ok(/class="pfbtn pfdv" data-done=1 data-pfk="'\+esc\(x\.it\.k\)\+'" data-pfn="'\+esc\(x\.it\.n\)\+'"/.test(blk), "each building is a card that opens the same pop-up");
ok(/Show them on the map/.test(blk) && /map\.addLayer\(\{id:"devpf",type:"circle"/.test(blk) && /map\.on\("click","devpf",function\(e\)\{var f=e\.features&&e\.features\[0\];if\(f\)pfOpen\(f\.properties\.k,f\.properties\.n\)\}\)/.test(blk), "gold points on the map, sized by flats; tapping one opens the pop-up; a button frames them all");
ok(/function leaveProf\(\)\{devPfMap\(\[\]\);/.test(dm), "leaving the developer clears its points");
ok(/No Property Finder rental listings for its buildings today\./.test(blk), "a developer with none says so");
ok(!/vacan/i.test(blk), "listings, never vacancy");

// the rent label
const rows = [{ date: "2026-10-11", band: "3+", n: 9, med: 300000 }, { date: "2026-10-11", band: "2", n: 13, med: 225000 }];
const R = rentFigures(rows, { from: "0000-00-00", to: "9999-99-99" });
ok(R.bands.find((b) => b.band === "3+").label === "3 bedrooms or more", "'3+' contracts with no separate 3-bedroom band: '3 bedrooms or more'", R.bands);
const R2 = rentFigures(rows.concat([{ date: "2026-10-11", band: "3", n: 5, med: 280000 }]), { from: "0000-00-00", to: "9999-99-99" });
ok(R2.bands.find((b) => b.band === "3+").label === "4 bedrooms or more", "with a separate 3-bedroom band, '3+' still means 4 or more");

console.log(`v525 developer Property Finder: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
