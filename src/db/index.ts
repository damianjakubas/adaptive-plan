import { drizzle } from "drizzle-orm/postgres-js";
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
 */
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Expected the Supabase transaction pooler URL (port :6543)."
  );
}

const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
