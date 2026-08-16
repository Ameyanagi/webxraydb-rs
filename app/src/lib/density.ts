import { list_materials, parse_formula } from "~/lib/wasm-api";

export interface DensityMatch {
  name: string;
  formula: string;
  density: number;
}

/**
 * Normalize a formula to a stoichiometry key ("Fe:1.0000|O:1.5000"), so
 * spelling variants of the same composition compare equal. Returns null when
 * the formula does not parse. Requires the wasm module to be initialized.
 */
function formulaKey(formula: string): string | null {
  try {
    const parsed = parse_formula(formula);
    const components = parsed.components as { symbol: string; count: number }[];
    if (components.length === 0) return null;
    const stoich = new Map<string, number>();
    for (const c of components) {
      stoich.set(c.symbol, (stoich.get(c.symbol) ?? 0) + c.count);
    }
    const smallest = Math.min(...stoich.values());
    if (!(smallest > 0)) return null;
    return [...stoich.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([sym, n]) => `${sym}:${(n / smallest).toFixed(4)}`)
      .join("|");
  } catch {
    return null;
  }
}

/**
 * Look a formula up in the xraydb materials database by normalized
 * stoichiometry. Returns null when nothing matches or wasm is not ready.
 */
export function findDatabaseDensity(formula: string): DensityMatch | null {
  if (!formula.trim()) return null;
  const target = formulaKey(formula);
  if (!target) return null;
  try {
    const materials = list_materials() as DensityMatch[];
    return materials.find((m) => formulaKey(m.formula) === target) ?? null;
  } catch {
    return null;
  }
}
