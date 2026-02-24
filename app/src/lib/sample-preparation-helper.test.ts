import { describe, expect, it } from "vitest";
import { computeSampleWeightMix } from "~/lib/sample-weight-calc";
import {
  classifyFluorescence,
  classifyTransmission,
  computeSuggestedTargetEdgeStep,
  summarizeSuitability,
} from "~/lib/sample-preparation-helper";

describe("sample preparation helper utils", () => {
  it("classifies transmission threshold at μt=4", () => {
    expect(classifyTransmission(3.99).suitable).toBe(true);
    expect(classifyTransmission(4.0).suitable).toBe(false);
    expect(classifyTransmission(4.01).suitable).toBe(false);
  });

  it("classifies fluorescence threshold at min R%=90", () => {
    expect(classifyFluorescence(89.9).suitable).toBe(false);
    expect(classifyFluorescence(90.0).suitable).toBe(true);
    expect(classifyFluorescence(90.1).suitable).toBe(true);
  });

  it("builds a combined suitability label", () => {
    expect(summarizeSuitability(true, true)).toBe(
      "Transmission suitable / Fluorescence suitable",
    );
    expect(summarizeSuitability(false, true)).toBe(
      "Transmission not suitable / Fluorescence suitable",
    );
    expect(summarizeSuitability(true, false)).toBe(
      "Transmission suitable / Fluorescence not suitable",
    );
  });

  it("solves suggested target edge-step numerically for μt=4", () => {
    const suggested = computeSuggestedTargetEdgeStep({
      sampleEdgeStep: 100,
      diluentEdgeStep: 0,
      sampleMuAbove: 120,
      diluentMuAbove: 1,
      totalMassMg: 100,
      areaCm2: 1,
      targetAbsorption: 4,
    });
    expect(suggested).not.toBeNull();
    const mix = computeSampleWeightMix({
      sampleEdgeStep: 100,
      diluentEdgeStep: 0,
      totalMassMg: 100,
      areaCm2: 1,
      targetEdgeStep: suggested ?? 0,
    });
    expect(mix).not.toBeNull();
    const sampleMassG = (mix?.sampleMassMg ?? 0) / 1000;
    const diluentMassG = (mix?.diluentMassMg ?? 0) / 1000;
    const muAbove = 120 * sampleMassG + 1 * diluentMassG;
    expect(muAbove).toBeCloseTo(4, 5);
  });

  it("returns null when no μt=4 solution exists in feasible edge-step range", () => {
    const suggested = computeSuggestedTargetEdgeStep({
      sampleEdgeStep: 50,
      diluentEdgeStep: 0,
      sampleMuAbove: 8,
      diluentMuAbove: 6,
      totalMassMg: 1000,
      areaCm2: 0.1,
      targetAbsorption: 4,
    });
    expect(suggested).toBeNull();
  });
});
