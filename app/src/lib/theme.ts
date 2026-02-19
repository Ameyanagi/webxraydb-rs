import { createContext, useContext } from "react";

export type ThemeMode = "light" | "dark" | "system";
export type ThemePreset = "default" | "nature" | "amethyst" | "sapphire" | "rose";

export interface ThemeState {
  mode: ThemeMode;
  preset: ThemePreset;
  setMode: (mode: ThemeMode) => void;
  setPreset: (preset: ThemePreset) => void;
  resolvedMode: "light" | "dark";
}

export const ThemeContext = createContext<ThemeState>({
  mode: "dark",
  preset: "default",
  setMode: () => {},
  setPreset: () => {},
  resolvedMode: "dark",
});

export function useTheme() {
  return useContext(ThemeContext);
}

const STORAGE_KEY_MODE = "webxraydb-theme-mode";
const STORAGE_KEY_PRESET = "webxraydb-theme-preset";

export function loadSavedMode(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  return (localStorage.getItem(STORAGE_KEY_MODE) as ThemeMode) ?? "dark";
}

export function loadSavedPreset(): ThemePreset {
  if (typeof window === "undefined") return "default";
  const saved = localStorage.getItem(STORAGE_KEY_PRESET);
  if (saved && ["default", "nature", "amethyst", "sapphire", "rose"].includes(saved)) {
    return saved as ThemePreset;
  }
  return "default";
}

export function saveMode(mode: ThemeMode) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY_MODE, mode);
  }
}

export function savePreset(preset: ThemePreset) {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY_PRESET, preset);
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
