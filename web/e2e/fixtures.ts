/**
 * Playwright test fixtures for PROZEN E2E tests.
 *
 * Provides a pre-authenticated page context using a test user session cookie
 * set via CLERK_SESSION_TOKEN env var (injected in CI by clerk-testing-tokens).
 *
 * For local dev, set:
 *   CLERK_SESSION_TOKEN=<your-dev-session-token>
 *   PLAYWRIGHT_BASE_URL=http://localhost:3100
 *   PLAYWRIGHT_API_URL=http://localhost:8787
 *   PLAYWRIGHT_WS_ID=<existing-workspace-id> (optional, must pair with product id)
 *   PLAYWRIGHT_PRODUCT_ID=<existing-product-id> (optional, must pair with workspace id)
 */

import { test as base, expect, type Page } from "@playwright/test";

const BASE_URL = process.env["PLAYWRIGHT_BASE_URL"] ?? "http://localhost:3100";
const API_URL = process.env["PLAYWRIGHT_API_URL"] ?? "http://localhost:8787";
const WS_ID = process.env["PLAYWRIGHT_WS_ID"];
const PRODUCT_ID = process.env["PLAYWRIGHT_PRODUCT_ID"];
const CLERK_SESSION_TOKEN = process.env["CLERK_SESSION_TOKEN"];
const STRICT_E2E =
  process.env["PLAYWRIGHT_STRICT"] === "1" ||
  process.env["CI"] === "true";

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
      if (STRICT_E2E && !CLERK_SESSION_TOKEN) {
        throw new Error(
          "CLERK_SESSION_TOKEN is required in strict mode before auto-provisioning workspace/product.",
        );
      }

      const suffix = Math.random().toString(36).slice(2, 8);
      const setupPath = "/api/v1/workspaces/onboarding/setup";
      const res = await apiReq("POST", "/api/v1/workspaces/onboarding/setup", {
        workspaceName: `E2E Workspace ${suffix}`,
        productName: `E2E Product ${suffix}`,
        productDescription: "Auto-provisioned workspace/product for Playwright E2E",
        mainKpi: "Activation Rate",
        skipFirstBet: true,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        const hint =
          res.status === 404
            ? ` (check PLAYWRIGHT_API_URL=${API_URL} and that backend exposes ${setupPath})`
            : "";
        throw new Error(
          `Failed to auto-provision E2E workspace/product: ${res.status} ${body}${hint}`,
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
  authedPage: async ({ page }, applyFixture, testInfo) => {
    if (!CLERK_SESSION_TOKEN) {
      if (STRICT_E2E) {
        throw new Error(
          "CLERK_SESSION_TOKEN is required when PLAYWRIGHT_STRICT=1 or in CI.",
        );
      }
      testInfo.skip(true, "CLERK_SESSION_TOKEN is required for authenticated E2E tests.");
      await applyFixture(page);
      return;
    }
    await injectAuthCookie(page);
    await applyFixture(page);
  },

  apiRequest: async ({}, applyFixture) => {
    const apiReq = async (method: string, path: string, body?: unknown) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-actor-id": "playwright_e2e",
      };
      if (CLERK_SESSION_TOKEN) {
        headers["Authorization"] = `Bearer ${CLERK_SESSION_TOKEN}`;
      }
      try {
        return await fetch(`${API_URL}${path}`, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to reach API ${API_URL}${path}: ${message}`);
      }
    };
    await applyFixture(apiReq);
  },

  wsId: async ({ apiRequest }, applyFixture, testInfo) => {
    try {
      const ids = await ensureWorkspaceProduct(apiRequest);
      await applyFixture(ids.wsId);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to determine workspace/product IDs for E2E tests.";
      if (STRICT_E2E) {
        throw new Error(message);
      }
      testInfo.skip(true, message);
      await applyFixture("ws-e2e");
    }
  },

  productId: async ({ apiRequest }, applyFixture, testInfo) => {
    try {
      const ids = await ensureWorkspaceProduct(apiRequest);
      await applyFixture(ids.productId);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to determine workspace/product IDs for E2E tests.";
      if (STRICT_E2E) {
        throw new Error(message);
      }
      testInfo.skip(true, message);
      await applyFixture("p-e2e");
    }
  },
});
