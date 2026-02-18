export interface SampleWeightInputs {
  sampleEdgeStep: number;
  diluentEdgeStep: number;
  totalMassMg: number;
  areaCm2: number;
  targetEdgeStep: number;
}

export interface SampleWeightOutputs {
  sampleMassMg: number;
  diluentMassMg: number;
  sampleFractionPct: number;
  achievedEdgeStep: number;
}

export function computeSampleWeightMix(
  input: SampleWeightInputs,
): SampleWeightOutputs | null {
  const { sampleEdgeStep, diluentEdgeStep, totalMassMg, areaCm2, targetEdgeStep } = input;

  if (!(totalMassMg > 0) || !(areaCm2 > 0) || !(targetEdgeStep > 0)) return null;
  const denominator = sampleEdgeStep - diluentEdgeStep;
  if (Math.abs(denominator) < 1e-12) return null;

  const totalMassG = totalMassMg / 1000;
  const sampleMassG = (targetEdgeStep * areaCm2 - diluentEdgeStep * totalMassG) / denominator;
  const diluentMassG = totalMassG - sampleMassG;

  const achievedEdgeStep =
    sampleEdgeStep * (sampleMassG / areaCm2) +
    diluentEdgeStep * (diluentMassG / areaCm2);

  return {
    sampleMassMg: sampleMassG * 1000,
    diluentMassMg: diluentMassG * 1000,
    sampleFractionPct: (sampleMassG / totalMassG) * 100,
    achievedEdgeStep,
  };
}
