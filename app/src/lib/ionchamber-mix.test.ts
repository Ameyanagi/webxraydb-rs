import { describe, expect, it } from "vitest";
import {
  rebalanceForAddedGas,
  removeGasAndRedistribute,
  updateGasFractionBalanced,
} from "~/lib/ionchamber-mix";

describe("ionchamber mix helpers", () => {
  it("rebalances existing gases when adding a new gas", () => {
    const initial = [
      { name: "N2", fraction: 0.7 },
      { name: "He", fraction: 0.3 },
    ];
    const next = rebalanceForAddedGas(initial, "Ar", 0.1);
    const total = next.reduce((sum, gas) => sum + gas.fraction, 0);
    expect(next).toHaveLength(3);
    expect(total).toBeCloseTo(1, 6);
    expect(next[2].name).toBe("Ar");
  });

  it("removes a gas and redistributes fractions", () => {
    const initial = [
      { name: "N2", fraction: 0.5 },
      { name: "He", fraction: 0.3 },
      { name: "Ar", fraction: 0.2 },
    ];
    const next = removeGasAndRedistribute(initial, 1);
    const total = next.reduce((sum, gas) => sum + gas.fraction, 0);
    expect(next).toHaveLength(2);
    expect(total).toBeCloseTo(1, 6);
  });

  it("updates one gas fraction and rebalances the others", () => {
    const initial = [
      { name: "N2", fraction: 0.6 },
      { name: "He", fraction: 0.4 },
    ];
    const next = updateGasFractionBalanced(initial, 0, 0.2);
    expect(next[0].fraction).toBeCloseTo(0.2, 6);
    expect(next[1].fraction).toBeCloseTo(0.8, 6);
  });
});
