import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";

/**
 * Single shared Drizzle client for server-side queries.
 *
 * Connects over the Supabase **transaction pooler** (`DATABASE_URL`, port `:6543`).
 * `prepare: false` is mandatory there — the transaction pooler does not support
 * prepared statements, and omitting it causes "prepared statement already exists"
 * errors under serverless load. Migrations use the direct connection instead (see
 * `drizzle.config.ts`).
 *
 * Initialization is **lazy**: the connection (and the `DATABASE_URL` requirement)
 * is established on first query, not at import time. This keeps the module safe to
 * import during `next build` page-data collection and in CI, where live DB
 * credentials are absent — the error only surfaces when a query actually runs.
 */
let instance: PostgresJsDatabase<typeof schema> | undefined;

function getDb(): PostgresJsDatabase<typeof schema> {
  if (!instance) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is not set. Expected the Supabase transaction pooler URL (port :6543)."
      );
    }
    const client = postgres(connectionString, { prepare: false });
    instance = drizzle(client, { schema });
  }
  return instance;
}

/**
 * Lazily-initialized Drizzle client. Property access (`db.select`, `db.transaction`,
 * …) resolves through `getDb()` so the connection is created on first use.
 */
export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    const target = getDb();
    const value = Reflect.get(target, prop, receiver);
    return typeof value === "function" ? value.bind(target) : value;
  },
});
