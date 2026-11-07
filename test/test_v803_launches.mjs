// v803 (Kendall 7 Nov 2026, "yes do v803"): register names in proper case on the card, the report and the feed. The other v803 fix (no
// other brokers' branding on any picture: QR codes, phone numbers, agency names, heavy text) is in the 04:00 collector
// (naj-market-pulse launch_media.branding_reason, tests/test_launches_v803.py); the worker only ever shows those screened KV copies.
import assert from "node:assert/strict";
import fs from "node:fs";
import { niceName, tidyLaunches } from "../src/launch_report.js";
import { launchCards } from "../src/launches_card.js";
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };

eq(niceName("RAW DISTRICT 2 TOWER C BY IMTIAZ", "Imtiaz"), ["Raw District 2, Tower C", "Imtiaz"], "Kendall's example");
eq(niceName("THE VAULT BY IMTIAZ", null), ["The Vault", "Imtiaz"], "developer filled in from the BY when the row has none");
eq(niceName("HAUS 99 RESIDENCES", "Hausen"), ["Haus 99 Residences", "Hausen"], "title case");
eq(niceName("BINGHATTI DAWN JVC", "Binghatti"), ["Binghatti Dawn JVC", "Binghatti"], "JVC kept");
eq(niceName("THE PALM TOWER AT DIFC", "X")[0], "The Palm Tower at DIFC", "DIFC kept, small words lower");
eq(niceName("IZEL BY ZOYA", "Majid Al Futtaim")[0], "Izel by Zoya", "a BY naming someone else is kept");
eq(niceName("ALTA V1EW", "Object 1"), ["ALTA V1EW", "Object 1"], "brand styling left as written");
eq(niceName("X11", "Bamx")[0], "X11", "X11 left");
eq(niceName("DAMAC ISLANDS - THE TROPICS 1 & 3 & 5", "DAMAC")[0], "DAMAC Islands - The Tropics 1 & 3 & 5", "capital after a dash");
eq(niceName("Sur La Mer", "Meraas"), ["Sur La Mer", "Meraas"], "proper case untouched");

const snap = { generated: "2026-11-07", rows: [{ key: "ap_000000000001", project: "RAW DISTRICT 2 TOWER C BY IMTIAZ", developer: "Imtiaz", area: "Al Furjan", from_aed: 900000, first_seen: "2026-11-07", last_seen: "2026-11-07", registered: true }] };
const t = tidyLaunches(snap);
eq(t.rows[0].project, "Raw District 2, Tower C", "snapshot rows tidied");
ok(snap.rows[0].project === "RAW DISTRICT 2 TOWER C BY IMTIAZ", "the stored snapshot object is not changed");
ok(tidyLaunches(null) === null && tidyLaunches({}).rows === undefined, "no snapshot is fine");
const html = launchCards(t.rows, "2026-11-07", "");
ok(html.includes("Raw District 2, Tower C") && !html.includes("TOWER C BY"), "the card shows the proper name");

const card = fs.readFileSync(new URL("../src/launches_card.js", import.meta.url), "utf8");
const rep = fs.readFileSync(new URL("../src/launch_report.js", import.meta.url), "utf8");
const idx = fs.readFileSync(new URL("../src/index.js", import.meta.url), "latin1");
ok(/tidyLaunches\(await deps\.kv\(env, "launches"\)\)/.test(card), "card route tidies");
ok((rep.match(/tidyLaunches\(await deps\.kv\(env, "launches"\)\)/g) || []).length === 2, "both report routes tidy");
ok(/launchAngles\(tidyLaunches\(await briefKvJson\(env, "launches"\)\)/.test(idx), "05:00 feed tidies");
console.log("v803 launches:", n, "checks passed");
