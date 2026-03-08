// Unit tests for the AI structurer fallback (no API key required).

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildSectionsFromRawText,
  structureContextInput,
} from "./ai-structurer.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("buildSectionsFromRawText", () => {
  it("extracts product vision from first line", () => {
    const result = buildSectionsFromRawText(
      "PROZEN is a PM OS for solo founders.\nTargets non-engineers.\nGoal is to ship faster.",
    );
    expect(result.sections.productVision[0]?.statement).toBe(
      "PROZEN is a PM OS for solo founders.",
    );
  });

  it("extracts target users from second line", () => {
    const result = buildSectionsFromRawText(
      "Vision line.\nNon-engineer solopreneurs.\nGoal line.",
    );
    expect(result.sections.targetUsers[0]?.statement).toBe(
      "Non-engineer solopreneurs.",
    );
  });

  it("returns non-empty summary", () => {
    const result = buildSectionsFromRawText("Short context.");
    expect(result.summary.length).toBeGreaterThan(0);
  });

  it("truncates long summaries at 300 chars", () => {
    const longInput = "word ".repeat(200);
    const result = buildSectionsFromRawText(longInput);
    expect(result.summary.length).toBeLessThanOrEqual(300);
  });

  it("always includes an open question", () => {
    const result = buildSectionsFromRawText("Any input.");
    expect(result.sections.openQuestions.length).toBeGreaterThan(0);
  });

  it("uses fallback structuring when API key is missing", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const result = await structureContextInput(
      "Vision line.\nTarget users line.\nGoals line.",
    );
    expect(result.sections.productVision[0]?.statement).toBe("Vision line.");
    expect(result.sections.targetUsers[0]?.statement).toBe("Target users line.");
  });

  it("returns a default summary when input is blank", () => {
    const result = buildSectionsFromRawText("   ");
    expect(result.summary).toBe("No context provided.");
  });
});
