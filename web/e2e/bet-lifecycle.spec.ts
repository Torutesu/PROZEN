/**
 * E2E: Full Bet Lifecycle
 *
 * Scenario: Create bet → converse with AI agent → complete → learning generated → Context Pack updated
 *
 * Requires:
 *   PLAYWRIGHT_WS_ID and PLAYWRIGHT_PRODUCT_ID pointing to an existing workspace/product
 *   CLERK_SESSION_TOKEN for auth
 */

import { test, expect } from "./fixtures";

test.describe("Full Bet Lifecycle", () => {
  let betId: string;

  test("creates a new bet spec via conversation", async ({ authedPage: page, wsId, productId }) => {
    await page.goto(`/workspaces/${wsId}/products/${productId}/bets`);

    await page.getByRole("button", { name: /\+ New Bet/i }).click();

    await page.getByPlaceholder(/Simplify onboarding/i).fill("E2E Test Bet");
    await page.getByPlaceholder(/What problem/i).fill(
      "We believe simplifying the checkout will improve conversion rate by 5%"
    );
    await page.getByRole("button", { name: /Start Spec Conversation/i }).click();

    // Agent should reply
    await expect(page.getByText(/Thinking/i)).toBeVisible({ timeout: 3_000 }).catch(() => {});
    await expect(page.locator(".bg-muted .whitespace-pre-wrap").first()).toBeVisible({ timeout: 30_000 });

    // Conversation view should be open
    await expect(page.getByText("← Back to bets")).toBeVisible();
  });

  test("sends a follow-up message in the conversation", async ({ authedPage: page, wsId, productId }) => {
    await page.goto(`/workspaces/${wsId}/products/${productId}/bets`);

    // Open first active bet
    const firstOpenBtn = page.getByRole("button", { name: /Open/i }).first();
    await firstOpenBtn.click();

    // Type a message
    const input = page.locator("input[placeholder*='Reply to the agent']")
      .or(page.locator("input[placeholder*='Spec finalized']"));
    await input.fill("The target user is a solo founder with no PM team");
    await page.getByRole("button", { name: /Send/i }).click();

    // Should show user message and agent reply
    await expect(page.getByText("The target user is a solo founder with no PM team")).toBeVisible();
    await expect(page.locator(".bg-muted").last()).toBeVisible({ timeout: 30_000 });
  });

  test("completes a bet and generates learning summary", async ({ authedPage: page, wsId, productId }) => {
    await page.goto(`/workspaces/${wsId}/products/${productId}/bets`);

    // Open a bet that is not completed
    const openBtn = page.getByRole("button", { name: /Open/i }).first();
    await openBtn.click();

    // Click Mark Complete
    const markComplete = page.getByRole("button", { name: /Mark Complete/i });
    if (!(await markComplete.isVisible())) {
      test.skip(true, "No completable bet available — skipping");
      return;
    }
    await markComplete.click();

    // Fill in outcome note
    await page.getByPlaceholder(/We shipped the shorter onboarding/i).fill(
      "We shipped the simplified checkout. Conversion improved by +3.2% over 14 days."
    );
    await page.getByRole("button", { name: /Complete & Generate Learning/i }).click();

    // Learning summary should appear
    await expect(page.getByText(/Learning captured/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Bet completed/i)).toBeVisible();
  });

  test("new bet form shows recommendation after a completed bet", async ({ authedPage: page, wsId, productId }) => {
    await page.goto(`/workspaces/${wsId}/products/${productId}/bets`);

    await page.getByRole("button", { name: /\+ New Bet/i }).click();

    // If a completed bet with next_bet_hypothesis exists, recommendation banner should appear
    const banner = page.getByText("AI Recommendation");
    const hasRecommendation = await banner.isVisible({ timeout: 3_000 }).catch(() => false);

    if (hasRecommendation) {
      await page.getByText("Use as starting point →").click();
      const textarea = page.getByPlaceholder(/What problem/i);
      const value = await textarea.inputValue();
      expect(value.length).toBeGreaterThan(0);
    } else {
      // No recommendation is also a valid state — just confirm page renders
      await expect(page.getByText("Bet title")).toBeVisible();
    }
  });
});
