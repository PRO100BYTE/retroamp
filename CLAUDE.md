# CLAUDE.md — Claude / Anthropic Agent Instructions for RetroAmp

Read this file before making changes.

## Project in One Sentence

RetroAmp is a retro-themed Windows desktop audio player built on Tauri + Vue with native metadata and playlist workflows.

## Key Files

| File | Purpose |
|---|---|
| `src-tauri/src/lib.rs` | Tauri native commands: dialogs, tags, covers, m3u |
| `src-tauri/tauri.conf.json` | Build/runtime configuration |
| `src/renderer/src/main.jsx` | Vue bootstrap and native bridge shim |
| `src/renderer/src/App.vue` | Playback state, playlist, controls, visualization |
| `src/renderer/src/styles/App.css` | Visual system (CRT/retro styling) |
| `scripts/tauri-runner.cjs` | Robust Tauri command launcher |
| `scripts/vite-runner.cjs` | Robust Vite launcher |

## Coding Style

- Vue 3 Composition API in renderer.
- Rust commands in Tauri backend should be small and explicit.
- Keep renderer resilient to missing metadata and cover payloads.
- Avoid adding runtime dependencies unless justified.

## What Not To Do

- Do not reintroduce Electron-only APIs.
- Do not bypass runner scripts for build/dev commands.
- Do not block UI thread in visualization loops.
- Do not break keyboard interactions.

## Running

```bash
npm install
npm run dev
npm run build
```

## UX Priorities

- Fast feedback on user actions.
- Smooth visualizer animation and stable playback.
- Clean drag-and-drop behavior for files and playlist items.
- Predictable keyboard controls and status indicators.
