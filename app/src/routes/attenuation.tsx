import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useCallback } from "react";
import { useWasm } from "~/hooks/useWasm";
import { material_mu } from "~/lib/wasm-api";
import { energyRange } from "~/lib/constants";
import { validateRange } from "~/lib/inputs";
import { errorState, type CalculationState, readyState } from "~/lib/ui-state";
import { ScientificPlot } from "~/components/plot/ScientificPlot";
import type { PlotTrace } from "~/components/plot/ScientificPlot";
import { FormulaInput } from "~/components/formula-input/FormulaInput";
import { EnergyRangeInput } from "~/components/energy-range/EnergyRangeInput";
import { MaterialPicker } from "~/components/material-picker/MaterialPicker";
import { LoadingState } from "~/components/ui/LoadingState";
import { ErrorBanner } from "~/components/ui/ErrorBanner";
import { PageHeader } from "~/components/ui/PageHeader";

export const Route = createFileRoute("/attenuation")({
  component: AttenuationPage,
});

interface MaterialLayer {
  id: number;
  formula: string;
  density: number;
  label: string;
}

const CROSS_SECTION_KINDS = [
  { value: "total", label: "Total" },
  { value: "photo", label: "Photoelectric" },
  { value: "coherent", label: "Coherent" },
  { value: "incoherent", label: "Incoherent" },
  { value: "all", label: "All Contributions" },
];

let nextId = 1;

function AttenuationPage() {
  const ready = useWasm();

  const [formula, setFormula] = useState("H2O");
  const [density, setDensity] = useState(1.0);
  const [eStart, setEStart] = useState(1000);
  const [eEnd, setEEnd] = useState(30000);
  const [eStep, setEStep] = useState(50);
  const [kind, setKind] = useState("total");
  const [materials, setMaterials] = useState<MaterialLayer[]>([]);

  const handleMaterialSelect = useCallback(
    (f: string, d: number) => {
      setFormula(f);
      setDensity(d);
    },
    [],
  );

  const addMaterial = useCallback(() => {
    if (!formula.trim()) return;
    setMaterials((prev) => [
      ...prev,
      {
        id: nextId++,
        formula: formula.trim(),
        density,
        label: `${formula.trim()} (ρ=${density})`,
      },
    ]);
  }, [formula, density]);

  const removeMaterial = useCallback((id: number) => {
    setMaterials((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const traceState = useMemo<CalculationState<PlotTrace[]>>(() => {
    if (!ready) return { status: "idle", data: null, error: null };
    if (!formula.trim()) return errorState("Enter a chemical formula to calculate attenuation");
    if (!(density > 0)) return errorState("Density must be greater than zero");

    const range = validateRange(eStart, eEnd, eStep, 25000);
    if (!range.valid) return errorState(range.error ?? "Invalid energy range");

    try {
      const energies = energyRange(eStart, eEnd, eStep);
      const energyArr = Array.from(energies);
      const result: PlotTrace[] = [];

      if (kind === "all") {
        const contributions = [
          { kind: "total", label: "Total", dash: undefined as undefined, color: undefined as string | undefined },
          { kind: "photo", label: "Photoelectric", dash: "dash" as const, color: "#f97316" },
          { kind: "coherent", label: "Coherent", dash: "dot" as const, color: "#22c55e" },
          { kind: "incoherent", label: "Incoherent", dash: "dashdot" as const, color: "#a855f7" },
        ];
        for (const c of contributions) {
          const mu = material_mu(formula.trim(), density, energies, c.kind);
          result.push({
            x: energyArr,
            y: Array.from(mu),
            name: `${formula} — ${c.label}`,
            line: c.dash ? { dash: c.dash, width: 2, color: c.color } : undefined,
          });
        }
      } else {
        const mu = material_mu(formula.trim(), density, energies, kind);
        result.push({
          x: energyArr,
          y: Array.from(mu),
          name: `${formula} (ρ=${density})`,
        });

        for (const mat of materials) {
          try {
            const overlayMu = material_mu(mat.formula, mat.density, energies, kind);
            result.push({
              x: energyArr,
              y: Array.from(overlayMu),
              name: mat.label,
              line: { dash: "dot", width: 2 },
            });
          } catch {
            // Ignore invalid overlay material while preserving primary trace.
          }
        }
      }

      return readyState(result);
    } catch (e: unknown) {
      return errorState(e instanceof Error ? e.message : String(e));
    }
  }, [ready, formula, density, eStart, eEnd, eStep, kind, materials]);

  if (!ready) {
    return <LoadingState />;
  }

  return (
    <div>
      <PageHeader
        title="X-ray Attenuation"
        description="Calculate material linear attenuation coefficient μ (1/cm) as a function of X-ray energy."
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

          <EnergyRangeInput
            start={eStart}
            end={eEnd}
            step={eStep}
            onStartChange={setEStart}
            onEndChange={setEEnd}
            onStepChange={setEStep}
          />

          <div>
            <label className="mb-1 block text-sm font-medium">
              Cross-section Type
            </label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {CROSS_SECTION_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>

          {/* Overlay materials */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={addMaterial}
              className="rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
            >
              + Add to overlay
            </button>
            {materials.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded border border-border px-2 py-1 text-xs"
              >
                <span>{m.label}</span>
                <button
                  type="button"
                  onClick={() => removeMaterial(m.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {traceState.error && <ErrorBanner message={traceState.error} />}
        </div>

        {/* Plot */}
        <div className="order-1 lg:order-none">
        <ScientificPlot
          traces={traceState.data ?? []}
          xTitle="Energy (eV)"
          yTitle="μ (1/cm)"
          title={`Attenuation — ${kind === "all" ? "All Contributions" : kind}`}
          defaultLogY
        />
        </div>
      </div>
    </div>
  );
}
