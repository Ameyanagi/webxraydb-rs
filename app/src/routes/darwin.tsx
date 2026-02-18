import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useWasm } from "~/hooks/useWasm";
import { darwin_width } from "~/lib/wasm-api";
import { errorState, type CalculationState, readyState } from "~/lib/ui-state";
import { ScientificPlot } from "~/components/plot/ScientificPlot";
import type { PlotTrace } from "~/components/plot/ScientificPlot";
import { LoadingState } from "~/components/ui/LoadingState";
import { ErrorBanner } from "~/components/ui/ErrorBanner";
import { PageHeader } from "~/components/ui/PageHeader";

export const Route = createFileRoute("/darwin")({
  component: DarwinWidthPage,
});

const CRYSTAL_PRESETS = [
  { crystal: "Si", h: 1, k: 1, l: 1, label: "Si(111)" },
  { crystal: "Si", h: 2, k: 2, l: 0, label: "Si(220)" },
  { crystal: "Si", h: 3, k: 1, l: 1, label: "Si(311)" },
  { crystal: "Si", h: 4, k: 0, l: 0, label: "Si(400)" },
  { crystal: "Si", h: 3, k: 3, l: 1, label: "Si(331)" },
  { crystal: "Si", h: 5, k: 1, l: 1, label: "Si(511)" },
  { crystal: "Si", h: 3, k: 3, l: 3, label: "Si(333)" },
  { crystal: "Si", h: 4, k: 4, l: 0, label: "Si(440)" },
  { crystal: "Ge", h: 1, k: 1, l: 1, label: "Ge(111)" },
  { crystal: "Ge", h: 2, k: 2, l: 0, label: "Ge(220)" },
  { crystal: "Ge", h: 3, k: 1, l: 1, label: "Ge(311)" },
  { crystal: "Ge", h: 4, k: 0, l: 0, label: "Ge(400)" },
  { crystal: "C", h: 1, k: 1, l: 1, label: "C(111)" },
  { crystal: "C", h: 2, k: 2, l: 0, label: "C(220)" },
];

function DarwinWidthPage() {
  const ready = useWasm();

  const [crystal, setCrystal] = useState("Si");
  const [h, setH] = useState(1);
  const [k, setK] = useState(1);
  const [l, setL] = useState(1);
  const [energy, setEnergy] = useState(10000);
  const [polarization, setPolarization] = useState("s");

  const resultState = useMemo<
    CalculationState<{
      theta: number;
      theta_offset: number;
      theta_width: number;
      theta_fwhm: number;
      rocking_theta_fwhm: number;
      energy_width: number;
      energy_fwhm: number;
      rocking_energy_fwhm: number;
      zeta: number[];
      dtheta: number[];
      denergy: number[];
      intensity: number[];
      rocking_curve: number[];
    }>
  >(() => {
    if (!ready) return { status: "idle", data: null, error: null };
    if (!(energy > 0)) return errorState("Energy must be greater than zero");
    if (h < 0 || k < 0 || l < 0) return errorState("h, k, l must be non-negative");

    try {
      const dw = darwin_width(energy, crystal, h, k, l, polarization) as
        | {
            theta: number;
            theta_offset: number;
            theta_width: number;
            theta_fwhm: number;
            rocking_theta_fwhm: number;
            energy_width: number;
            energy_fwhm: number;
            rocking_energy_fwhm: number;
            zeta: number[];
            dtheta: number[];
            denergy: number[];
            intensity: number[];
            rocking_curve: number[];
          }
        | null;
      if (!dw) {
        return {
          status: "idle",
          data: null,
          error: null,
        };
      }
      return readyState(dw);
    } catch (e: unknown) {
      return errorState(e instanceof Error ? e.message : String(e));
    }
  }, [ready, crystal, h, k, l, energy, polarization]);

  const result = resultState.data;

  // Single-bounce reflectivity curve
  const singleBounceTraces: PlotTrace[] = useMemo(() => {
    if (!result) return [];
    return [
      {
        x: result.dtheta.map((dt) => dt * 1e6), // rad → μrad
        y: Array.from(result.intensity),
        name: "Single bounce",
      },
    ];
  }, [result]);

  // Rocking curve (double-bounce)
  const rockingTraces: PlotTrace[] = useMemo(() => {
    if (!result) return [];
    return [
      {
        x: result.dtheta.map((dt) => dt * 1e6), // rad → μrad
        y: Array.from(result.rocking_curve),
        name: "Rocking curve (2-bounce)",
      },
    ];
  }, [result]);

  // Energy width plot
  const energyTraces: PlotTrace[] = useMemo(() => {
    if (!result) return [];
    return [
      {
        x: Array.from(result.denergy),
        y: Array.from(result.intensity),
        name: "Single bounce",
      },
      {
        x: Array.from(result.denergy),
        y: Array.from(result.rocking_curve),
        name: "Rocking curve",
        line: { dash: "dot", width: 2 },
      },
    ];
  }, [result]);

  if (!ready) {
    return <LoadingState />;
  }

  return (
    <div>
      <PageHeader
        title="Darwin Width"
        description="Calculate crystal monochromator Darwin widths, reflectivity curves, and energy resolution."
      />

      <div className="mb-6 grid gap-6 grid-cols-1 lg:grid-cols-[350px_1fr]">
        {/* Controls */}
        <div className="order-2 space-y-4 lg:order-none">
          {/* Crystal reflection dropdown */}
          <div>
            <label className="mb-1 block text-sm font-medium">
              Crystal Reflection
            </label>
            <select
              value={
                CRYSTAL_PRESETS.find(
                  (p) =>
                    p.crystal === crystal &&
                    p.h === h &&
                    p.k === k &&
                    p.l === l,
                )?.label ?? "custom"
              }
              onChange={(e) => {
                const preset = CRYSTAL_PRESETS.find(
                  (p) => p.label === e.target.value,
                );
                if (preset) {
                  setCrystal(preset.crystal);
                  setH(preset.h);
                  setK(preset.k);
                  setL(preset.l);
                }
              }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {CRYSTAL_PRESETS.map((p) => (
                <option key={p.label} value={p.label}>
                  {p.label}
                </option>
              ))}
              {!CRYSTAL_PRESETS.find(
                (p) =>
                  p.crystal === crystal &&
                  p.h === h &&
                  p.k === k &&
                  p.l === l,
              ) && (
                <option value="custom">
                  Custom — {crystal}({h}{k}{l})
                </option>
              )}
            </select>
          </div>

          {/* Custom crystal / Miller index inputs */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Crystal</label>
              <select
                value={crystal}
                onChange={(e) => setCrystal(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="Si">Si</option>
                <option value="Ge">Ge</option>
                <option value="C">C (Diamond)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">h</label>
              <input
                type="number"
                value={h}
                min={0}
                onChange={(e) => setH(Number(e.target.value))}
                className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">k</label>
              <input
                type="number"
                value={k}
                min={0}
                onChange={(e) => setK(Number(e.target.value))}
                className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">l</label>
              <input
                type="number"
                value={l}
                min={0}
                onChange={(e) => setL(Number(e.target.value))}
                className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

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

          {resultState.error && <ErrorBanner message={resultState.error} />}

          {/* Results table */}
          {result && (
            <div className="rounded-lg border border-border bg-card p-4">
              <h2 className="mb-3 text-lg font-semibold">
                {crystal}({h}{k}{l}) at {(energy / 1000).toFixed(3)} keV
              </h2>
              <table className="w-full text-sm">
                <tbody>
                  <TableRow
                    label="Bragg angle"
                    value={`${toDeg(result.theta).toFixed(4)}°`}
                  />
                  <TableRow
                    label="Darwin width (FWHM)"
                    value={`${(result.theta_fwhm * 1e6).toFixed(3)} μrad`}
                  />
                  <TableRow
                    label="Rocking FWHM"
                    value={`${(result.rocking_theta_fwhm * 1e6).toFixed(3)} μrad`}
                  />
                  <TableRow
                    label="Energy width (FWHM)"
                    value={`${result.energy_fwhm.toFixed(4)} eV`}
                  />
                  <TableRow
                    label="Rocking energy FWHM"
                    value={`${result.rocking_energy_fwhm.toFixed(4)} eV`}
                  />
                  <TableRow
                    label="ΔE/E"
                    value={`${(result.energy_fwhm / energy).toExponential(3)}`}
                  />
                  <TableRow
                    label="Refraction offset"
                    value={`${(result.theta_offset * 1e6).toFixed(3)} μrad`}
                  />
                </tbody>
              </table>
            </div>
          )}

          {!result && !resultState.error && (
            <div className="rounded-lg border border-border/50 bg-card/50 p-4 text-center text-sm text-muted-foreground">
              Bragg condition cannot be satisfied at this energy.
            </div>
          )}
        </div>

        {/* Plots */}
        {result && (
          <div className="order-1 space-y-4 lg:order-none">
            <ScientificPlot
              traces={singleBounceTraces}
              xTitle="Δθ (μrad)"
              yTitle="Reflectivity"
              title={`Single-bounce — ${crystal}(${h}${k}${l})`}
              height={300}
              showLogToggle={false}
            />
            <ScientificPlot
              traces={rockingTraces}
              xTitle="Δθ (μrad)"
              yTitle="Reflectivity"
              title={`Rocking curve — ${crystal}(${h}${k}${l})`}
              height={300}
              showLogToggle={false}
            />
            <ScientificPlot
              traces={energyTraces}
              xTitle="ΔE (eV)"
              yTitle="Reflectivity"
              title={`Energy resolution — ${crystal}(${h}${k}${l})`}
              height={300}
              showLogToggle={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function TableRow({ label, value }: { label: string; value: string }) {
  return (
    <tr className="border-b border-border/30 last:border-0">
      <td className="py-1.5 pr-4 text-muted-foreground">{label}</td>
      <td className="py-1.5 font-mono font-medium">{value}</td>
    </tr>
  );
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}
