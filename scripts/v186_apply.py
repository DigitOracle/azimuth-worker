"""Put scripts/v186_floor_stack.js into src/index.js just before the twin's tap handler (re-runnable: replaces its own block)."""
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
p = os.path.join(ROOT, "src", "index.js")
s = open(p, encoding="utf-8").read()
anchor = "const ray=new THREE.Raycaster(),ptr=new THREE.Vector2();let pd=null;"
code = open(os.path.join(ROOT, "scripts", "v186_floor_stack.js"), encoding="utf-8").read().rstrip("\n") + "\n"
assert "`" not in code and "${" not in code and "\\" not in code, "the block sits in a template literal: no backticks, ${ or backslashes"
import subprocess, tempfile
tmp = os.path.join(tempfile.gettempdir(), "v186_block_check.mjs")
open(tmp, "w", encoding="utf-8").write(code)
r = subprocess.run(["node", "--check", tmp], capture_output=True, text=True)
assert r.returncode == 0, "the block itself does not parse: " + r.stderr
start = s.find("// v186 - FLOOR STACK")
end = s.find(anchor)
assert s.count(anchor) == 1 and end > 0
s = (s[:start] if 0 <= start < end else s[:end]) + code + s[end:]
open(p, "w", encoding="utf-8", newline="").write(s)
print("v186 block in place:", len(code), "chars")
