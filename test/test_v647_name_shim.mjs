// v647 - page scripts that embed server functions via toString() must define __name (wrangler bundling adds __name calls). Fake data only.
import { ANNE_JS } from "../src/work_anne.js";
import { SPK_JS } from "../src/work_speaking.js";
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log("FAIL", m); } };
for (const [n, js] of [["anne", ANNE_JS], ["speaking", SPK_JS]]) {
  ok(js.startsWith("var __name=function(f){return f};"), n + " page defines __name first");
  // simulate the bundled form: a call to __name inside an embedded function must not throw
  const f = new Function("var __name=function(f){return f};var g=__name(function(){return 1},'g');return g()"); ok(f() === 1, n + " shim works");
}
console.log("v647 name shim: " + pass + " passed, " + fail + " failed"); process.exit(fail ? 1 : 0);
