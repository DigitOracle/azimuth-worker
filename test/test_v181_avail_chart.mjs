// v181 — THE AVAILABILITY BAR CHART ON THE BOARD (Kendall, 18 Sep 2026: "build the availability bar chart").
//
// One bar per developer, HOMES ONLY, split by bedrooms. Shops, offices and type-level listings are stated beside the bar and
// never added to it: Binghatti's 475 is 63 homes and 412 shops and offices, and one bar of 475 beside Arada's 463 would tell
// her the two hold the same number of homes. Also: the strip stopped at six sheets, so the seventh developer never appeared.
// The fixtures are the SHAPES of the stored records (img_avail_index + img_drill_<d>.claimed.rooms), with the real counts.
import worker from "../src/index.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("ok - " + m); } else { fail++; console.log("not ok - " + m); } };
globalThis.fetch = async () => new Response("{}", { status: 200 });

const idx = { updated: "2026-09-18", sheets: [
  { sheet: "Arada 2026-09-17", note: "463 units · 16 projects", mapped: true, d: "arada" },
  { sheet: "Beyond 2026-09-17", note: "171 units · 11 projects", mapped: true, d: "beyond" },
  { sheet: "Binghatti 2026-09-08", note: "475 units · 31 projects", mapped: true, d: "binghatti" },
  { sheet: "Fakhruddin 2026-09-11", note: "57 units · 5 projects · +463 in 1 type-level", mapped: true, d: "fakhruddin" },
  { sheet: "Imtiaz 2026-09-17", note: "114 units · 10 projects", mapped: true, d: "imtiaz" },
  { sheet: "Prestige One 2026-09-15", note: "43 units · 1 projects", mapped: true, d: "prestigeone" },
  { sheet: "Select 2026-09-17", note: "74 units · 2 projects", mapped: true, d: "select" }] };
const R = (r, n) => ({ r, n, from: 1 });
const rooms = {
  arada: [R("3 B/R", 91), R("2 B/R", 220), R("4 B/R", 77), R("1 B/R", 45), R("5 B/R", 24), R("6 B/R", 1), R(null, 5)],
  beyond: [R("2 B/R", 99), R("3 B/R", 35), R("1 B/R", 35), R("6 B/R", 1), R("4 B/R", 1)],
  binghatti: [R("Studio", 2), R("1 B/R", 16), R("3 B/R", 37), R("2 B/R", 8), R("Retail", 209), R("Office", 203)],
  fakhruddin: [R("1 B/R", 27), R("3 B/R", 5), R("Retail", 3), R("Duplex", 3), R("4 B/R Penthouse", 2), R("2 B/R", 17)],
  imtiaz: [R("2 B/R", 26), R("4 B/R Duplex", 1), R("Office", 14), R("Retail", 2), R("1 B/R", 49), R("3 B/R", 13), R("3 B/R Duplex", 1), R("Studio", 8)],
  prestigeone: [R("2 B/R", 22), R("1 B/R", 20), R("3 B/R", 1)],
  select: [R("1 B/R", 13), R("2 B/R", 46), R("3 B/R", 12), R("4 B/R", 3)] };
const store = new Map([["img_avail_index", JSON.stringify(idx)]]);
for (const d in rooms) store.set("img_drill_" + d, JSON.stringify({ title: d, claimed: { as_of: "2026-09-17", rooms: rooms[d] } }));
const KV = { async get(k) { return store.has(k) ? store.get(k) : null; }, async put() {}, async delete() {}, async list() { return { keys: [], list_complete: true }; } };
const READ = "owner_admin_key_never_in_client_links_0001";
const h = await (await worker.fetch(new Request("https://x/board?key=" + READ), { MEETINGS: KV, READ_KEY: READ }, { waitUntil() {} })).text();
const i = h.indexOf("Developer availability");
const sec = h.slice(h.lastIndexOf("<section>", i), h.indexOf("</section>", i));
const row = (name) => { const a = sec.indexOf("<span class=avn>" + name); return a < 0 ? "" : sec.slice(a, sec.indexOf("</a>", a)); };
const total = (name) => { const m = row(name).match(/<b>(\d+)<\/b>/); return m ? +m[1] : null; };

ok(["Arada", "Beyond", "Binghatti", "Fakhruddin", "Imtiaz", "Prestige One", "Select"].every((n) => row(n)), "all SEVEN developers are on the chart - the old strip stopped at six and Select never showed");
ok(total("Binghatti") === 63, "Binghatti's bar is its 63 HOMES, not its 475 units: " + total("Binghatti"));
ok(/\+412 shops &amp; offices/.test(row("Binghatti")), "and its 412 shops and offices are stated beside the bar");
ok(total("Imtiaz") === 98 && /\+16 shops/.test(row("Imtiaz")), "Imtiaz: 98 homes, 16 commercial beside");
ok(total("Fakhruddin") === 54 && /\+463 listed by type only/.test(row("Fakhruddin")), "Fakhruddin: 54 unit-level homes; the 463 type-level units are named, not added");
ok(total("Arada") === 463 && /Arada · 102 4\+ beds/.test(row("Arada")), "Arada: 463, with 4, 5 and 6 bedrooms together as 4+ (77+24+1 = 102)");
ok(/Arada · 5 type not stated/.test(row("Arada")), "a row with no bedroom count is shown as 'type not stated', not dropped and not guessed");
const order = [...sec.matchAll(/<span class=avn>([^<]+)</g)].map((m) => m[1]);
ok(order.join(",") === "Arada,Beyond,Imtiaz,Select,Binghatti,Fakhruddin,Prestige One", "sorted by homes, largest first: " + order.join(", "));
ok(/966 homes/.test(sec) && /431 shops and offices/.test(sec), "the header counts homes (966), and the footer names what is left out (431 commercial)");
const w = (name) => { const m = row(name).match(/class=avt style="width:calc\(\(100% - 44px\) \* ([\d.]+)\)"/); return m ? +m[1] : null; };
ok(w("Arada") === 1 && Math.abs(w("Prestige One") - 43 / 463) < 0.001, "one scale for every bar: Prestige One's track is 43/463 of Arada's");

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
