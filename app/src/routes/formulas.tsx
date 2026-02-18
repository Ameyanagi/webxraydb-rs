import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useWasm } from "~/hooks/useWasm";
import {
  material_mu,
  xray_delta_beta,
  parse_formula,
  molar_mass,
  xray_edge_energy,
  mu_elam,
} from "~/lib/wasm-api";
import { errorState, type CalculationState, readyState } from "~/lib/ui-state";
import { FormulaInput } from "~/components/formula-input/FormulaInput";
import { MaterialPicker } from "~/components/material-picker/MaterialPicker";
import { LoadingState } from "~/components/ui/LoadingState";
import { ErrorBanner } from "~/components/ui/ErrorBanner";
import { PageHeader } from "~/components/ui/PageHeader";
import { downloadCsv } from "~/lib/csv-export";

export const Route = createFileRoute("/formulas")({
  component: FormulasPage,
});

const AVOGADRO = 6.02214076e23;

interface ComponentRow {
  symbol: string;
  count: number;
  molarMass: number;
  weightFraction: number;
  muContribution: number;
  barnsPerAtom: number;
  cm2PerG: number;
}

interface FormulaResults {
  muTotal: number;
  muPhoto: number;
  absorptionLength: number;
  delta: number;
  beta: number;
  attenuationLengthCm: number;
  totalWeight: number;
  rows: ComponentRow[];
  unitEdgeStep: number | null;
  nearestEdge: string | null;
  transmission: number;
  sampleMass: number;
}

function FormulasPage() {
  const ready = useWasm();

  const [formula, setFormula] = useState("Fe2O3");
  const [density, setDensity] = useState(5.24);
  const [energy, setEnergy] = useState(7112);
  const [thickness, setThickness] = useState(0.1);
  const [area, setArea] = useState(1.0);

  const handleMaterialSelect = (f: string, d: number) => {
    setFormula(f);
    setDensity(d);
  };

  const resultState = useMemo<CalculationState<FormulaResults>>(() => {
    if (!ready) return { status: "idle", data: null, error: null };
    if (!formula.trim()) return errorState("Enter a chemical formula");
    if (!(density > 0)) return errorState("Density must be greater than zero");
    if (!(energy > 0)) return errorState("Energy must be greater than zero");
    if (thickness < 0) return errorState("Thickness cannot be negative");
    if (area <= 0) return errorState("Area must be greater than zero");

    try {
      const energies = new Float64Array([energy]);
      const muTotal = material_mu(formula.trim(), density, energies, "total");
      const muPhoto = material_mu(formula.trim(), density, energies, "photo");
      const db = xray_delta_beta(formula.trim(), density, energy);

      const parsed = parse_formula(formula.trim());
      const components = parsed.components as {
        symbol: string;
        count: number;
      }[];

      let totalWeight = 0;
      const compData: {
        symbol: string;
        count: number;
        mm: number;
      }[] = [];
      for (const c of components) {
        try {
          const mm = molar_mass(c.symbol);
          compData.push({ symbol: c.symbol, count: c.count, mm });
          totalWeight += c.count * mm;
        } catch {
          compData.push({ symbol: c.symbol, count: c.count, mm: 0 });
        }
      }

      const rows: ComponentRow[] = compData.map((c) => {
        const wf = totalWeight > 0 ? (c.count * c.mm) / totalWeight : 0;
        let muEl = 0;
        let barnsPerAtom = 0;
        let cm2PerG = 0;
        try {
          const mu = material_mu(c.symbol, density, energies, "total");
          muEl = mu[0] * wf;
          const muElem = mu_elam(c.symbol, energies, "total");
          cm2PerG = muElem[0];
          barnsPerAtom = (cm2PerG * c.mm) / AVOGADRO * 1e24;
        } catch {
          // keep partial row values
        }
        return {
          symbol: c.symbol,
          count: c.count,
          molarMass: c.mm,
          weightFraction: wf,
          muContribution: muEl,
          barnsPerAtom,
          cm2PerG,
        };
      });

      const absorptionLength = muTotal[0] > 0 ? 1.0 / muTotal[0] : Infinity;

      let unitEdgeStep: number | null = null;
      let nearestEdge: string | null = null;
      for (const c of components) {
        for (const edgeName of ["K", "L1", "L2", "L3"]) {
          try {
            const edgeE = xray_edge_energy(c.symbol, edgeName) as number;
            if (Math.abs(edgeE - energy) < 100) {
              const eAbove = new Float64Array([edgeE + 50]);
              const eBelow = new Float64Array([edgeE - 50]);
              const muAbove = material_mu(formula.trim(), density, eAbove, "total");
              const muBelow = material_mu(formula.trim(), density, eBelow, "total");
              const deltaMu = muAbove[0] - muBelow[0];
              if (deltaMu > 0) {
                unitEdgeStep = 1.0 / deltaMu;
                nearestEdge = `${c.symbol} ${edgeName}`;
              }
            }
          } catch {
            // skip invalid edge for this component
          }
        }
      }

      const transmission = Math.exp(-muTotal[0] * thickness);
      const sampleMass = absorptionLength * area * density;

      return readyState({
        muTotal: muTotal[0],
        muPhoto: muPhoto[0],
        absorptionLength,
        delta: db.delta,
        beta: db.beta,
        attenuationLengthCm: db.attenuation_length_cm,
        totalWeight,
        rows,
        unitEdgeStep,
        nearestEdge,
        transmission,
        sampleMass,
      });
    } catch (e: unknown) {
      return errorState(e instanceof Error ? e.message : String(e));
    }
  }, [ready, formula, density, energy, thickness, area]);

  if (!ready) {
    return <LoadingState />;
  }

  const results = resultState.data;

  return (
    <div>
      <PageHeader
        title="Absorption Formulas"
        description="Calculate absorption length, unit edge step, refractive index, and elemental contributions for a given material and energy."
      />

      <div className="mb-6 grid gap-6 grid-cols-1 lg:grid-cols-[350px_1fr]">
        {/* Controls */}
        <div className="order-2 space-y-4 lg:order-none">
          <MaterialPicker onSelect={handleMaterialSelect} />
          <FormulaInput value={formula} onChange={setFormula} />

          <div>
            <label className="mb-1 block text-sm font-medium">
              Density (g/cm³)
            </label>
            <input
              type="number"
              value={density}
              step={0.001}
              onChange={(e) => setDensity(Number(e.target.value))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Energy (eV)
            </label>
            <input
              type="number"
              value={energy}
              step={1}
              onChange={(e) => setEnergy(Number(e.target.value))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Thickness (cm)
              </label>
              <input
                type="number"
                value={thickness}
                step={0.01}
                min={0}
                onChange={(e) => setThickness(Number(e.target.value))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Area (cm²)
              </label>
              <input
                type="number"
                value={area}
                step={0.1}
                min={0}
                onChange={(e) => setArea(Number(e.target.value))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {resultState.error && <ErrorBanner message={resultState.error} />}
        </div>

        {/* Results */}
        {results && (
          <div className="order-1 space-y-4 lg:order-none">
            {/* Summary */}
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Results</h2>
                <button
                  type="button"
                  onClick={() =>
                    downloadCsv(
                      `${formula}_results.csv`,
                      ["Property", "Value"],
                      [
                        ["mu_total_1_per_cm", results.muTotal.toExponential(6)],
                        ["mu_photo_1_per_cm", results.muPhoto.toExponential(6)],
                        ["absorption_length_cm", results.absorptionLength.toExponential(6)],
                        ["delta", results.delta.toExponential(8)],
                        ["beta", results.beta.toExponential(8)],
                        ["attenuation_length_cm", results.attenuationLengthCm.toExponential(6)],
                        ["formula_weight_g_per_mol", results.totalWeight.toFixed(4)],
                        ["transmission", results.transmission.toExponential(6)],
                        ["sample_mass_g", results.sampleMass.toExponential(6)],
                      ],
                    )
                  }
                  className="text-xs text-muted-foreground hover:text-primary"
                >
                  Export CSV
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <ResultCard
                  label="μ total (1/cm)"
                  value={results.muTotal.toExponential(4)}
                />
                <ResultCard
                  label="μ photo (1/cm)"
                  value={results.muPhoto.toExponential(4)}
                />
                <ResultCard
                  label="Absorption length"
                  value={formatLength(results.absorptionLength)}
                />
                <ResultCard
                  label="δ (refractive)"
                  value={results.delta.toExponential(6)}
                />
                <ResultCard
                  label="β (absorption)"
                  value={results.beta.toExponential(6)}
                />
                <ResultCard
                  label="Attenuation length"
                  value={formatLength(results.attenuationLengthCm)}
                />
                <ResultCard
                  label="Formula weight"
                  value={`${results.totalWeight.toFixed(3)} g/mol`}
                />
                <ResultCard
                  label={`Transmission (t=${thickness} cm)`}
                  value={`${(results.transmission * 100).toFixed(2)}%`}
                />
                <ResultCard
                  label={`Sample mass (A=${area} cm²)`}
                  value={formatMass(results.sampleMass)}
                />
              </div>
            </div>

            {/* Unit edge step */}
            {results.unitEdgeStep !== null && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                <h2 className="mb-2 text-sm font-semibold">
                  Unit Edge Step — {results.nearestEdge}
                </h2>
                <p className="font-mono text-sm">
                  {formatLength(results.unitEdgeStep)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Thickness for a unit step in absorption across the edge
                  (Δμt = 1).
                </p>
              </div>
            )}

            {/* Component table */}
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  Elemental Contributions
                </h2>
                <button
                  type="button"
                  onClick={() =>
                    downloadCsv(
                      `${formula}_components.csv`,
                      ["Element", "Count", "Molar_Mass", "Weight_%", "mu_contrib", "barns_per_atom", "cm2_per_g"],
                      results.rows.map((r) => [
                        r.symbol,
                        r.count.toString(),
                        r.molarMass.toFixed(3),
                        (r.weightFraction * 100).toFixed(2),
                        r.muContribution.toExponential(4),
                        r.barnsPerAtom.toFixed(1),
                        r.cm2PerG.toFixed(4),
                      ]),
                    )
                  }
                  className="text-xs text-muted-foreground hover:text-primary"
                >
                  Export CSV
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="pb-2 pr-4">Element</th>
                      <th className="pb-2 pr-4">Count</th>
                      <th className="pb-2 pr-4">Molar Mass</th>
                      <th className="pb-2 pr-4">Weight %</th>
                      <th className="hidden pb-2 pr-4 sm:table-cell">μ contrib.</th>
                      <th className="hidden pb-2 pr-4 sm:table-cell">barns/atom</th>
                      <th className="hidden pb-2 sm:table-cell">cm²/g</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.rows.map((r) => (
                      <tr
                        key={r.symbol}
                        className="border-b border-border/50 last:border-0"
                      >
                        <td className="py-1.5 pr-4 font-medium">{r.symbol}</td>
                        <td className="py-1.5 pr-4 font-mono">
                          {r.count % 1 === 0 ? r.count : r.count.toFixed(3)}
                        </td>
                        <td className="py-1.5 pr-4 font-mono">
                          {r.molarMass.toFixed(3)}
                        </td>
                        <td className="py-1.5 pr-4 font-mono">
                          {(r.weightFraction * 100).toFixed(2)}%
                        </td>
                        <td className="hidden py-1.5 pr-4 font-mono sm:table-cell">
                          {r.muContribution.toExponential(3)}
                        </td>
                        <td className="hidden py-1.5 pr-4 font-mono sm:table-cell">
                          {r.barnsPerAtom.toFixed(1)}
                        </td>
                        <td className="hidden py-1.5 font-mono sm:table-cell">
                          {r.cm2PerG.toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border/50 p-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-mono text-sm font-semibold">{value}</p>
    </div>
  );
}

function formatLength(cm: number): string {
  if (!isFinite(cm)) return "∞";
  if (cm < 0.0001) return `${(cm * 1e4).toFixed(2)} μm`;
  if (cm < 0.1) return `${(cm * 10).toFixed(4)} mm`;
  return `${cm.toFixed(4)} cm`;
}

function formatMass(g: number): string {
  if (!isFinite(g)) return "∞";
  if (g < 0.001) return `${(g * 1e6).toFixed(1)} μg`;
  if (g < 1) return `${(g * 1000).toFixed(2)} mg`;
  return `${g.toFixed(4)} g`;
}
