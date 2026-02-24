import { useEffect } from "react";
import { EquationBlock } from "~/components/docs/EquationBlock";
import { ReferenceList } from "~/components/docs/ReferenceList";
import type { ToolDoc } from "~/docs/types";

interface ToolDocsModalProps {
  open: boolean;
  doc: ToolDoc;
  onClose: () => void;
}

export function ToolDocsModal({ open, doc, onClose }: ToolDocsModalProps) {
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        aria-label="Close documentation"
        className="absolute inset-0 bg-black/45"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${doc.title} theory and references`}
        className="relative z-10 max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl border border-border bg-background p-4 shadow-2xl sm:p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{doc.title} - Theory and References</h2>
            <p className="text-sm text-muted-foreground">
              Algorithm background, governing equations, and citation list.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            Close
          </button>
        </div>

        <div className="space-y-5">
          <section>
            <h3 className="mb-2 text-sm font-semibold">Theory</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              {doc.theorySummary.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold">Algorithm</h3>
            <ol className="space-y-1 text-sm text-muted-foreground">
              {doc.algorithmSteps.map((step, index) => (
                <li key={step}>
                  {index + 1}. {step}
                </li>
              ))}
            </ol>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold">Equations</h3>
            <div className="space-y-3">
              {doc.equations.map((equation) => (
                <EquationBlock key={`${equation.label}-${equation.latex}`} equation={equation} />
              ))}
            </div>
          </section>

          {doc.notes && doc.notes.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold">Notes and Limits</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {doc.notes.map((note) => (
                  <li key={note}>- {note}</li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h3 className="mb-2 text-sm font-semibold">References</h3>
            <ReferenceList references={doc.references} />
          </section>
        </div>
      </div>
    </div>
  );
}
