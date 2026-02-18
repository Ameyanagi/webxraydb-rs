import { useState, useMemo, lazy, Suspense } from "react";
import type { Data, Layout, Config } from "plotly.js";
import { useIsMobile } from "~/hooks/useIsMobile";

const Plot = lazy(() => import("react-plotly.js"));

export interface PlotTrace {
  x: number[];
  y: number[];
  name: string;
  mode?: "lines" | "markers" | "lines+markers";
  line?: { dash?: string; width?: number; color?: string };
  yaxis?: string;
}

export interface PlotAnnotation {
  x: number;
  text: string;
  color?: string;
}

interface ScientificPlotProps {
  traces: PlotTrace[];
  xTitle: string;
  yTitle: string;
  yTitle2?: string;
  title?: string;
  height?: number;
  showLogToggle?: boolean;
  defaultLogY?: boolean;
  defaultLogX?: boolean;
  verticalLines?: PlotAnnotation[];
}

export function ScientificPlot({
  traces,
  xTitle,
  yTitle,
  yTitle2,
  title,
  height = 450,
  showLogToggle = true,
  defaultLogY = false,
  defaultLogX = false,
  verticalLines,
}: ScientificPlotProps) {
  const isMobile = useIsMobile();
  const [logY, setLogY] = useState(defaultLogY);
  const [logX, setLogX] = useState(defaultLogX);

  const effectiveHeight = isMobile ? Math.min(height, 320) : height;
  const plotMargin = isMobile
    ? { l: 50, r: yTitle2 ? 50 : 20, t: title ? 35 : 15, b: 45 }
    : { l: 70, r: yTitle2 ? 70 : 30, t: title ? 40 : 20, b: 60 };

  const data: Data[] = useMemo(
    () =>
      traces.map((t) => ({
        x: t.x,
        y: t.y,
        name: t.name,
        type: "scatter" as const,
        mode: t.mode ?? "lines",
        line: t.line ?? { width: 2 },
        ...(t.yaxis ? { yaxis: t.yaxis } : {}),
      })),
    [traces],
  );

  const layout: Partial<Layout> = useMemo(
    () => {
      const shapes = verticalLines?.map((vl) => ({
        type: "line" as const,
        x0: vl.x,
        x1: vl.x,
        yref: "paper" as const,
        y0: 0,
        y1: 1,
        line: { color: vl.color ?? "#888", width: 1, dash: "dot" as const },
      }));
      const annotations = verticalLines?.map((vl) => ({
        x: vl.x,
        y: 1,
        yref: "paper" as const,
        text: vl.text,
        showarrow: false,
        font: { size: 10, color: vl.color ?? "#888" },
        yanchor: "bottom" as const,
      }));
      return {
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
        ...(yTitle2 ? {
          yaxis2: {
            title: { text: yTitle2, font: { color: "#aaa" } },
            type: logY ? "log" : "linear",
            color: "#888",
            overlaying: "y" as const,
            side: "right" as const,
            gridcolor: "transparent",
          },
        } : {}),
        paper_bgcolor: "transparent",
        plot_bgcolor: "rgba(20,20,20,0.5)",
        font: { color: "#ccc" },
        legend: {
          font: { color: "#ccc" },
          bgcolor: "transparent",
        },
        margin: plotMargin,
        height: effectiveHeight,
        autosize: true,
        shapes,
        annotations,
      };
    },
    [xTitle, yTitle, yTitle2, title, logX, logY, effectiveHeight, plotMargin, verticalLines],
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
            style={{ height: effectiveHeight }}
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
