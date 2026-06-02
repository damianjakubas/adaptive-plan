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

## Code Conventions

### 1. Interfaces AFTER the function/component (KEY RULE)

Props and other local types are **always** declared after the function body, never before.

```typescript
// ✅ CORRECT
function MyComponent({ title, onSubmit }: Props) {
  return <div>{title}</div>;
}
interface Props { title: string; onSubmit: () => void; }
export default MyComponent;
```

### 2. Exports

- Default components/functions: `export default` at the end (or inline)
- Named exports: explicit `export { ... }` block at the end, or `export` at declaration
- Multi-file directories: barrel `index.ts`

Hook file pattern:

```typescript
function useMyHook(params: Params) {
  /* ... */
}
interface Params {
  id: string;
}
export { type Params };
export default useMyHook;
```

### 3. Alphabetical Sort (enforced by ESLint)

Object keys (`sort-keys-fix`), imports (`import/order`), and variable lists (`sort-vars`) must be sorted asc. Imports: external modules before `@/` aliases.

### 4. File Naming

`kebab-case.ts(x)` · Hooks: `use-*.ts(x)` · Zod schemas: `*-schema.ts` · Rights: `*-rights.ts`

### 5. Path Alias

Always `@/...` for imports outside the current directory. Relative paths only for same-directory imports.

### 6. No console.log

ESLint enforces `no-console`. Use `toast` (sonner) or `handleApiError` instead.

### 8. No `any`

Forbidden. Use `interface`, `type`, or a more specific safe type — never `any`.

### 9. Helpers in Separate Files

Component files contain **only**: imports, the component, local `interface Props` (after the component per rule 1), `export default`. **No** pure functions, helpers, transformers, mappers, or formatters in component files — before or after.

- **Local scope** (this component / neighboring components in same module) → separate file in the same folder (e.g. `data-grid/like-value.ts`).
- **Globally reusable** → module `helpers/` folder (e.g. `domains/helpers/is-domain-expired.ts`) or global `src/helpers/`.

**Exceptions allowed in the component file:**

- Inline event handlers / closures used once in JSX (`onClick={() => ...}`).
- Pure inline callbacks for TanStack / RHF / Zod schemas (e.g. `accessorFn: (record) => record.foo`).

Anything else — a named function with business logic — leaves the component file. Reason: SOLID (SRP), DRY (testable in isolation), readability (component = "what", helper = "how").

### 10. Smart / Dumb Component Split

- **Smart (container)** — calls hooks, fetches data, owns state. Minimal JSX; passes data down as props.
- **Dumb (presentational)** — pure function of props. No data fetching, no side effects, no hooks beyond local UI state.

Push `"use client"` as far down the tree as possible — Server Components are smart, Client Components should be dumb. Try to use compound components instead of heavy-loaded prop components with a lot of logic inside.

Try to split when a component both fetches data and contains significant markup.
