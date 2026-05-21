import React, { useState, useRef, useEffect, useCallback } from 'react'
import TitleBar from './components/TitleBar'
import Playlist from './components/Playlist'
import Spectrum from './components/Spectrum'
import LargeCover from './components/LargeCover'
import Controls from './components/Controls'
import SettingsModal from './components/SettingsModal'
import AboutModal from './components/AboutModal'
import { LANG, makeT } from './i18n'
import { convertFileSrc } from '@tauri-apps/api/core'
import { Howl, Howler } from 'howler'

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
  showLargeCover: false,  // false = visualizer, true = large cover
}

function makeTrack(filePath, meta = {}) {
  const sep = filePath.includes('\\') ? '\\' : '/'
  const name = filePath.split(sep).pop() || filePath
  const parent = filePath.split(sep).slice(-2, -1)[0] || ''
  const title = meta.title || name
    .replace(/\.[^.]+$/, '')
    .replace(/^\d+[\s._-]+/, '')
    .replace(/[_]/g, ' ')
  const artist = typeof meta.artist === 'string' ? meta.artist.trim() : ''
  const album = typeof meta.album === 'string' && meta.album.trim() ? meta.album.trim() : parent
  return {
    id: ++_id,
    path: filePath,
    name,
    title,
    artist,
    album,
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

  const howlRef = useRef(null)
  const tickRef = useRef(null)
  const analyserRef = useRef(null)

  const stopTicker = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current)
      tickRef.current = null
    }
  }, [])

  const startTicker = useCallback(() => {
    stopTicker()
    tickRef.current = setInterval(() => {
      const howl = howlRef.current
      if (!howl) return
      const pos = Number(howl.seek()) || 0
      setCurrentTime(pos)
      const d = howl.duration() || 0
      if (d > 0) setDuration(d)
    }, 120)
  }, [stopTicker])

  const unloadCurrentHowl = useCallback(() => {
    const current = howlRef.current
    if (!current) return
    try {
      current.stop()
      current.unload()
    } catch {
      // no-op
    }
    howlRef.current = null
  }, [])

  const handleEnded = useCallback(() => {
    const tl = tracksRef.current
    const ci = currentIdxRef.current
    const rep = repeatRef.current
    const sh = shuffleRef.current
    if (rep === REPEAT.ONE && howlRef.current) {
      howlRef.current.seek(0)
      howlRef.current.play()
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
    Howler.autoUnlock = true

    let analyser = null
    let isConnected = false
    
    const initAnalyser = () => {
      try {
        const ctx = Howler.ctx
        const master = Howler.masterGain
        
        if (!ctx) {
          console.warn('[Spectrum] No AudioContext available yet')
          return
        }
        
        if (!master) {
          console.warn('[Spectrum] No master gain available')
          return
        }

        // Create analyser node
        analyser = ctx.createAnalyser()
        analyser.fftSize = 512  // 256 to 2048
        analyser.smoothingTimeConstant = 0.85
        analyser.minDecibels = -100
        analyser.maxDecibels = 0

        // Connect: masterGain -> analyser -> destination
        if (!isConnected) {
          master.connect(analyser)
          analyser.connect(ctx.destination)
          isConnected = true
          console.log('[Spectrum] Analyser connected successfully')
        }

        analyserRef.current = analyser
      } catch (err) {
        console.error('[Spectrum] Failed to initialize analyser:', err)
        analyserRef.current = null
      }
    }

    // Initialize immediately
    initAnalyser()
    
    // Retry in case AudioContext wasn't ready
    const retryTimeout = setTimeout(() => {
      if (!analyserRef.current) {
        console.log('[Spectrum] Retrying analyser init...')
        initAnalyser()
      }
    }, 500)

    return () => {
      clearTimeout(retryTimeout)
      stopTicker()
      unloadCurrentHowl()
      if (analyser) {
        try {
          analyser.disconnect()
        } catch {
          // no-op
        }
      }
      analyserRef.current = null
    }
  }, [stopTicker, unloadCurrentHowl])

  useEffect(() => {
    Howler.volume(muted ? 0 : volume)
    const howl = howlRef.current
    if (howl) {
      howl.volume(volume)
      howl.mute(muted)
    }
  }, [volume, muted])

  useEffect(() => {
    const track = tracks[currentIdx]
    if (!track || track.cover || !settings.showCover) return undefined

    let cancelled = false
    window.electronAPI.readCover(track.path)
      .then((cover) => {
        if (cancelled || !cover) return
        setTracks((prev) => prev.map((item) => item.id === track.id ? { ...item, cover } : item))
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [currentIdx, tracks, settings.showCover])

  const playAt = useCallback(async (idx, list) => {
    const tl = list ?? tracksRef.current
    const track = tl[idx]
    if (!track) return
    const fileUrl = convertFileSrc(track.path)
    if (!fileUrl) return

    stopTicker()
    unloadCurrentHowl()

    const buildAndPlay = (sourceUrl, isFallback) => {
      const howl = new Howl({
        src: [sourceUrl],
        html5: false,
        volume,
        mute: muted,
        onplay: () => {
          setPlaying(true)
          startTicker()
        },
        onpause: () => {
          setPlaying(false)
          stopTicker()
        },
        onstop: () => {
          setPlaying(false)
          setCurrentTime(0)
          stopTicker()
        },
        onend: () => {
          stopTicker()
          handleEnded()
        },
        onload: () => {
          const d = howl.duration() || 0
          setDuration(d)
          setTracks((prev) => {
            const copy = [...prev]
            if (copy[idx]) copy[idx] = { ...copy[idx], duration: d }
            return copy
          })
        },
        onplayerror: (_id, err) => {
          console.error(err)
        },
        onloaderror: async (_id, err) => {
          console.error(err)
          if (isFallback) return
          try {
            const dataUrl = await window.electronAPI.readAudioDataUrl(track.path)
            if (!dataUrl) return
            unloadCurrentHowl()
            buildAndPlay(dataUrl, true)
          } catch (fallbackError) {
            console.error(fallbackError)
          }
        },
      })

      howlRef.current = howl
      const ctx = Howler.ctx
      if (ctx && ctx.state === 'suspended') {
        void ctx.resume()
      }
      howl.play()
    }

    setCurrentIdx(idx)
    setCurrentTime(0)
    setDuration(0)

    buildAndPlay(fileUrl, false)
  }, [handleEnded, muted, startTicker, stopTicker, unloadCurrentHowl, volume])

  const togglePlay = useCallback(() => {
    const howl = howlRef.current
    if (!howl) {
      if (tracks.length === 0) return
      playAt(currentIdx >= 0 ? currentIdx : 0)
      return
    }
    if (playing) {
      howl.pause()
    } else {
      howl.play()
    }
  }, [currentIdx, playAt, playing, tracks.length])

  const playNext = useCallback(() => {
    const tl = tracksRef.current
    if (tl.length === 0) return
    const next = shuffleRef.current
      ? Math.floor(Math.random() * tl.length)
      : (currentIdxRef.current + 1) % tl.length
    playAt(next)
  }, [playAt])

  const playPrev = useCallback(() => {
    const howl = howlRef.current
    const tl = tracksRef.current
    if (tl.length === 0) return
    if (howl && Number(howl.seek()) > 3) {
      howl.seek(0)
      return
    }
    const prev = shuffleRef.current
      ? Math.floor(Math.random() * tl.length)
      : (currentIdxRef.current - 1 + tl.length) % tl.length
    playAt(prev)
  }, [playAt])

  const stop = useCallback(() => {
    const howl = howlRef.current
    if (!howl) return
    howl.stop()
    setCurrentTime(0)
  }, [])

  const seek = useCallback((ratio) => {
    const howl = howlRef.current
    if (howl && isFinite(duration) && duration > 0) {
      howl.seek(ratio * duration)
      setCurrentTime(ratio * duration)
    }
  }, [duration])

  const addPaths = useCallback(async (paths) => {
    const filtered = (paths || []).filter((p) => AUDIO_RE.test(p))
    if (!filtered.length) return
    let metadata = []
    try {
      metadata = await window.electronAPI.readTags(filtered)
    } catch {
      metadata = []
    }

    const needsPerFileFallback =
      metadata.length !== filtered.length ||
      metadata.every((item) => !item?.title && !item?.artist && !item?.album)

    if (needsPerFileFallback) {
      metadata = await Promise.all(filtered.map(async (filePath) => {
        try {
          const single = await window.electronAPI.readTags([filePath])
          return Array.isArray(single) && single[0] ? single[0] : { path: filePath }
        } catch {
          return { path: filePath }
        }
      }))
    }

    const metaMap = new Map(metadata.map((m) => [m.path, m]))
    const newTracks = filtered.map((p) => makeTrack(p, metaMap.get(p) || {}))

    setTracks((prev) => {
      const merged = [...prev, ...newTracks]
      if (prev.length === 0 && newTracks.length > 0 && settings.autoPlayOnAdd) {
        void playAt(0, merged)
      }
      return merged
    })
  }, [playAt, settings.autoPlayOnAdd])

  const clearPlaylist = useCallback(() => {
    stopTicker()
    unloadCurrentHowl()
    setTracks([])
    setCurrentIdx(-1)
    setPlaying(false)
    setCurrentTime(0)
    setDuration(0)
  }, [stopTicker, unloadCurrentHowl])

  const removeTrack = useCallback((idx) => {
    setTracks((prev) => {
      const arr = prev.filter((_, i) => i !== idx)
      setCurrentIdx((ci) => {
        if (ci === idx) {
          stopTicker()
          unloadCurrentHowl()
          if (arr.length === 0) return -1
          const ni = Math.min(idx, arr.length - 1)
          setTimeout(() => playAt(ni, arr), 0)
          return ni
        }
        return ci > idx ? ci - 1 : ci
      })
      return arr
    })
  }, [playAt, stopTicker, unloadCurrentHowl])

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

  const toggleLargeCover = useCallback(() => {
    setSettings((prev) => ({ ...prev, showLargeCover: !prev.showLargeCover }))
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
          else if (howlRef.current) {
            const next = Math.min(duration, currentTime + 5)
            howlRef.current.seek(next)
            setCurrentTime(next)
          }
          break
        case 'ArrowLeft':
          if (e.ctrlKey) { e.preventDefault(); playPrev() }
          else if (howlRef.current) {
            const prev = Math.max(0, currentTime - 5)
            howlRef.current.seek(prev)
            setCurrentTime(prev)
          }
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
  const currentArtist = currentTrack?.artist || t('unknownArtist')
  const currentAlbum = currentTrack?.album || t('unknownAlbum')
  const currentYear = currentTrack?.year ? String(currentTrack.year) : null

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
          {settings.showLargeCover ? (
            <LargeCover
              track={currentTrack}
              t={t}
              onContextMenu={onSpectrumContextMenu}
            />
          ) : (
            <Spectrum
              analyserRef={analyserRef}
              playing={playing}
              intensity={settings.vizIntensity}
              mode={settings.vizMode}
              onContextMenu={onSpectrumContextMenu}
            />
          )}

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
              {currentTrack ? (
                <div className="track-info__meta">
                  <span className="track-info__sub">{`${t('metaArtist')}: ${currentArtist}`}</span>
                  <span className="track-info__sub">{`${t('metaAlbum')}: ${currentAlbum}${currentYear ? ` (${currentYear})` : ''}`}</span>
                </div>
              ) : (
                <span className="track-info__sub">{t('dropHint')}</span>
              )}
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
          {!settings.showLargeCover && (
            <>
              {[
                ['bars',        'vizBars'],
                ['dots',        'vizDots'],
                ['mirror',      'vizMirror'],
                ['line',        'vizLine'],
                ['oscilloscope','vizOscilloscope'],
                ['flame',       'vizFlame'],
              ].map(([modeKey, i18nKey]) => (
                <button
                  key={modeKey}
                  className={settings.vizMode === modeKey ? 'menu-item menu-item--active' : 'menu-item'}
                  onClick={() => setVizMode(modeKey)}
                >
                  {t(i18nKey)}
                </button>
              ))}
              <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />
            </>
          )}
          <button
            className={settings.showLargeCover ? 'menu-item menu-item--active' : 'menu-item'}
            onClick={toggleLargeCover}
          >
            {settings.showLargeCover ? t('hideAlbumCover') : t('showAlbumCover')}
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
