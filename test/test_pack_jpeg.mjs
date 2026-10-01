// PACK AUDIT, 1 Oct 2026 - the brochure photos must reach the PDF as JPEG.
//
// Kendall's ten-building pack was 30.8 MB: Cloudflare's Browser Rendering (Chrome 128, "Skia/PDF m128") stored every photo as raw
// Flate pixels because the documents drew them with object-fit:cover (a source-rectangle subset, which that PDF writer decodes and
// re-encodes). src/brief_docs.js now draws each picture WHOLE inside a clipping box (fitImg, sized from the JPEG's own header by
// jpegSize), which Chrome 128 passes through as DCTDecode; the header picture prefers a JPEG (brand_najjuko_n_jpg).
//
// What this proves:
//   1. jpegSize reads a JPEG's pixel size from its header, and refuses non-JPEG bytes
//   2. fitImg covers a box with the WHOLE picture (no object-fit), plain <img> when the aspect already matches, object-fit only as the
//      fallback for a picture whose size is unknown
//   3. a dossier built from a stored JPEG brochure carries no object-fit on any picture; the header uses the JPEG when it is stored
//   4. (with Chrome 128 on this machine) the dossier printed by Chrome 128 holds every photo as DCTDecode and NO photo as Flate - the
//      failure mode of the live pack. Chrome 145+ keeps JPEG even with object-fit, so only Chrome 128 can catch a regression: set
//      CHROME128=<chrome-headless-shell.exe of 128.0.6613.x> (npx @puppeteer/browsers install chrome-headless-shell@128.0.6613.137).
//      Without it part 4 is skipped and says so.
// NEGATIVE CONTROL (run by hand, see the commit message): restore object-fit:cover in thumb()/dossierPage1/dossierPage3 (or run this
// file against v278.1's src/brief_docs.js) and checks 3 and 4 fail - part 4 with "photo images stored as Flate (PNG-like): N".
//
//   node test/test_pack_jpeg.mjs
import fs from "node:fs";
import http from "node:http";
import { jpegSize, fitImg, buildDocument, parseQuery, brochureKvName } from "../src/brief_docs.js";

let pass = 0, fail = 0;
const ok = (c, m, d) => { if (c) { pass++; console.log("  ok - " + m); } else { fail++; console.log("  FAIL - " + m + (d ? "\n         " + String(d).slice(0, 400) : "")); } };

// a real 600 x 400 JPEG (baseline, q40), so the header parse and Chrome's handling are the real thing
const JPG = Buffer.from("/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABQODxIPDRQSEBIXFRQYHjIhHhwcHj0sLiQySUBMS0dARkVQWnNiUFVtVkVGZIhlbXd7gYKBTmCNl4x9lnN+gXz/2wBDARUXFx4aHjshITt8U0ZTfHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHz/wAARCAGQAlgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDMooor0TiCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAopaKQxKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigAooopDCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAoooqRhRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRVywsftvmfvNmzH8Oc5z/AIUNpasaVynRWx/Yf/Tx/wCOf/Xo/sP/AKeP/HP/AK9T7SI+RmPRWx/Yf/Tx/wCOf/Xo/sP/AKeP/HP/AK9HtIhyMx6K2P7D/wCnj/xz/wCvR/Yf/Tx/45/9ej2kQ5GY9FbH9h/9PH/jn/16P7D/AOnj/wAc/wDr0e0iHIzHorY/sP8A6eP/ABz/AOvR/Yf/AE8f+Of/AF6PaRDkZj0Vsf2H/wBPH/jn/wBej+w/+nj/AMc/+vR7SIcjMeitj+w/+nj/AMc/+vR/Yf8A08f+Of8A16PaRDkZj0Vsf2H/ANPH/jn/ANej+w/+nj/xz/69HtIhyMx6K2P7D/6eP/HP/r0f2H/08f8Ajn/16PaRDkZj0Vsf2H/08f8Ajn/16rX2m/Y4RJ5u/Lbcbcevv7UKcWHK0UKKKKokKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAFooopDCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACtfQf+W//AAH+tZFa+g/8t/8AgP8AWpn8JUdzXooornNwooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACs7XP+PNP+ug/ka0aztc/480/66D+Rqo7ky2MKiiiugwCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooopFBRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABWvoP8Ay3/4D/WsitfQf+W//Af61M/hHHc16KKKwNgooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACs7XP8AjzT/AK6D+RrRrO1v/jzT/roP5GqjuTLYwqKKK3MgooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAWiiikMKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAK1tB/5b/8B/rWTWvoX/Lf/gP9amWw47mtRRRWJqFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAVna3/x6J/10H8jWjWdrf/Hon/XQfyNOO4nsYdFFFbmQUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFIYUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAVr6F/y3/4D/WsitfQv+W//Af61Mthrc1qKKKyNAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACs7W/wDj0T/roP5GtGs7W/8Aj0T/AK6D+Rpx3E9jDooorYzCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAopaKQxKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBK19C/5b/8B/rWTWtoX/Lf/gP9amWw1ua1FFFZlhRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFZ2t/wDHon/XQfyNaNZ+t/8AHon/AF0H8jTW4nsYVFLRWpAlFLRQAlFLRQAlFLRQAlFLRQAlFLRQAlFLRQAlFLRQAlFLRQAlFLRQAlFLRQAlFLRQAlFLRQAlFLRQAUUUUhhRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABWtoX/AC3/AOA/1rJrW0P/AJb/APAf60nsNGtRRRWZQUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABWfrX/Hon/XQfyNaFZ+tf8eif9dB/I01uJmHRRRWhIUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFLRSGJRS0UAJRS0UAJRS0UAJRS0UAJRS0UAJRS0UAJRS0UAJRS0UAJRS0UAJRS0UAJRS0UAJRS0UAJWtof/Lf/gP9ayq1dD/5b/8AAf60nsM1qKKKgYUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABWfrX/Hon/XQfyNaFZ+tf8eif9dB/I01uIw6KWirEJRS0UAJRS0UAJRS0UAJRS0UAJRS0UAJRS0UAJRS0UAJRS0UAJRS0UAJRS0UAJRS0UAJRS0UAJRS0UAFFFFIYUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAVraH/y3/wCA/wBaya1tD/5b/wDAf60mBq0UUVIwooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACs/Wv+PRP+ug/ka0Kz9a/49E/66D+RoQGJRRRViCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAopaKkoSilooASilooASilooASilooASilooASilooASilooASilooASilooASilooASilooASilooAStbQ/8Alv8A8B/rWVWrof8Ay3/4D/WgRq0UUUgCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKz9a/49E/66D+RrQrP1n/j0T/roP5GgDEopaKYxKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigBKKWigAooopDCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACtXRP+W//Af61lVq6J/y3/4D/WgTNWiiigQUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABWfrP8Ax6J/10H8jWhWfrP/AB6J/wBdB/I0AYtFFFBQUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFIYUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAVq6J/y3/4D/WsqtXRP+W//Af60Cexq0UUUyQooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACs/Wf8Aj0T/AHx/I1oVQ1n/AI9U/wB8fyNAIxKKKKRYUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUALRRRSGFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFamif8t/+A/1rLrV0T/lv/wAB/rTQnsalFFFMgKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAqhrP/Hqn++P5Gr9UNZ/49U/3x/I0AtzFoooqTQKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiikMKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAK1dE/5b/wDAf61lVq6L/wAtv+A/1poUtjUoooqjMKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAqhrP/Hqn++P5Gr9UNY/49V/3x/I0mNbmLRRRUmgUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUALRRRSGFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFami/8tv8AgP8AWsutTRf+W3/Af601uKWxqUUUVZkFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAVQ1j/j1X/fH8jV+qGsf8eq/wC+P5Gk9hrcxqKKKg1CiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooopDCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACtTRf+W3/Af61l1qaL/wAtv+A/1prcmWxqUUUVoZBRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFUNY/49V/3x/I1fqhrH/Hqv++P5Gk9hx3MaiiiszYKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAFooopFBRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABWnov8Ay2/4D/WsytPRf+W3/Af6047kT2NSiiitTEKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAqhrH/Hqv++P5Gr9UNY/49V/3x/I0nsOO5j0UUVkdAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFIYUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAVqaN/y2/wCA/wBay61NG/5bf8B/rTjuRP4TTooorYwCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKo6v8A8eq/74/kavVR1f8A49V/3x/I0pbDjuY1FFFYnSFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRS0UhiUUtFACUUtFACUUtFACUUtFACUUtFACUUtFACUUtFACUUtFACUUtFACUUtFACUUtFACUUtFACVqaN/y2/4D/WsytPRv+W3/AAH+tVHcifwmnRRRWxzhRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFUdX/49V/3x/I1eqjq/wDx6r/vj+RqZbFQ+JGNRS0VidIlFLRQAlFLRQAlFLRQAlFLRQAlFLRQAlFLRQAlFLRQAlFLRQAlFLRQAlFLRQAlFLRQAlFLRQAlFLRQAUUUVIwooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigArT0b/AJbf8B/rWZWno3/Lb/gP9auHxEVPhNOiiitzmCiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKo6v/wAeq/74/kavVR1f/j1X/fH8jUy2Kh8SMeiiiuc6gooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKWikMSilooASilooASilooASilooASilooASilooASilooASilooASilooASilooASilooASilooAStPR/wDlt/wH+tZtaWj/APLb/gP9auHxEVPhZp0UUV0HKFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAVR1f/j2X/fH8jV6qOrf8ey/74/kamWxUPiRj0UtFcx1iUUtFACUUtFACUUtFACUUtFACUUtFACUUtFACUUtFACUUtFACUUtFACUUtFACUUtFACUUtFACUUtFABRRRSGFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFaGlSJH5u91XOMbjj1rPopp2dxSjzKx0P2mD/AJ7R/wDfQo+0wf8APaP/AL6Fc9RWntWZexXc6H7TB/z2j/76FH2mD/ntH/30K56ij2rD2K7nQ/aYP+e0f/fQo+0wf89o/wDvoVz1FHtWHsV3Oh+0wf8APaP/AL6FH2mD/ntH/wB9Cueoo9qw9iu50P2mD/ntH/30KPtMH/PaP/voVz1FHtWHsV3Oh+0wf89o/wDvoUfaYP8AntH/AN9Cueoo9qw9iu50P2mD/ntH/wB9Cj7TB/z2j/76Fc9RR7Vh7FdzoftMH/PaP/voUfaYP+e0f/fQrnqKPasPYrudD9pg/wCe0f8A30KPtMH/AD2j/wC+hXPUUe1YexXc6H7TB/z2j/76FUtUljkt1CSIx3g4DA9jWXRSdS6sNUkncKKKKzNQooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//Z", "base64");

// ---- 1. jpegSize
ok(JSON.stringify(jpegSize(JPG)) === JSON.stringify({ w: 600, h: 400 }), "jpegSize reads 600 x 400 from the JPEG header", JSON.stringify(jpegSize(JPG)));
ok(jpegSize(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0])) === null && jpegSize(new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3])) === null, "non-JPEG or truncated bytes -> null (no size invented)");

// ---- 2. fitImg
const pic = { src: "https://x/img/p", w: 600, h: 400 };
const cov = fitImg(pic, 702, 300, "Hero", 0.38);
ok(!/object-fit/.test(cov) && /overflow:hidden/.test(cov) && /width:702px;height:468px/.test(cov) && /top:-63.84px/.test(cov), "cover = the whole picture scaled to cover (702 x 468), clipped by the box, framed 38% down", cov);
ok(fitImg({ src: "s", w: 1404, h: 600 }, 702, 300, "") === '<img src="s" alt="" style="width:702px;height:300px;display:block;">', "a picture already at the box's aspect is a plain <img>, no clip");
ok(/object-fit:cover/.test(fitImg({ src: "s" }, 100, 50, "")), "size unknown (not a JPEG) -> the old object-fit:cover, never a broken layout");

// ---- 3. a dossier built from stored JPEGs
const store = new Map();
const J = (k, o) => store.set("img_" + k, JSON.stringify(o));
const BIN = (k, b, ct) => { store.set("img_" + k, b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); store.set("img_ct_" + k, ct); };
J("rent_index", { as_of: "2026-09-30", items: [{ p: "alphatower", n: "Alpha Tower", d: "t", i: 10, lon: 55.2, lat: 25.05, area: "Al Test", b: { "1": { n: 16, m: 65000, q1: 60000, q3: 70500, s: 59.1 } } }] });
J("districts_geo", { districts: [{ slug: "t", name: "Test District" }] });
J(brochureKvName("t_10"), { name: "Alpha Tower", developer: "Alpha", source_url: "https://alphadev.example/alpha", amenities: ["Pool"], photos: [
  { file: "exterior.jpg", key: "bph_ext", caption: "Alpha Tower" }, { file: "pool.jpg", key: "bph_pool", caption: "Pool" }, { file: "gym.jpg", key: "bph_gym", caption: "Gym" }] });
for (const k of ["bph_ext", "bph_pool", "bph_gym", "brand_najjuko_n_jpg"]) BIN(k, JPG, "image/jpeg");
BIN("brand_najjuko_n", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]), "image/png");
const env = { MEETINGS: { async get(k, t) { if (!store.has(k)) return null; const v = store.get(k); if (t === "arrayBuffer") return typeof v === "string" ? new TextEncoder().encode(v).buffer : v; return typeof v === "string" ? v : new TextDecoder().decode(v); } } };
const srv = http.createServer((q, r) => { const k = q.url.replace(/^\/img\//, ""); const v = store.get("img_" + k); if (!v || typeof v === "string") { r.writeHead(404); return r.end(); } r.writeHead(200, { "Content-Type": store.get("img_ct_" + k) }); r.end(Buffer.from(new Uint8Array(v))); }).listen(0);
const ORIGIN = "http://127.0.0.1:" + srv.address().port;
const q = parseQuery(new URL("https://x/brief_pdf?kind=pack&keys=t:10&mode=rent&beds=1&max=65000"));
const doc = await buildDocument(env, q, { origin: ORIGIN, now: Date.parse("2026-10-01T05:00:00Z") });
const html = doc.html || "";
const imgs = html.match(/<img [^>]*>/g) || [];
const photoImgs = imgs.filter((t) => /\/img\/bph_/.test(t));
ok(photoImgs.length >= 4, "the pack carries the card, the hero and the page-3 photos (" + photoImgs.length + " pictures)");
ok(photoImgs.every((t) => !/object-fit/.test(t)), "no brochure picture is drawn with object-fit (the subset Chrome 128 re-encodes)", photoImgs.find((t) => /object-fit/.test(t)));
ok(imgs.some((t) => /najhead[^>]+\/img\/brand_najjuko_n_jpg"/.test(t)) && !imgs.some((t) => /\/img\/brand_najjuko_n"/.test(t)), "the header uses the JPEG header picture when it is stored");

// ---- 4. Chrome 128 prints them as JPEG
const C128 = process.env.CHROME128 || "";
let chromium = null;
try { if (C128 && fs.existsSync(C128)) chromium = (await import("playwright-core")).chromium; } catch (e) {
  try { chromium = (await import("file:///C:/Dev/notebooklm-mcp/node_modules/playwright-core/index.mjs")).chromium; } catch (e2) { chromium = null; }
}
if (!chromium) {
  console.log("  skip - part 4 needs CHROME128 (Chrome 128 headless shell) and playwright-core; " + (C128 ? "not found: " + C128 : "CHROME128 not set"));
} else {
  const browser = await chromium.launch({ executablePath: C128, headless: true });
  const page = await browser.newPage({ viewport: { width: 1123, height: 1123 } });
  await page.setContent(html, { waitUntil: "networkidle", timeout: 60000 });
  const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  const ver = browser.version(); await browser.close();
  const s = pdf.toString("latin1");
  const dicts = s.match(/<<[^<>]*\/Subtype\s*\/Image[^<>]*>>/g) || [];
  const photos = dicts.filter((d) => !/DeviceGray/.test(d) && +((/\/Width\s+(\d+)/.exec(d) || [])[1] || 0) >= 64);
  const flate = photos.filter((d) => /FlateDecode/.test(d)), dct = photos.filter((d) => /DCTDecode/.test(d));
  ok(/^128\./.test(ver), "printed by Chrome " + ver + " (Cloudflare Browser Rendering's version)");
  ok(dct.length >= 3 && flate.length === 0, "photo images stored as JPEG: " + dct.length + "; photo images stored as Flate (PNG-like): " + flate.length, flate.slice(0, 2).join(" | "));
}
srv.close();
console.log((fail ? "FAIL" : "PASS") + " - pack photos stay JPEG: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
