---
project: adaptive-plan
deployed_at: 2026-05-27
platform: vercel
plan: hobby
production_url: https://adaptive-plan-k3qicgdc1-d1mk4codes-projects.vercel.app
vercel_project: d1mk4codes-projects/adaptive-plan
vercel_account: d1mk4-code
github_repo: damianjakubas/adaptive-plan
branch: main
---

## Deployment Summary

First deployment of the AdaptivePlan Next.js 16 scaffold to Vercel Hobby plan. The deployment pipeline is fully operational: preview deploys on branch push, production deploys on merge to `main`, GitHub integration connected.

### Phases Completed

- [x] Phase 0: Pre-flight checks (build, lint, tsc, CLIs installed)
- [x] Phase 1: Vercel project setup (CLI v54.5.0, authenticated, project linked)
- [x] Phase 2: Preview deploy (verified)
- [x] Phase 3: Production deploy (verified)
- [x] Phase 4: GitHub integration (auto-deploy on push/merge)
- [x] Phase 5: Environment variable scaffolding
- [x] Phase 6: Documentation alignment (Cloudflare → Vercel)

### CLIs Installed

| Tool | Version |
|------|---------|
| vercel | 54.5.0 |
| supabase | 2.101.0 |
| gh | 2.92.0 |

## Environment Variables

| Key | Vercel Environments | Status |
|-----|-------------------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Development, Preview, Production | Set |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Development, Preview, Production | Set |
| `SUPABASE_SERVICE_ROLE_KEY` | Production | Set |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Development, Preview, Production | Set |

All keys are configured. `vercel env pull .env.development.local` provides a complete local dev environment.

## External Services

| Service | Status | Account |
|---------|--------|---------|
| Vercel | Active (Hobby plan) | d1mk4-code |
| GitHub | Repo connected, auto-deploy on | damianjakubas/adaptive-plan |
| Supabase | Project created, auth configured | Free plan |
| Google Gemini | API key configured (Gemini 2.5 Flash free tier) | aistudio.google.com |

## Platform Decision

Vercel was chosen over Cloudflare Workers (runner-up) and Render (third) per `context/foundation/infrastructure.md`. Key reasons: zero-config Next.js deployment, user familiarity, free Hobby plan at MVP scale. The `tech-stack.md` originally specified Cloudflare Pages but was updated to Vercel after infrastructure research.

## Hobby Plan Risks (from infrastructure.md)

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Non-commercial restriction forces $20/mo Pro upgrade | Medium | Start personal, budget Pro if commercial |
| App pauses when limits hit (no overage billing) | Low | Set usage alerts, upgrade if traffic spikes |
| 1-hour log retention | High | Add structured logging (Axiom free tier) |
| AI generation burns CPU budget faster than web requests | Medium | Monitor CPU-hours, optimize prompts |
| Rollback limited to previous deploy only | Low | Test on preview URLs before promoting to prod |

## Hobby-to-Pro Upgrade Path

1. Go to Vercel Dashboard → Settings → Billing
2. Upgrade to Pro ($20/mo per developer)
3. This creates/requires a "team" even for solo use — changes Git integration behavior
4. May need to re-link the repository
5. Plan this before you need it under pressure

## Supabase Free Plan Limits

| Limit | Value |
|-------|-------|
| Database | 500 MB |
| Bandwidth | 2 GB |
| Monthly active users | 50,000 |
| File storage | 1 GB |
| Inactivity pause | After 1 week (restarts on next request, ~30s cold start) |
| Email rate limit | 4 emails/hour (built-in SMTP) |

## Documentation Changes

- `context/foundation/tech-stack.md`: `deployment_target` changed from `cloudflare-pages` to `vercel`, prose updated
- `AGENTS.md`: deployment target line updated from Cloudflare to Vercel with production URL
- `context/changes/bootstrap-verification/verification.md`: NOT modified (historical record — Cloudflare reference preserved as bootstrap-time snapshot)
- `.env.example`: created with 4 key names (Supabase + Gemini)
- `.gitignore`: `!.env.example` exception added
- `src/app/layout.tsx`: metadata title updated from "Create Next App" to "AdaptivePlan"
