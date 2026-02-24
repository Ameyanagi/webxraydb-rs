import { computeSampleWeightMix } from "~/lib/sample-weight-calc";

const EPS = 1e-6;

export interface AbsorptionMetrics {
  absorptionBelow: number;
  absorptionAbove: number;
  transmissionBelow: number;
  transmissionAbove: number;
}

export interface SuggestedTargetInput {
  sampleEdgeStep: number;
  diluentEdgeStep: number;
  sampleMuAbove: number;
  diluentMuAbove: number;
  totalMassMg: number;
  areaCm2: number;
  targetAbsorption: number;
}

export interface FluorescenceSolveInputs {
  min: number;
  max: number;
  evaluateMinRetainedPercent: (value: number) => number | null;
  targetMinRetainedPercent?: number;
  targetTolerance?: number;
  valueTolerance?: number;
  maxIterations?: number;
  samplePoints?: number;
}

export type FluorescenceSolveResult =
  | {
      feasible: true;
      value: number;
      minRetainedPercent: number;
      iterations: number;
      converged: boolean;
      note?: string;
    }
  | {
      feasible: false;
      reason: string;
      bestValue: number;
      bestMinRetainedPercent: number;
    };

export function computeAbsorptionMetrics(
  sampleMuBelow: number,
  sampleMuAbove: number,
  diluentMuBelow: number,
  diluentMuAbove: number,
  sampleMassMg: number,
  diluentMassMg: number,
  areaCm2: number,
): AbsorptionMetrics | null {
  if (!(areaCm2 > 0)) return null;
  const sampleMassG = sampleMassMg / 1000;
  const diluentMassG = diluentMassMg / 1000;

  const absorptionBelow =
    sampleMuBelow * (sampleMassG / areaCm2) +
    diluentMuBelow * (diluentMassG / areaCm2);
  const absorptionAbove =
    sampleMuAbove * (sampleMassG / areaCm2) +
    diluentMuAbove * (diluentMassG / areaCm2);

  if (!Number.isFinite(absorptionBelow) || !Number.isFinite(absorptionAbove)) {
    return null;
  }

  return {
    absorptionBelow,
    absorptionAbove,
    transmissionBelow: Math.exp(-absorptionBelow),
    transmissionAbove: Math.exp(-absorptionAbove),
  };
}

export function classifyTransmission(
  achievedEdgeStep: number,
  absorptionAbove: number,
): {
  suitable: boolean;
  label: string;
} {
  const edgeStepOk = achievedEdgeStep >= 0.2 && achievedEdgeStep <= 2.0;
  const absorptionOk = absorptionAbove <= 4.0;
  if (edgeStepOk && absorptionOk) {
    return { suitable: true, label: "Transmission suitable" };
  }

  if (!edgeStepOk && !absorptionOk) {
    return {
      suitable: false,
      label: "Transmission not suitable (edge step out of 0.2-2.0, μt above 4.0)",
    };
  }
  if (!edgeStepOk) {
    return {
      suitable: false,
      label: "Transmission not suitable (edge step out of 0.2-2.0)",
    };
  }
  return {
    suitable: false,
    label: "Transmission not suitable (μt above 4.0)",
  };
}

export function classifyFluorescence(minRetainedPercent: number): {
  suitable: boolean;
  label: string;
} {
  if (minRetainedPercent >= 90.0) {
    return { suitable: true, label: "Fluorescence suitable" };
  }
  return { suitable: false, label: "Moderate self-absorption" };
}

export function summarizeSuitability(
  transmissionSuitable: boolean,
  fluorescenceSuitable: boolean,
): string {
  const transmission = transmissionSuitable
    ? "Transmission suitable"
    : "Transmission not suitable";
  const fluorescence = fluorescenceSuitable
    ? "Fluorescence suitable"
    : "Fluorescence not suitable";
  return `${transmission} / ${fluorescence}`;
}

function evaluateAbsorptionAtTarget(
  targetEdgeStep: number,
  input: SuggestedTargetInput,
): number | null {
  const mix = computeSampleWeightMix({
    sampleEdgeStep: input.sampleEdgeStep,
    diluentEdgeStep: input.diluentEdgeStep,
    totalMassMg: input.totalMassMg,
    areaCm2: input.areaCm2,
    targetEdgeStep,
  });
  if (!mix) return null;
  if (mix.sampleMassMg < -EPS || mix.diluentMassMg < -EPS) return null;
  const sampleMassG = Math.max(0, mix.sampleMassMg) / 1000;
  const diluentMassG = Math.max(0, mix.diluentMassMg) / 1000;
  const absorption =
    input.sampleMuAbove * (sampleMassG / input.areaCm2) +
    input.diluentMuAbove * (diluentMassG / input.areaCm2);
  return Number.isFinite(absorption) ? absorption : null;
}

export function computeSuggestedTargetEdgeStep(
  input: SuggestedTargetInput,
): number | null {
  if (
    !(input.totalMassMg > 0) ||
    !(input.areaCm2 > 0) ||
    !Number.isFinite(input.sampleEdgeStep) ||
    !Number.isFinite(input.diluentEdgeStep) ||
    !Number.isFinite(input.sampleMuAbove) ||
    !Number.isFinite(input.diluentMuAbove) ||
    !Number.isFinite(input.targetAbsorption) ||
    !(input.targetAbsorption > 0)
  ) {
    return null;
  }

  const totalMassG = input.totalMassMg / 1000;
  const loading = totalMassG / input.areaCm2;
  if (!(loading > 0)) return null;

  const minEdgeStep = Math.min(input.sampleEdgeStep, input.diluentEdgeStep) * loading;
  const maxEdgeStep = Math.max(input.sampleEdgeStep, input.diluentEdgeStep) * loading;
  if (Math.abs(maxEdgeStep - minEdgeStep) < EPS) return null;

  const edgeEps = Math.max(
    1e-9,
    1e-6 * Math.max(1, Math.abs(minEdgeStep), Math.abs(maxEdgeStep)),
  );
  let left = Math.max(minEdgeStep, edgeEps);
  let right = maxEdgeStep;
  if (!(right > left)) return null;
  let fLeft = evaluateAbsorptionAtTarget(left, input);
  let fRight = evaluateAbsorptionAtTarget(right, input);
  if (fLeft == null || fRight == null) return null;
  fLeft -= input.targetAbsorption;
  fRight -= input.targetAbsorption;

  if (Math.abs(fLeft) < 1e-9) return left;
  if (Math.abs(fRight) < 1e-9) return right;

  if (fLeft * fRight > 0) {
    return null;
  }

  for (let i = 0; i < 80; i++) {
    const mid = 0.5 * (left + right);
    const midAbsorption = evaluateAbsorptionAtTarget(mid, input);
    if (midAbsorption == null) return null;
    const fMid = midAbsorption - input.targetAbsorption;
    if (Math.abs(fMid) < 1e-9 || Math.abs(right - left) < 1e-9) {
      return mid;
    }
    if (fLeft * fMid <= 0) {
      right = mid;
      fRight = fMid;
    } else {
      left = mid;
      fLeft = fMid;
    }
  }

  const suggested = 0.5 * (left + right);
  return Number.isFinite(suggested) ? suggested : null;
}

function safeEvaluate(
  evaluate: (value: number) => number | null,
  value: number,
): number | null {
  try {
    const result = evaluate(value);
    if (result == null || !Number.isFinite(result)) return null;
    return result;
  } catch {
    return null;
  }
}

function solveMaxFeasibleForFluorescence(
  input: FluorescenceSolveInputs,
): FluorescenceSolveResult | null {
  if (
    !Number.isFinite(input.min) ||
    !Number.isFinite(input.max) ||
    !(input.max > input.min)
  ) {
    return null;
  }

  const target = input.targetMinRetainedPercent ?? 90.0;
  const targetTolerance = input.targetTolerance ?? 0.1;
  const valueTolerance = input.valueTolerance ?? 1e-6;
  const maxIterations = input.maxIterations ?? 80;
  const samplePoints = Math.max(8, input.samplePoints ?? 64);
  if (
    !Number.isFinite(target) ||
    !Number.isFinite(targetTolerance) ||
    !Number.isFinite(valueTolerance) ||
    !(targetTolerance > 0) ||
    !(valueTolerance > 0) ||
    !(maxIterations > 0) ||
    !(samplePoints > 1)
  ) {
    return null;
  }

  let bestX = Number.NEGATIVE_INFINITY;
  let bestY = Number.NEGATIVE_INFINITY;
  let firstFailAboveBestX: number | null = null;

  for (let i = 0; i < samplePoints; i++) {
    const t = i / (samplePoints - 1);
    const x = input.min + (input.max - input.min) * t;
    const y = safeEvaluate(input.evaluateMinRetainedPercent, x);
    if (y == null) continue;
    if (y >= target && x > bestX) {
      bestX = x;
      bestY = y;
      firstFailAboveBestX = null;
      continue;
    }
    if (Number.isFinite(bestX) && x > bestX && y < target && firstFailAboveBestX == null) {
      firstFailAboveBestX = x;
    }
  }

  if (!Number.isFinite(bestX)) {
    return {
      feasible: false,
      reason: `No value in [${input.min.toExponential(3)}, ${input.max.toExponential(3)}] achieves min R >= ${target.toFixed(1)}%`,
      bestValue: input.min,
      bestMinRetainedPercent: Number.isFinite(bestY) ? bestY : Number.NEGATIVE_INFINITY,
    };
  }

  if (Math.abs(bestX - input.max) <= valueTolerance || firstFailAboveBestX == null) {
    return {
      feasible: true,
      value: bestX,
      minRetainedPercent: bestY,
      iterations: 0,
      converged: true,
      note: bestX >= input.max - valueTolerance
        ? "Feasible at upper search bound"
        : "No failing point found above sampled feasible values",
    };
  }

  let low = bestX;
  let high = firstFailAboveBestX;
  let yLow = safeEvaluate(input.evaluateMinRetainedPercent, low);
  let yHigh = safeEvaluate(input.evaluateMinRetainedPercent, high);
  if (yLow == null || yHigh == null) {
    return {
      feasible: true,
      value: bestX,
      minRetainedPercent: bestY,
      iterations: 0,
      converged: false,
      note: "Fell back to sampled feasible point due to unstable evaluation",
    };
  }

  if (yLow < target || yHigh >= target) {
    return {
      feasible: true,
      value: bestX,
      minRetainedPercent: bestY,
      iterations: 0,
      converged: false,
      note: "Fell back to sampled feasible point due to non-bracketed evaluations",
    };
  }

  let iterations = 0;
  while (iterations < maxIterations && Math.abs(high - low) > valueTolerance) {
    iterations += 1;
    const mid = 0.5 * (low + high);
    const yMid = safeEvaluate(input.evaluateMinRetainedPercent, mid);
    if (yMid == null) {
      high = mid;
      continue;
    }
    if (yMid >= target) {
      low = mid;
      yLow = yMid;
    } else {
      high = mid;
      yHigh = yMid;
    }
    if (Math.abs(yMid - target) <= targetTolerance) break;
  }

  return {
    feasible: true,
    value: low,
    minRetainedPercent: yLow,
    iterations,
    converged: Math.abs(high - low) <= valueTolerance || Math.abs(yLow - target) <= targetTolerance,
    note: yHigh < target ? undefined : "Final bracket did not strictly close below target",
  };
}

export function solveDilutionForFluorescence(
  input: FluorescenceSolveInputs,
): FluorescenceSolveResult | null {
  return solveMaxFeasibleForFluorescence(input);
}

export function solveThicknessForFluorescence(
  input: FluorescenceSolveInputs,
): FluorescenceSolveResult | null {
  return solveMaxFeasibleForFluorescence(input);
}
