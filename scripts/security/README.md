# Secret scanning

`scan-secrets.mjs` fails the build if a real credential is committed to the repo.
It exists because a production Supabase `service_role` key was committed to this
repo in an orphaned debug script (and a second copy to a sibling repo) and
nothing caught it.

## What it catches

- **Supabase `service_role` JWT with a real project `ref`** — CRITICAL, everywhere.
  This is the exact incident class. The local-dev demo keys `supabase start`
  prints have no `ref` and are allowed.
- **Live provider secrets** — Stripe (`sk_live_`, `rk_live_`, `whsec_`),
  Anthropic (`sk-ant-api03-`), SendGrid (`SG.`), Resend (`re_`), Supabase
  (`sb_secret_`), GitHub PAT (`ghp_`), AWS (`AKIA…`), PEM private keys.
  CRITICAL in source; downgraded to a non-blocking WARN inside test files, where
  structurally-realistic fixtures are legitimate.

## Run it

```bash
node scripts/security/scan-secrets.mjs
```

Exit 0 = clean (warnings allowed). Exit 1 = a committed credential was found.

## Where it runs

- **CI (enforced):** a "Secret scan" step in the required `verify` job of
  `.github/workflows/ci.yml`, which runs on every PR (no path filter).
- **Local (opt-in):** install the pre-commit hook —
  `ln -sf ../../scripts/security/pre-commit-secret-scan.sh .git/hooks/pre-commit`

## False positives

Prefer removing the secret. For a genuine false positive, put an inline
`secret-scan: allow` comment on the line, or add the path to `IGNORE_PATHS` in
the scanner. A committed real secret is compromised — rotate it, do not just
delete it.
