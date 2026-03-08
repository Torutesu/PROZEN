"use client";

import { useEffect, useState, use } from "react";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import {
  githubApi,
  type GitHubConnection,
  type GitHubSyncEvent,
} from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface Props {
  params: Promise<{ workspaceId: string; productId: string }>;
}

export default function GitHubPage({ params }: Props) {
  const { workspaceId, productId } = use(params);
  const { getToken } = useAuth();

  const [connection, setConnection] = useState<GitHubConnection | null>(null);
  const [events, setEvents] = useState<GitHubSyncEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Connect form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    repository: "",
    accessToken: "",
  });
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const api = githubApi(workspaceId, productId, token);
      const [statusRes, eventsRes] = await Promise.allSettled([
        api.getConnection(),
        api.listEvents(),
      ]);
      if (statusRes.status === "fulfilled") {
        setConnection(statusRes.value.connection);
      }
      if (eventsRes.status === "fulfilled") {
        setEvents(eventsRes.value.items);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect() {
    if (!form.repository.trim() || !form.accessToken.trim()) return;
    setConnecting(true);
    setError(null);

    // Build webhook URL pointing to the backend
    const apiUrl =
      process.env["NEXT_PUBLIC_API_URL"] ?? "http://127.0.0.1:8787";
    const webhookUrl = `${apiUrl}/api/v1/github/webhook`;

    try {
      const token = await getToken();
      await githubApi(workspaceId, productId, token).connect(
        form.repository.trim(),
        form.accessToken.trim(),
        webhookUrl,
      );
      setForm({ repository: "", accessToken: "" });
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect.");
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!confirm("Disconnect GitHub? Webhook will be deactivated.")) return;
    setDisconnecting(true);
    setError(null);
    try {
      const token = await getToken();
      await githubApi(workspaceId, productId, token).disconnect();
      setConnection(null);
      setEvents([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to disconnect.");
    } finally {
      setDisconnecting(false);
    }
  }

  useEffect(() => {
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, productId]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold tracking-tight">GitHub Living Spec</h1>
        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Connection status */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Repository Connection</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Connect a GitHub repo to automatically analyze code diffs against your Bet Specs.
              </p>
            </div>
            {connection ? (
              <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded-full font-medium">
                Connected
              </span>
            ) : (
              <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">
                Not connected
              </span>
            )}
          </div>

          {connection ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Repository:</span>
                <code className="font-mono bg-muted px-2 py-1 rounded text-xs">
                  {connection.repository}
                </code>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Webhook ID:</span>
                <code className="font-mono bg-muted px-2 py-1 rounded text-xs">
                  {connection.webhook_id ?? "—"}
                </code>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Connected:</span>
                <span>{new Date(connection.created_at).toLocaleDateString()}</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="text-destructive border-destructive/40 hover:bg-destructive/10"
              >
                {disconnecting ? "Disconnecting…" : "Disconnect"}
              </Button>
            </div>
          ) : (
            <div>
              {!showForm ? (
                <Button size="sm" onClick={() => setShowForm(true)}>
                  + Connect Repository
                </Button>
              ) : (
                <div className="space-y-3 max-w-md">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">
                      Repository <span className="text-destructive">*</span>
                    </label>
                    <input
                      className="input-base w-full"
                      placeholder="owner/repo"
                      value={form.repository}
                      onChange={(e) => setForm({ ...form, repository: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">
                      GitHub Personal Access Token <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="password"
                      className="input-base w-full"
                      placeholder="ghp_..."
                      value={form.accessToken}
                      onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Needs <code>repo</code> scope to register webhooks and read diffs.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleConnect}
                      disabled={connecting || !form.repository.trim() || !form.accessToken.trim()}
                    >
                      {connecting ? "Connecting…" : "Connect"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { setShowForm(false); setForm({ repository: "", accessToken: "" }); }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sync events */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Recent Sync Events</h2>
            {connection && (
              <Button size="sm" variant="ghost" onClick={() => void load()} disabled={loading}>
                {loading ? "Loading…" : "Refresh"}
              </Button>
            )}
          </div>

          {!connection ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Connect a repository to see sync events.
            </div>
          ) : loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : events.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No sync events yet. Push a commit or open a PR to trigger analysis.
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <SyncEventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>
    </div>
  );
}

function SyncEventCard({ event }: { event: GitHubSyncEvent }) {
  const [expanded, setExpanded] = useState(false);

  const statusColors: Record<string, string> = {
    analyzed: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
    failed: "bg-destructive/10 text-destructive",
    // Backward compatibility for any pre-fix rows.
    processed: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
    error: "bg-destructive/10 text-destructive",
    skipped: "bg-muted text-muted-foreground",
    pending: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400",
  };

  const hasAffectedBets =
    event.analysis && event.analysis.affectedBets.length > 0;

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 space-y-3",
        hasAffectedBets ? "border-primary/40" : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono bg-muted px-2 py-1 rounded uppercase">
              {event.event_type}
            </span>
            <span
              className={cn(
                "text-xs px-2 py-1 rounded-full font-medium",
                statusColors[event.status] ?? statusColors["pending"],
              )}
            >
              {event.status}
            </span>
            {hasAffectedBets && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
                {event.analysis!.affectedBets.length} bet{event.analysis!.affectedBets.length > 1 ? "s" : ""} affected
              </span>
            )}
          </div>
          {event.pr_title ? (
            <p className="text-sm font-medium truncate">
              PR #{event.pr_number}: {event.pr_title}
            </p>
          ) : event.commit_sha ? (
            <p className="text-sm font-medium font-mono">
              {event.ref ?? ""} @ {event.commit_sha.slice(0, 7)}
            </p>
          ) : null}
          {event.analysis?.summary && (
            <p className="text-xs text-muted-foreground">{event.analysis.summary}</p>
          )}
        </div>
        <div className="text-right shrink-0 space-y-1">
          <p className="text-xs text-muted-foreground whitespace-nowrap">
            {new Date(event.created_at).toLocaleString()}
          </p>
          {event.analysis && (
            <button
              className="text-xs text-primary hover:underline"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "Hide" : "Details"}
            </button>
          )}
        </div>
      </div>

      {expanded && event.analysis && (
        <div className="border-t border-border pt-3 space-y-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Confidence:</span>
            <span
              className={cn(
                "px-2 py-1 rounded font-medium",
                event.analysis.confidence === "high"
                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                  : event.analysis.confidence === "medium"
                  ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {event.analysis.confidence}
            </span>
          </div>

          {event.analysis.affectedBets.map((bet, i) => (
            <div key={i} className="rounded-lg bg-muted/50 p-3 space-y-2">
              <p className="text-xs font-mono text-muted-foreground">{bet.betSpecId}</p>
              <p className="text-xs">
                <span className="font-medium">Reason: </span>
                {bet.reason}
              </p>
              <p className="text-xs">
                <span className="font-medium">Suggested update: </span>
                {bet.suggestedUpdate}
              </p>
              <div className="flex gap-1 flex-wrap">
                {bet.sections.map((s) => (
                  <span key={s} className="text-xs bg-primary/10 text-primary px-1 py-1 rounded">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
