# DESIGN.md — RetroAmp Design Specification

## Design Goal

Create a focused retro desktop player that feels like a modern app with nostalgic DOS/CRT aesthetics.

## Visual Direction

- Primary theme: phosphor green on deep black.
- Accent colors: cyan (secondary signal), yellow (warnings/highlights), red (destructive actions).
- Typography: monospace (`Courier New`, `Lucida Console`, `Consolas`).
- Atmosphere: scanlines, subtle glow, high-contrast borders.

## Layout

1. Title bar with app identity and file/folder/m3u/settings actions.
2. Split main area:
- Left: playlist panel with reorder/remove interactions.
- Right: full-width spectrum visualizer and now-playing strip.
3. Bottom transport block:
- Seek row (time + progress)
- Playback controls and volume
- Status/utility row

## Interaction Model

### Mouse
- Single click track: select/play.
- Double click track: play immediate.
- Drag files from OS: append to playlist.
- Click seek bar/volume slider: precise control.
- Import/export M3U via top actions.

### Keyboard
- Space: play/pause
- Ctrl+Left/Right: previous/next
- Left/Right: seek +/- 5s
- Up/Down: volume
- M: mute

## Motion and Feedback

- Spectrum bars: quick rise, smooth fall.
- Peak markers: gravity-like decay.
- Pause behavior: graceful visual decay, no hard zeroing.
- Drag-over state: explicit full-screen overlay indicator.

## Accessibility/Usability Notes

- Keep text contrast high in all states.
- Ensure hit targets remain usable at minimum window size.
- Preserve key shortcuts independent of focus where safe.

## Future Design Extensions

- Theme presets (Amber CRT, Ice Terminal).
- Compact mode refinements.
- Album-art side card with VHS-like frame effect.
