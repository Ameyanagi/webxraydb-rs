import { useMemo } from "react";
import katex from "katex";
import type { ToolEquation } from "~/docs/types";

interface EquationBlockProps {
  equation: ToolEquation;
}

export function EquationBlock({ equation }: EquationBlockProps) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(equation.latex, {
        displayMode: true,
        throwOnError: false,
        strict: "ignore",
      });
    } catch {
      return null;
    }
  }, [equation.latex]);

  return (
    <div className="rounded-md border border-border bg-card p-3">
      <h4 className="mb-2 text-sm font-semibold">{equation.label}</h4>
      {html ? (
        <div
          className="overflow-x-auto rounded bg-background px-2 py-3 text-foreground"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className="overflow-x-auto rounded bg-background px-2 py-3 text-xs text-muted-foreground">
          {equation.latex}
        </pre>
      )}

      {equation.variables && equation.variables.length > 0 && (
        <div className="mt-3 space-y-1 text-xs text-muted-foreground">
          {equation.variables.map((variable) => (
            <p key={variable.symbol}>
              <code className="rounded bg-background px-1 py-0.5 text-foreground">
                {variable.symbol}
              </code>{" "}
              {variable.description}
              {variable.units ? ` (${variable.units})` : ""}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
