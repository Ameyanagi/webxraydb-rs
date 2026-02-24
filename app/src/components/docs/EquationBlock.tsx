import { useMemo } from "react";
import katex from "katex";
import type { ToolEquation } from "~/docs/types";

interface EquationBlockProps {
  equation: ToolEquation;
  number?: number;
}

export function EquationBlock({ equation, number }: EquationBlockProps) {
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
    <div className="rounded-md border border-border bg-card">
      {/* Label row */}
      <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2">
        {number != null && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded bg-primary/10 px-1 text-[10px] font-bold text-primary">
            {number}
          </span>
        )}
        <h4 className="text-sm font-medium">{equation.label}</h4>
      </div>

      {/* Rendered equation */}
      {html ? (
        <div
          className="overflow-x-auto px-3 py-3 text-foreground"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre className="overflow-x-auto px-3 py-3 text-xs text-muted-foreground">
          {equation.latex}
        </pre>
      )}

      {/* Variable definitions table */}
      {equation.variables && equation.variables.length > 0 && (
        <div className="border-t border-border/40 px-3 py-2">
          <table className="w-full text-xs">
            <tbody>
              {equation.variables.map((variable) => (
                <tr key={variable.symbol} className="border-b border-border/20 last:border-0">
                  <td className="w-24 py-1 pr-2 align-top">
                    <VariableSymbol latex={variable.symbol} />
                  </td>
                  <td className="py-1 text-muted-foreground">
                    {variable.description}
                    {variable.units && (
                      <span className="ml-1 text-primary/70">[{variable.units}]</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function VariableSymbol({ latex }: { latex: string }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(latex, {
        displayMode: false,
        throwOnError: false,
        strict: "ignore",
      });
    } catch {
      return null;
    }
  }, [latex]);

  if (html) {
    return (
      <span
        className="inline-block text-foreground"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return <code className="rounded bg-background px-1 py-0.5 text-foreground">{latex}</code>;
}
