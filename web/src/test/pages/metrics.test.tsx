import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MetricsPage from "@/app/(app)/workspaces/[workspaceId]/products/[productId]/metrics/page";

const PARAMS = Promise.resolve({ workspaceId: "ws1", productId: "p1" });

const mockMetrics = [
  {
    id: "m1",
    workspaceId: "ws1",
    productId: "p1",
    name: "Day-7 Retention",
    description: "Percentage of users returning on day 7",
    layer: "bet" as const,
    unit: "%",
    direction: "increase" as const,
    targetValue: 30,
    baselineValue: 22,
    betSpecId: "bet-1",
    isActive: true,
    createdBy: "user_test123",
    createdAt: "2026-03-01T00:00:00Z",
    updatedAt: "2026-03-01T00:00:00Z",
  },
  {
    id: "m2",
    workspaceId: "ws1",
    productId: "p1",
    name: "MRR",
    description: "Monthly recurring revenue",
    layer: "kpi" as const,
    unit: "USD",
    direction: "increase" as const,
    targetValue: 10000,
    baselineValue: 5000,
    betSpecId: null,
    isActive: true,
    createdBy: "user_test123",
    createdAt: "2026-03-01T00:00:00Z",
    updatedAt: "2026-03-01T00:00:00Z",
  },
];

const mockAnomalies = [
  {
    id: "an-1",
    metricId: "m1",
    metricName: "Day-7 Retention",
    readingId: "r1",
    severity: "high" as const,
    direction: "below_target" as const,
    baselineValue: 22,
    actualValue: 15,
    deviationPct: -31.8,
    impactNarrative: "Retention dropped significantly below baseline",
    isResolved: false,
    createdAt: "2026-03-07T10:00:00Z",
  },
];

function mockFetch() {
  (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
    if (url.includes("/anomalies")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ total: 1, items: mockAnomalies }) });
    }
    if (url.includes("/metrics")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ total: 2, items: mockMetrics }) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

async function renderPage() {
  await act(async () => {
    render(<MetricsPage params={PARAMS} />);
  });
}

describe("MetricsPage", () => {
  it("renders the page header", async () => {
    mockFetch();
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Metrics")).toBeInTheDocument();
    });
  });

  it("shows layer sections: Bet, KPI, Activity", async () => {
    mockFetch();
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Bet Layer/i)).toBeInTheDocument();
      expect(screen.getByText(/KPI Layer/i)).toBeInTheDocument();
      expect(screen.getByText(/Activity Layer/i)).toBeInTheDocument();
    });
  });

  it("displays metrics after loading", async () => {
    mockFetch();
    await renderPage();
    await waitFor(() => {
      expect(screen.getAllByText("Day-7 Retention").length).toBeGreaterThan(0);
    });
  });

  it("shows anomaly section with active anomalies", async () => {
    mockFetch();
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Retention dropped significantly below baseline")).toBeInTheDocument();
    });
  });

  it("shows Resolve button for unresolved anomalies", async () => {
    mockFetch();
    await renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Resolve/i })).toBeInTheDocument();
    });
  });

  it("resolves anomaly and removes it from list", async () => {
    const user = userEvent.setup();
    let resolved = false;
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes("/anomalies/an-1/resolve") && opts?.method === "POST") {
        resolved = true;
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
      }
      if (url.includes("/anomalies")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve(
              resolved
                ? { total: 0, items: [] }
                : { total: 1, items: mockAnomalies },
            ),
        });
      }
      if (url.includes("/metrics")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ total: 2, items: mockMetrics }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });

    await renderPage();
    await waitFor(() => screen.getByRole("button", { name: /Resolve/i }));
    await user.click(screen.getByRole("button", { name: /Resolve/i }));

    await waitFor(() => {
      expect(screen.queryByText("Retention dropped significantly below baseline")).not.toBeInTheDocument();
    });
  });

  it("shows Add Metric form toggle", async () => {
    mockFetch();
    const user = userEvent.setup();
    await renderPage();

    await waitFor(() => screen.getByRole("button", { name: /Add Metric/i }));
    await user.click(screen.getByRole("button", { name: /Add Metric/i }));

    expect(screen.getByPlaceholderText(/e\.g\. Activation Rate/i)).toBeInTheDocument();
  });

  it("disables Save button when metric name is empty", async () => {
    mockFetch();
    const user = userEvent.setup();
    await renderPage();

    await waitFor(() => screen.getByRole("button", { name: /Add Metric/i }));
    await user.click(screen.getByRole("button", { name: /Add Metric/i }));

    expect(screen.getByRole("button", { name: /Add Metric/i })).toBeDisabled();
  });

  it("shows empty state when no metrics exist", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes("/anomalies")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ total: 0, items: [] }) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ total: 0, items: [] }) });
    });

    await renderPage();
    await waitFor(() => {
      expect(screen.getByText(/No bet metrics yet/i)).toBeInTheDocument();
      expect(screen.getByText(/No kpi metrics yet/i)).toBeInTheDocument();
      expect(screen.getByText(/No activity metrics yet/i)).toBeInTheDocument();
    });
  });
});
