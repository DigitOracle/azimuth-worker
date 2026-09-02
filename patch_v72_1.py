import io, sys
p = "src/index.js"
s = io.open(p, encoding="utf-8").read()
orig = s

def rep(old, new, n=1):
    global s
    c = s.count(old)
    assert c == n, f"expected {n} match(es), found {c}: {old[:80]!r}"
    s = s.replace(old, new)

# 1. claudeFetch: count 403s + record total failures in KV (diagnostic only, never blocks the call)
rep('async function claudeFetch(env, model, maxTok, sys, user, schema) {\n  for (let attempt = 0; attempt < 4; attempt++) {\n    let r;',
    '// v72.1 — Anthropic 403 "Request not allowed" is intermittent on some Cloudflare egress IPs.\n'
    '// claudeFetch already retries; these helpers only COUNT what happened so /health can show it.\n'
    'async function bumpClaude403(env, model, attempt) {\n'
    '  try {\n'
    '    if (!env || !env.MEETINGS) return;\n'
    '    const k = "diag_claude403_" + new Date().toISOString().slice(0, 10);\n'
    '    const n = parseInt((await env.MEETINGS.get(k)) || "0", 10) + 1;\n'
    '    await env.MEETINGS.put(k, String(n), { expirationTtl: 3 * 86400 });\n'
    '    await env.MEETINGS.put("diag_claude403_last", JSON.stringify({ at: new Date().toISOString(), model, attempt, count_today: n }), { expirationTtl: 30 * 86400 });\n'
    '  } catch (e) {}\n'
    '}\n'
    'async function noteClaudeFail(env, model, lastStatus) {\n'
    '  try { if (env && env.MEETINGS) await env.MEETINGS.put("diag_claude_fail_last", JSON.stringify({ at: new Date().toISOString(), model, last_status: lastStatus }), { expirationTtl: 30 * 86400 }); } catch (e) {}\n'
    '}\n'
    'async function claudeFetch(env, model, maxTok, sys, user, schema) {\n  let lastStatus = null;\n  for (let attempt = 0; attempt < 4; attempt++) {\n    let r;')
rep('    } catch (e) { await new Promise(s => setTimeout(s, 400 * (attempt + 1))); continue; }\n    if (r.ok) return r;\n    if (r.status === 403 || r.status === 429 || r.status >= 500) { await new Promise(s => setTimeout(s, 500 * (attempt + 1))); continue; }\n    return r;   // 4xx that won\'t fix on retry (400/401) — give up\n  }\n  return null;\n}',
    '    } catch (e) { lastStatus = "threw"; await new Promise(s => setTimeout(s, 400 * (attempt + 1))); continue; }\n    lastStatus = r.status;\n    if (r.ok) return r;\n    if (r.status === 403) await bumpClaude403(env, model, attempt);\n    if (r.status === 403 || r.status === 429 || r.status >= 500) { await new Promise(s => setTimeout(s, 500 * (attempt + 1))); continue; }\n    return r;   // 4xx that won\'t fix on retry (400/401) — give up\n  }\n  await noteClaudeFail(env, model, lastStatus);\n  return null;\n}')

# 2. /health: probe through the retrying path + surface the counters
old_dep = 'dep.claude = env.ANTHROPIC_API_KEY ? await (async () => { try { const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: claudeBody(CLAUDE_FAST, 4, "Reply with the single character: 1", "1", null) }); return r.ok ? "ok" : ("HTTP " + r.status); } catch (e) { return "unreachable"; } })() : "no key";'
new_dep = ('dep.claude = env.ANTHROPIC_API_KEY ? await (async () => { try { const r = await claudeFetch(env, CLAUDE_FAST, 4, "Reply with the single character: 1", "1", null); return r ? (r.ok ? "ok" : ("HTTP " + r.status)) : "FAILED after 4 attempts (403/429/5xx) — see claude_403"; } catch (e) { return "unreachable"; } })() : "no key";\n'
           '        const c403 = await (async () => { try { const today = new Date().toISOString().slice(0, 10); const n = parseInt((await env.MEETINGS.get("diag_claude403_" + today)) || "0", 10); const last = JSON.parse((await env.MEETINGS.get("diag_claude403_last")) || "null"); const fail = JSON.parse((await env.MEETINGS.get("diag_claude_fail_last")) || "null"); return { retried_403s_today: n, last_403: last, last_total_failure: fail, note: "403s are retried up to 4x; only last_total_failure means a user-facing miss" }; } catch (e) { return null; } })();')
rep(old_dep, new_dep)
rep('          dependencies: dep,\n          recent_swallowed_errors: errs.slice(0, 8)',
    '          dependencies: dep,\n          claude_403: c403,\n          recent_swallowed_errors: errs.slice(0, 8)')

# 3. /claude_ping: same retrying path
rep('            const _r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: claudeBody(_t[1], 32, "Answer in one word.", "ping", null) });\n            const _b = await _r.text();\n            _o[_t[0]] = "HTTP " + _r.status + " :: " + _b.slice(0, 400);',
    '            const _r = await claudeFetch(env, _t[1], 32, "Answer in one word.", "ping", null);\n            if (!_r) { _o[_t[0]] = "FAILED after 4 attempts (403/429/5xx)"; continue; }\n            const _b = await _r.text();\n            _o[_t[0]] = "HTTP " + _r.status + " :: " + _b.slice(0, 400);')

assert s != orig
io.open(p, "w", encoding="utf-8", newline="\n").write(s)
print("patched OK")
