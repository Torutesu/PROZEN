// Migration runner — executes SQL files from db/migrations/ in filename order.
// Never edits existing files. Treat SQL files as immutable contracts.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

export async function runMigrations(databaseUrl: string): Promise<void> {
  const sql = postgres(databaseUrl, { max: 1 });

  try {
    const migrationsDir = path.resolve(process.cwd(), "db/migrations");
    const files = (await readdir(migrationsDir))
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const migration = await readFile(
        path.join(migrationsDir, file),
        "utf-8",
      );
      process.stdout.write(`[migrate] Running: ${file}\n`);
      await sql.unsafe(migration);
    }

    process.stdout.write("[migrate] All migrations complete.\n");
  } finally {
    await sql.end();
  }
}

// Entrypoint when invoked directly: node dist/src/db/migrate.js
const url = process.env["DATABASE_URL"];
if (!url) {
  process.stderr.write("DATABASE_URL is required\n");
  process.exit(1);
}
await runMigrations(url);
