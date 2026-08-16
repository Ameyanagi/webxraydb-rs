import { useState, useMemo } from "react";
import { useIsMobile } from "~/hooks/useIsMobile";
import { useTheme } from "~/lib/theme";
import { RuvizPlot } from "~/components/plot/RuvizPlot";

type DashStyle = "solid" | "dot" | "dash" | "longdash" | "dashdot" | "longdashdot";

export interface PlotTrace {
  x: number[];
  y: number[];
  name: string;
  mode?: "lines" | "markers" | "lines+markers";
  line?: { dash?: DashStyle; width?: number; color?: string };
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
  yRange?: [number, number];
  xDtick?: number;
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
  verticalLines,
  xRange,
  yRange,
}: ScientificPlotProps) {
  const isMobile = useIsMobile();
  const { resolvedMode } = useTheme();
  const [logY, setLogY] = useState(defaultLogY);
  const [logX, setLogX] = useState(defaultLogX);

  const effectiveHeight = isMobile ? Math.min(height, 320) : height;

  const spec = useMemo(
    () => ({
      traces,
      xTitle,
      yTitle,
      logX,
      logY,
      verticalLines,
      xRange,
      yRange,
      name: title,
    }),
    [traces, xTitle, yTitle, logX, logY, verticalLines, xRange, yRange, title],
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
      {/* Breathing room between the canvas and the card frame, so the axis
          labels and figure edge never sit flush against the layout. */}
      <div className="p-2 md:p-4">
        <RuvizPlot spec={spec} height={effectiveHeight} darkMode={resolvedMode === "dark"} />
      </div>
    </div>
  );
}
