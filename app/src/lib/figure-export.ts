import type { PlotAnnotation, PlotTrace } from "~/components/plot/ScientificPlot";

/**
 * Publication-figure export through ruviz.
 *
 * ruviz is imported dynamically so its wasm (~4 MB) is fetched only when the
 * user actually exports — the interactive plots stay on Plotly.
 */

export type FigurePreset = "single" | "double";
export type FigureFormat = "svg" | "png";

export interface FigureExportSpec {
  traces: PlotTrace[];
  xTitle: string;
  yTitle: string;
  logX: boolean;
  logY: boolean;
  verticalLines?: PlotAnnotation[];
  xRange?: [number, number];
  yRange?: [number, number];
  /** Basis for the download filename; falls back to "figure". */
  name?: string;
}

/**
 * Journal column presets, in inches. Titles are deliberately omitted from the
 * exported figure — captions belong in the manuscript, not the artwork.
 */
const PRESETS: Record<
  FigurePreset,
  { size: [number, number]; fontSize: number; label: string }
> = {
  single: { size: [3.25, 2.5], fontSize: 8, label: "Single column (3.25 in)" },
  double: { size: [6.5, 4.0], fontSize: 9, label: "Double column (6.5 in)" },
};

const EXPORT_DPI = 300;

/** Plotly dash names → ruviz linestyle names. */
function toLinestyle(dash: string | undefined): "solid" | "dashed" | "dotted" | "dash-dot" {
  switch (dash) {
    case "dash":
      return "dashed";
    case "dot":
      return "dotted";
    case "dashdot":
      return "dash-dot";
    default:
      return "solid";
  }
}

/**
 * A y-coordinate at `fraction` of the data span for vertical-line labels, in
 * the axis's own scale so log plots place labels by decade rather than value.
 * Successive labels alternate between two heights so adjacent edges (Fe L3,
 * L2, L1 sit within ~150 eV of each other) don't overprint.
 */
function labelYAt(traces: PlotTrace[], logY: boolean, fraction: number): number | null {
  let min = Infinity;
  let max = -Infinity;
  for (const trace of traces) {
    for (const value of trace.y) {
      if (!Number.isFinite(value)) continue;
      if (logY && value <= 0) continue;
      if (value < min) min = value;
      if (value > max) max = value;
    }
  }
  if (!(min < max)) return Number.isFinite(max) ? max : null;

  if (logY) {
    const span = Math.log10(max) - Math.log10(min);
    return 10 ** (Math.log10(min) + fraction * span);
  }
  return min + fraction * (max - min);
}

/**
 * Apply a plot spec — traces, scales, ranges, reference lines — onto a ruviz
 * builder. Shared by the publication export and the interactive canvas view
 * so the two renderers can never disagree about what a plot contains.
 */
export function applyPlotSpec(
  plot: import("ruviz").PlotBuilder,
  spec: FigureExportSpec,
  fontSize: number,
): void {
  plot.xlabel(spec.xTitle).ylabel(spec.yTitle);

  if (spec.logX) plot.xscale("log");
  if (spec.logY) plot.yscale("log");
  if (spec.xRange) plot.xlim(spec.xRange[0], spec.xRange[1]);
  if (spec.yRange) plot.ylim(spec.yRange[0], spec.yRange[1]);

  for (const trace of spec.traces) {
    const style = {
      label: trace.name,
      ...(trace.line?.color ? { color: trace.line.color } : {}),
      ...(trace.line?.width ? { width: trace.line.width } : {}),
    };
    if (trace.mode === "markers") {
      plot.scatter({ x: trace.x, y: trace.y, style });
    } else {
      plot.line({
        x: trace.x,
        y: trace.y,
        style: {
          ...style,
          ...(trace.line?.dash ? { linestyle: toLinestyle(trace.line.dash) } : {}),
          ...(trace.mode === "lines+markers" ? { marker: "circle" as const } : {}),
        },
      });
    }
  }

  if (spec.traces.length > 1) {
    plot.legend("best");
  }

  const labelHeights = [0.96, 0.88].map((fraction) =>
    labelYAt(spec.traces, spec.logY, fraction),
  );
  (spec.verticalLines ?? []).forEach((line, index) => {
    plot.vline(line.x, {
      ...(line.color ? { color: line.color } : {}),
      linestyle: toLinestyle(line.dash ?? "dot"),
    });
    const textY = labelHeights[index % labelHeights.length];
    if (textY !== null && textY !== undefined) {
      plot.annotateText(line.x, textY, line.text, {
        fontSize: Math.max(6, fontSize - 1),
        ...(line.color ? { color: line.color } : {}),
      });
    }
  });
}

export async function renderFigure(
  spec: FigureExportSpec,
  preset: FigurePreset,
  format: FigureFormat,
): Promise<Blob> {
  const { createPlot } = await import("ruviz");
  const { size, fontSize } = PRESETS[preset];

  const plot = createPlot()
    .theme("publication")
    .figure({ size, dpi: EXPORT_DPI, fontSize });
  applyPlotSpec(plot, spec, fontSize);

  if (format === "svg") {
    const svg = await plot.renderSvg();
    return new Blob([svg], { type: "image/svg+xml" });
  }
  const png = await plot.renderPng();
  return new Blob([png as BlobPart], { type: "image/png" });
}

export function downloadFigure(blob: Blob, name: string, format: FigureFormat) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name.replace(/[^\w.-]+/g, "_") || "figure"}.${format}`;
  // WebKit cancels an in-flight download when its object URL is revoked
  // immediately after click — larger files (PNG vs SVG) lose that race more
  // often. Keep the anchor in the DOM for the click and defer the revoke.
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
