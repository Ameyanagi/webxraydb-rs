import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useCallback } from "react";
import { useWasm } from "~/hooks/useWasm";
import {
  sa_ameyanagi,
  sa_booth_reference,
  parse_formula,
  validate_formula,
  atomic_number,
  xray_edges,
  xray_edge_energy,
} from "~/lib/wasm-api";
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

/** ETOK constant for energy-to-k conversion: k = sqrt(ETOK * (E - E0)). */
const ETOK = 0.2624682917;

/** Convert k (Å⁻¹) to energy offset above edge (eV). E - E0 = k² / ETOK */
function kToEnergyOffset(k: number): number {
  return (k * k) / ETOK;
}

/** Extract heaviest element (by Z) from a formula string. */
function extractHeaviestElement(formula: string): string | null {
  if (!validate_formula(formula)) return null;
  try {
    const parsed = parse_formula(formula);
    const components = parsed.components as { symbol: string; count: number }[];
    if (components.length === 0) return null;
    let heaviest = components[0];
    let maxZ = 0;
    for (const c of components) {
      try {
        const z = atomic_number(c.symbol);
        if (z > maxZ) {
          maxZ = z;
          heaviest = c;
        }
      } catch {
        // skip invalid elements
      }
    }
    return heaviest.symbol;
  } catch {
    return null;
  }
}

/** Get available edges for an element, sorted by energy descending. */
function getAvailableEdges(
  el: string,
): { label: string; energy: number }[] | null {
  try {
    const edges = xray_edges(el) as {
      label: string;
      energy: number;
      fluorescence_yield: number;
      jump_ratio: number;
    }[];
    // Filter to edges with reasonable energy (> 100 eV)
    return edges
      .filter((e) => e.energy > 100)
      .sort((a, b) => b.energy - a.energy);
  } catch {
    return null;
  }
}

/** Compute energy range for a given element/edge. Returns [start, end]. */
function computeEnergyRange(
  el: string,
  edgeLabel: string,
  kMax: number = 15,
): [number, number] | null {
  try {
    const edgeE = xray_edge_energy(el, edgeLabel);
    const start = Math.max(Math.round(edgeE - 200), 100);
    // E at k_max
    const eKmax = edgeE + kToEnergyOffset(kMax);

    // Check if there's a next edge above this one
    const edges = getAvailableEdges(el);
    let end = Math.round(eKmax);
    if (edges) {
      // Find next edge above current
      const currentE = edgeE;
      for (const e of edges) {
        if (e.energy > currentE + 50 && e.label !== edgeLabel) {
          // Cap at next edge - 50 eV
          end = Math.min(end, Math.round(e.energy - 50));
          break;
        }
      }
      // edges are sorted descending, so reverse to find next higher
      const sorted = [...edges].sort((a, b) => a.energy - b.energy);
      for (const e of sorted) {
        if (e.energy > currentE + 50 && e.label !== edgeLabel) {
          end = Math.min(end, Math.round(e.energy - 50));
          break;
        }
      }
    }
    return [start, end];
  } catch {
    return null;
  }
}

interface SelfAbsData {
  /** Ameyanagi suppression ratio in percent: 100 * R(E, χ). */
  ameyanagiRTraces: PlotTrace[];
  summary: SummaryInfo[];
}

interface SummaryInfo {
  algorithm: string;
  edgeEnergy: number;
  fluorEnergy: number;
  rMin?: number;
  rMax?: number;
  rMean?: number;
  interpretation?: string;
  isThick?: boolean;
  thicknessCm?: number;
  geometryG?: number;
  chiAssumed?: number;
  muF?: number;
  betaPath?: number;
}

const COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#14b8a6"];

const EDGE_OPTIONS = ["K", "L3", "L2", "L1", "M5", "M4", "M3"] as const;

type ThicknessMode = "thickness" | "pellet";
type AmeyanagiChiMode = "single" | "sweep";
type PlotTraceMode = "ameyanagi" | "booth";

const AMEYANAGI_CHI_PRESETS = [0.05, 0.1, 0.2, 0.3] as const;
const AMEYANAGI_MAX_CHI_VALUES = 8;

/** Given an element, pick the best edge and return [availableEdges, bestEdge]. */
function pickEdge(el: string): [string[], string] {
  const edges = getAvailableEdges(el);
  if (!edges || edges.length === 0) return [["K"], "K"];
  const labels = edges.map((e) => e.label);
  const filtered = EDGE_OPTIONS.filter((e) => labels.includes(e));
  if (filtered.length === 0) return [["K"], "K"];
  // Pick lowest-energy common edge (last in EDGE_OPTIONS order, which lists high→low)
  return [[...filtered], filtered[filtered.length - 1]];
}

function resolveEdgeSelection(availableEdges: string[], previousEdge: string, fallbackEdge: string): string {
  if (availableEdges.includes(previousEdge)) return previousEdge;
  if (availableEdges.includes("K")) return "K";
  return fallbackEdge;
}

function classifySuppression(r: number): string {
  if (r > 0.9) return "Negligible";
  if (r >= 0.7) return "Moderate";
  if (r >= 0.5) return "Strong";
  return "Severe";
}

function formatChi(chi: number): string {
  return chi.toFixed(3).replace(/\.?0+$/, "");
}

function normalizeChiSweep(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  const deduped: number[] = [];
  for (const v of sorted) {
    if (deduped.length === 0 || Math.abs(v - deduped[deduped.length - 1]) > 1e-12) {
      deduped.push(v);
    }
  }
  return deduped;
}

function parseChiSweepList(input: string): { values: number[]; error: string | null } {
  const tokens = input
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    return { values: [], error: "Enter at least one comma-separated χ value" };
  }

  const parsed: number[] = [];
  for (const token of tokens) {
    const v = Number(token);
    if (!Number.isFinite(v)) {
      return { values: [], error: `Invalid χ value: ${token}` };
    }
    if (v <= 0) {
      return { values: [], error: "All χ values must be > 0" };
    }
    if (v > 1.0) {
      return { values: [], error: "χ values above 1.0 are not allowed in sweep mode" };
    }
    parsed.push(v);
  }

  const values = normalizeChiSweep(parsed);
  if (values.length > AMEYANAGI_MAX_CHI_VALUES) {
    return {
      values: [],
      error: `Too many χ values (max ${AMEYANAGI_MAX_CHI_VALUES})`,
    };
  }
  return { values, error: null };
}

function resolveThicknessCm(
  thicknessMode: ThicknessMode,
  thicknessCm: number,
  pelletMassG: number,
  pelletDiameterCm: number,
  densityGcm3: number,
): number {
  if (thicknessMode === "thickness") return thicknessCm;
  const area = Math.PI * (pelletDiameterCm * 0.5) ** 2;
  return pelletMassG / (densityGcm3 * area);
}

function SelfAbsorptionPage() {
  const ready = useWasm();

  const [formula, setFormula] = useState("Fe2O3");
  const [element, setElement] = useState("Fe");
  const [edge, setEdge] = useState("K");
  const [availableEdges, setAvailableEdges] = useState<string[]>(["K", "L3", "L2", "L1"]);
  const [eStart, setEStart] = useState(7000);
  const [eEnd, setEEnd] = useState(8000);
  const [eStep, setEStep] = useState(2);
  const [densityGcm3, setDensityGcm3] = useState(5.24);
  const [phiDeg, setPhiDeg] = useState(45);
  const [thetaDeg, setThetaDeg] = useState(45);
  const [chiAssumed, setChiAssumed] = useState(0.1);
  const [ameyanagiChiMode, setAmeyanagiChiMode] = useState<AmeyanagiChiMode>("single");
  const [chiSweepPresets, setChiSweepPresets] = useState<number[]>([...AMEYANAGI_CHI_PRESETS]);
  const [chiSweepCustomInput, setChiSweepCustomInput] = useState("");
  const [chiSweepCustomValues, setChiSweepCustomValues] = useState<number[]>([]);
  const [chiSweepCustomError, setChiSweepCustomError] = useState<string | null>(null);
  const [thicknessMode, setThicknessMode] = useState<ThicknessMode>("thickness");
  const [thicknessCm, setThicknessCm] = useState(0.01);
  const [pelletMassG, setPelletMassG] = useState(0.05);
  const [pelletDiameterCm, setPelletDiameterCm] = useState(1.0);
  const [plotTraceMode, setPlotTraceMode] = useState<PlotTraceMode>("ameyanagi");

  const toggleChiPreset = (chi: number) => {
    setChiSweepCustomError(null);
    setChiSweepPresets((prev) => {
      const next = prev.includes(chi) ? prev.filter((v) => v !== chi) : [...prev, chi];
      return normalizeChiSweep(next);
    });
  };

  const applyCustomChiSweep = () => {
    const parsed = parseChiSweepList(chiSweepCustomInput);
    if (parsed.error) {
      setChiSweepCustomError(parsed.error);
      setChiSweepCustomValues([]);
      return;
    }
    setChiSweepCustomError(null);
    setChiSweepCustomValues(parsed.values);
  };

  const clearCustomChiSweep = () => {
    setChiSweepCustomInput("");
    setChiSweepCustomValues([]);
    setChiSweepCustomError(null);
  };

  // Sync all derived state when formula changes
  const handleFormulaChange = useCallback(
    (newFormula: string) => {
      setFormula(newFormula);
      if (!ready) return;
      const detected = extractHeaviestElement(newFormula);
      if (detected) {
        setElement(detected);
        const [edges, bestEdge] = pickEdge(detected);
        setAvailableEdges(edges);
        const nextEdge = resolveEdgeSelection(edges, edge, bestEdge);
        setEdge(nextEdge);
        const range = computeEnergyRange(detected, nextEdge);
        if (range) {
          setEStart(range[0]);
          setEEnd(range[1]);
        }
      }
    },
    [ready, edge],
  );

  // Sync edge + energy range when element changes manually
  const handleElementChange = useCallback(
    (newElement: string) => {
      setElement(newElement);
      if (!ready || !newElement.trim()) return;
      const [edges, bestEdge] = pickEdge(newElement);
      setAvailableEdges(edges);
      const nextEdge = resolveEdgeSelection(edges, edge, bestEdge);
      setEdge(nextEdge);
      const range = computeEnergyRange(newElement, nextEdge);
      if (range) {
        setEStart(range[0]);
        setEEnd(range[1]);
      }
    },
    [ready, edge],
  );

  // Sync energy range when edge changes manually
  const handleEdgeChange = useCallback(
    (newEdge: string) => {
      setEdge(newEdge);
      if (!ready || !element.trim()) return;
      const range = computeEnergyRange(element, newEdge);
      if (range) {
        setEStart(range[0]);
        setEEnd(range[1]);
      }
    },
    [ready, element],
  );

  // Initialize derived state once WASM is ready
  useEffect(() => {
    if (!ready) return;
    const detected = extractHeaviestElement(formula);
    if (detected) {
      setElement(detected);
      const [edges, bestEdge] = pickEdge(detected);
      setAvailableEdges(edges);
      const nextEdge = resolveEdgeSelection(edges, "K", bestEdge);
      setEdge(nextEdge);
      const range = computeEnergyRange(detected, nextEdge);
      if (range) {
        setEStart(range[0]);
        setEEnd(range[1]);
      }
    }
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const calcState = useMemo<CalculationState<SelfAbsData>>(() => {
    if (!ready) return { status: "idle", data: null, error: null };
    if (!formula.trim()) return errorState("Enter a chemical formula");
    if (!element.trim()) return errorState("Enter the absorbing element");
    if (!edge.trim()) return errorState("Enter the absorption edge");

    const ameyanagiChiSweepValues = chiSweepCustomValues.length > 0
      ? chiSweepCustomValues
      : chiSweepPresets;

    if (!(densityGcm3 > 0)) return errorState("Density ρ must be > 0 g/cm³");
    if (!(phiDeg > 0 && phiDeg <= 90)) return errorState("Incident angle φ must be in degrees and in (0, 90]");
    if (!(thetaDeg > 0 && thetaDeg <= 90)) return errorState("Exit angle θ must be in degrees and in (0, 90]");
    if (ameyanagiChiMode === "single") {
      if (!(Number.isFinite(chiAssumed) && chiAssumed > 0)) {
        return errorState("Assumed χ must be finite and > 0 for Ameyanagi");
      }
    } else {
      if (chiSweepCustomError) return errorState(chiSweepCustomError);
      if (ameyanagiChiSweepValues.length === 0) {
        return errorState("Select at least one χ value for Ameyanagi sweep");
      }
    }
    if (thicknessMode === "thickness" && !(thicknessCm > 0)) {
      return errorState("Thickness (cm) must be > 0 for Ameyanagi");
    }
    if (thicknessMode === "pellet" && (!(pelletMassG > 0) || !(pelletDiameterCm > 0))) {
      return errorState("Pellet mass and diameter must be > 0 for Ameyanagi");
    }

    const range = validateRange(eStart, eEnd, eStep, 30000);
    if (!range.valid) return errorState(range.error ?? "Invalid energy range");

    try {
      const energies = energyRange(eStart, eEnd, eStep);
      const energyArr = Array.from(energies);
      const ameyanagiRTraces: PlotTrace[] = [];
      const summary: SummaryInfo[] = [];
      let colorIdx = 0;
      const resolvedThicknessCm = resolveThicknessCm(
        thicknessMode,
        thicknessCm,
        pelletMassG,
        pelletDiameterCm,
        densityGcm3,
      );
      const thicknessUmRef = resolvedThicknessCm * 1e4;
      const phiRad = (phiDeg * Math.PI) / 180.0;
      const thetaRad = (thetaDeg * Math.PI) / 180.0;

      const chiValues = ameyanagiChiMode === "single"
        ? [chiAssumed]
        : ameyanagiChiSweepValues;
      const showAmeyanagi = plotTraceMode === "ameyanagi";
      const showBooth = plotTraceMode === "booth";

      for (const chi of chiValues) {
        const color = COLORS[colorIdx % COLORS.length];
        colorIdx++;
        const chiLabel = formatChi(chi);
        if (showAmeyanagi) {
          const r = sa_ameyanagi(
            formula.trim(),
            element.trim(),
            edge.trim(),
            energies,
            densityGcm3,
            phiRad,
            thetaRad,
            thicknessMode === "thickness" ? thicknessCm : undefined,
            thicknessMode === "pellet" ? pelletMassG : undefined,
            thicknessMode === "pellet" ? pelletDiameterCm : undefined,
            chi,
          );
          const rValues = r.suppression_factor as number[];
          const rPercent = rValues.map((v: number) => v * 100);
          const ameyanagiName = ameyanagiChiMode === "single"
            ? "Ameyanagi"
            : `Ameyanagi χ=${chiLabel}`;
          const ameyanagiLine = { color, width: 2 };
          ameyanagiRTraces.push({ x: energyArr, y: rPercent, name: ameyanagiName, line: ameyanagiLine });
          summary.push({
            algorithm: ameyanagiName,
            edgeEnergy: r.edge_energy,
            fluorEnergy: r.fluorescence_energy_weighted,
            rMin: r.r_min,
            rMax: r.r_max,
            rMean: r.r_mean,
            interpretation: classifySuppression(r.r_mean),
            thicknessCm: r.thickness_cm,
            geometryG: r.geometry_g,
            chiAssumed: chi,
            muF: r.mu_f,
            betaPath: r.beta,
          });
        }

        if (showBooth) {
          const b = sa_booth_reference(
            formula.trim(),
            element.trim(),
            edge.trim(),
            energies,
            phiDeg,
            thetaDeg,
            thicknessUmRef,
            densityGcm3,
            chi,
          );
          const bValues = b.suppression_factor as number[];
          const bPercent = bValues.map((v: number) => v * 100);
          const boothName = ameyanagiChiMode === "single"
            ? "Booth ref"
            : `Booth ref χ=${chiLabel}`;
          const boothLine = { color, width: 2, dash: "dash" as const };
          ameyanagiRTraces.push({ x: energyArr, y: bPercent, name: boothName, line: boothLine });
          summary.push({
            algorithm: boothName,
            edgeEnergy: b.edge_energy,
            fluorEnergy: b.fluorescence_energy,
            rMin: b.r_min,
            rMax: b.r_max,
            rMean: b.r_mean,
            interpretation: classifySuppression(b.r_mean),
            isThick: b.is_thick,
            thicknessCm: resolvedThicknessCm,
            chiAssumed: chi,
          });
        }
      }

      return readyState({ ameyanagiRTraces, summary });
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
    densityGcm3,
    phiDeg,
    thetaDeg,
    chiAssumed,
    ameyanagiChiMode,
    chiSweepPresets,
    chiSweepCustomValues,
    chiSweepCustomError,
    thicknessMode,
    thicknessCm,
    pelletMassG,
    pelletDiameterCm,
    plotTraceMode,
  ]);

  if (!ready) return <LoadingState />;
  const ameyanagiSweepActive = ameyanagiChiMode === "sweep";

  return (
    <div>
      <PageHeader
        title="Self Absorption"
        description="Fluorescence self-absorption analysis using exact Ameyanagi suppression with Booth reference."
      />

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        {/* Controls */}
        <div className="order-2 space-y-4 lg:order-none">
          <FormulaInput value={formula} onChange={handleFormulaChange} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Absorber</label>
              <input
                type="text"
                value={element}
                onChange={(e) => handleElementChange(e.target.value)}
                placeholder="e.g. Fe"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Edge</label>
              <select
                value={edge}
                onChange={(e) => handleEdgeChange(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {availableEdges.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3 rounded-md border border-border/50 p-3">
            <div className="text-sm font-semibold">Ameyanagi (exact)</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Density ρ</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={densityGcm3}
                    min={0.001}
                    step={0.01}
                    onChange={(e) => setDensityGcm3(Number(e.target.value))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <span className="text-xs text-muted-foreground">g/cm³</span>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">χ mode</label>
                <select
                  value={ameyanagiChiMode}
                  onChange={(e) => setAmeyanagiChiMode(e.target.value as AmeyanagiChiMode)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="single">Single χ</option>
                  <option value="sweep">Sweep χ</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Plot traces</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPlotTraceMode("ameyanagi")}
                  className={`rounded px-3 py-2 text-sm font-medium ${
                    plotTraceMode === "ameyanagi"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  Ameyanagi
                </button>
                <button
                  type="button"
                  onClick={() => setPlotTraceMode("booth")}
                  className={`rounded px-3 py-2 text-sm font-medium ${
                    plotTraceMode === "booth"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  Booth
                </button>
              </div>
            </div>

            {ameyanagiChiMode === "single" ? (
              <div>
                <label className="mb-1 block text-sm font-medium">Assumed χ</label>
                <input
                  type="number"
                  value={chiAssumed}
                  min={0.001}
                  max={1}
                  step={0.01}
                  onChange={(e) => setChiAssumed(Number(e.target.value))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">Preset χ values</label>
                  <div className="flex flex-wrap gap-2">
                    {AMEYANAGI_CHI_PRESETS.map((chi) => {
                      const active = chiSweepPresets.includes(chi);
                      return (
                        <button
                          key={chi}
                          type="button"
                          onClick={() => toggleChiPreset(chi)}
                          className={`rounded px-2 py-1 text-xs ${
                            active
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                          }`}
                        >
                          {formatChi(chi)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Custom χ list (comma-separated)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={chiSweepCustomInput}
                      onChange={(e) => {
                        setChiSweepCustomInput(e.target.value);
                        setChiSweepCustomError(null);
                      }}
                      placeholder="e.g. 0.07, 0.15, 0.25"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <button
                      type="button"
                      onClick={applyCustomChiSweep}
                      className="rounded bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      onClick={clearCustomChiSweep}
                      className="rounded bg-secondary px-3 py-2 text-xs font-medium text-secondary-foreground"
                    >
                      Clear
                    </button>
                  </div>
                  {chiSweepCustomError && (
                    <p className="mt-1 text-xs text-destructive">{chiSweepCustomError}</p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Active χ: {(
                      chiSweepCustomValues.length > 0 ? chiSweepCustomValues : chiSweepPresets
                    ).map(formatChi).join(", ") || "none"}
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Incident φ</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={phiDeg}
                    min={0.1}
                    max={90}
                    step={0.1}
                    onChange={(e) => setPhiDeg(Number(e.target.value))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <span className="text-xs text-muted-foreground">deg</span>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Exit θ</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={thetaDeg}
                    min={0.1}
                    max={90}
                    step={0.1}
                    onChange={(e) => setThetaDeg(Number(e.target.value))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <span className="text-xs text-muted-foreground">deg</span>
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Thickness input</label>
              <select
                value={thicknessMode}
                onChange={(e) => setThicknessMode(e.target.value as ThicknessMode)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="thickness">Direct thickness (cm)</option>
                <option value="pellet">Pellet mass + diameter</option>
              </select>
            </div>

            {thicknessMode === "thickness" ? (
              <div>
                <label className="mb-1 block text-sm font-medium">Thickness</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={thicknessCm}
                    min={1e-6}
                    step={0.001}
                    onChange={(e) => setThicknessCm(Number(e.target.value))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <span className="text-xs text-muted-foreground">cm</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">Pellet mass</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={pelletMassG}
                      min={1e-6}
                      step={0.001}
                      onChange={(e) => setPelletMassG(Number(e.target.value))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <span className="text-xs text-muted-foreground">g</span>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Pellet diameter</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={pelletDiameterCm}
                      min={1e-6}
                      step={0.01}
                      onChange={(e) => setPelletDiameterCm(Number(e.target.value))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <span className="text-xs text-muted-foreground">cm</span>
                  </div>
                </div>
              </div>
            )}
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

        {/* Results */}
        <div className="order-1 space-y-4 lg:order-none">
          {(calcState.data?.ameyanagiRTraces?.length ?? 0) > 0 && (
            <ScientificPlot
              traces={calcState.data?.ameyanagiRTraces ?? []}
              xTitle="Energy (eV)"
              yTitle="R(E, χ) retained (%)"
              title={`${plotTraceMode === "ameyanagi" ? "Ameyanagi" : "Booth reference"} vs Energy (percent)${ameyanagiSweepActive ? " (multi-χ)" : ""}`}
              height={380}
              showLogToggle={false}
              yRange={[0, 100]}
            />
          )}

          {calcState.data?.summary && calcState.data.summary.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="mb-3 text-sm font-semibold">Summary</h3>
              <div className="space-y-3">
                {calcState.data.summary.map((s, idx) => (
                  <SummaryCard key={`${s.algorithm}-${s.chiAssumed ?? "na"}-${idx}`} info={s} />
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
        {info.rMin != null && (
          <Stat label="R min" value={info.rMin.toFixed(4)} />
        )}
        {info.rMax != null && (
          <Stat label="R max" value={info.rMax.toFixed(4)} />
        )}
        {info.rMean != null && (
          <Stat label="R mean" value={info.rMean.toFixed(4)} />
        )}
        {info.interpretation != null && (
          <Stat label="Suppression" value={info.interpretation} />
        )}
        {info.isThick != null && (
          <Stat label="Booth branch" value={info.isThick ? "Thick" : "Thin"} />
        )}
        {info.thicknessCm != null && (
          <Stat label="Thickness" value={`${info.thicknessCm.toExponential(3)} cm`} />
        )}
        {info.geometryG != null && (
          <Stat label="g = sinφ/sinθ" value={info.geometryG.toFixed(4)} />
        )}
        {info.betaPath != null && (
          <Stat label="β = d/sinφ" value={`${info.betaPath.toExponential(3)} cm`} />
        )}
        {info.muF != null && (
          <Stat label="μ_f" value={`${info.muF.toFixed(4)} cm⁻¹`} />
        )}
        {info.chiAssumed != null && (
          <Stat label="Assumed χ" value={info.chiAssumed.toFixed(4)} />
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
