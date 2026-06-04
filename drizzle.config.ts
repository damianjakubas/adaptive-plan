import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

// drizzle-kit runs outside Next.js. Load env in development mode (the `true`) so it
// reads `.env.development.local` in addition to `.env.local` — matching `next dev`.
// Without it, `@next/env` defaults to production mode and skips `.env.development.local`.
loadEnvConfig(process.cwd(), true);

// Migrations need the **direct / session** connection (statement-friendly), NOT the
// transaction pooler (`:6543`) the runtime uses. `?? ""` keeps `drizzle-kit generate`
// (which never connects) working before the env var is set; `migrate`/`push` fail
// loudly with an empty URL until `DIRECT_URL` is configured.
export default defineConfig({
  dbCredentials: { url: process.env.DIRECT_URL ?? "" },
  dialect: "postgresql",
  out: "src/db/migrations",
  schema: "src/db/schema.ts",
});
