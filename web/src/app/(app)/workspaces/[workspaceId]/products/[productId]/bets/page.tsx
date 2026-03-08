"use client";

import { useEffect, useRef, useState, use } from "react";
import { useAuth } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { betApi, type BetSpecMeta, type ConversationMessage, type CompleteBetResponse } from "@/lib/api-client";
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
    try {
      const token = await getToken();
      const res = await betApi(workspaceId, productId, token).getConversation(betId);
      setActiveBetId(betId);
      setMessages(res.messages);
      setAgentState(res.agent_state);
      setView("conversation");
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    void loadBets();
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
        {view === "conversation" ? "Spec Conversation" : "Bets"}
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
            <p className="text-sm text-muted-foreground">{total} bets</p>
            <Button size="sm" onClick={() => setView("new")}>
              + New Bet
            </Button>
          </div>

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
          ) : (
            <div className="space-y-3">
              {bets.map((bet) => (
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
              onClick={() => setView("list")}
            >
              ← Back to bets
            </button>
            <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
              {agentState}
            </span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
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
                    "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
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
                <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm text-muted-foreground">
                  Thinking…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="mt-4 flex gap-2">
            <input
              className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    active: "bg-primary/10 text-primary",
    completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    cancelled: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  };
  return (
    <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium", colors[status] ?? colors["draft"])}>
      {status}
    </span>
  );
}
