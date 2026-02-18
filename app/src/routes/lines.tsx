import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useWasm } from "~/hooks/useWasm";
import { all_elements, xray_lines } from "~/lib/wasm-api";
import type { ElementData } from "~/components/periodic-table/types";
import { downloadCsv } from "~/lib/csv-export";

const HC_ANGSTROM = 12398.4;

export const Route = createFileRoute("/lines")({
  component: LineFinderPage,
});

interface LineRow {
  element: string;
  z: number;
  line: string;
  energy: number;
  intensity: number;
  initialLevel: string;
  finalLevel: string;
}

const LINE_FAMILIES = ["All", "Ka", "Kb", "La", "Lb", "Lg", "Ma", "Mb"];

function LineFinderPage() {
  const ready = useWasm();

  const [energySearch, setEnergySearch] = useState("");
  const [familyFilter, setFamilyFilter] = useState("All");
  const [sortBy, setSortBy] = useState<"energy" | "intensity">("energy");
  const [sortAsc, setSortAsc] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLTableRowElement>(null);

  // Build full emission line database
  const allLines: LineRow[] = useMemo(() => {
    if (!ready) return [];
    const elements = all_elements() as ElementData[];
    const rows: LineRow[] = [];

    for (const el of elements) {
      try {
        const lines = xray_lines(el.symbol, undefined, undefined) as {
          label: string;
          energy: number;
          intensity: number;
          initial_level: string;
          final_level: string;
        }[];
        for (const ln of lines) {
          if (ln.energy > 0) {
            rows.push({
              element: el.symbol,
              z: el.z,
              line: ln.label,
              energy: ln.energy,
              intensity: ln.intensity,
              initialLevel: ln.initial_level,
              finalLevel: ln.final_level,
            });
          }
        }
      } catch {
        // skip elements without line data
      }
    }

    return rows;
  }, [ready]);

  // Filter and sort — show all lines, scroll to closest
  const filtered = useMemo(() => {
    let rows = allLines;

    if (familyFilter !== "All") {
      rows = rows.filter((r) => r.line.startsWith(familyFilter));
    }

    rows = [...rows].sort((a, b) => {
      const cmp =
        sortBy === "energy"
          ? a.energy - b.energy
          : b.intensity - a.intensity;
      return sortAsc ? cmp : -cmp;
    });

    return rows;
  }, [allLines, familyFilter, sortBy, sortAsc]);

  // Find the index of the closest line to the searched energy
  const closestIndex = useMemo(() => {
    if (!energySearch.trim()) return -1;
    const e = parseFloat(energySearch);
    if (isNaN(e) || e <= 0 || filtered.length === 0) return -1;

    let bestIdx = 0;
    let bestDist = Math.abs(filtered[0].energy - e);
    for (let i = 1; i < filtered.length; i++) {
      const dist = Math.abs(filtered[i].energy - e);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    return bestIdx;
  }, [filtered, energySearch]);

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
    (col: "energy" | "intensity") => {
      if (sortBy === col) {
        setSortAsc(!sortAsc);
      } else {
        setSortBy(col);
        setSortAsc(col === "energy");
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
      <h1 className="mb-4 text-xl font-bold md:text-2xl">Line Finder</h1>
      <p className="mb-6 text-muted-foreground">
        Enter an energy to find the closest emission line. The table scrolls to
        the match.
      </p>

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Energy (eV)</label>
          <input
            type="number"
            value={energySearch}
            onChange={(e) => setEnergySearch(e.target.value)}
            placeholder="e.g. 6404"
            className="w-48 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Line Family</label>
          <select
            value={familyFilter}
            onChange={(e) => setFamilyFilter(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {LINE_FAMILIES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
      </div>

      {closestIndex >= 0 && filtered[closestIndex] && (
        <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <p className="text-sm">
            Closest match:{" "}
            <span className="font-semibold text-primary">
              {filtered[closestIndex].element} {filtered[closestIndex].line}
            </span>
            <span className="ml-2 text-muted-foreground">
              ({filtered[closestIndex].energy.toFixed(1)} eV)
            </span>
          </p>
        </div>
      )}

      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {filtered.length} lines
        </p>
        {filtered.length > 0 && (
          <button
            type="button"
            onClick={() =>
              downloadCsv(
                "lines.csv",
                [
                  "Element",
                  "Z",
                  "Line",
                  "Energy_eV",
                  "Wavelength_A",
                  "Intensity",
                  "Initial",
                  "Final",
                ],
                filtered.map((r) => [
                  r.element,
                  String(r.z),
                  r.line,
                  r.energy.toFixed(1),
                  (HC_ANGSTROM / r.energy).toFixed(6),
                  r.intensity.toFixed(4),
                  r.initialLevel,
                  r.finalLevel,
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
              <th className="px-3 py-2">Element</th>
              <th className="px-3 py-2">Line</th>
              <th
                className="cursor-pointer px-3 py-2"
                onClick={() => toggleSort("energy")}
              >
                Energy (eV){" "}
                {sortBy === "energy" ? (sortAsc ? "\u2191" : "\u2193") : ""}
              </th>
              <th className="hidden px-3 py-2 sm:table-cell">&lambda; (&Aring;)</th>
              <th
                className="cursor-pointer px-3 py-2"
                onClick={() => toggleSort("intensity")}
              >
                Intensity{" "}
                {sortBy === "intensity"
                  ? sortAsc
                    ? "\u2191"
                    : "\u2193"
                  : ""}
              </th>
              <th className="hidden px-3 py-2 sm:table-cell">Transition</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => {
              const isHighlight = i === closestIndex;
              return (
                <tr
                  key={`${r.element}-${r.line}-${i}`}
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
                  <td className="px-3 py-1.5">{r.line}</td>
                  <td className="px-3 py-1.5 font-mono">
                    {r.energy.toFixed(1)}
                  </td>
                  <td className="hidden px-3 py-1.5 font-mono text-muted-foreground sm:table-cell">
                    {r.energy > 0
                      ? (HC_ANGSTROM / r.energy).toFixed(4)
                      : "\u2014"}
                  </td>
                  <td className="px-3 py-1.5 font-mono">
                    {r.intensity.toFixed(4)}
                  </td>
                  <td className="hidden px-3 py-1.5 text-muted-foreground sm:table-cell">
                    {r.initialLevel} &rarr; {r.finalLevel}
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
