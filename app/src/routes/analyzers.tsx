import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useWasm } from "~/hooks/useWasm";
import {
  all_elements,
  xray_lines,
  darwin_width,
  xray_edge_energy,
} from "~/lib/wasm-api";
import type { ElementData } from "~/components/periodic-table/types";
import { LoadingState } from "~/components/ui/LoadingState";
import { PageHeader } from "~/components/ui/PageHeader";
import { EmptyState } from "~/components/ui/EmptyState";

export const Route = createFileRoute("/analyzers")({
  component: AnalyzersPage,
});

const CRYSTALS = ["Si", "Ge"];

interface Reflection {
  crystal: string;
  h: number;
  k: number;
  l: number;
  label: string;
}

// Common analyzer reflections
const REFLECTIONS: Reflection[] = [
  { crystal: "Si", h: 1, k: 1, l: 1, label: "Si(111)" },
  { crystal: "Si", h: 2, k: 2, l: 0, label: "Si(220)" },
  { crystal: "Si", h: 3, k: 1, l: 1, label: "Si(311)" },
  { crystal: "Si", h: 4, k: 0, l: 0, label: "Si(400)" },
  { crystal: "Si", h: 3, k: 3, l: 1, label: "Si(331)" },
  { crystal: "Si", h: 4, k: 2, l: 2, label: "Si(422)" },
  { crystal: "Si", h: 5, k: 3, l: 1, label: "Si(531)" },
  { crystal: "Si", h: 6, k: 2, l: 0, label: "Si(620)" },
  { crystal: "Ge", h: 1, k: 1, l: 1, label: "Ge(111)" },
  { crystal: "Ge", h: 2, k: 2, l: 0, label: "Ge(220)" },
  { crystal: "Ge", h: 3, k: 1, l: 1, label: "Ge(311)" },
  { crystal: "Ge", h: 4, k: 0, l: 0, label: "Ge(400)" },
  { crystal: "Ge", h: 3, k: 3, l: 1, label: "Ge(331)" },
  { crystal: "Ge", h: 4, k: 2, l: 2, label: "Ge(422)" },
];

interface AnalyzerResult {
  reflection: Reflection;
  braggAngle: number;
  darwinWidth: number; // μrad
  energyResolution: number; // eV
  deltaEoverE: number;
}

function AnalyzersPage() {
  const ready = useWasm();

  const [element, setElement] = useState("Fe");
  const [selectedLine, setSelectedLine] = useState("");
  const [crystalFilter, setCrystalFilter] = useState("All");
  const [minAngle, setMinAngle] = useState(10);
  const [maxAngle, setMaxAngle] = useState(89);

  // Get elements list for dropdown
  const elements: ElementData[] = useMemo(() => {
    if (!ready) return [];
    try {
      return all_elements() as ElementData[];
    } catch {
      return [];
    }
  }, [ready]);

  // Get emission lines for selected element
  const emissionLines = useMemo(() => {
    if (!ready || !element.trim()) return [];
    try {
      const lines = xray_lines(element.trim(), undefined, undefined) as {
        label: string;
        energy: number;
        intensity: number;
        initial_level: string;
        final_level: string;
      }[];
      return lines
        .filter((ln) => ln.energy > 0 && ln.intensity > 0.01)
        .sort((a, b) => b.intensity - a.intensity);
    } catch {
      return [];
    }
  }, [ready, element]);

  // Auto-select best line when element changes — prefer Ka1 for analyzer use
  useEffect(() => {
    if (emissionLines.length > 0 && !selectedLine) {
      const ka1 = emissionLines.find((l) => l.label === "Ka1");
      const ka2 = emissionLines.find((l) => l.label === "Ka2");
      setSelectedLine((ka1 ?? ka2 ?? emissionLines[0]).label);
    }
  }, [emissionLines, selectedLine]);

  // Line energy
  const lineEnergy = useMemo(() => {
    const line = emissionLines.find((l) => l.label === selectedLine);
    return line?.energy ?? 0;
  }, [emissionLines, selectedLine]);

  // Find matching analyzer crystals
  const analyzerResults: AnalyzerResult[] = useMemo(() => {
    if (!ready || lineEnergy <= 0) return [];

    const reflections =
      crystalFilter === "All"
        ? REFLECTIONS
        : REFLECTIONS.filter((r) => r.crystal === crystalFilter);

    const results: AnalyzerResult[] = [];

    for (const refl of reflections) {
      try {
        const dw = darwin_width(
          lineEnergy,
          refl.crystal,
          refl.h,
          refl.k,
          refl.l,
          "s",
        ) as {
          theta: number;
          theta_fwhm: number;
          energy_fwhm: number;
          rocking_theta_fwhm: number;
          rocking_energy_fwhm: number;
        } | null;

        if (!dw) continue;

        const braggDeg = (dw.theta * 180) / Math.PI;
        if (braggDeg < minAngle || braggDeg > maxAngle) continue;

        results.push({
          reflection: refl,
          braggAngle: braggDeg,
          darwinWidth: dw.theta_fwhm * 1e6, // μrad
          energyResolution: dw.energy_fwhm,
          deltaEoverE: dw.energy_fwhm / lineEnergy,
        });
      } catch {
        // skip invalid reflections
      }
    }

    // Sort by Bragg angle descending (prefer backscattering)
    results.sort((a, b) => b.braggAngle - a.braggAngle);

    return results;
  }, [ready, lineEnergy, crystalFilter, minAngle, maxAngle]);

  // Edge energy for context
  const edgeEnergy = useMemo(() => {
    if (!ready || !element.trim()) return null;
    try {
      return xray_edge_energy(element.trim(), "K") as number;
    } catch {
      return null;
    }
  }, [ready, element]);

  if (!ready) {
    return <LoadingState />;
  }

  return (
    <div>
      <PageHeader
        title="Analyzer Crystals"
        description="Find suitable analyzer crystal reflections for a given emission line. Ideal for RIXS and emission spectroscopy."
      />

      <div className="mb-6 grid gap-6 grid-cols-1 lg:grid-cols-[350px_1fr]">
        {/* Controls */}
        <div className="order-2 space-y-4 lg:order-none">
          <div>
            <label className="mb-1 block text-sm font-medium">Element</label>
            <input
              type="text"
              value={element}
              onChange={(e) => {
                setElement(e.target.value);
                setSelectedLine("");
              }}
              placeholder="e.g. Fe, Cu, Pt"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {emissionLines.length > 0 && (
            <div>
              <label className="mb-1 block text-sm font-medium">
                Emission Line
              </label>
              <select
                value={selectedLine}
                onChange={(e) => setSelectedLine(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {emissionLines.map((ln) => (
                  <option key={ln.label} value={ln.label}>
                    {ln.label} — {ln.energy.toFixed(1)} eV (I=
                    {ln.intensity.toFixed(3)})
                  </option>
                ))}
              </select>
            </div>
          )}

          {lineEnergy > 0 && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <p className="text-sm">
                {element} {selectedLine}:{" "}
                <span className="font-mono font-semibold text-primary">
                  {lineEnergy.toFixed(1)} eV
                </span>
              </p>
              {edgeEnergy && (
                <p className="mt-1 text-xs text-muted-foreground">
                  K-edge: {edgeEnergy.toFixed(1)} eV
                </p>
              )}
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium">Crystal</label>
            <select
              value={crystalFilter}
              onChange={(e) => setCrystalFilter(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="All">All</option>
              {CRYSTALS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Bragg Angle Range (°)
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <label className="block text-xs text-muted-foreground">
                  Min
                </label>
                <input
                  type="number"
                  value={minAngle}
                  step={1}
                  min={10}
                  max={89}
                  onChange={(e) => setMinAngle(Number(e.target.value))}
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground">
                  Max
                </label>
                <input
                  type="number"
                  value={maxAngle}
                  step={1}
                  min={10}
                  max={89}
                  onChange={(e) => setMaxAngle(Number(e.target.value))}
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Results table */}
        <div className="order-1 lg:order-none">
          <p className="mb-2 text-xs text-muted-foreground">
            {analyzerResults.length} matching reflections
          </p>

          {analyzerResults.length > 0 ? (
            <div className="max-h-[600px] overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="px-3 py-2">Reflection</th>
                    <th className="px-3 py-2">Bragg Angle (°)</th>
                    <th className="hidden px-3 py-2 sm:table-cell">Darwin Width (μrad)</th>
                    <th className="px-3 py-2">ΔE (eV)</th>
                    <th className="hidden px-3 py-2 sm:table-cell">ΔE/E</th>
                  </tr>
                </thead>
                <tbody>
                  {analyzerResults.map((r) => (
                    <tr
                      key={r.reflection.label}
                      className={`border-b border-border/30 hover:bg-accent/50 ${r.braggAngle > 80 ? "bg-primary/5" : ""}`}
                    >
                      <td className="px-3 py-1.5 font-medium">
                        {r.reflection.label}
                        {r.braggAngle > 80 && (
                          <span className="ml-2 text-xs text-primary">
                            near-backscatter
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 font-mono">
                        {r.braggAngle.toFixed(3)}
                      </td>
                      <td className="hidden px-3 py-1.5 font-mono sm:table-cell">
                        {r.darwinWidth.toFixed(2)}
                      </td>
                      <td className="px-3 py-1.5 font-mono">
                        {r.energyResolution.toFixed(4)}
                      </td>
                      <td className="hidden px-3 py-1.5 font-mono sm:table-cell">
                        {r.deltaEoverE.toExponential(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              message={
                lineEnergy > 0
                  ? "No reflections found in the specified angle range."
                  : "Select an element and emission line to find matching analyzers."
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}
