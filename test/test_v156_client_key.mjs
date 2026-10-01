// v155 (DA-AUD-005, 15 Sep 2026) - two keys, offline. A link a client can be sent carries CLIENT_KEY; READ_KEY stays with the owner and the
// machines. Every route is read out of src/index.js itself, so a route added later is covered without touching this file: a client key must
// get nothing on it that a request with no key would not get, unless it is one of the app pages, and nothing may be sent or written for it.
// Through the real worker with KV and fetch stubbed; nothing leaves this machine.
import worker from "../src/index.js";
import fs from "node:fs";

const READ = "owner_admin_key_never_in_client_links_0001";
const CLIENT = "client_key_current_abcdefghij";
const LEGACY = "legacy_value_in_links_already_sent";
const RES = "residents_private_key_0123456789abcdef";
const HER = "971565484397";

const store = new Map();
let writes = [];
const KV = {
  async get(k, t) { if (!store.has(k)) return null; const v = store.get(k); if (t === "json") { try { return JSON.parse(v); } catch (e) { return null; } } return v; },
  async put(k, v) { writes.push(k); store.set(k, v); },
  async delete(k) { writes.push("-" + k); store.delete(k); },
  async list(o) { const p = (o && o.prefix) || ""; return { keys: [...store.keys()].filter((k) => k.startsWith(p)).map((name) => ({ name })), list_complete: true }; },
};
let outbound = [];
globalThis.fetch = async (input, init) => {
  const u = String((input && input.url) || input);
  outbound.push({ u, body: init && typeof init.body === "string" ? init.body : "" });
  if (u.includes("graph.facebook.com")) return new Response(JSON.stringify({ messages: [{ id: "wamid.out" + outbound.length }] }), { status: 200 });
  return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
};
const env = { MEETINGS: KV, READ_KEY: READ, CLIENT_KEY: CLIENT + ", " + LEGACY, RESIDENTS_KEY: RES, INGEST_TOKEN: "ING", WA_FORWARD_TOKEN: "FWD",
  WA_ALLOWED: HER, WHATSAPP_TOKEN: "t", WA_PHONE_ID: "p", MAILBOXES: "", ADD_TO: "", IG_APP_ID: "1", GMEET: "consent", GOOGLE_OAUTH_CLIENT_ID: "g",
  PUBLIC_ORIGIN: "https://azimuth-2.digitalchemy.workers.dev" };
const ctx = { waitUntil() {} };
const ORIGIN = "https://azimuth-2.digitalchemy.workers.dev";
const call = async (path, init, e) => {
  let timer;
  try {
    return await Promise.race([worker.fetch(new Request(ORIGIN + path, init), e || env, ctx), new Promise((r) => { timer = setTimeout(() => r({ status: "timeout" }), 5000); })]);
  } catch (err) { return { status: "threw: " + String((err && err.message) || err).slice(0, 80) }; } finally { clearTimeout(timer); }
};
const withKey = (p, k) => p + (p.includes("?") ? "&" : "?") + "key=" + encodeURIComponent(k);
const bodyOf = async (r) => (r && typeof r.text === "function" ? await r.text() : "");
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m); } };

// The app pages a client may open - stated here on purpose, apart from CLIENT_PATHS in the worker, so widening the client surface takes two edits.
const APP_PAGES = ["/start", "/brief_blocks", "/brief_pdf", "/blocks", "/brief_api", "/brief", "/more", "/find", "/home", "/dev", "/compare", "/cards", "/avail", "/market", "/skyline", "/view", "/map", "/plans", "/versus", "/charts", "/clock", "/esri_token", "/iso", "/walk_status"];
// v187 put the building page on the client surface but never widened it here, so the sweep counted /building/ an escalation.
const APP_PREFIXES = ["/skyline/", "/area/", "/report/", "/building/"];
const isAppPage = (p) => APP_PAGES.includes(p.split("?")[0]) || APP_PREFIXES.some((x) => p.indexOf(x) === 0);
// Services a client key must never make the worker call: WhatsApp, Microsoft mail, Google, Instagram/LinkedIn, the language models, Mistral.
const PRIVATE_SERVICES = /graph\.facebook\.com|graph\.microsoft\.com|login\.microsoftonline|googleapis\.com|instagram\.com|linkedin\.com|api\.anthropic\.com|api\.openai\.com|api\.mistral\.ai|api\.telegram\.org/;

// fixtures: one meeting, one to-do, her last message, one developer, one drill, the private residents data
store.set("evt_1757900000000_a", JSON.stringify({ summary: "Viewing with a private client", start_iso: "2026-09-16T10:00:00Z" }));
store.set("act_x1", JSON.stringify({ title: "Call the bank about the mortgage", src: { type: "whatsapp" } }));
store.set("img_board_devs", JSON.stringify({ developers: [{ key: "imtiaz", name: "Imtiaz", segment_label: "Boutique", icon: "", ours: [] }] }));
store.set("img_drill_imtiaz", JSON.stringify({ title: "Imtiaz (all projects)", district: "Business Bay", rooms: [{ r: "1 B/R", n: 5, med: 1000000, psm: 20000 }], latest: [] }));
store.set("priv_community_resident_mix", JSON.stringify({ communities: [{ comm: "126", name: "ABU HAIL", mix: [["India", 21]] }], names: {}, outlines: {} }));

// 1. every route in the source, every method: a client key gets no more than no key at all, except on the app pages
// v157 - read EVERY src/*.js, not just index.js. The moment routes moved into a module (sheets.js)
// they left this net silently, which defeats the whole point of discovering routes instead of listing them.
const _srcDir = new URL("../src/", import.meta.url);
const src = fs.readdirSync(_srcDir).filter((f) => f.endsWith(".js")).sort()
  .map((f) => fs.readFileSync(new URL(f, _srcDir), "utf8")).join("\n");
const exact = new Set(["/", "/no_such_route"]), prefixes = new Set();
for (const m of src.matchAll(/(?:url\.pathname|\bp)\s*===\s*"(\/[A-Za-z0-9_\-./]*)"/g)) exact.add(m[1]);
for (const m of src.matchAll(/(?:url\.pathname|\bp)\.(?:indexOf|startsWith)\("(\/[A-Za-z0-9_\-./]*)"\)/g)) prefixes.add(m[1]);
const SAMPLE = { "/skyline/": "/skyline/jltnorth", "/area/": "/area/Business%20Bay", "/report/": "/report/businessbay", "/r/": "/r/0123456789abcdef01234567", "/avail": "/avail?d=imtiaz", "/building/": "/building/businessbay/0" };
const routes = [...new Set([...exact].map((p) => SAMPLE[p] || p).concat([...prefixes].map((p) => SAMPLE[p] || p + "sample")))].sort();
ok(routes.length > 120 && routes.includes("/board") && routes.includes("/announce") && routes.includes("/gdrive/put_text") && routes.includes("/ig_status") && routes.includes("/gcal/status"),
  "routes found in the source: " + routes.length + " (including /board, /announce, /gdrive/put_text, /ig_status, /gcal/status)");

const escalations = [], leaks = [], appShut = [], appOpen = [];
let checked = 0;
for (const p of routes) {
  for (const method of ["GET", "POST", "PUT"]) {
    const init = method === "GET" ? { method } : { method, body: "{}", headers: { "Content-Type": "application/json" } };
    const anon = await call(p, init);
    writes = []; outbound = [];
    const cli = await call(withKey(p, CLIENT), init);
    const cliWrites = writes.slice(), cliOut = outbound.slice();
    checked++;
    if (isAppPage(p) && method === "GET") {
      if (anon.status !== 401) appOpen.push(p + " opens with no key (" + anon.status + ")");
      if (cli.status === 401 || typeof cli.status !== "number") appShut.push(p + " with the client key: " + cli.status);
      const legacy = await call(withKey(p, LEGACY), init);
      if (legacy.status === 401 || typeof legacy.status !== "number") appShut.push(p + " with the older client key: " + legacy.status);
      if (cliOut.some((o) => PRIVATE_SERVICES.test(o.u)) || cliWrites.some((k) => !/^(esri|amen_|iso_)/.test(k))) leaks.push(method + " " + p + " (app page) wrote " + cliWrites.join(",") + " / called " + cliOut.map((o) => o.u).join(","));
      continue;
    }
    // v235 (Kendall, 22 Sep 2026) - the ONE declared escalation: "nationality should not need a key", so an app
    // key now opens the residents layer where no key still gets 404. Declared here so the sweep keeps guarding
    // every other route and this one change stays visible instead of quietly widening the rule.
    const V235_RESIDENTS = method === "GET" && (p === "/residents" || p === "/residents/data") && cli.status === 200;
    if (!V235_RESIDENTS && cli.status !== 401 && cli.status !== anon.status) escalations.push(method + " " + p + ": no key " + anon.status + ", client key " + cli.status);
    if (cli.status === 401 && (cliWrites.length || cliOut.length)) leaks.push(method + " " + p + " refused the client key but still wrote " + cliWrites.join(",") + " / called " + cliOut.map((o) => o.u).join(","));
    if (cliOut.some((o) => PRIVATE_SERVICES.test(o.u))) leaks.push(method + " " + p + " called a private service for a client key: " + cliOut.map((o) => o.u).join(","));
  }
}
ok(escalations.length === 0, "every non-app route x GET/POST/PUT (" + checked + " requests): a client key gets 401 or exactly what no key gets" + (escalations.length ? "\n      " + escalations.join("\n      ") : ""));
ok(leaks.length === 0, "a client key never sends, writes or calls a private service (app pages may cache the map token and amenity lookups)" + (leaks.length ? "\n      " + leaks.join("\n      ") : ""));
ok(appShut.length === 0, "every app page opens with the client key and with the older client key still in links" + (appShut.length ? "\n      " + appShut.join("\n      ") : ""));
ok(appOpen.length === 0, "every app page still refuses a request with no key" + (appOpen.length ? "\n      " + appOpen.join("\n      ") : ""));

// 2. the owner's routes, one by one: READ_KEY does the thing, the client key does not
outbound = [];
let r = await call(withKey("/announce?text=Your%20new%20links", CLIENT));
ok(r.status === 401 && !outbound.some((o) => o.u.includes("graph.facebook.com")), "/announce: the client key cannot send her a WhatsApp message");
r = await call(withKey("/announce?text=Your%20new%20links", READ));
ok(r.status === 200 && outbound.some((o) => o.u.includes("graph.facebook.com") && o.body.includes("Your new links")), "/announce: READ_KEY still sends (the route is real)");
r = await call(withKey("/done?id=x1", CLIENT));
ok(r.status === 401 && store.has("act_x1"), "/done: the client key cannot delete her to-do");
r = await call(withKey("/done?id=x1", READ));
ok(r.status === 200 && !store.has("act_x1"), "/done: READ_KEY still clears it");
r = await call(withKey("/anything_at_all", CLIENT));
ok(r.status === 401, "keyed catch-all: the client key does not get her meetings");
r = await call(withKey("/anything_at_all", READ));
ok(r.status === 200 && (await bodyOf(r)).includes("Viewing with a private client"), "keyed catch-all: READ_KEY still does (so the refusal above is not an accident)");
for (const p of ["/board", "/actions", "/commitments", "/ledger", "/people", "/inbox", "/outbox", "/health", "/src?id=x", "/trends", "/studio", "/amenities?area=marina", "/card.png", "/ig_status", "/gcal/status"]) {
  r = await call(withKey(p, CLIENT));
  const rr = await call(withKey(p, READ));
  ok(r.status === 401 && rr.status !== 401, p + ": client key 401, READ_KEY " + rr.status);
}
for (const [p, m] of [["/genimg", "POST"], ["/setbg", "POST"], ["/poll_send", "POST"], ["/gdrive/put_text", "POST"], ["/gdrive/upload_start", "POST"], ["/gdrive/upload_chunk", "PUT"], ["/plate_gen_me", "GET"], ["/scene_test", "GET"]]) {
  outbound = []; writes = [];
  r = await call(withKey(p, CLIENT), { method: m, body: m === "GET" ? undefined : "{}", headers: m === "GET" ? {} : { "Content-Type": "application/json" } });
  ok(r.status === 401 && !outbound.length && !writes.length, m + " " + p + ": the client key is refused and nothing runs");
}
outbound = [];
r = await call(withKey("/find?scan=" + CLIENT, CLIENT));
ok(r.status === 200 && !outbound.some((o) => PRIVATE_SERVICES.test(o.u)), "?scan= with the client key on an app page does not start a mail scan");

// 3. the app pages opened with a client key: no READ_KEY anywhere in them, no BOARD tab, no owner links; opened with READ_KEY they keep BOARD
const PAGES = ["/find", "/home", "/avail?d=imtiaz", "/market", "/charts", "/plans", "/clock", "/map", "/skyline?all=1", "/skyline/jltnorth", "/view", "/area/Business%20Bay", "/report/businessbay"];
for (const p of PAGES) {
  r = await call(withKey(p, CLIENT));
  const html = await bodyOf(r);
  const nav = /class=nnav/.test(html);
  ok(r.status === 200 && !html.includes(READ) && !/href="\/(?:board|studio|trends)\b/.test(html) && !html.includes("<span>BOARD</span>")
    && (!nav || (html.includes("<span>FIND</span>") && html.includes("<span>MORE</span>") && html.includes("/find?key=" + CLIENT))),
    p + ", client key: no READ_KEY, no BOARD, no owner links" + (nav ? "; the nav carries the client key" : ""));


}
// v235 - BOARD and the card sheet left the tab bar for /more. The invariant did not move: the owner
// still reaches both, a client key sees neither, and /more still opens for a client.
{
  const ownMore = await bodyOf(await call(withKey("/more", READ)));
  ok(ownMore.includes("BOARD") && ownMore.includes("/board?key=" + READ) && ownMore.includes("CARD SHEET"),
    "/more, READ_KEY: the owner still reaches BOARD and the card sheet");
  const cliMore = await bodyOf(await call(withKey("/more", CLIENT)));
  ok(!cliMore.includes(READ) && !/href="[/](?:board|studio|trends|charts)\b/.test(cliMore)
    && !cliMore.includes("BOARD") && !cliMore.includes("CARD SHEET") && cliMore.includes("<span>MORE</span>"),
    "/more, client key: no BOARD, no card sheet, no owner key - and the page still opens");
  const cliStart = await bodyOf(await call(withKey("/start", CLIENT)));
  ok(!cliStart.includes(READ) && cliStart.includes("THEY WANT TO RENT") && cliStart.includes("<span>START</span>"),
    "/start, client key: the Brief card opens and carry no owner key");
}
r = await call(withKey("/home", CLIENT));
ok(!(await bodyOf(r)).includes("meetings board"), "/home, client key: the 'meetings board' link is gone");
r = await call(withKey("/avail?d=imtiaz", LEGACY));
const legacyPage = await bodyOf(r);
ok(r.status === 200 && !legacyPage.includes(READ) && !legacyPage.includes("<span>BOARD</span>"), "/avail with the older client key: opens, no READ_KEY, no BOARD");

// 4. what Azimuth hands the owner to forward carries the client key; her own BOARD link keeps READ_KEY
let mid = 0;
const inbound = (message) => call("/wa", { method: "POST", headers: { "X-Azimuth-Forward": "FWD", "Content-Type": "application/json" },
  body: JSON.stringify({ entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: "p" }, messages: [Object.assign({ from: HER, id: "wamid.in" + (++mid) }, message)] } }] }] }) });
const sentText = () => outbound.filter((o) => o.u.includes("graph.facebook.com")).map((o) => o.body).join("\n");
outbound = []; await inbound({ type: "text", text: { body: "pulse" } });
ok(sentText().includes("/market?key=" + CLIENT) && !sentText().includes(READ), "chat 'pulse': the market link carries the client key");
outbound = []; await inbound({ type: "text", text: { body: "charts" } });
ok(sentText().includes("/charts?key=" + CLIENT) && !sentText().includes(READ), "chat 'charts': the charts link carries the client key");
outbound = []; await inbound({ type: "text", text: { body: "board" } });
ok(sentText().includes("/board?key=" + READ), "chat 'board': her own BOARD link keeps READ_KEY (owner only)");
const readInAppLink = src.split("\n").filter((l) => /env\.READ_KEY/.test(l) && /key=/.test(l) && /["'`]\/(?:find|home|dev|compare|cards|avail|market|skyline|view|map|plans|charts|clock|area|report)\b/.test(l));
ok(readInAppLink.length === 0, "no line of the worker puts READ_KEY into a link to an app page" + (readInAppLink.length ? "\n      " + readInAppLink.map((l) => l.trim().slice(0, 140)).join("\n      ") : ""));

// 5. the residents flow. v239 (Kendall: "residents is fully public") removed the gate, so these no longer 404 -
// the page opens for anyone. The invariant that survives is the one that was always the point: another key
// PRESENTED AS rk is not honoured AS rk. It must not buy the private twin back-links, which are the only thing
// rk still gates. Asserting the page 404s would now be asserting the old rule; asserting rk is ignored is the
// same protection stated against behaviour rather than against a status code.
for (const [label, k] of [["the client key", CLIENT], ["the older client key", LEGACY], ["READ_KEY", READ]]) {
  r = await call("/residents?rk=" + encodeURIComponent(k));
  ok(r.status === 200, "residents: " + label + " as rk still opens the page - it is public now: " + r.status);
  const b = await r.text();
  ok(!/&rk=/.test(b) && !b.includes(READ), "residents: " + label + " as rk is NOT honoured as rk - no private twin links, no READ_KEY");
  r = await call("/residents/data?rk=" + encodeURIComponent(k));
  ok(r.status === 200, "residents data: " + label + " as rk still opens - public: " + r.status);
}
r = await call("/residents?rk=" + RES);
const resPage = await bodyOf(r);
ok(r.status === 200 && !resPage.includes(READ) && resPage.includes('/map?key=' + CLIENT + '&rk=' + RES) && resPage.includes('/skyline?all=1&key=' + CLIENT + '&rk=' + RES), "residents page: opens with its key; back to MAP and TWIN with the client key, no READ_KEY");
r = await call("/residents/data?rk=" + RES);
ok(r.status === 200 && (await bodyOf(r)).includes("ABU HAIL"), "residents data: still served to its own key");
r = await call(withKey("/map?rk=" + RES, CLIENT));
let mp = await bodyOf(r);
ok(r.status === 200 && mp.includes("RESIDENTS</span>") && !mp.includes("<span>BOARD</span>") && !mp.includes(READ), "MAP, client key + residents key: RESIDENTS tab, no BOARD, no READ_KEY");
r = await call(withKey("/map?rk=" + CLIENT, CLIENT));
ok(!(await bodyOf(r)).includes("RESIDENTS</span>"), "MAP, client key passed as rk: no residents tab");

// 6. mistakes in the secret fail closed
const E = (o) => Object.assign({}, env, o);
r = await call(withKey("/find", READ), {}, E({ CLIENT_KEY: READ }));
const r2 = await call(withKey("/board", READ), {}, E({ CLIENT_KEY: READ }));
ok(r.status === 200 && r2.status === 200, "CLIENT_KEY set to READ_KEY by mistake: ignored, READ_KEY still the owner's");
r = await call(withKey("/find", "shortkey"), {}, E({ CLIENT_KEY: "shortkey" }));
ok(r.status === 401, "a client key under 12 characters is ignored");
r = await call(withKey("/find", RES), {}, E({ CLIENT_KEY: RES }));
const r3 = await call("/residents?rk=" + RES, {}, E({ CLIENT_KEY: RES }));
ok(r.status === 401 && r3.status === 200, "CLIENT_KEY set to RESIDENTS_KEY by mistake: ignored as a client key, residents still open");
r = await call(withKey("/find", CLIENT), {}, E({ CLIENT_KEY: undefined }));
ok(r.status === 401, "no CLIENT_KEY on the worker: a client key opens nothing");

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
