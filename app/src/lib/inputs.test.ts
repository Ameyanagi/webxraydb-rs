import { describe, expect, it } from "vitest";
import {
  clampNumber,
  isPositiveFinite,
  parseNumberOrNull,
  validateRange,
} from "~/lib/inputs";

describe("inputs utilities", () => {
  it("parses numbers from strings", () => {
    expect(parseNumberOrNull("12.5")).toBe(12.5);
    expect(parseNumberOrNull("")).toBeNull();
    expect(parseNumberOrNull("abc")).toBeNull();
  });

  it("clamps values into range", () => {
    expect(clampNumber(5, 0, 10)).toBe(5);
    expect(clampNumber(-1, 0, 10)).toBe(0);
    expect(clampNumber(11, 0, 10)).toBe(10);
  });

  it("validates positive finite values", () => {
    expect(isPositiveFinite(1)).toBe(true);
    expect(isPositiveFinite(0)).toBe(false);
    expect(isPositiveFinite(Number.NaN)).toBe(false);
  });

  it("validates ranges", () => {
    expect(validateRange(100, 200, 10).valid).toBe(true);
    expect(validateRange(100, 50, 10).valid).toBe(false);
    expect(validateRange(100, 200, 0).valid).toBe(false);
  });
});
