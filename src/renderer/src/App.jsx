import React, {
  useState, useRef, useEffect, useCallback, useReducer
} from 'react'
import TitleBar   from './components/TitleBar'
import Playlist   from './components/Playlist'
import Spectrum   from './components/Spectrum'
import Controls   from './components/Controls'

// ── Track factory ─────────────────────────────────────────────────────────────
let _id = 0
function makeTrack(filePath) {
  const sep   = filePath.includes('\\') ? '\\' : '/'
  const name  = filePath.split(sep).pop()
  const title = name.replace(/\.[^.]+$/, '')
                    .replace(/^\d+[\s._-]+/, '')   // strip leading track number
                    .replace(/[_]/g, ' ')
  return { id: ++_id, path: filePath, name, title, duration: 0 }
}

// ── Repeat modes ──────────────────────────────────────────────────────────────
const REPEAT = { NONE: 'none', ALL: 'all', ONE: 'one' }

// ── FORMAT helper ─────────────────────────────────────────────────────────────
export function fmtTime(sec) {
  if (!isFinite(sec) || sec < 0) return '--:--'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ── AUDIO_EXTS regex ──────────────────────────────────────────────────────────
const AUDIO_RE = /\.(mp3|flac|ogg|wav|aac|m4a|opus|wma)$/i

// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [tracks,     setTracks]     = useState([])
  const [currentIdx, setCurrentIdx] = useState(-1)
  const [playing,    setPlaying]    = useState(false)
  const [currentTime,setCurrentTime]= useState(0)
  const [duration,   setDuration]   = useState(0)
  const [volume,     setVolume]     = useState(0.8)
  const [muted,      setMuted]      = useState(false)
  const [repeat,     setRepeat]     = useState(REPEAT.NONE)
  const [shuffle,    setShuffle]    = useState(false)
  const [dragOver,   setDragOver]   = useState(false)

  // Mutable refs for callbacks not to go stale
  const tracksRef     = useRef(tracks)
  const currentIdxRef = useRef(currentIdx)
  const repeatRef     = useRef(repeat)
  const shuffleRef    = useRef(shuffle)
  useEffect(() => { tracksRef.current     = tracks     }, [tracks])
  useEffect(() => { currentIdxRef.current = currentIdx }, [currentIdx])
  useEffect(() => { repeatRef.current     = repeat     }, [repeat])
  useEffect(() => { shuffleRef.current    = shuffle    }, [shuffle])

  // Audio refs
  const audioRef    = useRef(null)
  const ctxRef      = useRef(null)
  const analyserRef = useRef(null)

  // ── Init audio engine ───────────────────────────────────────────────────────
  useEffect(() => {
    const audio = new Audio()
    audioRef.current = audio
    audio.volume = volume

    const ctx      = new AudioContext()
    const analyser = ctx.createAnalyser()
    analyser.fftSize              = 1024
    analyser.smoothingTimeConstant = 0.8
    const src = ctx.createMediaElementSource(audio)
    src.connect(analyser)
    analyser.connect(ctx.destination)
    ctxRef.current      = ctx
    analyserRef.current = analyser

    const onTime     = () => setCurrentTime(audio.currentTime)
    const onMeta     = () => setDuration(audio.duration)
    const onPlay     = () => setPlaying(true)
    const onPause    = () => setPlaying(false)
    const onEnded    = () => handleEnded()

    audio.addEventListener('timeupdate',     onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('play',           onPlay)
    audio.addEventListener('pause',          onPause)
    audio.addEventListener('ended',          onEnded)

    // Update track durations when metadata loads
    audio.addEventListener('loadedmetadata', () => {
      const idx = currentIdxRef.current
      if (idx < 0) return
      setTracks(prev => {
        const copy = [...prev]
        if (copy[idx]) copy[idx] = { ...copy[idx], duration: audio.duration }
        return copy
      })
    })

    return () => {
      audio.removeEventListener('timeupdate',     onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('play',           onPlay)
      audio.removeEventListener('pause',          onPause)
      audio.removeEventListener('ended',          onEnded)
      audio.pause()
      ctx.close()
    }
  }, []) // eslint-disable-line

  // Sync volume/mute
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
      audioRef.current.muted  = muted
    }
  }, [volume, muted])

  // ── Playback helpers ─────────────────────────────────────────────────────────
  const playAt = useCallback((idx, list) => {
    const tl    = list ?? tracksRef.current
    const track = tl[idx]
    if (!track) return
    const audio = audioRef.current
    if (!audio) return
    if (ctxRef.current?.state === 'suspended') ctxRef.current.resume()
    // Convert Windows backslashes, encode spaces/special chars
    const url = 'file:///' + track.path.replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/')
    audio.src = url
    audio.load()
    audio.play().catch(console.error)
    setCurrentIdx(idx)
    setCurrentTime(0)
    setDuration(0)
  }, [])

  const handleEnded = useCallback(() => {
    const tl  = tracksRef.current
    const ci  = currentIdxRef.current
    const rep = repeatRef.current
    const sh  = shuffleRef.current
    if (rep === REPEAT.ONE) {
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
    playAt(next)
  }, [playAt])

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
    const tl    = tracksRef.current
    if (tl.length === 0) return
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0; return
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

  // ── Track management ─────────────────────────────────────────────────────────
  const addPaths = useCallback((paths) => {
    const newTracks = paths.map(makeTrack)
    setTracks(prev => {
      const merged = [...prev, ...newTracks]
      if (prev.length === 0 && newTracks.length > 0) {
        // Auto-play first track after state updates
        setTimeout(() => playAt(0, merged), 50)
      }
      return merged
    })
  }, [playAt])

  const clearPlaylist = useCallback(() => {
    audioRef.current?.pause()
    setTracks([])
    setCurrentIdx(-1)
    setPlaying(false)
    setCurrentTime(0)
    setDuration(0)
  }, [])

  const removeTrack = useCallback((idx) => {
    setTracks(prev => {
      const arr = prev.filter((_, i) => i !== idx)
      setCurrentIdx(ci => {
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
    setTracks(prev => {
      const arr = [...prev]
      const [moved] = arr.splice(fromIdx, 1)
      arr.splice(toIdx, 0, moved)
      setCurrentIdx(ci => {
        if (ci === fromIdx) return toIdx
        if (fromIdx < ci && ci <= toIdx) return ci - 1
        if (toIdx <= ci && ci < fromIdx) return ci + 1
        return ci
      })
      return arr
    })
  }, [])

  // ── File open handlers ───────────────────────────────────────────────────────
  const handleOpenFiles = useCallback(async () => {
    const paths = await window.electronAPI.openFiles()
    if (paths.length) addPaths(paths)
  }, [addPaths])

  const handleOpenFolder = useCallback(async () => {
    const paths = await window.electronAPI.openFolder()
    if (paths.length) addPaths(paths)
  }, [addPaths])

  // ── Drag & drop ───────────────────────────────────────────────────────────────
  const onDragOver  = (e) => { e.preventDefault(); setDragOver(true)  }
  const onDragLeave = (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false) }
  const onDrop      = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    const paths = []
    for (const file of e.dataTransfer.files) {
      if (file.path && AUDIO_RE.test(file.path)) paths.push(file.path)
    }
    if (paths.length) addPaths(paths)
  }, [addPaths])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      // Don't intercept when typing in an input element
      if (e.target.tagName === 'INPUT') return
      switch (e.code) {
        case 'Space':
          e.preventDefault()
          togglePlay()
          break
        case 'ArrowRight':
          if (e.ctrlKey) { e.preventDefault(); playNext() }
          else if (audioRef.current) audioRef.current.currentTime = Math.min(duration, currentTime + 5)
          break
        case 'ArrowLeft':
          if (e.ctrlKey) { e.preventDefault(); playPrev() }
          else if (audioRef.current) audioRef.current.currentTime = Math.max(0, currentTime - 5)
          break
        case 'ArrowUp':
          e.preventDefault()
          setVolume(v => Math.min(1, parseFloat((v + 0.05).toFixed(2))))
          break
        case 'ArrowDown':
          e.preventDefault()
          setVolume(v => Math.max(0, parseFloat((v - 0.05).toFixed(2))))
          break
        case 'KeyM':
          setMuted(m => !m)
          break
        case 'KeyS':
          if (e.ctrlKey) { e.preventDefault(); stop() }
          break
        default: break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePlay, playNext, playPrev, stop, currentTime, duration])

  // ── Render ─────────────────────────────────────────────────────────────────
  const currentTrack = tracks[currentIdx] ?? null

  return (
    <div
      className={`app${dragOver ? ' app--dragover' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <TitleBar
        track={currentTrack}
        onOpenFiles={handleOpenFiles}
        onOpenFolder={handleOpenFolder}
        onClear={clearPlaylist}
      />

      <div className="main-area">
        <Playlist
          tracks={tracks}
          currentIdx={currentIdx}
          playing={playing}
          onSelect={playAt}
          onReorder={reorderTracks}
          onRemove={removeTrack}
          onAddFiles={handleOpenFiles}
          onAddFolder={handleOpenFolder}
        />

        <div className="right-panel">
          <Spectrum analyserRef={analyserRef} playing={playing} />
          <div className="track-info">
            <span className="track-info__label">NOW PLAYING</span>
            <span className="track-info__title">
              {currentTrack ? currentTrack.title : '─ no track loaded ─'}
            </span>
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
        onMute={() => setMuted(m => !m)}
        onRepeat={() => setRepeat(r =>
          r === REPEAT.NONE ? REPEAT.ALL :
          r === REPEAT.ALL  ? REPEAT.ONE : REPEAT.NONE
        )}
        onShuffle={() => setShuffle(s => !s)}
      />

      {dragOver && (
        <div className="drop-overlay">
          <div className="drop-overlay__inner">
            ▼ DROP AUDIO FILES HERE ▼
          </div>
        </div>
      )}
    </div>
  )
}
