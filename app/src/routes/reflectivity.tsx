import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useCallback } from "react";
import { useWasm } from "~/hooks/useWasm";
import { mirror_reflectivity, xray_delta_beta } from "~/lib/wasm-api";
import { ScientificPlot } from "~/components/plot/ScientificPlot";
import type {
  PlotTrace,
  PlotAnnotation,
} from "~/components/plot/ScientificPlot";
import { MaterialPicker } from "~/components/material-picker/MaterialPicker";

export const Route = createFileRoute("/reflectivity")({
  component: ReflectivityPage,
});

interface CoatingLayer {
  id: number;
  formula: string;
  density: number;
  label: string;
}

const MIRROR_PRESETS = [
  { label: "Si", formula: "Si", density: 2.33 },
  { label: "SiO2", formula: "SiO2", density: 2.2 },
  { label: "Pt", formula: "Pt", density: 21.45 },
  { label: "Rh", formula: "Rh", density: 12.41 },
  { label: "Ni", formula: "Ni", density: 8.9 },
  { label: "Cr", formula: "Cr", density: 7.19 },
];

const COMPARE_PRESETS = [
  { formula: "Si", density: 2.33 },
  { formula: "Ni", density: 8.9 },
  { formula: "Rh", density: 12.41 },
  { formula: "Pt", density: 21.45 },
];

type PlotMode = "angle" | "energy";

let nextId = 1;

function ReflectivityPage() {
  const ready = useWasm();

  const [formula, setFormula] = useState("Si");
  const [density, setDensity] = useState(2.33);
  const [energy, setEnergy] = useState(10000);
  const [roughness, setRoughness] = useState(0);
  const [polarization, setPolarization] = useState("s");
  const [plotMode, setPlotMode] = useState<PlotMode>("energy");

  // Angle scan params
  const [angleStart, setAngleStart] = useState(0.1);
  const [angleEnd, setAngleEnd] = useState(10);
  const [angleStep, setAngleStep] = useState(0.02);

  // Energy scan params
  const [fixedAngle, setFixedAngle] = useState(2.0); // mrad
  const [energyStart, setEnergyStart] = useState(1000);
  const [energyEnd, setEnergyEnd] = useState(50000);
  const [energyStep, setEnergyStep] = useState(100);

  const [overlays, setOverlays] = useState<CoatingLayer[]>([]);
  const [compareMode, setCompareMode] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleMaterialSelect = useCallback((f: string, d: number) => {
    setFormula(f);
    setDensity(d);
    setCompareMode(false);
  }, []);

  const addOverlay = useCallback(() => {
    if (!formula.trim()) return;
    setOverlays((prev) => [
      ...prev,
      {
        id: nextId++,
        formula: formula.trim(),
        density,
        label: `${formula.trim()} (ρ=${density})`,
      },
    ]);
  }, [formula, density]);

  const removeOverlay = useCallback((id: number) => {
    setOverlays((prev) => prev.filter((o) => o.id !== id));
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

  // Materials to plot
  const materialsToPlot = useMemo(() => {
    if (compareMode) return COMPARE_PRESETS;
    const items = [{ formula: formula.trim(), density }];
    for (const ov of overlays) {
      items.push({ formula: ov.formula, density: ov.density });
    }
    return items.filter((m) => m.formula);
  }, [compareMode, formula, density, overlays]);

  // Angle scan traces
  const angleTraces: PlotTrace[] = useMemo(() => {
    if (!ready || plotMode !== "angle") return [];
    setError(null);

    const thetasMrad: number[] = [];
    for (let a = angleStart; a <= angleEnd; a += angleStep) {
      thetasMrad.push(a);
    }
    if (thetasMrad.length === 0) return [];

    const thetaRad = new Float64Array(thetasMrad.map((t) => t * 0.001));
    const result: PlotTrace[] = [];

    for (const mat of materialsToPlot) {
      const refl = calcAngleScan(mat.formula, mat.density, thetaRad);
      if (refl) {
        result.push({
          x: thetasMrad,
          y: refl,
          name: `${mat.formula} (ρ=${mat.density})`,
        });
      }
    }

    if (result.length === 0 && !compareMode) {
      setError("Could not calculate reflectivity for any material");
    }

    return result;
  }, [
    ready,
    plotMode,
    materialsToPlot,
    calcAngleScan,
    angleStart,
    angleEnd,
    angleStep,
  ]);

  // Energy scan traces
  const energyTraces: PlotTrace[] = useMemo(() => {
    if (!ready || plotMode !== "energy") return [];
    setError(null);

    const energies: number[] = [];
    for (let e = energyStart; e <= energyEnd; e += energyStep) {
      energies.push(e);
    }
    if (energies.length === 0) return [];

    const result: PlotTrace[] = [];

    for (const mat of materialsToPlot) {
      try {
        const refls = calcEnergyScan(mat.formula, mat.density, energies);
        result.push({
          x: energies,
          y: refls,
          name: `${mat.formula} (ρ=${mat.density})`,
        });
      } catch {
        // skip
      }
    }

    return result;
  }, [
    ready,
    plotMode,
    materialsToPlot,
    calcEnergyScan,
    energyStart,
    energyEnd,
    energyStep,
  ]);

  const traces = plotMode === "angle" ? angleTraces : energyTraces;

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

  // Critical angle display for single material
  const criticalAngle = useMemo(() => {
    if (!ready || !formula.trim() || compareMode) return null;
    try {
      const db = xray_delta_beta(formula.trim(), density, energy) as {
        delta: number;
      };
      return Math.sqrt(2 * db.delta) * 1000;
    } catch {
      return null;
    }
  }, [ready, formula, density, energy, compareMode]);

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
      <h1 className="mb-4 text-xl font-bold md:text-2xl">Mirror Reflectivity</h1>
      <p className="mb-6 text-muted-foreground">
        Calculate X-ray mirror reflectivity as a function of angle or energy.
      </p>

      <div className="mb-6 grid gap-6 grid-cols-1 lg:grid-cols-[350px_1fr]">
        {/* Controls */}
        <div className="order-2 space-y-4 lg:order-none">
          {/* Plot mode toggle */}
          <div>
            <label className="mb-1 block text-sm font-medium">Plot Mode</label>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setPlotMode("angle")}
                className={`flex-1 rounded px-3 py-2 text-sm ${
                  plotMode === "angle"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                R vs Angle
              </button>
              <button
                type="button"
                onClick={() => setPlotMode("energy")}
                className={`flex-1 rounded px-3 py-2 text-sm ${
                  plotMode === "energy"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                R vs Energy
              </button>
            </div>
          </div>

          {/* Compare common mirrors */}
          <div>
            <button
              type="button"
              onClick={() => setCompareMode(!compareMode)}
              className={`w-full rounded px-3 py-2 text-sm font-medium ${
                compareMode
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {compareMode
                ? "Comparing: Si, Ni, Rh, Pt"
                : "Compare common mirrors"}
            </button>
          </div>

          {!compareMode && (
            <>
              {/* Quick presets */}
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Mirror Coating
                </label>
                <div className="mb-2 flex flex-wrap gap-1">
                  {MIRROR_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        setFormula(p.formula);
                        setDensity(p.density);
                      }}
                      className={`rounded px-2 py-1 text-xs font-medium ${formula === p.formula ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <MaterialPicker
                onSelect={handleMaterialSelect}
                label="Custom Material"
              />

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Formula
                  </label>
                  <input
                    type="text"
                    value={formula}
                    onChange={(e) => setFormula(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Density (g/cm&sup3;)
                  </label>
                  <input
                    type="number"
                    value={density}
                    step={0.01}
                    onChange={(e) => setDensity(Number(e.target.value))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
            </>
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

          {criticalAngle !== null && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <p className="text-sm">
                Critical angle:{" "}
                <span className="font-mono font-semibold text-primary">
                  {criticalAngle.toFixed(3)} mrad
                </span>
                <span className="ml-2 text-xs text-muted-foreground">
                  at {energy} eV
                </span>
              </p>
            </div>
          )}

          {/* Overlay materials (single material mode only) */}
          {!compareMode && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={addOverlay}
                className="rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
              >
                + Add to overlay
              </button>
              {overlays.map((o) => (
                <div
                  key={o.id}
                  className="flex items-center justify-between rounded border border-border px-2 py-1 text-xs"
                >
                  <span>{o.label}</span>
                  <button
                    type="button"
                    onClick={() => removeOverlay(o.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        {/* Plot */}
        <div className="order-1 lg:order-none">
        <ScientificPlot
          traces={traces}
          xTitle={
            plotMode === "angle" ? "Grazing angle (mrad)" : "Energy (eV)"
          }
          yTitle="Reflectivity"
          title={
            plotMode === "angle"
              ? compareMode
                ? `Mirror Reflectivity at ${energy} eV`
                : `Mirror Reflectivity — ${formula} at ${energy} eV`
              : compareMode
                ? `Mirror Reflectivity at ${fixedAngle} mrad`
                : `Mirror Reflectivity — ${formula} at ${fixedAngle} mrad`
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
