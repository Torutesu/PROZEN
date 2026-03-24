import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProductOverviewPage from "@/app/(app)/workspaces/[workspaceId]/products/[productId]/page";

const PARAMS = Promise.resolve({ workspaceId: "ws1", productId: "p1" });
const BRIEFING_DATE = "2026-03-10";
const BRIEFING_READ_KEY = `prozen:briefing:read:ws1:p1:${BRIEFING_DATE}`;

function mockFetch() {
  (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
    if (url.includes("/bets?")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            total: 2,
            items: [
              {
                id: "bet_1",
                title: "Improve onboarding",
                status: "active",
                currentVersionId: null,
                conversationId: null,
                outcomeNote: null,
                learningSummary: null,
                createdBy: "user_test123",
                createdAt: "2026-03-09T00:00:00Z",
                updatedAt: "2026-03-09T00:00:00Z",
              },
              {
                id: "bet_2",
                title: "Pricing experiment",
                status: "completed",
                currentVersionId: null,
                conversationId: null,
                outcomeNote: "done",
                learningSummary: "Users were sensitive to onboarding friction.",
                createdBy: "user_test123",
                createdAt: "2026-03-08T00:00:00Z",
                updatedAt: "2026-03-08T00:00:00Z",
              },
            ],
          }),
      });
    }
    if (url.includes("/anomalies")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ total: 0, items: [] }) });
    }
    if (url.includes("/decision-logs")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ total: 0, items: [] }) });
    }
    if (url.includes("/daily-briefing")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "brief_1",
            workspaceId: "ws1",
            productId: "p1",
            briefingDate: BRIEFING_DATE,
            content: "Focus on onboarding activation and reduce friction.",
            activeBets: 1,
            openAnomalies: 0,
            generatedAt: "2026-03-10T00:05:00Z",
          }),
      });
    }
    if (url.includes("/reviews/")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "rev_1",
            workspaceId: "ws1",
            productId: "p1",
            reviewType: "evening_review",
            reviewDate: BRIEFING_DATE,
            content: "Review content",
            metadata: {},
            generatedAt: "2026-03-10T20:00:00Z",
          }),
      });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

async function renderPage() {
  await act(async () => {
    render(<ProductOverviewPage params={PARAMS} />);
  });
}

describe("ProductOverviewPage briefing notice", () => {
  it("shows briefing notice on first load of the day", async () => {
    localStorage.clear();
    mockFetch();
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText("New daily briefing is ready.")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument();
  });

  it("dismisses briefing notice and stores read flag", async () => {
    localStorage.clear();
    mockFetch();
    const user = userEvent.setup();
    await renderPage();

    await waitFor(() => screen.getByRole("button", { name: "Dismiss" }));
    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    await waitFor(() => {
      expect(screen.queryByText("New daily briefing is ready.")).not.toBeInTheDocument();
    });
    expect(localStorage.getItem(BRIEFING_READ_KEY)).toBe("1");
  });

  it("does not show briefing notice when already read for today", async () => {
    localStorage.clear();
    localStorage.setItem(BRIEFING_READ_KEY, "1");
    mockFetch();
    await renderPage();

    await waitFor(() => {
      expect(screen.getByText("Focus on onboarding activation and reduce friction.")).toBeInTheDocument();
    });
    expect(screen.queryByText("New daily briefing is ready.")).not.toBeInTheDocument();
  });
});
