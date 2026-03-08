import { and, eq } from "drizzle-orm";
import { getDb, closeDb } from "../db/client.js";
import { githubConnections } from "../db/schema.js";
import { encryptSecret, isEncryptedSecret } from "../services/secret-crypto.js";

async function run(): Promise<void> {
  const db = getDb();

  const connections = await db
    .select({
      id: githubConnections.id,
      workspaceId: githubConnections.workspaceId,
      accessToken: githubConnections.accessToken,
    })
    .from(githubConnections);

  let updated = 0;
  let skippedEncrypted = 0;
  for (const row of connections) {
    if (isEncryptedSecret(row.accessToken)) {
      skippedEncrypted += 1;
      continue;
    }

    const encrypted = encryptSecret(row.accessToken);
    await db
      .update(githubConnections)
      .set({
        accessToken: encrypted,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(githubConnections.id, row.id),
          eq(githubConnections.workspaceId, row.workspaceId),
        ),
      );
    updated += 1;
  }

  process.stdout.write(
    `[backfill] scanned=${connections.length} updated=${updated} skipped_encrypted=${skippedEncrypted}\n`,
  );
}

void run()
  .catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[backfill] failed: ${message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
