---
project: adaptive-plan
researched_at: 2026-05-27
recommended_platform: Vercel
runner_up: Cloudflare Workers
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Next.js 16
  runtime: Node.js
---

## Recommendation

**Deploy on Vercel.**

Vercel is the native platform for Next.js — zero-config deployment with guaranteed compatibility for every Next.js feature (App Router, Server Components, Server Actions, streaming, ISR). The user has hands-on familiarity with the platform, which directly reduces debugging time on a tight 3-week after-hours timeline. The Hobby plan ($0/mo) covers MVP-scale traffic (1M invocations, 100 GB bandwidth) for non-commercial/personal use. The only criterion where Vercel scored below perfect was MCP integration (Beta, not GA), which is a light-weight tiebreaker — the CLI and deploy API are both GA and fully scriptable.

## Platform Comparison

| Platform | CLI-first | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP/Integration | Total |
|---|---|---|---|---|---|---|
| **Vercel** | Pass | Pass | Pass | Pass | Partial (Beta) | 4.5/5 |
| **Cloudflare Workers** | Pass | Pass | Pass | Pass | Pass (GA) | 5/5 |
| **Render** | Pass | Pass | Pass | Pass | Pass (GA) | 5/5 |
| **Netlify** | Partial | Pass | Pass | Partial | Pass (GA) | 4/5 |
| **Railway** | Partial | Pass | Pass | Partial | Partial (Beta) | 3.5/5 |
| **Fly.io** | Pass | Partial | Partial | Partial | Partial (Experimental) | 3/5 |

### Shortlisted Platforms

#### 1. Vercel (Recommended)

Vercel won on the combination of zero compatibility risk, user familiarity, and free Hobby plan at MVP scale. As the creator of Next.js, Vercel provides zero-config deployment — no adapters, no runtime shims, no bundle size worries. The user's existing familiarity with the platform means less time fighting deployment and more time building features within the 3-week timeline. The Hobby plan's 1M invocations and 100 GB bandwidth comfortably cover MVP traffic. The MCP server is Beta (not GA), which is the only scoring gap — but the Vercel CLI (`vercel deploy --prod`, `vercel rollback`, `vercel logs`) is GA and fully covers agent-driven operations.

#### 2. Cloudflare Workers (Runner-up)

Cloudflare scored highest on raw criteria (5/5 Pass) with the most generous free tier ($0/mo even for commercial use at 100k requests/day) and the best agent tooling ecosystem (GA MCP server with Code Mode, `llms.txt`, markdown docs). However, deploying Next.js 16 on Cloudflare requires the `opennextjs-cloudflare` adapter (the `@cloudflare/next-on-pages` adapter referenced in tech-stack.md is deprecated), and carries real risks: 25 MiB hard bundle size ceiling, edge runtime Node.js API gaps, and a known version trap issue (#13755) between Next.js 16's Proxy architecture and the adapter. These risks make Cloudflare a poor fit for a 3-week after-hours timeline with a solo developer unfamiliar with the platform.

#### 3. Render (Third)

Render matched Cloudflare at 5/5 on criteria scoring — full GA CLI with deploy, rollback, and logs; official MCP server; `llms.txt` and markdown docs. It runs Next.js as a standard Node.js web service, eliminating all edge runtime concerns. The free tier comes with 15-minute spin-down and 30-60 second cold starts; the always-on Starter plan costs $7/mo. Render lost to Vercel on two soft factors: no user familiarity (tie-break) and less Next.js-specific optimization (no ISR tuning, no edge middleware, no Vercel-specific image optimization).

## Anti-Bias Cross-Check: Vercel

### Devil's Advocate — Weaknesses

1. **Hobby plan is non-commercial only.** Vercel's terms are explicit: Hobby is for personal, non-commercial use. If AdaptivePlan ever serves paying users, runs ads, or is used commercially, the upgrade to Pro ($20/mo per developer) is mandatory. There is no middle tier.
2. **1-hour runtime log retention on Hobby.** After-hours debugging means the failing request's logs may be gone before you check. This is a real cost for a solo developer who can't monitor continuously.
3. **App goes offline when limits are hit.** Hobby has no overage billing — it pauses the deployment until the next 30-day cycle. Unexpected traffic spikes (social media shares, community posts) result in downtime, not degraded service.
4. **Vendor lock-in to Vercel-specific optimizations.** Zero-config magic works because Next.js and Vercel are co-developed. The tech-stack.md mentions a "future path to self-hosted VPS + Docker" — migrating away means replacing Vercel-specific ISR caching, image optimization, and edge middleware with self-managed equivalents.
5. **Rollback on Hobby is limited to the previous deployment only.** If a bad deploy goes out and the fix is also broken, you cannot roll back to the last-known-good — only to the immediately prior (also broken) deployment. Pro allows rollback to any earlier deployment.

### Pre-Mortem — How This Could Fail

The developer deployed the fitness plan generator to Vercel Hobby. MVP launched on time — zero compatibility issues, no platform fights. The first two months were smooth. Then a friend shared the app in a fitness community Discord. Traffic spiked to 50k requests in a day. The app hit the 4 CPU-hour monthly limit on day 18 and went offline for 12 days until the billing cycle reset. The developer upgraded to Pro ($20/mo) to restore service. On Pro, the LLM generation endpoint — calling the Vercel AI SDK with Anthropic — ran 15-20 seconds per request during peak. Function duration (60s max) wasn't an issue, but CPU time accumulated faster than expected. Monthly costs stabilized around $25-35/mo — manageable, but a jump from "free" that hadn't been budgeted. Meanwhile, 1-hour log retention on Hobby had trained the developer not to rely on platform logs, and the migration to Pro's 1-day retention didn't change the debugging workflow — logs were still too short for the after-hours schedule.

### Unknown Unknowns

- **Vercel AI SDK streaming holds serverless function slots.** Long-running AI generation (10-30s) keeps a function alive the entire time. Vercel's Fluid Compute reuses instances, but each concurrent generation holds a slot. With concurrent users, you may hit the 10 concurrent executions limit on Hobby before hitting request count limits.
- **Hobby-to-Pro migration isn't just a billing change.** Upgrading requires creating or joining a "team" (even solo). This changes Git integration behavior, may require re-linking the repository, and the project URL structure changes. Plan the upgrade path before you need it under pressure.
- **ISR provides zero value for this app.** Each user gets a unique AI-generated plan — there is nothing to cache statically. ISR, Vercel's signature optimization, does not apply to personalized AI-generated content.
- **The Vercel AI SDK is a Vercel product.** While it works on any platform, its development priorities align with Vercel's roadmap. This is an advantage now (best integration) but deepens vendor coupling if you migrate to self-hosted later.

## Operational Story

- **Preview deploys**: Every push to a non-production branch generates a unique preview URL (`<branch>-<project>.vercel.app`). Preview deployments are automatic on Git push; fork PRs require explicit approval. Hobby plan supports unlimited preview deployments.
- **Secrets**: Environment variables are set via `vercel env add <key> <environment>` (production / preview / development). Values are encrypted at rest. Access is limited to the project owner on Hobby. Rotation: `vercel env rm <key>` then `vercel env add <key>` — no single rotate command.
- **Rollback**: `vercel rollback [deployment-id]` — instant, atomic switch to a previous deployment. On Hobby: previous deployment only. On Pro: any historical deployment. Typical time-to-revert: < 5 seconds. Database migrations are NOT rolled back automatically — Drizzle migrations must be reversed manually.
- **Approval**: Human-required actions: publish to production (`vercel deploy --prod`), rotate secrets, delete the project, upgrade plan. Agent-safe actions: preview deploys, reading logs, listing deployments and environment variables.
- **Logs**: `vercel logs --environment production --since 30m` for runtime logs (1-hour retention on Hobby, 1-day on Pro). `vercel logs --output json` for structured output. Build logs are available via `vercel inspect <deployment-url>`.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| Non-commercial restriction forces $20/mo upgrade | Devil's advocate | M | M | Start on Hobby for personal MVP. Budget $20/mo Pro if the app goes commercial. Monitor Vercel's plan changes. |
| App goes offline when Hobby limits are hit | Devil's advocate | L | H | Set up Vercel usage alerts. If traffic spikes, upgrade to Pro immediately ($20/mo includes overage billing). |
| 1-hour log retention makes after-hours debugging hard | Devil's advocate | H | M | Add structured logging to the app (e.g., Axiom free tier, or console.log with JSON format for searchability). Don't rely solely on platform logs. |
| AI generation burns CPU budget faster than web requests | Pre-mortem | M | M | Monitor CPU-hour consumption via Vercel dashboard. If approaching 4 CPU-hrs/mo on Hobby, optimize generation (shorter prompts, model choice) or upgrade. |
| Hobby-to-Pro migration disrupts Git integration | Unknown unknowns | L | M | Create the Vercel project under a personal account (not org). Document the exact migration steps before they're needed. |
| Rollback on Hobby limited to previous deploy only | Devil's advocate | L | H | Test deploys on preview URLs before promoting to production. Keep a local record of known-good commit hashes. |
| Vendor lock-in blocks future migration to VPS + Docker | Devil's advocate | L | L | Avoid Vercel-specific APIs where standard Next.js equivalents exist. Keep deployment config minimal. The Vercel AI SDK and Supabase both work on any Node.js host. |
| Concurrent AI requests exhaust serverless function slots | Unknown unknowns | L | M | Vercel's Fluid Compute reuses function instances. For MVP traffic (low QPS per PRD), unlikely to be an issue. Monitor if user count grows. |

## Getting Started

1. **Install the Vercel CLI**: `npm i -g vercel`
2. **Link the project**: `cd /Users/djakubas/projects/adaptive-plan && vercel link` — follow the prompts to connect to your Vercel account and create the project.
3. **Set environment variables**: `vercel env add NEXT_PUBLIC_SUPABASE_URL production` and `vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production` (add all Supabase and AI provider keys).
4. **Deploy a preview**: `vercel deploy` — verify the preview URL works.
5. **Deploy to production**: `vercel deploy --prod` — the app is live at `<project>.vercel.app`.

Note: `npm run dev` (`next dev`) runs the local dev server with full fidelity — no platform-specific adapter or runtime shim is needed. What works locally works on Vercel.

## Out of Scope

The following were not evaluated in this research:
- Docker image configuration
- CI/CD pipeline setup (GitHub Actions auto-deploy-on-merge is planned in tech-stack.md but not configured here)
- Production-scale architecture (multi-region, HA, DR)
