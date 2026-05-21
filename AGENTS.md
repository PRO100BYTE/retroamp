# AGENTS.md — AI Agent Instructions for RetroAmp

Guidance for coding agents working on the current RetroAmp codebase.

## Project Overview

RetroAmp is now a Tauri + Vue Windows desktop player (no Electron runtime).
The app includes native file dialogs, metadata parsing, cover extraction, M3U import/export, and a realtime spectrum visualizer.

## Development Environment

```bash
npm install
npm run dev
npm run build
```

Useful scripts:

- `npm run dev` — run app in Tauri dev mode
- `npm run build` — full desktop build
- `npm run build:web` — frontend-only build

## Core Conventions

- Keep native functionality inside `src-tauri/src/lib.rs` commands.
- Keep renderer logic in `src/renderer/src/App.vue` and avoid direct FS access from browser code.
- Use the bridge in `src/renderer/src/main.jsx` (`window.electronAPI` compatibility shim) for all native actions.
- Avoid heavy allocations in visualization loops.

## Where to Put Code

| What | Where |
|---|---|
| Native dialogs/tags/covers/m3u commands | `src-tauri/src/lib.rs` |
| Tauri app/runtime config | `src-tauri/tauri.conf.json` |
| Renderer boot + native bridge | `src/renderer/src/main.jsx` |
| Player UI/state/audio engine | `src/renderer/src/App.vue` |
| Global visual language | `src/renderer/src/styles/App.css` |
| Build runner scripts | `scripts/tauri-runner.cjs`, `scripts/vite-runner.cjs` |
| CI/CD workflows | `.github/workflows/*.yml` |

## Testing Checklist (Manual)

- Open files and open folder work.
- Drag/drop from Explorer appends tracks.
- Tags (title/artist/album/year) are visible.
- Embedded covers load for current track.
- Visualizer reacts during playback.
- M3U import and export both work.
- `npm run build` succeeds.

## Common Pitfalls

- Windows PATH may not contain `cargo`/`npm`/`node` in nested commands. Use runner scripts, do not bypass them.
- `beforeBuildCommand` in Tauri config must not call `npm run build` (recursion risk).
- Keep `TrackMeta` structs deserializable when receiving arrays from JS commands.

## PR Notes

- Keep commits focused.
- Mention user-visible impact.
- Do not force-push without explicit approval.
