import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useCallback } from "react";
import { useWasm } from "~/hooks/useWasm";
import {
  all_elements,
  element_info,
  xray_edges,
  xray_lines,
  corehole_widths,
  mu_elam,
} from "~/lib/wasm-api";
// energyRange no longer needed — energy range computed from element edges
import { PeriodicTable } from "~/components/periodic-table/PeriodicTable";
import type { ElementData } from "~/components/periodic-table/types";
import { ScientificPlot } from "~/components/plot/ScientificPlot";
import type { PlotTrace, PlotAnnotation } from "~/components/plot/ScientificPlot";
import { downloadCsv } from "~/lib/csv-export";
import { LoadingState } from "~/components/ui/LoadingState";
import { PageHeader } from "~/components/ui/PageHeader";
import { ScrollableTable } from "~/components/ui/ScrollableTable";

const HC_ANGSTROM = 12398.4;

export const Route = createFileRoute("/")({
  component: HomePage,
});

const EDGE_PRIORITY = ["K", "L3", "L2", "L1"];

function HomePage() {
  const ready = useWasm();
  const [selectedZ, setSelectedZ] = useState<number | null>(null);
  const [filterOverlays, setFilterOverlays] = useState<Set<"z1" | "z2">>(
    () => new Set(),
  );
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);

  // Reset overlays and edge focus when element changes
  useEffect(() => {
    setFilterOverlays(new Set());
    setSelectedEdge(null);
  }, [selectedZ]);

  const toggleFilter = useCallback((which: "z1" | "z2") => {
    setFilterOverlays((prev) => {
      const next = new Set(prev);
      if (next.has(which)) next.delete(which);
      else next.add(which);
      return next;
    });
  }, []);

  const elements: ElementData[] = useMemo(() => {
    if (!ready) return [];
    return all_elements() as ElementData[];
  }, [ready]);

  const data = useMemo(() => {
    if (!ready || selectedZ === null) return null;
    try {
      const info = element_info(String(selectedZ));
      const edges = xray_edges(String(selectedZ)) as {
        label: string;
        energy: number;
        fluorescence_yield: number;
        jump_ratio: number;
      }[];
      const lines = xray_lines(String(selectedZ), undefined, undefined) as {
        label: string;
        energy: number;
        intensity: number;
        initial_level: string;
        final_level: string;
      }[];
      let widths: { edge: string; width: number }[] = [];
      try {
        widths = corehole_widths(String(selectedZ)) as {
          edge: string;
          width: number;
        }[];
      } catch {
        // Some elements don't have core-hole width data
      }

      // Z-1 and Z-2 filter suggestions
      let filterZ1: { symbol: string; z: number; kEdge: number } | null = null;
      let filterZ2: { symbol: string; z: number; kEdge: number } | null = null;

      if (selectedZ > 2) {
        try {
          const f1 = element_info(String(selectedZ - 1));
          const f1Edges = xray_edges(String(selectedZ - 1)) as {
            label: string;
            energy: number;
          }[];
          const kEdge = f1Edges.find((e) => e.label === "K");
          if (kEdge)
            filterZ1 = { symbol: f1.symbol, z: f1.z, kEdge: kEdge.energy };
        } catch {
          /* skip */
        }
      }
      if (selectedZ > 3) {
        try {
          const f2 = element_info(String(selectedZ - 2));
          const f2Edges = xray_edges(String(selectedZ - 2)) as {
            label: string;
            energy: number;
          }[];
          const kEdge = f2Edges.find((e) => e.label === "K");
          if (kEdge)
            filterZ2 = { symbol: f2.symbol, z: f2.z, kEdge: kEdge.energy };
        } catch {
          /* skip */
        }
      }

      return { info, edges, lines, widths, filterZ1, filterZ2 };
    } catch {
      return null;
    }
  }, [ready, selectedZ]);

  // Available edges in priority order for the edge-of-interest selector
  const orderedEdges = useMemo(() => {
    if (!data) return [];
    const available = data.edges.filter((e) => e.energy > 100);
    return EDGE_PRIORITY.filter((label) =>
      available.some((e) => e.label === label),
    ).map((label) => available.find((e) => e.label === label)!);
  }, [data]);

  // Compute energy range and xRange based on element edges and selected edge
  const plotEnergyRange = useMemo(() => {
    if (!data || data.edges.length === 0) return null;
    const edgeEnergies = data.edges.map((e) => e.energy).filter((e) => e > 100);
    if (edgeEnergies.length === 0) return null;

    const maxEdge = Math.max(...edgeEnergies);
    const minEdge = Math.min(...edgeEnergies);
    const eStart = Math.max(100, minEdge * 0.3);
    const eEnd = maxEdge * 1.5;

    // Always provide explicit xRange to prevent Plotly log-scale autorange issues with annotations
    let xRange: [number, number];
    if (selectedEdge) {
      const edgeData = data.edges.find((e) => e.label === selectedEdge);
      xRange = edgeData
        ? [Math.max(100, edgeData.energy * 0.5), edgeData.energy * 2.0]
        : [eStart, eEnd];
    } else {
      xRange = [eStart, eEnd];
    }

    return { eStart, eEnd, xRange };
  }, [data, selectedEdge]);

  // Build energy grid with fine steps (1 eV) around absorption edges
  const plotEnergies = useMemo(() => {
    if (!data || !plotEnergyRange) return null;
    const { eStart, eEnd } = plotEnergyRange;
    const edgeEnergies = data.edges
      .map((e) => e.energy)
      .filter((e) => e >= eStart && e <= eEnd);

    const coarseStep = Math.max(1, (eEnd - eStart) / 300);
    const fineRadius = 50; // 50 eV around each edge
    const fineStep = 1;

    const points = new Set<number>();
    for (let e = eStart; e <= eEnd; e += coarseStep) {
      points.add(Math.round(e * 10) / 10);
    }
    points.add(eEnd);
    // Add fine grid around each edge
    for (const edgeE of edgeEnergies) {
      const lo = Math.max(eStart, edgeE - fineRadius);
      const hi = Math.min(eEnd, edgeE + fineRadius);
      for (let e = lo; e <= hi; e += fineStep) {
        points.add(Math.round(e * 10) / 10);
      }
    }

    const sorted = [...points].sort((a, b) => a - b);
    return { arr: sorted, f64: new Float64Array(sorted) };
  }, [data, plotEnergyRange]);

  // Attenuation plot with filter overlays
  const attenuationPlot = useMemo<PlotTrace[]>(() => {
    if (!data || !plotEnergies) return [];
    try {
      const { arr, f64 } = plotEnergies;
      const result: PlotTrace[] = [];

      // Primary element
      const mu = mu_elam(data.info.symbol, f64, "total") as Float64Array;
      result.push({
        x: arr,
        y: Array.from(mu),
        name: `${data.info.symbol} total`,
      });

      // Z-1 filter overlay
      if (filterOverlays.has("z1") && data.filterZ1) {
        const fmu = mu_elam(data.filterZ1.symbol, f64, "total") as Float64Array;
        result.push({
          x: arr,
          y: Array.from(fmu),
          name: `${data.filterZ1.symbol} filter (Z-1)`,
          line: { color: "#f59e0b", width: 2 },
        });
      }

      // Z-2 filter overlay
      if (filterOverlays.has("z2") && data.filterZ2) {
        const fmu = mu_elam(data.filterZ2.symbol, f64, "total") as Float64Array;
        result.push({
          x: arr,
          y: Array.from(fmu),
          name: `${data.filterZ2.symbol} filter (Z-2)`,
          line: { color: "#a78bfa", width: 2 },
        });
      }

      return result;
    } catch {
      return [];
    }
  }, [data, filterOverlays, plotEnergies]);

  // Compute tight y-range from trace data within visible x-range
  const plotYRange = useMemo<[number, number] | undefined>(() => {
    if (attenuationPlot.length === 0) return undefined;
    const xLo = plotEnergyRange?.xRange?.[0] ?? -Infinity;
    const xHi = plotEnergyRange?.xRange?.[1] ?? Infinity;
    let yMin = Infinity;
    let yMax = -Infinity;
    for (const trace of attenuationPlot) {
      for (let i = 0; i < trace.x.length; i++) {
        const x = trace.x[i];
        const v = trace.y[i];
        if (x >= xLo && x <= xHi && v > 0) {
          if (v < yMin) yMin = v;
          if (v > yMax) yMax = v;
        }
      }
    }
    if (!isFinite(yMin) || !isFinite(yMax)) return undefined;
    // Add half a decade of padding on log scale
    return [yMin / 2, yMax * 3];
  }, [attenuationPlot, plotEnergyRange]);

  // Emission line annotations only (no edge lines)
  const emissionAnnotations = useMemo<PlotAnnotation[]>(() => {
    if (!data || !plotEnergyRange) return [];
    const visRange = plotEnergyRange.xRange ?? [plotEnergyRange.eStart, plotEnergyRange.eEnd];
    const inRange = (e: number) => e >= visRange[0] * 0.9 && e <= visRange[1] * 1.1;

    return [...data.lines]
      .sort((a, b) => b.intensity - a.intensity)
      .slice(0, 8)
      .filter((l) => l.energy > 100 && inRange(l.energy))
      .map((line) => ({
        x: line.energy,
        text: line.label,
        color: "#22c55e",
        dash: "dash" as const,
      }));
  }, [data, plotEnergyRange]);

  if (!ready) {
    return <LoadingState />;
  }

  return (
    <div>
      <PageHeader
        title="X-ray Analysis Tools"
        description="Click an element to view its X-ray properties."
      />

      {/* Periodic table + summary panel side by side */}
      <div className="flex flex-col xl:flex-row xl:gap-4">
        <div className="shrink-0">
          <PeriodicTable
            elements={elements}
            selectedZ={selectedZ}
            onSelect={setSelectedZ}
          />
        </div>

        {/* Quick summary panel — appears to the right on xl screens */}
        {data && (
          <div className="mt-4 flex min-w-0 flex-1 flex-col gap-3 xl:mt-0">
            {/* Element header (compact) */}
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-xl font-bold text-primary">
                {data.info.symbol}
              </div>
              <div>
                <h2 className="text-lg font-bold">
                  {data.info.name}{" "}
                  <span className="text-muted-foreground text-sm">
                    Z={data.info.z}
                  </span>
                </h2>
                <p className="text-xs text-muted-foreground">
                  {data.info.molar_mass.toFixed(2)} g/mol &middot;{" "}
                  {data.info.density.toFixed(3)} g/cm&sup3;
                </p>
              </div>
            </div>

            {/* Edge focus + Attenuation card */}
            {attenuationPlot.length > 0 && (
              <div className="rounded-lg border border-border bg-card p-2">
                <div className="mb-1 flex flex-wrap items-center gap-1 px-1">
                  <h3 className="text-xs font-semibold text-muted-foreground">
                    X-ray Attenuation (&mu;/&rho;)
                  </h3>
                  {orderedEdges.length > 0 && (
                    <>
                      <span className="mx-1 text-xs text-muted-foreground">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedEdge(null)}
                        className={`rounded px-2.5 py-1.5 text-xs font-medium ${
                          selectedEdge === null
                            ? "bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                        }`}
                      >
                        All
                      </button>
                      {orderedEdges.map((edge) => (
                        <button
                          key={edge.label}
                          type="button"
                          onClick={() => setSelectedEdge(edge.label)}
                          className={`rounded px-2.5 py-1.5 text-xs font-medium ${
                            selectedEdge === edge.label
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                          }`}
                        >
                          {edge.label}
                        </button>
                      ))}
                    </>
                  )}
                </div>
                <ScientificPlot
                  traces={attenuationPlot}
                  xTitle="Energy (eV)"
                  yTitle="μ/ρ (cm²/g)"
                  height={180}
                  defaultLogY
                  defaultLogX
                  showLogToggle={false}
                  verticalLines={emissionAnnotations}
                  xRange={plotEnergyRange?.xRange}
                  yRange={plotYRange}
                />
              </div>
            )}

            {/* Filter suggestions card */}
            {(data.filterZ1 || data.filterZ2) && (
              <div className="rounded-lg border border-border bg-card p-3">
                <h3 className="mb-2 text-xs font-semibold text-muted-foreground">
                  Filter Suggestions
                </h3>
                <div className="flex gap-2">
                  {data.filterZ1 && (
                    <button
                      type="button"
                      onClick={() => toggleFilter("z1")}
                      className={`flex-1 rounded-lg border px-3 py-1.5 text-sm ${
                        filterOverlays.has("z1")
                          ? "border-amber-500/50 bg-amber-500/15"
                          : "border-primary/30 bg-primary/5 hover:bg-primary/10"
                      }`}
                    >
                      <span className={`font-semibold ${filterOverlays.has("z1") ? "text-amber-500" : "text-primary"}`}>
                        {data.filterZ1.symbol}
                      </span>
                      <span className="ml-1 text-xs text-muted-foreground">
                        Z-1 &middot; {data.filterZ1.kEdge.toFixed(0)} eV
                      </span>
                    </button>
                  )}
                  {data.filterZ2 && (
                    <button
                      type="button"
                      onClick={() => toggleFilter("z2")}
                      className={`flex-1 rounded-lg border px-3 py-1.5 text-sm ${
                        filterOverlays.has("z2")
                          ? "border-purple-400/50 bg-purple-400/15"
                          : "border-border bg-card hover:bg-accent/50"
                      }`}
                    >
                      <span className={`font-semibold ${filterOverlays.has("z2") ? "text-purple-400" : ""}`}>
                        {data.filterZ2.symbol}
                      </span>
                      <span className="ml-1 text-xs text-muted-foreground">
                        Z-2 &middot; {data.filterZ2.kEdge.toFixed(0)} eV
                      </span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Full data tables below */}
      {data && (
        <div className="mt-6 space-y-4">
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            {/* Absorption Edges */}
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Absorption Edges</h3>
                {data.edges.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      downloadCsv(
                        `${data.info.symbol}_edges.csv`,
                        [
                          "Edge",
                          "Energy_eV",
                          "Wavelength_A",
                          "Fluor_Yield",
                          "Jump_Ratio",
                        ],
                        data.edges.map((e) => [
                          e.label,
                          e.energy.toFixed(1),
                          e.energy > 0
                            ? (HC_ANGSTROM / e.energy).toFixed(6)
                            : "",
                          e.fluorescence_yield.toFixed(4),
                          e.jump_ratio.toFixed(4),
                        ]),
                      )
                    }
                    className="text-xs text-muted-foreground hover:text-primary"
                  >
                    Export CSV
                  </button>
                )}
              </div>
              {data.edges.length === 0 ? (
                <p className="text-sm text-muted-foreground">No edge data.</p>
              ) : (
                <ScrollableTable>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-muted-foreground">
                        <th className="pb-2 pr-4">Edge</th>
                        <th className="pb-2 pr-4">Energy (eV)</th>
                        <th className="pb-2 pr-4">&lambda; (&Aring;)</th>
                        <th className="hidden pb-2 pr-4 sm:table-cell">
                          Fluor. Yield
                        </th>
                        <th className="hidden pb-2 sm:table-cell">
                          Jump Ratio
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.edges.map((edge) => (
                        <tr
                          key={edge.label}
                          className="border-b border-border/50 last:border-0"
                        >
                          <td className="py-1.5 pr-4 font-medium">
                            {edge.label}
                          </td>
                          <td className="py-1.5 pr-4 font-mono">
                            {edge.energy.toFixed(1)}
                          </td>
                          <td className="py-1.5 pr-4 font-mono text-muted-foreground">
                            {edge.energy > 0
                              ? (HC_ANGSTROM / edge.energy).toFixed(4)
                              : "\u2014"}
                          </td>
                          <td className="hidden py-1.5 pr-4 font-mono sm:table-cell">
                            {edge.fluorescence_yield.toFixed(4)}
                          </td>
                          <td className="hidden py-1.5 font-mono sm:table-cell">
                            {edge.jump_ratio.toFixed(4)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollableTable>
              )}
            </div>

            {/* Emission Lines */}
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Emission Lines</h3>
                {data.lines.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      downloadCsv(
                        `${data.info.symbol}_lines.csv`,
                        [
                          "Line",
                          "Energy_eV",
                          "Wavelength_A",
                          "Intensity",
                          "Initial",
                          "Final",
                        ],
                        data.lines.map((l) => [
                          l.label,
                          l.energy.toFixed(1),
                          l.energy > 0
                            ? (HC_ANGSTROM / l.energy).toFixed(6)
                            : "",
                          l.intensity.toFixed(4),
                          l.initial_level,
                          l.final_level,
                        ]),
                      )
                    }
                    className="text-xs text-muted-foreground hover:text-primary"
                  >
                    Export CSV
                  </button>
                )}
              </div>
              {data.lines.length === 0 ? (
                <p className="text-sm text-muted-foreground">No line data.</p>
              ) : (
                <ScrollableTable className="max-h-80 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card">
                      <tr className="border-b border-border text-left text-muted-foreground">
                        <th className="pb-2 pr-4">Line</th>
                        <th className="pb-2 pr-4">Energy (eV)</th>
                        <th className="pb-2 pr-4">&lambda; (&Aring;)</th>
                        <th className="pb-2 pr-4">Intensity</th>
                        <th className="hidden pb-2 sm:table-cell">
                          Transition
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.lines.map((line) => (
                        <tr
                          key={line.label}
                          className="border-b border-border/50 last:border-0"
                        >
                          <td className="py-1.5 pr-4 font-medium">
                            {line.label}
                          </td>
                          <td className="py-1.5 pr-4 font-mono">
                            {line.energy.toFixed(1)}
                          </td>
                          <td className="py-1.5 pr-4 font-mono text-muted-foreground">
                            {line.energy > 0
                              ? (HC_ANGSTROM / line.energy).toFixed(4)
                              : "\u2014"}
                          </td>
                          <td className="py-1.5 pr-4 font-mono">
                            {line.intensity.toFixed(4)}
                          </td>
                          <td className="hidden py-1.5 text-muted-foreground sm:table-cell">
                            {line.initial_level} &rarr; {line.final_level}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollableTable>
              )}
            </div>

            {/* Core-hole Widths */}
            {data.widths.length > 0 && (
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Core-hole Widths</h3>
                  <button
                    type="button"
                    onClick={() =>
                      downloadCsv(
                        `${data.info.symbol}_corehole_widths.csv`,
                        ["Edge", "Width_eV"],
                        data.widths.map((w) => [w.edge, w.width.toFixed(4)]),
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
                        <th className="pb-2 pr-4">Edge</th>
                        <th className="pb-2">Width (eV)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.widths.map((w) => (
                        <tr
                          key={w.edge}
                          className="border-b border-border/50 last:border-0"
                        >
                          <td className="py-1.5 pr-4 font-medium">{w.edge}</td>
                          <td className="py-1.5 font-mono">
                            {w.width.toFixed(4)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
