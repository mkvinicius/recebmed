import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

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