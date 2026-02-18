import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useWasm } from "~/hooks/useWasm";
import {
  all_elements,
  element_info,
  xray_edges,
  xray_lines,
  corehole_widths,
  mu_elam,
} from "~/lib/wasm-api";
import { energyRange } from "~/lib/constants";
import { PeriodicTable } from "~/components/periodic-table/PeriodicTable";
import type { ElementData } from "~/components/periodic-table/types";
import { ScientificPlot } from "~/components/plot/ScientificPlot";
import type { PlotTrace } from "~/components/plot/ScientificPlot";
import { downloadCsv } from "~/lib/csv-export";
import { LoadingState } from "~/components/ui/LoadingState";
import { PageHeader } from "~/components/ui/PageHeader";

const HC_ANGSTROM = 12398.4;

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  const ready = useWasm();
  const [selectedZ, setSelectedZ] = useState<number | null>(null);

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

  // Attenuation plot for the summary panel
  const attenuationPlot = useMemo<PlotTrace[]>(() => {
    if (!data || data.edges.length === 0) return [];
    try {
      const energies = energyRange(100, 40000, 50);
      const mu = mu_elam(data.info.symbol, energies, "total") as Float64Array;
      return [
        {
          x: Array.from(energies),
          y: Array.from(mu),
          name: `${data.info.symbol} total`,
        },
      ];
    } catch {
      return [];
    }
  }, [data]);

  // Top fluorescence lines (sorted by intensity, top 5)
  const topLines = useMemo(() => {
    if (!data) return [];
    return [...data.lines]
      .sort((a, b) => b.intensity - a.intensity)
      .slice(0, 5);
  }, [data]);

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

            {/* Attenuation card */}
            {attenuationPlot.length > 0 && (
              <div className="rounded-lg border border-border bg-card p-2">
                <h3 className="mb-1 px-1 text-xs font-semibold text-muted-foreground">
                  X-ray Attenuation (&mu;/&rho;)
                </h3>
                <ScientificPlot
                  traces={attenuationPlot}
                  xTitle="Energy (eV)"
                  yTitle="μ/ρ (cm²/g)"
                  height={180}
                  defaultLogY
                  defaultLogX
                  showLogToggle={false}
                />
              </div>
            )}

            {/* Top fluorescence lines card */}
            {topLines.length > 0 && (
              <div className="rounded-lg border border-border bg-card p-3">
                <h3 className="mb-2 text-xs font-semibold text-muted-foreground">
                  Fluorescence Lines (top {topLines.length})
                </h3>
                <div className="space-y-1">
                  {topLines.map((line) => (
                    <div
                      key={line.label}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="font-medium">{line.label}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {line.energy.toFixed(1)} eV
                      </span>
                    </div>
                  ))}
                </div>
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
                      onClick={() => setSelectedZ(data.filterZ1!.z)}
                      className="flex-1 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-sm hover:bg-primary/10"
                    >
                      <span className="font-semibold text-primary">
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
                      onClick={() => setSelectedZ(data.filterZ2!.z)}
                      className="flex-1 rounded-lg border border-border bg-card px-3 py-1.5 text-sm hover:bg-accent/50"
                    >
                      <span className="font-semibold">
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
                <div className="overflow-x-auto">
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
                </div>
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
                <div className="max-h-80 overflow-y-auto overflow-x-auto">
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
                </div>
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
