/**
 * E2E: Onboarding → First Bet
 *
 * Scenario: A new user signs up, completes the 4-step onboarding wizard,
 * and lands on the dashboard with a first bet already in draft state.
 */

import { test, expect } from "./fixtures";

test.describe("Onboarding → First Bet", () => {
  test("completes 4-step onboarding and creates workspace", async ({ authedPage: page }) => {
    await page.goto("/onboarding");

    // Step 1: Demo screen
    await expect(page.getByText("This is the PROZEN bet loop")).toBeVisible();
    await page.getByRole("button", { name: /Set up your product/i }).click();

    // Step 2: Product info
    await expect(page.getByText("Step 2 of 4")).toBeVisible();
    await page.getByPlaceholder(/e\.g\. PROZEN/i).fill("E2E Test Product");
    await page.getByPlaceholder(/AI-native PM OS/i).fill("A test product for E2E scenarios");
    await page.getByRole("button", { name: "Next →" }).click();

    // Step 3: First bet idea
    await expect(page.getByText("Step 3 of 4")).toBeVisible();
    await page.getByRole("button", { name: /Skip/i }).click();

    // Step 4: Preview / Launch
    await expect(page.getByText(/Step 4/i)).toBeVisible();
    const launchBtn = page
      .getByRole("button", { name: /Continue to Bet Board/i })
      .or(page.getByRole("button", { name: /Open Bet Board/i }));
    await launchBtn.click();

    // Should redirect to the bet board
    await expect(page).toHaveURL(/\/workspaces\/[^/]+\/products\/[^/]+\/bets/i, { timeout: 15_000 });
  });

  test("shows bet preview when first bet idea is entered", async ({ authedPage: page }) => {
    await page.goto("/onboarding");

    await page.getByRole("button", { name: /Set up your product/i }).click();
    await page.getByPlaceholder(/e\.g\. PROZEN/i).fill("My SaaS");
    await page.getByRole("button", { name: "Next →" }).click();

    // Step 3: enter a bet idea
    await page.getByText("Step 3 of 4").waitFor();
    const betInput = page.getByPlaceholder(/Simplifying the onboarding flow/i)
      .or(page.getByRole("textbox").first());
    await betInput.fill("Simplifying checkout will increase conversion by 5%");
    await page.getByRole("button", { name: /Generate my first Bet/i }).click();

    // Preview should appear
    await expect(page.getByText(/Your first Bet is ready/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Hypothesis/i)).toBeVisible();
  });
});
