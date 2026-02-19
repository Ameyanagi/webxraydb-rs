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
- If GitHub secrets for Apple signing/notarization are configured, the release workflow signs and notarizes macOS artifacts.
- If those secrets are missing, the workflow falls back to ad-hoc signing for local/test distribution only.
- Without Apple notarization, Gatekeeper may still block first launch on downloaded artifacts.
- Local override command: `xattr -dr com.apple.quarantine /Applications/WebXrayDB.app`

### Enable Apple Notarization in GitHub Actions

Add these repository secrets:

- `APPLE_CERTIFICATE`: base64 of your `Developer ID Application` certificate `.p12`
- `APPLE_CERTIFICATE_PASSWORD`: password for the `.p12`
- `KEYCHAIN_PASSWORD`: temporary keychain password for CI
- `APPLE_ID`: Apple ID email used for notarization
- `APPLE_PASSWORD`: app-specific password for the Apple ID
- `APPLE_TEAM_ID`: your Apple Developer Team ID
- `APPLE_SIGNING_IDENTITY` (optional): explicit signing identity, e.g. `Developer ID Application: Your Name (TEAMID)`

Create `APPLE_CERTIFICATE` value:

```bash
base64 -i developer-id-application.p12 | pbcopy
```
