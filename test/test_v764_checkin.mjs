// v764: WhatsApp check-in - wa.me link from her own phone, one-task token page, the answer moves the task / ticks the step
import { workRoute, checkinRoute } from "../src/work_log.js";
import { phoneDigits, ckMessage, saveTeam, CK_JS } from "../src/checkin.js";
import { plannerBody } from "../src/content_planner.js";
let fail = 0; const ok = (c, m) => { if (!c) { fail++; console.log("FAIL", m); } else console.log("ok", m); };
const store = new Map();
const env = { MEETINGS: { get: async (k) => store.has(k) ? store.get(k) : null, put: async (k, v) => { store.set(k, v); }, delete: async (k) => { store.delete(k); },
  list: async ({ prefix }) => ({ keys: [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }) }, INSIDER_KEY: "ins_najjuko_TESTKEY0123456789abcd" };
const deps = { isNaj: () => true, isAny: () => true, person: () => "najjuko", page: (k, r, b) => b };
const api = new URL("https://x.dev/momo/work/api?key=ins_najjuko_TESTKEY0123456789abcd");
const post = async (o) => (await workRoute(new Request(api, { method: "POST", body: JSON.stringify(o) }), env, api, deps)).json();

ok(phoneDigits("050 123 4567") === "971501234567" && phoneDigits("+44 7700 900123") === "447700900123" && phoneDigits("12") === "", "phone numbers to wa.me digits");
const msg = ckMessage("FD-12 (DAMAC reel)", "Made", "Thu 7 Nov 18:00", "https://x/momo/checkin/T");
ok(/^Najjuko here\./.test(msg) && !/Black Coffee/i.test(msg) && /Tap your answer: https/.test(msg), "the message opens with Najjuko, never Black Coffee");
ok((await saveTeam(env, [{ name: "Vishant", phone: "0501234567" }, { name: "Bad", phone: "1" }, { name: "vishant", phone: "0509999999" }])).length === 1, "the team list keeps valid, unique people");

const d = new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10);
store.set("work_naj_" + d + "_e1", JSON.stringify({ id: "e1", date: d, type: "Update", title: "x", summary: "x", works: ["Brochure refresh"], progress: [{ work: "Brochure refresh", status: "In progress", percent: 40, owners: [] }], kpis: [], people: [], deliverables: [], external: [], created: d + "T08:00:00Z" }));
const mk = await post({ action: "ck_make", kind: "task", name: "Brochure refresh", person: "Vishant" });
ok(mk.ok && /^https:\/\/wa\.me\/971501234567\?text=/.test(mk.url) && decodeURIComponent(mk.url).includes("Brochure refresh"), "the button gives a wa.me link to Vishant with the task in the text");
ok((await post({ action: "ck_make", kind: "task", name: "Brochure refresh", person: "Nobody" })).error, "only people on her list");
const tokUrl = new URL(mk.link), tk = tokUrl.pathname.split("/").pop();
const pg = await (await checkinRoute(new Request(tokUrl), env, tokUrl)).text();
ok(/Brochure refresh/.test(pg) && /Hi Vishant/.test(pg) && /value=done/.test(pg) && /value=stuck/.test(pg) && !/work_naj|key=/.test(pg), "the page shows this task and three answers, nothing else");
const bad = new URL("https://x.dev/momo/checkin/zzzzzzzzzzzzzzzzzzzzzzzz");
ok((await checkinRoute(new Request(bad), env, bad)).status === 404, "a wrong or expired link opens nothing");
const ans = await checkinRoute(new Request(tokUrl, { method: "POST", body: "a=done&note=sent+to+print" }), env, tokUrl);
ok(ans.status === 200 && /Thank you, Vishant/.test(await ans.text()), "answering thanks the person");
const tp = JSON.parse(store.get([...store.keys()].find((k) => k.startsWith("work_naj_task_"))));
ok(tp.status === "Done" && tp.percent === 100, "Done moves the task to Done 100%");
const g = await (await workRoute(new Request(new URL("https://x.dev/momo/work/api?key=ins_najjuko_TESTKEY0123456789abcd")), env, new URL("https://x.dev/momo/work/api?key=ins_najjuko_TESTKEY0123456789abcd"), deps)).json();
ok(g.checkins && g.checkins["Brochure refresh"] && g.checkins["Brochure refresh"].who === "Vishant" && g.checkins["Brochure refresh"].ans === "done", "she sees the answered chip data on the card");

// a planner step
store.set("cp_item_FD-12", JSON.stringify({ code: "FD-12", kind: "feed", date: d, time: "18:00", format: "Reel", topic: "DAMAC reel", who: "Liam", how: "In-house video (office)", done: {}, log: [] }));
store.set("cp_index", JSON.stringify(["FD-12"]));
const m2 = await post({ action: "ck_make", kind: "step", code: "FD-12", step: "Made", person: "Vishant" });
ok(m2.ok && decodeURIComponent(m2.url).includes("FD-12") && decodeURIComponent(m2.url).includes("Made"), "a step link names the post and the step");
const u2 = new URL(m2.link);
await checkinRoute(new Request(u2, { method: "POST", body: "a=done" }), env, u2);
const it = JSON.parse(store.get("cp_item_FD-12"));
ok(it.done.Made && it.done.Made.done && it.checkins[0].who === "Vishant" && /Vishant: Done/.test(it.log[0].what), "Done ticks the step and logs Vishant: Done, hh:mm");
await checkinRoute(new Request(u2, { method: "POST", body: "a=stuck&note=no+footage" }), env, u2);
ok(JSON.parse(store.get("cp_item_FD-12")).checkins[0].ans === "stuck", "a later answer is kept too");

// scripts parse
let p1 = true; try { new Function(CK_JS); } catch (e) { p1 = false; } ok(p1, "the check-in picker parses");
const url = new URL("https://x/momo/work.js?key=ins_najjuko_TESTKEY0123456789abcd");
const js = await (await workRoute(new Request(url), env, url, deps)).text();
let p2 = true; try { new Function(js); } catch (e) { p2 = false; console.log(e.message); } ok(p2 && js.includes('window.ckBtn("task|"+t.name') && js.includes("ckChip(D.checkins"), "the Work script parses with the button and the chip");
const pb = plannerBody("k", "", false), sc = [...pb.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((x) => x[1]);
let p3 = true; sc.forEach((c) => { try { new Function(c); } catch (e) { p3 = false; console.log(e.message); } }); ok(p3 && pb.includes('src="/momo/checkin.js"') && pb.includes('window.ckBtn("step|"'), "the planner loads the picker and puts the button on each step");
process.exit(fail ? 1 : 0);
