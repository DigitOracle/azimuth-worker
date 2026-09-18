// v178 — THE DUBAI 2040 URBAN MASTER PLAN IS THE SPINE OF HER MORNING (Kendall, 18 Sep 2026).
//
// Naj: the morning posts "are specific and they're numbers, but you're not telling a story of Dubai". Kendall: her
// trajectory "is always around the Dubai 2040 master plan", for three readers - someone moving here, someone investing,
// and her own standing as the broker who knows. The picker had been fed almost nothing but property statistics.
//
// Two kinds of check. The plan's figures are checked against what the OFFICIAL pages say, because she quotes them to
// clients - a remembered or rounded 2040 number is worse than none. And the prompt is checked by RUNNING the real
// morning tick in a dry run and capturing the request it sends to the writing model, not by grepping the source.
import worker from "../src/index.js";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("ok - " + m); } else { fail++; console.log("not ok - " + m); } };

// ------------------------------------------------------------------ the plan's figures, against the official pages
const a = src.indexOf("const DUBAI_2040 = {"), b = src.indexOf("const LENSES_2040");
ok(a > 0 && b > a, "the Dubai 2040 block exists");
const D40 = eval("(" + src.slice(a, b).replace(/^const DUBAI_2040 = /, "").replace(/;\s*\/\/[^\n]*\n?$/, "").trim().replace(/;$/, "") + ")");
const F = D40.facts;
ok(F.length >= 14, "it carries the plan's targets and progress: " + F.length + " facts");

// every figure below was read from the Dubai Media Office launch (13 Mar 2021), its progress update (4 Mar 2025) or the
// UAE Government portal on 18 Sep 2026. If a figure here is edited, this test should make someone go back to the source.
const OFFICIAL = {
  "3.3 million (2020) to 5.8 million (2040)": "population", "4.5 million (2020) to 7.8 million (2040)": "population",
  "400%": "beaches", "105%": "green", "60%": "nature", "134%": "tourism", "168 sq km": "economy", "25%": "education_health",
  "30 km, 14 stations, 9 residential areas": "metro", "6,500 km across 160 areas": "walk", "1.7 million visitors a year": "leisure",
};
for (const [fig, theme] of Object.entries(OFFICIAL)) ok(F.some((f) => f.figure === fig && f.theme === theme), "official figure present exactly: " + theme + " " + fig);

ok(F.every((f) => f.source && f.date && /^https:\/\/(www\.)?(mediaoffice\.ae|u\.ae)\//.test(f.url)), "every fact carries a source, a date and an OFFICIAL url");
ok(F.every((f) => ["target", "planned", "announced", "delivered", "fact"].includes(f.status)), "every fact says whether it is a target, planned, announced or delivered");
ok(F.filter((f) => ["population", "beaches", "green", "nature", "centres", "tourism", "economy", "education_health"].includes(f.theme)).every((f) => f.status === "target"),
   "every 2040 aim is marked target, so it can never be said as achieved");
ok(F.every((f) => ["move", "invest", "authority"].includes(f.reader)), "every fact names the reader it serves best");

const centres = F.find((f) => f.theme === "centres");
ok(centres && ["Deira and Bur Dubai", "Downtown and Business Bay", "Dubai Marina and JBR", "Expo 2020 Centre", "Dubai Silicon Oasis Centre"].every((n) => centres.says.includes(n)),
   "the five urban centres are named exactly as the UAE portal names them");

// what the official pages do NOT say must not be here, however often it is quoted elsewhere
const blob = JSON.stringify(D40);
ok(!/20.?minute/i.test(blob), "no '20-minute city' - the official page does not state it");
ok(!/800 ?m|within .{0,20}(station|transit)|% of residents/i.test(blob), "no transit-coverage target - the official page states none");
const metro = F.find((f) => f.theme === "metro");
ok(metro && !/(JVC|Mirdif|Silicon|International City|Academic|Creek|Festival)/.test(metro.says), "the Blue Line's nine areas are not named - the source does not name them");
ok(!/2029|opens? in|opening/i.test(metro ? metro.says : ""), "and no Blue Line opening date - the source gives none");

// ------------------------------------------------------------------ run the real tick, capture what it sends the model
const READ = "owner_admin_key_never_in_client_links_0001";
const requests = [];
globalThis.fetch = async (u, o) => {
  const url = String(u && u.url ? u.url : u);
  if (/anthropic/i.test(url)) {
    let body = {}; try { body = JSON.parse(String(o && o.body || "{}")); } catch (e) {}
    requests.push(body);
    const angles = ["move", "invest", "authority", "move", "invest"].map((r, i) => ({
      hook: "Hook " + (i + 1) + " with 6,500 km.", figure: "6,500 km", source: "Dubai Media Office, 4 Mar 2025", buyer: "b", family: "growth_plan", reader: r }));
    const isVoice = /rewrite social-post hooks/.test(JSON.stringify(body.system || ""));
    const text = isVoice ? JSON.stringify({ items: [] }) : JSON.stringify({ angles });
    return new Response(JSON.stringify({ content: [{ type: "text", text }], stop_reason: "end_turn" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
  return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
};
const store = new Map();
store.set("mkt_latest", JSON.stringify({ generatedAt: new Date().toISOString() }));
const KV = { async get(k, t) { if (!store.has(k)) return null; const v = store.get(k); return t === "json" ? JSON.parse(v) : v; },
  async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); }, async list() { return { keys: [], list_complete: true }; } };
const env = { MEETINGS: KV, READ_KEY: READ, MARKET_BRIEF: "on", ANTHROPIC_API_KEY: "test-only-not-a-key", PUBLIC_ORIGIN: "https://x" };

const res = await worker.fetch(new Request("https://x/feed_test?dry=1&key=" + READ), env, { waitUntil() {} });
const out = await res.text();
const pick = requests.find((r) => /You pick FIVE distinct/.test(JSON.stringify(r.system || "")));
ok(!!pick, "the dry run reached the writing model with the morning picker's prompt");
const sys = pick ? (typeof pick.system === "string" ? pick.system : JSON.stringify(pick.system)) : "";
const user = pick ? JSON.stringify(pick.messages || "") : "";

ok(/THE SPINE, AND IT FRAMES ALL FIVE/.test(sys) && sys.indexOf("THE SPINE") < sys.indexOf("HER DISPOSITION"), "the Dubai 2040 spine leads the prompt, ahead of everything else");
ok(/\(move\)[^]*\(invest\)[^]*\(authority\)/.test(sys), "it names all three readers: someone moving here, someone investing, and her authority");
ok(/the change \(what is coming, or what has just moved\) -> the figure that proves it -> what it means for the reader/.test(sys), "it sets the story shape: the change, the figure, what it means");
ok(/never an opening 'I feel'/.test(sys), "it overrides the feeling-first opening that produced five 'I feel' hooks");
ok(/is a TARGET and is said as one/.test(sys) && /planned and announced stay planned/.test(sys), "a target is said as a target, and planned stays planned");
ok(/never say which district it reaches/.test(sys), "the Blue Line is never tied to a district the source does not name");
ok(/never derive a new number from two of them/.test(sys), "no derived 2040 numbers (5.8 minus 3.3) presented as the plan's own");
ok(/never spelled out in words/.test(sys), "numbers stay numerals, to stop the scroll");
ok(/AT LEAST ONE of the five must come from the Dubai Land Department register/.test(sys), "the register stays a source, at one of five rather than two");
ok(/Dubai 2040|dubai2040|the Metro Blue Line|urban centres|family moving here|approved or delivered since 2021/.test(sys.match(/TODAY'S REQUIRED EMPHASES[^.]*\.[^.]*\./) ? sys.match(/TODAY'S REQUIRED EMPHASES[^.]*\.[^.]*\./)[0] : ""),
   "one of today's two required emphases is drawn from the plan");

let data = null; try { data = JSON.parse(pick.messages[0].content); } catch (e) {}   // parse it - a regex on JSON-inside-JSON trips on escaped quotes
ok(!!(data && data.dubai2040 && Array.isArray(data.dubai2040.facts) && data.dubai2040.facts.length >= 14 && JSON.stringify(data.dubai2040).includes("Expo 2020 Centre") && JSON.stringify(data.dubai2040).includes("5.8 million")),
   "the plan's facts are IN the data the model is given, as a field - not just described in the prompt");
ok(/"reader"/.test(JSON.stringify(pick ? pick : {})) || /reader =/.test(sys), "each angle is asked to name its reader");

const voice = requests.find((r) => /rewrite social-post hooks/.test(JSON.stringify(r.system || "")));
const vs = voice ? JSON.stringify(voice.system) : "";
ok(!voice || (/never spell a number in words/.test(vs) && /I feel/.test(vs)), "the voice rewrite is told to keep numerals and never template on 'I feel'");

ok(res.status === 200 && /growth_plan/.test(out), "the dry run returns the five, labelled by family: " + out.slice(0, 70).replace(/\n/g, " "));

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
