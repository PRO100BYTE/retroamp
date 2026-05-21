import React, { useRef, useState, useCallback } from 'react'
import { fmtTime } from '../App'

export default function Playlist({
  tracks, currentIdx, playing,
  onSelect, onReorder, onRemove,
  onAddFiles, onAddFolder, t
}) {
  const [dragSrc, setDragSrc] = useState(-1)
  const [dragTarget, setDragTarget] = useState(-1)

  // ── Drag & drop reordering ────────────────────────────────────────────────
  const onDragStart = (e, idx) => {
    setDragSrc(idx)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(idx))
  }
  const onDragOver = (e, idx) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragTarget(idx)
  }
  const onDragLeave = () => setDragTarget(-1)
  const onDrop = (e, idx) => {
    e.preventDefault()
    e.stopPropagation() // Don't bubble to app-level drop
    setDragTarget(-1)
    if (dragSrc !== -1 && dragSrc !== idx) {
      onReorder(dragSrc, idx)
    }
    setDragSrc(-1)
  }
  const onDragEnd = () => { setDragSrc(-1); setDragTarget(-1) }

  // ── Context menu (right click) ────────────────────────────────────────────
  const onContextMenu = (e, idx) => {
    e.preventDefault()
    // Simple inline: just remove for now
    onRemove(idx)
  }

  return (
    <div className="playlist">
      <div className="playlist__header">
        <span className="playlist__title">
          {t('playlistTitle')} — {tracks.length} {t('tracks')}
        </span>
        <div className="playlist__actions">
          <button onClick={onAddFiles} title="Add files (Ctrl+O)">{t('addFile')}</button>
          <button onClick={onAddFolder} title="Add folder">{t('addDir')}</button>
        </div>
      </div>

      <div className="playlist__list">
        {tracks.length === 0 ? (
          <div className="playlist__empty">
            <div>╔══════════════════╗</div>
            <div>║  {t('noTracks')}   ║</div>
            <div>╚══════════════════╝</div>
            <div style={{ marginTop: 12 }}>
              {t('emptyHint')}
            </div>
          </div>
        ) : (
          tracks.map((track, idx) => {
            const isActive  = idx === currentIdx
            const isDragged = idx === dragSrc
            const isTarget  = idx === dragTarget && dragSrc !== -1

            return (
              <div
                key={track.id}
                className={[
                  'playlist__item',
                  isActive  ? 'playlist__item--active'  : '',
                  isDragged ? 'playlist__item--dragging' : '',
                  isTarget  ? 'playlist__item--droptgt'  : '',
                ].filter(Boolean).join(' ')}
                draggable
                onDragStart={e => onDragStart(e, idx)}
                onDragOver={e  => onDragOver(e, idx)}
                onDragLeave={onDragLeave}
                onDrop={e      => onDrop(e, idx)}
                onDragEnd={onDragEnd}
                onDoubleClick={() => onSelect(idx)}
                onClick={() => onSelect(idx)}
                onContextMenu={e => onContextMenu(e, idx)}
                title={`${track.name}\nDouble-click to play | Right-click to remove`}
              >
                <span className="playlist__item-ind">
                  {isActive && playing ? '▶' : isActive ? '‖' : ' '}
                </span>
                <span className="playlist__item-num">
                  {String(idx + 1).padStart(2, '0')}.
                </span>
                <span className="playlist__item-name">
                  {track.artist ? `${track.title} — ${track.artist}` : track.title}
                </span>
                <span className="playlist__item-dur">
                  {track.duration > 0 ? fmtTime(track.duration) : ''}
                </span>
                <button
                  className="playlist__item-del"
                  onClick={e => { e.stopPropagation(); onRemove(idx) }}
                  title="Remove"
                >✕</button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
