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
          "rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        }
      >
        Theory and References
      </button>

      <ToolDocsModal
        open={open}
        doc={doc}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
