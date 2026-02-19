# WebXrayDB Desktop (Tauri)

Independent desktop packaging project for WebXrayDB.

## Prerequisites

- Rust stable toolchain
- `wasm32-unknown-unknown` Rust target
- `wasm-pack`
- Bun
- Tauri system dependencies (platform-specific):
  - https://v2.tauri.app/start/prerequisites/

## Local Development

```bash
cd desktop-tauri
bun install
bun run dev
```

This starts the web frontend from `../app` and opens it in a Tauri window.

## Build Desktop Bundles

```bash
cd desktop-tauri
bun install
bun run build
```

This build automatically:

1. Rebuilds Rust/WASM bindings from `crates/webxraydb-wasm`
2. Rebuilds the frontend in `app/`
3. Packages desktop bundles with Tauri

Bundle outputs are under:

- `desktop-tauri/src-tauri/target/release/bundle`

## Release Workflow

Desktop releases are published by tag via GitHub Actions.

- Tag pattern: `desktop-vX.Y.Z`
- Workflow: `.github/workflows/desktop-release.yml`
- Output: GitHub Release with platform installers uploaded as separate assets
  (for example `.AppImage`, `.deb`, `.rpm`, `.dmg`, `.app.tar.gz`, `.exe`, `.msi`, and a Windows portable `.exe` when available)

macOS note:
- The release workflow re-signs the generated `.app` before packaging.
- Without Apple Developer notarization, Gatekeeper may still block first launch on downloaded artifacts.
- Local override command: `xattr -dr com.apple.quarantine /Applications/WebXrayDB.app`
