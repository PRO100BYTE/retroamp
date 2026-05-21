# RetroAmp

> Retro DOS-style music player for Windows — built with Electron + React

![RetroAmp screenshot placeholder](resources/screenshot.png)

## Features

- **Spectrum visualizer** — full Web Audio API analyser with peak indicators, logarithmic bin mapping and smooth decay on pause (ported from the NE-DOS terminal player)
- **Playlist management** — add individual files or entire folders recursively, reorder by drag & drop, remove tracks
- **Drag & drop** — drop audio files from Explorer directly onto the window
- **Keyboard shortcuts** — full transport control without touching the mouse
- **Retro CRT aesthetic** — Matrix-green phosphor palette, scanline overlay, monospace font

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

# Start in dev mode (hot reload)
npm run dev

# Package for Windows
npm run dist:win
```

## Tech Stack

- **Electron 29** — desktop shell
- **React 18** — UI
- **Web Audio API** — spectrum analyser
- **electron-vite** — build tooling
- **electron-builder** — packaging / NSIS installer

## Project Structure

```
src/
  main/       — Electron main process (window, IPC, file dialogs)
  preload/    — Context bridge (safe IPC exposure to renderer)
  renderer/
    src/
      App.jsx               — Root: state, audio engine, keyboard/DnD
      components/
        TitleBar.jsx        — Custom frameless titlebar
        Playlist.jsx        — Track list with DnD reorder
        Spectrum.jsx        — Canvas spectrum visualizer
        Controls.jsx        — Transport, seek, volume
      styles/App.css        — Global retro styles
```
