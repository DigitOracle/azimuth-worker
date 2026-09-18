// v182 — HER EMAIL SIGN-IN, WALKED THROUGH IN THE CHAT (Kendall, 18 Sep 2026).
//
// Her first attempt failed with AADSTS50020 ("user account ... does not exist in tenant 'Continental Insurance Brokers LLC'"):
// Outlook on her Mac was signed in to another organisation. The walkthrough follows Kendall's new-joiner guide, starts only when
// SHE types "email setup", never carries a password, and "I'm stuck" leads with that exact error.
import worker from "../src/index.js";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("ok - " + m); } else { fail++; console.log("not ok - " + m); } };

const sent = [];
globalThis.fetch = async (u, o) => {
  const url = String(u && u.url ? u.url : u);
  if (/graph\.facebook\.com/.test(url)) { try { sent.push(JSON.parse(String(o && o.body || "{}"))); } catch (e) {} return new Response(JSON.stringify({ messages: [{ id: "wamid.x" }] }), { status: 200 }); }
  if (/owner_note/.test(url)) { sent.push({ owner: JSON.parse(String(o.body)).text }); return new Response("ok", { status: 200 }); }
  return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
};
const store = new Map();
const KV = { async get(k, t) { if (!store.has(k)) return null; const v = store.get(k); return t === "json" ? JSON.parse(v) : v; },
  async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); }, async list() { return { keys: [], list_complete: true }; } };
const HER = "971565484397";
const env = { MEETINGS: KV, WA_ALLOWED: HER, WHATSAPP_TOKEN: "t", WA_PHONE_ID: "1", WEBHOOK_SECRET: "", OWNER_NOTE_URL: "https://mc/owner_note", INGEST_TOKEN: "i" };
let n = 0;
const inbound = async (msg) => {
  sent.length = 0;
  const body = { entry: [{ changes: [{ value: { metadata: { phone_number_id: "1" }, messages: [Object.assign({ from: HER, id: "m" + (++n), timestamp: String(Math.floor(Date.now() / 1000)) }, msg)] } }] }] };
  await worker.fetch(new Request("https://x/wa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), env, { waitUntil() {} });
  return sent.slice();
};
const text = (t) => inbound({ type: "text", text: { body: t } });
const tap = (id) => inbound({ type: "interactive", interactive: { type: "button_reply", button_reply: { id, title: id } } });
const bodyOf = (m) => (m.text && m.text.body) || (m.interactive && m.interactive.body && m.interactive.body.text) || m.owner || "";
const btns = (m) => ((m.interactive && m.interactive.action && m.interactive.action.buttons) || []).map((b) => b.reply.id);

const a = await text("email setup");
ok(a.length === 1 && /Your DigitAlchemy email/.test(bodyOf(a[0])) && btns(a[0]).join() === "em:go,em:later", "\"email setup\" opens the walkthrough with Let's start / Later");
ok(/najjuko\.najma@digitalabbot\.io/.test(bodyOf(a[0])) && /temporary password comes from Kendall/.test(bodyOf(a[0])), "it names her address and says the password comes from Kendall");
const s1 = await tap("em:go");
ok(/Step 1 of 5/.test(bodyOf(s1[0])) && /private window/i.test(bodyOf(s1[0])) && /outlook\.office\.com/.test(bodyOf(s1[0])), "step 1 is the private window at outlook.office.com - the fix for her tenant clash");
const st = await tap("em:stuck");
ok(/AADSTS50020/.test(bodyOf(st[0])) && /does not exist in tenant/.test(bodyOf(st[0])) && btns(st[0]).join() === "em:back,em:help", "\"I'm stuck\" leads with her exact error and offers Back / Tell Kendall");
const back = await tap("em:back");
ok(/Step 1 of 5/.test(bodyOf(back[0])), "Back returns to the step she was on");
const steps = [];
for (let i = 0; i < 4; i++) steps.push(bodyOf((await tap("em:done"))[0]));
ok(steps.map((t) => (t.match(/Step (\d) of 5/) || [])[1]).join() === "2,3,4,5", "Done walks steps 2 to 5 in order");
const fin = await tap("em:done");
ok(fin.some((m) => /You're in/.test(bodyOf(m))), "after step 5 she is told she's in, with phone and laptop instructions");
ok(fin.some((m) => /finished the email sign-in/.test(m.owner || "")), "and Kendall is told she finished");
const help = await tap("em:help");
ok(help.some((m) => /stuck signing in/.test(m.owner || "")) && help.some((m) => /let Kendall know/.test(bodyOf(m))), "Tell Kendall reaches him and tells her so");
const all = JSON.stringify([a, s1, st, back, fin, help]);
ok(!/password\s*[:=]\s*\S{6,}/i.test(all), "no password ever appears in anything sent");
const other = await text("what's the weather");
ok(!other.some((m) => /Your DigitAlchemy email/.test(bodyOf(m))), "ordinary messages do not start it");

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
