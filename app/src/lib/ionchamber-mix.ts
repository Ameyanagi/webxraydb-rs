export interface GasEntry {
  name: string;
  fraction: number;
}

export function rebalanceForAddedGas(
  gases: GasEntry[],
  gasName: string,
  newFraction = 0.1,
): GasEntry[] {
  if (newFraction <= 0 || newFraction >= 1) return gases;
  if (!gases.length) return [{ name: gasName, fraction: 1 }];

  const total = gases.reduce((sum, gas) => sum + gas.fraction, 0);
  const scale = (1 - newFraction) / Math.max(total, 0.001);

  return [
    ...gases.map((gas) => ({ ...gas, fraction: Math.max(0, gas.fraction * scale) })),
    { name: gasName, fraction: newFraction },
  ];
}

export function removeGasAndRedistribute(gases: GasEntry[], index: number): GasEntry[] {
  if (index < 0 || index >= gases.length) return gases;
  const removed = gases[index];
  const remaining = gases.filter((_, i) => i !== index);
  if (!remaining.length) return gases;

  const remainingSum = remaining.reduce((sum, gas) => sum + gas.fraction, 0);
  if (remainingSum <= 0) {
    return remaining.map((gas, i) => ({ ...gas, fraction: i === 0 ? 1 : 0 }));
  }

  const scale = (remainingSum + removed.fraction) / remainingSum;
  return remaining.map((gas) => ({ ...gas, fraction: gas.fraction * scale }));
}

export function updateGasFractionBalanced(
  gases: GasEntry[],
  index: number,
  nextFraction: number,
): GasEntry[] {
  if (index < 0 || index >= gases.length) return gases;
  const clamped = Math.min(1, Math.max(0, nextFraction));
  if (gases.length === 1) {
    return [{ ...gases[0], fraction: 1 }];
  }

  const othersSum = gases.reduce((sum, gas, i) => sum + (i === index ? 0 : gas.fraction), 0);
  if (othersSum <= 0) {
    // All other gases are at 0 — distribute remainder equally among them
    const otherCount = gases.length - 1;
    const each = otherCount > 0 ? (1 - clamped) / otherCount : 0;
    return gases.map((gas, i) => ({ ...gas, fraction: i === index ? clamped : each }));
  }

  const remaining = 1 - clamped;
  const scale = remaining / othersSum;
  return gases.map((gas, i) => ({
    ...gas,
    fraction: i === index ? clamped : Math.max(0, gas.fraction * scale),
  }));
}
