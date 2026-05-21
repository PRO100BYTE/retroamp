import React, { useState, useRef, useEffect, useCallback } from 'react'
import TitleBar from './components/TitleBar'
import Playlist from './components/Playlist'
import Spectrum from './components/Spectrum'
import Controls from './components/Controls'
import SettingsModal from './components/SettingsModal'
import AboutModal from './components/AboutModal'
import { LANG, makeT } from './i18n'

let _id = 0

const REPEAT = { NONE: 'none', ALL: 'all', ONE: 'one' }
const AUDIO_RE = /\.(mp3|flac|ogg|wav|aac|m4a|opus|wma)$/i
const SETTINGS_KEY = 'retroamp:settings:v1'
const DEFAULT_SETTINGS = {
  theme: 'matrix',
  language: LANG.RU,
  showCover: true,
  autoPlayOnAdd: true,
  compactMode: false,
  vizIntensity: 1,
  vizMode: 'bars',
}

function makeTrack(filePath, meta = {}) {
  const sep = filePath.includes('\\') ? '\\' : '/'
  const name = filePath.split(sep).pop() || filePath
  const title = meta.title || name
    .replace(/\.[^.]+$/, '')
    .replace(/^\d+[\s._-]+/, '')
    .replace(/[_]/g, ' ')
  return {
    id: ++_id,
    path: filePath,
    name,
    title,
    artist: meta.artist || '',
    album: meta.album || '',
    year: meta.year || '',
    cover: meta.cover || null,
    duration: Number.isFinite(meta.duration) ? meta.duration : 0,
  }
}

function loadSettings() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function fmtTime(sec) {
  if (!isFinite(sec) || sec < 0) return '--:--'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function App() {
  const [tracks, setTracks] = useState([])
  const [currentIdx, setCurrentIdx] = useState(-1)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [muted, setMuted] = useState(false)
  const [repeat, setRepeat] = useState(REPEAT.NONE)
  const [shuffle, setShuffle] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [vizMenu, setVizMenu] = useState({ visible: false, x: 0, y: 0 })
  const [settings, setSettings] = useState(loadSettings)
  const t = makeT(settings.language)

  useEffect(() => {
    document.documentElement.lang = settings.language
  }, [settings.language])

  const tracksRef = useRef(tracks)
  const currentIdxRef = useRef(currentIdx)
  const repeatRef = useRef(repeat)
  const shuffleRef = useRef(shuffle)
  useEffect(() => { tracksRef.current = tracks }, [tracks])
  useEffect(() => { currentIdxRef.current = currentIdx }, [currentIdx])
  useEffect(() => { repeatRef.current = repeat }, [repeat])
  useEffect(() => { shuffleRef.current = shuffle }, [shuffle])

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    window.electronAPI.setCompactMode?.(!!settings.compactMode)
  }, [settings.compactMode])

  useEffect(() => {
    const close = () => setVizMenu((m) => ({ ...m, visible: false }))
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [])

  const audioRef = useRef(null)
  const ctxRef = useRef(null)
  const analyserRef = useRef(null)

  const handleEnded = useCallback(() => {
    const tl = tracksRef.current
    const ci = currentIdxRef.current
    const rep = repeatRef.current
    const sh = shuffleRef.current
    if (rep === REPEAT.ONE && audioRef.current) {
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(() => {})
      return
    }
    let next
    if (sh) {
      next = Math.floor(Math.random() * tl.length)
    } else {
      next = ci + 1
      if (next >= tl.length) {
        if (rep === REPEAT.ALL) next = 0
        else { setPlaying(false); return }
      }
    }
    if (next >= 0 && tl[next]) playAt(next)
  }, [])

  useEffect(() => {
    const audio = new Audio()
    audioRef.current = audio
    audio.volume = volume

    const Ctor = window.AudioContext || window.webkitAudioContext
    const ctx = new Ctor()
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 1024
    analyser.smoothingTimeConstant = 0.8
    const src = ctx.createMediaElementSource(audio)
    src.connect(analyser)
    analyser.connect(ctx.destination)
    ctxRef.current = ctx
    analyserRef.current = analyser

    const onTime = () => setCurrentTime(audio.currentTime)
    const onMeta = () => setDuration(audio.duration)
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnded = () => handleEnded()

    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)

    audio.addEventListener('loadedmetadata', () => {
      const idx = currentIdxRef.current
      if (idx < 0) return
      setTracks((prev) => {
        const copy = [...prev]
        if (copy[idx]) copy[idx] = { ...copy[idx], duration: audio.duration }
        return copy
      })
    })

    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
      audio.pause()
      ctx.close()
    }
  }, [handleEnded])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
      audioRef.current.muted = muted
    }
  }, [volume, muted])

  const playAt = useCallback(async (idx, list) => {
    const tl = list ?? tracksRef.current
    const track = tl[idx]
    if (!track) return
    const audio = audioRef.current
    if (!audio) return
    if (ctxRef.current?.state === 'suspended') ctxRef.current.resume()

    const fileUrl = await window.electronAPI.toFileUrl(track.path)
    if (!fileUrl) return

    audio.src = fileUrl
    audio.load()
    audio.play().catch(console.error)
    setCurrentIdx(idx)
    setCurrentTime(0)
    setDuration(0)
  }, [])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (ctxRef.current?.state === 'suspended') ctxRef.current.resume()
    if (playing) {
      audio.pause()
    } else {
      if (tracks.length === 0) return
      if (!audio.src) { playAt(0); return }
      audio.play().catch(console.error)
    }
  }, [playing, tracks.length, playAt])

  const playNext = useCallback(() => {
    const tl = tracksRef.current
    if (tl.length === 0) return
    const next = shuffleRef.current
      ? Math.floor(Math.random() * tl.length)
      : (currentIdxRef.current + 1) % tl.length
    playAt(next)
  }, [playAt])

  const playPrev = useCallback(() => {
    const audio = audioRef.current
    const tl = tracksRef.current
    if (tl.length === 0) return
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0
      return
    }
    const prev = shuffleRef.current
      ? Math.floor(Math.random() * tl.length)
      : (currentIdxRef.current - 1 + tl.length) % tl.length
    playAt(prev)
  }, [playAt])

  const stop = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    audio.currentTime = 0
  }, [])

  const seek = useCallback((ratio) => {
    const audio = audioRef.current
    if (audio && isFinite(audio.duration)) {
      audio.currentTime = ratio * audio.duration
    }
  }, [])

  const addPaths = useCallback(async (paths) => {
    const filtered = (paths || []).filter((p) => AUDIO_RE.test(p))
    if (!filtered.length) return
    let metadata = []
    try {
      metadata = await window.electronAPI.readTags(filtered)
    } catch {
      metadata = []
    }
    const metaMap = new Map(metadata.map((m) => [m.path, m]))
    const newTracks = filtered.map((p) => makeTrack(p, metaMap.get(p) || {}))

    setTracks((prev) => {
      const merged = [...prev, ...newTracks]
      if (prev.length === 0 && newTracks.length > 0 && settings.autoPlayOnAdd) {
        setTimeout(() => playAt(0, merged), 50)
      }
      return merged
    })
  }, [playAt, settings.autoPlayOnAdd])

  const clearPlaylist = useCallback(() => {
    audioRef.current?.pause()
    setTracks([])
    setCurrentIdx(-1)
    setPlaying(false)
    setCurrentTime(0)
    setDuration(0)
  }, [])

  const removeTrack = useCallback((idx) => {
    setTracks((prev) => {
      const arr = prev.filter((_, i) => i !== idx)
      setCurrentIdx((ci) => {
        if (ci === idx) {
          audioRef.current?.pause()
          if (arr.length === 0) return -1
          const ni = Math.min(idx, arr.length - 1)
          setTimeout(() => playAt(ni, arr), 0)
          return ni
        }
        return ci > idx ? ci - 1 : ci
      })
      return arr
    })
  }, [playAt])

  const reorderTracks = useCallback((fromIdx, toIdx) => {
    if (fromIdx === toIdx) return
    setTracks((prev) => {
      const arr = [...prev]
      const [moved] = arr.splice(fromIdx, 1)
      arr.splice(toIdx, 0, moved)
      setCurrentIdx((ci) => {
        if (ci === fromIdx) return toIdx
        if (fromIdx < ci && ci <= toIdx) return ci - 1
        if (toIdx <= ci && ci < fromIdx) return ci + 1
        return ci
      })
      return arr
    })
  }, [])

  const handleOpenFiles = useCallback(async () => {
    const paths = await window.electronAPI.openFiles()
    if (paths.length) addPaths(paths)
  }, [addPaths])

  const handleOpenFolder = useCallback(async () => {
    const paths = await window.electronAPI.openFolder()
    if (paths.length) addPaths(paths)
  }, [addPaths])

  const handleImportM3U = useCallback(async () => {
    const paths = await window.electronAPI.importM3U()
    if (paths.length) addPaths(paths)
  }, [addPaths])

  const handleExportM3U = useCallback(async () => {
    if (!tracksRef.current.length) return
    await window.electronAPI.exportM3U({ tracks: tracksRef.current })
  }, [])

  const onDragOver = (e) => { e.preventDefault(); setDragOver(true) }
  const onDragLeave = (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false) }
  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    const paths = []
    for (const file of e.dataTransfer.files) {
      if (file.path && AUDIO_RE.test(file.path)) paths.push(file.path)
    }
    if (paths.length) addPaths(paths)
  }, [addPaths])

  const onSpectrumContextMenu = useCallback((e) => {
    e.preventDefault()
    setVizMenu({ visible: true, x: e.clientX, y: e.clientY })
  }, [])

  const setVizMode = useCallback((mode) => {
    setSettings((prev) => ({ ...prev, vizMode: mode }))
    setVizMenu((m) => ({ ...m, visible: false }))
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return
      switch (e.code) {
        case 'Space':
          e.preventDefault(); togglePlay(); break
        case 'ArrowRight':
          if (e.ctrlKey) { e.preventDefault(); playNext() }
          else if (audioRef.current) audioRef.current.currentTime = Math.min(duration, currentTime + 5)
          break
        case 'ArrowLeft':
          if (e.ctrlKey) { e.preventDefault(); playPrev() }
          else if (audioRef.current) audioRef.current.currentTime = Math.max(0, currentTime - 5)
          break
        case 'ArrowUp':
          e.preventDefault(); setVolume((v) => Math.min(1, parseFloat((v + 0.05).toFixed(2)))); break
        case 'ArrowDown':
          e.preventDefault(); setVolume((v) => Math.max(0, parseFloat((v - 0.05).toFixed(2)))); break
        case 'KeyM':
          setMuted((m) => !m); break
        case 'KeyS':
          if (e.ctrlKey) { e.preventDefault(); stop() }
          break
        case 'Comma':
          if (e.ctrlKey) { e.preventDefault(); setShowSettings(true) }
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePlay, playNext, playPrev, stop, currentTime, duration])

  const currentTrack = tracks[currentIdx] ?? null

  return (
    <div
      className={`app theme-${settings.theme}${settings.compactMode ? ' app--compact' : ''}${dragOver ? ' app--dragover' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <TitleBar
        track={currentTrack}
        t={t}
        onOpenFiles={handleOpenFiles}
        onOpenFolder={handleOpenFolder}
        onImportM3U={handleImportM3U}
        onExportM3U={handleExportM3U}
        onOpenSettings={() => setShowSettings(true)}
        onToggleCompact={() => setSettings((prev) => ({ ...prev, compactMode: !prev.compactMode }))}
        compactMode={!!settings.compactMode}
        onOpenAbout={() => setShowAbout(true)}
        onClear={clearPlaylist}
      />

      <div className="main-area">
        <Playlist
          tracks={tracks}
          t={t}
          currentIdx={currentIdx}
          playing={playing}
          onSelect={playAt}
          onReorder={reorderTracks}
          onRemove={removeTrack}
          onAddFiles={handleOpenFiles}
          onAddFolder={handleOpenFolder}
        />

        <div className="right-panel">
          <Spectrum
            analyserRef={analyserRef}
            playing={playing}
            intensity={settings.vizIntensity}
            mode={settings.vizMode}
            onContextMenu={onSpectrumContextMenu}
          />

          <div className="track-meta">
            {settings.showCover && (
              <div className="track-meta__cover-wrap">
                {currentTrack?.cover ? (
                  <img src={currentTrack.cover} alt="Album cover" className="track-meta__cover" />
                ) : (
                  <div className="track-meta__cover track-meta__cover--fallback">{t('noCover')}</div>
                )}
              </div>
            )}

            <div className="track-info">
              <span className="track-info__label">{t('nowPlaying')}</span>
              <span className="track-info__title">
                {currentTrack ? currentTrack.title : t('noTrackLoaded')}
              </span>
              <span className="track-info__sub">
                {currentTrack
                  ? `${currentTrack.artist || t('unknownArtist')}${currentTrack.album ? ` • ${currentTrack.album}` : ''}${currentTrack.year ? ` (${currentTrack.year})` : ''}`
                  : t('dropHint')}
              </span>
            </div>
          </div>
        </div>
      </div>

      <Controls
        playing={playing}
        currentTime={currentTime}
        duration={duration}
        volume={volume}
        muted={muted}
        repeat={repeat}
        t={t}
        shuffle={shuffle}
        hasTracks={tracks.length > 0}
        trackCount={tracks.length}
        currentIdx={currentIdx}
        onTogglePlay={togglePlay}
        onNext={playNext}
        onPrev={playPrev}
        onStop={stop}
        onSeek={seek}
        onVolume={setVolume}
        onMute={() => setMuted((m) => !m)}
        onRepeat={() => setRepeat((r) => (r === REPEAT.NONE ? REPEAT.ALL : r === REPEAT.ALL ? REPEAT.ONE : REPEAT.NONE))}
        onShuffle={() => setShuffle((s) => !s)}
      />

      {dragOver && (
        <div className="drop-overlay">
          <div className="drop-overlay__inner">{t('dropOverlay')}</div>
        </div>
      )}

      {vizMenu.visible && (
        <div
          className="playlist__ctx viz__ctx"
          style={{ left: `${vizMenu.x}px`, top: `${vizMenu.y}px` }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="viz__ctx-title">{t('vizMenuTitle')}</div>
          <button
            className={settings.vizMode === 'bars' ? 'menu-item menu-item--active' : 'menu-item'}
            onClick={() => setVizMode('bars')}
          >
            {t('vizBars')}
          </button>
          <button
            className={settings.vizMode === 'dots' ? 'menu-item menu-item--active' : 'menu-item'}
            onClick={() => setVizMode('dots')}
          >
            {t('vizDots')}
          </button>
          <button
            className={settings.vizMode === 'mirror' ? 'menu-item menu-item--active' : 'menu-item'}
            onClick={() => setVizMode('mirror')}
          >
            {t('vizMirror')}
          </button>
        </div>
      )}

      {showSettings && (
        <SettingsModal
          settings={settings}
          t={t}
          onChange={setSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showAbout && (
        <AboutModal
          t={t}
          onClose={() => setShowAbout(false)}
        />
      )}
    </div>
  )
}
