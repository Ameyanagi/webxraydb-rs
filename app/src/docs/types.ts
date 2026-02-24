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
