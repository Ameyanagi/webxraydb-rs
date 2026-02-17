import { useState, useCallback, useEffect } from "react";
import { validate_formula, parse_formula } from "~/lib/wasm-api";

interface FormulaInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
}

export function FormulaInput({
  value,
  onChange,
  label = "Chemical Formula",
  placeholder = "e.g. H2O, SiO2, Pt5wt%/SiO2",
}: FormulaInputProps) {
  const [error, setError] = useState<string | null>(null);
  const [components, setComponents] = useState<string | null>(null);

  const validateAndParse = useCallback((formula: string) => {
    if (!formula.trim()) {
      setError(null);
      setComponents(null);
      return;
    }
    if (validate_formula(formula)) {
      setError(null);
      try {
        const parsed = parse_formula(formula);
        const parts = (parsed.components as { symbol: string; count: number }[])
          .map((c) => `${c.symbol}: ${c.count % 1 === 0 ? c.count : c.count.toFixed(3)}`)
          .join(", ");
        setComponents(parts);
      } catch {
        setComponents(null);
      }
    } else {
      setError("Invalid formula");
      setComponents(null);
    }
  }, []);

  useEffect(() => {
    validateAndParse(value);
  }, [value, validateAndParse]);

  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-md border bg-background px-3 py-2 text-sm ${
          error
            ? "border-destructive focus:ring-destructive"
            : "border-input focus:ring-ring"
        } focus:outline-none focus:ring-2`}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      {components && (
        <p className="text-xs text-muted-foreground">{components}</p>
      )}
    </div>
  );
}
