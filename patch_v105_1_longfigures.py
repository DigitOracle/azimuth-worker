"""v105.1 - the feed's `figure` is sometimes a phrase ("AED 4,380,000 from-price for 3-bedroom Alva (vs AED 130,000 annual rent)").
The big-number looks must show the NUMBER large and the rest as a smaller line, never a 70-character string at 200 px.
Also: four-digit years are not thousands ("August 2,026")."""
import io
P = r"C:\Dev\azimuth-worker\src\index.js"
s = io.open(P, encoding="utf-8").read(); orig = s

# years keep their digits
old = '''  const t = String(fig || "").trim().replace(/\\d{4,}/g, m => Number(m).toLocaleString("en-US"));'''
new = '''  const t = String(fig || "").trim().replace(/\\d{4,}/g, m => (m.length === 4 && /^(19|20)\\d\\d$/.test(m)) ? m : Number(m).toLocaleString("en-US"));   // 2026 is a year, 16264 is a count'''
assert s.count(old) == 1, "year line"; s = s.replace(old, new)

# the display figure: number large, remainder small
old = '''  const fp = figureParts(angle.figure); const fig = fp.text; const area = areaName ? String(areaName) : "";'''
new = '''  const fp = figureParts(angle.figure); const area = areaName ? String(areaName) : "";
  // what the big type shows: the number when there is one, else the phrase (a long phrase is wrapped small, never blown up)
  const fig = fp.kind === "text" ? fp.text : fp.num; const figRest = fp.kind === "text" ? "" : String(fp.unit || "").slice(0, 90);
  const bigFig = (x, base, maxFz, fill, extra) => {                                  // returns svg + the y where the block ends
    if (fig.length <= 18) { const fz = fitOne(fig, 936, maxFz, 0.6, 72); let out = `<text x="${x - 6}" y="${base}" fill="${fill}" font-size="${fz}" font-weight="700" font-family="${F_SERIF}"${extra || ""}>${_sx(fig)}</text>`; let end = base;
      if (figRest) { const r = fitLines(figRest, 936, 34, 2, 0.6, 26); out += svgLines(r.lines, x, base + 16 + r.fz, r.fz, fill, F_MONO, 400, 1.25, ' letter-spacing="2"'); end = base + 16 + r.fz + (r.lines.length - 1) * Math.round(r.fz * 1.25); }
      return { svg: out, end }; }
    const r = fitLines(fig + (figRest ? " " + figRest : ""), 936, Math.min(maxFz, 88), 3, 0.56, 44); const y = base - (r.lines.length - 1) * Math.round(r.fz * 1.1);
    return { svg: svgLines(r.lines, x, y, r.fz, fill, F_SERIF, 700, 1.1, extra), end: base }; };'''
assert s.count(old) == 1, "fig line"; s = s.replace(old, new)

# BIG NUMBER
old = '''    const fz = fitOne(fig, 936, story ? 340 : 300, 0.6, 120); const base = Math.round(H * (story ? 0.60 : 0.57));
    const hk = fitLines(hook, 936, story ? 70 : 62, story ? 5 : 4, 0.54);
    body = img(0, 0, W, H, "c0") + `<rect width="${W}" height="${H}" fill="url(#gd)"/>` + chip(56, 62, C.beige, C.green) + num +
      `<text x="66" y="${base}" fill="${C.gold}" font-size="${fz}" font-weight="700" font-family="${F_SERIF}" filter="url(#sh)">${_sx(fig)}</text>` +
      svgLines(hk.lines, 72, base + 40 + hk.fz, hk.fz, C.beige, F_SANS, 600, 1.12, ' filter="url(#sh)"') +'''
new = '''    const base = Math.round(H * (story ? 0.60 : 0.57)); const bf = bigFig(72, base, story ? 340 : 300, C.gold, ' filter="url(#sh)"');
    const hk = fitLines(hook, 936, story ? 70 : 62, story ? 5 : 4, 0.54);
    body = img(0, 0, W, H, "c0") + `<rect width="${W}" height="${H}" fill="url(#gd)"/>` + chip(56, 62, C.beige, C.green) + num + bf.svg +
      svgLines(hk.lines, 72, bf.end + 40 + hk.fz, hk.fz, C.beige, F_SANS, 600, 1.12, ' filter="url(#sh)"') +'''
assert s.count(old) == 1, "bignumber"; s = s.replace(old, new)

# SPLIT
old = '''    const ffz = fitOne(fig, 936, story ? 128 : 104, 0.6, 56); const fy = H - (story ? 190 : 150);
    body = `<rect width="${W}" height="${H}" fill="${C.beige}"/>` + img(0, 0, W, ph, "c1") + `<rect x="0" y="${ph - 8}" width="${W}" height="10" fill="${C.gold}"/>` + chip(56, 62, C.beige, C.green) + num +
      svgLines(hk.lines, 72, ph + 60 + hk.fz, hk.fz, C.greenD, F_SERIF, 600, 1.1) +
      `<rect x="72" y="${fy - ffz - 36}" width="260" height="4" fill="${C.gold}"/><text x="72" y="${fy}" fill="${C.goldD}" font-size="${ffz}" font-weight="700" font-family="${F_SERIF}">${_sx(fig)}</text>` +'''
new = '''    const fy = H - (story ? 230 : 190); const bf = bigFig(72, fy, story ? 128 : 104, C.goldD);
    body = `<rect width="${W}" height="${H}" fill="${C.beige}"/>` + img(0, 0, W, ph, "c1") + `<rect x="0" y="${ph - 8}" width="${W}" height="10" fill="${C.gold}"/>` + chip(56, 62, C.beige, C.green) + num +
      svgLines(hk.lines, 72, ph + 60 + hk.fz, hk.fz, C.greenD, F_SERIF, 600, 1.1) +
      `<rect x="72" y="${fy - (fig.length <= 18 ? fitOne(fig, 936, story ? 128 : 104, 0.6, 72) : 3 * 60) - 36}" width="260" height="4" fill="${C.gold}"/>` + bf.svg +'''
assert s.count(old) == 1, "split"; s = s.replace(old, new)

# QUOTE
old = '''    const endY = hy + (hk.lines.length - 1) * Math.round(hk.fz * 1.1); const ffz = fitOne(fig, 600, 72, 0.65, 40);'''
new = '''    const endY = hy + (hk.lines.length - 1) * Math.round(hk.fz * 1.1); const fq = fitLines(fig + (figRest ? " · " + figRest : ""), 620, 64, 3, 0.65, 30); const ffz = fq.fz;'''
assert s.count(old) == 1, "quote a"; s = s.replace(old, new)
old = '''      `<rect x="72" y="${endY + 44}" width="240" height="4" fill="${C.gold}"/><text x="72" y="${endY + 60 + ffz}" fill="${C.gold}" font-size="${ffz}" font-weight="700" font-family="${F_MONO}">${_sx(fig)}</text>` +'''
new = '''      `<rect x="72" y="${endY + 44}" width="240" height="4" fill="${C.gold}"/>` + svgLines(fq.lines, 72, endY + 60 + ffz, ffz, C.gold, F_MONO, 700, 1.2) +'''
assert s.count(old) == 1, "quote b"; s = s.replace(old, new)

# TICKER
old = '''    const ffz = fitOne(fig, 936, story ? 240 : 200, 0.6, 96); const fy = story ? 700 : 470; const hk = fitLines(hook, 936, story ? 66 : 58, story ? 5 : 4, 0.54);
    const hy = fy + 60 + hk.fz; const endY = hy + (hk.lines.length - 1) * Math.round(hk.fz * 1.12);'''
new = '''    const fy = story ? 700 : 470; const bf = bigFig(72, fy, story ? 240 : 200, C.gold, ' filter="url(#sh)"'); const hk = fitLines(hook, 936, story ? 66 : 58, story ? 5 : 4, 0.54);
    const hy = bf.end + 60 + hk.fz; const endY = hy + (hk.lines.length - 1) * Math.round(hk.fz * 1.12);'''
assert s.count(old) == 1, "ticker a"; s = s.replace(old, new)
old = '''      `<text x="66" y="${fy}" fill="${C.gold}" font-size="${ffz}" font-weight="700" font-family="${F_SERIF}" filter="url(#sh)">${_sx(fig)}</text>` +
      svgLines(hk.lines, 72, hy, hk.fz, C.beige, F_SANS, 600, 1.12) +'''
new = '''      bf.svg +
      svgLines(hk.lines, 72, hy, hk.fz, C.beige, F_SANS, 600, 1.12) +'''
assert s.count(old) == 1, "ticker b"; s = s.replace(old, new)
old = '''${_sx([fig, area || "Dubai", cardDate()].join("  ·  "))}</text>` +'''
new = '''${_sx([fig.slice(0, 28), area || "Dubai", cardDate()].join("  ·  "))}</text>` +'''
assert s.count(old) == 1, "ticker c"; s = s.replace(old, new)

# STAT - the number look already uses fp.num; the unit line wraps instead of clipping at 40 chars
old = '''        (fp.unit ? `<text x="72" y="${y0 + nfz + 52}" fill="${C.green}" font-size="34" letter-spacing="6" font-family="${F_MONO}">${_sx(fp.unit.toUpperCase().slice(0, 40))}</text>` : "");
      hk = fitLines(hook, 936, story ? 64 : 56, story ? 5 : 3, 0.54); hookY = y0 + nfz + (fp.unit ? 120 : 70) + hk.fz; g += svgLines(hk.lines, 72, hookY, hk.fz, C.greenD, F_SANS, 600, 1.15);'''
new = '''        (fp.unit ? svgLines(fitLines(fp.unit.toUpperCase(), 936, 30, 2, 0.75, 22).lines, 72, y0 + nfz + 48, 30, C.green, F_MONO, 400, 1.3, ' letter-spacing="4"') : "");
      hk = fitLines(hook, 936, story ? 64 : 56, story ? 5 : 3, 0.54); hookY = y0 + nfz + (fp.unit ? 150 : 70) + hk.fz; g += svgLines(hk.lines, 72, hookY, hk.fz, C.greenD, F_SANS, 600, 1.15);'''
assert s.count(old) == 1, "stat"; s = s.replace(old, new)

io.open(P, "w", encoding="utf-8", newline="\n").write(s); print("v105.1 applied:", len(s) - len(orig), "bytes delta")
