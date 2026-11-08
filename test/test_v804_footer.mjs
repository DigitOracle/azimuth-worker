// v804: the launch report footer must sit below the content, never on top of it (Kendall 8 Nov, phone screenshot).
import { launchPage, REPORT_CSS } from "../src/launch_report.js";
import { writeFileSync } from "node:fs";
const r = { project: "Raw District 2, Tower C", developer: "Imtiaz", area: "Down Town Jabal Ali", registered: true, dld_project_number: "4555", zone: "Expo 2020 Centre", sources_n: 1, first_seen: "2026-11-07", links: ["https://www.youtube.com/watch?v=abcdefghijk"] };
const e = { source: "Video: Imtiaz Developments, YouTube", pin_basis: "area",
  near: [["Metro", "UAE Exchange", 2.8, "north-west"], ["Mall", "Badrah Pavalion", 5.4, "west"], ["Supermarket", "Spinneys", 4.9, "east"], ["School", "The International School of Choueifat", 6.3, "north-east"]].map(([lab, name, km, dir]) => ({ lab, name, km, dir })),
  marks: [{ name: "Burj Khalifa", km: 32.0, dir: "north-east" }, { name: "Airport (DXB)", km: 42.3, dir: "north-east" }] };
const html = "<!doctype html><meta charset=utf-8><style>" + REPORT_CSS + "</style>" + launchPage(r, e, 1, 2, "Test", "kendall");
writeFileSync(process.argv[2] || "v804_page.html", html);
// v807: the distance table (and its compass directions) was removed from the report
if (/\.ft\{position:absolute/.test(html)) throw new Error("footer still absolute");
console.log("v804 footer: html checks ok");
