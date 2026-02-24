import type { ReactNode } from "react";
import { ToolDocsButton } from "~/components/docs/ToolDocsButton";
import type { ToolDocId } from "~/docs/types";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  docId?: ToolDocId;
  hideDocsButton?: boolean;
}

export function PageHeader({
  title,
  description,
  actions,
  docId,
  hideDocsButton = false,
}: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold md:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {!hideDocsButton && <ToolDocsButton docId={docId} />}
        {actions}
      </div>
    </div>
  );
}
