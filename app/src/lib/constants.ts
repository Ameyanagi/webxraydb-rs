/** Element categories for periodic table coloring */
export const ELEMENT_CATEGORIES: Record<number, string> = {
  // Alkali metals
  3: "alkali",
  11: "alkali",
  19: "alkali",
  37: "alkali",
  55: "alkali",
  87: "alkali",
  // Alkaline earth metals
  4: "alkaline-earth",
  12: "alkaline-earth",
  20: "alkaline-earth",
  38: "alkaline-earth",
  56: "alkaline-earth",
  88: "alkaline-earth",
  // Transition metals
  ...Object.fromEntries(
    [
      21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 39, 40, 41, 42, 43, 44, 45, 46,
      47, 48, 72, 73, 74, 75, 76, 77, 78, 79, 80, 104, 105, 106, 107, 108,
      109, 110, 111, 112,
    ].map((z) => [z, "transition"]),
  ),
  // Post-transition metals
  13: "post-transition",
  31: "post-transition",
  49: "post-transition",
  50: "post-transition",
  81: "post-transition",
  82: "post-transition",
  83: "post-transition",
  84: "post-transition",
  113: "post-transition",
  114: "post-transition",
  115: "post-transition",
  116: "post-transition",
  // Metalloids
  5: "metalloid",
  14: "metalloid",
  32: "metalloid",
  33: "metalloid",
  51: "metalloid",
  52: "metalloid",
  // Nonmetals
  1: "nonmetal",
  6: "nonmetal",
  7: "nonmetal",
  8: "nonmetal",
  15: "nonmetal",
  16: "nonmetal",
  34: "nonmetal",
  // Halogens
  9: "halogen",
  17: "halogen",
  35: "halogen",
  53: "halogen",
  85: "halogen",
  117: "halogen",
  // Noble gases
  2: "noble-gas",
  10: "noble-gas",
  18: "noble-gas",
  36: "noble-gas",
  54: "noble-gas",
  86: "noble-gas",
  118: "noble-gas",
  // Lanthanides
  ...Object.fromEntries(
    Array.from({ length: 15 }, (_, i) => [57 + i, "lanthanide"]),
  ),
  // Actinides
  ...Object.fromEntries(
    Array.from({ length: 15 }, (_, i) => [89 + i, "actinide"]),
  ),
};

/** Category colors for periodic table (Tailwind-compatible) */
export const CATEGORY_COLORS: Record<string, string> = {
  "alkali": "bg-red-900/50 hover:bg-red-900/70",
  "alkaline-earth": "bg-orange-900/50 hover:bg-orange-900/70",
  "transition": "bg-yellow-900/40 hover:bg-yellow-900/60",
  "post-transition": "bg-green-900/40 hover:bg-green-900/60",
  "metalloid": "bg-teal-900/40 hover:bg-teal-900/60",
  "nonmetal": "bg-blue-900/50 hover:bg-blue-900/70",
  "halogen": "bg-indigo-900/50 hover:bg-indigo-900/70",
  "noble-gas": "bg-purple-900/50 hover:bg-purple-900/70",
  "lanthanide": "bg-pink-900/40 hover:bg-pink-900/60",
  "actinide": "bg-rose-900/40 hover:bg-rose-900/60",
};

/**
 * Standard periodic table layout.
 * Each entry is [row, col, Z] for placement in an 18-column grid.
 */
export const PERIODIC_TABLE_LAYOUT: [number, number, number][] = [
  // Row 1
  [0, 0, 1],
  [0, 17, 2],
  // Row 2
  [1, 0, 3],
  [1, 1, 4],
  [1, 12, 5],
  [1, 13, 6],
  [1, 14, 7],
  [1, 15, 8],
  [1, 16, 9],
  [1, 17, 10],
  // Row 3
  [2, 0, 11],
  [2, 1, 12],
  [2, 12, 13],
  [2, 13, 14],
  [2, 14, 15],
  [2, 15, 16],
  [2, 16, 17],
  [2, 17, 18],
  // Row 4
  ...Array.from({ length: 18 }, (_, i) => [3, i, 19 + i] as [number, number, number]),
  // Row 5
  ...Array.from({ length: 18 }, (_, i) => [4, i, 37 + i] as [number, number, number]),
  // Row 6 (with lanthanide gap)
  [5, 0, 55],
  [5, 1, 56],
  // La-Lu go in the lanthanide row (row 8)
  ...Array.from({ length: 15 }, (_, i) => [8, 2 + i, 57 + i] as [number, number, number]),
  [5, 2, 72],
  [5, 3, 73],
  [5, 4, 74],
  [5, 5, 75],
  [5, 6, 76],
  [5, 7, 77],
  [5, 8, 78],
  [5, 9, 79],
  [5, 10, 80],
  [5, 11, 81],
  [5, 12, 82],
  [5, 13, 83],
  [5, 14, 84],
  [5, 15, 85],
  [5, 16, 86],
  // Row 7 (with actinide gap)
  [6, 0, 87],
  [6, 1, 88],
  // Ac-Lr go in the actinide row (row 9)
  ...Array.from({ length: 15 }, (_, i) => [9, 2 + i, 89 + i] as [number, number, number]),
  [6, 2, 104],
  [6, 3, 105],
  [6, 4, 106],
  [6, 5, 107],
  [6, 6, 108],
  [6, 7, 109],
  [6, 8, 110],
  [6, 9, 111],
  [6, 10, 112],
  [6, 11, 113],
  [6, 12, 114],
  [6, 13, 115],
  [6, 14, 116],
  [6, 15, 117],
  [6, 16, 118],
];

/** Generate an array of energies from start to end with given step */
export function energyRange(
  startEv: number,
  endEv: number,
  stepEv: number,
): Float64Array {
  const n = Math.floor((endEv - startEv) / stepEv) + 1;
  const arr = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    arr[i] = startEv + i * stepEv;
  }
  return arr;
}
