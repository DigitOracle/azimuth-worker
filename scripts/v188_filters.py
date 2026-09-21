"""v188 - the four filters Kendall picked on 20 Sep 2026: unblocked view (which sides a floor sees over), homes per floor,
price per sq ft, and who lives in the surrounding community."""
import io, os

P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "building_page.js")
s = io.open(P, encoding="utf-8").read()


def sub(old, new, n=1):
    global s
    assert s.count(old) == n, (old[:70], s.count(old))
    s = s.replace(old, new)


# ---- the data the page is given -------------------------------------------------------------------------------------------
sub("export function buildingData(slug, id, stack, umx, bf, anchors) {",
    "export function buildingData(slug, id, stack, umx, bf, anchors, people) {")

sub("""    register: (r.types || []),""", """    register: (r.types || []),""", 0) if False else None

sub("""    sheet: r.sheet || null, generated: stack.generated, asOf: (stack.sources || [])[0] || "",""",
    """    sheet: r.sheet || null, generated: stack.generated, asOf: (stack.sources || [])[0] || "",
    open: r.open || null, openFrom: r.open_from || null, openRadius: r.open_radius || 0,
    people: communityMix(people, stack.district || slug),""")

sub("// ---- the page -------",
    """// The community's resident mix (DEWA register, per community only). Kendall's decision of 17 Sep 2026 allows it on a
// client-facing surface; the size floors in the data are disclosure control and are not touched here. It is context about an
// area, never a reason to choose one - the card says so.
function communityMix(people, slug) {
  const norm = (x) => String(x || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const want = norm(slug);
  const c = ((people && people.communities) || []).find((x) => [x.name, x.label, x.official].concat(x.known || []).some((n) => norm(n) === want));
  if (!c || !c.mix || !c.mix.length) return null;
  return { label: c.label || c.official || c.name, accounts: c.accounts || null, unknown: c.noNationalityPct || 0,
    mix: c.mix.slice(0, 7), other: c.other || 0, floor: (people.rules && people.rules.minSharePct) || 5 };
}

// ---- the page -------""")

# ---- the panel: the new controls ------------------------------------------------------------------------------------------
sub("""      '<div class=sz>Size <u>SQ.FT</u></div><div class=range><div class=track></div><input id=lo type=range><input id=hi type=range></div>' +
      '<div class=vals><span id=vlo></span><span id=vhi></span></div>' +""",
    """      '<div class=grp>Size <u id=vhi></u></div><div class=range><div class=track></div><input id=lo type=range><input id=hi type=range></div>' +
      '<div class=vals><span id=vlo></span><span>sq ft</span></div>' +
      '<div class=grp>Price <u id=vphi></u></div><div class=range><div class=track></div><input id=plo type=range><input id=phi type=range></div>' +
      '<div class=vals><span id=vplo></span><span>per sq ft</span></div>' +
      '<div class=grp>Homes on the floor <u id=vkhi></u></div><div class=range><div class=track></div><input id=khi type=range></div>' +
      (D.open ? '<div class=grp>Open view <u>sees over the roofs</u></div><div id=dirs>' +
        ["N", "NE", "E", "SE", "S", "SW", "W", "NW"].map((x, k) => '<button class="tb dir off" data-d="' + k + '">' + x + "</button>").join("") + "</div>" : "") +""")

# ---- the client: state, matching, cards ------------------------------------------------------------------------------------
sub("""  const state = { on: new Set(), use: new Set(), lo: 0, hi: 1e9, sel: -1 };""",
    """  const state = { on: new Set(), use: new Set(), lo: 0, hi: 1e9, plo: 0, phi: 1e9, khi: 1e9, dirs: new Set(), sel: -1 };""")

sub("""  const typesOn = (f) => (f.t || []).map((i) => D.types[i]).filter((t) => t && state.on.has(t.c) &&
    (!sqft(t) || (sqft(t) >= state.lo && sqft(t) <= state.hi)));""",
    """  const psf = (t) => (t.aed && t.sqm ? t.aed / (t.sqm * 10.764) : null);
  const typesOn = (f) => (f.t || []).map((i) => D.types[i]).filter((t) => t && state.on.has(t.c) &&
    (!sqft(t) || (sqft(t) >= state.lo && sqft(t) <= state.hi)) &&
    (!psf(t) || (psf(t) >= state.plo && psf(t) <= state.phi)));
  // which sides this floor sees over, from the massing of every neighbour within the radius
  const DIRN = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const openOf = (j) => (D.open && D.open[j] != null ? D.open[j] : null);
  const openDirs = (j) => { const m = openOf(j); return m == null ? [] : DIRN.filter((_d, k) => m & (1 << k)); };
  const dirOk = (j) => { if (!state.dirs.size) return true; const m = openOf(j); if (m == null) return false;
    for (const k of state.dirs) if (!(m & (1 << k))) return false; return true; };""")

sub("""  const match = (f) => (state.use.has(f.u) ? { c: f.u } : (isHome(f) ? typesOn(f)[0] || null : null));""",
    """  const match = (f, j) => {
    if (!dirOk(j)) return null;
    if ((f.k || 0) > state.khi) return null;
    return state.use.has(f.u) ? { c: f.u } : (isHome(f) ? typesOn(f)[0] || null : null);
  };""")

sub("""    const m = match(f);""", """    const m = match(f, j);""")
sub("""    floors.forEach((f) => { if (match(f)) { n++; homes += f.k || 0; } });""",
    """    floors.forEach((f, j) => { if (match(f, j)) { n++; homes += f.k || 0; } });""")

# the new sliders
sub("""  vals();
  function hideLabel()""",
    """  vals();
  // price per sq ft, from the register's median price and median size for each type
  const psfAll = D.register.map((t) => (t.median && t.sqm ? t.median / (t.sqm * 10.764) : null)).filter((x) => x);
  const pmax = psfAll.length ? Math.ceil(Math.max.apply(null, psfAll) / 100) * 100 : 5000;
  state.phi = pmax;
  const plo = $("plo"), phi = $("phi");
  [plo, phi].forEach((e) => { e.min = 0; e.max = pmax; e.step = 25; });
  plo.value = 0; phi.value = pmax;
  const pvals = () => { $("vplo").textContent = "AED " + Math.round(state.plo).toLocaleString("en"); $("vphi").textContent = state.phi >= pmax ? "any" : "to AED " + Math.round(state.phi).toLocaleString("en"); };
  plo.oninput = () => { state.plo = Math.min(+plo.value, +phi.value - 25); plo.value = state.plo; pvals(); paint(); };
  phi.oninput = () => { state.phi = Math.max(+phi.value, +plo.value + 25); phi.value = state.phi; pvals(); paint(); };
  pvals();
  // homes on the floor: the register's count for that floor, which is the question nobody else can answer
  const kmax = Math.max.apply(null, floors.map((f) => f.k || 0).concat([1]));
  state.khi = kmax;
  const khi = $("khi");
  khi.min = 1; khi.max = kmax; khi.step = 1; khi.value = kmax;
  const kvals = () => { $("vkhi").textContent = state.khi >= kmax ? "any" : "at most " + state.khi; };
  khi.oninput = () => { state.khi = +khi.value; kvals(); paint(); };
  kvals();
  document.querySelectorAll("[data-d]").forEach((b) => { b.onclick = () => { const k = +b.dataset.d; state.dirs.has(k) ? state.dirs.delete(k) : state.dirs.add(k); b.classList.toggle("off", !state.dirs.has(k)); paint(); }; });
  function hideLabel()""")

# the floor card says which sides it sees over
sub("""      "<dt>Level</dt><dd>" + esc(f.l) + " of " + N + "</dd></dl>" +""",
    """      "<dt>Level</dt><dd>" + esc(f.l) + " of " + N + "</dd>" +
      (openOf(j) != null ? "<dt>Sees over the roofs</dt><dd>" + (openDirs(j).length ? openDirs(j).join(" · ") : "no side yet") + "</dd>" : "") + "</dl>" +""")

# the About card: who lives here, and the open-sides summary
sub("""      (D.around.length ? "<h3>Around it</h3>" ""","""      (D.openFrom ? "<h3>What it sees over</h3>" + D.openFrom.map((fl, k) => '<div class=row><span>' + DIRN[k] + "</span><span>" +
        (fl == null ? "blocked at every floor" : fl === 0 ? "open from the ground" : "open from floor " + (floors[fl] ? floors[fl].l : fl)) + "</span></div>").join("") +
        '<div class=src>Measured against every footprint within ' + D.openRadius + " m in this district's model, on flat ground: it says whether a floor looks over the neighbours on that side, not what is beyond them. Buildings outside this district are not counted.</div>" : "") +
      (D.people ? "<h3>Who lives here · " + esc(D.people.label) + "</h3>" + D.people.mix.map((m) => '<div class=row><span>' + esc(m[0]) +
        '<div class=bar><i style="width:' + Math.min(100, m[1] * 2) + '%"></i></div></span><span>' + m[1] + "%</span></div>").join("") +
        (D.people.other ? '<div class=row><span>everyone else</span><span>' + D.people.other + "%</span></div>" : "") +
        '<div class=src>DEWA customer register for the whole community' + (D.people.accounts ? ", " + fmt(D.people.accounts) + " accounts" : "") +
        (D.people.unknown ? ", " + D.people.unknown + "% with no nationality recorded" : "") + ". There is no building-level figure and groups under " +
        D.people.floor + "% are pooled. It is context about an area, not a reason to choose one.</div>" : "") +
      (D.around.length ? "<h3>Around it</h3>" """)

io.open(P, "w", encoding="utf-8", newline="").write(s)
print("v188 filters in:", len(s), "chars")
