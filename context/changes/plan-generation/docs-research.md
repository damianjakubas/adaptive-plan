---
change_id: plan-generation
type: external-library-docs
created: 2026-06-01
sources: Context7 MCP (live docs)
note: >
  Doc-verified API reference for the libraries selected in research.md. Each
  finding from research.md is confirmed here against live documentation fetched
  via Context7. Feeds /10x-plan as implementation-ready evidence for S-02.
---

# Docs Research: Library APIs for S-02 (plan-generation)

Companion to `research.md` (which answered *what to use*). This file answers
*how to use it* — concrete, doc-verified API snippets for each S-02 capability,
fetched via Context7 on 2026-06-01.

**Context7 library IDs used:**

| Library | Context7 ID |
| --- | --- |
| AI SDK (`ai`, `@ai-sdk/react`) | `/websites/ai-sdk_dev` |
| Drizzle ORM | `/drizzle-team/drizzle-orm-docs` |
| React Hook Form Resolvers | `/react-hook-form/resolvers` |
| shadcn/ui | `/shadcn-ui/ui` |

---

## 1. AI generation + streaming display (FR-004, FR-005) — `ai` v6 + `@ai-sdk/react`

**Confirmed:** v6 streaming-object API is `streamText` + `output: Output.object({ schema })`
returned via `result.toTextStreamResponse()`. The older `streamObject` call is gone.

### Server route

```typescript
// app/api/generate-plan/route.ts
import { streamText, Output } from 'ai';
import { planSchema } from '@/.../plan-schema'; // shared with client

export const maxDuration = 60; // long generation; Vercel default is now 300s

export async function POST(req: Request) {
  const params = await req.json();
  const result = streamText({
    model: 'anthropic/claude-sonnet-4.6',   // plain string → routes via AI Gateway
    output: Output.object({ schema: planSchema }),
    prompt: `Generate a training plan for: ${JSON.stringify(params)}`,
  });
  return result.toTextStreamResponse();
}
```

### Client

**Confirmed:** `experimental_useObject` (from `@ai-sdk/react`) exposes
`{ object, submit, isLoading, stop }`; `object` updates with **partial** results
as chunks arrive (`DeepPartial` — guard every field with `?.`).

```typescript
'use client';
import { experimental_useObject as useObject } from '@ai-sdk/react';
import { planSchema } from '@/.../plan-schema';

const { object, submit, isLoading, stop } = useObject({
  api: '/api/generate-plan',
  schema: planSchema,          // single object — DON'T wrap in z.array()
});                            // (z.array wrapping is only for array streams)
// object?.routine?.map(...)   ← partial-safe access
```

> **Note on `z.array()`:** the cookbook example wraps the schema in `z.array()`
> on *both* server and client only when streaming a *list*. A single plan object
> needs no wrapping.

---

## 2. AI Gateway (provider/model) — built into `ai`

**Confirmed:** one env var `AI_GATEWAY_API_KEY`; plain `'provider/model'` strings
are the default global provider. No `@ai-sdk/anthropic` / `@ai-sdk/openai` package.

```env
AI_GATEWAY_API_KEY=your_api_key_here
```

Three equivalent ways to reference a model:

```typescript
// Default global provider (plain string)
model: 'anthropic/claude-sonnet-4.6';

// Explicit helper from 'ai' (included by default)
import { gateway } from 'ai';
model: gateway('anthropic/claude-sonnet-4.6');

// Or from the standalone package
import { gateway } from '@ai-sdk/gateway';
```

Provider routing / failover via `providerOptions.gateway`:

```typescript
import type { GatewayProviderOptions } from '@ai-sdk/gateway';

model: 'anthropic/claude-sonnet-4.6',
providerOptions: {
  gateway: {
    order: ['vertex', 'anthropic'], // try Vertex first, then Anthropic
    only:  ['vertex', 'anthropic'], // restrict to these providers
  } satisfies GatewayProviderOptions,
  // provider-specific opts keyed by real provider name:
  anthropic: { thinking: { type: 'enabled', budgetTokens: 12000 } },
},
```

---

## 3. The 12-field form (FR-003) — `react-hook-form` v7 + `@hookform/resolvers` v5 + shadcn

**Confirmed:** `zodResolver` auto-detects Zod v3/v4. **Number fields require
`valueAsNumber`** (relevant — body stats are numeric). Set `defaultValues` for
every field to avoid uncontrolled→controlled warnings.

```typescript
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';

const formSchema = z.object({
  weightKg: z.number().min(30),
  // ...the other 11 fields
});

const form = useForm<z.infer<typeof formSchema>>({
  resolver: zodResolver(formSchema),
  defaultValues: { weightKg: 0 /* every field */ },
});

// numeric input:
// <input type="number" {...register('weightKg', { valueAsNumber: true })} />
```

### shadcn `Form` wiring

**Confirmed:** `FormField` wraps RHF's `Controller`; `FormControl` injects
`aria-invalid` / `aria-describedby`; `FormMessage` auto-renders the error from
`fieldState` (don't skip `FormControl` or screen readers won't announce errors).

Composition: `Form` → `FormField` → `FormItem` → `FormLabel` → `FormControl` → `FormMessage`.

```tsx
const form = useForm<z.infer<typeof formSchema>>({
  resolver: zodResolver(formSchema),
  defaultValues: { title: '', description: '' },
});

function onSubmit(data: z.infer<typeof formSchema>) { /* ... */ }

<form onSubmit={form.handleSubmit(onSubmit)}>{/* FormField blocks */}</form>
```

The newer `Field` / `FieldGroup` + `Controller` pattern is also valid — useful
for `<Select>` dropdowns (work mode, equipment access), binding `value` /
`onValueChange`:

```tsx
<Controller
  name="language"
  control={form.control}
  render={({ field, fieldState }) => (
    <Field data-invalid={fieldState.invalid}>
      <FieldLabel htmlFor="lang">Spoken Language</FieldLabel>
      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
      <Select name={field.name} value={field.value} onValueChange={field.onChange}>
        <SelectTrigger id="lang" aria-invalid={fieldState.invalid}>
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="en">English</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  )}
/>
```

Install via CLI (not npm): `npx shadcn@latest add form select input`.

> ⚠️ **Still applies (from research.md):** RHF #13110 — `form.reset()` after a
> successful submit on Next 16 + Server Actions causes phantom validation errors
> on the next submit. Workaround: `form.resetField()` per field, or
> `reValidateMode: 'onSubmit'`. Only relevant if the form clears post-generation.

---

## 4. Persistence (FR-006) — `drizzle-orm` + `postgres` (postgres-js)

**Confirmed:** `prepare: false` is mandatory on Supabase's **Transaction** pool
mode (port `6543`) — postgres-js uses prepared statements by default, which the
transaction pooler does not support.

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Disable prefetch — not supported for "Transaction" pool mode
const client = postgres(process.env.DATABASE_URL!, { prepare: false });
export const db = drizzle({ client });
```

### Migrations (`drizzle-kit`)

**Confirmed:** migrations need a statement-friendly connection — use the
**direct / session-pooler** URL in `drizzle.config.ts`, not the `:6543` pooler.

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/.../schema.ts',
  dbCredentials: { url: process.env.DIRECT_URL! },
});
```

```shell
npx drizzle-kit generate   # create migration from schema
npx drizzle-kit migrate    # apply
```

---

## Net-new dependencies (unchanged from research.md)

```
ai @ai-sdk/react                      # AI generation + streaming (Gateway built in)
react-hook-form @hookform/resolvers   # form — resolvers MUST be v5+
drizzle-orm postgres                  # persistence
drizzle-kit                           # dev: migrations
# zod, zustand        — already in tech-stack.md
# shadcn Form/Field   — via shadcn CLI, not npm
```

## Decisions still open for /10x-plan

The docs above confirm the libraries support either path — they do **not** decide:

1. **Model string** — which `'provider/model'` + whether to set `providerOptions.gateway` routing/fallback.
2. **FR-006 schema shape** — overwrite-in-place vs insert + `is_active` flag.
3. **RLS on/off** — server-only (RLS off, documented) vs RLS-aware client.
4. **Plan output Zod schema** — the shared schema driving both `Output.object` and `useObject`.
5. **Form reset strategy** — given RHF #13110.
