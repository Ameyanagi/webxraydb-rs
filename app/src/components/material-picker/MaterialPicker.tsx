import { useState, useMemo, useRef, useEffect } from "react";
import { list_materials } from "~/lib/wasm-api";

interface MaterialPickerProps {
  onSelect: (formula: string, density: number) => void;
  label?: string;
}

interface MaterialEntry {
  name: string;
  formula: string;
  density: number;
}

export function MaterialPicker({
  onSelect,
  label = "Material Database",
}: MaterialPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const materials: MaterialEntry[] = useMemo(() => {
    try {
      return list_materials() as MaterialEntry[];
    } catch {
      return [];
    }
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return materials;
    const q = query.toLowerCase();
    return materials.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.formula.toLowerCase().includes(q),
    );
  }, [materials, query]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="space-y-1" ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search materials (water, kapton, silicon...)"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {open && filtered.length > 0 && (
          <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
            {filtered.map((m) => (
              <button
                key={m.name}
                type="button"
                onClick={() => {
                  onSelect(m.formula, m.density);
                  setQuery(m.name);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
              >
                <span className="font-medium capitalize">{m.name}</span>
                <span className="text-muted-foreground">
                  {m.formula} · {m.density} g/cm³
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
