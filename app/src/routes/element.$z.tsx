import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useCallback } from "react";
import { useWasm } from "~/hooks/useWasm";
import {
  element_info,
  xray_edges,
  xray_lines,
  corehole_widths,
  mu_elam,
} from "~/lib/wasm-api";
import { downloadCsv } from "~/lib/csv-export";
import { ScientificPlot } from "~/components/plot/ScientificPlot";
import type {
  PlotTrace,
  PlotAnnotation,
} from "~/components/plot/ScientificPlot";
import { LoadingState } from "~/components/ui/LoadingState";
import { EmptyState } from "~/components/ui/EmptyState";
import { ScrollableTable } from "~/components/ui/ScrollableTable";
import { ToolDocsButton } from "~/components/docs/ToolDocsButton";

export const Route = createFileRoute("/element/$z")({
  component: ElementDetailPage,
});

const HC_ANGSTROM = 12398.4; // eV·Å

const CROSS_SECTION_TYPES = [
  { key: "total", label: "Total" },
  { key: "photo", label: "Photo" },
  { key: "coherent", label: "Coherent" },
  { key: "incoherent", label: "Incoherent" },
] as const;

const EDGE_PRIORITY = ["K", "L3", "L2", "L1"];

function ElementDetailPage() {
  const { z } = Route.useParams();
  const ready = useWasm();

  const [visibleCrossSections, setVisibleCrossSections] = useState<Set<string>>(
    () => new Set(["total", "photo", "coherent", "incoherent"]),
  );
  const [filterOverlays, setFilterOverlays] = useState<Set<"z1" | "z2">>(
    () => new Set(),
  );
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);

  const toggleCrossSection = useCallback((key: string) => {
    setVisibleCrossSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleFilter = useCallback((which: "z1" | "z2") => {
    setFilterOverlays((prev) => {
      const next = new Set(prev);
      if (next.has(which)) next.delete(which);
      else next.add(which);
      return next;
    });
  }, []);

  const data = useMemo(() => {
    if (!ready) return null;
    try {
      const info = element_info(z);
      const edges = xray_edges(z) as {
        label: string;
        energy: number;
        fluorescence_yield: number;
        jump_ratio: number;
      }[];
      const lines = xray_lines(z, undefined, undefined) as {
        label: string;
        energy: number;
        intensity: number;
        initial_level: string;
        final_level: string;
      }[];
      let widths: { edge: string; width: number }[] = [];
      try {
        widths = corehole_widths(z) as { edge: string; width: number }[];
      } catch {
        // Some elements don't have core-hole width data
      }

      // Z-1 and Z-2 filter suggestions for K-edge fluorescence
      const zNum = info.z as number;
      let filterZ1: {
        symbol: string;
        z: number;
        kEdge: number;
      } | null = null;
      let filterZ2: {
        symbol: string;
        z: number;
        kEdge: number;
      } | null = null;

      if (zNum > 2) {
        try {
          const f1 = element_info(String(zNum - 1));
          const f1Edges = xray_edges(String(zNum - 1)) as {
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
      if (zNum > 3) {
        try {
          const f2 = element_info(String(zNum - 2));
          const f2Edges = xray_edges(String(zNum - 2)) as {
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
  }, [ready, z]);

  // Available edges in priority order for the edge-of-interest selector
  const orderedEdges = useMemo(() => {
    if (!data) return [];
    const available = data.edges.filter((e) => e.energy > 100);
    return EDGE_PRIORITY.filter((label) =>
      available.some((e) => e.label === label),
    ).map((label) => available.find((e) => e.label === label)!);
  }, [data]);

  // Compute xRange based on selected edge (always explicit to prevent Plotly log-scale autorange issues)
  const edgeXRange = useMemo<[number, number] | undefined>(() => {
    if (!data) return undefined;
    if (selectedEdge) {
      const edgeData = data.edges.find((e) => e.label === selectedEdge);
      if (edgeData) return [Math.max(100, edgeData.energy * 0.5), edgeData.energy * 2.0];
    }
    // Full range: compute from all edges
    const edgeEnergies = data.edges.map((e) => e.energy).filter((e) => e > 100);
    if (edgeEnergies.length === 0) return undefined;
    const minEdge = Math.min(...edgeEnergies);
    const maxEdge = Math.max(...edgeEnergies);
    return [Math.max(100, minEdge * 0.3), maxEdge * 1.5];
  }, [selectedEdge, data]);

  // Cross-section plot: element μ/ρ, filter element μ/ρ, fluorescence lines
  const crossSectionPlot = useMemo(() => {
    if (!ready || !data) return { traces: [] as PlotTrace[], annotations: [] as PlotAnnotation[] };

    const { info, edges, lines, filterZ1, filterZ2 } = data;

    // Determine energy range from edges
    const edgeEnergies = edges
      .map((e) => e.energy)
      .filter((e) => e > 100);
    if (edgeEnergies.length === 0)
      return { traces: [] as PlotTrace[], annotations: [] as PlotAnnotation[] };

    const maxEdge = Math.max(...edgeEnergies);
    const minEdge = Math.min(...edgeEnergies);
    const eStart = Math.max(100, minEdge * 0.3);
    const eEnd = maxEdge * 1.5;
    const nPoints = 500;
    const step = Math.max(1, (eEnd - eStart) / nPoints);

    const energies: number[] = [];
    for (let e = eStart; e <= eEnd; e += step) {
      energies.push(e);
    }
    const energyArr = new Float64Array(energies);

    const traces: PlotTrace[] = [];
    const annotations: PlotAnnotation[] = [];

    // Element cross-sections based on toggle state
    for (const cs of CROSS_SECTION_TYPES) {
      if (!visibleCrossSections.has(cs.key)) continue;
      try {
        const mu = mu_elam(info.symbol, energyArr, cs.key);
        traces.push({
          x: energies,
          y: Array.from(mu),
          name: `${info.symbol} μ/ρ (${cs.label.toLowerCase()})`,
          line: cs.key === "total" ? undefined : { dash: cs.key === "photo" ? "dot" : "dashdot", width: 1.5 },
        });
      } catch {
        // skip
      }
    }

    // Z-1 filter cross-section (only when overlay is active)
    if (filterOverlays.has("z1") && filterZ1) {
      try {
        const mu = mu_elam(filterZ1.symbol, energyArr, "total");
        traces.push({
          x: energies,
          y: Array.from(mu),
          name: `${filterZ1.symbol} filter (Z-1)`,
          line: { color: "#f59e0b", width: 2 },
        });
      } catch {
        // skip
      }
      annotations.push({
        x: filterZ1.kEdge,
        text: `${filterZ1.symbol} K`,
        color: "#f59e0b",
      });
    }

    // Z-2 filter cross-section (only when overlay is active)
    if (filterOverlays.has("z2") && filterZ2) {
      try {
        const mu = mu_elam(filterZ2.symbol, energyArr, "total");
        traces.push({
          x: energies,
          y: Array.from(mu),
          name: `${filterZ2.symbol} filter (Z-2)`,
          line: { color: "#a78bfa", width: 2 },
        });
      } catch {
        // skip
      }
      annotations.push({
        x: filterZ2.kEdge,
        text: `${filterZ2.symbol} K`,
        color: "#a78bfa",
      });
    }

    // Determine visible range for filtering annotations
    const visStart = edgeXRange ? edgeXRange[0] * 0.9 : eStart;
    const visEnd = edgeXRange ? edgeXRange[1] * 1.1 : eEnd;
    const inRange = (e: number) => e >= visStart && e <= visEnd;

    // Fluorescence emission lines as vertical markers (dashed green) — only in visible range
    const strongLines = lines.filter((l) => l.intensity > 0.01 && l.energy > 100 && inRange(l.energy));
    for (const line of strongLines.slice(0, 15)) {
      annotations.push({
        x: line.energy,
        text: line.label,
        color: "#22c55e",
        dash: "dash",
      });
    }

    // Edge annotations (dotted red) — only in visible range
    for (const edge of edges) {
      if (edge.energy > 100 && inRange(edge.energy)) {
        annotations.push({
          x: edge.energy,
          text: `${info.symbol} ${edge.label}`,
          color: "#ef4444",
        });
      }
    }

    return { traces, annotations };
  }, [ready, data, visibleCrossSections, filterOverlays, edgeXRange]);

  if (!ready) {
    return <LoadingState message="Loading element data..." />;
  }

  if (!data) {
    return (
      <div>
        <EmptyState message="Element not found." />
        <Link to="/" className="text-primary hover:underline">
          &larr; Back to periodic table
        </Link>
      </div>
    );
  }

  const { info, edges, lines, widths, filterZ1, filterZ2 } = data;

  return (
    <div>
      <Link
        to="/"
        className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground"
      >
        &larr; Back to periodic table
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10 text-2xl font-bold text-primary sm:h-20 sm:w-20 sm:text-3xl">
            {info.symbol}
          </div>
          <div>
            <h1 className="text-xl font-bold md:text-2xl">
              {info.name}{" "}
              <span className="text-muted-foreground">(Z={info.z})</span>
            </h1>
            <p className="text-muted-foreground">
              Molar mass: {info.molar_mass.toFixed(4)} g/mol &nbsp;&middot;&nbsp;
              Density: {info.density.toFixed(4)} g/cm³
            </p>
          </div>
        </div>
        <ToolDocsButton docId="/element/$z" />
      </div>

      {/* Cross-section type toggles */}
      <div className="mb-3 flex flex-wrap items-center gap-4">
        <div className="flex flex-wrap gap-1">
          <span className="mr-1 self-center text-xs text-muted-foreground">Cross-section:</span>
          {CROSS_SECTION_TYPES.map((cs) => {
            const active = visibleCrossSections.has(cs.key);
            return (
              <button
                key={cs.key}
                type="button"
                onClick={() => toggleCrossSection(cs.key)}
                aria-pressed={active}
                className={`rounded px-3 py-1.5 text-xs font-medium ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                {cs.label}
              </button>
            );
          })}
        </div>

        {/* Edge of interest selector */}
        {orderedEdges.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <span className="mr-1 self-center text-xs text-muted-foreground">Edge focus:</span>
            <button
              type="button"
              onClick={() => setSelectedEdge(null)}
              aria-pressed={selectedEdge === null}
              className={`rounded px-3 py-1.5 text-xs font-medium ${
                selectedEdge === null
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              Full Range
            </button>
            {orderedEdges.map((edge) => (
              <button
                key={edge.label}
                type="button"
                onClick={() => setSelectedEdge(edge.label)}
                aria-pressed={selectedEdge === edge.label}
                className={`rounded px-3 py-1.5 text-xs font-medium ${
                  selectedEdge === edge.label
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                {edge.label} ({edge.energy.toFixed(0)} eV)
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Cross-section / Filter Plot */}
      {crossSectionPlot.traces.length > 0 && (
        <div className="mb-6">
          <ScientificPlot
            traces={crossSectionPlot.traces}
            xTitle="Energy (eV)"
            yTitle="μ/ρ (cm²/g)"
            title={`${info.symbol} — Cross-section & Filter`}
            defaultLogY
            defaultLogX
            verticalLines={crossSectionPlot.annotations}
            height={400}
            xRange={edgeXRange}
          />
        </div>
      )}

      {/* Filter suggestions */}
      {(filterZ1 || filterZ2) && (
        <div className="mb-6 rounded-lg border border-border bg-card p-4">
          <h2 className="mb-2 text-lg font-semibold">
            Fluorescence Filter Suggestions
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Elements whose K-edge falls between the sample's fluorescence and
            absorption edge, useful as Z-1 / Z-2 filters. Click to overlay on the plot.
          </p>
          <div className="flex flex-wrap gap-3">
            {filterZ1 && (
              <button
                type="button"
                onClick={() => toggleFilter("z1")}
                className={`rounded-lg border px-4 py-2 ${
                  filterOverlays.has("z1")
                    ? "border-amber-500/50 bg-amber-500/15"
                    : "border-primary/30 bg-primary/5 hover:bg-primary/10"
                }`}
              >
                <span className={`text-sm font-semibold ${filterOverlays.has("z1") ? "text-amber-500" : "text-primary"}`}>
                  {filterZ1.symbol}
                </span>
                <span className="ml-2 text-xs text-muted-foreground">
                  Z-1 · K-edge: {filterZ1.kEdge.toFixed(1)} eV
                </span>
              </button>
            )}
            {filterZ2 && (
              <button
                type="button"
                onClick={() => toggleFilter("z2")}
                className={`rounded-lg border px-4 py-2 ${
                  filterOverlays.has("z2")
                    ? "border-purple-400/50 bg-purple-400/15"
                    : "border-border bg-card hover:bg-accent/50"
                }`}
              >
                <span className={`text-sm font-semibold ${filterOverlays.has("z2") ? "text-purple-400" : ""}`}>
                  {filterZ2.symbol}
                </span>
                <span className="ml-2 text-xs text-muted-foreground">
                  Z-2 · K-edge: {filterZ2.kEdge.toFixed(1)} eV
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        {/* Absorption Edges */}
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Absorption Edges</h2>
            {edges.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  downloadCsv(
                    `${info.symbol}_edges.csv`,
                    [
                      "Edge",
                      "Energy_eV",
                      "Wavelength_A",
                      "Fluor_Yield",
                      "Jump_Ratio",
                    ],
                    edges.map((e) => [
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
          {edges.length === 0 ? (
            <p className="text-sm text-muted-foreground">No edge data.</p>
          ) : (
            <ScrollableTable>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 pr-4">Edge</th>
                    <th className="pb-2 pr-4">Energy (eV)</th>
                    <th className="pb-2 pr-4">&lambda; (&Aring;)</th>
                    <th className="hidden pb-2 pr-4 sm:table-cell">Fluor. Yield</th>
                    <th className="hidden pb-2 sm:table-cell">Jump Ratio</th>
                  </tr>
                </thead>
                <tbody>
                  {edges.map((edge) => (
                    <tr
                      key={edge.label}
                      className="border-b border-border/50 last:border-0"
                    >
                      <td className="py-1.5 pr-4 font-medium">{edge.label}</td>
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
            <h2 className="text-lg font-semibold">Emission Lines</h2>
            {lines.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  downloadCsv(
                    `${info.symbol}_lines.csv`,
                    [
                      "Line",
                      "Energy_eV",
                      "Wavelength_A",
                      "Intensity",
                      "Initial",
                      "Final",
                    ],
                    lines.map((l) => [
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
          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">No line data.</p>
          ) : (
            <ScrollableTable className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 pr-4">Line</th>
                    <th className="pb-2 pr-4">Energy (eV)</th>
                    <th className="hidden pb-2 pr-4 sm:table-cell">&lambda; (&Aring;)</th>
                    <th className="pb-2 pr-4">Intensity</th>
                    <th className="hidden pb-2 pr-4 sm:table-cell">Initial</th>
                    <th className="hidden pb-2 sm:table-cell">Final</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr
                      key={line.label}
                      className="border-b border-border/50 last:border-0"
                    >
                      <td className="py-1.5 pr-4 font-medium">{line.label}</td>
                      <td className="py-1.5 pr-4 font-mono">
                        {line.energy.toFixed(1)}
                      </td>
                      <td className="hidden py-1.5 pr-4 font-mono text-muted-foreground sm:table-cell">
                        {line.energy > 0
                          ? (HC_ANGSTROM / line.energy).toFixed(4)
                          : "\u2014"}
                      </td>
                      <td className="py-1.5 pr-4 font-mono">
                        {line.intensity.toFixed(4)}
                      </td>
                      <td className="hidden py-1.5 pr-4 sm:table-cell">{line.initial_level}</td>
                      <td className="hidden py-1.5 sm:table-cell">{line.final_level}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollableTable>
          )}
        </div>

        {/* Core-hole Widths */}
        {widths.length > 0 && (
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Core-hole Widths</h2>
              <button
                type="button"
                onClick={() =>
                  downloadCsv(
                    `${info.symbol}_corehole_widths.csv`,
                    ["Edge", "Width_eV"],
                    widths.map((w) => [w.edge, w.width.toFixed(4)]),
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
                  {widths.map((w) => (
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
  );
}
