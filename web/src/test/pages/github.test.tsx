import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import GitHubPage from "@/app/(app)/workspaces/[workspaceId]/products/[productId]/github/page";

const PARAMS = Promise.resolve({ workspaceId: "ws1", productId: "p1" });

const mockConnection = {
  connection_id: "conn-1",
  repository: "acme/webapp",
  webhook_id: "wh-1",
  is_active: true,
  created_at: "2026-03-01T00:00:00Z",
  updated_at: "2026-03-01T00:00:00Z",
};

const mockSyncEvent = {
  id: "ev-1",
  event_type: "push",
  repository: "acme/webapp",
  ref: "refs/heads/main",
  commit_sha: "abc1234",
  pr_number: null,
  pr_title: null,
  diff_summary: "Modified onboarding flow in src/onboarding.ts",
  analysis: {
    summary: "Changes to onboarding affect the activation bet hypothesis.",
    affectedBets: [
      {
        betSpecId: "bet-1",
        sections: ["hypothesis", "acceptanceCriteria"],
        reason: "Onboarding flow changes directly impact activation metric",
        suggestedUpdate: "Update acceptance criteria to reflect new onboarding steps.",
      },
    ],
    confidence: "high" as const,
  },
  status: "processed",
  proposal_status: "pending" as const,
  retry_count: 0,
  next_attempt_at: null,
  last_error: null,
  created_at: "2026-03-07T09:00:00Z",
  processed_at: "2026-03-07T09:01:00Z",
};

function mockFetchConnected() {
  (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
    if (url.includes("/github-sync-events")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ total: 1, limit: 20, offset: 0, items: [mockSyncEvent] }),
      });
    }
    if (url.includes("/github-connections")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ connected: true, connection: mockConnection }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

function mockFetchDisconnected() {
  (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
    if (url.includes("/github-sync-events")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ total: 0, limit: 20, offset: 0, items: [] }) });
    }
    if (url.includes("/github-connections")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ connected: false, connection: null }) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

async function renderPage() {
  await act(async () => {
    render(<GitHubPage params={PARAMS} />);
  });
}

describe("GitHubPage", () => {
  it("renders the page header", async () => {
    mockFetchDisconnected();
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("GitHub Living Spec")).toBeInTheDocument();
    });
  });

  it("shows Connect Repository button when not connected", async () => {
    mockFetchDisconnected();
    await renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Connect Repository/i })).toBeInTheDocument();
    });
  });

  it("shows connected repository info when connected", async () => {
    mockFetchConnected();
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("acme/webapp")).toBeInTheDocument();
    });
  });

  it("shows Disconnect button when connected", async () => {
    mockFetchConnected();
    await renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Disconnect/i })).toBeInTheDocument();
    });
  });

  it("shows sync event in the events list", async () => {
    mockFetchConnected();
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText(/refs\/heads\/main/i)).toBeInTheDocument();
    });
  });

  it("shows pending proposal Accept/Dismiss buttons", async () => {
    mockFetchConnected();
    await renderPage();

    await waitFor(() => screen.getByText(/refs\/heads\/main/i));
    // Expand the event to see proposal actions
    const expandBtn = screen.getByRole("button", { name: /Details/i });
    await userEvent.setup().click(expandBtn);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Accept update/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Dismiss/i })).toBeInTheDocument();
    });
  });

  it("accepts a Living Spec proposal", async () => {
    const user = userEvent.setup();
    let proposalStatus: "pending" | "accepted" = "pending";
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes("/github-sync-events/ev-1") && opts?.method === "PATCH") {
        proposalStatus = "accepted";
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ event_id: "ev-1", proposal_status: "accepted" }),
        });
      }
      if (url.includes("/github-sync-events")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            total: 1, limit: 20, offset: 0,
            items: [{ ...mockSyncEvent, proposal_status: proposalStatus }],
          }),
        });
      }
      if (url.includes("/github-connections")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ connected: true, connection: mockConnection }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    await renderPage();
    await waitFor(() => screen.getByText(/refs\/heads\/main/i));

    const expandBtn = screen.getByRole("button", { name: /Details/i });
    await user.click(expandBtn);

    await waitFor(() => screen.getByRole("button", { name: /Accept update/i }));
    await user.click(screen.getByRole("button", { name: /Accept update/i }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /Accept update/i })).not.toBeInTheDocument();
    });
  });

  it("shows connect form when Connect button is clicked", async () => {
    const user = userEvent.setup();
    mockFetchDisconnected();
    await renderPage();

    await waitFor(() => screen.getByRole("button", { name: /Connect Repository/i }));
    await user.click(screen.getByRole("button", { name: /Connect Repository/i }));

    expect(screen.getByPlaceholderText(/owner\/repo/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/ghp_/i)).toBeInTheDocument();
  });
});
