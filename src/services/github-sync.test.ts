import { afterEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import {
  deleteGitHubWebhook,
  verifyWebhookSignature,
} from "./github-sync.js";

const { fetchMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
}));

vi.stubGlobal("fetch", fetchMock);

afterEach(() => {
  fetchMock.mockReset();
});

describe("verifyWebhookSignature", () => {
  it("returns true when signature matches payload", () => {
    const payload = JSON.stringify({ hello: "world" });
    const secret = "test_secret";
    const sig = `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;

    expect(verifyWebhookSignature(payload, sig, secret)).toBe(true);
  });

  it("returns false when signature is invalid", () => {
    const payload = JSON.stringify({ hello: "world" });
    const secret = "test_secret";
    expect(verifyWebhookSignature(payload, "sha256=invalid", secret)).toBe(false);
    expect(verifyWebhookSignature(payload, null, secret)).toBe(false);
  });
});

describe("deleteGitHubWebhook", () => {
  it("treats 404 as successful cleanup", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 404 }));
    await expect(deleteGitHubWebhook("owner/repo", "123", "ghp_x")).resolves.toBeUndefined();
  });

  it("throws on non-404 failure response", async () => {
    fetchMock.mockResolvedValueOnce(new Response("boom", { status: 500 }));
    await expect(deleteGitHubWebhook("owner/repo", "123", "ghp_x"))
      .rejects.toThrow("Failed to delete webhook: 500 boom");
  });
});
