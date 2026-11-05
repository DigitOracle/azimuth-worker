// v775: the check-in team = only the people NAMED in her tasks / planner items (org chart gives full name + role); numbers just in time
import { namedRoster, matchPerson, pasteMatches, rosterAction, namesOn, readTeam, CK_JS } from "../src/checkin.js";
import { PEOPLE } from "../src/work_log.js";
let fail = 0; const ok = (c, m, x) => { if (!c) { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } else console.log("ok", m); };
const kv = new Map(); const env = { MEETINGS: { get: async (k) => kv.has(k) ? kv.get(k) : null, put: async (k, v) => { kv.set(k, v); }, delete: async (k) => kv.delete(k) } };
kv.set("cp_index", JSON.stringify(["FD-1103-1", "ST-1102-1"]));
kv.set("cp_item_FD-1103-1", JSON.stringify({ code: "FD-1103-1", who: "Kareem, Nare", how: "AI video", status: {} }));
kv.set("cp_item_ST-1102-1", JSON.stringify({ code: "ST-1102-1", who: "AI / agent", how: "Design (carousel / graphic)", status: {} }));
kv.set("ck_team", JSON.stringify([{ name: "Vishant", phone: "971500000001" }]));

const r0 = namedRoster(PEOPLE, ["Kareem", "Liam", "Najjuko", "AI"], {});
ok(r0.length === 2 && r0.some((p) => p.name === "Karim" && /editing/i.test(p.role)) && r0.some((p) => p.name === "Liam"), "only named people; org chart fills the full name and role; not her, not 'AI'", r0);
let [s1, o1] = await rosterAction(env, {}, PEOPLE, ["Ali Kalhor"]);
const names = o1.roster.map((p) => p.name);
ok(s1 === 200 && names.includes("Karim") && names.includes("Nare Kirakosyan") && names.includes("Vishant Singh") && names.includes("Monaza") && names.includes("Ali Kalhor") && names.includes("Sousan Khatibzadeh"), "roster = named on items (who, maker, step owners) + task people", names);
ok(o1.roster.length < 15 && !names.includes("Revant Vaish"), "not the whole org chart", o1.roster.length);
ok(o1.roster.find((p) => p.name === "Vishant Singh").phone === "971500000001", "the number she already had carries over (Vishant -> Vishant Singh)");
const here = await namesOn(env, { kind: "step", code: "FD-1103-1", step: "Made" }, []);
ok(here.includes("Vishant") && here.includes("Kareem"), "this step's people: its maker + who's in it", here);
[s1, o1] = await rosterAction(env, { op: "set", name: "Karim", phone: "055 765 4321", here }, PEOPLE, []);
ok(o1.here[0] && o1.here.find((p) => p.name === "Karim").phone === "971557654321", "a number typed once is saved (05x -> +9715) and shows on this step", o1.here);
[s1, o1] = await rosterAction(env, { op: "set", name: "Karim", phone: "12" }, PEOPLE, []);
ok(s1 === 400, "a bad number is refused");
const pm = pasteMatches(o1.roster || (await rosterAction(env, {}, PEOPLE, []))[1].roster, "Nare - 050 111 2222\nNobody 0501112233");
ok(pm[0].ok && pm[0].name === "Nare Kirakosyan" && !pm[1].ok, "paste matches by name", pm);
const team = await readTeam(env);
ok(team.length === 2 && team.some((p) => p.name === "Karim"), "people with a number reach ck_make / ck_desk", team);
let parses = true; try { new Function(CK_JS); } catch (e) { parses = false; console.log(e.message); }
ok(parses && CK_JS.includes("WhatsApp number") && CK_JS.includes("Save and open WhatsApp") && CK_JS.includes("Team numbers") && !CK_JS.includes("numbers added"), "picker: number box on the spot, Team numbers link, no progress nag");
process.exit(fail ? 1 : 0);
