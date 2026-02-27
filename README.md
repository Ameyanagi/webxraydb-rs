# WebXrayDB

X-ray reference database and calculation tools built with Rust/WebAssembly and React.

This is an independent Rust/WASM implementation. It shares the same underlying atomic data sources (Elam, Chantler, Waasmaier-Kirfel) as the [XrayDB Python project](https://xraypy.github.io/XrayDB/) but is a separate codebase.

## Features

### Lookup
- **Elements** — Periodic table with atomic properties, absorption edges, emission lines, and attenuation plots
- **Edge Finder** — Nearest-energy matching against tabulated absorption edges with harmonic detection
- **Line Finder** — Fluorescence/emission line identification from the Elam database

### Materials
- **Attenuation** — Mass and linear attenuation coefficients for arbitrary chemical formulas (photoelectric, coherent, incoherent channels)
- **Absorption Formulas** — Refractive index (delta/beta), attenuation length, edge-step estimates, per-element cross-sections
- **Scattering Factors** — Anomalous scattering factors f'(E) and f''(E) from Chantler tables

### Sample Preparation
- **Preparation Helper** — Combined transmission and fluorescence planning with automatic dilution optimization
- **Sample Weight** — Pellet mass calculator for target edge-step in transmission XAS
- **Self Absorption** — Fluorescence EXAFS self-absorption correction using exact numerical solution of the Booth equation (Ameyanagi) with Booth and Troger reference traces

### Optics
- **Ion Chamber** — Gas attenuation, flux estimation, and Compton energy calculator
- **Mirror Reflectivity** — Fresnel/Parratt reflectivity with Nevot-Croce roughness for grazing-incidence mirrors
- **Darwin Width** — Dynamical diffraction rocking curves and energy resolution for crystal monochromators
- **Analyzer Crystals** — Crystal reflection ranking for emission spectrometers

## Tech Stack

- **Frontend**: React 19, TanStack Router, Tailwind CSS 4, Vite 7, Plotly, KaTeX
- **Backend**: Rust compiled to WebAssembly (wasm-bindgen, wasm-pack)
- **Desktop**: Tauri 2
- **Package manager**: bun

## Project Structure

```
webxraydb-rs/
├── app/                    # React frontend
│   └── src/
│       ├── routes/         # 15 route pages (TanStack Router)
│       ├── components/     # Reusable UI components
│       ├── docs/           # Tool documentation content
│       └── lib/            # Utilities and WASM API wrappers
├── crates/
│   ├── webxraydb-wasm/     # WASM bindings (xraydb crate + chemical-formula)
│   └── selfabs/            # Self-absorption algorithms (Ameyanagi, Booth, Troger)
└── desktop-tauri/          # Tauri desktop packaging
```

## Development

### Web App

```bash
cd app
bun install
bun run dev
```

### Desktop App

```bash
cd desktop-tauri
bun install
bun run dev
```

### Quality Gates

Pre-commit hooks run automatically via `simple-git-hooks`:

```bash
bun run typecheck     # TypeScript type checking
bun run oxlint src/   # Linting
bun run test -- --run # Unit tests (vitest)
```

## Desktop Publishing

Desktop releases are built via CI and published to GitHub Releases.

- Workflow: `.github/workflows/desktop-release.yml`
- Trigger: push a tag matching `desktop-vX.Y.Z`
- Platforms: macOS, Windows, Linux

```bash
git tag desktop-v1.0.0
git push origin desktop-v1.0.0
```

## Data Sources

- [Elam WT, Ravel BD, Sieber JR. Radiation Physics and Chemistry 63 (2002) 121-128](https://doi.org/10.1016/S0969-806X(01)00227-4)
- [Chantler CT. Journal of Physical and Chemical Reference Data 29 (2000) 597-1056](https://doi.org/10.1063/1.1321055)
- [Waasmaier D, Kirfel A. Acta Crystallographica A 51 (1995) 416-431](https://doi.org/10.1107/S0108767394013292)

## License

Licensed under either of

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE) or <http://www.apache.org/licenses/LICENSE-2.0>)
- MIT License ([LICENSE-MIT](LICENSE-MIT) or <http://opensource.org/licenses/MIT>)

at your option.
