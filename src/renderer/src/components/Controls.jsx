import React, { useCallback, useRef } from 'react'
import { fmtTime } from '../App'

const REPEAT_LABELS = { none: '⇄', all: '⇄∞', one: '⇂1' }
const REPEAT_TITLES = { none: 'Repeat: OFF', all: 'Repeat: ALL', one: 'Repeat: ONE' }

export default function Controls({
  playing, currentTime, duration, volume, muted,
  repeat, shuffle, hasTracks, trackCount, currentIdx,
  onTogglePlay, onNext, onPrev, onStop,
  onSeek, onVolume, onMute, onRepeat, onShuffle
}) {
  const seekRef = useRef(null)

  // ── Seek bar: click/drag ──────────────────────────────────────────────────
  const handleSeekClick = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    onSeek(ratio)
  }, [onSeek])

  const handleSeekChange = useCallback((e) => {
    onSeek(parseFloat(e.target.value))
  }, [onSeek])

  const pct = duration > 0 ? currentTime / duration : 0

  // Progress bar gradient trick
  const seekBg = `linear-gradient(to right, var(--green) 0%, var(--green) ${pct * 100}%, var(--border) ${pct * 100}%, var(--border) 100%)`
  const volBg  = `linear-gradient(to right, var(--cyan) 0%, var(--cyan) ${volume * 100}%, var(--border) ${volume * 100}%, var(--border) 100%)`

  return (
    <div className="controls">

      {/* Row 1: seek bar */}
      <div className="controls__seekrow">
        <span className="controls__time">{fmtTime(currentTime)}</span>
        <input
          ref={seekRef}
          type="range"
          className="controls__seek"
          min={0} max={1} step={0.0001}
          value={pct}
          style={{ background: seekBg }}
          onChange={handleSeekChange}
          onMouseDown={e => e.stopPropagation()}
        />
        <span className="controls__time controls__time--right">{fmtTime(duration)}</span>
      </div>

      {/* Row 2: transport + volume */}
      <div className="controls__row">
        {/* Transport */}
        <div className="controls__transport">
          <button className="ctrl" onClick={onPrev}     title="Previous (Ctrl+←)">|◄◄</button>
          <button
            className={`ctrl ctrl--play${playing ? ' ctrl--active' : ''}`}
            onClick={onTogglePlay}
            title="Play/Pause (Space)"
          >
            {playing ? '‖‖' : ' ▶ '}
          </button>
          <button className="ctrl" onClick={onStop}     title="Stop (Ctrl+S)">■</button>
          <button className="ctrl" onClick={onNext}     title="Next (Ctrl+→)">▶▶|</button>
        </div>

        {/* Mode buttons */}
        <div className="controls__modes">
          <button
            className={`ctrl ctrl--mode${shuffle ? ' ctrl--active' : ''}`}
            onClick={onShuffle}
            title={shuffle ? 'Shuffle: ON' : 'Shuffle: OFF'}
          >RND</button>
          <button
            className={`ctrl ctrl--mode${repeat !== 'none' ? ' ctrl--active' : ''}`}
            onClick={onRepeat}
            title={REPEAT_TITLES[repeat]}
          >{REPEAT_LABELS[repeat]}</button>
        </div>

        {/* Spacer */}
        <div className="controls__spacer" />

        {/* Volume */}
        <div className="controls__vol">
          <button
            className={`ctrl ctrl--icon${muted ? ' ctrl--muted' : ''}`}
            onClick={onMute}
            title="Mute (M)"
          >{muted ? '🔇' : '🔊'}</button>
          <input
            type="range"
            className="controls__volbar"
            min={0} max={1} step={0.01}
            value={muted ? 0 : volume}
            style={{ background: volBg }}
            onChange={e => onVolume(parseFloat(e.target.value))}
            title={`Volume: ${Math.round(volume * 100)}%`}
          />
          <span className="controls__volpct">{Math.round(volume * 100)}%</span>
        </div>
      </div>

      {/* Row 3: status */}
      <div className="controls__status">
        <span className="controls__status-text">
          {hasTracks
            ? `[${String(currentIdx + 1).padStart(2, '0')}/${String(trackCount).padStart(2, '0')}]  ` +
              (playing ? ' ♪ PLAYING' : ' ■ STOPPED') +
              `  ${repeat !== 'none' ? `RPT:${REPEAT_LABELS[repeat]} ` : ''}` +
              `${shuffle ? ' SHF' : ''}`
            : 'Drop files or use [FILE] / [FOLDER] to load tracks. Space=play  ←→=seek  ↑↓=vol  M=mute'
          }
        </span>
        <span className="controls__shortcuts">
          Space=play  Ctrl+←/→=prev/next  ↑↓=vol  M=mute
        </span>
      </div>

    </div>
  )
}
