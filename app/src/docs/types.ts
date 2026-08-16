export const TOOL_DOC_IDS = [
  "/",
  "/edges",
  "/lines",
  "/attenuation",
  "/formulas",
  "/scattering",
  "/ionchamber",
  "/reflectivity",
  "/darwin",
  "/analyzers",
  "/sample-weight",
  "/self-absorption",
  "/sample-preparation-helper",
  "/element/$z",
] as const;

export type ToolDocId = (typeof TOOL_DOC_IDS)[number];

/**
 * Map a pathname to its doc id without pulling in the doc content.
 * Kept here so `ToolDocsButton` can decide whether a doc exists while the
 * content (and KaTeX) stay behind a dynamic import.
 */
export function resolveToolDocId(pathname: string): ToolDocId | null {
  if (pathname === "/") return "/";
  if (pathname.startsWith("/element/")) return "/element/$z";

  return (
    TOOL_DOC_IDS.find(
      (id) => id !== "/" && id !== "/element/$z" && pathname.startsWith(id),
    ) ?? null
  );
}

export interface ToolEquationVariable {
  symbol: string;
  description: string;
  units?: string;
}

export interface ToolEquation {
  label: string;
  latex: string;
  variables?: ToolEquationVariable[];
}

export interface ToolReference {
  citation: string;
  doi?: string;
  url?: string;
}

export interface ToolDoc {
  id: ToolDocId;
  title: string;
  theorySummary: string[];
  algorithmSteps: string[];
  equations: ToolEquation[];
  references: ToolReference[];
  notes?: string[];
}
