---
change_id: plan-generation
type: external-library-research
created: 2026-06-01
sources: exa.ai web search
note: >
  External research (library selection / ecosystem) — answers "what should we
  use?". Complements internal codebase research. Feeds /10x-plan as evidence.
---

# Research: Libraries for S-02 (plan-generation)

Scope: identify the libraries needed to deliver S-02's four capabilities — 12-field
parameter form, AI generation, streaming display, persistence — verified compatible
with the locked stack (Next.js 16, React 19, TypeScript 5, Tailwind 4) and the
additions named in `context/foundation/tech-stack.md` (Supabase, Drizzle, Zod,
Vercel AI SDK, Zustand, React Hook Form).

The headline libraries were already chosen in `tech-stack.md`. This research confirms
they are current on Next 16 / React 19 and fills in the **companion packages** and
**version-pairing constraints** the stack doc does not capture.

---

## 1. AI generation + streaming display (FR-004, FR-005)

| Package | Role |
| --- | --- |
| `ai` (v6) | Core SDK — `streamText` + `Output.object({ schema })` on the server |
| `@ai-sdk/react` | `experimental_useObject` hook — consumes the stream, renders partial objects |
| Vercel AI Gateway (built into `ai`) | Model provider via plain `'provider/model'` string |

**Findings:**

- In AI SDK **v6** the streaming-object API is `streamText` with `output: Output.object({ schema })`, returned via `result.toTextStreamResponse()` — **not** the older `streamObject` call.
- `experimental_useObject` (from `@ai-sdk/react`) is the streaming-display primitive: it parses the JSON stream and exposes `{ object, submit, isLoading, stop }`, where `object` is updated with **partial** results as chunks arrive — this *is* FR-005's "streaming progress". React-only (fine here).
- Define the plan Zod schema in a **shared file** imported by both server route and client `useObject`. Partial streamed objects are `DeepPartial`, so every field must be guarded with `?.` in JSX.
- **Provider = Vercel AI Gateway (default).** Passing a plain string like `'anthropic/claude-...'` routes through the Gateway automatically — **no `@ai-sdk/anthropic` / `@ai-sdk/openai` package required**. One `AI_GATEWAY_API_KEY` env var. Gives provider failover, `caching: 'auto'` (50–80% prompt-cache savings on a large system prompt), and unified observability at zero token markup. Direct provider SDKs only win for niche provider-specific features or private-network constraints.
- **Timeout:** a long plan generation can be slow — set `export const maxDuration = …` in the route handler (Vercel default is now 300s).

**Sources:**
- AI SDK UI: Object Generation — https://ai-sdk.dev/docs/ai-sdk-ui/object-generation
- AI SDK Core: Generating Structured Data — https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data
- Choosing a Provider — https://ai-sdk.dev/docs/getting-started/choosing-a-provider
- AI Gateway + AI SDK — https://vercel.com/docs/ai-gateway/sdks-and-apis/ai-sdk
- AI Gateway deep dive (v6, Apr 2026) — https://www.rabinarayanpatra.com/blogs/vercel-ai-gateway-deep-dive

---

## 2. The 12-field parameter form (FR-003)

| Package | Role | Constraint |
| --- | --- | --- |
| `react-hook-form` (v7.x) | Form state | Works on Next 16 / React 19 |
| `@hookform/resolvers` (**v5.2.x**) | Zod bridge | **Must be v5+** |
| `zod` | Schema + validation | Shared with the AI schema |
| shadcn `Form` / `Field` components | Accessible field wiring | Installed via shadcn CLI, not npm |

**Findings:**

- Confirmed RHF v7 + Zod + shadcn is the standard Next.js 16 / React 19 form pattern (shadcn forms masterclass repo targets exactly this matrix).
- **Version pairing matters:** `zod v4 + @hookform/resolvers v3` throws a runtime `ZodError` instead of populating field errors. Fix = `@hookform/resolvers` **v5.2.x**.
- shadcn `FormControl` injects `aria-invalid` / `aria-describedby`; don't skip it or screen readers won't announce errors. Newer `Field`/`FieldGroup` pattern and classic `Form`/`FormField` both valid. Set `defaultValues` for every field to avoid uncontrolled→controlled warnings.

**⚠️ Gotcha (open bug):** RHF #13110 — on **Next.js 16 + Server Actions**, `form.reset()` after a successful submit causes phantom validation errors on the *next* submit. Workaround until PR #13139 lands: use `form.resetField()` per field, or set `reValidateMode: 'onSubmit'`. Relevant only if the form is reset after a successful generation.

**Sources:**
- shadcn React Hook Form — https://ui.shadcn.com/docs/forms/react-hook-form
- shadcn forms masterclass (Next 16 / React 19 / RHF 7 / Zod / Tailwind 4) — https://github.com/shadcnstudio/shadcn-forms-masterclass
- shadcn forms best practices — https://llmbestpractices.com/frontend/shadcn-forms
- RHF #13110 (reset bug on Next 16 + Server Actions) — https://github.com/react-hook-form/react-hook-form/issues/13110
- Version-mismatch ZodError — https://stackoverflow.com/questions/79739854

---

## 3. Persistence — "latest plan = active plan" (FR-006)

| Package | Role |
| --- | --- |
| `drizzle-orm` + `postgres` (postgres-js driver) | ORM + driver |
| `drizzle-kit` (dev dep) | Migrations / introspection |
| `jwt-decode` *(optional)* | Only for an RLS-aware browser-side client |

**Findings:**

- Drizzle's own docs recommend the **`postgres-js`** driver for Supabase (faster than node-postgres here). `drizzle(client, { schema })`.
- **⚠️ `prepare: false` is mandatory** on the Supabase **transaction pooler** (port `6543`) — it does not support prepared statements (postgres-js uses them by default). Skipping it → "prepared statement already exists" 502s in production on Vercel. Confirmed across Drizzle docs, Supabase docs, and a production migration field report.
- **Connection-string split:** use the **pooler URL (`:6543`)** for the serverless app runtime; use the **direct or session-pooler** connection for `drizzle-kit` migrations (schema changes need a statement-friendly connection).
- RLS: if you only query Postgres from **server** code you can leave RLS off (document it). RLS-aware browser access needs the JWT-claims-in-transaction pattern (`jwt-decode` + `set_config` inside `runTransaction`).
- FR-006 ("one active plan, latest replaces previous") is a **schema-design** decision (overwrite-in-place vs insert-and-flag) — no extra library; Drizzle handles either. Defer the choice to `/10x-plan`.

**Sources:**
- Drizzle <> Supabase — https://orm.drizzle.team/docs/connect-supabase
- Supabase Drizzle guide (May 2026) — https://supabase.com/docs/guides/database/drizzle
- Neon→Supabase migration field report (Next 16 + Drizzle, prod) — https://dev.to/blackie360/migrating-from-neon-to-supabase-postgres-drizzle-in-production-4ekh
- Drizzle RLS-aware client recipe — https://makerkit.dev/docs/next-supabase-turbo/recipes/drizzle-supabase

---

## 4. Client state (already in stack)

`zustand` covers any UI state shared across the generation flow (e.g. status shared
between form and display). But `useObject` already exposes `{ object, submit, isLoading, stop }`,
so reach for Zustand only if state genuinely needs to live outside the hook.

---

## Net new dependencies for S-02

```
ai @ai-sdk/react                      # AI generation + streaming (Gateway built in)
react-hook-form @hookform/resolvers   # form — resolvers MUST be v5+
drizzle-orm postgres                  # persistence
drizzle-kit                           # dev: migrations
# zod, zustand          — already in tech-stack.md
# shadcn Form/Field     — via shadcn CLI, not npm
# jwt-decode            — only if RLS-aware client
```

No model-provider package (Gateway handles it via `'provider/model'` strings).

## Decisions to resolve in /10x-plan

1. **Model string** — which `'provider/model'` (e.g. Anthropic vs OpenAI) and whether to set provider routing/fallback via `providerOptions.gateway`.
2. **FR-006 schema shape** — overwrite-in-place vs insert + `is_active` flag.
3. **RLS on/off** — server-only access (RLS off, documented) vs RLS-aware client.
4. **Plan output shape** — the shared Zod schema for the generated plan (routine, calorie target, progression, timeline), which drives both `Output.object` and `useObject`.
5. **Form reset strategy** — given RHF #13110, decide reset approach if the form clears after generation.

## Caveats

- Version *ranges* verified current as of 2026-06-01; exact pinned versions not fetched (Context7 can confirm if needed).
- `experimental_useObject` carries an `experimental_` prefix — API is stable in practice but could change across `ai` minor versions.
