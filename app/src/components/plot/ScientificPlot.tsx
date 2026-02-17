import { useState, useMemo, lazy, Suspense } from "react";
import type { Data, Layout, Config } from "plotly.js";

const Plot = lazy(() => import("react-plotly.js"));

export interface PlotTrace {
  x: number[];
  y: number[];
  name: string;
  mode?: "lines" | "markers" | "lines+markers";
  line?: { dash?: string; width?: number; color?: string };
}

interface ScientificPlotProps {
  traces: PlotTrace[];
  xTitle: string;
  yTitle: string;
  title?: string;
  height?: number;
  showLogToggle?: boolean;
  defaultLogY?: boolean;
  defaultLogX?: boolean;
}

export function ScientificPlot({
  traces,
  xTitle,
  yTitle,
  title,
  height = 450,
  showLogToggle = true,
  defaultLogY = false,
  defaultLogX = false,
}: ScientificPlotProps) {
  const [logY, setLogY] = useState(defaultLogY);
  const [logX, setLogX] = useState(defaultLogX);

  const data: Data[] = useMemo(
    () =>
      traces.map((t) => ({
        x: t.x,
        y: t.y,
        name: t.name,
        type: "scatter" as const,
        mode: t.mode ?? "lines",
        line: t.line ?? { width: 2 },
      })),
    [traces],
  );

  const layout: Partial<Layout> = useMemo(
    () => ({
      title: title ? { text: title, font: { size: 14, color: "#ccc" } } : undefined,
      xaxis: {
        title: { text: xTitle, font: { color: "#aaa" } },
        type: logX ? "log" : "linear",
        color: "#888",
        gridcolor: "#333",
        zerolinecolor: "#444",
      },
      yaxis: {
        title: { text: yTitle, font: { color: "#aaa" } },
        type: logY ? "log" : "linear",
        color: "#888",
        gridcolor: "#333",
        zerolinecolor: "#444",
      },
      paper_bgcolor: "transparent",
      plot_bgcolor: "rgba(20,20,20,0.5)",
      font: { color: "#ccc" },
      legend: {
        font: { color: "#ccc" },
        bgcolor: "transparent",
      },
      margin: { l: 70, r: 30, t: title ? 40 : 20, b: 60 },
      height,
      autosize: true,
    }),
    [xTitle, yTitle, title, logX, logY, height],
  );

  const config: Partial<Config> = useMemo(
    () => ({
      responsive: true,
      displayModeBar: true,
      modeBarButtonsToRemove: [
        "select2d",
        "lasso2d",
        "autoScale2d",
      ] as any[],
      toImageButtonOptions: {
        format: "svg",
        filename: title ?? "plot",
      },
    }),
    [title],
  );

  return (
    <div className="rounded-lg border border-border bg-card">
      {showLogToggle && (
        <div className="flex items-center gap-4 border-b border-border px-4 py-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={logX}
              onChange={(e) => setLogX(e.target.checked)}
              className="rounded"
            />
            Log X
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={logY}
              onChange={(e) => setLogY(e.target.checked)}
              className="rounded"
            />
            Log Y
          </label>
        </div>
      )}
      <Suspense
        fallback={
          <div
            className="flex items-center justify-center text-muted-foreground"
            style={{ height }}
          >
            Loading plot...
          </div>
        }
      >
        <Plot
          data={data}
          layout={layout}
          config={config}
          useResizeHandler
          className="w-full"
        />
      </Suspense>
    </div>
  );
}
