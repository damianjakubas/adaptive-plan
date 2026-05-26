---
bootstrapped_at: 2026-05-26T11:32:00Z
starter_id: next
starter_name: Next.js
project_name: adaptive-plan
language_family: js
package_manager: npm
cwd_strategy: subdir-then-move
bootstrapper_confidence: verified
phase_3_status: ok
audit_command: npm audit --json
---

## Hand-off

```yaml
starter_id: next
package_manager: npm
project_name: adaptive-plan
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: verified
  path_taken: custom
  quality_override: false
  self_check_answers:
    typed: true
    from_official_starter: true
    conventions: true
    docs_current: false
    can_judge_agent: true
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: true
  has_background_jobs: false
```

Solo developer with a 3-week after-hours timeline building a personalized fitness training plan generator with auth and AI/LLM generation. Next.js is the direct match for the explicit preference and clears all four agent-friendly gates; bootstrapper confidence is verified, so scaffolding will be smooth. The specific library preferences — Supabase (auth + Postgres), Drizzle ORM, Zod, Vercel AI SDK, Zustand, React Hook Form — are all mainstream npm additions on the Next.js scaffold. Cloudflare Pages is the deployment target via the @cloudflare/next-on-pages adapter, with a future path to self-hosted VPS + Docker. CI runs on GitHub Actions with auto-deploy-on-merge.

## Pre-scaffold verification

| Signal        | Value                                        | Severity | Notes                      |
| ------------- | -------------------------------------------- | -------- | -------------------------- |
| npm package   | create-next-app v16.2.6 published 2026-05-26 | fresh    | resolved from cmd_template |
| GitHub repo   | not run                                      | —        | docs_url is not a GitHub repo URL |

## Scaffold log

**Resolved invocation**: `npx create-next-app@latest bootstrap-scaffold --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm`
**Strategy**: subdir-then-move
**Exit code**: 0
**Files moved**: 13
**Conflicts (.scaffold siblings)**: CLAUDE.md
**.gitignore handling**: moved silently (no pre-existing .gitignore in cwd)
**bootstrap-scaffold cleanup**: deleted

Note: `.bootstrap-scaffold` name was adjusted to `bootstrap-scaffold` (without leading dot) because `create-next-app` validates the directory name against npm naming rules and rejects names starting with a period. The `.next/` build cache directory was skipped during move-up (regenerated on next build).

## Post-scaffold audit

**Tool**: npm audit --json
**Summary**: 0 CRITICAL, 0 HIGH, 2 MODERATE, 0 LOW

**Direct vs transitive**: 0/0/1/0 direct of total 0/0/2/0

#### CRITICAL findings

None.

#### HIGH findings

None.

#### MODERATE findings

1. **postcss** <8.5.10 (transitive, via next)
   - Advisory: GHSA-qx2v-qp2m-jg93 — PostCSS has XSS via Unescaped `</style>` in its CSS Stringify Output
   - CVSS: 6.1 (CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N)
   - CWE: CWE-79
   - Fix available: next@9.3.3 (semver major — breaking change)

2. **next** 9.3.4-canary.0 – 16.3.0-canary.5 (direct, via postcss)
   - Inherits the postcss advisory above
   - Fix available: next@9.3.3 (semver major — breaking change)

#### LOW / INFO findings

None.

## Hints recorded but not acted on

| Hint                    | Value                                                                 |
| ----------------------- | --------------------------------------------------------------------- |
| bootstrapper_confidence | verified                                                              |
| quality_override        | false                                                                 |
| path_taken              | custom                                                                |
| self_check_answers      | typed: true, from_official_starter: true, conventions: true, docs_current: false, can_judge_agent: true |
| team_size               | solo                                                                  |
| deployment_target       | cloudflare-pages                                                      |
| ci_provider             | github-actions                                                        |
| ci_default_flow         | auto-deploy-on-merge                                                  |
| has_auth                | true                                                                  |
| has_payments            | false                                                                 |
| has_realtime            | false                                                                 |
| has_ai                  | true                                                                  |
| has_background_jobs     | false                                                                 |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- `git init` (if you have not already) to start your own repo history.
- Review any `.scaffold` siblings the conflict policy created and decide which version of each file to keep.
- Address audit findings per your project's risk tolerance — the full breakdown is in this log.
