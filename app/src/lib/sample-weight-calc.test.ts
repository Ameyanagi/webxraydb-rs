import { describe, expect, it } from "vitest";
import { computeSampleWeightMix } from "~/lib/sample-weight-calc";

describe("sample weight calculation", () => {
  it("computes sample and diluent masses for target edge step", () => {
    const result = computeSampleWeightMix({
      sampleEdgeStep: 120,
      diluentEdgeStep: 10,
      totalMassMg: 150,
      areaCm2: 1.0,
      targetEdgeStep: 2.0,
    });
    expect(result).not.toBeNull();
    expect(result?.sampleMassMg).toBeGreaterThan(0);
    expect(result?.diluentMassMg).toBeGreaterThan(0);
    expect((result?.sampleMassMg ?? 0) + (result?.diluentMassMg ?? 0)).toBeCloseTo(150, 5);
  });

  it("returns null for degenerate edge steps", () => {
    const result = computeSampleWeightMix({
      sampleEdgeStep: 10,
      diluentEdgeStep: 10,
      totalMassMg: 150,
      areaCm2: 1.0,
      targetEdgeStep: 1.0,
    });
    expect(result).toBeNull();
  });
});
