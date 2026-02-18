import type { ReactNode } from "react";

interface ControlGroupProps {
  label: string;
  description?: string;
  children: ReactNode;
}

export function ControlGroup({
  label,
  description,
  children,
}: ControlGroupProps) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium">{label}</label>
      {children}
      {description && (
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
