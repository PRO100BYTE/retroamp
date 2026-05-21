import React, { useRef, useEffect } from 'react'

// Color palette
const C_TOP    = '#00ff41'
const C_MID    = '#00aa28'
const C_BOT    = '#002208'
const C_PEAK   = '#ccffdd'
const C_CYAN   = '#00e5ff'
const C_GRID   = 'rgba(0,255,65,0.05)'

// Logarithmic bin mapping (similar to FL Studio) — gives more resolution to lows
function logBins(fftSize, barCount) {
  const bins = []
  for (let i = 0; i <= barCount; i++) {
    const t = i / barCount
    // mix log2 and linear: emphasize low-mids
    const logT = Math.pow(t, 1.8)
    bins.push(Math.round(logT * (fftSize - 1)))
  }
  return bins
}

export default function Spectrum({ analyserRef, playing, intensity = 1, mode = 'bars', onContextMenu }) {
  const wrapRef    = useRef(null)
  const canvasRef  = useRef(null)
  const rafRef     = useRef(null)
  const stateRef   = useRef({
    bars: [], peaks: [], peakVel: [], binMap: null,
    freqData: null, waveData: null,
    flameMap: null,
    w: 0, h: 0, barCount: 0,
  })
  const playingRef = useRef(playing)
  const modeRef    = useRef(mode)
  const intensRef  = useRef(intensity)

  useEffect(() => { playingRef.current = playing }, [playing])
  useEffect(() => { modeRef.current = mode }, [mode])
  useEffect(() => { intensRef.current = intensity }, [intensity])

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap   = wrapRef.current
    if (!canvas || !wrap) return
    const dpr = window.devicePixelRatio || 1

    const resize = () => {
      const rect = wrap.getBoundingClientRect()
      const cw = Math.max(32, Math.round(rect.width))
      const ch = Math.max(32, Math.round(rect.height))
      canvas.width  = Math.round(cw * dpr)
      canvas.height = Math.round(ch * dpr)
      canvas.style.width  = `${cw}px`
      canvas.style.height = `${ch}px`
      const s = stateRef.current
      s.bars = []; s.peaks = []; s.peakVel = []; s.binMap = null
      s.flameMap = null; s.w = cw; s.h = ch
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    window.addEventListener('resize', resize)

    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    // ─── helpers ────────────────────────────────────────────────────────────

    const getGrad = (y0, y1) => {
      const g = ctx.createLinearGradient(0, y0, 0, y1)
      g.addColorStop(0,   C_TOP)
      g.addColorStop(0.5, C_MID)
      g.addColorStop(1,   C_BOT)
      return g
    }

    // ─── draw modes ─────────────────────────────────────────────────────────

    const drawBars = (s, barW, gap) => {
      for (let i = 0; i < s.barCount; i++) {
        const bh = s.bars[i] * s.h
        if (bh < 1) continue
        const x = i * (barW + gap)
        ctx.fillStyle = getGrad(s.h - bh, s.h)
        ctx.fillRect(x, s.h - bh, barW, bh)
        const py = s.h - s.peaks[i]
        if (py > 0 && py < s.h) {
          ctx.fillStyle = C_PEAK
          ctx.fillRect(x, py - 1, barW, 2)
        }
      }
    }

    const drawDots = (s, barW, gap) => {
      const step = Math.max(3, Math.floor(barW))
      for (let i = 0; i < s.barCount; i++) {
        const bh = s.bars[i] * s.h
        if (bh < 2) continue
        const x = i * (barW + gap) + Math.floor((barW - step + 1) / 2)
        for (let y = s.h - step; y > s.h - bh; y -= step + 1) {
          const alpha = 0.35 + ((s.h - y) / Math.max(1, bh)) * 0.65
          ctx.fillStyle = `rgba(0,255,65,${alpha.toFixed(2)})`
          ctx.fillRect(x, y, step, step)
        }
        const py = s.h - s.peaks[i]
        if (py > 0 && py < s.h) {
          ctx.fillStyle = C_PEAK
          ctx.fillRect(x, py - 1, step, 2)
        }
      }
    }

    const drawMirror = (s, barW, gap) => {
      const cy = s.h / 2
      for (let i = 0; i < s.barCount; i++) {
        const half = (s.bars[i] * s.h) / 2
        if (half < 1) continue
        const x = i * (barW + gap)
        ctx.fillStyle = getGrad(cy - half, cy + half)
        ctx.fillRect(x, cy - half, barW, half)
        ctx.fillRect(x, cy, barW, half)
        const pd = s.peaks[i] / 2
        if (pd > 0) {
          ctx.fillStyle = C_PEAK
          ctx.fillRect(x, cy - pd - 1, barW, 2)
          ctx.fillRect(x, cy + pd - 1, barW, 2)
        }
      }
    }

    // Line spectrum: thin spline silhouette (FL Studio "Line" style)
    const drawLine = (s) => {
      if (s.barCount < 2) return
      ctx.beginPath()
      const step = s.w / Math.max(1, s.barCount - 1)
      ctx.moveTo(0, s.h - s.bars[0] * s.h)
      for (let i = 1; i < s.barCount; i++) {
        const xa = (i - 1) * step
        const xb = i * step
        const ya = s.h - s.bars[i - 1] * s.h
        const yb = s.h - s.bars[i] * s.h
        ctx.bezierCurveTo(xa + step * 0.5, ya, xb - step * 0.5, yb, xb, yb)
      }
      ctx.strokeStyle = C_TOP
      ctx.lineWidth   = 2
      ctx.shadowColor = C_TOP
      ctx.shadowBlur  = 6
      ctx.stroke()
      ctx.shadowBlur = 0

      // fill under curve
      ctx.lineTo(s.w, s.h); ctx.lineTo(0, s.h); ctx.closePath()
      const gFill = ctx.createLinearGradient(0, 0, 0, s.h)
      gFill.addColorStop(0,   'rgba(0,255,65,0.25)')
      gFill.addColorStop(0.6, 'rgba(0,170,40,0.08)')
      gFill.addColorStop(1,   'rgba(0,0,0,0)')
      ctx.fillStyle = gFill
      ctx.fill()
    }

    // Oscilloscope: time-domain waveform
    const drawOscilloscope = (s) => {
      const data = s.waveData
      if (!data) return
      const step = s.w / data.length
      ctx.beginPath()
      for (let i = 0; i < data.length; i++) {
        const y = ((data[i] - 128) / 128) * (s.h * 0.45) + s.h / 2
        i === 0 ? ctx.moveTo(0, y) : ctx.lineTo(i * step, y)
      }
      ctx.strokeStyle = C_CYAN
      ctx.lineWidth   = 1.5
      ctx.shadowColor = C_CYAN
      ctx.shadowBlur  = 8
      ctx.stroke()
      ctx.shadowBlur  = 0
      // zero line
      ctx.strokeStyle = 'rgba(0,229,255,0.15)'
      ctx.lineWidth   = 1
      ctx.beginPath()
      ctx.moveTo(0, s.h / 2); ctx.lineTo(s.w, s.h / 2)
      ctx.stroke()
    }

    // Flame: cellular automaton fire effect driven by spectrum (FL Studio "Fire")
    const drawFlame = (s, barW, gap) => {
      const cols = s.barCount
      const rows = Math.max(4, Math.round(s.h / 4))
      if (!s.flameMap || s.flameMap.length !== cols * rows) {
        s.flameMap = new Float32Array(cols * rows)
      }
      const fm = s.flameMap

      // Seed bottom row from spectrum
      for (let i = 0; i < cols; i++) {
        fm[(rows - 1) * cols + i] = s.bars[i] * intensRef.current
      }

      // Propagate upward, spread and cool
      for (let r = rows - 2; r >= 0; r--) {
        for (let c = 0; c < cols; c++) {
          const left  = fm[(r + 1) * cols + Math.max(0, c - 1)]
          const mid   = fm[(r + 1) * cols + c]
          const right = fm[(r + 1) * cols + Math.min(cols - 1, c + 1)]
          fm[r * cols + c] = Math.max(0, (left + mid + right) / 3 - 0.015)
        }
      }

      // Render cells
      const cellH = s.h / rows
      const cellW = barW + gap
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const v = fm[r * cols + c]
          if (v < 0.01) continue
          const x = c * cellW
          const y = r * cellH
          let color
          if (v < 0.33)      color = `rgba(200,50,0,${(v / 0.33).toFixed(2)})`
          else if (v < 0.66) color = `rgba(255,${Math.round(80 + (v - 0.33) / 0.33 * 120)},0,0.9)`
          else               color = `rgba(255,${Math.round(200 + (v - 0.66) / 0.34 * 55)},${Math.round((v - 0.66) / 0.34 * 80)},1)`
          ctx.fillStyle = color
          ctx.fillRect(x, y, cellW + 1, cellH + 1)
        }
      }
    }

    // ─── main loop ──────────────────────────────────────────────────────────

    const frame = () => {
      rafRef.current = requestAnimationFrame(frame)
      const s   = stateRef.current
      const W   = canvas.width
      const H   = canvas.height
      const w   = Math.round(W / dpr)
      const h   = Math.round(H / dpr)
      const m   = modeRef.current
      const ipl = playingRef.current

      s.w = w; s.h = h

      const BAR_W = m === 'dots' ? 5 : 6
      const GAP   = 1
      const STEP  = BAR_W + GAP
      const cols  = Math.max(8, Math.floor(w / STEP))

      if (cols !== s.barCount) {
        s.barCount = cols
        s.bars     = new Float32Array(cols)
        s.peaks    = new Float32Array(cols)
        s.peakVel  = new Float32Array(cols)
        s.binMap   = null
        s.flameMap = null
      }

      const analyser = analyserRef?.current

      // ── fetch data ──
      if (analyser) {
        const fftSize = analyser.frequencyBinCount
        if (!s.freqData || s.freqData.length !== fftSize) {
          s.freqData = new Uint8Array(fftSize)
          s.waveData = new Uint8Array(analyser.fftSize)
        }
        if (!s.binMap) s.binMap = logBins(fftSize, cols)

        if (ipl) {
          analyser.getByteFrequencyData(s.freqData)
          if (m === 'oscilloscope') analyser.getByteTimeDomainData(s.waveData)
        }
      }

      // ── process bars ──
      const RISE = 0.75   // fast attack
      const FALL = 0.62   // fast fall (lower = faster)

      for (let i = 0; i < cols && analyser && s.freqData; i++) {
        const lo = s.binMap ? s.binMap[i] : Math.floor(i / cols * s.freqData.length)
        const hi = s.binMap ? s.binMap[i + 1] : Math.floor((i + 1) / cols * s.freqData.length)
        let sum = 0
        for (let b = lo; b <= hi; b++) sum += s.freqData[b]
        const avg = sum / Math.max(1, hi - lo + 1)
        const target = Math.pow(avg / 255, 0.8) * Math.max(0.5, intensRef.current)

        const cur = s.bars[i]
        s.bars[i] = target > cur ? cur + (target - cur) * RISE : cur * FALL

        const bh = s.bars[i] * h
        if (!ipl) {
          s.bars[i] *= 0.60   // extra fast decay on pause
          s.peaks[i] = Math.max(0, s.peaks[i] - 2)
        } else if (bh >= s.peaks[i]) {
          s.peaks[i]   = bh
          s.peakVel[i] = 0
        } else {
          s.peakVel[i] = Math.min(8, s.peakVel[i] + 0.6)
          s.peaks[i]   = Math.max(0, s.peaks[i] - s.peakVel[i])
        }
      }

      // ── clear ──
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = '#020702'
      ctx.fillRect(0, 0, w, h)

      // ── grid ──
      if (m !== 'oscilloscope' && m !== 'flame') {
        ctx.fillStyle = C_GRID
        for (let y = 0; y < h; y += Math.max(4, Math.floor(h / 10))) {
          ctx.fillRect(0, y, w, 1)
        }
      }

      // ── draw mode ──
      if (!analyser) {
        ctx.fillStyle = 'rgba(0,255,65,0.12)'
        ctx.font      = '11px monospace'
        ctx.textAlign = 'center'
        ctx.fillText('NO SIGNAL', w / 2, h / 2)
      } else {
        if      (m === 'bars')        drawBars(s, BAR_W, GAP)
        else if (m === 'dots')        drawDots(s, BAR_W, GAP)
        else if (m === 'mirror')      drawMirror(s, BAR_W, GAP)
        else if (m === 'line')        drawLine(s)
        else if (m === 'oscilloscope') drawOscilloscope(s)
        else if (m === 'flame')       drawFlame(s, BAR_W, GAP)
      }

      // ── CRT scanlines ──
      ctx.fillStyle = 'rgba(0,0,0,0.10)'
      for (let y = 0; y < h; y += 2) ctx.fillRect(0, y, w, 1)
    }

    frame()

    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
      window.removeEventListener('resize', resize)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyserRef])

  return (
    <div
      ref={wrapRef}
      className="spectrum-wrap"
      onContextMenu={onContextMenu}
      style={{ width: '100%', height: '100%' }}
    >
      <canvas
        ref={canvasRef}
        className="spectrum-canvas"
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  )
}
