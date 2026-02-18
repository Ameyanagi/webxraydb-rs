import { describe, expect, it } from "vitest";
import { findClosestIndexByValue, stableSort } from "~/lib/table";

describe("table utilities", () => {
  it("stable-sorts while preserving order for equals", () => {
    const rows = [
      { id: "a", value: 2 },
      { id: "b", value: 1 },
      { id: "c", value: 2 },
    ];
    const sorted = stableSort(rows, (x, y) => x.value - y.value);
    expect(sorted.map((r) => r.id)).toEqual(["b", "a", "c"]);
  });

  it("finds closest index to a target value", () => {
    const rows = [{ e: 100 }, { e: 150 }, { e: 260 }];
    expect(findClosestIndexByValue(rows, (r) => r.e, 180)).toBe(1);
    expect(findClosestIndexByValue(rows, (r) => r.e, 250)).toBe(2);
    expect(findClosestIndexByValue<number>([], (r) => r, 1)).toBe(-1);
  });
});
