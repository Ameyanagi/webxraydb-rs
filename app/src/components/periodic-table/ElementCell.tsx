import {
  ELEMENT_CATEGORIES,
  CATEGORY_COLORS,
} from "~/lib/constants";
import type { ElementData } from "./types";

interface ElementCellProps {
  element: ElementData;
  selected: boolean;
  onClick: (z: number) => void;
}

export function ElementCell({ element, selected, onClick }: ElementCellProps) {
  const category = ELEMENT_CATEGORIES[element.z] ?? "transition";
  const colorClass = CATEGORY_COLORS[category] ?? "bg-secondary";

  return (
    <button
      type="button"
      onClick={() => onClick(element.z)}
      className={`flex h-full w-full flex-col items-center justify-center rounded border p-0.5 text-center transition-colors ${colorClass} ${
        selected
          ? "border-primary ring-1 ring-primary"
          : "border-transparent hover:border-muted-foreground/30"
      }`}
      title={`${element.name} (${element.symbol}) Z=${element.z}`}
    >
      <span className="hidden text-muted-foreground sm:block sm:text-[9px] sm:leading-tight">
        {element.z}
      </span>
      <span className="text-[8px] font-bold leading-none sm:text-xs sm:leading-tight">{element.symbol}</span>
    </button>
  );
}
