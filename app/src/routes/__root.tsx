/// <reference types="vite/client" />
import {
  HeadContent,
  Link,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import { useState, useEffect, useCallback, useContext, type ReactNode } from "react";
import appCss from "~/styles/app.css?url";
import {
  ThemeContext,
  loadSavedMode,
  loadSavedPreset,
  saveMode,
  savePreset,
  resolveMode,
  type ThemeMode,
  type ThemePreset,
} from "~/lib/theme";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "webxraydb-rs — X-ray Analysis Tools" },
      {
        name: "description",
        content:
          "Web-based X-ray analysis tools powered by Rust/WASM. Element lookup, absorption edges, scattering factors, and more.",
      },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootDocument,
});

const navItems = [
  { to: "/", label: "Elements" },
  { to: "/edges", label: "Edge Finder" },
  { to: "/lines", label: "Line Finder" },
  { to: "/attenuation", label: "Attenuation" },
  { to: "/formulas", label: "Formulas" },
  { to: "/scattering", label: "Scattering" },
  { to: "/ionchamber", label: "Ion Chamber" },
  { to: "/reflectivity", label: "Reflectivity" },
  { to: "/darwin", label: "Darwin Width" },
  { to: "/sample-weight", label: "Sample Weight" },
  { to: "/analyzers", label: "Analyzers" },
] as const;

const THEME_OPTIONS: { value: ThemePreset; label: string; hue: string }[] = [
  { value: "default", label: "Default", hue: "oklch(0.7 0.15 230)" },
  { value: "nature", label: "Nature", hue: "oklch(0.5234 0.1347 144.1672)" },
  { value: "amethyst", label: "Amethyst", hue: "oklch(0.6104 0.0767 299.7335)" },
  { value: "sapphire", label: "Sapphire", hue: "oklch(0.6723 0.1606 244.9955)" },
  { value: "rose", label: "Rose", hue: "oklch(0.5316 0.1409 355.1999)" },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <ul className="space-y-1">
      {navItems.map((item) => (
        <li key={item.to}>
          <Link
            to={item.to}
            onClick={onNavigate}
            className="block rounded-md px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground [&.active]:bg-accent [&.active]:text-accent-foreground"
          >
            {item.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ThemeControlsInner() {
  const { mode, preset, setMode, setPreset } = useContext(ThemeContext);

  return (
    <div className="space-y-3 border-t border-border pt-3">
      {/* Mode toggle — icon + label */}
      <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
        {(["light", "dark", "system"] as ThemeMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors ${
              mode === m
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {m === "light" ? (
              <SunIcon />
            ) : m === "dark" ? (
              <MoonIcon />
            ) : (
              <SystemIcon />
            )}
            <span className="capitalize">{m}</span>
          </button>
        ))}
      </div>
      {/* Theme preset */}
      <div className="flex items-center gap-1.5">
        {THEME_OPTIONS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setPreset(t.value)}
            title={t.label}
            className={`h-5 w-5 rounded-full border-2 transition-transform ${
              preset === t.value
                ? "scale-110 border-foreground"
                : "border-transparent hover:scale-105"
            }`}
            style={{ backgroundColor: t.hue }}
          />
        ))}
      </div>
    </div>
  );
}

function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="mx-auto">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="mx-auto">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function SystemIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="mx-auto">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mode, setModeState] = useState<ThemeMode>(() => loadSavedMode());
  const [preset, setPresetState] = useState<ThemePreset>(() => loadSavedPreset());
  const [resolvedModeVal, setResolvedMode] = useState<"light" | "dark">(() =>
    resolveMode(mode),
  );

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    saveMode(m);
  }, []);

  const setPreset = useCallback((p: ThemePreset) => {
    setPresetState(p);
    savePreset(p);
  }, []);

  // Resolve mode and sync with <html> class + data attribute
  useEffect(() => {
    const resolved = resolveMode(mode);
    setResolvedMode(resolved);

    const html = document.documentElement;
    if (resolved === "dark") {
      html.classList.add("dark");
    } else {
      html.classList.remove("dark");
    }

    if (preset === "default") {
      html.removeAttribute("data-theme");
    } else {
      html.setAttribute("data-theme", preset);
    }
  }, [mode, preset]);

  // Listen for system preference changes when mode is "system"
  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setResolvedMode(mq.matches ? "dark" : "light");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode]);

  const themeValue = {
    mode,
    preset,
    setMode,
    setPreset,
    resolvedMode: resolvedModeVal,
  };

  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="bg-background text-foreground antialiased">
        <ThemeContext.Provider value={themeValue}>
          <div className="flex min-h-screen">
            {/* Desktop sidebar */}
            <nav className="hidden w-56 shrink-0 border-r border-border bg-card p-4 md:flex md:flex-col">
              <Link
                to="/"
                className="mb-6 block text-lg font-bold text-foreground"
              >
                webxraydb-rs
              </Link>
              <NavList />
              <div className="mt-auto pt-4">
                <ThemeControlsInner />
              </div>
            </nav>

            {/* Mobile header */}
            <div className="fixed top-0 left-0 right-0 z-40 flex items-center gap-3 border-b border-border bg-card px-4 py-3 md:hidden">
              <button
                type="button"
                onClick={() => setMenuOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-md hover:bg-accent"
                aria-label="Open menu"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="3" y1="5" x2="17" y2="5" />
                  <line x1="3" y1="10" x2="17" y2="10" />
                  <line x1="3" y1="15" x2="17" y2="15" />
                </svg>
              </button>
              <Link to="/" className="text-sm font-bold text-foreground">
                webxraydb-rs
              </Link>
            </div>

            {/* Mobile overlay nav */}
            {menuOpen && (
              <div className="fixed inset-0 z-50 md:hidden">
                {/* Backdrop */}
                <div
                  className="absolute inset-0 bg-black/60"
                  onClick={() => setMenuOpen(false)}
                />
                {/* Drawer */}
                <nav className="absolute top-0 left-0 bottom-0 flex w-64 flex-col bg-card p-4 shadow-xl">
                  <div className="mb-6 flex items-center justify-between">
                    <Link
                      to="/"
                      onClick={() => setMenuOpen(false)}
                      className="text-lg font-bold text-foreground"
                    >
                      webxraydb-rs
                    </Link>
                    <button
                      type="button"
                      onClick={() => setMenuOpen(false)}
                      className="flex h-10 w-10 items-center justify-center rounded-md hover:bg-accent"
                      aria-label="Close menu"
                    >
                      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <line x1="4" y1="4" x2="14" y2="14" />
                        <line x1="14" y1="4" x2="4" y2="14" />
                      </svg>
                    </button>
                  </div>
                  <NavList onNavigate={() => setMenuOpen(false)} />
                  <div className="mt-auto pt-4">
                    <ThemeControlsInner />
                  </div>
                </nav>
              </div>
            )}

            <main className="flex-1 p-4 pt-16 md:p-6 md:pt-6 max-w-7xl">
              {children}
            </main>
          </div>
          <Scripts />
        </ThemeContext.Provider>
      </body>
    </html>
  );
}
