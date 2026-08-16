import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyPlotSpec,
  downloadFigure,
  renderFigure,
  type FigureExportSpec,
} from "~/lib/figure-export";

type Session = import("ruviz").CanvasSession | import("ruviz").WorkerSession;

interface RuvizPlotProps {
  spec: FigureExportSpec;
  height: number;
  darkMode: boolean;
}

const SCREEN_FONT_SIZE = 11;

/** Right-button movement below this many px counts as a click, not a box zoom. */
const CLICK_SLOP_PX = 5;

/**
 * Interactive plot on ruviz's wasm canvas session.
 *
 * The SDK binds pointer and wheel input and observes the canvas size itself
 * (`bindInput`/`autoResize`); this component owns the session lifecycle and
 * rebuilds the plot when the data or theme changes. Left-drag pans, wheel
 * zooms, right-drag draws a zoom box, and double-click resets the view.
 *
 * The session prefers a worker (rendering stays off the main thread), but the
 * SDK's `fallbackToMainThread` only covers creation — a worker that dies later
 * (a redeploy invalidating its chunk URL, an extension killing it) would leave
 * a dead plot. On any worker-path failure this retries once on the main
 * thread before surfacing an error.
 */
export function RuvizPlot({ spec, height, darkMode }: RuvizPlotProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sessionRef = useRef<Session | null>(null);
  // "worker" first; a failure demotes to "main"; a second failure gives up.
  const [attempt, setAttempt] = useState<"worker" | "main">("worker");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fail = useCallback(
    (e: unknown) => {
      if (attempt === "worker") {
        sessionRef.current?.destroy();
        sessionRef.current = null;
        setReady(false);
        setAttempt("main");
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [attempt],
  );

  // Session lifecycle: one session per mounted canvas (and per attempt).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;

    (async () => {
      try {
        const ruviz = await import("ruviz");
        const session =
          attempt === "worker"
            ? await ruviz.createWorkerSession(canvas, { fallbackToMainThread: true })
            : await ruviz.createCanvasSession(canvas);
        if (cancelled) {
          session.destroy();
          return;
        }
        sessionRef.current = session;
        setReady(true);
      } catch (e) {
        if (!cancelled) fail(e);
      }
    })();

    return () => {
      cancelled = true;
      sessionRef.current?.destroy();
      sessionRef.current = null;
      setReady(false);
    };
    // `fail` is stable per attempt; recreating the session on attempt change is the point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // Plot content: rebuild whenever the data, scales or theme change.
  useEffect(() => {
    const session = sessionRef.current;
    if (!ready || !session) return;
    let cancelled = false;

    (async () => {
      try {
        const { createPlot } = await import("ruviz");
        const plot = createPlot().theme(darkMode ? "dark" : "light");
        applyPlotSpec(plot, spec, SCREEN_FONT_SIZE);
        if (!cancelled) await session.setPlot(plot);
      } catch (e) {
        if (!cancelled) fail(e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, spec, darkMode, fail]);

  // Right-click context menu: a stationary right-click opens it; a right-drag
  // is the session's box zoom and must not. Track the press ourselves — the
  // SDK swallows the native `contextmenu` event to keep box zoom usable.
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const rightPress = useRef<{ x: number; y: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 2) rightPress.current = { x: e.clientX, y: e.clientY };
    else setMenu(null);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (e.button !== 2 || !rightPress.current) return;
    const dx = e.clientX - rightPress.current.x;
    const dy = e.clientY - rightPress.current.y;
    rightPress.current = null;
    if (Math.hypot(dx, dy) < CLICK_SLOP_PX) {
      const host = e.currentTarget.getBoundingClientRect();
      setMenu({ x: e.clientX - host.left, y: e.clientY - host.top });
    }
  };

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    // Containment check rather than stopPropagation: React's root listener and
    // this one can share a node, where stopPropagation cannot shield the menu
    // and a click inside it would unmount the button before its click fires.
    const close = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  /**
   * Publication figure through the static renderer: full data range,
   * publication theme, 3.25 in single-column at 300 dpi.
   */
  const downloadPublication = async (format: "svg" | "png") => {
    setMenu(null);
    try {
      const blob = await renderFigure(spec, "single", format);
      downloadFigure(blob, spec.name ?? "figure", format);
    } catch (e) {
      console.warn("publication export failed:", e);
    }
  };

  /** Download the current view — zoom state included — via the session. */
  const downloadView = async (format: "svg" | "png") => {
    const session = sessionRef.current;
    setMenu(null);
    if (!session) return;
    try {
      const blob =
        format === "svg"
          ? new Blob([await session.exportSvg()], { type: "image/svg+xml" })
          : new Blob([(await session.exportPng()) as BlobPart], { type: "image/png" });
      downloadFigure(blob, `${spec.name ?? "plot"}-view`, format);
    } catch (e) {
      // Export of the live view is best-effort; the toolbar's publication
      // export remains the reliable path. Log so a failure is diagnosable.
      console.warn("view export failed:", e);
    }
  };

  if (error) {
    return (
      <div
        className="flex items-center justify-center px-6 text-center text-sm text-destructive"
        style={{ height }}
      >
        {error}
      </div>
    );
  }

  const menuItem =
    "block w-full rounded px-2.5 py-1.5 text-left text-xs text-popover-foreground hover:bg-accent hover:text-accent-foreground";

  return (
    <div
      className="relative"
      style={{ height }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          Loading plot...
        </div>
      )}
      {/* Remount the canvas per attempt: a canvas whose control was
          transferred to a dead worker cannot be reused on the main thread. */}
      <canvas
        key={attempt}
        ref={canvasRef}
        className="h-full w-full touch-none"
        onDoubleClick={() => sessionRef.current?.resetView()}
      />
      {menu && (
        <div
          ref={menuRef}
          className="absolute z-30 w-56 rounded-md border border-border bg-popover p-1 shadow-lg"
          style={{ left: menu.x, top: menu.y }}
        >
          <button
            type="button"
            className={menuItem}
            onClick={() => {
              sessionRef.current?.resetView();
              setMenu(null);
            }}
          >
            Reset view
          </button>
          <div className="my-1 border-t border-border/60" />
          <button type="button" className={menuItem} onClick={() => downloadView("svg")}>
            Download view as SVG
          </button>
          <button type="button" className={menuItem} onClick={() => downloadView("png")}>
            Download view as PNG
          </button>
          <div className="my-1 border-t border-border/60" />
          <button type="button" className={menuItem} onClick={() => downloadPublication("svg")}>
            Publication SVG (3.25 in)
          </button>
          <button type="button" className={menuItem} onClick={() => downloadPublication("png")}>
            Publication PNG (300 dpi)
          </button>
        </div>
      )}
    </div>
  );
}
