"""The dossier, with the ways to actually hand it over: download, WhatsApp, email, QR (Kendall, 22 Sep 2026: "where is the
detailed .pdf inside of that to have the option to download or whatsapp or email or QR code it?").

v214 put a link to the dossier at the top of the About the building card. A link is not a handover. In a meeting the useful
actions are: keep it, send it on WhatsApp, send it by email, or put it on screen as a code the person opposite scans with
their own phone.

THE PART THAT MATTERS MORE THAN THE FEATURE: a shared link must never carry the owner key. Kendall browses with it - it is in
his address bar in every screenshot this week - so a WhatsApp share built from the page's own key would hand his owner key to
whoever he sent it to. The worker therefore passes the CLIENT key down for sharing, whatever key opened the page, and every
share action uses that one. Download uses the page's own key, because that file stays on his machine.

The QR is rendered in the browser by a small encoder from the CDN the page already uses for three.js, fetched only when the QR
is asked for. The link is never handed to a third party to be turned into a picture.

  python scripts/v220_dossier_actions.py
"""
import io, os

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NL = chr(10)


def sub(s, old, new, where):
    assert s.count(old) == 1, (where, s.count(old))
    return s.replace(old, new)


# --- the worker hands the page a key that is safe to share -------------------------------------------------------------------
P = os.path.join(HERE, "src", "index.js")
s = io.open(P, encoding="utf-8").read()
s = sub(s,
        '          if (_dm && _dm.bytes) _bd.dossier = { slug: "b_" + _bs + "_" + _bi, pages: _dm.pages || 0, at: _dm.built_at || "" };',
        '          if (_dm && _dm.bytes) _bd.dossier = { slug: "b_" + _bs + "_" + _bi, pages: _dm.pages || 0, at: _dm.built_at || "" };' + NL
        + '          // what a shared link may carry. NEVER the key that opened this page: the owner browses with READ_KEY and a' + NL
        + '          // WhatsApp share built from it would hand the owner key to the recipient.' + NL
        + '          if (_bd.dossier) _bd.shareKey = clientKeysOf(env)[0] || "";',
        "shareKey")
io.open(P, "w", encoding="utf-8", newline="").write(s)
print("index.js:", len(s), "chars")

# --- the card: four ways to hand it over --------------------------------------------------------------------------------------
Q = os.path.join(HERE, "src", "building_page.js")
t = io.open(Q, encoding="utf-8").read()

OLD = ("""      (D.dossier ? '<a class=dossier target=_blank rel=noopener href="/sheet/' + esc(D.dossier.slug) + ".pdf?key=" + K +"""
       + NL +
       """        '"><b>The dossier</b><span>everything on this page as a PDF' + (D.dossier.pages ? " \\u00b7 " + D.dossier.pages + " pages" : "") +"""
       + NL + """        "</span></a>" : "") +""")
t = sub(t, OLD, """      (D.dossier ? dossierBlock() : "") +""", "card block")

NEWLINE_JS = chr(92) + "n"          # the two characters backslash-n, for inside a JS string
MIDDOT_JS = chr(92) + "u00b7"

HELPERS = '''  // The dossier and the four ways to hand it over. Share links carry the CLIENT key the worker passed down, never the key
  // that opened this page - the owner browses with his own and must not post it into WhatsApp.
  function dossierUrl(share) {
    const k = share ? (D.shareKey || "") : K;
    return location.origin + "/sheet/" + encodeURIComponent(D.dossier.slug) + ".pdf" + (k ? "?key=" + encodeURIComponent(k) : "");
  }
  function dossierBlock() {
    const pp = D.dossier.pages ? " @MIDDOT@ " + D.dossier.pages + " pages" : "";
    const can = !!D.shareKey;
    return '<div class=dossier><div class=dh><b>The dossier</b><span>everything on this page as a PDF' + pp + "</span></div>" +
      '<div class=dacts>' +
      '<a class=da target=_blank rel=noopener href="' + esc(dossierUrl(false)) + '" download>Download</a>' +
      (can ? '<a class=da id=dwa>WhatsApp</a><a class=da id=dmail>Email</a><a class=da id=dqr>QR code</a>' :
        '<span class=dnote>sharing needs a client key on this worker</span>') + "</div></div>";
  }
  function wireDossier() {
    if (!D.dossier || !D.shareKey) return;
    const u = dossierUrl(true), line = D.name + (D.district ? ", " + D.district : "") + " - the building in full";
    const wa = $("dwa");
    if (wa) { wa.href = "https://wa.me/?text=" + encodeURIComponent(line + "@NL@" + u); wa.target = "_blank"; wa.rel = "noopener"; }
    const em = $("dmail");
    if (em) em.href = "mailto:?subject=" + encodeURIComponent(line) + "&body=" + encodeURIComponent(line + "@NL@@NL@" + u);
    const qr = $("dqr");
    if (qr) qr.onclick = () => showQR(u, line);
  }
  // rendered here, in the browser: the link is never handed to a third party to be turned into a picture
  function showQR(url, label) {
    const draw = () => {
      const q = window.qrcode(0, "M"); q.addData(url); q.make();
      let lb = $("lbx");
      if (!lb) { lb = document.createElement("div"); lb.id = "lbx"; document.body.appendChild(lb); }
      lb.innerHTML = '<div class=qrw>' + q.createSvgTag({ cellSize: 6, margin: 4, scalable: true }) + "</div><b>" + esc(label) +
        '</b><span class=qrn>scan to open the dossier</span>';
      lb.style.display = "flex";
      lb.onclick = () => { lb.style.display = "none"; };
    };
    if (window.qrcode) return draw();
    const sc = document.createElement("script");
    sc.src = "https://unpkg.com/qrcode-generator@1.4.4/qrcode.js";
    sc.onload = draw;
    sc.onerror = () => { const l = $("dqr"); if (l) l.textContent = "QR needs a connection"; };
    document.head.appendChild(sc);
  }

  $("about").onclick = () => {'''.replace("@NL@", NEWLINE_JS).replace("@MIDDOT@", MIDDOT_JS)

t = sub(t, '  $("about").onclick = () => {', HELPERS, "helpers")
t = sub(t, '    const fl2 = $("flplans");', '    wireDossier();' + NL + '    const fl2 = $("flplans");', "wire")

OLD4 = """.dossier{display:flex;align-items:baseline;gap:8px;margin:10px 0 2px;padding:9px 12px;border:1px solid var(--gold);
border-radius:10px;background:rgba(197,165,106,.12);text-decoration:none;color:var(--gold)}
.dossier:hover{background:rgba(197,165,106,.22)}
.dossier b{font:600 .62rem 'IBM Plex Mono',monospace;letter-spacing:.12em;text-transform:uppercase}
.dossier span{font:400 .56rem 'IBM Plex Mono',monospace;color:var(--mut)}"""
NEW4 = """.dossier{margin:10px 0 2px;padding:9px 12px;border:1px solid var(--gold);border-radius:10px;background:rgba(197,165,106,.1)}
.dossier .dh{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.dossier b{font:600 .62rem 'IBM Plex Mono',monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--gold)}
.dossier .dh span{font:400 .56rem 'IBM Plex Mono',monospace;color:var(--mut)}
.dacts{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.da{flex:1 1 auto;min-width:78px;text-align:center;padding:7px 10px;border:1px solid var(--line);border-radius:8px;cursor:pointer;
text-decoration:none;color:var(--text);font:600 .54rem 'IBM Plex Mono',monospace;letter-spacing:.1em;text-transform:uppercase}
.da:hover{border-color:var(--gold);color:var(--gold);background:rgba(197,165,106,.12)}
.dnote{font:400 .5rem 'IBM Plex Mono',monospace;color:var(--mut)}
.qrw{background:#F6F3EC;padding:10px;border-radius:10px}.qrw svg{display:block;width:min(62vw,300px);height:auto}
.qrn{font:400 .54rem 'IBM Plex Mono',monospace;color:var(--mut)}"""
t = sub(t, OLD4, NEW4, "css")

io.open(Q, "w", encoding="utf-8", newline="").write(t)
print("building_page.js:", len(t), "chars")
