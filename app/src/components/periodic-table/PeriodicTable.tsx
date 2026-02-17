import { useMemo } from "react";
import { PERIODIC_TABLE_LAYOUT } from "~/lib/constants";
import { ElementCell } from "./ElementCell";
import type { ElementData, PeriodicTableProps } from "./types";

export function PeriodicTable({
  elements,
  selectedZ,
  onSelect,
}: PeriodicTableProps) {
  const elementsByZ = useMemo(() => {
    const map = new Map<number, ElementData>();
    for (const el of elements) {
      map.set(el.z, el);
    }
    return map;
  }, [elements]);

  const handleClick = (z: number) => {
    onSelect?.(z);
  };

  // Grid dimensions: 18 cols, 10 rows (7 main + gap + 2 f-block)
  const rows = 10;
  const cols = 18;

  return (
    <div className="overflow-x-auto">
      <div
        className="inline-grid gap-0.5"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(2.5rem, 1fr))`,
          gridTemplateRows: `repeat(${rows}, 2.5rem)`,
        }}
      >
        {PERIODIC_TABLE_LAYOUT.map(([row, col, z]) => {
          const element = elementsByZ.get(z);
          if (!element) return null;

          // Row 7 is empty (gap between main table and f-block)
          const gridRow = row < 8 ? row + 1 : row + 1;

          return (
            <div
              key={z}
              style={{
                gridRow: gridRow,
                gridColumn: col + 1,
              }}
            >
              <ElementCell
                element={element}
                selected={selectedZ === z}
                onClick={handleClick}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
