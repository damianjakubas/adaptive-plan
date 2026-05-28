---
starter_id: next
package_manager: npm
project_name: adaptive-plan
hints:
  language_family: js
  team_size: solo
  deployment_target: vercel
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
---

## Why this stack

Solo developer with a 3-week after-hours timeline building a personalized fitness training plan generator with auth and AI/LLM generation. Next.js is the direct match for the explicit preference and clears all four agent-friendly gates; bootstrapper confidence is verified, so scaffolding will be smooth. The specific library preferences — Supabase (auth + Postgres), Drizzle ORM, Zod, Vercel AI SDK, Zustand, React Hook Form — are all mainstream npm additions on the Next.js scaffold. Vercel is the deployment target (Hobby plan, zero-config Next.js deployment), with a future path to self-hosted VPS + Docker. CI runs on GitHub Actions with auto-deploy-on-merge via Vercel's GitHub integration.
