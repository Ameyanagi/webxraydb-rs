import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useCallback } from "react";
import { useWasm } from "~/hooks/useWasm";
import {
  material_mu,
  xray_edge_energy,
  parse_formula,
} from "~/lib/wasm-api";
import { errorState, type CalculationState, readyState } from "~/lib/ui-state";
import { computeSampleWeightMix } from "~/lib/sample-weight-calc";
import { ScientificPlot } from "~/components/plot/ScientificPlot";
import type {
  PlotTrace,
  PlotAnnotation,
} from "~/components/plot/ScientificPlot";
import { FormulaInput } from "~/components/formula-input/FormulaInput";
import { LoadingState } from "~/components/ui/LoadingState";
import { ErrorBanner } from "~/components/ui/ErrorBanner";
import { PageHeader } from "~/components/ui/PageHeader";

export const Route = createFileRoute("/sample-weight")({
  component: SampleWeightPage,
});

const EDGES = ["K", "L1", "L2", "L3", "M1", "M2", "M3", "M4", "M5"];

const DILUENT_PRESETS = [
  { label: "BN", formula: "BN", density: 2.1 },
  { label: "Cellulose", formula: "C6H10O5", density: 1.5 },
  { label: "SiO2", formula: "SiO2", density: 2.2 },
  { label: "Al2O3", formula: "Al2O3", density: 3.95 },
  { label: "PE", formula: "C2H4", density: 0.93 },
];

function SampleWeightPage() {
  const ready = useWasm();

  const [sampleFormula, setSampleFormula] = useState("RuO2");
  const [diluentFormula, setDiluentFormula] = useState("BN");
  const [atom, setAtom] = useState("Ru");
  const [edge, setEdge] = useState("K");
  const [totalMass, setTotalMass] = useState(150); // mg
  const [diameter, setDiameter] = useState(13); // mm
  const [angle, setAngle] = useState(45); // degrees
  const [targetEdgeStep, setTargetEdgeStep] = useState(1.0);
  const [energyPadding, setEnergyPadding] = useState(200); // eV below/above edge

  // Derived area in cm²
  const area = useMemo(() => {
    const dCm = diameter / 10; // mm -> cm
    const angleRad = (angle * Math.PI) / 180;
    return ((dCm * dCm * Math.PI) / 4) * Math.cos(angleRad);
  }, [diameter, angle]);

  // Extract absorbing atoms from sample formula
  const sampleAtoms = useMemo(() => {
    if (!ready) return [];
    try {
      const parsed = parse_formula(sampleFormula);
      return (parsed.components as { symbol: string; count: number }[]).map(
        (c) => c.symbol,
      );
    } catch {
      return [];
    }
  }, [ready, sampleFormula]);

  // Auto-select atom when sample changes
  const handleSampleChange = useCallback(
    (formula: string) => {
      setSampleFormula(formula);
      try {
        const parsed = parse_formula(formula);
        const components = parsed.components as {
          symbol: string;
          count: number;
        }[];
        if (components.length > 0 && !components.some((c) => c.symbol === atom)) {
          setAtom(components[0].symbol);
        }
      } catch {
        // keep current atom
      }
    },
    [atom],
  );

  // Edge energy
  const edgeEnergy = useMemo(() => {
    if (!ready || !atom || !edge) return null;
    try {
      return xray_edge_energy(atom, edge);
    } catch {
      return null;
    }
  }, [ready, atom, edge]);

  // Available edges for the selected atom
  const availableEdges = useMemo(() => {
    if (!ready || !atom) return EDGES;
    return EDGES.filter((e) => {
      try {
        xray_edge_energy(atom, e);
        return true;
      } catch {
        return false;
      }
    });
  }, [ready, atom]);

  // Mass attenuation coefficient (cm²/g) for a formula at given energies
  const massMu = useCallback(
    (formula: string, energies: Float64Array): Float64Array | null => {
      try {
        // Use density=1.0 to get mass attenuation coefficient directly
        return material_mu(formula, 1.0, energies, "total");
      } catch {
        return null;
      }
    },
    [],
  );

  // Core calculation: sample and diluent weights
  const calculationState = useMemo<
    CalculationState<{
      sampleMassMg: number;
      diluentMassMg: number;
      sampleFraction: number;
      achievedEdgeStep: number;
      sampleEdgeStepPerG: number;
      diluentEdgeStepPerG: number;
      absorptionBelow: number;
      absorptionAbove: number;
      transmissionBelow: number;
      transmissionAbove: number;
    }>
  >(() => {
    if (!ready) return { status: "idle", data: null, error: null };
    if (!edgeEnergy || !sampleFormula.trim() || !diluentFormula.trim()) {
      return errorState("Set sample/diluent formulas and select a valid absorption edge");
    }
    if (totalMass <= 0) return errorState("Total mass must be greater than zero");
    if (targetEdgeStep <= 0) return errorState("Target edge step must be greater than zero");
    if (area <= 0) return errorState("Effective area must be greater than zero");

    try {
      const eStep = 10;
      const eBelow = new Float64Array([edgeEnergy - eStep]);
      const eAbove = new Float64Array([edgeEnergy + eStep]);

      const sampleMuBelow = massMu(sampleFormula, eBelow);
      const sampleMuAbove = massMu(sampleFormula, eAbove);
      const diluentMuBelow = massMu(diluentFormula, eBelow);
      const diluentMuAbove = massMu(diluentFormula, eAbove);

      if (!sampleMuBelow || !sampleMuAbove || !diluentMuBelow || !diluentMuAbove) {
        return errorState("Could not calculate attenuation coefficients");
      }

      const sampleEdgeStep = sampleMuAbove[0] - sampleMuBelow[0];
      const diluentEdgeStep = diluentMuAbove[0] - diluentMuBelow[0];

      if (Math.abs(sampleEdgeStep - diluentEdgeStep) < 1e-10) {
        return errorState("Sample and diluent have identical edge steps");
      }

      const mix = computeSampleWeightMix({
        sampleEdgeStep,
        diluentEdgeStep,
        totalMassMg: totalMass,
        areaCm2: area,
        targetEdgeStep,
      });
      if (!mix) return errorState("Could not compute sample/diluent masses");

      const sampleMassG = mix.sampleMassMg / 1000;
      const diluentMassG = mix.diluentMassMg / 1000;

      const totalAbsBelow =
        sampleMuBelow[0] * (sampleMassG / area) +
        diluentMuBelow[0] * (diluentMassG / area);
      const totalAbsAbove =
        sampleMuAbove[0] * (sampleMassG / area) +
        diluentMuAbove[0] * (diluentMassG / area);

      return readyState({
        sampleMassMg: mix.sampleMassMg,
        diluentMassMg: mix.diluentMassMg,
        sampleFraction: mix.sampleFractionPct,
        achievedEdgeStep: mix.achievedEdgeStep,
        sampleEdgeStepPerG: sampleEdgeStep,
        diluentEdgeStepPerG: diluentEdgeStep,
        absorptionBelow: totalAbsBelow,
        absorptionAbove: totalAbsAbove,
        transmissionBelow: Math.exp(-totalAbsBelow),
        transmissionAbove: Math.exp(-totalAbsAbove),
      });
    } catch (e: unknown) {
      return errorState(e instanceof Error ? e.message : String(e));
    }
  }, [
    ready,
    edgeEnergy,
    sampleFormula,
    diluentFormula,
    totalMass,
    area,
    targetEdgeStep,
    massMu,
  ]);

  const calculation = calculationState.data;

  // Absorption spectrum plot
  const traces: PlotTrace[] = useMemo(() => {
    if (!ready || !edgeEnergy || !calculation) return [];

    const eStart = Math.max(100, edgeEnergy - energyPadding);
    const eEnd = edgeEnergy + energyPadding;
    const step = Math.max(1, Math.round((eEnd - eStart) / 500));

    const energies: number[] = [];
    for (let e = eStart; e <= eEnd; e += step) {
      energies.push(e);
    }
    const energyArr = new Float64Array(energies);

    const result: PlotTrace[] = [];
    const sampleMassG = (calculation.sampleMassMg ?? 0) / 1000;
    const diluentMassG = (calculation.diluentMassMg ?? 0) / 1000;

    // Total absorption (μt)
    const sampleMu = massMu(sampleFormula, energyArr);
    const diluentMu = massMu(diluentFormula, energyArr);

    if (sampleMu && diluentMu) {
      const totalMut: number[] = [];
      const sampleMut: number[] = [];
      for (let i = 0; i < energies.length; i++) {
        const st = sampleMu[i] * (sampleMassG / area);
        const dt = diluentMu[i] * (diluentMassG / area);
        totalMut.push(st + dt);
        sampleMut.push(st);
      }
      result.push({
        x: energies,
        y: totalMut,
        name: "Total absorption (μt)",
      });
      result.push({
        x: energies,
        y: sampleMut,
        name: `${sampleFormula} only`,
        line: { dash: "dot", width: 2 },
      });
    }

    return result;
  }, [
    ready,
    edgeEnergy,
    calculation,
    sampleFormula,
    diluentFormula,
    energyPadding,
    massMu,
    area,
  ]);

  // Edge energy vertical line
  const edgeAnnotations: PlotAnnotation[] = useMemo(() => {
    if (!edgeEnergy) return [];
    return [
      {
        x: edgeEnergy,
        text: `${atom} ${edge} edge`,
        color: "#ef4444",
      },
    ];
  }, [edgeEnergy, atom, edge]);

  if (!ready) {
    return <LoadingState />;
  }

  return (
    <div>
      <PageHeader
        title="Sample Weight Calculator"
        description="Calculate sample and diluent weights for XAS transmission pellet preparation."
      />

      <div className="mb-6 grid gap-6 grid-cols-1 lg:grid-cols-[350px_1fr]">
        {/* Controls */}
        <div className="order-2 space-y-4 lg:order-none">
          <FormulaInput
            value={sampleFormula}
            onChange={handleSampleChange}
            label="Sample Formula"
            placeholder="e.g. RuO2, Fe2O3"
          />

          <div>
            <label className="mb-1 block text-sm font-medium">
              Absorbing Atom
            </label>
            <div className="flex flex-wrap gap-1">
              {sampleAtoms.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAtom(a)}
                  className={`rounded px-2 py-1 text-xs font-medium ${atom === a ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Absorption Edge
            </label>
            <div className="flex flex-wrap gap-1">
              {availableEdges.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEdge(e)}
                  className={`rounded px-2 py-1 text-xs font-medium ${edge === e ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}
                >
                  {e}
                </button>
              ))}
            </div>
            {edgeEnergy && (
              <p className="mt-1 text-xs text-muted-foreground">
                {atom} {edge}-edge: {edgeEnergy.toFixed(1)} eV
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Diluent</label>
            <div className="mb-2 flex flex-wrap gap-1">
              {DILUENT_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setDiluentFormula(p.formula)}
                  className={`rounded px-2 py-1 text-xs font-medium ${diluentFormula === p.formula ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <FormulaInput
              value={diluentFormula}
              onChange={setDiluentFormula}
              label=""
              placeholder="Diluent formula"
            />
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Total Mass (mg)
              </label>
              <input
                type="number"
                value={totalMass}
                step={1}
                min={1}
                onChange={(e) => setTotalMass(Number(e.target.value))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Target Edge Step
              </label>
              <input
                type="number"
                value={targetEdgeStep}
                step={0.1}
                min={0.1}
                onChange={(e) => setTargetEdgeStep(Number(e.target.value))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Pellet Diameter (mm)
              </label>
              <input
                type="number"
                value={diameter}
                step={0.5}
                min={1}
                onChange={(e) => setDiameter(Number(e.target.value))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Beam Angle (deg)
              </label>
              <input
                type="number"
                value={angle}
                step={5}
                min={1}
                max={90}
                onChange={(e) => setAngle(Number(e.target.value))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Effective area: {area.toFixed(4)} cm²
          </p>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Plot Range (eV around edge)
            </label>
            <input
              type="number"
              value={energyPadding}
              step={50}
              min={50}
              onChange={(e) => setEnergyPadding(Number(e.target.value))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {calculationState.error && <ErrorBanner message={calculationState.error} />}

          {/* Results */}
          {calculation && (
            <div className="space-y-3">
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                <h2 className="mb-3 text-lg font-semibold">Calculated Weights</h2>
                <table className="w-full text-sm">
                  <tbody>
                    <ResultRow
                      label={`${sampleFormula} mass`}
                      value={`${calculation.sampleMassMg.toFixed(2)} mg`}
                      highlight={calculation.sampleMassMg < 0}
                    />
                    <ResultRow
                      label={`${diluentFormula} mass`}
                      value={`${calculation.diluentMassMg.toFixed(2)} mg`}
                      highlight={calculation.diluentMassMg < 0}
                    />
                    <ResultRow
                      label="Sample fraction"
                      value={`${calculation.sampleFraction.toFixed(1)}%`}
                    />
                    <ResultRow
                      label="Edge step (Δμt)"
                      value={calculation.achievedEdgeStep.toFixed(3)}
                    />
                  </tbody>
                </table>
              </div>

              <div className="rounded-lg border border-border bg-card p-4">
                <h3 className="mb-2 text-sm font-semibold">
                  Absorption at Edge
                </h3>
                <table className="w-full text-sm">
                  <tbody>
                    <ResultRow
                      label="μt below edge"
                      value={calculation.absorptionBelow.toFixed(3)}
                    />
                    <ResultRow
                      label="μt above edge"
                      value={calculation.absorptionAbove.toFixed(3)}
                    />
                    <ResultRow
                      label="Transmission below"
                      value={`${(calculation.transmissionBelow * 100).toFixed(1)}%`}
                    />
                    <ResultRow
                      label="Transmission above"
                      value={`${(calculation.transmissionAbove * 100).toFixed(1)}%`}
                    />
                  </tbody>
                </table>
              </div>

              {(calculation.sampleMassMg < 0 ||
                calculation.diluentMassMg < 0) && (
                <p className="text-sm text-destructive">
                  Negative mass: try increasing total mass or decreasing the
                  target edge step.
                </p>
              )}

              {calculation.absorptionAbove > 4 && (
                <p className="text-sm text-yellow-500">
                  Total absorption &gt; 4 — sample may be too thick for good
                  transmission data.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Plot */}
        <div className="order-1 lg:order-none">
          <ScientificPlot
            traces={traces}
            xTitle="Energy (eV)"
            yTitle="μt (absorption)"
            title={`Absorption — ${sampleFormula} + ${diluentFormula}`}
            verticalLines={edgeAnnotations}
            showLogToggle={false}
          />
        </div>
      </div>
    </div>
  );
}

function ResultRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <tr className="border-b border-border/30 last:border-0">
      <td className="py-1.5 pr-4 text-muted-foreground">{label}</td>
      <td
        className={`py-1.5 font-mono font-medium ${highlight ? "text-destructive" : ""}`}
      >
        {value}
      </td>
    </tr>
  );
}
