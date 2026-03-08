"use client";

import { useEffect, useState, use } from "react";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { decisionLogApi, type DecisionLog, type CreateDecisionLogInput } from "@/lib/api-client";

interface Props {
  params: Promise<{ workspaceId: string; productId: string }>;
}

const EMPTY_FORM: CreateDecisionLogInput = {
  title: "",
  decision: "",
  rationale: "",
  alternatives: [],
  evidenceLinks: [],
};

export default function DecisionLogsPage({ params }: Props) {
  const { workspaceId, productId } = use(params);
  const { getToken } = useAuth();

  const [logs, setLogs] = useState<DecisionLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateDecisionLogInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const token = await getToken();
      const res = await decisionLogApi(workspaceId, productId, token).list();
      setLogs(res.items);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!form.title || !form.decision || !form.rationale) return;
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      await decisionLogApi(workspaceId, productId, token).create(form);
      setForm(EMPTY_FORM);
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, productId]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Decision Log</h1>
        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{total} decisions recorded</p>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "+ New Decision"}
          </Button>
        </div>

        {showForm && (
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h2 className="font-semibold">Record a Decision</h2>
            <Field label="Title" required>
              <input
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Move to monthly billing only"
              />
            </Field>
            <Field label="Decision" required>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.decision}
                onChange={(e) => setForm({ ...form, decision: e.target.value })}
                placeholder="What was decided?"
              />
            </Field>
            <Field label="Rationale" required>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-ring"
                value={form.rationale}
                onChange={(e) => setForm({ ...form, rationale: e.target.value })}
                placeholder="Why was this decision made?"
              />
            </Field>
            <Button onClick={handleCreate} disabled={saving || !form.title || !form.decision || !form.rationale}>
              {saving ? "Saving…" : "Save Decision"}
            </Button>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : logs.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
            <p className="text-sm">No decisions yet. Record your first one above.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="rounded-xl border border-border bg-card p-5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium">{log.title}</h3>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(log.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-foreground">{log.decision}</p>
                <p className="text-sm text-muted-foreground">{log.rationale}</p>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}
