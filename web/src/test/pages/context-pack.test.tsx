import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ContextPackPage from "@/app/(app)/workspaces/[workspaceId]/products/[productId]/context-pack/page";

const PARAMS = Promise.resolve({ workspaceId: "ws1", productId: "p1" });

const mockCurrentPack = {
  context_pack_id: "cp-1",
  current_version: 3,
  data: {
    productName: "PROZEN",
    mainKpi: "MRR",
    targetMarket: "Solo founders",
  },
};

const mockVersions = {
  total: 3,
  limit: 50,
  offset: 0,
  items: [
    { id: "v3", versionNumber: 3, summary: "Added KPI info", source: "manual", createdBy: "user_test123", createdAt: "2026-03-03T00:00:00Z" },
    { id: "v2", versionNumber: 2, summary: "Updated target market", source: "manual", createdBy: "user_test123", createdAt: "2026-03-02T00:00:00Z" },
    { id: "v1", versionNumber: 1, summary: "Initial context", source: "onboarding", createdBy: "user_test123", createdAt: "2026-03-01T00:00:00Z" },
  ],
};

function mockFetch(currentPack = mockCurrentPack, versions = mockVersions) {
  (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
    if (url.includes("/context-pack/versions")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(versions) });
    }
    if (url.includes("/context-pack/ingest")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          job_id: "job-1",
          status: "processing",
          provisional_version: { context_pack_id: "cp-1", version: 4, version_id: "v4", created_at: new Date().toISOString() },
        }),
      });
    }
    if (url.includes("/context-pack/restore")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) });
    }
    if (url.includes("/context-pack")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(currentPack) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

async function renderPage() {
  await act(async () => {
    render(<ContextPackPage params={PARAMS} />);
  });
}

describe("ContextPackPage", () => {
  it("renders the page header", async () => {
    mockFetch();
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Context Pack")).toBeInTheDocument();
    });
  });

  it("shows the ingest textarea and update button", async () => {
    mockFetch();
    await renderPage();
    await waitFor(() => {
      expect(screen.getByRole("textbox")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Ingest/i })).toBeInTheDocument();
    });
  });

  it("displays current context data after loading", async () => {
    mockFetch();
    await renderPage();
    await waitFor(() => {
      expect(screen.getAllByText(/v3/i).length).toBeGreaterThan(0);
    });
  });

  it("shows version history list", async () => {
    mockFetch();
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Added KPI info")).toBeInTheDocument();
      expect(screen.getByText("Updated target market")).toBeInTheDocument();
      expect(screen.getByText("Initial context")).toBeInTheDocument();
    });
  });

  it("disables Update button when textarea is empty", async () => {
    mockFetch();
    await renderPage();
    await waitFor(() => {
      const btn = screen.getByRole("button", { name: /Ingest/i });
      expect(btn).toBeDisabled();
    });
  });

  it("enables Update button after typing", async () => {
    const user = userEvent.setup();
    mockFetch();
    await renderPage();

    await waitFor(() => screen.getByRole("textbox"));
    await user.type(screen.getByRole("textbox"), "New context info");

    expect(screen.getByRole("button", { name: /Ingest/i })).not.toBeDisabled();
  });

  it("calls ingest API and clears textarea on submit", async () => {
    const user = userEvent.setup();
    mockFetch();
    await renderPage();

    await waitFor(() => screen.getByRole("textbox"));
    await user.type(screen.getByRole("textbox"), "New context info");
    await user.click(screen.getByRole("button", { name: /Ingest/i }));

    await waitFor(() => {
      const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
      expect(textarea.value).toBe("");
    });
  });

  it("shows Restore button for each version", async () => {
    mockFetch();
    await renderPage();
    await waitFor(() => {
      const restoreButtons = screen.getAllByRole("button", { name: /Restore/i });
      expect(restoreButtons.length).toBe(
        mockVersions.items.filter((v) => v.versionNumber !== mockCurrentPack.current_version).length,
      );
    });
  });

  it("shows empty state when no current context exists", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url.includes("/context-pack/versions")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ total: 0, limit: 50, offset: 0, items: [] }) });
      }
      return Promise.resolve({ ok: false, json: () => Promise.resolve({ code: "not_found", message: "Not found" }) });
    });

    await renderPage();
    await waitFor(() => {
      expect(screen.getByText(/No context pack yet/i)).toBeInTheDocument();
    });
  });
});
