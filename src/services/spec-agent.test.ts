import { afterEach, describe, expect, it, vi } from "vitest";
import { callSpecAgent } from "./spec-agent.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("callSpecAgent offline fallback", () => {
  it("keeps collecting/clarifying on early turns", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");

    const result = await callSpecAgent({
      messages: [
        {
          role: "user",
          content: "I want to improve onboarding completion.",
          createdAt: new Date().toISOString(),
        },
      ],
      contextPackJson: null,
      betId: "bet_123",
      workspaceId: "ws_123",
      productId: "prod_123",
      actorId: "user_123",
      contextPackVersionId: "cpv_123",
    });

    expect(result.state).toBe("clarifying");
    expect(result.spec).toBeUndefined();
  });

  it("uses provided IDs when it generates a spec offline", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");

    const result = await callSpecAgent({
      messages: [
        {
          role: "user",
          content: "Bet idea one",
          createdAt: new Date().toISOString(),
        },
        {
          role: "assistant",
          content: "Need more detail.",
          createdAt: new Date().toISOString(),
        },
        {
          role: "user",
          content: "Primary users are trial accounts.",
          createdAt: new Date().toISOString(),
        },
        {
          role: "assistant",
          content: "Any risks?",
          createdAt: new Date().toISOString(),
        },
        {
          role: "user",
          content: "Risk is rollout confusion.",
          createdAt: new Date().toISOString(),
        },
      ],
      contextPackJson: null,
      betId: "bet_abc",
      workspaceId: "ws_abc",
      productId: "prod_abc",
      actorId: "user_abc",
      contextPackVersionId: "cpv_abc",
    });

    expect(result.state).toBe("generating");
    expect(result.spec?.betId).toBe("bet_abc");
    expect(result.spec?.workspaceId).toBe("ws_abc");
    expect(result.spec?.productId).toBe("prod_abc");
    expect(result.spec?.links.contextPackVersionId).toBe("cpv_abc");
    expect(result.spec?.createdBy).toBe("user_abc");
    expect(result.spec?.updatedBy).toBe("user_abc");
  });
});
