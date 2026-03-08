"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { workspaceApi } from "@/lib/api-client";

interface Props {
  params: Promise<{ workspaceId: string; productId: string }>;
}

export default function SettingsPage({ params }: Props) {
  const { workspaceId, productId } = use(params);
  const { getToken } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [originalName, setOriginalName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken();
        const products = await workspaceApi(token).listProducts(workspaceId);
        const product = products.items.find((p) => p.id === productId);
        if (product) {
          setName(product.name);
          setOriginalName(product.name);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load product.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, productId]);

  async function handleSave() {
    if (!name.trim() || name.trim() === originalName) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const token = await getToken();
      await workspaceApi(token).updateProduct(workspaceId, productId, { name: name.trim() });
      setOriginalName(name.trim());
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!confirm(`Archive "${originalName}"? You can restore it later from the workspace page.`)) return;
    setArchiving(true);
    setError(null);
    try {
      const token = await getToken();
      await workspaceApi(token).updateProduct(workspaceId, productId, { status: "archived" });
      router.push(`/workspaces/${workspaceId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to archive.");
      setArchiving(false);
    }
  }

  return (
    <div className="space-y-8 max-w-lg">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          {/* Rename */}
          <section className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h2 className="font-semibold">Product name</h2>
            <div className="flex gap-2">
              <input
                className="input-base flex-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void handleSave(); }}
              />
              <Button
                size="sm"
                onClick={() => void handleSave()}
                disabled={saving || !name.trim() || name.trim() === originalName}
              >
                {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
              </Button>
            </div>
          </section>

          {/* Danger zone */}
          <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 space-y-4">
            <h2 className="font-semibold text-destructive">Danger zone</h2>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Archive this product</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Hides the product from the workspace. All data is preserved.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-destructive/40 text-destructive hover:bg-destructive/10 shrink-0"
                onClick={() => void handleArchive()}
                disabled={archiving}
              >
                {archiving ? "Archiving…" : "Archive"}
              </Button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
