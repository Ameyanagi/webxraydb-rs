export interface ElementData {
  z: number;
  symbol: string;
  name: string;
  molar_mass: number;
  density: number;
}

export interface PeriodicTableProps {
  elements: ElementData[];
  selectedZ?: number | null;
  onSelect?: (z: number) => void;
}
