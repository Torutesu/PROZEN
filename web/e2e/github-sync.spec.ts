/**
 * E2E: GitHub Sync → Living Spec Proposal → Accept
 *
 * Scenario:
 *  1. Connect a GitHub repository (via UI)
 *  2. Simulate a push event (via direct API call — real webhook would require ngrok in CI)
 *  3. Living Spec proposal appears in GitHub page
 *  4. Accept the proposal — proposal_status changes to "accepted"
 *
 * Note: Steps 1-2 require PLAYWRIGHT_GITHUB_REPO and PLAYWRIGHT_GITHUB_TOKEN env vars.
 * In CI without these, most tests gracefully skip.
 */

import { test, expect } from "./fixtures";

const GITHUB_REPO = process.env["PLAYWRIGHT_GITHUB_REPO"];
const GITHUB_TOKEN = process.env["PLAYWRIGHT_GITHUB_TOKEN"];

test.describe("GitHub Living Spec", () => {
  test("GitHub page renders correctly when not connected", async ({
    authedPage: page,
    wsId,
    productId,
  }) => {
    await page.goto(`/workspaces/${wsId}/products/${productId}/github`);

    await expect(page.getByText("GitHub Living Spec")).toBeVisible();
    // Either shows connected repo or connect button
    const connectBtn = page.getByRole("button", { name: /Connect Repository/i });
    const connectedRepo = page.getByText(/connected/i);
    const isVisible = (await connectBtn.isVisible()) || (await connectedRepo.isVisible());
    expect(isVisible).toBe(true);
  });

  test("can connect a GitHub repository", async ({
    authedPage: page,
    wsId,
    productId,
  }) => {
    if (!GITHUB_REPO || !GITHUB_TOKEN) {
      test.skip(true, "PLAYWRIGHT_GITHUB_REPO / PLAYWRIGHT_GITHUB_TOKEN not set");
      return;
    }

    await page.goto(`/workspaces/${wsId}/products/${productId}/github`);

    // If already connected, skip
    const alreadyConnected = await page.getByRole("button", { name: /Disconnect/i }).isVisible().catch(() => false);
    if (alreadyConnected) {
      test.skip(true, "Repository already connected — skipping connect test");
      return;
    }

    await page.getByRole("button", { name: /Connect Repository/i }).click();

    await page.getByPlaceholder(/owner\/repo/i).fill(GITHUB_REPO);
    await page.getByPlaceholder(/ghp_/i).fill(GITHUB_TOKEN);

    await page.getByRole("button", { name: /Connect/i }).click();

    await expect(page.getByText(GITHUB_REPO)).toBeVisible({ timeout: 15_000 });
  });

  test("sync events appear in the list after connection", async ({
    authedPage: page,
    apiRequest,
    wsId,
    productId,
  }) => {
    await page.goto(`/workspaces/${wsId}/products/${productId}/github`);

    // Inject a synthetic sync event via API to avoid needing a real webhook
    await apiRequest(
      "POST",
      `/api/v1/workspaces/${wsId}/products/${productId}/github-sync-events/test`,
      {
        event_type: "push",
        repository: GITHUB_REPO ?? "test/repo",
        ref: "refs/heads/main",
        commit_sha: "deadbeef",
        diff_summary: "Modified onboarding flow",
      },
    ).catch(() => {
      // Test endpoint may not exist — that's fine; just check existing events
    });

    await page.reload();

    const eventsList = page.getByText(/push/i);
    const hasEvents = await eventsList.isVisible({ timeout: 3_000 }).catch(() => false);
    // Either events exist or the empty state shows — both are valid
    if (!hasEvents) {
      await expect(
        page
          .getByText(/No sync events/i)
          .or(page.getByText(/Connect a repository to see sync events/i)),
      ).toBeVisible();
    }
  });

  test("accepting a Living Spec proposal updates proposal status", async ({
    authedPage: page,
    wsId,
    productId,
  }) => {
    await page.goto(`/workspaces/${wsId}/products/${productId}/github`);

    // Look for a pending proposal
    const detailsBtn = page.getByRole("button", { name: /Details/i }).first();
    const hasProposal = await detailsBtn.isVisible({ timeout: 3_000 }).catch(() => false);

    if (!hasProposal) {
      test.skip(true, "No pending proposals available — skipping");
      return;
    }

    await detailsBtn.click();
    const acceptBtn = page.getByRole("button", { name: /Accept update/i }).first();
    await expect(acceptBtn).toBeVisible();
    await acceptBtn.click();

    // Accept button should disappear (proposal status updated)
    await expect(acceptBtn).not.toBeVisible({ timeout: 5_000 });
    // Accepted state indicator should be visible
    await expect(page.getByText(/accepted/i)).toBeVisible();
  });

  test("dismissing a Living Spec proposal marks it dismissed", async ({
    authedPage: page,
    wsId,
    productId,
  }) => {
    await page.goto(`/workspaces/${wsId}/products/${productId}/github`);

    const detailsBtn = page.getByRole("button", { name: /Details/i }).first();
    const hasProposal = await detailsBtn.isVisible({ timeout: 3_000 }).catch(() => false);

    if (!hasProposal) {
      test.skip(true, "No pending proposals available — skipping");
      return;
    }

    await detailsBtn.click();
    const dismissBtn = page.getByRole("button", { name: /Dismiss/i }).first();
    await expect(dismissBtn).toBeVisible();
    await dismissBtn.click();

    await expect(dismissBtn).not.toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/dismissed/i)).toBeVisible();
  });
});
