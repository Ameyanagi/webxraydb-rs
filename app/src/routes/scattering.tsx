import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useCallback } from "react";
import { useWasm } from "~/hooks/useWasm";
import { f1_chantler, f2_chantler } from "~/lib/wasm-api";
import { energyRange } from "~/lib/constants";
import { errorState, type CalculationState, readyState } from "~/lib/ui-state";
import { validateRange } from "~/lib/inputs";
import { ScientificPlot } from "~/components/plot/ScientificPlot";
import type { PlotTrace } from "~/components/plot/ScientificPlot";
import { EnergyRangeInput } from "~/components/energy-range/EnergyRangeInput";
import { LoadingState } from "~/components/ui/LoadingState";
import { ErrorBanner } from "~/components/ui/ErrorBanner";
import { PageHeader } from "~/components/ui/PageHeader";

export const Route = createFileRoute("/scattering")({
  component: ScatteringPage,
});

function ScatteringPage() {
  const ready = useWasm();

  const [element, setElement] = useState("Fe");
  const [eStart, setEStart] = useState(1000);
  const [eEnd, setEEnd] = useState(30000);
  const [eStep, setEStep] = useState(10);
  const [overlayElements, setOverlayElements] = useState<string[]>([]);

  const addOverlay = useCallback(() => {
    if (element.trim() && !overlayElements.includes(element.trim())) {
      setOverlayElements((prev) => [...prev, element.trim()]);
    }
  }, [element, overlayElements]);

  const removeOverlay = useCallback((el: string) => {
    setOverlayElements((prev) => prev.filter((e) => e !== el));
  }, []);

  const allElements = useMemo(
    () => [element.trim(), ...overlayElements].filter(Boolean),
    [element, overlayElements],
  );

  const traceState = useMemo<
    CalculationState<{ f1Traces: PlotTrace[]; f2Traces: PlotTrace[] }>
  >(() => {
    if (!ready) return { status: "idle", data: null, error: null };
    if (!element.trim()) return errorState("Enter an element symbol");

    const range = validateRange(eStart, eEnd, eStep, 30000);
    if (!range.valid) return errorState(range.error ?? "Invalid energy range");

    try {
      const energies = energyRange(eStart, eEnd, eStep);
      const energyArr = Array.from(energies);
      const f1Traces: PlotTrace[] = [];
      const f2Traces: PlotTrace[] = [];
      let primaryError: string | null = null;

      for (const el of allElements) {
        try {
          const f1 = f1_chantler(el, energies);
          f1Traces.push({ x: energyArr, y: Array.from(f1), name: `${el} f'` });
        } catch (e: unknown) {
          if (el === element.trim()) {
            primaryError = e instanceof Error ? e.message : String(e);
          }
        }
      }

      for (const el of allElements) {
        try {
          const f2 = f2_chantler(el, energies);
          f2Traces.push({ x: energyArr, y: Array.from(f2), name: `${el} f"` });
        } catch {
          // Ignore invalid overlays while keeping valid traces.
        }
      }

      if (primaryError) return errorState(primaryError);
      return readyState({ f1Traces, f2Traces });
    } catch (e: unknown) {
      return errorState(e instanceof Error ? e.message : String(e));
    }
  }, [ready, allElements, eStart, eEnd, eStep, element]);

  if (!ready) {
    return <LoadingState />;
  }

  return (
    <div>
      <PageHeader
        title="Scattering Factors"
        description={`Anomalous scattering factors f' and f" from Chantler tables.`}
      />

      <div className="mb-6 grid gap-6 grid-cols-1 lg:grid-cols-[300px_1fr]">
        {/* Controls */}
        <div className="order-2 space-y-4 lg:order-none">
          <div>
            <label className="mb-1 block text-sm font-medium">Element</label>
            <input
              type="text"
              value={element}
              onChange={(e) => setElement(e.target.value)}
              placeholder="e.g. Fe, Cu, Pt"
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

          <div className="space-y-2">
            <button
              type="button"
              onClick={addOverlay}
              className="rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80"
            >
              + Add element overlay
            </button>
            {overlayElements.map((el) => (
              <div
                key={el}
                className="flex items-center justify-between rounded border border-border px-2 py-1 text-xs"
              >
                <span>{el}</span>
                <button
                  type="button"
                  onClick={() => removeOverlay(el)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {traceState.error && <ErrorBanner message={traceState.error} />}
        </div>

        {/* Plots */}
        <div className="order-1 space-y-4 lg:order-none">
          <ScientificPlot
            traces={traceState.data?.f1Traces ?? []}
            xTitle="Energy (eV)"
            yTitle="f' (e⁻)"
            title="f' — Real part (anomalous scattering)"
            height={350}
            showLogToggle={false}
          />
          <ScientificPlot
            traces={traceState.data?.f2Traces ?? []}
            xTitle="Energy (eV)"
            yTitle='f" (e⁻)'
            title='f" — Imaginary part (anomalous scattering)'
            height={350}
            defaultLogY
          />
        </div>
      </div>
    </div>
  );
}
