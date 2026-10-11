// v508 - petrol stations join the amenity set; the amenity chips fold into ONE "places" drop-down on the map and the district twins;
// the all-Dubai twin gets the same drop-down with pins drawn on the city (Kendall 11 Oct 2026).
import fs from "node:fs";
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
const src = fs.readFileSync(new URL("../src/index.js", import.meta.url), "utf8");

// 1. one AMEN table, shared, with fuel in it - and the old inline copy is gone
ok(/const AMEN_JS = 'var AMEN=\{/.test(src), "AMEN_JS table exists");
ok((src.match(/var AMEN=\{school:/g) || []).length === 1, "exactly one AMEN definition (map and city share it)");
ok(/fuel:\["petrol stations"/.test(src), "fuel kind in the AMEN table");
ok(/"fuel": "<svg viewBox='0 0 24 24'>/.test(src), "petrol pump icon in MAP_ICONS");
ok(/fuel: _in\("fuel"\)/.test(src), "the community JSON counts petrol stations within 1.5 km");

// 2. the map / district-twin chrome: the chip row lives inside a drop-down with a header that names what is on
ok(/<div class=amp2 id=amp2><div class=amh2 id=amh2><span>places<\/span><b id=amres2>none chosen<\/b>/.test(src), "places drop-down wraps #am");
ok(/\.amp2 \.am\{display:none/.test(src) && /\.amp2\.on \.am\{display:flex\}/.test(src), "chips hidden until the drop-down opens");
ok(/function amSummary\(\)/.test(src) && /a\.classList\.toggle\("on",!!ON\[k\]\);amSummary\(\);drawAm\(\);/.test(src), "toggling a kind updates the header");
ok(/\.top\.closed \.amp2\{display:none\}/.test(src), "the drop-down hides with the rest of the top chrome");

// 3. the all-Dubai twin: the same drop-down in the stack, pins on a canvas overlay, tap for the name
ok(/const CITY_PLACES_HTML = '<div id=amp class="hp amp">/.test(src), "city PLACES panel html");
ok(/CITY_COLOUR_HTML \+ CITY_PLACES_HTML \+ CITY_ADV_HTML \+ '<\/div><div id=panel><\/div>'/.test(src), "city PLACES panel sits in the stack after COLOUR BY");
ok(/CITY_STACK_MODULE_JS,\s*\/\/ v152\.5[^\n]*\n\s*CITY_PLACES_JS,/.test(src), "city PLACES js ships with the module");
ok(/CITY_STACK_CSS \+ CITY_PLACES_CSS/.test(src), "city PLACES css ships");
ok(/window\.__AM=AM;window\.__dName=dName;/.test(src), "the chrome exposes the amenity register to the module");
ok(/const p=llx\(i\.lon,i\.lat\);AMPTS\.push/.test(src), "pins are placed through the city's own UTM projection (llx)");
ok(/ev\.stopImmediatePropagation\(\);const i=best\.i;/.test(src), "a tap on a pin wins over the district fly");
ok(/position approximate/.test(src), "approximate pins say so");

console.log(`v508 places/fuel: ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
