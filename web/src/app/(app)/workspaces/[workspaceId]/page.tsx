"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { workspaceApi, type ProductRecord } from "@/lib/api-client";

interface Props {
  params: Promise<{ workspaceId: string }>;
}

const NAV_ITEMS = (wId: string, pId: string) => [
  { label: "Overview", href: `/workspaces/${wId}/products/${pId}` },
  { label: "Bets", href: `/workspaces/${wId}/products/${pId}/bets` },
  { label: "Metrics", href: `/workspaces/${wId}/products/${pId}/metrics` },
  { label: "Decision Log", href: `/workspaces/${wId}/products/${pId}/decision-logs` },
  { label: "GitHub", href: `/workspaces/${wId}/products/${pId}/github` },
  { label: "Settings", href: `/workspaces/${wId}/products/${pId}/settings` },
];

export default function WorkspacePage({ params }: Props) {
  const { workspaceId } = use(params);
  const { getToken } = useAuth();
  const router = useRouter();

  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [workspaceName, setWorkspaceName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const api = workspaceApi(token);
      const [wsRes, productsRes] = await Promise.allSettled([
        api.get(workspaceId),
        api.listProducts(workspaceId),
      ]);

      if (wsRes.status === "fulfilled") setWorkspaceName(wsRes.value.name);
      if (productsRes.status === "fulfilled") {
        setProducts(productsRes.value.items);
        // Auto-redirect if exactly one active product
        const active = productsRes.value.items.filter((p) => p.status === "active");
        if (active.length === 1) {
          router.replace(`/workspaces/${workspaceId}/products/${active[0]!.id}`);
          return;
        }
        if (productsRes.value.items.length === 0) {
          setShowForm(true);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load products.");
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
      const product = await workspaceApi(token).createProduct(workspaceId, newName.trim());
      router.push(`/workspaces/${workspaceId}/products/${product.id}/bets`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create product.");
      setCreating(false);
    }
  }

  useEffect(() => {
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  return (
    <AppShell title={workspaceName || "Products"}>
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
            {products.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">{products.length} product{products.length !== 1 ? "s" : ""}</p>
                {products.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-xl border border-border bg-card p-5 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{p.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {p.status === "archived" ? "Archived · " : ""}
                          Created {new Date(p.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      {p.status === "archived" && (
                        <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">
                          archived
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {NAV_ITEMS(workspaceId, p.id).map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="text-xs border border-border rounded-md px-3 py-1 hover:bg-accent/10 transition-colors"
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
                {!showForm && (
                  <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
                    + New Product
                  </Button>
                )}
              </div>
            )}

            {showForm && (
              <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                <h2 className="font-semibold">
                  {products.length === 0 ? "Create your first product" : "New Product"}
                </h2>
                {products.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    A product is a feature area or initiative. Give it a name that describes what you&apos;re building.
                  </p>
                )}
                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    Product name <span className="text-destructive">*</span>
                  </label>
                  <input
                    className="input-base w-full"
                    placeholder="e.g. Onboarding Flow"
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
                    {creating ? "Creating…" : "Create Product"}
                  </Button>
                  {products.length > 0 && (
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
