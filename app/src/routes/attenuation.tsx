import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useCallback } from "react";
import { useWasm } from "~/hooks/useWasm";
import { material_mu } from "~/lib/wasm-api";
import { energyRange } from "~/lib/constants";
import { validateRange } from "~/lib/inputs";
import { errorState, type CalculationState, readyState } from "~/lib/ui-state";
import { ScientificPlot } from "~/components/plot/ScientificPlot";
import type { PlotTrace } from "~/components/plot/ScientificPlot";
import { FormulaInput } from "~/components/formula-input/FormulaInput";
import { EnergyRangeInput } from "~/components/energy-range/EnergyRangeInput";
import { MaterialPicker } from "~/components/material-picker/MaterialPicker";
import { ErrorBanner } from "~/components/ui/ErrorBanner";
import { PageHeader } from "~/components/ui/PageHeader";

/**
 * Search params make a calculation shareable: /attenuation?formula=Fe2O3&rho=5.24
 * reproduces the plot. Defaults are omitted from the URL to keep it clean, and
 * malformed values fall back to the defaults instead of erroring the page.
 */
interface AttenuationSearch {
  formula?: string;
  rho?: number;
  e0?: number;
  e1?: number;
  estep?: number;
  kind?: string;
}

const SEARCH_DEFAULTS = {
  formula: "H2O",
  rho: 1.0,
  e0: 1000,
  e1: 30000,
  estep: 50,
  kind: "total",
} as const;

function searchNumber(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export const Route = createFileRoute("/attenuation")({
  component: AttenuationPage,
  validateSearch: (search: Record<string, unknown>): AttenuationSearch => ({
    ...(typeof search.formula === "string" && search.formula ? { formula: search.formula } : {}),
    ...(searchNumber(search.rho) !== undefined ? { rho: searchNumber(search.rho) } : {}),
    ...(searchNumber(search.e0) !== undefined ? { e0: searchNumber(search.e0) } : {}),
    ...(searchNumber(search.e1) !== undefined ? { e1: searchNumber(search.e1) } : {}),
    ...(searchNumber(search.estep) !== undefined ? { estep: searchNumber(search.estep) } : {}),
    ...(typeof search.kind === "string" &&
    CROSS_SECTION_KINDS.some((k) => k.value === search.kind)
      ? { kind: search.kind }
      : {}),
  }),
});

interface MaterialLayer {
  id: number;
  formula: string;
  density: number;
  label: string;
}

const CROSS_SECTION_KINDS = [
  { value: "total", label: "Total" },
  { value: "photo", label: "Photoelectric" },
  { value: "coherent", label: "Coherent" },
  { value: "incoherent", label: "Incoherent" },
  { value: "all", label: "All Contributions" },
];

let nextId = 1;

function AttenuationPage() {
  const ready = useWasm();
  // The URL is the single source of truth for the calculation inputs — the
  // page never navigates on its own (a mount-time navigate re-entered the
  // router during hydration and looped); only user edits navigate, with
  // history.replace so typing does not spam the back button.
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const formula = search.formula ?? SEARCH_DEFAULTS.formula;
  const density = search.rho ?? SEARCH_DEFAULTS.rho;
  const eStart = search.e0 ?? SEARCH_DEFAULTS.e0;
  const eEnd = search.e1 ?? SEARCH_DEFAULTS.e1;
  const eStep = search.estep ?? SEARCH_DEFAULTS.estep;
  const kind = search.kind ?? SEARCH_DEFAULTS.kind;
  const [materials, setMaterials] = useState<MaterialLayer[]>([]);

  const updateSearch = useCallback(
    (patch: Partial<Record<keyof AttenuationSearch, string | number>>) => {
      navigate({
        replace: true,
        search: (prev: AttenuationSearch): AttenuationSearch => {
          const merged = {
            formula: prev.formula ?? SEARCH_DEFAULTS.formula,
            rho: prev.rho ?? SEARCH_DEFAULTS.rho,
            e0: prev.e0 ?? SEARCH_DEFAULTS.e0,
            e1: prev.e1 ?? SEARCH_DEFAULTS.e1,
            estep: prev.estep ?? SEARCH_DEFAULTS.estep,
            kind: prev.kind ?? SEARCH_DEFAULTS.kind,
            ...patch,
          };
          // Omit defaults so a pristine page keeps a clean URL.
          return {
            ...(merged.formula !== SEARCH_DEFAULTS.formula ? { formula: String(merged.formula) } : {}),
            ...(merged.rho !== SEARCH_DEFAULTS.rho ? { rho: Number(merged.rho) } : {}),
            ...(merged.e0 !== SEARCH_DEFAULTS.e0 ? { e0: Number(merged.e0) } : {}),
            ...(merged.e1 !== SEARCH_DEFAULTS.e1 ? { e1: Number(merged.e1) } : {}),
            ...(merged.estep !== SEARCH_DEFAULTS.estep ? { estep: Number(merged.estep) } : {}),
            ...(merged.kind !== SEARCH_DEFAULTS.kind ? { kind: String(merged.kind) } : {}),
          };
        },
      });
    },
    [navigate],
  );

  const setFormula = useCallback((v: string) => updateSearch({ formula: v }), [updateSearch]);
  const setDensity = useCallback((v: number) => updateSearch({ rho: v }), [updateSearch]);
  const setEStart = useCallback((v: number) => updateSearch({ e0: v }), [updateSearch]);
  const setEEnd = useCallback((v: number) => updateSearch({ e1: v }), [updateSearch]);
  const setEStep = useCallback((v: number) => updateSearch({ estep: v }), [updateSearch]);
  const setKind = useCallback((v: string) => updateSearch({ kind: v }), [updateSearch]);

  const handleMaterialSelect = useCallback(
    (f: string, d: number) => {
      setFormula(f);
      setDensity(d);
    },
    [],
  );

  const addMaterial = useCallback(() => {
    if (!formula.trim()) return;
    setMaterials((prev) => [
      ...prev,
      {
        id: nextId++,
        formula: formula.trim(),
        density,
        label: `${formula.trim()} (ρ=${density})`,
      },
    ]);
  }, [formula, density]);

  const removeMaterial = useCallback((id: number) => {
    setMaterials((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const traceState = useMemo<CalculationState<PlotTrace[]>>(() => {
    if (!ready) return { status: "idle", data: null, error: null };
    if (!formula.trim()) return errorState("Enter a chemical formula to calculate attenuation");
    if (!(density > 0)) return errorState("Density must be greater than zero");

    const range = validateRange(eStart, eEnd, eStep, 25000);
    if (!range.valid) return errorState(range.error ?? "Invalid energy range");

    try {
      const energies = energyRange(eStart, eEnd, eStep);
      const energyArr = Array.from(energies);
      const result: PlotTrace[] = [];

      if (kind === "all") {
        const contributions = [
          { kind: "total", label: "Total", dash: undefined as undefined, color: undefined as string | undefined },
          { kind: "photo", label: "Photoelectric", dash: "dash" as const, color: "#f97316" },
          { kind: "coherent", label: "Coherent", dash: "dot" as const, color: "#22c55e" },
          { kind: "incoherent", label: "Incoherent", dash: "dashdot" as const, color: "#a855f7" },
        ];
        for (const c of contributions) {
          const mu = material_mu(formula.trim(), density, energies, c.kind);
          result.push({
            x: energyArr,
            y: Array.from(mu),
            name: `${formula} — ${c.label}`,
            line: c.dash ? { dash: c.dash, width: 2, color: c.color } : undefined,
          });
        }
      } else {
        const mu = material_mu(formula.trim(), density, energies, kind);
        result.push({
          x: energyArr,
          y: Array.from(mu),
          name: `${formula} (ρ=${density})`,
        });

        for (const mat of materials) {
          try {
            const overlayMu = material_mu(mat.formula, mat.density, energies, kind);
            result.push({
              x: energyArr,
              y: Array.from(overlayMu),
              name: mat.label,
              line: { dash: "dot", width: 2 },
            });
          } catch {
            // Ignore invalid overlay material while preserving primary trace.
          }
        }
      }

      return readyState(result);
    } catch (e: unknown) {
      return errorState(e instanceof Error ? e.message : String(e));
    }
  }, [ready, formula, density, eStart, eEnd, eStep, kind, materials]);

  return (
    <div>
      <PageHeader
        title="X-ray Attenuation"
        description="Calculate material linear attenuation coefficient μ (1/cm) as a function of X-ray energy."
      />

      <div className="mb-6 grid gap-6 grid-cols-1 lg:grid-cols-[350px_1fr]">
        {/* Controls */}
        <div className="order-2 space-y-4 lg:order-none">
          <MaterialPicker onSelect={handleMaterialSelect} />

          <FormulaInput value={formula} onChange={setFormula} />

          <div>
            <label className="mb-1 block text-sm font-medium">
              Density (g/cm³)
            </label>
            <input
              type="number"
              value={density}
              step={0.001}
              onChange={(e) => setDensity(Number(e.target.value))}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
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
            <label className="mb-1 block text-sm font-medium">
              Cross-section Type
            </label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {CROSS_SECTION_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>

          {/* Overlay materials */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={addMaterial}
              className="rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
            >
              + Add to overlay
            </button>
            {materials.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded border border-border px-2 py-1 text-xs"
              >
                <span>{m.label}</span>
                <button
                  type="button"
                  onClick={() => removeMaterial(m.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {traceState.error && <ErrorBanner message={traceState.error} />}
        </div>

        {/* Plot */}
        <div className="order-1 lg:order-none">
        <ScientificPlot
          traces={traceState.data ?? []}
          xTitle="Energy (eV)"
          yTitle="μ (1/cm)"
          title={`Attenuation — ${kind === "all" ? "All Contributions" : kind}`}
          defaultLogY
        />
        </div>
      </div>
    </div>
  );
}
