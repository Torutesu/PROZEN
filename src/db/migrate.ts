// Migration runner — executes SQL files from db/migrations/ in filename order.
// Never edits existing files. Treat SQL files as immutable contracts.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

export async function runMigrations(databaseUrl: string): Promise<void> {
  const sql = postgres(databaseUrl, { max: 1 });

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    const migrationsDir = path.resolve(process.cwd(), "db/migrations");
    const files = (await readdir(migrationsDir))
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const alreadyApplied = await sql<
        { name: string }[]
      >`SELECT name FROM schema_migrations WHERE name = ${file} LIMIT 1`;
      if (alreadyApplied.length > 0) {
        process.stdout.write(`[migrate] Skipping already applied: ${file}\n`);
        continue;
      }

      const migration = await readFile(
        path.join(migrationsDir, file),
        "utf-8",
      );
      process.stdout.write(`[migrate] Running: ${file}\n`);
      await sql.unsafe(migration);
      await sql`INSERT INTO schema_migrations (name) VALUES (${file})`;
    }

    process.stdout.write("[migrate] All migrations complete.\n");
  } finally {
    await sql.end();
  }
}

// Entrypoint when invoked directly: node dist/src/db/migrate.js
const isMain =
  typeof process.argv[1] === "string" &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const url = process.env["DATABASE_URL"];
  if (!url) {
    process.stderr.write("DATABASE_URL is required\n");
    process.exit(1);
  }
  await runMigrations(url);
}
