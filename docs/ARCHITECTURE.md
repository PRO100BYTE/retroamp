# Architecture

## Runtime Components

- Tauri backend (`src-tauri/src/lib.rs`):
	- Native commands for dialogs, metadata, covers, M3U import/export, file URL conversion.
	- Rust-side filesystem and audio tag parsing.

- Renderer (`src/renderer/src/*`):
	- Vue UI, playback state, controls, drag-and-drop.
	- Web Audio API analyser + canvas visualizer.

- Bridge shim (`src/renderer/src/main.jsx`):
	- Maps renderer calls to `@tauri-apps/api/core` invokes.
	- Preserves `window.electronAPI` shape for migration compatibility.

## Data Flow

1. User opens files/folder via title bar buttons.
2. Renderer calls bridge API (`openFiles`, `openFolder`, etc.).
3. Bridge invokes native Tauri commands.
4. Backend returns file paths and metadata.
5. Renderer builds track models and starts playback via file URL.
6. Cover is loaded lazily per current track.
7. Spectrum reads `AnalyserNode` bins each animation frame.

## Security Notes

- Renderer does not access local filesystem directly.
- Native command surface is explicit and intentionally narrow.
- Keep command payloads small and serializable (especially playlist metadata arrays).

## Build Pipeline

- `npm run build:web` builds renderer assets to `dist/`.
- `npm run build` runs Tauri build and bundles Windows artifacts.
- Tauri config (`src-tauri/tauri.conf.json`) uses runner scripts to avoid PATH-related failures.
