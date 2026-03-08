import { describe, it, expect } from "vitest";
import { detectAnomaly } from "./anomaly-detector.js";

describe("detectAnomaly", () => {
  it("returns no anomaly when deviation < 15%", () => {
    const result = detectAnomaly(105, 100, "increase");
    expect(result.isAnomaly).toBe(false);
  });

  it("detects low severity below-target for increase metric", () => {
    const result = detectAnomaly(82, 100, "increase");
    expect(result.isAnomaly).toBe(true);
    expect(result.severity).toBe("low");
    expect(result.direction).toBe("below_target");
    expect(result.deviationPct).toBe(-18);
  });

  it("detects medium severity", () => {
    const result = detectAnomaly(65, 100, "increase");
    expect(result.isAnomaly).toBe(true);
    expect(result.severity).toBe("medium");
  });

  it("detects high severity", () => {
    const result = detectAnomaly(45, 100, "increase");
    expect(result.isAnomaly).toBe(true);
    expect(result.severity).toBe("high");
  });

  it("detects above-target anomaly for decrease metric", () => {
    // decrease metric: going UP is bad
    const result = detectAnomaly(130, 100, "decrease");
    expect(result.isAnomaly).toBe(true);
    expect(result.direction).toBe("above_target");
  });

  it("returns no anomaly when baseline is null", () => {
    const result = detectAnomaly(50, null, "increase");
    expect(result.isAnomaly).toBe(false);
  });

  it("returns no anomaly when baseline is 0", () => {
    const result = detectAnomaly(50, 0, "increase");
    expect(result.isAnomaly).toBe(false);
  });

  it("detects no anomaly when decrease metric stays low", () => {
    // decrease metric: going down is good
    const result = detectAnomaly(80, 100, "decrease");
    expect(result.isAnomaly).toBe(false);
  });
});
