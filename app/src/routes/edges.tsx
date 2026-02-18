import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useWasm } from "~/hooks/useWasm";
import { all_elements, xray_edges, guess_edge } from "~/lib/wasm-api";
import type { ElementData } from "~/components/periodic-table/types";
import { downloadCsv } from "~/lib/csv-export";

const HC_ANGSTROM = 12398.4;

export const Route = createFileRoute("/edges")({
  component: EdgeFinderPage,
});

interface EdgeRow {
  element: string;
  z: number;
  edge: string;
  energy: number;
  fluorescenceYield: number;
  jumpRatio: number;
}

const EDGE_FILTERS = [
  "All",
  "K",
  "L1",
  "L2",
  "L3",
  "M1",
  "M2",
  "M3",
  "M4",
  "M5",
];

type Harmonic = "fundamental" | "2nd" | "3rd";

function EdgeFinderPage() {
  const ready = useWasm();

  const [energySearch, setEnergySearch] = useState("");
  const [edgeFilter, setEdgeFilter] = useState("All");
  const [sortBy, setSortBy] = useState<"energy" | "z">("energy");
  const [sortAsc, setSortAsc] = useState(true);
  const [harmonic, setHarmonic] = useState<Harmonic>("fundamental");
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLTableRowElement>(null);

  // The effective search energy (adjusted for harmonics)
  const effectiveEnergy = useMemo(() => {
    const raw = parseFloat(energySearch);
    if (isNaN(raw) || raw <= 0) return null;
    switch (harmonic) {
      case "2nd":
        return raw / 2;
      case "3rd":
        return raw / 3;
      default:
        return raw;
    }
  }, [energySearch, harmonic]);

  // Build full edge database on first render
  const allEdges: EdgeRow[] = useMemo(() => {
    if (!ready) return [];
    const elements = all_elements() as ElementData[];
    const rows: EdgeRow[] = [];

    for (const el of elements) {
      try {
        const edges = xray_edges(el.symbol) as {
          label: string;
          energy: number;
          fluorescence_yield: number;
          jump_ratio: number;
        }[];
        for (const e of edges) {
          if (e.energy > 0) {
            rows.push({
              element: el.symbol,
              z: el.z,
              edge: e.label,
              energy: e.energy,
              fluorescenceYield: e.fluorescence_yield,
              jumpRatio: e.jump_ratio,
            });
          }
        }
      } catch {
        // skip elements without edge data
      }
    }

    return rows;
  }, [ready]);

  // Quick guess from energy
  const guessResult = useMemo(() => {
    if (!ready || effectiveEnergy === null) return null;
    try {
      return guess_edge(effectiveEnergy) as {
        element: string;
        edge: string;
      } | null;
    } catch {
      return null;
    }
  }, [ready, effectiveEnergy]);

  // Filter and sort — show all edges, scroll to closest
  const filtered = useMemo(() => {
    let rows = allEdges;

    if (edgeFilter !== "All") {
      rows = rows.filter((r) => r.edge === edgeFilter);
    }

    rows = [...rows].sort((a, b) => {
      const cmp = sortBy === "energy" ? a.energy - b.energy : a.z - b.z;
      return sortAsc ? cmp : -cmp;
    });

    return rows;
  }, [allEdges, edgeFilter, sortBy, sortAsc]);

  // Find the index of the closest edge to the searched energy
  const closestIndex = useMemo(() => {
    if (effectiveEnergy === null || filtered.length === 0) return -1;

    let bestIdx = 0;
    let bestDist = Math.abs(filtered[0].energy - effectiveEnergy);
    for (let i = 1; i < filtered.length; i++) {
      const dist = Math.abs(filtered[i].energy - effectiveEnergy);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    return bestIdx;
  }, [filtered, effectiveEnergy]);

  // Scroll to highlighted row when it changes
  useEffect(() => {
    if (
      closestIndex >= 0 &&
      highlightRef.current &&
      scrollContainerRef.current
    ) {
      const container = scrollContainerRef.current;
      const row = highlightRef.current;
      const containerRect = container.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      const offset =
        rowRect.top -
        containerRect.top -
        containerRect.height / 2 +
        rowRect.height / 2;
      container.scrollTop += offset;
    }
  }, [closestIndex]);

  const toggleSort = useCallback(
    (col: "energy" | "z") => {
      if (sortBy === col) {
        setSortAsc(!sortAsc);
      } else {
        setSortBy(col);
        setSortAsc(true);
      }
    },
    [sortBy, sortAsc],
  );

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
      <h1 className="mb-4 text-xl font-bold md:text-2xl">Edge Finder</h1>
      <p className="mb-6 text-muted-foreground">
        Enter an energy to find the closest absorption edge. Use harmonic
        buttons to find edges at 1/2 or 1/3 of the energy.
      </p>

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Energy (eV)</label>
          <input
            type="number"
            value={energySearch}
            onChange={(e) => setEnergySearch(e.target.value)}
            placeholder="e.g. 7112"
            className="w-48 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Edge Type</label>
          <select
            value={edgeFilter}
            onChange={(e) => setEdgeFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {EDGE_FILTERS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Harmonic</label>
          <div className="flex gap-1">
            {(["fundamental", "2nd", "3rd"] as Harmonic[]).map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHarmonic(h)}
                className={`rounded px-3 py-2 text-sm ${
                  harmonic === h
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
              >
                {h === "fundamental"
                  ? "Fundamental"
                  : h === "2nd"
                    ? "2nd (E/2)"
                    : "3rd (E/3)"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {guessResult && (
        <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <p className="text-sm">
            Closest match:{" "}
            <span className="font-semibold text-primary">
              {guessResult.element} {guessResult.edge}
            </span>
            {harmonic !== "fundamental" && effectiveEnergy !== null && (
              <span className="ml-2 text-muted-foreground">
                (searching at {effectiveEnergy.toFixed(1)} eV)
              </span>
            )}
          </p>
        </div>
      )}

      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{filtered.length} edges</p>
        {filtered.length > 0 && (
          <button
            type="button"
            onClick={() =>
              downloadCsv(
                "edges.csv",
                [
                  "Element",
                  "Z",
                  "Edge",
                  "Energy_eV",
                  "Wavelength_A",
                  "Fluor_Yield",
                  "Jump_Ratio",
                ],
                filtered.map((r) => [
                  r.element,
                  String(r.z),
                  r.edge,
                  r.energy.toFixed(1),
                  (HC_ANGSTROM / r.energy).toFixed(6),
                  r.fluorescenceYield.toFixed(4),
                  r.jumpRatio.toFixed(4),
                ]),
              )
            }
            className="text-xs text-muted-foreground hover:text-primary"
          >
            Export CSV
          </button>
        )}
      </div>

      <div
        ref={scrollContainerRef}
        className="max-h-[600px] overflow-y-auto rounded-lg border border-border"
      >
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-card">
            <tr className="border-b border-border text-left text-muted-foreground">
              <th
                className="cursor-pointer px-3 py-2"
                onClick={() => toggleSort("z")}
              >
                Element {sortBy === "z" ? (sortAsc ? "\u2191" : "\u2193") : ""}
              </th>
              <th className="px-3 py-2">Edge</th>
              <th
                className="cursor-pointer px-3 py-2"
                onClick={() => toggleSort("energy")}
              >
                Energy (eV){" "}
                {sortBy === "energy" ? (sortAsc ? "\u2191" : "\u2193") : ""}
              </th>
              <th className="hidden px-3 py-2 sm:table-cell">&lambda; (&Aring;)</th>
              <th className="hidden px-3 py-2 sm:table-cell">Fluor. Yield</th>
              <th className="hidden px-3 py-2 sm:table-cell">Jump Ratio</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => {
              const isHighlight = i === closestIndex;
              return (
                <tr
                  key={`${r.element}-${r.edge}-${i}`}
                  ref={isHighlight ? highlightRef : undefined}
                  className={
                    isHighlight
                      ? "border-b border-primary/40 bg-primary/15 text-foreground"
                      : "border-b border-border/30 hover:bg-accent/50"
                  }
                >
                  <td className="px-3 py-1.5 font-medium">
                    {r.element}{" "}
                    <span className="text-muted-foreground">(Z={r.z})</span>
                  </td>
                  <td className="px-3 py-1.5">{r.edge}</td>
                  <td className="px-3 py-1.5 font-mono">
                    {r.energy.toFixed(1)}
                  </td>
                  <td className="hidden px-3 py-1.5 font-mono text-muted-foreground sm:table-cell">
                    {r.energy > 0
                      ? (HC_ANGSTROM / r.energy).toFixed(4)
                      : "\u2014"}
                  </td>
                  <td className="hidden px-3 py-1.5 font-mono sm:table-cell">
                    {r.fluorescenceYield.toFixed(4)}
                  </td>
                  <td className="hidden px-3 py-1.5 font-mono sm:table-cell">
                    {r.jumpRatio.toFixed(4)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
