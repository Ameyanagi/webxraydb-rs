import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useWasm } from "~/hooks/useWasm";
import {
  element_info,
  xray_edges,
  xray_lines,
  corehole_widths,
} from "~/lib/wasm-api";
import { downloadCsv } from "~/lib/csv-export";

export const Route = createFileRoute("/element/$z")({
  component: ElementDetailPage,
});

const HC_ANGSTROM = 12398.4; // eV·Å

function ElementDetailPage() {
  const { z } = Route.useParams();
  const ready = useWasm();

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
      let filterZ1: { symbol: string; z: number; kEdge: number } | null = null;
      let filterZ2: { symbol: string; z: number; kEdge: number } | null = null;

      if (zNum > 2) {
        try {
          const f1 = element_info(String(zNum - 1));
          const f1Edges = xray_edges(String(zNum - 1)) as { label: string; energy: number }[];
          const kEdge = f1Edges.find((e) => e.label === "K");
          if (kEdge) filterZ1 = { symbol: f1.symbol, z: f1.z, kEdge: kEdge.energy };
        } catch { /* skip */ }
      }
      if (zNum > 3) {
        try {
          const f2 = element_info(String(zNum - 2));
          const f2Edges = xray_edges(String(zNum - 2)) as { label: string; energy: number }[];
          const kEdge = f2Edges.find((e) => e.label === "K");
          if (kEdge) filterZ2 = { symbol: f2.symbol, z: f2.z, kEdge: kEdge.energy };
        } catch { /* skip */ }
      }

      return { info, edges, lines, widths, filterZ1, filterZ2 };
    } catch {
      return null;
    }
  }, [ready, z]);

  if (!ready) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        Loading...
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <p className="text-muted-foreground">Element not found.</p>
        <Link to="/" className="text-primary hover:underline">
          ← Back to periodic table
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
        ← Back to periodic table
      </Link>

      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-primary/10 text-3xl font-bold text-primary">
          {info.symbol}
        </div>
        <div>
          <h1 className="text-2xl font-bold">
            {info.name}{" "}
            <span className="text-muted-foreground">(Z={info.z})</span>
          </h1>
          <p className="text-muted-foreground">
            Molar mass: {info.molar_mass.toFixed(4)} g/mol &nbsp;·&nbsp;
            Density: {info.density.toFixed(4)} g/cm³
          </p>
        </div>
      </div>

      {/* Filter suggestions */}
      {(filterZ1 || filterZ2) && (
        <div className="mb-6 rounded-lg border border-border bg-card p-4">
          <h2 className="mb-2 text-lg font-semibold">Fluorescence Filter Suggestions</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Elements whose K-edge falls between the sample's fluorescence and
            absorption edge, useful as Z-1 / Z-2 filters.
          </p>
          <div className="flex gap-4">
            {filterZ1 && (
              <Link
                to="/element/$z"
                params={{ z: String(filterZ1.z) }}
                className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 hover:bg-primary/10"
              >
                <span className="text-sm font-semibold text-primary">
                  {filterZ1.symbol}
                </span>
                <span className="ml-2 text-xs text-muted-foreground">
                  Z-1 · K-edge: {filterZ1.kEdge.toFixed(1)} eV
                </span>
              </Link>
            )}
            {filterZ2 && (
              <Link
                to="/element/$z"
                params={{ z: String(filterZ2.z) }}
                className="rounded-lg border border-border bg-card px-4 py-2 hover:bg-accent/50"
              >
                <span className="text-sm font-semibold">
                  {filterZ2.symbol}
                </span>
                <span className="ml-2 text-xs text-muted-foreground">
                  Z-2 · K-edge: {filterZ2.kEdge.toFixed(1)} eV
                </span>
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
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
                    ["Edge", "Energy_eV", "Wavelength_A", "Fluor_Yield", "Jump_Ratio"],
                    edges.map((e) => [
                      e.label,
                      e.energy.toFixed(1),
                      e.energy > 0 ? (HC_ANGSTROM / e.energy).toFixed(6) : "",
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 pr-4">Edge</th>
                    <th className="pb-2 pr-4">Energy (eV)</th>
                    <th className="pb-2 pr-4">λ (Å)</th>
                    <th className="pb-2 pr-4">Fluor. Yield</th>
                    <th className="pb-2">Jump Ratio</th>
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
                          : "—"}
                      </td>
                      <td className="py-1.5 pr-4 font-mono">
                        {edge.fluorescence_yield.toFixed(4)}
                      </td>
                      <td className="py-1.5 font-mono">
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
            <h2 className="text-lg font-semibold">Emission Lines</h2>
            {lines.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  downloadCsv(
                    `${info.symbol}_lines.csv`,
                    ["Line", "Energy_eV", "Wavelength_A", "Intensity", "Initial", "Final"],
                    lines.map((l) => [
                      l.label,
                      l.energy.toFixed(1),
                      l.energy > 0 ? (HC_ANGSTROM / l.energy).toFixed(6) : "",
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
            <div className="max-h-96 overflow-y-auto overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 pr-4">Line</th>
                    <th className="pb-2 pr-4">Energy (eV)</th>
                    <th className="pb-2 pr-4">λ (Å)</th>
                    <th className="pb-2 pr-4">Intensity</th>
                    <th className="pb-2 pr-4">Initial</th>
                    <th className="pb-2">Final</th>
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
                      <td className="py-1.5 pr-4 font-mono text-muted-foreground">
                        {line.energy > 0
                          ? (HC_ANGSTROM / line.energy).toFixed(4)
                          : "—"}
                      </td>
                      <td className="py-1.5 pr-4 font-mono">
                        {line.intensity.toFixed(4)}
                      </td>
                      <td className="py-1.5 pr-4">{line.initial_level}</td>
                      <td className="py-1.5">{line.final_level}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
