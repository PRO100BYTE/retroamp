# Quickstart

## Requirements

- Windows 10/11
- Node.js 18+
- Rust toolchain (rustup/cargo) for native builds

## Run in Development

```bash
npm install
npm run dev
```

## Build for Windows

```bash
npm run build
```

Installer output is generated in:

- `src-tauri/target/release/bundle/nsis/`
- `src-tauri/target/release/bundle/msi/`

## Frontend-only Build

```bash
npm run build:web
```

This writes assets to `dist/`.

## CI/CD

- CI runs on push/PR to `master/main`.
- Release pipeline runs on git tags matching `v*` and publishes artifacts to GitHub Releases.

Tag release example:

```bash
git tag v1.0.1
git push origin v1.0.1
```

## Smoke Test

1. Start app.
2. Add a few files via file actions.
3. Add folder via folder action.
4. Try drag-and-drop from Explorer.
5. Verify playback, seek, volume.
6. Verify metadata + cover loading.
7. Verify M3U import/export.
