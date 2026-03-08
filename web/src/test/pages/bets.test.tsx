import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BetsPage from "@/app/(app)/workspaces/[workspaceId]/products/[productId]/bets/page";

const PARAMS = Promise.resolve({ workspaceId: "ws1", productId: "p1" });

const mockBets = [
  {
    id: "bet-1",
    title: "Simplify onboarding",
    status: "active",
    currentVersionId: "v1",
    conversationId: "conv-1",
    outcomeNote: null,
    learningSummary: null,
    createdBy: "user_test123",
    createdAt: "2026-03-01T00:00:00Z",
    updatedAt: "2026-03-01T00:00:00Z",
  },
  {
    id: "bet-2",
    title: "Reduce churn via email",
    status: "draft",
    currentVersionId: null,
    conversationId: null,
    outcomeNote: null,
    learningSummary: null,
    createdBy: "user_test123",
    createdAt: "2026-03-02T00:00:00Z",
    updatedAt: "2026-03-02T00:00:00Z",
  },
  {
    id: "bet-3",
    title: "Old completed bet",
    status: "completed",
    currentVersionId: "v3",
    conversationId: "conv-3",
    outcomeNote: "Worked as expected.",
    learningSummary: "We learned X.",
    createdBy: "user_test123",
    createdAt: "2026-02-01T00:00:00Z",
    updatedAt: "2026-02-15T00:00:00Z",
  },
];

function mockFetch(responses: Record<string, unknown>) {
  (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
    for (const [key, value] of Object.entries(responses)) {
      if (url.includes(key)) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(value),
        });
      }
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

async function renderPage() {
  await act(async () => {
    render(<BetsPage params={PARAMS} />);
  });
}

describe("BetsPage", () => {
  beforeEach(() => {
    mockFetch({
      "/bets?": { total: 3, limit: 50, offset: 0, items: mockBets },
      "/bets/recommendation": { recommendation: null },
    });
  });

  it("renders the bets list with all bets", async () => {
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText("Simplify onboarding")).toBeInTheDocument();
      expect(screen.getByText("Reduce churn via email")).toBeInTheDocument();
    });
  });

  it("shows total bet count", async () => {
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText(/3 bets/)).toBeInTheDocument();
    });
  });

  it("shows status filter tabs when bets exist", async () => {
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("All")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Active/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Draft/i })).toBeInTheDocument();
    });
  });

  it("filters bets by status when tab is clicked", async () => {
    const user = userEvent.setup();
    await renderPage();

    await waitFor(() => expect(screen.getByText("Simplify onboarding")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /Draft/i }));

    await waitFor(() => {
      expect(screen.queryByText("Simplify onboarding")).not.toBeInTheDocument();
      expect(screen.getByText("Reduce churn via email")).toBeInTheDocument();
    });
  });

  it("shows new bet form when + New Bet is clicked", async () => {
    const user = userEvent.setup();
    await renderPage();

    await waitFor(() => screen.getByText("+ New Bet"));
    await user.click(screen.getByText("+ New Bet"));

    expect(screen.getByText("Bet title")).toBeInTheDocument();
    expect(screen.getByText("Describe your bet idea")).toBeInTheDocument();
  });

  it("disables create button when fields are empty", async () => {
    const user = userEvent.setup();
    await renderPage();

    await waitFor(() => screen.getByText("+ New Bet"));
    await user.click(screen.getByText("+ New Bet"));

    expect(screen.getByRole("button", { name: /Start Spec Conversation/i })).toBeDisabled();
  });

  it("enables create button when title and message are filled", async () => {
    const user = userEvent.setup();
    await renderPage();

    await waitFor(() => screen.getByText("+ New Bet"));
    await user.click(screen.getByText("+ New Bet"));

    await user.type(screen.getByPlaceholderText(/Simplify onboarding/i), "My new bet");
    await user.type(screen.getByPlaceholderText(/What problem/i), "We want to improve activation");

    expect(screen.getByRole("button", { name: /Start Spec Conversation/i })).not.toBeDisabled();
  });

  it("shows recommendation banner when recommendation exists", async () => {
    mockFetch({
      "/bets?": { total: 3, limit: 50, offset: 0, items: mockBets },
      "/bets/recommendation": {
        recommendation: {
          betSpecId: "bet-3",
          title: "Old completed bet",
          nextBetHypothesis: "Next, try improving day-14 retention via in-app nudges.",
          updatedAt: "2026-02-15T00:00:00Z",
        },
      },
    });

    const user = userEvent.setup();
    await renderPage();

    await waitFor(() => screen.getByText("+ New Bet"));
    await user.click(screen.getByText("+ New Bet"));

    await waitFor(() => {
      expect(screen.getByText("AI Recommendation")).toBeInTheDocument();
      expect(screen.getByText("Next, try improving day-14 retention via in-app nudges.")).toBeInTheDocument();
    });
  });

  it("pre-fills message textarea when 'Use as starting point' is clicked", async () => {
    const hypothesis = "Next, try improving day-14 retention via in-app nudges.";
    mockFetch({
      "/bets?": { total: 3, limit: 50, offset: 0, items: mockBets },
      "/bets/recommendation": {
        recommendation: {
          betSpecId: "bet-3",
          title: "Old completed bet",
          nextBetHypothesis: hypothesis,
          updatedAt: "2026-02-15T00:00:00Z",
        },
      },
    });

    const user = userEvent.setup();
    await renderPage();

    await waitFor(() => screen.getByText("+ New Bet"));
    await user.click(screen.getByText("+ New Bet"));

    await waitFor(() => screen.getByText("Use as starting point →"));
    await user.click(screen.getByText("Use as starting point →"));

    const textarea = screen.getByPlaceholderText(/What problem/i) as HTMLTextAreaElement;
    expect(textarea.value).toBe(hypothesis);
  });

  it("shows empty state when no bets exist", async () => {
    mockFetch({
      "/bets?": { total: 0, limit: 50, offset: 0, items: [] },
      "/bets/recommendation": { recommendation: null },
    });

    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("No bets yet.")).toBeInTheDocument();
      expect(screen.getByText("Create your first bet")).toBeInTheDocument();
    });
  });

  it("creates a new bet and opens conversation view", async () => {
    mockFetch({
      "/bets?": { total: 0, limit: 50, offset: 0, items: [] },
      "/bets/recommendation": { recommendation: null },
      "/bets": {
        bet_spec_id: "new-bet-1",
        conversation_id: "conv-new",
        agent_reply: "Great idea! Tell me more about the problem.",
        agent_state: "collecting",
      },
    });

    const user = userEvent.setup();
    await renderPage();

    await waitFor(() => screen.getByText("Create your first bet"));
    await user.click(screen.getByText("Create your first bet"));

    await user.type(screen.getByPlaceholderText(/Simplify onboarding/i), "Test bet");
    await user.type(screen.getByPlaceholderText(/What problem/i), "We want to test this hypothesis");

    mockFetch({
      "/bets?": { total: 1, limit: 50, offset: 0, items: [] },
      "/bets/new-bet-1": { meta: {}, spec: null },
      "/bets": {
        bet_spec_id: "new-bet-1",
        conversation_id: "conv-new",
        agent_reply: "Great idea! Tell me more about the problem.",
        agent_state: "collecting",
      },
    });

    await user.click(screen.getByRole("button", { name: /Start Spec Conversation/i }));

    await waitFor(() => {
      expect(screen.getByText("Great idea! Tell me more about the problem.")).toBeInTheDocument();
    });
  });
});
