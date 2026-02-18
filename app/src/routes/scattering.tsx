import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useCallback } from "react";
import { useWasm } from "~/hooks/useWasm";
import { f1_chantler, f2_chantler } from "~/lib/wasm-api";
import { energyRange } from "~/lib/constants";
import { ScientificPlot } from "~/components/plot/ScientificPlot";
import type { PlotTrace } from "~/components/plot/ScientificPlot";
import { EnergyRangeInput } from "~/components/energy-range/EnergyRangeInput";

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
  const [error, setError] = useState<string | null>(null);

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

  const f1Traces: PlotTrace[] = useMemo(() => {
    if (!ready) return [];
    setError(null);
    const energies = energyRange(eStart, eEnd, eStep);
    const energyArr = Array.from(energies);
    const result: PlotTrace[] = [];

    for (const el of allElements) {
      try {
        const f1 = f1_chantler(el, energies);
        result.push({ x: energyArr, y: Array.from(f1), name: `${el} f'` });
      } catch (e: any) {
        if (el === element.trim()) setError(e.message ?? String(e));
      }
    }
    return result;
  }, [ready, allElements, eStart, eEnd, eStep, element]);

  const f2Traces: PlotTrace[] = useMemo(() => {
    if (!ready) return [];
    const energies = energyRange(eStart, eEnd, eStep);
    const energyArr = Array.from(energies);
    const result: PlotTrace[] = [];

    for (const el of allElements) {
      try {
        const f2 = f2_chantler(el, energies);
        result.push({ x: energyArr, y: Array.from(f2), name: `${el} f"` });
      } catch {
        // skip
      }
    }
    return result;
  }, [ready, allElements, eStart, eEnd, eStep]);

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
      <h1 className="mb-4 text-xl font-bold md:text-2xl">Scattering Factors</h1>
      <p className="mb-6 text-muted-foreground">
        Anomalous scattering factors f' and f" from Chantler tables.
      </p>

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

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        {/* Plots */}
        <div className="order-1 space-y-4 lg:order-none">
          <ScientificPlot
            traces={f1Traces}
            xTitle="Energy (eV)"
            yTitle="f' (e⁻)"
            title="f' — Real part (anomalous scattering)"
            height={350}
            showLogToggle={false}
          />
          <ScientificPlot
            traces={f2Traces}
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
