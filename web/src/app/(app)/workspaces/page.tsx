"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { workspaceApi, type WorkspaceRecord } from "@/lib/api-client";

export default function WorkspacesPage() {
  const { getToken } = useAuth();
  const router = useRouter();

  const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await workspaceApi(token).list();
      setWorkspaces(res.items);
      // Auto-redirect if exactly one workspace exists
      if (res.items.length === 1) {
        router.replace(`/workspaces/${res.items[0]!.id}`);
        return;
      }
      if (res.items.length === 0) {
        setShowForm(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load workspaces.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const token = await getToken();
      const ws = await workspaceApi(token).create(newName.trim());
      router.push(`/workspaces/${ws.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create workspace.");
      setCreating(false);
    }
  }

  useEffect(() => {
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppShell title="Workspaces">
      <div className="max-w-2xl space-y-6">
        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            {workspaces.length > 0 && (
              <div className="space-y-3">
                {workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    className="w-full text-left rounded-xl border border-border bg-card p-5 hover:border-primary/40 hover:bg-accent/5 transition-colors"
                    onClick={() => router.push(`/workspaces/${ws.id}`)}
                  >
                    <p className="font-semibold">{ws.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Created {new Date(ws.createdAt).toLocaleDateString()}
                    </p>
                  </button>
                ))}
                {!showForm && (
                  <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
                    + New Workspace
                  </Button>
                )}
              </div>
            )}

            {showForm && (
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <h2 className="font-semibold">
                  {workspaces.length === 0 ? "Create your first workspace" : "New Workspace"}
                </h2>
                {workspaces.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    A workspace holds your products, bets, and metrics. You can create more later.
                  </p>
                )}
                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    Workspace name <span className="text-destructive">*</span>
                  </label>
                  <input
                    className="input-base w-full"
                    placeholder="e.g. Acme Corp"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") void handleCreate(); }}
                    autoFocus
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => void handleCreate()}
                    disabled={creating || !newName.trim()}
                  >
                    {creating ? "Creating…" : "Create Workspace"}
                  </Button>
                  {workspaces.length > 0 && (
                    <Button variant="ghost" onClick={() => { setShowForm(false); setNewName(""); }}>
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
