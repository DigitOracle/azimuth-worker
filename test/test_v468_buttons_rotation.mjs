// v468 - reference photos rotate (27 "general" refs used to give the same 3 every time); the preview has Approve / New picture /
// More options, and More options lists the changes as rows. Offline.
import { pickRefs, deskPostRoute, BACKGROUND_CHOICES } from "../src/desk_post.js";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 500) : "")); } };
const store = new Map();
const KV = { async get(k, t) { const v = store.has(k) ? store.get(k) : null; return v; }, async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); }, async list({ prefix } = {}) { return { keys: [...store.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((name) => ({ name })) }; } };
const env = { MEETINGS: KV, WA_DESK_PHONE_ID: "1", WA_DESK_OWNER: "2" };
const ix = []; for (let i = 1; i <= 27; i++) { ix.push(i); store.set("desk_ref_" + i, JSON.stringify({ n: i, key: "desk_refimg_" + i, tag: "general", approved: true })); store.set("desk_refimg_" + i, new Uint8Array([i]).buffer); }
store.set("desk_ref_index", JSON.stringify(ix));

const seen = [];
for (let k = 0; k < 9; k++) { const r = await pickRefs(env, "a calm morning", ""); seen.push(r.bufs.map((b) => new Uint8Array(b)[0]).join(",")); }
ok(new Set(seen).size === 9, "nine calls give nine different sets", seen.join(" | "));
const used = new Set(seen.join(",").split(","));
ok(used.size === 27, "together they use all 27 photos", [...used].length);
ok(seen.every((s) => s.split(",").length === 3), "each picture still gets three references");

const texts = [], btns = [], lists = [];
const deps = { send: async (e, t) => texts.push(t), buttons: async (e, b, x) => btns.push({ b, x }), list: async (e, body, button, rows) => lists.push(rows), image: async () => {}, llm: async () => "", fetchMedia: async () => ({}), origin: () => "https://w.dev", now: () => Date.now(), sleep: async () => {} };
const tap = async (id) => { texts.length = 0; btns.length = 0; lists.length = 0; return deskPostRoute(env, { type: "interactive", interactive: { button_reply: { id } } }, "", deps); };
store.set("postplan_pb1", JSON.stringify({ id: "pb1", status: "draft", idea: "x", type: "single", lane: "abbot", caption: "C", background: "site", slides: [{ img_key: "g1", src: "ai" }], approved: false, history: [], rounds: 0, created: Date.now(), expires_at: Date.now() + 1e9 }));
await tap("dp:pb1:more");
const rows = lists[0] ? lists[0].map((r) => r.id.split(":")[2]) : [];
ok(rows.join(",") === "e_rewrite,e_short,e_punch,e_formal,e_bg,e_arabic,edit,skip", "More options lists every change as a row", rows.join(","));
ok(lists[0].every((r) => r.title.length <= 24), "row titles fit WhatsApp's 24 characters");
const src = (await import("fs")).readFileSync(new URL("../src/desk_post.js", import.meta.url), "utf8");
ok(/title: "Approve" \}, \{ id: "dp:" \+ p\.id \+ ":newpic", title: "New picture" \}, \{ id: "dp:" \+ p\.id \+ ":more", title: "More options" \}/.test(src), "the preview's buttons are Approve / New picture / More options");
await tap("dp:pb1:e_bg").catch(() => {});
const ids = BACKGROUND_CHOICES.map((b) => b.id);
ok(JSON.parse(store.get("postplan_pb1")).background === ids[(ids.indexOf("site") + 1) % ids.length] && /New setting: Office or boardroom/.test(texts.join("")), "Another background moves to the next setting", texts.join("|"));
store.set("postplan_pb2", JSON.stringify({ id: "pb2", status: "posted", slides: [], history: [] }));
await tap("dp:pb2:newpic");
ok(/is posted/.test(texts.join("")), "a posted draft is never changed");
console.log("\n" + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
