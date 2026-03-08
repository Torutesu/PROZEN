import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema.js";

function requireDatabaseUrl(): string {
  const url = process.env["DATABASE_URL"];
  if (!url) throw new Error("DATABASE_URL environment variable is required");
  return url;
}

// Lazily initialized — allows tests to set DATABASE_URL before first import use.
let _db: ReturnType<typeof drizzle> | null = null;
let _sql: ReturnType<typeof postgres> | null = null;

function createClient() {
  return postgres(requireDatabaseUrl(), {
    max: 10,           // max pool size
    idle_timeout: 30,  // seconds before idle connection is closed
    connect_timeout: 10, // seconds to wait for a new connection
  });
}

export function getDb() {
  if (!_db) {
    _sql = createClient();
    _db = drizzle(_sql, { schema });
  }
  return _db;
}

export function getSqlClient() {
  if (!_sql) {
    _sql = createClient();
    _db = drizzle(_sql, { schema });
  }
  return _sql;
}

export async function closeDb(): Promise<void> {
  if (_sql) {
    await _sql.end();
    _sql = null;
    _db = null;
  }
}

export type Db = ReturnType<typeof getDb>;
