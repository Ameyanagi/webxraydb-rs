import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useCallback } from "react";
import { useWasm } from "~/hooks/useWasm";
import { mirror_reflectivity, xray_delta_beta } from "~/lib/wasm-api";
import { validateRange } from "~/lib/inputs";
import { errorState, type CalculationState, readyState } from "~/lib/ui-state";
import { ScientificPlot } from "~/components/plot/ScientificPlot";
import type {
  PlotTrace,
  PlotAnnotation,
} from "~/components/plot/ScientificPlot";
import { MaterialPicker } from "~/components/material-picker/MaterialPicker";
import { LoadingState } from "~/components/ui/LoadingState";
import { ErrorBanner } from "~/components/ui/ErrorBanner";
import { PageHeader } from "~/components/ui/PageHeader";

export const Route = createFileRoute("/reflectivity")({
  component: ReflectivityPage,
});

const MIRROR_PRESETS = [
  { label: "Si", formula: "Si", density: 2.33 },
  { label: "SiO2", formula: "SiO2", density: 2.2 },
  { label: "Pt", formula: "Pt", density: 21.45 },
  { label: "Rh", formula: "Rh", density: 12.41 },
  { label: "Ni", formula: "Ni", density: 8.9 },
  { label: "Cr", formula: "Cr", density: 7.19 },
];

type PlotMode = "angle" | "energy";

interface CustomMaterial {
  id: number;
  formula: string;
  density: number;
}

let nextCustomId = 1;

function ReflectivityPage() {
  const ready = useWasm();

  const [energy, setEnergy] = useState(10000);
  const [roughness, setRoughness] = useState(0);
  const [polarization, setPolarization] = useState("s");
  const [plotMode, setPlotMode] = useState<PlotMode>("energy");

  // Toggle-based material selection from presets
  const [activePresets, setActivePresets] = useState<Set<string>>(
    () => new Set(["Si"]),
  );

  // Custom materials added via MaterialPicker
  const [customMaterials, setCustomMaterials] = useState<CustomMaterial[]>([]);

  // Angle scan params
  const [angleStart, setAngleStart] = useState(0.1);
  const [angleEnd, setAngleEnd] = useState(10);
  const [angleStep, setAngleStep] = useState(0.02);

  // Energy scan params
  const [fixedAngle, setFixedAngle] = useState(2.0); // mrad
  const [energyStart, setEnergyStart] = useState(1000);
  const [energyEnd, setEnergyEnd] = useState(50000);
  const [energyStep, setEnergyStep] = useState(100);

  const togglePreset = useCallback((label: string) => {
    setActivePresets((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }, []);

  const handleMaterialSelect = useCallback((f: string, d: number) => {
    setCustomMaterials((prev) => [
      ...prev,
      { id: nextCustomId++, formula: f, density: d },
    ]);
  }, []);

  const removeCustom = useCallback((id: number) => {
    setCustomMaterials((prev) => prev.filter((m) => m.id !== id));
  }, []);

  // Calculate reflectivity for one material across angles
  const calcAngleScan = useCallback(
    (f: string, d: number, thetaRad: Float64Array): number[] | null => {
      try {
        const refl = mirror_reflectivity(
          f,
          thetaRad,
          energy,
          d,
          roughness,
          polarization,
        ) as number[] | Float64Array;
        return Array.from(refl);
      } catch {
        return null;
      }
    },
    [energy, roughness, polarization],
  );

  // Calculate reflectivity for one material across energies
  const calcEnergyScan = useCallback(
    (f: string, d: number, energies: number[]): number[] => {
      const thetaRad = new Float64Array([fixedAngle * 0.001]);
      const refls: number[] = [];
      for (const e of energies) {
        try {
          const refl = mirror_reflectivity(
            f,
            thetaRad,
            e,
            d,
            roughness,
            polarization,
          ) as number[] | Float64Array;
          refls.push(Array.from(refl)[0] ?? 0);
        } catch {
          refls.push(0);
        }
      }
      return refls;
    },
    [fixedAngle, roughness, polarization],
  );

  // Materials to plot — from active presets + custom materials
  const materialsToPlot = useMemo(() => {
    const items: { formula: string; density: number }[] = [];
    for (const preset of MIRROR_PRESETS) {
      if (activePresets.has(preset.label)) {
        items.push({ formula: preset.formula, density: preset.density });
      }
    }
    for (const cm of customMaterials) {
      items.push({ formula: cm.formula, density: cm.density });
    }
    return items;
  }, [activePresets, customMaterials]);

  const traceState = useMemo<CalculationState<PlotTrace[]>>(() => {
    if (!ready) return { status: "idle", data: null, error: null };
    if (!materialsToPlot.length)
      return errorState("Select at least one material");
    if (roughness < 0) return errorState("Roughness cannot be negative");

    if (plotMode === "angle") {
      const range = validateRange(angleStart, angleEnd, angleStep, 50000);
      if (!range.valid)
        return errorState(range.error ?? "Invalid angle range");
      if (!(energy > 0))
        return errorState("Energy must be greater than zero");

      const thetasMrad: number[] = [];
      for (let a = angleStart; a <= angleEnd; a += angleStep) {
        thetasMrad.push(a);
      }
      const thetaRad = new Float64Array(thetasMrad.map((t) => t * 0.001));
      const traces: PlotTrace[] = [];

      for (const mat of materialsToPlot) {
        const refl = calcAngleScan(mat.formula, mat.density, thetaRad);
        if (refl) {
          traces.push({
            x: thetasMrad,
            y: refl,
            name: `${mat.formula} (ρ=${mat.density})`,
          });
        }
      }
      if (!traces.length)
        return errorState(
          "Could not calculate reflectivity for any material",
        );
      return readyState(traces);
    }

    const range = validateRange(energyStart, energyEnd, energyStep, 50000);
    if (!range.valid)
      return errorState(range.error ?? "Invalid energy range");
    if (!(fixedAngle > 0))
      return errorState("Grazing angle must be greater than zero");

    const energies: number[] = [];
    for (let e = energyStart; e <= energyEnd; e += energyStep) {
      energies.push(e);
    }

    const traces: PlotTrace[] = [];
    for (const mat of materialsToPlot) {
      try {
        const refls = calcEnergyScan(mat.formula, mat.density, energies);
        traces.push({
          x: energies,
          y: refls,
          name: `${mat.formula} (ρ=${mat.density})`,
        });
      } catch {
        // ignore invalid material
      }
    }
    if (!traces.length)
      return errorState(
        "Could not calculate reflectivity for any material",
      );
    return readyState(traces);
  }, [
    ready,
    materialsToPlot,
    roughness,
    plotMode,
    angleStart,
    angleEnd,
    angleStep,
    energy,
    calcAngleScan,
    energyStart,
    energyEnd,
    energyStep,
    fixedAngle,
    calcEnergyScan,
  ]);

  // Critical angle annotations
  const criticalAngleAnnotations: PlotAnnotation[] = useMemo(() => {
    if (!ready || plotMode !== "angle") return [];
    const annotations: PlotAnnotation[] = [];
    for (const mat of materialsToPlot) {
      try {
        const db = xray_delta_beta(mat.formula, mat.density, energy) as {
          delta: number;
        };
        const thetaC = Math.sqrt(2 * db.delta) * 1000; // mrad
        annotations.push({
          x: thetaC,
          text: `θc ${mat.formula}`,
        });
      } catch {
        // skip
      }
    }
    return annotations;
  }, [ready, plotMode, materialsToPlot, energy]);

  // Primary material name for title
  const primaryName = useMemo(() => {
    if (materialsToPlot.length === 1) return materialsToPlot[0].formula;
    return null;
  }, [materialsToPlot]);

  if (!ready) {
    return <LoadingState />;
  }

  return (
    <div>
      <PageHeader
        title="Mirror Reflectivity"
        description="Calculate X-ray mirror reflectivity as a function of angle or energy."
      />

      <div className="mb-6 grid gap-6 grid-cols-1 lg:grid-cols-[350px_1fr]">
        {/* Controls */}
        <div className="order-2 space-y-4 lg:order-none">
          {/* Plot mode toggle — R vs Energy first (left) */}
          <div>
            <label className="mb-1 block text-sm font-medium">Plot Mode</label>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setPlotMode("energy")}
                aria-pressed={plotMode === "energy"}
                className={`flex-1 rounded px-3 py-2 text-sm ${
                  plotMode === "energy"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                R vs Energy
              </button>
              <button
                type="button"
                onClick={() => setPlotMode("angle")}
                aria-pressed={plotMode === "angle"}
                className={`flex-1 rounded px-3 py-2 text-sm ${
                  plotMode === "angle"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                R vs Angle
              </button>
            </div>
          </div>

          {/* Mirror coatings — toggle buttons */}
          <div>
            <label className="mb-1 block text-sm font-medium">
              Mirror Coatings
            </label>
            <div className="flex flex-wrap gap-1">
              {MIRROR_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => togglePreset(p.label)}
                  aria-pressed={activePresets.has(p.label)}
                  className={`rounded px-2.5 py-1 text-xs font-medium ${
                    activePresets.has(p.label)
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom material picker */}
          <MaterialPicker
            onSelect={handleMaterialSelect}
            label="Add Custom Material"
          />

          {/* Custom materials list */}
          {customMaterials.length > 0 && (
            <div className="space-y-1">
              {customMaterials.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded border border-border px-2 py-1 text-xs"
                >
                  <span>
                    {m.formula} (ρ={m.density})
                  </span>
                  <button
                    type="button"
                    onClick={() => removeCustom(m.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {plotMode === "angle" ? (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Energy (eV)
                </label>
                <input
                  type="number"
                  value={energy}
                  step={100}
                  onChange={(e) => setEnergy(Number(e.target.value))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Angle Range (mrad)
                </label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs text-muted-foreground">
                      Start
                    </label>
                    <input
                      type="number"
                      value={angleStart}
                      step={0.1}
                      min={0.01}
                      onChange={(e) => setAngleStart(Number(e.target.value))}
                      className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground">
                      End
                    </label>
                    <input
                      type="number"
                      value={angleEnd}
                      step={1}
                      onChange={(e) => setAngleEnd(Number(e.target.value))}
                      className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground">
                      Step
                    </label>
                    <input
                      type="number"
                      value={angleStep}
                      step={0.01}
                      min={0.001}
                      onChange={(e) => setAngleStep(Number(e.target.value))}
                      className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Grazing Angle (mrad)
                </label>
                <input
                  type="number"
                  value={fixedAngle}
                  step={0.1}
                  min={0.01}
                  onChange={(e) => setFixedAngle(Number(e.target.value))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Energy Range (eV)
                </label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs text-muted-foreground">
                      Start
                    </label>
                    <input
                      type="number"
                      value={energyStart}
                      step={100}
                      min={100}
                      onChange={(e) => setEnergyStart(Number(e.target.value))}
                      className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground">
                      End
                    </label>
                    <input
                      type="number"
                      value={energyEnd}
                      step={1000}
                      onChange={(e) => setEnergyEnd(Number(e.target.value))}
                      className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted-foreground">
                      Step
                    </label>
                    <input
                      type="number"
                      value={energyStep}
                      step={10}
                      min={1}
                      onChange={(e) => setEnergyStep(Number(e.target.value))}
                      className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium">
              Roughness (&Aring;)
            </label>
            <input
              type="number"
              value={roughness}
              step={0.5}
              min={0}
              onChange={(e) => setRoughness(Number(e.target.value))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Polarization
            </label>
            <select
              value={polarization}
              onChange={(e) => setPolarization(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="s">s (sigma)</option>
              <option value="p">p (pi)</option>
              <option value="unpolarized">Unpolarized</option>
            </select>
          </div>

          {traceState.error && <ErrorBanner message={traceState.error} />}
        </div>

        {/* Plot */}
        <div className="order-1 lg:order-none">
          <ScientificPlot
            traces={traceState.data ?? []}
            xTitle={
              plotMode === "angle" ? "Grazing angle (mrad)" : "Energy (eV)"
            }
            yTitle="Reflectivity"
            title={
              plotMode === "angle"
                ? primaryName
                  ? `Mirror Reflectivity — ${primaryName} at ${energy} eV`
                  : `Mirror Reflectivity at ${energy} eV`
                : primaryName
                  ? `Mirror Reflectivity — ${primaryName} at ${fixedAngle} mrad`
                  : `Mirror Reflectivity at ${fixedAngle} mrad`
            }
            defaultLogY
            verticalLines={
              plotMode === "angle" ? criticalAngleAnnotations : undefined
            }
          />
        </div>
      </div>
    </div>
  );
}
