"use client";

import { useEffect, useState, use } from "react";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { contextPackApi, type ContextPackData, type PaginatedVersions } from "@/lib/api-client";

interface Props {
  params: Promise<{ workspaceId: string; productId: string }>;
}

export default function ContextPackPage({ params }: Props) {
  const { workspaceId, productId } = use(params);
  const { getToken } = useAuth();

  const [current, setCurrent] = useState<ContextPackData | null>(null);
  const [versions, setVersions] = useState<PaginatedVersions | null>(null);
  const [ingestInput, setIngestInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const api = contextPackApi(workspaceId, productId, token);
      const [cur, vers] = await Promise.allSettled([api.getCurrent(), api.getVersions()]);
      if (cur.status === "fulfilled") setCurrent(cur.value);
      if (vers.status === "fulfilled") setVersions(vers.value);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }

  async function handleIngest() {
    if (!ingestInput.trim()) return;
    setIngesting(true);
    setError(null);
    try {
      const token = await getToken();
      await contextPackApi(workspaceId, productId, token).ingest(ingestInput.trim());
      setIngestInput("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ingestion failed.");
    } finally {
      setIngesting(false);
    }
  }

  async function handleRestore(version: number) {
    setError(null);
    try {
      const token = await getToken();
      await contextPackApi(workspaceId, productId, token).restore(version);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Restore failed.");
    }
  }

  useEffect(() => {
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, productId]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold tracking-tight">Context Pack</h1>
        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Ingest */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Update Context</h2>
          <p className="text-sm text-muted-foreground">
            Paste product notes, decisions, customer feedback — anything. PROZEN will structure it automatically.
          </p>
          <textarea
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm min-h-[120px] focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="e.g. &ldquo;We decided to target B2B SaaS teams. Our main KPI is activation rate (target 40%). The core constraint is we can&apos;t change the pricing before Q2.&rdquo;"
            value={ingestInput}
            onChange={(e) => setIngestInput(e.target.value)}
          />
          <Button onClick={handleIngest} disabled={ingesting || !ingestInput.trim()}>
            {ingesting ? "Processing…" : "Ingest"}
          </Button>
        </section>

        {/* Current context */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Current Context</h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : current ? (
            <div className="rounded-xl border border-border bg-card p-5 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  v{current.current_version}
                </span>
                <span className="text-xs text-muted-foreground">{current.context_pack_id}</span>
              </div>
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap overflow-auto max-h-60">
                {JSON.stringify(current.data, null, 2)}
              </pre>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No context pack yet. Ingest your first update above.</p>
          )}
        </section>

        {/* Version history */}
        {versions && versions.items.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Version History</h2>
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Version</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Summary</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Source</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Created</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {versions.items.map((v) => (
                    <tr key={v.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2 font-mono">v{v.versionNumber}</td>
                      <td className="px-4 py-2 text-muted-foreground max-w-xs truncate">{v.summary}</td>
                      <td className="px-4 py-2">
                        <span className="text-xs bg-muted rounded px-1.5 py-0.5">{v.source}</span>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {new Date(v.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2">
                        {v.versionNumber !== current?.current_version && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRestore(v.versionNumber)}
                          >
                            Restore
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">{versions.total} total versions</p>
          </section>
        )}
    </div>
  );
}
