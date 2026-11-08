// v805: the launches search shows a list of matches under the box, across ALL launches (Kendall 8 Nov, phone screenshots "Ema", "Sob").
// Writes the page for a browser check: node test/test_v805_search.mjs <launches.json> <out.html>
import { readFileSync, writeFileSync } from "node:fs";
import * as M from "../src/launches_card.js";
const [L, OUT] = process.argv.slice(2);
const snap = JSON.parse(readFileSync(L, "utf8"));
const fn = M.launchesPage || Object.values(M).find((f) => typeof f === "function" && /launchesPage/.test(f.name));
const html = fn("k", "", snap, "2026-11-08");
if (!/id=qsl/.test(html)) throw new Error("no suggestion list");
writeFileSync(OUT, "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width'><body>" + html + "</body>");
console.log("v805 search: page written");
