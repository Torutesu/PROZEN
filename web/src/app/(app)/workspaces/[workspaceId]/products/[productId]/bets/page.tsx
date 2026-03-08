"use client";

import { useEffect, useRef, useState, use } from "react";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { betApi, type BetSpecMeta, type BetSpecView, type ConversationMessage, type CompleteBetResponse, type NextBetRecommendation, type ReadinessReport } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface Props {
  params: Promise<{ workspaceId: string; productId: string }>;
}

type View = "list" | "new" | "conversation";

export default function BetsPage({ params }: Props) {
  const { workspaceId, productId } = use(params);
  const { getToken } = useAuth();

  const [view, setView] = useState<View>("list");
  const [bets, setBets] = useState<BetSpecMeta[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "draft" | "completed">("all");

  // New bet form
  const [newTitle, setNewTitle] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [creating, setCreating] = useState(false);

  // Active conversation
  const [activeBetId, setActiveBetId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [agentState, setAgentState] = useState<string>("collecting");
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Spec view tab
  const [specTab, setSpecTab] = useState<"chat" | "spec">("chat");
  const [specData, setSpecData] = useState<BetSpecView | null>(null);

  // Recommendation
  const [recommendation, setRecommendation] = useState<NextBetRecommendation | null>(null);

  // Readiness
  const [readiness, setReadiness] = useState<ReadinessReport | null>(null);
  const [showReadiness, setShowReadiness] = useState(false);

  // Complete bet
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [outcomeNote, setOutcomeNote] = useState("");
  const [completing, setCompleting] = useState(false);
  const [completedLearning, setCompletedLearning] = useState<CompleteBetResponse | null>(null);

  function resetCompletionUi() {
    setShowCompleteModal(false);
    setOutcomeNote("");
    setCompletedLearning(null);
  }

  async function loadRecommendation() {
    try {
      const token = await getToken();
      const res = await betApi(workspaceId, productId, token).getRecommendation();
      setRecommendation(res.recommendation);
    } catch {
      // non-critical, ignore
    }
  }

  async function loadBets() {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await betApi(workspaceId, productId, token).list();
      setBets(res.items);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newTitle.trim() || !newMessage.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await betApi(workspaceId, productId, token).create(
        newTitle.trim(),
        newMessage.trim(),
      );
      // Open the conversation immediately.
      setActiveBetId(res.bet_spec_id);
      setMessages([
        { role: "user", content: newMessage.trim(), createdAt: new Date().toISOString() },
        { role: "assistant", content: res.agent_reply, createdAt: new Date().toISOString() },
      ]);
      setAgentState(res.agent_state);
      setNewTitle("");
      setNewMessage("");
      setView("conversation");
      await loadBets();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create bet.");
    } finally {
      setCreating(false);
    }
  }

  async function openConversation(betId: string) {
    setError(null);
    setShowCompleteModal(false);
    setOutcomeNote("");
    try {
      const token = await getToken();
      const res = await betApi(workspaceId, productId, token).getConversation(betId);
      const selectedBet = bets.find((b) => b.id === betId);
      if (selectedBet?.learningSummary) {
        setCompletedLearning({ ok: true, learning_summary: selectedBet.learningSummary });
      } else {
        setCompletedLearning(null);
      }
      setActiveBetId(betId);
      setMessages(res.messages);
      setAgentState(res.agent_state);
      setSpecTab("chat");
      setSpecData(null);
      setView("conversation");

      // Load spec and readiness in parallel (non-blocking)
      setReadiness(null);
      setShowReadiness(false);
      const api = betApi(workspaceId, productId, token);
      api.get(betId).then((detail) => {
        if (detail.spec) setSpecData(detail.spec as BetSpecView);
      }).catch(() => { /* spec not available yet */ });
      api.getReadiness(betId).then((r) => setReadiness(r)).catch(() => { /* readiness is best-effort */ });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load conversation.");
    }
  }

  async function handleSend() {
    if (!chatInput.trim() || !activeBetId) return;
    const msgContent = chatInput.trim();
    setChatInput("");
    setSending(true);

    // Optimistic user message.
    const optimistic: ConversationMessage = {
      role: "user",
      content: msgContent,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const token = await getToken();
      const res = await betApi(workspaceId, productId, token).sendMessage(
        activeBetId,
        msgContent,
      );
      const agentMsg: ConversationMessage = {
        role: "assistant",
        content: res.agent_reply,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, agentMsg]);
      setAgentState(res.agent_state);
      if (res.spec) {
        setSpecData(res.spec as BetSpecView);
        // Refresh readiness whenever the spec is updated
        if (activeBetId) {
          const token2 = await getToken();
          betApi(workspaceId, productId, token2).getReadiness(activeBetId)
            .then((r) => setReadiness(r))
            .catch(() => { /* best-effort */ });
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  async function handleComplete() {
    if (!activeBetId || !outcomeNote.trim()) return;
    setCompleting(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await betApi(workspaceId, productId, token).complete(
        activeBetId,
        outcomeNote.trim(),
      );
      setCompletedLearning(res);
      setShowCompleteModal(false);
      setOutcomeNote("");
      setBets((prev) =>
        prev.map((b) =>
          b.id === activeBetId
            ? {
                ...b,
                status: "completed",
                outcomeNote: outcomeNote.trim(),
                learningSummary: res.learning_summary,
              }
            : b,
        ),
      );
      await loadRecommendation();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to complete bet.");
    } finally {
      setCompleting(false);
    }
  }

  useEffect(() => {
    void loadBets();
    void loadRecommendation();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, productId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight mb-6">
        {view === "conversation"
          ? (bets.find((b) => b.id === activeBetId)?.title ?? "Spec Conversation")
          : "Bets"}
      </h1>
      {error && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* ---- LIST VIEW ---- */}
      {view === "list" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {statusFilter === "all"
                ? `${total} bets`
                : `${bets.filter((b) => b.status === statusFilter).length} ${statusFilter} bets`}
            </p>
            <Button size="sm" onClick={() => setView("new")}>
              + New Bet
            </Button>
          </div>

          {/* Status filter tabs */}
          {bets.length > 0 && (
            <div className="flex gap-1 border-b border-border pb-0">
              {(["all", "active", "draft", "completed"] as const).map((s) => {
                const count = s === "all" ? bets.length : bets.filter((b) => b.status === s).length;
                return (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={cn(
                      "px-3 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors",
                      statusFilter === s
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                    <span className="ml-2 text-xs opacity-60">{count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : bets.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-10 text-center text-muted-foreground">
              <p className="font-medium text-sm">No bets yet.</p>
              <p className="text-sm mt-1">
                A &quot;bet&quot; is a product initiative with a clear hypothesis and success metrics.
              </p>
              <Button size="sm" className="mt-4" onClick={() => setView("new")}>
                Create your first bet
              </Button>
            </div>
          ) : (statusFilter !== "all" && bets.filter((b) => b.status === statusFilter).length === 0) ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No {statusFilter} bets.
            </p>
          ) : (
            <div className="space-y-3">
              {(statusFilter === "all" ? bets : bets.filter((b) => b.status === statusFilter)).map((bet) => (
                <div
                  key={bet.id}
                  className="rounded-xl border border-border bg-card p-5 flex items-center justify-between gap-4"
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <h3 className="font-medium truncate">{bet.title}</h3>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={bet.status} />
                      <span className="text-xs text-muted-foreground">
                        {new Date(bet.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openConversation(bet.id)}
                  >
                    Open
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---- NEW BET FORM ---- */}
      {view === "new" && (
        <div className="max-w-xl space-y-5">
          <button
            className="text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setView("list")}
          >
            ← Back to bets
          </button>
          {recommendation && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-2">
              <p className="text-xs font-medium text-primary uppercase tracking-wider">AI Recommendation</p>
              <p className="text-sm leading-relaxed">{recommendation.nextBetHypothesis}</p>
              <p className="text-xs text-muted-foreground">Based on learnings from: {recommendation.title}</p>
              <button
                className="text-xs text-primary hover:underline font-medium"
                onClick={() => {
                  setNewMessage(recommendation.nextBetHypothesis);
                }}
              >
                Use as starting point →
              </button>
            </div>
          )}
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">
                Bet title <span className="text-destructive">*</span>
              </label>
              <input
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="e.g. Simplify onboarding to improve activation"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">
                Describe your bet idea <span className="text-destructive">*</span>
              </label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px] focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="What problem are you solving? Who for? What outcome do you expect?"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleCreate}
                disabled={creating || !newTitle.trim() || !newMessage.trim()}
              >
                {creating ? "Starting conversation…" : "Start Spec Conversation"}
              </Button>
              <Button variant="outline" onClick={() => setView("list")}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ---- CONVERSATION VIEW ---- */}
      {view === "conversation" && (
        <div className="flex flex-col h-[calc(100vh-160px)]">
          <div className="flex items-center gap-3 mb-4">
            <button
              className="text-sm text-muted-foreground hover:text-foreground"
              onClick={() => {
                setView("list");
                setActiveBetId(null);
                resetCompletionUi();
              }}
            >
              ← Back to bets
            </button>
            <span className="text-xs bg-muted px-2 py-1 rounded-full text-muted-foreground">
              {agentState}
            </span>
            <div className="ml-auto flex items-center gap-2">
              {readiness && bets.find((b) => b.id === activeBetId)?.status !== "completed" && (
                <button
                  className={cn(
                    "text-xs px-2 py-1 rounded-full font-medium transition-colors",
                    readiness.readyToShip
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200"
                      : readiness.score >= 50
                        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 hover:bg-yellow-200"
                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200",
                  )}
                  onClick={() => setShowReadiness((v) => !v)}
                  title="View spec readiness checklist"
                >
                  {readiness.readyToShip ? "✓" : "!"} Readiness {readiness.score}%
                </button>
              )}
              {bets.find((b) => b.id === activeBetId)?.status !== "completed" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => setShowCompleteModal(true)}
                >
                  Mark Complete
                </Button>
              )}
            </div>
          </div>

          {/* Readiness checklist panel */}
          {showReadiness && readiness && (
            <div className="mb-4 rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Spec Readiness — {readiness.score}%</h3>
                <button
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setShowReadiness(false)}
                >
                  ✕
                </button>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5">
                <div
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    readiness.score >= 70 ? "bg-green-500" : readiness.score >= 40 ? "bg-yellow-500" : "bg-destructive",
                  )}
                  style={{ width: `${readiness.score}%` }}
                />
              </div>
              <div className="space-y-2">
                {readiness.checks.map((check) => (
                  <div key={check.id} className="flex items-start gap-2 text-xs">
                    <span className={cn(
                      "mt-0.5 shrink-0 font-bold",
                      check.status === "pass" ? "text-green-600 dark:text-green-400" :
                      check.status === "warn" ? "text-yellow-600 dark:text-yellow-400" :
                      "text-destructive",
                    )}>
                      {check.status === "pass" ? "✓" : check.status === "warn" ? "⚠" : "✗"}
                    </span>
                    <div>
                      <span className="font-medium">{check.label}</span>
                      <span className="text-muted-foreground ml-1">— {check.message}</span>
                    </div>
                  </div>
                ))}
              </div>
              {!readiness.readyToShip && (
                <p className="text-xs text-muted-foreground pt-1 border-t border-border">
                  Keep refining the spec with the agent to unlock all checks before shipping.
                </p>
              )}
            </div>
          )}

          {/* Learning display after completion */}
          {completedLearning && (
            <div className="mb-4 rounded-xl border border-green-300 bg-green-50 dark:bg-green-900/20 p-4 space-y-1">
              <p className="text-sm font-medium text-green-800 dark:text-green-300">Bet completed — Learning captured</p>
              <p className="text-sm text-green-700 dark:text-green-400 leading-relaxed">
                {completedLearning.learning_summary}
              </p>
            </div>
          )}

          {/* Complete modal */}
          {showCompleteModal && (
            <div className="mb-4 rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
              <h3 className="font-medium text-sm">Record Outcome</h3>
              <p className="text-xs text-muted-foreground">
                Describe what actually happened — did the hypothesis hold? What metrics moved? Why?
              </p>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="e.g. We shipped the shorter onboarding. 7-day retention improved by +2.3% (vs +5% target). The activation step was the bottleneck, not the length."
                value={outcomeNote}
                onChange={(e) => setOutcomeNote(e.target.value)}
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleComplete}
                  disabled={completing || !outcomeNote.trim()}
                >
                  {completing ? "Generating learning…" : "Complete & Generate Learning"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setShowCompleteModal(false);
                    setOutcomeNote("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}


          {/* Tab switcher */}
          {specData && (
            <div className="flex gap-1 mb-2">
              <button
                onClick={() => setSpecTab("chat")}
                className={cn(
                  "px-3 py-1 text-xs rounded-md font-medium transition-colors",
                  specTab === "chat"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                Conversation
              </button>
              <button
                onClick={() => setSpecTab("spec")}
                className={cn(
                  "px-3 py-1 text-xs rounded-md font-medium transition-colors",
                  specTab === "spec"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                Bet Spec
              </button>
            </div>
          )}

          {/* Spec view */}
          {specTab === "spec" && specData && (
            <div className="flex-1 overflow-y-auto pr-1">
              <SpecView spec={specData} />
            </div>
          )}

          {/* Messages */}
          <div className={cn("flex-1 overflow-y-auto space-y-4 pr-1", specTab === "spec" && specData ? "hidden" : "")}>
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex",
                  msg.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2 text-sm",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm",
                  )}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2 text-sm text-muted-foreground">
                  Thinking…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="mt-4 flex gap-2">
            <input
              className="flex-1 rounded-xl border border-input bg-background px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder={
                agentState === "done"
                  ? "Spec finalized. Ask for changes or say 'looks good'."
                  : "Reply to the agent…"
              }
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              disabled={sending}
            />
            <Button onClick={handleSend} disabled={sending || !chatInput.trim()}>
              Send
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SpecView({ spec }: { spec: BetSpecView }) {
  return (
    <div className="space-y-5 pb-6">
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-base">{spec.title}</h2>
        </div>

        {spec.hypothesis && (
          <SpecSection label="Hypothesis">
            <p className="text-sm leading-relaxed italic">&quot;{spec.hypothesis}&quot;</p>
          </SpecSection>
        )}

        {spec.problemStatement && (
          <SpecSection label="Problem Statement">
            <p className="text-sm leading-relaxed">{spec.problemStatement}</p>
          </SpecSection>
        )}

        {spec.userSegment && (
          <SpecSection label="User Segment">
            <p className="text-sm">{spec.userSegment}</p>
          </SpecSection>
        )}

        {spec.acceptanceCriteria && spec.acceptanceCriteria.length > 0 && (
          <SpecSection label="Acceptance Criteria">
            <ul className="space-y-2">
              {spec.acceptanceCriteria.map((ac, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <span className="text-primary mt-1">·</span>
                  <span>
                    {ac.criterion}
                    {ac.metric && ac.target !== undefined && (
                      <span className="text-muted-foreground ml-1">
                        ({ac.metric}: {ac.target})
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </SpecSection>
        )}

        {spec.expectedImpact && spec.expectedImpact.length > 0 && (
          <SpecSection label="Expected Impact">
            <ul className="space-y-2">
              {spec.expectedImpact.map((imp, i) => (
                <li key={i} className="text-sm flex items-center gap-2">
                  <span className="font-mono text-primary">
                    {imp.expectedDelta > 0 ? "+" : ""}{imp.expectedDelta}{imp.unit ?? ""}
                  </span>
                  <span className="text-muted-foreground">{imp.metricName}</span>
                </li>
              ))}
            </ul>
          </SpecSection>
        )}

        {spec.constraints && spec.constraints.length > 0 && (
          <SpecSection label="Constraints">
            <ul className="space-y-1">
              {spec.constraints.map((c, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span>·</span> {c}
                </li>
              ))}
            </ul>
          </SpecSection>
        )}

        {spec.risks && spec.risks.length > 0 && (
          <SpecSection label="Risks">
            <ul className="space-y-1">
              {spec.risks.map((r, i) => (
                <li key={i} className="text-sm text-destructive/80 flex items-start gap-2">
                  <span>·</span> {r}
                </li>
              ))}
            </ul>
          </SpecSection>
        )}

        {spec.timeboxWeeks && (
          <SpecSection label="Timebox">
            <p className="text-sm font-mono">{spec.timeboxWeeks} weeks</p>
          </SpecSection>
        )}
      </div>
    </div>
  );
}

function SpecSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    active: "bg-primary/10 text-primary",
    completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    cancelled: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  };
  return (
    <span className={cn("text-xs px-2 py-1 rounded-full font-medium", colors[status] ?? colors["draft"])}>
      {status}
    </span>
  );
}
