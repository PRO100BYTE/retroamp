import React, { useRef, useState, useCallback, useEffect } from 'react'
import { fmtTime } from '../App'

export default function Playlist({
  tracks, currentIdx, playing,
  onSelect, onReorder, onRemove,
  onAddFiles, onAddFolder, t
}) {
  const [dragSrc, setDragSrc] = useState(-1)
  const [dragTarget, setDragTarget] = useState(-1)
  const [menu, setMenu] = useState({ visible: false, x: 0, y: 0, idx: -1 })
  const menuRef = useRef(null)

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
    setMenu({ visible: true, x: e.clientX, y: e.clientY, idx })
  }

  useEffect(() => {
    const onDocClick = () => setMenu((m) => (m.visible ? { ...m, visible: false } : m))
    const onEsc = (e) => { if (e.key === 'Escape') setMenu((m) => ({ ...m, visible: false })) }
    window.addEventListener('click', onDocClick)
    window.addEventListener('keydown', onEsc)
    return () => {
      window.removeEventListener('click', onDocClick)
      window.removeEventListener('keydown', onEsc)
    }
  }, [])

  const runMenuAction = (action) => {
    const idx = menu.idx
    if (idx < 0 || idx >= tracks.length) return setMenu((m) => ({ ...m, visible: false }))
    if (action === 'play') onSelect(idx)
    if (action === 'remove') onRemove(idx)
    if (action === 'up' && idx > 0) onReorder(idx, idx - 1)
    if (action === 'down' && idx < tracks.length - 1) onReorder(idx, idx + 1)
    setMenu((m) => ({ ...m, visible: false }))
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

      {menu.visible && (
        <div
          ref={menuRef}
          className="playlist__ctx"
          style={{ left: `${menu.x}px`, top: `${menu.y}px` }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button className="menu-item" onClick={() => runMenuAction('play')}>{t('ctxPlay')}</button>
          <button className="menu-item" onClick={() => runMenuAction('remove')}>{t('ctxRemove')}</button>
          <button className="menu-item" onClick={() => runMenuAction('up')}>{t('ctxMoveUp')}</button>
          <button className="menu-item" onClick={() => runMenuAction('down')}>{t('ctxMoveDown')}</button>
        </div>
      )}
    </div>
  )
}
