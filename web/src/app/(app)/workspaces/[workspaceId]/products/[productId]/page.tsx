"use client";

import Link from "next/link";
import { useEffect, useState, use } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  betApi,
  briefingApi,
  decisionLogApi,
  metricApi,
  reviewApi,
  type AnomalyRecord,
  type BetSpecMeta,
  type DailyBriefingRecord,
  type DecisionLog,
  type ProductReviewRecord,
} from "@/lib/api-client";

interface Props {
  params: Promise<{ workspaceId: string; productId: string }>;
}

export default function ProductOverviewPage({ params }: Props) {
  const { workspaceId, productId } = use(params);
  const { getToken } = useAuth();

  const [bets, setBets] = useState<BetSpecMeta[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyRecord[]>([]);
  const [decisions, setDecisions] = useState<DecisionLog[]>([]);
  const [briefing, setBriefing] = useState<DailyBriefingRecord | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(true);
  const [eveningReview, setEveningReview] = useState<ProductReviewRecord | null>(null);
  const [weeklyRetro, setWeeklyRetro] = useState<ProductReviewRecord | null>(null);
  const [loading, setLoading] = useState(true);

  // Show evening review after 18:00 local time; weekly retro on Sundays
  const nowHour = new Date().getHours();
  const isEvening = nowHour >= 18;
  const isSunday = new Date().getDay() === 0;

  const base = `/workspaces/${workspaceId}/products/${productId}`;

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken();
        const [betsRes, anomaliesRes, decisionsRes] = await Promise.allSettled([
          betApi(workspaceId, productId, token).list(10),
          metricApi(workspaceId, productId, token).getAnomalies(),
          decisionLogApi(workspaceId, productId, token).list(3),
        ]);
        if (betsRes.status === "fulfilled") setBets(betsRes.value.items);
        if (anomaliesRes.status === "fulfilled") setAnomalies(anomaliesRes.value.items);
        if (decisionsRes.status === "fulfilled") setDecisions(decisionsRes.value.items);
      } finally {
        setLoading(false);
      }

      // Load briefing separately (may take longer due to Claude call)
      try {
        const token = await getToken();
        const b = await briefingApi(workspaceId, productId, token).getToday();
        setBriefing(b);
      } catch { /* briefing is best-effort */ } finally {
        setBriefingLoading(false);
      }

      // Load periodic reviews (best-effort, non-blocking)
      try {
        const token = await getToken();
        const rApi = reviewApi(workspaceId, productId, token);
        const [er, wr] = await Promise.allSettled([
          rApi.getEveningReview(),
          rApi.getWeeklyRetro(),
        ]);
        if (er.status === "fulfilled") setEveningReview(er.value);
        if (wr.status === "fulfilled") setWeeklyRetro(wr.value);
      } catch { /* reviews are best-effort */ }
    }
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, productId]);

  const activeBets = bets.filter((b) => b.status === "active" || b.status === "draft");
  const completedBets = bets.filter((b) => b.status === "completed");

  // Format today's date
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-8">
      {/* Today's Focus — Daily Briefing */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-primary animate-pulse" />
          <p className="text-xs font-medium text-primary uppercase tracking-widest">Today&apos;s Focus</p>
          <span className="text-xs text-muted-foreground ml-auto">{today}</span>
        </div>
        {briefingLoading ? (
          <p className="text-sm text-muted-foreground">Generating your daily briefing…</p>
        ) : briefing ? (
          <p className="text-sm leading-relaxed">{briefing.content}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Add your first bet and some metrics to unlock daily AI briefings.
          </p>
        )}
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Product snapshot — bets, signals, and recent decisions at a glance.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Active Bets */}
          <OverviewCard
            title="Active Bets"
            count={activeBets.length}
            href={`${base}/bets`}
            linkLabel="View all bets"
            empty="No active bets. Start a new bet to track your next initiative."
          >
            {activeBets.slice(0, 3).map((bet) => (
              <BetRow key={bet.id} bet={bet} base={base} />
            ))}
          </OverviewCard>

          {/* Open Anomalies */}
          <OverviewCard
            title="Open Anomalies"
            count={anomalies.length}
            href={`${base}/metrics`}
            linkLabel="View metrics"
            empty="No open anomalies. Metrics look healthy."
            countColor={anomalies.length > 0 ? "text-destructive" : undefined}
          >
            {anomalies.slice(0, 3).map((a) => (
              <AnomalyRow key={a.id} anomaly={a} />
            ))}
          </OverviewCard>

          {/* Recent Decisions */}
          <OverviewCard
            title="Recent Decisions"
            count={decisions.length}
            href={`${base}/decision-logs`}
            linkLabel="View all decisions"
            empty="No decisions logged yet."
          >
            {decisions.slice(0, 3).map((d) => (
              <DecisionRow key={d.id} decision={d} />
            ))}
          </OverviewCard>
        </div>
      )}

      {/* Evening Review */}
      {isEvening && eveningReview && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-orange-400" />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
              Evening Review
            </p>
            <span className="text-xs text-muted-foreground ml-auto">
              {new Date(eveningReview.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
          <p className="text-sm leading-relaxed">{eveningReview.content}</p>
        </div>
      )}

      {/* Weekly Retro */}
      {isSunday && weeklyRetro && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-purple-400" />
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
              Weekly Retro
            </p>
            <span className="text-xs text-muted-foreground ml-auto">
              {weeklyRetro.reviewDate}
            </span>
          </div>
          <p className="text-sm leading-relaxed">{weeklyRetro.content}</p>
          {typeof weeklyRetro.metadata["betsCompleted"] === "number" && (
            <p className="text-xs text-muted-foreground">
              {weeklyRetro.metadata["betsCompleted"]} bet(s) completed ·{" "}
              {weeklyRetro.metadata["betsActive"] ?? 0} active
            </p>
          )}
        </div>
      )}

      {/* Completed bets learning feed */}
      {completedBets.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
            Recent Learnings
          </h2>
          <div className="space-y-3">
            {completedBets.slice(0, 3).map((bet) => (
              <div key={bet.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded-full font-medium">
                    completed
                  </span>
                  <p className="text-sm font-medium">{bet.title}</p>
                </div>
                {bet.learningSummary && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {bet.learningSummary}
                  </p>
                )}
              </div>
            ))}
          </div>
          <Link
            href={`${base}/bets`}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            View all bets →
          </Link>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function OverviewCard({
  title,
  count,
  href,
  linkLabel,
  empty,
  countColor,
  children,
}: {
  title: string;
  count: number;
  href: string;
  linkLabel: string;
  empty: string;
  countColor?: string;
  children: React.ReactNode;
}) {
  const hasItems = count > 0;
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold text-sm">{title}</h2>
        <span className={`text-2xl font-bold tabular-nums ${countColor ?? "text-foreground"}`}>
          {count}
        </span>
      </div>
      {hasItems ? (
        <div className="space-y-2">{children}</div>
      ) : (
        <p className="text-xs text-muted-foreground">{empty}</p>
      )}
      <Link href={href} className="block text-xs text-primary hover:underline">
        {linkLabel} →
      </Link>
    </div>
  );
}

function BetRow({ bet, base }: { bet: BetSpecMeta; base: string }) {
  return (
    <Link
      href={`${base}/bets`}
      className="block rounded-lg px-2 py-2 -mx-2 hover:bg-muted transition-colors"
    >
      <p className="text-sm truncate">{bet.title}</p>
      <p className="text-xs text-muted-foreground capitalize">{bet.status}</p>
    </Link>
  );
}

function AnomalyRow({ anomaly }: { anomaly: AnomalyRecord }) {
  const severity = anomaly.severity;
  const dotColor =
    severity === "high"
      ? "bg-destructive"
      : severity === "medium"
        ? "bg-orange-500"
        : "bg-yellow-500";
  return (
    <div className="flex items-start gap-2 py-1">
      <span className={`mt-2 size-2 rounded-full shrink-0 ${dotColor}`} />
      <div className="min-w-0">
        <p className="text-sm truncate">{anomaly.metricName ?? anomaly.metricId}</p>
        <p className="text-xs text-muted-foreground">
          {anomaly.direction === "below_target" ? "Below" : "Above"} baseline
          {anomaly.deviationPct !== null ? ` · ${Math.abs(anomaly.deviationPct)}%` : ""}
        </p>
      </div>
    </div>
  );
}

function DecisionRow({ decision }: { decision: DecisionLog }) {
  return (
    <div className="py-1">
      <p className="text-sm truncate">{decision.title}</p>
      <p className="text-xs text-muted-foreground truncate">{decision.decision}</p>
    </div>
  );
}
