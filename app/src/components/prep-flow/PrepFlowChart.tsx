import { useState } from "react";

/** The slice of a helper case the flowchart reads — kept minimal on purpose. */
export interface PrepFlowCase {
  id: string;
  title: string;
  achievedEdgeStep: number;
  absorptionAbove: number;
  absorptionBelow: number;
  transmissionSuitable: boolean;
  transmissionLabel: string;
  fluorescenceMinPercent: number;
  fluorescenceMeanPercent: number;
  fluorescenceSuitable: boolean;
  fluorescenceLabel: string;
  thicknessCm: number;
  densityGcm3: number;
  sampleMassMg: number;
  diluentMassMg: number;
  sampleFractionPct: number;
  solverNote?: string;
}

export interface PrepFlowChartProps {
  sampleFormula: string;
  atom: string;
  edge: string;
  edgeEnergy: number | null;
  sampleDensity: number;
  totalMassMg: number;
  diameterMm: number;
  cases: PrepFlowCase[];
  selectedCaseId: string | null;
  onSelectCase: (id: string) => void;
}

type NodeId = "sample" | "uniformity" | "transmission" | "fluorescence" | "methods";
type Verdict = "ok" | "warn" | "bad" | "muted" | "info";
type ModePreference = "any" | "transmission" | "fluorescence";

/**
 * Thresholds from the XAFS sample-preparation literature (Newville "Anatomy of
 * an XAFS Measurement"; Bunker "Preparation of XAFS Samples"; Australian
 * Synchrotron transmission guides): edge step ideally 0.2–1.5 (≈1 best, up to
 * 2 measurable), total μt above the edge ideally ≤ 2.5 with 4 as the hard
 * limit, and achievable edge step below ~0.1 meaning the absorber is too
 * dilute for transmission. R ≥ 90% is the helper's exact self-absorption
 * criterion. Pellets thinner than ~10 μm are physically valid solutions that
 * are impractical to press and handle.
 */
const EDGE_STEP_MIN = 0.2;
const EDGE_STEP_IDEAL_MAX = 1.5;
const EDGE_STEP_MAX = 2.0;
const MU_T_IDEAL_MAX = 2.5;
const MU_T_MAX = 4.0;
const EDGE_STEP_TOO_DILUTE = 0.1;
const R_MIN_PERCENT = 90;
const THIN_PELLET_UM = 10;

const VERDICT_CLASSES: Record<Verdict, string> = {
  info: "border-border bg-secondary/50 text-foreground",
  ok: "border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warn: "border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  bad: "border-red-500/60 bg-red-500/10 text-red-700 dark:text-red-300",
  muted: "border-border/60 bg-secondary/20 text-muted-foreground",
};

const CHIP_CLASSES: Record<"ok" | "warn" | "bad" | "muted", string> = {
  ok: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  warn: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  bad: "bg-red-500/15 text-red-600 dark:text-red-300",
  muted: "bg-secondary text-muted-foreground",
};

function thicknessUm(cm: number): number {
  return cm * 1e4;
}

/** Three-state check: value in ideal range, tolerable range, or out. */
function tri(value: number, idealMax: number, hardMax: number, min = 0): "ok" | "warn" | "bad" {
  if (value < min || value > hardMax) return "bad";
  if (value > idealMax) return "warn";
  return "ok";
}

function transmissionVerdict(c: PrepFlowCase): "ok" | "warn" | "bad" {
  const step = tri(c.achievedEdgeStep, EDGE_STEP_IDEAL_MAX, EDGE_STEP_MAX, EDGE_STEP_MIN);
  const mut = tri(c.absorptionAbove, MU_T_IDEAL_MAX, MU_T_MAX);
  if (step === "bad" || mut === "bad") return "bad";
  if (step === "warn" || mut === "warn") return "warn";
  return "ok";
}

function fluorescenceVerdict(c: PrepFlowCase): "ok" | "warn" | "bad" {
  if (c.fluorescenceMinPercent >= R_MIN_PERCENT) {
    return thicknessUm(c.thicknessCm) < THIN_PELLET_UM ? "warn" : "ok";
  }
  return "bad";
}

function Chip({ verdict, children }: { verdict: "ok" | "warn" | "bad" | "muted"; children: string }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${CHIP_CLASSES[verdict]}`}>
      {children}
    </span>
  );
}

function FlowNode({
  id,
  title,
  subtitle,
  verdict,
  selected,
  onSelect,
}: {
  id: NodeId;
  title: string;
  subtitle: string;
  verdict: Verdict;
  selected: boolean;
  onSelect: (id: NodeId) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      className={`w-full rounded-lg border px-3 py-2 text-left transition-shadow ${VERDICT_CLASSES[verdict]} ${
        selected ? "ring-2 ring-ring" : "hover:shadow-md"
      }`}
    >
      <div className="text-xs font-semibold">{title}</div>
      <div className="mt-0.5 text-[11px] leading-snug opacity-80">{subtitle}</div>
    </button>
  );
}

function VerticalConnector() {
  return <div className="mx-auto h-4 w-px bg-border" />;
}

function BranchConnector({ join = false }: { join?: boolean }) {
  return (
    <div className="relative h-4">
      <div className="absolute left-1/4 right-1/4 top-1/2 border-t border-border" />
      <div
        className={`absolute left-1/2 w-px bg-border ${join ? "bottom-0 top-1/2" : "top-0 h-1/2"}`}
      />
      <div className={`absolute left-1/4 w-px bg-border ${join ? "top-0 h-1/2" : "top-1/2 h-1/2"}`} />
      <div
        className={`absolute right-1/4 w-px bg-border ${join ? "top-0 h-1/2" : "top-1/2 h-1/2"}`}
      />
    </div>
  );
}

function DetailRow({
  label,
  value,
  threshold,
  verdict,
}: {
  label: string;
  value: string;
  threshold?: string;
  verdict?: "ok" | "warn" | "bad";
}) {
  const mark = verdict === "ok" ? "✓" : verdict === "warn" ? "△" : verdict === "bad" ? "✗" : null;
  const markColor =
    verdict === "ok" ? "text-emerald-500" : verdict === "warn" ? "text-amber-500" : "text-red-500";
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/40 py-1 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">
        {value}
        {threshold && <span className="ml-2 font-normal text-muted-foreground">({threshold})</span>}
        {mark && <span className={`ml-2 ${markColor}`}>{mark}</span>}
      </span>
    </div>
  );
}

interface MethodRow {
  caseId: string | null;
  mode: "Transmission" | "Fluorescence";
  label: string;
  kase: PrepFlowCase | null;
  /** Why the row is muted when there is no case behind it. */
  absentReason?: string;
}

/**
 * Sample-preparation decision flow. Every branch is computed for every recipe
 * — transmission and fluorescence verdicts are shown side by side so the user
 * can pursue either mode — and the method list can be reordered by intended
 * measurement. A grayed node or row remains clickable and explains itself.
 */
export function PrepFlowChart(props: PrepFlowChartProps) {
  const [selected, setSelected] = useState<NodeId | null>(null);
  const [preference, setPreference] = useState<ModePreference>("any");
  const [expandedAbsent, setExpandedAbsent] = useState<string | null>(null);
  const {
    sampleFormula,
    atom,
    edge,
    edgeEnergy,
    sampleDensity,
    totalMassMg,
    diameterMm,
    cases,
    selectedCaseId,
    onSelectCase,
  } = props;

  const byId = (id: string) => cases.find((c) => c.id === id) ?? null;
  const pure = byId("pure");
  const dilutedTransmission = byId("target") ?? byId("suggested");
  const fluoDilution = byId("fluo-dilution");
  const fluoThickness = byId("fluo-thickness");

  // Feasibility is judged at the best achievable recipe, not the raw inputs:
  // a pure pellet at Δμt = 39 still means "transmission is fine — dilute".
  const transmissionCandidates = cases.filter((c) => transmissionVerdict(c) !== "bad");
  const bestTransmission =
    transmissionCandidates.find((c) => transmissionVerdict(c) === "ok") ??
    transmissionCandidates[0] ??
    null;
  const tooDilute =
    !bestTransmission &&
    cases.length > 0 &&
    Math.max(...cases.map((c) => c.achievedEdgeStep)) < EDGE_STEP_TOO_DILUTE;

  const fluoCandidates = cases.filter((c) => fluorescenceVerdict(c) !== "bad");
  const bestFluo =
    fluoCandidates.find((c) => fluorescenceVerdict(c) === "ok") ?? fluoCandidates[0] ?? null;

  const transmissionStatus: Verdict =
    cases.length === 0 ? "muted" : bestTransmission ? transmissionVerdict(bestTransmission) : "bad";
  const fluoStatus: Verdict =
    cases.length === 0 ? "muted" : bestFluo ? fluorescenceVerdict(bestFluo) : "bad";

  const methodRows: MethodRow[] = [
    {
      caseId: pure?.id ?? null,
      mode: "Transmission",
      label: "Pure pellet",
      kase: pure,
      absentReason: "Not computed for the current inputs.",
    },
    {
      caseId: dilutedTransmission?.id ?? null,
      mode: "Transmission",
      label: "Diluted pellet (edge-step target)",
      kase: dilutedTransmission,
      absentReason: "No dilution reaches the target edge step with non-negative masses.",
    },
    {
      caseId: fluoDilution?.id ?? null,
      mode: "Fluorescence",
      label: "Diluted until R ≥ 90%",
      kase: fluoDilution,
      absentReason: "No dilution restores R ≥ 90% for these inputs.",
    },
    {
      caseId: fluoThickness?.id ?? null,
      mode: "Fluorescence",
      label: "Thinned until R ≥ 90%",
      kase: fluoThickness,
      absentReason: "No thickness restores R ≥ 90% for these inputs.",
    },
  ];

  const rowScore = (row: MethodRow): number => {
    if (!row.kase) return -1;
    const t = transmissionVerdict(row.kase);
    const f = fluorescenceVerdict(row.kase);
    const own = row.mode === "Transmission" ? t : f;
    const preferred =
      preference === "any" ||
      (preference === "transmission" && row.mode === "Transmission") ||
      (preference === "fluorescence" && row.mode === "Fluorescence");
    const ownScore = own === "ok" ? 3 : own === "warn" ? 2 : 0;
    // A preferred-mode recipe that fails outright must not outrank a recipe
    // that actually works in the other mode.
    const preferenceBonus = preferred ? (own === "bad" ? 2 : 10) : 0;
    return preferenceBonus + ownScore + (t !== "bad" && f !== "bad" ? 1 : 0);
  };
  const sortedRows = [...methodRows].sort((a, b) => rowScore(b) - rowScore(a));

  const toggle = (id: NodeId) => setSelected((current) => (current === id ? null : id));
  const lowEnergyEdge = edgeEnergy != null && edgeEnergy < 5000;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold">Method Selection</h3>

      <div className="mx-auto max-w-xl">
        <FlowNode
          id="sample"
          title={`Sample — ${sampleFormula}`}
          subtitle={
            edgeEnergy != null
              ? `${atom} ${edge}-edge at ${edgeEnergy.toFixed(1)} eV · ρ = ${sampleDensity} g/cm³${lowEnergyEdge ? " · low-energy edge" : ""}`
              : "Pick an absorbing atom and edge"
          }
          verdict={lowEnergyEdge ? "warn" : "info"}
          selected={selected === "sample"}
          onSelect={toggle}
        />
        <VerticalConnector />
        <FlowNode
          id="uniformity"
          title="Uniformity checklist"
          subtitle="Particle size ≪ 1 absorption length · no pinholes · even thickness"
          verdict="info"
          selected={selected === "uniformity"}
          onSelect={toggle}
        />
        <BranchConnector />
        <div className="grid grid-cols-2 gap-3">
          <FlowNode
            id="transmission"
            title="Transmission feasible?"
            subtitle={
              bestTransmission
                ? `${bestTransmission.title}: Δμt = ${bestTransmission.achievedEdgeStep.toFixed(2)}, μt = ${bestTransmission.absorptionAbove.toFixed(2)}`
                : tooDilute
                  ? "Too dilute — best Δμt < 0.1"
                  : "No recipe passes"
            }
            verdict={transmissionStatus}
            selected={selected === "transmission"}
            onSelect={toggle}
          />
          <FlowNode
            id="fluorescence"
            title="Fluorescence viable?"
            subtitle={
              bestFluo
                ? `${bestFluo.title}: R min = ${bestFluo.fluorescenceMinPercent.toFixed(1)}%`
                : "Self-absorption too severe as planned"
            }
            verdict={fluoStatus}
            selected={selected === "fluorescence"}
            onSelect={toggle}
          />
        </div>
        <BranchConnector join />
        <FlowNode
          id="methods"
          title="Methods — choose what to measure"
          subtitle={`${sortedRows.filter((r) => r.kase && rowScore(r) > 1).length} workable recipe(s) · sorted by preference`}
          verdict={transmissionStatus === "bad" && fluoStatus === "bad" ? "warn" : "info"}
          selected={selected === "methods"}
          onSelect={toggle}
        />
      </div>

      {selected && (
        <div className="mt-4 rounded-md border border-border/60 bg-background/50 p-3 text-xs">
          {selected === "sample" && (
            <div>
              <DetailRow label="Formula" value={sampleFormula} />
              <DetailRow label="Absorber / edge" value={`${atom} ${edge}`} />
              {edgeEnergy != null && (
                <DetailRow label="Edge energy" value={`${edgeEnergy.toFixed(1)} eV`} />
              )}
              <DetailRow label="Crystal density" value={`${sampleDensity} g/cm³`} />
              <DetailRow label="Pellet" value={`${totalMassMg} mg · ⌀${diameterMm} mm`} />
              {lowEnergyEdge && (
                <p className="mt-2 text-muted-foreground">
                  Below ~5 keV air absorbs strongly and transmission samples must be very thin —
                  expect a He/vacuum path, and fluorescence is often the practical choice.
                </p>
              )}
              <p className="mt-2 text-muted-foreground">
                A pressed pellet's effective density is crystal × packing (~0.5–0.7); the
                mass-per-area numbers below already absorb this.
              </p>
            </div>
          )}
          {selected === "uniformity" && (
            <div className="space-y-1.5 text-muted-foreground">
              <p>
                These cannot be computed from a formula, and they are the leading cause of distorted
                transmission data (thickness effects):
              </p>
              <p>· Grind and sieve so particle size ≪ one absorption length (a few μm at K edges).</p>
              <p>· No pinholes — leakage light is "junk intensity" that damps the EXAFS amplitude.</p>
              <p>· Uniform thickness — spread on tape in several layers, or press a well-mixed pellet.</p>
              <p>· Mix sample and diluent thoroughly; poor mixing mimics pinholes.</p>
            </div>
          )}
          {selected === "transmission" && (
            <div>
              {bestTransmission ? (
                <>
                  <DetailRow label="Best recipe" value={bestTransmission.title} />
                  <DetailRow
                    label="Edge step Δμt"
                    value={bestTransmission.achievedEdgeStep.toFixed(2)}
                    threshold={`${EDGE_STEP_MIN}–${EDGE_STEP_IDEAL_MAX} ideal, ≤ ${EDGE_STEP_MAX}`}
                    verdict={tri(
                      bestTransmission.achievedEdgeStep,
                      EDGE_STEP_IDEAL_MAX,
                      EDGE_STEP_MAX,
                      EDGE_STEP_MIN,
                    )}
                  />
                  <DetailRow
                    label="Total μt above edge"
                    value={bestTransmission.absorptionAbove.toFixed(2)}
                    threshold={`≤ ${MU_T_IDEAL_MAX} ideal, ≤ ${MU_T_MAX}`}
                    verdict={tri(bestTransmission.absorptionAbove, MU_T_IDEAL_MAX, MU_T_MAX)}
                  />
                  <DetailRow
                    label="Thickness"
                    value={`${thicknessUm(bestTransmission.thicknessCm).toFixed(0)} μm`}
                    verdict={thicknessUm(bestTransmission.thicknessCm) < THIN_PELLET_UM ? "warn" : "ok"}
                  />
                </>
              ) : tooDilute ? (
                <p className="text-muted-foreground">
                  Even the best recipe gives Δμt &lt; {EDGE_STEP_TOO_DILUTE} — the absorber is too
                  dilute for transmission. Go to fluorescence with an energy-resolving detector and
                  the Z−1 filter suggested on the element page.
                </p>
              ) : (
                <p className="text-muted-foreground">
                  No computed recipe satisfies the transmission thresholds; adjust total mass,
                  diameter, or the target edge step.
                </p>
              )}
            </div>
          )}
          {selected === "fluorescence" && (
            <div>
              {pure && (
                <DetailRow
                  label="As planned, R min"
                  value={`${pure.fluorescenceMinPercent.toFixed(1)}%`}
                  threshold={`≥ ${R_MIN_PERCENT}%`}
                  verdict={pure.fluorescenceMinPercent >= R_MIN_PERCENT ? "ok" : "bad"}
                />
              )}
              {fluoDilution && (
                <DetailRow
                  label="Diluted recipe, R min"
                  value={`${fluoDilution.fluorescenceMinPercent.toFixed(1)}%`}
                  verdict={fluorescenceVerdict(fluoDilution)}
                />
              )}
              {fluoThickness && (
                <DetailRow
                  label="Thinned recipe"
                  value={`${thicknessUm(fluoThickness.thicknessCm).toFixed(1)} μm`}
                  verdict={
                    thicknessUm(fluoThickness.thicknessCm) < THIN_PELLET_UM ? "warn" : "ok"
                  }
                />
              )}
              <p className="mt-2 text-muted-foreground">
                Mitigations when R &lt; {R_MIN_PERCENT}%: dilute, thin, use a grazing-exit geometry
                (raise exit angle θ under Advanced angles), or measure anyway and correct — see the{" "}
                <a href="/self-absorption" className="text-primary hover:underline">
                  Self Absorption tool
                </a>{" "}
                for Booth and exact Ameyanagi corrections.
              </p>
            </div>
          )}
          {selected === "methods" && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">Prefer:</span>
                {(["any", "transmission", "fluorescence"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPreference(mode)}
                    className={`rounded px-2 py-0.5 text-[11px] font-medium capitalize ${
                      preference === mode
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              {sortedRows.map((row) => {
                const kase = row.kase;
                const rowKey = `${row.mode}-${row.label}`;
                const isSelected = kase !== null && kase.id === selectedCaseId;
                const thinWarn = kase !== null && thicknessUm(kase.thicknessCm) < THIN_PELLET_UM;
                return (
                  <div key={rowKey}>
                    <button
                      type="button"
                      onClick={() =>
                        kase
                          ? onSelectCase(kase.id)
                          : setExpandedAbsent((cur) => (cur === rowKey ? null : rowKey))
                      }
                      className={`flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md border px-2.5 py-1.5 text-left ${
                        kase
                          ? isSelected
                            ? "border-primary/70 bg-primary/5 ring-1 ring-primary/50"
                            : "border-border/60 hover:bg-accent/40"
                          : "border-border/40 opacity-60 hover:opacity-90"
                      }`}
                      title={kase ? "Select this recipe (updates the plots below)" : undefined}
                    >
                      <span>
                        <span className="font-medium">{row.mode}</span>
                        <span className="text-muted-foreground"> — {row.label}</span>
                        {kase && (
                          <span className="ml-2 text-muted-foreground">
                            {thicknessUm(kase.thicknessCm).toFixed(0)} μm
                            {thinWarn && <span className="ml-1 text-amber-500">△ thin</span>}
                          </span>
                        )}
                      </span>
                      <span className="flex gap-1">
                        {kase ? (
                          <>
                            <Chip verdict={transmissionVerdict(kase)}>T</Chip>
                            <Chip verdict={fluorescenceVerdict(kase)}>F</Chip>
                          </>
                        ) : (
                          <Chip verdict="muted">why?</Chip>
                        )}
                      </span>
                    </button>
                    {!kase && expandedAbsent === rowKey && (
                      <p className="mt-1 rounded-md border border-border/40 bg-secondary/30 px-2.5 py-1.5 text-muted-foreground">
                        {row.absentReason}
                        {row.kase === null && row.caseId === null && (
                          <span> The solvers rerun automatically as you change the inputs.</span>
                        )}
                      </p>
                    )}
                  </div>
                );
              })}
              <p className="text-muted-foreground">
                Every recipe is scored for both modes — a green T and F on one row means the same
                pellet works for either measurement. △ marks thicknesses under {THIN_PELLET_UM} μm:
                valid numbers, hard to prepare as a pellet (use film/tape or grazing exit).
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
