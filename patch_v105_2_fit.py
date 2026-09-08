"""v105.2 - text blocks fit the HEIGHT they have, not just the width (first samples: long hooks ran into the figure, the
footer and the quote thumbnail). Quote look: thumbnail moves top-right so the hook has the full width below it."""
import io
P = r"C:\Dev\azimuth-worker\src\index.js"
s = io.open(P, encoding="utf-8").read(); orig = s

# a height-aware fit next to fitLines
old = '''function fitOne(text, boxW, fz, k, minFz) {'''
new = '''// like fitLines, but also shrinks until the block is no taller than availH (lh = line height factor)
function fitBox(text, boxW, fz, availH, k, minFz, lh) { lh = lh || 1.12; minFz = minFz || 30; let f = fz; for (;;) { const maxL = Math.max(1, Math.floor(availH / Math.round(f * lh))); const r = fitLines(text, boxW, f, maxL, k, f); if ((r.lines.length * Math.round(r.fz * lh) <= availH && !/…$/.test(r.lines[r.lines.length - 1])) || f <= minFz) return r; f -= 4; } }
function fitOne(text, boxW, fz, k, minFz) {'''
assert s.count(old) == 1, "fitOne anchor"; s = s.replace(old, new, 1)

# BIG NUMBER: the base moves up when there is a unit line; the hook fits between the figure block and the source
old = '''    const base = Math.round(H * (story ? 0.60 : 0.57)); const bf = bigFig(72, base, story ? 340 : 300, C.gold, ' filter="url(#sh)"');
    const hk = fitLines(hook, 936, story ? 70 : 62, story ? 5 : 4, 0.54);'''
new = '''    const base = Math.round(H * (story ? (figRest ? 0.56 : 0.60) : (figRest ? 0.50 : 0.55))); const bf = bigFig(72, base, story ? 340 : 300, C.gold, ' filter="url(#sh)"');
    const hk = fitBox(hook, 936, story ? 70 : 62, (H - 150) - (bf.end + 40) - 20, 0.54, 34);'''
assert s.count(old) == 1, "bignumber"; s = s.replace(old, new)

# SPLIT: the hook fits above the figure block
old = '''    const ph = Math.round(H * (story ? 0.50 : 0.52)); const hk = fitLines(hook, 936, story ? 84 : 72, story ? 6 : 4, 0.56);
    const fy = H - (story ? 230 : 190); const bf = bigFig(72, fy, story ? 128 : 104, C.goldD);
    body = `<rect width="${W}" height="${H}" fill="${C.beige}"/>` + img(0, 0, W, ph, "c1") + `<rect x="0" y="${ph - 8}" width="${W}" height="10" fill="${C.gold}"/>` + chip(56, 62, C.beige, C.green) + num +
      svgLines(hk.lines, 72, ph + 60 + hk.fz, hk.fz, C.greenD, F_SERIF, 600, 1.1) +
      `<rect x="72" y="${fy - (fig.length <= 18 ? fitOne(fig, 936, story ? 128 : 104, 0.6, 72) : 3 * 60) - 36}" width="260" height="4" fill="${C.gold}"/>` + bf.svg +'''
new = '''    const ph = Math.round(H * (story ? 0.48 : 0.46)); const fy = H - (story ? 230 : 190);
    const figH = fig.length <= 18 ? fitOne(fig, 936, story ? 128 : 104, 0.6, 72) + (figRest ? 60 : 0) : 3 * 60;
    const hk = fitBox(hook, 936, story ? 84 : 72, (fy - figH - 60) - (ph + 60), 0.56, 34, 1.1);
    const bf = bigFig(72, fy - (figRest ? 60 : 0), story ? 128 : 104, C.goldD);
    body = `<rect width="${W}" height="${H}" fill="${C.beige}"/>` + img(0, 0, W, ph, "c1") + `<rect x="0" y="${ph - 8}" width="${W}" height="10" fill="${C.gold}"/>` + chip(56, 62, C.beige, C.green) + num +
      svgLines(hk.lines, 72, ph + 60 + hk.fz, hk.fz, C.greenD, F_SERIF, 600, 1.1) +
      `<rect x="72" y="${fy - figH - 30}" width="260" height="4" fill="${C.gold}"/>` + bf.svg +'''
assert s.count(old) == 1, "split b"; s = s.replace(old, new)

# STAT: hooks fit above the photo strip
old = '''      const bx = cx + r + 48, bw = W - 72 - bx; hk = fitLines(hook, bw, story ? 56 : 48, story ? 8 : 6, 0.54); hookY = y0 + 60 + hk.fz;'''
new = '''      const bx = cx + r + 48, bw = W - 72 - bx; hk = fitBox(hook, bw, story ? 56 : 48, (stripY - 40) - (y0 + 60), 0.54, 30, 1.15); hookY = y0 + 60 + hk.fz;'''
assert s.count(old) == 1, "stat pct"; s = s.replace(old, new)
old = '''      hk = fitLines(hook, 936, story ? 64 : 56, story ? 5 : 3, 0.54); hookY = y0 + 250 + hk.fz; g += svgLines(hk.lines, 72, hookY, hk.fz, C.greenD, F_SANS, 600, 1.15);'''
new = '''      hk = fitBox(hook, 936, story ? 64 : 56, (stripY - 40) - (y0 + 250), 0.54, 30, 1.15); hookY = y0 + 250 + hk.fz; g += svgLines(hk.lines, 72, hookY, hk.fz, C.greenD, F_SANS, 600, 1.15);'''
assert s.count(old) == 1, "stat two"; s = s.replace(old, new)
old = '''      hk = fitLines(hook, 936, story ? 64 : 56, story ? 5 : 3, 0.54); hookY = y0 + nfz + (fp.unit ? 150 : 70) + hk.fz; g += svgLines(hk.lines, 72, hookY, hk.fz, C.greenD, F_SANS, 600, 1.15);'''
new = '''      const hy0 = y0 + nfz + (fp.unit ? 150 : 70); hk = fitBox(hook, 936, story ? 64 : 56, (stripY - 40) - hy0, 0.54, 30, 1.15); hookY = hy0 + hk.fz; g += svgLines(hk.lines, 72, hookY, hk.fz, C.greenD, F_SANS, 600, 1.15);'''
assert s.count(old) == 1, "stat num"; s = s.replace(old, new)

# QUOTE: thumbnail top-right, hook full width beneath, figure fits above the source
old = '''    const th = story ? 520 : 380; const hk = fitLines(hook, 900, story ? 84 : 70, story ? 7 : 5, 0.56); const hy = story ? 470 : 400;
    const endY = hy + (hk.lines.length - 1) * Math.round(hk.fz * 1.1); const fq = fitLines(fig + (figRest ? " · " + figRest : ""), 620, 64, 3, 0.65, 30); const ffz = fq.fz;'''
new = '''    const th = story ? 440 : 300; const ty = 140; const hy = ty + th + (story ? 150 : 120);
    const fq = fitLines(fig + (figRest ? " · " + figRest : ""), 936, 64, 3, 0.65, 30); const ffz = fq.fz; const figBlock = 60 + ffz + (fq.lines.length - 1) * Math.round(ffz * 1.2);
    const hk = fitBox(hook, 936, story ? 84 : 70, (H - 150 - figBlock - 60) - hy, 0.56, 34, 1.1);
    const endY = hy + (hk.lines.length - 1) * Math.round(hk.fz * 1.1);'''
assert s.count(old) == 1, "quote a"; s = s.replace(old, new)
old = '''      `<clipPath id="c3"><rect x="${W - 72 - th}" y="${H - 140 - th}" width="${th}" height="${th}" rx="28"/></clipPath>` + (imgUrl ? `<g clip-path="url(#c3)"><image href="${imgUrl}" x="${W - 72 - th}" y="${H - 140 - th}" width="${th}" height="${th}" preserveAspectRatio="xMidYMid slice"/></g>` : "") +
      `<rect x="${W - 72 - th}" y="${H - 140 - th}" width="${th}" height="${th}" rx="28" fill="none" stroke="${C.gold}" stroke-width="3"/>` +'''
new = '''      `<clipPath id="c3"><rect x="${W - 72 - th}" y="${ty}" width="${th}" height="${th}" rx="28"/></clipPath>` + (imgUrl ? `<g clip-path="url(#c3)"><image href="${imgUrl}" x="${W - 72 - th}" y="${ty}" width="${th}" height="${th}" preserveAspectRatio="xMidYMid slice"/></g>` : "") +
      `<rect x="${W - 72 - th}" y="${ty}" width="${th}" height="${th}" rx="28" fill="none" stroke="${C.gold}" stroke-width="3"/>` +'''
assert s.count(old) == 1, "quote b"; s = s.replace(old, new)
old = '''      `<text x="44" y="${hy - 40}" fill="${C.gold}" fill-opacity=".92" font-size="360" font-weight="700" font-family="${F_SERIF}">“</text>` +'''
new = '''      `<text x="44" y="${ty + th - 20}" fill="${C.gold}" fill-opacity=".92" font-size="360" font-weight="700" font-family="${F_SERIF}">“</text>` +'''
assert s.count(old) == 1, "quote c"; s = s.replace(old, new)

# TICKER: hook fits above the strip + source + footer
old = '''    const fy = story ? 700 : 470; const bf = bigFig(72, fy, story ? 240 : 200, C.gold, ' filter="url(#sh)"'); const hk = fitLines(hook, 936, story ? 66 : 58, story ? 5 : 4, 0.54);'''
new = '''    const fy = story ? 700 : (figRest ? 400 : 440); const bf = bigFig(72, fy, story ? 240 : 200, C.gold, ' filter="url(#sh)"'); const hk = fitBox(hook, 936, story ? 66 : 58, (H - 300) - (bf.end + 60), 0.54, 34);'''
assert s.count(old) == 1, "ticker"; s = s.replace(old, new)

io.open(P, "w", encoding="utf-8", newline="\n").write(s); print("v105.2 applied:", len(s) - len(orig), "bytes delta")
