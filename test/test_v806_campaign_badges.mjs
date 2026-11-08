// v806: unread badges on the Momo campaign cards (Kendall 8 Nov: "2 people responded, or 2 people clicked" on the card itself).
// Each viewer (Najjuko, Kendall) has their own camp_seen_<viewer>_<cid> snapshot; opening the campaign clears it for that viewer only.
import { campaignRoute, unreadOf, badgeHtml, seenKey } from "../src/campaigns.js";
import { writeFileSync } from "node:fs";

const store = new Map();
const env = { READ_KEY: "rk-owner", MEETINGS: { get: async (k) => (store.has(k) ? store.get(k) : null), put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); } } };
const put = (k, v) => store.set(k, JSON.stringify(v));
const person = (e, u) => ({ "k-naj": "najjuko", "k-ken": "kendall" })[u.searchParams.get("key")] || "";
const deps = { person, isNaj: () => true, now: Date.parse("2026-11-08T10:00:00Z") };
const fail = (m) => { throw new Error(m); };

put("camp_index", ["pja", "dh2"]);
put("camp_pja", { id: "pja", name: "Palm Jebel Ali owners", status: "live", template: "pja_open", phone: "desk", window: "10:00-19:00", cap: 50, tags: ["pja"] });
put("camp_dh2", { id: "dh2", name: "DAMAC Hills 2 owners", status: "live", template: "dh2_open", phone: "desk", window: "10:00-19:00", cap: 50, tags: ["dh2"] });
put("camp_stats_pja", { sent: 40, delivered: 38, read: 30, replies: 2, uclicks: 3, clicks: 4 });
put("camp_stats_dh2", { sent: 25, delivered: 25, read: 20, replies: 5, uclicks: 1, clicks: 1 });

const get = async (key, path) => campaignRoute(new Request("https://x" + path), env, new URL("https://x" + path + (path.includes("?") ? "&" : "?") + "key=" + key), deps);
const unread = async (key) => (await (await get(key, "/momo/campaigns/unread")).json());

// pure helpers
const u = unreadOf({ replies: 5, uclicks: 3 }, { replies: 3, uclicks: 3 });
if (u.replies !== 2 || u.clicks !== 0 || u.total !== 2) fail("unreadOf wrong " + JSON.stringify(u));
if (badgeHtml({ total: 0 }) !== "") fail("empty badge should render nothing");
if (!/1 new reply</.test(badgeHtml({ replies: 1, clicks: 0, total: 1 }))) fail("singular reply");

// nobody has looked yet: everything is new for both
let n = await unread("k-naj"); if (n.viewer !== "najjuko" || n.total !== 11) fail("naj initial " + JSON.stringify(n));
let k = await unread("k-ken"); if (k.viewer !== "kendall" || k.total !== 11) fail("ken initial");

// Najjuko opens Palm Jebel Ali: its badge clears for HER only
let html = await (await get("k-naj", "/momo/campaigns?c=pja")).text();
if (!/Since you last looked/.test(html) || !/2 new replies/.test(html) || !/3 clicked/.test(html)) fail("open page should show what was new");
if (!/DAMAC Hills 2 owners<\/span><span class=ubg><span class="ub ur">5 new replies/.test(html)) fail("other card should carry its badge");
if (!store.has(seenKey("najjuko", "pja"))) fail("seen key not written");
n = await unread("k-naj"); if (n.campaigns.pja.total !== 0 || n.campaigns.dh2.total !== 6) fail("naj after open " + JSON.stringify(n));
k = await unread("k-ken"); if (k.campaigns.pja.total !== 5) fail("kendall's count must not clear");

// new activity arrives: one more reply, two more clickers
put("camp_stats_pja", { sent: 40, delivered: 38, read: 31, replies: 3, uclicks: 5, clicks: 7 });
n = await unread("k-naj"); if (n.campaigns.pja.replies !== 1 || n.campaigns.pja.clicks !== 2) fail("new activity " + JSON.stringify(n.campaigns.pja));
// READ_KEY counts as Kendall
const r = await unread("rk-owner"); if (r.viewer !== "kendall") fail("read key viewer");

// the preview harness: Najjuko's page with dh2 open, then PJA has fresh activity on its card
html = await (await get("k-naj", "/momo/campaigns?c=dh2")).text();
if (!/Palm Jebel Ali owners<\/span><span class=ubg><span class="ub ur">1 new reply<\/span><span class="ub uc">2 clicked/.test(html)) fail("pja pill badge");
const page = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{background:#F7F2E8;color:#1C2321;font-family:"IBM Plex Sans",sans-serif;margin:0;padding:16px}h1{font-family:Fraunces,serif;color:#0A4F4A}.tag{font:600 .7rem monospace;color:#8A6F3E}.back{color:#0A4F4A}</style></head><body>' + html.replace(/<script>[\s\S]*?<\/script>/g, "") + "</body></html>";
writeFileSync(process.argv[2] || "v806_badges.html", page);
console.log("v806 campaign badges: ok");
