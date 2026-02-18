import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useCallback } from "react";
import { useWasm } from "~/hooks/useWasm";
import {
  ionchamber_fluxes,
  ionization_potential,
  compton_energies,
  material_mu,
} from "~/lib/wasm-api";
import { errorState, type CalculationState, readyState } from "~/lib/ui-state";
import {
  rebalanceForAddedGas,
  removeGasAndRedistribute,
  updateGasFractionBalanced,
  type GasEntry,
} from "~/lib/ionchamber-mix";
import { downloadCsv } from "~/lib/csv-export";
import { LoadingState } from "~/components/ui/LoadingState";
import { ErrorBanner } from "~/components/ui/ErrorBanner";
import { PageHeader } from "~/components/ui/PageHeader";

export const Route = createFileRoute("/ionchamber")({
  component: IonChamberPage,
});

const GASES = ["He", "N2", "Ne", "Ar", "Kr", "Xe"];

const CHAMBER_PRESETS = [
  { label: "6 cm (NSLS-II)", length: 6 },
  { label: "10 cm", length: 10 },
  { label: "15 cm (standard)", length: 15 },
  { label: "24 cm", length: 24 },
  { label: "30 cm", length: 30 },
  { label: "45 cm", length: 45 },
];

// Common target absorption percentages for I0 and It
const ABSORPTION_TARGETS = [
  { label: "10%", value: 10 },
  { label: "15%", value: 15 },
  { label: "20%", value: 20 },
  { label: "50%", value: 50 },
  { label: "80%", value: 80 },
  { label: "90%", value: 90 },
];

function IonChamberPage() {
  const ready = useWasm();

  const [gases, setGases] = useState<GasEntry[]>([
    { name: "He", fraction: 0 },
    { name: "N2", fraction: 1.0 },
  ]);
  const [energy, setEnergy] = useState(10000);
  const [length, setLength] = useState(15);
  const [pressure, setPressure] = useState(760);
  const [voltage, setVoltage] = useState(1.0);
  const [sensitivity, setSensitivity] = useState(1e-6);
  const [withCompton, setWithCompton] = useState(true);
  const [bothCarriers, setBothCarriers] = useState(false);

  const addGas = () => {
    const used = new Set(gases.map((g) => g.name));
    const next = GASES.find((g) => !used.has(g));
    if (!next) return;
    setGases((prev) => rebalanceForAddedGas(prev, next, 0.1));
  };

  const removeGas = (idx: number) => {
    setGases((prev) => removeGasAndRedistribute(prev, idx));
  };

  const updateGas = useCallback(
    (idx: number, field: "name" | "fraction", val: string | number) => {
      setGases((prev) => {
        if (field === "name") {
          return prev.map((gas, i) =>
            i === idx ? { ...gas, name: String(val) } : gas,
          );
        }
        const numericVal =
          typeof val === "number" ? val : Number.parseFloat(val) || 0;
        return updateGasFractionBalanced(prev, idx, numericVal);
      });
    },
    [],
  );

  // Calculate total fraction for display
  const totalFraction = gases.reduce((sum, g) => sum + g.fraction, 0);

  // Effective length scaled by pressure
  const effectiveLength = length * (pressure / 760);

  const resultState = useMemo<
    CalculationState<{
      incident: number;
      transmitted: number;
      photo: number;
      incoherent: number;
      coherent: number;
      absorption: number;
    }>
  >(() => {
    if (!ready) return { status: "idle", data: null, error: null };
    if (!gases.length) return errorState("Add at least one gas to the chamber");
    if (!(energy > 0)) return errorState("Energy must be greater than zero");
    if (!(effectiveLength > 0)) return errorState("Effective length must be greater than zero");
    if (!(sensitivity > 0)) return errorState("Sensitivity must be greater than zero");

    try {
      const gasMixtures = gases
        .filter((g) => g.fraction > 0)
        .map((g) => ({ name: g.name, fraction: g.fraction }));
      if (!gasMixtures.length) return errorState("Set at least one gas fraction above zero");

      const flux = ionchamber_fluxes(
        gasMixtures,
        voltage,
        effectiveLength,
        energy,
        sensitivity,
        withCompton,
        bothCarriers,
      ) as {
        incident: number;
        transmitted: number;
        photo: number;
        incoherent: number;
        coherent: number;
      };

      const absorption =
        flux.incident > 0
          ? ((flux.incident - flux.transmitted) / flux.incident) * 100
          : 0;

      return readyState({ ...flux, absorption });
    } catch (e: unknown) {
      return errorState(e instanceof Error ? e.message : String(e));
    }
  }, [
    ready,
    gases,
    energy,
    effectiveLength,
    voltage,
    sensitivity,
    withCompton,
    bothCarriers,
  ]);

  // Per-gas absorption percentages for the visual bar
  const gasAbsorptions = useMemo(() => {
    if (!ready || gases.length === 0) return [];
    const energies = new Float64Array([energy]);
    return gases.map((g) => {
      if (g.fraction <= 0) return { name: g.name, fraction: g.fraction, absorption: 0, mu: 0 };
      try {
        const mu = material_mu(g.name, 0.001, energies, "total") as Float64Array;
        const muContrib = mu[0] * g.fraction;
        const abs = (1 - Math.exp(-muContrib * effectiveLength)) * 100;
        return { name: g.name, fraction: g.fraction, absorption: abs, mu: muContrib };
      } catch {
        return { name: g.name, fraction: g.fraction, absorption: 0, mu: 0 };
      }
    });
  }, [ready, gases, energy, effectiveLength]);

  // Total absorption for the bar
  const totalAbsorption = useMemo(() => {
    if (!ready || gases.length === 0) return 0;
    const energies = new Float64Array([energy]);
    let totalMu = 0;
    for (const g of gases) {
      if (g.fraction <= 0) continue;
      try {
        const mu = material_mu(g.name, 0.001, energies, "total") as Float64Array;
        totalMu += mu[0] * g.fraction;
      } catch {
        // skip
      }
    }
    return (1 - Math.exp(-totalMu * effectiveLength)) * 100;
  }, [ready, gases, energy, effectiveLength]);

  const comptonResult = useMemo(() => {
    if (!ready || energy <= 0) return null;
    try {
      return compton_energies(energy) as {
        xray_90deg: number;
        xray_mean: number;
        electron_mean: number;
      };
    } catch {
      return null;
    }
  }, [ready, energy]);

  const ionPotentials = useMemo(() => {
    if (!ready) return {};
    const result: Record<string, number> = {};
    for (const g of GASES) {
      try {
        result[g] = ionization_potential(g) as number;
      } catch {
        // skip
      }
    }
    return result;
  }, [ready]);

  if (!ready) {
    return <LoadingState />;
  }

  const GAS_COLORS: Record<string, string> = {
    He: "#60a5fa", // blue-400
    N2: "#34d399", // emerald-400
    Ne: "#f472b6", // pink-400
    Ar: "#a78bfa", // violet-400
    Kr: "#fb923c", // orange-400
    Xe: "#facc15", // yellow-400
  };

  const result = resultState.data;

  return (
    <div>
      <PageHeader
        title="Ion Chamber"
        description="Calculate incident and transmitted X-ray flux from ion chamber readings."
      />

      <div className="mb-6 grid gap-6 grid-cols-1 lg:grid-cols-[400px_1fr]">
        {/* Controls */}
        <div className="order-2 space-y-4 lg:order-none">
          {/* Gas mixture with sliders */}
          <div>
            <label className="mb-2 block text-sm font-medium">
              Gas Mixture
            </label>
            <div className="space-y-3">
              {gases.map((g, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <select
                      value={g.name}
                      onChange={(e) => updateGas(i, "name", e.target.value)}
                      className="w-20 rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {GASES.map((gas) => (
                        <option key={gas} value={gas}>
                          {gas}
                        </option>
                      ))}
                    </select>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={g.fraction}
                      onChange={(e) =>
                        updateGas(i, "fraction", parseFloat(e.target.value))
                      }
                      className="flex-1"
                      style={{
                        accentColor: GAS_COLORS[g.name] ?? "#888",
                      }}
                    />
                    <input
                      type="number"
                      value={g.fraction}
                      min={0}
                      max={1}
                      step={0.05}
                      onChange={(e) => updateGas(i, "fraction", e.target.value)}
                      className="w-20 rounded-md border border-input bg-background px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    {gases.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeGas(i)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={addGas}
                className="rounded-md bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
              >
                + Add gas
              </button>
              <span
                className={`text-xs ${Math.abs(totalFraction - 1.0) > 0.01 ? "text-destructive" : "text-muted-foreground"}`}
              >
                Total: {totalFraction.toFixed(2)}
                {Math.abs(totalFraction - 1.0) > 0.01
                  ? " (should be 1.0)"
                  : ""}
              </span>
            </div>
          </div>

          {/* Absorption bar visualization */}
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">Absorption</span>
              <span className="font-mono text-sm font-semibold">
                {totalAbsorption.toFixed(1)}%
              </span>
            </div>
            {/* Stacked bar */}
            <div className="mb-2 flex h-6 overflow-hidden rounded-full bg-muted">
              {gasAbsorptions.map(
                (ga, i) =>
                  ga.absorption > 0.1 && (
                    <div
                      key={i}
                      className="flex items-center justify-center text-[10px] font-semibold text-white transition-all duration-200"
                      style={{
                        width: `${Math.min(ga.absorption, 100 - gasAbsorptions.slice(0, i).reduce((s, x) => s + x.absorption, 0))}%`,
                        backgroundColor: GAS_COLORS[ga.name] ?? "#888",
                      }}
                      title={`${ga.name}: ${ga.absorption.toFixed(1)}%`}
                    >
                      {ga.absorption > 3 ? `${ga.name}` : ""}
                    </div>
                  ),
              )}
              {/* Transmitted portion */}
              {totalAbsorption < 100 && (
                <div
                  className="flex items-center justify-center text-[10px] text-muted-foreground"
                  style={{ width: `${100 - totalAbsorption}%` }}
                >
                  {100 - totalAbsorption > 10
                    ? `${(100 - totalAbsorption).toFixed(0)}% transmitted`
                    : ""}
                </div>
              )}
            </div>
            {/* Target presets */}
            <div className="flex flex-wrap gap-1">
              {ABSORPTION_TARGETS.map((t) => (
                <span
                  key={t.value}
                  className={`rounded px-1.5 py-0.5 text-[10px] ${
                    Math.abs(totalAbsorption - t.value) < 2
                      ? "bg-primary/20 text-primary font-semibold"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {t.label}
                </span>
              ))}
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
              Chamber Length (cm)
            </label>
            <div className="mb-1 flex flex-wrap gap-1">
              {CHAMBER_PRESETS.map((p) => (
                <button
                  key={p.length}
                  type="button"
                  onClick={() => setLength(p.length)}
                  className={`rounded px-2 py-0.5 text-xs ${length === p.length ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <input
              type="number"
              value={length}
              step={1}
              onChange={(e) => setLength(Number(e.target.value))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Gas Pressure (Torr)
            </label>
            <input
              type="range"
              min={100}
              max={2000}
              step={10}
              value={pressure}
              onChange={(e) => setPressure(Number(e.target.value))}
              className="mb-1 w-full"
            />
            <input
              type="number"
              value={pressure}
              step={10}
              min={1}
              max={2000}
              onChange={(e) => setPressure(Number(e.target.value))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Effective length: {effectiveLength.toFixed(1)} cm
              {pressure !== 760
                ? ` (${length} cm × ${(pressure / 760).toFixed(3)})`
                : ""}
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Voltage Reading (V)
            </label>
            <input
              type="number"
              value={voltage}
              step={0.1}
              onChange={(e) => setVoltage(Number(e.target.value))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Sensitivity (A/V)
            </label>
            <select
              value={sensitivity}
              onChange={(e) => setSensitivity(Number(e.target.value))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value={1e-3}>1 mA/V</option>
              <option value={1e-4}>100 &mu;A/V</option>
              <option value={1e-5}>10 &mu;A/V</option>
              <option value={1e-6}>1 &mu;A/V</option>
              <option value={1e-7}>100 nA/V</option>
              <option value={1e-8}>10 nA/V</option>
              <option value={1e-9}>1 nA/V</option>
              <option value={1e-10}>100 pA/V</option>
              <option value={1e-11}>10 pA/V</option>
              <option value={1e-12}>1 pA/V</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={withCompton}
                onChange={(e) => setWithCompton(e.target.checked)}
                className="rounded"
              />
              Include Compton scattering
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={bothCarriers}
                onChange={(e) => setBothCarriers(e.target.checked)}
                className="rounded"
              />
              Both charge carriers
            </label>
          </div>

          {resultState.error && <ErrorBanner message={resultState.error} />}
        </div>

        {/* Results */}
        <div className="order-1 space-y-4 lg:order-none">
          {result && (
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Flux Results</h2>
                <button
                  type="button"
                  onClick={() =>
                    downloadCsv(
                      "ionchamber.csv",
                      ["Property", "Value", "Unit"],
                      [
                        [
                          "Incident",
                          result.incident.toExponential(4),
                          "photons/s",
                        ],
                        [
                          "Transmitted",
                          result.transmitted.toExponential(4),
                          "photons/s",
                        ],
                        ["Absorption", result.absorption.toFixed(2), "%"],
                        [
                          "Photoelectric",
                          result.photo.toExponential(4),
                          "photons/s",
                        ],
                        [
                          "Incoherent",
                          result.incoherent.toExponential(4),
                          "photons/s",
                        ],
                        [
                          "Coherent",
                          result.coherent.toExponential(4),
                          "photons/s",
                        ],
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
                  label="Incident flux"
                  value={fmtFlux(result.incident)}
                  unit="photons/s"
                />
                <ResultCard
                  label="Transmitted flux"
                  value={fmtFlux(result.transmitted)}
                  unit="photons/s"
                />
                <ResultCard
                  label="Absorption"
                  value={`${result.absorption.toFixed(2)}%`}
                />
                <ResultCard
                  label="Photoelectric"
                  value={fmtFlux(result.photo)}
                  unit="photons/s"
                />
                <ResultCard
                  label="Incoherent"
                  value={fmtFlux(result.incoherent)}
                  unit="photons/s"
                />
                <ResultCard
                  label="Coherent"
                  value={fmtFlux(result.coherent)}
                  unit="photons/s"
                />
              </div>
            </div>
          )}

          {comptonResult && (
            <div className="rounded-lg border border-border bg-card p-4">
              <h2 className="mb-3 text-lg font-semibold">Compton Energies</h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <ResultCard
                  label="X-ray (90\u00B0)"
                  value={comptonResult.xray_90deg.toFixed(1)}
                  unit="eV"
                />
                <ResultCard
                  label="X-ray (mean)"
                  value={comptonResult.xray_mean.toFixed(1)}
                  unit="eV"
                />
                <ResultCard
                  label="Electron (mean)"
                  value={comptonResult.electron_mean.toFixed(1)}
                  unit="eV"
                />
              </div>
            </div>
          )}

          {/* Ionization potentials reference */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-3 text-lg font-semibold">
              Ionization Potentials
            </h2>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {GASES.map((g) => (
                <div key={g} className="rounded border border-border/50 p-2">
                  <p className="text-xs text-muted-foreground">{g}</p>
                  <p className="font-mono text-sm font-semibold">
                    {ionPotentials[g]?.toFixed(1) ?? "\u2014"} eV
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultCard({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="rounded border border-border/50 p-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-mono text-sm font-semibold">
        {value}
        {unit && (
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            {unit}
          </span>
        )}
      </p>
    </div>
  );
}

function fmtFlux(n: number): string {
  if (n === 0) return "0";
  return n.toExponential(3);
}
