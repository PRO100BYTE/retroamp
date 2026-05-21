# CLAUDE.md — Claude / Anthropic Agent Instructions for RetroAmp

Read this file before making changes.

## Project in One Sentence

RetroAmp is a retro-themed Windows desktop audio player with playlist management and spectrum visualization.

## Key Files

| File | Purpose |
|---|---|
| `src/main/index.js` | Electron window setup, IPC handlers, file/folder dialogs |
| `src/preload/index.js` | Safe API bridge from main process to renderer |
| `src/renderer/src/App.jsx` | Playback state, keyboard handling, drag-and-drop integration |
| `src/renderer/src/components/Spectrum.jsx` | Canvas-based frequency bars and peak animation |
| `src/renderer/src/components/Playlist.jsx` | Playlist display, selection, remove, reorder |
| `src/renderer/src/components/Controls.jsx` | Transport controls, seek, repeat/shuffle, volume |
| `src/renderer/src/styles/App.css` | Visual system (CRT/retro styling) |

## Coding Style

- React 18 with function components and hooks.
- Keep components focused and side effects isolated in `useEffect`.
- Avoid adding new runtime dependencies unless necessary.
- Keep renderer code resilient to missing metadata/duration.

## What Not To Do

- Do not disable context isolation.
- Do not expose unrestricted shell/Node APIs via preload.
- Do not block UI thread in render loops or drag handlers.
- Do not break keyboard navigation for accessibility.

## Running

```bash
npm install
npm run dev
npm run build
npm run dist:win
```

## UX Priorities

- Fast feedback on user actions.
- Smooth visualizer animation and stable playback.
- Clean drag-and-drop behavior for files and playlist items.
- Predictable keyboard controls and status indicators.
