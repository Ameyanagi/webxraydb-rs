import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useCallback } from "react";
import { useWasm } from "~/hooks/useWasm";
import { material_mu } from "~/lib/wasm-api";
import { energyRange } from "~/lib/constants";
import { ScientificPlot } from "~/components/plot/ScientificPlot";
import type { PlotTrace } from "~/components/plot/ScientificPlot";
import { FormulaInput } from "~/components/formula-input/FormulaInput";
import { EnergyRangeInput } from "~/components/energy-range/EnergyRangeInput";
import { MaterialPicker } from "~/components/material-picker/MaterialPicker";

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
  const [error, setError] = useState<string | null>(null);

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

  const traces: PlotTrace[] = useMemo(() => {
    if (!ready) return [];
    setError(null);

    const energies = energyRange(eStart, eEnd, eStep);
    const energyArr = Array.from(energies);
    const result: PlotTrace[] = [];

    // Current formula (always shown)
    if (formula.trim()) {
      try {
        const mu = material_mu(formula.trim(), density, energies, kind);
        result.push({
          x: energyArr,
          y: Array.from(mu),
          name: `${formula} (ρ=${density})`,
        });
      } catch (e: any) {
        setError(e.message ?? String(e));
      }
    }

    // Additional materials for overlay
    for (const mat of materials) {
      try {
        const mu = material_mu(mat.formula, mat.density, energies, kind);
        result.push({
          x: energyArr,
          y: Array.from(mu),
          name: mat.label,
          line: { dash: "dot", width: 2 },
        });
      } catch {
        // skip invalid overlay materials
      }
    }

    return result;
  }, [ready, formula, density, eStart, eEnd, eStep, kind, materials]);

  if (!ready) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        Loading X-ray database...
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">X-ray Attenuation</h1>
      <p className="mb-6 text-muted-foreground">
        Calculate material linear attenuation coefficient μ (1/cm) as a
        function of X-ray energy.
      </p>

      <div className="mb-6 grid gap-6 lg:grid-cols-[350px_1fr]">
        {/* Controls */}
        <div className="space-y-4">
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

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        {/* Plot */}
        <ScientificPlot
          traces={traces}
          xTitle="Energy (eV)"
          yTitle="μ (1/cm)"
          title={`Attenuation — ${kind}`}
          defaultLogY
        />
      </div>
    </div>
  );
}
