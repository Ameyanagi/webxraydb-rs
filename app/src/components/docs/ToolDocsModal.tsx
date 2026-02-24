import { useEffect, useState, useCallback } from "react";
import { EquationBlock } from "~/components/docs/EquationBlock";
import { ReferenceList } from "~/components/docs/ReferenceList";
import type { ToolDoc } from "~/docs/types";

interface ToolDocsModalProps {
  open: boolean;
  doc: ToolDoc;
  onClose: () => void;
}

type SectionId = "theory" | "algorithm" | "equations" | "notes" | "references";

const SECTION_LABELS: Record<SectionId, string> = {
  theory: "Theory",
  algorithm: "Algorithm",
  equations: "Equations",
  notes: "Notes & Limits",
  references: "References",
};

export function ToolDocsModal({ open, doc, onClose }: ToolDocsModalProps) {
  const [collapsed, setCollapsed] = useState<Set<SectionId>>(() => new Set());

  const toggle = useCallback((id: SectionId) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  // Reset collapsed state when modal opens with new doc
  useEffect(() => {
    if (open) setCollapsed(new Set());
  }, [open, doc.id]);

  if (!open) return null;

  const hasNotes = doc.notes && doc.notes.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        aria-label="Close documentation"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${doc.title} — theory and references`}
        className="relative z-10 flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl"
      >
        {/* Header — fixed */}
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold leading-tight">
              {doc.title}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Theory, equations, and references
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="3" x2="11" y2="11" />
              <line x1="11" y1="3" x2="3" y2="11" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-1">
            {/* Theory */}
            <CollapsibleSection
              id="theory"
              label={SECTION_LABELS.theory}
              collapsed={collapsed.has("theory")}
              onToggle={toggle}
              badge={`${doc.theorySummary.length} para`}
            >
              <div className="space-y-2.5 text-sm leading-relaxed text-muted-foreground">
                {doc.theorySummary.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </CollapsibleSection>

            {/* Algorithm */}
            <CollapsibleSection
              id="algorithm"
              label={SECTION_LABELS.algorithm}
              collapsed={collapsed.has("algorithm")}
              onToggle={toggle}
              badge={`${doc.algorithmSteps.length} steps`}
            >
              <ol className="space-y-1.5 text-sm leading-relaxed text-muted-foreground">
                {doc.algorithmSteps.map((step, index) => (
                  <li key={step} className="flex gap-2.5">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                      {index + 1}
                    </span>
                    <span className="flex-1">{step}</span>
                  </li>
                ))}
              </ol>
            </CollapsibleSection>

            {/* Equations */}
            <CollapsibleSection
              id="equations"
              label={SECTION_LABELS.equations}
              collapsed={collapsed.has("equations")}
              onToggle={toggle}
              badge={`${doc.equations.length}`}
            >
              <div className="space-y-3">
                {doc.equations.map((equation, index) => (
                  <EquationBlock
                    key={`${equation.label}-${equation.latex}`}
                    equation={equation}
                    number={index + 1}
                  />
                ))}
              </div>
            </CollapsibleSection>

            {/* Notes */}
            {hasNotes && (
              <CollapsibleSection
                id="notes"
                label={SECTION_LABELS.notes}
                collapsed={collapsed.has("notes")}
                onToggle={toggle}
              >
                <ul className="space-y-1.5 text-sm leading-relaxed text-muted-foreground">
                  {doc.notes!.map((note) => (
                    <li key={note} className="flex gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                      <span className="flex-1">{note}</span>
                    </li>
                  ))}
                </ul>
              </CollapsibleSection>
            )}

            {/* References */}
            <CollapsibleSection
              id="references"
              label={SECTION_LABELS.references}
              collapsed={collapsed.has("references")}
              onToggle={toggle}
              badge={`${doc.references.length}`}
            >
              <ReferenceList references={doc.references} />
            </CollapsibleSection>
          </div>
        </div>
      </div>
    </div>
  );
}

function CollapsibleSection({
  id,
  label,
  collapsed,
  onToggle,
  badge,
  children,
}: {
  id: SectionId;
  label: string;
  collapsed: boolean;
  onToggle: (id: SectionId) => void;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/60">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-accent/50"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className={`shrink-0 text-muted-foreground transition-transform duration-150 ${
            collapsed ? "" : "rotate-90"
          }`}
        >
          <path d="M4 2 L8 6 L4 10" />
        </svg>
        <span className="text-sm font-semibold">{label}</span>
        {badge && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {badge}
          </span>
        )}
      </button>
      {!collapsed && (
        <div className="border-t border-border/40 px-4 py-3">
          {children}
        </div>
      )}
    </div>
  );
}
