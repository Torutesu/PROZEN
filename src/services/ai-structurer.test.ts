// Unit tests for the AI structurer fallback (no API key required).

import { describe, it, expect } from "vitest";
import { buildSectionsFromRawText } from "./ai-structurer.js";

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
});
