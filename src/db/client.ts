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

export function getDb() {
  if (!_db) {
    _sql = postgres(requireDatabaseUrl());
    _db = drizzle(_sql, { schema });
  }
  return _db;
}

export async function closeDb(): Promise<void> {
  if (_sql) {
    await _sql.end();
    _sql = null;
    _db = null;
  }
}

export type Db = ReturnType<typeof getDb>;
