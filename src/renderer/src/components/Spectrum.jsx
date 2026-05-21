import React, { useRef, useEffect, useCallback } from 'react'

// ─── Colour palette ───────────────────────────────────────────────────────────
const C_BOT  = '#003311'
const C_MID  = '#00aa33'
const C_TOP  = '#00ff41'
const C_PEAK = '#99ffbb'
const C_GRID = 'rgba(0,255,65,0.06)'

export default function Spectrum({ analyserRef, playing }) {
  const wrapRef   = useRef(null)
  const canvasRef = useRef(null)
  const rafRef    = useRef(null)

  // Physics buffers — stored in refs so they survive re-renders
  const barsRef    = useRef([])
  const peaksRef   = useRef([])
  const peakVRef   = useRef([])
  const decayRef   = useRef(false)

  useEffect(() => { decayRef.current = !playing }, [playing])

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap   = wrapRef.current
    if (!canvas || !wrap) return

    // Keep canvas pixel-perfect with its CSS size
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        canvas.width  = Math.round(entry.contentRect.width)
        canvas.height = Math.round(entry.contentRect.height)
        // Reset physics on resize
        barsRef.current  = []
        peaksRef.current = []
        peakVRef.current = []
      }
    })
    ro.observe(wrap)

    const ctx = canvas.getContext('2d')

    let dataArr = null
    let COLS = 0

    const initBufs = (cols) => {
      if (cols === COLS) return
      COLS = cols
      barsRef.current  = new Float32Array(cols)
      peaksRef.current = new Float32Array(cols)
      peakVRef.current = new Float32Array(cols)
    }

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw)

      const analyser = analyserRef.current
      const W = canvas.width
      const H = canvas.height
      if (!W || !H) return

      // BAR_W governs how many columns fit — 5px bars + 1px gap = 6px each
      const BAR_W   = 5
      const GAP     = 1
      const STEP    = BAR_W + GAP
      const cols    = Math.floor(W / STEP)
      initBufs(cols)

      if (analyser) {
        if (!dataArr || dataArr.length !== analyser.frequencyBinCount) {
          dataArr = new Uint8Array(analyser.frequencyBinCount)
        }
        if (!decayRef.current) analyser.getByteFrequencyData(dataArr)
      }

      // Clear
      ctx.clearRect(0, 0, W, H)

      // Horizontal grid lines
      ctx.fillStyle = C_GRID
      for (let y = 0; y < H; y += Math.floor(H / 8)) {
        ctx.fillRect(0, y, W, 1)
      }

      for (let i = 0; i < cols; i++) {
        // Frequency bin mapping — logarithmic-ish weighting towards low freqs
        let raw = 0
        if (analyser && dataArr) {
          const bins  = analyser.frequencyBinCount
          const frac  = i / cols
          // map bar index to bin index with mild log curve
          const binLo = Math.floor(Math.pow(frac,       1.5) * bins * 0.85)
          const binHi = Math.floor(Math.pow((i + 1) / cols, 1.5) * bins * 0.85)
          for (let b = binLo; b <= binHi && b < bins; b++) raw = Math.max(raw, dataArr[b])
        }

        const target = raw / 255
        if (!decayRef.current) {
          // Smooth rise, instant snappy fall
          const cur = barsRef.current[i]
          barsRef.current[i] = target > cur
            ? cur + (target - cur) * 0.55   // rise fast
            : cur * 0.78                     // fall
        } else {
          barsRef.current[i] *= 0.82         // decay on pause
        }

        const barH = Math.floor(barsRef.current[i] * H)
        const x    = i * STEP

        // Peak physics
        if (!decayRef.current && barH >= peaksRef.current[i]) {
          peaksRef.current[i] = barH
          peakVRef.current[i] = 0
        } else {
          peakVRef.current[i] += 0.35
          peaksRef.current[i] = Math.max(0, peaksRef.current[i] - peakVRef.current[i])
        }

        if (barH < 1) continue

        // Gradient bar
        const grad = ctx.createLinearGradient(0, H - barH, 0, H)
        grad.addColorStop(0,    C_TOP)
        grad.addColorStop(0.45, C_MID)
        grad.addColorStop(1,    C_BOT)
        ctx.fillStyle = grad
        ctx.fillRect(x, H - barH, BAR_W, barH)

        // Peak dot
        const py = H - Math.floor(peaksRef.current[i])
        if (py > 0 && py < H) {
          ctx.fillStyle = C_PEAK
          ctx.fillRect(x, py, BAR_W, 2)
        }
      }

      // CRT scanlines
      ctx.fillStyle = 'rgba(0,0,0,0.12)'
      for (let y = 0; y < H; y += 2) ctx.fillRect(0, y, W, 1)
    }

    draw()

    return () => {
      ro.disconnect()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [analyserRef])

  return (
    <div ref={wrapRef} className="spectrum-wrap">
      <canvas ref={canvasRef} className="spectrum-canvas" />
    </div>
  )
}
