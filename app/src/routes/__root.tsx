/// <reference types="vite/client" />
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import appCss from "~/styles/app.css?url";

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

function RootDocument({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="bg-background text-foreground antialiased">
        <div className="flex min-h-screen">
          {/* Desktop sidebar */}
          <nav className="hidden w-56 shrink-0 border-r border-border bg-card p-4 md:block">
            <Link
              to="/"
              className="mb-6 block text-lg font-bold text-foreground"
            >
              webxraydb-rs
            </Link>
            <NavList />
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
              <nav className="absolute top-0 left-0 bottom-0 w-64 bg-card p-4 shadow-xl">
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
              </nav>
            </div>
          )}

          <main className="flex-1 p-4 pt-16 md:p-6 md:pt-6">
            {children}
          </main>
        </div>
        <Scripts />
      </body>
    </html>
  );
}
