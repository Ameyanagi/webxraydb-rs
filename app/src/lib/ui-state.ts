export type CalculationStatus = "idle" | "ready" | "error";

export interface CalculationState<T> {
  status: CalculationStatus;
  data: T | null;
  error: string | null;
}

export function readyState<T>(data: T): CalculationState<T> {
  return {
    status: "ready",
    data,
    error: null,
  };
}

export function errorState<T>(error: string): CalculationState<T> {
  return {
    status: "error",
    data: null,
    error,
  };
}
