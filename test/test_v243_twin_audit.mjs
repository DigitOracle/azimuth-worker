// v243 — THE MODEL IS CHECKED AGAINST THE REGISTER, NOT AGAINST ITSELF (Kendall, 22 Sep 2026).
//
// The CityEngine pipeline shipped 202.6 MB of a 357.1 MB export — CityEngine splits an oversized GLTF into _0/_1/_2 and only
// _0 was opened — and reported 54 of 654 buildings as the whole district, with zero failures. It passed every eye test.
//
// Nothing downstream could catch it. The twin matches anchors to meshes BY POSITION, so a building that is not in the model
// is not an error: it is an anchor that finds nothing within 12 m and quietly owns no geometry. The district still renders.
// And the pipeline's own gates can only compare the file against itself, which is the weakest kind of check there is — the
// same failure family as a gate measured against a corrupted reference, and as a percentile computed over nine sales.
//
// So this compares the PUBLISHED model against an expectation it had no part in making: the anchors, which come from the
// registers. Fewer meshes than buildings is the shape of a truncated export. More is normal — a banded tower is several
// meshes — so the check is deliberately one-directional.
import worker from "../src/index.js";
import { gzipSync } from "node:zlib";

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("ok - " + m); } else { fail++; console.log("not ok - " + m); } };
globalThis.fetch = async () => new Response("{}", { status: 200 });
const READ = "owner_admin_key_never_in_client_links_0001";

// a minimal but real GLB: 12-byte header, then a JSON chunk
const glb = (meshCount) => {
  const json = JSON.stringify({ asset: { version: "2.0" }, meshes: Array.from({ length: meshCount }, (_, i) => ({ name: "b" + i })), nodes: Array.from({ length: meshCount }, () => ({})) });
  const jb = Buffer.from(json + " ".repeat((4 - (Buffer.byteLength(json) % 4)) % 4), "utf8");
  const out = Buffer.alloc(12 + 8 + jb.length);
  out.write("glTF", 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(jb.length, 12); out.writeUInt32LE(0x4E4F534A, 16); jb.copy(out, 20);
  return out;
};

const store = new Map();
const put = (slug, meshes, anchors) => {
  store.set("img_sky_" + slug, gzipSync(glb(meshes)).buffer);
  store.set("img_anchors_" + slug, JSON.stringify({ anchors: Array.from({ length: anchors }, (_, i) => ({ i })) }));
};
put("whole", 900, 654);        // a healthy district: more meshes than buildings, because a banded tower is several
put("truncated", 54, 654);     // the real defect, at the real numbers
put("noanchors", 10, 0);
store.set("img_sky_notaglb", gzipSync(Buffer.from("this is not a model at all")).buffer);

const KV = {
  async get(k, t) { if (!store.has(k)) return null; const v = store.get(k); return t === "json" ? JSON.parse(v) : v; },
  async put(k, v) { store.set(k, v); }, async delete(k) { store.delete(k); },
  async list(o) { return { keys: [...store.keys()].filter((k) => !o || !o.prefix || k.startsWith(o.prefix)).map((name) => ({ name })), list_complete: true }; },
};
const env = { MEETINGS: KV, READ_KEY: READ, PUBLIC_ORIGIN: "https://x" };
const call = async (p) => { const r = await worker.fetch(new Request("https://x" + p), env, { waitUntil() {} }); return { status: r.status, body: await r.text() }; };

const un = await call("/twin_audit");
ok(un.status === 401, "the audit is owner-only: " + un.status);

const r = await call("/twin_audit?key=" + READ);
ok(r.status === 200, "it answers the owner: " + r.status);
const j = JSON.parse(r.body);
const by = Object.fromEntries(j.districts.map((d) => [d.district, d]));

ok(by.whole && by.whole.meshes === 900 && by.whole.anchors === 654, "it reads the mesh count out of the GLB's own JSON chunk: " + JSON.stringify(by.whole && { m: by.whole.meshes, a: by.whole.anchors }));
ok(by.whole && !by.whole.SHORT, "a whole district is not flagged - more meshes than buildings is normal, not a fault");
ok(by.truncated && by.truncated.SHORT, "THE DEFECT IS CAUGHT: " + (by.truncated && by.truncated.SHORT));
ok(by.truncated && by.truncated.ratio < 0.1, "and its ratio shows how far short it fell: " + (by.truncated && by.truncated.ratio));
ok(by.notaglb && by.notaglb.error, "a model that is not a GLB is reported rather than skipped: " + (by.notaglb && by.notaglb.error));
ok(by.noanchors && !by.noanchors.SHORT, "a district with no anchors makes no claim either way - nothing to compare against");
ok(j.short === 2, "the summary counts what needs a human: " + j.short + " of " + j.checked);

// The threshold is a dial, and the default must not be so loose that the real case slips through it.
const loose = JSON.parse((await call("/twin_audit?key=" + READ + "&min=0.01")).body);
ok(!loose.districts.find((d) => d.district === "truncated").SHORT, "the threshold is honoured when it is deliberately loosened");
const one = JSON.parse((await call("/twin_audit?key=" + READ + "&d=truncated")).body);
ok(one.checked === 1 && one.districts[0].district === "truncated", "and one district can be checked on its own: " + one.checked);

console.log("\n" + pass + " passed, " + fail + " failed");
if (fail) process.exit(1);
