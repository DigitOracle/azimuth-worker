"""A building must be openable even when its floors cannot be drawn on it, and the plans must be reachable without leaving the
page (Kendall, 21 Sep 2026, on SLS Dubai: "how do i see the floor plans? and the building is not clickeable?").

SLS Dubai's footprint stands 30 m against a 77-level register building, so the podium guard refuses to cut floors into it - and
with no bands there is nothing to tap, which left the page a dead end. Two fixes:

  FLOORS, in the filter panel   every floor of the building, always, whether or not the model could be cut. Choosing one opens
                                the same floor card - plate, flats, types - that tapping a band opens.
  the plans, in a lightbox      the project's floor plans open over the page instead of in a new tab, which a phone and a screen
                                recording can both follow, and the floor card links to them.
"""
import io, os

P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "building_page.js")
s = io.open(P, encoding="utf-8").read()


def sub(old, new):
    global s
    assert s.count(old) == 1, old[:70]
    s = s.replace(old, new)


# --- the panel gains a floor picker, and the plans a button -------------------------------------------------------------
sub("""      '<button id=hide>Hide All</button>' +""",
    """      '<button id=hide>Hide All</button>' +
      '<div class=grp>Floors <u>' + D.floors.length + ' levels</u></div><select id=fpick class=fsel2><option value="">choose a floor…</option>' +
      D.floors.map((g, k) => '<option value="' + k + '">' + esc(g.n != null ? "Floor " + g.n : (g.l === "G" ? "Ground floor" : g.l)) +
        (g.k ? " · " + g.k + " homes" : " · " + esc({ homes: "homes", office: "offices", retail: "retail", hotel: "hotel", services: "services and parking" }[g.u] || g.u)) +
        "</option>").join("") + "</select>" +
      (D.plans ? '<button id=plansbtn>The plans · ' + D.plans.plans.length + "</button>" : "") +""")

sub("""  document.querySelectorAll("[data-d]").forEach((b) => {""",
    """  const fp = $("fpick");
  if (fp) fp.onchange = () => { if (fp.value === "") return; state.sel = -1; pick(+fp.value); };
  const pb = $("plansbtn");
  if (pb) pb.onclick = () => plansCard();
  document.querySelectorAll("[data-d]").forEach((b) => {""")

# --- the plans, in the card and in a lightbox ----------------------------------------------------------------------------
sub("""  function pick(j) {""",
    """  // the project's plans, over the page rather than in a tab a phone cannot follow
  function plansCard() {
    if (!D.plans) return;
    open_('<div class=t>' + esc(D.plans.project) + "</div><h2>The plans</h2>" +
      '<div class=plans>' + D.plans.plans.map((p, i) => '<a data-p="' + i + '"><img loading=lazy src="' + esc(p.url) + '" alt="' +
        esc(p.label) + '"><b>' + esc(p.label) + "</b></a>").join("") + "</div>" +
      '<div class=src>' + (D.plans.note ? esc(D.plans.note) + ". " : "") +
      "Developer material from the app's plan library; each plan names its source on the PLANS page.</div>");
    const c = $("card");
    c.querySelectorAll("[data-p]").forEach((a) => { a.onclick = () => lightbox(D.plans.plans[+a.dataset.p]); });
  }
  function lightbox(p) {
    let lb = $("lbx");
    if (!lb) { lb = document.createElement("div"); lb.id = "lbx"; document.body.appendChild(lb); }
    lb.innerHTML = '<span class=x>&times;</span><img src="' + esc(p.url) + '" alt="' + esc(p.label) + '"><b>' + esc(p.label) + "</b>";
    lb.style.display = "flex";
    lb.onclick = () => { lb.style.display = "none"; };
  }

  function pick(j) {""")

# the floor card points at them too
sub("""      '<a class=c href="/find?key=' + encodeURIComponent(KEY) + "&q=" + encodeURIComponent(D.name) + '">Look it up in Find</a></div>');""",
    """      (D.plans ? '<a class=c id=flplans>The plans</a>' : '<a class=c href="/find?key=' + encodeURIComponent(KEY) + "&q=" + encodeURIComponent(D.name) + '">Look it up in Find</a>') + "</div>");
    const fl2 = $("flplans");
    if (fl2) fl2.onclick = () => plansCard();""")

# --- chrome ---------------------------------------------------------------------------------------------------------------
sub("#tab{display:none}",
    "#tab{display:none}\n"
    ".fsel2{display:block;width:100%;margin:2px 0 6px;appearance:none;-webkit-appearance:none;background:rgba(12,20,19,.6);"
    "border:1px solid var(--line);border-radius:8px;color:var(--text);font:500 .66rem 'IBM Plex Mono',monospace;padding:7px 10px;cursor:pointer}"
    ".fsel2:hover{border-color:var(--gold)}.fsel2 option{background:#0C1413}\n"
    "#plansbtn{display:block;width:100%;border:1px solid var(--line);border-radius:99px;padding:6px 0;margin-top:8px;background:transparent;"
    "color:var(--gold);font:600 .56rem 'IBM Plex Mono',monospace;letter-spacing:.12em;text-transform:uppercase;cursor:pointer}"
    "#plansbtn:hover{background:rgba(197,165,106,.12)}\n"
    "#lbx{position:fixed;inset:0;z-index:20;display:none;align-items:center;justify-content:center;flex-direction:column;gap:10px;"
    "background:rgba(6,10,10,.92);cursor:zoom-out;padding:24px}"
    "#lbx img{max-width:min(92vw,1100px);max-height:80vh;object-fit:contain;background:#F6F3EC;border-radius:10px}"
    "#lbx b{font:600 .62rem 'IBM Plex Mono',monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--gold)}"
    "#lbx .x{position:absolute;right:20px;top:14px;font-size:1.6rem;color:var(--mut)}")

io.open(P, "w", encoding="utf-8", newline="").write(s)
print("floor picker and plans lightbox in:", len(s), "chars")
