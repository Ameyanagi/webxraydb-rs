export function parseNumberOrNull(value: string | number): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function isPositiveFinite(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export interface RangeValidation {
  valid: boolean;
  points: number;
  error: string | null;
}

export function validateRange(
  start: number,
  end: number,
  step: number,
  maxPoints = 50000,
): RangeValidation {
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(step)) {
    return { valid: false, points: 0, error: "Range values must be finite numbers" };
  }
  if (step <= 0) {
    return { valid: false, points: 0, error: "Step must be greater than zero" };
  }
  if (end <= start) {
    return { valid: false, points: 0, error: "End must be greater than start" };
  }
  const points = Math.floor((end - start) / step) + 1;
  if (points <= 1) {
    return { valid: false, points, error: "Range must contain at least two points" };
  }
  if (points > maxPoints) {
    return {
      valid: false,
      points,
      error: `Range is too dense (${points} points). Increase step or reduce span`,
    };
  }
  return { valid: true, points, error: null };
}
