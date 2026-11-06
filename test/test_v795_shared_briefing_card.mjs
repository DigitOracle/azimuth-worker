// v795 (Kendall 6 Nov 2026: "create a card in Momo for myself and Najjuko"): a briefing card listed in dossier_list_kendall opens with Kendall's key too.
// Every other briefing card stays Najjuko's alone, and nobody else gets either.
import { dossierRoute, readList } from "../src/work_dossier.js";
let fail = 0; const ok = (c, m, x) => { if (!c) { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 300)); } else console.log("ok", m); };
const store = new Map([
  ["dossier_list_najjuko", JSON.stringify([{ slug: "berkeley", title: "Berkeley" }, { slug: "amali", title: "Amali Properties" }])],
  ["dossier_list_kendall", JSON.stringify([{ slug: "amali", title: "Amali Properties" }])],
  ["dossier_rec_najjuko_amali", JSON.stringify({ title: "Amali Properties", subtitle: "Developer briefing", sections: [{ id: "who", title: "Who they are", md: "Founded 2023." }] })],
  ["dossier_rec_najjuko_berkeley", JSON.stringify({ title: "Berkeley", sections: [{ id: "a", title: "A", md: "x" }] })],
]);
const env = { MEETINGS: { get: async (k) => (store.has(k) ? store.get(k) : null), put: async (k, v) => { store.set(k, String(v)); }, delete: async (k) => { store.delete(k); } } };
const call = async (who, path, slug, method, body) => { const url = new URL("https://x.example" + path + "?key=k&b=" + slug);
  return dossierRoute(new Request(url, { method: method || "GET", headers: body ? { "Content-Type": "application/json" } : {}, body: body ? JSON.stringify(body) : undefined }), env, url, { person: () => who, page: (k, rk, b) => "<html>" + b + "</html>" }); };
ok((await readList(env)).length === 2 && (await readList(env, "kendall")).length === 1, "two lists: hers, and the cards shared with Kendall");
let r = await call("najjuko", "/momo/work/brief", "amali"); ok(r.status === 200 && /Amali Properties/.test(await r.text()), "Najjuko opens the Amali card");
r = await call("kendall", "/momo/work/brief", "amali"); ok(r.status === 200 && /Amali Properties/.test(await r.text()), "Kendall opens the shared Amali card");
r = await call("kendall", "/momo/work/brief", "berkeley"); ok(r.status === 404, "Kendall cannot open a card that is not shared with him", r.status);
r = await call("najjuko", "/momo/work/brief", "berkeley"); ok(r.status === 200, "her other cards still open for her");
r = await call("", "/momo/work/brief", "amali"); ok(r.status === 404, "no key, no card");
r = await call("someone", "/momo/work/brief", "amali"); ok(r.status === 404, "anyone else gets not found");
r = await call("kendall", "/momo/work/brief/rec", "amali"); const j = await r.json(); ok(r.status === 200 && j.rec && j.rec.title === "Amali Properties" && Array.isArray(j.notes), "Kendall reads the record and the notes", j);
process.exit(fail ? 1 : 0);
