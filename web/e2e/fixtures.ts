/**
 * Playwright test fixtures for PROZEN E2E tests.
 *
 * Provides a pre-authenticated page context using a test user session cookie
 * set via CLERK_SESSION_TOKEN env var (injected in CI by clerk-testing-tokens).
 *
 * For local dev, set:
 *   CLERK_SESSION_TOKEN=<your-dev-session-token>
 *   PLAYWRIGHT_BASE_URL=http://localhost:3000
 *   PLAYWRIGHT_API_URL=http://localhost:8787
 */

import { test as base, expect, type Page } from "@playwright/test";

const API_URL = process.env["PLAYWRIGHT_API_URL"] ?? "http://localhost:8787";
const WS_ID = process.env["PLAYWRIGHT_WS_ID"] ?? "ws-e2e";
const PRODUCT_ID = process.env["PLAYWRIGHT_PRODUCT_ID"] ?? "p-e2e";

/** Auth context: inject session token cookie so Clerk accepts the page as authenticated. */
async function injectAuthCookie(page: Page) {
  const token = process.env["CLERK_SESSION_TOKEN"];
  if (token) {
    await page.context().addCookies([
      {
        name: "__session",
        value: token,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
      },
    ]);
  }
}

export { expect };

export const test = base.extend<{
  authedPage: Page;
  apiRequest: (method: string, path: string, body?: unknown) => Promise<Response>;
  wsId: string;
  productId: string;
}>({
  authedPage: async ({ page }, use) => {
    await injectAuthCookie(page);
    await use(page);
  },

  apiRequest: async ({}, use) => {
    const token = process.env["CLERK_SESSION_TOKEN"] ?? "test";
    const apiReq = async (method: string, path: string, body?: unknown) => {
      return fetch(`${API_URL}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    };
    await use(apiReq);
  },

  wsId: async ({}, use) => {
    await use(WS_ID);
  },

  productId: async ({}, use) => {
    await use(PRODUCT_ID);
  },
});
