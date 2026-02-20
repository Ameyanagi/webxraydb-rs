import { useState, useMemo, lazy, Suspense } from "react";
import type { Data, Layout, Config, ScatterLine } from "plotly.js";
import { useIsMobile } from "~/hooks/useIsMobile";
import { useTheme } from "~/lib/theme";

const Plot = lazy(() => import("react-plotly.js"));

export interface PlotTrace {
  x: number[];
  y: number[];
  name: string;
  mode?: "lines" | "markers" | "lines+markers";
  line?: { dash?: ScatterLine["dash"]; width?: number; color?: string };
  yaxis?: "y" | "y2";
  text?: string[];
}

export interface PlotAnnotation {
  x: number;
  text: string;
  color?: string;
  dash?: "dot" | "dash" | "dashdot" | "solid";
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
  xRange?: [number, number];
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
  xRange,
}: ScientificPlotProps) {
  const isMobile = useIsMobile();
  const { resolvedMode } = useTheme();
  const [logY, setLogY] = useState(defaultLogY);
  const [logX, setLogX] = useState(defaultLogX);

  const effectiveHeight = isMobile ? Math.min(height, 320) : height;
  const plotMargin = isMobile
    ? { l: 50, r: yTitle2 ? 50 : 20, t: title ? 35 : 15, b: 45 }
    : { l: 70, r: yTitle2 ? 70 : 30, t: title ? 40 : 20, b: 60 };

  const plotColors = useMemo(() => {
    if (resolvedMode === "dark") {
      return {
        plotBg: "rgba(20,20,20,0.5)",
        gridColor: "#333",
        axisColor: "#888",
        textColor: "#ccc",
        titleColor: "#ccc",
        axisTitleColor: "#aaa",
        zerolineColor: "#444",
      };
    }
    return {
      plotBg: "rgba(245,245,245,0.8)",
      gridColor: "#ddd",
      axisColor: "#666",
      textColor: "#333",
      titleColor: "#222",
      axisTitleColor: "#555",
      zerolineColor: "#ccc",
    };
  }, [resolvedMode]);

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
        ...(t.text ? { text: t.text, hoverinfo: "text" as const } : {}),
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
        line: { color: vl.color ?? plotColors.axisColor, width: 1, dash: (vl.dash ?? "dot") as "dot" | "dash" | "dashdot" | "solid" },
      }));
      const annotations = verticalLines?.map((vl) => ({
        x: vl.x,
        y: 1,
        yref: "paper" as const,
        text: vl.text,
        showarrow: false,
        font: { size: 10, color: vl.color ?? plotColors.axisColor },
        yanchor: "bottom" as const,
      }));

      const computedXRange = xRange
        ? logX
          ? [Math.log10(xRange[0]), Math.log10(xRange[1])]
          : xRange
        : undefined;

      return {
        title: title ? { text: title, font: { size: 14, color: plotColors.titleColor } } : undefined,
        xaxis: {
          title: { text: xTitle, font: { color: plotColors.axisTitleColor } },
          type: logX ? "log" : "linear",
          color: plotColors.axisColor,
          gridcolor: plotColors.gridColor,
          zerolinecolor: plotColors.zerolineColor,
          ...(computedXRange ? { range: computedXRange } : {}),
        },
        yaxis: {
          title: { text: yTitle, font: { color: plotColors.axisTitleColor } },
          type: logY ? "log" : "linear",
          color: plotColors.axisColor,
          gridcolor: plotColors.gridColor,
          zerolinecolor: plotColors.zerolineColor,
        },
        ...(yTitle2 ? {
          yaxis2: {
            title: { text: yTitle2, font: { color: plotColors.axisTitleColor } },
            type: logY ? "log" : "linear",
            color: plotColors.axisColor,
            overlaying: "y" as const,
            side: "right" as const,
            gridcolor: "transparent",
          },
        } : {}),
        paper_bgcolor: "transparent",
        plot_bgcolor: plotColors.plotBg,
        font: { color: plotColors.textColor },
        legend: {
          font: { color: plotColors.textColor },
          bgcolor: "transparent",
        },
        margin: plotMargin,
        height: effectiveHeight,
        autosize: true,
        shapes,
        annotations,
      };
    },
    [xTitle, yTitle, yTitle2, title, logX, logY, effectiveHeight, plotMargin, verticalLines, plotColors, xRange],
  );

  const config: Partial<Config> = useMemo(
    () => ({
      responsive: true,
      displayModeBar: !isMobile,
      displaylogo: false,
      modeBarButtonsToRemove: [
        "select2d",
        "lasso2d",
        "autoScale2d",
      ],
      scrollZoom: false,
      toImageButtonOptions: {
        format: "svg",
        filename: title ?? "plot",
      },
    }),
    [title, isMobile],
  );

  return (
    <div className="rounded-lg border border-border bg-card">
      {showLogToggle && (
        <div className="flex items-center gap-2 border-b border-border px-4 py-2">
          <button
            type="button"
            onClick={() => setLogX(!logX)}
            className={`rounded px-3 py-1.5 text-xs font-medium ${
              logX
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            Log X
          </button>
          <button
            type="button"
            onClick={() => setLogY(!logY)}
            className={`rounded px-3 py-1.5 text-xs font-medium ${
              logY
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            Log Y
          </button>
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
