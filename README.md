# RetroAmp

> Retro DOS-style music player for Windows — built with Tauri + Vue

![RetroAmp screenshot placeholder](resources/screenshot.png)

## Features

- **Native desktop shell** — Tauri backend (Rust) + Vue renderer
- **Spectrum visualizer** — realtime canvas visualization driven by Web Audio API analyser
- **Playlist management** — add files, open folder recursively, remove tracks
- **M3U workflow** — import and export playlist files
- **Metadata tags** — Title / Artist / Album / Year / Duration
- **Album art** — embedded artwork extraction from audio metadata
- **Settings** — compact mode, cover toggle, auto-play toggle, visualizer intensity
- **Drag & drop** — drop files directly into app window
- **Retro CRT aesthetic** — high-contrast phosphor-like UI

## Documentation

- [docs/QUICKSTART.md](docs/QUICKSTART.md) — setup and first run
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — process boundaries and data flow
- [DESIGN.md](DESIGN.md) — UI/UX design specification
- [AGENTS.md](AGENTS.md) — instructions for coding agents
- [CLAUDE.md](CLAUDE.md) — Claude-specific working notes

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `Ctrl + →` | Next track |
| `Ctrl + ←` | Previous track |
| `→` / `←` | Seek ±5 seconds |
| `↑` / `↓` | Volume ±5% |
| `M` | Mute / Unmute |

## Supported Formats

MP3, FLAC, OGG, WAV, AAC, M4A, OPUS, WMA

## Development

```bash
# Install dependencies
npm install

# Start app in dev mode (Tauri + Vite)
npm run dev

# Build full desktop app (installer + bundles)
npm run build

# Build only frontend assets
npm run build:web
```

## Tech Stack

- **Tauri 2** — native desktop runtime and packaging
- **Rust** — native commands (dialogs, tags, covers, m3u)
- **Vue 3** — UI
- **Web Audio API** — spectrum analyser
- **Vite** — frontend build tooling

## Project Structure

```
src-tauri/
  src/lib.rs                — Native commands and Tauri app bootstrap
  tauri.conf.json           — Desktop app configuration

src/renderer/
  index.html                — Frontend entry HTML
  src/
    App.vue                 — Player UI and state
    main.jsx                — Vue bootstrap + Tauri bridge shim
    styles/App.css          — Global retro styles

scripts/
  tauri-runner.cjs          — Robust Tauri command runner for Windows PATH quirks
  vite-runner.cjs           — Direct Vite runner for Tauri pre-commands
```

## CI/CD

- `CI` workflow: validates frontend build and native Windows build on push/PR
- `Release` workflow: on tag `v*` builds app and publishes artifacts to GitHub Releases

See:
- [.github/workflows/ci.yml](.github/workflows/ci.yml)
- [.github/workflows/release.yml](.github/workflows/release.yml)
