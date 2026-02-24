import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ScientificPlot, type PlotTrace } from "~/components/plot/ScientificPlot";
import { FormulaInput } from "~/components/formula-input/FormulaInput";
import { EnergyRangeInput } from "~/components/energy-range/EnergyRangeInput";
import { ErrorBanner } from "~/components/ui/ErrorBanner";
import { LoadingState } from "~/components/ui/LoadingState";
import { PageHeader } from "~/components/ui/PageHeader";
import { useWasm } from "~/hooks/useWasm";
import { energyRange } from "~/lib/constants";
import { validateRange } from "~/lib/inputs";
import { computeSampleWeightMix } from "~/lib/sample-weight-calc";
import {
  classifyFluorescence,
  classifyTransmission,
  computeAbsorptionMetrics,
  computeSuggestedTargetEdgeStep,
  solveDilutionForFluorescence,
  solveThicknessForFluorescence,
  summarizeSuitability,
} from "~/lib/sample-preparation-helper";
import { errorState, readyState, type CalculationState } from "~/lib/ui-state";
import {
  mu_elam,
  molar_mass,
  parse_formula,
  sa_ameyanagi,
  validate_formula,
  xray_edge_energy,
  xray_edges,
} from "~/lib/wasm-api";

export const Route = createFileRoute("/sample-preparation-helper")({
  component: SamplePreparationHelperPage,
});

type CaseId =
  | "pure"
  | "target"
  | "suggested"
  | "fluo-dilution"
  | "fluo-thickness";

interface CaseResult {
  id: CaseId;
  title: string;
  targetEdgeStep: number;
  achievedEdgeStep: number;
  sampleMassMg: number;
  diluentMassMg: number;
  sampleFractionPct: number;
  absorptionBelow: number;
  absorptionAbove: number;
  transmissionBelow: number;
  transmissionAbove: number;
  transmissionSuitable: boolean;
  transmissionLabel: string;
  fluorescenceMinPercent: number;
  fluorescenceMeanPercent: number;
  fluorescenceSuitable: boolean;
  fluorescenceLabel: string;
  combinedLabel: string;
  thicknessCm: number;
  densityGcm3: number;
  mixtureFormula: string;
  rPercent: number[];
  solvedThicknessCm?: number;
  equivalentMassMg?: number;
  solverNote?: string;
}

interface HelperCalculation {
  edgeEnergy: number;
  energies: number[];
  sampleMuCurve: number[];
  diluentMuCurve: number[];
  effectiveAreaCm2: number;
  cases: CaseResult[];
  warnings: string[];
}

const EDGE_OPTIONS = ["K", "L1", "L2", "L3", "M1", "M2", "M3", "M4", "M5"];

const DILUENT_PRESETS = [
  { label: "BN", formula: "BN", density: 2.1 },
  { label: "Cellulose", formula: "C6H10O5", density: 1.5 },
  { label: "SiO2", formula: "SiO2", density: 2.2 },
  { label: "Al2O3", formula: "Al2O3", density: 3.95 },
  { label: "PE", formula: "C2H4", density: 0.93 },
];

/** ETOK constant for energy-to-k conversion: k = sqrt(ETOK * (E - E0)). */
const ETOK = 0.2624682917;

/** Convert k (Å⁻¹) to energy offset above edge (eV). E - E0 = k² / ETOK */
function kToEnergyOffset(k: number): number {
  return (k * k) / ETOK;
}

function formatStoich(count: number): string {
  if (Math.abs(count - 1.0) < 1e-9) return "";
  const fixed = count >= 1 ? count.toFixed(6) : count.toFixed(8);
  return fixed.replace(/\.?0+$/, "");
}

function computeEnergyRange(
  element: string,
  edgeLabel: string,
  kMax: number = 15,
): [number, number] | null {
  try {
    const edgeE = xray_edge_energy(element, edgeLabel);
    const start = Math.max(Math.round(edgeE - 200), 100);
    const endFromK = Math.round(edgeE + kToEnergyOffset(kMax));
    const edges = (xray_edges(element) ?? []) as { label: string; energy: number }[];
    const nextHigher = edges
      .filter((e) => e.label !== edgeLabel && e.energy > edgeE + 50)
      .sort((a, b) => a.energy - b.energy)[0];
    const end = nextHigher ? Math.min(endFromK, Math.round(nextHigher.energy - 50)) : endFromK;
    if (end <= start) return [start, start + 200];
    return [start, end];
  } catch {
    return null;
  }
}

function buildMixedFormula(
  sampleFormula: string,
  diluentFormula: string,
  sampleMassMg: number,
  diluentMassMg: number,
): string {
  if (diluentMassMg <= 1e-10) return sampleFormula.trim();
  if (sampleMassMg <= 1e-10) return diluentFormula.trim();

  const composition = new Map<string, number>();

  const appendFormula = (formula: string, massMg: number) => {
    if (massMg <= 1e-10) return;
    const parsed = parse_formula(formula);
    const components = parsed.components as { symbol: string; count: number }[];
    if (components.length === 0) {
      throw new Error(`No components parsed for ${formula}`);
    }
    let formulaMass = 0;
    for (const c of components) {
      formulaMass += molar_mass(c.symbol) * c.count;
    }
    if (!(formulaMass > 0)) {
      throw new Error(`Could not determine molar mass for ${formula}`);
    }
    const molesOfFormulaUnits = (massMg / 1000) / formulaMass;
    for (const c of components) {
      const prev = composition.get(c.symbol) ?? 0;
      composition.set(c.symbol, prev + c.count * molesOfFormulaUnits);
    }
  };

  appendFormula(sampleFormula, sampleMassMg);
  appendFormula(diluentFormula, diluentMassMg);

  const entries = Array.from(composition.entries())
    .filter(([, count]) => count > 1e-12)
    .sort((a, b) => a[0].localeCompare(b[0]));
  if (entries.length === 0) throw new Error("Mixed composition is empty");

  const formula = entries.map(([sym, count]) => `${sym}${formatStoich(count)}`).join("");
  if (!validate_formula(formula)) {
    throw new Error("Could not construct a valid mixed formula for self-absorption");
  }
  return formula;
}

function toDegreesLabel(phiDeg: number, thetaDeg: number): string {
  return `φ=${phiDeg.toFixed(1)}°, θ=${thetaDeg.toFixed(1)}°`;
}

function SamplePreparationHelperPage() {
  const ready = useWasm();

  const [sampleFormula, setSampleFormula] = useState("Fe2O3");
  const [atom, setAtom] = useState("Fe");
  const [edge, setEdge] = useState("K");
  const [diluentFormula, setDiluentFormula] = useState("BN");
  const [sampleDensityGcm3, setSampleDensityGcm3] = useState(5.24);
  const [diluentDensityGcm3, setDiluentDensityGcm3] = useState(2.1);
  const [totalMassMg, setTotalMassMg] = useState(150);
  const [diameterMm, setDiameterMm] = useState(13);
  const [beamAngleDeg, setBeamAngleDeg] = useState(45);
  const [useAdvancedAngles, setUseAdvancedAngles] = useState(false);
  const [phiDeg, setPhiDeg] = useState(45);
  const [thetaDeg, setThetaDeg] = useState(45);
  const [targetEdgeStep, setTargetEdgeStep] = useState(1.0);
  const [chiAssumed, setChiAssumed] = useState(0.1);
  const [eStart, setEStart] = useState(7000);
  const [eEnd, setEEnd] = useState(8000);
  const [eStep, setEStep] = useState(2);
  const [selectedCaseId, setSelectedCaseId] = useState<CaseId | null>(null);

  const activePhiDeg = useAdvancedAngles ? phiDeg : beamAngleDeg;
  const activeThetaDeg = useAdvancedAngles ? thetaDeg : beamAngleDeg;

  const edgeEnergy = useMemo(() => {
    if (!ready || !atom || !edge) return null;
    try {
      return xray_edge_energy(atom, edge);
    } catch {
      return null;
    }
  }, [ready, atom, edge]);

  const sampleAtoms = useMemo(() => {
    if (!ready) return [];
    try {
      const parsed = parse_formula(sampleFormula);
      const components = parsed.components as { symbol: string; count: number }[];
      return Array.from(new Set(components.map((c) => c.symbol)));
    } catch {
      return [];
    }
  }, [ready, sampleFormula]);

  const availableEdges = useMemo(() => {
    if (!ready || !atom.trim()) return EDGE_OPTIONS;
    return EDGE_OPTIONS.filter((candidate) => {
      try {
        xray_edge_energy(atom, candidate);
        return true;
      } catch {
        return false;
      }
    });
  }, [ready, atom]);

  useEffect(() => {
    if (!ready || sampleAtoms.length === 0) return;
    if (!sampleAtoms.includes(atom)) {
      setAtom(sampleAtoms[0]);
    }
  }, [ready, sampleAtoms, atom]);

  useEffect(() => {
    if (!ready) return;
    if (availableEdges.length === 0) return;
    if (!availableEdges.includes(edge)) {
      if (availableEdges.includes("K")) {
        setEdge("K");
      } else {
        setEdge(availableEdges[0]);
      }
    }
  }, [ready, availableEdges, edge]);

  useEffect(() => {
    if (!ready || !atom.trim() || !edge.trim()) return;
    const range = computeEnergyRange(atom, edge);
    if (!range) return;
    setEStart(range[0]);
    setEEnd(range[1]);
    setEStep(2);
  }, [ready, atom, edge]);

  const handleSampleChange = useCallback((formula: string) => {
    setSampleFormula(formula);
  }, []);

  const applyDiluentPreset = useCallback((formula: string, density: number) => {
    setDiluentFormula(formula);
    setDiluentDensityGcm3(density);
  }, []);

  const setBeamAngle = useCallback((angle: number) => {
    setBeamAngleDeg(angle);
    setPhiDeg(angle);
    setThetaDeg(angle);
  }, []);

  const massMu = useCallback(
    (formula: string, energies: Float64Array): Float64Array | null => {
      try {
        const parsed = parse_formula(formula);
        const components = parsed.components as { symbol: string; count: number }[];
        if (components.length === 0) return null;

        const stoich = new Map<string, number>();
        for (const c of components) {
          stoich.set(c.symbol, (stoich.get(c.symbol) ?? 0) + c.count);
        }

        let formulaMass = 0;
        for (const [symbol, count] of stoich.entries()) {
          formulaMass += molar_mass(symbol) * count;
        }
        if (!(formulaMass > 0) || !Number.isFinite(formulaMass)) return null;

        const result = new Float64Array(energies.length);
        for (const [symbol, count] of stoich.entries()) {
          const massFraction = (molar_mass(symbol) * count) / formulaMass;
          const mu = mu_elam(symbol, energies, "total");
          for (let i = 0; i < energies.length; i++) {
            result[i] += massFraction * mu[i];
          }
        }
        return result;
      } catch {
        return null;
      }
    },
    [],
  );

  const calcState = useMemo<CalculationState<HelperCalculation>>(() => {
    if (!ready) return { status: "idle", data: null, error: null };
    if (!sampleFormula.trim()) return errorState("Enter a sample formula");
    if (!diluentFormula.trim()) return errorState("Enter a diluent formula");
    if (!atom.trim()) return errorState("Select an absorbing atom");
    if (!sampleAtoms.includes(atom.trim())) {
      return errorState("Absorbing atom must be contained in the sample formula");
    }
    if (!edge.trim()) return errorState("Select an absorption edge");
    if (!Number.isFinite(targetEdgeStep) || targetEdgeStep <= 0) {
      return errorState("Target edge step must be > 0");
    }
    if (!Number.isFinite(chiAssumed) || chiAssumed <= 0) {
      return errorState("Assumed χ must be finite and > 0");
    }
    if (!(sampleDensityGcm3 > 0) || !(diluentDensityGcm3 > 0)) {
      return errorState("Sample and diluent densities must be > 0");
    }
    if (!(totalMassMg > 0) || !(diameterMm > 0)) {
      return errorState("Total pellet mass and pellet diameter must be > 0");
    }
    if (!(activePhiDeg > 0 && activePhiDeg <= 90)) {
      return errorState("Incident angle φ must be in (0, 90] degrees");
    }
    if (!(activeThetaDeg > 0 && activeThetaDeg <= 90)) {
      return errorState("Exit angle θ must be in (0, 90] degrees");
    }
    const range = validateRange(eStart, eEnd, eStep, 30000);
    if (!range.valid) return errorState(range.error ?? "Invalid energy range");

    const edgeE = edgeEnergy;
    if (!edgeE) return errorState("Could not determine edge energy");

    try {
      const phiRad = (activePhiDeg * Math.PI) / 180;
      const thetaRad = (activeThetaDeg * Math.PI) / 180;

      const diameterCm = diameterMm / 10;
      const pelletAreaCm2 = (Math.PI * diameterCm * diameterCm) / 4;
      const effectiveAreaCm2 = pelletAreaCm2 * Math.cos(phiRad);
      if (!(pelletAreaCm2 > 0) || !(effectiveAreaCm2 > 0)) {
        return errorState("Invalid pellet area/beam geometry");
      }

      const eBelowArr = new Float64Array([edgeE - 10]);
      const eAboveArr = new Float64Array([edgeE + 10]);
      const sampleMuBelowArr = massMu(sampleFormula, eBelowArr);
      const sampleMuAboveArr = massMu(sampleFormula, eAboveArr);
      const diluentMuBelowArr = massMu(diluentFormula, eBelowArr);
      const diluentMuAboveArr = massMu(diluentFormula, eAboveArr);
      if (!sampleMuBelowArr || !sampleMuAboveArr || !diluentMuBelowArr || !diluentMuAboveArr) {
        return errorState("Could not compute attenuation for sample/diluent");
      }

      const sampleMuBelow = sampleMuBelowArr[0];
      const sampleMuAbove = sampleMuAboveArr[0];
      const diluentMuBelow = diluentMuBelowArr[0];
      const diluentMuAbove = diluentMuAboveArr[0];
      const sampleEdgeStep = sampleMuAbove - sampleMuBelow;
      const diluentEdgeStep = diluentMuAbove - diluentMuBelow;
      if (Math.abs(sampleEdgeStep - diluentEdgeStep) < 1e-12) {
        return errorState("Sample and diluent edge steps are too similar");
      }

      const totalMassG = totalMassMg / 1000;
      const loadingGcm2 = totalMassG / effectiveAreaCm2;
      const minReachableEdgeStep = Math.min(sampleEdgeStep, diluentEdgeStep) * loadingGcm2;
      const maxReachableEdgeStep = Math.max(sampleEdgeStep, diluentEdgeStep) * loadingGcm2;

      const energyGrid = energyRange(eStart, eEnd, eStep);
      const energies = Array.from(energyGrid);
      const sampleMuCurveArr = massMu(sampleFormula, energyGrid);
      const diluentMuCurveArr = massMu(diluentFormula, energyGrid);
      if (!sampleMuCurveArr || !diluentMuCurveArr) {
        return errorState("Could not compute attenuation curves");
      }
      const sampleMuCurve = Array.from(sampleMuCurveArr);
      const diluentMuCurve = Array.from(diluentMuCurveArr);

      const warnings: string[] = [];
      const cases: CaseResult[] = [];

      const buildCase = (
        id: CaseId,
        title: string,
        targetStep: number,
        sampleMassMg: number,
        diluentMassMg: number,
        overrides?: {
          solvedThicknessCm?: number;
          equivalentMassMg?: number;
          solverNote?: string;
        },
      ): CaseResult | null => {
        if (sampleMassMg < -1e-6 || diluentMassMg < -1e-6) {
          return null;
        }
        const clampedSampleMg = Math.max(0, sampleMassMg);
        const clampedDiluentMg = Math.max(0, diluentMassMg);
        const sampleMassG = clampedSampleMg / 1000;
        const diluentMassG = clampedDiluentMg / 1000;
        const totalMassG = sampleMassG + diluentMassG;
        if (!(totalMassG > 0)) return null;

        const absorption = computeAbsorptionMetrics(
          sampleMuBelow,
          sampleMuAbove,
          diluentMuBelow,
          diluentMuAbove,
          clampedSampleMg,
          clampedDiluentMg,
          effectiveAreaCm2,
        );
        if (!absorption) return null;

        const achievedEdgeStep =
          sampleEdgeStep * (sampleMassG / effectiveAreaCm2) +
          diluentEdgeStep * (diluentMassG / effectiveAreaCm2);

        const sampleFractionPct = (sampleMassG / totalMassG) * 100;
        const transmission = classifyTransmission(
          achievedEdgeStep,
          absorption.absorptionAbove,
        );

        const mixFormula = buildMixedFormula(
          sampleFormula,
          diluentFormula,
          clampedSampleMg,
          clampedDiluentMg,
        );
        const volumeCm3 =
          sampleMassG / sampleDensityGcm3 + diluentMassG / diluentDensityGcm3;
        if (!(volumeCm3 > 0)) return null;
        const mixDensity = totalMassG / volumeCm3;
        const thicknessCm = volumeCm3 / pelletAreaCm2;
        if (!(mixDensity > 0) || !(thicknessCm > 0)) return null;

        const sa = sa_ameyanagi(
          mixFormula,
          atom,
          edge,
          energyGrid,
          mixDensity,
          phiRad,
          thetaRad,
          thicknessCm,
          undefined,
          undefined,
          chiAssumed,
        );
        const rPercent = (sa.suppression_factor as number[]).map((v) => v * 100);
        const fluorescenceMinPercent = sa.r_min * 100;
        const fluorescenceMeanPercent = sa.r_mean * 100;
        const fluorescence = classifyFluorescence(fluorescenceMinPercent);

        return {
          id,
          title,
          targetEdgeStep: targetStep,
          achievedEdgeStep,
          sampleMassMg: clampedSampleMg,
          diluentMassMg: clampedDiluentMg,
          sampleFractionPct,
          absorptionBelow: absorption.absorptionBelow,
          absorptionAbove: absorption.absorptionAbove,
          transmissionBelow: absorption.transmissionBelow,
          transmissionAbove: absorption.transmissionAbove,
          transmissionSuitable: transmission.suitable,
          transmissionLabel: transmission.label,
          fluorescenceMinPercent,
          fluorescenceMeanPercent,
          fluorescenceSuitable: fluorescence.suitable,
          fluorescenceLabel: fluorescence.label,
          combinedLabel: summarizeSuitability(
            transmission.suitable,
            fluorescence.suitable,
          ),
          thicknessCm,
          densityGcm3: mixDensity,
          mixtureFormula: mixFormula,
          rPercent,
          solvedThicknessCm: overrides?.solvedThicknessCm,
          equivalentMassMg: overrides?.equivalentMassMg,
          solverNote: overrides?.solverNote,
        };
      };

      const pureCase = buildCase("pure", "Pure pellet", targetEdgeStep, totalMassMg, 0);
      if (!pureCase) return errorState("Could not evaluate the pure pellet case");
      cases.push(pureCase);

      const targetMix = computeSampleWeightMix({
        sampleEdgeStep,
        diluentEdgeStep,
        totalMassMg,
        areaCm2: effectiveAreaCm2,
        targetEdgeStep,
      });
      if (!targetMix) {
        return errorState("Could not compute dilution for the selected target edge step");
      }
      const targetMixFeasible =
        targetMix.sampleMassMg >= -1e-6 && targetMix.diluentMassMg >= -1e-6;
      let targetCase: CaseResult | null = null;
      if (targetMixFeasible) {
        targetCase = buildCase(
          "target",
          "Diluted for target",
          targetEdgeStep,
          targetMix.sampleMassMg,
          targetMix.diluentMassMg,
        );
        if (targetCase) {
          cases.push(targetCase);
        } else {
          warnings.push("Could not build the target dilution case from the computed composition.");
        }
      } else {
        const minDisplay = Math.max(0, minReachableEdgeStep);
        const maxDisplay = Math.max(0, maxReachableEdgeStep);
        warnings.push(
          `Target edge step ${targetEdgeStep.toFixed(3)} is not reachable with non-negative masses for this pellet. Reachable range is approximately ${minDisplay.toFixed(3)} to ${maxDisplay.toFixed(3)}.`,
        );
      }

      if (targetCase && !targetCase.transmissionSuitable) {
        const suggestedTarget = computeSuggestedTargetEdgeStep({
          sampleEdgeStep,
          diluentEdgeStep,
          sampleMuAbove,
          diluentMuAbove,
          totalMassMg,
          areaCm2: effectiveAreaCm2,
          targetAbsorption: 4.0,
        });

        if (suggestedTarget != null) {
          const suggestedMix = computeSampleWeightMix({
            sampleEdgeStep,
            diluentEdgeStep,
            totalMassMg,
            areaCm2: effectiveAreaCm2,
            targetEdgeStep: suggestedTarget,
          });
          if (suggestedMix) {
            const suggestedCase = buildCase(
              "suggested",
              "Diluted for μt=4",
              suggestedTarget,
              suggestedMix.sampleMassMg,
              suggestedMix.diluentMassMg,
            );
            if (suggestedCase) {
              cases.push(suggestedCase);
            } else {
              warnings.push("Suggested μt=4 dilution was not physically valid.");
            }
          } else {
            warnings.push("Could not compute mass split for suggested μt=4 target.");
          }
        } else {
          warnings.push(
            "No feasible diluted composition reaches μt=4 with current mass, diameter, and formulas.",
          );
        }
      }

      const fluorescenceTargetPercent = 90.0;
      const minSampleFraction = 1e-4;

      const evaluateMinRBySampleFraction = (sampleFraction: number): number | null => {
        const f = Math.min(1.0, Math.max(minSampleFraction, sampleFraction));
        const sampleMass = totalMassMg * f;
        const diluentMass = totalMassMg - sampleMass;
        const probeCase = buildCase(
          "fluo-dilution",
          "probe",
          targetEdgeStep,
          sampleMass,
          diluentMass,
        );
        return probeCase?.fluorescenceMinPercent ?? null;
      };

      const dilutionSolve = solveDilutionForFluorescence({
        min: minSampleFraction,
        max: 1.0,
        evaluateMinRetainedPercent: evaluateMinRBySampleFraction,
        targetMinRetainedPercent: fluorescenceTargetPercent,
        targetTolerance: 0.1,
        valueTolerance: 1e-5,
        maxIterations: 80,
        samplePoints: 96,
      });

      if (!dilutionSolve) {
        warnings.push("Fluorescence dilution solver failed to initialize.");
      }

      if (dilutionSolve?.feasible) {
        const sampleMassMg = totalMassMg * dilutionSolve.value;
        const diluentMassMg = totalMassMg - sampleMassMg;
        const fluoCase = buildCase(
          "fluo-dilution",
          "Diluted for fluorescence (R>=90%)",
          targetEdgeStep,
          sampleMassMg,
          diluentMassMg,
          { solverNote: dilutionSolve.note },
        );
        if (fluoCase) {
          cases.push(fluoCase);
        } else {
          warnings.push("Could not build fluorescence dilution case from solved ratio.");
        }
      } else if (dilutionSolve) {
        const sampleMassMg = totalMassMg * dilutionSolve.bestValue;
        const diluentMassMg = totalMassMg - sampleMassMg;
        const fluoCase = buildCase(
          "fluo-dilution",
          "Diluted for fluorescence (best effort)",
          targetEdgeStep,
          sampleMassMg,
          diluentMassMg,
          { solverNote: dilutionSolve.reason },
        );
        if (fluoCase) {
          cases.push(fluoCase);
        }
        warnings.push(dilutionSolve.reason);
      }

      const evaluateMinRByThickness = (thicknessCm: number): number | null => {
        if (!(thicknessCm > 0) || !Number.isFinite(thicknessCm)) return null;
        const totalMassG = sampleDensityGcm3 * pelletAreaCm2 * thicknessCm;
        if (!(totalMassG > 0) || !Number.isFinite(totalMassG)) return null;
        const sampleMassMg = totalMassG * 1000;
        const probeCase = buildCase(
          "fluo-thickness",
          "probe",
          targetEdgeStep,
          sampleMassMg,
          0,
        );
        return probeCase?.fluorescenceMinPercent ?? null;
      };

      let maxThicknessCm = Math.max(pureCase.thicknessCm, 1e-4);
      let maxEval = evaluateMinRByThickness(maxThicknessCm);
      let expandCount = 0;
      while (
        maxEval != null &&
        maxEval >= fluorescenceTargetPercent &&
        maxThicknessCm < 5.0 &&
        expandCount < 16
      ) {
        maxThicknessCm *= 2.0;
        maxEval = evaluateMinRByThickness(maxThicknessCm);
        expandCount += 1;
      }

      const thicknessSolve = solveThicknessForFluorescence({
        min: 1e-6,
        max: maxThicknessCm,
        evaluateMinRetainedPercent: evaluateMinRByThickness,
        targetMinRetainedPercent: fluorescenceTargetPercent,
        targetTolerance: 0.1,
        valueTolerance: 1e-6,
        maxIterations: 80,
        samplePoints: 96,
      });

      if (!thicknessSolve) {
        warnings.push("Fluorescence thickness solver failed to initialize.");
      } else if (thicknessSolve.feasible) {
        const solvedThicknessCm = thicknessSolve.value;
        const equivalentMassMg = sampleDensityGcm3 * pelletAreaCm2 * solvedThicknessCm * 1000;
        const thicknessCase = buildCase(
          "fluo-thickness",
          "Thickness for fluorescence (sample only, R>=90%)",
          targetEdgeStep,
          equivalentMassMg,
          0,
          {
            solvedThicknessCm,
            equivalentMassMg,
            solverNote: thicknessSolve.note,
          },
        );
        if (thicknessCase) {
          cases.push(thicknessCase);
        } else {
          warnings.push("Could not build fluorescence thickness case from solved thickness.");
        }
      } else {
        const fallbackThicknessCm = thicknessSolve.bestValue;
        const fallbackMassMg = sampleDensityGcm3 * pelletAreaCm2 * fallbackThicknessCm * 1000;
        const fallbackCase = buildCase(
          "fluo-thickness",
          "Thickness for fluorescence (sample only, best effort)",
          targetEdgeStep,
          fallbackMassMg,
          0,
          {
            solvedThicknessCm: fallbackThicknessCm,
            equivalentMassMg: fallbackMassMg,
            solverNote: thicknessSolve.reason,
          },
        );
        if (fallbackCase) {
          cases.push(fallbackCase);
        }
        warnings.push(thicknessSolve.reason);
      }

      return readyState({
        edgeEnergy: edgeE,
        energies,
        sampleMuCurve,
        diluentMuCurve,
        effectiveAreaCm2,
        cases,
        warnings,
      });
    } catch (e: unknown) {
      return errorState(e instanceof Error ? e.message : String(e));
    }
  }, [
    ready,
    sampleFormula,
    diluentFormula,
    atom,
    edge,
    sampleAtoms,
    targetEdgeStep,
    chiAssumed,
    sampleDensityGcm3,
    diluentDensityGcm3,
    totalMassMg,
    diameterMm,
    activePhiDeg,
    activeThetaDeg,
    eStart,
    eEnd,
    eStep,
    edgeEnergy,
    massMu,
  ]);

  useEffect(() => {
    if (!calcState.data) {
      setSelectedCaseId(null);
      return;
    }
    if (!selectedCaseId) return;
    if (!calcState.data.cases.some((c) => c.id === selectedCaseId)) {
      setSelectedCaseId(null);
    }
  }, [calcState.data, selectedCaseId]);

  const selectedCase = useMemo(() => {
    if (!calcState.data || !selectedCaseId) return null;
    return calcState.data.cases.find((c) => c.id === selectedCaseId) ?? null;
  }, [calcState.data, selectedCaseId]);

  const transmissionTraces = useMemo<PlotTrace[]>(() => {
    const data = calcState.data;
    if (!data || !selectedCase) return [];
    const sampleScale = selectedCase.sampleMassMg / 1000 / data.effectiveAreaCm2;
    const diluentScale = selectedCase.diluentMassMg / 1000 / data.effectiveAreaCm2;
    const totalMut = data.energies.map(
      (_, i) =>
        data.sampleMuCurve[i] * sampleScale +
        data.diluentMuCurve[i] * diluentScale,
    );

    return [
      {
        x: data.energies,
        y: totalMut,
        name: `${selectedCase.title} μt(E)`,
      },
    ];
  }, [calcState.data, selectedCase]);

  const rTraces = useMemo<PlotTrace[]>(() => {
    const data = calcState.data;
    if (!data || !selectedCase) return [];
    return [
      {
        x: data.energies,
        y: selectedCase.rPercent,
        name: `${selectedCase.title} R(E, χ)`,
      },
    ];
  }, [calcState.data, selectedCase]);

  if (!ready) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Sample Preparation Helper"
        description="Interactive transmission + fluorescence suitability planning using exact Ameyanagi self-absorption."
      />

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
        <div className="order-2 space-y-4 lg:order-none">
          <FormulaInput
            value={sampleFormula}
            onChange={handleSampleChange}
            label="Sample Formula"
            placeholder="e.g. Fe2O3, RuO2"
          />

          <div>
            <label className="mb-1 block text-sm font-medium">Absorbing Atom</label>
            <div className="flex flex-wrap gap-1">
              {sampleAtoms.map((candidate) => (
                <button
                  key={candidate}
                  type="button"
                  onClick={() => setAtom(candidate)}
                  className={`rounded px-2 py-1 text-xs font-medium ${
                    atom === candidate
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  {candidate}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Absorption Edge</label>
            <div className="flex flex-wrap gap-1">
              {availableEdges.map((candidate) => (
                <button
                  key={candidate}
                  type="button"
                  onClick={() => setEdge(candidate)}
                  className={`rounded px-2 py-1 text-xs font-medium ${
                    edge === candidate
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  {candidate}
                </button>
              ))}
            </div>
            {edgeEnergy != null && (
              <p className="mt-1 text-xs text-muted-foreground">
                {atom} {edge}-edge: {edgeEnergy.toFixed(1)} eV
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Diluent</label>
            <div className="mb-2 flex flex-wrap gap-1">
              {DILUENT_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyDiluentPreset(preset.formula, preset.density)}
                  className={`rounded px-2 py-1 text-xs font-medium ${
                    diluentFormula === preset.formula
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <FormulaInput
              value={diluentFormula}
              onChange={setDiluentFormula}
              label=""
              placeholder="e.g. BN, SiO2"
            />
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Sample density (g/cm³)</label>
              <input
                type="number"
                value={sampleDensityGcm3}
                min={0.001}
                step={0.01}
                onChange={(e) => setSampleDensityGcm3(Number(e.target.value))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Diluent density (g/cm³)</label>
              <input
                type="number"
                value={diluentDensityGcm3}
                min={0.001}
                step={0.01}
                onChange={(e) => setDiluentDensityGcm3(Number(e.target.value))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Total pellet mass (mg)</label>
              <input
                type="number"
                value={totalMassMg}
                min={1}
                step={1}
                onChange={(e) => setTotalMassMg(Number(e.target.value))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Pellet diameter (mm)</label>
              <input
                type="number"
                value={diameterMm}
                min={0.1}
                step={0.1}
                onChange={(e) => setDiameterMm(Number(e.target.value))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="space-y-2 rounded-md border border-border/50 p-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Beam angle control</label>
              <button
                type="button"
                onClick={() => setUseAdvancedAngles((prev) => !prev)}
                className={`rounded px-2 py-1 text-xs font-medium ${
                  useAdvancedAngles
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                {useAdvancedAngles ? "Advanced ON" : "Advanced OFF"}
              </button>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Single beam angle (deg)</label>
              <input
                type="number"
                value={beamAngleDeg}
                min={0.1}
                max={90}
                step={0.1}
                onChange={(e) => setBeamAngle(Number(e.target.value))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                When single-angle mode is used, φ and θ are both set from this value.
              </p>
            </div>

            {useAdvancedAngles && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Incident φ (deg)</label>
                  <input
                    type="number"
                    value={phiDeg}
                    min={0.1}
                    max={90}
                    step={0.1}
                    onChange={(e) => setPhiDeg(Number(e.target.value))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Exit θ (deg)</label>
                  <input
                    type="number"
                    value={thetaDeg}
                    min={0.1}
                    max={90}
                    step={0.1}
                    onChange={(e) => setThetaDeg(Number(e.target.value))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Active geometry: {toDegreesLabel(activePhiDeg, activeThetaDeg)}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Target edge step</label>
              <input
                type="number"
                value={targetEdgeStep}
                min={0.01}
                step={0.01}
                onChange={(e) => setTargetEdgeStep(Number(e.target.value))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Assumed χ</label>
              <input
                type="number"
                value={chiAssumed}
                min={0.001}
                step={0.01}
                onChange={(e) => setChiAssumed(Number(e.target.value))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <EnergyRangeInput
            start={eStart}
            end={eEnd}
            step={eStep}
            onStartChange={setEStart}
            onEndChange={setEEnd}
            onStepChange={setEStep}
          />

          {calcState.error && <ErrorBanner message={calcState.error} />}
        </div>

        <div className="order-1 space-y-4 lg:order-none">
          {calcState.data?.warnings && calcState.data.warnings.length > 0 && (
            <div className="space-y-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-300">
              {calcState.data.warnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          )}

          {calcState.data?.cases && calcState.data.cases.length > 0 && (
            <div className="space-y-3 rounded-lg border border-border bg-card p-4">
              <h3 className="text-sm font-semibold">Case Comparison</h3>
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                {calcState.data.cases.map((caseInfo) => (
                  <CaseCard
                    key={caseInfo.id}
                    info={caseInfo}
                    selected={selectedCaseId === caseInfo.id}
                    onSelect={() => setSelectedCaseId(caseInfo.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {selectedCase ? (
            <div className="space-y-4">
              <ScientificPlot
                traces={transmissionTraces}
                xTitle="Energy (eV)"
                yTitle="μt(E)"
                title={`${selectedCase.title} — Transmission`}
                showLogToggle={false}
                height={340}
              />
              <ScientificPlot
                traces={rTraces}
                xTitle="Energy (eV)"
                yTitle="R(E, χ) retained (%)"
                title={`${selectedCase.title} — Self Absorption (Ameyanagi)`}
                showLogToggle={false}
                yRange={[0, 100]}
                height={340}
              />
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
              Click a case card to view the transmission and R(E, χ) plots.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CaseCard({
  info,
  selected,
  onSelect,
}: {
  info: CaseResult;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-lg border p-3 text-left transition-colors ${
        selected
          ? "border-primary bg-primary/5"
          : "border-border/60 bg-background hover:bg-accent/20"
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold">{info.title}</h4>
        <span className="rounded bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
          target Δμt={info.targetEdgeStep.toFixed(3)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <Stat label="Sample mass" value={`${info.sampleMassMg.toFixed(2)} mg`} />
        <Stat label="Diluent mass" value={`${info.diluentMassMg.toFixed(2)} mg`} />
        <Stat label="Sample fraction" value={`${info.sampleFractionPct.toFixed(1)}%`} />
        <Stat label="Achieved Δμt" value={info.achievedEdgeStep.toFixed(3)} />
        <Stat label="μt above edge" value={info.absorptionAbove.toFixed(3)} />
        <Stat label="Transmission above" value={`${(info.transmissionAbove * 100).toFixed(1)}%`} />
        <Stat label="Min R(E,χ)" value={`${info.fluorescenceMinPercent.toFixed(1)}%`} />
        <Stat label="Mean R(E,χ)" value={`${info.fluorescenceMeanPercent.toFixed(1)}%`} />
        {info.solvedThicknessCm != null && (
          <Stat
            label="Solved thickness"
            value={`${info.solvedThicknessCm.toExponential(3)} cm`}
          />
        )}
        {info.equivalentMassMg != null && (
          <Stat
            label="Equivalent mass"
            value={`${info.equivalentMassMg.toFixed(2)} mg`}
          />
        )}
      </div>

      <div className="mt-3 space-y-1 text-xs">
        <StatusLine
          label="Transmission"
          value={info.transmissionLabel}
          ok={info.transmissionSuitable}
        />
        <StatusLine
          label="Fluorescence"
          value={info.fluorescenceLabel}
          ok={info.fluorescenceSuitable}
        />
        <StatusLine label="Overall" value={info.combinedLabel} ok={info.transmissionSuitable && info.fluorescenceSuitable} />
        {info.solverNote && (
          <p className="text-muted-foreground">{info.solverNote}</p>
        )}
      </div>
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-mono font-medium">{value}</span>
    </div>
  );
}

function StatusLine({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <p className={ok ? "text-green-600 dark:text-green-400" : "text-yellow-700 dark:text-yellow-300"}>
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-medium">{value}</span>
    </p>
  );
}
