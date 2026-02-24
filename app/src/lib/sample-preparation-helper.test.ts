import { describe, expect, it } from "vitest";
import { computeSampleWeightMix } from "~/lib/sample-weight-calc";
import {
  classifyFluorescence,
  classifyTransmission,
  computeSuggestedTargetEdgeStep,
  solveDilutionForFluorescence,
  solveThicknessForFluorescence,
  summarizeSuitability,
} from "~/lib/sample-preparation-helper";

describe("sample preparation helper utils", () => {
  it("classifies transmission with edge-step and absorption limits", () => {
    expect(classifyTransmission(0.2, 4.0).suitable).toBe(true);
    expect(classifyTransmission(2.0, 4.0).suitable).toBe(true);
    expect(classifyTransmission(0.19, 3.0).suitable).toBe(false);
    expect(classifyTransmission(2.01, 3.0).suitable).toBe(false);
    expect(classifyTransmission(1.0, 4.01).suitable).toBe(false);
    expect(classifyTransmission(0.1, 5.0).suitable).toBe(false);
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

  it("solves dilution target with max-feasible search", () => {
    const result = solveDilutionForFluorescence({
      min: 0.0,
      max: 1.0,
      evaluateMinRetainedPercent: (x) => 100 - 20 * x,
      targetMinRetainedPercent: 90,
    });
    expect(result).not.toBeNull();
    expect(result?.feasible).toBe(true);
    if (result?.feasible) {
      expect(result.value).toBeCloseTo(0.5, 2);
      expect(result.minRetainedPercent).toBeGreaterThanOrEqual(89.9);
    }
  });

  it("returns infeasible for dilution when target cannot be reached", () => {
    const result = solveDilutionForFluorescence({
      min: 0.0,
      max: 1.0,
      evaluateMinRetainedPercent: () => 85,
      targetMinRetainedPercent: 90,
    });
    expect(result).not.toBeNull();
    expect(result?.feasible).toBe(false);
  });

  it("solves thickness target with max-feasible search", () => {
    const result = solveThicknessForFluorescence({
      min: 0.0,
      max: 2.0,
      evaluateMinRetainedPercent: (d) => 100 - 10 * d,
      targetMinRetainedPercent: 90,
    });
    expect(result).not.toBeNull();
    expect(result?.feasible).toBe(true);
    if (result?.feasible) {
      expect(result.value).toBeCloseTo(1.0, 2);
    }
  });

  it("returns infeasible for thickness when target cannot be reached", () => {
    const result = solveThicknessForFluorescence({
      min: 0.0,
      max: 2.0,
      evaluateMinRetainedPercent: () => 60,
      targetMinRetainedPercent: 90,
    });
    expect(result).not.toBeNull();
    expect(result?.feasible).toBe(false);
  });
});
