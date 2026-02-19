import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useWasm } from "~/hooks/useWasm";
import { all_elements, xray_lines } from "~/lib/wasm-api";
import { parseNumberOrNull } from "~/lib/inputs";
import { findClosestIndexByValue, stableSort } from "~/lib/table";
import type { ElementData } from "~/components/periodic-table/types";
import { downloadCsv } from "~/lib/csv-export";
import { PageHeader } from "~/components/ui/PageHeader";
import { LoadingState } from "~/components/ui/LoadingState";
import { EmptyState } from "~/components/ui/EmptyState";

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

const DEFAULT_LINE_FAMILIES = ["Ka", "Kb", "La", "Lb"];
const EXTRA_LINE_FAMILIES = ["Lg", "Ma", "Mb"];

function LineFinderPage() {
  const ready = useWasm();

  const [energySearch, setEnergySearch] = useState("");
  const [familyFilter, setFamilyFilter] = useState("All");
  const [sortBy, setSortBy] = useState<"energy" | "intensity">("energy");
  const [sortAsc, setSortAsc] = useState(true);
  const [showExtraFamilies, setShowExtraFamilies] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLTableRowElement>(null);

  // Reset family filter if it was set to an extra family when hiding extras
  useEffect(() => {
    if (!showExtraFamilies && EXTRA_LINE_FAMILIES.includes(familyFilter)) {
      setFamilyFilter("All");
    }
  }, [showExtraFamilies, familyFilter]);

  // Available family filter options
  const visibleFamilyFilters = useMemo(() => {
    const base = ["All", ...DEFAULT_LINE_FAMILIES];
    return showExtraFamilies ? [...base, ...EXTRA_LINE_FAMILIES] : base;
  }, [showExtraFamilies]);

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

    // Pre-filter to default families when extras are hidden
    if (!showExtraFamilies) {
      rows = rows.filter((r) =>
        DEFAULT_LINE_FAMILIES.some((f) => r.line.startsWith(f)),
      );
    }

    if (familyFilter !== "All") {
      rows = rows.filter((r) => r.line.startsWith(familyFilter));
    }

    rows = stableSort(rows, (a, b) => {
      const cmp =
        sortBy === "energy"
          ? a.energy - b.energy
          : b.intensity - a.intensity;
      return sortAsc ? cmp : -cmp;
    });

    return rows;
  }, [allLines, familyFilter, sortBy, sortAsc, showExtraFamilies]);

  // Find the index of the closest line to the searched energy
  const closestIndex = useMemo(() => {
    if (!energySearch.trim()) return -1;
    const e = parseNumberOrNull(energySearch);
    if (e === null || e <= 0 || filtered.length === 0) return -1;
    return findClosestIndexByValue(filtered, (row) => row.energy, e);
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
    return <LoadingState />;
  }

  return (
    <div>
      <PageHeader
        title="Line Finder"
        description="Enter an energy to find the closest emission line. The table scrolls to the match."
      />

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
            {visibleFamilyFilters.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => setShowExtraFamilies(!showExtraFamilies)}
          className={`rounded px-3 py-2 text-sm ${
            showExtraFamilies
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          }`}
        >
          {showExtraFamilies ? "Hide Lg/M Lines" : "Show Lg/M Lines"}
        </button>
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

      {filtered.length === 0 ? (
        <EmptyState message="No lines match the current filters." />
      ) : (
        <div
          ref={scrollContainerRef}
          className="max-h-[600px] overflow-y-auto rounded-lg border border-border"
        >
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-3 py-2">Element</th>
                <th className="px-3 py-2">Line</th>
                <th className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => toggleSort("energy")}
                    className="cursor-pointer hover:text-foreground"
                  >
                    Energy (eV){" "}
                    {sortBy === "energy" ? (sortAsc ? "\u2191" : "\u2193") : ""}
                  </button>
                </th>
                <th className="hidden px-3 py-2 sm:table-cell">&lambda; (&Aring;)</th>
                <th className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => toggleSort("intensity")}
                    className="cursor-pointer hover:text-foreground"
                  >
                    Intensity{" "}
                    {sortBy === "intensity"
                      ? sortAsc
                        ? "\u2191"
                        : "\u2193"
                      : ""}
                  </button>
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
      )}
    </div>
  );
}
