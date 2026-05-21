<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const AUDIO_RE = /\.(mp3|flac|ogg|wav|aac|m4a|opus|wma)$/i
const SETTINGS_KEY = 'retroamp:settings:v1'
const DEFAULT_SETTINGS = {
  compactMode: false,
  showCover: true,
  autoPlayOnAdd: true,
  vizIntensity: 1,
}
let nextId = 1

const tracks = ref([])
const currentIdx = ref(-1)
const playing = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const volume = ref(0.8)
const muted = ref(false)
const settings = ref(loadSettings())
const showSettings = ref(false)
const dragOver = ref(false)
const compact = computed(() => !!settings.value.compactMode)

const canvasRef = ref(null)
let rafId = null
let audio = null
let audioCtx = null
let analyser = null
let sourceNode = null

const currentTrack = computed(() => tracks.value[currentIdx.value] ?? null)

function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function fmtTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '--:--'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function fileNameFromPath(filePath) {
  const sep = filePath.includes('\\') ? '\\' : '/'
  return filePath.split(sep).pop() || filePath
}

function parentNameFromPath(filePath) {
  const sep = filePath.includes('\\') ? '\\' : '/'
  const chunks = filePath.split(sep)
  return chunks.length > 1 ? (chunks[chunks.length - 2] || '') : ''
}

function makeTrack(filePath, meta = {}) {
  const name = fileNameFromPath(filePath)
  const title = (meta.title || name)
    .replace(/\.[^.]+$/, '')
    .replace(/^\d+[\s._-]+/, '')
    .replace(/[_]/g, ' ')
  const artist = typeof meta.artist === 'string' ? meta.artist.trim() : ''
  const album = typeof meta.album === 'string' && meta.album.trim() ? meta.album.trim() : parentNameFromPath(filePath)

  return {
    id: nextId++,
    path: filePath,
    name,
    title,
    artist,
    album,
    year: meta.year || '',
    duration: Number.isFinite(meta.duration) ? meta.duration : 0,
    cover: meta.cover || null,
  }
}

async function loadCoverForTrack(track) {
  if (!track || track.cover || !settings.value.showCover) return
  try {
    const cover = await window.electronAPI.readCover(track.path)
    if (!cover) return
    tracks.value = tracks.value.map((item) => (item.id === track.id ? { ...item, cover } : item))
  } catch {
    // ignore cover read errors
  }
}

async function addPaths(paths) {
  const filtered = (paths || []).filter((item) => AUDIO_RE.test(item))
  if (!filtered.length) return

  let metadata = []
  try {
    metadata = await window.electronAPI.readTags(filtered)
  } catch {
    metadata = []
  }

  const brokenBatch =
    metadata.length !== filtered.length ||
    metadata.every((item) => !item?.title && !item?.artist && !item?.album)

  if (brokenBatch) {
    metadata = await Promise.all(
      filtered.map(async (filePath) => {
        try {
          const single = await window.electronAPI.readTags([filePath])
          return Array.isArray(single) && single[0] ? single[0] : { path: filePath }
        } catch {
          return { path: filePath }
        }
      })
    )
  }

  const map = new Map(metadata.map((item) => [item.path, item]))
  const appended = filtered.map((filePath) => makeTrack(filePath, map.get(filePath) || {}))
  const wasEmpty = tracks.value.length === 0
  tracks.value = [...tracks.value, ...appended]

  if (wasEmpty && appended.length > 0 && settings.value.autoPlayOnAdd) {
    await playAt(0)
  }
}

async function importM3U() {
  const paths = await window.electronAPI.importM3U()
  await addPaths(paths)
}

async function exportM3U() {
  await window.electronAPI.exportM3U(tracks.value)
}

function openSettings() {
  showSettings.value = true
}

function closeSettings() {
  showSettings.value = false
}

async function openFiles() {
  const paths = await window.electronAPI.openFiles()
  await addPaths(paths)
}

async function openFolder() {
  const paths = await window.electronAPI.openFolder()
  await addPaths(paths)
}

async function playAt(idx) {
  const track = tracks.value[idx]
  if (!track || !audio) return
  if (audioCtx && audioCtx.state === 'suspended') await audioCtx.resume()

  const fileUrl = await window.electronAPI.toFileUrl(track.path)
  if (!fileUrl) return

  audio.src = fileUrl
  audio.load()
  await audio.play().catch(() => {})
  currentIdx.value = idx
  currentTime.value = 0
  duration.value = 0
  loadCoverForTrack(track)
}

function togglePlay() {
  if (!audio) return
  if (playing.value) {
    audio.pause()
    return
  }
  if (currentIdx.value < 0 && tracks.value.length > 0) {
    playAt(0)
    return
  }
  audio.play().catch(() => {})
}

function prevTrack() {
  if (!tracks.value.length) return
  if (audio && audio.currentTime > 3) {
    audio.currentTime = 0
    return
  }
  const next = (currentIdx.value - 1 + tracks.value.length) % tracks.value.length
  playAt(next)
}

function nextTrack() {
  if (!tracks.value.length) return
  const next = (currentIdx.value + 1) % tracks.value.length
  playAt(next)
}

function seek(ratio) {
  if (!audio || !Number.isFinite(audio.duration)) return
  audio.currentTime = Math.max(0, Math.min(audio.duration, audio.duration * ratio))
}

function removeTrack(idx) {
  const removed = tracks.value[idx]
  tracks.value = tracks.value.filter((_, i) => i !== idx)
  if (!removed) return

  if (idx === currentIdx.value) {
    audio?.pause()
    if (tracks.value.length === 0) {
      currentIdx.value = -1
      currentTime.value = 0
      duration.value = 0
      playing.value = false
      return
    }
    const newIdx = Math.min(idx, tracks.value.length - 1)
    playAt(newIdx)
  } else if (idx < currentIdx.value) {
    currentIdx.value -= 1
  }
}

function onDragOver() {
  dragOver.value = true
}

function onDragLeave() {
  dragOver.value = false
}

async function onDrop(event) {
  dragOver.value = false
  const files = [...event.dataTransfer.files].map((file) => file.path).filter(Boolean)
  await addPaths(files)
}

function drawSpectrum() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx2d = canvas.getContext('2d')
  if (!ctx2d) return

  const wrap = canvas.parentElement
  const dpr = window.devicePixelRatio || 1
  const cssW = Math.max(1, Math.round(wrap.clientWidth))
  const cssH = Math.max(1, Math.round(wrap.clientHeight))
  const targetW = Math.max(1, Math.round(cssW * dpr))
  const targetH = Math.max(1, Math.round(cssH * dpr))
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW
    canvas.height = targetH
    canvas.style.width = `${cssW}px`
    canvas.style.height = `${cssH}px`
  }

  ctx2d.setTransform(1, 0, 0, 1, 0, 0)
  ctx2d.scale(dpr, dpr)
  ctx2d.clearRect(0, 0, cssW, cssH)
  ctx2d.fillStyle = '#000'
  ctx2d.fillRect(0, 0, cssW, cssH)

  const barW = 5
  const gap = 2
  const step = barW + gap
  const bars = Math.max(10, Math.floor(cssW / step))

  let freq = null
  if (analyser) {
    freq = new Uint8Array(analyser.frequencyBinCount)
    analyser.getByteFrequencyData(freq)
  }

  let active = 0
  for (let i = 0; i < bars; i++) {
    const x = i * step
    let amp = 0

    if (freq) {
      const pos = i / bars
      const lo = Math.floor(Math.pow(pos, 1.25) * (freq.length - 1))
      const hi = Math.max(lo + 1, Math.floor(Math.pow((i + 1) / bars, 1.25) * (freq.length - 1)))
      let sum = 0
      for (let b = lo; b <= hi && b < freq.length; b++) sum += freq[b]
      const avg = sum / Math.max(1, hi - lo + 1)
      amp = Math.pow(Math.min(1, avg / 255), 0.85)
    }

    const h = Math.max(playing.value ? 2 : 0, Math.floor(amp * cssH * 0.95))
    if (h > 2) active += 1

    const grad = ctx2d.createLinearGradient(0, cssH - h, 0, cssH)
    grad.addColorStop(0, '#00ff41')
    grad.addColorStop(0.45, '#00aa33')
    grad.addColorStop(1, '#003311')
    ctx2d.fillStyle = grad
    ctx2d.fillRect(x, cssH - h, barW, h)
  }

  if (playing.value && active === 0) {
    const pulse = Math.floor((Date.now() / 120) % bars)
    for (let i = 0; i < Math.min(10, bars); i++) {
      const p = (pulse + i) % bars
      const x = p * step
      const h = Math.max(6, Math.floor(cssH * (0.1 + i * 0.02)))
      ctx2d.fillStyle = 'rgba(0,255,65,0.28)'
      ctx2d.fillRect(x, cssH - h, barW, h)
    }
  }

  rafId = requestAnimationFrame(drawSpectrum)
}

onMounted(() => {
  audio = new Audio()
  audio.preload = 'auto'
  audio.volume = volume.value

  const Ctx = window.AudioContext || window.webkitAudioContext
  if (Ctx) {
    audioCtx = new Ctx()
    analyser = audioCtx.createAnalyser()
    analyser.fftSize = 1024
    analyser.smoothingTimeConstant = 0.56
    analyser.minDecibels = -90
    analyser.maxDecibels = -10
    sourceNode = audioCtx.createMediaElementSource(audio)
    sourceNode.connect(analyser)
    analyser.connect(audioCtx.destination)
  }

  audio.addEventListener('timeupdate', () => { currentTime.value = audio.currentTime })
  audio.addEventListener('loadedmetadata', () => {
    duration.value = Number.isFinite(audio.duration) ? audio.duration : 0
    const idx = currentIdx.value
    if (idx >= 0 && tracks.value[idx]) {
      tracks.value[idx].duration = duration.value
    }
  })
  audio.addEventListener('play', () => { playing.value = true })
  audio.addEventListener('pause', () => { playing.value = false })
  audio.addEventListener('ended', () => { nextTrack() })

  drawSpectrum()
})

onBeforeUnmount(() => {
  if (rafId) cancelAnimationFrame(rafId)
  if (sourceNode) sourceNode.disconnect()
  if (analyser) analyser.disconnect()
  if (audioCtx) audioCtx.close()
  if (audio) audio.pause()
})

watch(volume, (v) => {
  if (!audio) return
  audio.volume = Math.max(0, Math.min(1, v))
})

watch(muted, (m) => {
  if (!audio) return
  audio.muted = !!m
})

watch(
  settings,
  (value) => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(value))
  },
  { deep: true }
)

watch(
  () => settings.value.compactMode,
  async (value) => {
    await window.electronAPI.setCompactMode?.(value)
  },
  { immediate: true }
)

watch(currentTrack, (track) => {
  if (track) loadCoverForTrack(track)
})

const progressRatio = computed(() => {
  if (!duration.value || duration.value <= 0) return 0
  return Math.max(0, Math.min(1, currentTime.value / duration.value))
})
</script>

<template>
  <div
    class="app vue-player"
    :class="{ 'app--compact': compact, 'app--dragover': dragOver }"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="onDragLeave"
    @drop.prevent="onDrop"
  >
    <div class="titlebar">
      <span class="titlebar__logo">RETROAMP</span>
      <div class="titlebar__menu">
        <button @click="openFiles">[ФАЙЛЫ]</button>
        <button @click="openFolder">[ПАПКА]</button>
        <button @click="importM3U">[M3U I]</button>
        <button @click="exportM3U">[M3U E]</button>
        <button @click="openSettings">[НАСТРОЙКИ]</button>
      </div>
      <span class="titlebar__track">{{ currentTrack ? `♪ ${currentTrack.title} — ${currentTrack.artist || 'Unknown artist'}` : 'RetroAmp Vue Player' }}</span>
      <div class="titlebar__wctrl">
        <button class="wctrl" @click="window.electronAPI.minimize()">─</button>
        <button class="wctrl" @click="window.electronAPI.maximize()">□</button>
        <button class="wctrl wctrl--close" @click="window.electronAPI.close()">✕</button>
      </div>
    </div>

    <div class="main-area">
      <div class="playlist" v-if="!compact">
        <div class="playlist__header">
          <span class="playlist__title">ПЛЕЙЛИСТ — {{ tracks.length }}</span>
        </div>
        <div class="playlist__list">
          <div
            v-for="(track, idx) in tracks"
            :key="track.id"
            class="playlist__item"
            :class="{ 'playlist__item--active': idx === currentIdx }"
            @click="playAt(idx)"
          >
            <span class="playlist__item-num">{{ String(idx + 1).padStart(2, '0') }}.</span>
            <span class="playlist__item-name">{{ track.title }}{{ track.artist ? ` — ${track.artist}` : '' }}</span>
            <span class="playlist__item-dur">{{ track.duration > 0 ? fmtTime(track.duration) : '' }}</span>
            <button class="playlist__item-del" @click.stop="removeTrack(idx)">✕</button>
          </div>
        </div>
      </div>

      <div class="right-panel">
        <div class="spectrum-wrap" @contextmenu.prevent="() => {}">
          <canvas ref="canvasRef" class="spectrum-canvas" />
        </div>

        <div class="track-meta" v-if="settings.showCover || currentTrack">
          <div class="track-meta__cover-wrap">
            <img v-if="currentTrack?.cover" :src="currentTrack.cover" alt="Album cover" class="track-meta__cover" />
            <div v-else class="track-meta__cover track-meta__cover--fallback">NO COVER</div>
          </div>

          <div class="track-info">
            <span class="track-info__label">NOW PLAYING</span>
            <span class="track-info__title">{{ currentTrack ? currentTrack.title : 'No track loaded' }}</span>
            <div class="track-info__meta" v-if="currentTrack">
              <span class="track-info__sub">Artist: {{ currentTrack.artist || 'Unknown artist' }}</span>
              <span class="track-info__sub">Album: {{ currentTrack.album || 'Unknown album' }}<span v-if="currentTrack.year"> ({{ currentTrack.year }})</span></span>
            </div>
            <span class="track-info__sub" v-else>Open files/folder to start playback.</span>
          </div>
        </div>
      </div>
    </div>

    <div class="controls">
      <div class="controls__seekrow">
        <span class="controls__time">{{ fmtTime(currentTime) }}</span>
        <input
          class="controls__seek"
          type="range"
          min="0"
          max="1"
          step="0.0001"
          :value="progressRatio"
          @input="seek(parseFloat($event.target.value))"
        />
        <span class="controls__time controls__time--right">{{ fmtTime(duration) }}</span>
      </div>

      <div class="controls__row">
        <div class="controls__transport">
          <button class="ctrl" @click="prevTrack">|◄◄</button>
          <button class="ctrl ctrl--play" @click="togglePlay">{{ playing ? '‖‖' : ' ▶ ' }}</button>
          <button class="ctrl" @click="nextTrack">▶▶|</button>
        </div>

        <div class="controls__spacer" />

        <div class="controls__vol">
          <button class="ctrl ctrl--icon" @click="muted = !muted">{{ muted ? '🔇' : '🔊' }}</button>
          <input
            class="controls__volbar"
            type="range"
            min="0"
            max="1"
            step="0.01"
            :value="muted ? 0 : volume"
            @input="volume = parseFloat($event.target.value)"
          />
          <span class="controls__volpct">{{ Math.round(volume * 100) }}%</span>
        </div>
      </div>
    </div>

    <div v-if="showSettings" class="settings" @click.self="closeSettings">
      <div class="settings__panel">
        <div class="settings__head">
          <span>НАСТРОЙКИ</span>
          <button @click="closeSettings">✕</button>
        </div>
        <label class="settings__row settings__row--check">
          <input type="checkbox" v-model="settings.compactMode" />
          <span>Компактный режим</span>
        </label>
        <label class="settings__row settings__row--check">
          <input type="checkbox" v-model="settings.showCover" />
          <span>Показывать обложку</span>
        </label>
        <label class="settings__row settings__row--check">
          <input type="checkbox" v-model="settings.autoPlayOnAdd" />
          <span>Автозапуск при добавлении</span>
        </label>
        <label class="settings__row">
          <span>Интенсивность визуализации</span>
          <input type="range" min="0.6" max="1.6" step="0.05" v-model.number="settings.vizIntensity" />
        </label>
        <div class="settings__footer">
          <button @click="closeSettings">ОК</button>
        </div>
      </div>
    </div>
  </div>
</template>
