# webxraydb-rs

WebXrayDB tools built with Rust + WebAssembly + React.

## Web App

Frontend lives in `app/`.

```bash
cd app
bun install
bun run dev
```

### Pre-commit Hooks (TypeScript / Oxlint)

`app/package.json` configures `simple-git-hooks` to run on `pre-commit`:

- `bun run lint:ox` (Oxlint on `app/src`)
- `bun run typecheck`

Install/update hooks with:

```bash
cd app
bun install
```

## Desktop App (Independent Subproject)

Desktop packaging lives in `desktop-tauri/`.

```bash
cd desktop-tauri
bun install
bun run dev
```

## Desktop Publishing

Desktop publishing is independent from web deploy.

- Workflow: `.github/workflows/desktop-release.yml`
- Trigger: push a tag matching `desktop-vX.Y.Z`
- Publish target: GitHub Releases
- Platforms: macOS, Windows, Linux

Example:

```bash
git tag desktop-v1.0.0
git push origin desktop-v1.0.0
```
