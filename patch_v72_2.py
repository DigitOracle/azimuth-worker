import io
p = "src/index.js"; s = io.open(p, encoding="utf-8").read(); orig = s
def rep(old, new, n=1):
    global s
    c = s.count(old); assert c == n, f"expected {n}, found {c}: {old[:90]!r}"
    s = s.replace(old, new)

# A. helpers + official links, placed just before launchMode
rep("async function launchMode(env, to, briefText, returnOnly) {",
r'''// v72.2 — DEVELOPER TRUST CHECK. Owner decision 2 Sep 2026 (option A): sourced MEED Projects
// counts + the OFFICIAL DLD verification pages, nothing else. Third-party dispute tables (PARCEL etc.)
// are unverifiable, ~15 months stale and a defamation risk — NEVER wired in. Counts are records, not
// a rating; only the DLD register proves licence, escrow and %-complete. All URLs verified live 2 Sep 2026.
const DLD_VERIFY = [
  ["Licensed developers (DLD)", "https://dubailand.gov.ae/en/eservices/approved-real-estate-developers/"],
  ["Project status + escrow (DLD)", "https://dubailand.gov.ae/en/eservices/real-estate-project-status-landing/"],
  ["Licences & permits check (DLD)", "https://dubailand.gov.ae/en/eservices/validate-real-estate-licenses-and-permits/"],
  ["Contractual disputes inquiry (RVS)", "https://dubailand.gov.ae/en/eservices/rvs-contractual-disputes-overview/"],
  ["Approved escrow trustees (DLD)", "https://dubailand.gov.ae/en/eservices/certified-escrow-agents/"],
  ["Dubai REST app — iOS", "https://apps.apple.com/us/app/dubai-rest/id1437805105"],
  ["Dubai REST app — Android", "https://play.google.com/store/apps/details?id=ae.gov.dubailand.selfregistration"],
];
async function devTrust(env, name) {
  let devIndex = []; try { devIndex = JSON.parse((await env.MEETINGS.get("mkt_devindex")) || "[]"); } catch (e) {}
  let asAt = null; try { asAt = await env.MEETINGS.get("mkt_devindex_at"); } catch (e) {}
  const dev = _devMatch(devIndex, name);
  const track = dev ? { name: dev.d, projectsInCorpus: dev.n, completed: dev.complete, underConstruction: dev.construction, cancelled: dev.cancelled, onHold: dev.onhold, activeNow: dev.active, pipelineUsdM: dev.valueUsdM } : null;
  return { asked: String(name || "").trim(), track, asAt: asAt || null, links: DLD_VERIFY };
}
function devTrustText(t) {
  const n = (x) => (x == null ? 0 : x);
  const src = "MEED Projects record" + (t.asAt ? " (snapshot " + String(t.asAt).slice(0, 10) + ")" : " (snapshot, undated)");
  const head = "🛡 Developer trust check — " + (t.track ? t.track.name : t.asked);
  const rec = t.track
    ? src + ": " + n(t.track.projectsInCorpus) + " projects · " + n(t.track.completed) + " completed · " + n(t.track.underConstruction) + " under construction · " + n(t.track.cancelled) + " cancelled · " + n(t.track.onHold) + " on hold" + (t.track.pipelineUsdM ? " · pipeline US$" + Math.round(t.track.pipelineUsdM).toLocaleString("en-US") + "m" : "")
    : src + ": no developer matched “" + t.asked + "” — that alone says nothing either way.";
  const links = t.links.map(l => "• " + l[0] + ": " + l[1]).join("\n");
  return head + "\n" + rec + "\n\nVerify on the official pages before you rely on it:\n" + links + "\n\nCounts are project records, not a rating. Only the DLD register proves licence, escrow and %-complete.";
}
function devTrustHtml(t) {
  const e = (x) => String(x == null ? "" : x).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const n = (x) => (x == null ? 0 : x);
  const rec = t.track
    ? '<div style="font-size:.74rem">' + e(t.track.name) + ' — ' + n(t.track.projectsInCorpus) + ' projects · <b>' + n(t.track.completed) + ' completed</b> · ' + n(t.track.underConstruction) + ' under construction · <b style="color:#E0A090">' + n(t.track.cancelled) + ' cancelled</b> · ' + n(t.track.onHold) + ' on hold</div>'
    : '<div style="font-size:.74rem;color:var(--mut)">no developer matched “' + e(t.asked) + '” in the MEED record — says nothing either way</div>';
  const links = t.links.map(l => '<a href="' + e(l[1]) + '" target=_blank rel=noopener style="display:block;color:var(--gold);text-decoration:none;font-size:.72rem;padding:.28rem 0;border-top:1px solid rgba(197,165,106,.25)">↗ ' + e(l[0]) + '</a>').join("");
  return '<div style="margin-top:14px;background:rgba(62,138,126,.08);border:1px solid rgba(62,138,126,.45);border-radius:12px;padding:.7rem .9rem">' +
    '<div style="font-family:Fraunces,Georgia,serif;font-weight:600;color:var(--gold)">Verify the developer</div>' +
    '<div style="color:var(--mut);font-size:.62rem;font-family:\'IBM Plex Mono\',monospace;margin:2px 0 6px">MEED Projects record' + (t.asAt ? ' · snapshot ' + e(String(t.asAt).slice(0, 10)) : ' · snapshot, undated') + '</div>' + rec +
    '<div style="margin-top:.5rem">' + links + '</div>' +
    '<div style="color:var(--mut);font-size:.6rem;margin-top:.4rem;font-family:\'IBM Plex Mono\',monospace">records, not a rating — only the DLD register proves licence, escrow and %-complete</div></div>';
}

async function launchMode(env, to, briefText, returnOnly) {''')

# B. launchMode: trust block follows the brief, before the buttons
rep('  await _send("🏗 Launch check — what the register says\\n\\n" + out);\n',
    '  await _send("🏗 Launch check — what the register says\\n\\n" + out);\n  try { await _send(devTrustText(await devTrust(env, intent.developer))); } catch (e) {}   // v72.2 — official verification doors, always\n')

# C. /trust_test route (returns, never messages her)
rep('      if (url.pathname === "/launch_test") {',
    '''      if (url.pathname === "/trust_test") {                    // v72.2 — developer trust check, RETURN it (does not message the user)
        if (url.searchParams.get("key") !== env.READ_KEY) return new Response("unauthorized", { status: 401 });
        const q = url.searchParams.get("q") || "";
        if (!q) return new Response("pass ?q=<developer name>", { status: 400 });
        return new Response(devTrustText(await devTrust(env, q)), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
      }
      if (url.pathname === "/launch_test") {''')

# D. WhatsApp intent
rep("          {                                                     // v40 — launch mode: due diligence in the developer's briefing room\n",
    '''          {                                                     // v72.2 — developer trust check: "trust Binghatti" / "check developer Imtiaz"
            const _tm = text.match(/^(?:trust check|trust|check developer|developer check|verify developer)\\b[:\\s]*(.+)$/i);
            if (_tm && _tm[1] && _tm[1].trim().length > 1) {
              try { await waSend(env, from, devTrustText(await devTrust(env, _tm[1].trim()))); } catch (e) { await waSend(env, from, "Couldn't run that check — try again shortly."); }
              try { await dnaSignal(env, "trust_check", _tm[1].trim()); } catch (e) {}
              return new Response("ok");
            }
          }
          {                                                     // v40 — launch mode: due diligence in the developer's briefing room
''')

# E. help menu
rep("              \"🏗 “launch: <developer> in <area>, 1-bed from 1.2M, claims 8% ROI” — due diligence while you're in the pitch\" + NL10 +\n",
    "              \"🏗 “launch: <developer> in <area>, 1-bed from 1.2M, claims 8% ROI” — due diligence while you're in the pitch\" + NL10 +\n              \"🛡 “trust <developer>” — MEED delivery record + the official DLD pages to verify licence, escrow and disputes\" + NL10 +\n")

# F. remember when the developer index was generated
rep('          await env.MEETINGS.put("mkt_devindex", JSON.stringify(_mb.developerIndex));\n',
    '          await env.MEETINGS.put("mkt_devindex", JSON.stringify(_mb.developerIndex));\n          try { await env.MEETINGS.put("mkt_devindex_at", String(_mb.generatedAt || new Date().toISOString())); } catch (e) {}   // v72.2 — snapshot date for the trust check\n')

# G. drill page: caller passes the trust object; renderer shows it above "Latest registered"
rep('        return new Response(_full ? renderAvailUnits(_dd3, _dk, url.searchParams.get("key") || "") : renderAvailDrill(_dd3, _dk, url.searchParams.get("key") || "", _cards), {',
    '        let _dt = null; try { _dt = await devTrust(env, String(_dd3.title || _dk).replace(/\\s*\\(.*?\\)\\s*$/, "")); } catch (e) {}   // v72.2\n        return new Response(_full ? renderAvailUnits(_dd3, _dk, url.searchParams.get("key") || "") : renderAvailDrill(_dd3, _dk, url.searchParams.get("key") || "", _cards, _dt), {')
rep('function renderAvailDrill(d, dk, key, cards) {', 'function renderAvailDrill(d, dk, key, cards, trust) {')
rep('<div style="margin-top:14px"><div style="font-family:Fraunces,Georgia,serif;font-weight:600;margin-bottom:2px">Latest registered</div>${latest}</div>',
    '${trust ? devTrustHtml(trust) : ""}\n<div style="margin-top:14px"><div style="font-family:Fraunces,Georgia,serif;font-weight:600;margin-bottom:2px">Latest registered</div>${latest}</div>')

assert s != orig and "PARCEL etc.)" in s
io.open(p, "w", encoding="utf-8", newline="\n").write(s); print("patched OK")
