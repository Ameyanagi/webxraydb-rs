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

export function classifyTransmission(absorptionAbove: number): {
  suitable: boolean;
  label: string;
} {
  if (absorptionAbove < 4.0) {
    return { suitable: true, label: "Transmission suitable" };
  }
  return { suitable: false, label: "Transmission not suitable" };
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
