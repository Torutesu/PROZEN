"use client";

import { useEffect, useState, use } from "react";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import {
  metricApi,
  type AffectedBetsResponse,
  type AnomalyRecord,
  type MetricLayer,
  type MetricRecord,
} from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface Props {
  params: Promise<{ workspaceId: string; productId: string }>;
}

const LAYERS: MetricLayer[] = ["bet", "kpi", "activity"];

const LAYER_LABELS: Record<MetricLayer, string> = {
  bet: "Bet",
  kpi: "KPI",
  activity: "Activity",
};

const LAYER_DESCRIPTIONS: Record<MetricLayer, string> = {
  bet: "North Star outcomes tied to specific bets",
  kpi: "Mid-term business health indicators",
  activity: "Day-to-day operational signals",
};

interface AffectedBetsState {
  loading: boolean;
  error: string | null;
  result: AffectedBetsResponse | null;
}

export default function MetricsPage({ params }: Props) {
  const { workspaceId, productId } = use(params);
  const { getToken } = useAuth();

  const [metrics, setMetrics] = useState<MetricRecord[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add metric form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    layer: "kpi" as MetricLayer,
    unit: "",
    direction: "increase" as "increase" | "decrease",
    baselineValue: "",
    targetValue: "",
  });
  const [saving, setSaving] = useState(false);

  // Add reading
  const [readingMetricId, setReadingMetricId] = useState<string | null>(null);
  const [readingValue, setReadingValue] = useState("");
  const [readingNote, setReadingNote] = useState("");
  const [addingReading, setAddingReading] = useState(false);
  const [lastAnomaly, setLastAnomaly] = useState<AnomalyRecord | null>(null);
  const [expandedAnomalies, setExpandedAnomalies] = useState<Record<string, boolean>>({});
  const [affectedBetsByAnomaly, setAffectedBetsByAnomaly] = useState<
    Record<string, AffectedBetsState>
  >({});

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const api = metricApi(workspaceId, productId, token);
      const [metricsRes, anomaliesRes] = await Promise.allSettled([
        api.list(),
        api.getAnomalies(),
      ]);
      if (metricsRes.status === "fulfilled") setMetrics(metricsRes.value.items);
      if (anomaliesRes.status === "fulfilled") setAnomalies(anomaliesRes.value.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!form.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      await metricApi(workspaceId, productId, token).create({
        name: form.name.trim(),
        layer: form.layer,
        unit: form.unit.trim() || undefined,
        direction: form.direction,
        baselineValue: form.baselineValue ? Number(form.baselineValue) : undefined,
        targetValue: form.targetValue ? Number(form.targetValue) : undefined,
      });
      setForm({ name: "", layer: "kpi", unit: "", direction: "increase", baselineValue: "", targetValue: "" });
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddReading() {
    if (!readingMetricId || !readingValue) return;
    setAddingReading(true);
    setError(null);
    setLastAnomaly(null);
    try {
      const token = await getToken();
      const res = await metricApi(workspaceId, productId, token).addReading(
        readingMetricId,
        Number(readingValue),
        readingNote.trim() || undefined,
      );
      if (res.anomaly) setLastAnomaly(res.anomaly);
      setReadingMetricId(null);
      setReadingValue("");
      setReadingNote("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add reading.");
    } finally {
      setAddingReading(false);
    }
  }

  async function handleResolveAnomaly(anomalyId: string) {
    try {
      const token = await getToken();
      await metricApi(workspaceId, productId, token).resolveAnomaly(anomalyId);
      setAnomalies((prev) => prev.filter((a) => a.id !== anomalyId));
      if (lastAnomaly?.id === anomalyId) setLastAnomaly(null);
      setExpandedAnomalies((prev) => {
        const next = { ...prev };
        delete next[anomalyId];
        return next;
      });
      setAffectedBetsByAnomaly((prev) => {
        const next = { ...prev };
        delete next[anomalyId];
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to resolve.");
    }
  }

  async function handleToggleAffectedBets(anomalyId: string) {
    setExpandedAnomalies((prev) => ({ ...prev, [anomalyId]: !prev[anomalyId] }));

    const existing = affectedBetsByAnomaly[anomalyId];
    if (existing?.loading || existing?.result) return;

    setAffectedBetsByAnomaly((prev) => ({
      ...prev,
      [anomalyId]: { loading: true, error: null, result: null },
    }));

    try {
      const token = await getToken();
      const result = await metricApi(workspaceId, productId, token).getAffectedBets(anomalyId);
      setAffectedBetsByAnomaly((prev) => ({
        ...prev,
        [anomalyId]: { loading: false, error: null, result },
      }));
    } catch (e) {
      setAffectedBetsByAnomaly((prev) => ({
        ...prev,
        [anomalyId]: {
          loading: false,
          error: e instanceof Error ? e.message : "Failed to load affected bets.",
          result: null,
        },
      }));
    }
  }

  useEffect(() => {
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, productId]);

  const metricsByLayer = LAYERS.reduce<Record<MetricLayer, MetricRecord[]>>(
    (acc, layer) => {
      acc[layer] = metrics.filter((m) => m.layer === layer);
      return acc;
    },
    { bet: [], kpi: [], activity: [] },
  );

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold tracking-tight">Metrics</h1>
        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Anomaly alerts */}
        {(lastAnomaly ?? anomalies.length > 0) && (
          <div className="space-y-2">
            {lastAnomaly && (
              <AnomalyAlert
                anomaly={lastAnomaly}
                onResolve={handleResolveAnomaly}
                onToggleAffectedBets={() => {
                  void handleToggleAffectedBets(lastAnomaly.id);
                }}
                isAffectedBetsOpen={Boolean(expandedAnomalies[lastAnomaly.id])}
                affectedBetsState={affectedBetsByAnomaly[lastAnomaly.id]}
              />
            )}
            {anomalies
              .filter((a) => a.id !== lastAnomaly?.id)
              .map((a) => (
                <AnomalyAlert
                  key={a.id}
                  anomaly={a}
                  onResolve={handleResolveAnomaly}
                  onToggleAffectedBets={() => {
                    void handleToggleAffectedBets(a.id);
                  }}
                  isAffectedBetsOpen={Boolean(expandedAnomalies[a.id])}
                  affectedBetsState={affectedBetsByAnomaly[a.id]}
                />
              ))}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{metrics.length} metrics tracked</p>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "+ Add Metric"}
          </Button>
        </div>

        {/* Add metric form */}
        {showForm && (
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h2 className="font-semibold">New Metric</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name" required>
                <input
                  className="input-base"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Activation Rate"
                />
              </Field>
              <Field label="Layer" required>
                <select
                  className="input-base"
                  value={form.layer}
                  onChange={(e) => setForm({ ...form, layer: e.target.value as MetricLayer })}
                >
                  {LAYERS.map((l) => (
                    <option key={l} value={l}>{LAYER_LABELS[l]}</option>
                  ))}
                </select>
              </Field>
              <Field label="Unit">
                <input
                  className="input-base"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                  placeholder="e.g. %, users, $"
                />
              </Field>
              <Field label="Direction">
                <select
                  className="input-base"
                  value={form.direction}
                  onChange={(e) => setForm({ ...form, direction: e.target.value as "increase" | "decrease" })}
                >
                  <option value="increase">Increase (higher is better)</option>
                  <option value="decrease">Decrease (lower is better)</option>
                </select>
              </Field>
              <Field label="Baseline">
                <input
                  type="number"
                  className="input-base"
                  value={form.baselineValue}
                  onChange={(e) => setForm({ ...form, baselineValue: e.target.value })}
                  placeholder="Current value"
                />
              </Field>
              <Field label="Target">
                <input
                  type="number"
                  className="input-base"
                  value={form.targetValue}
                  onChange={(e) => setForm({ ...form, targetValue: e.target.value })}
                  placeholder="Goal value"
                />
              </Field>
            </div>
            <Button onClick={handleCreate} disabled={saving || !form.name.trim()}>
              {saving ? "Saving…" : "Add Metric"}
            </Button>
          </div>
        )}

        {/* Add reading inline form */}
        {readingMetricId && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
            <h3 className="font-medium text-sm">
              Record reading — {metrics.find((m) => m.id === readingMetricId)?.name}
            </h3>
            <div className="flex gap-2">
              <input
                type="number"
                className="input-base w-32"
                placeholder="Value"
                value={readingValue}
                onChange={(e) => setReadingValue(e.target.value)}
                autoFocus
              />
              <input
                className="input-base flex-1"
                placeholder="Note (optional)"
                value={readingNote}
                onChange={(e) => setReadingNote(e.target.value)}
              />
              <Button
                size="sm"
                onClick={handleAddReading}
                disabled={addingReading || !readingValue}
              >
                {addingReading ? "…" : "Save"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => { setReadingMetricId(null); setReadingValue(""); setReadingNote(""); }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* 3-layer metric display */}
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-6">
            {LAYERS.map((layer) => (
              <section key={layer}>
                <div className="flex items-baseline gap-2 mb-3">
                  <h2 className="font-semibold">{LAYER_LABELS[layer]} Layer</h2>
                  <span className="text-xs text-muted-foreground">{LAYER_DESCRIPTIONS[layer]}</span>
                </div>

                {metricsByLayer[layer].length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    No {LAYER_LABELS[layer].toLowerCase()} metrics yet.
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {metricsByLayer[layer].map((m) => (
                      <MetricCard
                        key={m.id}
                        metric={m}
                        hasAnomaly={anomalies.some((a) => a.metricId === m.id)}
                        onAddReading={() => setReadingMetricId(m.id)}
                      />
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MetricCard({
  metric,
  hasAnomaly,
  onAddReading,
}: {
  metric: MetricRecord;
  hasAnomaly: boolean;
  onAddReading: () => void;
}) {
  const progress =
    metric.baselineValue !== null &&
    metric.targetValue !== null &&
    metric.targetValue !== metric.baselineValue
      ? Math.min(
          100,
          Math.max(
            0,
            ((metric.baselineValue - (metric.direction === "decrease" ? metric.targetValue : 0)) /
              Math.abs(metric.targetValue - (metric.direction === "decrease" ? metric.baselineValue ?? 0 : metric.baselineValue ?? 0))) *
              100,
          ),
        )
      : null;

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 space-y-3",
        hasAnomaly ? "border-destructive/50" : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-sm leading-tight">{metric.name}</p>
          {metric.unit && (
            <p className="text-xs text-muted-foreground">{metric.unit}</p>
          )}
        </div>
        {hasAnomaly && (
          <span className="text-xs bg-destructive/10 text-destructive px-2 py-1 rounded-full shrink-0">
            anomaly
          </span>
        )}
      </div>

      <div className="flex items-end gap-4 text-sm">
        {metric.baselineValue !== null && (
          <div>
            <p className="text-xs text-muted-foreground">Baseline</p>
            <p className="font-mono font-medium">{metric.baselineValue}{metric.unit}</p>
          </div>
        )}
        {metric.targetValue !== null && (
          <div>
            <p className="text-xs text-muted-foreground">Target</p>
            <p className="font-mono font-medium text-primary">{metric.targetValue}{metric.unit}</p>
          </div>
        )}
      </div>

      {progress !== null && (
        <div className="space-y-1">
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <Button
        size="sm"
        variant="ghost"
        className="text-xs h-7 w-full"
        onClick={onAddReading}
      >
        + Record reading
      </Button>
    </div>
  );
}

function AnomalyAlert({
  anomaly,
  onResolve,
  onToggleAffectedBets,
  isAffectedBetsOpen,
  affectedBetsState,
}: {
  anomaly: AnomalyRecord;
  onResolve: (id: string) => void;
  onToggleAffectedBets: () => void;
  isAffectedBetsOpen: boolean;
  affectedBetsState?: AffectedBetsState;
}) {
  const severityColors = {
    low: "border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20",
    medium: "border-orange-400 bg-orange-50 dark:bg-orange-900/20",
    high: "border-destructive bg-destructive/10",
  };

  return (
    <div className={cn("rounded-xl border p-4 space-y-2", severityColors[anomaly.severity])}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">
            <span className={cn(
              "inline-block px-2 py-1 rounded text-xs font-bold mr-2 uppercase",
              anomaly.severity === "high" ? "bg-destructive text-destructive-foreground" :
              anomaly.severity === "medium" ? "bg-orange-500 text-white" :
              "bg-yellow-500 text-white"
            )}>
              {anomaly.severity}
            </span>
            {anomaly.metricName ?? anomaly.metricId}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {anomaly.direction === "below_target" ? "Below" : "Above"} baseline
            {anomaly.deviationPct !== null ? ` by ${Math.abs(anomaly.deviationPct)}%` : ""}
            {" · "}Actual: {anomaly.actualValue}
            {anomaly.baselineValue !== null ? ` (baseline: ${anomaly.baselineValue})` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={onToggleAffectedBets}
          >
            {isAffectedBetsOpen ? "Hide affected bets" : "View affected bets"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-xs"
            onClick={() => onResolve(anomaly.id)}
          >
            Resolve
          </Button>
        </div>
      </div>
      {anomaly.impactNarrative && (
        <p className="text-xs text-muted-foreground leading-relaxed border-t border-current/20 pt-2">
          {anomaly.impactNarrative}
        </p>
      )}
      {isAffectedBetsOpen && (
        <div className="border-t border-current/20 pt-2 space-y-2">
          {affectedBetsState?.loading && (
            <p className="text-xs text-muted-foreground">Loading affected bets...</p>
          )}
          {!affectedBetsState?.loading && affectedBetsState?.error && (
            <p className="text-xs text-destructive">{affectedBetsState.error}</p>
          )}
          {!affectedBetsState?.loading &&
            !affectedBetsState?.error &&
            ((affectedBetsState?.result?.affectedBets.length ?? 0) === 0 ? (
              <p className="text-xs text-muted-foreground">No currently affected active/draft bets.</p>
            ) : (
              <div className="space-y-2">
                {affectedBetsState?.result?.affectedBets.map((bet) => (
                  <div key={bet.betId} className="rounded-md border border-current/20 px-2 py-2">
                    <p className="text-xs font-medium">
                      {bet.title} <span className="text-muted-foreground">({bet.status})</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{bet.linkageReason}</p>
                  </div>
                ))}
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
