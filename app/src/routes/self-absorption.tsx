import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useWasm } from "~/hooks/useWasm";
import { sa_fluo, sa_troger, sa_booth, sa_atoms } from "~/lib/wasm-api";
import { energyRange } from "~/lib/constants";
import { errorState, readyState, type CalculationState } from "~/lib/ui-state";
import { validateRange } from "~/lib/inputs";
import { ScientificPlot } from "~/components/plot/ScientificPlot";
import type { PlotTrace } from "~/components/plot/ScientificPlot";
import { FormulaInput } from "~/components/formula-input/FormulaInput";
import { EnergyRangeInput } from "~/components/energy-range/EnergyRangeInput";
import { LoadingState } from "~/components/ui/LoadingState";
import { ErrorBanner } from "~/components/ui/ErrorBanner";
import { PageHeader } from "~/components/ui/PageHeader";

export const Route = createFileRoute("/self-absorption")({
  component: SelfAbsorptionPage,
});

type Algorithm = "fluo" | "troger" | "booth" | "atoms";

const ALGORITHMS: { value: Algorithm; label: string; description: string }[] = [
  { value: "fluo", label: "Fluo", description: "Haskel, Ravel, Stern — corrects \u03bc(E), works for XANES" },
  { value: "troger", label: "Tr\u00f6ger", description: "Tr\u00f6ger et al. (1992) — simple \u03c7(k) correction" },
  { value: "booth", label: "Booth", description: "Booth & Bridges (2005) — thin + thick samples" },
  { value: "atoms", label: "Atoms", description: "Ravel (2001) — amplitude + \u03c3\u00b2 correction" },
];

/** ETOK constant for energy-to-k conversion: k = sqrt(ETOK * (E - E0)). */
const ETOK = 0.2624682917;

interface SelfAbsData {
  /** Signal retained (%) vs energy. */
  energyTraces: PlotTrace[];
  /** Signal retained (%) vs k (only above-edge points). */
  kTraces: PlotTrace[];
  summary: SummaryInfo[];
}

interface SummaryInfo {
  algorithm: string;
  edgeEnergy: number;
  fluorEnergy: number;
  amplitude?: number;
  sigmaSquared?: number;
  sigmaSquaredSelf?: number;
  sigmaSquaredNorm?: number;
  sigmaSquaredI0?: number;
  sigmaSquaredNet?: number;
  beta?: number;
  gammaPrime?: number;
  isThick?: boolean;
}

const COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b"];

function SelfAbsorptionPage() {
  const ready = useWasm();

  const [formula, setFormula] = useState("Fe2O3");
  const [element, setElement] = useState("Fe");
  const [edge, setEdge] = useState("K");
  const [eStart, setEStart] = useState(7000);
  const [eEnd, setEEnd] = useState(8000);
  const [eStep, setEStep] = useState(2);
  const [thetaIn, setThetaIn] = useState(45);
  const [thetaOut, setThetaOut] = useState(45);
  const [thicknessUm, setThicknessUm] = useState(100000);
  const [selectedAlgos, setSelectedAlgos] = useState<Algorithm[]>([
    "troger",
    "booth",
    "atoms",
  ]);

  const toggleAlgo = (algo: Algorithm) => {
    setSelectedAlgos((prev) =>
      prev.includes(algo) ? prev.filter((a) => a !== algo) : [...prev, algo],
    );
  };

  const calcState = useMemo<CalculationState<SelfAbsData>>(() => {
    if (!ready) return { status: "idle", data: null, error: null };
    if (!formula.trim()) return errorState("Enter a chemical formula");
    if (!element.trim()) return errorState("Enter the absorbing element");
    if (!edge.trim()) return errorState("Enter the absorption edge");
    if (selectedAlgos.length === 0) return errorState("Select at least one algorithm");

    const range = validateRange(eStart, eEnd, eStep, 30000);
    if (!range.valid) return errorState(range.error ?? "Invalid energy range");

    try {
      const energies = energyRange(eStart, eEnd, eStep);
      const energyArr = Array.from(energies);
      const energyTraces: PlotTrace[] = [];
      const kTraces: PlotTrace[] = [];
      const summary: SummaryInfo[] = [];
      let colorIdx = 0;

      /** Filter to above-edge points and convert energy to k. */
      const toKTrace = (
        eArr: number[],
        pct: number[],
        edgeE: number,
        name: string,
        line: PlotTrace["line"],
      ) => {
        const kx: number[] = [];
        const ky: number[] = [];
        for (let i = 0; i < eArr.length; i++) {
          if (eArr[i] > edgeE) {
            kx.push(Math.sqrt(ETOK * (eArr[i] - edgeE)));
            ky.push(pct[i]);
          }
        }
        kTraces.push({ x: kx, y: ky, name, line });
      };

      for (const algo of selectedAlgos) {
        const color = COLORS[colorIdx % COLORS.length];
        colorIdx++;

        if (algo === "fluo") {
          const r = sa_fluo(
            formula.trim(),
            element.trim(),
            edge.trim(),
            energies,
            thetaIn,
            thetaOut,
          );
          const betaG = r.beta * r.ratio;
          const denomConst = betaG + r.gamma_prime + 1.0;
          const pct = (r.mu_background_norm as number[]).map(
            (bg: number) => (100 * (betaG + bg)) / denomConst,
          );
          const line = { color, width: 2 };
          energyTraces.push({ x: energyArr, y: pct, name: "Fluo", line });
          toKTrace(energyArr, pct, r.edge_energy, "Fluo", line);
          summary.push({
            algorithm: "Fluo",
            edgeEnergy: r.edge_energy,
            fluorEnergy: r.fluorescence_energy,
            beta: r.beta,
            gammaPrime: r.gamma_prime,
          });
        }

        if (algo === "troger") {
          const r = sa_troger(
            formula.trim(),
            element.trim(),
            edge.trim(),
            energies,
            thetaIn,
            thetaOut,
          );
          const pct = (r.s as number[]).map(
            (si: number) => (1 - si) * 100,
          );
          const line = { color, width: 2 };
          energyTraces.push({ x: energyArr, y: pct, name: "Tr\u00f6ger", line });
          toKTrace(energyArr, pct, r.edge_energy, "Tr\u00f6ger", line);
          summary.push({
            algorithm: "Tr\u00f6ger",
            edgeEnergy: r.edge_energy,
            fluorEnergy: r.fluorescence_energy,
          });
        }

        if (algo === "booth") {
          const r = sa_booth(
            formula.trim(),
            element.trim(),
            edge.trim(),
            energies,
            thetaIn,
            thetaOut,
            thicknessUm,
          );
          const pct = (r.s as number[]).map(
            (si: number) => (1 - si) * 100,
          );
          const name = `Booth (${r.is_thick ? "thick" : "thin"})`;
          const line = { color, width: 2, dash: "dash" as const };
          energyTraces.push({ x: energyArr, y: pct, name, line });
          toKTrace(energyArr, pct, r.edge_energy, name, line);
          summary.push({
            algorithm: "Booth",
            edgeEnergy: r.edge_energy,
            fluorEnergy: r.fluorescence_energy,
            isThick: r.is_thick,
          });
        }

        if (algo === "atoms") {
          const r = sa_atoms(
            formula.trim(),
            element.trim(),
            edge.trim(),
            energies,
          );
          const pct = (r.correction as number[]).map(
            (sigma: number) => (sigma > 0 ? 100 / sigma : 100),
          );
          const line = { color, width: 2, dash: "dot" as const };
          energyTraces.push({ x: energyArr, y: pct, name: "Atoms", line });
          toKTrace(energyArr, pct, r.edge_energy, "Atoms", line);
          summary.push({
            algorithm: "Atoms",
            edgeEnergy: r.edge_energy,
            fluorEnergy: r.fluorescence_energy,
            amplitude: r.amplitude,
            sigmaSquaredSelf: r.sigma_squared_self,
            sigmaSquaredNorm: r.sigma_squared_norm,
            sigmaSquaredI0: r.sigma_squared_i0,
            sigmaSquaredNet: r.sigma_squared_net,
          });
        }
      }

      return readyState({ energyTraces, kTraces, summary });
    } catch (e: unknown) {
      return errorState(e instanceof Error ? e.message : String(e));
    }
  }, [
    ready,
    formula,
    element,
    edge,
    eStart,
    eEnd,
    eStep,
    thetaIn,
    thetaOut,
    thicknessUm,
    selectedAlgos,
  ]);

  if (!ready) return <LoadingState />;

  return (
    <div>
      <PageHeader
        title="Self Absorption"
        description="Fluorescence self-absorption correction using 4 algorithms (Fluo, Tr\u00f6ger, Booth, Atoms)."
      />

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        {/* Controls */}
        <div className="order-2 space-y-4 lg:order-none">
          <FormulaInput value={formula} onChange={setFormula} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Absorber</label>
              <input
                type="text"
                value={element}
                onChange={(e) => setElement(e.target.value)}
                placeholder="e.g. Fe"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Edge</label>
              <select
                value={edge}
                onChange={(e) => setEdge(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="K">K</option>
                <option value="L3">L3</option>
                <option value="L2">L2</option>
                <option value="L1">L1</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Incident angle
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={thetaIn}
                  min={1}
                  max={89}
                  step={1}
                  onChange={(e) => setThetaIn(Number(e.target.value))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <span className="text-xs text-muted-foreground">deg</span>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Exit angle
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={thetaOut}
                  min={1}
                  max={89}
                  step={1}
                  onChange={(e) => setThetaOut(Number(e.target.value))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <span className="text-xs text-muted-foreground">deg</span>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Thickness (Booth)
            </label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={thicknessUm}
                min={1}
                step={100}
                onChange={(e) => setThicknessUm(Number(e.target.value))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <span className="text-xs text-muted-foreground">&mu;m</span>
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

          <div>
            <label className="mb-1 block text-sm font-medium">Algorithms</label>
            <div className="space-y-1">
              {ALGORITHMS.map((algo) => (
                <label
                  key={algo.value}
                  className="flex items-start gap-2 rounded border border-border/50 px-2 py-1.5"
                >
                  <input
                    type="checkbox"
                    checked={selectedAlgos.includes(algo.value)}
                    onChange={() => toggleAlgo(algo.value)}
                    className="mt-0.5"
                  />
                  <div>
                    <span className="text-sm font-medium">{algo.label}</span>
                    <p className="text-xs text-muted-foreground">
                      {algo.description}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {calcState.error && <ErrorBanner message={calcState.error} />}
        </div>

        {/* Results */}
        <div className="order-1 space-y-4 lg:order-none">
          <ScientificPlot
            traces={calcState.data?.energyTraces ?? []}
            xTitle="Energy (eV)"
            yTitle="Signal retained (%)"
            title="Self-absorption effect vs Energy (100% = no effect)"
            height={380}
            showLogToggle={false}
            yRange={[0, 105]}
          />

          <ScientificPlot
            traces={calcState.data?.kTraces ?? []}
            xTitle="k (\u00c5\u207b\u00b9)"
            yTitle="Signal retained (%)"
            title="Self-absorption effect vs k (100% = no effect)"
            height={380}
            showLogToggle={false}
            yRange={[0, 105]}
          />

          {calcState.data?.summary && calcState.data.summary.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold">Summary</h3>
              <div className="space-y-3">
                {calcState.data.summary.map((s) => (
                  <SummaryCard key={s.algorithm} info={s} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ info }: { info: SummaryInfo }) {
  return (
    <div className="rounded border border-border/50 p-3">
      <h4 className="mb-2 text-sm font-semibold">{info.algorithm}</h4>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <Stat label="Edge energy" value={`${info.edgeEnergy.toFixed(1)} eV`} />
        <Stat
          label="Fluorescence energy"
          value={`${info.fluorEnergy.toFixed(1)} eV`}
        />
        {info.amplitude != null && (
          <Stat label="Amplitude" value={info.amplitude.toFixed(4)} />
        )}
        {info.beta != null && (
          <Stat label="\u03b2" value={info.beta.toFixed(4)} />
        )}
        {info.gammaPrime != null && (
          <Stat label="\u03b3'" value={info.gammaPrime.toFixed(4)} />
        )}
        {info.isThick != null && (
          <Stat label="Sample limit" value={info.isThick ? "Thick" : "Thin"} />
        )}
        {info.sigmaSquaredSelf != null && (
          <Stat
            label={"\u03c3\u00b2 self"}
            value={`${info.sigmaSquaredSelf.toFixed(6)} \u00c5\u00b2`}
          />
        )}
        {info.sigmaSquaredNorm != null && (
          <Stat
            label={"\u03c3\u00b2 norm"}
            value={`${info.sigmaSquaredNorm.toFixed(6)} \u00c5\u00b2`}
          />
        )}
        {info.sigmaSquaredI0 != null && (
          <Stat
            label={"\u03c3\u00b2 I\u2080"}
            value={`${info.sigmaSquaredI0.toFixed(6)} \u00c5\u00b2`}
          />
        )}
        {info.sigmaSquaredNet != null && (
          <Stat
            label={"\u03c3\u00b2 net"}
            value={`${info.sigmaSquaredNet.toFixed(6)} \u00c5\u00b2`}
          />
        )}
      </div>
    </div>
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
