# Architecture

## Processes

- Main process (`src/main/index.js`):
- Creates BrowserWindow
- Handles file/folder dialogs
- Scans folders recursively for audio files
- Controls window state (min/max/close)

- Preload (`src/preload/index.js`):
- Exposes `window.electronAPI`
- Wraps IPC calls and events

- Renderer (`src/renderer/src/*`):
- UI rendering and state management
- Audio playback and visualizer
- Playlist interactions and shortcuts

## Data Flow

1. User opens files/folder via title bar buttons.
2. Renderer calls preload API (`openFiles`, `openFolder`).
3. Main returns file paths.
4. Renderer builds track models and updates playlist.
5. Audio engine loads selected file URL and plays.
6. Spectrum reads `AnalyserNode` frequency bins each frame.

## Security Notes

- Renderer does not access Node APIs directly.
- IPC surface is intentionally minimal.
- Keep preload API explicit and narrow.
