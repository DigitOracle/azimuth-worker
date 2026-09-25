"""The filters panel covers the building on a phone and there is no way to get rid of it.

Kendall, 25 Sep 2026: "this card should be able to have an accordion or an X. Because for now, when it's on the
mobile, it blocks everything. So need to be able to get rid of it if I need to."

He is describing a real dead end. On a phone the panel is `left:10px; right:10px; bottom:10px; max-height:46vh` —
nearly half the screen, pinned over the model, and nothing dismisses it. A #tab toggle exists at line 625 and has
been `display:none` since it was written, so the control was built and never shown. The building you came to look at
is behind the thing describing it.

WHAT THIS ADDS, both of them because they are different needs:

  * **an accordion.** Tap the header and the body folds away, leaving the title bar and the count. That is the common
    case - look at the tower for a moment, then carry on filtering - and it keeps the reader's place, their type
    chips, their size range, everything.
  * **an X.** Dismisses the panel completely and leaves a small FILTERS pill in the corner to bring it back. For when
    the panel is not wanted at all rather than momentarily in the way.

Collapsed is not dismissed, and conflating them is how a UI ends up with one control that does neither well: a
collapse that hides your filters loses your place, and a dismiss that leaves a header bar still covers the model.

THE STATE PERSISTS FOR THE SESSION, per building, in sessionStorage. Someone who folds the panel away to look at a
tower does not want it unfolding again when they open the next floor. Every read and write is wrapped, because
sessionStorage throws in a private window and the panel must open regardless - a control that fails closed would
reproduce the bug it fixes.

THE CARET IS NOT A DECORATION. It points down when the panel is open and right when it is folded, which is the only
part of a collapsed header that says it can be reopened.

  python scripts/v253_panel_collapses_and_closes.py
"""
import io
import os

P = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "building_page.js")
s = io.open(P, encoding="utf-8").read()

if "panelfold" in s:
    print("already applied")
    raise SystemExit(0)


def sub(old, new, where):
    global s
    assert s.count(old) == 1, (where, s.count(old))
    s = s.replace(old, new)


# 1. the header gets a fold caret and a close, and the body becomes a wrappable element
sub("""    '<div id=panel class=glass>' +
      "<h1>FILTERS</h1><div id=count></div>" +""",
    """    '<div id=reopen>FILTERS</div>' +
    '<div id=panel class=glass>' +
      '<div id=phead><h1>FILTERS</h1><span id=panelfold title="Fold">\\u2304</span>' +
      '<span id=panelx title="Close">\\u00d7</span></div>' +
      '<div id=pbody>' +
      "<div id=count></div>" +""",
    "header")

# 2. close the body div at the end of the panel's content
sub("""        'this building page nor anyone reading it can tell from here whether a particular home is available.</div>' : "") +
    "</div>" +
    "<div id=card></div>" +""",
    """        'this building page nor anyone reading it can tell from here whether a particular home is available.</div>' : "") +
      '</div>' +   // #pbody - everything above folds away, the header bar stays
    "</div>" +
    "<div id=card></div>" +""",
    "body close")

# 3. styles
sub("""#tab{display:none}""",
    """#tab{display:none}
#phead{display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none}
#phead h1{flex:1}
#panelfold,#panelx{color:var(--gold);opacity:.72;font-size:.95rem;line-height:1;padding:2px 4px;border-radius:4px}
#panelfold{transition:transform .18s ease}
#panel.folded #panelfold{transform:rotate(-90deg)}
#panel.folded #pbody{display:none}
#panel.folded{max-height:none}
#panelx{font-size:1.15rem}
#panelfold:hover,#panelx:hover{opacity:1;background:rgba(197,165,106,.14)}
#reopen{display:none;position:fixed;right:14px;top:62px;z-index:4;cursor:pointer;
  background:rgba(20,26,24,.9);border:1px solid rgba(197,165,106,.35);color:var(--gold);
  padding:7px 12px;border-radius:7px;font-size:.6rem;font-weight:600;letter-spacing:.14em}
#reopen.on{display:block}""",
    "styles")

# 4. the mobile rule has to let a folded panel shrink, or it keeps its 46vh and still covers the tower
sub("""@media(max-width:820px){#title{position:static;transform:none;max-width:none;padding:44px 14px 0}#title b{font-size:1.05rem}#panel{left:10px;right:10px;width:auto;top:auto;bottom:10px;max-height:46vh}""",
    """@media(max-width:820px){#title{position:static;transform:none;max-width:none;padding:44px 14px 0}#title b{font-size:1.05rem}#panel{left:10px;right:10px;width:auto;top:auto;bottom:10px;max-height:46vh}#panel.folded{max-height:none}#reopen{right:10px;top:auto;bottom:10px}""",
    "mobile")

# 5. behaviour
sub("""  $("tab").onclick = () => { const p = $("panel"); p.style.display = p.style.display === "none" ? "" : "none"; };""",
    """  $("tab").onclick = () => { const p = $("panel"); p.style.display = p.style.display === "none" ? "" : "none"; };
  // Folded and closed are different needs and get different controls. Folding keeps every filter the reader has set
  // and gives back the screen; closing gets rid of the panel entirely and leaves a pill to bring it back.
  {
    const p = $("panel"), ro = $("reopen"), PKEY = "najpanel:" + D.slug + ":" + D.id;
    const save = (v) => { try { sessionStorage.setItem(PKEY, v); } catch (e) {} };
    const show = (st) => {
      p.classList.toggle("folded", st === "folded");
      p.style.display = st === "closed" ? "none" : "";
      ro.classList.toggle("on", st === "closed");
    };
    let st = "open";
    try { st = sessionStorage.getItem(PKEY) || "open"; } catch (e) {}   // a private window throws; the panel still opens
    show(st);
    $("phead").onclick = (e) => {
      if (e.target && e.target.id === "panelx") return;              // the X has its own job
      st = st === "folded" ? "open" : "folded"; show(st); save(st);
    };
    $("panelx").onclick = (e) => { e.stopPropagation(); st = "closed"; show(st); save(st); };
    ro.onclick = () => { st = "open"; show(st); save(st); };
  }""",
    "behaviour")

io.open(P, "w", encoding="utf-8", newline="").write(s)
print("the panel folds and closes:", len(s), "chars")
