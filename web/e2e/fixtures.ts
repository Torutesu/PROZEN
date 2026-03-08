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

const BASE_URL = process.env["PLAYWRIGHT_BASE_URL"] ?? "http://localhost:3100";
const API_URL = process.env["PLAYWRIGHT_API_URL"] ?? "http://localhost:8787";
const WS_ID = process.env["PLAYWRIGHT_WS_ID"];
const PRODUCT_ID = process.env["PLAYWRIGHT_PRODUCT_ID"];
const CLERK_SESSION_TOKEN = process.env["CLERK_SESSION_TOKEN"];

let seededWorkspaceProduct:
  | Promise<{ wsId: string; productId: string }>
  | null = null;

async function ensureWorkspaceProduct(
  apiReq: (method: string, path: string, body?: unknown) => Promise<Response>,
): Promise<{ wsId: string; productId: string }> {
  if (WS_ID && PRODUCT_ID) {
    return { wsId: WS_ID, productId: PRODUCT_ID };
  }
  if (WS_ID || PRODUCT_ID) {
    throw new Error(
      "PLAYWRIGHT_WS_ID and PLAYWRIGHT_PRODUCT_ID must be set together.",
    );
  }

  if (!seededWorkspaceProduct) {
    seededWorkspaceProduct = (async () => {
      const suffix = Math.random().toString(36).slice(2, 8);
      const res = await apiReq("POST", "/api/v1/workspaces/onboarding/setup", {
        workspaceName: `E2E Workspace ${suffix}`,
        productName: `E2E Product ${suffix}`,
        productDescription: "Auto-provisioned workspace/product for Playwright E2E",
        mainKpi: "Activation Rate",
        skipFirstBet: true,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(
          `Failed to auto-provision E2E workspace/product: ${res.status} ${body}`,
        );
      }

      const json = (await res.json()) as {
        workspace: { id: string };
        product: { id: string };
      };
      return { wsId: json.workspace.id, productId: json.product.id };
    })();
  }

  return seededWorkspaceProduct;
}

/** Auth context: inject session token cookie so Clerk accepts the page as authenticated. */
async function injectAuthCookie(page: Page) {
  if (CLERK_SESSION_TOKEN) {
    await page.context().addCookies([
      {
        name: "__session",
        value: CLERK_SESSION_TOKEN,
        url: BASE_URL,
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

  wsId: async ({ apiRequest }, use, testInfo) => {
    try {
      const ids = await ensureWorkspaceProduct(apiRequest);
      await use(ids.wsId);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to determine workspace/product IDs for E2E tests.";
      testInfo.skip(message);
      await use("ws-e2e");
    }
  },

  productId: async ({ apiRequest }, use, testInfo) => {
    try {
      const ids = await ensureWorkspaceProduct(apiRequest);
      await use(ids.productId);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to determine workspace/product IDs for E2E tests.";
      testInfo.skip(message);
      await use("p-e2e");
    }
  },
});
