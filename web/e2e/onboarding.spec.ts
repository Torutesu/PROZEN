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
    await page.getByRole("button", { name: /Next/i }).click();

    // Step 3: First bet idea
    await expect(page.getByText("Step 3 of 4")).toBeVisible();
    await page.getByRole("button", { name: /Skip/i }).click();

    // Step 4: Preview / Launch
    await expect(page.getByText(/Step 4/i)).toBeVisible();
    const launchBtn = page.getByRole("button", { name: /Launch PROZEN/i })
      .or(page.getByRole("button", { name: /Get Started/i }));
    await launchBtn.click();

    // Should redirect to workspaces or dashboard
    await expect(page).toHaveURL(/\/(workspaces|dashboard)/i, { timeout: 15_000 });
  });

  test("shows bet preview when first bet idea is entered", async ({ authedPage: page }) => {
    await page.goto("/onboarding");

    await page.getByRole("button", { name: /Set up your product/i }).click();
    await page.getByPlaceholder(/e\.g\. PROZEN/i).fill("My SaaS");
    await page.getByRole("button", { name: /Next/i }).click();

    // Step 3: enter a bet idea
    await page.getByText("Step 3 of 4").waitFor();
    const betInput = page.getByPlaceholder(/What are you betting on/i)
      .or(page.getByRole("textbox").first());
    await betInput.fill("Simplifying checkout will increase conversion by 5%");

    // Preview should appear
    await expect(page.getByText(/Hypothesis/i)).toBeVisible({ timeout: 5_000 });
  });
});
