# AGENTS.md — AI Agent Instructions for RetroAmp

This file provides guidance for autonomous AI coding agents working on the RetroAmp codebase.

## Project Overview

RetroAmp is a Windows desktop music player built with Electron + React.
It includes a retro CRT-style UI, playlist management, drag-and-drop, and a real-time spectrum visualizer based on Web Audio API.

## Development Environment

```bash
npm install
npm run dev
npm run build
npm run dist:win
```

## Core Conventions

- Keep renderer process sandboxed through preload bridge (`contextIsolation: true`).
- Do not expose unrestricted Node APIs to renderer.
- File system access must go through IPC in `src/main/index.js` and `src/preload/index.js`.
- Keep visualizer logic performant: avoid heavy allocations in animation loops.
- Use CRLF-safe terminal text where applicable in docs and logs for Windows clarity.

## Where to Put Code

| What | Where |
|---|---|
| Electron app/window/IPC | `src/main/index.js` |
| Secure renderer API bridge | `src/preload/index.js` |
| App state and audio engine | `src/renderer/src/App.jsx` |
| Spectrum rendering | `src/renderer/src/components/Spectrum.jsx` |
| Playlist UI/behavior | `src/renderer/src/components/Playlist.jsx` |
| Controls transport/seek/volume | `src/renderer/src/components/Controls.jsx` |
| Styling and visual language | `src/renderer/src/styles/App.css` |

## Testing Checklist (Manual)

- Open files and open folder dialogs both work.
- Drag-and-drop from Explorer works for supported audio formats.
- Track reorder by drag-and-drop preserves currently playing track index.
- Playback controls work via mouse and keyboard shortcuts.
- Visualizer keeps full width and smooth decay when paused.
- Build and packaging succeed (`npm run dist:win`).

## Common Pitfalls

- Large folders can return thousands of files: keep folder scan async and resilient.
- Creating many `AudioContext` instances can break audio on some systems.
- In renderer, avoid direct `require('fs')`; use preload APIs.
- On Windows, file URLs must be encoded correctly (`file:///...`).

## Pull Request Notes

- Prefer small focused commits.
- Mention UI/UX impact for visual changes.
- Do not force-push without explicit approval.
