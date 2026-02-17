/// <reference types="vite/client" />
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
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
  { to: "/analyzers", label: "Analyzers" },
] as const;

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="bg-background text-foreground antialiased">
        <div className="flex min-h-screen">
          <nav className="w-56 shrink-0 border-r border-border bg-card p-4">
            <Link
              to="/"
              className="mb-6 block text-lg font-bold text-foreground"
            >
              webxraydb-rs
            </Link>
            <ul className="space-y-1">
              {navItems.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground [&.active]:bg-accent [&.active]:text-accent-foreground"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <main className="flex-1 p-6">
            {children}
          </main>
        </div>
        <Scripts />
      </body>
    </html>
  );
}
