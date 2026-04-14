import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";
import { sql } from "drizzle-orm";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

const connStr = process.env.DATABASE_URL!;
const url = new URL(connStr);
if (!url.searchParams.has("sslmode")) {
  url.searchParams.set("sslmode", "require");
}

const pool = new pg.Pool({
  connectionString: url.toString(),
});

export const db = drizzle(pool, { schema });

/**
 * Executa `fn` dentro de uma transação com `app.current_user_id` definido.
 * Necessário quando RLS está ativo (001_rls_policies.sql).
 * Operações de sistema (audit scheduler) passam userId = null para bypass via
 * `app.bypass_rls = true`.
 */
export async function withUserContext<T>(
  userId: string | null,
  fn: () => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    if (userId) {
      await tx.execute(sql`SELECT set_config('app.current_user_id', ${userId}, true)`);
    } else {
      await tx.execute(sql`SELECT set_config('app.bypass_rls', 'true', true)`);
    }
    return fn();
  });
}