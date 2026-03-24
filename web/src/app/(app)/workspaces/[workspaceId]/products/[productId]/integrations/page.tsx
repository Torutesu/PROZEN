"use client";

import { use, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import {
  integrationApi,
  type IntegrationConnection,
  type IntegrationProvider,
} from "@/lib/api-client";

interface Props {
  params: Promise<{ workspaceId: string; productId: string }>;
}

const PROVIDERS: Array<{
  id: IntegrationProvider;
  label: string;
  description: string;
  fields: Array<{ key: string; label: string; placeholder: string; secret?: boolean; optional?: boolean }>;
  webhookNote?: string;
}> = [
  {
    id: "stripe",
    label: "Stripe",
    description: "MRR, Active Subscriptions, New Subscriptions, Churn, Failed Payments — synced hourly + real-time via webhook.",
    fields: [
      { key: "restrictedKey", label: "Restricted API Key", placeholder: "rk_live_...", secret: true },
      { key: "webhookSecret", label: "Webhook Secret", placeholder: "whsec_...", secret: true, optional: true },
    ],
    webhookNote: "Add webhook endpoint in your Stripe Dashboard: POST /api/v1/webhooks/stripe/{workspaceId}/{productId}",
  },
  {
    id: "posthog",
    label: "PostHog",
    description: "DAU, MAU — synced hourly. Free tier supports up to 1M events/month.",
    fields: [
      { key: "apiKey", label: "Personal API Key", placeholder: "phx_...", secret: true },
      { key: "projectId", label: "Project ID", placeholder: "12345" },
      { key: "host", label: "Host (self-hosted)", placeholder: "https://app.posthog.com", optional: true },
    ],
  },
  {
    id: "sentry",
    label: "Sentry",
    description: "New Issues (24h), Error Events (24h) — synced hourly. Free tier available.",
    fields: [
      { key: "authToken", label: "Auth Token", placeholder: "sntrys_...", secret: true },
      { key: "organizationSlug", label: "Organization Slug", placeholder: "my-org" },
      { key: "projectSlug", label: "Project Slug", placeholder: "my-project" },
    ],
  },
  {
    id: "typeform",
    label: "Typeform",
    description: "NPS Score, CSAT Score, Survey Responses — synced hourly. Free tier: up to 10 responses/month.",
    fields: [
      { key: "accessToken", label: "Personal Access Token", placeholder: "tfp_...", secret: true },
      { key: "formId", label: "Form ID", placeholder: "abc123" },
    ],
  },
];

export default function IntegrationsPage({ params }: Props) {
  const { workspaceId, productId } = use(params);
  const { getToken } = useAuth();

  const [connections, setConnections] = useState<IntegrationConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeForm, setActiveForm] = useState<IntegrationProvider | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState<IntegrationProvider | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await integrationApi(workspaceId, productId, token).list();
      setConnections(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load integrations.");
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect(provider: IntegrationProvider) {
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
      await integrationApi(workspaceId, productId, token).connect(
        provider,
        formValues as Parameters<ReturnType<typeof integrationApi>["connect"]>[1],
      );
      setActiveForm(null);
      setFormValues({});
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to connect.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect(provider: IntegrationProvider) {
    setDisconnecting(provider);
    setError(null);
    try {
      const token = await getToken();
      await integrationApi(workspaceId, productId, token).disconnect(provider);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to disconnect.");
    } finally {
      setDisconnecting(null);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, productId]);

  const connectedMap = Object.fromEntries(connections.map((c) => [c.provider, c]));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect external tools to automatically populate your Metrics. No manual entry required.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-4">
          {PROVIDERS.map((provider) => {
            const connection = connectedMap[provider.id];
            const isConnected = Boolean(connection);
            const isFormOpen = activeForm === provider.id;

            return (
              <div key={provider.id} className="rounded-xl border border-border bg-card p-5 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold">{provider.label}</h2>
                      {isConnected && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 font-medium">
                          Connected
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{provider.description}</p>
                    {isConnected && connection.lastSyncedAt && (
                      <p className="text-xs text-muted-foreground">
                        Last synced: {new Date(connection.lastSyncedAt).toLocaleString()}
                      </p>
                    )}
                    {isConnected && connection.lastSyncError && (
                      <p className="text-xs text-destructive">
                        Sync error: {connection.lastSyncError}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {isConnected ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setActiveForm(isFormOpen ? null : provider.id);
                            setFormValues({});
                          }}
                        >
                          Reconfigure
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => void handleDisconnect(provider.id)}
                          disabled={disconnecting === provider.id}
                        >
                          {disconnecting === provider.id ? "…" : "Disconnect"}
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => {
                          setActiveForm(isFormOpen ? null : provider.id);
                          setFormValues({});
                        }}
                      >
                        {isFormOpen ? "Cancel" : "Connect"}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Connection form */}
                {isFormOpen && (
                  <div className="border-t border-border pt-4 space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {provider.fields.map((field) => (
                        <div key={field.key} className="space-y-1">
                          <label className="text-sm font-medium">
                            {field.label}
                            {!field.optional && (
                              <span className="text-destructive ml-1">*</span>
                            )}
                            {field.optional && (
                              <span className="text-muted-foreground ml-1 font-normal">(optional)</span>
                            )}
                          </label>
                          <input
                            type={field.secret ? "password" : "text"}
                            className="input-base"
                            placeholder={field.placeholder}
                            value={formValues[field.key] ?? ""}
                            onChange={(e) =>
                              setFormValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                            }
                          />
                        </div>
                      ))}
                    </div>

                    {provider.webhookNote && (
                      <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                        <span className="font-medium">Webhook: </span>
                        {provider.webhookNote.replace("{workspaceId}", workspaceId).replace("{productId}", productId)}
                      </div>
                    )}

                    <Button
                      size="sm"
                      onClick={() => void handleConnect(provider.id)}
                      disabled={
                        saving ||
                        provider.fields
                          .filter((f) => !f.optional)
                          .some((f) => !formValues[f.key]?.trim())
                      }
                    >
                      {saving ? "Saving…" : isConnected ? "Update" : "Save & Connect"}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
