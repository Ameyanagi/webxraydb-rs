import { useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { getToolDoc, getToolDocByPath } from "~/docs/tool-docs";
import type { ToolDocId } from "~/docs/types";
import { ToolDocsModal } from "~/components/docs/ToolDocsModal";

interface ToolDocsButtonProps {
  docId?: ToolDocId;
  className?: string;
}

export function ToolDocsButton({ docId, className }: ToolDocsButtonProps) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const doc = docId ? getToolDoc(docId) : getToolDocByPath(pathname);

  if (!doc) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        }
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="shrink-0">
          <circle cx="7" cy="7" r="5.5" />
          <path d="M5.5 5.5a1.5 1.5 0 011.5-1.5 1.5 1.5 0 011.5 1.5c0 .83-.67 1-1.5 1.5V8" />
          <circle cx="7" cy="9.5" r="0.5" fill="currentColor" stroke="none" />
        </svg>
        Theory & References
      </button>

      <ToolDocsModal
        open={open}
        doc={doc}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
