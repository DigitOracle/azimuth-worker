// v790: the FN Realty workflow picture on a desk check-in. Inside the person's 24 h window the buttons message carries it as an image header;
// outside it the approved text template still goes (the picture template waits for Meta). A failed drawing never stops the message.
import { ckDesk, ckDeskTest, saveTeam, ckInteractive } from "../src/checkin.js";
import { ckCardModel, ckCardHtml } from "../src/checkin_card.js";
let fail = 0, n = 0; const ok = (c, m, x) => { n++; if (!c) { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 400)); } else console.log("ok", m); };
const store = new Map();
const env = { WA_DESK_PHONE_ID: "1370146096179819", WA_DESK_OWNER: "971562270000", MEETINGS: {
  get: async (k) => (store.has(k) ? store.get(k) : null), put: async (k, v) => { store.set(k, String(v)); }, delete: async (k) => { store.delete(k); }, list: async () => ({ keys: [], list_complete: true }) } };
const posts = [], drawn = []; let pictureWorks = true;
const deps = () => ({ post: async (p) => { posts.push(p); return new Response(JSON.stringify({ messages: [{ id: "wamid.P" + posts.length }] }), { status: 200 }); }, tplStatus: async () => ({ ok: true, status: "APPROVED" }),
  optedOut: async () => false, cap: 250, picture: async (html, tok) => { drawn.push(html); return pictureWorks ? "https://x.example/img/ck_" + tok.slice(0, 6) : null; }, pictureErr: () => "render 500" });

// the model
const item = { code: "FD-1104-2", kind: "feed", format: "Reel", topic: "Ellington video", date: "2026-11-06", time: "14:00", who: "Najjuko", how: "AI video", done: { "Planned": { done: true, at: "2026-11-03T08:00:00Z" }, "Brief": { done: true, at: "2026-11-04T09:00:00Z" } } };
const m = ckCardModel({ kind: "step", code: "FD-1104-2", step: "Made" }, { item }, "Vishant Rao");
ok(m.steps.length === 5 && m.steps.filter((s) => s.state === "now").length === 1 && m.steps.find((s) => s.state === "now").label === "Made", "planner step: five circles, the asked step is the one marked now", m.steps);
ok(m.steps.find((s) => s.label === "Brief").state === "done" && m.steps.find((s) => s.label === "Brief").date === "4 Nov" && m.steps.find((s) => s.label === "Caption").state === "next", "done steps carry their date; later steps are next");
ok(/Step 4 of 10/.test(m.foot) && /Fri 6 Nov 14:00/.test(m.foot), "footer: position in the full workflow and when it goes out", m.foot);
const mt = ckCardModel({ kind: "task", name: "Visa research" }, { task: { name: "Visa research", status: "Stuck", percent: 40, owners: ["Najjuko"], due: "2026-11-10" } }, "Ali Hassan");
ok(mt.steps.length === 3 && mt.steps[1].label === "Stuck" && mt.steps[1].who === "Ali" && mt.steps[1].date === "40%" && /Due Tue 10 Nov/.test(mt.foot), "task: started, where it is now (asked person, percent), done by the due date", mt);
const html = ckCardHtml(Object.assign({}, m, { title: 'A<b>"x' }));
ok(html.includes("A&lt;b&gt;&quot;x") && !html.includes('A<b>"x') && html.includes("You are here") && html.includes("FN Realty"), "card page escapes text and carries the FN footer");

// the send
await saveTeam(env, [{ name: "Vishant Rao", phone: "0501234567" }]);
const tasks = [{ name: "Brochure refresh", status: "In progress", percent: 40, owners: ["Najjuko"], due: "2026-11-10" }];
let [st, o] = await ckDesk(env, { kind: "task", name: "Brochure refresh", person: "Vishant Rao" }, tasks, deps());
ok(st === 200 && o.sent === "template" && !o.picture && posts[0].type === "template" && drawn.length === 0, "outside the 24 h window: the approved text template, no drawing made", o);
store.set("ck_in_971501234567", "1");
[st, o] = await ckDesk(env, { kind: "task", name: "Brochure refresh", person: "Vishant Rao" }, tasks, deps());
const p2 = posts[1];
ok(st === 200 && o.sent === "buttons" && o.picture && p2.type === "interactive" && p2.interactive.header && p2.interactive.header.type === "image" && /^https:\/\/x\.example\/img\/ck_/.test(p2.interactive.header.image.link) && p2.interactive.action.buttons.length === 3, "inside the window: picture header plus the three buttons", p2.interactive);
ok(/Brochure refresh/.test(drawn[0]) && /Vishant/.test(drawn[0]), "the drawing is made from this task and this person");
pictureWorks = false;
[st, o] = await ckDesk(env, { kind: "task", name: "Brochure refresh", person: "Vishant Rao" }, tasks, deps());
ok(st === 200 && !o.picture && posts[2].type === "interactive" && !posts[2].interactive.header, "a failed drawing does not stop the check-in: buttons go without a picture", o);
ok(!ckInteractive("1", "t".repeat(24), "x").interactive.header, "no image, no header");

// the owner's picture test
pictureWorks = true;
[st, o] = await ckDeskTest(env, { to: "971562270000", name: "Kendall", picture: true }, deps());
const p4 = posts[3];
ok(st === 200 && o.sent === "picture" && p4.type === "interactive" && p4.interactive.header.type === "image" && /Kendall/.test(p4.interactive.body.text), "owner test with picture: an interactive message with the picture header", o);
pictureWorks = false;
[st, o] = await ckDeskTest(env, { to: "971562270000", name: "Kendall", picture: true }, deps());
ok(st === 502 && /could not be drawn: render 500/.test(o.error) && posts.length === 4, "owner test: if the picture cannot be drawn nothing is sent and the reason is given", o);
console.log("test_v790_checkin_picture: " + (n - fail) + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
