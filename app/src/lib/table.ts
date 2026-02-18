export function stableSort<T>(
  items: readonly T[],
  compare: (a: T, b: T) => number,
): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const order = compare(a.item, b.item);
      return order !== 0 ? order : a.index - b.index;
    })
    .map((entry) => entry.item);
}

export function findClosestIndexByValue<T>(
  items: readonly T[],
  getValue: (item: T) => number,
  target: number,
): number {
  if (!items.length || !Number.isFinite(target)) return -1;

  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < items.length; i++) {
    const value = getValue(items[i]);
    if (!Number.isFinite(value)) continue;
    const distance = Math.abs(value - target);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }

  return bestIndex;
}
