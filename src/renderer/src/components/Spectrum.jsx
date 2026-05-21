import React, { useRef, useEffect } from 'react'

const C_BOT = '#003311'
const C_MID = '#00aa33'
const C_TOP = '#00ff41'
const C_PEAK = '#99ffbb'
const C_GRID = 'rgba(0,255,65,0.06)'

export default function Spectrum({ analyserRef, playing, intensity = 1, mode = 'bars', onContextMenu }) {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const rafRef = useRef(null)
  const barsRef = useRef([])
  const peaksRef = useRef([])
  const peakVRef = useRef([])
  const decayRef = useRef(false)
  const prevFreqRef = useRef(null)

  useEffect(() => { decayRef.current = !playing }, [playing])

  useEffect(() => {
    const canvas = canvasRef.current
    const wrap = wrapRef.current
    if (!canvas || !wrap) return

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1
      const cssW = Math.max(1, Math.round(wrap.clientWidth))
      const cssH = Math.max(1, Math.round(wrap.clientHeight))
      canvas.width = Math.max(1, Math.round(cssW * dpr))
      canvas.height = Math.max(1, Math.round(cssH * dpr))
      canvas.style.width = `${cssW}px`
      canvas.style.height = `${cssH}px`
      barsRef.current = []
      peaksRef.current = []
      peakVRef.current = []
      prevFreqRef.current = null
    }

    const ensureCanvasSize = () => {
      const dpr = window.devicePixelRatio || 1
      const cssW = Math.max(1, Math.round(wrap.clientWidth))
      const cssH = Math.max(1, Math.round(wrap.clientHeight))
      const targetW = Math.max(1, Math.round(cssW * dpr))
      const targetH = Math.max(1, Math.round(cssH * dpr))
      if (canvas.width !== targetW || canvas.height !== targetH) {
        resizeCanvas()
      }
    }

    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          resizeCanvas()
        }
      }
    })
    ro.observe(wrap)
    resizeCanvas()
    const rafResize = requestAnimationFrame(() => resizeCanvas())
    window.addEventListener('resize', ensureCanvasSize)

    const ctx = canvas.getContext('2d')

    let dataArr = null
    let colCount = 0

    const initBufs = (cols) => {
      if (cols === colCount) return
      colCount = cols
      barsRef.current = new Float32Array(cols)
      peaksRef.current = new Float32Array(cols)
      peakVRef.current = new Float32Array(cols)
      prevFreqRef.current = null
    }

    const fillBar = (ctx2d, x, barWidth, drawH, barH, renderMode) => {
      if (renderMode === 'dots') {
        const dotStep = 4
        for (let y = drawH; y > drawH - barH; y -= dotStep) {
          const alpha = 0.35 + ((drawH - y) / Math.max(1, barH)) * 0.65
          ctx2d.fillStyle = `rgba(0,255,65,${alpha.toFixed(3)})`
          ctx2d.fillRect(x + 1, y, barWidth - 2, 2)
        }
        return
      }

      if (renderMode === 'mirror') {
        const half = Math.floor(barH / 2)
        const cy = Math.floor(drawH / 2)
        const grad = ctx2d.createLinearGradient(0, cy - half, 0, cy + half)
        grad.addColorStop(0, C_TOP)
        grad.addColorStop(0.5, C_MID)
        grad.addColorStop(1, C_BOT)
        ctx2d.fillStyle = grad
        ctx2d.fillRect(x, cy - half, barWidth, half)
        ctx2d.fillRect(x, cy, barWidth, half)
        return
      }

      const grad = ctx2d.createLinearGradient(0, drawH - barH, 0, drawH)
      grad.addColorStop(0, C_TOP)
      grad.addColorStop(0.45, C_MID)
      grad.addColorStop(1, C_BOT)
      ctx2d.fillStyle = grad
      ctx2d.fillRect(x, drawH - barH, barWidth, barH)
    }

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw)
      ensureCanvasSize()

      const analyser = analyserRef.current
      const W = canvas.width
      const H = canvas.height
      if (!W || !H) return

      const dpr = window.devicePixelRatio || 1
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.scale(dpr, dpr)
      const drawW = Math.max(1, Math.floor(W / dpr))
      const drawH = Math.max(1, Math.floor(H / dpr))

      const BAR_W = mode === 'dots' ? 4 : 5
      const GAP = 1
      const STEP = BAR_W + GAP
      const cols = Math.max(8, Math.floor(drawW / STEP))
      initBufs(cols)
      const prevFreq = prevFreqRef.current

      if (analyser) {
        if (!dataArr || dataArr.length !== analyser.frequencyBinCount) {
          dataArr = new Uint8Array(analyser.frequencyBinCount)
          prevFreqRef.current = new Uint8Array(analyser.frequencyBinCount)
        }
        if (!decayRef.current) analyser.getByteFrequencyData(dataArr)
      }

      ctx.clearRect(0, 0, drawW, drawH)

      ctx.fillStyle = C_GRID
      for (let y = 0; y < drawH; y += Math.max(1, Math.floor(drawH / 8))) {
        ctx.fillRect(0, y, drawW, 1)
      }

      let activeBars = 0

      for (let i = 0; i < cols; i++) {
        let raw = 0
        let flux = 0
        if (analyser && dataArr) {
          const bins = analyser.frequencyBinCount
          const from = i / cols
          const to = (i + 1) / cols
          const binLo = Math.max(0, Math.min(bins - 1, Math.floor(Math.pow(from, 1.28) * (bins - 1))))
          const binHi = Math.max(binLo + 1, Math.min(bins, Math.floor(Math.pow(to, 1.28) * (bins - 1))))
          for (let b = binLo; b < binHi; b++) {
            raw += dataArr[b]
            flux += prevFreq ? Math.abs(dataArr[b] - prevFreq[b]) : 0
          }
          const count = Math.max(1, binHi - binLo)
          raw /= count
          flux /= count
        }

        const avgNorm = Math.max(0, (raw - 8) / 220)
        const fluxNorm = Math.max(0, (flux - 3) / 180)
        const bandPos = i / cols
        const bandTilt = (1.18 - Math.min(0.24, bandPos * 0.18)) * (0.98 + bandPos * 0.12)
        const boosted = (avgNorm * 0.68 + fluxNorm * 0.32) * bandTilt * Math.max(0.6, intensity) * 1.9
        const target = Math.pow(Math.max(0, Math.min(1, boosted)), 0.86)

        if (!decayRef.current) {
          const cur = barsRef.current[i]
          barsRef.current[i] = target > cur
            ? cur + (target - cur) * 0.72
            : cur * 0.82
        } else {
          barsRef.current[i] *= 0.82
        }

        const barH = Math.floor(barsRef.current[i] * drawH)
        const x = i * STEP

        if (!decayRef.current && barH >= peaksRef.current[i]) {
          peaksRef.current[i] = barH
          peakVRef.current[i] = 0
        } else {
          peakVRef.current[i] += 0.35
          peaksRef.current[i] = Math.max(0, peaksRef.current[i] - peakVRef.current[i])
        }

        if (barH < 1) continue
        activeBars += 1

        fillBar(ctx, x, BAR_W, drawH, barH, mode)

        const py = drawH - Math.floor(peaksRef.current[i])
        if (py > 0 && py < drawH) {
          ctx.fillStyle = C_PEAK
          ctx.fillRect(x, py, BAR_W, 2)
        }
      }

      if (prevFreq && dataArr) prevFreq.set(dataArr)

      if (playing && activeBars === 0) {
        const pulse = (Date.now() / 180) % cols
        for (let i = 0; i < Math.min(cols, 10); i++) {
          const idx = (Math.floor(pulse) + i) % cols
          const x = idx * STEP
          const h = Math.max(10, Math.floor(drawH * (0.12 + i * 0.018)))
          ctx.fillStyle = 'rgba(0,255,65,0.22)'
          ctx.fillRect(x, drawH - h, BAR_W, h)
        }
      }

      ctx.fillStyle = 'rgba(0,0,0,0.12)'
      for (let y = 0; y < drawH; y += 2) ctx.fillRect(0, y, drawW, 1)
    }

    draw()

    return () => {
      ro.disconnect()
      cancelAnimationFrame(rafResize)
      window.removeEventListener('resize', ensureCanvasSize)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [analyserRef, intensity, mode])

  return (
    <div ref={wrapRef} className="spectrum-wrap" onContextMenu={onContextMenu}>
      <canvas ref={canvasRef} className="spectrum-canvas" />
    </div>
  )
}
