# Repository Guidelines

## Next.js Version Warning

This project uses Next.js 16 which has breaking changes from earlier versions. Read `node_modules/next/dist/docs/` before writing code that touches routing, middleware, or server components.

## Commands (npm only — do not use yarn/pnpm)

- `npm run dev` — start Next.js dev server (localhost:3000)
- `npm run build` — production build
- `npm run lint` — ESLint (flat config, core-web-vitals + typescript)
- `npx tsc --noEmit` — type-check without emitting

## Project

AdaptivePlan — a personalized fitness training plan generator. Users input body stats, health constraints, lifestyle context, and goals; an LLM generates a tailored training plan with routine, calorie target, progression, and timeline. Two locales: Polish and English. One active plan per user (latest replaces previous). See `@context/foundation/prd.md` for full PRD.

## Tech Stack

Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS 4. Planned additions per `@context/foundation/tech-stack.md`: Supabase (auth + Postgres), Drizzle ORM, Zod, Vercel AI SDK, Zustand, React Hook Form. Deployment target: Vercel (Hobby plan, zero-config). Production: https://adaptive-plan-k3qicgdc1-d1mk4codes-projects.vercel.app

## Context Directory

- `context/foundation/` — PRD, tech stack decisions, shape notes (read-only references)
- `context/changes/` — change verification records
- `context/archive/` — immutable; never write to this directory

## Design

App design can be located inside foundation/DESIGN.md with specific page views inside foundation/design/ folder
Use shadcn components alongside with shadcn MCP servcer
