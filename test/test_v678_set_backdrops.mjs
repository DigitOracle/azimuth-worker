// v678 (Kendall, 31 Oct 2026): "Picture with you" on the Beyond-property and Emotional-intelligence lists goes through the same chain as the
// real-estate list (backdrop, light, her photo, preview, Make it), with TEN backdrops of that list's own; her own scene is a typed line.
//   B  three catalogues of ten, ids unique, every scene has a place and a pose, X kept for the typed-line path but never a row
//   E  the EI catalogue is not the property one (zen garden, workshop room ... no skyline, no lobby)
//   N  set ideas live at 11-15 / 21-25: setAngleByN reads the right ctx and labels the masthead with the list's name
//   P  the button grammar: pick/pic/card, pal/cpal
//   V  the EI list text explains the ▶ link
import { backdropsFor, backdropRows, propertyBackdrops, generalBackdrops, eiBackdrops, BACKDROP_OWN_LINE } from "../src/backdrops.js";
import { setOffset, setAngleByN, parseSetButton, setText, FEED_SETS } from "../src/feed_sets.js";
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL " + m + (x ? "\n       " + x : "")); } };
// B
for (const [id, cat] of [["property", propertyBackdrops("Marina")], ["general", generalBackdrops()], ["ei", eiBackdrops()]]) {
  const scenes = cat.filter((o) => !o.own), ids = new Set(scenes.map((o) => o.id));
  ok(scenes.length === 10 && ids.size === 10, id + ": ten scenes with unique ids (" + scenes.length + ")");
  ok(scenes.every((o) => o.place.length > 40 && o.pose && o.name && o.note), id + ": every scene has a place, a pose, a name and a note");
  ok(cat.some((o) => o.own && o.id === "X"), id + ": X kept for the typed-line path");
  const rows = backdropRows(21, backdropsFor(id, {}, "Marina", true));
  ok(rows.length === 10 && rows.every((r) => !/:X$/.test(r.id)) && rows[0].id === "fbg:21:A", id + ": ten rows, no X row, ids fbg:<n>:<id>");
  ok(backdropsFor(id, {}, "", false).every((o) => !o.own), id + ": automatic picks never see the own option");
}
ok(/type your own scene/i.test(BACKDROP_OWN_LINE), "the list body tells her to type her own scene");
// E
const ei = eiBackdrops().map((o) => o.name.toLowerCase()).join(" | "), prop = propertyBackdrops("").map((o) => o.name.toLowerCase()).join(" | ");
ok(/zen garden/.test(ei) && /workshop/.test(ei) && /desert sunrise/.test(ei) && !/skyline|lobby|pool deck/.test(ei), "EI backdrops are EI scenes, not property scenes", ei);
ok(/skyline|lobby/.test(prop) && /metro platform/.test(prop) && /show apartment/.test(prop), "property keeps its scenes and gains two", prop);
ok(/creek|metro carriage|newsroom/.test(generalBackdrops().map((o) => o.name.toLowerCase()).join(" | ")), "general backdrops are news scenes");
ok(propertyBackdrops("Al Furjan").find((o) => o.id === "G").place.includes("Al Furjan"), "property scenes carry the area");
// N
const m = new Map(); const env = { MEETINGS: { get: async (k) => (m.has(k) ? m.get(k) : null) } };
m.set("mkt_briefctx_ei", JSON.stringify({ at: 5, angles: [{ hook: "e1" }, { hook: "e2" }, { hook: "e3" }] }));
m.set("mkt_briefctx_general", JSON.stringify({ at: 6, angles: [{ hook: "g1" }] }));
ok(setOffset("ei") === 20 && setOffset("general") === 10 && setOffset("property") === 0, "offsets 20 / 10 / 0");
const r = await setAngleByN(env, 23);
ok(r && r.angle.hook === "e3" && r.label === FEED_SETS.ei.name && r.setId === "ei" && r.at === 5, "23 = EI idea 3, labelled with the list's name");
ok((await setAngleByN(env, 11)).angle.hook === "g1" && (await setAngleByN(env, 12)) === null && (await setAngleByN(env, 3)) === null && (await setAngleByN(env, 24)) === null, "11 = general idea 1; a missing idea or a real-estate n is null");
// P
ok(parseSetButton("fs:e:card:4").act === "card" && parseSetButton("fs:e:cpal:4:ei").act === "cpal" && parseSetButton("fs:g:pal:2:usual").act === "pal" && parseSetButton("fs:g:pal:2:usual").pid === "usual", "button grammar: card, cpal, pal");
ok(parseSetButton("fs:e:xpal:4:ei") === null && parseSetButton("fs:e:pal:4:neon") === null, "unknown acts and palettes are refused");
// V
const txt = setText(FEED_SETS.ei, [{ hook: "h", figure: "Empathy", source: "s", lane: "selling", video: { url: "https://youtu.be/x" } }]);
ok(/▶ https:\/\/youtu\.be\/x/.test(txt) && /▶ is a short explainer to watch first, nothing to script/.test(txt), "the EI list explains the ▶ link");
ok(!/explainer to watch/.test(setText(FEED_SETS.ei, [{ hook: "h", figure: "Empathy", source: "s", lane: "selling" }])), "no ▶ line when no idea carries a video");
console.log(pass + " passed, " + fail + " failed"); if (fail) process.exit(1);
