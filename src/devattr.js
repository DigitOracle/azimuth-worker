// v325 - DEVELOPER ATTRIBUTION RULES (pure, no I/O). Kendall, 4 Oct 2026: Town Square showed Imtiaz with a project called Symphony; the register says Nshama.
//   WHY it happened: build_coverage_cards.py handed the register project "Symphony" to Imtiaz because a developer-sheet table holds the bare key "symphony" = Imtiaz
//   (their shorthand for Imtiaz Symphony Tower, which is in Bukadra), and the index builder then trusted the card's developer field first. A bare common word is not evidence.
//   WHAT this module decides, for ONE building: its developer, and HOW SURE the page may be.
//     q "v"  VERIFIED   the Land Department register's developer of the building's project_number (g_dld__projects.developer_id), or the same developer the card says
//     q "i"  INFERRED   a name or sheet said so and the register does not contradict it (or cannot tell). The page says "matched by project name".
//     none              developer NOT recorded: a bare common-word name with nothing behind it, or a developer the register contradicts and cannot replace.
//   The register wins over a card, a name table, a price list or a crosswalk entry whenever it names a developer the crosswalk knows as a brand.
import { canonicalOf, isCurated } from "./devcross.js";

// words that name a place or a kind of building, not a developer. A project whose WHOLE name is made of these cannot be told apart by name.
export const COMMON_WORDS = new Set(("symphony marina park tower towers residence residences heights creek bay gate vista horizon sky grand palm beach boulevard central sunset pearl cove " +
  "avenue plaza square views view garden gardens villas villa village hills hill lake lakes island islands harbour harbor point sunrise royal crown emerald diamond golden silver blue sea ocean " +
  "one two three house place residency court terrace oasis city downtown business bayside waterfront skyline summit crest ridge meadows green greens elite prime signature luxury style " +
  "new old north south east west al the by on of at and in building apartments apartment studio suites suite plot block phase").split(" "));
// the register names a land owner or a master-plan vehicle, not the delivery partner: it never replaces a name-based developer and is never a contradiction
export const MASTER_LIKE = new Set(["nakheel", "meydan", "dubai-properties", "dubai-hills-estate"]);

const toks = (s) => String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
export const nameKeyOf = (s) => toks(s).join(" ");
// the looser key the Python side also writes into the register map ("~" + this): Park Ridge Tower C finds PARK RIDGE
export const looseKeyOf = (s) => "~" + toks(s).filter((w) => !/^(by|the|tower|towers|residences?|residence|building|bldg|apartments?)$/.test(w)).join("");
// a name is GENERIC when every token is a common word, a number, or a single letter ("Symphony", "Park Central", "Grand Horizon", "Tower 2")
export function isGenericName(s) {
  const t = toks(s);
  if (!t.length) return true;
  return t.every((w) => COMMON_WORDS.has(w) || /^\d+$/.test(w) || w.length <= 1);
}
// does the name carry the developer's own brand, or "by <brand>"?  ("Imtiaz Symphony Tower", "Wynwood Horizon by Imtiaz", "Binghatti Vintage")
export function brandInName(name, candCanon, candDisplay) {
  if (!candCanon) return false;
  const t = toks(name), n = t.length;
  const m = String(name || "").match(/\bby\s+([A-Za-z][A-Za-z0-9&' .-]{2,40})$/i);
  if (m && canonicalOf(m[1].trim(), "project") === candCanon) return true;
  const brand = toks(candDisplay || candCanon.replace(/-/g, " "));
  if (!brand.length) return false;
  for (let i = 0; i + brand.length <= n; i++) { let ok = true; for (let j = 0; j < brand.length; j++) if (t[i + j] !== brand[j]) { ok = false; break; } if (ok) return true; }
  return false;
}

// decide({names, cand, candDisplay, nameOnly, regd})
//   names      [card name, DLD project, register project] (any may be empty)
//   cand       the developer string the card / name table / price list proposed ("" if none)
//   nameOnly   true when `cand` came from a project NAME match (Ejari list, crosswalk table, price list, "by X" suffix), false when it came from a curated card field
//   regd       the register's answer for this building, or null: {c: canonical id, d: English register name, s: match share 0..1, lo: land-owner entity}
// returns {dev: <string for the slot or "">, q: "v" | "i" | "", why: <rule fired>}
export function decide({ names, cand, candDisplay, nameOnly, regd }) {
  const nm = (names || []).filter(Boolean);
  const cc = cand ? canonicalOf(cand) : "";
  const reg = regd && regd.s >= 0.6 && regd.c ? regd : null;
  if (reg) {
    if (cc && reg.c === cc) return { dev: cand, q: "v", why: "register agrees" };
    if (reg.lo || MASTER_LIKE.has(reg.c)) return cc ? { dev: cand, q: "i", why: "register names a land owner or master-plan company" } : { dev: "", q: "", why: "register names only a land owner" };
    if (isCurated(reg.c)) return { dev: reg.d, q: "v", why: cc ? "register overrides " + cc : "register" };
    // the register names a project company (SPV) the crosswalk does not know as a brand
    if (cc && isCurated(cc) && !nameOnly) return { dev: cand, q: "i", why: "card brand over a register project company" };
    if (cc && isCurated(cc) && nm.some((x) => brandInName(x, cc, candDisplay))) return { dev: cand, q: "i", why: "brand in the project name over a register project company" };
    return { dev: reg.d, q: "v", why: "register project company" };
  }
  if (!cc) return { dev: "", q: "", why: "no candidate" };
  if (nameOnly) {
    if (nm.some((x) => brandInName(x, cc, candDisplay))) return { dev: cand, q: "i", why: "brand in the project name" };
    if (nm.length && nm.every(isGenericName)) return { dev: "", q: "", why: "bare common-word name, nothing else behind it" };
  }
  return { dev: cand, q: "i", why: nameOnly ? "project name match, register silent" : "card developer field, register silent" };
}
