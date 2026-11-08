// v813: on the huddle card, Edit opens the text for editing (Save / Cancel) on every section; it never saves on its own (Najjuko's walkthrough, 8 Nov).
// The browser walk-through of every section is test/e2e_v813_huddle_edit.py (Playwright); this file checks the wiring and the server side.
import assert from "node:assert/strict";
import * as Hd from "../src/huddle.js";
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
function kv() { const m = new Map(); return { m, get: async (k) => (m.has(k) ? m.get(k) : null), put: async (k, v) => { m.set(k, v); }, delete: async (k) => m.delete(k), list: async ({ prefix }) => ({ keys: [...m.keys()].filter((k) => k.startsWith(prefix || "")).sort().map((name) => ({ name })), list_complete: true }) }; }
const env = { MEETINGS: kv() };
const prev = await Hd.createCard(env, "2026-11-23"); prev.status = "Closed"; prev.form = { tip_text: "Reply fast" }; await env.MEETINGS.put("hud_card_2026-11-23", JSON.stringify(prev));
await Hd.createCard(env, "2026-11-30", undefined, { cal: async () => ({ connected: true, events: [{ time: "09:00", title: "Huddle" }] }) });
const act = (b) => Hd.cardAction(env, Object.assign({ date: "2026-11-30" }, b));

// the page script: the Edit button only opens the editor; Save and Cancel exist; no api call inside the Edit handler
const html = Hd.cardPageWithPrev(await Hd.getCard(env, "2026-11-30"), prev, "k");
const js = html.slice(html.indexOf("(function(){"));
const editH = /\$\("bedit"\)\.onclick=function\(\)\{([^]*?)\};/.exec(js);
ok(editH && !/api\(/.test(editH[1]) && /bedw/.test(editH[1]), "Edit opens the editor and never calls the server");
ok(/id=bsave>Save</.test(js) && /id=bcancel>Cancel</.test(js) && /\$\("bcancel"\)\.onclick=function\(\)\{openSec\(id\)\}/.test(js), "Save and Cancel are there; Cancel changes nothing");
ok(/action:"momo_edit"/.test(js) && /action:"edit",section:id,values:v/.test(js), "Save writes her text: form fields when the section has them, else her own lines");
new Function(js.replace(/<\/script>[\s\S]*$/, "")); ok(true, "the card script parses");

// plain words, not slide numbers alone
ok(/Shown on '\+e\(wh\)\+' \(slide/.test(js) && Hd.WHERE.theme === "the opening slide and the theme slide", "the theme sheet says where it shows in plain words");
ok(Hd.SECTIONS.every((s) => Hd.WHERE[s.id]), "every section has its plain-words place");

// server: momo_edit on every Momo-draft section (and a section with no draft); market is changed with the ticks
for (const sid of ["theme", "recognition", "celebrations", "schedule", "announcements"]) {
  const r = await act({ action: "momo_edit", section: sid, text: "First line for " + sid + "\nSecond line" });
  ok(r[0] === 200 && r[1].card.momo[sid].lines.length === 2 && r[1].card.momo[sid].edited && r[1].card.sections.find((s) => s.id === sid).state === "edit", "Edit then Save works on " + sid);
}
ok((await act({ action: "momo_edit", section: "tip", text: "   " }))[0] === 400, "an empty Save is refused, nothing written");
ok((await act({ action: "momo_edit", section: "market", text: "x" }))[0] === 400, "market is edited with the ticks, not free text");
const r = await act({ action: "edit", section: "tip", values: { tip_text: "Call back before lunch" } });
ok(r[1].card.form.tip_text === "Call back before lunch", "a section with form fields saves the edited fields");
console.log("test_v813_huddle_edit: " + n + " checks passed");
