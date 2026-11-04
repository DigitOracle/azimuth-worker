// v728 - Building Passport retention (Kendall, 4 Nov 2026: "we do not need to store previous passports, this will be too much").
// Only the LATEST passport per plot + reader (broker / investor / developer) is kept; older files, picture and job records are deleted.
const B = await import("../src/building_passports.js");
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) pass++; else { fail++; console.log("FAIL", m, x === undefined ? "" : JSON.stringify(x).slice(0, 600)); } };

function memKV(init) {
  const m = new Map(Object.entries(init || {}));
  return { m, async get(k) { return m.has(k) ? m.get(k) : null; }, async put(k, v) { m.set(k, v); }, async delete(k) { m.delete(k); },
    async list({ prefix }) { return { keys: [...m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; } };
}
const P1 = "naj:plot:3265635", P2 = "naj:plot:3466876";
const files = (slug) => ({ ["bpp_file_" + slug + "_html"]: "<h>", ["bpp_file_" + slug + "_pdf"]: "%PDF", ["bpp_file_" + slug + "_csv"]: "a,b", ["bpp_photo_" + slug]: "{}" });

// ---------- identity
ok(B.bppKeyOf({ plot_id: P1 }) === P1 + "|broker", "no reader = broker");
ok(B.bppKeyOf({ plot_id: P1, reader: "investor" }) !== B.bppKeyOf({ plot_id: P1 }), "investor and broker are separate passports");
ok(B.cleanEntry({ slug: "a", title: "A", reader: "investor", fin: "preliminary", csv: true }).reader === "investor", "cleanEntry keeps the reader");
ok(B.cleanEntry({ slug: "a", title: "A", reader: "evil" }).reader === undefined, "unknown reader dropped");

// ---------- merge: a renamed building (new slug) replaces the old passport for the same plot + reader
{
  const cur = [{ slug: "old-name-3265635", title: "Old", plot_id: P1, date: "2026-11-01" }, { slug: "old-name-3265635-investor", title: "Old", plot_id: P1, reader: "investor", date: "2026-11-01" }, { slug: "u-bora-3466876", title: "U", plot_id: P2, date: "2026-11-02" }];
  const { next, superseded } = B.mergeEntryPlan(cur, { slug: "new-name-3265635", title: "New", plot_id: P1, reader: "broker", date: "2026-11-04" });
  ok(next.length === 3 && !next.some((e) => e.slug === "old-name-3265635"), "old broker passport removed from the index", next);
  ok(next.some((e) => e.slug === "old-name-3265635-investor") && next.some((e) => e.slug === "u-bora-3466876"), "other reader and other plot kept");
  ok(superseded.length === 1 && superseded[0] === "old-name-3265635", "superseded = the old slug only", superseded);
  const same = B.mergeEntryPlan(cur, { slug: "u-bora-3466876", title: "U2", plot_id: P2, date: "2026-11-04" });
  ok(same.superseded.length === 0 && same.next.length === 3, "same slug: overwritten in place, nothing extra deleted");
}

// ---------- putBppEntry deletes the old files and picture from KV
{
  const kv = memKV(Object.assign({ bpp_index: JSON.stringify([{ slug: "old-3265635", title: "Old", plot_id: P1, date: "2026-11-01" }, { slug: "old-3265635-investor", title: "Old", plot_id: P1, reader: "investor", date: "2026-11-01" }]), bpp_img_old_dummy: "x", bpp_logo_png: "L" },
    files("old-3265635"), files("old-3265635-investor"), files("new-3265635"), { "bpp_img_old-3265635": "jpg" }));
  const env = { MEETINGS: kv };
  await B.putBppEntry(env, { slug: "new-3265635", title: "New", plot_id: P1, date: "2026-11-04", html: true, pdf: true, reader: "broker" });
  ok(["_html", "_pdf", "_csv"].every((x) => !kv.m.has("bpp_file_old-3265635" + x)) && !kv.m.has("bpp_photo_old-3265635") && !kv.m.has("bpp_img_old-3265635"), "old broker files + picture deleted");
  ok(["_html", "_pdf", "_csv"].every((x) => kv.m.has("bpp_file_new-3265635" + x)), "new files kept");
  ok(kv.m.has("bpp_file_old-3265635-investor_pdf"), "investor passport for the same plot untouched");
  ok(kv.m.has("bpp_logo_png"), "logo untouched");
  const list = await B.readBppIndex(env);
  ok(list.length === 2 && list.some((e) => e.slug === "new-3265635"), "Passports made shows only the current ones", list);
}

// ---------- readBppIndex hides stored duplicates (before the cleanup has run)
{
  const env = { MEETINGS: memKV({ bpp_index: JSON.stringify([{ slug: "a-1", title: "A", plot_id: P1, date: "2026-11-01" }, { slug: "a-2", title: "A", plot_id: P1, date: "2026-11-03" }, { slug: "x", title: "No plot", date: "2026-10-01" }]) }) };
  const l = await B.readBppIndex(env);
  ok(l.length === 2 && l.some((e) => e.slug === "a-2") && !l.some((e) => e.slug === "a-1"), "newest per plot shown", l);
}

// ---------- dropOldJobs: finished jobs for the same plot + reader go; running ones and other readers stay
{
  const reqs = { aaaaaa1: { id: "aaaaaa1", plot_id: P1, status: "done", reader: "broker" }, aaaaaa2: { id: "aaaaaa2", plot_id: P1, status: "writing", reader: "broker" },
    aaaaaa3: { id: "aaaaaa3", plot_id: P1, status: "done", reader_used: "investor" }, aaaaaa4: { id: "aaaaaa4", plot_id: P1, status: "done", reader_used: "broker" }, aaaaaa5: { id: "aaaaaa5", plot_id: P2, status: "failed" } };
  const init = { bpp_requests: JSON.stringify(Object.keys(reqs)) }; for (const k in reqs) init["bpp_req_" + k] = JSON.stringify(reqs[k]);
  const kv = memKV(init);
  const d = await B.dropOldJobs({ MEETINGS: kv }, "aaaaaa4", P1, "broker");
  ok(d.length === 1 && d[0] === "aaaaaa1" && !kv.m.has("bpp_req_aaaaaa1"), "older finished broker job deleted", d);
  ok(kv.m.has("bpp_req_aaaaaa2") && kv.m.has("bpp_req_aaaaaa3") && kv.m.has("bpp_req_aaaaaa4") && kv.m.has("bpp_req_aaaaaa5"), "running, other-reader, current and other-plot jobs kept");
  ok(!JSON.parse(kv.m.get("bpp_requests")).includes("aaaaaa1"), "removed from bpp_requests");
}

// ---------- one-off cleanup: dry run by default, deletes only when confirmed
{
  const idx = [{ slug: "a-1", title: "A", plot_id: P1, date: "2026-11-01" }, { slug: "a-2", title: "A", plot_id: P1, date: "2026-11-03" }, { slug: "b", title: "B", plot_id: P2, date: "2026-11-02" }];
  const init = Object.assign({ bpp_index: JSON.stringify(idx), bpp_logo_png: "L", bpp_requests: JSON.stringify(["j000001", "j000002"]),
    bpp_req_j000001: JSON.stringify({ id: "j000001", plot_id: P1, status: "done", at: "2026-11-01T00:00:00Z" }), bpp_req_j000002: JSON.stringify({ id: "j000002", plot_id: P1, status: "done", at: "2026-11-03T00:00:00Z" }) },
    files("a-1"), files("a-2"), files("b"), { "bpp_file_orphan-9_pdf": "%PDF" });
  const kv = memKV(init), env = { MEETINGS: kv };
  const plan = B.bppCleanupPlan(idx, [JSON.parse(init.bpp_req_j000001), JSON.parse(init.bpp_req_j000002)], [...kv.m.keys()].filter((k) => k.startsWith("bpp_file_")));
  ok(plan.keys.includes("bpp_file_a-1_pdf") && plan.keys.includes("bpp_photo_a-1") && plan.keys.includes("bpp_file_orphan-9_pdf") && plan.keys.includes("bpp_req_j000001"), "plan: old passport, orphan file, old job", plan.keys);
  ok(!plan.keys.some((k) => /a-2|_b_|bpp_file_b_|j000002|logo/.test(k)), "plan never touches the current ones or the logo", plan.keys);
  const before = kv.m.size;
  const dry = await B.bppCleanup(env);
  ok(dry.dry_run && dry.would_delete === plan.keys.length && kv.m.size === before, "dry run deletes nothing", dry);
  const wrong = await B.bppCleanup(env, "yes");
  ok(wrong.dry_run && kv.m.size === before, "wrong confirm = still a dry run");
  const real = await B.bppCleanup(env, B.BPP_CLEANUP_CONFIRM);
  ok(!real.dry_run && plan.keys.every((k) => !kv.m.has(k)) && kv.m.has("bpp_file_a-2_pdf") && kv.m.has("bpp_logo_png"), "confirmed run deletes exactly the plan", real);
  ok(JSON.parse(kv.m.get("bpp_index")).length === 2 && JSON.parse(kv.m.get("bpp_requests")).join() === "j000002", "index and request list rewritten");
}

// ---------- the admin action is Kendall-only and wired in
{
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../src/building_passports.js", import.meta.url), "utf8");
  ok(/b\.op === "cleanup"\) return who === "kendall"/.test(src), "cleanup op guarded to Kendall");
  ok(/dropOldJobs\(env, id, r\.plot_id/.test(src), "bppTick drops older jobs after a passport is made");
}

console.log("v728 passport retention:", pass, "passed,", fail, "failed");
if (fail) process.exit(1);
