// v758: serve the Content Planner with sample items on 127.0.0.1:8799 (a KV double; nothing touches the live store); test/render_v758_planner.py screenshots it
import http from "node:http";
import { plannerRoute, applyAction } from "../src/content_planner.js";
const OUT = process.argv[2];
const store = new Map(); const env = { MEETINGS: { get: async (k) => store.has(k) ? store.get(k) : null, put: async (k, v) => store.set(k, v), delete: async (k) => store.delete(k) } };
const seed = [
  { code: "FEED-W1-02", kind: "feed", date: "2026-11-03", time: "11:00", format: "Reel", pillar: "Trust", series: "Single post", topic: "Flag Day: the city in white, green, red and black", who: "Yusuf", how: "In-house video (office)" },
  { code: "FEED-W1-04", kind: "feed", date: "2026-11-05", time: "11:00", format: "Reel", pillar: "Commercial", series: "FIRST LOOK", topic: "FIRST LOOK · Lumena Alta show suite", cta: "DM LUMENA for the brochure", developer: "Omniyat · Lumena Alta", who: "Sarah", how: "Professional video" },
  { code: "FEED-W1-05", kind: "feed", date: "2026-11-06", time: "12:00", format: "Carousel", pillar: "Trust", topic: "Dubai Islands in 5 slides", who: "No person", how: "Design (carousel / graphic)" },
  { code: "FEED-W1-06", kind: "feed", date: "2026-11-08", time: "11:00", format: "Reel", pillar: "Trust", topic: "Agent of the week · Ahmed", who: "Ahmed", how: "In-house video (office)" },
  { code: "STORY-1105-1", kind: "story", date: "2026-11-05", time: "08:00", story_type: "Commercial", topic: "Palm Central: 3 reasons to look", who: "AI", how: "Design (carousel / graphic)" },
  { code: "STORY-1105-2", kind: "story", date: "2026-11-05", time: "13:00", story_type: "Trending", topic: "Audio trend: Dubai at night", who: "No person", how: "Repost / photo / text card" },
  { code: "STORY-1105-3", kind: "story", date: "2026-11-05", time: "15:00", story_type: "Market", topic: "" },
];
for (const s of seed) await applyAction(env, Object.assign({ action: "save", added: false }, s), "Najjuko");
for (const [c, st] of [["FEED-W1-04", "Planned"], ["FEED-W1-04", "Brief"], ["FEED-W1-02", "Planned"], ["FEED-W1-02", "Brief"], ["FEED-W1-02", "Made"], ["STORY-1105-1", "Planned"], ["STORY-1105-2", "Planned"], ["STORY-1105-2", "Made"], ["FEED-W1-06", "Planned"]])
  await applyAction(env, { action: "tick", code: c, step: st }, "Najjuko");
const page = (k, rk, body) => '<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><link rel=stylesheet href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=IBM+Plex+Mono:wght@500;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap">'
  + '<style>body{margin:0;background:#FAF7F1;color:#1C2321;font-family:"IBM Plex Sans",sans-serif;padding:22px 14px 120px}.w{max-width:560px;margin:0 auto}.tag{font-family:"IBM Plex Mono",monospace;font-size:.68rem;letter-spacing:.18em;color:#8A6F3E}h1{font-family:Fraunces,serif;font-weight:600;font-size:1.7rem;margin:4px 0 10px;color:#0A4F4A}.back{color:#5F6B66;text-decoration:none;font-size:.85rem}</style></head><body><div class=w>' + body + '</div></body></html>';
const srv = http.createServer(async (req, res) => {
  const url = new URL("http://127.0.0.1:8799" + req.url); let body = "";
  for await (const ch of req) body += ch;
  const r = await plannerRoute(new Request(url, { method: req.method, body: req.method === "POST" ? body : undefined }), env, url, { page, person: () => "najjuko" });
  if (!r) { res.writeHead(404); res.end(); return; }
  res.writeHead(r.status, { "Content-Type": r.headers.get("Content-Type") }); res.end(await r.text());
}).listen(8799);
console.log("serving on 8799 (screenshots: test/render_v758_planner.py)");
