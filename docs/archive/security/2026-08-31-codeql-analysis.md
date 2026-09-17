# CodeQL analysis — 2026-08-31

Third pass over hydrowash, using the Trail of Bits `codeql` and `sarif-parsing`
skills. Run specifically to close the gap left by the Semgrep pass, which had no Pro
licence and therefore no cross-file taint tracking.

| Field | Value |
|---|---|
| CLI | CodeQL bundle, `javascript-queries` 2.4.4 |
| Database | `javascript-typescript`, 157/157 files extracted |
| Suites | `javascript-security-and-quality.qls`, `javascript-security-extended.qls` |
| Raw results | 70 (s&q) + 3 (extended) |
| After excluding bundled artifacts | **5** — 3 error, 3 note (2 overlap) |
| New true positives | **0** |

Artifacts: `static_analysis_codeql_1/*.sarif` (gitignored). Custom query committed at
`codeql/custom/InfoWindowHtml.ql`.

---

## Severity resolution mattered here

CodeQL **omits `result.level` on every result** and records severity on the rule as
`defaultConfiguration.level`. Reading `result.level` directly, as most naive SARIF
gates do:

```
naive  jq '[.runs[].results[]|select(.level=="error")]|length'   ->  0
resolved (level inherited from rule)                             ->  3
```

A CI gate written the obvious way scores this repo clean while three errors sit in an
auth route. Any gate added later must resolve severity through
`ruleIndex → tool.driver.rules[].defaultConfiguration.level`.

## Noise profile

65 of 70 results land in `playwright-report/index.html` — a committed Playwright HTML
report with a bundled JS blob inside it. It is minified third-party code and every
finding in it (`js/trivial-conditional`, `js/comparison-between-incompatible-types`,
`js/unneeded-defensive-code`, …) is noise. Excluding `playwright-report/`,
`node_modules/` and `.next/` is a prerequisite for this database being useful; better
still, stop committing the report (128 `.playwright-mcp/*.log` files have the same
problem, noted in the original audit).

---

## Findings

### `js/user-controlled-bypass` ×3 — `app/auth/callback/route.ts:15,18` — FALSE POSITIVE

> "This condition guards a sensitive action, but a user-provided value controls it."

```ts
if (code) {
  await supabase.auth.exchangeCodeForSession(code)      // :15
} else if (token_hash && type) {                        // :18
  ...
  await supabase.auth.verifyOtp({ token_hash, type: type as EmailOtpType })
}
```

The dataflow is real — `searchParams.get('code'/'token_hash'/'type')` reaches the
branch conditions — but the guarded operations *are themselves the verification*.
`exchangeCodeForSession` and `verifyOtp` validate the token server-side against
Supabase and error on anything invalid. Choosing which branch runs bypasses no check.
The query flags "user input controls a security-relevant condition" without modelling
that the guarded call is the check. **Not a vulnerability; do not fix.**

One genuine nit surfaced in passing: `type as EmailOtpType` (line 27) is an unchecked
cast of an arbitrary query string into the OTP-type enum. Supabase rejects unknown
values, so impact is nil, but validating `type` against `SLOT_KEYS`-style constants
would be cheaper than reasoning about it again later. LOW.

### `js/unused-local-variable` ×3 — notes

`app/admin/customers/page.tsx:2`, `app/api/contracts/route.ts:29`,
`components/admin/ContractCard.tsx:39`. Dead code, no security relevance.

---

## What CodeQL did NOT find, and why it matters

This is the load-bearing part of the report.

### It missed the XSS (audit finding 1) despite every precondition being met

`components/admin/RouteMap.tsx` **was** extracted into the database, and the full XSS
rule family **did** run against it — `js/xss`, `js/stored-xss`, `js/reflected-xss`,
`js/xss-through-dom`, `js/xss-through-exception`, `js/unsafe-jquery-plugin`. None
fired.

The reason is sink modelling, not dataflow. CodeQL's JS XSS sinks are DOM APIs
(`innerHTML`, `document.write`, `$()`, …). `new google.maps.InfoWindow({content: ...})`
is a third-party API option object, and nothing in the default model says that property
is parsed as HTML. No amount of taint tracking helps when the sink is invisible.

I had told you interprocedural analysis would independently confirm that flow. It did
not, and the honest read is that **all three scanners — Semgrep OSS, CodeQL
security-and-quality, CodeQL security-extended — are blind to this bug for the same
reason**: an unmodelled sink. It was found by reading the code, and the variant sweep
proved it unique by construction rather than by tool agreement.

### Closing the gap: a custom sink query

`codeql/custom/InfoWindowHtml.ql` models the sink directly:

```ql
from NewExpr ne, ObjectExpr obj, Property p, TemplateLiteral t
where
  ne.getCalleeName() = "InfoWindow" and
  obj = ne.getAnArgument() and
  p = obj.getAProperty() and
  p.getName() = "content" and
  t = p.getInit() and
  exists(Expr e | e = t.getAnElement() and not e instanceof TemplateElement)
select p, "InfoWindow content is built by string interpolation; ..."
```

Verified against this database: **1 result, `RouteMap.tsx:96`, zero false positives.**
Run it with:

```bash
codeql query run --database=<db> codeql/custom/InfoWindowHtml.ql
```

### It also missed the open-redirect weakness in the same file it flagged

`app/auth/callback/route.ts:11` — `rawNext.startsWith('/') && !rawNext.startsWith('//')`
lets `/\evil.com` through (audit finding 6). CodeQL raised three errors in this file
and none of them is that line. `js/client-side-unvalidated-url-redirection` treats the
prefix check as adequate sanitisation, because the backslash-normalisation quirk is a
browser behaviour, not a dataflow property.

---

## Conclusion

CodeQL contributed **no new true positives**. That is a genuine result — it
independently corroborates that the route-authorisation, injection, and secrets
surfaces are clean, which is what the Semgrep pass claimed without the ability to prove
it across files.

It does not raise confidence in the findings that matter. Every serious issue in this
audit — the RouteMap XSS, the `bookings_customer_insert` self-approval, the mutable
`search_path`, the unmirrored RLS rules — lives in a shape no off-the-shelf query
models: a third-party API option object, and Postgres RLS policy text that no
JavaScript extractor reads at all.

**The scanners cover the JavaScript. Nothing in this toolchain reads the security model,
which is where every high-severity finding actually was.**
