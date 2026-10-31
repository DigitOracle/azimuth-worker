// v677 - three sets a morning (real estate, Beyond property, Emotional intelligence), named palettes, "feed" any time (Kendall 30 Oct 2026)
import { FEED_PALETTES, PALETTE_KEYS, FEED_SETS, setByTag, paletteFor, paletteRows, generalItems, GENERAL_DROP_RX, EI_CORE, eiDna, eiMaterial,
  generalPrompt, eiPrompt, validateGeneral, validateEi, setText, setRows, parseSetButton, buildExtraSets, flushExtraSets, resendSetLists, handleSetButton } from "../src/feed_sets.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL " + m); } };
const kvStore = () => { const m = new Map(); return { m, MEETINGS: { get: async (k) => (m.has(k) ? m.get(k) : null), put: async (k, v) => { m.set(k, v); }, delete: async (k) => { m.delete(k); } } }; };

// palettes
for (const id of ["property", "general", "ei"]) ok(PALETTE_KEYS.every((k) => /^#[0-9A-F]{6}$/i.test(FEED_PALETTES[id][k])), id + " palette has all nine colours");
ok(FEED_PALETTES.property.green === "#003C1E" && FEED_PALETTES.property.gold === "#A88448", "real estate = the Digest as she locked it (CARD_C)");
{ const s = kvStore(); s.m.set("style_palette_ei", JSON.stringify({ gold: "#123456", bad: "red", green: "nope" }));
  const p = await paletteFor({ MEETINGS: s.MEETINGS }, { stylePalette: async () => ({ gold: "#ABCDEF" }) }, "ei");
  ok(p.id === "ei" && p.colours.gold === "#123456" && p.colours.green === FEED_PALETTES.ei.green, "KV style_palette_ei overrides a named palette, bad values ignored");
  const u = await paletteFor({ MEETINGS: s.MEETINGS }, { stylePalette: async () => ({ gold: "#ABCDEF" }) }, "usual");
  ok(u.id === "usual" && u.colours.gold === "#ABCDEF" && u.colours.green === "#003C1E", "usual = style_palette over the built-in, as today");
  ok((await paletteFor({ MEETINGS: s.MEETINGS }, {}, "neon")) === null, "unknown palette refused"); }
const rows = paletteRows("fs:e:pal:3", "ei");
ok(rows.length === 4 && rows[2].id === "fs:e:pal:3:ei" && /^★ /.test(rows[2].title) && rows[3].id === "fs:e:pal:3:usual" && rows.every((r) => r.title.length <= 24), "palette list: 3 named + usual, the set's own starred, titles fit WhatsApp");

// Beyond property: the material
const now = Date.parse("2026-10-30T04:00:00Z"), gstDay = { fmt: (ms) => "30 Oct 2026", isToday: (ms) => true };
const propRx = /\b(propert(?:y|ies)|real estate|rents?|apartments?)\b/i;
const parsed = [
  { title: "Etihad Rail opens passenger line with 11 stations", summary: "Abu Dhabi to Dubai in 57 minutes", outlet: "Khaleej Times", url: "u1", published: now - 3600e3 },
  { title: "Dubai property prices rise again", summary: "apartments up", outlet: "Gulf News", url: "u2", published: now - 3600e3 },
  { title: "Man arrested after Marina incident", summary: "", outlet: "Gulf News", url: "u3", published: now - 3600e3 },
  { title: "ETIHAD RAIL opens passenger line with 11 stations!", summary: "dup", outlet: "The National", url: "u4", published: now - 7200e3 },
  { title: "Old story", summary: "", outlet: "BBC News", url: "u5", published: now - 60 * 3600e3 },
  { title: "Dubai Marathon registrations hit 40,000", summary: "", outlet: "Gulf News", url: "u6", published: now - 1800e3 }];
const items = generalItems(parsed, now, propRx, gstDay);
ok(items.length === 2 && items[0].title.startsWith("Dubai Marathon") && items[1].outlet === "Khaleej Times", "general: property, crime, duplicates and old stories are out; newest first (got " + items.length + ")");
ok(GENERAL_DROP_RX.test("Gaza ceasefire talks") && !GENERAL_DROP_RX.test("Dubai Marathon") && !GENERAL_DROP_RX.test("first 22C morning"), "drop rule: war and crime out, sport and weather in");
ok(/not property/.test(generalPrompt("", [])) && /copied exactly/.test(generalPrompt("", [])), "general prompt: not property, numbers copied from the story");
const vg = validateGeneral([
  { hook: "Etihad Rail opens with 11 stations. 57 minutes changes what commute means.", figure: "11 stations", source: "reported by Khaleej Times, 30 Oct 2026", buyer: "x", lane: "transport", ref: "1" },
  { hook: "Abu Dhabi to Dubai in 45 minutes.", figure: "45 minutes", source: "reported by Khaleej Times, 30 Oct 2026", buyer: "x", lane: "transport", ref: "1" },
  { hook: "40,000 runners.", figure: "40,000 runners", source: "reported by Gulf News, 30 Oct 2026", buyer: "x", lane: "culture", ref: "0" },
  { hook: "Marathon.", figure: "x", source: "reported by BBC News", buyer: "x", lane: "culture", ref: "0" },
  { hook: "Nothing", figure: "x", source: "s", buyer: "x", lane: "city", ref: "9" }], items);
ok(vg.length === 2 && vg[0].url === "u1" && vg[1].figure === "40,000 runners", "general validation: a number not in the story, a wrong outlet, a repeat and a bad ref are dropped (got " + vg.length + ")");

// Emotional intelligence: the DNA and the checks
ok(EI_CORE.lanes.length === 5 && EI_CORE.lanes.map((l) => l.id).join() === "workplace,selling,everyday,self,leadership", "core DNA: the five lanes in order");
ok(EI_CORE.lanes[1].recode_link && /Recode/.test(EI_CORE.lanes[1].recode_link) && /state no Recode facts/i.test(EI_CORE.lanes[1].recode_link), "selling lane carries the Recode theme and the no-facts rule");
ok(EI_CORE.claims_to_avoid.some((c) => /twice as much/.test(c)) && EI_CORE.claims_to_avoid.some((c) => /58%/.test(c)), "claims to avoid: EQ twice IQ, the 58% figure");
{ const s = kvStore(); ok((await eiDna({ MEETINGS: s.MEETINGS })) === EI_CORE, "no mkt_dna_ei: the core stands in");
  s.m.set("mkt_dna_ei", JSON.stringify({ lanes: [1, 2, 3, 4, 5].map((i) => ({ id: "l" + i, concepts: ["c"] })), concepts: [{ id: "c", name: "C", plain_definition: "d", evidence: ["s1"] }], sources: [{ id: "s1", citation: "Someone, 2020" }], claims_to_avoid: [{ claim: "x" }], version: "v1" }));
  const d = await eiDna({ MEETINGS: s.MEETINGS }); ok(d.version === "v1", "a loaded DNA wins");
  const m = eiMaterial(d, 3); ok(m.lanes.length === 5 && m.lanes[0].concepts[0].source === "Someone, 2020" && m.claims_to_avoid[0] === "x", "material: citation from the sources list, claims flattened"); }
const mat = eiMaterial(EI_CORE, 0), mat2 = eiMaterial(EI_CORE, 1);
ok(mat.lanes[0].concepts[0].id !== mat2.lanes[0].concepts[0].id, "the concepts rotate with the day");
ok(/Recode/.test(eiPrompt("", [])) && /never invents a statistic/.test(eiPrompt("", [])), "EI prompt: Recode theme, no statistics");
const ve = validateEi([
  { hook: "Name the feeling in one word before you answer.", figure: "Self-awareness", source: "x", buyer: "Notice the body first.", lane: "workplace", ref: mat.lanes[0].concepts[0].id },
  { hook: "Studies show 90% of top performers have high EQ.", figure: "EQ", source: "x", buyer: "x", lane: "selling", ref: mat.lanes[1].concepts[0].id },
  { hook: "Another workplace one.", figure: "x", source: "x", buyer: "x", lane: "workplace", ref: mat.lanes[0].concepts[1].id },
  { hook: "Breathe through the gap.", figure: "The amygdala hijack", source: "x", buyer: "x", lane: "everyday", ref: "amygdala_hijack" },
  { hook: "Nope", figure: "x", source: "x", buyer: "x", lane: "self", ref: "made_up" }], mat);
ok(ve.length === 2 && ve[0].source === mat.lanes[0].concepts[0].source && ve[1].concept === "amygdala_hijack", "EI validation: an invented 90%, a second angle in a lane and an unknown concept are dropped; the source is the DNA's (got " + ve.length + ")");

// text, rows, buttons
const set = FEED_SETS.ei, angs = ve.concat([{ hook: "h3", figure: "f3", source: "s3", buyer: "b", lane: "self", video: { url: "https://youtu.be/x" } }]);
const txt = setText(set, angs);
ok(txt.startsWith(set.header) && /▶ https:\/\/youtu\.be\/x/.test(txt) && /type \*feed\* any time today/.test(txt), "set text: header, the video link, the 'feed any time' line");
const r = setRows(set, angs); ok(r.length === 3 && r[0].id === "fs:e:pick:1" && r.every((x) => x.title.length <= 24), "rows: fs:e:pick:N, titles fit");
ok(setByTag("g") === FEED_SETS.general && setByTag("x") === null, "tags");
ok(parseSetButton("fs:g:pick:4").n === 4 && parseSetButton("fs:e:again").act === "again" && parseSetButton("fs:e:fmt:ig:2").kind === "ig" && parseSetButton("fs:e:pal:2:usual").pid === "usual" && parseSetButton("fs:e:pal:2:usual").n === 2 && parseSetButton("fs:e:pal:2:neon") === null && parseSetButton("fs:e:pal:usual:2") === null && parseSetButton("feed:3") === null && parseSetButton("fs:e:fmt:vid:2") === null, "button grammar");

// the flow with mocked deps
{ const s = kvStore(), sent = [], lists = [], imgs = [], renders = [];
  const deps = { waSend: async (e, to, t) => { sent.push(t); return { ok: true }; }, waSendList: async (e, to, body, lbl, rows) => { lists.push({ body, rows }); return { ok: true }; }, waSendImage: async (e, to, u, cap) => { imgs.push(cap); return { ok: true }; },
    claudeText: async () => "DRAFT TEXT", claudeJSON: async () => null, renderAngleCard: async (e, a, n, o, at, by, size, opts) => { renders.push({ size, opts, a }); return { url: "https://x/" + size, key: opts.key }; },
    pubOrigin: (o) => o, ownerWindowOpen: async () => true, dnaSignal: async () => {}, gcTellOwner: async () => {}, gstDateStr: (d) => d.toISOString().slice(0, 10), stylePalette: async () => ({}), voice: "", model: "m" };
  const env = { MEETINGS: s.MEETINGS, WA_ALLOWED: "971" };
  s.m.set("mkt_briefctx_ei", JSON.stringify({ at: 123, date: "2026-10-30", set: "ei", angles: angs }));
  ok(await handleSetButton(env, deps, "971", "fs:e:pick:3", "https://o") === true && /Good pick/.test(sent[0]) && /youtu\.be\/x/.test(sent[0]) && lists[0].rows.length === 5 && lists[0].rows[3].id === "fs:e:pic:3", "pick: the video link, the format list with Picture with you");
  ok(JSON.parse(s.m.get("mkt_picks"))[0].set === "ei", "the pick is recorded with its set");
  await handleSetButton(env, deps, "971", "fs:e:fmt:li:3", "https://o");
  ok(sent[1] === "DRAFT TEXT" && lists[1].rows.length === 5 && lists[1].rows[2].id === "fs:e:pal:3:ei", "format: the draft, then the palette question");
  await handleSetButton(env, deps, "971", "fs:e:pal:3:general", "https://o");
  ok(renders.length === 2 && renders[0].opts.palette.green === FEED_PALETTES.general.green && renders[0].opts.key === "fs_ei_123_3_general" && renders[0].opts.palId === "general" && imgs.length === 2 && /Beyond property palette/.test(imgs[0]) && /1080×1920/.test(imgs[1]), "palette: both sizes drawn in the chosen palette, keyed by palette");
  ok(await handleSetButton(env, deps, "971", "feed:3", "https://o") === false, "a real-estate tap is not ours");
  ok((await resendSetLists(env, deps, "971", "2026-10-30")) === 1 && lists[lists.length - 1].rows[0].id === "fs:e:pick:1", "feed later in the day: the EI list again (general has none)");
  ok((await resendSetLists(env, deps, "971", "2026-10-31")) === 0, "yesterday's list is not re-sent as today's");
  // held when the window is shut, flushed later
  const lists0 = lists.length; deps.ownerWindowOpen = async () => false;
  deps.claudeJSON = async (e, sys, user) => (/EMOTIONAL INTELLIGENCE/.test(sys) ? { angles: eiMaterial(EI_CORE, Math.floor(now / 86400000)).lanes.map((l) => ({ hook: "h " + l.id, figure: l.concepts[0].name, source: l.concepts[0].source, buyer: "b", lane: l.id, ref: l.concepts[0].id })) } : null);
  deps.fetchT = async () => ({ ok: false }); deps.parseNewsFeed = () => []; deps.propRx = propRx; deps.gstDay = gstDay;
  const note = await buildExtraSets(env, deps, { nowMs: now });
  ok(note.some((x) => /general: only 0/.test(x)) && note.some((x) => x === "ei: held") && s.m.has("fs_pending_ei") && lists.length === lists0, "window shut: EI built and held, general had no stories, nothing sent");
  { const p = JSON.parse(s.m.get("fs_pending_ei")); p.at = Date.now(); s.m.set("fs_pending_ei", JSON.stringify(p)); }   // the held set carries the fixed test clock; flush drops anything older than 20 h by the real clock, so this failed the morning after it was written
  deps.ownerWindowOpen = async () => true; await flushExtraSets(env, deps);
  ok(!s.m.has("fs_pending_ei") && lists.length === lists0 + 1 && lists[lists.length - 1].rows.length === 5 && JSON.parse(s.m.get("fs_hist_ei")).length === 5, "flush: the held EI set goes out, history kept");
  ok(JSON.parse(s.m.get("mkt_briefctx_ei")).angles.every((a) => !/\d/.test(a.hook)), "no digits in the EI hooks"); }

// the designer PDF carries all three sets (feed_pdf: lane -> designer notes, 15 cap, the cover says the mix)
{ const { feedPdfHtml } = await import("../src/feed_pdf.js");
  const five = [1, 2, 3, 4, 5].map((i) => ({ hook: "re " + i, figure: "AED " + i, source: "DLD", buyer: "b", family: "prices" }));
  const gen = [1, 2, 3, 4, 5].map((i) => ({ hook: "gen " + i, figure: String(i), source: "KT", buyer: "b", family: "transport", set: "general" }));
  const ei = [1, 2, 3, 4, 5].map((i) => ({ hook: "ei " + i, figure: "Empathy", source: "Goleman", buyer: "b", family: "selling", set: "ei" }));
  const h = feedPdfHtml(five.concat(gen, ei, [{ hook: "sixteenth", figure: "x", family: "prices" }]), "30 Oct 2026");
  ok((h.match(/class=card>/g) || []).length === 15 && !/sixteenth/.test(h), "PDF: 15 cards, the sixteenth is cut");
  ok(/5 real estate &middot; 5 beyond property &middot; 5 emotional intelligence/.test(h), "PDF cover says the mix");
  ok(/Beyond property: transport/.test(h) && /Emotional intelligence: selling/.test(h) && /Two chairs facing each other/.test(h), "PDF: lanes get their own designer notes");
  ok(/5 ideas from this morning/.test(feedPdfHtml(five, "x")), "PDF: a plain five reads as before"); }

console.log("v677 feed sets: " + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
