import { createContext, useContext } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type AccentColor = "blue" | "green" | "purple" | "orange";

export interface ThemeState {
  mode: ThemeMode;
  accent: AccentColor;
  setMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentColor) => void;
  resolvedMode: "light" | "dark";
}

export const ThemeContext = createContext<ThemeState>({
  mode: "dark",
  accent: "blue",
  setMode: () => {},
  setAccent: () => {},
  resolvedMode: "dark",
});

export function useTheme() {
  return useContext(ThemeContext);
}

const STORAGE_KEY_MODE = "webxraydb-theme-mode";
const STORAGE_KEY_ACCENT = "webxraydb-theme-accent";

export function loadSavedMode(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  return (localStorage.getItem(STORAGE_KEY_MODE) as ThemeMode) ?? "dark";
}

export function loadSavedAccent(): AccentColor {
  if (typeof window === "undefined") return "blue";
  return (localStorage.getItem(STORAGE_KEY_ACCENT) as AccentColor) ?? "blue";
}

export function saveMode(mode: ThemeMode) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY_MODE, mode);
  }
}

export function saveAccent(accent: AccentColor) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY_ACCENT, accent);
  }
}

export function resolveMode(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    if (typeof window === "undefined") return "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return mode;
}
