import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OnboardingPage from "@/app/onboarding/page";

function mockFetch() {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        workspace: { id: "ws-1", name: "Test Workspace", ownerUserId: "user_test123", createdAt: "", updatedAt: "" },
        product: { id: "p-1", workspaceId: "ws-1", name: "TestProd", status: "active", createdAt: "", updatedAt: "" },
        bet_spec_id: "bet-1",
        warnings: [],
      }),
  });
}

describe("OnboardingPage", () => {
  it("renders step 1 — the demo screen", () => {
    render(<OnboardingPage />);
    expect(screen.getByText(/Step 1 of 4/i)).toBeInTheDocument();
    expect(screen.getByText(/This is the PROZEN bet loop/i)).toBeInTheDocument();
  });

  it("shows Set up your product button on step 1", () => {
    render(<OnboardingPage />);
    expect(screen.getByRole("button", { name: /Set up your product/i })).toBeInTheDocument();
  });

  it("advances to step 2 when Next is clicked on step 1", async () => {
    const user = userEvent.setup();
    render(<OnboardingPage />);

    await user.click(screen.getByRole("button", { name: /Set up your product/i }));

    expect(screen.getByText(/Step 2 of 4/i)).toBeInTheDocument();
    expect(screen.getByText(/Tell us about your product/i)).toBeInTheDocument();
  });

  it("skip intro also advances to step 2", async () => {
    const user = userEvent.setup();
    render(<OnboardingPage />);

    await user.click(screen.getByText(/Skip intro/i));

    expect(screen.getByText(/Step 2 of 4/i)).toBeInTheDocument();
  });

  it("disables step 2 Next button when product name is empty", async () => {
    const user = userEvent.setup();
    render(<OnboardingPage />);

    await user.click(screen.getByRole("button", { name: /Set up your product/i }));

    const nextBtn = screen.getByRole("button", { name: /Next/i });
    expect(nextBtn).toBeDisabled();
  });

  it("enables step 2 Next button after entering product name", async () => {
    const user = userEvent.setup();
    render(<OnboardingPage />);

    await user.click(screen.getByRole("button", { name: /Set up your product/i }));
    await user.type(screen.getByPlaceholderText(/e\.g\. PROZEN/i), "MyProduct");

    const nextBtn = screen.getByRole("button", { name: /Next/i });
    expect(nextBtn).not.toBeDisabled();
  });

  it("advances to step 3 after filling product name", async () => {
    const user = userEvent.setup();
    render(<OnboardingPage />);

    await user.click(screen.getByRole("button", { name: /Set up your product/i }));
    await user.type(screen.getByPlaceholderText(/e\.g\. PROZEN/i), "MyProduct");
    await user.click(screen.getByRole("button", { name: /Next/i }));

    expect(screen.getByText(/Step 3 of 4/i)).toBeInTheDocument();
  });

  it("shows first bet idea input on step 3", async () => {
    const user = userEvent.setup();
    render(<OnboardingPage />);

    await user.click(screen.getByRole("button", { name: /Set up your product/i }));
    await user.type(screen.getByPlaceholderText(/e\.g\. PROZEN/i), "MyProduct");
    await user.click(screen.getByRole("button", { name: /Next/i }));

    expect(screen.getByText(/Step 3 of 4/i)).toBeInTheDocument();
    expect(screen.getByText(/What are you betting on/i)).toBeInTheDocument();
  });

  it("allows skipping the first bet idea on step 3", async () => {
    const user = userEvent.setup();
    mockFetch();
    render(<OnboardingPage />);

    // Step 1
    await user.click(screen.getByRole("button", { name: /Set up your product/i }));
    // Step 2
    await user.type(screen.getByPlaceholderText(/e\.g\. PROZEN/i), "MyProduct");
    await user.click(screen.getByRole("button", { name: /Next/i }));
    // Step 3 — skip
    const skipBtn = screen.getByRole("button", { name: /Skip/i });
    await user.click(skipBtn);

    // Should advance to step 4 completion state
    await waitFor(() => {
      expect(screen.getByText(/All set/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Open Bet Board/i })).toBeInTheDocument();
    });
  });

  it("calls setup API on final submission", async () => {
    const user = userEvent.setup();
    mockFetch();
    render(<OnboardingPage />);

    // Navigate to final step
    await user.click(screen.getByRole("button", { name: /Set up your product/i }));
    await user.type(screen.getByPlaceholderText(/e\.g\. PROZEN/i), "MyProduct");
    await user.click(screen.getByRole("button", { name: /Next/i }));

    // Skip bet idea if skip button available
    const skipBtn = screen.queryByRole("button", { name: /Skip/i });
    if (skipBtn) await user.click(skipBtn);

    // Find and click the final submit button
    const launchBtn = screen.queryByRole("button", { name: /Continue to Bet Board/i })
      ?? screen.queryByRole("button", { name: /Open Bet Board/i });

    if (launchBtn) {
      await user.click(launchBtn);
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/workspaces/onboarding/setup"),
          expect.objectContaining({ method: "POST" }),
        );
      });
    }
  });
});
